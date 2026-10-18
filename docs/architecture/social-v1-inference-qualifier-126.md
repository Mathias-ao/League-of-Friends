# Age of Friends V1 — Six-track inferred conduct qualification (#126)

**Status:** Pure, default-off proposed implementation. Depends on merged AOF_SOCIAL_V1_SHARED_1 and neutral context from Worker #124 / PR #138. No scorer, parser, ledger, official receipts, deployment, flags or replay observer.

**Files:** replay-tools/social_v1_inference.py, test_social_v1_inference.py. Version AOF_SOCIAL_V1_INFERENCE_1.

## Trust and semantic boundary

The owner directed bounded inferred ordinary conduct in #122 but has NOT approved the individual predicates, numeric rules, materiality thresholds, significance bands, or additional Hostility/Bond harm categories. This module deliberately accepts only PROPOSED configuration and returns canonical SHARED_1 Inference/Claim records plus inert #139 AdmittedEffect/ActorConductWitness wrappers. It cannot make anything official or publish a score.

Server-side integration MUST select the active integrity-verified READY Game, prove source lineage/roster/source event and measurement authenticity, check immutable source revision, and resolve trusted policy and numerical approvals. This pure function checks consistency, not access permission. Never pass untrusted client-submitted facts or source metrics to it.

The #124 deedContexts.facetKinds is pair-wide; the qualifier also requires matching original Pair Social Evidence deeds with per-facet actor/target/event refs to avoid copying A's conduct to B. In particular, every SOURCE_EVENT on an actor-owned TARGETED_COMMAND / ECONOMY_PRESSURE / DEFENSIVE_PARTICIPATION / REINFORCEMENT_COMMANDS facet must have the identical actor in the retained original observation. A misattributed direction is refused, while unrelated valid directions remain independently evaluable. An attack command, engagement detector, BUILD action, gold infrastructure proxy or support geometry is NOT proof of executed harm, received resources, completed structure, mining, rescue or motive. Real Replay execution observation is not required for ordinary V1, but bounded inference must remain labelled as inference.

All source-context proxy measurements require explicit method registration, provenance refs, event/clock and source authority matching, and configuration-provided minimums. Pre-entry measurements must end before the episode, and their original Pair Social Evidence observation timestamps must fall inside the attested measurement window. The qualifier requires those original event observations as separate input, not just a self-asserted proxy timestamp. Correlated witness copies cannot count as independent corroboration. Missing required evidence is pending, contradictory known context is not qualified.

## Proposed ordinary strengthening matrix

| Track | Positive conjunction (separate corroboration) | Adversarial nonqualification |
|---|---|---|
| Rivalry A→B | Own pair-targeted offense or active defense + local competition + linked Skirmish/engagement | Co-presence, teammate score, passive attack receipt, reverse copied witness |
| Bond A→B | Directed defender help + own helper-specific Assist/Reinforcement detector + meaningful-help measurement | Ally membership, shared target, proximity, receipt of help |
| Hostility A→B | Own substantive economy pressure + pre-entry effective cooperation + attributable breach + independently contextualized post-breach pressure in historical order | Routine war or strategic victory; a treaty change without qualifying aftermath |
| Gallantry A | Meaningful directed offense + separately recorded, challenging opponent at episode entry | Postgame win; strength inferred only from later outcomes |
| Cruelty A | Directed meaningful economy pressure + independently established pre-existing vulnerability of targeted opponent | Ordinary raid; disadvantage created by the attack or only seen at game end |
| Chivalry A | Helper-specific meaningful support + recipient-specific threat already established before intervention | Routine ally participation; claimed rescue without evidence |

Hostility and Cruelty paths are particularly **policy proposals**. Current neutral #124 evidence does not reconstruct effective historical alliance or opponent strength/vulnerability on its own. Without separately admitted, named bounded measurement producers these pathways remain unavailable. Synthetic test positives are NOT genuine replay execution or authentic six-track acceptance.

## Independent weakening

RECONCILIATORY_HELP may weaken helper→recipient Hostility if directed assistance AND an independent reconciliation witness qualify. SERIOUS_BOND_ANTAGONISM requires its own meaningful directed harm context before weakening actor→counterpart Bond; it may coexist with separately admitted Hostility strengthening from the same episode but never follows by automatic conversion. QUALIFIED_DEESCALATION requires a separate source-backed predicate for directional Rivalry weakening, not inactivity, result or skill gap. Ordinary Reputation weakening is not automatically invented and needs an owner-approved separate catalog. The protected Rivalry level 3 gate remains in #139. No recipient mirror credit, zero-sum track conversion or fake reciprocal action.

## Stable identities and integration

Canonical subject and claim identities are based on neutral server-attested incident lineage, actor, track, effect and family. Revision hashes include source authority, #124 context revision and policy; corrections rebuild from active source and cannot revive withdrawn/pending lineages. The original Match/Battle and Game identity is preserved. Historical Position is anchored in the earliest matching original actor-owned SOURCE_EVENT's recorded (atMs, operationOrdinal). Every actor-owned facet event must match the original recorded actor. Absent, non-integer, duplicate or ambiguous source ordinals, unknown league ordering or unknown league key downgrade that effect to PENDING with no reciprocal witness. Neither deed array ordering, timestamps alone nor synthetic indexes supply a missing operation ordinal. Cross-Game duplicate GUID and POV arbitration is owned by the authoritative server and #139, NOT this Game-local function. Qualification output supplies SHARED_1 Inference, Claim and optional same-actor source witness for future #139 inputs, but policy is PROPOSED and produces no applied credits.

A valid synthetic fixture does not establish that underlying observed facts or measured values are independently real. Chronicle prose must disclose Inferred claims and must never claim observed executions or attribute motives.

## Owner approval queue (still unresolved)

1. Approve or revise every proposed ordinary family, especially non-king Hostility, persistent opponent disadvantage for Cruelty, source family materiality, serious Bond weakening and any new Reputation weakening.
2. Establish attested source measurement producers: pre-entry challenge, pre-existing vulnerability, threatened beneficiary, directed substantive help/pressure, effective prior alliance/rupture, reconciliation and de-escalation. Specify actual time windows, coverage and adversarial false positives; #124 does not create these witnesses by itself.
3. Calibrate explicitly versioned numeric minimums, significance tiers and all ordinary per-Battle/Event budgets, higher stages and reciprocal credit rules. Test-only numbers have no production authority.
4. Resolve proposed TERR-01/02, dynamic diplomacy and FFA recipient identity, ambiguous ownership, independent contextual evidence versus duplicated commands, and value of Gold infrastructure (never mined/owned gold).
5. Preserve unresolved pre-Treachery cooling disposition in #139 as PENDING; only owner-approved strict resolver may perform exceptional effects.
6. Authenticate 1v1, team and FFA original recordings (positive and adversarial negative cases), correction and duplicate POV, across multiuser security and full E2E before any official enablement.

Tests in this PR are synthetic inputs passed through Worker #124's actual neutral context projector; no authentic original .aoe2record acceptance or cloud deployment is asserted.
## Organiser 2 CI remediation and temporal handoff

The three initial Replay Tools CI errors were **invalid synthetic fixtures**, not inadequate neutral validation. Co-target examples now contain two physically consistent original contributor events and an undirected shared-opponent facet. Correlated measurement tests reuse a *single consistent original observation* across two labels, verifying that one source cannot independently corroborate both. Worker #124 conflicting-source validators remain unchanged.

Issue #139's merged `history.js` requires a genuinely ordered `Position.operationOrdinal` and verified league key. `#126` derives the ordinal only from the original actor-owned event moment; if the source lacks a unique ordinal, the proposed Inference and Claim remain PENDING, never ordinary credited. The test executes a Python-produced SHARED_1 Claim and independent actor witness in Node's pure #139 evaluator under **synthetic proposed calibration**, requiring an ordered, non-capped historical stage progression and **zero** publishable receipts, while a missing ordinal yields no QUALIFIED effect/witness.

## Forward Castle Context V2 compatibility (PR #142)

Both named neutral DTO revisions (`AOF_SOCIAL_V1_CONTEXT_V1`, `AOF_SOCIAL_V1_CONTEXT_V2`) are accepted explicitly; unknown versions fail closed. V2's **owner-approved strict unrounded Euclidean distance <15 tiles** from a *specific opponent's initial TC* (exactly 15 is excluded) remains solely a neutral Castle proximity prerequisite. This qualifier does not calculate, change or approve any Castle geometry, does not use proposed TERR-01 enemy territory thresholds as facts, and emits **no** Castle objective completion or queue proof. Completion, unique genuine Castle (not Krepost), actual operation and its own five-minute production queue remain distinct strict-proof obligations. When #142 merges, use its neutral producer output unchanged.

## Existing evidence versus required bounded derivative producers

| Needed input/evidence | Already present in authentic retained source/statistics? | Additional derivation needed for ordinary positive claims |
|---|---|---|
| Original SOURCE_EVENT actor ID, event moment / operation ordinal, command IDs | **Yes** in Pair Social Evidence and original retained canonical events; availability is per-source/coverage-dependent | Server-authenticated READY source, roster binding, Game/Match revision fence; reject missing ordinals |
| Directed raid/economy pressure, pair command targeting and local opposition | **Yes, bounded command-derived episodes** via Raid V3, Skirmish V2, Pair Social Evidence V1, #124 deed contexts | Calibrate substantive pressure, non-command-only corroboration; exclude unknown victim/controller and passive outcome assumptions |
| Engagement, active defense, recipient-specific reinforcement/assistance candidates | **Yes, command/geometry-inferred candidate detectors** via Engagement V4 and #124 | Independent meaningful recipient aid and threat/capacity measurements; NOT rescue/damage proof |
| Fixed teams, initial TC anchors, per-opponent proximity and proposed territory | **Yes**, #124. #142's strict <15 Castle proximity remains separate | Effective time-varying diplomacy, actual opponent attribution and TERR-01 rule approval where required |
| Opening/episode-entry offensive challenge vs an opponent | **Not yet produced as a qualified pre-entry measurement** | Historical pre-entry military/eco capacity proxy with prior-time windows and coverage; never winner hindsight |
| Sustained pre-existing victim disadvantage for Cruelty | **Not yet produced as a qualified source-backed measurement** | Bounded before-pressure vulnerability/opportunity proxy linked to *specific victim*, independent of the attack and later outcome |
| Meaningful help to this recipient / threatened beneficiary | **Partial**, candidate helper→recipient events exist | Quantified contribution/opportunity/threat context, negative controls for team proximity and generic co-target |
| Historical cooperation, unilateral rupture, serious post-rupture antagonism | **Partial**, fixed-team/lobby and directed pressure only; effective diplomacy still unknown | Ordered effective cooperation/rupture witness with explicit responsible actor, and distinct post-rupture pressure context; no routine warfare shortcut |
| Reconciliation / Rivalry de-escalation / serious Bond harm | **Not independently qualified** | Own separately attributed meaningful behavior and prior relationship-context witnesses; absence/inactivity does not prove weakening |
| Confirmed Castle completion, kills, rescue, mined Gold or hostile intent | **No**, current context explicitly does not prove these | Not part of ordinary inference; strict exceptions require separate verified proof |

### Smallest safe follow-up after pure PR acceptance

**One source-backed episode-entry measurement producer + admission adapter**, no replay parser or observer. It should emit bounded, windowed, method-versioned `Measurement` witness DTOs from retained action/engagement, army-commitment, construction and economy projections, with strict historic cutoff, independent source events, raw replay actor and counterpart, coverage, counterevidence and Match/Game source revision. Start with **pre-entry opponent challenge**, **pre-existing vulnerability** and **recipient-specific meaningful assistance**; add historical rupture/effective diplomacy only when a genuine independently attributable source derivation is available. Keep all calibration policies PROPOSED and test against actual hash-pinned READY 1v1/team/FFA replays including counterexamples. #126 tests remain synthetic until these producers and admission are proven.
