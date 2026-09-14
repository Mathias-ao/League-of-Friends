# Age of Friends — Current State

Last reviewed: 14 September 2026

Repository baseline reviewed: `2688d472a14e9105da0ccac101eca3f3bb8f5c94` on `main`, with the CanonicalReplay conformance milestone described below

Purpose: Record what currently exists, what is being developed, and what remains blocked or pending. Read [`CORE-IDENTITY.md`](CORE-IDENTITY.md) first for the lasting product vision.

## Current focus

The active workstream is the replay-derived statistics foundation.

Match Analysis is in development. Currently V1.3 is the current structural baseline. It demonstrates that the existing replay pipeline can process the seven test shapes: 1v1, 2v2, 3v3, 4v4, FFA with dynamic diplomacy, Nomad and water maps. It provides a working basis for topology, opening, production, spatial and directed player-interaction analysis.

V1.3 is not the final player-facing statistics contract. Metric selection, names, evidence requirements, formulas, confidence rules and presentation remain subject to further review and change. Later experiments in the repository do not become settled product behavior until deliberately accepted.

The first durable CanonicalReplay extraction/conformance slice and conservative replay-free statistics projection are implemented locally. The immediate engineering goal is to qualify command semantics with controlled real recordings and use that evidence to revise the provisional V1 eligibility registry. Systems that consume statistics must remain pending until their required inputs are chosen and validated.

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

Backend foundations exist for membership, seasons, events, RSVP/check-in, flexible match-plan approval and Game creation. A player-facing React/TypeScript client has been recovered in `web/`, with separate season entry and Firebase callable integration. Production configuration, replay upload and end-to-end draft integration remain incomplete.

## Replay and statistics state

### Present foundation

- Python replay decoding through code-hash-pinned `mgz-fast==1.0.0`. The V4 compact adapter is projected from canonical events and preserves signed/null queue amounts.
- Optional `CanonicalReplay 1.1.0` extraction with source SHA-256, explicit parser/schema/entity-data versions, replay-local participant identities, initial objects/terrain and chronological operation envelopes. The original 1.0.0 schema is archived; this is an explicit contract migration.
- Complete original byte evidence in canonical header/operation artifacts, retained unknown/partial payloads, deterministic multi-chunk stores, schema validation, stream invariants, semantic goldens and coverage/warnings reports. Local validation reproduces the source hash without opening the replay.
- Replay-free projection V2 / command fundamentals V2 for action/time buckets, queue requests, research requests, building-placement orders and directed diplomacy timelines. Age-advance request candidates, `AgeAdvanceStarted`, observed `AgeReached` and projected completion remain separate; the latter three are unavailable in this slice.
- `AOF_STATISTICS_ELIGIBILITY_V1` preserves and classifies all 320 TownBell rows: 13 available canonical command measures, 25 inferred measures, 59 needing controlled fixtures, 125 needing parser research and 98 needing engine simulation. `AOF_CANONICAL_STATISTICS_V1` validates a replay-free evidence report with participant command summaries, request/placement/diplomacy facts, qualified coverage warnings and raw-ID-preserving reference entity labels. These classifications are provisional engineering eligibility, not frozen player-facing product choices.
- A seven-shape corpus harness for structural checks.
- Versioned raw and derived replay-stat ingestion foundations.
- V1.3 analysis foundations for match topology, opening and production evidence, spatial activity, dynamic diplomacy and directed player-pair interaction. The repository's V1.4 analyzer remains an optional experiment; both corpus readers now verify and read every canonical chunk.
- Backend rebuild paths for player statistics and records.

The conformance harness includes a declared synthetic wire fixture and two hash-pinned real regression snapshots: save/build 68/180059 (FFA) and 66.6/158041 (1v1), totaling 782,192 body operations. Their compatibility is `fixture_regression_only`, not general patch support. The regression recordings, paired POVs and historical shape corpus are now committed under `replay-fixtures/` with owner authorization. The historical seven-shape corpus has not been rerun in this milestone. See the [milestone audit](../architecture/canonical-v1-conformance-milestone.md) for test evidence and exact projection boundaries.

A hash-pinned ordinary 1v1 recorded from both player perspectives adds paired-source evidence for save/build 68/180059. All 176,588 ordered non-camera/non-chat operations match exactly across POVs, including retained raw bytes; initial terrain and objects also match. Camera streams differ and one POV contains one extra terminal chat operation. Three Feudal research commands within 403 ms also demonstrate that decoded age-related research requests are not automatically accepted `AgeAdvanceStarted` facts. This validates recorder-local separation for that fixture, not command completion semantics or a general source-merging policy.

The replay-free statistics corpus report has been run over the stored FFA, upstream duel and both ordinary-1v1 canonical bundles. The paired projections agree on 5,168 decoded player actions, 367 queue requests, 56 research requests, 226 building placements, five market commands and one resignation; both retain camera scope as recorder-only. See the [Canonical Statistics V1 milestone](../architecture/canonical-statistics-v1.md) for exact available projections and unresolved research boundaries.

### Current limitations

- The V1 statistics shown to players are not yet frozen.
- Queue and command evidence must not be presented as confirmed completion, kills or damage.
- Some interaction, raid, support and spatial measures remain inferred and require confidence rules.
- FFA and changing-diplomacy interpretations require continued qualification.
- Canonical export is not yet the mandatory normal upload path.
- Authenticated upload orchestration, durable remote persistence, transactional canonical revision selection and backend ingestion of adapter V4 remain unimplemented. Existing derived-stat ingestion supports only V1/V2.
- Initial-object completeness, patch/mod-aware entity normalization, restored-game clocks and effective diplomacy state are unqualified. Queue/research/build commands do not establish acceptance or completion; age-notification authenticity still needs controlled fixtures.
- Player mapping still relies partly on names or administrative overrides.
- The authenticated player upload and automatic processing flow is not complete.
- Uploaded replay files are temporary and may be deleted only after canonical evidence has been extracted, validated and durably stored. The extraction contract and active schema now reflect this rule. This local CLI never deletes a source; `persistenceVerified` and `sourceDeletionEligible` remain false. Players retain their originals.

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
| Player website and read models | Client in `web/` consumes authenticated league, event, Match and profile queries, with a labelled memory-only preview and separate season entry. | Recovered source needs current CI verification, browser/emulator validation and production configuration. Replay upload, drafting and statistics-dependent systems remain pending. |
| Content | Brand, Season I, Event I and landing-page design material exist. | Event II and later content are not yet fully persisted; artwork remains outstanding. |

## Immediate priorities

1. Add a controlled current-build queue/cancel/research/diplomacy recording pair with an action log and two-player evidence; qualify only the semantics it establishes.
2. Review the candidate player-facing list and revise the V1 eligibility registry only as controlled fixtures qualify semantics; then validate it across the supported match shapes.
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
- [`../architecture/canonical-v1-conformance-milestone.md`](../architecture/canonical-v1-conformance-milestone.md)
- [`../architecture/canonical-statistics-v1.md`](../architecture/canonical-statistics-v1.md)
- [`../replay-foundation/README.md`](../replay-foundation/README.md)
- [`../../README-TEST.md`](../../README-TEST.md)

## Player website recovery — 14 September 2026

The approved `feat/player-facing-website` branch recovers the interrupted frontend and participation gateway directly through GitHub. Source follows the six-tab layout and uses object-oriented domain/services/repositories. It is reconstructed from the conversation, not byte-identical to the unavailable local commit.

The original generated artwork, dependency lockfile and compiled preview were not retrievable. The hero renders without artwork until restored. Earlier local tests apply only to the interrupted commit; use the recovery branch's own CI results. No private Site version or Firebase production rollout has completed.

New callables: `getMyMembership`, `getPlayerSiteDirectory`, `enterSeason`. New affirmative RSVP requires season entry, public achievements require showcase selection, and raw Firestore reads are restricted to player owners or administrators. These read-policy changes require emulator checks and review of existing direct consumers before deployment.

See [the client README](../../web/README.md) and [recovery record](../../web/RECOVERY.md) for setup, exact limitations, the reserved Site identity, and next steps.
