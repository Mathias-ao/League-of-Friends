"""Directional raid detection over canonical command evidence.

A raid is an inferred hostile-command episode inside another player's economic
zone. The model never claims damage, kills, unit survival, or continuous unit
positions. Every episode has one identifiable attacker and one identifiable
victim, including FFA and other multi-player matches.
"""
from __future__ import annotations

from collections import defaultdict
import math
from typing import Any, Iterable

RAID_MODEL_VERSION = "AOF_RAID_DETECTION_V1"
RAID_EPISODE_GAP_MS = 60_000
VICTIM_AMBIGUITY_MARGIN_TILES = 2.0

# Economic zones are intentionally local. They describe the area around known
# economic infrastructure, not ownership/control of all surrounding terrain.
TOWN_CENTER_ZONE_RADIUS_TILES = 14.0
ECONOMIC_BUILDING_ZONE_RADIUS_TILES = 10.0
FARM_ZONE_RADIUS_TILES = 6.0

ECONOMIC_ROLE_KEYS = {
    "town_center",
    "economy",
    "farm",
    "lumber_camp",
    "mining_camp",
    "mill",
    "market",
    "mobile_dropoff",
    "population_production",
}

OBSERVED_RAID_ACTIONS = {
    "MOVE",
    "ORDER",
    "PATROL",
    "DE_ATTACK_MOVE",
    "ATTACK_GROUND",
}
STRONG_POSITIONAL_ACTIONS = {"DE_ATTACK_MOVE", "ATTACK_GROUND"}
SUPPORTING_POSITIONAL_ACTIONS = {"MOVE", "PATROL", "ORDER"}


def _participant_by_id(manifest: dict[str, Any]) -> dict[int, dict[str, Any]]:
    return {int(player["playerId"]): player for player in manifest.get("participants", [])}


def _is_same_team(left: dict[str, Any], right: dict[str, Any]) -> bool:
    a, b = left.get("lobbyTeamId"), right.get("lobbyTeamId")
    return isinstance(a, int) and isinstance(b, int) and a > 0 and a == b


def _catalog_building(catalog: dict[str, Any], raw_id: Any) -> dict[str, Any] | None:
    try:
        key = str(int(raw_id))
    except (TypeError, ValueError):
        return None
    item = (catalog.get("buildings") or {}).get(key)
    return item if isinstance(item, dict) else None


def _is_economic_building(catalog: dict[str, Any], raw_id: Any) -> bool:
    item = _catalog_building(catalog, raw_id)
    if not item:
        return False
    roles = set(item.get("roleKeys") or [])
    return bool(roles & ECONOMIC_ROLE_KEYS)


def _zone_radius(catalog: dict[str, Any], raw_id: Any) -> float:
    item = _catalog_building(catalog, raw_id) or {}
    roles = set(item.get("roleKeys") or [])
    if "town_center" in roles:
        return TOWN_CENTER_ZONE_RADIUS_TILES
    if "farm" in roles:
        return FARM_ZONE_RADIUS_TILES
    return ECONOMIC_BUILDING_ZONE_RADIUS_TILES


def build_economic_zones(
    *, manifest: dict[str, Any], catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]], build_events: Iterable[dict[str, Any]],
) -> tuple[dict[int, list[dict[str, Any]]], dict[int, int]]:
    """Build time-aware economic-zone seeds and initial object ownership.

    Initial economic objects are active from time zero. Later economic building
    placements become active at their placement timestamp. Placement is treated as
    a direct input for this inferred model, consistent with current player-facing
    statistics policy.
    """
    participants = _participant_by_id(manifest)
    zones: dict[int, list[dict[str, Any]]] = defaultdict(list)
    initial_object_owners: dict[int, int] = {}

    for event in initial_objects:
        payload = event.get("payload") or {}
        owner = payload.get("ownerPlayerId")
        raw_id = payload.get("objectId")
        position = event.get("position") or {}
        x, y = position.get("x"), position.get("y")
        instance_id = payload.get("instanceId")
        if isinstance(instance_id, int) and isinstance(owner, int):
            initial_object_owners[instance_id] = owner
        if owner not in participants or not _is_economic_building(catalog, raw_id):
            continue
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            continue
        zones[int(owner)].append({
            "x": float(x),
            "y": float(y),
            "radiusTiles": _zone_radius(catalog, raw_id),
            "activeFromMs": 0,
            "buildingId": raw_id,
            "source": "initial_object",
            "sourceEventId": event.get("eventId"),
        })

    for event in build_events:
        owner = event.get("replaySlot")
        raw_id = event.get("buildingId")
        at_ms = event.get("atMs")
        x, y = event.get("x"), event.get("y")
        if owner not in participants or not _is_economic_building(catalog, raw_id):
            continue
        if not isinstance(at_ms, int) or not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            continue
        zones[int(owner)].append({
            "x": float(x),
            "y": float(y),
            "radiusTiles": _zone_radius(catalog, raw_id),
            "activeFromMs": at_ms,
            "buildingId": raw_id,
            "source": "building_placement",
            "sourceEventId": event.get("sourceEventId"),
        })

    for player_zones in zones.values():
        player_zones.sort(key=lambda zone: (zone["activeFromMs"], zone["x"], zone["y"]))
    return dict(zones), initial_object_owners


def _point(event: dict[str, Any]) -> tuple[float, float] | None:
    position = event.get("position") or {}
    x, y = position.get("x"), position.get("y")
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        return None
    return float(x), float(y)


def _zone_match(zones: list[dict[str, Any]], *, at_ms: int, x: float, y: float) -> tuple[float, dict[str, Any]] | None:
    best: tuple[float, dict[str, Any]] | None = None
    for zone in zones:
        if zone["activeFromMs"] > at_ms:
            continue
        distance = math.hypot(x - zone["x"], y - zone["y"])
        if distance > zone["radiusTiles"]:
            continue
        candidate = (distance, zone)
        if best is None or distance < best[0]:
            best = candidate
    return best


def _resolve_victim(
    *, event: dict[str, Any], attacker: dict[str, Any], participants: dict[int, dict[str, Any]],
    zones: dict[int, list[dict[str, Any]]], initial_object_owners: dict[int, int],
) -> tuple[int, dict[str, Any], float, str] | None:
    at_ms = event.get("timestampMs")
    point = _point(event)
    if not isinstance(at_ms, int) or point is None:
        return None
    x, y = point

    target_instance = event.get("targetInstanceId")
    direct_owner = initial_object_owners.get(target_instance) if isinstance(target_instance, int) else None
    if direct_owner in participants and direct_owner != attacker.get("playerId"):
        victim = participants[direct_owner]
        if not _is_same_team(attacker, victim):
            match = _zone_match(zones.get(direct_owner, []), at_ms=at_ms, x=x, y=y)
            if match is not None:
                distance, zone = match
                return direct_owner, zone, distance, "target_instance_owner"

    matches: list[tuple[float, int, dict[str, Any]]] = []
    for victim_id, victim in participants.items():
        if victim_id == attacker.get("playerId") or _is_same_team(attacker, victim):
            continue
        match = _zone_match(zones.get(victim_id, []), at_ms=at_ms, x=x, y=y)
        if match is not None:
            distance, zone = match
            matches.append((distance, victim_id, zone))
    if not matches:
        return None
    matches.sort(key=lambda item: (item[0], item[1]))
    if len(matches) > 1 and matches[1][0] - matches[0][0] < VICTIM_AMBIGUITY_MARGIN_TILES:
        return None
    distance, victim_id, zone = matches[0]
    return victim_id, zone, distance, "economic_zone_proximity"


def _observation_strength(event: dict[str, Any], victim_id: int, initial_object_owners: dict[int, int]) -> str:
    action = event.get("sourceActionName")
    if action in STRONG_POSITIONAL_ACTIONS:
        return "strong"
    if action == "ORDER":
        target_instance = event.get("targetInstanceId")
        if isinstance(target_instance, int) and initial_object_owners.get(target_instance) == victim_id:
            return "strong"
    if action in SUPPORTING_POSITIONAL_ACTIONS:
        return "supporting"
    return "ignored"


def _episode_from_observations(attacker_id: int, victim_id: int, observations: list[dict[str, Any]]) -> dict[str, Any]:
    strong = [item for item in observations if item["strength"] == "strong"]
    return {
        "attackerPlayerId": attacker_id,
        "victimPlayerId": victim_id,
        "startedAtMs": observations[0]["atMs"],
        "endedAtMs": observations[-1]["atMs"],
        "commandCount": len(observations),
        "strongCommandCount": len(strong),
        "supportingCommandCount": len(observations) - len(strong),
        "sourceEventIds": [item["sourceEventId"] for item in observations if item.get("sourceEventId")],
        "commandTypes": sorted({item["action"] for item in observations}),
        "victimResolutionMethods": sorted({item["victimResolutionMethod"] for item in observations}),
        "minimumDistanceToEconomicSeedTiles": round(min(item["distanceTiles"] for item in observations), 2),
        "modelVersion": RAID_MODEL_VERSION,
    }


def detect_raids(
    *, manifest: dict[str, Any], catalog: dict[str, Any], initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]], action_events: Iterable[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Return directional raid counts and auditable evidence per participant."""
    participants = _participant_by_id(manifest)
    zones, initial_object_owners = build_economic_zones(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=build_events,
    )

    observations_by_pair: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for event in action_events:
        action = event.get("sourceActionName")
        attacker_id = event.get("actorPlayerId")
        if action not in OBSERVED_RAID_ACTIONS or attacker_id not in participants:
            continue
        attacker = participants[int(attacker_id)]
        resolved = _resolve_victim(
            event=event,
            attacker=attacker,
            participants=participants,
            zones=zones,
            initial_object_owners=initial_object_owners,
        )
        if resolved is None:
            continue
        victim_id, zone, distance, resolution_method = resolved
        strength = _observation_strength(event, victim_id, initial_object_owners)
        if strength == "ignored":
            continue
        observations_by_pair[(int(attacker_id), victim_id)].append({
            "atMs": int(event["timestampMs"]),
            "action": action,
            "strength": strength,
            "sourceEventId": event.get("eventId"),
            "distanceTiles": distance,
            "victimResolutionMethod": resolution_method,
            "economicSeed": {
                "buildingId": zone.get("buildingId"),
                "source": zone.get("source"),
                "sourceEventId": zone.get("sourceEventId"),
            },
        })

    episodes: list[dict[str, Any]] = []
    for (attacker_id, victim_id), observations in sorted(observations_by_pair.items()):
        observations.sort(key=lambda item: (item["atMs"], item.get("sourceEventId") or ""))
        current: list[dict[str, Any]] = []
        for observation in observations:
            if current and observation["atMs"] - current[-1]["atMs"] > RAID_EPISODE_GAP_MS:
                if any(item["strength"] == "strong" for item in current):
                    episodes.append(_episode_from_observations(attacker_id, victim_id, current))
                current = []
            current.append(observation)
        if current and any(item["strength"] == "strong" for item in current):
            episodes.append(_episode_from_observations(attacker_id, victim_id, current))

    episodes.sort(key=lambda episode: (
        episode["startedAtMs"], episode["attackerPlayerId"], episode["victimPlayerId"],
    ))
    results: dict[str, dict[str, Any]] = {}
    for player_id in sorted(participants):
        initiated = [episode for episode in episodes if episode["attackerPlayerId"] == player_id]
        received = [episode for episode in episodes if episode["victimPlayerId"] == player_id]
        results[str(player_id)] = {
            "raidsInitiated": len(initiated),
            "raidsAgainstYou": len(received),
            "modelVersion": RAID_MODEL_VERSION,
            "scope": "hostile command episodes inside time-aware economic zones; no kill/damage claim",
            "raidEvidence": {
                "initiatedEpisodes": initiated,
                "receivedEpisodes": received,
            },
        }
    return results
