# Age of Friends — Project Continuity

Last updated: **10 October 2026**. This file is the entrypoint for continuing the project; it is not a substitute for the current code or specialist contracts.

## Read order and authority

1. Read [CORE-IDENTITY.md](CORE-IDENTITY.md) for agreed product rules and design invariants.
2. Read [CURRENT-STATE.md](CURRENT-STATE.md) for the merged-vs-local implementation boundary, E2E evidence and next work.
3. Read [CURRENT-STATS.md](CURRENT-STATS.md) for active measurement models and evidence limitations.
4. Inspect current GitHub `main` code and the specialist docs linked from these pages before changing behavior.

The latest explicit product decision governs direction; Core Identity governs durable principles; **GitHub `main` governs merged implementation**. Specialist contracts govern their own technical details. Draft branches, local emulator experiments and past chats do **not** establish deployed behavior.

## Season Event guidance

The authoritative [8 October Season Event contract](CORE-IDENTITY.md#season-event-contract) supersedes older proposals:

- One human 1v1 warm-up per signed-up player; odd-roster players may invite any active AoF member, even an already-paired helper. **There is no new AI fallback.** Existing historical AI controls remain only for old records.
- The best eligible warm-up counts once per player for Event points; all eligible warm-ups may contribute to statistics under their own rules.
- The main draw follows resolved check-in/attendance, with an audited Emperor-only force action for unresolved absence; standings govern unequal team sizes and approved teams govern drafting.
- Eligible statistics, points and other outputs update when qualified; **Event finalisation is administrative, not a publication gate**. Closure is blocked before the scheduled main start and while checklist items remain open.

Read [the replay-driven Event flow](../architecture/replay-driven-event-flow-v1.md) for backend and acceptance details; inspect code for what is actually on `main`.

## Core E2E status — closed 10 October 2026

The user **closed the isolated eight-account synthetic E2E as a successful core workflow rehearsal**, after registration, pairing, replay upload, 4v4 statistics, points, leaderboard, profiles, admin result review and unplayed warm-up cancellation. The historical Games were not genuinely played for this scheduled Event; Event finalisation before the main start was correctly prohibited and **successful closure remains untested**. Exact ledger correctness and Reputation/Relationship progression were not independently audited. [Full closeout and remaining coverage](../testing/e2e-core-closeout-2026-10-10.md).

Durable learnings in `main`: the Firestore-safe `warmupSchedule.pairs` fix ([#85](https://github.com/Mathias-ao/League-of-Friends/pull/85)); losslessly compressed replay statistics with stored/original hash verification, legacy uncompressed compatibility, and a common statistics/backfill reader. The emulator-only sign-in override and historical 4v4 simulation are **not** promoted to `main`. Draft fixture [#81](https://github.com/Mathias-ao/League-of-Friends/pull/81) and demo-only storage [#82](https://github.com/Mathias-ao/League-of-Friends/pull/82) were closed **without merge**, superseded by [#85](https://github.com/Mathias-ao/League-of-Friends/pull/85) and [#86](https://github.com/Mathias-ao/League-of-Friends/pull/86). Performance benchmark [#83](https://github.com/Mathias-ao/League-of-Friends/pull/83) remains a separate draft.

No production/staging deployment or data import occurred. Never conflate merging source code with migrating simulated Auth, Firestore, points or relationship states. Keep `age-of-friends-staging` and production `league-of-friends-cc274` unchanged without separate approval.

## Working procedure

Pick one bounded outcome, check current code and scope, identify evidence and regression tests, then record observed outcomes **and their limitations**. Keep source facts separate from inferred statistics, qualification and official scoring. Prefer reversible local tests, documented data backups and focused PRs; obtain separate review before promoting local work to staging or production.

**Next bounded task:** evidence-qualified Player Reputation and pair Relationships: review neutral incident provenance, coverage and opportunity gates, select explicit versions for Gallantry/Cruelty/Chivalry and Rivalry/Hostility/Bond, build correction-safe scoring with real-corpus regression, and keep unqualified effects inactive. Event finalisation and real-user/deployed flow remain a separate acceptance backlog.

## Bootstrap prompt

> Continue Age of Friends from `Mathias-ao/League-of-Friends`. Read `docs/project/CORE-IDENTITY.md`, `docs/project/CURRENT-STATE.md` and `docs/project/CURRENT-STATS.md`. Inspect current `main`, distinguish local emulator results from merged/deployed code, and follow specialist documentation. The bounded task is: [ONE TASK].
