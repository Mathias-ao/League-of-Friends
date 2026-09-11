# Replay foundation index

This directory makes the replay-analysis research available inside the repository so future work does not depend on old chats or external attachments.

## Authority and purpose

| Source | Role |
|---|---|
| [`Age-of-Friends-Replay-Analysis-Foundation.md`](Age-of-Friends-Replay-Analysis-Foundation.md) | Authoritative research, paired-fixture findings, evidence boundaries, architecture and qualification backlog. |
| [`../../replay-tools/canonical-replay-v1.schema.json`](../../replay-tools/canonical-replay-v1.schema.json) | Machine contract for CanonicalReplay 1.0. This is the single repository copy used by tooling. |
| [`townbell-capability-matrix.csv`](townbell-capability-matrix.csv) | 320-row capability-to-primitive traceability catalogue. It is not the permanent data contract. |
| [`../architecture/replay-extraction-contract-v1.md`](../architecture/replay-extraction-contract-v1.md) | Settled AoF extraction-tool requirements derived from the research and current implementation. This controls later extraction implementation. |
| [`../../README-TEST.md`](../../README-TEST.md) | Existing V3 structural corpus instructions. |
| [`../../README-MATCH-ANALYSIS-V1_4.md`](../../README-MATCH-ANALYSIS-V1_4.md) | Current analysis-only V1.4 instructions. |

When these sources differ, follow the repository-wide authority order in [`../project/PROJECT-CONTINUITY.md`](../project/PROJECT-CONTINUITY.md): latest explicit user decision, current code for implemented behavior, named specialist artifacts, continuity, then old conversations.

## Integrity

| File | SHA-256 |
|---|---|
| `Age-of-Friends-Replay-Analysis-Foundation.md` | `83df810d644e950155145049455ea52e8666d7b241c8da4bab20e4f71876c6e5` |
| `../../replay-tools/canonical-replay-v1.schema.json` | `a20de391236d8e81219fc2edac3e2407e391cbebd9c49b63a9d5e2822fa22f72` |
| `townbell-capability-matrix.csv` | `2506011e77cf17a5f4c6bd2d36aae6bcf1b6f85fde62462c44fe5982e4d1d4ce` |
| `../architecture/replay-extraction-contract-v1.md` | `53d86164b6f5e9cfe8c600fd85ce07d3523516e8e2ff52016a51323dd155a708` |

These hashes cover the repository bytes after this foundation was synchronized. Change an authoritative source by creating a deliberately versioned successor and updating this index, continuity and dependent contracts.

## Core evidence rule

Preserve direct parser facts, deterministic reconstructions, inferred analysis and league scoring as separate versioned layers. Queue/order/placement/click/command terminology stays precise unless stronger evidence exists. The original recording and unknown bytes remain recoverable. New metrics should consume retained canonical evidence; only a missing or incorrectly decoded source primitive justifies binary replay reprocessing.
