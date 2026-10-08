# Statistics launch-readiness audit — 7 October 2026

Scope: current main `1e54b4178197a552decff2d5187b3058eef41186`, hardened on
`fix/statistics-launch-readiness-v1`. Product authority is the five-category,
source-Game-based [statistics experience](../design/statistics-experience.md).
This change does not deploy or activate social awards.

## Findings and applied changes

| Finding | Fix | Practical effect |
| --- | --- | --- |
| Season enrichment restored values rejected by the base projection; a reason string did not reject a numeric input | Shared final qualification pass plus reason-aware setters | Partial/unqualified values cannot become public records through a second projection |
| Five/ten/twenty/thirty-minute rows could use a shorter observed interval | Duration gates at every displayed fixed boundary, including military checkpoints | Short recordings produce unavailable checkpoint rows, not prefix counts or fabricated zero |
| Missing Battle/Blacksmith arrays were treated as empty | Distinguish complete empty evidence from missing/incomplete evidence | Legitimate zero remains usable; missing evidence stays unavailable |
| Battle durations were summed even when episodes overlap | Merge validated start/end intervals | Battle time measures the union of available episode windows |
| Inapplicable allied evidence could reach highlight generation | Require qualified applicability before publishing assist/cooperation episodes; reject episode times outside the recording | Qualification protects narrative as well as numeric rows |
| Missing composition families were silently zeroed; unknown queues could disappear from production | Require complete family fields and guard unresolved queues not covered by classified producer fallback | No invented composition or complete production claim; supported fallback still works |
| Unresolved building/research classification or incomplete pricing could support total/record claims | Guard affected classified counts/timings and complete commitment/ratio values; preserve raw evidence | Known subtotals remain in the artifact but are not silently ranked as complete totals |
| Cached measurements were checked only for roster membership | Bind source hash, replay-slot mapping, roster/team/civilization context | A slot reassignment cannot inherit another player's cached statistics |
| Public reads could span a correction/dispute/source change or Game insertion/deletion | Recheck authoritative document tokens and query membership before returning | Mixed reads abort with retry; persisted rebuilds retain transaction consistency |
| Upload initially stored only the base compact projection | Publish the qualified Season projection immediately; trigger on mapping/source changes too | Current uploads are ready for all catalogue keys; legacy hydration remains supported |
| Labels implied completed units/buildings, all combat, possession or actual territorial hostility | Queue/placement/detected-event/known-relic-target/command-presence wording in active surfaces | Players see the measurement's meaning before opening a tooltip |
| Statistics status described September versions and unfinished integration that now exists | Rewrite CURRENT-STATS and link it as current authority from older state/test-run notes | Launch decisions have one precise implementation inventory |

## Compatibility and migration

Shared presentation advances to `AOF_STATISTICS_EXPERIENCE_V3`; Season catalogue
projection advances to `AOF_SEASON_SHOWCASE_V2`. These version the changed eligibility,
read-model fields and Battle-time presentation. Underlying canonical schema, replay
models, detector thresholds, stored raw metric values and historical goldens remain
unchanged. No npm dependency or lockfile changes.

Legacy compact projections must rehydrate from retained, hash-verified statistics
JSON. Until hydrated, they are excluded and counted as unavailable rather than
contributing stale values. Loading the relevant Battle/Event/Season invokes hydration;
source-change triggers rebuild current aggregate documents. Missing retained artifacts
cannot be repaired by guessing; those Games remain explicitly unavailable. Canonical
bundles and original statistics remain intact, so these guards alone require no
re-upload or re-extraction.

Raw Replay Lab metrics remain an evidence-review surface; the stronger public
eligibility pass is a read-model rule, not a rewrite of the source's partial numeric
subtotals. Replay Lab labels now distinguish requests, placements and detected events.
Version/model/source information remains necessary when comparing historical outputs.

## Verification

Local verification completed:

- Backend build/type-check and **114 tests passed**.
- Website build and **43 tests passed**, including catalogue/record DOM interactions.
- Replay Lab **20 tests passed**; callable-boundary checks passed.
- Python replay suite: **260 run, 256 passed, four explicit opt-in skips**.
- Retained three-recording full-conformance campaign passed; the report was generated.
- The new V3/V2 presentation was additionally projected over all three generated
  artifacts. Stored statistics bytes remained identical. Supported farm, queue,
  military-checkpoint and Blacksmith values remained available.
- `git diff --check` passed. Local Node is 24; repository CI uses Node 22. The website
  retains its existing asset/bundle-size warnings; no new build failure was introduced.

These are **433 passing unit/regression checks**, plus the conformance campaign and
read-model smoke checks. Tests validate contracts and regressions, not every metric's
agreement with actual game-engine outcomes.

| Recording | Farm placements, slots 1 / 2 | Military queue amounts | Net queue commitment @20 | Supported Blacksmith requests @30 |
| --- | --- | --- | --- | --- |
| 1v1 | 22 / 28 | 95 / 65 | 820 / 1360 | 3 / 4 |
| 1v1_1 | 60 / 47 | 75 / 74 | 1240 / 1520 | 3 / 5 |
| 1v1_2 | 60 / 47 | 75 / 74 | 1240 / 1520 | 3 / 5 |

**Sample independence:** 1v1_1 and 1v1_2 are paired perspectives of the same Game.
The existing three-Battle harness assigns synthetic league identities/chapters for
consumer testing; it does not establish three independent real encounters or satisfy
production personality/relationship recurrence. Three file hashes do not prove three
Games. Production uses the approved Game and one active source; correct upload binding
is part of the player-flow acceptance. Cross-Game misassignment of a different POV is
not automatically solved by same-file-hash deduplication.

Regression coverage includes both base and Season projection, raw-input immutability,
short/boundary-length recordings, legitimate empty evidence, pricing/classification
gaps, scoped ally eligibility, composition, overlap, invalid/out-of-range chronology,
source mappings, accepted corrections, disputes, opt-outs, deletions and concurrency.
Existing DOM tests exercise catalogue rendering, evidence/source navigation, records
and all-time versus normalized views with the corrected labels.

The full-conformance campaign validates the parser/canonical seal and existing
longitudinal consumers on retained duel recordings; it is not a substitute for the
deployed player-flow test or footage-based semantic validation. A current-patch naval
FFA and fixed-team footage check remain part of the acceptance plan. No attack intent,
completed production, actual combat outcomes, relic possession or official social
scoring was newly qualified by this work.

## Remaining decisions

- Run the deployed player flow and desktop/mobile acceptance before launch.
- Keep supported numeric/inferred V1 measurements; do not enlarge the metric catalogue.
- Qualify future patch/mod/restore tuples and effective dynamic diplomacy separately.
- Preserve the distinction between eligible Game denominators and future multi-Game Battles.
- Introduce pagination/batching before exceeding small-league callable/transaction limits.
- Keep official reputation/relationship scoring gated until semantic adapters,
  progression policy and activation/persistence are ready.
