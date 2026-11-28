"""Run explicitly inside the actual built, nonroot Linux worker image."""
import hashlib
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

MATRIX_SHA256 = "2506011e77cf17a5f4c6bd2d36aae6bcf1b6f85fde62462c44fe5982e4d1d4ce"


@unittest.skipUnless(os.environ.get("AOF_TEST_BUILT_WORKER_IMAGE") == "1",
                     "Requires the built Linux image; source-tree tests are not layout proof")
class WorkerImageLayoutTests(unittest.TestCase):
    def test_runtime_matrix_matches_exact_pinned_bytes(self):
        from statistics_registry import MATRIX_PATH, build_registry
        self.assertEqual(MATRIX_PATH, Path("/docs/replay-foundation/townbell-capability-matrix.csv"))
        packaged = Path("/app/processor-data/townbell-capability-matrix.csv").read_bytes()
        self.assertEqual(hashlib.sha256(packaged).hexdigest(), MATRIX_SHA256)
        self.assertEqual(MATRIX_PATH.read_bytes(), packaged)
        self.assertTrue(build_registry())

    def test_processor_identity_matches_unmodified_dockerfile_image(self):
        from native_worker_transport import native_processor_revision
        self.assertEqual(native_processor_revision(), os.environ["AOF_EXPECTED_PROCESSOR_REVISION"])

    def test_missing_or_mismatched_matrix_still_fails_closed(self):
        import native_worker_transport as transport
        with tempfile.TemporaryDirectory() as temporary:
            app = Path(temporary) / "app"
            app.mkdir()
            with patch.object(transport, "__file__", str(app / "native_worker_transport.py")):
                with self.assertRaisesRegex(FileNotFoundError, "Pinned native processor"):
                    transport.native_processor_revision()
                packaged = app / "processor-data/townbell-capability-matrix.csv"
                packaged.parent.mkdir()
                packaged.write_bytes(Path("/app/processor-data/townbell-capability-matrix.csv").read_bytes())
                reference = app.parent / "docs/replay-foundation/townbell-capability-matrix.csv"
                reference.parent.mkdir(parents=True)
                reference.write_bytes(packaged.read_bytes() + b"tampered")
                with self.assertRaisesRegex(ValueError, "differs from the reviewed reference"):
                    transport.native_processor_revision()

    def test_nonroot_runtime_and_native_default_off(self):
        from upload_worker import Handler
        self.assertEqual(os.getuid(), 10001)
        self.assertNotIn("AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT", os.environ)
        with patch.dict(os.environ, {"K_SERVICE": "local-image-test",
                                    "AOF_REPLAY_WORKER_AUTH_TOKEN": "test-only"}, clear=True):
            handler = Handler.__new__(Handler)
            handler.path = "/process-native-v1"
            handler.headers = {"authorization": "Bearer test-only"}
            replies = []
            handler._json = lambda status, body: replies.append(status)
            handler.do_POST()
            self.assertEqual(replies, [404])


if __name__ == "__main__":
    unittest.main(verbosity=2)
