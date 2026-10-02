"""Compact Chronicle-facing evidence projected from the canonical statistics pipeline.

This module does not score relationships and does not write narrative. It collects
already-qualified, event-backed social observations from the same CanonicalReplay
analysis/statistics artifacts that power player-facing statistics. The projection is
small enough to persist beside statistics and is rebuildable from canonical evidence.

Important boundaries:
- diplomacy commands are commands, not proof of accepted/mutual state by themselves;
- tribute commands are commands, not settled transfers;
- raid/support/engagement rows retain the inference models and source event ids that
  qualified them;
- no motive, damage, kill, success, betrayal, refusal, or coordination intent is added.
"""
from __future__ import annotations

from typing import Any

from analysis_dataset import validate_analysis_dataset


SOCIAL_EVIDENCE_SOURCE_VERSION = "AOF_CHRONICLE_SOCIAL_SOURCE_V1"


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _integer(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _stable_value(value: Any) -> str:
    if isinstance(value, list):
        return "[" + ",".join(_stable_value(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(f"{key}:{_stable_value(value[key])}" for key in sorted(value)) + "}"
    return repr(value)


def _event_key(row: dict[str, Any], id_keys: tuple[str, ...]) -> str:
    if id_keys:
        values = [row.get(key) for key in id_keys]
        if all(value is not None and value != "" for value in values):
            return "ids:" + "|".join(_stable_value(value) for value in values)
    ids = row.get("sourceEventIds")
    if isinstance(ids, list) and ids:
        return "events:" + ",".join(str(item) for item in ids)
    return _stable_value(row)


def _dedupe(rows: list[dict[str, Any]], *id_keys: str) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    keys = tuple(id_keys)
    for row in rows:
        key = _event_key(row, keys)
        if key in seen:
            continue
        seen.add(key)
        result.append(row)
    return result


def _participants(statistics: dict[str, Any]) -> list[int]:
    result: list[int] = []
    for participant in _list(statistics.get("participants")):
        player_id = _integer(_dict(participant).get("playerId"))
        if player_id is not None:
            result.append(player_id)
    return sorted(set(result))


def _diplomacy_commands(statistics: dict[str, Any]) -> list[dict[str, Any]]:
    command_evidence = _dict(statistics.get("commandEvidence"))
    timelines = _dict(command_evidence.get("directedDiplomacyCommands"))
    rows: list[dict[str, Any]] = []
    for direction in sorted(timelines):
        for raw in _list(timelines[direction]):
            row = _dict(raw)
            actor = _integer(row.get("replaySlot"))
            target = _integer(row.get("targetReplaySlot"))
            at_ms = _integer(row.get("atMs"))
            ordinal = _integer(row.get("operationOrdinal"))
            event_id = row.get("sourceEventId")
            if actor is None or target is None or at_ms is None or ordinal is None or not isinstance(event_id, str):
                continue
            rows.append({
                "eventId": event_id,
                "atMs": at_ms,
                "operationOrdinal": ordinal,
                "fromPlayerId": actor,
                "toPlayerId": target,
                "rawMode": row.get("diplomacyMode"),
                "rawCommandId": row.get("commandId"),
            })
    rows.sort(key=lambda row: (row["atMs"], row["operationOrdinal"], row["eventId"]))
    return rows


def _tribute_commands(statistics: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    command_evidence = _dict(statistics.get("commandEvidence"))
    for raw in _list(command_evidence.get("tributeCommands")):
        row = _dict(raw)
        actor = _integer(row.get("replaySlot"))
        target = _integer(row.get("targetReplaySlot"))
        at_ms = _integer(row.get("atMs"))
        event_id = row.get("sourceEventId")
        if actor is None or target is None or at_ms is None or not isinstance(event_id, str):
            continue
        rows.append({
            "eventId": event_id,
            "atMs": at_ms,
            "sourcePlayerId": actor,
            "targetPlayerId": target,
            "resourceId": row.get("resourceId"),
            "amount": row.get("amount"),
            "fee": row.get("fee"),
            "food": row.get("food"),
            "wood": row.get("wood"),
            "gold": row.get("gold"),
            "stone": row.get("stone"),
        })
    rows.sort(key=lambda row: (row["atMs"], row["eventId"]))
    return rows


def _participant_social_rows(statistics: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    raids: list[dict[str, Any]] = []
    battles: list[dict[str, Any]] = []
    reinforcements: list[dict[str, Any]] = []
    defensive_assists: list[dict[str, Any]] = []
    cooperative_attacks: list[dict[str, Any]] = []
    forward_buildings: list[dict[str, Any]] = []
    enemy_base_contacts: list[dict[str, Any]] = []

    for raw_participant in _list(statistics.get("participants")):
        participant = _dict(raw_participant)
        player_id = _integer(participant.get("playerId"))
        if player_id is None:
            continue
        military = _dict(participant.get("military"))
        engagements = _dict(military.get("engagements"))
        raid_evidence = _dict(engagements.get("raidEvidence"))
        raids.extend(_dict(row) for row in _list(raid_evidence.get("initiatedEpisodes")))

        engagement_evidence = _dict(engagements.get("engagementEvidence"))
        battles.extend(_dict(row) for row in _list(engagement_evidence.get("battles")))
        reinforcements.extend(_dict(row) for row in _list(engagement_evidence.get("allyReinforcementsSent")))
        defensive_assists.extend(_dict(row) for row in _list(engagement_evidence.get("defensiveAssistsGiven")))
        cooperative_attacks.extend(_dict(row) for row in _list(engagement_evidence.get("cooperativeAttacks")))

        map_presence = _dict(participant.get("mapPresence"))
        forward = _dict(map_presence.get("forwardBuildings"))
        for raw in _list(forward.get("evidence")):
            row = _dict(raw)
            forward_buildings.append({"sourcePlayerId": player_id, **row})

        contact = _dict(map_presence.get("enemyBaseContact"))
        for enemy_id, raw in sorted(_dict(contact.get("firstByEnemy")).items()):
            row = _dict(raw)
            enemy_player_id = _integer(row.get("enemyPlayerId"))
            if enemy_player_id is None and str(enemy_id).isdigit():
                enemy_player_id = int(enemy_id)
            if enemy_player_id is None:
                continue
            enemy_base_contacts.append({
                "sourcePlayerId": player_id,
                "targetPlayerId": enemy_player_id,
                **row,
            })

    return {
        "raids": _dedupe(raids, "raidId"),
        "battles": _dedupe(battles, "battleId"),
        "reinforcements": _dedupe(reinforcements, "reinforcementId"),
        "defensiveAssists": _dedupe(defensive_assists, "battleId", "helperPlayerId", "defendedPlayerId"),
        # A Battle can contain more than one allied side/target grouping. Preserve
        # the whole semantic row rather than treating battleId as unique here.
        "cooperativeAttacks": _dedupe(cooperative_attacks),
        "forwardBuildings": _dedupe(forward_buildings, "sourceEventId"),
        "enemyBaseContacts": _dedupe(enemy_base_contacts, "sourceEventId"),
    }


def project_social_evidence_source(
    analysis: dict[str, Any],
    statistics: dict[str, Any],
) -> dict[str, Any]:
    """Build the compact neutral source consumed by the live Chronicle adapter."""
    validate_analysis_dataset(analysis)
    player_ids = _participants(statistics)
    manifest = _dict(analysis.get("manifest"))
    match = _dict(manifest.get("match"))
    settings = _dict(match.get("settings"))
    source = _dict(statistics.get("source"))
    scope = _dict(statistics.get("scope"))
    rows = _participant_social_rows(statistics)

    analysis_player_ids = sorted(
        player_id
        for player_id in (
            _integer(_dict(row).get("playerId")) for row in _list(manifest.get("participants"))
        )
        if player_id is not None
    )
    if player_ids != analysis_player_ids:
        raise ValueError("Chronicle social source participant set differs from canonical analysis participants")

    duration_ms = _integer(scope.get("observedUntilMs"))
    if duration_ms is None:
        duration_ms = _integer(match.get("durationMs"))
    if duration_ms is None or duration_ms < 0:
        raise ValueError("Chronicle social source requires a non-negative observed duration")

    return {
        "schemaVersion": SOCIAL_EVIDENCE_SOURCE_VERSION,
        "source": {
            "replaySha256": source.get("replaySha256"),
            "canonicalManifestSha256": source.get("canonicalManifestSha256"),
            "extractionRunId": source.get("extractionRunId"),
            "canonicalSchemaVersion": source.get("canonicalSchemaVersion"),
            "statisticsProjectionVersion": statistics.get("statisticsProjectionVersion"),
        },
        "match": {
            "durationMs": duration_ms,
            "settings": {
                "lockTeams": settings.get("lockTeams"),
                "initialDiplomacyRaw": settings.get("initialDiplomacyRaw"),
            },
        },
        "playerIds": player_ids,
        "initialDiplomacy": _list(manifest.get("initialDiplomacy")),
        "diplomacyCommands": _diplomacy_commands(statistics),
        "tributeCommands": _tribute_commands(statistics),
        **rows,
        "coverage": {
            "canonicalCoverageVersion": _dict(analysis.get("coverage")).get("coverageVersion"),
            "decodeCoveragePercent": scope.get("decodeCoveragePercent"),
            "decodeCoverageMeaning": scope.get("decodeCoverageMeaning"),
            "bodyFramingStatus": _dict(_dict(analysis.get("coverage")).get("framing")).get("status"),
        },
        "semantics": {
            "diplomacyCommandsAreRequestedChanges": True,
            "tributeCommandsAreNotSettledTransfers": True,
            "engagementsAreInferredFromCommands": True,
            "narrativeOrRelationshipInterpretationIncluded": False,
        },
    }
