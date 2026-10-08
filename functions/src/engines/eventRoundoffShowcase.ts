import {EXPERIENCE_VERSION, type GameStatistics} from './statisticsExperience.js';

export type ShowcaseCategory = 'Victory'|'Support'|'Development'|'Army'|'Pressure';
export interface ShowcaseSource {matchId:string;gameId?:string;revision:number;sourceHash?:string;model?:string;}
export interface EventShowcaseItem {
  id:string;catalogueId:string;rank:number;category:ShowcaseCategory;title:string;
  value:string;detail:string;playerIds:string[];sources:ShowcaseSource[];
}
export interface ShowcaseMatch {
  matchId:string;eventId?:string|null;status:string;scoringAct?:string|null;
  participants:Array<{playerId:string;team?:number|null}>;
  result?:{winningPlayerIds?:string[];revision?:number}|null;
}
/** Priority is editorial, never a second points calculation. Values retain parser semantics. */
export const EVENT_SHOWCASE_CATALOGUE = [
  {id:'unbeaten',rank:30,category:'Victory',title:'An unbeaten campaign'},
  {id:'assistsOut',rank:40,category:'Support',title:'At the defence of allies',minimum:2,family:'defence'},
  {id:'castle',rank:50,category:'Development',title:'First to Castle Age',minimum:1,family:'age',lower:true},
  {id:'army20',rank:60,category:'Army',title:'An army taking shape',minimum:1,family:'army',checkpoint:1200000},
  {id:'cooperation',rank:70,category:'Support',title:'A united offensive',minimum:2,family:'cooperation'},
  {id:'tributeSent',rank:80,category:'Support',title:'Resources for the alliance',minimum:500,family:'tribute'},
  {id:'raidsOut',rank:90,category:'Pressure',title:'Pressure on the enemy',minimum:3,family:'raids'},
  {id:'imperial',rank:100,category:'Development',title:'First to Imperial Age',minimum:1,family:'age',lower:true},
] as const;

const clock=(ms:number)=>{const s=Math.round(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const integer=(v:number)=>Math.round(v).toLocaleString('en-US');
const descriptions:Record<string,(v:number)=>[string,string]>={
  assistsOut:v=>[`${integer(v)} defensive assists`,'Most detected allied contributions inside a defended base. This measures support, not confirmed rescues.'],
  castle:v=>[`≈ ${clock(v)}`,'Earliest inferred Castle Age completion among measured players.'],
  imperial:v=>[`≈ ${clock(v)}`,'Earliest inferred Imperial Age completion among measured players.'],
  army20:v=>[`${integer(v)} resources at 20:00`,'Highest net military queue commitment at 20:00, valued at base catalogue costs. This measures investment, not surviving units.'],
  cooperation:v=>[`${integer(v)} coordinated attacks`,'Most detected episodes of allies attacking the same opponent.'],
  tributeSent:v=>[`${integer(v)} resources sent`,'Largest decoded tribute total sent to allies in this Game.'],
  raidsOut:v=>[`${integer(v)} detected raids`,'Most detected raid episodes in this Game. This does not measure kills or damage.'],
};

/** Input must come from the release producer's accepted, qualified recording snapshots.
 * The selector does not fetch data, publish results, qualify raw recordings or grant awards.
 * Illustrative evidence is an explicit preview-only opt-in, rejected by default.
 */
export function selectEventShowcase(input:{eventId:string;matches:ShowcaseMatch[];games:GameStatistics[];illustrative?:boolean}):EventShowcaseItem[]{
  const candidates:Array<EventShowcaseItem&{family:string}>=[];
  const uniqueMatches=input.matches.filter(m=>input.matches.filter(other=>other.matchId===m.matchId).length===1);
  const matches=uniqueMatches.filter(m=>m.eventId===input.eventId&&m.status==='COMPLETED'&&['WARMUP','MAIN'].includes(m.scoringAct??'')&&m.participants.length>=2&&new Set(m.participants.map(p=>p.playerId)).size===m.participants.length);
  const matchMap=new Map(matches.map(m=>[m.matchId,m]));
  const validResult=(m:ShowcaseMatch)=>Number.isInteger(m.result?.revision)&&m.result!.revision!>0&&!!m.result?.winningPlayerIds?.length&&new Set(m.result.winningPlayerIds).size===m.result.winningPlayerIds.length&&m.result.winningPlayerIds.length<m.participants.length&&m.result.winningPlayerIds.every(id=>m.participants.some(p=>p.playerId===id));
  const undefeated=[...new Set(matches.flatMap(m=>m.participants.map(p=>p.playerId)))].sort().filter(id=>{
    const slots=input.matches.filter(m=>m.eventId===input.eventId&&m.participants.some(p=>p.playerId===id)&&['WARMUP','MAIN'].includes(m.scoringAct??''));
    return slots.length===2&&slots.filter(m=>m.scoringAct==='WARMUP').length===1&&slots.filter(m=>m.scoringAct==='MAIN').length===1&&slots.every(m=>matchMap.has(m.matchId)&&validResult(m)&&m.result!.winningPlayerIds!.includes(id));
  });
  if(undefeated.length){
    const sources=matches.filter(m=>m.participants.some(p=>undefeated.includes(p.playerId))).map(m=>({matchId:m.matchId,revision:m.result!.revision!})).sort((a,b)=>a.matchId.localeCompare(b.matchId));
    candidates.push({id:'unbeaten',catalogueId:'unbeaten',rank:30,category:'Victory',title:'An unbeaten campaign',value:'2 wins · 2 Battles',detail:'Won both their designated warm-up and main Battle, from confirmed results.',playerIds:undefeated,sources,family:'victory'});
  }
  for(const game of input.games){
    const match=matchMap.get(game.matchId);
    if(!match||!game.eligible||game.exclusionReason||game.eventId!==input.eventId||game.version!==EXPERIENCE_VERSION||!game.contextKey||!Number.isInteger(game.revision)||game.revision<1||!game.gameId||game.evidenceTruncated||!Number.isFinite(game.durationMs)||game.durationMs<=0)continue;
    if(!input.illustrative&&!/^[a-f0-9]{64}$/i.test(game.sourceHash))continue;
    // Multiple snapshots of one Game are ambiguous: the producer must resolve the binding first.
    if(input.games.filter(g=>g.matchId===game.matchId&&g.gameId===game.gameId).length!==1)continue;
    if(game.players.length!==match.participants.length||new Set(game.players.map(p=>p.playerId)).size!==game.players.length||game.players.some(p=>!match.participants.some(q=>q.playerId===p.playerId&&q.team===p.team)))continue;
    for(const metric of EVENT_SHOWCASE_CATALOGUE){
      if(metric.id==='unbeaten')continue;
      const teamOnly=['assistsOut','cooperation','tributeSent'].includes(metric.id);
      if(teamOnly&&game.players.some(p=>p.team==null||!game.players.some(q=>q.playerId!==p.playerId&&q.team===p.team)))continue;
      if('checkpoint' in metric&&game.durationMs<metric.checkpoint)continue;
      const field=game.players.filter(p=>typeof p.values[metric.id]==='number'&&Number.isFinite(p.values[metric.id])&&p.values[metric.id]!>=0&&!!p.models[metric.id]&&!/unknown/i.test(p.models[metric.id])&&(input.illustrative||!/^ILLUSTRATIVE/i.test(p.models[metric.id])));
      const age='lower' in metric;
      // A missing age is not a slow age; other maxima require the full comparable field.
      if(field.length<2||(!age&&field.length!==game.players.length)||new Set(field.map(p=>p.models[metric.id])).size!==1)continue;
      const values=field.map(p=>p.values[metric.id]!);
      if(age&&values.some(v=>v<=0||v>game.durationMs))continue;
      if(new Set(values).size<2)continue;
      const value=age?Math.min(...values):Math.max(...values);
      if(value<metric.minimum)continue;
      const holders=field.filter(p=>p.values[metric.id]===value).map(p=>p.playerId).sort();
      const [label,description]=descriptions[metric.id](value);
      const source={matchId:game.matchId,gameId:game.gameId,revision:game.revision,sourceHash:game.sourceHash,model:field[0].models[metric.id]};
      candidates.push({id:`${metric.id}:${game.matchId}:${game.gameId}`,catalogueId:metric.id,rank:metric.rank,category:metric.category,title:metric.title,value:label,detail:`${match.scoringAct==='MAIN'?'Main Battle':'Warm-up'} · ${field.length} measured players. ${description}`,playerIds:holders,sources:[source],family:metric.family});
    }
  }
  const actOrder=(item:EventShowcaseItem)=>matchMap.get(item.sources[0]?.matchId)?.scoringAct==='MAIN'?0:1;
  // Compare performers within one Game; never pool unlike 1v1 and team contexts.
  candidates.sort((a,b)=>a.rank-b.rank||actOrder(a)-actOrder(b)||a.id.localeCompare(b.id));
  const selected:typeof candidates=[];
  const select=(playerCap:number)=>{
    for(const item of candidates){
      if(selected.length===5)break;
      if(selected.some(s=>s.family===item.family)||selected.filter(s=>s.category===item.category).length>=2||item.playerIds.some(id=>selected.filter(s=>s.playerIds.includes(id)).length>=playerCap))continue;
      selected.push(item);
    }
  };
  select(2);
  if(selected.length<3)select(3);
  return selected.sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id)).map(({family:_,...item})=>item);
}
