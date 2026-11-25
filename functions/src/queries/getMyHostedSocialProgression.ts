import {getStorage} from 'firebase-admin/storage';
import {isolatedStagingProject} from '../config/stagingProject.js';
import {HttpsError,onCall} from 'firebase-functions/v2/https';
import {requireLeaguePlayer} from '../auth/authorization.js';
import {db} from '../config/firebase.js';
import {callableOptions} from '../config/runtime.js';
import {digest} from '../engines/nativeRecordingIntegration.js';
import type {HistoricalChapter} from '../engines/socialV1History/history.js';
import {bindSourceGrades} from '../integration/privateProgression.js';
import {hostedBinderCalibration} from '../integration/hostedSocialPolicy.js';
import {loadEuTestSocialPolicy} from '../integration/euTestSocialPolicy.js';
import {projectHostedSocialProgression,fixedHostedOpportunity,type HostedPendingSource} from '../integration/hostedSocialProgression.js';
import {collectMyCurrentBattleHistory} from './getMyPersonalityHistory.js';
import {battleOccurrenceEvidenceEnabled} from '../integration/battleOccurrence.js';
import {callVerifiedWorker} from '../services/nativeRecordingValidation.js';

type Input=Parameters<typeof collectMyCurrentBattleHistory>[0]&{
  /** Isolated server-test boundary, never callable input. */
  derive?:(payload:Record<string,any>,signal:AbortSignal)=>Promise<Record<string,any>>;
};
export async function readMyHostedSocialProgression(input:Input){
  if(!input.request||typeof input.request!=='object'||Array.isArray(input.request)||Object.keys(input.request).length)
    throw new HttpsError('invalid-argument','Private social reads accept no owner, policy, source or cursor arguments.');
  if(!isolatedStagingProject(input.env,false))
    throw new HttpsError('failed-precondition','Hosted private social requires the exact EU project and region.');
  // Complete read + worker + final source/policy fence share one 100s budget.
  const controller=new AbortController(),expired=()=>new HttpsError('deadline-exceeded','Private social read timed out. Retry.');
  let timer:ReturnType<typeof setTimeout>|undefined;
  const budget=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(expired());},100_000);});
  const check=()=>{if(controller.signal.aborted)throw expired();};
  const work=async()=>{
    const policy=await loadEuTestSocialPolicy(input.db,input.env);check();
    const current=await collectMyCurrentBattleHistory({...input,maxOwnGames:8,includeScheduleOrder:true});check();
    const binder=hostedBinderCalibration(policy.calibration),bound:ReturnType<typeof bindSourceGrades>[]=[],chapters:HistoricalChapter[]=[];
    const pendingSources:HostedPendingSource[]=[];
    const validId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v);
    for(const pending of current.pending){
      // These documents already belong to the collector's fenced dependency
      // set. A concurrent edit of this scope also invalidates its final fence.
      const match=(await input.db.doc('matches/'+pending.battleId).get()).data();check();
      const game=pending.gameId?(await input.db.doc('matches/'+pending.battleId+'/games/'+pending.gameId).get()).data():null;check();
      const roster=game?.players;
      pendingSources.push({seasonId:validId(match?.seasonId)?match.seasonId:null,
        rosterPlayerIds:Array.isArray(roster)&&roster.length>=2&&roster.length<=8&&
          roster.every(p=>validId(p?.playerId))&&new Set(roster.map(p=>p.playerId)).size===roster.length?
          roster.map(p=>p.playerId):null});
    }
    const context=new Map<string,{loaded:typeof current.loaded[number];witnesses:Record<string,any>[]} >();
    const artifact=async(meta:any)=>{
      check();
      if(!meta||!Number.isSafeInteger(meta.bytes)||meta.bytes<1||meta.bytes>16*1024*1024||
        !Number.isSafeInteger(meta.uncompressedBytes)||meta.uncompressedBytes<1||meta.uncompressedBytes>128*1024*1024)
        throw new HttpsError('resource-exhausted','Private social artifact exceeds its read budget.');
      let bytes:Buffer;
      try{[bytes]=await input.bucket.file(meta.path,{generation:String(meta.generation)}).download();
        if(bytes.length!==meta.bytes||digest(bytes)!==meta.sha256)throw new Error();
      }catch{throw new HttpsError('data-loss','Private social source integrity verification failed.');}
      check();return {metadata:meta,base64:bytes.toString('base64')};
    };
    for(const loaded of current.loaded){
      const source=loaded.source,schedule=current.scheduleOrders.find(s=>s.battleId===source.battleId&&s.gameId===source.gameId);
      chapters.push({battleId:source.battleId,matchId:source.matchId,gameId:source.gameId,gameGuid:source.gameGuid,
        eventId:source.eventId,seasonId:source.seasonId,sourceAuthority:source.authorityRevision,
        revision:source.statisticsRevision,state:'READY',order:schedule?.order??null});
      const payload={snapshot:source,events:await artifact(loaded.recordedEvents),statisticsArtifact:await artifact(loaded.statisticsArtifact),
        historicalOrder:{leagueOrderKey:null,gameNumber:loaded.game.gameNumber,order:'UNKNOWN'}};
      if(Buffer.byteLength(JSON.stringify(payload))>40*1024*1024)
        throw new HttpsError('resource-exhausted','Private social transport budget exceeded.');
      let raw;
      const sourceQualified=policy.sourceQualified(source,loaded.producerRevision,loaded.sourceAttestationRevision);
      try{
        if(!sourceQualified)throw new Error('EU_SOURCE_PRODUCER_ATTESTATION_PENDING');
        raw=await (input.derive??((p,signal)=>callVerifiedWorker(input.env.REPLAY_WORKER_URL!,
          '/social-hosted-grade-v1',p,{signal})))(payload,controller.signal);
      }catch{
        check();pendingSources.push({seasonId:source.seasonId,rosterPlayerIds:source.roster.map(p=>p.playerId),
          reason:sourceQualified?'WORKER_TRANSPORT_UNAVAILABLE':'SOURCE_PRODUCER_ATTESTATION_UNAVAILABLE'});
        // A verified READY source remains a factual pair even if derivation is
        // temporarily unavailable. Empty cards are never numerical evidence.
        bound.push({source,sourceMethodRevision:digest(Buffer.from('UNAVAILABLE:'+source.authorityRevision)),
          cards:[],effects:[],inferences:[],actorWitnesses:[]});continue;
      }
      check();
      try{bound.push(bindSourceGrades(raw,source,loaded.statistics,input.env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??'',
        schedule,loaded.game.gameNumber,binder));context.set(source.authorityRevision,{loaded,witnesses:raw.gradeWitnesses});}
      catch{throw new HttpsError('data-loss','Private social source method or actor binding did not match.');}
    }
    const response=projectHostedSocialProgression({owner:input.actor.playerId,inputs:bound,chapters,
      occurrenceBattles:battleOccurrenceEvidenceEnabled(input.env)?current.occurrenceBattles:undefined,
      actualOccurrenceEnabled:battleOccurrenceEvidenceEnabled(input.env),
      calibration:policy.calibration,pendingSources,
      coverage:{...current.coverage,pendingSources:pendingSources.length},inputRevision:current.inputDigest,policyRevision:policy.revision,
      opportunity:(b,s,claim)=>{const {loaded,witnesses}=context.get(b.source.authorityRevision)!;
        return fixedHostedOpportunity(b,loaded.statistics,s,loaded.match.format,claim,witnesses);}});
    check();
    // One read-only transaction is the linearization point for approval and
    // the entire source, membership and schedule dependency witness.
    await current.revalidate(tx=>policy.revalidate(tx));
    check();return {...response,policyVersion:policy.resource.spec.id};
  };
  try{return await Promise.race([work(),budget]);}
  finally{clearTimeout(timer);controller.abort();}
}
export const getMyHostedSocialProgression=onCall({...callableOptions,timeoutSeconds:120,memory:'1GiB',secrets:['REPLAY_WORKER_AUTH_TOKEN']},async request=>{
  const actor=await requireLeaguePlayer(request),project=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT;
  return readMyHostedSocialProgression({db,bucket:getStorage().bucket(process.env.REPLAY_BUCKET||project+'.appspot.com'),
    actor,request:request.data,env:process.env});
});
