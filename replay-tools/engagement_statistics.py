"""V1 player-facing engagement statistics over command-derived evidence.

This layer deliberately favors simple, auditable interaction facts:
- Battle requires reciprocal hostile command contribution.
- Great Battle is only a conservative high-confidence promotion.
- Ally Reinforcement and Defensive Assistance only exist inside the supported
  player's TC-anchored base.
- Cooperative Attack describes overlapping allied offensive participation and
  never claims planning or communication.

No output claims damage, kills, exact live army size, or continuous positions.
"""
from __future__ import annotations

from collections import defaultdict
import math
from typing import Any, Iterable

from fight_detector import FIGHT_LINK_DISTANCE_TILES

ENGAGEMENT_MODEL_VERSION = "AOF_ENGAGEMENT_STATISTICS_V1"

BASE_ZONE_RADIUS_TILES = 22.0
BASE_AMBIGUITY_MARGIN_TILES = 3.0
REINFORCEMENT_EPISODE_GAP_MS = 60_000

# A contributor must produce at least one combat-leaning command in an existing
# Fight V1 window. MOVE and untargeted ORDER can then support that contributor's
# episode evidence, but cannot make a player a Battle participant by themselves.
BATTLE_STRONG_ACTIONS = {"DE_ATTACK_MOVE", "ATTACK_GROUND", "PATROL"}
BATTLE_SUPPORT_ACTIONS = {"MOVE", "ORDER", "PATROL", "DE_ATTACK_MOVE", "ATTACK_GROUND"}

# Standalone reinforcement deliberately uses only commands that are difficult to
# confuse with routine economy movement. This is a high-precision/low-recall V1.
REINFORCEMENT_ACTIONS = {"PATROL", "DE_ATTACK_MOVE", "ATTACK_GROUND"}

# Great Battle is intentionally hard to earn. Ordinary or uncertain large fights
# remain Battle.
GREAT_BATTLE_MIN_DURATION_MS = 45_000
GREAT_BATTLE_MIN_SELECTED_OBJECTS = 40
GREAT_BATTLE_MIN_STRONG_COMMANDS = 6
GREAT_BATTLE_1V1_SELECTED_OBJECTS = 60


def _participants(manifest: dict[str, Any]) -> dict[int, dict[str, Any]]:
    return {int(row["playerId"]): row for row in manifest.get("participants", [])}


def _same_team(left: dict[str, Any], right: dict[str, Any]) -> bool:
    a, b = left.get("lobbyTeamId"), right.get("lobbyTeamId")
    return isinstance(a, int) and isinstance(b, int) and a > 0 and a == b


def _hostile(left_id: int, right_id: int, participants: dict[int, dict[str, Any]]) -> bool:
    if left_id == right_id or left_id not in participants or right_id not in participants:
        return False
    return not _same_team(participants[left_id], participants[right_id])


def _point(event: dict[str, Any]) -> tuple[float, float] | None:
    position = event.get("position") or {}
    x, y = position.get("x"), position.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        return None
    return float(x), float(y)


def _catalog_building(catalog: dict[str, Any], raw_id: Any) -> dict[str, Any]:
    try:
        key = str(int(raw_id))
    except (TypeError, ValueError):
        return {}
    item = (catalog.get("buildings") or {}).get(key)
    return item if isinstance(item, dict) else {}


def _is_town_center(catalog: dict[str, Any], raw_id: Any) -> bool:
    return "town_center" in set(_catalog_building(catalog, raw_id).get("roleKeys") or [])


def build_base_zones(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
) -> dict[int, list[dict[str, Any]]]:
    """Build conservative TC-anchored player base zones.

    A remote camp, Castle, military building, or generic forward structure never
    creates a defensive base. Later TC placements become eligible at placement
    time; this remains an inferred territory proxy, not construction completion.
    """
    participant_ids = set(_participants(manifest))
    zones: dict[int, list[dict[str, Any]]] = defaultdict(list)

    for event in initial_objects:
        payload = event.get("payload") or {}
        owner = payload.get("ownerPlayerId")
        raw_id = payload.get("objectId")
        point = _point(event)
        if owner not in participant_ids or point is None or not _is_town_center(catalog, raw_id):
            continue
        zones[int(owner)].append({
            "x": point[0],
            "y": point[1],
            "radiusTiles": BASE_ZONE_RADIUS_TILES,
            "activeFromMs": 0,
            "source": "initial_town_center",
            "sourceEventId": event.get("eventId"),
        })

    for event in build_events:
        owner = event.get("replaySlot")
        raw_id = event.get("buildingId")
        at_ms = event.get("atMs")
        x, y = event.get("x"), event.get("y")
        if owner not in participant_ids or not _is_town_center(catalog, raw_id):
            continue
        if not isinstance(at_ms, int) or not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            continue
        zones[int(owner)].append({
            "x": float(x),
            "y": float(y),
            "radiusTiles": BASE_ZONE_RADIUS_TILES,
            "activeFromMs": at_ms,
            "source": "town_center_placement",
            "sourceEventId": event.get("sourceEventId"),
        })

    for player_zones in zones.values():
        player_zones.sort(key=lambda row: (row["activeFromMs"], row["x"], row["y"]))
    return dict(zones)


def _resolve_base_owner(
    zones_by_player: dict[int, list[dict[str, Any]]],
    *,
    at_ms: int,
    point: tuple[float, float],
) -> tuple[int, dict[str, Any], float] | None:
    matches: list[tuple[float, int, dict[str, Any]]] = []
    for owner, zones in zones_by_player.items():
        for zone in zones:
            if zone["activeFromMs"] > at_ms:
                continue
            distance = math.hypot(point[0] - zone["x"], point[1] - zone["y"])
            if distance <= zone["radiusTiles"]:
                matches.append((distance, owner, zone))
    if not matches:
        return None
    matches.sort(key=lambda row: (row[0], row[1]))
    best = matches[0]
    next_different = next((row for row in matches[1:] if row[1] != best[1]), None)
    if next_different is not None and next_different[0] - best[0] < BASE_AMBIGUITY_MARGIN_TILES:
        return None
    return best[1], best[2], best[0]


def _initial_owners(initial_objects: Iterable[dict[str, Any]]) -> dict[int, int]:
    owners: dict[int, int] = {}
    for event in initial_objects:
        payload = event.get("payload") or {}
        instance = payload.get("instanceId")
        owner = payload.get("ownerPlayerId")
        if isinstance(instance, int) and isinstance(owner, int):
            owners[instance] = owner
    return owners


def _is_targeted_enemy_order(
    event: dict[str, Any],
    *,
    actor: int,
    owners: dict[int, int],
    participants: dict[int, dict[str, Any]],
) -> bool:
    if event.get("sourceActionName") != "ORDER":
        return False
    target = event.get("targetInstanceId")
    owner = owners.get(target) if isinstance(target, int) else None
    return isinstance(owner, int) and _hostile(actor, owner, participants)


def _inside_fight_area(event: dict[str, Any], fight: dict[str, Any]) -> bool:
    at_ms = event.get("timestampMs")
    point = _point(event)
    if not isinstance(at_ms, int) or point is None:
        return False
    if not (fight["startedAtMs"] <= at_ms <= fight["endedAtMs"]):
        return False
    center = fight["center"]
    return math.hypot(point[0] - center["x"], point[1] - center["y"]) <= FIGHT_LINK_DISTANCE_TILES * 1.5


def _side_groups(
    player_ids: Iterable[int],
    participants: dict[int, dict[str, Any]],
) -> list[list[int]]:
    groups: list[list[int]] = []
    for player_id in sorted(set(player_ids)):
        placed = False
        for group in groups:
            if _same_team(participants[player_id], participants[group[0]]):
                group.append(player_id)
                placed = True
                break
        if not placed:
            groups.append([player_id])
    return groups


def _battle_from_fight(
    *,
    index: int,
    fight: dict[str, Any],
    action_events: list[dict[str, Any]],
    participants: dict[int, dict[str, Any]],
    owners: dict[int, int],
    zones_by_player: dict[int, list[dict[str, Any]]],
    raids: list[dict[str, Any]],
) -> dict[str, Any] | None:
    nearby = [
        event for event in action_events
        if event.get("actorPlayerId") in participants
        and event.get("sourceActionName") in BATTLE_SUPPORT_ACTIONS
        and _inside_fight_area(event, fight)
    ]
    nearby.sort(key=lambda event: (event.get("timestampMs", 0), event.get("operationOrdinal", 0)))

    strong_actors: set[int] = set()
    strong_event_ids: set[str] = set()
    for event in nearby:
        actor = int(event["actorPlayerId"])
        action = event.get("sourceActionName")
        strong = action in BATTLE_STRONG_ACTIONS or _is_targeted_enemy_order(
            event,
            actor=actor,
            owners=owners,
            participants=participants,
        )
        if strong:
            strong_actors.add(actor)
            if event.get("eventId"):
                strong_event_ids.add(str(event["eventId"]))

    # Battle is stricter than Fight V1: at least two actual command contributors
    # from hostile sides must be present.
    if len(strong_actors) < 2:
        return None
    sides = _side_groups(strong_actors, participants)
    if len(sides) < 2 or not any(
        _hostile(left, right, participants)
        for left in strong_actors for right in strong_actors
        if left < right
    ):
        return None

    contribution_rows = [
        event for event in nearby
        if int(event["actorPlayerId"]) in strong_actors
    ]
    if not contribution_rows:
        return None

    started_at = min(int(event["timestampMs"]) for event in contribution_rows)
    ended_at = max(int(event["timestampMs"]) for event in contribution_rows)
    points = [_point(event) for event in contribution_rows]
    positioned = [point for point in points if point is not None]
    center = {
        "x": round(sum(point[0] for point in positioned) / len(positioned), 2),
        "y": round(sum(point[1] for point in positioned) / len(positioned), 2),
    }
    first_by_player = {
        str(player_id): min(
            int(event["timestampMs"])
            for event in contribution_rows
            if int(event["actorPlayerId"]) == player_id
        )
        for player_id in sorted(strong_actors)
    }
    selected_ids = {
        int(instance)
        for event in contribution_rows
        for instance in (event.get("objectInstanceIds") or [])
        if isinstance(instance, int)
    }
    base_match = _resolve_base_owner(
        zones_by_player,
        at_ms=started_at,
        point=(center["x"], center["y"]),
    )
    base_owner = base_match[0] if base_match is not None else None

    duration_ms = max(0, ended_at - started_at)
    strong_count = len(strong_event_ids)
    participant_count = len(strong_actors)
    great_battle = (
        duration_ms >= GREAT_BATTLE_MIN_DURATION_MS
        and len(selected_ids) >= GREAT_BATTLE_MIN_SELECTED_OBJECTS
        and strong_count >= GREAT_BATTLE_MIN_STRONG_COMMANDS
        and (
            participant_count >= 4
            or len(selected_ids) >= GREAT_BATTLE_1V1_SELECTED_OBJECTS
        )
    )

    overlapping_raids = [
        raid["raidId"]
        for raid in raids
        if raid.get("raidId")
        and raid.get("startedAtMs", 0) <= ended_at
        and raid.get("endedAtMs", 0) >= started_at
        and raid.get("attackerPlayerId") in strong_actors
        and raid.get("victimPlayerId") in strong_actors
    ]

    return {
        "battleId": f"battle-{index}",
        "sourceFightId": fight.get("fightId"),
        "startedAtMs": started_at,
        "endedAtMs": ended_at,
        "durationMs": duration_ms,
        "center": center,
        "participantPlayerIds": sorted(strong_actors),
        "sidePlayerIds": [sorted(side) for side in sides],
        "firstContributionAtMsByPlayer": first_by_player,
        "baseOwnerPlayerId": base_owner,
        "greatBattle": great_battle,
        "distinctSelectedObjectCount": len(selected_ids),
        "strongCommandCount": strong_count,
        "overlappingRaidIds": sorted(overlapping_raids),
        "sourceEventIds": sorted({
            str(event["eventId"])
            for event in contribution_rows
            if event.get("eventId")
        }),
        "modelVersion": ENGAGEMENT_MODEL_VERSION,
    }


def _all_raids(raid_statistics: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for player in raid_statistics.values():
        for episode in (player.get("raidEvidence") or {}).get("initiatedEpisodes", []):
            raid_id = episode.get("raidId")
            if raid_id:
                by_id[str(raid_id)] = episode
    return sorted(
        by_id.values(),
        key=lambda row: (row.get("startedAtMs", 0), row.get("raidId", "")),
    )


def _defensive_assistance(
    battles: list[dict[str, Any]],
    participants: dict[int, dict[str, Any]],
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for battle in battles:
        defended_id = battle.get("baseOwnerPlayerId")
        if defended_id not in participants:
            continue
        enemies = [
            player_id for player_id in battle["participantPlayerIds"]
            if _hostile(defended_id, player_id, participants)
        ]
        if not enemies:
            continue
        helpers = [
            player_id for player_id in battle["participantPlayerIds"]
            if player_id != defended_id
            and _same_team(participants[defended_id], participants[player_id])
        ]
        for helper_id in helpers:
            results.append({
                "battleId": battle["battleId"],
                "helperPlayerId": helper_id,
                "defendedPlayerId": defended_id,
                "enemyPlayerIds": sorted(enemies),
                "firstContributionAtMs": battle["firstContributionAtMsByPlayer"][str(helper_id)],
                "baseOwnerPlayerId": defended_id,
                "modelVersion": ENGAGEMENT_MODEL_VERSION,
            })
    return results


def _cooperative_attacks(
    battles: list[dict[str, Any]],
    participants: dict[int, dict[str, Any]],
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for battle in battles:
        base_owner = battle.get("baseOwnerPlayerId")
        for side in battle["sidePlayerIds"]:
            if len(side) < 2:
                continue

            # A multi-player side fighting in its own/ally base is defensive
            # assistance, not a cooperative attack.
            if (
                base_owner in participants
                and any(_same_team(participants[base_owner], participants[player_id]) for player_id in side)
            ):
                continue

            targets = [
                player_id for player_id in battle["participantPlayerIds"]
                if any(_hostile(attacker, player_id, participants) for attacker in side)
            ]
            if not targets:
                continue
            results.append({
                "battleId": battle["battleId"],
                "attackerPlayerIds": sorted(side),
                "targetPlayerIds": sorted(set(targets)),
                "startedAtMs": min(
                    battle["firstContributionAtMsByPlayer"][str(player_id)]
                    for player_id in side
                ),
                "locationContext": "enemy_base" if base_owner in targets else "neutral_or_contested",
                "baseOwnerPlayerId": base_owner,
                "modelVersion": ENGAGEMENT_MODEL_VERSION,
                "scope": "overlapping allied offensive participation; no coordination-intent claim",
            })
    return results


def _inside_defensive_battle(
    *,
    at_ms: int,
    helper_id: int,
    supported_id: int,
    battles: list[dict[str, Any]],
) -> bool:
    return any(
        battle.get("baseOwnerPlayerId") == supported_id
        and helper_id in battle.get("participantPlayerIds", [])
        and battle["startedAtMs"] <= at_ms <= battle["endedAtMs"]
        for battle in battles
    )


def _standalone_reinforcements(
    *,
    action_events: list[dict[str, Any]],
    participants: dict[int, dict[str, Any]],
    zones_by_player: dict[int, list[dict[str, Any]]],
    battles: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    candidates: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for event in action_events:
        helper = event.get("actorPlayerId")
        at_ms = event.get("timestampMs")
        point = _point(event)
        if (
            helper not in participants
            or not isinstance(at_ms, int)
            or point is None
            or event.get("sourceActionName") not in REINFORCEMENT_ACTIONS
        ):
            continue
        base_match = _resolve_base_owner(zones_by_player, at_ms=at_ms, point=point)
        if base_match is None:
            continue
        supported = base_match[0]
        if supported == helper or not _same_team(participants[int(helper)], participants[supported]):
            continue
        if _inside_defensive_battle(
            at_ms=at_ms,
            helper_id=int(helper),
            supported_id=supported,
            battles=battles,
        ):
            continue
        candidates[(int(helper), supported)].append({
            "atMs": at_ms,
            "action": event.get("sourceActionName"),
            "selectedIds": sorted({
                int(instance)
                for instance in (event.get("objectInstanceIds") or [])
                if isinstance(instance, int)
            }),
            "sourceEventId": event.get("eventId"),
            "baseSeed": {
                "source": base_match[1].get("source"),
                "sourceEventId": base_match[1].get("sourceEventId"),
            },
        })

    episodes: list[dict[str, Any]] = []
    for (helper, supported), rows in sorted(candidates.items()):
        rows.sort(key=lambda row: (row["atMs"], row.get("sourceEventId") or ""))
        current: list[dict[str, Any]] = []
        groups: list[list[dict[str, Any]]] = []
        for row in rows:
            if current and row["atMs"] - current[-1]["atMs"] > REINFORCEMENT_EPISODE_GAP_MS:
                groups.append(current)
                current = []
            current.append(row)
        if current:
            groups.append(current)

        for group in groups:
            selected = {
                instance
                for row in group
                for instance in row["selectedIds"]
            }
            if len(group) < 2 and len(selected) < 3:
                continue
            episodes.append({
                "reinforcementId": None,
                "helperPlayerId": helper,
                "supportedPlayerId": supported,
                "startedAtMs": group[0]["atMs"],
                "endedAtMs": group[-1]["atMs"],
                "commandCount": len(group),
                "distinctSelectedObjectCount": len(selected),
                "sourceEventIds": [
                    row["sourceEventId"] for row in group if row.get("sourceEventId")
                ],
                "baseSeed": group[0]["baseSeed"],
                "modelVersion": ENGAGEMENT_MODEL_VERSION,
                "scope": (
                    "high-confidence allied military-control evidence inside the supported player's "
                    "TC-anchored base and outside an active defensive battle"
                ),
            })

    episodes.sort(key=lambda row: (
        row["startedAtMs"],
        row["helperPlayerId"],
        row["supportedPlayerId"],
    ))
    for index, episode in enumerate(episodes, start=1):
        episode["reinforcementId"] = f"reinforcement-{index}"
    return episodes


def project_engagement_statistics(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
    fight_statistics: dict[str, Any],
    raid_statistics: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    participants = _participants(manifest)
    initial_objects = list(initial_objects)
    action_events = list(action_events)
    owners = _initial_owners(initial_objects)
    zones_by_player = build_base_zones(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=build_events,
    )
    raids = _all_raids(raid_statistics)

    battles: list[dict[str, Any]] = []
    for fight in fight_statistics.get("episodes", []):
        battle = _battle_from_fight(
            index=len(battles) + 1,
            fight=fight,
            action_events=action_events,
            participants=participants,
            owners=owners,
            zones_by_player=zones_by_player,
            raids=raids,
        )
        if battle is not None:
            battle["battleId"] = f"battle-{len(battles) + 1}"
            battles.append(battle)

    defensive = _defensive_assistance(battles, participants)
    cooperative = _cooperative_attacks(battles, participants)
    reinforcement = _standalone_reinforcements(
        action_events=action_events,
        participants=participants,
        zones_by_player=zones_by_player,
        battles=battles,
    )

    results: dict[str, dict[str, Any]] = {}
    for player_id in sorted(participants):
        player_battles = [
            battle for battle in battles
            if player_id in battle["participantPlayerIds"]
        ]
        great_battles = [battle for battle in player_battles if battle["greatBattle"]]
        reinforcements_sent = [
            event for event in reinforcement if event["helperPlayerId"] == player_id
        ]
        reinforcements_received = [
            event for event in reinforcement if event["supportedPlayerId"] == player_id
        ]
        defensive_given = [
            event for event in defensive if event["helperPlayerId"] == player_id
        ]
        defensive_received = [
            event for event in defensive if event["defendedPlayerId"] == player_id
        ]
        cooperative_for_player = [
            event for event in cooperative if player_id in event["attackerPlayerIds"]
        ]

        results[str(player_id)] = {
            "engagementModelVersion": ENGAGEMENT_MODEL_VERSION,
            "battlesFought": len(player_battles),
            "greatBattlesFought": len(great_battles),
            "allyReinforcementsSent": len(reinforcements_sent),
            "allyReinforcementsReceived": len(reinforcements_received),
            "defensiveAssistsGiven": len(defensive_given),
            "defensiveAssistsReceived": len(defensive_received),
            "cooperativeAttacks": len(cooperative_for_player),
            "engagementEvidence": {
                "battles": player_battles,
                "greatBattles": great_battles,
                "allyReinforcementsSent": reinforcements_sent,
                "allyReinforcementsReceived": reinforcements_received,
                "defensiveAssistsGiven": defensive_given,
                "defensiveAssistsReceived": defensive_received,
                "cooperativeAttacks": cooperative_for_player,
            },
            "engagementScope": (
                "Battles require reciprocal hostile command contributors. Great Battle is a "
                "conservative promotion only. Reinforcement/defensive assistance require the "
                "supported player's TC-anchored base. Cooperative Attack records overlapping "
                "allied offensive participation without claiming coordination, damage, kills, "
                "exact army size, or continuous positions."
            ),
        }
    return results
