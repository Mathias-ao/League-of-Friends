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
| Worker and client | Worker URL authenticates with its private token (never Vite), origin/Steam redirect and callback are staging allowlisted, processor revision is pinned to deployed image and a 64-hex SHA, cold/warm invocation verified. Web and Functions are from the *same reviewed commit*. |
| People / Game | Distinct real browser sessions for ADMIN and at least two active independent Game participants, separate Firebase/Steam-linked AoF accounts, approved Game source-name bindings, correct draft/map/play window, independently adjudicated official winner/team (not simply replay result). |
| Release-mode verification | Browser `VITE_FIREBASE_PROJECT_ID=age-of-friends-staging`, `VITE_USE_EMULATORS=false`, `VITE_AOF_STAGING_E2E=true` **only after approved staging UI activation**; no preview data; backend exposes `adminGetNativeReadyReview` but still refuses unauthorized calls. |
| Tooling | [Offline preflight](../../scripts/manual-e2e-preflight.mjs) manifest passes *after operator has verified actual facts*, exact expected scoreboard and point/gold ledger prepared; staging health/Cloud Run telemetry and browser evidence capture ready. |
| Smoke | Before the manual session, an isolated admin review `not-found`/denied-request test and an unauthenticated/PLAYER deny test must pass; confirm worker failures cannot result in active READY or score. This is actual staging smoke, not automated by a self-test. |

The UI flag is **not security**. Native operations still require the backend's explicit `GCLOUD_PROJECT=age-of-friends-staging`, `AOF_NATIVE_REPLAY_PROJECT`, `AOF_NATIVE_REPLAY_INTEGRATION=validate-v1`, source-worker token and processor SHA, `AOF_NATIVE_REPLAY_GAME_ALLOWLIST`, `AOF_NATIVE_READY_PUBLICATION=reviewed-v1`, separate `AOF_NATIVE_READY_GAME_ALLOWLIST`, `AOF_ACTIVE_NATIVE_PLAYER_READS=1`, `AOF_ACTIVE_NATIVE_SOCIAL_READS=1`, and separately enabled `AOF_NATIVE_READY_ROLLBACK=reviewed-v1` for recovery. **Do not set these until specifically approved**. Never commit service-account credentials, private tokens, identities, live replay data, or Firebase release secrets.

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
| #112 staging browser admin/independent result controls | Draft code; pending review and full CI |
| Explicit staging deploy authorization | **Not given** |
| Scoped staging native/read/rollback flag authorization | **Not given** |
| Real staged cloud/browser upload-to-READY | **Not tested** |
| Ordinary automatic player native READY | **Not implemented or activated** |

No one should request the user's E2E session until the checklist is backed by real staging evidence, not just green compilation and emulator tests.
