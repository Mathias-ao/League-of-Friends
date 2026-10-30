"""Design-only consistency assertions for owner's 31 Oct V1 honours selection.

These tests validate catalogue preservation, proposed evidence boundaries and
no-grant status. They are NOT authentic replay positive tests, no validated
fog-of-war witness, no wonder-victory proof, and never mint entitlements.
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "docs/design/awards-records-v2-registry.json"
CURATION = ROOT / "docs/design/honours-v1-curation-186.json"
OWNER = ROOT / "docs/design/honours-v1-owner-launch-selection-2026-10-31.json"
DOC = ROOT / "docs/design/honours-v1-owner-launch-selection-2026-10-31.md"


class OwnerHonoursLaunchSelection20261031Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.base = json.loads(BASE.read_text(encoding="utf-8"))
        cls.curation = json.loads(CURATION.read_text(encoding="utf-8"))
        cls.owner = json.loads(OWNER.read_text(encoding="utf-8"))
        cls.doc = DOC.read_text(encoding="utf-8")

    def test_exact_two_two_six_owner_selection_and_no_live_grants(self) -> None:
        d = self.owner
        self.assertEqual(d["schemaVersion"],
                         "AOF_HONOURS_V1_OWNER_LAUNCH_SELECTION_2026_10_31_V1")
        self.assertIn("NO_GRANTS", d["policyState"])
        self.assertEqual([len(d[k]) for k in
                          ("selectedTrophies", "selectedEpithets",
                           "selectedDistinctions")], [2, 2, 6])
        self.assertEqual(len(d["ownerRemainingDecisions"]), 4)
        self.assertGreaterEqual(len(d["hardNoAction"]), 6)
        self.assertEqual(len(set(x["key"] for x in
                                 d["selectedDistinctions"])), 6)
        self.assertEqual(
            self.curation["ownerLaunch2026Oct31"]["publishOrGrant"],
            False,
        )

    def test_frozen_baseline_is_untouched_and_school_elite_still_required(self) -> None:
        b = self.base
        self.assertEqual(len(b["achievementFamilies"]), 37)
        self.assertEqual(len(b["competitiveRecords"]), 26)
        self.assertEqual(len(b["recordCohorts"]), 11)
        self.assertEqual(
            sum(len(x["tierPlan"]) for x in b["achievementFamilies"]), 148
        )
        self.assertTrue(all(x["cutoffValues"] is None and
                            all(t["threshold"] is None for t in x["tierPlan"])
                            for x in b["achievementFamilies"]))
        self.assertEqual(
            [len(x) for x in b["featuredRecordProvisionalCandidates"].values()],
            [3, 3, 3, 3, 3],
        )
        master = next(e for e in self.owner["selectedEpithets"]
                      if e["key"] == "THREE_SCHOOLS")
        for term in ("DRUSH_FLUSH", "SCOUT_RUSH", "ARCHER_RUSH",
                     "FAST_CASTLE_BOOM", "ACTIVE_ELITE"):
            self.assertIn(term, master["source"])
        self.assertEqual(master["internalId"],
                         "AR2_EPITHET_THREE_SCHOOLS")

    def test_fc_transfer_id_stable_and_wonder_victory_method_blocked(self) -> None:
        d = self.owner
        fc, wonder = d["selectedTrophies"]
        self.assertEqual(fc["internalId"], "AR2_TROPHY_SWIFT_ASCENT")
        self.assertIsNone(fc["displayName"])
        self.assertEqual(fc["thresholds"],
                         {"absoluteTimeMs": None, "maturity": None})
        self.assertEqual(fc["transfer"],
                         "STRICTLY_LOWER_SOURCE_CURRENT_COMPARABLE_GAME_DURING_SEASON")
        self.assertTrue(fc["historicalSuccession"])
        self.assertEqual(wonder["status"], "BLOCKED_VICTORY_METHOD_AND_CONTEST_RULE")
        self.assertIsNone(wonder["displayName"])
        self.assertIsNone(wonder["thresholds"]["clockMs"])
        self.assertIn("GameOutcome lacks explicit wonder-victory",
                      wonder["source"])
        self.assertIn("Wonder placement request", wonder["not"])
        self.assertIn("Wonder", self.doc)

    def test_unbroken_is_active_four_non_ffa_games_and_loss_revokes(self) -> None:
        u = next(e for e in self.owner["selectedEpithets"]
                 if e["key"] == "UNBROKEN")
        self.assertEqual(u["publicName"], "the Unbroken")
        self.assertEqual(u["minQualifyingGameCount"], 4)
        self.assertEqual(u["eligibleResults"], "NON_FFA_OFFICIAL_ACCEPTED_GAMES")
        self.assertEqual(u["failOn"],
                         "ANY_CURRENT_SEASON_NON_FFA_ACCEPTED_LOSS")
        self.assertFalse(u["ffaLossDisqualifies"])
        self.assertEqual(u["ffaWinCountsTowardsMinimum"], "OPEN_RECOMMEND_NO")
        self.assertIn("CURRENT_SEASON", u["scopeProposal"])
        self.assertIn("RECOMPUTE", u["correction"])
        self.assertIn("ONE_VOLUNTARILY", u["display"])
        self.assertIn("one canonical Game", self.doc)

    def test_ffa_medal_upgrade_is_one_badge_based_on_sole_official_winner(self) -> None:
        f = self.owner["selectedDistinctions"][0]
        self.assertEqual(f["key"], "FFA_SOLO_WIN")
        self.assertTrue(f["upgradeable"])
        self.assertEqual(f["awardUnit"],
                         "CUMULATIVE_DISTINCT_ACCEPTED_BATTLES")
        self.assertIsNone(f["currentUpgradeThresholds"])
        self.assertIn("PLAYER_WIN", f["source"])
        self.assertIn("COALITION_WIN", f["source"])
        self.assertIn("never allied", f["limits"])
        self.assertIn("upgrad", self.doc.lower())

    def test_boomer_explorer_gold_aggression_defence_limit_source_claims(self) -> None:
        rows = {x["key"]: x for x in self.owner["selectedDistinctions"]}
        boomer = rows["BOOMER"]
        self.assertTrue(boomer["sameGame"] and boomer["sameTimeframe"])
        self.assertEqual(len(boomer["source"]), 4)
        self.assertIsNone(boomer["clockThresholdMs"])
        self.assertTrue(all(t is None for t in
                            boomer["metricThresholds"].values()))
        self.assertIn("Huns", boomer["limits"])

        explorer = rows["EXPLORER"]
        self.assertEqual(explorer["suggestedCoveragePercentApprox"], 90)
        self.assertFalse(explorer["numericCutoffApproved"])
        self.assertIsNone(explorer["clockThresholdMs"])
        self.assertIn("MODELLED", explorer["status"])
        self.assertIn("Do not grant from commandMapCoverage", explorer["limits"])
        self.assertIn("Estimated", explorer["displayMetric"])

        gold = rows["GOLD"]
        self.assertIsNone(gold["metricThresholds"])
        self.assertIn("MARKET", gold["optionalBlockedBranch"])

        aggression = rows["AGGRESSION"]
        defensive = rows["DEFENSIVE"]
        self.assertIn("OPTIONAL_PRIVATE", aggression["acknowledgement"])
        self.assertIn("OPTIONAL_NON_LEADING", defensive["acknowledgement"])
        self.assertIn("CANNOT_INVENT_EXECUTED_EFFECT",
                      defensive["acknowledgement"])
        self.assertEqual(len(defensive["overlapReserved"]), 2)
        self.assertIn("SOURCE", defensive["status"])
        self.assertIn("source-observed", self.doc.lower())


if __name__ == "__main__":
    unittest.main()
