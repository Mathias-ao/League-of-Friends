# Age of Friends — Social Systems V2

Status: implementation foundation on `feat/relationship-pulse-v2`; scoring values intentionally unconfigured.

## Purpose

Define the shared evidence path for Player Reputation and Pair Relationships without allowing either interpretation system to redefine replay truth or numerically feed the other.

```text
CanonicalReplay
  -> Battle Statistics
  -> neutral social evidence
     -> Player deeds -> Reputation Engine V1
     -> Pair Encounter V1 -> Pair History V2 -> Relationship Engine V2
                                      -> Relationship Chronicle
                                      -> future War Room eligibility
```

The same Battle fact may be interpreted by both systems. For example, repeated qualified economic pressure from A toward B may be a Cruelty deed for A and a Hostility contribution from A toward B. A's Cruelty balance is never itself an input to the A/B Hostility relationship.

## 1. Player Reputation

Implementation: `functions/src/engines/reputationEngine.ts`

Version: `AOF_REPUTATION_ENGINE_V1`

The three player-owned tracks are:

- Gallantry
- Cruelty
- Chivalry

The engine consumes versioned `ReputationDeed` records and an explicit `ReputationRuleSet`. It has no default scoring values. With no rule set the three tracks remain `UNCONFIGURED`.

The current deed vocabulary is deliberately broader than the currently wired Battle Statistics adapter. Candidate deed types include direct contest, forward assault, Great Battle participation, repeated economic pressure, relic theft, concentrated hostility, defensive assistance, ally reinforcement, cooperative attack and material support. A deed type must not be enabled until its source evidence is qualified.

## 2. Pair Encounter V1

Implementation: `functions/src/engines/relationshipEngine.ts`

Version: `AOF_PAIR_ENCOUNTER_V1`

Pair Encounter is the chronological layer that was missing from aggregate Pair History V1. Every eligible pair in every eligible Battle receives a compact record containing:

- pair and player ids;
- Match/Event/Season provenance;
- played-at ordering;
- whether the pair were allied or opposed;
- explicit interaction coverage;
- directional social signal summaries;
- result context;
- an interaction-state classification.

Interaction states are:

- `OPPOSED_CONTACT`
- `OPPOSED_NO_CONTACT`
- `ALLIED_COOPERATION`
- `ALLIED_NO_COOPERATION`
- `ALLIED_ANTAGONISM`
- `ALLIED_MIXED`
- `UNKNOWN_COVERAGE`

### Coverage invariant

Missing social signals are never treated as proof that players ignored one another. `OPPOSED_NO_CONTACT` and `ALLIED_NO_COOPERATION` are only produced when `interactionCoverage === AVAILABLE`.

The current Functions processing path still lacks durable Battle Statistics social signals, so `processRivalries` explicitly writes `interactionCoverage: UNAVAILABLE` and no action-based pulses are manufactured yet.

## 3. Pair History V2

Version: `AOF_PAIR_HISTORY_V2`

Pair History remains the neutral, unordered pair history and preserves the previous aggregate facts:

- encounters;
- allied/opposed history;
- opponent wins by each player;
- allied wins/losses;
- first/last meeting;
- contributing Match ids;
- directional replay-derived signal totals.

V2 additionally stores:

- ordered `encounterHistory`;
- deterministic `chronicle` entries.

The Chronicle is an evidence-backed presentation read model. Its text is produced from declared encounter states, not generative narration. It may describe that players fought together, fought against one another, cooperated, showed qualifying antagonism, or had sufficient coverage with no qualifying pair interaction. It must not claim motive, emotional state, damage, kills, success or intent unless independently supported.

## 4. Relationship Pulse

A Relationship Pulse is a rebuildable interpretation of one Pair Encounter. Pulses have:

- track: Rivalry / Hostility / Bond;
- effect: Strengthen / Weaken / Dormant;
- reason;
- source and target where directional;
- evidence units;
- whether the pulse may count toward reciprocity.

No production point magnitudes are hard-coded in the pulse derivation. A future `RelationshipRuleSet` supplies the weights and caps.

### Rivalry

- Qualified directed contest may strengthen Rivalry directionally.
- If established opponents are matched against one another, interaction coverage is available, and no qualifying pair contact occurs, Rivalry receives a Dormant pulse.
- Calendar inactivity alone does not decay Rivalry.

### Hostility

- Qualified directed hostile pressure strengthens Hostility directionally.
- Opposed no-contact with available coverage may make active Hostility Dormant.
- Merely being assigned as allies never cools Hostility.
- Qualified allied cooperation emits a Hostility-weakening pulse.
- Allied non-cooperation with available coverage emits a shared Hostility-strengthening pulse.
- Shared allied non-cooperation does not count as directional reciprocity.
- Calendar inactivity alone does not decay Hostility.

### Bond

- Qualified reinforcement, defensive assistance, cooperative attacks and other enabled support strengthen Bond directionally.
- Antagonistic action emits a conditional Bond-weakening pulse.
- When the Bond was already established at the time of that antagonism, the relationship evaluator applies the configured established-Bond damage multiplier.
- Bond is not made Dormant by ordinary inactivity in V2.

## 5. Reciprocity invariant

`AOF_RELATIONSHIP_ENGINE_V2` keeps directional current balances underneath the pair presentation.

Stages one and two may be reached from one-sided development if the configured rules permit it.

**Stage three and every later stage require reciprocity as an engine invariant.** For a stage at index 2 or above:

- both players must hold positive qualifying directional progress;
- both players must meet the stage's directional-point requirement (minimum one if unspecified);
- both players must have at least one distinct reciprocity-eligible contributing encounter (or the configured higher requirement).

A shared pulse such as `ALLIED_WITHOUT_COOPERATION` can make Hostility worse but cannot satisfy this gate. Therefore a unilateral grudge or an uneasy alliance cannot become a Feud without returned directed antagonism.

## 6. Dormancy and history

Dormancy is an event-driven presentation state for Rivalry and Hostility, not deletion and not calendar decay.

A Dormant relationship retains:

- current rebuildable balance;
- historical peak stage;
- contributing encounters;
- full Chronicle.

Fresh qualifying strengthening evidence reactivates the track.

Exact future policies for Event-level aggregation and whether several Battle pulses inside one Event are capped or summarized remain to be calibrated.

## 7. Relationship Chronicle UI

The player profile now exposes a `Profile / Chronicle` sub-navigation.

The Chronicle opens as a parchment-style archive and lets the viewer select another player with whom the profile has Pair History. It shows:

- current public Rivalry / Hostility / Bond state and stage when configured;
- historical peak labels;
- dated Chronicle entries in reverse chronological order;
- the Match provenance id;
- factual explanatory text.

Internal relationship points, pulse weights and next-stage progress are intentionally not exposed.

The Chronicle remains useful while relationship rules are unconfigured because Pair History is factual history rather than a score.

## 8. Processing and persistence

The existing `RIVALRIES` processing step is retained for orchestration compatibility. On this branch it rebuilds Pair History V2 and stores top-level pair ids to make profile queries practical.

Current relationship documents contain:

```text
relationships/{pairId}
  pairId
  playerOneId
  playerTwoId
  pairHistory
    encounterHistory[]
    chronicle[]
  relationship
    pulses[]
    rivalry
    hostility
    bond
  relationshipEngineVersion
  relationshipRuleVersion
  relationshipRulesConfigured
  interactionCoverage
```

The current engine is deliberately evaluated with a null production rule set, so stages remain `UNCONFIGURED` until the product values are approved.

## 9. Current social signal vocabulary

Relationship Engine V2 can retain these directional inputs:

- RAID
- FORWARD_BUILDING
- FORWARD_ECO
- ENEMY_BASE_CONTACT
- DIRECT_ENGAGEMENT
- RELIC_THEFT
- ALLY_SUPPORT
- ALLY_REINFORCEMENT
- DEFENSIVE_ASSIST
- COOPERATIVE_ATTACK

Only signals supported by durable Battle Statistics should be marked available. Missing evidence remains unavailable rather than zero.

## 10. Tests

`functions/tests/relationship-engine-v2.test.mjs` covers:

1. allied assignment without cooperation strengthens Hostility rather than cooling it;
2. real allied cooperation cools Hostility and strengthens Bond;
3. opposed no-contact produces Dormant pulses;
4. unavailable coverage never invents avoidance or failed cooperation;
5. one-sided Hostility cannot reach level three;
6. shared allied non-cooperation cannot satisfy reciprocity;
7. antagonism against an established Bond receives the configured stronger damage multiplier.

## 11. Remaining work before activation

1. Persist the relevant Battle Statistics social evidence into the Functions processing path and change interaction coverage to `AVAILABLE` only where the required evidence is actually complete.
2. Decide the exact Battle-to-Event pulse policy: per-Battle contributions, Event summarization/caps, and repeated-rematch anti-farming rules.
3. Approve the Reputation deed catalogue and numeric rule set.
4. Approve Relationship pulse weights, caps, stage thresholds and final stage labels.
5. Decide the precise War Room unlock rule above the already-approved level-three reciprocity invariant.
6. Validate Pair Encounter classifications against real 1v1, team, asymmetric and FFA Battles before exposing configured progression.

Do not solve these gaps by guessing missing interaction evidence or by adding calendar decay back into the model.
