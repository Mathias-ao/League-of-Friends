import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engagement_statistics import ENGAGEMENT_MODEL_VERSION, project_engagement_statistics


CATALOG = {
    "buildings": {
        "68": {"roleKeys": ["mill", "economy"]},
        "109": {"roleKeys": ["town_center", "economy"]},
        "562": {"roleKeys": ["lumber_camp", "economy"]},
        "584": {"roleKeys": ["mining_camp", "economy"]},
    },
    "units": {},
}


def manifest(team_1=1, team_2=2, team_3=2):
    return {
        "participants": [
            {"playerId": 1, "lobbyTeamId": team_1},
            {"playerId": 2, "lobbyTeamId": team_2},
            {"playerId": 3, "lobbyTeamId": team_3},
        ]
    }


def initial_objects():
    return [
        {
            "eventId": "p1-tc",
            "payload": {"ownerPlayerId": 1, "objectId": 109, "instanceId": 101},
            "position": {"x": 20, "y": 20},
        },
        {
            "eventId": "p2-tc",
            "payload": {"ownerPlayerId": 2, "objectId": 109, "instanceId": 201},
            "position": {"x": 80, "y": 80},
        },
        {
            "eventId": "p3-tc",
            "payload": {"ownerPlayerId": 3, "objectId": 109, "instanceId": 301},
            "position": {"x": 20, "y": 80},
        },
    ]


def action(event_id, actor, at_ms, name, x, y, selected=None, target=None):
    return {
        "eventId": event_id,
        "operationOrdinal": at_ms,
        "actorPlayerId": actor,
        "timestampMs": at_ms,
        "sourceActionName": name,
        "targetInstanceId": target,
        "position": {"x": x, "y": y},
        "objectInstanceIds": list(selected or [actor * 1000 + 1]),
    }


def fight(start, end, x, y, fight_id="fight-1"):
    return {
        "fightId": fight_id,
        "startedAtMs": start,
        "endedAtMs": end,
        "center": {"x": x, "y": y},
    }


def empty_raids():
    return {
        str(player_id): {"raidEvidence": {"initiatedEpisodes": [], "receivedEpisodes": []}}
        for player_id in (1, 2, 3)
    }


def project(*, game_manifest=None, objects=None, actions=None, fights=None):
    return project_engagement_statistics(
        manifest=game_manifest or manifest(),
        catalog=CATALOG,
        initial_objects=objects or initial_objects(),
        build_events=[],
        action_events=actions or [],
        fight_statistics={"episodes": fights or []},
        raid_statistics=empty_raids(),
    )


class EngagementStatisticsTests(unittest.TestCase):
    def test_battle_requires_reciprocal_hostile_command_contribution(self):
        one_sided = project(
            actions=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
                action("p2-move", 2, 12_000, "MOVE", 51, 50),
            ],
            fights=[fight(9_000, 15_000, 50, 50)],
        )
        self.assertEqual(one_sided["1"]["battlesFought"], 0)
        self.assertEqual(one_sided["2"]["battlesFought"], 0)

        reciprocal = project(
            actions=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
                action("p2-patrol", 2, 12_000, "PATROL", 51, 50),
            ],
            fights=[fight(9_000, 15_000, 50, 50)],
        )
        self.assertEqual(reciprocal["1"]["battlesFought"], 1)
        self.assertEqual(reciprocal["2"]["battlesFought"], 1)
        battle = reciprocal["1"]["engagementEvidence"]["battles"][0]
        self.assertEqual(battle["participantPlayerIds"], [1, 2])
        self.assertEqual(battle["modelVersion"], ENGAGEMENT_MODEL_VERSION)

    def test_defensive_assistance_requires_defended_ally_base(self):
        at_base = project(
            actions=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 80, 80),
                action("p2-patrol", 2, 11_000, "PATROL", 80, 81),
                action("p3-help", 3, 13_000, "DE_ATTACK_MOVE", 79, 80),
            ],
            fights=[fight(9_000, 18_000, 80, 80)],
        )
        self.assertEqual(at_base["3"]["defensiveAssistsGiven"], 1)
        assist = at_base["3"]["engagementEvidence"]["defensiveAssistsGiven"][0]
        self.assertEqual((assist["helperPlayerId"], assist["defendedPlayerId"]), (3, 2))
        self.assertEqual(at_base["3"]["cooperativeAttacks"], 0)

        neutral = project(
            actions=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
                action("p2-patrol", 2, 11_000, "PATROL", 50, 51),
                action("p3-help", 3, 13_000, "DE_ATTACK_MOVE", 49, 50),
            ],
            fights=[fight(9_000, 18_000, 50, 50)],
        )
        self.assertEqual(neutral["3"]["defensiveAssistsGiven"], 0)

    def test_standalone_reinforcement_only_counts_inside_supported_ally_base(self):
        result = project(
            actions=[
                action("p3-reinforce-1", 3, 10_000, "PATROL", 80, 80, selected=[3001, 3002, 3003]),
                action("p3-reinforce-2", 3, 15_000, "DE_ATTACK_MOVE", 81, 80, selected=[3001, 3002, 3003]),
                action("p3-neutral-1", 3, 90_000, "PATROL", 50, 50, selected=[3010, 3011, 3012]),
                action("p3-neutral-2", 3, 95_000, "DE_ATTACK_MOVE", 51, 50, selected=[3010, 3011, 3012]),
            ],
        )
        self.assertEqual(result["3"]["allyReinforcementsSent"], 1)
        self.assertEqual(result["2"]["allyReinforcementsReceived"], 1)
        episode = result["3"]["engagementEvidence"]["allyReinforcementsSent"][0]
        self.assertEqual(episode["supportedPlayerId"], 2)

    def test_cooperative_attack_is_offensive_not_own_base_defense(self):
        result = project(
            game_manifest=manifest(team_1=1, team_2=1, team_3=2),
            actions=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 20, 80),
                action("p2-attack", 2, 12_000, "DE_ATTACK_MOVE", 21, 80),
                action("p3-defend", 3, 13_000, "PATROL", 20, 81),
            ],
            fights=[fight(9_000, 18_000, 20, 80)],
        )
        self.assertEqual(result["1"]["cooperativeAttacks"], 1)
        self.assertEqual(result["2"]["cooperativeAttacks"], 1)
        event = result["1"]["engagementEvidence"]["cooperativeAttacks"][0]
        self.assertEqual(event["attackerPlayerIds"], [1, 2])
        self.assertEqual(event["targetPlayerIds"], [3])
        self.assertEqual(event["locationContext"], "enemy_base")
        self.assertEqual(result["1"]["defensiveAssistsGiven"], 0)
        self.assertEqual(result["2"]["defensiveAssistsGiven"], 0)

    def test_great_battle_requires_unmistakable_scale(self):
        actions = []
        p1_ids = list(range(1000, 1030))
        p2_ids = list(range(2000, 2030))
        for index, at_ms in enumerate((0, 20_000, 40_000)):
            actions.append(action(
                f"p1-{index}", 1, at_ms, "DE_ATTACK_MOVE", 50, 50, selected=p1_ids,
            ))
        for index, at_ms in enumerate((10_000, 30_000, 50_000)):
            actions.append(action(
                f"p2-{index}", 2, at_ms, "DE_ATTACK_MOVE", 51, 50, selected=p2_ids,
            ))
        result = project(
            actions=actions,
            fights=[fight(0, 55_000, 50, 50)],
        )
        battle = result["1"]["engagementEvidence"]["battles"][0]
        self.assertTrue(battle["greatBattle"])
        self.assertEqual(battle["distinctSelectedObjectCount"], 60)
        self.assertEqual(result["1"]["greatBattlesFought"], 1)


if __name__ == "__main__":
    unittest.main()
