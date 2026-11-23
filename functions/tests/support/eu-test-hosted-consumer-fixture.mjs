/** Genuine demo sources, CONTROLLED EU authority and derivation transport.
 * Runs the actual EU consumer through a read-only policy facade. This never
 * provisions policy documents, contacts EU, or proves hosted EU/browser E2E. */
import assert from 'node:assert/strict';
import {readMyHostedSocialProgression} from '../../lib/queries/getMyHostedSocialProgression.js';
import {EU_TEST_R,euEnv,installAuthority,attest} from './eu-test-authority-fixture.mjs';

export async function readControlledEuHostedHistory(input,derived,sources){
 assert.equal(input.env.FUNCTIONS_EMULATOR,'true');assert.match(input.env.GCLOUD_PROJECT,/^demo-/);
 const env=euEnv({AOF_INT_V1_PRIVATE_READS:'source-v1',AOF_INT_V1_PRIVATE_HISTORY:'battle-v1',
  AOF_ACTIVE_NATIVE_PLAYER_READS:'1',AOF_ACTIVE_NATIVE_SOCIAL_READS:'1',
  AOF_NATIVE_REPLAY_PROCESSOR_REVISION:input.env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION});
 const rows=new Map();installAuthority(rows,EU_TEST_R,env,Object.fromEntries(sources.map(source=>[
  source.sourceHash,attest(source,env)])));
 const snap=path=>({data:()=>structuredClone(rows.get(path))});
 const db={doc:path=>rows.has(path)?{path,get:async()=>snap(path)}:input.db.doc(path),
  collection:(...args)=>input.db.collection(...args),
  runTransaction:fn=>input.db.runTransaction(tx=>fn({get:ref=>rows.has(ref.path)?Promise.resolve(snap(ref.path)):tx.get(ref)}))};
 return readMyHostedSocialProgression({...input,db,env,derive:async payload=>{
  const raw=derived.get(payload.snapshot.authorityRevision);
  if(!raw)throw Error('CONTROLLED_MISSING_DERIVATION');return raw;
 }});
}
