# Age of Friends Replay Analysis Foundation

**Canonical replay architecture and analysis contract**  
**Status:** project foundation  
**Updated:** 13 September 2026

This document defines how Age of Friends turns an Age of Empires II: Definitive Edition replay into durable league data.

It replaces the earlier research-heavy version of this document. TownBell remains a useful public capability benchmark, but it is not the Age of Friends data model. The permanent foundation is the four-layer architecture below.

---

# 1. Core architecture

```text
.aoe2record
      ↓
1. Canonical extraction
      ↓
2. Reconstruction
      ↓
3. Match analysis
      ↓
4. Age of Friends interpretation
```

The separation is deliberate.

| Layer | Purpose | Typical outputs |
|---|---|---|
| **1. Canonical extraction** | Preserve what the replay actually contains | commands, targets, coordinates, initial objects, map tiles, queue/research/build requests, diplomacy commands, chat/camera, provenance |
| **2. Reconstruction** | Deterministically organize raw facts | entity names, ownership evidence, team/diplomacy timelines, start anchors, queue ledgers, spatial regions |
| **3. Match analysis** | Describe what happened strategically | openings, aggression, raids, coordination, support, military identity, economy/execution/map metrics |
| **4. Age of Friends interpretation** | Turn analysis into league meaning | player stats, playstyle, Gallantry/Treachery/Chivalry, relationships, portraits, achievements, War Room effects |

The most important rule is:

> **The parser must not be designed around today's statistics.**

Age of Friends should preserve enough replay evidence that a future metric can be created without needing the original replay again.

---

# 2. Canonical extraction

## 2.1 One extractor

Age of Friends uses **one complete canonical extractor per replay**.

```text
.aoe2record
      ↓
Age of Friends Canonical Extractor
      ├─ low-level replay decoder
      ├─ header / initial state extraction
      ├─ operation and action extraction
      ├─ map and object extraction
      ├─ raw evidence preservation
      └─ provenance / coverage reporting
      ↓
CanonicalReplay
```

There is not one parser for economy, another for fights, another for map control, and so on.

All downstream systems consume the same canonical evidence.

## 2.2 Decoder strategy

Age of Friends does **not** implement the AoE2 binary format from scratch.

Current production direction:

```text
mgz-fast 1.0.0
      ↓
Age of Friends extraction / normalization adapter
      ↓
CanonicalReplay 1.0
```

`mgz-fast` is the current low-level decoder. It is a dependency, not the product contract.

Age of Friends owns:

- the canonical schema;
- extraction coverage requirements;
- provenance;
- evidence classification;
- compatibility tests;
- normalization rules;
- reconstruction;
- analysis.

If `mgz-fast` later becomes inadequate, its decoder role can be replaced or supplemented without changing the CanonicalReplay contract or the higher layers.

`aoc-mgz`, TownBell, AgeAlyser and similar projects remain useful as reference implementations and differential-validation sources, not parallel production extractors.

## 2.3 Replay retention policy

Age of Friends **does not retain uploaded `.aoe2record` files after successful extraction**.

The upload flow is:

```text
player uploads replay
      ↓
hash + validate
      ↓
canonical extraction
      ↓
schema / coverage checks
      ↓
persist canonical artifacts
      ↓
delete uploaded replay
```

Players remain responsible for retaining their original replay files.

This makes canonical extraction a one-way archival boundary. Therefore P0 extraction must preserve everything that may reasonably be useful later.

## 2.4 Canonical output

The extractor currently emits a compact compatibility summary plus canonical artifacts.

Conceptually:

```text
CanonicalReplay/
  canonical-replay.json
  facts.jsonl.gz
  terrain.jsonl.gz
  initial-objects.jsonl.gz
```

The large fact stores should remain artifact data rather than being placed in one Firestore document.

---

# 3. CanonicalReplay contract

## 3.1 Root model

`CanonicalReplay 1.0` is the durable replay representation.

High-level structure:

```text
schemaVersion
versions
source
match
participants
teams
initialDiplomacy
initialState
factStore
reconstructionSets
interactionSets
metricSets
leagueInterpretationRefs
warnings
```

The canonical root identifies both the replay source and every versioned component used to interpret it.

## 3.2 Canonical event envelope

Every extracted or reconstructed event should be traceable.

Core fields:

```text
eventId
layer
eventType

timestampMs
clock

operationOrdinal
byteOffset
byteLength

sourceOperation
sourceActionCode
sourceActionName

actorPlayerId
targetPlayerId

objectInstanceIds
targetInstanceId

entity
position
endPosition

payload
decode
evidence
dependsOnEventIds
```

Not every event uses every field.

The important property is that downstream analysis can always trace a claim back to evidence.

## 3.3 Evidence classes

Age of Friends distinguishes confidence at the data-model level.

| Class | Meaning |
|---|---|
| **A — Direct** | Explicitly encoded in the replay |
| **B — Reconstructed** | Deterministically derived from direct facts |
| **C — Inferred** | Depends on a heuristic or model |
| **D — Simulation required** | Requires compatible game-engine state simulation |
| **E — Recorder-only** | Available only from the recorder's point of view |
| **F — Not honestly obtainable** | Cannot be established from available evidence |

Classes can combine, for example `A+E`, `B+E`, or `C+E`.

A value should never silently move from a weaker evidence class to a stronger one.

## 3.4 Missing-value states

Missing information is not always an error.

Use explicit states:

```text
available
not_applicable
not_observable
insufficient_evidence
parser_error
unsupported_version
```

This matters especially for teamwork in 1v1, camera metrics, unsupported replay patches and inference with insufficient evidence.

---

# 4. Truth boundaries

An AoE2 replay is primarily:

> **initial state + timed operations**

It is not an authoritative frame-by-frame dump of the game world.

The following distinctions are foundational.

## 4.1 Queue request is not unit completion

A queue action directly proves:

```text
player requested N units of type X
from producer Y
at time T
```

It does **not** prove all requested units completed.

Therefore canonical terminology uses:

- `unit_queue`;
- `queue amount`;
- `production commitment`.

Player-facing wording may later be simplified, but analytical provenance must retain the real meaning.

## 4.2 Building placement is not building completion

A build command proves a placement/order.

It does not prove:

- foundation completion;
- construction completion;
- survival;
- exact completion time.

## 4.3 Research click is not always research completion

A research command proves the research request.

For ages:

- `AgeAdvanceStarted` = research command;
- `AgeReached` = direct system event when present;
- projected completion = separate reconstructed value when needed.

Observed and projected age times must never be merged.

## 4.4 Gross commitment is not actual resource spend

Unit queues, buildings and technologies can be priced with versioned cost tables.

That supports:

> **gross planned resource commitment**

It does not directly establish:

- resources gathered;
- bank balance;
- exact net spending;
- refunds;
- affordability at each instant.

## 4.5 Commands do not prove game-state outcomes

Commands can establish intent and interaction evidence.

They do not directly establish:

- damage;
- kills;
- exact deaths;
- exact unit positions over time;
- resource collection;
- live army state;
- pathing;
- whether a command successfully completed.

Those require reconstruction with uncertainty or full game simulation.

## 4.6 Camera is recorder-only

Camera/view-lock information belongs only to the recorder's perspective.

Camera-derived metrics must carry recorder-only evidence and should not be treated as symmetric player facts.

---

# 5. P0 extraction requirements

Because Age of Friends deletes the uploaded replay, the extractor must capture the evidence future analysis could need.

## Source and provenance

Capture:

- replay SHA-256;
- file size;
- save/log/build versions;
- GUID/timestamp where available;
- parser distribution/version;
- canonical schema version;
- normalizer/entity-data versions;
- extraction warnings;
- decode coverage.

## Operation provenance

For each operation/event where available:

- operation ordinal;
- replay time;
- byte offset;
- byte length;
- operation type;
- action code/name;
- decode status;
- undecoded/unknown evidence.

## Initial state

Preserve:

- participants;
- profile/slot/civilization/color information;
- teams;
- raw initial diplomacy;
- map settings;
- dimensions;
- terrain;
- elevation;
- initial objects including Gaia;
- owner IDs;
- instance IDs;
- initial positions.

## Command/event evidence

Preserve decoded evidence for:

- sync/time;
- movement;
- generic orders;
- patrol;
- attack move;
- attack ground;
- special commands;
- stance;
- formation;
- guard/follow;
- stop;
- repair;
- delete;
- unit queue/unqueue evidence;
- research;
- build placement;
- walls and wall geometry;
- rally points;
- market buy/sell;
- tribute;
- diplomacy changes;
- flares;
- resignations;
- raw chat;
- recorder camera/view locks;
- postgame blocks;
- unknown actions.

## Selection and targeting

Preserve whenever encoded:

- selected object IDs;
- producer IDs;
- builder IDs;
- target object ID;
- target player ID;
- coordinates;
- wall endpoints;
- signed queue amount;
- raw action payload.

These fields are disproportionately valuable because they allow later player-to-player analysis.

---

# 6. Entity normalization

Raw AoE2 IDs must always remain available.

Normalization adds meaning; it does not replace raw evidence.

```text
rawEntityId
      ↓
versioned entity catalogue
      ↓
name
type
line
family
role
domain
cost / train-time metadata
```

The current analysis uses a version-pinned `aoe2techtree` dataset.

Normalized identity must therefore include an entity-data version.

Unknown IDs remain valid canonical evidence and are represented as unresolved rather than discarded.

Entity normalization supports:

- readable opening sequences;
- unit-family statistics;
- military identity;
- portrait evolution;
- spending/commitment models;
- patch-safe historical analysis.

---

# 7. Reconstruction

Layer 2 turns canonical events into deterministic structures that analysis can reuse.

Important reconstructions include:

## Time and operation ordering

Build a stable replay clock from operation order and synchronization timing.

## Team topology

Resolve fixed teams when the replay provides stable team groups.

Do not infer FFA relationships from static team IDs when dynamic diplomacy exists.

## Dynamic diplomacy

Diplomacy is a **directed time series**:

```text
A → B at time T = stance S
```

`A → B` and `B → A` are separate facts.

The tested FFA corpus contains repeated diplomacy changes and uses raw diplomacy modes `0` and `3`. Their semantic mapping must remain versioned and controlled-test validated before league scoring uses them.

## Object ownership evidence

Ownership is not treated as one immutable lookup for the full match.

Use chronological evidence from:

- initial object state;
- strong direct-control observations;
- safe future backfill;
- consistent producer evidence where appropriate.

Queue producer IDs are production evidence, not automatic proof of ownership transfer.

Ownership resolution should report both the resolved owner and the method used.

## Start anchors and home regions

Standard TC starts can anchor on the initial Town Center.

Nomad/scenario starts require an explicit method, for example:

- first Town Center;
- starting-unit centroid;
- first stable owned-object cluster.

The chosen anchor method must be stored.

## Queue / production ledgers

Queue commands can form deterministic ledgers once cancellation and producer semantics are validated.

Expected production completion remains reconstructed, not direct truth.

## Spatial regions

Raw coordinates can support:

- player home regions;
- neutral space;
- target region;
- deep target region;
- forward construction;
- wall geometry.

Raw coordinates must always remain available beneath these classifications.

---

# 8. Match Analysis V1

Match analysis consumes canonical and reconstructed facts.

It is versioned because analytical rules can improve.

Current analysis areas include:

```text
opening reconstruction
opening classification
directed player interaction
target focus
spatial pressure
raid candidates
team coordination
defensive support
tribute
dynamic diplomacy evidence
```

## 8.1 Opening reconstruction

The factual opening sequence is reconstructed from:

- building placements;
- queue events;
- research;
- age events;
- market use.

Example:

```text
07:13 Feudal Age
08:02 Barracks
09:28 Stable
10:13 Scout Cavalry queued
```

## 8.2 Opening classification

The classifier sits above factual reconstruction.

Current labels include examples such as:

- Scouts;
- Archers;
- Tower / Donjon Pressure;
- Fast Castle → Boom;
- Fast Castle → Monks;
- Water Opening;
- No-TC → Water;
- No-TC contextual opening;
- Unclassified.

Context and strategy are separate.

For example:

```text
context: NO_INITIAL_TC + WATER
strategy: FAST_CASTLE_BOOM
display: No-TC / Water → Fast Castle → Boom
```

An `Unclassified` result is preferable to inventing a confident opening.

## 8.3 Directed interaction graph

Every ordered player pair can have an interaction record:

```text
A → B
```

Possible evidence includes:

- direct targeted commands;
- target-focus share;
- target-region activity;
- deep-region activity;
- forward buildings;
- forward walls;
- raids;
- tribute;
- diplomacy changes.

This is the foundation for future Rival/Friend/Enemy relationships.

## 8.4 Raid detection

A raid is an analytical event, not a parser fact.

A candidate should contain:

```text
attackerPlayerId
targetPlayerId
startMs
endMs
location
attackingObjectIds
targetObjectIds
hostileCommandCount
targetRegionDepth
confidence
sourceEventIds
```

Evidence quality is explicit:

```text
high
medium
low
```

Relationship scoring should eventually use high-confidence events and, if desired, discounted medium-confidence events.

Dynamic-diplomacy FFA currently caps raid confidence until stance intervals are fully reconstructed.

## 8.5 Team interaction

Teamwork evidence can include:

- coordinated attacks on the same enemy object/cluster;
- tribute;
- shared engagements;
- defensive response;
- flares as contextual evidence.

Teamwork is **not applicable**, rather than zero, where no allied-team context exists.

---

# 9. Validated corpus status

The current canonical extractor and `MATCH_ANALYSIS_V1_4` have been exercised across a deliberately varied replay corpus.

Validated fixture classes include:

- 1v1;
- 2v2 Nomad;
- 3v3;
- 4v4;
- dynamic-diplomacy FFA;
- multiple-team configuration;
- 8-player Nomad;
- water/team game.

All current fixtures pass the corpus harness.

Key validated behaviors:

- modern DE save-version parsing;
- 2–8 participants;
- standard and no-TC starts;
- large maps;
- terrain/object extraction;
- queue producer attribution;
- research producer attribution;
- build builder attribution;
- wall geometry;
- water production;
- fixed-team topology;
- dynamic-diplomacy detection;
- entity normalization;
- semantic opening classification;
- directed target interaction;
- raid-confidence grading;
- team coordination/support evidence.

Current combat-target owner resolution varies by fixture and is incomplete by design. High-confidence analysis should use resolved evidence rather than guessing unresolved targets.

The corpus is a gate, not proof that every future patch or custom scenario is supported.

---

# 10. Fundamental statistics

Age of Friends player statistics should be projections from Match Analysis, grouped into four detailed families.

## Economy

Candidate fundamentals:

- age timings;
- villager queue activity;
- TC production continuity;
- economy technologies;
- farms/economic buildings;
- market use;
- tribute;
- gross economic commitment.

Do not represent queue requests as guaranteed completed villagers.

## Military

Candidate fundamentals:

- military queue activity;
- exact unit IDs;
- unit lines/families;
- military production buildings;
- military technologies;
- army-choice distribution;
- gross military commitment;
- directed aggression;
- raid evidence.

These inputs also drive persistent military identity and portraits.

## Map Presence

Candidate fundamentals:

- building coordinates;
- walls;
- forward structures;
- target-region activity;
- deep pressure;
- expansions;
- docks/water presence;
- spatial interaction with specific opponents.

"Map control" should only be used when the exact model is declared.

## Execution

Candidate fundamentals:

- raw actions;
- effective-action model;
- command breadth;
- production gaps;
- command batching;
- selection behavior;
- rally/formation/stance usage;
- opening execution;
- activity gaps.

Execution metrics are versioned analytical models, not parser truth.

---

# 11. Higher-level analysis

## Performance

Focused Performance can eventually summarize:

- Economy;
- Production;
- Map Presence;
- Execution;
- Teamwork.

The score model must be separate from raw fundamentals so it can be rebalanced without replay reprocessing.

## Playstyle

Possible visible axes:

- Peaceful ↔ Aggressive;
- Economic ↔ Military Investment;
- Open ↔ Fortified;
- Self-Sufficient ↔ Market-Dependent;
- military-family identity;
- opening identity.

Playstyle should summarize repeated evidence across matches, not overreact to one game.

## Reputation

Visible player reputation:

- **Gallantry**
- **Treachery**
- **Chivalry**

Reputation describes a player.

It is distinct from pairwise relationships.

---

# 12. Social relationship foundation

Relationship evidence is directional and pair-specific.

```text
A → B ≠ B → A
```

Examples:

## Rivalry-like evidence

- repeated competitive encounters;
- rematches;
- balanced pressure;
- reciprocal targeting;
- repeated direct engagements.

## Enemy-like evidence

- concentrated target focus;
- raids;
- repeated forward pressure;
- diplomacy reversals;
- hostile actions after cooperation;
- persistent one-sided targeting.

## Friend-like evidence

- tribute;
- defensive support;
- coordinated attacks;
- shared engagements;
- repeated allied assistance.

The analysis layer should emit evidence.

The relationship engine decides whether that evidence progresses:

- Rivalry;
- Enemy;
- Friend.

Do not place relationship thresholds inside replay analysis.

---

# 13. Persistent player identity

Portrait identity should use military-family evidence over time.

Per-match inputs may include:

```text
exact units requested
unit lines
tactical families
roles
domain
military commitment
opening
recent usage
lifetime usage
```

Persistent identity should use:

- minimum sample sizes;
- recency weighting;
- confidence;
- hysteresis.

A single unusual match should not immediately replace an established portrait identity.

Portrait state is Layer 4 interpretation, not canonical replay data.

---

# 14. Persistence model

## Canonical artifacts

Large immutable evidence stores belong in artifact/blob storage.

Examples:

- canonical fact stream;
- terrain;
- initial objects;
- future large reconstruction sets.

Each artifact should be content-addressed or integrity-hashed.

## Firestore

Firestore should contain query-friendly lightweight records:

```text
matches
players
player match summaries
pair interaction summaries
metric projections
relationship state
records / leaderboards
```

Do not place the full replay event stream into one Firestore document.

## Derived-data references

Every derived output should identify the versions that produced it, for example:

```text
canonicalSchemaVersion
extractorVersion
decoderVersion
entityDataVersion
reconstructionVersion
analysisVersion
metricVersion
leagueModelVersion
```

---

# 15. Reanalysis rules

The architecture is designed so different changes have different costs.

## Decoder/parser-format change

Requires replay reprocessing.

Because Age of Friends deletes uploaded replays, unsupported or incomplete extraction must **fail before the upload is discarded**.

## Canonical schema change

May require migration or replay reprocessing depending on whether the old canonical evidence contains the newly required primitive.

## Entity normalization change

Re-run normalization/reconstruction from canonical facts.

## Reconstruction change

Re-run reconstruction and dependent analysis.

## Match-analysis change

Re-run analysis from canonical/reconstructed data.

## League/stat model change

Re-run Layer 4 only.

This is the primary reason for preserving canonical facts instead of only final metrics.

---

# 16. Compatibility and quality gates

Replay support is a product subsystem.

Every extraction should produce a coverage report containing, at minimum:

- parser success/failure;
- replay/save/build version;
- operation counts;
- action counts;
- unknown action codes;
- decode failures;
- canonical fact counts;
- artifact hashes;
- attribution coverage;
- warnings.

A replay is accepted only when its extraction meets the supported-version quality gate.

"Parser returned JSON" is not sufficient.

---

# 17. Test strategy

## Golden corpus

Maintain representative fixtures for:

- standard 1v1;
- team games;
- 4v4;
- Nomad/no-TC;
- water;
- FFA;
- dynamic diplomacy;
- unusual team layouts;
- new game patches.

## Controlled fixtures

Create short controlled games for individual semantics where needed:

- queue then cancel;
- multi-producer queue;
- building placement/cancel/delete;
- age click/reach;
- diplomacy modes;
- tribute;
- conversions;
- market buy/sell;
- wall placement;
- garrison/ungarrison;
- resign/postgame;
- patched/new entity IDs.

## Three verification levels

### Extraction verification

Did the canonical extractor preserve what the replay encoded?

### Reconstruction verification

Do deterministic reconstructions match known controlled behavior?

### Analysis verification

Do heuristic events such as raids/openings/support correspond to what a human observer would call them?

These should not be collapsed into one generic "parser test."

---

# 18. Current known limitations

The foundation is intentionally honest about unresolved areas.

Current important limitations include:

1. **Queue completion** — queue requests are observable; exact completed-unit totals are not yet canonical truth.
2. **Queue cancellation semantics** — signed amounts are preserved, but controlled validation remains necessary.
3. **Spawned-object identity/ownership** — target ownership is resolved with evidence but remains incomplete.
4. **FFA diplomacy semantics** — raw modes and changes are captured; full stance interval semantics need controlled validation.
5. **Raids/fights** — analytical inference requires validation and confidence thresholds.
6. **Full game-state metrics** — exact kills, damage, live army, resource banks and collection require game simulation or another authoritative source.
7. **Entity catalogue coverage** — unknown or new patch entities must remain unresolved rather than guessed.
8. **Custom scenarios/mods** — may require special compatibility rules.
9. **Recorder camera** — only represents the replay recorder's viewpoint.

None of these limitations invalidate the four-layer architecture.

---

# 19. What TownBell contributes

TownBell remains valuable as a **capability benchmark**.

It demonstrates that `.aoe2record` files can support a rich deterministic analytical layer including:

- openings;
- production timing;
- economy continuity proxies;
- command-priced commitment;
- walls and forward construction;
- camera analysis;
- map overlays;
- fight/raid heuristics;
- input/mechanics metrics;
- longitudinal comparison.

Age of Friends should reproduce or exceed useful capabilities independently where they serve the league.

TownBell's metric catalogue is **not** the canonical schema.

The lesson is:

> Hundreds of useful metrics can be projections of a much smaller, reusable evidence model.

---

# 20. Engineering acceptance criterion

The strongest test of the architecture is:

> **After canonical extraction, assume the original replay is permanently unavailable. Can Age of Friends implement a completely new statistic using only stored canonical evidence?**

If yes, the extraction foundation is doing its job.

If a reasonable new statistic requires the replay again, determine whether the missing primitive belongs in canonical extraction.

This criterion should be applied before the parser/extractor is considered launch-ready.

---

# 21. Current project state

As of this document update:

```text
Canonical extraction   ✅ implemented and corpus-tested
Reconstruction         ✅ core foundation implemented
Match analysis         🟡 V1 implemented and being calibrated
League interpretation  ⏭ downstream product work
```

Current validated direction:

- one Age of Friends canonical extractor;
- `mgz-fast` as the replaceable low-level decoder;
- `CanonicalReplay 1.0` as the durable internal contract;
- canonical artifacts retained;
- uploaded replay deleted after successful extraction;
- versioned entity normalization;
- versioned reconstruction and match analysis;
- confidence-aware interaction inference;
- league systems kept outside replay truth.

---

# 22. Near-term engineering priorities

The next replay-analysis work should be incremental rather than another parser redesign.

Priority order:

1. validate and lock dynamic-diplomacy mode semantics;
2. calibrate high-confidence raid events against known games;
3. validate queue cancellation/net-ledger behavior;
4. expand entity-role coverage;
5. project the canonical/analysis layer into the V1 player statistics;
6. connect high-confidence pair evidence to the relationship engine;
7. preserve reanalysis/version provenance throughout persistence.

Do not add league scoring directly to the parser.

---

# 23. Companion artifacts

The replay foundation is defined jointly by this document and versioned machine-readable artifacts in the repository.

Important companions include:

```text
canonical-replay-v1.schema.json
replay-tools/parse_replay.py
replay-tools/entity-catalog/
functions/src/engines/matchAnalysis.ts
scripts/test-replay-corpus.mjs
scripts/test-match-analysis-corpus.mjs
scripts/build-aoe2-entity-catalog.mjs
```

The schema and tests are authoritative when prose and implementation details diverge.

The documentation should be updated whenever a deliberate architectural decision changes the contract.
