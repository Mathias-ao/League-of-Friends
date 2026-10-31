/**
 * AoF V1 honours - pure, TEST-ONLY reference evaluator.
 *
 * NOT IMPORTED BY PRODUCTION. No Firestore, entitlements, network, player
 * messages, Chronicle invitations or public-facing writes. Every normalized
 * game/evidence envelope MUST eventually come from an independently trusted,
 * source-current authenticated adapter, never from player-provided JSON.
 *
 * DRAFT gates are concrete calibration candidates, NOT owner-approved values.
 */
export const HONOURS_TEST_VERSION = "AOF_HONOURS_V1_TEST_2026_10_31";
export const DRAFT_TEST_RULES = Object.freeze({
  maturityDays: 7,
  maturityDistinctBattles: 5,
  maturityDistinctPlayers: 4,
  fastCastleMaximumMs: 15 * 60000 + 30000,
  wonderMaturityBattles: 3,
  wonderMaturityPlayers: 2,
  wonderMaximumDurationMs: 60 * 60000,
  unbrokenWins: 4,
  ffaGrades: Object.freeze([{wins: 7,grade:"IV"},{wins:4,grade:"III"},{wins:2,grade:"II"},{wins:1,grade:"I"}]),
  boomer: Object.freeze({byMs:30*60000,additionalTCSites:2,villagerQueueEstimate:75,
    uniqueHouseSites:10,expansionZoneClusters:3}),
  explorer: Object.freeze({byMs:30*60000,lowerBoundPercent:90,minimumConfidence:0.85}),
  gold: Object.freeze({byMs:30*60000,goldCommitment:2400,goldInfrastructureInfluencePercent:65}),
  aggression: Object.freeze({byMs:35*60000,qualifiedDirectedEpisodes:5,
    independentMilitaryEngagements:3,participationSharePercent:40}),
  defence: Object.freeze({byMs:35*60000,incomingThreatLevel:3,
    sourceQualifiedResponses:2}),
});
const positive = v => typeof v === "number" && Number.isFinite(v) && v >= 0;
const numeric = v => positive(v) ? v : null;
const validText = v => typeof v === "string" && v.length > 0;
const unique = rows => [...new Set(rows)];
const byId = rows => [...rows].sort((a,b)=>String(a).localeCompare(String(b)));
const status = (state,extra={}) => ({state,...extra});
const readyGame = g => g?.sourceState==="CURRENT_READY"&&validText(g.gameId)&&validText(g.battleId)&&
  validText(g.seasonId)&&Number.isInteger(g.sourceRevision)&&g.sourceRevision>=1 &&
  Number.isInteger(g.resultRevision)&&g.resultRevision>=1;
const finalGame = g => readyGame(g)&&g.resultState==="FINAL"&&
  ["PLAYER_WIN","TEAM_WIN","COALITION_WIN"].includes(g.outcomeType)&&
  Array.isArray(g.winners)&&Array.isArray(g.roster) &&
  g.winners.length>0&&g.winners.every(p=>g.roster.includes(p));
const eligibleStart = g => g.startClass==="STANDARD"&&
  g.gameSpeed==="NORMAL"&&g.patchModel==="DE_185872"&&
  ["1V1","TEAM"].includes(g.format);
const contains = (g,p) => Array.isArray(g.roster)&&g.roster.includes(p);
const isWin = (g,p) => finalGame(g)&&g.winners.includes(p);
const isLoss = (g,p) => finalGame(g)&&contains(g,p)&&!g.winners.includes(p);
const playerMeasure = (g,p,key) => g.measurements?.[p]?.[key]??null;

/** Detect conflicting duplicate POV/canonical Game envelopes; never select upload order. */
export function canonicalCurrentGames(games,seasonId) {
  if(!Array.isArray(games)||!validText(seasonId))throw new Error("Current Season and Game list required");
  const seen=new Map();
  for(const g of games) {
    if(!g||g.seasonId!==seasonId||!validText(g.gameId))continue;
    const old=seen.get(g.gameId);
    if(old&&JSON.stringify(old)!==JSON.stringify(g))
      throw new Error("Conflicting canonical Game/POV revisions require authoritative resolution");
    seen.set(g.gameId,g);
  }
  return [...seen.values()];
}
const admitted = (input) => canonicalCurrentGames(input.games??[],input.seasonId)
  .filter(g=>readyGame(g));
const qualifyingCohort = (g,kind) => readyGame(g)&&
  validText(g.startClass)&&g.gameSpeed==="NORMAL"&&
  g.patchModel==="DE_185872"&&
  (kind==="WONDER" ? g.victoryRules==="WONDER"&&g.startClass==="STANDARD" :
    eligibleStart(g));

function matureAt(input,games,kind,rules) {
  const minDays=rules.maturityDays*86400000;
  if(!positive(input.seasonStartedAtMs)||!positive(input.nowMs))return null;
  const minimumBattles=kind==="WONDER"?rules.wonderMaturityBattles:rules.maturityDistinctBattles;
  const minimumPlayers=kind==="WONDER"?rules.wonderMaturityPlayers:rules.maturityDistinctPlayers;
  const ordered=games.filter(g=>qualifyingCohort(g,kind)&&finalGame(g)&&positive(g.acceptedAtMs))
    .sort((a,b)=>a.acceptedAtMs-b.acceptedAtMs||a.gameId.localeCompare(b.gameId));
  const battles=new Set(),players=new Set();
  let sampleAt=null;
  for(const g of ordered){
    battles.add(g.battleId);
    for(const p of g.roster)players.add(p);
    if(battles.size>=minimumBattles&&players.size>=minimumPlayers){sampleAt=g.acceptedAtMs;break}
  }
  if(sampleAt==null)return null;
  const maturity=Math.max(input.seasonStartedAtMs+minDays,sampleAt);
  return maturity<=input.nowMs?maturity:null;
}
function castleCandidate(g,p) {
  const m=playerMeasure(g,p,"fastCastle");
  if(!m||m.model!=="AOF_OPENING_STATISTICS_V6"||m.sourceQualified!==true||
    !positive(m.projectedCastleAgeMs)||!eligibleStart(g))return null;
  return {playerId:p,gameId:g.gameId,battleId:g.battleId,
    atMs:g.acceptedAtMs,valueMs:m.projectedCastleAgeMs,model:m.model};
}
function wonderCandidate(g,p) {
  const w=g.wonderVictory;
  if(!finalGame(g)||!qualifyingCohort(g,"WONDER")||!isWin(g,p)||
    !w||w.method!=="WONDER_VICTORY"||w.verifiedBy!=="OFFICIAL_METHOD_REVIEW"||
    w.resultRevision!==g.resultRevision||w.winnerId!==p||
    w.completeTimerWitness!==true||!positive(w.gameEndAtMs))return null;
  return {playerId:p,gameId:g.gameId,battleId:g.battleId,atMs:g.acceptedAtMs,
    valueMs:w.gameEndAtMs,model:"OFFICIALLY_VERIFIED_WONDER_VICTORY"};
}

/** Rebuild from *current source* and accepted chronology; invalid past possession
 * disappears from the valid succession. Audit of corrections stays separate. */
export function projectCompetitiveTrophy(input,kind,rules=DRAFT_TEST_RULES) {
  if(!["FAST_CASTLE","WONDER"].includes(kind))throw new Error("Unknown trophy");
  const games=admitted(input);
  const candidates=[];
  for(const g of games)for(const p of g.roster??[]) {
    const c=kind==="FAST_CASTLE"?castleCandidate(g,p):wonderCandidate(g,p);
    if(c&&positive(c.atMs))candidates.push(c);
  }
  candidates.sort((a,b)=>a.atMs-b.atMs||a.gameId.localeCompare(b.gameId)||a.playerId.localeCompare(b.playerId));
  const bestValue=candidates.length?Math.min(...candidates.map(c=>c.valueMs)):null;
  const recordHolders=bestValue==null?[]:byId(unique(candidates.filter(c=>c.valueMs===bestValue).map(c=>c.playerId)));
  const mature=matureAt(input,games,kind,rules);
  const base={honour:kind,recordHolders,recordValueMs:bestValue,holder:null,
    history:[],matureAtMs:mature,scope:"CURRENT_SEASON_STANDARD_START",testOnly:true};
  if(!candidates.length)return status("PENDING_EVIDENCE",base);
  if(mature==null)return status("PROVISIONAL_RECORD",base);
  const maximum=kind==="FAST_CASTLE"?rules.fastCastleMaximumMs:rules.wonderMaximumDurationMs;
  const qualify=c=>c.valueMs<=maximum;
  const qualified=candidates.filter(qualify);
  if(!qualified.length)return status("UNCLAIMED_PERFORMANCE",base);
  // Replay authoritative acceptance in recognition order. At maturity, valid
  // earlier results compete, but they never gain backdated trophy possession.
  const events=qualified.map(c=>({...c,effectiveAtMs:Math.max(c.atMs,mature)}))
    .filter(c=>c.effectiveAtMs<=input.nowMs)
    .sort((a,b)=>a.effectiveAtMs-b.effectiveAtMs||
      a.atMs-b.atMs||a.gameId.localeCompare(b.gameId));
  let incumbent=null,lowest=null,started=null,tiePending=false;
  const history=[];
  let ix=0;
  while(ix<events.length) {
    const when=events[ix].effectiveAtMs;
    const batch=[];
    while(ix<events.length&&events[ix].effectiveAtMs===when)batch.push(events[ix++]);
    const best=Math.min(...batch.map(c=>c.valueMs));
    const bestPlayers=byId(unique(batch.filter(c=>c.valueMs===best).map(c=>c.playerId)));
    if(lowest==null||best<lowest) {
      if(incumbent!==null&&started!==null)history[history.length-1].toMs=when;
      incumbent=bestPlayers.length===1?bestPlayers[0]:null;
      started=incumbent!==null?when:null;
      lowest=best;
      tiePending=bestPlayers.length>1;
      if(incumbent!==null)
        history.push({playerId:incumbent,fromMs:when,toMs:null,valueMs:best,
          sourceGameId:batch.find(c=>c.playerId===incumbent&&c.valueMs===best).gameId});
    } else if(best===lowest&&incumbent===null)tiePending=true;
  }
  return status(incumbent?"CURRENT_HOLDER":tiePending?"PENDING_TIE_POLICY":"UNCLAIMED_PERFORMANCE",
    {...base,holder:incumbent,history,tiedRecord:recordHolders.length>1});
}

/** A source-final Game, not a match result or a replay filename, is the unit. */
export function evaluateUnbroken(input,playerId,rules=DRAFT_TEST_RULES) {
  const games=canonicalCurrentGames(input.games??[],input.seasonId)
    .filter(g=>contains(g,playerId)&&g.format!=="FFA");
  if(games.some(g=>isLoss(g,playerId)))
    return status("INACTIVE_LOST",{wins:games.filter(g=>isWin(g,playerId)).length,
      active:false,seasonId:input.seasonId});
  if(games.some(g=>!finalGame(g)))
    return status("PENDING_OFFICIAL_RESULTS",{active:false});
  const wins=games.filter(g=>isWin(g,playerId)).length;
  return status(wins>=rules.unbrokenWins?"ACTIVE":"NOT_YET_QUALIFIED",
    {active:wins>=rules.unbrokenWins,wins,requiredWins:rules.unbrokenWins,seasonId:input.seasonId});
}
export function evaluateThreeSchools(input,playerId) {
  const codes=new Set((input.eliteQualifications??[]).filter(x=>x.playerId===playerId&&
    x.sourceCurrent===true&&x.tier==="ELITE"&&x.qualified===true).map(x=>x.code));
  const earned=codes.has("DISCIPLINED_DRUSH_WITH_FLUSH")&&
    (codes.has("SCOUT_RUSH")||codes.has("ARCHER_RUSH"))&&codes.has("FAST_CASTLE_BOOM");
  return status(earned?"QUALIFIED":"PENDING_ELITE_QUALIFICATION",
    {active:earned,missing:[
      ...(!codes.has("DISCIPLINED_DRUSH_WITH_FLUSH")?["DISCIPLINED_DRUSH_WITH_FLUSH"]:[]),
      ...(!codes.has("SCOUT_RUSH")&&!codes.has("ARCHER_RUSH")?["SCOUT_OR_ARCHER"]:[]),
      ...(!codes.has("FAST_CASTLE_BOOM")?["FAST_CASTLE_BOOM"]:[])
    ]});
}
export function evaluateFFASoleWinner(input,playerId,rules=DRAFT_TEST_RULES) {
  const wins=admitted(input).filter(g=>g.format==="FFA"&&finalGame(g)&&
    g.outcomeType==="PLAYER_WIN"&&g.winners.length===1&&g.winners[0]===playerId);
  const distinctBattles=unique(wins.map(g=>g.battleId)).length;
  const grade=rules.ffaGrades.find(t=>distinctBattles>=t.wins)?.grade??null;
  return status(grade?"QUALIFIED":"NOT_YET_QUALIFIED",{
    grade,distinctBattles,sourceGameIds:wins.map(g=>g.gameId).sort(),
    claim:"SOLE_OFFICIAL_FFA_WINNER_NOT_UNAIDED"});
}

function sourceComposite(input,playerId,key,rules,qualify) {
  let pending=false;
  for(const g of admitted(input)) {
    if(!contains(g,playerId))continue;
    const evidence=playerMeasure(g,playerId,key);
    if(!evidence)continue;
    if(evidence.sourceQualified!==true||evidence.modelState!=="SOURCE_VALIDATED"||
      !positive(evidence.windowMs)) {pending=true;continue}
    if(qualify(evidence,rules,g))
      return status("QUALIFIED",{gameId:g.gameId,battleId:g.battleId,
        evidenceModel:evidence.modelVersion??null});
  }
  return status(pending?"PENDING_EVIDENCE":"NOT_YET_QUALIFIED");
}
export function evaluateBoomer(input,playerId,rules=DRAFT_TEST_RULES) {
  return sourceComposite(input,playerId,"boomer",rules.boomer,(e,r,g)=>
    eligibleStart(g)&&!["Huns"].includes(e.civilization)&&
    e.windowMs===r.byMs&&
    numeric(e.additionalTCSites)>=r.additionalTCSites&&
    numeric(e.villagerQueueEstimate)>=r.villagerQueueEstimate&&
    numeric(e.uniqueHouseSites)>=r.uniqueHouseSites&&
    numeric(e.expansionZoneClusters)>=r.expansionZoneClusters&&
    e.distinctSitesVerified===true&&e.sourceClockComplete===true);
}
export function evaluateExplorer(input,playerId,rules=DRAFT_TEST_RULES) {
  return sourceComposite(input,playerId,"explorer",rules.explorer,(e,r)=>
    e.modelVersion==="AOF_ESTIMATED_EXPLORATION_V1"&&
    e.modelValidatedAgainstFog===true&&e.sourceClockComplete===true&&
    e.windowMs===r.byMs&&
    numeric(e.coverageLowerBoundPercent)>=r.lowerBoundPercent&&
    numeric(e.confidence)>=r.minimumConfidence);
}
export function evaluateGold(input,playerId,rules=DRAFT_TEST_RULES) {
  return sourceComposite(input,playerId,"gold",rules.gold,(e,r,g)=>
    eligibleStart(g)&&e.windowMs===r.byMs&&
    numeric(e.goldDenominatedQueueCommitment)>=r.goldCommitment&&
    numeric(e.goldInfrastructureInfluencePercent)>=r.goldInfrastructureInfluencePercent&&
    e.goldOpportunitiesComparable===true&&e.sourceClockComplete===true);
}
function acknowledge(input,evidence,allowedRespondents,kind) {
  const rows=(input.chroniclePerspectives??[]).filter(x=>
    x.kind===kind&&x.battleId===evidence.battleId&&
    x.gameId===evidence.gameId&&x.episodeId===evidence.episodeId&&
    allowedRespondents.includes(x.respondentPlayerId)&&
    x.sourceRevision===evidence.sourceRevision&&
    x.visibility==="AUTHOR_ONLY"&&x.verifiedRespondent===true&&
    x.state==="SUBMITTED"&&x.choice==="ACKNOWLEDGED");
  return rows.length>0;
}
const invitation=(kind,e,respondents)=>{
  const question=kind==="AGGRESSION"?
    "Did this opponent's sustained military pressure meaningfully affect your decisions in this Battle?" :
    "Did the defensive intervention or resistance meaningfully affect your experience of this Battle?";
  return byId(unique(respondents)).filter(validText).map(respondentPlayerId=>({
    kind,respondentPlayerId,battleId:e.battleId,gameId:e.gameId,
    episodeId:e.episodeId,sourceRevision:e.sourceRevision,question,
    choices:["ACKNOWLEDGED","NOT_PERSONALLY_MEANINGFUL","UNSURE","DECLINE"],
    visibility:"AUTHOR_ONLY",testOnly:true,offered:false,grantEffect:false,
  }));
};
function assessPerspectiveHonour(input,playerId,key,kind,rules,check){
  let outstanding=[],sawQualifiedSource=false;
  for(const g of admitted(input)) {
    const evidence=playerMeasure(g,playerId,key);
    if(!evidence||!contains(g,playerId))continue;
    if(evidence.sourceQualified!==true||evidence.modelState!=="SOURCE_VALIDATED"||
       !validText(evidence.episodeId)||!validText(evidence.sourceRevision)||
       evidence.gameId!==g.gameId||evidence.battleId!==g.battleId ||
       !check(evidence,rules,g))continue;
    sawQualifiedSource=true;
    const respondents=kind==="AGGRESSION"?
      (evidence.opponentIds??[]):
      (evidence.witnessIds??[]);
    const safe=byId(unique(respondents.filter(id=>validText(id)&&id!==playerId&&contains(g,id))));
    if(acknowledge(input,evidence,safe,kind))
      return status("QUALIFIED",{battleId:g.battleId,gameId:g.gameId,
        verifiedPerspectiveCount:1,claim:"SOURCE_QUALIFIED_CONDUCT_WITH_PRIVATE_EXPERIENCE"});
    outstanding.push(...invitation(kind,evidence,safe));
  }
  return status(sawQualifiedSource?"PENDING_CHRONICLE":"PENDING_EVIDENCE",{
    invitationCandidates:outstanding.slice(0,4), // not sent; real #165 policy controls frequency
    note:"Not an invitation offer, not evidence of executed effects, no public subjective testimony"});
}
export function evaluateAggression(input,playerId,rules=DRAFT_TEST_RULES) {
  return assessPerspectiveHonour(input,playerId,"aggression","AGGRESSION",rules.aggression,(e,r)=>
    e.windowMs===r.byMs&&e.sourceClockComplete===true&&
    numeric(e.directedPressureEpisodes)>=r.qualifiedDirectedEpisodes&&
    numeric(e.engagementEpisodes)>=r.independentMilitaryEngagements&&
    numeric(e.battleParticipationSharePercent)>=r.participationSharePercent);
}
export function evaluateDefensive(input,playerId,rules=DRAFT_TEST_RULES) {
  return assessPerspectiveHonour(input,playerId,"defensive","DEFENCE",rules.defence,(e,r)=>
    e.windowMs===r.byMs&&e.sourceClockComplete===true&&
    numeric(e.incomingThreatLevel)>=r.incomingThreatLevel&&
    numeric(e.qualifiedResponseOrders)>=r.sourceQualifiedResponses&&
    e.directionVerified===true);
}
export function projectTenHonours(input,playerId,rules=DRAFT_TEST_RULES) {
  if(!validText(playerId)||!validText(input?.seasonId))throw new Error("Player and Season required");
  const fastCastle=projectCompetitiveTrophy(input,"FAST_CASTLE",rules);
  const wonder=projectCompetitiveTrophy(input,"WONDER",rules);
  const unbroken=evaluateUnbroken(input,playerId,rules);
  const master=evaluateThreeSchools(input,playerId);
  const solo=evaluateFFASoleWinner(input,playerId,rules);
  const boomer=evaluateBoomer(input,playerId,rules);
  const explorer=evaluateExplorer(input,playerId,rules);
  const gold=evaluateGold(input,playerId,rules);
  const aggression=evaluateAggression(input,playerId,rules);
  const defensive=evaluateDefensive(input,playerId,rules);
  return {
    schemaVersion:HONOURS_TEST_VERSION,
    testOnly:true,playerId,seasonId:input.seasonId,
    trophies:{FAST_CASTLE:fastCastle,WONDER:wonder},
    epithets:{UNBROKEN:unbroken,THREE_SCHOOLS:master},
    distinctions:{FFA_SOLO_WIN:solo,BOOMER:boomer,EXPLORER:explorer,
      GOLD:gold,AGGRESSION:aggression,DEFENSIVE:defensive},
    anyGrantWritten:false,
  };
}
