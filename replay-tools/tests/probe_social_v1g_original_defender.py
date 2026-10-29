"""Read-only one-off original-source inventory. No admission or scores."""
from pathlib import Path
from hashlib import sha256
from collections import Counter
import json, tempfile, sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from test_social_v1_metric_grade_candidates import PINS
from parse_replay import build_payload
from analysis_dataset import build_analysis_dataset
from statistics_projector import project_statistics_from_analysis
from social_v1_context import project_social_v1_context
from social_v1_source_measurements import project_social_source_measurements
from social_v1_metric_grade_candidates import prepare_social_metric_grade_candidates
from social_v1_source_grades import admit_contextual_source_grades
ROOT=Path(__file__).resolve().parents[2]
for fmt,(filename,pin) in PINS.items():
    path=ROOT/filename
    assert sha256(path.read_bytes()).hexdigest()==pin
    with tempfile.TemporaryDirectory(prefix="probe-soc-v1g-") as d:
        canon=Path(d)/"canonical"
        build_payload(path,canonical_dir=canon,seal_mode="fast")
        analysis=build_analysis_dataset(canon,validate=False)
        stats=project_statistics_from_analysis(analysis)
        ctx=project_social_v1_context(statistics=stats)
        actions=analysis["actionEvents"]
        metrics=project_social_source_measurements(statistics=stats,context=ctx,action_events=actions,lookback_ms=120000)
        scope={"battleId":"UNVERIFIED-"+fmt,"gameId":"game-"+fmt,
               "gameGuid":"UNVERIFIED-"+fmt,"authorityRevision":"UNVERIFIED"}
        groups=prepare_social_metric_grade_candidates(statistics=stats,context=ctx,source_measurements=metrics,action_events=actions,game_scope=scope)["candidateEpisodeGroups"]
        existing=admit_contextual_source_grades(statistics=stats,context=ctx,source_measurements=metrics,action_events=actions,game_scope=scope)
        original={e["eventId"]:e for e in actions if e.get("eventId")}
        raids={}
        for participant in stats["participants"]:
            for raid in ((participant.get("military") or {}).get("engagements") or {}).get("raidEvidence",{}).get("initiatedEpisodes",[]):
                raids[(raid.get("attackerPlayerId"),raid.get("victimPlayerId"))]=raids.get((raid.get("attackerPlayerId"),raid.get("victimPlayerId")),[])+[raid]
        candidates=[]
        for g in groups:
            actor,target=g["actorReplayPlayerId"],g["counterpartReplayPlayerId"]
            ownTarget=set().union(*(set(m["sourceEventIds"]) for m in g["rawMeasurements"] if m["metricDefinitionId"]=="AOF_ORIGINAL_TARGET_REQUEST_COUNT_V1"))
            ownTarget={ref for ref in ownTarget if ref in original and original[ref].get("actorPlayerId")==actor and original[ref].get("sourceActionName")=="ORDER" and isinstance(original[ref].get("operationOrdinal"),int)}
            prior=[]
            for raid in raids.get((target,actor),[]):
                valid=[r for r in raid.get("sourceEventIds",[]) if r in original and original[r].get("actorPlayerId")==target and original[r].get("timestampMs",-1)<g["window"]["startMs"] and isinstance(original[r].get("operationOrdinal"),int)]
                if len(valid)>=2 and raid.get("startedAtMs",-1)<g["window"]["startMs"]:
                    prior.append((raid.get("raidId"),valid[:5],raid.get("startedAtMs")))
            eng=[x for x in g["linkedDetectorCandidates"] if x["kind"] in ("SKIRMISH","TECHNICAL_BATTLE") and set(x["sharedOriginalEventIds"]) & ownTarget]
            already=next((row for row in existing["episodes"] if row["sourceCandidateId"]==g["candidateId"]),None)
            existingR=next((x["decision"] for x in already["perTrackGrades"] if x["track"]=="RIVALRY"),None) if already else None
            if ownTarget:
                candidates.append(dict(actor=actor,target=target,count=len(ownTarget),targetRefs=sorted(ownTarget)[:8],originalActionKinds=Counter(original[r].get("sourceActionName") for r in ownTarget),priorRaids=prior[:2],eng=[{"kind":x["kind"],"id":x["sourceDetectorId"],"refs":x["sharedOriginalEventIds"][:8]} for x in eng[:3]],raidCount=len(g["linkedRaidDetectorCandidates"]),oldR=existingR,start=g["window"]["startMs"],allSourceRefs=len(g["sourceEventIds"]),deed=g["sourceDeedIds"][:2],key=g["candidateId"]))
        scored=sorted(candidates,key=lambda x:(not(x["priorRaids"] and x["eng"] and x["count"]>=2 and x["oldR"]=="PENDING"),not(x["eng"] and x["count"]>=2 and x["oldR"]=="PENDING"),-x["count"],x["start"]))
        useful=[x for x in scored if x["count"]>=2 and x["eng"] and x["oldR"]=="PENDING"]
        defender=[x for x in useful if x["priorRaids"]]
        print("ORIGINAL_DEFENDER_PROBE "+json.dumps(dict(format=fmt,sha256=pin,groups=len(groups),totalWithTarget=len(candidates),qualifiedNonRaid=len(useful),defenderPriorOpposite=len(defender),samples=defender[:4] if defender else useful[:5]),sort_keys=True,default=list),flush=True)
