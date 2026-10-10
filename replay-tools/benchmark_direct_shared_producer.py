"""Real replay-free projection benchmark verifier (not a model correctness oracle).

Inputs are two independently produced statistics files from the same verified
Recorded Events dataset: legacy full and the opt-in direct shared output.
This process verifies exact reconstruction, reports compressed payload sizes,
and leaves the original recording, league authority and TownBell controls intact.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import time

from statistics_direct_shared import VERSION, measure_direct_shape, restore_full_statistics


def _compressed_size(path: Path) -> tuple[int, float]:
    before = time.perf_counter()
    with tempfile.TemporaryFile() as packed, path.open("rb") as source:
        with gzip.GzipFile(fileobj=packed, mode="wb", compresslevel=6, mtime=0) as gz:
            shutil.copyfileobj(source, gz, length=1024 * 1024)
        size = packed.tell()
    return size, round(time.perf_counter() - before, 3)


def _sha256(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            sha.update(chunk)
    return sha.hexdigest()


def compare(full_path: Path, shared_path: Path, fixture: str) -> dict:
    start = time.perf_counter()
    with full_path.open(encoding="utf-8") as source:
        full = json.load(source)
    with shared_path.open(encoding="utf-8") as source:
        direct = json.load(source)
    recovered = restore_full_statistics(direct)
    if recovered != full:
        raise ValueError("Direct shared projection differs from full statistics")
    verify_seconds = time.perf_counter() - start
    del full, recovered
    full_compressed, full_gzip_seconds = _compressed_size(full_path)
    direct_compressed, direct_gzip_seconds = _compressed_size(shared_path)
    if direct_compressed >= full_compressed:
        storage_winner = "full_gzip"
    else:
        storage_winner = "direct_shared"
    return {
        "version": VERSION,
        "fixture": fixture,
        "identicalFullStatistics": True,
        "full": {
            "jsonBytes": full_path.stat().st_size,
            "gzipBytes": full_compressed,
            "gzipSeconds": full_gzip_seconds,
            "sha256": _sha256(full_path),
        },
        "direct": {
            "jsonBytes": shared_path.stat().st_size,
            "gzipBytes": direct_compressed,
            "gzipSeconds": direct_gzip_seconds,
            "sha256": _sha256(shared_path),
            "registry": measure_direct_shape(direct),
        },
        "verifySeconds": round(verify_seconds, 3),
        "storageWinner": storage_winner,
        "limitations": [
            "Same-detector exact equivalence; not independent gameplay correctness validation.",
            "Projection time and peak RSS measured by independent /usr/bin/time processes.",
            "Compression benchmark is isolated from the normal JSON writing process.",
            "No Firebase/authentication/read latency, competition or social rule changes.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--full", type=Path, required=True)
    parser.add_argument("--direct", type=Path, required=True)
    parser.add_argument("--fixture", required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    report = compare(args.full, args.direct, args.fixture)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
