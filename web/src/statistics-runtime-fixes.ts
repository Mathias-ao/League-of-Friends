import {SeasonStatisticsExperience,seasonMetric,seasonMetricEligible,type SeasonRecord} from './domain/seasonStatistics';

/**
 * Statistics runtime corrections kept outside the replay measurement layer:
 * - "Most Battles" and "Most Castles" are Season-total record classes, not
 *   single-Battle peaks.
 * - archive tooltips are mirrored to a viewport layer so the horizontal ledger
 *   scroller can never clip them.
 */
const seasonTotalRecordMetricIds=new Set(['battlesFought','castles']);
const recordPatchMarker=Symbol.for('aof.statistics.season-total-records.v1');

function representativeSource(engine:SeasonStatisticsExperience,playerId:string,metricId:string,model:string){
  const metric=seasonMetric(metricId);
  for(let index=engine.games.length-1;index>=0;index--){
    const game=engine.games[index],player=game.players.find(candidate=>candidate.playerId===playerId);
    if(!player||!seasonMetricEligible(metric,game,player))continue;
    const value=player.values[metricId];
    if(typeof value!=='number'||!Number.isFinite(value)||player.models[metricId]!==model)continue;
    return {game,player};
  }
  return null;
}

function seasonTotalRecords(engine:SeasonStatisticsExperience,metricId:string):SeasonRecord[]{
  const metric=seasonMetric(metricId);
  if(!metric.record||metric.kind!=='number')return [];
  const candidates=engine.aggregate('allTime').filter(row=>{
    const value=row.values[metricId];
    return value.value!==null&&value.samples>0&&value.models.length===1&&value.models[0]!=='unknown';
  });
  if(!candidates.length)return [];
  const models=new Set(candidates.flatMap(row=>row.values[metricId].models));
  if(models.size!==1)return [];
  const model=[...models][0];
  const values=candidates.map(row=>row.values[metricId].value as number);
  const extreme=(metric.record==='max'?Math.max:Math.min)(...values);
  return candidates.filter(row=>row.values[metricId].value===extreme).flatMap(row=>{
    const source=representativeSource(engine,row.playerId,metricId,model);
    if(!source)return [];
    return [{metricId,value:extreme,playerId:row.playerId,name:row.name,matchId:source.game.matchId,gameId:source.game.gameId,civilization:source.player.civilization,orderAtMs:source.game.orderAtMs,contextKey:'__season_total__',model} satisfies SeasonRecord];
  });
}

const prototype=SeasonStatisticsExperience.prototype as typeof SeasonStatisticsExperience.prototype&Record<symbol,boolean>;
if(!prototype[recordPatchMarker]){
  const originalRecords=prototype.records;
  prototype.records=function correctedSeasonRecords(this:SeasonStatisticsExperience):SeasonRecord[]{
    const ordinary=originalRecords.call(this).filter(record=>!seasonTotalRecordMetricIds.has(record.metricId));
    const totals=[...seasonTotalRecordMetricIds].flatMap(metricId=>seasonTotalRecords(this,metricId));
    return [...ordinary,...totals];
  };
  prototype[recordPatchMarker]=true;
}

const aggregateRecordLabels=new Map([['Most Battles','Battles Fought'],['Most Castles','Castles']]);
const tooltipPortals=new Map<HTMLElement,HTMLElement>();
let observer:MutationObserver|null=null;
let listenersStarted=false;

function positionPortal(source:HTMLElement,portal:HTMLElement){
  const anchor=source.closest('.sx-tooltip-anchor') as HTMLElement|null;
  const trigger=anchor?.querySelector('.sx-metric-info-trigger') as HTMLElement|null;
  if(!trigger)return;
  const rect=trigger.getBoundingClientRect();
  const width=Math.min(300,Math.max(220,window.innerWidth-20));
  portal.style.width=`${width}px`;
  const measuredHeight=portal.getBoundingClientRect().height||70;
  const left=Math.max(10,Math.min(rect.left-8,window.innerWidth-width-10));
  const below=rect.bottom+8;
  const top=below+measuredHeight<=window.innerHeight-10?below:Math.max(10,rect.top-measuredHeight-8);
  portal.style.left=`${Math.round(left)}px`;
  portal.style.top=`${Math.round(top)}px`;
}

function syncTooltipPortals(){
  if(typeof document==='undefined')return;
  const sources=[...document.querySelectorAll<HTMLElement>('.sx-archive-tooltip:not(.sx-archive-tooltip-portal)')];
  const live=new Set(sources);
  for(const [source,portal] of tooltipPortals){
    if(live.has(source)&&source.isConnected)continue;
    portal.remove();
    tooltipPortals.delete(source);
  }
  for(const source of sources){
    let portal=tooltipPortals.get(source);
    if(!portal){
      portal=document.createElement('span');
      portal.className='sx-archive-tooltip sx-archive-tooltip-portal';
      portal.setAttribute('role','tooltip');
      portal.textContent=source.textContent??'';
      document.body.append(portal);
      source.style.visibility='hidden';
      tooltipPortals.set(source,portal);
    }
    positionPortal(source,portal);
  }
}

function syncAggregateRecordPresentation(){
  if(typeof document==='undefined')return;
  const leagueCaption=document.querySelector<HTMLElement>('.sx-league-records .sx-records-heading small');
  const caption='Absolute records · all formats · comparison independent';
  if(leagueCaption&&leagueCaption.textContent!==caption)leagueCaption.textContent=caption;
  document.querySelectorAll<HTMLButtonElement>('button.sx-record-plaque').forEach(plaque=>{
    const label=plaque.querySelector('strong')?.textContent?.trim()??'';
    const ledgerLabel=aggregateRecordLabels.get(label);
    if(!ledgerLabel)return;
    plaque.dataset.seasonTotalRecord='true';
    plaque.dataset.ledgerMetric=ledgerLabel;
    const aria=`${label}: ${plaque.querySelector('em')?.textContent?.trim()??''}, ${plaque.querySelector('b')?.textContent?.trim()??''}. Season-total record. Inspect the ledger for contributing evidence.`;
    if(plaque.getAttribute('aria-label')!==aria)plaque.setAttribute('aria-label',aria);
    const source=plaque.querySelector<HTMLElement>('.sx-record-source');
    const sourceLabel=plaque.closest('.sx-league-records')?'Season total · inspect ledger →':'Format total · inspect ledger →';
    if(source&&source.textContent!==sourceLabel)source.textContent=sourceLabel;
  });
}

function handleAggregateRecordClick(event:Event){
  const target=event.target as Element|null;
  const plaque=target?.closest<HTMLButtonElement>('button.sx-record-plaque[data-season-total-record="true"]');
  if(!plaque)return;
  event.preventDefault();
  event.stopPropagation();
  const metric=plaque.dataset.ledgerMetric;
  if(!metric)return;
  const row=[...document.querySelectorAll<HTMLTableRowElement>('.sx-season-table tbody tr')].find(candidate=>candidate.querySelector('.sx-metric-title')?.textContent?.trim().startsWith(metric));
  if(!row)return;
  row.scrollIntoView({behavior:'smooth',block:'center'});
  row.classList.add('sx-record-target-row');
  window.setTimeout(()=>row.classList.remove('sx-record-target-row'),1200);
}

export function syncStatisticsRuntimePolish(){syncTooltipPortals();syncAggregateRecordPresentation();}
export function startStatisticsRuntimeFixes(){
  if(typeof document==='undefined'||typeof window==='undefined')return;
  if(!observer){observer=new MutationObserver(()=>syncStatisticsRuntimePolish());observer.observe(document.documentElement,{childList:true,subtree:true});}
  if(!listenersStarted){document.addEventListener('click',handleAggregateRecordClick,true);window.addEventListener('resize',syncTooltipPortals,{passive:true});window.addEventListener('scroll',syncTooltipPortals,{passive:true,capture:true});listenersStarted=true;}
  syncStatisticsRuntimePolish();
}
if(typeof document!=='undefined')startStatisticsRuntimeFixes();
