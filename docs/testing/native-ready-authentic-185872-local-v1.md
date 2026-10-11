# Authentic AoE2 DE build-185872 — local reviewed-READY acceptance (V1)

**Status: opt-in runner proposed for review; not executed against an authentic private recording in CI.** This milestone is code/test preparation, not a completed real-recording acceptance certificate. It requires a genuine build-185872 source, an authenticated local native worker and local-only Firestore/Storage emulators. Do not commit or upload source replays, fixture manifests, Steam names, secrets or generated reports.

## Exact scope

A single **authentic human 1v1** recording verifies the path omitted by previous tests:

1. Call the actual `uploadReplay.run` handler with the original `.aoe2record` and `NATIVE_VALIDATION_V1`, authenticated through local synthetic ADMIN/Steam-name mappings. Assert it stops at `VALIDATED_NOT_READY` and has no READY source.
2. Re-read the permanently retained original, Recorded Events and compact statistics at their pinned Storage generations. Check stored length and SHA-256. The source hash comes from the original bytes, not from manifest metadata.
3. Set an **independently reviewed synthetic Game result** supplied explicitly in the private manifest; the recording itself is not permitted to establish the league winner. This does not imply the historic match was played by the synthetic AoF accounts.
4. Enable the reviewed native publication/read flags **only inside this local test process** for exactly this Game. Use the existing `executeNativeReadyPublication(PUBLISH)`, never automatic validation-to-READY.
5. Assert the active READY source passes the normal `activeNativeStatisticsSource` gate and authenticated member evidence loaders. List a bounded Battle-detail page and load native social Battle-record overview; require a disabled reader flag to fail closed. The source must not reconstruct or transfer the 400+ MB legacy expanded statistics JSON.
6. Retry the exact PUBLISH request read-only; rollback with the independent manual `ROLLBACK` gate, require source pointer restoration, GUID-claim release, closed normal reader access and permanent source/artifact retention.
7. Save only a local hashed/aggregate report with stage timings. No points or social awards are issued by this source-only experiment.

This is deliberately **not** the recording-bound result correction scenario in PR #107, nor a real Event flow. That path is already covered synthetically by the trigger-emulator workflow, and its real-file acceptance remains a separate extension.

## Private fixture

Write a JSON file **outside the repository**, e.g. `/private/aof/185872-one-v-one.json`:

```json
{
  "path": "/private/aof/one-v-one.aoe2record",
  "gameBuild": 185872,
  "format": "1v1",
  "players": [
    {"replaySlot": 1, "sourceName": "EXACT_REPLAY_DISPLAY_NAME_1"},
    {"replaySlot": 2, "sourceName": "EXACT_REPLAY_DISPLAY_NAME_2"}
  ],
  "reviewedOfficialWinnerReplaySlot": 1
}
```

The operator must independently establish that the recording is **actually from build 185872** (and retain that provenance privately). The manifest declares the build; this runner does not constitute independent game-build attestation by itself. Exact source-name spellings must be derived from the recording; winner selection is a separate, reviewed synthetic testing choice and must not be silently inferred from replay winner flags.

## Running locally

Install/build `functions`; run the pinned replay-tools/native worker supporting `POST /process-native-v1` on a loopback HTTP endpoint with a private bearer token. Reuse the worker setup from [native-recording integration acceptance](native-recording-integration-v1.md) and verify its actual `native_processor_revision()` SHA.

Example shell setup (replace placeholders **locally** and never commit values):

```sh
export FUNCTIONS_EMULATOR=true
export AOF_NATIVE_READY_REAL_FIXTURE=/private/aof/185872-one-v-one.json
export REPLAY_WORKER_URL=http://127.0.0.1:8765
export REPLAY_WORKER_AUTH_TOKEN='<locally generated bearer token>'
export AOF_NATIVE_REPLAY_PROCESSOR_REVISION='<64-character current worker SHA>'
npx --yes firebase-tools@14 emulators:exec \
  --project demo-aof-authentic-ready \
  --only firestore,storage \
  "node functions/tests/native-ready-authentic-emulator.mjs"
```

The script refuses a live/non-demo Firebase project, remote Firestore/Storage, a non-loopback worker, a different Storage bucket, a missing pinned processor revision, or a reused Match. Output is local `.replay-lab/authentic-185872-ready/report.json`; the original recording and manifest remain in private operator storage. The test runner never configures deployed Firebase environment flags. Use a fresh isolated emulator between attempts.

CI can `node --check` this script without the private recording, but **a green CI result is not evidence that the authentic test executed**.

## Acceptance record and remaining gates

The report must be attached to the engineering review **only after a real run**, with potentially identifying hashes handled under project evidence policy. Capture the exact worker revision, game-build provenance, original bytes, decoded/source verification, READY and rollback states, read-payload bounds and timing by stage. Any failed publication/read/rollback is a test finding, not permission to relax source or official-result gates.

The historical local authentic-recording validation benchmark already recorded 14.279 s (1v1), 21.662 s (2v2), 26.609 s (4v4), and 18.209 s (FFA) **only to VALIDATED_NOT_READY**. This new local test measures explicit manual publication and bounded readers, not true automatic server-received-to-READY.

**Outstanding after this milestone:** repeat with 2v2, 4v4 and FFA and source-grounded individual values; use real admission and browser sessions; verify full chronology/social/Chronicle/Season outputs, automated trigger delivery under authentic evidence and replay/retry races; measure cloud cold/warm upload/worker/Storage/READY/view timings and capacity in separately authorized staging. A manual PUBLISH path cannot certify automatic normal upload-to-READY. The product goal is under 20 seconds server-received-to-READY (25–30 s upper normal target); no such real cloud result is claimed by this local test.

**Governance:** merging this test is not deploying it, and neither merging nor deploying is permission to activate native READY for players.
