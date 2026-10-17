> **Research archive (17 October 2026).** This is the worker's original read-only investigation, preserved for traceability. It is not an approved scoring rule, implemented capability, deployment report, or activation decision. See [the integrated V1 launch roadmap](../project/SOCIAL-V1-LAUNCH-ROADMAP-2026-10-17.md) for current conclusions and precedence.

# Age of Friends V1 — Military, Spatial and Territorial Signal Audit

Read-only source audit · 17 October 2026

## 1. Verified repository checkpoint

&#x20;Current main verified

| Item                         | Verified state                                                       |
| ---------------------------- | -------------------------------------------------------------------- |
| Repository                   | `Mathias-ao/League-of-Friends`                                       |
| Current `main`               | `25f120412df5ed0118b9557cdf822ab175108242`                           |
| Comparison with supplied SHA | Identical; 0 commits ahead or behind                                 |
| Social Evidence V1a          | PR #120 merged                                                       |
| V1a implementation           | Authenticated, read-only Game evidence and pending social candidates |
| Social progression           | Not activated                                                        |

[Verified main commit](https://github.com/Mathias-ao/League-of-Friends/commit/25f120412df5ed0118b9557cdf822ab175108242?utm_source=chatgpt.com) · [Social Evidence V1a contract](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/docs/architecture/social-evidence-v1a.md?utm_source=chatgpt.com)

### Principal finding

AoF has substantially more recording-derived military and spatial evidence than its current social admission layer uses. The main limitation is not basic detection: it is proving exactly what a detected episode means, which opponent it concerns, and whether its geography is appropriate.

The existing implementation already distinguishes objective recording observations from inferred episodes and from pending social claims.

In particular, Social Evidence V1a explicitly leaves substantive conduct unqualified with `SUBSTANTIVE_CONDUCT_NOT_EXECUTABLE`. Its current source-structure verification therefore cannot be read as evidence that attacks caused damage, help rescued an ally, or competition deserves Reputation or Relationship movement.

The audit below keeps three outcomes distinct:

- Factual/statistical evidence: sufficiently supported for bounded, appropriately labelled analysis.
- Candidate social evidence: potentially meaningful, but missing necessary semantic, territorial or directional qualification.
- Credited social interpretation: outside this audit and not enabled by any recommendation.

## 2. Source-to-social trace

Recording extraction

`canonical_projector.py` · `analysis_dataset.py`

Source actions, objects, production requests, building placements, player slots, coordinates and timestamps

Existing statistics producers

`statistics_projector.py`

Raid V3 · Skirmish V2 · Engagement V4 · Military V5 · Map Presence V8 / Forward Eco V2 · Execution V2

Pair evidence path

Pair Social Evidence V1 → Episode Context V1 → statistics/social bridge → directional ledger → military families

Spatial statistics path

Home anchors, buildings, zones, gold influence, expansion and positional context

Not yet fully connected to pair-specific social deeds

Social Evidence V1a

`getSocialEvidenceV1a.ts` + `social_evidence_v1a.py`

Authenticated active Game/source facts, source-deed IDs, direction, family facets and pending qualification

Zero credited social progression

The common upstream analysis contract is `AOF_REPLAY_ANALYSIS_V5`. The statistics projector emits `AOF_CANONICAL_STATISTICS_V1` with schema `1.1.0`, or `AOF_RECORDED_EVENTS_STATISTICS_V1` with schema `1.2.0`, using the same downstream statistic and social families.

The V1a handler passes `source`, `matchFacts`, `participants` and `pairSocialEvidence` to the existing authenticated worker. It does not pass the complete `participants[].mapPresence`, `military.engagements`, or other spatial/statistical sections into the social projection. That is the important missing integration seam for this audit.

Verified source files: [statistics projector](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/statistics_projector.py?utm_source=chatgpt.com), [Pair Social Evidence](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/pair_social_evidence.py?utm_source=chatgpt.com), [V1a authenticated reader](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/functions/src/queries/getSocialEvidenceV1a.ts?utm_source=chatgpt.com).

## 3. Signal coverage matrix

Primary readiness classification. Several signals are available as statistics but not yet as independently qualified social evidence.

| #  | Signal                                  | Classification                                    | Personality / Chronicle / Social Evidence suitability                                                                         |
| -- | --------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1  | Directed military pressure              | Additional qualification                          | Global aggression tendency and pair-specific directed-pressure candidates; factual command/episode descriptions only          |
| 2  | Raids and economic targeting            | Additional qualification                          | Raiding playstyle, verified economic-zone pressure and possible Rivalry/Gallantry/Cruelty candidates                          |
| 3  | Skirmishes, Battles, Great Battles      | Bounded inference now                             | Military participation and Frontline Fighter tendencies; social significance needs separate proof                             |
| 4  | Singling out an opponent in team games  | Missing essential witness                         | Individual targeting observations exist, but selective preference over comparable opportunities is unproven                   |
| 5  | Co-attacks / shared offense             | Additional qualification                          | Target-specific participation and coordinated-looking play; not proof of deliberate cooperation or Bond                       |
| 6  | Defensive assistance / reinforcement    | Additional qualification                          | Directed helper→beneficiary candidate; material assistance or protection not established                                      |
| 7  | Forward military/economic buildings     | Geographic contract correction                    | Factual placement and expansion data; directed enemy-territory meaning needs reconciliation                                   |
| 8  | Forward towers                          | Geographic contract correction                    | Tower placements and inferred forward sector; no operational-threat proof                                                     |
| 9  | Forward castles / enemy home pressure   | Missing essential witness + geographic correction | Placement can be detected; operational completion, unique-instance queue and approved home-pressure geometry are not complete |
| 10 | Gold control / contested resources      | Bounded inference now                             | Infrastructure-influence and resource-oriented playstyle; no proven possession, extraction or territorial conquest            |
| 11 | Defensive counterplay / return pressure | Additional qualification                          | Response and reverse-pressure context exists; substantive counterplay and reciprocity remain unproven                         |

Here, “bounded inference now” means the current statistical output is usable with its existing qualifications and limitations. It does not authorize a Personality score, Reputation award or Relationship effect.

### Exact producer and output fields

| #  | Producer and version                                                                                                     | Existing output evidence                                                                                                                                                                            |
| -- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | `skirmish_detector.py` — `AOF_SKIRMISH_DETECTION_V2`; `AOF_SKIRMISH_PAIR_EVIDENCE_V2`                                    | `directedInteractionEdges[]`: `fromPlayerId`, `toPlayerId`, `evidenceMethods`, `observations`, `targetInstanceId`, `controllerEvidence`, `sourceEventIds`                                           |
| 2  | `raid_detector.py` — `AOF_RAID_DETECTION_V3`                                                                             | `raidEvidence.initiatedEpisodes[]` / `receivedEpisodes[]`: `attackerPlayerId`, `victimPlayerId`, `economicTargetTypes`, `victimResolutionMethods`, `strongCommandCount`, `center`, `sourceEventIds` |
| 3  | `skirmish_detector.py` + `engagement_statistics.py` — Skirmish V2 / `AOF_ENGAGEMENT_STATISTICS_V4`                       | `engagementEvidence.skirmishes[]`, `battles[]`, `greatBattles[]`: participants, sides, windows, command strength, selected unit-class evidence, promotion and `greatBattleQualification`            |
| 4  | `skirmish_detector.py` / Pair Evidence V1                                                                                | `targetedDirections`, `targeted_controlled_object:*` observations, target controller references and per-pair source deeds; no selective-attention/opportunity-normalized metric                     |
| 5  | `engagement_statistics.py` — V4                                                                                          | `engagementEvidence.cooperativeAttacks[]`: `attackerPlayerIds`, single `targetPlayerId`, `directedInteractionEdges`, `sourceEventIds`, location context                                             |
| 6  | `engagement_statistics.py` — V4                                                                                          | `defensiveAssistsGiven/Received[]`, `allyReinforcementsSent/Received[]`: `helperPlayerId`, `defendedPlayerId`/`supportedPlayerId`, `baseSeed`, source events and unit-class evidence                |
| 7  | `map_presence_v8.py` inheriting V4 geometry; `forward_eco.py` — `AOF_FORWARD_ECO_V2`                                     | `mapPresence.buildingSectors`, `forwardBuildings.evidence[]`, `forwardEco.evidence[]`, `expansionZones.zones[]`                                                                                     |
| 8  | `map_presence_v4.py` inherited by V8                                                                                     | `mapPresence.towers`: `count`, `forwardCount`, `byBuilding`, `evidence[]`, `forwardEvidence[]`, each with relative geometry and source event                                                        |
| 9  | `map_presence_v4.py` + `military_statistics.py` inherited by Military V5                                                 | Forward building evidence, `military.castles.count/firstAtMs`, BUILD records and production events; no validated completed-Castle-instance→queue chain                                              |
| 10 | `map_presence_v4.py` inherited by V8                                                                                     | `mapPresence.goldControl`: `controlSharePercent`, `controlledGoldDepositEquivalent`, `takeoversWon/Lost`, `clusters[]`, `controlHistory`, `playerContributions`                                     |
| 11 | `execution_statistics_v2.py` + `pair_episode_context.py` — `AOF_EXECUTION_STATISTICS_V2` / `AOF_PAIR_EPISODE_CONTEXT_V1` | `raidResponse.evidence[]`; `PRESSURE_RESPONSE`, `DEFENSIVE_SUPPORT_WITH_PRESSURE`, `RETURN_PRESSURE` annotations/sequences                                                                          |

All these producer fields are downstream of recording-derived observations; their classifications are not equally strong.

## 4. Military and directional interpretation

### Signals 1–2: directed pressure and raids

The Raid V3 detector has a meaningful existing attribution hierarchy.

It can recognize an `ORDER` against an economic unit with a known controller, using the controlled target's instance identity. It can also infer pressure from hostile commands inside an opponent's economic zone, with a weaker proximity-based attribution.

The resulting episode is directional: attacker A → victim B. It preserves the reason for attribution, the underlying source commands, timing and economic-target context.

Strength: source-backed actor and recipient, reusable for global raid frequency and pair-specific pressure history.

False positives: an `ORDER` may not represent an attack; a military command near an enemy economy may not cause damage; a predicted victim from nearby economic geography may not be the intended target. Repeated commands can also be one continuous episode.

The Pair Social Evidence adapter turns supported Raid V3 entries into `ECONOMY_PRESSURE` facets and merges them with locally overlapping directed-command evidence when appropriate. This makes pressure and raids two views of related evidence—not two independently rewarded deeds.

For Personality, the valid measurement is something like repeated command-derived economic pressure within suitable recording coverage. The stronger interpretation “a player relentlessly hunted a helpless opponent” would require evidence of substantive repeated conduct and a verified disadvantage at the relevant episode starts. It is not currently established.

### Signal 3: Skirmishes, Battles and Great Battles

There are two distinct meanings of the word Battle in the codebase:

- An AoF league Battle is the official historical competition entity containing one or more Games.
- An Engagement V4 `battle-*` is a technical, command-derived encounter inside one recording.

They must not be conflated.

Skirmish V2 clusters compatible command activity, then adds pair-specific directed interaction edges. Engagement V4 promotes qualifying skirmishes when actual opposing-side command participation is established, applying known unit-class evidence to avoid certain civilian-only false positives.

Great Battle is a still stricter existing heuristic using contributing players, duration, selected-object footprint and strong command activity. Its threshold constants already exist in `engagement_statistics.py`; they are not evidence of exact army size, kills, damage or combat outcome.

This is useful bounded global military activity evidence. It may inform a Frontline Fighter tendency over sufficiently comparable Games. It should not automatically produce Gallantry, Rivalry, or a dramatic Chronicle highlight.

There is also legitimate duplication: a Great Battle is already a Battle, which is already promoted from a Skirmish. A raid may overlap that same event. V1a should preserve those linked facets without treating the nested categories as three separate deeds.

### Signal 4: singling out an opponent in team games

Individual targeted attention can be measured; genuine preferential singling-out is not currently proven.

The source system can establish cases where player A issued a command targeting an object controlled by opponent B. That gives a directed observation with source provenance.

However, deciding that A singled out B relative to other possible opponents requires a denominator of comparable actual opportunities.

A naïve calculation such as “A directed 70% of commands toward B” is not sufficient. B may have been the only nearby opponent, the assigned flank enemy, the only opponent whose structures were accessible, or the only active participant in the detected encounter.

Repeated orders to the same unit would also inflate attention without creating additional independent conduct.

The proper distinction is:

| Question                                                         | Current support                                    |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| Did A issue sourced target commands toward B?                    | Yes, when controller attribution is valid          |
| Did A participate in several distinct B-specific episodes?       | Partly; deed identity and episode separation exist |
| Did A have comparable qualified opportunities to engage C and D? | No complete opportunity model                      |
| Did A preferentially select B over those alternatives?           | Not independently established                      |
| Was that preference hostile, personal or unusually significant?  | Not independently established                      |

For V1, preserve directed target attention as bounded factual evidence. Do not call it fixation, obsession, personal targeting or exceptional Rivalry.

A later selective-focus qualifier should compare distinct, qualified directed episodes against actual accessible/opposing opportunities, while accounting for map position, team role, encounter availability, recording coverage and source duplication. It should not be introduced as a raw command-percentage scoring rule.

### Signal 5: co-attacks

Engagement V4 already makes an important distinction: it groups contributing attackers against a specific target player, rather than flattening all attackers and opponents involved in one large engagement.

`_cooperative_attacks()` keeps target-specific attacker sets and source interaction edges. Pair Social Evidence then preserves both contributors' source events under `SHARED_OPPONENT_PARTICIPATION`.

This can truthfully establish that two teammates were both observed participating against the same opponent in the same inferred clash.

It does not establish that they coordinated deliberately, that one assisted the other, or that either player was the beneficiary. A shared opponent does not automatically strengthen Bond.

Co-attacks can inform descriptive team-combat tendencies; a social claim requires additional independently demonstrated directed assistance or qualifying conduct.

### Signal 6: defensive assistance and reinforcement

Engagement V4 supplies source-backed helper and beneficiary IDs, including cases tied to a defender's base.

`DEFENSIVE_PARTICIPATION` and `REINFORCEMENT_COMMANDS` can become A→B Bond or Chivalry candidates, never automatic effects.

The existing defensive assistance record can identify the helper's contribution and base context; a standalone reinforcement candidate recognizes supported commands near an ally's base.

The unresolved distinction is between being present and issuing military commands versus materially helping the beneficiary.

A real defense may involve useful resistance or assistance without a successful outcome. Equally, proximity and synchronized commands do not prove a rescue, prevented loss, completed reinforcement, or substantive protection.

The initial implementation relies on fixed-alignment support. Approved Relationship policy allows substantive directed help without formal alliance, including FFA, but the current fixed-team detector cannot be stretched to manufacture that evidence.

### Signal 11: defensive counterplay and return pressure

The existing Pair Episode Context V1 contains three useful, separate context families:

| Existing context                  | What it establishes                                                                    | What it does not                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `PRESSURE_RESPONSE`               | A recorded defender command temporally associated with an attributed raid              | That the command caused a defense, counterattack or tactical success          |
| `DEFENSIVE_SUPPORT_WITH_PRESSURE` | Directed support associated with a source-linked defensive clash and opponent pressure | Direct helper attack on the pressure actor, rescue or successful interruption |
| `RETURN_PRESSURE`                 | Independently ordered subsequent reverse-direction pressure episode                    | Revenge, reciprocity, escalation or exceptional conduct                       |

This is a good foundation for future Rivalry consideration, particularly active defensive resistance. But the original response command must independently demonstrate substantive counterplay; being attacked, moving nearby or surviving is not enough.

The existing source link is contextual evidence, not a second deed or an automatic reciprocal claim.

Source references: [Raid V3](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/raid_detector.py?utm_source=chatgpt.com), [Skirmish V2](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/skirmish_detector.py?utm_source=chatgpt.com), [Engagement V4](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/engagement_statistics.py?utm_source=chatgpt.com), [Pair Episode Context](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/pair_episode_context.py?utm_source=chatgpt.com).

## 5. Geographic audit — friendly, neutral and enemy territory

This is the area most in need of a contract-level correction before directed social interpretation.

### How the existing geometry actually works

Map Presence V8 is the active projection, but it does not independently define a new territorial geometry. It inherits earlier models:

`map_presence_v8 → v7 → v6 → v5 → v4`

Map Presence V4 defines its normalized Enemy Progress geometry from initial Town Center anchors. It calculates a relative position for a player against each non-teammate with a valid starting TC, then selects the opponent giving the highest Enemy Progress.

The current statistical zones are:

Home

0–35%

Mid-map

35–65%

Forward

65–100%

Conceptual one-opponent cross-section of the existing Enemy Progress model. Not a map of actual territorial ownership.

The formula uses the distances from the placement to A's starting TC and the candidate opponent's starting TC, normalized by the separation between those TCs. It is 0 at A's TC, 50 at the equal-distance boundary and 100 at B's TC, then clamped.

This is a useful, existing positional measure. It is more informative than distance from map center or an absolute distance from home.

However, two caveats matter.

First, `forward` is not automatically verified enemy territory. Because the code chooses the maximum progress against any non-teammate, it does not independently establish that the chosen enemy's territory governs the placement rather than an allied home area, contested area, or ambiguous multiplayer geography.

Second, `enemyPlayerId` is a geometric reference, not proof of intended victim. A placement can be geographically forward relative to opponent B without being a deliberate action against B.

That is precisely where the approved friendly/neutral/enemy territorial language must take precedence over an older statistical label.

### Proposed reconciliation

Keep the established Enemy Progress calculation and all its current statistical fields. Do not replace the Map Presence model.

Add a separate, source-backed territorial qualification when a downstream consumer needs a directed claim:

| Condition                                                                                   | Required conclusion                               |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Initial starting TC anchors verified                                                        | Geometry may be evaluated                         |
| Approved friendly/neutral/enemy territorial classification establishes enemy-side placement | Candidate enemy-territory context may be attached |
| Specific opponent B reliably identified                                                     | A→B geographic context possible                   |
| Multiple plausible threatened opponents, no defensible attribution                          | Keep spatial fact, direction pending              |
| Only far from A's home or close to center                                                   | Not sufficient                                    |
| Placement belongs to friendly/neutral territory                                             | Do not call it a directed forward threat          |
| Building completion or operation unknown                                                    | Describe placement, not an operational stronghold |

Where possible, reuse V4's per-opponent distances and the existing source-event coordinates. The missing piece is an authenticated territorial classification and ambiguity result under the approved policy, not another geometry formula or new distance threshold.

One implementation detail is important: `_relative_position()` currently returns only its highest-progress opponent. A future directed territorial qualifier must consider all relevant player/team anchors or preserve the necessary candidate-relative values. The best-match result cannot be treated as exhaustive multiplayer attribution.

### Signal 7: forward military and economic buildings

The current source can report a building placement in a geometrically forward sector, with `buildingId`, coordinates, time, source event and associated opponent distance.

`forwardEco` specifically recognizes Mining Camps, Lumber Camps, Mills and Town Centers. Map Presence's general `forwardBuildings` also covers military structures and others, with broad categories.

`expansionZones` further clusters remote placements into local expansion groups. This is useful for Personality's Compact ↔ Expansive axis, subject to coverage and Game context.

But `buildingPlacementRange` measures spatial spread, not enemy occupation, and a remote economic expansion is not necessarily hostile. Economic forwardness and directed military pressure must remain separately qualified.

Recommended V1 coverage: retain the current placement and expansion statistics; repair territorial qualification before treating placements as pair-specific social pressure.

### Signal 8: forward towers

The V4 tower classifier recognizes documented tower IDs as well as catalog tower roles and names, including relevant tower-like variants.

`mapPresence.towers.forwardEvidence[]` contains placement coordinates, the referenced opponent, Enemy Progress, and source event.

That can establish a forward tower placement command under the existing geometry.

It cannot establish that the tower was finished, garrisoned, fired, damaged an opponent, or imposed a meaningful military threat. A tower on the enemy side may also have been built for defense or resource protection.

A forward tower can become a source-backed positional pressure candidate after territorial and counterpart qualification. It should not automatically become Gallantry, Cruelty, Hostility or a Chronicle highlight.

### Signal 9: forward castles and home pressure

This requires stricter treatment than other forward buildings.

The current military and Map Presence outputs contain genuine useful Castle-related data, but the approved special meaning of Forward Castle is not yet independently provable end-to-end.

Approved special-case evidence chain

1. Genuine Castle instance identified from a qualified raw building identity.
2. Placement established in enemy territory, with a specific opponent's starting TC/home area providing the relevant home-pressure context.
3. Unique Castle instance becomes operational, with completion time independently verified.
4. That same Castle instance issues its own production-queue command within five minutes after operational completion.
5. Source chronology and queue coverage are sufficient to distinguish qualification, nonqualification and pending evidence.

These are existing approved requirements, not newly proposed scoring rules.

The current `canonical_projector.py` provides BUILD placement records containing the building type, builder IDs, coordinates, time and source event.

Production events separately retain `producerObjectIds`, unit ID, quantity and sometimes producer-building type.

The missing witness is the reliable chain between the placed Castle, its actual constructed instance, its operational completion and its own queue command.

The BUILD event identifies builders, not necessarily the uniquely completed building instance. The production event may contain multiple selected producer IDs, and the military statistics themselves warn that producer selection does not necessarily prove which individual building received a queued unit.

The retained current projection also does not generally establish Castle completion time.

Furthermore, the older low-level `_is_castle()` helper recognizes raw IDs `82` and `1251`, covering Castle and Krepost references. The approved special case requires a genuine Castle. It must not inherit the broader helper's classification without explicit distinction.

The castle's enemy-home distance must be measured against the specific affected opponent's starting TC, not simply the nearest convenient enemy or the furthest Enemy Progress result. The exact approved home-pressure distance criterion remains unresolved; inventing one would change policy.

Disposition: preserve ordinary Castle placement facts now. Keep the special Forward Castle effect pending until geographic specificity and the unique completion/queue witness exist. A queue within five minutes of placement may be a sufficient timing witness under the previously approved qualification conditions, but queue absence or a later queue cannot be used to fabricate completion timing.

Source references: [Map Presence V4 geometry](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/map_presence_v4.py?utm_source=chatgpt.com), [Map Presence V8](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/map_presence_v8.py?utm_source=chatgpt.com), [Forward Eco V2](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/forward_eco.py?utm_source=chatgpt.com), [canonical projector](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/canonical_projector.py?utm_source=chatgpt.com).

## 6. Gold control and contested resource geography

Gold Control should be preserved as a useful existing statistical model, but its current name can be misleading outside its documented scope.

The active V8 result inherits V4's deposit-weighted, time-aware infrastructure-influence estimate.

Its main inputs are known initial gold objects and the recorded locations of infrastructure such as Town Centers, Mining Camps, Castles and Towers. The model weights nearby buildings and estimates each player's influence around gold clusters.

A change in the leading infrastructure-influence score may generate `enemy_control_takeover`, `takeoversWon` or `takeoversLost`.

These values mean inferred influence leadership changed, not that a player captured a mine, mined its gold, eliminated a defender or secured territorial ownership.

| Current capability                                          | Evidence strength                     |
| ----------------------------------------------------------- | ------------------------------------- |
| Initial gold deposits and geographic clusters               | Source-backed positional facts        |
| Building placement near gold                                | Source-backed placement fact          |
| Relative infrastructure influence                           | Modelled estimate                     |
| Contested influence or change in model leader               | Modelled spatial classification       |
| Actual mining, possession, depleted gold, exclusive control | Not established                       |
| Capturing an enemy's gold economy                           | Not established by Gold Control alone |

The model does not subtract old influence when structures are destroyed, and it does not retain a complete mined/depleted-gold history. Consequently, “gold control” cannot be assumed to reflect the actual present state of a battlefield.

For Personality, a player's repeated infrastructure investment around contested resources might eventually inform an Expansive or map-control tendency. For factual history, carefully worded resource-oriented placement observations can be legitimate.

For social evidence, it is contextual. A gold-influence change should not become a standalone hostile deed, conquest or Rivalry event. It may enrich an already qualified directed military or territorial episode.

Recommended V1 wording: “estimated infrastructure influence over gold deposits,” rather than “owned the gold,” “stole the gold” or “captured the mine.”

Source: [Map Presence V4, ](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/map_presence_v4.py?utm_source=chatgpt.com)[`_gold_control_all`](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/map_presence_v4.py?utm_source=chatgpt.com).

## 7. Source-backed examples and actual verification level

The repository contains both authentic-recording acceptance evidence and smaller synthetic fixtures that exercise individual signal semantics. These must not be confused.

### Authentic recording acceptance

The merged V1a acceptance report documents four authentic recording cases:

| Recording fixture | Verified by V1a acceptance                                                                      | Not established by that report                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `1v1_t90-deak`    | Authenticated current Game evidence, source facts, pending qualification and correction fencing | Any particular raid or qualifying social deed                                       |
| `2v2_arabia`      | Same source/authentication and pending-evidence checks                                          | Selective opponent targeting or genuine team assistance                             |
| `4v4_arabia`      | Same checks; full canonical/native statistical equivalence separately reported                  | Genuine coordination, Castle pressure or significant defensive conduct              |
| `FFA_7`           | Same checks under FFA source conditions                                                         | Independently qualified dynamic help, intentional antagonism or reciprocal pressure |

The acceptance report also confirms canonical/native 1v1 semantic parity, 376 backend tests, 467 Python tests with 13 opt-in skips, and zero substantive social progression qualification.

These are meaningful integration results. However, the report does not publish per-incident spatial coordinates, attacker/victim counts or representative qualified military episodes. I therefore cannot honestly claim that an individual authenticated 4v4 player singled out an opponent or built a Castle near an enemy TC based on that report.

[Social Evidence V1a acceptance report](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/docs/testing/benchmarks/social-evidence-v1a/acceptance.json?utm_source=chatgpt.com)

### Exact semantic examples from the source tests

One raid, several detector facets, one deed

In `test_pair_social_evidence.py`, five directed ORDERs from player 1 against player 2's controlled target, together with local response evidence, produce one deed with `ECONOMY_PRESSURE`, `TARGETED_COMMAND` and `LOCAL_COMMAND_OVERLAP` facets.

This verifies deduplication and attribution, not five independently significant attacks.

One-sided targeting does not become an Engagement Battle

The Engagement test with a single ORDER against a known opponent's TC produces a Skirmish candidate but no promoted technical Battle.

This is an important existing distinction between targeted commands and mutually established combat participation.

Defensive assistance direction is preserved

A synthetic test records player 3 assisting player 2 near player 2's base, with player 1 as the opposing actor. The social incident is 3→2, retains `p2-tc` as contextual base evidence, and preserves `assist` as the supporting source command.

It does not manufacture 2→3 Bond or claim that player 3 saved the base.

Forward tower geometry

In the Map Presence V4 test, player 1 starts at (10,10), opponent 2 at (90,10), and a Watch Tower is placed at (70,10).

The expected Enemy Progress is 75%, so the current model calls it forward. A Barracks at (55,10) is classified mid-map.

This verifies the statistical geometry, not an operational tower or the complete approved territorial social classification.

Gold influence changes without a mine capture

A synthetic test places a gold deposit at (50,50), with one player's Mining Camp at (45,50) and the other player's later Mining Camp at (50,50).

It expects influence shares of approximately 33.33% and 66.67% and one inferred `enemy_control_takeover`.

The result is a change in modelled infrastructure influence, not observed extraction or actual possession.

Verified test sources: [Pair Social Evidence tests](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/tests/test_pair_social_evidence.py?utm_source=chatgpt.com), [Engagement tests](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/tests/test_engagement_statistics.py?utm_source=chatgpt.com), [Map Presence V4 tests](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/tests/test_map_presence_v4.py?utm_source=chatgpt.com).

## 8. Useful existing signals omitted from the requested list

Several additional established signals could contribute to descriptive Player Personality without requiring new replay detectors.

| Existing evidence                            | Source / version                           | Suitable V1 interpretation                                     | Limitation                                                                          |
| -------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Scouting-command route coverage              | Map Presence V8                            | Exploration-command tendency and opening spatial reach         | Not fog-of-war discovery or verified scout movement                                 |
| Expansion zones and building spread          | Map Presence V8, inherited V5/V4           | Compact ↔ Expansive positional tendencies                      | Placement, not occupancy or lasting expansion success                               |
| Walls and defensive fortification placements | Map Presence V8                            | Defensive infrastructure preference                            | No completed wall, effective protection or intent                                   |
| Enemy-side command contact                   | Map Presence V8, inherited V3/V2           | Forward operational presence proxy                             | Commands do not prove physical arrival or attack                                    |
| Military unit-family composition             | Military V5 / Unit Class Families V1       | Specialist ↔ Improviser; broad military composition tendencies | Queue commitment and selected-object classification, not actual army inventory      |
| Army commitment checkpoints                  | Military V5                                | Relative military investment patterns                          | Estimated queue commitment, not surviving force                                     |
| Build-order and opening timing               | Opening and Build Order models             | Boomer ↔ Aggressor context over comparable Games               | Opening decisions alone do not determine Personality                                |
| Recorded response latency / tasking          | Execution V2                               | Command-level reaction and defensive control tendencies        | Timestamp differences, not proven reaction causality or tactical quality            |
| Terrain/elevation engagement context         | Engagement/Execution evidence              | Positional context for military decisions                      | Does not prove terrain advantage was intentional or decisive                        |
| Relic targeting                              | Map Presence V8 / `AOF_RELIC_TARGETING_V1` | Objective-focused command interest                             | No verified relic possession, theft or deposit                                      |
| Tribute and directed diplomacy commands      | Canonical command evidence / match facts   | Directed economic or diplomatic behavior                       | Commands do not automatically prove generosity, alliance effectiveness or Treachery |
| Raw action and selection statistics          | Observed Commands / Execution V2           | Execution habits and contextual activity                       | APM and selection size are not skill, bravery or character                          |

For Personality, these signals are potentially valuable because the intended slider system is longitudinal and descriptive, not a verdict derived from one match.

The five approved axes can use separate families of qualified observations without becoming social scoring systems:

| Personality axis              | Most useful existing evidence                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Boomer ↔ Aggressor            | Economy/military commitment, openings, directed pressure                                         |
| Cautious ↔ Bold               | Positional exposure, defensively oriented infrastructure, substantively qualified risky advances |
| Guerrilla ↔ Frontline Fighter | Raid episodes versus sustained engagements and battle participation                              |
| Specialist ↔ Improviser       | Military composition, unit-family variety, openings and adaptation context                       |
| Compact ↔ Expansive           | Building spread, expansion zones, home anchors, territorial placement                            |

The current source signals support investigating these axes, not assigning final slider values yet. Context normalization, history coverage, change resistance and calibration remain necessary.

## 9. Smallest reusable integration seam

I recommend one bounded spatial/context enrichment of the existing Social Evidence V1a read, without another parser, deed ledger or scoring engine.

Existing V1a admission

Authenticated Game/source → Pair Social Evidence V1 → directional episode ledger → family-tagged pending deeds

Small additive seam

From the same verified recording statistics, select source-linked Map Presence / Military / Engagement context relevant to the current deed, including coordinates, starting TC anchors, affected opponent candidates, building classification and coverage.

Two distinct outcomes

Neutral spatial fact

A verified placement or other source observation, even if unrelated to a social episode

Context on an existing deed

Source-linked territorial, economic or military circumstances enriching one incident

The implementation boundary should be narrow:

- Source selection and access remain in `getSocialEvidenceV1a.ts`, using its current Game, Event, mapping, revision, artifact and final-transaction fences.
- The existing worker/projectors retain detection, episode identity and source-local deduplication.
- Spatial facts are linked using the current source revision and exact source-event IDs or demonstrable source-local spatial/temporal association, not merely matching player IDs.
- A context annotation may attach to several legitimately relevant interpretations, but must not create duplicate independent deeds or credits.
- Where geographic attribution or operational proof is unavailable, the neutral placement remains valid while the proposed pair-specific social qualification remains pending.
- The bounded response must not begin shipping full huge statistics artifacts, unverifiable free-form interpretations or invented opportunity denominators.

No new stored social database or separate scoring pipeline is necessary.

### Candidate minimal context fields

An additive contextual reference needs only the existing deed/source identity, source-event references, actor, potential opponent, positional evidence, classification, and explicit availability states such as:

`territoryQualification`, `counterpartAttribution`, `buildingOperationCoverage`, `semanticMeaningfulness`.

For a forward Castle candidate, `buildingOperationCoverage` must remain pending until the approved completion/unique-queue chain is proven. For a gold cluster, the value must identify itself as estimated infrastructure influence, not ownership.

This would let future Personality consume broader player-level evidence, Reputation inspect independently meaningful player conduct, and directional Relationships inspect actor→counterpart evidence without coupling those downstream systems.

## 10. Concrete recommendations for AoF V1

Priority 1 — Preserve and expose already bounded facts

Keep military production, raid/engagement statistics, building placement, expansion zones, tower placement and gold-influence diagnostics available as clearly qualified statistics. Treat verified normal Battle history as valuable independently of social progression.

Priority 2 — Consolidate directed evidence around existing deeds

Continue using Pair Social Evidence V1, directional episode ledger and the three military families. Preserve one source deed with multiple facets; retain independent actor/recipient attribution, source event identity and pending substantive qualification.

Priority 3 — Resolve the geographic contract

Preserve Enemy Progress and the current statistics, but establish a clear friendly/neutral/enemy territorial admission predicate and per-opponent ambiguity handling before using forward buildings as social pressure evidence.

Priority 4 — Do not force missing substantive witnesses

Forward Castle operation, intentional opponent selection, actual rescue, combat consequences and gold possession should stay pending/unavailable when their sources do not prove them. Existing commands and geometry must not be promoted to fictional accomplishments.

Priority 5 — Evaluate Personality separately

Start from longitudinal, context-labelled player-level observations rather than reusing Relationship candidates as Personality points. Keep score weights, calibration and slider interpretation outside this audit.

### Focused technical acceptance needed before a V1 social signal is promoted

| Acceptance case                                             | Required observation                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Multiplayer forward placement near friendly and enemy homes | Enemy-territory status and affected-opponent ambiguity correctly separated    |
| Same building across Map Presence, Forward Eco and Military | One original placement, multiple non-awarding statistical views               |
| Genuine Castle vs Krepost/tower                             | Exact raw building type, no automatic special Castle substitution             |
| Unfinished or ambiguous Castle queue                        | Pending, not qualified                                                        |
| Targeted ORDER toward one of several enemies                | Target observation retained, no fabricated selective-focus significance       |
| Source-linked co-attack by two teammates                    | Distinct contributor evidence, no automatic reciprocal Bond                   |
| Active defender resistance                                  | Genuine defender action required, not passive victim status                   |
| Gold influence lead change                                  | No mine ownership or economic extraction claim                                |
| Replay source correction/rebinding                          | Spatial context invalidated/rebuilt under the current authority revision      |
| Canonical/native parity                                     | Same valid source-local facts and context semantics for equivalent recordings |

## 11. Genuine owner decisions still required

These are intentionally separate from engineering tasks that simply need better source proof.

| Decision                                       | What needs approval                                                                                                                                                                                | Suggested boundary until resolved                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| TERR-01 — Territorial ownership classification | Exact interpretation of friendly, neutral and enemy territory for team games, FFA and ambiguous overlapping home areas, reconciled with Enemy Progress                                             | Keep existing statistical labels; do not grant directed territorial social significance |
| TERR-02 — Forward Castle home pressure         | The precise closeness-to-affected-enemy-home requirement under the approved geometry                                                                                                               | Require geographic proof; do not invent a distance cutoff                               |
| MIL-01 — Selective opponent focus              | Whether preferential targeting should become a distinct V1 meaningfulness category and what independent opportunity/behavioral proof is required                                                   | Expose directed targeting observations only                                             |
| MIL-02 — Territorial/resource deed eligibility | Whether independently significant tower pressure, forward military/economic construction or contested-resource maneuvers may become new social deed types rather than context on existing episodes | Treat them as facts or context, not automatically additional claims                     |
| PER-01 — Personality admission/calibration     | Appropriate Game contexts, sample sufficiency, normalization, family interpretation and longitudinal stability for the five axes                                                                   | Maintain descriptive evidence without authoritative slider movement                     |

There is no need to reopen approved SOC/REL rules on independent substantive deeds, defensive counterplay, non-allied help, directional progression, reciprocity, Treachery or Chronicle highlights.

Likewise, discovering a unique Castle completion-and-queue witness is an engineering/source-qualification requirement, not permission to modify the already-approved five-minute condition.

## 12. Final audit disposition

| Domain                        | V1 conclusion                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Military statistical coverage | Strong reusable command-derived foundation                                                     |
| Directed pair evidence        | Reusable and correction-safe at V1a source-admission level                                     |
| Substantive meaningfulness    | Still pending independent executable proof                                                     |
| Team opponent singling-out    | Targeted attention observable; selective focus unproven                                        |
| Map Presence                  | Mature bounded spatial statistics; directed territorial semantics need reconciliation          |
| Forward towers and buildings  | Placements observable; enemy-territory and threat interpretation not fully qualified           |
| Forward Castle special case   | Not admission-ready; critical unique-instance operational witness missing                      |
| Gold Control                  | Valuable estimated spatial influence, not actual possession or extraction                      |
| Personality                   | Multiple suitable descriptive inputs exist; authoritative longitudinal calibration is separate |
| Reputation / Relationships    | Candidate evidence only; no automatic effects justified                                        |
| Chronicle                     | Verified factual history remains valid independently of social movement                        |

The best V1 development direction is to extend the trusted evidence context, not invent more detectors or start social scoring. The military side already has reusable episode provenance, directional observations and deduplication. The spatial side already has meaningful starting-TC geometry and resource/placement evidence.

The important work left is to reconcile that geometry with the approved territorial policy, preserve exact opponent attribution, and admit only independently established substantive conduct into future social interpretation.

This audit was read-only. No source files, commits, PRs, rollout flags, deployments or scoring rules were changed.