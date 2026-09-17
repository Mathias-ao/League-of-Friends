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
     -> Relationships: Rivalry / Enemy / Friend
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

## 4. Relationships

Implementation: `functions/src/engines/relationshipEngine.ts`

Version: `AOF_RELATIONSHIP_ENGINE_V1`

The relationship engine supports three independent tracks:

- `RIVALRY`
- `ENEMY`
- `FRIEND`

The engine converts Pair History metrics into points and stages only when supplied an explicit versioned `RelationshipRuleSet`.

A relationship rule set defines:

- which pair-history metric contributes to which track;
- points per unit;
- optional contribution caps;
- stage ids and thresholds.

There is **no default relationship point system and no default stage system**. Without a configured rule set each track is returned as `UNCONFIGURED` with `points: null` and `stageId: null`.

This intentionally supersedes the older `RIVALRY_ENGINE_V1` direction for future product behavior. The older engine may remain temporarily for compatibility but is not authoritative for the new relationship model.

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
- Relationship point rules;
- Rivalry / Enemy / Friend stage thresholds;
- whether and how these systems interact with league points, achievements, War Room or other product systems.

## Versioning rule

Changing a Match Statistics model, longitudinal aggregation contract, slider rule set or relationship rule set must create a new version identifier. Historical outputs must remain traceable to the versions that produced them.
