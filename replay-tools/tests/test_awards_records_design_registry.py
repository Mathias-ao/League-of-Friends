"""Structural-only guardrail for the Worker C #157 DESIGN-ONLY registry.

This does NOT prove any replay semantic or award eligibility. Authentic positive
and negative controlled recordings are still required before runtime adoption.
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

REGISTRY = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "design"
    / "awards-records-v2-registry.json"
)

AVAILABLE = {"EXISTING_MEASUREMENT", "DERIVE", "ENGINE_WITNESS"}
TABS = {"Opening", "Economy", "Military", "Map Presence", "Execution"}
PROGRESS = {"BEST_QUALIFIED_GAME", "CUMULATIVE_DISTINCT_BATTLES"}


class AwardsRecordsDesignRegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.data = json.loads(REGISTRY.read_text(encoding="utf-8"))

    def test_is_design_only_and_pinned_to_issue_157(self) -> None:
        data = self.data
        self.assertEqual(
            data["schemaVersion"], "AOF_AWARDS_RECORDS_DESIGN_REGISTRY_V1"
        )
        self.assertEqual(
            data["releaseState"], "DESIGN_ONLY_DO_NOT_IMPORT_INTO_PRODUCTION"
        )
        self.assertIn(157, data["parentIssues"])
        self.assertEqual(
            data["reviewedMain"],
            "e453d40c147ad488f3bfd369e54eba82b29c43b5",
        )
        self.assertEqual(
            data["allRankThresholds"],
            "PENDING_OWNER_CALIBRATION_NOT_APPROVED",
        )

    def test_all_37_owner_achievement_families_preserved(self) -> None:
        data = self.data
        family = data["achievementFamilies"]
        self.assertEqual(len(family), 37)
        self.assertEqual(data["achievementFamilyCounts"],
            {"General": 23, "FixedTeam": 7, "Diplomacy": 7, "total": 37})
        self.assertEqual(len({r["id"] for r in family}), 37)
        self.assertTrue(all(r["id"].startswith("AR2_ACH_") for r in family))
        self.assertEqual(
            {s: sum(a["availability"] == s for a in family) for s in AVAILABLE},
            {"EXISTING_MEASUREMENT": 8, "DERIVE": 17, "ENGINE_WITNESS": 12},
        )
        self.assertEqual(
            [sum(f["availability"] == status for f in family[start:end])
             for start, end, status in
             [(0, 23, "EXISTING_MEASUREMENT"),
              (0, 23, "DERIVE"), (0, 23, "ENGINE_WITNESS")]],
            [7, 14, 2],
        )
        self.assertTrue(all(
            r["availability"] == "ENGINE_WITNESS" for r in family[30:]
        ))
        for r in family:
            with self.subTest(id=r["id"]):
                self.assertIn(r["progression"], PROGRESS)
                self.assertIn(r["availability"], AVAILABLE)
                self.assertTrue(r["axis"])
                self.assertTrue(r["sourcePaths"])
                self.assertTrue(r["currentSourceModelRevisions"])
                self.assertTrue(r["eligibleFormats"])
                self.assertIsNone(r["cutoffValues"])
                self.assertTrue(r["evidenceRule"])
                self.assertEqual(
                    r["tierLadder"], "FOUR_QUALITATIVE_RANKS_UNCALIBRATED"
                )
                if r["variant"] is not None:
                    self.assertIn(
                        "additionalPredicate", r["variant"]
                    )
                    self.assertEqual(
                        r["variant"]["thresholds"], "OWNER_CALIBRATION_REQUIRED"
                    )

    def test_tier_gates_and_active_elite_epithet(self) -> None:
        ladder = self.data["genericTierLadder"]
        self.assertEqual(len(ladder), 4)
        self.assertEqual([x["level"] for x in ladder], [1, 2, 3, 4])
        self.assertEqual(ladder[-1]["rank"], "ELITE")
        self.assertTrue(all(t["numericThreshold"] is None for t in ladder))
        epithet = self.data["derivedEpithet"]
        self.assertEqual(epithet["grammaticalForm"], "POST_NOMINAL")
        self.assertTrue(epithet["optInEquip"])
        self.assertTrue(epithet["sourceOnlyFromActiveComponents"])
        predicate = epithet["predicate"]
        self.assertIn("ACTIVE_ELITE(DRUSH_DISCIPLINED)", predicate)
        self.assertIn("ACTIVE_ELITE(SCOUT_RUSH)", predicate)
        self.assertIn("ACTIVE_ELITE(ARCHER_RUSH)", predicate)
        self.assertIn("ACTIVE_ELITE(FAST_CASTLE_BOOM)", predicate)
        self.assertIn(" OR ", predicate)
        self.assertFalse(epithet["additionalBattleCountRequirement"])
        self.assertIsNone(epithet["numericalTierThresholds"])

    def test_exactly_26_nonduplicated_owner_record_candidates(self) -> None:
        data = self.data
        records = data["competitiveRecords"]
        self.assertEqual(len(records), 26)
        self.assertEqual(len({r["id"] for r in records}), 26)
        self.assertEqual(
            data["recordCounts"]["categoryBreakdown"],
            {"Opening": 8, "Economy": 4, "Military": 4,
             "Map Presence": 7, "Execution": 1, "Competition": 2},
        )
        self.assertEqual(data["recordCounts"]["seasonMetricDefinitions"], 71)
        self.assertEqual(data["recordCounts"]["rawRecordFlaggedMetrics"], 68)
        cohorts = set(data["recordCohorts"])
        for r in records:
            with self.subTest(id=r["id"]):
                self.assertIn(r["availability"], AVAILABLE)
                self.assertIn(r["direction"], {"MIN", "MAX"})
                self.assertIn(r["comparisonProfile"], cohorts)
                self.assertEqual(
                    r["holderTieRule"], "ALL_EXACT_EQUAL_QUALIFIED_EXTREMA"
                )
                self.assertNotEqual(r["unit"], "UNRESOLVED")
                self.assertTrue(r["unit"])
                self.assertTrue(r["sourcePaths"])
                self.assertTrue(r["currentSourceModelRevisions"])
                self.assertTrue(r["evidenceRule"])
                self.assertEqual(
                    r["comparisonAndPublicationState"],
                    "DESIGN_ONLY_NOT_APPROVED",
                )
                self.assertEqual(
                    r["knownClockMs"],
                    1_200_000 if r["checkpoint"] == "20_MINUTES" else None,
                )
        self.assertEqual(sum(r["id"] == "AR2_REC_CASTLE" for r in records), 1)
        self.assertEqual(sum(r["id"] == "AR2_REC_FC_BOOM" for r in records), 1)
        held_map = next(r for r in records
                        if r["id"] == "AR2_REC_MAP_EXPLORED_20")
        self.assertEqual(held_map["availability"], "ENGINE_WITNESS")
        self.assertIn("fog", held_map["evidenceRule"].lower())

    def test_exactly_three_valid_featured_slots_in_each_tab(self) -> None:
        featured = self.data["featuredRecordProvisionalCandidates"]
        self.assertEqual(set(featured), TABS)
        all_records = {
            r["id"]: r for r in self.data["competitiveRecords"]
        } | {
            r["id"]: r for r in self.data["extraExistingRecordCabinetSupport"]
        }
        for tab, ids in featured.items():
            with self.subTest(tab=tab):
                self.assertEqual(len(ids), 3)
                self.assertEqual(len(set(ids)), 3)
                for id_ in ids:
                    self.assertIn(id_, all_records)
                    self.assertEqual(all_records[id_]["tab"], tab)
                    self.assertEqual(
                        all_records[id_]["availability"],
                        "EXISTING_MEASUREMENT"
                    )
        self.assertEqual(
            self.data["approvedProductDecisions"]["featuredRecordPlaquesPerTab"], 3
        )
        self.assertIn(
            "NOT_OWNER_APPROVED", self.data["featuredSelectionStatus"]
        )

    def test_six_investigations_are_ranked_and_not_upgraded_to_success(self) -> None:
        investigations = self.data["investigativeMetrics"]
        self.assertEqual(len(investigations), 6)
        self.assertEqual(sorted(x["priority"] for x in investigations),
                         list(range(1, 7)))
        self.assertEqual(len({x["id"] for x in investigations}), 6)
        for r in investigations:
            with self.subTest(id=r["id"]):
                self.assertIn(r["availability"], AVAILABLE)
                self.assertTrue(r["from"])
                self.assertTrue(r["currentSourceModelRevisions"])
                self.assertTrue(r["qualifies"])
                self.assertTrue(r["doesNotProve"])
                self.assertTrue(r["nextWitness"])
        self.assertIn("garrison", investigations[0]["id"].lower())
        self.assertIn("multitasking", investigations[1]["id"].lower())
        self.assertIn("quickwall", investigations[2]["id"].lower())
        self.assertEqual(
            investigations[4]["availability"], "ENGINE_WITNESS"
        )
        self.assertEqual(
            investigations[5]["availability"], "ENGINE_WITNESS"
        )
        self.assertIn(
            "market", investigations[5]["doesNotProve"].lower()
        )

    def test_correction_privacy_and_comparability_are_non_optional(self) -> None:
        data = self.data
        required = data["projectionRules"]
        for key in ("oneVerifiedSource", "extrema", "dedupe", "correction",
                    "history", "unknown", "scoring"):
            self.assertTrue(required[key])
        self.assertIn("private", data["approvedProductDecisions"]
                      ["privatePersonalBestsSurface"].lower())
        self.assertEqual(len(data["recordCohorts"]), 8)
        for profile, rules in data["recordCohorts"].items():
            with self.subTest(profile=profile):
                self.assertTrue(rules["holdOnAnyMissing"])
                self.assertGreaterEqual(len(rules["required"]), 4)
        self.assertGreater(len(data["ownerOpenDecisions"]), 5)


if __name__ == "__main__":
    unittest.main()
