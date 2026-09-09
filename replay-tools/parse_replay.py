from __future__ import annotations

import argparse
import hashlib
import json
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone
from importlib.metadata import version as package_version
from pathlib import Path
from typing import Any

from mgz.fast import meta, operation
from mgz.fast.enums import Action, Operation
from mgz.fast.header import parse as parse_header

ADAPTER_SCHEMA_VERSION = "LOF_MGZ_FAST_ADAPTER_V2"
PARSER_DISTRIBUTION = "mgz-fast"


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


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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


def extract_players(header: dict[str, Any], warnings: list[str]) -> list[dict[str, Any]]:
    # mgz-fast's generic player list includes Gaia as slot 0. League players are slots 1-8.
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

        position = generic.get("position") or {}
        players.append({
            "replaySlot": slot,
            "name": name,
            "censoredName": text(de_player.get("censored_name")),
            "profileId": integer(de_player.get("profile_id")),
            "teamId": integer(de_player.get("team_id")),
            "civilizationId": integer(de_player.get("civilization_id"))
            if de_player
            else integer(generic.get("civilization_id")),
            "colorId": integer(de_player.get("color_id"))
            if de_player
            else integer(generic.get("color_id")),
            "position": {
                "x": finite_number(position.get("x")),
                "y": finite_number(position.get("y")),
            },
            "type": integer(de_player.get("type")) if de_player else integer(generic.get("type")),
        })

    if not players:
        raise RuntimeError("No playable replay slots (1-8) could be extracted from the header.")
    return players


def compact_event(slot: int, elapsed_ms: int, **fields: Any) -> dict[str, Any]:
    return {"replaySlot": slot, "atMs": elapsed_ms, **fields}


def parse_body(path: Path, players: list[dict[str, Any]], warnings: list[str]) -> dict[str, Any]:
    action_counts: dict[int, Counter[str]] = defaultdict(Counter)
    action_seconds: dict[int, Counter[int]] = defaultdict(Counter)
    build_counts: dict[int, Counter[str]] = defaultdict(Counter)
    build_events: list[dict[str, Any]] = []
    production_events: list[dict[str, Any]] = []
    research_events: list[dict[str, Any]] = []
    market_events: list[dict[str, Any]] = []
    tribute_events: list[dict[str, Any]] = []
    resignations: list[dict[str, Any]] = []
    elapsed_ms = 0
    total_actions = 0
    total_syncs = 0

    valid_slots = {player["replaySlot"] for player in players}

    with path.open("rb") as handle:
        eof = os.fstat(handle.fileno()).st_size
        parse_header(handle)
        meta(handle)

        while handle.tell() < eof:
            try:
                op_type, payload = operation(handle)
            except EOFError:
                break

            if op_type == Operation.SYNC:
                increment, _checksum, _data = payload
                elapsed_ms += int(increment)
                total_syncs += 1
                continue

            if op_type != Operation.ACTION:
                continue

            action_type, action_data = payload
            total_actions += 1
            action_name = enum_name(action_type) or "UNKNOWN"
            action_data = action_data if isinstance(action_data, dict) else {}
            player_id = integer(action_data.get("player_id"))

            if player_id in valid_slots:
                action_counts[player_id][action_name] += 1
                action_seconds[player_id][elapsed_ms // 1000] += 1

            if action_type == Action.RESIGN and player_id in valid_slots:
                resignations.append(compact_event(player_id, elapsed_ms))

            elif action_type == Action.RESEARCH and player_id in valid_slots:
                research_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    technologyId=integer(action_data.get("technology_id")),
                ))

            elif action_type == Action.BUILD and player_id in valid_slots:
                building_id = integer(action_data.get("building_id"))
                if building_id is not None:
                    build_counts[player_id][str(building_id)] += 1
                build_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    buildingId=building_id,
                    x=finite_number(action_data.get("x")),
                    y=finite_number(action_data.get("y")),
                ))

            elif action_type in (Action.DE_QUEUE, Action.QUEUE, Action.MULTIQUEUE, Action.MAKE) and player_id in valid_slots:
                amount = integer(action_data.get("amount"))
                production_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    commandType=action_name,
                    unitId=integer(action_data.get("unit_id")),
                    amount=amount if amount is not None and amount > 0 else 1,
                    buildingId=integer(action_data.get("building_id")),
                ))

            elif action_type in (Action.BUY, Action.SELL) and player_id in valid_slots:
                market_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    type=action_name,
                    resourceId=integer(action_data.get("resource_id")),
                    amount=finite_number(action_data.get("amount")),
                ))

            elif action_type in (Action.TRIBUTE, Action.DE_TRIBUTE) and player_id in valid_slots:
                tribute_events.append(compact_event(
                    player_id,
                    elapsed_ms,
                    targetReplaySlot=integer(action_data.get("target_player_id"))
                    or integer(action_data.get("player_id_to")),
                    resourceId=integer(action_data.get("resource_id")),
                    amount=finite_number(action_data.get("amount")),
                    food=finite_number(action_data.get("food")),
                    wood=finite_number(action_data.get("wood")),
                    gold=finite_number(action_data.get("gold")),
                    stone=finite_number(action_data.get("stone")),
                ))

    if total_syncs == 0:
        warnings.append("Replay body contained no SYNC operations; duration may be unavailable.")

    return {
        "durationMs": elapsed_ms,
        "totalActions": total_actions,
        "totalSyncOperations": total_syncs,
        "actionCountsByPlayer": {
            str(slot): dict(sorted(counter.items()))
            for slot, counter in sorted(action_counts.items())
        },
        "actionSecondsByPlayer": {
            str(slot): [
                {"second": second, "count": count}
                for second, count in sorted(counter.items())
            ]
            for slot, counter in sorted(action_seconds.items())
        },
        "buildCountsByPlayer": {
            str(slot): dict(sorted(counter.items(), key=lambda item: int(item[0])))
            for slot, counter in sorted(build_counts.items())
        },
        "buildEvents": build_events,
        "productionEvents": production_events,
        "researchEvents": research_events,
        "marketEvents": market_events,
        "tributeEvents": tribute_events,
        "resignations": resignations,
    }


def build_payload(path: Path) -> dict[str, Any]:
    warnings: list[str] = []
    with path.open("rb") as handle:
        header = parse_header(handle)

    players = extract_players(header, warnings)
    lobby = header.get("lobby") or {}
    scenario = header.get("scenario") or {}
    metadata = header.get("metadata") or {}
    de = header.get("de") or {}

    body = parse_body(path, players, warnings)

    payload = {
        "replay": {
            "format": enum_name(header.get("version")),
            "gameVersion": text(header.get("game_version")),
            "saveVersion": finite_number(header.get("save_version")),
            "build": integer(de.get("build")),
            "timestamp": integer(de.get("timestamp")),
            "fileSizeBytes": path.stat().st_size,
        },
        "settings": {
            # Kept as raw evidence. Some modern DE replays currently return suspicious zero values here.
            "mapId": integer(scenario.get("map_id")),
            "difficultyId": integer(scenario.get("difficulty_id")),
            "mapSize": integer(lobby.get("map_size")),
            "population": integer(lobby.get("population")),
            "gameTypeId": integer(lobby.get("game_type_id")),
            "revealMapId": integer(lobby.get("reveal_map_id")),
            "seed": integer(lobby.get("seed")),
            "lockTeams": bool(lobby.get("lock_teams")) if lobby.get("lock_teams") is not None else None,
            "speed": finite_number(metadata.get("speed")),
            "rated": bool(de.get("rated")) if de.get("rated") is not None else None,
            "victoryTypeId": integer(de.get("victory_type_id")),
            "startingResourcesId": integer(de.get("starting_resources_id")),
            "startingAgeId": integer(de.get("starting_age_id")),
            "endingAgeId": integer(de.get("ending_age_id")),
        },
        "players": players,
        "body": body,
    }

    return {
        "parserName": PARSER_DISTRIBUTION,
        "parserVersion": package_version(PARSER_DISTRIBUTION),
        "schemaVersion": ADAPTER_SCHEMA_VERSION,
        "sourceHash": file_sha256(path),
        "sourceFileName": path.name,
        "parserExtractedAt": datetime.now(timezone.utc).isoformat(),
        "sourcePlayers": [
            {
                "replaySlot": player["replaySlot"],
                "sourceName": player["name"],
            }
            for player in players
        ],
        "warnings": warnings,
        "payload": payload,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse an AoE2 recorded game into the League of Friends raw-stat adapter schema.")
    parser.add_argument("replay", type=Path, help="Path to .aoe2record/.mgz file")
    parser.add_argument("--out", type=Path, help="Optional JSON output path. Defaults to stdout.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    args = parser.parse_args()

    replay_path = args.replay.expanduser().resolve()
    if not replay_path.exists() or not replay_path.is_file():
        raise SystemExit(f"Replay file not found: {replay_path}")

    result = build_payload(replay_path)
    serialized = json.dumps(result, indent=2 if args.pretty else None, ensure_ascii=False)

    if args.out:
        output_path = args.out.expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(serialized + "\n", encoding="utf-8")
        print(f"Wrote replay parse to {output_path}")
    else:
        print(serialized)


if __name__ == "__main__":
    main()
