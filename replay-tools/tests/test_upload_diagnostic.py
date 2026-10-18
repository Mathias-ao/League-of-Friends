"""Synthetic transport tests only; no recording, cloud or league authority."""
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from threading import Thread
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from upload_worker import Handler

TRACE = "12345678-1234-4123-8123-123456789abc"
ENV = {"AOF_REPLAY_WORKER_AUTH_TOKEN": "private-token", "AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT": "1",
       "AOF_REPLAY_WORKER_PERF_TRACE": "1", "FUNCTIONS_EMULATOR": "true", "GCLOUD_PROJECT": "demo-aof-native-player"}


class WorkerDiagnosticTests(unittest.TestCase):
    def invoke(self, *, trace=TRACE, token="Bearer private-token", env=None, failure=None):
        request = json.dumps({"fileName": "private-name.aoe2record", "replayBase64": "private-payload"}).encode()
        handler = Handler.__new__(Handler)
        handler.path = "/process-native-v1"
        handler.headers = {"authorization": token, "content-length": str(len(request))}
        if trace is not None:
            handler.headers["X-AoF-Upload-Trace-Id"] = trace
        handler.rfile = io.BytesIO(request)
        responses = []
        handler._json = lambda status, body: responses.append((status, json.loads(json.dumps(body))))
        output = io.StringIO()
        def native(*args, timing_sink):
            if failure:
                raise failure
            if timing_sink is not None:
                timing_sink.update(statisticsAndSocialProjectionMs=12, privateName="private-name", sourceHash="private-hash")
            return {"state": "VERIFIED_UNPUBLISHED", "contract": "test-transport"}
        with patch.dict("os.environ", ENV if env is None else env, clear=True), redirect_stdout(output), \
                patch("native_worker_transport.process_native_replay", side_effect=native) as worker, \
                patch("upload_worker.process_replay", side_effect=AssertionError("No legacy fallback")) as legacy:
            handler.do_POST()
        legacy.assert_not_called()
        return responses, output.getvalue(), worker.call_count

    def test_authenticated_trace_joins_worker_numeric_log_without_private_payloads(self):
        response, output, calls = self.invoke()
        self.assertEqual(response[0][0], 200)
        record = json.loads(output)
        self.assertEqual(record["diagnosticTraceId"], TRACE)
        self.assertEqual(record["route"], "/process-native-v1")
        self.assertEqual(record["status"], "SUCCEEDED")
        self.assertEqual(record["timings"]["statisticsAndSocialProjectionMs"], 12)
        self.assertEqual(calls, 1)
        for value in ("private-token", "private-name", "private-payload", "private-hash", "sourceHash"):
            self.assertNotIn(value, output)

    def test_denied_and_malformed_headers_do_not_reach_worker_or_log_identifiers(self):
        response, output, calls = self.invoke(token="Bearer wrong")
        self.assertEqual(response[0][0], 401)
        self.assertEqual((output, calls), ("", 0))
        for trace in ("bad", TRACE.upper(), TRACE + "\n", "a" * 64):
            response, output, calls = self.invoke(trace=trace)
            self.assertEqual(response, [(400, {"error": "invalid_diagnostic_trace"})])
            self.assertEqual((output, calls), ("", 0))

    def test_trace_off_is_response_equivalent_and_valid_header_is_ignored(self):
        env = {**ENV, "AOF_REPLAY_WORKER_PERF_TRACE": "0"}
        baseline = self.invoke(trace=None, env=env)
        observed = self.invoke(env=env)
        self.assertEqual(baseline, observed)
        self.assertEqual(observed[1], "")
        _, output, _ = self.invoke(env={**ENV, "GCLOUD_PROJECT": "production-project"})
        self.assertNotIn("diagnosticTraceId", output)

    def test_rejected_native_processing_correlates_only_generic_failure(self):
        response, output, calls = self.invoke(failure=ValueError("private failure text"))
        self.assertEqual(response[0][0], 400)
        record = json.loads(output)
        self.assertEqual(record["diagnosticTraceId"], TRACE)
        self.assertEqual(record["failureCode"], "REPLAY_REJECTED")
        self.assertNotIn("private failure text", output)
        self.assertEqual(calls, 1)

    def test_real_loopback_http_header_auth_and_correlated_log(self):
        """HTTP transport only: the processor is mocked, not evidence proof."""
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        output = io.StringIO()
        body = json.dumps({"fileName": "private-name.aoe2record", "replayBase64": "private-payload"}).encode()
        with patch.dict("os.environ", ENV, clear=True), redirect_stdout(output), \
                patch("native_worker_transport.process_native_replay", return_value={"state": "VERIFIED_UNPUBLISHED"}):
            thread.start()
            try:
                request = Request(f"http://127.0.0.1:{server.server_port}/process-native-v1", data=body,
                    headers={"Authorization": "Bearer private-token", "X-AoF-Upload-Trace-Id": TRACE,
                             "Content-Type": "application/json"}, method="POST")
                with urlopen(request, timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(json.load(response), {"state": "VERIFIED_UNPUBLISHED"})
            finally:
                server.shutdown()
                thread.join(timeout=5)
                server.server_close()
        record = json.loads(output.getvalue())
        self.assertEqual(record["diagnosticTraceId"], TRACE)
        self.assertEqual(record["status"], "SUCCEEDED")
        self.assertNotIn("private-token", output.getvalue())
        self.assertNotIn("private-payload", output.getvalue())


if __name__ == "__main__":
    unittest.main()
