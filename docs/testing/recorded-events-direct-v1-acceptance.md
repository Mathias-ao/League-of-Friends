# Recorded Events V1 — Milestones 1–2 acceptance

Measured locally on 10 October 2026, Windows, Python 3.14.7, pinned
`mgz-fast` 1.0.0 with decoder code digest recorded in each report. No Firebase
reads/writes, deployment, merge, production migration or historical deletion.
Architecture and retention: [native V1 contract](../architecture/recorded-events-v1-contract.md).

Review: [draft PR #90](https://github.com/Mathias-ao/League-of-Friends/pull/90),
branch `feat/recorded-events-v1-direct`, based on PR #89 (`experiment/recorded-events-v1`),
which depends on PR #83. PR #88 is independent. The initial preservation commit
is `42197d7`; this report describes the final source-byte-checked implementation.

## Acceptance result

**Milestone 1 is implemented; Milestone 2's native extraction, integrity and
four-format statistical-equivalence criteria pass locally. Overall regression
sign-off remains conditional:** the separately enabled older real-recording golden
tests expose inherited baseline mismatches, described below. This is a draft for
review, not a claim that every regression or the production V1 pipeline is accepted.

| Requirement | Evidence / disposition |
| --- | --- |
| One chronological retained dataset | One verified gzip JSONL file, explicit source ordinals, exact integer clock, decoded objects/terrain/context, end counts and dual hashes. |
| Direct extraction | Decoder streams into V1; no canonical directory/ZIP, raw header, Base64 frame copies, duplicate summary construction or persisted Analysis V5. Legacy defaults remain unchanged. |
| Replay-free statistics | Complete native output matches the unchanged legacy models on 1v1, 2v2, 4v4 and FFA, after explicit source/header-reference/coverage adaptation. Tests deny replay and canonical access. |
| Existing social calculations | Pair Social Evidence, episode context, diplomacy, temporal raids/engagements and all participant statistics included in the full-output comparison. Native artifact provenance intentionally changes revision-scoped social IDs. |
| Integrity | Synthetic tests reject changed source, bad clock/ordinal, missing/trailing records, corrupt hashes/gzip, malformed identities, raw binary retention and bound violations. Repeat extraction is deterministic and cannot replace an existing file. |
| Statistical semantics | Models/catalogs/formulas unchanged. Initial resources remain unavailable; elevations remain retained but disabled as legacy model input. No inferred game-state feature added. |
| Official authority | No Firebase/result/scoring code changed. Existing result, correction and reward authority remains independent. |
| Production V1 upload/recalculation | **Not accepted here.** Worker transport, Cloud Storage/Firestore publication, bounded website reads and revision jobs remain Milestones 3–4. Staging/cutover remains Milestone 5. |

The comparison deliberately does not fabricate a canonical manifest hash for the
native dataset. It gives the legacy models the same native provenance, header
reference and truthful retention coverage, then compares **every output field**.
Existing legacy output and golden tests keep their original source contract.

The stricter input comparison identified 294 FFA `DE_TRIBUTE` payload values
containing a one-byte Base64 copy of the separately normalized numeric target.
Each omitted byte was decoded and asserted equal to the retained `targetPlayerId`.
Only that verified duplicate is excluded from action-input equality. The unchanged
legacy projector still receives its original complete action payload during the
full-output comparison. No projected difference is waived.

## Measured sizes

Decimal MB, exact byte counts and hashes in the linked machine-readable reports.
The old ZIP includes statistics, as in the current production worker.

| Recording | Recording | Old canonical ZIP | Analysis V5 gzip | PR89 events gzip | Direct V1 gzip | Native statistics JSON / gzip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [1v1](benchmarks/direct-events-v1-2026-10-10/1v1.json) | 5.225 | 5.759 | 1.746 | 1.783 | 2.497 | 6.642 / 0.300 |
| [2v2](benchmarks/direct-events-v1-2026-10-10/2v2.json) | 2.662 | 4.392 | 1.031 | 0.966 | 1.304 | 5.663 / 0.306 |
| [4v4](benchmarks/direct-events-v1-2026-10-10/4v4.json) | 4.456 | 9.955 | 1.635 | 1.505 | 2.010 | 94.934 / 3.016 |
| [FFA/diplomacy](benchmarks/direct-events-v1-2026-10-10/ffa.json) | 4.409 | 8.039 | 1.810 | 1.541 | 2.068 | 13.329 / 0.705 |

V1 is larger than PR89's monolithic gzip JSON: explicit contiguous ordinals and
independent JSONL records cost compressed bytes. It remains roughly half the
original recordings while allowing bounded validation without loading an entire
event document. It replaces the intended authoritative archive; Analysis V5 is
only a comparison input, not an additional permanent V1 artifact.

## Measured time and memory

Seconds; memory is sampled Windows **process-tree working set**, including the
small launcher. It is not isolated Python heap or exact private RSS; shared pages
can be counted twice. Sampling interval is 20 ms. Three fresh projection/write
processes per format; one extraction per format. No concurrent benchmark jobs.

| Recording | Earlier canonical parse + seal | Direct extraction + full readback verification | Median replay-free projection + bounded JSON write | Peak extraction MiB | Maximum projection/write MiB | Earlier PR89 projection/write MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1v1 | 183.14 | 16.44 | 7.68 | 50.1 | 66.5 | 665.7 |
| 2v2 | 80.80 | 7.05 | 4.17 | 58.4 | 77.3 | 243.9 |
| 4v4 | 118.09 | 10.22 | 12.07 | 94.5 | 128.5 | 481.5 |
| FFA | 115.33 | 9.93 | 10.97 | 76.8 | 134.6 | 324.9 |

The earlier canonical measurements are the existing PR83/89 baseline, not a new
simultaneous controlled trial. They show that archive validation dominated that
path; no claim about deployed Cloud Run speedup is made. Full event projection is
still slower than reading an already-built Analysis V5 cache (earlier medians
1.82/1.47/5.62/6.88 seconds). V1 avoids permanently maintaining that second input
representation and trades bounded CPU for substantially lower memory.

The final 4v4 phase measurements distinguish the actual costs:

- Read, inflate, validate and build model inputs: approximately 4.02 seconds.
- Existing statistical models: approximately 3.91 seconds.
- Bounded JSON serialization: approximately 3.96 seconds.
- A full-string/full-byte serialization alternative: approximately 1.08 seconds,
  but process-tree peak increases from about 129 MiB to 301 MiB.

The chosen encoder uses the fast JSON implementation on bounded subtrees instead
of holding a second full statistics string and byte buffer. Full encoded output
hashes match. A preliminary generic streaming encoder took about 5.4 seconds on
4v4 serialization; the bounded-subtree version reduced that to about 4 seconds.

## Why 4v4 statistics are 95 MB

Measured JSON subtree sizes: `participants` is **93,039,433 bytes**;
their `military.engagements.engagementEvidence` totals **91,947,009 bytes**,
about 96.9% of the output. Pair Social Evidence is only **1,733,803 bytes**.
The same interaction edges appear under skirmishes, promoted battles, great
battles and cooperative attacks, then repeat for participating players. One
player's engagement evidence alone is about 19.94 MB.

This is derived-output duplication, not excessive authoritative event retention.
Milestone 3 should store reusable evidence details once per projection with
references from participant summaries and provide bounded detail retrieval.
The current 95 MB JSON must not become a website response merely because worker
memory is improved. This PR does not truncate evidence or silently change the
legacy detail shape to achieve a smaller benchmark.

A separate instrumented `cProfile` run identified repeated row validation,
JSON parsing and transient clock-event construction in the input phase, and
skirmish pairwise edges/execution spatial work in the existing models. Compact
clock records now update counters directly. No model algorithm was altered in
response to profiler timings; those require separate equivalence evidence.

## Reproduce and regression scope

Final verification of preservation commit `42197d7`:

- Full replay-tools discovery: **293 tests, 289 passed, four opt-in legacy
  real-recording tests skipped, no failures** (79.137 seconds). Both four-format
  native and PR89 retained-dataset corpus tests were enabled and passed.
- Targeted native stream/integrity tests: **12 passed**. These cover chronology,
  source-byte coverage, deterministic extraction, stable references, corrupt and
  incomplete inputs, bounded serialization and replay/archive access rejection.
- Targeted social/episode tests: **47 passed**, including the interrupted
  `pair_episode_context.py` change. Native provenance uses the new revision fields;
  the legacy required fields and original error wording are preserved.
- Canonical artifact Node checks: **two passed**.
- All four final benchmark comparisons report complete statistical equality with
  native provenance, including social evidence. Only the explicitly documented
  provenance and verified duplicate binary tribute input are adapted.

The four skipped legacy tests were subsequently enabled with
`AOF_REPLAY_FIXTURE_DIR=replay-fixtures` and run to completion: **four failures,
zero skips, 750.491 seconds**. Across both discovery and this follow-up, all 293
discovered cases were attempted: 289 passed and four failed. These are distinct
from the passing four-format native equivalence tests.

| Older test | Observed failure |
| --- | --- |
| `test_new_ffa_diplomacy` | Fact semantic hash differs from its golden. |
| `test_townbell_ffa` | Golden normalizer version is `V1_1`; current/base are `V1_2`. |
| `test_two_recorder_duel` | First recording's statistics warning list lacks six later model qualifications in the golden. |
| `test_upstream_duel` | Fact semantic hash and normalizer version differ from the golden. |

[Baseline diagnosis](benchmarks/direct-events-v1-2026-10-10/legacy-regression-diagnosis.json)
records fresh default-parser runs from PR89 base `4123b54` and this implementation.
All **five** hash-pinned legacy recording sources produce identical fact counts and
semantic hashes across those two checkouts. The base already uses normalizer
`V1_2`; its projector also produces the six additional warning codes, and its full
FFA statistics equal the cached baseline used for native comparison. The observed
failures therefore predate this PR. No test assertions, goldens, formulas or
statistical definitions were changed to conceal them.

The legacy tests stop at their failing assertion, so downstream assertions
(including the final paired snapshot) are **not newly verified** by that run.
Clean legacy golden acceptance requires a separately reviewed reconciliation of
those existing expectations. This report does not approve that semantic baseline
change or claim the full suite is green.

```bash
python replay-tools/benchmark_direct_events.py --replay replay-fixtures/4v4.aoe2record --baseline .replay-lab/events-baseline/4v4 --output .replay-lab/direct-new/4v4
AOF_DIRECT_EVENTS_BENCHMARK_DIR=.replay-lab/direct-v1-accepted AOF_RECORDED_EVENTS_BENCHMARK_DIR=.replay-lab/events-baseline python -m unittest discover -s replay-tools/tests -v
AOF_REPLAY_FIXTURE_DIR=replay-fixtures python -m unittest discover -s replay-tools/tests -p test_real_replays.py -v
```

`benchmark_direct_events.py` extends PR83's measurements and Windows process-tree
sampler. It does not generate another canonical baseline. The replay-free corpus
tests operate on retained event artifacts and check complete output hashes; the
benchmark independently compares those outputs against the old Analysis V5 input.
Large local outputs are ignored; only minimized reports are committed.

Limits: one example per format; extraction not repeated three times per format;
warm OS cache; no cloud storage/network latency, cloud cost, concurrent workers,
max-size replay stress, staging upload or browser acceptance measured. Synthetic
wire fixtures qualify parser/retention behavior, not AoE2 engine outcomes.

## Prioritized work to finish V1

1. **Milestone 3:** native worker protocol with immutable Storage references;
   hash/generation verification before Firestore publication; no ZIP/Base64/full
   statistics response on the native path. Store detailed projections server-side;
   reuse the existing compact statistics experience and add revision-bound,
   byte-limited detail pages. Native provenance needs compatibility tests in
   result/social readers before activation.
2. **Milestone 4:** distinguish source, extraction, projection and league scoring
   revisions. Allow verified reupload without overwriting prior extractions.
   Bounded historical jobs must reserve work, retry with leases/cursors, and
   compare active evidence/binding revisions before atomic publication. Do not
   invoke official result/reward resolution during descriptive recalculation.
   Replace old delete-before-recreate rebuild publication separately.
3. **Milestone 5:** approved staging upload/reads, stale-worker/concurrent upload,
   retry/recovery, role/binding and historical recalculation acceptance. Prepare
   production cutover/rollback and legacy artifact reconciliation. Deployment,
   production migration, merges and historical deletion remain approval gates.

Milestones 1–2 deliver executable local foundations. **The finished V1 upload →
permanent event storage → bounded website statistics → historical recalculation
pipeline does not yet exist.** Review source-provenance/retention changes here;
the next PR must connect these foundations without changing official authority.
