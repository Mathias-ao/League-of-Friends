"""Producer-shared statistics: exact schema-validated semantics and lossless output."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from analysis_dataset import build_analysis_dataset
from fixture_support import export_fixture
from statistics_direct_shared import (
    VERSION, restore_full_statistics, to_direct_shared_statistics, measure_direct_shape,
)
from statistics_projector import project_statistics_from_analysis


class DirectSharedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        _, cls.bundle, _ = export_fixture(Path(cls.temp.name))
        cls.analysis = build_analysis_dataset(cls.bundle)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_controlled_replay_matches_every_full_statistic(self):
        original = project_statistics_from_analysis(self.analysis)
        direct = project_statistics_from_analysis(self.analysis, direct_shared=True)
        self.assertEqual(direct["sharedEpisodeDelivery"]["version"], VERSION)
        self.assertEqual(direct["pairSocialEvidence"], original["pairSocialEvidence"])
        self.assertEqual(direct["matchFacts"], original["matchFacts"])
        self.assertEqual(
            [p["military"]["engagements"]["skirmishes"] for p in direct["participants"]],
            [p["military"]["engagements"]["skirmishes"] for p in original["participants"]],
        )
        self.assertTrue(all("engagementEvidence" not in p["military"]["engagements"]
                            for p in direct["participants"]))
        # Verify JSON round trip as well as in-memory dict identity.
        on_disk_equivalent = json.loads(json.dumps(direct, sort_keys=True))
        self.assertEqual(restore_full_statistics(on_disk_equivalent), original)

    def test_interns_related_battle_and_skirmish_evidence_without_losing_player_facts(self):
        huge = [f"op-{i:07}" for i in range(300)]
        skirmish = {"skirmishId": "s1", "sourceEventIds": huge,
                    "participantPlayerIds": [1, 2],
                    "directedInteractionEdges": [{"fromPlayerId": 1,
                                                  "toPlayerId": 2, "sourceEventIds": huge}]}
        battle = {"battleId": "b1", "sourceEventIds": huge,
                  "participantPlayerIds": [1, 2],
                  "directedInteractionEdges": [{"fromPlayerId": 1,
                                                "toPlayerId": 2, "sourceEventIds": huge}]}
        producer = {
            "skirmishes": [skirmish], "battles": [battle],
            "reinforcements": [], "defensiveAssists": [], "cooperativeAttacks": [],
        }
        src = {
            "participants": [
                {"playerId": p, "replaySlot": p, "military": {"engagements": {
                    "skirmishes": 1, "battlesFought": 1,
                    "engagementEvidence": {
                        "skirmishes": [skirmish], "battles": [battle],
                        "greatBattles": [battle], "defensiveAssistsGiven": [],
                    },
                }}} for p in (1, 2)
            ],
            "pairSocialEvidence": {"observations": [{"sourceEventId": "op-0000001"}]},
            "matchFacts": {"durationMs": 100},
        }
        original = deepcopy(src)
        direct = to_direct_shared_statistics(src, producer)
        self.assertEqual(restore_full_statistics(direct), original)
        sizes = measure_direct_shape(direct)
        self.assertEqual(sizes["uniqueEpisodes"], 2)
        self.assertEqual(sizes["playerReferences"], 6)
        self.assertLess(sizes["sharedEvidenceFields"], 4)
        self.assertEqual(original["participants"][0]["military"]["engagements"]["engagementEvidence"]["battles"][0], battle)

    def test_fails_closed_on_missing_shared_evidence_and_player_rebinding(self):
        huge = [f"op-{i:06}" for i in range(200)]
        episode = {"skirmishId": "s1", "sourceEventIds": huge}
        producer = {"skirmishes": [episode], "battles": [],
                    "reinforcements": [], "defensiveAssists": [], "cooperativeAttacks": []}
        source = {"participants": [{"playerId": 1, "replaySlot": 1,
                  "military": {"engagements": {"engagementEvidence": {
                      "skirmishes": [episode]}}}}]}
        direct = to_direct_shared_statistics(source, producer)
        bad = deepcopy(direct)
        bad["sharedEpisodeDelivery"]["sharedEvidence"].clear()
        with self.assertRaises(ValueError):
            restore_full_statistics(bad)
        bad = deepcopy(direct)
        bad["sharedEpisodeDelivery"]["playerRefs"][0]["playerId"] = 2
        with self.assertRaises(ValueError):
            restore_full_statistics(bad)


if __name__ == "__main__":
    unittest.main()
