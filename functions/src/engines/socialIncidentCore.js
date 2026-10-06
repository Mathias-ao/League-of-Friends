/** Portable, deterministic social interpreter. Never mutates statistics or writes awards. */
export const SOCIAL_INCIDENT_VERSION = 'AOF_SOCIAL_INCIDENTS_V1';
export const SOCIAL_SHADOW_RULES = Object.freeze({
  ruleVersion: 'AOF_SOCIAL_SHADOW_RULES_V1', immediateMs: 10000, associationMs: 60000,
  contestedMs: 5000, trackBudget: 1, maximumStage: 4,
  acceptedQualifierVersions: Object.freeze([]), enabled: true,
});
const rec = v => v && typeof v === 'object' && !Array.isArray(v) ? v : null;
const rows = v => Array.isArray(v) ? v : [];
const integer = v => Number.isSafeInteger(v) && v >= 0;
const text = v => typeof v === 'string' && v.length > 0;
const stable = v => Array.isArray(v) ? v.map(stable) : rec(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const json = v => JSON.stringify(stable(v));
const key = (a,b) => JSON.stringify([Math.min(a,b),Math.max(a,b)]);
const moment = e => e.moment ?? {atMs:e.atMs,operationOrdinal:e.operationOrdinal};
const compare = (a,b) => a.atMs-b.atMs || a.operationOrdinal-b.operationOrdinal;
const refs = v => [...new Set(rows(v))].sort();
const identity = (...parts) => JSON.stringify(parts);
const stateName = {0:'ALLY',1:'NEUTRAL',3:'ENEMY'};
const unavailable = reason => ({modelVersion:SOCIAL_INCIDENT_VERSION,status:'UNAVAILABLE',reason,
  chronicle:[],incidents:[],decisions:[],deeds:[],exposure:[],shadowContributions:[],
  policy:{productionScoringEnabled:false,engineStateEstablished:false}});

function validateRules(input) {
  const rule = {...SOCIAL_SHADOW_RULES,...input};
  if (!text(rule.ruleVersion) || !integer(rule.immediateMs) || !integer(rule.associationMs) ||
      rule.associationMs<rule.immediateMs || !integer(rule.contestedMs) ||
      !integer(rule.trackBudget) || rule.trackBudget<1 || !integer(rule.maximumStage) ||
      rule.maximumStage<3 || typeof rule.enabled!=='boolean' ||
      !Array.isArray(rule.acceptedQualifierVersions) || rule.acceptedQualifierVersions.some(v=>!text(v)))
    throw Error('invalid_social_rule_configuration');
  return rule;
}

/** Input qualifiedFacts is trusted qualifier output, never client-entered adjudication.
 * Its versions must be explicitly admitted by the server rule registry (empty by default).
 */
export function projectSocialIncidents({statistics, playerMapping=[], officialOutcome=null,
    context={}, qualifiedFacts=[], rules={}}={}) {
  try {
    const rule=validateRules(rules), stats=rec(statistics), facts=rec(stats?.matchFacts);
    if (!facts || facts.modelVersion!=='AOF_RECORDING_MATCH_FACTS_V1' ||
        facts.identityNamespace!=='CANONICAL_REPLAY_PLAYER_ID') return unavailable('recording_facts_missing');
    const source=rec(stats.source), factSource=rec(facts.source), duration=facts.game?.observedDurationMs;
    if (!source || !text(source.replaySha256) || !text(source.canonicalManifestSha256) ||
        !factSource || ['replaySha256','canonicalManifestSha256'].some(k=>source[k]!==factSource[k]) ||
        !integer(duration)) throw Error('social_source_or_interval_invalid');
    const players=rows(facts.players);
    if (players.length<2 || players.length>8 || players.some(p=>!rec(p)||!integer(p.playerId)||p.playerId<1||p.playerId>8) ||
        new Set(players.map(p=>p.playerId)).size!==players.length) throw Error('social_roster_invalid');
    const roster=new Set(players.map(p=>p.playerId)), validPair=(a,b)=>roster.has(a)&&roster.has(b)&&a!==b;
    const provenance={...source}, gameIdentity=text(context.gameId)?context.gameId:source.replaySha256;
    const battleId=text(context.battleId)?context.battleId:gameIdentity;
    const mapped=new Map(), mappedIds=new Set();
    for (const m of rows(playerMapping)) {
      const p=players.find(p=>(p.replaySlot??p.playerId)===m.replaySlot);
      if (!p || !text(m.playerId) || mapped.has(p.playerId) || mappedIds.has(m.playerId)) throw Error('social_identity_mapping_invalid');
      if (m.participantType && !['HUMAN','AI','GUEST'].includes(m.participantType)) throw Error('social_participant_type_invalid');
      mapped.set(p.playerId,m);mappedIds.add(m.playerId);
    }
    const participantName=id => {
      const m=mapped.get(id);return m?.sourceName || rows(stats.participants).find(p=>p.playerId===id)?.displayName || `Recording player ${id}`;
    };
    const human=id => !!mapped.get(id) && mapped.get(id).participantType!=='AI' && mapped.get(id).participantType!=='GUEST';
    const lock=facts.rules?.lockTeams?.value;
    const evidence=new Map(), chronicle=[], incidents=[], decisions=[], deeds=[];
    function addEvidence(e) {
      if (!text(e.sourceEventId)||!integer(e.moment?.atMs)||!integer(e.moment?.operationOrdinal)||e.moment.atMs>duration||
          !roster.has(e.actorPlayerId)) throw Error('social_evidence_chronology_invalid');
      const prior=evidence.get(e.sourceEventId);
      if (prior && json(prior)!==json(e)) throw Error('conflicting_social_source_reference');
      evidence.set(e.sourceEventId,e);
    }
    function addBeat(kind,at,actor,target,sourceRefs,detail={}) {
      chronicle.push({id:identity(gameIdentity,kind,actor,target,sourceRefs),kind,moment:at,
        actorPlayerId:actor,targetPlayerId:target,sourceEventIds:refs(sourceRefs),...detail});
    }
    function decide(family,pair,anchor,status,reasons,detail={}) {
      const d={decisionId:identity(gameIdentity,family,pair,anchor),family,pairPlayerIds:pair,
        sourceEventIds:refs(anchor),status,reasons,...detail};decisions.push(d);return d;
    }
    function deed(family,track,actor,other,at,sourceRefs,anchor,scope,detail={}) {
      if (!validPair(actor,other)||!sourceRefs.length||sourceRefs.some(r=>!evidence.has(r))) throw Error('social_deed_provenance_invalid');
      const id=identity(gameIdentity,family,actor,other,anchor);
      if (deeds.some(d=>d.deedId===id)) return;
      deeds.push({deedId:id,lineageId:id,family,track,actorPlayerId:actor,counterpartPlayerId:other,
        actorLeagueId:human(actor)?mapped.get(actor).playerId:null,
        counterpartLeagueId:human(other)?mapped.get(other).playerId:null,
        moment:at,battleId,gameIdentity,sourceEventIds:refs(sourceRefs),scope,severity:1,
        ruleVersion:rule.ruleVersion,...detail});
    }
    const commands=new Map();
    const timelines=rec(facts.diplomacy?.commandTimelines);
    if (!timelines) throw Error('social_diplomacy_contract_missing');
    for (const [direction,values] of Object.entries(timelines)) {
      if (!Array.isArray(values)) throw Error('social_diplomacy_rows_invalid');
      for (const r of values) {
        if (!rec(r)||direction!==`${r.replaySlot}->${r.targetReplaySlot}`||!validPair(r.replaySlot,r.targetReplaySlot)) throw Error('social_diplomacy_direction_invalid');
        const c={sourceEventId:r.sourceEventId,actorPlayerId:r.replaySlot,targetPlayerId:r.targetReplaySlot,
          moment:moment(r),mode:r.diplomacyMode,commandId:r.commandId};
        addEvidence({sourceEventId:c.sourceEventId,actorPlayerId:c.actorPlayerId,moment:c.moment,commandType:'GAME'});
        const prior=commands.get(c.sourceEventId);
        if (prior&&json(prior)!==json(c)) throw Error('conflicting_diplomacy_source_reference');
        commands.set(c.sourceEventId,c);
      }
    }
    const states=new Map(), last=new Map(), directedHistory=new Map(), truceStarts=new Map();
    const state=(a,b)=>states.get(`${a}->${b}`)??'UNKNOWN';
    for (const c of [...commands.values()].sort((a,b)=>compare(a.moment,b.moment)||a.sourceEventId.localeCompare(b.sourceEventId))) {
      const a=c.actorPlayerId,b=c.targetPlayerId,k=`${a}->${b}`,prior=state(a,b),opposite=state(b,a);
      const next=c.commandId===0&&Number.isSafeInteger(c.mode)?(stateName[c.mode]??'UNKNOWN'):'UNKNOWN';
      if (!directedHistory.has(k)) directedHistory.set(k,[]);
      directedHistory.get(k).push({moment:c.moment,stance:next,ref:c.sourceEventId});
      if (next===prior) continue;
      const beforeRefs=[last.get(k),last.get(`${b}->${a}`)].filter(Boolean);
      states.set(k,next);last.set(k,c.sourceEventId);
      if (next==='UNKNOWN') {addBeat('DECLARATION_KNOWLEDGE_INTERRUPTED',c.moment,a,b,[c.sourceEventId]);continue;}
      addBeat(prior==='ALLY'&&next!=='ALLY'?'ALLY_DECLARATION_WITHDRAWN':'DECLARATION_ESTABLISHED',
        c.moment,a,b,[c.sourceEventId],{previousDeclaration:prior,declaration:next});
      if (next==='ALLY'&&opposite==='ALLY') {truceStarts.set(key(a,b),c.moment);addBeat('RECIPROCAL_ALLY_DECLARATIONS',c.moment,a,b,[...beforeRefs,c.sourceEventId]);}
      if (prior==='ALLY'&&next!=='ALLY') {
        const previous=incidents.filter(i=>key(i.actorPlayerId,i.targetPlayerId)===key(a,b)&&i.actorPlayerId===b&&compare(i.moment,truceStarts.get(key(a,b))??{atMs:0,operationOrdinal:0})>=0).at(-1);
        const role=opposite==='ALLY'?'INITIATING_DECLARATION_BREACH':previous&&opposite!=='UNKNOWN'
          ?'RESPONSE_AFTER_WITHDRAWAL':'WITHDRAWAL_WITH_UNRESOLVED_CONTEXT';
        incidents.push({incidentId:identity(gameIdentity,'withdrawal',c.sourceEventId),anchorEventId:c.sourceEventId,
          pairPlayerIds:[a,b].sort((a,b)=>a-b),actorPlayerId:a,targetPlayerId:b,moment:c.moment,
          priorDeclaration:prior,counterpartDeclaration:opposite,declarationAfter:next,
          reciprocalBefore:opposite==='ALLY',role,responseTo:role==='RESPONSE_AFTER_WITHDRAWAL'?previous.incidentId:null,
          sourceEventIds:refs([...beforeRefs,c.sourceEventId]),targetedOrderCandidates:[],qualifiedOffenses:[]});
      }
    }
    const stanceAt=(a,b,at)=>{
      let s='UNKNOWN';for (const h of directedHistory.get(`${a}->${b}`)??[]) {if(compare(h.moment,at)>0) break;s=h.stance;}return s;
    };
    // Lookahead is an explicit aftermath classification, never a backfilled prior stance.
    for (const i of incidents) if (i.role==='INITIATING_DECLARATION_BREACH') {
      const reply=incidents.find(j=>j.responseTo===i.incidentId && j.moment.atMs-i.moment.atMs<=rule.contestedMs);
      if(reply){i.role='CONTESTED_WITHDRAWAL';reply.role='CONTESTED_WITHDRAWAL';}
    }
    const ledger=rec(stats.pairSocialEvidence), supportedLedger=ledger?.modelVersion==='AOF_PAIR_SOCIAL_EVIDENCE_V1';
    if (supportedLedger) {
      if (['replaySha256','canonicalManifestSha256'].some(k=>ledger.gameScope?.[k]!==source[k])) throw Error('social_ledger_source_mismatch');
      for (const o of rows(ledger.observations)) addEvidence(o);
    }
    const allTargeted=[];
    for (const raw of supportedLedger?rows(ledger.incidents):[]) {
      const pair=rows(raw.pairPlayerIds);
      if (pair.length!==2||!validPair(...pair)||raw.chronologyCoverage!=='QUALIFIED') continue;
      const sourceRefs=refs(raw.sourceEventIds);
      if (!sourceRefs.length||sourceRefs.some(r=>!evidence.has(r)) || !integer(raw.startedAt?.atMs)||!integer(raw.startedAt?.operationOrdinal)) continue;
      const actualStart=sourceRefs.map(r=>evidence.get(r).moment).sort(compare)[0];
      if(compare(raw.startedAt,actualStart)!==0){decide(raw.family,pair,sourceRefs,'UNAVAILABLE',['source_bounds_mismatch']);continue;}
      if (raw.sourceModelVersion==='AOF_SKIRMISH_PAIR_EVIDENCE_V2') {
        for (const f of rows(raw.facets)) if (f.kind==='TARGETED_COMMAND'&&validPair(f.fromPlayerId,f.toPlayerId)&&key(f.fromPlayerId,f.toPlayerId)===key(...pair)) {
          for (const ref of refs(f.sourceEventIds)) {
            const e=evidence.get(ref);
            if (!e||e.actorPlayerId!==f.fromPlayerId) continue;
            const candidate={sourceEventId:ref,actorPlayerId:f.fromPlayerId,targetPlayerId:f.toPlayerId,
              moment:e.moment,semantics:'TARGETED_CONTEXT_ORDER_NOT_VERIFIED_ATTACK'};
            if(!allTargeted.some(x=>json(x)===json(candidate))) allTargeted.push(candidate);
          }
        }
      }
      if (lock!==true||raw.relationContext!=='FIXED_ALLIES'||raw.sourceModelVersion!=='AOF_ENGAGEMENT_STATISTICS_V4') continue;
      for (const f of rows(raw.facets)) {
        if (['DEFENSIVE_PARTICIPATION','REINFORCEMENT_COMMANDS'].includes(f.kind)) {
          const a=f.fromPlayerId,b=f.toPlayerId, r=refs(f.sourceEventIds);
          if (!validPair(a,b)||key(a,b)!==key(...pair)||!r.length||r.some(x=>evidence.get(x)?.actorPlayerId!==a)) continue;
          decide('PROTECTIVE_PARTICIPATION',pair,r,'MATCHED',[],{scope:'INFERRED_SUPPORT_COMMAND_PARTICIPATION'});
          addBeat('SUPPORT_PARTICIPATION',raw.startedAt,a,b,r,{scope:'INFERRED_SUPPORT_COMMAND_PARTICIPATION'});
          deed('PROTECTIVE_PARTICIPATION','BOND',a,b,raw.startedAt,r,raw.incidentId,'INFERRED_SUPPORT_COMMAND_PARTICIPATION');
          // Chivalry's substantive-assistance qualifier is separate from a support annotation.
          decide('CHIVALROUS_PROTECTION',pair,r,'UNAVAILABLE',['assistance_materiality_unqualified']);
        } else if (f.kind==='SHARED_OPPONENT_PARTICIPATION') {
          const c=rows(f.contributions);
          if(c.length!==2||new Set(c.map(x=>x.contributorPlayerId)).size!==2||!roster.has(f.targetPlayerId)||pair.includes(f.targetPlayerId)) continue;
          if(c.some(x=>!pair.includes(x.contributorPlayerId)||!refs(x.sourceEventIds).length||refs(x.sourceEventIds).some(r=>evidence.get(r)?.actorPlayerId!==x.contributorPlayerId))) continue;
          decide('SHARED_PARTICIPATION',pair,sourceRefs,'MATCHED',[],{scope:'INFERRED_COMMON_TARGET_PARTICIPATION'});
          for(const x of c) deed('SHARED_PARTICIPATION','BOND',x.contributorPlayerId,pair.find(id=>id!==x.contributorPlayerId),raw.startedAt,
            refs(x.sourceEventIds),raw.incidentId,'INFERRED_COMMON_TARGET_PARTICIPATION');
          addBeat('SHARED_PARTICIPATION',raw.startedAt,pair[0],pair[1],sourceRefs,{opponentPlayerId:f.targetPlayerId});
        }
      }
    }
    // Default registry admits no new attack or tribute semantic qualifiers.
    const qualified=[];
    for (const f of rows(qualifiedFacts)) {
      if(!rule.acceptedQualifierVersions.includes(f?.qualifierVersion)) continue;
      if(!rec(f)||!['OFFENSIVE_ATTEMPT','MATERIAL_AID_ORDER','QUALIFIED_KING_LOSS_TREACHERY'].includes(f.kind)||f.qualification!=='QUALIFIED'||
          !validPair(f.actorPlayerId,f.targetPlayerId)||!text(f.factId)||!refs(f.sourceEventIds).length||
          !integer(f.moment?.atMs)||!integer(f.moment?.operationOrdinal)||f.moment.atMs>duration||
          refs(f.sourceEventIds).some(r=>!evidence.has(r)||evidence.get(r).actorPlayerId!==f.actorPlayerId)||
          !refs(f.sourceEventIds).some(r=>compare(evidence.get(r).moment,f.moment)===0)||
          f.source?.replaySha256!==source.replaySha256||f.source?.canonicalManifestSha256!==source.canonicalManifestSha256)
        throw Error('qualified_social_fact_invalid');
      const prior=qualified.find(x=>x.factId===f.factId);
      if(prior&&json(prior)!==json(f))throw Error('conflicting_qualified_social_fact');
      if(f.kind==='OFFENSIVE_ATTEMPT'&&f.targetAttribution!=='QUALIFIED')throw Error('offensive_target_attribution_unqualified');
      if(f.kind==='MATERIAL_AID_ORDER'&&(!rec(f.resourceAmounts)||Object.keys(f.resourceAmounts).some(k=>!['food','wood','gold','stone'].includes(k))||
          Object.values(f.resourceAmounts).some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0)||!Object.values(f.resourceAmounts).some(v=>v>0)))throw Error('aid_resource_vector_invalid');
      if(!prior)qualified.push(f);
    }
    for (const f of qualified.filter(f=>f.kind==='MATERIAL_AID_ORDER')) {
      if(f.materiality!=='QUALIFIED'||f.delivered===true) continue;
      const relation=lock===true?players.find(p=>p.playerId===f.actorPlayerId).lobbyTeamIdRaw>1 &&
        players.find(p=>p.playerId===f.actorPlayerId).lobbyTeamIdRaw===players.find(p=>p.playerId===f.targetPlayerId).lobbyTeamIdRaw
        :stanceAt(f.actorPlayerId,f.targetPlayerId,f.moment)==='ALLY'&&stanceAt(f.targetPlayerId,f.actorPlayerId,f.moment)==='ALLY';
      if(!relation)continue;
      decide('MATERIAL_ASSISTANCE',[f.actorPlayerId,f.targetPlayerId].sort((a,b)=>a-b),f.sourceEventIds,'MATCHED',[]);
      for(const track of ['BOND','CHIVALRY']) deed('MATERIAL_ASSISTANCE',track,f.actorPlayerId,f.targetPlayerId,f.moment,f.sourceEventIds,
        f.factId,'QUALIFIED_AID_INSTRUCTION');
      addBeat('MATERIAL_AID_ORDER',f.moment,f.actorPlayerId,f.targetPlayerId,f.sourceEventIds,{resourceAmounts:f.resourceAmounts??null});
    }
    for(const i of incidents) {
      const linked=c=>c.actorPlayerId===i.actorPlayerId&&c.targetPlayerId===i.targetPlayerId&&
        compare(c.moment,i.moment)>=0&&c.moment.atMs-i.moment.atMs<=rule.associationMs;
      const uninterrupted=c=>{for(const [a,b] of [[i.actorPlayerId,i.targetPlayerId],[i.targetPlayerId,i.actorPlayerId]]){
        if((directedHistory.get(`${a}->${b}`)??[]).some(h=>compare(h.moment,i.moment)>0&&compare(h.moment,c.moment)<=0&&
            (h.stance==='UNKNOWN'||a===i.actorPlayerId&&h.stance==='ALLY')))return false;}return true;};
      i.targetedOrderCandidates=allTargeted.filter(c=>linked(c)&&uninterrupted(c)).sort((a,b)=>compare(a.moment,b.moment));
      i.qualifiedOffenses=qualified.filter(f=>f.kind==='OFFENSIVE_ATTEMPT'&&linked(f)&&uninterrupted(f));
      const association=f=>f.moment.atMs-i.moment.atMs<=rule.immediateMs?'IMMEDIATE':'DELAYED';
      for(const f of i.qualifiedOffenses)addBeat('OFFENSIVE_ATTEMPT_AFTER_WITHDRAWAL',f.moment,i.actorPlayerId,i.targetPlayerId,
        f.sourceEventIds,{association:association(f),targetFunction:f.targetFunction??'UNKNOWN',withdrawalEventId:i.anchorEventId});
      const a=i.actorPlayerId,b=i.targetPlayerId;
      if(lock===true) {decide('DECLARED_BREACH_OFFENSIVE_ATTEMPT',i.pairPlayerIds,i.sourceEventIds,'NOT_APPLICABLE',['diplomacy_locked']);continue;}
      if(i.role!=='INITIATING_DECLARATION_BREACH') {
        decide('DECLARED_BREACH_OFFENSIVE_ATTEMPT',i.pairPlayerIds,i.sourceEventIds,
          i.role==='RESPONSE_AFTER_WITHDRAWAL'?'NOT_MET':'UNAVAILABLE',[i.role.toLowerCase()]);
        decide('TRUST_BREAK_ECONOMIC_STRIKE',i.pairPlayerIds,i.sourceEventIds,
          i.role==='RESPONSE_AFTER_WITHDRAWAL'?'NOT_MET':'UNAVAILABLE',[i.role.toLowerCase()]);continue;
      }
      if(!i.qualifiedOffenses.length) {
        decide('DECLARED_BREACH_OFFENSIVE_ATTEMPT',i.pairPlayerIds,i.sourceEventIds,'UNAVAILABLE',['offensive_semantics_unqualified']);
        decide('TRUST_BREAK_ECONOMIC_STRIKE',i.pairPlayerIds,i.sourceEventIds,'UNAVAILABLE',['offensive_semantics_unqualified','economic_target_unqualified','cooperation_unqualified']);continue;
      }
      const f=i.qualifiedOffenses.sort((a,b)=>compare(a.moment,b.moment))[0],r=refs([...i.sourceEventIds,...f.sourceEventIds]);
      decide('DECLARED_BREACH_OFFENSIVE_ATTEMPT',i.pairPlayerIds,r,'MATCHED',[]);
      deed('DECLARED_BREACH_OFFENSIVE_ATTEMPT','HOSTILITY',a,b,f.moment,r,i.anchorEventId,'RECORDED_DECLARATION_BREACH_AND_OFFENSE',
        {reciprocityEligible:true});
      const cooperative=deeds.filter(d=>d.track==='BOND'&&key(d.actorPlayerId,d.counterpartPlayerId)===key(a,b)&&compare(d.moment,i.moment)<0);
      const economic=i.qualifiedOffenses.find(f=>f.targetFunction==='ECONOMIC_UNIT'&&f.targetAttribution==='QUALIFIED');
      const missing=[];
      if(!cooperative.length)missing.push('cooperation_unqualified');
      if(!economic)missing.push('economic_target_unqualified');
      if(context.deceptionPolicy==='DECEPTION_EXPECTED'&&context.trustBreakCruelty===false)missing.push('trust_break_cruelty_disabled_by_event_policy');
      decide('TRUST_BREAK_ECONOMIC_STRIKE',i.pairPlayerIds,r,missing.includes('trust_break_cruelty_disabled_by_event_policy')?'NOT_APPLICABLE':missing.length?'UNAVAILABLE':'MATCHED',missing);
      if(!missing.length)deed('TRUST_BREAK_ECONOMIC_STRIKE','CRUELTY',a,b,economic.moment,
        refs([...r,...economic.sourceEventIds,...cooperative.flatMap(d=>d.sourceEventIds)]),i.anchorEventId,'ECONOMIC_BETRAYAL_ATTEMPT',
        {reciprocityEligible:false});
    }
    for(const f of qualified.filter(f=>f.kind==='QUALIFIED_KING_LOSS_TREACHERY')) {
      const gates=['mutualEffectiveAlliance','effectiveRupture','hostileParticipation','kingLoss','responsibility','association','mode'];
      if(!text(f.kingLossEpisodeId)||gates.some(k=>f.claims?.[k]!=='QUALIFIED')) {
        decide('QUALIFIED_KING_LOSS_TREACHERY',[f.actorPlayerId,f.targetPlayerId].sort((a,b)=>a-b),f.sourceEventIds,
          'UNAVAILABLE',['king_loss_prerequisites_unqualified']);continue;
      }
      decide('QUALIFIED_KING_LOSS_TREACHERY',[f.actorPlayerId,f.targetPlayerId].sort((a,b)=>a-b),f.sourceEventIds,'MATCHED',[]);
      deed('QUALIFIED_KING_LOSS_TREACHERY','HOSTILITY',f.targetPlayerId,f.actorPlayerId,f.moment,f.sourceEventIds,
        f.kingLossEpisodeId,'QUALIFIED_EXCEPTIONAL_KING_LOSS',{reciprocityEligible:false,exception:'KING_LOSS_TREACHERY',
          kingLossEpisodeId:f.kingLossEpisodeId,actionActorPlayerId:f.actorPlayerId,actionTargetPlayerId:f.targetPlayerId});
      addBeat('QUALIFIED_KING_LOSS_TREACHERY',f.moment,f.actorPlayerId,f.targetPlayerId,f.sourceEventIds);
    }
    const official=rec(officialOutcome);
    const duelMapped=players.every(p=>human(p.playerId));
    if(players.length===2&&official?.qualification==='OFFICIAL'&&!duelMapped)decide('ACCEPTED_DUEL_CONTEST',players.map(p=>p.playerId),[],
      'UNAVAILABLE',['human_league_identity_unavailable']);
    if(players.length===2&&official?.qualification==='OFFICIAL'&&duelMapped) {
      const ids=players.map(p=>mapped.get(p.playerId)?.playerId);
      const wins=rows(official.winnerPlayerIds),loses=rows(official.loserPlayerIds);
      if(!integer(official.resultRevision)||official.resultRevision<1||!ids.every(text)||!players.every(p=>human(p.playerId))||
          wins.length!==1||loses.length!==1||wins[0]===loses[0]||!ids.includes(wins[0])||!ids.includes(loses[0]))throw Error('official_social_outcome_invalid');
      const outcomeRef=`official-result:${gameIdentity}:${official.resultRevision}`;
      for(const p of players)addEvidence({sourceEventId:`${outcomeRef}:${p.playerId}`,actorPlayerId:p.playerId,
        moment:{atMs:duration,operationOrdinal:Number.MAX_SAFE_INTEGER},commandType:'OFFICIAL_RESULT'});
      const at={atMs:duration,operationOrdinal:Number.MAX_SAFE_INTEGER};
      const a=players[0].playerId,b=players[1].playerId;
      decide('ACCEPTED_DUEL_CONTEST',[a,b],[outcomeRef],'MATCHED',[],{resultRevision:official.resultRevision});
      for(const [x,y] of [[a,b],[b,a]])deed('ACCEPTED_DUEL_CONTEST','RIVALRY',x,y,at,[`${outcomeRef}:${x}`],'duel-result','OFFICIAL_DUEL_CONTEST');
      addBeat('ACCEPTED_DUEL_CONTEST',at,a,b,[outcomeRef],{resultRevision:official.resultRevision});
    }
    for(const family of ['MATERIAL_ASSISTANCE','DARING_OFFENSIVE_PARTICIPATION','PUNISHING_ADVANTAGE','QUALIFIED_KING_LOSS_TREACHERY'])
      if(!decisions.some(d=>d.family===family))decide(family,[],[],'UNAVAILABLE',[
        family==='MATERIAL_ASSISTANCE'?'tribute_semantics_unqualified':family==='DARING_OFFENSIVE_PARTICIPATION'?'daring_context_unqualified':
          family==='PUNISHING_ADVANTAGE'?'live_disadvantage_unavailable':'king_loss_and_effective_alliance_unqualified']);
    const exposure=[];
    for(let x=0;x<players.length;x++)for(let y=x+1;y<players.length;y++) {
      const a=players[x],b=players[y],same=a.lobbyTeamIdRaw>1&&a.lobbyTeamIdRaw===b.lobbyTeamIdRaw;
      exposure.push({pairPlayerIds:[a.playerId,b.playerId].sort((a,b)=>a-b),gameIdentity,battleId,gamesMet:1,
        context:lock===true?(same?'LOCKED_TEAMMATES':'OPPOSED'):lock===false?'OPEN_DIPLOMACY':'UNKNOWN',
        status:'CO_PRESENT_NOT_PROVEN_LOCAL_CONTACT',interactionCompleteness:false});
    }
    const contributions=rule.enabled?capSocialContributions(deeds.filter(d=>d.actorLeagueId&&d.counterpartLeagueId),rule):[];
    return {modelVersion:SOCIAL_INCIDENT_VERSION,status:'REVIEW_AVAILABLE',source:provenance,gameIdentity,battleId,
      ruleVersion:rule.ruleVersion,observedUntilMs:duration,participants:players.map(p=>({playerId:p.playerId,
        name:participantName(p.playerId),leaguePlayerId:human(p.playerId)?mapped.get(p.playerId).playerId:null})),
      counters:{directedCommands:commands.size,declaredWithdrawals:incidents.length},
      chronicle:chronicle.sort((a,b)=>compare(a.moment,b.moment)||a.id.localeCompare(b.id)),incidents,
      decisions:decisions.sort((a,b)=>a.decisionId.localeCompare(b.decisionId)),deeds:deeds.sort((a,b)=>a.deedId.localeCompare(b.deedId)),
      exposure:exposure.sort((a,b)=>key(...a.pairPlayerIds).localeCompare(key(...b.pairPlayerIds))),shadowContributions:contributions,
      policy:{productionScoringEnabled:false,engineStateEstablished:false,absenceQualified:false,
        qualifiedFactVersions:rule.acceptedQualifierVersions,ratiosEnabled:false,unmappedPlayersEarnNothing:true}};
  } catch(error) {return unavailable(error instanceof Error?error.message:'invalid_social_input');}
}

/** Aggregate actual Battle budgets, not per-deed clamps. Idempotent under identical copies. */
export function capSocialContributions(deeds,rules={}) {
  const rule=validateRules(rules),unique=new Map();
  for(const d of rows(deeds)) {
    if(!rec(d)||!text(d.deedId)||!text(d.actorLeagueId)||!text(d.counterpartLeagueId)||d.actorLeagueId===d.counterpartLeagueId||
        !text(d.battleId)||!['RIVALRY','HOSTILITY','BOND','GALLANTRY','CRUELTY','CHIVALRY'].includes(d.track)||
        !integer(d.severity)||d.severity<1||!text(d.family)||d.ruleVersion!==rule.ruleVersion||!refs(d.sourceEventIds).length||
        !integer(d.moment?.atMs)||!integer(d.moment?.operationOrdinal))throw Error('invalid_social_contribution');
    if(unique.has(d.deedId)&&json(unique.get(d.deedId))!==json(d))throw Error('conflicting_social_deed_identity');
    unique.set(d.deedId,d);
  }
  if(!rule.enabled)return [];
  const best=new Map(), exceptional=new Map();
  for(const d of [...unique.values()].sort((a,b)=>b.severity-a.severity||a.deedId.localeCompare(b.deedId))) {
    if(d.exception==='KING_LOSS_TREACHERY'){
      if(d.family!=='QUALIFIED_KING_LOSS_TREACHERY'||d.track!=='HOSTILITY'||!text(d.kingLossEpisodeId))throw Error('invalid_treachery_exception');
      const k=identity(d.gameIdentity,d.kingLossEpisodeId,d.actorLeagueId,d.counterpartLeagueId);
      if(!exceptional.has(k))exceptional.set(k,{...d,sourceEventIds:refs(d.sourceEventIds),units:0,reciprocityEligible:false});continue;
    }
    const rep=['GALLANTRY','CRUELTY','CHIVALRY'].includes(d.track);
    const group=identity(d.battleId,d.track,d.actorLeagueId,rep?'ALL_COUNTERPARTS':d.counterpartLeagueId);
    if(!best.has(group))best.set(group,{deedId:d.deedId,lineageId:d.lineageId??d.deedId,battleId:d.battleId,
      gameIdentity:d.gameIdentity,moment:d.moment,track:d.track,actorLeagueId:d.actorLeagueId,counterpartLeagueId:d.counterpartLeagueId,
      family:d.family,units:Math.min(d.severity,rule.trackBudget),reciprocityEligible:d.reciprocityEligible!==false,
      sourceEventIds:refs(d.sourceEventIds),ruleVersion:rule.ruleVersion,scope:d.scope});
  }
  return [...best.values(),...exceptional.values()].sort((a,b)=>a.deedId.localeCompare(b.deedId));
}

/** Rebuild a complete supplied active chapter set. No append-only scores or upload-time ordering. */
export function rebuildSocialHistory(chapters,rules={}) {
  const rule=validateRules(rules),games=new Map();
  for(const chapter of rows(chapters)) {
    if(!text(chapter.gameIdentity)||!text(chapter.battleId)||!integer(chapter.order)||!integer(chapter.revision)||chapter.revision<1)
      throw Error('invalid_social_chapter');
    if(chapter.review?.status==='REVIEW_AVAILABLE'&&(chapter.review.gameIdentity!==chapter.gameIdentity||chapter.review.battleId!==chapter.battleId||
        chapter.review.ruleVersion!==rule.ruleVersion||rows(chapter.review.deeds).some(d=>d.gameIdentity!==chapter.gameIdentity||d.battleId!==chapter.battleId||d.ruleVersion!==rule.ruleVersion)))throw Error('social_chapter_context_mismatch');
    const prior=games.get(chapter.gameIdentity);
    if(prior&&prior.revision===chapter.revision&&json(prior)!==json(chapter))throw Error('conflicting_active_social_revision');
    if(!prior||chapter.revision>prior.revision)games.set(chapter.gameIdentity,chapter);
  }
  const active=[...games.values()].filter(c=>c.accepted===true&&c.review?.status==='REVIEW_AVAILABLE')
    .sort((a,b)=>a.order-b.order||a.gameIdentity.localeCompare(b.gameIdentity));
  const contributions=capSocialContributions(active.flatMap(c=>rows(c.review.deeds)),rule);
  const pairMap=new Map(),profiles=new Map();
  for(const chapter of active)for(const e of rows(chapter.review.exposure)){
    const ids=e.pairPlayerIds.map(id=>rows(chapter.review.participants).find(p=>p.playerId===id)?.leaguePlayerId);
    if(!ids.every(text)||ids[0]===ids[1])continue;
    const pair=ids.sort(),pkey=JSON.stringify(pair);
    const p=pairMap.get(pkey)??{playerIds:pair,tracks:{},exposure:{gameIds:[],battleIds:[],contexts:[],lastOrder:null}};pairMap.set(pkey,p);
    p.exposure.gameIds=[...new Set([...p.exposure.gameIds,chapter.gameIdentity])].sort();
    p.exposure.battleIds=[...new Set([...p.exposure.battleIds,chapter.battleId])].sort();
    p.exposure.contexts=[...new Set([...p.exposure.contexts,e.context])].sort();p.exposure.lastOrder=chapter.order;
  }
  for(const c of contributions.filter(c=>!c.exception)) {
    const pair=[c.actorLeagueId,c.counterpartLeagueId].sort(),pkey=JSON.stringify(pair);
    if(!pairMap.has(pkey))pairMap.set(pkey,{playerIds:pair,tracks:{}});
    const pairRow=pairMap.get(pkey);
    if(['RIVALRY','HOSTILITY','BOND'].includes(c.track)) {
      const t=pairRow.tracks[c.track]??={battleIds:[],directedActors:[],units:0,currentStage:0,historicalPeak:0};
      t.battleIds=[...new Set([...t.battleIds,c.battleId])].sort();t.units+=c.units;
      if(c.reciprocityEligible)t.directedActors=[...new Set([...t.directedActors,c.actorLeagueId])].sort();
      t.currentStage=Math.min(2,t.battleIds.length);
      if(t.battleIds.length>=3&&t.directedActors.length===2)t.currentStage=3;
      t.historicalPeak=t.currentStage;
    } else {
      const p=profiles.get(c.actorLeagueId)??{playerId:c.actorLeagueId,tracks:{}};profiles.set(c.actorLeagueId,p);
      const t=p.tracks[c.track]??={units:0,battleIds:[],counterparts:[],status:'DEVELOPING'};t.units+=c.units;
      t.battleIds=[...new Set([...t.battleIds,c.battleId])].sort();t.counterparts=[...new Set([...t.counterparts,c.counterpartLeagueId])].sort();
    }
  }
  const byGame=new Map(active.map(c=>[c.gameIdentity,c.order]));
  const exceptions=contributions.filter(c=>c.exception).sort((a,b)=>byGame.get(a.gameIdentity)-byGame.get(b.gameIdentity)||compare(a.moment,b.moment)||a.deedId.localeCompare(b.deedId));
  for(const c of exceptions){
    const pair=[c.actorLeagueId,c.counterpartLeagueId].sort(),pkey=JSON.stringify(pair);
    if(!pairMap.has(pkey))pairMap.set(pkey,{playerIds:pair,tracks:{}});
    const t=pairMap.get(pkey).tracks.HOSTILITY??={battleIds:[],directedActors:[],units:0,currentStage:0,historicalPeak:0};
    t.exceptionalDirectedLevels??={};
    // Existing ordinary progression at the event's historical cutoff, not future Battles.
    const prior=contributions.filter(d=>!d.exception&&d.track==='HOSTILITY'&&JSON.stringify([d.actorLeagueId,d.counterpartLeagueId].sort())===pkey&&
      (byGame.get(d.gameIdentity)<byGame.get(c.gameIdentity)||byGame.get(d.gameIdentity)===byGame.get(c.gameIdentity)&&compare(d.moment,c.moment)<0));
    const battles=new Set(prior.map(d=>d.battleId)),actors=new Set(prior.filter(d=>d.reciprocityEligible).map(d=>d.actorLeagueId));
    const ordinary=battles.size>=3&&actors.size===2?3:Math.min(2,battles.size);
    t.exceptionalDirectedLevels[c.actorLeagueId]=applyTreacheryLevel(Math.max(ordinary,t.exceptionalDirectedLevels[c.actorLeagueId]??0),rule.maximumStage);
  }
  return {modelVersion:'AOF_SOCIAL_HISTORY_V1',ruleVersion:rule.ruleVersion,activeGameCount:active.length,
    contributions,pairs:[...pairMap.values()].sort((a,b)=>json(a.playerIds).localeCompare(json(b.playerIds))),
    profiles:[...profiles.values()].sort((a,b)=>a.playerId.localeCompare(b.playerId)),
    policy:{productionScoringEnabled:false,ratiosEnabled:false,absenceCoolingEnabled:false,
      exceptionalKingLossScoringEnabled:false,exceptionalKingLossShadowEvaluated:exceptions.length>0,sourceSetMeaning:'complete_supplied_active_chapters_not_claimed_entire_league'}};
}

/** Approved directed exception; does not create reciprocal hostility or a mutual Feud. */
export function applyTreacheryLevel(current,maximum){
  if(!integer(current)||!integer(maximum)||maximum<3||current>maximum)throw Error('invalid_treachery_levels');
  return current<3?3:Math.min(maximum,current+1);
}
