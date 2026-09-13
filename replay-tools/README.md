# CanonicalReplay extraction and conformance

Read [the milestone audit](../docs/architecture/canonical-v1-conformance-milestone.md) for the verified scope and remaining research. This exporter uses `mgz-fast==1.0.0`, CanonicalReplay **1.1.0** and compatibility adapter **V4**. The original 1.0.0 schema remains under `schemas/`; old canonical bundles lack evidence required by the new conformance profile and are not silently upgraded.

```bash
python -m pip install -r replay-tools/requirements.txt
python replay-tools/parse_replay.py replay.aoe2record --canonical-dir output/new-run --out output/adapter.json
python replay-tools/canonical_run.py output/new-run
python replay-tools/canonical_run.py output/new-run --out output/command-projection.json
```

The latter two commands need no replay and do not import the decoder. The first verifies the bundle; `--out` also projects the compatibility command report and fundamentals. Artifact hashes, all chunks and schemas are checked before projection. Use a fresh bundle directory for each run. A framing failure writes diagnostic evidence, exits unsuccessfully, and must not be ingested as complete. Invalid headers or required fields fail publication and leave the input intact.

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

The output root must not already contain those canonical run directories. Omit `AOF_REPLAY_OUTPUT_DIR` to use temporary test output. The supplied FFA recording is not redistributed; the upstream duel is linked to an exact upstream commit. The complete initial synthetic golden and real-fixture semantic snapshots are committed under `tests/goldens/`.

```bash
python replay-tools/conformance.py output/new-run --compare replay-tools/tests/goldens/townbell-ffa-save68.json
python replay-tools/conformance.py output/new-run --write-snapshot candidate-golden.json
```

Review candidate changes and declare the parser/schema/model migration before updating a golden. The snapshot CLI never silently blesses changes. Whole-store semantic hashes detect changes even when aggregate counts stay the same; the synthetic golden permits field-level JSON Pointer diffs. Raw source bytes are checked separately from decoded semantics.

The existing corpus commands remain available and now read every verified chunk:

```bash
node scripts/test-replay-corpus.mjs replay-fixtures replay-corpus-output
node scripts/test-match-analysis-corpus.mjs replay-corpus-output match-analysis-output
```

The second command normally uses the built `functions/lib/engines/matchAnalysis.js`. For local Node type-stripping verification of the unchanged engine, set `AOF_ANALYSIS_ENGINE=functions/src/engines/matchAnalysis.ts`. The optional analyzer is inferred analysis, not a canonical fact source or result resolver.
