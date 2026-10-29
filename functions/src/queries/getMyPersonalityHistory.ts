import {deriveSocialScheduleOrders,scheduleTimestampMillis,type ScheduleBattle} from '../integration/socialScheduleOrder.js';
import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {SOCIAL_V1_CONTRACT} from '../domain/socialV1.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {projectPrivatePersonalityHistory,type PersonalityHistoryBattle} from '../integration/personalityHistory.js';
import {privatePersonalityE2EEnabled,privatePersonalityPolicy,
  PRIVATE_SOURCE_TAXONOMY,type PrivateTaxonomy} from '../engines/personalityV1/privateE2EPolicy.js';
import {loadMyCurrentSocialSource,assertIntV1PrivateReadEnabled} from './getMySocialExperience.js';

type Bag=Record<string,any>;
export const INT_B_LIMITS=Object.freeze({pageSize:64,maxMatches:256,maxOwnGames:64,maxResponseBytes:512*1024,budgetMs:100_000});
const validId=(s:unknown):s is string=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(s);
const changed=()=>new HttpsError('aborted','Private history changed during the read. Refresh your history.');
export function assertIntBEnabled(env:NodeJS.ProcessEnv){
  assertIntV1PrivateReadEnabled(env);
  if(env.AOF_INT_V1_PRIVATE_HISTORY!=='battle-v1')throw new HttpsError('failed-precondition','Private history is disabled.');
}
/** Complete-or-error current input collection. This is not an evaluator or a
 * persisted ledger. All source admission/artifact verification reuses INT-A. */
export async function collectMyCurrentBattleHistory(input:{db:any;bucket:any;actor:{playerId:string;authUid:string};
  request:Record<string,never>;env:NodeJS.ProcessEnv;maxOwnGames?:number;includeScheduleOrder?:boolean}){
  const {db,bucket,actor,env}=input;
  assertIntBEnabled(env);
  if(!input.request||Array.isArray(input.request)||typeof input.request!=='object'||Object.keys(input.request).length)
    throw new HttpsError('invalid-argument','Private history accepts no player, source, policy or cursor arguments.');
  const maxOwnGames=input.maxOwnGames??INT_B_LIMITS.maxOwnGames;
  if(!Number.isSafeInteger(maxOwnGames)||maxOwnGames<1||maxOwnGames>INT_B_LIMITS.maxOwnGames)throw new Error('Invalid internal history budget');
  const started=Date.now();
  const budget=()=>{if(Date.now()-started>INT_B_LIMITS.budgetMs)throw new HttpsError('resource-exhausted','Complete private-history read exceeded its budget.');};
  const read=async(ref:any,tx?:any)=>{budget();return tx?tx.get(ref):ref.get();};
  const access=async(tx?:any)=>{
    const [p,l]=await Promise.all([read(db.doc('players/'+actor.playerId),tx),read(db.doc('authLinks/'+actor.authUid),tx)]);
    if(p.data()?.membershipStatus!=='ACTIVE'||l.data()?.playerId!==actor.playerId)
      throw new HttpsError('permission-denied','Active linked membership is required.');
    return bindingDigest([p.data(),l.data()]);
  };
  const accessToken=await access();
  async function matches(tx?:any){
    const docs:any[]=[];let last:any=null;
    do{
      let q=db.collection('matches').orderBy('__name__').limit(INT_B_LIMITS.pageSize);
      if(last)q=q.startAfter(last);
      const page=await read(q,tx);
      for(const doc of page.docs){
        if(!validId(doc.id)||last&&doc.id<=last.id||docs.some(d=>d.id===doc.id))throw changed();
        docs.push(doc);
        if(docs.length>INT_B_LIMITS.maxMatches)throw new HttpsError('resource-exhausted','Private history exceeds the complete-read Battle limit.');
      }
      if(page.docs.length<INT_B_LIMITS.pageSize)return docs;
      last=page.docs.at(-1);
    }while(true);
  }
  const initialMatches=await matches();
  const own=(docs:any[])=>docs.filter(d=>d.data()?.participants?.some((p:Bag)=>p.playerId===actor.playerId));
  const matchToken=(docs:any[])=>bindingDigest(docs.map(d=>[d.id,
    d.data()?.participants?.some((p:Bag)=>p.playerId===actor.playerId)?d.data():null]));
  const initialToken=matchToken(initialMatches),checkpoints=new Map<string,{ref:any;token:string;tokenOf:(data:any)=>string}>();
  const checkpoint=async(ref:any,tokenOf:(data:any)=>string=bindingDigest)=>{const snap=await read(ref);checkpoints.set(ref.path,{ref,tokenOf,token:tokenOf(snap.data()??null)});return snap;};
  const gameSets:Array<{ref:any;token:string}>=[],loaded:Array<Awaited<ReturnType<typeof loadMyCurrentSocialSource>>>=[];
  const schedules:ScheduleBattle[]=[];
  const battles:PersonalityHistoryBattle[]=[],pending:Array<{battleId:string;gameId:string;reason:string}>=[];
  const seenSources=new Set<string>(),seenGuids=new Set<string>();let count=0;
  const gamesToken=(docs:any[])=>bindingDigest(docs.map(d=>[d.id,d.data()]));
  for(const matchDoc of own(initialMatches)){
    const m=matchDoc.data(),query=matchDoc.ref.collection('games').orderBy('__name__').limit(maxOwnGames+1);
    const games=await read(query);count+=games.docs.length;
    if(count>maxOwnGames)throw new HttpsError('resource-exhausted','Private history exceeds the complete-read Game limit.');
    gameSets.push({ref:query,token:gamesToken(games.docs)});
    if(games.docs.some((d:any)=>!validId(d.id)))throw new HttpsError('failed-precondition','Private history has invalid Game identity.');
    if(!input.includeScheduleOrder&&(games.docs.some((d:any)=>!Number.isSafeInteger(d.data()?.gameNumber)||d.data().gameNumber<1)||
      new Set(games.docs.map((d:any)=>d.data().gameNumber)).size!==games.docs.length))
      throw new HttpsError('failed-precondition','Private history has ambiguous Game sequence.');
    let event:Bag|null=null;
    for(const [collection,id] of [['events',m.eventId],['seasons',m.seasonId]])
      if(validId(id)){const snap=await checkpoint(db.doc(collection+'/'+id),input.includeScheduleOrder&&collection==='events'?
        data=>bindingDigest([data,scheduleTimestampMillis(data?.startsAt)]):bindingDigest);if(collection==='events')event=snap.data()??null;}
    if(input.includeScheduleOrder){
      const planId=validId(event?.approvedMatchPlanId)?event!.approvedMatchPlanId:null;
      const plan=planId&&validId(m.eventId)?(await checkpoint(db.doc('events/'+m.eventId+'/matchPlans/'+planId))).data()??null:null;
      schedules.push({battleId:matchDoc.id,match:m,event,planId,plan,games:games.docs.map((d:any)=>({gameId:d.id,game:d.data()}))});
    }
    const battle:PersonalityHistoryBattle={battleId:matchDoc.id,gameIds:games.docs.map((d:any)=>d.id).sort(),sources:[]};
    for(const gameDoc of games.docs){
      const g=gameDoc.data();
      if(/^[a-f0-9]{64}$/.test(g.activeReplayStatisticsId??'')){
        const s=await checkpoint(gameDoc.ref.collection('replaySources').doc(g.activeReplayStatisticsId));
        const guid=s.data()?.matchFacts?.game?.guid;
        if(typeof guid==='string'&&guid&&guid.length<=200)await checkpoint(db.doc('recordingGameClaims/'+Buffer.from(guid).toString('hex')));
      }
      if(!g.players?.some((p:Bag)=>p.playerId===actor.playerId)){
        pending.push({battleId:matchDoc.id,gameId:gameDoc.id,reason:'NOT_A_GAME_PARTICIPANT'});continue;
      }
      try{
        const source=await loadMyCurrentSocialSource({db,bucket,actor,env,request:{matchId:matchDoc.id,gameId:gameDoc.id}});
        if(seenSources.has(source.source.sourceHash)||seenGuids.has(source.source.gameGuid!))
          throw new HttpsError('data-loss','Duplicate recording/GUID across private history.');
        seenSources.add(source.source.sourceHash);seenGuids.add(source.source.gameGuid!);
        loaded.push(source);battle.sources.push(source);
      }catch(e){
        if((e as any)?.code!=='failed-precondition')throw e;
        pending.push({battleId:matchDoc.id,gameId:gameDoc.id,reason:'CURRENT_NATIVE_SOURCE_PENDING'});
      }
    }
    battle.sources.sort((a,b)=>a.game.gameNumber-b.game.gameNumber||a.source.gameId.localeCompare(b.source.gameId));
    battles.push(battle);
  }
  const inputDigest=bindingDigest([actor.playerId,accessToken,initialToken,gameSets.map(q=>q.token),
    [...checkpoints].map(([path,p])=>[path,p.token]),loaded.map(s=>s.source)]);
  // One read-only transaction fences the entire enumerated current set, including
  // insertions/deletions, all pending-source authorities, access and loaded sources.
  const revalidate=async()=>{await db.runTransaction(async(tx:any)=>{
    if(await access(tx)!==accessToken||matchToken(await matches(tx))!==initialToken)throw changed();
    for(const q of gameSets)if(gamesToken((await read(q.ref,tx)).docs)!==q.token)throw changed();
    for(const p of checkpoints.values())if(p.tokenOf((await read(p.ref,tx)).data()??null)!==p.token)throw changed();
    for(const s of loaded)await s.revalidate(tx);
    budget();
  });};
  await revalidate();
  return {battles,loaded,pending,inputDigest,scheduleOrders:input.includeScheduleOrder?deriveSocialScheduleOrders(schedules):[],coverage:{completeEnumeration:true as const,scannedLeagueBattles:initialMatches.length,ownBattles:battles.length,ownGames:count,currentSources:loaded.length,measuredIndependentBattles:0 as const},revalidate};
}
/** Existing INT-B wire contract; C1 reuses collection/fencing, not profile values. */
export async function readMyPersonalityHistory(input:Parameters<typeof collectMyCurrentBattleHistory>[0] & {
  /** Isolated emulator-only test injection. Never present in callable data. */
  personalityTaxonomy?:PrivateTaxonomy;
}){
  if(input.personalityTaxonomy && !privatePersonalityE2EEnabled(input.env))
    throw new HttpsError('failed-precondition','Private Personality test policy disabled.');
  // Reuse the authenticated, transaction-fenced approved schedule/plan seam.
  // Missing firstCompletedAt must not be substituted by upload/document order.
  const current=await collectMyCurrentBattleHistory({...input,includeScheduleOrder:true});
  // Only the authenticated complete current-source reader may supply history
  // and the actor. Entire-set revision fencing remains INT-B's responsibility.
  const pilot=privatePersonalityE2EEnabled(input.env)?
    privatePersonalityPolicy(input.actor.playerId,current.loaded,
      input.personalityTaxonomy??PRIVATE_SOURCE_TAXONOMY):null;
  const personality=projectPrivatePersonalityHistory(input.actor.playerId,current.battles,
    current.inputDigest,pilot?.context,pilot?.calibration??null,current.scheduleOrders);
  const response={version:'AOF_INT_B_PRIVATE_HISTORY_1' as const,contract:SOCIAL_V1_CONTRACT,
    visibility:'OWNER_ONLY' as const,ownerPlayerId:input.actor.playerId,inputDigest:current.inputDigest,
    status:current.pending.length?'PENDING_INPUTS' as const:'CURRENT_INPUTS' as const,
    coverage:{...current.coverage,
      measuredIndependentBattles:new Set(personality.battleFeatures.filter(f=>f.numerator!==null)
        .map(f=>f.battleId)).size},
    sources:current.loaded.map(s=>s.source),pending:current.pending,personality,
    social:{status:'PENDING' as const,reason:'SOURCE_QUALIFIER_AND_APPROVED_RULES_PENDING'},
    effects:{officialWrites:false as const,receiptPublication:false as const,entitlementGrants:false as const}};
  if(Buffer.byteLength(JSON.stringify(response))>INT_B_LIMITS.maxResponseBytes)
    throw new HttpsError('resource-exhausted','Private history exceeds its complete-response budget.');
  await current.revalidate();
  return response;
}
export const getMyPersonalityHistory=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB'},async request=>{
  const actor=await requireLeaguePlayer(request),project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  return readMyPersonalityHistory({db,bucket:getStorage().bucket(process.env.REPLAY_BUCKET||project+'.appspot.com'),actor,
    request:request.data,env:process.env});
});
