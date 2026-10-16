# Ordinary Recorded Events V1 upload — implementation handover

16 October 2026. PR [#119](https://github.com/Mathias-ao/League-of-Friends/pull/119), branch `feat/ordinary-native-recording-upload`.
Verified main baseline: `f5924f2bad249beb9e940f3f38417c0382d2f0ea`.
Implementation commit: `bea7a0f00f98198fc2f2a2309e59fc94d5d49460` (tree-identical to locally tested `3fe31aae15dbd372c443b8846cc3d12b8d5cc4c8`).
This is reviewable, default-off source implementation, not a deployment or activation certificate. No live flags, staging E2E, production or merge occurred.

## Implemented contract

The ordinary website sends `AUTO` to the existing `uploadReplay` callable. The server selects Recorded Events V1 only for explicitly allowlisted human `.aoe2record` Games behind `AOF_NATIVE_PLAYER_UPLOAD=recorded-events-v1`; otherwise existing legacy processing remains. Omitted mode and explicit `LEGACY` retain compatibility. A selected native failure does not silently fall back to legacy.

`nativePlayerUpload.ts` additionally requires the exact project, processor SHA, worker credential and both existing bounded-reader gates. Only staging or a demo project with `FUNCTIONS_EMULATOR=true` can pass; production is rejected. This document does not authorize enabling those gates.

`nativeRecordingValidation.ts` reuses retained originals, native worker package verification, immutable artifact generations, roster mapping and source identity. The internal ordinary entry is authorized through current membership, auth link, Game participation, play window and source/result authority; it does not grant players administrator publication access.

`nativePlayerRecording.ts` reuses the existing package verifier and publication helpers, rechecks artifacts and authority, then atomically publishes the source, active pointer, revision, GUID claim and audit. Originals, Recorded Events and compressed shared evidence remain retained. Statistics become READY even if no supported winner exists. The unchanged `deriveRecordingOutcome` evaluator is admitted through `resolveRecordingResult`; accepted results, pending review, disputes, correction fences and downstream reward processing retain their existing semantics.

Bounded Battle detail and statistics readers accept provisional ordinary-native evidence. Pending evidence is excluded from accepted-result aggregates and official social/history readers. Accepted native results use existing authorized read-only history. No giant canonical archive or giant statistics endpoint response is recreated. No parser, detector, formula, winner rule, social progression or numeric policy was introduced.

Transactions fence stale authority/revisions, competing requests and cross-Game GUID claims. Retries use the active source and publication journal. Pending source replacement retains previous sources and claims. Administrator rollback is limited to a pinned unresolved first upload; accepted results require existing review/correction. Native predecessors are now preserved by that existing correction path. A rolled-back source is not implicitly resurrected by an ordinary retry.

## Acceptance evidence

- Backend build and 375 tests passed locally; website build and 79 tests passed locally.
- The [ordinary lifecycle report](benchmarks/native-player-upload-v1/report.json) uses real `uploadReplay.run`, authenticated native HTTP worker and Firestore/Storage emulators. Independent TownBell expectations and original recordings are pinned to fixture commit `2d04ec6adbe871d156c108a4351448efeb08f4e6`.
- Authentic 1v1 and 4v4 resolve to the independently expected accepted outcomes. Custom-map 2v2 and FFA remain pending under existing rules while publishing READY statistics. The test subsequently exercises existing administrator review for 2v2, authorized bounded readers, read-only Chronicle, aggregate exclusion, reward idempotency and retry revisions.
- Concurrent ordinary requests, failed processing with original retention and retry, cross-Game GUID conflict, changed authority and corrupted artifacts pass emulator rejection checks. Focused tests additionally cover admission revocation, stale revisions, accepted/disputed results, immutable artifacts, rollback, qualified native correction predecessors and equivalent supported/unsupported outcome qualifications.
- Four adjacent `*-equivalence.json` reports verify original retention and complete statistical/match-facts/pair-social projection equivalence. Established canonical/native corpus equivalence predates this task: [original benchmark](benchmarks/native-recording-integration-v1/equivalence.json). Extraction equivalence alone is not the lifecycle acceptance criterion.
- `.github/workflows/native-player-upload.yml` repeats the authentic ordinary lifecycle and projection checks. Exact-head CI status is recorded in PR #119; a pending or failed check is not acceptance.

## Limits and next bounded task

Independent integration review reproduced and fixed one correction retry regression: after replacing a qualified native predecessor, the initial reviewed correction succeeded but its exact retry incorrectly required a legacy predecessor. Retry now compares the same retained native fingerprint as initial publication. Regression tests cover same/different GUIDs, read-only successful retries and rejection of altered predecessors; backend build/type-check and 376 tests pass, alongside the website build and 79 tests. Exact-head CI must still be checked on the final PR commit.

This emulator acceptance invokes the callable handler with bound authentication, rather than a browser or external callable/Auth HTTP transport. Existing separate CI covers Auth/callable smoke and real correction triggers; this is not live cloud/browser acceptance or a latency guarantee. No new FFA outcome, series outcome, AI qualification, arbitrary source resurrection or wider accepted-result correction policy is added. Existing correction scope restrictions remain.

PR #114 is merged, inactive social groundwork. The unchanged [newer approved baseline](../architecture/relationship-v1-approved-baseline-2026-10-13.md) and [earlier register](../architecture/social-relationship-decisions-001-057.md) are copied from PR #113 at `3d71a5bbe710ffde97a1d96549a1f6ad7287dc3c`: SOC-058–088, REL-V1-EVID-01–06 and REL-V1-CAL-01–17 are approved design; SOC-089 is deferred. Approved design, merged prototypes, this backend implementation and deployed functionality are distinct. Reputation, directional Relationship progression and credited Chronicle interpretation remain inactive.

**Next Sol Work task:** review PR #119 against current main, require its exact-head backend/web/ordinary-upload/correction-trigger/Auth-smoke CI, and close any concrete lifecycle regression found using fixtures/emulators only. Keep native rollout off; do not deploy, merge, resume the closed staging E2E or implement social progression. Any later release requires a separate bounded authorization.
