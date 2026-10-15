# Staging manual E2E — stopped and consolidated (15 October 2026)

**Decision: STOP / CLOSE THE CURRENT MANUAL TEST AS INCOMPLETE.** The user elected to retain verified progress instead of continuing the recording-upload investigation. The Cloud Run deployment was a **contingency** after the original manual staging test reached the Battle-recording upload step; it was not the planned start of a new test milestone. Do not turn this closeout into approval for another staging deploy, a new live smoke test, or any production action.

## What is in GitHub main

- Original staging readiness and manual E2E safeguards: [PR #111](https://github.com/Mathias-ao/League-of-Friends/pull/111) and [PR #112](https://github.com/Mathias-ao/League-of-Friends/pull/112).
- [PR #116](https://github.com/Mathias-ao/League-of-Friends/pull/116): authenticate the ordinary legacy replay-worker call to private Cloud Run, using distinct IAM identity and application bearer credentials.
- [PR #115](https://github.com/Mathias-ao/League-of-Friends/pull/115): use the same private dual-auth transport for the separate **Recorded Events V1** native validation caller; expose validation-only preflight/UI independently of all READY-publication and reader flags. Legacy player upload remains legacy.
- [PR #117](https://github.com/Mathias-ao/League-of-Friends/pull/117): bind the existing worker secret to the admin-only staging readiness callable and package the version-pinning CSV needed to compute the native processor revision *inside* the minimal Docker worker build context, with in-container regression checks.

The last code-bearing consolidation merge is **`7bf69f1d897ccb53c8859b98172171f45ef6851a`** (PR #117). These changes are **merged source**, not evidence that this exact revision was built, deployed or enabled at `https://age-of-friends-staging.web.app/`.

On PR #117's exact head `383c16eae42bac95616a1762937fb20869db7a6f`, **all nine GitHub CI workflows completed successfully**: Replay Tools, website, Backend, Three-Battle Statistics Validation, staging E2E Auth/HTTP smoke, staging native worker image safety, authentic 185872 reviewed READY emulator, Native correction trigger emulator, and Native Recorded Events Worker Acceptance. Their emulator and CI results remain independent from actual cloud acceptance. These are the accepted automated wins; no additional manual testing is requested.

## What the operator actually observed in cloud staging

- The contingency set up the private Cloud Run service `aof-staging-replay-worker` in `europe-west1` using branch revision `018943f`, and redeployed staging Firebase `uploadReplay` with a worker URL and secret reference. Anonymous HTTP access was denied, as expected. This **does not attest** the complete staging website/Functions/rules build or current environment configuration.
- The two observed legacy worker requests failed with HTTP **504 at the configured 240-second timeout** on 15 October 2026; the Cloud Run logs alone do not isolate the exact slow substage. No successful live-cloud recording upload, player-visible Battle statistics, original/derived object verification or cloud end-to-end timing was established in the supplied evidence.
- The independent local measurement/fixture work showed faster Recorded Events V1 source-to-validated-candidate processing, including authentic 1v1, 2v2, 4v4 and FFA evidence; `VALIDATED_NOT_READY` is the intended safe native endpoint. It is **not** a successful normal player upload or automatic READY publication.
- No observed evidence establishes that the latest `main` worker image, Functions, authenticated preflight or staging-only website controls were deployed to staging. The browser's ordinary **Upload recording** still selects the legacy route in current source code. Do not claim the user reached a working native `Validate only` action on the live site.

## What remains unaccepted — deliberately not pursued in this closed test

- A complete, recoverable staging baseline for Auth, Firestore and Storage; synchronized exact-source release to worker, Functions and Hosting; verified worker processor revision, secrets, IAM and `age-of-friends-staging` project/bucket targeting.
- A genuine authenticated staging Battle recording upload, source/roster mapping and immutable artifact retention verified end to end; cloud cold/warm processing timing and safe retry/failure handling.
- Staging browser follow-through for two independent real player result confirmations, authorized native READY publication and rollback, Game/Battle/Season/Player statistics, exact point/Gold ledgers, and Chronicle/social provenance.
- Automatic native player READY, release latency targets, complete Event finalisation and quantitative social progression correctness. No Reputation/Relationship stage tuning or Chronicle story eligibility was certified.

**Do not infer a pass from absence of further testing.** The earlier 9–10 October isolated eight-account local E2E was separately closed as a functional smoke, with its own boundaries: [local closeout](e2e-core-closeout-2026-10-10.md).

## Scope and safety at handoff

1. **Freeze this human E2E** as incomplete. Do not continue the Cloud Run troubleshooting loop, rerun real uploads, enable native worker endpoints, turn on `AOF_NATIVE_REPLAY_INTEGRATION`, enable `VITE_AOF_STAGING_E2E`, publish native READY, start new Cloud Run instances, change cloud secrets/IAM, or deploy without a **new explicit, scoped** decision.
2. Retain existing staging recordings, immutable artifacts, revisions and logs. No blanket staging cleanup or delete operation is authorized. Known deployed contingency resources may incur cost; a separate, read-only operational inventory can precede any later cleanup decision.
3. Leave `league-of-friends-cc274` production untouched. Source merge is not deploy or feature activation. Preserve all disabled-by-default native READY, player/social reader and rollback gates.
4. Treat [PR #113](https://github.com/Mathias-ao/League-of-Friends/pull/113) (design decisions) and [PR #114](https://github.com/Mathias-ao/League-of-Friends/pull/114) (read-only three-family prototype) as **separate drafts** with their own explicit review/implementation gates. Neither establishes qualified live Reputation or Relationship progression and neither is included in this recording E2E closeout.
5. Product development may continue from reviewed `main` without reopening this manual session. A future live staging upload would be a **new decision**, with its own backups, release pin, exact Game scope and safety approval.

**Disposition: consolidated recording source and green CI retained; cloud upload and full staging E2E remain unverified; manual test closed by user direction.**
