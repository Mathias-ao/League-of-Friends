"""Versioned eligibility registry for the 320 TownBell capability names.

The matrix is preserved as architectural input. Eligibility is deliberately
stricter than TownBell's demonstrations: a metric name that implies an outcome
is not satisfied by an observed command or request.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

from canonical_io import ROOT, json_bytes

REGISTRY_VERSION = "AOF_STATISTICS_ELIGIBILITY_V1"
MATRIX_PATH = ROOT.parent / "docs" / "replay-foundation" / "townbell-capability-matrix.csv"

AVAILABLE = {
    "actions_total", "first_command_time", "first_five_min_commands", "command_type_breadth",
    "market_transactions", "market_first_use", "market_sells", "market_buys",
    "flares_used", "flares_sent", "avg_selection_size", "max_selection_size", "median_selection_size",
}

INFERRED = {
    "longest_inactivity", "median_action_gap", "apm", "peak_apm_minute", "apm_growth",
    "dark_age_apm", "apm_feudal", "apm_castle", "apm_imperial", "apm_variability",
    "feudal_transition_apm", "long_lulls", "apm_peak_minute", "eapm", "apm_efficiency",
    "move_vs_action_discipline", "actions_in_bursts", "preferred_formation", "shift_queue_share",
    "gather_points_set", "gather_points_to_target", "gather_points_to_resource",
    "primary_gather_point_target", "production_batch_size", "build_order",
}

CONTROLLED_FIXTURE = {
    "feudal_click", "castle_click", "imperial_click", "loom_time", "wheelbarrow_time",
    "hand_cart_time", "horse_collar_time", "double_bit_axe_time", "gold_mining_time",
    "blacksmith_upgrades", "first_blacksmith_upgrade", "unit_line_upgrades", "university_techs",
    "ballistics_time", "bloodlines_time", "thumb_ring_time", "heavy_plow_time",
    "crop_rotation_time", "bow_saw_time", "two_man_saw_time", "gold_shaft_mining_time",
    "stone_mining_time", "guilds_time", "banking_time", "coinage_time", "caravan_time",
    "husbandry_time", "town_watch_time", "forging_time", "fletching_time", "bodkin_arrow_time",
    "university_tech_count", "monastery_techs", "techs_total", "market_volume",
    "tribute_sent_total", "tribute_received_total", "tribute_net", "first_tribute_sent",
    "resign_context", "gg_etiquette", "production_buildings_used", "research_buildings_used",
    "formation_types_used", "chat_messages", "game_pauses",
    "formations_set", "stance_changes", "patrol_commands", "attack_ground_commands",
    "attack_move_commands", "garrison_commands", "ungarrison_commands", "back_to_work_commands",
    "deletions", "delete_commands", "stop_commands", "town_bell_uses", "repair_commands",
}

ENGINE_SIMULATION_PATTERN = re.compile(
    r"(?:_trained$|_built$|_reached$|army_value|military_added|villagers_at_|villager_rate|"
    r"_spend|spend_|idle|tc_utilization|fight|raid|pressure|rebound|upgrade_deficit|"
    r"missing_upgrade|pop_at_|attributed_production|defensive_investment|trash_army_share)"
)


def _metric_id(label: str) -> str:
    match = re.search(r"\[([^\]]+)\]\s*$", label)
    if not match:
        raise ValueError(f"Capability has no stable bracketed id: {label!r}")
    return match.group(1)


def classify(metric_id: str) -> tuple[str, str]:
    if metric_id in AVAILABLE:
        return "available_canonical", "Exact decoded command fact over the observed canonical interval; metric definition must retain that scope."
    if metric_id in INFERRED:
        return "inferred_with_confidence", "Recalculable from canonical facts, but requires a separately versioned formula or heuristic."
    if metric_id in CONTROLLED_FIXTURE:
        return "needs_controlled_fixture", "Relevant evidence is retained, but success, subtype, attribution, or metric semantics are not yet fixture-qualified."
    if ENGINE_SIMULATION_PATTERN.search(metric_id):
        return "needs_engine_simulation", "The name implies completed or effective game state that commands alone do not establish."
    return "needs_parser_research", "Required fields or semantics are not yet qualified by the canonical parser and controlled fixtures."


def build_registry(matrix_path: Path = MATRIX_PATH) -> dict:
    with matrix_path.open(newline="", encoding="utf-8-sig") as source:
        rows = list(csv.DictReader(source))
    if len(rows) != 320:
        raise ValueError(f"Expected 320 matrix rows, found {len(rows)}")
    metrics = []
    seen = set()
    for ordinal, row in enumerate(rows, 1):
        metric_id = _metric_id(row["Capability"])
        if metric_id in seen:
            raise ValueError(f"Duplicate metric id: {metric_id}")
        seen.add(metric_id)
        status, decision = classify(metric_id)
        metrics.append({
            "ordinal": ordinal,
            "metricId": metric_id,
            "capability": row["Capability"].rsplit(" [", 1)[0],
            "eligibility": status,
            "decision": decision,
            "sourceMatrix": row,
        })
    counts = Counter(item["eligibility"] for item in metrics)
    return {
        "registryVersion": REGISTRY_VERSION,
        "sourceMatrix": str(matrix_path.relative_to(ROOT.parent)),
        "metricCount": len(metrics),
        "eligibilityCounts": dict(sorted(counts.items())),
        "policy": {
            "canonicalIsEvidenceSource": True,
            "outcomeNamesRequireOutcomeEvidence": True,
            "queueRequestsAreNotTrainedUnits": True,
            "ageAdvanceRequestsAreNotStartsOrCompletions": True,
            "unknownEvidenceMustRemainAvailable": True,
        },
        "metrics": metrics,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the versioned 320-metric eligibility registry.")
    parser.add_argument("--matrix", type=Path, default=MATRIX_PATH)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    registry = build_registry(args.matrix)
    if args.out:
        args.out.write_bytes(json_bytes(registry))
        print(f"Wrote {registry['metricCount']} metrics to {args.out}")
    else:
        print(json.dumps(registry, indent=2))


if __name__ == "__main__":
    main()
