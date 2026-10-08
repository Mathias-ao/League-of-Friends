import type {PlacementPolicy} from "./seasonPoints.js";
export interface VerifiedFFAPlacements {
  modelVersion:"AOF_FFA_PLACEMENTS_V1";qualification:"VERIFIED";
  policy:Exclude<PlacementPolicy,"NONE">;sourceStatisticsId:string;replaySha256:string;resultRevision:number;
  ranks:Array<{playerId:string;rank:number}>;
}
export interface PlacementSourceBinding {
  sourceStatisticsId:string;replaySha256:string;rosterIds:string[];resultRevision:number;
  policy:PlacementPolicy;winnerIds:string[];
}
/** Only active, server-owned qualified replay evidence; never caller-supplied ranks. */
export function verifiedFFAPlacements(value:unknown,binding:PlacementSourceBinding):VerifiedFFAPlacements|null {
  if(!value || typeof value!=="object" || Array.isArray(value))return null;
  const evidence=value as VerifiedFFAPlacements;
  if(evidence.modelVersion!=="AOF_FFA_PLACEMENTS_V1" || evidence.qualification!=="VERIFIED" ||
     binding.policy==="NONE" || evidence.policy!==binding.policy ||
     evidence.sourceStatisticsId!==binding.sourceStatisticsId || evidence.replaySha256!==binding.replaySha256 ||
     evidence.resultRevision!==binding.resultRevision || !Array.isArray(evidence.ranks) ||
     evidence.ranks.length!==binding.rosterIds.length || binding.winnerIds.length!==1)return null;
  const ids=evidence.ranks.map(row=>row?.playerId),ranks=evidence.ranks.map(row=>row?.rank);
  if(new Set(ids).size!==ids.length || ids.some(id=>!binding.rosterIds.includes(id)) ||
     ranks.some(rank=>!Number.isInteger(rank)||rank<1||rank>ids.length) ||
     evidence.ranks.filter(row=>row.rank===1).length!==1 ||
     evidence.ranks.find(row=>row.rank===1)?.playerId!==binding.winnerIds[0])return null;
  const ordered=[...ranks].sort((a,b)=>a-b);
  for(let i=0;i<ordered.length;i++)if(i===0 || ordered[i]!==ordered[i-1]) {
    if(ordered[i]!==i+1)return null;
  }
  return evidence;
}
/** A verified tie shares the rewards for its occupied positions. */
export function placementBonus(evidence:VerifiedFFAPlacements,playerId:string):number {
  const row=evidence.ranks.find(row=>row.playerId===playerId);
  if(!row || row.rank===1)return 0;
  const count=evidence.ranks.length,tied=evidence.ranks.filter(other=>other.rank===row.rank).length;
  let pool=0;
  for(let rank=row.rank;rank<row.rank+tied;rank++) {
    if(rank===2&&count>=3)pool+=2;if(rank===3&&count>=5)pool+=1;
  }
  return pool/tied;
}
