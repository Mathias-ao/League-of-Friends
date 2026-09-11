from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone
from importlib.metadata import version as package_version
from pathlib import Path
from typing import Any, BinaryIO

from mgz.fast import meta, operation, save as parse_save, start as parse_start
from mgz.fast.enums import Action, Operation
from mgz.fast.header import parse as parse_header

ADAPTER_SCHEMA_VERSION = "LOF_MGZ_FAST_ADAPTER_V3"
CANONICAL_SCHEMA_VERSION = "1.0.0"
NORMALIZER_VERSION = "LOF_CANONICAL_NORMALIZER_V1"
ENTITY_DATA_VERSION = "RAW_AOE2_IDS_V1"
PARSER_DISTRIBUTION = "mgz-fast"

PARTIAL_ACTION_PREFIXES = ("DE_UNKNOWN_", "HD_UNKNOWN_")

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
    if isinstance(value, (int, float)):
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


def json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    if isinstance(value, bytes):
        return {"bytesBase64": base64.b64encode(value).decode("ascii")}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, dict):
        return {str(key): json_safe(child) for key, child in value.items()}
    name = enum_name(value)
    return name if name is not None else repr(value)


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


def artifact_ref(path: Path, *, encoding: str, record_count: int | None = None, first_ordinal: int | None = None, last_ordinal: int | None = None) -> dict[str, Any]:
    return {
        "uri": path.name,
        "sha256": file_sha256(path),
        "byteLength": path.stat().st_size,
        "encoding": encoding,
        "contentType": "application/x-ndjson" if "jsonl" in encoding else "application/json",
        "recordCount": record_count,
        "firstOrdinal": first_ordinal,
        "lastOrdinal": last_ordinal,
    }


class JsonlGzipWriter:
    def __init__(self, path: Path):
        self.path = path
        self.handle = gzip.open(path, "wt", encoding="utf-8", newline="\n")
        self.record_count = 0
        self.first_ordinal: int | None = None
        self.last_ordinal: int | None = None

    def write(self, record: dict[str, Any]) -> None:
        ordinal = integer(record.get("operationOrdinal"))
        if ordinal is not None:
            if self.first_ordinal is None:
                self.first_ordinal = ordinal
            self.last_ordinal = ordinal
        self.handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
        self.handle.write("\n")
        self.record_count += 1

    def close(self) -> dict[str, Any]:
        self.handle.close()
        return artifact_ref(
            self.path,
            encoding="jsonl_gzip",
            record_count=self.record_count,
            first_ordinal=self.first_ordinal,
            last_ordinal=self.last_ordinal,
        )


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


def compact_event(slot: int, elapsed_ms: int, **fields: Any) -> dict[str, Any]:
    return {"replaySlot": slot, "atMs": elapsed_ms, **fields}


def read_operation_bytes(handle: BinaryIO, start: int, end: int) -> bytes:
    current = handle.tell()
    try:
        handle.seek(start)
        return handle.read(max(0, end - start))
    finally:
        handle.seek(current)


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
            "unknownByteCount": len(raw_operation),
            "unknownBytesBase64": base64.b64encode(raw_operation).decode("ascii"),
            "parserWarningCodes": ["MGZ_FAST_ACTION_DECODE_ERROR"],
        }, code, None)

    partial = action_name.startswith(PARTIAL_ACTION_PREFIXES)
    return ({
        "status": "partial" if partial else "complete",
        "knownByteCount": None,
        "unknownByteCount": None,
        "unknownBytesBase64": None,
        "parserWarningCodes": ["KNOWN_ACTION_SEMANTICS_PARTIAL"] if partial else [],
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
    return {
        "eventId": f"op-{ordinal:09d}",
        "layer": "parser_fact",
        "eventType": event_type,
        "timestampMs": elapsed_ms,
        "clock": {"syncElapsedMs": elapsed_ms, "restoreOffsetMs": None, "sequence": integer(action_data.get("sequence"))},
        "operationOrdinal": ordinal,
        "byteOffset": op_start,
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
        "evidence": evidence("A", "exact" if decode["status"] == "complete" else "low"),
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
    fact_writer: JsonlGzipWriter | None,
    structured_warnings: list[dict[str, Any]],
) -> dict[str, Any]:
    action_counts: dict[int, Counter[str]] = defaultdict(Counter)
    action_seconds: dict[int, Counter[int]] = defaultdict(Counter)
    build_counts: dict[int, Counter[str]] = defaultdict(Counter)
    build_events: list[dict[str, Any]] = []
    wall_events: list[dict[str, Any]] = []
    production_events: list[dict[str, Any]] = []
    research_events: list[dict[str, Any]] = []
    market_events: list[dict[str, Any]] = []
    tribute_events: list[dict[str, Any]] = []
    diplomacy_events: list[dict[str, Any]] = []
    flare_events: list[dict[str, Any]] = []
    resignations: list[dict[str, Any]] = []
    operation_counts: Counter[str] = Counter()
    all_action_counts: Counter[str] = Counter()
    unknown_action_counts: Counter[str] = Counter()
    action_payload_keys: dict[str, Counter[str]] = defaultdict(Counter)

    elapsed_ms = 0
    total_actions = 0
    total_syncs = 0
    camera_points = 0
    chat_operations = 0
    body_complete = True
    operation_ordinal = 0
    valid_slots = {player["replaySlot"] for player in players}
    pov_player_id: int | None = None

    with path.open("rb") as handle:
        eof = os.fstat(handle.fileno()).st_size
        header = parse_header(handle)
        metadata = header.get("metadata") or {}
        pov_player_id = integer(metadata.get("owner_id"))
        meta(handle)

        while handle.tell() < eof:
            op_start = handle.tell()
            peek = handle.read(4)
            if len(peek) < 4:
                break
            raw_operation_code = int.from_bytes(peek, "little")
            handle.seek(op_start)
            try:
                if raw_operation_code == Operation.START.value:
                    handle.read(4)
                    parse_start(handle)
                    op_type, payload = Operation.START, None
                elif raw_operation_code == Operation.SAVE.value:
                    handle.read(4)
                    parse_save(handle)
                    op_type, payload = Operation.SAVE, None
                else:
                    op_type, payload = operation(handle)
            except EOFError:
                break
            except Exception as exc:  # Deliberately fail closed: no silent operation loss.
                op_end = handle.tell()
                body_complete = False
                message = f"Body parser stopped at byte {op_start}: {type(exc).__name__}: {exc}"
                warnings.append(message)
                structured_warnings.append(structured_warning(
                    "BODY_OPERATION_PARSE_FAILED",
                    message,
                    severity="error",
                    operation_ordinal=operation_ordinal,
                    affected_fields=["factStore", "durationMs"],
                ))
                if fact_writer is not None:
                    raw = read_operation_bytes(handle, op_start, max(op_start + 1, op_end))
                    fact_writer.write({
                        "eventId": f"op-{operation_ordinal:09d}",
                        "layer": "parser_fact",
                        "eventType": "action.unknown",
                        "timestampMs": elapsed_ms,
                        "clock": {"syncElapsedMs": elapsed_ms, "restoreOffsetMs": None, "sequence": None},
                        "operationOrdinal": operation_ordinal,
                        "byteOffset": op_start,
                        "byteLength": len(raw),
                        "sourceOperation": "SAVE",
                        "sourceActionCode": None,
                        "sourceActionName": None,
                        "actorPlayerId": None,
                        "targetPlayerId": None,
                        "objectInstanceIds": [],
                        "targetInstanceId": None,
                        "entity": None,
                        "position": None,
                        "endPosition": None,
                        "payload": {"exceptionType": type(exc).__name__, "message": str(exc)},
                        "decode": {
                            "status": "failed",
                            "knownByteCount": None,
                            "unknownByteCount": len(raw),
                            "unknownBytesBase64": base64.b64encode(raw).decode("ascii"),
                            "parserWarningCodes": ["BODY_OPERATION_PARSE_FAILED"],
                        },
                        "evidence": evidence("A", "low", notes="Raw bytes retained for the parser failure span."),
                        "dependsOnEventIds": [],
                    })
                break

            op_end = handle.tell()
            op_name = enum_name(op_type) or "UNKNOWN"
            operation_counts[op_name] += 1

            if op_type == Operation.SYNC:
                increment, checksum, sync_data = payload
                elapsed_ms += int(increment)
                total_syncs += 1
                if fact_writer is not None:
                    fact_writer.write(generic_body_event(
                        ordinal=operation_ordinal,
                        elapsed_ms=elapsed_ms,
                        op_start=op_start,
                        op_end=op_end,
                        source_operation="SYNC",
                        event_type="clock.sync",
                        payload={"incrementMs": int(increment), "checksum": checksum, "data": sync_data},
                    ))
                operation_ordinal += 1
                continue

            if op_type == Operation.VIEWLOCK:
                camera_points += 1
                x, y = payload
                if fact_writer is not None:
                    fact_writer.write(generic_body_event(
                        ordinal=operation_ordinal,
                        elapsed_ms=elapsed_ms,
                        op_start=op_start,
                        op_end=op_end,
                        source_operation="VIEWLOCK",
                        event_type="camera.view",
                        payload={},
                        actor_player_id=pov_player_id,
                        pos=position(x, y),
                        evidence_classification="A+E",
                    ))
                operation_ordinal += 1
                continue

            if op_type == Operation.CHAT:
                chat_operations += 1
                raw = payload if isinstance(payload, bytes) else bytes()
                if fact_writer is not None:
                    fact_writer.write(generic_body_event(
                        ordinal=operation_ordinal,
                        elapsed_ms=elapsed_ms,
                        op_start=op_start,
                        op_end=op_end,
                        source_operation="CHAT",
                        event_type="chat.raw",
                        payload={
                            "text": raw.decode("utf-8", errors="replace").strip("\x00"),
                            "rawBase64": base64.b64encode(raw).decode("ascii"),
                        },
                    ))
                operation_ordinal += 1
                continue

            if op_type == Operation.POSTGAME:
                if fact_writer is not None:
                    fact_writer.write(generic_body_event(
                        ordinal=operation_ordinal,
                        elapsed_ms=elapsed_ms,
                        op_start=op_start,
                        op_end=op_end,
                        source_operation="POSTGAME",
                        event_type="postgame.block",
                        payload={"decoded": payload},
                    ))
                operation_ordinal += 1
                continue

            if op_type == Operation.START:
                if fact_writer is not None:
                    fact_writer.write(generic_body_event(
                        ordinal=operation_ordinal,
                        elapsed_ms=elapsed_ms,
                        op_start=op_start,
                        op_end=op_end,
                        source_operation="START",
                        event_type="match.start",
                        payload={"rawOperationCode": raw_operation_code},
                    ))
                operation_ordinal += 1
                continue

            if op_type == Operation.SAVE:
                raw = read_operation_bytes(handle, op_start, op_end)
                inferred_save = raw_operation_code != Operation.SAVE.value
                if fact_writer is not None:
                    fact_writer.write(generic_body_event(
                        ordinal=operation_ordinal,
                        elapsed_ms=elapsed_ms,
                        op_start=op_start,
                        op_end=op_end,
                        source_operation="SAVE",
                        event_type="save.chapter",
                        payload={
                            "rawOperationCode": raw_operation_code,
                            "rawBase64": base64.b64encode(raw).decode("ascii") if inferred_save else None,
                        },
                        decode_status="partial" if inferred_save else "complete",
                        parser_warning_codes=["UNKNOWN_OPERATION_INTERPRETED_AS_SAVE"] if inferred_save else [],
                    ))
                operation_ordinal += 1
                continue

            if op_type != Operation.ACTION:
                operation_ordinal += 1
                continue

            action_type, action_data = payload
            action_data = action_data if isinstance(action_data, dict) else {}
            total_actions += 1
            action_name = enum_name(action_type) or "ERROR"
            all_action_counts[action_name] += 1
            for key in action_data:
                action_payload_keys[action_name][str(key)] += 1

            player_id = integer(action_data.get("player_id"))
            if player_id in valid_slots:
                action_counts[player_id][action_name] += 1
                action_seconds[player_id][elapsed_ms // 1000] += 1

            if action_name == "ERROR":
                raw_operation = read_operation_bytes(handle, op_start, op_end)
                raw_code = recovered_action_code(raw_operation)
                unknown_action_counts[str(raw_code) if raw_code is not None else "unknown"] += 1
            else:
                raw_operation = b""

            if action_type == Action.RESIGN and player_id in valid_slots:
                resignations.append(compact_event(player_id, elapsed_ms))

            elif action_type == Action.RESEARCH and player_id in valid_slots:
                research_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    technologyId=integer(action_data.get("technology_id")),
                    producerObjectIds=[value for value in (integer(item) for item in (action_data.get("object_ids") or [])) if value is not None],
                ))

            elif action_type == Action.BUILD and player_id in valid_slots:
                building_id = integer(action_data.get("building_id"))
                if building_id is not None:
                    build_counts[player_id][str(building_id)] += 1
                build_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    buildingId=building_id,
                    builderObjectIds=[value for value in (integer(item) for item in (action_data.get("object_ids") or [])) if value is not None],
                    x=finite_number(action_data.get("x")),
                    y=finite_number(action_data.get("y")),
                ))

            elif action_type == Action.WALL and player_id in valid_slots:
                wall_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    buildingId=integer(action_data.get("building_id")),
                    builderObjectIds=[value for value in (integer(item) for item in (action_data.get("object_ids") or [])) if value is not None],
                    x=finite_number(action_data.get("x")),
                    y=finite_number(action_data.get("y")),
                    xEnd=finite_number(action_data.get("x_end")),
                    yEnd=finite_number(action_data.get("y_end")),
                ))

            elif action_type in (Action.DE_QUEUE, Action.QUEUE, Action.MULTIQUEUE, Action.MAKE) and player_id in valid_slots:
                raw_amount = integer(action_data.get("amount"))
                producer_ids = [value for value in (integer(item) for item in (action_data.get("object_ids") or [])) if value is not None]
                production_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    commandType=action_name,
                    unitId=integer(action_data.get("unit_id")),
                    amount=raw_amount if raw_amount is not None and raw_amount > 0 else 1,
                    signedAmount=raw_amount,
                    buildingId=integer(action_data.get("building_id")),
                    producerObjectIds=producer_ids,
                ))

            elif action_type in (Action.BUY, Action.SELL) and player_id in valid_slots:
                market_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    type=action_name,
                    resourceId=integer(action_data.get("resource_id")),
                    amount=finite_number(action_data.get("amount")),
                    marketObjectIds=[value for value in (integer(item) for item in (action_data.get("object_ids") or [])) if value is not None],
                ))

            elif action_type in (Action.TRIBUTE, Action.DE_TRIBUTE) and player_id in valid_slots:
                tribute_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    targetReplaySlot=integer(action_data.get("target_player_id")) or integer(action_data.get("player_id_to")),
                    resourceId=integer(action_data.get("resource_id")),
                    amount=finite_number(action_data.get("amount")),
                    fee=finite_number(action_data.get("fee")),
                    food=finite_number(action_data.get("food")),
                    wood=finite_number(action_data.get("wood")),
                    gold=finite_number(action_data.get("gold")),
                    stone=finite_number(action_data.get("stone")),
                ))

            if action_type == Action.GAME and player_id in valid_slots and action_data.get("target_player_id") is not None:
                diplomacy_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    targetReplaySlot=integer(action_data.get("target_player_id")),
                    diplomacyMode=integer(action_data.get("diplomacy_mode")),
                    commandId=integer(action_data.get("command_id")),
                ))

            if action_type == Action.FLARE and player_id in valid_slots:
                flare_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    x=finite_number(action_data.get("x")),
                    y=finite_number(action_data.get("y")),
                    targets=json_safe(action_data.get("targets") or []),
                ))

            if fact_writer is not None:
                if not raw_operation:
                    raw_operation = b""
                fact_writer.write(canonical_action_event(
                    ordinal=operation_ordinal,
                    elapsed_ms=elapsed_ms,
                    op_start=op_start,
                    op_end=op_end,
                    action_type=action_type,
                    action_data=action_data,
                    raw_operation=raw_operation,
                ))

            operation_ordinal += 1

    if total_syncs == 0:
        warnings.append("Replay body contained no SYNC operations; duration may be unavailable.")
        structured_warnings.append(structured_warning(
            "NO_SYNC_OPERATIONS",
            "Replay body contained no SYNC operations; duration may be unavailable.",
            affected_fields=["match.durationMs"],
        ))

    decoded_actions = total_actions - sum(unknown_action_counts.values())
    decode_coverage = round((decoded_actions / total_actions * 100), 3) if total_actions else 0.0

    return {
        "durationMs": elapsed_ms,
        "totalActions": total_actions,
        "totalSyncOperations": total_syncs,
        "bodyParseComplete": body_complete,
        "decodeCoveragePercent": decode_coverage,
        "operationCounts": dict(sorted(operation_counts.items())),
        "allActionCounts": dict(sorted(all_action_counts.items())),
        "unknownActionCounts": dict(sorted(unknown_action_counts.items())),
        "cameraPointsTotal": camera_points,
        "chatOperationsTotal": chat_operations,
        "actionPayloadKeys": {
            action: dict(sorted(counter.items())) for action, counter in sorted(action_payload_keys.items())
        },
        "actionCountsByPlayer": {
            str(slot): dict(sorted(counter.items())) for slot, counter in sorted(action_counts.items())
        },
        "actionSecondsByPlayer": {
            str(slot): [{"second": second, "count": count} for second, count in sorted(counter.items())]
            for slot, counter in sorted(action_seconds.items())
        },
        "buildCountsByPlayer": {
            str(slot): dict(sorted(counter.items(), key=lambda item: int(item[0])))
            for slot, counter in sorted(build_counts.items())
        },
        "buildEvents": build_events,
        "wallEvents": wall_events,
        "productionEvents": production_events,
        "researchEvents": research_events,
        "marketEvents": market_events,
        "tributeEvents": tribute_events,
        "diplomacyEvents": diplomacy_events,
        "flareEvents": flare_events,
        "resignations": resignations,
    }


def write_initial_state_stores(header: dict[str, Any], canonical_dir: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    terrain_path = canonical_dir / "terrain.jsonl.gz"
    objects_path = canonical_dir / "initial-objects.jsonl.gz"
    terrain_writer = JsonlGzipWriter(terrain_path)
    object_writer = JsonlGzipWriter(objects_path)

    map_data = header.get("map") or {}
    dimension = integer(map_data.get("dimension")) or 1
    tiles = list(map_data.get("tiles") or [])
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
            "decode": {"status": "complete", "knownByteCount": None, "unknownByteCount": None, "unknownBytesBase64": None, "parserWarningCodes": []},
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
                },
                "decode": {"status": "complete", "knownByteCount": None, "unknownByteCount": None, "unknownBytesBase64": None, "parserWarningCodes": []},
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
        result.append({
            "playerId": slot,
            "number": slot,
            "name": player["name"],
            "profileId": player.get("profileId"),
            "platformIdentity": None,
            "civilization": entity_ref("aoe2de.civilization", player.get("civilizationId")) or {
                "namespace": "aoe2de.civilization",
                "rawId": -1,
                "displayName": None,
                "normalizedKey": None,
                "familyKey": None,
                "lineKey": None,
                "roleKeys": [],
                "normalizationVersion": ENTITY_DATA_VERSION,
            },
            "colorId": player.get("colorId"),
            "lobbyTeamId": player.get("teamId"),
            "isHuman": None,
            "isRecorder": slot == pov,
            "initialObjectIds": player.get("initialObjectIds") or [],
            "ratingSnapshots": [],
        })
    return result


def canonical_teams(players: list[dict[str, Any]], lock_teams: bool | None) -> list[dict[str, Any]]:
    by_team: dict[int | None, list[int]] = defaultdict(list)
    for player in players:
        by_team[integer(player.get("teamId"))].append(int(player["replaySlot"]))

    shared_team_exists = any(team_id is not None and len(members) > 1 for team_id, members in by_team.items())
    teams: list[dict[str, Any]] = []
    for player in players:
        slot = int(player["replaySlot"])
        team_id = integer(player.get("teamId"))
        members = by_team.get(team_id, []) if team_id is not None else [slot]
        if team_id is not None and len(members) > 1:
            key = f"lobby-{team_id}"
            if any(team["teamId"] == key for team in teams):
                continue
            kind = "fixed" if lock_teams else "scenario"
            team_members = sorted(members)
        else:
            key = f"solo-{slot}"
            kind = "ffa_initial" if not lock_teams and not shared_team_exists else "solo"
            team_members = [slot]
        teams.append({
            "teamId": key,
            "memberPlayerIds": team_members,
            "kind": kind,
            "evidence": evidence("A", "high", notes="Derived directly from lobby team identifiers; dynamic diplomacy remains separate."),
        })
    return teams


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
    dimension = integer(map_data.get("dimension")) or integer(lobby.get("map_size")) or 1
    lock_teams = bool(lobby.get("lock_teams")) if lobby.get("lock_teams") is not None else None
    parser_version = package_version(PARSER_DISTRIBUTION)

    compatibility_status = "supported"
    if not body.get("bodyParseComplete") or body.get("unknownActionCounts"):
        compatibility_status = "degraded"

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
            "retainedReplay": {
                "uri": None,
                "sha256": source_hash,
                "byteLength": path.stat().st_size,
                "encoding": "identity",
                "contentType": "application/octet-stream",
                "recordCount": None,
                "firstOrdinal": None,
                "lastOrdinal": None,
            },
            "compatibility": {
                "status": compatibility_status,
                "upstreamParser": f"{PARSER_DISTRIBUTION}/{parser_version}",
                "formatPatches": [],
                "decodeCoveragePercent": body.get("decodeCoveragePercent", 0),
            },
        },
        "match": {
            "matchId": text(de.get("guid")) or source_hash[:24],
            "guid": text(de.get("guid")),
            "durationMs": int(body.get("durationMs") or 0),
            "completionStatus": "complete" if body.get("bodyParseComplete") else "unknown",
            "winnerPlayerIds": [],
            "winnerTeamIds": [],
            "settings": build_settings(header, players),
            "privacy": {
                "containsChat": int(body.get("chatOperationsTotal") or 0) > 0,
                "containsPlayerNames": True,
                "retentionPolicyId": None,
            },
        },
        "participants": canonical_participants(players, header),
        "teams": canonical_teams(players, lock_teams),
        "initialState": {
            "map": {
                "mapId": integer(scenario.get("map_id")) or integer(de.get("rms_map_id")),
                "mapName": None,
                "rmsFileName": text(de.get("rms_filename")),
                "rmsModId": text(de.get("rms_mod_id")),
                "seed": integer(lobby.get("seed")),
                "width": dimension,
                "height": dimension,
                "coordinateSystem": "aoe2_world_xy_origin_top_left",
                "terrainStore": {
                    "recordCount": terrain_store["recordCount"],
                    "chunks": [terrain_store],
                    "operationCounts": {},
                    "actionCounts": {},
                    "unknownActionCounts": {},
                },
            },
            "objectStore": {
                "recordCount": object_store["recordCount"],
                "chunks": [object_store],
                "operationCounts": {},
                "actionCounts": {},
                "unknownActionCounts": {},
            },
            "startAnchors": [],
        },
        "factStore": {
            "recordCount": fact_store["recordCount"],
            "chunks": [fact_store],
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
    warnings: list[str] = []
    structured_warnings: list[dict[str, Any]] = []
    parsed_at = datetime.now(timezone.utc).isoformat()
    source_hash = file_sha256(path)

    with path.open("rb") as handle:
        header = parse_header(handle)

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

    body = parse_body(path, players, warnings, fact_writer, structured_warnings)

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
        manifest_path.write_text(json.dumps(canonical, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

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
    parser = argparse.ArgumentParser(description="Parse an AoE2 recorded game into the Age of Friends V3 replay adapter and optional CanonicalReplay bundle.")
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
    serialized = json.dumps(result, indent=2 if args.pretty else None, ensure_ascii=False)

    if args.out:
        output_path = args.out.expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(serialized + "\n", encoding="utf-8")
        print(f"Wrote replay adapter to {output_path}")
        if canonical_dir:
            print(f"Wrote CanonicalReplay bundle to {canonical_dir}")
    else:
        print(serialized)


if __name__ == "__main__":
    main()
