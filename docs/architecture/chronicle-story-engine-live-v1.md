# Age of Friends — Chronicle Story Engine Live V1

Status: **shadow integration for review and corpus qualification**  
Parent design: `chronicle-story-engine-v1.md`

## Purpose

Connect the deterministic Chronicle Story Engine to the same CanonicalReplay statistics path used by the player website, without adding an LLM, external narrative API, second replay truth path, or production relationship scoring.

The live V1 integration is deliberately conservative. It persists enough neutral, time-ordered social evidence to validate real 1v1, team and FFA/diplomacy Battles before any new prose or Relationship effects become player-facing.

```text
uploaded recording
  -> CanonicalReplay
  -> AOF_REPLAY_ANALYSIS_V3
  -> AOF_CANONICAL_STATISTICS_V1
       -> player statistics
       -> AOF_CHRONICLE_SOCIAL_SOURCE_V1
            -> AOF_CHRONICLE_SOCIAL_SOURCE_PRODUCTION_ADAPTER_V1
            -> AOF_PAIR_SOCIAL_EVIDENCE_V1
            -> league-player ID mapping
            -> Firestore shadow evidence

future, after corpus qualification:
  shadow pair evidence
    -> AOF_CHRONICLE_EVENT_V1
    -> AOF_CHRONICLE_WRITER_V1
    -> public Chronicle
    -> separately configured Relationship interpretation
```

## 1. One statistical truth path

The production replay upload path is the Python CanonicalReplay/statistics pipeline. Chronicle must therefore consume a projection of that pipeline rather than treating the older TypeScript `MatchAnalysisV1_4` view as a second production authority.

The replay worker now builds `AOF_REPLAY_ANALYSIS_V3` once and derives both:

- `AOF_CANONICAL_STATISTICS_V1`; and
- `AOF_CHRONICLE_SOCIAL_SOURCE_V1`.

This avoids reparsing the replay and avoids repeatedly downloading the canonical ZIP during Relationship/Chronicle rebuilds. CanonicalReplay remains the retained evidence authority; the Chronicle source is a small rebuildable projection.

## 2. Chronicle social source

Implementation: `replay-tools/social_evidence_projection.py`

Version: `AOF_CHRONICLE_SOCIAL_SOURCE_V1`

The source retains only Chronicle-relevant, already-derived evidence with provenance:

- replay/canonical/statistics version identities;
- observed Battle duration and relevant settings;
- replay player ids;
- canonical initial diplomacy when present;
- raw header initial-diplomacy fallback context;
- ordered directed diplomacy commands;
- directed tribute commands;
- qualified Raid episodes;
- Battle directed-interaction edges;
- fixed-team Reinforcement and Defensive Assistance evidence;
- Cooperative Attack rows for future qualification;
- Forward Building evidence;
- Enemy Base Contact evidence for future contextual use;
- decode/framing coverage metadata.

The projection explicitly does **not** contain Relationship scores or narrative interpretation.

### Semantic boundaries

The source records four invariants explicitly:

1. a diplomacy command is an observed requested stance change, not independent proof of another player's stance;
2. a tribute command is an observed command, not proof that resources settled;
3. engagement/raid evidence is command-derived inference under its own versioned model;
4. no narrative or Relationship interpretation is part of this source.

## 3. Temporal diplomacy

The existing `AOF_DIPLOMACY_TIMELINE_V1` remains the temporal authority for social interpretation.

Initial diplomacy is directional. The preferred input is canonical `initialDiplomacy`. The current canonical exporter does not yet populate those normalized edges, so V1 may use `match.settings.initialDiplomacyRaw` through the separately versioned header mapping:

- header raw `2` -> `ALLY`;
- header raw `3` -> `NEUTRAL`;
- header raw `4` -> `ENEMY`.

Runtime diplomacy commands use their own independent mapping:

- action mode `0` -> `ALLY`;
- action mode `1` -> `NEUTRAL`;
- action mode `3` -> `ENEMY`.

The two integer domains must never be conflated.

Pair state remains directional and time-dependent. It can therefore represent mutual alliance, mutual hostility, mutual neutrality, one-sided alliance, one-sided hostility, conflicted diplomacy, or unknown state.

## 4. Production adapter

Implementations:

- `functions/src/engines/chronicleSocialSourceAdapter.ts`
- `functions/src/engines/chronicleSocialSourceProductionAdapter.ts`

Versions:

- `AOF_CHRONICLE_SOCIAL_SOURCE_ADAPTER_V1`
- `AOF_CHRONICLE_SOCIAL_SOURCE_PRODUCTION_ADAPTER_V1`

The generic adapter converts the neutral source into `AOF_PAIR_SOCIAL_EVIDENCE_V1`. The production wrapper adds persistence-grade validation and an explicit audit of raid suppression caused by allied or unknown diplomacy.

### Positive-evidence policy

Live V1 promotes only positive facts whose source event/provenance survives the statistics path.

Currently eligible:

- `RAID_PRESSURE`;
- directed `DIRECT_ENGAGEMENT` from Battle interaction edges;
- `FORWARD_ENCROACHMENT` from versioned Forward Building evidence;
- fixed-team `ALLY_REINFORCEMENT` and `DEFENSIVE_ASSIST`, but only when the reconstructed diplomacy state is mutually allied at the evidence time;
- coincident third-party pressure derived from overlapping qualified Raid episodes.

### Deliberately retained but not promoted

The following evidence is retained for future qualification but does not become a social beat in the production adapter yet:

- tribute -> **not** `MATERIAL_SUPPORT` until transfer semantics are qualified;
- Enemy Base Contact -> **not** hostility, because the statistic explicitly does not require hostile interaction;
- Cooperative Attack -> not promoted through this bridge until dynamic/fixed-team relation semantics and event timing are sufficiently precise for the production source;
- raw flare evidence -> not interpreted as cooperation or intent;
- chat -> not interpreted in Chronicle V1.

## 5. FFA / diplomacy precision

FFA diplomacy is the highest-drama format and therefore receives the strictest evidence rules rather than looser ones.

### Pressure at event time

Raid, direct-engagement and forward-encroachment observations are checked against the source player's directed stance toward the target during the observation interval.

An observation is eligible only when every overlapping directed diplomacy segment is qualified and none marks the target `ALLY`.

If the interval overlaps unknown diplomacy, it is suppressed. If it crosses into an allied interval, it is suppressed rather than split.

This is intentionally conservative. Current Raid and engagement outputs retain episode/event ids, but the compact social source does not yet retain an exact timestamp for every individual source command inside each episode. Splitting a raid at a diplomacy boundary would therefore pretend to have finer temporal attribution than the source currently guarantees.

A successor may safely split episodes only after the source carries the required per-event timing.

### Coincident pressure is not conspiracy

If two players have overlapping qualified Raid episodes against the same third player, V1 may record `COINCIDENT_THIRD_PARTY_PRESSURE`.

It does **not** claim:

- alliance;
- communication;
- planning;
- conspiracy;
- coordinated intent.

Those require separate evidence.

### Dynamic FFA cooperation remains a known gap

The current Python Engagement Statistics model intentionally marks ally-interaction metrics unavailable for diplomacy-enabled FFA because its Reinforcement/Defensive Assistance/Cooperative Attack derivations are still based on fixed-team semantics.

Live Chronicle V1 does not bypass that restriction. Temporary FFA alliances can already be represented by the diplomacy timeline and can coexist with pressure before/after alliance changes, but dynamically allied Reinforcement/Defensive Assistance is not yet manufactured from insufficient evidence.

This is a qualification gap to solve with real FFA corpus evidence, not an invitation to infer cooperation from alliance state alone.

## 6. Coverage and absence

The live source adapter leaves these families `UNAVAILABLE` for absence claims:

- opposition interaction;
- allied cooperation;
- economic transfer;
- spatial pressure;
- communication.

Positive observations may still exist. `UNAVAILABLE` here means that AoF has not established complete enough family coverage to conclude that the absence of an observation is meaningful.

Therefore shadow V1 cannot write claims equivalent to:

- they ignored one another;
- they refused to help;
- they failed to cooperate;
- neither attacked the other;
- an ally abandoned another.

Opportunity-qualified absence remains part of the Pair Social Evidence model, but is disabled in this production bridge until coverage and opportunity models are validated.

## 7. Replay identity -> league identity

Replay slots are evidence identities, not durable league identities.

After the existing upload path uniquely binds replay participants to Game participants, `AOF_LEAGUE_SOCIAL_EVIDENCE_V1` maps every Pair Social Evidence record to durable league `playerId`s.

Ambiguous identity mapping remains a hard upload exception. Chronicle evidence must never silently bind by display-name guesswork.

## 8. Persistence

The worker writes `chronicle-social-source.json` into the sealed upload bundle and also returns the compact source to Functions.

Functions verifies source replay-hash provenance, then stores the compact source in object storage beside `statistics.json`.

The replay source document records:

```text
chronicleSocialEvidence
  state: SHADOW_READY
  sourceSchemaVersion
  sourceAdapterVersion
  productionAdapterVersion
  leagueSchemaVersion
  sourcePath
  sourceSha256
  pairCount
  diagnostics
  publicChronicleActivated: false
  relationshipScoringActivated: false
```

League-mapped pair evidence is stored beneath the replay source:

```text
matches/{matchId}/games/{gameId}/replaySources/{sourceHash}/pairSocialEvidence/{pairId}
```

This avoids inflating the replay-source parent document and keeps per-pair review practical. Eight players create at most 28 unordered pair documents per replay source.

## 9. Shadow-mode safety

This branch **does not** activate:

- production Relationship weights;
- production Relationship stages;
- new public Chronicle prose;
- War Room eligibility changes;
- absence/non-cooperation effects.

The existing `RIVALRIES` orchestration and public Chronicle remain unchanged while the new evidence path is qualified.

That separation is deliberate: replay processing can begin collecting real social evidence without silently changing the league's visible history or scoring rules.

## 10. Required qualification before activation

Activation requires corpus review across at least:

- ordinary 1v1;
- fixed 2v2/3v3/4v4;
- FFA with no diplomacy changes;
- FFA with one-sided alliance changes;
- FFA with mutual alliances;
- alliance formation followed by pressure;
- pressure followed by alliance;
- multiple alliance/hostility reversals;
- simultaneous pressure by multiple players against one target;
- incomplete/unknown initial diplomacy;
- missing or partial interaction evidence;
- large 6–8 player games.

For each corpus Battle, review must compare the shadow evidence against the canonical source events and confirm that every narrated concept would stay within the source claim.

Dynamic FFA cooperation and opportunity-qualified absence require their own qualification before they are enabled.

## 11. Writer activation rule

`AOF_CHRONICLE_EVENT_V1` and `AOF_CHRONICLE_WRITER_V1` may consume the live evidence only after the corpus gate above is passed.

The writer remains deterministic and source-controlled. Runtime generation uses no LLM and no paid narrative service. LLMs may be used offline to propose phrase-library candidates, but accepted fragments must be human-reviewed, source-controlled, predicate-gated and tested like code.

The desired player experience is high drama from real historical contrast—not from invented adjectives. The system should make players argue about what the evidence *means* while AoF remains precise about what the replay actually supports.
