"""Extend PR83 baselines with native V1 extraction, phase peaks and parity.

Local-only. Raw outputs stay in the ignored lab; report contains sizes/hashes.
"""
import argparse
import base64
from copy import deepcopy
import cProfile
import gzip
import hashlib
from pathlib import Path
import pstats
import sys
import time

from benchmark_replay_pipeline import run_stage
from canonical_io import json_bytes, read_json, sha256
from recorded_events_stream import extract_recorded_events, load_analysis, write_statistics
from statistics_projector import project_statistics_from_analysis


def child(args):
    metadata = read_json(args.output / "events.gz.metadata.json")
    started = time.perf_counter()
    analysis = load_analysis(args.output / "events.gz", metadata)
    loaded = time.perf_counter()
    if args.stage == "load":
        return
    result = project_statistics_from_analysis(analysis)
    projected = time.perf_counter()
    if args.stage in {"serialize", "serialize_full"}:
        if args.stage == "serialize":
            write_statistics(args.output / "statistics.json", result)
        else:
            (args.output / "statistics-full.json").write_bytes(json_bytes(result))
    finished = time.perf_counter()
    (args.output / f"{args.stage}-timing.json").write_bytes(json_bytes({
        "loadMs": (loaded - started) * 1000, "projectMs": (projected - loaded) * 1000,
        "serializeMs": (finished - projected) * 1000}))


def benchmark(args):
    if not args.compare_only:
        args.output.mkdir(parents=True, exist_ok=False)
    script = str(Path(__file__).resolve())
    entry = [sys.executable, script, "--output", str(args.output)]
    baseline = read_json(args.baseline / "benchmark-report.json")
    if sha256(args.replay) != baseline["source"]["sha256"]:
        raise ValueError("Fixture differs from existing baseline")
    if args.compare_only:
        stages = read_json(args.output / "stages.json")
    else:
        stages = [run_stage("direct_extract_verify", [sys.executable, str(Path(__file__).with_name("recorded_events_stream.py")),
            "--replay", str(args.replay), "--out", str(args.output / "events.gz")])]
        for stage in ("load", "project", "serialize_full", "serialize", "serialize", "serialize"):
            stages.append(run_stage(stage, entry + ["--stage", stage]))
        (args.output / "stages.json").write_bytes(json_bytes(stages))
    if sha256(args.output / "statistics.json") != sha256(args.output / "statistics-full.json"):
        raise ValueError("Serialization changed statistics")
    native = load_analysis(args.output / "events.gz", read_json(args.output / "events.gz.metadata.json"))
    legacy = read_json(args.baseline / "analysis.json")
    # Compare the actual statistical inputs, not a curated list of output metrics.
    duplicate_binary_targets = 0
    retained_actions = deepcopy(legacy["actionEvents"])
    for action in retained_actions:
        target = action["payload"].get("target_player_id")
        if isinstance(target, dict) and "bytesBase64" in target:
            raw = base64.b64decode(target["bytesBase64"], validate=True)
            if (action["sourceActionName"] != "DE_TRIBUTE" or len(raw) != 1 or raw[0] != action["targetPlayerId"]):
                raise ValueError("Removed binary target is not a verified redundant numeric target")
            target.pop("bytesBase64")
            duplicate_binary_targets += 1
    if retained_actions != native["actionEvents"]:
        raise ValueError("Changed action observation beyond verified duplicate binary tribute targets")
    for key in ("body", "fundamentals", "initialObjects", "postgameEvents", "recordingHeader", "terrainElevation"):
        if native[key] != legacy[key]:
            raise ValueError(f"Changed statistical input: {key}")
    # Native artifact identity intentionally scopes new social evidence IDs.
    # Give the unchanged baseline projection the same identity/qualifications.
    for key in ("source", "recordingHeaderSource", "coverage"):
        legacy[key] = native[key]
    expected = project_statistics_from_analysis(legacy)
    write_statistics(args.output / "expected.json", expected)
    if sha256(args.output / "expected.json") != sha256(args.output / "statistics.json"):
        raise ValueError("Statistics differ after explicit provenance adaptation")
    result = read_json(args.output / "statistics.json")
    size = lambda v: len(json_bytes(v)) - 1
    sections = {k: size(v) for k, v in result.items()}
    engagement_bytes = sum(size(p["military"]["engagements"]["engagementEvidence"]) for p in result["participants"])
    report = {"benchmarkVersion": "AOF_DIRECT_EVENTS_BENCHMARK_V1", "source": baseline["source"],
              "artifact": read_json(args.output / "events.gz.metadata.json"), "stages": stages,
              "phaseTimings": {s: read_json(args.output / f"{s}-timing.json") for s in ("project", "serialize", "serialize_full")},
              "statisticsSha256": sha256(args.output / "statistics.json"),
              "statisticsBytes": (args.output / "statistics.json").stat().st_size,
              "statisticsGzipBytes": len(gzip.compress((args.output / "statistics.json").read_bytes(), compresslevel=6, mtime=0)),
              "statisticalInputsEqual": True, "allStatisticsEqualWithNativeProvenance": True,
              "verifiedDuplicateBinaryTributeTargetsOmitted": duplicate_binary_targets,
              "sectionJsonBytes": sections, "participantEngagementEvidenceJsonBytes": engagement_bytes,
              "limitations": ["Local warm-cache measurements; no cloud latency/cost or concurrent-worker test.",
                              "Three projection/serialization runs, one extraction per recording.",
                              "Windows sampled process-tree working set; shared pages may be counted twice.",
                              "Source provenance, coverage retention messages and revision-scoped social IDs intentionally differ."]}
    (args.output / "report.json").write_bytes(json_bytes(report))
    print({"fixture": args.replay.name, "bytes": report["artifact"]["bytes"], "stages": stages})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--replay", type=Path)
    parser.add_argument("--stage", choices=("load", "project", "serialize", "serialize_full"))
    parser.add_argument("--profile", action="store_true")
    parser.add_argument("--compare-only", action="store_true", help="Reuse completed stage measurements when reviewing an input comparison.")
    args = parser.parse_args()
    args.output = args.output.resolve()
    if args.stage:
        if args.profile:
            profile = cProfile.Profile()
            profile.runcall(child, args)
            profile.dump_stats(str(args.output / "profile.pstats"))
            pstats.Stats(profile).strip_dirs().sort_stats("cumulative").print_stats(25)
        else:
            child(args)
    else:
        benchmark(args)
