import copy
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from analysis_dataset import build_analysis_dataset, validate_analysis_dataset
from canonical_io import ConformanceError
from fixture_support import export_fixture
from match_facts import compact_header, project_match_facts
from statistics_projector import project_statistics_from_analysis


class RecordingMatchFactsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.source, cls.bundle, _ = export_fixture(Path(cls.temp.name))
        cls.analysis = build_analysis_dataset(cls.bundle, validate=False)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_map_rules_players_and_diplomacy_survive_without_replay(self):
        self.source.rename(self.source.with_suffix(".hidden"))
        try:
            facts = project_match_facts(self.analysis)
        finally:
            self.source.with_suffix(".hidden").rename(self.source)
        self.assertEqual(facts["map"]["width"], 2)
        self.assertEqual(facts["map"]["height"], 3)
        self.assertIs(facts["rules"]["lockTeams"]["value"], False)
        self.assertEqual(facts["headerFieldCandidates"]["de.build"], 180059)
        self.assertEqual(facts["players"][0]["playerId"], 1)
        self.assertTrue(facts["diplomacy"]["commandTimelines"])
        self.assertEqual(facts["headerSource"]["sha256"], self.analysis["recordingHeaderSource"]["sha256"])

    def test_zero_and_false_header_values_are_not_missing(self):
        header = {"de": {"rated": False, "starting_age_id": 0, "lock_teams": False},
                  "map": {"dimension": 120, "restore_time": 0, "all_visible": False}}
        compact = compact_header(header)
        self.assertIs(compact["de"]["rated"], False)
        self.assertEqual(compact["de"]["starting_age_id"], 0)
        self.assertEqual(compact["map"]["restore_time"], 0)

    def test_conflicting_header_domains_are_both_retained(self):
        analysis = copy.deepcopy(self.analysis)
        analysis["recordingHeader"]["de"]["lock_teams"] = True
        analysis["recordingHeader"]["lobby"]["lock_teams"] = False
        facts = project_match_facts(analysis)
        self.assertIs(facts["headerFieldCandidates"]["de.lock_teams"], True)
        self.assertIs(facts["headerFieldCandidates"]["lobby.lock_teams"], False)
        self.assertIs(facts["rules"]["lockTeams"]["value"], False)

    def test_raw_no_team_group_is_not_an_effective_alliance(self):
        analysis = copy.deepcopy(self.analysis)
        for row in analysis["manifest"]["participants"]:
            row["lobbyTeamId"] = 1
        facts = project_match_facts(analysis)
        self.assertEqual(facts["lobbyGroups"][0]["memberPlayerIds"], [1, 2])
        self.assertFalse(facts["lobbyGroups"][0]["effectiveAllianceEstablished"])

    def test_resignation_and_leaderboard_never_invent_winners_or_losers(self):
        analysis = copy.deepcopy(self.analysis)
        analysis["body"]["resignations"] = [{"replaySlot": 1, "atMs": 500, "sourceEventId": "resign"}]
        analysis["postgameEvents"] = [{"sourceEventId": "post", "timestampMs": 1000,
                                      "operationOrdinal": 10, "decoded": {"leaderboards": []}}]
        analysis["manifest"]["match"]["winnerPlayerIds"] = [2]
        result = project_match_facts(analysis)["result"]
        self.assertEqual(result["qualification"], "UNRESOLVED")
        self.assertIsNone(result["winnerPlayerIds"])
        self.assertIsNone(result["loserPlayerIds"])
        self.assertEqual(result["canonicalWinnerClaims"], [2])
        self.assertEqual(result["postgameEvidence"][0]["sourceEventId"], "post")

    def test_postgame_requires_chronology(self):
        analysis = copy.deepcopy(self.analysis)
        analysis["postgameEvents"] = [{"sourceEventId": "post"}]
        with self.assertRaisesRegex(ValueError, "source chronology"):
            project_match_facts(analysis)

    def test_inputs_and_rebuilds_are_unchanged(self):
        before = copy.deepcopy(self.analysis)
        facts = project_match_facts(self.analysis)
        self.assertEqual(facts, project_match_facts(copy.deepcopy(self.analysis)))
        self.assertEqual(self.analysis, before)

    def test_legacy_cache_reports_missing_header_instead_of_inventing_it(self):
        analysis = copy.deepcopy(self.analysis)
        analysis["datasetVersion"] = "AOF_REPLAY_ANALYSIS_V3"
        analysis.pop("recordingHeader")
        analysis.pop("recordingHeaderSource")
        analysis.pop("postgameEvents")
        validate_analysis_dataset(analysis)
        facts = project_match_facts(analysis)
        self.assertEqual(facts["coverage"]["headerCandidates"], "UNAVAILABLE")
        self.assertEqual(facts["headerFieldCandidates"], {})

    def test_decoded_header_artifact_integrity_is_checked_even_with_fast_seal(self):
        path = self.bundle / self.analysis["recordingHeaderSource"]["uri"]
        original = path.read_bytes()
        try:
            path.write_bytes(original + b"tampered")
            with self.assertRaises(ConformanceError):
                build_analysis_dataset(self.bundle, validate=False)
        finally:
            path.write_bytes(original)

    def test_metadata_addition_preserves_entire_statistics_and_social_envelope(self):
        placeholder = project_match_facts(self.analysis)
        placeholder["game"] = {}
        with patch("statistics_projector.project_match_facts", return_value=placeholder):
            baseline = project_statistics_from_analysis(self.analysis)
        actual = project_statistics_from_analysis(self.analysis)
        facts = actual.pop("matchFacts")
        baseline.pop("matchFacts")
        self.assertEqual(actual, baseline)
        self.assertEqual(facts["modelVersion"], "AOF_RECORDING_MATCH_FACTS_V1")


if __name__ == "__main__":
    unittest.main()
