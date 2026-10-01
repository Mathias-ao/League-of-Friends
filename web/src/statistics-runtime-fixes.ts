import {SEASON_METRICS,SeasonStatisticsExperience,formatSeasonRecord,seasonMetricEligible,type SeasonMetricDefinition,type SeasonDisplayMode,type SeasonAggregatePlayer} from './domain/seasonStatistics';

/**
 * Small presentation corrections kept outside the replay measurement layer:
 * - archive tooltips are mirrored to a viewport layer so the horizontal ledger
 *   scroller can never clip them.
 * - the ledger keeps its aggregate value as the primary result and adds each
 *   player's best qualified single-Battle performance underneath it.
 *
 * Season Records themselves are intentionally left untouched here. They remain
 * single-Battle records, including additive metrics such as Battles Fought and
 * Castles. The All-time ledger may total those metrics, but the record cabinet
 * never turns that cumulative total into a record claim.
 */

const metricDisplayLabels:Record<string,string>={villagers10:'Villagers at 10 Minutes',commands5:'Commands by Minute 5',scouting:'Scout Coverage by Minute 5',villagers20:'Villagers at 20 Minutes',ecoMilitary20:'Economy–Military Ratio at 20 Minutes',militaryBuildingsCastle:'Military Buildings by Castle Age',blacksmith30:'Blacksmith Technologies by Minute 30',army10:'Army Commitment by Minute 10',army15:'Army Commitment by Minute 15',army20:'Army Commitment by Minute 20'};
const displayMetricLabel=(metric:SeasonMetricDefinition)=>metricDisplayLabels[metric.id]??metric.label;
const metricByDisplayLabel=new Map(SEASON_METRICS.map(metric=>[displayMetricLabel(metric),metric] as const));

interface BestBattlePresentation{formatted:string;samples:number;}
const bestBattleValues=new Map<string,Map<string,BestBattlePresentation>>();
const aggregatePatchMarker=Symbol.for('aof.statistics.best-battle-values.v1');

function captureBestBattleValues(engine:SeasonStatisticsExperience,rows:SeasonAggregatePlayer[]){
  bestBattleValues.clear();
  for(const row of rows){
    const playerValues=new Map<string,BestBattlePresentation>();
    for(const metric of SEASON_METRICS){
      if(metric.kind!=='number'||!metric.record)continue;
      const candidates=engine.games.flatMap(game=>{
        const player=game.players.find(candidate=>candidate.playerId===row.playerId);
        if(!player||!seasonMetricEligible(metric,game,player))return [];
        const value=player.values[metric.id],model=player.models[metric.id];
        if(typeof value!=='number'||!Number.isFinite(value)||!model||model==='unknown')return [];
        return [{value,model}];
      });
      if(!candidates.length)continue;
      const models=new Set(candidates.map(candidate=>candidate.model));
      if(models.size!==1)continue;
      const values=candidates.map(candidate=>candidate.value);
      const best=(metric.record==='max'?Math.max:Math.min)(...values);
      playerValues.set(metric.id,{formatted:formatSeasonRecord(best,metric),samples:values.length});
    }
    bestBattleValues.set(row.name,playerValues);
  }
}

const prototype=SeasonStatisticsExperience.prototype as typeof SeasonStatisticsExperience.prototype&Record<symbol,boolean>;
if(!prototype[aggregatePatchMarker]){
  const originalAggregate=prototype.aggregate;
  prototype.aggregate=function aggregateWithBestBattleCache(this:SeasonStatisticsExperience,mode:SeasonDisplayMode='perBattle'):SeasonAggregatePlayer[]{
    const rows=originalAggregate.call(this,mode);
    captureBestBattleValues(this,rows);
    return rows;
  };
  prototype[aggregatePatchMarker]=true;
}

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

function syncBestBattlePresentation(){
  if(typeof document==='undefined')return;
  document.querySelectorAll<HTMLTableElement>('.sx-season-table').forEach(table=>{
    const playerNames=[...table.querySelectorAll<HTMLElement>('thead .sx-player-name')].map(node=>node.textContent?.trim()??'');
    table.querySelectorAll<HTMLTableRowElement>('tbody tr:not(.sx-family-row)').forEach(row=>{
      const label=row.querySelector<HTMLElement>('.sx-metric-title > span:first-child')?.textContent?.trim()??'';
      const metric=metricByDisplayLabel.get(label);
      const cells=[...row.children].filter(child=>child.tagName==='TD') as HTMLTableCellElement[];
      cells.forEach((cell,index)=>{
        const button=cell.querySelector<HTMLButtonElement>('.sx-value-button');
        const existing=cell.querySelector<HTMLElement>('.sx-value-best');
        const best=metric&&playerNames[index]?bestBattleValues.get(playerNames[index])?.get(metric.id):undefined;
        if(!button||!best){existing?.remove();return;}
        const text=`(best ${best.formatted})`;
        if(existing){if(existing.textContent!==text)existing.textContent=text;return;}
        const note=document.createElement('small');
        note.className='sx-value-best';
        note.textContent=text;
        button.append(note);
      });
    });
  });
}

export function syncStatisticsRuntimePolish(){syncTooltipPortals();syncBestBattlePresentation();}
export function startStatisticsRuntimeFixes(){
  if(typeof document==='undefined'||typeof window==='undefined')return;
  if(!observer){observer=new MutationObserver(()=>syncStatisticsRuntimePolish());observer.observe(document.documentElement,{childList:true,subtree:true});}
  if(!listenersStarted){window.addEventListener('resize',syncTooltipPortals,{passive:true});window.addEventListener('scroll',syncTooltipPortals,{passive:true,capture:true});listenersStarted=true;}
  syncStatisticsRuntimePolish();
}
if(typeof document!=='undefined')startStatisticsRuntimeFixes();
