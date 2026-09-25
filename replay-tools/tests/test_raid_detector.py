import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from raid_detector import RAID_MODEL_VERSION, detect_raids


CATALOG = {
    "buildings": {
        "50": {"roleKeys": ["farm", "economy"]},
        "68": {"roleKeys": ["mill", "economy"]},
        "84": {"roleKeys": ["market", "economy"]},
        "109": {"roleKeys": ["town_center", "economy", "population_production"]},
        "562": {"roleKeys": ["lumber_camp", "economy"]},
        "584": {"roleKeys": ["mining_camp", "economy"]},
    },
    "units": {
        "13": {"name": "Fishing Ship", "roleKeys": ["fishing_ship", "economic_unit", "water_unit"]},
        "17": {"name": "Trade Cog", "roleKeys": ["trade_unit", "economic_unit", "water_unit"]},
        "83": {"name": "Villager", "roleKeys": ["villager", "economic_unit"]},
        "128": {"name": "Trade Cart", "roleKeys": ["trade_unit", "economic_unit"]},
    },
}


def manifest(team_1=1, team_2=2, team_3=3):
    return {
        "participants": [
            {"playerId": 1, "lobbyTeamId": team_1},
            {"playerId": 2, "lobbyTeamId": team_2},
            {"playerId": 3, "lobbyTeamId": team_3},
        ]
    }


def initial_objects(p2=(80, 80), p3=(20, 80)):
    return [
        {
            "eventId": "p1-tc",
            "payload": {"ownerPlayerId": 1, "objectId": 109, "instanceId": 101},
            "position": {"x": 20, "y": 20},
        },
        {
            "eventId": "p2-tc",
            "payload": {"ownerPlayerId": 2, "objectId": 109, "instanceId": 201},
            "position": {"x": p2[0], "y": p2[1]},
        },
        {
            "eventId": "p2-villager",
            "payload": {"ownerPlayerId": 2, "objectId": 83, "instanceId": 222},
            "position": {"x": p2[0] + 1, "y": p2[1]},
        },
        {
            "eventId": "p3-tc",
            "payload": {"ownerPlayerId": 3, "objectId": 109, "instanceId": 301},
            "position": {"x": p3[0], "y": p3[1]},
        },
    ]


def action(event_id, attacker, at_ms, action_name, x, y, target_instance=None, selected=None):
    return {
        "eventId": event_id,
        "sourceOperation": "ACTION",
        "sourceActionName": action_name,
        "actorPlayerId": attacker,
        "targetInstanceId": target_instance,
        "timestampMs": at_ms,
        "position": {"x": x, "y": y},
        "objectInstanceIds": list(selected or [attacker * 1000 + 1, attacker * 1000 + 2]),
    }


def detect(*, game_manifest=None, objects=None, builds=None, actions=None):
    return detect_raids(
        manifest=game_manifest or manifest(),
        catalog=CATALOG,
        initial_objects=objects or initial_objects(),
        build_events=builds or [],
        action_events=actions or [],
    )


class RaidDetectorTests(unittest.TestCase):
    def test_attack_move_inside_specific_enemy_economy_is_directional(self):
        result = detect(actions=[
            action("raid-1", 1, 10 * 60_000, "DE_ATTACK_MOVE", 78, 80),
        ])
        self.assertEqual(result["1"]["raidsInitiated"], 1)
        self.assertEqual(result["1"]["raidsAgainstYou"], 0)
        self.assertEqual(result["2"]["raidsInitiated"], 0)
        self.assertEqual(result["2"]["raidsAgainstYou"], 1)
        self.assertEqual(result["3"]["raidsAgainstYou"], 0)
        episode = result["1"]["raidEvidence"]["initiatedEpisodes"][0]
        self.assertEqual((episode["attackerPlayerId"], episode["victimPlayerId"]), (1, 2))
        self.assertEqual(episode["modelVersion"], RAID_MODEL_VERSION)

    def test_multi_player_victim_is_identified_by_the_zone_attacked(self):
        result = detect(actions=[
            action("raid-p3", 1, 12 * 60_000, "ATTACK_GROUND", 22, 80),
        ])
        self.assertEqual(result["1"]["raidsInitiated"], 1)
        self.assertEqual(result["2"]["raidsAgainstYou"], 0)
        self.assertEqual(result["3"]["raidsAgainstYou"], 1)

    def test_targeted_order_against_known_enemy_object_is_strong_evidence(self):
        result = detect(actions=[
            action("order-vill", 1, 9 * 60_000, "ORDER", 81, 80, target_instance=222),
        ])
        self.assertEqual(result["1"]["raidsInitiated"], 1)
        self.assertEqual(result["2"]["raidsAgainstYou"], 1)
        episode = result["1"]["raidEvidence"]["initiatedEpisodes"][0]
        self.assertIn("economic_target_instance", episode["victimResolutionMethods"])
        self.assertEqual(episode["economicTargetTypes"], ["villager"])

    def test_later_created_target_owner_is_reconstructed_from_prior_control(self):
        result = detect(actions=[
            action("p2-controls-new", 2, 8 * 60_000, "MOVE", 80, 80, selected=[9999]),
            action("p1-targets-new", 1, 9 * 60_000, "ORDER", 80, 80, target_instance=9999),
        ])
        self.assertEqual(result["1"]["raidsInitiated"], 1)
        self.assertEqual(result["2"]["raidsAgainstYou"], 1)
        episode = result["1"]["raidEvidence"]["initiatedEpisodes"][0]
        self.assertIn("target_instance_controller", episode["victimResolutionMethods"])
        self.assertEqual(episode["strongCommandCount"], 1)

    def test_plain_movement_inside_enemy_economy_does_not_create_a_raid(self):
        result = detect(actions=[
            action("move-only", 1, 10 * 60_000, "MOVE", 79, 80),
            action("patrol-only", 1, 10 * 60_000 + 20_000, "PATROL", 78, 80),
        ])
        self.assertEqual(result["1"]["raidsInitiated"], 0)
        self.assertEqual(result["2"]["raidsAgainstYou"], 0)

    def test_supporting_commands_join_a_hostile_episode(self):
        result = detect(actions=[
            action("move", 1, 10 * 60_000, "MOVE", 79, 80),
            action("attack", 1, 10 * 60_000 + 20_000, "DE_ATTACK_MOVE", 78, 80),
            action("patrol", 1, 10 * 60_000 + 40_000, "PATROL", 77, 80),
        ])
        episode = result["1"]["raidEvidence"]["initiatedEpisodes"][0]
        self.assertEqual(result["1"]["raidsInitiated"], 1)
        self.assertEqual(episode["commandCount"], 3)
        self.assertEqual(episode["strongCommandCount"], 1)
        self.assertEqual(episode["supportingCommandCount"], 2)
        self.assertEqual(episode["firstObservedAtMs"], 10 * 60_000)
        self.assertEqual(episode["startedAtMs"], 10 * 60_000 + 20_000)
        self.assertEqual(episode["endedAtMs"], 10 * 60_000 + 40_000)

    def test_commands_within_sixty_seconds_are_one_raid_then_new_episode_after_gap(self):
        result = detect(actions=[
            action("a1", 1, 10 * 60_000, "DE_ATTACK_MOVE", 78, 80),
            action("a2", 1, 10 * 60_000 + 30_000, "ATTACK_GROUND", 79, 80),
            action("a3", 1, 12 * 60_000, "DE_ATTACK_MOVE", 78, 80),
        ])
        self.assertEqual(result["1"]["raidsInitiated"], 2)
        self.assertEqual(result["2"]["raidsAgainstYou"], 2)

    def test_dynamic_economic_building_placement_expands_zone_only_after_placement(self):
        builds = [{
            "replaySlot": 2,
            "atMs": 5 * 60_000,
            "buildingId": 562,
            "x": 50,
            "y": 50,
            "sourceEventId": "p2-lumber-camp",
        }]
        result = detect(builds=builds, actions=[
            action("too-early", 1, 4 * 60_000, "DE_ATTACK_MOVE", 50, 50),
            action("after-camp", 1, 6 * 60_000, "DE_ATTACK_MOVE", 50, 50),
        ])
        self.assertEqual(result["1"]["raidsInitiated"], 1)
        self.assertEqual(result["2"]["raidsAgainstYou"], 1)
        episode = result["1"]["raidEvidence"]["initiatedEpisodes"][0]
        self.assertEqual(episode["startedAtMs"], 6 * 60_000)

    def test_teammate_economic_zone_cannot_be_a_raid_victim(self):
        result = detect(
            game_manifest=manifest(team_1=1, team_2=1, team_3=2),
            actions=[action("ally-attack-move", 1, 10 * 60_000, "DE_ATTACK_MOVE", 78, 80)],
        )
        self.assertEqual(result["1"]["raidsInitiated"], 0)
        self.assertEqual(result["2"]["raidsAgainstYou"], 0)

    def test_ambiguous_overlapping_enemy_zones_are_not_guessed(self):
        objects = initial_objects(p2=(50, 50), p3=(52, 50))
        result = detect(objects=objects, actions=[
            action("ambiguous", 1, 10 * 60_000, "DE_ATTACK_MOVE", 51, 50),
        ])
        self.assertEqual(result["1"]["raidsInitiated"], 0)
        self.assertEqual(result["2"]["raidsAgainstYou"], 0)
        self.assertEqual(result["3"]["raidsAgainstYou"], 0)

    def test_hostile_command_outside_any_economic_zone_is_not_a_raid(self):
        result = detect(actions=[
            action("field-fight", 1, 10 * 60_000, "DE_ATTACK_MOVE", 50, 20),
        ])
        self.assertEqual(result["1"]["raidsInitiated"], 0)
        self.assertEqual(result["2"]["raidsAgainstYou"], 0)
        self.assertEqual(result["3"]["raidsAgainstYou"], 0)


    def test_farms_and_markets_do_not_create_raid_zones(self):
        builds = [
            {
                "replaySlot": 2,
                "atMs": 5 * 60_000,
                "buildingId": 50,
                "x": 50,
                "y": 50,
                "sourceEventId": "p2-farm",
            },
            {
                "replaySlot": 2,
                "atMs": 5 * 60_000,
                "buildingId": 84,
                "x": 52,
                "y": 50,
                "sourceEventId": "p2-market",
            },
        ]
        result = detect(builds=builds, actions=[
            action("farm-area", 1, 6 * 60_000, "DE_ATTACK_MOVE", 50, 50),
            action("market-area", 1, 6 * 60_000 + 20_000, "ATTACK_GROUND", 52, 50),
        ])
        self.assertEqual(result["1"]["raidsInitiated"], 0)
        self.assertEqual(result["2"]["raidsAgainstYou"], 0)

    def test_direct_economic_unit_targets_are_raids_even_outside_land_eco_zones(self):
        objects = initial_objects()
        objects[2]["position"] = {"x": 50, "y": 50}
        objects.extend([
            {
                "eventId": "p2-fishing-ship",
                "payload": {"ownerPlayerId": 2, "objectId": 13, "instanceId": 223},
                "position": {"x": 50, "y": 52},
            },
            {
                "eventId": "p2-trade-cart",
                "payload": {"ownerPlayerId": 2, "objectId": 128, "instanceId": 224},
                "position": {"x": 52, "y": 50},
            },
            {
                "eventId": "p2-trade-cog",
                "payload": {"ownerPlayerId": 2, "objectId": 17, "instanceId": 225},
                "position": {"x": 52, "y": 52},
            },
        ])
        result = detect(objects=objects, actions=[
            action("villager-target", 1, 2 * 60_000, "ORDER", 50, 50, target_instance=222),
            action("fishing-target", 1, 4 * 60_000, "ORDER", 50, 52, target_instance=223),
            action("cart-target", 1, 6 * 60_000, "ORDER", 52, 50, target_instance=224),
            action("cog-target", 1, 8 * 60_000, "ORDER", 52, 52, target_instance=225),
        ])
        self.assertEqual(result["1"]["raidsInitiated"], 4)
        target_types = {
            episode["economicTargetTypes"][0]
            for episode in result["1"]["raidEvidence"]["initiatedEpisodes"]
        }
        self.assertEqual(
            target_types,
            {"villager", "fishing_ship", "trade_cart", "trade_cog"},
        )
        self.assertTrue(all(
            "economic_target_instance" in episode["victimResolutionMethods"]
            for episode in result["1"]["raidEvidence"]["initiatedEpisodes"]
        ))


if __name__ == "__main__":
    unittest.main()
