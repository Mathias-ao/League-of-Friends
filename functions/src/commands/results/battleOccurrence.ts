/** Bounded source-only occurrence authority. No source, result or score writes.
 * Participant confirmation is optional; independent opposing confirmation can
 * approve the SAME bounded Game windows without routine admin maintenance.
 * No endpoint is activated until Sol reserves the selective index export.
 */
import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {isolatedStagingProject} from '../../config/stagingProject.js';
import {requireLeaguePlayer,requireAdmin} from '../../auth/authorization.js';
import {bindingDigest} from '../../engines/nativeRecordingIntegration.js';
import {BATTLE_OCCURRENCE_VERSION,canonicalOccurrenceGames,occurrenceSourceBinding,
 verifiedOccurrence,sourceBoundReadyReceiptMillis,type OccurrenceBattle,type GameBounds,type ReviewedPrecedence} from '../../integration/battleOccurrence.js';

type Bag=Record<string,any>;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const wrong=()=>new HttpsError('failed-precondition','Battle, source, result or chronology authority changed.');
type Actor={playerId:string;authUid:string;role:string};
type Request={battleId:string;expectedSourceBinding:string;bounds:GameBounds[];reason?:string;precedes?:ReviewedPrecedence[]};
const same=(a:any,b:any)=>bindingDigest(a)===bindingDigest(b);
/** No new cloud selector/runtime is authorized by this source change. */
export function assertBattleOccurrenceEnabled(env:NodeJS.ProcessEnv){
 if(env.AOF_BATTLE_OCCURRENCE_V1!=='source-v1'||!isolatedStagingProject(env,false))
  throw new HttpsError('failed-precondition','Battle occurrence confirmation is not enabled.');
}

/** Transaction-only source check. Reading the current GUID claim prevents an
 * otherwise plausible but remapped or withdrawn original from authorizing time. */
async function currentBattle(tx:any,battleId:string):Promise<OccurrenceBattle>{
 const mr=db.doc('matches/'+battleId),m=(await tx.get(mr)).data();
 if(!m||!id(m.eventId)||!id(m.seasonId))throw wrong();
 const er=db.doc('events/'+m.eventId),event=(await tx.get(er)).data();
 const planId=id(event?.approvedMatchPlanId)?event.approvedMatchPlanId:null;
 const plan=planId?(await tx.get(er.collection('matchPlans').doc(planId))).data()??null:null;
 const gs=await tx.get(mr.collection('games').orderBy('__name__').limit(9));
 if(gs.docs.length>8||!gs.docs.length)throw wrong();
 const games=[];
 for(const row of gs.docs){
  const game=row.data();
  let source=null;
  if(hash(game.activeReplayStatisticsId)){
   const doc=(await tx.get(row.ref.collection('replaySources').doc(game.activeReplayStatisticsId))).data();
   const guid=doc?.matchFacts?.game?.guid;
   const mapping=doc?.playerMapping,roster=game.players?.map((p:Bag)=>p.playerId);
   if(doc?.state!=='READY'||doc?.matchId!==battleId||doc?.gameId!==row.id||
     doc?.sourceHash!==game.activeReplayStatisticsId||doc?.originalRecording?.sha256!==doc.sourceHash||
     !hash(doc?.statistics?.sha256)||!hash(doc?.recordedEvents?.sha256)||
     !hash(doc?.processorRevision)||
     ![doc?.originalRecording?.generation,doc?.statistics?.generation,
       doc?.recordedEvents?.generation].every(v=>/^[0-9]+$/.test(String(v??'')))||
     !Number.isSafeInteger(game.replayStatisticsRevision)||game.replayStatisticsRevision<1||
     !id(guid)||!Array.isArray(mapping)||!Array.isArray(roster)||
     mapping.length!==roster.length||
     new Set(mapping.map((p:Bag)=>p.playerId)).size!==mapping.length||
     new Set(mapping.map((p:Bag)=>p.replaySlot)).size!==mapping.length||
     mapping.some((p:Bag)=>!Number.isSafeInteger(p.replaySlot)||p.replaySlot<1||p.replaySlot>8)||
     !same([...mapping.map((p:Bag)=>p.playerId)].sort(),[...roster].sort()))
       throw wrong();
   const claim=(await tx.get(db.doc('recordingGameClaims/'+Buffer.from(guid).toString('hex')))).data();
   if(claim?.matchId!==battleId||claim?.gameId!==row.id||claim?.sourceHash!==doc.sourceHash)throw wrong();
   source={sourceHash:doc.sourceHash,gameGuid:guid,mappingDigest:bindingDigest(doc.playerMapping),
     provenanceDigest:bindingDigest([doc.sourceHash,game.replayStatisticsRevision,
       [{kind:'STATISTICS',digest:doc.statistics.sha256,generation:String(doc.statistics.generation)},
        {kind:'RECORDED_EVENTS',digest:doc.recordedEvents.sha256,generation:String(doc.recordedEvents.generation)},
        {kind:'ORIGINAL',digest:doc.originalRecording.sha256,generation:String(doc.originalRecording.generation)}],
       doc.processorRevision]),
     publicationAtMs:sourceBoundReadyReceiptMillis(doc,battleId,row.id,game.activeReplayStatisticsId)};
  }
  games.push({gameId:row.id,game,source});
 }
 const out:OccurrenceBattle={battleId,match:m,event:event??null,plan,planId,games};
 if(!canonicalOccurrenceGames(out)||!occurrenceSourceBinding(out))throw wrong();
 return out;
}
function validatedBounds(b:OccurrenceBattle,raw:unknown,requireReceipt=true):GameBounds[]{
 const games=canonicalOccurrenceGames(b)!;
 if(!Array.isArray(raw)||raw.length!==games.length)throw new HttpsError('invalid-argument','Supply one bounded window for each required Game.');
 const found=raw.map((x:any)=>({gameId:x?.gameId,notBeforeMs:x?.notBeforeMs,notAfterMs:x?.notAfterMs}));
 for(let i=0;i<games.length;i++){
  const x=found[i],source=games[i].source!;
  if(x.gameId!==games[i].gameId||!Number.isSafeInteger(x.notBeforeMs)||
    !Number.isSafeInteger(x.notAfterMs)||x.notBeforeMs<1||x.notAfterMs<=x.notBeforeMs||
    x.notAfterMs-x.notBeforeMs>14*86400000||
    x.notAfterMs>Date.now()||
    (requireReceipt&&source.publicationAtMs===null)||
    (source.publicationAtMs!==null&&x.notAfterMs>source.publicationAtMs)||
    i>0&&found[i-1].notAfterMs>=x.notBeforeMs)
      throw new HttpsError('invalid-argument','Proposed Game windows are not source-bound, ordered and bounded.');
 }
 return found;
}
const up=(record:any,current:any)=>({...record,revision:(current?.revision??0)+1});
function checkedRevision(current:any){
 if(current!==undefined&&current!==null&&(!Number.isSafeInteger(current.revision)||current.revision<1))
  throw wrong();
}
function approval(tx:any,mr:any,current:any,next:Bag){
 checkedRevision(current);
 const currentRef=mr.collection('occurrence').doc('current'),row=up(next,current);
 tx.set(currentRef,row);
 tx.create(mr.collection('occurrenceRevisions').doc('R'+row.revision),row);
 return row;
}
async function verifyActor(tx:any,actor:Actor){
 const p=(await tx.get(db.doc('players/'+actor.playerId))).data();
 const link=(await tx.get(db.doc('authLinks/'+actor.authUid))).data();
 if(p?.membershipStatus!=='ACTIVE'||link?.playerId!==actor.playerId||p.role!==actor.role)
  throw new HttpsError('permission-denied','Linked ACTIVE league identity changed.');
}
export async function attestBattleOccurrence(input:{actor:Actor;request:Request}){
 const {actor,request:r}=input;
 if(!id(r?.battleId)||!hash(r.expectedSourceBinding)||r.precedes!==undefined||r.reason!==undefined)
  throw new HttpsError('invalid-argument','Only a canonical Battle, opaque current binding and bounded Game windows may be submitted.');
 return db.runTransaction(async tx=>{
  await verifyActor(tx,actor);
  const b=await currentBattle(tx,r.battleId),mr=db.doc('matches/'+r.battleId);
  if(!b.match.participants.some((p:Bag)=>p.playerId===actor.playerId))throw new HttpsError('permission-denied','Only a Battle participant may attest its occurrence.');
  // Client echoes only an opaque, owner-authorized current revision digest,
  // never a raw replay hash/path. This rejects an old participant play-window
  // assertion after the authoritative Game/source/result was replaced.
  const binding=occurrenceSourceBinding(b)!;
  if(binding!==r.expectedSourceBinding)throw wrong();
  const bounds=validatedBounds(b,r.bounds);
  const attestationsRef=mr.collection('occurrenceAttestations');
  const attestations=await tx.get(attestationsRef);
  const current=(await tx.get(mr.collection('occurrence').doc('current'))).data();
  checkedRevision(current);
  // A source-reviewed independent admin judgment is amended by admin review,
  // never invalidated through a participant's unilateral replacement window.
  if(current?.status==='REVOKED'||current?.status==='APPROVED'&&current.proof?.kind==='ADMIN_REVIEWED')
    throw new HttpsError('failed-precondition','Reviewed or revoked occurrence needs independent correction review.');
  const my=attestations.docs.find((d:any)=>d.id===actor.playerId)?.data();
  // Pending resubmission must retry current opposing authentication: an AuthLink
  // may have been restored without the source bounds changing.
  const sameOwn=my?.sourceBinding===binding&&same(my.bounds,bounds)&&
    my.actorUid===actor.authUid&&my.actorPlayerId===actor.playerId;
  const byId=new Map(attestations.docs.map((d:any)=>[d.id,d.data()]));
  byId.set(actor.playerId,{version:BATTLE_OCCURRENCE_VERSION,sourceBinding:binding,bounds,
    actorUid:actor.authUid,actorPlayerId:actor.playerId});
  // Use only canonically required, current official Games: a precreated
  // unused/NO_CONTEST BO3 terminal Game cannot establish opposition.
  const opponentsInEveryRequiredGame=(left:string,right:string)=>{
    const required=canonicalOccurrenceGames(b);
    return !!required?.length&&required.every(g=>{
      const roster=g.game.players;
      const a=roster.find((p:Bag)=>p.playerId===left);
      const other=roster.find((p:Bag)=>p.playerId===right);
      return a&&other&&a.team!==null&&a.team!==undefined&&
        other.team!==null&&other.team!==undefined&&a.team!==other.team;
    });
  };
  let partner:{playerId:string;authUid:string}|null=null;
  for(const [playerId,other] of byId){
    if(playerId===actor.playerId||!id(playerId)||!id(other?.actorUid)||
       other.actorPlayerId!==playerId||other.actorUid===actor.authUid||
       !b.match.participants.some((p:Bag)=>p.playerId===playerId)||
       !opponentsInEveryRequiredGame(actor.playerId,playerId)||
       other.sourceBinding!==binding||!same(other.bounds,bounds))continue;
    // A previously saved row does not prove its UID still belongs to an
    // ACTIVE league opponent. Recheck both authorities in THIS approval tx.
    const [member,link]=await Promise.all([
      tx.get(db.doc('players/'+playerId)),
      tx.get(db.doc('authLinks/'+other.actorUid))
    ]);
    if(member.data()?.membershipStatus!=='ACTIVE'||link.data()?.playerId!==playerId)
      continue;
    partner={playerId,authUid:other.actorUid};
    break;
  }
  const approved=Boolean(partner);
  const unchangedApproval=current?.status==='APPROVED'&&current.sourceBinding===binding&&
    same(current.bounds,bounds)&&current.proof?.kind==='MUTUAL_PARTICIPANTS'&&
    partner&&same(current.proof.participants,[actor.playerId,partner.playerId].sort())&&
    same(current.proof.witnessUids,[actor.authUid,partner.authUid].sort());
  if(sameOwn&&unchangedApproval)
    return {status:'APPROVED' as const,idempotent:true,revision:current.revision};
  if(sameOwn&&!partner&&current?.status==='PENDING'&&current.sourceBinding===binding&&
    same(current.bounds,bounds))
    return {status:'PENDING' as const,idempotent:true,revision:current.revision};
  const now=Timestamp.now();
  const next={version:BATTLE_OCCURRENCE_VERSION,battleId:r.battleId,sourceBinding:binding,
    status:approved?'APPROVED':'PENDING',bounds,precedes:[],
    proof:approved?{kind:'MUTUAL_PARTICIPANTS',participants:[actor.playerId,partner!.playerId].sort(),
      witnessUids:[actor.authUid,partner!.authUid].sort(),sourceRevision:binding}:null,updatedAt:now};
  tx.set(attestationsRef.doc(actor.playerId),{version:BATTLE_OCCURRENCE_VERSION,
    sourceBinding:binding,bounds,actorUid:actor.authUid,actorPlayerId:actor.playerId,updatedAt:now});
  // Any changed assertion invalidates a previous approval in the same transaction.
  const saved=approval(tx,mr,current,next);
  return {status:saved.status,revision:saved.revision,idempotent:false};
 });
}
/** Rare exception only. The reviewer supplies exact independently inspected
 * source references and reason. This never guesses from a replay header, result
 * completion timestamp, schedule, filename or warmup registration order. */
export async function reviewBattleOccurrence(input:{actor:Actor;request:Request&{
 action:'APPROVE'|'REVOKE';expectedRevision:number|null;evidenceRefs?:string[]}}){
 const {actor,request:r}=input;
 if(actor.role!=='ADMIN')throw new HttpsError('permission-denied','Admin review required.');
 if(!id(r?.battleId)||!hash(r.expectedSourceBinding)||!Number.isSafeInteger(r.expectedRevision)&&r.expectedRevision!==null||
   !['APPROVE','REVOKE'].includes(r.action)||typeof r.reason!=='string'||r.reason.trim().length<20||
   r.reason.length>1000||!Array.isArray(r.evidenceRefs)||r.evidenceRefs.length<1||
   r.evidenceRefs.length>12||r.evidenceRefs.some(v=>typeof v!=='string'||v.length<16||v.length>256))
   throw new HttpsError('invalid-argument','Reviewed evidence, exact revision and reason are required.');
 return db.runTransaction(async tx=>{
  await verifyActor(tx,actor);
  const b=await currentBattle(tx,r.battleId),mr=db.doc('matches/'+r.battleId);
  const binding=occurrenceSourceBinding(b)!;
  if(binding!==r.expectedSourceBinding)throw wrong();
  if(b.match.participants.some((p:Bag)=>p.playerId===actor.playerId))
    throw new HttpsError('permission-denied','An involved player cannot independently review this Battle.');
  const current=(await tx.get(mr.collection('occurrence').doc('current'))).data();
  checkedRevision(current);
  if((current?.revision??null)!==r.expectedRevision)throw wrong();
  const bounds=r.action==='APPROVE'?validatedBounds(b,r.bounds,false):[];
  const edges=r.action==='APPROVE'?(r.precedes??[]):[];
  if(!Array.isArray(edges)||edges.length>12||
     edges.some(v=>!v||!id(v.battleId)||v.battleId===r.battleId||
       !hash(v.sourceBinding)||!Number.isSafeInteger(v.revision)||v.revision<1)||
     new Set(edges.map(v=>v.battleId)).size!==edges.length)
      throw new HttpsError('invalid-argument','Invalid reviewed precedence witness.');
  // Every explicit precedence binds a separately current, source-verified and
  // approved TARGET, including its approval revision. Never trust a name-only
  // edge or keep using an edge through correction of either Battle.
  for(const edge of edges){
    const target=await currentBattle(tx,edge.battleId);
    target.occurrence=(await tx.get(db.doc('matches/'+edge.battleId+'/occurrence/current'))).data();
    const proof=verifiedOccurrence(target);
    if(!proof||proof.binding!==edge.sourceBinding||proof.revision!==edge.revision||
      proof.endMs<bounds[0].notBeforeMs)
      throw wrong();
  }
  const now=Timestamp.now();
  const next={version:BATTLE_OCCURRENCE_VERSION,battleId:r.battleId,sourceBinding:binding,
    status:r.action==='APPROVE'?'APPROVED':'REVOKED',bounds,precedes:edges,
    proof:{kind:'ADMIN_REVIEWED',actorUid:actor.authUid,actorPlayerId:actor.playerId,
      reviewedEvidenceRefs:[...new Set(r.evidenceRefs!)],reason:r.reason!.trim()},
    updatedAt:now};
  const saved=approval(tx,mr,current,next);
  return {status:saved.status,revision:saved.revision};
 });
}
/** Read-only owner-specific revision needed to bind optional player testimony.
 * Never returns source/artifact hashes, proof refs, notes or another player’s
 * assertions. 'APPROVED' here means occurrence evidence, not global chronology. */
export async function readMyBattleOccurrence(input:{actor:Actor;request:{battleId:string}}){
 const {actor,request:r}=input;
 if(!r||!id(r.battleId)||Object.keys(r).length!==1)
  throw new HttpsError('invalid-argument','Only one canonical Battle identifier is accepted.');
 return db.runTransaction(async tx=>{
  await verifyActor(tx,actor);
  const b=await currentBattle(tx,r.battleId);
  if(!b.match.participants.some((p:Bag)=>p.playerId===actor.playerId))
   throw new HttpsError('permission-denied','This Battle belongs to another player.');
  const current=(await tx.get(db.doc('matches/'+r.battleId+'/occurrence/current'))).data();
  const binding=occurrenceSourceBinding(b)!;
  return {version:BATTLE_OCCURRENCE_VERSION,battleId:r.battleId,
   expectedSourceBinding:binding,
   games:canonicalOccurrenceGames(b)!.map(g=>({gameId:g.gameId,receiptUpperBoundAtMs:g.source!.publicationAtMs})),
   gameIds:canonicalOccurrenceGames(b)!.map(g=>g.gameId),
   status:current?.sourceBinding===binding&&
     current.status==='APPROVED'&&verifiedOccurrence({...b,occurrence:current})?
       'APPROVED' as const:'PENDING' as const,
   revision:current?.revision??null};
 });
}
export const getMyBattleOccurrence=onCall(callableOptions,async request=>{
 assertBattleOccurrenceEnabled(process.env);
 const actor=await requireLeaguePlayer(request);
 return readMyBattleOccurrence({actor,request:request.data});
});
export const confirmBattleOccurrence=onCall(callableOptions,async request=>{
 assertBattleOccurrenceEnabled(process.env);
 const actor=await requireLeaguePlayer(request);
 return attestBattleOccurrence({actor,request:request.data});
});
export const adminReviewBattleOccurrence=onCall(callableOptions,async request=>{
 assertBattleOccurrenceEnabled(process.env);
 const actor=await requireAdmin(request);
 return reviewBattleOccurrence({actor,request:request.data});
});
