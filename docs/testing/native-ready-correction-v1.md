# Atomic native READY correction/rebind V1 — issue #106

11 October 2026. Based on `main` **78ec0b3c3d4f8bc1ed6c57a92a4598e68fb18259**. PR #105 is independent and was not incorporated. This is an unmerged, disabled-by-default staging/demo experiment, not normal native upload activation.

## Implemented boundary

`adminPublishNativeReady` now accepts `CORRECT_REBIND_V1` in the **existing** publisher. The same preflight, pinned artifact reads, native detail/social adapters, experience construction, source document and final Firestore transaction are reused. Ordinary `PUBLISH` still refuses recording-bound or disputed results. No alternative READY writer, extraction model, social interpretation, website or reward rule was introduced.

The new operation requires all existing publication gates plus `AOF_NATIVE_READY_CORRECTION=reviewed-v1`. None is enabled by this change. Production remains forbidden. The requesting ACTIVE ADMIN must be the candidate validator and retain the same auth-link identity.

Additional request field:

```json
{
  "operation": "CORRECT_REBIND_V1",
  "correction": {
    "disputeId": "exact-open-dispute-id",
    "resolution": "CORRECT",
    "outcome": {"type": "TEAM_WIN", "winnerTeam": 2, "winnerPlayerId": null}
  }
}
```

The existing required Match/Game/candidate IDs, replacement source SHA, statistics artifact SHA, expected old source SHA, old statistics/result revisions and reviewed reason remain mandatory. `outcome` must equal the result engine's normalized output for the current Match roster/rules. The replay winner is not reinterpreted or substituted for the reviewed official outcome.

Supported: one accepted, recording-bound, single-Game human Match; exactly one Game document; one active OPEN WRONG_REPLAY or WRONG_RESULT dispute; a distinct native candidate validated against that disputed authority. Existing human Matches with absent `opponentKind` retain the established HUMAN default. AI markers, series, unrelated Match results, native predecessors, source collisions, missing/mismatched old claims, history/job collisions and non-disputed replacements fail closed. Same recording SHA with another extraction is excluded because its immutable replaySources ID would collide; a different recording SHA of the **same GUID** is supported only under the same owning Match/Game.

## Preflight and transaction

Preflight requires the validation binding token to match the entire current disputed Game, Match, roster-player and administrator/auth-link snapshot. This is deliberately conservative: unrelated changes to those documents may require validation again. Current explicit recording bindings or verified Steam-name/history resolution must agree with every candidate slot-to-league-player mapping. Replay-local slots never become league identities.

Original/events/statistics are read at their pinned Storage generations and checked by length/hash. Correction additionally reuses the streaming event verifier for decoded hash, chronology, extraction/header player bindings and footer completeness. Artifact revision is recomputed from the compressed event/statistics identities. The existing native shared-statistics decoder validates provenance and decoded statistics integrity; social qualification and the complete bounded experience are rebuilt using the proposed corrected official revision. No stored artifact is rewritten or deleted.

The single transaction re-reads Game, Match, all Game IDs, dispute, prior source, candidate, target source/journal collision, administrator/auth link, roster players, both GUID claims, current/legacy/new processing jobs and history collisions. It compares the full preflight authority snapshot before writing. Reads precede writes, including transaction retries.

```text
BEFORE (disputed)
  Game + Match: result Rn, binding SHAold, active SHAold, statistics Ss
  dispute D: OPEN; old GUID belongs to this Match/Game/SHAold
  candidate C: VALIDATED_NOT_READY; new source absent

ONE COMMIT
  history Rn <- previous Game/Match result and old recording binding
  Game + Match -> ADMIN_CORRECTED R(n+1), normalized reviewed outcome
  Game binding + active source -> SHAnew; statistics -> S(s+1), READY
  candidate C -> PUBLISHED_READY; immutable native source + journal + audit created
  dispute D -> RESOLVED_CORRECTED
  old pending/blocked jobs -> SUPERSEDED; completed jobs preserved
  new MATCH_RESULT_<match>_R(n+1) -> PENDING, previousRevision=n, correctionCaseId=D
  GUID transition -> same transaction

AFTER COMMIT
  existing processors reconcile ledgers against the current canonical revision
  publisher itself writes no awards, points, Gold, Reputation or Relationships
```

Canonical acceptance and job construction reuse `applyCanonicalGameResult`. Its result construction was extracted into a pure preview used by both paths so projected and committed winner/loser semantics cannot diverge. The helper accepts a pinned acceptance timestamp and an already-read job reference; legacy callers keep their existing defaults.

## Claims, retry and rollback

- Different GUID: require the old claim to match the exact old source and the replacement GUID to be unclaimed. Release the old claim and create the new one atomically. Another Battle can subsequently claim the old recording legitimately. Both prior claim snapshots are retained in the journal.
- Same GUID: require exact old Match/Game/source ownership and update that claim's source/candidate attribution. Audit distinguishes an updated claim from a newly created claim.
- Another Battle's claim is never reclaimed or removed. An unexpected same-Battle source attribution is also refused.
- Exact retry requalifies active Game/Match outcome, source/artifacts, candidate, journal, corrected dispute, immutable history, current new GUID ownership and revisioned job in a read-only transaction. It creates no revision or awards. If a competing call committed after preflight, the loser aborts; retrying the original request returns the existing publication.
- Source-only emergency rollback explicitly rejects correction journals, even if a later writer removes the recording binding. Inverse correction/rollback and native-to-native corrections require a separate protocol. Independent-result publication/rollback remains regression-tested.

## Validation

`cd functions && npm run lint && npm run build && npm test`: **347 passed, zero failed/skipped**. Includes **56 new correction tests**, the unchanged ordinary-PUBLISH recording-bound refusal, independent publication/rollback, replay-driven legacy correction, native result-resolver and Season-points regressions.

New cases cover both dispute categories, invalid/absent/stale dispute and result revisions, invalid normalized winner, same/different GUID ownership, missing/colliding jobs/history, native predecessor, revoked identity, switched mapping, pinned generation and compressed/decoded corruption, rehashed invalid chronology, extraction/completeness mismatch, disabled gates, preflight-to-transaction races, late competing commits, exact and changed retries, rollback refusal and ledger reconciliation.

A real **local Firestore + Storage emulator** run also passed, using the existing synthetic native-publication fixture and the replay-driven legacy result corpus. It checks pinned artifacts, authority revocation during downloads, two concurrent corrections (one commits, one aborts), idempotent retry, a single new job/journal, preserved old source, claim transition, and two concurrent actual rewards-processor calls. A winner change reconciles Gold 3/1 -> 1/3 and current Main-event points to 4/10; repeat processing, a stale completed job and the native source resolver produce no duplicate ledger entries. The mock separately covers superseded blocked jobs and same-GUID transitions.

Reproduce on a **fresh isolated** demo emulator (after building functions), from repository root:

```text
firebase emulators:exec --project demo-aof-native-correction --only firestore,storage "node functions/tests/native-ready-correction-emulator.mjs"
```

The script refuses any other project, non-loopback emulator endpoints or a pre-existing test Match. This run used a local-only config with Firestore 18485 and Storage 19199 to avoid other emulator sessions. It does not start Functions triggers or use a real worker/cloud endpoint. [Machine-readable result](benchmarks/native-ready-correction-v1/emulator-report.json).

## Remaining limits and review focus

- No deployment, cloud/operator flag change, live data, merge or automatic upload activation. Read/write flags in tests are isolated fixture configuration only.
- Tests establish transaction and processor-function behavior, not automatic Functions event delivery, every in-flight downstream processor, browser flows or real build-185872 cloud acceptance. Complete trigger-driven reconciliation (including power-rating/history and all social/Chronicle consumers) remains a controlled-staging release gate.
- Full recording benchmarks were not repeated: extraction/statistics models did not change. Emulator test duration is not upload-to-READY latency.
- Old jobs already running may resume through existing processors, which resolve current Match authority; rewards are transactionally revisioned and reconciled. This task does not claim new global scheduling or lease guarantees for all downstream processors.
- Firestore cannot atomically lock Cloud Storage object availability with its commit. Generation-pinned reads and immutable hashes establish verified evidence at preflight; operational retention/access controls must prevent privileged deletion afterward. No client-side arbitrary Storage URL or artifact mutation is added.
- Exact retries conservatively reject later corrections/disputes, changed history or altered source authority. Native-to-native replacement and inverse correction rollback remain deliberately unsupported.

Review the canonical preview/commit equivalence, final authority fingerprint, claim release/update predicates, create-only histories, deterministic job collision fence and correction retry/rollback exclusions before any staging authorization.
