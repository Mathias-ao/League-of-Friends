/** Called by authentic ordinary-upload acceptance, using real published sources.
 * Writes below are isolated emulator fault injection, not adapter behavior. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {encodeReplayStatistics} from '../lib/services/replayStatisticsStorage.js';
import {readSocialEvidenceV1a,getSocialEvidenceV1a} from '../lib/queries/getSocialEvidenceV1a.js';
import {callVerifiedWorker} from '../lib/services/nativeRecordingValidation.js';

export async function socialEvidenceAcceptance({db,bucket,actor,matchId,gameId,name}){
  assert.equal(process.env.GCLOUD_PROJECT,'demo-aof-native-player');
  const mr=db.doc('matches/'+matchId),gr=mr.collection('games').doc(gameId);
  const match=(await mr.get()).data(),game=(await gr.get()).data();
  const sr=gr.collection('replaySources').doc(game.activeReplayStatisticsId),source=(await sr.get()).data();
  const eventRef=db.doc('events/'+match.eventId),event=(await eventRef.get()).data();
  const input={db,bucket,actor,env:process.env,request:{matchId,gameId}};
  await assert.rejects(readSocialEvidenceV1a({...input,env:{...process.env,AOF_SOCIAL_EVIDENCE_V1A_READS:'0'}}));
  const read=()=>readSocialEvidenceV1a(input);
  const result=await read();
  assert.equal(result.state,'CURRENT_SOURCE_FACTS');
  assert.equal(result.trust.leagueAuthority,'AUTHENTICATED_CURRENT_SNAPSHOT');
  assert.equal(result.trust.qualifiedSocialProgression,false);
  assert.equal(result.history.socialCreditRequired,false);
  assert.equal(result.history.crossBattleOrder,null);
  assert.ok(result.totalDeeds>0);
  assert.deepEqual(await read(),result,'exact retry is deterministic');
  assert.deepEqual(await getSocialEvidenceV1a.run({auth:{uid:actor.authUid},data:input.request}),result);
  await assert.rejects(getSocialEvidenceV1a.run({data:input.request}));
  await assert.rejects(getSocialEvidenceV1a.run({auth:{uid:'unknown'},data:input.request}));
  await assert.rejects(readSocialEvidenceV1a({...input,request:{...input.request,leagueContext:{eventBattleEligibility:'ELIGIBLE'}}}));
  for(const deed of result.deeds){
    assert.ok(deed.sourceEventIds.length);
    assert.ok(deed.pairLeaguePlayerIds.every(id=>game.players.some(p=>p.playerId===id)));
    assert.equal(deed.deedQualification.status,'PENDING');
    for(const claim of deed.claims){
      assert.equal(claim.qualification.status,'PENDING');
      if(claim.system==='REPUTATION')assert.ok(!('fromLeaguePlayerId' in claim)&&!('stage' in claim));
    }
  }
  // Eligible helpers/non-counted warmups retain the same factual source; no
  // scoring slot or season enrollment is required for a registered league guest.
  await mr.update({scoringSnapshot:{...match.scoringSnapshot,rules:{...match.scoringSnapshot.rules,act:'WARMUP'}},
    context:{...match.context,affectsLeaguePoints:false},warmupHelper:true});
  const helper=await read();assert.equal(helper.totalDeeds,result.totalDeeds);
  assert.equal(helper.history.factualHistoryEligible,true);await mr.set(match);
  await gr.update({activeResultDisputeId:'test-dispute'});
  const dispute=await read();assert.equal(dispute.state,'CURRENT_EVIDENCE_UNAVAILABLE');
  assert.equal(dispute.history.officialOutcome.qualification,'UNRESOLVED');assert.deepEqual(dispute.deeds,[]);
  await gr.set(game);
  await mr.update({opponentKind:'AI'});assert.ok((await read()).reasonCodes.includes('AI_EXCLUDED'));await mr.set(match);
  await sr.update({playerMapping:source.playerMapping.map((p,i)=>i?{...p,playerId:source.playerMapping[0].playerId}:p)});
  await assert.rejects(read);await sr.set(source);
  // No unknown guest is silently converted to a league identity.
  await sr.update({playerMapping:source.playerMapping.map((p,i)=>i? p:{...p,playerId:'unbound-guest'})});
  await assert.rejects(read);await sr.set(source);
  // Source withdrawal/rollback leaves retained source objects traceable, never current.
  await gr.update({activeReplayStatisticsId:null,replayStatisticsState:'UNAVAILABLE',replayStatisticsRevision:game.replayStatisticsRevision+1});
  assert.equal((await read()).state,'CURRENT_EVIDENCE_UNAVAILABLE');assert.ok((await sr.get()).exists);await gr.set(game);
  // Source replacement is not inferred to be the same incident by similar actors/times.
  await gr.update({activeReplayStatisticsId:'f'.repeat(64),replayStatisticsRevision:game.replayStatisticsRevision+1});
  assert.equal((await read()).state,'CURRENT_EVIDENCE_UNAVAILABLE');await gr.set(game);
  const cursor={authorityRevision:result.authorityRevision,offset:0};
  await eventRef.update({socialTestRevision:1});
  await assert.rejects(readSocialEvidenceV1a({...input,request:{...input.request,cursor}}),e=>e.code==='aborted');
  await eventRef.set(event);
  // Change authority after verified artifact read / while Python derives. Final
  // transactional recheck must reject source, mapping, Event and access races.
  const changes=[
    async()=>gr.update({replayStatisticsRevision:game.replayStatisticsRevision+1}),
    async()=>sr.update({playerMapping:[...source.playerMapping].reverse()}),
    async()=>eventRef.update({socialTestRevision:2}),
    async()=>db.doc('authLinks/'+actor.authUid).update({playerId:'revoked'}),
  ];
  for(const change of changes){
    await assert.rejects(readSocialEvidenceV1a({...input,derive:async payload=>{
      const dto=await callVerifiedWorker(process.env.REPLAY_WORKER_URL,'/social-evidence-v1a',payload);
      await change();return dto;
    }}),e=>['aborted','permission-denied'].includes(e.code));
    await gr.set(game);await sr.set(source);await eventRef.set(event);await db.doc('authLinks/'+actor.authUid).set({playerId:actor.playerId});
  }
  assert.deepEqual(await read(),result);
  if(name==='1v1_t90-deak'){
    await sr.update({'statistics.sha256':'0'.repeat(64)});
    await assert.rejects(read,e=>e.code==='data-loss'||e.code==='failed-precondition');await sr.set(source);
    // Alternate isolated publication fixture, not a production migration: the
    // same authentic binary is exported/projected by the existing canonical path.
    const canonical=JSON.parse(gunzipSync(await readFile('.replay-lab/social-canonical.json.gz')));
    const artifact=encodeReplayStatistics(canonical),path='social-acceptance/canonical.json.gz';
    await bucket.file(path).save(artifact.bytes,{resumable:false,preconditionOpts:{ifGenerationMatch:0}});
    const legacy={state:'READY',matchId,gameId,sourceHash:source.sourceHash,
      replayStatisticsRevision:source.replayStatisticsRevision,playerMapping:source.playerMapping,
      matchFacts:canonical.matchFacts,canonical:{extractionRunId:canonical.source.extractionRunId},
      statistics:{path,...artifact.metadata}};
    await sr.set(legacy);
    const canonicalRead=await read();
    const semantics=d=>({pair:d.pairLeaguePlayerIds,startedAt:d.startedAt,endedAt:d.endedAt,
      independence:d.independence,relationContext:d.relationContext,families:d.families,
      observations:d.observations.map(({sourceEventIds,...rest})=>rest),
      claims:d.claims.map(({claimId,...rest})=>rest).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))});
    assert.equal(canonicalRead.totalDeeds,result.totalDeeds);
    assert.deepEqual(canonicalRead.deeds.map(semantics),result.deeds.map(semantics));
    assert.deepEqual(canonicalRead.history,result.history);
    assert.notEqual(canonicalRead.sourceRevision,result.sourceRevision);
    assert.notEqual(canonicalRead.deeds[0].episodeId,result.deeds[0].episodeId,'no cross-source lineage is inferred');
    await sr.set(source);
  }
  console.log(JSON.stringify({socialEvidenceFixture:name,sourceFacts:true,authenticatedCurrentRead:true,pendingQualification:true,correctionFence:true}));
}
