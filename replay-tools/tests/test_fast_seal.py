from pathlib import Path
import tempfile
import unittest

from canonical_io import read_json
from canonical_run import seal_local
from analysis_dataset import build_analysis_dataset
from fixture_support import export_fixture


class FastSealTests(unittest.TestCase):
    def test_fast_seal_is_explicitly_weaker_and_can_feed_analysis_cache(self):
        with tempfile.TemporaryDirectory() as d:
            _, bundle, _ = export_fixture(Path(d), seal_mode="fast")
            run = read_json(bundle / "extraction-manifest.json")
            coverage = read_json(bundle / "coverage-report.json")

            self.assertEqual(run["state"], "sealed_local_fast")
            self.assertEqual(coverage["fastSeal"]["status"], "passed")
            self.assertTrue(coverage["fastSeal"]["fullConformanceRequiredForVerifiedLocal"])

            analysis = build_analysis_dataset(bundle, validate=False)
            self.assertEqual(analysis["source"]["canonicalRunState"], "sealed_local_fast")

    def test_full_audit_upgrades_fast_seal_to_verified_local(self):
        with tempfile.TemporaryDirectory() as d:
            _, bundle, _ = export_fixture(Path(d), seal_mode="fast")
            run = read_json(bundle / "extraction-manifest.json")
            validation = seal_local(bundle, run)

            upgraded = read_json(bundle / "extraction-manifest.json")
            coverage = read_json(bundle / "coverage-report.json")
            self.assertEqual(upgraded["state"], "verified_local")
            self.assertEqual(validation["artifactIntegrity"], "verified")
            self.assertEqual(coverage["validation"]["schemaValidation"], "passed")

    def test_default_extraction_remains_full_conformance(self):
        with tempfile.TemporaryDirectory() as d:
            _, bundle, _ = export_fixture(Path(d))
            run = read_json(bundle / "extraction-manifest.json")
            self.assertEqual(run["state"], "verified_local")


if __name__ == "__main__":
    unittest.main()
