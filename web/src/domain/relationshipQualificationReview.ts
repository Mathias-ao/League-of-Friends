// Presentation-only claim review over existing versioned evidence. No scoring or new deeds.
export const RELATIONSHIP_REVIEW_VERSION='AOF_RELATIONSHIP_QUALIFICATION_REVIEW_V1';
type Row=Record<string,any>;
export type Track='Rivalry'|'Hostility'|'Bond';
export interface QualificationRow {
 id:string;pair:number[];track:Track;atMs:number|null;title:string;
 actionDirection:number[]|null;contributionDirection:number[]|null;
 evidenceStatus:'QUALIFIED'|'UNAVAILABLE';interpretationStatus:'UNCONFIGURED_POLICY'|'UNAVAILABLE';
 established:string[];missing:string[];sourceIds:string[];recordIds:string[];
}
const records=(v:any):Row[]=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object'):[];
const ids=(v:any):string[]=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'&&x.length))].sort():[];
const player=(v:any):v is number=>Number.isInteger(v)&&v>0;
const direction=(a:any,b:any):number[]|null=>player(a)&&player(b)&&a!==b?[a,b]:null;
const pair=(v:any):number[]|null=>Array.isArray(v)&&v.length===2&&direction(v[0],v[1])?[...v].sort((a,b)=>a-b):null;
const samePair=(d:number[]|null,p:number[])=>!!d&&[...d].sort((a,b)=>a-b).join(':')===p.join(':');
const time=(v:any):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const later=(a:any,b:any)=>time(a?.atMs)!==null&&time(b?.atMs)!==null&&
 (b.atMs>a.atMs||(b.atMs===a.atMs&&Number.isInteger(a.operationOrdinal)&&Number.isInteger(b.operationOrdinal)&&b.operationOrdinal>a.operationOrdinal));

export function reviewRelationshipEvidence(input:{incidents?:any;annotations?:any;declaredHistory?:any}):QualificationRow[]{
 const rows:QualificationRow[]=[];
 const add=(row:QualificationRow)=>rows.push(row);
 for(const incident of records(input.incidents)){
  const p=pair(incident.pairPlayerIds);if(!p||typeof incident.incidentId!=='string')continue;
  const at=time(incident.startedAt?.atMs),facets=records(incident.facets);
  const recordIds=[incident.incidentId];
  const targeted=facets.filter(f=>f.kind==='TARGETED_COMMAND'&&samePair(direction(f.fromPlayerId,f.toPlayerId),p)&&ids(f.sourceEventIds).length);
  const overlaps=facets.filter(f=>f.kind==='LOCAL_COMMAND_OVERLAP'&&samePair(direction(f.contributorPlayerId,f.otherPlayerId),p)&&ids(f.sourceEventIds).length);
  if(incident.family==='LOCAL_CONTEST'&&(targeted.length||overlaps.length)){
   const reciprocal=targeted.some(f=>targeted.some(g=>f.fromPlayerId===g.toPlayerId&&f.toPlayerId===g.fromPlayerId));
   add({id:incident.incidentId+':Rivalry',pair:p,track:'Rivalry',atMs:at,title:targeted.length?'Direct contest commands':'Local participation only',
    actionDirection:null,contributionDirection:null,evidenceStatus:'QUALIFIED',interpretationStatus:'UNCONFIGURED_POLICY',
    established:[targeted.length?'Targeted commands: '+targeted.map(f=>f.fromPlayerId+' → '+f.toPlayerId).join('; '):'Opposing commands overlap locally.',
     reciprocal?'Targeted commands are present in both directions; weapon attacks and damage remain unconfirmed.':'Reciprocal targeting is not established by this episode.',
     'Local overlap is proximity evidence; it cannot supply returned targeting.'],
    missing:[...(targeted.length?[]:['Direct targeting or an independently qualified return-pressure sequence for a stronger competitive claim.']),
      'Configured Rivalry rules and ordered league Battle history.','League player bindings and independent recurrence are needed for lasting progression.'],
    sourceIds:ids([...targeted,...overlaps].flatMap(f=>ids(f.sourceEventIds))),recordIds});
  }
  for(const f of facets){
   const d=direction(f.fromPlayerId,f.toPlayerId),refs=ids(f.sourceEventIds);
   if(incident.family==='DIRECTED_PRESSURE'&&f.kind==='ECONOMY_PRESSURE'&&samePair(d,p)&&refs.length){
    add({id:incident.incidentId+':Hostility:'+d!.join(':'),pair:p,track:'Hostility',atMs:at,title:'Pressure toward a player',
     actionDirection:d,contributionDirection:[d![1],d![0]],evidenceStatus:'QUALIFIED',interpretationStatus:'UNCONFIGURED_POLICY',
     established:['Command-derived economy pressure: '+d![0]+' → '+d![1]+'.',
      'Attribution methods: '+(ids(f.attributionMethods).join(', ')||'Unavailable')+'.',
      'Possible recipient-directed Hostility would run opposite to the pressure action; it is not returned aggression.'],
     missing:['Configured victim-impact policy; no Hostility contribution is awarded.','Distinct deed independence and ordered cross-Battle history for persistent pressure.',
      'Pressure success, weakness and emotional hostility are not established.'],sourceIds:refs,recordIds});
   }
   if(incident.family==='ALLIED_SUPPORT'&&['DEFENSIVE_PARTICIPATION','REINFORCEMENT_COMMANDS'].includes(f.kind)&&samePair(d,p)&&refs.length){
    const alliance=incident.relationContext==='FIXED_ALLIES';
    add({id:incident.incidentId+':Bond:'+f.kind+':'+d!.join(':'),pair:p,track:'Bond',atMs:at,
     title:f.kind==='DEFENSIVE_PARTICIPATION'?'Defensive participation':'Reinforcement commands',
     actionDirection:d,contributionDirection:d,evidenceStatus:alliance?'QUALIFIED':'UNAVAILABLE',
     interpretationStatus:alliance?'UNCONFIGURED_POLICY':'UNAVAILABLE',
     established:['Helper → recipient: '+d![0]+' → '+d![1]+'.',alliance?'Fixed-alliance context retained.':'Alliance at the episode is unavailable.',
      'A received copy does not count as returned assistance.'],
     missing:[...(alliance?[]:['Qualified alliance at the episode.']),'Configured Bond policy and ordered league history.','Effective assistance, rescue and independent reverse support are not established.'],
     sourceIds:refs,recordIds});
   }
   if(incident.family==='SHARED_OFFENSIVE_PARTICIPATION'&&f.kind==='SHARED_OPPONENT_PARTICIPATION'){
    const contributors:Row[]=records(f.contributions).filter((c:Row):boolean=>p.includes(c.contributorPlayerId)&&ids(c.sourceEventIds).length>0);
    if(!p.every(id=>contributors.some(c=>c.contributorPlayerId===id))||!player(f.targetPlayerId)||p.includes(f.targetPlayerId))continue;
    const alliance=incident.relationContext==='FIXED_ALLIES';
    add({id:incident.incidentId+':Bond:shared:'+f.targetPlayerId,pair:p,track:'Bond',atMs:at,title:'Shared offensive participation',
     actionDirection:null,contributionDirection:null,evidenceStatus:alliance?'QUALIFIED':'UNAVAILABLE',interpretationStatus:alliance?'UNCONFIGURED_POLICY':'UNAVAILABLE',
     established:['Exact allies '+p.join(' + ')+' share target '+f.targetPlayerId+'.','Both contributors retain their own command sources.',
      alliance?'Fixed-alliance context retained.':'Alliance at the episode is unavailable.'],
     missing:[...(alliance?[]:['Qualified alliance at the episode.']),'Configured Bond policy.','Coordination intent, target disadvantage and successful damage are unconfirmed.'],
     sourceIds:ids(contributors.flatMap(c=>ids(c.sourceEventIds))),recordIds});
   }
  }
 }
 for(const c of records(input.annotations)){
  const p=pair(c.pairPlayerIds),refs=ids(c.sourceEventIds);if(!p||!refs.length||typeof c.contextId!=='string')continue;
  if(c.family==='RETURN_PRESSURE'){
   const first=direction(c.previousDirection?.fromPlayerId,c.previousDirection?.toPlayerId),back=direction(c.returnDirection?.fromPlayerId,c.returnDirection?.toPlayerId);
   if(!samePair(first,p)||!samePair(back,p)||first![0]!==back![1]||first![1]!==back![0]||
    !c.previousPressureDeedId||!c.returnPressureDeedId||c.previousPressureDeedId===c.returnPressureDeedId||!later(c.previousEndedAt,c.returnStartedAt))continue;
   add({id:c.contextId+':Rivalry',pair:p,track:'Rivalry',atMs:time(c.returnStartedAt.atMs),title:'Independent return pressure',
    actionDirection:back,contributionDirection:null,evidenceStatus:'QUALIFIED',interpretationStatus:'UNCONFIGURED_POLICY',
    established:['Recorded pressure '+first!.join(' → ')+' is followed by independent pressure '+back!.join(' → ')+'.',
     'The existing context model preserves two different deed IDs and full replay ordering.'],
    missing:['Configured Rivalry rules and ordered league history.','The sequence does not establish revenge, causal reaction or reciprocal weapon attacks.',
     ...(c.relationContext==='UNKNOWN'?['Effective relationship at these episodes is unavailable.']:[])],
    sourceIds:refs,recordIds:[c.contextId,c.previousPressureDeedId,c.returnPressureDeedId]});
  }
 }
 if(input.declaredHistory?.modelVersion==='AOF_DECLARED_DIPLOMACY_HISTORY_V1'){
  for(const c of records(input.declaredHistory.turningPoints)){
   const d=direction(c.fromPlayerId,c.toPlayerId);if(!d||c.allyDeclarationWithdrawn!==true||!c.sourceEventId||!c.beatId)continue;
   add({id:c.beatId+':Hostility',pair:[...d].sort((a,b)=>a-b),track:'Hostility',atMs:time(c.moment?.atMs),
    title:'Ally declaration withdrawn — Treachery blocked',actionDirection:d,contributionDirection:[d[1],d[0]],
    evidenceStatus:'QUALIFIED',interpretationStatus:'UNAVAILABLE',
    established:['Recorded declaration '+d.join(' → ')+' changed from Ally to '+c.declarationAfter+'.',
     c.previousReciprocalAllyDeclarations?'Both players had previously declared Ally.':'Previous reciprocal Ally declarations are not established.',
     'This is command history, not another social deed.'],
    missing:['Qualified mutual effective alliance before rupture and qualified unilateral rupture.',
     'Attributed hostile participation after rupture.','Confirmed king loss and independently qualified responsibility.',
     'Configured association, mode, identity and Hostility stage rules.'],
    sourceIds:[c.sourceEventId],recordIds:[c.beatId]});
  }
 }
 // Presentation deduplication only. Never total these rows as deeds or contributions.
 return [...new Map(rows.map(r=>[r.id,r])).values()].sort((a,b)=>(a.atMs??Infinity)-(b.atMs??Infinity)||a.id.localeCompare(b.id));
}
