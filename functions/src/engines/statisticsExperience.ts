/** Pure, shared presentation contract. No Firebase or browser dependencies. */
export const EXPERIENCE_VERSION = 'AOF_STATISTICS_EXPERIENCE_V1';
export const CATEGORIES = ['Opening', 'Economy', 'Military', 'Map Presence', 'Execution'] as const;
export type Category = typeof CATEGORIES[number];
export type AggregationMode = 'total' | 'average';
export interface MetricDefinition {
  id: string; label: string; category: Category; path: string; unit: 'number' | 'ms' | 'seconds' | 'percent';
  aggregation: 'volume' | 'mean' | 'median' | 'responses'; leader?: 'min' | 'max'; record?: 'min' | 'max'; detail?: boolean;
}
const metric = (id: string, label: string, category: Category, path: string, unit: MetricDefinition['unit'] = 'number', aggregation: MetricDefinition['aggregation'] = 'volume', extra: Partial<MetricDefinition> = {}): MetricDefinition => ({id,label,category,path,unit,aggregation,...extra});
export const METRICS: MetricDefinition[] = [
  ...['feudal','castle','imperial'].map(age => metric(age, `${age[0].toUpperCase()+age.slice(1)} timing ≈`, 'Opening', `opening.ageUp.${age}.ageUpAtMs`, 'ms', 'median', {leader:'min',record:'min'})),
  metric('feudalVillagers','Villagers at Feudal click ≈','Opening','opening.villagersBeforeFeudalAge.count','number','median',{detail:true}),
  metric('firstMilitary','First military request','Opening','opening.firstMilitaryUnitQueued.atMs','ms','median',{detail:true}),
  metric('loom','Loom request','Opening','opening.loomTiming.atMs','ms','median',{detail:true}),
  metric('earlyWalls','Pre-Feudal wall tiles','Opening','opening.wallTilesBeforeFeudal.count','number','mean',{detail:true}),
  ...['food','wood','gold','stone','total'].map(resource => metric(resource,resource==='total'?'Resources committed':resource[0].toUpperCase()+resource.slice(1),'Economy',`economy.resourceCommitment.resourcesCommitted.${resource}`,'number','volume',{leader:'max',record:'max'})),
  metric('villagerRequests','Villager requests','Economy','economy.villagersTrained.count','number','volume',{detail:true}),
  metric('tcIdle','Dark Age TC idle ≈','Economy','economy.tcIdleTimeDarkAge.valueMs','ms','median',{detail:true}),
  metric('extraTCs','Additional TC placements','Economy','economy.townCenters.extraPlacementCount','number','mean',{detail:true}),
  metric('secondTC','First extra TC placement','Economy','economy.firstExtraTownCenterTime.atMs','ms','median',{detail:true}),
  metric('thirdTC','Third TC placement','Economy','economy.thirdTownCenterTime.atMs','ms','median',{detail:true}),
  metric('militaryCommitment','Military unit commitment','Military','military.militaryUnitCommitment.resources'),
  metric('unitRequests','Military unit requests','Military','military.militaryUnitsTrained.count','number','volume',{detail:true}),
  metric('raidsOut','Raids initiated','Military','military.engagements.raidsInitiated','number','volume',{leader:'max',record:'max'}),
  metric('firstRaid','First detected raid','Military','military.engagements.raidEvidence.initiatedEpisodes','ms','median',{record:'min',detail:true}),
  metric('raidsIn','Raids received','Military','military.engagements.raidsAgainstYou'),
  metric('skirmishes','Skirmishes','Military','military.engagements.skirmishes'),
  metric('skirmishTime','Time in skirmishes','Military','execution.skirmishContext.totalTimeMs','ms'),
  metric('assistsOut','Defensive assists given','Military','military.engagements.defensiveAssistsGiven','number','volume',{leader:'max',record:'max'}),
  metric('assistsIn','Defensive assists received','Military','military.engagements.defensiveAssistsReceived'),
  metric('cooperation','Cooperative attacks','Military','military.engagements.cooperativeAttacks','number','volume',{leader:'max',record:'max'}),
  metric('scouting','Scout command coverage @5','Map Presence','mapPresence.scoutCoverageAt5Minutes.percent','percent','median',{record:'max'}),
  metric('expansions','Expansion zones','Map Presence','mapPresence.expansionZones.count','number','mean',{leader:'max',record:'max'}),
  metric('forward','Forward placements','Map Presence','mapPresence.forwardBuildings.count','number','mean',{leader:'max',record:'max'}),
  metric('forwardEco','Forward economy placements','Map Presence','mapPresence.forwardEco.count','number','mean',{record:'max'}),
  metric('walls','Wall tiles placed','Map Presence','mapPresence.wallTiles.totalWallTiles','number','mean'),
  metric('contact','Enemy-base command contact','Map Presence','mapPresence.enemyBaseContact.atMs','ms','median',{detail:true}),
  metric('apm','Raw APM','Execution','execution.apm','number','median',{record:'max'}),
  metric('combatApm','Skirmish APM','Execution','execution.skirmishContext.apm','number','median',{record:'max'}),
  metric('response','Raid response ≈','Execution','execution.raidResponse.medianSeconds','seconds','responses'),
  metric('responded','Responses detected','Execution','execution.raidResponse.respondedRaidCount'),
  metric('received','Received raid opportunities','Execution','execution.raidResponse.receivedRaidCount'),
];
export const FAMILIES = ['infantry','archers','cavalry','siege','monks','warships','navalSupport','otherLandMilitary','specialMilitary','unknown'] as const;
export const FAMILY_LABELS: Record<string,string> = {infantry:'Infantry',archers:'Archers',cavalry:'Cavalry',siege:'Siege',monks:'Monks',warships:'Warships',navalSupport:'Naval support',otherLandMilitary:'Other land',specialMilitary:'Special military',unknown:'Unclassified'};
export interface EvidenceEpisode {id:string;kind:'raid'|'assist'|'cooperation'|'skirmish'|'greatBattle'|'age';atMs:number;endMs:number;actors:string[];targets:string[];label:string;}
export interface PlayerMeasurement {
  playerId:string;name:string;team:number|null;civilization:string|null;opening:string|null;mainUnit:string|null;
  values:Record<string,number|null>;unavailable:Record<string,string>;models:Record<string,string>;
  composition:Record<string,number>|null;responseTimes:number[];
  byAge:Record<string,Record<string,number>>;
  details:{label:string;value:string;atMs:number|null;category:Category}[];
}
export interface GameStatistics {
  version:string;matchId:string;gameId:string;seasonId:string|null;eventId:string|null;format:string;contextKey:string;
  orderAtMs:number;revision:number;sourceHash:string;eligible:boolean;exclusionReason:string|null;
  affectsSeason:boolean;affectsLifetime:boolean;durationMs:number;players:PlayerMeasurement[];
  episodes:EvidenceEpisode[];evidenceTruncated:boolean;warnings:string[];
}
export interface StatisticsScope {seasonId?:string;eventId?:string;matchId?:string;}
export interface StatisticsDataset {version:string;games:GameStatistics[];unavailableGames:number;}
export interface ProjectionMetadata extends Omit<GameStatistics,'version'|'durationMs'|'players'|'episodes'|'evidenceTruncated'|'warnings'> {
  roster:{playerId:string;steamName?:string;team?:number|null;civilization?:string|null}[];
  mapping:{replaySlot:number;playerId:string}[];
}
type Bag = Record<string,any>;
const object = (value:unknown):Bag => value && typeof value==='object'&&!Array.isArray(value)?value as Bag:{};
const array = (value:unknown):Bag[] => Array.isArray(value)?value.filter(v=>v&&typeof v==='object'):[];
const number = (value:unknown):number|null => typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const text = (value:unknown):string|null => typeof value==='string'&&value.trim()?value:null;
const at = (value:unknown,path:string):unknown => path.split('.').reduce<unknown>((v,key)=>object(v)[key],value);
export const median = (values:number[]):number|null => {if(!values.length)return null;const v=[...values].sort((a,b)=>a-b),i=Math.floor(v.length/2);return v.length%2?v[i]:(v[i-1]+v[i])/2;};

/** Normalize only known canonical paths. Unknown values stay null, never zero. */
export function projectStatistics(raw:unknown, metadata:ProjectionMetadata):GameStatistics {
  const data=object(raw),participants=array(data.participants),episodes=new Map<string,EvidenceEpisode>();
  const sourceIds=new Map<string,string>();
  const seenSlots=new Set<number>(),seenPlayers=new Set<string>();
  for(const p of participants){
    const bindings=metadata.mapping.filter(m=>m.replaySlot===p.replaySlot);
    const binding=bindings.length===1?bindings[0]:null;
    if(!binding||seenSlots.has(p.replaySlot)||seenPlayers.has(binding.playerId)||!metadata.roster.some(r=>r.playerId===binding.playerId))throw new Error('Replay participant mapping is incomplete or ambiguous.');
    seenSlots.add(p.replaySlot);seenPlayers.add(binding.playerId);sourceIds.set(String(p.playerId),binding.playerId);
  }
  if(seenPlayers.size!==metadata.roster.length)throw new Error('Replay does not cover the approved roster.');
  const ids=(values:unknown[]):string[] => [...new Set(values.map(v=>sourceIds.get(String(v))).filter((v):v is string=>!!v))];
  const add=(kind:EvidenceEpisode['kind'],e:Bag,actorKeys:unknown[],targetKeys:unknown[],label:string)=>{
    const start=number(e.startedAtMs??e.firstContributionAtMs??e.atMs),end=number(e.endedAtMs)??start;
    const actors=ids(actorKeys),targets=ids(targetKeys);
    if(start===null||!actors.length||actors.length!==new Set(actorKeys).size||targets.length!==new Set(targetKeys).size)return;
    const id=`${kind}:${e.raidId??e.battleId??e.skirmishId??start}:${actors.join(',')}:${targets.join(',')}`;
    episodes.set(id,{id,kind,atMs:start,endMs:Math.max(start,end??start),actors,targets,label});
  };
  const players=participants.map(p=>{
    const playerId=sourceIds.get(String(p.playerId))!,roster=metadata.roster.find(r=>r.playerId===playerId)!;
    const values:Record<string,number|null>={},unavailable:Record<string,string>={},models:Record<string,string>={};
    for(const m of METRICS){
      let value=number(at(p,m.path));
      const root=m.path.split('.')[0];
      const version=String(object(p[root]).modelVersion??data.statisticsProjectionVersion??'unknown');
      models[m.id]=version;
      if(['food','wood','gold','stone','total'].includes(m.id)){
        models[m.id]=String(p.economy?.resourceCommitment?.modelVersion??'unknown');
        if(Number(p.economy?.resourceCommitment?.coverage?.unpricedRequestCommands??0)>0){value=null;unavailable[m.id]='Unpriced requests: complete commitment unavailable.';}
      }
      if(m.id==='firstRaid'){const starts=array(p.military?.engagements?.raidEvidence?.initiatedEpisodes).map(e=>number(e.startedAtMs)).filter((n):n is number=>n!==null);value=starts.length?Math.min(...starts):null;}
      if(['raidsOut','raidsIn','firstRaid'].includes(m.id))models[m.id]=String(p.military?.engagements?.modelVersion??'unknown');
      if(['assistsOut','assistsIn','cooperation','skirmishes'].includes(m.id))models[m.id]=String(p.military?.engagements?.engagementModelVersion??'unknown');
      if(['assistsOut','assistsIn','cooperation'].includes(m.id)&&p.military?.engagements?.allyInteractionApplicability?.status!=='applicable'){
        value=null;unavailable[m.id]='No qualified allied interaction context.';
      }
      if(m.id==='scouting'&&(p.mapPresence?.scoutCoverageAt5Minutes?.status!=='ok'||Number(data.scope?.observedUntilMs??0)<300000)){value=null;unavailable[m.id]='Insufficient starting-scout attribution or recording shorter than 5:00.';}
      if(m.id==='militaryCommitment'&&Number(p.military?.militaryUnitCommitment?.unpricedQueuedUnitAmount??0)>0)value=null;
      if(['feudal','castle','imperial'].includes(m.id)&&value!==null&&value>Number(data.scope?.observedUntilMs??0)){value=null;unavailable[m.id]='Projected completion is beyond the recording.';}
      values[m.id]=value;
      if(value===null&&!unavailable[m.id])unavailable[m.id]='Not observed, inapplicable, or insufficient evidence.';
    }
    const compositionSource=object(p.military?.composition),composition:Record<string,number>={};
    for(const family of FAMILIES)composition[family]=number(compositionSource[family])??0;
    const known=Object.values(composition).reduce((a,b)=>a+b,0),requested=values.unitRequests;
    composition.unknown=requested===null?0:Math.max(0,requested-known);
    const engagements=object(p.military?.engagements),evidence=object(engagements.engagementEvidence);
    for(const e of array(engagements.raidEvidence?.initiatedEpisodes))add('raid',e,[e.attackerPlayerId],[e.victimPlayerId],'Detected raid');
    for(const e of array(evidence.defensiveAssistsGiven))add('assist',e,[e.helperPlayerId],[e.defendedPlayerId],'Defensive assist');
    for(const e of array(evidence.cooperativeAttacks))add('cooperation',e,e.attackerPlayerIds??[],e.targetPlayerIds??[],'Cooperative attack');
    for(const e of array(evidence.skirmishes))add('skirmish',e,e.participantPlayerIds??[],[],'Skirmish');
    for(const e of array(evidence.greatBattles))add('greatBattle',e,e.participantPlayerIds??[],[],'Great Battle');
    for(const age of ['feudal','castle','imperial'])if(values[age]!==null)add('age',{atMs:values[age]},[p.playerId],[],`${age[0].toUpperCase()+age.slice(1)} timing ≈`);
    const details:PlayerMeasurement['details']=[];
    for(const [category,rows] of [['Economy',p.economy?.economicTechsResearched?.technologies],['Military',p.military?.blacksmithUpgrades?.technologies],['Military',p.military?.universityTechs?.technologies]] as const){
      for(const r of array(rows))details.push({category,label:text(r.technology?.name)??`Technology ${r.technology?.rawId??'unknown'}`,value:'Research request',atMs:number(r.researchRequestedAtMs??r.latestRequestedAtMs)});
    }
    for(const row of array(compositionSource.unitRows))details.push({category:'Military',label:text(row.unit?.name??row.entity?.name)??`Unit ${row.rawUnitId??row.unitId??'unknown'}`,value:`${row.positiveQueueAmount??row.queueAmount??row.count??'—'} queue requests`,atMs:null});
    return {playerId,name:roster.steamName??text(p.displayName)??playerId,team:roster.team??null,civilization:roster.civilization??null,
      opening:text(p.buildOrder?.classification?.label)??text(p.buildOrder?.classification)??text(p.buildOrder?.label),mainUnit:text(compositionSource.dominantUnit?.name),
      values,unavailable,models,composition:requested!==null&&requested>0&&known<=requested?composition:null,
      responseTimes:array(p.execution?.raidResponse?.evidence).map(r=>number(r.responseTimeMs)).filter((n):n is number=>n!==null).map(n=>n/1000),
      byAge:object(p.economy?.resourceCommitment?.byAge),details:details.slice(0,100)};
  });
  const allEpisodes=[...episodes.values()].sort((a,b)=>a.atMs-b.atMs||a.id.localeCompare(b.id));
  const {mapping:_,roster:__,...base}=metadata;
  return {...base,version:EXPERIENCE_VERSION,durationMs:number(data.scope?.observedUntilMs)??0,players,episodes:allEpisodes.slice(0,600),evidenceTruncated:allEpisodes.length>600,
    warnings:array(data.warnings).map(w=>String(w.message??w.code)).slice(0,30)};
}

export interface AggregateValue {value:number|null;samples:number;eligibleGames:number;models:string[];}
export interface AggregatePlayer {playerId:string;name:string;games:number;values:Record<string,AggregateValue>;opening:string|null;mainUnit:string|null;composition:Record<string,number>|null;}
export interface StatisticRecord {metricId:string;value:number;playerId:string;name:string;matchId:string;gameId:string;civilization:string|null;orderAtMs:number;contextKey:string;model:string;}
export interface Highlight {id:string;category:Category;title:string;detail:string;matchId:string;gameId:string;playerId:string;priority:number;}
function mode(values:(string|null)[]):string|null {const counts=new Map<string,number>();for(const value of values)if(value)counts.set(value,(counts.get(value)??0)+1);if(!counts.size)return null;const max=Math.max(...counts.values());return [...counts].filter(([,n])=>n===max).map(([v])=>`${v} (${max}/${values.filter(Boolean).length})`).sort().join(' / ');}
export class StatisticsExperience {
  readonly games:GameStatistics[];
  constructor(games:GameStatistics[]){
    const revisions=new Map<string,GameStatistics>();
    for(const g of games){const key=g.matchId+'/'+g.gameId,old=revisions.get(key);if(!old||g.revision>old.revision)revisions.set(key,g);}
    const hashes=new Set<string>();
    this.games=[...revisions.values()].sort((a,b)=>a.orderAtMs-b.orderAtMs||a.matchId.localeCompare(b.matchId)||a.gameId.localeCompare(b.gameId)).filter(g=>{if(!g.eligible)return false;if(g.sourceHash&&hashes.has(g.sourceHash))return false;if(g.sourceHash)hashes.add(g.sourceHash);return true;});
  }
  aggregate(modeValue:AggregationMode='total'):AggregatePlayer[]{
    const ids=[...new Set(this.games.flatMap(g=>g.players.map(p=>p.playerId)))];
    return ids.map(playerId=>{
      const samples=this.games.flatMap(g=>g.players.filter(p=>p.playerId===playerId));
      const values:Record<string,AggregateValue>={};
      for(const m of METRICS){
        const qualified=samples.filter(p=>p.values[m.id]!=null),numbers=qualified.map(p=>p.values[m.id]!);
        const models=[...new Set(qualified.map(p=>p.models[m.id]))].sort();
        let value:number|null=null;
        if(numbers.length){
          if(m.aggregation==='median')value=median(numbers);
          else if(m.aggregation==='responses')value=median(qualified.flatMap(p=>p.responseTimes));
          else {value=numbers.reduce((a,b)=>a+b,0);if(m.aggregation==='mean'||modeValue==='average')value/=numbers.length;}
        }
        // Response opportunity counts remain totals even in per-Game mode.
        if(['responded','received'].includes(m.id))value=numbers.length?numbers.reduce((a,b)=>a+b,0):null;
        values[m.id]={value,samples:numbers.length,eligibleGames:samples.length,models};
      }
      const compositions=samples.map(p=>p.composition).filter((c):c is Record<string,number>=>c!==null&&Object.values(c).reduce((a,b)=>a+b,0)>0);
      const composition:Record<string,number>={};
      for(const family of FAMILIES)composition[family]=compositions.length?compositions.reduce((sum,c)=>sum+(c[family]??0)/Object.values(c).reduce((a,b)=>a+b,0)*100,0)/compositions.length:0;
      return {playerId,name:samples.at(-1)!.name,games:samples.length,values,opening:mode(samples.map(p=>p.opening)),mainUnit:mode(samples.map(p=>p.mainUnit)),composition:compositions.length?composition:null};
    }).sort((a,b)=>a.name.localeCompare(b.name));
  }
  leaders(metricId:string,modeValue:AggregationMode='total',minimumGames=5):string[]{
    const m=METRICS.find(m=>m.id===metricId);if(!m?.leader)return [];
    const rows=this.aggregate(modeValue),values=rows.map(p=>p.values[metricId]);
    if(rows.length<2||values.some(v=>v.value===null||v.samples!==v.eligibleGames)||new Set(values.flatMap(v=>v.models)).size!==1||values.some(v=>v.models.includes('unknown')))return [];
    const typical=modeValue==='average'||m.aggregation!=='volume';
    if(typical&&(rows.some(p=>p.values[metricId].samples<minimumGames)||new Set(this.games.map(g=>g.contextKey)).size!==1))return [];
    const extreme=(m.leader==='max'?Math.max:Math.min)(...values.map(v=>v.value!));
    if(extreme===0||values.every(v=>v.value===extreme))return [];
    return rows.filter(p=>p.values[metricId].value===extreme).map(p=>p.playerId);
  }
  records():StatisticRecord[]{
    const result=new Map<string,StatisticRecord[]>();
    for(const g of this.games)for(const m of METRICS.filter(m=>m.record)){
      for(const p of g.players){const value=p.values[m.id];if(value==null||value===0||!p.models[m.id]||p.models[m.id]==='unknown')continue;
        const key=[m.id,g.contextKey,p.models[m.id]].join('|'),previous=result.get(key)??[];
        const record={metricId:m.id,value,playerId:p.playerId,name:p.name,matchId:g.matchId,gameId:g.gameId,civilization:p.civilization,orderAtMs:g.orderAtMs,contextKey:g.contextKey,model:p.models[m.id]};
        if(!previous.length||(m.record==='max'?value>previous[0].value:value<previous[0].value))result.set(key,[record]);
        else if(value===previous[0].value&&!previous.some(r=>r.playerId===p.playerId))result.set(key,[...previous,record]);
      }
    }
    return [...result.values()].flat();
  }
  leadershipChanges():Highlight[]{
    const latest=this.games.at(-1);if(!latest||this.games.length<2)return [];
    const before=new StatisticsExperience(this.games.slice(0,-1)),rows=this.aggregate();
    return METRICS.filter(m=>m.leader&&m.aggregation==='volume').flatMap(m=>{
      const old=before.leaders(m.id),current=this.leaders(m.id);
      if(!old.length||!current.length||current.join('|')===old.join('|'))return [];
      return current.filter(id=>!old.includes(id)).map(id=>{const p=rows.find(p=>p.playerId===id)!;return {id:`lead:${m.id}:${id}`,category:m.category,title:`${p.name} ${current.length>1?'shares the lead':'now leads'} in ${m.label.toLowerCase()}`,detail:`${formatStatistic(p.values[m.id].value,m)} · previously ${old.map(id=>rows.find(p=>p.playerId===id)?.name??id).join(', ')}`,matchId:latest.matchId,gameId:latest.gameId,playerId:id,priority:90};});
    });
  }
  personalBests(viewerId:string):StatisticRecord[]{
    const latest=this.games.at(-1);if(!latest)return [];
    const player=latest.players.find(p=>p.playerId===viewerId);if(!player)return [];
    return METRICS.filter(m=>m.record).flatMap(m=>{
      const previous=this.games.slice(0,-1).filter(g=>g.contextKey===latest.contextKey).flatMap(g=>g.players.filter(p=>p.playerId===viewerId&&p.models[m.id]===player.models[m.id]).map(p=>p.values[m.id])).filter((v):v is number=>v!=null);
      const value=player.values[m.id];if(previous.length<3||value==null||value===0||!player.models[m.id]||player.models[m.id]==='unknown')return [];
      if(m.record==='max'?value<=Math.max(...previous):value>=Math.min(...previous))return [];
      return [{metricId:m.id,value,playerId:viewerId,name:player.name,matchId:latest.matchId,gameId:latest.gameId,civilization:player.civilization,orderAtMs:latest.orderAtMs,contextKey:latest.contextKey,model:player.models[m.id]}];
    });
  }
  highlights(limit=3):Highlight[]{
    const candidates:Highlight[]=[...this.leadershipChanges()];
    for(const g of this.games){
      for(const e of g.episodes.filter(e=>e.kind==='greatBattle'))candidates.push({id:`great:${g.matchId}:${g.gameId}:${e.id}`,category:'Military',title:'A Great Battle drew the armies together',detail:`${e.actors.map(id=>g.players.find(p=>p.playerId===id)?.name??id).join(', ')} · ${formatTime(e.atMs)}–${formatTime(e.endMs)}`,matchId:g.matchId,gameId:g.gameId,playerId:e.actors[0],priority:100});
      for(const p of g.players){const assisted=[...new Set(g.episodes.filter(e=>e.kind==='assist'&&e.actors.includes(p.playerId)).flatMap(e=>e.targets))];
        if(assisted.length>=2)candidates.push({id:`support:${g.matchId}:${p.playerId}`,category:'Military',title:`${p.name} assisted ${assisted.length} teammates`,detail:assisted.map(id=>g.players.find(p=>p.playerId===id)?.name??id).join(' · '),matchId:g.matchId,gameId:g.gameId,playerId:p.playerId,priority:80});
      }
    }
    // A short deterministic V1 catalogue. No filler for routine/all-equal results.
    const thresholds:Record<string,number>={raidsOut:4,assistsOut:3,total:30000,castle:1200000,forward:3};
    for(const m of METRICS.filter(m=>m.id in thresholds)){
      const records=this.records().filter(r=>r.metricId===m.id&&r.model!=='unknown');
      const groups=new Map<string,StatisticRecord[]>();
      for(const r of records){const key=r.contextKey+'|'+r.model;groups.set(key,[...(groups.get(key)??[]),r]);}
      for(const [key,holders] of groups){
        const r=holders[0];
        const values=this.games.filter(g=>g.contextKey===r.contextKey).flatMap(g=>g.players.filter(p=>p.models[m.id]===r.model).map(p=>p.values[m.id])).filter((v):v is number=>v!=null);
        if(values.length<2||new Set(values).size<2)continue;
        const typical=median(values)!;
        if(m.record==='min'?r.value>thresholds[m.id]||r.value>typical*.9:r.value<thresholds[m.id]||r.value<typical*1.25)continue;
        candidates.push({id:`record:${m.id}:${key}`,category:m.category,title:`${holders.map(h=>h.name).join(' & ')} · ${holders.length>1?'joint ':''}${m.record==='min'?'earliest':'largest'} ${m.label.toLowerCase()}`,detail:`${formatStatistic(r.value,m)} in one Game · within matching settings`,matchId:r.matchId,gameId:r.gameId,playerId:r.playerId,priority:m.id==='total'?10:20});
      }
    }
    const used=new Set<string>();
    return candidates.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).filter(h=>{const family=h.id.split(':').slice(0,2).join(':');if(used.has(family))return false;used.add(family);return true;}).slice(0,limit);
  }
}
export function formatTime(ms:number):string {const seconds=Math.round(ms/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
export function formatStatistic(value:number|null|undefined,metric:MetricDefinition):string {
  if(value==null)return '—';if(metric.unit==='ms')return formatTime(value);if(metric.unit==='seconds')return value.toFixed(1)+'s';
  return new Intl.NumberFormat('en-GB',{maximumFractionDigits:metric.unit==='percent'?1:1}).format(value)+(metric.unit==='percent'?'%':'');
}
