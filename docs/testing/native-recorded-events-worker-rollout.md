# Native Recorded Events upload worker V1 — staged migration gate

Status: **experimental / opt-in only**. Parent experiments PRs #89 (Recorded Events), #93 (direct shared episode output), #94 (critical-path profiling). This branch changes **neither** the existing `/process` upload response nor `uploadReplay`/Firestore, player-facing statistics, official results, awards, historical sources or Firebase deployment defaults.

## Decision and the old cost

The old canonical verifier is a valuable *archive reconstitution* verifier, not just an integrity check. It validates the structured archive and replays every stored original raw operation, reconciles event chronology, participant/object references and computes the original replay SHA-256 from reconstructed raw bytes. That makes sense for an archival ZIP but is costly when creating many duplicate intermediate representations.

Measured isolated legacy canonical-seal times across build-185872 examples: 70.85s (1v1 Hack), 89.63s (1v1 Deak), 212.30s (2v2 Arabia), 305.48s (2v2 Chaos). See `docs/testing/upload-critical-path-2026-10-10.md` for scope and the complete nine-case table. The measurement is local, not remote upload-to-READY.

**Do not disable the old full seal while continuing to publish legacy CanonicalReplay archives.** The replacement is a new representation with its **own strict validator**, not the legacy shortcut called `sealed_local_fast`.

## Implemented native evidence contract

`replay-tools/native_ingestion.py` creates a verified local package comprising exactly:
- `events.jsonl.gz`: `AOF_RECORDED_EVENTS_V1`, with full source-framing accounting and verified stream record structure, chronology, counts, compressed SHA-256 and uncompressed SHA-256, bounds and a terminal footer;
- `statistics.direct.json.gz`: lossless shared-episode statistical output, from unchanged models whose original full output passed canonical schema validation;
- `manifest.json`: verified source and both artifact hashes/lengths, model/delivery versions, matched original replay slots, qualified `matchFacts`, missing raw-byte retention and explicitly unready publication state.

It never constructs, seals, validates or stores a CanonicalReplay ZIP. It constructs the analysis index **on the one verified Recorded Events read**, without reopening the uploaded recording for statistics. The resulting package is assembled in a private staging directory, with an exclusive destination claim, and only renamed into place after both artifacts and source have been verified. Failed verification leaves no published package.

`native_worker_transport.process_native_replay` returns only base64 gzip artifacts and their metadata (no expanded 400 MB JSON). A disabled-by-default `/process-native-v1` route requires BOTH `AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT=1` and `AOF_REPLAY_WORKER_AUTH_TOKEN`; it remains independent of the default existing `/process` route.

To run the local candidate:

```sh
python replay-tools/native_ingestion.py \
  --replay path/to/Game.aoe2record \
  --out /tmp/aof-native-Game \
  --report /tmp/aof-native-Game-timing.json
python replay-tools/verify_native_package.py \
  --source path/to/Game.aoe2record \
  --package /tmp/aof-native-Game \
  --report /tmp/aof-native-Game-acceptance.json
```

The second command independently consumes/validates the staged event stream, recomputes full unindexed statistics, losslessly restores the compact artifact and requires exact full-document equality including neutral pair-social evidence.

## Preserved safety and intentional difference

The native pipeline validates every retained event in its own strict schema/contract, verifies complete operation framing and chronology and checks both compressed and inflated artifact integrity.

**It cannot reconstruct the original replay's omitted raw bytes**, unlike legacy CanonicalReplay. The original replay must therefore remain verifiably stored or eligible for hash-verified reupload. The native metadata explicitly sets `requiresOriginalRecordingRetention: true` and `sourceDeletionAuthorized: false`. The staging transport deliberately does not echo raw replay bytes in its response; a future Firebase adapter must write and verify the **original input bytes** itself before committing READY.

The source identity and extraction revision are separate; different model revisions must not mint new scored deeds. Source player slots cannot be accepted as bound league player identity without the existing authorized mapping and revision checks. The match facts remain UNRESOLVED and are not promoted to official results by extraction.

## Before anyone can enable this for real Games

1. Verify real 185872 build fixtures including team Games and FFA with exact whole-stat and pair-social parity. TownBell is a limited independent reference, not the authority for AoF custom social models.
2. Add native Firebase adapter (not in this PR) that authenticates uploads, validates source byte hash and roster, retains and verifies the original recording, then writes the immutable RED and statistics artifacts under create-only generations and verifies their hashes and lengths.
3. Publish authorized, compact `StatisticsExperience` read models with **native provenance and correct binding revision**. Restore or selectively project required episode fields for Battle/Season/Player, while preserving existing historical source revisions.
4. Implement revision/lease/retry-safe atomically published metadata/active pointers with full correction/dispute gates and the existing official result authority. No READY before all required artifacts and derived read models are safely available.
5. Add native detail and social consumers without turning direct compact storage into a multi-megabyte browser response; check scoped authentication and hidden historical data.
6. Run complete cold/warm `uploaded bytes accepted → READY` E2E on production-like infrastructure. Normal target under 20s, 25–30s upper bound; higher-activity Chaos is a known hard case.
7. Review replay-source retention, rollback and user migration. Deletion of old canonical ZIPs or original recordings is **not authorized** by this experiment.

Keep `canonical_io.validate_bundle` for historical archives, migrations and forensic conformance. It does not need to be performed in the new native pipeline once the replacement is independently accepted and integrated. Production and legacy paths stay unchanged until explicit cutover review.
