# #143 — owner decision packet: NEW upload-only staging pilot

**Decision on 18 October 2026: NO-GO for deployment or staging execution.** Engineering preparation is verified below. Current Hosting/Functions/private Cloud Run deployment identities, protected recovery locations and legitimate staging account/Game mappings have not been inventoried or supplied. They cannot be inferred from Git commits or CI. No full pilot authorization should be requested against missing pins. The [Organiser checkpoint](https://github.com/Mathias-ao/League-of-Friends/issues/143#issuecomment-6250060630) explicitly reserves staging inventory as well as export/seeding/deploy/smoke for separate authorization; none was performed.

This is the single decision packet for a **new, bounded owner experience test**, separate from the closed 15 October session, the later statistical p95 campaign and full social **#132**. Requested changes/caps below are proposals, **not authorized or applied**. Credentials, private identities, replay payloads and raw browser/server logs do not belong in this public packet.

## Verified release identity

| Item | Exact verified pin / evidence |
| --- | --- |
| #146 reviewed head → merge | `f8fe74cb21dc46016ffd3ba0e7ed98c93752e2f2` → `fff3561ba42faba18976195ce403b49161242a6c`; exact-head observer CI successful |
| #147 reviewed head → merge | `2ece99cd37eabf6316f354e9177ceb74a3c8ce7f` → `dcde67f3df810e0de6164c39835b46c2969600a5`; all **29 checks / 12 applicable PR workflows successful**, last benchmark included |
| Reconciled main | `dcde67f3df810e0de6164c39835b46c2969600a5`, tree `6cc6bbde7b1eaaa834f103ba54ce121902eaa3a8`, identical to reviewed #147 tree. Retargeted diff contains its intended 12 files; no #146 six-file carryover. Normal expected-head merges, no protection override. |
| Frozen pilot release source | **`2ece99cd37eabf6316f354e9177ceb74a3c8ce7f`** for website, Functions and worker. It is merged and has the same full tree as the main pin above. Do not silently build a later social/main revision. |
| Website source tree | `a458a176a7dcc83be3130cf861aa0a1c9e1853a8`; proposed `VITE_AOF_COMMIT_SHA` is the frozen release source |
| Functions source tree | `e27e0dd28a7012bfaea7c1f0e106d97a5690a687`; proposed `AOF_DEPLOY_GIT_SHA` is the same frozen release source |
| Worker source tree / image label | `a9331c6c3ac9db19f94fd384158365273cae8ddc`; `org.opencontainers.image.revision` equals the same frozen release source |
| Actual image build | [CI run 39128981226](https://github.com/Mathias-ao/League-of-Friends/actions/runs/39128981226), job `117680033729`; linux/amd64, no registry push or cloud access |
| Immutable base | `python@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258` |
| Resolved Dockerfile SHA-256 | `5f7ff8cf19b34f26611a96c1c1cb737300b0b91893c020ac1bc50cf321badda9` |
| Candidate Docker config digest | `sha256:2709832d387f08143c511e846aab3d25e5654f00a0639d96ba6740563054efb3` — **not** a registry manifest digest |
| Retained image tar SHA-256 | `f34824bc6ed800e03d9e3961c6c8f3317a920c4e2dd320b9fda5b27135507831` |
| Processor recomputed **inside this image** | **`3f52fd692f77809796cde467b578a0765a066113fe74686a6d29a6684f30a339`**; read-only container with networking disabled, unprivileged image user |
| Retained artifact | GitHub artifact **`12137137895`**, ZIP SHA-256 `3a724d873585d7b03167c1843a229fb2cb37ff558b3d2a9244a9e9559192bfe7`; expires **2026-10-25T12:50:58Z**. Preserve/promote these exact bytes after authorization; do not substitute a later rebuild/tag. |

[Machine-readable build attestation](benchmarks/performance-143/owner-image-attestation.json) records these values. Source, Functions, web and worker **build inputs match**. **Live deployment matching is NOT verified.** A future permitted promotion must record the private registry `image@sha256:<manifest>` and resulting Cloud Run revision, prove it is the retained candidate, and recompute the same processor in that deployed image. Neither a config digest nor a tar/ZIP checksum is a Cloud Run registry reference.

## Missing protected facts — hard NO-GO gates

| Required before a precise full pilot GO | Current disposition |
| --- | --- |
| Exact Hosting site/channel/current rollback release/version, approved staging web App configuration and final built asset hashes | **NOT OBSERVED**. Target origin is `https://age-of-friends-staging.web.app`; that is not a deployment attestation. |
| Exact current/rollback and proposed individual Functions runtime/build/revision manifest | **NOT OBSERVED**. Source tree is pinned; deployed Functions are not. Include upload/read/navigation/auth compatibility and existing source/result/statistics/reward triggers. No blanket unrelated backend deployment permission. |
| Existing private Cloud Run origin, registry/repository, current rollback image/revision, resource/concurrency/timeouts, IAM/secret version references; candidate registry manifest and new revision after permitted promotion | **NOT OBSERVED / NOT CREATED**. Historical service name `aof-staging-replay-worker` is a reference, not a current inventory. No registry push, new repository/service or IAM change is authorized. |
| Staging database/bucket identity, rules/index/config hashes, retention/lifecycle, existing protected backup destination and restore authority | **NOT OBSERVED**. No backup export or new bucket has been made. |
| Protected owner A / independent B / ADMIN identities, current membership/auth links, exact eligible Battle/Match/Game/roster/settings/time/GUID manifest | **NOT SUPPLIED OR VERIFIED**. No cloud accounts, Games, source bindings or data were seeded. No allowlist can be approved without exact real IDs. |
| Four admitted original recordings and optional two **additional** distinct-GUID recordings, each legitimately bound to its selected fresh Game | Repository corpus below is authentic reference evidence, **not proof of admission to any staging Game**. No claim was cleared, GUID altered or historical play window fabricated. |
| Named operator, owner appointment, conservative cost reservation using actual existing allocations, protected evidence location and rollback verifier | **UNASSIGNED**. Proposed caps are below; unknown resource/backup cost blocks admission. |

These are explicit blockers, not wildcard/null authorization fields. A protected inventory/cohort sheet must contain actual values and a recorded checksum; references can then be added here without publishing its private contents. Where the checkpoint requires new permission for inventory, obtain that **preflight-only** scope first; it must not include exports, seeding, deployment or uploads. This packet does not ask the owner to approve an incomplete full test.

## Requested scope once the blockers are closed

Only `age-of-friends-staging`, Functions/worker region `europe-west1`, the verified existing Hosting site and existing private worker/registry/bucket. Production `league-of-friends-cc274` and every other project are excluded. No new service, bucket, registry repository, Auth provider, secret, IAM grant, CPU/memory/concurrency change, social scoring or exceptional privilege is included. Freeze and separately review any actual source-deployment resource diff: `uploadReplay` declares Node 22, 1 GiB and 300 seconds; worker transport timeout is 240 seconds. Do not assume existing deployed allocations match.

Minimum version manifest for the upload journey: `uploadReplay`, `getStatisticsExperience`, `getMatchDetail`, `getPlayerSiteDirectory`, `getMyMembership`, `getLeagueBootstrap`, `getActiveNativeBattleDetail`, `getActiveNativeBattleRecord`; existing `resolveResultsOnRecordingSource`, `resolveResultsOnActiveRecording`, `processResultJob`, `finalizeRecordingSeries`, `rebuildStatisticsOnGameChange`, `rebuildStatisticsOnMatchChange`, `rebuildStatisticsOnSourceChange`, `reconcileBestWarmupsOnMatch`, `reconcileSeasonPointsOnGameSource` and `reconcileSeasonPointsOnPlacementSource`. Pin existing Steam sign-in/callback and navigation dependencies too. Inventory determines which require a source-compatible update; the final permitted list must be explicit, not `functions:*`.

| Proposed configuration delta — none currently authorized | Exact intended value |
| --- | --- |
| Web release | Staging project/Auth/App configuration, `VITE_FIREBASE_REGION=europe-west1`, `VITE_USE_EMULATORS=false`, **`VITE_AOF_STAGING_E2E=false`**, `VITE_AOF_COMMIT_SHA=2ece99cd37eabf6316f354e9177ceb74a3c8ce7f`; offline env guard and emitted bundle inspected before Hosting. |
| Functions release/project | `AOF_DEPLOY_GIT_SHA=2ece99cd37eabf6316f354e9177ceb74a3c8ce7f`; actual project and `AOF_NATIVE_REPLAY_PROJECT=age-of-friends-staging`; no emulator flag. |
| Ordinary native selection | `AOF_NATIVE_PLAYER_UPLOAD=recorded-events-v1`; `AOF_NATIVE_PLAYER_UPLOAD_GAME_ALLOWLIST` is **only the four verified exact `matchId/gameId` pairs**, or six only when the optional fresh pair is separately admitted. No wildcard. |
| Native source readers | `AOF_ACTIVE_NATIVE_PLAYER_READS=1`, `AOF_ACTIVE_NATIVE_SOCIAL_READS=1`; availability/source readers only, no earned progression. |
| Processor | Functions `AOF_NATIVE_REPLAY_PROCESSOR_REVISION=3f52fd692f77809796cde467b578a0765a066113fe74686a6d29a6684f30a339`; worker must independently return/verify this same value. |
| Private transport | Verified existing HTTPS `REPLAY_WORKER_URL`; existing matching Functions `REPLAY_WORKER_AUTH_TOKEN` / worker `AOF_REPLAY_WORKER_AUTH_TOKEN` **version references only**; existing Cloud Run IAM invoker plus separate app bearer remain mandatory. If insufficient, stop rather than add IAM/rotate secrets. |
| Worker | `GCLOUD_PROJECT=age-of-friends-staging`, `AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT=1`; selected route **`/process-native-v1`**. Existing private access policy retained. |
| Diagnostics | Functions `AOF_REPLAY_UPLOAD_PERF_TRACE=1`, worker `AOF_REPLAY_WORKER_PERF_TRACE=1` for the approved window, with protected log access. |
| Excluded gates | Old manual panel, admin validation/publication/rollback/correction enablement and all social progression/activation remain off/unchanged. Accepted-history corrections or live artifact/service faults are **not** initial-pilot operations. |

No configuration is authorized by merging #146/#147/#148. No unset worker URL, deployment identity or account may be filled by a guessed value.

## Cohort and recordings

One new isolated test cohort; owner A is an active, genuinely authenticated participant in each of four fresh Games, with an ADMIN observer. Existing legitimate players and official history outside the cohort must not change. The private sheet binds: format → Battle/Match/Game IDs → independently checked actual roster/teams/settings/play window → approved replay-slot/name bindings → original bytes/hash/GUID → expected result qualification → current source/result revision and absence of an existing claim. Inspect original/derived retention, revisions and reward/job baselines before upload. Never bind a historical fixture to a real person's Game by convenience or stretch a play window to pass admission.

Pinned authentic reference corpus: `2d04ec6adbe871d156c108a4351448efeb08f4e6`, `replay-fixtures/build-185872/`. Use these exact originals **only if** the existing admission rules and private mapping can legitimately admit them. Otherwise the pilot is blocked until genuine owner recordings are privately pinned and validated; no alternative proof is invented.

| Format / original | Bytes | SHA-256 |
| --- | ---: | --- |
| `1v1_t90-deak.aoe2record` | 3781255 | `3f2ee71756017332182620ee9f273e249b3fe6bc61222637df26bb7a84d400ef` |
| `2v2_arabia.aoe2record` | 5558786 | `b80aec98153eaacb92e14a7759e209d21218858f306551eb5c14b6c432b0ad05` |
| `4v4_arabia.aoe2record` | 5129372 | `ad3d7716d8e6a52f73997812a281f1e158bd181f482fdafe8d0c5e8617d6d2d7` |
| `FFA_7.aoe2record` | 5314319 | `d86ba4dfafdc430d9c125f75ca20e90dee41e27c5e207edbd5561058e41531b8` |

The FFA fixture has eight players despite its filename. Reference 1v1/4v4 support existing accepted outcomes; custom-map 2v2/FFA stay pending in existing acceptance. Actual staging timing/settings/authority may require pending review; independently predeclare the qualification rather than force acceptance. Pending READY statistics are usable, but cannot enter official-result-dependent aggregates.

The owner personally performs **four fresh initial uploads**. An independent two-user fresh-upload test needs **two additional** legitimately mapped, distinct-GUID originals/Games and Player B; it is **NOT ADMITTED today**. Reusing two of the owner's completed Games measures cached retries, not a fresh concurrent pair. If additional sources are unavailable, omit the optional pair and explicitly report concurrency untested; never move claims or modify GUIDs.

## Initial backup and recovery procedure — future authorized operations only

1. Before any cohort write or deploy, record the actual current Hosting/Functions/worker/config/rules identities and operator's restore capability. Record database/bucket/project explicitly; default Firebase aliases are forbidden. Preserve source/result/GUID/jobs/audit/ledger baselines and protected identity mappings. Confirm no unresolved in-flight cohort processing.
2. Under explicitly included backup authority, export the staging database to the **existing approved protected backup destination**, inventory source/derived Storage objects with generations/size/SHA, and retain verified recovery copies where required. Record export operation ID, start/end times, destination, checksum/inventory and permissions. No new bucket, IAM grant or public artifact. If scope/size/cost/consistency is unknown, stop before export. For a fresh cohort, verify empty prefixes/claims; do not treat that as a backup of existing shared data.
3. Verify export completion and bounded recovery/readback using existing permitted facilities; preserve concurrent-write boundaries. No full-database restore rehearsal over live staging. If recovery cannot be demonstrated safely or ordinary staging writes would invalidate the snapshot, NO-GO. Recovery evidence is protected, not attached to GitHub.
4. Promote the exact retained candidate image only after permitted registry/deployment scope exists; record its registry manifest digest, deployment revision and in-image processor. Build web/Functions from frozen source with approved staging configuration, record final asset/build digests and every actual release/revision. Verify source/processor declarations and private transport before owner admission. A changed candidate requires a new pin sheet; do not repoint a mutable tag.
5. Stop recovery rule: first close/sign out pilot browsers and stop admissions/retries; allow in-flight transactions to settle within their existing bounds and inspect final authoritative state. Restore the pinned prior app/Functions/worker/config using the existing verified rollback facility. Confirm versions after rollback. Turning native selection off can make AUTO legacy, so **keep intake closed**; never time a rollback retry as native acceptance.
6. Retain originals, artifact generations, GUID claims and audits. Application rollback does not undo an accepted Game, result or reward. Pending-source withdrawal and accepted-result correction/rebind require their existing independently authorized review paths; they are not enabled in this small pilot. Never bulk-restore a database over accepted history, clear claims, delete originals or alter production. Any need for data restoration/correction outside the exact approved cohort is a separate stop/decision.

## Requested hard bounds and stop conditions

These are proposed operating limits, not scoring parameters and not a billing-resource change. The later signed scope must name the operator and exact appointment **before the frozen artifact expires**.

| Bound | Proposed maximum |
| --- | --- |
| Owner window | One **30-minute** appointment; no overnight load or scheduled repetition |
| Fresh uploads | Four owner formats; optional two-user pair raises total to **six** only if separately admitted |
| Upload calls | **12 total**: fresh attempts plus at most four idempotent retries and two approved denial/invalid-input controls; all failed/cancelled attempts count |
| Worker invocations | **8 total**, including failures; no live service/token/artifact fault injection |
| All other callable HTTP calls | **60 total**, including verification, navigation/auth and background refresh; thus **72 callable calls maximum** including uploads. Trigger/listener activity also requires a separate conservative cost reservation; no manual trigger retry loops. |
| New retained replay/artifact bytes | **1 GiB maximum** reserved for the cohort; do not delete evidence to stay under cap |
| Incremental spend | **US$5 maximum** for the complete window including any authorized preparation/backup/promotion costs. Actual allocations, baseline cost and worst-case in-flight cost must be conservatively reserved first. If not measurable/reservable within this cap, NO-GO; billing alerts are delayed and are not a hard limiter. No new budgets/quotas/resources are created. |

Stop new admissions immediately on: missing/mismatched pin or processor; wrong project/native route; unauthorized read/write; absent immutable original/generation; source/roster/GUID/revision inconsistency; unexpected official writes; stale statistics; unjoined diagnostics; rollback unavailable; exhausted request/storage/cost/time reservation; or any single attempt exceeding **60 seconds**. Do not kill/redeploy a worker to erase an in-flight result. A >20-second sample is retained as slow/failed target evidence; it never disappears through retries. Do not expand the pilot to optimize or collect percentiles.

## Owner browser card — only after explicit precise GO

The operator prepares two independent browser sessions where applicable, private screen recording and the reviewed offline observer configured to the exact expected source/revision. The owner performs the uploads. No credentials, headers or replay bodies are shown/exported.

1. Open **`https://age-of-friends-staging.web.app`**, sign in normally, open **Battles**, and select the exact pre-approved Battle/Game on the private sheet. Operator verifies served build and active participant identity; preview/emulators must be off.
2. Click **Upload recording**, choose that Game's pinned genuine **`.aoe2record`**, and confirm the file picker. In the compact UI that confirmation starts upload automatically. **T0 is this selected-file commitment before file read/encoding**; picker browsing is recorded separately. Do not use Validate only, explicit LEGACY or `.mgz` as the measured native path.
3. Open **Open Battle Ledger** and wait for usable player numbers. Progress, upload receipt, “Recording processed” or VALIDATED_NOT_READY does not finish the trial. Operator records the first matching visible statistics and retains navigation delay in the interval.
4. Click a statistic. Its evidence docket must show the planned **Match / Game, revision and Recording hash**. Compare to the authenticated receipt and private sheet. Pending official result is allowed and must be visible; stale/other-source data stops the trial.
5. **Where to see elapsed time:** operator displays the sanitized DevTools `__aofUploadObserver.report()` beside the browser. `sourceMatchedVisibleFrameMs / 1000` is the joined source-frame opportunity in seconds, not certified compositor paint. After the owner confirms the statistics are visible, operator runs `__aofUploadObserver.confirmDisplayed()`; `manualDisplayUpperBoundMs / 1000` includes visual/navigation/reaction time. Corroborate with the private screen recording. Never backdate an inspected docket or use the response time as displayed-READY time.
6. **Verify native:** operator matches `diagnosticTraceId` to the Functions and authenticated worker numeric records, both selecting **`/process-native-v1`**, the frozen source and in-image processor; verify the stored source's `ordinaryUploadVersion=AOF_NATIVE_PLAYER_UPLOAD_V1`, active source/revision/roster, immutable generations and GUID claim. `workerInvoked=false` / `alreadyProcessed=true` means cached retry, not fresh processing. Any `/process` fallback or missing join disqualifies/stops the trial. No raw network-body/HAR export.
7. Repeat for 1v1, 2v2, 4v4 and FFA only within caps. Record observed cold/warm/unknown worker and Functions state from instance/startup evidence; no forced restart, min-instance or concurrency tuning. Optional fresh two-user pair uses separate signed-in browsers, distinct actors/Games/GUIDs and agreed simultaneous commitment only when admitted above. Stop/report failures; do not substitute a cached retry for a missing format.

## Evidence, decision and separation

[Sanitized concurrent local proof](benchmarks/performance-143/owner-diagnostic-witness.json) shows distinct authentic 1v1/2v2 GUIDs, authenticated actors and attempt IDs with overlapping handlers. Each UUID joined actual `uploadReplay.run` receipt, numeric Functions record, bearer-authenticated HTTP worker record, authenticated `getStatisticsExperience`, real `BattleStatistics` SSR/JSDOM source/revision attributes, observer receipt/frame contract and a post-render active database source/revision check. Three focused render/privacy tests pass. This is **SSR/JSDOM in demo emulators**, not an external callable-HTTP/browser click, layout, compositor-paint or p95 measurement. The witness creates no staging authority and exports no private payloads.

Initial owner success means four genuine native-route, current-source READY experiences with correct result qualification and retained integrity, plus an honest time/condition/error record. It does **not** mean p95 <20s. A later separately authorized, pre-registered per-format/cold-warm/concurrent reference campaign needs enough admitted independent originals, counts, error treatment and uncertainty. Full social/source/correction/privacy/Personality/six-track/Chronicle/recognition acceptance remains **#132 on the final INT head**, not this pilot release.

**Current requested owner decision: NO-GO for the full pilot.** Close the named protected pin/cohort/recovery/cost facts first, using only a separately authorized preflight scope where required, then review one precise deployment/config/data/backup/test/rollback authorization against this packet. No inventory, export, cloud account/data seed, registry push, deployment, flag/IAM change, live smoke/upload or resumption of the closed manual session has occurred.
