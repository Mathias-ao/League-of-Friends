import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engagement_statistics import ENGAGEMENT_MODEL_VERSION, project_engagement_statistics
from skirmish_detector import detect_skirmishes


CATALOG = {
    "buildings": {
        "68": {"roleKeys": ["mill", "economy"]},
        "109": {"roleKeys": ["town_center", "economy"]},
        "562": {"roleKeys": ["lumber_camp", "economy"]},
        "584": {"roleKeys": ["mining_camp", "economy"]},
    },
    "units": {},
}


def manifest(*, teams=(1, 2), lock_teams=True):
    participants = [
        {"playerId": index + 1, "lobbyTeamId": team}
        for index, team in enumerate(teams)
    ]
    return {
        "participants": participants,
        "match": {"settings": {"lockTeams": lock_teams}},
        "initialDiplomacy": [],
    }


def initial_objects(player_count=3):
    positions = [(20, 20), (80, 80), (20, 80), (80, 20)]
    return [
        {
            "eventId": f"p{player_id}-tc",
            "payload": {
                "ownerPlayerId": player_id,
                "objectId": 109,
                "instanceId": player_id * 100 + 1,
            },
            "position": {"x": positions[player_id - 1][0], "y": positions[player_id - 1][1]},
        }
        for player_id in range(1, player_count + 1)
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


def empty_raids(player_count):
    return {
        str(player_id): {"raidEvidence": {"initiatedEpisodes": [], "receivedEpisodes": []}}
        for player_id in range(1, player_count + 1)
    }


def project(*, game_manifest, actions, objects=None):
    objects = objects or initial_objects(len(game_manifest["participants"]))
    skirmishes = detect_skirmishes(
        manifest=game_manifest,
        initial_objects=objects,
        action_events=actions,
    )
    return project_engagement_statistics(
        manifest=game_manifest,
        catalog=CATALOG,
        initial_objects=objects,
        build_events=[],
        action_events=actions,
        skirmish_statistics=skirmishes,
        raid_statistics=empty_raids(len(game_manifest["participants"])),
    )


class EngagementStatisticsV2Tests(unittest.TestCase):
    def test_skirmish_is_player_facing_and_opposing_response_promotes_battle(self):
        result = project(
            game_manifest=manifest(teams=(1, 2)),
            actions=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
                action("p2-move-response", 2, 12_000, "MOVE", 51, 50),
            ],
            objects=initial_objects(2),
        )
        self.assertEqual(result["1"]["engagementModelVersion"], ENGAGEMENT_MODEL_VERSION)
        self.assertEqual(result["1"]["skirmishes"], 1)
        self.assertEqual(result["2"]["skirmishes"], 1)
        self.assertEqual(result["1"]["battlesFought"], 1)
        battle = result["1"]["engagementEvidence"]["battles"][0]
        self.assertEqual(battle["participantPlayerIds"], [1, 2])
        self.assertEqual(battle["sourceSkirmishId"], "skirmish-1")

    def test_one_sided_targeted_episode_stays_skirmish_not_battle(self):
        objects = initial_objects(2)
        result = project(
            game_manifest=manifest(teams=(1, 2)),
            actions=[
                action("p1-target", 1, 10_000, "ORDER", 80, 80, target=201),
            ],
            objects=objects,
        )
        self.assertEqual(result["1"]["skirmishes"], 1)
        self.assertEqual(result["2"]["skirmishes"], 1)
        self.assertEqual(result["1"]["battlesFought"], 0)
        self.assertEqual(result["2"]["battlesFought"], 0)

    def test_relationship_summary_tracks_actual_opponent_pair(self):
        result = project(
            game_manifest=manifest(teams=(1, 2, 1)),
            actions=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
                action("p3-pressure", 3, 11_000, "DE_ATTACK_MOVE", 68, 50),
                action("p2-response", 2, 12_000, "MOVE", 51, 50),
            ],
        )
        p1 = result["1"]["relationshipInteractionSummary"]
        p3 = result["3"]["relationshipInteractionSummary"]
        self.assertEqual([row["opponentPlayerId"] for row in p1], [2])
        self.assertEqual(p3, [])
        self.assertEqual(p1[0]["skirmishesTogether"], 1)
        self.assertEqual(p1[0]["battlesTogether"], 1)

    def test_ally_metrics_are_na_in_one_v_one(self):
        result = project(
            game_manifest=manifest(teams=(1, 2), lock_teams=True),
            actions=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
                action("p2-response", 2, 12_000, "MOVE", 51, 50),
            ],
            objects=initial_objects(2),
        )
        p1 = result["1"]
        self.assertEqual(p1["allyInteractionApplicability"]["status"], "not_applicable")
        self.assertIsNone(p1["allyReinforcementsSent"])
        self.assertIsNone(p1["defensiveAssistsGiven"])
        self.assertIsNone(p1["cooperativeAttacks"])

    def test_ally_metrics_are_na_in_locked_ffa(self):
        result = project(
            game_manifest=manifest(teams=(None, None, None), lock_teams=True),
            actions=[],
        )
        p1 = result["1"]
        self.assertEqual(p1["allyInteractionApplicability"]["status"], "not_applicable")
        self.assertIn("locked_diplomacy", p1["allyInteractionApplicability"]["reason"])
        self.assertIsNone(p1["allyReinforcementsReceived"])

    def test_diplomacy_ffa_is_pending_not_false_zero(self):
        result = project(
            game_manifest=manifest(teams=(None, None, None), lock_teams=False),
            actions=[],
        )
        p1 = result["1"]
        self.assertEqual(p1["allyInteractionApplicability"]["status"], "pending_relation_semantics")
        self.assertIsNone(p1["allyReinforcementsSent"])
        self.assertIsNone(p1["defensiveAssistsReceived"])
        self.assertIsNone(p1["cooperativeAttacks"])

    def test_fixed_team_defensive_assistance_stays_base_bound(self):
        result = project(
            game_manifest=manifest(teams=(1, 2, 2), lock_teams=True),
            actions=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 80, 80),
                action("p2-response", 2, 11_000, "MOVE", 80, 81),
                action("p3-help", 3, 13_000, "DE_ATTACK_MOVE", 79, 80),
            ],
        )
        self.assertEqual(result["3"]["defensiveAssistsGiven"], 1)
        assist = result["3"]["engagementEvidence"]["defensiveAssistsGiven"][0]
        self.assertEqual((assist["helperPlayerId"], assist["defendedPlayerId"]), (3, 2))

    def test_cooperative_attack_requires_pairwise_shared_target(self):
        result = project(
            game_manifest=manifest(teams=(1, 1, 2), lock_teams=True),
            actions=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 20, 80),
                action("p2-attack", 2, 11_000, "DE_ATTACK_MOVE", 21, 80),
                action("p3-response", 3, 12_000, "MOVE", 20, 81),
            ],
        )
        self.assertEqual(result["1"]["cooperativeAttacks"], 1)
        event = result["1"]["engagementEvidence"]["cooperativeAttacks"][0]
        self.assertEqual(event["attackerPlayerIds"], [1, 2])
        self.assertEqual(event["targetPlayerIds"], [3])

    def test_great_battle_remains_conservative(self):
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
            game_manifest=manifest(teams=(1, 2)),
            actions=actions,
            objects=initial_objects(2),
        )
        battle = result["1"]["engagementEvidence"]["battles"][0]
        self.assertTrue(battle["greatBattle"])
        self.assertEqual(result["1"]["greatBattlesFought"], 1)


if __name__ == "__main__":
    unittest.main()
