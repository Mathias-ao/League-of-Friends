import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {ready} from './support/private-history-fixture.mjs';
import {digest,bindingDigest} from '../lib/engines/nativeRecordingIntegration.js';
import {statisticsBindingKey} from '../lib/engines/statisticsExperience.js';
import {collectMyCurrentBattleHistory,readMyPersonalityHistory} from '../lib/queries/getMyPersonalityHistory.js';
import {readMyHonoursPreview} from '../lib/queries/getMyHonoursPreview.js';
import {readMyChronicleInvitations,offerMyChronicleInvitation,actOnMyChronicleInvitation}
 from '../lib/queries/chronicleInteractionService.js';

async function series(){
  const f=await ready(),match=f.rows.get('matches/m'),g1=f.rows.get('matches/m/games/g');
  const s1=f.rows.get(f.sourcePath),hash=digest('CONTROLLED_SECOND_SOURCE_NOT_ORIGINAL_RECORDING');
  const raw=JSON.parse(gunzipSync(f.objects.get(s1.statistics.path)).toString('utf8'));
  raw.source.replaySha256=hash;raw.matchFacts.source.replaySha256=hash;
  raw.pairSocialEvidence.gameScope.replaySha256=hash;raw.matchFacts.game.guid='controlled-second-guid';
  const s2=structuredClone(s1),g2=structuredClone(g1),prefix='native-replay-evidence/m/g2/'+hash+'/';
  s2.gameId='g2';s2.sourceHash=hash;s2.matchFacts=raw.matchFacts;
  s2.originalRecording={...s2.originalRecording,path:prefix+'source.aoe2record',sha256:hash};
  s2.recordedEvents={...s2.recordedEvents,path:prefix+s2.artifactRevision+'/events.jsonl.gz'};
  const plain=Buffer.from(JSON.stringify(raw)),packed=gzipSync(plain);
  s2.statistics={...s2.statistics,path:prefix+s2.artifactRevision+'/statistics.direct.json.gz',
    sha256:digest(packed),bytes:packed.length,uncompressedSha256:digest(plain),uncompressedBytes:plain.length};
  Object.assign(g2,{gameNumber:2,activeReplayStatisticsId:hash});
  s2.experience.bindingKey=statisticsBindingKey({sourceHash:hash,roster:g2.players,mapping:s2.playerMapping,opponents:[]});
  f.rows.set('matches/m/games/g2',g2);f.rows.set('matches/m/games/g2/replaySources/'+hash,s2);
  f.rows.set('recordingGameClaims/'+Buffer.from(raw.matchFacts.game.guid).toString('hex'),{matchId:'m',gameId:'g2',sourceHash:hash});
  f.objects.set(s2.statistics.path,packed);f.objects.set(s2.recordedEvents.path,f.objects.get(s1.recordedEvents.path));
  f.objects.set(s2.originalRecording.path,Buffer.from('CONTROLLED_SECOND_SOURCE_NOT_ORIGINAL_RECORDING'));
  Object.assign(match,{seriesRule:{maxGames:3,gamesRequiredToWin:2},
    canonicalResult:{...g1.canonicalResult,sourceGameId:'g2',seriesGameRevisions:{g:1,g2:1}}});
  f.rows.set('matches/m/games/terminal',{status:'NO_CONTEST',gameNumber:3,
    players:g1.players,resolutionReason:'Series decided by g2'});
  Object.assign(f.rows.get('events/e'),{startsAt:{toMillis:()=>1000},approvedMatchPlanId:'approved',matchPlanStatus:'APPROVED'});
  Object.assign(match,{sourceMatchPlanId:'approved',matchNumber:1});
  f.rows.set('events/e/matchPlans/approved',{status:'APPROVED',officialMatchIds:['m'],matches:[{}]});
  return f;
}

test('controlled current 2-0 BO3 keeps two required sources and discloses lawful unused terminal without Pending',async()=>{
  const f=await series(),p=await collectMyCurrentBattleHistory({...f.input,includeScheduleOrder:true});
  assert.equal(p.coverage.currentSources,2);
  assert.deepEqual(p.pending,[]);
  assert.deepEqual(p.battles[0].gameIds,['g','g2']);
  assert.deepEqual(p.battles[0].unusedGameIds,['terminal']);
  assert.equal(p.battles[0].gameManifestComplete,true);
  assert.deepEqual(p.scheduleOrders.map(o=>o.gameId),['g','g2']);
  assert.ok(p.scheduleOrders.every(o=>o.status==='ORDERED'));
  const personality=await readMyPersonalityHistory(f.input);
  assert.equal(personality.status,'CURRENT_INPUTS');
  const honours=await readMyHonoursPreview({...f.input,env:{...f.input.env,AOF_HONOURS_PRIVATE_PREVIEW:'source-v1'}});
  assert.equal(honours.coverage.completeSourceBattles,1);
});

test('forged NO_CONTEST, changed series/result and required missing or withdrawn sources remain Pending',async()=>{
  for(const change of [
    f=>{f.rows.get('matches/m/games/terminal').resolutionReason='unrelated cancellation';},
    f=>{f.rows.get('matches/m/games/terminal').activeReplayStatisticsId='f'.repeat(64);},
    f=>{f.rows.get('matches/m').canonicalResult.seriesGameRevisions.g2=2;},
    f=>{f.rows.get('matches/m/games/g2').canonicalResult={...f.rows.get('matches/m/games/g2').canonicalResult,winningPlayerIds:['p2'],losingPlayerIds:['p1']};},
    f=>{f.rows.delete('matches/m/games/g2');},
    f=>{f.rows.get(f.sourcePath).state='WITHDRAWN';},
  ]){
    const f=await series();change(f);
    const current=await collectMyCurrentBattleHistory({...f.input,includeScheduleOrder:true});
    assert.ok(current.pending.length>0);
    assert.equal((await readMyPersonalityHistory(f.input)).status,'PENDING_INPUTS');
    const honours=await readMyHonoursPreview({...f.input,env:{...f.input.env,AOF_HONOURS_PRIVATE_PREVIEW:'source-v1'}});
    assert.equal(honours.coverage.completeSourceBattles,0);
    assert.ok(honours.honours.every(h=>h.status==='PENDING'));
  }
  const f=await series();f.rows.delete('matches/m/games/g2');
  const current=await collectMyCurrentBattleHistory(f.input);
  assert.equal(current.battles[0].gameManifestComplete,false);
  assert.ok(current.pending.some(p=>p.gameId===null&&p.reason==='REQUIRED_GAME_MANIFEST_INCOMPLETE'));
  assert.ok(current.battles[0].gameIds.every(id=>id!=='g2'),'missing document identity was not fabricated');
});

test('unused terminal and series authority remain in the complete private read fence',async()=>{
  for(const change of [
    f=>{f.rows.get('matches/m/games/terminal').resolutionReason='corrected cancellation';},
    f=>{f.rows.get('matches/m/games/terminal').status='READY';},
    f=>{f.rows.get('matches/m').canonicalResult.seriesGameRevisions.g2=2;},
    f=>{f.rows.delete('matches/m/games/g2');},
  ]){
    const f=await series(),current=await collectMyCurrentBattleHistory(f.input);
    assert.deepEqual(current.pending,[]);change(f);
    await assert.rejects(current.revalidate(),e=>e.code==='aborted');
  }
});

test('Chronicle invitation verification requires only lawful source-bearing Games but keeps the whole series current',async()=>{
  const f=await series(),current=await collectMyCurrentBattleHistory({...f.input,includeScheduleOrder:true});
  const source=current.loaded.find(s=>s.source.gameId==='g').source;
  const review={methodReview:'EMULATOR_ONLY',reviewedSource:'ORIGINAL_VERIFIED_TEST_WITNESS',
    battleId:'m',gameId:'g',sourceAuthority:source.authorityRevision,incidentId:'controlled-help',incidentRevision:'c'.repeat(64),
    respondentPlayerId:'p1',counterpartPlayerId:'p2',family:'ASSISTANCE',qualifierMethod:'emulator-reviewed-assistance',
    qualification:'ADMITTED',significance:'EXCEPTIONAL',sourceEvidenceRefs:['CONTROLLED_MEANING_NOT_EXECUTED_HELP'],
    independentEpisodeKey:'controlled-episode',substantiveAssistanceVerified:true};
  f.rows.set('matches/m/chronicleRareReviewedMoments/controlled-help',review);
  const originalTx=f.db.runTransaction;
  f.db.runTransaction=fn=>originalTx(tx=>fn({...tx,
    create:(ref,data)=>{assert.equal(f.rows.has(ref.path),false);f.rows.set(ref.path,data);},
    set:(ref,data,options)=>f.rows.set(ref.path,options?.merge?{...f.rows.get(ref.path),...data}:data)}));
  const input={...f.input,env:{...f.input.env,AOF_CHRONICLE_INTERACTIONS_V1E:'emulator-only'}};
  const offered=await offerMyChronicleInvitation(input,{battleId:'m'});
  assert.equal(offered.offered,true);
  const before=(await readMyChronicleInvitations(input,{})).invitations[0];
  assert.equal(before.sourceCurrent,true);assert.equal(before.context.gameNumber,1);
  const acted=await actOnMyChronicleInvitation(input,{battleId:'m',requestId:'defer-test',
    expectedRevision:before.revision,opportunityRevision:before.opportunityRevision,action:'DEFER'});
  assert.equal(acted.state,'DEFERRED');
  f.rows.get('matches/m/games/terminal').resolutionReason='corrected cancellation';
  assert.equal((await readMyChronicleInvitations(input,{})).invitations[0].sourceCurrent,false);
  await assert.rejects(actOnMyChronicleInvitation(input,{battleId:'m',requestId:'stale-submit',
    expectedRevision:acted.revision,opportunityRevision:before.opportunityRevision,action:'SUBMIT',
    choiceId:'ACKNOWLEDGED_HELP',confirmed:true}),e=>e.code==='aborted');
});
