# INT-C2A — source-compatible private candidate preview

Work order [#163](https://github.com/Mathias-ao/League-of-Friends/issues/163), parent #154. Base `b9cdb04f5cfab6cb0a8dbbf5eaf1907c61637d73`. Accepted producer handoff: [#153 comment 6396835788](https://github.com/Mathias-ao/League-of-Friends/issues/153#issuecomment-6396835788). This implements only the inactive adapter; INT-C2B remains separately blocked.

## Source path and versions

`getMyGameplayCandidates({})` reuses INT-C1's authenticated linked player, complete bounded current Battle/Game collection, selected READY POV, original recording/GUID claims, Event/Season/result/roster/mapping and artifact-generation/digest checks. The same final whole-cohort read-only transaction runs **after** worker processing. All source, Game-set and caller changes abort mixed reads; withdrawals, disputes, superseded sources and corrections replace/exclude current evidence, never append old effects.

The new `/social-grade-candidates-preview-v1` worker route decodes retained events once with the existing validator, reuses the unchanged C1 context/neutral descriptors and Pending proposal, and calls unchanged #158 `prepare_social_metric_grade_candidates`. No parser, detector, grade formula, store, ledger or evaluator is added. Neither #158 nor #141/#139 specialist files are edited. Ordinary upload/statistics/results have no new call or wait.

| Contract | Role |
|---|---|
| `AOF_SOCIAL_METRIC_GRADE_CANDIDATES_1` | Unchanged closed #158 producer document; `gameScopeAuthenticated=false`, LIMITED, Pending, null bands/rules/denominator and zero credits/witnesses/receipts |
| `AOF_INT_C2A_WORKER_PREVIEW_1` | Authenticated transport of the producer, unchanged C1 proposal and bounded original clock/actor witnesses; witnesses remain server-only |
| `AOF_INT_C2A_SOURCE_BINDING_1` | Server-issued wrapper: complete current SourceSnapshot, actor/counterpart league mapping, original GUID, Battle/Game, roster/mapping/artifact/result/Event revisions; processor, schema, context, measurement and producer digests; null historical order |
| `AOF_INT_C2A_EPISODE_COMPATIBILITY_1` | Explicit original-membership relation between two key versions; **not** a credit or key replacement |
| `AOF_INT_C2A_PRIVATE_PREVIEW_1` | Owner-only outgoing candidate explanations, source bindings, compatibility and Pending proposal refs; zero historical effects |

The pure producer is never changed to authenticated. Its flag is preserved as `producerGameScopeAuthenticated:false` in the server wrapper; `sourceAuthorityVerified:true` describes separate server admission, not semantic grade qualification. The full producer schema is validated before owner filtering. Returned `candidate` is the unchanged owned episode, not a partial document impersonating the producer's global projection. The wrapper carries the original producer projection revision and its own binding revision.

Schema packaging uses #158's single canonical JSON schema, not a copy maintained by the adapter. Source/roster, raw metric whitelist, exact original facet/event membership, counts, original actors/clocks/ordinals, prior-only refs, counterevidence, model/policy versions and no-promotion restrictions are checked. Unknown versions/metrics, conflicting or missing identities and incomplete coverage fail closed. Prior-only means before each contributing deed's own source window. A transitive group's union may include context after its earliest linked action; the adapter carries `BEFORE_EACH_CONTRIBUTING_DEED_NOT_GROUP_START`, never pre-episode opportunity. STOP/CANCEL is candidate context, not proven cancellation or peaceful intent. Requests do not establish damage, executed help, settled tribute, castle completion, army advantage or human intention.

## Identity reconciliation

1. Recompute and verify the accepted C1 global overlap key from verified original deeds/events/incidents. Keep C1's provisional algorithm and original incident IDs unchanged.
2. Validate #158's separate key, scope and original directional raw-metric membership. It is game-local and has a different definition; it is never renamed to C1's key or inserted into `Claim.contributionKey`.
3. Make **directional slices** of C1 groups. Link nodes from both key spaces only through a shared original event, deed or detector incident, within the same actor→specific counterpart. Take transitive connected components. Multiple producer keys may link to one broader compatibility component. Reverse actors remain independent even if C1's old global key is shared.
4. Retain both key lists, original event/deed/incident IDs, C1 descriptor/incident IDs and Pending canonical proposal references. A new versioned component identity binds Battle, Game, original GUID/source and directional membership. `keySubstitutionAllowed:false` is mandatory. This is conservative provenance compatibility, not a claim that all linked subepisodes are semantically identical or independently creditable.
5. Current binding revisions additionally bind current authority, roster, source/model/method/schema revisions and proposal references. Source replacement, remapping, result correction or model changes produce replacement bindings/digests. No persisted compatibility history or credit is accumulated. The existing current-source/GUID claim defenses reject duplicate POV admission across Games.

#141/#139 receive only the already-accepted C1 **Pending/null/no-witness** proposal. #158's empty Claims/witnesses/credits remain empty. Existing C1 Claim keys stay unchanged; the richer candidates are linked through refs only. #139 remains the sole historical evaluator and must return no projections, receipts or consumption; any nonempty result is rejected. No numerical grade rule is selected, copied or inferred from the test fixture. C1's existing explicitly labelled, unapproved wiring simulation is not promoted or rebalanced. Original recording order is retained; historical chapter order remains null / UNKNOWN, never inferred from upload time.

## Private UI, gates and bounds

New owner-private profile/personal Chronicle presentation is opt-in via `VITE_AOF_INT_C2A_PREVIEW=source-compatible-v1`. It shows raw request measurements, prior-only contextual refs, unqualified opportunity, counterevidence, original source time/GUID, current authority and both key versions. It displays Pending/LIMITED, not stages, sliders, credits, awards or invitations. Auth/owner/mode changes, stale replies and errors clear prior private state. No private response is persisted in browser storage; Chronicle prose and read scene IDs are untouched.

C1's endpoint/version/DTO remain unchanged. The new callable additionally requires `AOF_INT_C2A_PRIVATE_PREVIEW=source-compatible-v1` plus all C1/INT-B private gates. The worker requires separate `AOF_INT_C2A_ENDPOINT=1` plus C1 opt-in, bearer authentication and staging or a demo emulator project. UI and server deny production even with flags. No environment file, cloud flag, IAM, deployment or staging configuration is changed by this PR.

Inherit complete-or-error bounds: 256 Match enumeration / 8 Games / 100-second elapsed guard / 120-second callable, original events 16 MiB compressed /128 MiB decoded /600,000 actions, 1,000 descriptors/groups per Game, existing worker transport cap and 4 MiB complete private response. Add at most 20,000 original context witnesses. No complete-looking prefix is returned. These are technical budgets, not score thresholds or a latency SLA; they do not cancel a stalled SDK call. Large unrelated shared Battle-detail delivery is not transported; original and published statistics are unchanged.

## Acceptance and ownership

| Proof | Required result |
|---|---|
| Python-to-TS synthetic conformance | Real producer output, schema/runtime source admission, no mutation, different keys and explicit linkage; not authentic social positives |
| Forged actor/target/scope/GUID/source/metric, grade/coverage/policy/model/key | Reject; no partial candidates or effects |
| Transitive shared event/deed/incident, reverse direction, repeated Game IDs | One compatible directional component; reverse/Battle/Game identity remains independent; no automatic key substitution |
| Original ordinal missing, upload chronology supplied, future opportunity, no-op/STOP | PARTIAL/Pending or reject; never reconstruct ordinal, order or executed meaning |
| Hash-pinned genuine 1v1 / 2v2 / 4v4 / FFA AUTO uploads | Current source → retained events → unchanged producers → server binding → Pending owner UI; normal statistical/result parity remains verified |
| Two genuine originals in one controlled Battle | Two Game/GUID identities, one Battle; private A/B/outsider, retries, dispute/admin correction, withdrawal, roster remap, post-RPC authority fences and old C1 consumer compatibility |
| Release | All grades Pending, bands null, LIMITED unchanged, no #139 official receipts/projections or credits; no staging/browser/p95 or #132 acceptance claim |

Sol owns adapter-only Python/HTTP plumbing, schema packaging, shared domain/validation/query orchestration, owner UI/repository wiring, tests and this document. Worker 4's producer/schema/policy files, #141/#139, Personality #159, rare selector #160, records #162 and E's composer are unchanged. PR records exact file list, reviewed base/head, actual local tests and exact-head CI; this document does not predeclare green acceptance.

## INT-C2B is not implemented

A distinct future PR needs complete verbatim owner #152 policy approval, method-specific materiality/opportunity/coverage admission, approved significance-band mapping, strengthening/weakening/caps and pre-Treachery decisions, independent chronology authorization and genuinely defensible semantic positive/negative cases. Only then propose corrected historical test effects through #139. Preserve strict Treachery, independently attributable stage-3+ reciprocity and the existing exceptional Forward Castle proof. No C2A result authorizes public scoring, invitations, awards, grants, activation, staging or deployment. #132 remains separate independent final multiuser acceptance.
