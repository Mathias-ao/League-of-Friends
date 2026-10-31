import {type SourceSnapshot} from '../domain/socialV1.js';
import {validateSharedRecord} from '../domain/socialV1Validation.js';
import type {collectMyCurrentBattleHistory} from '../queries/getMyPersonalityHistory.js';

export const PRIVATE_HONOURS_PREVIEW='AOF_HONOURS_PRIVATE_SOURCE_PREVIEW_1' as const;
export const HONOUR_TEST_BASELINE=[
  ['FAST_CASTLE','TROPHY','Fast Castle','Comparable opening, strategy, Season maturity and quality qualification remain Pending.'],
  ['WONDER','TROPHY','Wonder','Completed Wonder ownership and an independently verified Wonder-victory method are unavailable. A BUILD request or ordinary winner proves neither.'],
  ['UNBROKEN','EPITHET','the Unbroken','Season eligibility and the qualifying unbeaten sample remain unapproved.'],
  ['THREE_SCHOOLS','EPITHET','Master of the Three Schools','Independent source-qualified Elite branches and approved tier gates remain Pending.'],
  ['FFA_SOLO_WIN','DISTINCTION','FFA sole winner','No current source-qualified sole official FFA win is available for this preview.'],
  ['BOOMER','DISTINCTION','Boomer','A same-Game composite method and quality gates remain Pending; queue and BUILD requests do not prove completed development.'],
  ['EXPLORER','DISTINCTION','Explorer','Qualified full-Game exploration evidence and quality gates are unavailable; command routes are not observed fog coverage.'],
  ['GOLD','DISTINCTION','Gold','Qualified gold influence and commitment evidence needs approved comparison and quality gates; it does not prove gold mined.'],
  ['AGGRESSION','DISTINCTION','Aggression','Independent directed military evidence and quality gates remain Pending; command volume is not executed combat.'],
  ['DEFENSIVE','DISTINCTION','Defence','Source-attributed incoming threat, response and appropriate quality gates remain Pending; requests do not prove rescue.'],
] as const;

type Current=Awaited<ReturnType<typeof collectMyCurrentBattleHistory>>;
export type HonourSourceRef={battleId:string;gameId:string;seasonId:string;sourceHash:string;statisticsRevision:number;
  authorityRevision:string;resultRevision:number|null};
const ref=(s:SourceSnapshot):HonourSourceRef=>({battleId:s.battleId,gameId:s.gameId,seasonId:s.seasonId,
  sourceHash:s.sourceHash,statisticsRevision:s.statisticsRevision,authorityRevision:s.authorityRevision,
  resultRevision:s.outcome.resultRevision});

/** This projection accepts only the server's fenced native intake, never client
 * evidence JSON. It observes the frozen concepts; it neither runs sandbox draft
 * thresholds nor resolves competitive holders or grants an entitlement. */
export function projectPrivateHonoursPreview(ownerPlayerId:string,current:Pick<Current,'battles'|'loaded'|'pending'|'inputDigest'|'coverage'>){
  const sources=current.loaded.map(item=>{
    const source=validateSharedRecord('SourceSnapshot',item.source);
    if(!source.roster.some(p=>p.playerId===ownerPlayerId)||source.battleId!==source.matchId||
      item.game.activeReplayStatisticsId!==source.sourceHash||
      item.game.replayStatisticsRevision!==source.statisticsRevision)
      throw new Error('Private honour source identity mismatch');
    return source;
  });
  if(new Set(sources.map(s=>s.battleId+'\0'+s.gameId)).size!==sources.length||
    new Set(sources.map(s=>s.gameGuid)).size!==sources.length)
    throw new Error('Duplicate private honour Game source');
  const completeBattles=new Set(current.battles.filter(b=>b.gameIds.length>0&&
    !current.pending.some(p=>p.battleId===b.battleId)&&
    b.gameIds.every(id=>sources.some(s=>s.battleId===b.battleId&&s.gameId===id)))
    .map(b=>b.battleId));
  const ffa=current.loaded.filter(item=>{
    const s=item.source,r=item.game.canonicalResult;
    return completeBattles.has(s.battleId)&&item.match.format==='FFA'&&s.roster.length>=3&&
      s.outcome.qualification==='OFFICIAL'&&s.outcome.winningPlayerIds.length===1&&
      s.outcome.winningPlayerIds[0]===ownerPlayerId&&r?.type==='PLAYER_WIN'&&
      r.revision===s.outcome.resultRevision&&r.winningPlayerIds?.length===1&&
      r.winningPlayerIds[0]===ownerPlayerId;
  }).map(item=>ref(item.source));
  return {version:PRIVATE_HONOURS_PREVIEW,visibility:'OWNER_ONLY' as const,ownerPlayerId,
    inputDigest:current.inputDigest,mode:'READ_ONLY_TESTING' as const,
    coverage:{currentSources:sources.length,ownBattles:current.coverage.ownBattles,
      completeSourceBattles:completeBattles.size},sources:sources.map(ref),pendingSources:current.pending,
    honours:HONOUR_TEST_BASELINE.map(([key,kind,label,reason])=>({key,kind,label,
      status:key==='FFA_SOLO_WIN'&&ffa.length?'SOURCE_CANDIDATE' as const:'PENDING' as const,
      reason:key==='FFA_SOLO_WIN'&&ffa.length?
        'Sole official FFA winner observed. This does not prove never allied or unaided play. Distinction grades and grants remain Pending.':reason,
      independentBattles:key==='FFA_SOLO_WIN'?new Set(ffa.map(s=>s.battleId)).size:null,
      evidence:key==='FFA_SOLO_WIN'?ffa:[]})),
    effects:{officialWrites:false as const,receiptPublication:false as const,entitlementGrants:false as const}};
}
