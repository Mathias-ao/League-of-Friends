# CanonicalReplay extraction and conformance

Read [the milestone audit](../docs/architecture/canonical-v1-conformance-milestone.md) for the verified scope and remaining research. This exporter uses `mgz-fast==1.0.0`, CanonicalReplay **1.1.0** and compatibility adapter **V4**. The original 1.0.0 schema remains under `schemas/`; old canonical bundles lack evidence required by the new conformance profile and are not silently upgraded.

```bash
python -m pip install -r replay-tools/requirements.txt
python replay-tools/parse_replay.py replay.aoe2record --canonical-dir output/new-run --out output/adapter.json
# Replay Lab development fast path:
python replay-tools/parse_replay.py replay.aoe2record --canonical-dir output/lab-run --out output/lab-adapter.json --seal-mode fast
python replay-tools/canonical_run.py output/lab-run --full-audit
python replay-tools/canonical_run.py output/new-run
python replay-tools/canonical_run.py output/new-run --out output/command-projection.json
python replay-tools/analysis_dataset.py output/new-run --out output/analysis.json
python replay-tools/statistics_registry.py --out output/statistics-eligibility.json
python replay-tools/statistics_projector.py --analysis output/analysis.json --out output/statistics.json
```

All commands after extraction need no replay and do not import the decoder. Normal parser CLI extraction defaults to exhaustive full conformance. `--seal-mode fast` is reserved for the Replay Lab development path and writes state `sealed_local_fast`; `canonical_run.py <bundle> --full-audit` performs exhaustive conformance and upgrades it to `verified_local`. The first plain `canonical_run.py` invocation verifies the bundle; `--out` also projects the compatibility command report and `AOF_COMMAND_FUNDAMENTALS_V2`. Projection envelope V2 separates age-advance request candidates from unavailable `AgeAdvanceStarted`, observed `AgeReached` and projected completion facts. Artifact hashes, all chunks and schemas are checked before projection. Use a fresh bundle directory for each run. A framing failure writes diagnostic evidence, exits unsuccessfully, and must not be ingested as complete. Invalid headers or required fields fail publication and leave the input intact.

The compact `AOF_REPLAY_ANALYSIS_V1` dataset is a rebuildable analysis cache, not canonical evidence. It removes raw operation byte payloads while retaining canonical source event IDs, decoded action fields, initial objects, coverage and source hashes. Statistics can therefore iterate over `analysis.json` without reopening the replay or rescanning Base64-heavy canonical facts. CanonicalReplay remains the lossless source of truth.

The statistics commands also need no replay. `statistics_registry.py` materializes `AOF_STATISTICS_ELIGIBILITY_V1` from all 320 source-matrix rows. `statistics_projector.py` validates `AOF_CANONICAL_STATISTICS_V1`, adds raw-ID-preserving reference catalog labels and keeps request/placement facts distinct from game outcomes. See the [statistics milestone](../docs/architecture/canonical-statistics-v1.md).

Omitting `--canonical-dir` preserves the compact-only administrative/debug call. It uses the canonical event projector but creates **no durable evidence bundle**. The normal authenticated upload path, durable storage, deletion gate and backend ingestion of adapter V4 are not implemented here. The existing derived-stat backend supports only adapters V1/V2; do not relabel V4 data to bypass that gate.

## Tests

Local verification uses Python 3.12 and Node 24.19.0. The Node test loads the existing TypeScript analysis engine through Node's type stripping.

```bash
python -m unittest discover -s replay-tools/tests -v
node --test scripts/test-canonical-artifacts.mjs
```

The Python suite includes corruption/truncation, schema/invariant failures, repeat extraction, unknown bytes, rectangular maps, exact directed command ordering and replay-unavailable projection. The synthetic header is explicitly a test double; body wire layouts pass through the pinned decoder. CI runs these tests. Missing real recordings appear as named skips, never synthetic replacements.

Real fixture names and SHA-256 values are in `tests/fixtures.json`. Place them in a local ignored folder and run:

```bash
AOF_REPLAY_FIXTURE_DIR=replay-fixtures AOF_REPLAY_OUTPUT_DIR=canonical-test-output python -m unittest discover -s replay-tools/tests -v
```

The output root must not already contain those canonical run directories. Omit `AOF_REPLAY_OUTPUT_DIR` to use temporary test output. The reviewed recordings are committed under `replay-fixtures/`: the user-supplied sources are public with owner authorization, and the upstream duel retains its exact upstream provenance in `tests/fixtures.json`. The complete initial synthetic golden and real-fixture semantic snapshots are committed under `tests/goldens/`.

```bash
python replay-tools/conformance.py output/new-run --compare replay-tools/tests/goldens/townbell-ffa-save68.json
python replay-tools/conformance.py output/new-run --write-snapshot candidate-golden.json
```

Review candidate changes and declare the parser/schema/model migration before updating a golden. The snapshot CLI never silently blesses changes. Whole-store semantic hashes detect changes even when aggregate counts stay the same; the synthetic golden permits field-level JSON Pointer diffs. Raw source bytes are checked separately from decoded semantics.

Two recordings of the same Game remain separate evidence sources. Compare a reviewed pair without merging provenance or recorder-local camera/chat evidence:

```bash
python replay-tools/paired_conformance.py output/pov-a/canonical output/pov-b/canonical --compare replay-tools/tests/goldens/user-duel-two-pov.json
```

Create a privacy-minimized report across several canonical bundles:

```bash
python replay-tools/statistics_corpus.py \
  --bundle ffa=output/ffa/canonical \
  --bundle duel=output/duel/canonical \
  --out output/statistics-corpus.json
```

The existing corpus commands remain available and now read every verified chunk:

```bash
node scripts/test-replay-corpus.mjs replay-fixtures replay-corpus-output
node scripts/test-match-analysis-corpus.mjs replay-corpus-output match-analysis-output
```

The second command normally uses the built `functions/lib/engines/matchAnalysis.js`. For local Node type-stripping verification of the unchanged engine, set `AOF_ANALYSIS_ENGINE=functions/src/engines/matchAnalysis.ts`. The optional analyzer is inferred analysis, not a canonical fact source or result resolver.
