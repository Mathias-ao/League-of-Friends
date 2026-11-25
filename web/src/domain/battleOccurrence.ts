import {isolatedStagingProject} from './stagingProject';

/** Optional, default-off owner-private Battle occurrence confirmation.
 * No occurrence input represents an official result or a gameplay grade. */
export type BattleOccurrenceRead={
  version:'AOF_CANONICAL_BATTLE_OCCURRENCE_1';
  battleId:string;expectedSourceBinding:string;gameIds:string[];
  games:{gameId:string;receiptUpperBoundAtMs:number|null}[];
  status:'PENDING'|'APPROVED';revision:number|null;
  opponentProposalBounds:BattleOccurrenceBound[]|null;proposalMismatch:boolean;
};
export type BattleOccurrenceBound={gameId:string;notBeforeMs:number;notAfterMs:number};
export function battleOccurrenceEnabled(env:Record<string,string|boolean|undefined>):boolean{
 return env.VITE_AOF_BATTLE_OCCURRENCE_V1==='source-v1'&&isolatedStagingProject(env,false);
}
