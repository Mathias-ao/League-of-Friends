/** Pure Social V1 historical allocator. Consumes SHARED_1 Claim records with server-authenticated chapter wrappers.
 * Synthetic policy values are injected; there are deliberately no numerical defaults or Firestore writes.
 */
import {createHash} from 'node:crypto';
export const VERSION='AOF_SOCIAL_V1_HISTORY_1';
const TRACKS={REPUTATION:['GALLANTRY','CRUELTY','CHIVALRY'],RELATIONSHIP:['RIVALRY','HOSTILITY','BOND']};
const sorted=x=>Array.isArray(x)?x.map(sorted):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
const encode=x=>JSON.stringify(sorted(x));
const hash=x=>createHash('sha256').update(encode(x)).digest('hex');
const key=s=>s.system==='REPUTATION'?encode(['R',s.track,s.playerId]):encode(['D',s.track,s.fromPlayerId,s.toPlayerId]);
const reverse=s=>key({...s,fromPlayerId:s.toPlayerId,toPlayerId:s.fromPlayerId});
const pair=s=>encode([s.fromPlayerId,s.toPlayerId].sort());
// Game document IDs are scoped to their authoritative league Battle/Match.
const gameKey=row=>encode([row.battleId,row.gameId]);
const cmp=(a,b)=>{for(let i=0;i<a.length;i++) if(a[i]!==b[i])return a[i]-b[i];return 0;};
const nonnegative=n=>Number.isFinite(n)&&n>=0;
const positive=n=>nonnegative(n)&&n>0;
const trusted=(p,approvals)=>p?.status==='APPROVED'&&!!p.approvalRef&&approvals.some(a=>a.status==='APPROVED'&&
  a.policyVersion===p.policyVersion&&a.configurationVersion===p.configurationVersion&&a.approvalRef===p.approvalRef);
const refKey=r=>[r.kind,r.id,r.revision,r.digest].join(':');
function ensure(cond,reason){if(!cond)throw Error(reason);}
export function validateCalibration(c){
 ensure(c&&typeof c.version==='string'&&c.version&&c.policy&&['PROPOSED','APPROVED'].includes(c.policy.status),'CALIBRATION_REQUIRED');
 for(const [system,names] of Object.entries(TRACKS))for(const track of names){
  const t=c.stages?.[system]?.[track],budget=system==='REPUTATION'?c.budgets?.reputationBattle?.[track]:c.budgets?.relationshipEvent?.[track];
  ensure(t&&Array.isArray(t.up)&&t.up.length&&Array.isArray(t.down)&&t.up.length===t.down.length&&
   t.up.every(positive)&&t.down.every(positive)&&budget&&nonnegative(budget.STRENGTHEN)&&nonnegative(budget.WEAKEN),'CALIBRATION_'+track);
  if(system==='RELATIONSHIP'){
   ensure(t.up.length>=3&&t.up.every((v,i)=>i===0||v>t.up[i-1]),'BOUNDARIES_'+track);
   for(let n=3;n<=t.up.length;n++)ensure(Number.isSafeInteger(t.reciprocity?.[n])&&t.reciprocity[n]>=1&&
    (n===3||t.reciprocity[n]>=t.reciprocity[n-1]),'RECIPROCITY_'+track+'_'+n);
  }
 }
 ensure(c.treachery&&nonnegative(c.treachery.consumptionUnits)&&Number.isSafeInteger(c.treachery.maximumStage)&&
  c.treachery.maximumStage>=3&&c.treachery.maximumStage<=c.stages.RELATIONSHIP.HOSTILITY.up.length,'TREACHERY_CALIBRATION');
 for(const [id,r] of Object.entries(c.rules??{}))ensure(id&&TRACKS[r.system]?.includes(r.track)&&['STRENGTHEN','WEAKEN'].includes(r.effect)&&
  r.bands&&Object.values(r.bands).length&&Object.values(r.bands).every(positive),'RULE_'+id);
 return c;
}
function select(chapters){const map=new Map();for(const c of chapters){
 ensure(c.battleId===c.matchId&&c.battleId&&c.gameId&&c.eventId&&c.seasonId&&c.sourceAuthority&&
  Number.isSafeInteger(c.revision)&&c.revision>=0&&['READY','DISPUTED','WITHDRAWN'].includes(c.state),'INVALID_CHAPTER');
 const id=gameKey(c),prev=map.get(id);if(!prev||prev.revision<c.revision)map.set(id,c);
 else if(prev.revision===c.revision&&encode(prev)!==encode(c))throw Error('CONFLICTING_CHAPTER');
 }const guids=new Map();for(const c of map.values())if(c.state==='READY'&&c.gameGuid){
 const prior=guids.get(c.gameGuid);ensure(!prior||prior===gameKey(c),'DUPLICATE_POV_GAME');guids.set(c.gameGuid,gameKey(c));
 }return map;}
function subjectState(subject){return {subject,stage:0,peak:0,upBank:0,downBank:0,transitions:[],status:'VERIFIED',
 currentStage:0,lastVerifiedHistoricalStage:0,pendingReasons:[]};}
function canUp(s,t,credits){const level=s.stage+1;if(level>t.up.length)return false;if(s.subject.system==='REPUTATION'||level<3)return true;
 const minimum=t.reciprocity[level];return (credits.get(key(s.subject))?.size??0)>=minimum&&
 (credits.get(reverse(s.subject))?.size??0)>=minimum;}
function cross(s,t,credits,at,ack){
 while(s.stage<t.up.length&&s.upBank+1e-9>=t.up[s.stage]&&canUp(s,t,credits)){
 s.upBank=Math.max(0,s.upBank-t.up[s.stage]);s.stage++;s.peak=Math.max(s.peak,s.stage);s.transitions.push({kind:'UP',stage:s.stage,at});}
 while(s.stage>0&&s.downBank+1e-9>=t.down[s.stage-1]){
 if(s.subject.system==='RELATIONSHIP'&&s.subject.track==='RIVALRY'&&s.stage===3&&!ack.has(pair(s.subject)))break;
 s.downBank=Math.max(0,s.downBank-t.down[s.stage-1]);s.stage--;s.transitions.push({kind:'DOWN',stage:s.stage,at});}
 s.lastVerifiedHistoricalStage=s.stage;
}
function movement(s,n,direction,t,credits,at,ack){
 if(direction==='STRENGTHEN'){const offset=Math.min(n,s.downBank);s.downBank-=offset;s.upBank+=n-offset;}
 else {const offset=Math.min(n,s.upBank);s.upBank-=offset;s.downBank+=n-offset;}
 cross(s,t,credits,at,ack);
}
function recordReceipt(e,kind,requested,allocated,stage,revision,inputDigest,config,budgetKey=null,reciprocityKey=null){
 const claim=e.claim, signed=kind==='MOVEMENT'?(claim.effect==='STRENGTHEN'?allocated:-allocated):null;
 return {receiptId:hash([revision,claim.claimRevision,kind,budgetKey,reciprocityKey]),projectionRevision:revision,inputDigest,
 ruleSetVersion:config.version,policy:config.policy,claimRevision:claim.claimRevision,incidentId:claim.incidentId,
 subject:claim.subject,kind,state:kind==='MOVEMENT'&&!allocated?'CAPPED':'APPLIED',budgetKey,
 requestedUnits:requested,allocatedUnits:allocated,signedDelta:signed,reciprocityKey,stageAfter:stage,
 exceptionalAuthority:kind==='EXCEPTIONAL_STAGE'?'STRICT_TREACHERY':null,historicalPosition:claim.historicalPosition,
 reasonCodes:kind==='MOVEMENT'&&!allocated?['BUDGET_EXHAUSTED']:[]};
}
/** Evaluate the full current authoritative history. An approved policy requires a trusted external approval registry. */
export function evaluateHistory({chapters=[],effects=[],actorWitnesses=[],treachery=[],acknowledgments=[],calibration,trustedApprovals=[]}={}){
 const cfg=validateCalibration(calibration),active=select(chapters),publishable=trusted(cfg.policy,trustedApprovals);
 const unique=a=>[...new Map(a.map(v=>[encode(v),v])).values()].sort((a,b)=>encode(a).localeCompare(encode(b)));
 const inputDigest=hash({chapters:unique([...active.values()]),effects:unique(effects),actorWitnesses:unique(actorWitnesses),
 treachery:unique(treachery),acknowledgments:unique(acknowledgments),calibration});
 const revision=hash([VERSION,inputDigest]),states=new Map(),pending=new Map(),barriers=new Map(),credits=new Map(),ack=new Set();
 const receipts=[],audit=[],claims=[],extras=[],consumption=[];
 const state=s=>{const k=key(s);if(!states.has(k))states.set(k,subjectState(s));return states.get(k);};
 // Unknown Game-local order blocks only that Game and its dependent successors.
 const unknownAt=c=>c?.order&&[c.order.event,c.order.battle,c.order.game].every(Number.isSafeInteger)
  ?[c.order.event,c.order.battle,c.order.game,-1,-1]:[-Infinity,-Infinity,-Infinity,-Infinity,-Infinity];
 const pend=(s,reason,at=null)=>{const k=key(s);state(s);const p=pending.get(k)??new Set();p.add(reason);pending.set(k,p);
  const b=at??[-Infinity,-Infinity,-Infinity,-Infinity,-Infinity],old=barriers.get(k);
  if(!old||cmp(b,old)<0)barriers.set(k,b);};
 const blocked=(s,at)=>{const b=barriers.get(key(s));return !!b&&cmp(at,b)>=0;};
 const source=(row)=>{const c=active.get(gameKey(row));return c&&c.state==='READY'&&c.sourceAuthority===row.sourceAuthority&&
 c.battleId===row.battleId&&c.eventId===row.eventId?c:null;};
 const position=(c,p)=>c?.order&&[c.order.event,c.order.battle,c.order.game].every(Number.isSafeInteger)&&
 p?.order==='ORDERED'&&p.leagueOrderKey===c.order.key&&Number.isSafeInteger(p.recordingAtMs)&&
 Number.isSafeInteger(p.operationOrdinal)?[c.order.event,c.order.battle,c.order.game,p.recordingAtMs,p.operationOrdinal]:null;
 const observed=new Map();
 for(const row of effects){const c=row.claim,s=c?.subject;
 ensure(s&&TRACKS[s.system]?.includes(s.track)&&
 (s.system==='REPUTATION'?!!s.playerId:!!s.fromPlayerId&&!!s.toPlayerId&&s.fromPlayerId!==s.toPlayerId),'INVALID_SUBJECT');
 const ch=source(row);if(!ch){audit.push({claimId:c.claimId,reason:'INACTIVE_SOURCE'});continue;}
 if(c.decision!=='QUALIFIED'){audit.push({claimId:c.claimId,reason:'NOT_ADMITTED'});continue;}
 if(c.policy.policyVersion!==cfg.policy.policyVersion||c.policy.configurationVersion!==cfg.policy.configurationVersion||
 c.policy.status!==cfg.policy.status||c.policy.approvalRef!==cfg.policy.approvalRef){pend(s,'POLICY_MISMATCH',unknownAt(ch));continue;}
 const rule=cfg.rules[c.ruleId];if(!rule||rule.system!==s.system||rule.track!==s.track||rule.effect!==c.effect||
 !positive(rule.bands[c.significanceBandId])){pend(s,'UNCONFIGURED_EFFECT',unknownAt(ch));continue;}
 const at=position(ch,c.historicalPosition);if(!at){
  pend(s,'ORDER_UNAVAILABLE',unknownAt(ch));
  if(s.system==='RELATIONSHIP'&&c.effect==='STRENGTHEN'&&c.reciprocity?.decision!=='INELIGIBLE')
   pend({...s,fromPlayerId:s.toPlayerId,toPlayerId:s.fromPlayerId},'RECIPROCITY_ORDER_UNAVAILABLE',unknownAt(ch));
  continue;}
 const old=observed.get(c.claimId);if(old&&encode(old)!==encode(row))throw Error('CONFLICTING_CLAIM_ID');observed.set(c.claimId,row);
 const own=c.reciprocity?.decision==='ELIGIBLE'&&s.system==='RELATIONSHIP'&&
 c.reciprocity.independentActorRefs?.some(ref=>actorWitnesses.some(w=>w.qualification==='QUALIFIED'&&
 w.claimId===c.claimId&&w.incidentId===c.incidentId&&w.battleId===row.battleId&&
 w.actorPlayerId===s.fromPlayerId&&refKey(ref)===refKey(w.ref)));
 claims.push({kind:'MOVE',claim:c,row,ch,at,units:rule.bands[c.significanceBandId],own,
 group:encode([row.battleId,c.contributionKey,key(s),c.effect]),subject:s});}
 const byGroup=new Map();for(const e of claims){const prev=byGroup.get(e.group);
 if(!prev){byGroup.set(e.group,{...e,reciprocityProof:e.own?e:null});continue;}
 const winner=e.units>prev.units||(e.units===prev.units&&cmp(e.at,prev.at)<0)?e:prev;
 const ownProof=[prev.reciprocityProof,e.own?e:null].filter(Boolean).sort((a,b)=>cmp(a.at,b.at))[0]??null;
 byGroup.set(e.group,{...winner,reciprocityProof:ownProof});}
 const movements=[...byGroup.values()];
 for(const row of treachery){const s={system:'RELATIONSHIP',track:'HOSTILITY',fromPlayerId:row.victimPlayerId,toPlayerId:row.responsiblePlayerId};
 const ch=source(row);if(!ch)continue;const at=position(ch,row.historicalPosition);if(!at){pend(s,'TREACHERY_ORDER_UNKNOWN',unknownAt(ch));continue;}
 const required=['effectiveMutualAlliance','unilateralRupture','orderedHostility','kingLoss','responsibility','associatedIncident','eligibleModeAndIdentity'];
 if(!row.qualifierVersion||!row.incidentId||!row.incidentRevision||!row.qualifiedByStrictResolver||
 row.victimJudgment!=='BETRAYED'||row.strictProofRef?.kind!=='STRICT_PROOF'||
 row.bindingVictimJudgmentRef?.kind!=='JUDGMENT'||!required.every(k=>row.strictGates?.[k]===true)){
 audit.push({incidentId:row.incidentId,reason:'STRICT_TREACHERY_NOT_QUALIFIED'});continue;}
 const incidentKey=encode([row.incidentId,row.victimPlayerId,row.responsiblePlayerId]);
 const duplicate=extras.find(e=>e.kind==='TREACHERY'&&e.incidentKey===incidentKey);
 if(duplicate){ensure(encode(duplicate.row)===encode(row),'CONFLICTING_TREACHERY');continue;}
 extras.push({kind:'TREACHERY',subject:s,row,ch,at,incidentKey});}
 for(const row of acknowledgments){const ch=source(row);if(!ch)continue;const s={system:'RELATIONSHIP',track:'RIVALRY',fromPlayerId:row.fromPlayerId,toPlayerId:row.toPlayerId};
 const at=position(ch,row.historicalPosition);if(!at){pend(s,'ACK_ORDER_UNKNOWN',unknownAt(ch));
  pend({...s,fromPlayerId:s.toPlayerId,toPlayerId:s.fromPlayerId},'ACK_ORDER_UNKNOWN',unknownAt(ch));continue;}
 if(row.qualification==='QUALIFIED'&&row.acknowledgedSuperiorPlayerId===row.toPlayerId&&row.explicitStructuredJudgmentRef?.kind==='JUDGMENT')
 extras.push({kind:'ACK',subject:s,row,ch,at});}
 const seenCredits=new Set();for(const e of movements.flatMap(m=>m.reciprocityProof?[m.reciprocityProof]:[]).sort((a,b)=>cmp(a.at,b.at))){
 const recipKey=encode([e.ch.eventId,pair(e.subject),e.subject.track,e.subject.fromPlayerId,e.subject.toPlayerId]);
 if(seenCredits.has(recipKey))continue;seenCredits.add(recipKey);
 extras.push({kind:'RECIP',subject:e.subject,row:e.row,claim:e.claim,ch:e.ch,at:e.at,recipKey});}
 // Event allocation reserves all Treachery claims ahead of ordinary Hostility strengthening.
 const spent=new Map();const budgetKey=e=>e.subject.system==='REPUTATION'
 ?encode(['REPUTATION',e.row.battleId,e.subject.playerId,e.subject.track,e.claim.effect])
 :encode(['RELATIONSHIP',e.row.eventId,pair(e.subject),e.subject.track,e.subject.fromPlayerId,e.subject.toPlayerId,e.claim.effect]);
 for(const x of extras.filter(e=>e.kind==='TREACHERY').sort((a,b)=>cmp(a.at,b.at))){
 const k=encode(['RELATIONSHIP',x.row.eventId,pair(x.subject),'HOSTILITY',x.subject.fromPlayerId,x.subject.toPlayerId,'STRENGTHEN']);
 const cap=cfg.budgets.relationshipEvent.HOSTILITY.STRENGTHEN,used=spent.get(k)??0;
 const n=Math.max(0,Math.min(cap-used,cfg.treachery.consumptionUnits));spent.set(k,used+n);
 consumption.push({incidentId:x.row.incidentId,budgetKey:k,requestedUnits:cfg.treachery.consumptionUnits,
 allocatedUnits:n,unappliedUnits:cfg.treachery.consumptionUnits-n});}
 for(const e of movements.sort((a,b)=>cmp(a.at,b.at))){const k=budgetKey(e),budget=e.subject.system==='REPUTATION'
 ?cfg.budgets.reputationBattle[e.subject.track]:cfg.budgets.relationshipEvent[e.subject.track];
 const used=spent.get(k)??0;e.budgetKey=k;e.allocated=Math.max(0,Math.min(e.units,budget[e.claim.effect]-used));spent.set(k,used+e.allocated);}
// Own-episode movement and reciprocity are atomic, not an invented tie.
 // Otherwise, kind/lexical sorting never resolves consequential same-instant order.
 const timelineItems=[...movements,...extras];
 function dependent(a,b){
  if(a.kind==='RECIP'&&b.kind==='MOVE'&&a.claim.claimId===b.claim.claimId)return false;
  if(b.kind==='RECIP'&&a.kind==='MOVE'&&a.claim.claimId===b.claim.claimId)return false;
  if(key(a.subject)===key(b.subject))return true;
  const x=a.subject,y=b.subject;
  if(x.system!=='RELATIONSHIP'||y.system!=='RELATIONSHIP'||x.track!==y.track||pair(x)!==pair(y))return false;
  return a.kind==='RECIP'||b.kind==='RECIP'||(x.track==='RIVALRY'&&(a.kind==='ACK'||b.kind==='ACK'));
 }
 for(let i=0;i<timelineItems.length;i++)for(let j=0;j<i;j++){
  const a=timelineItems[i],b=timelineItems[j];
  if(cmp(a.at,b.at)===0&&dependent(a,b)){
   pend(a.subject,'AMBIGUOUS_SAME_MOMENT',a.at);
   pend(b.subject,'AMBIGUOUS_SAME_MOMENT',b.at);
  }
 }
 const rank={RECIP:0,MOVE:1,TREACHERY:2,ACK:3};const timeline=timelineItems
 .sort((a,b)=>cmp(a.at,b.at)||rank[a.kind]-rank[b.kind]||encode(a).localeCompare(encode(b)));
 for(const e of timeline){const s=state(e.subject);if(blocked(e.subject,e.at))continue;
 const t=cfg.stages[e.subject.system][e.subject.track];
 if(e.kind==='RECIP'){
 const k=key(e.subject),set=credits.get(k)??new Set();set.add(e.row.eventId);credits.set(k,set);
 if(publishable)receipts.push(recordReceipt(e,'RECIPROCITY',null,null,null,revision,inputDigest,cfg,null,e.recipKey));
 for(const dir of [k,reverse(e.subject)]){const other=states.get(dir);if(other&&!blocked(other.subject,e.at))cross(other,cfg.stages.RELATIONSHIP[other.subject.track],credits,e.at,ack);}
 }else if(e.kind==='MOVE'){
 if(e.allocated)movement(s,e.allocated,e.claim.effect,t,credits,e.at,ack);
 if(publishable)receipts.push(recordReceipt(e,'MOVEMENT',e.units,e.allocated,s.stage,revision,inputDigest,cfg,e.budgetKey));
 }else if(e.kind==='ACK'){
 ack.add(pair(e.subject));for(const dir of [key(e.subject),reverse(e.subject)]){
 const other=states.get(dir);if(other&&!blocked(other.subject,e.at))cross(other,cfg.stages.RELATIONSHIP.RIVALRY,credits,e.at,ack);}
 }else if(e.kind==='TREACHERY'){
 const after=s.stage<3?3:Math.min(cfg.treachery.maximumStage,s.stage+1);
 if(after>s.stage&&s.downBank>0){
  // Earlier qualified cooling cannot be silently erased or carried into the
  // exceptional stage without approved semantics. Preserve historical prefix.
  pend(e.subject,'TREACHERY_PREEXCEPTION_WEAKENING_UNCONFIGURED',e.at);continue;
 }
 if(after>s.stage){s.stage=after;
 s.peak=Math.max(s.peak,after);s.transitions.push({kind:'EXCEPTIONAL_UP',stage:after,at:e.at});}
 if(publishable){const synthetic={claim:{claimRevision:e.row.incidentRevision,incidentId:e.row.incidentId,
 subject:e.subject,effect:'STRENGTHEN',historicalPosition:e.row.historicalPosition}};
 receipts.push(recordReceipt(synthetic,'EXCEPTIONAL_STAGE',null,null,s.stage,revision,inputDigest,cfg));}
 }}
 const projections=[...states].map(([k,s])=>({...s,currentStage:pending.has(k)?null:s.stage,
 lastVerifiedHistoricalStage:s.stage,status:pending.has(k)?'PENDING':'VERIFIED',
 pendingReasons:[...(pending.get(k)??[])],reciprocityEvents:s.subject.system==='RELATIONSHIP'?(credits.get(k)?.size??0):null}))
 .sort((a,b)=>key(a.subject).localeCompare(key(b.subject)));
 return {version:VERSION,sharedContract:'AOF_SOCIAL_V1_SHARED_1',inputDigest,projectionRevision:revision,
 policy:cfg.policy,publicationAllowed:publishable,officialWrites:false,projections,receipts:publishable?receipts:[],
 simulation:publishable?null:{receiptPublicationBlocked:true},consumption,audit};
}
