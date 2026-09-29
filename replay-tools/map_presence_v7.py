"""Map Presence V7 presentation extension over V6.

V7 keeps V6 geometry and scout attribution unchanged, preserves Enemy Base
Contact, and restores the older 30-tile Expansion Town Center fundamental
alongside (not instead of) V6 Expansion Zones. This is useful as a simple
season-showcase metric while Expansion Zones remain the richer spatial model.
"""
from __future__ import annotations

from typing import Any, Iterable

import map_presence as v1
import map_presence_v2 as v2
import map_presence_v6 as v6

MAP_PRESENCE_MODEL_VERSION = "AOF_MAP_PRESENCE_V7"


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

    results = v6.project_map_presence(
        manifest=manifest,
        catalog=catalog,
        initial_objects=initial_objects,
        build_events=build_events,
        wall_events=wall_events,
        action_events=action_events,
    )
    participants = v1._participants(manifest)
    anchors = v1._home_anchors(manifest, catalog, initial_objects)

    for player_id in sorted(participants):
        row = results[str(player_id)]
        row["modelVersion"] = MAP_PRESENCE_MODEL_VERSION
        row["enemyBaseContact"] = v2._enemy_base_found(
            player_id,
            action_events,
            participants=participants,
            anchors=anchors,
        )
        row["expansionTownCenters"] = v2._expansions(
            player_id,
            build_events,
            catalog=catalog,
            anchors=anchors,
        )
    return results
