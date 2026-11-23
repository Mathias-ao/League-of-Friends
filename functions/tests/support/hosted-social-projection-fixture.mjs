/** Pure proposed-policy projection over an actual demo source collector.
 * No approval record, hosted query, credential or policy activation. This keeps
 * genuine method/correction/UI regression coverage while EU R is unapproved.
 */
import assert from 'node:assert/strict';
import {digest} from '../../lib/engines/nativeRecordingIntegration.js';
import {collectMyCurrentBattleHistory} from '../../lib/queries/getMyPersonalityHistory.js';
import {bindSourceGrades} from '../../lib/integration/privateProgression.js';
import {HOSTED_POLICY_SPEC,hostedBinderCalibration} from '../../lib/integration/hostedSocialPolicy.js';
import {projectHostedSocialProgression,fixedHostedOpportunity} from '../../lib/integration/hostedSocialProgression.js';

export async function projectControlledHostedHistory(input,derived){
  assert.equal(input.env.FUNCTIONS_EMULATOR,'true');
  assert.match(input.env.GCLOUD_PROJECT,/^demo-/);
  const current=await collectMyCurrentBattleHistory({...input,maxOwnGames:8,includeScheduleOrder:true});
  const calibration=structuredClone(HOSTED_POLICY_SPEC.calibration),binder=hostedBinderCalibration(calibration);
  const bound=[],chapters=[],context=new Map(),pendingSources=[];
  for(const pending of current.pending){
    const match=(await input.db.doc('matches/'+pending.battleId).get()).data();
    const game=pending.gameId?(await input.db.doc('matches/'+pending.battleId+'/games/'+pending.gameId).get()).data():null;
    pendingSources.push({seasonId:match?.seasonId??null,rosterPlayerIds:game?.players?.map(p=>p.playerId)??null});
  }
  for(const loaded of current.loaded){
    const source=loaded.source,schedule=current.scheduleOrders.find(o=>o.battleId===source.battleId&&o.gameId===source.gameId);
    chapters.push({battleId:source.battleId,matchId:source.matchId,gameId:source.gameId,gameGuid:source.gameGuid,
      eventId:source.eventId,seasonId:source.seasonId,sourceAuthority:source.authorityRevision,
      revision:source.statisticsRevision,state:'READY',order:schedule?.order??null});
    const raw=derived.get(source.authorityRevision);
    if(!raw){
      // Unsupported genuine formats/worker failures retain factual quiet pairs,
      // without substituting another actor's response or inventing an opportunity.
      pendingSources.push({seasonId:source.seasonId,rosterPlayerIds:source.roster.map(p=>p.playerId)});
      bound.push({source,sourceMethodRevision:digest(Buffer.from('UNAVAILABLE:'+source.authorityRevision)),
        cards:[],effects:[],inferences:[],actorWitnesses:[]});continue;
    }
    bound.push(bindSourceGrades(raw,source,loaded.statistics,input.env.AOF_NATIVE_REPLAY_PROCESSOR_REVISION??'',schedule,loaded.game.gameNumber,binder));
    context.set(source.authorityRevision,{loaded,witnesses:raw.gradeWitnesses});
  }
  const result=projectHostedSocialProgression({owner:input.actor.playerId,inputs:bound,chapters,calibration,pendingSources,
    coverage:{...current.coverage,pendingSources:pendingSources.length},inputRevision:current.inputDigest,
    policyRevision:'UNAPPROVED_CONTROLLED_PROJECTION_ONLY',opportunity:(b,s,claim)=>{
      const {loaded,witnesses}=context.get(b.source.authorityRevision);
      return fixedHostedOpportunity(b,loaded.statistics,s,loaded.match.format,claim,witnesses);
    }});
  await current.revalidate();return result;
}
