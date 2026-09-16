# Age of Friends — Current State

Last reviewed: 16 September 2026

Purpose: Record what currently exists, what is being developed, and what remains blocked or pending. Read [`CORE-IDENTITY.md`](CORE-IDENTITY.md) first for the lasting product vision.

## Current focus

The launch strategy has changed.

**TownBell-produced JSON is now the launch statistics source.** The in-house `.aoe2record` extraction, CanonicalReplay, replay-free statistics and Match Analysis work continues as a separate R&D track and is no longer a launch blocker.

The two primary launch workstreams are now:

1. **Interpretation layer** — convert an active TownBell JSON revision into stable, versioned Age of Friends metrics and relationship/record/achievement inputs.
2. **League Points system** — finish and freeze the product scoring rules on top of the existing revision-aware ledger/reward foundation.

The launch architecture is defined in [`../architecture/townbell-launch-statistics.md`](../architecture/townbell-launch-statistics.md).

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

Backend foundations exist for membership, seasons, events, RSVP/check-in, flexible match-plan approval and Game creation. A player-facing React/TypeScript client exists in `web/`. Production configuration, complete replay/statistics administration and some end-to-end flows remain incomplete.

## Launch statistics path

### Implemented foundation

- `TOWNBELL_RAW_STATS_V1` validates and preserves a complete TownBell JSON payload without assuming its field semantics.
- `adminIngestTownBellStats` ingests a TownBell JSON revision against a specific Match/Game.
- TownBell revisions use deterministic payload hashes, source replay SHA-256, optional TownBell version, immutable revision documents and explicit supersession.
- The Game records which TownBell revision is active and marks interpretation as pending.
- Raw TownBell field names are intentionally not wired directly into League Points, player UI, relationships, records or achievements.

### Still required

- Representative TownBell JSON examples for each intended launch match shape.
- Durable TownBell-player identity mapping to Age of Friends `playerId` values.
- A versioned TownBell-to-Age-of-Friends interpretation schema.
- Interpretation processing, revision handling and rebuild behavior.
- Player-facing metric selection and naming.
- Qualification rules for team games, asymmetric teams, FFA and dynamic diplomacy where relevant.

## League Points state

The existing reward foundation is usable and should be evolved rather than replaced.

Current behavior:

- canonical Match results determine winners;
- scoring rules are read from the Match scoring snapshot;
- League Points are recorded in an append/reconciliation ledger;
- result revisions reconcile prior amounts;
- processing is idempotent and auditable;
- League Points, War Room Points and Gold are separate accounting systems;
- current reward components include Match completion and Match win.

Still required for launch:

- freeze the Season I League Points rules and values;
- decide whether points operate only at Match level or whether any Game/event components are required;
- define tie/draw/forfeit/cancel behavior where applicable;
- decide whether any statistical bonus exists at launch;
- if statistical bonuses exist, they must consume approved interpretation fields, never raw TownBell JSON;
- expose the final standings/read model in the player website.

## In-house replay/statistics R&D

The following work remains valuable but is not launch-critical:

- Python decoding through pinned `mgz-fast`;
- CanonicalReplay 1.1 extraction and conformance artifacts;
- replay-free projection and `AOF_CANONICAL_STATISTICS_V1`;
- controlled-fixture research into queue/research/diplomacy semantics;
- Match Analysis topology/opening/spatial/interaction experiments;
- legacy replay `rawStats -> derivedStats -> analysisStats` backend processing;
- replay-derived aggregate and record rebuilds.

Do not delete this work. New work in these areas should be treated as R&D unless an explicit decision promotes it into the launch path.

The older compact backend path still has a known incompatibility: the current Python adapter emits V4 while legacy derived-stat normalization only accepts V1/V2. This no longer blocks launch under the TownBell strategy.

## Systems depending on interpretation

| System | Current state | Launch dependency |
|---|---|---|
| Player statistics | Competition W/L statistics foundations exist; replay-derived metric foundations also exist. | Define the TownBell interpretation contract and approved player-facing measures. |
| Leaderboards / standings | Result, reward and standing foundations exist. | Freeze League Points rules and expose the launch read model. |
| Relationships | Older rivalry foundation exists but does not implement the locked Rivalry / Enemy / Friend model. | Define Gallantry, Treachery and Chivalry inputs from approved interpretations. |
| War Room | Challenge/query foundations exist. | Relationship progression remains a separate product dependency; War Room may remain closed until that model is ready. |
| Achievements | Processing scaffolding exists. | Define only achievements whose required result or interpreted statistics are stable. |
| Records | Backend foundations exist. | Define record catalogue against approved interpretation fields. |
| Player portraits | Product direction exists, model not implemented. | Requires reliable interpreted military-family evidence. |
| Matchmaking | Flexible planning exists. | Choose rating and interpreted player evidence after launch scoring is stable. |

## Other implementation state

| Area | Current state | Main gap |
|---|---|---|
| Firebase backend | Node.js 22, TypeScript, Functions v2, Firestore rules/indexes, authentication mapping and Emulator Suite support exist. | No documented active production deployment. |
| Results | Submission, response, administrator resolution, disputes, corrections and revision history exist as backend foundations. | Finish product flow and deployment validation. |
| Processing | Repeat-safe jobs exist for rewards, ratings, competition statistics, achievements, rivalries, records and activity. | Align each job with the launch models actually selected. |
| Player website | React/TypeScript player client exists in `web/` and consumes authenticated backend queries. | Complete launch UX, production configuration and final standings/statistics surfaces. |
| Content | Brand, Season I and Event I material exist. | Finish remaining launch content and artwork as needed. |

## Immediate priorities

1. Collect real TownBell JSON outputs for the launch match shapes and commit sanitized fixtures or schemas where licensing/privacy permits.
2. Design `AOF_TOWNBELL_INTERPRETATION_V1`: identity mapping, approved metrics, units, unavailable states and qualification rules.
3. Implement interpretation processing from the active `TOWNBELL_RAW_STATS_V1` revision.
4. Freeze the Season I League Points formula and snapshot configuration.
5. Validate result correction → points reconciliation → standings end to end.
6. Build player-facing standings and interpreted match/player statistics.
7. Add relationships, records and achievements only where their interpretation inputs are explicitly approved.
8. Continue CanonicalReplay/Match Analysis development independently until it can replace TownBell behind the interpretation boundary.

## Task guidance

- Treat [`CORE-IDENTITY.md`](CORE-IDENTITY.md) as the authority for product vision.
- Inspect the latest `main` code before describing behavior as implemented.
- For launch statistics, start from TownBell JSON, not `replay-tools/`.
- Keep TownBell source data, Age of Friends interpretation and league scoring as separate versioned layers.
- Do not let experimental replay metrics become launch dependencies implicitly.
- Do not wire raw TownBell field names into League Points or long-lived UI contracts.
- Keep the in-house replay/statistics stack intact as R&D and use an explicit promotion decision when it is ready.
- Update this file whenever the active launch source, interpretation contract or scoring model changes.

## Specialist sources

- [`../architecture/townbell-launch-statistics.md`](../architecture/townbell-launch-statistics.md)
- [`../architecture/replay-statistics-v1.md`](../architecture/replay-statistics-v1.md) — R&D / legacy operational replay statistics
- [`../architecture/replay-extraction-contract-v1.md`](../architecture/replay-extraction-contract-v1.md) — long-term in-house replay direction
- [`../architecture/canonical-statistics-v1.md`](../architecture/canonical-statistics-v1.md) — R&D canonical metrics
- [`../replay-foundation/README.md`](../replay-foundation/README.md) — replay research and TownBell capability catalogue

## Player website recovery

The player-facing client lives in `web/` with membership, season-entry and authenticated read/query foundations. Treat the source and current CI behavior as authoritative over older recovery notes. Launch work should now prioritize the final competition/standings path and TownBell-backed interpreted statistics rather than waiting for the in-house replay pipeline.
