import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from opening_statistics import OPENING_STATISTICS_VERSION, project_opening_statistics


CATALOG = {
    "buildings": {
        "12": {"name": "Barracks", "roleKeys": ["barracks", "military_production"]},
        "45": {"name": "Dock", "roleKeys": ["dock", "naval_economy", "naval_production"]},
        "87": {"name": "Archery Range", "roleKeys": ["archery_range", "military_production"]},
    },
    "units": {},
    "technologies": {
        "22": {"name": "Loom", "roleKeys": ["loom", "eco_tech"]},
        "101": {"name": "Feudal Age", "roleKeys": ["feudal_age"]},
        "102": {"name": "Castle Age", "roleKeys": ["castle_age"]},
        "103": {"name": "Imperial Age", "roleKeys": ["imperial_age"]},
    },
}

MANIFEST = {
    "participants": [{"playerId": 1, "civilization": {"rawId": 1}}],
    "match": {"settings": {"population": 200}},
}


def project(build_events):
    return project_opening_statistics(
        manifest=MANIFEST,
        body={
            "researchEvents": [],
            "productionEvents": [],
            "buildEvents": build_events,
            "wallEvents": [],
        },
        catalog=CATALOG,
        observed_until_ms=20 * 60_000,
        initial_objects=[],
    )["1"]


class FirstMilitaryBuildingSemanticsTests(unittest.TestCase):
    def test_dock_is_not_first_military_building(self):
        result = project([
            {"replaySlot": 1, "atMs": 120_000, "buildingId": 45, "x": 10, "y": 10, "sourceEventId": "dock"},
            {"replaySlot": 1, "atMs": 180_000, "buildingId": 12, "x": 12, "y": 10, "sourceEventId": "barracks"},
            {"replaySlot": 1, "atMs": 240_000, "buildingId": 87, "x": 14, "y": 10, "sourceEventId": "range"},
        ])

        self.assertEqual(OPENING_STATISTICS_VERSION, "AOF_OPENING_STATISTICS_V6")
        self.assertEqual(result["firstMilitaryBuilding"]["building"]["name"], "Barracks")
        self.assertEqual(result["firstMilitaryBuilding"]["atMs"], 180_000)

    def test_only_dock_leaves_first_military_building_unset(self):
        result = project([
            {"replaySlot": 1, "atMs": 120_000, "buildingId": 45, "x": 10, "y": 10, "sourceEventId": "dock"},
        ])

        self.assertIsNone(result["firstMilitaryBuilding"])


if __name__ == "__main__":
    unittest.main()
