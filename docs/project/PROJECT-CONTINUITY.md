# Age of Friends — Project Continuity

Last updated: **15 October 2026**. This file is the entrypoint for continuing the project; it is not a substitute for the current code or specialist contracts.

## Social Evidence V1a — 16 October 2026

Main was verified at `4798d358d5f40715198f03a874c153d2c06a72e3`: PR #119's ordinary Recorded Events V1 upload integration is **merged**, not merely branch work. Deployment/activation is not inferred.

The new `feat/social-evidence-v1a` implementation adds an on-demand, authenticated read-only adapter over retained verified statistics and the merged Python bridge/ledger/family prototypes. See [the versioned V1a contract and acceptance boundaries](../architecture/social-evidence-v1a.md). It preserves real pending results, source-local identities, independent factual history and separate pending deed/track qualifications. Source, mapping, Event and access changes are fenced transactionally. No new upload artifact or history store is introduced.

This is feature-branch implementation awaiting independent review, not merged/deployed/activated social functionality. All substantive qualifications remain pending; approved design is not executable proof. PR #114 remains merged inactive groundwork, and the newer approved Relationship baseline still governs. No Reputation, Relationship stages, reciprocity, Gold, War Room or Chronicle highlights are enabled. The stopped staging E2E remains stopped.

Next bounded task: review the V1a PR's exact source/authority and privacy boundaries and CI. Do not begin progression or broaden into a deployment milestone.

## Ordinary native upload implementation — 16 October 2026 (supersedes older status)

The ordinary native recording lifecycle is implemented on the feature branch described in [ordinary native upload acceptance](../testing/native-player-upload-v1.md). That document records the exact code commit, PR and validation evidence. **Implementation, merge, deployment and activation are distinct.** Nothing from this work deploys Firebase, changes live flags, or resumes the stopped staging E2E.

- Recorded Events V1 already reproduces the complete legacy statistical projection, including matchFacts and pair-social evidence, for the tested authentic corpus: [equivalence evidence](../testing/benchmarks/native-recording-integration-v1/equivalence.json). No new parser, statistics formula, detector or competing winner evaluator is needed.
- The ordinary website sends AUTO. Server-owned, default-off native rollout gates select the existing fast worker; explicit LEGACY and omitted-mode clients retain compatibility. Verified native evidence can become READY before its result is known. The existing deriveRecordingOutcome/resolveRecordingResult path accepts supported outcomes; unsupported outcomes remain source-bound pending review.
- Publication preserves the original and pinned artifact generations, exact mapping, GUID ownership, transactional authority/revision fences and result corrections. Native pending evidence is provisional; it cannot contribute to accepted-result aggregates. The existing bounded readers and read-only history are reused.
- PR #114 was merged at f5924f2bad249beb9e940f3f38417c0382d2f0ea. Its bridge, directional ledger, three military families and Chronicle modules remain **inactive prototypes**, not authenticated progression.
- The approved [Relationship V1 baseline](../architecture/relationship-v1-approved-baseline-2026-10-13.md), copied unchanged from PR #113 at 3d71a5bbe710ffde97a1d96549a1f6ad7287dc3c, supersedes “SOC-058 pending.” SOC-058–088, REL-V1-EVID-01–06 and REL-V1-CAL-01–17 are approved design; SOC-089 is deferred. The [001–057 register](../architecture/social-relationship-decisions-001-057.md) remains an earlier historical record. No numeric calibration or social scoring is introduced here.

**Next bounded task:** review the ordinary-upload PR and its exact-head CI/acceptance evidence. Follow the acceptance document for remaining limits. Any staging release needs a separately scoped decision; never resume the closed 15 October manual test implicitly.

## Read order and authority

1. Read [CORE-IDENTITY.md](CORE-IDENTITY.md) for agreed product rules and design invariants.
2. Read [CURRENT-STATE.md](CURRENT-STATE.md) for the merged-vs-local implementation boundary, E2E evidence and next work.
3. Read [CURRENT-STATS.md](CURRENT-STATS.md) for active measurement models and evidence limitations.
4. Inspect current GitHub `main` code and the specialist docs linked from these pages before changing behavior.

The latest explicit product decision governs direction; Core Identity governs durable principles; **GitHub `main` governs merged implementation**. Specialist contracts govern their own technical details. Draft branches, local emulator experiments and past chats do **not** establish deployed behavior.

## Latest project checkpoint — 15 October 2026 (current over historical passages)

**Product decision: stop the 15 October manual staging E2E as incomplete.** The recording upload stalled after a legacy private Cloud Run worker returned two **504 / 240s** timeouts; further Cloud debugging and upload tests were explicitly called off. Preserve the successes and limits in the [staging E2E closeout](../testing/staging-manual-e2e-closeout-2026-10-15.md).

`main` now includes [#111](https://github.com/Mathias-ao/League-of-Friends/pull/111), [#112](https://github.com/Mathias-ao/League-of-Friends/pull/112), [#116](https://github.com/Mathias-ao/League-of-Friends/pull/116), [#115](https://github.com/Mathias-ao/League-of-Friends/pull/115) and [#117](https://github.com/Mathias-ao/League-of-Friends/pull/117). Source checkpoint after the final fix: `7bf69f1d897ccb53c8859b98172171f45ef6851a`. **All nine exact-head CI checks for #117 passed**. Recorded Events V1 native worker, private dual-credential transport, validation-only preflight, source-retaining candidate and Docker processor-revision packaging are available as code; the normal browser Upload recording remains **legacy**. The real staging upload, synchronized latest-code deploy, official-result/READY publication and social/Chronicle end-to-end behavior are **not accepted**.

A limited contingency Cloud Run worker and `uploadReplay` deployment occurred on staging from a preceding branch, **not** from the newly consolidated `main`. Do not infer the current staging site, rules, Functions or authenticated UI are aligned with this GitHub SHA. This consolidation did **not** deploy Firebase or modify staging/production. No more manual E2E or Cloud Run troubleshooting is authorized by this document. Do not turn on native validation/READY/read/social/rollback flags or delete any existing original recordings.

The social design register/baseline in [#113](https://github.com/Mathias-ao/League-of-Friends/pull/113) is approved design on a draft documentation PR. The three-family read-only prototype [#114](https://github.com/Mathias-ao/League-of-Friends/pull/114) is merged but inactive. Their pending source qualification and approval gates are not bypassed by the earlier successful replay statistics CI.

**Next bounded work:** continue reviewed feature/product development from `main`, respecting existing measurement/evidence boundaries. A live staging recording E2E must be proposed and authorized anew rather than silently resumed.

## Latest project checkpoint — 11 October 2026 (current over historical passages)

`main` contains PRs #105, #107, #108, #109, #110 through commit `c993c7ad5410ba99caa032610ae4818826c6cc6d`, including reviewed native READY/rebind, synthetic real Functions-trigger correction acceptance and genuine build-185872 four-format local emulator acceptance. **These are merged tests and code, not Firebase deployments or user-facing native READY activation.** Native validation still ends `VALIDATED_NOT_READY`; only a separately gated explicit admin review can publish READY. The website's normal Upload recording remains legacy; full native admin browser controls, real staging/cloud browser acceptance and real <20s upload-to-READY are open.

The earlier instructions below calling recording-bound correction “the next task” are historical and **superseded** by #107/#108. Next priority is the [manual E2E readiness and GO/NO-GO package](../testing/manual-e2e-readiness-2026-10-11.md): isolate/demo accounts and backup, independent accepted result, native operator bridge/UI, real browser and ledger/Chronicle evidence, no automatic activation. PRs #61/#62 Story Engine drafts remain separate and not merge-ready. Staging deployment and any operator/native read flag activation each require a new explicit user decision.

## Recorded Events / native validation now merged — not deployed

On 10 October 2026, the integrated sequence of PRs #88, #83, #89, #93,
#94, #95 and #96 was merged to `main`. The
[Recorded Events contract](../architecture/recorded-events-v1-contract.md),
direct producer-shared evidence, native worker and tightly gated Firebase
candidate validation are now code available on `main`, **not activated or
deployed for ordinary users**. The native route is explicitly admin-only,
project/Game-allowlisted and remains `VALIDATED_NOT_READY`, never READY.
The original replay must be retained because Recorded Events cannot recreate
all original binary observations. Normal uploads, read models, official Games
and scoring still use the legacy processing path.
[Native integration acceptance](../testing/native-recording-integration-v1.md)
measured 14.3s 1v1, 21.7s 2v2, 26.6s 4v4 and 18.2s FFA
received-to-validation with a local authenticated worker and Firebase emulators;
these are **not** cloud/READY times. Full semantic equivalence passed in the
selected cases; four historical opt-in golden tests remain skipped and must not
be silently rewritten. Native detail/social consumers, official-result/correction
bindings and atomic READY publication remain separate release gates. No staging
or production deployment, historical source cleanup or original replay deletion
occurred. Post-hoc alternatives #91/#92 were closed without merge; benchmark
fixtures referenced by pinned commit must be retained.

**Subsequent read-side integration, not activation (10 October):**
[#98](https://github.com/Mathias-ao/League-of-Friends/pull/98)
(native social provenance),
[#99](https://github.com/Mathias-ao/League-of-Friends/pull/99)
(bounded native Battle detail),
[#100](https://github.com/Mathias-ao/League-of-Friends/pull/100)
(active Game/player statistics consumers) and
[#101](https://github.com/Mathias-ao/League-of-Friends/pull/101)
(native Chronicle and Battle-record consumers) are merged. Both
`AOF_ACTIVE_NATIVE_PLAYER_READS` and `AOF_ACTIVE_NATIVE_SOCIAL_READS`
remain disabled by default, and no **automatic native READY publisher**
exists. The record view pages neutral/shadow incidents, returns complete source sections
through SHA-verified 32-KiB fragments, and uses an official-outcome/mapping
review revision in addition to artifact SHA. Current official Game revisions,
disputes, immutable source generations and League identity are rechecked;
`VALIDATED_NOT_READY` remains invisible to ordinary readers. Real browser,
cloud capacity and correction/rollback **release acceptance is still missing**.
See [native read-side acceptance](../testing/native-social-battle-record-readers-v1.md).

**Experimental controlled publication/rollback (#102, 11 October):**
The new [atomic native READY publication acceptance contract](../testing/native-ready-atomic-publication-v1.md)
documents an explicit, staged/demo-only, administrator-reviewed transaction for
already COMPLETED Games with independently accepted (not recording-bound)
official results. It rechecks pinned source/events/statistics and roster,
publishes a new READY source and Game pointer atomically with an immutable
audit/rollback journal, and supports independently gated emergency rollback
without discarding the original or the native artifact. It prevents
recording-bound source replacement, already claimed Game GUIDs, stale
corrections and reused candidates. **This is not a general upload-to-READY
workflow**; normal native uploads still end at VALIDATED_NOT_READY, and flags
are not enabled or deployed. The next release gate is a reviewed correction/
result-binding change for accepted recording-bound results, plus true emulator,
cloud and browser-to-READY timing and ledger-reconciliation acceptance.

## Season Event guidance

The authoritative [8 October Season Event contract](CORE-IDENTITY.md#season-event-contract) supersedes older proposals:

- One human 1v1 warm-up per signed-up player; odd-roster players may invite any active AoF member, even an already-paired helper. **There is no new AI fallback.** Existing historical AI controls remain only for old records.
- The best eligible warm-up counts once per player for Event points; all eligible warm-ups may contribute to statistics under their own rules.
- The main draw follows resolved check-in/attendance, with an audited Emperor-only force action for unresolved absence; standings govern unequal team sizes and approved teams govern drafting.
- Eligible statistics, points and other outputs update when qualified; **Event finalisation is administrative, not a publication gate**. Closure is blocked before the scheduled main start and while checklist items remain open.

Read [the replay-driven Event flow](../architecture/replay-driven-event-flow-v1.md) for backend and acceptance details; inspect code for what is actually on `main`.

## Core E2E status — closed 10 October 2026

The user **closed the isolated eight-account synthetic E2E as a successful core workflow rehearsal**, after registration, pairing, replay upload, 4v4 statistics, points, leaderboard, profiles, admin result review and unplayed warm-up cancellation. The historical Games were not genuinely played for this scheduled Event; Event finalisation before the main start was correctly prohibited and **successful closure remains untested**. Exact ledger correctness and Reputation/Relationship progression were not independently audited. [Full closeout and remaining coverage](../testing/e2e-core-closeout-2026-10-10.md).

Durable learnings in `main`: the Firestore-safe `warmupSchedule.pairs` fix ([#85](https://github.com/Mathias-ao/League-of-Friends/pull/85)); losslessly compressed replay statistics with stored/original hash verification, legacy uncompressed compatibility, and a common statistics/backfill reader. The emulator-only sign-in override and historical 4v4 simulation are **not** promoted to `main`. Draft fixture [#81](https://github.com/Mathias-ao/League-of-Friends/pull/81) and demo-only storage [#82](https://github.com/Mathias-ao/League-of-Friends/pull/82) were closed **without merge**, superseded by [#85](https://github.com/Mathias-ao/League-of-Friends/pull/85) and [#86](https://github.com/Mathias-ao/League-of-Friends/pull/86). Performance benchmark [#83](https://github.com/Mathias-ao/League-of-Friends/pull/83) and the native Recorded Events stack through [#96](https://github.com/Mathias-ao/League-of-Friends/pull/96) are now merged, but not deployed or activated.

No production/staging deployment or data import occurred. Never conflate merging source code with migrating simulated Auth, Firestore, points or relationship states. Keep `age-of-friends-staging` and production `league-of-friends-cc274` unchanged without separate approval.

## Working procedure

Pick one bounded outcome, check current code and scope, identify evidence and regression tests, then record observed outcomes **and their limitations**. Keep source facts separate from inferred statistics, qualification and official scoring. Prefer reversible local tests, documented data backups and focused PRs; obtain separate review before promoting local work to staging or production.

**Next bounded task:** close the manual player-facing E2E **readiness gates**, not additional blanket backend features. The merge/CI boundary is green; the browser native-operator route and staging-specific deployment approval are still missing. Follow [the readiness package](../testing/manual-e2e-readiness-2026-10-11.md).\n\n## Bootstrap prompt

> Continue Age of Friends from `Mathias-ao/League-of-Friends`. Read `docs/project/CORE-IDENTITY.md`, `docs/project/CURRENT-STATE.md` and `docs/project/CURRENT-STATS.md`. Inspect current `main`, distinguish local emulator results from merged/deployed code, and follow specialist documentation. The bounded task is: [ONE TASK].

**Native release boundary:** A normal `uploadReplay` browser call still uses legacy processing. The gated native experiment needs separate validation, independently accepted official result, manual audited READY and source-specific reader flags. Nothing is deployed or enabled by a merge. Never silently use production/staging as a demo.\n