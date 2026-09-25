import unittest

from fight_detector import detect_fights


def manifest(team_1=1, team_2=2):
    return {
        "participants": [
            {"playerId": 1, "lobbyTeamId": team_1},
            {"playerId": 2, "lobbyTeamId": team_2},
        ]
    }


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


def action(event_id, actor, at_ms, name, x, y, target=None):
    return {
        "eventId": event_id,
        "operationOrdinal": at_ms,
        "actorPlayerId": actor,
        "timestampMs": at_ms,
        "sourceActionName": name,
        "targetInstanceId": target,
        "position": {"x": x, "y": y},
        "objectInstanceIds": [actor * 1000 + 1],
    }


class FightDetectorTests(unittest.TestCase):
    def test_attack_move_with_enemy_supporting_command_forms_fight(self):
        result = detect_fights(
            manifest=manifest(),
            initial_objects=initial_objects(),
            action_events=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
                action("p2-move", 2, 12_000, "MOVE", 52, 50),
            ],
        )
        self.assertEqual(len(result["episodes"]), 1)
        self.assertEqual(result["episodes"][0]["participantPlayerIds"], [1, 2])

    def test_targeted_enemy_order_can_identify_other_participant(self):
        result = detect_fights(
            manifest=manifest(),
            initial_objects=initial_objects(),
            action_events=[
                action("p1-order", 1, 10_000, "ORDER", 50, 50, target=201),
            ],
        )
        self.assertEqual(len(result["episodes"]), 1)
        self.assertEqual(result["episodes"][0]["participantPlayerIds"], [1, 2])

    def test_one_sided_untargeted_attack_move_is_not_called_fight(self):
        result = detect_fights(
            manifest=manifest(),
            initial_objects=initial_objects(),
            action_events=[
                action("p1-attack", 1, 10_000, "DE_ATTACK_MOVE", 50, 50),
            ],
        )
        self.assertEqual(result["episodes"], [])

    def test_teammate_commands_do_not_form_fight(self):
        result = detect_fights(
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
