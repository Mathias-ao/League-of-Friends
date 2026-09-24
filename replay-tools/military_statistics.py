"""Player-facing Military statistics from canonical replay-analysis evidence.

Queue requests and building placements are commands, not proof of completed
units/buildings. Military V3 therefore uses queue-derived production proxies and
retains unresolved/unpriced coverage.
"""
from __future__ import annotations

from collections import Counter
from typing import Any

from economy_statistics import ECO_TECH_IDS
from opening_statistics import AGE_TECH_IDS, _latest_research_event, _line_tiles, _roles

MILITARY_STATISTICS_VERSION = "AOF_MILITARY_STATISTICS_V3"
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

# Source-pinned DE raw unit IDs (SiegeEngineers/aoe2techtree commit
# 3bb43b1439eef88dfe7fe892d7f7dc41ac9dd76f). These are the three
# conventional zero-gold "trash" lines requested for the player-facing metric.
TRASH_UNIT_LINES = {
    "spearLine": {93, 358, 359},
    "skirmisherLine": {7, 6, 1155},
    "lightCavalryLine": {448, 546, 441, 1707},
}
TRASH_UNIT_IDS = set().union(*TRASH_UNIT_LINES.values())

BLACKSMITH_TECH_IDS = {
    67, 68, 75,                 # infantry/cavalry melee attack
    199, 200, 201,              # ranged attack/range
    74, 76, 77,                 # infantry armor
    211, 212, 219,              # archer armor
    81, 82, 80,                 # cavalry armor
}
UNIVERSITY_TECH_IDS = {
    47, 50, 51, 54, 63, 64, 93, 140, 194, 322, 377, 380, 608,
}
BALLISTICS_TECH_ID = 93
CHEMISTRY_TECH_ID = 47
BLACKSMITH_BUILDING_ID = 103
UNIVERSITY_BUILDING_ID = 209
ARMY_COMMITMENT_CHECKPOINTS = {
    "at10Minutes": 10 * 60 * 1000,
    "at15Minutes": 15 * 60 * 1000,
    "at20Minutes": 20 * 60 * 1000,
}


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
        tiles = len(set(_line_tiles(
            event.get("x"), event.get("y"), event.get("xEnd"), event.get("yEnd"),
        )))
        if tiles <= 0:
            continue
        cost = _entity_cost(catalog, "buildings", building_id)
        if cost is None:
            unpriced += tiles
        else:
            buildings += cost * tiles

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



def _latest_research_by_id(
    research: list[dict[str, Any]], tech_id: int,
) -> dict[str, Any] | None:
    return _latest_research_event(research, tech_id)


def _technology_group(
    *,
    research: list[dict[str, Any]],
    tech_ids: set[int],
    catalog: dict[str, Any],
    basis: str,
) -> dict[str, Any]:
    first_requests: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    for tech_id in sorted(tech_ids):
        matching = [
            event for event in research
            if event.get("technologyId") == tech_id and isinstance(event.get("atMs"), int)
        ]
        if not matching:
            continue
        first = matching[0]
        latest = matching[-1]
        first_requests.append(first)
        rows.append({
            "technology": _entity(catalog, "technologies", tech_id),
            "firstRequestedAtMs": first["atMs"],
            "latestRequestedAtMs": latest["atMs"],
            "requestCount": len(matching),
            "sourceEventId": latest.get("sourceEventId"),
        })
    first_event = min(first_requests, key=lambda event: event["atMs"], default=None)
    return {
        "layer": "observed",
        "count": len(rows),
        "firstAtMs": first_event.get("atMs") if first_event else None,
        "technologies": rows,
        "basis": basis,
    }


def _building_placements(
    builds: list[dict[str, Any]],
    building_id: int,
    catalog: dict[str, Any],
    label: str,
) -> dict[str, Any]:
    events = [
        event for event in builds
        if event.get("buildingId") == building_id and isinstance(event.get("atMs"), int)
    ]
    return {
        "layer": "observed",
        "count": len(events),
        "firstAtMs": events[0]["atMs"] if events else None,
        "building": _entity(catalog, "buildings", building_id),
        "basis": f"observed {label} BUILD placement commands; not completion/survival",
    }


def _army_commitment_checkpoints(
    production: list[dict[str, Any]],
    catalog: dict[str, Any],
) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, boundary_ms in ARMY_COMMITMENT_CHECKPOINTS.items():
        gross = 0.0
        cancelled = 0.0
        unpriced = 0
        unknown_amount_commands = 0
        for event in production:
            at_ms = event.get("atMs")
            if not isinstance(at_ms, int) or at_ms > boundary_ms:
                continue
            unit_id = event.get("unitId")
            producer_type = event.get("producerBuildingTypeId")
            if not _is_military_unit(catalog, unit_id, producer_type):
                continue
            amount = event.get("signedAmount")
            if type(amount) is not int:
                unknown_amount_commands += 1
                continue
            cost = _unit_cost(catalog, unit_id)
            if cost is None:
                unpriced += abs(amount)
                continue
            if amount > 0:
                gross += cost * amount
            elif amount < 0:
                cancelled += cost * abs(amount)
        net = gross - cancelled
        result[key] = {
            "layer": "reconstructed",
            "boundaryMs": boundary_ms,
            "grossPositiveQueueResources": int(gross) if gross.is_integer() else round(gross, 3),
            "cancelledQueueResources": int(cancelled) if cancelled.is_integer() else round(cancelled, 3),
            "netQueueResources": int(net) if net.is_integer() else round(net, 3),
            "unpricedUnitAmount": unpriced,
            "unknownAmountCommands": unknown_amount_commands,
            "basis": (
                "base-catalog value of military queue requests through checkpoint; "
                "gross and decoded cancellation-adjusted values are shown separately"
            ),
            "note": "Army commitment proxy only; deaths/surviving army are not observable.",
        }
    return result


def _production_buildings_used(
    military_events: list[dict[str, Any]],
) -> dict[str, Any]:
    object_ids: set[int] = set()
    by_type: dict[str, set[int]] = {}
    positive_events = 0
    events_without_ids = 0
    for event in military_events:
        if event.get("signedAmount", 0) <= 0:
            continue
        positive_events += 1
        ids = [value for value in (event.get("producerObjectIds") or []) if isinstance(value, int)]
        if not ids:
            events_without_ids += 1
            continue
        producer_type = str(event.get("producerBuildingTypeId") or "unknown")
        by_type.setdefault(producer_type, set()).update(ids)
        object_ids.update(ids)
    return {
        "layer": "reconstructed",
        "count": len(object_ids),
        "positiveMilitaryQueueEvents": positive_events,
        "eventsWithoutProducerObjectIds": events_without_ids,
        "producerObjectIds": sorted(object_ids),
        "byProducerBuildingTypeId": {
            key: len(values) for key, values in sorted(by_type.items())
        },
        "basis": (
            "distinct decoded producer object IDs selected on positive military queue commands; "
            "multi-selection can overstate buildings that actually received queued units"
        ),
    }


def _trash_metrics(
    positive_by_unit: Counter[int],
    total_positive: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    by_line = {
        line: sum(positive_by_unit.get(raw_id, 0) for raw_id in raw_ids)
        for line, raw_ids in TRASH_UNIT_LINES.items()
    }
    trash_total = sum(by_line.values())
    share = (100.0 * trash_total / total_positive) if total_positive > 0 else None
    return (
        {
            "layer": "reconstructed",
            "count": trash_total,
            "byLine": by_line,
            "rawUnitIds": sorted(TRASH_UNIT_IDS),
            "basis": "positive queue amounts for Spear, Skirmisher and Scout/Light Cavalry/Hussar lines",
        },
        {
            "layer": "reconstructed",
            "percent": round(share, 3) if share is not None else None,
            "trashPositiveQueueAmount": trash_total,
            "militaryPositiveQueueAmount": total_positive,
            "basis": "trash-line positive queue amount / all positive military queue amount × 100",
        },
    )


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

        raw_unit_queue_summary = {}
        for row in unit_rows:
            unit = row["unit"]
            raw_id = unit.get("rawId")
            name = unit.get("name") or unit.get("internalName") or f"Raw ID {raw_id}"
            producers = ",".join(str(value) for value in row["producerBuildingTypeIds"]) or "?"
            raw_unit_queue_summary[str(raw_id)] = (
                f"{name} · class {row['class'] or 'unclassified'} · "
                f"+{row['positiveQueueAmount']} / -{row['negativeQueueAmount']} · "
                f"producer type {producers}"
            )

        buildings = _military_buildings(builds, catalog, castle_click)
        trash_units, trash_share = _trash_metrics(positive_by_unit, total_positive)
        blacksmith_upgrades = _technology_group(
            research=research,
            tech_ids=BLACKSMITH_TECH_IDS,
            catalog=catalog,
            basis="distinct supported Blacksmith technology requests; latest request retained per one-time technology",
        )
        university_techs = _technology_group(
            research=research,
            tech_ids=UNIVERSITY_TECH_IDS,
            catalog=catalog,
            basis="distinct supported University technology requests from the source-pinned DE technology set",
        )
        ballistics_event = _latest_research_by_id(research, BALLISTICS_TECH_ID)
        chemistry_event = _latest_research_by_id(research, CHEMISTRY_TECH_ID)
        castle_events = [
            event for event in builds
            if _building_type(catalog, event.get("buildingId")) == "castles"
            and isinstance(event.get("atMs"), int)
        ]
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
            "armyCommitmentCheckpoints": _army_commitment_checkpoints(
                production, catalog,
            ),
            "trashUnits": trash_units,
            "trashArmyShare": trash_share,
            "productionBuildingsUsed": _production_buildings_used(military_events),
            "castles": {
                "layer": "observed",
                "count": len(castle_events),
                "firstAtMs": castle_events[0]["atMs"] if castle_events else None,
                "basis": "Castle BUILD placement commands; not completion/survival",
            },
            "blacksmithBuildings": _building_placements(
                builds, BLACKSMITH_BUILDING_ID, catalog, "Blacksmith",
            ),
            "blacksmithUpgrades": blacksmith_upgrades,
            "universityBuildings": _building_placements(
                builds, UNIVERSITY_BUILDING_ID, catalog, "University",
            ),
            "universityTechs": university_techs,
            "ballistics": {
                "layer": "observed",
                "atMs": ballistics_event.get("atMs") if ballistics_event else None,
                "technology": _entity(catalog, "technologies", BALLISTICS_TECH_ID),
                "basis": "latest observed Ballistics research request",
            },
            "chemistry": {
                "layer": "observed",
                "atMs": chemistry_event.get("atMs") if chemistry_event else None,
                "technology": _entity(catalog, "technologies", CHEMISTRY_TECH_ID),
                "basis": "latest observed Chemistry research request",
            },
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
                "rawUnitQueueSummary": raw_unit_queue_summary,
                "basis": "positive queue amounts classified by catalog role and/or decoded DE producer-building type",
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
