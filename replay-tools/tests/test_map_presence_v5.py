import unittest

from map_presence_v5 import MAP_PRESENCE_MODEL_VERSION, project_map_presence


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


def action(event_id, player_id, at_ms, name, x, y, *, selected=()):
    return {
        "eventId": event_id,
        "sourceOperation": "ACTION",
        "sourceActionName": name,
        "actorPlayerId": player_id,
        "timestampMs": at_ms,
        "objectInstanceIds": list(selected),
        "targetInstanceId": None,
        "position": {"x": x, "y": y},
        "endPosition": None,
    }


CATALOG = {
    "units": {
        "448": {"name": "Scout Cavalry", "roleKeys": ["scout_cavalry", "land_military"]},
        "900": {"name": "Unknown Starting Rider", "roleKeys": ["land_military", "cavalry"]},
    },
    "buildings": {
        "12": {"name": "Barracks", "roleKeys": ["barracks", "military_production"]},
        "68": {"name": "Mill", "roleKeys": ["mill", "economy"]},
        "82": {"name": "Castle", "roleKeys": ["castle", "fortification"]},
        "84": {"name": "Market", "roleKeys": ["market", "economy"]},
        "109": {"name": "Town Center", "roleKeys": ["town_center", "economy"]},
        "562": {"name": "Lumber Camp", "roleKeys": ["lumber_camp", "economy"]},
        "584": {"name": "Mining Camp", "roleKeys": ["mining_camp", "economy"]},
    },
}


class MapPresenceV5Tests(unittest.TestCase):
    def test_scout_coverage_rasterizes_buffered_command_route(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p1-scout", 1, 448, 111, 11, 10),
            initial("p2-tc", 2, 109, 201, 90, 10),
        ]
        actions = [
            action("scout-1", 1, 20_000, "MOVE", 30, 20, selected=(111,)),
            action("scout-2", 1, 200_000, "MOVE", 55, 35, selected=(111,)),
        ]
        p1 = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=[],
            wall_events=[],
            action_events=actions,
        )["1"]

        scout = p1["scoutCoverageAt5Minutes"]
        self.assertEqual(p1["modelVersion"], MAP_PRESENCE_MODEL_VERSION)
        self.assertEqual(scout["candidateDetectionMethod"], "explicit_scout_identity")
        self.assertEqual(scout["orderCount"], 2)
        self.assertGreater(scout["coveredTileCount"], scout["routeTileCount"])
        self.assertGreater(scout["percent"], 2.0)

    def test_behavioral_starting_unit_fallback_can_recover_unlabelled_scout(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p1-rider", 1, 900, 112, 11, 10),
            initial("p2-tc", 2, 109, 201, 90, 10),
        ]
        actions = [
            action("move-1", 1, 10_000, "MOVE", 25, 20, selected=(112,)),
            action("move-2", 1, 40_000, "MOVE", 45, 25, selected=(112,)),
        ]
        p1 = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=[],
            wall_events=[],
            action_events=actions,
        )["1"]
        scout = p1["scoutCoverageAt5Minutes"]
        self.assertEqual(scout["candidateDetectionMethod"], "behavioral_starting_unit_fallback")
        self.assertEqual(scout["startingScoutInstanceIds"], [112])
        self.assertEqual(scout["orderCount"], 2)
        self.assertGreater(scout["percent"], 0.0)

    def test_eco_camps_include_mill_lumber_and_mining(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 10),
        ]
        builds = [
            build("mill", 1, 1_000, 68, 15, 10),
            build("lumber", 1, 2_000, 562, 20, 10),
            build("mine", 1, 3_000, 584, 25, 10),
            build("barracks", 1, 4_000, 12, 30, 10),
        ]
        p1 = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=builds,
            wall_events=[],
            action_events=[],
        )["1"]
        camps = p1["ecoCampDistanceFromHomeTownCenter"]
        self.assertEqual(camps["count"], 3)
        self.assertEqual(set(camps["byBuilding"]), {"Lumber Camp", "Mill", "Mining Camp"})

    def test_remote_eligible_buildings_cluster_into_expansion_zones(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p2-tc", 2, 109, 201, 90, 10),
        ]
        builds = [
            build("near-home-mill", 1, 500, 68, 15, 10),
            build("home-side-mine", 1, 1_000, 584, 30, 10),
            build("same-zone-market", 1, 2_000, 84, 38, 10),
            build("forward-castle", 1, 3_000, 82, 70, 10),
            build("production-not-zone", 1, 4_000, 12, 72, 10),
        ]
        p1 = project_map_presence(
            manifest=manifest,
            catalog=CATALOG,
            initial_objects=initial_objects,
            build_events=builds,
            wall_events=[],
            action_events=[],
        )["1"]
        zones = p1["expansionZones"]
        self.assertEqual(zones["count"], 2)
        self.assertEqual(zones["eligibleRemoteBuildingCount"], 3)
        self.assertEqual(zones["eligibleBuildingPlacementsInsideHomeRadius"], 1)
        self.assertEqual(zones["bySector"]["home"], 1)
        self.assertEqual(zones["bySector"]["forward"], 1)
        self.assertEqual(zones["zones"][0]["buildingCount"], 2)
        self.assertEqual(zones["zones"][1]["byBuilding"], {"Castle": 1})
        self.assertEqual(p1["forwardBuildings"]["count"], 2)


if __name__ == "__main__":
    unittest.main()
