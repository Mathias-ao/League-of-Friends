# Map Presence V1

`AOF_MAP_PRESENCE_V1` is the player-facing spatial model for a single match. It operates only on retained canonical replay evidence and is intentionally explicit about the difference between command/building geometry and actual game-state visibility or ownership.

## Player-facing outputs

Each participant receives:

- **Command Map Coverage** — percentage of fixed 8×8-tile map cells containing at least one recorded command coordinate or endpoint from that player. This is a command-footprint statistic, not fog-of-war exploration.
- **Forward Buildings** — count of building placements at least 16 tiles from the player's home anchor and at least 4 tiles closer to a specific enemy start anchor than to home. The output retains building type, time, position and identified enemy.
- **Expansions** — later Town Center placements at least 14 tiles from the original home anchor. Placement commands within 3 tiles of an already accepted expansion hub are deduplicated. The first expansion timing and all hub positions are retained.
- **Enemy Base Found** — first strong hostile command/contact inside a reconstructed enemy economic zone. `DE_ATTACK_MOVE` and `ATTACK_GROUND` can qualify spatially; `ORDER` qualifies when it targets a known enemy-owned initial object inside that owner's economic zone. Plain movement does not qualify. Ambiguous multiplayer victims are discarded rather than guessed.
- **Gold Control** — weighted final-placement spatial influence over clustered initial gold objects. It does not mean gold gathered, remaining, denied or permanently owned.
- **First Relic Touch** — first `ORDER` or `SPECIAL` command targeting a known initial relic. It does not claim a successful relic pickup.

## Home and enemy anchors

The preferred home anchor is the centroid of the player's initial Town Center objects. If those cannot be identified, the model falls back to the centroid of all initial owned objects. Enemy anchors use the same reconstruction, and positive matching lobby team IDs are excluded from enemy selection.

## Forward-building rule

A building placement is forward when both are true:

1. distance from the player's home anchor is at least **16 tiles**;
2. the nearest eligible enemy anchor is at least **4 tiles closer** to the placement than the player's own home anchor.

The player-facing count includes all decoded building placements satisfying that geometry. Building completion, cancellation and survival are not asserted.

## Expansion rule

The original starting Town Center defines the home hub. A later Town Center placement becomes an expansion when it is at least **14 tiles** from the home anchor. Near-duplicate placements within **3 tiles** of an already accepted expansion hub are collapsed so repeated placement attempts at effectively the same expansion do not multiply the count.

## Command Map Coverage

The map is partitioned into fixed **8×8-tile cells**. A cell becomes covered for a player when a decoded action contains an in-bounds `position` or `endPosition` in that cell. Coverage is:

`covered command cells / all map cells × 100`

This deliberately does not reconstruct unit paths or line of sight. It is named **Command Map Coverage** so it can later be replaced or complemented by a true Map Explored statistic if visibility/trajectory evidence becomes available.

## Gold clustering and influence

V1 recognizes pinned neutral resource object IDs from `SiegeEngineers/aoc-reference-data@3e98c1eb4551d0704d4f73d294babcc4abcff3da`:

- Gold Mine: `66`
- Gold Rock: `841`
- Relic: `285`

Gold objects are joined into one cluster when connected by links of at most **4.5 tiles**. Each cluster is represented by the mean position of its member mines.

Player influence is additive and decays linearly to zero at the declared radius:

| Infrastructure | Weight | Radius |
|---|---:|---:|
| Town Center | 4.0 | 20 tiles |
| Mining Camp | 3.0 | 10 tiles |
| Castle/Krepost | 4.0 | 16 tiles |
| Tower/Donjon-style tower role | 2.0 | 12 tiles |
| Forward military/naval production building | 1.5 | 12 tiles |

For each cluster, raw influence scores are normalized across players. A player's final `controlSharePercent` is the sum of their normalized cluster shares divided by total recognized gold clusters. A cluster with no qualifying influence remains unclaimed, so this metric is a spatial influence proxy rather than an assertion of resource control in the game engine.

## Enemy Base Found

This model reuses the time-aware economic zones from `AOF_RAID_DETECTION_V1`: initial economic structures are active from time zero and later economic building placements extend the zone from their placement timestamp.

A strong contact must identify a single enemy victim. Targeted `ORDER` uses known initial-object ownership when the target lies inside that owner's economic zone. Strong positional attack commands use the uniquely nearest eligible enemy economic zone. If two enemy zones are within the existing two-tile victim-ambiguity margin, the event is discarded.

## Evidence boundary

Map Presence V1 does **not** claim:

- actual fog-of-war exploration;
- continuous unit positions or paths;
- building completion or survival;
- successful relic pickup;
- gold mined, denied, depleted or permanently owned;
- enemy awareness before the first qualifying strong contact.

Thresholds, object IDs, weights and radii are versioned model parameters. Historical results should remain on `AOF_MAP_PRESENCE_V1` if those parameters change in a successor model.
