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
  sourceHash:string;gameGuid:string;mappingDigest:string;provenanceDigest:string;publicationAtMs:number|null}|null};
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
/** Only a trusted immutable READY source's own server-created receipt
 * qualifies as an upper bound for play. Ordinary AUTO writes uploadedAt on
 * the READY source; reviewed native publication writes publication.publishedAt.
 * Candidate/journal timestamps, result times and raw replay headers are never
 * substituted. Missing or unrecognised receipts remain null. */
export function sourceBoundReadyReceiptMillis(source:Bag|null|undefined,
 matchId:string,gameId:string,sourceHash:string):number|null{
 if(source?.state!=='READY'||source.matchId!==matchId||
    source.gameId!==gameId||source.sourceHash!==sourceHash||
    !/^[a-f0-9]{64}$/.test(sourceHash))return null;
 const trusted=(value:any):number|null=>{
  try{const n=value?.toMillis?.();return Number.isSafeInteger(n)&&n>0?n:null;}
  catch{return null;}
 };
 const ordinary=source.ordinaryUploadVersion==='AOF_NATIVE_PLAYER_UPLOAD_V1'
   ?trusted(source.uploadedAt):null;
 const reviewed=source.publication?.version&&source.publication?.publicationId
   ?trusted(source.publication.publishedAt):null;
 const known=[ordinary,reviewed].filter((n):n is number=>n!==null);
 return known.length?Math.min(...known):null;
}

const list=(v:any)=>Array.isArray(v)&&v.every(id)&&new Set(v).size===v.length;
export function canonicalOccurrenceGames(b:OccurrenceBattle):OccurrenceGame[]|null{
 const m=b.match,e=b.event;
 if(!id(b.battleId)||!m||!e||!id(m.eventId)||!id(m.seasonId)||e.seasonId!==m.seasonId||
  m.opponentKind==='AI'||m.replacementMatchId||m.activeResultDisputeId||m.status!=='COMPLETED'||
  !Array.isArray(m.participants)||m.participants.length<2||m.participants.length>8||
  m.participants.some((p:Bag)=>!id(p?.playerId))||
  new Set(m.participants.map((p:Bag)=>p.playerId)).size!==m.participants.length)return null;
 const isWarmup=m.scoringSnapshot?.rules?.act==='WARMUP';
 // An Event may legitimately have warmups before any MAIN plan has been
 // approved, or MAINs before optional warmups exist. Missing *other-class*
 // registration is an empty list, not a fabricated plan requirement.
 if(!list(e.officialMatchIds??[])||!list(e.warmupMatchIds??[]))return null;
 const membership=[e.officialMatchIds??[],e.warmupMatchIds??[]]
  .filter((a:any)=>a.includes(b.battleId));
 if(membership.length!==1||Boolean(e.warmupMatchIds?.includes(b.battleId))!==isWarmup)return null;
 if(!isWarmup&&(m.sourceMatchPlanId!==b.planId||e.approvedMatchPlanId!==b.planId||
  e.matchPlanStatus!=='APPROVED'||b.plan?.status!=='APPROVED'||
  !list(b.plan?.officialMatchIds)||!equal(e.officialMatchIds,b.plan.officialMatchIds)||
  !Array.isArray(b.plan?.matches)||b.plan.matches.length!==b.plan.officialMatchIds.length||
  !Number.isSafeInteger(m.matchNumber)||m.matchNumber<1||
  b.plan.officialMatchIds[m.matchNumber-1]!==b.battleId))return null;
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
  !/^[a-f0-9]{64}$/.test(g.source.provenanceDigest??'')||
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
    g.source!.sourceHash,g.source!.gameGuid,g.source!.mappingDigest,g.source!.provenanceDigest,
    g.source!.publicationAtMs])]);
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
    (o.proof.kind==='MUTUAL_PARTICIPANTS'&&g.source!.publicationAtMs===null)||
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
  edges.get(x)!.add(y);
 }
 // A transitive path through a contradictory SCC is not an
 // independent play-order proof. Remove only contaminated components:
 // unrelated conflicts must never veto a separately sound comparison.
 let serial=0;
 const discovered=new Map<string,number>(),low=new Map<string,number>();
 const stack:string[]=[],live=new Set<string>(),contaminated=new Set<string>();
 const visit=(id:string)=>{
  discovered.set(id,serial);low.set(id,serial);serial++;stack.push(id);live.add(id);
  for(const next of edges.get(id)??[]){
   if(!discovered.has(next)){visit(next);low.set(id,Math.min(low.get(id)!,low.get(next)!));}
   else if(live.has(next))low.set(id,Math.min(low.get(id)!,discovered.get(next)!));
  }
  if(low.get(id)===discovered.get(id)){
   const component:string[]=[];let node:string;
   do{node=stack.pop()!;live.delete(node);component.push(node);}while(node!==id);
   if(component.length>1||edges.get(id)?.has(id))
    for(const member of component)contaminated.add(member);
  }
 };
 for(const id of ids)if(!discovered.has(id))visit(id);
 if(contaminated.has(a)||contaminated.has(b))return 'CONFLICT';
 const reach=(from:string,to:string)=>{
  const seen=new Set<string>(),queue=[from];
  while(queue.length){const head=queue.shift()!;for(const next of edges.get(head)??[]){
    if(contaminated.has(next))continue;
    if(next===to)return true;if(!seen.has(next)){seen.add(next);queue.push(next);}
  }}return false;
 };
 const ab=reach(a,b),ba=reach(b,a);
 return ab&&ba?'CONFLICT':ab?'BEFORE':ba?'AFTER':'UNKNOWN';
}
/** First third distinct *official* canonical 1v1 Battle loss only, never an offer.
 * Missing source/result/relative order is not evidence of a non-loss. */
export function qualifyThreeBattleLosses(battles:OccurrenceBattle[],respondentPlayerId:string){
 type Loss={battleId:string;opponentPlayerId:string;sourceBinding:string;gameKeys:string[];occurrenceDigest:string};
 const losses:Loss[]=[],possible=new Map<string,Set<string>>();
 // Caller must supply a complete authenticated current cohort. A repeated
 // Battle or GUID in respondent-relevant 1v1 evidence cannot become another
 // independent loss. Duplicates wholly outside the respondent's cohort cannot
 // veto unrelated proven history.
 if(new Set(battles.map(b=>b.battleId)).size!==battles.length)return [];
 const owners=new Map<string,string>(),duplicateBattles=new Set<string>();
 for(const b of battles){
  if(!b.match?.participants?.some((p:Bag)=>p.playerId===respondentPlayerId)||
    b.match?.format!=='ONE_V_ONE')continue;
  for(const g of b.games)if(g.source?.gameGuid){
   const old=owners.get(g.source.gameGuid);
   if(old&&old!==b.battleId){duplicateBattles.add(old);duplicateBattles.add(b.battleId);}
   else owners.set(g.source.gameGuid,b.battleId);
  }
 }
 for(const b of battles){
  if(!b.match?.participants?.some((p:Bag)=>p.playerId===respondentPlayerId))continue;
  const players=b.match.participants;
  if(b.match.format!=='ONE_V_ONE'||!Array.isArray(players)||players.length!==2)continue;
  const opponent=players.find((p:Bag)=>p.playerId!==respondentPlayerId)?.playerId;
  if(!id(opponent))continue;
  // Officially void, cancelled, AI or replaced matches cannot be a Battle
  // loss. They are not an "unknown earlier defeat" veto.
  if(['VOID','CANCELLED','REPLACED'].includes(b.match.status)||
     b.match.replacementMatchId||b.match.opponentKind==='AI')continue;
  const uncertain=()=>{const set=possible.get(opponent)??new Set<string>();set.add(b.battleId);possible.set(opponent,set);};
  if(duplicateBattles.has(b.battleId)){uncertain();continue;}
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
    sourceBinding:binding,gameKeys:needed.map(g=>g.gameId+':'+g.source!.sourceHash+':'+g.source!.gameGuid),
    occurrenceDigest:bindingDigest([occ.binding,occ.revision,occ.bounds,occ.precedes])});
 }
 const results:Array<{respondentPlayerId:string;opponentPlayerId:string;anchorBattleId:string;
  witnessBattleIds:string[];qualification:'THIRD_LOSS_SOURCE_QUALIFIED';revision:string}>=[];
 for(const opponent of new Set(losses.map(l=>l.opponentPlayerId))){
  const candidates=losses.filter(l=>l.opponentPlayerId===opponent);
  if(candidates.length<3)continue;
  // A third-loss anchor needs exactly two demonstrably earlier losses.
  // Later losses need only be AFTER that anchor, not ordered relative to
  // one another. This does not invent a total history when two later
  // Battles overlap. Unknown possible earlier losses stay fail-closed.
  for(const anchor of candidates){
   const before:Loss[]=[],after:Loss[]=[];
   let unresolved=false;
   for(const other of candidates){
    if(other.battleId===anchor.battleId)continue;
    const relation=compareOccurrence(other.battleId,anchor.battleId,battles);
    if(relation==='BEFORE')before.push(other);
    else if(relation==='AFTER')after.push(other);
    else unresolved=true;
   }
   if(unresolved||before.length!==2||(possible.get(opponent)?.size??0)>0)continue;
   const first=compareOccurrence(before[0].battleId,before[1].battleId,battles);
   if(first!=='BEFORE'&&first!=='AFTER')continue;
   const trio=first==='BEFORE'?[before[0],before[1],anchor]:
     [before[1],before[0],anchor];
   // Bind the first-three proof and the source-current *later* witnesses
   // which certify that this is the FIRST eligible third loss.
   results.push({respondentPlayerId,opponentPlayerId:opponent,anchorBattleId:anchor.battleId,
    witnessBattleIds:trio.map(l=>l.battleId),qualification:'THIRD_LOSS_SOURCE_QUALIFIED',
    revision:bindingDigest([BATTLE_OCCURRENCE_VERSION,respondentPlayerId,opponent,
      trio.map(l=>[l.battleId,l.sourceBinding,l.gameKeys,l.occurrenceDigest]),
      after.map(l=>[l.battleId,l.sourceBinding,l.occurrenceDigest]).sort((a,b)=>a[0].localeCompare(b[0]))])});
  }
 }
 return results.sort((a,b)=>a.anchorBattleId.localeCompare(b.anchorBattleId));
}
