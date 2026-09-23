# Age of Friends — Current Statistics

Last reviewed: 22 September 2026

Purpose: Concise source of truth for player-facing statistics status. Technical definitions and evidence limits live in the versioned architecture/model documents. The player-facing scope and presentation contract lives in [`../design/statistics-experience.md`](../design/statistics-experience.md).

## Statistics structure

| Section | Status | Scope |
|---|---|---|
| Battle Statistics | Replay statistics implemented; player-facing Battle presentation pending | What happened in one Battle; preserve Game provenance if the Battle contains multiple Games. |
| Event Statistics | Product direction defined; aggregation/presentation pending | What shaped an Event across all of its Battles; 4–6 curated distinctions after completion. |
| Season Statistics | Product direction defined; aggregation/presentation pending | League-wide Season statistics and the complete approved Season record book; main nav label stays **Statistics**. |
| Lifetime Stats | Foundation implemented | Continue aggregating underneath; keep hidden from the Season I UI and activate when Season II makes all-time distinct. |
| Player currencies | Product boundary defined; rules pending | Gallantry, Treachery and Chivalry belong to the player and are earned from tracked actions under future rules. |
| Pair relationships | Pair History foundation implemented; current engine needs migration | Rivalry, Hostility and Bond belong to the relationship between two players and remain partly hidden. |
| Individual Player Stats + Playstyle Sliders | Foundation implemented; rules pending | Versioned slider calculation exists. Slider definitions, normalization, weights and thresholds are intentionally undefined. |

## Battle Statistics

Battle Statistics are the player-facing detailed record. The underlying replay models remain grouped into five shared categories that should also recur at Event, Player and Season scope.

### Opening

- Build Order: Drush, Scout Rush, Archer Rush, Tower Rush, Fast Castle, Boom, Naval Rush, Fish Boom, or N/A.
- Build Order execution score.
- Feudal, Castle and Imperial click + inferred age-up timing. V2 uses the latest observed click for each age and adds fixed research durations: +130s Feudal, +160s Castle, +190s Imperial.
- First military unit queued.
- First military building placed.
- First wall segment.
- Unique wall tiles before Feudal.
- Wall style: Open / Partially Walled / Fully Walled.
- Houses before Feudal.
- Villagers before Feudal age: inferred completed Villagers at the latest observed Feudal click. V5 reconstructs Town Center production from queue/cancel order, nominal Villager/Loom timings, population room, projected House/Folwark completion and supported civilization modifiers. Because mgz-fast's initial-object header search is explicitly non-exhaustive, a qualified one-TC Dark Age start uses a civilization-aware standard starting Villager/population floor whenever fewer initial units were decoded. Both the raw observed count and the reconstructed count used by the model are exposed. Queue backorders alone do not count.
- Loom timing.
- Loom before Feudal: Yes / No.

### Economy

`AOF_ECONOMY_STATISTICS_V4` adds a reviewable Economy layer over canonical command evidence:

- Villagers trained: sum of positive decoded Villager queue amounts. This intentionally matches the TownBell-control convention and is a queue-derived proxy, not proof that every unit completed.
- Villagers by 20 minutes: qualified starting Villagers plus net decoded Villager queue amount through 20:00; it does not assert survival or exact completion.
- TC idle time in Dark Age: inferred idle workload on the qualified starting TC before the latest Feudal click, using Villager queue work and Loom occupancy.
- Town Centers: qualified starting count plus observed TC placement commands.
- First extra TC and third TC timing: placement-command timestamps, not construction completion.
- Longest TC idle gap and TC idle gaps over 30 seconds: inferred gaps between Villager and Town-Center-only research workload intervals. V2 no longer mistakes Mill/Lumber/Mining/Market research streams for Town Centers.
- Economic techs researched includes the supported farming, wood, mining, Villager, fishing and Market economy technologies (Coinage, Banking, Guilds, Caravan). Eco upgrades by Castle excludes Loom and uses research requests before the Castle click.
- Horse Collar: latest observed request plus inferred completion timing. For normal one-time technologies, a later request supersedes an earlier cancelled/failed attempt; TownBell remains a control and may use an earlier click.
- Economy Buildings: grouped placement/request counts for Mills (including Folwark), Farms, Docks (including Harbor), Mining Camps, Lumber Camps, Markets, Town Centers, Fish Traps and Feitorias. Ordinary buildings use observed BUILD placements; Fish Traps use net `fishtrap_queue - fishtrap_unqueue` requests. Starting Town Centers are excluded.
- Farms placed and first Farm are placement-command metrics. Farms before Horse Collar uses the latest Horse Collar click because Horse Collar is a normal one-time technology; Farms before Castle uses the latest Castle click.
- First boar lure, boars taken, deer taken and livestock taken: inferred distinct targeted Gaia-food interactions. V2 resolves by target identity first and can use a tight 1.5-tile known-food-object position fallback; these remain interaction proxies and can undercount because initial-object search is non-exhaustive.
- Market transactions, first use, sales and purchases are decoded commands. The decoded BUY/SELL amount is a count of 100-resource market lots, so Market volume is `abs(lots) × 100`; it is still not gold proceeds after market pricing.
- Eco:military ratio at 20 minutes: reconstructed base-catalog resource commitment of classified economic versus military requests/placements through 20:00.
- Resource Commitment: Food, Wood, Gold, Stone and total.
- Resource Commitment by age: Dark, Feudal, Castle and Imperial, plus Unknown when the model cannot support age assignment.

Resource Commitment and the 20-minute ratio are commitment estimates, not exact resources collected or exact engine spend. TC utilization values are workload reconstructions, not engine telemetry. All output retains observed/reconstructed/inferred labels and model versions.

Launch presentation should start with familiar numerical tables. A restrained **★** may mark the largest value in a comparison; it means largest recorded commitment, not “best”. Commitment by age should also be shown numerically. Charts are optional later rather than required for launch.

### Military

`AOF_MILITARY_STATISTICS_V2` adds the player-facing production/army-decision layer:

- Military units trained: sum of positive decoded military queue amounts. This is a queue-derived proxy, not proof that every unit completed.
- Military Unit Commitment: pinned base-catalog unit cost × positive military queue amount.
- Military Spend: broader TownBell-control-compatible command commitment = military unit queues + non-economic building/wall placements + non-age/non-economic technology requests. Component totals remain exposed; civilization discounts/refunds/resource availability are not simulated.
- Composition: Infantry, Archers, Cavalry, Siege, Monks, Warships, Other Land Military and Special/Castle-produced Military.
- Dominant unit and dominant class by positive queue amount.
- Production diversity: number of distinct raw military unit IDs positively queued. This is intentionally not equated with TownBell's weighted composition-diversity metric.
- First military production, first Siege, first Monk and first Warship: first positive queue-request timings.
- Military buildings: total placement commands and counts for Barracks, Archery Ranges, Stables, Siege Workshops, Monasteries, Castles, Donjons and Kreposts.
- First military building placement.
- Military buildings at Castle click: military-building placements before the latest Castle research request.
- Raids initiated.
- Raids against the player.
- Raid episode details: opponent, start/end timing and supporting command evidence.

Military production classification uses catalog roles when available and the DE queue's promoted raw producer-building type as a fallback. `mgz-fast` discards this field from its normal DE_QUEUE payload, but CanonicalReplay retains it in the raw layout; Analysis V2 promotes it into `productionEvents.producerBuildingTypeId`. This is important for siege and upgraded/unique raw unit IDs not fully labeled by the pinned catalog. Known economic Dock units are excluded rather than automatically treating every Dock queue as a warship. Queue/placement values do not assert completed units/buildings, surviving army, kills, deaths or damage.

Raids are inferred hostile-command episodes inside reconstructed economic zones; they do not assert damage or kills.

### Map Presence

- Command map coverage.
- Enemy base found timing, including first contact by enemy.
- Forward buildings: count, first timing and building types.
- Forward eco: count, first timing and eligible economic building types.
- Expansions: distant Town Center placements and first timing.
- Gold control: weighted spatial influence over supported neutral gold clusters.
- First relic touch.

Map Presence is based on command/building geometry and does not assert fog-of-war visibility, resource gathering or permanent territorial control.

### Execution

- Total observed commands.
- Command rate per observed minute.
- First command timing.
- Commands in the first five observed minutes.
- Active seconds.
- Raw command-type breakdown.
- Average selection size.
- Median selection size.
- Maximum selection size.
- Raw formation modes used.

## Lifetime Stats

`AOF_LIFETIME_STATISTICS_V1` aggregates eligible statistics without assigning player identity or points. It covers the current Opening, Economy, Military, Map Presence and Execution outputs, retaining sample counts and record provenance.

Lifetime remains active underneath the data model during Season I but is intentionally shelved in the player-facing UI until Season II.

## Player currencies and pair relationships

**Gallantry, Treachery and Chivalry belong to the player.** They will be awarded from tracked actions under an explicit future rule set. Raids are intended candidates for Gallantry and Treachery; meaningful ally defense/support is an intended candidate for Chivalry. Exact earning rules remain unspecified.

`AOF_PAIR_HISTORY_V1` records neutral pair history: encounters, ally/opponent history, results and directional replay-derived interactions. The current result pipeline persists encounter/team/result history; replay-derived directional signals will join this once Battle Statistics are durably available to the Functions backend.

**Rivalry, Hostility and Bond belong to the relationship between two players.** They are separate from the player currencies and remain partly hidden. A future War Room may reveal escalated relationship state and progression.

The existing `AOF_RELATIONSHIP_ENGINE_V1` still uses the older `RIVALRY / ENEMY / FRIEND` identifiers and direct track points. That implementation predates the latest product direction and must be migrated or versioned before final relationship behavior is exposed.

## Individual Player Stats + Playstyle Sliders

`AOF_PLAYSTYLE_ENGINE_V1` accepts normalized longitudinal metrics and an explicit versioned slider rule set. No default sliders, weights, thresholds or comparison population are defined.

## Model status

Current models include:

- `AOF_BUILD_ORDER_V2`
- `AOF_OPENING_STATISTICS_V5`
- `AOF_MILITARY_STATISTICS_V2`
- `AOF_RAID_DETECTION_V1`
- `AOF_MAP_PRESENCE_V2`
- `AOF_FORWARD_ECO_V1`
- `AOF_ECONOMY_STATISTICS_V4`
- `AOF_TC_ACTIVITY_V2`
- `AOF_ECO_MILITARY_COMMITMENT_20M_V1`
- `AOF_RESOURCE_COMMITMENT_V1`
- `AOF_CANONICAL_STATISTICS_V1`
- `AOF_LIFETIME_STATISTICS_V1`
- `AOF_PAIR_HISTORY_V1`
- `AOF_PLAYSTYLE_ENGINE_V1`
- `AOF_RELATIONSHIP_ENGINE_V1`

All statistics and interpretations must retain their evidence/model/rule versions. Battle measurement, player currencies, player identity and pair relationship interpretation are separate layers.
