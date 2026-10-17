> **Research archive (17 October 2026).** This is the worker's original read-only investigation, preserved for traceability. It is not an approved scoring rule, implemented capability, deployment report, or activation decision. See [the integrated V1 launch roadmap](../project/SOCIAL-V1-LAUNCH-ROADMAP-2026-10-17.md) for current conclusions and precedence.

# Age of Friends V1 — Reputation and Relationship Progression Contract

Main verified

Repository: `Mathias-ao/League-of-Friends` Verified main HEAD: `25f120412df5ed0118b9557cdf822ab175108242` Review mode: Read-only; no changes or activation.

## 1. Architectural recommendation

Build one source-backed social episode ledger, with six independent qualification and progression consumers.

The central distinction should be:

| Layer                      | What it establishes                                                                   | May award progression?           |
| -------------------------- | ------------------------------------------------------------------------------------- | -------------------------------- |
| Recorded observations      | Commands, positions, event chronology, participants, detector outputs                 | No                               |
| Inferred social context    | Possible pressure, contest, targeting, cooperation, assistance and recurring patterns | No                               |
| Qualified social conduct   | Independently demonstrated substantive actions with track-specific context            | Eligible                         |
| Historical progression     | Versioned awards, Event allowances, reciprocity and stage transitions                 | Yes                              |
| Chronicle and presentation | Factual history, verified standing and carefully labelled interpretations             | No independent scoring authority |

This preserves rich player histories without representing imperfect inference as earned standing.

The key V1 decision is to make qualification modular by conduct family. A verified duel, a substantive defensive stand, directed help and a targeted betrayal do not need the same evidence or the same progression rules. One family can become operational while others remain unavailable, provided that each of the six tracks ultimately has a genuine launch pathway.

The currently merged V1a seam is well suited to this separation: it already returns authenticated Game-local evidence and pending claims, rather than directly changing player standing. The existing three-family military preview is likewise a source grouping, not an authorized progression engine.

## 2. Evidence-to-track matrix

This matrix distinguishes potentially useful signals from independently qualified progression. A signal's appearance does not automatically produce the indicated effect.

Legend: Q = possible qualification pathway; C = supporting context only; — = no ordinary direct contribution.

| Gameplay signal                                 | Gallantry | Cruelty | Chivalry | Rivalry | Hostility | Bond  |
| ----------------------------------------------- | --------- | ------- | -------- | ------- | --------- | ----- |
| Directed pressure and raids                     | Q         | Q       | —        | Q       | C         | —     |
| Pair-specific battles and skirmishes            | Q         | Q       | —        | Q       | C         | —     |
| Substantive defensive resistance                | C         | —       | C        | Q       | C         | —     |
| Forward military buildings                      | C         | C       | —        | Q       | C         | —     |
| Forward towers                                  | C         | Q       | —        | Q       | C         | —     |
| Forward castles                                 | C         | Q       | —        | Q       | C         | —     |
| Opponent targeting in team Battles              | Q         | Q       | —        | Q       | C         | —     |
| Co-attacks against a common opponent            | C         | C       | —        | Q       | C         | C     |
| Directed defensive assistance                   | —         | —       | Q        | C       | Q\*       | Q     |
| Gold and resource competition                   | Q         | C       | —        | Q       | C         | —     |
| Material assistance or tribute                  | —         | —       | Q        | C       | Q\*       | Q     |
| Repeated independent encounters                 | C         | C       | C        | Q       | Q\*       | Q     |
| Alliance rupture and subsequent hostile conduct | —         | Q       | —        | C       | Q         | Q\*\* |
| Qualified Battle results                        | C         | C       | C        | C       | —         | C     |

\* Hostility requires an independently qualified context: distinct antagonism for strengthening or meaningful help for directional cooling. Repetition or competition alone cannot establish it.

\*\* Serious antagonism can weaken established Bond, but a declaration withdrawal without independently qualifying conduct is insufficient.

### Interpretation of the less obvious signals

Forward towers and castles. A forward military structure can corroborate directed pressure and pair-specific competition, but placement alone is not substantive executed antagonism. The existing Forward Castle design specifies opponent-specific home pressure, a uniquely attributable operational Castle and subsequent attributable queue evidence. That special qualification is not yet generally executable. A completed Castle cannot be assumed from a BUILD command.

Gold control and resource competition. Successfully contesting a resource can provide meaningful Rivalry context when the particular players and their substantive participation are identified. Aggregate gold income, mining time or map ownership cannot prove that A specifically competed with B. A verified resource-denial episode is stronger evidence than merely occupying neighboring gold deposits.

Co-attacks. Two players attacking the same opponent can establish separate competitive actions. It does not, by itself, establish one helping the other. To qualify Bond, a separate recipient-specific benefit or independently substantive cooperative act must be demonstrated.

Defensive resistance. This is especially important for Rivalry. A defender who makes an independently verified substantive stand can contribute defender→attacker Rivalry without counterattacking. Merely taking damage, surviving or issuing reactive MOVE commands is insufficient.

Cross-Battle patterns. Repetition establishes persistence only after its constituent episodes qualify. Ten uncertain raids must not become one certain act through accumulation.

These restrictions follow the [approved Relationship baseline](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/docs/architecture/relationship-v1-approved-baseline-2026-10-13.md?utm_source=chatgpt.com), especially REL-V1-EVID-01–06 and REL-V1-CAL-05–14.

## 3. Smallest viable qualification pathway for every track

Each track needs at least one demonstrably functional positive pathway at launch. The following six primary families are my recommended minimum, with additional pathways where they improve coverage without weakening the evidence standard.

### 3.1 Rivalry — substantive personal competition

Core meaning: A and B have directly competed in a meaningful way, rather than merely appearing on opposing teams.

Primary family: QUALIFIED_PAIR_CONTEST

Proposed

A → B Rivalry strengthening

A participates in substantive, independently evidenced competition against B. This may be an offensive contest or defensive counterplay.

Minimum proof: mapped eligible opponents, actor-specific executed competitive conduct, exact counterpart attribution, meaningful independent episode and valid source chronology.

Possible corroboration: raid/clash evidence, attributed military exchanges, defensive resistance, resource denial, contested military objectives and result context.

A duel is the simplest environment because pair attribution is less ambiguous. However, simply completing a 1v1, winning it, losing units or appearing in a command-overlap detector cannot award Rivalry.

Where a real exchange is proven, both directions may qualify independently. A losing defender who substantively resisted can receive a meaningful Rivalry contribution without achieving any kill or launching an attack.

For team games, only attributed A-versus-B conduct counts; teammate activity cannot be copied.

Launch acceptance: At least one authenticated real duel or controlled replay must show independently executed pair-specific competition, with a negative control where ordinary co-presence or passive defense earns nothing.

### 3.2 Hostility — distinct directed antagonism

Core meaning: A's directed relationship toward B has developed demonstrable antagonism beyond normal competition.

Primary family: QUALIFIED_DISTINCT_ANTAGONISM

Proposed

A → B Hostility strengthening

An identifiable episode contains substantive, directed antagonistic conduct whose significance is distinguished from ordinary permissible warfare by independently qualified context.

Narrow launch route: qualified mutually effective truce or alliance, attributable initiating rupture, then independently substantiated hostile conduct against the former ally, with associated incident chronology and an applicable configured ordinary-antagonism rule.

This provides a path without requiring a king elimination.

The distinction matters:

- A verified battle between scheduled opponents establishes competition, not Hostility.
- A declaration withdrawal alone establishes declared history, not executed antagonism.
- A verified truce rupture followed by substantive directed offense can qualify an ordinary Hostility episode under a separately configured significance rule.
- The strict king-loss Treachery exception remains a different, higher-consequence pathway.

A secondary family, RECURRING_DISTINCT_ANTAGONISM, could recognize independently proven, unusually focused campaigns across Battles. But raw concentration of attacks cannot suffice: a strategic focus-fire campaign is often ordinary gameplay. This route needs calibrated distinguishing context and a specific false-positive review.

Launch acceptance: Demonstrate an ordinary, non-king-loss positive that is not simply normal warfare, plus ordinary combat, defensive response and command-only rupture negatives.

### 3.3 Bond — meaningful directed help

Core meaning: A has substantively helped B.

Primary family: QUALIFIED_DIRECTED_MATERIAL_HELP

Proposed

A → B Bond strengthening

A independently performs materially meaningful help with B as an attributable beneficiary. Formal alliance is not required.

Minimum proof: executed assistance or sufficiently substantiated material conduct, actual helper and beneficiary, appropriate materiality and an independent episode.

Possible routes: verified resource transfer, verified defensive intervention, material repair/protection or another independently attributed assistance operation.

For V1, an authentic material transfer may be the cleanest first qualification route if the recording worker can prove transfer semantics, amounts and beneficiaries.

Defensive assistance is a valuable second route. The helper must actually contribute to B's defense, not merely send nearby movement commands.

A support event can remain substantive when unsuccessful, but intent to help is not itself executed help.

Launch acceptance: Demonstrate a qualified unilateral A→B contribution, including a scenario without formal alliance. B→A must remain unchanged unless B independently helps A.

### 3.4 Gallantry — courageous offensive undertaking

Core meaning: A undertakes meaningful offensive competition against a comparably strong or stronger opponent in verified challenging circumstances.

Primary family: QUALIFIED_DARING_OFFENSE

Proposed

Player-owned Gallantry strengthening

A undertakes substantive offensive action against an attributable opponent, with independently qualified competitive circumstances at episode entry.

Minimum proof: executed offensive conduct, opponent attribution, contemporaneous opponent-strength context and a calibrated significance criterion.

Two distinct types of context could eventually support this:

1. Direct material challenge: independently reconstructed opposing forces or defensive strength at the incident's start.
2. Pre-existing competitive challenge: authenticated historical skill/rating evidence, if an explicit rule defines when it meaningfully qualifies a difficult offensive undertaking.

Neither a later victory nor the opponent's reputation can retroactively establish the entry circumstances. Rating and material disadvantage must not be treated as interchangeable.

Gallantry should not require successful destruction. A genuine, substantial failed assault against a superior opponent could qualify.

Launch acceptance: A positive with reproducible pre-episode context, an unsuccessful-but-substantive positive and a weak/no-op attack negative.

### 3.5 Cruelty — qualified punishing conduct

Core meaning: A engages in substantively punishing behavior against a demonstrably disadvantaged or vulnerable opponent, or a separately qualified economic betrayal.

Primary family: QUALIFIED_PUNISHING_ADVANTAGE

Proposed

Player-owned Cruelty strengthening

A conducts independently substantiated targeted pressure against B while an independently established significant disadvantage already exists for B.

Minimum proof: substantive directed offensive conduct, target attribution, pre-episode disadvantage and context-specific materiality.

A useful alternate launch pathway is QUALIFIED_ECONOMIC_BETRAYAL, based on the narrower previously proposed family: real prior cooperative context, qualified initiation of a breach and substantive offensive action against an attributable economically vulnerable target.

This cannot inherit Cruelty merely from an Ally withdrawal, nor from an attack on a mixed economic/defensive structure whose permitted target classification is unknown.

The distinction between these two families is valuable. Cruelty must not become synonymous with high military performance, villager kills or winning against weaker friends.

Launch acceptance: An authenticated punishing-disadvantage episode or independently qualifying economic betrayal, with entry-context, target-class and substantive-execution proof. A normal raid against an equal opponent must remain negative.

### 3.6 Chivalry — noteworthy protection or assistance

Core meaning: A provides materially meaningful protection or aid deserving an independently earned Reputation contribution.

Primary family: QUALIFIED_NOTEWORTHY_ASSISTANCE

Proposed

Player-owned Chivalry strengthening

A substantively helps or protects an attributable beneficiary under context establishing why the assistance is noteworthy.

Minimum proof: actual directed material assistance/protection, recipient attribution, verified need/threat or other independently configured noteworthy circumstances, and qualifying significance.

Chivalry has a higher interpretive requirement than Bond. Every substantive directed help episode may be considered for Bond, but not every qualified Bond episode deserves Chivalry.

For example, an ordinary resource transfer may be Bond. A meaningful intervention to defend a threatened teammate may independently qualify Chivalry.

One incident can award both, but each effect requires its own predicate. Chivalry points never increase Bond numerically.

Launch acceptance: A protected/assisted-beneficiary positive and an ordinary, non-noteworthy cooperation negative, with no automatic recognition of every teammate.

### The six-path launch contract

| Track     | Smallest credible official progression route         | Main dependency                                      |
| --------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Rivalry   | Executed pair-specific contest or resistance         | Pair-specific substantive competition proof          |
| Hostility | Substantive antagonism following a qualified rupture | Effective relation, execution and significance       |
| Bond      | Materially directed help                             | Verified recipient and substantive assistance        |
| Gallantry | Meaningful daring offense                            | Executed offense and qualified entry strength        |
| Cruelty   | Punishing-advantage offense or economic betrayal     | Executed offense and contextual vulnerability/breach |
| Chivalry  | Noteworthy material protection or help               | Materiality, beneficiary and protective context      |

These are feasible qualification contracts, not claims that current retained evidence already passes them.

## 4. Versioned progression and historical evaluator

Do not retrofit these rules into the existing `relationshipEngine.ts` V2 pulse model or feed automatically generated units into the old `reputationEngine.ts`.

The existing Reputation engine applies `maximumUnitsPerBattle` to each deed separately. It does not supply the required aggregate player/Battle track budget. The existing Relationship V2 projection is not the approved directional historical evaluator.

The successor should preserve their compatibility boundaries without importing their unapproved scoring behavior.

### Proposed version contracts

| Component                | Proposed identifier                     | Responsibility                                                        |
| ------------------------ | --------------------------------------- | --------------------------------------------------------------------- |
| Qualified social conduct | `AOF_SOCIAL_CONDUCT_QUALIFIER_V1`       | Convert verified facts into independently qualified behavioral claims |
| Reputation rules         | `AOF_SOCIAL_REPUTATION_RULES_V1`        | Player-owned qualifying effects and bounded progression               |
| Relationship rules       | `AOF_DIRECTIONAL_RELATIONSHIP_RULES_V1` | Direction-specific strengthening, weakening and reciprocity           |
| Historical evaluator     | `AOF_SOCIAL_HISTORICAL_EVALUATOR_V1`    | Event allocation, chronology, stages, peaks, corrections              |
| Inferred social profile  | `AOF_SOCIAL_INFERENCE_PROFILE_V1`       | Separate, non-awarding descriptive tendencies                         |

Identifiers are recommendations; none is currently approved production configuration.

### Claim and receipt separation

Each qualified source episode should support independent claims containing the following:

| Field                   | Contract                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| `sourceDeedLineage`     | Durable neutral incident identity with revision-aware anchors                |
| `sourceRevision`        | Exact active statistics/recording source                                     |
| `leagueContext`         | Season, Event, Battle, Game, roster identity and eligibility                 |
| `conductFamily`         | Specific verified behavioral family                                          |
| `sourceWitnesses`       | Exact event IDs and qualification evidence                                   |
| `actionDirection`       | Who acted on whom                                                            |
| `contributionDirection` | Whose directional track is affected                                          |
| `system` and `track`    | Reputation or Relationship and one of its three tracks                       |
| `polarity`              | Strengthening or weakening where applicable                                  |
| `qualification`         | Independently supported, not qualified, pending, unavailable or unconfigured |
| `contextAtStart`        | Qualified circumstances before the episode                                   |
| `consequenceEvidence`   | Separately established consequences, if available                            |
| `qualifierVersion`      | Reproducible semantic proof rules                                            |

Only a qualified claim can be offered to the applicable progression rule. Only a configured and allocated progression effect becomes a credit receipt.

Keep a qualifying deed even when its progression is capped. Keep a candidate even when its qualification is pending. Neither is the same thing as earned credit.

### Approved historical evaluation sequence

1\. Authenticated source selection

Active READY evidence, mapped people, eligible Event Battles, result/source revisions

2\. Conduct qualification

Independent family-specific proof, directions, context, episode identity

3\. Event allocation and reciprocity

Separate strengthening/weakening allowances, Treachery priority, earliest historical credit anchors

4\. Chronological state transitions

Counterbalance unfinished progress, check thresholds, stage-specific reciprocity, exceptions and peaks

5\. Publish coherent revision

Verified current direction, historical peak, pending dependencies, audited receipts, factual Chronicle

This sequence follows SOC-002–011, SOC-012–029 and SOC-042–057 in the [approved decision register](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/docs/architecture/social-relationship-decisions-001-057.md?utm_source=chatgpt.com).

### Ordinary stage behavior

For Relationships:

| Level  | Meaning                      | Requirement                                                                             |
| ------ | ---------------------------- | --------------------------------------------------------------------------------------- |
| 0      | Not established              | No sufficient credited progression                                                      |
| 1      | Emerging                     | Qualified progression meets first configured boundary                                   |
| 2      | Developing                   | Qualified progression meets second configured boundary                                  |
| 3      | Established                  | Progression meets third boundary and stage-specific independently qualified reciprocity |
| Higher | Stronger established history | Progressively harder, independently configured boundaries and reciprocity               |

No arbitrary minimum number of Battles or Events should be introduced.

An exceptional ordinary episode may cross early levels if its configured contribution genuinely satisfies multiple thresholds. Level 3+ still needs reciprocal qualification.

Reputation should instead have its own player-owned earned history and progression configuration; no Relationship reciprocity gates apply to Reputation.

### Weakening and exceptional effects

Retain the common opposing-progress framework. Strengthening offsets unfinished weakening first; weakening offsets unfinished strengthening first. Completed stage changes do not disappear merely through later arithmetic. Preserve eligible surplus, historical peaks and separately qualified corrections.

Rivalry's protected level-3 floor requires independently qualified explicit skill-superiority acknowledgement before ordinary regression below 3 can occur. Acknowledgement alone is not regression.

Hostility can cool through substantive help in the helper's own direction. Bond weakens through meaningful directed antagonism, not mere absence of cooperation. Rivalry weakens only under its own qualified de-escalation predicate.

Exceptional Treachery must not inherit the old shadow implementation's simple cap bypass. It requires all objective prerequisites and the victim's binding explicit “betrayed” confirmation. It produces the approved victim→responsible-actor stage jump and a separate Event-bounded ordinary strengthening-capacity consumption claim with Treachery allocation priority. It creates no generic Cruelty, mutual Hostility or ordinary fictional points.

## 5. Calibration decisions for owner approval

The existing shadow values—one unit, one track/Battle budget, 1/2/3-Battle stage assumptions and maximum stage four—are illustrative. They must not be adopted as accepted production thresholds.

I recommend calibrating qualification significance first, contribution magnitudes second, stage thresholds last.

| Decision                       | Recommended V1 direction                                                                             | Status                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------ |
| Minimum substantive contest    | Demonstrated pair-specific executed competition; exclude command-only overlap                        | Qualifier design               |
| Significance tiers             | Bounded ordinary, substantial and exceptional effects based on verified context                      | Magnitudes unapproved          |
| Rivalry reciprocity            | Independent resistance/participation counts; victim impact does not                                  | Approved qualitative rule      |
| Rivalry significance           | Meaningful exchange and counterplay generally outrank one-sided domination                           | Approved qualitative direction |
| Hostility baseline             | Ordinary warfare awards zero                                                                         | Approved                       |
| Hostility strengthening        | Distinct antagonistic conduct with independently qualified distinguishing context                    | Family calibration needed      |
| Bond base                      | Verified substantive directed material assistance                                                    | Family calibration needed      |
| Chivalry base                  | Qualified noteworthy protection/help, not generic allied activity                                    | Family calibration needed      |
| Gallantry strength context     | Contemporaneous opponent challenge under a validated comparison method                               | Measurement/calibration needed |
| Cruelty disadvantage context   | Sustained independently established pre-entry disadvantage or separately qualified economic betrayal | Measurement/calibration needed |
| Reputation saturation          | Shared player × track × Battle budget across overlapping families                                    | Magnitude unapproved           |
| Relationship Event cap         | Event × unordered pair × track × direction, separate strengthening and weakening                     | Magnitudes unapproved          |
| Level boundaries               | Increasing, track-specific upward and downward thresholds                                            | Unapproved numbers             |
| Level 3+ reciprocity           | Independently configured minimum historical credits in both directions, for each stage               | Minimums unapproved            |
| Treachery capacity consumption | Ordinary Hostility progression-unit claim, independently capped                                      | Amount unapproved              |

For calibration, use a labelled corpus of independently reviewed positive, negative and unavailable examples. Compare distributions across real 1v1, teams, FFA and repeat encounters, then propose explicit quantities with sensitivity results.

Do not choose thresholds merely to make all six bars move at a desired frequency. The positivity of the qualification predicate must survive before magnitude calibration begins.

## 6. Authentic player perceptions and inferred social profiles

There are two useful sources of social meaning that must not be confused with official executed conduct.

### Authentic Chronicle judgments

Preserve the approved exceptional interaction rules rather than introducing routine questionnaires.

A victim's explicit Treachery response is binding for that exception. An attributable acknowledgement of another player's superior skill may open the Rivalry regression gate. Other structured Relationship judgments can contribute only under their approved track-specific rules.

For Chronicle-derived reciprocity, SOC-076–079 require explicit track-relevant meaning and independently qualifying conduct from the responding player in the same linked Battle. A later comment about an old Battle, generic praise or a copied victim experience cannot substitute for this requirement.

Keep submitted judgments auditable, attributable, correction-controlled and subject to the previously approved qualification and visibility states. Late qualification acts at the linked incident's historical position without falsifying the real submission time.

### Separate inferred social profile

I recommend an explicitly non-awarding surface alongside official Relationship standings.

Example: A's history with B

Illustrative UI

Inferred interaction profile — not official earned standing

Directed pressure

Observed candidates

Competitive exchanges

Source-supported

Possible assistance

Unconfirmed

Coverage

Partial

Official directional Relationships

A → B Rivalry

Pending qualification

B → A Rivalry

Pending qualification

Example labels only. No inferred signal unlocks official stages, reciprocal credit, achievements or War Room actions.

The inferred profile can use longitudinal measures such as recurring attributed pressure, contest participation, target concentration, defensive responses, assistance candidates and territorial competition.

But it must label the observation domain honestly. For example, “recorded command focus on B” is acceptable when provenance supports it; “A consistently hunts B” overstates intent.

Do not publish numeric confidence percentages without calibrated validation. Prefer source-supported, inferred, incomplete and unavailable classifications.

This is the best place for interesting lower-confidence interpersonal stories while the official progression system remains evidence-strict.

## 7. Direction, reciprocity, deduplication and correction

### Directional accounting

A directional contribution always specifies who contributes and whose directional relationship is affected.

| Situation                                                  | Permitted effect                     | Forbidden inference                            |
| ---------------------------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| A substantively attacks B                                  | A→B Rivalry if qualified             | Automatic B→A Rivalry or Hostility             |
| B substantively resists A                                  | B→A Rivalry                          | Requiring B to counterattack                   |
| A substantively assists B                                  | A→B Bond                             | Automatic B→A Bond                             |
| A helps B despite prior A→B Hostility                      | Possible A→B Hostility cooling       | Automatic B→A cooling                          |
| A harms B under a separately approved victim-impact policy | Possible B→A Hostility contribution  | B→A aggressive action or reciprocal antagonism |
| A commits qualified Treachery against B                    | Exceptional B→A Hostility escalation | Mutual Feud or automatic Cruelty               |

An incident can create independent claims in several tracks only if each predicate is satisfied. It cannot convert a Reputation total into a Relationship total.

### Reciprocity

Each direction needs genuinely independent support. Valid historical reciprocity credits are limited to one per Event × unordered pair × track × direction, anchored at the earliest reliably ordered qualifying deed.

Credits remain independent of ordinary progression allocation: a qualifying deed may establish a historical reciprocity credit even if its ordinary effect is capped. Such credit adds no units and cannot manufacture the opposite direction.

Credits may be established in different Events. A newly arrived legitimate opposite-direction credit can unlock an already otherwise satisfied stage gate at that later moment, never by inventing an earlier unlock.

### De-duplication

Use two distinct identities:

- Durable source incident lineage: associates corrected versions of the same underlying episode.
- Versioned claim/credit identity: identifies the interpretation under exact evidence, policy, context and result revisions.

Within a Battle, merge overlapping raid, skirmish, attack and pressure facets when they describe one continuous deed. Distinct real episodes may qualify separately, but Event allowances bound earned progression.

For Reputation, apply a shared player × track × Battle contribution budget across families. For Relationships, apply the approved directional Event budgets. Multi-POV recordings with the same Game GUID are one Game. A multi-Game Battle must not automatically become multiple independent social opportunities.

Repetition in later legitimate Battles remains eligible; do not automatically halve rewards for repeatedly facing the same person.

### Corrections and partial chronology

Replacing a source, correcting identity, changing official results or revising policy must supersede the affected claims, not append a second set.

Rebuild dependent historical states chronologically, including Event allowance allocation, reciprocity anchors, intermediate transitions, peaks and pending dependencies. Publish one coherent active revision with a reproducible before/after decision difference.

Qualified source facts may remain visible while order-dependent progression is pending. A last verified historical stage must be labelled historical, not presented as a verified current stage. New stage-gated actions remain suspended where verification is pending.

Existing approved downstream War Room correction safeguards must remain intact; a social redesign must not bypass them.

## 8. Representative E2E acceptance suite

These are proposed tests, not tests executed during this review. Authentic positives must establish their expected semantics independently; controlled fixtures should also exercise no-op, correction and ambiguity boundaries.

| Case | Fixture / situation                                                                               | Expected result                                                                        |
| ---- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| R1   | Authentic 1v1 with independently substantiated pair-specific fighting                             | A→B Rivalry if A's conduct qualifies; B→A only if B's own conduct qualifies            |
| R2   | Defender substantively resists a superior attack without counterattacking                         | Defender→attacker Rivalry may qualify; no automatic Hostility                          |
| R3   | Team Battle with shared outcome but no demonstrated A-versus-B conduct                            | No pair-specific Rivalry                                                               |
| H1   | Ordinary raids and victories between scheduled enemies                                            | No Hostility                                                                           |
| H2   | Qualified effective truce rupture followed by substantive targeted hostility, no king elimination | Ordinary Hostility only if the independently configured antagonism predicate qualifies |
| H3   | Command-only rupture or contested initiation with uncertain offense                               | Candidate facts retained, no unsupported effect                                        |
| B1   | Verified meaningful A→B material aid in FFA                                                       | A→B Bond; no B→A Bond                                                                  |
| B2   | Defensive participation near a teammate without proof of substantive directed assistance          | Bond pending, not qualified                                                            |
| G1   | Executed substantive offense with verified stronger-opponent context at entry                     | Gallantry(A) may qualify even if unsuccessful                                          |
| G2   | Same commands but entry-strength proof missing                                                    | Gallantry pending                                                                      |
| C1   | Substantive offense against independently established disadvantaged target                        | Cruelty(A) if magnitude/context qualify                                                |
| C2   | Ordinary aggressive attack with no disadvantage or betrayal context                               | No Cruelty                                                                             |
| CH1  | Materially significant directed protective intervention                                           | Chivalry(A), and Bond independently if its predicate qualifies                         |
| CH2  | Ordinary team participation or trivial help                                                       | No automatic Chivalry                                                                  |
| F1   | Forward Castle placed, but completed-instance/queue link unknown                                  | Positional candidate; special Castle qualification pending                             |
| T1   | Qualified rupture, king-loss responsibility, victim confirms “betrayed”                           | Directed exceptional Hostility stage effect and capacity accounting                    |
| T2   | Identical objective Treachery evidence, victim answers “fair game” or leaves prompt unanswered    | No exceptional effect; applicable ordinary evidence unaffected                         |
| D1   | Two independently qualified episodes in one Battle                                                | Preserve both deeds; allocate under one Event budget                                   |
| D2   | Corrected Game source, duplicate POV, retry or mapping change                                     | No duplicate earned effects; deterministic replacement                                 |
| D3   | B helps A later after prior antagonism                                                            | Evaluate B→A Hostility cooling, separately Bond; no received-help reversal             |
| D4   | Valid non-scoring helper warmup                                                                   | Qualifying social evidence counts despite no additional League Points                  |
| D5   | Missing Game/Battle order                                                                         | Preserve local facts, defer only order-dependent awards and downstream states          |

Further boundary cases must include attack versus conversion, target ownership changes, rejected/no-op commands, automatic attack behavior, resource transfer fees and recycling, active-vs-abandoned structures, attribution ambiguity, source truncation, effective diplomacy transitions, partial coverage and same-millisecond ordinal order.

Launch pass criterion: at least one authentic or appropriately controlled, independently verified substantive positive for each of the six tracks; required meaningful negatives must not produce false awards. Holdout real recordings and materiality/threshold boundary tests must also pass. A scripted intended action is not itself proof of execution.

## 9. Optional broader statistical-inference policy

Requires explicit owner approval

A broader inference policy could improve V1 coverage, especially for Rivalry, if execution proof cannot be recovered for every candidate. This would be a change to the established qualification standard, not an implementation detail.

Proposed change: AOF-SOC-PROPOSAL — Bounded aggregate-substance qualification

Under narrowly enumerated families, independently verified aggregate statistics could substitute for direct event-level execution witnessing only when a reviewed combination of measurements proves a substantive pair-specific interaction to the accepted policy standard.

For example, a genuinely authenticated two-human 1v1 could potentially support competitive participation through a validated combination of pair attribution, reliable material combat measurements and official context, even where precise damage-event lineage is incomplete.

It must not convert aggregate score or casualties into specific attacks, directed assistance, personal motives, economic betrayal or other facts they cannot identify.

| Benefit                                              | False-positive risk                                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Better coverage of ordinary duel competition         | Aggregate damage/losses may not identify the responsible actor                                                    |
| Reduced dependence on fine-grained event attribution | Environmental losses, conversions, automatic combat or incomplete statistics may be mistaken for directed conduct |
| Earlier longitudinal Rivalry history                 | Broad Battle engagement might be falsely promoted to pair-specific competition                                    |
| More usable inferential context                      | Weak statistical correlations can become unwarranted moral or interpersonal judgments                             |

I would not extend this general substitution to Hostility, Bond, Cruelty or Chivalry. Their core meaning depends on attribution, recipient, circumstances and conduct that aggregate military statistics usually cannot prove.

If adopted, it needs a family-specific policy version, stronger negative controls, a documented equivalence standard and independent owner approval. Without that approval, inferred statistical patterns remain in the non-awarding social profile.

## 10. Concrete V1 implementation sequence

1. Freeze the social interpretation contract. Register six primary qualification families, the proposed schema, direction semantics and all still-open calibration parameters. Explicitly separate accepted policy from proposed values.
2. Integrate the other workers' proof outputs. Consume authenticated execution/interaction witnesses and statistics geography as versioned inputs. Do not build a competing parser, spatial model or execution detector.
3. Build a pure, independently testable conduct qualifier. One source-deed ledger, six track consumers, precise reasons for qualification failure and no scoring side effects.
4. Calibrate and approve the smallest positive pathways. Use real recordings and controlled positives/negatives, then propose magnitudes, Event budgets, stage boundaries, reciprocity requirements and materiality gates.
5. Implement the successor historical evaluator. Shared structural mechanics; separate player Reputation and directional Relationship accounting; Event allocation, weakening, reciprocity, exceptional Treachery and deterministic correction.
6. Add the separate inferred social profile. Source-backed candidate trends can be presented without granting standing. Official Chronicle highlights come only from authenticated credited effects or qualified league-visible judgments under existing rules.
7. Run the complete acceptance matrix and release review. Verify all six authentic progression pathways, cross-Event behavior, source revisions, privacy, historical corrections, stage-gated dependencies and rollback. Activation remains a separate authorization.

### Remaining blockers and owners

| Blocker                                                             | Dependency                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| Executed pair-specific offensive and defensive conduct              | Recording execution-proof worker                        |
| Verified entry-state strength/disadvantage                          | Execution-proof and statistics-context outputs          |
| Reliable forward-tower/castle opponent-specific meaning             | Statistics geography plus independent execution witness |
| Material assistance/transfer and recipient qualification            | Recording execution proof                               |
| Effective dynamic diplomacy and offensive aftermath                 | Recording execution proof                               |
| Six track-specific qualification predicates                         | This social workstream                                  |
| Numeric caps, thresholds, weights, materiality and stages           | Owner approval after calibration                        |
| Directional historical evaluator and coherent correction publishing | Successor social implementation                         |
| Authentic E2E positives for all six tracks                          | Integrated acceptance                                   |

### Review conclusion

The repo's current authenticated V1a evidence foundation, the three-family prototype and the existing shadow evaluator are useful foundations, but they are not yet an authorized six-track progression system. The [V1a acceptance report](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/docs/testing/benchmarks/social-evidence-v1a/acceptance.json?utm_source=chatgpt.com) explicitly records `substantiveEvaluatorComplete: false` and `qualifiedSocialProgression: false`. I did not locate the detailed empirical V1b report on the verified main branch or in the available uploaded files; its supplied finding about command-derived candidates has therefore been treated as a binding constraint, not independently revalidated in this review.

My recommendation is to retain all six tracks as V1 launch requirements, but qualify and release their mechanisms independently. Rivalry and Bond are the strongest candidates for the earliest substantive implementations; Chivalry can reuse genuinely qualified assistance, with a stricter noteworthy-context gate. Gallantry, Cruelty and ordinary Hostility need targeted semantic proof and calibration rather than automatic scoring based on aggression.

This gives Age of Friends a rich social history immediately at the evidence level and a credible route to six functioning earned tracks—without compromising the trustworthiness of official Reputation, Relationships or the Chronicle.

No files, code, commits, PRs, flags, deployments or production state were changed.