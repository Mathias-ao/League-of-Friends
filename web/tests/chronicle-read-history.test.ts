import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {migrateChronicleSeen,chronicleEntryKey} from '../src/domain/chronicleReadHistory';
import type {PlayerChronicleBookEntry} from '../src/domain/league';
const fixture=JSON.parse(readFileSync(new URL('../../functions/tests/fixtures/chronicle-scene-handoff-v1.json',import.meta.url),'utf8'));
const entry=(mod:Partial<PlayerChronicleBookEntry>={}):PlayerChronicleBookEntry=>({entryId:fixture.legacyEntryId,sceneId:fixture.sceneId,
 battleId:fixture.battleId,eventId:'e',seasonId:'s',playedAtMs:1000,rubric:'RECORD',title:'Recorded',paragraphs:['Factual.'],...mod});

test('deployed seen IDs migrate to stable scenes despite corrected beats; no old value is discarded',()=>{
 const corrected=entry({entryId:fixture.legacyEntryId.replace(':help',':corrected-help'),sceneRevision:'new'});
 const stored=[fixture.legacyEntryId,'withdrawn-old-scene','unrelated-bookmark-value'];
 const r=migrateChronicleSeen(JSON.stringify(stored),[corrected],fixture.ownerPlayerId,fixture.counterpartPlayerId);
 assert.equal(r.fresh.size,0);assert.ok(r.storedIds.includes(fixture.sceneId));
 for(const id of stored)assert.ok(r.storedIds.includes(id));
 const next=migrateChronicleSeen(JSON.stringify(r.storedIds),[entry({entryId:'changed-again'})],fixture.ownerPlayerId,fixture.counterpartPlayerId);
 assert.equal(next.fresh.size,0);
});
test('owner/pair/Battle prefixes do not credit other history; actual unseen scenes remain new',()=>{
 for(const wrong of ['AOF_PLAYER_CHRONICLE_V1:other:b:battle-1:help','AOF_PLAYER_CHRONICLE_V1:a:other:battle-1:help',
  'AOF_PLAYER_CHRONICLE_V1:a:b:battle-10:help']){
  const r=migrateChronicleSeen(JSON.stringify([wrong]),[entry()],fixture.ownerPlayerId,fixture.counterpartPlayerId);
  assert.deepEqual([...r.fresh],[fixture.sceneId]);
 }
 const r=migrateChronicleSeen('[]',[entry()],fixture.ownerPlayerId,fixture.counterpartPlayerId);
 assert.deepEqual([...r.fresh],[fixture.sceneId]);
});
test('first visit and legacy-only server stay compatible; withdrawals and repeats retain read history',()=>{
 const first=migrateChronicleSeen(null,[entry()],fixture.ownerPlayerId,fixture.counterpartPlayerId);assert.equal(first.fresh.size,0);
 const hidden=migrateChronicleSeen(JSON.stringify(first.storedIds),[],fixture.ownerPlayerId,fixture.counterpartPlayerId);
 assert.deepEqual(hidden.storedIds,first.storedIds);
 assert.equal(migrateChronicleSeen(JSON.stringify(hidden.storedIds),[entry()],fixture.ownerPlayerId,fixture.counterpartPlayerId).fresh.size,0);
 assert.equal(chronicleEntryKey(entry({sceneId:undefined})),fixture.legacyEntryId);
 assert.throws(()=>migrateChronicleSeen('bad-json',[entry()],'a','b'));
});
