"""Military V5 season-showcase extensions over the locked V4 model.

The added Military Techs metric counts distinct supported military-side
technology requests rather than raw clicks. This prevents cancelled/retried
one-time technologies from being counted twice while retaining first/latest
request evidence for audit. Research-building completion is not inferred.
"""
from __future__ import annotations

from typing import Any

import military_statistics as v4

MILITARY_STATISTICS_VERSION = "AOF_MILITARY_STATISTICS_V5"


def _military_techs(
    research: list[dict[str, Any]], catalog: dict[str, Any],
) -> dict[str, Any]:
    excluded = (
        set(v4.AGE_TECH_ID_SET)
        | set(v4.ECO_TECH_IDS)
        | set(v4.UNIVERSITY_TECH_IDS)
        | set(v4.NON_MILITARY_UTILITY_TECH_IDS)
    )
    by_id: dict[int, list[dict[str, Any]]] = {}
    unresolved_ids: set[int] = set()

    for event in research:
        tech_id = event.get("technologyId")
        if not isinstance(tech_id, int) or tech_id in excluded:
            continue
        if not v4._catalog_item(catalog, "technologies", tech_id):
            unresolved_ids.add(tech_id)
            continue
        if not isinstance(event.get("atMs"), int):
            continue
        by_id.setdefault(tech_id, []).append(event)

    rows: list[dict[str, Any]] = []
    for tech_id, events in sorted(by_id.items()):
        events.sort(key=lambda event: (event["atMs"], str(event.get("sourceEventId") or "")))
        first = events[0]
        latest = events[-1]
        rows.append({
            "technology": v4._entity(catalog, "technologies", tech_id),
            "group": "blacksmith" if tech_id in v4.BLACKSMITH_TECH_IDS else "militaryBuildingOrCastle",
            "firstRequestedAtMs": first["atMs"],
            "latestRequestedAtMs": latest["atMs"],
            "requestCount": len(events),
            "sourceEventId": latest.get("sourceEventId"),
        })

    request_count = sum(row["requestCount"] for row in rows)
    blacksmith_count = sum(row["group"] == "blacksmith" for row in rows)
    other_count = len(rows) - blacksmith_count
    return {
        "layer": "observed",
        "count": len(rows),
        "blacksmithUpgradeCount": blacksmith_count,
        "militaryBuildingOrCastleTechCount": other_count,
        "requestCountTotal": request_count,
        "repeatRequestCount": request_count - len(rows),
        "technologies": rows,
        "unresolvedDistinctTechnologyIds": sorted(unresolved_ids),
        "basis": (
            "distinct catalog-resolved research IDs after excluding age advances, supported economy "
            "technologies, supported University technologies and Town Watch/Patrol utility techs. "
            "Blacksmith IDs are identified explicitly; the remaining supported military-side set "
            "covers military-building/Castle/Monastery/naval military research without claiming the "
            "later-built producer structure. Repeated requests count once and latest request evidence "
            "is retained for cancelled/retried one-time technologies"
        ),
    }


def project_military_statistics(
    *,
    manifest: dict[str, Any],
    body: dict[str, Any],
    catalog: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    results = v4.project_military_statistics(
        manifest=manifest,
        body=body,
        catalog=catalog,
    )
    for participant in manifest.get("participants", []):
        player_id = int(participant["playerId"])
        research = v4._player_events(body.get("researchEvents", []), player_id)
        row = results[str(player_id)]
        row["modelVersion"] = MILITARY_STATISTICS_VERSION
        row["militaryTechs"] = _military_techs(research, catalog)
    return results
