# Age of Friends — Relationship V1 approved design baseline

**Approved design, not implemented or activated.** Consolidated 13 October 2026. This is a compact continuation of [AOF-SOC-001–057](social-relationship-decisions-001-057.md), not a replacement for its detailed rules or a numeric scoring specification. It captures subsequent **AOF-SOC-058–088**, **REL-V1-EVID-01–06**, and **REL-V1-CAL-01–17** approvals. The older register/handover's “SOC-058 pending” reflects its earlier snapshot; **SOC-089 remains deferred**. Nothing here authorizes code, staging, Firebase, E2E, flags, deployment or merging.

**Product promise:** *Play the game. Build your history. Let Age of Friends remember.*

## Scope and player-facing model

- Keep **Rivalry, Hostility and Bond** separate, independently qualified, directional Relationship tracks; Reputation (Gallantry/Cruelty/Chivalry), exceptional Treachery, League Points, War Room Points and Gold remain distinct. One episode may affect multiple tracks only when each effect qualifies independently.
- Four meaningful action families: **competition** (Rivalry); **directed antagonism** (Hostility); **meaningful directed assistance** (Bond, possible Hostility cooling and minor independently qualified Rivalry de-escalation); **antagonism affecting an established Bond** (Bond weakening, possibly separately qualified Hostility), whether current allies or opponents. Ordinary warfare, team assignment, outcomes and mere inactivity never automatically create Relationship effects.
- **Stages:** not established; level 1 emerging; level 2 developing; level 3 established; higher stages only as separately configured. Qualitative stage meanings are explanatory, not numeric parameters or final UI copy. Levels 1–2 can be asymmetric; each **ordinary level 3+** stage requires its independently qualified, stage-specific, bidirectional historical reciprocity alongside ordinary thresholds. No extra level-3 “special episode” gate beyond approved thresholds and reciprocity, and no arbitrary minimum Event count. Exceptional directed Treachery Hostility escalation follows its separate rule.
- **Two presentation layers:** (1) a simple qualitative pair description; (2) visible verified **A→B and B→A** stages. Use descriptions such as *one-sided*, *mutual but uneven*, or *mutual* based on independently established directions; equal stages are **not** required for mutual involvement. These are working labels, not final UI wording. Never imply shared equal standing, manufacture the opposite direction, or display a shared **numeric** stage without a future explicitly approved aggregation rule. Incomplete evidence/chronology is **pending**, not verified zero; show only a labelled last verified *historical* standing when applicable.
- Chronicle is primarily an **automatic factual archive**. Keep routine questionnaires and broader interactive/correction/public-UI expansion **outside Relationship V1 scope**; preserve earlier approvals without treating them as instructions to implement every feature. Rare explicit victim Treachery judgment and explicit skill-superiority recognition remain exceptional supported interactions.

## Relationship engine invariants (preserved from SOC-001–057)

All genuine eligible Event Battles—including non-scoring warmups—may supply independently source-backed deeds, with replay/Game/Battle/Event identity, player mapping, revisions and reliable chronology. Qualify **distinct meaningful episodes**; allocate separate strengthening and weakening allowances per **Event × unordered pair × track × direction**, keeping recorded evidence even when a contribution is capped. One independent reciprocity credit maximum per Event/pair/track/direction, with earliest reliable anchor and cross-Event recognition; credit may qualify independently of capped ordinary progression. No invented counterpart reciprocity.

Use the shared historical evaluator with track-specific qualifications: counterbalance **unfinished** opposing progress, preserve legitimate surplus and completed historical crossings/peaks, allow qualifying multiple crossings within an Event, and replay actual chronological positions. Missing order defers only dependent outcomes. Dormancy from qualified opposed non-contact applies to Rivalry/Hostility status only; no calendar decay or automatic stage loss. Qualified weakening can regress current stages, preserving supported historical record and source correction behavior. Stage-3 Rivalry retains its **acknowledged skill-hierarchy gate** against regression below 3, even if de-escalation has accumulated.

Exceptional Treachery remains a strict source-proven alliance rupture and king-loss responsibility **plus binding explicit victim confirmation of “betrayed”** (SOC-061); absent confirmation, no exceptional effect or consumption. Once qualified, it raises **victim→responsible former ally Hostility** to stage 3 if below 3, or +1 up to configured maximum if already 3+, without mutual reciprocity. Its separate capped ordinary-strengthening-unit consumption claims follow SOC-012–019 priority and chronology, with no debt/carryforward; later qualified weakening can regress the resultant standing. War Room pending-stage and correction/prize safeguards in SOC-030–041 stay unchanged.

## Approved evidence decisions — REL-V1-EVID-01–06

- **01 A:** Substantive independently verified directed conduct may count without successful outcome; material verified consequences may heighten significance. Commands/intentions alone are insufficient.
- **02 A:** Distinct meaningful episodes within one Battle can each qualify, subject to Event allowances; do not slice one encounter/repeated commands artificially.
- **03 A:** No Battle-wide significance bonus or multiplier; ordinary progression comes from qualified episode effects only.
- **04 A:** Context-sensitive episode significance uses verified circumstances known at the episode's historical start; never retroactively reinterpret the pre-episode context using later outcomes.
- **05 A:** One context-enriched contribution per independently qualified directional track effect from an episode; consequences may strengthen significance, never create a duplicate reward.
- **06 A:** Substantive directed assistance can strengthen Bond without formal alliance, including FFA; shared targets/proximity or presumed cooperation do not suffice.

## Approved progression calibration — REL-V1-CAL-01–17

- **01 A:** Higher ordinary upward stages progressively harder, track-specific, with independent reciprocity; no invented minimum Battle/Event count.
- **02 A:** Rivalry resists regression (protected stage-3 floor); Hostility responds to qualified reconciliation; Bond tolerates routine friction but may weaken substantially through serious qualified antagonism.
- **03 A:** Substantial unsuccessful effort can be significant when substantive conduct and verified context justify it; outcome success not required.
- **04 A:** One exceptional ordinary episode may cross early boundaries to level 2 **if** configured thresholds are met; no bonus or automatic stage leap, and level-3 reciprocity remains.
- **05 A:** Genuine exchange, resistance and counterplay generally matter more to Rivalry than one-sided domination; directed one-sided competition can still qualify, without fake reciprocity.
- **06 A:** Normal warfare/attacks/victories do not by themselves build Hostility; independently qualified **distinct meaningful directed antagonism** is necessary. No inferred motives or duplicated command episodes.
- **07 A:** Qualified unilateral directed help may establish directional Bond through level 2 if thresholds are met; level 3+ retains independently qualified bidirectional reciprocity, without implying mutual support.
- **08 A:** Meaningful qualified antagonism can weaken established Bond even between current opponents; ordinary competition is insufficient. Serious antagonism while allied may be more significant.
- **09 A:** Mere absence of cooperation—even verified—never weakens Bond; separately approved Hostility/non-cooperation rules remain unaffected.
- **10 A:** Meaningful help by B toward A may weaken **B→A** Hostility (and separately strengthen B→A Bond), **not A→B** Hostility by virtue of receipt alone; no manufactured reciprocity.
- **11 A:** Team-Battle Rivalry requires independently qualified **pair-specific** competitive conduct; consequential indirect competition may count, but teammates' actions, shared results and team opposition alone cannot.
- **12 A:** Team-Battle Bond requires independently qualified **pair-specific** directed help. Group assistance may qualify separately for several actual recipients, never automatically for every teammate.
- **13 A:** Substantive defensive resistance/counterplay may strengthen defender→attacker Rivalry without counterattack; merely being attacked, damaged or passively surviving cannot. Independent competitive directions may qualify reciprocity.
- **14 A:** Destructive successful defense does not automatically create defender→attacker Hostility; distinct independently qualified directed antagonistic significance is required.
- **15 A:** Show asymmetric independently established **directional** stages explicitly, without inventing equal mutual strength or shared numerical stage.
- **16 A:** Pair overview uses a **qualitative shared Relationship description plus both directional standings**; no pair-level numeric stage unless separately qualified under a future approved aggregation rule.
- **17 A:** Independently established unequal directional stages may be described **mutual but uneven**; matching levels not required, and this alone does not meet higher-stage reciprocity gates.

## Subsequent SOC decisions preserved — AOF-SOC-058–088

**Rivalry and admitted sources**
- **058 A:** One independently qualified player's acknowledgment of the other's superior skill can open the Rivalry stage-3 regression gate; no matching acknowledgment required, and acknowledgment alone does not regress.
- **059 A:** Explicit attributable skill-superiority statement is required; results, statistics, implicit concessions and behavior alone do not qualify.
- **060 A:** Authenticated, source-linked structured Chronicle judgments may independently qualify for future directional Relationship effects under track-specific rules; never automatically change objective replay facts, points or reciprocity.
- **061:** Exceptional Treachery additionally requires the victim's explicit binding “betrayed” judgment; “fair game” cannot trigger exceptional Hostility, though it may separately inform Rivalry under qualification rules.

**Judgment timing, correction and visibility**
- **062 A:** An unanswered Treachery prompt stays pending indefinitely and private; no exceptional Hostility/consumption, ordinary evidence unaffected.
- **063 B / 064 B:** Original judgment binds except verified genuine error; no later appended reinterpretation solely from changed opinion.
- **065 A / 066 B:** Player requests, but cannot directly edit, a judgment correction; verifiable original submission/factual error or material original misunderstanding qualifies, not later changed feelings.
- **067 A / 068 A / 069 A:** Uninvolved impartial Emperor/authorized admin reviews; approved correction supersedes/reopens pending for **player** resubmission, with no second extraordinary approval after normal qualification.
- **070 A / 071 A:** Replacement or late initial qualified judgment is evaluated at linked original incident historical position, retaining actual submission and correction dates in the audit (no fabricated submission timestamp).
- **072 A / 073 A / 074 A / 075 A:** Unanswered prompts private; qualified judgments league-visible and explicitly attributed; both players may submit separate perspectives and independently qualify directed effects, but counterpart cannot override victim Treachery judgment.
- **076 A / 077 A / 078 A / 079 A:** Chronicle-based directional reciprocity needs explicit track-relevant Relationship meaning **and** independently qualifying directed Battle conduct from the responding player in the **same linked Battle**; generic praise or prior Battle actions alone insufficient.
- **080 A / 081 B / 082 A / 083 A:** Qualifying judgments use compatible multiple **structured** choices (contradictory “betrayed”/“fair game” excluded), optional non-scoring free text, one binding submission per incident; each choice independently qualifies or pends.
- **084 A / 085 A:** Automatically reevaluate when required evidence arrives, subject to any required human review; definitive evidence failure is **Not Qualified** without effect, preserving statement.
- **086 B (explicitly supersedes earlier A) / 087 A / 088 A:** Definitively Not Qualified judgments are nevertheless league-visible, clearly labelled **“Not Qualified — No Relationship Effect”** with neutral source-supported explanation that exposes no restricted data. Pending submitted judgments stay private to author/authorized reviewers until qualification resolves; unanswered remain private.
- **089:** **Deferred, never approved** (public correction history).

These detailed Chronicle judgment/correction visibility decisions remain approved historical design decisions but **do not reopen the narrow, automatic-first Relationship V1 delivery scope**.

## Not approved / implementation boundary

No numeric weights, upward/downward thresholds, caps, reciprocity counts beyond approved Event limitation, contribution formula, final stage catalogue/maximum, pair-stage aggregation formula, final UI copy, migration, implementation acceptance criteria or activation has been approved. Do not import shadow-pilot numbers or its Treachery cap bypass as policy. No changes here to War Room adjudication, already approved SOC rules, or live systems.

**Status:** Documentation-only baseline, committed on the existing documentation/PR branch; no merge or release implied.
