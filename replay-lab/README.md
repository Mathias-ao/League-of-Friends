# AoF Replay Lab

AoF Replay Lab is a **development-only** local application for iterating on Age of Friends replay statistics. It deliberately bypasses the production website, authentication, Firebase and league state.

It is a thin shell over the existing replay foundation:

```text
.aoe2record
  -> replay-tools/parse_replay.py
  -> CanonicalReplay evidence
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
2. **Extract replay** creates and validates a CanonicalReplay bundle and the current statistics projection.
3. Inspect player sections, the canonical event timeline, raw evidence, coverage warnings, unknown actions and unresolved entity IDs.
4. Change a statistics model in `replay-tools/`.
5. Click **Recalculate statistics**. This reuses CanonicalReplay and does **not** parse the replay again.
6. Open **Comparison** to inspect JSON-pointer-level changes between the previous and current projections.

The temporary browser-upload copy of the recording is deleted after extraction. The user's original recording is untouched. Local canonical/statistics artifacts remain under the lab work directory and are ignored by Git.

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
