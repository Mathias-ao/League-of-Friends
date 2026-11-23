# EU staging compatibility — UNSIGNED prerequisites (#265 / #264)

Source-only candidate from main `336e2becffecaa1e04ab2e8bc45de3001ed4961d`.
This document authorizes no deployment, resource access/creation, IAM, secrets,
test writes or activation. All actual private values and cloud facts remain
owner-verified inputs. Old staging and production remain untouched.

## Changed compatibility boundary

- The offline web validator/template and private Statistics gateway recognize
  only `age-of-friends-staging-eu`; old staging, production and lookalikes fail.
- The existing frontend Statistics opt-in selects that same EU gateway. Its
  operation/scope envelope, Firebase bearer, ACTIVE membership checks, workload
  OIDC audience/target, response limits and default-off behavior are unchanged.
- The validator additionally requires the actual app ID to equal an independently
  approved private `AOF_STAGING_APPROVED_WEB_APP_ID` audit pin. A Firebase app ID's
  syntax alone cannot associate it with a project. The audit never fetches the
  registration or prints app/API-key values. This pin is not a Vite/runtime flag.

## Private owner manifest — UNKNOWN until individually verified

| Component | Required value / evidence before separately authorized deployment |
| --- | --- |
| Source | Sol-reviewed exact PR commit/tree; matching backend `AOF_DEPLOY_GIT_SHA` and web `VITE_AOF_COMMIT_SHA`; matching actual served artifacts |
| Project | Exactly `age-of-friends-staging-eu`, explicitly selected for every future command; never use `.firebaserc` default/production aliases |
| Firestore | Owner verifies `(default)`, Native/Standard, `europe-west1`; Admin/web use existing default `getFirestore()`, no named DB migration |
| Storage | Owner records actual new bucket name and `europe-west1`; supply explicit `REPLAY_BUCKET` to Functions. Do not assume modern bucket names end in `.appspot.com` or inherit Firestore location |
| Web registration | Owner privately verifies the actual registered EU app ID/API key; `VITE_FIREBASE_PROJECT_ID=age-of-friends-staging-eu`, `VITE_FIREBASE_AUTH_DOMAIN=age-of-friends-staging-eu.firebaseapp.com`, region `europe-west1`, emulators `false` |
| Offline app pin | `AOF_STAGING_APPROVED_WEB_APP_ID` from that independent owner-approved registration, matching `VITE_FIREBASE_APP_ID`; never commit the private env file |
| Auth | New-project Firebase custom-token support, correct authorized Hosting domains, actual runtime token-signing service identity/permissions; separately reviewed `authLinks` and ACTIVE membership/ADMIN provisioning. No account/UID migration |
| Steam | Preserve OpenID popup → server verification → Firebase custom token. Callback `https://europe-west1-age-of-friends-staging-eu.cloudfunctions.net/steamAuthCallback`; realm/callback origin `https://europe-west1-age-of-friends-staging-eu.cloudfunctions.net` |
| Steam origins | Runtime-derived defaults `https://age-of-friends-staging-eu.web.app` and `https://age-of-friends-staging-eu.firebaseapp.com`. Any `STEAM_AUTH_ALLOWED_ORIGINS` additions need explicit exact-origin review; no old/production/wildcard additions |
| Steam metadata | `STEAM_WEB_API_KEY` is optional profile enrichment, not an OpenID prerequisite. No new Firebase Steam/OAuth/Email/Anonymous provider is introduced |
| Statistics opt-in | Only after separate approval: paired `VITE_AOF_STATISTICS_GATEWAY=staging-v1` and `AOF_STATISTICS_GATEWAY=staging-v1`. Both remain unset/default-off in this work |
| Statistics target | Privately record actual protected EU project's Statistics callable Cloud Run origin as `AOF_STATISTICS_GATEWAY_TARGET_URI`, exact HTTPS `.run.app` origin, no path/trailing slash/credentials. It is fixed server configuration, never a browser-selected target |
| Statistics IAM | Owner verifies actual Functions caller service identity and exact target invoker access; no guessed principals, blanket grants or `allUsers`. Same URI is the Google workload ID-token audience. Upstream retains original Firebase user authorization/source fences |
| Replay worker | Separate owner decision required. If approved later, record actual EU worker URL/image/ORIGINAL producer revision and private application-token binding. Existing transport uses exact `REPLAY_WORKER_URL` as IAM audience plus its independent application bearer; no hardcoded old-project issuer/audience found or changed. Never make a worker public |
| Compute | Shared callables and Steam callback already specify `europe-west1`. Verify actual deployed Functions/worker location separately; source options do not prove Firestore/Storage region |
| Release | Owner-approved component/export manifest, Functions and compatible worker before web, restrictive rules/indexes, budget/stop controls and exact D. This unsigned list is not permission to deploy all existing exports |

Only the following commands are offline preparation, run from the repository:

```powershell
# Copy/fill web/.env.staging.local privately from the verified EU registration.
$env:AOF_STAGING_APPROVED_WEB_APP_ID = Read-Host 'Owner-approved EU Firebase web app ID'
node scripts/verify-staging-web-env.mjs web/.env.staging.local
npm --prefix web run build -- --mode staging
Remove-Item Env:AOF_STAGING_APPROVED_WEB_APP_ID
```

Do not enable `VITE_AOF_STAGING_E2E` here. A later approved browser E2E requires
the existing explicit `--for-manual-e2e` audit and separate activation authority.
Parent #264's owner decision permits scheduled backups to remain disabled for
disposable NEW staging; it grants no old-project deletion/migration authority.

## Remaining exact-old-project gates — audited, not enabled or ported

This bounded PR does not claim all-eight-system deployment readiness. These
protected feature paths still reject EU staging and need their own reviewed
source/release disposition BEFORE anyone enables their flags or uses their tools:

- Native recording validation/upload/publication/admin review and diagnostic
  gates: `nativeRecordingIntegration.ts`, `nativePlayerUpload.ts`,
  `nativeReadyPublication.ts`, `nativeRecordingValidation.ts`,
  `adminGetNativeReadyReview.ts`, `adminGetStagingE2eReadiness.ts`.
- Private source/history/social/pilot reads: `getMySocialExperience.ts`,
  `hostedSocialPolicy.ts`, Personality `practicalPolicy.ts`, and corresponding
  frontend private-history/social/gameplay/E2E gates. Immutable approved policy
  payloads explicitly name the old project: they are NOT relabelled or rehashed.
- `manual-e2e-preflight.mjs` and `upload-staging-observer.mjs` still target the
  historical project. Do not use them as EU release approval or execute their
  cloud-side flows. No deploy workflow was found that silently deploys this PR;
  worker-image workflow builds/tests only. `.firebaserc` aliases are unchanged.

Steam source was reviewed without modification: project-derived callback/origins
already support EU; no proven new-project failure warranted an auth rewrite.
Offline tests substitute SDK/storage/network boundaries and exercise the actual
Steam handlers/repository method; they are not live Firebase/Steam/browser proof.
Actual app registration, bucket metadata, IAM, service token minting, sign-in/out,
ACTIVE-member Statistics 200/denials and source correction still require a later
separately authorized human-operated staging verification. None was attempted.
