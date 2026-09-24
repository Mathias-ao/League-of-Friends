"""Temporary raw-stream diagnostic for save-68 starting-scout selection reuse."""
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
POSITIONED_CONTROL = {"MOVE", "ORDER", "PATROL", "DE_ATTACK_MOVE", "SPECIAL", "AI_ORDER"}


def normalize_move_order_ids(name, ids):
    if name not in {"MOVE", "ORDER"}:
        return list(ids)
    if ids and all(value > 0xFFFF and value % 0x10000 == 0 for value in ids):
        return [value >> 16 for value in ids]
    return list(ids)


class ScoutAttributionDebugTests(unittest.TestCase):
    def test_duel_first_five_minutes_raw_actions(self):
        self.assertTrue(SOURCE.is_file())
        direct = defaultdict(Counter)
        reconstructed = defaultdict(Counter)
        methods = defaultdict(Counter)
        last_selection = {}
        elapsed_ms = 0

        with SOURCE.open("rb") as handle:
            eof = os.fstat(handle.fileno()).st_size
            parse_header(handle)
            meta(ExactReader(handle, eof))
            for _, (op_name, payload, _, _, raw, _) in enumerate(frames(handle, eof)):
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
                layout = command_layout(raw, name)

                if SCOUT_IDS.intersection(ids) and name in POSITIONED_CONTROL:
                    direct[actor][name] += 1

                normalized = normalize_move_order_ids(name, ids)
                method = "decoded"
                if normalized != ids:
                    method = "shift16_normalized"

                if normalized:
                    last_selection[actor] = list(normalized)
                elif name in {"MOVE", "ORDER"} and layout.get("selectedCountRaw") == -1:
                    normalized = list(last_selection.get(actor) or [])
                    method = "implicit_previous_selection"

                if (
                    name in POSITIONED_CONTROL
                    and data.get("x") is not None
                    and data.get("y") is not None
                    and SCOUT_IDS.intersection(normalized)
                ):
                    reconstructed[actor][name] += 1
                    methods[actor][method] += 1

        print("SCOUT_DEBUG_DIRECT", {k: dict(v) for k, v in direct.items()})
        print("SCOUT_DEBUG_RECONSTRUCTED", {k: dict(v) for k, v in reconstructed.items()})
        print("SCOUT_DEBUG_METHODS", {k: dict(v) for k, v in methods.items()})
        self.assertGreater(sum(reconstructed[1].values()), 0)
        self.assertGreater(sum(reconstructed[2].values()), 0)


if __name__ == "__main__":
    unittest.main()
