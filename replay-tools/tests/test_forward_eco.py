import unittest

from forward_eco import FORWARD_ECO_RULE_VERSION, project_forward_eco


def participant(player_id):
    return {
        "playerId": player_id,
        "number": player_id,
        "name": f"Player {player_id}",
        "lobbyTeamId": None,
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


CATALOG = {
    "buildings": {
        "68": {"name": "Mill", "roleKeys": ["mill", "economy"]},
        "109": {"name": "Town Center", "roleKeys": ["town_center", "economy"]},
        "562": {"name": "Lumber Camp", "roleKeys": ["lumber_camp", "economy"]},
        "584": {"name": "Mining Camp", "roleKeys": ["mining_camp", "economy"]},
        "12": {"name": "Barracks", "roleKeys": ["barracks", "military_production"]},
    }
}


class ForwardEcoTests(unittest.TestCase):
    def test_counts_only_forward_eco_buildings_using_map_presence_v4_geometry(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 10),
        ]
        build_events = [
            build("mining", 1, 1_000, 584, 65, 10),
            build("lumber", 1, 2_000, 562, 66, 10),
            build("mill", 1, 3_000, 68, 67, 10),
            build("tc", 1, 4_000, 109, 68, 10),
            build("forward-barracks", 1, 5_000, 12, 69, 10),
            build("eco-not-forward", 1, 6_000, 584, 55, 10),
        ]

        result = project_forward_eco(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=build_events,
        )["1"]

        self.assertEqual(result["ruleVersion"], FORWARD_ECO_RULE_VERSION)
        self.assertEqual(result["layer"], "inferred")
        self.assertEqual(result["count"], 4)
        self.assertEqual(result["firstAtMs"], 1_000)
        self.assertEqual(result["byBuilding"], {
            "Lumber Camp": 1,
            "Mill": 1,
            "Mining Camp": 1,
            "Town Center": 1,
        })
        self.assertEqual(
            [item["sourceEventId"] for item in result["evidence"]],
            ["mining", "lumber", "mill", "tc"],
        )
        self.assertEqual(result["thresholds"]["homeMaximumEnemyProgressPercent"], 35.0)
        self.assertEqual(result["thresholds"]["forwardMinimumEnemyProgressPercent"], 65.0)

    def test_forward_tc_can_independently_be_an_expansion_elsewhere(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 120, "height": 120}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 10),
        ]
        result = project_forward_eco(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=[build("tc", 1, 10_000, 109, 68, 10)],
        )["1"]
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["byBuilding"], {"Town Center": 1})


if __name__ == "__main__":
    unittest.main()
