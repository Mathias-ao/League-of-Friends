# CHRON-V1E — Authenticated rare invitations, emulator-only acceptance

Issue #169. Foundation: merged #160 `chronicleRareSelector.ts`, SHARED_1 slot contracts, authenticated INT-B native history. **Production hard-disabled**: every new callable requires `FUNCTIONS_EMULATOR=true`, a `demo-*` project, and `AOF_CHRONICLE_INTERACTIONS_V1E=emulator-only`. Staging or production cannot opt in with this build. No flags were set remotely, no deployment and no official Relationship/award/point/Gold effects.

## Actual callables and authority

`functions/src/queries/chronicleInteractionService.ts` exports five actor-bound callables:

- `offerChronicleInvitation({battleId})`: ordinary league player, source-qualified Battle respondent only. Loads **complete** current own Battle/Game/READY/native original authority using `collectMyCurrentBattleHistory`, its double-scan/GUID/artifact/roster/revision fences and `loadMyCurrentSocialSource`. Reads server-side reviewed moments only (no client candidate, policy, victim, methods or sourceHash). Calls **merged** #160 pure selector. Ranks four families, does not quota-fill. Transaction checks active auth link, Match/Game/current source Event/Season/GUID and review revision, per-respondent consumed slot, and a serialized per-player fatigue marker. `planInvitationOffer` creates canonical `/matches/{battleId}/socialV1InvitationSlots/{slotId}`, an immutable OFFER audit and the last-offered eligible Battle. A second Game/POV/family is not a new slot.
- `actOnChronicleInvitation({battleId,requestId,expectedRevision,opportunityRevision,action,...})`: owner only. `DEFER`, `DECLINE`, explicit `SUBMIT` with one approved structured choice and optional private text (<=1000 chars), author-owned `CORRECTION_REQUEST` with private rationale, reviewer-authorized `CORRECT` rebinding the **same** incident, and `REFRESH` to tombstone a withdrawn/stale source. Entire response source set and reviewer envelope revalidated. Same request ID + exact payload is idempotent; conflicting request or stale revision fails. Transitions use existing SHARED_1 guard; permanent consumed slot never reissues. `judgments/v1`, `judgments/v2` ... and `audit/{requestId}` are append-only.
- `getMyChronicleInvitations({})`: bounded signed-in respondent-only list, no private notes, audit, raw source/proof, opposite player's pending answer or server grading. Marks source/review/Match/Game stale without declaring a fixed score. `speaker` is explicitly **attributed**, `qualification:PENDING`, `AUTHOR_ONLY`, and not the factual Chronicle narrator.
- `getMyChronicleSubmission({battleId})`: author-only private note and current bound receipt; no other player or admin bypass. Pending and silence remain private.
- `adminReviewChronicleCorrection({battleId,respondentPlayerId,requestId,expectedRevision,decision,reason})`: impartial authenticated admin only, not the original author, with private reason and audit. Allows original respondent to correct structured meaning under the same already-consumed slot. Cannot rewrite gameplay or set a public qualified effect.

Every callable uses `requireLeaguePlayer` / `requireAdmin`. Test-only reviewed inputs are stored under `/matches/{battleId}/chronicleRareReviewedMoments/{incidentId}` and explicitly stamped `methodReview:'EMULATOR_ONLY'`, `reviewedSource:'ORIGINAL_VERIFIED_TEST_WITNESS'`; clients lack Firestore direct write authority. That test marker **is not** real proof that a rescue/received resources/king loss happened. Current #165 candidate grades are Pending/LIMITED and never promoted. A production-reviewed original-method provider + full approved significance policy remain a separate release gate.

## Three eligible Battles, not Games or time

The provisional cooldown suppresses the **next three source-qualified eligible Battles** after an issued invitation to that respondent. It considers the current, complete chronological sequence of eligible pair/actor reviewed Battles; one Battle with 2 Games counts once. The serialized `players/{playerId}/chronicleRareControls/v1` marker blocks concurrent across-Battle offers. Corrections/late history changing the previous offered Battle's eligibility **fail closed**, not silently reset the cooldown. No frequency quotas, inferred penalties or ordinary 1v1 invitations. Without separately admitted meaningful source input the deterministic selector returns zero invitations.

## Four launch families

1. Assistance: source-proven meaningful direction/circumstances; **orders are not executed rescue or material transfer**.
2. Situated grievance: independently unusual directed conduct; normal raids/war are not prompts or Hostility proof.
3. Skill acknowledgment: three independently verified **distinct prior/current Battle** losses, complete relevant history. Three Games do not satisfy it.
4. Treachery victim: effective mutual alliance, ordered unilateral rupture, subsequent attributable hostility, responsible actor's qualified king loss and incident chronology **all source established** before asking the **victim**. Neither prompt nor victim's subjective choice manufactures objective Treachery facts. Never publish/activate exception from a test.

Choice catalog is deliberately narrow, single choice per binding `SUBMIT`, optional `UNDECIDED` as non-binding/no submission. `DEFER`, `DECLINE`, no action or unanswered invitations have **zero** Relationship effects, not a negative judgment. No public `publicJudgment` projection is produced: policy/qualification and owner acceptance remain unapproved.

## Emulator acceptance / limits

`.github/workflows/chronicle-v1e-emulator.yml` invokes the isolated Firestore+Storage emulator and **two SHA-pinned original recordings** through the already accepted ordinary authenticated AUTO upload in `int-b-history-emulator.mjs`; afterwards it seeds clearly synthetic reviewed exceptional context to exercise the interaction *service* and tests:

- A/B/outsider/admin owner and impersonation gates; private notes exclusively on authored submission detail
- concurrent invitation CAS with one permanent respondent×Battle slot, independently bound to two current Games
- concurrent conflicting structured submissions and idempotent request retries; no second binding
- voluntary defer/decline, unqualified silence, other respondent's separate slot
- same original judgment preserved after impartial correction and authored corrected version
- source withdrawal and sibling Game correction invalidate active meaning without deleting the slot, audit or prior private judgment
- no League Points, Gold, Relationship ledger or official scoring writes.

Pure cooldown/production-gate regression: `functions/tests/chronicle-v1e-interaction-policy.test.mjs`.

**Boundary:** This emulator proves transaction/auth/storage mechanics with genuine upload/GUID/artifact authority, **not** an authentic accepted rare assistance/treachery witness or production release readiness. The existing source reader's complete-or-error query envelope (<=256 Matches/64 own Games) also bounds this workflow; very long histories may fail rather than return a silently partial selection.

## Sol + Worker E handoffs

**Sol owns `PlayerChronicleBook.tsx`, `web/src/domain/league.ts`, repository networking and INT-V1 release plumbing.** No UI was edited here. Proposed private-in-book hook uses `getMyChronicleInvitations({})` and the four source-safe structured choices, separate `speaker` inset with author and qualification; never place submitted interpretation inside source narrator prose. Never show one player's PENDING testimony to another. Voluntary declining and correction rationale remain private. Default-off production means no player-facing prompt before independent approval.

**Worker E owns C1 deterministic factual storylets.** No narrative composer changed. `speaker.presentation='ATTRIBUTED_SPEAKER_NOT_OBJECTIVE_NARRATOR'` provides a distinct future presentation seam, and source corrections do not remint `chronicleSceneId`; the Chronicle's objective history remains unaffected by unanswered or subjective selections.

No activation, public testimony, awards, claims, calibrated grading, deployments or staging E2E were performed.
