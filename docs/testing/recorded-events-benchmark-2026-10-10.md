# Recorded Events experiment: measured results

10 October 2026. Local Windows, Python 3.14.7, pinned mgz-fast 1.0.0.
Architecture, retention policy and migration gates: [assessment](../architecture/recorded-events-v1-assessment.md).
Uses and extends [PR #83](https://github.com/Mathias-ao/League-of-Friends/pull/83).
No cloud writes, deployment, source deletion, emulator import, formula changes or
official outcome changes occurred.

## Measured sizes

MB here is **1,000,000 bytes**, not MiB. Gzip level 6, deterministic mtime=0.

| Recording | Original | Current canonical ZIP | Analysis V5 gzip | Recorded Events gzip | Statistics JSON | Statistics gzip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1v1 | 5.225 MB | 5.759 MB | 1.746 MB | **1.783 MB** | 6.644 MB | 0.301 MB |
| 2v2 | 2.662 MB | 4.392 MB | 1.031 MB | **0.966 MB** | 5.665 MB | 0.307 MB |
| 4v4 | 4.456 MB | 9.955 MB | 1.635 MB | **1.505 MB** | 94.936 MB | 3.016 MB |
| FFA/diplomacy | 4.409 MB | 8.039 MB | 1.810 MB | **1.541 MB** | 13.331 MB | 0.706 MB |

All four RED objects are smaller than their original recording. RED is slightly
larger than V5 on 1v1: it deliberately retains clock operations, non-player/unknown
operations, terrain type, layout observations and chronology instead of optimizing
around current statistics. It does not contain V5's duplicate body/fundamentals.

**Comparability:** the existing canonical ZIP contains a copy of statistics JSON;
RED contains observations only. This measures the current worker's actual ZIP,
not an artificially stripped archival format. The separate statistics cache is
still necessary for fast UI reads. For the 4v4, ZIP + separate gzip statistics is
12.971 MB; RED + the same cache is 4.521 MB (~65% less). The event-only replacement
is ~85% smaller than the current ZIP, but do not call that the total system saving.
Firestore cached presentations, old revisions, metadata and backups are excluded.

## Measured local times and memory

Seconds; projections show the median of three separate CLI processes using the
same extracted evidence. Full extraction was run **once per format**, not three
independent times. These are exploratory workstation measurements, not p95 SLAs.

| Recording | Parse + full seal | Seal alone | V5 statistics projection | RED conversion from canonical | RED decode + adapter + projection | RED projection peak tree working set |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1v1 | 183.137 s | 166.105 s | 1.816 s | 15.809 s | 9.258 s | 665.7 MiB |
| 2v2 | 80.800 s | 73.221 s | 1.466 s | 6.783 s | 4.289 s | 243.9 MiB |
| 4v4 | 118.088 s | 106.891 s | 5.616 s | 9.508 s | 9.874 s | 481.5 MiB |
| FFA/diplomacy | 115.328 s | 104.754 s | 6.884 s | 9.359 s | 10.992 s | 324.9 MiB |

Full seal accounts for about 90–91% of parse-and-seal time in these four runs.
The 4v4 baseline stages for a single import (parse/seal, V5 generation, one stats
projection and ZIP) total about 129.6 seconds. The diagnostic repeat projections
must not be added to import latency. This is consistent in scale with the reported
~150-second experience but does not reproduce the browser/worker/cloud flow.

RED does **not** yet improve projection time or memory. It decodes a whole JSON
document, validates it, rebuilds legacy command tables, then runs unchanged
detectors. The 1v1 uncompressed RED is 61.98 MB and exceeds 665 MiB working set
during projection; compressed bytes are a poor predictor of memory. The parser's
streaming full extraction uses much less memory than the current whole-document
experiment on the measured 2v2/FFA. Keep this prototype offline. A direct event
writer and streaming reader need a separate measured implementation, not removal
of integrity checks as a shortcut.

Memory correction: the original Windows venv root process was only a ~4 MiB
launcher. PR #83 now records interpreter descendants separately as
`peakWindowsProcessTreeWorkingSetBytes`. The table uses the corrected final
sequential experiment sweep. Initial 1v1 baseline memory is absent; initial 4v4
baseline root-only memory is **not** a valid extraction/projection memory result.
Working set is sampled at approximately 20 ms, can miss short peaks, and may count
shared pages twice. It is not private committed memory, a concurrent-worker load
test, or a measured production worker peak. Startup/local I/O are included in
timings; no CPU isolation or cold-cache control was used. Some original baseline
work overlapped light development/tests; final RED runs were sequential.

## Storage alternatives and transfer arithmetic

Actual independent gzip compression of record-aligned batches (context, initial
objects, terrain, chronological operations), bisected below 900 KiB:

| Recording | Firestore payload documents | Total compressed payload bytes | Largest document payload | Single Storage object bytes |
| --- | ---: | ---: | ---: | ---: |
| 1v1 | 5 | 1,781,181 | 876,876 | 1,782,694 |
| 2v2 | 4 | 963,292 | 873,162 | 965,771 |
| 4v4 | 5 | 1,502,472 | 708,486 | 1,504,837 |
| FFA/diplomacy | 5 | 1,539,537 | 871,736 | 1,541,381 |

Firestore document IDs, fields, indexes, RPC envelopes and an immutable publication
manifest are additional. These sizes do not prove that a monolithic document is
valid. The 2v2 object is below 1 MiB; the other three require splitting. Cloud
Storage is recommended for simpler artifact identity and whole-history reads,
not because Firestore batches are infeasible. The [assessment](../architecture/recorded-events-v1-assessment.md#firestore-versus-cloud-storage)
gives operation-count/cost formulas and integrity/publication differences.

The 4v4 source grows from 4,455,725 bytes to **5,940,968 Base64 bytes**. Its ZIP
grows to **13,273,192 Base64 bytes**, while the worker also returns approximately
94.94 MB of statistics JSON: roughly **108.21 MB before wrapper fields**. These
are deterministic encoding-size calculations from measured files, not a captured
HTTP response or peak-memory estimate. The final browser endpoint also returns
decoded statistics. Gzip-at-rest fixes storage upload size but not either JSON
response boundary. Avoid Base64 evidence transfer and return compact summaries
plus bounded detail in a separately reviewed transport change.

Local gzip decode + strict validation took approximately 1.44–3.87 seconds in the
final sweep. No Firestore/Storage network latency, cloud billing, compression over
HTTP, browser memory, retry transfer or concurrency was measured. Do not claim a
cloud speedup or precise dollar saving from these local figures.

## Correctness evidence

- All four real recordings produced **exactly identical complete statistics JSON
  bytes** from current V5 and serialized RED, not merely equivalent headline
  counts. Three RED projection processes per recording passed. This covers every
  existing output category, Opening/Build Order, Economy, Military, Map Presence,
  Execution, raid/engagement chronology, Pair Social Evidence, episode context,
  directed diplomacy and recording match facts.
- A separate four-format regression reloads only RED plus its integrity metadata
  and checks the original full-statistics digest with canonical-reader entrypoints
  blocked. All four passed. The synthetic test also renames both source recording
  and canonical directory before projection.
- Synthetic regressions cover signed/zero queue quantities, promoted producer
  type, tied directional diplomacy order, terrain retained without silently
  changing legacy elevation semantics, malformed clocks/counts/terrain/identities,
  unknown framing, binary retention rejection and dual stored/uncompressed hashes.
- Final Python suite with the RED corpus enabled: **277 tests, 273 passed and four
  explicitly skipped opt-in original real-golden tests**. All four RED corpus
  regressions are included among the passes (and also passed separately). No old
  golden was regenerated or silently updated.
- Node canonical-consumer/catalog checks: 6 passed. Separate PR #88: Functions
  TypeScript build and 11 social-history/storage tests passed.

Equivalence proves preservation of supported current computations, not accuracy
of inferred real gameplay. Initial stockpiles, effective diplomacy, damage/kills,
resource income and object survival remain unobserved/unqualified. Historical
compatibility warnings and provenance references need a versioned production
replacement. Current elevation input is empty because of the existing path bug;
retaining elevations does not authorize changing the formula inputs silently.

## Reproduce and inspect

Use the exact fixture filenames/hashes in the committed reports. Baseline raw
reports and extractor/decoder code hashes are retained in
[`benchmarks/recorded-events-2026-10-10/`](benchmarks/recorded-events-2026-10-10/):
[1v1](benchmarks/recorded-events-2026-10-10/1v1.json),
[2v2](benchmarks/recorded-events-2026-10-10/2v2.json),
[4v4](benchmarks/recorded-events-2026-10-10/4v4.json),
[FFA](benchmarks/recorded-events-2026-10-10/ffa.json).
Host paths are removed; raw recordings/statistics remain local. Git HEAD alone is
not a complete identity for the exploratory dirty working tree; retained decoder,
exporter and dataset hashes qualify the measurements.

```powershell
# New directory per baseline; repeat separately for each real recording.
python replay-tools/benchmark_replay_pipeline.py replay-fixtures/4v4.aoe2record --output .replay-lab/new-baseline/4v4 --seal-mode full --archive
python replay-tools/benchmark_recorded_events.py .replay-lab/new-baseline/4v4

# Projection receives no source recording, canonical bundle or analysis cache.
python replay-tools/recorded_events.py --dataset .replay-lab/new-baseline/4v4/recorded-events.json.gz --metadata .replay-lab/new-baseline/4v4/recorded-events.json.gz.metadata.json --out .replay-lab/new-baseline/4v4/reprojected.json

# After preparing 1v1, 2v2, 4v4 and ffa folders:
$env:AOF_RECORDED_EVENTS_BENCHMARK_DIR = '.replay-lab/new-baseline'
python -m unittest discover -s replay-tools/tests -p test_recorded_events_corpus.py -v
```

Next measurement gate: ≥3 independent full/fast extraction runs per format with
stable code and controlled workload; direct RED emission; bounded/streaming read;
real HTTP/worker response and memory; approved nonproduction Storage/Firestore
p50/p95 and retry/idempotency tests. No cloud credentials or deployment were used
to manufacture a more complete-looking benchmark.
