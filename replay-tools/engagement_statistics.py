"""Player-facing Military Engagement statistics V2.

Hierarchy:
- Skirmish: broad local hostile episode from AOF_SKIRMISH_DETECTION_V1.
- Battle: a Skirmish with actual command contributors on opposing sides.
- Great Battle: conservative high-confidence promotion of Battle.
- Raid: orthogonal economy-pressure context from the raid detector.
- Reinforcement / Defensive Assistance / Cooperative Attack: ally interactions
  only when ally semantics are applicable and qualified.

No output claims damage, kills, battle outcome, exact live army size, or
continuous unit positions.
"""
from __future__ import annotations

from collections import defaultdict
import math
from typing import Any, Iterable

from skirmish_detector import SKIRMISH_LINK_DISTANCE_TILES

ENGAGEMENT_MODEL_VERSION = "AOF_ENGAGEMENT_STATISTICS_V2"

BASE_ZONE_RADIUS_TILES = 22.0
BASE_AMBIGUITY_MARGIN_TILES = 3.0
REINFORCEMENT_EPISODE_GAP_MS = 60_000
BATTLE_SUPPORT_ACTIONS = {"MOVE", "ORDER", "PATROL", "DE_ATTACK_MOVE", "ATTACK_GROUND"}
REINFORCEMENT_ACTIONS = {"PATROL", "DE_ATTACK_MOVE", "ATTACK_GROUND"}

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
            "x": point[0], "y": point[1],
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
            "x": float(x), "y": float(y),
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


def _ally_interaction_applicability(manifest: dict[str, Any]) -> dict[str, Any]:
    participants = list(manifest.get("participants") or [])
    if len(participants) <= 2:
        return {
            "status": "not_applicable",
            "reason": "one_v_one_has_no_third_party_ally_interaction",
        }

    for index, left in enumerate(participants):
        for right in participants[index + 1:]:
            if _same_team(left, right):
                return {
                    "status": "applicable",
                    "basis": "fixed_lobby_team_relationships",
                }

    settings = (manifest.get("match") or {}).get("settings") or {}
    lock_teams = settings.get("lockTeams")
    if lock_teams is True:
        return {
            "status": "not_applicable",
            "reason": "ffa_with_locked_diplomacy_has_no_allied_relationships",
        }
    if lock_teams is False:
        return {
            "status": "pending_relation_semantics",
            "reason": (
                "diplomacy_enabled_ffa_is_applicable_but_raw_modes_0_and_3_are_not_yet "
                "controlled-test-qualified as stance intervals"
            ),
        }
    return {
        "status": "unknown",
        "reason": "match_diplomacy_applicability_could_not_be_qualified",
    }


def _inside_skirmish_area(event: dict[str, Any], skirmish: dict[str, Any]) -> bool:
    at_ms = event.get("timestampMs")
    point = _point(event)
    if not isinstance(at_ms, int) or point is None:
        return False
    if not (skirmish["startedAtMs"] <= at_ms <= skirmish["endedAtMs"]):
        return False
    center = skirmish["center"]
    return math.hypot(point[0] - center["x"], point[1] - center["y"]) <= SKIRMISH_LINK_DISTANCE_TILES * 1.5


def _battle_from_skirmish(
    *,
    index: int,
    skirmish: dict[str, Any],
    action_events: list[dict[str, Any]],
    participants: dict[int, dict[str, Any]],
    zones_by_player: dict[int, list[dict[str, Any]]],
    raids: list[dict[str, Any]],
) -> dict[str, Any] | None:
    contributing = {
        int(player_id)
        for player_id in skirmish.get("contributingPlayerIds", [])
        if player_id in participants
    }

    # V2 intentionally treats response/control activity as participation. Unlike
    # V1, both sides do not need a narrow "strong" attack command. A one-sided
    # targeted episode remains a Skirmish, while opposing command contributors
    # promote it to Battle.
    hostile_contributor_pairs = [
        (left, right)
        for left in sorted(contributing)
        for right in sorted(contributing)
        if left < right and _hostile(left, right, participants)
    ]
    if not hostile_contributor_pairs:
        return None

    nearby = [
        event for event in action_events
        if event.get("actorPlayerId") in contributing
        and event.get("sourceActionName") in BATTLE_SUPPORT_ACTIONS
        and _inside_skirmish_area(event, skirmish)
    ]
    if not nearby:
        return None
    nearby.sort(key=lambda event: (event.get("timestampMs", 0), event.get("operationOrdinal", 0)))

    started_at = min(int(event["timestampMs"]) for event in nearby)
    ended_at = max(int(event["timestampMs"]) for event in nearby)
    first_by_player = {
        str(player_id): min(
            int(event["timestampMs"])
            for event in nearby
            if int(event["actorPlayerId"]) == player_id
        )
        for player_id in sorted(contributing)
        if any(int(event["actorPlayerId"]) == player_id for event in nearby)
    }
    selected_ids = {
        int(instance)
        for event in nearby
        for instance in (event.get("objectInstanceIds") or [])
        if isinstance(instance, int)
    }
    center = dict(skirmish["center"])
    base_match = _resolve_base_owner(
        zones_by_player,
        at_ms=started_at,
        point=(center["x"], center["y"]),
    )
    base_owner = base_match[0] if base_match is not None else None

    duration_ms = max(0, ended_at - started_at)
    great_battle = (
        duration_ms >= GREAT_BATTLE_MIN_DURATION_MS
        and len(selected_ids) >= GREAT_BATTLE_MIN_SELECTED_OBJECTS
        and int(skirmish.get("strongCommandCount", 0)) >= GREAT_BATTLE_MIN_STRONG_COMMANDS
        and (
            len(contributing) >= 4
            or len(selected_ids) >= GREAT_BATTLE_1V1_SELECTED_OBJECTS
        )
    )

    overlapping_raids = [
        raid["raidId"]
        for raid in raids
        if raid.get("raidId")
        and raid.get("startedAtMs", 0) <= ended_at
        and raid.get("endedAtMs", 0) >= started_at
        and raid.get("attackerPlayerId") in contributing
        and raid.get("victimPlayerId") in contributing
    ]

    return {
        "battleId": f"battle-{index}",
        "sourceSkirmishId": skirmish.get("skirmishId"),
        "startedAtMs": started_at,
        "endedAtMs": ended_at,
        "durationMs": duration_ms,
        "center": center,
        "participantPlayerIds": sorted(contributing),
        "sidePlayerIds": [
            sorted(player_id for player_id in side if player_id in contributing)
            for side in skirmish.get("sidePlayerIds", [])
            if any(player_id in contributing for player_id in side)
        ],
        "firstContributionAtMsByPlayer": first_by_player,
        "directedInteractionEdges": list(skirmish.get("directedInteractionEdges") or []),
        "opponentInteractionPairs": list(skirmish.get("opponentInteractionPairs") or []),
        "baseOwnerPlayerId": base_owner,
        "greatBattle": great_battle,
        "distinctSelectedObjectCount": len(selected_ids),
        "strongCommandCount": int(skirmish.get("strongCommandCount", 0)),
        "overlappingRaidIds": sorted(overlapping_raids),
        "sourceEventIds": sorted({
            str(event["eventId"]) for event in nearby if event.get("eventId")
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
        helpers = [
            player_id for player_id in battle["participantPlayerIds"]
            if player_id != defended_id
            and _same_team(participants[defended_id], participants[player_id])
        ]
        enemies = [
            player_id for player_id in battle["participantPlayerIds"]
            if _hostile(defended_id, player_id, participants)
        ]
        if not helpers or not enemies:
            continue
        for helper_id in helpers:
            if str(helper_id) not in battle["firstContributionAtMsByPlayer"]:
                continue
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
        pair_rows = battle.get("opponentInteractionPairs") or []
        for side in battle["sidePlayerIds"]:
            if len(side) < 2:
                continue
            if (
                base_owner in participants
                and any(_same_team(participants[base_owner], participants[player_id]) for player_id in side)
            ):
                continue

            target_to_attackers: dict[int, set[int]] = defaultdict(set)
            for pair in pair_rows:
                pair_ids = pair.get("playerIds") or []
                if len(pair_ids) != 2:
                    continue
                left, right = pair_ids
                if left in side and right not in side:
                    target_to_attackers[int(right)].add(int(left))
                if right in side and left not in side:
                    target_to_attackers[int(left)].add(int(right))

            targets = sorted(
                target for target, attackers in target_to_attackers.items()
                if len(attackers) >= 2
            )
            if not targets:
                continue
            attackers = sorted({
                attacker
                for target in targets
                for attacker in target_to_attackers[target]
            })
            results.append({
                "battleId": battle["battleId"],
                "attackerPlayerIds": attackers,
                "targetPlayerIds": targets,
                "startedAtMs": min(
                    battle["firstContributionAtMsByPlayer"][str(player_id)]
                    for player_id in attackers
                    if str(player_id) in battle["firstContributionAtMsByPlayer"]
                ),
                "locationContext": "enemy_base" if base_owner in targets else "neutral_or_contested",
                "baseOwnerPlayerId": base_owner,
                "modelVersion": ENGAGEMENT_MODEL_VERSION,
                "scope": (
                    "two or more allied contributors have pairwise interaction evidence "
                    "against the same opposing player; no coordination-intent claim"
                ),
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
        groups: list[list[dict[str, Any]]] = []
        current: list[dict[str, Any]] = []
        for row in rows:
            if current and row["atMs"] - current[-1]["atMs"] > REINFORCEMENT_EPISODE_GAP_MS:
                groups.append(current)
                current = []
            current.append(row)
        if current:
            groups.append(current)

        for group in groups:
            selected = {
                instance for row in group for instance in row["selectedIds"]
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
            })

    episodes.sort(key=lambda row: (
        row["startedAtMs"], row["helperPlayerId"], row["supportedPlayerId"],
    ))
    for index, episode in enumerate(episodes, start=1):
        episode["reinforcementId"] = f"reinforcement-{index}"
    return episodes


def _relationship_summary(
    *,
    player_id: int,
    skirmishes: list[dict[str, Any]],
    battles: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: dict[int, dict[str, Any]] = {}

    def touch(opponent: int) -> dict[str, Any]:
        return rows.setdefault(opponent, {
            "opponentPlayerId": opponent,
            "skirmishesTogether": 0,
            "mutualSkirmishes": 0,
            "battlesTogether": 0,
            "skirmishIds": [],
            "battleIds": [],
        })

    for skirmish in skirmishes:
        for pair in skirmish.get("opponentInteractionPairs") or []:
            ids = pair.get("playerIds") or []
            if player_id not in ids or len(ids) != 2:
                continue
            opponent = ids[0] if ids[1] == player_id else ids[1]
            row = touch(int(opponent))
            row["skirmishesTogether"] += 1
            row["skirmishIds"].append(skirmish["skirmishId"])
            if pair.get("mutualHostileEvidence"):
                row["mutualSkirmishes"] += 1

    for battle in battles:
        for pair in battle.get("opponentInteractionPairs") or []:
            ids = pair.get("playerIds") or []
            if player_id not in ids or len(ids) != 2:
                continue
            opponent = ids[0] if ids[1] == player_id else ids[1]
            row = touch(int(opponent))
            row["battlesTogether"] += 1
            row["battleIds"].append(battle["battleId"])

    return [rows[key] for key in sorted(rows)]


def project_engagement_statistics(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
    skirmish_statistics: dict[str, Any],
    raid_statistics: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    participants = _participants(manifest)
    initial_objects = list(initial_objects)
    action_events = list(action_events)
    zones_by_player = build_base_zones(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=build_events,
    )
    raids = _all_raids(raid_statistics)
    skirmishes = list(skirmish_statistics.get("episodes") or [])

    battles: list[dict[str, Any]] = []
    for skirmish in skirmishes:
        battle = _battle_from_skirmish(
            index=len(battles) + 1,
            skirmish=skirmish,
            action_events=action_events,
            participants=participants,
            zones_by_player=zones_by_player,
            raids=raids,
        )
        if battle is not None:
            battle["battleId"] = f"battle-{len(battles) + 1}"
            battles.append(battle)

    ally_applicability = _ally_interaction_applicability(manifest)
    if ally_applicability["status"] == "applicable":
        defensive = _defensive_assistance(battles, participants)
        cooperative = _cooperative_attacks(battles, participants)
        reinforcement = _standalone_reinforcements(
            action_events=action_events,
            participants=participants,
            zones_by_player=zones_by_player,
            battles=battles,
        )
    else:
        defensive = []
        cooperative = []
        reinforcement = []

    results: dict[str, dict[str, Any]] = {}
    for player_id in sorted(participants):
        player_skirmishes = [
            row for row in skirmishes if player_id in row.get("participantPlayerIds", [])
        ]
        player_battles = [
            row for row in battles if player_id in row.get("participantPlayerIds", [])
        ]
        great_battles = [row for row in player_battles if row["greatBattle"]]

        reinforcements_sent = [
            row for row in reinforcement if row["helperPlayerId"] == player_id
        ]
        reinforcements_received = [
            row for row in reinforcement if row["supportedPlayerId"] == player_id
        ]
        defensive_given = [
            row for row in defensive if row["helperPlayerId"] == player_id
        ]
        defensive_received = [
            row for row in defensive if row["defendedPlayerId"] == player_id
        ]
        cooperative_for_player = [
            row for row in cooperative if player_id in row["attackerPlayerIds"]
        ]

        ally_values_available = ally_applicability["status"] == "applicable"
        results[str(player_id)] = {
            "engagementModelVersion": ENGAGEMENT_MODEL_VERSION,
            "skirmishModelVersion": skirmish_statistics.get("modelVersion"),
            "skirmishes": len(player_skirmishes),
            "battlesFought": len(player_battles),
            "greatBattlesFought": len(great_battles),
            "allyInteractionApplicability": ally_applicability,
            "allyReinforcementsSent": len(reinforcements_sent) if ally_values_available else None,
            "allyReinforcementsReceived": len(reinforcements_received) if ally_values_available else None,
            "defensiveAssistsGiven": len(defensive_given) if ally_values_available else None,
            "defensiveAssistsReceived": len(defensive_received) if ally_values_available else None,
            "cooperativeAttacks": len(cooperative_for_player) if ally_values_available else None,
            "relationshipInteractionSummary": _relationship_summary(
                player_id=player_id,
                skirmishes=player_skirmishes,
                battles=player_battles,
            ),
            "engagementEvidence": {
                "skirmishes": player_skirmishes,
                "battles": player_battles,
                "greatBattles": great_battles,
                "allyReinforcementsSent": reinforcements_sent,
                "allyReinforcementsReceived": reinforcements_received,
                "defensiveAssistsGiven": defensive_given,
                "defensiveAssistsReceived": defensive_received,
                "cooperativeAttacks": cooperative_for_player,
            },
            "engagementScope": (
                "Skirmish is the broad hostile-command episode. Battle promotes a Skirmish when "
                "actual command contributors exist on opposing sides; it no longer requires both "
                "sides to issue a narrow strong-attack command. Pairwise interaction edges track "
                "which opponents actually overlapped or directly targeted each other for future "
                "relationship history. Great Battle remains conservative. Ally metrics are null/N/A "
                "when structurally impossible or when diplomacy-enabled FFA relation semantics are "
                "not yet qualified. No damage, kills, exact army size or continuous-position claim."
            ),
        }
    return results
