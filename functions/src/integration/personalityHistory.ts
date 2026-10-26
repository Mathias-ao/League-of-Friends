import type {BattleFeature,SourceSnapshot} from '../domain/socialV1.js';
import {validateSharedRecord} from '../domain/socialV1Validation.js';
import {bindingDigest} from '../engines/nativeRecordingIntegration.js';
import {PERSONALITY_AXES,projectPersonalityPreview,type AuthorizedGame,type GameContext,type PersonalityCalibration}
  from '../engines/personalityV1/personalityV1.js';
import {toPrivateShared1Personality} from '../engines/personalityV1/shared1Adapter.js';

type Bag=Record<string,any>;
export interface PersonalityHistoryBattle {
  battleId:string;gameIds:string[];
  sources:Array<{source:SourceSnapshot;statistics:Bag;match:Bag;game:Bag}>;
}
/** No episode-complete claim from a mere numeric count or empty array. The
 * hydrated player arrays must be present in the immutable verified artifact and
 * its producer-unique chronology envelope; compact-only shared refs do not
 * qualify command-posture without an actual expansion. */
function verifiedCommandChronology(statistics:Bag,participant:Bag,replaySlot:number):boolean{
  const delivery=statistics.sharedEpisodeDelivery;
  const engagement=participant?.military?.engagements;
  const producer=delivery?.producerGroups;
  const ref=delivery?.playerRefs?.find?.((x:Bag)=>x.replaySlot===replaySlot&&x.playerId===replaySlot);
  return delivery?.version==='AOF_DIRECT_SHARED_EPISODES_V1_EXPERIMENTAL'&&
    delivery?.sourceMode==='producer_unique_episodes'&&
    Array.isArray(producer?.battles)&&Array.isArray(producer?.skirmishes)&&
    Array.isArray(producer?.reinforcements)&&
    Array.isArray(ref?.groups?.battles)&&
    Array.isArray(engagement?.engagementEvidence?.battles)&&
    Array.isArray(engagement?.raidEvidence?.initiatedEpisodes)&&
    engagement.engagementModelVersion==='AOF_ENGAGEMENT_STATISTICS_V4';
}

/** Future context admission is server-owned, never request/config supplied by a
 * player. No context classifier or numerical policy is installed in INT-B. */
export type AdmittedPersonalityContext=(input:PersonalityHistoryBattle['sources'][number])=>GameContext|null;

export function projectPrivatePersonalityHistory(ownerPlayerId:string,battles:PersonalityHistoryBattle[],
  inputDigest:string,contextAdmission?:AdmittedPersonalityContext,
  calibration:PersonalityCalibration|null=null){
  const games:AuthorizedGame[]=[],pending:BattleFeature[]=[];
  for(const battle of battles){
    const complete=battle.sources.length===battle.gameIds.length&&battle.sources.every(s=>
      s.source.outcome.qualification==='OFFICIAL'&&
      Number.isSafeInteger(s.match.firstCompletedAt?.toMillis?.())&&
      s.source.roster.some(p=>p.playerId===ownerPlayerId));
    const contexts=battle.sources.map(s=>contextAdmission?.(s)??null);
    if(complete&&contexts.every(c=>c!==null)){
      battle.sources.forEach((item,index)=>{
        const mapped=item.source.roster.find(p=>p.playerId===ownerPlayerId)!;
        const participant=item.statistics.participants?.find((p:Bag)=>p.replaySlot===mapped.replaySlot);
        games.push({battleId:battle.battleId,matchId:battle.battleId,gameId:item.source.gameId,
          gameNumber:item.game.gameNumber,playerId:ownerPlayerId,replaySlot:mapped.replaySlot,
          sourceHash:item.source.sourceHash,sourceAuthority:item.source.authorityRevision,
          mappingDigest:item.source.mappingDigest,authorityRevision:item.source.statisticsRevision,
          sourceStatus:'READY',outcome:'OFFICIAL',admitted:true,
          episodeChronologyComplete:verifiedCommandChronology(item.statistics,participant,mapped.replaySlot),
          playedAtMs:item.match.firstCompletedAt.toMillis(),
          context:contexts[index]!,statistics:participant});
      });
    }else if(battle.sources.length){
      const digest=bindingDigest([battle.battleId,battle.gameIds,battle.sources.map(s=>s.source)]);
      for(const axis of Object.keys(PERSONALITY_AXES))pending.push(validateSharedRecord('BattleFeature',{
        playerId:ownerPlayerId,battleId:battle.battleId,matchId:battle.battleId,inputDigest:digest,
        // A source-bound *unmeasured intake* row, never labelled as an engine measurement.
        featureVersion:'AOF_INT_B_PENDING_FEATURE_1',contextKey:'PERSONALITY_CONTEXT_NOT_ADMITTED',featureId:axis,
        numerator:null,denominator:null,normalized:null,sampleUnit:'INDEPENDENT_BATTLE',
        evidenceRefs:battle.sources.map(s=>({kind:'CONTEXT',id:battle.battleId+'/'+s.source.gameId,
          revision:String(s.source.statisticsRevision),digest:s.source.authorityRevision})),
        coverage:{tier:'INSUFFICIENT',ruleId:'AOF_INT_B_PENDING_FEATURE_1',
          missing:[...(!complete?['INCOMPLETE_OR_UNORDERED_BATTLE_INPUT']:[]),'CONTEXT_ADMISSION_PENDING','CALIBRATION_NOT_CONFIGURED'],
          limitations:['UNMEASURED_SOURCE_INTAKE_NOT_A_PERSONALITY_SCORE']},
      }));
    }
  }
  // Accepted #137 engine + converter. There are deliberately no numeric defaults.
  const preview=projectPersonalityPreview(ownerPlayerId,games,calibration);
  const candidate=toPrivateShared1Personality(preview,calibration,
    calibration?.configurationVersion??'AOF_PERSONALITY_UNCONFIGURED_1');
  const battleFeatures=[...candidate.battleFeatures,...pending].sort((a,b)=>a.battleId.localeCompare(b.battleId)||a.featureId.localeCompare(b.featureId));
  for(const f of battleFeatures)validateSharedRecord('BattleFeature',f);
  const personalityProfile=validateSharedRecord('PersonalityProfile',{...candidate.personalityProfile,
    projectionRevision:bindingDigest([candidate.personalityProfile.projectionRevision,inputDigest,battleFeatures])});
  return {publication:candidate.publication,battleFeatures,personalityProfile,
    contextAdmission:contextAdmission?'SOURCE_QUALIFIED' as const:'PENDING' as const,
    calibration:calibration?'PROPOSED' as const:'UNCONFIGURED' as const};
}
