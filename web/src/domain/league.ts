export type Page = 'season' | 'events' | 'battles' | 'players' | 'war-room' | 'statistics';
export type Membership = 'SIGNED_OUT' | 'UNLINKED' | 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export interface PlayerRecord { playerId:string; steamName:string; avatarUrl?:string|null; role?:'PLAYER'|'ADMIN'; currentPowerRating?:number|null; provisionalRating?:boolean; leaguePoints?:number;mainEventWins?:number;warmupWins?:number;mainEventsPlayed?:number;warmupsPlayed?:number; rank?:number; wins?:number|null; losses?:number|null; }
export class Player {
  constructor(readonly record:PlayerRecord) {}
  get id(){return this.record.playerId;}
  get name(){return this.record.steamName;}
  get initials(){return this.name.replace(/[^\p{L}\p{N} ]/gu,'').split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase();}
}
/** Optional read contract for the Event publication producer; never inferred from play status. */
export interface EventResultsRelease {state:'COLLECTING'|'PREPARING'|'BLOCKED'|'READY'|'RELEASED';revision?:number;publishedAt?:string|null;}
export interface EventRoundoff {revision:number;points:Array<{playerId:string;warmup:number;main:number;placement:number;emperor:number}>;happenings:Array<{title:string;description:string;matchId:string}>;}
export interface EventRecord {
  resultsRelease?:EventResultsRelease;artworkUrl?:string|null;warmupOpensAt?:string|null;
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
  canRsvp(now=Date.now()){
    return ['PUBLISHED','ACTIVE'].includes(this.record.status)&&(!this.record.signupDeadlineAt||Date.parse(this.record.signupDeadlineAt)>=now);
  }
  canCheckIn(now=Date.now()){
    const e=this.record;
    return ['PUBLISHED','ACTIVE'].includes(e.status)&&e.viewer?.rsvp==='YES'&&e.viewer.signupState==='CONFIRMED'&&e.viewer.attendanceStatus!=='CHECKED_IN'&&!!e.checkInOpensAt&&Date.parse(e.checkInOpensAt)<=now&&(!e.checkInClosesAt||Date.parse(e.checkInClosesAt)>now);
  }
}
export interface MatchRecord {playOpensAt?:string|null;playClosesAt?:string|null;scoringAct?:string|null;scoringRules?:Record<string,unknown>|null;scoringState?:string|null;scoringBreakdown?:Array<{playerId:string;matchCompletion:number;matchWin:number;placement:number;emperor:number;placementState:string}>;matchId:string;eventId?:string|null;seasonId?:string|null;format:string|null;status:string;draftRequired?:boolean;completedAt?:string|null;seriesRule?:{maxGames:number;gamesRequiredToWin:number};participants:(PlayerRecord&{team?:number|null;slot?:number})[];result?:{winningPlayerIds?:string[];revision?:number;winners?:PlayerRecord[]}|null;}
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
export interface ReplayStatisticsResult {success:boolean;matchId:string;gameId:string;statisticsId:string;playerMapping:ReplayPlayerMapping[];resultQualification:string;statistics:any;diplomacyReview?:any;officialOutcome?:any;socialIncidents?:any;}
export interface GameRecord {gameId:string;gameNumber:number;status:string;players:(PlayerRecord&{team?:number|null;slot?:number;civilization?:string|null})[];draftRequired?:boolean;draft?:CivilizationDraftRecord|null;result:{revision:number;winningPlayerIds:string[]}|null;resultDisputeOpen:boolean;replay?:{rawStatsState?:string|null;analysisState?:string|null;statisticsId?:string|null;statisticsState?:string|null;statisticsRevision?:number|null};}
export interface MatchDetail {match:MatchRecord;games:GameRecord[];viewer:{playerId:string;isParticipant:boolean};}
export interface EventDetail {roundoff?:EventRoundoff;event:EventRecord;viewer:{playerId:string;role?:'PLAYER'|'ADMIN';rsvp:string;signupState:string;attendanceStatus:string};signup:{confirmedCount:number;waitingListCount:number;rosterVisible:boolean;confirmed:(PlayerRecord&{attendanceStatus?:string})[]|null};matches:MatchRecord[];}
export interface Competition {matchesPlayed:number;matchesWon:number;matchesLost:number;}
export interface AchievementSummary {awardId:string;achievementId?:string|null;name:string;description:string;scope?:string|null;seasonId?:string|null;firstAwardedAt?:string|null;evaluation?:Record<string,unknown>;}
export interface LeagueRecordSummary {code:string;direction?:string;unit?:string;value?:number|null;holders?:Array<{playerId?:string;value?:number;matchId?:string;gameId?:string}>;}
export interface RelationshipTrackSummary {status:string;state:string;stageId:string|null;historicalPeakStageId:string|null;}
export interface RelationshipChronicleEntry {entryId:string;matchId:string|null;eventId:string|null;seasonId:string|null;playedAt:string|null;kind:string;title:string;text:string;relation:string|null;tracksTouched:string[];}
export interface PlayerRelationshipSummary {pairId:string;otherPlayer:PlayerRecord;relationshipEngineVersion:string|null;relationshipRulesConfigured:boolean;tracks:{rivalry:RelationshipTrackSummary;hostility:RelationshipTrackSummary;bond:RelationshipTrackSummary};chronicle:RelationshipChronicleEntry[];}
export interface PlayerProfile {
  player:PlayerRecord&{membershipStatus?:string;goldBalance?:number};
  lifetime:{competition:Competition|null;recordsHeld?:LeagueRecordSummary[]};
  activeSeason:{competition:Competition|null;leaguePoints:number;recordsHeld?:LeagueRecordSummary[]}|null;
  achievements:AchievementSummary[];
  achievementCollection?:AchievementSummary[];
  chronicleShowcase?:{selectedRecords:LeagueRecordSummary[]};
  opponents:{player:PlayerRecord;matchesTogether:number;wins:number;losses:number}[];
  teammates:{player:PlayerRecord;matchesTogether:number;wins:number;losses:number}[];
  relationships?:PlayerRelationshipSummary[];
}
export interface ChronicleContributionMark {track:'RIVALRY'|'HOSTILITY'|'BOND'|'GALLANTRY'|'CRUELTY'|'CHIVALRY'|string;actorPlayerId:string;family:string;units:number;exception:string|null;}
export interface PlayerChronicleEntry {
  entryId:string;battleId:string;eventId:string|null;seasonId:string|null;playedAtMs:number|null;
  rubric:string;title:string;paragraphs:string[];sourceBeatIds:string[];sourceEventIds:string[];evidenceKinds:string[];
  relationshipMarks:ChronicleContributionMark[];reputationMarks:ChronicleContributionMark[];exposureContext:string|null;
}
export interface PlayerChronicleRelationshipPage {
  pairId:string;counterpartPlayerId:string;
  relationship:{sourceModelVersion:string;shadow:true;tracks:Record<string,{currentStage:number;historicalPeak:number;battleIds:string[];directedActors:string[];exceptionalDirectedLevels?:Record<string,number>}>};
  exposure:{gameIds?:string[];battleIds?:string[];contexts?:string[];lastOrder?:number|null}|null;
  entries:PlayerChronicleEntry[];
}
export interface PlayerChronicleProjection {
  modelVersion:'AOF_PLAYER_CHRONICLE_V1'|string;ownerPlayerId:string;status:'AVAILABLE'|'UNAVAILABLE';pages:PlayerChronicleRelationshipPage[];
  reputation:{sourceModelVersion:string;shadow:true;tracks:Record<string,unknown>}|null;reason?:string;
  policy?:{relationshipAndReputationStagesAreShadow?:boolean;proseUsesQualifiedSocialEvidence?:boolean;coPresenceCreatesOnlyFirstRecord?:boolean};
}
export interface PlayerChronicleBookEntry {
  entryId:string;battleId:string;eventId:string|null;seasonId:string|null;playedAtMs:number|null;
  rubric:string;title:string;paragraphs:string[];
}
export interface PlayerChronicleBookPage {pairId:string;counterpartPlayerId:string;entries:PlayerChronicleBookEntry[];}
export interface PlayerChronicleBookProjection {
  modelVersion:'AOF_PLAYER_CHRONICLE_V1'|string;ownerPlayerId:string;status:'AVAILABLE'|'UNAVAILABLE';reason?:string;
  pages:PlayerChronicleBookPage[];
  policy?:{proseUsesQualifiedSocialEvidence?:boolean;coPresenceCreatesOnlyFirstRecord?:boolean};
}
export interface PlayerChronicleResponse {
  success:true;status:'AVAILABLE'|'PARTIAL';chronicle:PlayerChronicleBookProjection;names:Record<string,string>;
  coverage:{completedBattles:number;readableAcceptedGames:number;excludedGames:number;opportunityCompleteness:boolean};
}
export interface SocialHistoryResponse {
  success:true;status:'AVAILABLE'|'PARTIAL';chronicle:PlayerChronicleProjection;names:Record<string,string>;
  excluded:Array<{gameIdentity:string;reason:string}>;
  coverage:{completedBattles:number;readableAcceptedGames:number;excludedGames:number;stageMeaning:string;opportunityCompleteness:boolean};
  history?:unknown;
}
export interface EmperorsFavorPrintable {code:string;emperor:string;serialNumber:number;total:number;printLabel:string;}
export interface EmperorsFavorBatch {batchId:string;batchName:string;count:number;favors:EmperorsFavorPrintable[];}
export interface LeagueSnapshot {membership:Membership;viewer:PlayerRecord|null;season:{seasonId:string;name:string;status:string;currentEmperorPlayerId?:string|null}|null;emperor:PlayerRecord|null;enteredSeason:boolean;hasLeagueHistory:boolean;standings:PlayerRecord[];players:PlayerRecord[];events:EventRecord[];matches:MatchRecord[];}
export const emptySnapshot=():LeagueSnapshot=>({membership:'SIGNED_OUT',viewer:null,season:null,emperor:null,enteredSeason:false,hasLeagueHistory:false,standings:[],players:[],events:[],matches:[]});
export const OPEN_BATTLE_STATUSES=['READY','ACTIVE','AWAITING_CONFIRMATION'] as const;
export function isBattleOpen(status:string|null|undefined){
  return OPEN_BATTLE_STATUSES.includes((status??'') as typeof OPEN_BATTLE_STATUSES[number]);
}
export function currentLeagueEvent(snapshot:Pick<LeagueSnapshot,'viewer'|'events'|'matches'>,now=Date.now()){
  const viewerId=snapshot.viewer?.playerId;
  const currentBattle=viewerId?snapshot.matches.find(match=>
    !!match.eventId&&isBattleOpen(match.status)&&match.participants.some(player=>player.playerId===viewerId)&&snapshot.events.some(event=>event.eventId===match.eventId&&event.status!=='COMPLETED')
  ):null;
  if(currentBattle?.eventId){
    const event=snapshot.events.find(candidate=>candidate.eventId===currentBattle.eventId);
    if(event)return event;
  }
  return snapshot.events.find(event=>event.status==='ACTIVE')??snapshot.events.find(event=>event.status==='PUBLISHED'&&(!event.startsAt||Date.parse(event.startsAt)>=now));
}
export function canBrowseLeague(snapshot:Pick<LeagueSnapshot,'membership'|'enteredSeason'|'hasLeagueHistory'>){return snapshot.membership==='ACTIVE'&&(snapshot.enteredSeason||snapshot.hasLeagueHistory);}
export interface LeagueRepository {
  readonly mode:'preview'|'live';
  load():Promise<LeagueSnapshot>;signIn():Promise<void>;signOut():Promise<void>;
  requestMembership(steamName:string,discordName:string,favor:string):Promise<void>;
  generateEmperorsFavors(batchName:string,count:number):Promise<EmperorsFavorBatch>;
  enterSeason(seasonId:string):Promise<void>;
  rsvp(eventId:string,value:'YES'|'NO'):Promise<void>;checkIn(eventId:string):Promise<void>;formEventMatches(eventId:string):Promise<void>;
  ensureCivilizationDraft(matchId:string,gameId:string):Promise<void>;pickCivilization(matchId:string,gameId:string,civilization:string):Promise<void>;resetCivilizationDraft(matchId:string,gameId:string,reason:string,rerollOrder:boolean):Promise<void>;watchCivilizationDraft(matchId:string,gameId:string,callback:()=>void):()=>void;
  uploadReplay(matchId:string,gameId:string,file:File):Promise<ReplayUploadResult>;replayStatistics(matchId:string,gameId:string):Promise<ReplayStatisticsResult>;statisticsExperience(scope:import('./statistics').StatisticsScope):Promise<import('./statistics').StatisticsDataset>;
  playerChronicle?():Promise<PlayerChronicleResponse>;
  socialHistory?():Promise<SocialHistoryResponse>;
  event(id:string):Promise<EventDetail>;match(id:string):Promise<MatchDetail>;player(id:string):Promise<PlayerProfile>;
  dispute(matchId:string,gameId:string,category:string,reason:string):Promise<void>;
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
  nextTarget(s:LeagueSnapshot){const i=s.standings.findIndex(p=>p.playerId===s.viewer?.playerId);return i>0?s.standings.slice(0,i).reverse().find(p=>p.rank==null||p.rank!==s.standings[i].rank)??null:null;}
}
export class RelationshipPolicy {
  static readonly tracks=[
    {name:'Rivalry',axis:'RECIPROCAL CONTEST',description:'Repeated, reciprocal contest between two players.',stages:['Friction','Contest','Rivalry','Nemesis']},
    {name:'Hostility',axis:'ANTAGONISM',description:'Directed antagonism that becomes a feud only when it is returned.',stages:['Tension','Grudge','Feud','Blood Feud'],secretLegendaryStage:'Internecine Strife'},
    {name:'Bond',axis:'COOPERATION',description:'Cooperation, reinforcement and meaningful support between players.',stages:['Fellowship','Comrades','Trusted Allies','Oathbound']}
  ];
  static canUnlock(e:{model:string;qualified:boolean;rivalryStage:number;hostilityStage:number}|null){return e?.model==='AOF_RELATIONSHIP_ENGINE_V2'&&e.qualified&&(e.rivalryStage>=3||e.hostilityStage>=3);}
}
export function formatName(format:string|null|undefined){
  const labels:Record<string,string>={ONE_V_ONE:'1v1',TWO_V_TWO:'2v2',THREE_V_THREE:'3v3',FOUR_V_FOUR:'4v4',ASYMMETRIC_TEAM:'Asymmetric teams',FFA:'Free-for-all',BIG_TEAM:'Team battle'};
  return format?labels[format]??format.replaceAll('_',' '):'Format to be announced';
}
export function isLombardia(event:EventRecord){return event.eventId==='E001'||/lombardia/i.test(event.title);}

export const isWarmupMatch=(m:MatchRecord)=>m.scoringAct?m.scoringAct==='WARMUP':m.format==='ONE_V_ONE';
export const isMainEventMatch=(m:MatchRecord)=>m.scoringAct?m.scoringAct==='MAIN':m.format!=='ONE_V_ONE';
