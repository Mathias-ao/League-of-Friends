import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from opening_statistics import OPENING_STATISTICS_VERSION, project_opening_statistics


CATALOG = {
    "buildings": {
        "12": {"name": "Barracks", "roleKeys": ["barracks", "military_production"]},
        "45": {"name": "Dock", "roleKeys": ["dock", "naval_economy", "naval_production"]},
        "70": {"name": "House", "roleKeys": ["house"], "trainTime": 25},
        "109": {"name": "Town Center", "roleKeys": ["town_center", "economy", "population_production"], "trainTime": 100},
        "72": {"name": "Palisade Wall", "roleKeys": ["wall", "fortification"]},
        "87": {"name": "Archery Range", "roleKeys": ["archery_range", "military_production"]},
    },
    "units": {
        "4": {"name": "Archer", "roleKeys": ["archer", "land_military", "ranged"]},
        "83": {"name": "Villager", "roleKeys": ["villager", "economic_unit"], "trainTime": 25},
        "448": {"name": "Scout Cavalry", "roleKeys": ["scout", "land_military"]},
        "13": {"name": "Fishing Ship", "roleKeys": ["fishing_ship", "economic_unit", "water_unit"]},
        "74": {"name": "Militia", "roleKeys": ["militia", "land_military"]},
        "539": {"name": "Galley", "roleKeys": ["galley", "water_military", "ranged"]},
    },
    "technologies": {
        "22": {"name": "Loom", "roleKeys": ["loom", "eco_tech"], "researchTime": 25},
        "101": {"name": "Feudal Age", "roleKeys": ["feudal_age"]},
        "102": {"name": "Castle Age", "roleKeys": ["castle_age"]},
        "103": {"name": "Imperial Age", "roleKeys": ["imperial_age"]},
    },
}

MANIFEST = {
    "participants": [{"playerId": 1, "civilization": {"rawId": 1}}],
    "match": {"settings": {"population": 200}},
}

DEFAULT_INITIAL_OBJECTS = [
    {"objectInstanceIds": [100], "payload": {"ownerPlayerId": 1, "objectId": 109}},
    {"objectInstanceIds": [101], "payload": {"ownerPlayerId": 1, "objectId": 83}},
    {"objectInstanceIds": [102], "payload": {"ownerPlayerId": 1, "objectId": 83}},
    {"objectInstanceIds": [103], "payload": {"ownerPlayerId": 1, "objectId": 83}},
    {"objectInstanceIds": [104], "payload": {"ownerPlayerId": 1, "objectId": 448}},
]


def project(body, observed_until_ms=40 * 60_000, initial_objects=None, manifest=None):
    complete = {
        "researchEvents": [],
        "productionEvents": [],
        "buildEvents": [],
        "wallEvents": [],
        **body,
    }
    return project_opening_statistics(
        manifest=manifest or MANIFEST,
        body=complete,
        catalog=CATALOG,
        observed_until_ms=observed_until_ms,
        initial_objects=DEFAULT_INITIAL_OBJECTS if initial_objects is None else initial_objects,
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

    def test_villagers_before_feudal_age_counts_only_completed_production(self):
        result = project({
            "researchEvents": [
                {"replaySlot": 1, "atMs": 120_000, "technologyId": 101, "producerObjectIds": [100], "sourceEventId": "op-000000100"},
            ],
            "productionEvents": [
                {"replaySlot": 1, "atMs": 0, "unitId": 83, "signedAmount": 10, "requestedAmountPositive": 10,
                 "producerObjectIds": [100], "sourceEventId": "op-000000001"},
            ],
        })
        villagers = result["villagersBeforeFeudalAge"]
        # Starting pop is 4/5 (3 villagers + scout). One villager completes at 25s,
        # then the TC is population blocked because no House was completed.
        self.assertEqual(villagers["count"], 4)
        self.assertEqual(villagers["startingVillagersObserved"], 3)
        self.assertEqual(villagers["villagersProjectedCompletedBeforeFeudalClick"], 1)
        self.assertGreater(villagers["populationBlockedMs"], 0)

    def test_villager_backorders_resume_after_projected_house_completion(self):
        result = project({
            "researchEvents": [
                {"replaySlot": 1, "atMs": 120_000, "technologyId": 101, "producerObjectIds": [100], "sourceEventId": "op-000000100"},
            ],
            "productionEvents": [
                {"replaySlot": 1, "atMs": 0, "unitId": 83, "signedAmount": 10, "requestedAmountPositive": 10,
                 "producerObjectIds": [100], "sourceEventId": "op-000000001"},
            ],
            "buildEvents": [
                {"replaySlot": 1, "atMs": 30_000, "buildingId": 70, "builderObjectIds": [101],
                 "sourceEventId": "op-000000010"},
            ],
        })
        villagers = result["villagersBeforeFeudalAge"]
        # House projects complete at 55s. The second villager was ready at 50s,
        # waits for population room, then later villagers continue from 55s.
        self.assertEqual(villagers["count"], 6)
        self.assertEqual(villagers["populationCapAtFeudalClick"], 10)
        self.assertEqual(villagers["populationBlockedMs"], 5_000)

    def test_starting_villagers_come_from_replay_and_chinese_tc_population_is_used(self):
        chinese_manifest = {
            "participants": [{"playerId": 1, "civilization": {"rawId": 6}}],
            "match": {"settings": {"population": 200}},
        }
        chinese_initial = [
            {"objectInstanceIds": [100], "payload": {"ownerPlayerId": 1, "objectId": 109}},
            *[
                {"objectInstanceIds": [101 + i], "payload": {"ownerPlayerId": 1, "objectId": 83}}
                for i in range(6)
            ],
            {"objectInstanceIds": [120], "payload": {"ownerPlayerId": 1, "objectId": 448}},
        ]
        result = project({
            "researchEvents": [
                {"replaySlot": 1, "atMs": 100_000, "technologyId": 101, "producerObjectIds": [100], "sourceEventId": "op-000000100"},
            ],
            "productionEvents": [
                {"replaySlot": 1, "atMs": 0, "unitId": 83, "signedAmount": 10, "requestedAmountPositive": 10,
                 "producerObjectIds": [100], "sourceEventId": "op-000000001"},
            ],
        }, initial_objects=chinese_initial, manifest=chinese_manifest)
        villagers = result["villagersBeforeFeudalAge"]
        self.assertEqual(villagers["startingVillagersObserved"], 6)
        self.assertEqual(villagers["initialPopulationCapReconstructed"], 15)
        self.assertEqual(villagers["count"], 10)

    def test_persian_dark_age_tc_work_rate_shortens_villager_clock(self):
        persian_manifest = {
            "participants": [{"playerId": 1, "civilization": {"rawId": 8}}],
            "match": {"settings": {"population": 200}},
        }
        initial = DEFAULT_INITIAL_OBJECTS + [
            {"objectInstanceIds": [130], "payload": {"ownerPlayerId": 1, "objectId": 70}},
        ]
        result = project({
            "researchEvents": [
                {"replaySlot": 1, "atMs": 96_000, "technologyId": 101, "producerObjectIds": [100], "sourceEventId": "op-000000100"},
            ],
            "productionEvents": [
                {"replaySlot": 1, "atMs": 0, "unitId": 83, "signedAmount": 10, "requestedAmountPositive": 10,
                 "producerObjectIds": [100], "sourceEventId": "op-000000001"},
            ],
        }, initial_objects=initial, manifest=persian_manifest)
        villagers = result["villagersBeforeFeudalAge"]
        self.assertEqual(villagers["villagersProjectedCompletedBeforeFeudalClick"], 4)
        self.assertAlmostEqual(villagers["villagerTrainTimeMs"], 25_000 / 1.05, places=3)

    def test_villager_queue_cancellation_removes_backorder(self):
        initial = DEFAULT_INITIAL_OBJECTS + [
            {"objectInstanceIds": [130], "payload": {"ownerPlayerId": 1, "objectId": 70}},
        ]
        result = project({
            "researchEvents": [
                {"replaySlot": 1, "atMs": 100_000, "technologyId": 101, "producerObjectIds": [100], "sourceEventId": "op-000000100"},
            ],
            "productionEvents": [
                {"replaySlot": 1, "atMs": 0, "unitId": 83, "signedAmount": 4, "requestedAmountPositive": 4,
                 "producerObjectIds": [100], "sourceEventId": "op-000000001"},
                {"replaySlot": 1, "atMs": 10_000, "unitId": 83, "signedAmount": -2, "requestedAmountPositive": 0,
                 "producerObjectIds": [100], "sourceEventId": "op-000000002"},
            ],
        }, initial_objects=initial)
        self.assertEqual(result["villagersBeforeFeudalAge"]["villagersProjectedCompletedBeforeFeudalClick"], 2)

    def test_loom_occupies_tc_before_feudal(self):
        initial = DEFAULT_INITIAL_OBJECTS + [
            {"objectInstanceIds": [130], "payload": {"ownerPlayerId": 1, "objectId": 70}},
        ]
        result = project({
            "researchEvents": [
                {"replaySlot": 1, "atMs": 0, "technologyId": 22, "producerObjectIds": [100], "sourceEventId": "op-000000001"},
                {"replaySlot": 1, "atMs": 80_000, "technologyId": 101, "producerObjectIds": [100], "sourceEventId": "op-000000100"},
            ],
            "productionEvents": [
                {"replaySlot": 1, "atMs": 1_000, "unitId": 83, "signedAmount": 10, "requestedAmountPositive": 10,
                 "producerObjectIds": [100], "sourceEventId": "op-000000002"},
            ],
        }, initial_objects=initial)
        self.assertEqual(result["villagersBeforeFeudalAge"]["villagersProjectedCompletedBeforeFeudalClick"], 2)

    def test_unknown_villager_queue_amount_remains_unavailable(self):
        result = project({
            "researchEvents": [
                {"replaySlot": 1, "atMs": 300_000, "technologyId": 101, "producerObjectIds": [100], "sourceEventId": "op-000000100"},
            ],
            "productionEvents": [
                {"replaySlot": 1, "atMs": 60_000, "unitId": 83, "signedAmount": None, "requestedAmountPositive": None,
                 "producerObjectIds": [100], "sourceEventId": "op-000000001"},
            ],
        })
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
