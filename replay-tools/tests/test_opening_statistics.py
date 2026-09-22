import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from opening_statistics import OPENING_STATISTICS_VERSION, project_opening_statistics


CATALOG = {
    "buildings": {
        "12": {"name": "Barracks", "roleKeys": ["barracks", "military_production"]},
        "45": {"name": "Dock", "roleKeys": ["dock", "naval_economy", "naval_production"]},
        "70": {"name": "House", "roleKeys": ["house"]},
        "72": {"name": "Palisade Wall", "roleKeys": ["wall", "fortification"]},
        "87": {"name": "Archery Range", "roleKeys": ["archery_range", "military_production"]},
    },
    "units": {
        "4": {"name": "Archer", "roleKeys": ["archer", "land_military", "ranged"]},
        "83": {"name": "Villager", "roleKeys": ["villager", "economic_unit"]},
        "13": {"name": "Fishing Ship", "roleKeys": ["fishing_ship", "economic_unit", "water_unit"]},
        "74": {"name": "Militia", "roleKeys": ["militia", "land_military"]},
        "539": {"name": "Galley", "roleKeys": ["galley", "water_military", "ranged"]},
    },
    "technologies": {
        "22": {"name": "Loom", "roleKeys": ["loom", "eco_tech"]},
        "101": {"name": "Feudal Age", "roleKeys": ["feudal_age"]},
        "102": {"name": "Castle Age", "roleKeys": ["castle_age"]},
        "103": {"name": "Imperial Age", "roleKeys": ["imperial_age"]},
    },
}

MANIFEST = {"participants": [{"playerId": 1}]}


def project(body, observed_until_ms=40 * 60_000, initial_objects=None):
    complete = {
        "researchEvents": [],
        "productionEvents": [],
        "buildEvents": [],
        "wallEvents": [],
        **body,
    }
    return project_opening_statistics(
        manifest=MANIFEST,
        body=complete,
        catalog=CATALOG,
        observed_until_ms=observed_until_ms,
        initial_objects=initial_objects or [],
    )["1"]


class OpeningStatisticsTests(unittest.TestCase):
    def test_age_up_uses_requested_fixed_durations(self):
        result = project({"researchEvents": [
            {"replaySlot": 1, "atMs": 8 * 60_000, "technologyId": 101},
            {"replaySlot": 1, "atMs": 16 * 60_000, "technologyId": 102},
            {"replaySlot": 1, "atMs": 28 * 60_000, "technologyId": 103},
        ]})
        self.assertEqual(result["modelVersion"], OPENING_STATISTICS_VERSION)
        self.assertEqual(result["ageUp"]["feudal"]["ageUpAtMs"], 8 * 60_000 + 130_000)
        self.assertEqual(result["ageUp"]["castle"]["ageUpAtMs"], 16 * 60_000 + 160_000)
        self.assertEqual(result["ageUp"]["imperial"]["ageUpAtMs"], 28 * 60_000 + 190_000)

    def test_age_up_uses_latest_observed_click_for_each_age(self):
        result = project({"researchEvents": [
            {"replaySlot": 1, "atMs": 7 * 60_000, "technologyId": 101},
            {"replaySlot": 1, "atMs": 8 * 60_000, "technologyId": 101},
            {"replaySlot": 1, "atMs": 15 * 60_000, "technologyId": 102},
            {"replaySlot": 1, "atMs": 16 * 60_000, "technologyId": 102},
            {"replaySlot": 1, "atMs": 27 * 60_000, "technologyId": 103},
            {"replaySlot": 1, "atMs": 28 * 60_000, "technologyId": 103},
        ]})
        self.assertEqual(result["ageUp"]["feudal"]["clickAtMs"], 8 * 60_000)
        self.assertEqual(result["ageUp"]["feudal"]["ageUpAtMs"], 8 * 60_000 + 130_000)
        self.assertEqual(result["ageUp"]["castle"]["clickAtMs"], 16 * 60_000)
        self.assertEqual(result["ageUp"]["castle"]["ageUpAtMs"], 16 * 60_000 + 160_000)
        self.assertEqual(result["ageUp"]["imperial"]["clickAtMs"], 28 * 60_000)
        self.assertEqual(result["ageUp"]["imperial"]["ageUpAtMs"], 28 * 60_000 + 190_000)
        self.assertEqual(result["ageUp"]["feudal"]["layer"], "inferred")

    def test_villagers_before_feudal_age_uses_starting_villagers_and_net_queue_before_latest_click(self):
        initial_objects = [
            {"payload": {"ownerPlayerId": 1, "objectId": 83}},
            {"payload": {"ownerPlayerId": 1, "objectId": 83}},
            {"payload": {"ownerPlayerId": 1, "objectId": 83}},
            {"payload": {"ownerPlayerId": 2, "objectId": 83}},
        ]
        result = project({
            "researchEvents": [
                {"replaySlot": 1, "atMs": 6 * 60_000, "technologyId": 101},
                {"replaySlot": 1, "atMs": 7 * 60_000, "technologyId": 101},
            ],
            "productionEvents": [
                {"replaySlot": 1, "atMs": 60_000, "unitId": 83, "signedAmount": 5, "requestedAmountPositive": 5},
                {"replaySlot": 1, "atMs": 2 * 60_000, "unitId": 83, "signedAmount": -1, "requestedAmountPositive": 0},
                {"replaySlot": 1, "atMs": 6 * 60_000 + 30_000, "unitId": 83, "signedAmount": 2, "requestedAmountPositive": 2},
                {"replaySlot": 1, "atMs": 7 * 60_000 + 1, "unitId": 83, "signedAmount": 4, "requestedAmountPositive": 4},
                {"replaySlot": 1, "atMs": 3 * 60_000, "unitId": 4, "signedAmount": 2, "requestedAmountPositive": 2},
            ],
        }, initial_objects=initial_objects)
        villagers = result["villagersBeforeFeudalAge"]
        self.assertEqual(villagers["count"], 9)
        self.assertEqual(villagers["startingVillagersObserved"], 3)
        self.assertEqual(villagers["netDecodedVillagerQueueAmount"], 6)
        self.assertEqual(villagers["boundary"], "latest_feudal_click")

    def test_villagers_before_feudal_age_is_unavailable_when_villager_queue_amount_is_unknown(self):
        result = project({
            "researchEvents": [{"replaySlot": 1, "atMs": 5 * 60_000, "technologyId": 101}],
            "productionEvents": [
                {"replaySlot": 1, "atMs": 60_000, "unitId": 83, "signedAmount": None, "requestedAmountPositive": None},
            ],
        }, initial_objects=[{"payload": {"ownerPlayerId": 1, "objectId": 83}}])
        self.assertIsNone(result["villagersBeforeFeudalAge"]["count"])
        self.assertEqual(result["villagersBeforeFeudalAge"]["unknownAmountVillagerQueueCommands"], 1)

    def test_first_military_unit_ignores_economic_queue_and_first_military_building_is_earliest(self):
        result = project({
            "productionEvents": [
                {"replaySlot": 1, "atMs": 1000, "unitId": 13, "requestedAmountPositive": 1, "sourceEventId": "fish"},
                {"replaySlot": 1, "atMs": 2000, "unitId": 74, "requestedAmountPositive": 1, "sourceEventId": "militia"},
                {"replaySlot": 1, "atMs": 3000, "unitId": 4, "requestedAmountPositive": 1, "sourceEventId": "archer"},
            ],
            "buildEvents": [
                {"replaySlot": 1, "atMs": 1500, "buildingId": 12, "x": 10, "y": 10, "sourceEventId": "rax"},
                {"replaySlot": 1, "atMs": 2500, "buildingId": 87, "x": 12, "y": 10, "sourceEventId": "range"},
            ],
        })
        self.assertEqual(result["firstMilitaryUnitQueued"]["unit"]["name"], "Militia")
        self.assertEqual(result["firstMilitaryUnitQueued"]["atMs"], 2000)
        self.assertEqual(result["firstMilitaryBuilding"]["building"]["name"], "Barracks")
        self.assertEqual(result["firstMilitaryBuilding"]["atMs"], 1500)

    def test_wall_tiles_are_unique_and_use_feudal_age_up_boundary(self):
        result = project({
            "researchEvents": [{"replaySlot": 1, "atMs": 5 * 60_000, "technologyId": 101}],
            "wallEvents": [
                {"replaySlot": 1, "atMs": 6 * 60_000, "buildingId": 72, "x": 1, "y": 1, "xEnd": 5, "yEnd": 1, "sourceEventId": "w1"},
                {"replaySlot": 1, "atMs": 6 * 60_000 + 10_000, "buildingId": 72, "x": 5, "y": 1, "xEnd": 7, "yEnd": 1, "sourceEventId": "w2"},
                {"replaySlot": 1, "atMs": 8 * 60_000, "buildingId": 72, "x": 20, "y": 20, "xEnd": 25, "yEnd": 20, "sourceEventId": "late"},
            ],
        })
        self.assertEqual(result["firstWallSegment"]["atMs"], 6 * 60_000)
        self.assertEqual(result["firstWallSegment"]["tileCount"], 5)
        self.assertEqual(result["wallTilesBeforeFeudal"]["count"], 7)

    def test_wall_style_open_partial_and_full_are_based_on_pre_castle_unique_tiles(self):
        self.assertEqual(project({})["wallStyle"]["label"], "open")
        partial = project({"wallEvents": [
            {"replaySlot": 1, "atMs": 1000, "buildingId": 72, "x": 0, "y": 0, "xEnd": 9, "yEnd": 0},
        ]})
        self.assertEqual(partial["wallStyle"]["label"], "partially_walled")
        self.assertEqual(partial["wallStyle"]["wallTilesBeforeCastle"], 10)
        full = project({"wallEvents": [
            {"replaySlot": 1, "atMs": 1000, "buildingId": 72, "x": 0, "y": 0, "xEnd": 19, "yEnd": 0},
        ]})
        self.assertEqual(full["wallStyle"]["label"], "fully_walled")
        self.assertEqual(full["wallStyle"]["wallTilesBeforeCastle"], 20)

    def test_houses_before_feudal_uses_projected_age_up_not_click_time(self):
        result = project({
            "researchEvents": [{"replaySlot": 1, "atMs": 5 * 60_000, "technologyId": 101}],
            "buildEvents": [
                {"replaySlot": 1, "atMs": 4 * 60_000, "buildingId": 70},
                {"replaySlot": 1, "atMs": 6 * 60_000, "buildingId": 70},
                {"replaySlot": 1, "atMs": 8 * 60_000, "buildingId": 70},
            ],
        })
        self.assertEqual(result["housesBeforeFeudal"]["count"], 2)

    def test_loom_timing_and_loom_before_feudal_click(self):
        before = project({"researchEvents": [
            {"replaySlot": 1, "atMs": 4 * 60_000, "technologyId": 22},
            {"replaySlot": 1, "atMs": 5 * 60_000, "technologyId": 101},
        ]})
        self.assertEqual(before["loomTiming"]["atMs"], 4 * 60_000)
        self.assertTrue(before["loomBeforeFeudal"]["value"])
        after = project({"researchEvents": [
            {"replaySlot": 1, "atMs": 5 * 60_000, "technologyId": 101},
            {"replaySlot": 1, "atMs": 6 * 60_000, "technologyId": 22},
        ]})
        self.assertFalse(after["loomBeforeFeudal"]["value"])


if __name__ == "__main__":
    unittest.main()
