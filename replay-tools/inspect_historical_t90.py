"""Extract *observed* facts from the eight historical 185872 test recordings.

This script is a diagnostics/fixture-validation job, not an official results
resolver. It never rewrites the recording or asserts that historical Games
satisfy a newly created AoF Event's announced rules.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/"replay-tools"))
from header_compat import parse
from canonical_stream import frames, ExactReader, command_layout
from mgz.fast import meta
from parse_replay import extract_players,build_settings,json_safe,text
from match_facts import compact_header

def normalized(name):
    import unicodedata
    return " ".join(unicodedata.normalize("NFKC",name).lower().split())

def inspect_file(p:Path):
    digest=hashlib.file_digest(p.open("rb"),"sha256").hexdigest()
    with p.open("rb") as h:
        header=parse(h)
        meta(ExactReader(h,p.stat().st_size))
        players=extract_players(header,[])
        settings=build_settings(header,players)
        clock=0
        resignations=[]
        postgames=[]
        complete=True
        for n,(op,payload,begin,end,raw,error) in enumerate(frames(h,p.stat().st_size)):
            if op=="SYNC":
                clock+=payload[0]
            if op=="UNKNOWN":
                complete=False
            if op=="ACTION" and payload[0].name=="RESIGN":
                layout=command_layout(raw,"RESIGN")
                disconnected=layout.get("disconnectedRaw")
                resignations.append({
                    "replaySlot":payload[1].get("player_id"),"atMs":clock,
                    "commandLayout":layout["layout"],
                    "disconnected":bool(disconnected) if disconnected in (0,1) else None,
                    "ordinal":n
                })
            if op=="POSTGAME":
                postgames.append({"atMs":clock,"ordinal":n,"worldTimeMs":json_safe(payload).get("world_time")})
        hdr=compact_header(header)
    roster=[
        {"replaySlot":p["replaySlot"],"sourceName":p["name"],
         "teamIdRaw":p["teamId"],"civilizationIdRaw":p["civilizationId"]}
        for p in players
    ]
    names=[normalized(p["sourceName"]) for p in roster]
    if len(names)!=len(set(names)):
        raise ValueError(f"Non-unique normalized replay names: {p.name}")
    raw_teams=sorted({p["teamIdRaw"] for p in roster})
    resigned={r["replaySlot"] for r in resignations if r["disconnected"] is False}
    candidates=[
        team for team in raw_teams
        if all(p["replaySlot"] not in resigned for p in roster if p["teamIdRaw"]==team)
        and all(p["replaySlot"] in resigned for p in roster if p["teamIdRaw"]!=team)
    ]
    terminal=bool(postgames and any(
        pg["atMs"]==clock and pg["worldTimeMs"]==clock
        and pg["ordinal"]>max([r["ordinal"] for r in resignations],default=-1)
        for pg in postgames))
    winnerRaw=candidates[0] if len(candidates)==1 and terminal and complete and len(resignations)>0 and all(r["disconnected"] is False for r in resignations) else None
    return {
        "filename":p.name,"sha256":digest,"sizeBytes":p.stat().st_size,
        "saveVersion":header.get("save_version"),"build":hdr.get("de",{}).get("build"),
        "guid":text(header.get("de",{}).get("guid")),
        "mapIdRaw":settings.get("mapId"),"rmsModId":settings.get("rmsModId"),
        "lockTeams":settings.get("lockTeams"),"victoryTypeId":settings.get("victoryTypeId"),
        "cheats":hdr.get("de",{}).get("cheats"),
        "durationMs":clock,"bodyParseComplete":complete,
        "players":roster,"resignations":resignations,
        "terminalPostgamePresent":terminal,
        "winnerTeamRawCandidate":winnerRaw,
        "outcomeCaveat":"Raw resignation/postgame candidate only. AoF official outcome needs qualified rules, map, sides, and Game binding."
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--fixture-dir",type=Path,required=True)
    p.add_argument("--manifest",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)
    args=p.parse_args()
    manifest=json.loads(args.manifest.read_text(encoding="utf-8"))
    expected=manifest["recordings"]
    files=sorted(args.fixture_dir.glob("*.aoe2record"))
    if len(files)!=8:
        raise SystemExit(f"Expected 8 .aoe2record files; observed {len(files)} in {args.fixture_dir}")
    observations=[]
    failures=[]
    for source in files:
        try:
            row=inspect_file(source)
            sameNames=[e for e in expected if sorted(map(normalized,e["sourceNames"]))==sorted(map(normalized,[x["sourceName"] for x in row["players"]]))]
            row["possibleFixtureIds"]=[e["id"] for e in sameNames]
            if not sameNames:
                failures.append("Roster does not match supplied table: "+source.name)
            print("AOF_REPLAY "+json.dumps({
                "filename":row["filename"],
                "fixtureIds":row["possibleFixtureIds"],
                "players":[x["sourceName"] for x in row["players"]],
                "teams":[x["teamIdRaw"] for x in row["players"]],
                "civs":[x["civilizationIdRaw"] for x in row["players"]],
                "sha256":row["sha256"],"guid":row["guid"],
                "build":row["build"],"saveVersion":row["saveVersion"],
                "mapId":row["mapIdRaw"],
                "terminal":row["terminalPostgamePresent"],
                "winnerTeamRawCandidate":row["winnerTeamRawCandidate"],
                "bodyParseComplete":row["bodyParseComplete"],
            },ensure_ascii=False,default=str),flush=True)
            observations.append(row)
        except Exception as exc:
            failures.append(f"{source.name}: {type(exc).__name__}: {exc}")
            print("AOF_REPLAY_ERROR "+json.dumps(failures[-1]),flush=True)
    if len(observations)==8:
        hashes=[x["sha256"] for x in observations]
        guids=[x["guid"] for x in observations]
        if len(set(hashes))!=8:failures.append("Duplicate replay bytes detected")
        if len(set(guids))!=8:failures.append("Duplicate Game GUID detected: source files may be alternate perspectives")
        for e in expected:
            if not any(e["id"] in r["possibleFixtureIds"] for r in observations):
                failures.append("Expected roster absent: "+e["id"])
        # Each of the four duel/4v4 rosters must appear exactly once; 2v2s have identical rosters.
        for e in expected:
            matches=[r for r in observations if e["id"] in r["possibleFixtureIds"]]
            if e["format"]!="TWO_V_TWO" and len(matches)!=1:
                failures.append(f"Expected exactly one matching source for {e['id']}, found {len(matches)}")
    output={"schemaVersion":"AOF_HISTORICAL_REPLAY_OBSERVATIONS_V1",
            "evidenceStatus":"DECODER_OBSERVED_NOT_EVENT_QUALIFIED",
            "observations":observations,"errors":failures}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(output,indent=2,ensure_ascii=False,default=str)+"\n",encoding="utf-8")
    print("AOF_REPLAY_SUMMARY "+json.dumps({"files":len(files),"decoded":len(observations),"errors":failures},ensure_ascii=False),flush=True)
    if failures:raise SystemExit(1)

if __name__=="__main__":
    main()
