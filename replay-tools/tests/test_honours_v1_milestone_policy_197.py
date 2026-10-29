"""Issue #197 / #196 / #205 design consistency checks.

These checks do not establish replay execution, publish a holder, or authorize
award grants. Actual owner-approved threshold policy is still absent.
"""
from pathlib import Path
import json
import unittest

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "docs/design/awards-records-v2-registry.json"
CURATION = ROOT / "docs/design/honours-v1-curation-186.json"
OWNER = ROOT / "docs/design/honours-v1-owner-directions-2026-10-28.md"
POLICY = ROOT / "docs/design/honours-v1-milestone-record-policy-197.md"


class MilestoneRecordPolicy197DesignTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.base = json.loads(BASE.read_text("utf-8"))
        cls.curated = json.loads(CURATION.read_text("utf-8"))
        cls.policy = POLICY.read_text("utf-8")

    def test_old_catalogue_unchanged_cardinality_and_null_gates(self) -> None:
        b = self.base
        self.assertEqual(len(b["achievementFamilies"]), 37)
        self.assertEqual(len(b["competitiveRecords"]), 26)
        self.assertEqual(len(b["recordCohorts"]), 11)
        self.assertEqual(
            sum(len(a["tierPlan"]) for a in b["achievementFamilies"]), 148
        )
        self.assertTrue(all(
            a["cutoffValues"] is None and
            all(t["threshold"] is None for t in a["tierPlan"])
            for a in b["achievementFamilies"]
        ))
        self.assertEqual(
            sorted(len(ids) for ids in
                   b["featuredRecordProvisionalCandidates"].values()),
            [3] * 5,
        )
        self.assertEqual(
            self.curated["ownerDecisions2026Oct28"]["selectedCodes"],
            ["1A", "2A", "3A", "4C", "5A"],
        )

    def test_four_different_achievement_record_and_trophy_outputs(self) -> None:
        p = self.policy
        for term in (
            "Achievement (personal first milestone and fixed tiers)",
            "Personal best",
            "Current public Season/League record",
            "AR2_TROPHY_SWIFT_ASCENT",
            "AOF_OPENING_STATISTICS_V6",
            "opening.ageUp.castle.ageUpAtMs",
            "160,000ms",
            "source-qualified",
            "PENDING_MATURITY",
            "owner-only Chronicle",
        ):
            with self.subTest(term=term):
                self.assertIn(term, p)
        self.assertIn("Result-pending does NOT itself disqualify", p)
        self.assertIn("executionScore >75", p)
        self.assertIn("hard maximum", p)
        self.assertIn("not pre-approved achievement thresholds", p)
        self.assertIn("22:10", p)
        self.assertIn("plain 22:10 Castle research+projection", p)
        self.assertIn("no automatic trophy", p.lower())

    def test_transferable_competitive_trophy_policy_is_owner_corrected(self) -> None:
        p = self.policy
        self.assertIn("SUPERSEDES the former end-of-Season-only", p)
        self.assertIn("transferable possession", p)
        self.assertIn("STRICTLY_BETTER_GAME", p)
        self.assertIn("TRANSFERS", p.upper())
        self.assertIn("PENDING_TIE_POLICY", p)
        self.assertIn("REBUILD_SOURCE_LEDGER", p)
        self.assertIn("RESTORE_RIGHTFUL_HOLDER_OR_UNCLAIMED", p)
        self.assertIn("SEASON_ARCHIVED", p)
        self.assertIn("Alice → Bruno → Clara", p)
        self.assertIn("Nomad 13:40", p)
        self.assertIn("Migration 13:50", p)
        self.assertIn("no automatic trophy", p.lower())
        self.assertIn("The Castle Crown", p)
        self.assertIn("Crown of the Castle Age", p)
        self.assertIn("The Castle Vanguard", p)
        self.assertIn("display name unapproved", p.lower())
        self.assertIn("The Swift Ascent", p)
        self.assertIn("rejected", p.lower())
        self.assertNotIn("End-of-Season laureate (RECOMMENDED)", p)
        self.assertNotIn("SEASON_FINALIZED ∧", p)

    def test_maturity_absolute_thresholds_are_null_and_historical_distinctions_separate(self) -> None:
        p = self.policy
        for key in ("T_FC", "D_elapsed", "N_distinctEligibleBattles",
                    "N_comparablePlayers", "PENDING_MATURITY",
                    "initial true tie", "source revision",
                    "later strictly better", "Season end archives"):
            self.assertIn(key.lower(), p.lower())
        self.assertIn("Distinctions", p)
        o = self.curated["ownerDecisions2026Oct29"]
        self.assertFalse(o["grantOrPublicationAuthorised"])
        self.assertEqual(o["internalTrophyId"], "AR2_TROPHY_SWIFT_ASCENT")
        self.assertEqual(o["recordId"], "AR2_REC_CASTLE")
        self.assertEqual(o["publicName"], "NOT_APPROVED")
        self.assertEqual(len(o["nameCandidates"]), 3)
        self.assertTrue(all(v is None for v in o["thresholds"].values()))
        self.assertEqual(len(o["retainedOwnerDirections"]), 5)
        candidate = next(t for t in self.curated["trophyCandidates"]
                         if t["id"] == "AR2_TROPHY_SWIFT_ASCENT")
        self.assertEqual(candidate["name"], "UNAPPROVED_PLAYER_FACING_NAME")
        self.assertEqual(candidate["rejectedLegacyDisplayName"], "The Swift Ascent")
        self.assertEqual(candidate["firstTieWithoutIncumbent"],
                         "PENDING_OWNER_TIE_POLICY_NO_GRANT")
        self.assertIn("TRANSFERABLE", candidate["status"])

    def test_opportunity_not_same_map_civ_and_regression_negatives(self) -> None:
        p = self.policy
        for term in (
            "identical map ID", "identical civilization ID",
            "Nomad", "Migration", "custom/scenario",
            "BO3", "duplicate POV", "19m Game", "mixed",
            "short opening burst", "result", "correction",
            "source revisions", "ordinary map",
        ):
            with self.subTest(term=term):
                self.assertIn(term.lower(), p.lower())
        for family in (
            "AR2_ACH_FAST_CASTLE", "AR2_ACH_DRUSH", "AR2_ACH_FARMS_AT_20",
            "AR2_ACH_DEFENSIVE_ASSISTS", "AR2_ACH_RAIDS"
        ):
            self.assertIn(family, p)
        self.assertIn("mandatory Drush Flush", p)

    def test_up_to_four_owner_decisions_and_worker_boundaries(self) -> None:
        p = self.policy
        self.assertIn("FOUR", p)
        for term in ("#206 Worker S", "Worker D #199", "Worker 1 #201",
                     "#172", "No points"):
            self.assertIn(term.lower(), p.lower())
        owner = OWNER.read_text("utf-8")
        self.assertIn("honours-v1-milestone-record-policy-197.md", owner)


if __name__ == "__main__":
    unittest.main()
