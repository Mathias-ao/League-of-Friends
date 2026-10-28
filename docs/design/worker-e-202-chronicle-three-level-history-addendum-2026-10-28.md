# Worker E — Chronicle three-level hierarchy, source truth, and owner experience

**28 October 2026, follow-on addendum for #200, #202, #195, #205.** The complete #187 original-assignment baseline was published **first** in this branch, exact commit 9d28de21604e36bf722818e58f9aabe120f41d7d, linked at issue #187. That initial handoff contains 15 existing source-ID candidates, five before/after passages and two rare longer variants. This addendum responds to newer owner decisions. Design-only, not a production code edit or source/score approval.

**Verified main:** 1b5711006e70ff0e13b219cd11bbc82a37605706.

## 1. Audited reality and the player-facing correction

Accepted playerChronicleCore.js currently groups all source-admitted pair exposures but emits an entry only for the first Battle or a Battle with source beat, Reputation mark or Relationship mark (lines 220–228). A later authentic ordinary encounter with no special social event can vanish. Removing the filter without changing prose would instead create verbose, repetitive full chapters. **Neither is the owner's intended player experience.** Each admitted pair×league Battle should have one concise factual ledger presence; selected meaningful developing history and independently qualified extraordinary deeds earn longer ink.

The same sceneId must remain stable across prose, correction and multi-Game revisions; legacy beat-derived entryId stays compatible with Sol's owner-specific append-only read migration. A later Battle cannot rewrite the factual knowledge of an earlier page, but a correction to an earlier source may require recomposition of later callbacks. The current sceneRevision hashes the current Battle's source/status and does not fully capture earlier-context dependency: any future display revision must model a prior-history presentation digest without renaming sceneId or causing false unread ink.

Sol's accepted Book uses owner-scoped pair leaves, a self leaf, sanitized paragraphs and stable sceneId. Worker 5 owns factual source admission and #195 author meaning. #139 is the sole scorer. E proposes editorial projection, not changes to those owners' code in this design PR.

## 2. Exactly three presentation levels, not social stages

| Priority | Level | Qualification | False claim to reject | Expected density |
|---|---|---|---|---|
| 1 | EXTRAORDINARY_CHAPTER | Externally qualified, owner-approved exceptional incident ID plus every event-specific source/provenance/earlier-history gate; the incident appears ONCE in the existing pair Battle scene | Raw raid count, dramatic title, Event spotlight, temporary current record, source-pending aid, unbound subjective belief | Three to five restrained sentences and one special rubric |
| 2 | DEVELOPING_HISTORY | Present source-admitted meaningful directed conduct PLUS genuinely related evidence in earlier **distinct** pair Battles, or independently accepted result reversal or stage development; include only proven historical changes | Same opponent twice with no meaningful deed; two Games/POVs; same team assignment alone; detected home pressure as proven hurt; rating upset as hatred | Two to four distinct sentences, not every rematch |
| 3 | ORDINARY_LEDGER | Current, authenticated, source-accepted pair×Battle participation or opposition, even with no special beat/marks or pending winner | Unaccepted source, unsupported interaction, fabricated winner, false peacefulness from missing telemetry | One short factual line, typically 8–22 words |

**Precedence is extraordinary > developing > ordinary, but never a rule for awarding points.** All accepted relevant Battles have exactly one scene ID. One originally source-linked event may be referenced across Statistics, independently approved social effects, Battle/Event spotlights and Chronicle, without causing multiple chapters, achievements or honours. First Fast Castle, PB, current Season record and mature trophy chiefly belong to the separate personal self leaf. Their presence alone does not inflate a pair scene.

**Source classes:** O accepted roster/schedule/Match result; R recorded current-source command/statistical value; I method-approved bounded inferred behaviour; H independently accepted earlier historical Battle/source event; E separately qualified rare event ID; J authenticated author-owned private perspective. An R request is not completed effect; I conduct is not physical outcome or motive; J cannot establish combat, recipient receipt or reciprocal action; E cannot be inferred inside the writer.

**Narration algorithm:** (1) Worker 5 admits one canonical pair×Battle source and chronology, grouping all Games and active POVs; (2) preserve stable sceneId and all legitimate facts; (3) project one ordinary factual line; (4) replace that line with developing C1 prose only on actual H + current qualifying claim, or with extraordinary copy only on external E; (5) keep one canonical row with optional marginal factual references, never duplicate a chapter; (6) recompute source-dependent text and later history after corrections while preserving seen identities. Missing official result withholds the result clause, not valid participation.

## 3. Twelve ordered fictional examples across modes

All examples are **hypothetical, not observed league recordings**. They are proof-dependent templates, not statements the current composer has already emitted. Distinct B numbers mean distinct authenticated canonical league Battles; arbitrary map/civ changes do not split longitudinal social history.

| Battle | Required witness | Tier | Proposed source-safe copy |
|---|---|---|---|
| B01 1v1 | A/B opposed on Arabia; Match result UNRESOLVED | Ordinary | “Aldric and Beren first appeared opposed on Arabia; the official Battle result is pending.” |
| B02 1v1 | Later Battle, accepted B winner, no social beat | Ordinary | “Aldric and Beren met again; Beren held the accepted Battle result.” |
| B03 two-Game 1v1 series | Canonical parent Battle/ordered Games, A→B pressure commands, no independent earlier pair counterpressure | Ordinary | “In their two-Game Battle, Aldric's orders pressed toward Beren's position.” |
| B04 1v1 | Separate B→A and A→B contest episodes across genuine earlier and current Battles; current official A winner | Developing if all independent proof | “Their contested ground returned in a separately recorded exchange. Aldric held the accepted result; the ledger does not assign a personal grievance.” |
| B05 4v4 | A/B fixed teammates; no directed participation | Ordinary | “Aldric and Beren took the same side in a team Battle.” |
| B06 4v4 | C→B qualifying home pressure and A→B separately admitted defensive participation; prior pair contests H | Developing | “Aldric joined a recorded defensive episode around Beren. Earlier Battles had set them opposite one another; this record does not claim a rescue.” |
| B07 FFA | A→B ally declaration then withdrawn command, effective alliance unknown, winner pending | Ordinary | “An ally declaration toward Beren was entered and later withdrawn by Aldric; the result is pending.” |
| B08 FFA | A/B same independently qualified engagement against C | Ordinary unless earlier related participation exists | “Aldric and Beren appeared in the same engagement against Cato; a coordinated plan is unproven.” |
| B09 1v1 | Meaningful current and prior genuinely distinct counterpressure deeds in both directed actor roles | Developing | “An older contested exchange found a separate successor in this Battle. Each direction of pressure must stand on its own evidence.” |
| B10 team | B→A beneficiary defensive participation; B06 earlier A→B qualified support | Developing; not automatic Bond stage | “A former page had placed Aldric in defence around Beren. In this Battle Beren appeared in a separate defence around Aldric; the direction had changed.” |
| B11 1v1 | Different civ/map, verified roster, result UNRESOLVED, no special deed | Ordinary | “They met again on different ground; no official winner is yet recorded.” |
| B12 4v4 | Independently approved/qualified E-CHI-01, C→B home threat, A→B specific help, valid past pair history | Extraordinary only if external receipt | “Where Cato's qualified pressure reached Beren's home, Aldric participated in the defensive encounter. Earlier leaves recorded both contest and shared defence. The rare heading is permitted only after independent qualification; the account does not call the city saved.” |

An ordinary aggressive 1v1 does not automatically earn Hostility; an FFA declared ally mark does not establish effective alliance; an apparent defensive reinforcement order does not prove arrival. Each source-inapplicable statement is omitted while the valid Battle log remains.

## 4. Five-Battle proof of historical density and corrections

One owner/counterpart, five independent canonical Battles:

| Battle | Accepted factual input | Current state | Owner-desired scene |
|---|---|---|---|
| H1: routine 1v1 | First opposing pair encounter; result pending | First entry, longer generic wording | **Ordinary:** “They first met as opponents; the Battle result is pending.” |
| H2: routine 1v1 | Accepted distinct pair exposure; official B result; zero beats/marks | **Incorrectly omitted by current core** | **Ordinary:** “They met again; Beren held the accepted result.” |
| H3: developing rematch | Two accepted Games, one Battle; source-qualified current A→B position pressure; **H2 officially won by B and H3 officially won by A** in distinct accepted aggregate Battles | One existing C1 chapter | **Developing from verified reversal:** “The accepted result changed hands across separate Battles, this time to Aldric. Source-linked pressure toward Beren's position entered the present record; no motive or reciprocal attack is inferred.” If either result pending, one-line ordinary log |
| H4: uncertain FFA | A→B ally declaration, unknown effective state, pending result | Diplomacy-oriented full passage | **Ordinary:** “Aldric entered an ally mark toward Beren in an FFA; the result remains unresolved.” |
| H5: rare team defence | Independently attributed C→B threat plus A→B defensive episode; prior relevant pair history; hypothetical separately approved E-CHI-01 | Ordinary source participation in current writer | **Extraordinary ONLY IF E receipt exists:** “As Cato's pressure reached Beren's home, Aldric entered the qualified defence. The pair's older pages had found them both opposed and alongside one another. The source record speaks of participation, not a proven rescue.” Otherwise developing/ordinary |

**Required density:** 5 admitted Battles = 5 stable sceneIds, of which three modest logs, one developing chapter, one exceptional chapter **only on E-qualified hypothetical path**. H3 has two Games but one scene. H2 is currently omitted, so this is a **target regression that presently fails**, not a claimed passing CI result.

**Corrections:** (i) H2 official result reversed/pending: withdraw B winner while retaining the valid H2 ledger; (ii) H3's earlier-result reversal callback now becomes false if H2 result changes or H3 result is pending: recompose/downgrade while retaining genuine present pressure; (iii) H5 E event no longer qualifies: remove exceptional rubric while keeping valid A→B defence evidence; (iv) all H1–H5 sceneIds stay fixed, prior seen IDs preserved, and scene revisions/content reflect reanalysis. Revised source is not a brand-new Battle.

## 5. Self leaf, record prestige and separate accomplishments

- First independently qualified Fast Castle Age completion earns a personal milestone **when actually earned**, not a pair story or proof of constructed Castle.
- Comparable private PB improvement revises the personal self leaf. Unusual Nomad/Migration/custom starts need the **relevant** specific opportunity comparator; do not reject ordinary cross-civ/map history universally.
- Temporarily fastest Season Castle age time is a mutable current-record note, **not** a permanent early trophy. An approved historic trophy requires both absolute performance and mature Season competition gates from Worker C.
- Battle/Game and Event Roundoff cards occur on their own surfaces. A large Event raid SUM, APM or “The alliance supplied” tribute **request** does not justify a second Chronicle chapter or claimed delivered help.
- Separate approved mature record/distinction can receive one factual self-leaf entry and an optional cross-reference to an existing source Battle/scene; never three earned rewards for one underlying incident.

## 6. Epigraph: the narrator must not invent how another player felt

Accepted PlayerChronicleBook.tsx relationshipEpigraph contains “grievance”, “quarrel”, “enduring wounds”, “harder to call courteous”, and “what binds them” selected by track stages. These are possible literary *emotions and morality* rather than automatically observed historical conduct. The current publication path is gated; this is a **pre-activation player-experience risk**, not a claimed live false allegation.

| Current implied phrase | Unsupported nearby claim | Safe source-gated substitute |
|---|---|---|
| “enduring wounds” | Another player remains hurt or nursing a grievance | “Several separate contests are recorded in these pages” only if independent H contest episodes actually exist; otherwise one neutral leaf header |
| “harder to call courteous” | Legal forward/offensive strategy is discourteous | “Later pages record independently attributed pressure toward the same counterpart” only when source admitted |
| “the contest ... grievance” | The recipient *felt* wronged | “The record includes contest and directed pressure” only with both evidence types; felt grievance only if speaker-authored, private |
| “what binds them survives” | Both feel reciprocal trust/affection | “An earlier Battle contains source-linked assistance directed to this player” only when true |
| “betrayed”, “hatred”, “feud” | Effective alliance, motives, or mutual emotion | Withhold objective term absent strict event gate; show private attributed testimony separately, never as the narrator's finding |

**Recommended default header:** “These pages follow their recorded league encounters.” Optional source-typed historically specific epigraph only when actual independent receipts and history substantiate it. Sol owns UI text and its acceptance tests; Worker E supplies grammar/negative cases without editing UI.

## 7. Two authors interpret the same objective source differently (#195)

Shared objective fact: one independently admitted Battle with A→B directed position pressure and (if genuinely supported) a separate B→A neutral counter. Both owners' factual text must preserve precisely the same **qualified directed conduct**. If the position is not independently established as B's home, do not call it a home invasion.

- **Aldric's author-private view of Beren's B→A counter:** “I experienced Beren's challenge as a demanding but fair contest.” Label **Aldric — personal perspective (private)**. This says nothing about whether A's own A→B pressure was reciprocated in fact.
- **Beren's author-private view of Aldric's A→B conduct:** “To me that pressure felt personally hostile; I cannot know why he chose it.” Label **Beren — personal perspective (private)**. This may inform a **source-gated B→A experienced interpretation** if separately owner-approved, not Aldric's intent, successful harm, or B's retaliatory deed.
- **No response, defer, decline:** no author marginalia, no sanction, automatic independently qualified source progression unchanged. Routine 1v1 normally gets no invitation. At most one offer per respondent×Battle and three subsequently eligible-Battle cooldown are Worker5 #179/#180/#195 rules, not prose triggers.
- **Source correction:** withdraw A→B pressure evidence; revise objective narrator and mark Beren's linked subjective response stale/pending re-review privately. Never publish the quotation or continue using it as a factual public claim.

Compare choices: A marginalia-only is too disconnected from the owner's intended *experienced* Rivalry/Hostility paths; recommend **B source-gated, author-owned interpretative emphasis only after separate approval**, never automatically affecting #139 numerical tracks. Reject C mandatory perspective prerequisite for high stages as punishing silence. Stage3+ reciprocity always requires independently qualified opposite actor conduct; effective FFA alliance/Treachery requires its own strict proof.

## 8. Reader presentation decision: prefer A, not two story objects

**Choose A: one immutable source-anchored scene per accepted pair×Battle with conditionally compact or expanded presentation.** Ordinary one-liners are scannable in the same chronology. Developing and extraordinary entries expand in place, with their existing sceneId, no separate unseen notification and no duplicate exceptional praise. Preserve owner self leaf and pair bookmark rail, legacy IDs/scene seen migration and private author marginalia. Optional chronological collapse of old ordinary rows may help scanability but cannot hide or delete legitimate entries from the historical ledger.

**Reject B** separate full Battle timeline plus extra cross-Battle relationship chapter object for V1: duplicate facts and identities, new correction/migration complexity and disproportionate UI work. C another novel architecture is unnecessary.

**Revision nuance:** Current accepted sceneRevision hashes the current source; an earlier Battle's correction may alter later prior-only narrative without changing the later current-source hash. Future source-aware **presentationContextDigest** can version revised prose without altering stable sceneId or marking it new ink. Worker5 must accept this contract; Sol UI reads stable sceneId rather than revision as unread identity.

## 9. Eight adversarial cases and precise expected outcomes

| Test | Positive expectation | Nearest false positive blocked |
|---|---|---|
| T01: five quiet Battles | Five canonical pair scenes and brief factual ledger lines | Current core drops later beatless Battles; never invent social marks to force presence |
| T02: winner pending | Valid READY pair log appears, no victory sentence | A Game winner in BO3 is not an aggregate Battle winner |
| T03: cross-map/civ and two Game series | Cross ordinary contexts longitudinal; two Games still one Battle and one callback opportunity | Exact map/civ partition or duplicate POV does not inflate/destroy pair history |
| T04: reverse assistance | A→B earlier and B→A later each have independent qualified source deeds | One-sided commands do not imply actual delivery, rescue, reciprocity or stage3 |
| T05: author disagreement | Objective source narration identical; two different private labels only | Felt hostility cannot become a public accusation or objective harm |
| T06: silence/cooldown | Routine 1v1 no prompt, decline harmless, rare 1 offer/respondent/Battle and 3 eligible-Battle cooldown | One multi-Game Battle cannot create multiple opportunities |
| T07: correction/seen migration | H2 source revised and H3 callback corrected; same scene IDs, old seen state | Revised prose is not a new Battle or future knowledge on older page |
| T08: rare downgraded/record | H5 rare qualifier removed; qualified support sentence stays; personal PB/early record revised separately | Temporary record/spotlight cannot confer permanent rare history |

These are **test specifications**. The existing core currently fails T01 and would generate longer generic prose on beatless rows if its filter were removed alone. Do not label these accepted CI tests without implementing the thin projection and genuine source integration.

## 10. Two narrow, nonoverlapping future PR cuts

**E1 Worker E, source-only editorial selector + narrow approved projection hook.** New pure deterministic tier/compact phrase selector consumes *already accepted* canonical pair×Battle sources and independently approved event identifiers; it does not change qualification, score, award, parser or question eligibility. A narrowly reviewed core emission change is needed so every current-source pair×Battle group emits a scene even without beats/marks; coordinate Worker5's factual authority and Sol's sanitized DTO allowlist. Tests: five-Battle ledger, 1v1/team/FFA, two Games/POV, pending result, revision and historical callback, stable sceneId/seen migration, privacy and no invented claim. Existing C1 prose remains for meaningful scenes.

**S1 Sol Book presentation/epigraph correction.** Read-only compact ordinary rows vs expanded developing/exceptional in one column; neutral/emotion-safe epigraphs; owner-private attributed experience remains Worker5 controlled. Sol owns existing PlayerChronicleBook and shared type paths, preserving #179/#180/#181 protected work. Test real React/JSDOM migration, downgrade, corrected prior callback and author-private vs narrator grammar.

No live staging, runtime LLM, scorer or award changes. Worker D's six E IDs remain proposed unless independently admitted and owner-approved.

## 11. Three simple owner choices (recommended)

1. **Yes:** Every source-accepted relevant pair Battle gets one brief ledger presence, even when result pending or no distinctive deed exists.
2. **No:** Relationship stage alone does not justify claims of emotions, grievance, personal blame or discourtesy in the annalist's voice; reserve felt interpretation to private, clearly attributed testimony.
3. **One scene, conditionally expanded:** preserve stable pair×Battle identity with a richer rendition for genuinely developing history or extraordinary actual deeds. No automatic extra story, question, trophy or effect.

**Outcome:** a complete quiet Battle ledger, a meaningful selective social history, and rarely illuminated extraordinary chapters, all traceable to source and corrections.


## 12. Reproducible five-Battle reference tests and status

The adjacent **synthetic** JSON fixture (worker-e-202-five-battle-fixture-v1.json) and standalone executable JavaScript reference (worker-e-202-five-battle-design.test.mjs) encode the exact five-Battle scenarios, externally supplied **test-only** rare receipt, source correction and tier downgrade. Any hypothetical DIRECTED_POSITION_PRESSURE descriptor is a **design-only witness shape**, not an existing production-qualified Chronicle beat kind and not permission to publish that language. The E receipt is an injected synthetic external qualification and must not be inferred from the presence of an event ID.

**Execution evidence, 28 Oct:** eight of eight isolated source-fetched JavaScript reference assertions passed through the execution runtime, including the accepted current filter's four-of-five omission, desired five-of-five, a two-Game Battle counting once, correct pending winner, result correction downgrading the dependent historical chapter, scene-key identity retention, external-rare receipt withdrawal and no private testimony in objective output. The reference file is authored as a Node built-in test and can be run from the repo with: node --test docs/design/worker-e-202-five-battle-design.test.mjs.

**Honest limitation:** these eight passed *reference-model* checks **do not** mean the accepted core has been repaired, that Node repository CI ran, that an authentic original produced any exceptional event, or that Sol's real Book changed. The source-code-confirmed product bug remains open until an E1 PR uses the accepted factual admission contract and passes backend plus real Book/correction/privacy integration. This document's exact git revision/CI should be reported separately from any future code PR.
