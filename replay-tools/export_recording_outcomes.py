"""Export bounded decoder evidence; importing this module performs no export."""
import hashlib
import io
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "replay-tools"))
from header_compat import parse
from canonical_stream import frames, ExactReader, command_layout
from mgz.fast import meta
from parse_replay import extract_players, build_settings, text, json_safe, canonical_action_event
from match_facts import compact_header

FIXTURES = ["1v1_1.aoe2record", "1v1_2.aoe2record", "aof-test-game-1.aoe2record",
            "aof-test-game-2.aoe2record", "aof-test-game-3.aoe2record",
            "2v2.aoe2record", "3v3.aoe2record", "4v4.aoe2record"]


def inspect_recording(path):
    """Inspect one immutable byte snapshot using the existing decoder only.

    These are recorded requests and terminal candidates. The existing backend
    outcome qualifier, rather than this utility, decides whether they suffice.
    """
    path = Path(path)
    data = path.read_bytes()
    source_hash = hashlib.sha256(data).hexdigest()
    with io.BytesIO(data) as handle:
        header = parse(handle)
        meta(ExactReader(handle, len(data)))
        players = extract_players(header, [])
        settings = build_settings(header, players)
        clock, resigns, post, complete, diplomacy = 0, [], [], True, []
        for n, (op, payload, begin, end, raw, error) in enumerate(frames(handle, len(data))):
            if op == "SYNC":
                clock += payload[0]
            if op == "UNKNOWN" or error:
                complete = False
            if op == "ACTION":
                name = payload[0].name
                if name == "ERROR":
                    complete = False
                # Reuse the existing canonical field interpretation, including
                # DE GAME/diplomacy_mode. A request is never effective alliance.
                if name in ("DIPLOMACY", "DE_DIPLOMACY") or (
                        name == "GAME" and payload[1].get("diplomacy_mode") is not None):
                    event = canonical_action_event(ordinal=n, elapsed_ms=clock,
                        op_start=begin, op_end=end, action_type=payload[0],
                        action_data=payload[1], raw_operation=raw, retain_raw=False)
                    if name in ("DIPLOMACY", "DE_DIPLOMACY") or event["eventType"] == "command.diplomacy_change":
                        diplomacy.append(event)
            if op == "ACTION" and payload[0].name == "RESIGN":
                layout = command_layout(raw, "RESIGN")
                disconnected = layout.get("disconnectedRaw")
                resigns.append(dict(replaySlot=payload[1].get("player_id"), atMs=clock,
                    sourceEventId=f"OP{n}", operationOrdinal=n, commandLayout=layout["layout"],
                    disconnected=bool(disconnected) if disconnected in (0, 1) else None))
            if op == "POSTGAME":
                post.append(dict(sourceEventId=f"OP{n}", timestampMs=clock,
                                 operationOrdinal=n, decoded=json_safe(payload)))
        compact = compact_header(header)
        facts = dict(source={"replaySha256": source_hash},
            game=dict(guid=text(header.get("de", {}).get("guid")), observedDurationMs=clock,
                bodyParseComplete=complete, resignationCommandCount=len(resigns),
                recordingVersion={"save_version": header["save_version"]}),
            headerFieldCandidates={section + "." + k: json_safe(v)
                for section, values in compact.items() if isinstance(values, dict)
                for k, v in values.items()},
            rules={k: {"value": v} for k, v in settings.items()},
            players=[dict(playerId=p["replaySlot"], lobbyTeamIdRaw=p["teamId"],
                          civilization={"rawId": p["civilizationId"]}) for p in players],
            diplomacy={"commandTimelines": {"originalCommands": diplomacy} if diplomacy else {}},
            result=dict(resignationEvidence=resigns, postgameEvidence=post))
        return dict(filename=path.name, sourceHash=source_hash, sourceBytes=len(data),
            players=[{**{k: p[k] for k in ["replaySlot", "name", "teamId", "civilizationId"]},
                      "rawPlayerType": p.get("type"), "profileId": p.get("profileId"),
                      "isHuman": None}
                     for p in players], matchFacts=facts)


def export_default_fixtures():
    """Preserve the existing eight-fixture export and its fixture JSON shape."""
    out = []
    for filename in FIXTURES:
        path = root / "replay-fixtures" / filename
        if not path.exists():
            continue
        inspected = inspect_recording(path)
        inspected.pop("sourceBytes")
        inspected["players"] = [{k: p[k] for k in ["replaySlot", "name", "teamId", "civilizationId"]}
                                for p in inspected["players"]]
        out.append(inspected)
        facts = inspected["matchFacts"]
        resigns, post = (facts["result"][k] for k in ["resignationEvidence", "postgameEvidence"])
        print(filename, facts["game"]["observedDurationMs"], len(inspected["players"]),
              [(r["replaySlot"], r["disconnected"]) for r in resigns], len(post))
    (root / "functions/tests/fixtures/recording-outcomes.json").write_text(
        json.dumps(out, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--inspect":
        print(json.dumps(inspect_recording(sys.argv[2]), ensure_ascii=False))
    elif len(sys.argv) == 1:
        export_default_fixtures()
    else:
        raise SystemExit("Usage: export_recording_outcomes.py [--inspect RECORDING]")
