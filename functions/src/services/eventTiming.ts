import {Timestamp} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';

const day=86400000;
/** Existing Events without an explicit warm-up date use the seven-day default. */
export function warmupWindow(startsAt:Timestamp|null|undefined,warmupOpensAt?:Timestamp|null){
 if(!(startsAt instanceof Timestamp))throw new HttpsError('failed-precondition','Set the main Event date before scheduling warm-ups.');
 const closesAt=startsAt,opensAt=warmupOpensAt??Timestamp.fromMillis(startsAt.toMillis()-7*day);
 const lead=startsAt.toMillis()-opensAt.toMillis();
 if(lead<5*day||lead>7*day)throw new HttpsError('failed-precondition','Warm-ups must open five to seven days before the main Event.');
 return {opensAt,closesAt};
}
/** The closing date is a play target, not a deadline for late recordings/results. */
export function assertMatchPlayOpened(match:{playOpensAt?:Timestamp|null}|undefined,now=Date.now()){
 if(match?.playOpensAt instanceof Timestamp&&now<match.playOpensAt.toMillis()){
  throw new HttpsError('failed-precondition',`This Battle opens on ${match.playOpensAt.toDate().toISOString()}.`);
 }
}

interface ScheduledMatch {
 playOpensAt?:Timestamp|null;playClosesAt?:Timestamp|null;
 scoringSnapshot?:{rules?:Record<string,unknown>};
}
/** Derive dates for already-created warm-ups without changing their result or status. */
export function matchPlayWindow(match:ScheduledMatch,event?:{startsAt?:Timestamp|null;warmupOpensAt?:Timestamp|null}){
 if(match.playOpensAt instanceof Timestamp)return {opensAt:match.playOpensAt,closesAt:match.playClosesAt??null};
 if(match.scoringSnapshot?.rules?.act==='WARMUP')return warmupWindow(event?.startsAt,event?.warmupOpensAt);
 return {opensAt:null,closesAt:null};
}

/** Recover the old creation default (opening at kickoff with no closing date). */
export function checkInWindow(event:{startsAt?:Timestamp|null;checkInOpensAt?:Timestamp|null;checkInClosesAt?:Timestamp|null}){
 const start=event.startsAt instanceof Timestamp?event.startsAt:null;
 let opensAt=event.checkInOpensAt instanceof Timestamp?event.checkInOpensAt:null;
 if(start&&opensAt?.toMillis()===start.toMillis()&&!event.checkInClosesAt){opensAt=Timestamp.fromMillis(start.toMillis()-30*60000);}
 return {opensAt,closesAt:event.checkInClosesAt??start};
}
