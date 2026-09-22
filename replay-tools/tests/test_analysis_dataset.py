import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from analysis_dataset import build_analysis_dataset, validate_analysis_dataset
from canonical_io import semantic_diff
from fixture_support import export_fixture
from statistics_projector import project_statistics, project_statistics_from_analysis


class AnalysisDatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.source, cls.bundle, _ = export_fixture(Path(cls.temp.name))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_compact_dataset_strips_raw_operation_bytes_and_keeps_provenance(self):
        analysis = build_analysis_dataset(self.bundle, validate=False)
        validate_analysis_dataset(analysis)
        self.assertEqual(analysis["datasetVersion"], "AOF_REPLAY_ANALYSIS_V1")
        self.assertFalse(analysis["summary"]["rawOperationBytesCopied"])
        self.assertGreater(analysis["summary"]["actionEventCount"], 0)
        for event in analysis["actionEvents"]:
            self.assertEqual(event["canonicalSourceEventId"], event["eventId"])
            self.assertNotIn("_rawOperationBase64", event["payload"])
            self.assertNotIn("_rawLayout", event["payload"])
        serialized = json.dumps(analysis)
        self.assertNotIn("_rawOperationBase64", serialized)
        self.assertNotIn("unknownBytesBase64", serialized)

    def test_statistics_from_analysis_match_canonical_projection_without_bundle_access(self):
        analysis = build_analysis_dataset(self.bundle, validate=False)
        expected = project_statistics(self.bundle, validate=False)

        hidden = self.bundle.with_name("canonical-hidden")
        self.bundle.rename(hidden)
        try:
            actual = project_statistics_from_analysis(analysis)
        finally:
            hidden.rename(self.bundle)

        diff = semantic_diff(expected, actual)
        self.assertEqual(diff, [], json.dumps(diff[:5], indent=2))

    def test_skip_validation_requires_verified_local_bundle(self):
        run_path = self.bundle / "extraction-manifest.json"
        run = json.loads(run_path.read_text())
        original = run["state"]
        run["state"] = "staged"
        run_path.write_text(json.dumps(run))
        try:
            with self.assertRaisesRegex(ValueError, "verified_local"):
                build_analysis_dataset(self.bundle, validate=False)
        finally:
            run["state"] = original
            run_path.write_text(json.dumps(run))


if __name__ == "__main__":
    unittest.main()
