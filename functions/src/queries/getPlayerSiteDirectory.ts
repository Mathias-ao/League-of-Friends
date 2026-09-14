import {onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {collections,leagueStateDocumentId} from '../domain/collections.js';
import {iso,playerMap,publicPlayer} from './querySupport.js';
import type {MatchParticipant} from '../domain/types.js';

/** Return allowlisted public DTOs, never raw Player documents or private collections. */
export const getPlayerSiteDirectory=onCall(callableOptions,async request=>{
  const actor=await requireLeaguePlayer(request);
  const [stateDoc,playersDoc]=await Promise.all([
    db.collection(collections.leagueState).doc(leagueStateDocumentId).get(),
    db.collection(collections.players).get()
  ]);
  const players=playerMap(playersDoc),seasonId=stateDoc.data()?.activeSeasonId as string|undefined;
  const publicPlayers=[...players.entries()].filter(([,p])=>p.membershipStatus==='ACTIVE'||p.membershipStatus==='INACTIVE').map(([id,p])=>publicPlayer(id,p));
  if(!seasonId)return {players:publicPlayers,events:[],matches:[],enteredSeason:false};
  const [eventsDoc,matchesDoc,enrollmentDoc]=await Promise.all([
    db.collection(collections.events).where('seasonId','==',seasonId).get(),
    db.collection(collections.matches).where('seasonId','==',seasonId).get(),
    db.collection(collections.seasons).doc(seasonId).collection('participants').doc(actor.playerId).get()
  ]);
  const visibleEvents=eventsDoc.docs.filter(doc=>['PUBLISHED','ACTIVE','COMPLETED','CANCELLED','POSTPONED'].includes(doc.data().status));
  const events=await Promise.all(visibleEvents.map(async doc=>{
    const e=doc.data(),participants=await doc.ref.collection('participants').get();
    const own=participants.docs.find(p=>p.id===actor.playerId)?.data();
    return {eventId:doc.id,seasonId,title:String(e.title??doc.id),description:String(e.description??''),status:String(e.status),
      startsAt:iso(e.startsAt),endsAt:iso(e.endsAt),signupDeadlineAt:iso(e.signupDeadlineAt),checkInOpensAt:iso(e.checkInOpensAt),checkInClosesAt:iso(e.checkInClosesAt),
      maxParticipants:e.maxParticipants??null,competitionStyle:e.competitionStyle??null,
      confirmedCount:participants.docs.filter(p=>p.data().rsvp==='YES'&&p.data().signupState==='CONFIRMED').length,
      waitingListCount:participants.docs.filter(p=>p.data().rsvp==='YES'&&p.data().signupState==='WAITING_LIST').length,
      viewer:{rsvp:own?.rsvp??'UNANSWERED',signupState:own?.signupState??'NONE',attendanceStatus:own?.attendanceStatus??'NOT_CHECKED'}};
  }));
  events.sort((a,b)=>(a.startsAt??'9999').localeCompare(b.startsAt??'9999')||a.eventId.localeCompare(b.eventId));
  const visibleIds=new Set(visibleEvents.map(e=>e.id));
  const matches=matchesDoc.docs.filter(doc=>{
    const m=doc.data();return m.status!=='PROPOSED'&&(!m.eventId||visibleIds.has(m.eventId));
  }).map(doc=>{
    const m=doc.data();
    return {matchId:doc.id,seasonId,eventId:m.eventId??null,format:m.format??null,status:String(m.status??'UNKNOWN'),completedAt:iso(m.completedAt??m.firstCompletedAt),
      participants:((m.participants??[]) as MatchParticipant[]).map(p=>({...publicPlayer(p.playerId,players.get(p.playerId)),team:p.team,slot:p.slot})),
      result:m.canonicalResult&&m.status==='COMPLETED'?{revision:Number(m.canonicalResult.revision??1),winningPlayerIds:m.canonicalResult.winningPlayerIds??[]}:null};
  });
  return {players:publicPlayers,events,matches,enteredSeason:enrollmentDoc.data()?.status==='ENTERED'};
});
