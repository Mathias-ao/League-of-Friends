# Age of Friends — V1 honours test evaluator and Chronicle response harness

**State:** PURE TEST IMPLEMENTATION / EMULATOR SIMULATION ONLY. Stacked draft PR #217 on Worker C's design draft #193. **NOT production-authorized.** No new Firebase callable, Firestore write, award seed, user notification, public holder, reputation mutation, recognition grant, deployment, or Chronicle invitation is implemented.

## Run the current test harness

```sh
cd functions
node --test tests/honours-v1-sandbox.test.mjs
# Full exact-head CI:
npm run lint && npm run build && npm test
```

The first command exercises **20 focused scenarios** across all **10 owner-selected honours** including the Chronicle private-response simulator. Tests import the test-only `functions/src/engines/honoursV1Sandbox.mjs` and `honoursV1ChronicleSandbox.mjs` directly, independent of existing production `processAchievements.ts`.

All ten are represented by one pure `projectTenHonours(input, playerId)` collection response. Outputs include `state`, typed proposed values, source-game context where available, and `anyGrantWritten:false`. `projectCompetitiveTrophy()` also returns current holder, mutable qualified current record, current mature/provisional state, and a valid source-rebuilt succession ledger. It is a reference **rebuild projection**, not a persistent award transaction.

### Provisional calibration values — test fixtures, NOT owner-approved cutoffs

| Honour | Draft test gate | Current unsupported source / additional check |
|---|---|---|
| **Fast Castle competitive crown** | Season age ≥7d, ≥5 independent qualified Battles, ≥4 distinct comparable players. Modelled Castle timing **≤15:30**, current fastest normal-start Game. Strictly faster record transfers during Season. | READY exact source, research cancellation, opportunity, same model and eligibility admission; public name and final maturity/absolute thresholds pending owner |
| **Wonder competitive trophy** | Season age ≥7d, ≥3 comparable Battles, ≥2 players; **fastest officially verified Wonder victory ≤60:00** from Game clock. | Existing result outcome does **not** prove *Wonder* victory method; requires separately authoritative method review and known end-time. Wonder BUILD ≠ finished/winning Wonder |
| **the Unbroken** | **4 distinct accepted non-FFA Games won** in current Season, no official non-FFA losses. FFA wins and losses excluded in test proposal. First accepted non-FFA loss revokes current title; any unresolved relevant result holds display pending. | Requires canonical Game result revision, no Game duplication, owner approval of Season reset and FFA win inclusion |
| **Master of the Three Schools** | Active **Elite** disciplined Drush with actual source-qualified Drush Flush, Elite Scouts OR Archers, and Elite FC Boom; one voluntarily equipped title. | School elite source predicates and the 148 original tier cutoffs remain unapproved |
| **FFA Solo Victory medal** | Lifetime distinct accepted FFA Battle sole official wins; **I/II/III/IV at 1/2/4/7** wins, one upgradeable emblem. | `PLAYER_WIN` sole official winner, not `COALITION_WIN`; does **not** assert the victor never allied or received help. Full current career history mandatory to finalize grade |
| **Boomer** | By **30:00** in the SAME eligible Game: ≥2 distinct extra TC BUILD sites, ≥75 *reconstructed* Villagers, ≥10 unique House BUILD sites, ≥3 remote Eco Zone clusters. | Does not prove constructed TCs/houses, living Villagers or actual income. Huns' Houseless bonus needs separate fair source-qualified branch; don't falsely claim Huns fail a universal skill test |
| **Explorer** | By **30:00**, validated `AOF_ESTIMATED_EXPLORATION_V1` with **≥90% coverage LOWER BOUND** and confidence ≥0.85. | **New inferred model does not yet exist**; existing 0–5m Scout buffered routes and command map coverage are not fog exploration. Must validate against genuine fog/position evidence before grants |
| **Gold Distinction** | By **30:00**, ≥2,400 gold in *classified queue commitment* and ≥65% compatible map gold infrastructure influence. | Neither actual mined gold nor received trade resources is established by these inputs. Market volume is not trade-cart income |
| **Aggression Distinction** | By **35:00**, ≥5 qualified directed-pressure episodes, ≥3 independently qualified engagements and ≥40% participation share **plus** one source-bound, voluntary privately-authored opponent acknowledgement. | No damage, kill, success or malicious motive from inferred episodes/acknowledgement |
| **Defensive Distinction** | By **35:00**, verified severe incoming threat (provisional severity grade ≥3), ≥2 source-qualified response orders, correct defender/attacker mapping, **plus** one verified voluntarily-authored beneficiary/opponent private perspective. | No successful lifesaving, completed quickwall or material rescue from commands or testimony alone |

**Important:** These are test gates that developers can adjust now. They are deliberately **not** inserted in the frozen #162 37-family/148-null-tier/26-record registry, live seeds or production entitlement definitions. Numeric plausibility is a starting proposal, not evidence of calibrated rarity: authentic 1v1/team/FFA samples, civ/map effects, seasonal length and player skill distribution must be measured before approval.

### Source envelope and privacy boundary

Inputs are normalized, *trusted-only* facts, with Season ID, canonical Battle ID, canonical Game ID, accepted source and result revisions, comparison cohort, format/roster, Game clock, outcome/official victory method, and source-observed metric evidence. The test evaluator does not independently authenticate these facts. **It MUST NOT be used as an externally callable function over raw client-supplied evidence.** A future versioned admission adapter must derive them from the existing source-current READY replay, accepted canonical official result, authenticated mapping and approved model revisions. Missing or incompatible evidence yields `PENDING_EVIDENCE`, not guessed completion.

Chronicle-dependent Aggression/Defence cases output **candidate drafts**, not actual invitations; a real offer still requires the approved Chronicle source-opportunity review, private authenticated actor lookup, strict one-respondent/one-Battle invitation, **three intervening eligible Battles** cooldown, version fences and privacy. The test planner reserves cooldown across *the proposed batch as well as prior offers*, and excludes unauthorised/unknown Battle IDs. In `honoursV1ChronicleSandbox.mjs`, a respondent can simulate `ACKNOWLEDGED`, `NOT_PERSONALLY_MEANINGFUL`, `UNSURE` or `DECLINE` only when `FUNCTIONS_EMULATOR=true`, project begins `demo-` and `AOF_HONOUR_CHRONICLE_V1=emulator-only`. The simulator verifies exact authenticated respondent and source revision; it never stores or sends the invitation, never publishes subjective testimony, never writes social credits or grants an honour. A source correction changes revision and invalidates old recognition. One player’s judgement cannot invent a reciprocal action, actual combat effects, gold receipts, map fog, Wonder-victory method, or a public accusation.

### Remaining engineering work before genuine player E2E use

1. Build **trusted adapters** from current replay/statistics, official result revisions and Battle/Season order to the ten-projection normalized facts. Extend command-derived projections only as their source meaning supports them. In particular source-validate Boomer's 30m cutoff inputs, Gold commitment + influence timing and a new Explorer estimated exploration lower-bound model.
2. Define **approved Wonder victory method evidence** independently of the current result winner. Test actual Wonder-winning recordings or verified admin adjudication and alternative victory negative. Then feed only approved official method + clock data to the pure trophy evaluator.
3. Review and, only when owner approves, implement an authenticated *emulator-only* Chronicle honour prompt bridge into the existing #165 V1E invitation machinery with actor/episode/source binding, explicit acknowledgement choices, decline/defer, respondent privacy, one per Battle and cooldown. No award may be granted merely by player self-report.
4. Add identity-qualified, authenticated **read-only E2E** honour previews with source limitations and status distinctions. Only after authentic recordings, security acceptance, fixed owner thresholds, owner approval and further PR is the official awards persistence, public titles, transferable trophy writes, source revision correction or launch permitted.

**This PR is a testable foundation of all ten rules, not a claim that every one of those underlying data sources or player-facing workflows is live.**
