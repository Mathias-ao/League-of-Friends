# Opening Statistics V1

`AOF_OPENING_STATISTICS_V1` is a replay-free player-facing projection over canonical command evidence. It does not change the canonical truth classification of the underlying replay fields.

## Player-facing Opening statistics

| Statistic | Rule |
|---|---|
| Feudal age up | first Feudal research request (`tech 101`) + 130 seconds |
| Castle age up | first Castle research request (`tech 102`) + 160 seconds |
| Imperial age up | first Imperial research request (`tech 103`) + 190 seconds |
| First military unit | first positive queued unit whose catalog roles include `land_military` or `water_military` |
| First military building | first placement whose catalog roles include `military_production` or `naval_production` |
| First wall segment | first `WALL` command, retaining timestamp, type, endpoints and rasterized tile count |
| Wall tiles before Feudal | unique wall tiles from wall commands before projected Feudal age-up |
| Wall style | `open` at 0 unique wall tiles before Castle, `partially_walled` at 1–19, `fully_walled` at 20+ |
| Houses before Feudal | House placement commands before projected Feudal age-up |
| Loom timing | first Loom research request (`tech 22`) |
| Loom before Feudal | yes when Loom request occurs before the Feudal research request; no otherwise when a Feudal request exists |

## Evidence boundary

For current player-facing policy, age research requests, queued units and building/wall placements are accepted as direct inputs. Age-up times are deterministic reconstructions using the fixed durations above. Counts of houses and unique wall tiles are deterministic reconstructions.

`wallStyle` is inferred. V1 intentionally uses wall-tile volume rather than claiming a true closed perimeter. `fully_walled` therefore means the player crossed the V1 20-tile pre-Castle wall-volume threshold; it does not prove that terrain, buildings and walls formed an airtight enclosure.

Wall segments are rasterized to integer map tiles and deduplicated before counting, so overlapping wall commands do not inflate the tile totals.

When no Feudal/Castle request exists, the relevant pre-age wall/house window extends through the observed replay interval and the output records that boundary explicitly.

Changing any age duration, military role definition, wall rasterization rule, wall-style threshold or Loom-before convention requires a successor model version if historical outputs must remain reproducible.
