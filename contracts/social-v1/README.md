# AOF_SOCIAL_V1_SHARED_1

Shared wire contract for issue [#122](https://github.com/Mathias-ao/League-of-Friends/issues/122), accepted for parameterized, inactive implementation in the [Organiser 2 review](https://github.com/Mathias-ao/League-of-Friends/issues/122#issuecomment-6240004525). The [narrow inference amendment](../../docs/architecture/social-v1-inference-amendment.md) distinguishes the **decided inference-first method** from still-unapproved family predicates, calibration and exceptional privileges. This package performs no scoring, persistence, migrations, feature activation or production publication.

## Canonical representation and validation

- `shared.schema.json`: closed JSON Schema 2020-12, authoritative names, discriminants, required/null fields and constraints. The root is `{contract, recordType, value}`; `$defs` also permit individual record validation. No additional fields, undefined, non-finite numbers, timestamps or caller paths. `Id` is nonempty; `Digest` is lowercase SHA-256. Arrays preserve semantic order.
- `functions/src/domain/socialV1.ts`: generated declarations followed by small pure identity, approval, privacy and invitation-transition guards. Regenerate with `node contracts/social-v1/generate-types.mjs`; `--check` detects drift, including constraint-only schema changes. Declarations express structural types; the schema and guards enforce runtime constraints.
- `replay-tools/social_v1_contract.py`: `validate_record(record_type, value)` applies the same schema plus cross-field invariants. Python/TypeScript guards deliberately share no conduct calculation. Python packaging must include this canonical schema at its repository-relative location; copying only the module is unsupported.
- `fixtures/conformance.json`: representative records, negative mutations, publication cases and Unicode identity vectors. **All fixture policies, quantities and values are synthetic test inputs, never approved scoring defaults.**

Validate schema first, then `assertRecordInvariants` on TypeScript inputs (see the Node test). Python combines these steps. On a publication boundary additionally call `assertPublicationAllowed` / `assert_publication_allowed` with **server-resolved** approvals. Self-asserted `APPROVED` is insufficient: policy version, configuration version and approval reference must all match the trusted registry. Proposed records may be computed privately, including preview slider values, but cannot publish sliders, invitations or official claims. Proposed receipts cannot be `APPLIED` or `CAPPED`, even in previews. Pending amounts are null; no unknown-to-zero conversion. A valid record or matching approval is never proof that its source, referenced evidence or caller is authorized.

## Battle and stable identity

**One league Battle is exactly one authoritative `/matches/{matchId}` document, across all its Games. `battleId` MUST equal that document ID (`matchId`), not a UI title, Game ID, GUID, source hash or Event ID.** `battleIdForMatch` accepts the document ID obtained by the server. `SourceSnapshot`, `BattleFeature`, `ChronicleScene`, `Opportunity` and `InvitationSlot` carry both fields; cross-field validation rejects disagreement. This preserves the existing mapping in `functions/src/queries/socialHistoryRead.ts`, which emits `battleId: match.doc.id` for each Game.

Multi-Game Battles and duplicate POVs contribute **one independent Battle sample**, not one per source/Game. Feature aggregation may combine Games under that Battle; the Personality consumer owns opportunity denominators, coverage and aggregation. A source/result/roster correction changes input/projection revisions, never Battle identity. Event official/helper-warmup admission remains independent of League Points scoring; genuine eligible warmups are not silently excluded. `SourceSnapshot.outcome` is Game-scoped; `ChronicleScene.result` must use authoritative Battle/Match resolution across its Games, or remain unresolved. A single Game winner cannot stand in for a series winner.

Identity helpers hash the UTF-8 bytes of compact JSON arrays (no whitespace, literal Unicode):

| Identity | Array hashed with SHA-256 |
|---|---|
| Invitation slot | `["AOF_SOCIAL_V1_SHARED_1", "INVITATION", battleId, respondentPlayerId]` |
| Chronicle pair scene | `["AOF_SOCIAL_V1_SHARED_1", "SCENE", battleId, ownerPlayerId, counterpartPlayerIdOrNull]` |

Neither includes source, Game, selected incident, question/family, correction, prose or policy version. Their meaning is permanent: any future contract version must reuse/migrate existing slot identities rather than mint another invitation. Ordinary content/reprocessing cannot change the SHARED_1 namespace.

## Durable invitation transaction contract

#128 must store `InvitationSlot` at **`/matches/{matchId}/socialV1InvitationSlots/{slotId}`**, inside the existing Match authority. This is a selection tombstone, not another Event/Relationship history. No production store adapter is added in this shared-contract PR.

`planInvitationOffer(current, opportunity, expectedRevision, trustedApprovals)` is a pure transaction plan. In **one server transaction** read the authoritative Match, current source/incident/roster/policy/fatigue inputs and slot; revalidate respondent eligibility and all revision fences; then create the absent slot, or compare its exact revision before replacing it. Publish the opportunity atomically with the first slot creation. A losing absent-create/CAS retries from fresh state. Never send/display a new invitation for `created:false`; an existing deferred invitation may be resumed. A transport retry redelivers the same durable identity, not a fresh question.

- No slot means no invitation has been offered. The first committed offer consumes it. Reserving/ranking preview candidates does not consume a slot and must not be exposed as a prompt.
- Exact retry returns the existing slot without changing `OFFERED`, `DEFERRED`, `DECLINED` or `SUBMITTED`. A different selected incident, Game, family, source revision or policy cannot consume it again.
- `transitionInvitation` compares both revision and selected opportunity revision. Stale submits/transitions fail. Withdraw stale or superseded evidence and retain the slot as `WITHDRAWN`, with its original selection and incremented revision. Never delete/reset it or issue a replacement invitation.
- Genuine-error judgment correction reopens the **original author's binding submission** under the same slot; it is not a new invitation. Preserve the private audit. Material evidence changes cannot silently retarget a question or carry its answer onto another incident. Rebinding requires verified incident correspondence and the existing correction rules.
- Deferral/decline is optional and has no social penalty. There is no one-question quota: routine 1v1 normally offers none. Ranking/fatigue/cooldowns remain unapproved parameters.

Tests cover multi-Game/source/family replacement, fresh-read contention fencing, retry after defer/decline, withdrawal after submission, stale revision rejection and a permanent correction tombstone. Persistence and authenticated transaction acceptance belong to #128/INT-V1; these guards do not claim to provide storage or authenticate clients.

## Authority, lineage and corrections

`SourceSnapshot` is constructed only after existing server admission: current Game/Match authority, verified active READY artifact, mapping and participant authorization, eligible Event/Season membership and original retention. Native artifacts require their immutable verified generations and GUID claim; nullable generations/GUIDs support already-admitted historical legacy sources, never a native bypass. The snapshot is not a request to trust caller-supplied IDs or hashes. `outcome` independently states official accepted revision/winners or unresolved nulls. READY facts need not await a result, Match or Event closure; effects that require an official result must pend separately.

`authorityRevision` binds current Match/Game authority, source hash and pinned artifact digests/generations, statistics/mapping/Event-admission revisions, GUID claim and outcome revision. Missing/stale referenced versions fail closed. One-to-one roster mapping and winners within the roster are checked; identity remapping changes authority and dependent projections. Do not synthesize GUID equivalence across sources.

Incident ID is neutral durable lineage, not a revision hash. Keep existing source-deed IDs; source replacement requires proven correspondence or reviewed rebind/supersession, never a fuzzy clock/name join. `PENDING` lineage cannot bind judgments or official effects. `SUPERSEDED`/`WITHDRAWN` evidence cannot be resurrected by a retry. Stable identities survive corrections while revisions track exact current inputs.

Inference identity binds incident revision, model/policy/family and evidence digest. Claim identity is incident × directed subject × effect × canonical semantic family; claim revision adds exact evidence/judgment/configuration inputs. `contributionKey` deduplicates correlated episode facets before budgets. Multiple measurements are not multiple deeds. Receipt identity binds projection/claim revision, kind and budget/reciprocity key.

Only INT-V1's future fenced `commitProjection(expectedScopeDigest, projection)` may replace official projections. Its scope includes the **entire ordered current input set**, sources/remaps/results/Event admission, policies/configurations, prior-history digests and judgments. Never increment scores additively on retries. Rebuild affected allocations, reciprocity anchors, weakening/surplus, transitions, peaks, awards and dependent War Room eligibility; retain valid historical evidence/private audit. Unknown/partial chronology blocks only dependent effects; upload time cannot invent order or pre-entry context.

## Meaning, reciprocity and exceptional proof

`Observation` identifies recorded commands/metadata or derived measurements. `Inference` and inferred Claims remain `BOUNDED_INFERENCE`; `PublicClaim` always labels them **Inferred**. Chronicle separates fact refs, inferred claim refs, receipts, public testimony and recognition. Facts about a requested command are not facts about execution. Narrative must retain this distinction; arbitrary prose cannot be mechanically certified by a schema.

Separate strengthening/weakening predicates and budgets are required for each of the six tracks. No inactivity decay, missing-evidence penalty, automatic cross-track conversion or reverse credit. Relationship direction and inference action direction differ explicitly. Stage-3+ ordinary reciprocity needs independently admitted **own actor conduct in each direction**, not victim status, received help, a shared result or copied inference. Judgment reciprocity additionally needs responding-player conduct in the **same linked Battle**. `independentActorRefs` must resolve to that conduct; nonempty references alone do not qualify it. Reciprocity can count under its approved Event cap even when movement is capped.

Strict Treachery is the only exceptional stage authority exposed here. Its proof resolver still requires effective mutual alliance, ordered unilateral rupture, qualified aftermath, confirmed king loss/responsibility, configured association and the actual victim's binding **betrayed** judgment; unanswered/fair-game cannot qualify. It affects victim→responsible Hostility only, consumes configured capacity with existing priority, never fabricates ordinary points or reciprocity. A `STRICT_PROOF` ref is a pointer to validated proof, not a proof certificate.

Special Forward Castle still needs a genuine unique Castle (**not Krepost**), specific enemy-home geometry, operational completion and a same-instance own production queue within five minutes **after completion**. The [existing conservative placement-time sufficient witness](../../docs/architecture/fixed-alignment-military-social-families-v1.md#forward-zones-and-the-adjacent-forward-castle-special-case) remains valid only with qualified unique-instance/operational semantics. Full post-completion coverage without a queue is Not Qualified; unknown completion/binding or incomplete coverage is Pending. The schema creates no alternative witness. Ordinary inferred forward placement remains permissible under its honest label without claiming this accomplishment. No inferred Wonder completion, kill, mined gold, resource receipt or rescue achievement; awards/events need separately approved feasible catalogues. No new stage privileges.

`Judgment` is private binding input with immutable revisions, original incident position, real submission time and impartial genuine-error reopening. `publicJudgment` exports only resolved choices and attribution, with exact **Not Qualified — No Relationship Effect** labels; pending siblings, private notes, meaning refs and audit are excluded. Reopened/superseded statements are withdrawn. Consumers must resolve `publicJudgmentRefs` through this allowlist, never expose raw Judgment records. SOC-089 public correction history remains deferred.

Personality has all five unique automatic axes. Developing values are null; ready values use the existing 0–100 display coordinates. No feature weights, sample minima, normalization anchors or calibration values are supplied. Recognition candidates are eligibility inputs, not additional receipts or automatic awards.

## Consumer ownership and dependencies

| Issue | Owned implementation | Dependency / boundary |
|---|---|---|
| #123 | `functions/src/engines/personalityV1/*`, `web/src/ui/PersonalityProfile.tsx` | Shared contract; context-dependent features consume #124, otherwise remain Developing. |
| #124 | `replay-tools/social_v1_context.py`, own fixtures | Shared contract; reuse Map Presence/Enemy Progress. TERR semantics remain approval-gated. |
| #125 | `socialHistoryRead.ts`, `getPlayerChronicle.ts`, `playerChronicleCore.js` | Shared contract; factual/pagination/book-data seam. No narrative corpus or judgment service edits. |
| #126 | `replay-tools/social_v1_inference.py`, own fixtures | Shared contract; pure parameterized work, #124 for context. No score/store writes. |
| #127 | `functions/src/engines/socialV1History/*`, own fixtures | Shared contract and #126 interface fixtures; pure parameterized evaluator can proceed in parallel. |
| #128 | `commands/chronicleV1/*`, judgment service/selector and isolated contribution UI | #125 factual seam + #126 admitted candidates; must implement the durable slot transaction above. |
| #129–131 | Approved awards, exceptional-moment catalogue and narrative component | Design may proceed; selected feasible catalogues/creative samples need review. #131 alone owns `playerChronicleNarrative.js`. |
| INT-V1 → #132 | Integration lead's separate final wiring PR → independent acceptance | After all selected launch components. Shared router/exports/repository/config/security/book wiring is integrator-owned. |

After this contract merges, #123/#124/#125 and pure #126/#127 may proceed concurrently. Import SHARED_1; do not invent local synonyms or edit another owner's files. Python owns context/inference; TypeScript owns Personality, league authority and historical allocation. No duplicated conduct algorithm or new parser/relationship database. Only #122 changes shared meanings; incompatible changes require a new contract and consumer review. Return exact base/head, interface version, positive/negative/missing-coverage tests, calibration/approval status and requested integration hunks. No production publication until approved packs and integration acceptance; deployment/activation remain separate decisions.

## Reproduction

```sh
npm ci --prefix functions
npm run build --prefix functions
pip install -r replay-tools/requirements.txt
python -m unittest discover -s replay-tools/tests -p test_social_v1_contract.py -v
AOF_SOCIAL_CONFORMANCE_PYTHON=python node --test functions/tests/socialV1Contract.test.mjs
```

Social Contract CI runs exact cross-language parity, generated-type drift detection and positive-fixture TypeScript compilation. Backend and Replay Tools CI also run their respective tests independently.
