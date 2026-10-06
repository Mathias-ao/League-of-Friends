# Social incidents: Reputation and Relationships V1

Revision 4 design proposal, 6 October 2026. No scoring or production activation.
Numbers are proposed policy, not validated engine semantics. Authority:
[Core Identity](../project/CORE-IDENTITY.md) and [Contextual Social Deeds](contextual-social-deeds-v1.md).
The approved king-loss Treachery exception remains unchanged. This replaces the
previous proposal at this path. The [implemented shadow pilot](social-incident-implementation-v1.md)
records active capabilities and pending gates separately. [External review assessment](social-incident-rev3-assessment.md)
records the useful additions and rejected shortcuts from uploaded revision 3.

## 1. Purpose and boundaries

Real play becomes persistent, serious, evidence-backed league history. Drama comes
from particular deeds and reversals. Efficient normal play remains legitimate.
Reputation is Gallantry/Cruelty/Chivalry. Relationships are Rivalry/Hostility/Bond.
Trust is a Bond facet. Neither system numerically feeds the other, League Points,
rating, War Room Points or competitive advantage.

The league may exceed one lobby. Relationships describe pair depth; Reputation
records qualified conduct across eligible Battles. Breadth is descriptive, not
an obligation to find new victims/helpers. Repeated play with the same friends
remains valid. Sparse exposure is not weak friendship or low reputation.

Routine evaluation is automatic, deterministic and replay-free after extraction.
No player-entered statistics or per-incident human judgment is required. Controlled
qualification is development work. Existing authoritative result disputes,
administrative corrections and identity corrections remain intact. A qualifier
bug is fixed and rebuilt, not patched through discretionary social points.

Facts, inferred analysis, policy judgments and contributions remain separate.
Unknown is not zero interaction. Allowed deception is not a rules violation.
Labels describe league conduct, not motives, emotions or real-world morality.

## 2. Current evidence

Mathias confirmed all 74 directed commands through 1:05:00 of FFA_diplo, displayed
in 26 grouped rows, against paper notes on 6 October 2026. This supports the
reviewed decoded chronology for this fixture, not effective engine state, attack
semantics, rejected/no-op behavior, initial-state mapping, outcomes or other builds.
The notes have not been imported as independently timed engine witnesses.

| Source | Supported basis | Separate gate |
| --- | --- | --- |
| Directed diplomacy commands | Requested stances and declared reversals | Effective engine state and state before first declaration |
| Generic targeted ORDER | Target-ID context and qualified actor fields | Attack versus conversion/repair/other contextual meaning |
| Patrol/attack-move/attack-ground | Named positional instructions | Specific victim, actual position and combat outcome |
| Initial objects/earlier selections | Historical controller/type evidence | Current ownership after conversion and produced-object identity |
| Tribute | Candidate sender/recipient/resource/amount instruction | Decoder/acceptance/fee/delivery semantics and materiality |
| Existing pair evidence | Supported contest, pressure and support facets | Full combat coverage, outcome and independent repeated deeds |
| Current accepted league result | Official human opponent/winner/loser context | Elimination order, king killer and cause of defeat |
| Rating history | Versioned before-Match strength context where available | Revision-aware social snapshot adapter and nonprovisional eligibility |
| Queue/build/research | Existing production proxies | Live army, completed buildings, resources available to assist |

The current accepted-outcome adapter already exists. Duel/result features do not
need to wait for replay winner extraction. Resignations and postgame rankings are
not automatically outcomes. FINAL_DUEL remains unavailable until participant
endpoints and completion are independently qualified; the last two observed
resignations do not establish the last two active competitors.

The entity catalog maps type IDs, not complete object-instance histories. Future
selection cannot backfill earlier ownership/type. Raw retention permits future
decoding but cannot reveal unrecorded state. A later static-type inference, if
introduced, needs its own temporal qualification and must not assume ownership.

## 3. Explicit event policy

Snapshot interpretation policy from authoritative event configuration separately
from actual game settings. A header can qualify diplomacy lock, not players'
expectation of deception. Contradictory/unknown settings block dependent families.

| Setting | Interpretation |
| --- | --- |
| DECEPTION_ALLOWED | Default: preserve reversals and evaluate independently qualified conduct |
| DECEPTION_EXPECTED | May reduce ordinary trust-break modifier under configured policy; never hides facts or disables unrelated Cruelty families |
| ALLIANCE_PROTECTED | May strengthen a cooperative-breach modifier; creates no automatic competition penalty |
| Locked diplomacy | Dynamic-diplomacy families not applicable once game setting qualifies |

Backstabbing can be expected and still narratively ruthless. Whether a particular
trust-break family earns Cruelty is an explicit parameter, not a moral deduction.
No new owner-only visibility or negative ranking is imposed; use current league
access policy. A later conduct ranking requires an explicit product decision.

Tracks require authoritative human league identity mapping. Unmapped/guest facts
remain available for later mapping/rebuild. Explicitly identified AI earns no
persistent player tracks but may provide context. Never classify AI by a name such
as Bot(Halvar). Player-versus-AI conduct is excluded from ordinary human-pair
progression unless a separately configured event achievement permits it.

## 4. Small automatic interpreter

Use existing canonical facts and pair evidence; do not create a parallel statistics
pipeline. The evaluator is pure over retained inputs, rules and pre-Battle state.

| Object | Required fields |
| --- | --- |
| Fact | Game identity, kind, full timestamp/ordinal, actors/targets, source IDs/hashes, qualifier versions and evidence layer |
| Claim | Subject, name, status, typed value, scope, basis, missing/conflicting prerequisites |
| Incident | Exact pair/coalition, source anchors, bounds, campaign reference, before-context and facets |
| Decision | Family/rule version, required claims, result and machine-readable reasons |
| Deed | Matched decision, actor/beneficiary, exact incident, severity and lineage anchor |
| Contribution | Consumer, action/contribution directions, magnitude rule, caps/replacement and revisions |
| Ledger | Accepted ordered contributions, exposure, current states, historical peaks and revisions |

Claim statuses: QUALIFIED, UNAVAILABLE, NOT_APPLICABLE, UNCONFIGURED_POLICY.
QUALIFIED means its value is supported; it does not mean a predicate is true.
Decision outcomes: MATCHED, NOT_MET, UNAVAILABLE, NOT_APPLICABLE, UNCONFIGURED_POLICY.
NOT_MET is a completed supported negative evaluation. UNAVAILABLE means insufficient
inputs. Both must be retained, not reduced to the same absence of points.

Family gates are typed configurable predicates. Required and enriching claims are
separate. Unknown target type blocks target-based Cruelty, not known diplomacy
history. Unresolved defense blocks an initiating-blame modifier, not narrower
command facts. Production has no 'await human review' status.

## 5. Negative claims and provocation

Scope negatives to the domain checked. NO_QUALIFIED_OFFENSIVE_ORDER_OBSERVED means
that a supported qualifier produced none in an interval. It does not mean no
attack order, automatic combat, provocation or actual harm occurred.

Keep interval framing/coverage, qualifier applicability and unresolved relevant
commands separately. Generic ORDERs or unsupported offensive routes that could
change a defense decision leave that decision unavailable. A zero qualified-order
counter cannot bypass this uncertainty. No scoped negative secretly proves innocence.

Reciprocal Ally declarations cannot prove absence of recorded provocation. Even
if allied attacks are ineffective, an ineffective attack order may still be issued;
declared state is not effective state; area effects/conversion and unsupported
settings remain separate. Command presence, acceptance and offensive meaning need
independent tests. Do not derive NO_RECORDED_PROVOCATION from declarations alone.

Ordinary breach can be explicitly defined as reciprocal declared friendship
withdrawn plus qualified offense. This is an interpretation of recorded conduct,
not proof of objective unprovoked aggression. Preserve separately: withdrawal
initiator, first observed offensive order, contested initiation and defensive context.

## 6. Cooperation and aid

DECLARED_TRUCE means reciprocal Ally declarations. SUPPORTED_COOPERATION requires
qualified aid/support/shared participation during that known interval. Historical
Bond is snapshotted before the league Battle. Duration cannot create cooperation;
all-player peace does not create all pair Bonds. Short substantive assistance can.

| Fact | Positive gate | Never implies |
| --- | --- | --- |
| MATERIAL_AID_ORDER | Qualified sender/recipient/resource vector and substantive instruction under configured aggregation | Delivered amount, recipient need, gratitude or rescue |
| RETURNED_AID | Independent qualified reverse assistance with exact chronology | Received copies or automatic cancellation of mutual aid |
| SHARED_OFFENSE | Each ally's own participation toward exact common opponent in a supported incident | Same target anywhere in sixty seconds proves coordination |
| SUPPORT_UNDER_PRESSURE | Supported helper/beneficiary/aggressor and attributed pressure episode | Any attack on a common opponent equals defense |

Coalesce tribute before a substantive threshold; no arbitrary per-transfer minimum
that rewards one large click over split transfers. Preserve resource vectors. Any
pooled resource valuation is configured, not presumed economic equivalence. Preserve
gross directions and recycling context; cap awards instead of netting away all
reverse transfers inside an arbitrary 120-second window. Real aid may be mutual,
and a loop can be delayed. No collusive-intent classifier is claimed.

Tribute then Ally declaration is TRIBUTE_THEN_ALLY_DECLARATION, not proof of buying
peace. Record the sequence without automatically disqualifying assistance. Merely
forming an alliance earns no cooperation/Bond. Family materiality and relation
context still gate its substantive contribution.

## 7. Rupture, incidents and responses

Reconstruct declared directions from UNKNOWN in timestamp/ordinal order. Repeat
requests add sources, not reversals. Unknown modes interrupt continuity. First
observed Enemy is not withdrawal of an unseen alliance. Raw DE no-team is not Ally.
Ally-to-Neutral is withdrawal, not automatically war; known Neutral continuity can
preserve earlier rupture under explicit policy, but unknown intervals cannot.

Separate observed declaration-withdrawal initiator from first observed offense and
qualified offensive initiation. Close opposite withdrawals may receive contested
initiation despite precise order. A proposed five-second contest parameter is a
sensitivity test, not proof of human awareness or reaction.

Ten game seconds describes an immediate strike. Delayed association up to sixty
seconds is a shadow candidate requiring exact pair, continuity, incident membership
and no unrelated intervening context. Compare 10/30/60 windows. Temporal distance
changes association, not automatically severity; deliberate delayed offense is
not inherently less consequential.

Use local incidents inside a continuing pair campaign. Broad combat components
are not exact pair attribution. Repeated micro/toggles cannot reset awards. A new
truce ends an opposed interval without establishing reconciliation or cooperation.
Silence/time alone does not prove a new independent campaign.

Keep RESPONSE_AFTER_WITHDRAWAL, RETURN_OFFENSE_AFTER_OFFENSE and
LOCAL_DEFENSIVE_RESPONSE distinct; only the last needs qualified spatial threat
state. Halvar's 57:42 rupture and 12-14-second replies are a regression case: ten
seconds must not turn responses into new initiating betrayals. A defender gets no
permanent exemption for subsequent independently qualified offensive conduct.

## 8. Offense, target function and materiality

Separate hostile commitment, victim selection, target selection and consequences.
Qualified semantics plus at-time attribution can establish an offensive attempt;
success is not required. Conversion or other offensive appropriation may have
its own qualified subtype; offense is not silently limited to weapon attacks.
Generic ORDER and positional/automatic combat cannot establish economic targeting.

Combined routes need positive and automatic/nonoffensive negative controls. Styles
with unequal coverage cannot be compared as equal tendencies. A targeted command
fact may remain visible without forcing patrol to produce an invented target.

Target function: MILITARY, ECONOMIC_UNIT, ECONOMIC_STRUCTURE, STRATEGIC_OBJECTIVE,
UNKNOWN. Ownership, type and temporal attribution qualify separately. Type/cost
cannot establish live vulnerability. King targeting is not elimination; relic
targeting is not taking possession.

Materiality has alternative routes: qualified consequence, or substantive offensive
continuation. It controls stronger contribution tiers, not whether a narrowly
qualified attempt can enter history or earn a limited attempt-tier contribution. Reject a universal three-target/two-selection-set gate. One valuable
target may be consequential; selection changes are arbitrary and easily farmed.
A command-only continuation rule must use independently supported incident
participation, temporal spread and distinct action substance, retaining supported
withdrawal/cancellation facts. Exact family thresholds remain unconfigured until
tested against single-target attacks, raids, defense, patrol and spam. Narrow
attempt facts can publish without that award gate. Never manufacture damage/losses.

## 9. Family catalog

| Family | Consumer | Positive basis | Disposition |
| --- | --- | --- | --- |
| ACCEPTED_DUEL_CONTEST | Rivalry | Official opposed human pair and current accepted 1v1 result | Adapter-ready candidate; no per-pair kills |
| DIRECT_PAIR_CONTEST | Rivalry | Qualified pair participation from independent actors; defense can count | Supported facets only |
| DECLARED_BREACH_OFFENSIVE_ATTEMPT | Hostility modifier/Chronicle | Reciprocal prior declarations, withdrawal and associated qualified actor offense; response/contested context | Offensive qualifier pending |
| RECURRING_DIRECTED_PRESSURE | Hostility | Independent directed incidents across Battles under explicit context policy | Candidate; no multiple-opponent requirement |
| MATERIAL_ASSISTANCE | Bond/Chivalry independently | Qualified substantive aid and applicable relation context | Tribute/materiality gates pending |
| SHARED_PARTICIPATION | Bond | Exact allied participants/common target and each person's actual sources | Fixed-team evidence can proceed independently |
| PROTECTIVE_PARTICIPATION | Bond/Chivalry independently | Supported pressure/beneficiary/aggressor and alliance | No imagined rescue |
| TRUST_BREAK_ECONOMIC_STRIKE | Cruelty | Prior supported cooperation/current truce; recorded initiating breach and qualified economic attempt; materiality/defensive certainty for stronger tier | Attempt-tier candidate after offense/target gates; no full-combat negative required |
| PUNISHING_ADVANTAGE | Cruelty | Independent sustained pre-entry disadvantage and meaningful pressure | Unavailable in current command/state pipeline |
| DARING_OFFENSIVE_PARTICIPATION | Gallantry | Meaningful offense with independently qualified daring/competitive circumstances | Candidate; no result-only reward |
| UNDERDOG_WIN | Achievement/Chronicle | Accepted outcome and suitable before-Match rating snapshot | Outside Gallantry |
| NOTICE_THEN_OFFENSE | Chronicle | Known prior peace declaration, Enemy request, later qualified offense | Waiting alone earns no Chivalry |
| QUALIFIED_KING_LOSS_TREACHERY | Existing exceptional Hostility rule | All existing effective-alliance/rupture/responsible-elimination prerequisites | Approved rule, evidence gates unchanged |

Require substantive positive routes equally for flattering and antagonistic labels.
Do not invent Gallantry/Chivalry merely to fill three progress bars. Historical
rating can establish underdog context, not in-game strength. Standings are not
rating; highest-rated co-presence does not establish an opposed accessible target.
An upset win is an achievement, not by itself proof of daring conduct.

FOCUSED_PRESSURE at sixty percent distinct objects remains exploratory analysis.
Objects are unequal tactical effort, two roster opponents do not establish two
accessible choices, and unknown IDs/patrol distort its denominator. No ratio
proves ill will. Do not ban Hostility in all 1v1s: routine scheduled opposition
alone earns none, but independently qualified recurring antagonism may occur.

### Ordinary economic-breach rule: reachable without pretending omniscience

The base rule describes recorded choices, not actual unprovoked combat. A qualified
attempt may earn one bounded ordinary contribution; sustained/destructive tiers
require their own additional claims. One event does not establish a mature public
Reputation. This replaces the earlier all-or-nothing continuation requirement.

| Base gate | Requirement |
| --- | --- |
| B1 | Supported human pair, source tuple/identity and applicable event policy |
| B2 | Known reciprocal Ally declarations immediately before the withdrawal, with complete declaration continuity for the incident |
| B3 | Positive qualified cooperative context before withdrawal, or expressly configured historical Bond plus current truce |
| B4 | Actor initiated the recorded declaration breach; not a response to an already known opposing breach and not contested/unknown initiation |
| B5 | Qualified explicit offensive attempt at an economic target of the former ally within the associated incident; current attribution and target function supported |
| B6 | No independently established response context that contradicts the proposed initiating classification; relevant qualifier conflicts make the decision unavailable |
| B7 | Configured attempt-tier magnitude and Battle caps; no duplicate campaign award |

B6 is a consistency check against known facts, not NO_ACTUAL_PROVOCATION. Unresolved
combat outside the supported observation domain is disclosed, never silently
converted to a claim of innocence. If ambiguity affects B4/B5 themselves, no award
qualifies. Known defensive response excludes the initiating-betrayal family;
unknown local self-defense blocks a severe blame modifier, not the narrower
recorded-choice classification. Chronicle wording says economic betrayal attempt,
not unprovoked cruelty, surprise or successful damage. Attempt-tier policy is a
proposal requiring representative acceptance before activation.

A single qualified economic target is sufficient for the attempt tier. Stronger
tiers require validated continuation or actual consequence, which may be absent.
Normal economic raids against opponents lack B2/B3/B4. Automatic combat lacks B5.
Single meaningless/unsupported target clicks fail offensive/identity qualification,
while a genuine explicit but unsuccessful attempt remains an attempt. This is more
honest than forcing three targets or treating failure as proof of harmlessness.

Economic structures may have multiple functions, such as defense and production.
Represent role facets rather than pretending that every object has one exclusive
function. An armed town-center/castle target must not become cruelty merely through
an economic tag. The target policy needs an explicit permitted economic-vulnerability
class; unknown or mixed roles block that target-based contribution while retaining
the offensive fact. Initial V1 prefers qualified civilian economic units; structure
families need separate acceptance, not a blanket buildings classification.

## 10. Reciprocity, exposure and stages

Keep pair exposure separate: Games/Battles met, locked-team/opposed/open-diplomacy
contexts, last met, last deed and evaluability. Open Games can contain mixed
relations. Co-presence is not local contact. Never-met, met-with-unavailable-
evidence and fully evaluable-with-no-qualified-deed are distinct states.

Rivalry reciprocity needs independent contest participation; defense may count.
Hostility reciprocity needs independently configured antagonistic evidence;
synthetic victim impact and immediate defensive copies cannot manufacture it.
Bond reciprocity can be returned aid/support or repeated qualified shared
participation with each person's own sources. Tribute is not the only route.
Action direction and contribution direction stay separate.

Proposed ordinary stage gates: first qualifying Battle establishes an early track;
a second distinct Battle establishes recurrence; level three needs at least three
distinct Battles plus track-specific reciprocity. Names, point thresholds, maximums
and higher stages remain unapproved configuration. The approved unilateral king-
loss exception bypasses ordinary gates exactly as specified: victim-to-responsible-
ally reaches level three or rises one level, capped, without creating mutual Feud.
Do not blanket-ban level three from one Game when referring to that exception.

Current state differs from historical peak. Breach can diminish current Bond
under bounded policy without deleting past assistance. Qualified renewed cooperation
can grow Bond/cool Hostility. Inactivity produces no decay/penalty. Opportunity-
based absence/non-cooperation remains off until awareness/capacity/coverage qualifies.
Arcs require their own sources; renewed Ally does not prove reconciliation. An
unmet pair is not automatically a matchmaking recommendation.

## 11. Exposure versus opportunity and profiles

Name EVALUABLE_CONTEXT, OBSERVED_ELIGIBLE_CASE and OPPORTUNITY separately. An ally
present does not prove capacity/resources to help; an attack on that ally does not
prove awareness/reachability/spare troops. A higher-rated lobby member does not
prove an opposed challenge opportunity. These contexts disclose exposure, not
refused help or complete conduct opportunities.

Initially show earned deeds, supported families, eligible Battles and distinct
counterparts. k/n is permitted only with aligned numerator/denominator units,
scope and qualified relevant detection completeness. Display excluded/unevaluable
cases and the denominator definition. A command-route rate must name its route,
not general intent. Cooperative intervals with unknown offensive/target coverage
cannot become negative denominator cases for a true betrayal tendency. Interval
splitting and missing target identity cannot mechanically lower reputation.

No universal five-opportunity threshold. Family-specific sample/coverage governs
stability. Developing means insufficient evidence; unevaluable means unsupported
context. Reputation breadth is descriptive, not a stage obligation. No automatic
half-points after a second same-counterpart deed: that penalizes small groups and
rewards rotating victims/helpers. Battle budgets and cross-Battle history provide
stability without that incentive. Recent season views coexist with lifetime history.

## 12. Accounting and migration

Evaluate retained facts, versioned rules and authoritative pre-Battle state. Local
facts enrich context only at their actual moment; persistent-strength modifiers
use before-Battle snapshots. Cross-Game order follows approved sequence, not upload.

| Ordinary cap | Proposed behavior |
| --- | --- |
| Incident/consumer | One base with bounded severity; strongest facet replaces weaker, no raid/battle/rupture stacking |
| Pair/family/Battle | Strongest ordinary contribution; factual history remains complete |
| Player/Reputation family/Battle | Strongest qualified contribution |
| Player/Reputation track/Battle | One bounded budget shared across families; numeric budget unconfigured |
| Same counterpart in later Battles | Legitimate recurrence, no automatic half-value |
| Coalition | Each contributor needs own actions/context; no roster-wide equal credit/blame |
| Exceptional Treachery | Existing once-per-king-loss/responsible-actor semantics; no duplicate generic king-loss award |

Use lineage anchors (canonical Game, actors, source incident anchors) for matching
corrections, and evaluation keys including active evidence/policy/identity/outcome
revisions. A rule-version change permits replacement, not a second award. Only one
active authoritative revision set contributes. Multi-POV/retries remain one Game;
similar commands at distinct valid moments are not automatically duplicates.

Source, identity, result, rating or policy correction invalidates dependent chapters
and before-Battle states. Rebuild in canonical order and publish one coherent
revision, never a mixed ledger. Produce before/after decision diffs. Historical
policy reinterpretation is an explicit migration; old snapshots stay reproducible.
Disputed/void results follow existing authoritative workflows.

Implementation constraint: current reputationEngine maximumUnitsPerBattle clamps
each deed separately, not aggregate Battle units. It is not a drop-in cap engine;
group budgets, deduplication and replacement require successor accounting before
activation. Current rating history contains before/after/source revision fields;
a social snapshot adapter must select the correct historical input and propagate
corrections rather than read the latest player rating.

## 13. Anti-farming and presentation

Bound incentives without pretending to detect collusion. Toggles, duplicate facts,
selection splitting, repeated clicks and multi-victim FFA cannot multiply awards.
Aid keeps qualified gross directions and bounded credit with separately tested
recycling controls. Rating eligibility blocks provisional/inconsistent context;
minimum history does not prove immunity to rating manipulation. No automatic
purchase, gratitude, awareness or malicious-intent classifier is introduced.

Chronicle prose uses qualified scope: declared Ally, withdrew the declaration,
ordered offense, tribute instruction. It never invents surprise, destruction,
rescue or effective formation. Group shared timestamps visually, retain exact
pair/source chronology underneath. Public statements/arcs trace to qualified
claims; candidate awards stay in development review, narrow facts can publish.

Pair cards show exposure, current tracks, peaks and turning points. Profiles show
earned history and Developing/unevaluable families. Season recaps select distinct
verified turning points through explainable tags; caps never delete history.
Rare reversals can receive prominence without destabilizing ordinary progression.
Visibility and any later rankings remain explicit product policy, not imported
moral assumptions from the external review.

## 14. Validation and phased delivery

Scripts establish intended test actions, not automatically executed engine truth.
Retain actual command references and synchronized independent UI/video witnesses
for acceptance/effective-state/outcome claims. Pin build/save/data/mod/settings
and qualifier versions. Follow the existing tuple-specific diplomacy protocol.
Reviewed chronology in one fixture does not qualify every route or future patch.

Controls cover attack/nonattack/conversion, stale ownership, rejected/no-op allied
orders, automatic/patrol behavior, Neutral/asymmetric declarations, tribute fees/
loops/splits, one valuable target versus mass targeting, defense/third-party aid,
truncation, human/AI/guest identity, land/naval targets, final-two ambiguity and
outcome/rating/identity corrections. Add independent ordinary holdout games.

Exact invariance tests: reordered serialization preserving moments, duplicate
source facts, retries, unrelated out-of-scope facts, POV deduplication and rebuilds.
Semantic-change tests: changed ordinals/ownership/declarations and threshold-crossing
timing have expected changes. Do not permute actual same-time ordinals or jitter
across ten-second windows and demand identical decisions. Selection splitting
should not multiply units. Timing sensitivity reports expose discontinuities.
Rule changes produce explicit added/removed/changed decision diffs, not invariant
scores. Claim-preserving changes and semantic changes are different tests.

Acceptance requires no known false-positive classifications in required negatives,
supported positives, holdout review, documented blind spots and boundary behavior.
Zero errors in finite controls is not universal accuracy. Unavailable cases are
not false negatives. Style parity applies to semantically equivalent routes;
patrol does not qualify an explicitly selected target by fiat. Where coverage
differs, withhold comparative tendencies instead of forcing manufactured parity.

Telemetry reports build/format/style qualification, unknown attribution, reasons
and event frequency. Invariant failure blocks activation; unexpected frequency
prompts diagnosis under configured alerts, not automatic rejection because a
small league's players happened to betray more or less often.

Delivery is per family, not a global five-premise gate:
1. Command Chronicle, exposure and declared-history incidents; no points.
2. Accepted-duel Rivalry and supported fixed-team cooperation with explicit shadow
   rules/accounting; tribute facts after their own qualifier.
3. Aid/support consumers and breach/offensive chronology independently.
4. Target/materiality-qualified Cruelty and daring-conduct Gallantry after their
   own gates; king responsibility/effective state remain separately gated.
5. Production contributions only after grouped budgets, corrections, reciprocity/
   stages and representative acceptance pass for each activated family.

Persist sufficient canonical evidence before replay deletion; do not promise
unrecorded engine state can later be reconstructed. Social projections are
additive: no statistical formula/detector episodes change silently. No unrelated
goldens are regenerated. This design update itself certifies no game semantics
and implements/activates no scorer.
