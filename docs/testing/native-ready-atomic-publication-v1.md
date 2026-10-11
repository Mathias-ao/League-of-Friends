# Native READY experimental atomic publication and rollback V1

Status: **implemented behind disabled-by-default operator gates; staging/demo only; no staging or production deployment has been authorized or performed**. This code does not switch ordinary uploads to native, resolve a Game winner, score social relationships, approve a result correction or automatically activate a native validation candidate.

## Purpose and contract

The legacy CanonicalReplay source remains the default published Game statistics. Native Recorded Events ingestion continues to stop at `VALIDATED_NOT_READY`. The new `adminPublishNativeReady` callable is a **manual, audited, administrator-reviewed** bridge for a pre-existing qualified Game, not a general native upload-to-READY release.

Two operations exist: `PUBLISH` and `ROLLBACK`. Both require a pinned candidate ID, source SHA-256, compact-statistics SHA-256, current official Game result revision, current replay-statistics revision, expected active source pointer (null is permitted), and a detailed administrator reason. A candidate can publish only once. An atomic rollback is available after successful publication, but republishing that same candidate after rollback is deliberately blocked.

### Independent permission gates

- **PUBLISH:** active ADMIN who validated the candidate; existing strict native validation gates (explicit `AOF_NATIVE_REPLAY_INTEGRATION=validate-v1`, project matching `AOF_NATIVE_REPLAY_PROJECT`, staging or emulator demo project, Game allowlist, pinned 64-character processor SHA, authenticated native worker), plus `AOF_NATIVE_READY_PUBLICATION=reviewed-v1`, `AOF_NATIVE_READY_GAME_ALLOWLIST` containing the exact Battle/Game, and both `AOF_ACTIVE_NATIVE_PLAYER_READS=1` and `AOF_ACTIVE_NATIVE_SOCIAL_READS=1`.
- **ROLLBACK:** any currently authenticated, ACTIVE ADMIN, still restricted to a matching staging/demo project, the exact independent READY Game allowlist, the pinned processor revision and `AOF_NATIVE_READY_ROLLBACK=reviewed-v1`. It **does not depend** on the native validation, publication or player/social read flags. An incident can disable all native reads before emergency rollback.
- No publication/rollback operation is permitted for the production project. All operator gates are absent/off by default.

### Supported source transitions

A source may publish only if the current Game and Battle are COMPLETED, its **current canonical Game result is OFFICIAL and not disputed**, the reported result and recording revisions exactly match the administrator's request, and there is **no existing recordingResultBinding**. The accepted outcome must be independently player/admin confirmed rather than derived from another active recording. Recording-bound official results, unresolved outcomes, AI warm-ups and any opened dispute are refused for PUBLISH.

A previous legacy READY source with **a different source identity** may be replaced only if the accepted result is independent of that source. The previous source is never overwritten or deleted. Native source ID collisions and previously activated native source predecessors fail closed; returning to an archived native source requires a separately reviewed versioned publication protocol.

The Game must have a unique approved roster, with all recorded player slots mapped exactly once, and the candidate's original immutable recording must be retained. The stored source, events and statistics are read from their pinned Storage generations and checked by byte count/SHA-256, with dual compressed/uncompressed statistics hashes, extraction/version provenance, match-facts and neutral social evidence checks. The current official Game result is **not** inferred from the recording. The complete Stage/Event/Season player read model is reprojected from the verified compact native artifact under the Game's new revision. The candidate's stale `previewExperience` is not treated as current qualified statistics.

The global canonical Game GUID claim is checked in the same authority domain as legacy recording results. A GUID claimed by another Battle is never reclaimed by this operation. When the publisher created the claim, rollback removes only that claim, with its original identity checked in a transaction.

### Atomic transaction

After preflight verification, a single Firestore transaction rechecks the administrator/auth link, Match, Game, roster players, candidate, source-collision state and GUID claim. If any input changed during verification, the transaction aborts. It then creates the native READY replaySources document **once**, creates a permanent publication journal, atomically switches `Game.activeReplayStatisticsId` and increments `replayStatisticsRevision`, marks the candidate published, records the unique Game GUID claim if necessary and creates an audit entry. It never changes the canonical result, result history, source bytes or original replay. Regular existing current-source triggers/readers may subsequently rebuild their authoritative derived totals; no new points/relationship rule is invoked by this callable.

### Retry and global-claim invariants

A publication retry does not rely on a previously observed journal or blindly report `READY`.
It re-reads the **current** Game, Match, ADMIN membership/Auth link, candidate,
source, journal, claim and any previous legacy source inside a read-only Firestore
transaction. It requires the active source to pass the complete current
`AOF_ACTIVE_NATIVE_STATISTICS_V1` reader contract, including official result,
source/schema, roster, statistics hash, match-facts and Season showcase binding.
A dispute, changed official winner, replaced source, revoked administrator,
altered immutable predecessor or transferred GUID claim fails closed; retries
never increment the revision, create a new publication or mutate scoring.

If the GUID was already claimed by this same Battle before native publication,
the journal records an immutable fingerprint. Neither a retry nor rollback
accepts that historical claim changing while the native source is active.
If the publisher created the claim, rollback requires it still to belong to
the exact Match/Game, native source SHA and candidate **both before and inside**
the transaction; a claim transferred to another Battle is never deleted.

These hardening checks are separate from full Firebase emulator/concurrent
transaction acceptance. Existing rollback journals created before claim
fingerprinting continue to require consistent claim ownership but cannot
retroactively prove a prior claim's exact contents.

### Rollback

Rollback requires the published source and exact official-result binding still to match the journal. The previous immutable legacy source must still exist, or the initial no-source pointer is restored. The rollback transaction **increments** the replay-statistics revision again, restores the old active pointer and Game replay state, marks the journal and candidate rolled back and records an audit; it retains the published source and permanent original recording for forensic review. A later correction or source change blocks stale rollback. A formally opened dispute may remain open during rollback if the same dispute ID and `DISPUTED` status are present on Match and Game: rollback does not close the dispute or allow scoring through it.

Replay-statistics identifiers alone cannot authorize re-publication, and neither the UI nor upload flow calls this operation automatically. All regular native/detail/social Game readers remain tied to the active published revision.

## Acceptance and remaining blockers

CI tests exercise an actual preflight parser/read-model projection from a stored native compact fixture, Game/source/candidate/claim/journal transactional mock, pinned generation checks, idempotent publication, legacy-pointer restoration, monotonic rollback revision, permission and processor boundaries, cross-Game GUID exclusion, result/correction binding checks, storage corruption, changes during preflight, dispute-preserving rollback, and emergency rollback while player/social flags are disabled.

**Not yet qualified for live enablement:** a result-confirming native upload-to-READY pipeline for Games without an independently accepted official result; the full reviewed dispute/result-rebinding transaction for replacing a recording-bound outcome; true transaction/concurrent emulator and cloud tests of triggers, scoring reconciliation and rollback after cache updates; full real 185872-build cloud/browser detail/social parity, load and the 20-second upload-to-READY goal; staging deployment and production release acceptance. No user source-retention or rollback governance changes are authorized by this PR.

The historical `VALIDATED_NOT_READY` candidate blockers remain meaningful as production-release gates even when an exceptional manual staging/demo publication is reviewed. A source should not be described as production-ready merely because this experimental transaction can commit in a controlled environment.
