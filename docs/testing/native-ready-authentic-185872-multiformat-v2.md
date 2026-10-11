# Authentic build-185872 multi-format READY emulator acceptance (V2)

**Scope:** Opt-in controlled real-recording compatibility review of 1v1, 2v2, 4v4 and FFA against the *existing*, separately gated manual native READY publisher. Extends the single-file V1 [acceptance](native-ready-authentic-185872-local-v1.md); it does not implement automatic native READY, create an actual human-approved league result, or alter any production Firebase service.

The [authentic native emulator workflow](../../.github/workflows/authentic-native-ready-emulator.yml) pins the already-authorized real source corpus to `2d04ec6adbe871d156c108a4351448efeb08f4e6`. For each independent matrix job it checks a separate TownBell build=185872/save=68.9 analysis, extracts the exact recorded source names and slots into a **CI-private temporary manifest**, and processes the authentic recording with an authenticated localhost Python worker into an isolated `demo-aof-authentic-ready` Firestore/Storage emulator.

| Case | Pinned real fixture | Synthetic league outcome used *only for testing* |
| --- | --- | --- |
| 1v1 | `1v1_t90-deak` | One independently chosen test winner |
| 2v2 | `2v2_arabia` | A synthetic paired team of two is declared the winner |
| 4v4 | `4v4_arabia` | A synthetic group of four is declared the winner |
| FFA | `FFA_7` | One independently chosen test winner; **not** a verified replay placement |

Source slot mapping comes from the recording. Synthetic team groupings and winners deliberately do **not** claim correspondence to the real historical lobby affiliation, effective diplomacy, actual player agreement, or authoritative historical outcome. The normal current Game is **independently accepted in the test**, not automatically concluded by source bits. No points/Gold/Relationships/Chronicle awards are issued by the source-only publisher.

Each format must execute all the following *without relaxing a fail-closed assertion*: original retention, versioned Recorded Events and compressed native statistics verified at pinned Storage generations; `VALIDATED_NOT_READY` with no reader-visible source; independently test-accepted `PLAYER_WIN` or `TEAM_WIN`; explicit local flags plus allowlist and audited `PUBLISH` to `READY`; normal active-source qualification; authenticated bounded Battle detail; native Battle social-record overview/page; 32 KiB fragment assembly and SHA256 verification; flags-disabled denial; exact retry; separate `ROLLBACK`, released claim, no invented processing job, immutable originals. Only hashes, lengths, aggregate timings and pass/fail go to the retained CI artifact. Each matrix case is fail-fast for its own assertion and independent of the other formats.

**Performance:** The local `totalServerReceivedToValidationMs` timing and reviewed-publication/read/rollback durations are per-job observations, **not** full cloud upload-to-READY, the user's browser, p95, nor an automatic results workflow. Cold Cloud Run startup, Internet upload, current game-build compatibility outside 185872, arbitrary FFA coalitions, and full score/social/Chronicle reconciliation remain unqualified. Failure on FFA could be correct conservative rejection rather than a defect; do not bypass source mapping or social qualification to make a green badge.

**Governance:** CI executes a `demo-` emulator and localhost worker only. No Firebase staging/production deployment, no user-facing activation, no live account writes, no original/source deletion. A green PR is mergeable *test code*, not a launch certificate. Run genuine authenticated browser/cloud tests only after a separately approved deployment.

## Verified matrix result — 11 October 2026

[Authentic four-format CI workflow run 38126912675](https://github.com/Mathias-ao/League-of-Friends/actions/runs/38126912675) completed **successfully in all four real recording jobs**. The separate Backend CI, Player Website CI and native correction Functions-trigger workflow also passed on PR #110's code-bearing head `97245e6e7a3899ac9b6d3cb82f4fe3a57e9abde0`.

| Fixture | Recording participants | Real `uploadReplay.run` to `VALIDATED_NOT_READY` | Manually reviewed PUBLISH to READY | Battle-detail read | Social-record overview | Source-only rollback |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `1v1_t90-deak` | 2 | 10,935 ms | 195 ms | 95 ms | 91 ms | 87 ms |
| `2v2_arabia` | 4 | 25,872 ms | 445 ms | 152 ms | 285 ms | 120 ms |
| `4v4_arabia` | 8 | 32,538 ms | 1,914 ms | 598 ms | 1,709 ms | 152 ms |
| `FFA_7` | **8** (actual source participant count) | 27,276 ms | 1,143 ms | 182 ms | 971 ms | 168 ms |

All cases passed source integrity/retention, current active-source qualifications, reviewed READY, member-bound native episodes and social overview/page/fragment SHA-256 reconstruction, disabled-reader refusal, exact idempotent publication retry, rollback to `ROLLED_BACK`, release of a publisher-created recording GUID claim, and preservation of previous artifacts. The FFA fixture name does **not** imply seven participants; the decoded source has eight.

**Measured performance constraint:** Even in this local emulator environment, the 2v2, 4v4 and FFA candidate-validation stages exceeded the aspirational 20-second server-received-to-READY target **before** reviewed READY publication. This is not automatically READY; it is not live cloud latency, a cold Cloud Run/Internet upload test, a browser measurement, a percentile/SLA, or a source-independent verified historic game outcome. Fail-closed handling of real winner/diplomacy/FFA placement and full Chronicle/reward lifecycle remains unqualified. Source-only manual publication created no new official result-processing job by design.

Four per-job reports named `authentic-185872-reviewed-ready-<fixture>` are retained in GitHub Actions for 14 days; original recordings and private source-player names are *not* uploaded as artifacts. Each matrix case runs in a fresh demo emulator and retains only non-content acceptance metadata.
