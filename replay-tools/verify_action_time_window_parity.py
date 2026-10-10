"""Real-replay full-output equivalence for opt-in time-window episode acceleration.

This runs outside the timed candidate benchmark. It extracts/validates one
current-build Recorded Events dataset, then compares complete unindexed and
indexed native statistics on identical inputs (not just headline metrics).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import tempfile

from recorded_events_stream import extract_recorded_events
from statistics_projector import project_statistics_from_analysis


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--replay", type=Path, required=True)
    args = parser.parse_args()
    if not args.replay.is_file():
        parser.error("Source replay missing")
    with tempfile.TemporaryDirectory(prefix="aof-indexed-equality-") as temp:
        path = Path(temp) / "events.gz"
        analysis = {}
        metadata = extract_recorded_events(args.replay, path, analysis_sink=analysis)
        original = project_statistics_from_analysis(analysis)
        indexed = project_statistics_from_analysis(analysis, fast_action_windows=True)
        if original != indexed:
            raise AssertionError("Indexed event windows changed complete statistics output")
        print(json.dumps({
            "fixture": args.replay.stem,
            "identicalFullStatistics": True,
            "sourceVersion": metadata["datasetVersion"],
            "participantCount": len(original["participants"]),
            "modelVersion": original["statisticsProjectionVersion"],
            "socialEvidencePreserved": original["pairSocialEvidence"] == indexed["pairSocialEvidence"],
        }, sort_keys=True))


if __name__ == "__main__":
    main()
