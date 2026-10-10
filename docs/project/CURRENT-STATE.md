# Age of Friends — Current State

Last reviewed: **10 October 2026**. Read [Core Identity](CORE-IDENTITY.md) for binding product decisions and [Current Statistics](CURRENT-STATS.md) for active models, evidence limits and publication status. This page is a current-state summary, not a change log or a production-acceptance certificate.

**Keep three states distinct:** `main` is the merged source implementation; `demo-aof-e2e` is an isolated, user-operated local Firebase emulator with temporary code adjustments; staging (`age-of-friends-staging`) and production (`league-of-friends-cc274`) are separate environments. An observed emulator success does **not** mean a fix was merged, deployed or accepted with real users.

## Current product and implementation

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

**Outcome: core functional rehearsal succeeded in the isolated emulator; full release acceptance and Event closure are not claimed.** The user reported the following observed sequence:

1. Eight simulated accounts signed in separately; all entered one local Season, signed up and RSVP'd to one eight-player BIG_TEAM Event.
2. Four automatic 1v1 warm-up pairings were created after invoking the lifecycle manually. A Firestore failure storing nested `pairs` arrays was corrected **locally** by persisting objects containing `playerIds`; scheduler/Pub/Sub automatic execution was not tested.
3. Main attendance used audited `LATE_ADDED` administrator exceptions before the actual check-in window; the main pairing proposal and approved 4v4 were created. This is **not** a successful test of normal timed player check-in.
4. Real historical recordings were used with explicit Game-scoped bindings to synthetic player identities. A Glade recording (observed map ID 188) was correctly rejected against the announced Arabia map (configured ID 9); the Emperor's reviewed-winner control was subsequently exercised. The other three warm-up Battles were successfully cancelled.
5. The eight-player historical 4v4 was ingested using local-only evidence-storage adjustments. The user reported successful statistics, point distribution, leaderboard and player-profile updates. The 4v4 and reviewed warm-up results were treated as **synthetic workflow rehearsal**, not proof those Games occurred during the new Event's play window.
6. The Emperor closure checklist reported **only** `The main Event has not started` while the scheduled start was still in the future. The backend intentionally blocks closure before `startsAt`. **Successful Event finalisation remains untested** in the reported run.

The user's visual checks establish that outputs appeared and updated, **not** independent numerical validation of every statistic, exact point-ledger totals, all individual player calculations or duplicate-award prevention. Historical fixtures and the `T90Official` identity are not permission to assert real Steam identity equivalence across synthetic accounts.

### Blocking bugs found, and repository boundaries

| Finding | Local evidence / disposition | `main` as inspected 10 October |
| --- | --- | --- |
| Warm-up pairing persistence | Firestore rejects nested arrays under `warmupSchedule.pairs`; local serializer changed them to `{playerIds: [...]}` objects and local test continued. | `functions/src/services/warmupLifecycle.ts` still writes `...draw` with nested `pairs`. **Unmerged defect.** |
| Large replay artifacts | A ~5 MiB 4v4 recording produced an 18.36 MiB `canonical-bundle.zip`; uncompressed `statistics.json` upload returned HTTP 413 in Storage emulator. | `uploadReplay.ts` saves plain `statistics.json` non-resumably; production-safe size handling is not merged. |
| Resumable emulator corruption | Standalone ~18.36 MiB test: non-resumable saved/downloaded correctly; 8 MiB resumable chunks yielded exactly 8 MiB on download. Mandatory SHA-256 correctly rejected the truncated upload. | Do **not** disable evidence integrity checks or promote an unverified workaround. |
| Local storage workaround | Non-resumable emulator evidence transfer plus losslessly gzipped statistics, storage metadata and decompression reader enabled the user-reported successful 4v4 run; full checksums were retained. | Local changes are **not** represented by `main`. Draft [PR #82](https://github.com/Mathias-ao/League-of-Friends/pull/82) is explicitly demo-only and must not be merged/deployed without separate compatibility review. |

The authenticated replay upload and canonical evidence remain security-sensitive. The temporary emulator email/password login shortcut must never be committed or deployed.

## Outstanding acceptance and next engineering work

- **Close the E2E Event** through the normal Emperor action after scheduled kickoff; verify `COMPLETED`, correct ledger and standings, zero awards for cancelled warm-ups, and refresh/retry idempotency. Until then, record the run as **core E2E passed, finalisation pending**.
- Back up the local emulator (Auth, Firestore, Storage) **before** further test edits; the CLI has previously crashed on Windows after exporting, so verify the output files. Preserve staging and production unchanged.
- Isolate, regression-test and code-review the warm-up nested-array fix; then evaluate a production-safe, lossless, versioned storage solution with upload/download SHA-256 verification, legacy reads and realistic payload limits. Do not blindly merge local testing code.
- Test normal multi-account check-in, scheduler delivery, corrections/disputes, repeat-source attribution, duplicate processing, admin authorization and genuine recording timing. The complete replay corpus and semantic review remain distinct from UI smoke checks.
- **After functional closure**, benchmark Replay Lab/worker extraction, canonical size, JSON size, HTTP transfer, browser retrieval and memory. The user observed ~150 seconds for the failed 4v4 pipeline attempts; no phase-specific performance bottleneck is proven. Draft [PR #83](https://github.com/Mathias-ao/League-of-Friends/pull/83) is a baseline proposal, not an optimization result.
- Further work: source-grounded FFA placement/outcome qualification; conservative diplomacy/social interpretation; explicit Reputation/Relationship/Personality/portrait rules. No invented game-state facts or unapproved social awards.

### Open work kept separate from this documentation

- [PR #81](https://github.com/Mathias-ao/League-of-Friends/pull/81) — draft historical fixture and synthetic identity-mapping helpers, not a real-user acceptance certificate.
- [PR #82](https://github.com/Mathias-ao/League-of-Friends/pull/82) — draft **demo-only** statistics storage proposal; do not merge or deploy as-is.
- [PR #83](https://github.com/Mathias-ao/League-of-Friends/pull/83) — draft baseline performance harness; no measured 4v4 optimization demonstrated.
- The unrelated Chronicle story-engine drafts remain independent and must pass their own evidence and review gates.

## Technical reference and working rules

**League → Season → Event → Match → Game** is the authoritative hierarchy; the user-facing terms include Battle (Match) and Roundoff. One `.aoe2record` represents one Game. Source hashes, versioned evidence, qualification, provenance, audit history and idempotent correction are non-negotiable. Separately versioned measurement, social interpretation, League Points, Gold and other ledgers must not be conflated.

For active metric versions and evidence limits, use [Current Statistics](CURRENT-STATS.md) rather than historical September version names. For product identity and social rules, use [Core Identity](CORE-IDENTITY.md); for replay extraction, the [Replay Foundation](../replay-foundation/README.md); for launch boundaries, [Statistics launch-readiness](../testing/statistics-launch-readiness-2026-10-07.md); for current local test fixtures, [historical recording E2E protocol in draft PR #81](https://github.com/Mathias-ao/League-of-Friends/blob/test/replay-e2e-t90-fixture-v1/docs/testing/historical-t90-replay-e2e-fixture.md). GitHub `main` is implementation source of truth; historical branches, PR descriptions and chat observations are explicitly lesser evidence.

**Next bounded action:** finish the isolated Event closure/ledger verification when the scheduled start permits it, then turn local defects into reviewed, tested PRs before considering staging or production deployment.
