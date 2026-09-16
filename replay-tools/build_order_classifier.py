"""Deterministic player-opening classifier over canonical command evidence.

This module deliberately sits above canonical evidence. It treats age-up research
requests, building placements and positive queue requests as direct inputs for the
opening model, per the current player-facing statistics policy, but emits an
inferred statistic with an explicit rule version and auditable candidate evidence.
"""
from __future__ import annotations

from collections import defaultdict
import math
from typing import Any, Iterable

BUILD_ORDER_RULE_VERSION = "AOF_BUILD_ORDER_V1"
QUALIFICATION_SCORE_EXCLUSIVE = 75.0
PRECEDENCE_EXECUTION_WEIGHT = 0.70
PRECEDENCE_DIFFICULTY_WEIGHT = 0.30

# Fast Castle policy supplied for V1. A Castle time above 18:00 can never qualify.
FAST_CASTLE_PERFECT_MS = 14 * 60_000
FAST_CASTLE_75_MS = 17 * 60_000
FAST_CASTLE_HARD_MAX_MS = 18 * 60_000

# A Watch Tower has to be meaningfully inside the opponent's starting economic
# zone. <=8 tiles is treated as direct-pressure quality; 16 tiles is the outer
# zoning boundary. Because qualification is strictly >75, exactly 16 tiles does
# not qualify on proximity alone.
TOWER_DIRECT_PRESSURE_RADIUS_TILES = 8.0
TOWER_ZONING_RADIUS_TILES = 16.0

DIFFICULTY_SCORE = {
    "Tower Rush": 95.0,
    "Drush": 90.0,
    "Naval Rush": 90.0,
    "Fast Castle": 85.0,
    "Archer Rush": 80.0,
    "Boom": 75.0,
    "Scout Rush": 75.0,
    "Fish Boom": 65.0,
}

AGE_TECH_IDS = {101: "feudal", 102: "castle", 103: "imperial"}


def _round(value: float | None) -> float | None:
    return None if value is None else round(float(value), 1)


def _descending_score(value: float, best: float, cutoff_75: float) -> float:
    """Return 100 at/before best and 75 at cutoff; later values fall below 75."""
    if cutoff_75 <= best:
        raise ValueError("cutoff_75 must be greater than best")
    if value <= best:
        return 100.0
    slope = 25.0 / (cutoff_75 - best)
    return max(0.0, 100.0 - (value - best) * slope)


def _fast_castle_score(castle_ms: int) -> float:
    if castle_ms > FAST_CASTLE_HARD_MAX_MS:
        return 0.0
    if castle_ms <= FAST_CASTLE_PERFECT_MS:
        return 100.0
    if castle_ms <= FAST_CASTLE_75_MS:
        return _descending_score(castle_ms, FAST_CASTLE_PERFECT_MS, FAST_CASTLE_75_MS)
    # Keep 17:00 visibly at 75 while degrading to zero by the 18:00 hard maximum.
    return max(0.0, 75.0 * (FAST_CASTLE_HARD_MAX_MS - castle_ms)
               / (FAST_CASTLE_HARD_MAX_MS - FAST_CASTLE_75_MS))


def _ids_with_role(catalog: dict[str, Any], section: str, role: str) -> set[int]:
    result: set[int] = set()
    for raw_id, item in (catalog.get(section) or {}).items():
        if role in (item.get("roleKeys") or []):
            try:
                result.add(int(raw_id))
            except (TypeError, ValueError):
                continue
    return result


def _technology_ids_containing(catalog: dict[str, Any], phrase: str) -> set[int]:
    needle = phrase.casefold()
    result: set[int] = set()
    for raw_id, item in (catalog.get("technologies") or {}).items():
        if needle in str(item.get("name") or "").casefold():
            try:
                result.add(int(raw_id))
            except (TypeError, ValueError):
                continue
    return result


def _events_for_player(body: dict[str, Any], key: str, player_id: int) -> list[dict[str, Any]]:
    return sorted(
        (event for event in body.get(key, []) if event.get("replaySlot") == player_id),
        key=lambda event: (event.get("atMs", 0), event.get("sourceEventId", "")),
    )


def _first_age_times(body: dict[str, Any], player_id: int) -> dict[str, int]:
    result: dict[str, int] = {}
    for event in _events_for_player(body, "researchEvents", player_id):
        age = AGE_TECH_IDS.get(event.get("technologyId"))
        at_ms = event.get("atMs")
        if age and isinstance(at_ms, int) and age not in result:
            result[age] = at_ms
    return result


def _positive_amount(event: dict[str, Any]) -> int:
    amount = event.get("requestedAmountPositive")
    return amount if type(amount) is int and amount > 0 else 0


def _nth_request_time(
    events: Iterable[dict[str, Any]], unit_ids: set[int], threshold: int, *,
    start_ms: int | None = None, end_ms: int | None = None,
) -> int | None:
    cumulative = 0
    for event in events:
        at_ms = event.get("atMs")
        if not isinstance(at_ms, int):
            continue
        if start_ms is not None and at_ms < start_ms:
            continue
        if end_ms is not None and at_ms > end_ms:
            continue
        if event.get("unitId") not in unit_ids:
            continue
        cumulative += _positive_amount(event)
        if cumulative >= threshold:
            return at_ms
    return None


def _first_placement(
    events: Iterable[dict[str, Any]], building_ids: set[int], *,
    start_ms: int | None = None, end_ms: int | None = None,
) -> dict[str, Any] | None:
    for event in events:
        at_ms = event.get("atMs")
        if not isinstance(at_ms, int):
            continue
        if start_ms is not None and at_ms < start_ms:
            continue
        if end_ms is not None and at_ms > end_ms:
            continue
        if event.get("buildingId") in building_ids:
            return event
    return None


def _nth_placement_time(
    events: Iterable[dict[str, Any]], building_ids: set[int], threshold: int, *,
    start_ms: int | None = None, end_ms: int | None = None,
) -> int | None:
    count = 0
    for event in events:
        at_ms = event.get("atMs")
        if not isinstance(at_ms, int):
            continue
        if start_ms is not None and at_ms < start_ms:
            continue
        if end_ms is not None and at_ms > end_ms:
            continue
        if event.get("buildingId") not in building_ids:
            continue
        count += 1
        if count >= threshold:
            return at_ms
    return None


def _is_same_team(left: dict[str, Any], right: dict[str, Any]) -> bool:
    a, b = left.get("lobbyTeamId"), right.get("lobbyTeamId")
    return isinstance(a, int) and isinstance(b, int) and a > 0 and a == b


def _start_anchors(
    manifest: dict[str, Any], catalog: dict[str, Any], initial_objects: Iterable[dict[str, Any]],
) -> dict[int, dict[str, Any]]:
    town_center_ids = _ids_with_role(catalog, "buildings", "town_center")
    by_owner: dict[int, list[tuple[float, float]]] = defaultdict(list)
    town_centers: dict[int, list[tuple[float, float]]] = defaultdict(list)

    for event in initial_objects:
        payload = event.get("payload") or {}
        owner = payload.get("ownerPlayerId")
        pos = event.get("position") or {}
        x, y = pos.get("x"), pos.get("y")
        if not isinstance(owner, int) or not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            continue
        point = (float(x), float(y))
        by_owner[owner].append(point)
        if payload.get("objectId") in town_center_ids:
            town_centers[owner].append(point)

    anchors: dict[int, dict[str, Any]] = {}
    participant_ids = {p["playerId"] for p in manifest.get("participants", [])}
    for player_id in participant_ids:
        tc_points = town_centers.get(player_id) or []
        if tc_points:
            x = sum(point[0] for point in tc_points) / len(tc_points)
            y = sum(point[1] for point in tc_points) / len(tc_points)
            anchors[player_id] = {"x": x, "y": y, "method": "initial_town_center"}
            continue
        points = by_owner.get(player_id) or []
        if points:
            x = sum(point[0] for point in points) / len(points)
            y = sum(point[1] for point in points) / len(points)
            anchors[player_id] = {"x": x, "y": y, "method": "initial_owned_object_centroid"}
    return anchors


def _nearest_enemy_anchor(
    player: dict[str, Any], participants: list[dict[str, Any]], anchors: dict[int, dict[str, Any]],
    x: float, y: float,
) -> tuple[int, float, str] | None:
    best: tuple[int, float, str] | None = None
    for other in participants:
        if other.get("playerId") == player.get("playerId") or _is_same_team(player, other):
            continue
        anchor = anchors.get(other.get("playerId"))
        if not anchor:
            continue
        distance = math.hypot(x - anchor["x"], y - anchor["y"])
        candidate = (int(other["playerId"]), distance, str(anchor["method"]))
        if best is None or distance < best[1]:
            best = candidate
    return best


def _candidate(label: str, execution_score: float, trigger_at_ms: int, evidence: dict[str, Any]) -> dict[str, Any]:
    difficulty = DIFFICULTY_SCORE[label]
    precedence = (execution_score * PRECEDENCE_EXECUTION_WEIGHT
                  + difficulty * PRECEDENCE_DIFFICULTY_WEIGHT)
    return {
        "label": label,
        "executionScore": _round(execution_score),
        "difficultyScore": _round(difficulty),
        "precedenceScore": _round(precedence),
        "triggerAtMs": trigger_at_ms,
        "qualifies": execution_score > QUALIFICATION_SCORE_EXCLUSIVE,
        "evidence": evidence,
    }


def _empty_result(candidates: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "layer": "inferred",
        "label": "N/A",
        "executionScore": None,
        "precedenceScore": None,
        "ruleVersion": BUILD_ORDER_RULE_VERSION,
        "qualification": {"operator": ">", "executionScore": QUALIFICATION_SCORE_EXCLUSIVE},
        "candidates": candidates,
        "evidence": {},
    }


def classify_build_orders(
    *, manifest: dict[str, Any], body: dict[str, Any], catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Classify one primary opening per participant from canonical evidence.

    Precedence is execution quality (70%) plus a versioned difficulty score (30%).
    Fast Castle explicitly suppresses Boom when both qualify. Exactly 75 is not
    sufficient; the player-facing result is N/A unless the chosen candidate is >75.
    """
    participants = list(manifest.get("participants") or [])
    anchors = _start_anchors(manifest, catalog, initial_objects)

    stable_ids = _ids_with_role(catalog, "buildings", "stable")
    range_ids = _ids_with_role(catalog, "buildings", "archery_range")
    tower_ids = _ids_with_role(catalog, "buildings", "tower")
    dock_ids = _ids_with_role(catalog, "buildings", "dock")
    tc_ids = _ids_with_role(catalog, "buildings", "town_center")
    scout_ids = _ids_with_role(catalog, "units", "scout_cavalry")
    archer_ids = _ids_with_role(catalog, "units", "archer")
    militia_ids = _ids_with_role(catalog, "units", "militia")
    maa_ids = _ids_with_role(catalog, "units", "man_at_arms")
    fishing_ids = _ids_with_role(catalog, "units", "fishing_ship")
    water_military_ids = _ids_with_role(catalog, "units", "water_military")
    maa_tech_ids = _technology_ids_containing(catalog, "man-at-arms")

    results: dict[str, dict[str, Any]] = {}
    for player in participants:
        player_id = int(player["playerId"])
        production = _events_for_player(body, "productionEvents", player_id)
        builds = _events_for_player(body, "buildEvents", player_id)
        research = _events_for_player(body, "researchEvents", player_id)
        ages = _first_age_times(body, player_id)
        feudal_ms, castle_ms = ages.get("feudal"), ages.get("castle")
        candidates: list[dict[str, Any]] = []

        # Drush bucket intentionally includes Man-at-Arms openings.
        if feudal_ms is not None:
            drush_units = militia_ids | maa_ids
            drush_trigger = _nth_request_time(
                production, drush_units, 2, end_ms=feudal_ms + 4 * 60_000,
            )
            if drush_trigger is not None:
                score = _descending_score(drush_trigger, 9 * 60_000, 14 * 60_000)
                maa_seen = any(
                    event.get("unitId") in maa_ids and isinstance(event.get("atMs"), int)
                    and event["atMs"] <= drush_trigger for event in production
                ) or any(
                    event.get("technologyId") in maa_tech_ids and isinstance(event.get("atMs"), int)
                    and event["atMs"] <= feudal_ms + 4 * 60_000 for event in research
                )
                candidates.append(_candidate("Drush", score, drush_trigger, {
                    "variant": "Man-at-Arms" if maa_seen else "Militia",
                    "secondMilitiaOrManAtArmsQueuedAtMs": drush_trigger,
                    "feudalAtMs": feudal_ms,
                    "requiredQueuedUnits": 2,
                }))

            stable = _first_placement(builds, stable_ids, start_ms=feudal_ms, end_ms=feudal_ms + 4 * 60_000)
            second_scout = _nth_request_time(
                production, scout_ids, 2, start_ms=feudal_ms, end_ms=feudal_ms + 6 * 60_000,
            )
            if stable and second_scout is not None:
                stable_score = _descending_score(stable["atMs"] - feudal_ms, 90_000, 4 * 60_000)
                scout_score = _descending_score(second_scout - feudal_ms, 210_000, 6 * 60_000)
                score = min(stable_score, scout_score)
                candidates.append(_candidate("Scout Rush", score, second_scout, {
                    "feudalAtMs": feudal_ms,
                    "stablePlacedAtMs": stable["atMs"],
                    "secondNewScoutQueuedAtMs": second_scout,
                    "startingScoutCounted": False,
                }))

            archery_range = _first_placement(builds, range_ids, start_ms=feudal_ms, end_ms=feudal_ms + 4 * 60_000)
            third_archer = _nth_request_time(
                production, archer_ids, 3, start_ms=feudal_ms, end_ms=feudal_ms + 7 * 60_000,
            )
            if archery_range and third_archer is not None:
                range_score = _descending_score(archery_range["atMs"] - feudal_ms, 90_000, 4 * 60_000)
                archer_score = _descending_score(third_archer - feudal_ms, 240_000, 7 * 60_000)
                score = min(range_score, archer_score)
                candidates.append(_candidate("Archer Rush", score, third_archer, {
                    "feudalAtMs": feudal_ms,
                    "archeryRangePlacedAtMs": archery_range["atMs"],
                    "thirdArcherQueuedAtMs": third_archer,
                }))

            # Tower Rush requires both early timing and enemy-zone proximity.
            for tower in builds:
                if tower.get("buildingId") not in tower_ids:
                    continue
                at_ms, x, y = tower.get("atMs"), tower.get("x"), tower.get("y")
                if not isinstance(at_ms, int) or at_ms < feudal_ms or at_ms > feudal_ms + 6 * 60_000:
                    continue
                if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
                    continue
                nearest = _nearest_enemy_anchor(player, participants, anchors, float(x), float(y))
                if nearest is None:
                    continue
                enemy_id, distance, anchor_method = nearest
                timing_score = _descending_score(at_ms - feudal_ms, 150_000, 6 * 60_000)
                proximity_score = _descending_score(
                    distance, TOWER_DIRECT_PRESSURE_RADIUS_TILES, TOWER_ZONING_RADIUS_TILES,
                )
                score = min(timing_score, proximity_score)
                candidates.append(_candidate("Tower Rush", score, at_ms, {
                    "feudalAtMs": feudal_ms,
                    "towerPlacedAtMs": at_ms,
                    "towerPosition": {"x": x, "y": y},
                    "nearestEnemyPlayerId": enemy_id,
                    "enemyStartAnchorMethod": anchor_method,
                    "distanceToEnemyStartTiles": _round(distance),
                    "directPressureRadiusTiles": TOWER_DIRECT_PRESSURE_RADIUS_TILES,
                    "zoningRadiusTiles": TOWER_ZONING_RADIUS_TILES,
                }))

            dock = _first_placement(builds, dock_ids, end_ms=feudal_ms + 7 * 60_000)
            second_warship = _nth_request_time(
                production, water_military_ids, 2, end_ms=feudal_ms + 7 * 60_000,
            )
            if dock and second_warship is not None:
                dock_score = _descending_score(dock["atMs"], 7 * 60_000, 12 * 60_000)
                ship_score = _descending_score(second_warship - feudal_ms, 180_000, 7 * 60_000)
                score = min(dock_score, ship_score)
                candidates.append(_candidate("Naval Rush", score, second_warship, {
                    "feudalAtMs": feudal_ms,
                    "dockPlacedAtMs": dock["atMs"],
                    "secondMilitaryWaterUnitQueuedAtMs": second_warship,
                }))

            third_fishing_ship = _nth_request_time(
                production, fishing_ids, 3, end_ms=feudal_ms + 8 * 60_000,
            )
            if dock and third_fishing_ship is not None:
                dock_score = _descending_score(dock["atMs"], 7 * 60_000, 12 * 60_000)
                fish_score = _descending_score(third_fishing_ship, 9 * 60_000, 14 * 60_000)
                score = min(dock_score, fish_score)
                candidates.append(_candidate("Fish Boom", score, third_fishing_ship, {
                    "dockPlacedAtMs": dock["atMs"],
                    "thirdFishingShipQueuedAtMs": third_fishing_ship,
                }))

        if castle_ms is not None and feudal_ms is not None and castle_ms > feudal_ms:
            second_extra_tc = _nth_placement_time(
                builds, tc_ids, 2, start_ms=castle_ms, end_ms=castle_ms + 5 * 60_000,
            )
            if second_extra_tc is not None:
                boom_score = _descending_score(second_extra_tc - castle_ms, 120_000, 5 * 60_000)
                candidates.append(_candidate("Boom", boom_score, second_extra_tc, {
                    "castleAtMs": castle_ms,
                    "secondAdditionalTownCenterPlacedAtMs": second_extra_tc,
                    "requiredAdditionalTownCenters": 2,
                }))

            aggressive_labels = {"Drush", "Scout Rush", "Archer Rush", "Tower Rush", "Naval Rush"}
            has_qualifying_aggression = any(
                candidate["label"] in aggressive_labels and candidate["qualifies"] for candidate in candidates
            )
            if not has_qualifying_aggression:
                fc_score = _fast_castle_score(castle_ms)
                candidates.append(_candidate("Fast Castle", fc_score, castle_ms, {
                    "feudalAtMs": feudal_ms,
                    "castleAtMs": castle_ms,
                    "perfectAtOrBeforeMs": FAST_CASTLE_PERFECT_MS,
                    "score75AtMs": FAST_CASTLE_75_MS,
                    "hardMaximumMs": FAST_CASTLE_HARD_MAX_MS,
                    "qualifyingFeudalAggressionPresent": False,
                }))

        candidates.sort(key=lambda candidate: (
            candidate["triggerAtMs"], candidate["label"],
        ))
        qualified = [candidate for candidate in candidates if candidate["qualifies"]]

        # Explicit product rule: a qualifying Fast Castle takes precedence over Boom.
        if any(candidate["label"] == "Fast Castle" for candidate in qualified):
            qualified = [candidate for candidate in qualified if candidate["label"] != "Boom"]

        if not qualified:
            results[str(player_id)] = _empty_result(candidates)
            continue

        chosen = max(qualified, key=lambda candidate: (
            candidate["precedenceScore"], candidate["executionScore"],
            candidate["difficultyScore"], -candidate["triggerAtMs"],
        ))
        results[str(player_id)] = {
            "layer": "inferred",
            "label": chosen["label"],
            "executionScore": chosen["executionScore"],
            "precedenceScore": chosen["precedenceScore"],
            "ruleVersion": BUILD_ORDER_RULE_VERSION,
            "qualification": {"operator": ">", "executionScore": QUALIFICATION_SCORE_EXCLUSIVE},
            "candidates": candidates,
            "evidence": chosen["evidence"],
        }

    return results
