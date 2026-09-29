import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from economy_statistics_v5 import (
    _first_camp,
    _houses_built,
    _trade_units_trained,
    _tribute_metric,
    _villagers_by_10_minutes,
)
from execution_statistics_v2 import project_execution_statistics
from map_presence_v7 import project_map_presence
from military_statistics_v5 import _military_techs


class SeasonShowcaseStatisticsTests(unittest.TestCase):
    def test_economy_extensions_keep_command_evidence_semantics(self):
        catalog = {
            "buildings": {
                "70": {"id": 70, "name": "House", "roleKeys": ["house"]},
                "562": {"id": 562, "name": "Lumber Camp", "roleKeys": ["lumber_camp", "economy"]},
                "584": {"id": 584, "name": "Mining Camp", "roleKeys": ["mining_camp", "economy"]},
            },
            "units": {
                "83": {"id": 83, "name": "Villager", "roleKeys": ["villager", "economic_unit"]},
                "128": {"id": 128, "name": "Trade Cart", "roleKeys": ["trade_unit", "economic_unit"]},
            },
            "technologies": {},
        }
        production = [
            {"atMs": 100_000, "unitId": 83, "signedAmount": 3},
            {"atMs": 300_000, "unitId": 83, "signedAmount": -1},
            {"atMs": 700_000, "unitId": 83, "signedAmount": 4},
            {"atMs": 800_000, "unitId": 128, "signedAmount": 2},
            {"atMs": 900_000, "unitId": 128, "signedAmount": -1},
        ]
        villagers = _villagers_by_10_minutes(production, starting_villagers=6)
        self.assertEqual(villagers["count"], 8)
        self.assertEqual(villagers["positiveQueueAmountThrough10m"], 3)
        self.assertEqual(villagers["negativeQueueAmountThrough10m"], 1)

        builds = [
            {"atMs": 120_000, "buildingId": 70, "sourceEventId": "h1"},
            {"atMs": 180_000, "buildingId": 562, "sourceEventId": "l1"},
            {"atMs": 200_000, "buildingId": 584, "sourceEventId": "m1"},
            {"atMs": 250_000, "buildingId": 70, "sourceEventId": "h2"},
        ]
        self.assertEqual(_first_camp(builds, catalog, "lumberCamps")["atMs"], 180_000)
        self.assertEqual(_first_camp(builds, catalog, "miningCamps")["atMs"], 200_000)
        self.assertEqual(_houses_built(builds, catalog)["count"], 2)
        self.assertEqual(_trade_units_trained(production, catalog)["count"], 2)

    def test_tribute_sent_and_received_normalize_de_and_legacy_payloads(self):
        events = [
            {"replaySlot": 1, "targetReplaySlot": 2, "atMs": 100, "amount": 500, "resourceId": 0, "sourceEventId": "de"},
            {"replaySlot": 1, "targetReplaySlot": 2, "atMs": 200, "food": 100, "wood": 50, "gold": 0, "stone": 0, "sourceEventId": "legacy"},
            {"replaySlot": 2, "targetReplaySlot": 1, "atMs": 300, "amount": 200, "resourceId": 3, "sourceEventId": "back"},
        ]
        sent = _tribute_metric(events, direction="sent", player_id=1)
        received = _tribute_metric(events, direction="received", player_id=1)
        self.assertEqual(sent["resourceAmount"], 650)
        self.assertEqual(sent["commandCount"], 2)
        self.assertEqual(received["resourceAmount"], 200)
        self.assertEqual(received["commandCount"], 1)

    def test_execution_dark_age_boundary_uses_latest_feudal_click(self):
        manifest = {"participants": [{"playerId": 1, "lobbyTeamId": 1}]}
        actions = [
            {"eventId": "a", "operationOrdinal": 1, "actorPlayerId": 1, "timestampMs": 100_000, "sourceActionName": "STANCE", "objectInstanceIds": [], "payload": {}},
            {"eventId": "b", "operationOrdinal": 2, "actorPlayerId": 1, "timestampMs": 150_000, "sourceActionName": "STANCE", "objectInstanceIds": [], "payload": {}},
            {"eventId": "c", "operationOrdinal": 3, "actorPlayerId": 1, "timestampMs": 250_000, "sourceActionName": "STANCE", "objectInstanceIds": [], "payload": {}},
            {"eventId": "d", "operationOrdinal": 4, "actorPlayerId": 1, "timestampMs": 299_000, "sourceActionName": "STANCE", "objectInstanceIds": [], "payload": {}},
            {"eventId": "e", "operationOrdinal": 5, "actorPlayerId": 1, "timestampMs": 301_000, "sourceActionName": "STANCE", "objectInstanceIds": [], "payload": {}},
        ]
        body = {
            "researchEvents": [
                {"replaySlot": 1, "atMs": 200_000, "technologyId": 101, "sourceEventId": "feudal-cancelled"},
                {"replaySlot": 1, "atMs": 300_000, "technologyId": 101, "sourceEventId": "feudal-retry"},
            ]
        }
        result = project_execution_statistics(
            manifest=manifest,
            catalog={"units": {}, "buildings": {}, "technologies": {}},
            initial_objects=[],
            action_events=actions,
            duration_ms=600_000,
            raid_statistics={"1": {"raidEvidence": {"receivedEpisodes": []}}},
            skirmish_statistics={"byPlayer": {"1": []}},
            military_statistics={"1": {"composition": {"siege": 0}}},
            terrain_elevation={},
            build_events=[],
            body=body,
        )["1"]
        self.assertEqual(result["commandsFirstFiveMinutes"]["count"], 4)
        self.assertEqual(result["longestActionGapDarkAge"]["boundaryMs"], 300_000)
        self.assertEqual(result["longestActionGapDarkAge"]["valueMs"], 100_000)
        self.assertEqual(result["longestActionGapDarkAge"]["boundarySourceEventId"], "feudal-retry")

    def test_military_techs_count_distinct_requests_and_exclude_other_categories(self):
        catalog = {
            "technologies": {
                "67": {"id": 67, "name": "Forging", "roleKeys": []},
                "379": {"id": 379, "name": "Hoardings", "roleKeys": []},
                "93": {"id": 93, "name": "Ballistics", "roleKeys": []},
                "202": {"id": 202, "name": "Double-Bit Axe", "roleKeys": []},
                "101": {"id": 101, "name": "Feudal Age", "roleKeys": []},
                "8": {"id": 8, "name": "Town Watch", "roleKeys": []},
            }
        }
        research = [
            {"atMs": 100, "technologyId": 67, "sourceEventId": "forge-cancelled"},
            {"atMs": 200, "technologyId": 67, "sourceEventId": "forge-retry"},
            {"atMs": 300, "technologyId": 379, "sourceEventId": "hoardings"},
            {"atMs": 400, "technologyId": 93, "sourceEventId": "university"},
            {"atMs": 500, "technologyId": 202, "sourceEventId": "eco"},
            {"atMs": 600, "technologyId": 101, "sourceEventId": "age"},
            {"atMs": 700, "technologyId": 8, "sourceEventId": "utility"},
        ]
        result = _military_techs(research, catalog)
        self.assertEqual(result["count"], 2)
        self.assertEqual(result["blacksmithUpgradeCount"], 1)
        self.assertEqual(result["militaryBuildingOrCastleTechCount"], 1)
        self.assertEqual(result["repeatRequestCount"], 1)
        forging = next(row for row in result["technologies"] if row["technology"]["rawId"] == 67)
        self.assertEqual(forging["latestRequestedAtMs"], 200)

    def test_map_presence_keeps_enemy_contact_and_restores_expansion_tcs(self):
        manifest = {
            "participants": [
                {"playerId": 1, "lobbyTeamId": 1},
                {"playerId": 2, "lobbyTeamId": 2},
            ],
            "initialState": {"map": {"width": 120, "height": 120}},
        }
        catalog = {
            "buildings": {
                "109": {"id": 109, "name": "Town Center", "roleKeys": ["town_center", "economy"]},
            },
            "units": {},
            "technologies": {},
        }
        initial = [
            {"eventId": "p1tc", "position": {"x": 10, "y": 10}, "payload": {"ownerPlayerId": 1, "objectId": 109, "instanceId": 101}},
            {"eventId": "p2tc", "position": {"x": 100, "y": 100}, "payload": {"ownerPlayerId": 2, "objectId": 109, "instanceId": 201}},
        ]
        builds = [
            {"replaySlot": 1, "atMs": 800_000, "buildingId": 109, "x": 50, "y": 50, "sourceEventId": "remote-tc"},
        ]
        actions = [
            {"eventId": "contact", "actorPlayerId": 1, "timestampMs": 400_000, "operationOrdinal": 1, "sourceActionName": "MOVE", "position": {"x": 92, "y": 92}, "endPosition": None, "objectInstanceIds": []},
        ]
        result = project_map_presence(
            manifest=manifest,
            catalog=catalog,
            initial_objects=initial,
            build_events=builds,
            wall_events=[],
            action_events=actions,
        )["1"]
        self.assertEqual(result["modelVersion"], "AOF_MAP_PRESENCE_V7")
        self.assertEqual(result["expansionTownCenters"]["count"], 1)
        self.assertEqual(result["expansionTownCenters"]["firstAtMs"], 800_000)
        self.assertEqual(result["enemyBaseContact"]["atMs"], 400_000)
        self.assertEqual(result["enemyBaseContact"]["enemyPlayerId"], 2)


if __name__ == "__main__":
    unittest.main()
