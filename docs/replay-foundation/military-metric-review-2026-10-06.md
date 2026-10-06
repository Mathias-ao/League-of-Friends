# Military metric review: FFA_diplo, 6 October 2026

## Findings and corrections

The source remains the hash-pinned FFA_diplo fixture. It was extracted afresh
with fast sealing, converted to analysis V5, and projected before and after
these changes. No extraction layout, catalog, raw command or diplomacy scoring
rule changed in this repair.

### Army commitment checkpoints

These measure cumulative positive military queue amounts multiplied by base
catalog costs through 10:00/15:00/20:00; decoded cancellation values are separate.
They do not measure a standing army. All eight 10-minute values are correctly
zero: the first positive military queue request belongs to Bot(Halvar) at
832516 ms (13:52.516). At 15 minutes his gross commitment is 360; at 20 minutes
it is 1505. Most other players begin their military queues later.

The real defect was shorter recordings: a checkpoint beyond the recorded
interval previously returned zero or a prefix subtotal. It now returns null
and `coverageStatus=recording_ends_before_checkpoint`. Reached checkpoints
report partial amount/price coverage explicitly where relevant.

### Composition and trash

The current catalog resolves the fixture's queue IDs and supplies role tags.
Composition remains a cumulative queue mix, not live army composition. Group
and trash totals are unchanged in this repair. Mihai has 25 spear-line requests
and Zortopos 452; the other players have no requests in the three supported
trash families. Trash means Spear, Skirmisher and Scout/Light Cavalry/Hussar
lines, not all units temporarily made gold-free by civilization technologies.

Raw unit labels describe encoded IDs. They do not simulate how an upgrade
changes the appearance/type of already-created units.

### Engagements and raids

DE's raw team encoding is `0=empty`, `1=no team`, `n>1=team n-1`.
Reference: aoc-mgz commit `9c1e9cc93998887a56f336dc4489555f4ad5577a`,
`mgz/summary/teams.py` and `mgz/model/__init__.py`.

All eight participants have raw team value 1. Detectors previously treated
that as a shared alliance, suppressing the opponent relationships. A separate
`AOF_DE_LOBBY_TEAM_CONTEXT_V1` statistics context now removes non-team sentinels
from grouping. The retained canonical data and MatchFacts raw lobby values
remain intact. Actual team values still group together. Hand-authored inputs
without DE build provenance retain their existing convention.

The legacy skirmish detector also seeded targeted ORDER commands using only
initial-object ownership. Most later-created ships/armies were therefore
invisible as targets. Statistics now opt into `AOF_SKIRMISH_DETECTION_V2`, which
resolves a target's controller from initial ownership and earlier recorded
selection commands at the order's time/ordinal. Future selections cannot
backfill earlier seeds. The default V1 API remains available, and its episode
compatibility tests are unchanged. Spatial and episode-link thresholds stay
the same; count changes are explicitly versioned.

Measured examples after both fixes:

| Player | Battle candidates before | Battle candidates after | Raids suffered before | Raid candidates suffered after |
| --- | ---: | ---: | ---: | ---: |
| TURK | 0 | 6 | 0 | 1 |
| Mihai | 0 | 35 | 0 | 12 |
| Wololo | 0 | 7 | 0 | 3 |
| Zortopos | 0 | 33 | 0 | 6 |

These are inferred command episodes, not validated engine combat outcomes.
The unlocked diplomacy timeline still lacks effective-stance qualification.
Lobby non-membership cannot prove hostility after an alliance change. Naval
raids against later-created economic units can still be missed where target
type is unknown; observed control does not establish a unit's type. Automatic
combat without qualifying commands is also outside these detectors. Do not
interpret an episode count as kills, damage, all actual battles or scored
betrayals. Allied-support/deed scoring stays unqualified where it was pending.

### Raw Unit Queue Summary and display

The review matrix previously expanded raw ID dictionaries into differently
populated rows, producing many blank cells. It now renders one aligned,
multiline summary per player and explicitly shows `None observed` for an empty
summary. The stored dictionary remains unchanged. Cancellation-only unit IDs
are now retained as `+0 / -N` instead of disappearing from the evidence.

Unattached TownBell columns are hidden in the military matrix. Catalog version
is visible in the run header, and the matrix explains queue-based definitions.

## Compatibility and verification

Recalculate statistics after pulling and restarting Replay Lab; the existing
canonical bundle is sufficient. Schema 1.1.0 and metric keys remain compatible.
Checkpoint nulls are intentional unavailable values and render as a dash.

The controlled golden changes are restricted to six short-recording checkpoint
values (zero to null), four skirmish-version fields and two scope/version fields.
No unrelated historical golden is regenerated.

Tests cover DE no-team versus real teams, raw-data preservation, no future
controller backfill, allied-target rejection, short recording checkpoints,
cancellation-only queues, aligned summary rendering and attached-control
columns. Existing V1 episode compatibility tests remain passing.
