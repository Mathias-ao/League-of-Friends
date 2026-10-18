import test from 'node:test';
import assert from 'node:assert/strict';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';
import {renderDiagnosticWitness} from './upload-diagnostic-render-witness.mjs';

// Controlled render fixtures only; these tests do not establish source authority.
async function fixture(){
 const repo=new PreviewLeagueRepository();await repo.signIn();await repo.requestMembership('Controlled tester','','K7M4Q9');
 const dataset=await repo.statisticsExperience({matchId:'sample-duel'}),game=dataset.games[0];
 const expected={matchId:game.matchId,gameId:game.gameId,sourceSha256:game.sourceHash,revision:game.revision};
 const receipt={state:'READY',matchId:game.matchId,gameId:game.gameId,sourceHash:game.sourceHash,replayStatisticsRevision:game.revision,diagnosticTraceId:'12345678-1234-4123-8123-123456789abc'};
 return {receipt,dataset,expected};
}
test('real BattleStatistics render joins receipt/source attrs and observer JSDOM frame contract without exporting private input',async()=>{
 const input=await fixture(),result=await renderDiagnosticWitness(input);
 assert.equal(result.diagnosticTraceId,input.receipt.diagnosticTraceId);
 assert.equal(result.sourceRevisionRendered,true);assert.equal(result.observerReceiptFrameContractMatched,true);
 assert.equal(result.browserLayoutObserved,false);assert.equal(result.compositorPaintObserved,false);assert.equal(result.p95Established,false);
 for(const [key,value] of Object.entries(result))assert.ok(key==='diagnosticTraceId'?typeof value==='string':typeof value==='boolean');
 const exported=JSON.stringify(result);for(const secret of [input.expected.matchId,input.expected.gameId,input.expected.sourceSha256,...input.dataset.games[0].players.map(p=>p.name)])assert.equal(exported.includes(secret),false);
});
test('a replaced source or revision is refused, not rendered as current evidence',async()=>{
 for(const field of ['sourceSha256','revision'] as const){const input=await fixture();input.expected[field]=field==='revision'?input.expected.revision+1:'f'.repeat(64);await assert.rejects(renderDiagnosticWitness(input),/Source\/revision mismatch/);}
});
test('ambiguous Game and unissued/invalid UUID fail without leaking payloads',async()=>{
 const input=await fixture();input.dataset.games.push(input.dataset.games[0]);await assert.rejects(renderDiagnosticWitness(input),/ambiguous authenticated Game/);
 const invalid=await fixture();invalid.receipt.diagnosticTraceId='private-token';await assert.rejects(renderDiagnosticWitness(invalid),/Missing opaque receipt UUID/);
});
