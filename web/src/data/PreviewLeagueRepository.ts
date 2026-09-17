import {LeagueEvent,type LeagueRepository,type LeagueSnapshot,type EventDetail,type MatchDetail,type PlayerProfile} from '../domain/league';
import {lombardia} from './content';
/** Explicitly illustrative and memory-only. Never mutates real league data. */
export class PreviewLeagueRepository implements LeagueRepository {
  readonly mode='preview' as const;
  private listeners=new Set<()=>void>();
  private state:LeagueSnapshot={
    membership:'SIGNED_OUT',viewer:null,enteredSeason:false,hasLeagueHistory:false,season:{seasonId:'S001',name:'The Fiefdom of Bad Neighbors',status:'ACTIVE'},
    standings:[
      {playerId:'sample-ragnar',steamName:'Ragnar',leaguePoints:41,rank:1,wins:14,losses:3},
      {playerId:'sample-steve',steamName:'Steve',leaguePoints:35,rank:2,wins:10,losses:6},
      {playerId:'sample-baguette',steamName:'Lord Baguette',leaguePoints:31,rank:3,wins:9,losses:7},
      {playerId:'sample-lancelot',steamName:'Sir Lancelot',leaguePoints:29,rank:4,wins:8,losses:8},
      {playerId:'sample-you',steamName:'D’Karius',leaguePoints:27,rank:5,wins:6,losses:4},
      {playerId:'sample-mbl',steamName:'MBL',leaguePoints:19,rank:6,wins:6,losses:9}
    ],players:[],matches:[],
    events:[{eventId:'E001',seasonId:'S001',title:lombardia.display.title,description:lombardia.story.homepageTeaser,status:'PUBLISHED',startsAt:null,maxParticipants:8,confirmedCount:5,waitingListCount:0,competitionStyle:'BIG_TEAM',viewer:{rsvp:'UNANSWERED',signupState:'NONE',attendanceStatus:'NOT_CHECKED'}}]
  };
  constructor(){
    this.state.players=[...this.state.standings];
    this.state.matches=[
      {matchId:'sample-duel',seasonId:'S001',format:'ONE_V_ONE',status:'COMPLETED',completedAt:'2026-09-06T18:00:00Z',participants:[{...this.state.players[4],team:1},{...this.state.players[0],team:2}],result:{winningPlayerIds:['sample-ragnar'],revision:1}},
      {matchId:'sample-team',seasonId:'S001',format:'TWO_V_TWO',status:'COMPLETED',completedAt:'2026-09-08T18:00:00Z',participants:this.state.players.slice(0,4).map((p,i)=>({...p,team:i<2?1:2})),result:{winningPlayerIds:['sample-ragnar','sample-steve'],revision:1}}
    ];
  }
  async load(){return structuredClone(this.state);}
  async signIn(){this.state.membership='ACTIVE';this.state.viewer=this.state.players[4];this.listeners.forEach(fn=>fn());}
  async signOut(){this.state.membership='SIGNED_OUT';this.state.viewer=null;this.listeners.forEach(fn=>fn());}
  async requestMembership(name:string){this.state.membership='ACTIVE';this.state.viewer={playerId:'sample-you',steamName:name};}
  async enterSeason(){if(this.state.membership!=='ACTIVE')throw new Error('Join the league first.');this.state.enteredSeason=true;this.state.hasLeagueHistory=true;}
  async rsvp(id:string,value:'YES'|'NO'){
    if(this.state.membership!=='ACTIVE'||value==='YES'&&!this.state.enteredSeason)throw new Error('Enter the season first.');
    const e=this.state.events.find(e=>e.eventId===id);if(!e||!new LeagueEvent(e).canRsvp())throw new Error('Sign-ups are closed.');
    const was=e.viewer?.rsvp==='YES';e.confirmedCount=(e.confirmedCount??0)+(value==='YES'?1:0)-(was?1:0);
    e.viewer={rsvp:value,signupState:value==='YES'?'CONFIRMED':'NONE',attendanceStatus:'NOT_CHECKED'};
  }
  async checkIn(id:string){const e=this.state.events.find(e=>e.eventId===id);if(!e||!new LeagueEvent(e).canCheckIn())throw new Error('Check-in is not open.');e.viewer!.attendanceStatus='CHECKED_IN';}
  async event(id:string):Promise<EventDetail>{
    const e=this.state.events.find(e=>e.eventId===id);if(!e)throw new Error('Event not found.');
    return structuredClone({event:e,viewer:e.viewer!,signup:{confirmedCount:e.confirmedCount??0,waitingListCount:0,rosterVisible:true,confirmed:this.state.players.filter(p=>p.playerId!=='sample-you'||e.viewer?.rsvp==='YES')},matches:[]});
  }
  async match(id:string):Promise<MatchDetail>{
    const m=this.state.matches.find(m=>m.matchId===id);if(!m)throw new Error('Battle not found.');
    return structuredClone({match:m,viewer:{playerId:this.state.viewer?.playerId??'',isParticipant:m.participants.some(p=>p.playerId===this.state.viewer?.playerId)},games:[{gameId:'sample-game-1',gameNumber:1,status:m.status,players:m.participants.map(p=>({...p,civilization:null})),result:m.result?{revision:m.result.revision??1,winningPlayerIds:m.result.winningPlayerIds??[]}:null,resultDisputeOpen:m.status==='DISPUTED'}]});
  }
  async player(id:string):Promise<PlayerProfile>{
    const p=this.state.players.find(p=>p.playerId===id);if(!p)throw new Error('Player not found.');
    return {player:p,lifetime:{competition:null},activeSeason:{leaguePoints:p.leaguePoints??0,competition:{matchesPlayed:(p.wins??0)+(p.losses??0),matchesWon:p.wins??0,matchesLost:p.losses??0}},achievements:[],opponents:[],teammates:[]};
  }
  async dispute(id:string,gameId:string,category:string,reason:string){
    const m=this.state.matches.find(m=>m.matchId===id);
    if(!m||gameId!=='sample-game-1'||!m.participants.some(p=>p.playerId===this.state.viewer?.playerId))throw new Error('Only a participant may dispute this result.');
    if(m.status!=='COMPLETED'||!reason.trim()||reason.length>1000||!['WRONG_RESULT','WRONG_REPLAY','PLAYER_MISMATCH','OTHER'].includes(category))throw new Error('A completed Game and valid reason are required.');
    m.status='DISPUTED';
  }
  onAuthChange(callback:()=>void){this.listeners.add(callback);return ()=>{this.listeners.delete(callback);};}
}
