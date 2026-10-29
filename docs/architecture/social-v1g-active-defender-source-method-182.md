# SOC-V1G — source-exact active defender counter-targeting (issue #182)

**Status:** `AOF_SOC_V1G_DEFENDER_COUNTER_TARGET_V1_PROPOSED`. Default-OFF, source-method-only, private experiment. **Do not merge as a qualified new method until authentic corpus CI establishes a new non-#173 source-positive and an adjacent source-negative.** Design checkpoint main `1b5711006e70ff0e13b219cd11bbc82a37605706`. Owner v0.2: active defensive counterplay can contribute directional **Rivalry** (not Hostility or Cruelty), even without an economy-targeted Raid initiated by the defender. The existing `AOF_SV1E_PAIR_RAID_ENGAGEMENT_CONTEST_1` remains the accepted narrow pilot.

## Narrow specific claim and what is NOT claimed

`prepare_active_defender_counterplay(statistics,context,source_measurements,action_events,game_scope)` reconstructs and checks current unchanged #158/#173 candidate/output first, then for **B→A** (defender's own direction) asks:

1. Current original Pair facet `TARGETED_COMMAND` B→A with **at least two unique original B-owned `ORDER` commands**, original operation ordinals, target instance IDs matching the exact retained Action Events, and independent source-recorded target-controller identity `controllerPlayerId=A`. A participant count or shared pair-local overlap is insufficient.
2. An independent **earlier** Raid V3 A→B detector with **at least two unique original A-owned non-STOP actions**, each strictly before B's first own target order and inside the explicit, bounded pilot lookback (90k game-ms, adjustable only from 1k–180k). This demonstrates original command pressure before B counter-targeting; it does **not** establish victims suffered damage, defensive success or that the counterplay occurred in B's home.
3. An existing SKIRMISH/TECHNICAL_BATTLE source detector with **original B target ORDER overlap** and explicit B contributor identity. Model corroboration is not an additional executed action.
4. Complete decoded **fixed opponents** across the whole Game roster; reliable source clock/ordinal; no disqualifying same-component STOP/CANCEL ambiguity; source revision Context V2 matches original #149/#158 producer. FFA effective relationship and uncertain teams stay Pending.
5. Existing accepted #173 R must **not** have already admitted this original source-connected candidate; across all candidates, the same earlier Raid/Skirmish detector cannot support repeated B→A Rivalry grades, including source components with disjoint original event IDs.

A passed **proposed source-match** means exactly **`SOURCE_MATCH_PROPOSED`**: actor-owned counter-target *request* inference, original coverage still `LIMITED`, **`sourceAdmittedCount=0`, `gradeBandId=null` and no new `SOURCE_ADMITTED` method** until the genuine corpus positive/negative is verified and the method is separately approved. The output has `canonicalContributionKey=null`, `canonicalClaim=null`, no effects/actor witnesses/receipts or writes, `gameScopeAuthenticated=false`. It is **not** Sol's already authenticated READY Battle/Game/GUID wrapper, historical Claim, production rule, outcome, stage or permanent recognition.

### Nearest negatives to demand

| Requirement | Source-exact prospective positive | Nearest denied |
|---|---|---|
| Original actor/direction | B original ORDER explicitly targets **A-controlled** instance | A's Raid merely lists B as victim; B's passive MOVE/garrison/Town Bell/STOP cannot be borrowed as B→A attack |
| Controller | Each targetInstanceId in retained original action equals corresponding Pair V2 controller evidence `controllerPlayerId=A` | Controller evidence B/C or changed original instance → Pending |
| Pre-entry | Earlier A-owned Raid V3 original action IDs before B counter-target | An A Raid that occurs *after* B act, a source clone with inferred A Raid removed, or no prior A action |
| Independent contest | B contributor in SKIRMISH whose original refs overlap B target action | Generic Battle participant / B present without B target command; only one B source command |
| Fixed source rights | All members of decoded locked-team roster current, originals/Context V2 source aligned | Incomplete roster, FFA stance request, superseded source revision or withdrawn Game |
| Dedup | One B→A original connected deed with unique Raid+Skirmish corroborators | Two detector views of same skirmish, second POV, two B deed components sharing same prior A Raid or current #173 R credit |
| Genuine validation | Exact SHA-pinned played recording with B-owned ORDER(s), prior A-owned Raid and linked Skirmish **plus independent natural played near-negative if present** | A synthetic fixture (CONTROLLED) or removal of Raid V3 from derived stats (a **source-preserving detector-ablation**, not a second actual played negative recording) |

## Existing source and empirical limitation

- Dedicated [#173 genuine original corpus](https://github.com/Mathias-ao/League-of-Friends/actions/runs/40258959953) already established actor-owned raid+engagement Rivalry in 1v1/2v2/4v4; it did **not** establish this **different** B-origin active-counter-target method. Earlier `raid-2`/ `skirmish-5` 1v1 positive was **old A→B pressure**, not proof B actively struck back.
- `replay-tools/tests/probe_social_v1g_original_defender.py` inspects original SHA-pinned 1v1/2v2/4v4/FFA with the accepted parse→Statistics→Context V2→#149→#158→#173 path, and logs compact source actor/opponent/refs, prior Raid, linked Engagement and current old R status. Its `qualifiedNonRaid` subcategory requires actor-owned targeted commands + engagement and old #173 R Pending; `defenderPriorOpposite` further requires earlier original A→B Raid. It is a discovery count, **not** already a method admission.
- `replay-tools/tests/test_social_v1g_active_counterplay.py` requires at least one **genuine played original** qualifying proposed B→A source method candidate and one independently sourced natural Pending case for an auth-method green gate. Controlled tests exercise exact original target/controller, opposite actor earlier pressure, no Raid, stale source, duplicate POV, FFA/friendly opposition and zero writes. If no authentic original satisfies this, **CI MUST fail** and implementation remains draft/PENDING. Never call a controlled fixture genuine.

### Other six-track evidence remains Pending

| Track | Current proof position | Specific missing witness |
|---|---|---|
| **Gallantry** | Existing #173 challenged-offense R+G narrow source path; v0.2 skilled opening or defender response not admitted | Original request-linked skill/context and legitimate start/phase opportunity, not one win or raw APM |
| **Cruelty** | #173 `INDEPENDENT_PREENTRY_VICTIM_DISADVANTAGE_NOT_AVAILABLE`; owner v0.2 permits proposal of tactic-type eco/Drush/tower pressure separately | Original B-owned economic target/geometry and independently qualified tactic / original near-negative; victim weakness optional **amplifier** only if demonstrated; no damage/kills inferred |
| **Chivalry** | Exact B-beneficiary help under earlier third-party Raid; #173 genuine source-positive | Material execution/rescue not proven; boom/relic/Wonder outcome not proven |
| **Rivalry** | Current Raid+engagement source positives; this candidate attempts *new* B-owned counter-target without initiated Raid | Genuine new B→A positive with independent source and natural nonqualifying control; neutral **territory geometry itself still unapproved** |
| **Hostility** | #173 `EFFECTIVE_RUPTURE_OR_SELECTIVE_CROSS_GAME_ANTAGONISM_UNAVAILABLE` | Credible B-home focus vs neutral, actually targetable alternatives, actual earlier effective FFA ally/neutral transition and grace/self-defense |
| **Bond** | Original beneficiary-specific defensive aid can be source-admitted under #173 | Tribute receipt/trade delivery, real effective FFA cooperation remain unproven |
| **Independent weakening** | All six proposed directions Pending; no new source positive | Prior authenticated same-direction relationship + new actor-owned positive settlement, reparative actual help or serious breach; silence/defeat/no questionnaire never qualifies |

**Sol interface:** this proposal does not modify `AOF_SOC_V1E_BOUNDED_GRADE_METHODS_1`, SHARED_1, C1/C2A key mapping, #141 or #139. After genuine evidence and owner method admission review, Sol would separately map the **same original source-connected contribution** to the authoritative Game/Battle/Event timeline and apply existing #139 per-track per-direction budgets/reciprocal actor-source requirements. In all cases one deed can be counted as a Statistics fact and a restrained Chronicle sentence without new same-track credit or automatic Battle/Event/accolade/trophy.

No deployment, cloud, staging, production scoring, grants or changed allocator.
