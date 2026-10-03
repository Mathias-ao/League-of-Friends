import copy
import unittest

from map_presence_v8 import project_map_presence, relic_targeting, MAP_PRESENCE_MODEL_VERSION
from test_map_presence_v4 import CATALOG, participant, initial, action


class RelicTargetingV1Tests(unittest.TestCase):
    def setUp(self):
        self.objects = [initial("relic", 0, 285, 301, 50, 50)]
        self.actions = [
            {**action("p1", 1, 10000, "ORDER", 50, 50, target=301), "operationOrdinal": 10},
            {**action("p2", 2, 10000, "SPECIAL", 50, 50, target=301), "operationOrdinal": 11},
        ]

    def test_successive_targets_do_not_prove_theft_or_transfer(self):
        result = relic_targeting(self.actions, self.objects, {1, 2})
        for player in ("1", "2"):
            row = result[player]
            self.assertEqual(row["uniqueRelicsTouched"], 1)
            self.assertEqual(row["totalRelicCommands"], 1)
            for key in ("inferredRelicsHeldAtEnd", "relicsStolenFromEnemies", "relicsLostToEnemies", "allyTransfersReceived"):
                self.assertIsNone(row[key])
            self.assertEqual(row["transferEvidence"], [])
            self.assertEqual(row["outcomeCoverage"]["status"], "UNAVAILABLE")
            self.assertEqual(row["interactionEvidence"][0]["claim"], "RELIC_TARGETING_COMMAND")
        self.assertEqual(result["2"]["interactionEvidence"][0]["operationOrdinal"], 11)

    def test_duplicate_reordered_commands_are_deterministic(self):
        expected = relic_targeting(self.actions, self.objects, {1, 2})
        self.assertEqual(expected, relic_targeting(list(reversed(self.actions + copy.deepcopy(self.actions))), self.objects, {1, 2}))

    def test_unknown_relic_and_conflicting_event_id(self):
        self.assertEqual(relic_targeting([{**self.actions[0], "targetInstanceId": 999}], self.objects, {1})["1"]["totalRelicCommands"], 0)
        with self.assertRaisesRegex(ValueError, "Conflicting relic evidence"):
            relic_targeting([self.actions[0], {**self.actions[0], "actorPlayerId": 2}], self.objects, {1, 2})

    def test_active_model_replaces_legacy_holder_proxy_and_preserves_geometry(self):
        game = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        objects = self.objects + [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 10),
        ]
        result = project_map_presence(
            manifest=game, catalog=CATALOG, initial_objects=objects,
            build_events=[], wall_events=[], action_events=self.actions,
        )
        self.assertEqual(result["1"]["modelVersion"], MAP_PRESENCE_MODEL_VERSION)
        self.assertIsNone(result["1"]["relicControl"]["inferredRelicsHeldAtEnd"])
        self.assertEqual(result["1"]["relicControl"]["uniqueRelicsTouched"], 1)

    def test_no_relic_commands_still_does_not_prove_no_possession(self):
        row = relic_targeting([], self.objects, {1})["1"]
        self.assertEqual(row["totalRelicCommands"], 0)
        self.assertIsNone(row["inferredRelicsHeldAtEnd"])


if __name__ == "__main__":
    unittest.main()
