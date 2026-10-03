# Battle record review and rebuild boundary

The Battle statistics view now offers an expandable **Battle record and social evidence** section. It reads the active, hash-checked statistics artifact on demand. It does not replace statistics, submit results or award social points.

Recording context includes played-map metadata, population, speed, team lock, observed interval, raw rules and lobby groups. Unresolved map/rule identifiers remain identifiers; event map pools are not presented as the played map. Lobby groups are not temporal alliance proof. Current official league winners/non-winning roster come from the query's current result qualification, never replay resignations or postgame rank.

Episodes retain their distinctions: inferred pressure attribution, local overlap, attributed targeted commands, helper → recipient support, and the exact allied contributors plus common target. Context annotations do not become additional deeds. Missing coverage is never scored as absence. The full live ledger can be expanded; provenance remains available without crowding the ordinary scorecard.

Preview mode offers three abbreviated real-corpus audit examples: 4v4, one paired-duel recording, and FFA. They are explicitly separate from the illustrative Battle and carry the source fingerprint and audit commit. Counts represent the audit's whole recording; displayed episode samples and command references are abbreviated. They are review data, not new league Games or official outcomes. The paired duel is one Game, not independent recurrence.

## Rebuilds

1. Adding match facts reprojects retained canonical header evidence into a new derived statistics artifact. It does not repair an older canonical team-lock value. Existing source evidence remains immutable.
2. Repairing the known DE/lobby team-lock conflict requires fresh canonical extraction from an available recording. It legitimately affects alliance-sensitive support/cooperation eligibility. Never silently overwrite historical canonical evidence or activate a changed statistics artifact under an old revision.
3. The real-corpus audit now reports a **legacy lobby-lock counterfactual** for the affected source headers, with per-player before/after review metrics. It isolates the known source-normalization error; it is not a comparison against deployed historical artifacts, nor a full historic model migration.
4. No active database pointers, official results, awards, leaderboard values, or relationship states are changed by this review. Deployment/backfill must respect the existing authenticated revision/promotion machinery; the older player-aggregate rebuild command does not regenerate missing canonical match facts.

The audit comparison retains unknown versus zero, preserves input evidence, identifies canonical recording players, and reports its metric scope. Real-corpus regressions and website render/interaction checks cover the review path. Engine outcomes, changing alliance state, relic possession, king responsibility and intentional absence remain unqualified.

## Completed corpus comparison

[The expanded audit](https://github.com/Mathias-ao/League-of-Friends/actions/runs/37110075757) passed all 14 recordings at source commit `952b68d3b4858bf10fb9000a78aac92e7ba4e29d`. Eleven recordings had conflicting legacy false / DE true team-lock flags; five team recordings had differences in the nine reviewed metrics. All differences were unavailable → qualified allied-assistance/cooperative-attack counts (including zero). The other six checked metrics were unchanged. This is not a full historical-model/deployed-artifact comparison.

The preview record now includes the real per-player comparison alongside its audit examples, retaining unknown versus zero and the explicit baseline/scope. No live statistics were promoted.
