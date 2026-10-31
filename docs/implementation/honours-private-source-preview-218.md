# Ten-honour private source preview — #218

This implementation connects the frozen ten concepts to the existing authenticated current-recording intake. It is an on-demand, read-only testing surface on the owner's profile. It does not run #217's proposed numerical rules, grant achievements, resolve trophy possession, publish results or alter the 37-family/26-record/64-card catalogues.

The server requires `AOF_HONOURS_PRIVATE_PREVIEW=source-v1`, `FUNCTIONS_EMULATOR=true` and a `demo-` project, as well as the existing INT-A/INT-B private-read gates. The UI separately requires `VITE_AOF_HONOURS_PRIVATE_PREVIEW=source-v1`, `VITE_USE_EMULATORS=true` and a `demo-` project. Defaults are off; the new gate rejects staging and production even if the flag is supplied. This document does not authorize enabling flags, accounts, staging or deployment.

`getMyHonoursPreview` accepts an empty request. Owner identity comes from authenticated active membership and its current auth link. Source collection and final transactional revalidation reuse `collectMyCurrentBattleHistory`; retained native evidence, current source/result revisions, GUID claims, roster and complete enumerated input sets retain their existing fences. The response carries only safe current-Game references and source limitations. Source correction replaces the current preview rather than appending grants or historical possession.

| Selected concept | Actual connected behavior |
|---|---|
| Fast Castle | Pending: source-qualified opening/strategy and approved maturity/quality gates are not supplied. No proposed threshold or rejected title is imported. |
| Wonder | Pending: current replay BUILD requests and ordinary official winners do not prove completed Wonder ownership or Wonder-victory method. No points or trophy holder is fabricated. The binding first-verified-own-win, victory-count/points policy remains unchanged. |
| the Unbroken | Pending: approved eligibility/sample gates are absent. |
| Master of the Three Schools | Pending: independently source-qualified Elite branches and approved tier gates are absent. |
| FFA sole winner | A source candidate can identify an exact current official `PLAYER_WIN` with one winning player in a canonical FFA Game. The enumerated parent Battle must have all source inputs available. Distinct Games in that Battle do not multiply its candidate count. This does not establish never-allied/unaided play, approve upgrade thresholds or grant a distinction. |
| Boomer, Explorer, Gold, Aggression, Defence | Pending with explicit per-concept method/effect/opportunity limitations. Raw command volume, routes, placement/tribute requests and unapproved grades cannot grant them. |

The collector's known upstream expected-Game-manifest gap remains separate: a Game absent from the canonical collection cannot be invented by this preview. The response reports complete **enumerated** inputs, not independently certified complete series. The pending-source rule limits candidate eligibility to the affected Battle; an unrelated pending Battle does not erase a valid source candidate elsewhere.

Focused backend tests use controlled contract FFA fixtures for candidate positives, coalition/wrong result/revision negatives, per-Battle dedup and withdrawal rebuilding. An authenticated native validation fixture separately proves read-only intake, current-source/revision, target injection denial and access/source/result races. UI tests cover ten visible rows, exact Game evidence, on-demand loading, unsupported-source Pending, stale responses and auth changes. These tests are not original FFA gameplay admission, real-browser acceptance, policy calibration, Wonder proof or p95 evidence. #193/#217 remain independent draft design/test packages.
