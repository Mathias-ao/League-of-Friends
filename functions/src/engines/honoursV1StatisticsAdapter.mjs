/**
 * Boundary between AoF's real statistics + canonical GameOutcome shapes and
 * the test-only ten-honour rules. Pure; never exposed to client, never grants.
 *
 * The caller MUST be a trusted server/emulator read which pins current READY
 * source, statistics revision, official result, mapping and admission review.
 * A client-crafted copy of these input fields has no proof authority.
 */
export const HONOURS_STATISTICS_ADAPTER_TEST_VERSION="AOF_HONOURS_STATS_ADAPTER_TEST_V1";
const text=v=>typeof v==="string"&&v.length>0;
const int=v=>Number.isInteger(v)&&v>=1;
const time=v=>typeof v==="number"&&Number.isFinite(v)&&v>=0;
const distinct=a=>Array.isArray(a)&&a.every(text)&&new Set(a).size===a.length;
const format=v=>v==="ONE_V_ONE"?"1V1":v==="FFA"?"FFA":
  ["TWO_V_TWO","THREE_V_THREE","FOUR_V_FOUR","ASYMMETRIC_TEAM"].includes(v)?"TEAM":null;
const mapClass=v=>v==="STANDARD"?v:null;

function officialWinnerIds(match,canonical) {
  if(!canonical||!int(canonical.revision)||!["PLAYER_WIN","TEAM_WIN","COALITION_WIN"].includes(canonical.type))return null;
  const roster=match.participants;
  if(!Array.isArray(roster)||roster.length<2)return null;
  let winners;
  if(canonical.type==="PLAYER_WIN") {
    winners=[canonical.winnerPlayerId];
    if(match.format==="FFA"&&roster.length<3)return null;
  } else if(canonical.type==="COALITION_WIN") {
    if(match.format!=="FFA"||match.gameConfigSnapshot?.diplomacyEnabled!==true)return null;
    winners=canonical.winnerPlayerIds;
    if(!Array.isArray(winners)||winners.length<2||winners.length>=roster.length)return null;
  } else {
    if(match.format==="FFA"||!Number.isInteger(canonical.winnerTeam))return null;
    winners=roster.filter(p=>p.team===canonical.winnerTeam).map(p=>p.playerId);
  }
  if(!distinct(winners)||!winners.length||
    winners.some(w=>!roster.some(p=>p.playerId===w)))return null;
  if(Array.isArray(canonical.winningPlayerIds)&&
    (canonical.winningPlayerIds.length!==winners.length||
     canonical.winningPlayerIds.some(w=>!winners.includes(w))))return null;
  return winners;
}

export function normalizeTrustedHonoursGame(input) {
  const {statistics:stats,match,source,canonicalResult,opportunityReview,metricReviews,
    wonderMethodReview,wonderConstructionReviews,wonderChallengeReview}=input??{};
  if(!stats||!match||!source||!text(stats.gameId)||!text(stats.matchId)||
     !text(match.seasonId)||stats.seasonId!==match.seasonId||
     !text(source.activeSourceHash)||!int(source.activeStatisticsRevision)||
     !Array.isArray(match.participants)||!distinct(match.participants.map(p=>p.playerId)))
    throw new Error("Incomplete authoritative Game identity and canonical roster");
  const f=format(match.format);
  if(!f)throw new Error("Unsupported canonical Match format");
  const mappingMatches=Array.isArray(stats.players)&&
    distinct(stats.players.map(p=>p.playerId))&&
    stats.players.length===match.participants.length&&
    stats.players.every(p=>match.participants.some(q=>q.playerId===p.playerId));
  const ready=source.nativeReady===true&&
    stats.eligible===true&&stats.sourceHash===source.activeSourceHash&&
    stats.revision===source.activeStatisticsRevision&&
    source.matchId===stats.matchId&&source.gameId===stats.gameId&&
    mappingMatches;
  // This adapter never trusts mere replay's postgame winner: official result
  // must be separately accepted, final and independently non-disputed.
  const winners=officialWinnerIds(match,canonicalResult);
  const resultFinal=ready&&source.resultUndisputed===true&&
    canonicalResult?.revision===source.activeResultRevision&&winners!==null;
  const roster=match.participants.map(p=>p.playerId);
  const reviewedStart=ready&&opportunityReview?.sourceHash===stats.sourceHash&&
    opportunityReview?.gameId===stats.gameId&&
    opportunityReview?.approval==="SOURCE_REVIEWED"&&
    opportunityReview?.startClass==="STANDARD";
  const measurements={};
  for(const p of stats.players??[]) {
    const playerId=p.playerId;
    const metrics={};
    const fcApproved=metricReviews?.[playerId]?.fastCastle;
    const castleMs=p.values?.castle;
    if(ready&&time(castleMs)&&p.models?.castle==="AOF_OPENING_STATISTICS_V6" &&
       fcApproved?.sourceHash===stats.sourceHash&&
       fcApproved?.gameId===stats.gameId&&
       fcApproved?.sourceRevision===source.activeStatisticsRevision&&
       fcApproved?.proof==="SOURCE_QUALIFIED_RESEARCH_AND_CANCELLATION") {
      metrics.fastCastle={projectedCastleAgeMs:castleMs,
        model:"AOF_OPENING_STATISTICS_V6",sourceQualified:true};
    }
    for(const key of ["boomer","explorer","gold","aggression","defensive"]) {
      const reviewed=metricReviews?.[playerId]?.[key];
      if(!ready||reviewed?.sourceHash!==stats.sourceHash||
         reviewed?.gameId!==stats.gameId||
         reviewed?.sourceRevision!==source.activeStatisticsRevision||
         reviewed?.proof!=="SOURCE_REVIEWED_METRIC"||!reviewed.evidence)continue;
      // The test evaluator still needs independently reviewed per-metric
      // method/cutoff provenance, not just arbitrary values in Stats.
      metrics[key]={...reviewed.evidence,sourceQualified:true,
        modelState:"SOURCE_VALIDATED"};
    }
    measurements[playerId]=metrics;
  }
  // A BUILD request is not a completed Wonder. These witnesses must be
  // reviewed and tied to the current original Game/hash/model revision.
  const wonderConstructions=ready&&Array.isArray(wonderConstructionReviews)?
    wonderConstructionReviews.filter(w=>
      w?.gameId===stats.gameId&&w.sourceHash===stats.sourceHash&&
      w.sourceRevision===source.activeStatisticsRevision&&
      text(w.buildingInstanceId)&&roster.includes(w.ownerPlayerId)&&
      w.complete===true&&w.verifiedBy==="INDEPENDENT_CONSTRUCTION_REVIEW"
    ).map(w=>({buildingInstanceId:w.buildingInstanceId,
      ownerPlayerId:w.ownerPlayerId,complete:true,
      verifiedBy:"INDEPENDENT_CONSTRUCTION_REVIEW",
      sourceHash:stats.sourceHash,sourceRevision:source.activeStatisticsRevision})):[];
  let wonderVictory=null;
  if(resultFinal&&match.gameConfigSnapshot?.victory?.wonder===true&&
     wonderMethodReview?.method==="WONDER_VICTORY"&&
     wonderMethodReview?.verifiedBy==="OFFICIAL_METHOD_REVIEW"&&
     wonderMethodReview?.gameId===stats.gameId&&
     wonderMethodReview?.sourceHash===stats.sourceHash&&
     wonderMethodReview?.sourceRevision===source.activeStatisticsRevision&&
     wonderMethodReview?.resultRevision===canonicalResult.revision&&
     text(wonderMethodReview?.winnerId)&&winners.includes(wonderMethodReview.winnerId)&&
     text(wonderMethodReview?.winningWonderId)&&
     wonderMethodReview?.winningWonderOwnerPlayerId===wonderMethodReview.winnerId&&
     wonderMethodReview?.winningWonderCompleted===true) {
    const ffaAllies=f==="FFA"&&
      wonderMethodReview.ffaAllianceReview==="SOURCE_VERIFIED_EFFECTIVE_ALLIANCE"&&
      Array.isArray(wonderMethodReview.qualifiedAllyPlayerIds)&&
      wonderMethodReview.qualifiedAllyPlayerIds.every(id=>
        winners.includes(id)&&id!==wonderMethodReview.winnerId)?
      [...new Set(wonderMethodReview.qualifiedAllyPlayerIds)]:[];
    wonderVictory={method:"WONDER_VICTORY",verifiedBy:"OFFICIAL_METHOD_REVIEW",
      winnerId:wonderMethodReview.winnerId,
      winningWonderId:wonderMethodReview.winningWonderId,
      winningWonderOwnerPlayerId:wonderMethodReview.winnerId,
      winningWonderCompleted:true,resultRevision:canonicalResult.revision,
      sourceRevision:source.activeStatisticsRevision,sourceHash:stats.sourceHash,
      ffaAllianceReview:ffaAllies.length?"SOURCE_VERIFIED_EFFECTIVE_ALLIANCE":null,
      qualifiedAllyPlayerIds:ffaAllies};
  }
  const wonderChallenge=ready&&wonderVictory&&
    wonderChallengeReview?.gameId===stats.gameId&&
    wonderChallengeReview?.sourceHash===stats.sourceHash&&
    wonderChallengeReview?.sourceRevision===source.activeStatisticsRevision&&
    wonderChallengeReview?.resultRevision===canonicalResult.revision&&
    wonderChallengeReview?.status==="OFFICIALLY_COMPLETED"&&
    wonderChallengeReview?.review==="VERIFIED_WONDER_RACE_RESULT"&&
    wonderChallengeReview?.winnerId===wonderVictory.winnerId&&
    text(wonderChallengeReview?.challengeId)?
    {gameId:stats.gameId,challengeId:wonderChallengeReview.challengeId,
      sourceHash:stats.sourceHash,sourceRevision:source.activeStatisticsRevision,
      resultRevision:canonicalResult.revision,status:"OFFICIALLY_COMPLETED",
      review:"VERIFIED_WONDER_RACE_RESULT",winnerId:wonderVictory.winnerId}:null;
  return {
    gameId:stats.gameId,battleId:stats.matchId,seasonId:match.seasonId,
    format:f,roster,winners:resultFinal?winners:[],
    outcomeType:resultFinal?canonicalResult.type:null,
    sourceState:ready?"CURRENT_READY":"PENDING_EVIDENCE",
    sourceRevision:stats.revision,resultRevision:source.activeResultRevision,
    resultState:resultFinal?"FINAL":"PENDING",
    acceptedAtMs:time(source.officialRecognitionAtMs)?source.officialRecognitionAtMs:null,
    patchModel:reviewedStart?opportunityReview.patchModel:null,
    startClass:reviewedStart?mapClass(opportunityReview.startClass):null,
    gameSpeed:reviewedStart?opportunityReview.gameSpeed:null,
    victoryRules:match.gameConfigSnapshot?.victory?.wonder===true?"WONDER":"CONQUEST",
    measurements,wonderVictory,wonderConstructions,wonderChallenge,
    adapterVersion:HONOURS_STATISTICS_ADAPTER_TEST_VERSION,
    sourceHash:ready?stats.sourceHash:null,
  };
}
