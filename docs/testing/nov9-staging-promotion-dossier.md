# November 9: staging AUTO promotion and recovery dossier

**Status: PREPARATION ONLY · HOSTED NO-GO.** Parent release [#218](https://github.com/Mathias-ao/League-of-Friends/issues/218); operational task [#241](https://github.com/Mathias-ao/League-of-Friends/issues/241); independent acceptance Sol; cloud operator **to be identified from already-authorized access**. This document is a fillable release-control package, **not** permission to deploy, grant access, reset data, create events, upload replays or run a cloud pilot.

## 1. Intent and immutable boundaries

Promote the **existing isolated** `age-of-friends-staging` website, and only proven-necessary companion components, to a mutually compatible version of reviewed source before the **9 November 2026** four-BO1 real-browser pilot. No new cloud environment or architecture. Do not touch production (`league-of-friends-cc274`) or the repository's unrelated default Firebase alias (`league-of-freinds`). Explicitly target the staging project, Hosting site/channel and `europe-west1`; **confirm actual** site/channel/region before preparing deployment arguments.

| Item | Observed / candidate | Verification |
| --- | --- | --- |
| Accepted source candidate | `c2eea748ee8bbef497f90f99dde7bff5eac7931f` (includes PR #240 three-Game Personality visibility) | Merged-main 3/3 checks green, Sol acceptance in [#218](https://github.com/Mathias-ao/League-of-Friends/issues/218#issuecomment-6658112544); re-pin if main changes |
| Observed public website client | Entry declares `ea417d7ad09a57cbb4eec2dda262fbe80a3c29c3`; Firebase client calls `sendReplay(...,"LEGACY")` | Read-only HTTP asset evidence / SHA-256 in [Sol's report](https://github.com/Mathias-ao/League-of-Friends/issues/218#issuecomment-6658112544) |
| Required normal client behavior | Ordinary eligible player upload invokes `AUTO`; source/admission chooses native route only for separately approved exact Games | Verified source/CI; **not** hosted proof |
| Hosting management release/channel ID | **UNKNOWN — private inventory required** | Public HTTP asset hash is *not* the Hosting release ID |
| Deployed Functions, triggers, worker, processor | **UNKNOWN — private inventory required** | Do not assume previous October contingency matches source or that all components need redeploying |
| Auth, Season, Storage/rules/indexes, recovery and costs | **UNKNOWN — private inventory required** | No public issue may contain private identifiers, tokens or raw environment/secret values |
| Four new originals, pilot-specific Game IDs and expected oracle | **PENDING OWNER INPUTS AND GAME APPROVAL** | Never use placeholder hashes/GUIDs/winners as actual expectations |

The original October staging experiment and archived playbook are **history, not an approved continuation**. It observed two legacy 504/240-second timeouts without successful live native READY. See [closeout](staging-manual-e2e-closeout-2026-10-15.md). Public Hosting 200 proves only asset availability.

## 2. Operator inventory handback — read-only before any rollout

An **existing already-authorized operator** must privately record actual values, observation time (UTC and Asia/Tokyo), source, principal, permission boundary and evidence location. No role grant or login workaround to obtain access. Share only a sanitized summary in [#241](https://github.com/Mathias-ao/League-of-Friends/issues/241) / [#218](https://github.com/Mathias-ao/League-of-Friends/issues/218).

| Component | Current deployed pin / status | Candidate / necessary delta | Evidence + owner |
| --- | --- | --- | --- |
| Hosting project/site/channel/release + restorable prior release | **PENDING ACCESS** | Accepted web source/site only after approval | Operator to fill privately |
| Web JS/CSS hashes, Firebase project, Auth domain, region, emulator/preview flags | **Observed public assets only** | Staging-only; `VITE_USE_EMULATORS=false`, `VITE_AOF_STAGING_E2E=false`; normal AUTO client | Operator + Sol |
| Functions and scheduler: each relevant callable/trigger runtime, image/build and `AOF_DEPLOY_GIT_SHA` | **PENDING ACCESS** | Change **only if incompatible** with accepted web/source and source retention | Operator + Sol |
| Private Cloud Run worker: immutable image/base digest, `native_processor_revision()`, Python/decoder, region, private invoker and secret **version references** | **PENDING ACCESS** | Change **only if drift proved**; private dual-token admission stays intact | Operator + Sol |
| Native upload/read gates, exact Game allowlist and Storage bucket/rules/indexes | **PENDING ACCESS** | Exact approved `matchId/gameId` pairs **after** real Game IDs exist, never wildcards | Operator + Sol |
| Two separate ACTIVE PLAYER accounts and distinct noncompeting ADMIN Emperor; verified Steam names/roles | **PENDING ACCESS / IDENTITIES** | Do not fabricate identity/alias; keep identifiers private | Operator + owner |
| Active Season, Events, source GUID claims, scheduled jobs, archived artifacts and retention | **PENDING ACCESS** | No reset/overlap/bulk cleanup to force pilot eligibility | Operator |
| Backup/export metadata and tested restore ability across Auth/Firestore/Storage + rollback of code/config | **PENDING ACCESS** | Recorded exact recovery target **before** change | Operator |
| Billing/quotas/request limits/timeouts, existing cost baseline and human stop authority | **PENDING ACCESS** | Finite observed limits and approved cost stop procedure | Operator |

**Block promotion** if recovery is only a historical assertion, the worker/Functions parser pin is unknown, cloud spend cannot be monitored, required role/secrets provenance is unverified, or the actual source/config combination cannot be shown compatible. Missing access means **PENDING/NO-GO**, not “probably current”.

## 3. Prepare the artifact and minimal diff OFFLINE

1. Freeze accepted `main` SHA, Git tree, relevant CI job links, and clean local source. Build all artifacts only from the same reviewed tree. Store hashes and exact build inputs privately; never rely on a moving branch/tag.
2. Create a **private** `web/.env.staging.local` from `web/.env.staging.example` using approved staging public web app configuration and the candidate `VITE_AOF_COMMIT_SHA`. Never use `web/.env.example`, the repository Firebase default, preview/mock auth or a production app.
3. Offline audit: `node scripts/verify-staging-web-env.mjs web/.env.staging.local` (must PASS, manual UI **off**). Then `npm run build --prefix web -- --mode staging`. Inspect generated client/bundle to verify the current **ordinary** upload uses `AUTO`, actual staging config and source revision; record resulting artifact hashes. An offline test **does not prove deployment**.
4. Backend compatibility: `npm run build --prefix functions` from the exact source; compare actual running Functions/revision and source/contract versions before deciding to touch them. No blanket Functions/rules/index/scheduler deploy. The exact build command requires dependencies to be installed; a missing package is an offline blocker, not a cloud fallback.
5. Worker **only if necessary**: review `replay-tools/Dockerfile.staging`, `replay-tools/requirements.txt` and `.github/workflows/staging-native-worker-image.yml`. Optionally build locally with `docker build -f replay-tools/Dockerfile.staging -t aof-native-worker:review replay-tools`. Record immutable candidate image/base digests, in-image processor revision and dual-auth / disabled-route checks. Local image passes do **not** attest a deployed Cloud Run revision. Never place app token or IAM identity in web `VITE_*` values.
6. Reconcile exact current→candidate differences **component by component**. Each required change needs: existing version, intended version, reason, artifact hash, dependencies, owner, auth/rules effect, projected cost, rollback target and explicit approval. If the existing backend/worker matches, **do not redeploy it**.
7. Keep source observation and official score independent: no release tweak may award a win from a replay with unresolved official result, remap aliases permanently, create a free social point or activate a public trophy. A Personality profile unlocks after **three eligible Games** in merged source; numerical calibration and private demo routes remain **emulator-only**, not a hosting flag to enable in cloud.

## 4. Separate authorization matrix (all currently unapproved)

| Permission tranche | Minimum proposal | Approval state |
| --- | --- | --- |
| **P1** Hosting artifact promotion | Exact site/channel, accepted source commit and bundle hashes, operator, release/rollback IDs, time and read-only smoke | **NOT APPROVED** |
| **P2** Necessary Functions/worker/flags/rules/IAM/billing modification | Only proved incompatibilities and exact changed keys/revisions; maintain worker private; no blanket deployments | **NOT APPROVED** |
| **P3** Recoverability operations | If missing: precisely specified backup/export, restore test and cost/retention impact | **NOT APPROVED** |
| **P4** Pilot data/identity/test operations | Two Event plans/four BO1 Games, approved roles, immutable originals, Game-specific audited binding, result/correction and source processing | **NOT APPROVED** |
| **P5** Hosted window/limits | Proposed 90 minutes, one active extraction, at most 24 upload attempts, 16 extractions, 200 mutating callables and US$10 incremental **stop** budget **subject to actual billing visibility** | **NOT APPROVED; proposal is not a hard cloud cost cap** |

The previous authorization permits existing-operator **read-only inventory only**. No early promotion under “preparing for Nov 9”. A separately approved action may have a smaller scope than any proposal above.

## 5. Release choreography and rollback — execute only after P1–P3 approval

1. **Pre-change:** verify actual staging project/site, authorized operator, current pinned resources, exact recoverable rollback targets, backup coverage, current source/result/Season states and spend/quotas. Preserve originals and history. Abort if any critical value remains unverified.
2. **Compatibility order:** provision **only the approved proven necessary** worker/Functions versions and safe gates **before exposing** the modern AUTO web client. Keep native processing inaccessible to unallowlisted Games, and stop new intake during promotion if required. Do not change IAM or secret payloads without separate explicit approval.
3. **Publish the exact approved staging Hosting build only**, not default Firebase project/production. Verify served HTML/imported JS/CSS hash, project/Auth/region, declared source commit and normal player AUTO implementation against the manifest, not a green Health badge alone.
4. **Nonmutating acceptance smoke:** inspect site, signed-out/outsider denial, A/B/Emperor compartmentalization where permitted, expected callable version and route configuration via approved read-only inspection. Do not invoke private processing, source upload, Steam account refresh or writes as “smoke”.
5. **Halt and recover:** wrong project/release, old LEGACY bundle, incomplete Functions/worker version, missing original retention, unexpected public access, cross-account leakage, unexpected writes, repeated 5xx, spend uncertainty or any resource cap breach => STOP intake; retain original/failed artifacts and audit; invoke **only the separately approved** version/config rollback; verify final served and backend pins. A code rollback **does not undo** Game results/points or accepted source evidence.
6. **Operator handback:** timestamped before/after versions, release IDs, rollback proof, permitted smoke results, costs and remaining blockers, redacted for GitHub. Only then can the team request actual pilot authorization.

## 6. November 9 browser evidence, still a distinct GO

Follow [browser runbook](nov9-browser-runbook.md) and [two-Event acceptance](nov9-two-event-four-game-acceptance.md). Four newly downloaded, **unchanged** distinct original 1v1 recordings need hash/GUID/source name/slot/teams/settings and terminal-outcome review, and the two competing test accounts + a separate noncompeting Emperor must be approved. Generate `OWNER_NEW_RECORDINGS` expected points/W–L/ranks with `scripts/nov9-pilot-report.mjs` rather than choosing desired results.

Once separately authorized, the user journey is **publish → RSVP → check-in → warmup/main BO1 plan → normal AUTO upload → unknown-name safe rejection → Emperor audited Game-only name binding → retry the identical original → current READY → measured Statistics/observed records/official standings → factual Chronicle → notices and privacy**, then idempotency and **one genuinely evidence-supported** correction if inputs permit. A source replacement requires an admissible alternate original; verified Steam-name automatic matching requires an actual matching name. Neither is guaranteed by four arbitrary originals.

The five-Battle qualification affects **only a Season Statistics metric cohort-leader seal**, not Season points, Game/Season Statistics, observed records or Chronicle from first admissible evidence. Reputation/Relationships only change for proved events. No public honours, emulator-only numerical Personality activation or unsupported social stage positive. Record per-operation revisions and click→READY observations, but **four 1v1 timings are not a p95<20s four-format certificate**.

## 7. GO / NO-GO signature sheet

| Gate | State | Evidence reference / approver |
| --- | --- | --- |
| Main/candidate SHA, CI, artifacts | **SOURCE PASS; artifacts PENDING** | Sol to complete |
| Private deployment pins and compatible route | **PENDING / access blocked** | Existing authorized operator |
| Approved accounts, Season, source storage/retention | **PENDING / access blocked** | Operator + owner |
| Backup/rollback AND billing stop visibility | **PENDING / access blocked** | Operator |
| P1–P3 exact release/backup approvals | **NOT APPROVED** | Owner |
| Staging promotion and observed ordinary AUTO | **NOT EXECUTED** | Operator, Sol witness |
| Four originals/score oracle + P4–P5 test approval | **PENDING INPUTS/APPROVAL** | Owner |
| Human-browser four Game pilot | **NOT EXECUTED** | Operator and Sol |

**Release decision:** `NO-GO` until each relevant gate is **observed and signed**, not inferred from green CI. Coordinate current updates under [#241](https://github.com/Mathias-ao/League-of-Friends/issues/241); keep [#218](https://github.com/Mathias-ao/League-of-Friends/issues/218) the authoritative November release outcome ledger.
