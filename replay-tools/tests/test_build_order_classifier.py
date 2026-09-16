import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_order_classifier import classify_build_orders


CATALOG = {
    "buildings": {
        "45": {"roleKeys": ["dock"]},
        "79": {"roleKeys": ["tower"]},
        "87": {"roleKeys": ["archery_range"]},
        "101": {"roleKeys": ["stable"]},
        "109": {"roleKeys": ["town_center"]},
    },
    "units": {
        "4": {"roleKeys": ["archer"]},
        "13": {"roleKeys": ["fishing_ship"]},
        "74": {"roleKeys": ["militia"]},
        "75": {"roleKeys": ["man_at_arms"]},
        "448": {"roleKeys": ["scout_cavalry"]},
        "539": {"roleKeys": ["water_military"]},
    },
    "technologies": {
        "222": {"name": "Man-at-Arms"},
    },
}

MANIFEST = {
    "participants": [
        {"playerId": 1, "lobbyTeamId": 1},
        {"playerId": 2, "lobbyTeamId": 2},
    ]
}

INITIAL_OBJECTS = [
    {"payload": {"ownerPlayerId": 1, "objectId": 109}, "position": {"x": 20, "y": 20}},
    {"payload": {"ownerPlayerId": 2, "objectId": 109}, "position": {"x": 80, "y": 80}},
]


def base_body():
    return {
        "researchEvents": [
            {"replaySlot": 1, "atMs": 10 * 60_000, "technologyId": 101},
        ],
        "productionEvents": [],
        "buildEvents": [],
    }


def classify(body):
    return classify_build_orders(
        manifest=MANIFEST,
        body=body,
        catalog=CATALOG,
        initial_objects=INITIAL_OBJECTS,
    )["1"]


class BuildOrderClassifierTests(unittest.TestCase):
    def test_fast_castle_before_14_minutes_scores_100_and_beats_boom(self):
        body = base_body()
        body["researchEvents"].append(
            {"replaySlot": 1, "atMs": 13 * 60_000 + 50_000, "technologyId": 102}
        )
        body["buildEvents"].extend([
            {"replaySlot": 1, "atMs": 15 * 60_000, "buildingId": 109, "x": 25, "y": 25},
            {"replaySlot": 1, "atMs": 15 * 60_000 + 50_000, "buildingId": 109, "x": 30, "y": 30},
        ])
        result = classify(body)
        self.assertEqual(result["label"], "Fast Castle")
        self.assertEqual(result["executionScore"], 100.0)
        self.assertTrue(any(candidate["label"] == "Boom" for candidate in result["candidates"]))

    def test_fast_castle_at_17_minutes_is_exactly_75_and_does_not_qualify(self):
        body = base_body()
        body["researchEvents"].append(
            {"replaySlot": 1, "atMs": 17 * 60_000, "technologyId": 102}
        )
        result = classify(body)
        self.assertEqual(result["label"], "N/A")
        fast_castle = next(candidate for candidate in result["candidates"] if candidate["label"] == "Fast Castle")
        self.assertEqual(fast_castle["executionScore"], 75.0)
        self.assertFalse(fast_castle["qualifies"])

    def test_fast_castle_after_18_minutes_can_never_qualify(self):
        body = base_body()
        body["researchEvents"].append(
            {"replaySlot": 1, "atMs": 18 * 60_000 + 1, "technologyId": 102}
        )
        result = classify(body)
        self.assertEqual(result["label"], "N/A")
        fast_castle = next(candidate for candidate in result["candidates"] if candidate["label"] == "Fast Castle")
        self.assertEqual(fast_castle["executionScore"], 0.0)

    def test_man_at_arms_opening_is_included_in_drush_bucket(self):
        body = base_body()
        body["productionEvents"].extend([
            {"replaySlot": 1, "atMs": 8 * 60_000 + 30_000, "unitId": 74, "requestedAmountPositive": 1},
            {"replaySlot": 1, "atMs": 9 * 60_000, "unitId": 75, "requestedAmountPositive": 1},
        ])
        result = classify(body)
        self.assertEqual(result["label"], "Drush")
        self.assertEqual(result["evidence"]["variant"], "Man-at-Arms")

    def test_forward_tower_qualifies_when_it_can_pressure_enemy_start(self):
        body = base_body()
        body["buildEvents"].append(
            {"replaySlot": 1, "atMs": 12 * 60_000, "buildingId": 79, "x": 72, "y": 80}
        )
        result = classify(body)
        self.assertEqual(result["label"], "Tower Rush")
        self.assertEqual(result["evidence"]["distanceToEnemyStartTiles"], 8.0)

    def test_defensive_tower_does_not_count_as_tower_rush(self):
        body = base_body()
        body["buildEvents"].append(
            {"replaySlot": 1, "atMs": 12 * 60_000, "buildingId": 79, "x": 30, "y": 30}
        )
        result = classify(body)
        self.assertEqual(result["label"], "N/A")

    def test_starting_scout_is_not_counted_toward_scout_rush(self):
        body = base_body()
        body["buildEvents"].append(
            {"replaySlot": 1, "atMs": 11 * 60_000, "buildingId": 101, "x": 25, "y": 25}
        )
        body["productionEvents"].append(
            {"replaySlot": 1, "atMs": 12 * 60_000, "unitId": 448, "requestedAmountPositive": 1}
        )
        self.assertEqual(classify(body)["label"], "N/A")

    def test_two_new_scouts_plus_early_stable_qualify_as_scout_rush(self):
        body = base_body()
        body["buildEvents"].append(
            {"replaySlot": 1, "atMs": 11 * 60_000, "buildingId": 101, "x": 25, "y": 25}
        )
        body["productionEvents"].extend([
            {"replaySlot": 1, "atMs": 12 * 60_000, "unitId": 448, "requestedAmountPositive": 1},
            {"replaySlot": 1, "atMs": 13 * 60_000, "unitId": 448, "requestedAmountPositive": 1},
        ])
        self.assertEqual(classify(body)["label"], "Scout Rush")


if __name__ == "__main__":
    unittest.main()
