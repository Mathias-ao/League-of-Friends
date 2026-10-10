import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from statistics_delivery_views import battle_measurements, neutral_social_inputs


def sample():
    return {
        "statisticsDelivery": {"version": "AOF_STATISTICS_SHARED_EVIDENCE_V1_EXPERIMENTAL"},
        "statisticsSchemaVersion": "1.2.0",
        "source": {"replaySha256": "f" * 64},
        "scope": {"observedUntilMs": 8000},
        "coverage": {},
        "participants": [{
            "playerId": 1, "replaySlot": 1, "displayName": "alpha",
            "buildOrder": {"label": "Fast Castle"},
            "economy": {"resourceCommitment": {"total": 200}},
            "military": {"engagements": {"skirmishes": 2}},
            "mapPresence": {"commandCoveragePercent": 42},
            "execution": {"apm": 99},
        }],
        "pairSocialEvidence": {"observations": [
            {"sourceEventId": "op-3", "actorPlayerId": 1},
        ]},
        "matchFacts": {"players": [{"playerId": 1}]},
        "commandEvidence": {"queue": list(range(200))},
        "recorderCamera": {"pointCount": 100},
    }


class ViewTests(unittest.TestCase):
    def test_battle_measurements_preserve_five_categories(self):
        source = sample()
        view = battle_measurements(source)
        self.assertEqual(view["participants"], source["participants"])
        self.assertEqual(view["scope"], source["scope"])
        for key in ("pairSocialEvidence", "matchFacts", "commandEvidence", "recorderCamera"):
            self.assertNotIn(key, view)

    def test_social_inputs_keep_neutral_qualified_evidence(self):
        source = sample()
        view = neutral_social_inputs(source)
        self.assertEqual(view["source"], source["source"])
        self.assertEqual(view["matchFacts"], source["matchFacts"])
        self.assertEqual(view["pairSocialEvidence"], source["pairSocialEvidence"])
        self.assertEqual(view["participants"], [
            {"playerId": 1, "replaySlot": 1, "displayName": "alpha"},
        ])
        self.assertNotIn("commandEvidence", view)
        self.assertNotIn("officialOutcome", view)

    def test_missing_qualified_input_is_error_not_zero(self):
        with self.assertRaises(ValueError):
            neutral_social_inputs({"participants": []})
        source = sample()
        source.pop("pairSocialEvidence")
        with self.assertRaises(ValueError):
            neutral_social_inputs(source)


if __name__ == "__main__":
    unittest.main()
