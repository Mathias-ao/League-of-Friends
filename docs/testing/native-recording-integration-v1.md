# Native Recording Integration V1 — validation acceptance

10 October 2026. Experimental branch based on PR #95 (which depends on #94/#93/#89). Nothing deployed, merged or enabled for ordinary users.

**Historical validation-only acceptance:** retained unchanged below. Native statistical equivalence was already established here. For the subsequent ordinary participant upload-to-READY lifecycle, see [native-player-upload-v1.md](native-player-upload-v1.md).

## Outcome and acceptance boundary

The actual `uploadReplay` handler can retain an original recording, call the authenticated native worker without a canonical ZIP, verify and retain immutable event/statistics artifacts, resolve league player mappings and atomically publish a bounded preview candidate. It deliberately ends at `VALIDATED_NOT_READY`, never READY. The complete upload-to-READY objective is **not yet satisfied**; this is reviewable validation infrastructure, not authorization for a READY staging rollout.

Explicit request `processingMode: NATIVE_VALIDATION_V1` is required. Omitted mode and `LEGACY` retain the existing pathway. Native shared statistics use the explicit versioned selective adapter solely for preview read models; they are never passed off as ordinary full-statistics JSON.

## Safety and storage

The route requires ADMIN, `AOF_NATIVE_REPLAY_INTEGRATION=validate-v1`, matching `AOF_NATIVE_REPLAY_PROJECT`, staging or an isolated demo emulator, an exact `AOF_NATIVE_REPLAY_GAME_ALLOWLIST` entry (`matchId/gameId`), worker authentication and a pinned `AOF_NATIVE_REPLAY_PROCESSOR_REVISION`. No flag permits native READY.

The original recording is retained permanently under `native-replay-evidence/{match}/{game}/{sourceSha}/source.aoe2record`. Events and native shared statistics live below the content-derived artifact revision. Create-only generation preconditions and generation-pinned download/hash verification protect all three objects. Existing mismatched bytes fail closed; retries never overwrite or delete them. This integration requires original retention because V1 omits undecoded source bytes.

Version, compressed and uncompressed hashes, byte lengths, source identity, chronology/footer counts, extraction bindings, source slots/names and shared references are verified. The authenticated pinned Python worker remains the full decoded schema authority. Offline package verification independently restores shared statistics and compares the complete current projection, including neutral pair-social evidence. JavaScript does not invent an alternative Python JSON content-addressing algorithm.

Existing player resolution is followed by unique roster/slot coverage checks. Slots cannot become league IDs. A deterministic job, ten-minute lease and owner fencing prevent duplicate publication. Publication transactionally rechecks Game, match, roster and administrator authority. Changed inputs abort. Failed/expired work can retry; immutable objects remain available. Completed identical work returns its existing candidate without calling the worker.

Only `nativeReplayValidationJobs` and `nativeReplayValidations` are written under the Game. Candidates carry `active:false`, `leagueEffectsPermitted:false`, qualifications and separate source/extraction/projection provenance; league interpretation is null. No active recording pointers, official results, aggregates or social awards are changed. Flag removal immediately disables new native requests; legacy remains independent. Failed jobs may leave retained immutable artifacts; cleanup/lifecycle policy is deliberately deferred.

## Validation

- TypeScript build passed; backend suite: **238 passed, zero failed/skipped**.
- Replay-tools suite: **302 passed, four skipped, zero failed** (306 total, 82.842 seconds). The four historical opt-in golden cases remain outside this sign-off; inherited mismatches were not rewritten.
- Actual build-185872 1v1, 2v2, 4v4 and FFA/diplomacy recordings passed local HTTP worker plus Firestore/Storage emulator integration, starting at `uploadReplay.run`. A fifth run repeated 1v1 warm.
- Complete restored statistics and neutral pair-social evidence matched the existing full projector for all four stored packages. Preview and aggregate-engine outputs matched the full-reference inputs. This verifies projection equivalence, not live Battle/Event/Season/Player website navigation or native correction workflows.
- Corrupt existing source, invalid artifact/version/hash/chronology, wrong mapping, changed authority, concurrent lease, expired lease recovery, late-worker fencing and flag rollback were exercised. Games remained unchanged and no replaySources were created.
- Upstream #95 Backend, Replay Tools, website, Three-Battle and Native Worker Acceptance CI were successful when refreshed; Upload Critical Path Benchmark remained queued. These are upstream results, not CI certification of this branch.

## Measured latency

Seconds; actual handler + authenticated local HTTP worker + Firebase emulators. External callable HTTP/authentication overhead, Cloud Run startup and live Firebase latency are **not measured**. OS caches were warm. First worker request is process-cold, not VM/container-cold. One run per case plus one repeat is not a percentile benchmark.

| Fixture | Received to worker response | Worker HTTP | Original store/verify | Response verify | Derived store/verify | Read model | Candidate publication | Total to validation |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1v1 first | 13.621 | 13.310 | 0.125 | 0.419 | 0.082 | 0.013 | 0.136 | **14.279** |
| 2v2 | 20.745 | 20.415 | 0.152 | 0.678 | 0.104 | 0.002 | 0.125 | **21.662** |
| 4v4 | 25.359 | 25.042 | 0.132 | 0.948 | 0.157 | 0.003 | 0.118 | **26.609** |
| FFA diplomacy | 17.597 | 17.296 | 0.126 | 0.443 | 0.074 | 0.002 | 0.072 | **18.209** |
| 1v1 warm repeat | 13.400 | 13.147 | 0.104 | 0.419 | 0.058 | 0.001 | 0.084 | **13.966** |

Received-to-worker includes preceding authority/source persistence; columns overlap and are not additive. Mapping and other stages are in the machine-readable report. READY publication and total-to-READY remain null. 2v2 and 4v4 exceed the ideal 20 seconds. 4v4 worker extraction/verified hydration (~13.2 seconds), projection (~9.1 seconds), then serialization/gzip (~2.5 seconds) dominate. No performance validation was weakened. This run does not qualify other unusually long fixtures.

| Fixture | Original bytes | Events gzip bytes | Shared statistics gzip bytes |
|---|---:|---:|---:|
| 1v1 | 3,781,255 | 1,725,962 | 149,812 |
| 2v2 | 5,558,786 | 2,671,363 | 480,227 |
| 4v4 | 5,129,372 | 2,515,319 | 1,994,484 |
| FFA | 4,408,509 | 2,068,220 | 423,533 |

No new peak-memory measurement was made. The full expanded 4v4 statistics output is approximately 403.6 MB; bounded preview projection avoids creating that JSON in upload handling. Detailed delivery still needs qualification. An emulator Storage dependency emitted a MaxListenersExceededWarning; verification succeeded, but the warning was not investigated in this scope.

Evidence: [timing and failure report](benchmarks/native-recording-integration-v1/report.json), [complete statistics equivalence](benchmarks/native-recording-integration-v1/equivalence.json).

## Reproduction

Build and run `npm test` in `functions`. The opt-in emulator runner is `functions/tests/native-recording-emulator.mjs`, run from the repository root after building. It requires `GCLOUD_PROJECT=demo-aof-native-integration`, `FUNCTIONS_EMULATOR=true`, loopback `FIRESTORE_EMULATOR_HOST` and `FIREBASE_STORAGE_EMULATOR_HOST`, an authenticated local worker and matching worker URL/token settings used by uploadReplay. Use isolated Firestore and Storage emulators, not a live project.

`AOF_NATIVE_FIXTURES` points to a private local JSON array with each fixture's absolute `path`, `gameBuild:185872` and `players:[{replaySlot,sourceName}]`. The runner creates synthetic league identities and appends a warm repeat. Do not commit that manifest, tokens or generated packages. Pin the worker's actual code/decoder revision by calling `native_worker_transport.native_processor_revision()` with the installed replay-tools environment. Worker enablement remains separately gated by PR #95. The runner emits `.replay-lab/native-integration/report.json` and stored packages; `verify_native_package.verify(package, source)` performs the independent complete-statistics check.

## Blockers before READY or controlled READY staging rollout

1. Qualify bounded detailed-statistics delivery and all existing user-visible consumers; shared statistics cannot replace the full JSON contract implicitly.
2. Adapt and qualify native social readers/provenance, including neutral evidence, source qualification and the existing canonical-manifest assumptions. The older gzip social-reader defect is separate work, not silently fixed here.
3. Qualify native official-result/dispute/correction bindings, idempotent activation and existing aggregate/social lifecycle behavior. Current candidate isolation proves absence of effects, not correctness of future activation.
4. Run genuine controlled Firebase end-to-end tests with real admission/mapping, browser consumers and cold/warm cloud timings. Review storage retention/access/lifecycle policy. AI recordings remain unsupported; this route also caps decompressed shared statistics at 64 MiB, events at 512 MiB and compressed artifacts in aggregate at 48 MiB.

The next change should address these compatibility gates without changing statistics models or league scoring. This branch must not be described as a finished native READY pipeline.
