# PERS-V1F — Owner-corrected ordinary cross-context Personality; genuine T90 witness

**Authority:** owner #204 / #170, Organiser #205; acceptance #132. Private-only policy `AOF_PERSONALITY_PRIVATE_E2E_V3` and partial context adapter `AOF_PERSONALITY_CONTEXT_ADMISSION_V2`; original per-Game feature semantics `AOF_PERSONALITY_FEATURES_V1`. No source scoring grants, production sliders, migration, cloud or staging action. Main checkpoint: `1b5711006e70ff0e13b219cd11bbc82a37605706`.

## Plain player meaning

*"My Personality reflects how I generally play, whether I pick a different civilization or an ordinary map this week."* A different ordinary map ID, civilization, or arbitrary 16-minute versus 40-minute observation bucket does **not** reset a player's Boomer/Aggressor, Cautious/Bold or other comparable tendencies. The recording retains its exact real settings; feature-level evidence and opportunities must still be honest. A Nomad/Migration start, naval/water tactical opportunity, or team/FFA exposure can affect **specific axes**, not delete unrelated economy observations.

Three different layers must stay distinct:

1. **Source truth:** SHA-256/GUID, original participant/replay slot, patch, map ID, civilization, start, source revision, observed clock, authenticated roster in real league history.
2. **Per-Game axis measurement:** factual numerator/denominator, exact model version, complete method coverage, available military families per patch/civ, home anchor, independent command episodes. Missing input is `null`, never zero/50.
3. **Longitudinal aggregation:** eligible Games → **one per Battle** observation for an axis → two or more **independent eligible Battles** in a compatible versioned axis comparison group → private career/recent calibrated projection. Different Games/POVs of one Battle never meet sufficiency.

For STANDARD initial-town-center Games of the same format, ordinary map/civilization/duration metadata no longer fragments the group; WATER/HYBRID opportunity splits tactical, queue-family and spatial axes but not source-supported economy commitment. NOMAD/CUSTOM remain separate for opportunity-sensitive axes; **source-complete recorded resource-commitment share** has its own format-bound comparison group even without a reviewed starting TC. Explicit per-axis anchor bounds must match before raw Game ratios from different exact contexts are pooled within a multi-Game Battle. Different incompatible groups remain separate and a sufficient normal cohort still progresses. No silent normalization of incompatible models.

## Before → after counterexamples (controlled full-coverage engine unit tests)

| Scenario | Previous exact-context rule | V2 private comparison |
| --- | --- | --- |
| 2 standard 1v1 Battles, identical source model/denominators, different ordinary maps | One Battle per group → Developing | One eligible 1v1 standard group → READY (when source-authorized) |
| Same civ-only difference | Developing | READY when that axis's opportunity is source-qualified |
| Standard 1v1 3-Game Battle (mixed maps/civs) + another 1-Game Battle | First Battle erased by universal equality; or if Games counted, inflated | Per-axis compatible Battle aggregate + second Battle; independent Battles = **2**, not 4 |
| Standard land + standard water 1v1 | Entire profile split or averaged indiscriminately | Boomer/Aggressor can compare if complete; water-sensitive tactical/expansion/family axes separate |
| 2 standard + a Nomad/Migration-like custom Battle | Former global mixed-context veto | Normal 2-Battle axis stays READY; unsupported special context excluded with reason |
| CIV_5 military-family taxonomy absent, all other source inputs complete | Former universal block via overloaded context risk | Specialist/Improviser Pending only; other eligible axes unaffected |
| One withdrawn or duplicated POV/source correction | Potential false extra sample | Current revision replaces source, POV contributes no additional Battle |
| Result pending with current original READY and ordered source-bound history | All feature measurements suppressed by OFFICIAL-only condition | Behavioral features can be admitted without claiming any winner; the completed/ordered current-source Battle, immutable roster and replay proof remain mandatory |

A no-result authority is **not** a claim that a recorded Build request completed, an attack killed anything, or an outcome became official. The #204 result-pending correction changes Personality admission only; no War Room outcome, win record, Season statistics, award or social score behavior changes.

## Original T90 source witness — verified genuine input, **not** authenticated league history

Reproducible original pipeline: `replay-tools/t90_original_cohort.py` rehashes each actual repository replay and reruns existing canonical parser → analysis dataset → statistics projector → social context → source measurements → source grade methods. `functions/tests/t90-original-cohort.test.mjs` then derives the five actual original-based per-Game feature vectors through `measurePersonalityGame`. First successful run [#203 T90 genuine workflow 40694918816](https://github.com/Mathias-ao/League-of-Friends/actions/runs/40694918816) used exact original bytes; an updated exact-HEAD run is required before merge. Output source facts are immutable; replay slot changes from 1 to 2 in Game 3.

| Original file | SHA-256 prefix | Replay GUID | T90 slot / civ | Raw map | Observed interval |
| --- | --- | --- | --- | --- | --- |
| `aof-test-game-1.aoe2record` | `df9fe94378c0` | `546545a3-c0dd-764d-a466-2d33226a7926` | 1 / 3 | 140 | 963,949 ms |
| `aof-test-game-2.aoe2record` | `f7eee7367005` | `4e7bcea6-e296-564d-a814-837eedba4a87` | 1 / 5 | 140 | 1,976,299 ms |
| `aof-test-game-3.aoe2record` | `c0c32f6e04a4` | `b1e73ad5-49df-de43-a196-e36e4589d0e7` | 2 / 1 | 9 | 2,412,551 ms |

**Actual player-specific source-derived ratios** (denominators from the replay statistics; no synthetic numbers inserted):

| Axis | Game 1 | Game 2 | Game 3 | Direct source qualification |
| --- | --- | --- | --- | --- |
| Boomer/Aggressor — military **requested commitment** / full requested resource commitment | 2159/7909 = **0.272980** | 18003/32538 = **0.553292** | 19100/40225 = **0.474829** | All 3 source-extracted compatible economy/military models; never actual settled expenditure |
| Cautious/Bold — strategic **placement requests** in forward/home source sectors | 2/4 = **0.5** | 2/6 = **0.333333** | 0/12 = **0** | All 3 positional original-source denominators, under reviewed provisional 185872 strategic IDs |
| Guerrilla/Frontline — independently attributable episode **command posture** | NULL | NULL | NULL | `INSUFFICIENT_ATTRIBUTABLE_COMMAND_EPISODES`; direct source episode chronology/attribution not available at required sufficiency |
| Specialist/Improviser — independently available patch×civ military families | NULL | NULL | NULL | `CLASSIFIED_FAMILY_OPPORTUNITY_UNAVAILABLE`; no inferred military availability from observed queues |
| Compact/Expansive — distinct remote placement sites / (sites + home placements) | 2/6 = **0.333333** | 8/17 = **0.470588** | 7/13 = **0.538462** | All 3 have source-extracted expansion/home anchor evidence in the tested parser version |

**Test-only illustrative longitudinal projection:** Source-factual measurements above + deliberately synthetic `TEST-T90-BATTLE-[1..3]` identifiers, test outcome/roster bindings, provisional 0..1 anchors/median recency blend, and `LAND` **unreviewed test-only map-family assumption** yield Boomer/Aggressor **49.44**, Cautious/Bold **25.00**, Compact/Expansive **48.76**; remaining two axes **Developing/null**. These numbers MUST NOT be construed as a real authenticated League participant's eligible published Personality, or proof of approved source-exact map-family/start classification. Exact original model denominators are real; aggregation authority/context is simulated. The prior policy would create 3 disjoint exact map/civ/duration groups and withhold all three values. The corrected engine tests allow ordinary cross-context calibration while keeping unsupported axes null.

**Source-bounded social witness (T90 as actor only):** source-method-admitted **Rivalry** components 0/1/1 in Games 1/2/3; qualified **Gallantry/Cruelty/Chivalry** 0/0/0 in all three. Game1 has 3 T90-actor Pending social candidate groups, Game2 has 11, Game3 has 17; independent pre-entry challenge / victim disadvantage / third-party recipient protection / two-action corroboration are common missing proofs. A 1v1 alone cannot invent assisted teammate or rescued victim. Resulting proposed Reputation allocator has **0** authenticated canonical Claims or official Receipts. No conversion of neutral directed pressure into damage, maliciousness, delivery or aid.

## Scope / remaining evidence blockers

- Live authenticated T90 League identity **not established**: all 3 separate test Battle IDs/results are explicit wrappers. Original SHA/GUID/slots/opponents are never renamed or overwritten.
- These three original SHA-256s are **not yet in a reviewed map/start source-proof registry**; `LAND` in the isolated fixture is a test assumption and never written to the production registry. Current private real history still requires current source/roster admission and authenticated historical order (approved Event plan/Game ordering, or an actual verified completion); it does not require an officially resolved winner or invented completion.
- `SPECIALIST_IMPROVISER` requires reviewed `BUILD_185872_CIV_3/5/1` military-family opportunity; `GUERRILLA_FRONTLINE` requires complete producer-unique episode evidence and two command episodes. Their absence does not suppress numeric resource/placement/expansion observations in the source-derived test.
- 1v1, TEAM and FFA still have distinct tactical exposure groups. This test demonstrates genuine 1v1 only; TEAM/FFA source-auth/format/fixed-diplomacy negatives remain in the existing accepted 4-format test corpus and should not be declared newly genuine longitudinal positives.
- Player privacy, original-source/slot mapping, current revisions/withdrawal/rebind, multi-Game dedup, and strict social history remain authoritative. No UI/Season source mutation or #181 branch edit.

## Worker S coordination

Shared meaning with #206: **Game is the evidence unit; Battle is the independent history opportunity; Season/player profile aggregates Battles, not Games**. Source-real numerator/denominator should remain visible alongside Battle aggregate. Mixed incompatible source model versions must be version-isolated; ordinary map/civ variation does not itself make a model incompatible. A 3-Game Battle must have one independent influence on Personality and on any Season metric explicitly labeled `Per Battle`. This PR does not touch Worker S Statistics UI/read model or record ranking.

## Acceptance

The draft PR must have exact-HEAD green backend + genuine-T90 workflow. Owner semantic review must independently accept the ordinary cross-map/civ rule and its nearest special-start/missing-taxonomy negatives. A previous green test for exact-match contexts cannot count as V2 product acceptance. No staging, cloud, flags, grants or deployment is authorized.


## Sol independent review closure — 29 October 2026 (PR #203)

Independent Sol review [#203 comment](https://github.com/Mathias-ao/League-of-Friends/pull/203#issuecomment-6483467641) found: (1) six context-source tests were broken by a newly imposed OFFICIAL proof-object shape in the pure adapter; (2) a missing Match \`firstCompletedAt\` still erased valid READY UNRESOLVED behavior; (3) CIV/duration/source context was still globally all-or-nothing.

### 1. Result vs historical order: explicit source truth, no invented date

The canonical approved schedule already exists at \`deriveSocialScheduleOrders\`, backed by the transaction-fenced \`collectMyCurrentBattleHistory(includeScheduleOrder:true)\`. The owner-private Personality reader now requests that **server-only** schedule evidence and passes it to \`projectPrivatePersonalityHistory(...,scheduleOrders)\`. Every scheduled Game must have:

- matching \`battleId\`, \`gameId\`, \`eventId\`, \`seasonId\`, **explicit Game number**, approved Event/Match plan slot and source-bound actual roster;
- the **ORDERED** \`AOF_SOCIAL_SCHEDULE_ORDER_1\` authority and a valid source derivation revision;
- a verified positive Event schedule timestamp and approved Battle/slot ordinal.

The event timestamp is stored as **scheduled Event start**, never claimed to be actual Game completion. \`historicalOrder.event/battle/game\` sorts same-Event Battles by approved plan slot **not alphabetic IDs or upload/created/arrival timestamps**. The Battle source revision includes the authoritative scheduling evidence; later corrections/plan revision produce new projections. Existing verified positive first-completed timestamps remain a compatible fallback for legacy Battle history, **not a fabricated replacement**. A Battle with neither an authoritative complete schedule nor verified completion remains Pending and is not assigned an ordering date. No UI publication or match result is changed.

Sol exact controlled case: 2 distinct current READY source-bound Battles, both \`outcome:{qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null}\` and both \`match.firstCompletedAt=null\`; approved non-tied Event schedule, approved plan, contiguous Game #1, verified roster: **five-axis private controlled** values 30/50/0/0/33.33; independent Battles=2. Unapproved/revoked plan, wrong slot, warmup, missing Event schedule, forged event/season/Game-number/revision, forged roster, no approved order: **no two-Battle READY**. The synthetic inputs demonstrate the history *semantics*, not authenticated original League membership.

### 2. Source admission and per-axis coverage

- \`contextAdmission\` retains its strict **complete** \`context\` / \`ADMITTED\` result and full provenance \`missing[]\` inventory. It now also exposes \`behaviorContext\` only when the immutable current source/roster/subject **and actual verified format + clock** pass. Unreviewed map-family, start, civ, duration bucket or patch do not become fabricated enum values; missing values are \`null\`.
- The private policy binds that partial context to the exact original source authority/revision digest, but creates **Boomer/Aggressor** anchors directly from verified format/clock and complete cost denominators, while other opportunity-sensitive axis anchors still require **both map family and start to be independently source-reviewed**. Missing versioned civ family/opportunity makes Specialist Pending only; missing reviewed duration label cannot veto verified cost accounting or strategic placement measurement. Missing start/map family cannot create a fabricated ordinary spatial/military comparison group; it does not erase genuinely comparable resource-commitment shares.
- \`measurePersonalityGame\` retains READY/revision/subject/slot/roster/format/verified clock and disputed/withdrawn/current source checks, but does not globally require a civ key or an arbitrary duration bucket. The individual axis evaluator retains specific evidence guards for request cost coverage, strategic placement model/build taxonomy, complete independent episode commands/FFA diplomacy, exact military family denominator, or observed expansion/home anchor.
- Standalone \`admitPersonalityContext\` remains compatible with historical synthetic \`{qualification:'OFFICIAL'}\` test envelopes; the upstream canonical source loader validates full shape. \`UNRESOLVED\` **requires** exactly null \`winningPlayerIds\` and \`resultRevision\`, never a disguised OFFICIAL winner.
- Provenance is not an approved opportunity: a classifier-less original can produce source-factual per-Game observations, but gets no anonymous standard-land **tactical, expansion or family** anchor or invented five-axis score. Only independently qualified cost-share may aggregate under its own explicit provisional policy.

### 3. Evidence summary and acceptance boundaries

- Ordinary cross-map/civ 1v1 real-source **numerators/denominators** and conditional 3-axis T90 private simulation remain as above.
- Two pending genuine T90 axes remain: independent attributed command episodes and exact patch×civ military family opportunity. No live T90 identity, reviewed map/start classification or official Battle mapping was synthesized.
- No changes to Worker S Season Statistics, Sol #181, canonical match scoring, score publication, social reputation awards or deployment.
- Exact-head CI must prove corrected pure context tests, private schedule positive/negative and the genuine original T90 workflow. A green *intermediate* head does not authorize merging this PR.
