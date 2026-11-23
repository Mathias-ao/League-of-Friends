/** Genuine demo sources, CONTROLLED EU authority and derivation transport.
 * Runs the actual EU consumer through a read-only policy facade. This never
 * provisions policy documents, contacts EU, or proves hosted EU/browser E2E. */
import assert from 'node:assert/strict';
import {collectMyCurrentBattleHistory} from '../../lib/queries/getMyPersonalityHistory.js';
import {euTestSourceFingerprint} from '../../lib/integration/euTestAuthority.js';
import {readMyHostedSocialProgression} from '../../lib/queries/getMyHostedSocialProgression.js';
import {EU_TEST_R,euEnv,installAuthority,attest} from './eu-test-authority-fixture.mjs';

const sharedAuthorities=new WeakMap();
export async function readControlledEuHostedHistory(input,derived){
 assert.equal(input.env.FUNCTIONS_EMULATOR,'true');assert.match(input.env.GCLOUD_PROJECT,/^demo-/);
 const env=euEnv({AOF_INT_V1_PRIVATE_READS:'source-v1',AOF_INT_V1_PRIVATE_HISTORY:'battle-v1',
  AOF_ACTIVE_NATIVE_PLAYER_READS:'1',AOF_ACTIVE_NATIVE_SOCIAL_READS:'1',
  AOF_NATIVE_REPLAY_PROCESSOR_REVISION:input.env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION});
 let rows=sharedAuthorities.get(input.db);
 if(!rows){rows=new Map();installAuthority(rows,EU_TEST_R,env);sharedAuthorities.set(input.db,rows);}
 const current=await collectMyCurrentBattleHistory({...input,maxOwnGames:8,includeScheduleOrder:true});
 const reviews=rows.get(EU_TEST_R.runtimePath).sourceReviews;
 let attestationsCurrent=true;
 for(const item of current.loaded){
  // ONE shared record per original, never regenerated per requesting owner.
  const fingerprint=euTestSourceFingerprint(item.source,item.sourceAttestationRevision);
  if(!reviews[item.source.sourceHash])reviews[item.source.sourceHash]=attest(item.source,env,{},item.sourceAttestationRevision);
  else if(reviews[item.source.sourceHash].sourceFingerprint!==fingerprint)attestationsCurrent=false;
 }
 const snap=path=>({data:()=>structuredClone(rows.get(path))});
 const db={doc:path=>rows.has(path)?{path,get:async()=>snap(path)}:input.db.doc(path),
  collection:(...args)=>input.db.collection(...args),
  runTransaction:fn=>input.db.runTransaction(tx=>fn({get:ref=>rows.has(ref.path)?Promise.resolve(snap(ref.path)):tx.get(ref)}))};
 const response=await readMyHostedSocialProgression({...input,db,env,derive:async payload=>{
  const raw=derived.get(payload.snapshot.authorityRevision);
  if(!raw)throw Error('CONTROLLED_MISSING_DERIVATION');return raw;
 }});
 return {response,attestationsCurrent};
}
