import assert from 'node:assert/strict';
import test from 'node:test';
import { militaryReviewData } from '../public/military-review.js';
import fs from 'node:fs';
import vm from 'node:vm';

test('one aligned raw queue summary retains IDs, classes and signed amounts without mutating evidence', () => {
  const original = { composition: { infantry: 4, rawUnitQueueSummary: {
    93: 'Spearman · class infantry · +4 / -1', 7: 'Skirmisher · class archers · +2 / -0',
  } } };
  const result = militaryReviewData(original);
  assert.equal(result.composition.rawUnitQueueSummary,
    'ID 7: Skirmisher · class archers · +2 / -0\nID 93: Spearman · class infantry · +4 / -1');
  assert.equal(original.composition.rawUnitQueueSummary[93], 'Spearman · class infantry · +4 / -1');
  assert.equal(result.composition.infantry, 4);
});

test('empty summary explicitly means no observed military queue, rather than a blank cell', () => {
  assert.equal(militaryReviewData({ composition: { rawUnitQueueSummary: {} } })
    .composition.rawUnitQueueSummary, 'None observed');
});

test('military matrix renders one summary row and hides unattached control columns', () => {
  const source = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const functions = source.slice(source.indexOf('const TECHNICAL_ROW_KEYS'), source.indexOf('function executionControlMatrix'));
  const context = vm.createContext({ militaryReviewData, MILITARY_TOWNBELL_MAP: {},
    ECONOMY_TOWNBELL_MAP: {}, esc: value => String(value ?? ''), fmtTime: String });
  vm.runInContext(functions, context);
  const input = { statistics: { participants: [{ playerId: 1, displayName: 'Player',
    military: { composition: { rawUnitQueueSummary: { 93: 'Spearman +2' } } } }] } };
  const html = context.militaryControlMatrix(input);
  assert.equal((html.match(/Raw Unit Queue Summary/g) || []).length, 1);
  assert.match(html, /ID 93: Spearman \+2/);
  assert.doesNotMatch(html, /<th>[^<]*TownBell/);
  const attached = context.militaryControlMatrix({ ...input, townBellControl: { players: [] } });
  assert.match(attached, /<th>[^<]*TownBell/);
});

test('review labels describe queue requests and detected episodes without rewriting metric keys',()=>{
  const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('function humanizeKey'),source.indexOf('function summarizeRowObject'));
  const context=vm.createContext({});vm.runInContext(code,context);
  for(const [key,label] of [['militaryUnitsTrained','Military Units Queued'],['villagersTrained','Villagers Queued'],['housesBuilt','House Placements'],['battlesFought','Detected Battles'],['uniqueRelicsTouched','Known Relics Targeted']])assert.equal(context.humanizeKey(key),label);
  assert.equal(context.humanizeKey('sourceEventId'),'Source Event Id');
});
