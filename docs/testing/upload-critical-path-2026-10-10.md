# Upload-to-ready critical path experiment — 10 October 2026

Status: **draft, not connected to production**. Goal: sub-20-second normal processing, 25–30 seconds as upper normal target. The serving/StatisticsExperience path is intentionally untouched.

## What was instrumented

1. Existing `replay-tools/upload_worker.py` worker: request Base64 decoding, source write, `parse_replay.build_payload` internal preflight/decode/full canonical seal, replay-free statistics projection, full JSON output, canonical bundle ZIP, response-object/HTTP JSON encoding. Opt-in safe worker trace: `AOF_REPLAY_WORKER_PERF_TRACE=1`.
2. Existing `functions/src/commands/statistics/uploadReplay.ts` authority reads, full worker roundtrip, mapping/encoding, separately verified Cloud Storage writes, READY transaction and result resolution. Opt-in log only: `AOF_REPLAY_UPLOAD_PERF_TRACE=1`. No source identity, player names, chat, input bytes or stats logged; only durations and input length.
3. Experimental direct path: same source bytes, immutable directly extracted Recorded Events (including both hashes, chronology, footer and bounds), replay-free analysis, existing unchanged inference/social models, PR #93 producer-shared statistics, compact JSON/gzip. The fixture pairing and build metadata are checked before each benchmark.

**Important non-equivalence of boundaries:** The existing local timing includes an encoded HTTP *response* containing full statistics and a canonical ZIP, but not network delivery. The direct candidate timing ends at locally verified binary evidence and direct compact statistics artifacts, not a published HTTP/API result. Neither is the actual Firebase upload-to-READY result. Do not infer a production SLA or declare a final cutover from these results.

## Initial nine-fixture comparison (CI run 38069722625)

Fixed build-185872 source corpus revision: `2d04ec6adbe871d156c108a4351448efeb08f4e6`. One sample per fixture and procedure on each GitHub-hosted Ubuntu/Python 3.12 job. Recording extraction and worker response encoding are included for the legacy path; extraction, local verification, analysis/projection and compact artifact writing are included for the direct path.

| Fixture | Existing Python worker, s | Direct candidate, s | Local direct under 30s? |
| --- | ---: | ---: | :---: |
| 1v1_t90-deak | 105.82 | 12.26 | Yes |
| 1v1_t90-dobb | 154.07 | 18.45 | Yes |
| 1v1_t90-hack | 81.96 | 9.08 | Yes |
| 1v1_t90-resi | 181.88 | 20.56 | Yes |
| 2v2_arabia | 244.10 | 29.66 | Yes |
| 2v2_chaos | 368.47 | 51.40 | **No** |
| 2v2_nomad | 83.33 | 8.44 | Yes |
| 4v4_arabia | 101.86 | 20.91 | Yes |
| FFA_7 | 95.10 | 13.12 | Yes |

All nine initial benchmark jobs passed. These are not comparisons of equivalent persisted formats, and TownBell's report is a paired control, not an exact golden for AoF-specific social interpretations.

The legacy canonical-seal step dominated the first four 1v1 runs (70.85–159.61 seconds), 2v2 Arabia (212.30 seconds), 2v2 Chaos (305.48 seconds), 2v2 Nomad (72.93 seconds) and 4v4 Arabia (75.47 seconds). This strongly supports replacing redundant canonical artifact construction/revalidation when retaining the approved decoded-events contract; **do not** simply skip validation on the existing canonical format.

## Follow-up profiling: fused verification and direct inference stages

An additional **optional** path now lets `extract_recorded_events` build the statistical analysis index on its one exhaustive `read_records` verification pass. The standalone extractor still verifies independently. The generated artifact is published locally only *after* stream consumption/validation, and failures leave no destination. The existing full-conformance worker is untouched.

A separate candidate-only CI run (38070517543, before later indexed-action/fast-hash experiments) observed:

| Fixture | Fused direct local time | Extraction + verified hydration | Statistics projection | Local target |
| --- | ---: | ---: | ---: | --- |
| 1v1_t90-resi | 17.62s | 16.85s | 0.64s | Under 20s |
| 4v4_arabia | 26.12s | 12.35s | 11.04s | Under 30s |
| FFA_7 | 15.17s | 7.90s | 6.95s | Under 20s |
| 2v2_chaos | 56.01s | 41.85s | 12.66s | **Still too slow** |

Cross-run timing variation is material, so this is not a controlled estimate of the fusion's own isolated speedup. For 4v4, 3.61s within projection was shared-field packaging and 3.00s Skirmish detection. Chaos had 26.54s decoding/event writing, 14.94s verified reading/hydration, 5.05s Skirmish detection and 1.81s shared packaging.

## Subsequent unapproved optimizations

The branch experiments with:
- CPython's fast whole-value canonical JSON encoder for episode field fingerprinting. A test verifies SHA/byte-length agreement with the old streaming encoder.
- Batching bounded streaming JSON output writes without modifying their exact bytes.
- An **opt-in** monotonic-timestamp index to constrain Skirmish supporting-event/pair-evidence and Battle enrichment scans to inclusive clock windows. If timestamp ordering is missing, invalid or non-monotonic, it conservatively falls back to the original complete event list.
- Full-result equality tests between indexed and unindexed detectors, plus real 1v1/2v2/4v4/FFA parity jobs. No detector formula, source evidence or score policy changes are intended.

These later optimizations are **not approved as proven speedups** until their real equivalence and timing jobs succeed. The old extraction and existing statistical read models remain the default.

## Release gates and next measurements

1. Real complete-statistics equality, source events integrity, directionality and qualification coverage across current-build corpus, including FFA.
2. Repeated cold and warm runs on production-like worker capacity; stage timings including Functions request received, HTTP worker roundtrip, verified Cloud Storage writes, immutable READY transaction, official result resolver and view availability.
3. Verify no regression in Battle/Event/Season/Player statistics or derived social history. Authentication and read latency must remain seamless.
4. Review irrecoverably discarded raw replay fields before replacing canonical retention with decoded-only Recorded Events. New extraction semantics and identities are versioned, not silently grafted onto legacy result rewards.
5. Do not change production paths, results, points or social rewards based on this branch. Production cutover requires immutable publication, native provenance/read-model adaptation and explicit review.

Under-20 and 25–30-second targets refer to **server-received-upload to READY**, not the local timings above.
