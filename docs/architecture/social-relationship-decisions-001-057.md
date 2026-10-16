# Age of Friends — Social and Relationship Decision Register (AOF-SOC-001–057)

Status: **57 explicitly approved product-design decisions; design only, NOT implemented or activated**  
Captured: 13 October 2026  
Repository: Mathias-ao/League-of-Friends  
Scope: Player Reputation, pair Relationships, Event accounting, exceptional Treachery, War Room challenge correction, historical recognition, Rivalry resolution.  
Next decision: **AOF-SOC-058 is pending, not approved.**

## Authority, terminology, and safety

This document is a continuity record of explicit decisions reached in the read-only mobile product-design workstream. It is not an implementation report, a numeric ruleset, permission to deploy, or approval to modify staging. If a current production/shadow implementation conflicts with these decisions, record the difference and plan a separately approved implementation; do not silently claim the decision is live.

Consult the latest docs/project/CORE-IDENTITY.md, docs/project/CURRENT-STATE.md, docs/project/PROJECT-CONTINUITY.md, docs/architecture/social-systems-v2.md, docs/architecture/contextual-social-deeds-v1.md, docs/architecture/social-incident-implementation-v1.md, and current code on main. Existing code governs **implemented behavior**, while explicit approved design decisions govern future **product direction**. Historical uploads of these project documents may be stale.

Terminology: **Event** is the league Event; **Battle** is an eligible league encounter with one or more recorded Games, not a technical inferred combat engagement. A replay file represents one Game. **Player Reputation** consists of Gallantry, Cruelty, Chivalry; **Treachery** is an exceptional, evidence-qualified historical event, not Reputation currency. Pair **Relationships** are Rivalry, Hostility, Bond, with separate directional contributions beneath pair presentation. League Points, challenge-specific War Room Points, Reputation, Gold, and Relationship state must not silently convert into one another.

A qualified deed is a source-backed fact with preserved replay/Game/Battle/Event identity, player mapping, revisions, and qualified historical chronology. Missing coverage/order is not zero or invented evidence. Every decision below is approved **as a design rule only**.

## Approved decision ledger (one entry per approval)

### Identity, event accounting, evidence, dormancy (001–011)

- **SOC-001 — Tracks and Treachery boundary.** Player Reputation = Gallantry, Cruelty, Chivalry; exceptional Treachery is a qualified event, not Reputation. Pair Relationship tracks = Rivalry, Hostility, Bond, and are separate from Reputation.
- **SOC-002 — Preserve genuine deeds, bound progression.** Preserve every genuine eligible Battle's deeds and provenance; bound ordinary progression by Event to prevent repeated-match farming. No numeric cap approved.
- **SOC-003 — Non-scoring Battles still count as evidence.** Every genuine eligible Event Battle, including additional/non-scoring warmups and helper warmups, may contribute Relationship progression independently of whether its result earns League Points, subject to qualification and Event caps.
- **SOC-004 — Directional cap scope.** Separate Event progression caps by Event × unordered player pair × Relationship track × directed contribution; A→B and B→A are distinct. This defines scope, not cap magnitudes.
- **SOC-005 — Event-bounded reciprocity.** At most one independently qualified historical reciprocity credit per Event × unordered pair × track × direction. Each direction needs its own evidence; victim impact or a copied contribution never manufactures reciprocity. Stage requirements remain separately configured.
- **SOC-006 — Separate ordinary allowances.** Strengthening and weakening have independent Event-bounded allowances for each pair, track, and direction; using one does not deplete the other.
- **SOC-007 — Qualified historical order.** Ordinary Relationship contributions are evaluated in reliably qualified historical order, respecting Event caps and preserving pre-deed state and Game provenance. Processing arrival order cannot substitute for event chronology.
- **SOC-008 — Partial chronology.** Preserve/publish qualified Battle history immediately; allow only demonstrably order-independent progression when chronology is incomplete. Defer order-dependent decisions and rebuild deterministically when evidence resolves; never invent order.
- **SOC-009 — Event-driven Dormancy.** Qualified opposed non-contact with adequate coverage may make established Rivalry/Hostility Dormant as a **status only**; do not lower progression or historical peak. Qualified engagement may reactivate. Calendar inactivity and missing coverage are not non-contact. Exact eligibility/reactivation gates still require rules.
- **SOC-010 — Actual weakening can regress stages.** Qualified ordinary weakening may lower the current Relationship stage under future thresholds. Dormancy alone cannot. Preserve qualified historical peaks and Chronicle; corrections can invalidate peaks whose source unlock is disproven.
- **SOC-011 — Historical reciprocity persists.** Valid qualified reciprocity credits survive ordinary weakening/stage regression and can count during recovery. Corrections may remove credits supported by invalid evidence.

### Exceptional Treachery and Event allowance (012–019)

For the exceptional Treachery qualification, adhere to the stricter pre-existing requirements in docs/architecture/contextual-social-deeds-v1.md: qualified mutual effective alliance; unilateral ordered rupture by responsible former ally; independently attributed subsequent hostility and victim's king loss; qualified responsibility, association, modes, mapping and provenance. Its directed **victim→responsible former ally Hostility** escalation is: from below stage 3 to stage 3, or from stage 3+ by one level up to the configured maximum. It does not confer reciprocal hostility, mutual Feud, Reputation, or a duplicate generic king-loss award.

- **SOC-012 — Exceptional effect consumes ordinary capacity.** The independently guaranteed exceptional stage transition also consumes the affected ordinary Event Hostility-strengthening allowance under a future explicit accounting rule. Do not treat it as an ordinary point award. No amount or saturation handling approved by this decision alone.
- **SOC-013 — Treachery allocation priority.** Qualified Treachery claims take priority over ordinary strengthening in the same Event/pair/direction, possibly displacing previously allocated ordinary credit. Do **not** rewrite deed chronology or erase sources.
- **SOC-014 — No displacement carry-forward.** Displaced ordinary strengthening does not become future-Event credit. Retain deeds; if Treachery evidence is invalidated, recalculate the original Event and dependent subsequent history.
- **SOC-015 — Configurable partial consumption.** Treachery consumes a configurable amount of ordinary Hostility-strengthening capacity, potentially leaving room for ordinary contributions. The exceptional stage effect is still guaranteed independently.
- **SOC-016 — Consumption unit.** Express exceptional consumption claims in configurable **ordinary Hostility progression units**, not a cap percentage. Exact amount remains unset.
- **SOC-017 — Distinct incidents create distinct claims.** Each independently qualified Treachery incident creates its own consumption claim; deduplicate supporting commands/evidence for one incident. Actual consumption remains cap-bounded.
- **SOC-018 — Hard Event ceiling.** Allocated Treachery allowance consumption cannot exceed applicable Event capacity. Preserve excess claims for audit; no negative capacity, debt or future-Event deductions. Every qualified incident retains its exceptional stage effect.
- **SOC-019 — Order within priority classes.** Within exceptional Treachery claims, allocate in qualified historical order; then allocate remaining capacity among ordinary strengthening in qualified historical order. Reserve/allocate first, then replay credited contributions at their **actual** historical moments. No invented order for ambiguous claims. This is an approved algorithm direction; full transition formula remains open.

### Ordinary and exceptional stage regression (020–029)

- **SOC-020 — Exceptional stages may later regress.** Treachery guarantees its stage effect when qualified, but later qualified ordinary weakening may lower current Hostility under future transition rules. Historical peaks and incidents remain subject to source correction.
- **SOC-021 — Exceptional stage is current standing, not ephemeral overlay.** Treachery establishes a new current directional Hostility standing; ordinary evaluation must not automatically collapse it to the older ordinary-points level. Do not fabricate points to represent the stage jump.
- **SOC-022 — Same-Event reconciliation possible.** Chronologically later qualified Hostility weakening may contribute toward regression within the Event containing Treachery, subject to its independent weakening allowance and future thresholds. Earlier cooperation cannot retroactively weaken Treachery.
- **SOC-023 — Unified Hostility regression.** The same explicit, versioned regression framework applies to ordinary and exceptionally established Hostility; no mandatory extra penalty solely for Treachery's origin.
- **SOC-024 — Cumulative weakening.** Qualified Hostility weakening accumulates across Events toward regression, under independent Event caps. No extraordinary single reconciliation deed is mandatory.
- **SOC-025 — Counterbalancing allowed.** Subsequent qualified strengthening may counterbalance accumulated unfinished weakening under chronological rules. Preserve deeds, reciprocity and independent Event allowances.
- **SOC-026 — Preserve weakening surplus.** Eligible weakening beyond a completed stage regression remains available toward further regression, subject to later counterbalancing; no double-award and no restoration of excluded/capped contributions.
- **SOC-027 — Multiple downward stage crossings.** A single Event may support multiple Hostility regressions when capped, qualified weakening satisfies all configured thresholds. No additional per-Event stage-drop limit.
- **SOC-028 — Evaluate at historical moments.** After Event allocation, evaluate every credited ordinary contribution at its qualified chronological position; record valid intermediate stage changes and peaks, even if later reversed. Corrections rebuild dependent intermediate history.
- **SOC-029 — Narrow dependency deferral.** With incomplete order, defer only allocation/progression/transitions actually dependent on it, and their downstream dependents. Independently demonstrable order-independent results may continue. Mark pending dependencies; never invent ties.

### Pending stages, challenge eligibility and historical corrections (030–041)

- **SOC-030 — Last verified standing, labeled pending.** When unresolved evidence may change current stage, display the last independently verified **historical** standing, explicitly pending—not an authoritative current stage. Chronicle still shows qualified deeds. Pending progression grants no stage-dependent rewards or eligibility.
- **SOC-031 — Suspend new current-stage actions.** If required current-stage verification is pending, suspend **new** stage-gated actions even if earlier eligibility was valid. Preserve independently verified unrelated eligibility and completed outcomes unless independently corrected.
- **SOC-032 — Already-active, originally valid challenges may continue.** A fully activated challenge whose original stage eligibility was independently verified may continue despite later **pending** current-stage verification. New actions and unaccepted invitations are not grandfathered. Historically invalid authorization is different.
- **SOC-033 — Invalidate active challenge if original authorization disproven.** A definitive qualified correction that disproves stage eligibility **at activation** invalidates a still-active challenge's competitive continuation. Block further challenge scoring/completion rewards, keep full audit.
- **SOC-034 — Revoke active challenge-specific points.** After SOC-033 invalidation, deterministically revoke/recalculate points attributable to that challenge, with original award/correction audit. Preserve genuine Battle results and independently earned League Points.
- **SOC-035 — Completed challenges also correctable.** Qualified proof that a completed challenge was never eligible invalidates its authorization-dependent challenge results and points. Recalculate with audit; do not erase real Games, valid Battle results, independent League Points or Chronicle.
- **SOC-036 — Correct even closed-Season standings.** Corrections to challenge points propagate to affected derived rankings, including closed Seasons. Preserve originally published standings as historical snapshots alongside authoritative corrected standings. Settlement remains separate.
- **SOC-037 — Correct challenge-derived titles/badges.** Titles and badges depending **solely** on War Room challenge standings follow authoritative corrected rankings, even for closed Seasons. Original recognition is retained and marked superseded. Independent achievements, League titles and physical awards unaffected by this decision.
- **SOC-038 — Public factual correction record.** Changes to War Room challenge standings-derived titles/badges require a public, traceable correction linking original and corrected standings/recognition, with appropriate evidence disclosure and no implication of misconduct. Channels/visual design unresolved.
- **SOC-039 — Direct in-app notice to both recipients.** Notify both superseded and corrected title/badge recipients with neutral factual in-app notices linked to the public correction. Push, email and broad broadcasts undecided.
- **SOC-040 — Awarded physical prize: organizer review.** A qualified correction affecting an actually awarded physical prize requires auditable human organizer review. Never automatically reclaim, transfer, replace or settle financially; remedy needs separately authorized policy/human decision.
- **SOC-041 — Undelivered physical prize: hold for review.** If corrected ranking affects an undelivered prize, hold controllable fulfillment for auditable organizer review, subject to existing obligations. No automatic reassignment, retrieval or financial settlement; human remedy authorization required.

### Hostility progression mechanics and reciprocity (042–053)

- **SOC-042 — Stage-specific downward requirements.** Configure each downward Hostility boundary independently under one versioned regression framework shared by ordinary and exceptionally established stages. Values undefined.
- **SOC-043 — Completed recovery cannot be reversed merely by netting.** Renewed strengthening may offset **unfinished** weakening/surplus, not automatically undo an already completed stage regression. Raising current stage requires separately qualified strengthening under upward rules or a qualified exceptional transition.
- **SOC-044 — Independent upward/downward boundary thresholds.** Configure ordinary Hostility strengthening and weakening requirements separately for each stage boundary. Ordinary stage 3+ reciprocity remains.
- **SOC-045 — Strengthening offsets recovery first.** New qualified ordinary Hostility strengthening first counterbalances unfinished weakening; only remaining units go toward upward progression. Each unit accounted once; past completed regressions are not automatically reversed.
- **SOC-046 — Weakening offsets strengthening first.** Symmetrically, new qualified ordinary weakening first counterbalances unfinished strengthening; remaining units go toward regression. Completed stage increases are not automatically reversed.
- **SOC-047 — Preserve strengthening surplus.** Eligible credited Hostility strengthening beyond a completed upward transition persists toward future stage gates, subject to counterbalancing, caps, reciprocity and no double credit. Never revive Treachery-displaced ordinary progression.
- **SOC-048 — Multiple upward changes per Event.** Ordinary Hostility may cross multiple upward boundaries within an Event if all configured progression and reciprocity requirements are genuinely met. No extra per-Event stage-rise limit.
- **SOC-049 — Delayed reciprocity unlocks at the later moment.** When missing independently qualified reciprocity finally arrives, reevaluate higher ordinary stage eligibility with still-valid credited progression. If all conditions hold, unlock **then**, never backdate, fabricate credits or restore counterbalanced progress.
- **SOC-050 — Reciprocity gates per ordinary stage 3+.** Rivalry, Hostility and Bond each have independently configurable, versioned historical reciprocity minimums for **both directions** at every ordinary stage 3+. Higher stages cannot bypass lower gates. Valid historical credits can satisfy multiple gates without duplicated award.
- **SOC-051 — Cross-Event reciprocity.** Opposite-direction credits may originate in different Events; same-Event mutual activity is not mandatory. Retain Event×pair×track×direction maximum-one-credit constraint.
- **SOC-052 — Reciprocity independent of progression allocation.** A genuinely qualified reciprocity-eligible ordinary deed may earn its Event-bounded historical credit even if ordinary progression is capped or displaced by Treachery. It creates neither extra units nor opposite-direction credit nor automatic stage unlock.
- **SOC-053 — Earliest qualified credit anchor.** The one directional Event reciprocity credit takes effect at the earliest **reliably ordered** eligible deed; preserve all supporting deeds. When that deed is invalidated, re-anchor to the next valid earliest deed or remove credit entirely. Uncertain order must not be guessed; stage-unlock timing may remain pending.

### Shared tracks and Rivalry's special nature (054–057)

- **SOC-054 — Shared structural engine.** Rivalry, Hostility and Bond use common mechanics for strengthening, weakening, opposing-progress counterbalancing, eligible surplus and chronological stage transitions. Qualification, weights, thresholds, Event caps, reciprocity and Dormancy are configurable independently per track. Treachery is Hostility-only. No new Bond/Rivalry signals are authorized merely by sharing the framework.
- **SOC-055 — Rivalry-specific weakening proof.** Cooperation that strengthens Bond or weakens Hostility does **not** automatically weaken Rivalry. Rivalry weakening requires independently qualified, source-backed **rivalry-specific de-escalation**. Qualified non-contact is potentially Dormancy, not progression loss.
- **SOC-056 — Directional Rivalry de-escalation.** Independently qualified Rivalry-specific de-escalation may contribute ordinary weakening in one direction even if the other player does not match it. Do not manufacture reciprocal weakening. Pair-stage outcome awaits qualification/transition rules. **This is the original SOC-056 option A**, explicitly approved despite a later alternative proposal about skill acknowledgment.
- **SOC-057 — Established Rivalry stage-3 protection.** An established Rivalry cannot regress **below level 3** through ordinary weakening until an **acknowledged skill hierarchy** has been independently qualified. Directional Rivalry weakening can accumulate before then. Qualified recognition opens the eligibility gate but does **not automatically** lower stage. Qualified corrections can invalidate the original establishment. Exact evidence standard, acknowledgement participants, thresholds and transition formula are still open.

## Proposed evaluator contract derived from approved decisions

**Proposed architecture direction, not a fully approved executable algorithm:**

1. **Qualify:** Validate canonical replay/recording evidence, eligibility of every eligible Battle including non-scoring warmups, Event/pair/track/direction identity, source revisions, chronology and distinct exceptional incidents. Preserve all qualified historical deeds regardless of later allocations.
2. **Allocate per Event and directional track:** Apply separate strengthening and weakening allowances. For directed Hostility strengthening, reserve/allocate historically ordered qualified Treachery consumption claims first, subject to the hard Event cap, then allocate remaining capacity to historically ordered ordinary deeds. Preserve requested vs actual consumption, unapplied claims, and displaced ordinary contributions. No negative budget or carry-forward. Unordered claims block only dependent outcomes.
3. **Qualify reciprocity independently:** Enforce one credit per Event/pair/track/direction, independent of ordinary points allocation. Use earliest reliable historical anchor, with correction-driven re-anchoring, cross-Event bidirectionality and per-stage reciprocity gates.
4. **Replay credited chronological history:** At each true historical moment apply ordinary strengthening/weakening, offset unfinished opposing progression before adding remaining units, track eligible surplus, check independent stage gates and reciprocity, and apply separately qualified exceptional directed stage transitions at their actual moment. Record intermediate stages, peaks, Dormancy status and qualified Chronicle evidence. No fabricated ordinary points for Treachery.
5. **Publish verification states:** Publish independent demonstrably stable results; mark ambiguous current stages as pending and label last verified standings historical. Suspend new actions dependent on unverified current stages while preserving still-active challenges validly authorized before uncertainty.
6. **Rebuild corrections:** A source correction supersedes—not double-appends—affected contributions, reciprocity anchors, dependent stages/peaks, challenge eligibility/points and affected historical standings/titles/public correction events, with idempotent processing. Physical-prize effects require human review; no automatic property/financial remedy.

**Important:** Exact netting formula and state representation, direction-to-pair stage aggregation, cap amounts, thresholds, contribution weights, precedence at unresolved ordering positions, rule migrations, and full acceptance criteria still need approval. The stage 3 Rivalry protection is an additional track-specific gate on top of the common evaluator, not a blanket change to Hostility/Bond.

## Known current-implementation differences (do not silently activate)

- Current docs/architecture/social-systems-v2.md describes Relationship Engine V2 pulses and a configurable but unactivated scoring/rule foundation; the normal processing path has been documented with unavailable interaction coverage. Verify latest main before coding.
- docs/architecture/social-incident-implementation-v1.md describes a **shadow pilot** with illustrative hard-coded stage/budget values, not approved production values. It currently describes an exceptional Treachery bypass of ordinary caps, which **conflicts with SOC-012–019's new shared allowance consumption** and must be intentionally redesigned in a successor version. Do not adopt shadow defaults as policy.
- Existing War Room implementations have legacy qualification and scoring paths. SOC-030–041 are future authorization/correction policy, **not** an instruction to retroactively mutate live challenge points, leaderboard, historical titles, notifications, or prizes.
- There is no approved production threshold catalog or live Treachery evidence qualification from real replays. Missing required configuration must remain unavailable/unconfigured, not guessed.
- Keep the separate Firebase staging project and its E2E environment untouched absent new explicit implementation authorization.

## Open design decisions / non-decisions

**Immediate next question — AOF-SOC-058: Who must acknowledge skill hierarchy for Rivalry?**  
Option A (previously recommended, **NOT approved**): One player's independently qualified acknowledgment that the opponent is superior opens the hierarchy gate; no matching acknowledgment needed.  
Option B (**NOT approved**): Both players independently acknowledge the same skill hierarchy before the gate opens.  
Neither acknowledgment option is currently approved. Acknowledgment itself still does not automatically reduce stage 3 under SOC-057.

Other significant open issues: how acknowledgment is source-qualified and whether a player-authored acknowledgment is an admissible league source; whether Rivalry de-escalation before acknowledgement can accumulate but not regress below floor; exact Rivalry stage behavior above level 3; Bond/Rivalry weakening signal catalogs; directional-to-pair stage presentation; track-specific strengthening/weakening weights, numeric Event allowances and caps, numeric stage/reciprocity thresholds, exceptional Treachery consumption unit magnitude and complete stage-transition formula; how to handle ambiguous equal-time or partially ordered claims beyond SOC-029; Dormancy qualification/reactivation requirements; rule version migration; pending-state UI/timeouts; notification visual/channel policy; organizer settlement/remedies. **Do not invent values or treat these as approved.**

## Suggested acceptance matrix for later implementation (not authorization)

- Non-scoring helper warmup contributes genuine evidence but not extra League Points; Event caps remain directional and track-specific.
- A→B and B→A contribute separately, and independent cross-Event reciprocity qualifies without duplicating victim-impact deeds.
- Multiple hostile deeds in one Event produce at most one eligible reciprocity credit per direction, anchored at earliest reliably ordered deed; re-anchor after correction.
- Treachery later qualified after earlier ordinary hostility: priority displaces ordinary progression without reordering history; cap saturation creates no debt; exceptional stage effect still applies; independent reciprocity remains possible for qualifying ordinary deeds even if displaced.
- Several distinct exceptional Treachery incidents create distinct capped consumption claims and distinct qualified chronological stage effects.
- Qualified later cooperation in same Event can begin Hostility recovery after Treachery; current stage doesn't collapse automatically. Completed stage changes remain in historical record when later reversed; event caps and no-double-counting hold.
- Symmetric opposing-progress offsets, surplus retention, multiple boundary crossings, and independently checked stage-3+ reciprocity gates.
- Partially unordered claims defer only dependent allocation/stage/eligibility, still display qualified factual deeds and independent confirmed results. Pending stage does not become authoritative via fallback historical display.
- Stage-gated new challenge denied while pending; already-active valid challenge continues under mere uncertainty; corrected invalid original authorization invalidates both active and completed challenge-specific rewards with deterministic standings and titles rebuild, while preserving independent Battle/League results.
- Superseded champion has neutral correction record and both affected players notified in-app; physical awarded prize triggers human review, undelivered fulfillment hold subject to obligations; no automated recovery/settlement.
- Established level-3 Rivalry remains protected below stage 3 absent independently qualified acknowledged skill hierarchy, even when directional de-escalation evidence accumulates.
- Source corrections/replays/retries yield identical idempotent projections, without phantom stages, double awards, silently reissued notices or edits to unrelated scopes.

## Workstream status and next steps

This is a product specification and handover for continuation in a **new chat**. No code changes, test runs, feature-flag activations, Cloud Function invocations, Firebase mutations, staging work, E2E work or deployments are authorized by it. Use the companion handover in docs/project/social-systems-chat-handover-2026-10-13.md. Continue one bounded decision at a time. Before any implementation, ask for explicit approval of scope and verify latest GitHub main against this decision register.
