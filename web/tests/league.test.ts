import test from 'node:test';
import assert from 'node:assert/strict';
import {canBrowseLeague,LeagueEvent,LeagueService,RelationshipPolicy} from '../src/domain/league';
import {PreviewLeagueRepository} from '../src/data/PreviewLeagueRepository';

test('league, season and event entry are distinct; repeat RSVP does not double count',async()=>{
  const repo=new PreviewLeagueRepository(),service=new LeagueService(repo),original=await repo.load();
  await assert.rejects(service.rsvp(original,'E001','YES'),/Join the league/);
  await repo.signIn();
  await assert.rejects(service.rsvp(await repo.load(),'E001','YES'),/Enter this season/);
  await repo.enterSeason();
  await service.rsvp(await repo.load(),'E001','YES');
  await service.rsvp(await repo.load(),'E001','YES');
  assert.equal((await repo.load()).events[0].confirmedCount,original.events[0].confirmedCount!+1);
  await repo.rsvp('E001','NO');
  assert.equal((await repo.event('E001')).signup.confirmed?.length,original.events[0].confirmedCount);
});
test('brand-new players are gated until season entry, while established players retain browsing access',async()=>{
  const repo=new PreviewLeagueRepository();
  assert.equal(canBrowseLeague(await repo.load()),false);
  await repo.signIn();
  const newPlayer=await repo.load();
  assert.equal(newPlayer.hasLeagueHistory,false);
  assert.equal(canBrowseLeague(newPlayer),false);
  await repo.enterSeason();
  const entered=await repo.load();
  assert.equal(entered.enteredSeason,true);
  assert.equal(entered.hasLeagueHistory,true);
  assert.equal(canBrowseLeague(entered),true);
  assert.equal(canBrowseLeague({...entered,enteredSeason:false,hasLeagueHistory:true}),true);
  assert.equal(canBrowseLeague({...entered,membership:'SIGNED_OUT'}),false);
});
test('preview state is isolated and no replay upload is falsely implemented',async()=>{
  const repo=new PreviewLeagueRepository();await repo.signIn();await repo.enterSeason();
  const data=await repo.load();data.events[0].confirmedCount=999;
  assert.notEqual((await repo.load()).events[0].confirmedCount,999);
  assert.equal((await new PreviewLeagueRepository().load()).enteredSeason,false);
  assert.equal('uploadReplay' in repo,false);
});
test('check-in requires confirmed RSVP and an explicit open window',()=>{
  const now=Date.parse('2026-09-20T16:00:00Z');
  const e={eventId:'e',title:'Event',status:'PUBLISHED',startsAt:null,viewer:{rsvp:'YES',signupState:'CONFIRMED',attendanceStatus:'NOT_CHECKED'}};
  assert.equal(new LeagueEvent(e).canCheckIn(now),false);
  assert.equal(new LeagueEvent({...e,checkInOpensAt:'2026-09-20T15:00:00Z',checkInClosesAt:'2026-09-20T17:00:00Z'}).canCheckIn(now),true);
  assert.equal(new LeagueEvent({...e,viewer:{...e.viewer,signupState:'WAITING_LIST'},checkInOpensAt:'2026-09-20T15:00:00Z'}).canCheckIn(now),false);
  assert.equal(new LeagueEvent({...e,checkInOpensAt:'2026-09-20T15:00:00Z',checkInClosesAt:'2026-09-20T15:59:00Z'}).canCheckIn(now),false);
});
test('countdown respects 72-hour and 24-hour boundaries without a fabricated date',()=>{
  const now=Date.parse('2026-09-14T00:00:00Z');
  const event=(hours:number)=>new LeagueEvent({eventId:'e',title:'E',status:'PUBLISHED',startsAt:new Date(now+hours*3600000).toISOString()});
  assert.equal(event(96).countdown(now),'4 DAYS');
  assert.equal(event(72).countdown(now),'3 DAYS · 0 HOURS');
  assert.equal(event(24).countdown(now),'1 DAY · 0 HOURS');
  assert.equal(event(18.5).countdown(now),'18 HOURS · 30 MINUTES');
  assert.equal(new LeagueEvent({eventId:'e',title:'E',status:'PUBLISHED',startsAt:null}).countdown(now),'DATE TO BE ANNOUNCED');
});
test('legacy or unqualified relationship scores never open the War Room',()=>{
  assert.equal(RelationshipPolicy.canUnlock(null),false);
  assert.equal(RelationshipPolicy.canUnlock({model:'legacy',qualified:true,rivalryStage:8,enemyStage:8}),false);
  assert.equal(RelationshipPolicy.canUnlock({model:'AOF_RELATIONSHIPS_V1',qualified:false,rivalryStage:3,enemyStage:0}),false);
  assert.equal(RelationshipPolicy.canUnlock({model:'AOF_RELATIONSHIPS_V1',qualified:true,rivalryStage:2,enemyStage:3}),true);
});
test('a dispute is limited to a participant and sets correction-review state',async()=>{
  const repo=new PreviewLeagueRepository();
  await assert.rejects(repo.dispute('sample-duel','sample-game-1','WRONG_RESULT','Wrong winner'),/participant/);
  await repo.signIn();await repo.dispute('sample-duel','sample-game-1','WRONG_RESULT','Wrong winner');
  const detail=await repo.match('sample-duel');
  assert.equal(detail.games[0].resultDisputeOpen,true);assert.equal(detail.match.status,'DISPUTED');
  await assert.rejects(repo.dispute('sample-duel','sample-game-1','WRONG_RESULT','Wrong winner'),/completed/);
});
test('sign-out removes viewer identity and unsubscribed observers are not called',async()=>{
  const repo=new PreviewLeagueRepository();let count=0;
  const stop=repo.onAuthChange(()=>count++);
  await repo.signIn();await repo.signOut();
  assert.equal((await repo.load()).viewer,null);assert.equal((await repo.load()).membership,'SIGNED_OUT');
  stop();await repo.signIn();assert.equal(count,2);
});
