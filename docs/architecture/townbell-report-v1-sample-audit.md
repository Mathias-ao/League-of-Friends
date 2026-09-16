# TownBell Report V1 — Sample Audit

Status: ingestion fixture audit, 16 September 2026

Purpose: record the real TownBell outputs used to freeze `TOWNBELL_REPORT_V1` without committing the large reports themselves.

## Sample set

The supplied TownBell JSON reports were produced from the repository recordings:

| TownBell sample | Repository recording | Players | TownBell GUID | Duration ms |
|---|---|---:|---|---:|
| `1v1_townbell.json` | `replay-fixtures/1v1.aoe2record` | 2 | `be0cba6c-dea7-b640-995f-443802c9c2e5` | 2,399,618 |
| `2v2_townbell.json` | `replay-fixtures/2v2.aoe2record` | 4 | `ae321f00-a4e7-df4d-972a-ebdd14448b53` | 2,003,471 |
| `3v3_townbell.json` | `replay-fixtures/3v3.aoe2record` | 6 | `69a33ef6-c65b-b340-bbc6-87e362b0a849` | 1,467,416 |
| `4v4_townbell.json` | `replay-fixtures/4v4.aoe2record` | 8 | `d87db6f6-e2ea-744a-91a6-ec52a553c0de` | 3,295,040 |

The association to these repository recordings comes from the supplied fixture set. Git object ids are not replay SHA-256 values and are not used by the ingestion contract.

## Shared report envelope

All four supplied reports agree on the following structural contract:

- `schema_version` is `2`;
- top-level keys are `schema_version`, `meta`, `catalog`, `categories`, `players`, `charts`;
- `catalog` contains exactly 320 entries;
- all four catalog arrays are identical;
- ordered categories are:
  - `opening`
  - `economy`
  - `military`
  - `combat`
  - `map_control`
  - `tempo`
  - `mechanics`
- chart keys are:
  - `spend`
  - `eco_military`
  - `apm`
  - `composition`
  - `villagers`
  - `fights`
  - `timeline_events`
  - `camera_heatmap`
  - `map_overlay`
- `players` is keyed by TownBell player number;
- each player report contains `metrics`, `data_coverage`, and `buildings`;
- every player metric map contains all 320 catalog ids;
- metric records retain TownBell values as-is, including null values and `na_reason` where TownBell emits them;
- `meta.players`, the player report keys and `meta.pov_number` agree in all four samples;
- exactly one player is marked `is_pov: true` in every sample;
- `meta.degraded` is null in all four samples.

All four were produced with save version `68`, game build `180059`, and entity-data version `2026.07.6`. Those values describe this sample set; `TOWNBELL_REPORT_V1` validates them as metadata but does not hard-code those exact values.

## Hash and size audit

Hashes below use the source file bytes for the raw hash and recursively key-sorted/minified JSON for the canonical hash.

| Sample | Raw bytes | Raw SHA-256 | Canonical bytes | Canonical SHA-256 | Gzip bytes |
|---|---:|---|---:|---|---:|
| 1v1 | 235,644 | `cf030962114f638b5bbc8176f5d1076a47ba2e91907dba042d1dba2006f8e4fe` | 136,652 | `6f8bc5ce6d2d841a86ea4fa1a79713fe55a03d8bc1e167dc98678d2efb5d1bef` | 19,671 |
| 2v2 | 303,415 | `b796b749e4231ae8bc62536d81c3d7e04dfc2c4309f032c390f683e1f26acfbc` | 177,519 | `c19d8185735bd0b2a41fa812df1158e213475b9670f76969b1314afa61b7fbb1` | 25,633 |
| 3v3 | 335,460 | `309c830bf6f15a8501642b410338a37262e90d2ef90bb570be193b1c2a8baaad` | 198,893 | `cef595613248c59447c160571b1b0e32225a856967033869f9237ac8c300f1cd` | 26,040 |
| 4v4 | 818,893 | `b7606a363fc81154821f9f5793bba99200ac1a8ed9f9ae3640d83134226c992f` | 447,002 | `f65d61361537ca1d525563dc69114bb606f3c722203d85bbebbe55745eae4ef8` | 56,526 |

The common canonical catalog SHA-256 is:

`0291ef198aa3ba6ee1dc4bda449f082b470f56f9c9961848a13e2664c43c7a82`

The audit demonstrates that gzip-compressed canonical reports are comfortably below the V1 Firestore storage envelope for the supplied 1v1–4v4 shapes.

## What this audit does not establish

This sample audit freezes only the ingestion envelope. It does not settle:

- which TownBell metrics Age of Friends will interpret;
- correctness or confidence of individual TownBell metrics;
- player-facing names or units;
- additional inferred statistics;
- points formulas;
- Rivalry / Enemy / Friend formulas;
- FFA or dynamic-diplomacy interpretation rules;
- support for later TownBell schema versions.

Those decisions belong to later versioned layers in the V1 workflow.
