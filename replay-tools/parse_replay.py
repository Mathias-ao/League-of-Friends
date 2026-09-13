from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import math
import tempfile
import shutil
import struct
import zlib
from datetime import datetime, timezone
from importlib.metadata import version as package_version
from pathlib import Path
from typing import Any, BinaryIO

from mgz.fast import meta
from mgz.fast.header import parse as parse_header
from canonical_io import EventWriter, SCHEMA_VERSION, json_bytes
from canonical_stream import frames, command_layout, ExactReader
from canonical_projector import CompactProjector
from canonical_run import stage_run, seal_local, compatibility

ADAPTER_SCHEMA_VERSION = "LOF_MGZ_FAST_ADAPTER_V4"
CANONICAL_SCHEMA_VERSION = SCHEMA_VERSION
NORMALIZER_VERSION = "AOF_CANONICAL_NORMALIZER_V1_1"
EXPORTER_VERSION = "AOF_CANONICAL_EXTRACTOR_V1"
ENTITY_DATA_VERSION = "RAW_AOE2_IDS_V1"
PARSER_DISTRIBUTION = "mgz-fast"
MAX_SOURCE_BYTES = 128 * 1024 * 1024
MAX_INFLATED_HEADER_BYTES = 256 * 1024 * 1024

ACTION_EVENT_TYPES: dict[str, str] = {
    "MOVE": "command.move",
    "ORDER": "command.order",
    "PATROL": "command.patrol",
    "DE_ATTACK_MOVE": "command.attack_move",
    "ATTACK_GROUND": "command.attack_ground",
    "SPECIAL": "command.special",
    "STANCE": "command.stance",
    "FORMATION": "command.formation",
    "GUARD": "command.guard_follow",
    "FOLLOW": "command.guard_follow",
    "STOP": "command.stop",
    "REPAIR": "command.repair",
    "UNGARRISON": "command.ungarrison",
    "TOWN_BELL": "command.town_bell",
    "BACK_TO_WORK": "command.back_to_work",
    "DELETE": "command.delete",
    "DE_QUEUE": "command.unit_queue",
    "QUEUE": "command.unit_queue",
    "MULTIQUEUE": "command.unit_queue",
    "MAKE": "command.unit_queue",
    "RESEARCH": "command.research_start",
    "BUILD": "command.build_placement",
    "WALL": "command.wall_placement",
    "GATHER_POINT": "command.rally_point",
    "DE_MULTI_GATHERPOINT": "command.rally_point",
    "BUY": "command.market_buy",
    "SELL": "command.market_sell",
    "TRIBUTE": "command.tribute",
    "DE_TRIBUTE": "command.tribute",
    "FLARE": "command.flare",
    "RESIGN": "command.resign",
    "GAME": "command.game_setting",
    "GATE": "command.gate",
    "DROP_RELIC": "command.drop_relic",
    "AI_ORDER": "command.ai_order",
    "AI_COMMAND": "command.ai_command",
    "DE_AUTOSCOUT": "command.autoscout",
    "DE_TRANSFORM": "command.transform",
    "RATHA_ABILITY": "command.ability",
    "CREATE": "command.create",
    "ADD_WAYPOINT": "command.add_waypoint",
}


def text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace").strip("\x00")
    return str(value)


def enum_name(value: Any) -> str | None:
    if value is None:
        return None
    return getattr(value, "name", None) or str(value)


def integer(value: Any) -> int | None:
    try:
        if isinstance(value, bytes):
            return int.from_bytes(value, "little")
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def finite_number(value: Any) -> float | int | None:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)) and math.isfinite(value):
        return value
    return None


def utc_iso_from_unix(value: Any) -> str | None:
    timestamp = integer(value)
    if timestamp is None or timestamp <= 0:
        return None
    try:
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
    except (OverflowError, OSError, ValueError):
        return None


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def preflight_source(path: Path, *, max_source_bytes: int = MAX_SOURCE_BYTES,
                     max_header_bytes: int = MAX_INFLATED_HEADER_BYTES) -> None:
    """Reject oversized/truncated DE input and header bombs before decoding."""
    size = path.stat().st_size
    if size < 8 or size > max_source_bytes:
        raise ValueError("Replay size is outside the extraction profile limit")
    with path.open('rb') as handle:
        header_length, _ = struct.unpack('<II', handle.read(8))
        if header_length < 8 or header_length > size:
            raise ValueError("Invalid compressed header boundary")
        decoder = zlib.decompressobj(wbits=-15)
        inflated = decoder.decompress(handle.read(header_length - 8), max_header_bytes + 1)
        if len(inflated) > max_header_bytes or decoder.unconsumed_tail:
            raise ValueError("Inflated header exceeds extraction profile limit")
        if not decoder.eof or decoder.unused_data:
            raise ValueError("Incomplete or trailing compressed header data")


def json_safe(value: Any) -> Any:
    if isinstance(value, float) and not math.isfinite(value):
        return {"nonFiniteFloat": str(value)}
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    if isinstance(value, bytes):
        return {"bytesBase64": base64.b64encode(value).decode("ascii")}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, dict):
        return {str(key): json_safe(child) for key, child in value.items()}
    if hasattr(value, "hexdigest"):
        return {"digestAlgorithm": value.name, "digestHex": value.hexdigest()}
    if hasattr(value, "name"):
        return value.name
    raise TypeError(f"Unsupported decoded value type: {type(value).__name__}")


def position(x: Any, y: Any, *, tile_x: int | None = None, tile_y: int | None = None) -> dict[str, Any] | None:
    px = finite_number(x)
    py = finite_number(y)
    if px is None or py is None:
        return None
    return {"x": px, "y": py, "z": None, "tileX": tile_x, "tileY": tile_y}


def evidence(
    classification: str = "A",
    confidence: str = "exact",
    method_version: str = ADAPTER_SCHEMA_VERSION,
    *,
    assumption_codes: list[str] | None = None,
    source_event_ids: list[str] | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    return {
        "classification": classification,
        "confidence": confidence,
        "methodVersion": method_version,
        "assumptionCodes": assumption_codes or [],
        "sourceEventIds": source_event_ids or [],
        "notes": notes,
    }


def entity_ref(namespace: str, raw_id: Any) -> dict[str, Any] | None:
    value = integer(raw_id)
    if value is None:
        return None
    return {
        "namespace": namespace,
        "rawId": value,
        "displayName": None,
        "normalizedKey": None,
        "familyKey": None,
        "lineKey": None,
        "roleKeys": [],
        "normalizationVersion": ENTITY_DATA_VERSION,
    }


# Kept as a local alias for existing exporter call sites.
JsonlGzipWriter = EventWriter


def structured_warning(code: str, message: str, *, severity: str = "warning", operation_ordinal: int | None = None, affected_fields: list[str] | None = None) -> dict[str, Any]:
    return {
        "code": code,
        "severity": severity,
        "message": message,
        "operationOrdinal": operation_ordinal,
        "affectedFields": affected_fields or [],
    }


def extract_players(header: dict[str, Any], warnings: list[str]) -> list[dict[str, Any]]:
    generic_players = {
        integer(player.get("number")): player
        for player in header.get("players", [])
        if 1 <= (integer(player.get("number")) or -1) <= 8
    }

    de_players: dict[int, dict[str, Any]] = {}
    de = header.get("de") or {}
    for player in de.get("players", []) or []:
        slot = integer(player.get("number"))
        if slot is not None and 1 <= slot <= 8:
            de_players[slot] = player

    slots = sorted(set(generic_players) | set(de_players))
    players: list[dict[str, Any]] = []

    for slot in slots:
        generic = generic_players.get(slot, {})
        de_player = de_players.get(slot, {})
        name = text(de_player.get("name")) or text(generic.get("name"))
        if not name:
            warnings.append(f"Replay slot {slot} has no player name and was skipped.")
            continue

        generic_position = generic.get("position") or {}
        objects = list(generic.get("objects") or [])
        players.append({
            "replaySlot": slot,
            "name": name,
            "censoredName": text(de_player.get("censored_name")),
            "profileId": integer(de_player.get("profile_id")),
            "teamId": integer(de_player.get("team_id")),
            "civilizationId": integer(de_player.get("civilization_id")) if de_player else integer(generic.get("civilization_id")),
            "colorId": integer(de_player.get("color_id")) if de_player else integer(generic.get("color_id")),
            "position": {
                "x": finite_number(generic_position.get("x")),
                "y": finite_number(generic_position.get("y")),
            },
            "type": integer(de_player.get("type")) if de_player else integer(generic.get("type")),
            "initialObjectIds": [
                instance_id
                for obj in objects
                if (instance_id := integer(obj.get("instance_id"))) is not None
            ],
            "initialDiplomacyRaw": json_safe(generic.get("diplomacy") or []),
        })

    if not players:
        raise RuntimeError("No playable replay slots (1-8) could be extracted from the header.")
    return players


def recovered_action_code(raw_operation: bytes) -> int | None:
    # ACTION operation layout: op-id(4), action-length(4), action-code(1), ...
    return raw_operation[8] if len(raw_operation) > 8 else None


def action_entity(action_name: str, action_data: dict[str, Any]) -> dict[str, Any] | None:
    if action_name in {"DE_QUEUE", "QUEUE", "MULTIQUEUE", "MAKE"}:
        return entity_ref("aoe2de.unit", action_data.get("unit_id"))
    if action_name == "RESEARCH":
        return entity_ref("aoe2de.technology", action_data.get("technology_id"))
    if action_name in {"BUILD", "WALL"}:
        return entity_ref("aoe2de.building", action_data.get("building_id"))
    if action_name in {"BUY", "SELL"}:
        return entity_ref("aoe2de.resource", action_data.get("resource_id"))
    return None


def action_decode(action_name: str, raw_operation: bytes) -> tuple[dict[str, Any], int | None, str | None]:
    if action_name == "ERROR":
        code = recovered_action_code(raw_operation)
        return ({
            "status": "unknown_action",
            "knownByteCount": None,
            "unknownByteCount": None,
            "unknownBytesBase64": base64.b64encode(raw_operation).decode("ascii"),
            "parserWarningCodes": ["MGZ_FAST_ACTION_DECODE_ERROR"],
        }, code, None)

    # Recognition is not complete decoding: the dependency discards padding,
    # selected research buildings and some named fields. Retain the full frame.
    return ({
        "status": "partial",
        "knownByteCount": None,
        "unknownByteCount": None,
        "unknownBytesBase64": base64.b64encode(raw_operation).decode("ascii"),
        "parserWarningCodes": ["UPSTREAM_BYTE_COVERAGE_UNINSTRUMENTED"],
    }, None, action_name)


def canonical_action_event(
    *,
    ordinal: int,
    elapsed_ms: int,
    op_start: int,
    op_end: int,
    action_type: Any,
    action_data: dict[str, Any],
    raw_operation: bytes,
) -> dict[str, Any]:
    action_name = enum_name(action_type) or "ERROR"
    decode, recovered_code, recovered_name = action_decode(action_name, raw_operation)
    source_code = integer(getattr(action_type, "value", None))
    if action_name == "ERROR":
        source_code = recovered_code

    actor = integer(action_data.get("player_id"))
    target_player = integer(action_data.get("target_player_id"))
    if target_player is None:
        target_player = integer(action_data.get("player_id_to"))

    object_ids = [
        value for value in (integer(item) for item in (action_data.get("object_ids") or [])) if value is not None
    ]
    target_instance_id = integer(action_data.get("target_id"))

    event_type = ACTION_EVENT_TYPES.get(action_name, "action.unknown" if action_name == "ERROR" else "command.other")
    if action_name == "GAME" and target_player is not None and action_data.get("diplomacy_mode") is not None:
        event_type = "command.diplomacy_change"

    payload = json_safe(action_data)
    payload["_rawOperationBase64"] = base64.b64encode(raw_operation).decode("ascii")
    payload["_rawLayout"] = json_safe(command_layout(raw_operation, action_name))
    return {
        "eventId": f"op-{ordinal:09d}",
        "layer": "parser_fact",
        "eventType": event_type,
        "timestampMs": elapsed_ms,
        "clock": {"syncElapsedMs": elapsed_ms, "restoreOffsetMs": None, "sequence": integer(action_data.get("sequence"))},
        "operationOrdinal": ordinal,
        "byteOffset": op_start,
        "byteOffsetDomain": "original_file",
        "byteLength": max(0, op_end - op_start),
        "sourceOperation": "ACTION",
        "sourceActionCode": source_code,
        "sourceActionName": recovered_name,
        "actorPlayerId": actor,
        "targetPlayerId": target_player,
        "objectInstanceIds": object_ids,
        "targetInstanceId": target_instance_id,
        "entity": action_entity(action_name, action_data),
        "position": position(action_data.get("x"), action_data.get("y")),
        "endPosition": position(action_data.get("x_end"), action_data.get("y_end")),
        "payload": payload,
        "decode": decode,
        "evidence": evidence("A", "low" if action_name == "ERROR" else "high",
                             method_version=EXPORTER_VERSION,
                             notes="Decoded fields are observations; acceptance/completion and unread bytes are not qualified."),
        "dependsOnEventIds": [],
    }


def generic_body_event(
    *,
    ordinal: int,
    elapsed_ms: int,
    op_start: int,
    op_end: int,
    source_operation: str,
    event_type: str,
    payload: dict[str, Any],
    actor_player_id: int | None = None,
    pos: dict[str, Any] | None = None,
    evidence_classification: str = "A",
    decode_status: str = "complete",
    parser_warning_codes: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "eventId": f"op-{ordinal:09d}",
        "layer": "parser_fact",
        "eventType": event_type,
        "timestampMs": elapsed_ms,
        "clock": {"syncElapsedMs": elapsed_ms, "restoreOffsetMs": None, "sequence": None},
        "operationOrdinal": ordinal,
        "byteOffset": op_start,
        "byteOffsetDomain": "original_file",
        "byteLength": max(0, op_end - op_start),
        "sourceOperation": source_operation,
        "sourceActionCode": None,
        "sourceActionName": None,
        "actorPlayerId": actor_player_id,
        "targetPlayerId": None,
        "objectInstanceIds": [],
        "targetInstanceId": None,
        "entity": None,
        "position": pos,
        "endPosition": None,
        "payload": json_safe(payload),
        "decode": {
            "status": decode_status,
            "knownByteCount": None,
            "unknownByteCount": None,
            "unknownBytesBase64": None,
            "parserWarningCodes": parser_warning_codes or [],
        },
        "evidence": evidence(evidence_classification, "exact"),
        "dependsOnEventIds": [],
    }


def parse_body(
    path: Path,
    players: list[dict[str, Any]],
    warnings: list[str],
    fact_writer: EventWriter | None,
    structured_warnings: list[dict[str, Any]],
    *,
    body_offset: int | None = None,
    pov_player_id: int | None = None,
) -> dict[str, Any]:
    projector = CompactProjector({player["replaySlot"] for player in players})
    elapsed_ms = 0
    with path.open("rb") as handle:
        eof = os.fstat(handle.fileno()).st_size
        if body_offset is None:
            header = parse_header(handle)
            pov_player_id = integer((header.get("metadata") or {}).get("owner_id"))
            meta(ExactReader(handle, eof))
            body_offset = handle.tell()
        handle.seek(body_offset)
        for ordinal, (op_name, payload, begin, end, raw, error) in enumerate(frames(handle, eof)):
            if op_name == "ACTION":
                action_type, data = payload
                event = canonical_action_event(ordinal=ordinal, elapsed_ms=elapsed_ms,
                    op_start=begin, op_end=end, action_type=action_type,
                    action_data=data, raw_operation=raw)
            else:
                fields: dict[str, Any] = {}
                actor, pos, classification = None, None, "A"
                event_type = {"SYNC": "clock.sync", "VIEWLOCK": "camera.view", "CHAT": "chat.raw",
                              "POSTGAME": "postgame.block", "START": "match.start", "SAVE": "save.chapter",
                              "UNKNOWN": "operation.unknown"}[op_name]
                if op_name == "SYNC":
                    increment, checksum, data = payload
                    elapsed_ms += int(increment)
                    fields = {"incrementMs": int(increment), "checksum": checksum, "data": json_safe(data)}
                elif op_name == "VIEWLOCK":
                    pos = position(*payload)
                    actor, classification = pov_player_id, "A+E"
                elif op_name == "CHAT":
                    fields = {"text": payload.decode("utf-8", errors="replace").strip("\x00"),
                              "rawBase64": base64.b64encode(payload).decode("ascii")}
                    try:
                        fields["structuredChat"] = json.loads(fields["text"])
                    except (ValueError, TypeError):
                        pass
                elif op_name == "POSTGAME":
                    fields = {"decoded": json_safe(payload)}
                else:
                    fields = {"rawOperationCode": int.from_bytes(raw[:4], "little") if len(raw) >= 4 else None}
                if error:
                    fields["failure"] = error
                    message = f"Body framing stopped at byte {begin}: {error}; entire tail retained."
                    warnings.append(message)
                    structured_warnings.append(structured_warning("BODY_OPERATION_PARSE_FAILED", message,
                        severity="error", operation_ordinal=ordinal, affected_fields=["factStore", "match.durationMs"]))
                fields["_rawOperationBase64"] = base64.b64encode(raw).decode("ascii")
                # Only an increment-only sync frame has fully accounted bytes here.
                status = "failed" if error else "complete" if op_name == "SYNC" and len(raw) == 8 else "partial"
                event = generic_body_event(ordinal=ordinal, elapsed_ms=elapsed_ms, op_start=begin, op_end=end,
                    source_operation=op_name, event_type=event_type, payload=fields,
                    actor_player_id=actor, pos=pos, evidence_classification=classification, decode_status=status)
                event["decode"].update(knownByteCount=len(raw) if status == "complete" else None,
                    unknownByteCount=0 if status == "complete" else None,
                    unknownBytesBase64=None if status == "complete" else base64.b64encode(raw).decode("ascii"),
                    parserWarningCodes=[] if status == "complete" else ["FRAMING_FAILED" if error else "UPSTREAM_BYTE_COVERAGE_UNINSTRUMENTED"])
                event["evidence"]["methodVersion"] = EXPORTER_VERSION
                event["evidence"]["confidence"] = "low" if error else "high"
            if fact_writer is not None:
                fact_writer.write(event)
            projector.consume(event)
    body = projector.finish()
    if not body["totalSyncOperations"]:
        warnings.append("Replay contained no SYNC operations; no duration qualification.")
        structured_warnings.append(structured_warning("NO_SYNC_OPERATIONS",
            "Observed sync duration is zero; full game duration is unavailable.", affected_fields=["match.durationMs"]))
    return body


def write_initial_state_stores(header: dict[str, Any], canonical_dir: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    terrain_path = canonical_dir / "terrain.jsonl.gz"
    objects_path = canonical_dir / "initial-objects.jsonl.gz"
    terrain_writer = JsonlGzipWriter(terrain_path)
    object_writer = JsonlGzipWriter(objects_path)

    map_data = header.get("map") or {}
    dimension = integer(map_data.get("dimension"))
    tiles = list(map_data.get("tiles") or [])
    if dimension is None or dimension <= 0 or not tiles or len(tiles) % dimension:
        raise ValueError("Map dimensions cannot be established from decoded width and tile count")
    for index, raw_tile in enumerate(tiles):
        tile = list(raw_tile) if isinstance(raw_tile, (list, tuple)) else []
        terrain_raw = integer(tile[0]) if len(tile) > 0 else None
        terrain_id = (terrain_raw & 0xFF) if terrain_raw is not None else None
        elevation = integer(tile[1]) if len(tile) > 1 else None
        x = index % dimension
        y = index // dimension
        terrain_writer.write({
            "eventId": f"tile-{index:08d}",
            "layer": "parser_fact",
            "eventType": "map.tile",
            "timestampMs": 0,
            "clock": {"syncElapsedMs": 0, "restoreOffsetMs": None, "sequence": None},
            "operationOrdinal": index,
            "byteOffset": None,
            "byteOffsetDomain": None,
            "byteLength": None,
            "sourceOperation": "MAP_TILE",
            "sourceActionCode": None,
            "sourceActionName": None,
            "actorPlayerId": None,
            "targetPlayerId": None,
            "objectInstanceIds": [],
            "targetInstanceId": None,
            "entity": entity_ref("aoe2de.terrain", terrain_id),
            "position": position(float(x), float(y), tile_x=x, tile_y=y),
            "endPosition": None,
            "payload": {"terrainId": terrain_id, "terrainRaw": terrain_raw, "elevation": elevation, "raw": json_safe(tile)},
            "decode": {"status": "partial", "knownByteCount": None, "unknownByteCount": None, "unknownBytesBase64": None, "parserWarningCodes": ["RAW_HEADER_RETAINED_SEPARATELY"]},
            "evidence": evidence(),
            "dependsOnEventIds": [],
        })

    object_ordinal = 0
    for raw_player in header.get("players", []) or []:
        owner = integer(raw_player.get("number"))
        for obj in raw_player.get("objects", []) or []:
            instance_id = integer(obj.get("instance_id"))
            raw_object_id = integer(obj.get("object_id"))
            raw_position = obj.get("position") or {}
            object_writer.write({
                "eventId": f"initial-object-{object_ordinal:08d}",
                "layer": "parser_fact",
                "eventType": "object.initial",
                "timestampMs": 0,
                "clock": {"syncElapsedMs": 0, "restoreOffsetMs": None, "sequence": None},
                "operationOrdinal": object_ordinal,
                "byteOffset": None,
                "byteOffsetDomain": None,
                "byteLength": None,
                "sourceOperation": "INITIAL_OBJECT",
                "sourceActionCode": None,
                "sourceActionName": None,
                "actorPlayerId": None,
                "targetPlayerId": None,
                "objectInstanceIds": [instance_id] if instance_id is not None else [],
                "targetInstanceId": None,
                "entity": entity_ref("aoe2de.object", raw_object_id),
                "position": position(raw_position.get("x"), raw_position.get("y")),
                "endPosition": None,
                "payload": {
                    "ownerPlayerId": owner,
                    "objectId": raw_object_id,
                    "classId": integer(obj.get("class_id")),
                    "instanceId": instance_id,
                    "objectBlockIndex": integer(obj.get("index")),
                    "rawDecodedObject": json_safe(obj),
                },
                "decode": {"status": "partial", "knownByteCount": None, "unknownByteCount": None, "unknownBytesBase64": None, "parserWarningCodes": ["HEADER_OBJECT_SEARCH_NOT_EXHAUSTIVE", "RAW_HEADER_RETAINED_SEPARATELY"]},
                "evidence": evidence(),
                "dependsOnEventIds": [],
            })
            object_ordinal += 1

    return terrain_writer.close(), object_writer.close()


def canonical_participants(players: list[dict[str, Any]], header: dict[str, Any]) -> list[dict[str, Any]]:
    pov = integer((header.get("metadata") or {}).get("owner_id"))
    result: list[dict[str, Any]] = []
    for player in players:
        slot = int(player["replaySlot"])
        if player.get("civilizationId") is None:
            raise ValueError(f"Missing civilization ID for slot {slot}; header retained only on diagnostic failure")
        result.append({
            "playerId": slot,
            "number": slot,
            "name": player["name"],
            "profileId": player.get("profileId"),
            "platformIdentity": None,
            "civilization": entity_ref("aoe2de.civilization", player.get("civilizationId")),
            "colorId": player.get("colorId"),
            "lobbyTeamId": player.get("teamId"),
            "isHuman": None,
            "isRecorder": slot == pov,
            "initialObjectIds": player.get("initialObjectIds") or [],
            "ratingSnapshots": [],
        })
    return result


def build_settings(header: dict[str, Any], players: list[dict[str, Any]]) -> dict[str, Any]:
    lobby = header.get("lobby") or {}
    scenario = header.get("scenario") or {}
    metadata = header.get("metadata") or {}
    de = header.get("de") or {}
    return {
        "mapId": integer(scenario.get("map_id")) or integer(de.get("rms_map_id")),
        "rmsFilename": text(de.get("rms_filename")),
        "rmsModId": text(de.get("rms_mod_id")),
        "difficultyId": integer(scenario.get("difficulty_id")) or integer(de.get("difficulty_id")),
        "mapSize": integer(lobby.get("map_size")),
        "population": integer(lobby.get("population")) or integer(de.get("population_limit")),
        "gameTypeId": integer(lobby.get("game_type_id")),
        "revealMapId": integer(lobby.get("reveal_map_id")),
        "seed": integer(lobby.get("seed")),
        "lockTeams": bool(lobby.get("lock_teams")) if lobby.get("lock_teams") is not None else bool(de.get("lock_teams")) if de.get("lock_teams") is not None else None,
        "speed": finite_number(metadata.get("speed")) or finite_number(de.get("speed")),
        "rated": bool(de.get("rated")) if de.get("rated") is not None else None,
        "victoryTypeId": integer(de.get("victory_type_id")),
        "startingResourcesId": integer(de.get("starting_resources_id")),
        "startingAgeId": integer(de.get("starting_age_id")),
        "endingAgeId": integer(de.get("ending_age_id")),
        "treatyLength": integer(de.get("treaty_length")),
        "teamTogether": bool(de.get("team_together")) if de.get("team_together") is not None else None,
        "multiplayer": bool(de.get("multiplayer")) if de.get("multiplayer") is not None else None,
        "allTechnologies": bool(de.get("all_technologies")) if de.get("all_technologies") is not None else None,
        "initialDiplomacyRaw": {
            str(player["replaySlot"]): player.get("initialDiplomacyRaw") or [] for player in players
        },
    }


def build_canonical_manifest(
    *,
    path: Path,
    header: dict[str, Any],
    players: list[dict[str, Any]],
    body: dict[str, Any],
    terrain_store: dict[str, Any],
    object_store: dict[str, Any],
    fact_store: dict[str, Any],
    source_hash: str,
    parsed_at: str,
    structured_warnings: list[dict[str, Any]],
) -> dict[str, Any]:
    de = header.get("de") or {}
    map_data = header.get("map") or {}
    scenario = header.get("scenario") or {}
    lobby = header.get("lobby") or {}
    metadata = header.get("metadata") or {}
    dimension = integer(map_data.get("dimension"))
    if not dimension or len(map_data.get("tiles") or []) % dimension:
        raise ValueError("Invalid decoded map dimensions")
    parser_version = package_version(PARSER_DISTRIBUTION)

    # A successful parse is not cross-version or field-semantic qualification.
    compatibility_status = "degraded" if compatibility(header)['status'] == 'fixture_regression_only' else "unsupported"

    return {
        "schemaVersion": CANONICAL_SCHEMA_VERSION,
        "versions": {
            "parserVersion": f"{PARSER_DISTRIBUTION}/{parser_version}",
            "schemaVersion": CANONICAL_SCHEMA_VERSION,
            "normalizerVersion": NORMALIZER_VERSION,
            "entityDataVersion": ENTITY_DATA_VERSION,
            "reconstructionVersion": None,
            "spatialModelVersion": None,
            "interactionModelVersion": None,
        },
        "source": {
            "fileName": path.name,
            "sha256": source_hash,
            "byteLength": path.stat().st_size,
            "format": "aoe2record",
            "saveVersion": header.get("save_version"),
            "logVersion": integer(header.get("log_version")),
            "gameBuild": integer(de.get("build")),
            "recordedAt": utc_iso_from_unix(de.get("timestamp")),
            "parsedAt": parsed_at,
            "povPlayerId": integer(metadata.get("owner_id")),
            "retainedReplay": None,
            "compatibility": {
                "status": compatibility_status,
                "upstreamParser": f"{PARSER_DISTRIBUTION}/{parser_version}",
                "formatPatches": [],
                "decodeCoveragePercent": body.get("decodeCoveragePercent", 0),
            },
        },
        "match": {
            "matchId": "replay:" + source_hash,
            "guid": text(de.get("guid")),
            "durationMs": int(body.get("durationMs") or 0),
            "completionStatus": "restored" if (integer(map_data.get("restore_time")) or 0) > 0 else "unknown",
            "winnerPlayerIds": [],
            "winnerTeamIds": [],
            "settings": build_settings(header, players),
            "privacy": {
                "containsChat": int(body.get("chatOperationsTotal") or 0) > 0,
                "containsPlayerNames": True,
                "retentionPolicyId": "temporary_until_verified_canonical_persistence",
            },
        },
        "participants": canonical_participants(players, header),
        "teams": [],
        "initialDiplomacy": [],
        "initialState": {
            "map": {
                "mapId": integer(scenario.get("map_id")) or integer(de.get("rms_map_id")),
                "mapName": None,
                "rmsFileName": text(de.get("rms_filename")),
                "rmsModId": text(de.get("rms_mod_id")),
                "seed": integer(lobby.get("seed")),
                "width": dimension,
                "height": len(map_data["tiles"]) // dimension,
                "coordinateSystem": "aoe2_world_xy_origin_top_left",
                "terrainStore": {
                    "recordCount": terrain_store["recordCount"],
                    "chunks": terrain_store["chunks"],
                    "operationCounts": {},
                    "actionCounts": {},
                    "unknownActionCounts": {},
                },
            },
            "objectStore": {
                "recordCount": object_store["recordCount"],
                "chunks": object_store["chunks"],
                "operationCounts": {},
                "actionCounts": {},
                "unknownActionCounts": {},
            },
            "startAnchors": [],
        },
        "factStore": {
            "recordCount": fact_store["recordCount"],
            "chunks": fact_store["chunks"],
            "operationCounts": body.get("operationCounts") or {},
            "actionCounts": body.get("allActionCounts") or {},
            "unknownActionCounts": body.get("unknownActionCounts") or {},
        },
        "reconstructionSets": [],
        "interactionSets": [],
        "metricSets": [],
        "leagueInterpretationRefs": [],
        "warnings": structured_warnings,
    }


def build_payload(path: Path, canonical_dir: Path | None = None) -> dict[str, Any]:
    """Stage and validate before publishing; never replace an existing bundle.

    The legacy compact-only call remains available for current admin ingestion.
    It uses the same canonical event projector but is not archival extraction.
    """
    if canonical_dir is None:
        return _build_payload(path, None)
    canonical_dir = canonical_dir.resolve()
    if canonical_dir.exists():
        raise FileExistsError(f"Canonical bundle already exists: {canonical_dir}; select a new run directory")
    canonical_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".canonical-stage-", dir=canonical_dir.parent))
    try:
        result = _build_payload(path, staging)
        if canonical_dir.exists():
            raise FileExistsError(f"Canonical destination appeared during extraction: {canonical_dir}")
        staging.rename(canonical_dir)
        return result
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def _build_payload(path: Path, canonical_dir: Path | None) -> dict[str, Any]:
    warnings: list[str] = []
    structured_warnings: list[dict[str, Any]] = []
    parsed_at = datetime.now(timezone.utc).isoformat()
    preflight_source(path)
    source_hash = file_sha256(path)

    with path.open("rb") as handle:
        header = parse_header(handle)
        meta(ExactReader(handle, path.stat().st_size))
        body_offset = handle.tell()
        handle.seek(0)
        prefix = handle.read(body_offset)

    players = extract_players(header, warnings)
    fact_writer: JsonlGzipWriter | None = None
    terrain_store: dict[str, Any] | None = None
    object_store: dict[str, Any] | None = None
    fact_store: dict[str, Any] | None = None
    manifest_path: Path | None = None

    if canonical_dir is not None:
        canonical_dir.mkdir(parents=True, exist_ok=True)
        terrain_store, object_store = write_initial_state_stores(header, canonical_dir)
        fact_writer = JsonlGzipWriter(canonical_dir / "facts.jsonl.gz")

    body = parse_body(path, players, warnings, fact_writer, structured_warnings,
                      body_offset=body_offset, pov_player_id=integer((header.get("metadata") or {}).get("owner_id")))
    if file_sha256(path) != source_hash:
        raise RuntimeError("Source changed during extraction; refusing to publish evidence")

    if fact_writer is not None:
        fact_store = fact_writer.close()
        assert terrain_store is not None and object_store is not None
        canonical = build_canonical_manifest(
            path=path,
            header=header,
            players=players,
            body=body,
            terrain_store=terrain_store,
            object_store=object_store,
            fact_store=fact_store,
            source_hash=source_hash,
            parsed_at=parsed_at,
            structured_warnings=structured_warnings,
        )
        manifest_path = canonical_dir / "canonical-replay.json"
        manifest_path.write_bytes(json_bytes(canonical))
        run = stage_run(canonical_dir, canonical, header, prefix, body, players, json_safe(header))
        seal_local(canonical_dir, run)

    de = header.get("de") or {}
    replay = {
        "format": enum_name(header.get("version")),
        "gameVersion": text(header.get("game_version")),
        "saveVersion": finite_number(header.get("save_version")),
        "logVersion": integer(header.get("log_version")),
        "build": integer(de.get("build")),
        "timestamp": integer(de.get("timestamp")),
        "guid": text(de.get("guid")),
        "fileSizeBytes": path.stat().st_size,
    }

    payload = {
        "replay": replay,
        "settings": build_settings(header, players),
        "players": players,
        "mapSummary": {
            "dimension": integer((header.get("map") or {}).get("dimension")),
            "tileCount": len((header.get("map") or {}).get("tiles") or []),
            "restoreTime": integer((header.get("map") or {}).get("restore_time")),
            "allVisible": bool((header.get("map") or {}).get("all_visible")) if (header.get("map") or {}).get("all_visible") is not None else None,
            "initialObjectCount": sum(len(player.get("objects") or []) for player in (header.get("players") or [])),
        },
        "body": body,
        "canonicalBundle": None if manifest_path is None else {
            "schemaVersion": CANONICAL_SCHEMA_VERSION,
            "manifestFile": manifest_path.name,
            "manifestSha256": file_sha256(manifest_path),
            "terrain": terrain_store,
            "initialObjects": object_store,
            "facts": fact_store,
        },
    }

    return {
        "parserName": PARSER_DISTRIBUTION,
        "parserVersion": package_version(PARSER_DISTRIBUTION),
        "schemaVersion": ADAPTER_SCHEMA_VERSION,
        "sourceHash": source_hash,
        "sourceFileName": path.name,
        "parserExtractedAt": parsed_at,
        "sourcePlayers": [
            {"replaySlot": player["replaySlot"], "sourceName": player["name"]} for player in players
        ],
        "warnings": warnings,
        "payload": payload,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse an AoE2 recorded game into the Age of Friends V4 replay adapter and optional CanonicalReplay bundle.")
    parser.add_argument("replay", type=Path, help="Path to .aoe2record/.mgz file")
    parser.add_argument("--out", type=Path, help="Adapter JSON output path. Defaults to stdout.")
    parser.add_argument("--canonical-dir", type=Path, help="Optional directory for CanonicalReplay manifest + gzipped fact stores.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print adapter JSON.")
    args = parser.parse_args()

    replay_path = args.replay.expanduser().resolve()
    if not replay_path.exists() or not replay_path.is_file():
        raise SystemExit(f"Replay file not found: {replay_path}")

    canonical_dir = args.canonical_dir.expanduser().resolve() if args.canonical_dir else None
    result = build_payload(replay_path, canonical_dir)
    serialized = json.dumps(result, indent=2 if args.pretty else None, ensure_ascii=False, allow_nan=False)

    if args.out:
        output_path = args.out.expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(serialized + "\n", encoding="utf-8")
        print(f"Wrote replay adapter to {output_path}")
        if canonical_dir:
            print(f"Wrote CanonicalReplay bundle to {canonical_dir}")
    else:
        print(serialized)
    if not result["payload"]["body"]["bodyParseComplete"]:
        raise SystemExit("Incomplete body extraction; diagnostic evidence retained, source must not be deleted or ingested as complete.")


if __name__ == "__main__":
    main()
