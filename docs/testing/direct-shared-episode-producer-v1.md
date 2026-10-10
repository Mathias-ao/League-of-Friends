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
