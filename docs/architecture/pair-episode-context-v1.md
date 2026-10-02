# Age of Friends — Pair Episode Context V1

Status: implemented on `feat/pair-social-evidence-v1`; no scoring or production relationship integration.
Model: `AOF_PAIR_EPISODE_CONTEXT_V1`.
Design: [Contextual Social Deeds V1](contextual-social-deeds-v1.md).

## Placement and invariants

`pair_episode_context.py` is a pure additive projection over Pair Social Evidence V1, Raid V3, Engagement V4, Execution V2 and canonical ACTION chronology. `statistics_projector.py` attaches its result as `pairSocialEvidence.episodeContext`. It does not parse recordings, alter a detector, change statistics schema bytes/digest, modify neutral incidents/deeds, or create new deeds.

The existing schema permits additive properties inside the social object. Context has its own model version and content-derived identities scoped to canonical revision. All existing statistics fields, neutral ledger identities and counts remain unchanged. Inputs are not mutated. Missing sources and chronology yield diagnostics rather than invented links. Conflicting canonical identities fail closed.

The result contains `annotations`, `sequences`, directed family `coverage`, `diagnostics`, provenance and an inactive interpretation `policy`. Context IDs hash the model, Game revision and qualified semantic record. Reordered/duplicate source copies do not multiply output. Corrected source revisions produce replacement identities.

## Pressure and response

A PRESSURE_RESPONSE annotation resolves an existing Execution V2 response row to exactly one supported Raid V3 incident using attacker, victim, original source episode start and exact canonical source-event set.

Response actor, command, timestamp, recorded latency and the source-defined maximum window must agree. The full response moment must follow or coincide with the first recorded pressure command; an earlier same-millisecond ordinal does not qualify. A response event matching several pressure incidents is ambiguous and receives no unique annotation.

This retains the Execution detector's definition. Its response commands include positional and non-targeted control observations; the source detector does not prove deliberate response, causality, returned targeting or damage. The preserved latency is a timestamp difference, not measured human reaction time. No response record is not evidence of failure to respond. Current episode-start matching may conservatively miss ambiguous source windows.

## Defensive support with pressure

A DEFENSIVE_SUPPORT_WITH_PRESSURE annotation preserves helper → defended player and pressure actor → defended player separately.

Require an existing fixed-alliance defensive-participation incident, supported Engagement V4 assistance record, qualified parent command provenance, and the exact attacker/defended LOCAL_CONTEST in the pressure deed referring to that same source Skirmish. At least one pressure source command belongs to the parent; the helper's command sources belong to that parent; assistance cannot end before pressure begins in full replay order.

This describes participation in the same inferred defensive clash. It does not establish continuous pressure, direct helper attacks against the pressure actor, rescue, prevented losses or communication. Enemy participant lists alone do not supply attribution. Reinforcement alone or nearby windows do not qualify and are not merged with defence.

Each threat relation preserves its exact pair. One support deed may have several defensible threat annotations without becoming several support deeds. Support-family coverage requires separately qualified pressure/contest-family context for an opposing player; positive context records and family completeness remain separate.

## Ordered return pressure

RETURN_PRESSURE links the next independent reverse-direction pressure episode within this recorded Game. Preserve both incident/deed IDs and both action directions.

The immediately preceding pressure episode for this exact pair must have the reverse direction, unique chronological position and a completed command-evidence window before the next starts. Older still-overlapping pair episodes, same-start ambiguity, shared sources, same deed, unresolved independence or unavailable chronology block the link. Missing chronology anywhere in the pair's pressure history blocks claims of a next ordered episode.

This is not proof of revenge, a retaliatory decision, successful raids or reciprocal weapon attacks. Unknown dynamic alignment stays UNKNOWN; an ordered positive fact may remain while family coverage is unavailable. There is no cross-Game or cross-Battle chronology in this slice.

## Coverage and boundaries

Families: PRESSURE_RESPONSE, DEFENSIVE_SUPPORT_WITH_PRESSURE, RETURN_PRESSURE. Coverage is directed and declares POSITIVE_CONTEXT_ONLY, `absenceQualified: false` and `contextCompletenessEstablished: false`. QUALIFIED means the supported positive context projection is available, not that every interaction was detected or every source chronology is complete. Missing required source versions remain UNAVAILABLE; fixed topology may make a family NOT_APPLICABLE.

PRESSURE_RESPONSE direction identifies the pressure actor → recipient, while the response actor is explicit. Support coverage identifies helper → recipient. Return-pressure coverage requires the pressure source family in both directions. Neither record creates contributionDirection or scoring: that belongs to separately configured interpretation rules.

Reputation, Relationship stages, Treachery escalation, score/standings/APM interpretation, deliberate non-cooperation, Chronicle prose, persistence and UI activation remain inactive. The [qualification matrix](contextual-social-deeds-v1.md) governs later slices.

## Verification

Tests cover response actor/attacker provenance, recorded window/latency, same-millisecond ordinal ordering, ambiguous multi-attacker responses, exact defensive-clash attribution, missing parent sources, reinforcement exclusion, family-specific coverage, independent returns, overlap/intervening episodes, unknown alignment, unresolved independence, input immutability, duplicate/reordered copies, corrected revisions and conflicting event identities.

The projector integration test removes only `episodeContext` and compares the entire remaining envelope with context disabled. Existing controlled statistics goldens remain unchanged. This proves additive output for that fixture; representative real replay validation remains required and test results must be read from the exact commit's CI.

## Retained real recordings

[The real-recording review](real-social-context-audit-v1.md) records a 14-recording corpus audit, including pressure/response, ordered return pressure, fixed-allied support and exact-target shared participation. It documents the edition-specific team-lock normalization correction and the remaining FFA/static-alignment gap. Recorded context is validated without scoring; lack of context rows is not absence evidence. Selected-unit class gaps, source raid onset versus command envelope, non-causal response associations and repeated perspectives remain explicit interpretation limits.
