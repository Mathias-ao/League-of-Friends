"""Compare full gzip, PR91 episode dedup, and nested shared-evidence packing.

Accepts actual full statistics JSON as input; synthetic mode is NOT a replay
performance or storage guarantee. No production paths are written.
"""
from __future__ import annotations
import argparse
import gzip
import json
import tempfile
import time
from pathlib import Path

from statistics_detail_delivery import write_delivery_bundle, restore_full_statistics
from statistics_shared_delivery import write_shared_bundle, restore_shared_statistics


def synthetic(episodes_per_player: int, player_specific: bool) -> dict:
    players = []
    episodes = []
    for index in range(episodes_per_player):
        ids = [f"op-{100000 + index*500 + i:09d}" for i in range(220)]
        edges = [{
            "fromPlayerId": p, "toPlayerId": (p+1)%8+1, "sourceEventIds": ids,
            "classification": "opponent_controller_qualified_not_damage",
            "method": "spatial_and_target", "confidence": 0.87,
        } for p in range(1, 7)]
        episodes.append({
            "startedAtMs": index * 27000, "endedAtMs": index * 27000 + 58000,
            "directedInteractionEdges": edges,
            "opponentInteractionPairs": [{
                "playerIds": [1, 2], "mutualHostileEvidence": True,
                "sourceEventIds": ids,
            }],
            "sourceEventIds": ids, "participantPlayerIds": list(range(1, 9)),
        })
    classes = ("skirmishes", "battles", "greatBattles", "cooperativeAttacks")
    for player_id in range(1, 9):
        groups = {name: [] for name in classes}
        for index, base in enumerate(episodes):
            for group in classes:
                variant = {
                    "classification": group,
                    "sourceSkirmishId": f"skirmish-{index+1}",
                }
                if player_specific:
                    variant["participantEvidence"] = f"{player_id}-{index}-{group}"
                groups[group].append({**base, **variant})
        players.append({
            "playerId": player_id, "replaySlot": player_id,
            "economy": {"resourceCommitment": {"food": 1000 * player_id}},
            "military": {"engagements": {
                "skirmishes": episodes_per_player, "engagementEvidence": groups,
            }},
            "mapPresence": {"coverage": 0.22}, "execution": {"apm": 72.2},
        })
    return {
        "statisticsSchemaVersion": "1.2.0", "participants": players,
        "source": {"replaySha256": "0" * 64},
        "pairSocialEvidence": {"observations": []},
        "matchFacts": {"game": {"durationMs": episodes_per_player * 27000}},
    }


def benchmark(data: dict, origin: str, *, verify: bool = True) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        encoder = json.JSONEncoder(
            sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False,
        )
        original_size = 0
        started = time.perf_counter()
        with (root / "full.json.gz").open("wb") as target:
            with gzip.GzipFile(fileobj=target, mode="wb", compresslevel=6, mtime=0) as stream:
                for item in encoder.iterencode(data):
                    raw = item.encode("utf-8")
                    original_size += len(raw)
                    stream.write(raw)
        result = {
            "origin": origin, "fullJsonBytes": original_size,
            "fullGzipBytes": (root / "full.json.gz").stat().st_size,
            "fullGzipWriteSeconds": round(time.perf_counter() - started, 3),
        }
        for label, pack, restore in (
            ("pr91", write_delivery_bundle, restore_full_statistics),
            ("shared", write_shared_bundle, restore_shared_statistics),
        ):
            started = time.perf_counter()
            receipt = pack(data, root / label)
            elapsed = time.perf_counter() - started
            total = sum(p.stat().st_size for p in (root / label).rglob("*.gz"))
            metrics = {
                "storedBytes": total,
                "summaryUncompressedBytes": receipt["summary"]["uncompressedBytes"],
                "summaryCompressedBytes": receipt["summary"]["bytes"],
                "manifestUncompressedBytes": receipt["manifest"]["uncompressedBytes"],
                "manifestCompressedBytes": receipt["manifest"]["bytes"],
                "detailBlocks": receipt["detailBlocks"],
                "packSeconds": round(elapsed, 3),
            }
            if verify:
                started = time.perf_counter()
                if restore(root / label, receipt) != data:
                    raise RuntimeError(f"{label}: full statistics did not restore")
                metrics["fullStatisticsRestoredExactly"] = True
                metrics["restoreSeconds"] = round(time.perf_counter() - started, 3)
            result[label] = metrics
        return result


def main() -> None:
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--statistics", type=Path,
                        help="Existing complete statistics JSON from a real recording")
    source.add_argument("--synthetic-episodes", type=int)
    parser.add_argument("--per-player-variant", action="store_true")
    parser.add_argument("--skip-restore", action="store_true")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    if args.statistics:
        with args.statistics.open(encoding="utf-8") as file:
            data = json.load(file)
        origin = f"real-statistics-file:{args.statistics.name}"
    else:
        if args.synthetic_episodes < 1:
            parser.error("Episode count must be positive")
        data = synthetic(args.synthetic_episodes, args.per_player_variant)
        origin = ("synthetic-per-player-variant" if args.per_player_variant
                  else "synthetic-identical-episodes")
    result = benchmark(data, origin, verify=not args.skip_restore)
    output = json.dumps(result, sort_keys=True, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(output, encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
