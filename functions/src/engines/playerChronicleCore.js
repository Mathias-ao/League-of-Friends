import {buildPriorNarrativeContext,writeBattleNarrative} from './playerChronicleNarrative.js';

/** Deterministic player Chronicle projection from the source-qualified social shadow read model.
 * This is a read-only writer. It never awards points or upgrades shadow stages to official state.
 */
export const PLAYER_CHRONICLE_VERSION = 'AOF_PLAYER_CHRONICLE_V2';
const PLAYER_CHRONICLE_ENTRY_ID_VERSION = 'AOF_PLAYER_CHRONICLE_V1'; // Stable historical identity across prose-only writer upgrades.

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

function composeEntry(group,first,ownerName,counterpartName,history,ownerPlayerId,counterpartPlayerId,context,names){
  const ordered=[...group.beats].sort(beatCompare);
  const sourceBeatIds=unique(ordered.map(beat=>beat.id));
  const sourceEventIds=unique(ordered.flatMap(beat=>rows(beat.sourceEventIds)));
  const marks=contributionMarks(history,group.battleId,ownerPlayerId,counterpartPlayerId);
  const narrative=writeBattleNarrative({group:{...group,beats:ordered},first,ownerName,counterpartName,context,names});
  return {
    entryId:PLAYER_CHRONICLE_ENTRY_ID_VERSION+':'+ownerPlayerId+':'+counterpartPlayerId+':'+group.battleId+':'+(sourceBeatIds.join(',')||'exposure'),
    battleId:group.battleId,
    eventId:group.eventId,
    seasonId:group.seasonId,
    playedAtMs:group.playedAtMs,
    rubric:narrative.rubric,
    title:narrative.title,
    paragraphs:narrative.paragraphs,
    sourceBeatIds,
    sourceEventIds,
    evidenceKinds:unique(ordered.map(beat=>beat.kind)),
    relationshipMarks:marks.relationship,
    reputationMarks:marks.reputation,
    exposureContext:group.firstExposure?.context??null,
    narrativeContext:narrative.narrativeContext,
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

  const activeChapters=rows(chapters).filter(ch=>ch?.accepted===true&&ch?.review?.status==='REVIEW_AVAILABLE')
    .sort((a,b)=>a.order-b.order||String(a.gameIdentity).localeCompare(String(b.gameIdentity)));
  const orderByGame=new Map(activeChapters.map(chapter=>[chapter.gameIdentity,chapter.order]));
  for(const chapter of activeChapters){
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
    const entries=[],priorGroups=[];
    for(let index=0;index<groups.length;index++){
      const group=groups[index];
      const context=buildPriorNarrativeContext({group,priorGroups,history,ownerPlayerId,counterpartPlayerId,orderByGame});
      const entry=composeEntry(group,index===0,ownerName,counterpartName,history,ownerPlayerId,counterpartPlayerId,context,names);
      if(index===0||entry.sourceBeatIds.length>0||entry.relationshipMarks.length>0||entry.reputationMarks.length>0)entries.push(entry);
      priorGroups.push(group);
    }
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
