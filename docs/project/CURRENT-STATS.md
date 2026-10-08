# Age of Friends — Current Statistics

Last reviewed: **7 October 2026**. This is the current implementation status, not a
claim that production deployment or the full player flow has been accepted.
Baseline inspected: main `1e54b4178197a552decff2d5187b3058eef41186`; launch-readiness
changes are on `fix/statistics-launch-readiness-v1` until merged.

## V1 readiness

**Battle measurement and the Battle/Event/Season presentation are implemented and
are candidates for a scope freeze.** Launch-readiness work strengthens eligibility,
coverage, identity binding and correction handling; it adds no new replay detector,
scoring policy or engine-outcome claims. A complete deployed player-flow test remains
required before launch. Production configuration/deployment has not been verified by
this audit. Automated checks cannot replace footage-based semantic qualification.

AoF should tell friends a reviewable story about their Games. Numerical comparisons
and dramatic highlights must stay tied to source Games and describe the evidence
actually available. Missing evidence is not peacefulness, incompetence or zero effort.

| Layer | Implemented state | Remaining launch boundary |
| --- | --- | --- |
| Extraction and durable evidence | Versioned CanonicalReplay, source hashes, validation, compact replay-free analysis; scoped save-68.9/build-185872 compatibility | Qualify future patches, mods and restored-game semantics separately |
| Battle measurement | Five-category models below, catalog-aware requests/placements and inferred spatial/interaction analysis | Review representative Games against actual footage |
| Upload and storage | Authenticated upload, worker result validation, participant mapping, verified canonical ZIP/statistics persistence, active revision and compact presentation | Exercise configured worker/bucket/Functions/rules together in the deployed player test |
| Battle/Event/Season UI | Shared measurements, evidence inspection, source links, curated highlights, comparison contexts and Season records | Desktop/mobile acceptance and actual upload/correction/dispute flow |
| Aggregation | Current-source reads; result/opt-out eligibility; duplicate/revision handling; transactional replacement of Season and hidden lifetime read models | Private-league scale only; broader histories need pagination/batching |
| Social interpretation | Source-qualified incident interpreter and correction-aware shadow history/Chronicle | Official scoring remains disabled; semantic qualification and production activation pending |
| Identity/playstyle | Configurable foundations and illustrative preview | No authoritative normalization, weights or portrait-progression rules |

## Active versions

Versions below are selected by current code, rather than the older September model
list. Historical implementations remain available; a newer version does not silently
rewrite an already stored canonical/statistics artifact.

| Area | Active version |
| --- | --- |
| Statistics schema / projector | schema `1.1.0`; `AOF_CANONICAL_STATISTICS_V1` |
| Compact analysis | `AOF_REPLAY_ANALYSIS_V5` |
| Build Order | `AOF_BUILD_ORDER_V2` |
| Opening / Villager workload reconstruction | `AOF_OPENING_STATISTICS_V6`; `AOF_VILLAGER_PRODUCTION_V3` |
| Economy / TC activity | `AOF_ECONOMY_STATISTICS_V5`; `AOF_TC_ACTIVITY_V2` |
| Resource commitment / 20-minute ratio | `AOF_RESOURCE_COMMITMENT_V1`; `AOF_ECO_MILITARY_COMMITMENT_20M_V1` |
| Military | `AOF_MILITARY_STATISTICS_V5` |
| Raids | `AOF_RAID_DETECTION_V3` |
| Skirmishes | Source API retains V1; active projection opts into controller-seed `AOF_SKIRMISH_DETECTION_V2`; pair evidence `AOF_SKIRMISH_PAIR_EVIDENCE_V2` |
| Engagement enrichment / unit classes | `AOF_ENGAGEMENT_STATISTICS_V4`; `AOF_UNIT_CLASS_FAMILIES_V1` |
| Map Presence / Forward Eco / relic targeting | `AOF_MAP_PRESENCE_V8`; `AOF_FORWARD_ECO_V2`; `AOF_RELIC_TARGETING_V1` |
| Execution | `AOF_EXECUTION_STATISTICS_V2` |
| Shared presentation / Season catalogue projection | `AOF_STATISTICS_EXPERIENCE_V3`; `AOF_SEASON_SHOWCASE_V2` in this readiness change |
| Social incident interpreter | `AOF_SOCIAL_INCIDENTS_V1`; shadow rules `AOF_SOCIAL_SHADOW_RULES_V1` |

Catalog selection is exact: DE build **185872** uses the retained V1_2 catalog;
other/unknown builds use historical V1_1. The new snapshot has 255 units, 308
technologies and 86 building IDs. Names, roles and base costs are reference facts,
not identification of every produced object instance or qualification for arbitrary
patches/mods. Unknown costs remain unknown. See
[the catalog contract](../replay-foundation/entity-catalog-185872.md).

## Measurements and their limits

### Opening

Build Order classification/execution, age requests and inferred age completion,
first military queue/building placement, Loom, pre-Feudal houses/walls and Villager
workload reconstruction are implemented. Age boundaries use the latest supported
request. Completion outside the recorded interval is not a published timing.
Starting population/Villager floors require the supported normal-start context;
reconstruction does not observe resource sufficiency, every cancellation or survival.

The 10-minute Villager row is **starting Villagers plus net queue requests**, not the
same model as completed Villagers at the Feudal click. Labels now make this distinction.
Dark Age action gaps and first-five-minute decoded actions are also available.

### Economy

Positive Villager/trade queue amounts, net Villager queue estimates at 10/20 minutes,
TC placement timing, TC workload/idle estimates, economy tech requests, farm/house/
camp placements, animal-target interactions, decoded market/tribute commands and
base-cost resource commitment are implemented.

Farm counts are placement commands; they do not prove completed/surviving farms or
all automatic reseeding. Zero means no classified placement observed. Unresolved
building IDs make affected classified totals unavailable in the published read model,
with the raw evidence retained. The same principle guards classified technology totals;
explicit supported Blacksmith-ID requests remain a separate metric. Commitment is not income or exact expenditure:
civilization discounts, refunds, market pricing and resource availability are not
simulated. Partial pricing cannot support a complete commitment record. An unpriced
or unclassified 20-minute ratio is unavailable. Trade/tribute Season rows require an
approved same-team ally; tribute amounts remain decoded requests, not proven receipt
net of tax or evidence of generosity/peace purchases.

### Military

Military queues, base-cost unit commitment, family composition, raw-ID summaries,
trash families, producer-selection usage, military placements and supported research
requests are implemented. Composition is **queue composition**, not a live army.
Trash covers Spear, Skirmisher and Scout/Light Cavalry/Hussar lines; civilization
technologies making another unit gold-free are not simulated. Unknown queue amounts, unresolved queues without a classified producer fallback,
and missing family data cannot establish a complete composition or dominant unit.

Army checkpoints retain gross positive, cancellation and net values separately.
The Season rows display **net queue commitment**, not surviving army value. Short
recordings cannot support later checkpoints. Checkpoint zero is valid only when the
boundary was reached and the relevant amount/price coverage supports it.

Raids, Skirmishes, Battles, Great Battles, reinforcement, defensive assists and shared
attacks are **command-derived inferred episodes**. Controller attribution uses earlier
selections without future backfill. DE no-team sentinels no longer fabricate alliances.
Automatic combat and unresolved later-created targets can be missed. Dynamic FFA
opposition is not qualified by lobby groups or declared stances. No count establishes
all actual combat, attack intent, kills, damage, battle victory or exact army size.
Battle time merges overlapping episode intervals; missing/incomplete episode chronology
is unavailable rather than zero. Allied rows require qualified ally-interaction context.

### Map Presence

Command/scout route coverage, placement range, Home/Mid-map/Forward geometry, expansion
zones, forward economy, walls/towers, enemy-base command contact and deposit-weighted
infrastructure influence are implemented. These do not prove movement, fog-of-war
vision, resource depletion or ownership. Scout coverage at five minutes requires both
supported scout attribution and a recording reaching five minutes.

**V8 removes relic possession/theft inferred from mere targeting.** Known-initial-relic
targeting commands and distinct targeted relics remain available; holding, theft,
loss, ally transfer and deposit outcomes are unavailable. Historical V4-V7 can still be
reproduced, but must not be presented as qualified possession evidence.

### Execution

Raw ACTION rate, first action, gaps, explicit control commands, inferred raid response,
conservative garrison evidence and Skirmish-context APM/economy/elevation/disengage
proxies are implemented. These are not skill grades or proof of causal response.
First-five-minute counts require the full interval. Garrison and economy tasking may
undercount later-built structures/produced units. Selection size stays Battle evidence;
it is not promoted into longitudinal player identity.

## Published values, aggregation and records

- The same final qualification pass runs after base and Season projection. Season
  enrichment cannot restore a rejected value. Legacy stored artifacts receive these
  read-model guards without changing their canonical evidence or detector counts.
- Five/ten/fifteen/twenty/thirty-minute rows require recorded duration through the
  boundary. Missing Battle/Blacksmith evidence is unavailable; complete empty evidence
  can legitimately yield zero. Unknown is never silently counted as a zero sample.
- Source publication includes the qualified Season projection immediately. Older
  READY sources lazily rehydrate from hash-verified stored statistics. Presentation
  versions advance to V3/V2; no replay re-upload is needed solely for these guards.
- Cached presentation binds source hash, recording-slot mapping, roster, teams and
  civilizations. Changed bindings cannot reuse old players' measurements. Public
  reads check authoritative documents and scope membership again and abort on a
  concurrent correction, dispute, mapping/source change or Game insertion/deletion.
- Accepted current Game results and active READY sources determine eligibility.
  Disputes, pending/void/cancelled results and context opt-outs withdraw contributions.
  Season and hidden lifetime read models rebuild as complete transactional replacements.
- Units of aggregation are eligible **Games**, preserving Battle/Game provenance.
  Current best-of-one planning makes this coincide with Battles; future multi-Game
  series must not reinterpret the existing denominator as a per-Battle mean.
- The full Season catalogue defaults to per-Game means, timing medians, categorical
  modes and explicit totals for selected additive rows. All-time only sums eligible
  additive measurements. The shared Battle/Event comparison has its own explicit
  total/average/median rules. Composition gives each nonempty eligible Game equal weight.
- Every aggregate retains sample and eligible-Game counts. Leaders require complete,
  compatible coverage and configured sample gates; unavailable Games suppress public
  recognition. Record ties retain source provenance. Context/model compatibility is
  retained; a number is a measurement distinction, not an overall player grade.
- No played-map field is yet incorporated in the comparison read model. Unknown or
  multi-map pools are isolated per Game instead of claiming cross-map timing comparability.
- Episode/detail payloads are capped (600 episodes/Game; 100 request details/player).
  Aggregate counts retain their full source totals; a truncated list is not a complete
  opportunity history. Full-league rebuilds/callable reads target a small private league.

## Reputation, relationships and identity

Player reputation is **Gallantry / Cruelty / Chivalry**. Pair relationships are
**Rivalry / Hostility / Bond**. Treachery is a gated king-loss exception, not a fourth
player currency. The older Rivalry/Enemy/Friend engine is retained for compatibility
and does not establish the new production system.

The new incident engine reconstructs declared diplomacy, initiator/response/contested
context, evidence candidates, independently gated deed families, Battle caps and
correction-aware shadow history. It powers Battle/Replay Lab review and the player
Chronicle. **Production scoring is disabled.** The default offensive/aid/king qualifier
registry is empty. Generic targeted ORDERs do not prove attack intent, valuable-target
harm or betrayal. Gallantry context, king responsibility, stronger consequence tiers,
cooling/Bond damage, title unlocks, official persistence/activation and authoritative
event expectations remain gated or pending. See
[the implementation boundary](../architecture/social-incident-implementation-v1.md).

Lifetime descriptive foundations/read models exist; Season I keeps the lifetime UI
hidden. Playstyle scoring requires an explicit rule set. Portrait direction is approved,
but family/tier/sample/change-resistance rules are unconfigured. Preview personality,
reputation and relationship values are illustrative, not live league achievements.

## Remaining launch gates

1. Merge and deploy the reviewed readiness changes with matching web/Functions/worker
   configuration; verify the configured storage/auth/rules path. This audit does not deploy.
2. Run the full player flow Mathias will test: admission/season/event → draft/Battle →
   actual recording upload → statistics/evidence → result correction/dispute → aggregate
   withdrawal/rebuild. Include retry/duplicate upload and a source mapping check.
3. Inspect representative footage against the published meanings: a current-patch
   duel, a fixed-team Game, diplomatic/naval FFA and a short recording. Existing paper
   diplomacy validation qualifies chronology, not engine effects or combat outcomes.
   The retained three-recording harness contains a paired POV; it is not evidence of
   three independent encounters. Bind uploads to the actual approved Game.
4. Verify desktop/mobile tables, evidence links, unknown/partial states and recognition
   without implying an overall best-player score. Freeze the tested V1 metric catalogue.
5. Activate social awards only after their semantic inputs and production progression
   are separately qualified. Statistics launch does not automatically clear this gate.

Automated verification and specific regression findings are recorded in
[the readiness audit](../testing/statistics-launch-readiness-2026-10-07.md).
