# Longitudinal Statistics Systems

Status: measurement foundation implemented; social interpretation successor implemented on `feat/relationship-pulse-v2`; production rules intentionally unconfigured.

## Purpose

Keep replay measurement separate from product judgment while allowing several interpretation systems to consume the same neutral evidence.

```text
.aoe2record
  -> ingestion / canonical replay evidence
  -> Battle Statistics (observed / reconstructed / inferred)
  -> neutral longitudinal facts
     -> Lifetime Statistics
     -> Pair Encounter / Pair History
  -> configured interpretation systems
     -> Player Identity / Playstyle Sliders
     -> Player Reputation: Gallantry / Cruelty / Chivalry
     -> Pair Relationships: Rivalry / Hostility / Bond
```

Battle Statistics remain the primary statistical source. Higher layers may also consume neutral league context such as results, teams, season/event context and encounter history. They must not independently reinterpret the raw replay.

Reputation and Relationships are siblings, not parent/child systems. The same Battle evidence may contribute to both, but Reputation balances never feed Relationship balances and Relationship balances never feed Reputation.

## 1. Lifetime Statistics

Implementation: `functions/src/engines/lifetimeStatistics.ts`

Version: `AOF_LIFETIME_STATISTICS_V1`

Lifetime Statistics aggregate eligible match/game statistics without assigning meaning, points or player labels. Numeric values retain sample count, total, average, minimum and maximum with provenance. Categorical values retain counts. Boolean values retain counts and rate.

This layer answers **what the player has done over time**, not what kind of player they are.

## 2. Player Identity / Playstyle Sliders

Implementation: `functions/src/engines/playstyleEngine.ts`

Version: `AOF_PLAYSTYLE_ENGINE_V1`

The engine accepts normalized 0-100 longitudinal metrics plus an explicit versioned `PlaystyleRuleSet`. There is no default rule set. No slider score is produced until a rule set is deliberately configured.

## 3. Pair Encounter and Pair History

Implementation: `functions/src/engines/relationshipEngine.ts`

Versions:

- `AOF_PAIR_ENCOUNTER_V1`
- `AOF_PAIR_HISTORY_V2`

Pair Encounter is the chronological neutral record for one unordered player pair in one eligible Battle. It records whether they were allied or opposed, explicit interaction coverage, directional social signals, result context and a declared interaction state.

Pair History V2 aggregates the long-term neutral history while retaining the ordered encounter ledger. It records:

- total encounters;
- Battles as opponents;
- Battles as allies;
- opponent wins by each player;
- allied wins/losses;
- first/last meeting and contributing Match ids;
- directional replay-derived signal totals;
- ordered Pair Encounters;
- deterministic Chronicle entries.

Signals retain source model versions. Missing coverage remains unavailable rather than becoming a guessed zero or inferred non-interaction.

Pair History answers **what has happened between the players**, not what the relationship means.

## 4. Player Reputation

Implementation: `functions/src/engines/reputationEngine.ts`

Version: `AOF_REPUTATION_ENGINE_V1`

Gallantry, Cruelty and Chivalry belong to the player. They are earned from tracked deeds under an explicit future versioned rule set.

The engine defines the rule-validation and deterministic projection contract but supplies no production point values, thresholds or caps. With no rule set, all three tracks return `UNCONFIGURED`.

## 5. Pair Relationships

Implementation: `functions/src/engines/relationshipEngine.ts`

Version: `AOF_RELATIONSHIP_ENGINE_V2`

Rivalry, Hostility and Bond belong to the persistent relationship between two players. Relationship V2 interprets chronological Pair Encounters as rebuildable **Relationship Pulses** rather than flattening the entire pair history before interpretation.

Pulses may Strengthen, Weaken or mark Rivalry/Hostility Dormant. Current product invariants are:

- calendar inactivity does not itself decay a relationship;
- opponent non-contact may create Dormancy only when interaction coverage is sufficient;
- merely being assigned together as allies does not cool Hostility;
- qualified allied cooperation may strengthen Bond and cool Hostility;
- allied non-cooperation with sufficient coverage may worsen Hostility;
- antagonism against an established Bond receives a stronger configurable Bond penalty;
- relationship stage three and above requires directional reciprocity from both players;
- shared pair-level pulses cannot satisfy the reciprocity gate by themselves;
- historical peaks and the Chronicle remain after Dormancy/cooling.

No production pulse weights, caps or stage thresholds are configured yet. The engine remains `UNCONFIGURED` until the product rule set is deliberately supplied.

See [`social-systems-v2.md`](social-systems-v2.md) for the detailed contract.

## 6. Relationship Chronicle

The Chronicle is a deterministic presentation of Pair History, not a generated story layer. It preserves dated turning points with Battle provenance and factual wording derived from declared encounter states.

The player profile exposes the Chronicle as a parchment-style archive. Internal relationship points and next-stage thresholds remain hidden from the player-facing surface.

## Ownership boundary

### Technical/statistical layer owns

- replay parsing and canonical evidence;
- Battle Statistics;
- neutral Lifetime aggregation;
- Pair Encounter and Pair History;
- Chronicle fact generation;
- rule validation, deterministic calculation and versioning.

### Product owner decides

- which playstyle sliders exist;
- slider endpoint labels;
- normalized inputs and comparison population;
- slider weights and minimum samples;
- Gallantry / Cruelty / Chivalry earning rules;
- Rivalry / Hostility / Bond pulse weights, caps and stage thresholds;
- final relationship labels and visibility;
- Event-level pulse aggregation/caps;
- War Room progression rules;
- whether and how social systems interact with achievements, presentation or matchmaking preference.

## Versioning rule

Changing a Battle Statistics model, longitudinal aggregation contract, Reputation rule set or Relationship rule set must create a new version identifier. Historical outputs must remain traceable to the versions that produced them.
