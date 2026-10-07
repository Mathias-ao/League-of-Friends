/** Deterministic player Chronicle projection from the source-qualified social shadow read model.
 * This is a read-only writer. It never awards points or upgrades shadow stages to official state.
 */
export const PLAYER_CHRONICLE_VERSION = 'AOF_PLAYER_CHRONICLE_V1';

const rows=v=>Array.isArray(v)?v:[];
const rec=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:null;
const text=v=>typeof v==='string'&&v.length>0;
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const unique=v=>[...new Set(v.filter(text))];
const pairKey=(a,b)=>[a,b].sort().join('|');
const momentCompare=(a,b)=>(a?.atMs??0)-(b?.atMs??0)||(a?.operationOrdinal??0)-(b?.operationOrdinal??0);
const beatCompare=(a,b)=>a.chapterOrder-b.chapterOrder||momentCompare(a.moment,b.moment)||String(a.id).localeCompare(String(b.id));

const relationshipTracks=new Set(['RIVALRY','HOSTILITY','BOND']);
const reputationTracks=new Set(['GALLANTRY','CRUELTY','CHIVALRY']);

function clock(ms){
  if(!integer(ms))return null;
  const total=Math.floor(ms/1000),seconds=total%60,minutes=Math.floor(total/60)%60,hours=Math.floor(total/3600);
  return hours>0?`${hours}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`:`${minutes}:${String(seconds).padStart(2,'0')}`;
}

function pairParticipants(review){
  const byReplay=new Map();
  for(const participant of rows(review?.participants)){
    if(!integer(participant?.playerId)||!text(participant?.leaguePlayerId))continue;
    byReplay.set(participant.playerId,{leaguePlayerId:participant.leaguePlayerId,name:text(participant.name)?participant.name:participant.leaguePlayerId});
  }
  return byReplay;
}

function beatForLeaguePair(raw,chapter,participants,ownerPlayerId){
  if(!rec(raw)||!integer(raw.actorPlayerId)||!integer(raw.targetPlayerId)||!rec(raw.moment))return null;
  const actor=participants.get(raw.actorPlayerId),target=participants.get(raw.targetPlayerId);
  if(!actor||!target||actor.leaguePlayerId===target.leaguePlayerId)return null;
  if(actor.leaguePlayerId!==ownerPlayerId&&target.leaguePlayerId!==ownerPlayerId)return null;
  const counterpartPlayerId=actor.leaguePlayerId===ownerPlayerId?target.leaguePlayerId:actor.leaguePlayerId;
  const opponent=integer(raw.opponentPlayerId)?participants.get(raw.opponentPlayerId):null;
  return {
    ...raw,
    chapterOrder:chapter.order,
    gameIdentity:chapter.gameIdentity,
    battleId:chapter.battleId,
    playedAtMs:integer(chapter.playedAtMs)?chapter.playedAtMs:null,
    eventId:text(chapter.eventId)?chapter.eventId:null,
    seasonId:text(chapter.seasonId)?chapter.seasonId:null,
    actorLeagueId:actor.leaguePlayerId,
    targetLeagueId:target.leaguePlayerId,
    actorName:actor.name,
    targetName:target.name,
    opponentLeagueId:opponent?.leaguePlayerId??null,
    opponentName:opponent?.name??null,
    counterpartPlayerId,
  };
}

function exposureForLeaguePair(raw,chapter,participants,ownerPlayerId){
  const pair=rows(raw?.pairPlayerIds);
  if(pair.length!==2)return null;
  const left=participants.get(pair[0]),right=participants.get(pair[1]);
  if(!left||!right||left.leaguePlayerId===right.leaguePlayerId)return null;
  if(left.leaguePlayerId!==ownerPlayerId&&right.leaguePlayerId!==ownerPlayerId)return null;
  const counterpartPlayerId=left.leaguePlayerId===ownerPlayerId?right.leaguePlayerId:left.leaguePlayerId;
  return {
    counterpartPlayerId,
    battleId:chapter.battleId,
    gameIdentity:chapter.gameIdentity,
    chapterOrder:chapter.order,
    playedAtMs:integer(chapter.playedAtMs)?chapter.playedAtMs:null,
    eventId:text(chapter.eventId)?chapter.eventId:null,
    seasonId:text(chapter.seasonId)?chapter.seasonId:null,
    context:text(raw.context)?raw.context:'UNKNOWN',
  };
}

function relationTrackProjection(pairRow){
  const result={};
  for(const track of ['RIVALRY','HOSTILITY','BOND']){
    const value=rec(pairRow?.tracks?.[track]);
    if(!value)continue;
    result[track]={
      currentStage:integer(value.currentStage)?value.currentStage:0,
      historicalPeak:integer(value.historicalPeak)?value.historicalPeak:0,
      battleIds:unique(rows(value.battleIds)),
      directedActors:unique(rows(value.directedActors)),
      exceptionalDirectedLevels:rec(value.exceptionalDirectedLevels)?{...value.exceptionalDirectedLevels}:undefined,
    };
  }
  return result;
}

function firstMeetingSentence(context,ownerName,counterpartName){
  if(context==='LOCKED_TEAMMATES')return `The recorded history of ${ownerName} and ${counterpartName} begins in a Battle where the teams were locked and they stood on the same side.`;
  if(context==='OPPOSED')return `The recorded history of ${ownerName} and ${counterpartName} begins in a Battle where the teams were locked and they stood opposed.`;
  if(context==='OPEN_DIPLOMACY')return `The recorded history of ${ownerName} and ${counterpartName} begins in an open-diplomacy Battle; no lasting stance is inferred from that fact alone.`;
  return `The records of ${ownerName} and ${counterpartName} first overlap in this Battle.`;
}

function declarationSentence(beat){
  const at=clock(beat.moment?.atMs),when=at?` at ${at}`:'';
  const next=beat.declaration;
  const previous=beat.previousDeclaration;
  if(text(previous)&&previous!=='UNKNOWN'&&text(next)&&previous!==next)
    return `${beat.actorName} changed the declared stance toward ${beat.targetName} from ${previous.toLowerCase()} to ${next.toLowerCase()}${when}.`;
  if(text(next))return `${beat.actorName} marked ${beat.targetName} as ${next.toLowerCase()}${when}.`;
  return null;
}

function beatSentence(beat){
  const at=clock(beat.moment?.atMs),when=at?` at ${at}`:'';
  switch(beat.kind){
    case 'DECLARATION_ESTABLISHED': return declarationSentence(beat);
    case 'RECIPROCAL_ALLY_DECLARATIONS':
      return `By ${at??'that point'}, both players had ally declarations recorded toward one another.`;
    case 'ALLY_DECLARATION_WITHDRAWN': {
      const after=text(beat.declaration)&&beat.declaration!=='UNKNOWN'?`; the recorded declaration became ${beat.declaration.toLowerCase()}`:'';
      return `${beat.actorName} withdrew an ally declaration toward ${beat.targetName}${when}${after}.`;
    }
    case 'SUPPORT_PARTICIPATION':
      return `${beat.actorName} contributed qualifying support-command participation toward ${beat.targetName}${when}.`;
    case 'SHARED_PARTICIPATION':
      return beat.opponentName
        ? `${beat.actorName} and ${beat.targetName} were both recorded contributing against ${beat.opponentName} in the same qualified engagement episode${when}.`
        : `${beat.actorName} and ${beat.targetName} were both recorded contributing against the same opponent in a qualified engagement episode${when}.`;
    case 'MATERIAL_AID_ORDER': {
      const resources=rec(beat.resourceAmounts)?Object.entries(beat.resourceAmounts).filter(([,value])=>typeof value==='number'&&value>0)
        .map(([resource,value])=>`${value} ${resource}`).join(', '):'';
      return `${beat.actorName} issued a qualified material-aid order toward ${beat.targetName}${resources?` (${resources})`:''}${when}. The record treats this as an instruction, not proof of delivery.`;
    }
    case 'OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL': {
      const target=beat.targetFunction==='ECONOMIC_UNIT'?`${beat.targetName}'s economic unit`:beat.targetName;
      const timing=beat.association==='IMMEDIATE'?'soon after':'after';
      return `${beat.actorName} made a qualified offensive attempt against ${target} ${timing} withdrawing the ally declaration${when}.`;
    }
    case 'QUALIFIED_KING_LOSS_TREACHERY':
      return `${beat.actorName}'s action against ${beat.targetName} met every gate for the exceptional king-loss treachery rule${when}.`;
    case 'ACCEPTED_DUEL_CONTEST':
      return `${beat.actorName} and ${beat.targetName} completed an official duel; the accepted result qualified as reciprocal contest evidence.`;
    default:return null;
  }
}

function storyIdentity(beats,first){
  const kinds=new Set(beats.map(beat=>beat.kind));
  if(kinds.has('QUALIFIED_KING_LOSS_TREACHERY'))return {rubric:'KING-LOSS RULE',title:'A grievance entered the record'};
  if(kinds.has('OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL'))return {rubric:'DECLARATION & OFFENSE',title:'Hostility followed the withdrawal'};
  if(k