# Age of Friends — Real recording social evidence review

Reviewed on 2 October 2026 on `feat/pair-social-evidence-v1`.
This is a recording regression and semantic review, not controlled engine-state qualification.

## Corpus and reproducibility

The audit manifest retains 14 committed recordings with 13 distinct decoded Game GUIDs. `1v1_1` and `1v1_2` share a GUID and are perspectives of one Game. They cannot supply two independent encounters, rivalry recurrences or season history. Both the pre-correction and corrected audit compare their aggregate episode output.

Run `social_context_audit.py` remotely through **Real Social Context Audit**, or against an existing checkout with `python replay-tools/social_context_audit.py --seal-mode fast --out .replay-lab/social-context-audit.json`. It creates temporary extraction bundles and does not replace retained recordings or canonical bundles. Reports are available as workflow artifacts and compact JSON in job logs.

The default fast seal performs structural checks; it is not exhaustive byte/event conformance. Full mode is available separately. The existing Three-Battle Statistics Validation performs full conformance on its three-file campaign; its two paired duel files still do not constitute independent Games for relationship semantics.

For each recording, the audit compares all projected statistics and the neutral ledger with contextual projection disabled, validates command provenance and direction, checks input immutability, rebuilds context from retained statistics, and repeats with duplicate/reordered evidence. Context cannot create deeds, score reputation/relationships, qualify absence, establish reciprocal attacks, or claim outcomes.

## Edition-specific team-lock correction

The retained header probe found conflicting fields in 11 recordings: the DE setting `de.lock_teams` is true, while the legacy lobby setting is false. The extractor previously preferred the legacy field, suppressing qualification of ally-support and shared-offense families. The three genuinely unlocked recordings report explicit DE false.

`build_settings` now prefers an explicitly present DE value, including false. Missing DE values fall back to the legacy field; missing both remains unknown. This does not use logical OR. The canonical normalizer advances to `AOF_CANONICAL_NORMALIZER_V1_2`; the schema and detector algorithms are unchanged. Existing immutable bundles preserve their historical revision. Corrected extraction must produce a new bundle and rebuilt derived evidence, never edit the old canonical manifest in place.

Regression cases cover both disagreement directions, legacy fallback, missing flags and the new normalizer revision. The original controlled conformance golden remains unchanged.

## Reviewed result

Code revision: `43c6a5bc218db4dad1ca4576f4a691e145030c63`.
[Corrected corpus audit](https://github.com/Mathias-ao/League-of-Friends/actions/runs/37064833875) passed every recording, including all preservation/provenance/rebuild checks. [Replay Tools CI](https://github.com/Mathias-ao/League-of-Friends/actions/runs/37064833867) passed 232 Python tests (229 passed, three private-fixture tests skipped), compile/CLI checks and the Node artifact tests. Replay Lab CI passed. These recording results do not depend on the skipped private fixtures.

| Recording | Pressure | Local contest | Directed support | Shared pair/target | Response context | Return sequence | Support/pressure context |
|---|---:|---:|---:|---:|---:|---:|---:|
| duel | 6 | 5 | 0 | 0 | 6 | 0 | 0 |
| paired-duel-pov-1 | 7 | 14 | 0 | 0 | 7 | 1 | 0 |
| paired-duel-pov-2 | 7 | 14 | 0 | 0 | 7 | 1 | 0 |
| 2v2 | 8 | 1 | 0 | 0 | 6 | 1 | 0 |
| 3v3 | 5 | 13 | 1 | 0 | 5 | 0 | 0 |
| 4v4 | 36 | 58 | 13 | 25 | 25 | 6 | 7 |
| multiple-team | 30 | 99 | 0 | 0 | 10 | 2 | 0 |
| ffa | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| townbell-ffa | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aof-test-1 | 1 | 4 | 0 | 0 | 1 | 0 | 0 |
| aof-test-2 | 3 | 20 | 0 | 0 | 3 | 0 | 0 |
| aof-test-3 | 5 | 7 | 0 | 0 | 5 | 2 | 0 |
| nomad | 21 | 4 | 1 | 0 | 13 | 5 | 0 |
| water | 38 | 34 | 0 | 15 | 25 | 6 | 0 |

Counts are recording-level neutral incidents/context rows, not relationship points or confirmed combat outcomes. A coalition may create several allied pair/target incidents; they must not be summed into independent coalition deeds. The duplicate duel perspective must be excluded from recurrence/history counts. An unavailable family with zero rows means unknown.

The corrected corpus retains six AMBIGUOUS_RESPONSE_PRESSURE diagnostics, fourteen RETURN_PRESSURE_INDEPENDENCE_UNAVAILABLE diagnostics, and one RESPONSE_PRESSURE_UNAVAILABLE diagnostic. These counts include both paired duel perspectives. No corresponding ambiguous/unqualified links are manufactured. Aggregate comparison of the paired duel perspectives found no differences.

### Concrete reviewed samples

- 4v4: allies 2 and 4 share target 7. Their retained contributions contain four and sixteen own-player commands respectively, under a single target-specific pair incident beginning at 748,780 ms. This does not flatten them into cooperation with attackers elsewhere.
- Water: allies 3 and 7 share target 4, with three and five own-player commands respectively, beginning at 716,904 ms. Planned coordination and damage remain unavailable.
- 4v4: support from 1 → 7 is linked through the same inferred defensive clash to pressure from 4 → 7. The report retains the exact contest, support and pressure provenance. It explicitly does not establish direct helper attacks or continuous pressure.
- Nomad: reinforcement commands from 5 → 1 remain directed support, without a manufactured defensive-support-with-pressure annotation. The same conservative distinction applies to the 3v3 defensive participation that has no qualified pressure join.
- The two FFA recordings emit no pair incidents but do not qualify absence. The larger FFA recording still retains four object-directed relic-targeting observations, which do not become theft or a player grudge.

These are canonical replay player IDs, not durable league people. Selected object classes are often unknown in support samples (including the 4v4 sample); a command-selection footprint does not establish military contribution or rescue. Class/outcome qualification is needed before stronger narrative or reputation interpretation.

## Interpretation limits

An Execution V2 response association is not deliberate retaliation. Its command vocabulary includes MOVE, ORDER, attack-move, town bell, STOP and REPAIR. Some are non-positional; even positional commands can be far from an episode's averaged center. The source detector's response definition must remain visible rather than becoming a psychological claim.

Raid V3 starts at its first strong command, while its retained source set can include earlier supporting commands. The neutral incident's command envelope and the source response latency therefore have different start meanings. Do not subtract the envelope start and call the result reaction time.

Return pressure records a later independent pressure episode in the reverse direction. It establishes chronology, not revenge or reciprocal unit attacks. Defensive-support context preserves helper → recipient and the separately attributed threat; it does not prove a rescue or damage prevented. Shared offensive participation preserves each allied pair's common opponent and their own commands; it does not prove planned coordination.

The two FFA recordings retain lobbyTeamId 1 for every participant and initially distinct diplomacy rows. The current Raid V3 static same-team check treats equal positive lobby values as the same team, and neither FFA recording emits pair incidents. This is an identified source-coverage gap, not observed peacefulness. Qualify the no-team sentinel and alignment semantics in a separate versioned source correction before admitting FFA opposition; do not patch relationship weights around it.

Dynamic-team and FFA recordings remain unqualified for effective alliance interpretation. No detected episodes does not mean peaceful play or failed cooperation. Relic targeting remains an object-directed observation; successive commands do not establish possession, capture or theft.

## Next evidence gate

The next work should qualify engine-backed outcomes and effective diplomacy against controlled recordings, then bind replay slots to durable league people and deduplicate canonical revisions/perspectives at Game ingestion. Score/APM/standings context and inferred motives cannot bypass those gates. Chronicle candidates may describe qualified episode facts while keeping uncertain interpretation explicit. Live relationship and reputation scoring remain inactive.
