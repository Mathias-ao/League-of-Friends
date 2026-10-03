import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fight_detector import detect_fights
from skirmish_detector import (
    SKIRMISH_COMPATIBILITY_BASIS,
    SKIRMISH_MODEL_VERSION,
    detect_skirmishes,
)


def manifest(team_1=1, team_2=2, team_3=None):
    participants = [
        {"playerId": 1, "lobbyTeamId": team_1},
        {"playerId": 2, "lobbyTeamId": team_2},
    ]
    if team_3 is not None:
        participants.append({"playerId": 3, "lobbyTeamId": team_3})
    return {"participants": participants}


def initial_objects():
    return [
        {
            "eventId": "p1-vill",
            "payload": {"ownerPlayerId": 1, "objectId": 83, "instanceId": 101},
            "position": {"x": 20, "y": 20},
        },
        {
            "eventId": "p2-vill",
            "payload": {"ownerPlayerId": 2, "objectId": 83, "instanceId": 201},
            "position": {"x": 50, "y": 50},
        },
    ]


def action(event_id, actor, at_ms, name, x, y, target=None, selected=None):
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


class SkirmishDetectorTests(unittest.TestCase):
    def test_skirmish_episode_formation_is_exact_legacy_fight_rename(self):
        actions = [
            action("p1-attack-a", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
            action("p2-move-a", 2, 12_000, "MOVE", 52, 50),
            action("p2-attack-b", 2, 50_000, "ATTACK_GROUND", 80, 80),
            action("p1-move-b", 1, 52_000, "MOVE", 79, 80),
            action("p1-order-c", 1, 90_000, "ORDER", 50, 50, target=201),
        ]
        fights = detect_fights(
            manifest=manifest(),
            initial_objects=initial_objects(),
            action_events=actions,
        )
        skirmishes = detect_skirmishes(
            manifest=manifest(),
            initial_objects=initial_objects(),
            action_events=actions,
        )

        self.assertEqual(skirmishes["compatibilityBasis"], SKIRMISH_COMPATIBILITY_BASIS)
        self.assertEqual(len(skirmishes["episodes"]), len(fights["episodes"]))
        self.assertEqual(
            [
                (
                    row["startedAtMs"],
                    row["endedAtMs"],
                    row["center"],
                    row["participantPlayerIds"],
                    row["strongCommandCount"],
                    row["supportingCommandCount"],
                )
                for row in skirmishes["episodes"]
            ],
            [
                (
                    row["startedAtMs"],
                    row["endedAtMs"],
                    row["center"],
                    row["participantPlayerIds"],
                    row["strongCommandCount"],
                    row["supportingCommandCount"],
                )
                for row in fights["episodes"]
            ],
        )

    def test_attack_move_with_enemy_response_forms_skirmish(self):
        result = detect_skirmishes(
            manifest=manifest(),
            initial_objects=initial_objects(),
            action_events=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
                action("p2-move", 2, 12_000, "MOVE", 52, 50),
            ],
        )
        self.assertEqual(result["modelVersion"], SKIRMISH_MODEL_VERSION)
        self.assertEqual(len(result["episodes"]), 1)
        episode = result["episodes"][0]
        self.assertEqual(episode["participantPlayerIds"], [1, 2])
        self.assertEqual(episode["contributingPlayerIds"], [1, 2])
        self.assertEqual(episode["opponentInteractionPairs"][0]["playerIds"], [1, 2])
        self.assertFalse(episode["opponentInteractionPairs"][0]["mutualHostileEvidence"])
        self.assertTrue(episode["opponentInteractionPairs"][0]["localParticipationBothDirections"])
        self.assertFalse(episode["opponentInteractionPairs"][0]["reciprocalTargetedCommands"])

    def test_later_created_target_control_can_enrich_pair_without_creating_skirmish(self):
        no_seed = detect_skirmishes(
            manifest=manifest(),
            initial_objects=initial_objects(),
            action_events=[
                action("p2-controls-new-unit", 2, 5_000, "MOVE", 48, 50, selected=[9001]),
                action("p1-targets-new-unit", 1, 10_000, "ORDER", 50, 50, target=9001),
            ],
        )
        self.assertEqual(no_seed["episodes"], [])

        with_legacy_seed = detect_skirmishes(
            manifest=manifest(),
            initial_objects=initial_objects(),
            action_events=[
                action("p2-controls-new-unit", 2, 8_000, "MOVE", 48, 50, selected=[9001]),
                action("p1-attack-move", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
                action("p1-targets-new-unit", 1, 11_000, "ORDER", 50, 50, target=9001),
                action("p2-response", 2, 12_000, "MOVE", 51, 50, selected=[9001]),
            ],
        )
        self.assertEqual(len(with_legacy_seed["episodes"]), 1)
        episode = with_legacy_seed["episodes"][0]
        direct = [
            edge for edge in episode["directedInteractionEdges"]
            if edge["fromPlayerId"] == 1 and edge["toPlayerId"] == 2
        ]
        self.assertEqual(len(direct), 1)
        self.assertTrue(any(
            method.startswith("targeted_controlled_object:")
            for method in direct[0]["evidenceMethods"]
        ))
        self.assertEqual(direct[0]["confidence"], "high")

    def test_one_sided_initial_target_order_is_skirmish_but_not_reciprocal_pair(self):
        result = detect_skirmishes(
            manifest=manifest(),
            initial_objects=initial_objects(),
            action_events=[
                action("p1-order", 1, 10_000, "ORDER", 50, 50, target=201),
            ],
        )
        self.assertEqual(len(result["episodes"]), 1)
        episode = result["episodes"][0]
        self.assertEqual(episode["contributingPlayerIds"], [1])
        pair = episode["opponentInteractionPairs"][0]
        self.assertEqual(pair["playerIds"], [1, 2])
        self.assertFalse(pair["mutualHostileEvidence"])

    def test_multiplayer_pair_edges_do_not_assume_all_to_all_interaction(self):
        result = detect_skirmishes(
            manifest=manifest(team_1=1, team_2=2, team_3=1),
            initial_objects=initial_objects(),
            action_events=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
                action("p3-attack-farther", 3, 11_000, "DE_ATTACK_MOVE", 68, 50),
                action("p2-response", 2, 12_000, "MOVE", 51, 50),
            ],
        )
        self.assertEqual(len(result["episodes"]), 1)
        episode = result["episodes"][0]
        self.assertEqual(episode["participantPlayerIds"], [1, 2, 3])
        pairs = {tuple(row["playerIds"]) for row in episode["opponentInteractionPairs"]}
        self.assertIn((1, 2), pairs)
        self.assertNotIn((2, 3), pairs)

    def test_reciprocal_targeting_has_separate_controller_provenance(self):
        result = detect_skirmishes(
            manifest=manifest(), initial_objects=initial_objects(),
            action_events=[
                action("a", 1, 10_000, "ORDER", 50, 50, target=201),
                action("b", 2, 11_000, "ORDER", 50, 50, target=101),
            ],
        )
        pair = result["episodes"][0]["opponentInteractionPairs"][0]
        self.assertTrue(pair["reciprocalTargetedCommands"])
        self.assertTrue(pair["mutualHostileEvidence"])
        edge = result["episodes"][0]["directedInteractionEdges"][0]
        targeted = [row for row in edge["observations"] if row["method"].startswith("targeted_controlled_object:")]
        self.assertEqual(targeted[0]["controllerEvidence"]["sourceEventId"], "p2-vill")
        self.assertEqual(targeted[0]["targetInstanceId"], 201)

    def test_same_millisecond_controller_selection_cannot_leak_backwards(self):
        actions = [
            action("seed", 1, 9_000, "DE_ATTACK_MOVE", 50, 50),
            {**action("target", 1, 10_000, "ORDER", 50, 50, target=9001), "operationOrdinal": 20},
            {**action("later-control", 2, 10_000, "MOVE", 51, 50, selected=[9001]), "operationOrdinal": 21},
        ]
        result = detect_skirmishes(manifest=manifest(), initial_objects=initial_objects(), action_events=actions)
        edge = next(row for row in result["episodes"][0]["directedInteractionEdges"] if row["fromPlayerId"] == 1)
        self.assertFalse(any(row["method"].startswith("targeted_controlled_object:") for row in edge["observations"]))
        actions[-1]["operationOrdinal"] = 19
        result = detect_skirmishes(manifest=manifest(), initial_objects=initial_objects(), action_events=actions)
        edge = next(row for row in result["episodes"][0]["directedInteractionEdges"] if row["fromPlayerId"] == 1)
        self.assertTrue(any(row["method"].startswith("targeted_controlled_object:") for row in edge["observations"]))

    def test_conflicting_controller_at_same_moment_fails_closed(self):
        actions = [
            action("seed", 1, 9_000, "DE_ATTACK_MOVE", 50, 50),
            {**action("control-1", 1, 9_500, "MOVE", 50, 50, selected=[9001]), "operationOrdinal": 10},
            {**action("control-2", 2, 9_500, "MOVE", 51, 50, selected=[9001]), "operationOrdinal": 10},
            action("target", 1, 10_000, "ORDER", 50, 50, target=9001),
        ]
        result = detect_skirmishes(manifest=manifest(), initial_objects=initial_objects(), action_events=actions)
        edge = next(row for row in result["episodes"][0]["directedInteractionEdges"] if row["fromPlayerId"] == 1)
        self.assertFalse(any(row["method"].startswith("targeted_controlled_object:") for row in edge["observations"]))

    def test_teammate_commands_alone_do_not_form_skirmish(self):
        result = detect_skirmishes(
            manifest=manifest(team_1=1, team_2=1),
            initial_objects=initial_objects(),
            action_events=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
                action("p2-move", 2, 12_000, "MOVE", 52, 50),
            ],
        )
        self.assertEqual(result["episodes"], [])


if __name__ == "__main__":
    unittest.main()
