# Age of Friends V1 — Chronicle as an Authored Historical Manuscript

> **Status:** #131 editorial design for owner review, **not an approved social rule or implemented writer**. Based on `main` at `c9c124f80fff9ebabbdec44bc69dc6e7d180ea1e` (17 October 2026).
>
> **One-line direction:** *The Chronicle writes with the restraint of a court annalist, the memory of a lifelong witness, and the evidentiary discipline of a ledger.*

## 1. Verified foundation and exact ownership fence

The current product already has unusually important guarantees. `functions/src/engines/playerChronicleCore.js` projects `AOF_PLAYER_CHRONICLE_V2` from qualified accepted social chapters, groups several Games into **one pair × league Battle**, retains source-beat and source-event references, and uses `AOF_PLAYER_CHRONICLE_V1` **entry ID identity** across prose revisions. `playerChronicleNarrative.js` builds prior-only family and contribution counts; it treats directed assistance in the correct direction, detects reciprocal prior Hostility before saying “quarrel,” requires at least two prior independent Reputation contributions for reputation colour, and limits ordinary compositions to five sentences. One qualified event is generally the primary, with at most one secondary, a diplomacy aside, a repeated-pattern sentence, and a social contrast.

Its strength is safety; its weakness is form. `episodeSentence` has a fixed rendering for each episode kind; `firstMeetingSentence` has four fixed forms; recurring duels, assistance and shared-opponent chapters almost inevitably repeat the same opening and qualifiers. Fixed titles such as “Again to the line” recur indefinitely. Repetition is not solved by changing random seeds.

The `replay-tools/chronicle_story_templates.py` catalogue is a **Python, read-only design preview for questions**, not the live JavaScript Chronicle writer. It has four gated V1 question families and additional **exploratory-only** themes; it is not an authority to generate new effects. The `chronicle_moment_design.py` module independently confirms these preview-only limits. `functions/src/queries/getPlayerChronicle.ts` strips internal `narrativeContext`, source IDs and shadow stages from player delivery. Existing `functions/tests/player-chronicle-core.test.mjs` and `player-chronicle.test.mjs` exercise source truth, grouping and determinism, with assertions tied to older exact phrases. Also noted for eventual factual-owner cleanup: the `playerChronicleCore.d.ts` declaration still names V1 while the JS exports V2. **Not changed here.**

**Source contracts:** [Chronicle book and V2 constraints](../architecture/player-chronicle-book-v1.md), [Worker 5 factual/testimony assessment](../research/social-v1-2026-10-17-worker-5-chronicle-reporting.md), issues [#122](https://github.com/Mathias-ao/League-of-Friends/issues/122), [#125](https://github.com/Mathias-ao/League-of-Friends/issues/125), [#128](https://github.com/Mathias-ao/League-of-Friends/issues/128), [#130](https://github.com/Mathias-ao/League-of-Friends/issues/130).

**File ownership:** #125 owns source admission, pending outcome, accepted revisions, pagination, core integration and stable entries; #128 owns selection, binding testimony and its sanitized DTO; #130 owns exceptional event eligibility/labels. #131 owns an isolated authored corpus, editorial grammar and a future *small* pure composition adapter. Do **not** edit `playerChronicleCore.js`, `playerChronicleNarrative.js`, query/read, testimony or inference modules in parallel with those workers. A coordination note was posted to #125. Its reply/accepted interface is still pending; this document must not be mistaken for an agreed shared-writer change.

## 2. Literary style guide — *The Ink and the Ledger*

The narrator is an attentive **league annalist**, not a god, sports commentator, prosecutor, fantasy bard, or friend ventriloquist. It has seen the league's older pages, not the minds of the players. Think a sober medieval manuscript whose rare illuminated leaf is earned by history.

| Element | Editorial rule |
|---|---|
| Voice | Third-person, past tense, spare and dignified. Historical verbs (“entered,” “returned,” “stood,” “was recorded”) are preferable to “crushed,” “dominated,” or “wanted revenge.” |
| Register | Plain intelligible English with lightly medieval words where apt: *banner, field, ledger, oath, crown, line, quarrel, reckoning*. Never constant “thus,” “lo,” “verily,” mock-archaic spelling, or fantasy lore. |
| Ordinary length | Prefer **two sentences, ~25–55 words** when enough evidence exists; three for genuinely contrasting context; four only when independent facts warrant. First overlap without an episode may be one sentence. |
| Exceptional length | Generally **three–four sentences, ~55–95 words**; one unusual image or memorable turn of phrase maximum, and only for rigorously qualified exceptional chapters. |
| Priority | Source truth → most distinctive supported fact → meaningful historical callback → at most one contrast. If no meaningful callback exists, stop. |
| Rhythm | Alternate subject-first, event-first, temporal and ledger constructions. Keep an event in one compact paragraph, with a separate attributed testimony inset when appropriate. Avoid fixed “It was not the first…” codas. |
| Headings | A few memorable titles are better than a parade of poetic synonyms. Exact exceptional rubrics require an approved event classification. Routine headings may stay simply *Battle recorded* rather than pretending ordinary play was legendary. |
| Humour | Very rare, dry and incidental. Never make a player's loss into invented comic humiliation. |
| Avoid | “The winds of destiny,” “the blood-red dawn,” “a glorious clash,” “the darkness grew,” “history would never be the same,” and poetry without a source-supported referent. |
| Perspective | Every story is on the **owner's private book**; objective language should remain equivalent from either player's point of view. Testimony is separately attributed, not made into a narrator's judgment. |

**Source-to-phrase firewall.** No writer may transform an order to transfer into received aid; a reinforcement command into an arrival or rescue; co-participation against an opponent into a planned joint attack; a military concentration into proven damage; a foundation command into a completed castle; a declared ally into an effective ally; a pending result into a win; a qualitative social inference into a motive; or an attributed statement into agreed fact. Effective alliance, king loss and responsibility are stronger only **after** the strict Treachery gates explicitly qualify them. New regular V1 inferred claims from #124/#126 may be narrated only with their *own* model, source, direction and confidence/coverage gates.

**Epistemic grammar, written in ordinary language:**

| Admitted proposition | Authorised expression | Do not write |
|---|---|---|
| Verified accepted result | “The accepted result favoured Beren.” | “Beren shattered Aldric's army.” |
| Result pending | “The official result remained unsettled.” | “The victory was disputed” without a recorded dispute. |
| Command-only reinforcement | “Aldric's reinforcement orders were directed toward Beren; the record does not establish their arrival.” | “Aldric reached Beren in time.” |
| Qualified defensive participation | “Aldric appears in the defensive episode around Beren.” | “Aldric saved Beren.” |
| Resource transfer *order* | “An order named 500 gold for Beren; receipt is not established.” | “Beren received 500 gold.” |
| Shared-opponent participation | “Both took part in the same engagement against Cato.” | “They coordinated the attack.” |
| Post-withdrawal offensive *attempt* | “After the withdrawal, Aldric directed an offensive attempt toward Beren's economy.” | “Aldric ruined Beren's economy.” |
| Geospatial / combat **inference**, if independently admitted | “The available positions suggest sustained pressure toward Beren's side.” | “Aldric razed Beren's base.” |
| Bound player interpretation | “In his Chronicle response, Beren called it betrayal.” | “Aldric betrayed Beren,” based on testimony alone. |
| Incomplete evidence | “This portion of the record remains incomplete.” | “Neither made a move against the other.” |

A sentence must carry an internal `claimType` and matching source binding even when neither is printed. Every optional adjective must be a guarded claim. “Defensive,” “forward,” “outmatched,” “decisive,” “recurring,” “reciprocal,” “exceptional” and “reconciled” are **not** decorative words: they need explicit evidence or attributed interpretation.

## 3. Storylet library: semantic parts, not shuffled synonyms

A storylet is a **versioned editorial unit** with eligibility, slots, forbidden implications and an opening identity. It must be possible to reject it before prose rendering. Each fact family receives a limited number of naturally different sentence shapes. We do not permute adjectives mechanically.

**Opening-shape bank for eligible *recurring* scenes** (eight per family; these are compositional *lead-ins*, not complete truth claims). First encounters use a separate bank; past-tense recurrence is used only with an independent prior Battle.

| Family | Eight distinct eligible lead-ins |
|---|---|
| Official duel / contest | “On this field…” · “In the renewed contest…” · “For this encounter…” · “Under the opposing banners…” · “The next official contest…” · “A further meeting…” · “In another accepted duel…” · “Across the latest contest…” |
| Defensive support | “At the threatened line…” · “A defensive episode…” · “When the fighting gathered…” · “In the same defence…” · “Beside the recorded pressure…” · “The defensive record…” · “From the support orders…” · “At this renewed defence…” |
| Withdrawn alliance mark + offense | “After the changed declaration…” · “In the aftermath of withdrawal…” · “The alliance mark was gone…” · “With the old declaration withdrawn…” · “Another hostile attempt…” · “The next turn in the record…” · “The ledger places the withdrawal…” · “Between the changed stances…” |
| Material aid orders | “In the resource ledger…” · “Another order of aid…” · “A recorded offer of resources…” · “From one player toward another…” · “The aid entry…” · “A subsequent resource order…” · “In this Battle's orders…” · “Resources were named in an order…” |
| Common opponent | “The same opponent drew both…” · “Within a common engagement…” · “Two participants met one foe…” · “In one engagement…” · “The record sets them both…” · “Against a shared opponent…” · “Both names appear in the engagement…” · “Along one contested front…” |
| Recorded diplomacy | “In the declarations…” · “The recorded ally marks…” · “Before the sides settled…” · “Their declared stances…” · “The entry names two declarations…” · “A later mark of alliance…” · “Across the diplomacy ledger…” · “The two stances were entered…” |

Each phrase's **guard matters**. For example, “another” requires earlier distinct-Battle evidence; “threatened line” requires an admitted defensive episode, not just a teammate; “alliance mark” is a declaration, not a verified effective alliance; “front” requires geographical evidence or otherwise falls back to “engagement.” A more specific compositor may choose from a narrower subset; never relax truth to satisfy diversity.

**Authored clause/scene patterns** for distinct real facts (also guarded by the same claim types):

- **First opposed:** “The first recorded field set {A} and {B} on opposite sides.” / “Their names first entered the league's shared account as opponents.” / “At {Map}, the first recorded Battle placed them apart.” (map must be known).
- **First allied:** “Their first shared Battle placed them beneath the same banner.” / “The league first recorded {A} alongside {B}.” / “In {Event}, their names first appeared on the same side.” (team alignment must be known).
- **Official result:** “The accepted result named {Winner}.” / “This result favoured {Winner}; the manner of victory is left to its sources.” / “{Winner}'s name entered the winning column.”
- **Duel:** “{A} and {B} completed an accepted official duel.” / “Another accepted duel brought {A} opposite {B}.” / “The pair returned to a formally accepted contest.”
- **Aid order:** “{A} placed an aid order of {Resources} for {B}; delivery remains unproved.” / “{Resources} was entered in an order from {A} to {B}, not as a recorded receipt.” / “The ledger names {B} as the intended recipient of {A}'s {Resources} order.”
- **Defensive action:** “{A} joined the qualified defensive episode around {B}; the outcome of that intervention is not established.” / “The defended player's name was {B}; {A}'s participation is present in the episode.” / “A defensive encounter around {B} also includes {A}.”
- **Reinforcement orders:** “{A}'s orders pointed toward {B}; the account does not establish their arrival.” / “The reinforcement commands went out toward {B}, though their execution is not shown.” / “The ledger preserves the direction of {A}'s reinforcement orders, not their eventual effect.”
- **Common opponent:** “In one qualified engagement, both {A} and {B} participated against {C}.” / “{C} was the common opponent in an engagement containing both names.” / “The same engagement placed {A} and {B} against {C}, without establishing cooperation by design.”
- **Withdrawal/offense:** “{A} withdrew the ally declaration toward {B}; a later offensive attempt was directed toward {B}.” / “The stated alliance ended in {A}'s declarations before the offensive attempt toward {B}.” / “What changed first was the declaration; the subsequent offensive attempt is separately recorded.”
- **Prior contrast:** “The previous qualified Battles placed them on the same side; this episode pointed the other way.” / “Earlier aid remains on the page beside this harder turn.” / “Their past included a one-sided antagonistic episode; this time the record contains directed help.” / “The pair had opposed each other before, but this Battle placed their efforts against a common foe.”
- **Official reversal:** “The previous accepted result favoured {B}; this one favoured {A}.” / “For the first time in their accepted head-to-head results, the winning name changed.” / “After {N} accepted results in one direction, the next went the other way.” (strict results-only and one Battle per count).
- **Uncertainty cadences:** “The orders survive; their arrival does not.” / “The command is recorded, not its completion.” / “The page records the attempt and leaves its outcome open.” / “The evidence supports the direction of pressure, not a verified destruction.” (each fixed to its admissible predicate).
- **Attribution:** “In a binding Chronicle response, {Speaker} described the incident as {PermittedChoice}.” / “{Speaker}'s recorded account regarded this assistance as meaningful.” / “{Speaker} reported that the old grievance had softened.” (only if that statement type is *approved* and bound; other participant need not agree).

The library above is **draft editorial raw material**. Some clauses are conditional future integrations, not executable content in current V2. In particular ordinary results/FFA/Military scenes depend on qualified DTO data not currently given to `writeBattleNarrative`; exceptional six-track titles depend on #130 eligibility and owner approval.

## 4. The composition contract

Proposed small, **pure**, editorial schema (fields illustrated, **not** a new authoritative event schema):

```ts
type ChronicleSceneInput = {
  entryId: string; // same stable value from #125; never recomputed by storylets
  battleId: string; pair: [string, string]; ownerPlayerId: string;
  prior: {
    priorDistinctBattleIdsByFamilyAndDirection: Record<string,string[]>;
    priorQualifiedTrackEvents: unknown[]; // only earlier, revision-consistent
    priorOfficialResults?: unknown[]; // only accepted, qualified, #125-owned
    previousOpeningIds?: string[]; // derive from prior entries, do not persist
  };
  facts: Array<{
    factId: string; kind: string; actorId?: string; targetId?: string;
    sourceBeatIds: string[]; sourceEventIds: string[];
    claimType: 'OBSERVED' | 'QUALIFIED_RECONSTRUCTION' | 'BOUNDED_INFERENCE';
    proofStatus: 'ADMITTED' | 'PENDING' | 'UNAVAILABLE';
    qualifiers?: Record<string,unknown>; // source-owned bounded semantics
  }>;
  result?: {status:'ACCEPTED'|'PENDING'|'UNKNOWN'; winnerId?:string};
  interpretation?: {speakerId:string; choiceId:string;
    status:'BOUND_QUALIFIED'|'BOUND_NO_EFFECT'|'PENDING_PRIVATE'};
  approvedExceptional?: {eventId:string; family:string; qualified:boolean};
};
type ChronicleSceneOutput = {
  rubric:string; title:string; paragraphs:string[];
  editorial?: {corpusVersion:string; selectedStoryletIds:string[]};
  // original entryId, source lineage, social receipts & result remain untouched
};
```

**Minimum composition sequence:**

1. Accept only #125's current, authorized, revision-consistent pair×Battle and its **already-qualified** source facts. Keep current one-entry identity/provenance and no duplicate POVs.
2. Canonically sort facts by trusted chronological/operation order then stable fact ID. Select one **primary** worthy of prose; an independent secondary may appear only if it adds a distinct truth, not another order within the same episode. Preserve current special priority for strict Treachery. Select one result context only when accepted or safely label pending. An invitation and its pending response are **not** narrative truth.
3. Compute all callbacks from earlier **distinct league Battles** (never current or future, never Games or commands), with direction and available coverage. A pair's current official stage belongs in the **header epigraph only**, not the older scene. Reputation evidence must be prior and longitudinal. Historical outcome callbacks require prior **accepted** results, not inferred victories.
4. Pick grammatical roles from the approved `fact.kind + claimType + qualifiers` matrix. Storylet variants have explicit guards; variants missing required facts are discarded. Keep a deterministic editorial fallback identical in meaning to the existing safe sentence.
5. Use `stableHash('AOF_CHRONICLE_PROSE_C1' | entryId | role | family | storyletId)` to rank **eligible** candidates; select the highest-ranked one not used in the preceding three *published pair* openings when at least four legitimate options remain. Stable tie-break on storylet ID. No runtime randomness, clocks, API calls, locale guesses or mutable “global recent prose” state. Selection proceeds oldest → newest so appending a later Battle cannot alter prior choices.
6. Form at most a fact sentence, an earned callback sentence and one optional contrast; suppress weak/duplicated codas. An exceptional scene may earn a restrained, **gated** metaphor. Attributed testimony is a separate labelled inset, never a free-text concatenation into the narrator's voice.
7. Return the existing `entryId`, date, title/rubric, paragraph array and all internal provenance without changing scores, source decisions, stages, or Game/Match result authority. Do not create an entry merely to use a nice sentence.

**Persistence and upgrades:** version the editorial corpus separately (`AOF_CHRONICLE_PROSE_C1`). Existing stable `entryId` stays constant. For a frozen corpus and unchanged facts/prior history, output is byte-for-byte stable on every read. Appending later Battles has no effect on older prose. A retroactive accepted source correction **may and should** recompose affected and causally later chapters, with internal revision logs and client correction treatment owned by #125. Adding a storylet into an existing candidate pool must **not** silently perturb old picks: freeze C1; new corpus C2 requires an explicit reviewed upgrade. Intentional prose upgrades may update text but **never** impersonate new history/ink by changing entry IDs. No content generation cache or new database write is required for V1.

**Distinction between motif and invented plot:** callback motifs are labels for factual continuity: *opposite banners → shared banner*, *earlier accepted loss → accepted reversal*, *unilateral hostile pressure → later directed support*, *declared ally → declared withdrawal*, and *aid order → repeated aid orders in separate Battles*. They are not claims about friendship, forgiveness, strategy, hatred, betrayal or “redemption.” Motif selection needs the same source checks as its underlying facts.

## 5. Eighteen realistic conditional sample scenes

**Fictional fixtures:** Aldric, Beren, Cato and others are illustrative league players, **not claims about actual members**. The named Maps/Events/outcomes are sample test facts. Every scene assumes the exact listed evidence is present, authorized and admissible. Items marked **future dependency** cannot yet be composed from current V2's writer input. They show what the style should do *after* #125/#124/#126/#128/#130 provide the necessary approved fact class.

### The same pair, seen across successive Battles

**01 — First ordinary 1v1 (accepted result; #125 future fact input).** *First names across the field*: “At Arabia, Aldric and Beren first entered the league's account on opposite sides. The accepted result favoured Aldric.” Nothing claims a rush, raid or skill judgment.

**02 — Their second 1v1; Beren wins (#125).** *The return*: “Their names met again under opposing banners. The earlier accepted result named Aldric; the new one named Beren.” A reversal in recorded outcome, not a motive or emotional reckoning.

**03 — Third 1v1; Aldric wins (#125).** *A contest without a single victor*: “A third accepted meeting put Aldric back in the winning column. In their three recorded Battles, both names had now appeared there.” Does **not** infer a level-three Rivalry or special event.

**04 — Fourth 1v1; result pending (#125).** *An unfinished line*: “Aldric and Beren returned to opposite sides. The official result for this Battle was still pending, and the Chronicle leaves its winner unnamed.” No retroactive change to #01–03.

**05 — An accepted official duel, same pair, fifth separate Battle (existing V2 kind).** *The formal contest*: “This time their contest was recorded as an accepted official duel. Earlier Battles gave the meeting context, but the duel entry alone makes no claim about who deserved the result.” This is not called an accepted duel unless the duel-specific semantic beat qualifies.

### Teams, common opponents and meaningful assistance

**06 — First shared 4v4, War for Lombardia; team alignment only.** *Beneath one banner*: “At Lombardia, Aldric and Beren first appeared in the record as teammates.” No unsupported interaction. A later team-only overlap creates **no new episode** by itself.

**07 — Another 4v4 with qualified Aldric → Beren defensive participation (existing V2 beat).** *At the line*: “Beren's defence was part of a recorded engagement, and Aldric also appears in that defensive episode. The account does not establish that his presence saved the position.”

**08 — A later 4v4, same direction of support in a second independent Battle.** *The line remembered*: “Once more a defensive encounter around Beren included Aldric. It was a second independently recorded Battle of such participation, though neither episode alone establishes a rescue.” The repetition belongs to two Battles, not two Games.

**09 — 4v4 with Aldric and Beren participating against Cato in the same qualified engagement.** *Against a common foe*: “Cato's name stood opposite both Aldric and Beren in one recorded engagement. Their shared opponent is clear; a coordinated plan is not.”

**10 — 4v4, a 500-gold transfer **order** Aldric → Beren.** *Gold entered in the ledger*: “An order entered 500 gold from Aldric toward Beren. The page preserves its direction and amount, but not a proven delivery.”

**11 — A later 4v4 with qualifying assistance after earlier **one-direction** Hostility evidence from Aldric → Beren.** *A contrary entry*: “Earlier Battles had recorded harder actions from Aldric toward Beren. This one placed Aldric within a qualified defensive episode around Beren instead. Whether the change altered their regard for each other is not written.” Never say “they reconciled” from the mechanics alone; never call a one-sided history “a mutual feud.”

### FFA, declarations, hostility, testimony

**12 — FFA, reciprocal ally **declarations** only.** *Two ally marks*: “In the FFA ledger Beren marked Aldric as an ally, and Aldric recorded the corresponding declaration. The marks are certain; no lasting or effective alliance is inferred from them.”

**13 — Later in the FFA, an ally declaration withdrawn and a separately qualified economic-target offensive **attempt**.** *After the withdrawal*: “Aldric withdrew the ally declaration toward Beren. Soon afterward a recorded offensive attempt pointed toward Beren's economy; whether it succeeded is not established.” This is a significant **candidate** for historical antagonism, not automatic Treachery.

**14 — FFA gold-control pressure, if #124/#126 admit an appropriately bounded directional **inference** (future dependency).** *The contested ground*: “The admitted map evidence suggests Aldric pressed for gold access on the side Beren was contesting. It does not establish who held the deposits or what either player intended.” Omit the whole sentence if terrain/resource/coverage qualification is insufficient.

**15 — After a third accepted loss to Beren, Aldric binds approved skill acknowledgment (#128 future dependency).** *The measure of a rival*: factual scene: “A third accepted loss to Beren entered Aldric's record.” **Separate testimony inset:** “Aldric acknowledged Beren's superior skill in his binding Chronicle response.” Neither the official result nor his answer independently proves any Rivalry stage change. Shown only under approved visibility.

**16 — Earlier recorded antagonism followed by support and **explicit** softened-grievance testimony (exploratory, NOT a V1 launch prompt).** *A quieter chapter*: “Their older pages contained a qualified adversarial episode; in this Battle, Beren appeared in a defensive episode around Aldric.” **Optional attributed inset, only if a later policy specifically approves that question and an answer is bound:** “Aldric reported that his earlier grievance had softened.” Without that testimony, do **not** call it reconciliation.

### Exceptional, rare, earned language

**17 — Strict objective Treachery gates qualify *and* the victim Beren gives the required binding “betrayed” judgment.** *The broken oath*: “An effective alliance between Aldric and Beren had ended. In the qualified sequence that followed, the loss of Beren's king was attributed to Aldric. The turning point entered their Chronicle beside the alliance it followed.” **Separate attributed inset:** “Beren described this as betrayal.” The event title/classification and any exceptional Hostility effect require the dedicated strict qualifier; a declaration change and offensive attempt alone are never enough.

**18 — Proposed Chivalry event, e.g. “The Shield at the Gate” (#130 proposal only, contingent on later approval/evidence).** *The shield at the gate*: “The admitted defensive evidence places Beren under unusually serious pressure, with Aldric's substantive assistance directed toward that position. Earlier records already showed help moving in the same direction; this Battle supplied a rarer, more demanding instance.” No “saved,” no proof of sacrifice or survival, and **no event is live until #130's gates are approved**. Exceptional title, visual ornament and longer prose only after the event truly qualifies.

The examples intentionally include unremarkable entries. A manuscript becomes credible because ordinary days are not given heroic language.

## 6. Before / after: fewer mechanics, more memory

These **before** texts are representative of present V2 output patterns; **after** entries require the same guarded source meanings, not looser proof.

| Current-style line | Suggested voice / what changes |
|---|---|
| “Their first shared page placed Aldric and Beren on opposite sides of the field.” | “Aldric and Beren first entered the league's shared record on opposing sides.” Still only an exposure fact; no false duel or winner. |
| “Aldric and Beren met in an official duel and carried it through to an accepted result. The contest had found them before.” | “Another accepted official duel brought Aldric opposite Beren. Their previous contest was already written on the preceding pages.” Repetition only from an earlier distinct accepted duel Battle. |
| “Aldric sent reinforcement commands toward Beren. The orders are certain; what reached the field is not.” | “The reinforcement orders ran from Aldric toward Beren. Their arrival is not established by the record.” Same uncertainty, varied rhythm. |
| “It was not the first aid order Aldric had directed toward Beren.” | “An earlier Battle also carried an aid order in that direction.” One independent-Battle callback; no claim of delivered help. |
| “It landed on a page that already carried an older hard turn.” | “The earlier pages recorded directed antagonism; this one set assistance beside it.” Use **only** if the current beat supports assistance, prior qualified Hostility is one-sided, and no stronger mutual interpretation is made. |

The point is not that the *after* line is always longer or more flowery. It is more specifically attached to the incident, its placement in the pair's history, and the allowed strength of the source.

## 7. Repetition risk: quantified and honestly bounded

**Static baseline:** in present `episodeSentence`, 50 indistinguishable successive official-duel beats for the same pair produce the same primary episode sentence on each eligible chapter; **49/49 adjacent transitions repeat that exact sentence** (ignoring first-overlap lead-in), even though the secondary pattern clause changes after the first. Likewise 50 otherwise identical support episodes of one subtype reuse the same episode sentence 49/49 times. Current title diversity is even lower: recurring support gets one fixed headline after first occurrence.

**Exploratory synthetic C1-selection benchmark (not a repo test, not a claim about current runtime).** Using the **eight lead-ins per family in §3**, FNV-1a-style stable 32-bit ranking from family, distinct synthetic Battle ID, and suppressing the last **three** selected opening IDs, the following fixed synthetic sequences were evaluated on 17 October 2026:

| Synthetic one-pair sequence | Distinct lead-ins | Adjacent identical lead-ins | Largest reuse of one lead-in |
|---|---:|---:|---:|
| 100 successive official-duel entries | 8 / 100 | **0 / 99** | 14 |
| 100 successive support entries | 8 / 100 | **0 / 99** | 14 |
| 120 evenly alternating six families | 45 / 120 | **0 / 119** | 5 |
| 120 bursty grouped-family entries | 40 / 120 | **0 / 119** | 8 |

This measures only **opening diversity in a proof-of-concept picker**, not finished literary quality, proof coverage, complete sentences, or actual production performance. Eight variations still lead to heavy **non-adjacent** reuse during 100 semantically identical incidents. It would be dishonest to claim 100 original historical moments from 100 identical low-information inputs. Treat repeated same-type episodes concisely, prefer new objective differences, and keep the first and exceptional turning points more distinctive. No trivial random adjective lists. A full writer must be tested on **real accepted event distributions** and source-safe eligible-subset sizes; when a narrow fact admits only one truthful clause, truth wins over the diversity target.

**Proposed post-implementation checks:** report overall and per-family duplicate full sentence rate, repeated *first 5-word* opening rate, adjacent opening and finite-window repeats, duplicate title rate, mean/p95 word count, number of empty/over-claim paragraphs, and cost. Targets to validate (not approvals): **zero adjacent exact opening repetition where ≥4 safe opening shapes exist**, no exact paragraph duplicates in a three-entry local window where there are multiple safe shapes, ≤4 sentences in ordinary prose and no runtime external AI calls. A global target of “zero repeated phrases ever” is impossible without endless artificial copy and therefore rejected.

**Cost:** deterministic local text assembly, fixed small candidate banks (typically 4–8), a small stable hash and recent-three history, and data already selected for the Chronicle. **$0 per-entry third-party generation fees**, no token usage, no model service or network dependency. Computational marginal cost is approximately `O(entries × eligibleStorylets)` on top of existing projection, with bounded constant banks; #125's source paging dominates server cost. Benchmark latency empirically after an implementation exists; no fabricated millisecond claim.

## 8. Test and review matrix

**Tests for the later implementation PR** (existing test files remain untouched in this docs PR):

1. **Truth by family:** property/table-driven forbidden phrases and permitted proof levels for aid order, reinforcement orders, defensive participation, common-opponent involvement, accepted duel, qualified offence, declaration vs effective alliance, source-qualified Treachery, future inferred pressure, pending result and bound testimony.
2. **History scope:** append a Battle and assert earlier entry IDs and prose stay byte-for-byte equal; reorder input chapters and assert same output; insert a correction before Battle 3 and assert only affected and historically downstream contextual prose may change. The owner-only current epigraph must not leak into old incident prose.
3. **Distinct-Battle discipline:** five same-kind beats or three Games in one Battle still count as one prior episode. Direction A→B never equals B→A. One-sided Hostility may read “earlier hard turn,” **never** “mutual quarrel.” Repetition requires an earlier independent qualified Battle.
4. **Deterministic editorial selection:** stable across repeated reads, process restarts, different orderings of equivalent source maps, Unicode names, special punctuation and no `Math.random`; C1 corpus is frozen; adding unrelated later facts cannot change earlier picks.
5. **Long-history analysis:** run ≥100 same-family and ≥100 mixed-family chapter fixtures, plus adversarial narrow-eligible variants. Measure exact openings, 5-word prefixes, verb overuse, titles, paragraph duplicates, mean and p95 lengths, and render time. **Do not** make diversity checks fail by requiring unsupported claims.
6. **Result safety:** pending ≠ loss; official result must not be inferred from combat; third loss must mean three separately accepted Battles. Corrections and withdrawn READY sources remove obsolete factual claims; duplicate POVs never double-count.
7. **Exceptional events:** six newly proposed tracks remain **disabled** until approved input event classifications exist. Strict Treachery must pass the exclusive objective and victim-binding gates and cannot become a generic “betrayal” adjective. One exceptional treatment per legitimate event; duplicate source observations do not multiply headings.
8. **Testimony:** pending private/declined/undecided do not enter public narrative; qualified or definitively not-qualified structured responses are attributed to their authenticated speaker under approved visibility; never promote a response to an objective deed or silently assert reciprocal feelings.
9. **Sanitization/security:** no unescaped raw submitted text blended into HTML, no private testimony or shadow contribution leaks into a public DTO, and no actor/counterpart name confusion on reverse book views. The private book remains owner-authenticated.
10. **Regression snapshots:** refresh existing phrase-specific assertions only after reviewers check their **semantic** invariant. Snapshot fixtures retain stable `entryId`, chronological ordering, source IDs, ordinary first-leaf behavior, reduced prose, and one entry per pair×Battle.

Human editorial gate: reviewers see ten consecutive same-pair chapters as one page (not isolated sentences); at least a 1v1, 4v4, FFA, support, hostility, reversal, unconfirmed aid and Treachery leaf. A reviewer marks every dramatic word's factual or attributed justification and reads the page aloud to detect generic rhythm.

## 9. Bounded PR plan and explicit decision register

**This branch/PR (#131 design submission):** **documentation only**, one new file. It does not edit writer, Chronicle core, query, UI, evidence model, scores or flags and carries no activation.

**After owner/editorial review and interface acknowledgment:**

- **Narrow composer PR:** add `functions/src/engines/playerChronicleStorylets.js` (pure C1 authored corpus and guarded selector), and only the smallest agreed `playerChronicleNarrative.js` integration with semantic fixtures. Existing source/progression and public schema untouched. Preserve old safe fallback when an eligible storylet is unavailable. Tests in `functions/tests/player-chronicle-core.test.mjs` plus a focused new `functions/tests/player-chronicle-storylets.test.mjs`; run build/typecheck, existing Chronicle tests and source-truth acceptance.
- **Later integration, not part of the composer PR:** #125 exposes accepted/pending result and correction-safe historical context; #128 exposes attributed binding testimony and visibility; #124/#126 expose bounded inferred source-backed social claims; #130 supplies *approved*, fully qualified exceptional event classifications. Integrate each under its owner and separate tests, rather than inventing them inside the writer. #132 owns multi-user acceptance and launch activation.
- **Non-goals:** no runtime LLM, external AI API, scorer, change to relationship/reputation thresholds, new honor entitlement, additional optional invitations, Story Engine rewrite, private/free-text display, UI redesign, release flag, staging test, deployment, or main-branch merge.

**Owner decisions needed before a code PR:** (a) approve the court-annalist register and word budgets; (b) approve selected lead-ins after native-speaker copy edit; (c) approve how eligible exceptional family names arrive from #130 (none presumed live); (d) agree a minimal contract with #125 for accepted/pending results, stable chronology and re-rendering after correction; (e) agree whether testimony is exclusively an inset owned by #128 (recommended); (f) accept C1 corpus freezing + explicit reviewed future version bumps. No new numeric social progression, rarity thresholds or territories are specified here.

**Acceptance definition:** a reader recognises the real pair's actual history and meaningful reversals, not a story-generator’s tricks. The Chronicle remains true when the source is weak, eloquent when its history is rich, and exceptional only when the event has earned it.


## 10. Organiser 2 review response and first isolated C1 implementation (17 October 2026)

**Review status:** Organiser 2 recommended, but did not formally approve, the restrained annalist voice and low-cost C1 direction. See [draft design PR #134](https://github.com/Mathias-ao/League-of-Friends/pull/134). This section records the requested fact-grammar tightening and subsequent narrow implementation. It does not grant launch activation or alter earlier draft candidate predicates.

**Worker 5 interface acknowledgment:** Issue [#125](https://github.com/Mathias-ao/League-of-Friends/issues/125) explicitly supplied the stable read-only scene seam at factual draft [PR #136](https://github.com/Mathias-ao/League-of-Friends/pull/136): one pair × Battle, qualified ordered beats, deterministic SHA-256 scene ID and stable entry ID, result status (OFFICIAL or UNRESOLVED), chronology qualification, internal-only source lineage. A #131 consumer-side agreement was posted to #125. Source admission, correction, ordering, result qualification, paging and privacy remain exclusively #125's responsibilities; #128 still owns testimony. **#136 remains draft/unmerged at this checkpoint**.

**Scope delivered:** [stacked draft PR #140](https://github.com/Mathias-ao/League-of-Friends/pull/140), based exactly on #136's branch, changes only (1) new pure playerChronicleStorylets.js, (2) a narrow call in playerChronicleNarrative.js, and (3) one focused test file. No changes to playerChronicleCore.js, source/query/pagination, prompt selector, privacy DTO, scores or stage rules. No deployment or runtime AI. #134 remains docs-only.

**Extra truth/guard adjustments prompted by review:**
- No “the same opponent drew both” or implied joint plan: only an admitted same-engagement, common-opponent participant fact is written, with explicit separation from coordination.
- Defensive prose and titles depend on admitted DEFENSIVE_PARTICIPATION. **Reinforcement commands** instead receive an orders-specific sentence/title bank; they cannot acquire the title “a familiar defence” or claim reinforcement arrival.
- Accepted official-duel storylets require the existing ACCEPTED_DUEL_CONTEST beat. A scene with an UNRESOLVED result is not upgraded into C1 duel wording by the composer.
- Ally declaration and effective alliance remain separate; the exceptional Treachery beat and its dedicated king-loss semantics **do not enter C1 variation**.
- A material-aid order with no positive supported resource quantity falls back to the existing conservative writer; any aid wording says **order**, not receipt.
- Post-withdrawal offence remains an **attempt**, not a kill, accomplished damage, effective alliance breach, motive or successful attack.
- No claim is invented to satisfy repetition targets. C1 only selects a variant after at least **two earlier distinct qualified Battles** in the same qualified family and direction where applicable; the original safe writer remains authoritative elsewhere. The standing epigraph, player perspective and source eligibility are not touched.
- Repeated certainty disclaimers remain a possible editorial weakness and are deliberately not “solved” by dropping uncertainty. Later copy editing should make these clauses more graceful while retaining the same proof ceiling.

**Complete prose measurement from actual GitHub Backend CI, commit 1850524d (not the earlier preliminary opening-only simulation):**

| Fixture | Entries | Distinct complete paragraphs | Distinct titles | Distinct 5-word openings | Adjacent exact paragraph / title / 5-word opening repeats | Maximum reuse of one full paragraph |
|---|---:|---:|---:|---:|---:|---:|
| Same pair, 100 successive accepted duels | 100 | **34** | 6 | 9 | **0 / 0 / 0** | 4 |
| Same pair, 100 qualified directed defensive episodes | 100 | **34** | 6 | 10 | **0 / 0 / 0** | 4 |
| Same pair, 120 mixed duel/support/aid/common-opponent/withdrawal/reinforcement episodes | 120 | **114** | 28 | 38 | **0 / 0 / 0** | 2 |

Each metric is computed over the **complete projected paragraph text**, not only the opening selector. All three scenarios pass whole-paragraph dedup checks. The 10-consecutive-Battle fixture covers opposed 1v1 context, locked teammate/4v4-style context, open-diplomacy/FFA context, reverse-directed assistance, changed evidence and a late corrected source, without a new social invitation. Correction tests assert stable entry IDs, byte-identical earlier unaffected scenes after appending a future Battle, and properly recomposed later context after earlier-source correction. Multiple Games within one Battle remain one independent incident for repetition.

**Exact validation:** GitHub Actions Backend CI on [PR #140](https://github.com/Mathias-ao/League-of-Friends/pull/140), commit 1850524d: type-check and build successful; **395/395 backend Node tests passed**, zero failed. This includes the new composer suite and existing Chronicle regressions. The figures come from an actual CI log, but the inputs are controlled fixtures; this is **not** a claim of production long-history coverage, editorial acceptance or release verification. In 100 near-identical Battles, reuse is inevitable and C1 openly reports it instead of adding synthetic heroism.

**Next review gate:** approve the actual prose banks with the owner, await #136 branch merge and preserve stacking/merge order, then use #132's independent multi-user, source/correction, access-control and release-gate acceptance before any activation. Do not present approval of the literary direction as approval of all six exceptional classifications, player testimony semantics, numerical progression, or this implementation's release.
