import test from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
import {memoryFirestore} from './support/memory-firestore.mjs';
import {adminGetSeasonSetup} from '../lib/queries/adminGetSeasonSetup.js';
import {adminCreateSeason} from '../lib/commands/seasons/createSeason.js';
import {adminActivateSeason} from '../lib/commands/seasons/activateSeason.js';
const req=(data={},uid='admin')=>({auth:uid?{uid}:undefined,data});
function fixture(){return memoryFirestore(['admin','player'].flatMap(id=>[
  ['authLinks/'+id,{playerId:id}],['players/'+id,{membershipStatus:'ACTIVE',role:id==='admin'?'ADMIN':'PLAYER'}]
]));}
test('authenticated administrator without any Season can read, create and activate through the existing audited lifecycle',async()=>{
  const records=fixture();
  assert.deepEqual(await adminGetSeasonSetup.run(req()),{schemaVersion:'AOF_SEASON_ADMINISTRATION_1',activeSeasonId:null,seasons:[]});
  const input={requestId:'create-season-release',name:'Next campaign',startsAt:'2099-01-01T00:00:00Z',endsAt:'2099-02-01T00:00:00Z'};
  const created=await adminCreateSeason.run(req(input));assert.equal(created.status,'DRAFT');
  const read=await adminGetSeasonSetup.run(req());assert.equal(read.seasons[0].seasonId,created.seasonId);
  await assert.rejects(()=>adminCreateSeason.run(req({...input,requestId:'overlap'})),/overlap/);
  await adminActivateSeason.run(req({seasonId:created.seasonId,requestId:'activate-season-release'}));
  assert.equal(records.get('leagueState/singleton').activeSeasonId,created.seasonId);
  assert.equal(records.get('seasons/'+created.seasonId).warRoom.status,'CLOSED');
  assert.equal([...records].filter(([p])=>p.startsWith('adminAudit/')).length,2);
  await assert.rejects(()=>adminActivateSeason.run(req({seasonId:created.seasonId,requestId:'repeat-activate'})),/draft or upcoming/);
});
test('ordinary, anonymous, suspended and forged-role callers cannot read or invoke Season administration',async()=>{
  const records=fixture();
  for(const command of [adminGetSeasonSetup,adminCreateSeason,adminActivateSeason]){
    await assert.rejects(()=>command.run(req({},'player')),e=>e.code==='permission-denied');
    await assert.rejects(()=>command.run(req({},null)),e=>e.code==='unauthenticated');
  }
  await assert.rejects(()=>adminGetSeasonSetup.run(req({role:'ADMIN'})),e=>e.code==='invalid-argument');
  records.set('players/admin',{membershipStatus:'SUSPENDED',role:'ADMIN'});
  await assert.rejects(()=>adminGetSeasonSetup.run(req()),e=>e.code==='permission-denied');
});
test('setup is complete or fails closed at the bounded read limit; immutable historical dates survive',async()=>{
  const records=fixture(),start=Timestamp.fromDate(new Date('2020-01-01T00:00Z'));
  records.set('seasons/history',{name:'History',status:'COMPLETED',startsAt:start,endsAt:start});
  assert.equal((await adminGetSeasonSetup.run(req())).seasons[0].startsAt,'2020-01-01T00:00:00.000Z');
  for(let i=0;i<100;i++)records.set('seasons/s'+i,{status:'DRAFT'});
  await assert.rejects(()=>adminGetSeasonSetup.run(req()),e=>e.code==='resource-exhausted');
  assert.equal(records.get('seasons/history').startsAt,start);
});
