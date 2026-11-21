import type {BattleFeature,PersonalityProfile} from '../../domain/socialV1.js';
import {PERSONALITY_AXES,type PersonalityAxis} from './personalityV1.js';
import type {PersonalityHistoryBattle} from '../../integration/personalityHistory.js';
import type {PersonalityGameUnlock} from './gameUnlock.js';

/** Pure owner-scoped read model over authenticated, transaction-fenced current
 * source history. Eligibility is not a score, a league point or an inference
 * that a game was won. Context opportunities remain independent per axis. */
export const LIVE_PERSONALITY_EVIDENCE_VERSION='AOF_PERSONALITY_LIVE_EVIDENCE_V1' as const;
export const LIVE_PERSONALITY_MINIMUM_QUALIFIED_BATTLES=3 as const;
export type LivePersonalityAxis={
  axis:PersonalityAxis;status:'DEVELOPING'|'CALIBRATION_PENDING'|'READY';
  value:number|null;measuredBattles:number;reasons:string[];
};
export type LivePersonalityEvidence={
  version:typeof LIVE_PERSONALITY_EVIDENCE_VERSION;
  requiredGames:3;eligibleGames:number;gameUnlock:'LOCKED'|'UNLOCKED';
  requiredQualifiedBattles:typeof LIVE_PERSONALITY_MINIMUM_QUALIFIED_BATTLES;
  qualifiedBattles:number;status:'PENDING_BATTLES'|'DEVELOPING'|'CALIBRATION_PENDING'|'READY';
  calibration:'NOT_APPROVED'|'APPROVED';
  axes:LivePersonalityAxis[];
};

const AXES=Object.keys(PERSONALITY_AXES) as PersonalityAxis[];
const distinct=(items:string[])=>[...new Set(items)].sort();
const valid=(v:number|null)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100;
/**
 * One fully current canonical Battle is one eligibility sample, even when it
 * contains three distinct accepted Games. A source-qualified *Game* may count
 * toward the separate three-original-Game milestone without making its
 * incomplete sibling Battle qualified.
 *
 * The caller MUST use the complete authenticated owner history and verified
 * native source snapshots; this pure function never admits uploads itself.
 */
export function projectLivePersonalityEvidence(
  ownerPlayerId:string,battles:readonly PersonalityHistoryBattle[],
  unlock:PersonalityGameUnlock,features:readonly BattleFeature[],
  profile:PersonalityProfile,
  approvedHostedCalibration=false):LivePersonalityEvidence {
  if(!ownerPlayerId||profile.playerId!==ownerPlayerId||
    unlock.status!==(unlock.eligibleGames>=3?'UNLOCKED':'LOCKED'))
    throw Error('PERSONALITY_LIVE_OWNER_OR_UNLOCK_INVALID');
  const qualified=new Set<string>();
  const seen=new Set<string>();
  const guids=new Set<string>();
  const sources=new Set<string>();
  for(const battle of battles){
    if(!battle.battleId||seen.has(battle.battleId))
      throw Error('PERSONALITY_LIVE_DUPLICATE_BATTLE');
    seen.add(battle.battleId);
    const expected=battle.gameIds;
    if(battle.gameManifestComplete===false||!expected.length||
      new Set(expected).size!==expected.length||
      battle.sources.length!==expected.length)continue;
    const seenGames=new Set<string>();
    let complete=true;
    for(const item of battle.sources){
      const s=item.source;
      const ownerBindings=s.roster.filter(p=>p.playerId===ownerPlayerId);
      const guid=typeof s.gameGuid==='string'?s.gameGuid.trim().toLowerCase():null;
      if(s.matchId!==battle.battleId||s.battleId!==battle.battleId||
        !expected.includes(s.gameId)||seenGames.has(s.gameId)||
        ownerBindings.length!==1||!guid||
        !['OFFICIAL','UNRESOLVED'].includes(s.outcome.qualification)||
        (s.outcome.qualification==='UNRESOLVED'&&
          (s.outcome.resultRevision!==null||s.outcome.winningPlayerIds!==null))||
        !/^[a-f0-9]{64}$/.test(s.sourceHash)||!Number.isSafeInteger(s.statisticsRevision)||
        s.statisticsRevision<1){complete=false;break;}
      if(guids.has(guid)||sources.has(s.sourceHash))
        throw Error('PERSONALITY_LIVE_DUPLICATE_CURRENT_RECORDING');
      seenGames.add(s.gameId);guids.add(guid);sources.add(s.sourceHash);
    }
    if(complete)qualified.add(battle.battleId);
  }
  const qualifiedBattles=qualified.size;
  const canShow=unlock.status==='UNLOCKED'&&
    qualifiedBattles>=LIVE_PERSONALITY_MINIMUM_QUALIFIED_BATTLES;
  const axes=AXES.map(axis=>{
    const verified=features.filter(f=>f.playerId===ownerPlayerId&&f.featureId===axis&&
      qualified.has(f.battleId)&&f.featureVersion==='AOF_PERSONALITY_FEATURES_V1'&&
      f.sampleUnit==='INDEPENDENT_BATTLE'&&f.numerator!==null&&
      f.denominator!==null&&f.denominator>0&&f.numerator>=0&&f.numerator<=f.denominator);
    const measuredBattles=new Set(verified.map(f=>f.battleId)).size;
    const sourceMissing=features.filter(f=>f.playerId===ownerPlayerId&&f.featureId===axis&&
      qualified.has(f.battleId)).flatMap(f=>f.coverage.missing);
    const candidate=profile.sliders.find(s=>s.axis===axis);
    const ready=canShow&&approvedHostedCalibration&&measuredBattles>=2&&
      candidate?.status==='READY'&&valid(candidate.value);
    const reasons=ready?[]:distinct([
      ...(!canShow?[unlock.status==='LOCKED'?
        'THREE_SOURCE_QUALIFIED_GAMES_REQUIRED':'THREE_QUALIFIED_BATTLES_REQUIRED']:[]),
      ...(measuredBattles<2?['AXIS_REQUIRES_TWO_INDEPENDENT_MEASURED_BATTLES']:[]),
      ...(measuredBattles<2?sourceMissing.filter(x=>x!=='CONTEXT_NORMALIZATION_ANCHOR_UNAVAILABLE'):[]),
      ...(!approvedHostedCalibration?['APPROVED_HOSTED_CALIBRATION_REQUIRED']:[]),
    ]);
    return {axis,status:ready?'READY' as const:
      measuredBattles>=2&&!approvedHostedCalibration?'CALIBRATION_PENDING' as const:'DEVELOPING' as const,
      value:ready?candidate!.value:null,measuredBattles,reasons};
  });
  const status=canShow
    ?axes.some(a=>a.status==='READY')?'READY' as const
      :axes.some(a=>a.status==='CALIBRATION_PENDING')?'CALIBRATION_PENDING' as const
      :'DEVELOPING' as const
    :'PENDING_BATTLES' as const;
  return {version:LIVE_PERSONALITY_EVIDENCE_VERSION,
    requiredGames:3,eligibleGames:unlock.eligibleGames,gameUnlock:unlock.status,
    requiredQualifiedBattles:LIVE_PERSONALITY_MINIMUM_QUALIFIED_BATTLES,
    qualifiedBattles,status,
    calibration:approvedHostedCalibration?'APPROVED':'NOT_APPROVED',axes};
}
