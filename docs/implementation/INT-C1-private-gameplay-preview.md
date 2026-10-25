# INT-C1 — authenticated, Pending gameplay preview

Follow-up: [INT-C2A source-compatible preview](INT-C2A-source-compatible-preview.md) adds a separately gated DTO and identity links to accepted #158 without changing this C1 wire contract.

Work order [#154](https://github.com/Mathias-ao/League-of-Friends/issues/154), parent #122; base `e453d40c147ad488f3bfd369e54eba82b29c43b5`. This is the inert C1 slice, not INT-C2 or #132 acceptance.

## Implemented route and ownership

`getMyGameplayPreview({})` → accepted INT-B complete Battle/Game collection → INT-A current READY, participant, GUID, mapping, Event/Season, result and immutable artifact admission → pinned retained events → authenticated worker `/social-grade-preview-v1` → existing retained-stream validator → Worker 1 Context V2 → Worker 4 #149 neutral descriptors and #141 qualifier → canonical Pending Inference/Claim admission → **#139 sole historical evaluator** → owner-only profile/personal Chronicle leaf preview.

Sol owns the adapters, transport validation, current cohort fences and private UI. No specialist parser/detector, grade formula, historical engine or E storylet composer is changed. Calls are on demand, separate from ordinary upload-to-READY; there are no background scans, writes, new collections or persisted browser responses. INT-A's public response and INT-B's wire contract are preserved.

Worker 4 coordination is [#153 comment 6395788399](https://github.com/Mathias-ao/League-of-Friends/issues/153#issuecomment-6395788399). **Their final grade contract is not yet accepted.** The version below is a deliberately Pending transport envelope; it is not a SHARED_1 schema amendment or approval of a grade method. An incompatible future version fails closed and needs an adapter review.

## Pending transport freeze

`AOF_INT_C1_PENDING_GRADE_ENVELOPE_1`, TypeScript `PendingGrade` in `functions/src/domain/gameplayPreview.ts`, produced by `replay-tools/int_c1_preview.py`:

| Fields | Meaning / admission |
|---|---|
| sourceAuthority, sourceContextRevision | Exact server-admitted SourceSnapshot and Context V2 revision |
| sourceDeedId, incidentId, contributionGroupId, candidateId | Original deed; deterministic source-anchored lineage; neutral overlap group; existing #149 observation identity |
| actor/counterpartPlayerId and ReplaySlot | Original command actor/target, mapped using the current authoritative roster; never names, uploaded POV identity or client aliases |
| metricId, measurementMethodVersion | Only #149's four existing directional command descriptor kinds and `AOF_SOCIAL_SOURCE_EPISODE_COMMANDS_1` |
| raw.value/unit/opportunity | Original recorded command-request count; `RECORDED_COMMAND_REQUESTS`; opportunity **null** |
| window, firstSourceMoment, sourceEventIds | Original replay time/operation ordinal, preserving PARTIAL order; exact retained source refs |
| meaning, coverage | `OBSERVED_COMMANDS_AND_INFERRED_PAIR_ATTRIBUTION`, **LIMITED**; execution, damage, received tribute and social meaning are not established |
| grade | status **PENDING**; methodVersion/ruleVersion/bandId **null**; missing owner matrix and grade method, execution unproven |
| counterevidenceRefs, missing | No invented counterevidence; explicit missing admitted opportunity, owner metric matrix and approved method |

The raw count is a descriptor, not a contextual grade. No proposed numeric grade is manufactured. #141 receives no admitted semantic measurements; C1 additionally down-gates **every** Inference/Claim to Pending/null significance and removes all reciprocal witnesses. TS runtime validation checks SHARED_1 records, exact current source/actor/target/facet event refs, policy digest, method version, processor revision and the Pending restrictions before #139 sees anything.

The worker receives a lossless top-level allowlist from verified statistics: source, scope, statisticsProjectionVersion, matchFacts, pairSocialEvidence and complete participants. These are all inputs read by Context/#149/#141. Large unrelated sharedEpisodeDelivery and other website read models are not transported or expanded. Original retained statistics and published statistical output are untouched.

The explicit `UNAPPROVED_TEST_ONLY` fixture `int_c1_wiring_test.json` reuses existing #139/#141 test numbers solely to satisfy their mandatory configuration contracts. They are neither new balancing values nor product defaults. The private response labels this simulation and its hash. All Claims are Pending before evaluation, so #139 returns **no projections, receipts or consumption**; a nonempty result is rejected. There are no fabricated stage-zero tracks, six-track values, sliders, reciprocal credits or awards.

## Identity, corrections and bounds

- Stable Battle = authoritative Match ID; multiple Game identities share it. Current pointer selects one source/POV per Game. Duplicate original/GUID across Games is rejected by existing admission, never counted as another independent Battle.
- Original deed IDs, source hash and Game GUID anchor incident identity. Deeds sharing an original event **or detector incident** form one conservative contribution group (transitively); no temporal/name proximity formula. Raid/pressure/contact facets retain explanations, not separate credits. Independent-source substitutions cannot reuse a group blindly. Future grading/caps remain Worker 4/#139 responsibilities.
- C1 rebuilds from the complete current cohort on every request. Source/result/mapping revisions change authority and digest; withdrawn/superseded/disputed evidence is excluded or Pending. A final read-only transaction fences the entire enumeration and access **after** worker RPCs, catching insertions, pending-source activation and correction races. No old effects are appended or reactivated.
- Original replay moment is retained, but no league chronology is invented from upload time. Historical chapter order is null, `leagueOrderKey:null/order:UNKNOWN`; progression remains Pending until authoritative order is admitted.
- Owner-only Reputation and outgoing Relationship candidates are returned; other players' private drafts never are. No player judgments, chat, source names, replay payloads, Storage paths or credentials enter the response/UI. Owner/auth changes, stale requests and errors clear prior UI output. Chronicle prose and seen scene IDs are untouched.
- Inherit INT-B's complete enumeration limit of 256 Matches, with C1's stricter **8 Game** budget, 100-second elapsed guard / 120-second callable. Each events artifact is at most 16 MiB compressed / 128 MiB decoded, 600,000 actions; each Game at most 1,000 descriptors / 10,000 Pending Claims; request 40 MiB / private response 4 MiB. Limits are technical caps, not scoring thresholds. Exceeding any bound errors; no complete-looking prefix. A stalled RPC is still subject to the callable deadline, not a promised latency SLA.

## Default OFF

Backend requires existing private read/history gates and `AOF_INT_C1_PRIVATE_PREVIEW=wiring-test-v1`; worker additionally requires bearer authentication, `AOF_INT_C1_ENDPOINT=1` and staging or a demo emulator project. Client requires `VITE_AOF_INT_C1_PREVIEW=wiring-test-v1` and staging/demo emulator. Production is denied even with flags. No env file, live configuration, deployment or cloud resource changes are included. Existing authenticated HTTPS/IAM worker transport is reused; expected native processor revision must match the actual worker revision.

## Acceptance matrix

| Case | Evidence / expected behavior |
|---|---|
| Genuine 1v1 / 2v2 / 4v4 / FFA | Existing ordinary-upload emulator workflow: pinned corpus `2d04ec6adbe871d156c108a4351448efeb08f4e6`; real AUTO upload, current READY and retained stream through existing context/producer/qualifier, canonical TS admission, #139 Pending audit, private jsdom render. FFA is not treated as fixed teams or automatic Hostility. |
| Two genuine Games, one Battle | Existing INT-B emulator: distinct hash-pinned deak/dobb originals, actual shared recorder and explicit isolated opponent alias; never asserted to be a real historical League series. Stable one-Battle identity, two source GUIDs, repeat-read equality. |
| Auth A/B/outsider and forged request | Actual callable authorization using active emulator links; no client player/source/grade/policy/cursor; each owner gets their own outgoing candidates; outsider gets none; unauthenticated rejected. |
| Dispute/admin correction, withdrawal, remap | Existing authoritative dispute/admin result path plus isolated withdrawal/remap fault injection: current digest/authority replaced, no stale candidates or receipts; restore only inside isolated fixtures. |
| Mixed read / malicious response | Event/access/Game/source races after artifact/worker work abort; hash/generation/processor/source mismatches and forged non-Pending output rejected. |
| Duplicate POV / correlated indicators | Existing ordinary retry and GUID admission protections; deterministic overlap unit tests unite shared event or detector-incident refs, preserve independent originals. Nothing is credited. |
| Missing method/order/opportunity | Explicit Pending, null band/opportunity and no movement. Real descriptors establish command provenance, **not six authentic positive social qualifications**. |
| Caps, directionality, anti-farming, reciprocity | Reuse #139's existing backend tests for Battle/Event caps, duplicate consumption, independent-direction stage-3+ denial, Treachery floor/corrections. C1 cannot exercise positive allocations because it admits no Claim. |
| Privacy and UI lifecycle | Default-off/prod-denial tests, actual source revision render, owner/auth switch/stale/failure tests, no ranges/stages or private replay fields. |

CI results and exact reviewed SHA belong in the PR/issue ledger; this document does not predeclare them successful. jsdom is an interface witness, not a real staging browser pilot or #143 p95 claim.

## INT-C2 — distinct proposed next PR, not implemented

Dependencies: independently accepted #153 methods/DTO and genuine positive/negative/blocked evidence; owner-approved complete #152 metric-grade/coverage/opportunity/weakening/anti-farming and significance-band mapping; admitted historical order. Accept only specific approved method/rule versions, remove the test-only fixture from that admission path, map grades to existing canonical Claims and delegate corrected history to #139. Test authentic effects, rollback/retraction/remap, caps and attributable opposite-direction stage-3+ witnesses. Keep any unresolved method/policy Pending, including pre-Treachery bank disposition. Preserve strict Treachery and Forward Castle's opponent-specific unrounded `<15` geometry **plus completion/post-completion production proof**.

INT-C2 requires its own owner authorization/review. No public stages, awards, entitlements, feature activation or cloud/staging work follows automatically; #132 remains separate independent final multiuser acceptance. #155 Personality context, #156 rare Chronicle contributions and E's #140 remain independently owned.
