/** Source-current actual-play chronology. No scheduled/arrival timestamp is an occurrence witness.
 * Pure shared evidence contract for #139 and future optional private Chronicle.
 * Approval records are written only through the separate authenticated command.
 */
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {currentOfficialGameOutcome} from '../engines/recordingMatchFacts.js';
import {battleGameManifest} from '../engines/battleGameManifest.js';
import {resolveSeriesResult} from '../engines/seriesResult.js';

type Bag=Record<string,any>;
export const BATTLE_OCCURRENCE_VERSION='AOF_CANONICAL_BATTLE_OCCURRENCE_1' as const;
export type OccurrenceGame={gameId:string;game:Bag;source?:{
  sourceHash:string;gameGuid:string;mappingDigest:string;publicationAtMs:number|null}|null};
export interface OccurrenceBattle {
 battleId:string;match:Bag;event:Bag|null;plan:Bag|null;planId:string|null;
 games:OccurrenceGame[];occurrence?:Bag|null;
}
export type GameBounds={gameId:string;notBeforeMs:number;notAfterMs:number};
export type ReviewedPrecedence={battleId:string;sourceBinding:string;revision:number};
export type VerifiedOccurrence={battleId:string;binding:string;revision:number;
 startMs:number;endMs:number;bounds:GameBounds[];precedes:ReviewedPrecedence[]};
const id=(v:any):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v);
const ms=(v:any)=>Number.isSafeInteger(v)&&v>0;
const sorted=(a:string[])=>[...a].sort();
const equal=(a:any,b:any)=>bindingDigest(a)===bindingDigest(b);
export function canonicalOccurrenceGames(b:OccurrenceBattle):OccurrenceGame[]|null{
 const m=b.match,e=b.event;
 if(!id(b.battleId)||!m||!e||!id(m.eventId)||!id(m.seasonId)||e.seasonId!==m.seasonId||
  m.opponentKind==='AI'||m.replacementMatchId||m.activeResultDisputeId||m.status!=='COMPLETED'||
  !Array.isArray(m.participants)||m.participants.length<2||m.participants.length>8||
  m.participants.some((p:Bag)=>!id(p?.playerId))||
  new Set(m.participants.map((p:Bag)=>p.playerId)).size!==m.participants.length)return null;
 const isWarmup=m.scoringSnapshot?.rules?.act==='WARMUP';
 const membership=[e.officialMatchIds,e.warmupMatchIds].filter((a:any)=>Array.isArray(a)&&a.includes(b.battleId));
 if(membership.length!==1||Boolean(e.warmupMatchIds?.includes(b.battleId))!==isWarmup)return null;
 if(!isWarmup&&(m.sourceMatchPlanId!==b.planId||e.approvedMatchPlanId!==b.planId||
  e.matchPlanStatus!=='APPROVED'||b.plan?.status!=='APPROVED'||
  !Array.isArray(b.plan?.officialMatchIds)||b.plan.officialMatchIds[m.matchNumber-1]!==b.battleId))return null;
 if(!Array.isArray(b.games)||!b.games.length||new Set(b.games.map(g=>g.gameId)).size!==b.games.length)return null;
 const manifest=battleGameManifest(m,b.games.map(g=>({...g.game,gameId:g.gameId} as any)));
 if(!manifest.gameManifestComplete)return null;
 const needed=b.games.filter(g=>manifest.knownGameIds.includes(g.gameId)).sort((a,b)=>a.game.gameNumber-b.game.gameNumber);
 if(needed.length!==manifest.knownGameIds.length||needed.some((g,i)=>g.game.gameNumber!==i+1||
  g.game.status!=='COMPLETED'||g.game.activeResultDisputeId||
  currentOfficialGameOutcome(g.game,m).qualification!=='OFFICIAL'||!g.source||
  !/^[a-f0-9]{64}$/.test(g.source.sourceHash)||g.game.activeReplayStatisticsId!==g.source.sourceHash||
  typeof g.source.gameGuid!=='string'||!g.source.gameGuid||
  typeof g.source.mappingDigest!=='string'||!g.source.mappingDigest||
  !Array.isArray(g.game.players)||!equal(sorted(g.game.players.map((p:Bag)=>p.playerId)),sorted(m.participants.map((p:Bag)=>p.playerId)))))return null;
 if(m.seriesRule?.maxGames===1&&m.canonicalResult?.winningPlayerIds&&
  !equal(sorted(m.canonicalResult.winningPlayerIds),
    sorted(currentOfficialGameOutcome(needed[0].game,m).winnerPlayerIds)))return null;
 if(m.seriesRule?.maxGames>1){
  try{const winner=resolveSeriesResult(b.games.map(g=>({...g.game,gameId:g.gameId} as any)),m.seriesRule,m.participants);
    if(!m.canonicalResult||!equal(winner.seriesGameRevisions,m.canonicalResult.seriesGameRevisions)||
      winner.sourceGameId!==m.canonicalResult.sourceGameId||
      !equal(sorted(winner.result.winningPlayerIds),sorted(m.canonicalResult.winningPlayerIds)))return null;
  }catch{return null;}
 }else if(m.seriesRule?.maxGames!==1||needed.length!==1)return null;
 return needed;
}
/** Stable current authority: subject IDs, native Game identity, accepted result and roster,
 * independent of Firestore document IDs' lexical order or submission times. */
export function occurrenceSourceBinding(b:OccurrenceBattle):string|null{
 const needed=canonicalOccurrenceGames(b);if(!needed)return null;
 return bindingDigest([BATTLE_OCCURRENCE_VERSION,b.battleId,b.match.eventId,b.match.seasonId,
  b.match.format,b.match.seriesRule,b.match.scoringSnapshot?.rules?.act,
  sorted(b.match.participants.map((p:Bag)=>p.playerId)),b.match.canonicalResult??null,
  b.planId,b.event?.approvedMatchPlanId??null,
  needed.map(g=>[g.gameId,g.game.gameNumber,g.game.canonicalResult,g.game.players,
    g.source!.sourceHash,g.source!.gameGuid,g.source!.mappingDigest])]);
}
/** Presence, approval and binding all fail closed. A receipt is only an upper bound;
 * the stored lower bound must have been independently attested/reviewed. */
export function verifiedOccurrence(b:OccurrenceBattle):VerifiedOccurrence|null{
 const binding=occurrenceSourceBinding(b),o=b.occurrence;
 if(!binding||!o||o.version!==BATTLE_OCCURRENCE_VERSION||o.status!=='APPROVED'||
  o.battleId!==b.battleId||o.sourceBinding!==binding||
  !Number.isSafeInteger(o.revision)||o.revision<1||!Array.isArray(o.bounds))return null;
 const needed=canonicalOccurrenceGames(b)!;
 if(o.bounds.length!==needed.length||o.proof?.kind!=='MUTUAL_PARTICIPANTS'&&o.proof?.kind!=='ADMIN_REVIEWED')return null;
 const bounds:GameBounds[]=[];
 for(let i=0;i<needed.length;i++){
  const g=needed[i],p=o.bounds[i];
  if(p?.gameId!==g.gameId||!ms(p.notBeforeMs)||!ms(p.notAfterMs)||p.notBeforeMs>=p.notAfterMs||
    g.source!.publicationAtMs!==null&&ms(g.source!.publicationAtMs)&&p.notAfterMs>g.source!.publicationAtMs!)return null;
  if(i&&bounds[i-1].notAfterMs>=p.notBeforeMs)return null;
  bounds.push({gameId:g.gameId,notBeforeMs:p.notBeforeMs,notAfterMs:p.notAfterMs});
 }
 if(!Array.isArray(o.precedes)||o.precedes.some((v:any)=>!v||!id(v.battleId)||
  v.battleId===b.battleId||!/^[a-f0-9]{64}$/.test(v.sourceBinding??'')||
  !Number.isSafeInteger(v.revision)||v.revision<1)||
  new Set(o.precedes.map((v:any)=>v.battleId)).size!==o.precedes.length)return null;
 return {battleId:b.battleId,binding,revision:o.revision,startMs:bounds[0].notBeforeMs,
  endMs:bounds.at(-1)!.notAfterMs,bounds,precedes:o.precedes.map((v:any)=>({
    battleId:v.battleId,sourceBinding:v.sourceBinding,revision:v.revision}))};
}
export type OccurrenceComparison='BEFORE'|'AFTER'|'UNKNOWN'|'CONFLICT';
/** Transitive strict proof, including attested before edges. No total ranking is stored.
 * Inconsistent intervals, cycles and equal boundaries are deliberately not sorted. */
export function compareOccurrence(a:string,b:string,all:OccurrenceBattle[]):OccurrenceComparison{
 if(a===b)return 'UNKNOWN';
 const proven=new Map(all.map(x=>[x.battleId,verifiedOccurrence(x)]));
 if(!proven.get(a)||!proven.get(b))return 'UNKNOWN';
 const ids=[...proven.keys()].filter(k=>proven.get(k));
 const edges=new Map(ids.map(k=>[k,new Set<string>()]));
 for(const x of ids)for(const y of ids){
  if(x===y)continue;
  const l=proven.get(x)!,r=proven.get(y)!;
  if(l.endMs<r.startMs)edges.get(x)!.add(y);
 }
 for(const x of ids)for(const edge of proven.get(x)!.precedes){
  const y=edge.battleId,target=proven.get(y);
  // A predecessor proof is never carried across a corrected/reapproved target.
  if(!target||target.binding!==edge.sourceBinding||target.revision!==edge.revision)continue;
  if(target.endMs<proven.get(x)!.startMs)return 'CONFLICT';
  edges.get(x)!.add(y);
 }
 const reach=(from:string,to:string)=>{
  const seen=new Set<string>(),queue=[from];
  while(queue.length){const head=queue.shift()!;for(const next of edges.get(head)??[]){
    if(next===to)return true;if(!seen.has(next)){seen.add(next);queue.push(next);}
  }}return false;
 };
 const ab=reach(a,b),ba=reach(b,a);
 return ab&&ba?'CONFLICT':ab?'BEFORE':ba?'AFTER':'UNKNOWN';
}
/** First third distinct *official* canonical 1v1 Battle loss only, never an offer.
 * Missing source/result/relative order is not evidence of a non-loss. */
export function qualifyThreeBattleLosses(battles:OccurrenceBattle[],respondentPlayerId:string){
 type Loss={battleId:string;opponentPlayerId:string;sourceBinding:string;gameKeys:string[]};
 const losses:Loss[]=[],possible=new Map<string,Set<string>>();
 // Caller should supply a complete authenticated enumeration. Duplicate
 // Battle/GUID sources can never be counted as independent losses.
 if(new Set(battles.map(b=>b.battleId)).size!==battles.length)return [];
 const seenGameGuids=new Set<string>();
 for(const b of battles)for(const g of b.games)if(g.source){
  if(seenGameGuids.has(g.source.gameGuid))return [];
  seenGameGuids.add(g.source.gameGuid);
 }
 for(const b of battles){
  if(!b.match?.participants?.some((p:Bag)=>p.playerId===respondentPlayerId))continue;
  const players=b.match.participants;
  if(b.match.format!=='ONE_V_ONE'||!Array.isArray(players)||players.length!==2)continue;
  const opponent=players.find((p:Bag)=>p.playerId!==respondentPlayerId)?.playerId;
  if(!id(opponent))continue;
  const uncertain=()=>{const set=possible.get(opponent)??new Set<string>();set.add(b.battleId);possible.set(opponent,set);};
  const needed=canonicalOccurrenceGames(b),binding=occurrenceSourceBinding(b);
  if(!needed||!binding){uncertain();continue;}
  const winners=b.match.seriesRule.maxGames===1?
    currentOfficialGameOutcome(needed[0].game,b.match).winnerPlayerIds:
    b.match.canonicalResult?.winningPlayerIds;
  if(!Array.isArray(winners)||winners.length!==1){uncertain();continue;}
  // Verified non-loss does not require a historical position; it cannot be a
  // predecessor loss regardless of when this Battle occurred.
  if(winners[0]===respondentPlayerId)continue;
  const occ=verifiedOccurrence(b);
  if(!occ){uncertain();continue;}
  if(winners[0]===opponent)losses.push({battleId:b.battleId,opponentPlayerId:opponent,
    sourceBinding:binding,gameKeys:needed.map(g=>g.gameId+':'+g.source!.sourceHash+':'+g.source!.gameGuid)});
 }
 const results:Array<{respondentPlayerId:string;opponentPlayerId:string;anchorBattleId:string;
  witnessBattleIds:string[];qualification:'THIRD_LOSS_SOURCE_QUALIFIED';revision:string}>=[];
 for(const opponent of new Set(losses.map(l=>l.opponentPlayerId))){
  const candidates=losses.filter(l=>l.opponentPlayerId===opponent);
  if(candidates.length<3)continue;
  // Only accept a unique first-three chain and prove every other possible earlier
  // same-opponent Battle cannot change the third anchor.
  const sortedLosses=[...candidates].sort((a,b)=>{
    const relation=compareOccurrence(a.battleId,b.battleId,battles);
    return relation==='BEFORE'?-1:relation==='AFTER'?1:0;
  });
  if(sortedLosses.some((l,i)=>i>0&&compareOccurrence(sortedLosses[i-1].battleId,l.battleId,battles)!=='BEFORE'))continue;
  const anchor=sortedLosses[2];
  if((possible.get(opponent)??new Set()).size)continue; // No guessed earlier non-loss.
  if(sortedLosses.slice(3).some(l=>compareOccurrence(anchor.battleId,l.battleId,battles)!=='BEFORE'))continue;
  const trio=sortedLosses.slice(0,3);
  results.push({respondentPlayerId,opponentPlayerId:opponent,anchorBattleId:anchor.battleId,
    witnessBattleIds:trio.map(l=>l.battleId),qualification:'THIRD_LOSS_SOURCE_QUALIFIED',
    revision:bindingDigest([BATTLE_OCCURRENCE_VERSION,respondentPlayerId,opponent,
      trio.map(l=>[l.battleId,l.sourceBinding,l.gameKeys])])});
 }
 return results.sort((a,b)=>a.anchorBattleId.localeCompare(b.anchorBattleId));
}
