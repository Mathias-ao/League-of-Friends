"""Replay-free statistics evidence projected from a verified canonical bundle."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
from statistics import median
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

from analysis_dataset import build_analysis_dataset, validate_analysis_dataset
from build_order_classifier import classify_build_orders
from economy_statistics import project_economy_statistics
from canonical_io import ROOT, json_bytes, read_json, sha256
from forward_eco import project_forward_eco
from map_presence_v2 import project_map_presence
from military_statistics import project_military_statistics
from opening_statistics import project_opening_statistics
from raid_detector import detect_raids
from resource_commitment import project_resource_commitment
from statistics_registry import build_registry

PROJECTION_VERSION = "AOF_CANONICAL_STATISTICS_V1"
FORMULA_VERSION = "AOF_OBSERVED_COMMAND_FORMULAS_V1"
STATISTICS_SCHEMA_VERSION = "1.0.0"
STATISTICS_SCHEMA = ROOT / "schemas" / "canonical-statistics-v1.schema.json"
ENTITY_CATALOG = ROOT / "entity-catalog" / "aoe2techtree-b9d494df6921.json"


def _entity(catalog: dict, kind: str, raw_id: Any) -> dict:
    if isinstance(raw_id, str) and raw_id.lstrip("-").isdigit():
        raw_id = int(raw_id)
    result = {"rawId": raw_id, "kind": kind, "catalogVersion": catalog["schemaVersion"],
              "catalogSourceVersion": catalog["sourceVersion"]}
    item = catalog[{"unit": "units", "building": "buildings", "technology": "technologies"}[kind]].get(str(raw_id))
    if item is None:
        return {**result, "resolutionStatus": "unresolved", "name": None, "roleKeys": []}
    return {**result, "resolutionStatus": "reference_catalog_unqualified_for_replay_patch",
            "name": item["name"], "roleKeys": item.get("roleKeys", [])}


def _inventory(counts: dict[str, Counter], catalog: dict, kind: str) -> dict[str, list[dict]]:
    return {player: [{"entity": _entity(catalog, kind, raw_id), "commandCount": count}
                     for raw_id, count in sorted(values.items(), key=lambda item: int(item[0]))]
            for player, values in sorted(counts.items(), key=lambda item: int(item[0]))}


def project_statistics_from_analysis(
    analysis: dict[str, Any], *, catalog_path: Path = ENTITY_CATALOG,
) -> dict:
    """Project statistics from compact analysis data without reopening CanonicalReplay."""
    validate_analysis_dataset(analysis)
    manifest = analysis["manifest"]
    registry = build_registry()
    catalog = read_json(catalog_path)
    slots = {p["playerId"] for p in manifest["participants"]}

    action_counts: dict[str, Counter] = defaultdict(Counter)
    action_times: dict[str, list[int]] = defaultdict(list)
    selection_sizes: dict[str, list[int]] = defaultdict(list)
    formation_modes: dict[str, set[str]] = defaultdict(set)
    spatial_action_events: list[dict[str, Any]] = []
    for event in analysis["actionEvents"]:
        if event.get("actorPlayerId") not in slots:
            continue
        spatial_action_events.append(event)
        player = str(event["actorPlayerId"])
        name = event.get("sourceActionName") or "ERROR"
        action_counts[player][name] += 1
        action_times[player].append(event["timestampMs"])
        selection_sizes[player].append(len(event.get("objectInstanceIds", [])))
        if name == "FORMATION":
            payload = event.get("payload", {})
            for key in ("formation_id", "formation", "mode"):
                if payload.get(key) is not None:
                    formation_modes[player].add(str(payload[key]))
                    break

    body = analysis["body"]
    fundamentals = analysis["fundamentals"]
    initial_objects = analysis["initialObjects"]
    build_orders = classify_build_orders(
        manifest=manifest, body=body, catalog=catalog, initial_objects=initial_objects,
    )
    raid_statistics = detect_raids(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=body["buildEvents"],
        action_events=spatial_action_events,
    )
    opening_statistics = project_opening_statistics(
        manifest=manifest,
        body=body,
        catalog=catalog,
        observed_until_ms=body["durationMs"],
        initial_objects=initial_objects,
    )
    resource_commitment_statistics = project_resource_commitment(
        manifest=manifest,
        body=body,
        catalog=catalog,
    )
    economy_statistics = project_economy_statistics(
        manifest=manifest,
        body=body,
        catalog=catalog,
        initial_objects=initial_objects,
        action_events=analysis["actionEvents"],
    )
    military_statistics = project_military_statistics(
        manifest=manifest,
        body=body,
        catalog=catalog,
    )
    map_presence_statistics = project_map_presence(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=body["buildEvents"],
        action_events=spatial_action_events,
    )
    forward_eco_statistics = project_forward_eco(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=body["buildEvents"],
    )
    for player, forward_eco in forward_eco_statistics.items():
        map_presence_statistics[player]["forwardEco"] = forward_eco

    participants = []
    for participant in manifest["participants"]:
        player = str(participant["playerId"])
        times = action_times[player]
        counts = action_counts[player]
        sizes = selection_sizes[player]
        observed_minutes = body["durationMs"] / 60000 if body["durationMs"] else None
        participants.append({
            "playerId": participant["playerId"],
            "replaySlot": participant["number"],
            "isRecorder": participant["isRecorder"],
            "displayName": participant["name"],
            "buildOrder": build_orders[player],
            "opening": opening_statistics[player],
            "economy": {
                **economy_statistics[player],
                "resourceCommitment": resource_commitment_statistics[player],
            },
            "military": military_statistics[player],
            "combat": raid_statistics[player],
            "mapPresence": map_presence_statistics[player],
            "observedCommands": {
                "count": sum(counts.values()), "byRawActionName": dict(sorted(counts.items())),
                "firstAtMs": min(times) if times else None, "lastAtMs": max(times) if times else None,
                "firstFiveObservedMinutesCount": sum(t < 300000 for t in times),
                "activeSecondCount": len({t // 1000 for t in times}),
                "ratePerObservedMinute": round(sum(counts.values()) / observed_minutes, 6) if observed_minutes else None,
                "formulaVersion": FORMULA_VERSION,
                "scope": "decoded player ACTION operations over observed sync-clock interval",
            },
            "selectionEvidence": {
                "sampleCount": len(sizes), "averageSelectedObjectCount": round(sum(sizes) / len(sizes), 6) if sizes else None,
                "medianSelectedObjectCount": median(sizes) if sizes else None,
                "maximumSelectedObjectCount": max(sizes) if sizes else None,
                "rawFormationModes": sorted(formation_modes[player]),
            },
        })

    queue_counts = {p: Counter(v) for p, v in fundamentals["queueCommandCountsByPlayerAndRawUnit"].items()}
    research_counts = {p: Counter(v) for p, v in fundamentals["researchCommandCountsByPlayerAndRawTechnology"].items()}
    building_counts = {p: Counter(v) for p, v in fundamentals["buildingPlacementCountsByPlayerAndRawBuilding"].items()}
    available = [m["metricId"] for m in registry["metrics"] if m["eligibility"] == "available_canonical"]
    warnings = list(analysis["coverage"].get("warnings", [])) + [
        {"code": "OBSERVED_INTERVAL_ONLY", "message": "Totals cover the decoded recorded interval; full-game origin/completeness is not asserted."},
        {"code": "REQUESTS_NOT_OUTCOMES", "message": "Queue, research and building values are requests or placement commands, not trained units, accepted research, or completed buildings."},
        {"code": "ENTITY_LABELS_UNQUALIFIED", "message": "Raw IDs are authoritative. Catalog names and role keys are reference labels not qualified against this replay patch or data mods."},
        {"code": "RECORDER_CAMERA_ONLY", "message": "Camera points represent the recording perspective and are not a comparable all-player statistic."},
        {"code": "RAIDS_ARE_INFERRED", "message": "Raid counts are inferred hostile-command episodes inside reconstructed economic zones; they do not imply damage or kills."},
        {"code": "MAP_PRESENCE_IS_INFERRED", "message": "Map Presence values are spatial proxies over commands, initial objects and building placements; command coverage is not fog-of-war exploration and gold control is not resource gathering."},
        {"code": "RESOURCE_COMMITMENT_IS_ESTIMATED", "message": "Resource commitment uses pinned base catalog costs for decoded requests/placements; it does not simulate civilization discounts, cancellations/refunds, resource availability, market exchange or tribute."},
        {"code": "ECONOMY_OUTCOMES_ARE_RECONSTRUCTED", "message": "Economy separates command observations from reconstructions. Villagers trained is a queue-derived proxy; TC idle/gap metrics infer workload from decoded producer streams; animal counts are targeted-interaction proxies, not kill/gather outcomes."},
        {"code": "MILITARY_PRODUCTION_IS_QUEUE_DERIVED", "message": "Military V1 counts positive decoded military queue amounts and placement commands. It does not assert completed units/buildings, surviving army, kills, deaths or damage."},
    ]
    source = analysis["source"]
    result = {
        "statisticsSchemaVersion": STATISTICS_SCHEMA_VERSION,
        "statisticsSchemaSha256": sha256(STATISTICS_SCHEMA),
        "statisticsProjectionVersion": PROJECTION_VERSION,
        "formulaVersion": FORMULA_VERSION,
        "eligibilityRegistryVersion": registry["registryVersion"],
        "entityCatalogVersion": catalog["schemaVersion"],
        "source": {
            "replaySha256": source["replaySha256"],
            "canonicalManifestSha256": source["canonicalManifestSha256"],
            "extractionRunId": source["extractionRunId"],
            "canonicalSchemaVersion": source["canonicalSchemaVersion"],
            "parserVersion": source["parserVersion"],
        },
        "scope": {"clock": body["durationBasis"], "observedUntilMs": body["durationMs"],
                  "decodeCoveragePercent": body["decodeCoveragePercent"],
                  "decodeCoverageMeaning": body["decodeCoverageMeaning"]},
        "participants": participants,
        "commandEvidence": {
            "queueRequestsByPlayerAndUnit": _inventory(queue_counts, catalog, "unit"),
            "positiveEncodedQueueAmountsByPlayerAndRawUnit": fundamentals["positiveQueueAmountsByPlayerAndRawUnit"],
            "researchRequestsByPlayerAndTechnology": _inventory(research_counts, catalog, "technology"),
            "buildingPlacementsByPlayerAndBuilding": _inventory(building_counts, catalog, "building"),
            "marketCommands": body["marketEvents"], "tributeCommands": body["tributeEvents"],
            "resignCommands": body["resignations"], "flareCommands": body["flareEvents"],
            "directedDiplomacyCommands": fundamentals["directedDiplomacyCommandTimelines"],
            "ageAdvanceRequestCandidates": fundamentals["ageAdvanceRequestCandidates"],
            "ageAdvanceStarted": fundamentals["ageAdvanceStarted"],
            "observedAgeReached": fundamentals["observedAgeReached"],
            "projectedAgeCompletion": fundamentals["projectedAgeCompletion"],
        },
        "recorderCamera": {"pointCount": body["cameraPointsTotal"], "scope": "recording_perspective_only",
                           "recorderPlayerIds": [p["playerId"] for p in manifest["participants"] if p["isRecorder"]]},
        "townBellEligibility": {"metricCount": registry["metricCount"],
                                "counts": registry["eligibilityCounts"],
                                "availableMetricIds": available},
        "coverage": analysis["coverage"],
        "warnings": warnings,
    }
    schema = read_json(STATISTICS_SCHEMA)
    errors = sorted(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(result),
                    key=lambda error: list(error.absolute_path))
    if errors:
        first = errors[0]
        raise ValueError(f"Statistics schema validation failed at /{'/'.join(map(str, first.absolute_path))}: {first.message}")
    return result


def project_statistics(directory: Path, *, validate: bool = True, catalog_path: Path = ENTITY_CATALOG) -> dict:
    """Compatibility entrypoint: canonical bundle -> compact cache -> statistics."""
    analysis = build_analysis_dataset(directory, validate=validate)
    return project_statistics_from_analysis(analysis, catalog_path=catalog_path)

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Project conservative statistics from CanonicalReplay or a compact analysis dataset."
    )
    parser.add_argument("bundle", type=Path, nargs="?")
    parser.add_argument("--analysis", type=Path, help="Compact AOF_REPLAY_ANALYSIS_V1 JSON input.")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--catalog", type=Path, default=ENTITY_CATALOG)
    args = parser.parse_args()
    if bool(args.bundle) == bool(args.analysis):
        parser.error("Provide exactly one canonical bundle or --analysis dataset")
    if args.analysis:
        result = project_statistics_from_analysis(read_json(args.analysis), catalog_path=args.catalog)
    else:
        result = project_statistics(args.bundle, catalog_path=args.catalog)
    if args.out:
        args.out.write_bytes(json_bytes(result))
        print(f"Wrote canonical statistics projection to {args.out}")
    else:
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
