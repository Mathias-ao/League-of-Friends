"""Compact replay-analysis dataset projected from verified CanonicalReplay evidence.

This is a disposable/rebuildable development and analysis cache. CanonicalReplay
remains the lossless source of truth. Raw operation bytes are intentionally not
copied into this dataset; every retained analytical event keeps its canonical
source event identity.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from canonical_io import iter_store, json_bytes, read_json, validate_bundle
from canonical_projector import CompactProjector
from canonical_run import fundamentals

ANALYSIS_SCHEMA_VERSION = "1.0.0"
ANALYSIS_DATASET_VERSION = "AOF_REPLAY_ANALYSIS_V1"

_RAW_PAYLOAD_KEYS = {
    "_rawOperationBase64",
    "_rawLayout",
    "rawBase64",
}


def _compact_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    return {
        key: value
        for key, value in payload.items()
        if key not in _RAW_PAYLOAD_KEYS and not key.startswith("_raw")
    }


def _compact_action(event: dict[str, Any]) -> dict[str, Any]:
    decode = event.get("decode") or {}
    return {
        "eventId": event.get("eventId"),
        "layer": "parser_fact",
        "eventType": event.get("eventType"),
        "timestampMs": event.get("timestampMs"),
        "operationOrdinal": event.get("operationOrdinal"),
        "sourceActionCode": event.get("sourceActionCode"),
        "sourceActionName": event.get("sourceActionName"),
        "actorPlayerId": event.get("actorPlayerId"),
        "targetPlayerId": event.get("targetPlayerId"),
        "objectInstanceIds": list(event.get("objectInstanceIds") or []),
        "targetInstanceId": event.get("targetInstanceId"),
        "entity": event.get("entity"),
        "position": event.get("position"),
        "endPosition": event.get("endPosition"),
        "payload": _compact_payload(event.get("payload")),
        "decode": {
            "status": decode.get("status"),
            "parserWarningCodes": list(decode.get("parserWarningCodes") or []),
        },
        "canonicalSourceEventId": event.get("eventId"),
    }


def _compact_initial_object(event: dict[str, Any]) -> dict[str, Any]:
    payload = event.get("payload") or {}
    return {
        "eventId": event.get("eventId"),
        "layer": "parser_fact",
        "eventType": "object.initial",
        "operationOrdinal": event.get("operationOrdinal"),
        "position": event.get("position"),
        "objectInstanceIds": list(event.get("objectInstanceIds") or []),
        "entity": event.get("entity"),
        "payload": {
            "ownerPlayerId": payload.get("ownerPlayerId"),
            "objectId": payload.get("objectId"),
            "classId": payload.get("classId"),
            "instanceId": payload.get("instanceId"),
            "objectBlockIndex": payload.get("objectBlockIndex"),
        },
        "canonicalSourceEventId": event.get("eventId"),
    }


def _compact_camera(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "sourceEventId": event.get("eventId"),
        "atMs": event.get("timestampMs"),
        "recorderPlayerId": event.get("actorPlayerId"),
        "position": event.get("position"),
    }


def validate_analysis_dataset(dataset: dict[str, Any]) -> None:
    if dataset.get("schemaVersion") != ANALYSIS_SCHEMA_VERSION:
        raise ValueError(f"Unsupported analysis dataset schema: {dataset.get('schemaVersion')}")
    if dataset.get("datasetVersion") != ANALYSIS_DATASET_VERSION:
        raise ValueError(f"Unsupported analysis dataset version: {dataset.get('datasetVersion')}")
    source = dataset.get("source") or {}
    replay_hash = source.get("replaySha256")
    if not isinstance(replay_hash, str) or len(replay_hash) != 64:
        raise ValueError("Analysis dataset is missing replay SHA-256 provenance")
    manifest = dataset.get("manifest") or {}
    if not isinstance(manifest.get("participants"), list):
        raise ValueError("Analysis dataset is missing participants")
    for key in ("body", "fundamentals", "coverage"):
        if not isinstance(dataset.get(key), dict):
            raise ValueError(f"Analysis dataset is missing {key}")
    if not isinstance(dataset.get("initialObjects"), list):
        raise ValueError("Analysis dataset is missing initialObjects")
    if not isinstance(dataset.get("actionEvents"), list):
        raise ValueError("Analysis dataset is missing actionEvents")
    for event in dataset["actionEvents"]:
        payload = event.get("payload") or {}
        if any(key in payload for key in _RAW_PAYLOAD_KEYS):
            raise ValueError("Analysis dataset must not contain raw operation payload bytes")


def build_analysis_dataset(directory: Path, *, validate: bool = True) -> dict[str, Any]:
    directory = directory.resolve()
    manifest = read_json(directory / "canonical-replay.json")
    run = read_json(directory / "extraction-manifest.json")

    if validate:
        validate_bundle(directory)
    elif run.get("state") not in {"sealed_local_fast", "verified_local"}:
        raise ValueError(
            "Skipping canonical validation is only allowed for a sealed_local_fast or verified_local extraction run"
        )

    slots = {int(player["playerId"]) for player in manifest.get("participants", [])}
    projector = CompactProjector(slots)
    action_events: list[dict[str, Any]] = []
    camera_events: list[dict[str, Any]] = []

    for event in iter_store(directory, manifest["factStore"]):
        projector.consume(event)
        if event.get("sourceOperation") == "ACTION" and event.get("actorPlayerId") in slots:
            action_events.append(_compact_action(event))
        elif event.get("sourceOperation") == "VIEWLOCK":
            camera_events.append(_compact_camera(event))

    body = projector.finish()
    initial_objects = [
        _compact_initial_object(event)
        for event in iter_store(directory, manifest["initialState"]["objectStore"])
    ]
    map_data = (manifest.get("initialState") or {}).get("map") or {}
    manifest_context = {
        "schemaVersion": manifest.get("schemaVersion"),
        "participants": manifest.get("participants") or [],
        "teams": manifest.get("teams") or [],
        "initialDiplomacy": manifest.get("initialDiplomacy") or [],
        "match": manifest.get("match") or {},
        "initialState": {
            "map": {
                key: map_data.get(key)
                for key in (
                    "mapId", "mapName", "rmsFileName", "rmsModId", "seed",
                    "width", "height", "coordinateSystem",
                )
            },
            "startAnchors": (manifest.get("initialState") or {}).get("startAnchors") or [],
        },
    }
    coverage = read_json(directory / "coverage-report.json")

    result = {
        "schemaVersion": ANALYSIS_SCHEMA_VERSION,
        "datasetVersion": ANALYSIS_DATASET_VERSION,
        "layer": "replay_analysis_cache",
        "rebuildPolicy": "derived_from_sealed_canonical_replay",
        "source": {
            "replaySha256": manifest["source"]["sha256"],
            "canonicalManifestSha256": run["canonicalManifest"]["sha256"],
            "extractionRunId": run["extractionRunId"],
            "canonicalSchemaVersion": manifest["schemaVersion"],
            "parserVersion": manifest["versions"]["parserVersion"],
            "canonicalRunState": run["state"],
        },
        "manifest": manifest_context,
        "body": body,
        "fundamentals": fundamentals(body),
        "initialObjects": initial_objects,
        "actionEvents": action_events,
        "cameraEvents": camera_events,
        "coverage": coverage,
        "summary": {
            "initialObjectCount": len(initial_objects),
            "actionEventCount": len(action_events),
            "cameraEventCount": len(camera_events),
            "canonicalOperationCount": manifest["factStore"]["recordCount"],
            "rawOperationBytesCopied": False,
        },
    }
    validate_analysis_dataset(result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build a compact statistics-analysis dataset from CanonicalReplay."
    )
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--already-validated",
        "--already-sealed",
        dest="already_sealed",
        action="store_true",
        help="Skip exhaustive canonical validation when the extraction run is already fast-sealed or fully verified.",
    )
    args = parser.parse_args()
    result = build_analysis_dataset(args.bundle, validate=not args.already_sealed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(json_bytes(result))
    print(
        f"Wrote {ANALYSIS_DATASET_VERSION} to {args.out} "
        f"({result['summary']['actionEventCount']} action events)"
    )


if __name__ == "__main__":
    main()
