import unittest

from map_presence_v2 import MAP_PRESENCE_MODEL_VERSION, project_map_presence


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


def action(event_id, player_id, at_ms, name, x, y, target=None, x_end=None, y_end=None):
    return {
        "eventId": event_id,
        "sourceOperation": "ACTION",
        "sourceActionName": name,
        "actorPlayerId": player_id,
        "targetInstanceId": target,
        "timestampMs": at_ms,
        "position": {"x": x, "y": y},
        "endPosition": (
            {"x": x_end, "y": y_end}
            if x_end is not None and y_end is not None
            else None
        ),
    }


CATALOG = {
    "buildings": {
        "109": {"name": "Town Center", "roleKeys": ["town_center", "economy"]},
        "584": {"name": "Mining Camp", "roleKeys": ["mining_camp", "economy"]},
        "12": {"name": "Barracks", "roleKeys": ["barracks", "military_production"]},
        "79": {"name": "Watch Tower", "roleKeys": ["tower", "fortification"]},
        "82": {"name": "Castle", "roleKeys": []},
    }
}


def manifest(players=2):
    return {
        "participants": [participant(player_id) for player_id in range(1, players + 1)],
        "initialState": {"map": {"width": 100, "height": 100}},
    }


class MapPresenceV2Tests(unittest.TestCase):
    def test_all_player_facing_outputs_use_v2_geometry(self):
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 90),
            initial("g1a", 0, 66, 301, 20, 20),
            initial("g1b", 0, 66, 302, 22, 20),
            initial("g2a", 0, 66, 303, 49, 50),
            initial("g2b", 0, 66, 304, 51, 50),
            initial("g3a", 0, 66, 305, 84, 85),
            initial("g3b", 0, 66, 306, 86, 85),
            initial("relic", 0, 285, 401, 40, 40),
        ]
        build_events = [
            build("p2-castle", 2, 8_000, 82, 85, 85),
            build("p1-mining", 1, 9_000, 584, 20, 20),
            build("p1-expansion", 1, 10_000, 109, 35, 35),
            build("p1-forward", 1, 12_000, 12, 65, 65),
        ]
        actions = [
            action("p1-home-command", 1, 1_000, "MOVE", 5, 5),
            action("p1-enemy-found", 1, 20_000, "MOVE", 81, 81),
            action("p1-relic-touch", 1, 21_000, "ORDER", 40, 40, target=401),
        ]

        result = project_map_presence(
            manifest=manifest(), catalog=CATALOG, initial_objects=initial_objects,
            build_events=build_events, action_events=actions,
        )
        p1, p2 = result["1"], result["2"]

        self.assertEqual(p1["modelVersion"], MAP_PRESENCE_MODEL_VERSION)
        self.assertEqual(p1["forwardBuildings"]["count"], 1)
        self.assertEqual(p1["forwardBuildings"]["byBuilding"], {"Barracks": 1})
        self.assertEqual(p1["expansions"]["count"], 1)
        self.assertEqual(p1["expansions"]["firstAtMs"], 10_000)
        self.assertEqual(p1["enemyBaseFound"]["atMs"], 20_000)
        self.assertEqual(p1["enemyBaseFound"]["enemyPlayerId"], 2)
        self.assertEqual(p1["enemyBaseFound"]["evidence"]["sourceActionName"], "MOVE")
        self.assertEqual(p1["firstRelicTouch"]["atMs"], 21_000)
        self.assertEqual(p1["commandMapCoverage"]["coveredCellCount"], 3)
        self.assertEqual(p1["goldControl"]["goldClusterCount"], 3)
        self.assertEqual(p1["goldControl"]["controlSharePercent"], 33.33)
        self.assertEqual(p2["goldControl"]["controlSharePercent"], 33.33)

    def test_enemy_base_found_requires_proximity_not_hostility(self):
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 90),
        ]
        actions = [
            action("outside", 1, 5_000, "DE_ATTACK_MOVE", 75, 75),
            action("inside", 1, 10_000, "MOVE", 81, 81),
        ]
        result = project_map_presence(
            manifest=manifest(), catalog=CATALOG, initial_objects=initial_objects,
            build_events=[], action_events=actions,
        )
        found = result["1"]["enemyBaseFound"]
        self.assertEqual(found["atMs"], 10_000)
        self.assertEqual(found["evidence"]["sourceActionName"], "MOVE")
        self.assertLessEqual(found["evidence"]["distanceToEnemyTownCenterTiles"], 14.0)

    def test_enemy_base_found_discards_ambiguous_multiplayer_tc_proximity(self):
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 50, 50),
            initial("p3-tc", 3, 109, 301, 52, 50),
        ]
        result = project_map_presence(
            manifest=manifest(3), catalog=CATALOG, initial_objects=initial_objects,
            build_events=[], action_events=[action("ambiguous", 1, 10_000, "MOVE", 51, 50)],
        )
        self.assertIsNone(result["1"]["enemyBaseFound"]["atMs"])

    def test_forward_building_requires_enemy_within_40_and_six_tile_advantage(self):
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 10),
        ]
        builds = [
            build("qualifies", 1, 1_000, 12, 55, 10),
            build("too-far", 1, 2_000, 12, 49, 10),
            build("not-enough-advantage", 1, 3_000, 12, 51, 10),
        ]
        result = project_map_presence(
            manifest=manifest(), catalog=CATALOG, initial_objects=initial_objects,
            build_events=builds, action_events=[],
        )
        forward = result["1"]["forwardBuildings"]
        self.assertEqual(forward["count"], 1)
        self.assertEqual(forward["evidence"][0]["sourceEventId"], "qualifies")
        self.assertEqual(forward["thresholds"]["maximumEnemyTownCenterDistanceTiles"], 40.0)
        self.assertEqual(forward["thresholds"]["minimumEnemyDistanceAdvantageTiles"], 6.0)

    def test_expansion_requires_30_tiles_from_starting_tc(self):
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 90),
        ]
        builds = [
            build("inside", 1, 1_000, 109, 39, 10),
            build("boundary", 1, 2_000, 109, 40, 10),
        ]
        result = project_map_presence(
            manifest=manifest(), catalog=CATALOG, initial_objects=initial_objects,
            build_events=builds, action_events=[],
        )
        expansions = result["1"]["expansions"]
        self.assertEqual(expansions["count"], 1)
        self.assertEqual(expansions["hubs"][0]["sourceEventId"], "boundary")
        self.assertEqual(expansions["thresholds"]["minimumHomeTownCenterDistanceTiles"], 30.0)


if __name__ == "__main__":
    unittest.main()
