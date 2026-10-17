"""The same positive/negative fixtures as Node; --report enables exact parity CI."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest
from jsonschema.exceptions import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import social_v1_contract as c

F = json.loads((c.SCHEMA_PATH.parent / "fixtures/conformance.json").read_text(encoding="utf-8"))


def value_for(case):
    value = deepcopy(F["bases"][case["recordType"]])
    for patch in case["patch"]:
        parent = value
        for key in patch["path"][:-1]:
            parent = parent[int(key) if isinstance(parent, list) else key]
        key = patch["path"][-1]
        parent[int(key) if isinstance(parent, list) else key] = deepcopy(patch["value"])
    return value


def case_report():
    rows = []
    for case in F["cases"]:
        value = value_for(case)
        valid = True
        try:
            c.validate_record(case["recordType"], value)
        except (ValueError, ValidationError):
            valid = False
        publication = None
        if "publication" in case:
            try:
                c.validate_record(case["recordType"], value)
                c.assert_publication_allowed(value, case.get("approvals", F["approvals"]))
                publication = True
            except (ValueError, ValidationError):
                publication = False
        rows.append({"name": case["name"], "valid": valid, "publication": publication})
    return rows


class ContractTests(unittest.TestCase):
    def test_shared_fixtures(self):
        for case, actual in zip(F["cases"], case_report()):
            with self.subTest(case=case["name"]):
                self.assertEqual(actual["valid"], case["valid"])
                if "publication" in case:
                    self.assertEqual(actual["publication"], case["publication"])

    def test_identities(self):
        for v in F["identityVectors"]:
            self.assertEqual(c.invitation_slot_id(v["battleId"], v["owner"]), v["slotId"])
            self.assertEqual(c.chronicle_scene_id(v["battleId"], v["owner"], v["counterpart"]), v["sceneId"])
        first = F["bases"]["SourceSnapshot"]
        second = value_for(next(case for case in F["cases"] if case["name"] == "second-game-same-battle"))
        self.assertEqual(len({s["battleId"] for s in (first, second, {**first, "sourceHash": "b" * 64})}), 1)
        self.assertNotEqual(c.invitation_slot_id("match-1", "p1"), c.invitation_slot_id("match-1", "p2"))
        self.assertNotEqual(c.invitation_slot_id("match-1", "p1"), c.invitation_slot_id("match-2", "p1"))

    def lifecycle(self):
        o, approvals = F["bases"]["Opportunity"], F["approvals"]
        first = c.plan_invitation_offer(None, o, 0, approvals)
        self.assertTrue(first["created"])
        c.validate_record("InvitationSlot", first["slot"])
        snapshots = [first]
        for state in ("OFFERED", "DEFERRED", "DECLINED", "WITHDRAWN"):
            slot = snapshots[-1]["slot"]
            if state != "OFFERED":
                slot = c.transition_invitation(slot, slot["revision"], o["opportunityRevision"], state)
            snapshots.append({"slot": slot, "created": False})
            c.validate_record("InvitationSlot", slot)
            if state == "WITHDRAWN":
                with self.assertRaises(ValueError):
                    c.plan_invitation_offer(slot, o, slot["revision"], approvals)
            else:
                self.assertEqual(c.plan_invitation_offer(slot, o, slot["revision"], approvals), {"slot": slot, "created": False})
            with self.assertRaises(ValueError):
                c.plan_invitation_offer(slot, {**o, "opportunityRevision": "b" * 64,
                    "sourceAuthority": "b" * 64, "incidentId": "other-game-incident", "family": "SITUATED_GRIEVANCE"}, slot["revision"], approvals)
            with self.assertRaises(ValueError):
                c.transition_invitation(slot, slot["revision"], "b" * 64, "SUBMITTED")
        with self.assertRaises(ValueError):
            c.plan_invitation_offer(first["slot"], o, 0, approvals)
        submitted = c.transition_invitation(first["slot"], 1, o["opportunityRevision"], "SUBMITTED")
        with self.assertRaises(ValueError):
            c.transition_invitation(submitted, submitted["revision"], o["opportunityRevision"], "DEFERRED")
        withdrawn = c.transition_invitation(submitted, submitted["revision"], o["opportunityRevision"], "WITHDRAWN")
        self.assertEqual(withdrawn["firstOpportunityRevision"], o["opportunityRevision"])
        with self.assertRaises(ValueError):
            c.plan_invitation_offer(withdrawn, o, withdrawn["revision"], approvals)
        return snapshots

    def test_lifecycle(self):
        self.lifecycle()

    def test_public_judgment(self):
        output = c.public_judgment(F["bases"]["Judgment"], F["approvals"])
        self.assertEqual(output, F["bases"]["PublicJudgment"])
        c.validate_record("PublicJudgment", output)
        self.assertNotIn("PRIVATE", json.dumps(output))
        self.assertNotIn("private-pending", json.dumps(output))
        for correction in ("REOPENED", "SUPERSEDED"):
            self.assertIsNone(c.public_judgment({**F["bases"]["Judgment"], "correction": correction}, F["approvals"]))
        self.assertIsNone(c.public_judgment({**F["bases"]["Judgment"], "choices": [F["bases"]["Judgment"]["choices"][1]]}, F["approvals"]))

    def test_non_finite(self):
        for value in (float("nan"), float("inf"), float("-inf")):
            with self.assertRaises(ValueError):
                c.validate_record("Observation", {**F["bases"]["Observation"], "value": value})


if __name__ == "__main__":
    if "--report" in sys.argv:
        print(json.dumps({"cases": case_report(), "identities": [{
            "slotId": c.invitation_slot_id(v["battleId"], v["owner"]),
            "sceneId": c.chronicle_scene_id(v["battleId"], v["owner"], v["counterpart"])} for v in F["identityVectors"]],
            "publicJudgment": c.public_judgment(F["bases"]["Judgment"], F["approvals"]),
            "lifecycle": ContractTests().lifecycle()}, ensure_ascii=False))
    else:
        unittest.main()
