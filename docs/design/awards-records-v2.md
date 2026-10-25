# Age of Friends — Achievements 2.0 and Records Contract (DESIGN ONLY)

**Work order:** #157 · **Owner authority:** #129 decisions 24–25 October 2026 · **Verified main base:** `e453d40c147ad488f3bfd369e54eba82b29c43b5`

**Machine-readable canonical candidate register:** [`awards-records-v2-registry.json`](awards-records-v2-registry.json). All **37 achievement families**, **26 deduplicated owner-suggested Record Book definitions**, **six new investigations**, source paths/models, evidence classes, units, clocks, comparability profiles and open approvals are there. This document is the interpretation and implementation contract; neither file is a Firestore definition, a live achievement engine input nor an instruction to deploy.

## Product architecture: one source, three independent outputs

```text
Current accepted and source-attributed Game facts + final official result authority
        |
        v
Versioned, bounded QualifiedPerformanceFact[] and QualifiedCompetitionFact[]
        |                       |                        |
        v                       v                        v
Season / League current     Private per-player          Tiered achievement
record extrema              personal bests             entitlements
Statistics > Record Book    Chronicle owner's leaf     Achievement collection
exactly 3 plaques/tab       ALL PBs, 3 can be featured  independent fixed thresholds
        |                       |                        |
        +------ evidence-correction-safe rebuild --------+
                                |
                optional separate earnable honours:
       Trophy, exceptional-merit Distinction, voluntarily equipped Epithet
                  + separately dated Event/Season honours
```

The records are **not** relative-rank achievement thresholds. A valid player's personal best remains theirs when another player claims the league record. A valid earned tier remains even after later weaker performances. Publication of a Season or current record does not automatically mint a permanent trophy, Distinction, reputation credit or epic Chronicle claim.

A `QualifiedPerformanceFact` **proposal**, not yet a deployed schema, needs `metricId, playerId, seasonId, matchId/battleId, gameId, canonical sourceHash, extraction/artifact/current READY revision, model version, patch/build/mod, qualified start/civ/mode/map/clock, value/unit, evidence modality, source event identities, coverage and availability reason`. It must reference the **current authenticated source**, not a stale upload or unverified Game. `battleId` is the canonical official `/matches/{matchId}` document ID; multiple Games or POV uploads do not manufacture independent Battles.

Candidate evaluation must return `QUALIFIED | NOT_QUALIFIED | PENDING_EVIDENCE`, with immutable reproducible witness references. Missing or invalid evidence is **not zero** or proof an action never happened. Do not collapse observed commands, modelled/projection facts, inferred episodes, accepted official results and verified engine effects.

## Achievement tiers and advanced variants

Four **unapproved working rank labels** `INITIATE → PRACTICED → EXPERT → ELITE` specify monotone evaluation points; the design register intentionally sets every numerical cutoff to `null`. The owner must approve rank names and boundaries only after authentic representative positive/negative recordings, stratified by mode, map, patch, civilization and play duration. There is no assumed universal “three Battles” bar.

- `BEST_QUALIFIED_GAME`: evaluate each eligible **individual Game** with the SAME tier definition, retain the best qualified result and provenance. A multi-Game league Battle may include several candidate Games; do not add their values into a fictional single Game.
- `CUMULATIVE_DISTINCT_BATTLES`: first collapse qualifying episode IDs and uploads within canonical Match/Battle, then aggregate **distinct approved Battle IDs**, never source POVs or command repetitions. A career tier may require repeatability across Battles, rather than rewarding command spam in one Game.
- Some tier axes are intrinsically `MIN` (time/idle) or `MAX` (count/share/estimated commitment); structural branches are **compound predicates**, not linear score increments. Tiers can have quality gates and minimum source coverage in addition to thresholds.
- A **named advanced variant** requires evidence of **another type of gameplay deed**, not merely a better numeric tier: `Drush Flush` adds source-supported Feudal continuation to a disciplined three-Militia Dark Age opening; `Fast Castle Boom` adds two distinct early additional TC placement sites following the Castle projection, not two completed TCs. `Naval Rush` must be a naval military opening beyond a Fish Boom. `Last Man Standing` demands independent survivor evidence, not just a winning FFA result. The register records all additional gates as proposed, not qualified today.

The 37 owner concepts are fully enumerated in JSON. Their evidence-correct **current classification** is:

| Group | Existing projected measurement | New pure detector required | Independent engine/effect witness required | Total |
|---|---:|---:|---:|---:|
| General, opening and economy | 8 | 13 | 2 | **23** |
| Fixed-team | 1 | 3 | 3 | **7** |
| FFA diplomacy | 0 | 1* | 6* | **7** |
| **Total** | **8** | **17** | **12** | **37** |

`*` **Authoritative correction:** The design JSON is normative for individual disposition. Most FFA diplomacy concepts still require independently qualified effective stance, actual resource receipt, king state, official outcome or a combination. Any classification difference in this descriptive table must be resolved in favour of the 37 individual entries and tests, not silently “upgraded.” **An existing metric is a source seam, never an automatic award grant.**

**Elite Master of the Three Schools:** optional **post-nominal** epithet = `ACTIVE_ELITE(disciplined Drush) AND (ACTIVE_ELITE(Scout Rush) OR ACTIVE_ELITE(Archer Rush)) AND ACTIVE_ELITE(Fast Castle Boom)`. Compute from **currently active component tier entitlements only**; it is **not a fourth detector**, extra requirement of three separated Battles, or automatic equipment. The Club requirement includes real source-qualified TC macro discipline and its cancellation/population controls, not just three Militia orders; exact requirement for Drush Flush continuation remains an owner choice. Unapproved numerical time thresholds must remain null.

## Competitive Record Book: 26 candidate definitions, not 68 awards

Current Season Statistics has five tabs (`Opening / Economy / Military / Map Presence / Execution`), 71 defined metrics and 68 raw `record:min|max` flags. Those flags are **not** an official selected Record Book. A formal `RecordDefinition` needs a stable design ID, exact data path and pinned model revision, unit, direction, clock cutoff and complete window, source/gate, cohort and correction policy.

The owner’s **26 deduplicated record ideas** are represented by tab and canonical ID:

| Tab | Candidate owner record IDs (from the JSON registry) |
|---|---|
| Opening (8) | `DRUSH_FLUSH`, `SCOUT_RUSH`, `ARCHER_RUSH`, `FEUDAL`, `CASTLE`, `IMPERIAL`, `FC_BOOM`, `FISH_BOOM` |
| Economy (4) | `FARMS`, `VILLAGERS_20`, `COMMITTED_20`, `COMMITTED_GAME` |
| Military (4) | `RAIDS`, `ASSISTS`, `CASTLES`, `BATTLES` |
| Map Presence (7) | `SCOUT_CONTACT`, `WALLS_20`, `MAP_EXPLORED_20`, `FORWARD`, `GOLD`, `RELICS`, `ECO_ZONES` |
| Execution (1) | `APM` |
| Competition results (2) | `WIN_STREAK`, `FASTEST_WIN` — a distinct Record Book results section, **not** falsely described as execution skill |

`AR2_REC_CASTLE` is the *one* Fast Castle / Fastest Castle Age record; Fast Castle Boom is a different composite feat. `COMMITTED_20` (fixed 20:00) is different from `COMMITTED_GAME` (full Game). `APM` is **whole-Game average raw ACTIONs/minute**, not a 30/60-second peak. `BATTLES` are inferred **in-Game engagement episodes**, not official league Matches. `MAP_EXPLORED_20` is **held**: current map command coverage does **not** prove literal fog-of-war exploration; a separately titled 20m command-route proxy needs its own definition and owner approval.

**Exactly THREE grand record plaques per each existing five tab** (15 total). Registry includes three **provisional, meaningful source-based candidate IDs per tab** and two legacy Execution supporting candidate measurements (`Fastest Raid Response`, `Economy Actions in Skirmishes`). These placeholders are **not owner-selected award rules**. An unqualified featured slot is *Unclaimed*, never fabricated. Under each tab, the **full eligible Record Book list** is separate and can later be curated without changing the three-plaque requirement. No duplicates: a plaque links to its single canonical Record Book row. Player comparisons remain below.

The existing Season table's `All-time` display switch means cumulative **Season aggregates**, not historical cross-Season records; never label it an all-time *League Record Archive*. An eventual true all-time record comparator spans approved concluded/current Seasons under explicit model/context compatibility. A valid earlier record holder may be described as a *former* holder without being shown as the current holder; a corrected false claim must be removed entirely.

## Source model and comparability: mandatory, not a UI filter suggestion

**Availability:** `EXISTING_MEASUREMENT` is a candidate field already projected, `DERIVE` means added pure versioned calculation required, and `ENGINE_WITNESS` means the named accomplishment needs a separately validated execution/state witness before grant/public claim. Some source paths in the registry contain source-command selectors, denoted with brackets; these are **not** executable JSONPath or current output fields. Current per-participant projected paths are prefixed `player.`. A blocked field such as `AOF_DIPLOMACY_TIMELINE_V2.effectiveIntervals[UNQUALIFIED_IN_PRODUCTION]` is explicitly **not** a currently qualified effective-state source.

**Hard admission:**
1. Approved human official league Game and canonical Match participant source mapping, exact-current server READY artifact, pinned replay/build/mod and model version, no disqualifying dispute or absent Game/winner review.
2. Clock reach and **complete observation through the relevant checkpoint**. `at20` requires at least full 20:00 source, `at30` at least 30:00, source-sensitive cancelled/retried queues resolved. Rate metrics need qualified nontrivial observed duration.
3. Mode-appropriate participant and alignment context: fixed teams for true-team defensive assistance, effective at-event-time alliance for unlocked diplomacy. FFA unknown stance never defaults to friendly or neutral.
4. **Cohort partition before extrema.** Preserve 1v1, locked Teams and unlocked FFA distinction, approved starting age/resources/TC count/population, speed, civ bonuses or validated normalization, patch/build/data/mod and relevant map/start geometry. Do not assume cross-map equivalence for a gold/spatial record, or cross-civ equality for a fast age-up. An incompatible source model or missing required qualifier yields `PENDING_EVIDENCE` or separately named incomparable pools.
5. `MIN` and `MAX` compare exact numeric values within the appropriate cohort and window. Return **all true ties**, never arbitrary processing order or a UI tie break. Need source Battle/Game/date, quantity/unit, method/limitations and actual known comparison cohort in every visible record.
6. On a replacement source, POV dedup, Game eligibility, final result revision or dispute change: atomically recompute record contenders and ties, private PBs and affected tier/epithet entitlements from **current authoritative evidence**. No stale award in public nameplate. An earned valid achievement is not revoked merely for later weaker Games.

A `RecordDefinition` decides whether it is a single-Game extreme, a sequenced official Match streak, or an accepted official win duration. Do not compare an individual Game clock against a multi-Game series clock. Do not infer a Battle victory solely from a replay command or infer completed ages from projected request times.

## Three concrete cross-surface examples

1. **Fast Castle:** A completes a source-admitted comparable Game with nominal projected Castle time 14:48, B 15:21. A is current Season holder; B has 15:21 as private Chronicle PB; B can earn a fixed tier independently if the eventual tier cutoff says so. Later source-qualified B at 14:39 can replace the record, improve B's PB and advance B's tier, each as independent deterministic projections. The 14:48/15:21/14:39 values are **fictional**, not real AoF league records or proposed cutoffs. `FASTEST_CASTLE_RESEARCH_START` in `REPLAY_RECORDS_V1` is a research request time, **not** the same timestamp as `opening.ageUp.castle.ageUpAtMs` projected arrival.
2. **FC Boom:** A player's inferred projected Castle time alone may enter the Castle Age record but **cannot** qualify their FC Boom branch. The latter additionally needs source-proven ordered two distinct post-Castle TC **BUILD sites** and eligible clock, not completed TCs. Changing an uploaded POV does not make a second Boom.
3. **Elite epithet correction:** A player has active elite Drush, elite Scout (no elite Archer necessary) and elite FC Boom, and equips the post-nominal. A later Game where their Drush is slower does nothing. An authoritative correction invalidating the **only** elite FC Boom witness removes the active elite component and suspends the equipped epithet until a different genuine qualifying Game is accepted.

## Six new metric investigations — technical sequence

| Priority | Candidate | What *exists* | What must be proved / built |
|---|---|---|---|
| **1** | **Garrison order response to raid** | `execution.garrisonsDuringRaids`, `raidResponse.evidence`; `ORDER` to initially known owned garrison-capable structures | Per-raid exact first garrison-order response latency; no claim that units actually entered or later-built target identity is complete |
| **2** | **Combat/economy command multitasking** | `execution.skirmishContext.ecoActions`, APM, admitted engagement windows | One player's OWN military-control and economy commands in same short windows; normalize by qualified active fight time, exclude passive/skirmish inflation; no completed fighting or eco work claimed |
| **3** | **Reactive quickwall placement** | incoming Raid V3 episode start/owner/position, WALL order time/tiles | Fresh near-threat wall **orders** inside response window; exclude prewalls/retries; no claim a wall actually blocked a raid |
| **4** | **Enemy-side boar interaction** | `economy.firstBoarLure`, `boarsTaken`, initial boar and command identity | Opponent home association + attribution; raw boar order only, **not** successful lame or food theft |
| **5** | **Monk conversion success** | Monk queue requests, some orders | Independent **same-unit ownership change** + converting Monk attribution, tested failed/reconvert controls; unavailable today |
| **6** | **True trade-route gold volume** | queued Trade Cart/Cog; separate MARKET BUY/SELL lot volume ×100 | Actual route gold receipt with economic source attribution; market exchange is NOT trade-cart income |

Quickwall, garrison, response APM and related defensive actions may be different dimensions of **one episode**; do not create multiple social deeds just because the same defensive sequence emits multiple statistics. Boar laming does not imply Cruelty; trade receipt does not imply coercion. The first four can start as source-honest command candidates; successful boar laming, true conversions and trade income require separately validated state witnesses.

## Independent PR cuts — explicitly NO implementation in this PR

| Next PR | Owns | Boundary, tests, and hard exclusions |
|---|---|---|
| **A. Pure versioned definition/comparability register** | Source-qualified schema + mode/cohort/clock/correction gates, model/field adapters, approved subset markers | Enumerate 37+26+6. Parser unchanged. Owner numeric cutoffs absent. Negative tests mixed patch/civ/1v1/team/FFA, incomplete clocks, source mismatch. |
| **B. Pure record and private PB resolvers** | Independent extrema by comparable cohort, ties, current-holder/previous-holder and owner-scoped PB, historical correction reconstruction | No feature publication. Multi-Game Match and duplicate POV dedupe; revocations; page private PBs rather than limiting to 3 showcased codes. |
| **C. Pure tier/variant achievement evaluator** | Four rank gates after owner calibration, structural subpredicates, distinct-Battle aggregation, active elite composition and correction audit | No database seeding, no scoring. Exact-Games with cancelled/requeued Militia and TC sites, civ transitions, elite revocation/reactivation. |
| **D. Statistics/Chronicle/collection UI adapters** | Exactly 3 qualified plaques per tab + complete Record Book under each + private Chronicle PB book, separately selected highlights, collection tiers | UI only after source/policy approval; never alter other workers' Chronicle factual authority. No public PB leakage or nested interactive nameplate buttons. |
| **E. Voluntary honours selection/display** | Authenticated one-epithet equipment and bounded verified trophy/Distinction nameplate emblems with mobile/tap/keyboard details | Separately privacy reviewed; no fake official earned badges, no unsupported medals, no award-based reputation/League Points. |
| **F. Narrow metric detector PRs** | In priority order: garrison, dual-domain multitasking, quickwall, enemy-side boar; later separate observation research for conversion and trade | Only pure new source-safe observations and controlled positive/negative fixtures. Explicitly do not deploy an engine observer in upload path. |

PR A–C should be independent, small and green at their exact heads, then code owners can sequence UI/persistence under Organiser 3. Authentic controlled **recordings**, not synthetic-only positive tests, remain the evidence admission gate.

## Owner decision register — preserve these without blocking design freeze

**Decided:** 37 concept families kept; progressive tiers + real advanced variants; elite Three Schools conjunction; public Season record book versus private PBs versus fixed tiered awards; 3 grand plaques on each of five tabs; other records go into a complete listing; trophies as measurable feat awards; rare true military-style merit Distinctions; one optional equipped epithet; no unsupported gameplay-state claims.

**Open for owner calibration:** exact tier labels and thresholds, evidence-positive fixture rules, whether Drush Flush is mandatory for elite Club, Scout/Archer elite military timing and FC Boom site/time windows, valid civ/map/format comparisons, actual map-explored versus explicitly titled command-coverage proxy, fastest official Game win versus entire multi-Game Battle win, *House an Allied King* sheltering semantics, whether *Extortion* is appropriate without proof of coercion, and the precise fifteen editorial plaque identities. None is silently approved by this design freeze.

**Do not** activate achievement definitions, publish holders, grant awards, modify scoring/reputation/relationships, change the accepted parser truth model, stage/deploy, or merge design PR without Organiser 3 review.
