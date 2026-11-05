"""Design-only integrity checks for issue #186 curation.

These checks DO NOT qualify an authentic replay or enable any award. Source
execution semantics are still enforced by the approved producer after owner
calibration; this design file must never be used as live grant definitions.
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / "docs" / "design" / "awards-records-v2-registry.json"
CURATION = ROOT / "docs" / "design" / "honours-v1-curation-186.json"
TABS = {"Opening", "Economy", "Military", "Map Presence", "Execution"}
WAVES = {"V1_MEASUREMENT_CANDIDATE", "V1_AFTER_PURE_DERIVATION"}
PROMOTION = {
    "V1_MEASUREMENT_CANDIDATE": "EXISTING_MEASUREMENT",
    "V1_AFTER_PURE_DERIVATION": "DERIVE",
    "SOURCE_BLOCKED": "ENGINE_WITNESS",
}


class HonoursCuration186Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
        cls.curated = json.loads(CURATION.read_text(encoding="utf-8"))

    def test_design_only_not_a_live_rule(self) -> None:
        d = self.curated
        self.assertIn("NON_EXECUTABLE", d["state"])
        self.assertFalse(d["calibrationOnly"]["ownerApproved"])
        self.assertEqual(d["sourceAuthority"]["baselineMergedPR"], 162)
        self.assertEqual(d["sourceAuthority"]["issue"], 186)
        self.assertEqual(d["sourceAuthority"]["baselineRegistrySchema"],
                         self.baseline["schemaVersion"])
        self.assertEqual(d["ownerFinalThresholdsRetainedInBaseline"],
                         "ALL_148_NULL")

    def test_37_families_are_preserved_without_grant_upgrade(self) -> None:
        d = self.curated
        families = {
            a["id"].removeprefix("AR2_ACH_"): a
            for a in self.baseline["achievementFamilies"]
        }
        self.assertEqual(len(families), 37)
        self.assertEqual(set(d["familyDispositions"]), set(families))
        dispositions = d["familyDispositions"]
        counts = {
            status: sum(r["disposition"] == status
                        for r in dispositions.values())
            for status in {r["disposition"] for r in dispositions.values()}
        }
        self.assertEqual(counts, {
            "V1_MEASUREMENT_CANDIDATE": 7,
            "V1_AFTER_PURE_DERIVATION": 8,
            "DERIVATION_BACKLOG": 9,
            "DEFER_ANTIFARM_OR_WEAK_SIGNIFICANCE": 1,
            "SOURCE_BLOCKED": 12,
        })
        self.assertEqual(sum(len(r["tierPlan"])
                             for r in self.baseline["achievementFamilies"]), 148)
        for f in self.baseline["achievementFamilies"]:
            self.assertIsNone(f["cutoffValues"])
            self.assertTrue(all(t["threshold"] is None
                                for t in f["tierPlan"]))
        for code, row in dispositions.items():
            with self.subTest(achievement=code):
                original = families[code]
                self.assertEqual(row["canonicalId"], original["id"])
                self.assertEqual(row["originalFamilyName"], original["name"])
                self.assertEqual(row["baselineAvailability"], original["availability"])
                self.assertEqual(row["progression"], original["progression"])
                self.assertEqual(row["comparisonProfile"], original["comparisonProfile"])
                self.assertEqual(row["sourcePaths"], original["sourcePaths"])
                self.assertEqual(row["modelIds"], original["currentSourceModelRevisions"])
                if row["disposition"] in PROMOTION:
                    self.assertEqual(
                        row["baselineAvailability"], PROMOTION[row["disposition"]]
                    )
                if row["disposition"] in WAVES:
                    self.assertIsNotNone(row["provisionalPlan"])
                    for key in ("formula", "reject", "expert", "elite", "anti", "pacing"):
                        self.assertTrue(row["provisionalPlan"][key])
                    self.assertTrue(row["reason"])
                else:
                    self.assertIsNone(row["provisionalPlan"])

    def test_26_records_source_aligned_without_auto_publication(self) -> None:
        records = {r["id"].removeprefix("AR2_REC_"): r
                   for r in self.baseline["competitiveRecords"]}
        self.assertEqual(len(records), 26)
        rows = self.curated["recordDispositions"]
        self.assertEqual(set(rows), set(records))
        self.assertEqual(
            {kind: sum(r["disposition"] == kind for r in rows.values())
             for kind in {r["disposition"] for r in rows.values()}},
            {"RECORD_BOOK_ADMIT_IF_QUALIFIED": 14,
             "RECORD_BOOK_AFTER_DERIVATION": 9,
             "DEFER_COMPETITIVE_FAIRNESS": 2,
             "SOURCE_BLOCKED_LITERAL_CLAIM": 1},
        )
        for code, value in rows.items():
            with self.subTest(record=code):
                base = records[code]
                for key in ("name", "tab", "direction", "checkpoint"):
                    self.assertEqual(value[key], base[key])
                self.assertEqual(value["profile"], base["comparisonProfile"])
                self.assertEqual(value["sourcePaths"], base["sourcePaths"])
                self.assertEqual(value["unit"], base["unit"])
                self.assertEqual(value["baselineAvailability"], base["availability"])
        self.assertEqual(
            rows["MAP_EXPLORED_20"]["disposition"],
            "SOURCE_BLOCKED_LITERAL_CLAIM",
        )
        self.assertEqual(len(self.baseline["recordCohorts"]), 11)

    def test_exact_five_tabs_three_plaques_not_reselected(self) -> None:
        d = self.curated["highlightedRecordRule"]
        self.assertEqual(set(d["tabs"]), TABS)
        self.assertEqual(d["perTab"], 3)
        self.assertEqual(set(self.baseline["featuredRecordProvisionalCandidates"]), TABS)
        self.assertTrue(all(
            len(x) == 3 for x in
            self.baseline["featuredRecordProvisionalCandidates"].values()
        ))
        self.assertEqual(sum(map(len, self.baseline["featuredRecordProvisionalCandidates"].values())), 15)

    def test_rare_awards_are_explicitly_separate_and_blocked(self) -> None:
        d = self.curated
        self.assertEqual(len(d["trophyCandidates"]), 3)
        self.assertEqual(len(d["distinctionCandidates"]), 4)
        self.assertTrue(all(x["status"] == "SOURCE_BLOCKED"
                            for x in d["distinctionCandidates"]))
        self.assertEqual(len(d["epithetCandidates"]), 3)
        self.assertIn("ACTIVE ELITE", d["epithetCandidates"][2]["formula"])
        self.assertIn("private, owner-only", d["honourGates"]["privacy"])
        taxonomy = {x["type"] for x in d["honourTaxonomy"]}
        self.assertEqual(taxonomy,
            {"ACHIEVEMENT", "PUBLIC_RECORD", "PERSONAL_BEST", "TROPHY",
             "DISTINCTION", "EPITHET", "EVENT_OR_SEASON_HONOUR"})
        self.assertEqual(len(d["plannedPRs"]), 2)
        self.assertLessEqual(len(d["ownerQuestions"]), 5)


    def test_owner_five_selected_directions_are_binding_only_as_design(self) -> None:
        d = self.curated
        owner = d["ownerDecisions2026Oct28"]
        self.assertEqual(owner["selectedCodes"], ["1A", "2A", "3A", "4C", "5A"])
        self.assertFalse(owner["isLiveGrantAuthority"])
        self.assertEqual(owner["unapprovedNumericTierThresholds"], 148)
        self.assertTrue(owner["recordsUnchanged"])

        p = owner["selection1A"]
        self.assertEqual((p["familyCount"], p["measurementBacked"],
                          p["pureDerivation"], p["allOriginalFamiliesPreserved"]),
                         (15, 7, 8, 37))
        self.assertTrue(p["twoWaveDelivery"])

        club = owner["selection2A"]
        self.assertTrue(club["eliteClubRequiresDrushFlush"])
        self.assertFalse(club["newAchievementFamily"])
        self.assertFalse(club["sourceReady"])
        self.assertIn(
            "SAME admitted Game",
            d["familyDispositions"]["DRUSH"]["provisionalPlan"]["elite"],
        )

        trophies = owner["selection3A"]
        self.assertEqual(set(trophies["initialNamedTrophyIds"]), {
            "AR2_TROPHY_THORN_EMPEROR", "AR2_TROPHY_SWIFT_ASCENT"
        })
        self.assertEqual(trophies["reserveIds"],
                         ["AR2_TROPHY_ANNALS_REWRITTEN"])
        self.assertIsNone(trophies["swiftAscentPerformanceTimeThreshold"])
        self.assertIsNone(trophies["swiftAscentMaturityThreshold"])
        self.assertFalse(trophies["sourceReady"])
        self.assertEqual(
            {t["id"] for t in d["trophyCandidates"]
             if t["ownerSelection"] == "V1_PRIORITY_CONCEPT_SELECTED_NO_GRANT"},
            set(trophies["initialNamedTrophyIds"]),
        )

        merits = owner["selection4C"]
        self.assertEqual(set(merits["priorityDistinctionIds"]), {
            "AR2_DIST_UNBROKEN_LINE", "AR2_DIST_FELLOWSHIP"
        })
        self.assertEqual(set(merits["reservedIds"]), {
            "AR2_DIST_LAST_STANDARD", "AR2_DIST_LONE_VANGUARD"
        })
        self.assertTrue(merits["bothEffectProofBlocked"])
        self.assertTrue(all(m["status"] == "SOURCE_BLOCKED"
                            for m in d["distinctionCandidates"]))

        display = owner["selection5A"]
        self.assertEqual(len(display["epithetIds"]), 3)
        self.assertTrue(display["singleVoluntarilyEquippedEpithet"])
        self.assertEqual(display["nameplateMaxSelectedTrophies"], 1)
        self.assertEqual(display["nameplateMaxSelectedDistinctions"], 1)
        self.assertIn("owner-only", display["personalBestPrivacy"])
        self.assertFalse(display["unverifiedEmblemsShownAsEarned"])
        self.assertTrue(owner["rankNamesAccepted"])
        self.assertEqual(set(owner["tierMeanings"]),
                         {"INITIATE", "PRACTICED", "EXPERT", "ELITE"})
        self.assertEqual(len(d["ownerQuestions"]), 4)
        correction = d["ownerDecisions2026Oct29"]
        self.assertEqual(correction["retainedOwnerDirections"],
                         ["1A", "2A", "3A", "4C", "5A"])
        self.assertEqual(correction["internalTrophyId"],
                         "AR2_TROPHY_SWIFT_ASCENT")
        self.assertEqual(correction["rejectedPublicLabel"],
                         "The Swift Ascent")
        self.assertEqual(correction["publicName"], "NOT_APPROVED")
        self.assertFalse(correction["grantOrPublicationAuthorised"])
        self.assertTrue(all(v is None
                            for v in correction["thresholds"].values()))
        self.assertIn("STRICTLY_LOWER", correction["transferRule"])
        trophy = next(t for t in d["trophyCandidates"]
                      if t["id"] == correction["internalTrophyId"])
        self.assertEqual(trophy["firstTieWithoutIncumbent"],
                         "PENDING_OWNER_TIE_POLICY_NO_GRANT")
        self.assertEqual(trophy["name"], "UNAPPROVED_PLAYER_FACING_NAME")
        self.assertEqual(len(trophy["displayNameCandidates"]), 3)


if __name__ == "__main__":
    unittest.main()
