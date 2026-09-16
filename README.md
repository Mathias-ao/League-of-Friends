# Age of Friends

**Age of Friends** is a private, persistent Age of Empires II: Definitive Edition league for friends. Real games become standings, statistics, achievements, player identities, rivalries, War Room activity and a shared league history.

The technical repository retains its original name, **League of Friends**.

## Project status

The repository contains a substantial Firebase backend, player-facing web client and a deep replay-analysis R&D foundation. It is not yet a production-ready application.

The V1 launch statistics workflow is now:

```text
Match
  -> TownBell JSON report
  -> Age of Friends interpretation
  -> additional inferred statistics
  -> points / relationship systems
```

**TownBell report ingestion is settled.** Interpretation, additional inferred statistics, points formulas and relationship formulas are intentionally left for later decisions.

The in-house CanonicalReplay / Match Analysis system continues as a parallel R&D track and is not a launch blocker.

Implemented foundations include:

- a Node.js 22 and TypeScript Firebase Functions backend;
- membership, seasons, event signup/check-in and flexible match planning;
- canonical Game results, disputes, corrections and versioned processing jobs;
- revision-aware League Points, War Room Points and Gold reward ledgers;
- competition statistics, ratings, records, achievements, activity and an older rivalry foundation;
- War Room challenge/query foundations;
- **`TOWNBELL_REPORT_V1`** and the admin callable **`adminIngestTownBellReport`**;
- a Python `mgz-fast` replay adapter, CanonicalReplay 1.1 export, replay-free statistics and Match Analysis R&D;
- player-facing brand, Season I and Event I content;
- a React/TypeScript player web client in `web/`.

## Start here

Every task should begin with the latest `main` branch and these sources:

| Source | Authority |
|---|---|
| [`docs/project/CORE-IDENTITY.md`](docs/project/CORE-IDENTITY.md) | Project identity, locked decisions, source authority and cross-workstream rules. |
| [`docs/project/CURRENT-STATE.md`](docs/project/CURRENT-STATE.md) | Implemented state, known gaps and current launch priorities. |
| Current code and configuration | Implemented behavior. Code outranks a stale implementation description. |
| [`docs/architecture/townbell-launch-statistics.md`](docs/architecture/townbell-launch-statistics.md) | Settled V1 TownBell ingestion contract and later-layer boundary. |
| [`docs/architecture/townbell-report-v1-sample-audit.md`](docs/architecture/townbell-report-v1-sample-audit.md) | Real 1v1–4v4 TownBell report evidence used to freeze ingestion. |
| [`docs/architecture/`](docs/architecture/) | Backend and specialist technical contracts. |
| [`docs/replay-foundation/`](docs/replay-foundation/) | In-house replay/statistics R&D and TownBell capability research. |
| [`branding/site.json`](branding/site.json), [`seasons/`](seasons/), [`events/`](events/) | Player-facing brand and persisted season/event content. |

## Locked direction

- Competition and data truth come first; narrative must be earned from real match evidence.
- Admins handle exceptions while automation runs the normal flow.
- A **Match** is a league encounter and contains one or more **Games**. One `.aoe2record` describes one Game.
- **TownBell-produced JSON is the V1 launch source report.**
- The V1 order is **Match → TownBell report → interpretation → additional inferred stats → points / relationship**.
- Only report ingestion is currently settled; downstream models require explicit later decisions.
- Raw TownBell reports, AoF interpretation, inferred statistics and league consequences are separate versioned layers.
- Raw TownBell metric fields must not be read directly by points or relationship formulas.
- The in-house replay/statistics stack remains active R&D and may replace TownBell later only through an explicit migration.
- Authentication UID, durable league `playerId`, external profile ID, replay slot and object instance ID are different identities.
- League Points, War Room Points and Gold remain separate accounting systems.
- Relationships are three tracks: Rivalry, Enemy and Friend. Their new V1 statistical inputs/formulas are not yet settled.
- Player portraits reflect sustained evidence rather than one unusual Game.

## Current competition

- **Season I:** The Fiefdom of Bad Neighbors.
- **Event I:** The War for Lombardia — 4v4, Lombardia, Standard Victory.
- Attendance contingencies may produce asymmetric teams or FFA. Match planning and later interpretation must use the approved Game shape instead of assuming the advertised format.
- **Event II direction:** multiple 2v2 Mediterranean matches with naval play and players sharing a landmass. Its final persisted configuration is still outstanding.

## Settled TownBell ingestion

`TOWNBELL_REPORT_V1` was frozen from real TownBell JSON outputs for the repository's 1v1, 2v2, 3v3 and 4v4 replay fixtures.

The contract accepts TownBell `schema_version: 2` reports with the demonstrated 320-metric catalog. It validates report/player/catalog consistency, canonicalizes the entire JSON document, hashes the report and catalog, gzip-compresses the complete canonical report and stores an immutable revision under the selected Game.

```text
matches/{matchId}/games/{gameId}/townBellReports/{reportHash}
```

The Game records one active report revision. Re-ingesting the identical active report is idempotent; a different valid report creates a new immutable revision and supersedes the previous active report.

TownBell's GUID, build/version metadata, POV identity and player summaries are retained as source metadata. The Age of Friends Match/Game binding is selected during ingestion. No replay SHA-256 is required by the report contract because the supplied TownBell reports do not contain one.

Successful ingestion ends here:

```text
TownBell report ingestion      COMPLETE
AoF interpretation             NOT_STARTED
Additional inferred statistics NOT_STARTED
Points / relationships         NOT RUN BY INGESTION
```

No player identity mapping, metric interpretation, inference, scoring or relationship progression occurs during report ingestion.

## In-house replay/statistics direction

The existing CanonicalReplay and Match Analysis code remains available under `replay-tools/`, `functions/src/engines/` and the replay architecture documents for continued development outside the launch-critical path.

Its eventual replacement of TownBell is an explicit migration decision, not an incidental refactor.

## Repository map

```text
branding/                  Player-facing brand configuration
docs/project/              Continuity, status and task routing
docs/architecture/         Backend, TownBell launch statistics and replay contracts
docs/replay-foundation/    Preserved replay/statistics research
events/                    Modular player-facing event content
seasons/                   Modular player-facing season content
functions/                 Firebase Functions backend (TypeScript)
replay-tools/              In-house replay/statistics R&D
scripts/                   Emulator, ingestion, corpus and smoke-test tools
web/                       Player-facing React/TypeScript client
```

## Local development

A production Firebase project is not committed. Use the Emulator Suite with a demo project ID.

```bash
npm --prefix functions install
npm --prefix functions run build
firebase emulators:start --project demo-league-of-friends
```

Replay R&D installation and corpus instructions are in [`README-TEST.md`](README-TEST.md). Never commit service-account keys, replay files containing private player data, TownBell JSON containing private data, or other secrets.
