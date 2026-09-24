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
        "93": {"id": 93, "name": "Spearman", "internalName": "PKEMN", "roleKeys": ["spearman", "land_military", "infantry"], "cost": {"Food": 35, "Wood": 25}},
        "7": {"id": 7, "name": "Skirmisher", "internalName": "XBOWM", "roleKeys": ["skirmisher", "land_military", "ranged"], "cost": {"Food": 25, "Wood": 35}},
        "448": {"id": 448, "name": "Scout Cavalry", "internalName": "SCOUT", "roleKeys": ["scout_cavalry", "land_military", "cavalry"], "cost": {"Food": 80}},
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
        "103": {"id": 103, "name": "Blacksmith", "internalName": "BLAC", "roleKeys": ["blacksmith", "military_upgrade"], "cost": {"Wood": 150}},
        "209": {"id": 209, "name": "University", "internalName": "UNIV", "roleKeys": [], "cost": {"Wood": 200}},
    },
    "technologies": {
        "101": {"id": 101, "name": "Feudal Age", "roleKeys": ["feudal_age"], "cost": {"Food": 500}},
        "102": {"id": 102, "name": "Castle Age", "roleKeys": ["castle_age"], "cost": {"Food": 800, "Gold": 200}},
        "47": {"id": 47, "name": "Chemistry", "roleKeys": [], "cost": {"Food": 300, "Gold": 200}},
        "67": {"id": 67, "name": "Forging", "roleKeys": [], "cost": {"Food": 150}},
        "93": {"id": 93, "name": "Ballistics", "roleKeys": [], "cost": {"Wood": 300, "Gold": 175}},
        "199": {"id": 199, "name": "Fletching", "roleKeys": [], "cost": {"Food": 100, "Gold": 50}},
        "200": {"id": 200, "name": "Bodkin Arrow", "roleKeys": [], "cost": {"Food": 200, "Gold": 100}},
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

    def test_army_commitment_checkpoints_keep_gross_and_cancellation_adjusted_values(self):
        result = self.project(body(
            productionEvents=[
                {"replaySlot": 1, "atMs": 5 * 60_000, "unitId": 4,
                 "producerBuildingTypeId": 87, "signedAmount": 2, "requestedAmountPositive": 2},
                {"replaySlot": 1, "atMs": 12 * 60_000, "unitId": 38,
                 "producerBuildingTypeId": 101, "signedAmount": 1, "requestedAmountPositive": 1},
                {"replaySlot": 1, "atMs": 14 * 60_000, "unitId": 4,
                 "producerBuildingTypeId": 87, "signedAmount": -1, "requestedAmountPositive": 0},
            ],
        ))
        checkpoints = result["armyCommitmentCheckpoints"]
        self.assertEqual(checkpoints["at10Minutes"]["grossPositiveQueueResources"], 140)
        self.assertEqual(checkpoints["at10Minutes"]["netQueueResources"], 140)
        self.assertEqual(checkpoints["at15Minutes"]["grossPositiveQueueResources"], 275)
        self.assertEqual(checkpoints["at15Minutes"]["cancelledQueueResources"], 70)
        self.assertEqual(checkpoints["at15Minutes"]["netQueueResources"], 205)
        self.assertEqual(checkpoints["at20Minutes"]["netQueueResources"], 205)

    def test_trash_units_and_share_use_explicit_three_line_ids(self):
        result = self.project(body(
            productionEvents=[
                {"replaySlot": 1, "atMs": 10_000, "unitId": 93,
                 "producerBuildingTypeId": 12, "signedAmount": 3, "requestedAmountPositive": 3},
                {"replaySlot": 1, "atMs": 20_000, "unitId": 7,
                 "producerBuildingTypeId": 87, "signedAmount": 2, "requestedAmountPositive": 2},
                {"replaySlot": 1, "atMs": 30_000, "unitId": 448,
                 "producerBuildingTypeId": 101, "signedAmount": 5, "requestedAmountPositive": 5},
                {"replaySlot": 1, "atMs": 40_000, "unitId": 4,
                 "producerBuildingTypeId": 87, "signedAmount": 10, "requestedAmountPositive": 10},
            ],
        ))
        self.assertEqual(result["trashUnits"]["count"], 10)
        self.assertEqual(result["trashUnits"]["byLine"]["spearLine"], 3)
        self.assertEqual(result["trashUnits"]["byLine"]["skirmisherLine"], 2)
        self.assertEqual(result["trashUnits"]["byLine"]["lightCavalryLine"], 5)
        self.assertEqual(result["trashArmyShare"]["percent"], 50.0)

    def test_production_buildings_used_counts_distinct_decoded_producer_objects(self):
        result = self.project(body(
            productionEvents=[
                {"replaySlot": 1, "atMs": 10_000, "unitId": 4,
                 "producerBuildingTypeId": 87, "producerObjectIds": [100, 101],
                 "signedAmount": 2, "requestedAmountPositive": 2},
                {"replaySlot": 1, "atMs": 20_000, "unitId": 4,
                 "producerBuildingTypeId": 87, "producerObjectIds": [101, 102],
                 "signedAmount": 1, "requestedAmountPositive": 1},
                {"replaySlot": 1, "atMs": 30_000, "unitId": 38,
                 "producerBuildingTypeId": 101, "producerObjectIds": [],
                 "signedAmount": 1, "requestedAmountPositive": 1},
            ],
        ))
        used = result["productionBuildingsUsed"]
        self.assertEqual(used["count"], 3)
        self.assertEqual(used["eventsWithoutProducerObjectIds"], 1)
        self.assertEqual(used["byProducerBuildingTypeId"]["87"], 3)

    def test_castles_blacksmith_and_university_fundamentals(self):
        result = self.project(body(
            buildEvents=[
                {"replaySlot": 1, "atMs": 500_000, "buildingId": 103},
                {"replaySlot": 1, "atMs": 700_000, "buildingId": 209},
                {"replaySlot": 1, "atMs": 800_000, "buildingId": 82},
                {"replaySlot": 1, "atMs": 1_000_000, "buildingId": 82},
            ],
            researchEvents=[
                {"replaySlot": 1, "atMs": 600_000, "technologyId": 199, "sourceEventId": "f1"},
                {"replaySlot": 1, "atMs": 650_000, "technologyId": 67, "sourceEventId": "forge"},
                {"replaySlot": 1, "atMs": 900_000, "technologyId": 199, "sourceEventId": "f2"},
                {"replaySlot": 1, "atMs": 920_000, "technologyId": 93, "sourceEventId": "ballistics1"},
                {"replaySlot": 1, "atMs": 950_000, "technologyId": 47, "sourceEventId": "chem"},
                {"replaySlot": 1, "atMs": 970_000, "technologyId": 93, "sourceEventId": "ballistics2"},
            ],
        ))
        self.assertEqual(result["castles"]["count"], 2)
        self.assertEqual(result["castles"]["firstAtMs"], 800_000)
        self.assertEqual(result["blacksmithBuildings"]["count"], 1)
        self.assertEqual(result["blacksmithUpgrades"]["count"], 2)
        self.assertEqual(result["blacksmithUpgrades"]["requestCountTotal"], 3)
        self.assertEqual(result["blacksmithUpgrades"]["repeatRequestCount"], 1)
        self.assertEqual(result["blacksmithUpgrades"]["firstAtMs"], 600_000)
        fletching = next(
            row for row in result["blacksmithUpgrades"]["technologies"]
            if row["technology"]["rawId"] == 199
        )
        self.assertEqual(fletching["firstRequestedAtMs"], 600_000)
        self.assertEqual(fletching["latestRequestedAtMs"], 900_000)
        self.assertEqual(fletching["requestCount"], 2)
        self.assertEqual(result["universityBuildings"]["count"], 1)
        self.assertEqual(result["universityTechs"]["count"], 2)
        self.assertEqual(result["ballistics"]["atMs"], 970_000)
        self.assertEqual(result["chemistry"]["atMs"], 950_000)

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
