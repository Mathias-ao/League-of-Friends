# CanonicalReplay v1: extraction and conformance milestone

Date: 13 September 2026. Audited implementation baseline: `2688d472a14e9105da0ccac101eca3f3bb8f5c94`.

This is a local extraction/verification vertical slice. It does not qualify an automatic upload service, select league results, change player relationships, or enable replay deletion. Read `CORE-IDENTITY.md` for product authority.

## Contract audit and decisions

| Baseline finding | Implemented decision |
|---|---|
| The repository foundation was revised on 13 September; the attached foundation is the earlier 10 September research report. The attached schema and capability matrix match the baseline repository bytes. | Preserve the newer repository foundation. Use the older attachment's hash-pinned paired-fixture findings as supporting evidence. |
| The extraction contract required permanent recordings; CORE-IDENTITY and the revised foundation require temporary uploads. Schema 1.0.0 also required a `retainedReplay` artifact object. | Explicit schema successor **1.1.0** requires `retainedReplay: null`. Archive the exact 1.0.0 schema under `replay-tools/schemas/`. The extraction envelope records the temporary-upload policy. This is an explicit draft-contract migration, not a claim that old readers accept the new schema. |
| Canonical export already existed. The separate TownBell-shaped 320-metric prototype is absent from this repository. `matchAnalysis.ts` already consumes canonical facts. | Improve the existing exporter. Make the compact adapter a canonical-event projector. Update both corpus readers to verify and enumerate every chunk. Do not recreate the absent 320-metric prototype. |
| Recognized actions were called completely decoded although the decoder discards fields and padding. RESEARCH discards its secondary selected-building list; DE_QUEUE discards the building-type field. | Retain the complete raw frame for every body operation and all returned decoded fields. Preserve those additional raw layout fields explicitly. Recognized actions remain `partial`; byte-level semantic completeness is not asserted. |
| Short reads and `EOFError` could be accepted as successful completion; a failure was mislabeled SAVE and only part of its tail retained. | Exact bounded reads; unknown framing becomes an `UNKNOWN` gap covering the entire remaining tail. Unknown **action** codes retain their known action frame and can be followed by more operations. The CLI exits unsuccessfully for incomplete body framing. |
| Clean EOF was exported as a completed game. | `completionStatus` stays `unknown` (or `restored` when the header says restored); winner arrays stay empty. Independent result qualification is unchanged. |
| Missing, zero and negative queue amounts were coerced to one in the compact adapter. | Adapter **LOF_MGZ_FAST_ADAPTER_V4** preserves signed amounts and nulls. Positive amounts are summed without multiplying by producer-selection size. No cancellation settlement, completion or trained-unit claim is added. |
| Invalid map dimensions could fall back to 1, and missing civilizations to a fabricated -1. | Reject canonical publication when required values cannot be established. Width comes from the decoder; height is explicitly reconstructed from divisible tile count / width. The complete raw header prefix and decoded header remain evidence. |
| Lobby teams could become authoritative fixed/FFA groups without semantic qualification. | Preserve raw lobby IDs and initial diplomacy; publish no normalized team or initial stance assertions in this slice. Directed diplomacy commands retain actor, target, raw modes and tied-event order. |
| Compression included run-dependent gzip metadata; artifact readers used only `chunks[0]`; no machine-schema validation ran. | Deterministic finalized gzip chunks, strict all-chunk readers, Draft 2020-12 validation and stream invariants. Run identity/time are separate from deterministic event content. |

Replay-local participant IDs remain slots, not league player IDs or authentication IDs. `match.matchId` is a source-hash-namespaced recording identity; the replay GUID remains separate. The extraction envelope is explicitly unbound to a league Match/Game. No name-based league binding is introduced.

## Implemented package

- `canonical-replay.json`: schema 1.1.0, source SHA-256/length, parser/normalizer/entity-data versions, participant/header candidates, initial state and ordered stores.
- `facts-*.jsonl.gz`, `terrain-*.jsonl.gz`, `initial-objects-*.jsonl.gz`: deterministic stores, normally limited to 10,000 records or 8 MiB uncompressed per chunk. An individually oversized record is explicitly permitted and retained without truncation.
- `header-prefix.bin.gz`: original-file bytes through the body start, including compressed header and log metadata. These are canonical byte evidence, not a second uploaded `.aoe2record` artifact.
- `decoded-header.json.gz`: all available decoder header fields, including raw identity/diplomacy/settings candidates. Binary and non-finite values have explicit JSON representations; no memory-address `repr` values are used.
- `extraction-manifest.json`: `AOF_EXTRACTION_V1`, unique run identity, exporter/decoder code hashes, schema hash, compatibility-registry hash, artifact references, local verification state, unbound league identity and retention policy.
- `field-claims.json`: field-specific evidence rules; notably timestamps and map height are deterministic reconstructions, while encoded IDs/amounts/coordinates remain observations.
- `coverage-report.json`: framing, decode counts, observed clock interval, capability limits, warnings and verification evidence.

Validation checks schemas, safe local artifact paths, compressed SHA-256/length, every chunk's count/ordinals, contiguous original-file spans, raw opcodes, chronological synchronization-derived timestamps, participant/object references, terrain dimensions, counter reconciliation and version consistency. Concatenating retained header-prefix and operation evidence reproduces the original source SHA-256. This check never opens the replay.

Bundles are staged and verified before publication to a new directory; existing bundles are not overwritten. Input size and header inflation have explicit limits (128 MiB source / 256 MiB inflated header). These are engineering bounds, not measured production worker sizing. Runtime isolation, hard job timeouts, authenticated uploads, remote artifact persistence and transactional revision selection remain future work.

`verified_local` means verified local evidence. Both `persistenceVerified` and `sourceDeletionEligible` remain false. This CLI never deletes an input. Future upload orchestration must verify durable persistence and the applicable extraction coverage before deleting a temporary upload; failures retain the source. Players retain their originals.

## Verified evidence versus remaining qualification

The pinned `mgz-fast==1.0.0` distribution is checked by code hash. The save/build pairs 68.0/180059 and 66.6/158041 have real replay regression goldens. Their status is **fixture_regression_only**, not general production support. Other tuples or modified decoder code receive `unverified_tuple` / `unsupported_version` capability status.

| Real regression fixture | Operations | Queue commands | Positive encoded queue amount | Research requests | Build placements | Directed diplomacy commands |
|---|---:|---:|---:|---:|---:|---:|
| Hash-pinned TownBell FFA, save 68 / build 180059 | 454,120 | 1,720 | 3,144 | 216 | 697 | 86 |
| Upstream 1v1, save 66.6 / build 158041 | 328,072 | 309 | 309 | 43 | 135 | 0 |

The FFA source hash and key counts agree with the attached research. The duel source comes from the pinned upstream aoc-mgz corpus; its snapshot freezes observed decoder behavior rather than independently certifying game-engine semantics. Both fixtures preserve all operation bytes and actual decoded initial data. Neither is a controlled action experiment, and the historical seven-shape corpus was not supplied for this milestone.

The controlled **wire fixture** exercises real decoder action layouts, unknown codes, signed/null queue quantities, additional selected research IDs, building coordinates including zero, directed/tied diplomacy, target IDs, selection-reuse markers, chat, camera and malformed tails. Its header is a declared test double. It is not represented as a recording of a real controlled game.

### Two-recorder ordinary-game evidence

An additional user-supplied ordinary 1v1 supplies distinct recordings from POV slots 1 and 2 for save/build 68.0/180059. Both sources are located in replay-fixtures, separate and hash-pinned in the fixture manifest. Their CanonicalReplay bundles establish the following fixture-level observations:

| Evidence | POV 1 | POV 2 | Comparison |
|---|---:|---:|---|
| All source operations | 348,012 | 348,013 | One additional terminal chat operation in POV 2. |
| Ordered non-camera/non-chat operations | 176,588 | 176,588 | Exact semantic and retained-raw-byte match after removing only source-local addresses. |
| Actions | 5,168 | 5,168 | Exact match, including 367 queue and 56 research commands. |
| Camera samples | 171,419 | 171,419 | All recorder-specific positions differ. |
| Initial terrain / objects | 14,400 / 3,953 | 14,400 / 3,953 | Exact match. |

This validates the architectural separation between shared Game evidence and recorder-local camera/chat evidence for one fixture. It does **not** justify merging source bundles, selecting a preferred source, assuming all chats are shared, or generalizing recorder agreement to every save/build tuple. Because this was an ordinary game without a controlled action log, it does not establish queue cancellation/allocation, research or building completion, effective diplomacy, or result semantics.

POV 1 contains three raw Feudal-age research commands within 403 ms. Those cannot be three separate accepted age starts. Accordingly the replay-free projector calls ID 101/102/103 matches `ageAdvanceRequestCandidates`; `ageAdvanceStarted` is a separate insufficient-evidence output rather than an alias for every research command.

## Statistics available without reopening a replay

The replay-free `AOF_CANONICAL_PROJECTION_V2` projector provides `AOF_COMMAND_FUNDAMENTALS_V2` for the **observed decoded command interval**, with source event IDs on compatibility timeline entries. V2 is an explicit semantic migration prompted by the paired fixture: age-related research commands are requests, not accepted starts.

| Projection | Evidence boundary |
|---|---|
| Action totals by participant/type and per-second buckets; SYNC, camera and raw chat counts | Recorded operation counts, not eAPM, logical chat count or complete-game participation. Camera scope is recorder-only. |
| Queue-command count and positive encoded amount by participant and raw unit ID; signed/null quantities and command times | Requests only. No per-producer multiplication, net cancellation balance, trained units or surviving army. |
| Research-command count by participant/raw technology and request times | Age-advance request candidates use raw technology IDs 101/102/103. `AgeAdvanceStarted`, observed `AgeReached` and projected completion are separate unavailable claims. |
| Building-placement counts by participant/raw building ID, placement coordinates/times and wall endpoints | Orders, not completed or surviving buildings. |
| Directed diplomacy-command counts and ordered timelines for each actor→target pair | Raw modes and times; no symmetric relationship, effective alliance or inferred hostility assertion. |
| Market, tribute, flare and resignation command timelines | Decoded command fields only; transaction settlement, tribute offsets/fees and result semantics remain unqualified. |

New windows, first/last command timings, command-rate formulas, spatial summaries of stored positions, and revised entity classifications can be computed from these stored events and separately versioned models. Raw initial-object observations and terrain are available for further projections; completeness of the object search and patch/mod-aware normalization are not yet certified. The existing V1.4 analyzer remains an optional inferred-analysis consumer.

## Requires fixtures, parser research or simulation

- **Controlled replay fixtures:** queue amount semantics for multi-producer selection; cancel/requeue/autoqueue; research cancel; building cancel/delete; unilateral diplomacy and engine-effective state; nonzero tribute with fees; clean completion/disconnect; two-recorder and restored-game coverage.
- **Parser/header research:** exact unread spans, exhaustive initial-object decoding, lobby conflicts, additional operation layouts, selection reuse, entity-data/mod qualification and restore origins. Raw evidence is retained so discoveries can target canonical byte artifacts.
- **AgeReached qualification:** the FFA contains 17 English age-notification-shaped JSON messages, but system authenticity, ordinary-chat spoofing, language and mode coverage are not yet controlled. Raw structured chat is retained; `observedAgeReached` is explicitly unavailable and separate from age-advance requests, `AgeAdvanceStarted` and projected completion.
- **Compatible engine simulation or independently qualified telemetry:** actual trained/completed units, construction/research completion without direct evidence, live composition, resource collection/banks/net spending, damage, kills/deaths, visibility, pathing and unit positions over time.

The next smallest milestone is one short current-build queue/cancel/research/diplomacy recording pair with a written action log and synchronized two-player video/POV evidence. Add its expected raw fields and observed engine outcomes to this harness, then qualify only the command semantics the experiment establishes. See the [controlled fixture protocol](../../replay-tools/tests/CONTROLLED-FIXTURES.md).

## Reproduce verification

Local verification on 13 September 2026 used Python 3.12 and Node 24.19.0:

| Check | Result |
|---|---|
| `python -m unittest discover -s replay-tools/tests -v` | 23 passed; three real-recording checks are explicit skips unless the committed `replay-fixtures/` directory is selected with `AOF_REPLAY_FIXTURE_DIR`. |
| Full extraction with all four hash-pinned recordings supplied | 26 passed in 570.535 seconds: FFA, upstream duel and both paired POVs completed byte/schema validation, semantic goldens and canonical-statistics corpus comparisons. |
| `conformance.py <bundle> --compare <golden>` on each saved real bundle | Both passed with `changes: []`; 782,192 body operations plus initial stores validated without reopening either replay. |
| `node --test scripts/test-canonical-artifacts.mjs` | 2 passed, including later-chunk corruption and the unchanged TypeScript analyzer consuming the synthetic canonical golden. |
| `test-match-analysis-corpus.mjs` on both real bundles, using the source TypeScript engine | 2 passed: FFA/dynamic and duel. This checks optional-analysis integration, not the truth of inferred raids or target ownership. |
| `paired_conformance.py` on the user-supplied two-recorder 1v1 | Exact match for all 176,588 ordered non-camera/non-chat operations; expected recorder-local camera and chat differences retained. |
| Python compilation, changed Node script syntax and `git diff --check` | Passed. |

The first real-golden comparison exposed a harness representation bug (`Counter` versus a deserialized JSON object). The comparator was corrected and given a round-trip regression. The final checks above revalidated the saved bundles and original goldens; no changed replay facts were blessed to make the tests pass. Remote CI is configured for the self-contained suite; a remote CI result is not implied by these local checks.

See [the tooling instructions](../../replay-tools/README.md). The default suite runs controlled conformance and explicitly skips opt-in real recordings. Setting `AOF_REPLAY_FIXTURE_DIR=replay-fixtures` enables full extraction/golden comparisons for all four hash-pinned conformance sources. Golden changes are never automatically accepted by tests; `conformance.py` reports semantic JSON Pointer changes, while real-corpus snapshots include whole-store semantic hashes.
