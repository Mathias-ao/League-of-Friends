import {createHash} from 'node:crypto';
import {Timestamp,type Transaction,type DocumentReference} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {db} from '../config/firebase.js';
import {seasonScoringSnapshot,scoringSlotId} from '../engines/seasonPoints.js';
import {warmupWindow} from './eventTiming.js';

export const WARMUP_LIFECYCLE_VERSION='AOF_WARMUP_LIFECYCLE_V1';
const hash=(seed:string,id:string)=>createHash('sha256').update(seed+':'+id).digest('hex');
export function drawWarmups(ids:string[],seed:string) {
  if(new Set(ids).size!==ids.length)throw new Error('Duplicate warm-up player.');
  const ordered=[...ids].sort((a,b)=>hash(seed,a).localeCompare(hash(seed,b))||a.localeCompare(b));
  const unpairedPlayerId=ordered.length%2?ordered.pop()!:null;
  const pairs:Array<[string,string]>=[];
  for(let i=0;i<ordered.length;i+=2)pairs.push([ordered[i],ordered[i+1]]);
  return {pairs,unpairedPlayerId};
}
/** All reads and scoring-slot checks are the caller's transaction responsibility. */
export function writeWarmup(tx:Transaction,eventRef:DocumentReference,event:any,ids:string[],matchId:string,now:Timestamp,ai=false,emperorPlayerId:string|null=null,transferIds:string[]=[],extraIds:string[]=[]) {
  const window=warmupWindow(event.startsAt,event.warmupOpensAt,event.timezone);
  const gameConfig={...event.warmupPolicy.gameConfig,diplomacyEnabled:false};
  const participants=ids.map((playerId,i)=>({playerId,slot:i+1,team:i+1}));
  const aiOpponent=ai?{kind:'AI',opponentId:'AI_OPPONENT',label:'AI',difficulty:event.warmupPolicy.aiDifficulty,qualification:'CONFIGURATION_PENDING'}:null;
  const matchRef=db.collection('matches').doc(matchId);
  tx.create(matchRef,{seasonId:event.seasonId,eventId:eventRef.id,matchNumber:0,format:'ONE_V_ONE',status:'READY',participants,
    warmupScoringPolicy:!ai&&event.warmupPolicy?.scoringPolicy==='AOF_BEST_WARMUP_V1'?'AOF_BEST_WARMUP_V1':null,
    opponentKind:ai?'AI':'HUMAN',aiOpponent,emperorPlayerIdAtApproval:emperorPlayerId,
    context:{type:'SEASON_EVENT',affectsLeaguePoints:true,affectsWarRoomPoints:false,affectsGold:!ai,
      affectsSeasonStats:!ai,affectsLifetimeStats:!ai,affectsPowerRating:!ai,affectsRelationships:!ai,affectsHumanRecords:!ai},
    seriesRule:{maxGames:1,gamesRequiredToWin:1},gameConfigSnapshot:gameConfig,
    scoringSnapshot:seasonScoringSnapshot({act:'WARMUP',diplomacyEnabled:false,placementPolicy:'NONE',emperorPlayerId:null}),
    aiScoringPolicy:ai?'AOF_AI_WARMUP_PARTICIPATION_V1':null,goldRewardSnapshot:ai?{matchCompletion:0,matchWin:0}:event.goldRewardSnapshot,
    canonicalResult:null,playOpensAt:window.opensAt,playClosesAt:window.closesAt,timingPolicy:WARMUP_LIFECYCLE_VERSION,
    createdAt:now,updatedAt:now,completedAt:null});
  tx.create(matchRef.collection('games').doc('G1'),{gameNumber:1,status:'READY',players:participants.map(p=>({...p,color:null,civilization:null,position:null})),
    aiOpponent,gameConfigSnapshot:gameConfig,replayParticipantBindings:(event.replayParticipantBindings??[]).filter((p:any)=>ids.includes(p.playerId)),
    replay:null,canonicalResult:null,createdAt:now,updatedAt:now});
  for(const playerId of ids){const slot=eventRef.collection('scoringSlots').doc(scoringSlotId('WARMUP',playerId));
    if(transferIds.includes(playerId))tx.update(slot,{matchId,updatedAt:now});
    else if(!extraIds.includes(playerId))tx.create(slot,{playerId,act:'WARMUP',matchId,seasonId:event.seasonId,createdAt:now});
  }
}
/** Retry-safe scheduler; legacy Events opt in through configuration, never migration by guess. */
export async function advanceEventWarmups(eventId:string,nowMs=Date.now()) {
  return db.runTransaction(async tx=>{
    const ref=db.collection('events').doc(eventId),snap=await tx.get(ref),event=snap.data();
    if(!event||!['PUBLISHED','ACTIVE'].includes(event.status)||event.warmupPolicy?.modelVersion!==WARMUP_LIFECYCLE_VERSION)return {changed:false};
    const window=warmupWindow(event.startsAt,event.warmupOpensAt,event.timezone);
    if(nowMs<window.opensAt.toMillis()||nowMs>=window.closesAt.toMillis())return {changed:false};
    const now=Timestamp.fromMillis(nowMs),schedule=event.warmupSchedule;
    if(!schedule) {
      const [signups,members,players,slots,league]=await Promise.all([
        tx.get(ref.collection('participants')),tx.get(db.collection('seasons').doc(event.seasonId).collection('participants')),
        tx.get(db.collection('players')),tx.get(ref.collection('scoringSlots')),tx.get(db.collection('leagueState').doc('singleton'))]);
      const reserved=new Set(slots.docs.filter(d=>d.data().act==='WARMUP').map(d=>d.data().playerId));
      const ids=signups.docs.filter(d=>d.data().rsvp==='YES'&&d.data().signupState==='CONFIRMED'&&
        members.docs.some(m=>m.id===d.id&&m.data().status==='ENTERED')&&players.docs.some(p=>p.id===d.id&&p.data().membershipStatus==='ACTIVE')&&!reserved.has(d.id)).map(d=>d.id);
      const seed=eventId+':'+window.opensAt.toMillis(),draw=drawWarmups(ids,seed);
      const matchIds=draw.pairs.map((pair,i)=>{const id=eventId+'-AUTO-W'+(i+1);writeWarmup(tx,ref,event,pair,id,now,false,league.data()?.currentEmperorPlayerId??null);return id;});
      tx.update(ref,{warmupSchedule:{modelVersion:WARMUP_LIFECYCLE_VERSION,seed,rosterIds:ids,...draw,status:draw.unpairedPlayerId?'GUEST_PENDING':'PAIRED',generatedAt:now},
        warmupMatchIds:[...(event.warmupMatchIds??[]),...matchIds],updatedAt:now});
      return {changed:true};
    }
    if(schedule.status==='GUEST_PENDING'&&nowMs>=event.warmupPolicy.guestAcceptanceDeadlineAt.toMillis()) {
      const playerId=schedule.unpairedPlayerId;
      const [slot,invites,signup,player,member]=await Promise.all([tx.get(ref.collection('scoringSlots').doc(scoringSlotId('WARMUP',playerId))),
        tx.get(ref.collection('warmupChallenges')),tx.get(ref.collection('participants').doc(playerId)),tx.get(db.collection('players').doc(playerId)),
        tx.get(db.collection('seasons').doc(event.seasonId).collection('participants').doc(playerId))]);
      if(slot.exists)throw new HttpsError('failed-precondition','Unpaired warm-up slot changed; review the schedule.');
      if(signup.data()?.rsvp!=='YES'||signup.data()?.signupState!=='CONFIRMED'||player.data()?.membershipStatus!=='ACTIVE'||member.data()?.status!=='ENTERED') {
        for(const invite of invites.docs)if(invite.data().status==='PENDING')tx.update(invite.ref,{status:'EXPIRED',resolvedAt:now});
        tx.update(ref,{warmupSchedule:{...schedule,status:'ADMIN_REVIEW',reason:'Unpaired player withdrew or became ineligible'},updatedAt:now});return {changed:true};
      }
      // No AI fallback. An unpaired player may invite any active league player
      // until the Event day's warm-up window closes.
      tx.update(ref,{warmupSchedule:{...schedule,status:'ADMIN_REVIEW',reason:'A human opponent is still needed'},updatedAt:now});
      for(const invite of invites.docs)if(invite.data().status==='PENDING')tx.update(invite.ref,{status:'EXPIRED',resolvedAt:now});
      return {changed:true};
    }
    return {changed:false};
  });
}
