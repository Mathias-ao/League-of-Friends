"""Offline whole-document acceptance for a staged native replay package."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path

from recorded_events_stream import load_analysis
from statistics_direct_shared import restore_full_statistics
from statistics_projector import project_statistics_from_analysis


def _sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while block := f.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def verify(package: Path, source: Path) -> dict:
    manifest = json.loads((package / "manifest.json").read_text("utf-8"))
    if manifest.get("contract") != "AOF_NATIVE_REPLAY_PACKAGE_V1_EXPERIMENTAL":
        raise ValueError("Invalid native package")
    source_meta = manifest["source"]
    if _sha(source) != source_meta["sha256"] or source.stat().st_size != source_meta["bytes"]:
        raise ValueError("Original source replay mismatch")
    assert manifest["retention"]["sourceDeletionAuthorized"] is False
    assert manifest["retention"]["canonicalReplayProduced"] is False
    event_ref = manifest["recordedEvents"]
    stats_ref = manifest["statistics"]
    events = package / event_ref["path"]
    stats = package / stats_ref["path"]
    if (_sha(events) != event_ref["sha256"] or events.stat().st_size != event_ref["bytes"]
            or _sha(stats) != stats_ref["sha256"] or stats.stat().st_size != stats_ref["bytes"]):
        raise ValueError("Native artifact digest/length mismatch")

    analysis = load_analysis(events, event_ref)  # Exhausts chronology and dual hash checks
    legacy_shaped = project_statistics_from_analysis(analysis)
    with gzip.open(stats, "rb") as packed:
        raw = packed.read(stats_ref["uncompressedBytes"] + 1)
    if (len(raw) != stats_ref["uncompressedBytes"]
            or hashlib.sha256(raw).hexdigest() != stats_ref["uncompressedSha256"]):
        raise ValueError("Compact statistics JSON digest/length mismatch")
    direct = json.loads(raw)
    recovered = restore_full_statistics(direct)
    if legacy_shaped != recovered:
        raise ValueError("Native compact statistics did not reconstruct complete canonical projection")
    return {
        "fixture": source.stem,
        "completeStatisticsEquivalent": True,
        "pairSocialEvidenceEquivalent": recovered["pairSocialEvidence"] == legacy_shaped["pairSocialEvidence"],
        "matchesSource": True,
        "recordedEventsVerified": True,
        "originalReplayRetentionRequired": True,
        "participantCount": len(recovered["participants"]),
        "eventsGzipBytes": event_ref["bytes"],
        "statisticsGzipBytes": stats_ref["bytes"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    report = verify(args.package, args.source)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
