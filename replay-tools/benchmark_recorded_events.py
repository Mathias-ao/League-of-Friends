"""Extend PR #83's saved baseline; never repeat extraction just to measure RED."""
from __future__ import annotations

import argparse
import gzip
import hashlib
from pathlib import Path
import sys
import time

from benchmark_replay_pipeline import run_stage, sha256_file, TOOLS
from canonical_io import json_bytes, read_json
from recorded_events import decode_dataset


def firestore_batches(dataset: dict, limit: int = 900 * 1024) -> dict:
    """Measure independently compressed record-aligned documents, not ceil(total).

    No database write. Binary fields would be unindexed. Document metadata and
    protocol overhead are excluded, with 124 KiB headroom below Firestore's limit.
    """
    header = {k: v for k, v in dataset.items() if k not in {"events", "initialObjects", "terrain"}}
    header["terrain"] = {k: v for k, v in dataset["terrain"].items() if k != "tiles"}
    sizes = [len(gzip.compress(json_bytes(header), compresslevel=6, mtime=0))]
    if sizes[0] > limit:
        raise ValueError("Firestore context would exceed chunk target")
    def batch(kind, rows, offset):
        compressed = gzip.compress(json_bytes({"kind": kind, "startOrdinal": offset, "rows": rows}), compresslevel=6, mtime=0)
        if len(compressed) <= limit:
            sizes.append(len(compressed))
        elif len(rows) > 1:
            midpoint = len(rows) // 2
            batch(kind, rows[:midpoint], offset)
            batch(kind, rows[midpoint:], offset + midpoint)
        else:
            raise ValueError("Single observation exceeds Firestore chunk limit")
    for kind, rows in (("events", dataset["events"]), ("objects", dataset["initialObjects"]), ("terrain", dataset["terrain"]["tiles"])):
        batch(kind, rows, 0)
    return {"documentCount": len(sizes), "compressedBytes": sum(sizes),
            "maxDocumentPayloadBytes": max(sizes), "targetBytes": limit,
            "batchPolicy": "record-aligned bisection to 900 KiB; context separate; no document/index/protocol overhead"}


def extend_benchmark(output: Path, python: str, rechecks: int = 2) -> dict:
    output = output.resolve()
    baseline = read_json(output / "benchmark-report.json")
    events = output / "recorded-events.json.gz"
    metadata = events.with_suffix(".gz.metadata.json")
    stages = [run_stage("recorded_events_from_canonical", [python, str(TOOLS / "recorded_events.py"),
              "--bundle", str(output / "canonical"), "--already-sealed", "--out", str(events)])]
    expected = baseline["statisticsSha256"]
    actual = output / "events-statistics.json"
    # This process is passed only RED and its integrity metadata. It never calls
    # the canonical builder or replay decoder. Unit tests also hide both inputs.
    for attempt in range(rechecks + 1):
        stages.append(run_stage(f"recorded_events_projection_{attempt + 1}", [python, str(TOOLS / "recorded_events.py"),
            "--dataset", str(events), "--metadata", str(metadata), "--out", str(actual)]))
        if sha256_file(actual) != expected:
            raise RuntimeError("Recorded Events statistics differ from the unchanged baseline")
    stored = events.read_bytes()
    artifact = read_json(metadata)
    start = time.perf_counter()
    dataset = decode_dataset(stored, artifact)
    decode_ms = (time.perf_counter() - start) * 1000
    analysis_gzip = gzip.compress((output / "analysis.json").read_bytes(), compresslevel=6, mtime=0)
    statistics_gzip = gzip.compress((output / "statistics.json").read_bytes(), compresslevel=6, mtime=0)
    source_size = baseline["source"]["bytes"]
    archive_size = baseline["sizes"]["totals"]["canonicalArchive"]
    report = {
        "experimentVersion": "AOF_RECORDED_EVENTS_BENCHMARK_V1",
        "baselineVersion": baseline["benchmarkVersion"], "source": baseline["source"],
        "artifact": artifact, "analysisV5GzipBytes": len(analysis_gzip),
        "statisticsGzipBytes": len(statistics_gzip),
        "statisticsByteIdentical": True, "projectionRuns": rechecks + 1,
        "statisticsSha256": expected, "timings": stages,
        "localDecodeValidateMs": round(decode_ms, 3),
        "firestore": firestore_batches(dataset),
        "wireByteArithmetic": {"sourceBase64Bytes": 4 * ((source_size + 2) // 3),
                               "archiveBase64Bytes": 4 * ((archive_size + 2) // 3) if archive_size else None,
                               "recordedEventsBinaryBytes": len(stored)},
        "limitations": ["Local CLI, no cloud reads/writes or measured network latency.",
                        "Converter still scans a canonical bundle; no direct event-first extractor speedup claimed.",
                        "Current projection semantics preserved, including legacy missing elevation input.",
                        "Full original/raw evidence is intentionally absent; new decoder discoveries may require verified reupload."],
    }
    (output / "recorded-events-benchmark.json").write_bytes(json_bytes(report))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--python", default=sys.executable)
    args = parser.parse_args()
    report = extend_benchmark(args.output, args.python)
    print({"eventsBytes": report["artifact"]["bytes"], "analysisGzipBytes": report["analysisV5GzipBytes"],
           "statisticsByteIdentical": report["statisticsByteIdentical"], "firestore": report["firestore"]})
