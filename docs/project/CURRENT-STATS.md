# Age of Friends — Current Statistics

Last reviewed: 25 September 2026

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

Canonical participant output keeps the engagement family inside Military at `participant.military.engagements`; there is no separate player-facing Combat category.

`AOF_MILITARY_STATISTICS_V4` adds the player-facing production/army-decision layer:

- Military units trained: sum of positive decoded military queue amounts. This is a queue-derived proxy, not proof that every unit completed.
- Military Unit Commitment: pinned base-catalog unit cost × positive military queue amount.
- Military Spend: broader TownBell-control-compatible command commitment = military unit queues + non-economic building/wall placements + non-age/non-economic technology requests. Component totals remain exposed; civilization discounts/refunds/resource availability are not simulated.
- Composition: Infantry, Archers, Cavalry, Siege, Monks, Warships, Other Land Military and Special/Castle-produced Military.
- Dominant unit and dominant class by positive queue amount.
- Production diversity: number of distinct raw military unit IDs positively queued. This is intentionally not equated with TownBell's weighted composition-diversity metric.
- Army commitment checkpoints at 10, 15 and 20 minutes: base-catalog value of positive military queues, with decoded queue cancellations and unpriced coverage shown separately. This is not surviving army value.
- Trash units trained and trash army share: positive queue amount from the Spear, Skirmisher and Scout/Light Cavalry/Hussar lines, plus its share of all positive military queue amount. Raw IDs are pinned to the DE tech-tree source.
- Production buildings used: distinct decoded producer object IDs selected on positive military queue commands, with coverage for queue events lacking producer IDs. Multi-selection means this is a reconstructed usage proxy rather than proof every selected building received a unit.
- Castles and first Castle: Castle placement-command count/timing.
- Blacksmith buildings, Blacksmith upgrades and first Blacksmith upgrade: placement evidence plus distinct supported Blacksmith technology IDs. V4 additionally exposes total research-request count and repeat-request count, while each tech retains first/latest request times. This keeps repeated/cancelled attempts separate from the distinct-upgrade count.
- University buildings, University technologies and first University tech: placement evidence plus a source-pinned DE University technology set.
- Ballistics and Chemistry: latest observed request timing, kept as direct diagnostic fundamentals for later line-specific upgrade-lag work.
- First military production, first Siege, first Monk and first Warship: first positive queue-request timings.
- Military buildings: total placement commands and counts for Barracks, Archery Ranges, Stables, Siege Workshops, Monasteries, Castles, Donjons and Kreposts.
- First military building placement.
- Military buildings at Castle click: military-building placements before the latest Castle research request.
- Skirmishes: player-facing rename/relocation of the former `AOF_FIGHT_DETECTION_V1` episodes. `AOF_SKIRMISH_DETECTION_V1` is locked to identical episode formation/count/timing via `AOF_FIGHT_DETECTION_V1_RENAME_ONLY`; relationship enrichment cannot create extra Skirmishes. Execution only reuses the windows for context metrics.
- Raids initiated / against the player, with opponent, start/end timing, local economic-zone evidence and direct economic-unit targeting where known.
- Battles fought: Skirmishes with actual command contributors on opposing sides. `AOF_UNIT_CLASS_FAMILIES_V1` strengthens promotion when replay-observed class IDs show a contributor is clearly civilian/building-only, while unresolved later-spawned types do not cause false negatives.
- Great Battles fought: exceptional multiplayer-only promotion requiring at least 4 contributing players, 60 seconds, 80 combat-eligible distinct selected instances and 10 strong Skirmish commands. A 1v1 cannot be a Great Battle.
- Ally Reinforcements sent / received: high-confidence allied military-control evidence inside the supported player's TC-anchored base while no active defensive Battle is present.
- Defensive Assists given / received: an ally contributes to an active Battle inside the defended player's TC-anchored base.
- Cooperative Attacks: two or more allied contributors have pairwise interaction evidence against the same opponent outside defensive-base semantics.
- Multiplayer relationship evidence: every Skirmish/Battle retains participant IDs, sides, directed opponent edges and opponent interaction pairs; player summaries count only opponents with pairwise evidence rather than every co-participant.

Military production classification uses catalog roles when available and the DE queue's promoted raw producer-building type as a fallback. Upgrade-quality scores are intentionally deferred: V3 exposes the raw fundamentals and timings needed to validate later dominant-line upgrade coverage/lag without judging player choices yet. `mgz-fast` discards this field from its normal DE_QUEUE payload, but CanonicalReplay retains it in the raw layout; Analysis V3 retains it in `productionEvents.producerBuildingTypeId` and also carries compact terrain elevation for fight-context statistics. This is important for siege and upgraded/unique raw unit IDs not fully labeled by the pinned catalog. Known economic Dock units are excluded rather than automatically treating every Dock queue as a warship. Queue/placement values do not assert completed units/buildings, surviving army, kills, deaths or damage.

Raids use `AOF_RAID_DETECTION_V3`: V2 economic-zone radii remain unchanged, but later-created target control can now be reconstructed from prior player selections. This improves targeted Raid attribution without enlarging economy zones merely to chase an external count. Known Villagers, Fishing Ships, Trade Carts and Trade Cogs remain strong direct-target evidence. Raids do not assert damage or kills.

`AOF_ENGAGEMENT_STATISTICS_V3` keeps Skirmish count semantics identical to the old Fight V1 detector, then enriches those fixed episodes with pairwise opponent evidence and replay-observed AoE2 unit-class families. Battle promotion can reject a fully typed civilian/building-only responder; unknown class stays eligible. Great Battle is multiplayer-only and intentionally rare. Reinforcement uses the same military-class guard where available. Ally interaction metrics are null/N/A in 1v1 and locked-diplomacy FFA; diplomacy-enabled FFA remains pending until raw diplomacy modes are controlled-test-qualified into stance intervals. Exact unit composition, army size, kills, damage and fight outcome remain outside V3.

### Map Presence

`AOF_MAP_PRESENCE_V4` exposes spatial fundamentals over starting-TC anchors, command coordinates and observed placements:

- Command map coverage: share of fixed 8-tile map cells touched by recorded command coordinates/endpoints.
- Scout Coverage @5:00: buffered command-route coverage and command count from actions attributable to an observed starting Scout/Eagle/Camel Scout during the first five minutes. V6 includes the qualified save-68 MOVE/ORDER selected-ID normalization and uses a 3.25-tile effective corridor. This is scouting attention, not fog-of-war exploration.
- Enemy-side command presence: share of positioned command events whose recorded coordinate is closer to an opponent starting Town Center than to the player's starting Town Center; teammates are excluded.
- Building placement range: maximum straight-line span across the starting-TC anchor and BUILD placement coordinates, plus the furthest placement from home.
- Home / Mid-map / Forward sectors: Enemy Progress % normalizes each placement between the player's starting TC (0%), the equal-distance line (50%) and the most relevant enemy starting TC (100%). Home is <=35%, Mid-map is between 35% and 65%, and Forward is >=65%.
- Forward buildings and Forward Eco use the same normalized 65% Enemy Progress threshold, replacing the old fixed 40/6-tile rule.
- Walls: reconstructed Palisade, Stone/Fortified and total wall tiles from WALL placement endpoints.
- Towers: total placements, first timing and forward-tower count.
- Camp distance from home TC: Mining/Lumber Camp placement distances only; forwardness is intentionally left to Forward Eco instead of duplicating another camp-progress statistic.
- Expansion Town Centers: TC placements at least 30 tiles from the player's starting TC.
- Enemy base contact: first recorded command coordinate within 14 tiles of an unambiguous enemy starting TC; it is command contact, not fog-of-war visibility.
- Gold control: supported gold deposits are weighted by deposit count rather than equal cluster count; placement-influence leadership is recalculated as infrastructure appears so inferred control takeovers are retained. Mined/depleted gold and destroyed infrastructure are not observable here.
- Relics: unique relic touches, total relic commands and an inferred held-relay state. A later touch by a different non-teammate is classified as inferred theft; monastery deposit is not required. Touch remains an inference proxy rather than direct pickup proof.

Map Presence remains reconstructed/inferred geometry rather than continuous unit position, fog-of-war visibility, completed construction, resource depletion or permanent territorial ownership.

### Execution

`AOF_EXECUTION_STATISTICS_V1` promotes command mechanics into a first-class Battle section while retaining the old raw command/selection evidence underneath.

- Raw APM: decoded player ACTION operations divided by observed replay minutes. This is an input-rate baseline, not an effectiveness score.
- First command, longest inactivity and median action gap: ACTION-clock timing fundamentals. Longest inactivity is the largest gap between consecutive decoded player actions; it excludes the pre-first-command and post-last-command edges.
- Explicit control-command counts: formations, stance changes, patrol, attack-ground, attack-move, ungarrison, back-to-work, Town Bell, repair, delete and stop.
- Garrison commands: conservative inference from ORDER commands targeting an owned garrison-capable **initial** structure. Later-built target instance identity is not reconstructed yet, so this can undercount and must not be treated as complete.
- Attack Ground per queued Siege: attack-ground command count divided by positive queue amount classified as siege. The denominator is queue-derived, not live/surviving siege.
- Raid response: intersects received `AOF_RAID_DETECTION_V3` episodes with the first qualifying defender control command inside a 30-second response window. Average and median response remain inferred because raid onset and causal response are model-defined.
- Garrisons during raids: conservative garrison orders inside received raid windows plus a 10-second tail.
- `AOF_FIGHT_DETECTION_V1`: shared spatial-temporal command episode model seeded by attack-move, attack-ground or targeted enemy ORDER evidence, with nearby MOVE/ORDER/PATROL support. It does not claim damage, kills, live army or continuous unit positions.
- Skirmish-context outputs: first Skirmish, union Skirmish time, command share, APM in Skirmishes, economy actions during Skirmishes, average Skirmish elevation delta and inferred disengage moves. The count itself is intentionally not duplicated in Execution.
- Skirmish elevation delta samples the initial terrain grid at recorded command coordinates: negative means the player's sampled Skirmish commands were lower than opponents, zero means level on average, positive means higher. This is command-location terrain context, not proof of unit elevation at impact.
- Disengage moves require a selected-object command sequence where a MOVE destination increases distance from the inferred fight center by at least 8 tiles. It is a retreat-intent proxy, not actual pathing.
- Economy actions during fights are conservative: economy queue/research/build/market/rally/back-to-work commands plus ORDER commands from initially observed economic units. Later-produced Villager tasking can undercount because produced-unit instance identity is not reconstructed.

The previous total-command, active-second, selection-size and raw action-name diagnostics remain available as evidence but are not the primary player-facing Execution metrics.

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
- `AOF_MILITARY_STATISTICS_V4`
- `AOF_RAID_DETECTION_V3`
- `AOF_FIGHT_DETECTION_V1`
- `AOF_ENGAGEMENT_STATISTICS_V3`
- `AOF_EXECUTION_STATISTICS_V1`
- `AOF_MAP_PRESENCE_V6`
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


### Map Presence V6 refinements

- Scout Coverage @5:00 now rasterizes a buffered command-directed route from the starting scout candidate rather than only destination cells. Candidate attribution diagnostics are retained, including a conservative behavioral fallback when the scout identity is not catalog-labelled. It remains a scouting-attention proxy, not fog-of-war visibility or actual movement.
- Eco Camp distance uses Mill/Folwark, Lumber Camp and Mining Camp placements.
- Expansion Zones replace TC-only expansion counting. Qualifying remote economy/territorial buildings (Mill/Folwark, Lumber Camp, Mining Camp, Market, Town Center, Dock/Harbor, Feitoria and Castle) are clustered with a 12-tile link distance after a map-scaled 13% home-radius exclusion. Zones are classified Home/Mid-map/Forward from their centroid using the existing Enemy Progress model. Farms, houses, walls, towers and military-production buildings do not create expansion zones.
- Enemy Base Contact keeps its complete `firstByEnemy` directional package for future relationship analysis; UI surfaces may intentionally show only summaries.

### Scout Coverage V6 attribution fix

- Starting Scout/Eagle/Camel Scout identity remains anchored to initial owned objects.
- For `MOVE` and `ORDER` only, Map Presence V6 recognizes the save-68 decoder pattern where a selected starting-scout instance ID appears as `instanceId << 16`. The canonical/compact parser value is not rewritten; the normalized ID exists only inside the inferred scout-attribution model.
- Empty/implicit selections are not inherited. The committed two-recorder duel regression yields 45 positioned starting-scout commands for player 1 and 36 for player 2, exactly matching the reviewed TownBell control counts. The V6 route footprint is a versioned 3.25-tile effective corridor; on the same replay it produces 15.38% and 9.83% versus the reviewed 15.3% and 10.4% control values.
- `SPECIAL` and other action families are deliberately not shift-normalized because save-68 selected-ID decoding for those families is not independently qualified.
