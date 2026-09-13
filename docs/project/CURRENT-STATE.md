# Age of Friends — Current State

Last reviewed: 11 September 2026  
Repository baseline reviewed: `b7b3adc6ecb646fdb55e2586d5ad022e25d1ef59` on `main`  
Purpose: Record what currently exists, what is being developed, and what remains blocked or pending. Read [`CORE-IDENTITY.md`](CORE-IDENTITY.md) first for the lasting product vision.

## Current focus

The active workstream is the replay-derived statistics foundation.

Match Analysis is in development. Currently V1.3 is the current structural baseline. It demonstrates that the existing replay pipeline can process the seven test shapes: 1v1, 2v2, 3v3, 4v4, FFA with dynamic diplomacy, Nomad and water maps. It provides a working basis for topology, opening, production, spatial and directed player-interaction analysis.

V1.3 is not the final player-facing statistics contract. Metric selection, names, evidence requirements, formulas, confidence rules and presentation remain subject to further review and change. Later experiments in the repository do not become settled product behavior until deliberately accepted.

The immediate goal is to define a reliable V1 statistics set from replay evidence. Systems that consume statistics must remain pending until their required inputs are chosen and validated.

## Match and competition structure

The required hierarchy is:

**League → Season → Event → Match → Game**

- A Match is one planned competitive encounter and may contain one or more Games.
- One `.aoe2record` represents one Game.
- Players join the league once, enter each season separately and sign up for each event separately.
- RSVP and check-in determine the available players.
- The approved Match/Game plan is authoritative for roster, teams, format and civilization rules.
- Attendance changes may produce fewer Games, asymmetric teams or FFA. Downstream systems must use the approved Game shape rather than assume the advertised format.
- Civilization drafting belongs in the web application. Civilizations are unique within each Game, and a captain is selected randomly when required.
- Players upload the replay after playing. They do not manually enter post-match statistics.

Backend foundations exist for membership, seasons, events, RSVP/check-in, flexible match-plan approval and Game creation. The complete player-facing flow and end-to-end draft integration are not yet implemented.

## Replay and statistics state

### Present foundation

- Python replay decoding through `mgz-fast==1.0.0` and the V3 compact adapter.
- Optional `CanonicalReplay 1.0` export with structured facts, initial objects and terrain data.
- A seven-shape corpus harness for structural checks.
- Versioned raw and derived replay-stat ingestion foundations.
- V1.3 analysis foundations for match topology, opening and production evidence, spatial activity, dynamic diplomacy and directed player-pair interaction.
- Backend rebuild paths for player statistics and records.

### Current limitations

- The V1 statistics shown to players are not yet frozen.
- Queue and command evidence must not be presented as confirmed completion, kills or damage.
- Some interaction, raid, support and spatial measures remain inferred and require confidence rules.
- FFA and changing-diplomacy interpretations require continued qualification.
- Canonical export is not yet the mandatory normal upload path.
- Player mapping still relies partly on names or administrative overrides.
- The authenticated player upload and automatic processing flow is not complete.
- Uploaded replay files are intended to be temporary and deleted only after canonical evidence has been extracted, validated and stored successfully. Existing contracts and schemas that require permanent replay retention must be revised to match this decision.

## Systems pending the statistics foundation

The following are part of the product vision but are not considered implemented product systems yet. Existing backend jobs, engines or queries are foundations only.

| System | Current state | Required before implementation is complete |
|---|---|---|
| Leaderboards and ladder | Result, points, rating and read-model foundations exist. Final player-facing boards are not implemented. | Freeze the result, rating and statistical measures used for ranking, including season and lifetime scope. |
| Matchmaking | Flexible Match/Game planning exists, but statistics-informed matchmaking is not complete. | Choose the rating and player evidence used to create balanced or intentionally themed matches. |
| Relationships | Existing rivalry code uses an older single-score model and is not authoritative. | Select validated inputs and formulas for Gallantry, Treachery and Chivalry, then implement the separate Rivalry, Enemy and Friend tracks. |
| War Room | Challenge and query foundations exist, but the intended relationship-driven experience is not implemented. | Implement the three-track relationship model and unlock the War Room at the third Rivalry or Enemy stage. |
| Achievements | Processing scaffolding exists, but the final catalogue and triggers are not frozen. | Define achievements only after their required statistics are reliable and versioned. |
| Awards and trophies | Product direction exists, but definitions, earning rules and presentation are pending. | Decide which validated match, event, season and lifetime statistics support each award or trophy. |
| Player portraits | The persistent portrait direction is defined, but the model is not implemented. | Choose reliable military-family evidence, participation thresholds, recent/lifetime weighting and stability rules. |

## Other implementation state

| Area | Current state | Main gap |
|---|---|---|
| Firebase backend | Node.js 22, TypeScript, Functions v2, Firestore rules/indexes, authentication mapping and Emulator Suite support exist. | No documented active production deployment. |
| Results | Submission, response, administrator resolution, disputes, corrections and revision history exist as backend foundations. | Replay-derived automatic result qualification and complete downstream invalidation still require finishing. |
| Processing | Repeat-safe jobs exist for rewards, ratings, statistics, achievements, rivalries, records and activity. | Their models must be aligned with the final statistics and locked product rules. |
| Read models | League, event, Match, player-profile and War Room queries exist. | No committed user-facing web client consumes them. |
| Content | Brand, Season I, Event I and landing-page design material exist. | Event II and later content are not yet fully persisted; artwork remains outstanding. |

## Immediate priorities

1. Finalize the V1 replay statistics and their evidence classifications.
2. Validate those statistics across the supported match shapes.
3. Decide which statistics are player-facing and which remain internal evidence.
4. Define the rating, matchmaking and relationship models that consume them.
5. Implement leaderboards, the three relationship tracks and the War Room against those versioned models.
6. Define achievements, awards, trophies and portrait progression from validated inputs.
7. Complete the authenticated replay-upload flow and build the player-facing web application.

## Task guidance

- Treat [`CORE-IDENTITY.md`](CORE-IDENTITY.md) as the authority for product vision.
- Inspect the latest `main` code before describing behavior as implemented.
- Treat Match Analysis V1.3 as a working baseline, not a frozen statistics contract.
- Keep observed facts, deterministic reconstruction, inferred analysis and league interpretation separate.
- Do not implement statistics-dependent rewards or relationship progression using provisional fields without recording the model version and evidence limits.
- Update this file whenever the active statistics baseline, a major implementation gap or the immediate priority changes.

## Specialist sources

- [`../architecture/replay-statistics-v1.md`](../architecture/replay-statistics-v1.md)
- [`../architecture/replay-extraction-contract-v1.md`](../architecture/replay-extraction-contract-v1.md)
- [`../replay-foundation/README.md`](../replay-foundation/README.md)
- [`../../README-TEST.md`](../../README-TEST.md)

