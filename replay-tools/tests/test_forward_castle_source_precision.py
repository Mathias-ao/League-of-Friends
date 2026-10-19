"""Forward Castle source precision: controlled upstream serialization regressions.

These are artificial parser fixtures, NOT proof of completed Castle operation or
authentic real-game behavior. They exercise the repository's own header object
serializer, sealed canonical object store, analysis dataset and statistics producer.
"""
from copy import deepcopy
from pathlib import Path
import tempfile
import unittest

from fixture_support import export_fixture, header
from statistics_projector import project_statistics
from social_v1_context import project_social_v1_context
from test_social_v1_context import build
from map_presence_v8 import starting_town_centers


def serialized_case(tcs):
    """Produce source-linked canonical statistics from the actual fixture serializer."""
    h = header()
    p2 = h["players"][1]
    original = p2["objects"][0]
    p2["objects"] = []
    for idx, (x, y) in enumerate(tcs):
        obj = deepcopy(original)
        obj["instance_id"] = 101 + idx
        obj["index"] = idx
        obj["position"]["x"], obj["position"]["y"] = x, y
        p2["objects"].append(obj)
    with tempfile.TemporaryDirectory() as root:
        _, bundle, _ = export_fixture(Path(root), fixture_header=h)
        return project_statistics(bundle, validate=False)


def special(stats, castle_x, castle_y=10):
    data = deepcopy(stats)
    # Only BUILD for this test is synthetic; the TC positions/identities
    # above went through upstream canonical serialization.
    data["participants"][0]["mapPresence"]["forwardBuildings"]["evidence"].append(
        build("controlled-castle-build", 82, castle_x, castle_y))
    # The injected BUILD is at 1_000 ms; extend only this artificial fixture clock.
    data["scope"]["observedUntilMs"] = max(data["scope"]["observedUntilMs"], 1_000)
    # Original test header has unlocked teams. A fixed-team context here is
    # a controlled assertion, NOT inferred effective diplomacy.
    data["matchFacts"]["rules"]["lockTeams"] = {"value": True, "status": "DECODED"}
    place = next(p for p in project_social_v1_context(statistics=data)["placementContexts"]
                 if p["sourceEventId"] == "controlled-castle-build")
    return place["specialForwardCastle"]


class SerializedInitialTownCenterTests(unittest.TestCase):
    def test_boundary_and_rounding_counterexamples(self):
        cases = ((90.004, 75.003, False),  # actual 15.001, rounded source wrongly passed
                 (89.996, 75.0, True),    # actual 14.996, rounded source wrongly failed
                 (90.0, 75.0, False),     # exactly 15.0 is excluded
                 (90.0, 75.000001, True))
        for tc_x, castle_x, expected in cases:
            with self.subTest(tc_x=tc_x, castle_x=castle_x):
                stats = serialized_case([(tc_x, 10)])
                raw = stats["participants"][1]["mapPresence"]["startingTownCenters"]
                self.assertEqual(raw["modelVersion"], "AOF_STARTING_TOWN_CENTER_SOURCE_V1")
                self.assertEqual(raw["observedCount"], 1)
                self.assertEqual(raw["coverage"], "PARTIAL_HEADER_OBJECT_SEARCH")
                self.assertFalse(raw["exhaustiveInitialTcListEstablished"])
                self.assertEqual(raw["objects"][0]["position"]["x"], tc_x)
                self.assertEqual(raw["objects"][0]["sourceEventId"], "initial-object-00000001")
                self.assertEqual(raw["objects"][0]["objectInstanceId"], 101)
                castle = special(stats, castle_x)
                self.assertEqual(castle["homeProximity"]["distanceGate"], "PENDING")
                observed = next(p for p in castle["homeProximity"]["perOpponent"]
                                if p["counterpartReplayPlayerId"] == 2)["sourceStartingTownCenters"][0]
                self.assertEqual(observed["sourceEventId"], "initial-object-00000001")
                self.assertAlmostEqual(observed["unroundedDistanceTiles"], abs(tc_x - castle_x), places=9)
                self.assertIs(observed["strictlyLessThan15Tiles"], expected)
                self.assertFalse(castle["qualifies"])

    def test_two_actual_initial_tcs_not_a_centroid_or_closest(self):
        stats = serialized_case([(80, 10), (120, 10)])
        raw = stats["participants"][1]["mapPresence"]["startingTownCenters"]
        self.assertEqual(raw["observedCount"], 2)
        self.assertEqual([o["position"]["x"] for o in raw["objects"]], [80, 120])
        self.assertEqual([o["objectInstanceId"] for o in raw["objects"]], [101, 102])
        self.assertEqual([o["sourceEventId"] for o in raw["objects"]],
                         ["initial-object-00000001", "initial-object-00000002"])
        self.assertEqual(stats["participants"][1]["mapPresence"]["homeAnchor"]["x"], 100.0)
        castle = special(stats, 100)
        self.assertEqual(castle["homeProximity"]["distanceGate"], "AMBIGUOUS")
        self.assertIsNone(castle["homeProximity"]["soleDistanceCandidateReplayPlayerId"])
        distances = castle["homeProximity"]["perOpponent"][0]["sourceStartingTownCenters"]
        self.assertEqual([o["unroundedDistanceTiles"] for o in distances], [20.0, 20.0])
        self.assertEqual(castle["status"], "PENDING")

    def test_absent_starting_tc_does_not_use_other_object_centroid(self):
        stats = serialized_case([])
        self.assertEqual(stats["participants"][1]["mapPresence"]["startingTownCenters"]["observedCount"], 0)
        castle = special(stats, 90)
        self.assertEqual(castle["homeProximity"]["distanceGate"], "PENDING")
        self.assertEqual(castle["homeProximity"]["observedNearbyOpponentReplayPlayerIds"], [])

    def test_untrusted_duplicate_source_object_fails_closed(self):
        from test_map_presence_v4 import initial, CATALOG
        raw = initial("same-id", 2, 109, 123, 90, 10)
        with self.assertRaisesRegex(ValueError, "duplicate_initial_town_center_identity"):
            starting_town_centers([raw, deepcopy(raw)], {1, 2}, CATALOG)

    def test_canonical_vs_recorded_events_initial_object_semantics(self):
        # The native normalizer's retained initial-object representation uses
        # the same source event ID, owner, instance and unrounded coordinates.
        from analysis_dataset import _compact_initial_object
        from test_map_presence_v4 import initial, CATALOG
        from recorded_events import OBJECT_COLUMNS
        from parse_replay import position
        raw = initial("initial-object-00000000", 2, 109, 202, 90.004, 10)
        canonical = _compact_initial_object({**raw, "operationOrdinal": 0})
        values = [2, 109, None, 202, 0, position(90.004, 10), None]
        native = _compact_initial_object({
            "eventId": "initial-object-00000000", "operationOrdinal": 0,
            "position": values[5], "payload": dict(zip(OBJECT_COLUMNS, values)),
        })
        a = starting_town_centers([canonical], {1, 2}, CATALOG)["2"]
        b = starting_town_centers([native], {1, 2}, CATALOG)["2"]
        for item in (a, b):
            self.assertEqual(item["objects"][0]["position"], {"x": 90.004, "y": 10.0})
            self.assertEqual(item["objects"][0]["objectInstanceId"], 202)
            self.assertFalse(item["exhaustiveInitialTcListEstablished"])


if __name__ == "__main__":
    unittest.main()
