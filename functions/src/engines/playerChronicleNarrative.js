const rows=value=>Array.isArray(value)?value:[];
const rec=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
const text=value=>typeof value==='string'&&value.length>0;
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const pairKey=(a,b)=>[a,b].sort().join('|');
const relationshipTracks=new Set(['RIVALRY','HOSTILITY','BOND']);
const reputationTracks=new Set(['GALLANTRY','CRUELTY','CHIVALRY']);

function narrativeFamily(beat){
  if(beat.kind==='QUALIFIED_KING_LOSS_TREACHERY')return 'KING_LOSS';
  if(beat.kind==='OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL')return 'BREACH_OFFENSE';
  if(beat.kind==='MATERIAL_AID_ORDER')return 'MATERIAL_AID';
  if(beat.kind==='SUPPORT_PARTICIPATION')return 'SUPPORT';
  if(beat.kind==='SHARED_PARTICIPATION')return 'SHARED_OPPONENT';
  if(beat.kind==='ACCEPTED_DUEL_CONTEST')return 'DUEL';
  if(['DECLARATION_ESTABLISHED','RECIPROCAL_ALLY_DECLARATIONS','ALLY_DECLARATION_WITHDRAWN'].includes(beat.kind))return 'DIPLOMACY';
  return null;
}

function addSet(map,key,value){
  if(!map.has(key))map.set(key,new Set());
  map.get(key).add(value);
}

function countObject(source){
  return Object.fromEntries(Object.entries(source).map(([key,value])=>[key,value.size]));
}

export function buildPriorNarrativeContext({group,priorGroups=[],history,ownerPlayerId,counterpartPlayerId,orderByGame}={}){
  const pair=pairKey(ownerPlayerId,counterpartPlayerId);
  const familyBattles=new Map(),directedFamilyBattles=new Map();
  for(const prior of priorGroups){
    for(const beat of rows(prior.beats).filter(item=>item?.kind!=='DECLARATION_KNOWLEDGE_INTERRUPTED')){
      const family=narrativeFamily(beat);
      if(!family)continue;
      addSet(familyBattles,family,prior.battleId);
      if(text(beat.actorLeagueId)&&text(beat.targetLeagueId))
        addSet(directedFamilyBattles,family+'|'+beat.actorLeagueId+'|'+beat.targetLeagueId,prior.battleId);
    }
  }

  const relationship={RIVALRY:new Set(),HOSTILITY:new Set(),BOND:new Set()};
  const relationshipActors={RIVALRY:new Set(),HOSTILITY:new Set(),BOND:new Set()};
  const reputation=new Map();
  const ensureReputation=actor=>{
    if(!reputation.has(actor))reputation.set(actor,{GALLANTRY:new Set(),CRUELTY:new Set(),CHIVALRY:new Set()});
    return reputation.get(actor);
  };

  for(const contribution of rows(history?.contributions)){
    if(contribution?.battleId===group?.battleId)continue;
    const order=orderByGame?.get(contribution?.gameIdentity);
    if(!integer(order)||order>=group.order)continue;

    if(relationshipTracks.has(contribution.track)&&
       pairKey(contribution.actorLeagueId,contribution.counterpartLeagueId)===pair){
      relationship[contribution.track].add(contribution.battleId);
      if(contribution.reciprocityEligible!==false)relationshipActors[contribution.track].add(contribution.actorLeagueId);
    }

    if(reputationTracks.has(contribution.track)&&
       [ownerPlayerId,counterpartPlayerId].includes(contribution.actorLeagueId))
      ensureReputation(contribution.actorLeagueId)[contribution.track].add(contribution.battleId);
  }

  const reputationCounts={};
  for(const [actor,tracks] of reputation.entries())reputationCounts[actor]=countObject(tracks);

  return {
    familyCounts:Object.fromEntries([...familyBattles].map(([family,battles])=>[family,battles.size])),
    directedFamilyCounts:Object.fromEntries([...directedFamilyBattles].map(([key,battles])=>[key,battles.size])),
    relationship:countObject(relationship),
    relationshipActors:countObject(relationshipActors),
    reputation:reputationCounts,
  };
}

function familyCount(context,family){return context?.familyCounts?.[family]??0;}
function directedCount(context,family,actor,target){
  return context?.directedFamilyCounts?.[family+'|'+actor+'|'+target]??0;
}

function firstMeetingSentence(context,ownerName,counterpartName){
  if(context==='LOCKED_TEAMMATES')return 'Their first shared page found '+ownerName+' and '+counterpartName+' beneath the same banner.';
  if(context==='OPPOSED')return 'Their first shared page placed '+ownerName+' and '+counterpartName+' on opposite sides of the field.';
  if(context==='OPEN_DIPLOMACY')return 'Their first shared page began with loyalties still free to change.';
  return 'This was the first Battle to place '+ownerName+' and '+counterpartName+' on the same page.';
}

function resources(beat){
  if(!rec(beat.resourceAmounts))return '';
  return Object.entries(beat.resourceAmounts)
    .filter(([,value])=>typeof value==='number'&&value>0)
    .map(([resource,value])=>String(value)+' '+resource).join(', ');
}

function episodeSentence(beat){
  if(!beat)return null;
  switch(beat.kind){
    case 'SUPPORT_PARTICIPATION':
      if(beat.supportKind==='REINFORCEMENT_COMMANDS')
        return beat.actorName+' sent reinforcement commands toward '+beat.targetName+'. The orders are certain; what reached the field is not.';
      if(beat.supportKind==='DEFENSIVE_PARTICIPATION')
        return 'When the fighting gathered around '+beat.targetName+', '+beat.actorName+' joined the defensive episode beside them. Whether it changed the outcome is not written here.';
      return beat.actorName+' directed support toward '+beat.targetName+'. What followed is less certain than the act itself.';
    case 'SHARED_PARTICIPATION':
      return beat.opponentName
        ? 'In the same engagement, '+beat.actorName+' and '+beat.targetName+' both took part against '+beat.opponentName+'. Whether by design or circumstance, the page does not say.'
        : 'In the same engagement, '+beat.actorName+' and '+beat.targetName+' both took part against the same opponent. Whether by design or circumstance, the page does not say.';
    case 'MATERIAL_AID_ORDER': {
      const amount=resources(beat);
      return beat.actorName+' put'+(amount?' '+amount:'')+' into an aid order for '+beat.targetName+'. The command is in the ledger; delivery itself is not claimed.';
    }
    case 'OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL': {
      const timing=beat.association==='IMMEDIATE'?'Soon after':'Later';
      const target=beat.targetFunction==='ECONOMIC_UNIT'?beat.targetName+"'s economy":beat.targetName;
      return timing+', '+beat.actorName+' turned an offensive attempt toward '+target+'. No success is claimed; the attempt itself is enough to mark the turn.';
    }
    case 'QUALIFIED_KING_LOSS_TREACHERY':
      return 'The alliance had broken. What followed left '+beat.actorName+' recorded as responsible for the loss of '+beat.targetName+"'s king.";
    case 'ACCEPTED_DUEL_CONTEST':
      return beat.actorName+' and '+beat.targetName+' met in an official duel and carried it through to an accepted result.';
    default:return null;
  }
}

function diplomacySentences(beats){
  const declarations=beats.filter(beat=>beat.kind==='DECLARATION_ESTABLISHED');
  const reciprocal=beats.some(beat=>beat.kind==='RECIPROCAL_ALLY_DECLARATIONS');
  const withdrawals=beats.filter(beat=>beat.kind==='ALLY_DECLARATION_WITHDRAWN');
  const result=[];
  const first=declarations[0];
  if(first&&text(first.declaration))
    result.push(first.actorName+' marked '+first.targetName+' as '+first.declaration.toLowerCase()+'.');
  if(reciprocal)
    result.push('Before the Battle was done, both players had ally declarations recorded toward one another.');
  const withdrawal=withdrawals.at(-1);
  if(withdrawal){
    const after=text(withdrawal.declaration)&&withdrawal.declaration!=='UNKNOWN'
      ?' and marked '+withdrawal.targetName+' as '+withdrawal.declaration.toLowerCase():'';
    result.push('Later, '+withdrawal.actorName+' withdrew the ally declaration toward '+withdrawal.targetName+after+'.');
  }
  if(declarations.length+withdrawals.length>3)
    result.push('The declared stances shifted more than once before the Battle ended.');
  return result.slice(0,3);
}

function patternSentence(primary,context){
  if(!primary)return null;
  const family=narrativeFamily(primary);
  if(!family)return null;
  const prior=['SUPPORT','MATERIAL_AID','BREACH_OFFENSE'].includes(family)
    ?directedCount(context,family,primary.actorLeagueId,primary.targetLeagueId)
    :familyCount(context,family);
  if(prior<1)return null;

  if(family==='SUPPORT'){
    if(primary.supportKind==='REINFORCEMENT_COMMANDS')
      return 'The direction was familiar: '+primary.actorName+' had sent reinforcement orders toward '+primary.targetName+' before.';
    if(primary.supportKind==='DEFENSIVE_PARTICIPATION')
      return 'It was not the first Battle to place '+primary.actorName+' in a defensive episode around '+primary.targetName+'.';
    return 'Support from '+primary.actorName+' toward '+primary.targetName+' was no longer a one-off entry.';
  }
  if(family==='MATERIAL_AID')
    return 'It was not the first aid order '+primary.actorName+' had directed toward '+primary.targetName+'.';
  if(family==='BREACH_OFFENSE')
    return 'A hard turn from '+primary.actorName+' toward '+primary.targetName+' was no longer without precedent.';
  if(family==='DUEL')
    return prior>=2?'By then, meeting in contest had become a recurring chapter between them.':'The contest had found them before.';
  if(family==='SHARED_OPPONENT')
    return 'It was not the first Battle to put their efforts against the same opponent in one engagement.';
  return null;
}

function relationshipLight(family,context){
  const rivalry=context?.relationship?.RIVALRY??0;
  const hostility=context?.relationship?.HOSTILITY??0;
  const hostilityActors=context?.relationshipActors?.HOSTILITY??0;
  const bond=context?.relationship?.BOND??0;
  if(['SUPPORT','MATERIAL_AID','SHARED_OPPONENT'].includes(family)){
    if(hostility>0&&bond>0)return 'It added another contradiction to a page that already held both cooperation and strain.';
    if(hostility>0)return hostilityActors>=2?'It landed on a page that already carried an older quarrel.':'It landed on a page that already carried an older hard turn.';
    if(bond>=2)return 'It joined a cooperative pattern already taking shape between them.';
    if(rivalry>=2)return 'Even a familiar contest had not kept them from sharing ground.';
  }
  if(['BREACH_OFFENSE','KING_LOSS'].includes(family)){
    if(bond>0&&hostility>0)return 'It sharpened a page that already held both cooperation and grievance.';
    if(bond>0)return 'It darkened a page that already contained cooperation between them.';
    if(hostility>=2)return hostilityActors>=2?'It was another hard turn in a quarrel that already had history.':'It was another hard turn in a pattern already written in one direction.';
    if(rivalry>0)return 'What had been a contest now had a harder entry beside it.';
  }
  if(family==='DUEL'){
    if(hostility>0)return hostilityActors>=2?'The contest arrived with an older quarrel already behind it.':'The contest arrived with an older hard turn already behind it.';
    if(bond>0)return 'They had stood together before; that did not keep the contest from returning.';
    if(rivalry>0)return 'The contest was no longer new between them.';
  }
  return null;
}

function reputationLight(actorId,family,context,names){
  if(!text(actorId))return null;
  const tracks=context?.reputation?.[actorId];
  if(!tracks)return null;
  const chivalry=tracks.CHIVALRY??0,cruelty=tracks.CRUELTY??0,gallantry=tracks.GALLANTRY??0;
  const actor=names?.[actorId]??actorId;
  const supportive=['SUPPORT','MATERIAL_AID'].includes(family);
  const hostile=['BREACH_OFFENSE','KING_LOSS'].includes(family);

  if(supportive&&chivalry>=2&&cruelty>=2)
    return {priority:4,text:'It added another contradiction to '+actor+"'s name, already marked by both helpful and harder deeds."};
  if(supportive&&cruelty>=2)
    return {priority:4,text:'It sat strangely beside the harder deeds already attached to '+actor+"'s name."};
  if(hostile&&chivalry>=2)
    return {priority:4,text:'It cut against the more helpful deeds already attached to '+actor+"'s name."};
  if(supportive&&chivalry>=2)
    return {priority:2,text:'It sat beside earlier acts of aid already attached to '+actor+"'s name."};
  if(hostile&&cruelty>=2)
    return {priority:2,text:'It did not stand alone beside '+actor+"'s name; harder deeds had appeared there before."};
  return null;
}

function diplomacyAside(beats){
  const diplomacy=beats.filter(beat=>['DECLARATION_ESTABLISHED','RECIPROCAL_ALLY_DECLARATIONS','ALLY_DECLARATION_WITHDRAWN'].includes(beat.kind));
  if(!diplomacy.length)return null;
  const withdrawal=diplomacy.filter(beat=>beat.kind==='ALLY_DECLARATION_WITHDRAWN').at(-1);
  if(withdrawal)return 'During the same Battle, '+withdrawal.actorName+' also withdrew the ally declaration toward '+withdrawal.targetName+'.';
  if(diplomacy.some(beat=>beat.kind==='RECIPROCAL_ALLY_DECLARATIONS'))
    return 'During the same Battle, both players also had ally declarations recorded toward one another.';
  const declaration=diplomacy.find(beat=>beat.kind==='DECLARATION_ESTABLISHED'&&text(beat.declaration));
  if(declaration)return 'During the same Battle, '+declaration.actorName+' also marked '+declaration.targetName+' as '+declaration.declaration.toLowerCase()+'.';
  return null;
}

function primaryBeat(beats){
  const priority=[
    'QUALIFIED_KING_LOSS_TREACHERY',
    'OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL',
    'MATERIAL_AID_ORDER',
    'SUPPORT_PARTICIPATION',
    'SHARED_PARTICIPATION',
    'ACCEPTED_DUEL_CONTEST',
  ];
  for(const kind of priority){
    const found=beats.find(beat=>beat.kind===kind);
    if(found)return found;
  }
  return null;
}

function secondaryBeat(beats,primary){
  if(!primary)return null;
  const primaryFamily=narrativeFamily(primary);
  return beats.find(beat=>{
    const family=narrativeFamily(beat);
    return family&&family!=='DIPLOMACY'&&family!==primaryFamily;
  })??null;
}

function storyIdentity(beats,first,context){
  const kinds=new Set(beats.map(beat=>beat.kind));
  const primary=primaryBeat(beats);
  if(kinds.has('QUALIFIED_KING_LOSS_TREACHERY'))
    return {rubric:'KING-LOSS RULE',title:(context?.relationship?.HOSTILITY??0)>=2?'The quarrel crossed a line':'A crown entered the quarrel',primary};
  if(kinds.has('OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL')){
    if((context?.relationship?.BOND??0)>0)return {rubric:'WITHDRAWAL & OFFENSE',title:'A darker turn',primary};
    if((context?.relationship?.HOSTILITY??0)>0)return {rubric:'WITHDRAWAL & OFFENSE',title:'The quarrel sharpened',primary};
    return {rubric:'WITHDRAWAL & OFFENSE',title:'The banner did not hold',primary};
  }
  if(kinds.has('MATERIAL_AID_ORDER')){
    const count=primary?directedCount(context,'MATERIAL_AID',primary.actorLeagueId,primary.targetLeagueId):0;
    return {rubric:'MATERIAL AID',title:count>0?'Another hand extended':'Aid across the page',primary};
  }
  if(kinds.has('SUPPORT_PARTICIPATION')){
    const count=primary?directedCount(context,'SUPPORT',primary.actorLeagueId,primary.targetLeagueId):0;
    return {rubric:'SUPPORT RECORDED',title:count>0?'Again to the line':'A hand in the defence',primary};
  }
  if(kinds.has('SHARED_PARTICIPATION'))
    return {rubric:'COMMON TARGET',title:familyCount(context,'SHARED_OPPONENT')>0?'Another common field':'Against the same foe',primary};
  if(kinds.has('ACCEPTED_DUEL_CONTEST')){
    const prior=familyCount(context,'DUEL');
    return {rubric:'OFFICIAL DUEL',title:(context?.relationship?.RIVALRY??0)>=2?'No easy field':prior>0?'The contest returned':first?'First contest':'A contest begins',primary};
  }
  if(kinds.has('RECIPROCAL_ALLY_DECLARATIONS')&&kinds.has('ALLY_DECLARATION_WITHDRAWN'))
    return {rubric:'DIPLOMACY',title:'The declarations did not hold',primary:null};
  if(kinds.has('RECIPROCAL_ALLY_DECLARATIONS'))
    return {rubric:'DIPLOMACY',title:'The declarations aligned',primary:null};
  if(kinds.has('ALLY_DECLARATION_WITHDRAWN'))
    return {rubric:'DIPLOMACY',title:'The ally mark was withdrawn',primary:null};
  if(kinds.has('DECLARATION_ESTABLISHED'))
    return {rubric:'DIPLOMACY',title:'The stance shifted',primary:null};
  return {rubric:first?'FIRST RECORD':'RECORDED BATTLE',title:first?'First recorded meeting':'Another shared Battle',primary:null};
}

export function writeBattleNarrative({group,first=false,ownerName,counterpartName,context,names={}}={}){
  const visible=rows(group?.beats).filter(beat=>beat?.kind!=='DECLARATION_KNOWLEDGE_INTERRUPTED');
  const identity=storyIdentity(visible,first,context);
  const sentences=[];
  if(first)sentences.push(firstMeetingSentence(group?.firstExposure?.context??'UNKNOWN',ownerName,counterpartName));

  if(identity.primary?.kind==='OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL'){
    const withdrawal=visible.find(beat=>beat.kind==='ALLY_DECLARATION_WITHDRAWN'&&
      beat.actorLeagueId===identity.primary.actorLeagueId&&beat.targetLeagueId===identity.primary.targetLeagueId);
    if(withdrawal)sentences.push(withdrawal.actorName+' withdrew the ally declaration toward '+withdrawal.targetName+'.');
    const episode=episodeSentence(identity.primary);if(episode)sentences.push(episode);
  }else if(identity.primary){
    const episode=episodeSentence(identity.primary);if(episode)sentences.push(episode);
    const secondary=secondaryBeat(visible,identity.primary);
    const secondSentence=episodeSentence(secondary);
    if(secondSentence)sentences.push(secondSentence);
    const aside=diplomacyAside(visible);
    if(aside)sentences.push(aside);
  }else{
    sentences.push(...diplomacySentences(visible));
  }

  const family=identity.primary?narrativeFamily(identity.primary):null;
  const pattern=patternSentence(identity.primary,context);
  if(pattern)sentences.push(pattern);

  const relationship=family?relationshipLight(family,context):null;
  const reputation=family&&identity.primary?reputationLight(identity.primary.actorLeagueId,family,context,names):null;
  const light=reputation?.priority===4?reputation.text:relationship??reputation?.text??null;
  if(light&&!sentences.includes(light))sentences.push(light);

  return {
    rubric:identity.rubric,
    title:identity.title,
    paragraphs:[sentences.filter(Boolean).slice(0,5).join(' ')],
    narrativeContext:{
      priorFamilyCounts:context?.familyCounts??{},
      priorDirectedFamilyCounts:context?.directedFamilyCounts??{},
      priorRelationshipEvidence:context?.relationship??{},
      priorRelationshipActors:context?.relationshipActors??{},
      priorReputationEvidence:context?.reputation??{},
    },
  };
}
