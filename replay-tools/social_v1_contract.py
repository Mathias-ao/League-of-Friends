"""SHARED_1 validation and pure guards; no authority lookup, persistence or scoring.

Validate untrusted JSON before calling guards. Publication approvals must come
from a server-owned registry. See contracts/social-v1/README.md for reference
resolution, transaction fencing and the durable slot persistence contract.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
import math
from pathlib import Path

from jsonschema import Draft202012Validator

CONTRACT = "AOF_SOCIAL_V1_SHARED_1"
SCHEMA_PATH = Path(__file__).resolve().parents[1] / "contracts/social-v1/shared.schema.json"
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
Draft202012Validator.check_schema(SCHEMA)


def battle_id_for_match(match_id):
    if not isinstance(match_id, str) or not match_id or "/" in match_id:
        raise ValueError("Expected an authoritative Match document ID")
    return match_id


def _identity(parts):
    return sha256(json.dumps(parts, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()


def invitation_slot_id(battle_id, respondent_player_id):
    battle_id_for_match(battle_id)
    if not respondent_player_id:
        raise ValueError("Missing respondent")
    return _identity([CONTRACT, "INVITATION", battle_id, respondent_player_id])


def chronicle_scene_id(battle_id, owner_player_id, counterpart_player_id):
    battle_id_for_match(battle_id)
    if not owner_player_id or counterpart_player_id == "":
        raise ValueError("Missing scene participant")
    return _identity([CONTRACT, "SCENE", battle_id, owner_player_id, counterpart_player_id])


def _finite_json(value):
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Non-finite JSON number")
    if isinstance(value, dict):
        for v in value.values():
            _finite_json(v)
    if isinstance(value, list):
        for v in value:
            _finite_json(v)


def validate_record(kind, value):
    """Validate a JSON record, including cross-field identity constraints."""
    _finite_json(value)
    if kind not in SCHEMA["$defs"]["RecordType"]["enum"]:
        raise ValueError("Unknown SHARED_1 record type")
    Draft202012Validator({"$ref": "#/$defs/" + kind, "$defs": SCHEMA["$defs"]}).validate(value)
    if "battleId" in value and battle_id_for_match(value["matchId"]) != value["battleId"]:
        raise ValueError("Battle/Match identity mismatch")
    if kind in ("Opportunity", "InvitationSlot"):
        if value["slotId"] != invitation_slot_id(value["battleId"], value["respondentPlayerId"]):
            raise ValueError("Invalid slot identity")
    if kind == "ChronicleScene" and value["sceneId"] != chronicle_scene_id(
            value["battleId"], value["ownerPlayerId"], value["counterpartPlayerId"]):
        raise ValueError("Invalid scene identity")
    if kind == "SourceSnapshot":
        players = [r["playerId"] for r in value["roster"]]
        slots = [r["replaySlot"] for r in value["roster"]]
        if len(set(players)) != len(players) or len(set(slots)) != len(slots):
            raise ValueError("Roster mapping must be one-to-one")
        if any(p not in players for p in value["outcome"]["winningPlayerIds"] or []):
            raise ValueError("Winner outside roster")
        kinds = [r["kind"] for r in value["artifactRefs"]]
        if len(set(kinds)) != len(kinds) or "STATISTICS" not in kinds:
            raise ValueError("Missing or duplicated statistics artifact")
    subject = value.get("subject", {})
    if subject.get("system") == "RELATIONSHIP" and subject["fromPlayerId"] == subject["toPlayerId"]:
        raise ValueError("Relationship requires two players")
    if kind == "Inference" and value["action"]["actorPlayerId"] == value["action"]["counterpartPlayerId"]:
        raise ValueError("Inference requires two players")
    if kind == "Judgment" and len({c["choiceId"] for c in value["choices"]}) != len(value["choices"]):
        raise ValueError("Duplicate judgment choice")
    if kind == "Receipt" and value["allocatedUnits"] is not None and value["requestedUnits"] is not None:
        if value["allocatedUnits"] > value["requestedUnits"]:
            raise ValueError("Allocation exceeds request")
    return value


def assert_approved(policy, approvals):
    if policy["status"] != "APPROVED" or not policy["approvalRef"] or not any(
        p["status"] == "APPROVED" and all(p[k] == policy[k] for k in
            ("policyVersion", "configurationVersion", "approvalRef")) for p in approvals
    ):
        raise ValueError("Unapproved policy/configuration")


def assert_publication_allowed(record, approvals):
    assert_approved(record.get("selectorPolicy", record.get("qualificationPolicy", record.get("policy"))), approvals)
    if any(s["status"] == "DEVELOPING" and s["value"] is not None for s in record.get("sliders", [])):
        raise ValueError("Developing sliders have no value")
    if record.get("state") == "SUPERSEDED" or ("slotId" in record and record["state"] == "WITHDRAWN"):
        raise ValueError("Superseded/withdrawn record")


def public_judgment(judgment, approvals):
    assert_approved(judgment["qualificationPolicy"], approvals)
    if judgment["correction"] in ("REOPENED", "SUPERSEDED"):
        return None
    choices = [{"choiceId": c["choiceId"], "decision": c["decision"], "label":
                "Qualified" if c["decision"] == "QUALIFIED" else "Not Qualified — No Relationship Effect"}
               for c in judgment["choices"] if c["decision"] in ("QUALIFIED", "NOT_QUALIFIED")]
    if not choices:
        return None
    return {**{k: deepcopy(judgment[k]) for k in ("judgmentId", "judgmentRevision", "incidentId",
        "incidentRevision", "sourceAuthority", "authorPlayerId", "counterpartPlayerId", "family",
        "qualificationPolicy")}, "choices": choices}


def plan_invitation_offer(current, opportunity, expected_revision, approvals):
    assert_publication_allowed(opportunity, approvals)
    slot_id = invitation_slot_id(opportunity["battleId"], opportunity["respondentPlayerId"])
    if opportunity["matchId"] != opportunity["battleId"] or opportunity["slotId"] != slot_id or opportunity["state"] != "OFFERED":
        raise ValueError("Invalid invitation identity/state")
    if (current["revision"] if current else 0) != expected_revision:
        raise ValueError("Invitation revision changed")
    if current:
        validate_record("InvitationSlot", current)
        if current["slotId"] != slot_id:
            raise ValueError("Different invitation slot")
        if current["state"] != "WITHDRAWN" and current["currentOpportunityRevision"] == opportunity["opportunityRevision"]:
            return {"slot": deepcopy(current), "created": False}
        raise ValueError("Battle invitation already consumed")
    return {"created": True, "slot": {"slotId": slot_id, "battleId": opportunity["battleId"],
        "matchId": opportunity["matchId"], "respondentPlayerId": opportunity["respondentPlayerId"],
        "revision": 1, "state": "OFFERED", "firstOpportunityRevision": opportunity["opportunityRevision"],
        "currentOpportunityRevision": opportunity["opportunityRevision"]}}


def transition_invitation(slot, expected_revision, opportunity_revision, next_state):
    validate_record("InvitationSlot", slot)
    if slot["revision"] != expected_revision or slot["currentOpportunityRevision"] != opportunity_revision:
        raise ValueError("Stale invitation")
    allowed = {"OFFERED": ("DEFERRED", "DECLINED", "SUBMITTED", "WITHDRAWN"),
               "DEFERRED": ("DECLINED", "SUBMITTED", "WITHDRAWN"), "DECLINED": ("WITHDRAWN",),
               "SUBMITTED": ("WITHDRAWN",), "WITHDRAWN": ()}
    if next_state not in allowed[slot["state"]]:
        raise ValueError("Invalid invitation transition")
    return {**slot, "revision": slot["revision"] + 1, "state": next_state,
            "currentOpportunityRevision": None if next_state == "WITHDRAWN" else slot["currentOpportunityRevision"]}
