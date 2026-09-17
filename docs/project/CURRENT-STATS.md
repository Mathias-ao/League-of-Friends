# Age of Friends — Current Statistics

Last reviewed: 17 September 2026

Purpose: Concise source of truth for player-facing statistics status. Technical definitions and evidence limits live in the versioned architecture/model documents.

## Statistics structure

| Section | Status | Scope |
|---|---|---|
| Match Statistics | Active / implemented | Statistics derived from one replayed Game and shown for that match. |
| Lifetime Stats | Not started | Cross-match and cross-season player totals, rates and records. |
| Relationships | Not started | Player-to-player relationship statistics and progression. |
| Individual Player Stats + Playstyle Sliders | Not started | Persistent player profile statistics and derived playstyle dimensions. |

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

## Model status

Current player-facing match models include:

- `AOF_BUILD_ORDER_V2`
- `AOF_OPENING_STATISTICS_V1`
- `AOF_RAID_DETECTION_V1`
- `AOF_MAP_PRESENCE_V2`
- `AOF_FORWARD_ECO_V1`
- `AOF_RESOURCE_COMMITMENT_V1`
- `AOF_CANONICAL_STATISTICS_V1`

All statistics must retain their evidence layer and model/rule version. Observed commands and placements must not be silently presented as completed game-state outcomes.
