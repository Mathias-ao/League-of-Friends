# Shared engagement evidence — V1 delivery experiment

Status: **offline evaluation, NOT a production architecture approval**. Stacked on PR #91 and the Recorded Events branch. Neither game models, official results, league points, Reputation nor Relationships are changed.

## What we tested

The authoritative evidence remains the immutable Recorded Events V1 gzip. Existing statistical models still calculate **full** statistics. This experiment changes only the rebuildable delivery representation:

1. Compact Game/Battle measurements omit engagement detail arrays.
2. A per-participant episode index retains all classifications, order and references.
3. Identical whole episode objects are stored once as in PR #91.
4. Unlike PR #91, substantial recurring sub-episode fields such as `directedInteractionEdges`, `opponentInteractionPairs`, `sourceEventIds`, and unit-class evidence are stored once, referenced from distinct episode records.
5. All original episodes and the complete statistics document can be reconstructed, checked against the original complete-statistics SHA-256.

A separate small-selector module demonstrates two logical views: five-category Battle measurements and neutral social interpreter inputs (including match facts and Pair Social Evidence). **They are not deployed read models.** Existing Event/Season/Player `StatisticsExperience` aggregation should remain the primary compact read path, with official eligibility and durable player binding decided by the server, not these selectors.

## Measurements (synthetic, intentionally high sharing)

Linux / Python local controlled synthetic cases, each 8 players × 60 episodes per group × 4 groups. The scenarios are *generated structures*, not decoded Age of Empires II recordings. First-pass timings are exploratory, not p50/p95 measurements.

| Case | Full JSON | Full gzip | PR #91 cache total | Shared-evidence cache total |
| --- | ---: | ---: | ---: | ---: |
| Same complete episodes across players | 53.108 MB | 1.679 MB | 0.307 MB | **0.192 MB** |
| Different player-specific episode wrappers, shared underlying evidence | 53.188 MB | 1.686 MB | 1.902 MB | **0.430 MB** |

The second case is crucial: whole-object dedup can be *worse* than simple gzip when wrappers differ. Reusing the large shared evidence fixes this synthetic regression.

On the player-specific case, packaging took approximately **3.33s** (PR #91) versus **8.60s** (shared evidence), with complete reconstruction **4.74s** versus **5.20s**. Both reconstructed the original statistics exactly. On the identical-object scenario packaging took ~3.04s versus ~4.39s. The increased CPU is an explicit tradeoff, not a free optimization.

Summary gzip was under 1 KB on these synthetic inputs because they contain only a tiny fraction of real statistics. **Do not extrapolate that size to real Games.**

## Verification

Nine focused local tests passed, including the three inherited PR #91 tests. New tests cover:

- All five statistical categories remain in the measurement view; neutral social evidence remains unchanged and outside the ordinary Battle payload.
- Incomplete social inputs reject instead of silently counting missing facts as zero.
- Exact full-statistics reconstruction with different player-specific episode wrappers and shared interaction evidence.
- Deterministic artifacts, absent-field preservation, independent block integrity, unknown-reference rejection and overwrite protection.
- A full canonical JSON digest binds the unmodified original statistics to the packed representation.

GitHub CI provides additional regression checks on this branch.

## Reproduce

```bash
python -m unittest discover -s replay-tools/tests -p 'test_statistics_*delivery.py' -v
python replay-tools/benchmark_statistics_shared_delivery.py --synthetic-episodes 60
python replay-tools/benchmark_statistics_shared_delivery.py --synthetic-episodes 60 --per-player-variant
python replay-tools/benchmark_statistics_shared_delivery.py --statistics path/to/current-185872-4v4-statistics.json --report results/current-4v4.json
```

The file supplied to `--statistics` must be a complete, locally computed real statistics report. It is neither uploaded to GitHub nor reproduced in the synthetic reports.

## Important limitations / release gates

- **The real 94.9 MB and 403.6 MB statistics outputs are not available in this chat/container.** The synthetic ratios do not establish real storage, memory, latency or cloud costs.
- Packing happens **after existing models construct the complete statistics object**. It reduces serialized duplication and allows smaller future payloads; it does not yet eliminate the peak working memory needed to produce those models.
- The offline artifact is not a remotely authenticated detail API. The chosen block size, hash lookup and metadata layout need testing for real index sizes, on-demand read performance and Cloud Storage operation costs.
- No current `getReplayStatistics`, native upload worker, Social History, reputation, Chronicle or UI consumer uses this cache. In particular, native Recorded Events provenance must be qualified by a server-side compatibility adapter before social interpretation.
- The content-addressed hashes represent JSON values; they are not separate recognized game actions or authoritative episode IDs. Never count multiple classifications of one encounter as separate deeds solely because their payloads differ.
- Measure the real build-185872 4v4 (including **lossless restoration**, packing time, memory, index size, block count and summary size) before choosing PR #91, this experiment or a simpler single gzip plus compact Firestore view.
- If shared evidence is valuable, prefer **emitting shared episode records directly in the analysis pipeline** later to avoid repeatedly constructing and hashing duplicated nested data. That change needs new equivalence checks.
- Immutable Cloud Storage objects, transactionally activated revisions, authenticated bounded website endpoints, historical reprojection and rollback are deliberately **not** implemented here.

**Decision:** retain Recorded Events as the one permanent gameplay source. Keep both caches experimental until the real-input measurements demonstrate that added complexity is justified.
