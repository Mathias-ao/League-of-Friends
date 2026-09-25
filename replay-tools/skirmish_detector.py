"""Broad command-derived Skirmish detection for Military Engagements.

IMPORTANT COMPATIBILITY CONTRACT:
Skirmish V1 is a player-facing rename/relocation of the former
AOF_FIGHT_DETECTION_V1 episode detector. The episode-forming logic, thresholds,
participant inclusion, timestamps and therefore count are intentionally kept
identical. Extra multiplayer relationship evidence is attached only after an
episode has already been formed and must not change Skirmish detection.

The model does not claim damage, deaths, unit survival, actual pathing, or
engine combat resolution.
"""
from __future__ import annotations

from collections import defaultdict
import math
from typing import Any, Iterable

SKIRMISH_MODEL_VERSION = "AOF_SKIRMISH_DETECTION_V1"
SKIRMISH_COMPATIBILITY_BASIS = "AOF_FIGHT_DETECTION_V1_RENAME_ONLY"
SKIRMISH_LINK_GAP_MS = 20_000
SKIRMISH_LINK_DISTANCE_TILES = 20.0
SKIRMISH_SUPPORT_BEFORE_MS = 4_000
SKIRMISH_SUPPORT_AFTER_MS = 8_000
SKIRMISH_MIN_WINDOW_MS = 5_000

# Relationship-only attribution is deliberately tighter than episode formation.
# These thresholds MUST NOT affect whether a Skirmish exists.
PAIR_LINK_GAP_MS = 12_000
PAIR_LINK_DISTANCE_TILES = 14.0

STRONG_ACTIONS = {"DE_ATTACK_MOVE", "ATTACK_GROUND"}
SUPPORTING_ACTIONS = {"MOVE", "ORDER", "PATROL", "DE_ATTACK_MOVE", "ATTACK_GROUND"}


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


def _initial_owners(initial_objects: Iterable[dict[str, Any]]) -> dict[int, int]:
    owners: dict[int, int] = {}
    for event in initial_objects:
        payload = event.get("payload") or {}
        instance = payload.get("instanceId")
        owner = payload.get("ownerPlayerId")
        if isinstance(instance, int) and isinstance(owner, int):
            owners[instance] = owner
    return owners


def _controller_ledger(
    initial_objects: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
) -> dict[int, list[tuple[int, int, int, str]]]:
    """Observed controller-at-time evidence used only for relationship edges.

    This ledger is intentionally NOT used to seed or merge Skirmishes, preserving
    exact AOF_FIGHT_DETECTION_V1 episode behavior.
    """
    ledger: dict[int, list[tuple[int, int, int, str]]] = defaultdict(list)
    for event in initial_objects:
        payload = event.get("payload") or {}
        instance = payload.get("instanceId")
        owner = payload.get("ownerPlayerId")
        if isinstance(instance, int) and isinstance(owner, int):
            ledger[instance].append((0, -1, owner, "initial_object_owner"))

    for event in action_events:
        actor = event.get("actorPlayerId")
        at_ms = event.get("timestampMs")
        ordinal = event.get("operationOrdinal")
        if not isinstance(actor, int) or not isinstance(at_ms, int):
            continue
        order = int(ordinal) if isinstance(ordinal, int) else 0
        for instance in event.get("objectInstanceIds") or []:
            if isinstance(instance, int):
                ledger[instance].append((at_ms, order, actor, "selected_by_actor"))

    for rows in ledger.values():
        rows.sort(key=lambda row: (row[0], row[1]))
    return dict(ledger)


def _controller_at(
    ledger: dict[int, list[tuple[int, int, int, str]]],
    instance_id: Any,
    *,
    at_ms: int,
    operation_ordinal: int,
) -> tuple[int, str] | None:
    if not isinstance(instance_id, int):
        return None
    best: tuple[int, int, int, str] | None = None
    for row in ledger.get(instance_id, []):
        if (row[0], row[1]) <= (at_ms, operation_ordinal):
            best = row
        else:
            break
    return (best[2], best[3]) if best is not None else None


def _is_enemy(
    left_id: int,
    right_id: int,
    participants: dict[int, dict[str, Any]],
) -> bool:
    if left_id == right_id or left_id not in participants or right_id not in participants:
        return False
    return not _same_team(participants[left_id], participants[right_id])


def _strong_observations(
    *,
    manifest: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Exact former Fight V1 seed logic, renamed only."""
    participants = _participants(manifest)
    owners = _initial_owners(initial_objects)
    rows: list[dict[str, Any]] = []
    for event in action_events:
        actor = event.get("actorPlayerId")
        at_ms = event.get("timestampMs")
        point = _point(event)
        action = event.get("sourceActionName")
        if actor not in participants or not isinstance(at_ms, int) or point is None:
            continue
        victim = None
        strength = None
        if action in STRONG_ACTIONS:
            strength = "strong_positional"
        elif action == "ORDER":
            target = event.get("targetInstanceId")
            target_owner = owners.get(target) if isinstance(target, int) else None
            if isinstance(target_owner, int) and _is_enemy(int(actor), target_owner, participants):
                victim = target_owner
                strength = "strong_targeted"
        if strength is None:
            continue
        rows.append({
            "atMs": at_ms,
            "actorPlayerId": int(actor),
            "targetVictimPlayerId": victim,
            "x": point[0],
            "y": point[1],
            "action": action,
            "strength": strength,
            "sourceEventId": event.get("eventId"),
        })
    rows.sort(key=lambda row: (row["atMs"], row.get("sourceEventId") or ""))
    return rows


def _components(rows: list[dict[str, Any]]) -> list[list[int]]:
    parent = list(range(len(rows)))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for right in range(len(rows)):
        left = right - 1
        while left >= 0:
            dt = rows[right]["atMs"] - rows[left]["atMs"]
            if dt > SKIRMISH_LINK_GAP_MS:
                break
            distance = math.hypot(
                rows[right]["x"] - rows[left]["x"],
                rows[right]["y"] - rows[left]["y"],
            )
            if distance <= SKIRMISH_LINK_DISTANCE_TILES:
                union(left, right)
            left -= 1

    groups: dict[int, list[int]] = defaultdict(list)
    for index in range(len(rows)):
        groups[find(index)].append(index)
    return [sorted(group) for _, group in sorted(groups.items(), key=lambda item: min(item[1]))]


def _has_opposition(
    player_ids: set[int],
    participants: dict[int, dict[str, Any]],
) -> bool:
    ordered = sorted(player_ids)
    for index, left in enumerate(ordered):
        for right in ordered[index + 1:]:
            if _is_enemy(left, right, participants):
                return True
    return False


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


def _pairwise_edges(
    *,
    episode: dict[str, Any],
    action_events: list[dict[str, Any]],
    participants: dict[int, dict[str, Any]],
    controller_ledger: dict[int, list[tuple[int, int, int, str]]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Attach relationship evidence without changing the Skirmish itself."""
    center = episode["center"]
    rows: list[dict[str, Any]] = []
    for event in action_events:
        actor = event.get("actorPlayerId")
        at_ms = event.get("timestampMs")
        point = _point(event)
        action = event.get("sourceActionName")
        if actor not in episode["participantPlayerIds"] or action not in SUPPORTING_ACTIONS:
            continue
        if not isinstance(at_ms, int) or point is None:
            continue
        if not (episode["startedAtMs"] <= at_ms <= episode["endedAtMs"]):
            continue
        if math.hypot(point[0] - center["x"], point[1] - center["y"]) > SKIRMISH_LINK_DISTANCE_TILES:
            continue
        rows.append({
            "atMs": at_ms,
            "operationOrdinal": int(event.get("operationOrdinal") or 0),
            "actorPlayerId": int(actor),
            "x": point[0],
            "y": point[1],
            "action": action,
            "targetInstanceId": event.get("targetInstanceId"),
            "sourceEventId": event.get("eventId"),
        })
    rows.sort(key=lambda row: (row["atMs"], row["operationOrdinal"], row.get("sourceEventId") or ""))

    directed: dict[tuple[int, int], dict[str, Any]] = {}

    def add_edge(
        source: int,
        target: int,
        *,
        at_ms: int,
        method: str,
        source_event_id: str | None,
        action: str | None,
        confidence: str,
    ) -> None:
        if not _is_enemy(source, target, participants):
            return
        key = (source, target)
        edge = directed.setdefault(key, {
            "fromPlayerId": source,
            "toPlayerId": target,
            "firstAtMs": at_ms,
            "lastAtMs": at_ms,
            "evidenceMethods": set(),
            "sourceEventIds": set(),
            "commandTypes": set(),
            "confidence": confidence,
        })
        edge["firstAtMs"] = min(edge["firstAtMs"], at_ms)
        edge["lastAtMs"] = max(edge["lastAtMs"], at_ms)
        edge["evidenceMethods"].add(method)
        if source_event_id:
            edge["sourceEventIds"].add(source_event_id)
        if action:
            edge["commandTypes"].add(action)
        if confidence == "high":
            edge["confidence"] = "high"

    # Later-created target control can strengthen who-fought-whom evidence, but
    # it is deliberately not allowed to create extra Skirmishes.
    for row in rows:
        if row["action"] != "ORDER":
            continue
        resolved = _controller_at(
            controller_ledger,
            row.get("targetInstanceId"),
            at_ms=row["atMs"],
            operation_ordinal=row["operationOrdinal"],
        )
        if resolved is None:
            continue
        target_player, basis = resolved
        if _is_enemy(row["actorPlayerId"], target_player, participants):
            add_edge(
                row["actorPlayerId"],
                target_player,
                at_ms=row["atMs"],
                method=f"targeted_controlled_object:{basis}",
                source_event_id=row.get("sourceEventId"),
                action=row.get("action"),
                confidence="high",
            )

    # Positional pair attribution is tighter than Skirmish formation and never
    # manufactures all-to-all rivalry from multiplayer co-participation.
    for index, left in enumerate(rows):
        for right in rows[index + 1:]:
            dt = right["atMs"] - left["atMs"]
            if dt > PAIR_LINK_GAP_MS:
                break
            left_player = left["actorPlayerId"]
            right_player = right["actorPlayerId"]
            if not _is_enemy(left_player, right_player, participants):
                continue
            distance = math.hypot(left["x"] - right["x"], left["y"] - right["y"])
            if distance > PAIR_LINK_DISTANCE_TILES:
                continue
            add_edge(
                left_player,
                right_player,
                at_ms=left["atMs"],
                method="local_opposition_overlap",
                source_event_id=left.get("sourceEventId"),
                action=left.get("action"),
                confidence="medium",
            )
            add_edge(
                right_player,
                left_player,
                at_ms=right["atMs"],
                method="local_opposition_overlap",
                source_event_id=right.get("sourceEventId"),
                action=right.get("action"),
                confidence="medium",
            )

    directed_rows: list[dict[str, Any]] = []
    for key in sorted(directed):
        edge = directed[key]
        directed_rows.append({
            **edge,
            "evidenceMethods": sorted(edge["evidenceMethods"]),
            "sourceEventIds": sorted(edge["sourceEventIds"]),
            "commandTypes": sorted(edge["commandTypes"]),
        })

    pair_map: dict[tuple[int, int], dict[str, Any]] = {}
    for edge in directed_rows:
        pair = tuple(sorted((edge["fromPlayerId"], edge["toPlayerId"])))
        row = pair_map.setdefault(pair, {
            "playerIds": list(pair),
            "firstAtMs": edge["firstAtMs"],
            "lastAtMs": edge["lastAtMs"],
            "directions": set(),
            "evidenceMethods": set(),
        })
        row["firstAtMs"] = min(row["firstAtMs"], edge["firstAtMs"])
        row["lastAtMs"] = max(row["lastAtMs"], edge["lastAtMs"])
        row["directions"].add(f'{edge["fromPlayerId"]}->{edge["toPlayerId"]}')
        row["evidenceMethods"].update(edge["evidenceMethods"])

    pairs = [
        {
            **pair_map[key],
            "directions": sorted(pair_map[key]["directions"]),
            "evidenceMethods": sorted(pair_map[key]["evidenceMethods"]),
            "mutualHostileEvidence": len(pair_map[key]["directions"]) >= 2,
        }
        for key in sorted(pair_map)
    ]
    return directed_rows, pairs


def detect_skirmishes(
    *,
    manifest: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    participants = _participants(manifest)
    initial_objects = list(initial_objects)
    action_events = list(action_events)
    strong = _strong_observations(
        manifest=manifest,
        initial_objects=initial_objects,
        action_events=action_events,
    )
    controller_ledger = _controller_ledger(initial_objects, action_events)
    episodes: list[dict[str, Any]] = []

    # This block intentionally mirrors AOF_FIGHT_DETECTION_V1 exactly.
    for component in _components(strong):
        seeds = [strong[index] for index in component]
        first = min(row["atMs"] for row in seeds)
        last = max(row["atMs"] for row in seeds)
        center_x = sum(row["x"] for row in seeds) / len(seeds)
        center_y = sum(row["y"] for row in seeds) / len(seeds)
        player_ids = {row["actorPlayerId"] for row in seeds}
        player_ids.update(
            row["targetVictimPlayerId"]
            for row in seeds
            if isinstance(row.get("targetVictimPlayerId"), int)
        )

        support: list[dict[str, Any]] = []
        for event in action_events:
            actor = event.get("actorPlayerId")
            at_ms = event.get("timestampMs")
            action = event.get("sourceActionName")
            point = _point(event)
            if actor not in participants or action not in SUPPORTING_ACTIONS:
                continue
            if not isinstance(at_ms, int) or point is None:
                continue
            if at_ms < first - SKIRMISH_SUPPORT_BEFORE_MS or at_ms > last + SKIRMISH_SUPPORT_AFTER_MS:
                continue
            if math.hypot(point[0] - center_x, point[1] - center_y) > SKIRMISH_LINK_DISTANCE_TILES:
                continue
            support.append({
                "atMs": at_ms,
                "actorPlayerId": int(actor),
                "x": point[0],
                "y": point[1],
                "action": action,
                "sourceEventId": event.get("eventId"),
            })
            player_ids.add(int(actor))

        if not _has_opposition(player_ids, participants):
            continue

        all_points = [(row["x"], row["y"]) for row in seeds] + [
            (row["x"], row["y"]) for row in support
        ]
        center_x = sum(point[0] for point in all_points) / len(all_points)
        center_y = sum(point[1] for point in all_points) / len(all_points)
        started = min([first] + [row["atMs"] for row in support] if support else [first])
        observed_end = max([last] + [row["atMs"] for row in support] if support else [last])
        ended = max(observed_end, started + SKIRMISH_MIN_WINDOW_MS)

        episodes.append({
            "skirmishId": None,
            "startedAtMs": started,
            "endedAtMs": ended,
            "durationMs": ended - started,
            "center": {"x": round(center_x, 2), "y": round(center_y, 2)},
            "participantPlayerIds": sorted(player_ids),
            "contributingPlayerIds": sorted({
                row["actorPlayerId"] for row in seeds + support
            }),
            "sidePlayerIds": _side_groups(player_ids, participants),
            "strongCommandCount": len(seeds),
            "supportingCommandCount": len(support),
            "sourceEventIds": sorted({
                row["sourceEventId"]
                for row in seeds + support
                if row.get("sourceEventId")
            }),
            "modelVersion": SKIRMISH_MODEL_VERSION,
            "compatibilityBasis": SKIRMISH_COMPATIBILITY_BASIS,
        })

    episodes.sort(key=lambda row: (row["startedAtMs"], row["center"]["x"], row["center"]["y"]))
    for index, episode in enumerate(episodes, start=1):
        episode["skirmishId"] = f"skirmish-{index}"
        directed_edges, interaction_pairs = _pairwise_edges(
            episode=episode,
            action_events=action_events,
            participants=participants,
            controller_ledger=controller_ledger,
        )
        episode["directedInteractionEdges"] = directed_edges
        episode["opponentInteractionPairs"] = interaction_pairs

    by_player: dict[str, list[dict[str, Any]]] = {}
    for player_id in sorted(participants):
        by_player[str(player_id)] = [
            episode for episode in episodes if player_id in episode["participantPlayerIds"]
        ]

    return {
        "modelVersion": SKIRMISH_MODEL_VERSION,
        "compatibilityBasis": SKIRMISH_COMPATIBILITY_BASIS,
        "episodes": episodes,
        "byPlayer": by_player,
        "thresholds": {
            "linkGapMs": SKIRMISH_LINK_GAP_MS,
            "linkDistanceTiles": SKIRMISH_LINK_DISTANCE_TILES,
            "supportBeforeMs": SKIRMISH_SUPPORT_BEFORE_MS,
            "supportAfterMs": SKIRMISH_SUPPORT_AFTER_MS,
            "minimumWindowMs": SKIRMISH_MIN_WINDOW_MS,
            "pairLinkGapMs": PAIR_LINK_GAP_MS,
            "pairLinkDistanceTiles": PAIR_LINK_DISTANCE_TILES,
        },
        "scope": (
            "player-facing rename of AOF_FIGHT_DETECTION_V1 with identical episode formation; "
            "targeted initial-object orders, attack-move and attack-ground seed episodes while "
            "nearby movement/order/patrol can support them. Multiplayer pair evidence is attached "
            "after detection and cannot change the Skirmish count. No damage, kill, live-army or "
            "continuous-position claim"
        ),
    }


# Compatibility aliases for internal code still importing the historical names.
detect_fights = detect_skirmishes
FIGHT_MODEL_VERSION = SKIRMISH_MODEL_VERSION
FIGHT_LINK_DISTANCE_TILES = SKIRMISH_LINK_DISTANCE_TILES
