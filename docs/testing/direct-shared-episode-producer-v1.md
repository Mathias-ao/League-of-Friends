# Direct shared episode producer — experimental V1

**Draft only; no production publication, schema substitution, score, social or website changes.**
Branch is based on `experiment/recorded-events-v1` (PR #89), independent of offline cache PRs #91 and #92.

## Hypothesis

The enormous full statistics JSON primarily repeats already-shared Python engagement objects in many per-player episode arrays. A new output mode should preserve the existing detectors and all statistics while avoiding repeated serialization of these objects. Further repeated nested fields can be interned exactly once per unique producer episode rather than once per player/classification.

## Implementation

- `engagement_statistics.project_engagement_statistics(..., episode_sink={})` exposes the five unique detector-owned episode collections before per-player assembly: skirmishes, battles, reinforcements, defensive assists, cooperative attacks.
- `statistics_projector.project_statistics_from_analysis(..., direct_shared=True)` runs the **same** formulas, validates the **full canonical statistics** schema, and computes pair social evidence and episode context *before* converting the output to a derived compact representation. Default behavior is unchanged.
- `statistics_direct_shared.to_direct_shared_statistics` resolves per-player episode objects by Python identity, not by repeatedly JSON-hashing every player's copy. Great Battles and received/given evidence reference their original parent episodes. Repeated large nested fields are SHA-256 interned once per unique producer episode.
- `restore_full_statistics` verifies nested hashes and reconstitutes the full legacy statistics structure for **offline validation only**.
- Replay-free CLI opt-in: `python replay-tools/recorded_events_stream.py --events events.gz --metadata events.gz.metadata.json --direct-shared --out direct.json`. The default CLI still writes unchanged full statistics.

The in-memory inference engine still creates per-player evidence reference lists so existing social interpreters can run unchanged. This experiment primarily targets *expanded serialization* and repetitive packing. It is not yet a fully bounded-memory streaming inference engine, and the compressed detail representation is not yet an authenticated website API.

## Actual performance acceptance

GitHub workflow `Direct Shared Producer Benchmark` runs current build-185872 **1v1, 4v4 and FFA** against the same independently extracted Recorded Events object:

1. Project legacy full statistics and stream the full JSON; measure whole projection + serialization wall time and peak resident memory.
2. Project direct shared JSON and stream it; measure the same metrics independently.
3. Restore all shared episodes into complete statistics and compare the entire result **exactly**, including pair evidence and every player's categories, qualifications and match facts.
4. Measure actual JSON and gzip byte sizes. Store only small timing/resource/report artifacts, not full generated output.

TownBell is checked for correct fixture/build pairing; model-specific TownBell metric correctness still requires separate qualification reviews.

**Decision gate:** Choose direct emission only if full equivalence passes and real total CPU/memory/delivery tradeoffs improve. If memory remains dominated by skirmish inference, profile detectors separately. No production deployment, permanent artifact-format approval or deletion occurs in this PR.

## Real build-185872 benchmark — completed (10 October 2026)

Four cases ran on GitHub-hosted Ubuntu/Python 3.12 with the **same fixed Recorded Events source in both modes**, at fixture SHA `2d04ec6adbe871d156c108a4351448efeb08f4e6`. All four comparisons passed complete JSON object equality *after reconstruction*, not just selected player metrics; therefore all existing neutral pair/social objects, coverage claims, episode classifications, simple measurements, identities and match facts were preserved exactly.

| Fixture | Full JSON MB | Direct JSON MB | Full gzip MB | Direct gzip MB | Full projection+write s | Direct projection+write s | Full peak RSS MB | Direct peak RSS MB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1v1 T90 Deak | 5.26 | 1.84 | 0.265 | 0.147 | 4.68 | 4.51 | 65.5 | 63.9 |
| 2v2 Chaos | 110.52 | 23.42 | 3.706 | 1.137 | 37.85 | 27.47 | 161.6 | 160.5 |
| 4v4 Arabia | 403.57 | 56.93 | 10.775 | 1.995 | 37.60 | 23.90 | 200.8 | 200.5 |
| FFA 7 | 24.03 | 6.70 | 1.040 | 0.477 | 8.83 | 8.38 | 151.3 | 150.7 |

MB is decimal (1,000,000 bytes), including RSS conversions from `/usr/bin/time`'s KiB output. Timings are single wall-clock samples, inclusive of replay-free analysis hydration, statistical projection, internal schema validation, social inputs, and streaming JSON serialization; **Recorded Events extraction is excluded**. Gzip size is a separately measured presentation comparison, not included in these elapsed projection/write timings. These measurements are not cloud request-latency or production ingest results.

On the 4v4, this is **36.4% faster** than the full representation and **81.5% smaller** after gzip. On 2v2 Chaos, it is **27.4% faster** and **69.3% smaller** after gzip. Differences on 1v1/FFA are more modest.

Crucially, peak resident memory barely changed. That confirms the old 403 MB serialized report largely represented repeated Python object references, not 403 MB of separate resident Python episode objects. The current parser/detectors remain the main candidates if peak-memory optimization becomes necessary.

Run: `Direct Shared Producer Benchmark` workflow on this PR, including all four sample cases. The original full-statistics mode and all existing consumers remain untouched. The next release gate is **small authenticated player-facing read models, immutable derived artifact publication, and revision-safe social adapter compatibility**. This experiment does not meet those gates and must remain draft.
