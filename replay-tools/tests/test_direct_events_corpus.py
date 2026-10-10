"""Opt-in replay-free acceptance against the measured direct-extraction corpus."""
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from canonical_io import read_json, sha256
from recorded_events_stream import project_recorded_events, write_statistics


@unittest.skipUnless(os.environ.get("AOF_DIRECT_EVENTS_BENCHMARK_DIR"), "Direct event benchmark corpus not configured")
class DirectCorpusTests(unittest.TestCase):
    def check_fixture(self, name):
        root = Path(os.environ["AOF_DIRECT_EVENTS_BENCHMARK_DIR"]) / name
        report = read_json(root / "report.json")
        self.assertTrue(report["allStatisticsEqualWithNativeProvenance"])
        self.assertTrue(report["statisticalInputsEqual"])
        with patch("statistics_projector.build_analysis_dataset", side_effect=AssertionError("No canonical reads")), \
                patch("parse_replay.parse_header", side_effect=AssertionError("No replay reads")), \
                patch("recorded_events.iter_store", side_effect=AssertionError("No canonical stores")):
            result = project_recorded_events(root / "events.gz", report["artifact"])
        self.assertEqual(result["source"]["replaySha256"], report["source"]["sha256"])
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "statistics.json"
            write_statistics(path, result)
            self.assertEqual(sha256(path), report["statisticsSha256"])

    def test_1v1(self): self.check_fixture("1v1")
    def test_2v2(self): self.check_fixture("2v2")
    def test_4v4(self): self.check_fixture("4v4")
    def test_ffa(self): self.check_fixture("ffa")
