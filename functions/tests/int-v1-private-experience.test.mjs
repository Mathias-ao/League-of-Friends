import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,env as nativeEnv} from './support/native-ready-fixture.mjs';
import {readMySocialExperience,assertIntV1PrivateReadEnabled,getMySocialExperience} from '../lib/queries/getMySocialExperience.js';
import {validateSharedRecord} from '../lib/domain/socialV1Validation.js';
import {privateSourceExperience} from '../lib/integration/intV1Experience.js';
const env={...nativeEnv,AOF_INT_V1_PRIVATE_READS:'source-v1'};
async function ready(){
 const f=fixture();await f.run();
 f.db.doc=path=>{const [collection,...parts]=path.split('/');let ref=f.db.collection(collection).doc(parts.shift());
  while(parts.length)ref=ref.collection(parts.shift()).doc(parts.shift());return ref;};
 f.rows.set('authLinks/owner',{playerId:'p1'});
 Object.assign(f.rows.get('matches/m'),{eventId:'e',seasonId:'s',participants:[{playerId:'p1'},{playerId:'p2'}]});
 Object.assign(f.rows.get('matches/m/games/g'),{gameNumber:1});
 f.rows.set('events/e',{seasonId:'s',status:'ACTIVE',officialMatchIds:['m'],warmupMatchIds:[]});
 f.rows.set('seasons/s',{status:'ACTIVE'});
 const input={db:f.db,bucket:f.storage,actor:{playerId:'p1',authUid:'owner'},request:{matchId:'m',gameId:'g'},env};
 return {...f,input,read:()=>readMySocialExperience(input)};
}

test('canonical runtime validation rejects closed-schema and semantic identity violations',()=>{
 const base=JSON.parse(readFileSync(new URL('../../contracts/social-v1/fixtures/conformance.json',import.meta.url))).bases.SourceSnapshot;
 assert.deepEqual(validateSharedRecord('SourceSnapshot',base),base);
 assert.throws(()=>validateSharedRecord('SourceSnapshot',{...base,privateNote:'never allowed'}));
 assert.throws(()=>validateSharedRecord('SourceSnapshot',{...base,battleId:'not-match'}));
 assert.throws(()=>validateSharedRecord('SourceSnapshot',{...base,statisticsRevision:NaN}));
 const out=privateSourceExperience(base.roster[0].playerId,base);
 assert.equal(out.personality.length,5);assert.equal(out.tracks.length,6);
 assert.ok(out.personality.every(p=>p.value===null));assert.ok(out.tracks.every(p=>p.currentStage===null));
 assert.throws(()=>privateSourceExperience('outsider',base));
});

test('default-off gate rejects production even with explicit opt-in and emulator spelling tricks',()=>{
 for(const e of [{},{...env,AOF_INT_V1_PRIVATE_READS:undefined},{...env,GCLOUD_PROJECT:'league-of-friends-cc274'},
  {...env,GCLOUD_PROJECT:'demo-test',FUNCTIONS_EMULATOR:'false'},
  {...env,GCLOUD_PROJECT:'not-staging',FUNCTIONS_EMULATOR:'true'}])assert.throws(()=>assertIntV1PrivateReadEnabled(e));
 assert.doesNotThrow(()=>assertIntV1PrivateReadEnabled(env));
 assert.doesNotThrow(()=>assertIntV1PrivateReadEnabled({...env,GCLOUD_PROJECT:'age-of-friends-staging',FUNCTIONS_EMULATOR:undefined}));
});

test('authenticated participant source boundary is deterministic and read-only, without fake progression',async()=>{
 const f=await ready(),before=JSON.stringify([...f.rows]);
 const first=await f.read();assert.deepEqual(await f.read(),first);
 assert.equal(first.source.battleId,'m');assert.equal(first.source.gameId,'g');
 assert.equal(first.source.outcome.qualification,'OFFICIAL');
 assert.equal(first.source.sourceHash,f.sourceHash);assert.equal(first.source.artifactRefs.length,3);
 assert.equal(first.scope.independentBattleCount,null);assert.equal(first.scope.historicalCoverage,'NOT_COLLECTED');
 assert.deepEqual(first.effects,{officialWrites:false,receiptPublication:false,entitlementGrants:false});
 assert.equal(JSON.stringify([...f.rows]),before);
 const wire=JSON.stringify(first);
 for(const privateField of ['sourceName','native-replay-evidence','auditRef','privateNote','secret','reciprocityEvents'])assert.ok(!wire.includes(privateField));
 assert.ok(!('claims' in first)&&!('receipts' in first)&&!('judgments' in first));
 await assert.rejects(getMySocialExperience.run({data:f.input.request}),e=>e.code==='unauthenticated');
});

test('caller cannot select another owner, source, policy, result or admin access',async()=>{
 const f=await ready();
 for(const field of ['playerId','sourceHash','policy','resultRevision','cursor'])
  await assert.rejects(readMySocialExperience({...f.input,request:{...f.input.request,[field]:'forged'}}),e=>e.code==='invalid-argument');
 await assert.rejects(readMySocialExperience({...f.input,actor:{playerId:'admin',authUid:'uid'}}),e=>e.code==='permission-denied');
 f.rows.get('authLinks/owner').playerId='p2';await assert.rejects(f.read,e=>e.code==='permission-denied');
 f.rows.get('authLinks/owner').playerId='p1';f.rows.get('players/p1').membershipStatus='SUSPENDED';
 await assert.rejects(f.read,e=>e.code==='permission-denied');
});

test('pending official result preserves verified facts without awarding a win or stage',async()=>{
 const f=await ready(),g=f.rows.get('matches/m/games/g');
 g.status='AWAITING_CONFIRMATION';delete g.canonicalResult;
 f.rows.get(f.sourcePath).ordinaryUploadVersion='AOF_NATIVE_PLAYER_UPLOAD_V1';
 const out=await f.read();assert.deepEqual(out.source.outcome,{qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null});
 assert.ok(out.tracks.every(row=>row.status==='PENDING'&&row.currentStage===null));
});

test('withdrawn, disputed, replaced, unlisted or unclaimed evidence is never current',async()=>{
 for(const mutate of [
  f=>{f.rows.get('matches/m/games/g').activeReplayStatisticsId=null;},
  f=>{f.rows.get('matches/m/games/g').activeResultDisputeId='d';},
  f=>{f.rows.get(f.sourcePath).state='WITHDRAWN';},
  f=>{f.rows.get('matches/m').replacementMatchId='m2';},
  f=>{f.rows.get('events/e').officialMatchIds=[];},
  f=>{f.rows.get('events/e').warmupMatchIds=['m'];},
  f=>{f.rows.get('events/e').seasonId='wrong';},
  f=>{f.rows.delete('recordingGameClaims/'+Buffer.from(f.candidate.matchFacts.game.guid).toString('hex'));},
 ]){const f=await ready();mutate(f);await assert.rejects(f.read);}
});

test('corrections and remaps change authority; mixed revisions and artifact tampering fail closed',async()=>{
 const f=await ready(),first=await f.read(),g=f.rows.get('matches/m/games/g'),s=f.rows.get(f.sourcePath);
 g.canonicalResult.revision=2;g.canonicalResult.winningPlayerIds=['p2'];g.canonicalResult.losingPlayerIds=['p1'];
 const corrected=await f.read();assert.equal(corrected.source.outcome.resultRevision,2);
 assert.notEqual(first.source.authorityRevision,corrected.source.authorityRevision);
 s.playerMapping=[{...s.playerMapping[0],replaySlot:2},{...s.playerMapping[1],replaySlot:1}];
 await assert.rejects(f.read); // Existing statistics binding key must also be corrected.
 const a=await ready();a.rows.get(a.sourcePath).originalRecording.sha256='f'.repeat(64);await assert.rejects(a.read,e=>e.code==='data-loss');
 const b=await ready();b.objects.set(b.candidate.statistics.path,Buffer.from('bad'));await assert.rejects(b.read,e=>e.code==='data-loss');
});

test('authority, membership, GUID and event changes during artifact read abort with no effects',async()=>{
 for(const mutate of [
  f=>{f.rows.get('matches/m/games/g').replayStatisticsRevision++;},
  f=>{f.rows.get('matches/m/games/g').canonicalResult.revision++;},
  f=>{f.rows.get('events/e').status='CANCELLED';},
  f=>{f.rows.get('seasons/s').status='ARCHIVED';},
  f=>{f.rows.get('authLinks/owner').playerId='p2';},
  f=>{f.rows.get(f.sourcePath).playerMapping.reverse();},
  f=>{f.rows.get('recordingGameClaims/'+Buffer.from(f.candidate.matchFacts.game.guid).toString('hex')).sourceHash='f'.repeat(64);},
 ]){const f=await ready();f.onDownload(()=>mutate(f));await assert.rejects(f.read);}
});
