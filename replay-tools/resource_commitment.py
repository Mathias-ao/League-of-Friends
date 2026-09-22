"""Player-facing resource commitment estimates from canonical command evidence.

This model prices positive unit queue requests, research requests, building
placements and wall tiles using the pinned entity catalog. It intentionally does
not claim exact engine spend: cancellations/refunds, civilization-specific cost
modifiers, market exchange, tribute and resource availability are not simulated.
"""
from __future__ import annotations

from typing import Any, Iterable

from opening_statistics import AGE_RESEARCH_MS, AGE_TECH_IDS, _line_tiles

RESOURCE_COMMITMENT_VERSION = "AOF_RESOURCE_COMMITMENT_V1"
RESOURCE_NAMES = ("Food", "Wood", "Gold", "Stone")
AGE_NAMES = ("dark", "feudal", "castle", "imperial", "unknown")


def _empty_resources() -> dict[str, float]:
    return {name.lower(): 0.0 for name in RESOURCE_NAMES}


def _finalize(values: dict[str, float]) -> dict[str, int | float]:
    result: dict[str, int | float] = {}
    for key, value in values.items():
        result[key] = int(value) if float(value).is_integer() else round(value, 3)
    result["total"] = sum(result.values())
    return result


def _cost(catalog: dict[str, Any], section: str, raw_id: Any) -> dict[str, float] | None:
    item = (catalog.get(section) or {}).get(str(raw_id))
    if not item:
        return None
    raw = item.get("cost") or {}
    result = _empty_resources()
    for resource in RESOURCE_NAMES:
        value = raw.get(resource, 0)
        if not isinstance(value, (int, float)):
            return None
        result[resource.lower()] = float(value)
    return result


def _player_events(events: Iterable[dict[str, Any]], player_id: int) -> list[dict[str, Any]]:
    return sorted(
        (event for event in events if event.get("replaySlot") == player_id),
        key=lambda event: (event.get("atMs", 0), event.get("sourceEventId", "")),
    )


def _latest_research_time(research: list[dict[str, Any]], technology_id: int) -> int | None:
    times = [
        event["atMs"]
        for event in research
        if event.get("technologyId") == technology_id and isinstance(event.get("atMs"), int)
    ]
    return max(times) if times else None


def _age_boundaries(research: list[dict[str, Any]]) -> dict[str, int | None]:
    result: dict[str, int | None] = {}
    for age in ("feudal", "castle", "imperial"):
        click = _latest_research_time(research, AGE_TECH_IDS[age])
        result[age] = click + AGE_RESEARCH_MS[age] if click is not None else None
    return result


def _age_at(at_ms: int, boundaries: dict[str, int | None]) -> str:
    feudal = boundaries["feudal"]
    castle = boundaries["castle"]
    imperial = boundaries["imperial"]
    if feudal is None:
        return "unknown"
    if at_ms < feudal:
        return "dark"
    if castle is None or at_ms < castle:
        return "feudal"
    if imperial is None or at_ms < imperial:
        return "castle"
    return "imperial"


def _add(target: dict[str, float], cost: dict[str, float], multiplier: int) -> None:
    for resource in RESOURCE_NAMES:
        key = resource.lower()
        target[key] += cost[key] * multiplier


def project_resource_commitment(
    *, manifest: dict[str, Any], body: dict[str, Any], catalog: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    results: dict[str, dict[str, Any]] = {}
    for participant in manifest.get("participants", []):
        player_id = int(participant["playerId"])
        production = _player_events(body.get("productionEvents", []), player_id)
        research = _player_events(body.get("researchEvents", []), player_id)
        builds = _player_events(body.get("buildEvents", []), player_id)
        walls = _player_events(body.get("wallEvents", []), player_id)
        boundaries = _age_boundaries(research)

        total = _empty_resources()
        by_age = {age: _empty_resources() for age in AGE_NAMES}
        priced_requests = 0
        unpriced_requests = 0
        priced_wall_tiles = 0

        def price(at_ms: Any, section: str, raw_id: Any, multiplier: int = 1) -> None:
            nonlocal priced_requests, unpriced_requests
            if not isinstance(at_ms, int) or multiplier <= 0:
                return
            cost = _cost(catalog, section, raw_id)
            if cost is None:
                unpriced_requests += 1
                return
            priced_requests += 1
            _add(total, cost, multiplier)
            _add(by_age[_age_at(at_ms, boundaries)], cost, multiplier)

        for event in production:
            amount = event.get("requestedAmountPositive")
            if type(amount) is int and amount > 0:
                price(event.get("atMs"), "units", event.get("unitId"), amount)

        for event in research:
            price(event.get("atMs"), "technologies", event.get("technologyId"))

        for event in builds:
            price(event.get("atMs"), "buildings", event.get("buildingId"))

        for event in walls:
            tiles = len(set(_line_tiles(
                event.get("x"), event.get("y"), event.get("xEnd"), event.get("yEnd"),
            )))
            if tiles <= 0:
                continue
            before_priced = priced_requests
            price(event.get("atMs"), "buildings", event.get("buildingId"), tiles)
            if priced_requests > before_priced:
                priced_wall_tiles += tiles

        results[str(player_id)] = {
            "modelVersion": RESOURCE_COMMITMENT_VERSION,
            "layer": "reconstructed",
            "resourcesCommitted": _finalize(total),
            "byAge": {age: _finalize(values) for age, values in by_age.items()},
            "ageBoundaries": {
                "feudalAgeUpAtMs": boundaries["feudal"],
                "castleAgeUpAtMs": boundaries["castle"],
                "imperialAgeUpAtMs": boundaries["imperial"],
                "basis": "latest observed age-click request + same fixed inferred age-up durations as Opening",
            },
            "coverage": {
                "pricedRequestCommands": priced_requests,
                "unpricedRequestCommands": unpriced_requests,
                "pricedWallTiles": priced_wall_tiles,
            },
            "scope": (
                "base catalog cost of positive unit queue requests, research requests, building placements "
                "and rasterized wall tiles; excludes market exchange, tribute, cancellation/refund effects, "
                "resource-availability validation and civilization-specific cost modifiers"
            ),
        }
    return results
