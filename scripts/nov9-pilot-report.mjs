/** Read-only source inspection and controlled two-player Season-points oracle.
 * Build functions first. No database, login, cloud, identity alias or result writes.
 */
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {deriveRecordingOutcome,RECORDING_OUTCOME_VERSION} from '../functions/lib/engines/recordingOutcome.js';
import {computeMatchRewards} from '../functions/lib/engines/rewardEngine.js';
import {seasonScoringSnapshot,rankSeasonStandings,seasonPointUnits,POINT_UNITS,SEASON_POINTS_VERSION} from '../functions/lib/engines/seasonPoints.js';

export const PLAN_VERSION='AOF_NOV9_PILOT_PLAN_V1';
export const REPORT_VERSION='AOF_NOV9_PILOT_REPORT_V1';
const run=promisify(execFile),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const requireThat=(ok,message)=>{if(!ok)throw new Error(message);};
const id=value=>typeof value==='string'&&!!value.trim()&&!value.includes('/');
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

export function validatePilotPlan(plan){
  requireThat(plan?.modelVersion===PLAN_VERSION,'Unsupported pilot plan modelVersion.');
  requireThat(['OWNER_NEW_RECORDINGS','REPOSITORY_FALLBACK'].includes(plan.inputKind),'Explicit inputKind OWNER_NEW_RECORDINGS or REPOSITORY_FALLBACK required.');
  requireThat(Array.isArray(plan.approvedTestPlayerIds)&&plan.approvedTestPlayerIds.length===2&&plan.approvedTestPlayerIds.every(id)&&new Set(plan.approvedTestPlayerIds).size===2,'Exactly two distinct approved AoF test player IDs required.');
  requireThat(Array.isArray(plan.recordings)&&plan.recordings.length===4,'Exactly four explicitly assigned recording paths required.');
  const ids=new Set(),slots=new Set();
  for(const row of plan.recordings){
    requireThat(id(row.id)&&!ids.has(row.id),'Recording IDs must be unique.');ids.add(row.id);
    requireThat(typeof row.filePath==='string'&&!!row.filePath.trim(),'Each recording requires filePath.');
    requireThat(id(row.eventId)&&['WARMUP','MAIN'].includes(row.act),'Each recording requires eventId and act WARMUP or MAIN.');
    // This small pilot represents one warm-up and one BO1 main Battle per Event.
    // Multiple warm-ups require the existing best-result policy, not addition.
    const slot=row.eventId+'/'+row.act;
    requireThat(!slots.has(slot),'Only one BO1 recording per Event/act is supported by this pilot.');slots.add(slot);
    requireThat(Array.isArray(row.bindings)&&row.bindings.length===2&&row.bindings.every(b=>Number.isInteger(b.replaySlot)&&b.replaySlot>0&&plan.approvedTestPlayerIds.includes(b.playerId))&&new Set(row.bindings.map(b=>b.playerId)).size===2&&new Set(row.bindings.map(b=>b.replaySlot)).size===2,'Each Game must bind two unique replay slots to exactly the approved two test IDs.');
    requireThat(row.gameConfig&&Array.isArray(row.gameConfig.maps?.pool)&&row.gameConfig.maps.pool.length>0&&row.gameConfig.victory&&row.gameConfig.civilizations,'Each recording requires its explicit announced gameConfig.');
    requireThat(row.gameConfig.diplomacyEnabled===false,'This four-duel pilot requires explicitly nondiplomatic announced settings.');
    requireThat(row.expectedSourceHash==null||sha(row.expectedSourceHash),'expectedSourceHash must be a lowercase SHA-256.');
    requireThat(row.expectedGameGuid==null||typeof row.expectedGameGuid==='string'&&!!row.expectedGameGuid.trim(),'expectedGameGuid must be a nonempty source GUID.');
    requireThat(row.emperorPlayerId==null||id(row.emperorPlayerId)&&!plan.approvedTestPlayerIds.includes(row.emperorPlayerId),'Any pilot Emperor must be a valid noncompeting operator, separate from the two test players.');
  }
  const events=[...new Set(plan.recordings.map(r=>r.eventId))];
  requireThat(events.length===2&&events.every(e=>slots.has(e+'/WARMUP')&&slots.has(e+'/MAIN')),'Use two Events, each with one warm-up and one BO1 main Battle.');
  return plan;
}

/** Pure oracle over decoder outputs; CLI below independently hashes current files. */
export function buildPilotReport(plan,inspections){
  validatePilotPlan(plan);
  requireThat(Array.isArray(inspections)&&inspections.length===4,'Four fresh recording inspections required.');
  const guids=new Set(),hashes=new Set(),pending=[];
  const totals=new Map(plan.approvedTestPlayerIds.map(playerId=>[playerId,{playerId,steamName:playerId,leaguePoints:0,leaguePointUnits:0,gamesPlayed:0,wins:0,losses:0,mainEventWins:0,warmupWins:0}]));
  const games=plan.recordings.map((row,index)=>{
    const inspected=inspections[index],facts=inspected?.matchFacts,hash=inspected?.sourceHash,guid=facts?.game?.guid;
    requireThat(sha(hash)&&facts?.source?.replaySha256===hash,row.id+': inspection source/hash mismatch.');
    requireThat(row.expectedSourceHash==null||row.expectedSourceHash===hash,row.id+': expected source hash mismatch.');
    requireThat(typeof guid==='string'&&!!guid.trim(),row.id+': source Game GUID unavailable.');
    requireThat(row.expectedGameGuid==null||row.expectedGameGuid===guid,row.id+': expected Game GUID mismatch.');
    const guidKey=guid.trim().toLowerCase();
    requireThat(!guids.has(guidKey)&&!hashes.has(hash),'All four recordings require distinct source Game GUIDs and byte hashes.');guids.add(guidKey);hashes.add(hash);
    const roster=inspected.players;
    requireThat(Array.isArray(roster)&&roster.length===2&&new Set(roster.map(p=>p.replaySlot)).size===2&&roster.every(p=>Number.isInteger(p.replaySlot)&&row.bindings.some(b=>b.replaySlot===p.replaySlot)),row.id+': inspected roster must be exactly the two bound source slots.');
    const opponentKind=roster.every(p=>p.isHuman===true)?'VERIFIED_HUMAN_V_HUMAN':roster.some(p=>p.isHuman===false)?'NONHUMAN_SOURCE':'PENDING_SOURCE';
    requireThat(opponentKind!=='NONHUMAN_SOURCE',row.id+': nonhuman source starter cannot fulfill the human-duel pilot.');
    const rawTeams=[...new Set(roster.map(p=>p.teamId))].sort((a,b)=>a-b);
    const participants=row.bindings.map(binding=>{const original=roster.find(p=>p.replaySlot===binding.replaySlot);return {playerId:binding.playerId,slot:binding.replaySlot,team:rawTeams.indexOf(original.teamId)+1};});
    const source={state:'READY',sourceHash:hash,matchFacts:facts,playerMapping:row.bindings.map(binding=>({...binding,sourceName:roster.find(p=>p.replaySlot===binding.replaySlot).name}))};
    const match={format:'ONE_V_ONE',participants,gameConfigSnapshot:row.gameConfig};
    const game={players:participants,gameConfigSnapshot:row.gameConfig};
    const qualification=deriveRecordingOutcome(match,game,source);
    const snapshot=seasonScoringSnapshot({act:row.act,diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:row.emperorPlayerId??null});
    let expectedSeasonPoints=null,winningPlayerIds=null;
    if(qualification.state==='VERIFIED'){
      winningPlayerIds=participants.filter(p=>p.team===qualification.outcome.winnerTeam).map(p=>p.playerId);
      const rewards=computeMatchRewards({...match,canonicalResult:{...qualification.outcome,revision:1,winningPlayerIds},scoringSnapshot:snapshot,context:{affectsLeaguePoints:true,affectsWarRoomPoints:false,affectsGold:false}});
      expectedSeasonPoints=rewards.map(reward=>{const points=Object.values(reward.leaguePoints).reduce((sum,x)=>sum+x,0),standing=totals.get(reward.playerId),won=winningPlayerIds.includes(reward.playerId);standing.leaguePoints+=points;standing.leaguePointUnits+=seasonPointUnits(points);standing.gamesPlayed++;standing[won?'wins':'losses']++;if(won)standing[row.act==='MAIN'?'mainEventWins':'warmupWins']++;return {playerId:reward.playerId,points,pointUnits:seasonPointUnits(points),components:reward.leaguePoints,won};});
    }else pending.push(row.id);
    const cumulative=rankSeasonStandings([...totals.values()]);
    return {id:row.id,eventId:row.eventId,act:row.act,filePath:row.filePath,inputKind:plan.inputKind,
      source:{sha256:hash,bytes:inspected.sourceBytes??null,gameGuid:guid,recordingVersion:facts.game.recordingVersion,sourcePlayers:roster,observedSettings:facts.rules,headerFieldCandidates:facts.headerFieldCandidates,observedDurationMs:facts.game.observedDurationMs,bodyParseComplete:facts.game.bodyParseComplete,terminalEvidence:facts.result},
      announcedGameConfig:row.gameConfig,gameSpecificBindingNotPermanentAlias:true,opponentKind,
      humanSourceReviewRequired:opponentKind!=='VERIFIED_HUMAN_V_HUMAN',approvedParticipants:participants,bindings:source.playerMapping,
      outcome:{state:qualification.state,reason:qualification.reason,winningPlayerIds,evidenceToken:qualification.evidenceToken},scoringSnapshot:snapshot,expectedSeasonPoints,
      standingsAfter:{state:pending.length?'PENDING_RESULTS':'READY_FOR_COMPARISON',pendingRecordingIds:[...pending],expected:pending.length?null:cumulative,verifiedGameSubtotal:cumulative}};
  });
  const ranked=rankSeasonStandings([...totals.values()]);
  const pendingOpponentIds=games.filter(g=>g.humanSourceReviewRequired).map(g=>g.id);
  return {modelVersion:REPORT_VERSION,planModelVersion:PLAN_VERSION,inputKind:plan.inputKind,
    evidenceLabel:plan.inputKind==='OWNER_NEW_RECORDINGS'?'New owner-supplied bytes; controlled per-Game AoF test identity simulation.':'Repository fallback bytes only; does not fulfill new owner-recording browser acceptance.',
    identityQualification:'CONTROLLED_GAME_SPECIFIC_TEST_MAPPING',gameSpecificBindingNotPermanentAlias:true,
    historicalNamesNeedNotMatchAcrossGames:true,originalNamesPreserved:true,
    acceptance:{state:pending.length?'PENDING_RESULTS':pendingOpponentIds.length?'PENDING_OPPONENT_REVIEW':'PREFLIGHT_ORACLE_ONLY',
      pendingOpponentReviewRecordingIds:pendingOpponentIds,browserAcceptance:'NOT_RUN',
      operatorSettingsReviewRequired:true,scoreOracleConditionalOn:'Operator confirmation of human starters, announced settings and authorized per-Game test bindings.'},
    outcomeModelVersion:RECORDING_OUTCOME_VERSION,seasonPointsModelVersion:SEASON_POINTS_VERSION,pointUnits:POINT_UNITS,
    limitations:['Read-only conditional expectations; no authenticated upload, actual READY publication, official result, ledger write or browser acceptance is established.','Only the existing outcome predicate qualifies terminal evidence; unsupported outcomes remain Pending.','A recorded player type/profile is not an admitted human classifier. Human-v-human evidence must be reviewed where opponentKind is Pending.','Gold, honours, private social interpretation and performance require their separate acceptance.'],
    games,standings:{state:pending.length?'PENDING_RESULTS':'READY_FOR_COMPARISON',pendingRecordingIds:pending,
      expectedFinal:pending.length?null:ranked,verifiedGameSubtotal:ranked}};
}

export async function runPilotReport(planPath,outputPath,{python=process.env.AOF_PYTHON??'python3'}={}){
  const absolutePlan=resolve(planPath),planBytes=await readFile(absolutePlan),plan=JSON.parse(planBytes.toString('utf8'));
  validatePilotPlan(plan);
  const normalized={...plan,recordings:plan.recordings.map(row=>({...row,filePath:resolve(dirname(absolutePlan),row.filePath)}))};
  const inspections=[];
  const repositorySources=new Set(JSON.parse(await readFile(resolve(root,'functions/tests/fixtures/recording-outcomes.json'),'utf8')).map(row=>row.sourceHash));
  for(const row of normalized.recordings){
    const bytes=await readFile(row.filePath),hash=createHash('sha256').update(bytes).digest('hex');
    const {stdout}=await run(python,[resolve(root,'replay-tools/export_recording_outcomes.py'),'--inspect',row.filePath],{maxBuffer:16*1024*1024});
    const inspected=JSON.parse(stdout);
    requireThat(inspected.sourceHash===hash&&inspected.sourceBytes===bytes.length,row.id+': source changed during independent byte inspection.');
    requireThat(plan.inputKind!=='OWNER_NEW_RECORDINGS'||!repositorySources.has(hash),row.id+': repository fallback bytes cannot be labeled as new owner recordings.');
    inspections.push(inspected);
  }
  const report={...buildPilotReport(normalized,inspections),planSha256:createHash('sha256').update(planBytes).digest('hex')};
  if(outputPath)await writeFile(resolve(outputPath),JSON.stringify(report,null,2)+'\n');
  return report;
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const [planPath,outputPath,...extra]=process.argv.slice(2);
  if(!planPath||!outputPath||extra.length)throw new Error('Usage: AOF_PYTHON=python3 node scripts/nov9-pilot-report.mjs PLAN.json REPORT.json');
  await runPilotReport(planPath,outputPath);
  console.log('Read-only pilot report written to '+resolve(outputPath));
}
