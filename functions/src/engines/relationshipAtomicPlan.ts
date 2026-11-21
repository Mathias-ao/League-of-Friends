/** #247 Pure, fail-closed planning for atomic current pair-history replacement.
 *
 * Both source Match and target Relationship QuerySnapshots are read again in
 * the same Firestore transaction, then compared with this exact revision
 * witness before any write. No old-document deletion outside that transaction.
 */
export function relationshipQueryRevision(
  docs:readonly {id:string;updateTime:{seconds:number;nanoseconds:number}}[],
):string{
  // Firestore timestamps have nanosecond granularity. toMillis() loses
  // information and can miss two corrections within the same millisecond.
  const rows=docs.map(doc=>{
    const seconds=doc.updateTime?.seconds,nanos=doc.updateTime?.nanoseconds;
    if(!doc.id||!Number.isSafeInteger(seconds)||seconds<0||
       !Number.isSafeInteger(nanos)||nanos<0||nanos>=1_000_000_000)
      throw new Error('RELATIONSHIP_QUERY_REVISION_UNAVAILABLE');
    return [doc.id,seconds,nanos] as const;
  }).sort((a,b)=>a[0].localeCompare(b[0]));
  if(new Set(rows.map(r=>r[0])).size!==rows.length)
    throw new Error('RELATIONSHIP_QUERY_DUPLICATE_DOCUMENT');
  return JSON.stringify(rows);
}
import {isDeepStrictEqual} from 'node:util';

/** Ignore only the write timestamp: unchanged pair data keeps its document,
 * Chronicle entry IDs and seen-history state without a spurious update. */
const PAIR_FIELDS=['schemaVersion','pairId','playerOneId','playerTwoId',
  'pairHistory','relationship','chronicle','relationshipEngineVersion',
  'relationshipRuleVersion','relationshipRulesConfigured',
  'interactionCoverage'] as const;
export function relationshipPairUnchanged(existing:unknown,next:Record<string,unknown>):boolean{
  if(!existing||typeof existing!=='object'||Array.isArray(existing))return false;
  const current=existing as Record<string,unknown>;
  return PAIR_FIELDS.every(key=>
    Object.prototype.hasOwnProperty.call(current,key)&&
    Object.prototype.hasOwnProperty.call(next,key)&&
    isDeepStrictEqual(current[key],next[key]));
}

export function relationshipReplacementPlan(
  existingPairIds:readonly string[],nextPairIds:readonly string[],
):{obsoletePairIds:string[];totalPairWrites:number}{
  if(new Set(existingPairIds).size!==existingPairIds.length||
     new Set(nextPairIds).size!==nextPairIds.length)
    throw new Error('RELATIONSHIP_DUPLICATE_PAIR_ID');
  if([...existingPairIds,...nextPairIds].some(id=>!id||id.includes('/')))
    throw new Error('RELATIONSHIP_INVALID_PAIR_ID');
  const next=new Set(nextPairIds);
  const obsoletePairIds=existingPairIds.filter(id=>!next.has(id)).sort();
  // Reserve capacity under Firestore's 500-write transaction limit for Match,
  // job, audit and optional idempotency. Large-league fanout requires a
  // separate generation-pointer migration; never chunk exposed pair history.
  const totalPairWrites=nextPairIds.length+obsoletePairIds.length;
  if(totalPairWrites>450)
    throw new Error('RELATIONSHIP_ATOMIC_REBUILD_BUDGET_EXCEEDED');
  return {obsoletePairIds,totalPairWrites};
}
