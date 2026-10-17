> **Research archive (17 October 2026).** This is the worker's original read-only investigation, preserved for traceability. It is not an approved scoring rule, implemented capability, deployment report, or activation decision. See [the integrated V1 launch roadmap](../project/SOCIAL-V1-LAUNCH-ROADMAP-2026-10-17.md) for current conclusions and precedence.

Age of Friends V1 — Player Personality Model
 Main verified
Repository: Mathias-ao/League-of-Friends
Verified main: 25f120412df5ed0118b9557cdf822ab175108242
Comparison: Identical to the supplied starting commit; no commits ahead or behind.
Executive design decision
Player Personality should be implemented as five independent, evidence-backed longitudinal tendencies, derived from authoritative Battle statistics and qualified gameplay observations.
The essential distinction is:
- Personality: How a player tends to approach the game.
- Performance: How effectively the player executes that approach.
- Reputation: What the player has earned through the separate Gallantry, Cruelty and Chivalry systems.
- Relationships: What has developed between particular players.
The five sliders should not form a zero-sum personality system. A player can simultaneously be aggressive, cautious in military commitment, highly specialized and expansive.
A slider's midpoint must mean a genuinely balanced observed tendency, never missing evidence or insufficient data.
1. Five-slider evidence and calculation specification
Evidence foundation
The current implementation already provides most of the raw inputs required:
Existing implementation	Relevant outputs
military_statistics.py / military_statistics_v5.py	Positive/cancelled military queues, unit families, commitment, 10/15/20-minute checkpoints, production buildings and military research requests
resource_commitment.py	Base-cost resource commitments from classified commands
map_presence_v8.py	Placement sectors, forward buildings, expansion zones, geographic spread and infrastructure-based gold influence
raid_detector.py	Directed economic-zone hostile-command episodes with source identities
engagement_statistics.py	Skirmish, Battle and Great Battle candidates; command-contribution evidence and geographic contexts
execution_statistics_v2.py	Command activity, timing and inferred execution-context measurements
playstyleEngine.ts	Configurable weighted sliders, normalized component inputs and insufficient-data handling
The separately referenced V1b empirical investigation was not identifiable as a standalone file in the accessible uploads or Library. I have therefore used its explicit negative finding from your instructions, the repository's current evidence limitations, and the earlier replay-foundation investigation. This specification must not be mistaken for an independent reproduction of the V1b experiments.
Slider A — Boomer ↔ Aggressor
Boomer
Prioritizes economic development and economic commitment.
Aggressor
Prioritizes early military development and offensive commitment.

Concept. This slider describes the relative priority given to economy versus early military investment. It does not measure whether attacks succeed, whether booming is efficient, or whether the player eventually wins.
The primary witness should be the existing economy-to-military commitment model, preferably evaluated in qualified early-game windows. Military queue timing and repeated military investment provide the second witness.
Candidate calculation
\[
S_A=100(0.65M+0.35I)
\]

Here, \(M\) is the normalized early military share of classified military-plus-economic commitment, and \(I\) describes the relative timing and persistence of early military queue commitments. Values increase toward Aggressor.
The numerical weights are candidates, not approved rules.
Use the existing 20-minute ratio where its full boundary and pricing are qualified. A shorter, independently defined 10-minute window can support completed short Games, but must have its own calibration rather than being substituted into the 20-minute statistic.
TC placements, Villager queues and farm placements provide important corroboration for the Boomer side. Forward military placements and directed pressure candidates can corroborate Aggressor, but should not independently create a strong score while substantive pressure remains unverified.
Directional examples. A player consistently investing in Villager queues, economic infrastructure and additional TCs before committing heavily to military production leans Boomer. A player repeatedly making substantial early military commitments, with limited contemporaneous economic commitment, leans Aggressor—even if those military units never achieve anything.
A player producing one Scout early and then booming should not automatically count as an Aggressor.
Slider B — Cautious ↔ Bold
Cautious
Concentrates strategic placement and protection around defensible positions.
Bold
Commits infrastructure and strategic attention to forward or exposed positions.

Concept. The actual V1-measurable concept is planned positional exposure, not psychological willingness to take risks.
A player may be an Aggressor yet remain Cautious by prioritizing military production from a protected home position. Conversely, a Boomer may be Bold by repeatedly placing important economic infrastructure in forward, contested geography.
The strongest existing witnesses are forwardBuildings, sector-classified placements, towers.forwardCount, Castle placements, wall-tile reconstruction and normalized Enemy Progress geometry.
Candidate calculation
\[
S_B=100(0.60F+0.40P)
\]

\(F\) is the share and importance of classified strategic placements in forward sectors. \(P\) is normalized placement posture: strategic investment away from protected home sectors versus qualified home-oriented defensive placement.
Weights should apply to deduplicated, classified placement decisions, not raw clicks. Castle/tower/TC/military-building categories can carry different candidate exposure coefficients after calibration.
A complete observed home-oriented placement pattern provides evidence toward Cautious. Merely having no forward buildings does not.
Infrastructure-based goldControl may add corroborating positional context when deposit and influence coverage are qualified. It cannot prove contested territory was successfully held.
Directional examples. Repeated home-sector military infrastructure, defensive tower placements and walls produce Cautious evidence. Forward Castles, towers and military infrastructure repeatedly located toward opposing bases produce Bold evidence.
A player with no relevant strategic-placement observations remains Developing.
Slider C — Guerrilla ↔ Frontline Fighter
Guerrilla
Dispersed, mobile or economy-oriented military command patterns.
Frontline Fighter
Concentrated, sustained military commitment around contested battle regions.

Concept. This is the most semantically demanding slider.
For V1, the reproducible construct must be military command posture. It must not claim that a player successfully raided, inflicted damage, maneuvered a surviving army or won particular engagements.
The existing raid and engagement detectors are useful source witnesses for command patterns, but the V1b finding prevents treating their labels as independently verified executed combat.
Candidate calculation
\[
S_C=100(0.45E+0.35G+0.20U)
\]

The candidate components are:
Component	Toward Guerrilla	Toward Frontline Fighter
\(E\): command-episode posture	Repeated qualified economic-region-directed command windows	Sustained, geographically concentrated opposing-command windows outside economy-only regions
\(G\): geographic dispersion	Distinct, separated military-command regions across the Battle	Repeated military command contribution around fewer central/contested regions
\(U\): military composition corroboration	A qualified mobility-oriented production mix	A qualified combined-force/siege-support commitment mix
\(E\) and \(G\) require attributable military-command evidence, defensible geographic classification and meaningful repeated windows. They do not require proof of actual damage, but they must not be populated using proximity alone.
\(U\) must use an approved tactical-role mapping. Cavalry is not automatically Guerrilla, infantry is not automatically Frontline, and siege production does not prove participation in a frontal battle.
Overlapping raid and Battle labels must not count the same command window twice. Unresolved unit control, unknown relations in diplomatic FFA, truncation of relevant episode chronology or weak attribution makes the affected component unavailable.
Directional examples. A player who repeatedly issues attributable military commands toward several opposing economic regions, with geographic separation and mobile-force production corroboration, leans Guerrilla.
A player who repeatedly concentrates attributable military commands in sustained contested-region episodes, supported by substantial military commitment, leans Frontline Fighter.
A single apparent raid or the mere queueing of Knights is insufficient for either strong classification.
V1 launch boundary: This slider is implementable using existing retained statistics and source witnesses, but some players must remain Developing until repeated, source-qualified command patterns exist. Producing a forced 50-point or extreme score from unqualified combat candidates would violate the approved evidence model.
Slider D — Specialist ↔ Improviser
Specialist
Concentrates production in a few recurring military families.
Improviser
Uses broader family combinations and sustained changes in production emphasis.

Concept. This slider describes force-composition breadth and sustained changes in production planning. It does not prove a player noticed an opponent's strategy, countered it successfully or made clever decisions.
The existing military composition and positive queue timelines offer a strong V1 foundation.
Candidate calculation
\[
S_D=100(0.60H+0.40T)
\]

\(H\) is normalized military-family commitment entropy. \(T\) is the frequency or degree of sustained, meaningful changes in dominant production-family commitment across qualified time windows.
The proposed entropy input is:
\[
H=-\frac{\sum_{f=1}^{K}p_f\ln p_f}{\ln K}
\]

Here \(p_f\) is the classified share of requested military commitment allocated to family \(f\), and \(K\) is the number of genuinely available comparable families in the approved context—not merely the number of raw unit IDs.
Use the current catalog and producer fallback, preserving unknown/unpriced amounts. Different upgrade IDs in the same unit line must not artificially increase diversity.
Transitions should require enough requested commitment in both the earlier and later phases. One Spearman request for an emergency defense must not transform a highly specialized army into Improviser.
Directional examples. Repeated heavy Archer-line commitment with only incidental other production leans Specialist. Meaningful investment in multiple military families with sustained changes in emphasis leans Improviser.
A player who uses only naval forces because the map or Event effectively requires it should not receive a strong Specialist classification without appropriate context qualification.
Across Battles, recurring family choices can provide stability, but do not mistake mandatory civilization rotation for improvisation.
Slider E — Compact ↔ Expansive
Compact
Concentrates planned economic and territorial infrastructure near established positions.
Expansive
Establishes planned infrastructure across multiple distinct remote areas.

Concept. This slider describes the geographic distribution of planned infrastructure, not empire size, resource ownership or map-control success.
The existing expansionZones, buildingSectors, buildingPlacementRange, camp distances and TC-placement evidence are directly useful.
Candidate calculation
\[
S_E=100(0.50R+0.30Z+0.20D)
\]

\(R\) is the fraction of eligible strategic economic placements outside the supported home radius. \(Z\) is the distinct remote expansion-zone rate relative to qualifying infrastructure opportunities. \(D\) is map-normalized placement range.
Existing expansion clustering should be retained: nearby placements within one site must not masquerade as several independent expansions. Farms, ordinary houses, walls, towers and military production buildings should not create expansion zones merely because many commands exist.
Map-normalized distance and candidate zone density must account for map dimensions, initial anchors and land/water context. A Dock-centered expansion on a naval map cannot automatically be compared to a remote Mining Camp on Arabia.
Infrastructure-based gold influence may be presented as additional positional evidence, but not as proof of actual gold control, mining or building survival.
Directional examples. Repeated home-sector camp/TC placements with limited remote infrastructure lean Compact. Several geographically distinct remote economic sites, supported by meaningful placement spread, lean Expansive.
A player who simply clicks repeatedly in one distant cluster should not look more Expansive than a player who establishes several distinct sites.

2. Availability and confidence coverage matrix
The key distinction is between an existing projected measurement, a new derivation from existing evidence, and a semantic claim that is not currently available.
Slider	Existing V1 witnesses	Required additional derivation	Principal limitation	Initial readiness
Boomer ↔ Aggressor	Early economic/military commitment, queues, TC/economic placements	Qualified early investment-share and timing normalization	Incomplete pricing, missing early window, different starts	Strong foundation
Cautious ↔ Bold	Forward sectors, towers, walls, Castles, strategic placement geography	Opportunity-weighted positional exposure	Placements do not prove survival, danger or actual exposure	Moderate
Guerrilla ↔ Frontline Fighter	Raid/Battle command candidates, source IDs, military composition	Deduplicated command-region posture and qualified military-control coverage	No independently proven executed fighting, damage or raids	Restricted
Specialist ↔ Improviser	Positive queue composition, raw IDs, costs, timestamps	Functional-family entropy and sustained transition classifier	Production is requested, not completed; civ/map constraints	Strong foundation
Compact ↔ Expansive	Expansion Zones, home sectors, placement range, camp and TC geometry	Opportunity- and map-normalized geographic distribution	No completed buildings or territorial control	Strong foundation
Readiness assesses the available measurement foundation, not approved calibration, tested longitudinal behavior or live deployment.
A shared evidence contract
Each component should retain at least:
Field	Requirement
Identity	League playerId, Battle/Match ID, Game ID, source replay slot
Provenance	Active recording source, source revision/hash, mapping revision and projector versions
Context	Actual format, roster, map dimensions/type, civilization, supported start configuration and Game duration
Observation	Numerator, denominator, time window, qualified source IDs and evidence class
Coverage	Complete/partial/unavailable, affected fields, missing reasons and episode truncation
Interpretation	Model/rules version, normalized value, orientation, component weight and qualification
Sample accounting	Independent eligible Battle count and available component count
There must be three independently inspectable confidence dimensions: source integrity, semantic qualification, and longitudinal sample stability.
A large sample of weak command inferences cannot become strong combat evidence simply through accumulation.
Missing information and Developing
Do not normalize unknown to zero. Do not put unknown into the arithmetic as a 50-point midpoint. Distinguish a qualified observation of zero from no meaningful opportunity.
For example, a completed, classified 20-minute recording with no military queue commitment can legitimately contribute zero to an early military-share component when its denominator is valid. A Game ending at 08:00 cannot supply a zero military commitment at 20:00.
A player can have three READY sliders and two Developing sliders. The overall profile must preserve this partial state.

3. Cross-Battle normalization and longitudinal progression
Normalize within the Battle first
A raw count of 12 raids, six Castles or four expansion zones must not be treated as equally meaningful in every context.
Each feature needs an explicit denominator reflecting the measured opportunity. Candidate choices are early commitment share, qualifying strategic-placement share, qualifying command windows, classified military commitment, or meaningful expansion-site opportunities.
Duration normalization should use complete observed windows, not divide partial observations by a full-game denominator. Counts per minute may be used only when the observation window is eligible for that rate.
Map normalization should retain existing normalized Enemy Progress and map-size geometry. Civilization differences should enter through qualified available-family and cost/role taxonomies, rather than assumed balance corrections.
Separate compatible contexts
Use the actual approved Game topology: 1v1, fixed-team and FFA/dynamic diplomacy. Distinguish land-dominant from naval maps and supported ordinary starts from unusual starts.
Do not silently pool incompatible contexts because a private league has too few Games. A small compatible group may be insufficient for a comparative score; that is a Developing state, not a reason to invent a reference population.
A V1-appropriate normalization function is:
\[
N(x;c)=100\cdot\operatorname{clip}
\left(\frac{x-L_c}{U_c-L_c},0,1\right)
\]

Here \(L_c\) and \(U_c\) are approved, frozen contextual calibration anchors for a feature under compatible context \(c\).
These are reference anchors, not empirical constants already established by AoF. Until calibrated, the engine must not substitute arbitrary observed minima/maxima.
A tiny Season I league should not use live player-percentile rankings as the normalization source. That would make a player's personality shift simply because another player joined or uploaded a Battle.
Longitudinal scoring
The correct aggregation unit is the independent Battle, not the recording file. Current best-of-one Matches make one Game correspond to one Battle, but future multi-Game Battles should first produce a Battle-level measurement so they do not become disproportionately influential.
Let \(s_g\) be a qualified, context-normalized score for Battle \(g\), with 0 toward the left and 100 toward the right.
Compute a career tendency from all eligible Battles and a recent tendency from a bounded recent window. A candidate final score is:
\[
S_{\text{profile}}=0.65S_{\text{career}}+0.35S_{\text{recent}}
\]

Use robust equal-Battle aggregation within each window, such as a trimmed mean or robust median-based estimate, chosen during calibration. Do not weight a 4v4 four times more than a 1v1 merely because it has more participants.
The 65/35 blend is a candidate stability policy. It deliberately gives recent play meaningful influence without allowing one exceptional Battle to rewrite the profile.
For consistency, the recent window should count eligible distinct Battles, not the most recently uploaded files. Late corrections and source replacements must preserve the correct historical order and recompute the profile.
Candidate progression states
State	Meaning	Presentation
Developing	Too few independent qualified Battles or insufficient relevant opportunity	Muted slider; no numerical midpoint
Emerging	Enough evidence to calculate, but high variability or narrow context coverage	Numeric position with provisional confidence
Established	Sufficient compatible evidence, semantic coverage and stable uncertainty	Normal visible slider
Context-limited	Valid in one format/map family but not defensibly generalizable	Context-labelled slider rather than universal personality
I recommend maintaining the same core numerical position for a player unless new qualified Battles or a declared model recalibration changes it. Do not switch endpoint labels on tiny numerical movements.
Hysteresis can govern prominent endpoint descriptors independently of the underlying continuous score.

4. Candidate calibration choices requiring owner approval
All numerical values below are candidate starting configurations only. Nothing in this table should be treated as approved launch policy.
Parameter	Initial candidate	Approval question
Minimum independent Battles	5 qualified Battles per slider	Is this achievable during Season I without leaving most players Developing?
Recent window	Last 10 eligible Battles	Should the portrait reflect the same window?
Career/recent blend	65% / 35%	How responsive should identity feel?
Endpoint descriptive bands	Below 40 left, 40–60 Balanced, above 60 right	Is a 20-point central band sufficiently conservative?
Descriptor hysteresis	5–10 points beyond a label-change boundary, confirmed across 2 qualified updates	How resistant should labels be?
Early military window	Primary 0–20 minutes; separate qualified 0–10 short-Game context	Should short Games receive their own calibrated comparison?
Component completeness	100% coverage for components claiming complete classified totals	Are weaker fractional-coverage features ever acceptable with explicit bounds?
Episode minimum	Multiple independent, attributed windows across multiple Battles	What amount of command behavior is meaningfully recurrent?
Composition taxonomy	Functional families with named mobility/support classifications	Which classes/units are legitimately interpretable?
Reference normalization	Frozen per-context anchors, not live player percentiles	Which authentic examples represent low/high tendency?
Profile confidence	Separate semantic/source/sample conditions	How many unresolved contexts are acceptable for public display?
Proposed owner review priorities
Priority A: Lock the definitions, not the weights.
In particular, decide whether Guerrilla ↔ Frontline Fighter may legitimately describe a command-inferred military posture in V1. The definition above is measurable, but its evidence is less direct than production or infrastructure placement. It must not become a claim about actual combat effectiveness.
Priority B: Approve the family and placement taxonomies.
The most important classifications are military unit tactical families, economic versus military commitment, strategic placement categories, qualifying forward infrastructure and contextual opportunities.
Priority C: Review authentic profile examples.
For each slider, pick reviewed examples representing both ends, a genuinely mixed case, and a weak-evidence case. Use those to set calibration anchors and test whether the displayed numbers match the intended language without using wins or player skill as a shortcut.
Do not force the five sliders to be statistically uncorrelated. Boomer/Aggressor and Cautious/Bold may correlate through early forward military investment; Compact/Expansive may correlate with booming. The remedy is distinct definitions and limiting duplicate inputs, not artificial statistical orthogonalization.

5. Authentic-recording and synthetic negative-control test plan
The existing replay corpus and conformance tooling provide an excellent regression base, but the recorded three-fixture acceptance includes two perspectives from the same Game. Those are not three independent personality samples. The statistics readiness audit explicitly documents that distinction.
Authentic-recording qualification
Test group	Main purpose	Acceptance criterion
Reviewed 1v1 ordinary starts	Early commitment, production specialization, forward geography	Reproducible features and accurate source-labelled semantics
Fixed-team 2v2/4v4	Role, multiple opponents, team geometry	No fabricated directed pressure or misleading 1v1 normalization
Diplomatic FFA	Changing relations, ambiguous opponent targets	Unqualified hostile-interaction inputs are withheld
Naval and unusual maps	Naval composition, Dock expansion, restricted opportunity	No false cross-map personality equivalence
Short and incomplete recordings	Window and coverage gates	Null/Developing rather than fabricated zero/midpoint
Same Game, multiple recordings	Stable identity and duplicate evidence	One Battle contribution and equivalent qualified non-recorder-local features
The key semantic test is not whether an inferred raid counter matches another analytics tool. It is whether the component's published command-pattern interpretation is supported by the original events and, when relevant, actual replay footage. A TownBell agreement alone cannot establish true damage, military movement or engagement success.
Synthetic negative controls
Control	Must not happen
Add repeated identical BUILD commands in one location	Artificial Expansive score increase
Add a failed/cancelled military queue	Claim completed military deployment
Supply an unclassified expensive unit	Treat commitment/composition denominator as complete
Insert a single economic-region ORDER	Strong Guerrilla classification
Add an opponent nearby without attributed hostile commands	Invent confrontation
Remove an initial TC anchor	Invent forward placement or expansion geometry
Truncate a Game before 20:00	Publish a complete 20-minute investment statistic
Duplicate the recording under another POV or upload	Double the longitudinal sample
Change Game-to-player slot binding	Transfer someone else's personality evidence
Change a source during a profile read	Return a mixed-revision profile
Withdraw or dispute the authoritative result	Retain an ineligible personality contribution
Use only one military family because of a required map/civ condition	Overstate voluntary specialization
Replace complete episode chronology with truncated detail pages	Treat absent detail as absence of behavior
Additional metamorphic tests should mirror map orientation, vary map dimensions with equivalent relative placements, shuffle evidence input order while preserving source operation order, and replace one ordinary Battle with an unusual outlier to verify bounded profile movement.
Golden expected values should be reviewed under the selected rule version. Synthetic tests validate calculation and failure handling; they must not be presented as empirical proof that personality interpretations describe actual strategic behavior.

6. Minimal data flow and implementation plan
Authenticated active READY recording statistics
Verified source revision, mapping, result and Game context

Personality feature adapter V1
Existing Military / Economy / Map Presence / Execution measurements plus qualified source witnesses

Per-Battle normalized feature record
Context, opportunities, component values, coverage and source IDs

Longitudinal profile projector
Independent Battle aggregation, recent/career stability, confidence and eligibility

Existing Playstyle Engine + Player Profile
Five qualified 0–100 sliders, Developing states and evidence explanations

Implementation boundaries
The existing playstyleEngine.ts can be reused as the final weighted-score evaluator. It already validates normalized values, component samples, orientation, rule versions and required-component gates.
It does not itself establish normalization, context comparability, independent Battle counting, source qualification, confidence or profile hysteresis. Those must be supplied by a new versioned adapter/aggregator rather than assuming that a 0–100 input is inherently meaningful.
The implementation should preserve the current authoritative active-source selectors, hash/generation verification, accepted Game eligibility, mapping checks, correction fences and transaction-safe aggregation. It should not create a competing replay parser or a separate permanent history database.
A compact derived per-Battle feature read model is sufficient. It can be recalculated from retained qualified statistics and relevant source witnesses. Profile updates should be idempotent and recomputed when an eligible Battle is added, corrected, withdrawn, re-bound or reprojected.
For multi-Game Battles, first produce a qualified Battle-level contribution under an explicit grouping rule. This prevents a future best-of-three from silently counting as three independent strategic encounters.
The existing INSUFFICIENT_DATA engine status should map to player-facing Developing. More specific reasons—insufficient independent Battles, missing opportunity, unqualified model, incomplete recording or incompatible context—should remain inspectable.
V1 essentials versus future improvements
V1 essential	Future improvement, not required for initial functionality
Five versioned, distinct slider definitions	More detailed subtypes of personality
Qualified source-backed feature projection	Game-engine-reconstructed unit movement and actual army state
Context/opportunity normalization and frozen calibration	Large-population learned normalization
Independent Battle aggregation, confidence and Developing	Advanced statistical latent-trait models
Reproducible source and rules provenance	Rich interactive explanatory timelines
Correction-aware authenticated player-profile read	Tactical adaptation inferred from richer state telemetry
Genuine positive/negative corpus qualification	Automatically recalibrated baselines across many seasons
Final recommendation
Proceed with all five sliders in one V1 personality rule set, but do not pretend they have identical evidence strength.
Boomer/Aggressor should be principally an investment-priority slider. Cautious/Bold should measure planned positional exposure. Guerrilla/Frontline Fighter should remain a narrowly qualified military-command posture slider. Specialist/Improviser should measure military-family concentration and sustained production variation. Compact/Expansive should measure geographic infrastructure distribution.
This gives every slider a real evidence path using the current statistics architecture, without depending on unverified kills, damage, building completion, inferred intent or Reputation progression.
The implementation is design-ready, not calibration-approved or launch-qualified. The most important remaining approval is whether the command-derived Guerrilla/Frontline posture is an acceptable V1 representation of those exact labels, followed by the candidate taxonomy, numerical anchors and confidence gates.
No code, commits, PRs or live data were changed.