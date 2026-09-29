"""Economy V5 season-showcase extensions over the locked V4 model.

V5 deliberately leaves V4 calculations untouched and adds only metrics requested
for longitudinal player-facing statistics. Queue and placement evidence remains
request/command evidence rather than proof of completion or survival.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any

import economy_statistics as v4

ECONOMY_STATISTICS_VERSION = "AOF_ECONOMY_STATISTICS_V5"
CHECKPOINT_10_MIN_MS = 10 * 60_000
TRADE_UNIT_ROLE = "trade_unit"


def _villagers_by_10_minutes(
    production: list[dict[str, Any]], *, starting_villagers: int,
) -> dict[str, Any]:
    positive = 0
    negative = 0
    unknown = 0
    for event in production:
        if event.get("unitId") != 83:
            continue
        at_ms = event.get("atMs")
        if not isinstance(at_ms, int) or at_ms > CHECKPOINT_10_MIN_MS:
            continue
        amount = event.get("signedAmount")
        if type(amount) is not int:
            unknown += 1
        elif amount > 0:
            positive += amount
        elif amount < 0:
            negative += abs(amount)
    return {
        "layer": "reconstructed",
        "count": starting_villagers + positive - negative if unknown == 0 else None,
        "boundaryMs": CHECKPOINT_10_MIN_MS,
        "startingVillagers": starting_villagers,
        "positiveQueueAmountThrough10m": positive,
        "negativeQueueAmountThrough10m": negative,
        "unknownAmountCommands": unknown,
        "basis": (
            "qualified starting Villager count + net decoded Villager queue amount through 10:00; "
            "queue requests do not prove unit completion or survival"
        ),
    }


def _first_camp(
    builds: list[dict[str, Any]], catalog: dict[str, Any], kind: str,
) -> dict[str, Any]:
    rows = [
        event for event in builds
        if v4._economy_building_type(catalog, event.get("buildingId")) == kind
        and isinstance(event.get("atMs"), int)
    ]
    first = rows[0] if rows else None
    label = "Mining Camp" if kind == "miningCamps" else "Lumber Camp"
    return {
        "layer": "observed",
        "atMs": first.get("atMs") if first else None,
        "building": (
            v4._entity(catalog, "buildings", first.get("buildingId")) if first else None
        ),
        "sourceEventId": first.get("sourceEventId") if first else None,
        "basis": f"first observed {label} BUILD placement command; completion is not asserted",
    }


def _is_house(catalog: dict[str, Any], raw_id: Any) -> bool:
    item = v4._catalog_item(catalog, "buildings", raw_id)
    return item.get("name") == "House" or "house" in set(item.get("roleKeys") or [])


def _houses_built(builds: list[dict[str, Any]], catalog: dict[str, Any]) -> dict[str, Any]:
    rows = [event for event in builds if _is_house(catalog, event.get("buildingId"))]
    return {
        "layer": "observed",
        "count": len(rows),
        "firstAtMs": min(
            (event["atMs"] for event in rows if isinstance(event.get("atMs"), int)),
            default=None,
        ),
        "basis": "observed House BUILD placement commands; completed/surviving houses are not asserted",
    }


def _trade_units_trained(
    production: list[dict[str, Any]], catalog: dict[str, Any],
) -> dict[str, Any]:
    positive = 0
    negative = 0
    unknown = 0
    by_unit: dict[int, dict[str, Any]] = defaultdict(
        lambda: {"positiveQueueAmount": 0, "negativeQueueAmount": 0, "unknownAmountCommands": 0}
    )
    for event in production:
        unit_id = event.get("unitId")
        item = v4._catalog_item(catalog, "units", unit_id)
        if TRADE_UNIT_ROLE not in set(item.get("roleKeys") or []):
            continue
        try:
            raw_id = int(unit_id)
        except (TypeError, ValueError):
            continue
        amount = event.get("signedAmount")
        row = by_unit[raw_id]
        if type(amount) is not int:
            unknown += 1
            row["unknownAmountCommands"] += 1
        elif amount > 0:
            positive += amount
            row["positiveQueueAmount"] += amount
        elif amount < 0:
            negative += abs(amount)
            row["negativeQueueAmount"] += abs(amount)

    unit_rows = [
        {
            "unit": v4._entity(catalog, "units", raw_id),
            **values,
        }
        for raw_id, values in sorted(by_unit.items())
    ]
    return {
        "layer": "reconstructed",
        "count": positive if unknown == 0 else None,
        "positiveQueueAmount": positive,
        "negativeQueueAmountObserved": negative,
        "unknownAmountCommands": unknown,
        "byUnit": unit_rows,
        "basis": (
            "sum of positive decoded queues for catalog-qualified trade units; "
            "queue-derived proxy, not observed unit completion or survival"
        ),
        "seasonEligibility": "team_battles_only",
    }


def _decoded_tribute_amount(event: dict[str, Any]) -> float | None:
    amount = event.get("amount")
    if isinstance(amount, (int, float)) and not isinstance(amount, bool) and amount >= 0:
        return float(amount)

    component_values: list[float] = []
    saw_component = False
    for key in ("food", "wood", "gold", "stone"):
        value = event.get(key)
        if value is None:
            continue
        saw_component = True
        if not isinstance(value, (int, float)) or isinstance(value, bool) or value < 0:
            return None
        component_values.append(float(value))
    return sum(component_values) if saw_component else None


def _tribute_metric(
    events: list[dict[str, Any]], *, direction: str, player_id: int,
) -> dict[str, Any]:
    if direction == "sent":
        rows = [event for event in events if event.get("replaySlot") == player_id]
        counterpart_key = "targetReplaySlot"
    else:
        rows = [event for event in events if event.get("targetReplaySlot") == player_id]
        counterpart_key = "replaySlot"

    known_total = 0.0
    unknown = 0
    by_counterpart: dict[int, float] = defaultdict(float)
    evidence: list[dict[str, Any]] = []
    for event in rows:
        amount = _decoded_tribute_amount(event)
        counterpart = event.get(counterpart_key)
        if amount is None:
            unknown += 1
        else:
            known_total += amount
            if isinstance(counterpart, int):
                by_counterpart[counterpart] += amount
        evidence.append({
            "atMs": event.get("atMs"),
            "counterpartPlayerId": counterpart,
            "resourceId": event.get("resourceId"),
            "decodedResourceAmount": amount,
            "fee": event.get("fee"),
            "sourceEventId": event.get("sourceEventId"),
        })

    normalized_known = int(known_total) if known_total.is_integer() else round(known_total, 3)
    total = normalized_known if unknown == 0 else None
    return {
        "layer": "observed",
        "resourceAmount": total,
        "decodedKnownResourceAmount": normalized_known,
        "commandCount": len(rows),
        "unknownAmountCommands": unknown,
        "byCounterpart": {
            str(key): int(value) if value.is_integer() else round(value, 3)
            for key, value in sorted(by_counterpart.items())
        },
        "evidence": evidence,
        "basis": (
            "decoded TRIBUTE/DE_TRIBUTE command resource amounts; when a DE amount is unavailable, "
            "decoded legacy food/wood/gold/stone components are summed. Fees/tax effects are not simulated"
        ),
        "seasonEligibility": "team_battles_only",
    }


def project_economy_statistics(
    *,
    manifest: dict[str, Any],
    body: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: list[dict[str, Any]],
    action_events: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    results = v4.project_economy_statistics(
        manifest=manifest,
        body=body,
        catalog=catalog,
        initial_objects=initial_objects,
        action_events=action_events,
    )
    tribute_events = list(body.get("tributeEvents", []))

    participants = {int(row["playerId"]): row for row in manifest.get("participants", [])}
    for player_id, participant in participants.items():
        production = v4._player_events(body.get("productionEvents", []), player_id)
        builds = v4._player_events(body.get("buildEvents", []), player_id)
        starting = v4._starting_villager_state(
            player_id=player_id,
            participant=participant,
            manifest=manifest,
            initial_objects=initial_objects,
            catalog=catalog,
        )
        row = results[str(player_id)]
        row["modelVersion"] = ECONOMY_STATISTICS_VERSION
        row["villagersBy10Minutes"] = _villagers_by_10_minutes(
            production,
            starting_villagers=starting["villagersUsed"],
        )
        row["firstMiningCamp"] = _first_camp(builds, catalog, "miningCamps")
        row["firstLumberCamp"] = _first_camp(builds, catalog, "lumberCamps")
        row["housesBuilt"] = _houses_built(builds, catalog)
        row["tradeUnitsTrained"] = _trade_units_trained(production, catalog)
        row["tributeSent"] = _tribute_metric(
            tribute_events, direction="sent", player_id=player_id,
        )
        row["tributeReceived"] = _tribute_metric(
            tribute_events, direction="received", player_id=player_id,
        )
    return results
