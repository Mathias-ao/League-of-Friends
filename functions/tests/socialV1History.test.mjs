import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {evaluateHistory,validateCalibration,VERSION} from '../lib/engines/socialV1History/history.js';
const h=x=>createHash('sha256').update(x).digest('hex'), A=h('source'), B=h('other');
const approved={policyVersion:'test-policy',configurationVersion:'test-config',status:'APPROVED',approvalRef:'SYNTHETIC-ONLY'};
const proposed={...approved,status:'PROPOSED',approvalRef:null};
function cal(policy=approved){const tracks={REPUTATION:['GALLANTRY','CRUELTY','CHIVALRY'],RELATIONSHIP:['RIVALRY','HOSTILITY','BOND']};
 const budgets={},stages={},rules={};for(const [system,names] of Object.entries(tracks)){
 const group=system==='REPUTATION'?'reputationBattle':'relationshipEvent';budgets[group]={};stages[system]={};
 for(const track of names){budgets[group][track]={STRENGTHEN:8,WEAKEN:8};
 stages[system][track]={up:[2,3,5,8],down:[4,4,4,4],...(system==='RELATIONSHIP'?{reciprocity:{3:1,4:2}}:{})};
 for(const effect of ['STRENGTHEN','WEAKEN'])rules[track+'_'+effect]={system,track,effect,bands:{base:2,major:5,large:8}};}}
 return {version:'TEST_CAL_1',policy,budgets,stages,rules,treachery:{consumptionUnits:4,maximumStage:4}};}
function ch(n,{battle='m'+n,game='g'+n,event=n,eventOrder=n,battleOrder=n,gameOrder=1,source=A,state='READY',revision=1}={}){
 return {battleId:battle,matchId:battle,gameId:game,gameGuid:h(game),eventId:'e'+event,seasonId:'s1',sourceAuthority:source,
 state,revision,order:{event:eventOrder,battle:battleOrder,game:gameOrder,key:'E'+eventOrder+':B'+battleOrder}};}
const rel=(track,from='a',to='b')=>({system:'RELATIONSHIP',track,fromPlayerId:from,toPlayerId:to});
const rep=(track,player='a')=>({system:'REPUTATION',track,playerId:player});
function fx(c,subject,n,{strength='base',effect='STRENGTHEN',reciprocity=false,pol=approved,contributionKey='deed'+n,at=n}={}){
 const claimId='claim-'+n+'-'+subject.track+'-'+(subject.fromPlayerId??subject.playerId)+'-'+effect;
 const ref={kind:'SOURCE_DEED',id:'source-'+n,revision:'v1',digest:h('source'+n)};
 const position={leagueOrderKey:c.order?.key??null,gameNumber:c.order.game,recordingAtMs:at*100,operationOrdinal:n,order:'ORDERED'};
 const claim={claimId,claimRevision:h(claimId),incidentId:'incident-'+n,incidentRevision:h('incident'+n),subject,
 effect,basis:'BOUNDED_INFERENCE',ruleId:subject.track+'_'+effect,policy:pol,decision:'QUALIFIED',supportRefs:[ref],
 significanceBandId:strength,contributionKey,historicalPosition:position,
 reciprocity:{decision:reciprocity?'ELIGIBLE':'INELIGIBLE',ruleId:'OWN_DIRECTED_ACT',independentActorRefs:reciprocity?[ref]:[]}};
 const row={claim,battleId:c.battleId,gameId:c.gameId,eventId:c.eventId,sourceAuthority:c.sourceAuthority};
 const witness={claimId,battleId:c.battleId,incidentId:claim.incidentId,actorPlayerId:subject.fromPlayerId??subject.playerId,
 ref,qualification:'QUALIFIED'};return {row,witness};}
function run(cs,ee,{policy=approved,calibration=cal(policy),...extra}={}){
 return evaluateHistory({chapters:cs,effects:ee.map(e=>e.row),actorWitnesses:ee.map(e=>e.witness),calibration,
 trustedApprovals:[approved],...extra});}
function get(r,s){return r.projections.find(p=>JSON.stringify(p.subject)===JSON.stringify(s));}
function receipts(r,kind){return r.receipts.filter(q=>q.kind===kind);}
function treachery(c,n,override={}){return {incidentId:'treachery-'+n,incidentRevision:h('treachery-'+n),qualifierVersion:'strict-qualified',
 victimPlayerId:'a',responsiblePlayerId:'b',battleId:c.battleId,gameId:c.gameId,eventId:c.eventId,sourceAuthority:c.sourceAuthority,
 strictProofRef:{kind:'STRICT_PROOF',id:'strict',revision:'v1',digest:h('strict')},
 bindingVictimJudgmentRef:{kind:'JUDGMENT',id:'victim',revision:'v1',digest:h('victim')},victimJudgment:'BETRAYED',
 qualifiedByStrictResolver:true,strictGates:Object.fromEntries(['effectiveMutualAlliance','unilateralRupture','orderedHostility','kingLoss',
 'responsibility','associatedIncident','eligibleModeAndIdentity'].map(x=>[x,true])),
 historicalPosition:{leagueOrderKey:c.order.key,gameNumber:c.order.game,recordingAtMs:300,operationOrdinal:100,order:'ORDERED'},...override};}
test('requires explicit calibration for all six tracks and stage-level reciprocity',()=>{
 assert.equal(VERSION,'AOF_SOCIAL_V1_HISTORY_1');assert.throws(()=>validateCalibration(),/CALIBRATION_REQUIRED/);
 const x=cal();delete x.stages.REPUTATION.CRUELTY;assert.throws(()=>validateCalibration(x),/CALIBRATION_CRUELTY/);
 const y=cal();delete y.stages.RELATIONSHIP.BOND.reciprocity[4];assert.throws(()=>validateCalibration(y),/RECIPROCITY_BOND_4/);});
test('proposed policy executes preview only; no official receipts',()=>{
 const c=ch(1),r=run([c],[fx(c,rep('CHIVALRY'),1,{pol:proposed})],{policy:proposed});
 assert.equal(get(r,rep('CHIVALRY')).stage,1);assert.equal(r.publicationAllowed,false);assert.deepEqual(r.receipts,[]);});
test('six tracks player-owned vs directional independently and no zero-sum conversion',()=>{
 const c=ch(1),rs=[rep('GALLANTRY'),rep('CRUELTY'),rep('CHIVALRY'),rel('RIVALRY'),rel('HOSTILITY'),rel('BOND')];
 const r=run([c],rs.map((s,i)=>fx(c,s,i+1)));for(const s of rs)assert.equal(get(r,s).stage,1);
 assert.equal(get(r,rel('BOND','b','a')),undefined);assert.equal(receipts(r,'MOVEMENT').length,6);});
test('one-sided levels 1-2, stage 3 delayed until real independent opposite direction',()=>{
 const a=ch(1),b=ch(2);const f=fx(a,rel('RIVALRY'),1,{strength:'large',reciprocity:true});
 const one=run([a],[f]);assert.equal(get(one,rel('RIVALRY')).stage,2);
 const opposite=fx(b,rel('RIVALRY','b','a'),2,{reciprocity:true});
 const more=fx(b,rel('RIVALRY'),3);const both=run([a,b],[f,opposite,more]);
 assert.equal(get(both,rel('RIVALRY')).stage,3);assert.equal(get(both,rel('RIVALRY','b','a')).stage,1);
 assert.equal(get(both,rel('RIVALRY')).transitions.at(-1).at[0],2);});
test('received action or fabricated witness is not opposite-direction reciprocity',()=>{
 const c=ch(1),a=fx(c,rel('BOND'),1,{strength:'large',reciprocity:true}),b=fx(c,rel('BOND','b','a'),2,{reciprocity:true});
 const r=run([c],[a,b],{actorWitnesses:[a.witness,{...b.witness,actorPlayerId:'a'}]});
 assert.equal(get(r,rel('BOND')).stage,2);assert.equal(get(r,rel('BOND','b','a')).reciprocityEvents,0);});
test('event-capped movement still permits exactly one independent reciprocity credit',()=>{
 const a=ch(1),b=ch(1,{battle:'m2',game:'g2',battleOrder:2});
 const ee=[fx(a,rel('BOND'),1,{strength:'large',reciprocity:true}),fx(b,rel('BOND'),2,{reciprocity:true})];
 const r=run([a,b],ee);assert.deepEqual(receipts(r,'MOVEMENT').map(x=>x.allocatedUnits),[8,0]);
 assert.equal(receipts(r,'RECIPROCITY').length,1);assert.equal(get(r,rel('BOND')).reciprocityEvents,1);});
test('Reputation Battle budget covers multiple families/overlapping detector facets',()=>{
 const c=ch(1),rs=[fx(c,rep('CRUELTY'),1,{strength:'major',contributionKey:'same'}),
 fx(c,rep('CRUELTY'),2,{strength:'large',contributionKey:'same'}),fx(c,rep('CRUELTY'),3,{strength:'major'})];
 const r=run([c],rs);assert.deepEqual(receipts(r,'MOVEMENT').map(x=>x.allocatedUnits),[8,0]);});
test('positive and negative receipts offset unfinished progress, preserve peaks and allow regression',()=>{
 const c=[1,2,3,4].map(n=>ch(n)),ee=[fx(c[0],rel('HOSTILITY'),1,{strength:'large'}),
 fx(c[1],rel('HOSTILITY'),2,{strength:'large',effect:'WEAKEN'}),fx(c[2],rel('HOSTILITY'),3),
 fx(c[3],rel('HOSTILITY'),4,{strength:'large',effect:'WEAKEN'})];const r=run(c,ee),s=get(r,rel('HOSTILITY'));
 assert.equal(s.peak,2);assert.ok(s.transitions.some(x=>x.kind==='DOWN'));
 assert.ok(s.stage<2);assert.equal(get(r,rel('BOND')),undefined);});
test('directed Hostility cooling and Bond weakening do not affect opposite/other tracks',()=>{
 const c=ch(1),d=ch(2),ee=[fx(c,rel('HOSTILITY','b','a'),1,{strength:'major'}),
 fx(d,rel('HOSTILITY','b','a'),2,{strength:'large',effect:'WEAKEN'}),
 fx(c,rel('BOND'),3,{strength:'major'}),fx(d,rel('BOND'),4,{strength:'large',effect:'WEAKEN'})];const r=run([c,d],ee);
 assert.equal(get(r,rel('HOSTILITY')),undefined);assert.equal(get(r,rel('HOSTILITY','b','a')).stage,0);
 assert.equal(get(r,rel('BOND')).stage,0);});
test('Rivalry protected stage-three floor until explicit attributable skill judgment',()=>{
 const cs=[1,2,3,4].map(n=>ch(n));const ee=[fx(cs[0],rel('RIVALRY'),1,{strength:'large',reciprocity:true}),
 fx(cs[1],rel('RIVALRY','b','a'),2,{reciprocity:true}),fx(cs[1],rel('RIVALRY'),3),
 fx(cs[2],rel('RIVALRY'),4,{strength:'large',effect:'WEAKEN'})];
 const before=run(cs,ee);assert.equal(get(before,rel('RIVALRY')).stage,3);
 const ack={battleId:cs[3].battleId,gameId:cs[3].gameId,eventId:cs[3].eventId,sourceAuthority:A,
 fromPlayerId:'b',toPlayerId:'a',acknowledgedSuperiorPlayerId:'a',qualification:'QUALIFIED',
 explicitStructuredJudgmentRef:{kind:'JUDGMENT',id:'ack',revision:'v1',digest:h('ack')},
 historicalPosition:{leagueOrderKey:cs[3].order.key,gameNumber:1,recordingAtMs:100,operationOrdinal:1,order:'ORDERED'}};
 assert.ok(get(run(cs,ee,{acknowledgments:[ack]}),rel('RIVALRY')).stage<3);});
test('qualified Treachery victim confirmation bypasses reciprocity and consumes Event Hostility capacity first',()=>{
 const c=ch(1),d=ch(2),ordinary=fx(c,rel('HOSTILITY'),1,{strength:'large'});
 const r=run([c],[ordinary],{treachery:[treachery(c,1)]});assert.equal(get(r,rel('HOSTILITY')).stage,3);
 assert.equal(get(r,rel('HOSTILITY','b','a')),undefined);assert.equal(receipts(r,'MOVEMENT')[0].allocatedUnits,4);
 assert.equal(receipts(r,'EXCEPTIONAL_STAGE').length,1);assert.equal(r.consumption[0].allocatedUnits,4);
 assert.equal(get(run([c,d],[ordinary],{treachery:[treachery(c,1),treachery(d,2)]}),rel('HOSTILITY')).stage,4);});
test('Treachery missing king proof, victim judgment or strict resolver is never awarded',()=>{
 const c=ch(1);for(const x of [{victimJudgment:'FAIR_GAME'},{qualifiedByStrictResolver:false},
 {strictGates:{kingLoss:false}},{bindingVictimJudgmentRef:null}]){
 const r=run([c],[],{treachery:[treachery(c,1,x)]});assert.equal(r.receipts.length,0);assert.equal(r.consumption.length,0);}});
test('unqualified order pends only affected direction, not unrelated Reputation',()=>{
 const c=ch(1),a=fx(c,rel('HOSTILITY'),1),b=fx(c,rep('CHIVALRY'),2);a.row.claim.historicalPosition.order='UNKNOWN';
 const r=run([c],[a,b]);assert.equal(get(r,rel('HOSTILITY')).currentStage,null);assert.equal(get(r,rep('CHIVALRY')).stage,1);});
test('withdrawn/corrected evidence rebuilds from active source; retries idempotent',()=>{
 const c=ch(1),e=fx(c,rel('BOND'),1),first=run([c],[e]);assert.equal(get(first,rel('BOND')).stage,1);
 const withdrawn={...c,revision:2,sourceAuthority:B,state:'WITHDRAWN'};
 const changed=run([c,withdrawn],[e]);assert.equal(get(changed,rel('BOND')),undefined);
 assert.equal(changed.receipts.length,0);assert.notEqual(changed.projectionRevision,first.projectionRevision);
 assert.deepEqual(run([c,c],[e,e]),first);
 assert.throws(()=>run([c,{...c,sourceAuthority:B}],[e]),/CONFLICTING_CHAPTER/);
 assert.throws(()=>run([c,{...c,gameId:'pov-copy'}],[e]),/DUPLICATE_POV_GAME/);});
test('non-scoring warmup and two Games share one Reputation Battle budget',()=>{
 const c=ch(1,{battle:'warmup',game:'g1',battleOrder:1}),d=ch(1,{battle:'warmup',game:'g2',battleOrder:1,gameOrder:2});
 const r=run([c,d],[fx(c,rep('GALLANTRY'),1,{strength:'major'}),fx(d,rep('GALLANTRY'),2,{strength:'major'})]);
 assert.deepEqual(receipts(r,'MOVEMENT').map(x=>x.allocatedUnits),[5,3]);});
test('late qualified judgment is evaluated at original Battle position; no submission time used',()=>{
 const a=ch(1),b=ch(2),later=fx(b,rel('HOSTILITY'),1),old=run([a,b],[later]);
 const early=fx(a,rel('HOSTILITY'),2,{strength:'major'});early.row.claim.basis='QUALIFIED_JUDGMENT';
 const next=run([a,b],[later,early]);assert.equal(get(old,rel('HOSTILITY')).stage,1);
 assert.equal(get(next,rel('HOSTILITY')).stage,2);assert.equal(get(next,rel('HOSTILITY')).transitions[0].at[0],1);});
test('unknown family or bad policy cannot mint units, contradictory claim IDs are refused',()=>{
 const c=ch(1),a=fx(c,rel('BOND'),1);a.row.claim.ruleId='TEAMMATE_PRESENCE';
 assert.equal(get(run([c],[a]),rel('BOND')).status,'PENDING');
 const d=ch(1,{battle:'m2',game:'g2',battleOrder:2}),b=fx(d,rel('BOND'),2),duplicate=structuredClone(b);
 duplicate.row.claim.claimId='claim-X';const bad=structuredClone(b);bad.row.claim.claimId='claim-X';bad.row.claim.historicalPosition.recordingAtMs=999;
 assert.throws(()=>run([c,d],[duplicate,bad]),/CONFLICTING_CLAIM_ID/);});


test('identical simultaneous ordinals for independent deeds pend only the affected direction',()=>{
 const c=ch(1),a=fx(c,rel('RIVALRY'),1,{at:10}),b=fx(c,rel('RIVALRY'),2,{at:10});
 b.row.claim.historicalPosition.operationOrdinal=a.row.claim.historicalPosition.operationOrdinal;
 const separate=fx(c,rep('GALLANTRY'),3);
 const r=run([c],[a,b,separate]);
 assert.equal(get(r,rel('RIVALRY')).currentStage,null);
 assert.ok(get(r,rel('RIVALRY')).pendingReasons.includes('AMBIGUOUS_SAME_MOMENT'));
 assert.equal(get(r,rep('GALLANTRY')).stage,1);
});
test('all issued SHARED_1 Receipts satisfy Sol canonical JSON Schema',async()=>{
 const [{readFileSync},{default:Ajv2020}]=await Promise.all([import('node:fs'),import('ajv/dist/2020.js')]);
 const schema=JSON.parse(readFileSync(new URL('../../contracts/social-v1/shared.schema.json',import.meta.url),'utf8'));
 const validate=new Ajv2020({strict:false,allErrors:true}).compile(schema);
 const c=ch(1),d=ch(1,{battle:'m2',game:'g2',battleOrder:2}),e=ch(2,{game:'g3'});
 const inputs=[fx(c,rel('BOND'),1,{strength:'large',reciprocity:true}),fx(d,rel('BOND'),2,{reciprocity:true}),
   fx(e,rel('BOND','b','a'),3,{reciprocity:true}),fx(c,rel('HOSTILITY'),4,{strength:'large'})];
 const r=run([c,d,e],inputs,{treachery:[treachery(c,1)]});
 assert.ok(r.receipts.some(x=>x.kind==='MOVEMENT'&&x.state==='CAPPED'));
 assert.ok(r.receipts.some(x=>x.kind==='RECIPROCITY'));
 assert.ok(r.receipts.some(x=>x.kind==='EXCEPTIONAL_STAGE'));
 for(const receipt of r.receipts)
   assert.ok(validate({contract:'AOF_SOCIAL_V1_SHARED_1',recordType:'Receipt',value:receipt}),
     JSON.stringify({kind:receipt.kind,errors:validate.errors}));
});


test('reused Game ID across distinct Matches keeps both active at equal revisions',()=>{
 const a=ch(1,{battle:'match-A',game:'game-1'});
 const b={...ch(2,{battle:'match-B',game:'game-1',source:B}),gameGuid:h('distinct-guid-B')};
 const x=fx(a,rel('BOND'),201),y=fx(b,rel('BOND'),202);
 const r=run([a,b],[x,y]);
 assert.deepEqual(receipts(r,'MOVEMENT').map(v=>v.allocatedUnits),[2,2]);
 assert.deepEqual(r.audit,[]);
 assert.deepEqual(run([b,a],[y,x]),r);
});

test('unequal Match-scoped revisions and strict lookup never shadow the other Battle',()=>{
 const a=ch(1,{battle:'match-A',game:'game-1'});
 const b={...ch(2,{battle:'match-B',game:'game-1',revision:4,source:B}),gameGuid:h('guid-B')};
 const bond=fx(a,rel('BOND'),211),hostility=fx(b,rel('HOSTILITY'),212);
 const strict=treachery(b,213);
 const first=run([a,b],[bond,hostility],{treachery:[strict]});
 assert.equal(receipts(first,'MOVEMENT').length,2);
 assert.equal(receipts(first,'EXCEPTIONAL_STAGE').length,1);
 assert.equal(get(first,rel('BOND')).stage,1);
 assert.equal(get(first,rel('HOSTILITY')).stage,3);
 const withdrawn={...b,revision:5,sourceAuthority:h('new-source'),state:'WITHDRAWN'};
 const next=run([a,b,withdrawn],[bond,hostility],{treachery:[strict]});
 assert.equal(receipts(next,'MOVEMENT').length,1);
 assert.equal(receipts(next,'EXCEPTIONAL_STAGE').length,0);
 assert.equal(get(next,rel('BOND')).stage,1);
 assert.equal(get(next,rel('HOSTILITY')),undefined);
});

test('same GUID across different Match/Game composites is rejected even if local Game ID matches',()=>{
 const a=ch(1,{battle:'match-A',game:'game-1'});
 const b=ch(2,{battle:'match-B',game:'game-1',revision:2,source:B});
 assert.throws(()=>run([a,b],[fx(a,rep('GALLANTRY'),221)]),/DUPLICATE_POV_GAME/);
});

test('revision change of one Match does not misresolve claim from another sharing Game ID',()=>{
 const a=ch(1,{battle:'match-A',game:'game-1'});
 const b={...ch(2,{battle:'match-B',game:'game-1',source:B}),gameGuid:h('other-source-guid')};
 const x=fx(a,rep('CHIVALRY'),231),y=fx(b,rep('CHIVALRY'),232);
 const revised={...b,revision:2,sourceAuthority:h('revision-source')};
 const r=run([a,b,revised],[x,y]);
 assert.equal(receipts(r,'MOVEMENT').length,1);
 assert.equal(receipts(r,'MOVEMENT')[0].incidentId,x.row.claim.incidentId);
 assert.deepEqual(r.audit,[{claimId:y.row.claim.claimId,reason:'INACTIVE_SOURCE'}]);
});

test('partial chronology protects earlier verified prefix and unrelated subjects',()=>{
 const a=ch(1),b=ch(2),c=ch(3);
 const early=fx(a,rel('HOSTILITY'),241),unknown=fx(b,rel('HOSTILITY'),242),
       late=fx(c,rel('HOSTILITY'),243),separate=fx(c,rep('GALLANTRY'),244);
 unknown.row.claim.historicalPosition.order='PARTIAL';
 const r=run([a,b,c],[early,unknown,late,separate]);
 const s=get(r,rel('HOSTILITY'));
 assert.equal(s.status,'PENDING');assert.equal(s.currentStage,null);
 assert.equal(s.lastVerifiedHistoricalStage,1);assert.equal(s.stage,1);assert.equal(s.peak,1);
 assert.deepEqual(receipts(r,'MOVEMENT').filter(x=>x.subject.system==='RELATIONSHIP').map(x=>x.incidentId),
 [early.row.claim.incidentId]);
 assert.equal(get(r,rep('GALLANTRY')).stage,1);
});

test('unfinished qualified cooling before Treachery is preserved and exceptional jump pends',()=>{
 const cs=[1,2,3,4].map(n=>ch(n));
 const rise=fx(cs[0],rel('HOSTILITY'),251,{strength:'large'});
 const cool=fx(cs[1],rel('HOSTILITY'),252,{effect:'WEAKEN',strength:'large'});
 const later=fx(cs[3],rel('HOSTILITY'),253);
 const r=run(cs,[rise,cool,later,fx(cs[3],rep('CHIVALRY'),254)],{treachery:[treachery(cs[2],255)]});
 const s=get(r,rel('HOSTILITY'));
 assert.equal(s.status,'PENDING');assert.equal(s.currentStage,null);assert.ok(s.downBank>0);
 assert.equal(s.stage,s.lastVerifiedHistoricalStage);
 assert.ok(s.pendingReasons.includes('TREACHERY_PREEXCEPTION_WEAKENING_UNCONFIGURED'));
 assert.equal(receipts(r,'EXCEPTIONAL_STAGE').length,0);
 assert.equal(get(r,rep('CHIVALRY')).stage,1);
 assert.equal(r.consumption.length,1);
});

test('simultaneous ordinary Hostility and Treachery pend only their dependent direction',()=>{
 const c=ch(1),ordinary=fx(c,rel('HOSTILITY'),261,{at:3}),other=fx(c,rep('CRUELTY'),262);
 ordinary.row.claim.historicalPosition.operationOrdinal=100;
 const r=run([c],[ordinary,other],{treachery:[treachery(c,263)]});
 const s=get(r,rel('HOSTILITY'));
 assert.equal(s.status,'PENDING');
 assert.ok(s.pendingReasons.includes('AMBIGUOUS_SAME_MOMENT'));
 assert.equal(s.lastVerifiedHistoricalStage,0);
 assert.equal(receipts(r,'EXCEPTIONAL_STAGE').length,0);
 assert.equal(get(r,rep('CRUELTY')).stage,1);
});

test('Rivalry same-moment weakening and binding skill acknowledgment cannot force regression',()=>{
 const cs=[1,2,3,4].map(n=>ch(n));
 const ee=[fx(cs[0],rel('RIVALRY'),271,{strength:'large',reciprocity:true}),
 fx(cs[1],rel('RIVALRY','b','a'),272,{reciprocity:true}),
 fx(cs[1],rel('RIVALRY'),273),
 fx(cs[2],rel('RIVALRY'),274,{effect:'WEAKEN',strength:'large'})];
 assert.equal(get(run(cs,ee),rel('RIVALRY')).stage,3);
 const late=fx(cs[3],rel('RIVALRY'),275,{effect:'WEAKEN',at:1});
 const ack={battleId:cs[3].battleId,gameId:cs[3].gameId,eventId:cs[3].eventId,
 sourceAuthority:A,fromPlayerId:'b',toPlayerId:'a',
 acknowledgedSuperiorPlayerId:'a',qualification:'QUALIFIED',
 explicitStructuredJudgmentRef:{kind:'JUDGMENT',id:'ack',revision:'v1',digest:h('ack')},
 historicalPosition:{...late.row.claim.historicalPosition}};
 const r=run(cs,[...ee,late],{acknowledgments:[ack]});
 const s=get(r,rel('RIVALRY'));
 assert.equal(s.status,'PENDING');assert.equal(s.currentStage,null);
 assert.ok(s.pendingReasons.includes('AMBIGUOUS_SAME_MOMENT'));
 assert.equal(s.lastVerifiedHistoricalStage,3);
});
