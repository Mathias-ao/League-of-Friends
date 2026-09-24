import unittest

from map_presence_v3 import MAP_PRESENCE_MODEL_VERSION, project_map_presence


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


def action(event_id, player_id, at_ms, name, x, y):
    return {
        "eventId": event_id,
        "sourceOperation": "ACTION",
        "sourceActionName": name,
        "actorPlayerId": player_id,
        "timestampMs": at_ms,
        "position": {"x": x, "y": y},
        "endPosition": None,
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


class MapPresenceV3Tests(unittest.TestCase):
    def test_spread_forward_depth_and_enemy_side_presence(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 10),
        ]
        builds = [
            build("home-mine", 1, 1_000, 584, 20, 10),
            build("forward-barracks", 1, 2_000, 12, 55, 10),
            build("deeper-tower", 1, 3_000, 79, 70, 20),
            build("expansion", 1, 4_000, 109, 45, 45),
        ]
        actions = [
            action("home", 1, 5_000, "MOVE", 20, 10),
            action("midpoint", 1, 6_000, "MOVE", 50, 10),
            action("enemy-side", 1, 7_000, "MOVE", 60, 10),
        ]

        result = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=builds,
            action_events=actions,
        )
        p1 = result["1"]

        self.assertEqual(p1["modelVersion"], MAP_PRESENCE_MODEL_VERSION)
        self.assertEqual(p1["homeAnchor"]["method"], "initial_town_center")
        self.assertEqual(p1["forwardBuildings"]["count"], 2)
        self.assertEqual(p1["forwardBuildings"]["byCategory"], {
            "defensive": 1,
            "militaryProduction": 1,
        })
        self.assertAlmostEqual(
            p1["forwardBuildings"]["deepest"]["maxEnemyDistanceAdvantageTiles"],
            38.47,
            places=2,
        )
        self.assertEqual(p1["expansionTownCenters"]["count"], 1)
        self.assertEqual(p1["enemySideCommandPresence"]["classifiedCommandEvents"], 3)
        self.assertEqual(p1["enemySideCommandPresence"]["enemySideCommandEvents"], 1)
        self.assertEqual(p1["enemySideCommandPresence"]["percent"], 33.33)
        self.assertEqual(p1["enemySideCommandPresence"]["byEnemy"], {"2": 1})
        self.assertAlmostEqual(
            p1["buildingSpread"]["maxDistanceFromHomeTownCenterTiles"],
            60.83,
            places=2,
        )
        self.assertGreaterEqual(
            p1["buildingSpread"]["maxPairwiseDistanceTiles"],
            p1["buildingSpread"]["maxDistanceFromHomeTownCenterTiles"],
        )

    def test_enemy_side_presence_excludes_teammates(self):
        manifest = {
            "participants": [participant(1, 1), participant(2, 1), participant(3, 2)],
            "initialState": {"map": {"width": 120, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 50, 10),
            initial("p3-tc", 3, 109, 301, 100, 10),
        ]
        actions = [
            action("near-ally", 1, 1_000, "MOVE", 50, 10),
            action("enemy-side", 1, 2_000, "MOVE", 70, 10),
        ]

        result = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=[],
            action_events=actions,
        )
        presence = result["1"]["enemySideCommandPresence"]
        self.assertEqual(presence["classifiedCommandEvents"], 2)
        self.assertEqual(presence["enemySideCommandEvents"], 1)
        self.assertEqual(presence["byEnemy"], {"3": 1})

    def test_building_spread_is_unavailable_without_starting_tc_anchor(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        result = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=[],
            build_events=[build("b", 1, 1_000, 12, 50, 50)],
            action_events=[],
        )
        self.assertIsNone(result["1"]["buildingSpread"]["maxPairwiseDistanceTiles"])
        self.assertIsNone(result["1"]["enemySideCommandPresence"]["percent"])


if __name__ == "__main__":
    unittest.main()
