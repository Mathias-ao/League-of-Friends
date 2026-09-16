# Age of Friends

**Age of Friends** is a private, persistent Age of Empires II: Definitive Edition league for friends. Real games become standings, statistics, achievements, player identities, rivalries, War Room activity and a shared league history.

The technical repository retains its original name, **League of Friends**.

## Project status

The repository contains a substantial Firebase backend, player-facing web client and a deep replay-analysis R&D foundation. It is not yet a production-ready application.

The **launch statistics strategy** is now TownBell-first: TownBell analyzes the match recording and produces JSON; Age of Friends stores that JSON as a versioned source revision and maps it through a separate interpretation layer. The in-house CanonicalReplay / Match Analysis system continues as a parallel R&D track and is not a launch blocker.

Current launch priorities are:

1. finish the TownBell → Age of Friends interpretation layer;
2. freeze and complete the Season I League Points rules;
3. expose standings and approved interpreted statistics in the player website.

Implemented foundations include:

- a Node.js 22 and TypeScript Firebase Functions backend;
- membership, seasons, event signup/check-in and flexible match planning;
- canonical Game results, disputes, corrections and versioned processing jobs;
- revision-aware League Points, War Room Points and Gold reward ledgers;
- competition statistics, ratings, records, achievements, activity and the existing rivalry foundation;
- War Room challenge/query foundations;
- `TOWNBELL_RAW_STATS_V1` and an admin TownBell JSON ingestion boundary;
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
| [`docs/architecture/townbell-launch-statistics.md`](docs/architecture/townbell-launch-statistics.md) | Launch statistics source, interpretation boundary and migration rule. |
| [`docs/architecture/`](docs/architecture/) | Backend and specialist technical contracts. |
| [`docs/replay-foundation/`](docs/replay-foundation/) | In-house replay/statistics R&D and TownBell capability research. |
| [`branding/site.json`](branding/site.json), [`seasons/`](seasons/), [`events/`](events/) | Player-facing brand and persisted season/event content. |

## Locked direction

- Competition and data truth come first; narrative must be earned from real match evidence.
- Admins handle exceptions while automation runs the normal flow.
- A **Match** is a league encounter and contains one or more **Games**. One `.aoe2record` describes one Game.
- **TownBell-produced JSON is the launch statistics source.**
- Raw TownBell data, Age of Friends interpretation and league scoring are separate versioned layers.
- The in-house replay/statistics stack remains active R&D and may replace TownBell later through an explicit migration.
- Authentication UID, durable league `playerId`, external profile ID, replay slot and object instance ID are different identities.
- League Points, War Room Points and Gold are separate systems.
- Relationships are three tracks: Rivalry, Enemy and Friend. Level 3 Rivalry or Enemy unlocks the War Room; Friend rewards remain unresolved.
- Player portraits reflect sustained production commitment across recent and lifetime evidence, with confidence and hysteresis.

## Current competition

- **Season I:** The Fiefdom of Bad Neighbors.
- **Event I:** The War for Lombardia — 4v4, Lombardia, Standard Victory.
- Attendance contingencies may produce asymmetric teams or FFA. Match planning and interpretation must use the approved Game shape instead of assuming the advertised format.
- **Event II direction:** multiple 2v2 Mediterranean matches with naval play and players sharing a landmass. Its final persisted configuration is still outstanding.

## Launch statistics direction

```text
Game result ───────────────> League Points / standings

TownBell JSON
  -> immutable source revision
  -> versioned AoF interpretation
  -> player statistics / records / relationships / achievements
```

The backend currently stores TownBell JSON without hard-coding TownBell field semantics into the domain model. The next statistics milestone is to define and implement `AOF_TOWNBELL_INTERPRETATION_V1` from representative real TownBell outputs.

The existing CanonicalReplay and Match Analysis code remains available under `replay-tools/`, `functions/src/engines/` and the replay architecture documents for continued development outside the launch-critical path.

## Repository map

```text
branding/                  Player-facing brand configuration
docs/project/              Continuity, status and task routing
docs/architecture/         Backend, launch statistics and replay contracts
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
