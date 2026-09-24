"""Map Presence V6 scout-command attribution over V5 spatial fundamentals.

V6 fixes a save-68 MOVE/ORDER selection-ID decoding defect demonstrated by the
committed two-recorder duel fixture. The starting Scout Cavalry identity itself
is unchanged; only command-to-scout attribution is reconstructed.

Canonical/compact parser facts remain untouched. For MOVE/ORDER only, when a
decoded selected-object ID is a 16-bit-left-shifted form of an already-known
starting scout instance ID, V6 uses the matching scout ID for this inferred
metric. Empty/implicit selections remain excluded. Other action families are
not shift-normalized.
"""
from __future__ import annotations

from collections import Counter
import math
from typing import Any, Iterable

import map_presence as v1
import map_presence_v4 as v4
import map_presence_v5 as v5

MAP_PRESENCE_MODEL_VERSION = "AOF_MAP_PRESENCE_V6"

SHIFT16_SELECTION_ACTIONS = {"MOVE", "ORDER"}
SHIFT16_MASK = 0xFFFF


def _selected_candidate_ids(
    event: dict[str, Any],
    candidate_ids: set[int],
) -> tuple[set[int], str | None]:
    """Resolve only candidate IDs; never rewrite canonical objectInstanceIds."""
    observed = {
        value
        for value in (event.get("objectInstanceIds") or [])
        if isinstance(value, int)
    }
    direct = observed.intersection(candidate_ids)
    if direct:
        return direct, "decoded"

    if event.get("sourceActionName") not in SHIFT16_SELECTION_ACTIONS:
        return set(), None

    normalized = {
        value >> 16
        for value in observed
        if value > SHIFT16_MASK and (value & SHIFT16_MASK) == 0
    }
    matched = normalized.intersection(candidate_ids)
    if matched:
        return matched, "save68_shift16_normalized"
    return set(), None


def _candidate_command_diagnostics(
    player_id: int,
    action_events: Iterable[dict[str, Any]],
    candidates: list[dict[str, Any]],
    *,
    home: dict[str, Any] | None,
) -> dict[int, dict[str, Any]]:
    ids = {row["instanceId"] for row in candidates}
    diagnostics = {
        row["instanceId"]: {
            "instanceId": row["instanceId"],
            "rawId": row.get("rawId"),
            "name": row.get("name"),
            "positionedCommandCount": 0,
            "decodedSelectionCommandCount": 0,
            "shift16NormalizedCommandCount": 0,
            "moveLikeCommandCount": 0,
            "uniqueDestinationCount": 0,
            "maximumDestinationDistanceFromHomeTiles": 0.0,
            "_destinations": set(),
        }
        for row in candidates
    }
    move_like = {"MOVE", "ORDER", "PATROL", "ATTACK_MOVE", "DE_ATTACK_MOVE", "SPECIAL", "AI_ORDER"}
    for event in action_events:
        if event.get("actorPlayerId") != player_id:
            continue
        at_ms = event.get("timestampMs")
        if not isinstance(at_ms, int) or at_ms >= v5.SCOUT_COVERAGE_WINDOW_MS:
            continue
        selected, method = _selected_candidate_ids(event, ids)
        if not selected:
            continue
        points = v1._command_points(event)
        if not points:
            continue
        for instance_id in selected:
            row = diagnostics[instance_id]
            row["positionedCommandCount"] += 1
            if method == "decoded":
                row["decodedSelectionCommandCount"] += 1
            elif method == "save68_shift16_normalized":
                row["shift16NormalizedCommandCount"] += 1
            if event.get("sourceActionName") in move_like:
                row["moveLikeCommandCount"] += 1
            for x, y in points:
                row["_destinations"].add((round(float(x), 2), round(float(y), 2)))
                if home is not None:
                    distance = math.hypot(
                        float(x) - float(home["x"]),
                        float(y) - float(home["y"]),
                    )
                    row["maximumDestinationDistanceFromHomeTiles"] = max(
                        row["maximumDestinationDistanceFromHomeTiles"], distance,
                    )
    for row in diagnostics.values():
        row["uniqueDestinationCount"] = len(row.pop("_destinations"))
        row["maximumDestinationDistanceFromHomeTiles"] = round(
            row["maximumDestinationDistanceFromHomeTiles"], 2,
        )
    return diagnostics


def _choose_scout_candidates(
    player_id: int,
    action_events: Iterable[dict[str, Any]],
    initial_objects: Iterable[dict[str, Any]],
    catalog: dict[str, Any],
    *,
    home: dict[str, Any] | None,
) -> tuple[list[dict[str, Any]], str, list[dict[str, Any]]]:
    candidates = v5._initial_owned_unit_candidates(player_id, initial_objects, catalog)
    diagnostics = _candidate_command_diagnostics(
        player_id, action_events, candidates, home=home,
    )
    explicit = [row for row in candidates if v5._is_explicit_scout(row)]
    explicit_with_commands = [
        row for row in explicit
        if diagnostics.get(row["instanceId"], {}).get("positionedCommandCount", 0) > 0
    ]
    if explicit_with_commands:
        return explicit_with_commands, "explicit_scout_identity", list(diagnostics.values())

    ranked = sorted(
        candidates,
        key=lambda row: (
            diagnostics.get(row["instanceId"], {}).get(
                "maximumDestinationDistanceFromHomeTiles", 0.0
            ),
            diagnostics.get(row["instanceId"], {}).get("moveLikeCommandCount", 0),
            diagnostics.get(row["instanceId"], {}).get("positionedCommandCount", 0),
            -row["instanceId"],
        ),
        reverse=True,
    )
    if ranked:
        best = ranked[0]
        diag = diagnostics.get(best["instanceId"], {})
        if (
            diag.get("positionedCommandCount", 0) >= 2
            and (
                diag.get("moveLikeCommandCount", 0) >= 2
                or diag.get("maximumDestinationDistanceFromHomeTiles", 0.0) >= 12.0
            )
        ):
            return [best], "behavioral_starting_unit_fallback", list(diagnostics.values())

    if explicit:
        return explicit, "explicit_scout_identity_no_positioned_commands", list(diagnostics.values())
    return [], "no_supported_starting_scout_observed", list(diagnostics.values())


def _scout_coverage_at_five_minutes(
    player_id: int,
    action_events: Iterable[dict[str, Any]],
    initial_objects: Iterable[dict[str, Any]],
    catalog: dict[str, Any],
    *,
    anchors: dict[int, dict[str, Any]],
    width: int,
    height: int,
) -> dict[str, Any]:
    home = anchors.get(player_id)
    scouts, detection_method, candidate_diagnostics = _choose_scout_candidates(
        player_id,
        action_events,
        initial_objects,
        catalog,
        home=home,
    )
    scout_ids = {row["instanceId"] for row in scouts}
    starting_positions = [
        (float(row["x"]), float(row["y"]))
        for row in scouts
        if isinstance(row.get("x"), (int, float)) and isinstance(row.get("y"), (int, float))
    ]
    previous = starting_positions[0] if starting_positions else None
    route_tiles: set[tuple[int, int]] = set()
    covered_tiles: set[tuple[int, int]] = set()
    evidence: list[str] = []
    attribution_methods: Counter[str] = Counter()
    order_count = 0
    first_at = None
    destination_count = 0

    for event in sorted(
        (item for item in action_events if item.get("actorPlayerId") == player_id),
        key=lambda item: (item.get("timestampMs", 0), item.get("operationOrdinal", 0), item.get("eventId") or ""),
    ):
        at_ms = event.get("timestampMs")
        if not isinstance(at_ms, int) or at_ms >= v5.SCOUT_COVERAGE_WINDOW_MS:
            continue
        selected, method = _selected_candidate_ids(event, scout_ids)
        if not selected:
            continue
        points = [
            (float(x), float(y))
            for x, y in v1._command_points(event)
            if 0 <= float(x) < width and 0 <= float(y) < height
        ]
        if not points:
            continue
        order_count += 1
        if method:
            attribution_methods[method] += 1
        first_at = at_ms if first_at is None else first_at
        if event.get("eventId"):
            evidence.append(event["eventId"])
        for point in points:
            destination_count += 1
            if previous is None:
                segment = {(int(round(point[0])), int(round(point[1])))}
            else:
                segment = set(v4._line_tiles(previous[0], previous[1], point[0], point[1]))
            route_tiles.update(segment)
            covered_tiles.update(
                v5._buffer_route_tiles(
                    segment,
                    width=width,
                    height=height,
                    radius=v5.SCOUT_ROUTE_RADIUS_TILES,
                )
            )
            previous = point

    total_tiles = max(1, width * height)
    return {
        "layer": "inferred",
        "percent": round(100.0 * len(covered_tiles) / total_tiles, 2),
        "orderCount": order_count,
        "firstAtMs": first_at,
        "destinationCount": destination_count,
        "routeTileCount": len(route_tiles),
        "coveredTileCount": len(covered_tiles),
        "totalTileCount": total_tiles,
        "coverageRadiusTiles": v5.SCOUT_ROUTE_RADIUS_TILES,
        "windowEndMs": v5.SCOUT_COVERAGE_WINDOW_MS,
        "startingScoutInstanceIds": sorted(scout_ids),
        "startingScoutRawIds": sorted({
            row["rawId"] for row in scouts if isinstance(row.get("rawId"), int)
        }),
        "candidateDetectionMethod": detection_method,
        "selectionAttributionMethods": dict(sorted(attribution_methods.items())),
        "candidateDiagnostics": sorted(
            candidate_diagnostics,
            key=lambda row: row["instanceId"],
        ),
        "sourceEventIds": evidence,
        "status": "ok" if scouts and order_count else (
            "insufficient_command_attribution" if scouts
            else "no_supported_starting_scout_observed"
        ),
        "scope": (
            "buffered command-directed route from an observed or behaviorally inferred starting "
            "scout candidate during 0:00-5:00. Save-68 MOVE/ORDER selected IDs may be normalized "
            "only when their decoded 32-bit value is the exact 16-bit-left-shifted form of that "
            "known candidate. Empty/implicit selections are excluded. This is a scouting-attention "
            "proxy with a versioned 3.25-tile effective corridor, not literal line of sight, fog-of-war visibility, or actual unit movement"
        ),
    }


def project_map_presence(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    build_events: Iterable[dict[str, Any]],
    wall_events: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    initial_objects = list(initial_objects)
    build_events = list(build_events)
    wall_events = list(wall_events)
    action_events = list(action_events)

    result = v5.project_map_presence(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=build_events,
        wall_events=wall_events,
        action_events=action_events,
    )
    participants = v1._participants(manifest)
    anchors = v1._home_anchors(manifest, catalog, initial_objects)
    map_data = (manifest.get("initialState") or {}).get("map") or {}
    width = int(map_data.get("width") or 1)
    height = int(map_data.get("height") or 1)

    for player_id in sorted(participants):
        player = result[str(player_id)]
        player["modelVersion"] = MAP_PRESENCE_MODEL_VERSION
        player["scoutCoverageAt5Minutes"] = _scout_coverage_at_five_minutes(
            player_id,
            action_events,
            initial_objects,
            catalog,
            anchors=anchors,
            width=width,
            height=height,
        )
    return result
