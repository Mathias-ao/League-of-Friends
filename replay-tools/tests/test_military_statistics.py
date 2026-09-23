import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from military_statistics import project_military_statistics


CATALOG = {
    "schemaVersion": "TEST",
    "sourceVersion": {"commit": "test"},
    "units": {
        "4": {"id": 4, "name": "Archer", "internalName": "ARCHR", "roleKeys": ["archer", "land_military", "ranged"], "cost": {"Wood": 25, "Gold": 45}},
        "38": {"id": 38, "name": "Knight", "internalName": "KNGHT", "roleKeys": ["knight", "land_military", "cavalry"], "cost": {"Food": 60, "Gold": 75}},
        "74": {"id": 74, "name": "Militia", "internalName": "SPRMN", "roleKeys": ["militia", "land_military", "infantry"], "cost": {"Food": 50, "Gold": 20}},
        "83": {"id": 83, "name": "Villager", "internalName": "VILL", "roleKeys": ["villager", "economic_unit"], "cost": {"Food": 50}},
        "125": {"id": 125, "name": "Monk", "internalName": "MONKX", "roleKeys": ["monk", "land_military", "support"], "cost": {"Gold": 100}},
        "539": {"id": 539, "name": "Galley", "internalName": "SGALY", "roleKeys": ["galley", "water_military", "ranged"], "cost": {"Wood": 90, "Gold": 30}},
        "13": {"id": 13, "name": "Fishing Ship", "internalName": "FSHIP", "roleKeys": ["fishing_ship", "economic_unit"], "cost": {"Wood": 75}},
        "280": {"id": 280, "name": "Mangonel", "internalName": "MANGONEL", "roleKeys": [], "cost": {"Wood": 160, "Gold": 135}},
        "999": {"id": 999, "name": "Unique Unit", "internalName": "UU", "roleKeys": [], "cost": {"Food": 50, "Gold": 50}},
    },
    "buildings": {
        "12": {"id": 12, "name": "Barracks", "internalName": "Barracks Age1", "roleKeys": ["barracks", "military_production"], "cost": {"Wood": 175}},
        "45": {"id": 45, "name": "Dock", "internalName": "DOCK", "roleKeys": ["dock", "naval_production", "naval_economy"], "cost": {"Wood": 150}},
        "49": {"id": 49, "name": "SIWS", "internalName": "SIWS", "roleKeys": [], "cost": {"Wood": 200}},
        "72": {"id": 72, "name": "Palisade Wall", "internalName": "WALL", "roleKeys": ["wall", "fortification"], "cost": {"Wood": 3}},
        "82": {"id": 82, "name": "CSTL", "internalName": "CSTL", "roleKeys": [], "cost": {"Stone": 650}},
        "87": {"id": 87, "name": "Archery Range", "internalName": "ARRG", "roleKeys": ["archery_range", "military_production"], "cost": {"Wood": 175}},
        "101": {"id": 101, "name": "Stable", "internalName": "STBL", "roleKeys": ["stable", "military_production"], "cost": {"Wood": 175}},
        "104": {"id": 104, "name": "CRCH", "internalName": "CRCH", "roleKeys": [], "cost": {"Wood": 175}},
    },
    "technologies": {
        "101": {"id": 101, "name": "Feudal Age", "roleKeys": ["feudal_age"], "cost": {"Food": 500}},
        "102": {"id": 102, "name": "Castle Age", "roleKeys": ["castle_age"], "cost": {"Food": 800, "Gold": 200}},
        "199": {"id": 199, "name": "Fletching", "roleKeys": [], "cost": {"Food": 100, "Gold": 50}},
        "202": {"id": 202, "name": "Double-Bit Axe", "roleKeys": ["eco_tech"], "cost": {"Food": 100, "Wood": 50}},
    },
}

MANIFEST = {
    "participants": [{"playerId": 1}],
}


def body(**kwargs):
    result = {
        "productionEvents": [],
        "researchEvents": [],
        "buildEvents": [],
        "wallEvents": [],
    }
    result.update(kwargs)
    return result


class MilitaryStatisticsTests(unittest.TestCase):
    def project(self, source):
        return project_military_statistics(
            manifest=MANIFEST,
            body=source,
            catalog=CATALOG,
        )["1"]

    def test_queue_composition_and_spend_use_positive_military_requests(self):
        result = self.project(body(
            productionEvents=[
                {"replaySlot": 1, "atMs": 10_000, "unitId": 74, "producerBuildingTypeId": 12, "signedAmount": 3, "requestedAmountPositive": 3},
                {"replaySlot": 1, "atMs": 20_000, "unitId": 4, "producerBuildingTypeId": 87, "signedAmount": 4, "requestedAmountPositive": 4},
                {"replaySlot": 1, "atMs": 30_000, "unitId": 38, "producerBuildingTypeId": 101, "signedAmount": 2, "requestedAmountPositive": 2},
                {"replaySlot": 1, "atMs": 40_000, "unitId": 280, "producerBuildingTypeId": 49, "signedAmount": 1, "requestedAmountPositive": 1},
                {"replaySlot": 1, "atMs": 50_000, "unitId": 125, "producerBuildingTypeId": 104, "signedAmount": 1, "requestedAmountPositive": 1},
                {"replaySlot": 1, "atMs": 60_000, "unitId": 539, "producerBuildingTypeId": 45, "signedAmount": 2, "requestedAmountPositive": 2},
                {"replaySlot": 1, "atMs": 70_000, "unitId": 13, "producerBuildingTypeId": 45, "signedAmount": 5, "requestedAmountPositive": 5},
                {"replaySlot": 1, "atMs": 80_000, "unitId": 4, "producerBuildingTypeId": 87, "signedAmount": -1, "requestedAmountPositive": 0},
            ],
        ))
        self.assertEqual(result["militaryUnitsTrained"]["count"], 13)
        self.assertEqual(result["militaryUnitsTrained"]["negativeQueueAmountObserved"], 1)
        self.assertEqual(result["composition"]["infantry"], 3)
        self.assertEqual(result["composition"]["archers"], 4)
        self.assertEqual(result["composition"]["cavalry"], 2)
        self.assertEqual(result["composition"]["siege"], 1)
        self.assertEqual(result["composition"]["monks"], 1)
        self.assertEqual(result["composition"]["warships"], 2)
        self.assertEqual(result["firstSiege"]["atMs"], 40_000)
        self.assertEqual(result["firstMonk"]["atMs"], 50_000)
        self.assertEqual(result["firstWarship"]["atMs"], 60_000)
        self.assertEqual(result["firstMilitaryProduction"]["atMs"], 10_000)
        unit_total = 3*70 + 4*70 + 2*135 + 295 + 100 + 2*120
        self.assertEqual(result["militaryUnitCommitment"]["resources"], unit_total)
        self.assertEqual(result["militarySpend"]["resources"], unit_total)

    def test_unlabelled_units_use_promoted_producer_building_type(self):
        result = self.project(body(
            productionEvents=[
                {"replaySlot": 1, "atMs": 10_000, "unitId": 280,
                 "producerBuildingTypeId": 49, "signedAmount": 8, "requestedAmountPositive": 8},
                {"replaySlot": 1, "atMs": 20_000, "unitId": 999,
                 "producerBuildingTypeId": 87, "signedAmount": 12, "requestedAmountPositive": 12},
            ],
        ))
        self.assertEqual(result["composition"]["siege"], 8)
        self.assertEqual(result["composition"]["archers"], 12)
        self.assertEqual(result["firstSiege"]["atMs"], 10_000)
        self.assertEqual(result["militaryUnitsTrained"]["count"], 20)

    def test_broad_military_spend_includes_buildings_walls_and_military_techs(self):
        result = self.project(body(
            productionEvents=[
                {"replaySlot": 1, "atMs": 10_000, "unitId": 4,
                 "producerBuildingTypeId": 87, "signedAmount": 2, "requestedAmountPositive": 2},
            ],
            researchEvents=[
                {"replaySlot": 1, "atMs": 20_000, "technologyId": 199},
                {"replaySlot": 1, "atMs": 30_000, "technologyId": 202},
                {"replaySlot": 1, "atMs": 40_000, "technologyId": 102},
            ],
            buildEvents=[
                {"replaySlot": 1, "atMs": 50_000, "buildingId": 87},
                {"replaySlot": 1, "atMs": 60_000, "buildingId": 45},
            ],
            wallEvents=[
                {"replaySlot": 1, "atMs": 70_000, "buildingId": 72,
                 "x": 1, "y": 1, "xEnd": 3, "yEnd": 1},
            ],
        ))
        self.assertEqual(result["militaryUnitCommitment"]["resources"], 140)
        self.assertEqual(result["militarySpend"]["unitQueueResources"], 140)
        self.assertEqual(result["militarySpend"]["buildingPlacementResources"], 184)
        self.assertEqual(result["militarySpend"]["technologyRequestResources"], 150)
        self.assertEqual(result["militarySpend"]["resources"], 474)

    def test_special_castle_queue_is_kept_military_without_forced_class(self):
        result = self.project(body(
            productionEvents=[
                {"replaySlot": 1, "atMs": 500_000, "unitId": 999, "producerBuildingTypeId": 82, "signedAmount": 3, "requestedAmountPositive": 3},
            ],
        ))
        self.assertEqual(result["militaryUnitsTrained"]["count"], 3)
        self.assertEqual(result["composition"]["specialMilitary"], 3)
        self.assertEqual(result["composition"]["productionDiversity"], 1)

    def test_military_buildings_and_castle_click_boundary(self):
        result = self.project(body(
            researchEvents=[
                {"replaySlot": 1, "atMs": 600_000, "technologyId": 102, "sourceEventId": "castle"},
            ],
            buildEvents=[
                {"replaySlot": 1, "atMs": 100_000, "buildingId": 12, "sourceEventId": "b"},
                {"replaySlot": 1, "atMs": 200_000, "buildingId": 87, "sourceEventId": "r"},
                {"replaySlot": 1, "atMs": 300_000, "buildingId": 101, "sourceEventId": "s"},
                {"replaySlot": 1, "atMs": 700_000, "buildingId": 49, "sourceEventId": "sw"},
            ],
        ))
        buildings = result["militaryBuildings"]
        self.assertEqual(buildings["count"], 4)
        self.assertEqual(buildings["atCastleClick"]["count"], 3)
        self.assertEqual(buildings["first"]["atMs"], 100_000)
        self.assertEqual(buildings["byType"]["barracks"], 1)
        self.assertEqual(buildings["byType"]["archeryRanges"], 1)
        self.assertEqual(buildings["byType"]["stables"], 1)
        self.assertEqual(buildings["byType"]["siegeWorkshops"], 1)

    def test_unknown_amount_makes_total_unavailable_but_keeps_known_coverage(self):
        result = self.project(body(
            productionEvents=[
                {"replaySlot": 1, "atMs": 10_000, "unitId": 74, "producerBuildingTypeId": 12, "signedAmount": None, "requestedAmountPositive": None},
                {"replaySlot": 1, "atMs": 20_000, "unitId": 4, "producerBuildingTypeId": 87, "signedAmount": 2, "requestedAmountPositive": 2},
            ],
        ))
        self.assertIsNone(result["militaryUnitsTrained"]["count"])
        self.assertEqual(result["militaryUnitsTrained"]["positiveQueueAmount"], 2)
        self.assertEqual(result["militaryUnitsTrained"]["unknownAmountCommands"], 1)


if __name__ == "__main__":
    unittest.main()
