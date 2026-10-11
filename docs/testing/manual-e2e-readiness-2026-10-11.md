# Manual E2E readiness — single source of truth (11 October 2026)

**Disposition: PREPARATION IN PROGRESS — NO-GO for an unassisted native browser/cloud test.** Code merged through PR #110 qualifies the *isolated* build-185872 native upload-handler → validated candidate → manually reviewed READY → bounded native readers → rollback path for real 1v1/2v2/4v4/FFA files. It does **not** mean that the website can drive this pathway unassisted, that ordinary uploads automatically publish READY, or that the deployed Firebase staging environment has the code.

This plan keeps the **three milestones** separate: **(1) consolidation** (merge #110 and update stale authority docs), **(2) a complete single-Battle manual rehearsal**, and **(3) operational qualification for later player activation**. Use *this* page to prepare and execute a user-operated E2E; stop and record a NO-GO rather than improvising administrative production mutations.

## Live implementation truth / important UI gaps

- Normal player website Upload recording invokes `FirebaseLeagueRepository.uploadReplay` **without** `processingMode: NATIVE_VALIDATION_V1`. It therefore uses the **legacy** upload path. Do not call this a native E2E test.
- `uploadReplay` implements a separate admin/project/Game-allowlisted `NATIVE_VALIDATION_V1`, but returns **VALIDATED_NOT_READY**, not a READY source. `adminPublishNativeReady` is a separate, disabled-by-default admin callable: correct project/allowlist, pinned worker revision, *pre-existing independently accepted* official Game result and exact expected source/result revisions are required. The browser's current repository/UI does **not** expose either native-admin operation. Use a separately reviewed authenticated operator method for that assisted stage, **not** raw Firestore document edits or pretending the normal Upload button selected native mode.
- Once a qualified native READY source exists, `BattleDetails` and `getStatisticsExperience` have versioned compact source support and render the gated **Recorded Battle episodes** and **Battle record and native social evidence** viewers. **Browser execution of this entire path is not yet accepted.** `getReplayStatistics` deliberately rejects native sources; no 404 MB legacy JSON reconstruction.
- Existing **Player Chronicle** read/UI is distinct from the old unmerged Chronicle Story Engine drafts in PRs #61 and #62. Empty/partial/social-qualification-unavailable is a valid result. Do not treat preview story copy or neutral evidence as official relationship scoring.
- The earlier eight-account `demo-aof-e2e` functional rehearsal was **closed on 10 October**. Its local synthetic account/game state is not assumed still present or portable to staging; Event finalisation, exact ledgers, true timed check-in and cloud browser acceptance were not demonstrated.

## Environment selection

| Target | What it can prove | Authorization / boundary |
| --- | --- | --- |
| **Local isolated `demo-aof-e2e`** | Web ↔ emulated Auth/Functions/Firestore/Storage, admin/player views, real replay worker, legacy workflow; separately gated native *operator-assisted* source testing | No cloud deployment needed. Back up/reset the demo emulator. No real user or production data. |
| **`age-of-friends-staging`** | Genuine deployed HTTPS callable/browser/Auth/rules/worker, cold/warm latency, staging-only accounts and rollback | **Separate environment-specific authorization required for Firebase deploy and each native/reader/worker flag opt-in.** Staging cannot be called tested until that actually happens. |
| **Production `league-of-friends-cc274`** | **Out of scope** | **Never use.** Also do not trust the repository's misspelled `.firebaserc` default `league-of-freinds`. Always use an explicit project ID. |

For frontend mode, the site with *no* complete Firebase web configuration is a clearly labelled **memory-only preview**. That is not a live E2E. Local test configuration must supply the entire Firebase web app set, use `VITE_USE_EMULATORS=true`, and connect the browser to Auth `127.0.0.1:9099`, Functions `127.0.0.1:5001`, Firestore `127.0.0.1:8085` and Storage `127.0.0.1:9199` as configured in the source. Validate these values and the rendered signed-in league identity. Never put service account credentials, worker token or private replay contents into `VITE_*` variables.

## Required preparation before setting a date for manual E2E

1. **Freeze one reviewed commit.** Merge and CI are separate from deploy. Record full main SHA and exact Backend, Player Website, emulator native trigger and authentic multiformat results. Run `npm ci --prefix functions && npm run build --prefix functions && npm test --prefix functions`, `npm ci --prefix web && npm run build --prefix web && npm test --prefix web`, and `node scripts/test-player-site-boundaries.mjs` in the intended workspace. A green PR is not a browser check.
2. **Choose one explicit scenario.** First a **normal legacy player-facing Game** from an isolated Event or standalone approved Battle, exercising the real website. Separately run the native-assisted investigation on an **independent throwaway Game**; never swap a recording on a real completed competitive Game to make an E2E fixture convenient.
3. **Source and authority.** Keep a genuinely build-185872 `.aoe2record` with independent build provenance, hash/size, Game GUID, expected exact source names and replay slots, announced map/mode and played window. Record independently **how the official winner/team/FFA placement was decided**; this cannot be inferred merely from the replay file, selected source slot or default outcome. For controlled historical fixtures, the accepted result and synthetic player bindings are test-only—not claims about actual AoF competition.
4. **Accounts.** Verify a separate authorized ADMIN and participant account actually sign in, map to eligible active league memberships, can be switched safely, and have only their intended permissions. The current emulator UI convenience sign-in logs in `emperor@league.local`; it **does not create or exercise eight independent human logins for you**. Confirm these accounts and appropriate user-identity mappings before the session.
5. **Start and verify the isolated stack.** Use Node 22, Java 21 for Firebase emulator, Python 3.12 plus `replay-tools/requirements.txt`, built Functions, the local authenticated worker and browser Vite build. Start Firebase with **`--project demo-aof-e2e` explicitly**, only the selected emulators. Check the worker's health/authentication, pinned `native_processor_revision()` and Storage bucket, then confirm browser project banner and live callable connectivity. Never set native flags globally as a convenience.
6. **Back up and rehearse rollback.** Record pre-test Auth, Firestore and Storage baseline and **verify** the archive actually contains each expected component (the older Windows emulator export sometimes crashed after writing). Keep original recordings permanently. Be able to reset this demo data without touching any other environment.
7. **Complete the machine-readable *operator attestation* gates**, using the non-mutating `scripts/manual-e2e-preflight.mjs` (see below). It checks consistency of **declared prerequisites only**; it neither calls Firebase nor substitutes for human sign-off.
8. **Set one stop/go meeting.** Confirm which track(s) will actually be run, evidence owner, accounts, exact Game/Match IDs, independent expected outcome, rules/flags, go/no-go gates, and rollback role. No staging deployment/flag activation by implication.

### Non-mutating preflight

From the repository root:

```sh
node scripts/manual-e2e-preflight.mjs --self-test
node scripts/manual-e2e-preflight.mjs --template emulator legacy-browser > /PRIVATE/legacy-readiness.json
node scripts/manual-e2e-preflight.mjs --template emulator native-assisted > /PRIVATE/native-readiness.json
# Set the reviewed 40-character commit and only verified gate values to true.
node scripts/manual-e2e-preflight.mjs /PRIVATE/legacy-readiness.json
node scripts/manual-e2e-preflight.mjs /PRIVATE/native-readiness.json
```

Use real writable absolute private paths appropriate to the operator's OS (Windows paths are fine). Do not commit filled manifests, account IDs, Steam identities, bearer tokens or recordings. The script prints only a GO/NO-GO declaration and named missing gates. **It never proves that the browser, APIs or staging actually work.** For staging use `--template staging ...` and obtain **separate deployment approval**, plus **separate native flag-activation approval** for native-assisted mode. A false gate or wrong project produces nonzero exit.

## Manual session A — real website, normal legacy workflow

1. Confirm the Vite page is **not preview**, account identity matches the selected demo Firebase Auth session, and approved Match/Game appears in **Battles → Field of Battle**.
2. Confirm approved Game roster, announced map/settings, allowed play window, draft prerequisites and independent expected winner. Capture a *before* snapshot of Game result revision, active source ID, Season points, Gold/ledgers, stats eligibility and relevant Chronicle/relationships.
3. As the allowed player or Emperor, choose **Upload recording** from the actual Battle page. This sends the legacy pathway, **not native READY**. Confirm progress, the completed READY source, exact source identity and Game roster mapping without editing Firestore directly.
4. Follow the actual independent result submission/confirmation/admin-review workflow appropriate to this Game. Record Game and Match result revisions; a rejected map/winner/window must fail closed. No attempt to fabricate a pending result to force points.
5. Open **Battle Ledger**, its timeline and playable evidence; open **Statistics**, Player profile and the relevant Chronicle page. Use actual versioned responses and matched source evidence, not illustrative preview numbers. Record observed eligibility, errors and missing/partial states.
6. Check Season/Match points and Gold against a **prewritten exact expected ledger**, not merely a plausible leaderboard. Re-open/refresh; duplicate reads and retries must not duplicate awards. A disputed result must exclude invalid stats from Season/record qualification while preserving source evidence.
7. Verify a separate authenticated player can read the appropriate public evidence but cannot access admin operations or another player's private data. Check browser console/network for rejected calls, oversized payloads, stale source revisions and missing rules.
8. Only if explicitly in this session's scope, exercise correct scheduled Event finalisation *after* its actual permitted time and check exactly one finalisation/unchanged replay data. This was **not** proven in the earlier eight-account smoke. Never backdate a real Game/Event to force acceptance.

## Manual session B — native experimental **operator-assisted** Game, not normal upload

**Do not start B until its specific native flags and exact Game are independently reviewed and authorized for the chosen test environment.** In a demo emulator, flags may be scoped locally. In staging, obtain separate staging deployment and flag authorization first.

1. Create/approve a **different** synthetic test Match/Game. Verify unique source name/slot mapping, current official result revision and separate test GUID ownership. Ensure a normal source change will not invalidate an existing recording-bound result.
2. Use a **separately reviewed authenticated administrator callable harness**, not the website's legacy Upload recording button, to invoke `uploadReplay` with `processingMode: NATIVE_VALIDATION_V1`. Require `VALIDATED_NOT_READY`, an immutable original/events/direct-shared artifact, no active READY pointer and no score/social awards merely from validation.
3. Independently accept the official test result *through actual authoritative result workflow* before attempting manual `PUBLISH`. For previously recording-bound disputed corrections use **`CORRECT_REBIND_V1`**, not the ordinary PUBLISH operation. Capture revisions/qualifications and audit; never set `canonicalResult` by a test-only Firestore write in a browser E2E.
4. With exact candidate ID, source hash, statistics artifact SHA, current result/statistics revision, approved administrator and Game allowlist, call `adminPublishNativeReady` using its explicit **PUBLISH** contract. Retain immutable audit; test one idempotent retry, stale-source rejection and denied unauthorized caller.
5. Open the **real website** as an active league member. In **Battles → the selected Game → Open Battle Ledger**, verify the native statistical presentation is eligible and the gated **Recorded Battle episodes** and **Battle record and native social evidence** viewers appear. Select different replay slots and bounded episode groups, follow pagination, inspect 32 KiB fragments and compare against source package. Confirm `getReplayStatistics` full-legacy JSON is not used for this source.
6. Verify **Player/Season statistics** against independently calculated expected figures, including inactive/provisional/disputed state rules. Open Chronicle and review *qualified evidence vs empty/partial/unavailable*, never assign Relationship/Reputation scores merely from neutral social observations.
7. Exercise negative checks (unauthorized role, disabled read flag after restart, outdated source hash or revision, dispute and stale auth) without modifying the private source. Capture UI plus server logs/audit. Record worker, handler, manual-publication, native-reader, payload and browser times separately.
8. Use audited **ROLLBACK** only for a source-only publication with an unchanged independently accepted result. If it is a `CORRECT_REBIND_V1` result correction, normal rollback is intentionally forbidden; use its specific reviewed correction resolution protocol. Reverify GUID claim, source pointers, Season eligibility and permanent source retention.

**Native operator bridge now proposed in this readiness PR:** `scripts/native-ready-emulator-operator.mjs` supports **inspect / validate / publish / rollback**, using the existing Admin-checked callable handlers and exact local `demo-aof-e2e` Auth/Firestore/Storage emulator IDs. It verifies a source SHA, current result and statistics revisions and pinned native artifact/candidate before calling existing backend logic; it never writes `canonicalResult` directly and cannot run against staging or production. The actual Game result must first be independently accepted through **real** participant result submission/confirmation (or a separately reviewed correct administrative authority), not silently synthesized by this bridge. The browser still does not expose native administrative controls, so session B is explicitly **operator-assisted**; this CLI uses callable handlers in-process, **not HTTP/browser Auth transport**, and cannot certify deployed staging. Live browser read surfaces are a separate *manual test checkpoint*, not already accepted.

### Demo-emulator-only native administrator helper

This helper is for a **single already-approved test Game** whose identity, independent result authority, names, replay bytes and rollback have been reviewed. Build Functions first. Start the *same* demo Auth, Firestore, Storage and Functions emulators with explicit `--project demo-aof-e2e`, the local native worker, and **only exact Game allowlists**, pinned processor revision and review flags required for the selected stage. These environment variables must be set for the Functions-emulator process **as well as** for the helper when testing the website's readers. A CLI process flag does **not** magically configure already-running Functions workers.

Create a private JSON manifest outside Git and keep candidate/source revision values pinned between steps:

```json
{
  "matchId": "REVIEWED_TEST_MATCH_ID",
  "gameId": "REVIEWED_TEST_GAME_ID",
  "adminAuthUid": "EXISTING_LOCAL_EMULATOR_ADMIN_AUTH_UID",
  "recordingPath": "/ABSOLUTE/PRIVATE/REAL_SOURCE.aoe2record",
  "sourceSha256": "64_LOWERCASE_HEX_CHARACTERS",
  "candidateId": "64_LOWERCASE_HEX_FROM_VALIDATE",
  "statisticsSha256": "64_LOWERCASE_HEX_FROM_VALIDATE",
  "expectedActiveSourceHash": null,
  "expectedStatisticsRevision": 0,
  "expectedResultRevision": 1,
  "reason": "Independent locally accepted official result and pinned evidence reviewed."
}
```

The placeholders are **never** accepted as valid values. The operator commands run *only* with `GCLOUD_PROJECT=demo-aof-e2e`, `AOF_NATIVE_REPLAY_PROJECT=demo-aof-e2e`, `FUNCTIONS_EMULATOR=true`, loopback Auth/Firestore/Storage hosts, `REPLAY_BUCKET=demo-aof-e2e.appspot.com`, an actual `AOF_NATIVE_REPLAY_PROCESSOR_REVISION`, and explicit operator flags/allowlists. Never place these config values into the public frontend Vite environment.

```sh
node scripts/native-ready-emulator-operator.mjs --self-test
# Before an official result: validate the original with exact SHA and reviewed Game allowlist.
node scripts/native-ready-emulator-operator.mjs validate /PRIVATE/native-operator.json
# Inspect the unpublished candidate; independently accept a Game result via legitimate participants.
node scripts/native-ready-emulator-operator.mjs inspect /PRIVATE/native-operator.json
# After acceptance: set candidate/statistics hashes and exact current revisions.
node scripts/native-ready-emulator-operator.mjs publish /PRIVATE/native-operator.json
# After browser evidence checks: set expectedActiveSourceHash and current
# expectedStatisticsRevision (usually 1) in the reviewed private manifest.
node scripts/native-ready-emulator-operator.mjs rollback /PRIVATE/native-operator.json
```

**Do not** call `publish` until the separate Game result has been independently accepted; do not call `rollback` on a corrected-result `CORRECT_REBIND_V1` publication. Each mutation is rejected on stale expected source/result/revisions. The operator tool deliberately does not set flag values itself, create synthetic Auth accounts, accept results for players, perform browser sign-in or certify cloud transport. Run dry-run/self-tests in CI; real manual Game IDs, Auth accounts and file paths remain private and must be checked on-site.

## During-run evidence log (one row per checkpoint)

Record only nonsecret metadata in a controlled report:

| Field | Capture |
| --- | --- |
| Review | Full tested/deployed commit; environment, explicit Firebase project, operator sign-off and authorized feature scope |
| Recording | Build provenance/reference, source SHA/bytes, source slot mapping review result (avoid raw names in shared logs) |
| Authority | Match/Game IDs (private record), independently accepted result and revision, disputes, audit/correction IDs |
| Lifecycle | Upload-handler start/finish; candidate state; active source ID/revision; source-only publication and rollback transitions |
| Player reads | Battle Ledger/episode/social/Player/Season/Chronicle view status and screenshot or bounded response reference |
| Rewards | Before/after exact result-job status; expected/observed League Points, Gold, other ledger entries; duplicate retry outcome |
| Latency | Internet upload, authenticated callable, Python worker cold/warm, Storage, reviewed PUBLISH and browser paint separately; 1v1/2v2/4v4/FFA where relevant |
| Safety | Session permissions, disabled flag, stale revision and dispute rejection, original generations/hashes still retained |
| Conclusion | **PASS**, **FAIL**, or **BLOCKED**, named blocker, owner, safe reset/recovery action |

For sensitive values use private operator storage, not PR comments or public Actions logs.

## GO/NO-GO and next priorities

**GO for a future local legacy-browser rehearsal only when:** verified local stack, real app mode, accounts, source/result provenance, demo data backup, expected ledgers, access checks, browser and rollback rehearsal, and all attestation gates are complete. Those details cannot be certified solely by GitHub CI.

**NO-GO for cloud/staging or native browser E2E currently:** no authorized staging deployment, no demonstrated staging configuration/secret/rules version or cold/warm browser acceptance, no native administrative **browser** UI (local assisted operator CLI is available), no scoped staging flag-activation authorization. Never use production as a substitute. No user-facing READY activation is authorized.

**Milestone 3 after this readiness package:** (P0) review/use the demo-only native operator bridge, then qualify actual authenticated browser read and result-confirmation flow without any default activation; (P0) verify actual staging deployment and real result-authority/browser joins under separate authorization; (P1) cold/warm/repeated upload profiling, particularly 2v2/4v4/FFA (local validation alone exceeded the desired <20s end-to-READY target); (P1) real-file correction/rebind and full scoring/event finalisation ledger checks; (P1) qualify current Chronicle/social read meaning, leaving draft Story Engine PRs #61/#62 outside the release path unless separately reconciled and reviewed; (P2) design then test autonomous native READY and separately authorize any ordinary-user rollout.

**Completion criterion:** declare the manual session scheduled only after there are **zero unresolved P0 prerequisites** for its chosen scope. A passing local back-end suite or a merged PR is neither deployment nor activation.
