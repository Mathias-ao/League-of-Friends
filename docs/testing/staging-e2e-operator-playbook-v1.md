# Staging-first manual E2E — operator playbook (V1)

**Current status (11 October 2026): PREPARATION, NOT GO.** The linked implementation is [draft PR #112](https://github.com/Mathias-ao/League-of-Friends/pull/112), **stacked on unmerged readiness PR #111**. Neither PR deploys Firebase, changes cloud flags or establishes the staging site's deployed code. User execution begins **only after every hard prerequisite below is checked and the staging deployment/activation are separately authorized.**

This playbook supersedes the *order* of the manual tests in [manual E2E readiness](manual-e2e-readiness-2026-10-11.md): staging is the **primary human E2E**; local `demo-aof-e2e` emulators are the repeatable negative/security/regression harness and fallback. The 9–10 October eight-account rehearsal was on **local emulators**, not real cloud staging.

## Hard GO/NO-GO prerequisites

| Gate | Acceptance / evidence |
| --- | --- |
| Source snapshot | Review and merge the exact accepted #111 and #112 heads; document `main` SHA, CI results and deploy artifact revisions. No transitive "merge means deploy". |
| Environment | Confirm **`age-of-friends-staging`**, hosting origin, Functions region, Auth domain, separate Firestore/Storage buckets, and isolated data. Production `league-of-friends-cc274` and repository's misspelled default are forbidden. |
| Approval | Obtain *new, explicit* authorization for the synchronized Firebase staging deploy, independently for scoped **native validation/publication/player/social/rollback flags** and their exact allowlisted Game. Normal player upload must remain legacy. |
| Snapshot/recovery | Export **and verify** staging Auth, Firestore and Storage baseline; record immutable original locations/generations, rollback authority, staging-only cleanup procedure, required API quotas and cost envelope. Never delete the original `.aoe2record`. |
| Exact release identity | Set **`AOF_DEPLOY_GIT_SHA`** in the independently approved staging Functions release and **`VITE_AOF_COMMIT_SHA`** in its matching website build to the same reviewed exact 40-character source commit. ADMIN reads `adminGetStagingE2eReadiness` for the selected exact Match/Game and requires `configReady=true`; this is a declaration/status check, not cryptographic attestation or proof of cloud connectivity. |
| Worker and client | Worker URL authenticates with its private token (never Vite), origin/Steam redirect and callback are staging allowlisted, processor revision is pinned to deployed image and a 64-hex SHA, cold/warm invocation verified. Web and Functions are from the *same reviewed commit*. |
| People / Game | Distinct real browser sessions for ADMIN and at least two active independent Game participants, separate Firebase/Steam-linked AoF accounts, approved Game source-name bindings, correct draft/map/play window, independently adjudicated official winner/team (not simply replay result). |
| Release-mode verification | Browser `VITE_FIREBASE_PROJECT_ID=age-of-friends-staging`, `VITE_USE_EMULATORS=false`, `VITE_AOF_STAGING_E2E=true` **only after approved staging UI activation**; no preview data; backend exposes `adminGetNativeReadyReview` but still refuses unauthorized calls. |
| Tooling | [Offline preflight](../../scripts/manual-e2e-preflight.mjs) manifest passes *after operator has verified actual facts*, exact expected scoreboard and point/gold ledger prepared; staging health/Cloud Run telemetry and browser evidence capture ready. |
| Smoke | Before the manual session, an isolated admin review `not-found`/denied-request test and an unauthenticated/PLAYER deny test must pass; confirm worker failures cannot result in active READY or score. This is actual staging smoke, not automated by a self-test. |

**New read-only operator visibility:** The staging-native review panel displays an authenticated **NO-GO** when the deployed source commit does not match the website, the source/READY Game allowlist differs, the native worker URL is not authenticated HTTPS, the processor revision is not pinned, the bucket is not the staging bucket, or the required native read/publish/rollback flags are not explicitly enabled. A successful configuration status is **necessary but not sufficient**: human verification of Auth sessions, exact content, cloud worker response, rules, backup export and deployment approval is still mandatory. The callable never contacts the worker or emits secret values. Emergency source-only rollback has an independently evaluated status, and must remain possible if ordinary publication/player/social read flags are turned off.

The UI flag is **not security**. Native operations still require the backend's explicit `GCLOUD_PROJECT=age-of-friends-staging`, `AOF_NATIVE_REPLAY_PROJECT`, `AOF_NATIVE_REPLAY_INTEGRATION=validate-v1`, source-worker token and processor SHA, `AOF_NATIVE_REPLAY_GAME_ALLOWLIST`, `AOF_NATIVE_READY_PUBLICATION=reviewed-v1`, separate `AOF_NATIVE_READY_GAME_ALLOWLIST`, `AOF_ACTIVE_NATIVE_PLAYER_READS=1`, `AOF_ACTIVE_NATIVE_SOCIAL_READS=1`, and separately enabled `AOF_NATIVE_READY_ROLLBACK=reviewed-v1` for recovery. **Do not set these until specifically approved**. Never commit service-account credentials, private tokens, identities, live replay data, or Firebase release secrets.

## Native worker image — reviewed staging candidate, no deployment

The [staging-only Dockerfile](../../replay-tools/Dockerfile.staging) packages the existing worker and Python dependencies as an unprivileged image. Build/test from the **`replay-tools/` context**, never the repository root:

```sh
docker build -f replay-tools/Dockerfile.staging -t aof-staging-native-worker:test replay-tools
```

The [staging native worker CI](../../.github/workflows/staging-native-worker-image.yml) builds this image locally, runs a hosted-mode container with a read-only filesystem and temporary scratch space, and proves that **both** `/process` (legacy) and `/process-native-v1` refuse POST when `K_SERVICE` is present but the private bearer token is missing. Local emulator worker behavior remains backward compatible. The base image and resulting deployment image digest must be frozen, reviewed and recorded at actual release time; a green Docker build does not deploy to Cloud Run.

**Private Cloud Run transport contract:** On the reviewed staging worker-authentication branch, both the ordinary `/process` caller and the native `/process-native-v1` caller send **two separate credentials**: an audience-bound Cloud Run IAM identity token in `X-Serverless-Authorization`, and the secret-backed application `Authorization: Bearer` token required by the Python worker. The identity token uses the exact configured HTTPS worker origin as its audience; the Functions execution service account must have `roles/run.invoker` for this staging service. Cloud Run must remain `--no-allow-unauthenticated`, with the worker app token still required. Emulator loopback uses only the app bearer, never IAM. Neither token belongs in a `VITE_*` variable or logs. The native route remains disabled unless `AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT=1` is separately approved, and backend native validation still requires explicit staging ADMIN/project/exact-Game/processor gates. An IAM success by itself is not evidence of READY eligibility. Configure an HTTPS `REPLAY_WORKER_URL`, matching worker/Functions secret, pinned processor revision and the reviewed 240-second request timeout. Health route proves service presence only. The private transport fix does not deploy Firebase or activate native validation/READY.

## Locked staging website build — zero production fallback

Use the [staging-only web template](../../web/.env.staging.example). Make a **private** `web/.env.staging.local` with approved staging public Firebase API key, staging web App ID, auth domain `age-of-friends-staging.firebaseapp.com`, exact 40-character reviewed Git SHA and `VITE_USE_EMULATORS=false`. The committed generic `web/.env.example` has a production/default project ID for historical reasons and must **not** be used to build staging.

```sh
# Prior to separately approved native UI activation, keep VITE_AOF_STAGING_E2E=false:
node scripts/verify-staging-web-env.mjs web/.env.staging.local
# This intentionally refuses an enabled manual UI without explicitly selecting
# the manual E2E audit mode; either command is OFFLINE, not deployment authorization.
node scripts/verify-staging-web-env.mjs web/.env.staging.local --for-manual-e2e
# After independent deployment and flag approvals, build only from the reviewed SHA:
npm run build --prefix web -- --mode staging
```

**Never infer authorization from a green config audit.** The `--for-manual-e2e` command checks only that the browser opt-in is explicitly configured. A separate written staging deploy and exact-Game native flag approval must exist. No production Firebase alias, preview fallback, local Auth emulator, direct canonicalResult write or unreviewed source replacement is permissible. Use a full deployment rollback plan and verify the emitted website bundle actually targets staging before hosting publication.

## Milestone A fast-recording validation, without READY publication

The staging preflight exposes **two independent configuration states**: `validationReady` covers the separately enabled native validator, exact approved Game, processor pin, private worker configuration, release commit and staging Storage; `configReady` still requires **all** READY publication, reader and rollback gates. A staging ADMIN can choose **Validate only** when validation readiness is satisfied even while publication/read/rollback flags remain off. Its response must remain `VALIDATED_NOT_READY`; source and derived artifacts are immutable and the original recording must remain retained. The UI no longer attempts the separately gated READY review after validation-only success when publication flags are off.

This is a **code capability, not permission to turn flags on**. The staging E2E browser panel remains hidden with `VITE_AOF_STAGING_E2E=false` until separately approved. Enabling the `/process-native-v1` worker route and `AOF_NATIVE_REPLAY_INTEGRATION=validate-v1` is an opt-in exact-Game operation, not part of the default Milestone A deployment. The worker itself does not publish READY, and neither preflight state verifies actual Cloud Run calls, backups or independent result authority. Ordinary player Upload recording still calls the legacy route and may hit the known 240-second timeout until a fully qualified native READY transition is separately approved.

## Staging human journey — one controlled Battle

1. **Before:** ADMIN records known approved Match/Game ID, exactly mapped historical source names to permitted Game players, original hash, build provenance (185872 sample if using old fixture), announced settings and actual play window. Snapshot current active source pointer (initially absent), result/statistics revisions, Season leaderboard/Gold ledger, player profiles/Chronicle, and permitted operations.
2. **Validate native only:** As real staging ADMIN, open the Game's **Staging E2E · Emperor native evidence review** panel, choose a real `.aoe2record` and select **Validate only**. This explicitly sets `processingMode: NATIVE_VALIDATION_V1`; verify result `VALIDATED_NOT_READY`, original forever retained and **no active source or rewards**. Ordinary **Upload recording** remains the *separate legacy pathway*. Keep candidate SHA/ID in the private evidence sheet.
3. **Independent official result:** Two participants use separate authenticated browser sessions. Participant A independently selects the actual winner/team on **Staging E2E · independent official result**. Participant B examines the same claim and independently confirms via the authoritative `submitGameResult` / `respondToGameResult` flow. Reopen the Game and verify the official revision/status through backend and browser. If a result is disputed/recording-bound or timed out, **stop**; ordinary PUBLISH must not override it. Do not claim a historical fixture result is genuine without independent human evidence.
4. **Review candidate:** ADMIN pastes the candidate ID if needed, loads **adminGetNativeReadyReview**, compares original/source/Recorded Events/statistics hashes, replay player slot → league member mapping, current official source/winner, Game settings and *fresh exact* result/statistics revisions. Every unexpected or unknown observation is **NO-GO**.
5. **Manual READY:** ADMIN writes a source-/result-specific reason, checks source/mapping and independent official outcome confirmations, then presses **Audited manual PUBLISH to READY**. Backend independently rechecks all allowlists, source generations and pinned artifacts, current official authority and active source/revisions, and commits atomically. Another click must be idempotent; stale or unauthorized caller must be rejected.
6. **Player browser readers:** With a non-admin signed-in player, reopen **Battles → Game → Open Battle Ledger**. Inspect source-bound statistics, timeline, **Recorded Battle episodes** (pagination + selected source fragments) and **Battle record and native social evidence** (bounded pages + SHA-256 verified fragments). Verify no legacy full native JSON request, payload ceiling or stale-source mixing. Inspect **Season / Player / Chronicle**, carefully distinguish qualified, neutral/shadow, missing and unavailable evidence; **never infer hostility, bonds, placement, rewards, or motive from missing evidence**.
7. **Accounting and identity checks:** Compare *specific* expected/observed Season Points, Gold, outcome revision, one-time processing jobs and standings; independently verify a duplicate retry does not award twice. Check administrator vs participant vs unauthorized callers, incorrect Game, source revision, disabled reader, and a transient network retry. Capture cloud worker cold/warm and callable/browser durations **separately**.
8. **Reversion / clean exit:** With current source/result revisions verified and **unchanged independent official result**, an administrator can explicitly type `ROLLBACK` and use separate approved rollback flag for *source-only* READY. This does **not** reverse official result/points. A `CORRECT_REBIND_V1` corrected result cannot be source-only rolled back; use its separately reviewed correction protocol. Retain original and derived evidence; verify no live league mutation. Restore/retire only approved isolated staging fixture data.

## Reliability and coverage beyond first E2E

- Local real 185872 native validation-to-candidate in one hosted emulator run: **1v1 10.94s, 2v2 25.87s, 4v4 32.54s, FFA eight players 27.28s**. These are **not cloud** and for larger formats already exceed the desired **under-20s full upload-to-READY** goal. Do not advertise a completed SLA.
- Stage the **1v1** first for a controlled full journey; subsequently test 2v2/4v4/FFA in independent Games. Run measured warm/cold trials, authenticated browser network/Storage/Functions latency, payload-size and retries. Stage quotas/costs must be explicitly confirmed before broad load tests.
- Successful scheduled Event closure, exact ledger/ranking reconciliation, result-correction rollback, automatic worker scheduling, Chronicle Story Engine and dynamic FFA social qualification remain separate acceptance gates.
- PR #61/#62 Chronicle Story Engine branches are old, draft and **not merged**. Use currently deployed Chronicle visibility/qualified neutral evidence; do not merge speculative story prose to make an E2E look complete.

## Status and decision log

| Decision | As of this draft |
| --- | --- |
| #110 authentic four-format regression | Merged; emulator-only passes |
| #111 readiness/GO-NO-GO package | Open, exact-head preparation CI passed |
| #112 staging browser admin/independent result controls | Draft code; four-format genuine emulator suite passed with actual two-person result callables; further exact-head CI required after latest preflight additions |
| Explicit staging deploy authorization | **Not given** |
| Scoped staging native/read/rollback flag authorization | **Not given** |
| Real staged cloud/browser upload-to-READY | **Not tested** |
| Ordinary automatic player native READY | **Not implemented or activated** |

## Before authorizing the staging deploy

1. Freeze the exact reviewed `main` SHA after both PRs have been separately approved and merged. Back up and verify the isolated staging baseline.
2. Approve **the staging environment and resource scope explicitly**, including the hosted website, individual Functions, Storage/Firestore rules, indexed data and a separately authenticated Cloud Run replay worker. The staging project is `age-of-friends-staging`, never the repository's default Firebase alias.
3. Independently approve **native flags and exact test Match/Game IDs** only after the worker, return/rollback and original retention are verified. Keep all other Games and all production resources unchanged. Record a separate emergency rollback authorization and operational owner.
4. Pin both website and Functions Git SHA values and processor revision, then verify the read-only ADMIN status response and actual worker/cloud/network connectivity. Never take the response alone as an E2E pass.
5. Prepare a staging-specific Auth domain and Steam callback, plus separate real authenticated ADMIN/Player A/Player B sessions; reproduce none of the emulator shortcuts in staging.
6. Execute a protected, single-Game smoke with the already reviewed real recording and independent result; only after it passes should the user be invited to perform the full manual E2E.

No one should request the user's E2E session until the checklist is backed by real staging evidence, not just green compilation and emulator tests.
