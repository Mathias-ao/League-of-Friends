# Age of Friends — Current State

Last reviewed: 17 September 2026

Purpose: Record the current product and engineering state. Read [`CORE-IDENTITY.md`](CORE-IDENTITY.md) first for the lasting product vision and [`CURRENT-STATS.md`](CURRENT-STATS.md) for the concise player-facing statistics baseline.

## Current focus

The active workstream is the player-facing replay statistics system and its integration into the website.

The replay pipeline now produces a meaningful set of Match Statistics across the five player-facing categories: **Opening, Economy, Military, Map Presence and Execution**. The implemented match models include Build Order V2, Opening Statistics V1, Raid Detection V1, Map Presence V2, Forward Eco V1 and Resource Commitment V1.

The broader statistics product is structured into four sections:

| Statistics section | State |
|---|---|
| Match Statistics | Active / implemented |
| Lifetime Stats | Not started |
| Relationships | Not started |
| Individual Player Stats + Playstyle Sliders | Not started |

[`CURRENT-STATS.md`](CURRENT-STATS.md) is the source of truth for which player-facing statistics currently exist.

## Match and competition structure

The required hierarchy remains:

**League → Season → Event → Match → Game**

- A Match is one planned competitive encounter and may contain one or more Games.
- One `.aoe2record` represents one Game.
- Players join the league once, enter each season separately and sign up for each event separately.
- RSVP and check-in determine the available players.
- The approved Match/Game plan is authoritative for roster, teams, format and civilization rules.
- Attendance changes may produce fewer Games, asymmetric teams or FFA.
- Civilization drafting belongs in the web application.
- Players upload replays; post-match statistics are derived automatically rather than entered manually.

Backend foundations exist for membership, seasons, events, RSVP/check-in, flexible match planning and Game creation. The player-facing React/TypeScript client lives in `web/`. Production configuration, replay upload and the complete end-to-end statistics presentation flow remain incomplete.

## Replay and statistics foundation

The current replay/statistics foundation includes:

- Python replay decoding through the pinned `mgz-fast` adapter.
- Versioned CanonicalReplay extraction with source hashing, participant identity, initial state and chronological operation evidence.
- Deterministic canonical stores, validation, retained raw evidence and coverage warnings.
- Replay-free statistics projection from canonical evidence.
- Player-facing Opening statistics and Build Order classification.
- Resource Commitment estimates by resource and age.
- Raid episode detection with attacker/victim attribution.
- Map Presence V2, including command coverage, enemy-base contact, forward buildings, expansions, gold influence and relic interaction.
- Forward Eco classification using the Map Presence V2 forward geometry.
- Observed command and selection evidence for Execution statistics.
- Versioned tests, golden projections and architecture documents for the active models.

The statistics system continues to preserve the distinction between observed evidence, reconstructed evidence and inferred analysis. Commands, queue requests and building placements must not be silently presented as confirmed completed game-state outcomes.

## Current Match Statistics

The match layer is now useful enough to support player-facing match analysis. The concise list and model status are maintained in [`CURRENT-STATS.md`](CURRENT-STATS.md).

Current strengths:

- **Opening:** mature first player-facing category, including build order, age timings, military opening timing, walls, houses and Loom.
- **Economy:** Resource Commitment provides the first useful economy model, including age breakdowns.
- **Military:** raid initiation and raid exposure are implemented; broader military performance statistics remain future work.
- **Map Presence:** strong spatial category with V2 geometry, Forward Eco and gold/relic measures.
- **Execution:** reliable command-volume and selection evidence is available, but higher-level efficiency/APM interpretation is not yet a finished player-facing model.

## Current limitations

- Queue requests, research requests and placements do not by themselves prove completion, survival, damage or kills.
- Resource Commitment is an estimate from pinned base costs and does not simulate civilization discounts, cancellations/refunds, resource availability, market exchange or tribute.
- Raid detection is command-episode inference and does not prove raid success or damage.
- Map Presence represents command/building geometry, not fog-of-war exploration or permanent territorial ownership.
- Entity labels are based on the pinned reference catalog and are not yet fully qualified for every replay patch/mod.
- Restored-game clocks, complete effective diplomacy state and some initial-object semantics remain qualification areas.
- Canonical export is not yet the mandatory normal upload path.
- Authenticated replay upload, durable remote canonical persistence and complete backend ingestion remain unfinished.
- Lifetime Stats, Relationships, and Individual Player Stats/Playstyle Sliders have not started.

## Systems pending broader statistics work

| System | Current state | Main dependency |
|---|---|---|
| Leaderboards and ladder | Foundations exist; final player-facing boards are incomplete. | Lifetime/rating definitions and presentation. |
| Matchmaking | Match planning exists; statistics-informed matchmaking is incomplete. | Rating and persistent player statistics. |
| Relationships | Not started under the new statistics structure. Older rivalry code is not authoritative. | Relationship statistic definitions and versioned progression models. |
| War Room | Challenge/query foundations exist; player access should remain closed until the intended relationship system exists. | Relationships. |
| Achievements | Processing scaffolding exists; final catalogue and triggers are not frozen. | Stable match/lifetime statistics. |
| Awards and trophies | Direction exists; earning rules remain pending. | Stable match, event, season and lifetime statistics. |
| Player portraits / playstyle | Direction exists; persistent model is not implemented. | Individual Player Stats and Playstyle Sliders. |

## Other implementation state

| Area | Current state | Main gap |
|---|---|---|
| Firebase backend | Node.js/TypeScript functions, Firestore rules/indexes, authentication mapping and emulator support exist. | Production deployment and complete replay/statistics orchestration. |
| Results | Submission, administrator resolution, disputes, corrections and revision foundations exist. | Replay-derived automatic result qualification and downstream invalidation. |
| Processing | Repeat-safe jobs exist for several downstream systems. | Align consumers with the current versioned statistics models. |
| Player website | React/TypeScript client exists and consumes authenticated league/event/match/profile data. | Present current Match Statistics, complete replay upload, drafting and production configuration. |

## Immediate priorities

1. Validate the current Match Statistics models against additional real replays and supported match shapes.
2. Present the current Match Statistics cleanly in the player-facing website.
3. Complete authenticated replay upload, canonical persistence and automatic statistics processing.
4. Define and implement Lifetime Stats from the stable match-level outputs.
5. Define Relationships as a separate statistics/product layer.
6. Define Individual Player Stats and Playstyle Sliders from stable longitudinal evidence.
7. Build statistics-dependent leaderboards, matchmaking, achievements, awards and relationship experiences only on versioned inputs.

## Task guidance

- Treat [`CORE-IDENTITY.md`](CORE-IDENTITY.md) as the authority for product vision.
- Treat [`CURRENT-STATS.md`](CURRENT-STATS.md) as the concise authority for the current player-facing statistics set.
- Inspect latest `main` before describing behavior as implemented.
- Keep observed facts, deterministic reconstruction, inferred analysis and league interpretation separate.
- Keep model/rule versions attached to inferred or reconstructed statistics.
- Update this file when a major implementation state or priority changes.
- Update `CURRENT-STATS.md` whenever a player-facing statistic is added, removed, renamed or changes status.

## Specialist sources

- [`CURRENT-STATS.md`](CURRENT-STATS.md)
- [`../architecture/opening-statistics-v1.md`](../architecture/opening-statistics-v1.md)
- [`../architecture/canonical-statistics-v1.md`](../architecture/canonical-statistics-v1.md)
- [`../architecture/replay-statistics-v1.md`](../architecture/replay-statistics-v1.md)
- [`../architecture/replay-extraction-contract-v1.md`](../architecture/replay-extraction-contract-v1.md)
- [`../replay-foundation/README.md`](../replay-foundation/README.md)
