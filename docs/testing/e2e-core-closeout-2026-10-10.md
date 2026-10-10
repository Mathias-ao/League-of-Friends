# Local eight-account E2E — core workflow closeout (10 October 2026)

**Disposition: CLOSED — core functional rehearsal successful; release acceptance is not asserted.** The user chose not to pursue successful Event finalisation in this rehearsal. This document preserves findings for further Age of Friends development without promoting synthetic results into real league history.

## Scope and observations

Test environment: **only** Firebase emulators under `demo-aof-e2e`, the local site and replay worker. Eight independently authenticated, **simulated** accounts joined a local Season and Event. The main Event was planned for 10 October 2026; historical recordings were used as synthetic evidence.

| Workflow | What the user observed | Evidence boundary |
| --- | --- | --- |
| Registration and pairing | Eight enrollments/RSVPs, four warm-up pairings, admin-reviewed main 4v4 draw and participant mappings | Warm-up scheduler advanced manually; normal check-in was replaced by audited `LATE_ADDED` exceptions |
| Recording ingestion | Historical 1v1 and eight-participant 4v4 decoded and bound to synthetic accounts | Do not treat recording participants, Game timestamps or Steam names as verified league identities |
| Qualification and review | Wrong-map Glade 1v1 was rejected against announced Arabia; Emperor manually chose a winner; three unplayed warm-ups cancelled | An administrative reviewed result is not evidence that the historical Game met the Event's real play window |
| Measurement and rewards | The user observed accessible 4v4 statistics, Event points, leaderboard and player-profile updates | No independent numeric comparison of all metric values, exact point-ledger entries or repeat-processing behavior was performed |
| Reputation and Relationships | Statistical/social evidence and current player views were available for subsequent development | No activation or correctness certification of Reputation currencies, pair Relationship scoring or Chronicle narrative is claimed |
| Event completion | Closure checklist had only `The main Event has not started` before scheduled kickoff | Premature closure guard passed; **successful administrative finalisation was not tested** |

The rehearsal establishes that source-bound recorded evidence can flow through existing statistics and points systems into player-facing league views. The **recorded statistics models, point accounting and neutral social/relationship evidence foundations are the reusable product assets**. The historical fixture Games, local Event, fake account mappings and simulated points are **not** imported to staging or production or certified as genuine competition.

## Defects found and actioned

1. **Firestore nested-array prohibition.** Storing `warmupSchedule.pairs` directly as a tuple array caused Event warm-up generation to fail. Persist pairs as `[{playerIds:[a,b]},...]`, retaining deterministic internal tuple draws. Fixed, regression-tested and merged into `main` as [PR #85](https://github.com/Mathias-ao/League-of-Friends/pull/85).
2. **Large statistics JSON rejected by Storage emulator.** An uncompressed statistics upload returned HTTP 413. Use lossless gzip storage with explicit compressed/original lengths and SHA-256 hashes; older uncompressed files remain readable. Shared reader must cover both user statistics and projection backfill. The new production-facing implementation is separately reviewed and must be validated against real deployed limits.
3. **Resumable Storage emulator truncation.** A controlled 18.36 MiB upload with 8 MiB resumable chunks yielded only the first 8 MiB after download; the same size non-resumable upload round-tripped intact. Retain mandatory SHA-256 verification. The permanent implementation uses non-resumable save with hash-verified download for its evidence artifacts; this is not proof of global emulator/GCS behavior under all conditions.

No replay detector, official winner qualification rule, points formula, Reputation currency rule, Relationship advancement rule, or player identity authority was loosened to make the synthetic rehearsal pass.

## Unfinished checks — future independent acceptance, not E2E closeout blockers

- Successful scheduled Event finalisation and invariant ledger/standings after closure.
- Timed ordinary player check-in, automatic scheduler delivery and authenticated real-account identity mapping.
- End-to-end dispute/source replacement, simultaneous/duplicate submissions, idempotent reprocessing and point reversal checks.
- Browser/callable payload ceilings, realistic 4v4/FFA performance, memory/transfer baseline and large-file failure cleanup.
- Real gameplay/footage qualification of uncertain statistics, FFA finishing positions, map/mod variants and directional diplomacy evidence.
- Explicit and versioned **Gallantry / Cruelty / Chivalry** rules; **Rivalry / Hostility / Bond** pair progression; opportunity/coverage/reciprocity requirements and Chronicles. Neutral evidence may be inspected before these models are activated; inferred combat, alliance effects, intent or kills cannot be invented.

## Source-control and environment boundary

- **Safe to retain in `main`:** the Firestore pairing fix, correct statistics/points engines and a separately validated lossless evidence-storage path; this closeout report and current-state documentation.
- **Do not promote:** temporary emulator-only authentication override, synthetic account mappings, private emulator Auth/Firestore/Storage data, historical Event play-date assertions, or E2E-specific binary fixture corpus solely because it was used in rehearsal.
- Keep `age-of-friends-staging` and production `league-of-friends-cc274` unchanged. Committing and merging GitHub code is **not** a deployment, migration or import of emulator database contents.
- Historic data already in any actual environment must be preserved by source/revision-aware migrations and legacy statistics readers; never replace official data with the simulated event.

**Next product focus:** use the stable evidence/statistics foundation to design and qualify Reputation and Relationships, with deterministic source-bound social incidents, coverage, opportunity, reciprocity, scoring/reversal rules and transparent player views. Keep the separate performance benchmark [PR #83](https://github.com/Mathias-ao/League-of-Friends/pull/83) available for later profiling.
