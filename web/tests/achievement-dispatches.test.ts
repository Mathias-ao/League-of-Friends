import test from 'node:test';
import assert from 'node:assert/strict';
import {honoursSeenKey,markHonoursViewed,reconcileHonourNotices} from '../src/domain/achievementNotices';
import {chronicleActionNotices,honourActionNotices,recordingActionNotices} from '../src/domain/frontPageNoticeExtras';
import {frontPageNotices} from '../src/domain/frontPageNotices';
import {emptySnapshot,type AchievementSummary,type LeagueSnapshot,type MatchDetail} from '../src/domain/league';
import type {PrivateChronicleInvitations} from '../src/domain/privateChronicleInteractions';

const first:AchievementSummary={awardId:'a-1',name:'First Ascent',description:'Castle',firstAwardedAt:'2026-11-09T10:00:00.000Z'};
const second:AchievementSummary={awardId:'a-2',name:'Veteran',description:'Four Battles',firstAwardedAt:'2026-11-09T11:00:00.000Z'};
const snapshot=():LeagueSnapshot=>({...emptySnapshot(),membership:'ACTIVE',enteredSeason:true,
  viewer:{playerId:'owner',steamName:'Owner'},season:{seasonId:'s1',name:'Season I',status:'ACTIVE'},
  events:[{eventId:'e1',seasonId:'s1',title:'A testing Event',status:'ACTIVE'}],matches:[
    {matchId:'m1',seasonId:'s1',eventId:'e1',status:'COMPLETED',format:'ONE_V_ONE',
      participants:[{playerId:'owner',steamName:'Owner'},{playerId:'other',steamName:'Other'}]}
  ]});
const detail=():MatchDetail=>({
  match:snapshot().matches[0],
  viewer:{playerId:'owner',isParticipant:true},
  games:[{gameId:'G1',gameNumber:1,status:'COMPLETED',players:[],result:{revision:1,winningPlayerIds:['owner']},
    resultDisputeOpen:false,replay:{statisticsId:null,statisticsState:null}}]
});
test('first owner cabinet establishes a quiet baseline; only later verified awards notify once',()=>{
  const fresh=reconcileHonourNotices([first],null);
  assert.deepEqual(fresh.unseen,[]);
  assert.ok(fresh.initialSeen);
  const later=reconcileHonourNotices([first,second],fresh.initialSeen);
  assert.deepEqual(later.unseen.map(a=>a.awardId),['a-2']);
  assert.deepEqual(honourActionNotices(later.unseen).map(a=>a.kind),['recognition']);
  const seen=markHonoursViewed([first,second],fresh.initialSeen);
  assert.deepEqual(reconcileHonourNotices([first,second],seen).unseen,[]);
  assert.deepEqual(reconcileHonourNotices([first],fresh.initialSeen).unseen,[],'revocation must not invent an achievement');
  assert.notEqual(honoursSeenKey('owner'),honoursSeenKey('other'),'browser receipt is per owner');
  assert.deepEqual(reconcileHonourNotices([second],'{}').unseen,[],'corrupt storage cannot flood history');
  assert.deepEqual(reconcileHonourNotices([{...second,firstAwardedAt:null}],fresh.initialSeen).unseen,[],
    'unversioned or undated legacy rows cannot advertise a newly earned title');
});
test('only a finished Game with an official result and no active source has a red recording action',()=>{
  const s=snapshot(),d=detail();
  assert.deepEqual(recordingActionNotices(s,[d]).map(n=>n.id),['recording:m1:G1']);
  assert.equal(frontPageNotices(s,Date.now(),recordingActionNotices(s,[d]))[0].kind,'recording');
  assert.deepEqual(recordingActionNotices({...s,matches:[{...s.matches[0],status:'AWAITING_CONFIRMATION'}]},[d]),[],
    'result review owns the notice until the Battle is officially complete');
  assert.deepEqual(recordingActionNotices(s,[{...d,games:[{...d.games[0],status:'READY'}]}]),[],
    'an unplayed Game cannot be treated as a missing recording');
  assert.deepEqual(recordingActionNotices(s,[{...d,games:[{...d.games[0],result:null}]}]),[]);
  for(const state of ['PENDING','PROCESSING','READY','UPLOADING']){
    assert.deepEqual(recordingActionNotices(s,[{...d,games:[{...d.games[0],
      replay:{statisticsId:null,statisticsState:state}}]}]),[],state);
  }
  assert.deepEqual(recordingActionNotices(s,[{...d,games:[{...d.games[0],
    replay:{statisticsId:'source-hash',statisticsState:'READY'}}]}]),[]);
  assert.deepEqual(recordingActionNotices(s,[{...d,viewer:{playerId:'other',isParticipant:true}}]),[],
    'other member/previous account cannot be treated as the signed-in owner');
  assert.deepEqual(recordingActionNotices(s,[{...d,games:[{...d.games[0],resultDisputeOpen:true}]}]),[]);
  assert.deepEqual(recordingActionNotices({...s,events:[{...s.events[0],status:'CANCELLED'}]},[d]),[]);
});
test('rare private perspective is an owner-only emulator dispatch, not a public social claim',()=>{
  const s=snapshot(),invitation={slotId:'slot',battleId:'m1',respondentPlayerId:'owner',revision:1,
    state:'OFFERED',opportunityRevision:'current-revision',family:'DEFENSIVE_HELP',
    counterpartPlayerId:'other',questionContext:'Moment',choices:['UNDECIDED','ASSISTANCE'],
    sourceCurrent:true,context:{version:'AOF_CHRONICLE_INVITATION_CONTEXT_V1',
      status:'CURRENT_GAME_ONLY',battleId:'m1',gameId:'G1',opportunityRevision:'current-revision',
      gameNumber:1,incidentAccount:null,recordingAtMs:null,missing:[]},
    speaker:null,effects:{relationshipDelta:null,officialWrites:false,negativeForSilence:false}
  } as const;
  const v:PrivateChronicleInvitations={version:'AOF_CHRONICLE_INTERACTIONS_V1E',visibility:'OWNER_ONLY',
    ownerPlayerId:'owner',invitations:[invitation],officialEffects:[],
    narratorAuthority:'FACTUAL_SOURCE_ONLY',testOnly:true};
  assert.equal(chronicleActionNotices(s,v).length,1);
  for(const altered of [{...v,ownerPlayerId:'other'},{...v,testOnly:false},
    {...v,invitations:[{...invitation,state:'DECLINED' as const}]},
    {...v,invitations:[{...invitation,state:'DEFERRED' as const}]},
    {...v,invitations:[{...invitation,sourceCurrent:false}]},
    {...v,invitations:[{...invitation,respondentPlayerId:'other'}]}]){
    assert.deepEqual(chronicleActionNotices(s,altered as PrivateChronicleInvitations),[]);
  }
});
