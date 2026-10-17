# AoF V1 Historical Social Progression — pure evaluator

**Status:** Inactive, parameterized implementation for issue [#127](https://github.com/Mathias-ao/League-of-Friends/issues/127), stacked on Sol's still-unmerged [shared-contract PR #135](https://github.com/Mathias-ao/League-of-Friends/pull/135). Neither the synthetic test calibration nor this PR is a production social-policy approval or permission to publish. No Firestore writes, score processing, HTTP endpoints, feature flags, migration, deployment or staging actions are included.

**Version:** `AOF_SOCIAL_V1_HISTORY_1`; input/output uses `AOF_SOCIAL_V1_SHARED_1` Claim, Subject, Ref, Position, PolicyRef and Receipt types from `functions/src/domain/socialV1.ts`. Source: `functions/src/engines/socialV1History/history.js`; type-only consumer surface: `history.d.ts`.

## Frozen architectural boundary

The server is responsible for selecting the complete **current** authenticated Match/Game/Battle/Event/Season source history and admission, canonical order and stable `battleId === matchId`, mapping people, correcting revisions, and verifying #126's claim and independent-actor proofs. The evaluator must **not** receive bare observations and decide whether a raid, battle or act of assistance happened. It accepts only admitted SHARED_1 Claims with source-bound wrappers and a separate matching actor-evidence witness for independent direction-specific reciprocity. Strict Treachery and skill acknowledgments need their own authorized, reviewed inputs. A pointer or boolean in test input is not a proof certificate.

### Minimal pure invocation

```js
const projected = evaluateHistory({
  chapters: currentAuthorityChapters,
  effects: admittedClaims.map(claim => ({
    claim, battleId, gameId, eventId, sourceAuthority,
  })),
  actorWitnesses: independentlyAdmittedActorConduct,
  treachery: authenticatedStrictVictimConfirmedEvents,
  acknowledgments: independentlyQualifiedStructuredSkillJudgments,
  calibration: explicitlyVersionedRules,
  trustedApprovals: serverResolvedApprovals,
});
```

`PROPOSED` policy executes a private calculation with `simulation.receiptPublicationBlocked === true` and **zero** APPLIED/CAPPED Receipt records. To return modeled Receipt records, the policy must be APPROVED and match an external trusted-approval entry by policy/configuration/approval reference. This pure function never persists or publishes anything; an approved *synthetic test registry* is not permission to publish. The actual production boundary must recheck approvals, source and corrected-history revision transactionally.

## Required calibration fields — deliberately no defaults

- `stages.REPUTATION.{GALLANTRY,CRUELTY,CHIVALRY}`: positive `up[]` and `down[]` boundaries.
- `stages.RELATIONSHIP.{RIVALRY,HOSTILITY,BOND}`: separate positive `up[]`/`down[]`, progressively harder upward thresholds, and explicit independently satisfied `reciprocity[stage]` minimum for **each** ordinary stage 3+ in both directions.
- `budgets.reputationBattle[track][STRENGTHEN|WEAKEN]`: independently bounded player×track×Battle allowances across correlated families/recipients.
- `budgets.relationshipEvent[track][STRENGTHEN|WEAKEN]`: independently bounded Event×unordered pair×track×direction allowances, including genuine additional, non-scoring and helper warmups.
- `rules[claim.ruleId]`: explicit system/track/polarity and `bands[significanceBandId]` to nonzero ordinary units. A detector or impact count cannot invent its own points. Family-specific admission (including ordinary Hostility distinctness, meaningful cooling and Bond weakening) is #126's semantic responsibility.
- `treachery.consumptionUnits` and `treachery.maximumStage`: explicit exceptional configuration, not the historical shadow pilot's values. All values in tests are synthetic.

The model offsets **unfinished** opposing units before accumulating a new positive or negative bank. It crosses configured stage boundaries at actual historical moments, retains unused surplus, records intermediate changes and supported peaks. Completed transitions are not undone merely by net arithmetic; separately qualified later effects are necessary. Rivalry's stage-3 downward floor remains locked without authenticated explicit skill-superiority acknowledgment. Qualified later help cools only the *helper's own direction* of Hostility; meaningful independently qualified antagonism may weaken an established Bond; neither conversion occurs merely because a different track moved.

Reciprocity is a separate historical credit, at most one per Event/track/pair/direction, from the earliest reliably ordered **own actor** qualifying source in that direction. It can count even if ordinary strengthening is capped. New authentic opposite-direction reciprocity can unlock buffered stage progression at its later moment without backdating; victim impact, received help, team assignment and copied perspectives cannot create a reverse credit. For judgment-derived reciprocity, the #126/Chronicle adapter must verify same-Battle independent responding-player conduct before passing admitted actor witnesses.

Strict Treachery is an input from the authenticated strict-proof resolver, not ordinary inferred hostility. The evaluator checks the whole prescribed gate set, including actual binding victim “betrayed” judgment, and applies only victim→responsible Hostility, stage 3 if previously below 3 or +1 capped at configured maximum. The exceptional event has priority for the Event's ordinary Hostility strengthening capacity, does not create fictional points or mutual reciprocity, and is replayed at its historical moment. Earlier unfinished cooling is quarantined rather than retroactively weakening the newly imposed exceptional stage; this particular bank disposition requires integration review against final owner-approved transition/calibration semantics.

## Corrections, source authority and limitations

The evaluator chooses the highest revision per Game, excludes withdrawn/disputed sources, rejects conflicting equal revisions and duplicate GUIDs pretending to be different Games, and recomputes from the complete current input rather than incrementing persisted counters. Duplicate source/claim copies do not multiply awards. Claim/Receipt hashes include the complete canonical selected history and policy. No receipts from a retired source survive the new projection.

Battle/Event/Game order is a **server-authenticated ordinal and order key**, never file upload, record creation or lexical timestamp. Missing chronology marks that directional/player track pending rather than granting current standings. In this deliberately bounded first slice, a pending order dependency conservatively pends the entire affected subject rather than calculating the most aggressive demonstrably independent prefix. The integration lead must decide whether to add finer dependency scheduling before player-facing release; a null current stage is not a stage-0 verdict.

**Integration still required:** #126 claim admission and family weakening predicates; typed server chapter adapter and authority revision fences; independent genuine actor-witness resolution; Chronicle-approved judgment and strict king-loss proof resolver; coherent current-source/approval CAS publication in INT-V1; versioned corrections to dependent War Room eligibility, titles and snapshots; real-source and full cloud security/E2E acceptance. This PR does none of those writes or decisions. Any unresolved policy numerical choices remain owner approval items.

## Tests and verification

```sh
npm ci --prefix functions
npm run build --prefix functions
node --test functions/tests/socialV1History.test.mjs
```

Synthetic unit cases exercise all six tracks, no shadow defaults, proposed-preview gating, stage-3 delayed reciprocity and asymmetric levels 1–2, artificial victim/wrong-direction negatives, capped-but-valid reciprocity, Battle/Event budgets, polarity independence and regression, Rivalry floor, strict Treachery and priority, absent gates, Game/battle corrections and duplicate POVs, legitimate non-scoring warmups, multi-Game Battle saturation, late attributed judgment order and missing chronology. The test fixture's `SYNTHETIC-ONLY` approval entry must never be used as a server-trusted production registration. Authentic provenance/meaningfulness testing belongs upstream to #126/#132.

**Design-register preservation:** SOC-001–088 (with SOC-089 deferred), REL-V1-EVID-01–06 as modified solely by the narrow owner-directed ordinary inference amendment in PR #135, and REL-V1-CAL-01–17. No unapproved Hostility behavior, exceptional privilege, numeric calibration, new production award or War Room shortcut is asserted by this code.
