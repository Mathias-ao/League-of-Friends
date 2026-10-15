"""AOF fixed-alignment military families V1: one deed, independent meanings.

Experimental, pure, read-only; inputs are *asserted* projections from the
statistics social bridge, NOT authenticated source/official/eligibility checks.
This module never proves substantive conduct, scores, stages, or publication.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from typing import Any

BRIDGE_VERSION = "AOF_STATISTICS_SOCIAL_BRIDGE_V1"
LEDGER_VERSION = "AOF_DIRECTIONAL_EPISODE_LEDGER_V1"
VERSION = "AOF_FIXED_ALIGNMENT_MILITARY_FAMILIES_V1_DRAFT"
EDITOR_VERSION = "AOF_CHRONICLE_EDITORIAL_V1_DRAFT"

# The evidence family is not a score. Each interpretation gets its own gate.
# These are qualitative requirements; no hidden weights, thresholds or caps.
FAMILY_KINDS = {
    "DIRECTED_PRESSURE": "RAIDS_PRESSURE",
    "TARGETED_COMMAND": "CONTEST_COUNTERPLAY",
    "LOCAL_COMMAND_OVERLAP": "CONTEST_COUNTERPLAY",
    "DIRECTED_ASSISTANCE_COMMANDS": "DEFENSIVE_ASSISTANCE",
    "DIRECTED_DEFENSIVE_PARTICIPATION": "DEFENSIVE_ASSISTANCE",
}
RELATION_REQUIREMENT = {
    "RAIDS_PRESSURE": "FIXED_OPPONENTS",
    "CONTEST_COUNTERPLAY": "FIXED_OPPONENTS",
    "DEFENSIVE_ASSISTANCE": "FIXED_ALLIES",
}
# The source-kind -> independent interpreted tracks matrix. These are never
# automatically satisfied by a detected episode.
QUALIFICATION_RULES = {
    "DIRECTED_PRESSURE": {
        ("RELATIONSHIP", "RIVALRY"): ("SUBSTANTIVE_PAIR_SPECIFIC_COMPETITION",),
        ("REPUTATION", "GALLANTRY"): ("MEANINGFUL_DARING_CONDUCT", "COMPARABLE_OR_STRONGER_OPPONENT_AT_ENTRY"),
        ("REPUTATION", "CRUELTY"): ("MEANINGFUL_PUNISHING_CONDUCT", "SUSTAINED_DISADVANTAGE_AT_ENTRY"),
    },
    "TARGETED_COMMAND": {
        ("RELATIONSHIP", "RIVALRY"): ("QUALIFIED_COMPETITIVE_ACTION_SEMANTICS", "SUBSTANTIVE_PAIR_SPECIFIC_COMPETITION"),
        ("REPUTATION", "GALLANTRY"): ("QUALIFIED_OFFENSIVE_SEMANTICS", "MEANINGFUL_DARING_CONDUCT", "COMPARABLE_OR_STRONGER_OPPONENT_AT_ENTRY"),
    },
    "DIRECTED_ASSISTANCE_COMMANDS": {
        ("RELATIONSHIP", "BOND"): ("SUBSTANTIVE_DIRECTED_HELP",),
        ("REPUTATION", "CHIVALRY"): ("SUBSTANTIVE_DIRECTED_HELP", "NOTEWORTHY_PROTECTION_OR_SUPPORT"),
    },
    "DIRECTED_DEFENSIVE_PARTICIPATION": {
        ("RELATIONSHIP", "BOND"): ("SUBSTANTIVE_DIRECTED_HELP",),
        ("REPUTATION", "CHIVALRY"): ("SUBSTANTIVE_DIRECTED_HELP", "DEFENSIVE_CONTEXT_AND_MATERIALITY"),
    },
}


def _text(s: Any) -> bool:
    return isinstance(s, str) and bool(s.strip())


def _canon(v: Any) -> str:
    return json.dumps(v, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def _id(prefix: str, *parts: Any) -> str:
    return prefix + "-" + sha256(_canon(parts).encode()).hexdigest()[:32]


def _refs(value: Any) -> list[str]:
    if not isinstance(value, list) or any(not _text(x) for x in value):
        raise ValueError("Invalid source references")
    return sorted(set(value))


def _status(episode: dict, context: dict, relation_required: str) -> tuple[str, list[str]]:
    reasons = []
    if context.get("eventBattleEligibility") != "ELIGIBLE":
        reasons.append("EVENT_BATTLE_ELIGIBILITY_UNQUALIFIED")
    if episode.get("chronologyCoverage") != "QUALIFIED":
        reasons.append("SOURCE_ORDER_UNQUALIFIED")
    if episode.get("independence") != "SOURCE_EPISODE":
        reasons.append("EPISODE_INDEPENDENCE_UNQUALIFIED")
    if episode.get("relationContext") != relation_required:
        reasons.append("FIXED_ALIGNMENT_NOT_QUALIFIED_FOR_FAMILY")
    return ("SOURCE_BLOCKED" if reasons else "REQUIRES_INDEPENDENT_QUALIFICATION", reasons)


def project_military_families(*, bridge_chapter: dict[str, Any]) -> dict[str, Any]:
    """Unify pressure, contest and assistance facets under existing one-deed IDs.

    Return independent track candidates with missing qualification requirements.
    Does NOT evaluate whether those requirements are met or award any effect.
    Context links are attached only as context; PRESSURE_RESPONSE alone never
    creates a reverse Rivalry action or reciprocity credit.
    """
    if not isinstance(bridge_chapter, dict) or bridge_chapter.get("modelVersion") != BRIDGE_VERSION:
        raise ValueError("Expected versioned statistics social bridge chapter")
    ledger = bridge_chapter.get("directionalLedger")
    if not isinstance(ledger, dict) or ledger.get("modelVersion") != LEDGER_VERSION:
        raise ValueError("Expected versioned directional episode ledger")
    context = bridge_chapter.get("leagueContext")
    if not isinstance(context, dict) or context != ledger.get("leagueContext"):
        raise ValueError("League snapshot mismatch")
    if bridge_chapter.get("sourceRevision") != ledger.get("sourceRevision"):
        raise ValueError("Source revision mismatch")

    deeds: list[dict] = []
    claims: list[dict] = []
    seen: set[str] = set()
    for episode in ledger.get("episodes", []):
        eid = episode.get("episodeId")
        if not _text(eid) or eid in seen:
            raise ValueError("Missing or duplicate source episode identity")
        seen.add(eid)
        source_refs = _refs(episode.get("sourceEventIds"))
        if not source_refs:
            raise ValueError("Source episode must reference recording evidence")
        pair = episode.get("pairLeaguePlayerIds")
        if not isinstance(pair, list) or len(pair) != 2 or any(not _text(v) for v in pair) or pair[0] == pair[1]:
            raise ValueError("Missing mapped pair")
        by_family: dict[str, dict] = {}
        grouped: dict[tuple[str, str, str, str], dict] = {}
        for obs in episode.get("directionalObservations", []):
            kind = obs.get("kind")
            refs = _refs(obs.get("sourceEventIds"))
            if not set(refs).issubset(source_refs):
                raise ValueError("Observation outside source deed")
            if kind == "SHARED_OPPONENT_PARTICIPATION":
                # Retained context, never directed Bond or Chivalry.
                continue
            family = FAMILY_KINDS.get(kind)
            if not family:
                continue
            component = by_family.setdefault(family, {"sourceEvidenceKinds": set(), "sourceEventIds": set(), "sourceContextKinds": set()})
            component["sourceEvidenceKinds"].add(kind)
            component["sourceEventIds"].update(refs)
            if kind == "LOCAL_COMMAND_OVERLAP":
                continue  # fact about local presence, not a directed competitive act
            actor, other = obs.get("fromLeaguePlayerId"), obs.get("toLeaguePlayerId")
            if not _text(actor) or not _text(other) or actor == other or {actor, other} != set(pair):
                raise ValueError("Invalid directed mapped observation")
            for (system, track), missing in QUALIFICATION_RULES[kind].items():
                key = (system, track, actor, other)
                row = grouped.setdefault(key, {"kinds": set(), "refs": set(), "missing": set(), "families": set()})
                row["kinds"].add(kind)
                row["refs"].update(refs)
                row["missing"].update(missing)
                row["families"].add(family)
        for link in episode.get("episodeContextLinks", []):
            if link.get("family") in {"PRESSURE_RESPONSE", "RETURN_PRESSURE", "DEFENSIVE_SUPPORT_WITH_PRESSURE"}:
                for fam in by_family.values():
                    fam["sourceContextKinds"].add(link["family"])
        if not by_family:
            continue
        for family, value in sorted(by_family.items()):
            status, reasons = _status(episode, context, RELATION_REQUIREMENT[family])
            deeds.append({
                "episodeId": eid, "sourceDeedId": episode["sourceDeedId"],
                "family": family, "battleId": context["battleId"], "gameId": context["gameId"],
                "pairLeaguePlayerIds": deepcopy(pair),
                "relationContext": episode.get("relationContext"),
                "sourceEvidenceKinds": sorted(value["sourceEvidenceKinds"]),
                "sourceContextKinds": sorted(value["sourceContextKinds"]),
                "sourceEventIds": sorted(value["sourceEventIds"]),
                "sourceRevision": deepcopy(ledger["sourceRevision"]),
                "moment": deepcopy(episode["startedAt"]),
                "status": status, "sourceBlockers": reasons,
                "historyEvaluationBlockers": (["CROSS_BATTLE_ORDER_NOT_SUPPLIED"]
                                              if context.get("battleOrder") is None else []),
                "meaningfulnessQualified": False, "creditedEffect": False,
            })
        for (system, track, actor, other), data in sorted(grouped.items()):
            relevant = sorted(data["families"])
            reasons = sorted({reason for family in relevant for reason in _status(
                episode, context, RELATION_REQUIREMENT[family])[1]})
            claims.append({
                "claimId": _id("military-claim", eid, system, track, actor, other),
                "sourceEpisodeId": eid, "sourceDeedId": episode["sourceDeedId"],
                "battleId": context["battleId"], "gameId": context["gameId"],
                "system": system, "track": track,
                "fromLeaguePlayerId": actor, "toLeaguePlayerId": other,
                "families": relevant, "sourceEvidenceKinds": sorted(data["kinds"]),
                "sourceEventIds": sorted(data["refs"]),
                "status": "SOURCE_BLOCKED" if reasons else "PENDING_QUALIFICATION",
                "sourceBlockers": reasons,
                "historyEvaluationBlockers": (["CROSS_BATTLE_ORDER_NOT_SUPPLIED"]
                                              if context.get("battleOrder") is None else []),
                "unsatisfiedTrackQualifications": sorted(data["missing"]),
                "meaningfulnessQualified": False, "creditedEffect": False,
                "reciprocityCredit": None, "points": None, "stage": None,
            })
    return {
        "modelVersion": VERSION,
        "leagueContext": deepcopy(context), "sourceRevision": deepcopy(ledger["sourceRevision"]),
        "deeds": sorted(deeds, key=lambda x: (x["moment"]["atMs"], x["episodeId"], x["family"])),
        "candidateClaims": sorted(claims, key=lambda x: x["claimId"]),
        "qualificationCatalogVersion": "AOF_FIXED_ALIGNMENT_MILITARY_QUALIFICATION_CATALOG_V1_DRAFT",
        "contextInterpretation": {
            "PRESSURE_RESPONSE": "ASSOCIATED_RESPONSE_ONLY_NOT_SUBSTANTIVE_COUNTERPLAY",
            "RETURN_PRESSURE": "ORDERED_INDEPENDENT_SOURCE_DEEDS_NOT_RETALIATION_INTENT",
            "DEFENSIVE_SUPPORT_WITH_PRESSURE": "ATTRIBUTED_PROTECTIVE_EPISODE_NOT_PROVEN_RESCUE",
        },
        "policy": {"readOnly": True, "liveScoringEnabled": False,
                   "meaningfulnessRequiresIndependentQualification": True,
                   "hostilityFromOrdinaryWarfare": False,
                   "reciprocityInferredFromBeingAttacked": False,
                   "sharedTargetsCreateBond": False,
                   "anyClaimQualifiedHere": False,
                   "sourceAndOfficialStatusAuthenticatedHere": False,
                   "fixedAlignmentAuthenticatedHere": False},
    }


# The Chronicle is deliberately a separate *projection* of externally qualified
# effects. It can be tuned without changing deed or progression identity.
_RESULT_TEMPLATES = {
    "DUEL_WIN": "{owner} defeated {other} on {map}.",
    "DUEL_LOSS": "{owner} fell to {other} on {map}.",
    "TEAM_WIN_AGAINST": "{owner}'s side defeated {other}'s on {map}.",
    "TEAM_LOSS_AGAINST": "{owner}'s side lost to {other}'s on {map}.",
    "ALLY_WIN": "{owner} and {other} won together on {map}.",
    "ALLY_LOSS": "{owner} and {other} were defeated together on {map}.",
    "DRAW": "{owner} and {other} met in a draw on {map}.",
    "OTHER": "{owner} and {other} fought on {map}.",
}
TRACKS = {"GALLANTRY", "CRUELTY", "CHIVALRY", "RIVALRY", "HOSTILITY", "BOND"}
KINDS = {"REPUTATION_PROGRESS", "RELATIONSHIP_PROGRESS", "RELATIONSHIP_STAGE_CHANGE", "QUALIFIED_ACKNOWLEDGMENT"}


def _highlight(receipt: dict, deed: dict | None) -> str:
    actor, other = receipt["actorLeaguePlayerId"], receipt["counterpartLeaguePlayerId"]
    kind, track = receipt["kind"], receipt.get("track")
    if kind == "QUALIFIED_ACKNOWLEDGMENT":
        return f"{actor} formally acknowledged {other}'s superior skill." if receipt.get("acknowledgmentKind") == "SKILL_SUPERIORITY" else f"{actor}'s authenticated account of this Battle entered the Chronicle."
    if kind == "RELATIONSHIP_STAGE_CHANGE":
        return f"The {track.lower()} between {actor} and {other} entered a new stage."
    if track == "RIVALRY":
        return f"{actor}'s independently qualified contest with {other} deepened their rivalry."
    if track == "BOND":
        return f"{actor}'s meaningful help to {other} strengthened their bond."
    if track == "HOSTILITY":
        return f"A separately qualified antagonistic deed by {actor} deepened hostility toward {other}."
    if track == "GALLANTRY":
        return f"{actor}'s qualified daring conduct against {other} added to a reputation for gallantry."
    if track == "CRUELTY":
        return f"{actor}'s qualified punishing conduct against {other} added to a reputation for cruelty."
    if track == "CHIVALRY":
        return f"{actor}'s meaningful assistance to {other} added to a reputation for chivalry."
    raise ValueError("Unsupported credited track")


def preview_chronicle_from_credits(*, families: dict, battle_results: list[dict],
                                   credited_receipts: list[dict] | None = None) -> dict:
    """Private/editorial-only result line plus at most one credited highlight.

    The caller asserts official Battle result and authenticated credit receipts.
    This module can cross-check local IDs, but CANNOT verify server authority.
    It may not be published or used as qualification or credit authority.
    """
    if not isinstance(families, dict) or families.get("modelVersion") != VERSION:
        raise ValueError("Expected military-family projection")
    if not isinstance(battle_results, list):
        raise ValueError("Explicit official Battle-result input required")
    receipts = credited_receipts if credited_receipts is not None else []
    if not isinstance(receipts, list):
        raise ValueError("Credit receipts must be a list")
    ctx = families["leagueContext"]
    deeds = {row["episodeId"]: row for row in families["deeds"]}
    claims = {row["claimId"]: row for row in families["candidateClaims"]}
    receipt_by_pair: dict[tuple[str, str, str], list[dict]] = {}
    identities: dict[str, dict] = {}
    for r in receipts:
        if not isinstance(r, dict) or any(not _text(r.get(key)) for key in (
                "receiptId", "ruleVersion", "battleId", "actorLeaguePlayerId", "counterpartLeaguePlayerId")):
            raise ValueError("Invalid credited receipt")
        if r["battleId"] != ctx["battleId"] or r.get("kind") not in KINDS or r.get("status") != "CREDITED":
            raise ValueError("Only credited and linked receipt supported in editorial projection")
        actor, other = r["actorLeaguePlayerId"], r["counterpartLeaguePlayerId"]
        if actor == other:
            raise ValueError("Credit receipt must identify distinct players")
        if r.get("kind") == "QUALIFIED_ACKNOWLEDGMENT":
            if (not _text(r.get("judgmentIncidentId")) or r.get("visibility") != "LEAGUE_VISIBLE"
                    or r.get("judgmentGameId") != ctx["gameId"]
                    or r.get("judgmentSourceRevision") != families["sourceRevision"]):
                raise ValueError("Private, stale or unlinked acknowledgment cannot become public Chronicle prose")
        else:
            source = claims.get(r.get("claimId"))
            if not source or r.get("sourceEpisodeId") != source["sourceEpisodeId"] or (
                    r.get("track") != source["track"] or
                    r.get("system") != source["system"] or
                    actor != source["fromLeaguePlayerId"] or other != source["toLeaguePlayerId"]):
                raise ValueError("Credited receipt does not match current source claim")
            if source["status"] != "PENDING_QUALIFICATION" or source["historyEvaluationBlockers"]:
                raise ValueError("Blocked source or history claim cannot be credited")
            if r["kind"] == "REPUTATION_PROGRESS" and source["system"] != "REPUTATION":
                raise ValueError("Reputation receipt attached to Relationship claim")
            if r["kind"].startswith("RELATIONSHIP_") and source["system"] != "RELATIONSHIP":
                raise ValueError("Relationship receipt attached to Reputation claim")
        if r["receiptId"] in identities:
            if identities[r["receiptId"]] != r:
                raise ValueError("Conflicting credited receipt ID")
            continue  # identical retries may not create duplicate editorial candidates
        identities[r["receiptId"]] = r
        if r.get("kind") != "QUALIFIED_ACKNOWLEDGMENT" and r["sourceEpisodeId"] not in deeds:
            raise ValueError("Missing source-deed lineage")
        receipt_by_pair.setdefault((ctx["battleId"], *sorted((actor, other))), []).append(r)
    priority = {"RELATIONSHIP_STAGE_CHANGE": 0, "QUALIFIED_ACKNOWLEDGMENT": 1,
                "RELATIONSHIP_PROGRESS": 2, "REPUTATION_PROGRESS": 3}
    entries = []
    seen_results = set()
    used_receipts = set()
    for result in battle_results:
        if not isinstance(result, dict) or result.get("battleId") != ctx["battleId"]:
            raise ValueError("Battle result does not match family projection")
        owner, other = result.get("ownerLeaguePlayerId"), result.get("counterpartLeaguePlayerId")
        if not _text(owner) or not _text(other) or owner == other or not _text(result.get("mapName")):
            raise ValueError("Battle result needs pair identity and map")
        scope = (ctx["battleId"], owner, other)
        if scope in seen_results:
            raise ValueError("Duplicate pair Battle-result line")
        seen_results.add(scope)
        outcome = result.get("outcome")
        if outcome not in _RESULT_TEMPLATES:
            raise ValueError("Unsupported official result shape")
        raw = _RESULT_TEMPLATES[outcome].format(owner=owner, other=other, map=result["mapName"])
        eligible = sorted(
            (row for row in receipt_by_pair.get((ctx["battleId"], *sorted((owner, other))), [])
             if row["kind"] != "REPUTATION_PROGRESS" or row["actorLeaguePlayerId"] == owner),
            key=lambda row: (priority[row["kind"]], row["receiptId"]))
        selected = eligible[0] if eligible else None
        if selected:
            used_receipts.add(selected["receiptId"])
        entries.append({
            "entryId": _id("chronicle-entry", ctx["battleId"], owner, other),
            "battleId": ctx["battleId"], "ownerLeaguePlayerId": owner,
            "counterpartLeaguePlayerId": other,
            "resultSentence": raw,
            "highlightSentence": _highlight(selected, deeds.get(selected.get("sourceEpisodeId"))) if selected else None,
            "selectedReceiptId": selected["receiptId"] if selected else None,
            "suppressedForBrevityReceiptIds": [r["receiptId"] for r in eligible[1:]],
            "selectionReason": "CREDITED_SOCIAL_EFFECT" if selected else "ORDINARY_BATTLE_RESULT_ONLY",
            "verifiedByProjection": False,
        })
    for receipt in identities.values():
        if (ctx["battleId"], *sorted((receipt["actorLeaguePlayerId"], receipt["counterpartLeaguePlayerId"]))) not in {
                (ctx["battleId"], *sorted((result["ownerLeaguePlayerId"], result["counterpartLeaguePlayerId"]))) for result in battle_results}:
            raise ValueError("Receipt pair has no official-result summary")
    return {
        "modelVersion": EDITOR_VERSION, "entries": sorted(entries, key=lambda x: (x["ownerLeaguePlayerId"], x["counterpartLeaguePlayerId"])),
        "preservedReceiptIds": sorted(identities),
        "policy": {"readOnly": True, "maximumFeaturedSocialHighlightsPerPairBattle": 1,
                   "normalBattleNarrative": "ONE_OFFICIAL_RESULT_SENTENCE",
                   "rawStatisticCandidatesTriggerHighlights": False,
                   "qualifiedProgressionRequiredForHighlight": True,
                   "independentHistoricalCreditAuthorityVerifiedHere": False,
                   "liveChroniclePublicationEnabled": False},
    }