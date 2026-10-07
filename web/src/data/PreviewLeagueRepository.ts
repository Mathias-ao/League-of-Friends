import {LeagueEvent,type LeagueRepository,type LeagueSnapshot,type EventDetail,type MatchDetail,type PlayerProfile,type EmperorsFavorBatch,type ReplayUploadResult,type ReplayStatisticsResult,type SocialHistoryResponse,type PlayerChronicleResponse,type PlayerChronicleRelationshipPage} from '../domain/league';
import {lombardia} from './content';
import {illustrativeGame} from './statisticsFixtures';
import {previewRelationshipData} from './relationshipPreview';
import {EXPERIENCE_VERSION,type StatisticsScope,type StatisticsDataset} from '../domain/statistics';
/** Explicitly illustrative and memory-only. Never mutates real league data. */
export class PreviewLeagueRepository implements LeagueRepository {
  readonly mode='preview' as const;
  private listeners=new Set<()=>void>();
  private state:LeagueSnapshot={
    membership:'SIGNED_OUT',viewer:null,enteredSeason:false,hasLeagueHistory:false,season:{seasonId:'S001',name:'The Fiefdom of Bad Neighbors',status:'ACTIVE',currentEmperorPlayerId:'sample-you'},
    emperor:{playerId:'sample-you',steamName:'D’Karius',leaguePoints:27,wins:6,losses:4},
    standings:[
      {playerId:'sample-ragnar',steamName:'Ragnar',leaguePoints:41,rank:1,wins:14,losses:3},
      {playerId:'sample-steve',steamName:'Steve',leaguePoints:35,rank:2,wins:10,losses:6},
      {playerId:'sample-baguette',steamName:'Lord Baguette',leaguePoints:31,rank:3,wins:9,losses:7},
      {playerId:'sample-lancelot',steamName:'Sir Lancelot',leaguePoints:29,rank:4,wins:8,losses:8},
      {playerId:'sample-mbl',steamName:'MBL',leaguePoints:19,rank:5,wins:6,losses:9}
    ],players:[],matches:[],
    events:[{eventId:'E001',seasonId:'S001',title:lombardia.display.title,description:lombardia.story.homepageTeaser,status:'PUBLISHED',startsAt:null,maxParticipants:8,confirmedCount:5,waitingListCount:0,competitionStyle:'BIG_TEAM',viewer:{rsvp:'UNANSWERED',signupState:'NONE',attendanceStatus:'NOT_CHECKED'}}]
  };
  constructor(){
    this.state.players=[...this.state.standings,...(this.state.emperor?[this.state.emperor]:[])];
    this.state.matches=[
      {matchId:'sample-duel',seasonId:'S001',format:'ONE_V_ONE',status:'COMPLETED',completedAt:'2026-09-06T18:00:00Z',participants:[{...this.state.emperor!,team:1},{...this.state.players[0],team:2}],result:{winningPlayerIds:['sample-ragnar'],revision:1}},
      {matchId:'sample-team',seasonId:'S001',format:'TWO_V_TWO',status:'COMPLETED',completedAt:'2026-09-08T18:00:00Z',participants:this.state.players.slice(0,4).map((p,i)=>({...p,team:i<2?1:2})),result:{winningPlayerIds:['sample-ragnar','sample-steve'],revision:1}}
    ];
    this.state.events.push({eventId:'preview-campaign',seasonId:'S001',title:'Lombardia · illustrative campaign',status:'COMPLETED',startsAt:'2026-09-10T18:00:00Z'});
    for(let index=0;index<8;index++)this.state.matches.push({matchId:`preview-battle-${index+1}`,seasonId:'S001',eventId:'preview-campaign',format:'TWO_V_TWO',status:'COMPLETED',completedAt:`2026-09-${String(10+index).padStart(2,'0')}T18:00:00Z`,participants:[this.state.players[0],this.state.players[1],this.state.players[2],this.state.emperor!].map((p,i)=>({...p,team:i<2?1:2,slot:i+1})),result:{winningPlayerIds:index%2?['sample-baguette','sample-you']:['sample-ragnar','sample-steve'],revision:1}});
  }
  async load(){return structuredClone(this.state);}
  async signIn(){  this.state.membership='UNLINKED';  this.state.viewer=null;  this.listeners.forEach(fn=>fn());}
  async signOut(){this.state.membership='SIGNED_OUT';this.state.viewer=null;this.listeners.forEach(fn=>fn());}
  async requestMembership(name:string,_discord:string,favor:string){  if(favor.replace(/[\s-]+/g,'').toUpperCase()!=='K7M4Q9'){    throw new Error("That Emperor's Favor is invalid or has already been invoked.");}  this.state.membership='ACTIVE';  this.state.viewer={    ...this.state.emperor!,    steamName:name,    role:'ADMIN'  };}
  async generateEmperorsFavors(  batchName:string,  count:number):Promise<EmperorsFavorBatch>{  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  const code=()=>Array.from(    {length:6},    ()=>alphabet[      crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length    ]  ).join('');  return {    batchId:'preview-batch',    batchName,    count,
    favors:Array.from({length:count},(_,i)=>({
      code:code(),
      emperor:['AUGUSTUS','TRAIANUS','HADRIANUS'][i%3],
      serialNumber:i+1,
      total:count,
      printLabel:(i+1)+' / '+count
    }))
  };
}
  async enterSeason(){if(this.state.membership!=='ACTIVE')throw new Error('Join the league first.');this.state.enteredSeason=true;this.state.hasLeagueHistory=true;}
  async rsvp(id:string,value:'YES'|'NO'){
    if(this.state.membership!=='ACTIVE'||value==='YES'&&!this.state.enteredSeason)throw new Error('Enter the season first.');
    const e=this.state.events.find(e=>e.eventId===id);if(!e||!new LeagueEvent(e).canRsvp())throw new Error('Sign-ups are closed.');
    const was=e.viewer?.rsvp==='YES';e.confirmedCount=(e.confirmedCount??0)+(value==='YES'?1:0)-(was?1:0);
    e.viewer={rsvp:value,signupState:value==='YES'?'CONFIRMED':'NONE',attendanceStatus:'NOT_CHECKED'};
  }
  async checkIn(id:string){const e=this.state.events.find(e=>e.eventId===id);if(!e||!new LeagueEvent(e).canCheckIn())throw new Error('Check-in is not open.');e.viewer!.attendanceStatus='CHECKED_IN';}
  async formEventMatches(){throw new Error('Match-plan formation is available in live Events.');}
  async ensureCivilizationDraft(){throw new Error('Civilization drafting is available in live Matches.');}
  async pickCivilization(){throw new Error('Civilization drafting is available in live Matches.');}
  async resetCivilizationDraft(){throw new Error('Civilization draft administration is available in live Matches.');}
  async uploadReplay():Promise<ReplayUploadResult>{throw new Error('Replay upload is available in live Matches.');}
  async replayStatistics():Promise<ReplayStatisticsResult>{throw new Error('Replay statistics are available in live Matches.');}
  async statisticsExperience(scope:StatisticsScope):Promise<StatisticsDataset>{
    if(this.state.membership!=='ACTIVE')throw new Error('Join the league to view statistics.');
    return {version:EXPERIENCE_VERSION,unavailableGames:0,games:this.state.matches.filter(m=>(!scope.matchId||m.matchId===scope.matchId)&&(!scope.eventId||m.eventId===scope.eventId)&&(!scope.seasonId||m.seasonId===scope.seasonId)).map(m=>illustrativeGame(m,m.matchId.startsWith('preview-battle-')?Number(m.matchId.slice('preview-battle-'.length))-1:['sample-duel','sample-team'].indexOf(m.matchId),this.state.players))};
  }
  async socialHistory():Promise<SocialHistoryResponse>{
    const owner=this.state.viewer?.playerId;
    if(!owner)throw new Error('Join the league to open your Chronicle.');
    const names=Object.fromEntries(this.state.players.map(player=>[player.playerId,player.steamName]));
    const pages:PlayerChronicleRelationshipPage[]=[];
    const page=(counterpartPlayerId:string,entries:PlayerChronicleRelationshipPage['entries'],tracks:PlayerChronicleRelationshipPage['relationship']['tracks']={})=>{
      pages.push({
        pairId:[owner,counterpartPlayerId].sort().join('|'),
        counterpartPlayerId,
        relationship:{sourceModelVersion:'AOF_SOCIAL_HISTORY_V1',shadow:true,tracks},
        exposure:{gameIds:[],battleIds:[...new Set(entries.map(entry=>entry.battleId))],contexts:[],lastOrder:null},
        entries
      });
    };
    if(owner==='sample-you'){
      page('sample-ragnar',[
        {
          entryId:'preview-chronicle-ragnar-duel',battleId:'sample-duel',eventId:null,seasonId:'S001',playedAtMs:Date.parse('2026-09-06T18:00:00Z'),
          rubric:'OFFICIAL DUEL',title:'First contest',
          paragraphs:['Their first shared page placed D’Karius and Ragnar on opposite sides of the field. They met in an official duel and carried it through to an accepted result.'],
          sourceBeatIds:['preview-duel-contest'],sourceEventIds:['preview-official-result'],evidenceKinds:['ACCEPTED_DUEL_CONTEST'],
          relationshipMarks:[{track:'RIVALRY',actorPlayerId:'sample-you',family:'ACCEPTED_DUEL_CONTEST',units:1,exception:null},{track:'RIVALRY',actorPlayerId:'sample-ragnar',family:'ACCEPTED_DUEL_CONTEST',units:1,exception:null}],
          reputationMarks:[],exposureContext:'OPPOSED'
        }
      ],{RIVALRY:{currentStage:1,historicalPeak:1,battleIds:['sample-duel'],directedActors:['sample-you','sample-ragnar']}});
      page('sample-baguette',[
        {
          entryId:'preview-chronicle-baguette-first',battleId:'preview-battle-1',eventId:'preview-campaign',seasonId:'S001',playedAtMs:Date.parse('2026-09-10T18:00:00Z'),
          rubric:'FIRST RECORD',title:'First recorded meeting',
          paragraphs:['Their first shared page found D’Karius and Lord Baguette beneath the same banner.'],
          sourceBeatIds:[],sourceEventIds:[],evidenceKinds:[],relationshipMarks:[],reputationMarks:[],exposureContext:'LOCKED_TEAMMATES'
        },
        {
          entryId:'preview-chronicle-baguette-support',battleId:'preview-battle-3',eventId:'preview-campaign',seasonId:'S001',playedAtMs:Date.parse('2026-09-12T18:00:00Z'),
          rubric:'SUPPORT RECORDED',title:'A hand in the defence',
          paragraphs:['When the fighting gathered around Lord Baguette, D’Karius joined the defensive episode beside him. Whether it changed the outcome is not written here.'],
          sourceBeatIds:['preview-support-beat'],sourceEventIds:['preview-support-command'],evidenceKinds:['SUPPORT_PARTICIPATION'],
          relationshipMarks:[{track:'BOND',actorPlayerId:'sample-you',family:'PROTECTIVE_PARTICIPATION',units:1,exception:null}],
          reputationMarks:[],exposureContext:'LOCKED_TEAMMATES'
        },
        {
          entryId:'preview-chronicle-baguette-common-target',battleId:'preview-battle-8',eventId:'preview-campaign',seasonId:'S001',playedAtMs:Date.parse('2026-09-17T18:00:00Z'),
          rubric:'COMMON TARGET',title:'Against the same foe',
          paragraphs:['In the same engagement, D’Karius and Lord Baguette both took part against Ragnar. Whether by design or circumstance, the page does not say. It joined a cooperative pattern already taking shape between them.'],
          sourceBeatIds:['preview-shared-beat'],sourceEventIds:['preview-shared-a','preview-shared-b'],evidenceKinds:['SHARED_PARTICIPATION'],
          relationshipMarks:[{track:'BOND',actorPlayerId:'sample-you',family:'SHARED_PARTICIPATION',units:1,exception:null},{track:'BOND',actorPlayerId:'sample-baguette',family:'SHARED_PARTICIPATION',units:1,exception:null}],
          reputationMarks:[],exposureContext:'LOCKED_TEAMMATES'
        }
      ],{BOND:{currentStage:2,historicalPeak:2,battleIds:['preview-battle-3','preview-battle-8'],directedActors:['sample-you','sample-baguette']}});
      page('sample-steve',[
        {
          entryId:'preview-chronicle-steve-first',battleId:'preview-battle-1',eventId:'preview-campaign',seasonId:'S001',playedAtMs:Date.parse('2026-09-10T18:00:00Z'),
          rubric:'FIRST RECORD',title:'First recorded meeting',
          paragraphs:['Their first shared page placed D’Karius and Steve on opposite sides of the field. Nothing more was written between them that day.'],
          sourceBeatIds:[],sourceEventIds:[],evidenceKinds:[],relationshipMarks:[],reputationMarks:[],exposureContext:'OPPOSED'
        }
      ]);
    }
    return {
      success:true,status:'AVAILABLE',
      chronicle:{modelVersion:'AOF_PLAYER_CHRONICLE_V2',ownerPlayerId:owner,status:'AVAILABLE',pages,
        reputation:{sourceModelVersion:'AOF_SOCIAL_HISTORY_V1',shadow:true,tracks:{}},
        policy:{relationshipAndReputationStagesAreShadow:true,proseUsesQualifiedSocialEvidence:true,coPresenceCreatesOnlyFirstRecord:true}},
      names,excluded:[],coverage:{completedBattles:this.state.matches.filter(match=>match.status==='COMPLETED').length,readableAcceptedGames:pages.reduce((sum,p)=>sum+p.entries.length,0),excludedGames:0,stageMeaning:'illustrative_shadow_preview',opportunityCompleteness:false}
    };
  }
  async playerChronicle():Promise<PlayerChronicleResponse>{
    const result=await this.socialHistory();
    return {
      success:true,status:result.status,names:result.names,coverage:{completedBattles:result.coverage.completedBattles,readableAcceptedGames:result.coverage.readableAcceptedGames,excludedGames:result.coverage.excludedGames,opportunityCompleteness:result.coverage.opportunityCompleteness},
      chronicle:{
        modelVersion:result.chronicle.modelVersion,ownerPlayerId:result.chronicle.ownerPlayerId,status:result.chronicle.status,
        pages:result.chronicle.pages.map(page=>({
          pairId:page.pairId,counterpartPlayerId:page.counterpartPlayerId,
          entries:page.entries.map(entry=>({
            entryId:entry.entryId,battleId:entry.battleId,eventId:entry.eventId,seasonId:entry.seasonId,playedAtMs:entry.playedAtMs,
            rubric:entry.rubric,title:entry.title,paragraphs:entry.paragraphs
          }))
        })),
        policy:{proseUsesQualifiedSocialEvidence:true,coPresenceCreatesOnlyFirstRecord:true}
      }
    };
  }
  watchCivilizationDraft(){return ()=>{};}
  async event(id:string):Promise<EventDetail>{
    const e=this.state.events.find(e=>e.eventId===id);if(!e)throw new Error('Event not found.');
    return structuredClone({event:e,viewer:{playerId:this.state.viewer?.playerId??'',role:this.state.viewer?.role??'PLAYER',...e.viewer!},signup:{confirmedCount:e.confirmedCount??0,waitingListCount:0,rosterVisible:true,confirmed:this.state.players.filter(p=>p.playerId!=='sample-you'||e.viewer?.rsvp==='YES')},matches:this.state.matches.filter(m=>m.eventId===id)});
  }
  async match(id:string):Promise<MatchDetail>{
    const m=this.state.matches.find(m=>m.matchId===id);if(!m)throw new Error('Battle not found.');
    return structuredClone({match:m,viewer:{playerId:this.state.viewer?.playerId??'',isParticipant:m.participants.some(p=>p.playerId===this.state.viewer?.playerId)},games:[{gameId:'sample-game-1',gameNumber:1,status:m.status,players:m.participants.map(p=>({...p,civilization:null})),result:m.result?{revision:m.result.revision??1,winningPlayerIds:m.result.winningPlayerIds??[]}:null,resultDisputeOpen:m.status==='DISPUTED'}]});
  }
  async player(id:string):Promise<PlayerProfile>{
    const p=this.state.players.find(p=>p.playerId===id);if(!p)throw new Error('Player not found.');
    const social=previewRelationshipData(id,this.state.players,this.state.matches);
    const isOwner=id===this.state.viewer?.playerId;
    const achievements=isOwner?[
      {awardId:'preview-award-1',achievementId:'FIRST_BLOODLESS_FEUD',name:'First Rivalry',description:'Established a recurring contest across recorded Battles.'},
      {awardId:'preview-award-2',achievementId:'FIELD_COMPANION',name:'Field Companion',description:'Recorded repeated qualified cooperative participation.'}
    ]:[];
    const records=isOwner?[{code:'FASTEST_CASTLE_AGE',direction:'LOW',unit:'seconds',value:1002,holders:[{playerId:id,value:1002,matchId:'preview-battle-4'}]}]:[];
    return {player:p,lifetime:{competition:null,recordsHeld:records},activeSeason:{leaguePoints:p.leaguePoints??0,competition:{matchesPlayed:(p.wins??0)+(p.losses??0),matchesWon:p.wins??0,matchesLost:p.losses??0},recordsHeld:records},achievements,achievementCollection:isOwner?achievements:undefined,chronicleShowcase:isOwner?{selectedRecords:records}:undefined,opponents:social.opponents,teammates:social.teammates,relationships:social.relationships};
  }
  async dispute(id:string,gameId:string,category:string,reason:string){
    const m=this.state.matches.find(m=>m.matchId===id);
    if(!m||gameId!=='sample-game-1'||!m.participants.some(p=>p.playerId===this.state.viewer?.playerId))throw new Error('Only a participant may dispute this result.');
    if(m.status!=='COMPLETED'||!reason.trim()||reason.length>1000||!['WRONG_RESULT','WRONG_REPLAY','PLAYER_MISMATCH','OTHER'].includes(category))throw new Error('A completed Game and valid reason are required.');
    m.status='DISPUTED';
  }
  onAuthChange(callback:()=>void){this.listeners.add(callback);return ()=>{this.listeners.delete(callback);};}
}
