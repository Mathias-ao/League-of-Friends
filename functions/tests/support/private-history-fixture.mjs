import {fixture,env as baseEnv} from './native-ready-fixture.mjs';
import {readMyPersonalityHistory} from '../../lib/queries/getMyPersonalityHistory.js';
const env={...baseEnv,AOF_INT_V1_PRIVATE_READS:'source-v1',AOF_INT_V1_PRIVATE_HISTORY:'battle-v1'};
const copy=v=>Array.isArray(v)?v.map(copy):v&&typeof v==='object'?
 typeof v.toMillis==='function'?{toMillis:()=>v.toMillis()}:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,copy(x)])):v;
export async function ready(){
 const f=fixture();await f.run();
 Object.assign(f.rows.get('matches/m'),{eventId:'e',seasonId:'s',firstCompletedAt:{toMillis:()=>1000},participants:[{playerId:'p1'},{playerId:'p2'}]});
 Object.assign(f.rows.get('matches/m/games/g'),{gameNumber:1});
 f.rows.set('events/e',{status:'ACTIVE',seasonId:'s',officialMatchIds:['m'],warmupMatchIds:[]});f.rows.set('seasons/s',{status:'ACTIVE'});
 f.rows.set('authLinks/owner',{playerId:'p1'});f.rows.set('authLinks/other',{playerId:'p2'});
 const snap=path=>{const data=copy(f.rows.get(path));return {exists:f.rows.has(path),id:path.split('/').at(-1),ref:ref(path),data:()=>data};};
 const list=(path,opts={})=>{const docs=[...f.rows.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1)
  .sort().filter(k=>!opts.after||k.split('/').at(-1)>opts.after).slice(0,opts.limit??Infinity).map(snap);return {docs,size:docs.length};};
 const ref=path=>({path,get:async()=>snap(path),collection:k=>collection(path+'/'+k)});
 const collection=(path,opts={})=>({path,isQuery:true,opts,doc:id=>ref(path+'/'+id),orderBy:()=>collection(path,opts),
  limit:limit=>collection(path,{...opts,limit}),startAfter:d=>collection(path,{...opts,after:d.id}),get:async()=>list(path,opts)});
 f.db.doc=ref;f.db.collection=collection;let onFinal=null;
 f.db.runTransaction=async fn=>{if(onFinal){const run=onFinal;onFinal=null;run();}return fn({get:async r=>r.isQuery?list(r.path,r.opts):snap(r.path)});};
 const input={db:f.db,bucket:f.storage,actor:{playerId:'p1',authUid:'owner'},request:{},env};
 return {...f,input,read:()=>readMyPersonalityHistory(input),onFinal:fn=>onFinal=fn};
}
