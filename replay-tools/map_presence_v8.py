"""Map Presence V8: qualified relic targeting, without fabricated possession.

V7 geometry is unchanged. V4-V7 remain reproducible historical models; active
V8 replaces their touch-as-holding inference with command observations.
"""
from __future__ import annotations

from typing import Any, Iterable

import map_presence as v1
import map_presence_v7 as v7

MAP_PRESENCE_MODEL_VERSION = "AOF_MAP_PRESENCE_V8"
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
    relics = relic_targeting(actions, objects, set(v1._participants(manifest)))
    for player_id, row in result.items():
        row["modelVersion"] = MAP_PRESENCE_MODEL_VERSION
        row["relicControl"] = relics[player_id]
    return result
