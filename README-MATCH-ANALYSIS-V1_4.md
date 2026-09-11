# Age of Friends — Match Analysis V1.4

V1.4 is an analysis-only upgrade. Do **not** reparse the replay corpus.

## Why this version exists

V1.3 proved the structural interaction model is stable across 1v1, 2v2, 3v3, 4v4, FFA/dynamic diplomacy, Nomad, and water. V1.4 moves from structural debugging into semantic validation.

### Changes

- `MATCH_ANALYSIS_V1_4` and model versions.
- Entity catalog schema `AOF_ENTITY_CATALOG_V1_1`.
- Version-pinned name/role overrides for high-value AoE2 opening entities (Villager, Lumber Camp, Barracks, Stable, Scout Cavalry, Archer, Spearman, Dock, Fishing Ship, etc.).
- Opening classification now uses entity roles instead of brittle display-name strings.
- Opening context and strategy are separated:
  - `contextTags`: no-TC, water economy, fast timing context.
  - `strategyTags`: Scouts, Archers, Drush, Men-at-Arms, tower pressure, Fast Castle monks/boom.
  - `primaryStrategy`: stable machine-readable strategy key.
  - labels compose context with plan, e.g. `No-TC → Water` or `Water → Fast Castle → Boom` rather than allowing one tag to erase another.
- Raid candidates now carry evidence quality:
  - unique target instances
  - high-confidence target commands (initial/strong-prior owner)
  - medium-confidence commands (future-backfill/consistent-producer owner)
  - pair target-focus share
  - distance from candidate centroid to target start anchor
  - `high|medium|low` confidence
- FFA raid candidates are capped at medium confidence until diplomacy mode semantics are explicitly mapped.
- Team-support candidates ignore low-confidence raid candidates.
- Diagnostics now report raw diplomacy mode counts and pair transition modes so the next pass can map dynamic ally/neutral/enemy state correctly.

## Run

The entity catalog builder changed, so regenerate the catalog once:

```bash
node scripts/build-aoe2-entity-catalog.mjs
```

Then build and run analysis against the existing canonical replay corpus:

```bash
cd functions
npm run build
cd ..

node scripts/test-match-analysis-corpus.mjs \
  replay-corpus-output \
  match-analysis-output-v1-4
```

## Return for review

Send back:

- `match-analysis-output-v1-4/match-analysis-summary.json`
- `match-analysis-output-v1-4/match-analysis-summary.md`

The key questions for V1.4 are:

1. Do Scout/Archer/etc. openings now resolve instead of generic `Fast Feudal candidate`?
2. Are no-TC and water contexts represented without overwriting the tactical plan?
3. How many raid candidates survive as **high confidence**?
4. What raw diplomacy mode values occur in the FFA, and in what transitions?
5. Do the high-confidence raid pairs look plausible enough to become Age of Friends `Raids performed / Raids suffered` evidence?
