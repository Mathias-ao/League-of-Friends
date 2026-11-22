# Hosted owner-private social progression — #246 / #247

This implementation is approved for code and tests only. It creates no runtime
approval, activates no feature, and changes no IAM or deployed service.

## Authority and scope

The owner approved D1 owner-private reads and D3 the four-method ORDINARY +1
candidate from #256, SHA-256
`e96e6ed6ccb846ec41f895c0dab90795cbf919cea0d823eb02371d18a8267c88`.
The exact 3293-byte UTF-8 payload, including its trailing LF, is embedded and
checked at module load. Its policy and configuration remain PROPOSED/null.

Sol's reserved-file release and external approval schema are recorded in
[#246 comment 7076511256](https://github.com/Mathias-ao/League-of-Friends/issues/246#issuecomment-7076511256)
and [comment 7076540849](https://github.com/Mathias-ao/League-of-Friends/issues/246#issuecomment-7076540849).
The optional final-transaction callback in `collectMyCurrentBattleHistory` was
separately released in
[comment 7079081124](https://github.com/Mathias-ao/League-of-Friends/issues/246#issuecomment-7079081124).
Existing callers have no new approval dependency. No other Personality or
Statistics evaluation, shared App navigation, scoring, or public Chronicle
behavior changes.

## Read and evaluation contract

`getMyHostedSocialProgression` accepts exactly `{}`. Firebase authentication,
server-derived linked player identity and ACTIVE membership are required.
The server gate requires `AOF_HOSTED_SOCIAL_PRIVATE=v1a` and staging project
identity; the frontend additionally requires its matching build-time gate and
staging project, with emulators excluded from the normal UI capability.

The callable uses the existing complete current-source collector and its
GUID/hash/generation/revision/roster/Event/schedule/access fences. A single final
read-only transaction validates the entire source witness and the external
approval record together. Changes reject the response; there is no partial
Career presented as complete. Reads are bounded to eight own Games and a
256-Battle league enumeration, a 100-second application deadline, 16 MiB
compressed / 128 MiB expanded artifacts, 40 MiB requests, 70 MiB worker responses
and a 512 KiB owner DTO. Exceeding complete-history limits requires an explicit
future bounded-history design; this implementation does not silently truncate.

The fixed `/social-hosted-grade-v1` route uses the existing workload identity and
separate application bearer. It requires its own staging-only, default-off
worker switch. It calls the existing source method implementation without
re-extraction, alternative detectors or a second scorer. Demo-only routes retain
their existing restrictions. The transport receives the caller's remaining
deadline and cannot start a POST after token acquisition outlives that deadline.

The merged #248/#250/#251 evidence projections deduplicate connected components
and preserve factual pairs. The unchanged #139 evaluator applies Career and
Season windows, canonical Battle/Event budgets, [2,3,5,8] boundary costs,
directional actor witnesses and reciprocity rules. Only these exact bindings
can supply ORDINARY +1 strengthening:

| Track | Source method | Existing rule |
| --- | --- | --- |
| Gallantry | `AOF_SV1E_CHALLENGED_RETURN_PRESSURE_1` | `E2E_DARING_OFFENSE` |
| Chivalry | `AOF_SV1E_NOTEWORTHY_THREAT_PROTECTION_1` | `E2E_NOTEWORTHY_DIRECTED_PROTECTION` |
| Rivalry | `AOF_SV1E_PAIR_RAID_ENGAGEMENT_CONTEST_1` | `E2E_PAIR_CONTEST` |
| Bond | `AOF_SV1E_THREAT_LINKED_DIRECTED_HELP_1` | `E2E_DIRECTED_HELP` |

The pilot also requires decoded locked fixed-team alignment matching the
original roster partitions. Helpers require a source-bound opposing third-party
threat. Uncertain opportunities withhold affected numerical subjects. Missing
source coverage withholds affected numerical history. Known roster and Season
scope preserve independent complete pairs and Season windows; unknown scope
stays conservative. Quiet verified pairs remain with
independent Pending tracks; withdrawal removes facts supported only by that
source. Cruelty, Hostility, SUBSTANTIAL, weakening, Treachery and public awards
remain withheld. No absent measurement becomes a fabricated zero.

Only whitelisted owner projections leave the callable. It returns no proof,
storage references, private notes, claims, counterpart Career, receipts,
publication envelopes, entitlements or League points. Incoming relationship
activity is restricted to the owner's shared pair. Logout, account replacement,
membership changes, unmount and stale requests clear or discard private values.
Refresh clears old values, automatically retries revision aborts twice, and
then offers an explicit recovery action. Identical bootstrap snapshots do not
restart an in-flight read. The hosted callable alone has an explicit 125-second
Firebase SDK timeout, covering its 100-second application budget and 120-second
function limit. Other repository calls retain their current deadlines.

## External runtime record — deliberately absent

The fixed path is
`privatePilotApprovals/AOF_SOC_V1A_SOURCE_BOUND_ORDINARY_GRADES_1`. No migration,
seed, deployment configuration or runtime document is included. A future real
record must have exactly:

| Field | Required value |
| --- | --- |
| schemaVersion | `AOF_SOC_V1A_PRIVATE_APPROVAL_1` |
| status | `APPROVED` |
| approvalRef | Actual separately authorized runtime decision; not this code-only handoff |
| approvalRevision | Positive safe integer |
| configurationResource | `AOF_SOC_V1A_PRIVATE_POLICY_CANDIDATE_1` |
| configurationSha256 | The exact hash above |
| policyVersion | `AOF_SOC_V1A_SOURCE_BOUND_ORDINARY_GRADES_PROPOSED_1` |
| configurationVersion | `AOF_SOC_V1A_PRIVATE_ORDINARY_CALIBRATION_CANDIDATE_1` |
| project | `age-of-friends-staging` |
| purpose | `OWNER_PRIVATE_NUMERICAL_PILOT` |
| visibility | `OWNER_ONLY` |
| authorizedScopes | `[OWNER_PRIVATE_READ, PRIVATE_NUMERICAL_PREVIEW]` |
| publicPublicationAllowed | `false` |
| officialWritesAllowed | `false` |
| entitlementGrantsAllowed | `false` |

Content and Firestore update time are fenced. Missing, malformed, revoked,
wrong-project, code-only or changed approval fails closed. Controlled approval
fixtures exist only in tests and an explicitly asserted demo emulator. Existing
Firestore rules deny browser writes; their admin catch-all is not workload
identity isolation and this PR makes no such claim.

## Verification and evidence labels

Local full builds passed, with 800 backend tests passed / two skipped and 224
frontend tests passed. Focused suites cover the immutable specification, strict
registry, caps and direction, separate Career/Season windows, fixed-team and
third-party opportunity, quiet pairs, correction/revocation/source races,
transport identity/deadline and mounted authentication/privacy/recovery. Review
regressions preserve a complete Season when another Season's opportunity fails,
and an owner-A pair when owner-B derivation is unavailable. The actual installed
Firebase SDK accepts a controlled 75-second response and bounds a hung request
at 125 seconds. Incomplete empty shared history has qualified wording and a
refresh action; the emulator feeds the withdrawn-source collector DTO through
the real parser and mounted profile.

An isolated Firestore/Storage emulator run passed with five pinned genuine
recordings in four formats, eleven controlled identities, a two-Game Battle,
reverse upload order, the new callable and fixed worker route, and genuine DTO
rendering in the mounted profile. It exercised independent actors, correction,
withdrawal, remapping, schedule fences and zero public receipts. These are
genuine original recording bytes with controlled league mappings, not an actual
historical league series or a hosted browser acceptance result. Final exact-head
CI repeats this run, including the final fixed-team helper gate.

`hosted_social_source_cases.py` independently passed retained native packages
from genuine 1v1, 2v2 and 4v4 originals. The 4v4 source admitted all four supported
methods. Withholding the independent Raid detector made all four Pending in
controlled ablations. Naturally nonqualifying candidates are reported separately
and are not advertised as matched replay negatives. Synthetic post-binding
unit fixtures test adapter conformance, not source-method positives.

The targeted new worker-route HTTP authorization test passed locally. The full
Windows HTTP authorization suite encountered connection resets in existing
cases; Linux exact-head CI must pass the complete suite. A follow-up local probe
that started as the emulator shut down timed out and supplies no additional
verification evidence.

## Separate release package required after independent acceptance

Before any staging release, obtain Sol's acceptance and the owner's separate
runtime authorization. Prepare the exact accepted commit and CI evidence, real
approval reference and record revision, compiled policy digest, immutable worker
image and its actual processor fingerprint, existing workload identities,
fixed worker URL/audience and secret binding, and compatibility of retained
sources with that fingerprint. Worker-source changes alter the processor
fingerprint; do not relabel old sources to make them current. Any re-derivation
or artifact migration needs its own approved release procedure.

The later operator plan must identify server/client/worker switches, the absent
approval record, and rollback by closing those gates. This document performs
none of those actions. No new IAM grant is authorized.

Remaining real staging browser checks: authorized owner genuine reads across
Career/Season and both pair directions; outsider and signed-out denial; absent
and revoked approval; correction and withdrawal during a read; account switch
and logout with in-flight requests; transient and persistent abort recovery;
deadline and complete-history limit behavior; no public receipts, titles,
awards or points; unchanged demo-route denial and ordinary upload/statistics.
