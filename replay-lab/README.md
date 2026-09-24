# AoF Replay Lab

AoF Replay Lab is a **development-only** local application for iterating on Age of Friends replay statistics. It deliberately bypasses the production website, authentication, Firebase and league state.

It is a thin shell over the existing replay foundation:

```text
.aoe2record
  -> replay-tools/parse_replay.py
  -> CanonicalReplay evidence (lossless, fast-sealed for development)
  -> AOF_REPLAY_ANALYSIS_V2 (compact rebuildable cache)
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
4. Inspect player sections as compact review tables. Economy, Military and Map Presence use row-wise review matrices.
5. Optionally click **Attach TownBell report** and choose the TownBell exported JSON for the same replay. Replay Lab stores a normalized local control next to the run and maps TownBell player numbers to AoF replay slots. TownBell remains a comparison control, never canonical evidence.
6. With a TownBell control attached, Economy, Military and Map Presence render one row per AoF metric leaf and paired columns for every player: **AoF** then **TownBell**. Known comparable metrics are mapped by explicit metric ID; AoF-only diagnostic/basis rows stay visible with blank TownBell cells. Duration values are normalized to the same display clock. Map Presence V6 maps command coverage, scout coverage @5:00, enemy-side presence, forward buildings, wall tiles, towers, camp average distance and relic command/timing controls. It intentionally leaves TownBell `building_spread`, `expansions_claimed`, `deepest_forward_building`, `first_enemy_base_look` and `gold_control_share` unmapped where AoF's definition is materially different or the control semantics are unclear.
7. Change a statistics model in `replay-tools/`.
8. Click **Recalculate statistics**. This normally reads `analysis.json`; it does **not** reparse the replay and does **not** redo full canonical validation. If the compact analysis dataset version changed, Replay Lab rebuilds `analysis.json` once from the existing sealed CanonicalReplay facts, then projects statistics. The attached TownBell control remains in place.
9. Open **Comparison** to inspect JSON-pointer-level changes between the previous and current AoF projections.

The temporary browser-upload copy of the recording is deleted after extraction. The user's original recording is untouched. Local canonical, analysis-cache, statistics and normalized TownBell-control artifacts remain under the lab work directory and are ignored by Git.

Older Replay Lab runs without `analysis.json` are migrated on their next recalculation by generating the compact cache once from their existing sealed/verified canonical bundle.

## Fast seal vs full conformance

Replay Lab optimizes the interactive development path. Its default fast seal validates the manifest, source identity, completed framing, artifact existence/length, chunk totals and ordinal metadata without decompressing and schema-validating every event or reconstructing the full replay bytes. Use **Full conformance audit** when you want exhaustive event validation and source-byte reconstruction; a passing audit upgrades the run to `verified_local`.

Parser qualification, CI, controlled fixtures and release-quality evidence checks continue to use full conformance.

## Truth boundaries

Replay Lab intentionally displays evidence boundaries:

- Military queue values are observed **requests**, not trained units.
- Resource Commitment is an estimate/reconstruction, not actual spending.
- Existing raid output remains inferred and is not proof of kills or damage. The standalone Battle tab is intentionally removed; future raids/engagements will live under Military → Combat after the first statistics-tab review.
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
