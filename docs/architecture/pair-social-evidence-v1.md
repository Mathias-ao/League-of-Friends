# Age of Friends — Pair Social Evidence V1

Status: evidence projection implemented on `feat/pair-social-evidence-v1`; not production Relationship integration.
Models: `AOF_PAIR_SOCIAL_EVIDENCE_V1`, `AOF_SKIRMISH_PAIR_EVIDENCE_V2`, `AOF_ENGAGEMENT_STATISTICS_V4`, `AOF_MAP_PRESENCE_V8`, `AOF_RELIC_TARGETING_V1`.

AoF records what its players did together and against one another. Its history must be earned from evidence. This layer describes command-derived interpersonal episodes, preserves uncertainty, and makes no claim about a player's motives, character, feelings or successful outcomes.

## Implemented path

`statistics_projector.py` consumes the retained Analysis V3 cache and existing qualified statistics models, then emits `pairSocialEvidence` alongside the ordinary statistics output. It never reparses a recording. The Canonical Statistics V1 envelope gains an additive optional property; the new model versions identify changed family semantics.

The projection is pure and Game-scoped. `pair_social_evidence.py` consumes Raid V3, Engagement V4, active Map Presence evidence and a canonical source-event lookup for provenance/chronology. It does not build another attack detector.

Replay numeric player IDs are explicitly `CANONICAL_REPLAY_PLAYER_ID`, not authentication IDs or durable league players. Production integration must apply the approved Game identity bindings and retain Game provenance under the league Match/Battle. The source revision retains replay hash, canonical manifest hash, schema and parser version. Corrections replace the prior revision's contributions; they must not append both results.

## Contract

The top-level projection retains:

- `modelVersion`, `identityNamespace`, `gameScope`, original `source`, and replay `playerIds`;
- directed family `coverage`;
- source command `observations`;
- qualified source `incidents` and deduplicated `deeds`;
- object-directed `relicTargetingObservations`;
- empty `opportunities`, explicit `diagnostics`, and inactive interpretation `policy`.

Each incident retains family, pair, source model, source event IDs, source references, inferred claim layer, full replay moments when available, chronology coverage, relation context, evidence facets, context provenance and deterministic identity.

Each deed retains incident membership, facets, replay chronology, active command-evidence windows, source event IDs, relation context, independence qualification and merge reason. The envelope duration is not continuous pressure or confirmed physical activity. Deed arrays are evidence records, not points.

Duplicate identical canonical events and repeated participant/source copies do not multiply evidence. Conflicting canonical event identities fail closed. Missing source references or unsupported models are diagnostic, not invented deeds. Sorting and content-based identities make rebuilds stable under input ordering and duplicate copies. Sequential `raid-N` and `battle-N` values remain source references, never deed identity authority.

## Directed pressure and local contest

Raid V3 yields directed inferred economy-pressure incidents, preserving attacker, victim, attribution methods and sources. Neither geometric attribution nor a targeted ORDER proves damage, kills or raid success.

Skirmish V1 keeps its Fight V1 episode boundaries, timings and counts. Pair Evidence V2 is attached afterward. Directed edge observations separately retain:

- targeted controlled-object command;
- local opposition command overlap;
- canonical event identity and full moment;
- overlap counterpart event, where relevant;
- targeted instance and controller evidence source/moment, where relevant.

Controller reconstruction does not use a later same-millisecond selection to attribute an earlier targeting command. Conflicting controller observations at one moment are ambiguous. Missing control-order evidence is not filled with guessed chronology.

`localParticipationBothDirections` reports inferred participation. `reciprocalTargetedCommands` reports targeted commands in both directions. The compatibility field `mutualHostileEvidence` now requires those targeted directions; local overlap alone cannot set it. None of these names proves a returned weapon attack, damage or emotional hostility. Future Relationship reciprocity rules must select their own appropriate qualifying facets.

An engagement Battle promotion remains metadata on its source Skirmish, not another deed. Pair membership requires actual attributed edges; multiplayer presence alone creates no all-to-all history.

A local contest attaches to exactly one same-pair raid root when pair-specific strong command evidence is shared. Targeted ORDER, attack-move and attack-ground may link; generic MOVE/contact observations cannot. A contest linking several raid roots remains unresolved and cannot bridge them into one giant deed. Temporal overlap alone never merges independent incidents.

## Allied support

Reinforcement and defensive assistance retain helper → recipient direction. A received copy is a duplicate observation of that direction, not returned assistance.

Engagement V4 adds helper contribution source IDs, parent sources, base seed and class uncertainty to defensive-assistance evidence. This describes contribution inside the defended player's TC-base geometry, not rescue, prevented losses or direct attacks against every opposing participant.

Support requires qualified fixed-alliance context. Explicit unlocked diplomacy is pending even when the lobby starts with teams. Unknown effective stance does not qualify support. Existing TC geometry and reinforcement episode thresholds are retained.

The projection does not invent continuity between reinforcement and defense merely because their intervals are nearby. Distinct source phases remain separate unless a later independently qualified continuity model supports joining them.

## Shared offensive participation

Engagement V4 emits one target-specific group per local clash. If A/B engage X and B/C engage Y, groups remain A/B→X and B/C→Y; no A/C cooperative relationship is manufactured.

Every social pair requires two actual contributor command sources, the exact common opponent, qualified fixed alliance and target-specific interaction evidence. Source participant copies are deduplicated. The hyperedge can project several allied pairs only when those exact allies share the same target.

These are offensive command participation facts, not evidence of communication, strategic planning or reciprocal aid.

## Relics

Map Presence V8 preserves V7 geometry and replaces its touch-as-holding proxy. Known initial relic targeting commands retain actor, object instance, source ID, timestamp and ordinal. Repeated/reordered copies do not multiply the commands.

Legacy possession, theft, loss and allied-transfer fields remain null, with explicit unavailable outcome coverage. Transfer evidence is empty. Targeting by another player never creates a fabricated player-directed theft deed or proves a contest with the previous toucher.

V4–V7 remain historical modules for reproducibility. New statistics use V8. A stronger relic-taking claim requires independently qualified pickup/possession/transfer evidence.

## Coverage and unavailable meaning

Coverage is directed, Game-revision-scoped and family-specific:

- `QUALIFIED`: the supported positive command-episode projection is available;
- `NOT_APPLICABLE`: the fixed topology excludes this family for this pair;
- `UNAVAILABLE`: missing, unsupported or unqualified evidence.

Every current coverage record declares `POSITIVE_EPISODES_ONLY` and `absenceQualified: false`. This deliberately separates reportable positive evidence from adequate negative evidence. A supported family cannot qualify another family. A known incident may be retained while broad family completeness remains unavailable.

Dynamic diplomacy leaves relation context UNKNOWN, including useful directed targeting/pressure observations. Static team-based source detectors are partial in this setting; their empty output never proves no interaction. This slice does not reconstruct effective stance.

Spatial encroachment, relic outcomes, tribute, effective diplomacy and cooperation opportunity remain unavailable. First base contact does not prove arrival or sustained pressure. Forward placement is not completion or intended victim.

No observed help is not qualified non-cooperation. Current sources do not establish reachable military capacity, freedom to act or awareness. Opportunity records remain empty. There are no non-cooperation/absence deeds, no Hostility created from zero, and no shared absence contribution to reciprocity.

## Boundaries and verification

Relationship points/stages, Reputation, War Room, Chronicle prose, Firestore persistence and player UI activation are outside this slice. The existing global-coverage/count-based Pair Encounter interface is not an acceptable direct adapter for this projection.

Tests cover micro-event inflation, duplicate copies, input ordering, corrected source revisions, pair attribution, controller chronology, positive-versus-absence coverage, target-specific groups, helper direction, fixed/asymmetric teams, 1v1 and FFA, relic outcome gating and replay-free projection.

Remote GitHub Actions runs the full replay-tools suite and repository CI. Test outcomes belong to the pull request; this document does not certify an unexecuted check.

Next: review the emitted ledger against representative real retained evidence, then design a successor Pair Encounter adapter with family coverage and ordered deeds. Numeric relationship rules remain unconfigured.

## Contextual interpretation handoff

[Contextual Social Deeds V1](contextual-social-deeds-v1.md) records the approved qualification matrix and staged successor work: before/during/after context, action versus contribution direction, pressure/response sequences, coalition entry circumstances, league stakes, activity annotations and gated Treachery king-elimination escalation. It is a design contract, not an implemented extension of this projection. Completed statistics and current unavailable-family gates remain unchanged.
