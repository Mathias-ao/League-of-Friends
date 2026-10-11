# Native correction — automatic Functions trigger acceptance V1

Status: **proposed CI acceptance, isolated demo emulators only**. This supplements, but does not replace, [the existing transaction/processor acceptance](native-ready-correction-v1.md). No Firebase deployment, live flag change, user activation, source deletion or model change.

## Why this test is different

PR #107's Firestore/Storage emulator ran the native correction transaction and called `processMatchRewards` / `runResultProcessingJob` **directly**. It proved atomicity and function-level idempotency, but not delivery by the real Firebase `onDocumentCreated` runtime. This lane boots **Firestore, Storage and Functions emulators**, loads the normal `functions/src/index.ts` exports, and commits the same reviewed `CORRECT_REBIND_V1` operation.

The test *never calls the R2 processor* before its automatic completion. It waits for the real `processResultJob` Firestore event to claim and complete the queued `MATCH_RESULT_m_R2` job. A missing trigger or incomplete job fails the lane. It also observes the other existing Game/source/match triggers; no production handler is replaced by a test shim.

## Scenario and assertions

- Require an exact `demo-aof-native-trigger` Firebase project and loopback Firestore, Storage **and emulator hub** endpoints. Refuse reused Match data.
- Store a synthetic retained original, recorded events and compact native statistics at pinned Storage generations. Build the original 1v1 legacy official result and old GUID claim. Seed a qualifying Event/Season and old rewards, then open a dispute and validate the replacement candidate against the current disputed snapshot.
- Invoke the existing publication service using **test-local** reviewed flags. Assert one R2 job is created, then wait for the actual Functions `onDocumentCreated` handler to complete all expected steps: SCORING, GOLD, STATISTICS, ACHIEVEMENTS, RIVALRIES, RECORDS and ACTIVITY. Power Rating is intentionally excluded in this fixture, not claimed as tested.
- Assert corrected official Game/source binding, two revisioned jobs, one publication, GUID transition, Gold 3/1 → 1/3, Main-event League Points 4/10 and completed Match processing state.
- Invoke the stale R1 and already-completed R2 entrypoints **after** automatic delivery and require stable Gold ledger/amounts. These explicit repeats validate duplicate handling of the processor entrypoint; they are not simulated duplicate Eventarc deliveries.
- Re-read generation-pinned artifacts; no upload-to-READY activation or artifact deletion.

## CI / reproduction

Workflow: `.github/workflows/native-correction-trigger-emulator.yml`. It installs Node 22, Java 21 and Firebase CLI v14 on GitHub Actions, builds the backend, and runs:

```sh
npx --yes firebase-tools@14 emulators:exec \
  --project demo-aof-native-trigger \
  --only firestore,storage,functions \
  "node functions/tests/native-ready-trigger-emulator.mjs"
```

This is a separate CI workflow so failures clearly distinguish Firebase trigger delivery from the existing fast 347-test unit suite. Review the workflow status and logs before declaring the milestone passed.

## Not established by this lane

- Production or staging deployment, native READY activation, authenticated browser UX, live worker/upload timing, or real build-185872 1v1/2v2/4v4/FFA acceptance.
- Synthetic 1v1 cannot prove every Match format or the complete social/Chronicle consumer lifecycle. There is no native-to-native replacement or inverse official-correction rollback.
- No forced Eventarc duplicate notification or arbitrary downstream scheduling interleaving is injected. Stale and duplicate result processing **entrypoints** are exercised, not an invented event-delivery guarantee.
- No assertion that source rebuild is globally serialized across all independently delivered triggers: issues found during this test must be treated as staging-release blockers, not worked around by granting production permissions.
