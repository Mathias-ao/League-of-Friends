# Replay/statistics performance baseline — 9 October 2026

Status: **instrumentation added; full replay timing/size baseline not yet measured**. The reported ~150-second 4v4 processing time is an observation to reproduce, not a benchmark result or an established bottleneck.

## Scope and invariants

Optimize local extraction, canonical evidence publication, replay-free analysis/statistics, artifact sizes, peak memory, and eventually authenticated large-file upload. No statistics are removed, suppressed, redefined, or rounded differently. CanonicalReplay remains permanent source evidence, and the original recording remains a temporary upload. Do not replace exhaustive production conformance with Replay Lab's fast structural seal.

## Current pipeline

- **Replay Lab:** browser upload → parse_replay.py with fast seal → canonical bundle → analysis_dataset.py (already sealed) → statistics_projector.py on analysis. Its current cards separate upload, parse/canonical write, canonical seal, analysis cache and statistics projection.
- **Worker upload:** base64 JSON request → full build_payload conformance seal → project_statistics without re-running full validation (but building analysis from canonical) → writes statistics.json *inside* canonical directory → ZIPs entire directory → returns statistics JSON plus a base64 ZIP over HTTP.
- **Callable upload:** receives and forwards base64 replay, decodes ZIP, writes canonical ZIP and separate statistics JSON to Storage, then downloads both to verify hashes. The worker accepts at most **32 MiB** of recording data and **48 MiB** per request. This does not establish that every size below the limit works end-to-end.
- **Canonical evidence:** fact, terrain and initial-object streams are chunked gzip JSONL. All raw evidence, versions, provenance, hash integrity, coverage warnings, conformance and replay-free rebuildability must be retained.

Possible overhead seen in code, **not yet measured**: base64/JSON copies, ZIP DEFLATE over gzipped canonical chunks, duplicate statistics in the archive and standalone object, full-file re-download after Storage persistence, and repeated read/hash/decompression across stages. Do not remove validation just to save time.

## Benchmark procedure

Use Python with the pinned replay-tools requirements and run from repository root:

~~~bash
python -m pip install -r replay-tools/requirements.txt

# Lab-like development path:
python replay-tools/benchmark_replay_pipeline.py replay-fixtures/4v4.aoe2record --seal-mode fast --archive --output /tmp/aof-4v4-fast-1

# Production-like full conformance (but not actual HTTP/callable transport):
python replay-tools/benchmark_replay_pipeline.py replay-fixtures/4v4.aoe2record --seal-mode full --archive --output /tmp/aof-4v4-full-1

# Scaling comparisons:
python replay-tools/benchmark_replay_pipeline.py replay-fixtures/1v1.aoe2record --seal-mode fast --archive --output /tmp/aof-1v1-fast-1
python replay-tools/benchmark_replay_pipeline.py replay-fixtures/2v2.aoe2record --seal-mode fast --archive --output /tmp/aof-2v2-fast-1

# Standalone instrumentation helper tests (no mgz dependency):
python -m unittest replay-tools/tests/test_benchmark_replay_pipeline.py -v
~~~

Each run requires a **new output directory**. The generated benchmark-report.json contains replay SHA-256, Git commit, platform, per-stage wall time, sampled Linux child peak RSS, parser inner timings, canonical file-size breakdown, analysis/statistics/archive sizes, output statistics hash and exact-byte re-projection checks. Two re-projections run by default; they are *additional* diagnostic stages and should not be included in normal import latency.

Run **at least three fresh invocations per fixture and mode on the same machine**, recording medians and variation. The 4v4 fixture is 4,455,725 bytes in the inspected repository tree. Its actual generated output sizes, memory and ~150-second anecdotal wall time must be measured, not inferred from that source size.

Inspect these timing segments independently:

1. Source preflight/header versus replay decode and canonical write.
2. Fast versus full canonical seal (different assurances; not interchangeable).
3. Analysis-cache generation versus initial and repeated replay-free projection.
4. Worker-format ZIP packaging time and archive/storage byte sizes.
5. Child peak RSS per stage (Linux /proc VmHWM sampled at ~20 ms; null elsewhere).

The benchmark **does not measure** browser transfer, worker HTTP and base64 serialization, Cloud Functions, Storage persistence/readback, concurrency or upload retries. Worker ZIP creation is measured with its actual packaging function, but only in the local CLI path.

## Optimization priorities once measured

1. Profile the slowest actual phase (such as replay decode, conformance or a statistics model) before modifying it.
2. Remove avoidable duplicate work *after* a proven validated/sealed boundary without weakening source/chunk hashes, completeness, conformance or coverage.
3. Compare ZIP compression settings for already-gzipped chunks. Verify consumer requirements for the duplicate statistics copy inside the canonical ZIP before considering removal.
4. Reduce worker ZIP in-memory buffers, path.read_bytes, base64 payload copies and Callable memory where profiling warrants it; keep complete-byte integrity checks.
5. Evaluate authenticated direct-to-Storage or resumable/chunked upload, bounded requests, idempotent retries and timeouts for large recordings. Never delete the source before confirmed durable evidence.
6. Re-run duels, 2v2, 4v4, FFA and long/current-patch replays, including concurrent jobs, after every change.

## Release gate

Require zero unexpected changes in semantic goldens, source hashes, coverage/N/A behavior, player attribution, timing/ordering, model versions, conformance, correction/duplicate processing and canonical replay-free rebuildability. An exact-byte comparison across *fresh extractions* is inappropriate because extraction identifiers/timestamps and source manifest hashes can vary. The built-in exact-byte re-projection check only asserts deterministic re-projection of the **same** cached analysis and complements, but does not replace, existing golden/conformance tests.

Accept optimization only with measured reduction in time, bytes or peak memory and unchanged valid results. Establish numerical targets after the baseline. Upload reliability requires actual boundary/interruption/retry tests.

## Instrumentation verification

Syntax-check and three helper tests passed in a standalone Python environment (hashing/sizes, successful and failing child stages, missing-input preflight). Full 4v4 processing was **not** run in that environment because the replay fixture and mgz-fast were not available there; no 4v4 timing, size or peak-memory improvement is claimed.
