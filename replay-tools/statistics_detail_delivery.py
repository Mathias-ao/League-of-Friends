"""Offline V1 delivery cache: lossless engagement detail, compact summaries and bounded reads.

Derived/rebuildable output, NOT authoritative Recorded Events. No Firebase publication
or statistics formula changes. Each gzip block can be independently integrity checked.
"""
from __future__ import annotations

from hashlib import sha256
import gzip
import json
from pathlib import Path
import shutil
import tempfile
from typing import Any

VERSION = "AOF_STATISTICS_DELIVERY_V1_EXPERIMENTAL"
BLOCK_BYTES = 1024 * 1024
MAX_PAGE_ITEMS = 100
MAX_FRAGMENT_BYTES = 256 * 1024
_ENCODER = json.JSONEncoder(sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def _json(value: Any) -> bytes:
    return _ENCODER.encode(value).encode("utf-8")


def _digest(value: Any) -> str:
    digest = sha256()
    for part in _ENCODER.iterencode(value):
        digest.update(part.encode("utf-8"))
    return digest.hexdigest()


def _write_gzip(path: Path, payload: bytes) -> dict:
    packed = gzip.compress(payload, compresslevel=6, mtime=0)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(packed)
    return {"path": path.as_posix(), "sha256": sha256(packed).hexdigest(),
            "bytes": len(packed), "uncompressedBytes": len(payload)}


def _preview(item: dict) -> dict:
    # Known observation descriptors only; never embed source-event lists or edges.
    keys = ("skirmishId", "battleId", "reinforcementId", "startedAtMs", "endedAtMs",
            "firstContributionAtMs", "participantPlayerIds", "attackerPlayerIds",
            "helperPlayerId", "defendedPlayerId", "supportedPlayerId")
    value = {key: item[key] for key in keys if key in item}
    # A preview is not the evidence; reject an unexpectedly large one.
    return value if len(_json(value)) <= 1024 else {}


def _write_bundle(statistics: dict, root: Path, block_bytes: int) -> dict:
    if not 1024 <= block_bytes <= BLOCK_BYTES:
        raise ValueError("Invalid detail block size")
    root.mkdir(parents=True, exist_ok=True)
    summary = dict(statistics)
    participants = []
    indices = []
    records = {}
    with tempfile.TemporaryFile(mode="w+b") as spool:
        for original in statistics.get("participants", []):
            player = dict(original)
            military = dict(player.get("military") or {})
            engagements = dict(military.get("engagements") or {})
            present = "engagementEvidence" in engagements
            groups = engagements.pop("engagementEvidence", {}) if present else {}
            if not isinstance(groups, dict) or any(not isinstance(rows, list) for rows in groups.values()):
                raise ValueError("Unexpected engagement evidence shape")
            ref_groups = {}
            for group, rows in groups.items():
                refs = []
                for item in rows:
                    if not isinstance(item, dict):
                        raise ValueError("Unexpected engagement episode")
                    raw = _json(item)
                    ref = sha256(raw).hexdigest()
                    if ref not in records:
                        offset = spool.tell()
                        spool.write(raw)
                        records[ref] = {"offset": offset, "bytes": len(raw)}
                    refs.append({"ref": ref, "preview": _preview(item)})
                ref_groups[group] = refs
            indices.append({"playerId": original.get("playerId"),
                            "replaySlot": original.get("replaySlot"),
                            "present": present, "groups": ref_groups})
            military["engagements"] = engagements
            player["military"] = military
            participants.append(player)
        summary["participants"] = participants
        summary["statisticsDelivery"] = {"version": VERSION, "detailFieldsOmitted":
            ["participants[].military.engagements.engagementEvidence"]}
        total = spool.tell()
        spool.seek(0)
        blocks = []
        block_index = 0
        while True:
            piece = spool.read(block_bytes)
            if not piece:
                break
            relative = f"details/{block_index:06d}.bin.gz"
            entry = _write_gzip(root / relative, piece)
            entry["path"] = relative
            blocks.append(entry)
            block_index += 1
    summary_entry = _write_gzip(root / "summary.json.gz", _json(summary))
    summary_entry["path"] = "summary.json.gz"
    manifest = {"version": VERSION, "sourceStatisticsSha256": _digest(statistics),
                "summary": summary_entry, "blockBytes": block_bytes,
                "detailBytes": total, "blocks": blocks, "records": records,
                "players": indices}
    manifest_entry = _write_gzip(root / "manifest.json.gz", _json(manifest))
    manifest_entry["path"] = "manifest.json.gz"
    return {"manifest": manifest_entry, "summary": summary_entry,
            "detailBlocks": len(blocks), "uniqueDetailRecords": len(records),
            "sourceStatisticsSha256": manifest["sourceStatisticsSha256"]}


def write_delivery_bundle(statistics: dict, destination: Path, *, block_bytes: int = BLOCK_BYTES) -> dict:
    """Build a new derived cache; never replace an existing destination."""
    destination = Path(destination)
    if destination.exists():
        raise FileExistsError(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".aof-delivery-", dir=destination.parent))
    try:
        receipt = _write_bundle(statistics, temporary, block_bytes)
        if destination.exists():
            raise FileExistsError(destination)
        temporary.rename(destination)
        return receipt
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def _checked_read(root: Path, info: dict, *, maximum: int) -> bytes:
    path = info["path"]
    if not isinstance(path, str) or Path(path).is_absolute() or ".." in Path(path).parts:
        raise ValueError("Invalid artifact path")
    packed = (root / path).read_bytes()
    if len(packed) != info["bytes"] or sha256(packed).hexdigest() != info["sha256"]:
        raise ValueError("Stored artifact integrity mismatch")
    expected = info["uncompressedBytes"]
    if not isinstance(expected, int) or not 0 <= expected <= maximum:
        raise ValueError("Artifact exceeds read bound")
    import zlib
    decoder = zlib.decompressobj(wbits=31)
    raw = decoder.decompress(packed, expected + 1)
    if len(raw) != expected or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
        raise ValueError("Invalid or excessive gzip data")
    return raw


def load_manifest(root: Path, receipt: dict) -> dict:
    root = Path(root)
    raw = _checked_read(root, receipt["manifest"], maximum=32 * 1024 * 1024)
    manifest = json.loads(raw)
    if manifest["version"] != VERSION or not 1024 <= manifest["blockBytes"] <= BLOCK_BYTES:
        raise ValueError("Unsupported delivery cache")
    return manifest


def load_summary(root: Path, manifest: dict) -> dict:
    raw = _checked_read(Path(root), manifest["summary"], maximum=128 * 1024 * 1024)
    summary = json.loads(raw)
    if summary.get("statisticsDelivery", {}).get("version") != VERSION:
        raise ValueError("Unrecognized summary")
    return summary


def list_detail_page(manifest: dict, player_index: int, group: str, *, cursor: int = 0,
                     limit: int = 25) -> dict:
    """Bounded metadata/preview only: no episode body and no Storage fetch."""
    if not 1 <= limit <= MAX_PAGE_ITEMS or not isinstance(cursor, int) or cursor < 0:
        raise ValueError("Invalid page")
    player = manifest["players"][player_index]
    rows = player["groups"].get(group)
    if rows is None:
        raise ValueError("Unknown detail group")
    items = rows[cursor:cursor + limit]
    return {"playerId": player["playerId"], "replaySlot": player["replaySlot"],
            "group": group, "total": len(rows), "items": items,
            "nextCursor": cursor + len(items) if cursor + len(items) < len(rows) else None}


def read_record_fragment(root: Path, manifest: dict, ref: str, *, offset: int = 0,
                         limit: int = MAX_FRAGMENT_BYTES) -> dict:
    """Read at most 256 KiB of a JSON record. Huge episodes require multiple fragments."""
    if not isinstance(ref, str) or len(ref) != 64 or ref not in manifest["records"]:
        raise ValueError("Unknown record")
    if not isinstance(offset, int) or offset < 0 or not isinstance(limit, int) or not 1 <= limit <= MAX_FRAGMENT_BYTES:
        raise ValueError("Invalid fragment bounds")
    meta = manifest["records"][ref]
    size = meta["bytes"]
    if offset > size:
        raise ValueError("Offset past record")
    length = min(limit, size - offset)
    cursor = meta["offset"] + offset
    stop = cursor + length
    page_size = manifest["blockBytes"]
    pieces = []
    while cursor < stop:
        index = cursor // page_size
        if index >= len(manifest["blocks"]):
            raise ValueError("Missing detail block")
        block = _checked_read(Path(root), manifest["blocks"][index], maximum=page_size)
        start = cursor % page_size
        count = min(stop - cursor, len(block) - start)
        if count <= 0:
            raise ValueError("Invalid detail offset")
        pieces.append(block[start:start + count])
        cursor += count
    return {"ref": ref, "offset": offset, "totalBytes": size,
            "data": b"".join(pieces), "nextOffset": offset + length if offset + length < size else None}


def read_full_record(root: Path, manifest: dict, ref: str) -> dict:
    """Offline compatibility hydration, not a website endpoint."""
    meta = manifest["records"][ref]
    pieces = []
    for offset in range(0, meta["bytes"], MAX_FRAGMENT_BYTES):
        pieces.append(read_record_fragment(root, manifest, ref, offset=offset)["data"])
    raw = b"".join(pieces)
    if sha256(raw).hexdigest() != ref:
        raise ValueError("Record content hash mismatch")
    return json.loads(raw)


def restore_full_statistics(root: Path, receipt: dict) -> dict:
    """Offline test/migration utility only; reads all detail evidence."""
    manifest = load_manifest(root, receipt)
    summary = load_summary(root, manifest)
    summary.pop("statisticsDelivery")
    cache = {}
    for player, index in zip(summary["participants"], manifest["players"], strict=True):
        if player.get("playerId") != index["playerId"] or player.get("replaySlot") != index["replaySlot"]:
            raise ValueError("Player detail mapping mismatch")
        if index["present"]:
            evidence = {}
            for group, refs in index["groups"].items():
                evidence[group] = []
                for row in refs:
                    ref = row["ref"]
                    if ref not in cache:
                        cache[ref] = read_full_record(root, manifest, ref)
                    evidence[group].append(cache[ref])
            player["military"]["engagements"]["engagementEvidence"] = evidence
    if _digest(summary) != manifest["sourceStatisticsSha256"]:
        raise ValueError("Restored statistics integrity mismatch")
    return summary
