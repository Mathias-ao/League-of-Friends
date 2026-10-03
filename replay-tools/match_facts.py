"""Versioned recording context. Header facts and observed commands are not outcomes."""
from __future__ import annotations

from copy import deepcopy
import math

MATCH_FACTS_VERSION = "AOF_RECORDING_MATCH_FACTS_V1"

HEADER_KEYS = {
    "de": ("build", "timestamp", "guid", "rms_map_id", "rms_filename", "rms_mod_id",
           "difficulty_id", "population_limit", "speed", "rated", "victory_type_id",
           "starting_resources_id", "starting_age_id", "ending_age_id", "treaty_length",
           "team_together", "lock_teams", "multiplayer", "all_technologies", "game_type_id",
           "map_name", "data_mod", "dataset", "dataset_version"),
    "lobby": ("map_size", "population", "game_type_id", "reveal_map_id", "seed", "lock_teams"),
    "scenario": ("map_id", "map_name", "difficulty_id", "filename"),
    "metadata": ("speed", "owner_id"),
    "map": ("dimension", "restore_time", "all_visible", "name"),
}


def compact_header(header):
    """Keep inference-relevant fields without duplicating chat, terrain or names."""
    result = {key: deepcopy(header.get(key)) for key in
              ("version", "game_version", "save_version", "log_version")}
    for section, keys in HEADER_KEYS.items():
        raw = header.get(section) or {}
        result[section] = {key: deepcopy(raw[key]) for key in keys if key in raw}
    return result


def _safe(value):
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Non-finite recording context")
    if isinstance(value, dict):
        for child in value.values():
            _safe(child)
    elif isinstance(value, list):
        for child in value:
            _safe(child)


def project_match_facts(analysis):
    source = deepcopy(analysis["source"])
    source["canonicalNormalizerVersion"] = (analysis.get("canonicalVersions") or {}).get("normalizerVersion")
    manifest = analysis["manifest"]
    match = manifest.get("match") or {}
    header = analysis.get("recordingHeader") or {}
    header_source = analysis.get("recordingHeaderSource")
    raw_settings = deepcopy(match.get("settings") or {})
    map_data = deepcopy((manifest.get("initialState") or {}).get("map") or {})
    players = sorted(manifest["participants"], key=lambda row: row["playerId"])
    ids = [row["playerId"] for row in players]
    if len(set(ids)) != len(ids) or any(type(player) is not int or player <= 0 for player in ids):
        raise ValueError("Recording context requires unique replay player IDs")
    def observed(value, path):
        return {"value": deepcopy(value), "status": "DECODED" if value is not None else "UNKNOWN",
                "sourcePath": path if value is not None else None,
                "meaning": "parser_reported_header_field"}
    rules = {key: observed(value, "canonical.match.settings." + key)
             for key, value in sorted(raw_settings.items()) if key != "initialDiplomacyRaw"}
    # Preserve both source domains so edition conflicts/zero/false never disappear.
    candidates = {}
    for section, values in header.items():
        if isinstance(values, dict):
            candidates.update({section + "." + key: value for key, value in values.items()})
    affiliations = [{"playerId": row["playerId"], "replaySlot": row.get("number"),
                     "lobbyTeamIdRaw": row.get("lobbyTeamId"),
                     "civilization": deepcopy(row.get("civilization")),
                     "colorId": row.get("colorId"), "isRecorder": row.get("isRecorder"),
                     "assignmentMeaning": "raw_lobby_assignment_not_effective_temporal_alliance"}
                    for row in players]
    groups = {}
    for row in affiliations:
        team = row["lobbyTeamIdRaw"]
        if type(team) is int:
            groups.setdefault(team, []).append(row["playerId"])
    postgame = deepcopy(analysis.get("postgameEvents") or [])
    resignations = deepcopy((analysis.get("body") or {}).get("resignations") or [])
    for event in postgame:
        if not event.get("sourceEventId") or type(event.get("operationOrdinal")) is not int:
            raise ValueError("Postgame context requires source chronology")
    result = {
        "modelVersion": MATCH_FACTS_VERSION,
        "identityNamespace": "CANONICAL_REPLAY_PLAYER_ID",
        "source": source, "headerSource": deepcopy(header_source),
        "game": {"guid": match.get("guid"), "observedDurationMs": match.get("durationMs"),
                 "completionStatus": match.get("completionStatus", "unknown"),
                 "durationMeaning": "observed_recording_interval_not_proven_full_game",
                 "recordingVersion": {key: header.get(key) for key in
                                      ("version", "game_version", "save_version", "log_version")}},
        "map": {**map_data, "identityMeaning": "decoded_ids_and_rms_metadata_not_qualified_map_label"},
        "rules": rules,
        "headerFieldCandidates": deepcopy(candidates),
        "players": affiliations,
        "lobbyGroups": [{"lobbyTeamIdRaw": team, "memberPlayerIds": members,
                        "effectiveAllianceEstablished": False}
                       for team, members in sorted(groups.items())],
        "diplomacy": {"initialRawByPlayer": deepcopy(raw_settings.get("initialDiplomacyRaw") or {}),
                      "normalizedInitialEdges": deepcopy(manifest.get("initialDiplomacy") or []),
                      "commandTimelines": deepcopy((analysis.get("fundamentals") or {}).get(
                          "directedDiplomacyCommandTimelines") or {}),
                      "effectiveRuntimeStateQualified": False},
        "result": {"qualification": "UNRESOLVED", "winnerPlayerIds": None, "loserPlayerIds": None,
                   "canonicalWinnerClaims": deepcopy(match.get("winnerPlayerIds") or []),
                   "canonicalWinnerTeamClaims": deepcopy(match.get("winnerTeamIds") or []),
                   "canonicalWinnerEvidence": deepcopy(match.get("winnerEvidence")),
                   "postgameEvidence": postgame, "resignationEvidence": resignations,
                   "reason": "decoded_postgame_and_resignations_do_not_establish_authoritative_outcome",
                   "officialResultAuthority": "league_Game.canonicalResult_with_current_revision_and_dispute_state"},
        "coverage": {"headerCandidates": "AVAILABLE" if header_source else "UNAVAILABLE",
                     "normalizedInitialDiplomacy": "AVAILABLE" if manifest.get("initialDiplomacy") else "UNAVAILABLE",
                     "postgameObserved": bool(postgame),
                     "officialReplayOutcome": "UNAVAILABLE"},
        "policy": {"automaticResultSubmissionEnabled": False, "rewardsEnabled": False,
                   "relationshipScoringEnabled": False, "reputationScoringEnabled": False,
                   "rawFactsVisibleByDefault": False},
    }
    _safe(result)
    return result
