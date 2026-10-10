"""Unit checks for measurement helpers; real-replay benchmarks are opt-in."""
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from benchmark_replay_pipeline import artifact_sizes, categorized_bytes, run_stage, sha256_file, benchmark


class BenchmarkHelpersTests(unittest.TestCase):
    def test_file_hash_and_sizes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "facts-00000.jsonl.gz").write_bytes(b"hello")
            (root / "terrain-00000.jsonl.gz").write_bytes(b"hi")
            (root / "initial-objects-00000.jsonl.gz").write_bytes(b"objects")
            (root / "header-prefix.bin.gz").write_bytes(b"hdr")
            (root / "canonical-replay.json").write_bytes(b"{}")
            files = artifact_sizes(root)
            self.assertEqual(len(files), 5)
            self.assertEqual(sha256_file(root / "facts-00000.jsonl.gz"), hashlib.sha256(b"hello").hexdigest())
            categories = categorized_bytes(files)
            self.assertEqual(categories["factsGzip"], 5)
            self.assertEqual(categories["terrainGzip"], 2)
            self.assertEqual(categories["initialObjectsGzip"], 7)
            self.assertEqual(categories["headerGzip"], 3)
            self.assertEqual(categories["otherCanonical"], 2)
            self.assertEqual(sum(files.values()), sum(categories.values()))

    def test_stage_success_and_error(self):
        success = run_stage("success", [sys.executable, "-c", "print('ok')"])
        self.assertEqual(success["stage"], "success")
        self.assertGreaterEqual(success["wallMs"], 0)
        with self.assertRaisesRegex(RuntimeError, "failure failed"):
            run_stage("failure", [sys.executable, "-c", "raise SystemExit(3)"])

    def test_preflight_rejects_missing_source_without_creating_output(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "unused"
            with self.assertRaises(FileNotFoundError):
                benchmark(Path(temp) / "missing.aoe2record", output, sys.executable, "fast", 0, False)
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
