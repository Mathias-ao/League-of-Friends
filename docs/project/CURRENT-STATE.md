# Age of Friends — Current State

Last reviewed: 16 September 2026

Purpose: Record what currently exists, what is being developed, and what remains blocked or pending. Read [`CORE-IDENTITY.md`](CORE-IDENTITY.md) first for the lasting product vision.

## Current focus

The V1 launch statistics workflow is now locked at the layer level:

```text
Match
  -> TownBell JSON report
  -> Age of Friends interpretation
  -> additional inferred statistics
  -> points / relationship systems
```

**TownBell report ingestion is settled.** Interpretation and every layer after it are intentionally not settled yet.

The in-house `.aoe2record` extraction, CanonicalReplay, replay-free statistics and Match Analysis work continues as a separate R&D track and is not a launch blocker.

The launch ingestion architecture is defined in [`../architecture/townbell-launch-statistics.md`](../architecture/townbell-launch-statistics.md). The real-report audit used to freeze the contract is in [`../architecture/townbell-report-v1-sample-audit.md`](../architecture/townbell-report-v1-sample-audit.md).

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

Backend foundations exist for membership, seasons, events, RSVP/check-in, flexible match-plan approval and Game creation. A player-facing React/TypeScript client exists in `web/`. Production configuration and some end-to-end launch flows remain incomplete.

## TownBell V1 ingestion

### Settled contract

- Stored contract: **`TOWNBELL_REPORT_V1`**.
- Callable: **`adminIngestTownBellReport`**.
- Scope: one immutable TownBell report revision attached to one Age of Friends Game.
- Supported TownBell source envelope: `schema_version: 2` with the supplied 320-metric report structure.
- Report identity: SHA-256 of canonicalized complete report JSON.
- Catalog identity: separate SHA-256 of the canonical 320-metric catalog.
- Storage: complete canonical report, gzip-compressed and base64-encoded, plus lightweight indexed/audit metadata.
- Revision model: different valid reports create immutable revisions; the Game points to one active TownBell report.
- Duplicate model: re-ingesting the identical active report is a no-op.
- Provenance retained from TownBell includes GUID, duration, save version, game build, entity-data version, played-at time, POV number, degraded state and reported-player summaries.
- The Game association chosen during ingestion is the authoritative Age of Friends binding. TownBell `meta.guid` is source identity, not the League `gameId`.
- No replay SHA-256 is required by `TOWNBELL_REPORT_V1`, because the supplied TownBell reports do not expose one.
- No TownBell-to-`playerId` mapping is performed during ingestion.
- No TownBell metric is interpreted, renamed, normalized into an AoF metric or declared point/relationship eligible during ingestion.
- Ingestion marks only the source layer complete; interpretation and inferred-statistics states remain `NOT_STARTED`.
- Ingestion does not invoke points, relationship, achievement, record or inferred-statistics processing.

### Real sample basis

The contract was frozen against TownBell outputs for the repository's 1v1, 2v2, 3v3 and 4v4 replay fixtures.

Across those reports:

- TownBell schema version is 2;
- the catalog is identical and contains 320 metrics;
- the ordered categories are `opening`, `economy`, `military`, `combat`, `map_control`, `tempo`, `mechanics`;
- every player carries all 320 catalog ids;
- player-number, POV and report-player structures are internally consistent;
- the largest supplied canonical report is the 4v4 at about 447 KB before gzip and about 57 KB after gzip.

These samples do not by themselves establish FFA, dynamic-diplomacy, asymmetric-team or future TownBell-schema interpretation behavior.

## Layers intentionally left for later

### Age of Friends interpretation

Not yet settled. This layer will eventually decide player identity mapping, trusted TownBell inputs, AoF metric names/units, qualification rules, unavailable states and its own model/revision contract.

### Additional inferred statistics

Not yet settled. This layer must come after interpretation and must be traceable to the specific interpretation revision/model it consumes.

### Points and relationships

Not yet settled as consumers of the new statistics path. The repository already contains result/reward ledgers and older rivalry foundations, but the V1 formulas and eligible interpreted/inferred inputs are a later product decision.

Raw TownBell JSON must never be consumed directly by points or relationship formulas.

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

The older compact backend path still has a known incompatibility: the current Python adapter emits V4 while legacy derived-stat normalization only accepts V1/V2. This does not block launch under the TownBell strategy.

## Existing competition/backend foundations

| Area | Current state | Main gap |
|---|---|---|
| Firebase backend | Node.js 22, TypeScript, Functions v2, Firestore rules/indexes, authentication mapping and Emulator Suite support exist. | No documented active production deployment. |
| Results | Submission, response, administrator resolution, disputes, corrections and revision history exist. | Finish product flow and deployment validation. |
| Point accounting | Revision-aware League Points, War Room Points and Gold ledger/reconciliation foundations exist. | Final V1 points rules are intentionally deferred. |
| Competition statistics | Result-derived W/L statistics foundations exist. | Keep separate from TownBell interpretation until the new model is settled. |
| Relationships | Older rivalry foundation exists and predates the locked Rivalry / Enemy / Friend model. | Later define Gallantry, Treachery and Chivalry from approved downstream inputs. |
| War Room | Challenge/query foundations exist. | May remain closed until the new relationship model is ready. |
| Achievements / records | Processing foundations exist. | Later define against approved interpreted or inferred fields. |
| Player portraits | Product direction exists; model not implemented. | Later consume reliable downstream military-family evidence. |
| Matchmaking | Flexible planning exists. | Later choose rating/statistical evidence. |
| Player website | React/TypeScript client exists in `web/` and consumes authenticated backend queries. | Complete launch UX, production configuration and final surfaces. |
| Content | Brand, Season I and Event I material exist. | Finish remaining launch content/artwork as needed. |

## Immediate priorities

1. Keep `TOWNBELL_REPORT_V1` ingestion stable and validate its callable/build/administrative flow.
2. Do not start interpretation, additional inferred statistics, points-from-statistics or relationship formulas until those layers are deliberately designed.
3. Continue ordinary launch work that does not depend on those unsettled layers.
4. Continue CanonicalReplay/Match Analysis development independently as R&D when desired.

## Task guidance

- Treat [`CORE-IDENTITY.md`](CORE-IDENTITY.md) as the authority for product vision.
- Inspect the latest `main` code before describing behavior as implemented.
- For V1 launch statistics, follow the exact layer order: Match → TownBell JSON report → interpretation → additional inferred stats → points / relationship.
- Treat only TownBell report ingestion as settled today.
- Keep source reports immutable and preserve historical revisions.
- Never wire raw TownBell field names directly into points, relationships or long-lived player-facing contracts.
- Do not let experimental replay metrics become launch dependencies implicitly.
- Keep the in-house replay/statistics stack intact as R&D and use an explicit promotion decision when it is ready.
- Update this file whenever the active launch source or any later layer becomes formally settled.

## Specialist sources

- [`../architecture/townbell-launch-statistics.md`](../architecture/townbell-launch-statistics.md)
- [`../architecture/townbell-report-v1-sample-audit.md`](../architecture/townbell-report-v1-sample-audit.md)
- [`../architecture/replay-statistics-v1.md`](../architecture/replay-statistics-v1.md) — R&D / legacy operational replay statistics
- [`../architecture/replay-extraction-contract-v1.md`](../architecture/replay-extraction-contract-v1.md) — long-term in-house replay direction
- [`../architecture/canonical-statistics-v1.md`](../architecture/canonical-statistics-v1.md) — R&D canonical metrics
- [`../replay-foundation/README.md`](../replay-foundation/README.md) — replay research and TownBell capability catalogue

## Player website recovery

The player-facing client lives in `web/` with membership, season-entry and authenticated read/query foundations. Treat the source and current CI behavior as authoritative over older recovery notes. TownBell ingestion no longer depends on completing the in-house replay pipeline.
