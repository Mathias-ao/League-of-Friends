# Relationship Pulse V2 — review and live-test runbook

Branch: `feat/relationship-pulse-v2`  
Pull request: #60 — Relationship Pulse V2 and player Chronicle

This guide is the acceptance path for the V2 social-system foundation before merge.

## What this review is meant to decide

Review the system shape and player experience:

- Pair History is chronological and evidence-backed.
- Relationship tracks are **Rivalry / Hostility / Bond**.
- Player Reputation is separately **Gallantry / Cruelty / Chivalry**.
- level 3+ relationship progression requires reciprocity;
- calendar inactivity does not decay relationships;
- merely being assigned as allies is neutral;
- qualified allied cooperation may cool Hostility and strengthen Bond;
- qualified allied non-cooperation may worsen existing Hostility;
- antagonism against an established Bond may damage that Bond more strongly;
- Rivalry and Hostility can become Dormant without losing historical peaks;
- the player profile Chronicle feels like an evidence-backed historical parchment rather than an XP screen.

This review is **not** approval of production point values, thresholds, caps, Reputation scoring, or final War Room unlock values. Those remain unconfigured.

## 1. Automated gate

Before manual review, PR #60 should have these three GitHub checks green on the current head:

- Backend CI
- Player website
- Three-Battle Statistics Validation

The web suite now includes an interaction test that opens the Chronicle in Preview mode, switches player pairs, and verifies Dormant relationship presentation and Chronicle entries.

## 2. Fast visual review — Preview mode

Preview mode is the quickest way to judge the UI. It uses explicitly illustrative in-memory relationship histories and never writes real league data.

From the repository root:

```powershell
git checkout feat/relationship-pulse-v2
npm.cmd ci --prefix web
npm.cmd run dev --prefix web
```

Do not supply Firebase `VITE_FIREBASE_*` variables for this pass. The client will use `PreviewLeagueRepository` and show the **DESIGN PREVIEW** banner.

### Enter the preview league

1. Press **Sign in**.
2. Join with any Steam name.
3. Use Emperor's Favor `K7M4Q9`.
4. Enter Season I if the season gate is shown.
5. Open **Players**.
6. Open **D’Karius**.
7. Press **Chronicle** in the profile sub-navigation.

### Chronicle cases to inspect

Use the player selector inside the Chronicle.

**D’Karius & Ragnar**

- recurring opposition;
- Dormant Rivalry and Hostility presentation;
- historical reciprocal contest in the written entries;
- a later qualified no-contact encounter making the antagonistic history go quiet rather than deleting it.

**D’Karius & Lord Baguette**

- allies rather than opponents;
- qualified cooperation strengthening Bond / cooling Hostility context;
- an `ALLIED_NO_COOPERATION` example that worsens tension instead of automatically cooling Hostility merely because they were teammates.

**D’Karius & Steve**

- a lower-stage active contest;
- useful comparison against the more developed Ragnar history.

### Visual acceptance checklist

- Profile / Chronicle navigation feels native to the player profile.
- Chronicle reads as parchment/archive, not a statistics table.
- pair selector is understandable.
- dated entries are easy to scan.
- Battle provenance is visible without overwhelming the prose.
- Rivalry / Hostility / Bond can coexist without implying one combined morality score.
- Dormant reads as historical inactivity, not erased progress.
- no internal relationship points, progress bars, next-threshold numbers, or hidden rule values are exposed.
- Chronicle wording states recorded events and never invents motive, emotion, kills, damage or intent.

Preview histories are illustrative only. They exist so the complete presentation can be reviewed before production thresholds are approved.

## 3. Live-mode UI review against Firebase emulators

This path uses the real `FirebaseLeagueRepository`, Cloud Functions callables, Firestore queries and `PLAYER_PROFILE_V2` response shape.

It deliberately seeds one **emulator-only review fixture** for the Chronicle. That fixture validates the live data/query/UI path; it does not claim that synthetic entries came from replay analysis.

### Install and build

```powershell
npm.cmd ci --prefix functions
npm.cmd ci --prefix web
npm.cmd run build --prefix functions
npm.cmd run build --prefix web
```

### Start Firebase emulators

Terminal A:

```powershell
.\scripts\start-emulators.ps1
```

The configured ports are Auth 9099, Functions 5001, Firestore 8085, Storage 9199 and Emulator UI 4000.

### Bootstrap the local Emperor and Season

Terminal B:

```powershell
$project = 'demo-league-of-friends'
node scripts/bootstrap-emulator-admin.mjs --project $project --steam "D’Karius"
node scripts/create-emulator-season.mjs --project $project --name "Relationship Pulse Review"
```

### Seed the Chronicle review fixture

The fixture refuses to run unless Firestore points at localhost.

```powershell
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085'
$env:GCLOUD_PROJECT = $project
node functions/scripts/seed-relationship-review.mjs --project $project
```

Expected output includes:

```text
Relationship Chronicle review fixture is ready.
Review player: relationship-review-rival (Review Rival)
This fixture validates the live Firebase/profile/UI path only...
```

### Run the website in live/emulator mode

Terminal C:

```powershell
$env:VITE_FIREBASE_API_KEY = 'fake-api-key'
$env:VITE_FIREBASE_AUTH_DOMAIN = 'demo-league-of-friends.firebaseapp.com'
$env:VITE_FIREBASE_PROJECT_ID = $project
$env:VITE_FIREBASE_APP_ID = 'relationship-pulse-review'
$env:VITE_USE_EMULATORS = 'true'
npm.cmd run dev --prefix web
```

Then:

1. Sign in. Emulator mode uses the local Emperor credentials automatically.
2. Enter the active Season if required by the league gate.
3. Open the Emperor's player profile.
4. Open **Chronicle**.
5. Select/open **Review Rival**.
6. Confirm the Chronicle loads through the real `getPlayerProfile` callable.
7. Confirm Rivalry, Hostility and Bond labels plus dated entries render with no client error.

The Firestore Emulator UI at `http://127.0.0.1:4000` may be used to inspect the seeded `relationships/{pairId}` document.

## 4. Real Pair History V2 processing smoke test

The emulator-only fixture above tests the live read/UI path. To test the actual Pair History rebuild boundary, use a **real completed emulator Match with a canonical result** and run:

```powershell
node scripts/smoke-test-rivalries.mjs --project $project --match <completed-match-id>
```

The V2 smoke test verifies:

- `AOF_PAIR_HISTORY_V2`;
- `AOF_RELATIONSHIP_ENGINE_V2`;
- at least one Pair History;
- at least one factual Chronicle entry;
- interaction coverage remains `UNAVAILABLE` until durable Battle Statistics social signals are wired;
- production relationship rules remain unconfigured;
- the `RIVALRIES` processing step completes;
- the War Room remains closed while those rules are unconfigured.

This is the correct result today. Do **not** treat missing social signals as no-contact or failed cooperation merely to make the test produce relationship progression.

## 5. Optional real replay acceptance path

For a full replay-backed local Battle, follow [`warmup-replay-acceptance.md`](warmup-replay-acceptance.md). That path exercises the real recording upload and statistics pipeline.

Current limitation: the Functions relationship-processing adapter still marks social interaction coverage `UNAVAILABLE`, because durable Battle Statistics social signals have not yet been connected to `processRivalries`. The replay may therefore create factual encounter Chronicle history, but it must not manufacture Raid/Cooperation/Dormancy pulses from missing evidence.

## 6. What to report during review

Record feedback against these categories:

- **Chronicle feel:** parchment, hierarchy, prose density, dates, pair selector.
- **Relationship semantics:** Rivalry / Hostility / Bond names and stage language.
- **Dormancy:** whether a dormant rivalry/hostility feels preserved rather than reset.
- **Alliance behaviour:** whether cooperation vs non-cooperation feels logically different.
- **Bond breach:** whether later antagonism against an established Bond should be surfaced more strongly in the Chronicle.
- **Visibility:** what should be public, pair-private, or War-Room-only.
- **Stage labels:** wording only; numeric thresholds remain a later calibration task.

## 7. Merge gate

Do not merge merely because the automated suite is green. Merge after Mathias has completed both:

1. the Preview Chronicle review; and
2. the live/emulator profile query test.

Any numeric Relationship/Reputation configuration should be handled as a separate explicit approval unless the review produces a new locked decision.
