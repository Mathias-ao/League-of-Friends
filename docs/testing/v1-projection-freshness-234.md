# AoF V1 — lean projection freshness contract (#234)

**Purpose:** one historical truth with independently governed read models. This describes checks already expected at existing source/read/scoring boundaries; it does **not** authorize a new global status document, fanout coordinator, materialized cache, or live migration.

## Common identity and freshness

Every derived claim must be traceable to the **current** canonical Battle ID and its actual Game ID(s), authorized player/slot mapping, retained active recording hash and revision, and the model/policy that interpreted it. Consumers needing official outcomes must additionally validate the current official Game/Battle result revision and dispute state. Longitudinal consumers must use approved chronological scheduling/source order and independently eligible Battles, not upload arrival time. A multi-Game Battle remains one Battle for Personality and pair Chronicle history.

**A claim is current only when its relevant input fingerprint still matches those current authorities.** Keep source or result Pending when required evidence is missing, rather than accepting a stale projection, inventing a zero or withholding unrelated measurements.

| Consumer | Minimal prerequisite | On replacement or withdrawal |
|---|---|---|
| Game/Season measurements | Current verified Game source, compatible metric/model and metric-specific opportunity | Replace the affected Game observation; preserve other qualified Game measurements and known series slots |
| Record / private PB | Source-qualified individual Game timing or quantity plus official record eligibility and method | Recompute contender/ties from current eligible Games; the **V1 Fast Castle** record uses all eligible maps/starts/formats under one comparable timing model |
| Season Points / Gold | Official current Battle result, frozen Event/scoring rule and any required source-qualified placements | Reconcile only source/result-dependent ledger components and rankings, keeping the same canonical Battle and avoiding duplicate credits |
| Personality | Current player evidence and axis-specific context across sufficient independent Battles | Re-evaluate affected axis history, not neutralize unrelated valid axes |
| Reputation / Relationships | Current independently attributed deeds, prior context, directed pair authority and #139 approved history rules | Replay affected chronological player/pair interpretations from the earliest altered contribution; never convert one track score into another |
| Chronicle | Accepted pair × Battle, source and confirmed result where available, with independently qualified historical callbacks | Preserve one factual scene identity per Battle; change its revision and any later narrative callbacks that genuinely depend on corrected history |
| Honours and War Room | Separately approved rule-specific proof, eligibility and current authorizations | Recompute/suspend only dependent possession or challenge consequences; legacy generic War Room point grants remain paused |

## One small correction regression

`functions/tests/v1-correction-projection-journey.test.mjs` uses a **controlled** three-Battle 2v2 fixture with two allied players and traceable source revisions. The first source holds a projected Castle Age record and contributes a support beat to pair history. A newer source removes that beat and changes the age timing. Assertions:

1. Source revision **2 wins even when revision 1 arrives later**; the record moves to the actual faster remaining Game, not an upload or Battle average.
2. Three accepted canonical pair Battles remain three stable scene IDs; the corrected first chapter becomes factual/ordinary rather than inventing assistance.
3. Later callbacks depending on the removed support update their scene revisions; unrelated factual support survives.
4. Withdrawing the earlier Game/Battle removes only the unqualified input; two other Battles and their record candidate remain. No award or Relationship score is fabricated.

This exercises **Statistics + Chronicle** from one controlled source family. Source-admitted private Personality, #139 social replay, honours and actual league scoring retain their existing independent tests; no claim of a new production joined E2E or genuine original gameplay witness. The current source/browser matrix is #132/#218; real p95 is #143.

## Limits and implementation sequence

- Do not block READY measurements on a pending official winner; do not certify a result-dependent trophy or leaderboard grant from a provisional value.
- Do not activate legacy War Room points; the separate fail-closed reward writer patch #233 addresses the remaining first-positive-award path.
- Reuse existing revision-gated triggers/readers and deterministic composers. If later performance data shows waste, optimize affected-scope rebuilds **without changing historical semantics**, rather than replacing the current correction-safe whole-league baseline.
- Merge only after exact-head tests and independent review, with no staging/deployment/flag/entitlement effect.
