"""Private, read-only Chronicle Judgment *opportunities*, never submitted judgments.

Consumes a caller-selected active Directional Episode Ledger V1 chapter set.
The caller is responsible for authenticating source acceptance, factual reviews,
result history and league identity. This pure adapter never asks players a question,
stores a judgment, validates human perception, scores Relationships or publishes a
Chronicle entry. Candidate selection is NOT a prompt frequency/notice policy.

A Chronicle question may contextualize an independently supported incident; it
may not create the incident, establish motives, infer reciprocity, or turn an
opponent's action into Hostility by default.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from typing import Any

VERSION = "AOF_CHRONICLE_JUDGMENT_OPPORTUNITIES_V1"
LEDGER_VERSION = "AOF_DIRECTIONAL_EPISODE_LEDGER_V1"
KINDS = {
    "ASSISTANCE_PERCEPTION": "BOND",
    "SITUATED_ANTAGONISM_PERCEPTION": "HOSTILITY",
    "TREACHERY_VICTIM_CONFIRMATION": "HOSTILITY",
    "THIRD_LOSS_SKILL_ACKNOWLEDGMENT": "RIVALRY",
}
# These are independently source-reviewed factual prerequisites, NOT choices,
# relationship thresholds, stage gates or assertions this projector can verify.
TREACHERY_REQUIREMENTS = (
    "MUTUAL_EFFECTIVE_ALLIANCE",
    "ORDERED_UNILATERAL_RUPTURE",
    "SUBSEQUENT_HOSTILE_PARTICIPATION",
    "QUALIFIED_KING_LOSS",
    "RESPONSIBLE_FORMER_ALLY",
    "INCIDENT_IDENTITY_AND_CHRONOLOGY",
)
ASSISTANCE_KINDS = {"DIRECTED_ASSISTANCE_COMMANDS", "DIRECTED_DEFENSIVE_PARTICIPATION"}
PRESSURE_KINDS = {"DIRECTED_PRESSURE", "TARGETED_COMMAND"}


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _text(value: Any) -> bool:
    return isinstance(value, str) and bool(value)


def _positive(value: Any) -> bool:
    return type(value) is int and value > 0


def _refs(value: Any) -> list[str]:
    if not isinstance(value, list) or any(not _text(v) for v in value):
        raise ValueError("Expected a list of source references")
    return sorted(set(value))


def _key(match: Any, game: Any) -> tuple[str, str]:
    if not _text(match) or not _text(game):
        raise ValueError("A reviewed case must identify an exact Match and Game")
    return (match, game)


def _chapter_index(selected: dict) -> tuple[dict[tuple[str, str], dict], dict[str, tuple[dict, dict]]]:
    if not isinstance(selected, dict) or selected.get("modelVersion") != LEDGER_VERSION:
        raise ValueError("Unsupported selected directional ledger")
    if (not isinstance(selected.get("currentChapters"), list)
            or not isinstance(selected.get("withdrawnGames"), list)):
        raise ValueError("Selection must declare current and withdrawn chapters")
    withdrawn = {_key(row.get("matchId"), row.get("gameId")) for row in selected["withdrawnGames"]
                 if isinstance(row, dict)}
    chapters: dict[tuple[str, str], dict] = {}
    episodes: dict[str, tuple[dict, dict]] = {}
    for ledger in selected["currentChapters"]:
        if not isinstance(ledger, dict) or ledger.get("modelVersion") != LEDGER_VERSION:
            raise ValueError("Unknown active directional ledger")
        ctx = ledger.get("leagueContext")
        if not isinstance(ctx, dict):
            raise ValueError("Missing league chapter context")
        key = _key(ctx.get("matchId"), ctx.get("gameId"))
        if key in chapters or key in withdrawn:
            raise ValueError("Conflicting active and withdrawn Game chapters")
        if (not _positive(ctx.get("chapterRevision"))
                or not _positive(ctx.get("resultRevision"))
                or not _text(ctx.get("playerMappingRevision"))
                or ctx.get("eventBattleEligibility") not in ("ELIGIBLE", "PENDING", "INELIGIBLE")
                or not isinstance(ledger.get("sourceRevision"), dict)
                or not isinstance(ledger.get("episodes"), list)):
            raise ValueError("Incomplete selected chapter provenance")
        chapters[key] = ledger
        league_players = [row.get("leaguePlayerId") for row in ctx.get("playerMapping", [])
                          if isinstance(row, dict)]
        if not all(_text(player) for player in league_players) or len(league_players) != len(set(league_players)):
            raise ValueError("Unqualified league roster")
        for episode in ledger["episodes"]:
            if not isinstance(episode, dict) or not _text(episode.get("episodeId")):
                raise ValueError("Invalid episode identity")
            if episode["episodeId"] in episodes:
                raise ValueError("Duplicate active episode identity")
            pair = episode.get("pairLeaguePlayerIds")
            if (not isinstance(pair, list) or len(pair) != 2 or pair != sorted(pair)
                    or pair[0] == pair[1] or any(player not in league_players for player in pair)
                    or not isinstance(episode.get("directionalObservations"), list)
                    or not isinstance(episode.get("episodeContextLinks"), list)):
                raise ValueError("Invalid active episode attribution")
            episodes[episode["episodeId"]] = (ledger, episode)
    return chapters, episodes


def _provenance(ledger: dict, episode: dict | None = None) -> dict:
    ctx = ledger["leagueContext"]
    result = {"matchId": ctx["matchId"], "gameId": ctx["gameId"],
              "battleId": ctx.get("battleId"), "eventId": ctx.get("eventId"),
              "chapterRevision": ctx["chapterRevision"],
              "resultRevision": ctx["resultRevision"],
              "playerMappingRevision": ctx["playerMappingRevision"],
              "sourceRevision": deepcopy(ledger["sourceRevision"])}
    if episode is not None:
        result.update(sourceEpisodeId=episode["episodeId"],
                      sourceDeedId=episode.get("sourceDeedId"),
                      sourceIncidentIds=deepcopy(episode.get("sourceIncidentIds", [])),
                      sourceEventIds=deepcopy(episode.get("sourceEventIds", [])),
                      incidentMoment=deepcopy(episode.get("startedAt")),
                      chronologyCoverage=episode.get("chronologyCoverage"))
    return result


def _eligible_for_review(ledger: dict, episode: dict | None) -> list[str]:
    reasons = []
    if ledger["leagueContext"]["eventBattleEligibility"] != "ELIGIBLE":
        reasons.append("EVENT_BATTLE_ELIGIBILITY_NOT_VERIFIED")
    if episode is not None:
        if episode.get("chronologyCoverage") != "QUALIFIED":
            reasons.append("INCIDENT_CHRONOLOGY_UNAVAILABLE")
        if episode.get("independence") != "SOURCE_EPISODE":
            reasons.append("EPISODE_INDEPENDENCE_UNRESOLVED")
    return reasons


def _create(kind: str, *, ledger: dict, episode: dict | None,
            respondent: str, counterpart: str, case_key: str,
            source_refs: list[str], trigger: str, blockers: list[str]) -> dict:
    if kind not in KINDS or respondent == counterpart:
        raise ValueError("Unknown judgment opportunity or identical participants")
    if not _text(case_key):
        raise ValueError("Opportunity case identity is required")
    source_refs = _refs(source_refs)
    prov = _provenance(ledger, episode)
    signature = [VERSION, kind, prov, respondent, counterpart, case_key, source_refs]
    return {
        "opportunityId": "chronicle-opportunity-" + sha256(_json(signature).encode()).hexdigest(),
        "kind": kind, "caseRef": case_key,
        "respondentLeaguePlayerId": respondent,
        "counterpartLeaguePlayerId": counterpart,
        "relationshipTrackForFutureQualificationReview": KINDS[kind],
        "trigger": trigger, "provenance": prov,
        "supportingSourceRefs": source_refs,
        "reviewStatus": "BLOCKED" if blockers else "CANDIDATE_FOR_HUMAN_REVIEW",
        "blockers": sorted(set(blockers)),
        "questionPresented": False, "judgmentSubmitted": False,
        "relationshipMeaningQualified": False,
        "reciprocityQualified": False,
    }


def _directional(episode: dict, allowed: set[str], actor: str, recipient: str) -> list[dict]:
    return [a for a in episode["directionalObservations"]
            if isinstance(a, dict) and a.get("kind") in allowed
            and a.get("fromLeaguePlayerId") == actor
            and a.get("toLeaguePlayerId") == recipient
            and a.get("qualification") == "SUBSTANTIVE_RELATIONSHIP_EFFECT_UNVERIFIED"
            and isinstance(a.get("sourceEventIds"), list) and bool(a["sourceEventIds"])]


def _review_case(case: dict, chapters: dict, episodes: dict) -> dict:
    if not isinstance(case, dict) or not _text(case.get("caseId")) or case.get("kind") not in KINDS:
        raise ValueError("Unsupported reviewed Chronicle case")
    key = _key(case.get("matchId"), case.get("gameId"))
    if key not in chapters:
        raise ValueError("Reviewed case refers to inactive or withdrawn Game")
    ledger = chapters[key]
    ctx = ledger["leagueContext"]
    if (case.get("chapterRevision") != ctx["chapterRevision"]
            or case.get("playerMappingRevision") != ctx["playerMappingRevision"]
            or case.get("sourceRevision") != ledger["sourceRevision"]):
        raise ValueError("Reviewed case has stale source/mapping/chapter revision")
    respondent, counterpart = case.get("respondentLeaguePlayerId"), case.get("counterpartLeaguePlayerId")
    players = {p["leaguePlayerId"] for p in ctx["playerMapping"]}
    if (not _text(respondent) or not _text(counterpart) or respondent == counterpart
            or respondent not in players or counterpart not in players):
        raise ValueError("Reviewed case lacks the exact league pair")
    if not _text(case.get("reviewEvidenceRef")):
        raise ValueError("Source reviewer evidence reference is required")
    episode = None
    if case.get("sourceEpisodeId") is not None:
        source_id = case["sourceEpisodeId"]
        if source_id not in episodes or episodes[source_id][0] is not ledger:
            raise ValueError("Reviewed case references another Game or superseded episode")
        episode = episodes[source_id][1]
        if sorted([respondent, counterpart]) != episode["pairLeaguePlayerIds"]:
            raise ValueError("Reviewed case targets an unrelated episode pair")
    kind = case["kind"]
    blockers = _eligible_for_review(ledger, episode)
    refs = [case["reviewEvidenceRef"]]
    if kind == "ASSISTANCE_PERCEPTION":
        if episode is None or not _directional(episode, ASSISTANCE_KINDS, counterpart, respondent):
            raise ValueError("Assistance review needs independently attributed helper-to-recipient observations")
        if not _refs(case.get("circumstanceSourceRefs", [])):
            blockers.append("NOTEWORTHY_ASSISTANCE_CONTEXT_UNAVAILABLE")
        refs += _refs(case.get("circumstanceSourceRefs", []))
    elif kind == "SITUATED_ANTAGONISM_PERCEPTION":
        if episode is None or not _directional(episode, PRESSURE_KINDS, counterpart, respondent):
            raise ValueError("Antagonism review needs independently attributed counterpart-to-victim evidence")
        if not _refs(case.get("circumstanceSourceRefs", [])):
            blockers.append("SITUATED_ANTAGONISM_CONTEXT_UNAVAILABLE")
        refs += _refs(case.get("circumstanceSourceRefs", []))
    elif kind == "TREACHERY_VICTIM_CONFIRMATION":
        if not _text(case.get("objectiveIncidentRef")):
            blockers.append("OBJECTIVE_INCIDENT_IDENTITY_UNAVAILABLE")
        else:
            refs.append(case["objectiveIncidentRef"])
        if episode is not None and not _directional(episode, PRESSURE_KINDS, counterpart, respondent):
            raise ValueError("A linked Treachery episode must be directed toward the stated victim")
        # Do not demand a pair-social deed: objective rupture/king-loss may only
        # exist in a *separate* qualified source, not the current command ledger.
        requirements = case.get("objectiveEvidenceRefs")
        if not isinstance(requirements, dict) or set(requirements) - set(TREACHERY_REQUIREMENTS):
            raise ValueError("Invalid Treachery objective prerequisite envelope")
        for requirement in TREACHERY_REQUIREMENTS:
            source = _refs(requirements.get(requirement, []))
            if not source:
                blockers.append("MISSING_OBJECTIVE_" + requirement)
            refs += source
        if not _text(case.get("objectiveReviewRef")):
            blockers.append("STRICT_OBJECTIVE_REVIEW_UNAVAILABLE")
        else:
            refs.append(case["objectiveReviewRef"])
        # The possible victim is always the respondent. No counterpart opinion
        # can establish or override the victim's binding declaration.
    elif kind == "THIRD_LOSS_SKILL_ACKNOWLEDGMENT":
        if episode is not None:
            raise ValueError("Skill review must be anchored to results, not an attack episode")
        if case.get("historyCoverage") != "COMPLETE_FOR_PAIR_THROUGH_ANCHOR" or not _text(case.get("historyCoverageRef")):
            blockers.append("THIRD_LOSS_HISTORY_COMPLETENESS_UNVERIFIED")
        else:
            refs.append(case["historyCoverageRef"])
        facts = case.get("lossFacts")
        if not isinstance(facts, list) or len(facts) != 3:
            blockers.append("THREE_DISTINCT_VERIFIED_BATTLE_LOSSES_UNAVAILABLE")
        else:
            ordered = []
            keys = set()
            battles = set()
            for fact in facts:
                if not isinstance(fact, dict) or not _positive(fact.get("historyOrdinal")):
                    raise ValueError("Invalid skill review historical order")
                fkey = _key(fact.get("matchId"), fact.get("gameId"))
                if fkey not in chapters:
                    raise ValueError("Skill review references an inactive Game")
                fledger = chapters[fkey]
                fctx = fledger["leagueContext"]
                if (fact.get("battleId") != fctx.get("battleId")
                        or fact.get("resultRevision") != fctx["resultRevision"]
                        or fact.get("sourceRevision") != fledger["sourceRevision"]
                        or fact.get("loserLeaguePlayerId") != respondent
                        or fact.get("winnerLeaguePlayerId") != counterpart
                        or respondent not in {p["leaguePlayerId"] for p in fctx["playerMapping"]}
                        or counterpart not in {p["leaguePlayerId"] for p in fctx["playerMapping"]}
                        or not _text(fact.get("resultSourceRef"))):
                    raise ValueError("Unqualified historical result fact or binding")
                ordered.append(fact["historyOrdinal"])
                keys.add(fkey)
                battles.add((fctx.get("eventId"), fctx.get("battleId")))
                refs.append(fact["resultSourceRef"])
                if fctx["eventBattleEligibility"] != "ELIGIBLE":
                    blockers.append("HISTORICAL_BATTLE_ELIGIBILITY_UNVERIFIED")
            if (len(set(ordered)) != 3 or ordered != sorted(ordered)
                    or len(keys) != 3 or len(battles) != 3
                    or (facts[-1]["matchId"], facts[-1]["gameId"]) != key):
                blockers.append("THIRD_DISTINCT_LOSS_ANCHOR_UNVERIFIED")
    return _create(kind, ledger=ledger, episode=episode, respondent=respondent,
                   counterpart=counterpart, case_key=case["caseId"],
                   source_refs=refs, trigger="REVIEWED_SOURCE_CONTEXT_NOT_REPLAY_INFERENCE",
                   blockers=blockers)


def project_chronicle_judgment_opportunities(
    *, selected_chapters: dict[str, Any], reviewed_cases: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Construct private review candidates. Does not issue, persist or answer prompts.

    Automatically *consider* only context-enriched defensive help; basic team
    membership, shared target, normal warfare, and ordinary losses are silent.
    Exceptional questions require separately reviewed, revision-pinned facts.
    No numerical delivery frequency, scoring weight or Relationship stage policy.
    """
    chapters, episodes = _chapter_index(selected_chapters)
    if reviewed_cases is not None and not isinstance(reviewed_cases, list):
        raise ValueError("Reviewed cases must be a list")
    seen_cases = {}
    for case in reviewed_cases or []:
        if not isinstance(case, dict) or not _text(case.get("caseId")):
            raise ValueError("Reviewed cases need immutable identifiers")
        if case["caseId"] in seen_cases and case != seen_cases[case["caseId"]]:
            raise ValueError("Conflicting reviewed case identity")
        seen_cases[case["caseId"]] = case
    output: dict[tuple[str, str, str, str], dict] = {}
    for ledger, episode in episodes.values():
        if not any(link.get("family") == "DEFENSIVE_SUPPORT_WITH_PRESSURE"
                   for link in episode["episodeContextLinks"] if isinstance(link, dict)):
            continue
        by_direction = {}
        for action in episode["directionalObservations"]:
            if not isinstance(action, dict) or action.get("kind") != "DIRECTED_DEFENSIVE_PARTICIPATION":
                continue
            from_id, to_id = action.get("fromLeaguePlayerId"), action.get("toLeaguePlayerId")
            if (not _text(from_id) or not _text(to_id)
                    or not _directional(episode, ASSISTANCE_KINDS, from_id, to_id)):
                continue
            by_direction[(from_id, to_id)] = True
        for (helper, recipient) in sorted(by_direction):
            case_ref = "context-defensive-support:" + episode["episodeId"] + ":" + helper + ":" + recipient
            context_refs = [r for link in episode["episodeContextLinks"]
                            if link.get("family") == "DEFENSIVE_SUPPORT_WITH_PRESSURE"
                            for r in link.get("sourceEventIds", [])]
            blockers = _eligible_for_review(ledger, episode)
            if not context_refs:
                blockers.append("DEFENSIVE_CONTEXT_SOURCE_UNAVAILABLE")
            row = _create("ASSISTANCE_PERCEPTION", ledger=ledger, episode=episode,
                          respondent=recipient, counterpart=helper, case_key=case_ref,
                          source_refs=context_refs,
                          trigger="SOURCE_CONTEXT_ENRICHED_DEFENSIVE_ASSISTANCE",
                          blockers=blockers)
            output[(row["kind"], episode["episodeId"], recipient, helper)] = row
    reviewed_targets: set[tuple[str, str, str, str]] = set()
    for case in sorted(seen_cases.values(), key=lambda c: c["caseId"]):
        row = _review_case(case, chapters, episodes)
        source_episode = row["provenance"].get("sourceEpisodeId", "")
        k = (row["kind"], source_episode or row["caseRef"],
             row["respondentLeaguePlayerId"], row["counterpartLeaguePlayerId"])
        if k in reviewed_targets:
            raise ValueError("Different reviewed cases claim the same incident, direction and question")
        reviewed_targets.add(k)
        # A reviewed case supersedes an automatically discovered candidate for
        # precisely the same incident/direction; it never appends a second.
        output[k] = row
    return {
        "modelVersion": VERSION,
        "sourceEvidenceModelVersion": LEDGER_VERSION,
        "opportunities": sorted(output.values(), key=lambda row: row["opportunityId"]),
        "reviewScope": {"activeGames": len(chapters), "sourceEpisodes": len(episodes),
                        "sourceAcceptanceAuthenticatedByProjector": False,
                        "resultHistoryAuthenticatedByProjector": False},
        "policy": {"readOnly": True, "privateCandidatesOnly": True,
                   "questionsPresented": False, "submissionsEnabled": False,
                   "automaticPromptDeliveryEnabled": False,
                   "promptFrequencyPolicyConfigured": False,
                   "relationshipScoringEnabled": False,
                   "treacheryQualifiedByProjection": False,
                   "skillHierarchyAcknowledgedByProjection": False,
                   "chroniclePublicationEnabled": False,
                   "warRoomEffectsEnabled": False},
    }