import unittest

from execution_statistics import project_execution_statistics


CATALOG = {
    "units": {
        "83": {"name": "Villager", "roleKeys": ["villager", "economic_unit"]},
    },
    "buildings": {
        "109": {"name": "Town Center", "roleKeys": ["town_center", "economy"]},
        "68": {"name": "Mill", "roleKeys": ["mill", "economy"]},
    },
    "technologies": {
        "202": {"name": "Double-Bit Axe", "roleKeys": []},
    },
}


def event(event_id, actor, at_ms, name, x=None, y=None, selected=(), target=None, payload=None):
    return {
        "eventId": event_id,
        "operationOrdinal": at_ms,
        "actorPlayerId": actor,
        "timestampMs": at_ms,
        "sourceActionName": name,
        "targetInstanceId": target,
        "position": {"x": x, "y": y} if x is not None and y is not None else None,
        "objectInstanceIds": list(selected),
        "payload": payload or {},
    }


class ExecutionStatisticsTests(unittest.TestCase):
    def test_execution_fundamentals_raid_and_skirmish_context(self):
        manifest = {
            "participants": [
                {"playerId": 1, "lobbyTeamId": 1},
                {"playerId": 2, "lobbyTeamId": 2},
            ]
        }
        initial = [
            {
                "eventId": "p1-tc",
                "payload": {"ownerPlayerId": 1, "objectId": 109, "instanceId": 101},
                "position": {"x": 10, "y": 10},
            },
            {
                "eventId": "p1-vill",
                "payload": {"ownerPlayerId": 1, "objectId": 83, "instanceId": 111},
                "position": {"x": 11, "y": 10},
            },
            {
                "eventId": "p2-vill",
                "payload": {"ownerPlayerId": 2, "objectId": 83, "instanceId": 211},
                "position": {"x": 50, "y": 50},
            },
        ]
        actions = [
            event("first", 1, 1_000, "STANCE", selected=(500,)),
            event("patrol-response", 1, 13_000, "PATROL", 11, 10, selected=(500,)),
            event("garrison", 1, 15_000, "ORDER", 10, 10, selected=(111,), target=101),
            event("fight-order", 1, 20_000, "ORDER", 50, 50, selected=(500,), target=211),
            event("eco-research", 1, 22_000, "RESEARCH", selected=(101,), payload={"technology_id": 202}),
            event("retreat", 1, 24_000, "MOVE", 62, 50, selected=(500,)),
            event("attack-ground", 1, 25_000, "ATTACK_GROUND", 52, 50, selected=(500,)),
            event("town-bell", 1, 40_000, "TOWN_BELL", payload={"building_id": 101, "mode": 1}),
            event("enemy-move", 2, 21_000, "MOVE", 51, 50, selected=(600,)),
        ]
        raid_statistics = {
            "1": {
                "raidEvidence": {
                    "receivedEpisodes": [{
                        "attackerPlayerId": 2,
                        "victimPlayerId": 1,
                        "startedAtMs": 10_000,
                        "endedAtMs": 18_000,
                    }]
                }
            },
            "2": {"raidEvidence": {"receivedEpisodes": []}},
        }
        fight = {
            "skirmishId": "skirmish-1",
            "startedAtMs": 20_000,
            "endedAtMs": 26_000,
            "durationMs": 6_000,
            "center": {"x": 50.0, "y": 50.0},
            "participantPlayerIds": [1, 2],
        }
        skirmish_statistics = {"byPlayer": {"1": [fight], "2": [fight]}}
        military = {
            "1": {"composition": {"siege": 2}},
            "2": {"composition": {"siege": 0}},
        }
        width = height = 100
        terrain = [0] * (width * height)
        for x, y in [(50, 50), (62, 50), (52, 50)]:
            terrain[y * width + x] = 2
        terrain[50 * width + 51] = 1

        result = project_execution_statistics(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial,
            action_events=actions,
            duration_ms=60_000,
            raid_statistics=raid_statistics,
            skirmish_statistics=skirmish_statistics,
            military_statistics=military,
            terrain_elevation={"width": width, "height": height, "values": terrain},
            build_events=[],
        )["1"]

        self.assertEqual(result["actionsTotal"], 8)
        self.assertEqual(result["apm"], 8.0)
        self.assertEqual(result["stanceChanges"], 1)
        self.assertEqual(result["patrolCommands"], 1)
        self.assertEqual(result["garrisonCommands"], 1)
        self.assertEqual(result["townBellUses"], 1)
        self.assertEqual(result["garrisonsDuringRaids"], 1)
        self.assertEqual(result["raidResponse"]["averageSeconds"], 3.0)
        self.assertNotIn("fights", result)
        self.assertEqual(result["skirmishContext"]["skirmishIds"], ["skirmish-1"])
        self.assertEqual(result["skirmishContext"]["ecoActions"], 1)
        self.assertEqual(result["skirmishContext"]["disengageMoves"], 1)
        self.assertIsNotNone(result["skirmishContext"]["elevationDelta"])
        self.assertEqual(result["attackGroundPerQueuedSiege"], 0.5)


if __name__ == "__main__":
    unittest.main()
