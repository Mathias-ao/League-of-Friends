# Longitudinal Statistics Systems V1

Status: foundation implemented; product rules intentionally unconfigured.

## Purpose

Keep replay measurement separate from product judgment.

```text
.aoe2record
  -> ingestion / canonical replay evidence
  -> Match Statistics (observed / reconstructed / inferred)
  -> neutral longitudinal facts
     -> Lifetime Statistics
     -> Pair History
  -> configured interpretation systems
     -> Player Identity / Playstyle Sliders
     -> Player currencies: Gallantry / Treachery / Chivalry
     -> Pair relationships: Rivalry / Hostility / Bond
```

Match Statistics remain the primary statistical source. Higher layers may also consume neutral league context such as results, teams, season/event context and encounter history. They must not independently reinterpret the raw replay.

## 1. Lifetime Statistics

Implementation: `functions/src/engines/lifetimeStatistics.ts`

Version: `AOF_LIFETIME_STATISTICS_V1`

Lifetime Statistics aggregate eligible match/game statistics without assigning meaning, points or player labels.

Current aggregation covers:

- results when supplied;
- Opening: build-order counts, execution score, age timings, first military timing, walling, houses and Loom;
- Economy: resource commitment by resource and age;
- Military: raids initiated and raids against;
- Map Presence: command coverage, enemy-base timing, forward buildings, Forward Eco, expansions, gold influence and relic timing;
- Execution: command volume/rate/timing, active seconds and selection-size statistics.

Numeric values retain sample count, total, average, minimum and maximum with match/game provenance. Categorical values retain counts. Boolean values retain counts and rate.

This layer answers **what the player has done over time**, not what kind of player they are.

## 2. Player Identity / Playstyle Sliders

Implementation: `functions/src/engines/playstyleEngine.ts`

Version: `AOF_PLAYSTYLE_ENGINE_V1`

The engine accepts normalized 0-100 longitudinal metrics plus an explicit versioned `PlaystyleRuleSet`.

A slider rule defines:

- slider id and left/right labels;
- component metric ids;
- component weights;
- component direction;
- minimum sample requirements;
- whether all components are required.

There is **no default rule set**. No slider score is produced until a rule set is deliberately configured. This preserves the product-owner decision over slider definitions, weights, sample requirements and interpretation.

Career and Recent scopes are supported by the engine. The caller is responsible for supplying the corresponding normalized metric population/window.

## 3. Pair History

Implementation: `functions/src/engines/relationshipEngine.ts`

Version: `AOF_PAIR_HISTORY_V1`

Pair History is neutral, symmetric history for an unordered player pair. It records:

- total encounters;
- matches as opponents;
- matches as allies;
- opponent wins by each player;
- allied wins/losses;
- first/last meeting and contributing match ids;
- directional replay-derived signals, currently supporting raids, forward buildings, Forward Eco, enemy-base contact and a reserved ally-support signal.

Signals retain their source model versions.

Pair History answers **what has happened between the players**, not what the relationship means.

## 4. Player currencies and pair relationships

### Product direction

Two distinct rule-driven systems now sit above neutral replay/Pair History evidence.

**Player currencies:** Gallantry, Treachery and Chivalry belong to the player and are intended to be earned from tracked actions under a future explicit versioned rule set. Raid actions are intended candidates for Gallantry and Treachery; meaningful ally defense/support is an intended candidate for Chivalry. The exact action catalogue, values, caps and balancing rules are not configured.

**Pair relationship tracks:** Rivalry, Hostility and Bond belong to the persistent relationship between two players. They are separate from the player currencies and are not simple aliases for those balances. Their inputs, stages, thresholds and visibility rules are not configured.

Pair History remains the neutral evidence/history layer beneath the pair interpretation.

### Current implementation

Implementation: `functions/src/engines/relationshipEngine.ts`

Version: `AOF_RELATIONSHIP_ENGINE_V1`

The current engine predates the product split above. It still exposes `RIVALRY`, `ENEMY` and `FRIEND` and models points/stages directly on those tracks.

No rule set is currently configured, so those old tracks remain `UNCONFIGURED`. Before final player-facing relationship behavior is implemented, this engine must be migrated or replaced by a versioned successor that separates player currencies from Rivalry / Hostility / Bond pair progression.

The older `RIVALRY_ENGINE_V1` may remain temporarily for compatibility but is not authoritative for future product behavior.

## Ownership boundary

### Technical/statistical layer owns

- replay parsing and canonical evidence;
- Match Statistics;
- neutral Lifetime aggregation;
- neutral Pair History;
- rule validation, deterministic calculation and versioning.

### Product owner decides

- which playstyle sliders exist;
- slider endpoint labels;
- normalized inputs and comparison population;
- slider weights and minimum samples;
- Gallantry / Treachery / Chivalry earning rules;
- Rivalry / Hostility / Bond derivation rules and stage thresholds;
- relationship visibility and War Room progression rules;
- whether and how these systems interact with league points, achievements, War Room or other product systems.

## Versioning rule

Changing a Match Statistics model, longitudinal aggregation contract, slider rule set or relationship rule set must create a new version identifier. Historical outputs must remain traceable to the versions that produced them.
