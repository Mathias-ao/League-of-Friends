import unittest

from map_presence import MAP_PRESENCE_MODEL_VERSION, project_map_presence


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


class MapPresenceTests(unittest.TestCase):
    def test_all_player_facing_map_presence_outputs(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
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
            build("p1-expansion", 1, 10_000, 109, 30, 30),
            build("p1-forward", 1, 12_000, 12, 55, 55),
        ]
        actions = [
            action("p1-home-command", 1, 1_000, "MOVE", 5, 5),
            action("p1-enemy-contact", 1, 20_000, "DE_ATTACK_MOVE", 90, 90),
            action("p1-relic-touch", 1, 21_000, "ORDER", 40, 40, target=401),
        ]

        result = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=build_events,
            action_events=actions,
        )
        p1 = result["1"]
        p2 = result["2"]

        self.assertEqual(p1["modelVersion"], MAP_PRESENCE_MODEL_VERSION)
        self.assertEqual(p1["forwardBuildings"]["count"], 1)
        self.assertEqual(p1["forwardBuildings"]["byBuilding"], {"Barracks": 1})
        self.assertEqual(p1["expansions"]["count"], 1)
        self.assertEqual(p1["expansions"]["firstAtMs"], 10_000)
        self.assertEqual(p1["enemyBaseFound"]["atMs"], 20_000)
        self.assertEqual(p1["enemyBaseFound"]["enemyPlayerId"], 2)
        self.assertEqual(p1["firstRelicTouch"]["atMs"], 21_000)
        self.assertEqual(p1["firstRelicTouch"]["relicInstanceId"], 401)
        self.assertEqual(p1["commandMapCoverage"]["coveredCellCount"], 3)
        self.assertEqual(p1["commandMapCoverage"]["totalCellCount"], 169)
        self.assertEqual(p1["commandMapCoverage"]["percent"], 1.78)
        self.assertEqual(p1["goldControl"]["goldClusterCount"], 3)
        self.assertEqual(p1["goldControl"]["controlSharePercent"], 66.67)
        self.assertEqual(p2["goldControl"]["controlSharePercent"], 33.33)

    def test_enemy_base_contact_is_discarded_when_multiplayer_victim_is_ambiguous(self):
        manifest = {
            "participants": [participant(1), participant(2), participant(3)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 50, 50),
            initial("p3-tc", 3, 109, 301, 52, 50),
        ]
        actions = [action("ambiguous", 1, 10_000, "DE_ATTACK_MOVE", 51, 50)]

        result = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=[],
            action_events=actions,
        )
        self.assertIsNone(result["1"]["enemyBaseFound"]["atMs"])
        self.assertIsNone(result["1"]["enemyBaseFound"]["enemyPlayerId"])

    def test_move_only_does_not_find_enemy_base(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 90),
        ]
        actions = [action("move", 1, 10_000, "MOVE", 90, 90)]

        result = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=[],
            action_events=actions,
        )
        self.assertIsNone(result["1"]["enemyBaseFound"]["atMs"])

    def test_relic_touch_is_not_inferred_from_drop_relic(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 90),
            initial("relic", 0, 285, 401, 40, 40),
        ]
        actions = [action("drop", 1, 10_000, "DROP_RELIC", 40, 40, target=401)]

        result = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=[],
            action_events=actions,
        )
        self.assertIsNone(result["1"]["firstRelicTouch"]["atMs"])


if __name__ == "__main__":
    unittest.main()
