# Replay Statistics V1

This document freezes the League of Friends replay-statistics boundary for product V1.

The core rule is:

> Preserve objective replay evidence first. Derive configurable interpretations from it. Do not present unreconstructed game state as fact.

## Processing layers

```text
.aoe2record
  -> mgz-fast parser adapter
  -> immutable rawStats
  -> normalized Level 1 replay facts
  -> versioned Level 2 replay analysis
  -> achievements / records / stories / rivalry signals
```

Level 3 state reconstruction is explicitly deferred until after V1.0.

## Level 1 — Recorded / normalized facts

Level 1 contains facts directly supported by the replay header or timestamped command stream.

Current V1 target:

- replay source hash, parser version and adapter schema version
- replay duration from synchronization time
- player replay slot and mapped League Player ID
- source player name and profile ID when available in raw data
- civilization ID
- team ID
- color ID
- total player action counts by action type
- sparse per-second player action counts for APM analysis
- building-placement commands with timestamp, building ID and coordinates when available
- unit-production / queue commands with timestamp, unit ID, quantity and producing building ID when available
- research commands with timestamp and technology ID
- Feudal / Castle / Imperial research-start commands (tech IDs 101 / 102 / 103)
- market buy / sell commands with timestamp, resource ID and amount when available
- tribute commands with timestamp, target replay slot / League Player and resource amounts when available
- resignation commands and timestamps

These are objective replay facts. A command timestamp is not silently converted into a completion timestamp.

### Raw-only settings for now

Some current modern-DE replay header fields have produced suspicious zero values in real testing. Until validated across a broader replay set, map/lobby setting IDs remain raw evidence rather than normalized/queryable facts.

## Level 2 — Rebuildable analysis

Level 2 is versioned and always records the configuration profile used to produce it.

Current `REPLAY_ANALYSIS_V1` supports:

- average raw APM
- peak 30-second raw APM
- peak 60-second raw APM
- per-minute APM timeline
- Feudal / Castle / Imperial research-start timing
- first queued production by unit ID
- market buy/sell command counts
- tribute command count
- configurable Fast Feudal detection
- configurable Fast Castle detection
- configurable Fast Imperial detection
- early Militia opening candidate
- early Scout Cavalry opening candidate
- early Archer opening candidate

### Strategy naming rule

A production pattern does not prove aggression. Therefore V1 uses names such as:

- `MILITIA_OPENING_CANDIDATE`
- `SCOUT_OPENING_CANDIDATE`
- `ARCHER_OPENING_CANDIDATE`

rather than claiming a confirmed rush.

Confirmed rush/first-aggression classification can be added later if replay evidence or state reconstruction makes it reliable.

### Configurability

Replay analysis thresholds live in immutable, versioned `replayAnalysisProfiles` documents. `leagueState/singleton` points at the active profile.

Changing a threshold creates a new profile. It does not mutate replay facts or old profile documents.

Initial built-in defaults are intentionally provisional:

- Fast Feudal research start: <= 10:00
- Fast Castle research start: <= 16:00
- Fast Imperial research start: <= 30:00
- opening-candidate window: <= 15:00
- opening-candidate minimum: 2 queued units
- APM peak windows: 30s and 60s

These values are league policy, not parser truth, and may be tuned later from an admin UI.

## Level 3 — Deferred until after V1.0

The following require reliable game-state reconstruction or another proven automated source and must not be fabricated from commands alone:

- actual kills and deaths
- villager kills
- killer -> victim -> unit-type attribution
- damage dealt / taken
- building destruction attribution
- conversions as completed outcomes
- villager idle time
- Town Center idle time
- worker efficiency
- population / military / economy value curves
- resource collection / floating-resource curves
- exact unit/building completion times where not directly observable
- confirmed first aggression / confirmed rush based on actual combat

Pairwise combat attribution is a priority for post-V1 because it is particularly valuable for rivalry and Grudge generation.

## Data correction model

Replay layers remain revisioned and traceable:

```text
Replay A -> rawStats A -> Level 1 facts A -> Level 2 analysis A
Replay B -> rawStats B -> Level 1 facts B -> Level 2 analysis B
```

When Replay B replaces Replay A, A remains preserved for audit/debugging and B becomes the active chain.

## Product-use rule

Achievements, records, stories and rivalry signals must declare whether they use:

- canonical Match/result facts,
- Level 1 replay facts,
- Level 2 replay analysis,
- or (post-V1) Level 3 reconstructed facts.

A Level 2 heuristic may create a fun classification or candidate signal, but should not be worded as an objective event unless Level 1 or future Level 3 evidence supports that wording.
