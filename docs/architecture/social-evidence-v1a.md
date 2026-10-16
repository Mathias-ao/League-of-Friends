# Social Evidence V1a — authenticated read-only seam

16 October 2026. PR [#120](https://github.com/Mathias-ao/League-of-Friends/pull/120), implementation `3fe64f532e38dcfc09c90164067cbce641f24f0d` (tree-identical to local `0d4b535`). Implemented on `feat/social-evidence-v1a`, based on verified main
`4798d358d5f40715198f03a874c153d2c06a72e3` (PR #119 merged). This document narrows
the [statistics bridge](statistics-social-bridge-v1.md) and [three-family design](fixed-alignment-military-social-families-v1.md)
to read-only evidence. The [approved Relationship baseline](relationship-v1-approved-baseline-2026-10-13.md)
remains product policy; no calibration or policy decision is reopened.

## Minimal interface and execution

`getSocialEvidenceV1a({matchId, gameId, cursor?})` is an authenticated league-only
callable. A cursor contains an opaque `authorityRevision` and `offset`; it cannot
supply league context, mappings, paths, results, dates or qualification assertions.
Both `AOF_SOCIAL_EVIDENCE_V1A_READS=1` and the existing worker's separately authenticated
`AOF_SOCIAL_EVIDENCE_V1A_ENDPOINT=1` are required. Native reads also retain their
existing reader gate. Defaults stay off; this work authorizes no deployment.

The thin Functions adapter reads current Match/Game, Event/Season, participants,
auth link, active source and native GUID claim. It verifies roster bijection and
the selected source/statistics revision. Existing native readers verify pinned
generation/digests; legacy compatibility uses the existing statistics digest decoder.
Published original retention/publication safeguards remain authoritative; the
read does not reparse recordings or regenerate statistics. A final read transaction
checks all authority documents again, including Event, mapping and access, before
returning. That transaction is the read's consistency point; later corrections
require a fresh read. Stale cursors fail rather than returning mixed revisions.

Only source, match facts, participants and Pair Social Evidence are sent to a new
optional route on the **existing worker**. It calls the existing preview validator,
statistics bridge, directional ledger and military-family projector. It adds no
detectors, statistics formulas, database, stored artifact, trigger or upload step.
Legacy full statistics must still be decoded on the server; native reads retain
compressed shared evidence. Derivation happens only on demand.

`AOF_SOCIAL_EVIDENCE_V1A` returns:

- `authorityRevision`, active-source provenance (source/statistics/mapping/result/Event revisions), and `state`.
- A neutral `history` header: authoritative Battle/Game/Event/Season identifiers,
  official outcome or real unresolved state, observed recording duration when
  available, and independent factual-history eligibility. No new Chronicle prose
  or publication; disputed results never supply a winner.
- At most 20 `deeds` per page, preserving existing source deed/episode/incident/event
  IDs, exact recording clocks, mapped actors, family facets and context links.
  Response budget is 1 MiB; oversized evidence fails explicitly rather than silently truncating facts.
- A deed-level `deedQualification`, separate system/track `claims`, and reason codes.
  Reputation uses `actorLeaguePlayerId`/`counterpartLeaguePlayerId`, with no stage
  direction. Relationships retain independent `from`/`to` attribution.

One source deed stays one DTO with multiple facets and independently identified
claims. No matching across recordings by similar actors, clocks or family tags.
Source replacements/rebindings change the authority token and episode identity;
old artifacts and previously returned provenance remain traceable, not current.
Withdrawn/missing/disputed sources return no current deeds. Missing cross-Battle
chronology is explicitly unknown and never date-sorted; it does not erase verified
Game-local evidence. Registered league guests/helpers need no scoring slot or
Season enrollment. Unknown roster identities, ambiguous mappings and AI evidence
cannot become player social candidates.

## Trust states and V1b dependencies

The Python bridge now permits `resultRevision=null` only with explicit
`officialOutcomeQualification=UNRESOLVED`; it never substitutes a result revision.
The Functions boundary authenticates that state from the existing result reader.

`VERIFIED` source structure means reference existence, source scope, participant
attribution, incident lineage and bounded recording clocks. It does **not** prove
meaningful damage, intent, rescue, competitive significance or independently
substantive conduct. Every deed and claim currently returns `PENDING`, with
`SUBSTANTIVE_CONDUCT_NOT_EXECUTABLE` plus the existing track requirements. There
are zero qualified social progression claims, awards or credited highlights.

V1b needs independently executable proof for substantive pair-specific competition,
offensive action semantics, daring/punishing conduct, relative strength or sustained
disadvantage at episode entry, and material directed assistance/protection. These
are approved qualitative requirements, not an invitation to invent thresholds.
The initial fixed-alignment family model is a prototype boundary: directed FFA
assistance and independently evidenced defender actions remain representable and
pending (`DYNAMIC_OR_INDEPENDENT_DIRECTION_QUALIFICATION_PENDING`). Fixed allies
are not a universal future Bond rule. A pressure-response link alone supplies no
reverse conduct or reciprocity credit.

Further dependencies are authenticated historical order where a future predicate
requires it and an explicit reviewed lineage mechanism if cross-source continuity
is ever needed. Neither is required to expose these Game-local facts. There is no
new judgment authority, social progression, Event allocation, Gold, War Room or
Chronicle highlight integration in V1a.

## Acceptance and handover

`replay-tools/tests/test_social_evidence_v1a.py` distinguishes structural fact
checks from pending-policy checks: invalid references/clocks, overlapping facets,
distinct source identities, unresolved results, independent directions, non-scoring
context, empty factual history, idempotency and the disabled/authenticated worker gate.

`functions/tests/social-evidence-v1a-emulator.mjs` runs inside the existing genuine
ordinary-upload emulator matrix. It calls the authenticated callable for native
1v1/2v2/4v4/FFA, checks independently recorded attribution, pending/official results,
membership and helper eligibility, rejected unknown/duplicate mappings and AI,
disputes, retained-source withdrawal/supersession, stale cursors and source/mapping/
Event/access races. Authentic 1v1 canonical export uses the existing parser/projector
and compares all returned local fact/candidate semantics with native, excluding
source-specific identities. The alternate canonical fixture is emulator seeding,
not a new production migration path. Existing upload/correction/rollback tests
remain required; V1a tests current-authority filtering after their state changes.

These are handler + real worker + Firestore/Storage emulator tests, not browser,
live cloud, deployed security-rules or substantive-social-qualification acceptance.
[Local acceptance report](../testing/benchmarks/social-evidence-v1a/acceptance.json): 376 backend tests; 467 Python tests with 13 opt-in skips; all four authentic emulator cases and canonical/native 1v1 parity passed. Exact-head CI links/status are recorded in PR #120; pending CI is not a pass.
Next bounded task: independently review V1a's source/authority and privacy boundary;
keep rollout off. Implement a V1b predicate only when its existing retained evidence
can independently prove every applicable approved requirement.
