"""Native worker is opt-in, verified, source-retaining and isolated from legacy."""
from __future__ import annotations

import base64
from copy import deepcopy
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import parse_replay
from fixture_support import export_fixture, header
from native_ingestion import CONTRACT, prepare_native_upload
from native_worker_transport import process_native_replay
from recorded_events_stream import load_analysis
from statistics_direct_shared import restore_full_statistics
from statistics_projector import project_statistics_from_analysis
from upload_worker import Handler


class NativeUploadTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.source, _, _ = export_fixture(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def _header(self, handle):
        handle.seek(8)
        return deepcopy(header())

    def test_native_package_is_verified_without_canonical_archive_or_source_deletion(self):
        target = self.root / "native"
        timings = {}
        with patch.object(parse_replay, "preflight_source"), \
                patch.object(parse_replay, "parse_header", side_effect=self._header):
            manifest = prepare_native_upload(self.source, target, stage_timings=timings)
        self.assertEqual(manifest["contract"], CONTRACT)
        self.assertFalse(manifest["retention"]["canonicalReplayProduced"])
        self.assertFalse(manifest["retention"]["sourceDeletionAuthorized"])
        self.assertTrue(manifest["source"]["requiresOriginalRecordingRetention"])
        self.assertTrue(self.source.is_file())
        self.assertEqual(manifest["source"]["sha256"], hashlib.sha256(self.source.read_bytes()).hexdigest())
        self.assertEqual(
            sorted(p.name for p in target.iterdir()),
            ["events.jsonl.gz", "manifest.json", "statistics.direct.json.gz"],
        )
        self.assertEqual(
            hashlib.sha256((target / "events.jsonl.gz").read_bytes()).hexdigest(),
            manifest["recordedEvents"]["sha256"],
        )
        stats = json.loads(gzip.decompress((target / "statistics.direct.json.gz").read_bytes()))
        self.assertIn("sharedEpisodeDelivery", stats)
        self.assertEqual(manifest["matchFacts"], stats["matchFacts"])
        legacy_shaped = restore_full_statistics(stats)
        analysis = load_analysis(target / "events.jsonl.gz", manifest["recordedEvents"])
        self.assertEqual(project_statistics_from_analysis(analysis), legacy_shaped)
        self.assertIn("recordedEventsExtractionAndVerifiedHydrationMs", timings)
        with self.assertRaises(FileExistsError):
            prepare_native_upload(self.source, target)

    def test_failed_native_extraction_never_publishes_destination(self):
        target = self.root / "broken"
        with patch("native_ingestion.extract_recorded_events", side_effect=ValueError("broken")):
            with self.assertRaisesRegex(ValueError, "broken"):
                prepare_native_upload(self.source, target)
        self.assertFalse(target.exists())
        self.assertTrue(self.source.exists())

    def test_compressed_transport_never_returns_full_json_or_canonical_bundle(self):
        with patch.object(parse_replay, "preflight_source"), \
                patch.object(parse_replay, "parse_header", side_effect=self._header):
            result = process_native_replay(self.source.name, base64.b64encode(self.source.read_bytes()).decode())
        self.assertEqual(result["contract"], CONTRACT)
        self.assertTrue(result["originalRecordingRetentionRequired"])
        self.assertNotIn("canonicalBundleBase64", result)
        self.assertNotIn("statisticsProjectionVersion", result)
        events = base64.b64decode(result["recordedEvents"]["base64"], validate=True)
        statistics = base64.b64decode(result["statistics"]["base64"], validate=True)
        self.assertEqual(hashlib.sha256(events).hexdigest(), result["recordedEvents"]["sha256"])
        self.assertEqual(hashlib.sha256(statistics).hexdigest(), result["statistics"]["sha256"])
        self.assertIn("sharedEpisodeDelivery", json.loads(gzip.decompress(statistics)))

    def test_native_endpoint_requires_explicit_enablement_and_worker_token(self):
        for env, expected in (
            ({"AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT": "0"}, 404),
            ({"AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT": "1"}, 503),
        ):
            handler = Handler.__new__(Handler)
            handler.path = "/process-native-v1"
            handler.headers = {"authorization": ""}
            calls = []
            handler._json = lambda status, body: calls.append((status, body))
            with patch.dict("os.environ", env, clear=True):
                handler.do_POST()
            self.assertEqual(calls[0][0], expected)

        handler = Handler.__new__(Handler)
        handler.path = "/process-native-v1"
        handler.headers = {"authorization": "Bearer invalid"}
        calls = []
        handler._json = lambda status, body: calls.append((status, body))
        with patch.dict("os.environ", {
            "AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT": "1",
            "AOF_REPLAY_WORKER_AUTH_TOKEN": "trusted-secret",
        }, clear=True):
            handler.do_POST()
        self.assertEqual(calls[0][0], 401)


if __name__ == "__main__":
    unittest.main()
