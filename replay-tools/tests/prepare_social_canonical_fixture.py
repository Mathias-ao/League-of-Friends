"""Authentic canonical compatibility acceptance; not production ingestion.

Uses the existing canonical exporter/projector once for the pinned 1v1. Keep only
the verified statistics for emulator reads; never commit recordings or player names.
"""
import gzip
import json
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from parse_replay import build_payload
from statistics_projector import project_statistics

with tempfile.TemporaryDirectory(prefix="aof-social-canonical-") as tmp:
    root = Path(tmp)
    build_payload(Path(sys.argv[1]), root / "canonical")
    statistics = project_statistics(root / "canonical", validate=False)
    # Minimal lossless social input; source/facts/Pair Social Evidence unchanged.
    selected = {k: statistics[k] for k in ("statisticsProjectionVersion", "source", "matchFacts", "pairSocialEvidence", "participants")}
    selected["participants"] = [{"playerId": p["playerId"]} for p in selected["participants"]]
    target = Path(sys.argv[2]); target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(gzip.compress(json.dumps(selected, separators=(",", ":")).encode()))
