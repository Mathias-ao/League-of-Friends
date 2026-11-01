# Genuine authenticated Personality across two Battles — #223

This fixes a reproduced source-context adapter failure on main `893ed734b96f4f77f23d7dfeeee8fd374dfbb93d`. The unchanged originals passed ordinary authenticated AUTO upload and current-source admission, but two approved independent Battles yielded zero measured Battles. The failing assertion was retained until the adapter repair passed it.

## Original source and controlled authority

| Original fixture | SHA-256 | Same recorder | Map / civilization | Natural outcome in the demo |
|---|---|---|---|---|
| `1v1_t90-dobb` | `f4122159245f2374ba90989501869b0f0609f2741144d9723feb6cabba631763` | Profile 197930, slot 2 | Glade 188 / Japanese 5 | UNRESOLVED, null winner and result revision |
| `1v1_t90-deak` | `3f2ee71756017332182620ee9f273e249b3fe6bc61222637df26bb7a84d400ef` | Profile 197930, slot 1 | Arabia 9 / Bohemians 39 | OFFICIAL through the existing resolver |

Recording bytes and independent reference metadata come from fixture commit `2d04ec6adbe871d156c108a4351448efeb08f4e6`. League identities, membership and approved Event/MatchPlan scheduling are controlled emulator fixtures, not actual historical AoF membership or Battles. Uploads arrive in reverse order; plan order remains authoritative. Each original retains its actual source slot/civilization/opponent and unique Game GUID. The existing separate INT-B/Chronicle run uses the same originals in **one** Battle and correctly stays Developing; the distinct-Battle case runs in a fresh emulator instance, never duplicate-claiming those GUIDs in one database.

## Narrow adapter correction

The canonical parser uses a nonzero scenario map ID, otherwise the DE RMS map ID. Both originals retain legacy `scenario.map_id=0` alongside matching positive DE/canonical maps. The adapter no longer mistakes that precise source shape for a map contradiction. This exception requires decoded canonical source path/meaning, matching positive typed DE/canonical/fact-map values and verified retained-header provenance. Nonzero contradictions, missing or malformed evidence still withhold admission.

Native MatchFacts does not duplicate `gameBuild` into `source`; it retains decoded `de.build=185872`. A fallback is admitted only with `headerSource.section=header.recordingHeader`, AVAILABLE header coverage, and a Recorded Events digest matching both MatchFacts provenance and the authenticated SourceSnapshot artifact reference. Explicit canonical/header build conflicts and malformed values are rejected. Existing valid explicit canonical builds retain their prior compatibility with absent/null header values. Newly consulted header provenance and artifact references participate in the admission digest.

No replay parser, source taxonomy, calibration, axis definition, scorer or production flag changed. Exact-hash reviewed map/start proofs, initial TC evidence, clocks, current source/revision, roster and slot binding remain required.

## Observed local source-to-UI result

An actual local AUTO → current native source → authenticated private reader → JSDOM run passed at source repair commit `ba99585676990804d42893e5354fdecc29e14c60`:

| Axis | Private proposed value from the actual API |
|---|---:|
| Boomer ↔ Aggressor | 53.88 |
| Cautious ↔ Bold | 16.67 |
| Compact ↔ Expansive | 42.27 |
| Guerrilla ↔ Frontline | Developing / null |
| Specialist ↔ Improviser | Developing / null |

Each numeric axis has two independent Battles. These are existing provisional private calibration outputs, not approved public poles or skill/social awards. Unsupported command attribution and military-family opportunity remain unmeasured. Glade's actual unresolved result is preserved; no result, statistics, context proof or axis value is seeded to make the case pass.

Withdrawal removes the required source and clears numeric readiness; restoring the original source rebuilds the same projection. Unauthenticated and target-spoof requests reject, an outsider cannot retrieve the owner's profile, and account changes clear the API-derived UI values. The read declares no official writes, receipts or entitlement grants. Ordinary source publication/result resolution is separate from these read effects.

Independent source review rebuilt the exact repair and passed 28 focused context/private/auth tests, including provenance, wrong-type/nonzero map/build conflict and legacy compatibility negatives. Final published-head CI must still run the combined workflow with this new original-source stage; local success does not certify a different commit. CI emits `personality-original-battles-report.json` with actual commit, processor, source facts, outcomes, values and JSDOM limits. The generic manifest now records the actual PR base from CI rather than a historical hardcoded main.

This is original-byte emulator and component evidence. Real-browser #132, full five-axis source opportunity/calibration, production activation and #143 p95 remain separate and unproven.
