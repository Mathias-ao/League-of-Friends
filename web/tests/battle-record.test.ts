import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {renderToStaticMarkup} from 'react-dom/server';
import {BattleRecord,BattleRecordContent} from '../src/ui/BattleRecord';
import {recordingReviewExamples} from '../src/data/recordingReviewExamples';

const render=(props:any)=>renderToStaticMarkup(React.createElement(BattleRecordContent,props));
test('real team example retains exact allies, target and helper direction with abbreviated provenance',()=>{
  const audit=recordingReviewExamples.find(x=>x.id==='4v4')!;
  const before=JSON.stringify(audit);const html=render({audit});
  assert.ok(html.includes('Separate from the illustrative Battle'));
  assert.ok(html.includes('helper → recipient'));
  const support=audit.ledgerSamples.ALLIED_SUPPORT[0].facets[0];
  assert.ok(html.includes('Recording player '+support.fromPlayerId+' → Recording player '+support.toPlayerId));
  const shared=audit.ledgerSamples.SHARED_OFFENSIVE_PARTICIPATION[0].facets[0];
  assert.ok(html.includes(shared.contributions.map(c=>'Recording player '+c.contributorPlayerId).join(' + ')+' → Recording player '+shared.targetPlayerId));
  assert.ok(html.includes('Local overlap'));assert.ok(html.includes('Targeted command'));
  assert.ok(html.includes('Samples are not a complete ledger'));
  assert.equal(JSON.stringify(audit),before);
});
test('replay winners are ignored and current official correction determines displayed outcome',()=>{
  const raw={matchFacts:{result:{winnerPlayerIds:[1]}}};
  const players=[{playerId:'a',steamName:'Alice'},{playerId:'b',steamName:'Bob'}];
  const officialOutcome={qualification:'OFFICIAL',winnerPlayerIds:['b'],loserPlayerIds:['a'],resultRevision:3};
  const html=render({statistics:raw,players,officialOutcome});
  assert.ok(html.includes('Winners: Bob'));assert.ok(html.includes('Non-winning players: Alice'));assert.ok(html.includes('revision 3'));
  const disputed=render({statistics:raw,players,officialOutcome:{...officialOutcome,qualification:'UNRESOLVED'}});
  assert.ok(disputed.includes('Unresolved here'));assert.ok(!disputed.includes('Winners:'));
});
test('zero, false, unavailable context and no-team FFA do not manufacture absence or alliances',()=>{
  const html=render({audit:recordingReviewExamples.find(x=>x.id==='ffa')});
  assert.ok(html.includes('Missing episodes do not establish peacefulness'));
  assert.ok(html.includes('They do not establish alliances'));
  assert.ok(html.includes('No episodes recorded'));
  assert.ok(html.includes('<dd>No</dd>'));
  const legacy=render({statistics:{}});
  assert.ok(legacy.includes('Recording context is unavailable'));assert.ok(legacy.includes('Social evidence is unavailable'));
});
test('live names use recording slots rather than treating canonical IDs as league IDs',()=>{
  const facts={modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',players:[{playerId:2,replaySlot:5}],map:{},game:{},rules:{population:{value:0},lockTeams:{value:false}},lobbyGroups:[{lobbyTeamIdRaw:1,memberPlayerIds:[2]}]};
  const html=render({statistics:{matchFacts:facts},mapping:[{replaySlot:5,playerId:'league-a',sourceName:'Recorder name'}],players:[{playerId:'league-a',steamName:'League name'}]});
  assert.ok(html.includes('Recorded group 1: League name'));assert.ok(html.includes('<dd>0</dd>'));assert.ok(html.includes('<dd>No</dd>'));
});

test('record loads on expansion, retries failures and ignores a superseded Game response',async()=>{
  const dom=new JSDOM('<div id="record"></div>',{url:'http://localhost/'});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('record')!);
  const pending:{gameId:string;resolve:(v:any)=>void;reject:(v:any)=>void}[]=[];
  const repository={replayStatistics:(_match:string,gameId:string)=>new Promise((resolve,reject)=>pending.push({gameId,resolve,reject}))} as any;
  const props={repository,matchId:'m',gameId:'g1',players:[],preview:false,revision:'1'};
  const response=(name:string)=>({statistics:{matchFacts:{modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',map:{mapName:name}}}});
  try{
    await act(async()=>root.render(React.createElement(BattleRecord,props)));assert.equal(pending.length,0);
    await act(async()=>{const details=document.querySelector('details')!;details.open=true;details.dispatchEvent(new dom.window.Event('toggle'));});assert.equal(pending.length,1);
    await act(async()=>root.render(React.createElement(BattleRecord,{...props,gameId:'g2'})));assert.equal(pending.length,2);
    await act(async()=>pending[0].resolve(response('Old map')));assert.ok(!document.body.textContent!.includes('Old map'));
    await act(async()=>pending[1].reject(new Error('Read failed')));assert.ok(document.querySelector('[role="alert"]'));
    await act(async()=>(document.querySelector('button') as HTMLElement).click());assert.equal(pending.length,3);
    await act(async()=>pending[2].resolve(response('Current map')));assert.ok(document.body.textContent!.includes('Current map'));
  }finally{await act(async()=>root.unmount());dom.window.close();}
});

test('diplomacy orders retain direction, tied chronology, raw zero and unqualified state',()=>{
  const facts={modelVersion:'AOF_RECORDING_MATCH_FACTS_V1',diplomacy:{commandTimelines:{'2->1':[
    {replaySlot:2,targetReplaySlot:1,atMs:1000,operationOrdinal:2,diplomacyMode:3,sourceEventId:'later-order'},
    {replaySlot:2,targetReplaySlot:1,atMs:1000,operationOrdinal:1,diplomacyMode:0,sourceEventId:'first-order'}
  ]}}};
  const html=render({statistics:{matchFacts:facts}});
  assert.ok(html.includes('Recording player 2 → Recording player 1'));
  assert.ok(html.includes('requested mode ID 0'));assert.ok(html.indexOf('first-order')<html.indexOf('later-order'));
  assert.ok(html.includes('An order alone does not prove that an alliance changed'));
});

test('rebuild review labels its counterfactual baseline and preserves unavailable versus zero',()=>{
  const html=render({audit:recordingReviewExamples.find(x=>x.id==='4v4')});
  assert.ok(html.includes('Team-lock rebuild comparison'));
  assert.ok(html.includes('not a comparison with deployed league statistics'));
  assert.ok(html.includes('<td>Unavailable</td>'));assert.ok(html.includes('<td>0</td>'));
  assert.ok(html.includes('Active statistics were not replaced'));
  assert.ok(html.includes('defensiveAssistsReceived'));
});

test('alliance review exposes command uncertainty without presenting requested allies as effective allies',()=>{
  const diplomacyReview={status:'REVIEW_AVAILABLE',commandCount:1,normalizedInitialEdgeCount:2,rawInitialVectorCount:2,
    knownPairSegmentCount:1,unknownPairSegmentCount:1,timeline:{changes:[{eventId:'dip',atMs:1000,fromPlayerId:1,
      toPlayerId:2,commandedStance:'ALLY',effectiveStanceAfter:'UNKNOWN',effectiveStateInvalidated:true}]}};
  const html=render({statistics:{},diplomacyReview});
  assert.ok(html.includes('requested ALLY'));assert.ok(html.includes('effective stance UNKNOWN'));
  assert.ok(html.includes('previous certainty ends here'));assert.ok(html.includes('Unknown does not mean neutral'));
  assert.ok(!html.includes('effective stance ALLY'));
});

test('audited FFA previews retain actual command histories and unavailable effective state',()=>{
  for(const [id,count] of [['ffa',143],['townbell-ffa',86]] as const){
    const audit=recordingReviewExamples.find(x=>x.id===id)!;
    const html=render({audit});assert.ok(html.includes(count+' recorded diplomacy orders'));
    assert.ok(html.includes('0 qualified pair intervals'));
    assert.ok(html.includes('effective stance UNKNOWN'));assert.ok(!html.includes('effective stance ALLY'));
    assert.equal(audit.diplomacyReview.timeline.changes.length,count);
    assert.ok(audit.diplomacyReview.timeline.changes.every(row=>!row.effectiveStateChanged));
  }
});

test('declared history presents reciprocal orders and withdrawal without claiming betrayal or effective alliance',()=>{
 const diplomacyReview={status:'REVIEW_AVAILABLE',timeline:{changes:[]},declaredHistory:{modelVersion:'AOF_DECLARED_DIPLOMACY_HISTORY_V1',
   counters:{directedEdgesObserved:2,recordedStanceReversals:1,repeatedRequests:4,reciprocalAllyDeclarationEstablishments:1},
   turningPoints:[{beatId:'beat',moment:{atMs:1000},fromPlayerId:1,toPlayerId:2,previousDeclaration:'ALLY',declarationAfter:'ENEMY',
     allyDeclarationWithdrawn:true,previousReciprocalAllyDeclarations:true,sourceEventId:'order'}]}};
 const html=render({statistics:{},diplomacyReview});
 assert.ok(html.includes('Recorded diplomacy history'));assert.ok(html.includes('withdrew an earlier Ally declaration'));
 assert.ok(html.includes('turning points are not additional social deeds'));assert.ok(html.includes('not Treachery'));
 assert.ok(html.includes('do not prove an effective alliance'));
});

test('unsupported diplomacy mode is a coverage gap rather than a chosen Unknown stance',()=>{
 const html=render({statistics:{},diplomacyReview:{declaredHistory:{modelVersion:'AOF_DECLARED_DIPLOMACY_HISTORY_V1',
   counters:{},turningPoints:[{moment:{atMs:1000},fromPlayerId:1,toPlayerId:2,previousDeclaration:'ALLY',declarationAfter:'UNKNOWN'}]}}});
 assert.ok(html.includes('Unrecognized diplomacy mode; declaration becomes unavailable'));
 assert.ok(!html.includes('Changed declaration from ALLY to UNKNOWN'));
});
