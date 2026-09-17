# Age of Friends — Current Statistics

Last reviewed: 17 September 2026

Purpose: Concise source of truth for player-facing statistics status. Technical definitions and evidence limits live in the versioned architecture/model documents.

## Statistics structure

| Section | Status | Scope |
|---|---|---|
| Match Statistics | Active / implemented | Statistics derived from one replayed Game and shown for that match. |
| Lifetime Stats | Foundation implemented | Neutral cross-match aggregation is implemented; persistence and player-facing presentation are not yet integrated. |
| Relationships | Foundation implemented; rules pending | Neutral Pair History and a versioned Rivalry/Enemy/Friend rule engine exist. Points and stages are intentionally undefined. |
| Individual Player Stats + Playstyle Sliders | Foundation implemented; rules pending | Versioned slider calculation exists. Slider definitions, normalization, weights and thresholds are intentionally undefined. |

## Match Statistics

Match Statistics are grouped into five player-facing categories.

### Opening

- Build Order: Drush, Scout Rush, Archer Rush, Tower Rush, Fast Castle, Boom, Naval Rush, Fish Boom, or N/A.
- Build Order execution score.
- Feudal, Castle and Imperial click + reconstructed age-up timing.
- First military unit queued.
- First military building placed.
- First wall segment.
- Unique wall tiles before Feudal.
- Wall style: Open / Partially Walled / Fully Walled.
- Houses before Feudal.
- Loom timing.
- Loom before Feudal: Yes / No.

### Economy

- Resource commitment: Food, Wood, Gold, Stone and total.
- Resource commitment by age: Dark, Feudal, Castle and Imperial.

Resource commitment is a reconstructed estimate from priced queue requests, research requests, building placements and wall tiles; it is not exact engine spend.

### Military

- Raids initiated.
- Raids against the player.
- Raid episode details: opponent, start/end timing and supporting command evidence.

Raids are inferred hostile-command episodes inside reconstructed economic zones; they do not assert damage or kills.

### Map Presence

- Command map coverage.
- Enemy base found timing, including first contact by enemy.
- Forward buildings: count, first timing and building types.
- Forward eco: count, first timing and eligible economic building types.
- Expansions: distant Town Center placements and first timing.
- Gold control: weighted spatial influence over supported neutral gold clusters.
- First relic touch.

Map Presence is based on command/building geometry and does not assert fog-of-war visibility, resource gathering or permanent territorial control.

### Execution

- Total observed commands.
- Command rate per observed minute.
- First command timing.
- Commands in the first five observed minutes.
- Active seconds.
- Raw command-type breakdown.
- Average selection size.
- Median selection size.
- Maximum selection size.
- Raw formation modes used.

## Lifetime Stats

`AOF_LIFETIME_STATISTICS_V1` aggregates eligible Match Statistics without assigning player identity or points. It covers the current Opening, Economy, Military, Map Presence and Execution outputs, retaining sample counts and record provenance.

## Relationships

`AOF_PAIR_HISTORY_V1` records neutral pair history: encounters, ally/opponent history, results and directional replay-derived interactions.

`AOF_RELATIONSHIP_ENGINE_V1` supports independent Rivalry, Enemy and Friend tracks, but returns them unconfigured until an explicit versioned point/stage rule set is supplied.

## Individual Player Stats + Playstyle Sliders

`AOF_PLAYSTYLE_ENGINE_V1` accepts normalized longitudinal metrics and an explicit versioned slider rule set. No default sliders, weights, thresholds or comparison population are defined.

## Model status

Current models include:

- `AOF_BUILD_ORDER_V2`
- `AOF_OPENING_STATISTICS_V1`
- `AOF_RAID_DETECTION_V1`
- `AOF_MAP_PRESENCE_V2`
- `AOF_FORWARD_ECO_V1`
- `AOF_RESOURCE_COMMITMENT_V1`
- `AOF_CANONICAL_STATISTICS_V1`
- `AOF_LIFETIME_STATISTICS_V1`
- `AOF_PAIR_HISTORY_V1`
- `AOF_PLAYSTYLE_ENGINE_V1`
- `AOF_RELATIONSHIP_ENGINE_V1`

All statistics and interpretations must retain their evidence/model/rule versions. Match measurement is separated from player-identity and relationship judgment.
