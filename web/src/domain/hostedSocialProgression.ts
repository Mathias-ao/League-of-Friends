/** Closed owner-private wire contract. No source proof or publication envelope. */
export const HOSTED_SOCIAL_VERSION='AOF_SOC_V1A_HOSTED_OWNER_READ_1' as const;
export const REPUTATION_TRACKS=['GALLANTRY','CRUELTY','CHIVALRY'] as const;
export const RELATIONSHIP_TRACKS=['RIVALRY','HOSTILITY','BOND'] as const;
export const SOCIAL_REASONS=['NOT_YET_MEASURED','NO_QUALIFYING_RECORDED_ACTIVITY',
  'SOURCE_EVIDENCE_INCOMPLETE','HISTORICAL_ORDER_PENDING','INDEPENDENT_ACTIVITY_REQUIRED'] as const;
export interface PrivateSocialTrack {
  readiness:'SOURCE_QUALIFIED'|'PENDING_SOURCE_METHOD';
  progression:'PRIVATE_PREVIEW'|'PENDING'|'UNAVAILABLE';
  reasonCodes:Array<typeof SOCIAL_REASONS[number]>;
  sourceQualifiedBattles:number;sourceQualifiedGames:number;sourceQualifiedEvents:number;
  stage:number|null;upBank:number|null;
}
export interface HostedSocialProgression {
  version:typeof HOSTED_SOCIAL_VERSION;ownerPlayerId:string;revision:string;
  policyVersion:string;approvalScope:'PRIVATE_NUMERICAL_PREVIEW';
  coverage:{complete:boolean;ownBattles:number;ownGames:number;currentSources:number;pendingSources:number};
  reputation:Record<typeof REPUTATION_TRACKS[number],{
    career:PrivateSocialTrack;bySeason:Record<string,PrivateSocialTrack>;
  }>;
  relationships:Array<{otherPlayerId:string;factualCurrentSourceBattles:number;factualCurrentSourceGames:number;
    tracks:Record<typeof RELATIONSHIP_TRACKS[number],{outgoing:PrivateSocialTrack;incoming:PrivateSocialTrack}>}>;
}
const id=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(x);
const hash=(x:unknown)=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const count=(x:unknown):x is number=>Number.isSafeInteger(x)&&(x as number)>=0;
const closed=(x:any,keys:readonly string[])=>x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
function track(x:any,unsupported:boolean):boolean {
  if(!closed(x,['readiness','progression','reasonCodes','sourceQualifiedBattles','sourceQualifiedGames',
    'sourceQualifiedEvents','stage','upBank'])||!['SOURCE_QUALIFIED','PENDING_SOURCE_METHOD'].includes(x.readiness)||
    !['PRIVATE_PREVIEW','PENDING','UNAVAILABLE'].includes(x.progression)||!Array.isArray(x.reasonCodes)||
    x.reasonCodes.some((r:unknown)=>!SOCIAL_REASONS.includes(r as any))||new Set(x.reasonCodes).size!==x.reasonCodes.length||
    ![x.sourceQualifiedBattles,x.sourceQualifiedGames,x.sourceQualifiedEvents].every(count)||
    x.sourceQualifiedBattles>x.sourceQualifiedGames||x.sourceQualifiedEvents>x.sourceQualifiedBattles)return false;
  const numeric=x.progression==='PRIVATE_PREVIEW';
  if(numeric){
    if(unsupported||x.readiness!=='SOURCE_QUALIFIED'||!count(x.stage)||x.stage>4||!count(x.upBank)||
      x.sourceQualifiedGames<1)return false;
  }else if(x.stage!==null||x.upBank!==null)return false;
  return !unsupported||(x.progression==='PENDING'&&x.readiness==='PENDING_SOURCE_METHOD'&&
    x.sourceQualifiedGames===0&&x.reasonCodes.includes('NOT_YET_MEASURED'));
}
export function parseHostedSocialProgression(raw:unknown,owner:string):HostedSocialProgression {
  const x=raw as HostedSocialProgression;
  const fail=()=>{throw Error('Private social response is unavailable.');};
  if(!closed(x,['version','ownerPlayerId','revision','policyVersion','approvalScope','coverage','reputation','relationships'])||
    x.version!==HOSTED_SOCIAL_VERSION||!id(owner)||x.ownerPlayerId!==owner||!hash(x.revision)||
    x.policyVersion!=='AOF_SOC_V1A_SOURCE_BOUND_ORDINARY_GRADES_PROPOSED_1'||x.approvalScope!=='PRIVATE_NUMERICAL_PREVIEW'||
    new TextEncoder().encode(JSON.stringify(x)).length>512*1024||
    !closed(x.coverage,['complete','ownBattles','ownGames','currentSources','pendingSources'])||
    typeof x.coverage.complete!=='boolean'||![x.coverage.ownBattles,x.coverage.ownGames,x.coverage.currentSources,x.coverage.pendingSources].every(count)||
    x.coverage.ownBattles>256||x.coverage.ownGames>8||x.coverage.currentSources>x.coverage.ownGames||
    !closed(x.reputation,REPUTATION_TRACKS)||!Array.isArray(x.relationships)||x.relationships.length>56)fail();
  for(const name of REPUTATION_TRACKS){
    const r=x.reputation[name];
    if(!closed(r,['career','bySeason'])||!track(r.career,name==='CRUELTY')||
      !r.bySeason||typeof r.bySeason!=='object'||Array.isArray(r.bySeason)||Object.keys(r.bySeason).length>8)fail();
    for(const [season,row] of Object.entries(r.bySeason))if(!id(season)||!track(row,name==='CRUELTY'))fail();
  }
  const seen=new Set<string>();
  for(const pair of x.relationships){
    if(!closed(pair,['otherPlayerId','factualCurrentSourceBattles','factualCurrentSourceGames','tracks'])||
      !id(pair.otherPlayerId)||pair.otherPlayerId===owner||seen.has(pair.otherPlayerId)||
      !count(pair.factualCurrentSourceBattles)||pair.factualCurrentSourceBattles<1||
      !count(pair.factualCurrentSourceGames)||pair.factualCurrentSourceBattles>pair.factualCurrentSourceGames||
      !closed(pair.tracks,RELATIONSHIP_TRACKS))fail();
    seen.add(pair.otherPlayerId);
    for(const name of RELATIONSHIP_TRACKS){const r=pair.tracks[name];
      if(!closed(r,['outgoing','incoming'])||!track(r.outgoing,name==='HOSTILITY')||!track(r.incoming,name==='HOSTILITY'))fail();
    }
  }
  // Incomplete overall coverage can coexist with a complete independent pair
  // or Season. The server withholds only source-dependent track projections.
  if(x.coverage.complete!==(x.coverage.pendingSources===0))fail();
  return x;
}
export function hostedSocialEnabled(env:Record<string,string|boolean|undefined>):boolean {
  return env.VITE_AOF_HOSTED_SOCIAL_PRIVATE==='v1a'&&env.VITE_FIREBASE_PROJECT_ID==='age-of-friends-staging'&&
    env.VITE_USE_EMULATORS!=='true';
}
