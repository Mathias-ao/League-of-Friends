"""Measure the AoF replay CLI pipeline without modifying its algorithms.

Fast mode matches Replay Lab's structural-seal path. Full mode uses exhaustive
canonical conformance. This measures local CLI stages, not browser/network latency.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "replay-tools"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _linux_peak_rss(pid: int) -> int | None:
    try:
        content = Path(f"/proc/{pid}/status").read_text(encoding="utf-8")
        for line in content.splitlines():
            if line.startswith("VmHWM:"):
                return int(line.split()[1]) * 1024
    except (OSError, ValueError, IndexError):
        pass
    return None


def _windows_peak_rss(pid: int) -> int | None:
    if sys.platform != "win32":
        return None
    import ctypes
    from ctypes import wintypes
    class Counters(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD)] + [
            (name, ctypes.c_size_t) for name in ("PeakWorkingSetSize", "WorkingSetSize",
            "QuotaPeakPagedPoolUsage", "QuotaPagedPoolUsage", "QuotaPeakNonPagedPoolUsage",
            "QuotaNonPagedPoolUsage", "PagefileUsage", "PeakPagefileUsage")]
    kernel, psapi = ctypes.WinDLL("kernel32", use_last_error=True), ctypes.WinDLL("psapi", use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
    handle = kernel.OpenProcess(0x0410, False, pid)
    if not handle:
        return None
    try:
        counters = Counters()
        counters.cb = ctypes.sizeof(counters)
        return int(counters.PeakWorkingSetSize) if psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb) else None
    finally:
        kernel.CloseHandle(handle)


def _windows_tree_working_set(root_pid: int) -> int | None:
    """Windows venv python.exe is a launcher; include its actual interpreter.

    Sum current working sets at each sample, not the sum of unrelated peaks.
    Shared pages may be counted twice; this is not private committed memory.
    """
    if sys.platform != "win32":
        return None
    import ctypes
    from ctypes import wintypes
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    psapi = ctypes.WinDLL("psapi", use_last_error=True)
    class Entry(ctypes.Structure):
        _fields_ = [("dwSize", wintypes.DWORD), ("cntUsage", wintypes.DWORD),
            ("pid", wintypes.DWORD), ("heap", ctypes.c_size_t), ("module", wintypes.DWORD),
            ("threads", wintypes.DWORD), ("parent", wintypes.DWORD), ("priority", wintypes.LONG),
            ("flags", wintypes.DWORD), ("exe", wintypes.WCHAR * 260)]
    class Counters(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("faults", wintypes.DWORD)] + [
            (name, ctypes.c_size_t) for name in ("peak", "working", "qpp", "qp", "qnp", "qn", "page", "peakpage")]
    kernel.CreateToolhelp32Snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
    kernel.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
    kernel.Process32FirstW.argtypes = [wintypes.HANDLE, ctypes.POINTER(Entry)]
    kernel.Process32NextW.argtypes = [wintypes.HANDLE, ctypes.POINTER(Entry)]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
    snapshot = kernel.CreateToolhelp32Snapshot(2, 0)
    if snapshot == ctypes.c_void_p(-1).value:
        return None
    parents = {}
    try:
        entry = Entry()
        entry.dwSize = ctypes.sizeof(entry)
        more = kernel.Process32FirstW(snapshot, ctypes.byref(entry))
        while more:
            parents[int(entry.pid)] = int(entry.parent)
            more = kernel.Process32NextW(snapshot, ctypes.byref(entry))
    finally:
        kernel.CloseHandle(snapshot)
    descendants = {root_pid}
    while True:
        expanded = descendants | {pid for pid, parent in parents.items() if parent in descendants}
        if expanded == descendants:
            break
        descendants = expanded
    total, observed = 0, False
    for pid in descendants:
        handle = kernel.OpenProcess(0x0410, False, pid)
        if handle:
            try:
                counters = Counters()
                counters.cb = ctypes.sizeof(counters)
                if psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb):
                    total += int(counters.working)
                    observed = True
            finally:
                kernel.CloseHandle(handle)
    return total if observed else None


def run_stage(name: str, command: list[str]) -> dict[str, Any]:
    start = time.perf_counter()
    child = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, text=True)
    max_rss: int | None = None
    max_tree: int | None = None
    stopped = threading.Event()

    def sample_memory() -> None:
        nonlocal max_rss, max_tree
        while not stopped.is_set():
            observed = _windows_peak_rss(child.pid) if sys.platform == "win32" else _linux_peak_rss(child.pid)
            if observed is not None:
                max_rss = max(observed, max_rss or 0)
            tree = _windows_tree_working_set(child.pid)
            if tree is not None:
                max_tree = max(tree, max_tree or 0)
            stopped.wait(0.02)

    sampler = threading.Thread(target=sample_memory, daemon=True)
    sampler.start()
    try:
        stdout, stderr = child.communicate()
    finally:
        stopped.set()
        sampler.join()
    ms = round((time.perf_counter() - start) * 1000, 3)
    if child.returncode:
        raise RuntimeError(f"{name} failed (exit {child.returncode}):\n{(stderr or stdout)[-8000:]}")
    return {"stage": name, "wallMs": ms, "peakChildRssBytes": max_rss,
            "peakWindowsProcessTreeWorkingSetBytes": max_tree}


def artifact_sizes(folder: Path) -> dict[str, int]:
    """Relative paths avoid reporting a misleading size for directory entries."""
    return {
        str(path.relative_to(folder)).replace(os.sep, "/"): path.stat().st_size
        for path in sorted(folder.rglob("*")) if path.is_file()
    }


def categorized_bytes(files: dict[str, int]) -> dict[str, int]:
    categories = {
        "factsGzip": 0, "terrainGzip": 0, "initialObjectsGzip": 0,
        "headerGzip": 0, "otherCanonical": 0,
    }
    for name, size in files.items():
        if name.startswith("facts-") and name.endswith(".jsonl.gz"):
            key = "factsGzip"
        elif name.startswith("terrain-") and name.endswith(".jsonl.gz"):
            key = "terrainGzip"
        elif name.startswith("initial-objects-") and name.endswith(".jsonl.gz"):
            key = "initialObjectsGzip"
        elif name in ("header-prefix.bin.gz", "decoded-header.json.gz"):
            key = "headerGzip"
        else:
            key = "otherCanonical"
        categories[key] += size
    return categories


def benchmark(replay: Path, output: Path, python: str, seal_mode: str,
              projection_rechecks: int, archive: bool) -> dict[str, Any]:
    replay = replay.resolve()
    if not replay.is_file():
        raise FileNotFoundError(f"Replay does not exist: {replay}")
    output = output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    canonical = output / "canonical"
    adapter = output / "adapter.json"
    timings = output / "parser-timings.json"
    analysis = output / "analysis.json"
    statistics = output / "statistics.json"
    stages: list[dict[str, Any]] = []

    stages.append(run_stage("parse_and_seal", [python, str(TOOLS / "parse_replay.py"),
        str(replay), "--canonical-dir", str(canonical), "--out", str(adapter),
        "--timings-out", str(timings), "--seal-mode", seal_mode]))
    stages.append(run_stage("analysis_dataset", [python, str(TOOLS / "analysis_dataset.py"),
        str(canonical), "--out", str(analysis), "--already-sealed"]))
    projector = [python, str(TOOLS / "statistics_projector.py"),
                 "--analysis", str(analysis), "--out", str(statistics)]
    stages.append(run_stage("statistics_projection", projector))

    expected_stats_hash = sha256_file(statistics)
    for attempt in range(projection_rechecks):
        comparison = output / f"statistics-recheck-{attempt + 1}.json"
        stages.append(run_stage(f"reprojection_{attempt + 1}", projector[:-1] + [str(comparison)]))
        try:
            if sha256_file(comparison) != expected_stats_hash:
                raise RuntimeError("Replay-free statistics projection changed on unchanged evidence")
        finally:
            comparison.unlink(missing_ok=True)

    zip_path = output / "canonical-bundle.zip"
    if archive:
        # The production worker includes statistics.json in its canonical ZIP.
        shutil.copyfile(statistics, canonical / "statistics.json")
        # Invoke the same ZIP function, so compression/serialization work is measured.
        script = ("import sys; from pathlib import Path; "
                  "sys.path.insert(0, sys.argv[1]); "
                  "from upload_worker import zip_bundle; "
                  "Path(sys.argv[3]).write_bytes(zip_bundle(Path(sys.argv[2])))")
        stages.append(run_stage("archive_bundle", [python, "-c", script,
            str(TOOLS), str(canonical), str(zip_path)]))

    canonical_files = artifact_sizes(canonical)
    all_bytes = {"sourceReplay": replay.stat().st_size, "adapter": adapter.stat().st_size,
                 "analysisCache": analysis.stat().st_size,
                 "statistics": statistics.stat().st_size,
                 "canonicalFiles": sum(canonical_files.values()),
                 "canonicalArchive": zip_path.stat().st_size if archive else None}
    report: dict[str, Any] = {
        "benchmarkVersion": "AOF_REPLAY_PERFORMANCE_BASELINE_V1",
        "source": {"file": replay.name, "sha256": sha256_file(replay),
                   "bytes": replay.stat().st_size},
        "execution": {"sealMode": seal_mode, "archiveIncluded": archive,
                      "reprojectionChecks": projection_rechecks,
                      "platform": platform.platform(), "python": python,
                      "repoCommit": _git_commit()},
        "timings": {"stages": stages, "sumStageWallMs": round(sum(s["wallMs"] for s in stages), 3),
                    "parserDetail": json.loads(timings.read_text(encoding="utf-8"))},
        "sizes": {"totals": all_bytes, "canonicalCategories": categorized_bytes(canonical_files),
                  "canonicalFiles": canonical_files},
        "reprojectionByteIdentical": True,
        "statisticsSha256": expected_stats_hash,
        "limitations": [
            "Timings include Python CLI startup and local disk I/O; exclude browser transfer, HTTP worker transfer, Firebase persistence and concurrent uploads.",
            "Memory is each child's Linux VmHWM or Windows PeakWorkingSetSize sampled at 20 ms; not process-tree or simultaneous whole-pipeline memory; null when unavailable.",
            "Windows process-tree working set separately includes venv launcher descendants; sampled current working sets, shared pages may be counted twice. Root-only memory may describe only the launcher.",
            "Full seal verifies canonical evidence; fast seal is development-only and is not a substitute for full conformance.",
            "Compare statistics across code revisions using existing semantic goldens; extraction provenance changes between independent runs.",
        ],
    }
    (output / "benchmark-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def _git_commit() -> str | None:
    result = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT,
                            capture_output=True, text=True, check=False)
    return result.stdout.strip() if result.returncode == 0 else None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("replay", type=Path, nargs="?",
                        default=ROOT / "replay-fixtures/4v4.aoe2record")
    parser.add_argument("--output", type=Path, help="New directory; must not already exist")
    parser.add_argument("--python", default=sys.executable, help="Python with replay-tools requirements")
    parser.add_argument("--seal-mode", choices=("fast", "full"), default="fast")
    parser.add_argument("--projection-rechecks", type=int, default=2)
    parser.add_argument("--archive", action="store_true", help="Also measure worker ZIP creation")
    args = parser.parse_args()
    if args.projection_rechecks < 0:
        parser.error("--projection-rechecks must be non-negative")
    destination = args.output or Path(tempfile.gettempdir()) / ("aof-replay-benchmark-" + str(time.time_ns()))
    report = benchmark(args.replay, destination, args.python, args.seal_mode,
                       args.projection_rechecks, args.archive)
    print(json.dumps({"report": str(destination.resolve() / "benchmark-report.json"),
                      "timings": report["timings"]["stages"],
                      "sizes": report["sizes"]["totals"]}, indent=2))


if __name__ == "__main__":
    main()
