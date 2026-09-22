"""Player-facing opening statistics derived from canonical replay evidence.

Age-up requests, building placements and positive queue requests are treated as
current direct inputs by product policy. Exact summaries remain reconstructed,
and wall style is an explicitly versioned inference from unique wall-tile volume.
"""
from __future__ import annotations

from typing import Any, Iterable

OPENING_STATISTICS_VERSION = "AOF_OPENING_STATISTICS_V3"
AGE_TECH_IDS = {"feudal": 101, "castle": 102, "imperial": 103}
AGE_RESEARCH_MS = {"feudal": 130_000, "castle": 160_000, "imperial": 190_000}
LOOM_TECH_ID = 22
FULLY_WALLED_MINIMUM_TILES = 20
VILLAGER_PRODUCTION_MODEL_VERSION = "AOF_VILLAGER_PRODUCTION_V1"

# Base AoE2 DE civilization IDs used only for modifiers that affect Dark-Age
# villager throughput/population. Starting villagers are observed from the replay,
# not hard-coded here.
CIV_GOTHS = 3
CIV_CHINESE = 6
CIV_PERSIANS = 8
CIV_SPANISH = 14
CIV_HUNS = 17
CIV_INCAS = 21
CIV_PORTUGUESE = 24
CIV_POLES = 38
CIV_ROMANS = 43

FOLWARK_BUILDING_ID = 1734
BASE_TOWN_CENTER_POP_SUPPORT = 5
CHINESE_TOWN_CENTER_POP_SUPPORT = 15
BASE_HOUSE_POP_SUPPORT = 5
INCA_HOUSE_POP_SUPPORT = 10
POLISH_FOLWARK_POP_SUPPORT = 5


def _roles(catalog: dict[str, Any], section: str, raw_id: Any) -> set[str]:
    item = (catalog.get(section) or {}).get(str(raw_id)) or {}
    return set(item.get("roleKeys") or [])


def _entity(catalog: dict[str, Any], section: str, raw_id: Any) -> dict[str, Any]:
    kind = {"units": "unit", "buildings": "building", "technologies": "technology"}[section]
    item = (catalog.get(section) or {}).get(str(raw_id)) or {}
    return {
        "rawId": raw_id,
        "kind": kind,
        "name": item.get("name"),
        "roleKeys": item.get("roleKeys", []),
        "resolutionStatus": (
            "reference_catalog_unqualified_for_replay_patch" if item else "unresolved"
        ),
    }


def _player_events(events: Iterable[dict[str, Any]], player_id: int) -> list[dict[str, Any]]:
    return sorted(
        (event for event in events if event.get("replaySlot") == player_id),
        key=lambda event: (event.get("atMs", 0), event.get("sourceEventId", "")),
    )


def _first_research_time(research: list[dict[str, Any]], technology_id: int) -> int | None:
    for event in research:
        if event.get("technologyId") == technology_id and isinstance(event.get("atMs"), int):
            return event["atMs"]
    return None


def _latest_research_event(
    research: list[dict[str, Any]], technology_id: int,
) -> dict[str, Any] | None:
    candidates = [
        event
        for event in research
        if event.get("technologyId") == technology_id and isinstance(event.get("atMs"), int)
    ]
    return max(
        candidates,
        key=lambda event: (event["atMs"], str(event.get("sourceEventId") or "")),
        default=None,
    )


def _age_up(research: list[dict[str, Any]], age: str) -> dict[str, Any]:
    click_event = _latest_research_event(research, AGE_TECH_IDS[age])
    click = click_event["atMs"] if click_event is not None else None
    duration = AGE_RESEARCH_MS[age]
    return {
        "layer": "inferred",
        "clickAtMs": click,
        "clickSourceEventId": click_event.get("sourceEventId") if click_event is not None else None,
        "ageUpAtMs": click + duration if click is not None else None,
        "researchDurationMs": duration,
        "basis": f"latest observed research request for technology {AGE_TECH_IDS[age]} + fixed {duration}ms",
    }


def _positive_queue(event: dict[str, Any]) -> bool:
    amount = event.get("requestedAmountPositive")
    return type(amount) is int and amount > 0


def _first_military_unit(production: list[dict[str, Any]], catalog: dict[str, Any]) -> dict[str, Any] | None:
    for event in production:
        unit_id = event.get("unitId")
        roles = _roles(catalog, "units", unit_id)
        if _positive_queue(event) and roles.intersection({"land_military", "water_military"}):
            return {
                "layer": "observed",
                "atMs": event.get("atMs"),
                "unit": _entity(catalog, "units", unit_id),
                "requestedAmountPositive": event.get("requestedAmountPositive"),
                "sourceEventId": event.get("sourceEventId"),
            }
    return None


def _first_military_building(builds: list[dict[str, Any]], catalog: dict[str, Any]) -> dict[str, Any] | None:
    for event in builds:
        building_id = event.get("buildingId")
        roles = _roles(catalog, "buildings", building_id)
        if roles.intersection({"military_production", "naval_production"}):
            return {
                "layer": "observed",
                "atMs": event.get("atMs"),
                "building": _entity(catalog, "buildings", building_id),
                "position": {"x": event.get("x"), "y": event.get("y")},
                "sourceEventId": event.get("sourceEventId"),
            }
    return None


def _line_tiles(x0: Any, y0: Any, x1: Any, y1: Any) -> list[tuple[int, int]]:
    """Rasterize one wall command to unique map tiles using integer Bresenham."""
    if not all(isinstance(value, (int, float)) for value in (x0, y0)):
        return []
    if not all(isinstance(value, (int, float)) for value in (x1, y1)):
        x1, y1 = x0, y0
    x0i, y0i, x1i, y1i = (round(float(value)) for value in (x0, y0, x1, y1))
    points: list[tuple[int, int]] = []
    dx, dy = abs(x1i - x0i), -abs(y1i - y0i)
    sx, sy = (1 if x0i < x1i else -1), (1 if y0i < y1i else -1)
    err = dx + dy
    x, y = x0i, y0i
    while True:
        points.append((x, y))
        if x == x1i and y == y1i:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x += sx
        if e2 <= dx:
            err += dx
            y += sy
    return points


def _wall_tiles(events: list[dict[str, Any]], before_ms: int) -> set[tuple[int, int]]:
    result: set[tuple[int, int]] = set()
    for event in events:
        at_ms = event.get("atMs")
        if not isinstance(at_ms, int) or at_ms >= before_ms:
            continue
        result.update(_line_tiles(event.get("x"), event.get("y"), event.get("xEnd"), event.get("yEnd")))
    return result


def _first_wall_segment(walls: list[dict[str, Any]], catalog: dict[str, Any]) -> dict[str, Any] | None:
    if not walls:
        return None
    event = walls[0]
    tiles = _line_tiles(event.get("x"), event.get("y"), event.get("xEnd"), event.get("yEnd"))
    return {
        "layer": "observed",
        "atMs": event.get("atMs"),
        "wall": _entity(catalog, "buildings", event.get("buildingId")),
        "start": {"x": event.get("x"), "y": event.get("y")},
        "end": {"x": event.get("xEnd"), "y": event.get("yEnd")},
        "tileCount": len(set(tiles)),
        "sourceEventId": event.get("sourceEventId"),
    }


def _wall_style(tile_count: int, boundary: str) -> dict[str, Any]:
    if tile_count == 0:
        label = "open"
    elif tile_count < FULLY_WALLED_MINIMUM_TILES:
        label = "partially_walled"
    else:
        label = "fully_walled"
    return {
        "layer": "inferred",
        "label": label,
        "wallTilesBeforeCastle": tile_count,
        "method": "unique_wall_tile_volume",
        "boundary": boundary,
        "thresholds": {"openMaximumTiles": 0, "fullyWalledMinimumTiles": FULLY_WALLED_MINIMUM_TILES},
        "note": "V1 classifies wall style from wall-tile volume only; it does not prove a geometrically sealed base.",
    }


def _count_houses(builds: list[dict[str, Any]], catalog: dict[str, Any], before_ms: int) -> int:
    return sum(
        1 for event in builds
        if isinstance(event.get("atMs"), int)
        and event["atMs"] < before_ms
        and "house" in _roles(catalog, "buildings", event.get("buildingId"))
    )


def _initial_owned_objects(
    initial_objects: list[dict[str, Any]], player_id: int,
) -> list[dict[str, Any]]:
    return [
        event
        for event in initial_objects
        if (event.get("payload") or {}).get("ownerPlayerId") == player_id
    ]


def _initial_villager_count(
    initial_objects: list[dict[str, Any]], player_id: int, catalog: dict[str, Any],
) -> int:
    return sum(
        1
        for event in _initial_owned_objects(initial_objects, player_id)
        if "villager" in _roles(catalog, "units", (event.get("payload") or {}).get("objectId"))
    )


def _civilization_id(participant: dict[str, Any]) -> int | None:
    raw_id = (participant.get("civilization") or {}).get("rawId")
    return raw_id if type(raw_id) is int else None


def _initial_town_centers(
    initial_objects: list[dict[str, Any]], player_id: int, catalog: dict[str, Any],
) -> list[dict[str, Any]]:
    return [
        event
        for event in _initial_owned_objects(initial_objects, player_id)
        if "town_center" in _roles(catalog, "buildings", (event.get("payload") or {}).get("objectId"))
    ]


def _initial_population_used(
    initial_objects: list[dict[str, Any]], player_id: int, catalog: dict[str, Any],
) -> int:
    # For normal openings, all initially owned trainable units consume one slot.
    # This is an explicit reconstruction boundary; exotic half-pop/scenario units
    # should be handled by a future patch-qualified population-cost catalogue.
    return sum(
        1
        for event in _initial_owned_objects(initial_objects, player_id)
        if str((event.get("payload") or {}).get("objectId")) in (catalog.get("units") or {})
    )


def _population_support_for_initial_object(
    object_id: Any, civ_id: int | None, catalog: dict[str, Any],
) -> int:
    roles = _roles(catalog, "buildings", object_id)
    if "town_center" in roles:
        return CHINESE_TOWN_CENTER_POP_SUPPORT if civ_id == CIV_CHINESE else BASE_TOWN_CENTER_POP_SUPPORT
    if "house" in roles:
        return INCA_HOUSE_POP_SUPPORT if civ_id == CIV_INCAS else BASE_HOUSE_POP_SUPPORT
    if civ_id == CIV_POLES and object_id == FOLWARK_BUILDING_ID:
        return POLISH_FOLWARK_POP_SUPPORT
    return 0


def _initial_population_cap(
    initial_objects: list[dict[str, Any]],
    player_id: int,
    civ_id: int | None,
    catalog: dict[str, Any],
    maximum_population: int | None,
) -> int:
    if civ_id == CIV_HUNS and isinstance(maximum_population, int):
        return maximum_population
    cap = sum(
        _population_support_for_initial_object(
            (event.get("payload") or {}).get("objectId"), civ_id, catalog,
        )
        for event in _initial_owned_objects(initial_objects, player_id)
    )
    return min(cap, maximum_population) if isinstance(maximum_population, int) else cap


def _builder_speed_multiplier(civ_id: int | None) -> float:
    if civ_id == CIV_SPANISH:
        return 1.30
    if civ_id == CIV_ROMANS:
        return 1.05
    return 1.0


def _projected_house_completion_events(
    builds: list[dict[str, Any]],
    civ_id: int | None,
    catalog: dict[str, Any],
    before_ms: int,
) -> list[dict[str, Any]]:
    if civ_id == CIV_HUNS:
        return []
    result: list[dict[str, Any]] = []
    speed = _builder_speed_multiplier(civ_id)
    for event in builds:
        at_ms = event.get("atMs")
        if not isinstance(at_ms, int) or at_ms >= before_ms:
            continue
        building_id = event.get("buildingId")
        roles = _roles(catalog, "buildings", building_id)
        is_house = "house" in roles
        is_folwark = civ_id == CIV_POLES and building_id == FOLWARK_BUILDING_ID
        if not is_house and not is_folwark:
            continue
        item = (catalog.get("buildings") or {}).get(str(building_id)) or {}
        base_seconds = item.get("trainTime")
        if not isinstance(base_seconds, (int, float)):
            base_seconds = 40 if is_folwark else 25
        builders = max(1, len(event.get("builderObjectIds") or []))
        seconds = (3 * float(base_seconds) / (builders + 2)) / speed
        support = POLISH_FOLWARK_POP_SUPPORT if is_folwark else (
            INCA_HOUSE_POP_SUPPORT if civ_id == CIV_INCAS else BASE_HOUSE_POP_SUPPORT
        )
        result.append({
            "atMs": at_ms + int(round(seconds * 1000)),
            "kind": "population",
            "populationSupport": support,
            "sourceEventId": event.get("sourceEventId"),
            "basis": "projected_build_completion",
        })
    return result


def _villager_train_ms(civ_id: int | None, catalog: dict[str, Any]) -> float:
    villager = next(
        (
            item for item in (catalog.get("units") or {}).values()
            if "villager" in set(item.get("roleKeys") or [])
        ),
        {},
    )
    base_seconds = villager.get("trainTime")
    base_ms = float(base_seconds if isinstance(base_seconds, (int, float)) else 25) * 1000
    return base_ms / 1.05 if civ_id == CIV_PERSIANS else base_ms


def _loom_research_ms(civ_id: int | None, catalog: dict[str, Any]) -> float:
    if civ_id == CIV_GOTHS:
        return 0.0
    loom = (catalog.get("technologies") or {}).get(str(LOOM_TECH_ID)) or {}
    seconds = loom.get("researchTime")
    base_ms = float(seconds if isinstance(seconds, (int, float)) else 25) * 1000
    # Portuguese team bonus applies to the Portuguese player as well.
    return base_ms / 1.25 if civ_id == CIV_PORTUGUESE else base_ms


def _event_before_boundary(
    event: dict[str, Any], boundary_ms: int, boundary_event_id: str | None,
) -> bool:
    at_ms = event.get("atMs")
    if not isinstance(at_ms, int):
        return False
    if at_ms < boundary_ms:
        return True
    if at_ms > boundary_ms:
        return False
    source_event_id = event.get("sourceEventId")
    return (
        isinstance(source_event_id, str)
        and isinstance(boundary_event_id, str)
        and source_event_id < boundary_event_id
    )


def _villagers_before_feudal(
    production: list[dict[str, Any]],
    research: list[dict[str, Any]],
    builds: list[dict[str, Any]],
    initial_objects: list[dict[str, Any]],
    participant: dict[str, Any],
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    feudal_click_ms: int | None,
    feudal_click_source_event_id: str | None,
) -> dict[str, Any]:
    player_id = int(participant["playerId"])
    civ_id = _civilization_id(participant)
    starting_villagers = _initial_villager_count(initial_objects, player_id, catalog)
    town_centers = _initial_town_centers(initial_objects, player_id, catalog)
    maximum_population = ((manifest.get("match") or {}).get("settings") or {}).get("population")
    maximum_population = maximum_population if type(maximum_population) is int else None

    common = {
        "layer": "inferred",
        "modelVersion": VILLAGER_PRODUCTION_MODEL_VERSION,
        "boundary": "latest_feudal_click" if feudal_click_ms is not None else "no_feudal_click_observed",
        "startingVillagersObserved": starting_villagers,
        "civilizationRawId": civ_id,
    }
    if feudal_click_ms is None:
        return {
            **common,
            "count": None,
            "unavailableReason": "No Feudal research request was observed.",
        }
    if len(town_centers) != 1:
        return {
            **common,
            "count": None,
            "unavailableReason": (
                "V1 villager production reconstruction requires exactly one observed starting Town Center."
            ),
        }

    tc_ids = town_centers[0].get("objectInstanceIds") or []
    if len(tc_ids) != 1:
        return {
            **common,
            "count": None,
            "unavailableReason": "Starting Town Center instance identity is unavailable.",
        }
    tc_id = tc_ids[0]

    initial_pop_used = _initial_population_used(initial_objects, player_id, catalog)
    population_cap = _initial_population_cap(
        initial_objects, player_id, civ_id, catalog, maximum_population,
    )
    if population_cap <= 0 and civ_id != CIV_HUNS:
        return {
            **common,
            "count": None,
            "unavailableReason": "Initial population capacity could not be reconstructed.",
        }

    timeline: list[dict[str, Any]] = []
    unknown_amount_commands = 0
    ambiguous_producer_commands = 0
    for event in production:
        if not _event_before_boundary(event, feudal_click_ms, feudal_click_source_event_id):
            continue
        if "villager" not in _roles(catalog, "units", event.get("unitId")):
            continue
        producers = event.get("producerObjectIds") or []
        if producers and tc_id not in producers:
            continue
        if len(set(producers)) > 1:
            ambiguous_producer_commands += 1
            continue
        signed = event.get("signedAmount")
        if type(signed) is not int:
            unknown_amount_commands += 1
            continue
        timeline.append({
            "atMs": event["atMs"],
            "sourceEventId": event.get("sourceEventId") or "",
            "kind": "queue",
            "amount": signed,
        })

    for event in research:
        if event.get("technologyId") != LOOM_TECH_ID:
            continue
        if not _event_before_boundary(event, feudal_click_ms, feudal_click_source_event_id):
            continue
        producers = event.get("producerObjectIds") or []
        if producers and tc_id not in producers:
            continue
        timeline.append({
            "atMs": event["atMs"],
            "sourceEventId": event.get("sourceEventId") or "",
            "kind": "loom",
        })

    timeline.extend(_projected_house_completion_events(builds, civ_id, catalog, feudal_click_ms))
    timeline.sort(key=lambda event: (
        event["atMs"],
        0 if event["kind"] == "population" else 1,
        str(event.get("sourceEventId") or ""),
    ))

    if unknown_amount_commands or ambiguous_producer_commands:
        return {
            **common,
            "count": None,
            "initialPopulationUsedObserved": initial_pop_used,
            "initialPopulationCapReconstructed": population_cap,
            "unknownAmountVillagerQueueCommands": unknown_amount_commands,
            "ambiguousProducerVillagerQueueCommands": ambiguous_producer_commands,
            "unavailableReason": "Villager queue quantity or producer attribution is incomplete.",
        }

    villager_ms = _villager_train_ms(civ_id, catalog)
    loom_ms = _loom_research_ms(civ_id, catalog)
    queue: list[dict[str, Any]] = []
    active: dict[str, Any] | None = None
    active_finish = 0.0
    current_time = 0.0
    pop_used = initial_pop_used
    completed_villagers = 0
    population_blocked_ms = 0.0
    blocked_since: float | None = None

    def start_next(now: float) -> None:
        nonlocal active, active_finish
        if active is not None or not queue:
            return
        active = queue.pop(0)
        duration = villager_ms if active["kind"] == "villager" else loom_ms
        active_finish = now + duration

    def try_complete(now: float) -> bool:
        nonlocal active, active_finish, pop_used, completed_villagers, blocked_since, population_blocked_ms
        if active is None or active_finish > now:
            return False
        if active["kind"] == "villager" and pop_used >= population_cap:
            if blocked_since is None:
                blocked_since = active_finish
            return False
        completion_time = max(active_finish, now if blocked_since is not None else active_finish)
        if blocked_since is not None:
            population_blocked_ms += max(0.0, completion_time - blocked_since)
            blocked_since = None
        if active["kind"] == "villager":
            pop_used += 1
            completed_villagers += 1
        active = None
        active_finish = completion_time
        start_next(completion_time)
        return True

    def advance_to(target: float) -> None:
        nonlocal current_time
        while active is not None and active_finish <= target:
            if not try_complete(target):
                break
        current_time = target

    for event in timeline:
        event_time = float(event["atMs"])
        advance_to(event_time)
        if event["kind"] == "population":
            population_cap += int(event["populationSupport"])
            if maximum_population is not None:
                population_cap = min(population_cap, maximum_population)
            if active is not None and active_finish <= event_time:
                try_complete(event_time)
            continue
        if event["kind"] == "loom":
            queue.append({"kind": "loom"})
        else:
            amount = int(event["amount"])
            if amount > 0:
                queue.extend({"kind": "villager"} for _ in range(amount))
            elif amount < 0:
                for _ in range(abs(amount)):
                    removed = False
                    for index in range(len(queue) - 1, -1, -1):
                        if queue[index]["kind"] == "villager":
                            del queue[index]
                            removed = True
                            break
                    if not removed and active is not None and active["kind"] == "villager":
                        active = None
                        blocked_since = None
                        start_next(event_time)
        start_next(event_time)

    advance_to(float(feudal_click_ms))
    if blocked_since is not None:
        population_blocked_ms += max(0.0, float(feudal_click_ms) - blocked_since)

    adjustments = []
    if civ_id == CIV_PERSIANS:
        adjustments.append("Persian Dark Age Town Center +5% work rate")
    if civ_id == CIV_CHINESE:
        adjustments.append("Chinese Town Center supports 15 population")
    if civ_id == CIV_HUNS:
        adjustments.append("Huns use lobby population cap without Houses")
    if civ_id == CIV_INCAS:
        adjustments.append("Inca Houses support 10 population")
    if civ_id == CIV_SPANISH:
        adjustments.append("Spanish Villagers construct Houses +30% faster")
    if civ_id == CIV_ROMANS:
        adjustments.append("Roman Villagers construct Houses +5% faster")
    if civ_id == CIV_GOTHS:
        adjustments.append("Goth Loom research is instantaneous")
    if civ_id == CIV_PORTUGUESE:
        adjustments.append("Portuguese Loom research uses +25% technology research speed")
    if civ_id == CIV_POLES:
        adjustments.append("Polish Folwark provides 5 population")

    return {
        **common,
        "count": starting_villagers + completed_villagers,
        "startingPopulationUsedObserved": initial_pop_used,
        "initialPopulationCapReconstructed": _initial_population_cap(
            initial_objects, player_id, civ_id, catalog, maximum_population,
        ),
        "villagersProjectedCompletedBeforeFeudalClick": completed_villagers,
        "villagerTrainTimeMs": round(villager_ms, 3),
        "populationBlockedMs": round(population_blocked_ms, 3),
        "populationCapAtFeudalClick": population_cap,
        "civilizationAdjustments": adjustments,
        "basis": (
            "observed starting villagers + projected Town Center villager completions before the latest "
            "Feudal click, using queue/cancel order, Loom occupancy, projected population-building "
            "completion, population capacity and supported civilization modifiers"
        ),
        "note": (
            "House/Folwark completion is inferred from placement time, decoded builder count and nominal "
            "construction time; walking, retasking, destruction and other engine-state interruptions are not observable."
        ),
    }


def project_opening_statistics(
    *,
    manifest: dict[str, Any],
    body: dict[str, Any],
    catalog: dict[str, Any],
    observed_until_ms: int,
    initial_objects: list[dict[str, Any]] | None = None,
) -> dict[str, dict[str, Any]]:
    results: dict[str, dict[str, Any]] = {}
    initial_objects = initial_objects or []
    for participant in manifest.get("participants", []):
        player_id = int(participant["playerId"])
        research = _player_events(body.get("researchEvents", []), player_id)
        production = _player_events(body.get("productionEvents", []), player_id)
        builds = _player_events(body.get("buildEvents", []), player_id)
        walls = _player_events(body.get("wallEvents", []), player_id)

        age_up = {age: _age_up(research, age) for age in ("feudal", "castle", "imperial")}
        feudal_click = age_up["feudal"]["clickAtMs"]
        feudal_click_source_event_id = age_up["feudal"]["clickSourceEventId"]
        feudal_age_up = age_up["feudal"]["ageUpAtMs"]
        castle_age_up = age_up["castle"]["ageUpAtMs"]

        feudal_boundary = feudal_age_up if feudal_age_up is not None else observed_until_ms + 1
        castle_boundary = castle_age_up if castle_age_up is not None else observed_until_ms + 1
        castle_boundary_name = "castle_age_up" if castle_age_up is not None else "observed_end_no_castle"

        loom_at = _first_research_time(research, LOOM_TECH_ID)
        loom_before_feudal = (
            loom_at < feudal_click if loom_at is not None and feudal_click is not None
            else False if feudal_click is not None
            else None
        )
        wall_tiles_feudal = _wall_tiles(walls, feudal_boundary)
        wall_tiles_castle = _wall_tiles(walls, castle_boundary)

        results[str(player_id)] = {
            "modelVersion": OPENING_STATISTICS_VERSION,
            "ageUp": age_up,
            "firstMilitaryUnitQueued": _first_military_unit(production, catalog),
            "firstMilitaryBuilding": _first_military_building(builds, catalog),
            "firstWallSegment": _first_wall_segment(walls, catalog),
            "wallTilesBeforeFeudal": {
                "layer": "reconstructed",
                "count": len(wall_tiles_feudal),
                "boundary": "feudal_age_up" if feudal_age_up is not None else "observed_end_no_feudal",
            },
            "wallStyle": _wall_style(len(wall_tiles_castle), castle_boundary_name),
            "housesBeforeFeudal": {
                "layer": "reconstructed",
                "count": _count_houses(builds, catalog, feudal_boundary),
                "boundary": "feudal_age_up" if feudal_age_up is not None else "observed_end_no_feudal",
            },
            "villagersBeforeFeudalAge": _villagers_before_feudal(
                production,
                research,
                builds,
                initial_objects,
                participant,
                manifest,
                catalog,
                feudal_click,
                feudal_click_source_event_id,
            ),
            "loomTiming": {
                "layer": "observed",
                "atMs": loom_at,
                "technology": _entity(catalog, "technologies", LOOM_TECH_ID),
            },
            "loomBeforeFeudal": {
                "layer": "reconstructed",
                "value": loom_before_feudal,
                "basis": "loom research request before Feudal Age research request",
            },
        }
    return results
