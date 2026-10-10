"""Versioned, create-only native Recorded Events upload package (staging candidate).

No CanonicalReplay ZIP or exhaustive legacy validation. The VERIFIED decoded
event stream is authoritative for this experimental package; the original replay
must be retained by the eventual publishing service until a separately reviewed
retention/deletion policy is approved.

This module deliberately has no Firebase permissions, no league bindings, no
official result resolution and no automatic production cutover.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import time
from typing import Any

from canonical_io import json_bytes, sha256
from recorded_events_stream import extract_recorded_events, write_statistics
from statistics_projector import project_statistics_from_analysis
from statistics_direct_shared import VERSION as DIRECT_VERSION

CONTRACT = "AOF_NATIVE_REPLAY_PACKAGE_V1_EXPERIMENTAL"
MAX_REPLAY_BYTES = 32 * 1024 * 1024
MAX_STATISTICS_JSON_BYTES = 512 * 1024 * 1024


def _elapsed(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 3)


def _gzip_json(source: Path, dest: Path) -> dict[str, Any]:
    """Compress complete derived statistics without reading them into RAM."""
    if not source.is_file() or not 0 < source.stat().st_size <= MAX_STATISTICS_JSON_BYTES:
        raise ValueError("Statistics JSON exceeds safe artifact size")
    raw_digest = hashlib.sha256()
    raw_size = 0
    with source.open("rb") as stream, dest.open("xb") as target:
        with gzip.GzipFile(fileobj=target, mode="wb", filename="", mtime=0, compresslevel=6) as gz:
            while block := stream.read(1024 * 1024):
                raw_size += len(block)
                raw_digest.update(block)
                gz.write(block)
    if raw_size != source.stat().st_size:
        raise ValueError("Statistics JSON changed while compressing")
    return {
        "format": "json",
        "compression": "gzip",
        "sha256": sha256(dest),
        "bytes": dest.stat().st_size,
        "uncompressedSha256": raw_digest.hexdigest(),
        "uncompressedBytes": raw_size,
        "projectionDeliveryVersion": DIRECT_VERSION,
    }


def prepare_native_upload(
    replay: Path,
    destination: Path,
    *,
    stage_timings: dict[str, Any] | None = None,
    fast_action_windows: bool = False,
) -> dict[str, Any]:
    """Create a fully verified, immutable local package or nothing at all.

    The caller still holds the source recording; neither this function nor the
    package contains a recoverable copy of original undecoded bytes.
    """
    replay = replay.resolve()
    destination = destination.resolve()
    if destination.exists():
        raise FileExistsError("Native package destination already exists")
    if replay.suffix.lower() not in {".aoe2record", ".mgz"} or not replay.is_file():
        raise ValueError("Expected a real recording")
    byte_length = replay.stat().st_size
    if not 0 < byte_length <= MAX_REPLAY_BYTES:
        raise ValueError("Recording outside allowed size")
    destination.parent.mkdir(parents=True, exist_ok=True)
    total = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix=".native-stage-", dir=destination.parent) as tmp:
        work = Path(tmp)
        event_file = work / "events.jsonl.gz"
        stats_raw = work / "statistics.direct.json"
        stats_gzip = work / "statistics.direct.json.gz"
        analysis: dict[str, Any] = {}
        event_stage: dict[str, Any] = {}
        t = time.perf_counter()
        events = extract_recorded_events(
            replay, event_file, analysis_sink=analysis, stage_timings=event_stage,
        )
        if stage_timings is not None:
            stage_timings["recordedEventsExtractionAndVerifiedHydrationMs"] = _elapsed(t)
            stage_timings["recordedEventsSubsteps"] = event_stage
        source_hash = analysis["source"]["replaySha256"]
        if source_hash != sha256(replay):
            raise ValueError("Recording source hash changed during native processing")

        t = time.perf_counter()
        detector_stages: dict[str, float] = {}
        direct = project_statistics_from_analysis(
            analysis, direct_shared=True, fast_action_windows=fast_action_windows,
            stage_timings=detector_stages,
        )
        if direct.get("sharedEpisodeDelivery", {}).get("version") != DIRECT_VERSION:
            raise ValueError("Direct shared statistics contract missing")
        if direct.get("source", {}).get("replaySha256") != source_hash:
            raise ValueError("Native statistics source identity mismatch")
        if stage_timings is not None:
            stage_timings["statisticsAndSocialProjectionMs"] = _elapsed(t)
            stage_timings["statisticsSubsteps"] = detector_stages

        t = time.perf_counter()
        write_statistics(stats_raw, direct)
        stats_meta = _gzip_json(stats_raw, stats_gzip)
        stats_raw.unlink()  # Not part of the stored native representation.
        if stage_timings is not None:
            stage_timings["statisticsJsonAndGzipMs"] = _elapsed(t)

        source_players = [
            {"replaySlot": row["playerId"], "sourceName": row["name"]}
            for row in analysis["manifest"]["participants"]
        ]
        if len(source_players) != len({p["replaySlot"] for p in source_players}):
            raise ValueError("Duplicate replay slots")
        manifest = {
            "contract": CONTRACT,
            "source": {"sha256": source_hash, "bytes": byte_length,
                       "requiresOriginalRecordingRetention": True},
            "recordedEvents": {"path": event_file.name, **events},
            "statistics": {"path": stats_gzip.name, **stats_meta},
            "sourcePlayers": source_players,
            "matchFacts": direct["matchFacts"],
            "retention": {
                "originalRecordingIncluded": False,
                "canonicalReplayProduced": False,
                "rawBinaryOperationsRecoverableFromEvents": False,
                "sourceDeletionAuthorized": False,
            },
            "publication": {"state": "LOCAL_VERIFIED_ONLY",
                            "productionReadModelsCompatible": False,
                            "leagueEffectsPermitted": False},
        }
        manifest_path = work / "manifest.json"
        manifest_path.write_bytes(json_bytes(manifest))
        # Bind JSON metadata to actual artifacts. Do not trust a name/path alone.
        if (sha256(event_file) != events["sha256"]
                or event_file.stat().st_size != events["bytes"]
                or sha256(stats_gzip) != stats_meta["sha256"]
                or stats_gzip.stat().st_size != stats_meta["bytes"]):
            raise ValueError("Native package artifact integrity changed")
        if sha256(replay) != source_hash or replay.stat().st_size != byte_length:
            raise ValueError("Original recording changed")
        if destination.exists():
            raise FileExistsError("Native package destination appeared")
        os.rename(work, destination)
        if stage_timings is not None:
            stage_timings["totalLocalPackageMs"] = _elapsed(total)
        return manifest


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--replay", type=Path, required=True)
    cli.add_argument("--out", type=Path, required=True)
    cli.add_argument("--report", type=Path)
    cli.add_argument("--fast-action-windows", action="store_true")
    args = cli.parse_args()
    timings: dict[str, Any] = {}
    manifest = prepare_native_upload(
        args.replay, args.out, stage_timings=timings,
        fast_action_windows=args.fast_action_windows,
    )
    safe_report = {
        "contract": manifest["contract"],
        "inputBytes": manifest["source"]["bytes"],
        "recordedEventsBytes": manifest["recordedEvents"]["bytes"],
        "statisticsGzipBytes": manifest["statistics"]["bytes"],
        "timings": timings,
        "verified": True,
        "releasedToLeague": False,
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(safe_report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(safe_report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
