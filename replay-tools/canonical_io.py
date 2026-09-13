"""Deterministic canonical artifacts and strict, replay-free conformance checks.

No decoder dependency: consumers can verify and project a bundle without mgz or
the uploaded recording. Hashes describe stored (compressed) bytes.
"""
from __future__ import annotations

import base64
from collections import Counter
import gzip
import hashlib
import json
import io
import os
from pathlib import Path
from typing import Any, Iterator

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent
SCHEMA_VERSION = "1.1.0"
EXTRACTION_VERSION = "AOF_EXTRACTION_V1"
VALIDATOR_VERSION = "AOF_CONFORMANCE_V1"
MAX_RECORDS = 10_000
MAX_CHUNK_BYTES = 8 * 1024 * 1024


class ConformanceError(ValueError):
    pass


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True,
                       separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def read_json(path: Path) -> Any:
    return load_json(path.read_bytes())


def load_json(content: str | bytes) -> Any:
    def reject(value: str) -> None:
        raise ConformanceError(f"Non-finite JSON number: {value}")
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        out = {}
        for key, value in items:
            if key in out:
                raise ConformanceError(f"Duplicate JSON key: {key}")
            out[key] = value
        return out
    return json.loads(content, parse_constant=reject, object_pairs_hook=pairs)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def artifact_ref(path: Path, encoding: str, **fields: Any) -> dict[str, Any]:
    return {"uri": path.name, "sha256": sha256(path), "byteLength": path.stat().st_size,
            "encoding": encoding, **fields}


def write_gzip(path: Path, content: bytes) -> dict[str, Any]:
    buffer = io.BytesIO()
    with gzip.GzipFile(filename="", fileobj=buffer, mode="wb", mtime=0) as zipped:
        zipped.write(content)
    write_new_bytes(path, buffer.getvalue())
    return artifact_ref(path, "gzip")


def write_new_bytes(path: Path, content: bytes) -> None:
    with path.open("xb") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())


class EventWriter:
    """Bounded gzip JSONL chunks; an oversized single record is kept explicitly.

    Oversized records are never truncated. Their count is exported so a worker
    can impose a separately qualified total input/memory budget.
    """
    def __init__(self, path: Path, max_records: int = MAX_RECORDS,
                 max_bytes: int = MAX_CHUNK_BYTES):
        if max_records < 1 or max_bytes < 1:
            raise ValueError("Chunk limits must be positive")
        self.path, self.max_records, self.max_bytes = path, max_records, max_bytes
        self.chunks: list[dict[str, Any]] = []
        self.record_count = self.oversized_records = 0
        self._raw = self._gzip = None
        self._count = self._bytes = 0
        self._first = self._last = None

    def _open(self) -> None:
        stem = self.path.name.removesuffix(".jsonl.gz")
        self._path = self.path.with_name(f"{stem}-{len(self.chunks):05d}.jsonl.gz")
        # Publish only a finalized compressed chunk, never an open gzip stream.
        # Memory is bounded by the configured chunk size (except explicit
        # oversized records, which are counted and retained without truncation).
        self._raw = io.BytesIO()
        self._gzip = gzip.GzipFile(filename="", fileobj=self._raw, mode="wb", mtime=0)

    def _close_chunk(self) -> None:
        if self._gzip is None:
            return
        self._gzip.close()
        write_new_bytes(self._path, self._raw.getvalue())
        self._raw.close()
        self.chunks.append(artifact_ref(self._path, "jsonl_gzip",
                           contentType="application/x-ndjson", recordCount=self._count,
                           firstOrdinal=self._first, lastOrdinal=self._last))
        self._raw = self._gzip = None
        self._count = self._bytes = 0
        self._first = self._last = None

    def write(self, record: dict[str, Any]) -> None:
        data = json_bytes(record)
        if self._count and (self._count >= self.max_records or self._bytes + len(data) > self.max_bytes):
            self._close_chunk()
        if self._gzip is None:
            self._open()
        self.oversized_records += int(len(data) > self.max_bytes)
        self._gzip.write(data)
        self._first = record["operationOrdinal"] if self._first is None else self._first
        self._last = record["operationOrdinal"]
        self._count += 1
        self._bytes += len(data)
        self.record_count += 1

    def close(self) -> dict[str, Any]:
        self._close_chunk()
        return {"recordCount": self.record_count, "chunks": self.chunks}


def checked_path(directory: Path, ref: dict[str, Any]) -> Path:
    uri = ref.get("uri")
    if not isinstance(uri, str) or not uri or Path(uri).name != uri or "\\" in uri:
        raise ConformanceError("Artifact URI must be a local bundle filename")
    path = directory / uri
    if path.is_symlink() or not path.is_file():
        raise ConformanceError(f"Missing or non-regular artifact: {uri}")
    if path.stat().st_size != ref["byteLength"] or sha256(path) != ref["sha256"]:
        raise ConformanceError(f"Artifact integrity mismatch: {uri}")
    return path


def iter_store(directory: Path, store: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Enumerate every chunk, checking hashes, totals and declared ordinals."""
    if store.get("inlineEvents"):
        raise ConformanceError("This extraction profile requires chunked stores")
    total = 0
    for ref in store["chunks"]:
        path = checked_path(directory, ref)
        if ref["encoding"] != "jsonl_gzip":
            raise ConformanceError("Expected gzip JSONL event chunk")
        count, first, last = 0, None, None
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            for line in handle:
                if not line.endswith("\n") or not line.strip():
                    raise ConformanceError(f"Incomplete/empty JSONL record: {path.name}")
                event = load_json(line)
                first = event.get("operationOrdinal") if first is None else first
                last = event.get("operationOrdinal")
                count += 1
                yield event
        if (count, first, last) != (ref["recordCount"], ref["firstOrdinal"], ref["lastOrdinal"]):
            raise ConformanceError(f"Chunk record/ordinal mismatch: {path.name}")
        total += count
    if total != store["recordCount"]:
        raise ConformanceError("Store record count mismatch")


def schema_validator(definition: str | None = None) -> Draft202012Validator:
    schema = read_json(ROOT / "canonical-replay-v1.schema.json")
    if definition:
        schema = {"$ref": f"#/$defs/{definition}", "$defs": schema["$defs"]}
    return Draft202012Validator(schema, format_checker=FormatChecker())


def validate_schema(value: Any, validator: Draft202012Validator, label: str) -> None:
    error = next(validator.iter_errors(value), None)
    if error:
        location = "/".join(map(str, error.absolute_path))
        raise ConformanceError(f"{label}/{location}: {error.message}")


def raw_bytes(event: dict[str, Any]) -> bytes:
    try:
        return base64.b64decode(event["payload"]["_rawOperationBase64"], validate=True)
    except (KeyError, TypeError, ValueError) as exc:
        raise ConformanceError(f"Missing/invalid raw operation: {event.get('eventId')}") from exc


def validate_bundle(directory: Path, *, verify_run: bool = True) -> dict[str, Any]:
    """Validate schemas AND artifact/stream semantics; never opens a replay.

    A verified bundle is evidence capture, not proof of match completion, complete
    decoding, identity binding, remote persistence or permission to delete input.
    """
    manifest = read_json(directory / "canonical-replay.json")
    validate_schema(manifest, schema_validator(), "manifest")
    if manifest["versions"].get("schemaVersion") != SCHEMA_VERSION:
        raise ConformanceError("Schema version bundle mismatch")
    run = read_json(directory / "extraction-manifest.json")
    run_schema = read_json(ROOT / "extraction-manifest-v1.schema.json")
    validate_schema(run, Draft202012Validator(run_schema, format_checker=FormatChecker()), "run")
    if run["sourceSha256"] != manifest["source"]["sha256"]:
        raise ConformanceError("Run/source identity mismatch")
    if run["versions"]["canonicalSchemaVersion"] != manifest["schemaVersion"]:
        raise ConformanceError("Run/schema version mismatch")
    if run["versions"]["schemaSha256"] != sha256(ROOT / 'canonical-replay-v1.schema.json'):
        raise ConformanceError("Schema changed without a versioned migration")
    if manifest["versions"]["parserVersion"] != run["versions"]["decoderDistribution"] + '/' + run["versions"]["decoderVersion"]:
        raise ConformanceError("Decoder version provenance mismatch")
    if manifest["versions"]["entityDataVersion"] != run["versions"]["entityDataVersion"]:
        raise ConformanceError("Entity-data version provenance mismatch")
    claims = read_json(checked_path(directory, run["fieldClaims"]))
    if claims.get('claimVersion') != 'AOF_FIELD_CLAIMS_V1' or not claims.get('claims'):
        raise ConformanceError("Missing field-level evidence claims")
    if verify_run:
        checked_path(directory, run["canonicalManifest"])
        checked_path(directory, run["coverageReport"])
    header_path = checked_path(directory, run["headerEvidence"]["rawPrefix"])
    checked_path(directory, run["headerEvidence"]["decodedHeader"])
    with gzip.open(header_path, "rb") as handle:
        prefix = handle.read()
    if len(prefix) != run["headerEvidence"]["bodyByteOffset"]:
        raise ConformanceError("Header prefix/body offset mismatch")
    digest = hashlib.sha256(prefix)
    byte_end, elapsed, count = len(prefix), 0, 0
    ids, participants = set(), {p["playerId"] for p in manifest["participants"]}
    if len(participants) != len(manifest["participants"]):
        raise ConformanceError("Duplicate participant identity")
    if {p["number"] for p in manifest["participants"]} != participants:
        raise ConformanceError("Replay-local participant IDs must equal slots in this profile")
    for team in manifest["teams"]:
        if not set(team["memberPlayerIds"]) <= participants:
            raise ConformanceError("Unknown team participant")
    event_validator = schema_validator("eventEnvelope")
    op_counts, action_counts, unknown_counts, decode_counts = Counter(), Counter(), Counter(), Counter()
    for event in iter_store(directory, manifest["factStore"]):
        validate_schema(event, event_validator, event.get("eventId", "event"))
        if event["layer"] != "parser_fact" or event["operationOrdinal"] != count or event["eventId"] != f"op-{count:09d}" or event["eventId"] in ids:
            raise ConformanceError("Fact layer, identity or ordinal invariant failed")
        ids.add(event["eventId"])
        if event["byteOffsetDomain"] != "original_file" or event["byteOffset"] != byte_end:
            raise ConformanceError("Non-contiguous operation byte coverage")
        raw = raw_bytes(event)
        if not raw or len(raw) != event["byteLength"]:
            raise ConformanceError("Operation raw byte length mismatch")
        digest.update(raw)
        byte_end += len(raw)
        codes = {'ACTION': 1, 'SYNC': 2, 'VIEWLOCK': 3, 'CHAT': 4, 'START': 5, 'POSTGAME': 6, 'SAVE': 7}
        if event['sourceOperation'] != 'UNKNOWN' and int.from_bytes(raw[:4], 'little') != codes[event['sourceOperation']]:
            raise ConformanceError('Raw operation opcode mismatch')
        if event['sourceOperation'] == 'UNKNOWN' and event['decode']['status'] != 'failed':
            raise ConformanceError('Unframed operation must declare failed decode')
        if event["sourceOperation"] == "SYNC":
            increment = event["payload"].get("incrementMs")
            if type(increment) is not int or increment < 0:
                raise ConformanceError("Invalid synchronization increment")
            elapsed += increment
        if event["timestampMs"] != elapsed or event["clock"]["syncElapsedMs"] != elapsed:
            raise ConformanceError("Timestamp differs from retained synchronization clock")
        decode_counts[event["decode"]["status"]] += 1
        op_counts[event["sourceOperation"]] += 1
        if event["decode"]["status"] != "complete":
            retained = event["decode"].get("unknownBytesBase64")
            if retained is None or base64.b64decode(retained, validate=True) != raw:
                raise ConformanceError("Partial/unknown operation evidence not retained")
        if event["sourceOperation"] == "ACTION":
            action_counts[event["sourceActionName"] or "ERROR"] += 1
            if event["decode"]["status"] == "unknown_action":
                unknown_counts[str(event["sourceActionCode"])] += 1
            if len(raw) < 9 or raw[8] != event["sourceActionCode"]:
                raise ConformanceError("Raw action opcode mismatch")
        count += 1
    if byte_end != manifest["source"]["byteLength"] or digest.hexdigest() != manifest["source"]["sha256"]:
        raise ConformanceError("Retained source evidence does not reproduce source SHA-256/length")
    if elapsed != manifest["match"]["durationMs"]:
        raise ConformanceError("Duration differs from observable clock")
    for key, actual in (("operationCounts", op_counts), ("actionCounts", action_counts), ("unknownActionCounts", unknown_counts)):
        if dict(actual) != manifest["factStore"].get(key, {}):
            raise ConformanceError(f"{key} reconciliation failed")
    initial = manifest["initialState"]
    object_ids: dict[int, set[int]] = {}
    for label, store in (("terrain", initial["map"]["terrainStore"]), ("objects", initial["objectStore"])):
        seen, ordinal = set(), 0
        for event in iter_store(directory, store):
            validate_schema(event, event_validator, event.get("eventId", label))
            if event["eventId"] in seen or event["operationOrdinal"] != ordinal or event["layer"] != "parser_fact":
                raise ConformanceError(f"Initial {label} identity/ordinal mismatch")
            seen.add(event["eventId"])
            if label == "terrain":
                if event["position"]["x"] != ordinal % initial["map"]["width"] or event["position"]["y"] != ordinal // initial["map"]["width"]:
                    raise ConformanceError("Terrain grid coordinates mismatch")
            else:
                owner = event["payload"]["ownerPlayerId"]
                object_ids.setdefault(owner, set()).update(event["objectInstanceIds"])
            ordinal += 1
        if label == "terrain" and ordinal != initial["map"]["width"] * initial["map"]["height"]:
            raise ConformanceError("Terrain cell count/dimensions mismatch")
    for p in manifest["participants"]:
        if set(p["initialObjectIds"]) != object_ids.get(p["playerId"], set()):
            raise ConformanceError("Participant initial-object references mismatch")
    return {"validatorVersion": VALIDATOR_VERSION, "schemaVersion": SCHEMA_VERSION,
            "sourceSha256": digest.hexdigest(), "retainedByteCount": byte_end,
            "operationCount": count, "decodeStatusCounts": dict(sorted(decode_counts.items())),
            "artifactIntegrity": "verified", "schemaValidation": "passed",
            "sourceDeletionEligible": False, "persistenceVerified": False}


def semantic_diff(left: Any, right: Any, pointer: str = "") -> list[dict[str, Any]]:
    """Exact JSON Pointer changes, including payload/unknown bytes and tied order."""
    # Counter/defaultdict serialize as JSON objects. Their Python subclass is
    # not a semantic change after a snapshot has been read back from JSON.
    both_objects = isinstance(left, dict) and isinstance(right, dict)
    if type(left) is not type(right) and not both_objects:
        return [{"path": pointer or "/", "before": left, "after": right}]
    if isinstance(left, dict):
        changes = []
        for key in sorted(left.keys() | right.keys()):
            path = pointer + "/" + key.replace("~", "~0").replace("/", "~1")
            if key not in left or key not in right:
                changes.append({"path": path, "before": left.get(key), "after": right.get(key),
                                "change": "added" if key not in left else "removed"})
            else:
                changes.extend(semantic_diff(left[key], right[key], path))
        return changes
    if isinstance(left, list) and len(left) == len(right):
        return [change for index, pair in enumerate(zip(left, right))
                for change in semantic_diff(*pair, pointer + f"/{index}")]
    return [] if left == right else [{"path": pointer or "/", "before": left, "after": right}]
