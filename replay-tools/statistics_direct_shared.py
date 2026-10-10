"""Experimental direct, lossless shared-episode output from the engagement producer.

This is a derived statistics *representation*, not the authoritative Recorded Events
source. It keeps detectors, formulas, source ids and independent social conclusions
unchanged. The normal full-statistics projector remains its own default.

Unlike post-hoc PR92 packing, this consumes the producer's original unique episode
objects, rather than scanning per-player copies. No full-statistics JSON is needed
on the fast path. All content is preserved and can be hydrated for audit.
"""
from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
from typing import Any

VERSION = "AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL"
SHARED_FIELDS = frozenset({
    "sourceEventIds", "parentSourceEventIds", "directedInteractionEdges",
    "opponentInteractionPairs", "contributionSourceEventIdsByPlayer",
    "unitClassEvidenceByPlayer",
})
MIN_INTERN_BYTES = 1024
GROUPS = (
    "skirmishes", "battles", "reinforcements",
    "defensiveAssists", "cooperativeAttacks",
)


def _fingerprint(value: Any) -> tuple[str, int]:
    """Canonical content identity, counted once per unique producer episode field."""
    encoder = json.JSONEncoder(sort_keys=True, ensure_ascii=False,
                               separators=(",", ":"), allow_nan=False)
    digest = sha256()
    length = 0
    for fragment in encoder.iterencode(value):
        part = fragment.encode("utf-8")
        length += len(part)
        digest.update(part)
    return digest.hexdigest(), length


def to_direct_shared_statistics(full: dict, producer: dict[str, list[dict]]) -> dict:
    """Convert the in-memory, already-validated projection; don't write full JSON.

    The original episode dicts are referenced by multiple player list objects, so
    conversion uses Python identity only to index them. Only distinct producer
    episodes are fingerprinted for shared nested evidence.
    """
    if "sharedEpisodeDelivery" in full or "statisticsDelivery" in full:
        raise ValueError("Already compacted")
    if set(producer) != set(GROUPS):
        raise ValueError("Incomplete shared producer groups")
    unique_ids: dict[int, str] = {}
    groups: dict[str, list[dict]] = {}
    shared_values: dict[str, Any] = {}
    for name in GROUPS:
        rows = producer[name]
        if not isinstance(rows, list):
            raise ValueError("Unexpected episode registry")
        compact_rows = []
        for i, row in enumerate(rows):
            if not isinstance(row, dict) or id(row) in unique_ids:
                raise ValueError("Duplicated or invalid producer episode")
            ref = f"{name}/{i}"
            unique_ids[id(row)] = ref
            body = dict(row)
            shared: dict[str, str] = {}
            for field in sorted(SHARED_FIELDS & row.keys()):
                digest, size = _fingerprint(row[field])
                if size >= MIN_INTERN_BYTES:
                    shared_values.setdefault(digest, row[field])
                    del body[field]
                    shared[field] = digest
            compact_rows.append({"body": body, "shared": shared} if shared else {"body": body})
        groups[name] = compact_rows

    # Preserve the rest of the original statistics verbatim. In particular, this
    # must not strip match facts or change qualified pair social observations.
    player_refs = []
    for original in full.get("participants", []):
        player = original
        engagement = ((player.get("military") or {}).get("engagements") or {})
        evidence = engagement.pop("engagementEvidence", None)
        if evidence is None:
            raise ValueError("Full statistics missing engagement evidence")
        refs = {}
        for name, rows in evidence.items():
            if not isinstance(rows, list):
                raise ValueError("Invalid player engagement group")
            try:
                refs[name] = [unique_ids[id(row)] for row in rows]
            except KeyError as exc:
                raise ValueError("Player references episode outside producer") from exc
        player_refs.append({
            "playerId": player["playerId"], "replaySlot": player["replaySlot"],
            "groups": refs,
        })
    full["sharedEpisodeDelivery"] = {
        "version": VERSION,
        "sourceMode": "producer_unique_episodes",
        "producerGroups": groups,
        "sharedEvidence": shared_values,
        "playerRefs": player_refs,
        "omitted": ["participants[].military.engagements.engagementEvidence"],
    }
    return full


def restore_full_statistics(direct: dict) -> dict:
    """Offline compatibility hydration. Never use on a normal website request."""
    result = deepcopy(direct)
    layer = result.pop("sharedEpisodeDelivery", None)
    if not isinstance(layer, dict) or layer.get("version") != VERSION:
        raise ValueError("Not an approved direct shared projection")
    if set(layer.get("producerGroups", {})) != set(GROUPS):
        raise ValueError("Incomplete shared groups")
    evidence_cache: dict[str, dict] = {}
    for name, rows in layer["producerGroups"].items():
        for index, stored in enumerate(rows):
            if not isinstance(stored, dict) or not isinstance(stored.get("body"), dict):
                raise ValueError("Invalid episode")
            body = stored["body"].copy()
            for field, digest in stored.get("shared", {}).items():
                if field not in SHARED_FIELDS or field in body:
                    raise ValueError("Invalid field reference")
                try:
                    value = layer["sharedEvidence"][digest]
                except KeyError as exc:
                    raise ValueError("Missing shared evidence") from exc
                if _fingerprint(value)[0] != digest:
                    raise ValueError("Shared evidence content corrupted")
                body[field] = value
            evidence_cache[f"{name}/{index}"] = body

    players = result.get("participants", [])
    indices = layer.get("playerRefs", [])
    if len(players) != len(indices):
        raise ValueError("Changed player count")
    for player, row in zip(players, indices):
        if (player.get("playerId"), player.get("replaySlot")) != (row["playerId"], row["replaySlot"]):
            raise ValueError("Changed player identity")
        evidence = {}
        for name, refs in row["groups"].items():
            try:
                evidence[name] = [evidence_cache[ref] for ref in refs]
            except KeyError as exc:
                raise ValueError("Missing producer episode") from exc
        player["military"]["engagements"]["engagementEvidence"] = evidence
    return result


def measure_direct_shape(direct: dict) -> dict:
    layer = direct["sharedEpisodeDelivery"]
    return {
        "uniqueEpisodes": sum(len(v) for v in layer["producerGroups"].values()),
        "sharedEvidenceFields": len(layer["sharedEvidence"]),
        "playerReferences": sum(
            len(refs) for row in layer["playerRefs"]
            for refs in row["groups"].values()
        ),
    }
