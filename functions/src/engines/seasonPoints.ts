import type {MatchFormat,MatchParticipant,ScoringSnapshot} from "../domain/types.js";

export const POINT_UNITS=840;
export const seasonPointUnits=(points:number):number=>Math.round(points*POINT_UNITS);
export const SEASON_POINTS_VERSION="AOF_SEASON_POINTS_V1";
export type ScoringAct="MAIN"|"WARMUP";
export type PlacementPolicy="NONE"|"ELIMINATION_ORDER"|"OBJECTIVE_RANK";
export interface SeasonScoringRules {
  modelVersion:typeof SEASON_POINTS_VERSION;
  act:ScoringAct;
  diplomacyEnabled:boolean|null;
  placementPolicy:PlacementPolicy;
  emperorPlayerId:string|null;
}
/** This version owns numeric rewards; event settings cannot silently change them. */
export function seasonScoringSnapshot(input:Omit<SeasonScoringRules,"modelVersion">):ScoringSnapshot {
  const rules={...input,modelVersion:SEASON_POINTS_VERSION,
    matchCompletionPoints:input.act==="MAIN" ? 4:1,matchWinPoints:input.act==="MAIN" ? 6:2};
  validateSeasonScoringRules(rules);
  return {profileId:SEASON_POINTS_VERSION,profileVersion:1,rules};
}
export function validateSeasonScoringRules(value:Record<string,unknown>):SeasonScoringRules|null {
  if(value.modelVersion==null)return null;
  if(value.modelVersion!==SEASON_POINTS_VERSION)throw new Error("Unsupported season points version.");
  if(!["MAIN","WARMUP"].includes(value.act as string) ||
     ![true,false,null].includes(value.diplomacyEnabled as boolean|null) ||
     !["NONE","ELIMINATION_ORDER","OBJECTIVE_RANK"].includes(value.placementPolicy as string) ||
     !(value.emperorPlayerId===null || typeof value.emperorPlayerId==="string" && value.emperorPlayerId.trim())) {
    throw new Error("Invalid season scoring snapshot.");
  }
  if(value.act==="WARMUP" && value.placementPolicy!=="NONE" ||
     value.diplomacyEnabled===true && value.placementPolicy!=="NONE") {
    throw new Error("Warm-ups and diplomatic FFA cannot award placement points.");
  }
  return value as unknown as SeasonScoringRules;
}
export function assertScoringRoster(participants:MatchParticipant[]):void {
  const ids=participants.map(p=>p.playerId);
  if(ids.length<2 || ids.length>8 || ids.some(id=>typeof id!=="string" || !id.trim() || id.includes("/")) ||
     new Set(ids).size!==ids.length)throw new Error("Scoring requires a unique roster of two to eight players.");
}
export function scoringSlotId(act:ScoringAct,playerId:string):string {return act+"_"+playerId;}
export function assertSeasonMatchRules(rules:SeasonScoringRules,format:MatchFormat):void {
  if(rules.act==="WARMUP" && format!=="ONE_V_ONE")throw new Error("Scoring warm-ups must be 1v1.");
  if(format==="FFA" && rules.diplomacyEnabled===null)throw new Error("FFA diplomacy must be announced explicitly.");
  if(format==="FFA" && rules.diplomacyEnabled===false && rules.placementPolicy==="NONE") {
    throw new Error("Nondiplomatic FFA requires an announced placement policy.");
  }
}
export interface SeasonStanding {playerId:string;steamName:string;leaguePoints:number;leaguePointUnits?:number;mainEventWins?:number;warmupWins?:number;}
export function rankSeasonStandings<T extends SeasonStanding>(rows:T[]):Array<T&{rank:number}> {
  const units=(row:T)=>row.leaguePointUnits??row.leaguePoints*POINT_UNITS;
  const compare=(a:T,b:T)=>Math.abs(units(a)-units(b))>1e-6 ? units(b)-units(a) :
    (b.mainEventWins??0)-(a.mainEventWins??0) || (b.warmupWins??0)-(a.warmupWins??0);
  const ordered=[...rows].sort((a,b)=>compare(a,b)||a.steamName.localeCompare(b.steamName)||a.playerId.localeCompare(b.playerId));
  let rank=0;
  return ordered.map((row,index)=>{
    if(index===0 || compare(ordered[index-1],row)!==0)rank=index+1;
    return {...row,rank};
  });
}
export interface ScoringMatchState {
  matchId:string;status?:string;activeResultDisputeId?:string|null;canonicalResult?:{revision?:number}|null;
  scoringResultRevision?:number;scoringSnapshot?:{rules?:Record<string,unknown>};
}
export interface PointLedgerRow {sourceMatchId?:string;playerId?:string;matchId?:string|null;component?:string;amount?:number;amountUnits?:number;}
/** Keep the audit ledger, but remove disputed/unreconciled awards from public standings. */
export function maskUnavailableSeasonAwards<T extends SeasonStanding>(rows:T[],matches:ScoringMatchState[],ledger:PointLedgerRow[]):T[] {
  const unavailable=new Map(matches.filter(match=>match.status!=="COMPLETED" || match.activeResultDisputeId ||
    match.scoringSnapshot?.rules?.modelVersion===SEASON_POINTS_VERSION &&
    match.scoringResultRevision!==match.canonicalResult?.revision).map(match=>[match.matchId,match]));
  return rows.map(row=>{
    let points=0,mainWins=0,warmupWins=0;
    const nets=new Map<string,number>();
    for(const raw of ledger) {const entry={...raw,matchId:raw.sourceMatchId??raw.matchId};if(entry.playerId===row.playerId && entry.matchId && unavailable.has(entry.matchId)) {
      points+=entry.amountUnits??Number(entry.amount??0)*POINT_UNITS;
      if(entry.component==="MATCH_WIN")nets.set(entry.matchId,(nets.get(entry.matchId)??0)+Number(entry.amount??0));
    }
    }
    for(const [id,net] of nets)if(net>0) {
      const act=unavailable.get(id)?.scoringSnapshot?.rules?.act;
      if(act==="MAIN")mainWins++;if(act==="WARMUP")warmupWins++;
    }
    const units=(row.leaguePointUnits??row.leaguePoints*POINT_UNITS)-points;
    return {...row,leaguePoints:units/POINT_UNITS,...(row.leaguePointUnits==null?{}:{leaguePointUnits:units}),
      mainEventWins:Math.max(0,(row.mainEventWins??0)-mainWins),warmupWins:Math.max(0,(row.warmupWins??0)-warmupWins)};
  });
}
