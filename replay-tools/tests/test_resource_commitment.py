from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from resource_commitment import RESOURCE_COMMITMENT_VERSION, project_resource_commitment


class ResourceCommitmentTests(unittest.TestCase):
    def setUp(self):
        self.manifest = {"participants": [{"playerId": 1}]}
        self.catalog = {
            "units": {
                "83": {"name": "Villager", "cost": {"Food": 50}},
                "74": {"name": "Militia", "cost": {"Food": 60, "Gold": 20}},
            },
            "buildings": {
                "70": {"name": "House", "cost": {"Wood": 25}},
                "72": {"name": "Palisade Wall", "cost": {"Wood": 2}},
            },
            "technologies": {
                "101": {"name": "Feudal Age", "cost": {"Food": 500}},
                "102": {"name": "Castle Age", "cost": {"Food": 800, "Gold": 200}},
                "103": {"name": "Imperial Age", "cost": {"Food": 1000, "Gold": 800}},
                "22": {"name": "Loom", "cost": {"Gold": 50}},
            },
        }

    def test_match_and_age_totals_use_command_age(self):
        body = {
            "productionEvents": [
                {"replaySlot": 1, "atMs": 10_000, "unitId": 83, "requestedAmountPositive": 2},
                {"replaySlot": 1, "atMs": 240_000, "unitId": 74, "requestedAmountPositive": 1},
            ],
            "researchEvents": [
                {"replaySlot": 1, "atMs": 100_000, "technologyId": 101},
                {"replaySlot": 1, "atMs": 300_000, "technologyId": 102},
                {"replaySlot": 1, "atMs": 500_000, "technologyId": 103},
                {"replaySlot": 1, "atMs": 700_000, "technologyId": 22},
            ],
            "buildEvents": [
                {"replaySlot": 1, "atMs": 200_000, "buildingId": 70},
            ],
            "wallEvents": [
                {"replaySlot": 1, "atMs": 250_000, "buildingId": 72,
                 "x": 0, "y": 0, "xEnd": 2, "yEnd": 0},
            ],
        }
        result = project_resource_commitment(
            manifest=self.manifest, body=body, catalog=self.catalog,
        )["1"]

        self.assertEqual(result["modelVersion"], RESOURCE_COMMITMENT_VERSION)
        self.assertEqual(result["ageBoundaries"]["feudalAgeUpAtMs"], 230_000)
        self.assertEqual(result["ageBoundaries"]["castleAgeUpAtMs"], 460_000)
        self.assertEqual(result["ageBoundaries"]["imperialAgeUpAtMs"], 690_000)

        self.assertEqual(result["byAge"]["dark"], {
            "food": 600, "wood": 25, "gold": 0, "stone": 0, "total": 625,
        })
        self.assertEqual(result["byAge"]["feudal"], {
            "food": 860, "wood": 6, "gold": 220, "stone": 0, "total": 1086,
        })
        self.assertEqual(result["byAge"]["castle"], {
            "food": 1000, "wood": 0, "gold": 800, "stone": 0, "total": 1800,
        })
        self.assertEqual(result["byAge"]["imperial"], {
            "food": 0, "wood": 0, "gold": 50, "stone": 0, "total": 50,
        })
        self.assertEqual(result["resourcesCommitted"], {
            "food": 2460, "wood": 31, "gold": 1070, "stone": 0, "total": 3561,
        })
        self.assertEqual(result["coverage"]["pricedWallTiles"], 3)

    def test_missing_feudal_boundary_goes_to_unknown_age(self):
        body = {
            "productionEvents": [
                {"replaySlot": 1, "atMs": 10_000, "unitId": 83, "requestedAmountPositive": 1},
            ],
            "researchEvents": [], "buildEvents": [], "wallEvents": [],
        }
        result = project_resource_commitment(
            manifest=self.manifest, body=body, catalog=self.catalog,
        )["1"]
        self.assertEqual(result["byAge"]["unknown"]["food"], 50)
        self.assertEqual(result["byAge"]["dark"]["total"], 0)

    def test_nonpositive_queue_amounts_are_not_priced(self):
        body = {
            "productionEvents": [
                {"replaySlot": 1, "atMs": 10_000, "unitId": 83, "requestedAmountPositive": 0},
                {"replaySlot": 1, "atMs": 20_000, "unitId": 83, "requestedAmountPositive": None},
            ],
            "researchEvents": [], "buildEvents": [], "wallEvents": [],
        }
        result = project_resource_commitment(
            manifest=self.manifest, body=body, catalog=self.catalog,
        )["1"]
        self.assertEqual(result["resourcesCommitted"]["total"], 0)
        self.assertEqual(result["coverage"]["pricedRequestCommands"], 0)


if __name__ == "__main__":
    unittest.main()
