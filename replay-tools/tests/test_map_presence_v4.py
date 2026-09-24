import unittest

from map_presence_v4 import MAP_PRESENCE_MODEL_VERSION, project_map_presence


def participant(player_id, team=None):
    return {
        "playerId": player_id,
        "number": player_id,
        "name": f"Player {player_id}",
        "lobbyTeamId": team,
    }


def initial(event_id, owner, object_id, instance_id, x, y):
    return {
        "eventId": event_id,
        "position": {"x": x, "y": y},
        "payload": {
            "ownerPlayerId": owner,
            "objectId": object_id,
            "instanceId": instance_id,
        },
    }


def build(event_id, player_id, at_ms, building_id, x, y):
    return {
        "sourceEventId": event_id,
        "replaySlot": player_id,
        "atMs": at_ms,
        "buildingId": building_id,
        "x": x,
        "y": y,
    }


def wall(event_id, player_id, at_ms, building_id, x, y, x_end, y_end):
    return {
        "sourceEventId": event_id,
        "replaySlot": player_id,
        "atMs": at_ms,
        "buildingId": building_id,
        "x": x,
        "y": y,
        "xEnd": x_end,
        "yEnd": y_end,
    }


def action(
    event_id, player_id, at_ms, name, x, y, *,
    selected=(), target=None,
):
    return {
        "eventId": event_id,
        "sourceOperation": "ACTION",
        "sourceActionName": name,
        "actorPlayerId": player_id,
        "timestampMs": at_ms,
        "objectInstanceIds": list(selected),
        "targetInstanceId": target,
        "position": {"x": x, "y": y},
        "endPosition": None,
    }


CATALOG = {
    "units": {
        "448": {"name": "Scout Cavalry", "roleKeys": ["scout_cavalry", "land_military"]},
        "751": {"name": "EAGLE", "roleKeys": []},
        "1755": {"name": "CAMELSC", "roleKeys": []},
    },
    "buildings": {
        "72": {"name": "Palisade Wall", "roleKeys": ["wall", "fortification"]},
        "79": {"name": "Watch Tower", "roleKeys": ["tower", "fortification"]},
        "109": {"name": "Town Center", "roleKeys": ["town_center", "economy"]},
        "117": {"name": "WALL2", "roleKeys": []},
        "562": {"name": "Lumber Camp", "roleKeys": ["lumber_camp", "economy"]},
        "584": {"name": "Mining Camp", "roleKeys": ["mining_camp", "economy"]},
        "12": {"name": "Barracks", "roleKeys": ["barracks", "military_production"]},
    },
}


class MapPresenceV4Tests(unittest.TestCase):
    def test_normalized_forward_geometry_scout_walls_towers_and_camps(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p1-scout", 1, 448, 111, 11, 10),
            initial("p2-tc", 2, 109, 201, 90, 10),
        ]
        builds = [
            build("home-mine", 1, 1_000, 584, 20, 10),
            build("mid-barracks", 1, 2_000, 12, 55, 10),
            build("forward-tower", 1, 3_000, 79, 70, 10),
        ]
        walls = [
            wall("pal", 1, 4_000, 72, 15, 15, 17, 15),
            wall("stone", 1, 5_000, 117, 18, 15, 20, 15),
        ]
        actions = [
            action("scout-1", 1, 20_000, "MOVE", 20, 20, selected=(111,)),
            action("scout-2", 1, 200_000, "MOVE", 45, 20, selected=(111,)),
            action("scout-late", 1, 301_000, "MOVE", 70, 20, selected=(111,)),
            action("non-scout", 1, 100_000, "MOVE", 60, 30, selected=(999,)),
        ]

        p1 = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=builds,
            wall_events=walls,
            action_events=actions,
        )["1"]

        self.assertEqual(p1["modelVersion"], MAP_PRESENCE_MODEL_VERSION)
        self.assertEqual(p1["buildingSectors"]["homeCount"], 1)
        self.assertEqual(p1["buildingSectors"]["midMapCount"], 1)
        self.assertEqual(p1["buildingSectors"]["forwardCount"], 1)
        self.assertEqual(p1["forwardBuildings"]["count"], 1)
        self.assertEqual(p1["forwardBuildings"]["deepest"]["maxEnemyProgressPercent"], 75.0)
        self.assertEqual(
            p1["buildingPlacementRange"]["furthestPlacementFromHomeTownCenterTiles"],
            60.0,
        )

        scout = p1["scoutCoverageAt5Minutes"]
        self.assertEqual(scout["orderCount"], 2)
        self.assertEqual(scout["coveredCellCount"], 2)
        self.assertEqual(scout["startingScoutInstanceIds"], [111])
        self.assertEqual(scout["percent"], 1.18)

        self.assertEqual(p1["wallTiles"]["palisadeWallTiles"], 3)
        self.assertEqual(p1["wallTiles"]["stoneWallTiles"], 3)
        self.assertEqual(p1["wallTiles"]["totalWallTiles"], 6)

        self.assertEqual(p1["towers"]["count"], 1)
        self.assertEqual(p1["towers"]["forwardCount"], 1)
        self.assertEqual(p1["campDistanceFromHomeTownCenter"]["count"], 1)
        self.assertEqual(p1["campDistanceFromHomeTownCenter"]["averageTiles"], 10.0)

    def test_relic_touch_infers_holding_and_enemy_theft_without_monastery_requirement(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 10),
            initial("relic", 0, 285, 301, 50, 50),
        ]
        actions = [
            action("p1-relic", 1, 100_000, "ORDER", 50, 50, target=301),
            action("p2-relic", 2, 200_000, "SPECIAL", 50, 50, target=301),
        ]
        result = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=[],
            wall_events=[],
            action_events=actions,
        )

        p1 = result["1"]["relicControl"]
        p2 = result["2"]["relicControl"]
        self.assertEqual(p1["uniqueRelicsTouched"], 1)
        self.assertEqual(p1["inferredRelicsHeldAtEnd"], 0)
        self.assertEqual(p1["relicsLostToEnemies"], 1)
        self.assertEqual(p2["uniqueRelicsTouched"], 1)
        self.assertEqual(p2["inferredRelicsHeldAtEnd"], 1)
        self.assertEqual(p2["relicsStolenFromEnemies"], 1)

    def test_allied_relic_transfer_is_not_theft(self):
        manifest = {
            "participants": [participant(1, 1), participant(2, 1), participant(3, 2)],
            "initialState": {"map": {"width": 120, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 50, 10),
            initial("p3-tc", 3, 109, 301, 100, 10),
            initial("relic", 0, 285, 401, 40, 40),
        ]
        actions = [
            action("p1", 1, 100_000, "ORDER", 40, 40, target=401),
            action("p2", 2, 200_000, "ORDER", 40, 40, target=401),
        ]
        result = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=[],
            wall_events=[],
            action_events=actions,
        )
        self.assertEqual(result["2"]["relicControl"]["relicsStolenFromEnemies"], 0)
        self.assertEqual(result["2"]["relicControl"]["allyTransfersReceived"], 1)

    def test_gold_is_deposit_weighted_and_tracks_inferred_control_takeovers(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 50),
            initial("p2-tc", 2, 109, 201, 90, 50),
            initial("gold", 0, 66, 501, 50, 50),
        ]
        builds = [
            build("p1-camp", 1, 1_000, 584, 45, 50),
            build("p2-camp", 2, 2_000, 584, 50, 50),
        ]
        result = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=builds,
            wall_events=[],
            action_events=[],
        )
        p1 = result["1"]["goldControl"]
        p2 = result["2"]["goldControl"]
        self.assertEqual(p1["supportedGoldDepositCount"], 1)
        self.assertEqual(p1["takeoversLost"], 1)
        self.assertEqual(p2["takeoversWon"], 1)
        self.assertAlmostEqual(p1["controlSharePercent"], 33.33, places=2)
        self.assertAlmostEqual(p2["controlSharePercent"], 66.67, places=2)
        self.assertEqual(
            p2["clusters"][0]["controlHistory"][-1]["changeType"],
            "enemy_control_takeover",
        )


if __name__ == "__main__":
    unittest.main()
