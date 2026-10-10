# Age of Friends — Current State

Last reviewed: **10 October 2026**. Read [Core Identity](CORE-IDENTITY.md) for binding product decisions and [Current Statistics](CURRENT-STATS.md) for active models, evidence limits and publication status. This page is a current-state summary, not a change log or a production-acceptance certificate.

**Keep three states distinct:** `main` is the merged source implementation; `demo-aof-e2e` is an isolated, user-operated local Firebase emulator with temporary code adjustments; staging (`age-of-friends-staging`) and production (`league-of-friends-cc274`) are separate environments. An observed emulator success does **not** mean a fix was merged, deployed or accepted with real users.

## Current product and implementation

**Unmerged event-first V1 work:** the approved successor architecture now has a
[native event contract and direct extraction/projection implementation](../architecture/recorded-events-v1-contract.md)
with [local acceptance evidence](../testing/recorded-events-direct-v1-acceptance.md).
The current Firebase upload still generates canonical archives. Permanent native
event publication, bounded frontend retrieval, recalculation jobs and staging
cutover acceptance remain subsequent milestones; this branch does not change
official results, points or any deployed environment.

| Area | Verified implementation / status | Next gate |
| --- | --- | --- |
| League identity | Steam OpenID and Firebase admission, audited Emperor's Favor enrollment and retained verified Steam-name history on `main`; local emulator uses eight synthetic, independently authenticated accounts and a **local-only** login override. | Real multi-account identity and admission acceptance in the chosen nonproduction environment. |
| Season and Events | Enrollment, RSVP, warm-up scheduling, main pairing proposals/approval, attendance exceptions, civilization drafting, Battle Orders, disputes and closure checklist exist on `main`. No new AI fallback for odd-roster warm-ups; active helpers are human. | Ordinary check-in and scheduled Pub/Sub execution need separate E2E coverage. |
| Replay results | Authenticated upload, canonical evidence, source/roster binding, supported automatic outcomes, source-bound Emperor review, correction/retry paths, and result-processing machinery exist on `main`. | Test unsupported/late/FFA and correction paths against authentic evidence; resolve local-only defects before promotion. |
| League accounting | `AOF_SEASON_POINTS_V1` implements designated scoring slots, best eligible warm-up per player, main scoring, source/revision reconciliation and standings; Season/Event/player presentation consumes current evidence. | Verify ledger amounts and idempotent retries independently of UI. |
| Statistics | CanonicalReplay 1.1, five replay measurement categories, Battle/Event/Season presentations, record models and hidden lifetime aggregation. | Semantic footage review, capacity, browser response limits and deployed full-flow acceptance. |
| Social / identity interpretation | Replay-derived neutral pair evidence, declared diplomacy and shadow Social Incident/Chronicle qualification. Player Personality, Reputation, Relationships and portrait rules remain separate from measurements. | Qualify inputs and configure explicit rules before public social scoring, stages or portrait progression. |

The authoritative **8 October Season Event contract** is in [Core Identity](CORE-IDENTITY.md#season-event-contract). Event closure is administrative, not a statistics-publication gate; eligible outputs update when their own evidence and processing requirements are satisfied. Detailed implementation and limits: [Replay-driven Event flow V1](../architecture/replay-driven-event-flow-v1.md), [Season leaderboard points V1](../design/season-leaderboard-points-v1.md) and [statistics readiness](../testing/statistics-launch-readiness-2026-10-07.md).

## Local eight-account E2E rehearsal — observed 9–10 October 2026

**Outcome: core E2E rehearsal is formally closed as a successful functional smoke test; Event finalisation and release acceptance were not tested.** See [the E2E closeout report](../testing/e2e-core-closeout-2026-10-10.md) for observed outcomes and limitations. The user reported the following observed sequence:

1. Eight simulated accounts signed in separately; all entered one local Season, signed up and RSVP'd to one eight-player BIG_TEAM Event.
2. Four automatic 1v1 warm-up pairings were created after invoking the lifecycle manually. A Firestore failure storing nested `pairs` arrays was corrected **locally** by persisting objects containing `playerIds`; scheduler/Pub/Sub automatic execution was not tested.
3. Main attendance used audited `LATE_ADDED` administrator exceptions before the actual check-in window; the main pairing proposal and approved 4v4 were created. This is **not** a successful test of normal timed player check-in.
4. Real historical recordings were used with explicit Game-scoped bindings to synthetic player identities. A Glade recording (observed map ID 188) was correctly rejected against the announced Arabia map (configured ID 9); the Emperor's reviewed-winner control was subsequently exercised. The other three warm-up Battles were successfully cancelled.
5. The eight-player historical 4v4 was ingested using local-only evidence-storage adjustments. The user reported successful statistics, point distribution, leaderboard and player-profile updates. The 4v4 and reviewed warm-up results were treated as **synthetic workflow rehearsal**, not proof those Games occurred during the new Event's play window.
6. The Emperor closure checklist reported **only** `The main Event has not started` while the scheduled start was still in the future. The backend intentionally blocks closure before `startsAt`. **Successful Event finalisation remains untested** in the reported run.

The user's visual checks establish that outputs appeared and updated, **not** independent numerical validation of every statistic, exact point-ledger totals, all individual player calculations or duplicate-award prevention. Historical fixtures and the `T90Official` identity are not permission to assert real Steam identity equivalence across synthetic accounts.

### Blocking bugs found, and repository boundaries

| Finding | Local evidence / disposition | `main` after E2E consolidation |
| --- | --- | --- |
| Warm-up pairing persistence | Firestore rejects nested arrays under `warmupSchedule.pairs`. | **Fixed on `main` by [PR #85](https://github.com/Mathias-ao/League-of-Friends/pull/85)**; schedule now stores `{playerIds:[...]}` objects, with an updated test. |
| Large replay artifacts | A ~5 MiB 4v4 recording produced an 18.36 MiB `canonical-bundle.zip`; uncompressed `statistics.json` upload returned HTTP 413 in Storage emulator. | Lossless gzipped JSON with compressed/original SHA-256 and shared legacy-compatible readers replaces the uncompressed persistence path. Requires deployed sizing/throughput validation. |
| Resumable emulator corruption | Standalone ~18.36 MiB test: non-resumable saved/downloaded correctly; 8 MiB resumable chunks yielded exactly 8 MiB on download. Mandatory SHA-256 correctly rejected the truncated upload. | Do **not** disable evidence integrity checks or promote an unverified workaround. |
| Local storage workaround | Non-resumable emulator evidence transfer plus losslessly gzipped statistics, storage metadata and decompression reader enabled the reported 4v4 run; full checksums were retained. | The reviewed storage implementation uses a distinct stable metadata contract and retains historic uncompressed file compatibility. **Synthetic emulator database data are not carried into `main`.** |

The authenticated replay upload and canonical evidence remain security-sensitive. The temporary emulator email/password login shortcut must never be committed or deployed.

## Outstanding acceptance and next engineering work

- The E2E rehearsal is **closed** by product decision as a successful core smoke test. Successful Event finalisation, exact point-ledger verification and duplicate protection remain independently untested; retain these as future acceptance tasks rather than fabricating a pass.
- Back up the local emulator (Auth, Firestore, Storage) **before** further test edits; the CLI has previously crashed on Windows after exporting, so verify the output files. Preserve staging and production unchanged.
- The warm-up Firestore fix is on `main` (PR #85). The revised gzip statistics path verifies stored bytes and original JSON, preserves legacy uncompressed reads and covers both statistics queries and backfills; deployed payload sizes and error handling still require acceptance testing.
- Test normal multi-account check-in, scheduler delivery, corrections/disputes, repeat-source attribution, duplicate processing, admin authorization and genuine recording timing. The complete replay corpus and semantic review remain distinct from UI smoke checks.
- Benchmark Replay Lab/worker extraction, canonical size, JSON size, HTTP transfer, browser retrieval and memory. The user observed ~150 seconds for the failed 4v4 pipeline attempts; no phase-specific performance bottleneck is proven. Draft [PR #83](https://github.com/Mathias-ao/League-of-Friends/pull/83) is a baseline proposal, not an optimization result.
- Further work: source-grounded FFA placement/outcome qualification; conservative diplomacy/social interpretation; explicit Reputation/Relationship/Personality/portrait rules. No invented game-state facts or unapproved social awards.

### Related PR disposition

- [PR #81](https://github.com/Mathias-ao/League-of-Friends/pull/81) — **closed without merge**; historical binary fixture corpus and synthetic test identity mappings were not promoted.
- [PR #82](https://github.com/Mathias-ao/League-of-Friends/pull/82) — **closed without merge**; superseded by production-facing storage changes in merged [PR #86](https://github.com/Mathias-ao/League-of-Friends/pull/86).
- [PR #83](https://github.com/Mathias-ao/League-of-Friends/pull/83) — remains a **draft** baseline performance harness; no measured 4v4 optimization demonstrated.
- The unrelated Chronicle story-engine drafts remain independent and must pass their own evidence and review gates.

## Technical reference and working rules

**League → Season → Event → Match → Game** is the authoritative hierarchy; the user-facing terms include Battle (Match) and Roundoff. One `.aoe2record` represents one Game. Source hashes, versioned evidence, qualification, provenance, audit history and idempotent correction are non-negotiable. Separately versioned measurement, social interpretation, League Points, Gold and other ledgers must not be conflated.

For active metric versions and evidence limits, use [Current Statistics](CURRENT-STATS.md) rather than historical September version names. For product identity and social rules, use [Core Identity](CORE-IDENTITY.md); for replay extraction, the [Replay Foundation](../replay-foundation/README.md); for launch boundaries, [Statistics launch-readiness](../testing/statistics-launch-readiness-2026-10-07.md); for the concluded E2E, [the closeout report](../testing/e2e-core-closeout-2026-10-10.md). GitHub `main` is implementation source of truth; historical branches, PR descriptions and chat observations are explicitly lesser evidence.

**Next bounded action:** develop evidence-qualified Player Reputation (Gallantry, Cruelty, Chivalry) and pair Relationships (Rivalry, Hostility, Bond) using versioned neutral social evidence. Keep Event finalisation, ledger checks and real-user flow in a separate acceptance backlog. No staging or production deployment is implied by GitHub merges.
