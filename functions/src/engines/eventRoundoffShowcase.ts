import {EXPERIENCE_VERSION,type GameStatistics,type PlayerMeasurement} from './statisticsExperience.js';
import {EVENT_SHOWCASE_CATALOGUE,EVENT_SHOWCASE_METRICS,type MetricRule,type ShowcaseTier,type ShowcaseCategory,type ShowcaseEmblem} from './eventRoundoffCatalogue.js';
export * from './eventRoundoffCatalogue.js';

export interface ShowcaseSource {matchId:string;gameId?:string;revision:number;sourceHash?:string;model?:string;act?:string|null;role?:'EVENT'|'HISTORY';}
export interface EventShowcaseItem {
  id:string;catalogueId:string;rank:number;tier:ShowcaseTier;category:ShowcaseCategory;emblem:ShowcaseEmblem;
  title:string;value:string;detail:string;playerIds:string[];sources:ShowcaseSource[];
}
export interface ShowcaseMatch {
  countedWarmupPlayerIds?:string[];
  matchId:string;eventId?:string|null;format?:string|null;status:string;scoringAct?:string|null;
  /** Producer-owned manifest of accepted Games, including series Games. Never inferred from uploads. */
  acceptedGameIds?:string[];
  /** Pinned from approved Game configuration; unknown cannot qualify static age thresholds. */
  standardStart?:boolean;
  /** Pinned before warm-up play. This recognition never changes main-event bounty points. */
  emperorPlayerIdAtApproval?:string|null;
  participants:Array<{playerId:string;team?:number|null}>;
  result?:{winningPlayerIds?:string[];revision?:number}|null;
}
export interface EventShowcaseInput {
  eventId:string;matches:ShowcaseMatch[];games:GameStatistics[];
  /** Only already published, qualified history, supplied by the release producer. */
  publishedHistory?:GameStatistics[];illustrative?:boolean;
}
const entry=(id:string,tier:ShowcaseTier)=>EVENT_SHOWCASE_CATALOGUE.find(e=>e.accomplishmentId===id&&e.tier===tier)!;
const key=(g:Pick<GameStatistics,'matchId'|'gameId'>)=>`${g.matchId}\u0000${g.gameId}`;
const integer=(n:number)=>Math.round(n).toLocaleString('en-US');
const clock=(ms:number)=>{const s=Math.round(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const median=(values:number[])=>{const a=[...values].sort((x,y)=>x-y);return a.length%2?a[Math.floor(a.length/2)]:(a[a.length/2-1]+a[a.length/2])/2;};
const sourceSort=(a:ShowcaseSource,b:ShowcaseSource)=>a.matchId.localeCompare(b.matchId)||(a.gameId??'').localeCompare(b.gameId??'')||a.revision-b.revision;
const uniqueSources=(sources:ShowcaseSource[])=>[...new Map(sources.map(s=>[`${s.role}:${s.matchId}:${s.gameId??''}:${s.revision}`,s])).values()].sort(sourceSort);
const measured=(p:PlayerMeasurement,id:string,illustrative:boolean)=>typeof p.values[id]==='number'&&Number.isFinite(p.values[id])&&p.values[id]!>=0&&typeof p.models[id]==='string'&&!!p.models[id]&&!/unknown/i.test(p.models[id])&&(illustrative||!/^ILLUSTRATIVE/i.test(p.models[id]));
const basicGame=(g:GameStatistics,illustrative:boolean)=>g.eligible&&!g.exclusionReason&&g.version===EXPERIENCE_VERSION&&!!g.contextKey&&!!g.gameId&&!!g.matchId&&Number.isInteger(g.revision)&&g.revision>0&&!g.evidenceTruncated&&Number.isFinite(g.durationMs)&&g.durationMs>0&&(illustrative||/^[a-f0-9]{64}$/i.test(g.sourceHash));
const allied=(g:GameStatistics,p:PlayerMeasurement)=>p.team!=null&&g.players.some(q=>q.playerId!==p.playerId&&q.team===p.team);
const resultValid=(m:ShowcaseMatch)=>Number.isInteger(m.result?.revision)&&m.result!.revision!>0&&!!m.result?.winningPlayerIds?.length&&new Set(m.result.winningPlayerIds).size===m.result.winningPlayerIds.length&&m.result.winningPlayerIds.length<m.participants.length&&m.result.winningPlayerIds.every(id=>m.participants.some(p=>p.playerId===id));
type Candidate=EventShowcaseItem&{family:string;score:number;lower?:boolean;model?:string};
const make=(id:string,tier:ShowcaseTier,category:ShowcaseCategory,players:string[],value:string,detail:string,sources:ShowcaseSource[],family:string,score=0):Candidate=>{
  const row=entry(id,tier);return {id:`${row.id}:${[...players].sort().join(',')}`,catalogueId:row.id,rank:row.rank,tier,category,emblem:row.emblem,title:row.title,value,detail,playerIds:[...players].sort(),sources:uniqueSources(sources),family,score};
};
const label=(r:MetricRule,value:number)=>r.age?`≈ ${clock(value)}`:`${r.aggregation==='GOLD'?value.toFixed(2):r.aggregation==='APM'?value.toFixed(1):r.aggregation==='RESPONSES'?value.toFixed(1):integer(value)} ${r.unit}`;
const gameLabel=(r:MetricRule,value:number)=>r.aggregation==='GOLD'?`≈ ${value.toFixed(1)}% gold influence`:label(r,value);

/** Pure curation helper. Does not fetch, qualify raw recordings, grant awards or publish.
 * Producer resolves accepted Game manifests and canonical source bindings before calling.
 * Totals require every applicable accepted Game; unknown is never zero.
 */
export function selectEventShowcase(input:EventShowcaseInput):EventShowcaseItem[]{return selectShowcase(input);}

/** One accepted Game, using the Event catalogue without campaign or historical claims. */
export function selectBattleShowcase(input:{match:ShowcaseMatch;game:GameStatistics;illustrative?:boolean}):EventShowcaseItem[]{
  if(input.match.status==='DISPUTED'||input.match.status==='CANCELLED'||input.match.status==='VOID')return [];
  return selectShowcase({eventId:input.game.eventId??'',matches:[{...input.match,acceptedGameIds:[input.game.gameId]}],games:[input.game],illustrative:input.illustrative},true).slice(0,4);
}

function selectShowcase(input:EventShowcaseInput,battle=false):EventShowcaseItem[]{
  const illustrative=input.illustrative===true,candidates:Candidate[]=[];
  const eventMatches=input.matches.filter(m=>(battle||m.eventId===input.eventId)&&m.status!=='CANCELLED');
  const matches=eventMatches.filter(m=>(battle||m.status==='COMPLETED')&&eventMatches.filter(q=>q.matchId===m.matchId).length===1&&m.participants.length>=2&&new Set(m.participants.map(p=>p.playerId)).size===m.participants.length);
  const matchMap=new Map(matches.map(m=>[m.matchId,m]));
  const source=(g:GameStatistics,metric:string,player:PlayerMeasurement,role:'EVENT'|'HISTORY'='EVENT'):ShowcaseSource=>({matchId:g.matchId,gameId:g.gameId,revision:g.revision,sourceHash:g.sourceHash,model:player.models[metric],act:matchMap.get(g.matchId)?.scoringAct,role});
  const resultSource=(m:ShowcaseMatch):ShowcaseSource=>({matchId:m.matchId,revision:m.result!.revision!,act:m.scoringAct,role:'EVENT'});
  const manifestValid=(m:ShowcaseMatch)=>Array.isArray(m.acceptedGameIds)&&m.acceptedGameIds.length>0&&new Set(m.acceptedGameIds).size===m.acceptedGameIds.length;
  const games=input.games.filter(g=>{
    const m=matchMap.get(g.matchId);
    return !!m&&manifestValid(m)&&m.acceptedGameIds!.includes(g.gameId)&&(battle?g.eventId===(m.eventId??null):g.eventId===input.eventId)&&basicGame(g,illustrative)&&(!m.format||m.format===g.format)&&input.games.filter(q=>key(q)===key(g)).length===1&&input.games.filter(q=>q.sourceHash===g.sourceHash&&key(q)!==key(g)).length===0&&g.players.length===m.participants.length&&new Set(g.players.map(p=>p.playerId)).size===g.players.length&&g.players.every(p=>m.participants.some(q=>q.playerId===p.playerId&&(q.team??null)===p.team));
  }).sort((a,b)=>key(a).localeCompare(key(b)));
  const gameMap=new Map(games.map(g=>[key(g),g]));
  const playerIds=[...new Set(eventMatches.flatMap(m=>m.participants.map(p=>p.playerId)))].sort();
  const counts=(m:ShowcaseMatch,id:string)=>battle||m.scoringAct!=='WARMUP'||m.countedWarmupPlayerIds==null||m.countedWarmupPlayerIds.includes(id);
  const complete=(id:string)=>eventMatches.filter(m=>m.participants.some(p=>p.playerId===id)&&counts(m,id)).every(m=>matchMap.has(m.matchId)&&manifestValid(m)&&m.acceptedGameIds!.every(gameId=>gameMap.has(key({matchId:m.matchId,gameId}))));
  const emperorWins=matches.filter(m=>m.scoringAct==='WARMUP'&&m.format==='ONE_V_ONE'&&m.participants.length===2&&!!m.emperorPlayerIdAtApproval&&m.participants.some(p=>p.playerId===m.emperorPlayerIdAtApproval)&&resultValid(m)&&m.result!.winningPlayerIds!.length===1&&m.result!.winningPlayerIds![0]!==m.emperorPlayerIdAtApproval&&eventMatches.filter(q=>q.scoringAct==='WARMUP'&&q.participants.some(p=>p.playerId===m.emperorPlayerIdAtApproval)).length===1);
  if(!battle&&emperorWins.length===1){const m=emperorWins[0];candidates.push(make('emperor','SPECIAL','Victory',m.result!.winningPlayerIds!,'1 duel won','Sole confirmed winner against the Emperor pinned before this designated 1v1 warm-up. Team games and FFA do not qualify.',[resultSource(m)],'emperor'));}
  const unbeaten=playerIds.filter(id=>{
    const slots=eventMatches.filter(m=>m.participants.some(p=>p.playerId===id)&&counts(m,id)&&['WARMUP','MAIN'].includes(m.scoringAct??''));
    return slots.length===2&&slots.filter(m=>m.scoringAct==='WARMUP').length===1&&slots.filter(m=>m.scoringAct==='MAIN').length===1&&slots.every(m=>matchMap.has(m.matchId)&&resultValid(m)&&m.result!.winningPlayerIds!.includes(id));
  });
  if(!battle&&unbeaten.length)candidates.push(make('unbeaten','EXCEPTIONAL','Victory',unbeaten,'2 wins · 2 Matches','Won both their designated warm-up and main Match, from confirmed result revisions.',matches.filter(m=>['WARMUP','MAIN'].includes(m.scoringAct??'')&&m.participants.some(p=>unbeaten.includes(p.playerId))).map(resultSource),'victory'));
  const great:MetricRule={id:'greatBattles',title:'',category:'Army',emblem:'swords',family:'great-battle',aggregation:'SUM',thresholds:[Infinity,1,2],unit:'detected Great Battles',meaning:battle?'Participation in detected Great Battle episodes in this Game.':'Participation in detected Great Battle episodes across Event Games.'};
  for(const rule of [...EVENT_SHOWCASE_METRICS,great]){
    const field:Candidate[]=[];
    for(const id of playerIds){
      const all=games.filter(g=>g.players.some(p=>p.playerId===id)&&counts(matchMap.get(g.matchId)!,id));
      const applicable=all.filter(g=>{
        const p=g.players.find(p=>p.playerId===id)!;
        return (!rule.teamOnly||allied(g,p))&&(!rule.age||matchMap.get(g.matchId)?.standardStart===true)&&(!rule.checkpoint||g.durationMs>=rule.checkpoint);
      });
      if(!applicable.length||(['SUM','APM','GOLD','RESPONSES'].includes(rule.aggregation)&&!complete(id)))continue;
      const samples=applicable.map(g=>({g,p:g.players.find(p=>p.playerId===id)!}));
      const valid=samples.filter(({g,p})=>measured(p,rule.id,illustrative)&&(!rule.age||(p.values[rule.id]!>0&&p.values[rule.id]!<=g.durationMs))&&(rule.id!=='goldControl'||p.values[rule.id]!<=100));
      if(!valid.length||(rule.aggregation!=='BEST'&&valid.length!==samples.length)||new Set(valid.map(({p})=>p.models[rule.id])).size!==1)continue;
      let value:number,peak=0,used=valid;
      if(rule.aggregation==='SUM')value=valid.reduce((n,{p})=>n+p.values[rule.id]!,0);
      else if(rule.aggregation==='GOLD'||rule.aggregation==='APM'){
        const minutes=valid.reduce((n,{g})=>n+g.durationMs/60000,0);
        if(rule.aggregation==='APM'&&minutes<20)continue;
        value=valid.reduce((n,{g,p})=>n+p.values[rule.id]!*(rule.aggregation==='GOLD'?g.players.length/100:1)*g.durationMs/60000,0)/minutes;
        peak=Math.max(...valid.map(({p})=>p.values[rule.id]!));
      }else if(rule.aggregation==='RESPONSES'){
        const responses=valid.flatMap(({p})=>p.responseTimes);
        if(responses.length<3||responses.some(n=>!Number.isFinite(n)||n<0))continue;
        value=median(responses);
      }else{
        value=(rule.lower?Math.min:Math.max)(...valid.map(({p})=>p.values[rule.id]!));
        used=valid.filter(({p})=>p.values[rule.id]===value);
      }
      const tierIndex=[2,1,0].find(t=>(rule.lower?value<=rule.thresholds[t]+1e-9:value>=rule.thresholds[t]-1e-9)&&(rule.aggregation!=='GOLD'||peak>=[20,30,40][t]));
      if(tierIndex===undefined)continue;
      const tier=(['NOTABLE','EXCEPTIONAL','EXTRAORDINARY'] as const)[tierIndex];
      const coverage=battle?'Qualified measurement from this Game.':rule.aggregation==='BEST'?`Best eligible performance across ${applicable.length} Game${applicable.length===1?'':'s'}.`:`Event ${rule.aggregation==='SUM'?'total':'measurement'} across ${valid.length} applicable Game${valid.length===1?'':'s'}. Warm-up and main Games are considered.`;
      const goldDetail=rule.aggregation==='GOLD'?` ${battle?'Game':'Event'} index ${value.toFixed(2)} × equal share. ${valid.map(({g,p})=>`${matchMap.get(g.matchId)?.scoringAct==='WARMUP'?'Warm-up':'Game'}: ≈ ${p.values.goldControl!.toFixed(1)}%`).join('; ')}.`:'';
      const card=make(rule.id,tier,rule.category,[id],rule.aggregation==='GOLD'?`≈ ${peak.toFixed(1)}% peak influence`:label(rule,value),`${coverage} ${battle?rule.meaning.replaceAll('across Event Games','in this Game').replaceAll('summed across Games','in this Game'):rule.meaning}${goldDetail}`,used.map(({g,p})=>source(g,rule.id,p)),rule.family,value);
      if(battle&&rule.id==='raidsOut')card.title='Raiding pressure';
      card.lower=rule.lower;card.model=valid[0].p.models[rule.id];field.push(card);
    }
    if(new Set(field.map(c=>c.model)).size!==1)continue;
    field.sort((a,b)=>a.rank-b.rank||(rule.lower?a.score-b.score:b.score-a.score)||a.id.localeCompare(b.id));
    if(field.length){const best=field[0],ties=field.filter(c=>c.rank===best.rank&&c.score===best.score);best.playerIds=ties.flatMap(c=>c.playerIds).sort();best.sources=uniqueSources(ties.flatMap(c=>c.sources));best.id=`${best.catalogueId}:${best.playerIds.join(',')}`;candidates.push(best);}
  }
  // Historical comparisons are Game measurements, never Event totals or automatic awards.
  const eventStart=Math.min(...games.map(g=>g.orderAtMs));
  const history=(input.publishedHistory??[]).filter(g=>g.eventId!==input.eventId&&g.orderAtMs<eventStart&&basicGame(g,illustrative)&&!games.some(e=>e.sourceHash===g.sourceHash)&&(input.publishedHistory??[]).filter(q=>key(q)===key(g)).length===1&&!(input.publishedHistory??[]).some(q=>q.sourceHash===g.sourceHash&&key(q)!==key(g)));
  for(const g of (battle?[]:games))for(const p of g.players)for(const rule of EVENT_SHOWCASE_METRICS){
    if(!measured(p,rule.id,illustrative)||p.values[rule.id]===0||(rule.teamOnly&&!allied(g,p))||(rule.age&&(matchMap.get(g.matchId)?.standardStart!==true||p.values[rule.id]!>g.durationMs))||(rule.checkpoint&&g.durationMs<rule.checkpoint))continue;
    for(const scope of ['league-record','season-record','personal-best'] as const){
      if(scope==='league-record'&&!g.affectsLifetime||scope==='season-record'&&!g.affectsSeason)continue;
      const previous=history.filter(h=>h.contextKey===g.contextKey&&(scope!=='league-record'||h.affectsLifetime)&&(scope!=='season-record'||h.affectsSeason&&!!g.seasonId&&h.seasonId===g.seasonId)).flatMap(h=>h.players.filter(q=>(scope!=='personal-best'||q.playerId===p.playerId)&&measured(q,rule.id,illustrative)&&q.values[rule.id]!>0&&q.models[rule.id]===p.models[rule.id]&&(!rule.teamOnly||allied(h,q))&&(!rule.checkpoint||h.durationMs>=rule.checkpoint)&&(!rule.age||q.values[rule.id]!<=h.durationMs)).map(q=>({h,q})));
      if(!previous.length||scope==='personal-best'&&new Set(previous.map(({h})=>key(h))).size<3)continue;
      const old=(rule.lower?Math.min:Math.max)(...previous.map(({q})=>q.values[rule.id]!)),value=p.values[rule.id]!;
      const improvement=rule.lower?(old-value)/old:(value-old)/old;
      if(improvement<=0||scope==='personal-best'&&improvement<.1-1e-12)continue;
      const holder=previous.filter(({q})=>q.values[rule.id]===old).sort((a,b)=>key(a.h).localeCompare(key(b.h)))[0];
      const tier=scope==='league-record'?'EXTRAORDINARY':scope==='season-record'?'EXCEPTIONAL':'NOTABLE';
      candidates.push(make(scope,tier,'History',[p.playerId],gameLabel(rule,value),`${rule.title}: ${gameLabel(rule,value)}; previous published best ${gameLabel(rule,old)}. Same context and measurement model.`,[source(g,rule.id,p),source(holder.h,rule.id,holder.q,'HISTORY')],rule.family,improvement));
    }
  }
  candidates.sort((a,b)=>a.rank-b.rank||(a.lower?a.score-b.score:b.score-a.score)||a.id.localeCompare(b.id));
  const selected:Candidate[]=[];
  // Ranking is primary. Diversity cannot displace a higher-ranked eligible accomplishment.
  for(const item of candidates){if(selected.length===5)break;if(selected.some(s=>s.family===item.family||s.catalogueId===item.catalogueId))continue;selected.push(item);}
  return selected.map(({family:_,score:__,lower:___,model:____,...item})=>item);
}
