# Age of Friends — Statistics ↔ Reputation / Relationship / Chronicle V1 bridge

**Status: merged inactive read-only prototype (PR #114), not player-facing integration.** Audited against GitHub `main` at `ea417d7ad09a57cbb4eec2dda262fbe80a3c29c3` and the approved design baseline in draft documentation PR #113 (14 October 2026). The old production scorer / Reputation engine / War Room / Chronicle are unchanged.

For the current approved social policy, use [Relationship V1 approved baseline](relationship-v1-approved-baseline-2026-10-13.md), including SOC-058–088 and the EVID/CAL decisions. The three military families are evidence families, not the complete Relationship policy. Ordinary native upload does not authenticate or activate this prototype.

## Purpose

Use **one versioned, verifiable statistical deed** as a common historical source for three **independent interpretation systems**, without counting source commands three times or allowing one system's conclusions to masquerade as another's:

```text
Canonical or Recorded Events V1 statistics (already projected by replay-tools)
    ├── matchFacts + source identity + player roster
    ├── pairSocialEvidence V1 (distinct source deed/incident/observations)
    └── pairSocialEvidence.episodeContext V1 (optional additive context)
                       │
                       ▼
     statistics_social_bridge.py  [pure; no files/network/DB writes]
                       │
            league_context assertion from future authenticated server
                       │
                       ▼
      directional_episode_ledger.py  [one deed → one episode]
                       │
      ┌────────────────┼──────────────────┐
      ▼                ▼                  ▼
Reputation review   Relationship review   Chronicle factual archive
Gallantry /         independent direction  revision-linked, neutral;
Cruelty /           Rivalry / Hostility /  may link private opportunity
Chivalry candidates Bond; no stages        and editorial story preview
      │                │                  │
      └────────────────┴──────────────────┘
               **NO SCORES, AWARDS, SUBMISSIONS OR PUBLISHING**
```

`project_statistics_social_chapter(statistics=...,league_context=...)` is the **Game-local boundary**. `project_statistics_social_history(chapters=...,reviewed_cases=...,reviewed_moments=...)` is the **current-revision, multi-Game** view. Both are pure, deterministic projections.

## Input contracts and authority separation

Source-compatible inputs from `replay-tools/statistics_projector.py`:

- `statisticsProjectionVersion`: `AOF_CANONICAL_STATISTICS_V1` or `AOF_RECORDED_EVENTS_STATISTICS_V1`.
- `source`: replay hash and canonical manifest revision **or** Recorded Events revision and parser ID, plus extraction run identity.
- `matchFacts`: `AOF_RECORDING_MATCH_FACTS_V1`, matching source revision and exact replay roster. Its decoded victory claims **do not** become an official result.
- `pairSocialEvidence`: `AOF_PAIR_SOCIAL_EVIDENCE_V1`, matching source, positive command episodes, evidence IDs, time and order. Optional `episodeContext` must match its immutable source revision.
- Explicit `league_context`: Match, Battle, Game, Event/Season identities, chapter/result/mapping revision, Game number, optional Battle order, source-linked Event eligibility and exact replay-to-league player bindings.

The bridge cross-checks source type, SHA-256 shapes, version, extraction run when supplied, source revision agreement, roster agreement, and deed clocks against the observed recording duration. Contradictions **raise**. An incomplete league mapping drops only the affected dyad and exposes an excluded count. **Crucial limit:** these checks cannot prove that the provided Firestore Game, source mapping, result, eligibility or Event order is authoritative; a server must do so.

The caller supplies **all** current Game snapshots (not just ones producing scores). Genuine eligible non-scoring warmups are not filtered by `affectsLifetimeStats` or `affectsSeasonStats`.

## Output channels: distinct meanings, common provenance

Each review item carries Match/Battle/Game/Event, Game sequence and historical Battle-order assertion, current chapter/result/mapping revision, original replay source identity, deed and incident IDs, and exact source Event IDs. IDs are deterministic and change when their source-bound episode changes. Chronicle facts reference both review queues by stable IDs.

### Reputation review

- Directed pressure → **Cruelty context review only**, blocked from any honor/points until meaningful, punishing conduct and independently established disadvantage **at episode entry** are proven.
- Targeted-command candidate → **Gallantry context review only**, blocked until attack semantics, meaningful effort and comparable/stronger opponent at entry are proven. This is not valor from pressing ORDER.
- Directed defensive/reinforcement participation → **Chivalry context review only**, blocked until actual directed materiality and beneficiary context are proven.

These are *questions for evidence qualification*, not `ReputationDeed` values suitable for `reputationEngine.ts`. No score, unit, moral characterization or source-derived motive is emitted. Shared targets, overlap and mere teammate membership create none of these reviews.

### Relationship review

- Evidence that is genuinely actor→recipient can feed **independent Rivalry or Bond consideration**, never an automatic effect.
- The same deed's pressure + targeted facet collapses to **one review per episode × direction × track**, retaining all source facets.
- Opposite-direction action is separately represented only when separately evidenced. No reciprocal credit, stage, Hostility, cooling, Bond weakening, Dormancy, Event allocation or exceptional Treachery is produced.
- Meaningfulness, episode independence, objective antagonism, defensive-counterplay semantics, Event allowance, higher-stage reciprocity and all numerical rules remain for a future qualified evaluator.

### Chronicle archive and rare prompts

- One **factual archival anchor** per source episode with links to both review queues. No feelings, character judgments, final Battle result, causal outcome or unsourced prose.
- The existing local Chronicle Opportunity/Moment Design layer consumes **current selected ledgers only**. Strict four-family gates survive; nine newer themes remain **explicit reviewer/editorial concepts**. It can produce narration-only designs without questions.
- The local interaction draft can consume the returned `chronicleOpportunityDesign` via `project_private_chronicle_interaction`; it remains unauthenticated **simulation only**, never a binding player response.

## Corrections, chronology, idempotence

`project_statistics_social_history` first selects the highest `chapterRevision` for every Match/Game, then projects only that current accepted source. A higher **withdrawn tombstone** (`accepted:false`, `leagueContext` containing Match/Game and revision, no statistics) excludes the Game without requiring retired replay data. Exact duplicate revisions are idempotent; contradictory copies or acceptance states at the same revision fail closed. Superseded corrupt sources do not poison the selected current view.

Chapter order is **asserted** via Battle order and Game sequence, then Game-local `atMs` + `operationOrdinal`; input order and Firestore arrival time cannot silently substitute. Missing/duplicate order is recorded under `coverage.blockingReasons`. None of this authenticates the historical sequence from the league ledger: `historyOrderAuthenticated:false` and each archival anchor `historicalOrderVerifiedByBridge:false`. Public historical stages are not computed.

Chronicle review cases bound to retired source/mapping revision cannot relabel corrected Game facts. Statistics from a lost or withheld Game are not treated as proof of peace, silence or failed help. Neither absence nor non-contact is qualified.

## Known current application paths and why they are not called

| Existing code | Reality on audited main | Boundary |
|---|---|---|
| `replay-tools/statistics_projector.py` | Produces Pair Social Evidence and episode context | Bridge consumes this output; no detector change |
| `functions/src/engines/reputationEngine.ts` | Rule-driven Reputation points from typed `ReputationDeed` and numeric rules | **Do not manufacture** points/units; no call |
| `functions/src/engines/relationshipEngine.ts` | V2 paired-stage pulse model, not approved independent directional V1 stages | **Do not emit V2 scoring signals** |
| `functions/src/commands/processing/processRivalries.ts` | Rebuilds Firestore pair history from score-eligible Match results, with unavailable coverage and `signals:[]` | **Leave authoritative processing and writes untouched** |
| `functions/src/engines/socialIncidentCore.js` | Old shadow social interpretation has illustrative unapproved budgets/duel Rivalry/Treachery handling | **Do not import these values or conclusions** |
| `functions/src/queries/socialHistoryRead.ts`, `playerChronicleCore.js` | Read-only owner Chronicle currently fed by shadow chapters | New bridge is an offline parallel DTO; not a plug-in replacement for the old response schema |
| War Room | Older challenge qualification and point accounting | Zero direct/indirect writes |

## Next integration seam (requires separate review before exposure)

1. Add an **authenticated server-owned source selector** to the active read path. Use current READY source and immutable generation/SHA, official Game result+dispute/revision, league mapping, eligible Event rules and genuine Battle/Game chronological identity; re-check selected tokens after reads and fail on correction races. Reuse existing `socialHistoryRead.ts` read-consistency work where suitable, but do not assume its completion-timestamp ordering proves original Battle historical order.
2. Decide **transport/runtime placement** deliberately. Python is already used by offline statistics projection; Cloud Functions are TypeScript. The safe options are a versioned compact **source-projection artifact** produced by the replay worker then authenticated by the server, or a TypeScript parity implementation with the same fixtures. Never try to import the Python module into a TS Cloud Function as though it were native.
3. Expose a private read-only Chronicle **factual DTO** only after authentication and privacy review; do not reuse legacy shadow scores or treat this `chronicleFacts` shape as an existing `PlayerChronicleBookPage` contract. Explicitly authorize any UI/Cloud Function change.
4. Independently design source-qualified Reputation deeds and a **new directional Relationship V1 evaluator**, with approved numeric rules and Event / corrections; no automatic conversion from these review rows to authoritative scores.
5. Add true recorded-game fixtures from both canonical and native statistics pipelines, source-correction/rebinding tests, multi-Game/Event chronology, opponent/FFA/diplomacy coverage tests, security/emulator checks, and production rollback review before enabling any feature. **These are not yet run.**

## Regression coverage

Local focused suite includes the previous ledger / rare Chronicle candidates / story catalog / interaction draft plus the new statistics bridge: source/roster/revision mismatch, native/canonical separation, one-episode multi-facet dedup, directional assistance and independent Reputation review, no false reciprocal aid/hostility/treachery, reviewer-only context, qualified vs missing chronology, non-scoring warmups, tombstones and corrections, private Chronicle draft flow, narration-only review and idempotence. **106 tests pass** in the packaged isolated Python test environment. These are controlled tests, not full repository CI, real-replay acceptance or live-system E2E.

**Contract invariant:** one immutable source deed can support multiple independently reviewed claims, but no claim is qualified merely because another subsystem reviewed the same source deed.