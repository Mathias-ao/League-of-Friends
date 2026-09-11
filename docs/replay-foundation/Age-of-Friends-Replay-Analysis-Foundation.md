# Age of Friends Replay Analysis Foundation

Independent capability research and canonical data architecture

Prepared for Age of Friends  
10 September 2026

This document defines the permanent replay data foundation for Age of Friends. It treats TownBell as a public capability benchmark, not as an architecture to copy. The evidence comes from TownBell's public product pages, public developer statements, the supplied TownBell JSON export and matching replay, and open-source replay tooling. The recommended model preserves replay facts, deterministic reconstructions, analytical metrics, and league scoring as separate layers.

The central recommendation is to stop extending the existing 320-metric report as the primary data contract. Keep it as a useful metric projector, but introduce a lossless `CanonicalReplay 1.0` event model beneath it. Store every decoded operation and field, initial map state, raw IDs, coordinates, player-to-player targets, unknown payload bytes, version provenance, and explicit observability status. New metrics should read that representation. Only parser-format discoveries should require replay reprocessing.

## Evidence and terminology

This report uses six evidence classes throughout.

| Class | Meaning |
|---|---|
| A Directly observed | The replay explicitly stores the value or event. Selecting the first or counting such events is still a straightforward projection of direct evidence. |
| B Deterministically reconstructed | The result follows from stored facts and a declared deterministic rule. It remains distinct from game-engine state. |
| C Inferred | The result depends on a heuristic, classifier, spatial threshold, attribution rule, or semantic interpretation. |
| D Requires game engine simulation | Accurate recovery requires applying the commands to a compatible AoE2 simulation with game rules and state. |
| E Recorder only | The recording contains the fact only for the player whose point of view produced the file. This can combine with A, B, or C. |
| F Not obtainable | The replay and reasonable supporting data cannot establish the fact honestly. |

The words **queue**, **order**, **placement**, **click**, and **command** are intentional. They must not be silently replaced with **created**, **completed**, **built**, **reached**, or **spent** unless evidence supports the stronger term.

# A Executive findings

1. An AoE2 DE recording is an initial state followed by a timed operation stream. It is not a time series of authoritative game state. The aoc-mgz maintainers describe the same header-and-body model and state that point-in-time resources or kills cannot be recovered without replaying the match in the game engine.[1]

2. TownBell proves that a large and useful analytical layer can be built without engine simulation. Its public site describes more than 300 insights across openings, economy continuity, map activity, fights, and input behavior.[2] The supplied export contains exactly 320 metric definitions in seven categories and nine chart datasets.

3. Those 320 outputs are projections of a much smaller set of reusable primitives. The durable asset is the command and spatial event model, not the metric catalog. Storing only today's metrics would discard the evidence needed for future league systems.

4. The paired fixture proves that TownBell's metrics named `villagers_trained`, `military_units_trained`, `fishing_ships_trained`, and `trade_units_trained` count queue-command amounts. Across the eight-player match, their four groups sum to all 3,144 queued units. The replay does not prove that every queued unit completed.

5. The same fixture exposes standard-start assumptions that Age of Friends must avoid. The map begins without Town Centers, yet TownBell reports one Town Center plus every Town Center placement command. Its `villagers_at_20min` calculation starts from population-bearing initial objects, including each King and Transport Ship, then adds queued villagers. This is useful benchmark behavior to test against, but it is not canonical truth.

6. Age advancement deserves two events. `AgeAdvanceStarted` is the direct RESEARCH command. Current DE recordings also emit system age messages that provide a direct `AgeReached` time in the paired fixture. When that message is absent, a projected completion may be stored separately, with assumptions; it must not replace the observed event.

7. Actual unit creation, construction completion, live army composition, resources collected, resource banks by type, damage, deaths, kills, vision, and unit positions over time are engine-simulation facts. Queue and command analytics can provide valuable proxies, but their names and classifications must remain honest.

8. Spatial data is a first-class input. The replay directly provides initial object positions, terrain and elevation tiles, building and wall placement coordinates, command destinations, targets, flares, and the recorder's camera positions. Raw coordinates must be preserved before any base, region, forwardness, or map-control classification is applied.

9. FFA and flexible matches require a time-varying directed relationship graph. The paired replay contains 86 explicit diplomacy commands, including later alliances and reversals between particular players. A static team ID loses this information.

10. Player interaction must be represented for every ordered pair. `A to B` aggression, tribute, diplomacy, flares, target commands, and spatial activity are different from `B to A`. A nearest-opponent shortcut is unsuitable for FFA and insufficient for rivalry history.

11. Camera data is directly observed only for the recorder. TownBell correctly makes camera metrics point-of-view-only.[3] The canonical model should store the raw camera path once and attach `E` to every camera-derived fact.

12. Command-priced resource curves are best described as gross planned commitments. They can be reconstructed from queue, placement, and research commands plus versioned cost tables. They are not resource collection, live bank balances, successful affordability, or net spend after cancellation and refunds.

13. The existing analyzer is a strong research prototype: it decodes the command stream, emits the TownBell-shaped 320-metric contract, and contains map, production, spend, fight, and camera logic. It is not yet the permanent data layer because its exported report discards the raw event stream, dynamic diplomacy, unknown payload evidence, source hashes, and per-value provenance.

14. Replay format compatibility must be treated as a product subsystem. The supplied save-version 68 replay did not parse with aoc-mgz 1.8.51 until three header-layout changes were identified empirically. Even after that patch, the older lobby parser remains misaligned. Every game patch needs a gated fixture and decode-coverage check.

15. Entity normalization must retain both raw IDs and resolved identities. Unit, building, technology, terrain, and civilization names change with patches and mods. Every normalized entity needs an entity-data version, family and line identifiers, and an unresolved state.

16. Firestore should hold lightweight match, player, edge, and metric documents. The full event stream, terrain grid, and original replay should live in immutable chunked artifacts, referenced by hashes. Firestore documents are limited to 1 MiB and are intended as lightweight records; subcollections are the appropriate structure for growing child records.[6][7]

17. Persistent portraits should use stored unit-family evidence, sample size, recency, confidence, and hysteresis. One unusual match must not immediately replace an established identity. The portrait decision is a versioned profile model, not a parser fact.

18. AI can narrate or summarize metrics later, but it should never create canonical match facts. TownBell's developer similarly distinguishes fixed calculated reports from its optional AI review.[4]

19. The highest-value next task is to implement `CanonicalReplay 1.0` and a golden controlled-replay suite before adding more scores. That one step protects every future economy, military, map, relationship, and identity system.

# B What TownBell proves is possible

## Publicly demonstrated capability

TownBell's current public materials describe a parser that reads orders, queues, research, camera movement, timings, and map data. It presents build-order timing, economy continuity, command-priced spending, forward structures, walls, camera attention, inferred engagements, raid response, and initiative. It supports team games, FFA, and AI games, with a small number of head-to-head metrics unavailable outside 1v1.[2][3]

The public community feed demonstrates cross-match aggregation. It publishes percentile distributions for Feudal clicks and eAPM, civilization and map frequencies, opening classifications, and Dark Age TC-idle distributions. It describes eAPM as decisions after removing repeated clicks and opening classes as derived from production evidence.[5] The developer's public update also describes comparison of up to ten games for repeated timings, production gaps, idle periods, and army-choice changes.[4]

These observations establish capability, not private implementation. The algorithms below are independent routes consistent with the replay primitives and the supplied output.

## Supplied paired fixture

The supplied TownBell export and matching replay provide a stronger test than marketing descriptions because replay events can be compared with exported values.

| Fixture fact | Observed result | Engineering conclusion |
|---|---:|---|
| Replay SHA256 | `2dd7a9a63f1b1b74f7e43dc1de1e70417089bb7f3ff667424591dea7db1e9ec9` | Use the content hash as the immutable source identity and deduplication key. |
| Save and build | Save 68 and build 180059 | Parser branches must be gated by save and build, not by a single latest-version assumption. |
| Match shape | Eight-player FFA on Pilgrims Nothing lasting 5,639,022 ms | A useful stress case for custom starts, water, dynamic diplomacy, and non-1v1 logic. |
| TownBell catalog | 320 metrics across seven categories | The catalog is broad, but most entries share primitive inputs. |
| TownBell charts | Spend, economy versus military, APM, composition, villagers, fights, timeline, camera heatmap, map overlay | The event model must support time windows and spatial projection without reparsing. |
| Replay operations | 454,120 | Preserve an operation ordinal and decode status for auditability. |
| Synchronizations | 220,050 | These reconstruct the replay clock and include undocumented checksum values that need separate validation. |
| Camera operations | 220,050 raw and 25,322 kept by TownBell | Raw and filtered camera series need separate counts and a filter-version field. |
| Player actions | 13,623 | TownBell's action accounting matches the decoded action stream exactly. |
| Chat operations | 396 | TownBell's per-player chat metric sums to all raw chat operations, including duplicate or system records; social use needs logical-message deduplication. |
| Queue actions | 1,720 commands representing 3,144 queued units | A queue action can carry an amount greater than one; preserve command count and requested amount separately. |
| Villager queue total | 932 | TownBell `villagers_trained` equals the summed queue amounts, not confirmed completions. |
| Military queue total | 1,577 | Military identity can use queue commitment, but the label must not claim a surviving army. |
| Fishing and trade queue totals | 215 and 420 | Economic and naval roles require entity taxonomy that separates fishing, trade, transport, warship, and land military. |
| Dynamic diplomacy | 86 direct commands | FFA relationship state is time-varying and directed. |
| Age-reached events | 17 direct system events | Prefer these over projected research completion. |

## Benchmark strengths

TownBell demonstrates five especially valuable design ideas.

First, it computes a consistent per-player metric contract even when values are unavailable. Its export distinguishes some unavailable cases with reasons such as civilization, absent event, or unobservable data. Age of Friends should generalize this into a required availability object rather than relying on a bare null.

Second, it treats map geometry as analyzable data. The supplied report includes a compressed terrain representation, initial resources, buildings, walls, timeline coordinates, fight centers, and a recorder camera heatmap.

Third, it keeps deterministic reporting separate from AI narration. Public materials state that most report value comes from calculated metrics, charts, maps, and comparisons, while the AI review is optional and fallible.[4]

Fourth, it shows that a command stream can support useful behavioral proxies even without kills or resource totals. APM, queue commitment, build timings, control commands, wall geometry, and command-location coverage are legitimate when named precisely.

Fifth, it exposes enough unavailable data to show where honesty matters. Its public help says one camera track exists, resources and kills are absent, and nonapplicable metrics should be unavailable instead of zero.[3]

## Benchmark limits revealed by the pair

The paired FFA is also an excellent adversarial fixture. Several output names are stronger than the evidence.

- For every active player, `first_military_unit` equals the first Fishing Ship queue. The underlying primitive is a first non-villager queue, not necessarily a combat unit.
- The report begins each player with one Town Center even though the header contains none. `town_center_count` therefore equals one plus Town Center placement commands.
- The `villagers` chart begins at 10 for seven players and 9 for the player without a Transport Ship. Those values equal population-bearing initial objects: eight villagers, one King, and usually one Transport Ship. The chart then adds villager queue amounts.
- `chat_messages` counts raw chat operations. The parsed chat stream contains near-duplicate logical messages and age/system messages, so raw count is not a social-communication count.
- Building, unit, technology, spending, fight, and raid labels can imply completion or game state even when the replay proves only a command or heuristic.

Age of Friends should retain the useful capability while giving every field a more exact semantic name and evidence class.

## Capability families

### Match and participant facts

TownBell demonstrates match duration, save and build versions, GUID, played time, map and RMS identifiers, game settings, player names and profile IDs, civilizations, colors, lobby teams, ratings where present, recorder identity, and conditional winner reporting. Most are direct header or postgame facts. Winner derivation is only trustworthy when explicit resignation or compatible postgame evidence exists.

### Opening and build order

The report includes age clicks and reached times, population at clicks, opening classification, build-order text, timing gaps, first economic and military structures, first wall and tower, wall style, and early supply or production measures. Clicks, placement commands, and direct age system messages are strong. Population, completion, adherence, and strategic labels require reconstruction or inference.

### Economy and production

TownBell demonstrates villager queue totals, projected villager curves, TC activity, economy upgrades, farms and camps, markets, trade, tribute, command-priced spend, and age-window investment. Queue, research, build, buy, sell, and tribute commands are direct inputs. Exact production continuity and resource state are not.

### Military choices

The export groups queued units into infantry, archers, cavalry, siege, monks, warships, gunpowder, trash, trade, unique and other classes; computes composition and planned army value; tracks military structures and upgrades; and labels transitions or dominant choices. This is enough for a useful military identity when Age of Friends stores entity-level queue evidence and presents the result as commitment rather than confirmed army state.

### Map activity

The report measures resource proximity, buildings and walls, forwardness, spatial spread, command coverage, enemy-side activity, map character, elevation, and recorder camera coverage. Initial map and command geometry are strong facts. Scouting, exploration, territorial control, and forwardness are model-dependent.

### Combat and tempo

TownBell infers fights, raids, initiative, response, reinforcement, pressure, inactivity, garrison behavior, and control-command intensity. These are command clusters, not combat simulation. They can be useful for player tendencies and relationship edges if each inferred event keeps its participant set, location, time window, evidence commands, and confidence.

### Mechanics and attention

The report includes action totals, APM, eAPM, selection size, batches, rally points, command breadth, bursts, formations, stances, patrol, attack move, attack ground, deletion, repair, and recorder camera behavior. Raw counts are strong. Effective actions, multitasking, quality, and offscreen intent require declared models.

### Multi game behavior

The public product supports multi-game comparison and percentile benchmarks.[4][5] These capabilities are downstream aggregations. They need stable player identity, versioned per-match fundamentals, comparable availability, patch and map context, and a method for reprojecting historic facts under new metric versions.

# C Reality of the AoE2 replay format

## File model

The open-source aoc-mgz project describes a recording as a header snapshot of the initial game state followed by body operations that the game applies to mutate state.[1] Its fast parser distinguishes ACTION, SYNC, VIEWLOCK, CHAT, START, POSTGAME, and SAVE operations. Current DE action decoders expose player IDs, action codes, selected object instance IDs, target instance IDs, queue entity IDs and amounts, research IDs, building IDs, command coordinates, wall endpoints, rally targets, market amounts, tribute vectors, diplomacy changes, stances, formations, and several explicit movement or combat-control commands.[8]

AgeAlyser independently reaches the same limit: it models production and completion from queues and timing tables, warns that unqueue handling causes inaccuracies, and states that resources collected are not stored.[9] Its code is useful prior art for production-building attribution and map feature extraction, but its modeled `UnitCreatedTimestamp` must remain a reconstruction rather than parser fact.

## Field and event classification

| Relevant item | Class | What the replay supplies | Honest limit |
|---|---|---|---|
| File version and build | A | Header values such as save version, log version, game build and device | Layout changes can make an old parser read the wrong offsets. |
| Match GUID and played timestamp | A | DE header fields when present | Timestamp interpretation and new layout fields must be version-gated. |
| Player identity | A | Slot number, name, profile ID, color, civilization ID, handicap and related flags | Cross-game identity should prefer stable profile/platform IDs, not names. |
| Initial team and diplomacy | A | Lobby team fields and initial diplomacy arrays | FFA and diplomacy-enabled matches can change relations later. |
| Dynamic diplomacy | A | GAME diplomacy action with actor, target player and mode | Relation is directed; mutual alliance requires both directions or a defined rule. |
| Map settings | A | Map IDs, RMS fields, seed, dimensions, reveal mode, speed, population and victory settings | Custom RMS and mods can make names or semantics unresolved. |
| Terrain and elevation | A | Initial tile grid with terrain and elevation IDs | Terrain names require versioned external data. No later terrain mutation is guaranteed. |
| Initial objects and resources | A | Object type, class, instance ID, owner and position in the header | Later spawned objects are not provided as a complete typed state stream. |
| Player starting position | C | Positions of initial owned objects | There is no universally correct single start point on Nomad, Pilgrims, migrations or scenarios. Store an anchor method and evidence. |
| Replay clock | B | SYNC increments and restore offsets | Timestamps are reconstructed by accumulating sync time; restored chapters need explicit offset handling. |
| Player command | A | ACTION code, player, sequence and action-specific payload | Some actions or payload tails remain unknown after patches. Preserve code and bytes. |
| Selection and object IDs | A | Selected instance IDs on many commands | A newly seen instance ID often lacks a direct type and owner mapping. |
| Generic targeted order | A plus C | Selected IDs, target ID and often coordinates | ORDER does not by itself guarantee attack, gather, repair, or successful execution. Meaning depends on known target and state. |
| Move destination | A | Selected IDs and destination coordinates | Actual route, speed, collision, interruption and position at later times require simulation. |
| Patrol | A | Explicit PATROL action, selection and destination | The patrol path actually followed is not stored as state. |
| Attack move | A | Explicit DE_ATTACK_MOVE action, selection and destination | Contact, damage and targets encountered are not stored. |
| Attack ground | A | Explicit ATTACK_GROUND action, selection and coordinate | Projectile, hit, damage and kill results require simulation. |
| Stance and formation | A | Explicit setting plus selected instance IDs | Whether the units remained in that state after later commands needs event folding or simulation. |
| Guard and follow | A | Selected and target instance IDs where decoded | Target type and owner can remain unknown for spawned objects. |
| Garrison and ungarrison | A | SPECIAL order or UNGARRISON action, target and selected IDs | Actual capacity, entry, exit and survivors are engine state. |
| Town bell and back to work | A | Explicit commands and building or unit IDs | Villagers actually garrisoned or resumed work require state. |
| Repair | A | Selected repairer IDs and target ID | Repair amount, completion and resource cost require simulation. |
| Delete | A | Instance ID and actor where decoded | Object type may be unknown; refund and whether deletion succeeded are state-dependent. |
| Unit queue request | A | Producer candidate IDs, unit ID and amount | The event is queue intent. It does not prove completion, survival, or cancellation handling. |
| Queue ledger | B after validation | Ordered queue and unqueue payloads | Exact semantics for batch, multi-producer, cancellation and autoqueue must be established with controlled games. |
| Unit type requested | A plus normalization | Raw unit ID in the queue command | Display name, family, line, roles and cost come from versioned game data. |
| Unit created | D | Not emitted as a reliable typed spawn event in current DE command streams | A projected completion or first later command is not an exact creation event. |
| Actual units trained | D | Queue requests can be counted | Resource or population blocking, cancellation, producer destruction and game modifiers affect completion. |
| First observed unit use | A plus C | A new selected instance ID appears in a later command | Type attribution to a queue is uncertain without engine state. |
| Building placement | A | BUILD has building ID, builder IDs and coordinate; WALL has endpoints | This is an order, not proof of foundation completion or finished building. |
| Building completion | D | Completion is not a general command event | Base build time plus placement is only a projection and ignores builders, interruption, destruction and civ effects. |
| Wall geometry | A plus B | Wall type and endpoints | Expanding the line into ordered tiles is deterministic; which foundations finish is not. |
| Gate command | A | Gate action or gate building placement | Opening state and completed gate life require simulation. |
| Research start | A | Technology ID, actor and producer ID at click time | A repeated click may reflect cancellation, retry, UI behavior or parser duplication. |
| Technology completion | B or D | Known duration can be applied to a validated queue | Exact completion depends on queue state, modifiers, producer survival and cancellation. |
| Age advance started | A | RESEARCH command for the age technology | Repeated clicks must be reconciled. |
| Age reached | A when system event exists | Current DE system chat events contain player, age and time | If absent, projection is B or C and must have a different event type. |
| Rally point | A | Producer IDs, target ID, target type and/or coordinates | The spawned unit's actual destination and path require simulation. |
| Market buy and sell | A | Resource ID, amount and market object ID where decoded | Price, successful settlement and resulting bank require validated market-state reconstruction or simulation. |
| Tribute | A | Actor, target player, resource vector and sometimes fee | The paired FFA contains many zero-valued records; payload semantics need controlled validation. |
| Flare | A | Coordinate and target-mask or audience fields | Who noticed or acted on the flare is not observable. |
| Resignation | A | RESIGN action and timestamp | Victory can still be ambiguous in incomplete, scenario, disconnect, or non-resignation endings. |
| Postgame data | A when present | Current parser exposes world time and leaderboard snapshots; older formats can contain achievements | Do not assume DE provides kills, economy or score. Missing postgame is normal. |
| Resource costs | B | Commands priced with external unit, building and technology tables | Must include patch, civilization, team bonuses, wall length, discounts, batch semantics and cancellations. |
| Gross planned spending | B | Sum command-priced commitments | It is not actual spend, net spend, resource collection or affordability. |
| Live resource banks by type | D | Not present as authoritative per-resource snapshots | Requires a compatible engine simulation. |
| Resources collected | D | Not stored as a final time series | Villager pathing, bumping, drop-off, upgrades and map depletion require simulation. |
| Synchronization totals | A bytes plus C meaning | DE checksum blocks contain per-player integer values that aoc-mgz labels as guessed total resources and object counts | Treat these as experimental opaque counters until controlled tests validate meaning and patch stability. They do not give per-resource truth. |
| Unit deaths | D | No complete typed death event stream | Aggregate sync counters may change but cannot reliably identify unit, killer or cause. |
| Kills | D | Not stored in current DE replay commands | Engine simulation or an authoritative external postgame source is required. |
| Damage and healing | D | Attack commands exist | Hits, armor, projectile paths, overkill, healing and conversion outcomes are state. |
| Combat engagement | C | Nearby hostile-looking commands can be clustered | This detects command activity, not necessarily a fight, its size, winner or casualties. |
| Raid | C | Hostile command clusters near a versioned opponent economy or base region | The base anchor, military identity and economic target are inferred. |
| Pressure and initiative | C | Timing, location and opener of command clusters | Results depend on windows, thresholds and participant attribution. |
| Unit position over time | D | Only command destinations and initial positions are present | Destination is not actual position. |
| Visibility and exploration | D | Map reveal setting is in the header | Per-player fog-of-war and vision masks over time require simulation. |
| Scouting coverage | C | Scout-attributed command destinations can cover cells | This is command coverage, not terrain actually seen. |
| Camera position | A plus E | VIEWLOCK operations give one camera path | No other player's camera can be recovered from this file. |
| Camera attention | B or C plus E | Camera cells, jumps and overlap with inferred regions or fights | Only recorder; home, fight, pan and offscreen labels depend on thresholds. |
| Chat operation | A | Raw chat bytes, time and parsed audience/player where available | System and duplicate records must be separated from logical player messages. |
| Logical chat message | B | Deduplicate repeated records and classify system versus player messages | Language, sarcasm and social meaning remain uncertain and privacy-sensitive. |
| Action count and APM | B | Count decoded actions and divide by replay minutes | Definition must state included actions, pauses, AI commands, duplicates and restored time. |
| Effective APM | C | Deduplicate or weight command sequences | There is no canonical definition of a meaningful decision. |
| Multitasking | C | Category and region switches, simultaneous windows, fight overlap and camera evidence | It is a behavioral proxy, not a cognitive measurement. |
| Decision quality | C or F | Timing can be compared with declared benchmarks | The replay cannot establish intention, information understood, or the best counterfactual decision. |

## The boundary around simulation

A deterministic replay parser and a deterministic game simulation are different systems. The parser can deterministically count a queue command and price its requested units. A simulation must decide whether resources were available, how queues advanced, whether population was blocked, how builders contributed, where units moved, whether attacks connected, who died, and what each player could see.

Age of Friends should leave room for a future engine-backed layer without contaminating the parser model now. If an engine is added later, its outputs should be a separate reconstruction source with an engine build, dataset hash, replay-desync status, and its own evidence classification. Existing command-derived metrics can coexist and be compared.

## Recorder scope

The recorder boundary must be explicit at event and metric level. A `CameraEvent` is A plus E. `CameraCoverage` is B plus E. `CameraOnFightShare` is C plus E because the fight itself is inferred. No null value should leave a consumer guessing whether the event was absent or unobservable for that player.

# D TownBell capability matrix

The tables below group related TownBell outputs by analytical primitive. The companion `townbell-capability-matrix.csv` contains one row for every one of the 320 metric IDs in the supplied export.

## Match map and participant capabilities

| Capability | TownBell demonstrates? | Replay source | Direct/Reconstructed/Inferred/etc. | Likely algorithm | Accuracy/confidence | Required raw fields | Age of Friends use | V1/V2/Future |
|---|---|---|---|---|---|---|---|---|
| Save version and game build | Yes | Header | A | Decode version fields before version-gated parsing | High if offsets are correct | save version, log version, build | Compatibility, patch cohorts | V1 |
| Match identity and time | Yes | Header | A | Preserve GUID and played timestamp; hash file | High | GUID, timestamp, source bytes | Deduplication, league fixture identity | V1 |
| Duration and completion status | Yes | SYNC, RESIGN, postgame | B plus A | Accumulate clock; classify ending evidence | High for duration, variable for completion | sync increments, restore offset, resign, postgame | Result validation, rate metrics | V1 |
| Players and profile IDs | Yes | Header | A | Normalize lobby slots without using name as identity | High | player number, name, profile ID | Persistent player profiles | V1 |
| Civilizations and colors | Yes | Header and entity data | A plus normalization | Resolve raw IDs with pinned dataset | High unless modded or new ID | civ ID, color ID, dataset version | Match context, identity normalization | V1 |
| Static teams | Yes | Header and lobby | A plus B | Convert lobby team convention into explicit teams | High for locked teams | team ID, lock teams, diplomacy | Team standings and scopes | V1 |
| Dynamic FFA diplomacy | Replay contains it; export does not preserve timeline | GAME diplomacy actions | A | Fold directed stance changes into intervals | High after mode mapping test | actor, target player, mode, timestamp | Rival, Enemy, Friend and FFA graph | V1 |
| Ratings and ranks | Yes when present | DE postgame leaderboard | A | Store timestamped rating snapshot | High if block present | leaderboard ID, player number, rating, rank | League context only, not result truth | V1 |
| Winner and resignation | Partial | RESIGN and ending context | A plus B | Use explicit resignations and team state; otherwise unknown | High for resign time, medium for complex victory | resign actor and time, teams, victory mode, postgame | Results and head-to-head records | V1 |
| Game settings | Yes | Header | A | Preserve raw and normalized values | High | speed, population, reveal, victory, age, resources, treaty, cheats | Rule-set validation and metric context | V1 |
| RMS and custom map identity | Yes | Header | A plus normalization | Preserve IDs, filename, mod ID and seed | High for raw values | map ID, filename, mod ID, seed | Event rules, map cohorts | V1 |
| Terrain and elevation grid | Yes | Header map | A | Store tile IDs and elevation in a chunked grid | High | x, y, terrain ID, elevation | Geometry and map context | V1 |
| Initial map resources | Yes | Initial Gaia objects | A plus B | Classify object IDs into resource families | High with correct entity data | object ID, class, instance, position | Resource layout and map fairness | V1 |
| Map character labels | Yes | Tiles and objects | C | Threshold forest, water, openness and resource features | Medium, map-dependent | terrain grid, resource objects, map dimensions | Normalize playstyle and performance | V2 |
| Player start location | Yes | Initial owned objects | C | Versioned anchor hierarchy by map mode | Medium; no universal point | initial objects, TC, villagers, transport, scenario markers | Regions, distances and pairwise activity | V1 reconstruction |

## Opening and economy capabilities

| Capability | TownBell demonstrates? | Replay source | Direct/Reconstructed/Inferred/etc. | Likely algorithm | Accuracy/confidence | Required raw fields | Age of Friends use | V1/V2/Future |
|---|---|---|---|---|---|---|---|---|
| Age advance click | Yes | RESEARCH | A | Select first valid age research start | High | actor, technology ID, producer, time | Fundamental timing | V1 |
| Age reached | Yes | System age CHAT with fallback | A or B | Prefer direct age event; otherwise project separately | High when direct, medium when projected | system subtype, actor, age, time, research duration | Fundamental timing and age windows | V1 |
| Population at age click | Yes | Initial objects and projected queues | C | Project population at click | Medium or lower | initial pop objects, queue/cancel, click time | Opening context | V2 |
| Feudal efficiency delta | Yes | Villager/age queue model | C | Compare observed click with a declared continuous-production baseline | Medium; start and civ sensitive | start state, villager queue, Loom, age click, civ modifiers | Execution trend | V2 |
| Opening strategy | Yes | Early buildings and unit queues | C | Rule-based first commitment classifier | Medium | build and queue events, age windows, entity roles | Match identity and longitudinal style | V2 |
| Build order text | Yes | Ordered early events | B plus C | Render normalized build, queue and research milestones | High for event list, medium for strategic grouping | event times, entities, quantities | Reusable match narrative | V1 facts, V2 text |
| Build order adherence and first gap | Yes | Queue model and benchmark | C | Compare event sequence with a chosen template or continuity expectation | Benchmark-dependent | canonical event sequence, template ID, civ and map context | Execution coaching only if desired | Future |
| First economic building timings | Yes | BUILD | A plus B | Select placement command by building family | High for order, not completion | building ID, time, coordinates | Infrastructure and opening profile | V1 |
| Houses and early supply | Yes | BUILD and population projection | B plus C | Count placements and compare projected cap with projected population | Medium | house orders, initial cap, queue model | Supply-management execution | V2 |
| Villagers queued | Yes, labelled trained | DE_QUEUE | B | Sum queue-command amounts for Villager | High for requested amount | actor, unit ID, amount, producer IDs, time | Economic commitment and portrait-neutral baseline | V1 |
| Villagers at a time | Yes | Initial objects and queue model | C | Initial true villagers plus queue-ledger projection | Medium without engine | initial villager types, queue/cancel, time | Growth trajectory | V2 |
| Villager rate | Yes | Queue events and time windows | B or C | Queue amount per active interval; label as queued rate | High for requested rate | queue amounts and age intervals | Economy execution trend | V1 metric |
| TC count and expansion timing | Yes | Initial objects and BUILD | A plus B | Count initial TCs and TC placement orders separately | High for orders | initial TC IDs, build ID, time, coordinates | Boom and expansion | V1 |
| TC idle and utilization | Yes | Queue scheduling | C | Estimate queue occupancy by producer and known durations | Medium or lower | producer IDs, queue/cancel, tech starts, train times, destruction evidence | Production-continuity fundamental | V2 |
| Economy technologies | Yes | RESEARCH | A plus B | Store starts and count by family or age | High for click | technology ID, producer, time, civ availability | Economic investment | V1 |
| Farm and camp infrastructure | Yes | BUILD | B | Count placement commands and first time | High for orders | building ID, time, coordinates | Economic development and forward economy | V1 |
| Resource task timings | Yes | ORDER targets | B or C | Match targets to initial sheep, hunt, berries or trees | High for known initial target, lower later | selected IDs, target ID, initial object type, time | Opening resource plan | V2 |
| Boars deer and herdables worked | Yes | ORDER targets | B | Count distinct known resource instance IDs targeted | Medium; lures and shared animals complicate ownership | target IDs, object taxonomy, actor | Opening tendencies | V2 |
| Market construction and use | Yes | BUILD, BUY, SELL | A plus B | Select market order and aggregate transaction commands | High for commands | market ID, resource ID, amount, time | Market dependence | V1 |
| Market volume and buy sell counts | Yes | BUY and SELL | B | Sum amounts and commands by resource and direction | High after amount semantics test | actor, resource ID, amount, market object | Economy behavior | V1 |
| Gross command priced spending | Yes | Queue, build, wall and research plus costs | B | Price requested commands and aggregate by resource | Medium to high as planned commitment | entity ID, amount, cost table, civ modifiers, cancellation | Greed and commitment fundamentals | V1 |
| Economy versus military spending | Yes | Command-priced events | B plus C taxonomy | Classify every priced entity by role | Medium; dual-use techs and buildings need taxonomy | cost vector, entity roles, time | Playstyle and timing | V1 |
| Tribute sent received and net | Yes | TRIBUTE | A plus B | Aggregate directed resource vectors, excluding validated setup records | High after controlled validation | actor, target, resource vector, fee, time | Teamwork and Chivalry inputs | V1 |
| Economic rebound after a raid | Yes | Inferred raid plus queue/build activity | C | Compare post-raid economy events with pre-raid baseline | Low to medium | raid evidence, economy event series | Recovery tendency | Future |

## Military and technology capabilities

| Capability | TownBell demonstrates? | Replay source | Direct/Reconstructed/Inferred/etc. | Likely algorithm | Accuracy/confidence | Required raw fields | Age of Friends use | V1/V2/Future |
|---|---|---|---|---|---|---|---|---|
| Units queued by exact type | Yes, labelled trained | DE_QUEUE | B | Sum requested amounts by raw and normalized unit ID | High for queue intent | unit ID, amount, time, producer candidates | Lifetime unit preference | V1 |
| Units actually trained | No reliable proof | Requires simulation | D | Simulate queue, resources, pop, production and destruction | Not available in parser-only V1 | full engine state and rules | Future authoritative composition | Future engine |
| Military unit family totals | Yes | Queue plus entity taxonomy | B | Group queued amount by line, family and role | High if taxonomy is correct | unit ID, amount, family and line version | Per-game military identity | V1 |
| First combat unit queue | Partially; benchmark field includes fishing ships | Queue plus taxonomy | B | Select first queue with combat role; keep first non-villager separately | High for queue classification | unit ID, role, time | Opening and aggression identity | V1 |
| Dominant unit and class | Yes | Queue totals or planned value | C | Rank family shares with minimum commitment and mixed threshold | Medium; definition-dependent | queued counts, planned cost, family, game duration | Portrait and playstyle input | V2 |
| Composition diversity | Yes | Queue distribution | B plus C | Shannon entropy or equivalent over declared categories | High mathematically, medium semantically | family totals, chosen weighting | Specialist versus flexible | V2 |
| Army transitions | Yes | Queue series and upgrades | C | Detect sustained change in dominant family across windows | Medium | queue times, family, cost, upgrade starts | Flexibility and strategic shifts | V2 |
| Planned army value at times | Yes | Queue amounts and cost table | B | Cumulative command-priced military queues by time | Medium; not live army value | unit cost, amount, time, cancellation | Commitment curve | V1 |
| Military production buildings | Yes | BUILD | B | Count and time placement orders by family | High for orders | building ID, time, position | Infrastructure and production breadth | V1 |
| Production building use | Yes | Queue producer IDs | B | Count distinct producer candidates referenced by queues | High for referenced IDs | queue producer IDs, building identity if known | Scale and spread of production | V1 |
| Producer attribution | Yes with fractional shared counts | Queue selected IDs and placements | B or C | Attribute exact single producers; retain candidates for multi-producer commands | High when one known producer, lower when shared | producer IDs, build events, entity types, queue times | Production continuity | V1 facts, V2 allocation |
| Blacksmith upgrades | Yes | RESEARCH | B | Classify technology starts by family and age | High for click | tech ID, time, producer | Readiness and timing | V1 |
| University and monastery technologies | Yes | RESEARCH | B | Count normalized research starts | High for click | tech ID, producer, time | Military support identity | V1 |
| Unit line upgrades | Yes | RESEARCH and entity graph | B | Map technology to affected line | High with correct data | technology ID, line mapping, time | Strategic commitment | V1 |
| Upgrade lag and missing upgrades | Yes | Dominant queue line and tech model | C | Compare dominant commitment with relevant researched upgrades | Medium | unit line, tech starts, age, availability | Execution and performance | V2 |
| Siege monk unique and naval focus | Yes | Queue families and structures | B plus C | Preserve exact unit evidence, then calculate role shares | High for queues, medium for focus label | unit ID, unique flag, roles, amount, cost | Portrait families and player identity | V1 facts, V2 label |
| Military production intensity | Yes | Queue series | B | Requested military amount per age minute or producer | High for queue rate | queue amount, age intervals, producer IDs | Pressure commitment | V1 metric |

## Map presence capabilities

| Capability | TownBell demonstrates? | Replay source | Direct/Reconstructed/Inferred/etc. | Likely algorithm | Accuracy/confidence | Required raw fields | Age of Friends use | V1/V2/Future |
|---|---|---|---|---|---|---|---|---|
| Building map overlay | Yes | BUILD and WALL | A plus B | Project placement coordinates by normalized structure | High for ordered positions | building ID, time, x, y, wall endpoints | Match map and evidence explorer | V1 |
| Wall length and segments | Yes | WALL | B | Rasterize endpoints and merge touching segments | High for ordered geometry | type, endpoints, actor, time | Fortification profile | V1 |
| Forward buildings | Yes | Placements and start anchors | C | Compare normalized progress from own region toward each opponent or contested zone | Medium | all start anchors, diplomacy, placement coordinates, map path context | Aggression and rivalry input | V2 |
| Deepest forward position | Yes | Placements and geometry | C | Maximum normalized penetration on directed player edge | Medium | actor start, target start/region, building point | Pairwise pressure | V2 |
| Building spread | Yes | Placements | B | Distance, convex hull or occupied-cell spread | High for geometry | building coordinates and map size | Expansion and positional style | V2 |
| Expansion claims | Yes | TC and economy placement regions | C | Cluster durable expansion orders outside home region | Medium | TC/camp/build coordinates, start anchor, resources | Map presence | V2 |
| Enemy side presence | Yes | Command coordinates and regions | C | Share of spatial commands within another player's region | Medium | actor, time, x, y, relation-at-time, region version | Directed aggression graph | V2 |
| Command coverage | Yes | Spatial commands | B | Rasterize command destinations into cells | High for command coverage | x, y, action type, actor, map dimensions | Activity breadth | V1 series, V2 metric |
| Scouting coverage | Yes | Scout-attributed spatial commands | C | Rasterize commands assigned to scout candidates before a cutoff | Low to medium | selected IDs, type attribution, destinations, time | Exploration proxy | Future |
| First look at enemy base | Yes | Camera or command coverage | C or C plus E | First relevant cell entry around target anchor | Medium; source must be named | camera path or command destinations, target region | Scouting and awareness proxy | V2 |
| Resource proximity | Yes | Initial resource objects | B plus C anchor | Distance from versioned start anchor to nearest family | High for objects, medium for anchor | object types and positions, anchor method | Map fairness and context | V1 |
| Resource control share | Yes | Resource points and spatial activity | C | Assign resource clusters to influence regions | Low to medium without unit positions | resource positions, commands, buildings, relation graph | Map control model | Future |
| High ground at fights | Yes | Terrain and inferred fight center | C | Sample elevation near cluster and compare participants | Medium | terrain grid, fight evidence, player commands | Tactical context | V2 |
| Forward economy | Indirectly | Camps farms TCs and regions | C | Identify economy orders outside home region or inside opponent-directed corridor | Medium | economy placements, resource clusters, starts, diplomacy | Risk and map presence | V2 |
| Defensive positioning | Yes through walls towers and home share | Placements and regions | C | Weight defensive structures and commands by home region | Medium | structure roles, coordinates, start region, time | Defensive playstyle | V2 |

## Combat tempo mechanics and longitudinal capabilities

| Capability | TownBell demonstrates? | Replay source | Direct/Reconstructed/Inferred/etc. | Likely algorithm | Accuracy/confidence | Required raw fields | Age of Friends use | V1/V2/Future |
|---|---|---|---|---|---|---|---|---|
| Explicit control-command counts | Yes | PATROL, attack move, attack ground, stance, formation, stop, repair, garrison | B | Count normalized action types by player and window | High | action code, actor, selected IDs, target, time | Army management profile | V1 |
| Fight detection | Yes | Hostile-looking command clusters | C | Spatiotemporal clustering with minimum participants and evidence threshold | Medium | action types, positions, actor, diplomacy-at-time, terrain | Interaction and pressure events | V2 |
| Fight duration and frequency | Yes | Inferred fights | C | Aggregate cluster windows | Medium to low | engagement IDs, start/end, evidence commands | Match tempo | V2 |
| Fight opener and initiative share | Yes | First command in inferred cluster | C | Assign earliest qualifying actor and compare totals | Medium | ordered evidence commands and actors | Proactive style and rivalry | V2 |
| Fight command share and APM in fights | Yes | Commands inside inferred windows | B over C windows | Intersect action stream with engagement windows | Medium | action times, engagement membership | Execution under pressure | V2 |
| Raid detection | Yes | Activity near opponent economy region | C | Cluster directed hostile activity in target home/economy zone | Low to medium | relation graph, actor, target region, commands, selected-type evidence | Rivalry and pressure | V2 |
| Raid response time | Yes only where applicable | Inferred raid and defender response | C | Time from raid onset to qualifying defender command | Low to medium | raid start, defender commands, region, selected IDs | Execution and repeated matchup behavior | Future |
| Garrison town bell and back to work response | Yes | Explicit commands plus inferred raid | A plus C | Count direct commands in pressure windows | High for commands, medium for causal link | action type, target IDs, raid windows | Defensive execution | V2 |
| Reinforcement delay | Yes | Queue or movement near fights | C | Time from engagement onset to qualifying new actor command | Low to medium | engagement, command positions, selected IDs | Teamwork and response | Future |
| Pressure minutes | Yes | Inferred hostile activity | C | Union of directed pressure windows | Medium | engagement and raid windows | Aggression and rivalry volume | V2 |
| Inactivity and action gaps | Yes | ACTION clock | B | Calculate gaps and windowed action rates | High for input inactivity | actor, timestamps, pause state | Execution consistency | V1 |
| Raw APM | Yes | ACTION operations | B | Actions divided by active replay minutes | High under declared inclusion rule | actor, action time/type, pauses, duration | Input-rate baseline | V1 |
| Effective APM | Yes | Deduplicated actions | C | Collapse repeated or low-information actions using versioned rule | Definition-dependent | full ordered action stream and payload | Decision-rate proxy | V2 |
| Selections and batches | Yes | Selected IDs and queue amounts | B | Distribution of selection size and queue amount | High for decoded payload | action type, object IDs, amount | Mechanics profile | V1 |
| Rally-point behavior | Yes | GATHER_POINT | B plus C taxonomy | Count targets and classify resource, object or ground | High for raw target, medium for type | target ID/type, coordinates, producer IDs | Production habits | V1 |
| Command bursts and breadth | Yes | ACTION stream | B or C | Bucket time and command categories; apply burst threshold | High for breadth, medium for burst label | action times and normalized categories | Multitasking proxy | V2 |
| Multitasking during fights | Yes | Economy commands intersect inferred fights | C | Measure category and region switching within fight windows | Medium at best | full actions, locations, categories, engagements | Execution profile | V2 |
| Recorder camera coverage and entropy | Yes | VIEWLOCK | B plus E | Grid path and calculate visited share or entropy | High for recorder path | time, camera x/y, recorder, map size | Attention profile | V2 |
| Camera pan jump and home share | Yes | VIEWLOCK and regions | C plus E | Classify successive displacement and region membership | Medium | filtered path, time deltas, home region | Attention and execution | V2 |
| Offscreen commands | Yes | VIEWLOCK plus command coordinates | C plus E | Compare command point with estimated viewport | Medium; viewport and command semantics matter | camera path, viewport model, command point | Recorder-only multitasking proxy | Future |
| Team fight participation | Yes where teams exist | Inferred fights and static/dynamic relations | C | Measure ally overlap in the same spatial-temporal event | Medium | participants, teams/diplomacy-at-time, event evidence | Teamwork model | V2 |
| Team role | Yes as a metric, unavailable in supplied FFA | Fundamentals | C | Classify support, flank, pocket, pressure or boom with mode-aware rules | Low to medium | positions, teams, tribute, production, pressure, map | Team identity | Future |
| Multi-game comparisons | Publicly demonstrated | Stored per-match metrics | B | Align metric versions and compare player windows | High for comparable fundamentals | stable player ID, metric version, context, availability | Trends and recurring tendencies | V2 |
| Percentile benchmarks | Publicly demonstrated | Aggregate match store | B plus cohort design | Compute distributions by patch, mode, map and rating cohort | High statistically if cohort is controlled | versioned metric values and cohort fields | Contextual performance | Future |
| Persistent playstyle | Publicly demonstrated in comparison form | Multi-game fundamentals | C | Recency-weighted, context-normalized latent tendencies | Medium; requires stability testing | per-game economy, military, map, execution fundamentals | Profile and portrait evolution | Future |

# E Recommended Age of Friends replay architecture

## Architectural decision

Adopt an event-sourced canonical representation with four separately versioned layers. The original replay remains the ultimate source artifact. Layer 1 contains immutable parser facts. Layer 2 contains deterministic or explicitly modeled reconstructions. Layer 3 contains analytical metrics and fundamental series. Layer 4 contains Age of Friends scoring and relationship or portrait decisions. Each layer references evidence from the layer below.

![Age of Friends replay data layers](architecture-layers.png)

| Layer | Contents | May change when | Historic replay handling |
|---|---|---|---|
| Source replay | Immutable `.aoe2record`, SHA256, byte length and retention reference | Never | Retain for parser regression and future extraction. |
| Layer 1 parser facts | Header facts, initial map state, raw operations, decoded action fields, raw IDs, coordinates, unknown bytes | Replay format decoder or schema extraction changes | Reparse only if the new parser needs fields that were not stored. |
| Layer 2 reconstructed facts | Queue ledger, diplomacy intervals, normalized entities, planned commitments, age intervals, spatial anchors | Game-data tables or reconstruction algorithms change | Recompute from Layer 1 when inputs are sufficient. |
| Layer 3 analytical metrics | Economy, military, map, execution, performance, teamwork and playstyle features | Metric formula or cohort changes | Recompute from Layers 1 and 2. No replay parse. |
| Layer 4 league interpretations | Match points, rivalry progression, portrait state, awards, War Room unlock inputs | League rules or product design changes | Recompute from stored fundamentals and relationship history. |

The logical schema is supplied as `canonical-replay-v1.schema.json`. Physical storage may split large collections into immutable artifacts and Firestore subcollections without changing the logical object.

## Canonical root

| Field | Purpose |
|---|---|
| `schemaVersion` | Version of the canonical logical contract. Use semantic versioning and explicit migrations. |
| `versions` | Independent parser, normalizer, entity-data, reconstruction, spatial and interaction versions. |
| `source` | SHA256, size, format, save/build/log versions, parse time, recorder, retention reference, compatibility and decode coverage. |
| `match` | GUID, duration, completion status, settings, winner evidence and privacy flags. |
| `participants` | Stable match player IDs, profile identity, raw slot, name, civilization ref, team field, recorder scope and initial objects. |
| `teams` | Explicit fixed, solo, FFA-initial or scenario teams; never infer team membership from a single numeric convention without preserving the raw value. |
| `initialDiplomacy` | Directed stance for every player pair when known. |
| `initialState` | Map dimensions, coordinate system, terrain store, initial typed objects and optional versioned start anchors. |
| `factStore` | Manifest for every Layer 1 event, with operation and action counts, unknown-action counts, and inline or chunk references. |
| `reconstructionSets` | One or more versioned Layer 2 projections and their assumptions. |
| `interactionSets` | Directed player-pair edges and event references under a named model version. |
| `metricSets` | Versioned match, player, team or pair metrics with availability and evidence. |
| `leagueInterpretationRefs` | References only. League rules remain outside the canonical replay. |
| `warnings` | Machine-readable parse, normalization, coverage and inference warnings. |

## Event envelope

Every event needs a stable envelope before event-specific payload fields.

| Field | Requirement and rationale |
|---|---|
| `eventId` | Stable ID derived from source hash, operation ordinal and optional subevent ordinal. It must not depend on a metric version. |
| `layer` | `parser_fact` or `reconstructed_fact`. Analytics are stored as metrics, not disguised as events. |
| `eventType` | Namespaced semantic type such as `command.unit_queue`, `system.age_reached`, or `reconstruction.diplomacy_interval`. |
| `timestampMs` | Canonical replay time. Also store sync elapsed, restore offset and action sequence in `clock`. |
| `operationOrdinal` | Total ordering across ACTION, CHAT, VIEWLOCK and other operations. Timestamps alone can collide. |
| `byteOffset` and `byteLength` | Optional but strongly recommended for traceability and targeted decoder tests. |
| `sourceOperation` | HEADER, INITIAL_OBJECT, MAP_TILE, SYNC, VIEWLOCK, CHAT, ACTION, START, SAVE or POSTGAME. |
| `sourceActionCode` and `sourceActionName` | Preserve numeric code even if the name is unknown or changes. |
| `actorPlayerId` and `targetPlayerId` | Direct actor and target where encoded. Do not fill a target player from proximity without moving it to Layer 2. |
| `objectInstanceIds` and `targetInstanceId` | Raw selected, producer, builder or target instances. Preserve order and duplicates if the replay contains them. |
| `entity` | Raw namespace and ID plus versioned normalized key, line, family and roles. Raw ID is mandatory even when resolution fails. |
| `position` and `endPosition` | Raw world coordinates and optional tile coordinates. A wall uses both. |
| `payload` | Event-specific decoded fields, including unknown numeric values that may become meaningful later. |
| `decode` | Complete, partial, unknown action or failed; known and unknown byte counts; unknown tail bytes; warning codes. |
| `evidence` | A–F class, confidence, method version, assumptions and source event IDs. |

An event should remain lossless enough that a future metric can use fields the current dashboard ignores. For example, do not store only `selectionSize = 12`; retain the 12 instance IDs. Do not store only `marketVolume = 300`; retain each resource, direction, amount, market instance and timestamp.

## Layer 1 parser fact types

| Canonical primitive | Description | Replay source | Key fields | Class |
|---|---|---|---|---|
| `match.header_fact` | One normalized match setting with raw value and path | Header | field path, raw value, normalized value | A |
| `player.header_fact` | Player slot and identity facts | Header | player, profile, civ, color, handicap, team | A |
| `map.tile` | Initial terrain and elevation | Header map grid | x, y, terrain ID, elevation | A |
| `object.initial` | Initial object snapshot | Header players and Gaia | owner, object/class/instance ID, position | A |
| `clock.sync` | Replay clock increment and opaque checksum payload | SYNC | increment, checksum, raw per-player integers | A |
| `camera.view` | Recorder camera position | VIEWLOCK | time, x, y, recorder | A plus E |
| `chat.raw` | Raw chat operation | CHAT | bytes, parsed actor/audience if known, system subtype | A |
| `system.age_reached` | Direct age notification | CHAT system event | player, age, time | A |
| `command.move` | Destination order | MOVE | actor, selection, x, y | A |
| `command.order` | Generic targeted order | ORDER | actor, selection, target ID, x, y | A |
| `command.patrol` | Patrol destination | PATROL | actor, selection, x, y | A |
| `command.attack_move` | Explicit attack-move destination | DE_ATTACK_MOVE | actor, selection, x, y | A |
| `command.attack_ground` | Explicit ground target | ATTACK_GROUND | actor, selection, x, y | A |
| `command.special` | Special order such as garrison | SPECIAL | order ID, slot, selection, target, x, y | A |
| `command.stance` | Stance setting | STANCE | stance ID, selection | A |
| `command.formation` | Formation setting | FORMATION | formation ID, selection | A |
| `command.guard_follow` | Guard or follow target | GUARD or FOLLOW | selection, target instance | A |
| `command.stop` | Stop selected objects | STOP | selection | A |
| `command.repair` | Repair target | REPAIR | selection, target instance | A |
| `command.garrison` | Garrison request normalized from SPECIAL | SPECIAL | selection, target | A plus normalization |
| `command.ungarrison` | Ungarrison request | UNGARRISON | source, selection, target or point | A |
| `command.town_bell` | Town Bell toggle | TOWN_BELL | building, mode | A |
| `command.back_to_work` | Back-to-work request | BACK_TO_WORK | object instance | A |
| `command.delete` | Delete request | DELETE | actor, object instance | A |
| `command.unit_queue` | Unit queue request | DE_QUEUE, QUEUE or MAKE | unit ID, amount, producer candidates | A |
| `command.research_start` | Technology or age research request | RESEARCH | technology ID, producer, actor | A |
| `command.build_placement` | Building placement request | BUILD | building ID, builders, x, y | A |
| `command.wall_placement` | Wall-line placement | WALL | structure ID, builders, endpoints | A |
| `command.rally_point` | Rally target | GATHER_POINT and DE_MULTI_GATHERPOINT | producer, target ID/type, point | A |
| `command.market_buy` | Buy request | BUY | resource ID, amount, market instance | A |
| `command.market_sell` | Sell request | SELL | resource ID, amount, market instance | A |
| `command.tribute` | Directed resource transfer request | TRIBUTE or DE_TRIBUTE | actor, target player, resource vector, fee | A |
| `command.diplomacy_change` | Directed stance change | GAME diplomacy command | actor, target player, mode | A |
| `command.flare` | Map flare | FLARE | actor, point, recipient mask | A |
| `command.autoqueue_setting` | Farm, fish trap or related setting | GAME commands | actor, setting, value | A |
| `command.resign` | Resignation | RESIGN | actor, time | A |
| `save.chapter` | Save or restore boundary | SAVE or header restore fields | time, chapter metadata | A |
| `postgame.block` | Parsed postgame block | POSTGAME | block type, raw and decoded values | A when present |
| `action.unknown` | Unrecognized or partially decoded action | ACTION | code, bytes, actor if known, offset | A bytes |

Avoid `UnitCreated`, `BuildingCreated`, `TechnologyCompleted`, or `ResourceSpent` in Layer 1 unless a future decoder finds an explicit event that proves the name.

## Layer 2 reconstructed fact types

| Reconstructed primitive | Method | Evidence class and limit |
|---|---|---|
| `clock.timeline_position` | Accumulate SYNC increments and restore offsets | B; deterministic when the body is intact. |
| `chat.logical_message` | Collapse duplicate transport records and separate system messages | B; language semantics remain outside this fact. |
| `entity.normalized` | Resolve raw IDs to versioned entity, line, family and roles | B; external data version required. |
| `diplomacy.interval` | Fold initial stance and directed changes into `[start,end)` | B; preserve one-way versus mutual state. |
| `team.interval` | Derive effective team components only under a declared relation rule | B or C; especially cautious in diplomacy-enabled FFA. |
| `start.anchor` | Select TC, scenario marker, unit centroid or first settlement order | C; store method and alternatives. |
| `spatial.region` | Generate home, opponent, neutral and contested regions | C; version geometry. |
| `wall.tile_set` | Rasterize line endpoints and merge adjacent ordered tiles | B for order geometry; completion unknown. |
| `queue.ledger_delta` | Interpret enqueue, batch, multiqueue, cancel and autoqueue | B only after controlled validation; otherwise C. |
| `production.expected_completion` | Schedule queue against known producer and duration | C without full state; never call actual creation. |
| `building.expected_completion` | Apply builder/time model | C and usually too fragile for canonical metrics. |
| `technology.expected_completion` | Apply duration and queue assumptions | B or C; direct age system event supersedes it. |
| `resource.gross_commitment` | Price commands with patch/civ data | B; not live spend or bank state. |
| `producer.candidates` | Preserve all producer IDs named in a queue | B; exact when one producer, unresolved when several. |
| `command.intent` | Classify generic ORDER from target type, owner and context | C; retain the raw order. |
| `first_observed_instance_use` | First action selecting a previously unseen instance | B; type may remain unknown. |
| `interaction.target_edge` | Assign an action to a player when target ownership is known | B for known owner, C for region-based target. |
| `engagement.command_cluster` | Cluster hostile-looking commands | C; not actual combat. |
| `raid.command_cluster` | Cluster directed activity in a target economy region | C; not damage or kills. |

## Entity normalization

Every replay entity reference needs these fields:

- Raw namespace and ID exactly as decoded.
- Display name at the chosen entity-data version.
- Stable normalized key independent of localization.
- Upgrade-line key, such as `archer_line` or `scout_cavalry_line`.
- Analytical family, such as infantry, archer, skirmisher, spear, light cavalry, heavy cavalry, cavalry archer, siege, monk, naval combat, fishing, trade, transport, villager, hero, animal, resource or structure.
- Role tags, including economic, military, support, defensive, production, siege, gunpowder, unique, trash, naval and population-bearing.
- Civilization availability and modifiers as versioned data, never baked into the parser event.
- Resolution status and warnings for new patches, scenarios and mods.

The entity table should be an immutable snapshot identified by content hash. Siege Engineers' tech-tree and reference-data projects provide useful source data, but Age of Friends still needs its own normalization overlay for analytical families and historic patch consistency.[10][11]

## Spatial model

Keep the AoE2 world coordinate system untouched in Layer 1. Layer 2 may add several independent spatial views:

1. A uniform cell index for command and camera coverage.
2. Player start-anchor candidates with methods and confidence.
3. Home regions around observed settlement evidence.
4. Directed corridors from player A toward player B.
5. Neutral and contested resource clusters.
6. Building, wall and command point indexes for radius and nearest-neighbor queries.

No single map half should become canonical. On an eight-player FFA, a coordinate can be toward one opponent, away from another, and inside a third player's later settlement. Store directed spatial features keyed by source and target players.

## Interaction graph

Represent interaction as a directed multigraph over time.

![Time-varying directed interaction graph](interaction-graph.png)

An interaction edge stores raw counts, reconstructed facts and inferred events separately. Recommended edge fields include:

- `fromPlayerId`, `toPlayerId`, time window and relation-at-time.
- Direct diplomacy changes, tribute vectors, flare targets and explicit target-object commands with known ownership.
- Building placements in a directed corridor and command presence in the target region.
- Inferred aggression, raids, shared engagements, responses, assistance and focus shares, each with evidence IDs and confidence.
- Cross-match result records and recurrence counts, stored outside the individual replay but referencing match IDs.

Do not collapse the graph to a single opponent during extraction. A UI can later select the most relevant edge for a particular view.

## Metric value contract

A metric must carry more than a value.

```json
{
  "key": "military.queue_amount.archer_line",
  "scope": {"type": "player", "id": "matchPlayer:4"},
  "status": "available",
  "value": 41,
  "unit": "requested_units",
  "metricSetVersion": "fundamentals-1.0.0",
  "evidence": {
    "classification": "B",
    "confidence": "exact",
    "methodVersion": "queue-aggregation-1.0.0",
    "sourceEventIds": ["2dd7a9a6:op:18340"]
  }
}
```

Allowed availability should include `available`, `not_applicable`, `not_observable`, `insufficient_evidence`, `parser_error`, and `unsupported_version`. A bare null cannot distinguish these cases.

## Firestore and artifact persistence

Cloud Firestore limits a document to 1 MiB and is designed around collections of small documents.[6][7] The supplied replay is 7.6 MB and contains 454,120 operations, so neither the replay nor a complete event array belongs in one match document.

Recommended physical layout:

```text
Cloud Storage or equivalent immutable object storage
  replays/{sha256}.aoe2record
  canonical/{sha256}/{schemaVersion}/facts-00001.jsonl.gz
  canonical/{sha256}/{schemaVersion}/terrain.parquet
  canonical/{sha256}/{schemaVersion}/initial-objects.jsonl.gz
  reconstructions/{sha256}/{reconstructionVersion}/events-00001.jsonl.gz

Firestore
  matches/{matchId}
  matches/{matchId}/participants/{playerId}
  matches/{matchId}/eventChunks/{chunkId}
  matches/{matchId}/interactionEdges/{from_to_modelVersion}
  matches/{matchId}/metricSets/{scope_metricSetVersion}
  playerProfiles/{profileId}/matchFacts/{matchId}
  playerProfiles/{profileId}/profileModels/{modelVersion}
  relationships/{orderedPairId}/seasons/{seasonId}
```

The `eventChunks` documents should be manifests and query indexes, not copies of every payload if object storage is used. A chunk manifest records hash, byte length, record count, ordinal range, time range, actor set, event-type set and artifact URI. Query-specific materializations can store selected economy, military, spatial or interaction events in Firestore when product latency requires them.

Index exemptions should be used for large opaque maps or arrays that never need field queries. Deletion logic must explicitly remove subcollections because deleting a parent Firestore document does not delete its subcollections.[7]

## Versioning and reanalysis rules

| Version | Owns | Reparse replay? |
|---|---|---|
| `parserVersion` | Binary layout and action decoding | Yes when newly decoded fields are required. |
| `schemaVersion` | Canonical fact contract | Only if migration cannot express required new facts. |
| `normalizerVersion` | Mapping decoded operations to canonical event types | No if raw decoded fields are stored. |
| `entityDataVersion` | Names, costs, times, families and availability | No. Re-normalize from raw IDs. |
| `reconstructionVersion` | Queue, clock, age, diplomacy and other Layer 2 logic | No. Recompute from Layer 1. |
| `spatialModelVersion` | Anchors, regions, corridors and clusters | No. Recompute from stored coordinates. |
| `interactionModelVersion` | Engagement, raid, support and pair-edge rules | No. Recompute from stored events. |
| `metricSetVersion` | Fundamental and analytical formulas | No. Recompute from facts. |
| `leagueScoreVersion` | Points, Gallantry, Treachery, Chivalry, portrait rules | No. Recompute from metrics and histories. |

Every batch reanalysis should be idempotent. New outputs are written under a new version, validated, then promoted by pointer. Historic versions remain queryable until retention policy removes them.

# F Fundamental statistics

Fundamentals should describe observable behavior and bounded reconstructions. They should remain useful even if Age of Friends later changes its performance, teamwork, playstyle, or relationship formulas.

## Economy fundamentals

| Fundamental | Canonical definition | Class | Required inputs | Important limit |
|---|---|---|---|---|
| Villager queue amount | Sum of validated Villager queue-ledger additions | B | Unit queue events, amounts, entity family | Requested, not confirmed trained. |
| Villager queue commands | Number of Villager queue actions | B | Queue event IDs | Separate from amount and UI batching. |
| Villager queue cadence | Distribution of time gaps between Villager queue additions by producer candidate | B | Time, producer IDs, queue ledger | Does not prove TC occupancy. |
| Projected villager completions | Expected completions under named queue and train-time assumptions | C | Queue ledger, producer model, civ/patch train times | Resource blocks, pop blocks and producer loss are not known. |
| TC queue occupancy estimate | Expected occupied intervals for each known TC | C | Queue/research events, producer IDs, durations | Multiple selected TCs and cancellations reduce certainty. |
| TC idle estimate | Complement of expected occupancy while the TC is assumed active | C | TC occupancy, existence interval assumptions | Never label exact idle time without engine validation. |
| Age advance start | Direct age RESEARCH event | A | Technology ID and timestamp | Repeated/cancelled clicks need queue reconciliation. |
| Age reached | Direct system age event, otherwise unavailable or separately projected | A or C | System event; optional research model | Preserve observed and projected values separately. |
| Economy structure orders | Count and times of farms, camps, mills, markets, docks, TCs and trade structures | B | BUILD events and entity roles | Ordered, not necessarily completed. |
| Expansion orders | TC and economy placements outside the current home region | C | Build coordinates, start/home model, resource clusters | Region model is versioned. |
| Economy research starts | Research clicks grouped by food, wood, gold, stone, farm, trade and vision roles | B | Research events, tech taxonomy | Completion is separate. |
| Gross economy commitment | Command-priced economy queues, structures and technologies by resource and time | B | Events, cost tables, civ modifiers | Not resource gathered, bank balance or net spend. |
| Market commands | Buy and sell count and amount by resource | B | BUY/SELL events | Resulting price and bank require validation or simulation. |
| Tribute flow | Directed sent, received and net resource vectors | B | Validated tribute events | Separate fee and zero/setup records. |
| Trade commitment | Trade-unit queue amount and market/dock placement | B | Queue and build events | Does not prove trade routes or income. |
| Resource task targets | Distinct known sheep, hunt, herdable, berry, tree, gold, stone and fish objects targeted | B or C | ORDER target IDs and initial objects | Later moved/converted/depleted objects may be ambiguous. |
| Economic command activity | Economy-tagged actions per fixed and age-relative window | B | Canonical command categories | Activity is not efficiency. |
| Post-pressure recovery | Change in economy queue, research and placement activity after an inferred raid | C | Raid windows and economy series | Measures behavioral response, not recovered resources. |

Recommended stored time series include queue additions by entity, gross commitment by resource and purpose, direct age states, economy command counts, producer candidate activity, and structure placements. Fixed 30-second chart buckets can be materialized later; they should not be the only stored form.

## Military fundamentals

| Fundamental | Canonical definition | Class | Required inputs | Important limit |
|---|---|---|---|---|
| Exact unit queue ledger | Every queue addition or cancellation by raw unit ID | A then B | Raw queue commands, amount semantics | Do not aggregate away event order. |
| Queue amount by unit | Requested additions minus validated cancellations for each unit ID | B | Queue ledger | Not actual trained count. |
| Queue amount by line | Unit amount grouped by upgrade line | B | Entity line mapping | Version entity data. |
| Queue amount by family | Unit amount grouped by role family | B | Entity family tags | Preserve exact units beneath group. |
| Planned military commitment | Command-priced military unit requests by time and resource | B | Queue events and costs | Not surviving army value. |
| First non-villager queue | Earliest queue not classified as Villager | B | Queue plus taxonomy | Keep separate from combat unit. |
| First combat-unit queue | Earliest queue with a military-combat role | B | Queue plus role tags | Fishing, trade and transport are excluded. |
| First land and naval combat queue | Earliest qualifying event in each domain | B | Queue plus domain tags | Avoid water noise in land identity. |
| Production structure orders | Military building placement by type, time and location | B | BUILD events and structure roles | Order, not completion. |
| Producer candidate usage | Distinct producer IDs named in military queues | B | Queue object IDs | Unknown type and multi-producer attribution must remain explicit. |
| Research starts by military family | Blacksmith, university, monastery, line and unique technologies | B | RESEARCH plus technology graph | Click, not completion. |
| Expected upgrade completion | Research start plus validated queue duration | B or C | Producer queue, duration, civ modifiers | Use only with assumptions and confidence. |
| Composition commitment series | Queue amount and planned cost by family over time | B | Queue ledger and costs | It is a production-intent composition. |
| Transition candidates | Sustained family-share changes across windows | C | Composition series | Window and threshold dependent. |
| Siege commitment | Siege queues, workshops, castles and relevant upgrades | B | Unit/building/research events | Does not prove battlefield siege count. |
| Monk commitment | Monk queues, monasteries and monk technologies | B | Unit/building/research events | Conversions and relic captures require state. |
| Unique-unit focus | Share of eligible military commitment in civilization-unique lines | C | Queue line, unique tag, availability | Normalize for civ and game duration. |
| Naval commitment | Warship queues, docks and naval technologies | B | Queue/build/research events | Keep fishing, trade and transport separate. |

For portrait and identity systems, retain queue count, queue amount, planned resource cost, first and last request times, producer breadth, upgrade support, land/naval domain, exact unit IDs and family shares. A future engine layer can add actual completions and survival without replacing these intent fundamentals.

## Map presence fundamentals

| Fundamental | Canonical definition | Class | Required inputs | Important limit |
|---|---|---|---|---|
| Initial map object index | Typed and untyped initial objects with owner and position | A | Header objects | Entity resolution can be unknown. |
| Terrain and elevation index | Full initial grid | A | Header tiles | Dynamic changes are not guaranteed. |
| Start-anchor candidates | All plausible player anchors and chosen method | C | Initial objects and first settlement events | Never store only one unexplained point. |
| Building placement stream | Every structure order with coordinates | A | BUILD events | Completion unknown. |
| Wall placement geometry | Every wall order and deterministic ordered-tile set | A plus B | WALL endpoints | Completed tiles unknown. |
| Spatial command stream | Every command point and target point | A | MOVE, ORDER, PATROL, attack, rally, flare and build actions | Destination is not actual unit position. |
| Command cell coverage | Distinct cells touched by commands by player and window | B | Spatial commands and grid version | Activity coverage, not exploration. |
| Home-region activity | Commands and placements within a versioned home region | C | Regions and spatial events | Home boundary changes with expansion. |
| Directed opponent-region activity | A's events in B's region while B is hostile | C | Relation intervals, regions, spatial events | Pair and relation time are mandatory. |
| Neutral-region activity | Events outside all home regions | C | Region model | Region resolution can overlap. |
| Contested-cell activity | Cells with qualifying events from multiple hostile players | C | Spatial index and diplomacy | Commands need not mean control. |
| Forward structure order | Structure position beyond a directed progress threshold from A toward B | C | A and B anchors/regions, structure point | A structure can be forward toward several players. |
| Forward economy order | Economy structure in neutral, contested or hostile-directed region | C | Building role and regions | Does not prove workers stayed there. |
| Expansion candidate | New TC or economy cluster beyond home radius | C | Placements and cluster logic | Settlement success unknown. |
| Fortification profile | Ordered wall tiles, gates, towers, castles and defensive density by region | B plus C | Structure events and regions | Orders may be cancelled. |
| Resource access geometry | Initial resource distances and cluster orientation relative to anchors | B plus C | Resource objects and anchors | Not ongoing ownership or collection. |
| Camera cell series | Recorder camera occupancy by cell | B plus E | Raw camera events | Recorder only. |

Map presence should use pairwise and multi-region outputs rather than one `enemyHalfPresence` field. The raw spatial stream permits future Voronoi, travel-distance, chokepoint, resource-corridor, density and graph models without reparsing.

## Execution fundamentals

| Fundamental | Canonical definition | Class | Required inputs | Important limit |
|---|---|---|---|---|
| Raw action count | Count of included ACTION operations | B | Action events and inclusion policy | Store counts by raw and canonical type. |
| Raw APM | Included actions per active replay minute | B | Timestamps, pause/restore model, duration | Do not compare across incompatible inclusion versions. |
| Action-gap distribution | Median, percentiles, longest gap and count over thresholds | B | Ordered action times | An input gap is not player idleness. |
| Command-type breadth | Number and distribution of canonical command categories | B | Event types | Breadth is not quality. |
| Selection-size distribution | Count, median, percentiles and maximum selected IDs | B | Full selected ID lists | Some actions omit or misdecode selections. |
| Queue batch distribution | Requested amount and producer candidate count | B | Queue payloads | Batch semantics need controlled validation. |
| Rally-point discipline | Frequency, target class and change cadence | B plus C | Rally events and target resolution | Strategic quality is not direct. |
| Effective action count | Deduplicated or weighted decisions | C | Full ordered events and payload signatures | Definition-dependent. |
| Region-switch rate | Frequency of command-region changes | C | Spatial events and region model | High switching can be good or wasteful. |
| Category-switch rate | Frequency of economy, production, military and map command switches | C | Event categories and time | A proxy for multitasking. |
| Simultaneous task load | Number of active regions/categories in a rolling window | C | Event windows | It measures commands, not attention. |
| Production continuity proxy | Gaps in queue additions or expected producer occupancy | C | Queue ledger and producer model | Not exact idle time. |
| Timing execution | Difference between observed event and player/civ/map-specific benchmark | C | Fundamental event and cohort | Benchmark choice must be versioned. |
| Pressure response latency | Time to a qualifying defensive command after inferred pressure begins | C | Pressure event and defender actions | Causality cannot be proved. |
| Economy during pressure | Economy actions or queue additions within inferred engagement windows | B over C window | Actions and engagement membership | Not actual economic output. |
| Camera transitions | Recorder pans, jumps, revisits and dwell | B or C plus E | Camera path and viewport model | Recorder only. |

Execution fundamentals should not be combined into a single skill score at extraction time. Keeping separate distributions lets future league systems decide whether consistency, speed, response, or production discipline matters for a particular event format.

# G Advanced models

Advanced models consume stored fundamentals. Their outputs are versioned interpretations with evidence, confidence, applicable match modes and cohort context. They never overwrite the underlying match facts.

## Performance

Performance asks how effectively a player performed in one match. A parser-only system cannot measure effectiveness solely from military commands because it lacks damage, casualties, resources and live army state. The model should therefore expose a vector before any composite score.

| Performance dimension | Defensible inputs | Class | Mode handling |
|---|---|---|---|
| Result | Explicit resignations, team state, validated victory evidence | A plus B | Team result for fixed teams; individual placement only when evidence supports it. |
| Timing execution | Age events, first commitments and context-specific benchmarks | C | Normalize by civilization, start, map, speed and settings. |
| Economy continuity | Villager queue cadence and TC occupancy estimate | C | Compare like-for-like producer opportunity, not raw TC count alone. |
| Military commitment | Planned military queue and upgrade investment | B | Report commitment, not damage or efficiency. |
| Strategic transition | Sustained changes in queue families and supporting upgrades | C | Do not penalize map- or civ-required transitions. |
| Map activity | Command coverage, forward placements and contested-region activity | C | Use all opponent edges in FFA. |
| Pressure created | Directed engagement and raid evidence | C | Preserve target distribution and confidence. |
| Pressure response | Defensive command latency and continued production proxies | C | Only when a qualifying pressure event exists. |
| Execution consistency | Action gaps, queue gaps, timing deviations and command completeness | B plus C | Treat pauses, disconnects and short games explicitly. |
| Contribution in team fights | Shared engagement participation and support events | C | Applicable only when stable teams or alliances exist at the time. |

A future composite `PerformanceScore` may weight these dimensions for a season or game type. Its record should contain the formula version, component values, context cohort, missing-data policy and uncertainty. A score formula change should regenerate only Layer 4.

## Teamwork

Teamwork must distinguish direct support from inferred coordination.

| Teamwork signal | Observable basis | Class | Claim allowed |
|---|---|---|---|
| Tribute to ally | Directed tribute event while allied | A plus B relation | Exact commanded support vector after payload validation. |
| Flare to ally | Flare recipient mask and point | A | Communication attempt, not response. |
| Mutual diplomacy | Directed alliance intervals | A plus B | Relationship state in diplomacy-enabled games. |
| Coordinated pressure | Allied players have hostile-directed events in the same region and time window | C | Spatial-temporal coordination proxy. |
| Shared engagement | Allies appear in the same inferred engagement | C | Participation proxy, not damage contribution. |
| Assistance response | Player enters an ally's threatened region after pressure begins | C | Response proxy with latency and evidence. |
| Defensive construction near ally | Defensive placement in ally or shared region | C | Supportive positioning proxy. |
| Complementary military commitment | Allies invest in distinct, potentially complementary families | C | Composition complement, not proof of strategic coordination. |
| Trade and sling support | Trade commitment and repeated tribute flow | B plus C | Resource-support tendency. |
| Self-focused activity | Low support evidence relative to opportunity | C | Absence of observed support, not selfish intent. |

The model should calculate opportunity before judging absence. A player cannot assist a threatened ally if the match has no stable ally, no detected pressure, or no meaningful travel window. Every teamwork output needs an applicability status.

## Playstyle

The following sliders are supportable as persistent tendencies when normalized for civilization, map, match mode, duration, team role and patch. They remain class C.

| Slider | Evidence toward first pole | Evidence toward second pole | Main caveat |
|---|---|---|---|
| Aggressive to defensive | Early hostile-directed activity, forward military structures, first engagement initiation | Home-region defensive structures, garrison responses, low directed reach | Commands do not prove damage or intent. |
| Greedy to military committed | TC expansion, economy commitment and delayed combat queues | Early military queue, upgrades and production structures | Civ and map openings can dictate investment. |
| Proactive to reactive | Pressure or transition precedes opponent activity | Major actions follow detected pressure or opponent spike | Response causality is inferred. |
| Mobile to positional | Wide move/patrol coverage, repeated region changes, mobile-family commitment | Fortifications, concentrated commands, siege/static defense | Destination coverage is not actual unit movement. |
| Focused to multitasking | Long single-region/category runs | Concurrent category and region switches | More commands do not necessarily mean better attention. |
| Booming to pressure | Multiple TC/economy orders and villager queue commitment | Forward structures, early military commitment and pressure minutes | Custom starts require opportunity normalization. |
| Raiding to frontal fighting | Repeated hostile activity in economy regions across edges | Larger central or fortified engagement clusters | Both event types are heuristic. |
| Open to fortified | Few walls and defensive placements | High wall, gate, tower and home-defense density | Ordered structures may not finish. |
| Specialist to flexible | Low family entropy and repeated lifetime line choice | Sustained transitions and broad family use | Diversity caused by counter-units is not necessarily flexibility. |
| Naval to land focused | Warship/dock/naval-tech commitment | Land production and activity | Only compare on maps where both domains are available. |
| Supportive to self-directed | Tribute, allied response, shared pressure and support structures | Low support evidence given opportunity | Never convert absence directly into a moral label. |

Store the component features and uncertainty for each slider. A profile service can later change weights or names without touching replay parsing.

## Model governance

Every advanced model record should include:

- Model name and semantic version.
- Applicable modes, maps, patches and minimum evidence.
- Input metric-set versions and exact feature values.
- Output vector, confidence and unavailable reasons.
- Cohort or normalization parameters.
- Calibration corpus and evaluation date.
- Evidence event references for match-level explanations.
- A statement of what the model does not measure.

Do not train or calibrate on a mixed population without storing the match context. An FFA diplomacy game, a locked-team 4v4, and a standard 1v1 create different opportunities for pressure, support and survival.

# H Social system primitives

The social system should store relationship evidence, not moral conclusions. Gallantry, Treachery and Chivalry can later interpret the evidence under league rules. Rival, Enemy and Friend progression should read a cross-match directed relationship ledger.

## Direct and reconstructed pair facts

| Primitive | Direction | Class | Canonical fields | Potential system use |
|---|---|---|---|---|
| Diplomacy change | A to B | A | actor, target, prior mode if known, new mode, time | Alliance, betrayal and reconciliation chronology |
| Diplomacy interval | A to B | B | stance, start, end, source events | Opportunity and relation-at-time |
| Mutual alliance interval | A with B | B | overlap of A-to-B and B-to-A ally intervals | Friend opportunity and team scope |
| Tribute command | A to B | A | resource vector, fee, time, relation-at-time | Support and Chivalry input |
| Flare recipient | A to B or audience | A | point, recipient mask, time | Communication and coordination attempt |
| Explicit target-object command | A to object | A | action, target instance, actor, time, point | Raw aggression/support evidence |
| Target ownership when initial | A to B | B | target owner from initial object map | High-confidence directed interaction |
| Target ownership when spawned | A to B | C or unknown | attribution method and evidence | Directed interaction only above threshold |
| Building in directed corridor | A toward B | C | building, point, progress score, relation-at-time | Forward pressure or support positioning |
| Command in B region | A to B | C | command type, point, region score | Directed map activity |
| Shared command cluster | A with B | C | event ID, participants, time, point | Repeated confrontation history |
| Response event | B responding to A | C | initiating event, response event, latency | Rivalry and execution pattern |
| Match result edge | winner over loser | A plus B | result evidence, match ID, mode | Head-to-head rivalry record |

The `relationshipLedger` outside the replay should append immutable per-match edge contributions. It should not store only a current score. A later formula needs counts, amounts, timings, confidence, opportunity and match context.

## Defensible inferred interactions

| Candidate concept | Defensible derivation | Class | Required qualification |
|---|---|---|---|
| First aggression against B | First qualifying A-origin hostile edge event toward B | C | Depends on target and aggression classifier. |
| Repeated attacks on B | Count distinct directed pressure or engagement windows | C | Count windows, not raw repeated clicks. |
| Raid directed at B | A's hostile cluster inside B's economy region | C | Does not prove damage or villager kills. |
| Focus on B in FFA | Share of A's directed hostile evidence assigned to B | C | Include opportunity, diplomacy and ambiguous-target share. |
| Repeated confrontation | Number and duration of events containing A and B | C | Engagement detection is command-based. |
| Revenge sequence | B's directed aggression follows A's qualifying aggression within a declared interval | C | Temporal association, not motive. |
| Forward construction toward B | A's military/defensive placement has high directed progress toward B | C | A point can target multiple players; retain all edge scores. |
| Cooperative pressure | Allied A and B pressure C in overlapping windows | C | Coordination cannot be proved from overlap alone. |
| Assistance to threatened ally | A enters B's threatened region or uses support commands after pressure begins | C | Travel and response opportunity required. |
| Complementary armies | Allied queue commitment spans complementary roles | C | Strategic agreement is not observable. |
| Persistent matchup rivalry | Recurring close results and mutual pressure across games | B plus C | Requires stable identity and context normalization. |

## Claims that would become storytelling

| Claim | Why it is not statistically defensible | Treatment |
|---|---|---|
| A deliberately ignored every other threat to hunt B | The replay lacks player intention, perceived priorities and full non-recorder attention | F. Do not store as fact. A narrator may describe a high focus share with a caveat. |
| A betrayed B out of malice | Diplomacy change is direct; motive is not | F. Store the timed stance change and prior cooperation only. |
| A eliminated B | No authoritative kill or elimination event is guaranteed | D or unknown. Use explicit resignation/result evidence, never infer elimination from nearby commands. |
| A saved B | Actual damage prevented and counterfactual outcome are unavailable | F as causal claim. Store assistance evidence and timing. |
| A was selfish | Absence of support may reflect distance, role, inability or no opportunity | F as moral fact. Model support tendency only with opportunity. |
| A attacked B's economy successfully | A raid command cluster does not prove contact, damage or kills | D for success. Store inferred economic-region pressure. |
| A reacted because of a flare | Temporal order does not establish causation or whether the player noticed it | C at most. Store flare and later response separately. |
| A made the correct decision | Counterfactual game state and intention are not encoded | F without an explicitly limited benchmark model. |

## Relationship progression inputs

Gallantry may eventually draw from mutual, repeated competition: balanced head-to-head results, reciprocal engagements, close timing, contesting the same areas, and repeated rematches. These are competitive-pattern inputs, not a character judgment.

Treachery may eventually draw from diplomacy reversals after cooperation, concentrated FFA focus, attacks during an alliance transition, or repeated hostility toward the same player. The system should store the exact relation timeline and evidence windows. The name must not imply motive.

Chivalry may eventually draw from directed tribute, flares, assistance responses, defensive activity near an ally, mutual pressure, and repeated support across games. It must account for whether a player had an ally and an opportunity to help.

The War Room can use the same ledger for factual displays: matchup record, latest meetings, mutual aggression share, alliance history, direct support, contested regions, recurring army matchups, and confidence. Unlock rules remain Layer 4.

## FFA relation example

The supplied FFA demonstrates why the ledger matters. All lobby team IDs use the solo convention, but the replay records a sequence of hostility settings, later bilateral alliances, reversals between players 2 and 3, a broad set of alliances by player 6, and late-game alliance changes involving players 2, 4 and 8. A static `teamId = 1` representation cannot answer who was allied when a later command cluster occurred.

# I Player identity inputs

Portrait identity should be a slow-changing view over preserved evidence, not a label copied from the most recent match. The permanent input is an exact, patch-aware record of what the player attempted to produce and enable. The portrait system is a downstream consumer.

## Per-match military identity evidence

For every normalized trainable entity, retain both the exact entity and several independently versioned taxonomies. This avoids locking portraits to today's unit categories.

| Input | Stored form | Why it matters |
|---|---|---|
| Queue commands | entity, signed amount, time, producer IDs and source event | The most reliable command-stream measure of intended unit production. |
| Queue-ledger result | additions, removals, residual unmatched removals and ambiguity | Separates gross additions from net outstanding intent without pretending units completed. |
| Expected completions | scheduled time, producing object, rule-table version and status | A bounded production-capacity estimate; never labelled an observed unit. |
| Unit identity | raw replay ID plus normalized canonical ID and name | Preserves recovery if a patch or mod table was wrong. |
| Unit line | militia, archer, scout, knight, camel, elephant, ship and other line IDs | Lets upgraded forms contribute to one persistent preference. |
| Tactical family | infantry, archer, skirmisher, pikeman, light cavalry, heavy cavalry, cavalry archer, siege, monk, naval, unique and other | Supplies the user-facing portrait candidates without discarding exact units. |
| Roles | anti-archer, anti-cavalry, raider, ranged, frontline, siege, support, economy and other multi-valued tags | Supports future identities that do not match one unit line. |
| Domain | land, water, amphibious or economic | Prevents a water event from silently redefining a land identity. |
| Planned cost | food, wood, gold and stone committed on the positive queue action | Distinguishes 30 trash units from a similar count of expensive units. It is gross intent, not verified spend. |
| Train-time commitment | requested amount multiplied by base train time | Captures production capacity devoted to a family. |
| Timing | first queue, first sustained window, age and match-time share | Separates an opening identity from a late emergency switch. |
| Enabling investment | production-building placements, line upgrades, blacksmith technologies and unique-unit access | Distinguishes a deliberate composition from a few isolated queues. |
| Producer breadth | distinct selected producer instance IDs and producer types | Measures commitment breadth when attribution is decoded reliably. |
| Composition transitions | change points over family commitment shares | Supports specialist-versus-flexible identity and recent evolution. |
| Match context | mode, map domain, duration, civilization, civilization availability, patch, result and relation topology | Prevents opportunity differences from masquerading as preference. |
| Evidence quality | observed/reconstructed/inferred, decoder status and coverage | Allows identity aggregation to reject weak or incompatible evidence. |

The per-match output should preserve at least three parallel vectors:

1. `grossQueueAmountByEntity`: all positive requested amounts;
2. `netQueueIntentByEntity`: queue additions minus matched removals, bounded at the queue-ledger level; and
3. `plannedCommitmentByEntity`: base-cost and train-time weighted additions, explicitly labelled as planned commitment.

None is equivalent to units alive, units completed or units that dealt damage. A future engine-backed importer could add an observed-completion vector without changing the earlier evidence.

## Per-game identity record

```json
{
  "profileType": "militaryIdentityEvidence",
  "metricVersion": "military-identity-evidence/1.0.0",
  "participantId": "p4",
  "matchContext": {
    "mode": "ffa",
    "mapDomain": "hybrid",
    "civilizationId": "vietnamese",
    "durationMs": 5639022,
    "patchBuild": 180059
  },
  "vectors": {
    "grossQueueAmountByEntity": {},
    "netQueueIntentByEntity": {},
    "plannedCostByFamily": {},
    "trainTimeByFamily": {},
    "upgradeInvestmentByFamily": {}
  },
  "transitions": [],
  "candidateFamilies": [],
  "evidence": {
    "coverage": 1.0,
    "queueDecodeStatus": "decoded",
    "sourceEventIds": []
  }
}
```

The vectors are sparse maps in the logical schema. In Firestore they can be a summary document plus subcollection or an object-store artifact if their exact-entity cardinality grows.

## Persistent portrait state

Maintain two different records:

- An append-only, recomputable `PlayerMatchIdentityEvidence` record for each replay.
- A materialized `PlayerPortraitState` used by the application.

Suggested portrait state fields are:

| Field | Purpose |
|---|---|
| `identityModelVersion` | Pins all weighting, qualification and transition rules. |
| `sourceThroughMatchId` | Makes the aggregate reproducible and idempotent. |
| `qualifiedMatchCount` and `effectiveSampleWeight` | Stops a few weak matches creating false certainty. |
| `lifetimeEvidence` | Stable family vectors across every compatible qualified game. |
| `recentEvidence` | Windowed or decayed family vectors for genuine evolution. |
| `contextBreakdown` | Land, water, team, FFA, civilization and era slices. |
| `currentIdentity` | The portrait's active family, or `generic` while evidence is insufficient. |
| `candidateIdentity` | A challenger that has not yet passed transition rules. |
| `currentConfidence` and `candidateConfidence` | Calibrated support, not an unqualified percentage. |
| `leadMargin` | Difference between the first and second supported families. |
| `candidateSinceMatchId` and `consecutiveQualifyingGames` | Evidence that a change persists. |
| `lastChangedAt` and `cooldownUntil` | Prevents rapid oscillation. |
| `exclusions` | Matches omitted for corrupt data, unsupported mods, extreme duration or low opportunity. |
| `explanationInputs` | Top exact units, timing windows and enabling investments supporting the state. |

The state transition policy should use hysteresis. Promotion from `generic` may require a minimum number of qualified games, effective evidence and lead over the runner-up. Replacing an established identity should require a stronger threshold, persistence across several qualified games and a cooldown. Exact thresholds require corpus calibration; they are Layer 4 policy and must not be baked into parsing.

An established archer-focused player who produces knights in one game therefore gains one knight-context observation. Their recent knight share rises, but the current portrait changes only if the new evidence remains dominant with sufficient margin and duration. A player can also hold context-specific identities—naval on water and archer on land—while the application chooses whether to show a single portrait or a contextual variant.

## Honest portrait vocabulary

The proposed families are supportable as queue-intent identities: infantry, archer, skirmisher, pikeman, scout/light cavalry, knight/heavy cavalry, cavalry archer, siege, monk, naval, unique-unit focused, and mixed/other. Three qualifications are important:

- `unique-unit focused` is a production-origin or entity-set property, not one tactical role; a unique archer can contribute to both unique focus and archer role evidence.
- `mixed` should mean no family has a stable qualifying lead, not merely that two unit types appeared.
- A portrait describes observed production preference. It must not imply skill, combat success, personality or strategic intention.

# J Current parser gap analysis

The current `aoe2-replay-analyzer` is a useful analytical prototype: it validates DE input, extracts broad metadata, scans operations, normalizes entities through pinned data, emits 320 TownBell-shaped metrics, creates nine chart payloads, and labels many limits. It is not yet the permanent canonical extractor. Its internal model is optimized to calculate today's report during one scan and discards source detail that future models will need.

## Current strengths and gaps

| Area | Current implementation | Required foundation | Reprocessing risk | Priority |
|---|---|---|---|---|
| Replay identity | Path, parsed header and GUID | SHA-256, byte size, original name, ingest provenance and immutable source reference | High: historical reports cannot be tied cryptographically to a replay | P0 |
| Decoder provenance | Package dependency exists | exact aoc-mgz version/commit, parser patch set, decoder feature flags | High | P0 |
| Operation accounting | Counts operation and action types | one canonical operation envelope per source record, ordinal and byte span | High | P0 |
| Raw action facts | Retained transiently by aoc-mgz model | persisted action payload, raw IDs, selection, target, point, unknown tail and decode status | Critical | P0 |
| Unknown actions | counts `ERROR` only | preserve every raw operation; classify unknown/partial/invalid separately | Critical | P0 |
| Queue events | positive `DE_QUEUE` becomes `ProductionEvent`; amount at or below zero is dropped | signed queue fact plus deterministic ledger, batch semantics and ambiguity | Critical: cancellations are gone | P0 |
| Unit semantics | `ProductionEvent` uses normalized name/class | retain raw ID, normalized ID, taxonomy version and resolution status | High | P0 |
| Unit completion | expected train time is used downstream | name it `ExpectedProductionCompletion`; never expose as observed completion | Medium if source queue remains available; currently high | P0 |
| Research | click and projected `completed_t` combined in one record | direct `TechnologyCommanded` plus separately versioned expected completion | High | P0 |
| Age timings | projected from research duration | prefer direct system age-reached message when present; preserve click and projection separately | High | P0 |
| Buildings | placement records and wall endpoints | raw build/wall/gate/delete facts, selected builders, line geometry and later correlations | High | P0 |
| Initial objects | accessible through parsed model | persisted raw initial object roster including instance, owner, type, position, state and population contribution | Critical | P0 |
| Map | useful terrain and start summaries | source terrain/resource/object layers, map transform, map-data coverage and chunked geometry | High | P0 |
| Teams | static header team ID | directed diplomacy events and interval topology at every event time | Critical for FFA/unlocked teams | P0 |
| Player relations | nearest enemy helpers | pairwise relation and evidence graph for every participant pair | High | P0 |
| Camera | aoc-mgz's retained viewlocks | raw camera events, explicit dedupe/filter version and recorder scope | High for later camera research | P0 |
| Chat | raw total displayed | logical player chat, system messages, duplicate grouping, audience and redaction policy | High | P0 |
| Evidence semantics | prose caveats | per-fact and per-metric A–F class, confidence, support and unavailable reason | Medium | P0 |
| Coverage | `data_coverage` is empty | feature-family coverage, loss counters, unknown IDs/actions and corruption spans | High | P0 |
| Spatial inference | start-distance and command clusters | multi-target region scores, topology-aware geometry, index and versioned features | Low if raw spatial facts are stored | P1/P2 |
| Engagements and raids | one-pass command clustering around static enemies | directed, relation-time-aware evidence windows with sensitivity and confidence | Low if P0 facts are stored | P1 |
| Metrics | 320 values calculated directly into report | versioned metric sets whose inputs cite canonical facts | Low after P0 | P1/P2 |
| Persistence | one large JSON report | immutable event chunks plus Firestore manifests, summaries and subcollections | High | P0 |
| Results | post-game ratings and resignations; fixture result unknown | preserve every result source and conflict; `unknown` when not authoritative | High | P0 |
| Backend fit | no Age of Friends backend schema was supplied in this investigation | explicit mapping to existing match/player/league document IDs and transaction rules | Unknown | Blocking integration question |

## Paired-fixture audit

The supplied 7.3 MiB save-version-68 FFA replay and its TownBell JSON created an unusually strong black-box benchmark.

| Observation | Current/TownBell behaviour | Canonical consequence |
|---|---|---|
| New save version | Stock pinned aoc-mgz 1.8.51 did not parse the header/model without a small investigative patch to three DE layout boundaries. Lobby decoding still appears offset. | Store exact save/build versions and decoder patch set. Gate fields individually; do not mark the whole replay decoded because actions scanned. |
| Action completeness | 454,120 operations: 220,050 sync, 220,050 viewlock, 396 chat, 13,623 action and one post-game record. | The operation ledger must reconcile to source accounting exactly. |
| Queue meaning | 1,720 queue commands requested 3,144 units. TownBell's villager, military, fishing and trade totals sum exactly to 3,144. | TownBell's `*_trained` metrics in this fixture are queue-request counts. Age of Friends should call the primitive queued/requested, preserving signed events. |
| First military | TownBell's first value is the first Fishing Ship queue for every active player. | Label it `firstNonVillagerQueue` unless a combat-unit taxonomy is applied. |
| Population chart | The TownBell series begins from population-bearing initial objects, usually eight villagers plus King and Transport Ship, then adds villager queues. | Do not label such a series villager count. Store population contribution and villager identity separately. |
| Town Centers | The map begins with no Town Center. TownBell reports one plus the number of Town Center placement commands for every player. | Starting-state anchors must come from initial objects or declared mode rules; never inject a standard starting TC silently. |
| Age reached | Seventeen system chat events provide reached times and match the report. | Prefer the direct system event and retain the research click and expected projection as separate evidence. |
| Diplomacy | Eighty-six timed diplomacy-setting commands include alliances and reversals. | Static lobby teams cannot define ally/enemy at event time. Build directed intervals. |
| Tribute-looking records | All 231 `DE_TRIBUTE` payloads decode with zero amounts in this fixture. | Treat semantics as unresolved until a controlled non-zero tribute fixture confirms offsets and fee/resource fields. |
| Chat total | TownBell's `chat_messages` uses 396 raw chat operations, including system/duplicate traffic, rather than logical player messages. | Store raw messages, system classification and duplicate groups; user-facing chat counts need an explicit definition. |
| Camera filtering | 220,050 raw viewlocks become 25,322 TownBell points and 24,196 aoc-mgz model points. | Camera retention is an algorithm, not a fact. Preserve raw viewlocks and version filters. |
| SPECIAL action IDs | Selected object IDs appear implausibly scaled under the current decoder for this save version. | Mark partial decode and keep raw bytes; do not build instance attribution on suspect IDs. |
| Sync extras | aoc-mgz exposes guessed aggregate fields such as total resources and object count. | Raw bytes are A; their meanings remain C/experimental until validated. They are not resource-bank truth. |
| Baseline parity | The prototype exactly matches 1,546 of 2,560 player-metric cells, or 60.4%, under a strict value comparison. | This is useful differential evidence, not a specification. Semantic correctness takes priority over imitating benchmark quirks. |

The local aoc-mgz compatibility changes used for this audit were: consume a new per-player DE string at save 68, read a new four-byte tail timestamp, and increase a metadata padding boundary from 24 to 28 bytes. Those findings need controlled cross-version tests and an upstream-quality parser change; they should not remain an undocumented production monkey patch.

## Why the current 320-metric report is not the canonical object

The report is a presentation-compatible projection. It combines facts, estimates and heuristics; repeats values by player; encodes unavailable values inconsistently; and has no source-event lineage. Keeping it is useful for compatibility tests and immediate product displays. Making it the database of record would force historical replay reprocessing whenever a new metric needs a discarded target ID, cancellation, diplomacy state or coordinate.

The migration path is additive: keep the current report generator as a consumer of CanonicalReplay v1. First make it read canonical facts and reproduce its existing output. Then replace ambiguous names and algorithms without altering the immutable extraction layer.

# K P0/P1/P2/P3 implementation backlog

Priority here means capture urgency, not visual prominence. P0 items are data that cannot be recovered later without reading the replay again or are required to trust all downstream layers.

## P0 — must capture now

| Work item | Implementation route | Acceptance criterion |
|---|---|---|
| Source identity and manifest | Stream SHA-256; store size, names, ingest timestamp and immutable source URI | Re-ingest is idempotent by hash and manifest identifies the exact bytes. |
| Parser provenance | Emit parser, schema, aoc-mgz commit, patch-set and feature versions | Every fact can be traced to decoder code and replay build compatibility. |
| Lossless operation ledger | Extend/wrap aoc-mgz fast operation scan; record ordinal, time, byte offset/length, kind and raw payload reference | Counts and byte coverage reconcile; every operation is decoded, partial or raw-preserved. |
| Action envelopes | Serialize actor, raw action type, selected IDs, target, point, amount, entity/resource/technology IDs and extra fields | Representative payloads round-trip into canonical JSON without semantic aggregation. |
| Decode quality | Per-event status, warnings, unknown-field lengths and affected feature families | Unsupported bytes never silently become zero or disappear. |
| Initial state | Persist participants, diplomacy, objects, owner/type/instance/position, terrain and settings | Standard, nomad, water and scenario starts can be distinguished without assumptions. |
| Entity normalization | Raw ID plus versioned resolution from game-data tables; mod/build namespaces | A normalization correction does not require replay parsing. Unknown IDs remain queryable. |
| Signed queue facts | Preserve all `DE_QUEUE` amounts and selected producer IDs; correlate only in Layer 2 | Positive, negative, batch and ambiguous commands survive extraction. |
| Research and age facts | Store research click, system age message and projected completion separately | No direct/projection conflation; all age evidence can be compared. |
| Building and geometry facts | Preserve build/wall/gate/delete/transform facts with line endpoints and selections | Later wall, forwardness and topology algorithms have source geometry. |
| Dynamic diplomacy | Decode target and stance changes; build directed intervals after extraction | Every interaction can query relation A-to-B at its timestamp. |
| Market, tribute, flare and resign facts | Persist raw fields and normalized event only where verified | Controlled fixtures yield exact player/resource/amount/recipient/time; uncertain payloads stay partial. |
| Raw camera stream | Store all viewlocks separately with recorder ID and time/position | Alternative filters can be computed without replay bytes and never apply to non-recorder players. |
| Chat separation | Preserve raw messages with audience/type; detect system events and duplicate groups downstream | Raw count, logical-player count and system event count are independently reproducible. |
| Canonical persistence | Object-store chunks, Firestore manifest/summaries, checksums and idempotent write protocol | A 4v4 long game stays below Firestore document limits and partial writes are detectable. |
| Result evidence | Preserve post-game, resign, disconnect and header/result signals with conflicts | `winner`, `loser` and `unknown` have source evidence, not guesswork. |
| Coverage report | Feature-level completeness and loss budget | The API can explain every unavailable metric and exclude compromised features. |
| Golden fixture harness | Paired TownBell FFA plus controlled fixtures, canonical snapshots and invariants | Parser changes show semantic diffs; expected operation/fact counts pass in CI. |

## P1 — strong V1 value

| Work item | Route | Product value |
|---|---|---|
| Queue ledger | Time-series event correlation by producer/entity; retain ambiguity | Net queue intent, cancellation behavior and production continuity. |
| Expected production schedule | Game-data durations plus per-producer queues, technologies and speed rules | TC/production occupancy estimates with explicit B classification. |
| Spatial feature service | Normalized coordinates, distance transforms, KD/R-tree or grid index | Reusable home, corridor, region and activity queries. |
| Pairwise interaction graph | Dynamic relations plus targeted and spatial facts | FFA rivalry, team support and War Room evidence. |
| Engagement detector v1 | Spatiotemporal clustering of hostile command evidence | Honest pressure/fight windows without claiming damage. |
| Raid-pressure detector v1 | Directed economic-region activity and response windows | Raid style and response proxies. |
| Gross commitment ledger | Base cost tables over queue/build/research commands, with cancellation columns | Spending-behavior fundamentals that are not called actual spend. |
| Production identity evidence | Exact entity, line/family/role vectors and transitions | Stable player portraits and playstyle inputs. |
| Build-order projection | Chronological queue/build/research/market milestones | Familiar replay summary backed by event IDs. |
| Metric contract and registry | Typed statuses, units, semantic versions, evidence classes and dependencies | Safe API evolution and reproducible dashboards. |
| Privacy policy implementation | Chat redaction, source retention, access and deletion controls | Private-league use without leaking player chat or raw replay links. |
| Parser compatibility matrix | Save/build corpus and field-level support registry | Reject, partially process or trust new patches explicitly. |

## P2 — later derived metrics

These need no replay reparse once P0 and the relevant P1 reconstruction are stored.

| Work item | Inputs | Output examples |
|---|---|---|
| Economy fundamentals | queue ledger, expected schedule, build/research/market facts | TC continuity, expansion timing, infrastructure pace and gross commitments. |
| Military fundamentals | unit vectors, upgrades, producers and timing | first combat queue, composition, transition count, siege/naval/unique commitment. |
| Map-presence fundamentals | spatial index, regions, building and command facts | forwardness, dispersion, opponent-region pressure, wall intent and expansion. |
| Execution fundamentals | action stream, expected queues and engagement windows | command cadence, production gaps, response latency and multitasking proxies. |
| Performance model | versioned fundamentals plus context | Per-match evidence vector with confidence; no invented combat result. |
| Teamwork model | pair graph, relation intervals, tribute/flares and opportunity | Directed support and coordinated-pressure evidence. |
| Playstyle model | per-match fundamentals across matches | Supported sliders with context and stability. |
| Relationship aggregates | immutable match edge contributions | Rival/Friend/Enemy progression and War Room facts. |
| Portrait transition model | identity evidence history | Generic-to-specialist and slow-changing portrait state. |
| Cohort comparisons | metric registry plus mode/map/rating cohorts | Percentiles and multi-game tendencies with comparable denominators. |

## P3 — future or experimental

| Work item | Why experimental | Decision gate |
|---|---|---|
| Probabilistic unit completion | Queue, cancellation and destruction ambiguity | Calibrate against engine-observed controlled games; never overwrite deterministic facts. |
| Learned engagement/raid model | No replay-only ground-truth outcome | Human/CaptureAge-labelled corpus and precision targets. |
| Visibility/exploration approximation | Requires movement simulation or sparse command proxies | Validate separately by mode and viewpoint. |
| Wall closure and accessible-territory model | Building completion and terrain mutation are uncertain | Geometry benchmark against observed game states. |
| Tactical outcome or kill attribution | Command stream lacks authoritative damage/death state | Requires an external compatible simulation/telemetry path; otherwise reject. |
| Resource-bank/economy simulation | Collection, depletion, drop-off, bonuses and task state are not fully encoded as final state | Use a game-engine-equivalent simulator or keep unavailable. |
| Camera-based attention model | Recorder-only and filter-sensitive | Declare POV scope and validate against raw viewlocks. |
| Narrative generation | Language can overstate weak evidence | Generate only from cited metric records and enforce certainty vocabulary. |

# L Controlled replay test plan

## Corpus design

Use instrumented custom lobbies with screen recording and a written action log. Record from at least two participants when testing recorder-specific data. Keep one variable per short fixture where possible, then add representative full matches for interaction effects. Archive the replay, game build, data/mod identifiers, lobby settings, recorder, expected script and a cryptographic hash.

The minimum corpus includes standard 1v1, locked 2v2, locked 4v4, unlocked-team FFA, nomad/no-TC start, water start, restored save, current ranked patch, at least one older supported save, AI player, spectator/observer if recordable, scenario, and custom-data mod.

## Controlled actions and assertions

| In-game action | Expected replay evidence | Expected canonical output |
|---|---|---|
| Queue exactly five villagers one click at a time | Five positive queue amounts naming villager and the selected TC | Five `QueueCommanded` facts; gross amount five; producer instance retained. |
| Shift/batch queue five villagers | One or more queue commands whose signed amounts total five | Preserve physical command shape and gross amount; do not force five operations. |
| Queue three militia, cancel one | Positive and negative queue evidence | Signed facts plus ledger net two; no claim that two completed. |
| Queue and immediately cancel an entire batch | Positive then negative evidence, possibly different batch encoding | Ledger returns to prior state or marks unmatched ambiguity; planned gross and cancellations remain. |
| Queue with multiple buildings selected | Selection list and queue amount | All candidate producer IDs stored; attribution status reflects decoder semantics. |
| Let one unit finish | Usually no authoritative completion command | No Layer-1 `UnitCreated`; an expected completion may be B and labelled as such. |
| Research Loom to completion | Research command; possibly no generic completion event | `TechnologyCommanded` A and `ExpectedTechnologyCompletion` B; completion is not promoted without direct evidence. |
| Start then cancel a technology | Research plus cancellation/queue evidence if format emits it | Both facts preserved and expected completion invalidated or marked ambiguous. |
| Advance to each age | Age research click and system reached event where supported | Separate click, direct reached message and projected time; comparison invariant recorded. |
| Idle a starting TC for exactly 60 seconds | Gap between expected queue intervals | `ExpectedProducerIdleInterval` approximately 60 seconds with declared scheduling assumptions. |
| Build a second and third TC | Placement commands at known coordinates | Two building-order facts; TC count is ordered/expected, not necessarily completed. |
| Nomad start with no TC | Initial object roster lacks TC | `initialTownCenterCount = 0`; no implicit standard-start anchor. |
| Delete an unfinished building | Build then delete target/selection | Separate facts and correlation confidence; placement never silently becomes completed. |
| Place a wall, gate and palisade segment | Wall endpoints/gate/build actions | Exact raw geometry plus normalized segment chain; no closure claim. |
| Buy 100 food and sell 100 wood | BUY/SELL payloads | Actor, resource, lot count or amount, timestamp and verified semantics; price/bank change absent. |
| Send 100 food tribute to ally | Tribute payload | Sender, recipient, resource, gross amount and fee only if verified by controlled amount. |
| Send tribute while neutral/enemy if UI permits | Command or rejection behavior | Fact plus relation-at-time; absence is not converted to zero. |
| Flare a known coordinate to team | Flare action with point/audience | `FlareCommanded` with raw audience/recipient representation and normalized coordinates. |
| Toggle A toward B ally, neutral and enemy | GAME diplomacy commands | Three directed changes and contiguous A-to-B intervals; B-to-A remains independent. |
| Form and later break a mutual FFA alliance | Two directed changes each way | Mutual interval equals only the overlap; later events use current relation. |
| Issue move, attack-move, patrol, stop, stance and formation commands | Corresponding action kinds and selections/points | One action fact per physical operation; normalized category plus raw kind. |
| Attack a known initial enemy object | Target ID with known owner | Directed A-to-B target edge classified B with exact source event. |
| Attack a unit trained after start | Target ID whose ownership may not be reconstructible | Edge is C/unknown unless instance creation/ownership was established. |
| Attack ground and siege ground fire | Point action without player target | Spatial hostile fact; victim remains a probability vector or unknown. |
| Conduct three timed raids on two opponents | Clusters of hostile commands in known regions | Three inferred directed pressure windows with membership and sensitivity version; no kills. |
| Ally responds near threatened teammate after 20 seconds | Ally spatial commands after pressure window | Response candidate with measured latency and opportunity fields, not causal `saved`. |
| Coordinate two allies against one opponent | Overlapping directed pressure windows | Cooperative-pressure evidence with overlap and participants; coordination remains C. |
| Train known mixed army sequence | Queue exact archer, knight, siege blocks | Exact vectors and time-window change points reproduce the script. |
| Make one unique unit among a dominant generic army | Exact unit IDs and origin | Unique-focus share remains low; taxonomy can tag unique plus tactical family. |
| Garrison, ungarrison and back-to-work | Corresponding commands and object IDs if decoded | Raw facts available for response proxies; no assumption about occupants absent IDs. |
| Resign one participant | RESIGN and post-game evidence where available | Timed resignation A; result determined only under declared mode rules/evidence. |
| Disconnect without resigning | Network/post-game pattern if recorded | Preserve signals; result or cause remains unknown unless explicit. |
| Save, restore and continue | SAVE/START or chapter boundaries depending format | Segment provenance and monotonic canonical clock; duplicate/setup operations handled explicitly. |
| Record the same match from two players | Same shared command stream, different viewlocks and possibly messages | Shared-fact hashes reconcile after normalization; camera has different recorder ID and E scope. |
| Generate camera pans, jumps and stationary views | Dense viewlock operations | Raw count exact; alternative versioned filters reproduce their retained sets. |
| Send one player chat and trigger an age message | CHAT operations | Logical player message and system age event separated; raw operations preserved. |
| Use an AI player | AI participant and commands as recorded | Participant type retained; player-input metrics mark applicability rather than comparing blindly. |
| Use an unknown/new unit or data mod | Raw entity ID not in base table | Fact survives with `resolutionStatus = unknown` or mod-namespaced mapping. |
| Use an unusual RMS with terrain mutation | Header script/data plus terrain/object state | Initial geometry retained; later mutation marked unsupported unless directly decoded. |

## Verification layers

1. **Binary accounting:** operation counts, byte offsets and elapsed-time deltas reconcile to the source.
2. **Golden canonical snapshots:** reviewed facts for each controlled fixture are diffed in CI. Snapshot changes require a declared parser/schema migration.
3. **Invariant tests:** non-decreasing canonical time; source ordinals unique; participant and instance references valid or explicitly unresolved; signed queue sums reconcile; diplomacy intervals do not overlap for one directed pair.
4. **Metamorphic tests:** changing only the recorder changes E camera facts but not shared actions; changing metric formulas changes Layer 3/4 only; changing a name table changes normalization only.
5. **Differential tests:** compare aoc-mgz fast/model output, TownBell public output where a legitimate paired fixture exists, AgeAlyser behavior, and—when available—human/CaptureAge observations. Differences become investigations, not automatic benchmark wins.
6. **Property/fuzz tests:** mutate lengths, truncate streams, inject unknown IDs and vary batch amounts. The parser must fail closed or preserve partial data, never silently fabricate defaults.
7. **Cross-version regression:** run every supported save/build through the compatibility matrix before release.

Trust should be assigned per feature, not per file. A replay may have trustworthy queue actions, partially decoded lobby settings and unavailable camera attribution. Its coverage object must represent that combination.

# M Critical unknowns

These are research questions with named experiments, not implementation footnotes.

| Unknown | Why it matters | Resolution experiment | Interim treatment |
|---|---|---|---|
| Save-version-68 header/lobby boundaries | Current population and some lobby fields appear misaligned after the minimal parse patch | Compare several save-68 files with known lobbies; byte-diff adjacent versions; add parser fixtures upstream | Mark affected fields partial and prefer independently verified DE settings. |
| Signed `DE_QUEUE` semantics | Negative values, batch clicks, multiple producers and auto-queue may not share one rule | Controlled matrix of single/batch/add/remove/multi-select/auto-queue | Preserve physical signed facts; ledger uncertainty explicit. |
| Queue acceptance | A recorded click can fail for resources, capacity or state | Attempt valid and invalid queues under controlled shortages/full queues | Call it command/request, not accepted queue or trained unit. |
| Generic production completion | The stream may not expose completion consistently | Queue one unit, wait, compare all subsequent operations and engine observation | Keep expected completion B only. |
| Age system-message coverage | Paired fixture has direct messages, but version/mode/language behavior may differ | Cross-version, localized, restored and scenario fixtures | Use source-ranked evidence and retain projection. |
| `SPECIAL` selected-object decoding at save 68 | Implausible IDs would corrupt attribution | Controlled special actions on known object IDs; inspect raw payload offsets | Mark selection partial; keep raw bytes. |
| `DE_TRIBUTE` zero-valued records | The paired FFA's 231 records may be diplomacy/setup structures or misdecoded fields | Send distinctive resource amounts to known players in save 68 | Do not count as economic tribute until verified. |
| Sync aggregate fields | Names such as total resources/object count are documented as guesses | Controlled resource/object changes with byte-level correlation across clients | Raw field only; C/experimental semantic tag. |
| Ownership of spawned instances | Header maps only initial instance IDs; later target IDs need creation knowledge | Train/build known instances then target, delete and transform them | Unknown or probabilistic owner unless a lifecycle mapping is validated. |
| Cancellation/refund amounts | Cancellation command may not reveal refunded resources or queue slot | Controlled partial construction and queue cancellations | Store gross commitment and cancel event; no net resource-bank claim. |
| `ORDER` semantic subtypes | One action kind can represent context-dependent orders | Script right-clicks on ground, resource, enemy, ally, repair and garrison targets | Keep raw payload plus conservative normalized family. |
| Camera retention rule | TownBell and aoc-mgz retain different counts from the same 220,050 viewlocks | Reproduce exact-consecutive, time and distance filters against paired chart | Raw is canonical; each filter is a versioned reconstruction. |
| Visibility and exploration | Unit positions between commands and line of sight are not in the basic action stream | Compare replay-only proxies with CaptureAge observations on controlled scouts | C approximation or D for authoritative visibility. |
| Building completion and wall closure | Placement does not establish completion; deletion and damage intervene | Build/cancel/delete wall variants and compare engine state | Call placements/orders direct, completion/closure unavailable or probabilistic. |
| Deaths, kills and damage | No authoritative general event has been established | Controlled combat byte search and engine comparison across units | D until a compatible simulation or verified event exists. |
| Post-game/result variants | Resign, defeat, disconnect, wonder/relic/score and FFA endings differ | Controlled victory-condition corpus | Store evidence/conflicts; return unknown when rules cannot decide. |
| Restored/rejoined recordings | Time origin, duplicated initial state and command segments may vary | Save/restore/rejoin from multiple recorder viewpoints | Segment-aware source model; block unsupported merge. |
| Dynamic diplomacy rules | One-sided setting, mutual effect and UI constraints vary by mode | Directed toggles in unlocked team and FFA fixtures | Directed matrix is canonical; mutual state is an interval intersection. |
| Custom scenarios, RMS and data mods | IDs, starts, scripted effects and victory rules invalidate base assumptions | Small fixtures for each supported category with pinned mod hashes | Namespace IDs; lower coverage; never fall back silently to standard rules. |
| New civilizations and patch entities | Static bundled data goes stale | CI against entity source updates and unknown-ID telemetry | Raw IDs ensure renormalization without reparsing. |
| Existing Age of Friends backend contracts | Match, league, identity and authorization schemas were not supplied with the fixture | Review current Firestore collections, IDs, write paths, retention and security rules | Treat this document's persistence layout as logical design, not a drop-in migration. |
| Ground truth for pressure/teamwork labels | Command clusters show activity, not damage or intention | Human-labelled controlled corpus with inter-rater agreement and precision targets | Keep heuristics C and expose their evidence. |

# N Recommended next engineering task

Build **CanonicalReplay v1 extraction plus a golden-fixture conformance harness** before adding another dashboard metric.

This is the single highest-leverage task because every future economy, military, map, execution, identity and relationship model depends on facts that the current report discards. It also turns the supplied pair from an interesting comparison into a permanent regression test.

## Definition of done

1. Ingest the source bytes, compute SHA-256, and write a versioned manifest.
2. Emit participants, settings, initial diplomacy, initial objects/terrain and a lossless chronological operation ledger with ordinals, byte spans and decode status.
3. Normalize—but never replace—raw entity/action IDs using pinned game-data tables.
4. Persist signed queue, research, building, market, tribute, diplomacy, command, chat/system, resign and raw recorder-camera facts.
5. Produce feature-level coverage and warnings, including the known save-68 lobby, `SPECIAL` and `DE_TRIBUTE` uncertainties.
6. Chunk immutable event families outside single Firestore documents; store query summaries/manifests in Firestore.
7. Validate against three initial goldens: the supplied save-68 FFA pair, a short current-patch standard 1v1, and a controlled queue/cancel/diplomacy fixture.
8. Make the existing 320-metric report generator consume canonical facts without requiring the replay file.

The decisive acceptance test is simple: delete access to the replay after canonical extraction and demonstrate that a new metric—such as directed queue commitment during each diplomacy interval—can be implemented entirely from stored facts. If that works, Age of Friends has a durable statistical foundation rather than a fixed report exporter.

# References

1. happyleavesaoc, [aoc-mgz repository and format overview](https://github.com/happyleavesaoc/aoc-mgz). The README distinguishes initial-state headers from body commands and states the replay/simulation limit for arbitrary resources and kills.
2. TownBell, [public application](https://townbell.vercel.app/) and [About](https://townbell.vercel.app/about). Public descriptions of command-stream parsing, computed insights and stated replay limits.
3. TownBell, [Help](https://townbell.vercel.app/help). Public scope notes for 1v1, teams, FFA, AI, recorder-only camera and unavailable metrics.
4. TownBell developer, [public multi-game announcement and discussion](https://www.reddit.com/r/aoe2/comments/1v2oxx2/townbell_is_back_replay_analytics_multigame/). Describes deterministic metrics, repeated-pattern comparison and optional AI interpretation.
5. TownBell, [public feed](https://townbell.vercel.app/feed). Observable examples of percentiles, eAPM, opening labels and TC continuity summaries.
6. Google Firebase, [Cloud Firestore quotas and limits](https://firebase.google.com/docs/firestore/quotas). Source for document-size and structural constraints.
7. Google Firebase, [Cloud Firestore data model](https://firebase.google.com/docs/firestore/data-model). Source for document, collection and subcollection architecture.
8. happyleavesaoc, [aoc-mgz source tree](https://github.com/happyleavesaoc/aoc-mgz/tree/master/mgz). Relevant implementation areas include fast header/operation parsing, model parsing, action decoding and reference-data lookup. Audit baseline pinned commit `9c1e9cc93998887a56f336dc4489555f4ad5577a`.
9. byrnesy924, [AgeAlyser_2](https://github.com/byrnesy924/AgeAlyser_2). Open-source precedent for deriving build, queue and map analysis from initial state and actions, with documented limitations.
10. Siege Engineers, [AoE2 technology-tree data](https://github.com/SiegeEngineers/aoe2techtree). Candidate patch-aware entity and technology normalization source.
11. Siege Engineers, [aoc-reference-data](https://github.com/SiegeEngineers/aoc-reference-data). Candidate canonical reference tables for game entities and metadata.
12. TownBell, [Privacy](https://townbell.vercel.app/privacy). Public separation of deterministic analysis from optional external AI narration and relevant data-handling statements.
13. AoEInsights, [mgz-fast](https://github.com/AoEInsights/mgz-fast). Independent open-source replay parsing implementation useful for differential testing.
14. Siege Engineers, [genie-rs replay crate](https://github.com/SiegeEngineers/genie-rs/tree/default/crates/genie-rec), and genie-js, [recage](https://github.com/genie-js/recage). Additional, incomplete or older-format references useful for comparison, not production truth for current DE saves.

## Companion artifacts and reproducibility note

The companion `townbell-capability-matrix.csv` contains one row for each of the 320 metric definitions present in the supplied TownBell JSON, using the requested capability/source/class/algorithm/confidence/raw-fields/Age-of-Friends/use/priority columns. `canonical-replay-v1.schema.json` is a machine-readable logical schema for the architecture in section E. It deliberately leaves storage chunking and backend-specific document IDs outside the domain contract.

Empirical statements about the paired fixture come from the user-supplied TownBell JSON and corresponding replay. The replay SHA-256 is `2dd7a9a63f1b1b74f7e43dc1de1e70417089bb7f3ff667424591dea7db1e9ec9`; the enclosing ZIP SHA-256 is `642103647dd42c568e254c8f33d87db4657997f2858778ad7eade039db452483`. The differential parser audit used aoc-mgz 1.8.51 at the pinned commit in reference 8. These local observations are evidence for this fixture, not claims that every save version encodes identical payloads.
