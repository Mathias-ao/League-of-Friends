"""SOC-GRADE-01: verify owner-supplied v0.1 proposal transcription, not approval.

This suite MUST NOT run a producer, scorer, #141 semantic admission or #139
historical evaluator. It protects the verbatim owner review from policy drift.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha1
from pathlib import Path
import json
import re
import unittest

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
POLICY = ROOT / "contracts/social-v1/metric-grade-policy-proposal-v1.json"
CATALOGUE = ROOT / "contracts/social-v1/metric-grade-owner-review-v0.1.json"
SCHEMA = ROOT / "contracts/social-v1/metric-grade-owner-review-v0.1.schema.json"
VERBATIM = ROOT / "docs/architecture/grade-reputation-metrics-owner-review-v0.1.md"
TRACKS = ("GALLANTRY", "CRUELTY", "CHIVALRY", "RIVALRY", "HOSTILITY", "BOND")
GRADE_LABELS = ('"+"', '"++"', '"−"', '"−−"', '"0"', '"?"')


def fixture():
    catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    register = json.loads(POLICY.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    source = VERBATIM.read_text(encoding="utf-8")
    return catalogue, register, schema, source


def section(text, heading, end):
    start = text.index(heading) + len(heading)
    return text[start:text.index(end, start)].strip()


def parse_table(text, heading, end, width):
    lines = [x.strip() for x in section(text, heading, end).splitlines() if x.strip()]
    header = [v.strip() for v in lines.pop(0).split("|")]
    if len(header) != width:
        raise AssertionError("owner proposal header width unexpectedly changed")
    rows = [[v.strip() for v in line.split("|")] for line in lines]
    if any(len(v) != width for v in rows):
        raise AssertionError("owner proposal row width unexpectedly changed")
    return header, rows


class OwnerReviewProposalV01Tests(unittest.TestCase):
    def test_closed_schema_and_source_sha_prevent_approval_masquerade(self):
        catalogue, register, schema, source = fixture()
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema).validate(catalogue)
        raw = source.encode("utf-8")
        git_blob = sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
        self.assertEqual(catalogue["source"]["verbatimGitBlobSha"], git_blob)
        self.assertEqual(register["ownerMatrix"]["checksum"], git_blob)
        self.assertEqual(register["ownerMatrix"]["checksumMethod"], "GIT_BLOB_SHA1_UTF8")
        self.assertEqual(register["ownerMatrix"]["originalText"], source)
        self.assertEqual(catalogue["source"]["ownerConfirmedAsFinalPolicy"], False)
        self.assertEqual(register["ownerMatrix"]["ownerConfirmation"], None)
        self.assertEqual(register["approvalRef"], None)
        self.assertEqual(catalogue["approvalRef"], None)
        self.assertEqual(register["policyStatus"], "PROPOSED_UNAPPROVED")
        self.assertEqual(catalogue["policyStatus"], "PROPOSED_UNAPPROVED")
        for k in ("gradeBands", "thresholds", "eventCaps", "weights",
                  "sourceCoveragePromotionRules",
                  "gradeToInferenceSignificanceBandRules",
                  "ordinaryWeakeningRules", "metricTrackSelections"):
            self.assertEqual(register[k], [], k)
        self.assertTrue(register["proposalOnlyNoAdmissionOrActivation"])

    def test_full_exact_20_row_q_context_absent_and_weakening_mapping(self):
        catalogue, _, _, source = fixture()
        header, rows = parse_table(source,
            "3. Main metric-to-track table\n\n", "\n\nImportant:", 8)
        self.assertEqual(header, ["Source metric or episode family",
            "Gallantry", "Cruelty", "Chivalry", "Rivalry", "Hostility",
            "Bond", "Qualification context"])
        self.assertEqual(len(rows), 20)
        structured = catalogue["metricFamilies"]
        self.assertEqual(len(structured), len(rows))
        for index, (row, admitted) in enumerate(zip(rows, structured), 1):
            self.assertEqual(admitted["rowId"], f"OWNER_V0_1_M{index:02d}")
            self.assertEqual(admitted["sourceMetricOrEpisodeFamily"], row[0])
            self.assertEqual(admitted["qualificationContext"], row[-1])
            self.assertEqual([admitted["notation"][t] for t in TRACKS], row[1:7])
            self.assertTrue(set(row[1:7]) <= {"Q", "c", "·", "W"})
            self.assertIsNone(admitted["sourceMetricDefinitionId"])
            self.assertIsNone(admitted["sourceMethodVersion"])
            self.assertIsNone(admitted["methodSpecificCoverageApproval"])
            self.assertEqual(admitted["ownerSelectionStatus"], "PROPOSED_UNAPPROVED")
        self.assertEqual(sum(c == "Q" for row in rows for c in row[1:7]), 36)
        self.assertEqual(sum(c == "W" for row in rows for c in row[1:7]), 3)

    def test_track_definitions_and_notation_maintain_direction_and_source(self):
        catalogue, _, _, source = fixture()
        definitions = section(source, "1. Six-track definitions\n\n",
                              "The three Reputation dimensions are independent")
        expected = re.findall(r"^- (Gallantry|Cruelty|Chivalry|Rivalry|Hostility|Bond): (.+)$",
                              definitions, re.MULTILINE)
        self.assertEqual(len(expected), 6)
        for got, (label, meaning) in zip(catalogue["tracks"], expected):
            self.assertEqual(got["track"], label.upper())
            self.assertEqual(got["definition"], meaning)
            self.assertEqual(got["system"],
                             "REPUTATION" if label in ("Gallantry", "Cruelty", "Chivalry")
                             else "RELATIONSHIP")
        lines = section(source, "2. Matrix notation\n\n",
                        "A row containing Q does not mean")
        for code, meaning in re.findall(r"^- ([Qc·W]): (.+)$", lines, re.MULTILINE):
            self.assertEqual(catalogue["notation"][code], meaning)
        self.assertEqual(set(catalogue["notation"]), {"Q", "c", "·", "W"})

    def test_nondirect_metric_and_future_candidates_are_verbatim(self):
        catalogue, _, _, source = fixture()
        _, exclusions = parse_table(source,
            "4. Statistics that normally do not create social progression\n\n"
            "These metrics remain valuable for Personality, Records, Achievements, "
            "Chronicles and contextual interpretation.\n\n",
            "\n\n5. Additional metric families", 3)
        self.assertEqual(len(exclusions), 12)
        self.assertEqual([[r["existingAofStatistic"], r["interpretationRole"],
                           r["directSixTrackAward"]] for r in catalogue["excludedStatistics"]],
                         exclusions)
        self.assertTrue(all(r[-1] == "No" for r in exclusions))
        _, future = parse_table(source,
            "5. Additional metric families proposed for development\n\n",
            "\n\nThese candidates do not constitute", 4)
        self.assertEqual(len(future), 15)
        self.assertEqual([[r["candidate"], r["reuseAofEvidence"],
                           r["potentialSocialUse"], r["priorityAndLimitations"]]
                          for r in catalogue["developmentCandidates"]], future)
        self.assertTrue(all(r["approvalStatus"] == "PROPOSED_NOT_AUTHORIZED"
                            for r in catalogue["developmentCandidates"]))

    def test_weakening_is_separately_positive_and_ordinal_grades_not_weights(self):
        catalogue, register, _, source = fixture()
        _, weakening = parse_table(source,
            "6. Independently qualified weakening rules\n\n"
            "Weakening is not a negative score assigned for poor statistical performance. "
            "Each effect requires its own positively established conduct.\n\n",
            "\n\nAOF Reputation may strengthen", 3)
        self.assertEqual(len(weakening), 6)
        self.assertEqual([[r["trackToWeaken"], r["proposedQualifyingAction"],
                           r["falsePositiveGuardAndLikelyV1Status"]]
                          for r in catalogue["independentWeakening"]], weakening)
        self.assertEqual([x["trackToWeaken"].split()[0].upper() for x in
                          catalogue["independentWeakening"]], list(TRACKS))
        _, grades = parse_table(source,
            "7. Grading after qualification\n\n"
            "The proposed grading uses ordinal meanings, not predetermined numerical points.\n\n",
            "\n\nA single episode can affect", 2)
        self.assertEqual([[r["label"], r["meaning"]] for r in catalogue["ordinalGrades"]],
                         grades)
        self.assertEqual(tuple(r["label"] for r in catalogue["ordinalGrades"]),
                         GRADE_LABELS)
        self.assertTrue(all(r["numericValue"] is None and r["significanceBandId"] is None
                            for r in catalogue["ordinalGrades"]))
        self.assertEqual(register["gradeBands"], [])
        self.assertEqual(register["ordinaryWeakeningRules"], [])
        self.assertEqual(register["gradeToInferenceSignificanceBandRules"], [])

    def test_important_adversarial_semantic_guards_remain_exact(self):
        catalogue, _, _, source = fixture()
        m = {r["sourceMetricOrEpisodeFamily"]: r for r in catalogue["metricFamilies"]}
        def symbol(name, track):
            return m[name]["notation"][track]
        self.assertEqual(symbol("Detected Raids Initiated / directed economic pressure", "HOSTILITY"), "c")
        self.assertEqual(symbol("Repeated, unusually selective targeted harassment", "HOSTILITY"), "Q")
        self.assertEqual(symbol("Cooperative Attacks against exact common enemy", "BOND"), "c")
        self.assertEqual(symbol("Defensive Assists (specific helper→recipient)", "BOND"), "Q")
        self.assertEqual(symbol("Tribute request donor→recipient", "BOND"), "c")
        self.assertEqual(symbol("Material aid to former adversary with reconciliation context", "HOSTILITY"), "W")
        self.assertEqual(symbol("Serious directed antagonism against established cooperator", "BOND"), "W")
        self.assertEqual(symbol("Castle placement near opponent home", "GALLANTRY"), "c")
        self.assertEqual(symbol("Castle placement near opponent home", "RIVALRY"), "Q")
        self.assertIn("The Season aggregate must not be used as the qualification source", source)
        self.assertIn("A→B only; do not mirror B→A", source)
        self.assertIn("Strict Treachery:", source)
        self.assertIn("an unrounded distance strictly below 15 tiles", source)
        self.assertIn("No numerical weights, automatic receipts, public scoring", source)
        self.assertEqual(len(catalogue["unresolvedOwnerDecisions"]), 5)

    def test_schema_rejects_promoted_codes_bands_and_final_confirmation(self):
        catalogue, _, schema, _ = fixture()
        validator = Draft202012Validator(schema)
        for mutation in ("final", "numeric", "method", "extra-row", "relabel", "awarded"):
            altered = deepcopy(catalogue)
            if mutation == "final":
                altered["policyStatus"] = "APPROVED"
            elif mutation == "numeric":
                altered["ordinalGrades"][0]["numericValue"] = 2
            elif mutation == "method":
                altered["metricFamilies"][0]["methodSpecificCoverageApproval"] = "GENERIC_LIMITED"
            elif mutation == "extra-row":
                altered["metricFamilies"].append(deepcopy(altered["metricFamilies"][0]))
            elif mutation == "relabel":
                altered["metricFamilies"][0]["notation"]["HOSTILITY"] = "AWARD"
            elif mutation == "awarded":
                altered["trackCredits"] = [1]
            self.assertTrue(list(validator.iter_errors(altered)), mutation)


if __name__ == "__main__":
    unittest.main()
