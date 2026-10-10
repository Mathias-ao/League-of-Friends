"""Opt-in regression against PR #83 baseline outputs, with evidence readers blocked."""
import hashlib
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from canonical_io import json_bytes, read_json
from recorded_events import decode_dataset, to_analysis
from statistics_projector import project_statistics_from_analysis


@unittest.skipUnless(os.environ.get("AOF_RECORDED_EVENTS_BENCHMARK_DIR"), "Set AOF_RECORDED_EVENTS_BENCHMARK_DIR to saved four-format baseline outputs")
class RecordedEventsCorpusTests(unittest.TestCase):
    def compare(self, name):
        directory = Path(os.environ["AOF_RECORDED_EVENTS_BENCHMARK_DIR"]) / name
        baseline = read_json(directory / "benchmark-report.json")
        path = directory / "recorded-events.json.gz"
        dataset = decode_dataset(path.read_bytes(), read_json(path.with_suffix(".gz.metadata.json")))
        self.assertEqual(dataset["source"]["sha256"], baseline["source"]["sha256"])
        self.assertEqual(hashlib.sha256((directory / "statistics.json").read_bytes()).hexdigest(), baseline["statisticsSha256"])
        with patch("statistics_projector.build_analysis_dataset", side_effect=AssertionError("Canonical access forbidden")), \
             patch("recorded_events.iter_store", side_effect=AssertionError("Canonical store access forbidden")):
            actual = project_statistics_from_analysis(to_analysis(dataset))
        # All categories, raids/engagements, pair evidence, match facts and
        # provenance are covered, not a selectively compared summary.
        self.assertEqual(hashlib.sha256(json_bytes(actual)).hexdigest(), baseline["statisticsSha256"])

    def test_1v1(self):
        self.compare("1v1")

    def test_2v2(self):
        self.compare("2v2")

    def test_4v4(self):
        self.compare("4v4")

    def test_ffa_diplomacy(self):
        self.compare("ffa")


if __name__ == "__main__":
    unittest.main()
