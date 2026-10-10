# Recorded Events V1 contract and implementation

Status: implemented for local direct extraction and replay-free projection on the
Milestones 1–2 branch. Not wired into the production worker or Firebase upload.
This contract supersedes PR #89's experimental monolithic JSON format for new
extractions. Its legacy converter remains useful for comparison and migration.

The approved destination is **one immutable Cloud Storage object per extraction
revision**. Firestore will contain source identities, extraction/projection
metadata, active references and bounded published statistics. No permanent
recording, canonical ZIP, Analysis V5 cache, raw header or parallel event store
is required by the new path. These production publication changes are Milestone 3.

## Wire contract

`AOF_RECORDED_EVENTS_V1`, schema `1.0.0`, retention
`AOF_RECORDED_EVENTS_RETENTION_V1`: gzip-compressed UTF-8 JSONL. Every line ends
with a newline. The producer emits one gzip member, level 6, mtime zero, with no
filename. The reader checks the entire compressed and uncompressed artifact.

Records appear in this order:

| Record | Shape and meaning |
| --- | --- |
| Header | `["header", metadata]`, exactly once |
| Initial object | `["object", zeroBasedOrdinal, row]`, header decoder traversal order |
| Terrain tile | `["tile", zeroBasedOrdinal, terrainRaw, elevation]`, row-major decoded tile order |
| Clock operation | `["sync", operationOrdinal, incrementMs, decodeStatus, warningCodes]` |
| Other operation | `["event", operationOrdinal, row]` |
| End | `["end", completeness]`, exactly once; no trailing records |

There is exactly one clock/other-operation record for each framed body operation.
Clock and other-operation ordinals share one contiguous sequence starting at zero.
Stable observation IDs are `op-{ordinal:09d}`; initial IDs are
`initial-object-{ordinal:08d}`. Filtering for a statistical model must never
renumber these identities. Equal timestamps retain source operation order.

The operation row has these 17 named columns, also declared in the header:

```text
timestampMs, sourceOperation, eventType, sourceActionCode, sourceActionName,
actorPlayerId, targetPlayerId, objectInstanceIds, targetInstanceId, entity,
position, endPosition, payload, decodeStatus, warningCodes, sequence,
layoutObservations
```

Clock timestamps are reconstructed exactly by summing integer increments,
including the current clock operation. Other timestamps must equal that sum.
No wall-clock, restored-game origin or full-game completeness is inferred.
The compact clock representation removes constant null fields, not operations.

The initial object row has seven columns:
`ownerPlayerId, objectId, classId, instanceId, objectBlockIndex, position, entity`.
Object instances may recur in decoded header observations; this is not proof of
creation/destruction or a simulation identity-lifetime model. Raw IDs and replay
slots remain authoritative over catalog labels and league identity bindings.

The executable shape description is
[`recorded-events-stream-v1.schema.json`](../../replay-tools/schemas/recorded-events-stream-v1.schema.json).
`StreamValidator` additionally checks chronology, types, finite values, retention,
section ordering, unique playable slots, map dimensions and all footer counts.
Whole-document JSON Schema validation is deliberately not repeated per replay
operation; the schema itself and representative records are tested.

## Header and retained observations

The header contains:

- Original recording SHA-256 and byte length, with no filename or recording bytes.
- Deterministic extraction revision UUID, extractor dependency digest, decoder
  code digest and parser/normalizer versions. Revision identity uses the source
  hash, contract/retention versions and extraction/decoder code digests. Repeating
  the same extraction is byte deterministic, independent of destination filename.
- Replay participants, recorder, civilizations, lobby groups, initial diplomacy
  candidates, settings, map dimensions/identity and the compact decoded header.
- `initialPlayerObservations` retains each playable slot's parser-reported header
  position and raw player type. These are qualified header observations, not a
  claim about original spawn position, human/AI classification or restored state.
- Explicit qualifications: parser object search is incomplete; initial player
  stockpiles are unavailable; global semantic completeness is not established;
  game-time origin is unqualified; raw bytes and chat content are not retained.

Retain all supported decoded action families and their useful parameters, not a
fixed list of statistics: selections, source/target identities, positions,
production/research/build requests, movements, military orders, market/tribute,
diplomacy/settings, flares, resignations and qualified postgame observations.
Unrecognized actions/operations retain their place, available code, decode status
and warning codes, without binary recovery payloads. `START`, `SAVE`, `VIEWLOCK`
and metadata-only `CHAT` observations also retain source chronology.

Preserve known layout scalars that the upstream parser omits: selected-building
IDs, producer type, signed queue amount, primary object/technology IDs, embedded
source/target/mode values, resign disconnect flag and layout qualification.
These are decoded observations; they are not raw byte copies or effective-state
assertions. Command acceptance, completed production, kills, damage, resource
gathering and effective mutual alliance are not asserted by extraction.

Terrain keeps the decoded signed/raw terrain ID and elevation for every tile;
coordinates derive from ordinal and width. Resource objects keep decoded type,
instance and position. Initial resource stockpiles and per-object remaining
resources are not invented when the decoder does not provide them.

Do not retain raw frame/header bytes, Base64 data, unknown binary spans, parser
failure prose, SYNC checksums, chat text, redundant command summaries or inferred
episodes in the authoritative dataset. Chat player/channel/taunt metadata may be
retained. Future authenticated system-message extraction, initial-resource
decoding and elevation use each require an explicit versioned improvement.

## Integrity and completeness

External artifact metadata contains format (`jsonl`), compression (`gzip`),
dataset version, compressed size/SHA-256 and uncompressed size/SHA-256. It will
live with the Firestore extraction revision; the CLI writes a small metadata
sidecar solely for local use. This is not a second gameplay representation.

The footer contains operation/object/tile counts, operation/decode-status counts,
observed-until time and framing status. An unknown body tail yields `partial`,
never a successful absence/zero. Successful framing still does not establish
semantic or full-game completeness. Unknown action codes remain distinct from
unframed trailing data.

V1 bounds: 128 MiB source profile, 256 MiB inflated header preflight, 128 MiB
compressed events, 512 MiB uncompressed events, 16 MiB per JSONL record. The
production upload limit remains 32 MiB. Exceeding any bound fails extraction or
reading; no clipping/sampling is allowed. Missing footer, corrupt gzip, duplicate
JSON keys, hash mismatch, invalid ordinal/clock, malformed references and
non-finite numbers fail closed. Consumers must exhaust the validating reader
before publishing any result.

Direct extraction rehashes the source after decoding, verifies the saved event
artifact by reading it back, and atomically creates the destination without
overwriting an existing artifact. During decoding it checks contiguous original
byte offsets/lengths through the entire body without persisting byte copies.
No local success authorizes source deletion
or remote publication. Storage generation checks and Firestore pointer
transactions belong to the next milestone.

## Projection and explicit compatibility differences

The reader builds only the existing models' action/object/command indexes.
Clock rows update counters directly; camera points and terrain remain retained
in the event artifact but do not allocate unused projection arrays. No Analysis
V5 file or second complete event dataset is constructed. Existing model code
still requires an in-memory action index; V1 is not a bounded-state simulator.

All existing statistics models, catalogs and formula versions remain unchanged.
Terrain elevations are intentionally not supplied to those models yet, matching
the legacy input defect. Correcting that changes model inputs and needs a
separate projection version/acceptance comparison. Initial stockpiles remain
unavailable until a separately qualified extractor can decode them.

Native statistics use schema `1.2.0` and projection wrapper
`AOF_RECORDED_EVENTS_STATISTICS_V1`. Its schema descriptor overlays native source
fields on the unchanged legacy statistics schema. The differences from legacy
output are intentional and reviewed separately from gameplay semantics:

1. Source points to the event object's hash/version and extraction revision,
   never a fabricated canonical manifest or ZIP.
2. Header evidence points to the retained header section.
3. Coverage/warnings truthfully describe decoded-only retention and remove old
   claims that raw frames/headers remain available.
4. Pair social evidence and episode identities are scoped to native artifact
   provenance. Regenerated IDs must not be treated as new scored deeds. The
   legacy identity namespace string continues to mean replay player slots; it
   does not imply canonical files are required.

Acceptance compares all legacy model inputs and every output field after
adapting **only** source, header reference and coverage to the native provenance.
That includes all pair evidence, episode context and match facts; it is not a
selected-metric comparison. Existing legacy projection remains unchanged.

## Authority and remaining milestones

No event/projection code imports Firebase, updates results or publishes rewards.
Game result corrections, League Points/rule snapshots, Reputation, Relationships
and Chronicles retain their existing eligibility and authority. The backend's
current source-bound result resolver must not run during descriptive recalculation.

| Milestone | Implementation boundary / remaining acceptance |
| --- | --- |
| 1 — contract | Native V1 stream/retention and executable validation implemented here. Review intentional provenance differences before backend adoption. |
| 2 — extraction/projection | Direct extraction, replay-free full-statistics projection, streaming serialization, regression/corpus benchmarks implemented here. Worker route still uses its legacy path. |
| 3 — permanent storage/retrieval | Add worker artifact references and direct binary/source transport; create-only Cloud Storage event persistence with generation/hash verification; bounded summary/detail read models; update frontend and server social readers for native provenance. No native upload/publication endpoint exists yet. |
| 4 — revisions/recalculation | Separate source/extraction/projection/binding references; verified same-source reupload; reserve retryable bounded jobs with leases/cursors; compare input revisions before atomic publication. Replace legacy delete-before-recreate rebuilds. |
| 5 — staging/cutover | Staging upload, retry/concurrency/recovery and UI acceptance; compare social/official results and rewards; production migration/legacy deletion require explicit approval. |

Keep PR #88's gzip reader fix independent. Keep the current coherent aggregate
transaction until its replacement is proven. Legacy canonical objects remain
readable; conversion and eventual cleanup require verified replacement evidence
and an explicit review gate. No staging/production data, emulator fixtures or
historical artifacts have been modified by this implementation.
