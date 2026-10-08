import test from 'node:test';
import assert from 'node:assert/strict';
import {selectEventShowcase,EVENT_SHOWCASE_CATALOGUE,EVENT_SHOWCASE_METRICS} from '../lib/engines/eventRoundoffShowcase.js';
import {EXPERIENCE_VERSION} from '../lib/engines/statisticsExperience.js';

function fixture(performances=true){
  let serial=0;
  const participants=Array.from({length:8},(_,i)=>({playerId:`p${i}`,team:i<4?1:2}));
  const main={matchId:'M1',eventId:'E1',format:'FOUR_V_FOUR',status:'COMPLETED',scoringAct:'MAIN',acceptedGameIds:['G1'],standardStart:true,participants,result:{revision:2,winningPlayerIds:['p0','p1','p2','p3']}};
  const warmups=Array.from({length:4},(_,i)=>({matchId:`W${i}`,eventId:'E1',format:'ONE_V_ONE',status:'COMPLETED',scoringAct:'WARMUP',acceptedGameIds:['G1'],standardStart:true,participants:participants.slice(i*2,i*2+2).map((p,j)=>({...p,team:j+1})),result:{revision:1,winningPlayerIds:[`p${i*2}`]}}));
  const game=m=>({version:EXPERIENCE_VERSION,matchId:m.matchId,gameId:'G1',seasonId:'S1',eventId:'E1',format:m.format,contextKey:`${m.format} standard`,orderAtMs:Date.parse(m.scoringAct==='MAIN'?'2026-10-24':'2026-10-17'),revision:3,sourceHash:(++serial).toString(16).padStart(64,'0'),eligible:true,exclusionReason:null,affectsSeason:true,affectsLifetime:true,durationMs:m.scoringAct==='MAIN'?3600000:1200000,evidenceTruncated:false,players:m.participants.map(p=>({...p,values:Object.fromEntries([...EVENT_SHOWCASE_METRICS.map(r=>r.id),'greatBattles'].map(id=>[id,['castle','imperial'].includes(id)?null:id==='goldControl'?(m.scoringAct==='MAIN'?10:50):0])),models:Object.fromEntries([...EVENT_SHOWCASE_METRICS.map(r=>r.id),'greatBattles'].map(id=>[id,'QUALIFIED_TEST_V1'])),responseTimes:[]}))});
  const input={eventId:'E1',matches:[main,...warmups],games:[main,...warmups].map(game)};
  if(performances){
    set(input,'M1','p1','raidsOut',22);set(input,'W0','p1','raidsOut',13);
    set(input,'M1','p2','battlesFought',35);set(input,'W1','p2','battlesFought',15);
    set(input,'M1','p3','army20',8100);
    set(input,'M1','p4','farmsPlaced',130);set(input,'W2','p4','farmsPlaced',90);
    set(input,'M1','p5','villagerRequests',250);set(input,'W2','p5','villagerRequests',80);
    set(input,'M1','p6','townCenters',8);set(input,'W3','p6','townCenters',4);
  }
  return input;
}
const player=(i,match,id)=>i.games.find(g=>g.matchId===match).players.find(p=>p.playerId===id);
const set=(i,match,id,metric,value)=>player(i,match,id).values[metric]=value;
const find=(i,metric)=>selectEventShowcase(i).find(c=>c.catalogueId.startsWith(metric+':'));

test('catalogue implements all 64 distinct approved ranks and thresholds',()=>{
  assert.equal(EVENT_SHOWCASE_CATALOGUE.length,64);
  assert.deepEqual(EVENT_SHOWCASE_CATALOGUE.map(r=>r.rank),Array.from({length:64},(_,i)=>i+1));
  assert.equal(new Set(EVENT_SHOWCASE_CATALOGUE.map(r=>r.id)).size,64);
  assert.equal(EVENT_SHOWCASE_CATALOGUE[0].accomplishmentId,'emperor');
  assert.equal(EVENT_SHOWCASE_CATALOGUE[13].threshold,200);
  assert.equal(EVENT_SHOWCASE_CATALOGUE[63].threshold,60);
});
test('five cards prioritize ranks and count both acts rather than only the main Game',()=>{
  const input=fixture(),items=selectEventShowcase(input);
  assert.deepEqual(items.map(c=>c.rank),[5,6,12,14,15]);
  assert.match(items[0].value,/35 detected raids/);assert.match(items[3].value,/220 farm placements/);
  assert.deepEqual(items[3].sources.map(s=>s.matchId),['M1','W2']);
  assert.equal(items[3].sources[0].revision,3);assert.equal(items[3].sources[0].sourceHash,input.games[0].sourceHash);
});
test('all numerical tiers are inclusive, rank exactly, and lower tiers collapse',()=>{
  for(const rule of EVENT_SHOWCASE_METRICS)for(const [t,threshold] of rule.thresholds.entries()){
    const input=fixture(false),main=player(input,'M1','p0'),warm=player(input,'W0','p0');
    main.values[rule.id]=threshold;
    if(rule.aggregation==='GOLD'){main.values.goldControl=threshold*100/8;warm.values.goldControl=threshold*100/2;}
    if(rule.aggregation==='APM')warm.values.apm=threshold;
    if(rule.aggregation==='RESPONSES'){warm.values.response=threshold;main.responseTimes=[threshold,threshold];warm.responseTimes=[threshold];}
    const card=find(input,rule.id);assert.ok(card,`${rule.id} at ${threshold}`);
    assert.equal(card.tier,['NOTABLE','EXCEPTIONAL','EXTRAORDINARY'][t]);
    assert.equal(card.rank,[46,26,4][t]+EVENT_SHOWCASE_METRICS.indexOf(rule));
    assert.equal(selectEventShowcase(input).filter(c=>c.catalogueId.startsWith(rule.id+':')).length,1);
  }
});
test('ranking remains primary even when a player earns several high-ranked distinctions',()=>{
  const input=fixture(false);
  for(const id of ['raidsOut','battlesFought','farmsPlaced','villagerRequests','townCenters'])set(input,'M1','p0',id,1000);
  assert.deepEqual(selectEventShowcase(input).map(c=>c.rank),[5,6,14,15,16]);
  assert.ok(selectEventShowcase(input).every(c=>c.playerIds[0]==='p0'));
});
test('ties share one card with all holders and source Games; order is deterministic',()=>{
  const input=fixture();set(input,'M1','p5','farmsPlaced',220);
  const tied=find(input,'farmsPlaced');assert.deepEqual(tied.playerIds,['p4','p5']);
  const shuffled={...input,matches:[...input.matches].reverse(),games:[...input.games].reverse().map(g=>({...g,players:[...g.players].reverse()}))};
  assert.deepEqual(selectEventShowcase(input),selectEventShowcase(shuffled));
});
test('Emperor recognition is unique, pinned before play and warm-up 1v1-only',()=>{
  const input=fixture(),warm=input.matches.find(m=>m.matchId==='W0');warm.emperorPlayerIdAtApproval='p1';
  assert.equal(selectEventShowcase(input)[0].catalogueId,'emperor:SPECIAL');
  assert.deepEqual(selectEventShowcase(input)[0].playerIds,['p0']);
  for(const mutate of [m=>m.scoringAct='MAIN',m=>m.format='FFA',m=>m.status='DISPUTED',m=>m.result.revision=0,m=>m.result.winningPlayerIds=['p1'],m=>m.result.winningPlayerIds=['p0','p1'],m=>m.emperorPlayerIdAtApproval='outsider',m=>delete m.emperorPlayerIdAtApproval]){
    const copy=structuredClone(input);mutate(copy.matches.find(m=>m.matchId==='W0'));assert.equal(find(copy,'emperor'),undefined);
  }
  input.matches[0].emperorPlayerIdAtApproval='p7';delete warm.emperorPlayerIdAtApproval;assert.equal(find(input,'emperor'),undefined,'a team defeat never creates this distinction');
});
test('unbeaten uses confirmed designated Match results, never inferred points',()=>{
  const input=fixture(false);assert.deepEqual(find(input,'unbeaten').playerIds,['p0','p2']);
  for(const mutate of [i=>i.matches[0].status='DISPUTED',i=>i.matches[0].result.revision=0,i=>i.matches[0].result.winningPlayerIds=['outsider'],i=>i.matches.push({...i.matches[0],matchId:'M2'}),i=>i.matches[0].result.winningPlayerIds=['p1','p3']]){const copy=structuredClone(input);mutate(copy);assert.equal(find(copy,'unbeaten'),undefined);}
});
test('missing, unqualified, duplicate POV and wrong-binding evidence cannot become Event totals',()=>{
  for(const mutate of [i=>i.games=i.games.filter(g=>g.matchId!=='W0'),i=>i.games[0].eligible=false,i=>i.games[0].eventId='other',i=>i.games[0].sourceHash='preview',i=>i.games[0].version='old',i=>i.games[0].revision=0,i=>i.games[0].exclusionReason='disputed',i=>i.games[0].evidenceTruncated=true,i=>i.games.push(structuredClone(i.games[0])),i=>i.games[0].players[0].playerId='outsider',i=>i.games[0].players[0].team=2,i=>i.matches[0].acceptedGameIds=undefined,i=>i.matches[0].acceptedGameIds=['G1','G1'],i=>i.matches[0].status='DISPUTED']){
    const input=fixture(false);set(input,'M1','p0','farmsPlaced',210);set(input,'W0','p0','farmsPlaced',40);mutate(input);assert.equal(find(input,'farmsPlaced'),undefined);
  }
});
test('multiple accepted series Games and other approved Event Matches contribute once each',()=>{
  const input=fixture(false);set(input,'M1','p0','farmsPlaced',70);set(input,'W0','p0','farmsPlaced',30);
  const extra=structuredClone(input.games[0]);extra.gameId='G2';extra.sourceHash='f'.repeat(64);extra.players.find(p=>p.playerId==='p0').values.farmsPlaced=80;
  input.games.push(extra);input.matches[0].acceptedGameIds.push('G2');assert.match(find(input,'farmsPlaced').value,/180 farm placements/);
  const extraMatch=structuredClone(input.matches[1]);extraMatch.matchId='EXTRA';extraMatch.scoringAct=null;input.matches.push(extraMatch);
  const extraGame=structuredClone(input.games[1]);extraGame.matchId='EXTRA';extraGame.sourceHash='e'.repeat(64);extraGame.players[0].values.farmsPlaced=40;input.games.push(extraGame);
  assert.match(find(input,'farmsPlaced').value,/220 farm placements/);assert.equal(find(input,'farmsPlaced').sources.length,4);
});
test('a reused recording bound to a different Game cannot double-count',()=>{
  const input=fixture(false);set(input,'M1','p0','farmsPlaced',210);
  const extra=structuredClone(input.games[0]);extra.gameId='G2';input.games.push(extra);input.matches[0].acceptedGameIds.push('G2');assert.equal(find(input,'farmsPlaced'),undefined);
});
test('null, negative, non-finite and mixed-model totals are unavailable, not zero',()=>{
  for(const value of [null,-1,NaN,Infinity]){const input=fixture(false);set(input,'M1','p0','farmsPlaced',210);set(input,'W0','p0','farmsPlaced',value);assert.equal(find(input,'farmsPlaced'),undefined);}
  for(const model of ['unknown','ILLUSTRATIVE_V3','DIFFERENT_V2']){const input=fixture(false);set(input,'M1','p0','farmsPlaced',210);player(input,'W0','p0').models.farmsPlaced=model;assert.equal(find(input,'farmsPlaced'),undefined);}
  const input=fixture(false);set(input,'M1','p0','farmsPlaced',210);for(const g of input.games)for(const p of g.players)p.models.farmsPlaced='ILLUSTRATIVE_V3';assert.ok(find({...input,illustrative:true},'farmsPlaced'));
});
test('APM uses duration weights from both acts and needs 20 observed minutes in total',()=>{
  const input=fixture(false);set(input,'M1','p0','apm',80);set(input,'W0','p0','apm',120);
  assert.match(find(input,'apm').value,/90\.0 raw APM/);assert.equal(find(input,'apm').tier,'EXCEPTIONAL');
  for(const g of input.games)g.durationMs=500000;assert.equal(find(input,'apm'),undefined);
});
test('gold is normalized for starting player count, weighted across acts and needs an absolute peak',()=>{
  const input=fixture(false);set(input,'M1','p0','goldControl',17.5);set(input,'W0','p0','goldControl',70);
  assert.match(find(input,'goldControl').detail,/1\.40 × equal share/);assert.match(find(input,'goldControl').value,/70\.0% peak influence/);assert.equal(find(input,'goldControl').tier,'EXCEPTIONAL');
  set(input,'M1','p0','goldControl',18);set(input,'W0','p0','goldControl',18);assert.equal(find(input,'goldControl'),undefined);
  set(input,'W0','p0','goldControl',101);assert.equal(find(input,'goldControl'),undefined);
});
test('responses use the pooled median rather than averaging per-Game medians',()=>{
  const input=fixture(false),main=player(input,'M1','p0'),warm=player(input,'W0','p0');
  main.values.response=100;main.responseTimes=[100];warm.values.response=3;warm.responseTimes=[2,3,4];
  assert.match(find(input,'response').value,/3\.5 seconds/);assert.equal(find(input,'response').tier,'EXTRAORDINARY');
  warm.responseTimes=[];assert.equal(find(input,'response'),undefined);
});
test('team-only measures ignore inapplicable duels without inventing allied support',()=>{
  const input=fixture(false);set(input,'M1','p0','assistsOut',6);set(input,'W0','p0','assistsOut',null);
  assert.match(find(input,'assistsOut').value,/6 defensive assists/);assert.equal(find(input,'assistsOut').sources.length,1);
  input.matches[0].participants.forEach((p,i)=>p.team=i+1);input.games[0].players.forEach((p,i)=>p.team=i+1);assert.equal(find(input,'assistsOut'),undefined);
});
test('best timings/checkpoints consider warm-ups and require qualified start and observed coverage',()=>{
  const input=fixture(false);set(input,'W0','p0','castle',780000);set(input,'M1','p0','castle',900000);
  assert.match(find(input,'castle').value,/13:00/);assert.equal(find(input,'castle').sources[0].matchId,'W0');
  input.matches.forEach(m=>m.standardStart=undefined);assert.equal(find(input,'castle'),undefined);
  set(input,'W0','p0','army20',8000);input.games.find(g=>g.matchId==='W0').durationMs=1199999;assert.equal(find(input,'army20'),undefined);
});
test('Great Battle tiers count episodes across Event Games without producing a Notable zero',()=>{
  const input=fixture(false);set(input,'M1','p0','greatBattles',1);assert.equal(find(input,'greatBattles').rank,24);
  set(input,'W0','p0','greatBattles',1);assert.equal(find(input,'greatBattles').rank,3);
});
function history(input,values,season='S1'){
  return values.map((value,i)=>{const g=structuredClone(input.games[0]);g.matchId=`OLD${i}`;g.sourceHash=(900+i).toString(16).padStart(64,'0');g.eventId='OLD';g.seasonId=season;g.orderAtMs=Date.parse('2026-09-01')+i;g.players.forEach(p=>p.values.farmsPlaced=p.playerId==='p0'?value:0);return g;});
}
test('historical records require prior published compatible evidence and strict improvements',()=>{
  const input=fixture(false);set(input,'M1','p0','farmsPlaced',120);
  assert.equal(find(input,'league-record'),undefined,'first measurements do not invent a broken record');
  input.publishedHistory=history(input,[100]);assert.equal(find(input,'league-record').rank,2);assert.equal(find(input,'league-record').sources.some(s=>s.role==='HISTORY'),true);
  input.publishedHistory[0].contextKey='different map';assert.equal(find(input,'league-record'),undefined);
  input.publishedHistory=history(input,[120]);assert.equal(find(input,'league-record'),undefined,'equal values are not broken records');
  input.publishedHistory=history(input,[100]);input.publishedHistory[0].players[0].models.farmsPlaced='DIFFERENT';assert.equal(find(input,'league-record'),undefined);
  input.publishedHistory=history(input,[100]);input.publishedHistory[0].orderAtMs=Date.parse('2026-11-01');assert.equal(find(input,'league-record'),undefined,'future history is excluded');
});
test('Season records and personal bests respect scopes and the three-prior-Game requirement',()=>{
  const input=fixture(false);set(input,'M1','p0','farmsPlaced',120);input.publishedHistory=[...history(input,[150],'S0'),...history(input,[100]).map(g=>({...g,matchId:'CURRENT',sourceHash:'d'.repeat(64)}))];
  assert.equal(find(input,'league-record'),undefined);assert.equal(find(input,'season-record').rank,23);
  input.games[0].affectsSeason=false;input.games[0].affectsLifetime=false;input.publishedHistory=history(input,[90,95]);assert.equal(find(input,'personal-best'),undefined);
  input.publishedHistory=history(input,[90,95,100]);assert.equal(find(input,'personal-best').rank,45);
  set(input,'M1','p0','farmsPlaced',109);assert.equal(find(input,'personal-best'),undefined);
});
test('the shortlist collapses overlapping families, never fills with invented accomplishments',()=>{
  const input=fixture(false);set(input,'M1','p0','army20',8000);set(input,'M1','p0','unitRequests',700);assert.ok(find(input,'army20'));assert.equal(find(input,'unitRequests'),undefined);
  const sparse=fixture(false);sparse.matches.forEach(m=>m.result=null);assert.deepEqual(selectEventShowcase(sparse),[]);
  set(sparse,'M1','p0','farmsPlaced',80);assert.equal(selectEventShowcase(sparse).length,1);
});
test('four eligible families produce exactly four ranked cards',()=>{
  const input=fixture(false);input.matches.forEach(m=>m.result=null);
  for(const [metric,value] of [['raidsOut',35],['battlesFought',50],['farmsPlaced',200],['townCenters',12]])set(input,'M1','p0',metric,value);
  assert.deepEqual(selectEventShowcase(input).map(c=>c.rank),[5,6,14,16]);
});
test('historical gold records use Game percentages rather than an Event-normalized index',()=>{
  const input=fixture(false);set(input,'M1','p0','goldControl',50);
  const prior=history(input,[0]);prior[0].players.forEach(p=>p.values.goldControl=40);input.publishedHistory=prior;
  const card=find(input,'league-record');assert.match(card.value,/50\.0% gold influence/);assert.match(card.detail,/40\.0% gold influence/);assert.doesNotMatch(card.value,/equal share/);
});

test('Battle accomplishments use one accepted Game while the parent series remains active',async()=>{
  const {selectBattleShowcase}=await import('../lib/engines/eventRoundoffShowcase.js');
  const input=fixture(),game=input.games[0],match={...input.matches[0],status:'ACTIVE'};
  const cards=selectBattleShowcase({match,game});
  assert.ok(cards.length>0&&cards.length<=4);
  assert.match(cards.find(card=>card.catalogueId.startsWith('raidsOut:')).value,/22 detected raids/);
  assert.deepEqual(cards.map(card=>card.rank),cards.map(card=>card.rank).sort((a,b)=>a-b));
  assert.ok(cards.every(card=>card.sources.every(source=>source.matchId==='M1'&&source.gameId==='G1')));
  assert.ok(cards.every(card=>!['unbeaten','emperor','league-record','season-record','personal-best'].includes(card.catalogueId.split(':')[0])));
  assert.ok(cards.every(card=>!card.detail.includes('Warm-up and main Games are considered')));
  const standalone=selectBattleShowcase({match:{...match,eventId:null},game:{...game,eventId:null}});
  assert.equal(standalone.length,cards.length);
  const warmGame=input.games[1],warmMatch={...input.matches[1],countedWarmupPlayerIds:[]};
  warmGame.players[0].values.raidsOut=35;
  assert.ok(selectBattleShowcase({match:warmMatch,game:warmGame}).length,'individual Battle distinctions do not require a counted Event warm-up');
});
test('Battle accomplishments reject disputed, unqualified, mismatched or illustrative production evidence',async()=>{
  const {selectBattleShowcase}=await import('../lib/engines/eventRoundoffShowcase.js');
  const input=fixture(),game=input.games[0],match=input.matches[0];
  for(const status of ['DISPUTED','CANCELLED','VOID'])assert.deepEqual(selectBattleShowcase({match:{...match,status},game}),[]);
  assert.deepEqual(selectBattleShowcase({match,game:{...game,eligible:false}}),[]);
  assert.deepEqual(selectBattleShowcase({match,game:{...game,eventId:'OTHER'}}),[]);
  assert.deepEqual(selectBattleShowcase({match:{...match,participants:match.participants.slice(1)},game}),[]);
  assert.deepEqual(selectBattleShowcase({match,game:{...game,sourceHash:'preview-recording'}}),[]);
  assert.ok(selectBattleShowcase({match,game:{...game,sourceHash:'preview-recording'},illustrative:true}).length);
});
