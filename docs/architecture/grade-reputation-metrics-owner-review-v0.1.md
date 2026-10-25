Age of Friends — Statistics-to-Social Interpretation Matrix

Source: Metric grading owner-review proposal v0.1
Repository checkpoint: "e453d40c147ad488f3bfd369e54eba82b29c43b5"

1. Six-track definitions

Reputation (player-wide)

- Gallantry: Meaningful daring offensive action in genuinely challenging entry circumstances.
- Cruelty: Meaningful directed punishing pressure against a demonstrably disadvantaged opponent, or separately qualified economic betrayal.
- Chivalry: Noteworthy directed protection or help.

Relationships (directional A→B)

- Rivalry: A's substantive competition or counterplay against B.
- Hostility: A's distinct antagonism toward B beyond routine warfare.
- Bond: A's meaningful help to B.

The three Reputation dimensions are independent rather than opposites. Rivalry, Hostility and Bond are independent directional tracks, not a single friendliness value.

2. Matrix notation

- Q: Candidate strengthening, only if the track's independently justified conduct, context, identity and materiality predicates qualify.
- c: Supporting context only. Cannot itself produce a track change.
- ·: Ordinarily no direct contribution.
- W: Candidate weakening, requiring a separately justified positive action and approved predicate.

A row containing Q does not mean AOF currently has sufficient evidence to award that effect.

3. Main metric-to-track table

Source metric or episode family| Gallantry| Cruelty| Chivalry| Rivalry| Hostility| Bond| Qualification context
Detected Raids Initiated / directed economic pressure| Q| Q| ·| Q| c| ·| Targeted, substantive, opponent-specific; challenge or prior vulnerability independently qualified.
Detected Battles / Skirmishes, pair-local contest| Q| Q| ·| Q| c| ·| Attribution and individual participation, not mere episode count.
Return raid / independent reverse pressure| Q| Q| ·| Q| c| ·| Reverse actor's own distinct action; chronology; no revenge motive.
Substantive defensive counterplay against an attacker| c| ·| ·| Q| c| ·| Defender actively resisted, repositioned or protected; passive victimhood is insufficient.
Direct opponent targeting in team Battle| Q| Q| ·| Q| c| ·| Selective attention requires comparison with actual alternative opponents/opportunities.
Forward Buildings and Forward Eco placements| c| c| ·| Q| c| ·| Specific opponent, geometry, genuine directed contest; no completion claimed.
Towers / Tower Rush with directed pressure| c| Q| ·| Q| c| ·| Punishing vulnerability needed for Cruelty; zoning alone is not Hostility.
Castle placement near opponent home| c| Q| ·| Q| c| ·| Generic contested placement only; special Forward Castle achievement remains separately proof-gated.
Gold Influence ≈ / contested gold-infrastructure positions| c| c| ·| Q| c| ·| Rival ownership/contest not inferred from percent alone; no mined gold/real capture.
Cooperative Attacks against exact common enemy| c| c| ·| Q| c| c| Each attacker's own target-specific action may count versus enemy; common target alone cannot create ally Bond.
Defensive Assists (specific helper→recipient)| ·| ·| Q| ·| c| Q| Intervention in independently threatened recipient's defense, materiality; not automatic rescue.
Reinforcements Sent (specific helper→recipient)| ·| ·| Q| ·| c| Q| Real source-linked protective participation rather than nearby move/co-presence.
Defensive support under third-party pressure| ·| ·| Q| ·| c| Q| Stronger context than generic assist; matching helper, threatened recipient, third-party source/time.
Tribute request donor→recipient| ·| ·| c| ·| c| c| Existing request is not an automatic award; separately qualify helpful conduct and significance.
Repair/guard requests targeting a beneficiary's property| ·| ·| c| ·| c| c| Need source-linked ownership, executed/credible material assistance and coverage.
Repeated independent pair contests across Battles| c| c| ·| Q| c| ·| Versioned history, actual attributed conduct, distinct Games; no duplicate POVs.
Repeated, unusually selective targeted harassment| c| Q| ·| Q| Q| ·| Cruelty requires earlier target disadvantage; Hostility requires distinct antagonism, not just focus fire.
Substantive hostile action after qualified effective alliance rupture| ·| Q| ·| c| Q| c| Ordered effective relationship plus distinct directed conduct; Bond weakening possible only if established prior Bond.
Material aid to former adversary with reconciliation context| ·| W| Q| c| W| Q| Hostility cooling is helper→recipient's own direction; Cruelty reparative weakening requires same prior victim.
Serious directed antagonism against established cooperator| ·| Q| ·| c| Q| W| Independently qualified prior Bond, significance and ordered breach/harm; not simply playing opposite teams.

Important: Some rows combine a Season label with richer Pair Context/History evidence. The Season aggregate must not be used as the qualification source: it lacks episode identity, counterpart, historical moment or independent witness. Per-Battle source-linked records are essential.

4. Statistics that normally do not create social progression

These metrics remain valuable for Personality, Records, Achievements, Chronicles and contextual interpretation.

Existing AOF statistic| Role in interpretation| Direct six-track award?
Build Order: Boom / Fast Castle / Fish Boom / Drush / Scout Rush / Archer Rush / Naval Rush| Opening identity and commitment context, never morality| No
Military Units Queued, Military Unit Commitment, Army Commitment @10/15/20| Requested military investment, not surviving army| No
Villager Queue Estimate @10/20, farms, economic buildings, TC placements, expansion zones| Economic request/placement context, not actual wealth or vulnerability| No
Walls Before Feudal / Wall Tiles / Wall Style| Defensive preparation, not proof of completed protection| No
Scout Command Coverage @5, Command Map Coverage, Opponent-Base Command Contact| Map intent and pressure context, not actual vision or courage| No
Raw APM, Commands @5, Economy Actions in Battles, Combat-window APM| Execution and multitasking descriptors| No
Market Sales/Purchases / decoded volumeTraded| Market transaction commands, not ally assistance| No
Trade Units Queued| Trade-unit queue requests, not completed income| No
Known Relics Targeted and First Relic Target Command| Objective targeting, not possession/theft| No
Boar Interactions ≈| Interaction inference, not confirmed opponent laming| No
Wonder BUILD placement candidate (new)| Objective intent, completion unknown| No
Battle results, Season points, victory/loss, opponent skill| Historical stakes and past-only challenge context, not conduct themselves| No

5. Additional metric families proposed for development

Candidate| Reuse AOF evidence| Potential social use| Priority and limitations
Pressure answered with counterplay| Raid V3, Pair Episode Context V1, raidResponse, defender actions| Defender→attacker Rivalry| P0. Independently active defender required. Timing alone insufficient.
Threat-linked directed assistance| Defensive Assists, Reinforcements, pressure-on-beneficiary, Context V2| Bond; Chivalry if noteworthy| P0. Exact helper, beneficiary, threat and source contribution.
Persistent opponent-specific pressure| Directed deeds across historical Games, prior directed episodes| Rivalry; rare Hostility/Cruelty| P0. Opportunity-aware attribution and independently meaningful context.
Material/beneficiary-directed tribute| Tribute commands, resource vectors, recipient| Bond; possibly Chivalry or Hostility cooling| P0 research. Request not verified receipt; bounded inference requires approval.
Quickwall response to raid| Wall commands and Raid V3| Defender Rivalry context / Chronicle| P1. Need timing/spatial relevance. Not confirmed sealed defense.
Garrison response to raid| Garrisons During Raids, Raid Response| Defender Rivalry context / Chronicle| Partly exists. Requires specific threat linkage; no saved-unit claim.
Targeted repair of ally's threatened asset| Repair commands, ownership, incoming pressure| Bond / Chivalry| P1. Target attribution and material effect uncertain.
Opposition to contested gold resources| Gold Influence, forward positions, directed pressure| Rivalry; Gallantry context| P1. Infrastructure influence is not extraction or actual ownership.
Opponent boar interference / laming| Boar Interactions and object/position history| Personality / Chronicle; contextual Cruelty| P2. Opponent entitlement and actual interference not established.
Monk conversions| Monk/class evidence, future conversion outcome| Records / Chronicle; contextual Rivalry| P2. Confirmed conversion and ownership-change witness required.
Trade-cart income / partner trade| Trade-unit queues and market evidence| Economy records; possible directed Bond| P2. Income and beneficiary not currently established.
Military–economic multitasking under pressure| Economy Actions in Battles, skirmish context, APM| Personality / Records; context only| Already partly exists. No direct social points.
Wonder attempt / defense of Wonder| Future Wonder placement + defensive episodes| Records / Chronicle; possible beneficiary-directed Bond| P2. Placement does not prove completed Wonder.
Relic theft / transfer / denial| Relic targeting observations and future control proof| Rivalry or Bond| P2/post-V1. Current possession, theft and transfer fields are unavailable.
Confirmed substantive king elimination / Treachery| Effective alliance, king loss, responsible actor, victim judgment| Exceptional Hostility escalation| Strict proof gate. Cannot infer from ordinary attacks.

These candidates do not constitute approved new statistics or automatic scoring inputs.

6. Independently qualified weakening rules

Weakening is not a negative score assigned for poor statistical performance. Each effect requires its own positively established conduct.

Track to weaken| Proposed qualifying action| False-positive guard / likely V1 status
Gallantry −| Credible actor-owned abandonment of a chosen challenging commitment while independently verified opportunity/capacity remains| Tactical retreat, loss, inactivity or a surrender command alone not enough; probably Pending until better witness.
Cruelty −| Meaningful directed material relief/restitution from actor to the same prior harmed counterpart after qualified Cruelty| Ordinary tribute request, helping someone else and simply ceasing attacks do not count; currently hard to qualify.
Chivalry −| Independently demonstrated knowing withdrawal of a specific prior protective undertaking while attributable recipient need, capacity and reachable opportunity remained| Failure to help, non-assistance, defeat and absence are not eligible; currently hard to qualify.
Rivalry −| Positive actor-owned settlement/de-escalation explicitly tied to that pair, with qualified context or structured judgment| Unplayed rematches, team changes, silence are not settlement; preserve stage-3 skill acknowledgment floor.
Hostility −| Substantive A→B reconciliation/aid toward A's former adversary, independently source-backed and tied to prior A→B Hostility| B→A assistance cannot automatically reduce A→B Hostility; generic shared enemy/ceasefire is inadequate.
Bond −| Serious independently qualified A→B directed antagonism against B, with established prior A→B support/Bond and historical significance| Routine competition or opposite sides in later Battles insufficient. A→B only; do not mirror B→A.

AOF Reputation may strengthen sooner than it can defensibly weaken. Unsupported weakening remains Pending rather than introducing artificial symmetry.

7. Grading after qualification

The proposed grading uses ordinal meanings, not predetermined numerical points.

Grade| Meaning
"+"| Admitted independently meaningful ordinary strengthening episode
"++"| Independently admitted substantial episode with greater qualified significance
"−"| Independent admitted weakening conduct
"−−"| Substantial independently admitted weakening conduct, if separately approved
"0"| Neutral observation or context with no conduct effect
"?"| Unknown, incomplete, unauthenticated, LIMITED, PENDING or UNCONFIGURED

A single episode can affect several tracks, but each track effect must qualify independently.

For example, a meaningful daring offense against an opponent can contribute to Gallantry and Rivalry if each predicate is independently met. A meaningful protective intervention may contribute to Chivalry and Bond on the same principle.

The same underlying deed must not produce multiple rewards merely because its evidence appears as a raid, battle, targeting episode and forward-building statistic.

The existing historical evaluator remains authoritative for numerical thresholds, caps, Event allowances, stage changes, independently verified reciprocity and corrections.

8. Interpretation constraints

1v1: Stronger direct opponent attribution. Ordinary combat, winning and raiding do not automatically create Hostility or Cruelty.

Locked-team Battles: Bond and Chivalry require beneficiary-specific contributions, not general team membership. Pair-specific Rivalry must not be copied across all opponents.

FFA Diplomacy: Aid can count without formal alliance, but effective alignment, ordered history and actor attribution are essential for meaningful rupture or reconciliation interpretations.

Multi-Game Battles: Preserve Game-level identity, original source revisions, authoritative Battle chronology and Event budgets.

Special Forward Castle: A Castle placement near a specific opponent's home remains distinct from the strict exceptional accomplishment. The accepted special proximity condition is an unrounded distance strictly below 15 tiles from that opponent's starting TC, but completed operational Castle, unique instance, own queue and complete source proof remain independently required.

Strict Treachery: Requires the established binding prerequisites, including confirmed king-loss responsibility and the victim's qualifying explicit judgment. Inferred ordinary Hostility cannot bypass these requirements.

Statistical comparability: Compare similar formats, phases, coverage and historical conditions. Raw APM, military queues, economy commitment and forward presence must not be treated as confirmed outcomes, motives or proof of a player's character.

9. Approval status and handoff boundary

This matrix is a candidate semantic catalogue, not an implemented or accepted calibration.

The owner still needs to decide:

1. Whether the proposed Gallantry/Chivalry distinction is satisfactory.
2. Whether the proposed ordinary Cruelty and Hostility pathways are acceptable.
3. Whether bounded inference from tribute requests may ever establish meaningful help without verified receipt.
4. Which independent weakening predicates should be approved or held Pending.
5. Which P0/P1 metrics should receive implementation priority.

No numerical weights, automatic receipts, public scoring, exceptional awards, entitlement grants or deployment are authorized by this proposal.

Implementation should reuse existing Recorded Events V1, Pair Social Evidence, Context V2, versioned qualification and the authoritative historical evaluator rather than constructing a separate statistics-driven progression engine.
