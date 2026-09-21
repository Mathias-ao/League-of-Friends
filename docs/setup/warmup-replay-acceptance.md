# Warmup replay acceptance test

This local acceptance path exercises the real player-facing flow for one 1v1 warmup Game.

## Test identities

- League Emperor -> replay identity `T90Official`
- existing league player `Player 8` -> replay identity `Mr Greed`
- replay: `replay-fixtures/1v1_1.aoe2record`
- civilizations: unrestricted; no Age of Friends civilization draft
- result qualification remains separate and unresolved by replay ingestion

The setup is emulator-only. It reuses existing player documents and refuses to create a duplicate Player 8.

## 1. Build dependencies

From the repository root:

```powershell
npm.cmd ci --prefix functions
npm.cmd ci --prefix web

python -m venv .venv-replay
.venv-replay\Scripts\python.exe -m pip install -r replay-tools/requirements.txt

npm.cmd run build --prefix functions
npm.cmd run build --prefix web
```

## 2. Start the synchronous replay worker

In terminal A:

```powershell
.venv-replay\Scripts\python.exe replay-tools/upload_worker.py
```

The local worker binds to `127.0.0.1:8090` by default.

## 3. Start Firebase emulators

In terminal B, set the worker and private evidence bucket for the Functions emulator, then start the existing emulator suite:

```powershell
$env:REPLAY_WORKER_URL = 'http://127.0.0.1:8090'
$project = (Get-Content .firebaserc -Raw | ConvertFrom-Json).projects.default
$env:REPLAY_BUCKET = "$project.appspot.com"

.\scripts\start-emulators.ps1
```

Storage is now part of the emulator suite on port 9199. Client Storage rules deny all reads and writes; replay evidence is written only through the Admin SDK.

Use the same emulator data directory you normally use so the existing Emperor and Player 8 records are present.

## 4. Prepare the warmup event

In terminal C, use the same local emulator administrator credentials created by `scripts/bootstrap-emulator-admin.mjs`:

```powershell
$env:AOF_EMULATOR_ADMIN_EMAIL = '<your emulator admin email>'
$env:AOF_EMULATOR_ADMIN_PASSWORD = '<your emulator admin password>'

node scripts/setup-warmup-replay-test.mjs
```

The script:

1. finds the existing Emperor;
2. finds exactly one active player named `Player 8`;
3. enters the Emperor into the active Season if needed;
4. creates and publishes a two-player 1v1 warmup Event;
5. configures unrestricted civilizations and no draft;
6. records the explicit replay identity bindings `T90Official -> Emperor` and `Mr Greed -> Player 8`;
7. enters Player 8 into the Season and marks Player 8 RSVP YES / CHECKED_IN in the emulator.

It deliberately leaves the Emperor RSVP/check-in for the player UI test.

## 5. Complete the flow as the Emperor

Run the player website against the emulators using the normal local web setup.

In the website:

1. Open **Replay Warmup — Emulator**.
2. RSVP **YES** as the Emperor.
3. Press **Check in now**. The roster should now show both players checked in.
4. Press the Emperor-only **Form warm-up battle** button.
5. Open the created 1v1 Battle.
6. Open **Battle Orders**. There is no civilization draft; civilizations are player choice in AoE2:DE.
7. Under **Battle Conclusion**, choose `replay-fixtures/1v1_1.aoe2record`.
8. Press **Analyze battle**.

Expected processing time for this fixture is roughly the normal single-recording parser time on the local machine. The UI stays on the Battle while the synchronous request completes.

Expected identity output:

```text
T90Official -> Emperor
Mr Greed    -> Player 8
```

Expected completion:

- recording SHA-256 verified;
- CanonicalReplay bundle generated and validated;
- canonical evidence bundle retained in private Storage;
- `AOF_CANONICAL_STATISTICS_V1` projected;
- active statistics revision published on G1;
- Battle Statistics can be viewed immediately;
- exact re-upload of the same recording is idempotent;
- no canonical winner/result is created or modified.

## Boundaries

This milestone intentionally handles one recording at a time and uses a synchronous request. It does not merge the paired `1v1_2.aoe2record` POV, infer an official winner, aggregate Event/Season/Lifetime statistics, or deploy the Python worker to production.

For production deployment the worker endpoint must be authenticated. The local Functions backend only permits an unauthenticated worker when the URL is loopback and `FUNCTIONS_EMULATOR` is active.
