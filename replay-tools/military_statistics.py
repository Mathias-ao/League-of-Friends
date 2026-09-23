"""Player-facing Military statistics from canonical replay-analysis evidence.

Queue requests and building placements are commands, not proof of completed
units/buildings. Military V1 therefore uses queue-derived production proxies and
retains unresolved/unpriced coverage.
"""
from __future__ import annotations

from collections import Counter
from typing import Any

from economy_statistics import ECO_TECH_IDS
from opening_statistics import AGE_TECH_IDS, _latest_research_event, _roles

MILITARY_STATISTICS_VERSION = "AOF_MILITARY_STATISTICS_V2"
CHECKPOINT_CASTLE_CLICK_TECH_ID = AGE_TECH_IDS["castle"]

ECONOMIC_UNIT_ROLES = {
    "villager", "economic_unit", "fishing_ship", "trade_unit"
}
AGE_TECH_ID_SET = set(AGE_TECH_IDS.values())
ECONOMY_BUILDING_ROLES = {
    "economy", "farm", "house", "mill", "lumber_camp", "mining_camp",
    "market", "town_center", "population_production", "naval_economy",
    "mobile_dropoff",
}
NON_MILITARY_UTILITY_TECH_IDS = {8, 280}  # Town Watch / Town Patrol


def _player_events(events: list[dict[str, Any]], player_id: int) -> list[dict[str, Any]]:
    return sorted(
        (event for event in events if event.get("replaySlot") == player_id),
        key=lambda event: (event.get("atMs", 0), str(event.get("sourceEventId") or "")),
    )


def _catalog_item(catalog: dict[str, Any], section: str, raw_id: Any) -> dict[str, Any]:
    return (catalog.get(section) or {}).get(str(raw_id)) or {}


def _entity(catalog: dict[str, Any], section: str, raw_id: Any) -> dict[str, Any]:
    item = _catalog_item(catalog, section, raw_id)
    return {
        "rawId": raw_id,
        "name": item.get("name"),
        "internalName": item.get("internalName"),
        "roleKeys": item.get("roleKeys") or [],
        "resolutionStatus": (
            "reference_catalog_unqualified_for_replay_patch" if item else "unresolved"
        ),
    }


def _building_type(catalog: dict[str, Any], raw_id: Any) -> str | None:
    item = _catalog_item(catalog, "buildings", raw_id)
    name = str(item.get("name") or "")
    internal = str(item.get("internalName") or "")
    roles = set(item.get("roleKeys") or [])

    if "barracks" in roles or name == "Barracks":
        return "barracks"
    if "archery_range" in roles or name == "Archery Range" or internal == "ARRG":
        return "archeryRanges"
    if "stable" in roles or name == "Stable" or internal == "STBL":
        return "stables"
    if internal == "SIWS" or name == "Siege Workshop":
        return "siegeWorkshops"
    if internal == "CRCH" or name == "Monastery":
        return "monasteries"
    if internal == "CSTL" or name == "Castle":
        return "castles"
    if "dock" in roles or internal in {"DOCK", "HARBOR"} or name in {"Dock", "Harbor"}:
        return "docks"
    if internal == "DONJON" or name == "Donjon":
        return "donjons"
    if internal == "KREPOST" or name == "Krepost":
        return "kreposts"
    return None


def _military_class(
    catalog: dict[str, Any], unit_id: Any, producer_building_type_id: Any,
) -> str | None:
    item = _catalog_item(catalog, "units", unit_id)
    roles = set(item.get("roleKeys") or [])
    name = str(item.get("name") or "")
    internal = str(item.get("internalName") or "")
    producer = _building_type(catalog, producer_building_type_id)

    if roles.intersection(ECONOMIC_UNIT_ROLES):
        return None
    if "water_military" in roles:
        return "warships"
    if "transport_ship" in roles:
        return "navalSupport"
    if "monk" in roles or producer == "monasteries":
        return "monks"
    if "infantry" in roles or producer == "barracks":
        return "infantry"
    if roles.intersection({"archer", "skirmisher"}) or producer == "archeryRanges":
        return "archers"
    if "cavalry" in roles or producer == "stables":
        return "cavalry"
    if producer == "siegeWorkshops" or "TREBU" in internal.upper() or "SIEGE" in internal.upper():
        return "siege"
    if producer == "docks":
        # Unknown dock units are not automatically warships: Fishing/Trade/Transport
        # can share the producer. Only catalog-qualified water military is counted.
        return None
    if "land_military" in roles:
        return "otherLandMilitary"
    if producer in {"castles", "donjons", "kreposts"}:
        # Castle/special-building queues are military-like unless the catalog proves
        # an economic role. Keep them separate rather than force infantry/cavalry.
        return "specialMilitary"
    return None


def _is_military_unit(
    catalog: dict[str, Any], unit_id: Any, producer_building_type_id: Any,
) -> bool:
    return _military_class(catalog, unit_id, producer_building_type_id) is not None


def _unit_cost(catalog: dict[str, Any], unit_id: Any) -> float | None:
    item = _catalog_item(catalog, "units", unit_id)
    if not item:
        return None
    cost = item.get("cost") or {}
    if not cost:
        return 0.0
    values = list(cost.values())
    if not all(isinstance(value, (int, float)) for value in values):
        return None
    return float(sum(values))


def _entity_cost(catalog: dict[str, Any], section: str, raw_id: Any) -> float | None:
    item = _catalog_item(catalog, section, raw_id)
    if not item:
        return None
    cost = item.get("cost") or {}
    if not cost:
        return 0.0
    values = list(cost.values())
    if not all(isinstance(value, (int, float)) for value in values):
        return None
    return float(sum(values))


def _is_economy_building(catalog: dict[str, Any], building_id: Any) -> bool:
    item = _catalog_item(catalog, "buildings", building_id)
    roles = set(item.get("roleKeys") or [])
    name = str(item.get("name") or "")
    internal = str(item.get("internalName") or "")
    if roles.intersection(ECONOMY_BUILDING_ROLES):
        return True
    return (
        name in {"Dock", "Harbor", "Feitoria"}
        or internal in {"DOCK", "HARBOR", "FEITO"}
        or internal.startswith("FOLWARK")
    )


def _broad_military_spend(
    *,
    production: list[dict[str, Any]],
    research: list[dict[str, Any]],
    builds: list[dict[str, Any]],
    walls: list[dict[str, Any]],
    catalog: dict[str, Any],
) -> dict[str, Any]:
    units = 0.0
    buildings = 0.0
    technologies = 0.0
    unpriced = 0

    for event in production:
        amount = event.get("requestedAmountPositive")
        if type(amount) is not int or amount <= 0:
            continue
        unit_id = event.get("unitId")
        producer_type = event.get("producerBuildingTypeId")
        if not _is_military_unit(catalog, unit_id, producer_type):
            continue
        cost = _unit_cost(catalog, unit_id)
        if cost is None:
            unpriced += amount
        else:
            units += cost * amount

    for event in builds:
        building_id = event.get("buildingId")
        if _is_economy_building(catalog, building_id):
            continue
        cost = _entity_cost(catalog, "buildings", building_id)
        if cost is None:
            unpriced += 1
        else:
            buildings += cost

    for event in walls:
        building_id = event.get("buildingId")
        if _is_economy_building(catalog, building_id):
            continue
        cost = _entity_cost(catalog, "buildings", building_id)
        if cost is None:
            unpriced += 1
        else:
            buildings += cost

    for event in research:
        tech_id = event.get("technologyId")
        if tech_id in AGE_TECH_ID_SET or tech_id in ECO_TECH_IDS or tech_id in NON_MILITARY_UTILITY_TECH_IDS:
            continue
        cost = _entity_cost(catalog, "technologies", tech_id)
        if cost is None:
            unpriced += 1
        else:
            technologies += cost

    total = units + buildings + technologies
    return {
        "layer": "reconstructed",
        "resources": int(total) if total.is_integer() else round(total, 3),
        "unitQueueResources": int(units) if units.is_integer() else round(units, 3),
        "buildingPlacementResources": int(buildings) if buildings.is_integer() else round(buildings, 3),
        "technologyRequestResources": int(technologies) if technologies.is_integer() else round(technologies, 3),
        "unpricedMilitaryCommandAmount": unpriced,
        "basis": (
            "TownBell-control-compatible broad command-spend partition: positive military unit queues + "
            "non-economic building/wall placements + non-age/non-economic technology requests, using pinned base costs"
        ),
        "note": "Command commitment, not exact engine spend; civilization discounts, refunds and resource availability are not simulated.",
    }


def _military_buildings(
    builds: list[dict[str, Any]],
    catalog: dict[str, Any],
    castle_click_ms: int | None,
) -> dict[str, Any]:
    counts = Counter()
    events = []
    for event in builds:
        kind = _building_type(catalog, event.get("buildingId"))
        if kind not in {
            "barracks", "archeryRanges", "stables", "siegeWorkshops",
            "monasteries", "castles", "donjons", "kreposts",
        }:
            continue
        counts[kind] += 1
        events.append({
            "atMs": event.get("atMs"),
            "type": kind,
            "building": _entity(catalog, "buildings", event.get("buildingId")),
            "sourceEventId": event.get("sourceEventId"),
        })

    first = min(
        (event for event in events if isinstance(event.get("atMs"), int)),
        key=lambda event: event["atMs"],
        default=None,
    )
    before_castle = (
        sum(
            isinstance(event.get("atMs"), int) and event["atMs"] < castle_click_ms
            for event in events
        )
        if castle_click_ms is not None
        else None
    )

    return {
        "layer": "observed",
        "count": len(events),
        "atCastleClick": {
            "layer": "reconstructed",
            "count": before_castle,
            "boundaryMs": castle_click_ms,
            "basis": "military production/monastery/castle placement commands before latest Castle click",
        },
        "first": {
            "atMs": first["atMs"] if first else None,
            "type": first["type"] if first else None,
            "building": first["building"] if first else None,
            "sourceEventId": first["sourceEventId"] if first else None,
        },
        "byType": {
            "barracks": counts["barracks"],
            "archeryRanges": counts["archeryRanges"],
            "stables": counts["stables"],
            "siegeWorkshops": counts["siegeWorkshops"],
            "monasteries": counts["monasteries"],
            "castles": counts["castles"],
            "donjons": counts["donjons"],
            "kreposts": counts["kreposts"],
        },
        "basis": "observed BUILD placement commands; not construction completion or survival",
    }


def project_military_statistics(
    *,
    manifest: dict[str, Any],
    body: dict[str, Any],
    catalog: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    results: dict[str, dict[str, Any]] = {}

    for participant in manifest.get("participants", []):
        player_id = int(participant["playerId"])
        production = _player_events(body.get("productionEvents", []), player_id)
        research = _player_events(body.get("researchEvents", []), player_id)
        builds = _player_events(body.get("buildEvents", []), player_id)
        walls = _player_events(body.get("wallEvents", []), player_id)

        castle_event = _latest_research_event(research, CHECKPOINT_CASTLE_CLICK_TECH_ID)
        castle_click = castle_event.get("atMs") if castle_event else None

        positive_by_unit: Counter[int] = Counter()
        negative_by_unit: Counter[int] = Counter()
        class_counts: Counter[str] = Counter()
        military_events: list[dict[str, Any]] = []
        unknown_amount_commands = 0
        spend = 0.0
        unpriced_amount = 0

        for event in production:
            unit_id = event.get("unitId")
            producer_building_type_id = event.get("producerBuildingTypeId")
            unit_class = _military_class(catalog, unit_id, producer_building_type_id)
            if unit_class is None:
                continue

            amount = event.get("signedAmount")
            if type(amount) is not int:
                unknown_amount_commands += 1
                continue

            military_events.append({
                "atMs": event.get("atMs"),
                "unitId": unit_id,
                "class": unit_class,
                "signedAmount": amount,
                "sourceEventId": event.get("sourceEventId"),
                "producerBuildingTypeId": producer_building_type_id,
                "producerBuildingTypeSource": event.get("producerBuildingTypeSource"),
                "producerObjectIds": list(event.get("producerObjectIds") or []),
            })

            if amount > 0:
                positive_by_unit[int(unit_id)] += amount
                class_counts[unit_class] += amount
                cost = _unit_cost(catalog, unit_id)
                if cost is None:
                    unpriced_amount += amount
                else:
                    spend += cost * amount
            elif amount < 0:
                negative_by_unit[int(unit_id)] += abs(amount)

        first_military = min(
            (
                event for event in military_events
                if event["signedAmount"] > 0 and isinstance(event.get("atMs"), int)
            ),
            key=lambda event: event["atMs"],
            default=None,
        )

        def first_class(unit_class: str) -> int | None:
            return min(
                (
                    event["atMs"] for event in military_events
                    if event["class"] == unit_class
                    and event["signedAmount"] > 0
                    and isinstance(event.get("atMs"), int)
                ),
                default=None,
            )

        total_positive = sum(positive_by_unit.values())
        total_negative = sum(negative_by_unit.values())
        distinct_units = len(positive_by_unit)
        dominant_unit_id = (
            max(positive_by_unit, key=lambda raw_id: (positive_by_unit[raw_id], -raw_id))
            if positive_by_unit else None
        )
        dominant_class = (
            max(class_counts, key=lambda key: (class_counts[key], key))
            if class_counts else None
        )

        unit_rows = [
            {
                "unit": _entity(catalog, "units", raw_id),
                "positiveQueueAmount": amount,
                "negativeQueueAmount": negative_by_unit.get(raw_id, 0),
                "class": next(
                    (
                        event["class"] for event in military_events
                        if event.get("unitId") == raw_id and event.get("signedAmount", 0) > 0
                    ),
                    None,
                ),
                "producerBuildingTypeIds": sorted({
                    event.get("producerBuildingTypeId")
                    for event in military_events
                    if event.get("unitId") == raw_id and event.get("producerBuildingTypeId") is not None
                }),
            }
            for raw_id, amount in sorted(
                positive_by_unit.items(), key=lambda row: (-row[1], row[0])
            )
        ]

        buildings = _military_buildings(builds, catalog, castle_click)
        broad_spend = _broad_military_spend(
            production=production,
            research=research,
            builds=builds,
            walls=walls,
            catalog=catalog,
        )

        results[str(player_id)] = {
            "modelVersion": MILITARY_STATISTICS_VERSION,
            "militaryUnitsTrained": {
                "layer": "reconstructed",
                "count": total_positive if unknown_amount_commands == 0 else None,
                "positiveQueueAmount": total_positive,
                "negativeQueueAmountObserved": total_negative,
                "unknownAmountCommands": unknown_amount_commands,
                "basis": "sum of positive decoded military-unit queue amounts; queue-derived proxy, not observed unit completion",
            },
            "militaryUnitCommitment": {
                "layer": "reconstructed",
                "resources": int(spend) if spend.is_integer() else round(spend, 3),
                "unpricedQueuedUnitAmount": unpriced_amount,
                "basis": "pinned base-catalog military unit cost × positive queue amount only",
            },
            "militarySpend": broad_spend,
            "composition": {
                "layer": "reconstructed",
                "infantry": class_counts["infantry"],
                "archers": class_counts["archers"],
                "cavalry": class_counts["cavalry"],
                "siege": class_counts["siege"],
                "monks": class_counts["monks"],
                "warships": class_counts["warships"],
                "navalSupport": class_counts["navalSupport"],
                "otherLandMilitary": class_counts["otherLandMilitary"],
                "specialMilitary": class_counts["specialMilitary"],
                "dominantClass": dominant_class,
                "dominantUnit": _entity(catalog, "units", dominant_unit_id) if dominant_unit_id is not None else None,
                "productionDiversity": distinct_units,
                "unitRows": unit_rows,
                "basis": "positive queue amounts classified by catalog role and/or decoded producer-building type",
            },
            "firstMilitaryProduction": {
                "layer": "observed",
                "atMs": first_military.get("atMs") if first_military else None,
                "unit": _entity(catalog, "units", first_military.get("unitId")) if first_military else None,
                "class": first_military.get("class") if first_military else None,
                "sourceEventId": first_military.get("sourceEventId") if first_military else None,
                "basis": "first positive military queue request",
            },
            "firstSiege": {
                "layer": "observed",
                "atMs": first_class("siege"),
                "basis": "first positive queue request classified as siege",
            },
            "firstMonk": {
                "layer": "observed",
                "atMs": first_class("monks"),
                "basis": "first positive queue request classified as monk",
            },
            "firstWarship": {
                "layer": "observed",
                "atMs": first_class("warships"),
                "basis": "first positive queue request catalog-qualified as water military",
            },
            "militaryBuildings": buildings,
        }

    return results
