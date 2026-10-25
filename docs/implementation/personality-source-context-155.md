# PERS-CONTEXT #155 — source admission and owner calibration packet

**Implementation:** `functions/src/engines/personalityV1/contextAdmission.ts`, version `AOF_PERSONALITY_CONTEXT_ADMISSION_V1`. Server-selectable pure adapter, no integration edits. **Current main source baseline:** `e453d40c147ad488f3bfd369e54eba82b29c43b5`. No default review proofs, scores, profile writer, reader routing, release or public policy.

## Sol/INT-B integration signature

The accepted `functions/src/integration/personalityHistory.ts` defines `AdmittedPersonalityContext = (source) => GameContext | null` and already refuses absent context. No interface changes are required:

```ts
const admitted: AdmittedPersonalityContext = verifiedSource =>
  personalityContextForHistory(verifiedSource, authenticatedOwnerPlayerId,
    reviewedExactSourceProofOrNull);
// Pass admitted to projectPrivatePersonalityHistory only in Sol's server-owned route,
// after source/replay statistics provenance and current authority have been verified.
```

`admitPersonalityContext(verifiedSource, authenticatedOwnerPlayerId, reviewedProofOrNull)` gives a field-wise audit with `SOURCE_VERIFIED`, `REVIEWED_CLASSIFICATION` or `PENDING`, explicit reason codes, exact source lineage digest and a `context: GameContext | null`. Its pure hook returns null on any missing field. Only Sol can decide when verified history receives a particular proof, and Sol must never let the caller supply the owner ID, proof, statistics, source, or classification. Before invoking the engine, INT-B still enforces entire-Battle multi-Game completeness, current READY official result, admission, authenticated roster, active source and correction fences. This adapter does not replace those checks.

**Proof type:** `ReviewedContextProof` is an explicit immutable, server-side, source-hash-bound classification record requiring exact raw gameBuild, decoded map ID, starting-age and resource IDs, an independently reviewed map family and start classification, and a separately reviewed observed-duration bucket. `referenceId` must identify a review whose evidence Sol can verify in a real registry. There are intentionally **no installed proofs**; test ones are synthetic, not authorized. A `STANDARD` assertion additionally requires observed starting-TC anchor in this player's source statistics; initial age 0, named map or empty lobby cannot prove this by itself. Different patch/civ/map identifiers are never silently grouped into one opportunity. A raw exact `BUILD_<build>_CIV_<raw-id>` is **identity-only**, not proof of accessible unit families. FFA's current runtime diplomacy qualifier stays false unless independently source-qualified and reviewed. An observed interval is *not* confirmed full-game duration.

### Authoritative evidence and absence audit

| `GameContext` field | Positive data admitted from current sources | Fail-closed absence / nonclaim |
| --- | --- | --- |
| format | Current server Match format `ONE_V_ONE`, `TWO_V_TWO`/`THREE_V_THREE`/`FOUR_V_FOUR` or `FFA` + exact current Game roster, Match/SourceSnapshot identity and team-size consistency | Lobby team IDs cannot establish effective runtime allegiance; misleading format/player mismatch PENDING |
| mapId | Decoded `matchFacts.rules.mapId` with `DECODED` and agreeing `matchFacts.map.id` when both present | RMS name, guessed Arabia IDs, conflicting/missing map IDs PENDING |
| mapFamily | Only independently reviewed `LAND/WATER/HYBRID` exact-source classification | Neither map ID, map name, fish count nor water ratio alone assigns family; missing reviewed proof PENDING |
| startFamily | Source-matched reviewed `STANDARD/NOMAD/CUSTOM` classification with decoded exact starting age/resources; STANDARD also requires observed starting TC anchor | `startingAgeId=0` and resources 0 do not establish ordinary start; Nomad not inferred from no TC alone; unknown PENDING |
| civilization | Verified `matchFacts.players[replaySlot].civilization.rawId` and source Game build bound to the authenticated subject's roster slot | Source name/UI drafted civ, unresolved/unknown raw ID or mismapped slot PENDING |
| civilizationOpportunityKey | Exact patch/build and raw civilization identity; no pooling at this stage | This is NOT a validated military-unit availability taxonomy or equivalence across civs |
| durationMs | `matchFacts.game.observedDurationMs` with explicit observed-interval meaning | Not game length/outcome; observed-duration missing or zero PENDING |
| observedUntilMs | `statistics.scope.observedUntilMs` verified alongside recorded interval | Coverage gap/contradictory bounds PENDING, no fabricated zero |
| durationFamily | Exact-source reviewed `[lowerObservedMs,upperObservedMsExclusive)` with `OBSERVED_RECORDING_INTERVAL_ONLY` | No hard-coded 10/20/30-minute or ordinary/short buckets; UNKNOWN remains PENDING |
| dynamicDiplomacyQualified | Source `matchFacts.diplomacy.effectiveRuntimeStateQualified` currently false | False is genuinely known; static FFA lobby teams/diplomacy don't prove directed contacts/combat |

The `SourceSnapshot` is trusted **only** as an already INT-A/INT-B verified server artifact: its Match=Battle, Game, source SHA, roster mapping digest, source statistics revision and official outcome must match its current active read. The pure adapter cross-checks source provenance against the verified retained `matchFacts`; it does not authenticate Firebase or fetch new data. If the same Game ID is reused in a different Match, its source identity differs; one league Battle containing multiple Games remains **one sample**, as implemented in #137 and tested together here. A later revision, POV replacement, result dispute, withdrawn source or remap invalidates previous source-bound proofs.

## Authentic positive values, and what remains unavailable

| Pinned genuine input | Actual source facts confirmed in CI fixtures | Context NOT established from the evidence alone |
| --- | --- | --- |
| upstream-duel-save66.6 | 2 decoded replay players, build 158041, 2,220,129 ms observed interval, 120×120 map, SHA `dc1a630ea33b197703f70fab0386b476d02b5bdd43916ec012f971ef580d3985` | Map family, ordinary start, official League result, player-bound civ and duration buckets |
| 2v2 TownBell analysis | 4 source player slots, build 180059, raw RMS map ID 149, starting-age ID **0**, resources ID **0**, observed duration 2,003,471 ms | True runtime team cohesion, map-family classification and completion or standard start. Team Match/game binding in tests is controlled synthetic. |
| 4v4 TownBell analysis | 8 source slots, build 180059, raw RMS map ID 17, starting-age ID **0**, resources ID **0**, 3,295,040 ms observed | Map-family and standard-start classification, patch-wide equivalence, current League membership and outcome |
| user-ffa-diplo-save68.9 | 8 decoded players, build 180059, observed 5,703,316 ms, source SHA `ab947d934bbd4fa4e2531f4f8a5014f9b923038a34aa7332d7260eb78fb3fab5` | Complete effective FFA diplomacy, any proven tactical attack, map and start classification, official result |

Tests read **real checked-in source-derived goldens** rather than claim invented pole measurements. Controlled Match/Game/SourceSnapshot wrappers and `ReviewedContextProof` fixtures only exercise the engine input contract; they are not historical league identities, reviewed map taxonomies, authenticated live profiles or validated combat outcomes.

## Five descriptive poles — combined owner calibration proposal (all numerical policy remains UNAPPROVED)

| Axis | What is *actually measured* by #137 | Required opportunity/coverage decision and proposed display interpretation |
| --- | --- | --- |
| Boomer ↔ Aggressor | Classified positive-cost military *requests* divided by all positive-cost commitment requests in the observed Game | Require full request catalog pricing and denominator, comparable recording window, rules/maps/civs; left = relatively economic/nonmilitary commitment, right = higher military requested-cost share. Neither proved early rush nor damage. Decide whether to retain the whole-observation proxy or add same-time-window components. |
| Cautious ↔ Bold | Source-ID-distinct forward strategic BUILD placement requests divided by home+forward eligible placements | Owner must choose strategic building-ID taxonomy, home anchor method, mid-map exclusions, team-vs-FFA spatial opportunity. Left = home-directed placement, right = more forward-directed plans, NOT experienced survival risk or battle success. |
| Guerrilla ↔ Frontline Fighter | Qualified source-linked economy-directed hostile command episodes versus contested-space military command episodes | Requires reviewed directed source attribution, complete episode arrays, FFA effective relation and independent episode floor. Correlated pressure/raid/contact cannot vote twice. Left = economic-zone pressure commands, right = contested-force commands. This **does not observe executed combat or true tactical role** and may stay Developing if evidence insufficient. |
| Specialist ↔ Improviser | Entropy of positive classified queued military-family requests / max possible family entropy | Eligibility limited by exact build+civ military opportunity list; missing family catalog, unknown queues or incomplete costs withhold. Left = concentrated request families; right = broad requests, not demonstrated situational adaptation. |
| Compact ↔ Expansive | Supported remote expansion placement clusters versus those clusters plus eligible home-radius placements | Distinct remote sites count once; require initial anchor, complete zone buildings and map/start opportunities. Left = home placement focus; right = geographically distributed intended expansions; no held terrain or completed construction claim. |

**Owner decision to calibrate each axis:** pin a reference version for exact compatible format/map family and map ID, starting conditions, build/civilization opportunity, duration class and observed coverage; choose per-axis comparable-game exclusions and low/high normalization anchors based on separately human-reviewed authentic left/mixed/right/weak examples. Fix *both* (a) number of independent **Battles**, not Games or POVs, required before a score, and (b) minimum number of source-attributable episodes or placements per Battle for the axis. Choose whether missing component evidence invalidates the whole Battle (safest V1), whether to show limited subprofiles across incompatible contexts, and the release criterion for labels.

**Historical weighting/outliers:** owner should compare equal-independent-Battle career mean versus robust median and an explicitly bounded recent eligible-Battle window, with an owner-chosen career/recent blend, change hysteresis and stabilization after one atypical Battle. Corrections replace the selected Game/Match version and reproject from historical evidence, never stack another sample or resurrect superseded source. No numerical threshold, context bounds, anchor/weight or minimum is adopted in code. Even if contexts are admitted, #151 intentionally passes `calibration=null`: current profiles remain null Developing until a separate owner decision and Sol integration.

**Recommendation:** merge this inert pure contract when its technical tests and source provenance review pass. Do **not** wire it in Sol's callable yet without a trusted server-owned exact-source proof registry; that is an independent boundary. Improve admission first, then approve a versioned calibration pack and genuine participant-level worked examples before enabling *private candidate scores*. No social rewards or production scoring follow automatically.
