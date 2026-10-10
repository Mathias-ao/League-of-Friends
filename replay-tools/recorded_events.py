"""Experimental Recorded Events V1; no production writer or publication path.

One row per original operation, including clock/unknown markers. Replay-free
compatibility projection rebuilds Analysis V5 in memory; no stored summaries.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import gzip
import hashlib
import io
from pathlib import Path
import re
from typing import Any

from analysis_dataset import (
    _compact_action, _compact_camera, _compact_initial_object,
    ANALYSIS_DATASET_VERSION, ANALYSIS_SCHEMA_VERSION,
)
from canonical_io import checked_path, iter_store, json_bytes, load_json, read_json, validate_bundle
from canonical_projector import CompactProjector
from canonical_run import fundamentals
from match_facts import compact_header

VERSION = "AOF_RECORDED_EVENTS_V1_EXPERIMENTAL"
MAX_JSON_BYTES = 512 * 1024 * 1024
# Row index is the original zero-based operationOrdinal. Stable IDs are derived,
# never re-numbered after filtering; unknown operations therefore retain a row.
EVENT_COLUMNS = [
    "timestampMs", "sourceOperation", "eventType", "sourceActionCode",
    "sourceActionName", "actorPlayerId", "targetPlayerId", "objectInstanceIds",
    "targetInstanceId", "entity", "position", "endPosition", "payload",
    "decodeStatus", "warningCodes", "sequence", "layoutObservations",
]
OBJECT_COLUMNS = ["ownerPlayerId", "objectId", "classId", "instanceId", "objectBlockIndex", "position", "entity"]
LAYOUT_KEYS = {
    "layout", "layoutFieldsStatus", "playerIdRaw", "disconnectedRaw",
    "selectedCountRaw", "buildingTypeIdRaw", "unitIdRaw", "amountRaw",
    "primaryObjectIdRaw", "technologyIdRaw", "selectedBuildingIdsRaw",
    "sourcePlayerRaw", "targetPlayerRaw", "modeFloatRaw", "modeRaw",
}
OPERATION_TYPES = {"ACTION", "SYNC", "VIEWLOCK", "CHAT", "POSTGAME", "START", "SAVE", "UNKNOWN"}


def clean_decoded(value: Any) -> Any:
    """Never copy binary escape hatches, byte dumps, or parser failure prose."""
    if isinstance(value, dict):
        return {k: clean_decoded(v) for k, v in value.items()
                if "base64" not in k.lower() and not k.startswith("_raw") and k != "failure"}
    if isinstance(value, list):
        return [clean_decoded(v) for v in value]
    return value


def _row(event: dict) -> list:
    payload = clean_decoded(event.get("payload") or {})
    operation = event["sourceOperation"]
    if operation == "SYNC":
        payload = {"incrementMs": payload.get("incrementMs")}
    elif operation == "CHAT":
        # Retain message metadata, not private conversation text. System/age
        # message extraction remains unavailable pending an authentic decoder.
        chat = payload.get("structuredChat")
        payload = {"structuredChat": {k: chat[k] for k in ("player", "channel", "tauntNumber") if k in chat}} if isinstance(chat, dict) else {}
    layout = (event.get("payload") or {}).get("_rawLayout") or {}
    values = {**event, "payload": payload,
              "decodeStatus": event["decode"]["status"],
              "warningCodes": event["decode"].get("parserWarningCodes", []),
              "sequence": (event.get("clock") or {}).get("sequence"),
              "layoutObservations": {k: v for k, v in layout.items() if k in LAYOUT_KEYS}}
    return [values.get(k) for k in EVENT_COLUMNS]


def iter_events(dataset: dict):
    for ordinal, row in enumerate(dataset["events"]):
        event = dict(zip(EVENT_COLUMNS, row))
        event.update(eventId=f"op-{ordinal:09d}", operationOrdinal=ordinal, layer="parser_fact")
        event["decode"] = {"status": event.pop("decodeStatus"), "parserWarningCodes": event.pop("warningCodes")}
        event["clock"] = {"sequence": event.pop("sequence")}
        event["payload"] = deepcopy(event["payload"])
        # Compatibility only: these are decoded scalar observations, not bytes.
        event["payload"]["_rawLayout"] = event.pop("layoutObservations")
        yield event


def build_recorded_events(directory: Path, *, validate: bool = True) -> dict:
    if validate:
        validate_bundle(directory)
    manifest = read_json(directory / "canonical-replay.json")
    run = read_json(directory / "extraction-manifest.json")
    if run.get("state") not in {"verified_local", "sealed_local_fast"}:
        raise ValueError("Recorded Events require a sealed extraction")
    header_ref = (run.get("headerEvidence") or {}).get("decodedHeader")
    header = {}
    if header_ref:
        with gzip.open(checked_path(directory, header_ref), "rb") as stream:
            header = compact_header(load_json(stream.read()))
    initial = manifest["initialState"]
    map_data = initial["map"]
    context = {
        "schemaVersion": manifest["schemaVersion"],
        "source": {"gameBuild": manifest["source"].get("gameBuild")},
        "participants": manifest["participants"], "teams": manifest.get("teams", []),
        "initialDiplomacy": manifest.get("initialDiplomacy", []), "match": manifest["match"],
        "initialState": {"map": {k: map_data.get(k) for k in
            ("mapId", "mapName", "rmsFileName", "rmsModId", "seed", "width", "height", "coordinateSystem")},
            "startAnchors": initial.get("startAnchors", [])},
    }
    events = []
    for ordinal, event in enumerate(iter_store(directory, manifest["factStore"])):
        if event["operationOrdinal"] != ordinal or event["eventId"] != f"op-{ordinal:09d}":
            raise ValueError("Non-contiguous source operation chronology")
        events.append(_row(event))
    objects = []
    for ordinal, event in enumerate(iter_store(directory, initial["objectStore"])):
        if event["eventId"] != f"initial-object-{ordinal:08d}" or event["operationOrdinal"] != ordinal:
            raise ValueError("Non-contiguous initial object chronology")
        values = {**event["payload"], "position": event["position"], "entity": event["entity"]}
        objects.append([values.get(k) for k in OBJECT_COLUMNS])
    terrain = [[e["payload"].get("terrainRaw"), e["payload"].get("elevation")]
               for e in iter_store(directory, map_data["terrainStore"])]
    coverage = read_json(directory / "coverage-report.json")
    result = {
        "schemaVersion": "1.0.0", "datasetVersion": VERSION, "layer": "decoded_observations",
        "source": {"sha256": manifest["source"]["sha256"], "bytes": manifest["source"]["byteLength"]},
        "extraction": {"revision": run["extractionRunId"], "parserVersion": manifest["versions"]["parserVersion"],
                       "retentionVersion": VERSION, "canonicalRunState": run["state"],
                       "converterSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                       "upstreamVersions": run["versions"]},
        "context": context, "recordingHeader": clean_decoded(header),
        "eventColumns": EVENT_COLUMNS, "events": events,
        "objectColumns": OBJECT_COLUMNS, "initialObjects": objects,
        "terrain": {"width": map_data["width"], "height": map_data["height"],
                    "columns": ["terrainRaw", "elevation"], "tiles": terrain},
        "completeness": {"operationCount": len(events), "initialObjectCount": len(objects),
                         "framing": coverage["framing"]["status"],
                         "observedUntilMs": coverage["clock"]["observedUntilMs"],
                         "restoreTimeRaw": coverage["clock"].get("restoreTimeRaw"),
                         "initialObjects": "partial_parser_object_search",
                         "initialPlayerResources": "unavailable_parser_skips_values",
                         "chatContent": "not_retained", "rawBytes": "not_retained",
                         "semanticCompleteness": "not_established"},
        # This small legacy provenance envelope preserves existing output exactly.
        # It is not a promise these historical files or raw bytes remain retained.
        "legacyCompatibility": {
            "canonicalManifestSha256": run["canonicalManifest"]["sha256"],
            "canonicalSchemaVersion": manifest["schemaVersion"],
            "canonicalVersions": manifest["versions"],
            "recordingHeaderSource": header_ref, "coverage": coverage,
            "terrainElevationAvailable": isinstance(initial.get("terrainStore"), dict),
        },
    }
    validate_recorded_events(result)
    return result


def validate_recorded_events(dataset: dict) -> None:
    if dataset.get("schemaVersion") != "1.0.0" or dataset.get("datasetVersion") != VERSION:
        raise ValueError("Unsupported Recorded Events schema/version")
    if not re.fullmatch(r"[0-9a-f]{64}", dataset.get("source", {}).get("sha256", "")):
        raise ValueError("Missing source SHA-256")
    if type(dataset["source"].get("bytes")) is not int or dataset["source"]["bytes"] <= 0:
        raise ValueError("Invalid source size")
    if dataset.get("layer") != "decoded_observations" or dataset["extraction"].get("retentionVersion") != VERSION:
        raise ValueError("Invalid observation layer/retention version")
    if dataset.get("eventColumns") != EVENT_COLUMNS or dataset.get("objectColumns") != OBJECT_COLUMNS:
        raise ValueError("Unsupported row columns")
    context = dataset["context"]
    slots = [p["playerId"] for p in context["participants"]]
    if len(slots) != len(set(slots)) or any(type(p) is not int or p <= 0 for p in slots):
        raise ValueError("Invalid player identities")
    elapsed = 0
    for row in dataset["events"]:
        if not isinstance(row, list) or len(row) != len(EVENT_COLUMNS):
            raise ValueError("Invalid event row width")
        at, op = row[:2]
        if type(at) is not int or at < 0 or op not in OPERATION_TYPES:
            raise ValueError("Invalid event clock/operation")
        if not isinstance(row[12], dict) or not isinstance(row[16], dict):
            raise ValueError("Invalid decoded observation payload")
        if row[13] not in {"complete", "partial", "failed", "unknown_action"}:
            raise ValueError("Invalid decode status")
        if not isinstance(row[14], list) or any(not isinstance(code, str) for code in row[14]):
            raise ValueError("Invalid decode warning codes")
        if not isinstance(row[7], list) or any(type(ref) is not int for ref in row[7]):
            raise ValueError("Invalid selected object references")
        for field in (3, 5, 6, 8, 15):
            if row[field] is not None and type(row[field]) is not int:
                raise ValueError("Invalid decoded identifier/sequence")
        if op == "SYNC":
            increment = row[12].get("incrementMs")
            if type(increment) is not int or increment < 0:
                raise ValueError("Invalid sync increment")
            elapsed += increment
        if at != elapsed:
            raise ValueError("Chronology disagrees with exact sync increments")
    terrain = dataset["terrain"]
    width, height = terrain["width"], terrain["height"]
    if type(width) is not int or type(height) is not int or min(width, height) <= 0:
        raise ValueError("Invalid map dimensions")
    if len(terrain["tiles"]) != width * height or any(len(tile) != 2 for tile in terrain["tiles"]):
        raise ValueError("Incomplete terrain")
    if any(len(row) != len(OBJECT_COLUMNS) for row in dataset["initialObjects"]):
        raise ValueError("Invalid initial object row")
    coverage = dataset["completeness"]
    if (len(dataset["events"]) != coverage["operationCount"] or
            len(dataset["initialObjects"]) != coverage["initialObjectCount"] or
            elapsed != coverage["observedUntilMs"]):
        raise ValueError("Completeness counts/clock mismatch")
    if (coverage["framing"] == "complete") != all(row[1] != "UNKNOWN" for row in dataset["events"]):
        raise ValueError("Framing completeness mismatch")
    # Also rejects NaN; a binary key anywhere is a retention-policy violation.
    def inspect(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if "base64" in key.lower() or key.startswith("_raw"):
                    raise ValueError("Raw bytes are forbidden in Recorded Events")
                inspect(child)
        elif isinstance(value, list):
            for child in value:
                inspect(child)
    inspect(dataset)
    json_bytes(dataset)


def to_analysis(dataset: dict) -> dict:
    """Legacy adapter: reconstructed command tables exist only during projection."""
    validate_recorded_events(dataset)
    legacy, extraction = dataset["legacyCompatibility"], dataset["extraction"]
    manifest = deepcopy(dataset["context"])
    slots = {p["playerId"] for p in manifest["participants"]}
    projector = CompactProjector(slots)
    actions, cameras, postgame = [], [], []
    for event in iter_events(dataset):
        projector.consume(event)
        if event["sourceOperation"] == "ACTION" and event["actorPlayerId"] in slots:
            actions.append(_compact_action(event))
        elif event["sourceOperation"] == "VIEWLOCK":
            cameras.append(_compact_camera(event))
        elif event["sourceOperation"] == "POSTGAME":
            postgame.append({"sourceEventId": event["eventId"], "timestampMs": event["timestampMs"],
                            "operationOrdinal": event["operationOrdinal"], "decoded": event["payload"].get("decoded"),
                            "decodeStatus": event["decode"]["status"]})
    objects = []
    for ordinal, row in enumerate(dataset["initialObjects"]):
        values = dict(zip(OBJECT_COLUMNS, row))
        objects.append(_compact_initial_object({
            "eventId": f"initial-object-{ordinal:08d}", "operationOrdinal": ordinal,
            "position": values.pop("position"), "entity": values.pop("entity"),
            "objectInstanceIds": [values["instanceId"]] if values["instanceId"] is not None else [],
            "payload": values,
        }))
    body = projector.finish()
    terrain = dataset["terrain"]
    return {
        "schemaVersion": ANALYSIS_SCHEMA_VERSION, "datasetVersion": ANALYSIS_DATASET_VERSION,
        "source": {"replaySha256": dataset["source"]["sha256"],
                   "canonicalManifestSha256": legacy["canonicalManifestSha256"],
                   "extractionRunId": extraction["revision"],
                   "canonicalSchemaVersion": legacy["canonicalSchemaVersion"],
                   "parserVersion": extraction["parserVersion"], "canonicalRunState": extraction["canonicalRunState"]},
        "manifest": manifest, "canonicalVersions": legacy["canonicalVersions"],
        "recordingHeader": dataset["recordingHeader"], "recordingHeaderSource": legacy["recordingHeaderSource"],
        "postgameEvents": postgame, "body": body, "fundamentals": fundamentals(body),
        "initialObjects": objects, "actionEvents": actions, "cameraEvents": cameras,
        "terrainElevation": {"width": terrain["width"], "height": terrain["height"],
                             "values": [tile[1] for tile in terrain["tiles"]] if legacy["terrainElevationAvailable"] else []},
        "coverage": legacy["coverage"],
    }


def encode_dataset(dataset: dict) -> tuple[bytes, dict]:
    validate_recorded_events(dataset)
    raw = json_bytes(dataset)
    if len(raw) > MAX_JSON_BYTES:
        raise ValueError("Recorded Events JSON exceeds size bound")
    stored = gzip.compress(raw, compresslevel=6, mtime=0)
    return stored, {"format": "json", "compression": "gzip", "bytes": len(stored),
                    "sha256": hashlib.sha256(stored).hexdigest(), "uncompressedBytes": len(raw),
                    "uncompressedSha256": hashlib.sha256(raw).hexdigest()}


def decode_dataset(stored: bytes, metadata: dict) -> dict:
    size = metadata.get("uncompressedBytes")
    if (metadata.get("format") != "json" or metadata.get("compression") != "gzip" or
            type(size) is not int or not 0 < size <= MAX_JSON_BYTES or
            metadata.get("bytes") != len(stored) or
            metadata.get("sha256") != hashlib.sha256(stored).hexdigest()):
        raise ValueError("Recorded Events stored integrity/metadata mismatch")
    with gzip.GzipFile(fileobj=io.BytesIO(stored)) as stream:
        raw = stream.read(size + 1)
    if len(raw) != size or hashlib.sha256(raw).hexdigest() != metadata.get("uncompressedSha256"):
        raise ValueError("Recorded Events uncompressed integrity mismatch")
    result = load_json(raw)
    validate_recorded_events(result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--bundle", type=Path)
    source.add_argument("--dataset", type=Path)
    parser.add_argument("--metadata", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--already-sealed", action="store_true")
    args = parser.parse_args()
    if args.bundle:
        value = build_recorded_events(args.bundle, validate=not args.already_sealed)
        data, metadata = encode_dataset(value)
        args.out.write_bytes(data)
        args.out.with_suffix(args.out.suffix + ".metadata.json").write_bytes(json_bytes(metadata))
    else:
        if not args.metadata:
            parser.error("--metadata is required with --dataset")
        value = decode_dataset(args.dataset.read_bytes(), read_json(args.metadata))
        from statistics_projector import project_statistics_from_analysis
        args.out.write_bytes(json_bytes(project_statistics_from_analysis(to_analysis(value))))


if __name__ == "__main__":
    main()
