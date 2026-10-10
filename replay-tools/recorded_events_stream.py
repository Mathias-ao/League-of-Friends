"""Recorded Events V1: direct extraction and validated, bounded streaming reads.

No source bytes, canonical files, or persisted analysis cache. The statistical
models still need an in-memory action index; clock/camera/terrain rows do not.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
import gzip
import hashlib
import math
import os
from pathlib import Path
import re
import tempfile
import uuid

from analysis_dataset import ANALYSIS_DATASET_VERSION, ANALYSIS_SCHEMA_VERSION, _compact_action, _compact_initial_object
from canonical_io import json_bytes, load_json, read_json, sha256
from canonical_projector import CompactProjector
from canonical_run import code_digest, fundamentals
from match_facts import compact_header
from recorded_events import EVENT_COLUMNS, OBJECT_COLUMNS, OPERATION_TYPES, _row, clean_decoded, iter_events

VERSION = "AOF_RECORDED_EVENTS_V1"
RETENTION = "AOF_RECORDED_EVENTS_RETENTION_V1"
MAX_LINE_BYTES = 16 * 1024 * 1024
MAX_JSON_BYTES = 512 * 1024 * 1024
MAX_STORED_BYTES = 128 * 1024 * 1024
SHA_PATTERN = re.compile(r"[a-f0-9]{64}")


def _integer(value, minimum=0):
    return type(value) is int and value >= minimum


def _safe(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if "base64" in key.lower() or key.startswith("_raw") or key in {"rawDecodedObject", "failure"}:
                raise ValueError("Forbidden binary/diagnostic retention")
            _safe(child)
    elif isinstance(value, list):
        for child in value:
            _safe(child)
    elif isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Non-finite observation")


class StreamValidator:
    """Chronology, structure and completeness, without retaining operation rows."""
    def __init__(self):
        self.header = None
        self.footer = None
        self.phase = 0
        self.objects = self.tiles = self.events = self.elapsed = 0
        self.operations, self.decodes = Counter(), Counter()

    def consume(self, record):
        if not isinstance(record, list) or not record or self.footer is not None:
            raise ValueError("Invalid record or trailing content")
        kind = record[0]
        if self.header is None:
            if kind != "header" or len(record) != 2:
                raise ValueError("Missing stream header")
            h = record[1]
            _safe(h)
            if (h.get("datasetVersion") != VERSION or h.get("schemaVersion") != "1.0.0" or
                    h.get("retentionVersion") != RETENTION or h.get("layer") != "decoded_observations" or
                    h.get("eventColumns") != EVENT_COLUMNS or h.get("objectColumns") != OBJECT_COLUMNS):
                raise ValueError("Unsupported event contract")
            if not SHA_PATTERN.fullmatch(h["source"].get("sha256", "")) or not _integer(h["source"].get("bytes"), 1):
                raise ValueError("Invalid recording identity")
            extraction = h["extraction"]
            uuid.UUID(extraction["revision"])
            for key in ("extractorCodeSha256", "decoderCodeSha256"):
                if not SHA_PATTERN.fullmatch(extraction.get(key, "")):
                    raise ValueError("Missing extractor identity")
            if not isinstance(extraction.get("parserVersion"), str) or not extraction["parserVersion"]:
                raise ValueError("Missing parser version")
            qualification = h["qualification"]
            expected = {"initialObjects": "partial_parser_object_search", "initialPlayerResources": "unavailable_parser_skips_values",
                        "gameElapsedOriginQualified": False, "semanticCompleteness": "not_established",
                        "chatContent": "not_retained", "rawBytes": "not_retained"}
            if any(qualification.get(k) != v for k, v in expected.items()):
                raise ValueError("Unsupported V1 qualification/retention")
            if qualification["compatibility"]["status"] not in {"fixture_regression_only", "unverified_tuple"}:
                raise ValueError("Invalid compatibility qualification")
            slots = [p["playerId"] for p in h["context"]["participants"]]
            if not slots or len(slots) > 8 or len(slots) != len(set(slots)) or any(not _integer(p, 1) or p > 8 for p in slots):
                raise ValueError("Invalid replay player identities")
            initial_players = h["initialPlayerObservations"]
            if [p["playerId"] for p in initial_players] != slots:
                raise ValueError("Initial player observations do not match replay slots")
            for player in initial_players:
                self._geometry(player["position"], None)
                if player["playerTypeRaw"] is not None and type(player["playerTypeRaw"]) is not int:
                    raise ValueError("Invalid initial player type")
            self.map = h["context"]["initialState"]["map"]
            if any(not _integer(self.map.get(k), 1) for k in ("width", "height")):
                raise ValueError("Invalid map dimensions")
            self.header = h
            return
        if kind == "object":
            if self.phase > 0 or len(record) != 3 or type(record[1]) is not int or record[1] != self.objects:
                raise ValueError("Initial object order mismatch")
            row = record[2]
            if not isinstance(row, list) or len(row) != len(OBJECT_COLUMNS):
                raise ValueError("Invalid initial object row")
            if any(v is not None and type(v) is not int for v in row[:5]):
                raise ValueError("Invalid initial object identity")
            self._geometry(row[5], row[6])
            self.objects += 1
        elif kind == "tile":
            if self.phase > 1 or len(record) != 4 or type(record[1]) is not int or record[1] != self.tiles:
                raise ValueError("Terrain order mismatch")
            if any(v is not None and type(v) is not int for v in record[2:]):
                raise ValueError("Invalid terrain observation")
            self.phase = 1
            self.tiles += 1
        elif kind == "sync":
            if (len(record) != 5 or type(record[1]) is not int or record[1] != self.events or
                    not _integer(record[2]) or record[3] not in {"complete", "partial"} or
                    not isinstance(record[4], list) or any(not isinstance(v, str) for v in record[4])):
                raise ValueError("Invalid compact sync observation")
            self.phase = 2
            self.elapsed += record[2]
            self.operations["SYNC"] += 1
            self.decodes[record[3]] += 1
            self.events += 1
        elif kind == "event":
            if len(record) != 3 or type(record[1]) is not int or record[1] != self.events:
                raise ValueError("Non-contiguous operation order")
            self.phase = 2
            row = record[2]
            if not isinstance(row, list) or len(row) != len(EVENT_COLUMNS):
                raise ValueError("Invalid operation row")
            at, op = row[:2]
            if not _integer(at) or op not in OPERATION_TYPES or not isinstance(row[2], str):
                raise ValueError("Invalid operation/clock")
            if not isinstance(row[12], dict) or not isinstance(row[16], dict):
                raise ValueError("Invalid observation payload")
            _safe(row[12])
            _safe(row[16])
            if row[4] is not None and not isinstance(row[4], str):
                raise ValueError("Invalid action name")
            if row[13] not in {"complete", "partial", "failed", "unknown_action"}:
                raise ValueError("Invalid decode status")
            if not isinstance(row[14], list) or any(not isinstance(v, str) for v in row[14]):
                raise ValueError("Invalid warning codes")
            if not isinstance(row[7], list) or any(type(v) is not int for v in row[7]):
                raise ValueError("Invalid selected object references")
            for index in (3, 5, 6, 8, 15):
                if row[index] is not None and type(row[index]) is not int:
                    raise ValueError("Invalid operation identifier")
            self._geometry(row[10], row[9])
            self._geometry(row[11], None)
            if op == "SYNC":
                increment = row[12].get("incrementMs")
                if not _integer(increment):
                    raise ValueError("Invalid sync increment")
                self.elapsed += increment
            if at != self.elapsed:
                raise ValueError("Clock does not match exact sync increments")
            self.operations[op] += 1
            self.decodes[row[13]] += 1
            self.events += 1
        elif kind == "end":
            if len(record) != 2 or record[1] != self.summary():
                raise ValueError("Completeness footer mismatch")
            if self.tiles != self.map["width"] * self.map["height"]:
                raise ValueError("Incomplete terrain")
            self.footer = record[1]
        else:
            raise ValueError("Unknown record kind or duplicate header")

    @staticmethod
    def _geometry(position, entity):
        _safe(position)
        _safe(entity)
        if position is not None:
            if not isinstance(position, dict) or any(type(position.get(k)) not in (int, float) for k in ("x", "y")):
                raise ValueError("Invalid position")
        if entity is not None and (not isinstance(entity, dict) or not isinstance(entity.get("namespace"), str)):
            raise ValueError("Invalid entity reference")

    def summary(self):
        return {"operationCount": self.events, "initialObjectCount": self.objects,
                "tileCount": self.tiles, "observedUntilMs": self.elapsed,
                "operationCounts": dict(self.operations), "decodeStatusCounts": dict(self.decodes),
                "framing": "partial" if self.operations["UNKNOWN"] else "complete"}

    def finish(self):
        if self.footer is None:
            raise ValueError("Missing completeness footer")


class EventStreamWriter:
    def __init__(self, stream, *, body_offset=None):
        self.stream = stream
        self.validator = StreamValidator()
        self.digest = hashlib.sha256()
        self.bytes = 0
        self.next_source_offset = body_offset

    def record(self, value):
        self.validator.consume(value)
        raw = json_bytes(value)
        self.bytes += len(raw)
        if len(raw) > MAX_LINE_BYTES or self.bytes > MAX_JSON_BYTES:
            raise ValueError("Event stream exceeds size bounds")
        self.digest.update(raw)
        self.stream.write(raw)

    def write(self, event):
        if event["operationOrdinal"] != self.validator.events:
            raise ValueError("Decoder operation order mismatch")
        if self.next_source_offset is not None:
            if event.get("byteOffset") != self.next_source_offset or not _integer(event.get("byteLength"), 1):
                raise ValueError("Non-contiguous source byte coverage")
            self.next_source_offset += event["byteLength"]
        if event["sourceOperation"] == "SYNC":
            if event["timestampMs"] != self.validator.elapsed + event["payload"]["incrementMs"]:
                raise ValueError("Decoder sync clock mismatch")
            self.record(["sync", event["operationOrdinal"], event["payload"]["incrementMs"],
                         event["decode"]["status"], event["decode"]["parserWarningCodes"]])
        else:
            self.record(["event", event["operationOrdinal"], _row(event)])


def read_records(path: Path, metadata: dict):
    """All consumers must exhaust this iterator before publishing any result."""
    if (metadata.get("format") != "jsonl" or metadata.get("compression") != "gzip" or
            metadata.get("datasetVersion") != VERSION or
            not _integer(metadata.get("bytes"), 1) or metadata["bytes"] > MAX_STORED_BYTES or
            not _integer(metadata.get("uncompressedBytes"), 1) or metadata["uncompressedBytes"] > MAX_JSON_BYTES):
        raise ValueError("Invalid event artifact metadata")
    validator = StreamValidator()
    raw_hash = hashlib.sha256()
    count = 0
    # Hash and decode the same opened file; replacement of its path cannot race.
    with path.open("rb") as file:
        stored_hash, stored_bytes = hashlib.sha256(), 0
        for block in iter(lambda: file.read(1024 * 1024), b""):
            stored_hash.update(block)
            stored_bytes += len(block)
            if stored_bytes > metadata["bytes"]:
                raise ValueError("Stored size mismatch")
        if stored_bytes != metadata["bytes"] or stored_hash.hexdigest() != metadata.get("sha256"):
            raise ValueError("Stored integrity mismatch")
        file.seek(0)
        with gzip.GzipFile(fileobj=file) as stream:
            while True:
                raw = stream.readline(MAX_LINE_BYTES + 1)
                if not raw:
                    break
                count += len(raw)
                if len(raw) > MAX_LINE_BYTES or count > metadata["uncompressedBytes"] or not raw.endswith(b"\n"):
                    raise ValueError("Invalid event line/size bound")
                raw_hash.update(raw)
                record = load_json(raw)
                validator.consume(record)
                yield record
    validator.finish()
    if count != metadata["uncompressedBytes"] or raw_hash.hexdigest() != metadata.get("uncompressedSha256"):
        raise ValueError("Uncompressed integrity mismatch")


def extract_recorded_events(source: Path, destination: Path) -> dict:
    """Verified local artifact, create-only. Caller owns remote publication."""
    # Decoder imports are confined to extraction; projection works without mgz.
    import parse_replay as parser
    from canonical_run import compatibility, version_bundle
    if destination.exists():
        raise FileExistsError(destination)
    parser.preflight_source(source)
    source_hash = sha256(source)
    source_size = source.stat().st_size
    with source.open("rb") as handle:
        header = parser.parse_header(handle)
        parser.meta(parser.ExactReader(handle, source_size))
        offset = handle.tell()
    players = parser.extract_players(header, [])
    versions = version_bundle()
    root = Path(__file__).parent
    extractor_hash = code_digest([(name, root / name) for name in (
        "recorded_events_stream.py", "recorded_events.py", "parse_replay.py", "canonical_stream.py",
        "header_compat.py", "match_facts.py", "canonical_io.py", "canonical_run.py", "compatibility.json",
        "schemas/recorded-events-stream-v1.schema.json")])
    revision = str(uuid.uuid5(uuid.NAMESPACE_URL, ":".join((VERSION, RETENTION, source_hash, extractor_hash, versions["decoderCodeSha256"]))))
    empty = {"recordCount": 0, "chunks": []}
    # Reuse existing context normalization, with no canonical archive generation.
    normalized = parser.build_canonical_manifest(path=source, header=header, players=players, body={},
        terrain_store=empty, object_store=empty, fact_store=empty, source_hash=source_hash,
        parsed_at="", structured_warnings=[])
    context = {k: normalized[k] for k in ("participants", "teams", "initialDiplomacy", "match", "initialState")}
    context["source"] = {"gameBuild": normalized["source"]["gameBuild"]}
    context["schemaVersion"] = normalized["schemaVersion"]
    context["initialState"].pop("objectStore")
    context["initialState"]["map"].pop("terrainStore")
    context["match"].pop("durationMs")
    context["match"]["privacy"] = {"containsPlayerNames": True, "chatContentRetained": False, "retentionPolicyId": RETENTION}
    h = {"datasetVersion": VERSION, "schemaVersion": "1.0.0", "retentionVersion": RETENTION,
         "layer": "decoded_observations", "source": {"sha256": source_hash, "bytes": source_size},
         "extraction": {"revision": revision, "extractorCodeSha256": extractor_hash,
                        "parserVersion": f"mgz-fast/{versions['decoderVersion']}",
                        "decoderCodeSha256": versions["decoderCodeSha256"],
                        "normalizerVersion": parser.NORMALIZER_VERSION},
         "context": context, "recordingHeader": clean_decoded(parser.json_safe(compact_header(header), retain_binary=False)),
         "initialPlayerObservations": [{"playerId": p["replaySlot"], "playerTypeRaw": p["type"],
             "position": parser.position(p["position"]["x"], p["position"]["y"])} for p in players],
         "qualification": {"compatibility": compatibility(header),
             "initialObjects": "partial_parser_object_search", "initialPlayerResources": "unavailable_parser_skips_values",
             "gameElapsedOriginQualified": False, "semanticCompleteness": "not_established",
             "chatContent": "not_retained", "rawBytes": "not_retained"},
         "eventColumns": EVENT_COLUMNS, "objectColumns": OBJECT_COLUMNS}
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".events-stage-", dir=destination.parent) as temporary:
        staged = Path(temporary) / "events.jsonl.gz"
        with staged.open("wb") as file, gzip.GzipFile(fileobj=file, mode="wb", filename="", mtime=0, compresslevel=6) as stream:
            writer = EventStreamWriter(stream, body_offset=offset)
            writer.record(["header", h])
            for player in header.get("players", []):
                for obj in player.get("objects", []):
                    pos = obj.get("position") or {}
                    row = [parser.integer(player.get("number")), parser.integer(obj.get("object_id")),
                           parser.integer(obj.get("class_id")), parser.integer(obj.get("instance_id")),
                           parser.integer(obj.get("index")), parser.position(pos.get("x"), pos.get("y")),
                           parser.entity_ref("aoe2de.object", obj.get("object_id"))]
                    writer.record(["object", writer.validator.objects, row])
            for index, tile in enumerate(header["map"]["tiles"]):
                writer.record(["tile", index, parser.integer(tile[0]), parser.integer(tile[1])])
            del header, normalized
            parser.parse_body(source, players, [], writer, [], body_offset=offset,
                pov_player_id=parser.integer(h["recordingHeader"]["metadata"].get("owner_id")),
                retain_raw=False, collect_summary=False)
            if writer.next_source_offset != source_size:
                raise ValueError("Decoder did not account for the complete source body")
            writer.record(["end", writer.validator.summary()])
        if sha256(source) != source_hash or source.stat().st_size != source_size:
            raise ValueError("Recording changed during extraction")
        metadata = {"datasetVersion": VERSION, "format": "jsonl", "compression": "gzip",
                    "sha256": sha256(staged), "bytes": staged.stat().st_size,
                    "uncompressedSha256": writer.digest.hexdigest(), "uncompressedBytes": writer.bytes}
        for _ in read_records(staged, metadata):
            pass
        # Same-filesystem atomic create-only publication. Linking a fully verified
        # file exposes neither a partial copy nor an overwrite race.
        os.link(staged, destination)
    return metadata


def _coverage(header, body):
    qualified = header["qualification"]["compatibility"]["status"] == "fixture_regression_only"
    status = "available" if qualified else "unsupported_version"
    return {"coverageVersion": "AOF_RECORDED_EVENTS_COVERAGE_V1",
            "framing": {"status": "complete" if body["bodyParseComplete"] else "partial",
                        "operationCounts": body["operationCounts"], "unknownActionCounts": body["unknownActionCounts"]},
            "decoding": {"status": "partial", "decodeStatusCounts": body["decodeStatusCounts"],
                         "recognizedActionPercent": body["decodeCoveragePercent"], "byteAccounting": "raw_bytes_not_retained"},
            "clock": {"basis": "sum_of_observed_sync_increments", "observedUntilMs": body["durationMs"],
                      "restoreTimeRaw": header["recordingHeader"]["map"].get("restore_time"), "gameElapsedOriginQualified": False},
            "participants": [p["playerId"] for p in header["context"]["participants"]],
            "capabilities": {**{k: {"status": status, "scope": "decoded_commands_only", "completion": "not_observable"}
                                for k in ("queueRequests", "researchRequests", "buildingPlacements")},
                "directedDiplomacyCommands": {"status": status, "scope": "encoded_actor_target_and_mode_only", "effectiveStance": "insufficient_evidence"},
                **{k: {"status": "insufficient_evidence"} for k in ("observedAgeReached", "initialObjects", "entityNormalization", "fullGameMetricTotals")},
                "matchResult": {"status": "not_observable"}},
            "warnings": [{"code": "PARTIAL_DECODE", "message": "Decoded observations only; unknown bytes require verified reupload for a new extractor."},
                         {"code": "HEADER_SEMANTICS_UNQUALIFIED", "message": "Decoded header candidates and object search remain qualified observations."},
                         {"code": "RELATION_STATE_UNQUALIFIED", "message": "Lobby teams and directed commands do not establish effective mutual alliances."}]}


def load_analysis(path: Path, metadata: dict) -> dict:
    """Single pass: retain model-required actions/objects, not a second dataset."""
    objects, actions, postgame = [], [], []
    header = None
    for record in read_records(path, metadata):
        kind = record[0]
        if kind == "header":
            header = record[1]
            slots = {p["playerId"] for p in header["context"]["participants"]}
            projector = CompactProjector(slots)
        elif kind == "object":
            values = dict(zip(OBJECT_COLUMNS, record[2]))
            objects.append(_compact_initial_object({"eventId": f"initial-object-{record[1]:08d}",
                "operationOrdinal": record[1], "position": values.pop("position"), "entity": values.pop("entity"),
                "objectInstanceIds": [values["instanceId"]] if values["instanceId"] is not None else [], "payload": values}))
        elif kind == "sync":
            # Same state changes as CompactProjector.consume for a SYNC event,
            # without allocating a 17-field transient event for every clock tick.
            projector.operations["SYNC"] += 1
            projector.decodes[record[3]] += 1
            projector.duration += record[2]
        elif kind == "event":
            # Expand only this row; its source ordinal must survive filtering.
            event = next(iter_events({"events": [record[2]]}))
            event.update(eventId=f"op-{record[1]:09d}", operationOrdinal=record[1])
            projector.consume(event)
            if event["sourceOperation"] == "ACTION" and event["actorPlayerId"] in slots:
                actions.append(_compact_action(event))
            elif event["sourceOperation"] == "POSTGAME":
                postgame.append({"sourceEventId": event["eventId"], "timestampMs": event["timestampMs"],
                    "operationOrdinal": event["operationOrdinal"], "decoded": event["payload"].get("decoded"),
                    "decodeStatus": event["decode"]["status"]})
    body = projector.finish()
    manifest = deepcopy(header["context"])
    manifest["match"]["durationMs"] = body["durationMs"]
    source = {"replaySha256": header["source"]["sha256"], "recordedEventsSha256": metadata["sha256"],
              "recordedEventsVersion": VERSION, "extractionRunId": header["extraction"]["revision"],
              "parserVersion": header["extraction"]["parserVersion"]}
    return {"schemaVersion": ANALYSIS_SCHEMA_VERSION, "datasetVersion": ANALYSIS_DATASET_VERSION,
            "source": source, "manifest": manifest,
            "canonicalVersions": {"normalizerVersion": header["extraction"]["normalizerVersion"]},
            "recordingHeader": header["recordingHeader"], "recordingHeaderSource": {"recordedEventsSha256": metadata["sha256"], "section": "header.recordingHeader"},
            "postgameEvents": postgame, "body": body, "fundamentals": fundamentals(body), "initialObjects": objects,
            "actionEvents": actions, "cameraEvents": [],
            # Existing models did not receive elevations. Enabling them is a separately versioned correction.
            "terrainElevation": {"width": manifest["initialState"]["map"]["width"], "height": manifest["initialState"]["map"]["height"], "values": [],
                                 "basis": "initial parser-fact terrain tile elevation in canonical tile order"},
            "coverage": _coverage(header, body)}


def project_recorded_events(path: Path, metadata: dict):
    from statistics_projector import project_statistics_from_analysis
    return project_statistics_from_analysis(load_analysis(path, metadata))


def _json_bound(value, limit):
    """Conservative byte bound, stopping early for large subtrees."""
    if isinstance(value, str):
        return 6 * len(value) + 2
    if value is None or isinstance(value, bool):
        return 5
    if isinstance(value, int):
        return len(str(value))
    if isinstance(value, float):
        return 32
    total = 2
    values = value.items() if isinstance(value, dict) else enumerate(value)
    for key, child in values:
        total += (6 * len(key) + 3 if isinstance(value, dict) else 0) + 1
        total += _json_bound(child, limit - total)
        if total > limit:
            break
    return total


def write_statistics(path: Path, result: dict):
    """Use the fast JSON encoder on bounded subtrees, not a full-size copy.

    Inference output remains unchanged. The buffer is 64 KiB plus the largest
    scalar (source observations already have a 16 MiB per-record bound).
    """
    def chunks(value):
        if not isinstance(value, (dict, list)) or _json_bound(value, 65536) <= 65536:
            yield json_bytes(value)[:-1]
        elif isinstance(value, dict):
            yield b"{"
            for index, key in enumerate(sorted(value)):
                if index:
                    yield b","
                yield json_bytes(key)[:-1] + b":"
                yield from chunks(value[key])
            yield b"}"
        else:
            yield b"["
            for index, child in enumerate(value):
                if index:
                    yield b","
                yield from chunks(child)
            yield b"]"
    with path.open("wb") as file:
        for chunk in chunks(result):
            file.write(chunk)
        file.write(b"\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    inputs = parser.add_mutually_exclusive_group(required=True)
    inputs.add_argument("--replay", type=Path)
    inputs.add_argument("--events", type=Path)
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.replay:
        metadata = extract_recorded_events(args.replay, args.out)
        args.out.with_suffix(args.out.suffix + ".metadata.json").write_bytes(json_bytes(metadata))
    else:
        if not args.metadata:
            parser.error("--metadata required")
        write_statistics(args.out, project_recorded_events(args.events, read_json(args.metadata)))


if __name__ == "__main__":
    main()
