# #156 Chronicle interaction inventory and zero-delivery rare selector

Status: **technical proposal only, dormant**. Main baseline `e453d40c147ad488f3bfd369e54eba82b29c43b5`. Previous #128 closed as a work order but **not** as an implemented binding invitation service. No server endpoint, Firestore write, feature flag, scoring rule, owner-approved numerical policy, or player-facing notification is delivered by this slice.

## Actual implementation inventory (code versus design)

| Concern | Current code | Proven behavior / missing boundary |
|---|---|---|
| Factual owner Chronicle | `functions/src/queries/getPlayerChronicle.ts`, `getMyPrivateChronicle.ts`, `socialHistoryRead.ts` | Authenticated read, private owner check, active READY provenance, Event/Game/correction fencing, bounded historical scan. No testimony write. |
| Scene and parchment | `playerChronicleCore.js`, `web/src/ui/PlayerChronicleBook.tsx`, `web/src/domain/chronicleReadHistory.ts` | Pair×Battle scene, canonical immutable sceneId, source-derived legacy entryId and seen migration, pending Game/Battle result labels. Owner-bound navigation. No question controls. |
| Signed-in identity | `functions/src/auth/authorization.ts`, `getMySocialExperience.ts` | Firebase UID→active linked player; actor must be source Game and Match roster participant; exact READY source/event/season/GUID/artifact/revision fenced, corrections abort. Only private integration source read; no invitation authorisation or submission. |
| Four themes | `replay-tools/chronicle_judgment_opportunities.py`, `chronicle_moment_design.py`, `chronicle_story_templates.py` | Source-referenced *review candidates*, **not** independently reviewed substantive gameplay or a delivery selector. `CANDIDATE_FOR_HUMAN_REVIEW` is not `ADMITTED`. Broader exploratory themes are not authorized. |
| Draft answer | `replay-tools/chronicle_interaction_draft.py` | Local **simulation** using caller-supplied viewer and no real auth, persistence, publishing or binding. Explicit simulation receipt. |
| Stable slot and visibility | `functions/src/domain/socialV1.ts` (`invitationSlotId`, `planInvitationOffer`, `transitionInvitation`, `publicJudgment`) | Pure identity/CAS transition and resolved public allowlist; **no Firestore adapter**. All slot states, including DECLINED/WITHDRAWN, consume one Battle×respondent forever. |
| Authenticated invitation/testimony | `functions/src/index.ts`, `functions/src/commands`, `functions/src/domain/collections.ts` | No `getMyChronicleOpportunities`, `submitChronicleJudgment`, `requestJudgmentCorrection`, `adminReviewJudgmentCorrection` callable or `socialV1InvitationSlots` transaction. No judgment/audit persistence, no active qualification/publication. |
| Storyteller | Worker E #140 pending | Independent C1 prose; this PR does not change it. Testimony must be a distinct attributed inset, never annalist factual prose. |

## Proposed admission and ranking (inert pure module)

`functions/src/engines/chronicleRareSelector.ts` accepts **server-built** current Battle/Game/source roster and source-method-reviewed candidate envelopes. It is **not** an authenticated service and must never be wired to client input directly. A `true` qualifier or witness list in a fixture is **not original-source proof**.

**Common mandatory gates:** eligible current READY Game source authority digest and one-to-one roster from existing authenticated collector; current eligible Battle/Event and full necessary source/chronology coverage; reviewed distinct incident with an independently **ADMITTED** qualified source method; nonempty original event/witness refs, no missing semantics, personally significant independently reviewed context; owner-approved selection policy with explicitly admitted method registry. Ordinarily graded raids, command attempts, co-presence, normal win/loss and broad feelings never become an offer. Unapproved or empty registry returns an empty selection.

Four V1 families only:
1. **ASSISTANCE:** actual independent substantive directed assistance / outcome support plus qualifying remarkable context. Generic help order, engagement proximity and inferred rescue are insufficient.
2. **SITUATED_GRIEVANCE:** proven personally directed unusual opponent conduct under verified circumstances; normal warfare or a raid scalar alone is insufficient, never proof the victim hates anyone.
3. **SKILL_ACKNOWLEDGMENT:** one anchor loss and two earlier verified **distinct Battles**, complete pair-history coverage, actual winner/loser attribution, and a reviewer-approved meaningful turning point. Three Games in one Battle never count as three losses.
4. **TREACHERY_VICTIM:** strict objective six-prerequisite positive proof of effective mutual alliance, ordered unilateral rupture, subsequent attributable hostility, king loss, responsible former ally, incident identity/chronology. The **victim alone** may later decide whether it was betrayal; an unanswered or “fair game” result never creates exceptional Hostility.

**One slot:** Rank only already-qualified candidates using owner-approved `familyOrder`, reviewed EXCEPTIONAL before REVIEWED_TURNING_POINT, then stable incident/Game IDs. Dedup correlated episode/POV, choose **at most one** per respondent×Battle; no minimum, no force-offer on 1v1 or 4v4. Existing OFFERED/DEFERRED/DECLINED/SUBMITTED/WITHDRAWN slot prevents new invitation, even after corrections. Proposed separate historic fatigue/same-pair blocks are supplied by a verified, owner-approved historical resolver; no guessed time or count thresholds.

**No social effect from an offer:** Missing/skip/defer/decline/no response is empty silence, not a negative, no credit or event. `PRIVATE_PROPOSAL_ONLY` output holds selection identifiers, not answer text, public qualification, free-text notes or receipts.

## Binding/publishing *not delivered*, next acceptance gate

After #152's owner significance/cooldown/qualifier-method approval and #153/#154's admitted evidence are available, a separate authenticated server handler must:
- Resolve authenticated UID→player, eligible source and respondent (not client claims), verify selected Game+Match/event/season/GUID/source authority in transaction; verify prior-only complete historical evidence and fatigue. Never allow ADMIN or counterpart to submit as victim.
- Atomically create-if-absent the canonical `/matches/{battleId}/socialV1InvitationSlots/{slotId}` and authored invitation record under one `planInvitationOffer` transaction. One slot per respondent/Battle; retry idempotent, CAS, no retarget after source revision. Never create slot for no candidate.
- Defer/decline privately without cost. One explicit binding confirmation by real respondent; immutable timestamp and exact original incident anchor; no second submission after changed mind.
- Revalidate or withdraw under corrections; true original factual error correction reviewed by impartial admin, reopen the *original* author in the same consumed slot with full private audit. Pending author-only; separately reviewed QUALIFIED or definitive NOT_QUALIFIED structured choices only through `publicJudgment` allowlist, with required “Not Qualified — No Relationship Effect” label. Private notes never publish; no public correction history. Exceptional Treachery remains victim-bound and truth of objective king loss separate from testimony.
- Feed independently approved qualified meaning to existing historical evaluator *only if* owner-authorized. No reverse credit, relationship penalty for no answer, award, scoring activation or deployment.

## Tests and evidence limits

New Node `functions/tests/chronicle-rare-selector.test.mjs` covers zero routine 1v1/unapproved policy; synthetic rare assistance, situated grievance, independent third-loss skill, strict six-gate victim Treachery; 4v4 multi-Game and duplicate POV/order dedup; permanent withdrawn/declined/answered slot tombstones; fatigue; stale source, incomplete chronology, roster mismatch, private output shape, silence creating no effects. These are **synthetic policy/witness unit tests**, NOT a verified genuine replay qualification test or authenticated invitation service.

Existing source-auth/privacy tests (reused rather than duplicating) cover the real callable `getMySocialExperience` actor/outsider, current GUID and source revision, invalid membership and corrections, as well as `getMyPrivateChronicle` owner access and completed-bound/no-invented outcomes. They test existing readers, **not** an absent invitation submission. New server-side end-to-end A/B/outsider/admin privacy and stale-source-binding tests are mandatory *after* the authenticated transaction service is approved and implemented.

No routine surveys, numeric significance policy, score writes, responses, notifications, new UI or Worker E composer change.
