# Recorded Events V1: assessment and review proposal

10 October 2026. Stage A assessment plus isolated Stage B experiment; **not production approval**.
Audited `main`: `c915a9a90572063093743d1fd23d022ea42ee536`. Baseline work:
[draft PR #83](https://github.com/Mathias-ao/League-of-Friends/pull/83), head
`cd660d8fa894be2ad790bdf11c4b14af7d7480e7`. Its harness is reused and extended,
not replaced. See [measurement report](../testing/recorded-events-benchmark-2026-10-10.md).

## Recommendation

Keep Firebase and the League → Season → Event → Match → Game domain. Retain
**one compressed Recorded Events object per extraction revision in Cloud Storage**,
with small immutable metadata and active references in Firestore. On eventual
approved cutover this **replaces** the canonical ZIP as retained gameplay evidence.
Do not permanently store Analysis V5, the original recording, and a canonical ZIP
alongside it. Versioned derived statistics/presentations can be disposable caches.

This recommendation does not mean the experimental schema is ready to replace
CanonicalReplay. Current statistics equivalence is necessary but insufficient:
initial resource decoding, future observation coverage, peak memory, publication
protocols, and server/browser transfer still need gates below. Keep current
production unchanged until those gates pass.

The latest user decision supersedes the September extraction contract's requirement
to retain unknown raw bytes forever. That historical contract and its hashes are
left intact. Core Identity and Current State still accurately describe the current
CanonicalReplay implementation; the new retention policy is a proposed successor.
Reputation/Relationship direction is approved product intent; current social
scoring is shadow/disabled. No algorithm is approved merely because this document
describes its possible evidence needs.

## What stays, and what needs attention

| Area | Implemented evidence and disposition |
| --- | --- |
| Competition domain | Keep authoritative Game results, disputes, eligibility, participant bindings, scoring snapshots and revisioned result-processing jobs. `recordingResult.ts`, `recordingMatchFacts.js`, and `processMatchRewards.ts` separate qualified recording outcomes from official acceptance and ledger reconciliation. |
| Points and social authority | Keep `AOF_SEASON_POINTS_V1`, designated scoring slots, best eligible warm-up selection and audited corrections. Keep measurements, neutral pair evidence, social qualification and rewards separate. A detector rerun must not invoke reward processing or change accepted outcomes. |
| Extraction | `parse_replay.py` produces CanonicalReplay 1.1, full raw frames and header prefix, decoded header, initial objects and terrain; `canonical_run.py` seals them. Whole frame Base64 and unknown-byte Base64 duplicate evidence on partial operations. Decoded header repeats initial objects/terrain already stored separately. |
| Analysis | `analysis_dataset.py` already enables replay-free statistics. V5 retains compact actions plus body command tables, per-second counts, fundamentals, cameras, header candidates and initial objects. This is a useful compatibility interface but duplicates evidence and mixes observations with derived summaries. |
| Current statistics | `statistics_projector.py` constructs all five categories, temporal episodes, Pair Social Evidence, episode context and match facts from V5. Preserve formulas/versions in this experiment. Reference catalog selection remains build-specific and unqualified beyond its existing gates. |
| Upload/worker | Browser reads bytes → binary string → Base64 → callable → worker JSON. Worker decodes, writes temp source, builds/validates canonical, projects stats, embeds stats in ZIP, returns ZIP Base64 **and full stats JSON**. Function decodes ZIP, compresses stats, uploads both and downloads each again for verification. Several full copies coexist. |
| Persistence | `uploadReplay.ts` has good source hashing, roster mapping, stored-byte verification and transactional active publication. `replayStatisticsStorage.js` correctly supports gzip/legacy JSON and dual hashes. Preserve these guarantees; avoid the redundant statistics copy inside the future evidence object. |
| Revision coupling | `replaySources/{sourceHash}` combines recording identity, extraction, projection and player mapping; a READY same-source upload returns early. This prevents a new extractor revision for verified identical bytes. Source-hash-only object paths also allow concurrent same-source workers to overwrite before the winning Firestore transaction: different extraction IDs/bytes can disagree with published hashes. Use immutable attempt/revision paths and generation preconditions. This race is a code finding, not a reproduced cloud incident. |
| Browser retrieval | `getReplayStatistics.ts` downloads, inflates, interprets and returns the entire statistics object; no bounded episode/detail retrieval. `getStatisticsExperience.ts` uses a smaller read model but can hydrate legacy sources during a player request. The gzip storage fix does not bound worker or browser JSON responses. Prefer compact summaries plus paginated detail, with hydration moved to jobs. |
| Current aggregation | `statisticsExperienceProjection.ts` reads authoritative current sources, detects scope changes and replaces read models transactionally. Retain that correctness. It reads the league and writes the player × season product; game, match and source triggers each call a whole-league rebuild. Cost/conflict/retry amplification is a capacity risk. |
| Older aggregation | `rebuildReplayPlayerStatistics.ts` deletes via BulkWriter, then recreates via a second BulkWriter; idempotency reservation follows mutations. `replayRecordsProjection.ts` repeats delete-before-recreate; `rebuildReplayRecords.ts` reserves idempotency afterward. Failures can expose empty/partial models. Do not reuse these workflows for new historical processing. |
| Social history | `socialHistoryRead.ts` verifies compressed bytes then directly JSON-parses them on audited main. Fixed separately in [PR #88](https://github.com/Mathias-ao/League-of-Friends/pull/88), with gzip/legacy equivalence and corruption regression tests. Its 100-completed-Match bound and sequential downloads remain; follow-up should bring source and collection-membership consistency checks up to the newer statistics reader's standard. |
| Access and environment | Existing server-only Storage rules and callable authorization stay. No deployed database inventory or traffic measurement was performed. This work uses local repository fixtures and local generated files, never synthetic emulator state or real league mutations. |

## Concrete V1 observation contract

Machine schema: [`recorded-events-v1.schema.json`](../../replay-tools/schemas/recorded-events-v1.schema.json).
Implementation: [`recorded_events.py`](../../replay-tools/recorded_events.py).
Version is explicitly `AOF_RECORDED_EVENTS_V1_EXPERIMENTAL`, schema `1.0.0`.

The single gzip JSON object contains:

| Field | Retained meaning |
| --- | --- |
| `source` | SHA-256 and original byte length. Same recording bytes have the same identity; separate POVs remain separate sources even for the same Game. |
| `extraction` | Upstream extraction run, decoder/exporter code hashes and versions, converter hash, retention version and local conformance state. Stored/uncompressed dataset hashes identify the exact converted object. A locally sealed run is not proof of remote persistence. |
| `context`, `recordingHeader` | Raw replay player IDs/names, recorder identity, civilizations, lobby groups, initial diplomacy, game/map settings, build/mod candidates, map dimensions/coordinate system, restored-game context. No league player binding or interpretation of teams as effective alliances. The small legacy-compatible context retains overlapping setting candidates deliberately until semantic normalization is reviewed. |
| `events` | One fixed-width row per **original operation**, including SYNC, ACTION, VIEWLOCK, CHAT marker, POSTGAME, START, SAVE and UNKNOWN. Index is the original ordinal, with stable local ID `op-%09d`; do not filter/re-sort. IDs are globally qualified by source + extraction. |
| Event row fields | Exact integer replay-relative milliseconds; operation/type; action code/name; actor/target player IDs; selection IDs in original order; target instance; raw entity identity; position/end position; general decoded parameter map; decode status/warning codes; recorded sequence; relevant decoded layout scalars. See `eventColumns` for exact order. |
| `initialObjects` | Separate initial-state namespace `initial-object-%08d`, owner, type, class, instance, source block, position and entity qualification. Includes resource nodes as decoded objects, not invented remaining quantities. |
| `terrain` | Width/height, row-major `[terrainRaw,elevation]` per tile; x=index%width, y=floor(index/width). Preserve raw terrain integer (including negative/special values); decoded terrain ID can be derived under a versioned rule. |
| `completeness` | Operation/object counts, framing, observed clock end, restore time, partial object search, missing initial resource amounts, omitted chat content/raw bytes and explicit lack of full semantic coverage. Complete framing is not complete gameplay observability. |
| `legacyCompatibility` | Small historical provenance and qualification envelope for exact current output comparison, including the old header reference. It contains no second event/history representation. Old strings claiming raw archival retention are historical compatibility output, **not the new retention guarantee**. Replace these strings and reference paths in a separately versioned production projector before promotion. |

Chronology validation replays every SYNC increment and checks every operation's
timestamp against that clock, checks row widths, identities, terrain cardinality,
counts and framing markers. Dual SHA-256 checks bind compressed bytes and exact
uncompressed JSON; decompression is bounded to declared length, at most 512 MiB.
Missing/unknown observations remain explicit. Gzip hashes alone are not trust in a
client's evidence: the future server still computes them from its trusted worker.

**Retain broadly useful decoded operations, not chosen statistic themes.** Queue
quantities remain signed; missing amounts remain null. Research is a request;
construction is placement; target/selection IDs do not imply owner, survival or
completion. Layout observations preserve producer type and disconnected/resign
qualification currently lost from V5 actions. Keep unknown actors/operations as
observations/markers even when current player statistics ignore them. Selections
do not silently inherit forward or backward; model-specific reconstruction happens
downstream. Recorder camera scope is explicit and cannot become all-player vision.
Postgame payloads retain decoded fields and their partial status, never auto-award
official outcomes.

**Do not retain** original source/header bytes, raw/unknown Base64 escapes, parser
failure prose, sync checksum blobs, opaque unknown layout fields, duplicate body
command lists, per-second activity tables, fundamentals, detector episodes or
scoring inside the event artifact. Chat content is excluded in this experiment;
player/channel/taunt metadata and operation ordering remain. Authenticated system
message extraction is a separate gap, not inferred from unqualified human text.
External backup or hash-verified reupload is required for discarded bytes needed
by future decoders. Artifact revisions referenced by history are immutable; later
garbage collection is separately approved and reference-aware.

## Important gaps exposed by the experiment

1. **Initial resource values are not decoded.** Pinned `mgz-fast` reads past the
   player resource array. Initial resource-node observations and starting-resource
   settings are retained, but must not be presented as player stockpiles. Qualify
   a version-scoped decoder extension before claiming full V1 initial conditions;
   legacy sources may remain explicitly unavailable or require reupload.
2. **Terrain elevation input is currently missing.** Canonical stores terrain at
   `initialState.map.terrainStore`; Analysis V5 looks at `initialState.terrainStore`.
   The experiment retains the true terrain but reproduces today's empty elevation
   input for current projection. Fixing that path changes some inference inputs
   and needs an explicit new projection revision and reviewed expected differences.
3. **No complete object lifecycle/world simulation.** Initial object search skips
   classes; automatic combat, engine acceptance, actual resource flow, later-created
   objects and movement are not fully observed. Future models must qualify these
   gaps rather than interpret missing evidence as zero cooperation/raids/damage.
4. **Compatibility is not a semantic endorsement.** Exact old statistics may retain
   old defects. Current predicates, chronology and uncertainty are preserved, while
   improvements must be named, versioned and reviewed independently.

## Firestore versus Cloud Storage

Official references checked 10 October 2026: [Firestore limits](https://firebase.google.com/docs/firestore/quotas),
[billing](https://firebase.google.com/docs/firestore/pricing),
[storage accounting](https://firebase.google.com/docs/firestore/storage-size),
[Cloud Storage pricing](https://cloud.google.com/storage/pricing),
[object generation preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions).
Firestore's document limit is 1 MiB including overhead. Gzip is application-level;
store compressed binary fields without indexes, not Base64 strings or nested rows.

The benchmark measures actual independently compressed, record-aligned batches,
bisected below 900 KiB, including context/object/terrain documents. It does not
pretend `ceil(singleGzipBytes/limit)` models independent compression.

| Consideration | Firestore batches | One Cloud Storage object + Firestore metadata |
| --- | --- | --- |
| Permanent representations | Can be the sole canonical dataset, if chosen | Can be the sole canonical dataset; replace ZIP |
| Operations | N payload documents + manifest per revision; N payload reads per full projection | 1 object creation + verification GET; 1 GET per cold full projection; metadata reads/writes |
| Costs | Document operations, binary payload storage, document/index metadata and applicable transfer | Object storage, Class A/B operations and applicable transfer; Firestore only small metadata |
| Retrieval | Parallel bounded batch fetch; multiple RPCs/retries; chunk order/completeness verification | One sequential compressed download; gzip whole-object reads for full projection |
| Querying | Compressed payload is not queryable; a second query index would need separate justification | Not queryable; use small derived projections for browsing |
| Integrity/publication | Immutable chunks, digest manifest, count/order validation, atomic ready pointer; interrupted chunk uploads leave orphans | Immutable generation/path, object length + dual hashes, verify download, atomic Firestore ready pointer; interrupted objects leave orphans |
| Recalculation | Decode all relevant chunks; random access only helps if algorithms can genuinely avoid history | Decode once per job and share the in-memory history among detectors |
| Complexity | More permanent files avoided, but chunk manifests, document overhead and index exclusions added | Already-used infrastructure; simpler artifact identity and retention |

For a private league, **do not claim a material dollar saving without workload and
bucket/database location**. Let N be measured payload-document count, D total bytes,
G cold projections: compare `(N+manifest writes)*writeRate + G*(N+manifest reads)*readRate
+ D*FirestoreStorageRate` with `objectCreateRate + (1+G)*objectGetRate
+ D*StorageRate + metadataFirestoreCosts`, plus transfers, document/index overhead,
retry work and old revisions. Free tiers and billing currency can dominate small
usage. No deployed cost/latency measurements or region inference from function
`europe-west1` are claimed. Real-cloud p50/p95 needs an approved nonproduction run.

Storage wins here on simplicity and immutable artifact fit, not magical query
speed. The experiment's gzip JSON adapter inflates and rebuilds tables; it can be
slower and use more memory than V5. Keep compact UI read models and consider a
streaming event reader/direct extractor only after measuring, preserving one
authoritative representation.

## Four identities and atomic publication

Proposed additive path under each Game (names subject to implementation review):

```text
replaySources/{sourceSha}                       source bytes identity only
  extractions/{extractionId}                    immutable RED metadata
    projections/{projectionId}                 immutable measurement manifest
Game.activeEvidence                            sourceSha + extractionId
Game.activeStatistics                          extractionId + projectionId + bindingRevision
Game.canonicalResult / existing result jobs     independent accepted-result authority
```

Storage path: `replay-evidence/{matchId}/{gameId}/{sourceSha}/{extractionId}/events.json.gz`.
Projection cache lives outside the evidence object and identifies its dataset
hash, code/model manifest, catalog hashes and player-binding revision. Extraction
ID binds source, extractor/decoder code, retention/schema and output content;
timestamp/run UUID is audit identity, not a substitute for a content digest.
Interpretation revision binds rule configuration and accepted-result revision plus
explicit projection dependencies. It never advances merely because a measurement
cache was recomputed.

Worker writes an immutable, create-only generation, verifies bytes and lengths,
then a Firestore transaction checks current source/binding/result prerequisites
and publishes READY metadata/active references together. Losing attempts cannot
overwrite winning bytes. Deterministic request keys prevent duplicate work; verify
existing output on retry, do not assume matching paths mean success. An upload
success does not mean publication succeeded. Clean abandoned attempts only after
lease expiry and reference checks. No source deletion until durable verification
and accepted publication; failed uploads have bounded diagnostic retention.

Verified reupload: recompute original SHA/length server-side, require exact match
to declared source, allocate a **new extraction revision**, and preserve the old
revision. A changed recording is a new source and uses existing dispute/correction
gates. Mapping corrections create a new binding/projection reference; never edit
raw replay identity. Two POVs never silently merge into a fabricated single view.

## Bounded historical recalculation and recovery

Keep existing correct small-league transactions until the replacement is tested.
New jobs use the existing Firebase worker/processing infrastructure, not another
service. A player request enqueues or reads status; it never processes all history.

1. Admin creates a scoped job with request key, model/catalog/config hashes,
   intended extraction selection and expected active input revision. Transactionally
   reserve it **before** any effects. Use `PENDING → RUNNING → VERIFIED → PUBLISHED`,
   with RETRYABLE_FAILED, FAILED and CANCELLED outcomes and retained audit errors.
2. Discover stable, ordered Game inputs in pages (initial target 25 Games/page),
   writing immutable input manifests. A cursor alone does not freeze history.
   Require a per-scope input epoch checked at discovery and publication; every
   authoritative eligibility/result/source/mapping change must increment it in
   that same mutation transaction. An asynchronous trigger counter alone is not
   sufficient. Until all mutation paths support this, use bounded scope or the
   current coherent transaction, not a claimed consistent league-wide snapshot.
3. Leased tasks project one Game at a time, with bounded retries/backoff/timeouts.
   Key each task by dataset hash + projection manifest + binding revision. Store
   immutable outputs/checkpoints and compare hashes on retries. Expired leases
   can be reclaimed. A crash never clears the last good published view.
4. Build aggregate documents under a **new generation**, with explicit empty and
   excluded contributions. Validate expected input counts and output digests;
   unavailable inputs remain unavailable and cannot become zero samples.
5. A short transaction checks epoch and generation completeness, then swaps one
   scope manifest pointer. Readers pin that generation for their whole request.
   Corrected inputs abort or supersede a stale job. If coherent cross-scope views
   are required, publish one root manifest pointing to all scope generations.
6. Rollback swaps a reviewed pointer to a retained compatible generation; it does
   not undo accepted result corrections or reward ledgers. Retire old generations
   only after retention/reference review. Record input/result revision differences.

## Phased migration and approval gates

| Priority / phase | Bounded change and gate |
| --- | --- |
| P0 now | Review/merge PR #88 independently. No deploy implied. Flag legacy delete/recreate admin workflows for replacement before another rebuild; keep current newer atomic read-model path. |
| P1 experiment | Review schema/retention omissions and measured equivalence. Keep converter offline, with no worker/Functions import. Compare all current outputs, not a curated handful. Preserve archive/source-unavailable tests and corruption tests. |
| P1 reliability | Focused follow-up for immutable revision paths/create-only Storage writes and publication race regression; bounded statistics/detail responses and asynchronous source hydration. These address actual architecture risks without changing formulas. |
| P2 extraction | Qualify initial-resource/system-message needs and direct emission from decoded operations. Direct event-first extraction must retain chronology/hash/coverage validation; do not simply skip canonical verification and call that production safe. Benchmark ≥3 independent runs/fixture/mode and realistic worker memory/transport. |
| P2 revision jobs | Implement additive extraction/projection identities and bounded generation jobs. Test duplicate delivery, crash/retry, simultaneous uploads, correction during build, stale pointer CAS, missing blob, digest mismatch and publication rollback in isolated emulator data. |
| Review gate: staging | Approve exact schema/model/omission policy and deployment environment. Exercise authenticated uploads, cloud operation latency/cost, payload ceilings, authorization and correction handling with approved test Games. No synthetic identities carried into production. |
| P3 legacy conversion | Inventory existing source manifests read-only. Convert verified canonical archives to RED as offline candidates. Confirm exact old-stat equivalence and qualified completeness per source. Missing/incompatible evidence remains a documented legacy exception; request verified reupload only where needed. |
| Review gate: cutover | Approve inventory, semantic differences, rollback and retention. New approved writes use RED as the sole evidence representation; readers support both legacy ZIP and RED revisions temporarily. Historical results/rewards remain unchanged. |
| P4 cleanup | Only after an explicit deletion approval: remove replaced ZIPs, their embedded statistics duplication and obsolete V5 caches; retire unused legacy analysis/rebuild paths after consumer inventory. Keep immutable manifests/provenance and required old projections/rule configurations. No blanket historical cleanup. |

Decisions requiring review: final retention policy (especially chat/system messages
and unavailable initial resources), elevation-model correction, new result-source
binding contract, generation/epoch semantics, acceptable memory/latency budgets,
cloud validation environment, and eventual legacy artifact deletion. None is
implied by committing or opening this experimental PR.
