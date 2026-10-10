# Native Battle detail preview V1 — bounded inspection contract

This increment makes detailed native engagement episodes available through a **private administrator-only inspection route** for existing validated-but-not-READY candidates. It is not public Battle-detail delivery, a migration, or native READY activation.

## Why

The native compact statistics artifact retains all producer-owned episodes and shared evidence. Restoring every participant's full episode arrays in the measured build-185872 4v4 would yield roughly 403.6 MB of JSON. This preview instead selects small lists and one fragment at a time.

It still downloads and verifies the entire compact native gzip (up to 48 MiB compressed and 64 MiB decoded) per request. That is a bounded compact-document load, **not true random-access streaming from Cloud Storage**. Production memory/concurrency and cold-cloud latency need separate acceptance.

## Authenticated inspection

The exported Firebase callable is **getNativeBattleDetailPreview**. Its gates match native validation: authenticated active ADMIN, exact staging/demo project, specific Game allowlist, processor revision pin, worker authentication and opt-in operator flag. Only the same administrator who validated a candidate may inspect it.

The candidate must remain VALIDATED_NOT_READY, active false, leagueEffectsPermitted false, original replay permanently retained, and its Storage artifact path must match the source and artifact revision. The reader binds to an immutable Storage generation and verifies compressed and decoded SHA-256 and lengths, source hashes, schema, extraction ID and parser version.

The full original authority binding (Game, Match, player roster documents, administrator record and authentication link) is checked before and after the artifact read. A correction, roster or permission change fails closed. No Game or source-activation pointers, social awards, official results, player statistics or scoring ledgers are written.

## Protocol

List request: matchId, gameId, candidateId, mode="list", replaySlot=1, group="battles", pageSize=20, offset=0.

List returns up to 50 small episode references and identifiers, total count, artifactSha256 and nextOffset. Each subsequent page must supply expectedArtifactSha256 equal to the pinned revision.

Fragment request: same Game/candidate/player/group, mode="fragment", reference="battles/0", field="body" (or an explicitly interned shared evidence field), offset=0, expectedArtifactSha256 from the list.

Fragment returns at most **32 KiB** of serialized UTF-8 JSON, encoded as Base64, alongside contentSha256, totalBytes, offset and nextOffset. Repeat until complete, concatenate raw bytes, verify SHA-256, then parse the reconstructed JSON. A fragment can end within a UTF-8 code point; do not decode fragments individually.

For interned fields the stored producerSharedSha256 is the Python canonical-JSON content fingerprint. It is intentionally distinct from contentSha256, which hashes the exact JSON serialization sent by Node.

Supported player groups: skirmishes, battles, greatBattles, allyReinforcementsSent, allyReinforcementsReceived, defensiveAssistsGiven, defensiveAssistsReceived, cooperativeAttacks. Native replay slots do **not** identify League players. A fragment is available only when the selected episode reference belongs to the stated replay slot and group.

## Tested invariants and gaps

- Page boundaries, per-player ownership, artifact-bound cursors, missing fields and unsupported versions fail closed.
- Oversized and corrupt compressed/decoded evidence, source/extraction mismatches, stale admin/roster/Game bindings and revoked access fail closed.
- Unicode- and multi-fragment evidence reconstructs byte-identically without creating a giant all-participants JSON response.
- No normal player route, legacy statistics-reader contract or READY state is changed.

Future acceptance still needs real build-185872 evidence with browser-level UI pagination, normal League-player permissions, native social-reader routing, correction-safe activation, real Firebase capacity/load tests and original-source retention governance. The existing native READY blockers remain in force.

**Merging this code does not deploy, activate or authorize native READY.**
