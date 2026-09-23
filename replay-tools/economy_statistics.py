"""Player-facing Economy statistics from canonical replay-analysis evidence.

The module keeps command observations separate from reconstructions. Queue,
research and placement commands are not engine completion events; metrics whose
familiar names imply outcomes expose their command/reconstruction basis.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable

from opening_statistics import (
    AGE_RESEARCH_MS,
    AGE_TECH_IDS,
    CIV_CHINESE,
    CIV_GOTHS,
    CIV_PORTUGUESE,
    _civilization_id,
    _initial_population_used,
    _initial_town_centers,
    _initial_villager_count,
    _normal_dark_age_start_qualified,
    _roles,
    _standard_starting_villagers,
    _villager_train_ms,
)

ECONOMY_STATISTICS_VERSION = "AOF_ECONOMY_STATISTICS_V3"
TC_ACTIVITY_MODEL_VERSION = "AOF_TC_ACTIVITY_V2"
COMMITMENT_RATIO_VERSION = "AOF_ECO_MILITARY_COMMITMENT_20M_V1"

CHECKPOINT_20_MIN_MS = 20 * 60_000
IDLE_GAP_THRESHOLD_MS = 30_000

# Explicit AoE2 DE economic technology set used by this first economy model.
ECO_TECH_IDS = {
    12,   # Crop Rotation
    13,   # Heavy Plow
    14,   # Horse Collar
    15,   # Guilds
    17,   # Banking
    22,   # Loom
    23,   # Coinage
    48,   # Caravan
    55,   # Gold Mining
    65,   # Gillnets
    182,  # Gold Shaft Mining
    202,  # Double-Bit Axe
    203,  # Bow Saw
    213,  # Wheelbarrow
    221,  # Two-Man Saw
    249,  # Hand Cart
    278,  # Stone Mining
    279,  # Stone Shaft Mining
    906,  # Fishing Lines
}
HORSE_COLLAR_TECH_ID = 14
TC_RESEARCH_IDS = {8, 22, 213, 249, 280} | set(AGE_TECH_IDS.values())
ECO_UPGRADE_BY_CASTLE_IDS = ECO_TECH_IDS - {22}
MARKET_LOT_RESOURCE_AMOUNT = 100

# AIRef AoE2 object identities used only for targeted Gaia-food interaction
# inference. These are not Return of Rome / Chronicles tables.
BOAR_OBJECT_IDS = {48, 810, 822}   # Wild Boar / Iron Boar / Javelina
DEER_OBJECT_IDS = {65}             # Deer
LIVESTOCK_OBJECT_IDS = {594, 833}  # Sheep / Turkey; intentionally conservative


def _player_events(events: Iterable[dict[str, Any]], player_id: int) -> list[dict[str, Any]]:
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
        "roleKeys": item.get("roleKeys") or [],
        "resolutionStatus": (
            "reference_catalog_unqualified_for_replay_patch" if item else "unresolved"
        ),
    }


def _latest_event(events: list[dict[str, Any]], key: str, raw_id: int) -> dict[str, Any] | None:
    candidates = [
        event for event in events
        if event.get(key) == raw_id and isinstance(event.get("atMs"), int)
    ]
    return candidates[-1] if candidates else None


def _first_event(events: list[dict[str, Any]], key: str, raw_id: int) -> dict[str, Any] | None:
    for event in events:
        if event.get(key) == raw_id and isinstance(event.get("atMs"), int):
            return event
    return None


def _age_up_at(research: list[dict[str, Any]], age: str) -> int | None:
    event = _latest_event(research, "technologyId", AGE_TECH_IDS[age])
    return event["atMs"] + AGE_RESEARCH_MS[age] if event is not None else None


def _tech_research_ms(civ_id: int | None, tech_id: int, catalog: dict[str, Any]) -> float | None:
    item = _catalog_item(catalog, "technologies", tech_id)
    seconds = item.get("researchTime")
    if not isinstance(seconds, (int, float)):
        return None
    if tech_id == 22 and civ_id == CIV_GOTHS:
        return 0.0
    multiplier = 1.25 if civ_id == CIV_PORTUGUESE else 1.0
    return float(seconds) * 1000 / multiplier


def _eco_techs(
    research: list[dict[str, Any]],
    civ_id: int | None,
    catalog: dict[str, Any],
    castle_click_ms: int | None,
) -> tuple[list[dict[str, Any]], int]:
    rows: list[dict[str, Any]] = []
    by_castle = 0
    for tech_id in sorted(ECO_TECH_IDS):
        event = _latest_event(research, "technologyId", tech_id)
        if event is None:
            continue
        duration = _tech_research_ms(civ_id, tech_id, catalog)
        complete = event["atMs"] + duration if duration is not None else None
        before_castle = (
            tech_id in ECO_UPGRADE_BY_CASTLE_IDS
            and castle_click_ms is not None
            and event["atMs"] < castle_click_ms
        )
        if before_castle:
            by_castle += 1
        rows.append({
            "technology": _entity(catalog, "technologies", tech_id),
            "researchRequestedAtMs": event["atMs"],
            "inferredCompleteAtMs": round(complete, 3) if complete is not None else None,
            "requestedBeforeCastleClick": before_castle if castle_click_ms is not None else None,
            "sourceEventId": event.get("sourceEventId"),
        })
    rows.sort(key=lambda row: (row["researchRequestedAtMs"], row["technology"]["rawId"]))
    return rows, by_castle


def _is_town_center(catalog: dict[str, Any], building_id: Any) -> bool:
    item = _catalog_item(catalog, "buildings", building_id)
    return item.get("name") == "Town Center" or "town_center" in set(item.get("roleKeys") or [])


def _is_farm(catalog: dict[str, Any], building_id: Any) -> bool:
    item = _catalog_item(catalog, "buildings", building_id)
    return item.get("name") == "Farm" or "farm" in set(item.get("roleKeys") or [])


def _starting_villager_state(
    *,
    player_id: int,
    participant: dict[str, Any],
    manifest: dict[str, Any],
    initial_objects: list[dict[str, Any]],
    catalog: dict[str, Any],
) -> dict[str, Any]:
    civ_id = _civilization_id(participant)
    observed_villagers = _initial_villager_count(initial_objects, player_id, catalog)
    observed_population = _initial_population_used(initial_objects, player_id, catalog)
    tcs = _initial_town_centers(initial_objects, player_id, catalog)
    standard_villagers = _standard_starting_villagers(civ_id)
    qualified = _normal_dark_age_start_qualified(manifest, tcs)
    used_villagers = max(observed_villagers, standard_villagers) if qualified else observed_villagers
    standard_population = standard_villagers + 1
    used_population = max(observed_population, standard_population) if qualified else observed_population
    return {
        "observedVillagers": observed_villagers,
        "villagersUsed": used_villagers,
        "observedPopulation": observed_population,
        "populationUsed": used_population,
        "qualifiedStandardStartFloor": qualified,
    }


def _villager_queue_metrics(
    production: list[dict[str, Any]],
    *,
    starting_villagers: int,
) -> dict[str, Any]:
    positive_total = 0
    negative_total = 0
    positive_20 = 0
    negative_20 = 0
    unknown = 0
    for event in production:
        if event.get("unitId") != 83:
            continue
        signed = event.get("signedAmount")
        if type(signed) is not int:
            unknown += 1
            continue
        if signed > 0:
            positive_total += signed
            if event.get("atMs", CHECKPOINT_20_MIN_MS + 1) <= CHECKPOINT_20_MIN_MS:
                positive_20 += signed
        elif signed < 0:
            negative_total += abs(signed)
            if event.get("atMs", CHECKPOINT_20_MIN_MS + 1) <= CHECKPOINT_20_MIN_MS:
                negative_20 += abs(signed)
    return {
        "villagersTrained": {
            "layer": "reconstructed",
            "count": positive_total if unknown == 0 else None,
            "basis": "sum of positive decoded Villager queue amounts; TownBell-control-compatible queue-derived proxy, not observed unit completion",
            "positiveQueueAmount": positive_total,
            "negativeQueueAmountObserved": negative_total,
            "unknownAmountCommands": unknown,
        },
        "villagersBy20Minutes": {
            "layer": "reconstructed",
            "count": (
                starting_villagers + positive_20 - negative_20 if unknown == 0 else None
            ),
            "basis": "qualified starting Villager count + net decoded Villager queue amount through 20:00; does not prove survival or completion",
            "startingVillagers": starting_villagers,
            "positiveQueueAmountThrough20m": positive_20,
            "negativeQueueAmountThrough20m": negative_20,
            "unknownAmountCommands": unknown,
        },
    }


def _busy_intervals_single_tc_dark_age(
    production: list[dict[str, Any]],
    research: list[dict[str, Any]],
    *,
    civ_id: int | None,
    catalog: dict[str, Any],
    boundary_ms: int | None,
) -> dict[str, Any]:
    if boundary_ms is None:
        return {
            "layer": "inferred",
            "valueMs": None,
            "longestGapMs": None,
            "gapCountOver30s": None,
            "unavailableReason": "No Feudal click boundary.",
        }

    events: list[tuple[int, str, float, str | None]] = []
    villager_ms = _villager_train_ms(civ_id, catalog)
    for event in production:
        at = event.get("atMs")
        if not isinstance(at, int) or at >= boundary_ms or event.get("unitId") != 83:
            continue
        amount = event.get("signedAmount")
        if type(amount) is not int or amount <= 0:
            continue
        events.append((at, "villager", villager_ms * amount, event.get("sourceEventId")))

    for event in research:
        at = event.get("atMs")
        tech_id = event.get("technologyId")
        if not isinstance(at, int) or at >= boundary_ms or tech_id != 22:
            continue
        duration = _tech_research_ms(civ_id, 22, catalog)
        if duration is not None:
            events.append((at, "loom", duration, event.get("sourceEventId")))

    events.sort(key=lambda item: (item[0], str(item[3] or "")))
    cursor = 0.0
    busy: list[tuple[float, float]] = []
    for at, _, duration, _ in events:
        start = max(float(at), cursor)
        end = start + duration
        if start < boundary_ms:
            busy.append((start, min(end, float(boundary_ms))))
        cursor = end

    merged: list[list[float]] = []
    for start, end in busy:
        if not merged or start > merged[-1][1]:
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)

    gaps: list[float] = []
    previous = 0.0
    busy_ms = 0.0
    for start, end in merged:
        if start > previous:
            gaps.append(start - previous)
        busy_ms += max(0.0, end - start)
        previous = max(previous, end)
    if previous < boundary_ms:
        gaps.append(float(boundary_ms) - previous)

    idle = max(0.0, float(boundary_ms) - busy_ms)
    return {
        "layer": "inferred",
        "valueMs": round(idle, 3),
        "longestGapMs": round(max(gaps), 3) if gaps else 0,
        "gapCountOver30s": sum(gap > IDLE_GAP_THRESHOLD_MS for gap in gaps),
        "basis": "single-starting-TC queue workload before the latest Feudal click; Villager queue amounts and Loom occupy nominal TC work time",
        "boundary": "latest_feudal_click",
        "note": "Population blocks, resource starvation and exact engine acceptance can make actual lost production differ.",
    }


def _tc_activity_gaps(
    production: list[dict[str, Any]],
    research: list[dict[str, Any]],
    *,
    civ_id: int | None,
    catalog: dict[str, Any],
) -> dict[str, Any]:
    streams: dict[str, list[tuple[int, float]]] = defaultdict(list)
    unresolved = 0
    villager_ms = _villager_train_ms(civ_id, catalog)

    for event in production:
        if event.get("unitId") != 83:
            continue
        amount = event.get("signedAmount")
        at = event.get("atMs")
        if not isinstance(at, int) or type(amount) is not int or amount <= 0:
            continue
        producers = list(dict.fromkeys(event.get("producerObjectIds") or []))
        if not producers:
            unresolved += 1
            continue
        per = max(1, (amount + len(producers) - 1) // len(producers))
        for producer in producers:
            streams[str(producer)].append((at, villager_ms * per))

    for event in research:
        tech_id = event.get("technologyId")
        at = event.get("atMs")
        if tech_id not in TC_RESEARCH_IDS or not isinstance(at, int):
            continue
        duration = (
            AGE_RESEARCH_MS[{101: "feudal", 102: "castle", 103: "imperial"}[tech_id]]
            if tech_id in (101, 102, 103)
            else _tech_research_ms(civ_id, int(tech_id), catalog)
        )
        if duration is None:
            continue
        producers = list(dict.fromkeys(event.get("producerObjectIds") or []))
        if not producers:
            unresolved += 1
            continue
        streams[str(producers[0])].append((at, float(duration)))

    gaps: list[float] = []
    for items in streams.values():
        items.sort()
        cursor: float | None = None
        for at, duration in items:
            if cursor is None:
                cursor = float(at) + duration
                continue
            start = float(at)
            if start > cursor:
                gaps.append(start - cursor)
            cursor = max(start, cursor) + duration

    return {
        "layer": "inferred",
        "modelVersion": TC_ACTIVITY_MODEL_VERSION,
        "longestGapMs": round(max(gaps), 3) if gaps else (0 if streams else None),
        "gapCountOver30s": sum(gap > IDLE_GAP_THRESHOLD_MS for gap in gaps) if streams else None,
        "producerStreamCount": len(streams),
        "activityCommandsWithoutProducerIds": unresolved,
        "basis": "gaps between reconstructed Villager and Town-Center-only research workload intervals on decoded producer-object streams",
        "note": "Only TC technologies (ages, Loom, Wheelbarrow, Hand Cart, Town Watch/Patrol) can contribute research workload. Producer identities and multi-selection queue distribution remain replay-command inference.",
    }


def _market_metrics(market: list[dict[str, Any]]) -> dict[str, Any]:
    transactions = len(market)
    sales = sum(event.get("type") == "SELL" for event in market)
    purchases = sum(event.get("type") == "BUY" for event in market)
    decoded_lots = [
        abs(event["amount"]) for event in market if isinstance(event.get("amount"), (int, float))
    ]
    first = min((event["atMs"] for event in market if isinstance(event.get("atMs"), int)), default=None)
    return {
        "transactions": {"layer": "observed", "count": transactions},
        "volumeTraded": {
            "layer": "observed",
            "amount": sum(decoded_lots) * MARKET_LOT_RESOURCE_AMOUNT,
            "decodedLotCount": sum(decoded_lots),
            "resourceAmountPerLot": MARKET_LOT_RESOURCE_AMOUNT,
            "decodedAmountEventCount": len(decoded_lots),
            "basis": "decoded market amount is a count of 100-resource lots; volume is absolute lots × 100, not gold proceeds after market pricing",
        },
        "firstUse": {"layer": "observed", "atMs": first},
        "sales": {"layer": "observed", "count": sales},
        "purchases": {"layer": "observed", "count": purchases},
    }


def _cost(catalog: dict[str, Any], section: str, raw_id: Any) -> float | None:
    item = _catalog_item(catalog, section, raw_id)
    if not item:
        return None
    cost = item.get("cost") or {}
    values = [value for value in cost.values() if isinstance(value, (int, float))]
    return float(sum(values)) if len(values) == len(cost) else None


def _commitment_ratio_20m(
    production: list[dict[str, Any]],
    research: list[dict[str, Any]],
    builds: list[dict[str, Any]],
    catalog: dict[str, Any],
) -> dict[str, Any]:
    economy = 0.0
    military = 0.0
    unclassified = 0.0
    priced = 0
    unpriced = 0

    def add(kind: str | None, value: float | None) -> None:
        nonlocal economy, military, unclassified, priced, unpriced
        if value is None:
            unpriced += 1
            return
        priced += 1
        if kind == "economy":
            economy += value
        elif kind == "military":
            military += value
        else:
            unclassified += value

    for event in production:
        if not isinstance(event.get("atMs"), int) or event["atMs"] > CHECKPOINT_20_MIN_MS:
            continue
        amount = event.get("requestedAmountPositive")
        if type(amount) is not int or amount <= 0:
            continue
        unit_id = event.get("unitId")
        roles = _roles(catalog, "units", unit_id)
        kind = (
            "economy" if roles.intersection({"villager", "economic_unit", "fishing_ship", "trade_unit"})
            else "military" if roles.intersection({"land_military", "water_military"})
            else None
        )
        cost = _cost(catalog, "units", unit_id)
        add(kind, cost * amount if cost is not None else None)

    for event in builds:
        if not isinstance(event.get("atMs"), int) or event["atMs"] > CHECKPOINT_20_MIN_MS:
            continue
        building_id = event.get("buildingId")
        roles = _roles(catalog, "buildings", building_id)
        item = _catalog_item(catalog, "buildings", building_id)
        name = item.get("name")
        if name in {"Farm", "Town Center", "Market", "Mill", "House"} or roles.intersection({
            "economy", "farm", "town_center", "market", "mill", "house", "naval_economy"
        }):
            kind = "economy"
        elif roles.intersection({"military_production", "fortification"}):
            kind = "military"
        else:
            kind = None
        add(kind, _cost(catalog, "buildings", building_id))

    for event in research:
        if not isinstance(event.get("atMs"), int) or event["atMs"] > CHECKPOINT_20_MIN_MS:
            continue
        tech_id = event.get("technologyId")
        if tech_id in AGE_TECH_IDS.values():
            continue
        kind = "economy" if tech_id in ECO_TECH_IDS else None
        add(kind, _cost(catalog, "technologies", tech_id))

    classified = economy + military
    return {
        "layer": "reconstructed",
        "modelVersion": COMMITMENT_RATIO_VERSION,
        "economyCommitment": int(economy) if economy.is_integer() else round(economy, 3),
        "militaryCommitment": int(military) if military.is_integer() else round(military, 3),
        "unclassifiedCommitment": int(unclassified) if unclassified.is_integer() else round(unclassified, 3),
        "economyToMilitaryRatio": round(economy / military, 3) if military > 0 else None,
        "economyShareOfClassifiedPercent": round(economy / classified * 100, 3) if classified else None,
        "pricedCommandCount": priced,
        "unpricedCommandCount": unpriced,
        "basis": "pinned base-catalog cost of classified queue/research/build placement requests through 20:00; age-up costs excluded",
    }


def _animal_interactions(
    *,
    player_id: int,
    initial_objects: list[dict[str, Any]],
    action_events: list[dict[str, Any]],
) -> dict[str, Any]:
    targets: dict[int, int] = {}
    food_objects: list[dict[str, Any]] = []
    for event in initial_objects:
        ids = event.get("objectInstanceIds") or []
        raw_id = (event.get("payload") or {}).get("objectId")
        position = event.get("position") or {}
        if len(ids) == 1 and isinstance(ids[0], int) and isinstance(raw_id, int):
            targets[ids[0]] = raw_id
            if raw_id in BOAR_OBJECT_IDS | DEER_OBJECT_IDS | LIVESTOCK_OBJECT_IDS:
                x, y = position.get("x"), position.get("y")
                if isinstance(x, (int, float)) and isinstance(y, (int, float)):
                    food_objects.append({
                        "instanceId": ids[0],
                        "rawId": raw_id,
                        "x": float(x),
                        "y": float(y),
                    })

    ordered = sorted(
        (
            event for event in action_events
            if event.get("actorPlayerId") == player_id
            and event.get("sourceActionName") == "ORDER"
            and (
                isinstance(event.get("targetInstanceId"), int)
                or isinstance((event.get("position") or {}).get("x"), (int, float))
            )
        ),
        key=lambda event: (event.get("timestampMs", 0), event.get("operationOrdinal", 0)),
    )
    boars: dict[int, dict[str, Any]] = {}
    deer: dict[int, dict[str, Any]] = {}
    livestock: dict[int, dict[str, Any]] = {}
    unresolved_targets = 0
    spatial_fallback_matches = 0

    def resolve(event: dict[str, Any]) -> tuple[int, int, str] | None:
        nonlocal spatial_fallback_matches
        target_id = event.get("targetInstanceId")
        raw_id = targets.get(target_id) if isinstance(target_id, int) else None
        if raw_id is not None:
            return int(target_id), raw_id, "target_instance_id"

        position = event.get("position") or {}
        x, y = position.get("x"), position.get("y")
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            return None
        candidates = []
        for item in food_objects:
            distance2 = (float(x) - item["x"]) ** 2 + (float(y) - item["y"]) ** 2
            if distance2 <= 1.5 ** 2:
                candidates.append((distance2, item))
        candidates.sort(key=lambda row: row[0])
        if not candidates:
            return None
        if len(candidates) > 1 and abs(candidates[1][0] - candidates[0][0]) < 0.25:
            return None
        spatial_fallback_matches += 1
        item = candidates[0][1]
        return item["instanceId"], item["rawId"], "target_position_within_1_5_tiles"

    for event in ordered:
        resolved = resolve(event)
        if resolved is None:
            unresolved_targets += 1
            continue
        target_id, raw_id, method = resolved
        at = int(event.get("timestampMs") or 0)
        evidence = {
            "atMs": at,
            "resolutionMethod": method,
            "sourceEventId": event.get("canonicalSourceEventId"),
            "operationOrdinal": event.get("operationOrdinal"),
            "targetInstanceId": event.get("targetInstanceId"),
            "resolvedAnimalInstanceId": target_id,
            "animalRawId": raw_id,
            "targetPosition": event.get("position"),
        }
        if raw_id in BOAR_OBJECT_IDS:
            boars.setdefault(target_id, evidence)
        if raw_id in DEER_OBJECT_IDS:
            deer.setdefault(target_id, evidence)
        if raw_id in LIVESTOCK_OBJECT_IDS:
            livestock.setdefault(target_id, evidence)

    return {
        "firstBoarLure": {
            "layer": "inferred",
            "atMs": min((row["atMs"] for row in boars.values()), default=None),
            "evidence": min(boars.values(), key=lambda row: row["atMs"]) if boars else None,
            "basis": "first player ORDER resolved to a known boar-family initial object by target identity or tight target-position fallback; this is stricter than an approach/move-toward-boar heuristic",
        },
        "boarsTaken": {
            "layer": "inferred",
            "count": len(boars),
            "basis": "distinct known boar-family initial objects targeted by player ORDER commands; interaction proxy, not kill/gather proof",
        },
        "deerTaken": {
            "layer": "inferred",
            "count": len(deer),
            "basis": "distinct known Deer initial objects targeted by player ORDER commands; interaction proxy, not kill/gather proof",
        },
        "livestockTaken": {
            "layer": "inferred",
            "count": len(livestock),
            "basis": "distinct known Sheep/Turkey initial objects targeted by player ORDER commands; conservative livestock interaction proxy",
        },
        "animalInteractionCoverage": {
            "initialObjectIdentityCount": len(targets),
            "knownFoodObjectsWithPositions": len(food_objects),
            "orderTargetsUnresolvedAgainstInitialObjects": unresolved_targets,
            "spatialFallbackMatches": spatial_fallback_matches,
            "knownBoarRawIds": sorted(BOAR_OBJECT_IDS),
            "knownDeerRawIds": sorted(DEER_OBJECT_IDS),
            "knownLivestockRawIds": sorted(LIVESTOCK_OBJECT_IDS),
            "note": "Initial-object search is non-exhaustive, so these animal counts can undercount; spatial fallback only uses known food objects within 1.5 tiles.",
        },
    }


def project_economy_statistics(
    *,
    manifest: dict[str, Any],
    body: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: list[dict[str, Any]],
    action_events: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    results: dict[str, dict[str, Any]] = {}
    for participant in manifest.get("participants", []):
        player_id = int(participant["playerId"])
        civ_id = _civilization_id(participant)
        production = _player_events(body.get("productionEvents", []), player_id)
        research = _player_events(body.get("researchEvents", []), player_id)
        builds = _player_events(body.get("buildEvents", []), player_id)
        market = _player_events(body.get("marketEvents", []), player_id)

        starting = _starting_villager_state(
            player_id=player_id,
            participant=participant,
            manifest=manifest,
            initial_objects=initial_objects,
            catalog=catalog,
        )
        queue_metrics = _villager_queue_metrics(
            production,
            starting_villagers=starting["villagersUsed"],
        )
        feudal_click_event = _latest_event(research, "technologyId", AGE_TECH_IDS["feudal"])
        feudal_click = feudal_click_event["atMs"] if feudal_click_event is not None else None
        castle_click_event = _latest_event(research, "technologyId", AGE_TECH_IDS["castle"])
        castle_click = castle_click_event["atMs"] if castle_click_event is not None else None
        castle_age_up = _age_up_at(research, "castle")

        tc_placements = [event for event in builds if _is_town_center(catalog, event.get("buildingId"))]
        initial_tc_count = len(_initial_town_centers(initial_objects, player_id, catalog))
        tc_count_start = max(1, initial_tc_count) if starting["qualifiedStandardStartFloor"] else initial_tc_count
        tc_total = tc_count_start + len(tc_placements)
        first_extra = tc_placements[0]["atMs"] if tc_placements else None
        third_tc_index = max(0, 3 - tc_count_start - 1)
        third_tc = (
            tc_placements[third_tc_index]["atMs"]
            if tc_count_start < 3 and len(tc_placements) > third_tc_index
            else 0 if tc_count_start >= 3
            else None
        )

        eco_tech_rows, eco_by_castle = _eco_techs(research, civ_id, catalog, castle_click)
        horse = _latest_event(research, "technologyId", HORSE_COLLAR_TECH_ID)
        horse_duration = _tech_research_ms(civ_id, HORSE_COLLAR_TECH_ID, catalog)
        horse_complete = (
            horse["atMs"] + horse_duration
            if horse is not None and horse_duration is not None
            else None
        )

        farms = [event for event in builds if _is_farm(catalog, event.get("buildingId"))]
        farms_before_horse = (
            sum(event["atMs"] < horse["atMs"] for event in farms)
            if horse is not None else None
        )
        farms_before_castle = (
            sum(event["atMs"] < castle_click for event in farms)
            if castle_click is not None else None
        )

        dark_idle = _busy_intervals_single_tc_dark_age(
            production,
            research,
            civ_id=civ_id,
            catalog=catalog,
            boundary_ms=feudal_click,
        )
        activity_gaps = _tc_activity_gaps(
            production,
            research,
            civ_id=civ_id,
            catalog=catalog,
        )

        results[str(player_id)] = {
            "modelVersion": ECONOMY_STATISTICS_VERSION,
            **queue_metrics,
            "tcIdleTimeDarkAge": dark_idle,
            "townCenters": {
                "layer": "reconstructed",
                "count": tc_total,
                "startingCountUsed": tc_count_start,
                "extraPlacementCount": len(tc_placements),
                "basis": "qualified starting TC count + observed Town Center placement commands; not current surviving TC count",
            },
            "firstExtraTownCenterTime": {
                "layer": "observed",
                "atMs": first_extra,
                "basis": "first extra Town Center placement command",
            },
            "thirdTownCenterTime": {
                "layer": "observed" if third_tc is not None else "reconstructed",
                "atMs": third_tc,
                "basis": "placement command that raises qualified cumulative TC count to three",
            },
            "longestTcIdleGap": {
                "layer": activity_gaps["layer"],
                "valueMs": activity_gaps["longestGapMs"],
                "basis": activity_gaps["basis"],
                "producerStreamCount": activity_gaps["producerStreamCount"],
                "activityCommandsWithoutProducerIds": activity_gaps["activityCommandsWithoutProducerIds"],
                "note": activity_gaps["note"],
            },
            "tcIdleGapsOver30s": {
                "layer": activity_gaps["layer"],
                "count": activity_gaps["gapCountOver30s"],
                "thresholdMs": IDLE_GAP_THRESHOLD_MS,
                "basis": activity_gaps["basis"],
            },
            "economicTechsResearched": {
                "layer": "inferred",
                "count": len(eco_tech_rows),
                "technologies": eco_tech_rows,
                "basis": "distinct supported normal one-time economic technologies using the latest observed research request as the effective-attempt candidate; includes Market economy technologies",
            },
            "ecoUpgradesByCastle": {
                "layer": "inferred",
                "count": eco_by_castle if castle_click is not None else None,
                "castleClickAtMs": castle_click,
                "basis": "supported economic upgrade research requests before the latest Castle click; Loom excluded from this TownBell-compatible count",
            },
            "horseCollar": {
                "layer": "inferred",
                "researchRequestedAtMs": horse["atMs"] if horse is not None else None,
                "inferredCompleteAtMs": round(horse_complete, 3) if horse_complete is not None else None,
            },
            "farmsPlaced": {
                "layer": "observed",
                "count": len(farms),
                "basis": "Farm placement commands",
            },
            "firstFarm": {
                "layer": "observed",
                "atMs": farms[0]["atMs"] if farms else None,
            },
            "farmsBeforeHorseCollar": {
                "layer": "reconstructed",
                "count": farms_before_horse,
                "boundaryMs": horse["atMs"] if horse is not None else None,
                "basis": "Farm placements before the latest observed Horse Collar research request; for a normal one-time technology, a later request supersedes an earlier cancelled/failed attempt",
            },
            "farmsBeforeCastle": {
                "layer": "reconstructed",
                "count": farms_before_castle,
                "boundaryMs": castle_click,
                "basis": "Farm placements before the latest observed Castle research request",
            },
            "market": _market_metrics(market),
            "ecoMilitaryRatioAt20Minutes": _commitment_ratio_20m(
                production, research, builds, catalog,
            ),
            **_animal_interactions(
                player_id=player_id,
                initial_objects=initial_objects,
                action_events=action_events,
            ),
        }
    return results
