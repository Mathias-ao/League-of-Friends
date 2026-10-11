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
