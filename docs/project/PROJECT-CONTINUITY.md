# Age of Friends — Project Continuity

Last updated: **11 October 2026**. This file is the entrypoint for continuing the project; it is not a substitute for the current code or specialist contracts.

## Read order and authority

1. Read [CORE-IDENTITY.md](CORE-IDENTITY.md) for agreed product rules and design invariants.
2. Read [CURRENT-STATE.md](CURRENT-STATE.md) for the merged-vs-local implementation boundary, E2E evidence and next work.
3. Read [CURRENT-STATS.md](CURRENT-STATS.md) for active measurement models and evidence limitations.
4. Inspect current GitHub `main` code and the specialist docs linked from these pages before changing behavior.

The latest explicit product decision governs direction; Core Identity governs durable principles; **GitHub `main` governs merged implementation**. Specialist contracts govern their own technical details. Draft branches, local emulator experiments and past chats do **not** establish deployed behavior.

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

**Next bounded task:** build a carefully reviewed **recording-bound result-correction and native source-rebind protocol** that preserves canonical result/claim authority, disputed results, previous sources and inverse ledger reconciliation. The limited manually reviewed publisher and rollback are in #102; they do not cover source-bound corrections or auto-ready uploads. Then require real Firebase emulator transaction/trigger testing, cloud/browser capacity and true upload-to-READY measurements before any operator activation. Player Reputation/Relationships rules, Event finalisation and real-user flow remain distinct future workstreams.

## Bootstrap prompt

> Continue Age of Friends from `Mathias-ao/League-of-Friends`. Read `docs/project/CORE-IDENTITY.md`, `docs/project/CURRENT-STATE.md` and `docs/project/CURRENT-STATS.md`. Inspect current `main`, distinguish local emulator results from merged/deployed code, and follow specialist documentation. The bounded task is: [ONE TASK].

**Native upload integration experiment:** [validation acceptance](../testing/native-recording-integration-v1.md) records the feature-flagged upload-handler integration, immutable original/events/statistics storage and build-185872 emulator evidence. It publishes only VALIDATED_NOT_READY candidates. Read-only detail/social integration (#98–#101) and a disabled, manually reviewed limited publication/rollback implementation (#102) are available. Source-bound result corrections, fully automated READY and real full-stack acceptance still block normal native READY. Nothing is deployed or enabled for ordinary users.
