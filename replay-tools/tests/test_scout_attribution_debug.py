"""Temporary raw-stream diagnostic for starting-scout action attribution."""
from collections import Counter, defaultdict
import os
from pathlib import Path
import unittest

from mgz.fast import meta
from mgz.fast.header import parse as parse_header
from canonical_stream import ExactReader, frames, command_layout
from parse_replay import enum_name

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "replay-fixtures" / "1v1_1.aoe2record"
SCOUT_IDS = {3084, 3086}
MOVEMENT_NAMES = {
    "MOVE", "ORDER", "AI_ORDER", "DE_AUTOSCOUT",
    "PATROL", "DE_ATTACK_MOVE", "SPECIAL",
}


class ScoutAttributionDebugTests(unittest.TestCase):
    def test_duel_first_five_minutes_raw_actions(self):
        self.assertTrue(SOURCE.is_file())
        counts = defaultdict(Counter)
        scout_counts = defaultdict(Counter)
        empty_movement = defaultdict(Counter)
        samples = defaultdict(list)
        elapsed_ms = 0

        with SOURCE.open("rb") as handle:
            eof = os.fstat(handle.fileno()).st_size
            parse_header(handle)
            meta(ExactReader(handle, eof))
            for ordinal, (op_name, payload, begin, end, raw, error) in enumerate(frames(handle, eof)):
                if op_name == "SYNC":
                    elapsed_ms += int(payload[0])
                    if elapsed_ms >= 300_000:
                        break
                    continue
                if op_name != "ACTION":
                    continue
                action_type, data = payload
                name = enum_name(action_type) or "ERROR"
                actor = data.get("player_id")
                ids = list(data.get("object_ids") or [])
                counts[actor][name] += 1
                matched = sorted(SCOUT_IDS.intersection(ids))
                if matched:
                    scout_counts[actor][name] += 1
                    print("SCOUT_MATCH", {
                        "at": elapsed_ms, "actor": actor, "name": name,
                        "ids": ids, "x": data.get("x"), "y": data.get("y"),
                        "layout": command_layout(raw, name), "ordinal": ordinal,
                    })
                if name in MOVEMENT_NAMES:
                    if not ids:
                        empty_movement[actor][name] += 1
                    if len(samples[actor]) < 60:
                        samples[actor].append({
                            "at": elapsed_ms, "actor": actor, "name": name,
                            "ids": ids, "x": data.get("x"), "y": data.get("y"),
                            "layout": command_layout(raw, name), "ordinal": ordinal,
                        })

        print("SCOUT_DEBUG_ACTION_COUNTS", {k: dict(v) for k, v in counts.items()})
        print("SCOUT_DEBUG_SCOUT_COUNTS", {k: dict(v) for k, v in scout_counts.items()})
        print("SCOUT_DEBUG_EMPTY_MOVEMENT", {k: dict(v) for k, v in empty_movement.items()})
        for actor in sorted(samples, key=lambda value: (-1 if value is None else value)):
            print("SCOUT_DEBUG_PLAYER", actor)
            for row in samples[actor]:
                print("MOVE_SAMPLE", row)

        self.assertTrue(counts)


if __name__ == "__main__":
    unittest.main()
