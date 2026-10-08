import {onSchedule} from 'firebase-functions/v2/scheduler';
import {db} from '../config/firebase.js';
import {advanceEventWarmups} from '../services/warmupLifecycle.js';
/** Small private league: scan published/active Events, retry each failed Event next tick. */
export const scheduleEventWarmups=onSchedule({schedule:'every 5 minutes',timeZone:'Europe/Copenhagen',region:'europe-west1',retryCount:3},async()=>{
  const snapshots=await Promise.all(['PUBLISHED','ACTIVE'].map(status=>db.collection('events').where('status','==',status).get()));
  const failures=[];
  for(const snap of snapshots)for(const event of snap.docs)try{await advanceEventWarmups(event.id);}catch(error){failures.push(event.id);console.error('Warm-up scheduling failed',event.id,error);}
  if(failures.length)throw new Error('Warm-up scheduling needs retry: '+failures.join(', '));
});
