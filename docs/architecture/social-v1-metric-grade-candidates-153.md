# Age of Friends — SOC-GRADE-01/02 source-bound metric grading contract

**Technical version:** `AOF_SOCIAL_METRIC_GRADE_CANDIDATES_1` (private, inert, game-local).  
**Owner policy register:** `AOF_SOC_GRADE_POLICY_REGISTER_1` (PROPOSED_UNAPPROVED).  
**Status:** #152 evidence-ready contract + #153 bounded candidate producer. This is **not** a source of approved grade labels, numeric cutoffs, metric-to-track mappings, stage increments, or production writes.

## Matrix fidelity is the first approval gate

**Update, 25 October 2026:** The owner supplied the complete [*Age of Friends — Statistics-to-Social Interpretation Matrix*, owner-review proposal v0.1](grade-reputation-metrics-owner-review-v0.1.md). The [verbatim-checksummed, machine-readable v0.1 proposal catalogue](../../contracts/social-v1/metric-grade-owner-review-v0.1.json) records **all twenty** metric-family rows with exact `Q/c/·/W` track symbols and per-row conditions, twelve no-award rows, fifteen future metric proposals, all six independent weakening candidates, six ordinal grades, and five questions still reserved to the owner. Its closed [schema](../../contracts/social-v1/metric-grade-owner-review-v0.1.schema.json) refuses approved weights, method promotions and scoring bands. This is newly supplied **owner-review source text**, not proof that the separate earlier project's final **“Grade Reputation Metrics”** decision was approved.

The original [decision register](../../contracts/social-v1/metric-grade-policy-proposal-v1.json) now refers to this precise source and checksum, with `sourceStatus=OWNER_REVIEW_PROPOSAL_V0_1_SUPPLIED_FINAL_APPROVAL_PENDING`. All **approved** `gradeBands`, numerical thresholds/weights, `sourceCoveragePromotionRules`, `metricTrackSelections`, weakening rules, Event budgets and grade-to-significance mapping remain **empty**, `ownerConfirmation=null`, and `policyStatus=PROPOSED_UNAPPROVED`. `Q` is **not** an ADMITTED observation or `+`; `W` is **not** an authorized weakening; `c` is context only, and `·` is ordinarily no direct contribution. **Neither** the private #158 candidate emitter nor the Sol INT-C1/C2 Pending handoff may treat this catalogue as a source-approved policy or use the Season aggregate as a source episode.

Owner confirmation remains required for six-track boundaries, pressure/Hostility and Cruelty predicates, whether tribute *requests* ever support inferred benefit, independent weakening, opportunity denominators, metric method admission, grade cutoffs, grade-to-#139 mapping, Event caps and privacy/display. Preserve exact original metric names and reasoning; never substitute the inferred track hypotheses from #158 for the owner's v0.1 table.

**Established product direction:** ordinary gameplay-first gradual source-supported Reputation (player-owned) and directional Relationship (A→B), with rare meaningful deeds / testimony as exceptional, not primary progression. Personality's five axes describe players; their values do not convert to Social points. Prior #139 Event caps, stage 3+ independent reciprocity, Rivalry stage-3 protected floor and strict Treachery remain authoritative.

## Accurate available metric and evidence inventory

| Existing producer or field | Present measurable data | Original source meaning | Grade eligibility today |
|---|---|---|---|
| Canonical Recorded Events / `actionEvents` | `eventId`, original replay actor, `timestampMs`, `operationOrdinal`, action kind | Observed decoded command/request. Partial ordinal remains partial | Source anchor only |
| Pair Social Evidence V1 / #149 | Actor-specific targeted commands, economy pressure, defensive participation, reinforcement; deduped source deed IDs; original actor and counterpart; prior directed candidate deed IDs | Inferred directed episodes from commands, not confirmed attack consequence | **LIMITED**, eligible as candidates |
| Raid Detection V3 / Military V4/V5 | `raidEvidence.initiatedEpisodes`, victim/controller mapping, economic unit/zone, command evidence, source refs; `raidsInitiated`, `raidsAgainstYou` | Directional local economy-pressure *detector*, not damage, civilians killed or victim helplessness | Contextual if same original actor and event refs; no standalone severe grading |
| Engagement Statistics V4 | Skirmish, technical Battle, defensive assist, reinforcement and cooperative attack source detector IDs; source refs, time windows, contribution | Observed/inferred command engagements; battle is promoted skirmish, **not second independent deed** | Detector context; not victory, rescue or material help |
| Map Presence V8 / Context V2 | Source-exact BUILD placements, towers/forward economy/production requests; per-opponent proposed territorial distances; Castle raw-82 candidates with unrounded TC objects | Placement request, not completed building; enemy territory TERR-01 unapproved | Neutral context only. Raw strict <15 for Castle is **not** a completed unique operational Castle or own queue |
| Economy Statistics V5 | Sent/received decoded **tribute requests** with original `sourceEventId`, donor, recipient, amount status and resource | Command-request amount, not settled delivery/received beneficiary value | Neutral request context only, including nonzero requests |
| Opening/Economy/Military stats | Queue/age research requests, villager/TC reconstruction with source-coverage limitations, proposed population and military investment | Observable requests and incomplete projected output, not independently attested living army or pre-entry opponent weakness | Candidate opportunity only if bounded past-only source window independently qualified |
| Gold influence Context V2 | Gold cluster inferred infrastructure influence, placement source refs | Not mined gold, possession, combat domination or recorded extraction | Context only |
| MatchFacts / lobby fixed teams | `lockTeams`, team IDs when decoded | Fixed-team comparator only when locked/DECODED. FFA effective alliances and ruptures cannot be assumed | Mode comparability context, never Bond |
| APM, resource/army aggregates, wins/losses, final populations | Player summaries, some approximations, sometimes time-series | Often no recipient identity / no relevant prior-time witness; final result is hindsight | **Not a directional source deed**; ineligible alone for all six tracks |

Note: the 320 TownBell-named capabilities in `statistics_registry.py` include many **research-only**, `needs_controlled_fixture`, or parser-not-qualified metrics. Registry inclusion does not make any metric available as a verified source-grade observation. Avoid promoting a leaderboard count or replicated aggregation.

## Inert per-Game candidate contract

`prepare_social_metric_grade_candidates(statistics, context, source_measurements, action_events, game_scope)` reads only #142 actual Context V2 and #149 original source measurements and canonical native actions. Its output has:

- `version`, revision/projection digests, `gameScope` (untrusted metadata: Match/Battle ID, Game ID, replay GUID and authority), `gameScopeAuthenticated=false`, `sourceRevision` and `sourceContextRevision`.
- `candidateEpisodeGroups[]`: stable versioned `candidateId`/`independentContributionKey`, original actor→specific counterpart (Replay slots, **not** authenticated league IDs), source deed and event IDs, true first `(recordingAtMs, operationOrdinal)` or PARTIAL, bounded interval, source-layer/provenance, measured **distinct original command requests**, opportunities/counterevidence as unqualified refs, linked detector hypotheses and explicit mode.
- `trackHypotheses[]`: possible reading of evidence with **unmet prerequisites**. Every one is `PENDING`, `proposedOnly=true`, `noOfficialEligibility=true`; none is a metric→track approval. `grade.bandId=null`, `ruleVersion=null`, `historicalEffect=null` and `grade.decision=PENDING`.
- `neutralPlacementContexts[]`, `neutralTributeRequestContexts[]`: actor-bound requests kept outside directional grade eligibility. No automatic target/beneficiary from geography. Tribute amount means **request**, not receipt.
- Output `claims=[]`, `actorWitnesses=[]`, `receipts=[]`, `trackCredits=[]`, `officialWrites=false`, `publicationAllowed=false`.

**NO SHARED_1 schema migration requested.** This is an explicitly private upstream DTO; SHARED_1 `Inference.significanceBandId` and #139's existing Contribution Key semantics stay unchanged. If future qualification warrants mapping to SHARED_1, propose a *separate approved*, versioned method/fact/coverage adapter with authenticated Sol review, not an automatic translator in this PR.

### Anti-multiplication and correspondence

The output is **one grade candidate per source-connected episode for each original actor→counterpart**. Repeated facets of the same source deed, shared original event IDs and shared source incident IDs join into a single source-connected component. The component retains all raw metric rows for explanation, but has **only one independent contribution key**, no summed severity, no unit inflation from duplicated POV rows. Even if a raid is also a skirmish, pressure command and building-contact detector, detector overlap is *context* rather than another credit. Different actors' genuinely own sources are separately attributable and never copied into reverse reciprocity. Different Games with `game-1` under different Matches have separate IDs; GUID arbitration, withdrawals, revision rebinding and authoritative current Game state remain **Sol's** task.

**No-op commands and counterevidence:** STOP/CANCEL in a bounded original window is a counterevidence *candidate*, not proof that any prior command never executed. Absence of STOP or no action is not proof of completion, weakness, peaceful behavior or evidence coverage. Past source event IDs must fall before the episode entry; later losses/results never prove earlier difficulty or vulnerability.

## Six-track eligibility and matched negatives (proposals only)

| Track | Real source candidate | Closest adjacent false positive | Missing before semantic eligibility |
|---|---|---|---|
| **Gallantry** | Actor-owned competitive offense against a specific rival; original time, linked skirmish/raid commands | Ordinary rush, later victory, large APM or superior final army | Independent past-only opponent challenge + material commitment + opportunity-adjusted comparability (civ/map/time), owner grade thresholds |
| **Cruelty** | Economy-pressure commands and repeated directed raid episodes toward specific opponent | Routine warfare, victim weakness **caused by** raid, assumed damage/kills | Independently measured **pre-existing** specific victim vulnerability, qualified severity/opportunity/recurrence, no motive inference |
| **Chivalry** | Fixed-team, recipient-specific defensive assistance/reinforcement candidate; source refs and time | Defensive presence, allies nearby, assisted receiver not actually threatened | Independently earlier recipient threat, material opportunity/capacity and corroborated distinct benefit; cannot infer rescue |
| **Rivalry** | Original directed pair contests, skirmish counterplay, targeted offense and active defense; episodes grouped | Passive surviving, mere enemy contact, same shared target, duplicated skirmish-to-Battle | Material competitive episode and reciprocal evidence only when the opposite actor truly acts. Early stage one-sided okay; stage 3+ two directions |
| **Hostility** | Potentially repeated serious directed aggression with source-linked past conduct context | Every duel/attack, alliance request alone, enemy kill presumption | Non-routine seriousness, genuine effective prior cooperation + attributable rupture where required, distinct aftermath; strict Treachery unchanged |
| **Bond** | Source-specific help/reinforcement or tribute **request** with named recipient | Routine team assignment, co-attack shared opponent, apparent transfer that did not arrive | Meaningful independently evidenced recipient benefit/need and effective affiliation if mode requires it; not every teammate |

For each track, **authentic observed command positives do not equal six authentic qualified semantic positives**. Conservative current outcome for all grades is **PENDING**, even for a detectable Rivalry contest: no owner-grade mapping or admission rule exists.

### Independent weakening evidence (not automatically triggered)

Owner must separately approve qualified **Gallantry weakening** from documented avoidable withdrawal *despite* capacity/opportunity, **Cruelty weakening** from independently verified reparative relief to prior victim, **Chivalry weakening** from a knowingly abandoned material protective commitment despite capacity and need; ordinary opponent silence or defeat is not weakening. Relationship **Rivalry** deliberate de-escalation plus actual mutual contest history (floor/ack preserved), **Hostility** meaningful directed reconciliation with independently verified prior grievance, **Bond** unusual material antagonism against a previously truly helped/cooperating specific beneficiary. No zero-sum conversion or automatic opposite-track award; no copied actor reciprocity.

## Genuine original fixtures and source-negative testing

Use actual SHA256-pinned `replay-fixtures/1v1_1.aoe2record`, `2v2.aoe2record`, `4v4.aoe2record` and `FFA_diplo.aoe2record` through the **existing** `build_payload → build_analysis_dataset → project_statistics_from_analysis → project_social_v1_context → project_social_source_measurements` pipeline, then this private neutral candidate layer. Log `AUTHENTIC_SOURCE_METRIC_GRADE_WITNESS` with original hash, source event IDs, actor/counterpart, source moment, detector candidates, grouped count, **zero** credits. A repository recording alone does not prove any six social meanings or server-authenticated Battle provenance. Source fixture 1v1_1 and 1v1_2 are two POVs of one Game, not two Battles.

The normal Python suite tests forged actor, stale source or context, duplicate POV/source, pair direction, same-source grouping, partial original ordinal, bounds, event revision, mode and no-op. The authentic original corpus job is opt-in and restricted to local hash-pinned fixture content; no network, runtime service, observer or deploy.

## Owner decision and Sol INT-V1 handoff

1. **Owner/Organiser 3:** Supply verbatim exact `Grade Reputation Metrics` source table and reasoning. Confirm original names, semantic normal and exceptional track cases, strengthening/weakening, per-family source and opportunity/denominator, mutually exclusive bands and thresholds, cap/group meanings, grade-to-`significanceBandId` and #139 budget units, and player explanation/privacy. Null fields in policy register must not silently acquire defaults.
2. **Worker 4:** Remain pure upstream; source provenance, candidate dedup, opportunity/counterevidence, mode and source correction tests, authentic command observations. No ADMITTED conversion from LIMITED without reviewed specific kind+methodVersion+coverage rule, and no manufactured semantic facts.
3. **Sol INT-V1:** Inside server-authenticated current READY SourceSnapshot transaction, prove Match/Battle+Game source and game GUID, mappingDigest, Event roster admission, current source/POV choice, historical order, corrections/withdrawals, stable incident lineage and bounded production facts. Refuse browser-supplied grades and client method registries. Bind admitted source methods into #141 **only after approved policy**, emit canonical Inference/Claim and own-actor witnesses, and call unchanged #139. Keep public publication/receipts/stages disabled until explicit later authorization.
4. **Independent review:** Check the four real original corpora, genuine negatives, source revision and actor checks, grouping across raid/contact/context, incomplete coverage, no numerical/semantic escalation, and no hidden effect publication. Merge only inert candidate contract/producer. No new scoring engine, parser, historical ledger, stage changes, awards, deployment, flags or staging.

