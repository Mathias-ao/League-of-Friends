import {competitionId} from '../../services/competitionInput.js';
import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireAdmin,requireLeaguePlayer} from '../../auth/authorization.js';
import {db} from '../../config/firebase.js';
import {callableOptions} from '../../config/runtime.js';
import {scoringSlotId} from '../../engines/seasonPoints.js';
import {warmupWindow} from '../../services/eventTiming.js';
import {writeWarmup,advanceEventWarmups,WARMUP_LIFECYCLE_VERSION} from '../../services/warmupLifecycle.js';
import {writeAdminAudit} from '../../services/audit.js';

export const adminConfigureEventWarmups=onCall(callableOptions,async request=>{
  const actor=await requireAdmin(request),{eventId,aiDifficulty,map}=request.data;
  competitionId(eventId,'Event');
  if(typeof eventId!=='string'||typeof aiDifficulty!=='string'||!['Easiest','Standard','Moderate','Hard','Hardest','Extreme'].includes(aiDifficulty)||typeof map!=='string'||!map.trim()||map.length>80)throw new HttpsError('invalid-argument','Choose a warm-up map and announced AI difficulty.');
  await db.runTransaction(async tx=>{
    const ref=db.collection('events').doc(eventId),snap=await tx.get(ref),event=snap.data();
    if(!event||!['DRAFT','PUBLISHED'].includes(event.status)||event.warmupSchedule||event.warmupMatchIds?.length)throw new HttpsError('failed-precondition','Configure warm-ups before pairings are created.');
    const opening=Timestamp.fromMillis(event.startsAt.toMillis()-7*86400000);
    const window=warmupWindow(event.startsAt,opening,event.timezone),now=Timestamp.now();
    const deadline=request.data.guestAcceptanceDeadlineAt?Timestamp.fromDate(new Date(request.data.guestAcceptanceDeadlineAt)):Timestamp.fromMillis(event.startsAt.toMillis()-48*3600000);
    if(!Number.isFinite(deadline.toMillis())||deadline.toMillis()<=Math.max(window.opensAt.toMillis(),now.toMillis())||deadline.toMillis()>=event.startsAt.toMillis())throw new HttpsError('invalid-argument','Guest acceptance must close after opening and before kickoff.');
    const gameConfig={...event.gameConfig,maps:{pool:[map.trim()],selectionMode:'ADMIN'},victory:{conquest:true,wonder:false,relic:false,customRuleCode:null},civilizations:{mode:'UNRESTRICTED',allowed:[],banned:[],customRuleCode:null},diplomacyEnabled:false};
    const policy={modelVersion:WARMUP_LIFECYCLE_VERSION,gameConfig,aiDifficulty,guestAcceptanceDeadlineAt:deadline};
    tx.update(ref,{warmupPolicy:policy,warmupOpensAt:opening,warmupClosesAt:window.closesAt,updatedAt:now});
    writeAdminAudit(tx,{actorUid:actor.authUid,actorPlayerId:actor.playerId,action:'WARMUP_POLICY_CONFIGURED',targetType:'EVENT',targetId:eventId,after:policy});
  });
  await advanceEventWarmups(eventId);return {success:true};
});
export const challengeWarmupGuest=onCall(callableOptions,async request=>{
  const actor=await requireLeaguePlayer(request),{eventId,guestPlayerId}=request.data;
  competitionId(eventId,'Event');
  if(typeof eventId!=='string'||typeof guestPlayerId!=='string'||!guestPlayerId||guestPlayerId.includes('/'))throw new HttpsError('invalid-argument','Choose a guest.');
  return db.runTransaction(async tx=>{
    const ref=db.collection('events').doc(eventId),event=(await tx.get(ref)).data(),now=Timestamp.now();
    if(!event||!['PUBLISHED','ACTIVE'].includes(event.status)||event.warmupSchedule?.status!=='GUEST_PENDING'||event.warmupSchedule.unpairedPlayerId!==actor.playerId||now.toMillis()>=event.warmupPolicy.guestAcceptanceDeadlineAt.toMillis())throw new HttpsError('failed-precondition','Guest challenges are not open for this player.');
    const [player,member,signup,slot,challenger]=await Promise.all([tx.get(db.collection('players').doc(guestPlayerId)),tx.get(db.collection('seasons').doc(event.seasonId).collection('participants').doc(guestPlayerId)),tx.get(ref.collection('participants').doc(guestPlayerId)),tx.get(ref.collection('scoringSlots').doc(scoringSlotId('WARMUP',guestPlayerId))),tx.get(ref.collection('participants').doc(actor.playerId))]);
    if(guestPlayerId===actor.playerId||player.data()?.membershipStatus!=='ACTIVE'||member.data()?.status!=='ENTERED'||signup.data()?.rsvp==='YES'||slot.exists||challenger.data()?.rsvp!=='YES')throw new HttpsError('failed-precondition','This guest or challenger is no longer eligible.');
    const inviteRef=ref.collection('warmupChallenges').doc(actor.playerId+'_'+guestPlayerId),existing=await tx.get(inviteRef);
    if(existing.exists)return {success:true,challengeId:inviteRef.id,alreadyCreated:true};
    tx.create(inviteRef,{challengerPlayerId:actor.playerId,guestPlayerId,status:'PENDING',createdAt:now,deadlineAt:event.warmupPolicy.guestAcceptanceDeadlineAt});
    return {success:true,challengeId:inviteRef.id};
  });
});
export const respondToWarmupGuest=onCall(callableOptions,async request=>{
  const actor=await requireLeaguePlayer(request),{eventId,challengeId,accept}=request.data;
  competitionId(eventId,'Event');
  if(typeof eventId!=='string'||typeof challengeId!=='string'||challengeId.includes('/')||typeof accept!=='boolean')throw new HttpsError('invalid-argument','Provide a challenge and response.');
  return db.runTransaction(async tx=>{
    const ref=db.collection('events').doc(eventId),inviteRef=ref.collection('warmupChallenges').doc(challengeId);
    const [snap,inviteSnap]=await Promise.all([tx.get(ref),tx.get(inviteRef)]),event=snap.data(),invite=inviteSnap.data(),now=Timestamp.now();
    if(!event||!invite||invite.guestPlayerId!==actor.playerId)throw new HttpsError('permission-denied','This invitation belongs to another player.');
    if(invite.status==='ACCEPTED')return {success:true,matchId:invite.matchId,alreadyAccepted:true};
    if(!['PUBLISHED','ACTIVE'].includes(event.status)||invite.status!=='PENDING'||event.warmupSchedule?.status!=='GUEST_PENDING'||now.toMillis()>=invite.deadlineAt.toMillis())throw new HttpsError('failed-precondition','This invitation is closed.');
    const ids=[invite.challengerPlayerId,actor.playerId];
    const [slots,members,players,signups,invites,league]=await Promise.all([
      Promise.all(ids.map(id=>tx.get(ref.collection('scoringSlots').doc(scoringSlotId('WARMUP',id))))),
      Promise.all(ids.map(id=>tx.get(db.collection('seasons').doc(event.seasonId).collection('participants').doc(id)))),
      Promise.all(ids.map(id=>tx.get(db.collection('players').doc(id)))),
      Promise.all(ids.map(id=>tx.get(ref.collection('participants').doc(id)))),tx.get(ref.collection('warmupChallenges')),tx.get(db.collection('leagueState').doc('singleton'))]);
    if(!accept){tx.update(inviteRef,{status:'DECLINED',resolvedAt:now});return {success:true};}
    if(event.warmupSchedule.unpairedPlayerId!==ids[0]||slots.some(s=>s.exists)||members.some(s=>s.data()?.status!=='ENTERED')||players.some(s=>s.data()?.membershipStatus!=='ACTIVE')||signups[0].data()?.rsvp!=='YES'||signups[0].data()?.signupState!=='CONFIRMED'||signups[1].data()?.rsvp==='YES')throw new HttpsError('failed-precondition','Warm-up eligibility changed.');
    const matchId=eventId+'-GUEST-W';writeWarmup(tx,ref,event,ids,matchId,now,false,league.data()?.currentEmperorPlayerId??null);
    tx.set(ref.collection('warmupGuests').doc(actor.playerId),{playerId:actor.playerId,matchId,acceptedAt:now});
    for(const row of invites.docs)if(row.data().status==='PENDING')tx.update(row.ref,{status:row.id===challengeId?'ACCEPTED':'EXPIRED',resolvedAt:now,...(row.id===challengeId?{matchId}:{})});
    tx.update(ref,{warmupSchedule:{...event.warmupSchedule,status:'GUEST_ACCEPTED',matchId},warmupMatchIds:[...(event.warmupMatchIds??[]),matchId],updatedAt:now});
    return {success:true,matchId};
  });
});

/** Replace an unplayed pairing without awarding another scoring opportunity. */
export const adminReplaceWarmupOpponent=onCall(callableOptions,async request=>{
  const actor=await requireAdmin(request),{matchId,withdrawnPlayerId,replacementPlayerId,reason}=request.data;
  competitionId(matchId,'Battle');competitionId(withdrawnPlayerId,'withdrawn player');competitionId(replacementPlayerId,'replacement player');
  if([matchId,withdrawnPlayerId,replacementPlayerId].some(id=>typeof id!=='string'||!id||id.includes('/'))||typeof reason!=='string'||reason.trim().length<8||reason.length>1000)throw new HttpsError('invalid-argument','Choose the unplayed pairing, replacement and reason.');
  return db.runTransaction(async tx=>{
    const oldRef=db.collection('matches').doc(matchId),match=(await tx.get(oldRef)).data();
    if(match?.opponentKind==='AI'||match?.scoringSnapshot?.rules?.act!=='WARMUP'||match.participants?.length!==2||match.canonicalResult||!['READY','CANCELLED'].includes(match.status))throw new HttpsError('failed-precondition','Only an unplayed human warm-up can be replaced.');
    const survivor=match.participants.find((p:any)=>p.playerId!==withdrawnPlayerId)?.playerId;
    if(!survivor||!match.participants.some((p:any)=>p.playerId===withdrawnPlayerId)||[survivor,withdrawnPlayerId].includes(replacementPlayerId))throw new HttpsError('invalid-argument','Choose a different replacement opponent.');
    const ref=db.collection('events').doc(match.eventId);
    const [eventSnap,games,ledger,member,player,signup,survivorSlot,replacementSlot]=await Promise.all([tx.get(ref),tx.get(oldRef.collection('games')),tx.get(db.collection('leaguePointLedger').where('matchId','==',matchId)),tx.get(db.collection('seasons').doc(match.seasonId).collection('participants').doc(replacementPlayerId)),tx.get(db.collection('players').doc(replacementPlayerId)),tx.get(ref.collection('participants').doc(replacementPlayerId)),tx.get(ref.collection('scoringSlots').doc(scoringSlotId('WARMUP',survivor))),tx.get(ref.collection('scoringSlots').doc(scoringSlotId('WARMUP',replacementPlayerId)))]);
    const event=eventSnap.data();
    if(!event||!['PUBLISHED','ACTIVE'].includes(event.status)||!event.warmupPolicy||Date.now()>=warmupWindow(event.startsAt,event.warmupOpensAt,event.timezone).closesAt.toMillis()||ledger.size||games.docs.some(g=>g.data().canonicalResult||g.data().activeReplayStatisticsId)||survivorSlot.data()?.matchId!==matchId||replacementSlot.exists||member.data()?.status!=='ENTERED'||player.data()?.membershipStatus!=='ACTIVE'||signup.data()?.rsvp==='YES')throw new HttpsError('failed-precondition','Replacement eligibility or unplayed state changed.');
    const now=Timestamp.now(),newId=matchId+'-REPLACEMENT';
    writeWarmup(tx,ref,event,[survivor,replacementPlayerId],newId,now,false,match.emperorPlayerIdAtApproval??null,[survivor]);
    tx.update(oldRef,{status:'CANCELLED',replacementMatchId:newId,resolutionReason:reason.trim(),resolvedBy:actor.playerId,updatedAt:now});
    for(const game of games.docs)tx.update(game.ref,{status:'CANCELLED',updatedAt:now});
    tx.set(ref.collection('warmupGuests').doc(replacementPlayerId),{playerId:replacementPlayerId,matchId:newId,acceptedAt:now,registrationSource:'ADMIN_EXCEPTION'});
    tx.update(ref,{warmupMatchIds:[...(event.warmupMatchIds??[]),newId],updatedAt:now});
    writeAdminAudit(tx,{actorUid:actor.authUid,actorPlayerId:actor.playerId,action:'WARMUP_OPPONENT_REPLACED',targetType:'MATCH',targetId:matchId,after:{newId,withdrawnPlayerId,replacementPlayerId,reason:reason.trim()}});
    return {success:true,matchId:newId};
  });
});
export const adminResolveUnpairedWarmup=onCall(callableOptions,async request=>{
  const actor=await requireAdmin(request),{eventId,reason}=request.data;
  competitionId(eventId,'Event');
  if(typeof eventId!=='string'||eventId.includes('/')||typeof reason!=='string'||reason.trim().length<8||reason.length>1000)throw new HttpsError('invalid-argument','Explain why the unpaired warm-up is unplayed.');
  await db.runTransaction(async tx=>{
    const ref=db.collection('events').doc(eventId),event=(await tx.get(ref)).data();
    if(!event||!['ACTIVE','PUBLISHED'].includes(event.status)||!['GUEST_PENDING','ADMIN_REVIEW'].includes(event.warmupSchedule?.status))throw new HttpsError('failed-precondition','No unresolved unpaired warm-up exists.');
    const invites=await tx.get(ref.collection('warmupChallenges')),now=Timestamp.now();
    for(const invite of invites.docs)if(invite.data().status==='PENDING')tx.update(invite.ref,{status:'EXPIRED',resolvedAt:now});
    tx.update(ref,{warmupSchedule:{...event.warmupSchedule,status:'RESOLVED_UNPLAYED',resolutionReason:reason.trim(),resolvedBy:actor.playerId},updatedAt:now});
    writeAdminAudit(tx,{actorUid:actor.authUid,actorPlayerId:actor.playerId,action:'UNPAIRED_WARMUP_RESOLVED',targetType:'EVENT',targetId:eventId,after:{reason:reason.trim()}});
  });return {success:true};
});
