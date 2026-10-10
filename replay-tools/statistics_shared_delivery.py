"""Experimental, rebuildable shared engagement-evidence cache.

Keeps all statistics and source references without changing formulas, identities,
eligibility, or scoring. Depends on PR91's offline detail codec.
"""
from __future__ import annotations

from collections import Counter
from hashlib import sha256
from pathlib import Path
import json
import shutil
import tempfile
from typing import Any
from statistics_detail_delivery import (
    _ENCODER, _digest, _write_gzip, _preview, _checked_read, read_full_record, BLOCK_BYTES,
)

VERSION = "AOF_STATISTICS_SHARED_EVIDENCE_V1_EXPERIMENTAL"
SHARED_FIELDS = frozenset({
    "sourceEventIds", "parentSourceEventIds", "directedInteractionEdges",
    "opponentInteractionPairs", "contributionSourceEventIdsByPlayer",
    "unitClassEvidenceByPlayer",
})
MIN_SHARED_BYTES = 1024


def _json(obj: Any) -> bytes:
    return _ENCODER.encode(obj).encode("utf-8")


def _fingerprint(obj: Any) -> tuple[str, int]:
    digest = sha256()
    count = 0
    for fragment in _ENCODER.iterencode(obj):
        part = fragment.encode("utf-8")
        digest.update(part)
        count += len(part)
    return digest.hexdigest(), count


def _put(spool, value: Any, records: dict[str, dict]) -> str:
    """Append a canonical JSON value once without materializing its bytes."""
    offset = spool.tell()
    digest = sha256()
    for fragment in _ENCODER.iterencode(value):
        part = fragment.encode("utf-8")
        digest.update(part)
        spool.write(part)
    key = digest.hexdigest()
    if key in records:
        spool.seek(offset)
        spool.truncate()
    else:
        records[key] = {"offset": offset, "bytes": spool.tell() - offset}
    return key


def _pack(stats: dict, root: Path, block_bytes: int) -> dict:
    if not 1024 <= block_bytes <= BLOCK_BYTES:
        raise ValueError("Invalid block bound")
    if not isinstance(stats.get("participants"), list):
        raise ValueError("Missing participants")
    if "statisticsDelivery" in stats:
        raise ValueError("Source statistics already contain a delivery wrapper")
    stats_digest = _digest(stats)
    uses = Counter()
    # Only intern nested evidence when it is both substantial AND repeated.
    for p in stats["participants"]:
        groups = ((p.get("military") or {}).get("engagements") or {}).get("engagementEvidence") or {}
        if not isinstance(groups, dict):
            raise ValueError("Malformed engagement groups")
        for rows in groups.values():
            if not isinstance(rows, list):
                raise ValueError("Malformed engagement list")
            for episode in rows:
                if not isinstance(episode, dict):
                    raise ValueError("Malformed engagement row")
                for field in sorted(SHARED_FIELDS & episode.keys()):
                    digest, size = _fingerprint(episode[field])
                    if size >= MIN_SHARED_BYTES:
                        uses[digest] += 1

    with tempfile.TemporaryFile("w+b") as spool:
        record_meta = {}
        episodes = {}
        indices = []
        summary = dict(stats)
        participants = []
        for original in stats["participants"]:
            player = dict(original)
            military = dict(player.get("military") or {})
            eng = dict(military.get("engagements") or {})
            present = "engagementEvidence" in eng
            groups = eng.pop("engagementEvidence", {}) if present else {}
            if not isinstance(groups, dict):
                raise ValueError("Malformed engagement groups")
            index_groups = {}
            for group, rows in groups.items():
                refs = []
                for episode in rows:
                    original_hash = _digest(episode)
                    if original_hash not in episodes:
                        body = dict(episode)
                        shared = {}
                        for field in sorted(SHARED_FIELDS & episode.keys()):
                            digest, size = _fingerprint(episode[field])
                            if size >= MIN_SHARED_BYTES and uses[digest] >= 2:
                                stored = _put(spool, episode[field], record_meta)
                                if stored != digest:
                                    raise ValueError("Unstable shared digest")
                                shared[field] = stored
                                del body[field]
                        packed_hash = _put(spool, {"body": body, "shared": shared}, record_meta)
                        episodes[original_hash] = packed_hash
                    refs.append({"ref": original_hash, "preview": _preview(episode)})
                index_groups[group] = refs
            indices.append({
                "playerId": original.get("playerId"), "replaySlot": original.get("replaySlot"),
                "present": present, "groups": index_groups,
            })
            if "engagements" in military:
                military["engagements"] = eng
            if "military" in player:
                player["military"] = military
            participants.append(player)
        summary["participants"] = participants
        summary["statisticsDelivery"] = {
            "version": VERSION,
            "detailFieldsOmitted": ["participants[].military.engagements.engagementEvidence"],
        }
        total = spool.tell()
        spool.seek(0)
        blocks = []
        index = 0
        while True:
            chunk = spool.read(block_bytes)
            if not chunk:
                break
            path = f"details/{index:06d}.bin.gz"
            entry = _write_gzip(root / path, chunk)
            entry["path"] = path
            blocks.append(entry)
            index += 1

    summary_info = _write_gzip(root / "summary.json.gz", _json(summary))
    summary_info["path"] = "summary.json.gz"
    manifest = {
        "version": VERSION, "sourceStatisticsSha256": stats_digest,
        "summary": summary_info, "blockBytes": block_bytes,
        "detailBytes": total, "blocks": blocks,
        "records": record_meta, "episodeStorage": episodes, "players": indices,
    }
    manifest_info = _write_gzip(root / "manifest.json.gz", _json(manifest))
    manifest_info["path"] = "manifest.json.gz"
    return {
        "manifest": manifest_info, "summary": summary_info,
        "detailBlocks": len(blocks), "uniqueEpisodeRecords": len(episodes),
        "storedRecordCount": len(record_meta), "sourceStatisticsSha256": stats_digest,
    }


def write_shared_bundle(stats: dict, destination: Path, *, block_bytes: int = BLOCK_BYTES) -> dict:
    """Offline create-only bundle; not a Cloud Storage concurrency primitive."""
    destination = Path(destination)
    if destination.exists():
        raise FileExistsError(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".aof-shared-", dir=destination.parent))
    try:
        receipt = _pack(stats, temporary, block_bytes)
        if destination.exists():
            raise FileExistsError(destination)
        temporary.rename(destination)
        return receipt
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def load_shared_manifest(root: Path, receipt: dict) -> dict:
    manifest = json.loads(_checked_read(
        Path(root), receipt["manifest"], maximum=32 * 1024 * 1024,
    ))
    if (manifest.get("version") != VERSION or
            not 1024 <= manifest.get("blockBytes", 0) <= BLOCK_BYTES):
        raise ValueError("Wrong shared-cache version")
    return manifest


def load_episode(root: Path, manifest: dict, original_ref: str, cache: dict | None = None) -> dict:
    cache = {} if cache is None else cache
    if original_ref in cache:
        return cache[original_ref]
    packed_ref = manifest["episodeStorage"].get(original_ref)
    if not packed_ref:
        raise ValueError("Unknown episode")
    wrapper = read_full_record(root, manifest, packed_ref)
    if not isinstance(wrapper, dict) or set(wrapper) != {"body", "shared"}:
        raise ValueError("Malformed packed episode")
    body, shared = wrapper["body"], wrapper["shared"]
    if not isinstance(body, dict) or not isinstance(shared, dict):
        raise ValueError("Malformed shared episode")
    for key, ref in shared.items():
        if key not in SHARED_FIELDS or key in body:
            raise ValueError("Invalid shared field")
        shared_key = ("shared", ref)
        if shared_key not in cache:
            cache[shared_key] = read_full_record(root, manifest, ref)
        body[key] = cache[shared_key]
    if _digest(body) != original_ref:
        raise ValueError("Restored episode hash mismatch")
    cache[original_ref] = body
    return body


def restore_shared_statistics(root: Path, receipt: dict) -> dict:
    """Offline compatibility check, NEVER a website read path."""
    manifest = load_shared_manifest(root, receipt)
    summary = json.loads(_checked_read(
        Path(root), manifest["summary"], maximum=128 * 1024 * 1024,
    ))
    if summary.get("statisticsDelivery", {}).get("version") != VERSION:
        raise ValueError("Unrecognized summary")
    summary.pop("statisticsDelivery")
    cache = {}
    for player, index in zip(summary["participants"], manifest["players"], strict=True):
        if (player.get("playerId"), player.get("replaySlot")) != (index["playerId"], index["replaySlot"]):
            raise ValueError("Player mapping changed")
        if index["present"]:
            player["military"]["engagements"]["engagementEvidence"] = {
                name: [load_episode(root, manifest, row["ref"], cache) for row in entries]
                for name, entries in index["groups"].items()
            }
    if _digest(summary) != manifest["sourceStatisticsSha256"]:
        raise ValueError("Restored full statistics digest mismatch")
    return summary
