"""Measured local upload-worker critical path vs direct Recorded Events candidate.

This is NOT a replacement upload endpoint or a Firebase integration. It measures
CPU, I/O and bytes until locally verified artifacts are ready, excluding network,
Firestore, official-result resolution and production infrastructure cold starts.
Run each mode in its own process; never persist complete raw statistics.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import os
from pathlib import Path
import resource
import tempfile
import time
from typing import Any


VERSION = "AOF_LOCAL_UPLOAD_CRITICAL_PATH_V1"


def ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 3)


def source_digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def _compress_file(src: Path, dst: Path) -> dict:
    started = time.perf_counter()
    h = hashlib.sha256()
    with src.open("rb") as source, dst.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", filename="", compresslevel=6, mtime=0) as output:
            for block in iter(lambda: source.read(1024 * 1024), b""):
                output.write(block)
                h.update(block)
    return {
        "gzipMs": ms(started),
        "sourceJsonBytes": src.stat().st_size,
        "gzipBytes": dst.stat().st_size,
        "sourceJsonSha256": h.hexdigest(),
    }


def current_worker(path: Path, payload_b64: str) -> dict:
    from upload_worker import process_replay
    stages: dict[str, Any] = {}
    started = time.perf_counter()
    result = process_replay(path.name, payload_b64, timing_sink=stages)
    if result["sourceHash"] != source_digest(path):
        raise ValueError("Worker replay hash does not match input")
    response_started = time.perf_counter()
    # Same encoder and envelope as Handler._json, but without HTTP transport.
    serialized = json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    stages["workerHttpJsonEncodingMs"] = ms(response_started)
    stages["workerHttpJsonBytes"] = len(serialized)
    stages["offlineWorkerTotalMs"] = ms(started)
    del serialized, result
    return {
        "mode": "existing-worker",
        "stageTimings": stages,
        "totalMs": ms(started),
        "boundary": "current Python upload worker including response JSON encoding; excludes HTTP transfer, Functions, Storage and result resolver",
    }


def direct_candidate(path: Path, payload_b64: str) -> dict:
    from recorded_events_stream import extract_recorded_events, write_statistics
    from statistics_projector import project_statistics_from_analysis
    stages: dict[str, Any] = {}
    started = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix="aof-local-direct-profile-") as temp:
        root = Path(temp)
        decode_started = time.perf_counter()
        original = base64.b64decode(payload_b64, validate=True)
        stages["base64DecodeMs"] = ms(decode_started)
        if not original or len(original) > 32 * 1024 * 1024:
            raise ValueError("Input outside existing worker's accepted upload size")

        io_started = time.perf_counter()
        copy = root / path.name
        copy.write_bytes(original)
        stages["sourceWriteMs"] = ms(io_started)
        del original

        extraction_started = time.perf_counter()
        stream_path = root / "events.jsonl.gz"
        analysis: dict[str, Any] = {}
        substeps: dict[str, Any] = {}
        metadata = extract_recorded_events(
            copy, stream_path, analysis_sink=analysis, stage_timings=substeps,
        )
        stages["directRecordedEventsExtractionVerificationAndHydrationMs"] = ms(extraction_started)
        stages["recordedEventsSubsteps"] = substeps
        if metadata["datasetVersion"] != "AOF_RECORDED_EVENTS_V1":
            raise ValueError("Unexpected retained evidence contract")

        projection_started = time.perf_counter()
        statistics = project_statistics_from_analysis(analysis, direct_shared=True)
        stages["directStatisticsProjectionMs"] = ms(projection_started)
        if "sharedEpisodeDelivery" not in statistics or statistics["source"]["replaySha256"] != source_digest(copy):
            raise ValueError("Direct projection provenance or compact output missing")
        del analysis

        writing_started = time.perf_counter()
        stats_path = root / "statistics.direct.json"
        write_statistics(stats_path, statistics)
        stages["directStatisticsJsonWriteMs"] = ms(writing_started)
        del statistics
        compressed = _compress_file(stats_path, root / "statistics.direct.json.gz")
        stages["directStatisticsGzipMs"] = compressed["gzipMs"]
        sizes = {
            "recordedEventsGzipBytes": metadata["bytes"],
            "directStatisticsJsonBytes": compressed["sourceJsonBytes"],
            "directStatisticsGzipBytes": compressed["gzipBytes"],
        }
        total = ms(started)
    return {
        "mode": "direct-events-candidate",
        "stageTimings": stages,
        "artifactBytes": sizes,
        "totalMs": total,
        "boundary": "locally verified immutable Recorded Events + validated compact statistics JSON/gzip; excludes remote publication, Functions, Storage, read models and result resolver",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--replay", type=Path, required=True)
    parser.add_argument("--mode", choices=["existing-worker", "direct-events-candidate"], required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    path = args.replay
    if not path.is_file() or path.suffix.lower() not in {".aoe2record", ".mgz"}:
        parser.error("A real .aoe2record/.mgz file is required")
    # Build upload transport input outside timer, so both modes receive identical
    # fully transferred bytes from the Python worker's perspective.
    payload_b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    start = time.perf_counter()
    report = (current_worker(path, payload_b64) if args.mode == "existing-worker"
              else direct_candidate(path, payload_b64))
    report.update({
        "benchmarkVersion": VERSION,
        "fixture": path.stem,
        "inputBytes": path.stat().st_size,
        "maxRssKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        "cliProcessMs": ms(start),
        "limitations": [
            "One sample per fixture/mode is diagnostic, not production P95.",
            "Different legacy/native evidence provenance; cross-format gameplay correctness is a separate validation gate.",
            "Current mode includes the complete HTTP JSON response encoding but not network transfer.",
            "Direct candidate has no authenticated upload, binary transport, Firestore publication or frontend adapter.",
            "The modes have intentionally different local-ready boundaries and are NOT measured upload-to-READY latencies.",
            "Parser/code runtime and GitHub runner hardware can differ from actual deployment.",
        ],
    })
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k not in {"limitations"}}, sort_keys=True, indent=2))


if __name__ == "__main__":
    main()
