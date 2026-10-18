import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {projectPlayerChronicle,chronicleWasSeenByLegacyId} from '../lib/engines/playerChronicleCore.js';
import {chronicleSceneId,assertRecordInvariants} from '../lib/domain/socialV1.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/chronicle-scene-handoff-v1.json',import.meta.url),'utf8'));
const history={modelVersion:'AOF_SOCIAL_HISTORY_V1',contributions:[],pairs:[],profiles:[]};
const participants=[{playerId:1,leaguePlayerId:'a',name:'A'},{playerId:2,leaguePlayerId:'b',name:'B'}];
const chapter=(gameIdentity,order,beats,sourceRevision)=>({
 battleId:fixture.battleId,gameIdentity,order,playedAtMs:1000,
 eventId:'event',seasonId:'season',accepted:true,chronologyQualified:true,
 battleOutcome:fixture.result,sourceRevision,
 review:{status:'REVIEW_AVAILABLE',participants,chronicle:beats,
  exposure:[{pairPlayerIds:[1,2],context:'LOCKED_TEAMMATES'}]}
});
const makeEntry=(beatId='help',source='source-2')=>projectPlayerChronicle({
 ownerPlayerId:'a',history,names:{a:'A',b:'B'},chapters:[
 chapter('battle-1/game-1',1,[],'source-1'),
 chapter('battle-1/game-2',2,fixture.sourceQualifiedBeats.map(b=>({...b,id:beatId})),source)
 ]}).pages[0].entries[0];

test('frozen Worker E scene seam is canonical, pair-Battle stable and preserves deployed entry IDs',()=>{
 const e=makeEntry();
 assert.equal(fixture.sceneId,chronicleSceneId(fixture.battleId,'a','b'));
 assert.equal(e.sceneId,fixture.sceneId);
 assert.equal(e.entryId,fixture.legacyEntryId);
 assert.deepEqual(e.result,fixture.result);
 assert.equal(e.resultStatus,fixture.publicDto.resultStatus);
 assert.equal(e.chronologyStatus,fixture.publicDto.chronologyStatus);
 assert.deepEqual(e.sourceLineage,fixture.sourceLineage);
 const revised=makeEntry('corrected-help','source-3');
 assert.equal(revised.sceneId,fixture.correction.unchangedSceneId);
 assert.notEqual(revised.sceneRevision,e.sceneRevision);
 assert.notEqual(revised.entryId,e.entryId);
 assert.equal(chronicleWasSeenByLegacyId([e.entryId],revised,'a','b'),true);
 assert.equal(chronicleWasSeenByLegacyId([e.sceneId],revised,'a','b'),true);
});

test('projection can be lifted into strict canonical ChronicleScene with unresolved Battle result and private field separation',()=>{
 const e=makeEntry();
 const scene={
  sceneId:e.sceneId,sceneRevision:e.sceneRevision,
  battleId:fixture.battleId,matchId:fixture.matchId,
  ownerPlayerId:'a',counterpartPlayerId:'b',
  factRefs:[],inferredClaimRefs:[],receiptRefs:[],
  publicJudgmentRefs:[],awardRefs:[],exceptionalMomentRefs:[],
  priorHistoryDigest:null,
  historyCoverage:{tier:'LIMITED',ruleId:'Factual-only incomplete outcome',
    missing:['BATTLE_RESULT'],limitations:[]},result:e.result
 };
 assert.doesNotThrow(()=>assertRecordInvariants('ChronicleScene',scene));
 assert.equal(scene.result.winningPlayerIds,null);
 assert.equal(scene.receiptRefs.length,0,'shadow scoring is never a published receipt');
 for(const forbidden of fixture.privacy.internalOnly){
  assert.equal(Object.hasOwn(fixture.publicDto,forbidden),false,forbidden);
 }
 const revised=makeEntry('corrected-help','source-3');
 assert.notEqual(e.sceneRevision,revised.sceneRevision);
 assert.equal(e.sceneId,revised.sceneId);
 assert.equal(createHash('sha256').update(JSON.stringify([
   'AOF_SOCIAL_V1_SHARED_1','SCENE','battle-1','a','b'])).digest('hex'),e.sceneId);
});
