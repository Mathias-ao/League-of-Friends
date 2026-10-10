"""Inclusive stable time windows: never discard uncertain event ordering."""
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from action_time_windows import ActionTimeWindow


class ActionTimeWindowsTests(unittest.TestCase):
    def test_inclusive_and_stable_for_replay_clock_order(self):
        rows = [{"timestampMs": t, "ordinal": i} for i, t in enumerate((1, 2, 2, 4, 8))]
        lookup = ActionTimeWindow(rows)
        self.assertTrue(lookup.usable)
        self.assertEqual(lookup.between(2, 4), rows[1:4])
        self.assertEqual(lookup.between(2, 2), rows[1:3])
        self.assertEqual(lookup.between(3, 3), [])
        self.assertEqual(lookup.between(4, 2), [])

    def test_uncertain_or_invalid_clock_falls_back_to_every_event(self):
        for values in ((2, 1, 3), (1, None, 2), (1, True, 2), (1, 2.0, 3)):
            rows = [{"timestampMs": t} for t in values]
            lookup = ActionTimeWindow(rows)
            self.assertFalse(lookup.usable)
            self.assertEqual(lookup.between(1, 1), rows)


if __name__ == "__main__":
    unittest.main()
