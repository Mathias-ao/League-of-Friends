"""Same-original HTTP acceptance in an ephemeral Linux container; no hosted writes.

Only hash/timing/integrity summaries leave the container, never statistics or chat.
Native activation and bearer values below belong only to this isolated test server.
"""
import base64
from contextlib import redirect_stdout
import gzip
import hashlib
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
import io
import json
from pathlib import Path
import sys
import tempfile
from threading import Event, Thread
import time
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from native_worker_transport import native_processor_revision
from recorded_events_stream import load_analysis
from statistics_direct_shared import restore_full_statistics
from statistics_projector import project_statistics_from_analysis
from upload_worker import Handler

SOURCE_SHA256 = "e7e05bb7a3ad984a616af4e79abb7774b9a201975cf4f437ce0634ebed65b7ee"


class ObservedHandler(Handler):
    def do_POST(self):
        try:
            super().do_POST()
        finally:
            self.server.request_finished.set()


def call(server, route, body, token):
    server.request_finished.clear()
    connection = HTTPConnection("127.0.0.1", server.server_port, timeout=900)
    headers = {"content-type": "application/json", "Connection": "close"}
    if token:
        headers["authorization"] = "Bearer " + token
    try:
        connection.request("POST", route, body, headers)
        response = connection.getresponse()
        payload = json.loads(response.read())
        assert server.request_finished.wait(5), "Server did not finish writing its timing summary"
        return response.status, payload
    finally:
        connection.close()


def verify_native(response, directory):
    assert response["state"] == "VERIFIED_UNPUBLISHED"
    assert response["originalRecordingRetentionRequired"] is True
    assert response["processorRevision"] == native_processor_revision()
    for key in ("recordedEvents", "statistics"):
        ref = response[key]
        data = base64.b64decode(ref["base64"], validate=True)
        assert len(data) == ref["bytes"] and hashlib.sha256(data).hexdigest() == ref["sha256"]
        (directory / key).write_bytes(data)
    analysis = load_analysis(directory / "recordedEvents", response["recordedEvents"])
    ref = response["statistics"]
    with gzip.open(directory / "statistics", "rb") as packed:
        raw = packed.read(ref["uncompressedBytes"] + 1)
    assert len(raw) == ref["uncompressedBytes"]
    assert hashlib.sha256(raw).hexdigest() == ref["uncompressedSha256"]
    restored = restore_full_statistics(json.loads(raw))
    assert restored == project_statistics_from_analysis(analysis)
    assert restored["source"]["replaySha256"] == SOURCE_SHA256
    assert response["matchFacts"] == restored["matchFacts"]
    return {"artifactHashesVerified": True, "completeStatisticsEquivalent": True,
            "originalRetentionRequired": True}


def verify_legacy(response):
    archive = base64.b64decode(response["canonicalBundleBase64"], validate=True)
    assert len(archive) == response["canonicalBundleBytes"]
    assert hashlib.sha256(archive).hexdigest() == response["canonicalBundleSha256"]
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        run = json.loads(bundle.read("extraction-manifest.json"))
        coverage = json.loads(bundle.read("coverage-report.json"))
    assert run["state"] == "verified_local", "Fast seal is not acceptance"
    validation = coverage["validation"]
    assert validation["artifactIntegrity"] == "verified"
    assert validation["schemaValidation"] == "passed"
    assert validation["sourceSha256"] == SOURCE_SHA256
    assert validation["sourceDeletionEligible"] is False
    assert response["statistics"]["source"]["replaySha256"] == SOURCE_SHA256
    return {"fullCanonicalValidation": True, "operationCount": validation["operationCount"],
            "archiveHashVerified": True, "originalRetentionRequired": True}


def main():
    source = Path(sys.argv[1])
    original = source.read_bytes()
    assert hashlib.sha256(original).hexdigest() == SOURCE_SHA256, "Wrong original recording"
    body = json.dumps({"fileName": "T90Official_CC.aoe2record",
                       "replayBase64": base64.b64encode(original).decode("ascii")})
    results = {"sourceSha256": SOURCE_SHA256, "sourceBytes": len(original),
               "processorRevision": native_processor_revision(), "routes": {}}
    with tempfile.TemporaryDirectory() as temporary, patch.dict("os.environ", {
        "K_SERVICE": "isolated-worker-image-test", "AOF_REPLAY_WORKER_AUTH_TOKEN": "local-test-only",
        "AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT": "1", "AOF_REPLAY_WORKER_PERF_TRACE": "1",
    }, clear=True):
        server = ThreadingHTTPServer(("127.0.0.1", 0), ObservedHandler)
        server.request_finished = Event()
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            for route in ("/process-native-v1", "/process"):
                for token in (None, "incorrect"):
                    assert call(server, route, "{}", token)[0] == 401
                trace = io.StringIO()
                started = time.perf_counter()
                with redirect_stdout(trace):
                    status, response = call(server, route, body, "local-test-only")
                seconds = time.perf_counter() - started
                assert status == 200, (route, status, response.get("error"))
                assert response["sourceHash"] == SOURCE_SHA256
                verified = (verify_native(response, Path(temporary)) if route == "/process-native-v1"
                            else verify_legacy(response))
                records = [json.loads(line) for line in trace.getvalue().splitlines() if line.startswith("{")]
                assert len(records) == 1 and records[0]["event"] == "AOF_WORKER_PERFORMANCE_V1"
                results["routes"][route] = {"httpStatus": status, "seconds": round(seconds, 3),
                    "anonymousAndWrongBearerDenied": True, "verification": verified,
                    "timings": records[0]["timings"]}
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)
    assert source.read_bytes() == original
    print(json.dumps(results, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
