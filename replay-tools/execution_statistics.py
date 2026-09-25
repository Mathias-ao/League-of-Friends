"""Execution V1 statistics over decoded ACTION evidence and inferred fight/raid windows."""
from __future__ import annotations

from collections import Counter, defaultdict
import math
from statistics import median
from typing import Any, Iterable

from economy_statistics import ECO_TECH_IDS
from fight_detector import FIGHT_LINK_DISTANCE_TILES
from raid_detector import RAID_MODEL_VERSION, build_economic_zones

EXECUTION_MODEL_VERSION = "AOF_EXECUTION_STATISTICS_V1"
RAID_RESPONSE_MAX_MS = 30_000
RAID_GARRISON_TAIL_MS = 10_000
DISENGAGE_MIN_DELTA_TILES = 8.0

CONTROL_ACTIONS = {
    "MOVE", "ORDER", "PATROL", "DE_ATTACK_MOVE", "ATTACK_GROUND",
    "REPAIR", "STOP", "TOWN_BELL",
}
FIGHT_POSITION_ACTIONS = {"MOVE", "ORDER", "PATROL", "DE_ATTACK_MOVE", "ATTACK_GROUND"}
ECONOMY_BUILDING_ROLES = {
    "economy", "farm", "town_center", "market", "mill", "lumber_camp",
    "mining_camp", "house", "naval_economy", "population_production",
}
ECONOMY_UNIT_ROLES = {"villager", "economic_unit", "fishing_ship", "trade_unit"}


def _participants(manifest: dict[str, Any]) -> dict[int, dict[str, Any]]:
    return {int(row["playerId"]): row for row in manifest.get("participants", [])}


def _same_team(a: dict[str, Any], b: dict[str, Any]) -> bool:
    left, right = a.get("lobbyTeamId"), b.get("lobbyTeamId")
    return isinstance(left, int) and isinstance(right, int) and left > 0 and left == right


def _point(event: dict[str, Any]) -> tuple[float, float] | None:
    pos = event.get("position") or {}
    x, y = pos.get("x"), pos.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        return None
    return float(x), float(y)


def _catalog_item(catalog: dict[str, Any], section: str, raw_id: Any) -> dict[str, Any]:
    try:
        key = str(int(raw_id))
    except (TypeError, ValueError):
        return {}
    item = (catalog.get(section) or {}).get(key)
    return item if isinstance(item, dict) else {}


def _initial_instance_info(
    initial_objects: Iterable[dict[str, Any]],
    catalog: dict[str, Any],
) -> dict[int, dict[str, Any]]:
    buildings = catalog.get("buildings") or {}
    result: dict[int, dict[str, Any]] = {}
    for event in initial_objects:
        payload = event.get("payload") or {}
        instance = payload.get("instanceId")
        owner = payload.get("ownerPlayerId")
        raw_id = payload.get("objectId")
        if not isinstance(instance, int) or not isinstance(owner, int):
            continue
        try:
            key = str(int(raw_id))
        except (TypeError, ValueError):
            key = ""
        section = "buildings" if key in buildings else "units"
        item = _catalog_item(catalog, section, raw_id)
        result[instance] = {
            "ownerPlayerId": owner,
            "rawId": raw_id,
            "section": section,
            "name": item.get("name"),
            "roleKeys": list(item.get("roleKeys") or []),
        }
    return result


def _is_garrison_capable_initial_target(info: dict[str, Any]) -> bool:
    if info.get("section") != "buildings":
        return False
    roles = set(info.get("roleKeys") or [])
    name = str(info.get("name") or "").lower()
    return bool(
        roles.intersection({"town_center", "tower"})
        or any(token in name for token in ("castle", "krepost", "donjon", "town center", "tower", "keep"))
    )


def _is_garrison_order(
    event: dict[str, Any],
    player_id: int,
    instance_info: dict[int, dict[str, Any]],
) -> bool:
    if event.get("sourceActionName") != "ORDER":
        return False
    target = event.get("targetInstanceId")
    if not isinstance(target, int):
        return False
    info = instance_info.get(target) or {}
    return info.get("ownerPlayerId") == player_id and _is_garrison_capable_initial_target(info)


def _active_zone_contains(
    zones: list[dict[str, Any]],
    *,
    at_ms: int,
    point: tuple[float, float],
) -> bool:
    x, y = point
    for zone in zones:
        if zone.get("activeFromMs", 0) > at_ms:
            continue
        distance = math.hypot(x - float(zone["x"]), y - float(zone["y"]))
        if distance <= float(zone["radiusTiles"]):
            return True
    return False


def _is_defensive_response(
    event: dict[str, Any],
    player_id: int,
    *,
    instance_info: dict[int, dict[str, Any]],
    zones: list[dict[str, Any]],
) -> bool:
    name = event.get("sourceActionName")
    at_ms = event.get("timestampMs")
    if not isinstance(at_ms, int):
        return False
    if name == "TOWN_BELL" or _is_garrison_order(event, player_id, instance_info):
        return True
    if name in {"DE_ATTACK_MOVE", "ATTACK_GROUND", "PATROL", "REPAIR", "STOP"}:
        return True
    if name in {"MOVE", "ORDER"}:
        point = _point(event)
        return point is not None and _active_zone_contains(zones, at_ms=at_ms, point=point)
    return False


def _merge_intervals(intervals: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if not intervals:
        return []
    ordered = sorted(intervals)
    merged = [list(ordered[0])]
    for start, end in ordered[1:]:
        current = merged[-1]
        if start <= current[1]:
            current[1] = max(current[1], end)
        else:
            merged.append([start, end])
    return [(int(start), int(end)) for start, end in merged]


def _inside_intervals(at_ms: int, intervals: list[tuple[int, int]]) -> bool:
    return any(start <= at_ms <= end for start, end in intervals)


def _raw_entity_id(event: dict[str, Any], payload_key: str) -> int | None:
    payload = event.get("payload") or {}
    value = payload.get(payload_key)
    return int(value) if isinstance(value, int) else None


def _is_economy_action(
    event: dict[str, Any],
    catalog: dict[str, Any],
    instance_info: dict[int, dict[str, Any]],
) -> bool:
    name = event.get("sourceActionName")
    payload = event.get("payload") or {}
    if name in {"BUY", "SELL", "TRIBUTE", "DE_TRIBUTE", "GATHER_POINT", "BACK_TO_WORK"}:
        return True
    if name in {"QUEUE", "DE_QUEUE", "MULTIQUEUE", "MAKE"}:
        item = _catalog_item(catalog, "units", payload.get("unit_id"))
        return bool(set(item.get("roleKeys") or []).intersection(ECONOMY_UNIT_ROLES))
    if name == "RESEARCH":
        tech = payload.get("technology_id")
        return isinstance(tech, int) and tech in ECO_TECH_IDS
    if name in {"BUILD", "WALL"}:
        item = _catalog_item(catalog, "buildings", payload.get("building_id"))
        return bool(set(item.get("roleKeys") or []).intersection(ECONOMY_BUILDING_ROLES))
    if name == "ORDER":
        selected = [
            instance_info.get(instance) or {}
            for instance in event.get("objectInstanceIds") or []
            if isinstance(instance, int)
        ]
        return any(
            info.get("section") == "units"
            and set(info.get("roleKeys") or []).intersection(ECONOMY_UNIT_ROLES)
            for info in selected
        )
    return False


def _terrain_elevation(
    terrain: dict[str, Any],
    point: tuple[float, float],
) -> int | None:
    width, height = terrain.get("width"), terrain.get("height")
    values = terrain.get("values") or []
    if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
        return None
    x = min(width - 1, max(0, int(round(point[0]))))
    y = min(height - 1, max(0, int(round(point[1]))))
    index = y * width + x
    if index >= len(values):
        return None
    value = values[index]
    return int(value) if isinstance(value, (int, float)) else None


def _fight_elevation_delta(
    player_id: int,
    *,
    episodes: list[dict[str, Any]],
    action_events: list[dict[str, Any]],
    participants: dict[int, dict[str, Any]],
    terrain: dict[str, Any],
) -> tuple[float | None, int, list[dict[str, Any]]]:
    deltas: list[float] = []
    evidence: list[dict[str, Any]] = []
    player = participants[player_id]
    for episode in episodes:
        center = episode["center"]
        own: list[int] = []
        enemy: list[int] = []
        enemy_ids = {
            other
            for other in episode["participantPlayerIds"]
            if other in participants and other != player_id and not _same_team(player, participants[other])
        }
        for event in action_events:
            actor = event.get("actorPlayerId")
            at_ms = event.get("timestampMs")
            if actor != player_id and actor not in enemy_ids:
                continue
            if event.get("sourceActionName") not in FIGHT_POSITION_ACTIONS:
                continue
            if not isinstance(at_ms, int) or not (episode["startedAtMs"] <= at_ms <= episode["endedAtMs"]):
                continue
            point = _point(event)
            if point is None:
                continue
            if math.hypot(point[0] - center["x"], point[1] - center["y"]) > FIGHT_LINK_DISTANCE_TILES * 1.5:
                continue
            elevation = _terrain_elevation(terrain, point)
            if elevation is None:
                continue
            (own if actor == player_id else enemy).append(elevation)
        if own and enemy:
            delta = sum(own) / len(own) - sum(enemy) / len(enemy)
            deltas.append(delta)
            evidence.append({
                "fightId": episode["fightId"],
                "playerAverageElevation": round(sum(own) / len(own), 3),
                "opponentAverageElevation": round(sum(enemy) / len(enemy), 3),
                "delta": round(delta, 3),
                "playerSampleCount": len(own),
                "opponentSampleCount": len(enemy),
            })
    return (round(sum(deltas) / len(deltas), 3) if deltas else None, len(deltas), evidence)


def _disengage_moves(
    player_id: int,
    *,
    episodes: list[dict[str, Any]],
    action_events: list[dict[str, Any]],
) -> tuple[int, list[dict[str, Any]]]:
    count = 0
    evidence: list[dict[str, Any]] = []
    player_events = [
        event for event in action_events
        if event.get("actorPlayerId") == player_id
    ]
    for episode in episodes:
        center = episode["center"]
        previous_by_selection: dict[tuple[int, ...], tuple[float, float]] = {}
        rows = sorted(
            (
                event for event in player_events
                if isinstance(event.get("timestampMs"), int)
                and episode["startedAtMs"] <= event["timestampMs"] <= episode["endedAtMs"]
                and event.get("sourceActionName") in FIGHT_POSITION_ACTIONS
            ),
            key=lambda event: (event["timestampMs"], event.get("operationOrdinal", 0)),
        )
        for event in rows:
            point = _point(event)
            selected = tuple(sorted(
                value for value in (event.get("objectInstanceIds") or [])
                if isinstance(value, int)
            ))
            if point is None or not selected:
                continue
            previous = previous_by_selection.get(selected)
            if event.get("sourceActionName") == "MOVE" and previous is not None:
                before = math.hypot(previous[0] - center["x"], previous[1] - center["y"])
                after = math.hypot(point[0] - center["x"], point[1] - center["y"])
                if (
                    before <= FIGHT_LINK_DISTANCE_TILES
                    and after - before >= DISENGAGE_MIN_DELTA_TILES
                ):
                    count += 1
                    evidence.append({
                        "fightId": episode["fightId"],
                        "atMs": event["timestampMs"],
                        "distanceBeforeTiles": round(before, 2),
                        "distanceAfterTiles": round(after, 2),
                        "sourceEventId": event.get("eventId"),
                    })
            previous_by_selection[selected] = point
    return count, evidence


def project_execution_statistics(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
    duration_ms: int,
    raid_statistics: dict[str, dict[str, Any]],
    fight_statistics: dict[str, Any],
    military_statistics: dict[str, dict[str, Any]],
    terrain_elevation: dict[str, Any],
    build_events: Iterable[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    participants = _participants(manifest)
    initial_objects = list(initial_objects)
    action_events = list(action_events)
    instance_info = _initial_instance_info(initial_objects, catalog)
    zones_by_player, _ = build_economic_zones(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=build_events,
    )

    by_player_actions: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for event in action_events:
        actor = event.get("actorPlayerId")
        if actor in participants:
            by_player_actions[int(actor)].append(event)
    for rows in by_player_actions.values():
        rows.sort(key=lambda event: (event.get("timestampMs", 0), event.get("operationOrdinal", 0)))

    results: dict[str, dict[str, Any]] = {}
    for player_id in sorted(participants):
        rows = by_player_actions.get(player_id, [])
        times = [
            int(event["timestampMs"])
            for event in rows
            if isinstance(event.get("timestampMs"), int)
        ]
        counts = Counter(event.get("sourceActionName") or "ERROR" for event in rows)
        gaps = [
            right - left
            for left, right in zip(times, times[1:])
            if right >= left
        ]
        formation_counts = Counter(
            str((event.get("payload") or {}).get("formation_id"))
            for event in rows
            if event.get("sourceActionName") == "FORMATION"
            and (event.get("payload") or {}).get("formation_id") is not None
        )
        preferred_formation = (
            max(formation_counts.items(), key=lambda item: (item[1], item[0]))[0]
            if formation_counts else None
        )

        garrison_events = [
            event for event in rows if _is_garrison_order(event, player_id, instance_info)
        ]

        received_raids = (
            raid_statistics.get(str(player_id), {})
            .get("raidEvidence", {})
            .get("receivedEpisodes", [])
        )
        response_rows: list[dict[str, Any]] = []
        garrisons_during_raids: set[str] = set()
        for raid in received_raids:
            start = raid["startedAtMs"]
            response_deadline = start + RAID_RESPONSE_MAX_MS
            response = next(
                (
                    event for event in rows
                    if isinstance(event.get("timestampMs"), int)
                    and start <= event["timestampMs"] <= response_deadline
                    and _is_defensive_response(
                        event,
                        player_id,
                        instance_info=instance_info,
                        zones=zones_by_player.get(player_id, []),
                    )
                ),
                None,
            )
            if response is not None:
                response_rows.append({
                    "raidStartedAtMs": start,
                    "responseAtMs": response["timestampMs"],
                    "responseTimeMs": response["timestampMs"] - start,
                    "responseAction": response.get("sourceActionName"),
                    "sourceEventId": response.get("eventId"),
                    "attackerPlayerId": raid.get("attackerPlayerId"),
                })
            for event in garrison_events:
                at_ms = event.get("timestampMs")
                if (
                    isinstance(at_ms, int)
                    and start <= at_ms <= raid["endedAtMs"] + RAID_GARRISON_TAIL_MS
                    and event.get("eventId")
                ):
                    garrisons_during_raids.add(event["eventId"])

        response_times = [row["responseTimeMs"] for row in response_rows]

        player_fights = list(fight_statistics.get("byPlayer", {}).get(str(player_id), []))
        intervals = _merge_intervals([
            (fight["startedAtMs"], fight["endedAtMs"])
            for fight in player_fights
        ])
        fight_duration_ms = sum(end - start for start, end in intervals)
        fight_actions = [
            event for event in rows
            if isinstance(event.get("timestampMs"), int)
            and _inside_intervals(event["timestampMs"], intervals)
        ]
        eco_actions = [
            event for event in fight_actions
            if _is_economy_action(event, catalog, instance_info)
        ]
        elevation_delta, elevation_fights, elevation_evidence = _fight_elevation_delta(
            player_id,
            episodes=player_fights,
            action_events=action_events,
            participants=participants,
            terrain=terrain_elevation,
        )
        disengage_count, disengage_evidence = _disengage_moves(
            player_id,
            episodes=player_fights,
            action_events=action_events,
        )

        total_minutes = duration_ms / 60_000 if duration_ms > 0 else None
        fight_minutes = fight_duration_ms / 60_000 if fight_duration_ms > 0 else None
        siege_queued = (
            military_statistics.get(str(player_id), {})
            .get("composition", {})
            .get("siege")
        )
        attack_ground_per_siege = (
            round(counts["ATTACK_GROUND"] / siege_queued, 3)
            if isinstance(siege_queued, (int, float)) and siege_queued > 0
            else None
        )

        results[str(player_id)] = {
            "modelVersion": EXECUTION_MODEL_VERSION,
            "layer": "mixed_observed_and_inferred",
            "actionsTotal": len(rows),
            "apm": round(len(rows) / total_minutes, 3) if total_minutes else None,
            "firstCommandAtMs": min(times) if times else None,
            "longestInactivityMs": max(gaps) if gaps else None,
            "medianActionGapMs": round(float(median(gaps)), 3) if gaps else None,
            "stanceChanges": counts["STANCE"],
            "patrolCommands": counts["PATROL"],
            "attackGroundCommands": counts["ATTACK_GROUND"],
            "attackMoveCommands": counts["DE_ATTACK_MOVE"],
            "garrisonCommands": len(garrison_events),
            "ungarrisonCommands": counts["UNGARRISON"],
            "backToWorkCommands": counts["BACK_TO_WORK"],
            "townBellUses": counts["TOWN_BELL"],
            "repairCommands": counts["REPAIR"],
            "deletions": counts["DELETE"],
            "stopCommands": counts["STOP"],
            "formationsSet": counts["FORMATION"],
            "preferredFormationRawId": preferred_formation,
            "attackGroundPerQueuedSiege": attack_ground_per_siege,
            "queuedSiegeCountBasis": siege_queued if isinstance(siege_queued, (int, float)) else None,
            "raidsSuffered": len(received_raids),
            "raidResponse": {
                "averageSeconds": round(sum(response_times) / len(response_times) / 1000, 3) if response_times else None,
                "medianSeconds": round(float(median(response_times)) / 1000, 3) if response_times else None,
                "respondedRaidCount": len(response_times),
                "receivedRaidCount": len(received_raids),
                "maximumResponseWindowMs": RAID_RESPONSE_MAX_MS,
                "evidence": response_rows,
            },
            "garrisonsDuringRaids": len(garrisons_during_raids),
            "fights": {
                "count": len(player_fights),
                "firstAtMs": min((row["startedAtMs"] for row in player_fights), default=None),
                "totalTimeMs": fight_duration_ms,
                "commandSharePercent": round(len(fight_actions) / len(rows) * 100, 3) if rows else None,
                "apm": round(len(fight_actions) / fight_minutes, 3) if fight_minutes else None,
                "ecoActions": len(eco_actions),
                "elevationDelta": elevation_delta,
                "elevationFightCount": elevation_fights,
                "disengageMoves": disengage_count,
                "episodeEvidence": player_fights,
                "elevationEvidence": elevation_evidence,
                "disengageEvidence": disengage_evidence,
            },
            "garrisonDetection": {
                "basis": "ORDER targeting an owned garrison-capable initial structure",
                "knownInitialTargetCount": sum(
                    1 for info in instance_info.values()
                    if info.get("ownerPlayerId") == player_id and _is_garrison_capable_initial_target(info)
                ),
                "limitation": "later-built garrison target instance identity is not reconstructed, so this can undercount",
            },
            "ecoActionsDuringFightsScope": (
                "economy-classified queue/research/build/market/rally/back-to-work commands plus "
                "ORDER commands whose selected unit is an initially observed economic unit; later "
                "villager tasking can undercount because produced-unit instance identity is not reconstructed"
            ),
            "scope": (
                "APM/action gaps and explicit control counts use decoded ACTION timestamps. Raid and "
                f"fight-context values intersect those facts with inferred {RAID_MODEL_VERSION} and "
                "AOF_FIGHT_DETECTION_V1 windows. Fight elevation samples initial terrain at recorded "
                "command coordinates; disengage moves are command-destination inference, not unit pathing."
            ),
        }
    return results
