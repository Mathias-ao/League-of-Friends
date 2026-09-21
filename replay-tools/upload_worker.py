from __future__ import annotations

import base64
import hashlib
import io
import json
import hmac
import os
import tempfile
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


def process_replay(file_name: str, replay_base64: str) -> dict[str, Any]:
    safe_name = Path(file_name).name
    if Path(safe_name).suffix.lower() not in {".aoe2record", ".mgz"}:
        raise ValueError("Only .aoe2record or .mgz recordings are accepted.")

    try:
        replay_bytes = base64.b64decode(replay_base64, validate=True)
    except Exception as error:
        raise ValueError("replayBase64 is not valid base64.") from error

    if not replay_bytes or len(replay_bytes) > MAX_REPLAY_BYTES:
        raise ValueError("Replay must contain 1 byte to 32 MiB.")

    with tempfile.TemporaryDirectory(prefix="aof-upload-worker-") as temp:
        root = Path(temp)
        replay_path = root / safe_name
        bundle_dir = root / "canonical"
        replay_path.write_bytes(replay_bytes)

        adapter = build_payload(replay_path, bundle_dir)
        if not adapter["payload"]["body"]["bodyParseComplete"]:
            raise ValueError("Replay body extraction is incomplete.")

        # build_payload seals and validates the CanonicalReplay bundle once.
        # Do not repeat the full bundle validation before projection.
        statistics = project_statistics(bundle_dir, validate=False)
        statistics_path = bundle_dir / "statistics.json"
        statistics_path.write_text(
            json.dumps(statistics, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )

        extraction = json.loads((bundle_dir / "extraction-manifest.json").read_text(encoding="utf-8"))
        bundle_bytes = zip_bundle(bundle_dir)

        return {
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
        if expected_token:
            supplied = self.headers.get("authorization", "")
            if not hmac.compare_digest(supplied, "Bearer " + expected_token):
                self._json(401, {"error": "unauthorized"})
                return
        if self.path != "/process":
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
            result = process_replay(str(request.get("fileName") or ""), str(request.get("replayBase64") or ""))
            self._json(200, result)
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
