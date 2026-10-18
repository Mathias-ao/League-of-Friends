# Chronicle #125 factual read bounds and #140 / INT-V1 handoff

Status: **read-only, default-off application state**. This is a query/test contract, not a production latency benchmark, scoring policy, deployment or feature activation.

## Complete-or-error resource envelope

The owner-authenticated `getPlayerChronicle` callable has a 120-second function timeout. `readSocialHistory` scans **all** league Matches twice with Firestore document-ID cursors (64 IDs/page), including noncompleted Battles; it checks an elapsed 100,000-ms budget at page, Match, Game, checkpoint-batch and projection boundaries. A blocking external RPC may run until its own timeout; the budget is a fail-honest guard, not a hard cancellation or guaranteed 100-s latency SLA.

- Max **256** league Match documents considered per read. At 257 it throws `resource-exhausted`, never returns a complete-looking prefix.
- Max **768** Game documents enumerated across eligible Matches per read, likewise complete-or-error.
- For `M` scanned Matches, Match page calls: `2 × (floor(M/64)+1)` (the extra empty cursor page is required for an exact multiple of 64). Game-list queries: up to `M`; source read + artifact download: up to one of each per Game with active source (<=`G`); Event/Season admission reads: up to `2M`; native GUID checks: up to `G`; final optimistic `getAll` rechecks cover every initially listed Match, every eligible Game, selected READY source and participating Event/Season/GUID document. **All** Match IDs are re-enumerated after revalidation, detecting insertion/removal during an optimistic read.
- At cap, worst-case sequential I/O can exceed 120 seconds under real network latency. Such histories are not claimed supported within SLA: the request fails rather than silently omitting Battles. A future indexed, revision-pinned materialized history or true resumable snapshot pagination is necessary for longer/denser leagues, but is **not** installed or implicitly activated by this PR.
- Tests use deterministic Firestore/Storage stubs, **not** measured production latency. A correction-heavy authenticated test with **145 Battles / 289 Games** asserts all evidence is enumerated in **6 Match-page calls, 145 Game-list queries and 289 artifact downloads**, full owner/other-account books, correct revision fencing, stable scene IDs and source correction. A 257-Battle test asserts fail-before-download. Existing real-source integrity checks and native replay acceptance remain gated, no staging E2E performed.

## Canonical scene/result boundary

`sceneId = chronicleSceneId(battleId, ownerPlayerId, counterpartPlayerId)` from merged `AOF_SOCIAL_V1_SHARED_1`: league `battleId === matchId`; identity never includes Game, beat, source, outcome, prose or correction revision. `sceneRevision` hashes current source lineage, beats, chronology and **aggregate** Battle result.

A Game's `currentOfficialGameOutcome` is used for the **Game-specific** factual review and any legacy shadow input; it is never the aggregate `ChronicleScene.result`. Aggregate Battle outcome is `OFFICIAL` **only** if the authoritative completed Match has a valid revision, verified roster-winning player IDs, no dispute, **all** Games have source-backed admitted reviews and independently accepted official Game results. Otherwise `{qualification:'UNRESOLVED',resultRevision:null,winningPlayerIds:null}`. Pending ordinary READY Game sources remain factual-only. E's C1 `group.resultStatus` is derived from this aggregate, with `group.chronologyQualified` and prior-only context; no prose composer changes.

The source-linked read-only fixture is `functions/tests/fixtures/chronicle-scene-handoff-v1.json`; executable conformance is `functions/tests/chronicle-scene-handoff.test.mjs`. It separates internal `sourceLineage` / `sourceQualifiedBeats` from public allowlisted prose/status/scene fields. It does not produce a qualified social claim, judgment, receipt or award.

## Deployed legacy browser identity and INT-V1

The existing parchment stores seen IDs in browser `aof:chronicle-seen:<ownerId>:<counterpartId>` arrays. It also selects a page by counterpart player ID. **Neither contract is edited here.** The public `entryId` continues exactly the deployed old format:
`AOF_PLAYER_CHRONICLE_V1:<ownerId>:<counterpartId>:<battleId>:<comma-joined-beat-ids-or-exposure>`.
Unchanged existing pages therefore retain their exact browser seen key/entry ID and bookmarks. Source-beat correction can change that legacy suffix, just as before; `sceneId` remains immutable. The pure `chronicleWasSeenByLegacyId(storedIds, entry, ownerId, counterpartId)` proves old IDs can be matched to the corrected scene by the **exact** owner/counterpart/Battle prefix, not by pair alone. Tests cover false-positive cross-owner/other-Battle prevention.

**INT-V1 handoff (Sol-owned web files):** before switching the web new-ink comparison to canonical `sceneId`, migrate each existing per-pair localStorage seen-ID array by matching its exact prior legacy prefix and inserting the corresponding `sceneId`. Do not delete legacy values before upgrade, do not treat every old scene as new, and do not overwrite unrelated bookmarks. Display `resultStatus==='UNRESOLVED'` and `chronologyStatus==='UNRESOLVED'` neutrally. `web/src/domain/league.ts` and `web/src/ui/PlayerChronicleBook.tsx` are explicitly **excluded** from #136 for Sol INT-V1; without that later wiring, browser new-ink behavior after source changes stays as before, not yet magically migrated. Worker E #140 consumes the immutable scene and result guards as pure presentation inputs.

No awards, flags, policy calibration, testimony writes, staging or deployment.
