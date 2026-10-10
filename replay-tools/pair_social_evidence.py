"""Neutral, Game-scoped interpersonal evidence from versioned statistics.

No scores, motives, absence claims or relationship state. Commands are evidence,
not outcomes. Replay player IDs are deliberately not durable league identities.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
from itertools import combinations
import json
from typing import Any, Iterable

PAIR_SOCIAL_EVIDENCE_VERSION = "AOF_PAIR_SOCIAL_EVIDENCE_V1"
PAIR_EVIDENCE_VERSION = "AOF_SKIRMISH_PAIR_EVIDENCE_V2"
ENGAGEMENT_VERSION = "AOF_ENGAGEMENT_STATISTICS_V4"
RAID_VERSION = "AOF_RAID_DETECTION_V3"
FAMILIES = (
    "DIRECTED_PRESSURE", "LOCAL_CONTEST", "ALLIED_SUPPORT",
    "SHARED_OFFENSIVE_PARTICIPATION", "SPATIAL_PRESSURE",
    "RELIC_OUTCOME", "ECONOMIC_TRANSFER", "EFFECTIVE_DIPLOMACY",
    "COOPERATION_OPPORTUNITY",
)


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _id(prefix: str, revision: dict, value: Any) -> str:
    return prefix + "-" + sha256(_json([PAIR_SOCIAL_EVIDENCE_VERSION, revision, value]).encode()).hexdigest()


def _ids(rows: Iterable[Any]) -> list[str]:
    return sorted({row for row in rows if isinstance(row, str) and row})


def _same_team(a: dict, b: dict) -> bool:
    team = a.get("lobbyTeamId")
    return type(team) is int and team > 0 and team == b.get("lobbyTeamId")


def project_pair_social_evidence(
    *, manifest: dict[str, Any], source: dict[str, Any],
    raid_statistics: dict[str, dict[str, Any]],
    engagement_statistics: dict[str, dict[str, Any]],
    map_presence_statistics: dict[str, dict[str, Any]],
    action_events: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    """Consume statistics plus a source-event chronology lookup, without parsing.

    Missing families stay unavailable. Positive observations do not establish
    completeness, non-contact, non-cooperation or an opportunity to assist.
    """
    revision_keys = ("replaySha256", "recordedEventsSha256", "recordedEventsVersion", "parserVersion") if "recordedEventsVersion" in source else (
        "replaySha256", "canonicalManifestSha256", "canonicalSchemaVersion", "parserVersion")
    revision = {key: source.get(key) for key in revision_keys}
    if not all(isinstance(revision[key], str) and revision[key] for key in revision):
        raise ValueError("Pair social evidence requires recorded events source revision provenance" if "recordedEventsVersion" in source
                         else "Pair social evidence requires canonical source revision provenance")
    participants = {row["playerId"]: row for row in manifest.get("participants", [])}
    if len(participants) != len(manifest.get("participants", [])):
        raise ValueError("Duplicate replay player identity")
    if any(type(player) is not int or player <= 0 for player in participants):
        raise ValueError("Pair social evidence requires explicit numeric replay player identities")
    lock_teams = ((manifest.get("match") or {}).get("settings") or {}).get("lockTeams")
    fixed = lock_teams is True
    diagnostics: list[dict[str, Any]] = []
    lookup: dict[str, dict[str, Any]] = {}
    for event in action_events:
        event_id = event.get("eventId")
        if not isinstance(event_id, str) or not event_id:
            continue
        if event_id in lookup and lookup[event_id] != event:
            raise ValueError("Conflicting canonical event identity: " + event_id)
        lookup[event_id] = deepcopy(event)
    observations: dict[str, dict] = {}
    incidents: dict[str, dict] = {}

    def warn(code: str, family: str, refs: Iterable[str]) -> None:
        diagnostics.append({"code": code, "family": family, "sourceEventIds": _ids(refs)})

    def relation(a: int, b: int) -> str:
        if not fixed:
            return "UNKNOWN"
        return "FIXED_ALLIES" if _same_team(participants[a], participants[b]) else "FIXED_OPPONENTS"

    def register(
        family: str, pair: list[int], model: str, evidence_id: Any,
        event_ids: Iterable[str], facets: list[dict], *, link_ids: Iterable[str] = (),
        context_refs: Iterable[str] = (), context: dict | None = None,
    ) -> None:
        if len(set(pair)) != 2 or any(player not in participants for player in pair):
            warn("INVALID_PAIR_ATTRIBUTION", family, event_ids)
            return
        pair = sorted(pair)
        refs = _ids(event_ids)
        if not refs or any(ref not in lookup for ref in refs):
            warn("SOURCE_PROVENANCE_UNAVAILABLE", family, refs)
            return
        events = [lookup[ref] for ref in refs]
        if any(type(event.get("timestampMs")) is not int for event in events):
            warn("SOURCE_CHRONOLOGY_UNAVAILABLE", family, refs)
            return
        moments = []
        for event in events:
            ordinal = event.get("operationOrdinal")
            moments.append({
                "atMs": event["timestampMs"],
                "operationOrdinal": ordinal if type(ordinal) is int and ordinal >= 0 else None,
            })
            observations[event["eventId"]] = {
                "sourceEventId": event["eventId"],
                "actorPlayerId": event.get("actorPlayerId"),
                "moment": moments[-1],
                "commandType": event.get("sourceActionName"),
            }
        ordered = sorted(moments, key=lambda moment: (
            moment["atMs"], moment["operationOrdinal"] if moment["operationOrdinal"] is not None else -1,
        ))
        chronology = "QUALIFIED" if all(row["operationOrdinal"] is not None for row in moments) else "UNAVAILABLE"
        # List indices/raid-N/battle-N are references, never identity authority.
        semantic = {
            "family": family, "pairPlayerIds": pair, "sourceModelVersion": model,
            "sourceEventIds": refs, "facets": sorted(facets, key=_json),
            "context": context or {},
        }
        incident_id = _id("incident", revision, semantic)
        row = {
            **semantic, "incidentId": incident_id,
            "startedAt": ordered[0], "endedAt": ordered[-1],
            "chronologyCoverage": chronology,
            "relationContext": relation(*pair),
            "linkEventIds": _ids(ref for ref in link_ids if ref in refs),
            "contextSourceEventIds": _ids(context_refs),
            "sourceReferences": [{"family": family, "modelVersion": model, "evidenceId": evidence_id}],
            "claimLayer": "INFERRED_COMMAND_EPISODE",
        }
        if incident_id in incidents:
            old = incidents[incident_id]
            old["sourceReferences"] = sorted(
                {_json(ref): ref for ref in old["sourceReferences"] + row["sourceReferences"]}.values(), key=_json,
            )
        else:
            incidents[incident_id] = row

    # Initiated/received lists and participant copies are intentionally deduped.
    for player in sorted(raid_statistics, key=str):
        for key in ("initiatedEpisodes", "receivedEpisodes"):
            for raid in (raid_statistics[player].get("raidEvidence") or {}).get(key, []):
                if raid.get("modelVersion") != RAID_VERSION:
                    warn("UNSUPPORTED_SOURCE_MODEL", "DIRECTED_PRESSURE", raid.get("sourceEventIds", []))
                    continue
                a, b = raid.get("attackerPlayerId"), raid.get("victimPlayerId")
                refs = _ids(raid.get("sourceEventIds", []))
                # Only actual attacker commands may support this direction.
                if any(ref in lookup and lookup[ref].get("actorPlayerId") != a for ref in refs):
                    warn("INVALID_DIRECTION_PROVENANCE", "DIRECTED_PRESSURE", refs)
                    continue
                methods = sorted(set(raid.get("victimResolutionMethods") or []))
                register(
                    "DIRECTED_PRESSURE", [a, b], RAID_VERSION, raid.get("raidId"), refs,
                    [{"kind": "ECONOMY_PRESSURE", "fromPlayerId": a, "toPlayerId": b,
                      "attributionMethods": methods, "sourceEventIds": refs,
                      "outcomes": "UNAVAILABLE"}],
                    link_ids=[ref for ref in refs if ref in lookup and lookup[ref].get("sourceActionName")
                              in {"ORDER", "DE_ATTACK_MOVE", "ATTACK_GROUND"}],
                    context={"center": raid.get("center"), "victimResolutionMethods": methods},
                )

    for player in sorted(engagement_statistics, key=str):
        stats = engagement_statistics[player]
        evidence = stats.get("engagementEvidence") or {}
        if stats.get("engagementModelVersion") != ENGAGEMENT_VERSION:
            warn("UNSUPPORTED_SOURCE_MODEL", "LOCAL_CONTEST", [])
            continue
        skirmishes = {row.get("skirmishId"): row for row in evidence.get("skirmishes", [])}
        battles = {row.get("battleId"): row for row in evidence.get("battles", [])}
        for skirmish in skirmishes.values():
            by_pair: dict[tuple[int, int], list[dict]] = {}
            for edge in skirmish.get("directedInteractionEdges") or []:
                a, b = edge.get("fromPlayerId"), edge.get("toPlayerId")
                if a not in participants or b not in participants or a == b:
                    continue
                if edge.get("pairEvidenceVersion") != PAIR_EVIDENCE_VERSION:
                    warn("UNQUALIFIED_PAIR_METHOD_PROVENANCE", "LOCAL_CONTEST", edge.get("sourceEventIds", []))
                    continue
                by_pair.setdefault(tuple(sorted((a, b))), []).append(edge)
            for pair, edges in sorted(by_pair.items()):
                facets, refs, links = [], set(), set()
                for edge in edges:
                    targeted, overlap = set(), set()
                    target_details = []
                    for obs in edge.get("observations") or []:
                        ref = obs.get("sourceEventId")
                        event = lookup.get(ref)
                        if not event or event.get("actorPlayerId") != edge["fromPlayerId"]:
                            warn("INVALID_DIRECTION_PROVENANCE", "LOCAL_CONTEST", [ref])
                            continue
                        method = obs.get("method") or ""
                        if method.startswith("targeted_controlled_object:") and event.get("sourceActionName") == "ORDER":
                            if type(event.get("operationOrdinal")) is not int:
                                warn("TARGET_ORDER_UNAVAILABLE", "LOCAL_CONTEST", [ref])
                                continue
                            controller = obs.get("controllerEvidence") or {}
                            if (controller.get("controllerPlayerId") != edge["toPlayerId"]
                                    or not controller.get("sourceEventId")
                                    or obs.get("targetInstanceId") != event.get("targetInstanceId")):
                                warn("CONTROLLER_PROVENANCE_UNAVAILABLE", "LOCAL_CONTEST", [ref])
                                continue
                            targeted.add(ref)
                            target_details.append({
                                "sourceEventId": ref, "targetInstanceId": obs.get("targetInstanceId"),
                                "controllerEvidence": deepcopy(controller),
                            })
                        elif method == "local_opposition_overlap":
                            other = obs.get("counterpartSourceEventId")
                            if other not in lookup or lookup[other].get("actorPlayerId") != edge["toPlayerId"]:
                                warn("OVERLAP_COUNTERPART_UNAVAILABLE", "LOCAL_CONTEST", [ref, other])
                                continue
                            overlap.update([ref, other])
                    if targeted:
                        links.update(targeted)
                        refs.update(targeted)
                        facets.append({
                            "kind": "TARGETED_COMMAND", "fromPlayerId": edge["fromPlayerId"],
                            "toPlayerId": edge["toPlayerId"], "sourceEventIds": sorted(targeted),
                            "outcomes": "UNAVAILABLE",
                            "targetEvidence": sorted(target_details, key=_json),
                        })
                    refs.update(overlap)
                    links.update(ref for ref in overlap if ref in lookup and
                                 lookup[ref].get("sourceActionName") in {"DE_ATTACK_MOVE", "ATTACK_GROUND"})
                    if overlap:
                        facets.append({
                            "kind": "LOCAL_COMMAND_OVERLAP", "contributorPlayerId": edge["fromPlayerId"],
                            "otherPlayerId": edge["toPlayerId"], "sourceEventIds": sorted(overlap),
                            "targetedActionEstablished": False,
                        })
                # Promotion is metadata on this root; it is never a second incident.
                promoted = [row for row in battles.values() if row.get("sourceSkirmishId") == skirmish.get("skirmishId")]
                register(
                    "LOCAL_CONTEST", list(pair), PAIR_EVIDENCE_VERSION, skirmish.get("skirmishId"),
                    refs, facets, link_ids=links,
                    context={"center": skirmish.get("center"),
                             "battlePromotion": any(all(p in row.get("participantPlayerIds", []) for p in pair) for row in promoted)},
                )

        for name in ("allyReinforcementsSent", "allyReinforcementsReceived",
                     "defensiveAssistsGiven", "defensiveAssistsReceived"):
            for support in evidence.get(name, []):
                a = support.get("helperPlayerId")
                b = support.get("supportedPlayerId", support.get("defendedPlayerId"))
                if a not in participants or b not in participants or a == b or relation(a, b) != "FIXED_ALLIES":
                    continue
                if support.get("modelVersion") != ENGAGEMENT_VERSION:
                    continue
                refs = _ids(support.get("sourceEventIds", []))
                if any(ref in lookup and lookup[ref].get("actorPlayerId") != a for ref in refs):
                    warn("INVALID_DIRECTION_PROVENANCE", "ALLIED_SUPPORT", refs)
                    continue
                seed = support.get("baseSeed") or {}
                register(
                    "ALLIED_SUPPORT", [a, b], ENGAGEMENT_VERSION,
                    support.get("reinforcementId", support.get("battleId")), refs,
                    [{"kind": "DEFENSIVE_PARTICIPATION" if name.startswith("defensive") else "REINFORCEMENT_COMMANDS",
                      "fromPlayerId": a, "toPlayerId": b, "sourceEventIds": refs,
                      "unitClassEvidence": support.get("unitClassEvidence"), "outcomes": "UNAVAILABLE"}],
                    link_ids=refs, context_refs=[seed.get("sourceEventId")],
                    context={"baseSeed": seed},
                )

        for attack in evidence.get("cooperativeAttacks", []):
            target = attack.get("targetPlayerId")
            attackers = sorted(set(attack.get("attackerPlayerIds") or []))
            if target not in participants or attack.get("targetPlayerIds") != [target]:
                warn("TARGET_SPECIFIC_GROUP_UNAVAILABLE", "SHARED_OFFENSIVE_PARTICIPATION", attack.get("sourceEventIds", []))
                continue
            edges = attack.get("directedInteractionEdges") or []
            for a, b in combinations(attackers, 2):
                if a not in participants or b not in participants or relation(a, b) != "FIXED_ALLIES":
                    continue
                if relation(a, target) != "FIXED_OPPONENTS" or relation(b, target) != "FIXED_OPPONENTS":
                    continue
                refs, contributions = set(), []
                for actor in (a, b):
                    actor_refs = set()
                    for edge in edges:
                        if {edge.get("fromPlayerId"), edge.get("toPlayerId")} != {actor, target}:
                            continue
                        for ref in edge.get("sourceEventIds") or []:
                            if ref in lookup and lookup[ref].get("actorPlayerId") == actor:
                                actor_refs.add(ref)
                    if actor_refs:
                        contributions.append({"contributorPlayerId": actor, "sourceEventIds": sorted(actor_refs)})
                        refs.update(actor_refs)
                if len(contributions) != 2:
                    warn("CONTRIBUTOR_PROVENANCE_UNAVAILABLE", "SHARED_OFFENSIVE_PARTICIPATION", refs)
                    continue
                register(
                    "SHARED_OFFENSIVE_PARTICIPATION", [a, b], ENGAGEMENT_VERSION, attack.get("battleId"), refs,
                    [{"kind": "SHARED_OPPONENT_PARTICIPATION", "targetPlayerId": target,
                      "contributions": contributions, "coordinationIntent": "UNAVAILABLE"}],
                    link_ids=refs, context={"targetPlayerId": target},
                )

    # Roots remain separate. One contest may attach to exactly one directed
    # pressure root using shared targeted evidence. Overlap cannot bridge raids.
    roots = sorted(incidents.values(), key=lambda row: row["incidentId"])
    groups = {row["incidentId"]: [row] for row in roots if row["family"] != "LOCAL_CONTEST"}
    for row in [item for item in roots if item["family"] == "LOCAL_CONTEST"]:
        candidates = [
            root for root in roots
            if root["family"] == "DIRECTED_PRESSURE"
            and root["pairPlayerIds"] == row["pairPlayerIds"]
            and set(root["linkEventIds"]) & set(row["linkEventIds"])
        ]
        if len(candidates) == 1:
            groups[candidates[0]["incidentId"]].append(row)
        else:
            groups[row["incidentId"]] = [row]
            if len(candidates) > 1:
                row["independence"] = "UNRESOLVED"
                warn("MULTIPLE_PRESSURE_ROOTS_NOT_MERGED", "LOCAL_CONTEST", row["sourceEventIds"])

    deeds = []
    for members in groups.values():
        facets = sorted({_json(facet): facet for row in members for facet in row["facets"]}.values(), key=_json)
        moments = [moment for row in members for moment in (row["startedAt"], row["endedAt"])]
        moments.sort(key=lambda moment: (moment["atMs"], moment["operationOrdinal"] if moment["operationOrdinal"] is not None else -1))
        member_ids = sorted(row["incidentId"] for row in members)
        deeds.append({
            "deedId": _id("deed", revision, member_ids),
            "pairPlayerIds": members[0]["pairPlayerIds"],
            "incidentIds": member_ids, "facets": facets,
            "startedAt": moments[0], "endedAt": moments[-1],
            "activeWindows": [{"startedAt": row["startedAt"], "endedAt": row["endedAt"],
                              "incidentId": row["incidentId"]} for row in sorted(members, key=lambda row: row["incidentId"])],
            "durationMeaning": "command_evidence_envelope_not_continuous_activity",
            "sourceEventIds": _ids(ref for row in members for ref in row["sourceEventIds"]),
            "relationContext": members[0]["relationContext"],
            "independence": "UNRESOLVED" if any(row.get("independence") == "UNRESOLVED" for row in members) else "SOURCE_EPISODE",
            "mergeReason": "shared_pair_specific_strong_command_evidence" if len(members) > 1 else "source_episode",
        })

    coverage = []
    for a, b in combinations(sorted(participants), 2):
        for actor, other in ((a, b), (b, a)):
            for family in FAMILIES:
                status, reason = "UNAVAILABLE", "family_not_qualified"
                stats = engagement_statistics.get(str(actor), {})
                if family in {"DIRECTED_PRESSURE", "LOCAL_CONTEST"}:
                    available = (raid_statistics.get(str(actor), {}).get("modelVersion") == RAID_VERSION
                                 if family == "DIRECTED_PRESSURE"
                                 else stats.get("engagementModelVersion") == ENGAGEMENT_VERSION)
                    if fixed and relation(actor, other) == "FIXED_ALLIES":
                        status, reason = "NOT_APPLICABLE", "fixed_allies_excluded_by_opposition_source"
                    elif fixed and available:
                        status, reason = "QUALIFIED", "versioned_positive_command_episode_projection"
                    elif not fixed:
                        reason = "effective_alignment_unknown_static_source_is_partial"
                elif family in {"ALLIED_SUPPORT", "SHARED_OFFENSIVE_PARTICIPATION"}:
                    if fixed and relation(actor, other) == "FIXED_OPPONENTS":
                        status, reason = "NOT_APPLICABLE", "fixed_opponents_are_not_allied"
                    elif fixed and stats.get("allyInteractionApplicability", {}).get("status") == "applicable" and stats.get("engagementModelVersion") == ENGAGEMENT_VERSION:
                        status, reason = "QUALIFIED", "versioned_positive_allied_episode_projection"
                coverage.append({
                    "fromPlayerId": actor, "toPlayerId": other, "family": family,
                    "status": status, "reason": reason,
                    "qualificationScope": "POSITIVE_EPISODES_ONLY",
                    "absenceQualified": False,
                    "scope": "recorded_game_evidence_revision",
                    "sourceModelVersion": (
                        RAID_VERSION if family == "DIRECTED_PRESSURE"
                        else PAIR_EVIDENCE_VERSION if family == "LOCAL_CONTEST"
                        else ENGAGEMENT_VERSION if family in {"ALLIED_SUPPORT", "SHARED_OFFENSIVE_PARTICIPATION"}
                        else None
                    ),
                })

    # Relic commands remain object-directed observations, never player-directed
    # theft or a manufactured contest with the previous touching player.
    relic_observations = {}
    for stats in map_presence_statistics.values():
        relic = stats.get("relicControl") or {}
        if relic.get("modelVersion") != "AOF_RELIC_TARGETING_V1":
            continue
        for row in relic.get("interactionEvidence") or []:
            ref = row.get("sourceEventId")
            if ref in lookup and lookup[ref].get("actorPlayerId") == row.get("actorPlayerId"):
                relic_observations[ref] = deepcopy(row)

    return {
        "modelVersion": PAIR_SOCIAL_EVIDENCE_VERSION,
        "identityNamespace": "CANONICAL_REPLAY_PLAYER_ID",
        "gameScope": revision, "source": deepcopy(source),
        "playerIds": sorted(participants),
        "coverage": coverage,
        "observations": sorted(observations.values(), key=lambda row: row["sourceEventId"]),
        "incidents": sorted(incidents.values(), key=lambda row: row["incidentId"]),
        "deeds": sorted(deeds, key=lambda row: (row["startedAt"]["atMs"], row["deedId"])),
        "relicTargetingObservations": sorted(relic_observations.values(), key=lambda row: row["sourceEventId"]),
        "opportunities": [],
        "diagnostics": sorted({_json(row): row for row in diagnostics}.values(), key=_json),
        "policy": {
            "commandsAreNotOutcomes": True, "absenceMeaningEnabled": False,
            "relationshipScoringEnabled": False, "effectiveDiplomacyEnabled": False,
            "leagueIdentityMappingRequiredBeforeIntegration": True,
        },
    }
