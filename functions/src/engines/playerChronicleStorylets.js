/** Age of Friends Chronicle C1: an editorial-only, deterministic scene compositor.
 * Read-only: never qualifies a fact, adds an invitation, changes a score or assigns an outcome.
 * It only varies already-rendered, source-gated V2 narrative clauses. Core and IDs are untouched.
 */
export const CHRONICLE_STORYLET_VERSION='AOF_CHRONICLE_PROSE_C1';

const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const string=v=>typeof v==='string'?v:'';
const count=(context,family,beat)=>{
  const prefix=family==='SUPPORT'?'SUPPORT':family==='MATERIAL_AID'?'MATERIAL_AID':'BREACH_OFFENSE';
  if(['SUPPORT','MATERIAL_AID','BREACH_OFFENSE'].includes(family)){
    return context?.directedFamilyCounts?.[prefix+'|'+beat.actorLeagueId+'|'+beat.targetLeagueId]??0;
  }
  return context?.familyCounts?.[family]??0;
};
const familyOf=beat=>{
  switch(beat?.kind){
    case 'SUPPORT_PARTICIPATION':return 'SUPPORT';
    case 'MATERIAL_AID_ORDER':return 'MATERIAL_AID';
    case 'OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL':return 'BREACH_OFFENSE';
    case 'SHARED_PARTICIPATION':return 'SHARED_OPPONENT';
    case 'ACCEPTED_DUEL_CONTEST':return 'DUEL';
    default:return null;
  }
};
const hash32=value=>{
  let h=2166136261;
  for(const character of value)h=Math.imul(h^character.codePointAt(0),16777619)>>>0;
  return h>>>0;
};
const resourceLabel=beat=>Object.entries(object(beat.resourceAmounts))
  .filter(([,value])=>typeof value==='number'&&Number.isFinite(value)&&value>0)
  .map(([kind,value])=>String(value)+' '+kind).join(', ');
const labels=beat=>({
  a:string(beat.actorName),b:string(beat.targetName),
  c:string(beat.opponentName),
  resources:resourceLabel(beat),
});
const suffixed=(lead,uncertainty)=>lead+' '+uncertainty;
function episodeVariants(family,beat){
  const {a,b,c,resources}=labels(beat);
  if(!a||!b)return null;
  if(family==='DUEL')return [
    a+' and '+b+' met in an official duel that reached an accepted result.',
    'An accepted official duel brought '+a+' opposite '+b+'.',
    'The official contest between '+a+' and '+b+' carried through to an accepted result.',
    'This Battle added another completed, accepted duel between '+a+' and '+b+'.',
    'In an official duel, '+a+' and '+b+' met again and an accepted result followed.',
    'The accepted duel in this Battle placed '+a+' against '+b+'.',
    'An official duel involving '+a+' and '+b+' entered the accepted results.',
    'The record lists a completed official duel between '+a+' and '+b+'.',
  ];
  if(family==='SUPPORT'){
    if(beat.supportKind==='REINFORCEMENT_COMMANDS')return [
      suffixed(a+' directed reinforcement commands toward '+b+'.','Their arrival is not established.'),
      suffixed('Toward '+b+', '+a+' entered reinforcement orders.','The orders do not prove that help arrived.'),
      suffixed('Reinforcement commands from '+a+' named '+b+' as their direction.','What reached the field remains unknown.'),
      suffixed('The orders pointed from '+a+' toward '+b+'.','No completed reinforcement is claimed.'),
      suffixed('The ledger keeps reinforcement commands sent toward '+b+' by '+a+'.','It does not establish their execution.'),
      suffixed('To '+b+', '+a+' directed commands for reinforcement.','Their eventual effect is not recorded.'),
      suffixed('Commands for reinforcement were issued by '+a+' toward '+b+'.','Arrival is not proved by an order.'),
      suffixed(b+' was the intended direction of '+a+"'s reinforcement orders.",'The result of those orders is not established.'),
    ];
    if(beat.supportKind==='DEFENSIVE_PARTICIPATION')return [
      suffixed('A defensive episode around '+b+' also included '+a+'.','Its outcome is not attributed to that participation.'),
      suffixed('The defensive encounter involving '+b+' had '+a+' among its participants.','Whether this changed the result is unknown.'),
      suffixed('Beside '+b+' in a recorded defensive episode stood the participation of '+a+'.','No rescue is claimed.'),
      suffixed('The account places '+a+' within a defensive episode around '+b+'.','Its effect is not established.'),
      suffixed('In the defence recorded around '+b+', '+a+' also took part.','The page does not assign the outcome to that action.'),
      suffixed('A defensive episode involving '+b+' counted '+a+' among those taking part.','It does not prove a save.'),
      suffixed('The fighting recorded as a defensive episode around '+b+' also involved '+a+'.','Its consequence is not established here.'),
      suffixed(a+' took part in the defensive encounter around '+b+'.','That participation alone proves no rescue or outcome.'),
    ];
    return [
      suffixed(a+' directed support toward '+b+'.','What followed is not established.'),
      suffixed('Toward '+b+', '+a+' made a recorded support-directed action.','Its effect remains unproved.'),
      suffixed('A support-directed episode linked '+a+' toward '+b+'.','The page does not claim a result.'),
      suffixed('The record places support-directed action from '+a+' toward '+b+'.','Its outcome is unknown.'),
      suffixed(b+' was the direction of a support action by '+a+'.','The effect cannot be read from that alone.'),
      suffixed('The episode lists '+a+' directing support toward '+b+'.','It does not establish what arrived.'),
      suffixed('A directed support record names '+a+' and '+b+'.','It leaves the result unsettled.'),
      suffixed('From '+a+' toward '+b+' the record contains a support-directed act.','No successful intervention is inferred.'),
    ];
  }
  if(family==='MATERIAL_AID'){
    // A source order without a supported positive amount uses the older safe fallback.
    if(!resources)return null;
    const amount=' '+resources;
    return [
      suffixed(a+' entered an aid order of'+amount+' for '+b+'.','Receipt is not established.'),
      suffixed('An aid order from '+a+' named '+b+' and'+amount+'.','Delivery is not proved.'),
      suffixed('The resource ledger preserves an order from '+a+' toward '+b+(amount?' for'+amount:'')+'.','It is not proof of delivery.'),
      suffixed(b+' appeared as recipient in an aid order entered by '+a+(amount?' for'+amount:'')+'.','Receipt remains unknown.'),
      suffixed('A command to direct'+amount+' toward '+b+' came from '+a+'.','Completion is not recorded.'),
      suffixed('The ledger lists'+amount+' in an aid order by '+a+' for '+b+'.','The order does not establish receipt.'),
      suffixed(a+"'s aid order named "+b+(amount?' and'+amount:'')+'.','The page does not say that it arrived.'),
      suffixed('An order of aid toward '+b+' was recorded under '+a+(amount?' for'+amount:'')+'.','Transfer itself is unproved.'),
    ];
  }
  if(family==='BREACH_OFFENSE'){
    const target=beat.targetFunction==='ECONOMIC_UNIT'?b+"'s economy":b;
    const when=beat.association==='IMMEDIATE'?'Soon after':'Later';
    return [
      suffixed(when+' the withdrawal, '+a+' directed an offensive attempt toward '+target+'.','Success is not established.'),
      suffixed('After the change of declaration, an offensive attempt from '+a+' pointed toward '+target+'.','Its outcome is not claimed.'),
      suffixed(a+' turned an offensive attempt toward '+target+' after the withdrawal.','The record does not prove its success.'),
      suffixed('The recorded sequence placed the withdrawal before an offensive attempt by '+a+' toward '+target+'.','No successful strike is inferred.'),
      suffixed('Following the withdrawn ally mark, '+a+' made an offensive attempt directed at '+target+'.','Its effect remains unknown.'),
      suffixed('The old declaration was withdrawn; a later offensive attempt by '+a+' was directed toward '+target+'.','Result is not established.'),
      suffixed('An attempt directed toward '+target+' by '+a+' followed the withdrawal.','It is the attempt, not its success, that is written.'),
      suffixed(when+' that declaration change, the record places '+a+"'s offensive attempt toward "+target+'.','The consequence is not proved.'),
    ];
  }
  if(family==='SHARED_OPPONENT'){
    const target=c||'the same opponent';
    return [
      suffixed('In a single recorded engagement, '+a+' and '+b+' both took part against '+target+'.','A joint plan is not established.'),
      suffixed('The same engagement placed '+a+' and '+b+' against '+target+'.','Whether by design is not known.'),
      suffixed(a+' and '+b+' appear against '+target+' in one engagement.','That does not prove coordination.'),
      suffixed('Against '+target+', one engagement included both '+a+' and '+b+'.','No common intention is claimed.'),
      suffixed('An engagement involving '+target+' also records participation by '+a+' and '+b+'.','Its coordination is unknown.'),
      suffixed('Both '+a+' and '+b+' took part in an engagement against '+target+'.','The page cannot assign a shared plan.'),
      suffixed('The account records '+a+' and '+b+' in the same engagement against '+target+'.','Their purpose is not inferred.'),
      suffixed('One engagement with '+target+' as opponent carries the names of both '+a+' and '+b+'.','Their agreement is not established.'),
    ];
  }
  return null;
}
function callbackVariants(family,beat){
  const {a,b}=labels(beat);
  if(family==='SUPPORT'){
    if(beat.supportKind==='REINFORCEMENT_COMMANDS')return [
      'Earlier Battles had also recorded reinforcement orders in that direction.',
      'The ledger already contained prior reinforcement commands from '+a+' toward '+b+'.',
      'This was not the first separate Battle with reinforcement orders directed toward '+b+' by '+a+'.',
      'Similar orders, in the same direction, had appeared on older pages.',
    ];
    if(beat.supportKind==='DEFENSIVE_PARTICIPATION')return [
      'A previous Battle had also placed '+a+' in a defensive episode around '+b+'.',
      'The two had appeared in this same direction of defensive participation in earlier Battles.',
      'An older page likewise counted '+a+' in a defence around '+b+'.',
      'Their record already included '+a+"'s participation in an earlier defensive episode around "+b+'.',
    ];
    return [
      'Directed support from '+a+' toward '+b+' had appeared in earlier Battles.',
      'Older pages had already recorded support-directed conduct in this direction.',
      'This direction of support was not new in their separate-Battle history.',
      'Another earlier Battle had also held support-directed action from '+a+' toward '+b+'.',
    ];
  }
  if(family==='MATERIAL_AID')return [
    'An older Battle also recorded an aid order from '+a+' toward '+b+'.',
    'Aid orders in this direction had appeared on earlier pages.',
    'This was not their first separate Battle containing an order of aid in that direction.',
    'The ledger already held earlier aid orders from '+a+' toward '+b+'.',
  ];
  if(family==='BREACH_OFFENSE')return [
    'An earlier Battle had also placed an offensive attempt after withdrawal in this direction.',
    'The pair had an older page with an attempt following a withdrawn ally mark.',
    'This direction of post-withdrawal offence had appeared in a separate Battle before.',
    'An earlier entry likewise recorded an offensive attempt after a withdrawal from '+a+' toward '+b+'.',
  ];
  if(family==='DUEL')return [
    'Earlier Battles had already recorded an accepted official duel between them.',
    'This was not their first separate Battle settled through an accepted official duel.',
    'The formal contest had appeared between their names on older pages.',
    'An earlier accepted duel already stood in their shared history.',
  ];
  if(family==='SHARED_OPPONENT')return [
    'An older Battle also placed them against a common opponent in an engagement.',
    'Their earlier pages already contained another common-opponent engagement.',
    'This was not their first separate Battle involving a common opponent in one engagement.',
    'The pattern of participation against a shared opponent had appeared before.',
  ];
  return null;
}
const titles={
  SUPPORT:['A familiar defence','The defensive record','Another defensive entry','At the line again'],
  SUPPORT_REINFORCEMENT:['Reinforcement orders returned','Orders entered again','The command ledger','A repeated direction'],
  SUPPORT_GENERIC:['Directed support recorded','Another support episode','Support entered again','The direction returned'],
  MATERIAL_AID:['Aid orders remembered','Another order entered','The ledger of aid','A directed order returned'],
  BREACH_OFFENSE:['After the changed mark','The attempt returned','Another hard turn','After a withdrawal'],
  DUEL:['The formal contest returned','Another official duel','The accepted contest','A contest repeated'],
  SHARED_OPPONENT:['Against a common opponent','Another common field','A shared engagement','Two against one opponent'],
};
/** Given already-admitted Chronicle beats and the existing safe baseline, vary complete
 * fact/callback clauses and restrained heading, never proof status, identity or provenance.
 * Repeat status is derived only from prior independent Battles; chronology unresolved,
 * first/second occurrences and strict exceptional categories keep the current writer.
 */
export function composeChronicleC1({group,context,identity,primarySentence,patternSentence,sentences}={}){
  const unchanged={title:identity?.title,sentences:Array.isArray(sentences)?sentences:[]};
  const beat=identity?.primary,family=familyOf(beat);
  // #125 frozen scene seam: factual Battle result, not a per-Game status.
  // Unknown/future qualification values fail closed; the old status field is a
  // compatibility fallback for isolated pre-#136 fixtures, never an override.
  const qualification=group?.result?.qualification??group?.resultStatus;
  if(!family||!Array.isArray(sentences)||!primarySentence||!patternSentence||
     !sentences.includes(primarySentence)||!sentences.includes(patternSentence)||
     group?.chronologyQualified!==true||qualification!=='OFFICIAL')return unchanged;
  const prior=count(context,family,beat);
  if(!Number.isSafeInteger(prior)||prior<2)return unchanged;
  const episodes=episodeVariants(family,beat),callbacks=callbackVariants(family,beat);
  if(!episodes||episodes.length!==8||!callbacks||callbacks.length!==4)return unchanged;
  const [left,right]=[string(beat.actorLeagueId),string(beat.targetLeagueId)].sort();
  if(!left||!right)return unchanged;
  const seed=hash32(CHRONICLE_STORYLET_VERSION+'|'+left+'|'+right+'|'+family);
  const episode=episodes[(seed+prior)%8];
  const callback=callbacks[(Math.floor(prior/8)+seed)%4];
  return {
    title:titles[family==='SUPPORT'?(beat.supportKind==='REINFORCEMENT_COMMANDS'?'SUPPORT_REINFORCEMENT':beat.supportKind==='DEFENSIVE_PARTICIPATION'?'SUPPORT':'SUPPORT_GENERIC'):family]?.[(seed+prior)%4]??identity.title,
    sentences:sentences.map(sentence=>sentence===primarySentence?episode:sentence===patternSentence?callback:sentence),
  };
}
