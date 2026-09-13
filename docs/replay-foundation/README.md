# Replay foundation index

This directory makes the replay-analysis research available inside the repository so future work does not depend on old chats or external attachments.

## Authority and purpose

| Source | Role |
|---|---|
| [`Age-of-Friends-Replay-Analysis-Foundation.md`](Age-of-Friends-Replay-Analysis-Foundation.md) | Authoritative research, paired-fixture findings, evidence boundaries, architecture and qualification backlog. |
| [`../../replay-tools/canonical-replay-v1.schema.json`](../../replay-tools/canonical-replay-v1.schema.json) | Current machine contract for CanonicalReplay v1, schema 1.1.0. The exact original 1.0.0 schema is archived under `replay-tools/schemas/`. |
| [`townbell-capability-matrix.csv`](townbell-capability-matrix.csv) | 320-row capability-to-primitive traceability catalogue. It is not the permanent data contract. |
| [`../architecture/replay-extraction-contract-v1.md`](../architecture/replay-extraction-contract-v1.md) | Settled AoF extraction-tool requirements derived from the research and current implementation. This controls later extraction implementation. |
| [`../../replay-tools/README.md`](../../replay-tools/README.md) | Current extractor, replay-free projection and golden conformance instructions. |
| [`../architecture/canonical-v1-conformance-milestone.md`](../architecture/canonical-v1-conformance-milestone.md) | 13 September implementation audit, verified scope and unresolved semantics. |
| [`../../README-TEST.md`](../../README-TEST.md) | Historical V3 structural corpus instructions. |
| [`../../README-MATCH-ANALYSIS-V1_4.md`](../../README-MATCH-ANALYSIS-V1_4.md) | Current analysis-only V1.4 instructions. |

When these sources differ, follow the repository-wide authority order in [`../project/PROJECT-CONTINUITY.md`](../project/PROJECT-CONTINUITY.md): latest explicit user decision, current code for implemented behavior, named specialist artifacts, continuity, then old conversations.

## Integrity

| File | SHA-256 |
|---|---|
| `Age-of-Friends-Replay-Analysis-Foundation.md` | `a878ad5c6323914b34ba7a28dd6391f47bfe79e00a9110306a9335691e935c65` |
| `../../replay-tools/canonical-replay-v1.schema.json` | `ce77a16a94bf1f44f56aa11c0445b29d9d0372777f126ca3e676b747822d0c97` |
| `townbell-capability-matrix.csv` | `2506011e77cf17a5f4c6bd2d36aae6bcf1b6f85fde62462c44fe5982e4d1d4ce` |
| `../architecture/replay-extraction-contract-v1.md` | `c602f17899aaddd1e20c975d67ec0f2415d9e19b5f5283e3b729fca5d13d7009` |

These hashes cover the repository bytes after this foundation was synchronized. Change an authoritative source by creating a deliberately versioned successor and updating this index, continuity and dependent contracts.

## Core evidence rule

Preserve direct parser facts, deterministic reconstructions, inferred analysis and league scoring as separate versioned layers. Queue/order/placement/click/command terminology stays precise unless stronger evidence exists. Source identity and raw unknown evidence remain recoverable from canonical artifacts. Uploaded recordings are temporary and can be deleted only after verified canonical extraction and durable persistence; players retain their originals. New metrics should consume retained canonical evidence; only a missing or incorrectly decoded source primitive justifies binary replay reprocessing.
