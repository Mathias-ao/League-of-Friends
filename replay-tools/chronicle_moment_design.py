"""Read-only Chronicle *design previews*, not player-facing stories or questions.

Additive companion to Chronicle Judgment Opportunities V1. The old candidate
qualification gates are not widened. New themes are a versioned vocabulary for
source-anchored editorial review only, NOT new eligible Relationship signals.

The narrator deliberately knows no player motives, outcomes or feelings. Its
poetic framing cannot become an evidence claim, player submission or score.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from typing import Any

from chronicle_story_templates import (
    VERSION as STORY_VERSION, QUESTIONS, render_chronicle_story_preview,
)
from chronicle_judgment_opportunities import (
    LEDGER_VERSION, VERSION as JUDGMENT_V1,
    project_chronicle_judgment_opportunities,
)

VERSION = "AOF_CHRONICLE_MOMENT_DESIGN_V1"
CATALOG_VERSION = "AOF_CHRONICLE_OPPORTUNITY_FAMILIES_V1"

# These keys are stable proposal identifiers, not a complete universe of
# possible Chronicle moments. Exploratory families have NO approved trigger,
# scoring effect, qualification rule or permission to contact a player.
FAMILIES: dict[str, dict[str, Any]] = {
    "EXCEPTIONAL_TREACHERY": {"title": "An Unsettled Oath", "gate": "STRICT_V1_TREACHERY", "legacyKind": "TREACHERY_VICTIM_CONFIRMATION"},
    "PERSONAL_GRIEVANCE": {"title": "A Grievance Remembered", "gate": "REVIEWED_V1_ANTAGONISM", "legacyKind": "SITUATED_ANTAGONISM_PERCEPTION"},
    "SKILL_ACKNOWLEDGMENT": {"title": "The Measure of a Rival", "gate": "VERIFIED_V1_LOSS_REVIEW", "legacyKind": "THIRD_LOSS_SKILL_ACKNOWLEDGMENT"},
    "DIRECTED_ASSISTANCE": {"title": "A Hand Amid the Battle", "gate": "V1_CONTEXT_ENRICHED_HELP", "legacyKind": "ASSISTANCE_PERCEPTION"},
    "EARNED_RESPECT": {"title": "Respect Won in Contest", "gate": "EXPLORATORY_REVIEW_ONLY"},
    "UNEXPECTED_ASSISTANCE": {"title": "Help From an Unlooked-For Quarter", "gate": "EXPLORATORY_REVIEW_ONLY"},
    "BROTHERHOOD_IN_BATTLE": {"title": "Shoulder to Shoulder", "gate": "EXPLORATORY_REVIEW_ONLY"},
    "MERCY_OR_RECONCILIATION": {"title": "A Quarrel Grown Quieter", "gate": "EXPLORATORY_REVIEW_ONLY"},
    "TRUST_TESTED": {"title": "A Bond Put to the Test", "gate": "EXPLORATORY_REVIEW_ONLY"},
    "RIVALRY_DEEPENED": {"title": "A Contest Unfinished", "gate": "EXPLORATORY_REVIEW_ONLY"},
    "RIVALRY_RESOLVED": {"title": "The End of a Contest?", "gate": "EXPLORATORY_REVIEW_ONLY"},
    "FRIENDSHIP_ACROSS_DIVISIONS": {"title": "Across the Dividing Line", "gate": "EXPLORATORY_REVIEW_ONLY"},
    "REMEMBERED_SACRIFICE": {"title": "What Was Risked", "gate": "EXPLORATORY_REVIEW_ONLY"},
}
LEGACY_FAMILY = {value["legacyKind"]: key for key, value in FAMILIES.items() if "legacyKind" in value}



def _txt(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _id(value: Any) -> str:
    return "chronicle-moment-" + sha256(_canonical(value).encode("utf-8")).hexdigest()


def _refs(value: Any) -> list[str]:
    if not isinstance(value, list) or any(not _txt(v) for v in value):
        raise ValueError("Moment references must be a list of nonempty strings")
    return sorted(set(value))


def _scope(selected: dict) -> tuple[dict[tuple[str, str], dict], dict[str, tuple[dict, dict]]]:
    if not isinstance(selected, dict) or selected.get("modelVersion") != LEDGER_VERSION:
        raise ValueError("Unsupported selected chapter version")
    if not isinstance(selected.get("currentChapters"), list):
        raise ValueError("Active chapter list required")
    current = {}
    episodes = {}
    for ledger in selected["currentChapters"]:
        if not isinstance(ledger, dict) or ledger.get("modelVersion") != LEDGER_VERSION:
            raise ValueError("Unknown ledger chapter")
        ctx = ledger.get("leagueContext")
        if not isinstance(ctx, dict) or any(not _txt(ctx.get(k)) for k in
                                         ("matchId", "gameId", "playerMappingRevision")):
            raise ValueError("Incomplete active chapter identity")
        key = (ctx["matchId"], ctx["gameId"])
        if key in current:
            raise ValueError("Conflicting active Game chapters")
        current[key] = ledger
        for ep in ledger.get("episodes", []):
            eid = ep.get("episodeId") if isinstance(ep, dict) else None
            if not _txt(eid) or eid in episodes:
                raise ValueError("Invalid or duplicate active episode")
            episodes[eid] = (ledger, ep)
    return current, episodes


def _presentation(family: str, respondent: str, counterpart: str, *, intent: str, blocked: bool) -> dict:
    # Stories are authored by a separate, scoreless editorial preview layer.
    return {
        "family": family, "title": FAMILIES[family]["title"],
        **render_chronicle_story_preview(family, counterpart, intent=intent, blocked=blocked),
        "respondentLeaguePlayerId": respondent, "counterpartLeaguePlayerId": counterpart,
        "presentationIntent": intent,
        "questionsDisplayedToPlayer": False, "submissionEnabled": False,
        "relationshipEffectQualified": False, "reciprocityQualified": False,
        "bindingAnswerRecorded": False,
    }


def _exploratory_case(case: dict, current: dict, episodes: dict) -> dict:
    if not isinstance(case, dict) or not _txt(case.get("momentId")):
        raise ValueError("An exploratory moment needs a stable identity")
    family = case.get("family")
    if family not in FAMILIES or FAMILIES[family]["gate"] != "EXPLORATORY_REVIEW_ONLY":
        raise ValueError("Existing gated topics must use Chronicle Judgment Opportunities V1")
    intent = case.get("presentationIntent")
    if intent not in ("JUDGMENT_CANDIDATE", "NARRATIVE_ONLY"):
        raise ValueError("Explicit question or narrative-only intent required")
    key = (case.get("matchId"), case.get("gameId"))
    if key not in current:
        raise ValueError("Exploratory moment refers to inactive or withdrawn Game")
    ledger = current[key]
    ctx = ledger["leagueContext"]
    if (case.get("chapterRevision") != ctx["chapterRevision"]
            or case.get("playerMappingRevision") != ctx["playerMappingRevision"]
            or case.get("sourceRevision") != ledger["sourceRevision"]):
        raise ValueError("Exploratory moment uses stale chapter/source/mapping")
    eid = case.get("sourceEpisodeId")
    if not _txt(eid) or eid not in episodes or episodes[eid][0] is not ledger:
        raise ValueError("Exploratory theme requires an episode from its exact Game")
    ep = episodes[eid][1]
    respondent, counterpart = case.get("respondentLeaguePlayerId"), case.get("counterpartLeaguePlayerId")
    pair = ep.get("pairLeaguePlayerIds")
    if (not _txt(respondent) or not _txt(counterpart) or respondent == counterpart
            or not isinstance(pair, list) or set(pair) != {respondent, counterpart}):
        raise ValueError("Exploratory theme must retain the exact episode pair")
    source_refs = _refs(case.get("episodeSourceEventIds"))
    anchored_refs = _refs(ep.get("sourceEventIds", []))
    if not source_refs or not set(source_refs).issubset(anchored_refs):
        raise ValueError("Exploratory moment needs source IDs from this exact episode")
    if not _txt(case.get("reviewEvidenceRef")):
        raise ValueError("Exploratory moment requires an independent reviewer reference")
    circumstance = _refs(case.get("circumstanceSourceRefs"))
    blockers = []
    if ctx.get("eventBattleEligibility") != "ELIGIBLE":
        blockers.append("EVENT_BATTLE_ELIGIBILITY_NOT_VERIFIED")
    if ep.get("chronologyCoverage") != "QUALIFIED":
        blockers.append("EPISODE_CHRONOLOGY_UNAVAILABLE")
    if ep.get("independence") != "SOURCE_EPISODE":
        blockers.append("EPISODE_INDEPENDENCE_UNAVAILABLE")
    if not circumstance:
        blockers.append("INDEPENDENT_CIRCUMSTANCE_REVIEW_UNAVAILABLE")
    # A passed local shape check STILL does not establish sacrificial intent,
    # mercy, respect, shared feelings, a scoring signal, or delivery eligibility.
    display = _presentation(family, respondent, counterpart, intent=intent, blocked=bool(blockers))
    identity = [VERSION, family, intent, case["momentId"], key, ctx["chapterRevision"],
                ctx["playerMappingRevision"], ledger["sourceRevision"], eid,
                respondent, counterpart, source_refs, circumstance, case["reviewEvidenceRef"]]
    return {**display, "momentId": _id(identity), "caseRef": case["momentId"],
            "origin": "EXPLICIT_REVIEWED_EXPLORATORY_CASE",
            "sourceOpportunityId": None,
            "reviewStatus": "BLOCKED" if blockers else "EXPLORATORY_REVIEW_ONLY",
            "blockers": blockers,
            "themeQualificationApproved": False,
            "relationshipTrackForFutureQualificationReview": None,
            "evidence": {"matchId": ctx["matchId"], "gameId": ctx["gameId"],
                         "battleId": ctx["battleId"], "eventId": ctx.get("eventId"),
                         "chapterRevision": ctx["chapterRevision"],
                         "resultRevision": ctx["resultRevision"],
                         "playerMappingRevision": ctx["playerMappingRevision"],
                         "sourceRevision": deepcopy(ledger["sourceRevision"]),
                         "sourceEpisodeId": eid, "episodeSourceEventIds": source_refs,
                         "circumstanceSourceRefs": circumstance,
                         "reviewEvidenceRef": case["reviewEvidenceRef"],
                         "chronologyCoverage": ep.get("chronologyCoverage")}}


def project_chronicle_moment_design(
    *, selected_chapters: dict[str, Any],
    reviewed_cases: list[dict[str, Any]] | None = None,
    reviewed_moments: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Make private design previews only; no source auth, UI, questions, writes.

    Existing four topics keep every V1 evidence gate and blocker. Additional
    topics are opt-in reviewer/editorial proposals only; never auto-triggered.
    """
    base = project_chronicle_judgment_opportunities(
        selected_chapters=selected_chapters, reviewed_cases=reviewed_cases)
    current, episodes = _scope(selected_chapters)
    if reviewed_moments is not None and not isinstance(reviewed_moments, list):
        raise ValueError("Reviewed exploratory moments must be a list")
    result = []
    for candidate in base["opportunities"]:
        family = LEGACY_FAMILY[candidate["kind"]]
        blocked = candidate["reviewStatus"] == "BLOCKED"
        display = _presentation(family, candidate["respondentLeaguePlayerId"],
                                candidate["counterpartLeaguePlayerId"],
                                intent="JUDGMENT_CANDIDATE", blocked=blocked)
        result.append({**display, "momentId": _id([VERSION, candidate["opportunityId"]]),
                       "caseRef": candidate["caseRef"], "origin": "GATED_V1_OPPORTUNITY",
                       "sourceOpportunityId": candidate["opportunityId"],
                       "reviewStatus": candidate["reviewStatus"],
                       "blockers": deepcopy(candidate["blockers"]),
                       "themeQualificationApproved": False,
                       "priorSourceCandidateGateRetained": True,
                       "relationshipTrackForFutureQualificationReview": candidate["relationshipTrackForFutureQualificationReview"],
                       "evidence": deepcopy(candidate["provenance"]),
                       "supportingSourceRefs": deepcopy(candidate["supportingSourceRefs"])})
    dedup_ids = {}
    dedup_targets = set()
    for case in reviewed_moments or []:
        m = _exploratory_case(case, current, episodes)
        case_id = case["momentId"]
        if case_id in dedup_ids:
            if dedup_ids[case_id] != case:
                raise ValueError("Conflicting exploratory moment identity")
            continue
        dedup_ids[case_id] = deepcopy(case)
        target = (m["family"], m["presentationIntent"], m["evidence"]["sourceEpisodeId"],
                  m["respondentLeaguePlayerId"], m["counterpartLeaguePlayerId"])
        if target in dedup_targets:
            raise ValueError("Duplicate thematic question or narrative for one incident/direction")
        dedup_targets.add(target)
        result.append(m)
    return {"modelVersion": VERSION, "catalogVersion": CATALOG_VERSION,
            "sourceOpportunityVersion": JUDGMENT_V1,
            "storyTemplateVersion": STORY_VERSION,
            "families": [{"family": k, "title": v["title"], "eligibilityGate": v["gate"],
                          "automaticallyEligibleToPrompt": False,
                          "relationshipEffectConfigured": False}
                         for k, v in sorted(FAMILIES.items())],
            "moments": sorted(result, key=lambda row: row["momentId"]),
            "reviewScope": deepcopy(base["reviewScope"]),
            "policy": {"readOnly": True, "designPreviewOnly": True,
                       "sourceAuthenticationPerformed": False,
                       "reviewerAuthenticationPerformed": False,
                       "narrationPublished": False,
                       "playerQuestionsSent": False, "responsesCollected": False,
                       "bindingJudgmentsRecorded": False,
                       "newThemeQualificationEnabled": False,
                       "scoringEnabled": False, "warRoomEffectsEnabled": False,
                       "frequencyPolicyConfigured": False}}