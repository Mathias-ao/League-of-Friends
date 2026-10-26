import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {SOCIAL_V1_CONTRACT,type SourceSnapshot} from '../domain/socialV1.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';
import {privateSourceExperience} from '../integration/intV1Experience.js';
import {loadActiveNativeEvidence} from './activeNativeEvidenceRead.js';

type Bag=Record<string,any>;
export interface MySocialExperienceRequest{matchId:string;gameId:string}
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v);
const fail=()=>new HttpsError('failed-precondition','No admitted current recording is available for this private view.');
const stale=()=>new HttpsError('aborted','Recording or access changed. Reopen the current Game.');

/** Default-off even in production, regardless of callers' roles. No credentials,
 * worker calls, scans, source writes, flags or persistence are performed here. */
export function assertIntV1PrivateReadEnabled(env:NodeJS.ProcessEnv){
  const project=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT;
  if(env.AOF_INT_V1_PRIVATE_READS!=='source-v1'||
    !(project==='age-of-friends-staging'||env.FUNCTIONS_EMULATOR==='true'&&project?.startsWith('demo-')))
    throw new HttpsError('failed-precondition','Private integration read is disabled.');
}

export async function loadMyCurrentSocialSource(input:{db:any;bucket:any;actor:{playerId:string;authUid:string};
  request:MySocialExperienceRequest;env:NodeJS.ProcessEnv}){
  const {db,bucket,actor,request:r,env}=input;
  assertIntV1PrivateReadEnabled(env);
  if(!r||!id(r.matchId)||!id(r.gameId)||Object.keys(r).some(k=>!['matchId','gameId'].includes(k)))
    throw new HttpsError('invalid-argument','Only Battle and Game identifiers are accepted.');
  const mr=db.doc('matches/'+r.matchId),gr=mr.collection('games').doc(r.gameId);
  const snapshot=async(tx:any)=>{
    const refs=[mr,gr,db.doc('players/'+actor.playerId),db.doc('authLinks/'+actor.authUid)];
    const docs=await Promise.all(refs.map(ref=>tx.get(ref)));
    const [m,g,p,l]=docs.map(s=>s.data());
    if(p?.membershipStatus!=='ACTIVE'||l?.playerId!==actor.playerId)
      throw new HttpsError('permission-denied','Active linked membership is required.');
    // Deliberately no administrator override or arbitrary playerId request.
    if(!g?.players?.some((p:Bag)=>p.playerId===actor.playerId)||
       !m?.participants?.some((p:Bag)=>p.playerId===actor.playerId))
      throw new HttpsError('permission-denied','This private view belongs to a Game participant.');
    const roster=g.players.map((p:Bag)=>p.playerId);
    if(roster.length<2||roster.length>8||new Set(roster).size!==roster.length||
      roster.some((v:any)=>!id(v)||!m.participants.some((p:Bag)=>p.playerId===v))||
      !id(m.eventId)||!id(m.seasonId)||!Number.isSafeInteger(g.gameNumber)||g.gameNumber<1||
      !/^[a-f0-9]{64}$/.test(g.activeReplayStatisticsId??''))throw fail();
    const more=await Promise.all([db.doc('events/'+m.eventId),db.doc('seasons/'+m.seasonId),
      gr.collection('replaySources').doc(g.activeReplayStatisticsId),
      ...roster.map((p:string)=>db.doc('players/'+p))].map(ref=>tx.get(ref)));
    const [event,season,source]=more.map(s=>s.data());
    if(more.some(s=>!s.exists)||event.seasonId!==m.seasonId)throw fail();
    const lists=[event.officialMatchIds,event.warmupMatchIds];
    if(lists.every(v=>v===undefined)||lists.some(v=>v!==undefined&&(!Array.isArray(v)||
      v.some((x:any)=>!id(x))||new Set(v).size!==v.length))||
      lists.filter(v=>v?.includes(r.matchId)).length!==1||m.replacementMatchId!=null||
      !['READY','ACTIVE','AWAITING_CONFIRMATION','COMPLETED'].includes(m.status)||
      !['READY','ACTIVE','AWAITING_CONFIRMATION','COMPLETED'].includes(g.status)||
      !['PUBLISHED','ACTIVE','COMPLETED','POSTPONED'].includes(event.status)||
      !['UPCOMING','ACTIVE','COMPLETED','ARCHIVED'].includes(season.status)||
      m.opponentKind==='AI'||g.aiOpponent||m.activeResultDisputeId||g.activeResultDisputeId||
      source?.state!=='READY'||source.sourceHash!==g.activeReplayStatisticsId)throw fail();
    const guid=source.matchFacts?.game?.guid;
    // Every native source requires its current global Game claim, not just an
    // artifact or retained READY document. Missing GUID is not invented here.
    if(typeof guid!=='string'||!guid||guid.length>200)throw fail();
    const claim=await tx.get(db.doc('recordingGameClaims/'+Buffer.from(guid).toString('hex')));
    if(claim.data()?.matchId!==r.matchId||claim.data()?.gameId!==r.gameId||
      claim.data()?.sourceHash!==g.activeReplayStatisticsId)throw fail();
    return {m,g,event,season,source,guid,token:bindingDigest([...docs,...more,claim].map(s=>({path:s.ref.path,data:s.data()??null})))};
  };
  const before=await db.runTransaction(snapshot);
  const loaded=await loadActiveNativeEvidence({db,bucket,actor,matchId:r.matchId,gameId:r.gameId,env,allowPending:true});
  if(loaded.sourceId!==before.g.activeReplayStatisticsId||bindingDigest(loaded.source)!==bindingDigest(before.source))throw stale();
  const s=loaded.source,g=before.g,official=currentOfficialGameOutcome(g,before.m);
  if(s.originalRecording.sha256!==loaded.sourceId||
    [s.statistics,s.recordedEvents,s.originalRecording].some(a=>
      !/^[a-f0-9]{64}$/.test(a?.sha256??'')||!/^[0-9]+$/.test(String(a?.generation??'')))||
    bindingDigest(loaded.statistics.matchFacts)!==bindingDigest(s.matchFacts))
    throw new HttpsError('data-loss','Retained recording provenance does not match the verified artifact.');
  const source:SourceSnapshot={contract:SOCIAL_V1_CONTRACT,authorityRevision:before.token,
    battleId:r.matchId,matchId:r.matchId,gameId:r.gameId,eventId:before.m.eventId,seasonId:before.m.seasonId,
    gameGuid:before.guid,sourceHash:loaded.sourceId,statisticsRevision:g.replayStatisticsRevision,
    artifactRefs:[{kind:'STATISTICS',digest:s.statistics.sha256,generation:String(s.statistics.generation)},
      {kind:'RECORDED_EVENTS',digest:s.recordedEvents.sha256,generation:String(s.recordedEvents.generation)},
      {kind:'ORIGINAL',digest:s.originalRecording.sha256,generation:String(s.originalRecording.generation)}],
    mappingDigest:bindingDigest(s.playerMapping),
    eventAdmissionDigest:bindingDigest({matchId:r.matchId,event:before.event,season:before.season}),
    outcome:official.qualification==='OFFICIAL'?{qualification:'OFFICIAL',resultRevision:official.resultRevision,
      winningPlayerIds:official.winnerPlayerIds}:{qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null},
    roster:s.playerMapping.map((p:Bag)=>({replaySlot:p.replaySlot,playerId:p.playerId,
      teamId:g.players.find((v:Bag)=>v.playerId===p.playerId).team==null?null:
        String(g.players.find((v:Bag)=>v.playerId===p.playerId).team)})).sort((a:Bag,b:Bag)=>a.replaySlot-b.replaySlot)};
  const response=privateSourceExperience(actor.playerId,source);
  await loaded.revalidate();
  // Final transactional snapshot is the response's linearization point. A
  // correction, roster remap, GUID transfer or membership change must abort.
  const revalidate=async(tx?:any)=>{
    const check=async(t:any)=>{if((await snapshot(t)).token!==before.token)throw stale();};
    if(tx)await check(tx);else await db.runTransaction(check);
  };
  await revalidate();
  return {source:response.source,statistics:loaded.statistics,match:before.m,game:before.g,recordedEvents:before.source.recordedEvents,statisticsArtifact:before.source.statistics,revalidate};
}

/** Existing INT-A wire response is unchanged; INT-B reuses the same verified load. */
export async function readMySocialExperience(input:Parameters<typeof loadMyCurrentSocialSource>[0]){
  const loaded=await loadMyCurrentSocialSource(input);
  return privateSourceExperience(input.actor.playerId,loaded.source);
}

export const getMySocialExperience=onCall<MySocialExperienceRequest>({...callableOptions,timeoutSeconds:120,memory:'1GiB'},async request=>{
  const actor=await requireLeaguePlayer(request);
  const project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  return readMySocialExperience({db,bucket:getStorage().bucket(process.env.REPLAY_BUCKET||project+'.appspot.com'),
    actor,request:request.data,env:process.env});
});
