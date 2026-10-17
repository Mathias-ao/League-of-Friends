# Age of Friends V1 — Integrated Social Launch Roadmap

**Status:** Product launch target confirmed; technical implementation and calibration remain pending.  
**Reviewed:** 17 October 2026 · **Verified source checkpoint:** `25f120412df5ed0118b9557cdf822ab175108242` (merged PR #120).  
**Authority:** This document organizes research and implementation. It does **not** change the approved AOF-SOC/REL rules, approve numerical scores, deploy functionality, or authorize feature activation. Recheck `main` before work.

## 1. Non-negotiable V1 product outcome

AoF V1 is meant to be a working social game history, **not** merely a candidate-evidence dashboard:

- All **five Player Personality sliders** operational: Boomer ↔ Aggressor, Cautious ↔ Bold, Guerrilla ↔ Frontline Fighter, Specialist ↔ Improviser, Compact ↔ Expansive. Longitudinal, context-aware, descriptive, independently versioned; incomplete evidence is **Developing**, not a made-up neutral midpoint.
- All **three persistent player-owned Reputation tracks** with genuinely executable, tested positive pathways: **Gallantry, Cruelty, Chivalry**.
- All **three independent directional pair Relationship tracks** with genuinely executable, tested positive pathways: **Rivalry, Hostility, Bond**, with A→B distinct from B→A, legitimate stage-level reciprocity, weakening/cooling and correction safety.
- Rich military, spatial, economic and cooperative interaction evidence considered where relevant: pressure, raids, skirmishes/battles, team-game opponent focus, co-attacks, defensive assistance, forward buildings/towers/castles, resource/gold contest and independent defensive counterplay.
- An actual **factual Chronicle and selective authenticated source-linked player reporting** (assistance, situated antagonism, skill acknowledgment, exceptional Treachery confirmation), correctly distinguishing facts, author-attributed perceptions and separately qualified credited effects.
- One real player-facing, multi-account end-to-end acceptance journey, with source correction, rebind, pending official result, privacy and staged rollout tested independently.

The owner explicitly promoted **small, usable Chronicle player reporting to the V1 launch target**, despite older automatic-first implementation plans deferring most ordinary interaction. This is a **launch-scope clarification**, not a blanket approval to relax source gates or activate surveys. No routine questionnaires, unrestricted ratings, or thirteen-theme expansion.

A player lacking actual qualifying deeds may correctly remain at baseline. This does not excuse a launch engine with **no verified positive test path** for any of its six earned tracks.

## 2. What is really merged versus what is not

- PR [#119](https://github.com/Mathias-ao/League-of-Friends/pull/119) merged the ordinary native Recorded Events V1 upload integration. It is implementation, not proof of deployed cloud/browser acceptance or feature activation.
- PR [#114](https://github.com/Mathias-ao/League-of-Friends/pull/114) merged dormant social bridge, directional ledger, three-family and Chronicle prototypes.
- PR [#120](https://github.com/Mathias-ao/League-of-Friends/pull/120) **merged and closed** after 12/12 workflow and 27/27 individual exact-head checks. Merge commit is `25f120412df5ed0118b9557cdf822ab175108242`. Social Evidence V1a is an **authenticated, read-only, default-off** current-Game evidence adapter; its source, player mapping, Event official/warmup membership, chronology, access, revision and correction fences do not amount to substantive conduct proof.
- **No substantive V1b qualifications, official Reputation/Relationship progression, social stage credits, public social UI or new Chronicle judgment service** have been delivered or activated. Do not confuse pending claims with awarded points.
- Feature gates (including `AOF_SOCIAL_EVIDENCE_V1A_READS` and `AOF_SOCIAL_EVIDENCE_V1A_ENDPOINT`) remain off. The approved design's pending-evidence league visibility/privacy question requires explicit resolution before enabling.
- The **15 October staging manual E2E was stopped as incomplete**. Emulator acceptance and merged code are not deployed-cloud or real-player E2E acceptance; do not resume staging or deploy without a fresh explicit authorization.

The older `CURRENT-STATE.md`, `PROJECT-CONTINUITY.md`, README and CURRENT-STATS historical sections may recount prior milestones; **this dated checkpoint supersedes their earlier claims that #120 was still a feature branch or that ordinary AUTO native integration had not merged**. Source implementation and live flag state must always be reverified.

## 3. Empirical evidence baseline — do not discard this result

The [Codex V1b recording investigation](../research/social-v1-2026-10-17-codex-v1b-empirical.md) inspected authentic `1v1_t90-deak`, `2v2_arabia`, `4v4_arabia`, `FFA_7`, pinned corpus `2d04ec6adbe871d156c108a4351448efeb08f4e6`. It reviewed 10 cases; **48,197 attributed commands, 610 source deeds and 892 track claims, all pending**. Canonical/native derived statistics matched across four fixtures after declared provenance/retention normalization; that is not exhaustive engine-state conformance. Partial decoding and original time-origin limits remain.

**No one of the six substantive social qualifications is independently executable from the examined retained command observations.** ORDER ≠ landed attack; MOVE near ally ≠ material rescue; BUILD ≠ completed structure; queue ≠ trained unit; final score/ratings ≠ historical episode-entry strength; gold infrastructure influence ≠ mined/possessed gold; battle/raid detector labels ≠ observed combat consequence. Unsuccessful **actual substantive conduct** is eligible under the approved rules, even without destruction, victory or rescue.

FFA tribute: **406 `DE_TRIBUTE` rows, 14 nonzero resource requests, 392 zero-component controls**. Case C8 at 21:56.536: donor slot 5 → recipient slot 6; requested 640 food, 783 wood, 423 gold, 500 stone = **2,346 requested**, not established receipt. The uploaded full source-witness JSON and reproduction ZIP are companions to the archived empirical report, not an engine-state execution certificate; retain them for a worker's exact case reproduction.

## 4. Five independent worker outcomes (17 October)

These are **archived research**, not activated or policy-approved code:

1. [Military/spatial/territorial audit](../research/social-v1-2026-10-17-worker-1-military-spatial.md): broad reuse of Raid V3, Skirmish V2, Engagement V4, Map Presence V8/Forward Eco and pair-direction evidence. Missing directed territorial contract, operational forward Castle witness, opponent-focus opportunity denominator and source meaning beyond commands. The active Enemy Progress method chooses one highest-progress non-teammate; this is not authoritative per-opponent enemy territory. Gold Control describes infrastructure influence, not possession.
2. [Executed-action feasibility](../research/social-v1-2026-10-17-worker-2-execution-feasibility.md): a **possible**, **not validated** replay-engine observer based on publicly documented LibreMatch/CaptureAge-style gRPC `Event.Tribute`, `EntityKilled` and entity-state patches. Before any system integration, prove compatibility with our game build, controlled success/no-op cases, source clock/identity, data completeness, reproducibility and access/license. Proposed offline observability does not imply a deployable production service.
3. [Personality](../research/social-v1-2026-10-17-worker-3-personality.md): all five axes have plausible existing measurement paths using `playstyleEngine.ts` plus qualified longitudinal context/feature adapters. Boomer and Specialist and Compact have strong foundations; Cautious moderate; Guerrilla ↔ Frontline is a narrowly qualified **military-command posture** proxy, not proven battlefield maneuver. Worker-proposed 0.65/0.35 blends, minimum 5 Battles, endpoint bands and thresholds are **unapproved candidates**.
4. [Reputation/Relationships](../research/social-v1-2026-10-17-worker-4-progression.md): source deed ledger + **six independent conduct qualification consumers** + shared historical evaluator mechanics, separately player-owned Reputation and directional Relationship. Distinct Hostility beyond ordinary warfare, true helper→beneficiary Bond, meaningful offensive and defender competition, Gallantry entry challenge, Cruelty sustained prior disadvantage, Chivalry independently noteworthy support. No inherited shadow engine numbers or new credits from overlapping facets.
5. [Chronicle/reporting](../research/social-v1-2026-10-17-worker-5-chronicle-reporting.md): reuse owner-bound Chronicle and prototypes; currently no production binding judgment service, correction workflow, privacy-safe public testimony or source-review admission. Factual Chronicle should accept eligible READY Games **before administrative Event completion**, with pending outcomes honestly unresolved. Current social history read has completed-Match and historical-limit gaps to repair. Four approved sparse source-gated judgment families, optional nonscoring notes, explicit binding, independent choice qualification, reviewable corrections and minimal visibility.

## 5. Interpretation boundary

Use a **shared source-backed observation and episode lineage**, not one detector or score per track:

1. **Authenticated factual observation** — who commanded/placed what and when, verified Game/source/roster identity.
2. **Qualified statistical inference** — bounded raid, battle, targeting, map, support *patterns*; label uncertainty and method; may inform Personality or an explicitly **non-awarding** interpersonal trend view.
3. **Independently established substantive deed** — validated executed conduct and required historical circumstances; fact that something executed still does not prove meaningfulness.
4. **Per-track qualification and award** — separately prove each Reputation/Relationship meaning; versioned Event/Battle allowance, stage, reciprocity, chronology and corrections.
5. **Chronicle** — known Battle facts + attributed selected testimony + independently qualified historical milestones. Factual history stands even with no progress.

One event may have raid, engagement, territory and support facets yet remain **one underlying deed**. Repeat commands and multiple POVs are not multiple awards. Team shared targets/co-presence never produce phantom Bond or reverse Rivalry. A→B and B→A remain separate; ordinary Relationship level 3+ needs independently qualifying, stage-specific reciprocity. Exceptional Treachery retains its strict objective rupture/king-loss proofs **plus the victim's binding 'betrayed' confirmation** and separate nonreciprocal severity/capacity rule.

## 6. Evidence signals and intended roles

| Signal | Descriptive/factual readiness | Possible credited use — separately qualified |
| --- | --- | --- |
| Directed pressure, raids, economic targeting | Existing attributed command episodes; distinguish target-controller from weaker proximity | Rivalry or Gallantry/Cruelty with execution and entry-context proof; Hostility only distinct antagonism |
| Skirmishes, technical Battles, Great Battles | Existing command-derived encounter categories; not league Battle or proven damage | Pair-specific substantive competition; do not stack nested episodes |
| Team opponent focus | Directed targets exist; comparable actual opportunity denominator absent | Do not assert selective obsession, motive or special Hostility without new proof |
| Co-attacks | Shared *opponent-specific* contributors exist | Independently qualify each competitor; Bond needs directed material aid, not a shared target |
| Defensive assists/reinforcement | Helper/base command context exists | Bond/Chivalry requires actual substantive directed beneficiary help |
| Defensive response/return pressure | Time-bound own commands and independent reverse episodes | Defender→attacker Rivalry only for substantive own counterplay; no fake reciprocity |
| Forward military/economic buildings, towers | BUILD position/type/geography observable | Specific opponent's genuine **enemy territory** and executed meaning required |
| Forward Castle near enemy starting TC | Placement and queue candidates exist | Special case requires *genuine Castle*, opponent-specific home pressure, operational completion, **that same instance's own queue within five minutes after completion**; no shortcut from placement to completion |
| Gold competition/control | Modelled time-aware infrastructure influence / contested deposit geometry | Context for competition; not standalone proof of mined gold, actual ownership or resource denial |

**Territory:** Keep existing Enemy Progress statistics untouched; add an explicitly qualified friendly/neutral/enemy classification considering **all relevant opposing/friendly team anchors** and ambiguity. Do not treat the maximum-progress opponent as proof of the targeted enemy or enemy territory. Geography owner decisions TERR-01 (team/FFA ambiguity) and TERR-02 (Castle home-pressure criterion) remain open.

## 7. Implementation plan — parallel work and dependencies

| Track / PR slice | Scope and required exit | Dependency / authority |
| --- | --- | --- |
| **A. Engine-observer feasibility POC (highest technical risk)** | Local, controlled current-build successful and nonexecuting tribute, actual kill versus deletion, complete versus cancelled building; compare observed event fields, donor/receiver balances, ownership, clock and coverage; preserve source hashes. No production hook, storage or upload slowdown. | Execution worker; external replay observer availability/license unverified. If fails, record hard no-go and a separately approved alternate proof/policy decision. |
| **B. Personality V1** | Source-backed per-Battle features for all five axes, frozen reviewed calibration, context/sample limits and Developing; one independent Battle counts once; authentic/synthetic positives, negatives, duplicate POV, corrections. | May proceed in parallel. Needs owner-approved definitions/calibration; no fake 50 or live league percentiles. |
| **C. Territorial V1** | Per-opponent friendly/neutral/enemy admission, ambiguity, forward placement/tower/Castle diagnostics, source lineage; no recalc of legacy statistics. | May proceed in parallel as design/tests; TERR-01/02 decisions before credited use. |
| **D. Factual Chronicle and reporting** | READY-source factual read independent of Match/Event closure; bounded complete history; stable incident lineage; private source-gated offers, authenticated binding submission, compatible choices, pending visibility, independent qualification, impartial corrections, sanitized testimony and UI. | May proceed in parallel with source gates closed; no routine surveys or invented effects. |
| **E. Pure conduct qualifier + historical evaluator** | Synthetic verified-input acceptance for six track consumers; Event/Battle allowances, ordered receipts, direction, independent reciprocity, weakening/peaks, Treachery and correction-safe recompute. **Synthetic input does not mean authentic source qualified.** | Can develop pure architecture/tests in parallel; numerical scores/stages require explicit owner approval. |
| **F. Actual evidence-to-social integration** | Validate each of six tracks with at least one authentic or independently observed controlled *positive* and no-op/ordinary negatives, then bind to current Game/Event and Chronicle. | **Blocked on A** and track-specific substantive/context proofs; C for territory effects; calibration/approved thresholds. |
| **G. Real-player E2E / release** | Real identities, Event/warmup eligibility, actual source and correction, privacy, five sliders, six earned tracks, bidirectional relationships, private and public Chronicle reporting, stable revisions, performance and rollback. | Separate authorization for staging, feature flags, league-visible pending evidence and deployment. |

**Recommended immediate delegation:** one **Sol Work integration owner** reconciles these reports into ordered non-overlapping PR contracts (read-only planning), **while a Codex technical worker independently tests A offline**. Other implementers can prepare B/C/D and pure E after clear slice boundaries; do not commission a second general architecture inventory. Do not claim either job is already underway merely because a prompt exists.

## 8. Owner approval register — decisions, not accidental defaults

1. **TERR-01 / TERR-02**: friendly/neutral/enemy semantics in fixed teams/FFA/ambiguous zones; exact special Castle home-pressure condition, preserving unique operational/queue witness.
2. **Personality V1**: approve game-context comparators, component taxonomy, normalized anchors, longitudinal weighting, sample/confidence/Developing gates, and narrowly named command-based Guerrilla/Frontline meaning. All numeric suggestions remain candidates.
3. **Social calibration**: actual qualifying materiality and historical-entry comparisons, numerical Reputation per player × track × Battle budgets, Relationship per Event × unordered pair × track × direction budgets, contribution strength, stage thresholds, ordinary 3+ reciprocity counts and configured maximum. No shadow-pilot values.
4. **Policy proposals, if needed**: MIL-01 selective opponent focus, MIL-02 territorial/resource deed family, or bounded aggregate-substance substitution for a missing execution witness. None approved merely by appearing in a worker report; no Hostility for routine warfare.
5. **Visibility/privacy**: pending V1a social evidence league-wide visibility, sanitized testimony visibility, owner-only Chronicle and authorized reviewer paths before activation.
6. **Release authorization**: observer licensing/security and optional source-proof retention, staging/production E2E and feature gates, separately from doc/code merge.

The owner has already approved **V1 scope and the previously recorded SOC/REL qualitative rules**, **not** any of these numbers or novel evidence equivalences. Keep SOC-089 deferred.

## 9. Next organizer action and acceptance

1. Verify current `main` and read [Core Identity](CORE-IDENTITY.md), [Current State](CURRENT-STATE.md), [approved Relationship baseline](../architecture/relationship-v1-approved-baseline-2026-10-13.md), these six archived reports and [Organiser 2 handover](ORGANISER-2-HANDOVER-2026-10-17.md).
2. Commission Sol Work **read-only** final integrated milestone/PR boundary review and Codex **offline** controlled replay-observer proof experiment in parallel. Supply empirical companion JSON/reproduction files from the project uploads, since this GitHub archive does not include those large companion bytes.
3. Review results against source-backed positives and negatives; decide only genuine policy/calibration blockers; then delegate bounded implementation PRs with independent acceptance.
4. Merge only reviewed and green code; do not deploy/activate without explicit fresh decision. Continue keeping source authority, existing League Points/War Room/Gold, Event rules and original recordings intact.

**Go/no-go:** V1 is not social-ready while any earned track lacks a proven positive/negative integration path, while the Chronicle can't handle genuine binding user reports/corrections, or while privacy and original source authority are unresolved. Do not redefine a candidate-only inference surface as completion.
