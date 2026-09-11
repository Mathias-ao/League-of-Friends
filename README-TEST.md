# Age of Friends Replay V3 — corpus test

> **Status:** This is the structural V3 corpus guide. The extraction pass and Match Analysis V1.3/V1.4 now exist. Use [`docs/project/CURRENT-STATE.md`](docs/project/CURRENT-STATE.md) for current task routing and [`docs/architecture/replay-extraction-contract-v1.md`](docs/architecture/replay-extraction-contract-v1.md) for later extractor implementation requirements.

This bundle upgrades the replay parser from `LOF_MGZ_FAST_ADAPTER_V2` to `LOF_MGZ_FAST_ADAPTER_V3` and adds a seven-fixture corpus test harness.

## What V3 changes

The normal adapter JSON remains deliberately compact enough to keep the existing analysis path usable. In addition, `--canonical-dir` writes a `CanonicalReplay 1.0` evidence bundle:

- `canonical-replay.json` — manifest and provenance
- `facts.jsonl.gz` — one canonical parser-fact event for every retained body operation
- `terrain.jsonl.gz` — initial terrain/elevation tiles
- `initial-objects.jsonl.gz` — initial object roster, including owner, raw object ID, instance ID and position

The body event stream preserves action type/code, actor, direct player target when encoded, selected/producer object instance IDs, target instance ID, coordinates, wall endpoints, raw queue amount, technology/building/resource IDs, dynamic diplomacy, chat, camera, syncs, resignations and postgame blocks. Unknown action bytes are retained when `mgz-fast` returns `Action.ERROR`.

## Install parser dependency

From the repository root:

```bash
python -m pip install -r replay-tools/requirements.txt
```

The repository currently pins `mgz-fast==1.0.0`.

## Put the fixtures together

Create a directory such as:

```text
replay-tools/fixtures/
  1v1.aoe2record
  2v2.aoe2record
  3v3.aoe2record
  4v4.aoe2record
  FFA.aoe2record
  nomad.aoe2record
  water.aoe2record
```

## Run the corpus

```bash
node scripts/test-replay-corpus.mjs replay-tools/fixtures replay-corpus-output
```

On Windows/Git Bash, an absolute directory also works:

```bash
node scripts/test-replay-corpus.mjs "C:/Users/Manthias/AOE_league/replay-fixtures" replay-corpus-output
```

If your Python executable has another name:

```bash
PYTHON=py node scripts/test-replay-corpus.mjs replay-tools/fixtures replay-corpus-output
```

## What the harness checks

For each recording it checks:

- parser exits cleanly and reaches the end of the body;
- adapter V3 and canonical schema version are present;
- source SHA-256 agrees between artifacts;
- expected player count for `1v1`, `2v2`, `3v3`, `4v4`;
- map dimensions and `width × height == terrain record count`;
- one canonical fact record per retained body operation;
- ACTION/SYNC/VIEWLOCK/CHAT counts reconcile;
- gzip artifact SHA-256 and JSONL record counts match the manifest;
- unknown/failed action decoding is surfaced rather than hidden;
- queue commands retain signed amounts and producer object IDs where decoded;
- research commands retain producer IDs where decoded;
- build commands retain builder IDs where decoded;
- diplomacy, tribute, flare, wall and resignation evidence is counted.

The test also reports a raw-ID diagnostic for starting Town Centers (`object_id == 109`). It is only a fixture diagnostic and is deliberately **not** used as canonical entity classification.

## Outputs to share back

The important files are:

```text
replay-corpus-output/corpus-summary.json
replay-corpus-output/corpus-summary.md
```

Upload those two first. Individual fixture adapters/canonical bundles are useful only when a test fails or we want to inspect a specific action/inference.

## Expected next step

The historical next step described by the original V3 bundle has been completed through Match Analysis V1.3/V1.4. Do not introduce Gallantry, Treachery or Chivalry as product relationship tracks; the locked direction is separate Rivalry, Enemy and Friend tracks. Follow `CURRENT-STATE.md` for the next selected workstream. V1.4 analysis uses existing canonical facts and does not itself justify binary replay reparsing.
