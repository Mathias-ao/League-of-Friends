# Canonical Statistics V1 eligibility milestone

Date: 13 September 2026. This milestone defines a conservative, replay-free statistics projection over verified CanonicalReplay 1.1 bundles. It does not freeze the player-facing product, change league interpretation, or qualify upload deletion.

## Implemented contracts

| Contract | Version | Purpose |
|---|---|---|
| Eligibility registry | `AOF_STATISTICS_ELIGIBILITY_V1` | Preserves every row and column of the 320-row TownBell matrix and gives each metric one explicit eligibility decision. |
| Statistics schema | `1.0.0` | Validates the replay-free statistics envelope. Its SHA-256 is embedded in every output. |
| Statistics projector | `AOF_CANONICAL_STATISTICS_V1` | Reads canonical artifacts only and emits scoped command evidence, participant command summaries, coverage and warnings. |
| Formula set | `AOF_OBSERVED_COMMAND_FORMULAS_V1` | Defines command count, first/last command, first-five-observed-minutes, active seconds, rate and selection-size summaries. |
| Build-order classifier | `AOF_BUILD_ORDER_V1` | Classifies a player's primary opening from age, placement, production and start-position evidence while retaining candidate scores and trigger evidence. |
| Entity labels | `AOF_ENTITY_CATALOG_V1_1` | Adds reference names and role keys while retaining raw IDs. Labels are explicitly unqualified for the replay patch/data mods. |
| Corpus report | `AOF_STATISTICS_CORPUS_V1` | Produces privacy-minimized comparable totals across canonical bundles. |

The registry is built deterministically from `docs/replay-foundation/townbell-capability-matrix.csv`. It is not an assertion that all TownBell metric names are supported. The current classification is deliberately conservative:

| Eligibility | Count | Meaning |
|---|---:|---|
| `available_canonical` | 13 | An observed-interval command definition can be projected now without implying an outcome. |
| `inferred_with_confidence` | 25 | Canonical evidence is sufficient, but a separately versioned formula or heuristic must be selected. |
| `needs_controlled_fixture` | 59 | The relevant payload is present, but semantics, success or attribution still need a controlled recording. |
| `needs_parser_research` | 125 | Required fields or meanings are not qualified in the canonical parser. |
| `needs_engine_simulation` | 98 | The name implies completed/effective game state that commands do not establish. |

These counts and decisions are versioned; they may change only in a successor registry backed by new evidence.

## Recalculable now without a replay

The projector calculates the following directly from the canonical operation store:

- source/canonical identities and parser/schema/catalog versions;
- observed synchronization-clock duration and decode coverage;
- decoded player ACTION count by raw action name, first/last time, first-five-observed-minutes count, active command seconds and a declared observed-interval rate;
- raw selection-size samples and summaries;
- queue request-command counts by participant/raw unit, positive encoded amounts, signed/null evidence through the compatibility timeline, and request times;
- research request-command counts by participant/raw technology and request times;
- building-placement command counts by participant/raw building, positions, builders and times;
- market, tribute, resignation and flare command timelines;
- directed actor-to-target diplomacy-command timelines with raw mode and source order;
- recorder-only camera-point counts;
- catalog reference labels and role keys without replacing raw IDs or claiming patch/mod compatibility.

Age-advance request candidates remain distinct from `AgeAdvanceStarted`, observed `AgeReached`, and projected completion. The latter three remain unavailable. Queue requests are never described as trained or completed units, and building placement is never described as completed construction.

## Candidate player-facing V1 set (not frozen)

The smallest reviewable product candidate is:

1. recorded command count and action-type breadth for the observed interval;
2. first recorded command time and commands in the first five observed minutes;
3. raw selection-size summaries;
4. queue requests, research requests and building-placement orders, using those exact names;
5. market-command and flare-command counts;
6. resignation command time when present;
7. directed diplomacy-command history for FFA evidence, with no inferred mutual state;
8. inferred Build Order from `AOF_BUILD_ORDER_V1`, displayed only when its execution score is strictly greater than 75.

Observed command rate, inactivity, APM variants, broader opening/playstyle labels and recorder-camera measures should remain internal until formula, completeness and comparability policies are selected. Reference entity names may be displayed only alongside raw IDs or after patch/mod qualification.

## Build Order inference: `AOF_BUILD_ORDER_V1`

For the current player-facing model only, age-up timings, building placements and positive queued-unit amounts are treated as direct inputs to the inferred Build Order statistic. This does not change their canonical evidence classification elsewhere.

The classifier currently emits `Drush`, `Scout Rush`, `Archer Rush`, `Tower Rush`, `Fast Castle`, `Boom`, `Naval Rush`, `Fish Boom`, or `N/A`. Man-at-Arms openings are intentionally included in the `Drush` bucket. The starting Scout never counts toward Scout Rush because only newly queued Scouts are considered.

Each detected candidate receives an execution score from 0-100. A candidate must score strictly greater than 75 to be eligible for the player-facing label. Candidate precedence is 70% execution score plus 30% versioned difficulty score; the full candidate list, trigger time and evidence are retained in the output. A qualifying Fast Castle explicitly takes precedence over Boom.

Fast Castle scoring is 100 at or before 14:00, declines linearly to 75 at 17:00, and can never qualify above 18:00. Because qualification is strictly greater than 75, a 17:00 Fast Castle is retained as a 75-point candidate but displayed as `N/A` unless another opening qualifies.

Tower Rush requires both early timing and spatial pressure. The classifier reconstructs a starting anchor from an initial Town Center when available, with an initial-owned-object centroid fallback. A tower at eight tiles or less from the nearest enemy start anchor receives full proximity credit; 16 tiles is the outer zoning boundary, and a tower at or beyond that boundary does not qualify on proximity. This is intended to exclude ordinary defensive/home towers while allowing direct or indirect enemy economic zoning.

Boom requires two additional Town Center placements shortly after Castle Age. Naval Rush requires early Dock commitment plus at least two military-water unit requests. Fish Boom requires an early Dock plus at least three Fishing Ship requests and competes with other qualified candidates through the same precedence model.

All thresholds, difficulty values, execution scores and precedence rules are model parameters, not replay facts. Changing them requires a successor rule version if historical outputs must remain reproducible.

## Remaining research boundary

- **Controlled fixtures:** action-subtype layouts; queue/cancel/requeue/autoqueue; research acceptance/cancel; construction cancel/delete/completion; market execution; tribute/fees; unilateral diplomacy and effective state; age notifications; pause/chat attribution; restored clocks and clean result termination.
- **Parser research:** exhaustive initial objects, command selection reuse, unread payload spans, map/lobby/header fields, recorder attribution and mod/entity-data identity.
- **Engine simulation or equivalent telemetry:** trained/completed/live units, completed buildings/research without direct evidence, population, resources, net spend/refunds, army value, damage, kills/deaths, visibility, pathing, positions and combat outcomes.

## Verification evidence

The self-contained golden test disables replay parsing while projecting the synthetic canonical bundle, validates the statistics schema, preserves raw IDs next to unqualified labels, and freezes age/diplomacy/request distinctions. The opt-in real replay harness now also compares `AOF_STATISTICS_CORPUS_V1` summaries.

Build Order has dedicated synthetic regression coverage for the 14:00/17:00/18:00 Fast Castle boundaries, Fast Castle-over-Boom precedence, Man-at-Arms inclusion in Drush, forward-versus-defensive Tower Rush qualification, and the requirement for two newly queued Scouts.

On the stored canonical bundles, the projector reproduced the expected aggregate evidence for the FFA, upstream duel, and both ordinary 1v1 perspectives without reopening any `.aoe2record`. The two ordinary 1v1 projections agree on all shared totals (5,168 decoded player actions, 367 queue requests, 56 research requests, 226 building placements, five market commands and one resignation); recorder-only camera evidence remains separately scoped.

Run:

```bash
python replay-tools/statistics_registry.py --out eligibility.json
python replay-tools/statistics_projector.py path/to/canonical --out statistics.json
python replay-tools/statistics_corpus.py --bundle fixture=path/to/canonical --out corpus.json
```

The next smallest engineering milestone remains the controlled current-build two-recorder action protocol. Its first objective is to move narrowly proven rows from `needs_controlled_fixture` to a successor eligibility registry, not to reinterpret every retained command.
