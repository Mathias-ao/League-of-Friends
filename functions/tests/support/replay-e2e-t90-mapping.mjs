/**
 * Synthetic T90 historical-replay staging helpers.
 * These do not authenticate anyone or certify an original replay.
 * They must NEVER be used to bind historical replay identities in production.
 */
const normalize=name=>String(name).normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
const checkedPair=(pair)=>{
  const ids=pair?.playerIds;
  if(typeof pair?.matchId!=='string'||!pair.matchId||!Array.isArray(ids)||ids.length!==2||
    ids.some(id=>typeof id!=='string'||!id)||ids[0]===ids[1])throw new Error('Expected a Match ID and two unique scheduled warmup players.');
  return {matchId:pair.matchId,playerIds:[...ids].sort()};
};

/** Map four user-provided 1v1 files onto the four Match IDs actually created by the scheduler. */
export function assignScheduledWarmupBindings(manifest,scheduledPairs){
  const scenario=manifest.scenarios.eventRehearsal,expected=new Set(scenario.playerIds);
  if(!Array.isArray(scheduledPairs)||scheduledPairs.length!==4)throw new Error('Expected four scheduled 1v1 Matches.');
  const pairs=scheduledPairs.map(checkedPair),seen=new Set(),ids=new Set();
  for(const p of pairs){
    if(seen.has(p.matchId))throw new Error('Duplicate scheduled Match.');
    seen.add(p.matchId);
    for(const id of p.playerIds){if(!expected.has(id)||ids.has(id))throw new Error('Warmup scheduling does not cover the eight distinct approved Test Players.');ids.add(id);}
  }
  if(ids.size!==expected.size)throw new Error('Incomplete staging warmup roster.');
  const primary=pairs.find(p=>p.playerIds.includes('TEST-01'));
  if(!primary)throw new Error('Anchor player TEST-01 lacks a warmup.');
  const ordered=[primary,...pairs.filter(p=>p!==primary).sort((a,b)=>a.matchId.localeCompare(b.matchId))];
  return scenario.warmups.map((example,index)=>{
    const original=manifest.recordings.find(row=>row.id===example.recordingId);
    if(!original||original.format!=='ONE_V_ONE'||original.sourceNames.length!==2)throw new Error('Warmup recording manifest is incomplete.');
    const p=ordered[index],t90PlayerId=index===0?'TEST-01':p.playerIds[0];
    const otherPlayerId=p.playerIds.find(id=>id!==t90PlayerId);
    const bindings=original.sourceNames.map(sourceName=>({
      sourceName,playerId:normalize(sourceName)==='t90official'?t90PlayerId:otherPlayerId,
    }));
    if(new Set(bindings.map(b=>b.playerId)).size!==2)throw new Error('Warmup binding is not one-to-one.');
    return {recordingId:original.id,matchId:p.matchId,gameId:'G1',bindings};
  });
}

/**
 * Inputs come from the actual approved plan and extracted replay source team IDs.
 * Stable within-team permutation is intentional: this is a synthetic E2E fixture,
 * not a claim about the recorded human players' real Steam identities.
 */
export function assignMainReplayBindings(manifest,approvedParticipants,observedSourceTeams){
  const scenario=manifest.scenarios.eventRehearsal,main=scenario.main;
  const original=manifest.recordings.find(row=>row.id===main.recordingId);
  if(!original||original.format!=='FOUR_V_FOUR'||original.sourceNames.length!==8)throw new Error('Main recording manifest is incomplete.');
  if(!Array.isArray(approvedParticipants)||approvedParticipants.length!==8)throw new Error('Expected eight approved 4v4 starters.');
  const approvedIds=new Set(approvedParticipants.map(p=>p.playerId));
  if(approvedIds.size!==8||scenario.playerIds.some(id=>!approvedIds.has(id)))throw new Error('Approved 4v4 roster differs from the staging roster.');
  const approvedTeams=new Map();
  for(const p of approvedParticipants){
    if(![1,2].includes(p.team))throw new Error('Approved main teams must be 1 and 2.');
    const bucket=approvedTeams.get(p.team)??[];bucket.push(p.playerId);approvedTeams.set(p.team,bucket);
  }
  if(approvedTeams.size!==2||[...approvedTeams.values()].some(ids=>ids.length!==4))throw new Error('Expected approved 4v4 teams of four.');
  const rows=Array.isArray(observedSourceTeams)?observedSourceTeams:Object.entries(observedSourceTeams??{}).map(([sourceName,teamId])=>({sourceName,teamId}));
  const map=new Map();
  for(const row of rows){
    if(typeof row?.sourceName!=='string'||row.sourceName.trim()===''||!Number.isInteger(row.teamId)||row.teamId<=1)throw new Error('Source team IDs must be extracted positive locked-team lobby IDs.');
    const name=normalize(row.sourceName);if(map.has(name))throw new Error('Duplicate recorded source name.');map.set(name,row.teamId);
  }
  if(map.size!==8||original.sourceNames.some(name=>!map.has(normalize(name))))throw new Error('Recorded main roster/team extraction does not match the fixture.');
  const rawTeamOfT90=map.get('t90official'),rawTeams=[...new Set(map.values())];
  if(rawTeams.length!==2||rawTeams.some(team=>[...map.values()].filter(v=>v===team).length!==4))throw new Error('Recorded 4v4 is not two teams of four.');
  const anchor=approvedParticipants.find(p=>p.playerId===main.fixedBinding.playerId),anchorTeam=anchor.team;
  const sameApproved=approvedTeams.get(anchorTeam).filter(id=>id!==anchor.playerId).sort();
  const otherApproved=approvedTeams.get(anchorTeam===1?2:1).slice().sort();
  const bindings=[];
  for(const name of original.sourceNames){
    if(normalize(name)==='t90official'){bindings.push({sourceName:name,playerId:anchor.playerId});continue;}
    const pool=map.get(normalize(name))===rawTeamOfT90?sameApproved:otherApproved;
    const id=pool.shift();if(!id)throw new Error('Recorded team exceeds its approved allocation.');
    bindings.push({sourceName:name,playerId:id});
  }
  if(new Set(bindings.map(b=>b.playerId)).size!==8)throw new Error('Main binding is not one-to-one.');
  return {recordingId:original.id,gameId:'G1',bindings};
}
