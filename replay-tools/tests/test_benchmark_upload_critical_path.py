"""Boundary checks for native timing; authentic measurements remain opt-in."""
import base64
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from benchmark_upload_critical_path import native_worker


class NativeBoundaryTests(unittest.TestCase):
    def test_uses_native_transport_and_serializes_verified_artifacts(self):
        payload = b"recording boundary fixture"
        with tempfile.TemporaryDirectory() as directory:
            replay = Path(directory) / "sample.aoe2record"
            replay.write_bytes(payload)
            def worker(name, encoded, *, timing_sink):
                self.assertEqual(name, replay.name)
                self.assertEqual(base64.b64decode(encoded), payload)
                timing_sink["measuredStageMs"] = 7
                return {"sourceHash": hashlib.sha256(payload).hexdigest(),
                        "processorRevision": "test-revision",
                        "recordedEvents": {"bytes": 123, "base64": "ZWZm"},
                        "statistics": {"bytes": 45, "base64": "c3RhdHM="}}
            with patch("native_worker_transport.process_native_replay", side_effect=worker):
                report = native_worker(replay, base64.b64encode(payload).decode())
            self.assertEqual(report["mode"], "native-worker")
            self.assertEqual(report["processorRevision"], "test-revision")
            self.assertEqual(report["stageTimings"]["measuredStageMs"], 7)
            self.assertGreater(report["artifactBytes"]["workerHttpJsonBytes"], 168)
            self.assertIn("excludes browser", report["boundary"])

    def test_wrong_source_hash_fails_instead_of_recording_ready_time(self):
        with tempfile.TemporaryDirectory() as directory:
            replay = Path(directory) / "sample.aoe2record"
            replay.write_bytes(b"recording")
            with patch("native_worker_transport.process_native_replay", return_value={"sourceHash": "wrong"}):
                with self.assertRaisesRegex(ValueError, "does not match input"):
                    native_worker(replay, "cmVjb3JkaW5n")


if __name__ == "__main__":
    unittest.main()
