# Canonical Statistics V1 eligibility milestone

Date: 13 September 2026. This milestone defines a conservative, replay-free statistics projection over verified CanonicalReplay 1.1 bundles. It does not freeze the player-facing product, change league interpretation, or qualify upload deletion.

## Implemented contracts

| Contract | Version | Purpose |
|---|---|---|
| Eligibility registry | `AOF_STATISTICS_ELIGIBILITY_V1` | Preserves every row and column of the 320-row TownBell matrix and gives each metric one explicit eligibility decision. |
| Statistics schema | `1.0.0` | Validates the replay-free statistics envelope. Its SHA-256 is embedded in every output. |
| Statistics projector | `AOF_CANONICAL_STATISTICS_V1` | Reads canonical artifacts only and emits scoped command evidence, participant command summaries, coverage and warnings. |
| Formula set | `AOF_OBSERVED_COMMAND_FORMULAS_V1` | Defines command count, first/last command, first-five-observed-minutes, active seconds, rate and selection-size summaries. |
| Build-order classifier | `AOF_BUILD_ORDER_V2` | Classifies a player's primary opening from age, placement, production and start-position evidence while retaining versioned execution/difficulty scores and trigger evidence. |
| Raid detector | `AOF_RAID_DETECTION_V1` | Counts directional hostile-command episodes inside time-aware enemy economic zones while retaining attacker, victim and episode evidence. |
| Economy statistics | `AOF_ECONOMY_STATISTICS_V4` | Projects queue-derived Villager checkpoints, TC placement/activity, eco-tech, Farm, market, food-animal interaction and 20-minute commitment metrics while retaining evidence boundaries. |
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
8. inferred Build Order from `AOF_BUILD_ORDER_V2`, displayed only when its execution score is strictly greater than 75;
9. inferred Combat counts `Raids initiated` and `Raids against you` from `AOF_RAID_DETECTION_V1`.

Observed command rate, inactivity, APM variants, broader opening/playstyle labels and recorder-camera measures should remain internal until formula, completeness and comparability policies are selected. Reference entity names may be displayed only alongside raw IDs or after patch/mod qualification.

## Build Order inference: `AOF_BUILD_ORDER_V2`

For the current player-facing model only, age-click requests, inferred age-up timings, building placements and queued-unit amounts are used by opening statistics and Build Order inference. `AOF_OPENING_STATISTICS_V5` selects the latest observed request for each age and infers completion as Feudal +130s, Castle +160s and Imperial +190s. `Villagers before Feudal age` no longer treats all queued Villagers as completed. It starts from replay-observed initial Villagers and projects the starting Town Center queue through the selected Feudal click, including decoded positive/negative queue amounts, Loom occupancy, Villager training time, population blocking, projected population-building completion and supported civilization modifiers. The canonical initial-object store remains parser evidence and may be incomplete (`HEADER_OBJECT_SEARCH_NOT_EXHAUSTIVE`). For a qualified one-TC Dark Age start, if decoded starting Villagers/population fall below the civilization's standard opening baseline, Opening V5 uses that baseline as an inferred floor while retaining the lower observed counts for diagnostics. Unknown queue quantities, no starting Town Center or multiple starting Town Centers make the metric unavailable rather than guessed. With exactly one observed starting Town Center, pre-Feudal Villager and Loom commands are assigned to that sole producer even when decoded producer instance IDs do not equal the header's starting-TC instance ID; those IDs remain diagnostic evidence rather than a hard filter. House/Folwark completion remains inferred from placement time, decoded builder count and nominal construction time; walking, retasking, destruction, resource starvation and exact engine queue acceptance are not observable. This does not change canonical evidence classification elsewhere.

The classifier emits `Drush`, `Scout Rush`, `Archer Rush`, `Tower Rush`, `Fast Castle`, `Boom`, `Naval Rush`, `Fish Boom`, or `N/A`. Man-at-Arms openings are intentionally included in the `Drush` bucket. The starting Scout never counts toward Scout Rush because only newly queued Scouts are considered.

Every archetype has an explicit execution profile. Each required component receives 100 at or before its perfect threshold and 75 at its cutoff; a multi-component opening uses the weakest required component as its execution score. A candidate must score strictly greater than 75 to be eligible for the player-facing label. Candidate precedence is 70% execution score plus 30% difficulty score. Difficulty is versioned as: Tower Rush 65, Drush 90, Naval Rush 70, Fast Castle 50, Archer Rush 80, Boom 35, Scout Rush 60, Fish Boom 40. A qualifying Fast Castle explicitly takes precedence over Boom.

Fast Castle scoring is 100 at or before 14:00, declines to 75 at 17:00, and can never qualify above 18:00. Tower Rush requires both early timing and spatial pressure; eight tiles or less from an enemy start anchor receives full proximity credit and 16 tiles is the outer zoning boundary. Boom requires two additional Town Center placements shortly after Castle Age. Naval Rush requires early Dock commitment plus at least two military-water unit requests. Fish Boom requires an early Dock plus at least three Fishing Ship requests.

All thresholds, difficulty values, execution scores and precedence rules are model parameters, not replay facts. Changing them requires a successor rule version if historical outputs must remain reproducible.

## Raid inference: `AOF_RAID_DETECTION_V1`

The player-facing Combat statistics are `Raids initiated` and `Raids against you`. Each raid episode has exactly one attacker and one victim. This is required even in FFA and other matches with more than two players; ambiguous victim attribution is discarded rather than guessed.

The model builds time-aware economic zones around observed economic infrastructure. Initial Town Centers/economic objects are active from time zero. Later economic building placements expand that player's zone from the placement timestamp. Current radii are 14 tiles around Town Centers, 10 tiles around other economic buildings, and 6 tiles around Farms. These zones describe local economic activity areas, not map ownership or visibility.

A command can contribute to a raid only when its recorded target/destination position is inside an enemy economic zone. `DE_ATTACK_MOVE` and `ATTACK_GROUND` are strong hostile signals. `ORDER` is strong when it targets an initial object whose owner is known to be the victim. `MOVE`, `PATROL`, and untargeted positional `ORDER` are supporting signals only and cannot create a raid by themselves.

Victim resolution first uses known target-instance ownership when that target is inside its owner's economic zone. Otherwise it uses the uniquely nearest eligible enemy economic zone. Teammates are excluded. If two enemy zones are too close to distinguish (within a two-tile distance margin), no victim is assigned and the command is not counted as raid evidence.

Observations for the same attacker→victim pair are grouped into one episode while consecutive evidence remains within 60 seconds. An episode counts as a raid only if it contains at least one strong hostile signal. The output retains the attacker, victim, start/end times, command types, strong/supporting command counts, evidence event IDs and victim-resolution methods.

This model does **not** claim that damage occurred, that a unit reached the destination, that villagers were killed, or that the raid succeeded. It is a deterministic inference over hostile command evidence inside reconstructed economic zones.

## Economy inference: `AOF_ECONOMY_STATISTICS_V1`

Economy V1 deliberately mixes three clearly labeled evidence classes. Farm/TC placement and market-command counts/times are observed commands. Villager checkpoints, economic-technology completion and resource commitment are reconstructions from decoded request quantities and pinned nominal timings/costs. TC idle/gap measures and Gaia-food-source measures are inferences.

`Villagers trained` follows the TownBell-control convention: it is the sum of positive decoded Villager queue amounts. It is not an engine completion claim. `Villagers by 20 minutes` starts from the same qualified civilization-aware starting baseline used by Opening V5 and applies net decoded Villager queue amounts through 20:00; survival, deaths and exact queue completion are not available.

TC count/timing uses qualified starting TC evidence plus Town Center placement commands. The catalog contains multiple raw Town Center IDs, so Economy V1 recognizes the reference name or `town_center` role rather than only one raw ID. First-extra and third-TC times are placement times. Dark-Age TC idle time models nominal starting-TC workload through the latest Feudal click from Villager queue work and Loom. Longest idle gap / gaps over 30s use decoded producer-object streams and remain inference because producer identity, multi-selection queue distribution, population blocking, resource starvation, cancellation semantics and exact engine acceptance are not fully qualified. `AOF_TC_ACTIVITY_V2` restricts research workload to technologies actually researched at a Town Center (age advances, Loom, Wheelbarrow, Hand Cart, Town Watch and Town Patrol); V1 incorrectly allowed all economy research and could turn Mill/Lumber/Mining research gaps into false TC idle gaps.

Economic technology output uses an explicit DE economic-tech set including Coinage, Banking, Guilds and Caravan. V3 uses the latest observed request for normal one-time economic technologies. A normal technology cannot be successfully researched twice in standard play; therefore a later request is treated as superseding an earlier cancelled/failed attempt. Nominal research duration remains a separate inferred completion. `Eco upgrades by Castle` excludes Loom and compares each technology's latest request against the latest Castle click. `Farms before Horse Collar` uses the latest Horse Collar request; `Farms before Castle` uses the latest Castle click.

Market transaction count/type/time is decoded command evidence. The decoded BUY/SELL `amount` is a count of 100-resource lots, so V2 reports market resource volume as `sum(abs(amount)) × 100`; it does not simulate dynamic prices, fees or gold proceeds.

Food-animal metrics are conservative interaction proxies. Economy V3 recognizes DE-family raw object IDs for Wild/Iron Boar/Javelina, Deer, and a conservative Sheep/Turkey livestock set, then counts distinct initial objects targeted by player ORDER commands. When target instance identity is unresolved, it may resolve an ORDER to a known food object only when the recorded target position is within 1.5 tiles and is not spatially ambiguous. These metrics do not claim kills or food gathered. Because canonical initial-object extraction is currently non-exhaustive, the counts may undercount and expose coverage diagnostics.

`Economy Buildings` groups economic construction intent by function. Mill includes Folwark; Dock includes Harbor; Feitoria is recognized through the DE catalogue identity/internal name. Farm, Mill/Folwark, Dock/Harbor, Mining Camp, Lumber Camp, Market, Town Center and Feitoria use observed BUILD placement commands. Fish Trap is different in the replay protocol and uses net decoded `GAME` `fishtrap_queue` minus `fishtrap_unqueue` amounts. Starting Town Centers are excluded from this placement/request metric. None of these counts claim construction completion or survival.

The 20-minute eco:military ratio prices classified queue/research/build-placement requests using the pinned base entity catalog and excludes age-up costs. It retains unclassified/unpriced commitment separately; it is not resources gathered, floated or exact spend.

## Military production: `AOF_MILITARY_STATISTICS_V2`

Military V2 is intentionally command-derived. `Military units trained` follows the same review convention as the Villager metric: positive decoded queue amount, not observed completion. Negative queue amounts are retained separately as cancellation/backorder evidence. `Military Unit Commitment` prices only positive military unit queue requests. `Military Spend` is the broader TownBell-control comparison metric: positive military unit queues plus non-economic building/wall placements and non-age/non-economic technology requests, all at pinned base-catalog cost. Both remain commitment estimates rather than exact engine spend.

Unit composition is classified from raw unit ID evidence plus two reference signals: catalog unit roles and decoded DE queue producer-building type. The latter is preserved in canonical `_rawLayout.buildingTypeIdRaw` and promoted by `AOF_REPLAY_ANALYSIS_V2` into `productionEvents.producerBuildingTypeId` before raw payload bytes are stripped. Barracks, Archery Range, Stable, Siege Workshop, Monastery, Castle/Donjon/Krepost and Dock queues provide fallback production context when the pinned entity catalog has incomplete upgraded/unique-unit labels. Known Villager/Fishing/Trade/Transport economic roles are excluded. Unknown Dock units are not automatically called warships; only catalog-qualified water military queues enter the Warship bucket.

First production timings are queue-request times. Military building counts/timings are BUILD placement commands, not construction completion or survival. `Military buildings at Castle click` uses the latest observed Castle research request as its boundary.

Production diversity is a simple count of distinct positively queued raw military unit IDs. It is not mapped to TownBell `composition_diversity`, whose weighting/entropy semantics are not established by the public control export.

Exact kills, losses, damage, surviving army value and buildings destroyed remain outside Military V1 because current canonical evidence does not support those as direct outcomes.

## Remaining research boundary

- **Controlled fixtures:** action-subtype layouts; queue/cancel/requeue/autoqueue; research acceptance/cancel; construction cancel/delete/completion; market execution; tribute/fees; unilateral diplomacy and effective state; age notifications; pause/chat attribution; restored clocks and clean result termination.
- **Parser research:** exhaustive initial objects, command selection reuse, unread payload spans, map/lobby/header fields, recorder attribution and mod/entity-data identity.
- **Engine simulation or equivalent telemetry:** trained/completed/live units, completed buildings/research without direct evidence, population, resources, net spend/refunds, army value, damage, kills/deaths, visibility, pathing, continuous positions and combat outcomes.

## Verification evidence

The self-contained golden test disables replay parsing while projecting the synthetic canonical bundle, validates the statistics schema, preserves raw IDs next to unqualified labels, and freezes age/diplomacy/request distinctions. The opt-in real replay harness also compares `AOF_STATISTICS_CORPUS_V1` summaries.

Build Order has dedicated synthetic regression coverage for all eight perfect-execution scores, the Fast Castle boundaries and precedence, Man-at-Arms inclusion in Drush, forward-versus-defensive Tower Rush qualification, and newly queued Scout requirements.

Raid detection has synthetic regression coverage for directional attacker/victim attribution in multiplayer matches, targeted-object attribution, supporting-versus-strong commands, 60-second episode grouping, dynamic economic-zone expansion, teammate exclusion, ambiguous overlapping zones, and field fighting outside economic zones.

On the stored canonical bundles, the projector reproduced the expected aggregate evidence for the FFA, upstream duel, and both ordinary 1v1 perspectives without reopening any `.aoe2record`; recorder-only camera evidence remains separately scoped.

Run:

```bash
python replay-tools/statistics_registry.py --out eligibility.json
python replay-tools/statistics_projector.py path/to/canonical --out statistics.json
python replay-tools/statistics_corpus.py --bundle fixture=path/to/canonical --out corpus.json
```

The next smallest engineering milestone remains the controlled current-build action protocol. Its objective is to move narrowly proven rows from `needs_controlled_fixture` to a successor eligibility registry without conflating commands with completed game state.
