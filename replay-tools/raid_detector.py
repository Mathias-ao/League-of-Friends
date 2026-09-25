"""Directional raid detection over canonical command evidence.

A raid is inferred hostile pressure against another player's economy. V2 keeps
land economic geography deliberately local: only Town Centers, Mills/Folwarks,
Lumber Camps, and Mining Camps create economic zones. Direct targeting of a
known Villager, Fishing Ship, Trade Cart, or Trade Cog is also strong raid
evidence, including away from those land zones.

The model never claims damage, kills, unit survival, or continuous unit
positions. Every episode has one identifiable attacker and one identifiable
victim.
"""
from __future__ import annotations

from collections import defaultdict
import math
from typing import Any, Iterable

RAID_MODEL_VERSION = "AOF_RAID_DETECTION_V2"
RAID_EPISODE_GAP_MS = 60_000
VICTIM_AMBIGUITY_MARGIN_TILES = 2.0

# Economic zones are local camp zones rather than broad territory claims.
TOWN_CENTER_ZONE_RADIUS_TILES = 14.0
ECONOMIC_CAMP_ZONE_RADIUS_TILES = 10.0
ECONOMIC_ZONE_ROLE_KEYS = {
    "town_center",
    "mill",
    "lumber_camp",
    "mining_camp",
}

# These are the economic units the V1 product definition explicitly treats as
# strong raid targets. The catalog roles let upgraded/variant IDs participate
# without hard-coding only one raw object ID.
RAID_ECONOMIC_UNIT_ROLES = {
    "villager",
    "fishing_ship",
    "trade_unit",
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


def _catalog_item(catalog: dict[str, Any], section: str, raw_id: Any) -> dict[str, Any] | None:
    try:
        key = str(int(raw_id))
    except (TypeError, ValueError):
        return None
    item = (catalog.get(section) or {}).get(key)
    return item if isinstance(item, dict) else None


def _is_economic_zone_building(catalog: dict[str, Any], raw_id: Any) -> bool:
    item = _catalog_item(catalog, "buildings", raw_id)
    if not item:
        return False
    return bool(set(item.get("roleKeys") or []) & ECONOMIC_ZONE_ROLE_KEYS)


def _zone_radius(catalog: dict[str, Any], raw_id: Any) -> float:
    item = _catalog_item(catalog, "buildings", raw_id) or {}
    roles = set(item.get("roleKeys") or [])
    if "town_center" in roles:
        return TOWN_CENTER_ZONE_RADIUS_TILES
    return ECONOMIC_CAMP_ZONE_RADIUS_TILES


def _economic_target_type(catalog: dict[str, Any], raw_id: Any) -> str | None:
    item = _catalog_item(catalog, "units", raw_id)
    if not item:
        return None
    roles = set(item.get("roleKeys") or [])
    if not (roles & RAID_ECONOMIC_UNIT_ROLES):
        return None
    if "villager" in roles:
        return "villager"
    if "fishing_ship" in roles:
        return "fishing_ship"
    if "trade_unit" in roles:
        name = str(item.get("name") or "").lower()
        if "cog" in name:
            return "trade_cog"
        if "cart" in name:
            return "trade_cart"
        return "trade_unit"
    return None


def _initial_instance_info(
    initial_objects: Iterable[dict[str, Any]],
    catalog: dict[str, Any],
) -> dict[int, dict[str, Any]]:
    result: dict[int, dict[str, Any]] = {}
    for event in initial_objects:
        payload = event.get("payload") or {}
        instance_id = payload.get("instanceId")
        owner = payload.get("ownerPlayerId")
        raw_id = payload.get("objectId")
        if not isinstance(instance_id, int) or not isinstance(owner, int):
            continue
        result[instance_id] = {
            "ownerPlayerId": owner,
            "rawId": raw_id,
            "economicTargetType": _economic_target_type(catalog, raw_id),
        }
    return result


def build_economic_zones(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
) -> tuple[dict[int, list[dict[str, Any]]], dict[int, int]]:
    """Build time-aware local economic zones and initial object ownership.

    Initial qualifying buildings are active from time zero. Later qualifying
    placements become active at placement time. Placement remains evidence for
    an inferred zone; it does not assert completed construction.

    Only Town Centers, Mills/Folwarks, Lumber Camps, and Mining Camps create
    zones. Farms, Markets, Docks, houses, and generic economy-role buildings do
    not create raid zones in this model.
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
        if owner not in participants or not _is_economic_zone_building(catalog, raw_id):
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
        if owner not in participants or not _is_economic_zone_building(catalog, raw_id):
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


def _zone_match(
    zones: list[dict[str, Any]],
    *,
    at_ms: int,
    x: float,
    y: float,
) -> tuple[float, dict[str, Any]] | None:
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
    *,
    event: dict[str, Any],
    attacker: dict[str, Any],
    participants: dict[int, dict[str, Any]],
    zones: dict[int, list[dict[str, Any]]],
    initial_instance_info: dict[int, dict[str, Any]],
) -> tuple[int, dict[str, Any] | None, float | None, str, str | None] | None:
    at_ms = event.get("timestampMs")
    point = _point(event)
    if not isinstance(at_ms, int):
        return None

    target_instance = event.get("targetInstanceId")
    target_info = initial_instance_info.get(target_instance) if isinstance(target_instance, int) else None
    direct_owner = target_info.get("ownerPlayerId") if target_info else None
    target_type = target_info.get("economicTargetType") if target_info else None

    # Direct targeting of a known economic unit is strong raid evidence even
    # away from a land economic camp (notably Fishing Ships and trade units).
    if (
        event.get("sourceActionName") == "ORDER"
        and direct_owner in participants
        and direct_owner != attacker.get("playerId")
        and target_type is not None
    ):
        victim = participants[int(direct_owner)]
        if not _is_same_team(attacker, victim):
            zone = None
            distance = None
            if point is not None:
                match = _zone_match(zones.get(int(direct_owner), []), at_ms=at_ms, x=point[0], y=point[1])
                if match is not None:
                    distance, zone = match
            return int(direct_owner), zone, distance, "economic_target_instance", str(target_type)

    # Other direct hostile targets still require economic-zone context.
    if point is not None and direct_owner in participants and direct_owner != attacker.get("playerId"):
        victim = participants[int(direct_owner)]
        if not _is_same_team(attacker, victim):
            match = _zone_match(zones.get(int(direct_owner), []), at_ms=at_ms, x=point[0], y=point[1])
            if match is not None:
                distance, zone = match
                return int(direct_owner), zone, distance, "target_instance_owner", None

    if point is None:
        return None

    matches: list[tuple[float, int, dict[str, Any]]] = []
    for victim_id, victim in participants.items():
        if victim_id == attacker.get("playerId") or _is_same_team(attacker, victim):
            continue
        match = _zone_match(zones.get(victim_id, []), at_ms=at_ms, x=point[0], y=point[1])
        if match is not None:
            distance, zone = match
            matches.append((distance, victim_id, zone))
    if not matches:
        return None
    matches.sort(key=lambda item: (item[0], item[1]))
    if len(matches) > 1 and matches[1][0] - matches[0][0] < VICTIM_AMBIGUITY_MARGIN_TILES:
        return None
    distance, victim_id, zone = matches[0]
    return victim_id, zone, distance, "economic_zone_proximity", None


def _observation_strength(
    event: dict[str, Any],
    victim_id: int,
    initial_object_owners: dict[int, int],
    economic_target_type: str | None,
) -> str:
    action = event.get("sourceActionName")
    if action == "ORDER" and economic_target_type is not None:
        return "strong"
    if action in STRONG_POSITIONAL_ACTIONS:
        return "strong"
    if action == "ORDER":
        target_instance = event.get("targetInstanceId")
        if isinstance(target_instance, int) and initial_object_owners.get(target_instance) == victim_id:
            return "strong"
    if action in SUPPORTING_POSITIONAL_ACTIONS:
        return "supporting"
    return "ignored"


def _episode_from_observations(
    attacker_id: int,
    victim_id: int,
    observations: list[dict[str, Any]],
) -> dict[str, Any]:
    strong = [item for item in observations if item["strength"] == "strong"]
    points = [
        (item["x"], item["y"])
        for item in observations
        if isinstance(item.get("x"), (int, float)) and isinstance(item.get("y"), (int, float))
    ]
    distances = [
        item["distanceTiles"]
        for item in observations
        if isinstance(item.get("distanceTiles"), (int, float))
    ]
    economic_targets = [
        item["economicTargetType"]
        for item in observations
        if item.get("economicTargetType") is not None
    ]
    return {
        "raidId": None,
        "attackerPlayerId": attacker_id,
        "victimPlayerId": victim_id,
        "startedAtMs": observations[0]["atMs"],
        "endedAtMs": observations[-1]["atMs"],
        "center": (
            {
                "x": round(sum(point[0] for point in points) / len(points), 2),
                "y": round(sum(point[1] for point in points) / len(points), 2),
            }
            if points else None
        ),
        "commandCount": len(observations),
        "strongCommandCount": len(strong),
        "supportingCommandCount": len(observations) - len(strong),
        "insideEconomicZoneCommandCount": sum(item.get("economicSeed") is not None for item in observations),
        "economicTargetCommandCount": len(economic_targets),
        "economicTargetTypes": sorted(set(economic_targets)),
        "sourceEventIds": [
            item["sourceEventId"] for item in observations if item.get("sourceEventId")
        ],
        "commandTypes": sorted({item["action"] for item in observations}),
        "victimResolutionMethods": sorted({item["victimResolutionMethod"] for item in observations}),
        "minimumDistanceToEconomicSeedTiles": round(min(distances), 2) if distances else None,
        "modelVersion": RAID_MODEL_VERSION,
    }


def detect_raids(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Return directional raid counts and auditable evidence per participant."""
    participants = _participant_by_id(manifest)
    initial_objects = list(initial_objects)
    zones, initial_object_owners = build_economic_zones(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=build_events,
    )
    initial_instance_info = _initial_instance_info(initial_objects, catalog)

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
            initial_instance_info=initial_instance_info,
        )
        if resolved is None:
            continue
        victim_id, zone, distance, resolution_method, economic_target_type = resolved
        strength = _observation_strength(
            event,
            victim_id,
            initial_object_owners,
            economic_target_type,
        )
        if strength == "ignored":
            continue
        point = _point(event)
        observations_by_pair[(int(attacker_id), victim_id)].append({
            "atMs": int(event["timestampMs"]),
            "action": action,
            "strength": strength,
            "sourceEventId": event.get("eventId"),
            "x": point[0] if point is not None else None,
            "y": point[1] if point is not None else None,
            "distanceTiles": distance,
            "victimResolutionMethod": resolution_method,
            "economicTargetType": economic_target_type,
            "economicSeed": (
                {
                    "buildingId": zone.get("buildingId"),
                    "source": zone.get("source"),
                    "sourceEventId": zone.get("sourceEventId"),
                }
                if zone is not None else None
            ),
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
        episode["startedAtMs"],
        episode["attackerPlayerId"],
        episode["victimPlayerId"],
    ))
    for index, episode in enumerate(episodes, start=1):
        episode["raidId"] = f"raid-{index}"

    results: dict[str, dict[str, Any]] = {}
    for player_id in sorted(participants):
        initiated = [episode for episode in episodes if episode["attackerPlayerId"] == player_id]
        received = [episode for episode in episodes if episode["victimPlayerId"] == player_id]
        results[str(player_id)] = {
            "raidsInitiated": len(initiated),
            "raidsAgainstYou": len(received),
            "modelVersion": RAID_MODEL_VERSION,
            "scope": (
                "hostile command episodes in local TC/Mill/Lumber/Mining economic zones "
                "or direct targeting of known Villagers/Fishing Ships/Trade Carts/Trade Cogs; "
                "no kill/damage claim"
            ),
            "raidEvidence": {
                "initiatedEpisodes": initiated,
                "receivedEpisodes": received,
            },
        }
    return results
