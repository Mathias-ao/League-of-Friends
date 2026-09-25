"""Command-derived fight episode detection for Execution V1.

This model detects spatial-temporal hostile command episodes. It does not claim
damage, deaths, unit survival, actual pathing, or engine combat resolution.
"""
from __future__ import annotations

from collections import defaultdict
import math
from typing import Any, Iterable

FIGHT_MODEL_VERSION = "AOF_FIGHT_DETECTION_V1"
FIGHT_LINK_GAP_MS = 20_000
FIGHT_LINK_DISTANCE_TILES = 20.0
FIGHT_SUPPORT_BEFORE_MS = 4_000
FIGHT_SUPPORT_AFTER_MS = 8_000
FIGHT_MIN_WINDOW_MS = 5_000

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
            if dt > FIGHT_LINK_GAP_MS:
                break
            distance = math.hypot(
                rows[right]["x"] - rows[left]["x"],
                rows[right]["y"] - rows[left]["y"],
            )
            if distance <= FIGHT_LINK_DISTANCE_TILES:
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


def detect_fights(
    *,
    manifest: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    participants = _participants(manifest)
    action_events = list(action_events)
    strong = _strong_observations(
        manifest=manifest,
        initial_objects=initial_objects,
        action_events=action_events,
    )
    episodes: list[dict[str, Any]] = []

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
            if at_ms < first - FIGHT_SUPPORT_BEFORE_MS or at_ms > last + FIGHT_SUPPORT_AFTER_MS:
                continue
            if math.hypot(point[0] - center_x, point[1] - center_y) > FIGHT_LINK_DISTANCE_TILES:
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
        ended = max(observed_end, started + FIGHT_MIN_WINDOW_MS)

        episodes.append({
            "fightId": None,
            "startedAtMs": started,
            "endedAtMs": ended,
            "durationMs": ended - started,
            "center": {"x": round(center_x, 2), "y": round(center_y, 2)},
            "participantPlayerIds": sorted(player_ids),
            "strongCommandCount": len(seeds),
            "supportingCommandCount": len(support),
            "sourceEventIds": sorted({
                row["sourceEventId"]
                for row in seeds + support
                if row.get("sourceEventId")
            }),
            "modelVersion": FIGHT_MODEL_VERSION,
        })

    episodes.sort(key=lambda row: (row["startedAtMs"], row["center"]["x"], row["center"]["y"]))
    for index, episode in enumerate(episodes, start=1):
        episode["fightId"] = f"fight-{index}"

    by_player: dict[str, list[dict[str, Any]]] = {}
    for player_id in sorted(participants):
        by_player[str(player_id)] = [
            episode for episode in episodes if player_id in episode["participantPlayerIds"]
        ]

    return {
        "modelVersion": FIGHT_MODEL_VERSION,
        "episodes": episodes,
        "byPlayer": by_player,
        "thresholds": {
            "linkGapMs": FIGHT_LINK_GAP_MS,
            "linkDistanceTiles": FIGHT_LINK_DISTANCE_TILES,
            "supportBeforeMs": FIGHT_SUPPORT_BEFORE_MS,
            "supportAfterMs": FIGHT_SUPPORT_AFTER_MS,
            "minimumWindowMs": FIGHT_MIN_WINDOW_MS,
        },
        "scope": (
            "spatial-temporal hostile command episodes; targeted initial-object orders, "
            "attack-move and attack-ground seed episodes while nearby movement/order/patrol "
            "can support them; no damage, kill, live-army or continuous-position claim"
        ),
    }
