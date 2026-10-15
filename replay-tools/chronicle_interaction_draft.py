"""Offline Chronicle interaction *simulation*. No login, persistence or delivery.

Consumes Chronicle Moment Design V1, preserving its objective-source gates.
This is an additive product draft; it is never a binding player judgment.
The caller-supplied viewer identity is NOT authentication. Only an eventual
server-side authenticated read/write boundary may issue real submissions.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from typing import Any

from chronicle_moment_design import VERSION as MOMENT_VERSION

VERSION = "AOF_CHRONICLE_INTERACTION_DRAFT_V1"
MAX_NOTE_CHARACTERS = 2000  # Local draft UI safety bound; NOT a scoring threshold.


def _canonical(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _moment_index(design: dict) -> dict[str, dict]:
    if not isinstance(design, dict) or design.get("modelVersion") != MOMENT_VERSION:
        raise ValueError("Unsupported Chronicle moment-design projection")
    if not isinstance(design.get("moments"), list):
        raise ValueError("Chronicle moments list required")
    index: dict[str, dict] = {}
    for raw in design["moments"]:
        if not isinstance(raw, dict) or not _text(raw.get("momentId")):
            raise ValueError("Invalid design moment")
        if raw["momentId"] in index:
            if raw != index[raw["momentId"]]:
                raise ValueError("Conflicting moment identity")
            raise ValueError("Duplicate moment identity")
        if not _text(raw.get("respondentLeaguePlayerId")) or not _text(raw.get("counterpartLeaguePlayerId")):
            raise ValueError("Missing directional recipient")
        if raw["respondentLeaguePlayerId"] == raw["counterpartLeaguePlayerId"]:
            raise ValueError("Self-directed Chronicle question")
        index[raw["momentId"]] = raw
    return index


def _available(raw: dict) -> bool:
    # Original four evidence gates only; new families are review-only even
    # when their shape was accepted for editorial preview.
    return (
        raw.get("origin") == "GATED_V1_OPPORTUNITY"
        and raw.get("priorSourceCandidateGateRetained") is True
        and raw.get("reviewStatus") == "CANDIDATE_FOR_HUMAN_REVIEW"
        and raw.get("blockers") == []
        and raw.get("presentationIntent") == "JUDGMENT_CANDIDATE"
        and raw.get("renderingStatus") == "DESIGN_PREVIEW_ONLY"
        and _text(raw.get("sourceOpportunityId"))
        and _text(raw.get("proposedQuestion"))
        and isinstance(raw.get("evidence"), dict)
        and isinstance(raw.get("proposedStructuredChoices"), list)
        and len(raw["proposedStructuredChoices"]) >= 2
        and raw.get("questionsDisplayedToPlayer") is False
        and raw.get("submissionEnabled") is False
    )


def _choice_ids(raw: dict, choice_ids: Any) -> list[str]:
    if not isinstance(choice_ids, list) or not choice_ids or any(not _text(c) for c in choice_ids):
        raise ValueError("Select at least one supported structured choice")
    if len(choice_ids) != len(set(choice_ids)):
        raise ValueError("Repeated answer choice")
    options = raw["proposedStructuredChoices"]
    allowed = {o["choiceId"]: o for o in options if isinstance(o, dict)
               and _text(o.get("choiceId")) and _text(o.get("label"))}
    if len(allowed) != len(options) or any(c not in allowed for c in choice_ids):
        raise ValueError("Choice not present in the selected source-anchored question")
    # All current authored answer options are alternatives for one question.
    # A future explicitly approved grouping schema may permit compatible
    # multi-select judgments; never infer compatibility from option wording.
    if len(choice_ids) != 1:
        raise ValueError("Current question defines mutually exclusive judgments")
    return sorted(choice_ids)


def _note(value: Any) -> str:
    if not isinstance(value, str) or len(value) > MAX_NOTE_CHARACTERS:
        raise ValueError("Optional local draft note must be bounded plain text")
    return value


def project_private_chronicle_interaction(
    *, moment_design: dict[str, Any], viewer_league_player_id: str,
    local_actions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Render a viewer-filtered *local draft* and replay simulated interactions.

    No effects, public projection, network writes, notifications, timestamps or
    binding confirmations. Authentication MUST be added outside this draft.
    Only supplied, active moments remain addressable after source corrections.
    """
    if not _text(viewer_league_player_id):
        raise ValueError("Explicit viewer identity is required")
    index = _moment_index(moment_design)
    visible = {k: v for k, v in index.items()
               if v["respondentLeaguePlayerId"] == viewer_league_player_id}
    state = {key: {"state": "UNANSWERED", "draftChoiceIds": [],
                   "draftNote": "", "simulatedReceipt": None, "deferred": False}
             for key in visible}
    if local_actions is not None and not isinstance(local_actions, list):
        raise ValueError("Local action log must be a list")
    seen_actions: dict[str, str] = {}
    for action in local_actions or []:
        if not isinstance(action, dict) or not _text(action.get("actionId")):
            raise ValueError("Every local action needs a stable action identity")
        sig = _canonical(action)
        if action["actionId"] in seen_actions:
            if seen_actions[action["actionId"]] != sig:
                raise ValueError("Conflicting local action identity")
            continue
        seen_actions[action["actionId"]] = sig
        moment_id = action.get("momentId")
        if moment_id not in visible:
            raise ValueError("Moment is not active or not owned by viewer")
        raw = visible[moment_id]
        kind = action.get("kind")
        if kind not in ("SAVE_DRAFT", "DEFER", "SIMULATE_CONFIRM"):
            raise ValueError("Unsupported local-only Chronicle action")
        if not _available(raw):
            raise ValueError("Only gated source-review candidates support the demo interaction")
        if action.get("claimedViewerLeaguePlayerId") != viewer_league_player_id:
            raise ValueError("Local simulation requires matching asserted viewer")
        entry = state[moment_id]
        if entry["state"] == "SIMULATED_CONFIRMED":
            raise ValueError("Only one simulated confirmation per incident and respondent")
        if kind == "DEFER":
            if set(action) != {"actionId", "momentId", "kind", "claimedViewerLeaguePlayerId"}:
                raise ValueError("Defer is not a hidden answer or submission")
            entry.update(state="DEFERRED", deferred=True, draftChoiceIds=[], draftNote="")
        elif kind == "SAVE_DRAFT":
            if set(action) != {"actionId", "momentId", "kind", "claimedViewerLeaguePlayerId", "choiceIds", "note"}:
                raise ValueError("Invalid local draft action")
            choices = _choice_ids(raw, action["choiceIds"])
            note = _note(action["note"])
            entry.update(state="LOCAL_DRAFT", draftChoiceIds=choices, draftNote=note, deferred=False)
        else:
            if set(action) != {"actionId", "momentId", "kind", "claimedViewerLeaguePlayerId", "explicitDemoConfirmation"}:
                raise ValueError("Confirmation has undocumented fields")
            if action["explicitDemoConfirmation"] is not True or entry["state"] != "LOCAL_DRAFT":
                raise ValueError("A selected draft and deliberate demo confirmation are required")
            choices = entry["draftChoiceIds"]
            if choices == ["UNDECIDED"]:
                raise ValueError("Uncertain is a deferral, not a binding statement")
            receipt = {
                "receiptType": "LOCAL_SIMULATION_ONLY",
                "momentId": moment_id,
                "respondentLeaguePlayerId": viewer_league_player_id,
                "counterpartLeaguePlayerId": raw["counterpartLeaguePlayerId"],
                "family": raw["family"],
                "choiceIds": deepcopy(choices),
                "optionalNonScoringNote": entry["draftNote"],
                "evidence": deepcopy(raw["evidence"]),
                "simulatedReceiptId": "demo-" + sha256(_canonical(
                    [VERSION, moment_id, viewer_league_player_id, choices, entry["draftNote"]]
                ).encode()).hexdigest(),
                "sourceAuthenticationPerformed": False,
                "viewerAuthenticationPerformed": False,
                "bindingJudgmentRecorded": False,
                "historicalQualificationEvaluated": False,
                "relationshipEffectQualified": False,
                "exceptionalTreacheryQualified": False,
                "reciprocityQualified": False,
                "warRoomEffect": False,
            }
            entry.update(state="SIMULATED_CONFIRMED", simulatedReceipt=receipt)

    rows = []
    for moment_id, raw in sorted(visible.items()):
        if raw.get("presentationIntent") == "NARRATIVE_ONLY":
            status = "NARRATIVE_PREVIEW_ONLY"
        elif raw.get("reviewStatus") == "BLOCKED" or raw.get("blockers"):
            status = "BLOCKED"
        elif _available(raw):
            status = "DEMO_INTERACTION_AVAILABLE"
        else:
            status = "EDITORIAL_REVIEW_ONLY"
        # No show-to-public or push semantics here. In particular, "available"
        # does not mean notification delivery or eligibility for real submission.
        rows.append({
            "momentId": moment_id,
            "family": raw["family"],
            "title": raw["title"],
            "recipientLeaguePlayerId": raw["respondentLeaguePlayerId"],
            "counterpartLeaguePlayerId": raw["counterpartLeaguePlayerId"],
            "story": deepcopy(raw["story"]),
            "question": raw.get("proposedQuestion"),
            "choices": deepcopy(raw.get("proposedStructuredChoices", [])),
            "presentationIntent": raw.get("presentationIntent"),
            "renderStatus": status,
            "reviewStatus": raw.get("reviewStatus"),
            "blockers": deepcopy(raw.get("blockers", [])),
            "evidence": deepcopy(raw.get("evidence", {})),
            "localSimulation": deepcopy(state[moment_id]),
            "liveSubmissionEnabled": False,
            "bindingJudgmentRecorded": False,
            "relationshipEffectQualified": False,
        })
    return {
        "modelVersion": VERSION,
        "sourceMomentVersion": MOMENT_VERSION,
        "viewerLeaguePlayerId": viewer_league_player_id,
        "moments": rows,
        "policy": {
            "draftSimulationOnly": True,
            "authenticated": False,
            "serverSideAuthorizationPerformed": False,
            "externalPersistenceEnabled": False,
            "automaticDeliveryEnabled": False,
            "playerFacingChronicleEnabled": False,
            "bindingJudgmentEnabled": False,
            "judgmentCorrectionWorkflowEnabled": False,
            "qualifiedHistoricalEvaluationEnabled": False,
            "relationshipScoringEnabled": False,
            "warRoomEffectsEnabled": False,
            "notificationFrequencyPolicyConfigured": False,
        },
    }