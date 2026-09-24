import os
from collections import Counter, defaultdict
from pathlib import Path
import unittest

from mgz.fast import meta
from mgz.fast.header import parse as parse_header

from canonical_stream import ExactReader, frames
from map_presence_v6 import (
    MAP_PRESENCE_MODEL_VERSION,
    _selected_candidate_ids,
    project_map_presence,
)
from parse_replay import enum_name


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


def action(event_id, player_id, at_ms, name, x, y, *, selected=()):
    return {
        "eventId": event_id,
        "operationOrdinal": at_ms,
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
    },
    "buildings": {
        "109": {"name": "Town Center", "roleKeys": ["town_center", "economy"]},
    },
}


class MapPresenceV6Tests(unittest.TestCase):
    def test_shifted_move_order_scout_ids_are_attributed_without_rewriting_events(self):
        manifest = {
            "participants": [participant(1), participant(2)],
            "initialState": {"map": {"width": 100, "height": 100}},
        }
        scout_id = 111
        initial_objects = [
            initial("p1-tc", 1, 109, 101, 10, 10),
            initial("p1-scout", 1, 448, scout_id, 11, 10),
            initial("p2-tc", 2, 109, 201, 90, 10),
        ]
        actions = [
            action("move", 1, 20_000, "MOVE", 30, 20, selected=(scout_id << 16,)),
            action("order", 1, 40_000, "ORDER", 45, 25, selected=(scout_id << 16,)),
            action("empty", 1, 50_000, "MOVE", 50, 30, selected=()),
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
        self.assertEqual(scout["startingScoutInstanceIds"], [scout_id])
        self.assertEqual(scout["orderCount"], 2)
        self.assertEqual(
            scout["selectionAttributionMethods"],
            {"save68_shift16_normalized": 2},
        )
        self.assertEqual(actions[0]["objectInstanceIds"], [scout_id << 16])
        self.assertGreater(scout["percent"], 0.0)

    def test_shift_normalization_is_limited_to_move_and_order(self):
        scout_ids = {3084}
        shifted = 3084 << 16
        selected, method = _selected_candidate_ids(
            {"sourceActionName": "MOVE", "objectInstanceIds": [shifted]},
            scout_ids,
        )
        self.assertEqual(selected, scout_ids)
        self.assertEqual(method, "save68_shift16_normalized")

        selected, method = _selected_candidate_ids(
            {"sourceActionName": "SPECIAL", "objectInstanceIds": [shifted]},
            scout_ids,
        )
        self.assertEqual(selected, set())
        self.assertIsNone(method)

    def test_committed_duel_matches_review_control_scout_command_counts(self):
        source = Path(__file__).resolve().parents[2] / "replay-fixtures" / "1v1_1.aoe2record"
        self.assertTrue(source.is_file())

        scout_ids = {1: {3084}, 2: {3086}}
        positioned_names = {"MOVE", "ORDER", "PATROL", "DE_ATTACK_MOVE", "SPECIAL", "AI_ORDER"}
        counts = Counter()
        methods = defaultdict(Counter)
        elapsed_ms = 0

        with source.open("rb") as handle:
            eof = os.fstat(handle.fileno()).st_size
            parse_header(handle)
            meta(ExactReader(handle, eof))
            for op_name, payload, _, _, _, _ in frames(handle, eof):
                if op_name == "SYNC":
                    elapsed_ms += int(payload[0])
                    if elapsed_ms >= 300_000:
                        break
                    continue
                if op_name != "ACTION":
                    continue

                action_type, data = payload
                actor = data.get("player_id")
                if actor not in scout_ids:
                    continue
                name = enum_name(action_type) or "ERROR"
                if (
                    name not in positioned_names
                    or data.get("x") is None
                    or data.get("y") is None
                ):
                    continue
                event = {
                    "sourceActionName": name,
                    "objectInstanceIds": list(data.get("object_ids") or []),
                }
                selected, method = _selected_candidate_ids(event, scout_ids[actor])
                if selected:
                    counts[actor] += 1
                    methods[actor][method] += 1

        self.assertEqual(counts, Counter({1: 45, 2: 36}))
        self.assertEqual(
            methods[1],
            Counter({"save68_shift16_normalized": 38, "decoded": 7}),
        )
        self.assertEqual(
            methods[2],
            Counter({"save68_shift16_normalized": 36}),
        )


if __name__ == "__main__":
    unittest.main()
