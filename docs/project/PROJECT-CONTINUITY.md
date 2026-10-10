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

## Local eight-account E2E checkpoint

**9–10 October 2026:** The user reported successful isolated `demo-aof-e2e` rehearsal through Season/Event signup, manual warm-up generation, main 4v4 drawing, historical replay identity binding, statistics, result points, leaderboard and player profile updates; Glade/Arabia mismatch was handled through admin review; three unplayed warm-ups were cancelled. The only Event closure blocker reported was **the main start time had not arrived**. Therefore **core E2E passed; finalisation is not yet tested**. Historical recordings plus synthetic accounts are not proof of authentic Event timing or identity.

Local-only fixes were needed for Firestore's prohibition on nested warm-up `pairs` arrays and for large Storage-emulator artifacts (resumable 8 MiB truncation, uncompressed JSON HTTP 413). GitHub `main` does not yet include those fixes. Do not deploy the temporary emulator sign-in shortcut, silently disable SHA-256, or conflate local tests with staging/production acceptance. Keep `age-of-friends-staging` and production `league-of-friends-cc274` unchanged.

Open work stays segregated: [PR #81](https://github.com/Mathias-ao/League-of-Friends/pull/81) historical fixtures, [PR #82](https://github.com/Mathias-ao/League-of-Friends/pull/82) **demo-only storage**, [PR #83](https://github.com/Mathias-ao/League-of-Friends/pull/83) benchmark foundation. Neither open/draft status nor user-observed tests authorize merging a code change.

## Working procedure

Pick one bounded outcome, check current code and scope, identify evidence and regression tests, then record observed outcomes **and their limitations**. Keep source facts separate from inferred statistics, qualification and official scoring. Prefer reversible local tests, documented data backups and focused PRs; obtain separate review before promoting local work to staging or production.

**Next bounded task:** after kickoff, finalise the local Event and verify ledger/idempotency; then convert the warm-up and large-artifact fixes into production-safe, separately tested PRs. Only after the full workflow is sound should recording-size/runtime optimization become the primary workstream.

## Bootstrap prompt

> Continue Age of Friends from `Mathias-ao/League-of-Friends`. Read `docs/project/CORE-IDENTITY.md`, `docs/project/CURRENT-STATE.md` and `docs/project/CURRENT-STATS.md`. Inspect current `main`, distinguish local emulator results from merged/deployed code, and follow specialist documentation. The bounded task is: [ONE TASK].
