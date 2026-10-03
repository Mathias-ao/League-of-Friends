# Pair Social Evidence V1 — Episode Design Proposal

Status: proposed design for owner review; no implementation or production activation.
Reviewed: 2 October 2026.
Audited baseline: main at c3799d2ee8e57ea162274009e3c084872d249d24.
Companion: [starting brief](pair-social-evidence-v1-brief.md).
Authority: [Core Identity](../project/CORE-IDENTITY.md), current explicit owner decisions, then the starting brief for this workstream.

## Recommended next move

Build a pure, replay-free evidence projection and a reviewable episode ledger before integrating Pair Encounter or Relationship pulses. The initial deliverable is a contract, audited family adapters, and adversarial fixtures. It should answer what was observed between people without assigning points, relationship stages, motives, outcomes, or Chronicle prose.

The design has three levels:

1. Source observations: immutable references to qualified statistics evidence.
2. Incidents: the existing versioned Raid, Skirmish, engagement and reinforcement windows, with pair-specific attribution.
3. Deeds: deduplicated records of interpersonal action, retaining all supporting incidents and facets.

A raid, a Skirmish, its Battle promotion, and a base-contact observation can describe one deed. They must not automatically become four independently consumable contributions. A deed can have raid-pressure, direct-contest and base-context facets without multiplying the act.

Technical engagement battleId identifies a local clash. League matchId identifies the player-facing Battle and may contain several Games. Keep these namespaces distinct.

## What the current code actually supports

This is a source audit, not a claim that every family has passed product acceptance.

| Family | Available source | Safe use and remaining gate |
|---|---|---|
| Raid pressure | raid_detector.py: attacker, victim, timestamps, sourceEventIds, attribution methods; existing 60-second grouping | Candidate directed inferred economy-pressure incident. No damage, kills or successful raid claim. Preserve geometric versus controlled-target attribution. |
| Direct contest | skirmish_detector.py: directed edges, methods, source IDs; engagement_statistics.py: sourceSkirmishId and classified contributors | Candidate local contest. Separate targeted controlled-object commands from local opposition overlap. Battle promotion is a facet of its Skirmish, not another deed. |
| Reinforcement | engagement_statistics.py: helper, recipient, source IDs, base seed, class footprint, existing 60-second grouping | Candidate inferred support command episode in the recipient's TC-base geometry. No unit arrival or rescue claim. Unknown classes remain unknown. |
| Defensive assistance | engagement_statistics.py: helper, defended player, local battleId and contribution time | Candidate base-defense participation. Resolve parent engagement provenance; do not upgrade participation into a claim that the helper defeated or directly attacked every enemy. |
| Cooperative attack | engagement_statistics.py: shared-opponent pair evidence and local battleId | Candidate fixed-alliance offensive co-participation. Reconstruct target-specific participant groups from the parent pair evidence; the flattened summary is insufficient. No communication or planned coordination claim. |
| Forward placements / Forward Eco | map_presence_v4.py and forward_eco.py: placement IDs, coordinates, selected enemy reference, geometry | Retain geometric placement observations. BUILD is not completion. The maximum-progress opponent is a geometric reference, not proof of intended victim. Independent encroachment deed grouping remains unqualified. |
| Enemy-base contact | map_presence_v2.py inherited by active Map Presence: firstByEnemy | Context only: first command coordinate near a starting TC. Does not prove arrival, hostility, repeated visits or sustained pressure. |
| Relics | map_presence_v4.py: relic-target command evidence and inferred holder transfers | Retain relic targeting observations where useful. Do not emit RELIC_THEFT or a taking outcome. Consecutive commands from different players do not prove prior possession or contest. |
| Non-cooperation / opposed non-contact | No sufficient family-specific opportunity/completeness contract identified in audited outputs | Keep unavailable for absence-based meaning. A zero positive detector count is insufficient. |
| Dynamic diplomacy | diplomacy timeline and canonical adapter | Preserve COMMAND_ONLY observations. Effective stance and diplomacy changes remain gated by controlled qualification. |
| Tribute | Candidate in starting brief | Defer until its actual emitted source, recipient, resource semantics and chronology have been separately audited. |

Important implementation traps:

- Skirmish local_opposition_overlap creates both directions and can set mutualHostileEvidence. This is inferred reciprocal local participation, not proof of returned attacks. Carry evidence methods through; never use the aggregate boolean alone for Hostility reciprocity.
- Cooperative Attack flattens attackers across eligible targets. If A/B engage X and B/C engage Y, the source summary must not produce an A/C cooperative pair. Preserve target-specific hyperedges.
- Some statistics retain timestamp and event ID without operation ordinal. Retrieve the ordinal from the retained analysis evidence using the exact source event ID, or mark chronology unavailable for stance-sensitive claims. Lexical event ID order is not replay order.
- relationshipEngine.ts still accepts global interactionCoverage and count signals, and can derive ALLIED_NO_COOPERATION without opportunity. Do not plug this new projection directly into that interface.

## Episode and deed semantics

### Start with existing incident boundaries

Reuse the source detector's versioned boundaries; do not create a second social detector with a new inactivity timeout. A raid's 60-second gap and a Skirmish's 20-second / 20-tile linkage describe different models and are not interchangeable.

Each incident carries Game identity, parent source ID, pair/direction, evidence methods, source version and referenced observations. Participant membership alone is never pair evidence.

### Deduplicate by evidence identity and parentage

- Canonical source event identity is Game-scoped. Deduplicate initiated/received copies, participant copies, reimports and duplicate source IDs.
- A Battle promotion and its source Skirmish are one root incident.
- Link raid and contest facets only for the same directed pair and supported context, using pair-specific shared source observations or an explicit, audited source-parent relationship.
- Temporal overlap alone does not merge acts.
- A source's broad overlappingRaidIds list is a candidate link, not sufficient pair-specific proof.
- A weak base-contact or movement observation may annotate an incident; it may not seed pressure, join independent roots, or extend active pressure duration.
- Shared events can legitimately support different dyads in a multiplayer incident. Deduplication is not global prohibition of all event reuse.

Do not use unrestricted connected-component merging over every overlapping window. A long raid window or generic movement observation can bridge separate clashes. Keep qualified root incidents and their chronology. When several roots belong to one deed, store the explicit membership and merge reason; do not destroy their individual windows.

If linking is unresolved, retain the source incidents as observations and mark the candidate deed relationship ambiguous. Do not force extra independent deeds or one merged deed to make a number look complete.

### Preserve one evolving action

For an allied helper moving from reinforcement commands into the supported player's defensive clash, retain reinforcement and defensive-assistance phases in one support deed only when parent/evidence linkage qualifies continuity. Do not award two acts merely because the source classification changes.

Repeated source commands strengthen provenance; they do not increase deed multiplicity. Distinct selected-object count is descriptive command evidence, never a multiplier for gratitude or grudges.

A later independent incident can be another deed when the qualified source boundaries and attribution establish separation. New selection, another attack command, or another detector label is insufficient.

### Deeds can have several facets

Recommended initial deed families:

- DIRECTED_PRESSURE: qualified directed pressure incident with optional raid/contest facets.
- LOCAL_CONTEST: pair participation where reciprocal targeting is not established; directional contribution facts remain available.
- ALLIED_SUPPORT: helper-to-recipient reinforcement or defensive participation, with phases.
- SHARED_OFFENSIVE_PARTICIPATION: target-specific allied hyperedge, preserving each contributor's actual edge to the target.

Do not copy defensive assistance from A to B into B to A. Receiving help is not returned help. Shared offensive participation records what each ally contributed; it must not invent reciprocal aid merely to satisfy a relationship stage gate.

Geometric placements, relic targeting and unknown-alignment third-party convergence can remain useful observations without becoming these deed families.

Repeated direct contests are the ordered distinct incident list, not a new additive deed. Sustained pressure is a future qualified continuity claim: first-to-last span is not proof of continuous pressure. Retain active windows and gaps separately; do not turn a long envelope into pressure duration.

Episode semantics reduce micro-event inflation but cannot prove that no player deliberately spaces commands to satisfy an existing detector. Do not claim farming immunity. Separate future relationship rules must consider independence and Battle-level saturation explicitly.

## Proposed evidence contract

Each projection should retain:

- model/schema version, league matchId, gameId, season/event references;
- canonical/analysis/statistics artifact identities and versions, result revision, and replay-slot-to-durable-player mapping;
- scoped family coverage records;
- source observations and qualified incidents;
- deduplicated deeds and unresolved candidates;
- explicit opportunity records where independently qualified;
- diagnostics explaining rejection, ambiguity and unavailable families.

Each deed should retain:

- deterministic deed ID within an evidence revision;
- kind, pair ID, actor/recipient or contributing players, third-party target where applicable;
- full start/end replay moments when known;
- root incident IDs, member phases, evidence facets and merge rationale;
- source event references, models, attribution methods, geometry and class uncertainty;
- claim qualification and explicit limits.

Use Game-scoped content identities or persisted source IDs, not current list index, raid-3 or battle-7 alone. Identical evidence/version rebuilds must reproduce IDs and output. A corrected evidence revision may legitimately replace IDs and requires downstream invalidation rather than pretending the old deed survived unchanged.

Do not carry relationship points, prior Bond, winner-of-clash, intention, rescue, refusal or prose inside this contract. The later interpreter consumes pre-Battle pair state separately.

## Coverage and opportunity

Coverage is scoped to Game, pair/direction, evidence family and interval, with qualification provenance:

- QUALIFIED: adequate evidence for a specifically declared claim.
- NOT_APPLICABLE: the claim cannot apply in this approved topology.
- UNAVAILABLE: missing, ambiguous, unsupported or unqualified evidence.

Positive evidence and completeness are different. A known directed raid may remain reportable even when other opposition evidence is incomplete. A verified zero requires an adequate negative-evidence coverage contract. One qualified family must not qualify another.

An opportunity must specify the beneficiary, eligible helper, triggering episode, qualified alliance interval, response interval and the evidence establishing that the helper could meaningfully participate. Command coordinates do not establish reachable army, spare capacity or awareness. Current sources do not provide a sufficient general opportunity model.

Therefore the first slice should support the opportunity contract but emit no non-cooperation deeds from current statistics. No observed support is different from qualified opportunity without observed support.

Later qualified non-cooperation never implies refusal, never creates Hostility from zero, and never supplies directional reciprocity. Prior Hostility and pre-Battle Bond modifiers belong to the later interpreter.

## Chronology and topology

Never merge across Games. A multi-Game league Battle contains ordered Game-specific evidence; qualifying interaction in one Game does not fill coverage gaps in another.

For fixed teams, use the approved Game roster and replay identity mapping, including asymmetric teams. For unlocked diplomacy, unknown effective stance stays unknown: retain independently supported directed commands and convergence facts without importing static team hostility assumptions.

Preserve full replay moments { atMs, operationOrdinal }. When effective diplomacy is qualified later, split stance-sensitive phases at qualified transitions while retaining a common incident parent where appropriate. COMMAND_ONLY events do not create effective boundaries.

## First implementation acceptance cases

1. Five attack commands and twenty selected objects produce one existing-source incident/deed, not five or twenty.
2. Raid, Skirmish, promoted engagement and contact references to the same directed incident produce one deed with multiple facets.
3. Different targets or independent contexts remain separate despite overlapping times.
4. An eight-player encounter yields only pairs with qualified pair-specific evidence.
5. A/B versus X and B/C versus Y never manufactures A/C cooperation.
6. Receiving reinforcement does not manufacture the reverse support direction.
7. Local overlap does not become reciprocal targeted antagonism.
8. Empty signals with incomplete coverage produce unknown; qualified support-family zero without opportunity does not become non-cooperation.
9. 1v1, fixed teams, asymmetric teams, locked FFA and dynamic FFA have explicit applicability.
10. Relic targeting cannot become theft; placement cannot become a completed outpost.
11. Same-millisecond ordinal ordering is preserved; unavailable ordering cannot classify a stance-sensitive action.
12. Duplicate participant copies, reordered input and rebuilds preserve output; corrected revisions replace prior contributions.
13. Movement/contact bridging cannot merge unrelated roots or inflate active duration.
14. A multi-Game Battle preserves separate chronology and per-Game coverage.

The existing three-Battle validation harness can provide integration regression when the projection exists, but real examples need human review against replay command evidence. No implementation tests were run for this documentation-only proposal.

## Bounded delivery sequence

1. Approve the distinctions among observation, incident, deed, coverage and opportunity, with a small hand-labelled example ledger.
2. Implement a pure projection for raid/contest and fixed-alliance support/target-specific offensive participation; publish candidate diagnostics.
3. Validate overlapping and multiplayer cases before any production integration.
4. Qualify forward-placement episode grouping, relic outcomes, tribute and dynamic diplomacy independently.
5. Design a successor Pair Encounter adapter retaining family coverage and ordered deeds. Keep numeric Relationship rules unconfigured until separately approved.

A useful acceptance question is: can a player inspect each proposed deed, recognize the incident it refers to, and see exactly why AoF recorded it? If not, improve the source contract or qualification rather than compensate with weights or Chronicle language.
