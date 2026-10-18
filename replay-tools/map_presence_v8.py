"""Map Presence V8: qualified relic targeting, without fabricated possession.

V7 geometry is unchanged. V4-V7 remain reproducible historical models; active
V8 replaces their touch-as-holding inference with command observations.
"""
from __future__ import annotations

from typing import Any, Iterable
import math

import map_presence as v1
import map_presence_v7 as v7

MAP_PRESENCE_MODEL_VERSION = "AOF_MAP_PRESENCE_V8"
STARTING_TC_WITNESS_VERSION = "AOF_STARTING_TOWN_CENTER_SOURCE_V1"
RELIC_EVIDENCE_VERSION = "AOF_RELIC_TARGETING_V1"


def relic_targeting(
    action_events: Iterable[dict[str, Any]],
    initial_objects: Iterable[dict[str, Any]],
    player_ids: set[int],
) -> dict[str, dict[str, Any]]:
    relic_ids = {
        row["instanceId"]
        for row in v1._initial_neutral_objects(initial_objects, v1.RELIC_OBJECT_IDS)
        if isinstance(row.get("instanceId"), int)
    }
    events: dict[str, dict[str, Any]] = {}
    for event in action_events:
        if (event.get("actorPlayerId") not in player_ids
                or event.get("sourceActionName") not in {"ORDER", "SPECIAL"}
                or event.get("targetInstanceId") not in relic_ids):
            continue
        event_id = event.get("eventId")
        at_ms = event.get("timestampMs")
        if not isinstance(event_id, str) or not isinstance(at_ms, int):
            continue
        row = {
            "actorPlayerId": event["actorPlayerId"],
            "atMs": at_ms,
            "operationOrdinal": event.get("operationOrdinal"),
            "relicInstanceId": event["targetInstanceId"],
            "sourceActionName": event["sourceActionName"],
            "sourceEventId": event_id,
            "claim": "RELIC_TARGETING_COMMAND",
            "modelVersion": RELIC_EVIDENCE_VERSION,
        }
        if event_id in events and events[event_id] != row:
            raise ValueError("Conflicting relic evidence for source event " + event_id)
        events[event_id] = row
    ordered = sorted(events.values(), key=lambda row: (
        row["atMs"], row["operationOrdinal"] if isinstance(row["operationOrdinal"], int) else -1,
        row["sourceEventId"],
    ))
    result = {}
    for player_id in sorted(player_ids):
        rows = [row for row in ordered if row["actorPlayerId"] == player_id]
        result[str(player_id)] = {
            "layer": "observed_command",
            "modelVersion": RELIC_EVIDENCE_VERSION,
            "uniqueRelicsTouched": len({row["relicInstanceId"] for row in rows}),
            "totalRelicCommands": len(rows),
            "firstTouchAtMs": rows[0]["atMs"] if rows else None,
            "interactionEvidence": rows,
            "transferEvidence": [],
            # Legacy field names remain null for safe downstream compatibility.
            "inferredRelicsHeldAtEnd": None,
            "heldRelicInstanceIdsAtEnd": None,
            "initialClaims": None,
            "relicsStolenFromEnemies": None,
            "relicsLostToEnemies": None,
            "allyTransfersReceived": None,
            "allyTransfersGiven": None,
            "outcomeCoverage": {
                "status": "UNAVAILABLE",
                "reason": "targeting_commands_do_not_prove_pickup_possession_or_transfer",
            },
            "scope": "Commands targeting known initial relic instances; no pickup, possession, theft, loss or deposit claim.",
        }
    return result


def starting_town_centers(initial_objects: Iterable[dict[str, Any]],
                          participant_ids: set[int], catalog: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Preserve each raw starting TC, never substitute V8's rounded centroid.

    The header object search is partial; a singleton is not a completeness proof.
    """
    found = {pid: [] for pid in participant_ids}
    identities = set()
    for event in initial_objects:
        payload = event.get("payload") or {}
        owner, raw_id = payload.get("ownerPlayerId"), payload.get("objectId")
        if type(owner) is not int or owner not in found or not v1._is_town_center(catalog, raw_id):
            continue
        event_id = event.get("eventId")
        instance = payload.get("instanceId")
        pos = event.get("position") or {}
        x, y = pos.get("x"), pos.get("y")
        position_valid = all(type(v) in (int, float) and math.isfinite(v) for v in (x, y))
        key = (owner, event_id)
        if key in identities or (type(instance) is int and (owner, "instance", instance) in identities):
            raise ValueError("duplicate_initial_town_center_identity")
        identities.add(key)
        if type(instance) is int:
            identities.add((owner, "instance", instance))
        found[owner].append({
            "sourceEventId": event_id if isinstance(event_id, str) and event_id else None,
            "objectInstanceId": instance if type(instance) is int and instance >= 0 else None,
            "objectBlockIndex": payload.get("objectBlockIndex"),
            "rawObjectId": raw_id,
            "position": {"x": x, "y": y} if position_valid else None,
            "positionPrecision": "ORIGINAL_DECODED_NO_ROUNDING" if position_valid else "UNAVAILABLE",
        })
    return {str(pid): {
        "modelVersion": STARTING_TC_WITNESS_VERSION,
        "sourceDomain": "RETAINED_HEADER_INITIAL_OBJECTS",
        "coverage": "PARTIAL_HEADER_OBJECT_SEARCH",
        "exhaustiveInitialTcListEstablished": False,
        "observedCount": len(found[pid]),
        "objects": sorted(found[pid], key=lambda o: (o["sourceEventId"] or "",
                    o["objectInstanceId"] if o["objectInstanceId"] is not None else -1)),
    } for pid in sorted(found)}


def project_map_presence(
    *, manifest: dict[str, Any], catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]], build_events: Iterable[dict[str, Any]],
    wall_events: Iterable[dict[str, Any]], action_events: Iterable[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    objects, builds, walls, actions = map(list, (initial_objects, build_events, wall_events, action_events))
    result = v7.project_map_presence(
        manifest=manifest, catalog=catalog, initial_objects=objects,
        build_events=builds, wall_events=walls, action_events=actions,
    )
    ids = set(v1._participants(manifest))
    relics = relic_targeting(actions, objects, ids)
    tc_sources = starting_town_centers(objects, ids, catalog)
    # Unlike legacy 'forwardBuildings', this includes every observed Castle BUILD
    # request. Source coverage is limited to decoded commands, not completions.
    castles = {str(pid): [] for pid in ids}
    for event in builds:
        pid = event.get("replaySlot")
        if pid not in ids or event.get("buildingId") != 82:
            continue
        x, y = event.get("x"), event.get("y")
        if (type(x) not in (int, float) or type(y) not in (int, float)
                or not math.isfinite(x) or not math.isfinite(y)):
            continue
        castles[str(pid)].append({
            "sourceEventId": event.get("sourceEventId"),
            "atMs": event.get("atMs"),
            "position": {"x": x, "y": y},
            "building": {"rawId": 82},
        })
    for player_id, row in result.items():
        row["modelVersion"] = MAP_PRESENCE_MODEL_VERSION
        row["relicControl"] = relics[player_id]
        row["startingTownCenters"] = tc_sources[player_id]
        row["castlePlacementCommands"] = {"modelVersion": "AOF_CASTLE_BUILD_COMMAND_SOURCE_V1",
                                           "evidence": castles[player_id]}
    return result
