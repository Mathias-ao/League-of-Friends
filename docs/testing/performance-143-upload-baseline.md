# Ordinary native upload performance — issue #143

**Release gate: NOT MET.** Browser click → authenticated, source-bound READY usable Battle statistics painted is not measured by this report. These local diagnostics do not establish p95, cloud cold starts or a network/device guarantee. The 4v4 ordinary server path already exceeds 20 seconds before those missing segments.

Production code base: `29f5ed995bbdc1572ef12550cd3c9cc8e8511186`. Initial instrumentation: `af326796a5c766defd67ec3988e984fd1afb53ae`; final span instrumentation is recorded in the adjacent confirmation report. Python processor revision: `f66c9946c7c8f4372f889c33ff873f745109e4b4c153d58140e69ecfdd3db725`. The processor digest includes the existing top-level benchmark Python file, so this instrumentation revision differs from untouched main even though the native algorithm is unchanged.

## Conditions and source pins

Linux x86-64; AMD EPYC 9V74, nine visible logical CPUs, cgroup quota eight CPUs/8 GiB. Python 3.12.14, pinned `mgz-fast==1.0.0`, `jsonschema==4.23.0`; Node 24.19.0; Java 17.0.20; Firebase CLI 14.27.0; Firestore 1.19.8 and Storage rules runtime 1.1.3. CI uses its existing Node 22/Java 21/Python 3.12 setup; timings are not interchangeable between machines.

Authentic originals and independent TownBell expectations come exclusively from existing corpus commit `2d04ec6adbe871d156c108a4351448efeb08f4e6`, under `replay-fixtures/build-185872/`. Original hashes, byte lengths and per-call raw metrics are in [native-worker-baseline.json](benchmarks/performance-143/native-worker-baseline.json). All four expectations independently declare build 185872. No synthetic recording substitutes or user working-tree recordings were used.

Fresh process means a new Python interpreter with imports cold, **not** cold OS/filesystem, cold container, cold network or cloud queue. Warm means another complete extraction/projection in that same interpreter, not a duplicate cache hit. Calls were serial. The initial overlapping 1v1/2v2 runs were discarded and repeated; they are excluded from the committed serial data. Process peak RSS is a high-water mark, not independent per-request allocation.

## Measured boundaries

| Boundary | Measured here |
|---|---|
| Click / selected-file submit; ArrayBuffer/base64; browser network and callable/Auth HTTP | **UNMEASURED**. A local Chromium download returned a truncated/non-ZIP response; a real browser harness remains a separate required PR. |
| Python native worker through JSON response encoding | Three fresh processes and three same-process warm calls per format; `native-worker` benchmark mode. Current native path, `fast_action_windows=False`. |
| Auth-bound `uploadReplay.run` → READY + existing result resolver | Three fresh-Firestore trials per format, real local authenticated native HTTP worker and immutable Storage readback. No external callable HTTP/Auth token verification. |
| Publication and resolver | Additional gated, monotonic, anonymous server spans; immutable artifact reads, second package verification, read-model construction, READY transaction, resolver and final source/authority fence. No API or authoritative-state changes. |
| Authenticated bounded statistics read | Measured separately after the existing lifecycle audits. **Do not add this to upload time and call it an actual UI paint measurement.** |
| Actual Battle screen backend query | `getStatisticsExperience.run({matchId})`, bound authentication, exact source/revision/roster and pending-result eligibility checked; browser/callable HTTP/paint still excluded. |
| Retry / duplicate / two-user load / controlled failure | Reported separately below; genuine network timeouts and cloud concurrency remain unmeasured. |

READY means actual immutable verified artifacts and an active source revision, never preflight or `VALIDATED_NOT_READY`. Official outcome remains explicitly pending for 2v2/FFA; accepted 1v1/4v4 still use the existing resolver. No statistics, validation, retained original or correction fence was removed or deferred.

## First diagnostic distribution

Seconds, **n=3 per condition/format**, observed medians and maxima only. This sample count cannot certify p95.

| Format | Native fresh-process median / max | Native process-warm median / max | Ordinary server READY median / max |
|---|---:|---:|---:|
| 1v1 | 7.654 / 7.880 | 7.689 / 7.965 | 10.294 / 11.342 |
| 2v2 | 12.109 / 12.150 | 11.632 / 11.990 | 13.839 / 13.993 |
| 4v4 | 20.095 / 20.162 | 20.412 / 21.358 | 22.436 / 23.231 |
| FFA | 15.923 / 16.386 | 15.105 / 15.130 | 16.537 / 19.570 |

Ordinary trials retain the established 1v1 duplicate-request race: exactly one initial request succeeds and the other receives `aborted`; **this is not a solo-request 1v1 benchmark**. Other formats have one initial request. One persistent HTTP worker is used across the ordinary trials; Firestore is reset locally between trials so real GUID ownership is never bypassed. Storage originals remain retained and retries read verified existing generations.

| Format | Authenticated bounded read, observed range | Idempotent ordinary retry, observed range |
|---|---:|---:|
| 1v1 | 48–64 ms | 90–129 ms |
| 2v2 | 105–124 ms | 110–145 ms |
| 4v4 | 393–445 ms | 139–148 ms |
| FFA | 81–121 ms | 121–157 ms |

The separate **one-sample two-user mixed workload** sends one initial request per independent player, in pairs (1v1+2v2, then 4v4+FFA). Existing read-model/reward audits can overlap the other upload. READY times were **22.245 / 30.564 / 39.514 / 47.825 seconds** respectively. This is neither a p95 estimate nor an isolated CPU-only two-request experiment; it demonstrates substantial same-process contention in the current threaded Python server.

Raw ordinary timings, source hashes, expected outcomes, attempts, retry/read times and nested validation stages: [ordinary-ready-baseline.json](benchmarks/performance-143/ordinary-ready-baseline.json). All 16 successful initial uploads passed retention, digest, mapping, result qualification, pending-result aggregate exclusion, idempotency and lifecycle assertions. Controlled failed-job recovery, stale authority, corrupt artifact and cross-Game GUID rejection also passed; these are fault injections, not elapsed real timeouts. Existing Firebase client `MaxListenersExceededWarning` diagnostics were observed; no acceptance assertion or request failed because of them.

The additional [instrumented confirmation](benchmarks/performance-143/ordinary-ready-confirmation.json), exact instrumentation code `898e86597066b8c379dde564aeb8d3117c0fecb8`, includes actual authenticated Battle statistics-query costs: **58.7 / 41.8 / 59.6 / 41.5 ms** for 1v1/2v2/4v4/FFA. It checks source hash, revision 1, every mapped player and expected official eligibility, and rejects an unknown account. These costs are distinct from the bounded military detail reader above. Publication spans are siblings except that the final validation transaction is nested inside validation total. Do not add nested worker, validation and handler totals together. Every raw span is retained; final READY publication, result resolution and the post-resolution fence are measured independently, without removing any check.

Controlled fault-rejection timings and generic codes are in the same confirmation report. Worker failure and corrupt bytes are injected failures; cross-Game GUID and changed authority are controlled negative cases. They are not observed network/worker timeout distributions, and no 240/300-second timeout wait was attempted.

## Ranked measured work

1. **Extraction + verified hydration:** first 4v4 8.671 s, FFA 7.968 s; about 4.5–4.7 s decode/event-write plus 3.1–3.5 s verified read/hydration. Preserve both compressed/uncompressed integrity, event/footer validation, ordinals and immutable source publication. Profile before choosing a bounded implementation.
2. **Large-format statistics:** first 4v4 9.312 s and FFA 7.516 s; skirmish alone 4.008/3.450 s, engagement 1.012/0.516 s. Test the already implemented stable time-window index through the *same native package boundary* with complete output parity; the old direct candidate benchmark has different settings/boundaries.
3. **4v4 statistics JSON/gzip:** 1.884 s (FFA 0.261 s). Optimize only after profiling and byte/semantic equivalence; no standard statistic may be omitted.
4. **Concurrent worker contention:** the two-user mixed case requires explicit bounded follow-up; no cloud concurrency/resource configuration was changed. Do not extrapolate the local GIL/thread behavior into a measured cloud p95.

The same native package boundary with the **already implemented** time-window index gives one paired diagnostic per format, False then True: **7.358→7.260 / 11.435→11.320 / 18.784→16.292 / 14.824→14.297 seconds**. Complete compact and restored statistics, complete manifest and retained events gzip bytes are identical in all four pairs. This supports a narrow transport-argument PR, not a p95 or browser SLA claim. Raw stages: [native-window-candidate.json](benchmarks/performance-143/native-window-candidate.json).

A separate 4v4 extraction [cProfile report](benchmarks/performance-143/extraction-profile.json) takes **23.903 seconds under profiling**, substantially perturbing the ~8-second unprofiled path. Top self costs are `_safe` 2.396 s (3.45 million recursive calls), `StreamValidator.consume` 1.554 s, and `isinstance` 1.455 s. Cumulative `parse_body`/`load_analysis` costs overlap their descendants. A bounded follow-up may reduce validation dispatch/allocation overhead while preserving every writer/verifying-reader check, hash, footer, ordinal and retention restriction; the profile is not evidence that checks may be skipped or that cumulative times can be added as expected savings.

Python response JSON encoding was 8–14 ms in the initial large-format calls. Resolver and final publication costs are split by the confirmation instrumentation; do not remove authoritative checks to save an unmeasured residual. No asynchronous social-enrichment or core-READY presentation semantics changed.

## Reproduction and follow-up ownership

Use the existing `replay-tools/benchmark_upload_critical_path.py`:

```sh
python replay-tools/benchmark_upload_critical_path.py --mode native-worker --repeat 4 \
  --replay /absolute/pinned-corpus/4v4_arabia.aoe2record --out /absolute/output/4v4-warm.json
```

Then run twice more with `--repeat 1`, in new processes, for three first-call samples. Repeat separately for each format without overlapping CPU jobs. `--repeat` is bounded and the reports explicitly label the first/warm distinction. The existing upload benchmark workflow now includes current native mode alongside its historical comparison modes.

The ordinary acceptance remains `.github/workflows/native-player-upload.yml`; its real fixture preparation, local worker, Firestore/Storage project and equivalence checks are unchanged. Optional local `AOF_NATIVE_PERF_CONCURRENCY=2` uses explicit Game allowlists and independent users; it never bypasses GUID admission. `AOF_REPLAY_UPLOAD_PERF_TRACE=1` enables numeric diagnostics only in the local test process, leaves the public callable response unchanged and emits no player/source/raw-statistics identifiers. Diagnostic-off behavior and trace-on publication/retry parity have regression coverage.

After the workflow's pinned corpus preparation and normal Functions build, reproducible repeated ordinary diagnostics use the existing acceptance through its guarded support runner:

```sh
export AOF_NATIVE_CORPUS=/absolute/prepared-corpus
export FUNCTIONS_EMULATOR=true
export AOF_BENCH_PYTHON=/absolute/pinned-python
export AOF_REPLAY_UPLOAD_PERF_TRACE=1
npx --yes firebase-tools@14.27.0 emulators:exec --project demo-aof-native-player \
  --only firestore,storage "node functions/tests/support/native-player-performance-runner.mjs"
```

The default is three serial trials with a persistent local worker and a fresh demo Firestore per trial. For one independently authenticated mixed-load trial set `AOF_NATIVE_PERF_CONCURRENCY=2`, `AOF_NATIVE_PERF_TRIALS=1`, and `AOF_NATIVE_PERF_SERIES=concurrent`. The runner refuses any other project or non-loopback emulator endpoints, computes the exact native processor revision and starts/stops only its own loopback worker. No recording or full statistics payload is committed in these reports.

- **P0:** this baseline and minimal tracing/harness PR, owned by the dedicated performance worker.
- **P1:** existing time-window index in native transport only if authentic complete-statistic/retained-event parity and meaningful measured gain pass. Separate PR; no flags or cutover.
- **P2:** real browser/Auth/callable/actual BattleDetails source-bound paint harness using existing emulators and CI Chromium. Must include client serialization, network, readiness reads/rendering, pending official outcomes, failures and correction races. Current local browser failure does not close this work.
- **P3:** choose the smallest extraction/hydration change from the measured profile. Preserve validators and immutable events; no new parser or alternate source database.

INT-V1 integrates accepted changes without conflicting with Workers 1/4/Personality/Chronicle ownership. Independent #132 repeats the accepted exact INT head, four-format p50/p95/error distribution and correctness gates. A meaningful sample count, declared client/network/concurrency envelope and separately authorized bounded cloud window remain necessary for release acceptance. No deployment, resource change, feature activation or stopped staging E2E restart was performed.
