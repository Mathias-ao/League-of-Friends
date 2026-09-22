import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from economy_statistics import project_economy_statistics


CATALOG = {
    "buildings": {
        "50": {"id": 50, "name": "Farm", "roleKeys": ["farm", "economy"], "cost": {"Wood": 60}, "trainTime": 15},
        "70": {"id": 70, "name": "House", "roleKeys": ["house"], "cost": {"Wood": 25}, "trainTime": 25},
        "84": {"id": 84, "name": "Market", "roleKeys": ["market", "economy"], "cost": {"Wood": 175}, "trainTime": 60},
        "87": {"id": 87, "name": "Archery Range", "roleKeys": ["archery_range", "military_production"], "cost": {"Wood": 175}, "trainTime": 50},
        "109": {"id": 109, "name": "Town Center", "roleKeys": ["town_center", "economy", "population_production"], "cost": {"Wood": 275, "Stone": 100}, "trainTime": 100},
        "621": {"id": 621, "name": "Town Center", "roleKeys": ["town_center", "economy", "population_production"], "cost": {"Wood": 275, "Stone": 100}, "trainTime": 150},
    },
    "units": {
        "4": {"id": 4, "name": "Archer", "roleKeys": ["land_military"], "cost": {"Wood": 25, "Gold": 45}},
        "83": {"id": 83, "name": "Villager", "roleKeys": ["villager", "economic_unit"], "cost": {"Food": 50}, "trainTime": 25},
        "448": {"id": 448, "name": "Scout Cavalry", "roleKeys": ["land_military"], "cost": {"Food": 80}},
    },
    "technologies": {
        "14": {"id": 14, "name": "Horse Collar", "roleKeys": ["horse_collar", "eco_tech"], "cost": {"Food": 75, "Wood": 75}, "researchTime": 20},
        "22": {"id": 22, "name": "Loom", "roleKeys": ["loom", "eco_tech"], "cost": {"Gold": 50}, "researchTime": 25},
        "101": {"id": 101, "name": "Feudal Age", "roleKeys": [], "cost": {"Food": 500}, "researchTime": 130},
        "102": {"id": 102, "name": "Castle Age", "roleKeys": [], "cost": {"Food": 800, "Gold": 200}, "researchTime": 160},
        "202": {"id": 202, "name": "Double-Bit Axe", "roleKeys": ["double_bit_axe", "eco_tech"], "cost": {"Food": 100, "Wood": 50}, "researchTime": 25},
    },
}

MANIFEST = {
    "participants": [{"playerId": 1, "number": 1, "civilization": {"rawId": 14}}],
    "match": {"settings": {"population": 200, "startingAgeId": 0}},
}

INITIAL = [
    {"objectInstanceIds": [100], "payload": {"ownerPlayerId": 1, "objectId": 109}},
    {"objectInstanceIds": [101], "payload": {"ownerPlayerId": 1, "objectId": 83}},
    {"objectInstanceIds": [102], "payload": {"ownerPlayerId": 1, "objectId": 83}},
    {"objectInstanceIds": [103], "payload": {"ownerPlayerId": 1, "objectId": 83}},
    {"objectInstanceIds": [104], "payload": {"ownerPlayerId": 1, "objectId": 448}},
    {"objectInstanceIds": [900], "payload": {"ownerPlayerId": 0, "objectId": 48}},
    {"objectInstanceIds": [901], "payload": {"ownerPlayerId": 0, "objectId": 65}},
    {"objectInstanceIds": [902], "payload": {"ownerPlayerId": 0, "objectId": 594}},
]


def body(**kwargs):
    result = {
        "productionEvents": [],
        "researchEvents": [],
        "buildEvents": [],
        "marketEvents": [],
        "durationMs": 30 * 60_000,
    }
    result.update(kwargs)
    return result


class EconomyStatisticsTests(unittest.TestCase):
    def project(self, source, actions=None):
        return project_economy_statistics(
            manifest=MANIFEST,
            body=source,
            catalog=CATALOG,
            initial_objects=INITIAL,
            action_events=actions or [],
        )["1"]

    def test_villager_queue_metrics_and_dark_age_idle(self):
        result = self.project(body(
            productionEvents=[
                {"replaySlot": 1, "atMs": 0, "unitId": 83, "signedAmount": 5, "requestedAmountPositive": 5, "producerObjectIds": [999]},
                {"replaySlot": 1, "atMs": 100_000, "unitId": 83, "signedAmount": -1, "requestedAmountPositive": 0, "producerObjectIds": [999]},
                {"replaySlot": 1, "atMs": 1_300_000, "unitId": 83, "signedAmount": 4, "requestedAmountPositive": 4, "producerObjectIds": [999]},
            ],
            researchEvents=[
                {"replaySlot": 1, "atMs": 300_000, "technologyId": 101, "producerObjectIds": [999], "sourceEventId": "f"},
            ],
        ))
        self.assertEqual(result["villagersTrained"]["count"], 9)
        self.assertEqual(result["villagersBy20Minutes"]["count"], 7)
        self.assertEqual(result["tcIdleTimeDarkAge"]["valueMs"], 175_000)

    def test_town_center_farm_eco_tech_and_market_metrics(self):
        result = self.project(body(
            researchEvents=[
                {"replaySlot": 1, "atMs": 500_000, "technologyId": 14, "sourceEventId": "hc"},
                {"replaySlot": 1, "atMs": 520_000, "technologyId": 202, "sourceEventId": "dba"},
                {"replaySlot": 1, "atMs": 900_000, "technologyId": 102, "sourceEventId": "castle"},
            ],
            buildEvents=[
                {"replaySlot": 1, "atMs": 400_000, "buildingId": 50},
                {"replaySlot": 1, "atMs": 510_000, "buildingId": 50},
                {"replaySlot": 1, "atMs": 800_000, "buildingId": 621},
                {"replaySlot": 1, "atMs": 1_100_000, "buildingId": 109},
            ],
            marketEvents=[
                {"replaySlot": 1, "atMs": 700_000, "type": "SELL", "amount": 100},
                {"replaySlot": 1, "atMs": 710_000, "type": "BUY", "amount": 200},
            ],
        ))
        self.assertEqual(result["townCenters"]["count"], 3)
        self.assertEqual(result["firstExtraTownCenterTime"]["atMs"], 800_000)
        self.assertEqual(result["thirdTownCenterTime"]["atMs"], 1_100_000)
        self.assertEqual(result["farmsPlaced"]["count"], 2)
        self.assertEqual(result["farmsBeforeHorseCollar"]["count"], 2)
        self.assertEqual(result["economicTechsResearched"]["count"], 2)
        self.assertEqual(result["market"]["transactions"]["count"], 2)
        self.assertEqual(result["market"]["volumeTraded"]["amount"], 300)
        self.assertEqual(result["market"]["sales"]["count"], 1)
        self.assertEqual(result["market"]["purchases"]["count"], 1)

    def test_animal_interactions_are_distinct_target_proxies(self):
        actions = [
            {"actorPlayerId": 1, "sourceActionName": "ORDER", "targetInstanceId": 900, "timestampMs": 60_000, "operationOrdinal": 1},
            {"actorPlayerId": 1, "sourceActionName": "ORDER", "targetInstanceId": 900, "timestampMs": 70_000, "operationOrdinal": 2},
            {"actorPlayerId": 1, "sourceActionName": "ORDER", "targetInstanceId": 901, "timestampMs": 80_000, "operationOrdinal": 3},
            {"actorPlayerId": 1, "sourceActionName": "ORDER", "targetInstanceId": 902, "timestampMs": 90_000, "operationOrdinal": 4},
        ]
        result = self.project(body(), actions)
        self.assertEqual(result["firstBoarLure"]["atMs"], 60_000)
        self.assertEqual(result["boarsTaken"]["count"], 1)
        self.assertEqual(result["deerTaken"]["count"], 1)
        self.assertEqual(result["livestockTaken"]["count"], 1)

    def test_commitment_ratio_at_20m_uses_classified_base_costs(self):
        result = self.project(body(
            productionEvents=[
                {"replaySlot": 1, "atMs": 100_000, "unitId": 83, "requestedAmountPositive": 2, "signedAmount": 2},
                {"replaySlot": 1, "atMs": 200_000, "unitId": 4, "requestedAmountPositive": 2, "signedAmount": 2},
            ],
            buildEvents=[
                {"replaySlot": 1, "atMs": 300_000, "buildingId": 50},
                {"replaySlot": 1, "atMs": 400_000, "buildingId": 87},
            ],
        ))
        ratio = result["ecoMilitaryRatioAt20Minutes"]
        self.assertEqual(ratio["economyCommitment"], 160)
        self.assertEqual(ratio["militaryCommitment"], 315)
        self.assertAlmostEqual(ratio["economyToMilitaryRatio"], 160 / 315, places=3)


if __name__ == "__main__":
    unittest.main()
