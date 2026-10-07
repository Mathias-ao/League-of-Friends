# Entity catalog for DE build 185872

## What improves

The catalog enriches existing replay command evidence. It does not change raw
IDs, invent commands, or prove completed production, kills, damage or winners.
Diplomacy rules and scoring are unchanged.

| Reference | Historical snapshot | Build 185872 snapshot |
| --- | ---: | ---: |
| Units | 245 | 255 |
| Technologies | 194 | 308 |
| Building IDs | 40 | 86 |
| Units with role tags | 16 | 255 |

Ten new units cover Mounted Crossbowman, Varangian Guard, Hearth Troop, Jarl,
Jomsviking and their upgraded forms. Updated base costs and times come from
the pinned primary data. The technology table now also includes 107 research
entries from `data.unit_upgrades`: its keys are unit IDs, while each row's `ID`
is the research ID. These entries were omitted by the historical builder.
The ordinary technology set also reflects source additions/removals; old
snapshots are retained rather than merging removed technologies into new builds.

Locale names use `LanguageNameId + 9000` for objects and `+ 10000` for technologies,
matching the primary tree/localization data. Labels such as `CSTL`, `WAGON` and
`PTREB` become readable reference names. Unit class roles improve first-military
queue timing, military queue totals, composition, naval classification and
estimated resource commitment. The military classifier now accepts the catalog's
explicit siege role, including Castle-produced trebuchets.

Gate variants are supplementary labels only. Their base costs/times are not
copied from a different ID. Unknown costs remain unknown in cost estimates.

## Sources and admission

Primary: `SiegeEngineers/aoe2techtree`, commit
`3bb43b1439eef88dfe7fe892d7f7dc41ac9dd76f`. Its `index.html` declares update 185872.

Supplementary: `airef/airef.github.io`, commit
`9d75d03a41a81c3b573f44296a93852d5283005a`, `tables/objects.html` and the
corresponding `objectsArray` in `js/commands.js`. Only rows with `de == 1` are
admitted. Return of Rome and Chronicles arrays are excluded. Numeric string IDs
are parsed exactly; mixed-version IDs require one explicit `DE:` value. The raw
ID representation and DE admission flag remain in field provenance.

Conflicting rows are rejected. Elite Hearth Troop, Elite Jarl and Elite White
Feather Guard role tags instead follow current primary upgrade links from the
Saxons, Varangians and Shu trees. This avoids reusing stale/conflicting AIRef IDs.
AI class constants remain `referenceClass` strings; they are never inserted as
replay-observed `classId` values. Dead-object/projectile relationships are not
imported or treated as replay outcome evidence.

## Selection and migration

Automatic selection is exact: canonical `source.gameBuild == 185872` selects V1_2.
Other/unknown builds retain V1_1. Future builds need explicit review.
The compact analysis cache advances to `AOF_REPLAY_ANALYSIS_V5` to preserve
`manifest.source.gameBuild`. V3/V4 remain readable; caches missing build metadata
use the historical catalog unless an explicit catalog override is supplied.

After pulling the branch, restart Replay Lab and use **Recalculate statistics**.
Replay Lab rebuilds old analysis caches from the existing canonical bundle.
The replay need not be uploaded or parsed again for this catalog change.

To reproduce the snapshot using clones containing the pinned commits:

```sh
node scripts/build-aoe2-entity-catalog-v2.mjs \
  --primary-dir /path/to/aoe2techtree \
  --airef-dir /path/to/airef.github.io
```

The builder reads pinned Git objects even if local working files are dirty.
Without local directories it fetches the same pinned source URLs. Rebuilding
produced byte-identical output in local validation.

## Measured effect on FFA_diplo

The existing canonical fixture was reprojected with both catalogs; no replay
commands or farm counts changed.

| Observation | Historical catalog | Updated catalog |
| --- | ---: | ---: |
| Unresolved research commands | 66 across 32 IDs | 0 |
| Unresolved building placement commands | 7 across 2 IDs | 0 |
| Positive military queue amounts, all players | 2736 | 4705 |
| Wololo positive military queue amounts | 17 | 639 |
| Mihai farm placement commands | 25 | 25 |

The military increase largely recovers upgraded warships lacking role tags.
Unique units and trebuchets also move into their supported composition families.
These are encoded positive queue quantities, not completed or surviving units.
Costs remain base-catalog estimates, without scenario changes, civilization
discounts, cancellations or refunds.

## Validation

- Python suite: 255 tests, 251 passed, four explicit opt-in fixture skips.
- Node catalog, canonical consumer and Replay Lab tests: 19 passed.
- New regression checks cover build selection, explicit overrides, compact-cache
  provenance, new units, upgrades, DE filtering, mixed-version identities, elite
  link conflicts, warships versus economic ships and label-only gate variants.
- FFA aggregate corpus summary matches its existing golden exactly.
- Reprojection with the historical catalog has no metric differences from the
  pre-change FFA report; only two run-state fields reflect its later full audit.
- Original snapshot and historical statistical goldens remain unchanged.

Extraction compatibility and scenario outcome qualification remain separate
from catalog reference coverage. Existing coverage warnings are preserved.
