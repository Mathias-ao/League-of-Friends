from __future__ import annotations

import base64
import hashlib
import io
import json
import hmac
import os
import tempfile
import time
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from parse_replay import build_payload
from statistics_projector import project_statistics


MAX_REPLAY_BYTES = 32 * 1024 * 1024
MAX_REQUEST_BYTES = 48 * 1024 * 1024


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def zip_bundle(directory: Path) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(p for p in directory.rglob("*") if p.is_file()):
            info = zipfile.ZipInfo(path.relative_to(directory).as_posix())
            info.date_time = (1980, 1, 1, 0, 0, 0)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            archive.writestr(info, path.read_bytes())
    return output.getvalue()


def process_replay(file_name: str, replay_base64: str, *, timing_sink: dict[str, Any] | None = None) -> dict[str, Any]:
    """Existing worker processing; optionally report safe stage timings.

    Timings contain durations and byte counts only, never names, replay content,
    identifiers, chat, hashes, or statistics. Default worker output is unchanged.
    """
    total_started = time.perf_counter()
    def elapsed_ms(started: float) -> float:
        return round((time.perf_counter() - started) * 1000, 3)

    safe_name = Path(file_name).name
    if Path(safe_name).suffix.lower() not in {".aoe2record", ".mgz"}:
        raise ValueError("Only .aoe2record or .mgz recordings are accepted.")

    decode_started = time.perf_counter()
    try:
        replay_bytes = base64.b64decode(replay_base64, validate=True)
    except Exception as error:
        raise ValueError("replayBase64 is not valid base64.") from error

    if not replay_bytes or len(replay_bytes) > MAX_REPLAY_BYTES:
        raise ValueError("Replay must contain 1 byte to 32 MiB.")

    if timing_sink is not None:
        timing_sink["base64DecodeMs"] = elapsed_ms(decode_started)
        timing_sink["sourceBytes"] = len(replay_bytes)

    with tempfile.TemporaryDirectory(prefix="aof-upload-worker-") as temp:
        root = Path(temp)
        replay_path = root / safe_name
        bundle_dir = root / "canonical"
        io_started = time.perf_counter()
        replay_path.write_bytes(replay_bytes)
        if timing_sink is not None:
            timing_sink["sourceWriteMs"] = elapsed_ms(io_started)

        extract_started = time.perf_counter()
        parser_timings: dict[str, Any] | None = {} if timing_sink is not None else None
        adapter = build_payload(replay_path, bundle_dir, timing_sink=parser_timings)
        if timing_sink is not None:
            timing_sink["canonicalExtractionMs"] = elapsed_ms(extract_started)
            timing_sink["parserStages"] = parser_timings
        if not adapter["payload"]["body"]["bodyParseComplete"]:
            raise ValueError("Replay body extraction is incomplete.")

        # build_payload seals and validates the CanonicalReplay bundle once.
        # Do not repeat the full bundle validation before projection.
        projection_started = time.perf_counter()
        statistics = project_statistics(bundle_dir, validate=False)
        if timing_sink is not None:
            timing_sink["statisticsProjectionMs"] = elapsed_ms(projection_started)
        statistics_path = bundle_dir / "statistics.json"
        serialization_started = time.perf_counter()
        statistics_path.write_text(
            json.dumps(statistics, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        if timing_sink is not None:
            timing_sink["fullStatisticsJsonWriteMs"] = elapsed_ms(serialization_started)
            timing_sink["statisticsJsonBytes"] = statistics_path.stat().st_size

        extraction = json.loads((bundle_dir / "extraction-manifest.json").read_text(encoding="utf-8"))
        zip_started = time.perf_counter()
        bundle_bytes = zip_bundle(bundle_dir)
        if timing_sink is not None:
            timing_sink["canonicalBundleZipMs"] = elapsed_ms(zip_started)
            timing_sink["canonicalBundleBytes"] = len(bundle_bytes)

        envelope_started = time.perf_counter()
        result = {
            "sourceHash": adapter["sourceHash"],
            "sourceFileName": adapter["sourceFileName"],
            "parserName": adapter["parserName"],
            "parserVersion": adapter["parserVersion"],
            "adapterSchemaVersion": adapter["schemaVersion"],
            "canonicalSchemaVersion": statistics["source"]["canonicalSchemaVersion"],
            "extractionRunId": extraction["extractionRunId"],
            "sourcePlayers": adapter["sourcePlayers"],
            "replayMeta": adapter["payload"]["replay"],
            "warnings": adapter.get("warnings", []),
            "statistics": statistics,
            "canonicalBundleBase64": base64.b64encode(bundle_bytes).decode("ascii"),
            "canonicalBundleSha256": sha256_bytes(bundle_bytes),
            "canonicalBundleBytes": len(bundle_bytes),
        }
        if timing_sink is not None:
            timing_sink["workerEnvelopeMs"] = elapsed_ms(envelope_started)
            timing_sink["workerCoreMs"] = elapsed_ms(total_started)
        return result


class Handler(BaseHTTPRequestHandler):
    server_version = "AgeOfFriendsReplayWorker/1"

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._json(200, {"ok": True, "service": "aof-replay-worker"})
            return
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        expected_token = os.environ.get("AOF_REPLAY_WORKER_AUTH_TOKEN")
        # A Cloud Run service can expose /process as well as /process-native-v1.
        # No hosted route may accidentally become anonymous if a secret is
        # absent during deployment. Local emulator behavior remains unchanged.
        if os.environ.get("K_SERVICE") and not expected_token:
            self._json(503, {"error": "worker_auth_not_configured"})
            return
        if expected_token:
            supplied = self.headers.get("authorization", "")
            if not hmac.compare_digest(supplied, "Bearer " + expected_token):
                self._json(401, {"error": "unauthorized"})
                return
        native_route = self.path == "/process-native-v1"
        if native_route:
            # A separate API, NEVER the default legacy upload. Require both
            # explicit operator opt-in and an actual authentication secret.
            if os.environ.get("AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT") != "1":
                self._json(404, {"error": "not_found"})
                return
            if not expected_token:
                self._json(503, {"error": "native_auth_not_configured"})
                return
        elif self.path != "/process":
            self._json(404, {"error": "not_found"})
            return

        try:
            length = int(self.headers.get("content-length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_REQUEST_BYTES:
            self._json(413, {"error": "request_too_large"})
            return

        try:
            request = json.loads(self.rfile.read(length))
            trace: dict[str, Any] | None = {} if os.environ.get("AOF_REPLAY_WORKER_PERF_TRACE") == "1" else None
            if native_route:
                from native_worker_transport import process_native_replay
                result = process_native_replay(
                    str(request.get("fileName") or ""), str(request.get("replayBase64") or ""),
                    timing_sink=trace,
                )
            else:
                result = process_replay(
                    str(request.get("fileName") or ""), str(request.get("replayBase64") or ""),
                    timing_sink=trace,
                )
            response_started = time.perf_counter()
            self._json(200, result)
            if trace is not None:
                trace["httpResponseJsonAndSendMs"] = round((time.perf_counter() - response_started) * 1000, 3)
                if "workerCoreMs" in trace:
                    trace["observedWorkerRequestMs"] = round(
                        trace["workerCoreMs"] + trace["httpResponseJsonAndSendMs"], 3
                    )
                print(json.dumps({"event": "AOF_WORKER_PERFORMANCE_V1", "timings": trace},
                                 ensure_ascii=True, sort_keys=True), flush=True)
        except (ValueError, RuntimeError, FileExistsError) as error:
            self._json(400, {"error": "replay_rejected", "message": str(error)})
        except Exception:
            self._json(500, {"error": "worker_failed", "message": "Replay processing failed."})

    def log_message(self, format: str, *args: Any) -> None:
        if os.environ.get("AOF_REPLAY_WORKER_LOG") == "1":
            super().log_message(format, *args)


def main() -> None:
    host = os.environ.get("AOF_REPLAY_WORKER_BIND", "127.0.0.1")
    port = int(os.environ.get("PORT", os.environ.get("AOF_REPLAY_WORKER_PORT", "8090")))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Age of Friends replay worker listening on http://{host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
