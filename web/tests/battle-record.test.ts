import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BattleRecordContent} from '../src/ui/BattleRecord';
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
