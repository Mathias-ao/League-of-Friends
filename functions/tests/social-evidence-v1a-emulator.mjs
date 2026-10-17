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
  const read=()=>getSocialEvidenceV1a.run({auth:{uid:actor.authUid},data:input.request});
  const result=await read();
  assert.equal(result.state,'CURRENT_SOURCE_FACTS');
  assert.equal(result.trust.leagueAuthority,'AUTHENTICATED_CURRENT_SNAPSHOT');
  assert.equal(result.trust.qualifiedSocialProgression,false);
  assert.equal(result.history.socialCreditRequired,false);
  assert.equal(result.history.crossBattleOrder,null);
  assert.equal(result.history.factualHistoryEligible,true,'verified READY gameplay supplies historical facts');
  assert.ok(event.officialMatchIds.includes(matchId),'official Event Battle fixture');
  if(!game.canonicalResult){
    assert.equal(result.history.officialOutcome.qualification,'UNRESOLVED');
    assert.equal(result.history.officialOutcome.resultRevision,null);
    assert.equal(result.history.officialOutcome.winnerPlayerIds,null);
    assert.equal(result.history.officialOutcome.loserPlayerIds,null);
  }
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
  // A matching eventId is insufficient without reciprocal Event membership.
  await eventRef.update({officialMatchIds:[],warmupMatchIds:[]});
  const unlisted=await read();assert.equal(unlisted.state,'CURRENT_EVIDENCE_UNAVAILABLE');
  assert.ok(unlisted.reasonCodes.includes('MATCH_NOT_IN_EVENT'));assert.deepEqual(unlisted.deeds,[]);
  await eventRef.set({status:event.status,seasonId:event.seasonId});
  assert.ok((await read()).reasonCodes.includes('EVENT_BATTLE_MEMBERSHIP_UNAVAILABLE'));
  await eventRef.set({...event,officialMatchIds:'not-a-membership-list'});
  assert.ok((await read()).reasonCodes.includes('EVENT_BATTLE_MEMBERSHIP_UNAVAILABLE'));
  await eventRef.set({...event,warmupMatchIds:[matchId]});
  assert.ok((await read()).reasonCodes.includes('AMBIGUOUS_EVENT_BATTLE_MEMBERSHIP'));
  await eventRef.set({...event,seasonId:'wrong-season'});
  await assert.rejects(read,e=>e.code==='failed-precondition'&&e.message.includes('attribution mismatch'));
  await eventRef.set(event);
  await mr.update({status:'PROPOSED'});
  assert.ok((await read()).reasonCodes.includes('EVENT_BATTLE_NOT_ELIGIBLE'));await mr.set(match);
  // An ordinary planned Game is not history, even if it has valid Event metadata.
  await gr.set({...game,status:'READY',canonicalResult:null,recordingResultBinding:null,
    activeReplayStatisticsId:null,replayStatisticsState:'UNAVAILABLE'});
  const planned=await read();assert.equal(planned.history.factualHistoryEligible,false);
  assert.ok(planned.reasonCodes.includes('NO_CURRENT_READY_SOURCE'));assert.deepEqual(planned.deeds,[]);
  await gr.set(game);
  await gr.update({replayStatisticsState:'PROCESSING'});
  assert.equal((await read()).history.factualHistoryEligible,false);await gr.set(game);
  for(const state of ['VALIDATED_NOT_READY','DISPUTED','WITHDRAWN']){
    await sr.update({state});const unavailable=await read();
    assert.equal(unavailable.history.factualHistoryEligible,false);assert.deepEqual(unavailable.deeds,[]);
    await sr.set(source);
  }
  // A valid non-counted warmup must be listed in warmupMatchIds, not officialMatchIds.
  await eventRef.update({officialMatchIds:[],warmupMatchIds:[matchId]});
  await mr.update({scoringSnapshot:{...match.scoringSnapshot,rules:{...match.scoringSnapshot.rules,act:'WARMUP'}},
    context:{...match.context,affectsLeaguePoints:false}});
  const warmup=await read();assert.equal(warmup.totalDeeds,result.totalDeeds);
  assert.equal(warmup.history.factualHistoryEligible,true);
  // Real guest registration structure, with no warmup scoring slot, Season
  // enrollment or main-Event signup for the helper. Scoring flags grant no access.
  const guestId=game.players.at(-1).playerId,guestRef=eventRef.collection('warmupGuests').doc(guestId);
  const mainSlotRef=eventRef.collection('scoringSlots').doc('MAIN_'+guestId),mainSlot=await mainSlotRef.get();
  await mainSlotRef.delete();
  assert.equal((await eventRef.collection('scoringSlots').doc('WARMUP_'+guestId).get()).exists,false);
  assert.equal((await eventRef.collection('participants').doc(guestId).get()).exists,false);
  assert.equal((await db.doc('seasons/'+match.seasonId+'/participants/'+guestId).get()).exists,false);
  await guestRef.set({playerId:guestId,matchId,registrationSource:'ADMIN_EXCEPTION'});
  const helper=await read();assert.equal(helper.totalDeeds,result.totalDeeds);
  assert.equal(helper.history.factualHistoryEligible,true);
  // Replacement policy appends the new Match while retaining the cancelled old
  // entry. The replacement has its own current source; the old entry stays closed.
  const oldId=matchId+'-old',oldRef=db.doc('matches/'+oldId);
  await oldRef.set({...(await mr.get()).data(),status:'CANCELLED',replacementMatchId:matchId});
  await oldRef.collection('games').doc(gameId).set({...game,status:'CANCELLED',activeReplayStatisticsId:null});
  await eventRef.update({warmupMatchIds:[oldId,matchId]});
  assert.equal((await read()).totalDeeds,result.totalDeeds);
  const replaced=await getSocialEvidenceV1a.run({auth:{uid:actor.authUid},data:{matchId:oldId,gameId}});
  assert.ok(replaced.reasonCodes.includes('REPLACED_EVENT_BATTLE'));assert.deepEqual(replaced.deeds,[]);
  assert.equal(replaced.history.factualHistoryEligible,false);
  // Fail closed even if a replaced Match's status has not yet been cancelled.
  await mr.update({replacementMatchId:matchId+'-replacement'});
  assert.ok((await read()).reasonCodes.includes('REPLACED_EVENT_BATTLE'));
  await mr.set(match);await eventRef.set(event);await guestRef.delete();
  if(mainSlot.exists)await mainSlotRef.set(mainSlot.data());
  await oldRef.collection('games').doc(gameId).delete();await oldRef.delete();
  await gr.update({activeResultDisputeId:'test-dispute'});
  const dispute=await read();assert.equal(dispute.state,'CURRENT_EVIDENCE_UNAVAILABLE');
  assert.equal(dispute.history.factualHistoryEligible,false);
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
  const withdrawn=await read();assert.equal(withdrawn.state,'CURRENT_EVIDENCE_UNAVAILABLE');
  assert.equal(withdrawn.history.factualHistoryEligible,false);assert.ok((await sr.get()).exists);await gr.set(game);
  // Source replacement is not inferred to be the same incident by similar actors/times.
  await gr.update({activeReplayStatisticsId:'f'.repeat(64),replayStatisticsRevision:game.replayStatisticsRevision+1});
  assert.equal((await read()).state,'CURRENT_EVIDENCE_UNAVAILABLE');await gr.set(game);
  const cursor=result.nextCursor??{authorityRevision:result.authorityRevision,offset:result.deeds.length};
  await eventRef.update({officialMatchIds:[],warmupMatchIds:[]});
  await assert.rejects(getSocialEvidenceV1a.run({auth:{uid:actor.authUid},data:{...input.request,cursor}}),e=>e.code==='aborted');
  await eventRef.set(event);
  // Change authority after verified artifact read / while Python derives. Final
  // transactional recheck must reject source, mapping, Event and access races.
  const changes=[
    async()=>gr.update({replayStatisticsRevision:game.replayStatisticsRevision+1}),
    async()=>sr.update({playerMapping:[...source.playerMapping].reverse()}),
    async()=>eventRef.update({officialMatchIds:[],warmupMatchIds:[]}),
    async()=>eventRef.update({status:'CANCELLED'}),
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
