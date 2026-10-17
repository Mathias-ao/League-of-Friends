> **Research archive (17 October 2026).** This is the worker's original read-only investigation, preserved for traceability. It is not an approved scoring rule, implemented capability, deployment report, or activation decision. See [the integrated V1 launch roadmap](../project/SOCIAL-V1-LAUNCH-ROADMAP-2026-10-17.md) for current conclusions and precedence.

# Age of Friends V1 — Chronicle & Player Reporting Launch Contract

Read-only repository review completed

Repository: `Mathias-ao/League-of-Friends` Verified main: `25f120412df5ed0118b9557cdf822ab175108242` Scope: Player Chronicle, authenticated reporting, judgment qualification, privacy, corrections and launch acceptance.

## Executive decision

V1 should deliver one integrated Chronicle with two distinct historical records:

1. The Record — automatically written factual Battle history, derived from accepted recording evidence.
2. The Testimony — occasional, voluntary, explicitly attributed judgments from authenticated participants about what particular encounters meant to them.

Only independently qualified testimony may influence Relationship history. Neither a player statement nor a Chronicle narrative can establish gameplay facts that the recording does not support.

The guiding principle should remain:

Play the game. Build your history. Let Age of Friends remember.

### Verified implementation assessment

| Component                             | Current repository state                                          | V1 requirement                        |
| ------------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| Player Chronicle book                 | Existing authenticated read, narrative writer and parchment UI    | Reuse and extend                      |
| Pair × Battle history                 | Implemented read-time projection                                  | Preserve                              |
| Four judgment families                | Read-only source-anchored candidates                              | Integrate into authenticated workflow |
| Structured question drafts            | Offline simulation                                                | Implement real submissions            |
| Identity and permissions              | Existing Steam/Firebase league identity                           | Reuse with respondent authorization   |
| Binding judgments                     | Not implemented in production                                     | Required                              |
| Judgment corrections                  | Approved design, no production workflow                           | Required                              |
| Judgment qualification and visibility | Approved rules, not production-integrated                         | Required                              |
| Automatic historical re-evaluation    | Existing correction infrastructure, incomplete social integration | Required                              |
| Relationship progression              | Separate workstream                                               | Consume only qualified outputs        |

The core implementation distinction is important: `chronicle_judgment_opportunities.py`, `chronicle_moment_design.py`, `chronicle_interaction_draft.py` and `chronicle_story_templates.py` are prototypes and design inputs, not authenticated production services.

The current `getPlayerChronicle` callable is genuinely owner-bound, and the V2 writer exists. However, the current social-history read is limited to completed Matches, has a 100-completed-Battle bound, and does not expose the requested judgment workflow. Those are launch integration gaps, not reasons to rebuild the Chronicle.

Sources: [Player Chronicle Book V1/V2](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/docs/architecture/player-chronicle-book-v1.md?utm_source=chatgpt.com), [approved Relationship baseline](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/docs/architecture/relationship-v1-approved-baseline-2026-10-13.md?utm_source=chatgpt.com), [existing Chronicle reader](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/functions/src/queries/socialHistoryRead.ts?utm_source=chatgpt.com).

The requested launch scope makes these four reporting interactions explicit V1 requirements. It does not authorize additional exploratory Chronicle themes or change the approved Relationship scoring rules.

## 1. Minimal V1 player journey

1. A Battle is recorded

   A player uploads the `.aoe2record`. Existing processing verifies source integrity, roster identity, Game authority and evidence availability. The Chronicle does not depend on the Event being administratively concluded.
2. The Chronicle writes what is known

   A factual Battle record becomes available. Any qualifying pair-specific episode may become a scene on the relevant Relationship leaf. Unknown outcomes or incomplete evidence remain explicitly unresolved.
3. An exceptional moment may invite testimony

   When the source-backed prerequisites pass, the relevant player finds a small, private invitation beside that Battle's history. The question asks about their own interpretation, not what the recording objectively proves.
4. The player responds or declines

   The player chooses structured responses, may add an optional note, and explicitly confirms that the submission is binding. Alternatively, they may defer or decline without penalty.
5. The judgment is independently evaluated

   The server checks the source, identity, historical context and applicable qualification rules. Pending testimony remains private. Definitively qualified or Not Qualified testimony receives the prescribed league-visible treatment.
6. History gains an attributed perspective

   Qualified testimony appears alongside the factual scene, clearly labeled as the player's perspective. Any independently qualifying Relationship effect is evaluated by the separate Relationship engine at the original historical incident position.

### Chronicle presentation

RELATIONSHIP CHRONICLE

## A Hand Amid the Battle

Battle: The War for Lombardia · 17 October 2026

THE RECORD

A source-verified defensive encounter involved two players. The Chronicle preserves what their recorded conduct supports without claiming that either player was rescued.

A question for your Chronicle

Your answer may help establish what this encounter meant to your Relationship history.

Their actions felt like meaningful support.

I regarded it as ordinary teamwork.

I cannot say.

DeclineReview answer

This is an illustrative interaction, not a live Age of Friends submission.

The actual V1 confirmation step must explicitly say that the statement is binding, identify its linked Battle and counterpart, and explain that a correction requires review.

### When does a Battle enter the Chronicle?

Separate factual history from its more selective narrative interpretation.

Factual Battle history: As soon as the relevant Game has an authenticated, currently accepted, integrity-verified READY recording and valid league identity/eligibility, its supported facts can be recorded. If the official outcome remains pending, outcome-dependent statements wait. A Game whose source is merely provisional must not be treated as accepted evidence.

Relationship Chronicle: The existing one-pair-per-Battle synthesis receives an entry when there is an authenticated first recorded encounter or a source-supported meaningful episode. Repeated team co-presence alone must not create new prose.

For multi-Game Matches, one Battle scene accumulates independently qualified beats in Game order. Its coverage is marked partial when necessary; it does not imply that all Games have been processed.

A warmup contributes independently of whether that warmup was selected for League Points. This respects the existing Event contract.

## 2. Four eligible reporting families

The four existing families should be the entire V1 judgment vocabulary. They are not four routine questions asked after every match.

| Family                             | Evidence required to offer a question                                                                                                                         | Respondent and meaningful responses                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Meaningful assistance perception   | Reviewed, specific helper → recipient defensive assistance or other supported substantive directed help, with noteworthy context                              | Recipient: meaningful support / ordinary teamwork / undecided                              |
| Situated antagonism or grievance   | Reviewed, specific counterpart → recipient antagonistic conduct with independently verified significance and context                                          | Affected player: personal grievance / ordinary competition / no lasting change / undecided |
| Superior-skill acknowledgment      | Verified repeated direct results; existing V1 opportunity requires the third distinct Battle loss and complete pair history through that anchor               | Losing player: explicitly acknowledges superior skill / regards them as equals / undecided |
| Exceptional Treachery confirmation | Strict reviewed objective incident: effective alliance, unilateral rupture, subsequent hostility, king loss, responsible former ally and qualified chronology | Victim only: betrayed / fair game / undecided                                              |

These reuse the four gated opportunity kinds already implemented in [chronicle_judgment_opportunities.py](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/replay-tools/chronicle_judgment_opportunities.py?utm_source=chatgpt.com).

### Essential gating decision

A source-backed candidate is not necessarily a verified substantive deed.

The newer V1a evidence work confirms that command-derived observations cannot, by themselves, establish executed military conduct, meaningful assistance or consequential antagonism.

Consequently, every automated opportunity must pass two separate gates:

Source-linked opportunity candidate

Independent substantive incident review

Private player question becomes eligible

Player judgment and independent qualification

Passing source-shape validation is not the same as passing the second gate. Where V1 evidence cannot establish the required substantive incident, the question is blocked. It is not made available with a lower evidentiary standard.

For Treachery, the dedicated objective evidence and review remain mandatory. Asking whether a player felt betrayed cannot repair an unverified alliance, rupture or king-loss claim.

### Avoiding survey fatigue

The minimal launch solution is passive, contextual discovery, not automatic post-Battle questionnaires.

- Place an invitation within the respondent's own Chronicle, linked to the exact source-backed episode. Add a small self-only indication on the Chronicle's personal leaf when eligible unanswered questions exist.
- Deduplicate by logical incident, respondent and question family. Never issue another invitation because processing retried, a source revision changed, or the player reopened the page.
- Never prompt merely because teammates shared a Battle, opponents fought normally, or a player lost a match.
- A decline is not a negative judgment. It suppresses the invitation without creating social evidence; an undecided answer is a deferral, not binding testimony.

For launch, prioritize the four approved families and keep delivery pull-based. No emails, push notifications, broad surveys or unapproved recurring invitation policy are needed. If notification limits or expiry rules are introduced later, those require an explicit policy decision; the current prototypes configure neither.

## 3. Backend and client integration

### Architecture

Existing accepted Game source

READY recording · active revisions · authenticated roster

Factual Chronicle

Pair × Battle history and V2 narrative

Opportunity selector

Existing four-family candidate logic and source review

Authenticated judgment service

Private offers · binding submissions · correction review

Judgment qualifier

Per-choice evaluation · historical anchor · source revision

Chronicle testimony

Qualified and Not Qualified public statements

Relationship interpretation

Separate worker's approved evaluator, if qualified

No new replay parser, gameplay detector, result evaluator or independent historical Battle database is needed.

### Integration responsibilities

| Existing component                                            | Required extension                                                                                                                                                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `socialHistoryRead.ts`                                        | Use accepted Game authority without requiring Match/Event administrative completion; replace the 100-Battle scan with bounded, indexed historical pagination or an equivalent complete read strategy |
| `playerChronicleCore.js` / `playerChronicleNarrative.js`      | Keep deterministic pair × Battle writing; attach factual coverage and safe testimony references without mixing testimony into source facts                                                           |
| `chronicle_judgment_opportunities.py`                         | Reuse four source-gated opportunity families; introduce production-verified input and independent substantive review before delivery                                                                 |
| `chronicle_moment_design.py` / `chronicle_story_templates.py` | Reuse approved family-to-question mapping and restrained narrative copy; keep exploratory families disabled                                                                                          |
| `chronicle_interaction_draft.py`                              | Reuse its validation concepts, but replace the local simulation with authenticated server writes; its current single-choice restriction is insufficient for the approved compatible-choices contract |
| `getPlayerChronicle.ts`                                       | Return sanitized factual pages plus owner-private invitation status and public testimony projections                                                                                                 |
| `PlayerChronicleBook.tsx`                                     | Add in-book invitations, confirmation, submitted-status display, testimony sections and correction requests                                                                                          |
| `FirebaseLeagueRepository.ts`                                 | Add narrowly scoped authenticated callable methods                                                                                                                                                   |

### Minimal new server contract

The following is a proposed interface, not existing code.

| Operation                       | Access                      | Responsibility                                                                                                      |
| ------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `getMyChronicleOpportunities`   | Authenticated owner         | Return eligible private invitations with current questions and safe supporting context                              |
| `submitChronicleJudgment`       | Exact respondent            | Commit an explicitly confirmed structured judgment with an idempotent request ID                                    |
| `declineChronicleOpportunity`   | Exact respondent            | Record private dismissal only, without a social claim                                                               |
| `requestJudgmentCorrection`     | Original respondent         | Submit an evidence-based correction request without altering the binding statement                                  |
| `adminReviewJudgmentCorrection` | Eligible impartial reviewer | Approve/reject a correction request with audit reason and evidence                                                  |
| `getChronicleTestimony`         | Active league member        | Return only league-visible qualified or definitively Not Qualified statements                                       |
| Internal judgment re-evaluator  | Server only                 | Revalidate source authority, choices and historical effects after corrections or missing evidence becomes available |

The existing `requireLeaguePlayer` should remain the authentication entry point. It resolves the authenticated UID to the durable `playerId`. No submitted identity, counterpart claim, replay name or client-provided source path may substitute for server-side bindings.

All authoritative writes run through Cloud Functions. Player clients must have no direct Firestore authority to create judgments, approve corrections, alter qualification or award effects.

### Minimal persistence

A small dedicated judgment store is justified because human declarations cannot be regenerated from replay recordings.

Proposed logical records:

| Record                    | Essential fields                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ChronicleOpportunity`    | Logical incident ID, family, Battle/Game/Event, respondent, counterpart, source revision digest, reviewer gate, historical anchor, eligibility state               |
| `ChronicleJudgment`       | Binding judgment ID, incident ID, authenticated author, selected choice IDs, optional private note, submitted timestamp, qualification results, statement revision |
| `ChronicleJudgmentAudit`  | Submission receipt, source checks, corrections, reviewers, replaced revisions, re-evaluations and actual timestamps                                                |
| `ChronicleJudgmentEffect` | Versioned, independently qualified effect reference to be consumed by the Relationship evaluator; never a second scoring ledger                                    |

These are schema roles, not instructions to establish a competing Battle-history authority.

The active source, Game results, eligible Battle roster, Events and league player identity remain governed by their existing stores.

### Important identity rule

The current opportunity and moment prototypes generate identifiers from provenance that includes revisions. That is adequate for read-only projections, but revision-hashed IDs must not become the identity of a binding human judgment.

V1 requires a durable logical incident identity, with revisions stored separately.

For example:

`incidentId = stable source-anchored logical incident`

`judgmentId = incidentId + respondentPlayerId + approved family`

The actual key must distinguish genuinely separate incidents in one Battle, but source reprocessing cannot create another submit opportunity for the same historical incident.

A correction that changes the underlying incident identity requires auditable supersession or human review, not blind fuzzy matching.

Similarly, preserve stable Chronicle Battle identities across prose upgrades. Current writer IDs include source beats, so correction-driven entry replacement requires explicit lineage handling if the source beat set changes. An ordinary prose rewrite alone must never make an old Battle look newly fought.

## 4. Judgment identity, privacy, qualification and correction

### Binding submission contract

A genuine submission must be treated as a signed historical declaration, not an editable reaction or an ordinary comment.

The authoritative record needs to establish:

| Field              | Contract                                                 |
| ------------------ | -------------------------------------------------------- |
| Author             | Server-resolved authenticated league player ID           |
| Subject            | Exact, independently identified counterpart              |
| Incident           | Durable source-anchored logical incident ID              |
| Family             | One of the four approved V1 families                     |
| Choices            | Selected approved structured choice IDs                  |
| Evidence           | Active-source and historical-context revision references |
| `submittedAt`      | Actual server submission timestamp                       |
| `historicalAnchor` | Original qualified Battle/incident position              |
| `ruleVersion`      | Version used for judgment qualification                  |
| Correction state   | Original binding revision and any approved supersession  |
| Audit              | Immutable receipt and subsequent evaluation events       |

Submission requires explicit confirmation, current source revalidation and an idempotent request ID. The transaction must reject stale source revisions, wrong respondent identities, withdrawn incidents, duplicates and conflicting retries.

The same player cannot submit a second independent binding judgment for the same incident merely because they changed their mind.

### Structured choices

AOF-SOC-080–083 require compatible multiple structured choices, with each choice independently eligible for qualification.

The minimum implementation is a versioned question schema containing choice ID, meaning, compatibility or exclusion group, and qualification rule reference. A response containing contradictory choices is rejected.

The present four template families express mutually exclusive primary positions. V1 can use exactly one primary answer for each of those questions while implementing compatibility validation for any separately approved multi-choice combinations. This avoids inventing new judgment meanings merely to exercise multi-selection.

Undecided should defer the question rather than produce a binding positive or negative judgment.

Optional free text is context, never independent scoring evidence. For the minimal privacy-safe launch, keep notes available to the author and authorized reviewers rather than publishing unmoderated commentary. Public testimony uses the structured statements.

### Status and visibility contract

| State                         | Visible to                                      | Relationship effect                                       |
| ----------------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| Unanswered / deferred         | Respondent only                                 | None                                                      |
| Declined                      | Respondent only; no testimony                   | None                                                      |
| Submitted — Pending           | Author and authorized reviewers                 | None until choice qualifies                               |
| Qualified                     | League-visible; attributed                      | Only independently qualified effects                      |
| Not Qualified                 | League-visible; attributed                      | None                                                      |
| Correction requested          | Author and authorized reviewers for the request | Re-evaluate affected existing effects if evidence changes |
| Source superseded / withdrawn | Author and reviewers while unresolved           | Revoke or suspend unsupported effects                     |

For compatible multi-choice submissions, qualification and privacy apply per choice. Pending choices remain private. Resolved statements can be projected separately without revealing that additional unresolved statements exist.

A definitively failed judgment must retain the approved public label:

Not Qualified — No Relationship Effect

Its explanation must be neutral and source-supported. For example, The required Battle evidence could not be verified. It must not disclose restricted evidence or imply that the player lied.

The exceptional Treachery prompt specifically remains unanswered and private indefinitely when the victim does not answer. Its exceptional effect remains unqualified. Ordinary independent evidence is unaffected.

These requirements follow AOF-SOC-062–088 in the [approved baseline](https://github.com/Mathias-ao/League-of-Friends/blob/25f120412df5ed0118b9557cdf822ab175108242/docs/architecture/relationship-v1-approved-baseline-2026-10-13.md?utm_source=chatgpt.com).

### Separate, potentially conflicting perspectives

Players may truthfully report different experiences of the same Battle.

For example, after a contentious encounter:

Player A's testimony

“This encounter left me with a personal grievance.”

Attributed to Player A · Qualification independently evaluated

Player B's testimony

“I regarded it as ordinary competition.”

Attributed to Player B · Qualification independently evaluated

The Chronicle's conclusion

Both statements may remain in the historical record. Neither changes the recorded Battle, cancels the other player's perception, or automatically establishes mutual Hostility.

These are independent declarations, with independent source and track qualification. If one is qualified and the other is Not Qualified, show their actual respective statuses rather than calculating a consensus.

The same rule applies to Treachery, with one stronger restriction: only the actual victim's explicit binding “betrayed” judgment satisfies the exceptional subjective requirement. The alleged betrayer's perspective can never override it.

### Correction workflow

The approved correction contract is intentionally strict.

1\. Player requests correction

The player identifies a genuine submission error, factual error or material original misunderstanding. Later changed opinion is insufficient.

2\. Impartial authorized reviewer decides

The reviewer must not be involved in the underlying incident or otherwise conflicted. Approval or rejection is audited with reasons.

3\. Approved correction reopens player submission

The player provides the replacement judgment. The reviewer does not write the replacement statement on the player's behalf.

4\. Historical re-evaluation

The replacement is evaluated at the original incident's position. Real correction and resubmission timestamps remain in the internal audit.

Once the replacement meets normal qualification, a second extraordinary approval is not necessary.

Public correction-history presentation remains deferred under SOC-089. V1 shows the current authoritative statement and status, while preserving prior revisions in the authorized audit. It must not expose the private correction request or fabricate a historical submission date.

### Re-evaluation on source changes

Re-evaluation must be deterministic and linked to existing replay correction authority.

| Change                          | Required behavior                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| New qualifying evidence arrives | Automatically re-evaluate Pending judgments                                                     |
| Corrected result                | Reassess result-dependent questions, especially the third-loss skill anchor                     |
| Recording source replaced       | Revalidate incident facts and logical identity against the new active source                    |
| Roster mapping corrected        | Revalidate author/counterpart attribution; never retain a misattributed effect                  |
| Game disputed                   | Suspend newly unsupported qualifications while the dispute is unresolved                        |
| Source withdrawn                | Remove unsupported factual claims from public narrative; retain private audit history           |
| Incident definitively disproved | Mark affected testimony Not Qualified, remove its effect, publish only safe neutral explanation |
| Judgment corrected              | Supersede original binding revision and re-evaluate at its historical incident position         |
| Unrelated source corrected      | Leave unaffected judgments and Battle entries unchanged                                         |

If withdrawal leaves the facts merely unknown rather than definitively false, the judgment remains Pending and private instead of being falsely declared Not Qualified.

Historical Relationship projections must be rebuilt only through the approved versioned evaluator. If the corrected contribution affected a historical stage crossing, reciprocity credit, pending War Room authorization or historical peak, the existing AOF-SOC correction rules apply. The Chronicle layer cannot settle those consequences itself.

## 5. Player-facing separation of fact, testimony and social effect

The Chronicle needs three visibly distinct semantic layers, but it does not need three independent applications.

| Layer                    | Presentation                                         | Authority                                                |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------------- |
| The Record               | Ordinary manuscript scene                            | Accepted recording evidence and qualified reconstruction |
| Player Testimony         | Attributed quotation or inset with author and status | Authenticated structured judgment                        |
| Relationship Consequence | Small historical annotation, if one qualifies        | Separate versioned Relationship evaluator                |

### Example: qualified testimony without an effect

The Record

> A and B appeared together in an authenticated Battle. Their recorded encounter remains part of the league's history.

Player Testimony

> Player A acknowledged B's superior skill.

Relationship Consequence

> No change to Relationship standing was independently qualified.

This is an entirely valid finished Chronicle entry.

An explicit acknowledgment can satisfy the approved skill-hierarchy requirement without independently satisfying the other requirements for a Rivalry regression.

Similarly, meaningful assistance can be source-supported without triggering a relationship stage, and a grievance can remain qualified testimony without manufacturing hostile conduct or reciprocity.

### Narrative rules

Preserve the current Player Chronicle V2 narrative rules: one pair × Battle manuscript entry, ordinarily two to four sentences; previously established history may provide context, but later developments never rewrite earlier motives or circumstances.

A later Battle can acknowledge an earlier independently qualified contest or cooperative episode. A single Battle containing several commands or Games is not proof of repeated historical behavior.

The factual writer must not turn player testimony into an objective statement. In particular:

| Avoid                                        | Prefer                                                             |
| -------------------------------------------- | ------------------------------------------------------------------ |
| “B betrayed A.” based solely on an answer    | “A described the incident as betrayal.”                            |
| “B saved A's army.” based on support orders  | “B's recorded support orders accompanied the defensive encounter.” |
| “A hates B.” based on a grievance            | “A reported a grievance arising from the encounter.”               |
| “B proved superior.” based on acknowledgment | “A explicitly acknowledged B's superior skill.”                    |

For fully qualified exceptional Treachery, the Chronicle may separately present the strict recorded rupture and attributed king loss alongside the victim's declaration. The objective incident and the victim's testimony remain individually traceable.

### Privacy boundaries

The existing owner-bound Chronicle must remain private as a complete book.

League-visible testimony should be exposed through a narrow, sanitized public testimony projection, accessible from linked Battle history or the authorized league-facing report surface. Publishing a qualified statement does not authorize exposing either player's entire private book, unanswered opportunities, private notes, correction discussions or shadow scoring data.

The current `getSocialHistory` endpoint exposes more internal information than the public Chronicle read. It should remain a diagnostic boundary and should be reviewed for appropriately restricted access before social reporting is activated. The player-facing report service must not reuse its full response as a public DTO.

## 6. End-to-end acceptance matrix

The following are required acceptance scenarios, not tests claimed to have passed.

| ID  | Scenario                                                  | Required result                                                                                      |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| C01 | Accepted eligible recording, before Event finalisation    | Supported factual history appears without waiting for Event closure                                  |
| C02 | Accepted Game with result pending                         | No invented winner or outcome-dependent social claim                                                 |
| C03 | Multi-Game Battle                                         | One pair × Battle entry; ordered qualified beats; partial coverage shown                             |
| C04 | Non-scoring eligible warmup                               | Full eligible evidence retained; no dependence on points selection                                   |
| C05 | Ordinary team participation or routine combat             | No unsolicited social question                                                                       |
| C06 | Unverified command-derived assistance or antagonism       | Opportunity blocked until substantive prerequisites qualify                                          |
| C07 | Reviewed noteworthy assistance                            | Only the identified recipient receives the relevant private invitation                               |
| C08 | Reviewed situated antagonism                              | Correct affected player, counterpart and incident identified                                         |
| C09 | Third distinct verified loss                              | Skill invitation anchored to three verified distinct Battle losses                                   |
| C10 | Strict objective Treachery prerequisites fail             | No victim question or exceptional effect                                                             |
| C11 | Strict prerequisites pass; victim unanswered              | Private Pending opportunity; no exceptional Hostility or allowance consumption                       |
| C12 | Victim selects “fair game”                                | No exceptional Treachery effect; any other interpretation remains independently qualified            |
| C13 | Victim explicitly selects “betrayed”                      | Exceptional effect eligible only if all other required gates pass                                    |
| C14 | Two participants provide conflicting perceptions          | Separate attributed testimony; no merging, veto or manufactured reciprocity                          |
| C15 | Attacker submits a judgment about the victim's Treachery  | Cannot replace or override the victim's judgment                                                     |
| C16 | Compatible structured selections                          | Each selected choice independently evaluated; contradictions rejected                                |
| C17 | Optional free-text note                                   | Stored safely; never independently scored or interpreted as an objective fact                        |
| C18 | Declined or deferred invitation                           | No social effect, no public indication and no repeat survey                                          |
| C19 | Pending submission                                        | Private to author and authorized reviewers                                                           |
| C20 | Definitively Not Qualified submission                     | League-visible attributed statement with exact required label and no effect                          |
| C21 | Duplicate or forged submission                            | Idempotent retry or authorization rejection; no second binding judgment                              |
| C22 | Player changes opinion later                              | Original judgment stays binding; change alone cannot authorize correction                            |
| C23 | Genuine error correction approved by impartial reviewer   | Player resubmits; original preserved in audit; historical re-evaluation occurs                       |
| C24 | Active recording withdrawn, replaced or mapping corrected | Dependent narratives/judgments revalidated; stale effects revoked without altering unrelated history |
| C25 | Late qualified judgment                                   | Effective evaluation uses original incident chronology, actual submission time preserved             |
| C26 | Source or official result changes during submission       | Stale transaction rejected; no mixed-revision judgment                                               |
| C27 | Opposite-direction conduct missing in same Battle         | Testimony cannot manufacture directional reciprocity                                                 |
| C28 | No social effect qualifies                                | Factual Chronicle remains visible and unchanged                                                      |
| C29 | Different user opens another player's profile             | Opens their own Chronicle at the counterpart bookmark, never another owner's private book            |
| C30 | Source and history exceed earlier read limits             | Complete bounded pagination or explicit incomplete coverage; never silent historical truncation      |

Acceptance also needs actual authenticated multi-user testing, not just Python fixtures. At minimum, use separate accounts for respondent, counterpart, unrelated league member and impartial administrator, with positive and negative authorization tests.

## 7. Smallest implementation slices

These should be delivered in order, with no parallel replacement of existing replay or scoring infrastructure.

### 01

Harden the factual Chronicle publication boundary

Reuse verified active Game authority, add source/revision and partial-coverage handling, remove reliance on administrative Battle completion, and provide complete scalable historical reads.

Exit condition: factual chapters are correctly available, corrected, grouped and sanitized without interactive reporting.

### 02

Production opportunity admission

Connect the four existing opportunity families to authoritative eligible sources and independently reviewed substantive incidents. Establish stable logical identities and private, deduplicated invitation states.

Exit condition: correct players receive only supported opportunities; all blocked and exploratory cases remain unavailable.

### 03

Binding judgment service

Implement owner authorization, structured choice compatibility, submission confirmation, one-binding-statement semantics, receipts, private notes, statuses and independent qualification outputs.

Exit condition: real authenticated declarations survive retries and cannot be forged, duplicated or silently edited.

### 04

Corrections, publication and re-evaluation

Add impartial correction requests/reviews, source-change reevaluation, final qualified/Not Qualified publication and an effect interface to the separately implemented Relationship evaluator.

Exit condition: source and judgment corrections produce reproducible historical outcomes with no stale public effects.

### 05

Chronicle interface and launch acceptance

Add the private invitation leaf, linked question panel, confirmation, status display, public testimony view and correction request flow to the existing parchment UI. Complete the end-to-end matrix using authenticated participants.

Exit condition: a real player can discover, submit, revisit and correct an eligible judgment without developer tools or administrator intervention in the normal flow.

### Cross-worker integration boundary

This Chronicle contract defines who said what, about which verified incident, under what authority, and whether that statement qualified.

The separate Relationship worker defines how independently qualified inputs influence Rivalry, Hostility and Bond.

For integration, the Relationship evaluator should consume a versioned output containing the logical incident, author, source-backed conduct reference, selected qualified meaning, historical position and applicable rule version. It must not receive a precomputed Chronicle point award or assume that a submitted statement constitutes reciprocity.

The Chronicle can launch with factual history and usable reporting while particular Relationship effects remain Pending where the required scoring rule or substantive evidence is not ready. It cannot advertise those effects as qualified, nor can the four reporting families be considered fully integrated into progression until their separately approved rules are executable.

## 8. Final V1 recommendation

The smallest genuinely usable launch is not a broad Chronicle Story Engine. It is an extension of the existing Chronicle book, backed by one narrow authenticated testimony service.

The minimum successful experience is that a player can open a verified Battle's historical page, find a rare relevant question, give an explicit binding response, and subsequently see an accurate account of what they said and whether it qualified—while other participants can disagree without either statement rewriting the recording.

That provides durable historical meaning without turning the Chronicle into a questionnaire, a social-media comment section or a second scoring engine.

Implementation status: Design specified; no code changes, PRs, deployments, policy activation or data mutations performed. The six deliverables are covered above, with qualification decisions and launch gates distinguished from current implemented behavior.