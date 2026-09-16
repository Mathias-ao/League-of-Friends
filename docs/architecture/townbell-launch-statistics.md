# TownBell Launch Statistics Strategy

Status: launch strategy, 16 September 2026

## Decision

Age of Friends will use **TownBell-produced JSON as the launch match-statistics source**.

The in-house `.aoe2record` extraction, CanonicalReplay, replay-free statistics projection and Match Analysis work remains in the repository as a separate research and development track. It is not required to reach launch and must not block launch-critical interpretation or League Points work.

When the in-house statistics system is sufficiently qualified, it can replace the TownBell source behind the same interpretation boundary rather than forcing a rewrite of competition rules.

## Launch architecture

```text
Game result
  ├─> canonical result -> League Points / standings / competition processing
  └─> TownBell analysis -> TownBell JSON
                         -> immutable Game statistics revision
                         -> Age of Friends interpretation layer
                         -> player-facing statistics / records / relationships / achievements as each model is approved
```

The two inputs have different responsibilities:

- **Canonical Game result** answers who won, who participated and which result revision is active.
- **TownBell JSON** supplies the statistical observations used by launch interpretation models.

League Points must not depend on provisional in-house replay metrics.

## TownBell ingestion contract

Launch ingestion is deliberately schema-preserving. The backend stores the TownBell JSON without pretending that Age of Friends already understands every field.

Each accepted TownBell revision records:

- Match and Game identity;
- source replay SHA-256 supplied with the TownBell output;
- optional source filename;
- optional TownBell version;
- deterministic JSON payload hash;
- complete validated JSON payload;
- revision and supersession identity;
- importer and timestamp;
- interpretation state.

The active revision is referenced from the Game. Historical revisions remain immutable and auditable.

The initial backend callable is `adminIngestTownBellStats` and the stored contract is `TOWNBELL_RAW_STATS_V1`.

## Interpretation boundary

Do not wire TownBell field names directly into League Points, UI components, relationships or achievements.

Instead, the next implementation layer must convert one active TownBell revision into a versioned Age of Friends interpretation document. That document is where we decide:

1. which TownBell fields are trusted;
2. how players in TownBell map to durable `playerId` values;
3. metric names and units used by Age of Friends;
4. game/team/FFA qualification rules;
5. formulas, thresholds and derived values;
6. confidence or unavailable states where necessary;
7. the interpretation model version.

This boundary is the migration seam for the future in-house replay system. The future parser should produce the same approved interpretation inputs or a compatible successor contract rather than require league-scoring code to understand parser internals.

## League Points

The existing League Points machinery remains the launch foundation:

- rewards are computed from the canonical result and snapshotted scoring rules;
- ledger writes are revision-aware and idempotent;
- result corrections reconcile previous ledger amounts;
- League Points, War Room Points and Gold stay separate systems.

The scoring formula itself is still a product decision to complete. Statistical bonuses, if later desired, must consume explicitly approved interpretation fields and be separately versioned. They must not read raw TownBell JSON directly.

## Development-track isolation

The following remain useful but are **non-blocking for launch**:

- `replay-tools/` CanonicalReplay extraction;
- canonical replay conformance work;
- `AOF_CANONICAL_STATISTICS_V1`;
- Match Analysis experiments;
- legacy `rawStats -> derivedStats -> analysisStats` replay ingestion;
- replay-derived player aggregate and record rebuilds.

Do not delete them. Label changes to these areas as replay/statistics R&D unless they are deliberately promoted into the launch path.

## Launch-critical next work

1. Obtain representative TownBell JSON outputs for every intended launch match shape.
2. Freeze a TownBell-to-Age-of-Friends interpretation contract from those real samples.
3. Implement player identity mapping and interpretation revision processing.
4. Decide and version the League Points rules.
5. Wire approved interpretation outputs into player-facing statistics and only then into records, achievements or relationship axes that are ready for launch.
6. Keep the in-house replay/statistics system advancing independently until it meets the replacement threshold.

## Replacement rule

Replacing TownBell is an explicit migration, not an incidental refactor. Before changing the launch statistics source, the in-house system must demonstrate that it can reproduce the approved launch interpretation contract (or a deliberately versioned successor) across the supported match shapes with documented evidence limits.
