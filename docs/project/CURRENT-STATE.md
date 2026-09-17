# Age of Friends — Current State

Last reviewed: 17 September 2026

Purpose: Record the current product and engineering state. Read [`CORE-IDENTITY.md`](CORE-IDENTITY.md) first for the lasting product vision and [`CURRENT-STATS.md`](CURRENT-STATS.md) for the concise player-facing statistics baseline.

## Current focus

The active workstream is the player-facing statistics stack and its integration into the website.

The replay pipeline produces Match Statistics across **Opening, Economy, Military, Map Presence and Execution**. A longitudinal foundation now sits above that match layer: neutral Lifetime Statistics and Pair History can be built from versioned match outputs, while Playstyle Sliders and Relationships are explicit rule-driven interpretation systems.

| Statistics section | State |
|---|---|
| Match Statistics | Active / implemented |
| Lifetime Stats | Aggregation foundation implemented; persistence/presentation pending |
| Relationships | Pair History + configurable engine implemented; result pipeline persists neutral encounter/team/result history; points/stages intentionally unconfigured |
| Individual Player Stats + Playstyle Sliders | Configurable engine implemented; slider rules/normalization intentionally unconfigured |

[`CURRENT-STATS.md`](CURRENT-STATS.md) is the concise source of truth for statistics status. [`../architecture/longitudinal-systems-v1.md`](../architecture/longitudinal-systems-v1.md) defines the separation between measurement and product judgment.

## Statistics architecture

The intended flow is:

**`.aoe2record` → canonical replay evidence → Match Statistics → neutral longitudinal facts → configured interpretation systems**

- Match Statistics describe one replayed Game using observed, reconstructed and inferred evidence.
- Lifetime Statistics aggregate eligible match outputs without assigning a player identity label or points.
- Pair History aggregates neutral player-to-player history and directional interaction evidence.
- Playstyle Sliders only produce scores from an explicit versioned rule set supplied by the product owner.
- Rivalry / Enemy / Friend only produce points and stages from an explicit versioned relationship rule set supplied by the product owner.
- Higher layers should consume versioned Match Statistics and neutral league context; they should not independently reinterpret raw replay files.

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

## Replay and Match Statistics foundation

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

The statistics system preserves the distinction between observed evidence, reconstructed evidence and inferred analysis. Commands, queue requests and building placements must not be silently presented as confirmed completed game-state outcomes.

## Longitudinal systems foundation

### Lifetime Statistics

`functions/src/engines/lifetimeStatistics.ts` implements `AOF_LIFETIME_STATISTICS_V1`. It aggregates current match-level Opening, Economy, Military, Map Presence and Execution inputs into player lifetime totals, averages, rates/counts and min/max records with match/game provenance.

This is descriptive aggregation only. It does not assign playstyle meaning or points. The engine exists, but it is not yet wired to durable current Match Statistics storage.

### Player Identity / Playstyle Sliders

`functions/src/engines/playstyleEngine.ts` implements `AOF_PLAYSTYLE_ENGINE_V1`.

The engine accepts normalized 0-100 longitudinal metrics plus an explicit versioned rule set defining slider labels, components, directions, weights and sample requirements. With no rule set it returns `UNCONFIGURED` and no slider scores.

No default slider catalogue, weights, thresholds or normalization population are authoritative yet.

### Pair History and Relationships

`functions/src/engines/relationshipEngine.ts` implements:

- `AOF_PAIR_HISTORY_V1` — neutral pair history including encounters, allied/opponent history, results and directional replay-derived signals.
- `AOF_RELATIONSHIP_ENGINE_V1` — configurable independent Rivalry, Enemy and Friend tracks.

The existing `RIVALRIES` processing step now rebuilds and persists neutral Pair History in the `relationships` collection. Today that persisted history uses encounter/team/result evidence because the current Functions backend does not yet receive the replay-derived directional Match Statistics required for raids/forward pressure. Those signals are explicit future inputs rather than guessed data.

With no explicit relationship rule set, all tracks remain `UNCONFIGURED` with no points or stages. The legacy automatic rivalry threshold no longer drives this processing step, and it no longer opens the War Room. The older `RIVALRY_ENGINE_V1` code is retained only for compatibility and is not authoritative for the new three-track relationship model.

## Current limitations

- Queue requests, research requests and placements do not by themselves prove completion, survival, damage or kills.
- Resource Commitment is an estimate from pinned base costs and does not simulate civilization discounts, cancellations/refunds, resource availability, market exchange or tribute.
- Raid detection is command-episode inference and does not prove raid success or damage.
- Map Presence represents command/building geometry, not fog-of-war exploration or permanent territorial ownership.
- Entity labels are based on the pinned reference catalog and are not yet fully qualified for every replay patch/mod.
- Restored-game clocks, complete effective diplomacy state and some initial-object semantics remain qualification areas.
- Canonical export is not yet the mandatory normal upload path.
- Authenticated replay upload, durable remote canonical persistence and complete backend ingestion remain unfinished.
- Lifetime Statistics persistence and Playstyle presentation are not yet wired end to end.
- Pair History currently persists match/team/result history but not replay-derived directional interaction signals.
- Playstyle normalization, slider definitions/weights and Relationship point/stage rules are intentionally undecided.

## Systems pending broader statistics work

| System | Current state | Main dependency |
|---|---|---|
| Leaderboards and ladder | Foundations exist; final player-facing boards are incomplete. | Lifetime/rating definitions and presentation. |
| Matchmaking | Match planning exists; statistics-informed matchmaking is incomplete. | Rating and persistent player statistics. |
| Relationships | Neutral Pair History processing implemented; interpretation rules not defined. | Product-owner Rivalry/Enemy/Friend point and stage rules plus replay-derived pair signals. |
| War Room | Challenge/query foundations exist; legacy automatic opening is no longer part of relationship processing. | Explicit future product decision after relationship rules are approved. |
| Achievements | Processing scaffolding exists; final catalogue and triggers are not frozen. | Stable match/lifetime statistics and product rules. |
| Awards and trophies | Direction exists; earning rules remain pending. | Stable match, event, season and lifetime statistics. |
| Player portraits / playstyle | Slider engine foundation exists; actual identity model is unconfigured. | Product-owner slider definitions, normalized inputs, weights and sample rules. |

## Other implementation state

| Area | Current state | Main gap |
|---|---|---|
| Firebase backend | Node.js/TypeScript functions, Firestore rules/indexes, authentication mapping and emulator support exist. | Production deployment and complete replay/statistics orchestration. |
| Results | Submission, administrator resolution, disputes, corrections and revision foundations exist. | Replay-derived automatic result qualification and downstream invalidation. |
| Processing | Repeat-safe jobs exist for several downstream systems; Pair History now uses the existing `RIVALRIES` step. | Wire current Match Statistics and Lifetime aggregation into versioned rebuild/storage jobs. |
| Player website | React/TypeScript client exists and consumes authenticated league/event/match/profile data. | Present Match/Lifetime statistics and, once configured, identity and relationship outputs. |

## Immediate priorities

1. Validate the current Match Statistics models against additional real replays and supported match shapes.
2. Wire current Match Statistics into durable backend persistence and the player-facing website.
3. Wire `AOF_LIFETIME_STATISTICS_V1` to persisted Match Statistics and durable rebuild/storage.
4. Feed replay-derived directional Match Statistics into `AOF_PAIR_HISTORY_V1` once backend Match Statistics persistence exists.
5. Define the normalized metric inputs and rule set for Player Identity / Playstyle Sliders.
6. Define Rivalry / Enemy / Friend point rules and stage thresholds.
7. Only after those rules are approved, expose slider scores and relationship progression to the player website and downstream systems.

## Task guidance

- Treat [`CORE-IDENTITY.md`](CORE-IDENTITY.md) as the authority for product vision.
- Treat [`CURRENT-STATS.md`](CURRENT-STATS.md) as the concise authority for statistics status.
- Treat [`../architecture/longitudinal-systems-v1.md`](../architecture/longitudinal-systems-v1.md) as the authority for the measurement-versus-judgment boundary.
- Inspect latest `main` before describing behavior as implemented.
- Keep observed facts, deterministic reconstruction, inferred analysis and league interpretation separate.
- Keep model/rule versions attached to inferred, reconstructed and interpreted outputs.
- Do not introduce default slider weights, relationship points or stage thresholds without explicit product-owner approval.
- Update this file when a major implementation state or priority changes.

## Specialist sources

- [`CURRENT-STATS.md`](CURRENT-STATS.md)
- [`../architecture/longitudinal-systems-v1.md`](../architecture/longitudinal-systems-v1.md)
- [`../architecture/opening-statistics-v1.md`](../architecture/opening-statistics-v1.md)
- [`../architecture/canonical-statistics-v1.md`](../architecture/canonical-statistics-v1.md)
- [`../architecture/replay-statistics-v1.md`](../architecture/replay-statistics-v1.md)
- [`../architecture/replay-extraction-contract-v1.md`](../architecture/replay-extraction-contract-v1.md)
