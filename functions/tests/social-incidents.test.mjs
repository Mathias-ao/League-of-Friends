import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectSocialIncidents,capSocialContributions,rebuildSocialHistory,SOCIAL_SHADOW_RULES} from '../lib/engines/socialIncidentCore.js';
const source={replaySha256:'recording',canonicalManifestSha256:'manifest'};
const command=(id,actor,target,at,mode,ordinal=at)=>({sourceEventId:id,replaySlot:actor,targetReplaySlot:target,atMs:at,operationOrdinal:ordinal,diplomacyMode:mode,commandId:0});
const mapping=[{replaySlot:1,playerId:'a',sourceName:'Bot(Human)'},{replaySlot:2,playerId:'b',sourceName:'Bob'}];
function fixture(commands=[command('a-ally',1,2,1000,0),command('b-ally',2,1,1500,0),command('break',1,2,30000,3),command('reply',2,1,45000,3)]) {
 const timelines={};for(const c of commands)(timelines[c.replaySlot+'->'+c.targetReplaySlot]??=[]).push(c);
 return {source:{...source},matchFacts:{modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',identityNamespace:'CANONICAL_REPLAY_PLAYER_ID',source:{...source},
 game:{observedDurationMs:120000},players:[{playerId:1,replaySlot:1,lobbyTeamIdRaw:1},{playerId:2,replaySlot:2,lobbyTeamIdRaw:1}],
 rules:{lockTeams:{value:false}},diplomacy:{commandTimelines:timelines}},pairSocialEvidence:{modelVersion:'AOF_PAIR_SOCIAL_EVIDENCE_V1',gameScope:{...source},observations:[],incidents:[]}};
}
const observe=(stats,id,actor,at,commandType='ORDER')=>stats.pairSocialEvidence.observations.push({sourceEventId:id,actorPlayerId:actor,moment:{atMs:at,operationOrdinal:at},commandType});
const fact=(id,kind,actor,target,at,extra={})=>({factId:id,kind,actorPlayerId:actor,targetPlayerId:target,moment:{atMs:at,operationOrdinal:at},sourceEventIds:[id],
 qualification:'QUALIFIED',qualifierVersion:'CONTROLLED_TEST_ONLY',source:{...source},targetAttribution:'QUALIFIED',...extra});
const admitted={acceptedQualifierVersions:['CONTROLLED_TEST_ONLY']};
const options=stats=>({statistics:stats,playerMapping:mapping,context:{gameId:'g',battleId:'battle'}});
const official={qualification:'OFFICIAL',resultRevision:1,winnerPlayerIds:['a'],loserPlayerIds:['b']};
test('withdrawal role and 15-second defense are independent of 10-second strike window',()=>{
 const s=fixture(),before=structuredClone(s),r=projectSocialIncidents(options(s));
 assert.equal(r.status,'REVIEW_AVAILABLE');assert.equal(r.incidents[0].role,'INITIATING_DECLARATION_BREACH');
 assert.equal(r.incidents[1].role,'RESPONSE_AFTER_WITHDRAWAL');assert.equal(r.incidents[1].responseTo,r.incidents[0].incidentId);
 assert.equal(r.deeds.length,0);assert.ok(r.decisions.some(d=>d.status==='UNAVAILABLE'));assert.deepEqual(s,before);
 assert.equal(r.policy.engineStateEstablished,false);assert.equal(r.policy.productionScoringEnabled,false);
});
test('near-simultaneous withdrawals are contested without changing prior declarations',()=>{
 const r=projectSocialIncidents(options(fixture([command('a',1,2,1000,0),command('b',2,1,1500,0),command('x',1,2,30000,3),command('y',2,1,33000,3)])));
 assert.ok(r.incidents.every(i=>i.role==='CONTESTED_WITHDRAWAL'));assert.equal(r.incidents[0].counterpartDeclaration,'ALLY');
});
test('unknown command interrupts continuity; first Enemy is not an alliance withdrawal',()=>{
 const r=projectSocialIncidents(options(fixture([command('a',1,2,1000,0),command('u',1,2,2000,99),command('e',1,2,3000,3)])));
 assert.equal(r.incidents.length,0);assert.ok(r.chronicle.some(c=>c.kind==='DECLARATION_KNOWLEDGE_INTERRUPTED'));
});
test('repeated same stance and input order do not create extra history or awards',()=>{
 const s=fixture();const r=projectSocialIncidents(options(s));
 const reordered=structuredClone(s);for(const vs of Object.values(reordered.matchFacts.diplomacy.commandTimelines))vs.reverse();
 assert.deepEqual(projectSocialIncidents(options(reordered)),r);
 const copy=structuredClone(s.matchFacts.diplomacy.commandTimelines['1->2'][0]);s.matchFacts.diplomacy.commandTimelines['1->2'].push(copy);
 assert.deepEqual(projectSocialIncidents(options(s)),r);
});
test('conflicting references, invalid chronology, source or identity fail closed',()=>{
 const s=fixture();s.matchFacts.diplomacy.commandTimelines['1->2'].push({...s.matchFacts.diplomacy.commandTimelines['1->2'][0],diplomacyMode:3});
 assert.equal(projectSocialIncidents(options(s)).status,'UNAVAILABLE');
 const x=fixture();x.matchFacts.source.canonicalManifestSha256='wrong';assert.equal(projectSocialIncidents(options(x)).status,'UNAVAILABLE');
 assert.equal(projectSocialIncidents({...options(fixture()),playerMapping:[mapping[0],{...mapping[1],playerId:'a'}]}).status,'UNAVAILABLE');
 const y=fixture();y.matchFacts.diplomacy.commandTimelines['1->2'][0].operationOrdinal=0.5;assert.equal(projectSocialIncidents(options(y)).status,'UNAVAILABLE');
});
test('unregistered offensive claims cannot promote generic order to betrayal',()=>{
 const s=fixture();observe(s,'attack',1,35000);
 const r=projectSocialIncidents({...options(s),qualifiedFacts:[fact('attack','OFFENSIVE_ATTEMPT',1,2,35000,{targetFunction:'ECONOMIC_UNIT'})]});
 assert.equal(r.deeds.length,0);assert.ok(r.decisions.some(d=>d.reasons.includes('offensive_semantics_unqualified')));
});
test('one economic target plus prior qualified cooperation reaches limited attempt tier',()=>{
 const s=fixture();observe(s,'aid',1,10000,'DE_TRIBUTE');observe(s,'attack',1,35000);
 const qualifiedFacts=[fact('aid','MATERIAL_AID_ORDER',1,2,10000,{materiality:'QUALIFIED',resourceAmounts:{food:100}}),
 fact('attack','OFFENSIVE_ATTEMPT',1,2,35000,{targetFunction:'ECONOMIC_UNIT'})];
 const r=projectSocialIncidents({...options(s),qualifiedFacts,rules:admitted});
 assert.ok(r.deeds.some(d=>d.track==='CRUELTY'));assert.ok(r.deeds.some(d=>d.track==='HOSTILITY'&&d.reciprocityEligible));
 assert.equal(r.incidents[0].qualifiedOffenses.length,1);assert.equal(r.incidents[1].role,'RESPONSE_AFTER_WITHDRAWAL');
 assert.ok(r.shadowContributions.some(c=>c.track==='CRUELTY'));
});
test('military and unknown targets retain betrayal without cruelty',()=>{
 for(const targetFunction of ['MILITARY','UNKNOWN','ECONOMIC_STRUCTURE']){
 const s=fixture();observe(s,'attack',1,35000);
 const r=projectSocialIncidents({...options(s),qualifiedFacts:[fact('attack','OFFENSIVE_ATTEMPT',1,2,35000,{targetFunction})],rules:admitted});
 assert.ok(r.deeds.some(d=>d.track==='HOSTILITY'));assert.ok(!r.deeds.some(d=>d.track==='CRUELTY'));
 }
});
test('post-breach cooperation cannot backfill trust and reciprocity does not cancel aid',()=>{
 const s=fixture();observe(s,'aid',2,10000,'DE_TRIBUTE');observe(s,'reverse',1,20000,'DE_TRIBUTE');observe(s,'attack',1,35000);
 const r=projectSocialIncidents({...options(s),rules:admitted,qualifiedFacts:[
 fact('aid','MATERIAL_AID_ORDER',2,1,10000,{materiality:'QUALIFIED',resourceAmounts:{wood:100}}),
 fact('reverse','MATERIAL_AID_ORDER',1,2,20000,{materiality:'QUALIFIED',resourceAmounts:{food:100}}),
 fact('attack','OFFENSIVE_ATTEMPT',1,2,35000,{targetFunction:'ECONOMIC_UNIT'})]});
 assert.equal(r.deeds.filter(d=>d.family==='MATERIAL_ASSISTANCE'&&d.track==='BOND').length,2);
 const late=fixture();observe(late,'late',1,31000,'DE_TRIBUTE');observe(late,'attack',1,35000);
 const x=projectSocialIncidents({...options(late),rules:admitted,qualifiedFacts:[fact('late','MATERIAL_AID_ORDER',1,2,31000,{materiality:'QUALIFIED',resourceAmounts:{food:100}}),fact('attack','OFFENSIVE_ATTEMPT',1,2,35000,{targetFunction:'ECONOMIC_UNIT'})]});
 assert.ok(!x.deeds.some(d=>d.track==='CRUELTY'));
});
test('restored truce and unknown intervals break offensive association; exact 10 seconds is immediate',()=>{
 const s=fixture();observe(s,'attack',1,40000);
 const r=projectSocialIncidents({...options(s),rules:admitted,qualifiedFacts:[fact('attack','OFFENSIVE_ATTEMPT',1,2,40000,{targetFunction:'MILITARY'})]});
 assert.equal(r.chronicle.find(c=>c.kind==='OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL').association,'IMMEDIATE');
 s.matchFacts.diplomacy.commandTimelines['1->2'].push(command('restore',1,2,39000,0));
 assert.equal(projectSocialIncidents({...options(s),rules:admitted,qualifiedFacts:[fact('attack','OFFENSIVE_ATTEMPT',1,2,40000)]}).incidents[0].qualifiedOffenses.length,0);
});
test('new truce does not treat a later fresh breach as response to an obsolete campaign',()=>{
 const s=fixture([command('a',1,2,1000,0),command('b',2,1,1500,0),command('old',1,2,10000,3),command('reply',2,1,15000,3),
 command('a-new',1,2,25000,0),command('b-new',2,1,26000,0),command('fresh',2,1,40000,3)]);
 assert.equal(projectSocialIncidents(options(s)).incidents.at(-1).role,'INITIATING_DECLARATION_BREACH');
});
test('mapped human Bot name earns official duel participation; AI/unmapped does not',()=>{
 const r=projectSocialIncidents({...options(fixture([])),officialOutcome:official});
 assert.equal(r.deeds.filter(d=>d.track==='RIVALRY').length,2);assert.equal(r.shadowContributions.length,2);
 assert.equal(projectSocialIncidents({statistics:fixture([]),officialOutcome:official}).deeds.length,0);
 assert.equal(projectSocialIncidents({...options(fixture([])),officialOutcome:official,playerMapping:[{...mapping[0],participantType:'AI'},mapping[1]]}).deeds.length,0);
});
test('unresolved outcome does not score duel, while official correction only changes result revision facts',()=>{
 const opts=options(fixture([]));assert.equal(projectSocialIncidents({...opts,officialOutcome:{qualification:'UNRESOLVED'}}).deeds.length,0);
 const r=projectSocialIncidents({...opts,officialOutcome:{...official,resultRevision:2,winnerPlayerIds:['b'],loserPlayerIds:['a']}});
 assert.equal(r.deeds.length,2);assert.equal(r.chronicle.find(c=>c.kind==='ACCEPTED_DUEL_CONTEST').resultRevision,2);
});
const unit=(id,track='CRUELTY',other='b',battleId='battle',severity=1)=>({deedId:id,lineageId:id,family:id,track,actorLeagueId:'a',counterpartLeagueId:other,battleId,
 gameIdentity:'g',moment:{atMs:1,operationOrdinal:1},severity,sourceEventIds:[id],ruleVersion:SOCIAL_SHADOW_RULES.ruleVersion});
test('aggregate reputation budget spans all victims and families; identical copies and sorting are invariant',()=>{
 const ds=[unit('x'),unit('y','CRUELTY','c'),unit('z','CRUELTY','d', 'battle',3)];
 const r=capSocialContributions(ds);assert.equal(r.length,1);assert.equal(r[0].units,1);assert.equal(r[0].deedId,'z');
 assert.deepEqual(capSocialContributions([...ds].reverse().concat(ds)),r);
 assert.throws(()=>capSocialContributions([ds[0],{...ds[0],severity:3}]),/conflicting/);
});
const chapter=(n,revision=1,accepted=true)=>{
 const gameIdentity='g'+n,battleId='b'+n,stats=fixture([]);stats.source.replaySha256='r'+n;stats.matchFacts.source.replaySha256='r'+n;stats.pairSocialEvidence.gameScope.replaySha256='r'+n;
 return {gameIdentity,battleId,order:n,revision,accepted,review:projectSocialIncidents({statistics:stats,playerMapping:mapping,officialOutcome:official,context:{gameId:gameIdentity,battleId}})};
};
test('three distinct accepted Battles and reciprocal contest reach stage three; duplicate POVs cannot inflate',()=>{
 const chapters=[chapter(1),chapter(2),chapter(3)];const r=rebuildSocialHistory(chapters);
 assert.equal(r.pairs[0].tracks.RIVALRY.currentStage,3);assert.equal(r.pairs[0].exposure.gameIds.length,3);
 assert.deepEqual(rebuildSocialHistory([...chapters].reverse().concat(chapters)),r);
 const one=chapter(1);one.review.deeds.forEach(d=>d.battleId='same');one.review.battleId='same';one.battleId='same';
 const two=chapter(2);two.review.deeds.forEach(d=>d.battleId='same');two.review.battleId='same';two.battleId='same';
 assert.equal(rebuildSocialHistory([one,two]).pairs[0].tracks.RIVALRY.currentStage,1);
});
test('latest void revision replaces prior active awards and identity/context conflicts fail closed',()=>{
 const r=rebuildSocialHistory([chapter(1),chapter(2),chapter(3),chapter(3,2,false)]);
 assert.equal(r.activeGameCount,2);assert.equal(r.pairs[0].tracks.RIVALRY.currentStage,2);
 assert.throws(()=>rebuildSocialHistory([chapter(1),{...chapter(1),accepted:false}]),/conflicting_active/);
 const wrong=chapter(1);wrong.battleId='other';assert.throws(()=>rebuildSocialHistory([wrong]),/context_mismatch/);
});
test('known co-presence without qualified deeds remains exposure, not relationship or opportunity',()=>{
 const c=chapter(1);c.review=projectSocialIncidents({...options(fixture([])),context:{gameId:c.gameIdentity,battleId:c.battleId}});
 const r=rebuildSocialHistory([c]);assert.equal(r.pairs.length,1);assert.deepEqual(r.pairs[0].tracks,{});assert.equal(r.policy.ratiosEnabled,false);
});
test('real FFA chronology preserves Halvar initiation and 12–14-second responses without fabricated attacks',()=>{
 const statistics=JSON.parse(fs.readFileSync(new URL('./fixtures/social-ffa-diplo.json',import.meta.url)));
 const r=projectSocialIncidents({statistics});assert.equal(r.status,'REVIEW_AVAILABLE');assert.equal(r.exposure.length,28);
 const opening=r.incidents.filter(i=>i.moment.atMs===3462262);assert.equal(opening.length,2);assert.ok(opening.every(i=>i.actorPlayerId===7&&i.role==='INITIATING_DECLARATION_BREACH'));
 for(const at of [3474878,3476870])assert.equal(r.incidents.find(i=>i.moment.atMs===at).role,'RESPONSE_AFTER_WITHDRAWAL');
 assert.equal(r.deeds.length,0);assert.equal(r.shadowContributions.length,0);assert.ok(r.incidents.some(i=>i.targetedOrderCandidates.length));
 assert.ok(r.incidents.every(i=>i.qualifiedOffenses.length===0));
});
test('king-loss exception requires every qualified gate and never promotes a declaration alone',()=>{
 const s=fixture();observe(s,'loss',1,70000);
 const base=fact('loss','QUALIFIED_KING_LOSS_TREACHERY',1,2,70000,{kingLossEpisodeId:'king-1',claims:{}});
 const blocked=projectSocialIncidents({...options(s),rules:admitted,qualifiedFacts:[base]});
 assert.ok(!blocked.deeds.some(d=>d.exception));assert.ok(blocked.decisions.some(d=>d.reasons.includes('king_loss_prerequisites_unqualified')));
 base.claims=Object.fromEntries(['mutualEffectiveAlliance','effectiveRupture','hostileParticipation','kingLoss','responsibility','association','mode'].map(k=>[k,'QUALIFIED']));
 const r=projectSocialIncidents({...options(s),rules:admitted,qualifiedFacts:[base]});
 const d=r.deeds.find(d=>d.exception);assert.equal(d.actorLeagueId,'b');assert.equal(d.counterpartLeagueId,'a');assert.equal(d.actionActorPlayerId,1);
 assert.equal(d.reciprocityEligible,false);assert.ok(!r.deeds.some(d=>d.track==='CRUELTY'));
 const h=rebuildSocialHistory([{gameIdentity:'g',battleId:'battle',order:1,revision:1,accepted:true,review:r}],admitted);
 assert.equal(h.pairs[0].tracks.HOSTILITY.exceptionalDirectedLevels.b,3);assert.equal(h.pairs[0].tracks.HOSTILITY.currentStage,0);
 const repeated=capSocialContributions([d,d],admitted);assert.equal(repeated.length,1);
});
test('approved directed exception below/at/above level three is capped and invalid config rejected',async()=>{
 const {applyTreacheryLevel}=await import('../lib/engines/socialIncidentCore.js');
 assert.equal(applyTreacheryLevel(0,6),3);assert.equal(applyTreacheryLevel(2,6),3);assert.equal(applyTreacheryLevel(3,6),4);
 assert.equal(applyTreacheryLevel(5,6),6);assert.equal(applyTreacheryLevel(6,6),6);assert.throws(()=>applyTreacheryLevel(3,2));
});

test('disabled shadow policy blocks contribution recomputation without deleting evidence',()=>{
 const c=chapter(1);assert.equal(capSocialContributions(c.review.deeds,{enabled:false}).length,0);
 assert.equal(rebuildSocialHistory([c],{enabled:false}).contributions.length,0);
});


const nativeSource={
 replaySha256:'a'.repeat(64),recordedEventsSha256:'b'.repeat(64),
 recordedEventsVersion:'AOF_RECORDED_EVENTS_V1',parserVersion:'mgz-fast/test',
 extractionRunId:'test-verified-extraction-001',
};
const asNative=(legacy)=> {
 const result=structuredClone(legacy);
 result.source={...nativeSource};
 result.matchFacts.source={...nativeSource};
 // Pair-social gameScope deliberately omits extractionRunId in the producer.
 result.pairSocialEvidence.gameScope=Object.fromEntries(
   Object.entries(nativeSource).filter(([key])=>key!=='extractionRunId'));
 return result;
};
const withoutSource=({source:_,...rest})=>rest;

test('native Recorded Events provenance produces exactly the legacy neutral social interpretation',()=>{
 const old=fixture();
 observe(old,'aid',1,10000,'DE_TRIBUTE');
 observe(old,'attack',1,35000);
 const qualifiedFacts=[
   fact('aid','MATERIAL_AID_ORDER',1,2,10000,{materiality:'QUALIFIED',resourceAmounts:{food:100}}),
   fact('attack','OFFENSIVE_ATTEMPT',1,2,35000,{targetFunction:'ECONOMIC_UNIT'}),
 ];
 const native=asNative(old);
 const before=structuredClone(native);
 const opts={playerMapping:mapping,context:{gameId:'m/g',battleId:'m'},rules:admitted,officialOutcome:official};
 const oldReview=projectSocialIncidents({...opts,statistics:old,qualifiedFacts});
 const nativeReview=projectSocialIncidents({...opts,statistics:native,
   qualifiedFacts:qualifiedFacts.map(row=>({...row,source:{...nativeSource}}))});
 assert.equal(oldReview.status,'REVIEW_AVAILABLE');
 assert.equal(nativeReview.status,'REVIEW_AVAILABLE');
 assert.deepEqual(withoutSource(nativeReview),withoutSource(oldReview));
 assert.deepEqual(nativeReview.source,nativeSource);
 assert.deepEqual(native,before,'native source evidence is immutable');
 assert.equal(nativeReview.policy.productionScoringEnabled,false);
 assert.ok(nativeReview.deeds.some(deed=>deed.track==='BOND'));
 assert.ok(nativeReview.deeds.some(deed=>deed.track==='HOSTILITY'));
});

test('native social provenance rejects cross-revision, mixed-format and incomplete evidence',()=>{
 const base=asNative(fixture());
 for (const [label,mutate] of [
   ['wrong match-facts event hash',s=>s.matchFacts.source.recordedEventsSha256='c'.repeat(64)],
   ['wrong match-facts extraction',s=>s.matchFacts.source.extractionRunId='other-run'],
   ['wrong ledger parser version',s=>s.pairSocialEvidence.gameScope.parserVersion='other'],
   ['wrong ledger source hash',s=>s.pairSocialEvidence.gameScope.recordedEventsSha256='d'.repeat(64)],
   ['unknown native version',s=>s.source.recordedEventsVersion='V2_UNREVIEWED'],
   ['malformed event hash',s=>s.source.recordedEventsSha256='short'],
   ['missing native extraction',s=>delete s.source.extractionRunId],
   ['missing native version',s=>delete s.source.recordedEventsVersion],
   ['mixed canonical and native',s=>s.source.canonicalManifestSha256='legacy-manifest'],
   ['mixed native fact provenance',s=>s.matchFacts.source.canonicalManifestSha256='legacy-manifest'],
   ['mixed native ledger provenance',s=>s.pairSocialEvidence.gameScope.canonicalManifestSha256='legacy-manifest'],
   ['no native pair-social ledger',s=>delete s.pairSocialEvidence],
   ['unknown native pair-social ledger',s=>s.pairSocialEvidence.modelVersion='unsupported'],
   ['missing native observations',s=>delete s.pairSocialEvidence.observations],
   ['missing native incidents',s=>delete s.pairSocialEvidence.incidents],
 ]) {
   const input=structuredClone(base);
   mutate(input);
   const review=projectSocialIncidents(options(input));
   assert.equal(review.status,'UNAVAILABLE',label);
   assert.deepEqual(review.deeds,[],label);
   assert.equal(review.policy.productionScoringEnabled,false,label);
 }
});

test('native qualified social facts must bind their complete extraction revision',()=>{
 const native=asNative(fixture());
 observe(native,'aid',1,10000,'DE_TRIBUTE');
 const aid={...fact('aid','MATERIAL_AID_ORDER',1,2,10000,
   {materiality:'QUALIFIED',resourceAmounts:{food:100}}),source:{...nativeSource}};
 const opts={...options(native),rules:admitted};
 assert.ok(projectSocialIncidents({...opts,qualifiedFacts:[aid]}).deeds.some(d=>d.track==='BOND'));
 for(const mutate of [
   q=>q.source.recordedEventsSha256='c'.repeat(64),
   q=>q.source.parserVersion='unknown-decoder',
   q=>q.source.extractionRunId='other-run',
   q=>q.source.canonicalManifestSha256='canonical-not-native',
 ]) {
   const changed=structuredClone(aid);
   mutate(changed);
   const review=projectSocialIncidents({...opts,qualifiedFacts:[changed]});
   assert.equal(review.status,'UNAVAILABLE');
   assert.equal(review.deeds.length,0);
 }
});


test('recorded real eight-player FFA social chronology is invariant under native provenance',()=>{
 const full=JSON.parse(fs.readFileSync(new URL('./fixtures/social-ffa-diplo.json',import.meta.url)));
 const native=asNative(full);
 const context={gameId:'reference-ffa/game',battleId:'reference-ffa'};
 const before=projectSocialIncidents({statistics:full,context});
 const after=projectSocialIncidents({statistics:native,context});
 assert.equal(before.status,'REVIEW_AVAILABLE');
 assert.equal(after.status,'REVIEW_AVAILABLE');
 assert.deepEqual(withoutSource(after),withoutSource(before));
 assert.equal(after.exposure.length,28);
 assert.equal(after.deeds.length,0);
 assert.ok(after.incidents.length>0);
});
