# Statistics delivery V1 — experimental derived cache

Status: **offline prototype only**. No upload worker, Firestore, Storage, frontend, social reader, rewards, or deployed behavior is changed. Branch is stacked on `experiment/recorded-events-v1`.

## Reason

The recorded-event dataset is already compact, but the legacy full statistics result is not suitable as a normal browser response. The measured earlier 4v4 reported 94.9 MB of uncompressed statistics, of which about 91.95 MB was repeated participant engagement evidence. A separate current build-185872 4v4 was reported at 403.6 MB; its category-by-category breakdown is not yet published.

**Retain all observations, inferences, and full statistics.** Do not truncate them or change any detector. Split the *regenerable derived presentation* into:
- **Summary:** all existing statistics except the verbose `participants[*].military.engagements.engagementEvidence` arrays. Contains an explicit `statisticsDelivery` marker indicating an intentionally incomplete detail view. Do not pass this partial shape to legacy full-statistics consumers.
- **Detail index:** per source player and category, stable ordered content-addressed references and small previews.
- **Compressed detail blocks:** unique canonical JSON episode objects concatenated as a byte stream and cut into independently verified, bounded gzip blocks. Identical episode objects across players/categories are written once; the ordered references preserve all repetition semantically.
- **Integrity metadata:** the full canonical-statistics SHA-256, compressed hashes/sizes for every block and the summary. A full offline restoration compares against the original canonical-statistics digest.

The canonical full JSON output is **not** another mandatory permanent file in this model. The event history remains the single authoritative gameplay-evidence source. Summary, index and detail blocks are disposable/version-bound projection caches. Avoid storing both these derived caches *and* a redundant giant full-statistics JSON once a tested consumer migration is complete. Do not delete current artifacts during this experiment.

## Read model by AoF consumer

| Consumer | Proposed source | Important boundary |
| --- | --- | --- |
| Season / Event / leaderboards / Player profile | Existing small `StatisticsExperience` projection | Calculate from verified complete statistics before packing; do not hydrate giant engagement arrays in user requests |
| Battle statistics overview | This compact summary plus binding/revision-aware presentation metadata | Not the old full `getReplayStatistics` response |
| Battle engagements list | Authenticated, paged detail-index previews | Page at most 100 references; normally 25 |
| Selected engagement details | Authenticated, capped fragment reads from verified detail blocks | Max 256 KiB payload/fragment; huge episodes may need multiple fragments |
| Relationship / Chronicle / result qualification | Correct, server-side versioned social/result projections, computed from **full** qualified inputs | Never infer absence from an omitted detail array; no changes to official scoring |
| Recalculation | Permanent Recorded Events object | Derived statistics cache is regenerable; no original replay needed for model reruns |

The cache module supplies a format and offline read functions only. It does **not** authorize any new client-facing Storage permissions or claim native provenance is already compatible with current social/result readers.

## API in the offline prototype

`replay-tools/statistics_detail_delivery.py` exports:

- `write_delivery_bundle(statistics, destination)`: write-once directory with `summary.json.gz`, `manifest.json.gz`, and `details/NNNNNN.bin.gz`.
- `load_manifest(root, receipt)`, `load_summary(root, manifest)`.
- `list_detail_page(manifest, player_index, group, cursor=0, limit=25)`: previews and refs, never large episode bodies.
- `read_record_fragment(root, manifest, ref, offset=0, limit=262144)`: bounded raw UTF-8 byte fragments with a continuation offset, supporting single records larger than one block.
- `restore_full_statistics(root, receipt)`: **offline verification only**, restores every original engagement list and rejects digest differences.

The receipt and manifest hashes must be bound to a verified projection revision when integrated with Storage. Current file paths are local implementation details, not an approved Firebase key layout.

## Verification and remaining gates

Focused unit tests check exact restoration, content-addressed de-duplication, stable bytes, byte-limited fragments across gzip block boundaries, summary field preservation, invalid pagination, overwrite refusal and corruption rejection. This is not yet measured on the actual 95 MB or 403.6 MB outputs: **no compression-savings, cloud cost, read latency or deployed response-size claim is made.**

Before promoting, benchmark both 4v4 reports plus current build-185872 fixtures, including: unique record counts, archive sizes, manifest/index size, CPU, memory, fragment/page latency and largest episode record. Verify all original statistics and social projections, not only engagement counts. Set response budgets for summary and detail endpoints, test trust/authentication and changed active revision between requests, then connect the cache via a separate Firestore/Storage publication change.

**No production migration, deployment, upload protocol change, official outcome, scoring or formula changes are part of this PR.**
