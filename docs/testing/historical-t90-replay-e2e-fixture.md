# Historical T90 replay E2E fixture — AOF_REPLAY_E2E_FIXTURE_V1

**State: roster only; no original recordings supplied for these eight games.** This is a **test definition**, not passing E2E evidence. Its authority for recorded names is the user's eight-row roster. The repository's existing `replay-fixtures/` corpus is **not** this set: for example, its committed `4v4.aoe2record` has a different roster. Do not substitute it.

Manifest: [`functions/tests/fixtures/replay-e2e-t90-manifest.json`](../../functions/tests/fixtures/replay-e2e-t90-manifest.json).
Regression suite: [`functions/tests/replay-e2e-t90-fixture.test.mjs`](../../functions/tests/replay-e2e-t90-fixture.test.mjs).

## 1. Intended coverage

- 4 independent 1v1 recordings: T90Official vs Dobbs351 / deaKer / SalzZ_wide / Hackali.
- 3 independent 2v2 recordings with the identical roster T90Official, [ASYNC]GodsPrisoner, PUB | Fanjita, DanMT.
- 1 4v4 recording: VENÓN | BOTZANGA, noru, FutureEwe5582, [C82]sasuke, kerwin, T90Official, Fer_amicus, NO MAMES.
- Exactly 8 source files and 15 distinct source names, with T90Official appearing in all eight; 28 total source-player appearances.
- The test files are historical observations; they are not newly played AoF Event Games. Never pass them off as validating live play times, unannounced maps, real Steam identities or competition fairness.

## 2. Two isolated scenarios

### A. Eight-account Event workflow rehearsal (synthetic mapping)

Create one disposable test Season/Event and eight independently authenticated **staging** accounts, `TEST-01` through `TEST-08`. Enter Season and Event with all eight, schedule the four 1v1 warmups, complete main check-in, generate **RANDOM** BIG_TEAM teams with four starters on each side, review and approve, perform the eight draft picks, upload the four warmup files and the 4v4 file, review results, retry any incomplete processing, reconcile points, then inspect Roundoff and finalise.

**Preferred full-lifecycle variant:**

1. Create/publish the Event and finish **all eight signups before the warmup opening**. Running the five-minute scheduler with zero or an incomplete signup roster can prematurely snapshot the wrong group.
2. Allow `advanceEventWarmups` to create four Matches using its actual random pairing. The example warmup pairings in the manifest are *illustrative* only; **do not expect** the random scheduler to output them.
3. Match the four actual warmup Match IDs to the four 1v1 source files. Assign each source file's two recorded names one-to-one to the **approved starters of that Match**. Reserve the warmup containing `TEST-01` for the first recording, mapping `T90Official -> TEST-01`; the other three may bind `T90Official` to different test accounts. This is intentionally fake historical attribution and is permitted only within this isolated test.
4. Bind the exact two source names to that Game through audited `adminBindReplayParticipants`, **before** its initial replay upload. Do not edit the player's Steam verification fields or use the user-controlled display alias as identity evidence.
5. At main check-in, have all eight accounts check in; generate and approve a 4v4 pairing. After extracting the actual 4v4 team IDs, bind all eight source names to the eight **approved** Test Player IDs, preserving the replay's two 4-person teams. Keep `T90Official -> TEST-01`. This is possible only if every other source player can be assigned to an account on the appropriate approved side. Reproduce the observed civilization choices in the draft when the announced draft rules allow them.
6. Confirm each upload belongs to the approved roster, with valid map/rules and the *reviewed* result. A historical replay whose recorded settings contradict the announced Event must be treated as a mismatch, not approved simply for an E2E green check.
7. After accepted current revisions finish processing, expect **72 baseline League points over the eight accounts**, conditional on all five Games qualifying: `4*(2 participants*1 + 1 winner*2)=16` warmup and `8*4 + 4*6=56` main. This excludes configured Emperor/other bonuses.
8. Finalisation must observe five resolved and evidence-backed Games, zero pending current jobs, no disputes, consistent warmup scoring slots and the genuine completed status.

**Fallback rapid rehearsal:** `adminCreateEventWarmups` can create manually specified pairs before main kickoff. That is a separate manual-pairing test, **not proof the scheduled draw works**. Its four example pairs are in the manifest. Keep the automatic scheduler tests separate. Neither path allows production bypasses.

**Important:** the production Event model designates one warmup per league participant. The fake attribution of T90Official to multiple accounts is not acceptable in a real Season. Do not copy the synthetic bindings or source results to a persistent league dataset.

### B. Repeated-identity/alias/statistics regression (faithful attribution)

Use a separate disposable dataset of 15 seeded player identities, `SRC-T90` plus one identity for each other recorded source name. In this suite:

- Every occurrence of `T90Official` maps to the *same* `SRC-T90` Player ID.
- The three 2v2 Games map to the same four Player IDs.
- Each distinct Game must have a distinct Game GUID unless recordings truly represent different perspectives of the same Game. A replay GUID already claimed by a different Battle must not produce a duplicate scored result.
- The 2v2s should start as **three separate Battles**. Only create a BO3 series if their verified results and chronology permit it: if the same team won Games 1 and 2, Game 3 cannot simply be counted as an undecided third Game.
- With all eight *distinct* Games eligible, the statistics dataset for `SRC-T90` must have eight Game appearances. Do not count a source before its eligibility and active binding are verified.
- This suite does not sign up 15 people to the eight-player Event and must not contribute to the Event's points ledger.

### Alias/identity oracle

`leagueAlias` is a display name, **not replay identity proof**. Automatic matching uses Steam-verified `steamPersonaName` and `steamNameHistory` for the authenticated SteamID64. The Emperor's `adminBindReplayParticipants` explicitly binds observed source names to already approved Game starters and records an audit. For synthetic fixtures, use this explicit binding route. Do not manufacture Steam-verified history in deployed accounts. Mocked current/historical Steam name evidence belongs in unit tests.

Test normalizing whitespace in `NO MAMES`, the accent in `VENÓN | BOTZANGA`, brackets in `[ASYNC]GodsPrisoner` and `[C82]sasuke`, and the pipe in `PUB | Fanjita`. Prove collision/duplicate, wrong-Game-roster, unauthorized binding, duplicate replay claim and post-acceptance rebinding safeguards.

## 3. Populate real facts after receiving the eight files

Use suggested filenames `duel-dobbs.aoe2record`, `duel-deaker.aoe2record`, `duel-salzz.aoe2record`, `duel-hackali.aoe2record`, `team-2v2-1.aoe2record` through `team-2v2-3.aoe2record`, and `main-4v4.aoe2record`. These filenames are **suggestions**, not proof of the original file names.

For each file, extract with the existing `replay-tools` pipeline and fill the manifest's **null** fields using the actual output: SHA-256, GUID, numeric team by replay slot, map name/ID, civilization by replay slot, save/build tuple, and winners as supported by qualified terminal evidence. Keep names in recorded slot order and verify them against this roster; do not silently reinterpret mismatches. Save actual fixture fingerprints but retain source binaries according to the project's authorized fixture-retention policy.

Before expecting automatic qualification, check the conservative `AOF_RECORDING_OUTCOME_V1` rules (supported build, map, locked sides, victory, complete terminal/re-sign evidence, no unqualified settings). Drafted main Games and unsupported conditions require a **source-bound Emperor review**, not forced automatic winners. The review must verify the *actual* historical Game's settings and time; a source uploaded within the test window is not proof the Game was played then.

## 4. Status gates and commands

From the repository root:

```bash
npm ci --prefix functions
npm run build --prefix functions
npm test --prefix functions
# Or only this fixture contract + binding regression after compiling:
node --test functions/tests/replay-e2e-t90-fixture.test.mjs
```

Passing these tests means only **manifest integrity and audited per-Game binding behavior** passed. It does not establish file integrity, replay ingestion, winners, civilization legality, deployed Steam/Firebase configuration, live progression or Event finalisation. Those remain manual/integration gates until the original eight files and staging environment are available.

**Recorded evidence for acceptance:** source hash/GUID, validated mapping, approved roster/team/civilization snapshot, game/result revisions, replay status, processing job terminal state, Game/Event/Season statistics inclusion, scoped points ledger, and Event conclusion state. Negative checks: cross-Battle reuse, duplicate awards after retry, non-admin binding, stale source review, invalid replay roster and wrong settings.
