"""Forward Eco inference over Map Presence V2 forward geometry."""
from __future__ import annotations

from collections import Counter
from typing import Any, Iterable

import map_presence as v1
from map_presence_v2 import (
    FORWARD_ENEMY_ADVANTAGE_TILES,
    FORWARD_MAX_ENEMY_DISTANCE_TILES,
    _forward_placement,
)

FORWARD_ECO_RULE_VERSION = "AOF_FORWARD_ECO_V1"
FORWARD_ECO_ROLE_KEYS = {"mining_camp", "lumber_camp", "mill", "town_center"}
FORWARD_ECO_NAMES = {"Mining Camp", "Lumber Camp", "Mill", "Town Center"}


def _is_forward_eco_building(catalog: dict[str, Any], raw_id: Any) -> bool:
    if v1._is_town_center(catalog, raw_id):
        return True
    item = v1._catalog_building(catalog, raw_id)
    roles = set(item.get("roleKeys") or [])
    return bool(roles.intersection(FORWARD_ECO_ROLE_KEYS)) or item.get("name") in FORWARD_ECO_NAMES


def project_forward_eco(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Return per-player forward economic building placements.

    A placement qualifies only when it is a Mining Camp, Lumber Camp, Mill, or
    Town Center and satisfies the exact Map Presence V2 Forward Building geometry.
    """
    initial_objects = list(initial_objects)
    build_events = list(build_events)
    participants = v1._participants(manifest)
    anchors = v1._home_anchors(manifest, catalog, initial_objects)

    result: dict[str, dict[str, Any]] = {}
    for player_id in sorted(participants):
        evidence: list[dict[str, Any]] = []
        counts: Counter[str] = Counter()
        for event in sorted(
            (item for item in build_events if item.get("replaySlot") == player_id),
            key=lambda item: (item.get("atMs", 0), item.get("sourceEventId") or ""),
        ):
            raw_id = event.get("buildingId")
            if not _is_forward_eco_building(catalog, raw_id):
                continue
            point = v1._point_from_build(event)
            at_ms = event.get("atMs")
            if point is None or not isinstance(at_ms, int):
                continue
            forward = _forward_placement(
                player_id,
                point[0],
                point[1],
                participants=participants,
                anchors=anchors,
            )
            if forward is None:
                continue
            entity = v1._building_entity(catalog, raw_id)
            key = entity.get("name") or f"raw:{raw_id}"
            counts[str(key)] += 1
            evidence.append({
                "atMs": at_ms,
                "building": entity,
                "position": {"x": point[0], "y": point[1]},
                **forward,
                "sourceEventId": event.get("sourceEventId"),
            })

        result[str(player_id)] = {
            "ruleVersion": FORWARD_ECO_RULE_VERSION,
            "layer": "inferred",
            "count": len(evidence),
            "firstAtMs": evidence[0]["atMs"] if evidence else None,
            "byBuilding": dict(sorted(counts.items())),
            "eligibleBuildingTypes": sorted(FORWARD_ECO_NAMES),
            "thresholds": {
                "maximumEnemyTownCenterDistanceTiles": FORWARD_MAX_ENEMY_DISTANCE_TILES,
                "minimumEnemyDistanceAdvantageTiles": FORWARD_ENEMY_ADVANTAGE_TILES,
            },
            "evidence": evidence,
            "scope": (
                "Mining Camp, Lumber Camp, Mill, or Town Center placement satisfying "
                "AOF_MAP_PRESENCE_V2 Forward Building geometry; placement is the model "
                "input and completion is not asserted"
            ),
        }
    return result
