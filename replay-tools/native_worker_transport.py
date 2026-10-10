"""Explicitly gated, authentication-required native replay worker transport.

Not wired into production uploadReplay/Firebase. Avoid uncompressed statistics
and canonical archive payloads in HTTP: only verified compressed artifacts are
returned, with metadata for a future native publication adapter.
"""
from __future__ import annotations

import base64
import hashlib
from pathlib import Path
import tempfile
from typing import Any

from native_ingestion import MAX_REPLAY_BYTES, CONTRACT, prepare_native_upload
from canonical_run import code_digest, version_bundle

MAX_RESPONSE_ARTIFACT_BYTES = 48 * 1024 * 1024


def native_processor_revision() -> str:
    """Pin executable models, schemas/catalogs and the installed decoder, not a deployment label."""
    root = Path(__file__).parent
    paths = (list(root.glob('*.py')) + list(root.glob('*.json'))
             + list((root / 'schemas').glob('*.json')) + list((root / 'entity-catalog').glob('*.json')))
    inputs = [(p.relative_to(root).as_posix(), p) for p in paths]
    matrix = root.parent / 'docs/replay-foundation/townbell-capability-matrix.csv'
    inputs.append(('docs/replay-foundation/townbell-capability-matrix.csv', matrix))
    code = code_digest(inputs)
    return hashlib.sha256((code + version_bundle()['decoderCodeSha256']).encode('ascii')).hexdigest()


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
        timings = timing_sink if timing_sink is not None else {}
        revision = native_processor_revision()
        manifest = prepare_native_upload(source_path, target, stage_timings=timings)
        events = (target / manifest["recordedEvents"]["path"]).read_bytes()
        stats = (target / manifest["statistics"]["path"]).read_bytes()
        if len(events) + len(stats) > MAX_RESPONSE_ARTIFACT_BYTES:
            raise ValueError("Native response artifacts exceed bounded transport")
        return {
            "contract": CONTRACT,
            "processorRevision": revision,
            "workerStages": timings,
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
