/** Bounded source-only occurrence authority. No source, result or score writes.
 * Participant confirmation is optional; independent opposing confirmation can
 * approve the SAME bounded Game windows without routine admin maintenance.
 * No endpoint is activated until Sol reserves the selective index export.
 */
import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {requireLeaguePlayer,requireAdmin} from '../../auth/authorization.js';
import {bindingDigest} from '../../engines/nativeRecordingIntegration.js';
import {BATTLE_OCCURRENCE_VERSION,canonicalOccurrenceGames,occurrenceSourceBinding,
 verifiedOccurrence,type OccurrenceBattle,type GameBounds,type ReviewedPrecedence} from '../../integration/battleOccurrence.js';

type Bag=Record<string,any>;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const wrong=()=>new HttpsError('failed-precondition','Battle, source, result or chronology authority changed.');
type Actor={playerId:string;authUid:string;role:string};
type Request={battleId:string;expectedSourceBinding?:string;bounds:GameBounds[];reason?:string;precedes?:ReviewedPrecedence[]};
const millis=(value:any)=>{try{const n=value?.toMillis?.();return Number.isSafeInteger(n)&&n>0?n:null;}catch{return null;}};
const same=(a:any,b:any)=>bindingDigest(a)===bindingDigest(b);

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
     !id(guid)||!Array.isArray(mapping)||!Array.isArray(roster)||
     mapping.length!==roster.length||
     new Set(mapping.map((p:Bag)=>p.playerId)).size!==mapping.length||
     new Set(mapping.map((p:Bag)=>p.replaySlot)).size!==mapping.length||
     !same([...mapping.map((p:Bag)=>p.playerId)].sort(),[...roster].sort()))
       throw wrong();
   const claim=(await tx.get(db.doc('recordingGameClaims/'+Buffer.from(guid).toString('hex')))).data();
   if(claim?.matchId!==battleId||claim?.gameId!==row.id||claim?.sourceHash!==doc.sourceHash)throw wrong();
   source={sourceHash:doc.sourceHash,gameGuid:guid,mappingDigest:bindingDigest(doc.playerMapping),
     publicationAtMs:millis(doc.publication?.publishedAt)};
  }
  games.push({gameId:row.id,game,source});
 }
 const out:OccurrenceBattle={battleId,match:m,event:event??null,plan,planId,games};
 if(!canonicalOccurrenceGames(out)||!occurrenceSourceBinding(out))throw wrong();
 return out;
}
function validatedBounds(b:OccurrenceBattle,raw:unknown):GameBounds[]{
 const games=canonicalOccurrenceGames(b)!;
 if(!Array.isArray(raw)||raw.length!==games.length)throw new HttpsError('invalid-argument','Supply one bounded window for each required Game.');
 const found=raw.map((x:any)=>({gameId:x?.gameId,notBeforeMs:x?.notBeforeMs,notAfterMs:x?.notAfterMs}));
 for(let i=0;i<games.length;i++){
  const x=found[i],source=games[i].source!;
  if(x.gameId!==games[i].gameId||!Number.isSafeInteger(x.notBeforeMs)||
    !Number.isSafeInteger(x.notAfterMs)||x.notBeforeMs<1||x.notAfterMs<=x.notBeforeMs||
    x.notAfterMs-x.notBeforeMs>14*86400000||
    source.publicationAtMs!==null&&x.notAfterMs>source.publicationAtMs||
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
 if(!id(r?.battleId)||r.expectedSourceBinding!==undefined||r.precedes!==undefined||r.reason!==undefined)
  throw new HttpsError('invalid-argument','Only a canonical Battle and bounded Game windows may be submitted.');
 return db.runTransaction(async tx=>{
  await verifyActor(tx,actor);
  const b=await currentBattle(tx,r.battleId),mr=db.doc('matches/'+r.battleId);
  if(!b.match.participants.some((p:Bag)=>p.playerId===actor.playerId))throw new HttpsError('permission-denied','Only a Battle participant may attest its occurrence.');
  // Source identity is selected and bound INSIDE the transaction, not by
  // a client's replay hash or a raw source pointer sent to the browser.
  const binding=occurrenceSourceBinding(b)!;
  const bounds=validatedBounds(b,r.bounds);
  const attestationsRef=mr.collection('occurrenceAttestations');
  const attestations=await tx.get(attestationsRef);
  const current=(await tx.get(mr.collection('occurrence').doc('current'))).data();
  checkedRevision(current);
  // A source-reviewed independent admin judgment is amended by admin review,
  // never invalidated through a participant's unilateral replacement window.
  if(current?.status==='APPROVED'&&current.proof?.kind==='ADMIN_REVIEWED')
    throw new HttpsError('failed-precondition','Reviewed occurrence needs independent correction review.');
  const my=attestations.docs.find((d:any)=>d.id===actor.playerId)?.data();
  if(my?.sourceBinding===binding&&same(my.bounds,bounds))return {status:current?.status??'PENDING',idempotent:true};
  const byId=new Map(attestations.docs.map((d:any)=>[d.id,d.data()]));
  byId.set(actor.playerId,{version:BATTLE_OCCURRENCE_VERSION,sourceBinding:binding,bounds,
    actorUid:actor.authUid,actorPlayerId:actor.playerId});
  const teams=new Map(b.match.participants.map((p:Bag)=>[p.playerId,
    b.games[0].game.players.find((x:Bag)=>x.playerId===p.playerId)?.team]));
  const partner=[...byId].find(([playerId,other])=>playerId!==actor.playerId&&
    b.match.participants.some((p:Bag)=>p.playerId===playerId)&&
    teams.get(playerId)!==teams.get(actor.playerId)&&teams.get(playerId)!=null&&teams.get(actor.playerId)!=null&&
    other.sourceBinding===binding&&same(other.bounds,bounds));
  const approved=Boolean(partner);
  const now=Timestamp.now();
  const next={version:BATTLE_OCCURRENCE_VERSION,battleId:r.battleId,sourceBinding:binding,
    status:approved?'APPROVED':'PENDING',bounds,precedes:[],
    proof:approved?{kind:'MUTUAL_PARTICIPANTS',participants:[actor.playerId,partner![0]].sort(),
      sourceRevision:binding}:null,updatedAt:now};
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
  const bounds=r.action==='APPROVE'?validatedBounds(b,r.bounds):[];
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
export const confirmBattleOccurrence=onCall(callableOptions,async request=>{
 const actor=await requireLeaguePlayer(request);
 return attestBattleOccurrence({actor,request:request.data});
});
export const adminReviewBattleOccurrence=onCall(callableOptions,async request=>{
 const actor=await requireAdmin(request);
 return reviewBattleOccurrence({actor,request:request.data});
});
