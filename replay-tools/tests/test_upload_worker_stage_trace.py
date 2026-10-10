"""The optional upload-worker performance trace never changes artifact semantics."""
from __future__ import annotations

import base64
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import upload_worker


class WorkerStageTraceTests(unittest.TestCase):
    @staticmethod
    def fake_payload(replay_path, bundle_dir, *, timing_sink=None):
        bundle_dir.mkdir(parents=True)
        (bundle_dir / "extraction-manifest.json").write_text(
            json.dumps({"extractionRunId": "test-extraction"})
        )
        if timing_sink is not None:
            timing_sink["parserTotalMs"] = 12.5
        return {
            "sourceHash": "a" * 64,
            "sourceFileName": replay_path.name,
            "parserName": "fake",
            "parserVersion": "fake-1",
            "schemaVersion": "fake-adapter",
            "sourcePlayers": [],
            "payload": {"body": {"bodyParseComplete": True}, "replay": {}},
            "warnings": [],
        }

    @patch.object(upload_worker, "zip_bundle", return_value=b"fake-zip")
    @patch.object(upload_worker, "project_statistics", return_value={
        "source": {"canonicalSchemaVersion": "fake-schema"}, "participants": [],
    })
    @patch.object(upload_worker, "build_payload")
    def test_same_result_with_and_without_trace(self, parse, project, zip):
        parse.side_effect = self.fake_payload
        encoded = base64.b64encode(b"fake replay").decode("ascii")
        expected = upload_worker.process_replay("control.aoe2record", encoded)
        trace = {}
        actual = upload_worker.process_replay("control.aoe2record", encoded, timing_sink=trace)
        self.assertEqual(actual, expected)
        self.assertEqual(actual["canonicalBundleBase64"], base64.b64encode(b"fake-zip").decode())
        self.assertEqual(trace["sourceBytes"], len(b"fake replay"))
        self.assertEqual(trace["parserStages"]["parserTotalMs"], 12.5)
        for metric in ("base64DecodeMs", "sourceWriteMs", "canonicalExtractionMs",
                       "statisticsProjectionMs", "fullStatisticsJsonWriteMs",
                       "canonicalBundleZipMs", "workerEnvelopeMs", "workerCoreMs"):
            self.assertIsInstance(trace[metric], (int, float))
            self.assertGreaterEqual(trace[metric], 0)
        # No recording/player/identity values in the opt-in trace.
        self.assertNotIn("control", json.dumps(trace).lower())
        self.assertNotIn("fake replay", json.dumps(trace).lower())
        self.assertEqual(parse.call_count, 2)
        self.assertEqual(project.call_count, 2)
        self.assertEqual(zip.call_count, 2)


if __name__ == "__main__":
    unittest.main()
