"""Compare two canonical recordings without merging their provenance.

This establishes recorder agreement for a fixture. It does not establish game-
engine command semantics and never selects or synthesizes a canonical source.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from itertools import zip_longest
from pathlib import Path
from typing import Any, Iterable

from canonical_io import iter_store, json_bytes, read_json, semantic_diff, validate_bundle

PAIR_SNAPSHOT_VERSION = "AOF_PAIRED_RECORDING_V1"
RECORDER_LOCAL_OPERATIONS = {"VIEWLOCK", "CHAT"}


def event_signature(event: dict[str, Any]) -> dict[str, Any]:
    """Remove source-local addresses while retaining order, raw bytes and meaning."""
    value = {key: child for key, child in event.items()
             if key not in {"eventId", "operationOrdinal", "byteOffset", "byteLength", "dependsOnEventIds"}}
    evidence = dict(value.get("evidence") or {})
    evidence["sourceEventIds"] = []
    value["evidence"] = evidence
    return value


def digest(records: Iterable[Any]) -> str:
    result = hashlib.sha256()
    for record in records:
        result.update(json_bytes(record))
    return result.hexdigest()


def store_records(directory: Path, manifest: dict[str, Any], path: tuple[str, ...]) -> list[dict[str, Any]]:
    value: Any = manifest
    for key in path:
        value = value[key]
    return list(iter_store(directory, value))


def stream_summary(left: Iterable[dict[str, Any]], right: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Compare without holding a full replay operation stream in memory."""
    left_hash, right_hash = hashlib.sha256(), hashlib.sha256()
    left_count = right_count = 0
    exact = True
    missing = object()
    for left_event, right_event in zip_longest(left, right, fillvalue=missing):
        if left_event is missing:
            exact = False
            right_value = event_signature(right_event)
            right_hash.update(json_bytes(right_value)); right_count += 1
            continue
        if right_event is missing:
            exact = False
            left_value = event_signature(left_event)
            left_hash.update(json_bytes(left_value)); left_count += 1
            continue
        left_value, right_value = event_signature(left_event), event_signature(right_event)
        left_hash.update(json_bytes(left_value)); right_hash.update(json_bytes(right_value))
        left_count += 1; right_count += 1
        exact = exact and left_value == right_value
    return {"leftCount": left_count, "rightCount": right_count, "exactMatch": exact,
            "leftSemanticSha256": left_hash.hexdigest(), "rightSemanticSha256": right_hash.hexdigest()}


def participant_core(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    return [{key: value for key, value in participant.items() if key != "isRecorder"}
            for participant in manifest["participants"]]


def paired_snapshot(left_dir: Path, right_dir: Path, *, validate: bool = True) -> dict[str, Any]:
    if validate:
        validate_bundle(left_dir)
        validate_bundle(right_dir)
    left_manifest = read_json(left_dir / "canonical-replay.json")
    right_manifest = read_json(right_dir / "canonical-replay.json")
    def facts(directory: Path, manifest: dict[str, Any], operation: str | None = None):
        return (event for event in iter_store(directory, manifest["factStore"])
                if (event["sourceOperation"] == operation if operation else
                    event["sourceOperation"] not in RECORDER_LOCAL_OPERATIONS))

    terrain_left = store_records(left_dir, left_manifest, ("initialState", "map", "terrainStore"))
    terrain_right = store_records(right_dir, right_manifest, ("initialState", "map", "terrainStore"))
    objects_left = store_records(left_dir, left_manifest, ("initialState", "objectStore"))
    objects_right = store_records(right_dir, right_manifest, ("initialState", "objectStore"))

    for label, available in (("matching replay GUID", left_manifest["match"]["guid"] == right_manifest["match"]["guid"]),
                             ("matching save/build tuple", (left_manifest["source"]["saveVersion"], left_manifest["source"]["gameBuild"]) ==
                              (right_manifest["source"]["saveVersion"], right_manifest["source"]["gameBuild"])),
                             ("matching participant core", participant_core(left_manifest) == participant_core(right_manifest)),
                             ("different recorder slots", left_manifest["source"]["povPlayerId"] != right_manifest["source"]["povPlayerId"])):
        if not available:
            raise ValueError(f"Recordings are not a qualified pair: {label} failed")

    return {
        "snapshotVersion": PAIR_SNAPSHOT_VERSION,
        "sources": [{"sha256": manifest["source"]["sha256"], "byteLength": manifest["source"]["byteLength"],
                     "povPlayerId": manifest["source"]["povPlayerId"]}
                    for manifest in (left_manifest, right_manifest)],
        "saveVersion": left_manifest["source"]["saveVersion"],
        "gameBuild": left_manifest["source"]["gameBuild"],
        "schemaVersion": left_manifest["schemaVersion"],
        "participantCoreMatches": True,
        "durationMatches": left_manifest["match"]["durationMs"] == right_manifest["match"]["durationMs"],
        "sharedOperations": stream_summary(facts(left_dir, left_manifest), facts(right_dir, right_manifest)),
        "initialTerrain": {"leftCount": len(terrain_left), "rightCount": len(terrain_right),
                           "exactMatch": terrain_left == terrain_right,
                           "leftSemanticSha256": digest(terrain_left), "rightSemanticSha256": digest(terrain_right)},
        "initialObjects": {"leftCount": len(objects_left), "rightCount": len(objects_right),
                           "exactMatch": objects_left == objects_right,
                           "leftSemanticSha256": digest(objects_left), "rightSemanticSha256": digest(objects_right)},
        "recorderLocal": {
            "viewlock": stream_summary(facts(left_dir, left_manifest, "VIEWLOCK"),
                                       facts(right_dir, right_manifest, "VIEWLOCK")),
            "chat": stream_summary(facts(left_dir, left_manifest, "CHAT"),
                                   facts(right_dir, right_manifest, "CHAT")),
        },
        "qualification": {
            "established": "fixture-level recorder agreement for ordered non-camera/non-chat operation evidence",
            "notEstablished": "command acceptance, cancellation, completion, effective diplomacy, result or general version support",
            "selectionPolicy": "none; source bundles remain separate",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("left", type=Path)
    parser.add_argument("right", type=Path)
    parser.add_argument("--compare", type=Path)
    args = parser.parse_args()
    snapshot = paired_snapshot(args.left, args.right)
    if args.compare:
        changes = semantic_diff(read_json(args.compare), snapshot)
        print(json.dumps({"changes": changes}, indent=2))
        if changes:
            raise SystemExit(1)
    else:
        print(json.dumps(snapshot, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
