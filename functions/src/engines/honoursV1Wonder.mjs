/**
 * AoF Wonder Crown V1 - test-only pure competition and point ledger.
 *
 * Owner rule (31 Oct): Wonder victories are the primary ranking; Wonder
 * points BREAK victory-count ties. Wonder victory time is never used in
 * eligibility, points, leader ranking or tie breaking. A first independently
 * verified Wonder victory activates the competitive trophy immediately.
 *
 * All numbers here are the owner's exact point schedule; one half-point is
 * represented as ONE integer unit to avoid floating-point ties.
 * This module neither admits replay evidence nor publishes entitlement.
 */
export const WONDER_CROWN_TEST_VERSION="AOF_WONDER_CROWN_V1_TEST";
export const WONDER_POINT_UNITS=Object.freeze({
  COMPLETED_WONDER:1, // 0.5 point
  OWN_WONDER_VICTORY:4, // 2 points
  ALLIED_WONDER_VICTORY:2, // 1 point
  WONDER_CHALLENGE_WIN:6, // 3 points; adds to own victory points
});
const txt=x=>typeof x==="string"&&x.trim().length>0;
const serial=(a,b)=>a.localeCompare(b);
const bool=(x)=>x===true;
function accepted(g,season) {
  return g&&g.seasonId===season&&g.sourceState==="CURRENT_READY"&&
    g.resultState==="FINAL"&&Number.isInteger(g.sourceRevision)&&g.sourceRevision>0&&
    Number.isInteger(g.resultRevision)&&g.resultRevision>0&&
    txt(g.gameId)&&txt(g.battleId)&&Array.isArray(g.roster)&&
    Array.isArray(g.winners)&&g.roster.every(txt)&&
    g.winners.every(id=>g.roster.includes(id))&&
    Number.isFinite(g.acceptedAtMs)&&g.acceptedAtMs>=0;
}
function bound(w,g) {
  return w?.sourceRevision===g.sourceRevision&&
    (!txt(g.sourceHash)||w?.sourceHash===g.sourceHash);
}
function officialWonderVictory(g) {
  const w=g.wonderVictory;
  if(!w||g.victoryRules!=="WONDER"||
     w.method!=="WONDER_VICTORY"||w.verifiedBy!=="OFFICIAL_METHOD_REVIEW"||
     w.resultRevision!==g.resultRevision||!bound(w,g)||
     !txt(w.winnerId)||!g.winners.includes(w.winnerId)||
     !txt(w.winningWonderId)||w.winningWonderOwnerPlayerId!==w.winnerId||
     w.winningWonderCompleted!==true)return null;
  return w;
}
function officialChallenge(g,w) {
  const c=g.wonderChallenge;
  return c?.gameId===g.gameId&&txt(c.challengeId)&&
    c.status==="OFFICIALLY_COMPLETED"&&
    c.review==="VERIFIED_WONDER_RACE_RESULT"&&
    c.winnerId===w.winnerId&&c.resultRevision===g.resultRevision&&
    bound(c,g);
}
const empty=playerId=>({
  playerId,wonderVictories:0,pointUnits:0,wonderPoints:0,
  completedWonders:0,alliedWonderVictories:0,challengeVictories:0,
});
function tally(target,key,increment) {
  target[key]+=increment;
  target.pointUnits+=increment*WONDER_POINT_UNITS[
    key==="completedWonders"?"COMPLETED_WONDER":
    key==="wonderVictories"?"OWN_WONDER_VICTORY":
    key==="alliedWonderVictories"?"ALLIED_WONDER_VICTORY":"WONDER_CHALLENGE_WIN"];
  target.wonderPoints=target.pointUnits/2;
}
function collectGamePoints(g) {
  const delta=new Map();
  const own=id=>{
    if(!delta.has(id))delta.set(id,empty(id));
    return delta.get(id);
  };
  const builds=new Set(),owners=new Map();
  const rows=Array.isArray(g.wonderConstructions)?g.wonderConstructions:[];
  for(const row of rows) {
    if(!txt(row?.buildingInstanceId)||!g.roster.includes(row.ownerPlayerId)||
       row.complete!==true||
       !["INDEPENDENT_CONSTRUCTION_REVIEW","OFFICIAL_METHOD_REVIEW"].includes(row.verifiedBy)||
       !bound(row,g))continue;
    if(owners.has(row.buildingInstanceId)&&
       owners.get(row.buildingInstanceId)!==row.ownerPlayerId)
      return {winner:null,delta:new Map(),sourceConflict:true};
    owners.set(row.buildingInstanceId,row.ownerPlayerId);
    if(builds.has(row.buildingInstanceId))continue;
    builds.add(row.buildingInstanceId);
    tally(own(row.ownerPlayerId),"completedWonders",1);
  }
  const winner=officialWonderVictory(g);
  if(winner&&owners.has(winner.winningWonderId)&&
     owners.get(winner.winningWonderId)!==winner.winnerId)
    return {winner:null,delta:new Map(),sourceConflict:true};
  if(winner) {
    // A verified Wonder-method victory itself proves its winning Wonder was
    // completed. Do not award a second construction point for the same object.
    if(!builds.has(winner.winningWonderId)){
      builds.add(winner.winningWonderId);
      tally(own(winner.winnerId),"completedWonders",1);
    }
    tally(own(winner.winnerId),"wonderVictories",1);
    let allies=[];
    if(g.format==="TEAM") {
      allies=g.winners.filter(p=>p!==winner.winnerId);
    }else if(g.format==="FFA"&&winner.ffaAllianceReview==="SOURCE_VERIFIED_EFFECTIVE_ALLIANCE") {
      allies=(Array.isArray(winner.qualifiedAllyPlayerIds)?winner.qualifiedAllyPlayerIds:[]).filter(p=>
        g.winners.includes(p)&&p!==winner.winnerId);
    }
    for(const id of new Set(allies))tally(own(id),"alliedWonderVictories",1);
    if(officialChallenge(g,winner))tally(own(winner.winnerId),"challengeVictories",1);
  }
  return {winner,delta};
}
const cmp=(a,b)=>a.wonderVictories-b.wonderVictories||a.pointUnits-b.pointUnits;
const standings=totals=>[...totals.values()].sort((a,b)=>
  cmp(b,a)||a.playerId.localeCompare(b.playerId)).map(x=>({...x}));
export function projectWonderTrophy(input) {
  if(!txt(input?.seasonId)||!Array.isArray(input.games))throw new Error("Season and authoritative Games required");
  const byGame=new Map();
  for(const g of input.games) {
    if(g?.seasonId!==input.seasonId||!txt(g?.gameId))continue;
    const previous=byGame.get(g.gameId);
    if(previous&&JSON.stringify(previous)!==JSON.stringify(g))
      throw new Error("Conflicting canonical Wonder Game/POV revision");
    byGame.set(g.gameId,g);
  }
  const games=[...byGame.values()].filter(g=>accepted(g,input.seasonId)&&
    g.acceptedAtMs<=input.nowMs).sort((a,b)=>
    a.acceptedAtMs-b.acceptedAtMs||serial(a.gameId,b.gameId));
  const totals=new Map(),history=[];
  const score=id=>{
    if(!totals.has(id))totals.set(id,empty(id));
    return totals.get(id);
  };
  let incumbent=null,tiePending=false,idx=0;
  while(idx<games.length) {
    const atMs=games[idx].acceptedAtMs,batch=[];
    while(idx<games.length&&games[idx].acceptedAtMs===atMs)
      batch.push(games[idx++]);
    for(const g of batch)for(const [id,points] of collectGamePoints(g).delta){
      const dst=score(id);
      for(const key of ["completedWonders","wonderVictories","alliedWonderVictories","challengeVictories"])
        if(points[key])tally(dst,key,points[key]);
    }
    const eligible=standings(totals).filter(x=>x.wonderVictories>=1);
    if(!eligible.length)continue;
    const leaders=eligible.filter(x=>cmp(x,eligible[0])===0);
    const highest=eligible[0];
    const next=leaders.length===1?highest.playerId:
      leaders.some(x=>x.playerId===incumbent)?incumbent:null;
    if(next!==incumbent) {
      if(incumbent!==null)history[history.length-1].toAcceptedAtMs=atMs;
      incumbent=next;
      if(incumbent!==null)history.push({
        playerId:incumbent,fromAcceptedAtMs:atMs,toAcceptedAtMs:null,
        wonderVictories:score(incumbent).wonderVictories,
        wonderPoints:score(incumbent).wonderPoints,
        improvements:[],
      });
    }else if(next!==null&&batch.some(g=>
      collectGamePoints(g).delta.has(next))) {
      history[history.length-1].improvements.push({
        atAcceptedAtMs:atMs,wonderVictories:score(next).wonderVictories,
        wonderPoints:score(next).wonderPoints,
      });
    }
    tiePending=leaders.length>1&&next===null;
  }
  const board=standings(totals),eligible=board.filter(x=>x.wonderVictories>=1);
  const currentLeaders=eligible.length?eligible.filter(x=>cmp(x,eligible[0])===0).map(x=>x.playerId):[];
  return {
    schemaVersion:WONDER_CROWN_TEST_VERSION,testOnly:true,
    state:incumbent?"CURRENT_HOLDER":tiePending?"PENDING_TIE_POLICY":
      eligible.length?"PENDING_TIE_POLICY":"UNCLAIMED_NO_WONDER_VICTORY",
    holder:incumbent,recordHolders:currentLeaders,
    wonderVictories:incumbent?score(incumbent).wonderVictories:0,
    wonderPoints:incumbent?score(incumbent).wonderPoints:0,
    standings:board,history,seasonId:input.seasonId,
    primaryRank:"WONDER_VICTORIES_DESC",
    tieBreak:"WONDER_POINTS_DESC",timeEligibility:false,
    pointsSchedule:{builtWonder:0.5,ownWonderVictory:2,
      allyWonderVictory:1,wonderChallengeWin:3},
    officialRecognitionOnly:true,anyGrantWritten:false,
  };
}
