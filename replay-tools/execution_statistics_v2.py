"""Execution V2 early-game extensions over the locked V1 model.

V2 keeps V1 execution semantics intact and adds season-showcase metrics whose
boundaries are supported by existing replay evidence. Dark Age uses the latest
observed Feudal research request so an earlier cancelled/retried age click does
not prematurely truncate the interval.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable

import execution_statistics as v1
from opening_statistics import AGE_TECH_IDS, _latest_research_event

EXECUTION_MODEL_VERSION = "AOF_EXECUTION_STATISTICS_V2"
FIRST_FIVE_MINUTES_MS = 5 * 60_000


def _player_actions(
    action_events: Iterable[dict[str, Any]], participant_ids: set[int],
) -> dict[int, list[dict[str, Any]]]:
    result: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for event in action_events:
        actor = event.get("actorPlayerId")
        if actor in participant_ids:
            result[int(actor)].append(event)
    for rows in result.values():
        rows.sort(
            key=lambda event: (
                event.get("timestampMs", 0),
                event.get("operationOrdinal", 0),
                event.get("eventId") or "",
            )
        )
    return result


def _latest_feudal_click(
    research_events: Iterable[dict[str, Any]], player_id: int,
) -> dict[str, Any] | None:
    rows = sorted(
        (
            event for event in research_events
            if event.get("replaySlot") == player_id
        ),
        key=lambda event: (event.get("atMs", 0), str(event.get("sourceEventId") or "")),
    )
    return _latest_research_event(rows, AGE_TECH_IDS["feudal"])


def _dark_age_action_gap(
    actions: list[dict[str, Any]], feudal_click: dict[str, Any] | None,
) -> dict[str, Any]:
    boundary_ms = feudal_click.get("atMs") if feudal_click else None
    if not isinstance(boundary_ms, int):
        return {
            "layer": "observed",
            "valueMs": None,
            "boundaryMs": None,
            "actionCount": None,
            "unavailableReason": "No supported Feudal research request boundary.",
            "basis": "consecutive decoded ACTION timestamps before the latest Feudal click",
        }

    times = [
        int(event["timestampMs"])
        for event in actions
        if isinstance(event.get("timestampMs"), int)
        and event["timestampMs"] < boundary_ms
    ]
    gaps = [right - left for left, right in zip(times, times[1:]) if right >= left]
    return {
        "layer": "observed",
        "valueMs": max(gaps) if gaps else None,
        "boundaryMs": boundary_ms,
        "boundarySourceEventId": feudal_click.get("sourceEventId"),
        "actionCount": len(times),
        "basis": (
            "largest gap between consecutive decoded player ACTION timestamps strictly before "
            "the latest observed Feudal research request; pre-first-command and click-boundary "
            "edges are excluded, matching the general longest-inactivity convention"
        ),
    }


def project_execution_statistics(
    *,
    manifest: dict[str, Any],
    catalog: dict[str, Any],
    initial_objects: Iterable[dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
    duration_ms: int,
    raid_statistics: dict[str, dict[str, Any]],
    skirmish_statistics: dict[str, Any],
    military_statistics: dict[str, dict[str, Any]],
    terrain_elevation: dict[str, Any],
    build_events: Iterable[dict[str, Any]],
    body: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    action_events = list(action_events)
    initial_objects = list(initial_objects)
    build_events = list(build_events)
    results = v1.project_execution_statistics(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        action_events=action_events,
        duration_ms=duration_ms,
        raid_statistics=raid_statistics,
        skirmish_statistics=skirmish_statistics,
        military_statistics=military_statistics,
        terrain_elevation=terrain_elevation,
        build_events=build_events,
    )

    participant_ids = {int(row["playerId"]) for row in manifest.get("participants", [])}
    actions_by_player = _player_actions(action_events, participant_ids)
    research_events = body.get("researchEvents", [])

    for player_id in sorted(participant_ids):
        actions = actions_by_player.get(player_id, [])
        feudal_click = _latest_feudal_click(research_events, player_id)
        row = results[str(player_id)]
        row["modelVersion"] = EXECUTION_MODEL_VERSION
        row["commandsFirstFiveMinutes"] = {
            "layer": "observed",
            "count": sum(
                isinstance(event.get("timestampMs"), int)
                and event["timestampMs"] < FIRST_FIVE_MINUTES_MS
                for event in actions
            ),
            "boundaryMs": FIRST_FIVE_MINUTES_MS,
            "basis": "decoded player ACTION operations during 0:00-5:00 on the observed sync clock",
        }
        row["longestActionGapDarkAge"] = _dark_age_action_gap(actions, feudal_click)
    return results
