# Age of Friends — Three Military Social Families V1 (fixed-alignment adoption)

**Status: V1 design adopted; read-only prototype merged in PR #114, not production-authorized.** 14 October 2026. No activation, scoring numbers, Firebase writes, staged feature flag, or player-facing publication. Preserve the approved Relationship V1 direction/reciprocity/Event rules and the core identity. The provided local module is `AOF_FIXED_ALIGNMENT_MILITARY_FAMILIES_V1_DRAFT`.

The [newer approved Relationship baseline](relationship-v1-approved-baseline-2026-10-13.md) governs interpretation policy. These three military families remain evidence groupings; fixed-alignment V1 does not exhaust the approved Relationship policy.

## The single seam

```
Recorded Events / CanonicalReplay
   -> existing statistics + Pair Social Evidence V1 + Episode Context V1
   -> one deduplicated source-deed ledger, bound to source/Game/Battle identity
   -> THREE SEMANTIC FAMILIES (facts + context, not points)
        A. RAIDS_PRESSURE
        B. CONTEST_COUNTERPLAY
        C. DEFENSIVE_ASSISTANCE
   -> independent track-qualified historical credit receipts
        Reputation (Gallantry/Cruelty/Chivalry) | Relationship (Rivalry/Hostility/Bond)
   -> restrained Chronicle editor, reading OFFICIAL result + actually CREDITED
      receipts / qualified league-visible judgments
```

**One source deed, many facets, independently gated interpretations.** Different detectors observing the same incident do not multiply deeds. A source deed may enter more than one family without granting more than its independently permitted contributions. The Event × pair × track × direction budget and reciprocity evaluator is separate. A credited Reputation effect cannot count as a Relationship effect and vice versa. The Chronicle writer has no scoring authority.

## Scope: fixed-alignment/no-diplomacy

Only fixed allies/opponents *throughout the Game*. The current pair ledger's `FIXED_ALLIES` / `FIXED_OPPONENTS` are source assertions; a server must verify `lockTeams`/format and the current official mapping before trust or publication. Do not infer locked alignment from absence of diplomacy commands. In locked-FFA each participant is an opponent. No exceptional alliance Treachery is evaluated here. Existing approved non-allied directed help can be added with its own independent qualification; no false fixed-ally relationship should be invented.

### Family A: Raids / directed pressure

**Input:** Raid V3 economic-pressure episode and targeted/ownership/context references from Pair Social Evidence; exact attacker→victim and source events. Stronger interpretations require meaningful verified action, not an isolated MOVE/ORDER or detected proximity.

| Interpretation | Required independent conditions | What is forbidden |
| --- | --- | --- |
| A→B Rivalry | Substantive, distinctive pair-specific competitive conduct; fully qualified direction, independence, chronology, eligible Event | Opposition/result/targeted command alone does not score |
| Gallantry(A) | Substantive daring offense; independently verified comparable/stronger opponent *at episode entry* | Aggressive play or future victory alone |
| Cruelty(A) | Substantive punishing conduct; verified sustained opponent disadvantage *already present at entry* | Inferring helplessness from score, APM or future defeat |
| Hostility | **None automatically**; separate distinct meaningful antagonism qualification only when approved and supported | Ordinary raids, aggression and victories automatically becoming grievance |

Multiple commands in one continuous pressure episode count as one deed; genuinely independent repeated episodes can be distinct, subject to Event allowances. Subsequent outcomes may enrich significance but cannot retroactively change pre-episode circumstances or create a second deed.

### Family B: Contest / counterplay

**Input:** Pair-specific Skirmish/Engagement V4 evidence, targeted command facets, exact source events; `PRESSURE_RESPONSE` and `RETURN_PRESSURE` are contextual links only.

- Source-local `LOCAL_COMMAND_OVERLAP` = context, **not** a directed contest or reciprocity.
- `TARGETED_COMMAND` = directional competitive *candidate*. Independent action semantics and substantive conduct still required. A targeted ORDER need not be a weapon attack.
- A defender's timely control/response = context, **not** B→A Rivalry by itself. Substantive resistance must be independently qualified from attributed conduct. Actual counterattack is not mandatory.
- `RETURN_PRESSURE` = two genuinely independent, fully ordered opposite-direction episodes; never automatic proof of revenge, reciprocity credit or victory.
- A multi-player technical Engagement "battle" may contain several directed pair actions; mere shared membership never allocates all-to-all Rivalry. Exact common-target participation alone never creates Bond.

This is the principal V1 path for Rivalry. Bidirectional credits and ordinary level 3+ reciprocity must still be verified at the historical evaluator and Event scope, not here.

### Family C: Defensive assistance / reinforcement

**Input:** Engagement V4 helper→recipient defensive-participation/reinforcement evidence, Fixed Allies relation, optional exact `DEFENSIVE_SUPPORT_WITH_PRESSURE` link to third-party attacker pressure in the same source clash.

| Interpretation | Requirements | What is forbidden |
| --- | --- | --- |
| A→B Bond | Source-proven substantive *directed* assistance toward actual beneficiary B; qualified fixed alignment in this slice | Teammates merely being together, giving proximity orders, or attacking a common opponent |
| Chivalry(A) | Qualified assistance plus noteworthy protection/support or independently verified defensive threat/materiality | Every allied action creating reputation |
| Potential A→B Hostility cooling | Separately qualified help by A toward B against A's *already qualified* historical Hostility | Automatically cooling B→A, or cooling due to receipt of assistance |
| Reciprocal Bond B→A | Independently sourced directed support from B in its own qualified episode | Received assistance transformed into returned assistance |

One defense can contain assistance and pressure context without creating bonus deeds from the same command set. An unsuccessful but substantive protection may still qualify. Source commands do not independently prove a rescue, prevented losses or completed delivery.

## Source/qualification/credit separation

The local adapter emits `deeds[]` (family-tagged views sharing a source `episodeId`) and `candidateClaims[]` (one per source episode × track × direction, merged across overlapping source facets). Each claim has required independent qualifications, full refs and `PENDING_QUALIFICATION` or `SOURCE_BLOCKED` status. **Missing cross-Battle history order is recorded separately as a `historyEvaluationBlocker`**, so it does not erase valid Game-specific evidence while still forbidding premature credited history. No candidate becomes `QUALIFIED` or receives points/stages here. The production qualifier is a separately versioned actor verifying rules, source relevance, context, meaningfulness and genuine distinctness. The historical evaluator subsequently applies approved track-specific strengthening/weakening/Event budgets/reciprocity, emitting audit-linked **credit receipts**. The Chronicle accepts credits, never raw candidates.

The server is the source of truth for active source revision, official Battle results, replay identity binding (including guests/AI), allowed Event Battle (including non-scoring warmups), complete historical order, access, privacy, and current historical rules. This pure module cannot authenticate those claims.

### Chronicle: one short result is the rule, not an exception

1. A qualified official Battle outcome provides *one concise sentence per counterpart per Battle*: e.g. “Alice defeated Bob on Lombardia.” Team results name sides; teammates are never said to defeat each other. FFA wording must distinguish individual placements and opponent elimination from a mere overall Game win.
2. **No actual credited Reputation/Relationship movement, stage turn or qualified league-visible acknowledgment → no extra highlighted prose**, even after many candidate raids.
3. Actual credited progression **can** add one short source-anchored highlight, even when stages do not change. A first meaningful reciprocity, stage change or qualified acknowledgment has editorial priority. Other credited effects are retained invisibly for audit/detail; not repeated as several long Battle entries. A player-owned Reputation credit is featured only in **that player’s** personal Chronicle, not indiscriminately copied to the counterpart’s page.
4. A meaningful source event that is capped and therefore produces no credited movement is still kept in the underlying Battle record, not exaggerated into a Chronicle progression. The user has explicitly chosen this strict V1 policy; optional future special historic exceptions need separate approval.
5. The editor never asks a question by observing statistics; rare questions belong to the separate private Chronicle Judgment service, and only qualified, league-visible answers may become highlights. Optional free text never scores.
6. Narrative copy must be accurate to its supporting evidence: no inferred rescue, emotion, causality, guilt, real-world moral judgment, or heroic victory based on commands alone.

The draft editor implements one preview result line plus **at most one short featured social highlight per directed pair/Battle** (not a hard-coded future limit on historical facts). Selection preference: Relationship stage turn, qualified public acknowledgment, ordinary Relationship credited movement, Reputation credited movement. This is an independently versioned editorial policy, not a track-progression setting.

## Forward zones and the adjacent Forward Castle special case

Out of the three-family qualification implementation for now, but preserved as a precise V1 prerequisite for a future positional-pressure facet:

- Reuse Map Presence V4's home/midMap/forward enemy-progress geometry, derived from the initial TCs. The current statistical `forward` minimum is 65% Enemy Progress; do **not** introduce a rival spatial map.
- A special **Forward Castle** must be a genuine Castle placed in the enemy-side zone and close enough to the **specific** opponent's starting TC/home-base area to establish direct home pressure, not simply a forward structure relative to *any* opposing player. The intended home-base distance criterion remains to be defined under the established zone geometry, not guessed.
- Beyond placement, independently verify that this **unique Castle instance** became operational, then **its own** production-queue command occurred within **five minutes of operational completion**. The observed queue is evidence of operational use, not unit creation or damage.
- With verified complete queue coverage for the full five-minute post-completion window and no queue from this instance: **does not qualify**. With missing completion time, incomplete coverage, ambiguous building instance or impossible structure→queue binding: **PENDING**, not qualified or falsely rejected.
- Queue occurring within five minutes *of placement* is a conservative sufficient time witness if unique instance and genuine operational source semantics are qualified. Late queue after placement alone cannot disqualify; completion could have occurred later.
- A qualified Castle may enrich the same pressure/contest deed. It does not automatically create a second ordinary contribution.

Current statistics lack a generally qualified Castle-completion→unique-building-origin queue chain. Do not activate this special case by heuristically pairing a Castle with nearby player-wide queue counts.

## Stability and corrections

`sourceDeedId` is original neutral provenance, `episodeId` is **currently revision-scoped** in the earlier local ledger, and `claimId` is tied to that version. They are not guaranteed permanent incident identities across official revisions. Production needs **durable incident lineage** distinct from revisioned claim/credit/editor IDs. Old corrected/retracted claims and featured highlights must be superseded, never double-counted. Binding player judgments require the already-approved correction and visibility semantics.

The earlier review also found that the pre-existing bridge does not independently cross-check every referenced source event's timestamp against the deed interval. This remains a **blocking validation gap** for production authority. The new layer assumes the earlier source contract and marks its own authority as false. Real canonical and Recorded Events corpus audits, exact source bounds, active-league-context verification, and authenticated server-side evaluation remain necessary.

## Tested draft behavior

- Same raid and targeted-command facets share a single underlying deed; separate track claims are merged by source episode / track / direction.
- Ordinary pressure has Rivalry/Gallantry/Cruelty **candidates** but never automatic Hostility/score.
- Mere overlap and common target do not confer reciprocity or Bond.
- Recorded response alone is not independent defensive Rivalry.
- Fixed-allied support is one-way; Chivalry requires more than a reinforcement command.
- Missing Event eligibility, qualified relation or deed independence blocks the relevant source claim; missing cross-Battle order keeps the source candidate available but blocks historical credit.
- Canonical/Recorded Events envelope compatibility; input immutability and deterministic repeatability.
- No raw candidate can expand a Chronicle entry. Only distinct source-linked asserted receipts; private and stale acknowledgment receipts excluded. Duplicate credit retries are deduplicated.
- Short factual duels/teams/allied outcomes, with at most one short highlight in the draft.

**This is a validated local contract—not source-verification, calibrated scoring, official result authentication, full-repository CI, production UI, staging, merge or deployment.**