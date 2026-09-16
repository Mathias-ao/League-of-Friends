# TownBell Launch Statistics Strategy

Status: V1 ingestion settled, 16 September 2026

## V1 workflow

The launch statistics workflow is:

```text
Match
  -> TownBell JSON report
  -> Age of Friends interpretation
  -> additional inferred statistics
  -> points / relationship systems
```

Only the **TownBell JSON report ingestion layer** is settled by this document.

Interpretation, additional inferred statistics, points formulas and relationship formulas are deliberately left for later decisions. Ingestion must not anticipate those decisions by normalizing TownBell fields into Age of Friends metrics or by writing any points or relationship state.

The in-house `.aoe2record` extraction, CanonicalReplay, replay-free statistics projection and Match Analysis work remains a separate research and development track. It is not required for launch ingestion and must not silently enter the V1 launch path.

## TownBell report contract

The stored launch-source contract is **`TOWNBELL_REPORT_V1`**.

It accepts the TownBell report shape demonstrated by the supplied 1v1, 2v2, 3v3 and 4v4 samples:

- TownBell `schema_version: 2`;
- top-level `meta`, `catalog`, `categories`, `players` and `charts` sections;
- exactly 320 catalog metrics;
- the ordered categories `opening`, `economy`, `military`, `combat`, `map_control`, `tempo`, `mechanics`;
- player report keys matching the players declared in `meta.players`;
- each player carrying all 320 catalog metric ids;
- exactly one POV player matching `meta.pov_number`;
- TownBell source metadata including game GUID, duration, save version, game build, entity-data version and played-at time.

This is a source-report contract, not an Age of Friends statistics contract. The 320 TownBell metric names remain TownBell source fields until a later interpretation version explicitly adopts or transforms them.

## Game binding

An administrator chooses the Age of Friends Match and Game to which a TownBell report belongs.

The Game association is the authoritative Age of Friends binding. TownBell's `meta.guid` is retained as source identity and audit metadata, but it is not used as the Age of Friends `gameId`.

`TOWNBELL_REPORT_V1` does not require a replay SHA-256 because the supplied TownBell reports do not contain one. If a future upload flow can independently bind a replay hash to both the Game and TownBell run, that can be added as separate provenance without redefining the report itself.

## Validation and preservation

The backend validates structure rather than interpreting metric meaning.

For V1 it verifies:

1. supported TownBell schema version;
2. required top-level sections;
3. the fixed seven-category vector;
4. the 320-entry catalog with unique metric ids and required catalog descriptors;
5. 2–8 declared players with unique player numbers;
6. `players` keys matching the declared player numbers;
7. every player metric map containing exactly the catalog's 320 metric ids;
8. each metric record containing a `value` field, allowing TownBell's null/unavailable values to pass through unchanged;
9. exactly one POV player matching `meta.pov_number`;
10. required game/source metadata and JSON safety limits.

Validation deliberately does **not** decide whether a TownBell metric is accurate, useful, player-facing, inferred, or eligible for points/relationships. Those are interpretation-layer decisions.

## Identity and deduplication

The report is canonicalized by recursively sorting JSON object keys while preserving array order. Age of Friends calculates:

- `reportHash`: SHA-256 of the complete canonical report JSON;
- `catalogHash`: SHA-256 of the canonical 320-metric catalog.

`reportHash` is the immutable report identifier inside a Game.

Re-ingesting the same active report is a no-op. A different valid report for the same Game creates a new revision and supersedes the previous active report. Historical report revisions remain immutable and auditable.

Reactivating an older superseded report is not an implicit ingestion operation; if that is ever required it should be an explicit administrative correction workflow.

## Storage

Reports are stored under:

```text
matches/{matchId}/games/{gameId}/townBellReports/{reportHash}
```

The complete canonical TownBell report is gzip-compressed and base64-encoded for storage. The report document also stores lightweight indexed/audit metadata:

- Match and Game ids;
- report revision;
- report and catalog hashes;
- optional source filename;
- TownBell schema version;
- TownBell GUID;
- duration, save version and game build;
- entity-data version and played-at time;
- POV player number;
- TownBell degraded state;
- reported-player summaries containing TownBell player number, name, profile id, team id, civilization and winner/POV flags;
- canonical/compressed payload sizes;
- importer and timestamp;
- superseded report id when applicable.

The active report is referenced from the Game with `activeTownBellReportId` and `launchStatisticsSource` metadata.

The initial callable is **`adminIngestTownBellReport`**.

## Layer states

Successful ingestion finishes only the source-report layer:

```text
TownBell ingestion:          COMPLETE
Age of Friends interpretation: NOT_STARTED
Additional inferred stats:    NOT_STARTED
Points / relationships:       not run from ingestion
```

Ingestion must never invoke scoring, relationship progression, achievements, records or inferred-statistics processors.

## Later interpretation boundary

When interpretation is designed, it must consume a specific active `TOWNBELL_REPORT_V1` revision and emit a separately versioned Age of Friends artifact. It may map TownBell player identities to durable `playerId` values, select trusted metrics, rename units, add qualification rules and represent unavailable states.

Additional inferred statistics must be a further layer after interpretation. They must identify the interpretation revision/model they consume and must not overwrite source-report data.

Points and relationship systems sit after those layers in the V1 workflow. Their formulas, eligible inputs and revision/rebuild behavior remain intentionally unsettled.

## Sample basis for V1

The ingestion contract was frozen against TownBell reports produced from the repository's existing 1v1, 2v2, 3v3 and 4v4 replay fixtures. See [`townbell-report-v1-sample-audit.md`](townbell-report-v1-sample-audit.md).

These samples establish the accepted report envelope for those shapes. They do not by themselves qualify FFA, dynamic diplomacy, asymmetric teams, unusual victory modes or future TownBell schema versions.

## In-house statistics R&D

The following remain useful but are outside V1 launch ingestion:

- `replay-tools/` CanonicalReplay extraction;
- canonical replay conformance work;
- `AOF_CANONICAL_STATISTICS_V1`;
- Match Analysis experiments;
- legacy `rawStats -> derivedStats -> analysisStats` replay ingestion;
- replay-derived player aggregate and record rebuilds.

Do not delete them. Promotion into the launch path requires an explicit later decision and must preserve the same layer separation.
