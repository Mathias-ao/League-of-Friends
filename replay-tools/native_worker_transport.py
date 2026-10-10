"""Explicitly gated, authentication-required native replay worker transport.

Not wired into production uploadReplay/Firebase. Avoid uncompressed statistics
and canonical archive payloads in HTTP: only verified compressed artifacts are
returned, with metadata for a future native publication adapter.
"""
from __future__ import annotations

import base64
from pathlib import Path
import tempfile
from typing import Any

from native_ingestion import MAX_REPLAY_BYTES, CONTRACT, prepare_native_upload

MAX_RESPONSE_ARTIFACT_BYTES = 48 * 1024 * 1024


def process_native_replay(
    file_name: str, replay_base64: str,
    *, timing_sink: dict[str, Any] | None = None,
) -> dict[str, Any]:
    safe_name = Path(file_name).name
    if Path(safe_name).suffix.lower() not in {".aoe2record", ".mgz"}:
        raise ValueError("Unsupported recording extension")
    try:
        recording = base64.b64decode(replay_base64, validate=True)
    except Exception as exc:
        raise ValueError("Invalid recording base64") from exc
    if not recording or len(recording) > MAX_REPLAY_BYTES:
        raise ValueError("Recording size outside supported limits")

    with tempfile.TemporaryDirectory(prefix="aof-native-worker-") as tmp:
        root = Path(tmp)
        source_path = root / safe_name
        source_path.write_bytes(recording)
        target = root / "package"
        manifest = prepare_native_upload(source_path, target, stage_timings=timing_sink)
        events = (target / manifest["recordedEvents"]["path"]).read_bytes()
        stats = (target / manifest["statistics"]["path"]).read_bytes()
        if len(events) + len(stats) > MAX_RESPONSE_ARTIFACT_BYTES:
            raise ValueError("Native response artifacts exceed bounded transport")
        return {
            "contract": CONTRACT,
            "sourceHash": manifest["source"]["sha256"],
            "sourceBytes": manifest["source"]["bytes"],
            "sourcePlayers": manifest["sourcePlayers"],
            "matchFacts": manifest["matchFacts"],
            "recordedEvents": {
                **manifest["recordedEvents"],
                "base64": base64.b64encode(events).decode("ascii"),
            },
            "statistics": {
                **manifest["statistics"],
                "base64": base64.b64encode(stats).decode("ascii"),
            },
            "originalRecordingRetentionRequired": True,
            "state": "VERIFIED_UNPUBLISHED",
        }
