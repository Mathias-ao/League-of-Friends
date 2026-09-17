# Map Presence V2

`AOF_MAP_PRESENCE_V2` is the current player-facing spatial model for a single match. It succeeds `AOF_MAP_PRESENCE_V1` without changing historical V1 definitions.

## Unchanged outputs

V2 keeps the V1 definitions for:

- **Command Map Coverage** — percentage of fixed 8×8-tile map cells containing recorded command coordinates/endpoints. It remains a command-footprint statistic, not fog-of-war exploration.
- **Gold Control** — weighted spatial influence over clustered initial gold objects. The influence weights/radii and pinned gold/relic object reference version remain unchanged from V1.
- **First Relic Touch** — first `ORDER` or `SPECIAL` command targeting a known initial relic; not proof of successful pickup.

## Enemy Base Found

Enemy Base Found no longer requires hostile interaction.

A player finds an enemy base when a recorded command coordinate or endpoint comes within **14 tiles** of an eligible enemy's **starting Town Center anchor**. `MOVE`, rally/pathing-style commands, attack commands and other spatial commands can therefore trigger the statistic; hostility is irrelevant.

The output retains the time, enemy player, command type, command coordinate and distance to the enemy starting Town Center. In multiplayer, if two enemy starting Town Centers are effectively indistinguishable at the contact point (within the existing **2-tile ambiguity margin**), the event is discarded instead of guessing the enemy.

This remains an inference. A command destination near an enemy Town Center does not prove that a unit reached the point or that the player actually obtained fog-of-war vision there. The 14-tile threshold is a versioned base-proximity proxy that can later be replaced by a true visibility model.

## Forward Buildings

A decoded building placement is a **Forward Building** when both are true:

1. the placement is within **40 tiles** of the nearest eligible enemy starting Town Center;
2. the placement is at least **6 tiles closer to that enemy starting Town Center than to the player's own starting Town Center**.

There is no separate minimum distance from home in V2. The output retains the identified enemy, building type, placement time, position, distance from the player's starting Town Center and distance to the enemy starting Town Center.

Building placement is the model input; completion, cancellation and survival are not asserted.

## Expansions

The player's starting Town Center defines the home hub. A later Town Center placement is an **Expansion** when it is at least **30 tiles** from the starting Town Center anchor.

Placements within **3 tiles** of an already accepted expansion hub remain deduplicated to avoid repeated placement attempts multiplying the count. The player-facing output retains expansion count, first expansion timing and each accepted hub position.

If a starting Town Center anchor cannot be identified, TC-relative V2 statistics are not inferred from the generic owned-object-centroid fallback.

## Gold Control interaction with V2 forward buildings

Gold Control keeps its V1 influence weights and cluster logic. Where military/naval production receives the `forward_military` influence contribution, V2 uses the new Forward Building rule above: within 40 tiles of the enemy starting Town Center and at least 6 tiles closer to enemy than home.

## Evidence boundary

Map Presence V2 does **not** claim:

- actual fog-of-war exploration or visibility;
- continuous unit positions or successful arrival at command destinations;
- completed or surviving buildings;
- successful relic pickup;
- gold mined, denied, depleted or permanently owned.

All thresholds are model parameters. Any future change to the 14-tile enemy-base radius, 40/6 forward-building rule, 30-tile expansion rule, command coverage grid, gold influence model or relic-touch semantics requires a successor version if historical outputs must remain reproducible.
