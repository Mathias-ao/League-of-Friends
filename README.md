# Age of Friends

**Age of Friends** is a private, persistent Age of Empires II: Definitive Edition league for friends. Real games become standings, statistics, achievements, player identities, rivalries, War Room activity and a shared league history.

The technical repository retains its original name, **League of Friends**.

## Project status

The repository contains a substantial Firebase backend and replay-analysis foundation. It is beyond the original “Phase 2 backend foundation” label, but it is not yet a production-ready application.

Implemented foundations include:

- a Node.js 22 and TypeScript Firebase Functions backend;
- membership, seasons, event signup/check-in and flexible match planning;
- canonical Game results, disputes, corrections and versioned processing jobs;
- rewards, ratings, statistics, records, achievements, activity and the existing rivalry engine;
- War Room challenges and read-model queries;
- a Python `mgz-fast` replay adapter, CanonicalReplay 1.0 export and corpus tooling;
- derived replay statistics and Match Analysis through V1.4;
- player-facing brand, Season I and Event I content.

The normal player upload flow, permanent replay artifact storage, complete extraction qualification and a user-facing web client are not yet implemented end to end. The current rivalry code also predates the locked three-track Rivalry / Enemy / Friend direction.

## Start here

Every task should begin with the latest `main` branch and these sources:

| Source | Authority |
|---|---|
| [`docs/project/PROJECT-CONTINUITY.md`](docs/project/PROJECT-CONTINUITY.md) | Project identity, locked decisions, source authority and cross-workstream rules. |
| [`docs/project/CURRENT-STATE.md`](docs/project/CURRENT-STATE.md) | Implemented state, known gaps, open decisions and routing for the next task. |
| Current code and configuration | Implemented behavior. Code outranks a stale implementation description. |
| [`docs/architecture/`](docs/architecture/) | Firestore, statistics and replay extraction contracts. |
| [`docs/replay-foundation/`](docs/replay-foundation/) | Replay research, CanonicalReplay schema pointer and TownBell capability traceability. |
| [`branding/site.json`](branding/site.json), [`seasons/`](seasons/), [`events/`](events/) | Player-facing brand and persisted season/event content. |

The authority order and fresh-task procedure are defined in the continuity file. Old chats are historical context only after their decisions have been recorded here.

## Locked direction

- Competition and data truth come first; narrative must be earned from real match evidence.
- Admins handle exceptions while automation runs the normal flow.
- A **Match** is a league encounter and contains one or more **Games**. One `.aoe2record` describes one Game.
- Original recordings are retained permanently by content hash. Derived output must be reproducible.
- Parser facts, deterministic reconstruction, inferred analysis and league scoring are separately versioned layers.
- Players upload the replay after a Game; they do not manually enter statistics.
- Results normally become final directly and retain a small dispute option. Only one active result contributes.
- Authentication UID, durable league `playerId`, external profile ID, replay slot and object instance ID are different identities.
- League Points, War Room Points and Gold are separate systems.
- Relationships are three tracks: Rivalry, Enemy and Friend. Level 3 Rivalry or Enemy unlocks the War Room; Friend rewards remain unresolved.
- Player portraits reflect sustained production commitment across recent and lifetime evidence, with confidence and hysteresis.

## Current competition

- **Season I:** The Fiefdom of Bad Neighbors.
- **Event I:** The War for Lombardia — 4v4, Lombardia, Standard Victory.
- Attendance contingencies may produce asymmetric teams or FFA. Match planning, drafting and replay analysis must use the approved Game shape instead of assuming the advertised format.
- **Event II direction:** multiple 2v2 Mediterranean matches with naval play and players sharing a landmass. Its final persisted configuration is still outstanding.

## Replay direction

The extraction requirements are settled in [`docs/architecture/replay-extraction-contract-v1.md`](docs/architecture/replay-extraction-contract-v1.md). Parser implementation is a later workstream.

CanonicalReplay 1.0 is the durable evidence contract. The 320 TownBell-shaped capabilities remain a benchmark and projection catalogue. Queue commands prove requested production, not completed units; exact trained/live-unit claims require an independently qualified state source. Match Analysis V1.4 consumes existing canonical facts and must not trigger corpus reparsing by itself.

## Repository map

```text
branding/                  Player-facing brand configuration
docs/project/              Continuity, status and task routing
docs/architecture/         Backend and replay contracts
docs/replay-foundation/    Preserved replay research and capability matrix
docs/design/               UI/product design decisions
events/                    Modular player-facing event content
seasons/                   Modular player-facing season content
functions/                 Firebase Functions backend (TypeScript)
replay-tools/              Python replay adapter and canonical schema
scripts/                   Emulator, ingestion, corpus and smoke-test tools
```

## Local development

A production Firebase project is not committed. Use the Emulator Suite with a demo project ID.

```bash
npm --prefix functions install
npm --prefix functions run build
firebase emulators:start --project demo-league-of-friends
```

Replay installation and corpus instructions are in [`README-TEST.md`](README-TEST.md). V1.4 analysis instructions are in [`README-MATCH-ANALYSIS-V1_4.md`](README-MATCH-ANALYSIS-V1_4.md). Never commit service-account keys, replay files containing private player data, or other secrets.
