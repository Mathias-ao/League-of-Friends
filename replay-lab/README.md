# AoF Replay Lab

AoF Replay Lab is a **development-only** local application for iterating on Age of Friends replay statistics. It deliberately bypasses the production website, authentication, Firebase and league state.

It is a thin shell over the existing replay foundation:

```text
.aoe2record
  -> replay-tools/parse_replay.py
  -> CanonicalReplay evidence (lossless, fast-sealed for development)
  -> AOF_REPLAY_ANALYSIS_V1 (compact rebuildable cache)
  -> replay-tools/statistics_projector.py
  -> Replay Lab inspection / comparison
```

It does not implement a second parser or a second statistics engine.

## Requirements

- Node.js 22+
- Python 3.12 recommended
- Replay-tool dependencies installed:

```bash
python -m pip install -r replay-tools/requirements.txt
```

On systems where Python is not invoked as `python`, set `PYTHON`.

## Run

From the repository root:

```bash
npm --prefix replay-lab start
```

Then open:

```text
http://127.0.0.1:4317
```

Optional environment variables:

- `PYTHON` — Python executable.
- `AOF_REPLAY_LAB_PORT` — local port, default `4317`.
- `AOF_REPLAY_LAB_HOST` — bind host, default loopback only.
- `AOF_REPLAY_LAB_HOME` — run-artifact directory, default `.replay-lab/`.
- `AOF_REPLAY_LAB_MAX_BYTES` — upload-copy limit, default 128 MiB.

## Workflow

1. Drop a local `.aoe2record`.
2. **Extract replay** creates CanonicalReplay, applies a fast structural seal, creates compact `analysis.json`, then projects statistics. The fast seal is explicitly marked `sealed_local_fast`, not fully verified.
3. Inspect the Overview timing cards to see upload, parse/canonical write, canonical seal, analysis-cache generation and statistics time separately.
4. Inspect player sections, the canonical event timeline, raw evidence, coverage warnings, unknown actions and unresolved entity IDs.
5. Change a statistics model in `replay-tools/`.
6. Click **Recalculate statistics**. This reads `analysis.json`; it does **not** reparse the replay and does **not** redo full canonical validation.
7. Open **Comparison** to inspect JSON-pointer-level changes between the previous and current projections.

The temporary browser-upload copy of the recording is deleted after extraction. The user's original recording is untouched. Local canonical, analysis-cache and statistics artifacts remain under the lab work directory and are ignored by Git.

Older Replay Lab runs without `analysis.json` are migrated on their next recalculation by generating the compact cache once from their existing sealed/verified canonical bundle.

## Fast seal vs full conformance

Replay Lab optimizes the interactive development path. Its default fast seal validates the manifest, source identity, completed framing, artifact existence/length, chunk totals and ordinal metadata without decompressing and schema-validating every event or reconstructing the full replay bytes. Use **Full conformance audit** when you want exhaustive event validation and source-byte reconstruction; a passing audit upgrades the run to `verified_local`.

Parser qualification, CI, controlled fixtures and release-quality evidence checks continue to use full conformance.

## Truth boundaries

Replay Lab intentionally displays evidence boundaries:

- Military queue values are observed **requests**, not trained units.
- Resource Commitment is an estimate/reconstruction, not actual spending.
- Raid/Battle outputs are inferred episodes, not proof of kills or damage.
- Timeline and Raw Evidence show parser facts retained from the recording.
- Coverage/compatibility warnings remain visible instead of being converted to zeros.

## Tests

```bash
npm --prefix replay-lab test
```

These tests cover lab-only helpers. Replay extraction/statistics correctness continues to be tested by the existing replay-tools conformance suites.

## Object catalogue

Replay Lab reports unresolved catalogue IDs but does not silently invent labels. The catalogue policy is documented in `replay-tools/entity-catalog/README.md`.

If AIRef is used as a supplementary source, **only Age of Empires II: Definitive Edition rows from the main AoE2 objects dataset are admissible**. Return of Rome and Chronicles object datasets are excluded.
