# INT-V1 — authenticated private integration

Work order [#122](https://github.com/Mathias-ao/League-of-Friends/issues/122); independent final acceptance [#132](https://github.com/Mathias-ao/League-of-Friends/issues/132). Base verified 18 October 2026: `dda3c4d277568c14a2aa51a800a1167e31feedb1`. Uses [SHARED_1](../../contracts/social-v1/README.md), [inference-first policy](../architecture/social-v1-inference-amendment.md) and the [launch roadmap](../project/SOCIAL-V1-LAUNCH-ROADMAP-2026-10-17.md). This is incremental implementation, not launch completion.

## INT-A: current source → private Battle view (this PR)

`getMySocialExperience({matchId,gameId})` accepts identifiers only. Auth derives the owner; no arbitrary player selection or administrator override. An ACTIVE linked participant in this Game and Battle may request their private view. The response contains a canonical validated `SourceSnapshot`, all five Personality axes and six social tracks explicitly Pending/null, and Pending Chronicle/recognition seams. It is **single-Game**, not a complete Battle feature, a longitudinal profile, a stage-zero award or a historical ledger.

Reuse `loadActiveNativeEvidence`, the immutable native artifact decoder and `currentOfficialGameOutcome`. Add bounded transactional Event/Season/participant/GUID/source admission and final read fencing. Match document ID is stable Battle ID. Game ID, original GUID, active source hash, statistics revision, roster mapping, original/events/statistics digests and generations, Event admission and current result are bound separately. Pending official results preserve source-verified statistics; no official winner is invented. Validated candidates, stale READY documents, disputes, replacement Battles, withdrawals, missing GUID claims or mismatched artifact/roster fail closed. Historical legacy sources remain on existing readers; this first native-only slice does not manufacture native authority for them.

Canonical schema is copied into the Functions build from its sole source in `contracts/social-v1`; runtime validation checks its SHA against generated declarations, closed schema and cross-field invariants. Ajv is now a production dependency because this validation runs inside Functions. No alternate schema, parser, conduct algorithm or historical evaluator is introduced.

`BattleDetails` adds an explicitly requested private inspection inside the Battle Ledger. Repository call → authenticated handler → canonical DTO → source/revision-labelled UI. There is no automatic polling, local storage, raw replay, artifact path, source name, testimony/audit, guessed slider position or stage. Changing Game/owner/source/revision, auth change, failure or closing clears prior output; late requests are discarded. Existing statistics, normal result/standings, achievements and Enemy Progress paths are unchanged.

Both gates default OFF: backend `AOF_INT_V1_PRIVATE_READS=source-v1`, client `VITE_AOF_INT_V1_PRIVATE_READS=source-v1`. Backend permits only `age-of-friends-staging` or an explicitly emulated `demo-*` project; client has the matching staging/demo restriction. Existing native read gate is also required. These names describe implemented configuration, **not authority to change any flags**. Tests opt in only in local demo process memory. This slice performs no database writes, worker requests, score publication or entitlement grants.

## Dependencies, ownership and reviewable PR boundaries

Heads below are observations, not acceptance. Workers must return new exact heads and independent review/CI before their modules are imported or merged.

| Boundary / owner | Inputs and prerequisite | Output / next consumer | Safe inactive merge versus later approval |
|---|---|---|---|
| INT-A / Sol, this PR | Merged native source admission + SHARED_1 | Owner-only current source DTO and Battle UI; all dependent work Pending | Technical review + authentic source/correction/privacy CI; no normative calibration needed |
| #142 / Worker 1 | Raw original starting TC identity/coordinates; strict unrounded <15 tiles | Correct Context V2 for #141; existing operation/own-queue proof remains separate | Precision review and actual V2 negative controls; never Castle privilege from proximity |
| #137 / Worker 3 | Canonical BattleFeature/Profile converter; active Game/POV and multi-Game Battle dedup | Accepted pure five-axis engine → INT-B | Inert parameterized engine can merge after technical review. Owner-reviewed definitions, denominators, context anchors, sufficiency and aggregation needed before official values |
| #141 → #126 producer / Worker 4 | Fix LIMITED admission; actual accepted V2; retained original observations with actor/clock/ordinal | Source-bound Observation/Incident/Inference/Claim and attribution wrappers → merged #139 | Pure proposed engine can merge after review. Authentic measurements and per-method admission must exist; detailed predicates/calibration/weakening require owner approval before credits |
| #136 / Worker 5 | Legacy IDs/bookmarks/new-ink compatibility; authenticated >100 Battle completeness/read bounds; canonical Scene and aggregate result | Accepted factual query/scene seam → INT-B and #140 | Factual inert seam needs technical proof, not score approval; shared book/domain hunks belong to Sol |
| #140 / Worker E | Accepted #136 seam, prior-only context | Deterministic storylet composer → Chronicle book wiring | Separate factual/literary/privacy acceptance; E alone edits composer, no runtime LLM |
| #128 / Worker 5 | Accepted factual scenes + actually eligible source-bound opportunities | Authenticated judgments + durable respondent×Battle slot → INT-C | Selector/meaning approval, correction/privacy and no repeated invitations; no fabricated opportunity to fill a quota |
| INT-B / Sol, separate PR | Independently accepted #137/#136; #142/#141/#126 as available | Bounded current history collector; canonical feature and claim validation; existing evaluators; private profile/book views | Pending per unavailable dependency. Full current ordered input digest, no upload-time chronology; no second history store/evaluator |
| INT-C / Sol, separate PR | Accepted measurements, approved versioned rules + #139; #128 and recognition inputs where applicable | Fenced replacement of private projections; final profile/relationship/Chronicle composition | Approval registry + exact accepted rules required for movement. Strict Treachery/independent stage-3+ reciprocity remain binding. Pre-Treachery weakening unresolved → Pending |
| #129/#130 / catalogue workers + Sol boundary | Approved source-feasible award/exceptional predicates | SHARED_1 RecognitionCandidate → existing achievement/recognition services | Candidate is not entitlement. One optional equipped epithet requires an existing verified entitlement; no privileges/extra stages from UI or proposed catalogue |
| Independent #132 | Exact combined INT head, all selected launch components and authentic positives/negatives | Separate full multiuser acceptance and release recommendation | Includes all six genuine positive/weakening paths, five calibrated sliders, rare contributions and corrections; not satisfied by INT-A |

Sol owns `functions/src/integration/*`, `getMySocialExperience.ts`, runtime validation/build packaging, shared exports, web repository/domain, `BattleDetails`, private/profile/book orchestration. Workers retain their specialist engine/query/composer/test directories. Do not cherry-pick whole worker branches into INT-A. Hand off typed DTO examples and owned patches instead of parallel edits to shared UI. Shared declaration/schema semantic changes go through #122/new version review.

## Source-to-UI acceptance

Existing ordinary-upload emulator CI now runs `intV1SourceAcceptance` for the four pinned authentic recordings at corpus `2d04ec6adbe871d156c108a4351448efeb08f4e6`: `1v1_t90-deak`, `2v2_arabia`, `4v4_arabia`, `FFA_7`. Existing native upload/verification/mapping/result resolver runs first. The test invokes the actual authenticated callable handler, validates SHARED_1, exercises actual Firestore/Storage immutable-generation reads and passes the real response into the real React view in an isolated JSDOM child. Payloads are stdin-only; output is a bounded boolean summary. This is a source-to-UI contract test, **not a live browser, paint or p95 result**.

| Example | Required behavior |
|---|---|
| Authentic admitted 1v1/4v4 with supported official result | Current hash/revision and official result visible to the participant; all unimplemented social outputs Pending |
| Authentic custom 2v2/FFA with unresolved result | Same verified source access; official outcome null/Pending; no official-result-dependent social credit |
| Retry or repeated POV read | Identical canonical source response; zero new effects, stages or historical samples |
| Game result revision or valid roster rebind | Authority/mapping digest changes; previous response is never appended as an independent Battle; no automatic social movement |
| Fake second Game claiming the same original GUID | Denied unless existing authoritative GUID/correction path actually authorizes that Game |
| Source withdrawn/superseded, pointer cleared, dispute or Event membership removed | Current view unavailable; retained evidence remains intact |
| Source revision, GUID, Event or authenticated link changes during artifact read | Final fence rejects mixed snapshot; no partial private success or write |
| Outsider, administrator nonparticipant, suspended/relinked user, spoofed owner/policy/source input | Denied; no private history/testimony/source payload leakage |
| Game/owner/revision switch, sign-out or late UI response | Previous private output removed; late data cannot appear under another identity |

Backend unit tests additionally cover canonical closed-schema failures, production gate denial, tampered stored bytes/original digest, no-write determinism and all five/six null outputs. Web tests cover on-demand fetch, labels, no fabricated slider/stage, pending official result, stale response/auth cleanup and failures. Existing ordinary-upload parity/security/result/retry/rewards/correction tests remain in the same workflow; no parser/worker modifications.

## Decisions and activation boundary

No new owner decision is needed to review/merge INT-A inactive. Next implementation can collect authenticated canonical features and facts while individual engines/rules are pending. Do not pick numbers to unblock wiring.

Official Personality needs one reviewed five-axis calibration pack based on real distributions: definitions/proxies, eligible contexts and denominators/anchors, weights/reducer, sufficiency and recent/career treatment. Official six-track movement needs versioned per-method evidence/coverage predicates, significance/budgets/thresholds, independently justified strengthening and weakening, and TERR/diplomacy admission where used. Unresolved pre-Treachery carry/quarantine remains Pending. Recognition/exceptional predicates and wording are separately approved with source witnesses; approved catalogue names alone grant nothing.

Later projection persistence must reuse the SHARED_1 `commitProjection(expectedScopeDigest, projection)` replacement boundary over the **entire current ordered input set**. Source/result/remap/withdrawal/judgment/policy changes invalidate dependent allocations, reciprocity, peaks, awards and narrative; retries cannot add effects. Until that implementation is reviewed, this read-only slice stores nothing and claims no completed private longitudinal history.

Mobile-period restrictions remain: no cloud inventory, backup/export, seeding, deployment, IAM/secrets/flags or staging uploads. #143 is NO-GO; initial owner upload pilot, statistically meaningful p95 campaign and full social #132 are distinct later express authorizations. No replay-engine observer dependency.
