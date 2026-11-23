# EU native/private compatibility — UNSIGNED (#267 / #264)

Base verified before editing: `b3285f20449ffa1281749911f0aa4f0f28df824f`, the
accepted merge of #266. Lane A: one isolated source branch / one draft PR for
independent Sol review. This is not D, an approval signature, a cloud inventory,
a migration, policy activation or evidence of a hosted player journey.

## Source disposition and changed-file inventory

| Slice | Files | Result / dependencies |
| --- | --- | --- |
| Exact server identity | `functions/src/config/stagingProject.ts` | EU only, `FUNCTION_REGION=europe-west1`, coherent project variables, no hosted emulator settings; explicit demo emulators remain separate. No flags enabled |
| Native recording | `engines/nativeRecordingIntegration.ts`, `engines/nativePlayerUpload.ts`, `services/nativeReadyPublication.ts` | Apply that identity gate to validation, ordinary upload, READY publication/correction and emergency rollback. Existing role, exact Game allowlists, reader flags, source/processor/revision/immutable-artifact checks retained |
| Worker transport/diagnostics | `services/nativeRecordingValidation.ts` | EU diagnostic/hosted-route guards; literal `FUNCTIONS_EMULATOR=false` still requires OIDC. Only actual isolated demos can skip workload IAM; application bearer, fixed routes/audience, redirects, budgets and no legacy fallback retained |
| Operator metadata | `queries/adminGetNativeReadyReview.ts`, `queries/adminGetStagingE2eReadiness.ts` | Strict EU/demo admin gates; actual caller auth, Game approval, source pins, bucket/SHA checks retained. A green environment report grants no authority |
| Private source/history | `queries/getMySocialExperience.ts` | EU/demo gate is reused by existing history/Personality/gameplay/Chronicle collectors. Owner membership, participant/schedule/source/GUID and final correction fences unchanged |
| D2 stop | `engines/personalityV1/practicalPolicy.ts` | EU returns no numerical runtime, even if the old flag is set. It reads/provisions no approval record on that path. Real source counts remain available with Developing/null axes |
| R stop | `queries/getMyHostedSocialProgression.ts` | Refuse archived projects and emulator masquerading before policy/source/worker I/O. EU still fails the unchanged old-project policy resolver. A copied or relabelled old approval is not EU authority |
| Frontend identity/invocation | `web/src/domain/stagingProject.ts`, `privateHistory.ts`, `gameplayPreview.ts`, `hostedSocialProgression.ts`, `ui/StagingE2eControls.tsx`, `ui/BattleDetails.tsx`, `data/FirebaseLeagueRepository.ts` | Explicit flags plus exact EU/region or permitted demo gates; private repository methods independently reject disabled/foreign configuration before SDK calls. No UI redesign |
| Offline preparation | `scripts/manual-e2e-preflight.mjs`, `scripts/upload-staging-observer.mjs` | EU-only templates/origins; old/production/lookalikes rejected. Native write/activation attestation remains separate. Parent #264's disposable-staging backup decision requires explicit `disposableStagingDataLossAccepted`, rather than a false backup attestation |
| Focused tests | `functions/tests/eu-staging-guards.test.mjs`, `web/tests/eu-staging-guards.test.ts` | Actual EU gates/READY/owner history/repository methods; old/production/project mismatch/region/emulator/disabled flag/unlinked/inactive/unauthenticated/foreign Game/withdrawal/producer mismatch/unapproved policy negatives |
| Relevant regression fixtures | Backend native review/readiness/diagnostics/worker-OIDC/private-source/hosted-policy tests; web E2E/profile/SDK deadline tests; observer tests | Update hosted positives to EU identity. Retain archived immutable-policy validation as controlled in-memory reference tests. SDK deadline test isolates its new rollout precondition; gate tests cover refusal separately |
| Genuine demo regression | `functions/tests/int-c2b-progression-emulator.mjs`, `functions/tests/support/hosted-social-projection-fixture.mjs` | Remove the old-project/emulator masquerade and synthetic hosted approval provisioning. Assert actual EU hosted-policy refusal; retain genuine source collection, proposed pure evaluator, per-actor DTO/UI, withdrawal/correction and quiet-pair checks in an explicit demo-only fixture. Report hosted route/read/mounted acceptance **false**, pure proposed projection separately. This does not qualify EU policy or hosted E2E |

Backend paths without a prefix above are relative to `functions/src/`.
The PR's exact changed-file list/diff is authoritative; existing workflows are
not weakened, bypassed, skipped or replaced. Required PR-head CI must finish and
Sol must independently accept the exact head before any integration request.

## Deliberate omissions / immutable dependencies

- **Steam** OpenID popup → server verification → Firebase custom token remains
  unchanged, as do auth links, ACTIVE/ADMIN checks, App Check, normal source-reader
  admission, scoring, chronology, awards and private publication rules.
- **D2 payload** `practicalPolicyResource.ts` remains byte-identical, SHA-256
  `7ec5d2dce94eb6e04e0a5f3a1130b54fc0b890489ffa7bb652996e136e32083c`.
  No EU relabel/re-hash, approval inheritance or proxy/catalogue change.
- **R payload/resolver** `hostedSocialPolicy.ts` remains byte-identical, SHA-256
  `e96e6ed6ccb846ec41f895c0dab90795cbf919cea0d823eb02371d18a8267c88`.
  Its old-project scope is intentionally not ported. The hosted worker's R
  project-bound policy route is likewise not ported; native processing is a
  distinct route. EU numerical R needs a separate owner policy decision and
  reviewed source/producer disposition, not just a flag or new database record.
- Demo-only progression, honours, Chronicle interactions and Personality test
  calibrations stay demo-only. No new hosted numerical policy is introduced.
- The existing observer measures direct Statistics responses; it does not claim
  to measure the #266 bootstrap gateway response. Gateway observation is a
  separate evidence dependency, not invented latency/display proof here.
- `.firebaserc`, rules/indexes, environment files, package locks, CI workflows,
  policy records and worker/parser source remain unchanged. No cloud tools or
  live preflight/observer/browser/write scripts were run by this implementation.

## Remaining owner-only / release matrix — all UNSIGNED

| Gate | Remaining exact input / authority |
| --- | --- |
| Independent source acceptance | Sol review + all actual required workflows at the final exact PR head. Draft PR is not permission to merge |
| New project | `age-of-friends-staging-eu` only; preserve `age-of-friends-staging` as untouched archive, no old data/identity/recording transfer |
| EU database/bucket | Parent #264 records owner-reported `(default)` Native/Standard Firestore and Storage region `europe-west1`. These are not this worker's cloud attestations. Exact bucket name/rules/indexes remain private owner inputs |
| Web registration / Steam | #265's private independently approved web app pin, actual EU API/app config and domains; legitimate Steam identity/custom-token minting, reviewed new authLink/role provisioning. No anonymous/email substitute |
| Source/component pins | Reviewed exact commit/tree, backend/frontend commit pins, approved export/trigger manifest, build artifacts and matching actual producer/catalogue SHA. No blind copy of historical images, aliases or 94 IAM grants |
| Worker / IAM / secret | Separate owner decision whether to operate a private replay worker; exact EU URL/audience, verified source image/fingerprint and separate app-bearer binding. No inferred resource, grant, key or secret value supplied here |
| Native rollout | Separate explicit per-flag approval for validation, ordinary upload, READY/correction/rollback and native reads; exactly the tested Game allowlists. No wildcards. All current values remain unset/default OFF |
| Private history / UI | Separate explicit backend/frontend source/history flags and source-current owner-private release checks. Enabling read capability does not authorize numerical policy or data writes |
| D2 EU policy | Owner must decide whether to approve a separately scoped EU policy/runtime package. A later reviewed implementation must consume that authority; this PR deliberately cannot enable D2 EU numbers. Original R/D2 hashes remain historical |
| Personality A proofs | Producer-selected catalogue SHA matching the actual source build plus observed positive request-cost coverage; missing evidence stays Developing/null. No unpriced-zero substitution or broader calibration |
| R EU policy | Owner's exact EU-scoped private policy decision, approved immutable payload/source/producer identity and privately provisioned authorization, followed by source-current security review. Existing old-project R approvals are insufficient; keep backend/FE hosted R flags OFF |
| Disposable recovery | Owner opted out of scheduled backups in #264. Explicit data-loss acceptance is still required by the offline attestation; never claim a backup or restore rehearsal occurred |
| Deployment D / E2E | A later owner-exact component deployment and separate write authorization. Correct Functions/worker before web; actual Steam, ACTIVE-player positives and privacy/source/correction negatives, then fresh original-recording tests. No source-only result proves hosted all-eight acceptance |

No creation, IAM change, deployment, runtime activation, policy provisioning,
application write, original upload/reprocessing or migration was performed.
