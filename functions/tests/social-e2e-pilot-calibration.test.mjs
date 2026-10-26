import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {evaluateHistory,validateCalibration} from '../lib/engines/socialV1History/history.js';
import {
  createSocialE2EPilotCalibration,SOCIAL_E2E_PILOT_VERSION,
  SOCIAL_E2E_PILOT_STATUS,SOCIAL_E2E_PILOT_RULES
} from '../lib/engines/socialV1History/e2ePilotCalibration.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
const names={REPUTATION:['GALLANTRY','CRUELTY','CHIVALRY'],RELATIONSHIP:['RIVALRY','HOSTILITY','BOND']};

function chapter(n){
  const battleId='battle-'+n;
  return {battleId,matchId:battleId,gameId:'game-'+n,gameGuid:hash('guid-'+n),
    eventId:'event-'+n,seasonId:'season',sourceAuthority:hash('source-'+n),
    state:'READY',revision:1,order:{event:n,battle:n,game:1,key:'official-'+n}};
}
function effect(c,n,{subject={system:'RELATIONSHIP',track:'RIVALRY',fromPlayerId:'a',toPlayerId:'b'},
  ruleId='E2E_PAIR_CONTEST',band='ORDINARY',contributionKey='distinct-'+n,pol=createSocialE2EPilotCalibration().policy}={}){
  const claimId='pilot-claim-'+n;
  return {battleId:c.battleId,gameId:c.gameId,eventId:c.eventId,sourceAuthority:c.sourceAuthority,
    claim:{claimId,claimRevision:hash(claimId),incidentId:'pilot-incident-'+n,
      incidentRevision:hash('incident-'+n),subject,effect:'STRENGTHEN',
      basis:'BOUNDED_INFERENCE',ruleId,policy:pol,decision:'QUALIFIED',
      supportRefs:[],significanceBandId:band,contributionKey,
      historicalPosition:{leagueOrderKey:c.order.key,gameNumber:1,recordingAtMs:n*100,
        operationOrdinal:n,order:'ORDERED'},
      reciprocity:{decision:'INELIGIBLE',ruleId:'PILOT_NO_REVERSE_INFERENCE',
        independentActorRefs:[]}}};
}
const simulate=(chapters,effects)=>evaluateHistory({
  chapters,effects,calibration:createSocialE2EPilotCalibration(),
  trustedApprovals:[{policyVersion:'AOF_SOC_GRADE_OWNER_REVIEW_CATALOGUE_V0_1',
    configurationVersion:SOCIAL_E2E_PILOT_VERSION,status:'APPROVED',approvalRef:'not-a-real-approval'}]
});

test('all six independently calibrated tracks and nine explicit family rules, no hidden approvals',()=>{
  const cfg=createSocialE2EPilotCalibration();
  assert.equal(SOCIAL_E2E_PILOT_STATUS,'PRIVATE_SIMULATION_ONLY');
  assert.equal(cfg.version,SOCIAL_E2E_PILOT_VERSION);
  assert.equal(cfg.policy.status,'PROPOSED');assert.equal(cfg.policy.approvalRef,null);
  validateCalibration(cfg);
  assert.deepEqual(Object.keys(cfg.stages.REPUTATION).sort(),names.REPUTATION.sort());
  assert.deepEqual(Object.keys(cfg.stages.RELATIONSHIP).sort(),names.RELATIONSHIP.sort());
  assert.equal(Object.keys(cfg.rules).length,9);
  assert.deepEqual(Object.keys(cfg.rules).sort(),Object.keys(SOCIAL_E2E_PILOT_RULES).sort());
  for(const rule of Object.values(cfg.rules))
    assert.deepEqual(rule.bands,{ORDINARY:1,SUBSTANTIAL:2});
  for(const track of names.RELATIONSHIP){
    assert.equal(cfg.stages.RELATIONSHIP[track].reciprocity[3],2);
    assert.equal(cfg.stages.RELATIONSHIP[track].reciprocity[4],3);
  }
  const mutated=createSocialE2EPilotCalibration();mutated.stages.REPUTATION.GALLANTRY.up[0]=99;
  assert.equal(createSocialE2EPilotCalibration().stages.REPUTATION.GALLANTRY.up[0],2);
});

test('pilot can move a source-ordered simulated track while never granting any receipt',()=>{
  const c=chapter(1),r=simulate([c],[effect(c,1,{band:'SUBSTANTIAL'})]);
  assert.equal(r.publicationAllowed,false);
  assert.equal(r.simulation.receiptPublicationBlocked,true);
  assert.equal(r.officialWrites,false);assert.deepEqual(r.receipts,[]);
  const rivalry=r.projections.find(x=>x.subject.track==='RIVALRY');
  assert.equal(rivalry.stage,1);
  assert.equal(rivalry.subject.fromPlayerId,'a');
  assert.equal(r.projections.find(x=>x.subject.fromPlayerId==='b'),undefined);
});

test('repeated one-sided E2E Rivalry cannot pass stage 2 without independent reverse conduct',()=>{
  const cs=Array.from({length:9},(_,i)=>chapter(i+1));
  const r=simulate(cs,cs.map((c,i)=>effect(c,i+1,{band:'SUBSTANTIAL'})));
  const rivalry=r.projections.find(x=>x.subject.track==='RIVALRY');
  assert.equal(rivalry.stage,2);
  assert.equal(rivalry.reciprocityEvents,0);
  assert.deepEqual(r.receipts,[]);
});

test('same Battle/track/effect/contribution key is not multiplied by duplicate metric labels',()=>{
  const c=chapter(1);
  const a=effect(c,1,{contributionKey:'same-source-episode'});
  const b=effect(c,2,{contributionKey:'same-source-episode',band:'SUBSTANTIAL'});
  const r=simulate([c],[a,b]);
  const rivalry=r.projections.find(x=>x.subject.track==='RIVALRY');
  assert.equal(rivalry.stage,1);
  assert.equal(rivalry.upBank,0);
  assert.deepEqual(r.receipts,[]);
});

test('unknown history order remains pending rather than inventing an E2E ordering',()=>{
  const c=chapter(1);c.order=null;
  const row=effect(chapter(1),1);
  const r=simulate([c],[row]);
  assert.equal(r.projections[0].status,'PENDING');
  assert.equal(r.projections[0].currentStage,null);
  assert.deepEqual(r.receipts,[]);
});
