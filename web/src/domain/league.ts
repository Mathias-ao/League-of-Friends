export type Page = 'season' | 'events' | 'battles' | 'players' | 'war-room' | 'statistics';
export type Membership = 'SIGNED_OUT' | 'UNLINKED' | 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export interface PlayerRecord { playerId:string; steamName:string; avatarUrl?:string|null; role?:'PLAYER'|'ADMIN'; currentPowerRating?:number|null; provisionalRating?:boolean; leaguePoints?:number; rank?:number; wins?:number|null; losses?:number|null; }
export class Player {
  constructor(readonly record:PlayerRecord) {}
  get id(){return this.record.playerId;}
  get name(){return this.record.steamName;}
  get initials(){return this.name.replace(/[^\p{L}\p{N} ]/gu,'').split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase();}
}
export interface EventRecord {
  eventId:string; title:string; description?:string; seasonId?:string|null; status:string; startsAt:string|null; endsAt?:string|null;
  signupDeadlineAt?:string|null; checkInOpensAt?:string|null; checkInClosesAt?:string|null; maxParticipants?:number|null;
  confirmedCount?:number; waitingListCount?:number; competitionStyle?:string|null;
  viewer?:{rsvp:string;signupState:string;attendanceStatus:string}; roster?:PlayerRecord[]|null;
}
export class LeagueEvent {
  constructor(readonly record:EventRecord) {}
  get id(){return this.record.eventId;}
  countdown(now=Date.now()){
    if(!this.record.startsAt)return 'DATE TO BE ANNOUNCED';
    const remaining=Date.parse(this.record.startsAt)-now;
    if(!Number.isFinite(remaining))return 'DATE TO BE ANNOUNCED';
    if(remaining<=0)return this.record.status==='COMPLETED'?'COMPLETE':'EVENT DAY';
    const minutes=Math.ceil(remaining/60000),hours=Math.floor(minutes/60),days=Math.floor(hours/24);
    const count=(n:number,unit:string)=>String(n)+' '+unit+(n===1?'':'S');
    if(remaining>72*3600000)return count(days,'DAY');
    if(remaining>=24*3600000)return count(days,'DAY')+' · '+count(hours%24,'HOUR');
    return count(hours,'HOUR')+' · '+count(minutes%60,'MINUTE');
  }
  canRsvp(now=Date.now()){return ['PUBLISHED','ACTIVE'].includes(this.record.status)&&(!this.record.signupDeadlineAt||Date.parse(this.record.signupDeadlineAt)>=now);}
  canCheckIn(now=Date.now()){
    const e=this.record;
    return ['PUBLISHED','ACTIVE'].includes(e.status)&&e.viewer?.rsvp==='YES'&&e.viewer.signupState==='CONFIRMED'&&e.viewer.attendanceStatus!=='CHECKED_IN'&&!!e.checkInOpensAt&&Date.parse(e.checkInOpensAt)<=now&&(!e.checkInClosesAt||Date.parse(e.checkInClosesAt)>=now);
  }
}
export interface MatchRecord {matchId:string;eventId?:string|null;seasonId?:string|null;format:string|null;status:string;draftRequired?:boolean;completedAt?:string|null;seriesRule?:{maxGames:number;gamesRequiredToWin:number};participants:(PlayerRecord&{team?:number|null;slot?:number})[];result?:{winningPlayerIds?:string[];revision?:number;winners?:PlayerRecord[]}|null;}
export interface CivilizationDraftTurnRecord {index:number;playerId:string;team:number|null;slot:number;status:'PENDING'|'COMPLETED';civilization:string|null;}
export interface CivilizationDraftSelectionRecord {turnIndex:number;playerId:string;team:number|null;civilization:string;}
export interface CivilizationDraftRecord {
  draftId:string;ruleVersion:'AOF_CIV_DRAFT_V1';status:'ACTIVE'|'COMPLETED'|'VOID';revision:number;stateVersion:number;gameNumber:number;
  turnOrder:'RANDOM'|'SLOT'|'TEAM_INTERLEAVED'|'TEAM_SNAKE';reusePolicy:'RESET_EACH_GAME'|'PLAYER_UNIQUE_IN_MATCH'|'TEAM_UNIQUE_IN_MATCH'|'MATCH_UNIQUE';
  uniqueWithinGame:boolean;pool:string[];available:string[];viewerAvailable:string[];currentTurnIndex:number|null;
  turns:CivilizationDraftTurnRecord[];selections:CivilizationDraftSelectionRecord[];viewerCanPick:boolean;
}
export interface ReplayPlayerMapping {replaySlot:number;sourceName:string;playerId:string;}
export interface ReplayUploadResult {success:boolean;alreadyProcessed:boolean;matchId:string;gameId:string;statisticsId:string;sourceHash:string;playerMapping:ReplayPlayerMapping[];resultQualification:string;replayStatisticsRevision?:number;}
export interface ReplayStatisticsResult {success:boolean;matchId:string;gameId:string;statisticsId:string;playerMapping:ReplayPlayerMapping[];resultQualification:string;statistics:any;}
export interface GameRecord {gameId:string;gameNumber:number;status:string;players:(PlayerRecord&{team?:number|null;slot?:number;civilization?:string|null})[];draftRequired?:boolean;draft?:CivilizationDraftRecord|null;result:{revision:number;winningPlayerIds:string[]}|null;resultDisputeOpen:boolean;replay?:{rawStatsState?:string|null;analysisState?:string|null;statisticsId?:string|null;statisticsState?:string|null;statisticsRevision?:number|null};}
export interface MatchDetail {match:MatchRecord;games:GameRecord[];viewer:{playerId:string;isParticipant:boolean};}
export interface EventDetail {event:EventRecord;viewer:{playerId:string;role?:'PLAYER'|'ADMIN';rsvp:string;signupState:string;attendanceStatus:string};signup:{confirmedCount:number;waitingListCount:number;rosterVisible:boolean;confirmed:PlayerRecord[]|null};matches:MatchRecord[];}
export interface Competition {matchesPlayed:number;matchesWon:number;matchesLost:number;}
export interface PlayerProfile {player:PlayerRecord&{membershipStatus?:string;goldBalance?:number};lifetime:{competition:Competition|null};activeSeason:{competition:Competition|null;leaguePoints:number}|null;achievements:{awardId:string;name:string;description:string}[];opponents:{player:PlayerRecord;matchesTogether:number;wins:number;losses:number}[];teammates:{player:PlayerRecord;matchesTogether:number;wins:number;losses:number}[];}
export interface EmperorsFavorPrintable {  code:string;  emperor:string;  serialNumber:number;  total:number;  printLabel:string;}
export interface EmperorsFavorBatch {  batchId:string;  batchName:string;  count:number;  favors:EmperorsFavorPrintable[];}
export interface LeagueSnapshot {membership:Membership;viewer:PlayerRecord|null;season:{seasonId:string;name:string;status:string;currentEmperorPlayerId?:string|null}|null;emperor:PlayerRecord|null;enteredSeason:boolean;hasLeagueHistory:boolean;standings:PlayerRecord[];players:PlayerRecord[];events:EventRecord[];matches:MatchRecord[];}
export const emptySnapshot=():LeagueSnapshot=>({membership:'SIGNED_OUT',viewer:null,season:null,emperor:null,enteredSeason:false,hasLeagueHistory:false,standings:[],players:[],events:[],matches:[]});
export const OPEN_BATTLE_STATUSES=['READY','ACTIVE','AWAITING_CONFIRMATION'] as const;
export function isBattleOpen(status:string|null|undefined){
  return OPEN_BATTLE_STATUSES.includes((status??'') as typeof OPEN_BATTLE_STATUSES[number]);
}
export function currentLeagueEvent(snapshot:Pick<LeagueSnapshot,'viewer'|'events'|'matches'>,now=Date.now()){
  const viewerId=snapshot.viewer?.playerId;
  const currentBattle=viewerId?snapshot.matches.find(match=>
    !!match.eventId
    && isBattleOpen(match.status)
    && match.participants.some(player=>player.playerId===viewerId)
    && snapshot.events.some(event=>event.eventId===match.eventId&&event.status!=='COMPLETED')
  ):null;
  if(currentBattle?.eventId){
    const event=snapshot.events.find(candidate=>candidate.eventId===currentBattle.eventId);
    if(event)return event;
  }
  return snapshot.events.find(event=>event.status==='ACTIVE')
    ??snapshot.events.find(event=>event.status==='PUBLISHED'&&(!event.startsAt||Date.parse(event.startsAt)>=now));
}
export function canBrowseLeague(snapshot:Pick<LeagueSnapshot,'membership'|'enteredSeason'|'hasLeagueHistory'>){
  return snapshot.membership==='ACTIVE'&&(snapshot.enteredSeason||snapshot.hasLeagueHistory);
}
export interface LeagueRepository {
  readonly mode:'preview'|'live';

  load():Promise<LeagueSnapshot>;
  signIn():Promise<void>;
  signOut():Promise<void>;

  requestMembership(
    steamName:string,
    discordName:string,
    favor:string
  ):Promise<void>;

  generateEmperorsFavors(
    batchName:string,
    count:number
  ):Promise<EmperorsFavorBatch>;

  enterSeason(seasonId:string):Promise<void>;

  rsvp(eventId:string,value:'YES'|'NO'):Promise<void>;
  checkIn(eventId:string):Promise<void>;
  ensureCivilizationDraft(matchId:string,gameId:string):Promise<void>;
  pickCivilization(matchId:string,gameId:string,civilization:string):Promise<void>;
  resetCivilizationDraft(matchId:string,gameId:string,reason:string,rerollOrder:boolean):Promise<void>;
  watchCivilizationDraft(matchId:string,gameId:string,callback:()=>void):()=>void;
  uploadReplay(matchId:string,gameId:string,file:File):Promise<ReplayUploadResult>;
  replayStatistics(matchId:string,gameId:string):Promise<ReplayStatisticsResult>;

  event(id:string):Promise<EventDetail>;
  match(id:string):Promise<MatchDetail>;
  player(id:string):Promise<PlayerProfile>;

  dispute(
    matchId:string,
    gameId:string,
    category:string,
    reason:string
  ):Promise<void>;

  onAuthChange(callback:()=>void):()=>void;
}
export class LeagueService {
  constructor(readonly repository:LeagueRepository){}
  async rsvp(snapshot:LeagueSnapshot,id:string,value:'YES'|'NO'){
    if(snapshot.membership!=='ACTIVE')throw new Error('Join the league before answering an event.');
    if(value==='YES'&&!snapshot.enteredSeason)throw new Error('Enter this season before signing up.');
    const event=snapshot.events.find(e=>e.eventId===id);
    if(!event||!new LeagueEvent(event).canRsvp())throw new Error('Sign-ups are not open for this event.');
    await this.repository.rsvp(id,value);
  }
  nextTarget(s:LeagueSnapshot){const i=s.standings.findIndex(p=>p.playerId===s.viewer?.playerId);return i>0?s.standings[i-1]:null;}
}
export class RelationshipPolicy {
  static readonly tracks=[
    {name:'Rivalry',axis:'Gallantry',description:'Repeated, closely contested competition.',stages:['Friction','Competing','Rivalry','Nemesis']},
    {name:'Enemy',axis:'Treachery',description:'Focused hostility and broken alliances.',stages:['Grudge','Bad Blood','Enemy','Vendetta','Blood Feud','Internecine Strife']},
    {name:'Friend',axis:'Chivalry',description:'Cooperation, reinforcement and mutual support.',stages:['Friendly','Respect','Honored','Trusted Friend','Blood Brothers']}
  ];
  static canUnlock(e:{model:string;qualified:boolean;rivalryStage:number;enemyStage:number}|null){return e?.model==='AOF_RELATIONSHIPS_V1'&&e.qualified&&(e.rivalryStage>=3||e.enemyStage>=3);}
}
export function formatName(format:string|null|undefined){
  const labels:Record<string,string>={ONE_V_ONE:'1v1',TWO_V_TWO:'2v2',THREE_V_THREE:'3v3',FOUR_V_FOUR:'4v4',ASYMMETRIC_TEAM:'Asymmetric teams',FFA:'Free-for-all',BIG_TEAM:'Team battle'};
  return format?labels[format]??format.replaceAll('_',' '):'Format to be announced';
}
export function isLombardia(event:EventRecord){return event.eventId==='E001'||/lombardia/i.test(event.title);}
