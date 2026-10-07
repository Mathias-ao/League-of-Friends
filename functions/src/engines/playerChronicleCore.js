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
      if(beat.supportKind==='REINFORCEMENT_COMMANDS')
        return `Reinforcement commands from ${beat.actorName} toward ${beat.targetName} entered the record${when}. The evidence establishes the commands, not their arrival or outcome.`;
      if(beat.supportKind==='DEFENSIVE_PARTICIPATION')
        return `${beat.actorName} was recorded participating in a defensive episode involving ${beat.targetName}${when}. The record does not claim a rescue or determine the outcome.`;
      return `${beat.actorName} was recorded in qualified support-command participation toward ${beat.targetName}${when}. The record does not claim a completed rescue or outcome.`;
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
  if(kinds.has('OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL'))return {rubric:'WITHDRAWAL & OFFENSE',title:'An offensive attempt followed the withdrawal'};
  if(kinds.has('MATERIAL_AID_ORDER'))return {rubric:'MATERIAL AID',title:'Aid entered the ledger'};
  if(kinds.has('SUPPORT_PARTICIPATION'))return {rubric:'SUPPORT RECORDED',title:'A hand in the defence'};
  if(kinds.has('SHARED_PARTICIPATION'))return {rubric:'COMMON TARGET',title:'A common foe'};
  if(kinds.has('ACCEPTED_DUEL_CONTEST'))return {rubric:'OFFICIAL DUEL',title:first?'First contest':'The contest continued'};
  if(kinds.has('RECIPROCAL_ALLY_DECLARATIONS')&&kinds.has('ALLY_DECLARATION_WITHDRAWN'))return {rubric:'DIPLOMACY',title:'The declarations did not hold'};
  if(kinds.has('RECIPROCAL_ALLY_DECLARATIONS'))return {rubric:'DIPLOMACY',title:'Their declarations aligned'};
  if(kinds.has('ALLY_DECLARATION_WITHDRAWN'))return {rubric:'DIPLOMACY',title:'The ally mark was withdrawn'};
  if(kinds.has('DECLARATION_ESTABLISHED'))return {rubric:'DIPLOMACY',title:'The stance changed'};
  return {rubric:first?'FIRST RECORD':'RECORDED BATTLE',title:first?'First recorded meeting':'Another shared Battle'};
}

function contributionMarks(history,battleId,ownerPlayerId,counterpartPlayerId){
  const pair=pairKey(ownerPlayerId,counterpartPlayerId);
  const relationship=[],reputation=[];
  for(const contribution of rows(history?.contributions)){
    if(contribution?.battleId!==battleId||pairKey(contribution?.actorLeagueId,contribution?.counterpartLeagueId)!==pair)continue;
    const mark={track:contribution.track,actorPlayerId:contribution.actorLeagueId,family:contribution.family,units:contribution.units,exception:contribution.exception??null};
    if(relationshipTracks.has(contribution.track))relationship.push(mark);
    if(reputationTracks.has(contribution.track))reputation.push(mark);
  }
  return {relationship,reputation};
}

function composeEntry(group,first,ownerName,counterpartName,history,ownerPlayerId,counterpartPlayerId){
  const ordered=[...group.beats].sort(beatCompare);
  const visible=ordered.filter(beat=>beat.kind!=='DECLARATION_KNOWLEDGE_INTERRUPTED');
  const intro=firstMeetingSentence(group.firstExposure?.context??'UNKNOWN',ownerName,counterpartName);
  const sentences=[];
  if(first)sentences.push(intro);

  const diplomacy=visible.filter(beat=>['DECLARATION_ESTABLISHED','RECIPROCAL_ALLY_DECLARATIONS','ALLY_DECLARATION_WITHDRAWN'].includes(beat.kind));
  const substantive=visible.filter(beat=>!['DECLARATION_ESTABLISHED','RECIPROCAL_ALLY_DECLARATIONS','ALLY_DECLARATION_WITHDRAWN'].includes(beat.kind));

  const chosenDiplomacy=diplomacy.length<=4?diplomacy:[diplomacy[0],diplomacy[1],diplomacy.at(-2),diplomacy.at(-1)];
  for(const beat of chosenDiplomacy){
    const sentence=beatSentence(beat);if(sentence&&!sentences.includes(sentence))sentences.push(sentence);
  }
  if(diplomacy.length>chosenDiplomacy.length)
    sentences.push(`${diplomacy.length-chosenDiplomacy.length} further declared-stance changes were retained in the same Battle record.`);

  const chosenSubstantive=substantive.slice(0,5);
  for(const beat of chosenSubstantive){
    const sentence=beatSentence(beat);if(sentence&&!sentences.includes(sentence))sentences.push(sentence);
  }
  if(substantive.length>chosenSubstantive.length)
    sentences.push(`${substantive.length-chosenSubstantive.length} further qualified social beats remain attached to this Battle's evidence record.`);

  if(!sentences.length)sentences.push(first?intro:`${ownerName} and ${counterpartName} were both present in another accepted recorded Battle; no stronger pair claim is made from co-presence alone.`);

  const identity=storyIdentity(visible,first);
  const sourceBeatIds=unique(ordered.map(beat=>beat.id));
  const sourceEventIds=unique(ordered.flatMap(beat=>rows(beat.sourceEventIds)));
  const marks=contributionMarks(history,group.battleId,ownerPlayerId,counterpartPlayerId);
  return {
    entryId:`${PLAYER_CHRONICLE_VERSION}:${ownerPlayerId}:${counterpartPlayerId}:${group.battleId}:${sourceBeatIds.join(',')||'exposure'}`,
    battleId:group.battleId,
    eventId:group.eventId,
    seasonId:group.seasonId,
    playedAtMs:group.playedAtMs,
    rubric:identity.rubric,
    title:identity.title,
    paragraphs:[sentences.join(' ')],
    sourceBeatIds,
    sourceEventIds,
    evidenceKinds:unique(ordered.map(beat=>beat.kind)),
    relationshipMarks:marks.relationship,
    reputationMarks:marks.reputation,
    exposureContext:group.firstExposure?.context??null,
  };
}

export function projectPlayerChronicle({ownerPlayerId,chapters=[],history=null,names={}}={}){
  if(!text(ownerPlayerId))throw Error('chronicle_owner_required');
  if(!rec(history)||history.modelVersion!=='AOF_SOCIAL_HISTORY_V1')
    return {modelVersion:PLAYER_CHRONICLE_VERSION,ownerPlayerId,status:'UNAVAILABLE',pages:[],reputation:null,reason:'social_history_unavailable'};

  const pairRows=new Map();
  for(const pair of rows(history.pairs)){
    if(!Array.isArray(pair?.playerIds)||pair.playerIds.length!==2||!pair.playerIds.includes(ownerPlayerId))continue;
    const counterpartPlayerId=pair.playerIds.find(id=>id!==ownerPlayerId);
    if(!text(counterpartPlayerId))continue;
    pairRows.set(counterpartPlayerId,pair);
  }

  const pageGroups=new Map();
  const ensurePage=counterpartPlayerId=>{
    if(!pageGroups.has(counterpartPlayerId))pageGroups.set(counterpartPlayerId,{groups:new Map(),firstExposure:null});
    return pageGroups.get(counterpartPlayerId);
  };

  for(const chapter of rows(chapters).filter(ch=>ch?.accepted===true&&ch?.review?.status==='REVIEW_AVAILABLE').sort((a,b)=>a.order-b.order||String(a.gameIdentity).localeCompare(String(b.gameIdentity)))){
    const participants=pairParticipants(chapter.review);
    for(const raw of rows(chapter.review.exposure)){
      const exposure=exposureForLeaguePair(raw,chapter,participants,ownerPlayerId);if(!exposure)continue;
      const page=ensurePage(exposure.counterpartPlayerId);
      if(!page.firstExposure||exposure.chapterOrder<page.firstExposure.chapterOrder)page.firstExposure=exposure;
      const group=page.groups.get(exposure.battleId)??{battleId:exposure.battleId,eventId:exposure.eventId,seasonId:exposure.seasonId,playedAtMs:exposure.playedAtMs,order:exposure.chapterOrder,beats:[],firstExposure:exposure};
      if(exposure.chapterOrder<group.order){group.order=exposure.chapterOrder;group.firstExposure=exposure;}
      if(group.playedAtMs==null&&exposure.playedAtMs!=null)group.playedAtMs=exposure.playedAtMs;
      page.groups.set(exposure.battleId,group);
    }
    for(const raw of rows(chapter.review.chronicle)){
      const beat=beatForLeaguePair(raw,chapter,participants,ownerPlayerId);if(!beat)continue;
      const page=ensurePage(beat.counterpartPlayerId);
      const group=page.groups.get(beat.battleId)??{battleId:beat.battleId,eventId:beat.eventId,seasonId:beat.seasonId,playedAtMs:beat.playedAtMs,order:beat.chapterOrder,beats:[],firstExposure:null};
      group.beats.push(beat);
      if(beat.chapterOrder<group.order)group.order=beat.chapterOrder;
      if(group.playedAtMs==null&&beat.playedAtMs!=null)group.playedAtMs=beat.playedAtMs;
      page.groups.set(beat.battleId,group);
    }
  }

  const pages=[];
  for(const counterpartPlayerId of new Set([...pairRows.keys(),...pageGroups.keys()])){
    const pair=pairRows.get(counterpartPlayerId)??{playerIds:[ownerPlayerId,counterpartPlayerId],tracks:{},exposure:null};
    const page=ensurePage(counterpartPlayerId);
    const groups=[...page.groups.values()].sort((a,b)=>a.order-b.order||String(a.battleId).localeCompare(String(b.battleId)));
    const ownerName=names[ownerPlayerId]??ownerPlayerId,counterpartName=names[counterpartPlayerId]??counterpartPlayerId;
    const entries=groups.map((group,index)=>composeEntry(group,index===0,ownerName,counterpartName,history,ownerPlayerId,counterpartPlayerId))
      .filter((entry,index)=>index===0||entry.sourceBeatIds.length>0||entry.relationshipMarks.length>0||entry.reputationMarks.length>0);
    pages.push({
      pairId:pairKey(ownerPlayerId,counterpartPlayerId),
      counterpartPlayerId,
      relationship:{sourceModelVersion:history.modelVersion,shadow:true,tracks:relationTrackProjection(pair)},
      exposure:pair.exposure??{gameIds:[],battleIds:[],contexts:[],lastOrder:null},
      entries,
    });
  }

  const reputation=rows(history.profiles).find(profile=>profile?.playerId===ownerPlayerId)??{playerId:ownerPlayerId,tracks:{}};
  return {
    modelVersion:PLAYER_CHRONICLE_VERSION,
    ownerPlayerId,
    status:'AVAILABLE',
    pages:pages.sort((a,b)=>String(names[a.counterpartPlayerId]??a.counterpartPlayerId).localeCompare(String(names[b.counterpartPlayerId]??b.counterpartPlayerId))),
    reputation:{sourceModelVersion:history.modelVersion,shadow:true,tracks:reputation.tracks??{}},
    policy:{relationshipAndReputationStagesAreShadow:true,proseUsesQualifiedSocialEvidence:true,coPresenceCreatesOnlyFirstRecord:true},
  };
}
