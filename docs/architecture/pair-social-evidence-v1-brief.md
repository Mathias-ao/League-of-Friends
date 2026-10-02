# Age of Friends — Pair Social Evidence V1 Starting Brief

Status: implementation-start brief for `feat/pair-social-evidence-v1`.

Base commit: `c3799d2ee8e57ea162274009e3c084872d249d24` (PR #63 merged into `main`).

This document is the current workstream handoff for Pair Social Evidence. Where older project documents disagree with the decisions below, this brief governs this workstream until the broader documents are reconciled.

## Product purpose

Pair Social Evidence is the neutral bridge between Battle Statistics and emergent player Relationships.

The players and their games must drive Rivalry, Hostility and Bond. The system must not manufacture drama, infer motive, or allow an administrator-authored Event Chronicle to affect pair relationships.

The player Relationship Chronicle is automatic historical memory derived from evidence. The league/Event Chronicle is a separate manually authored editorial surface and is out of scope here.

Intended flow:

```text
CanonicalReplay
  -> Battle Statistics
  -> AOF_PAIR_SOCIAL_EVIDENCE_V1
      -> Pair Encounter / Pair History
      -> Relationship Pulse interpretation
      -> Rivalry / Hostility / Bond
      -> automatic Player Relationship Chronicle

Manual Event Chronicle ---------------------------------> separate editorial history
```

Pair Social Evidence must remain neutral. It reports qualified interpersonal facts/episodes. It does not award relationship points and does not write dramatic prose.

## Non-negotiable evidence boundaries

1. Missing or ambiguous evidence is `UNAVAILABLE`/unknown, never zero and never interpreted as absence of interaction.
2. Commands are not outcomes. Do not claim damage, kills, success, rescue, refusal, motive or intent without separately qualified evidence.
3. Social evidence is directional where the underlying fact is directional.
4. Raw event counts are retained for provenance, but Relationship progression must consume deduplicated semantic episodes/deeds rather than every micro-event.
5. A Battle-wide `ALLY/OPPONENT/MIXED` label is not longitudinal authority, especially for FFA/dynamic diplomacy.
6. Every social episode must retain source provenance sufficient to answer: "Why did AoF say this happened?"
7. Do not activate numeric Relationship scoring in this workstream.
8. Do not add runtime LLM narration or any paid API dependency.

## Current system foundation on `main`

### Relationship system

`functions/src/engines/relationshipEngine.ts` contains the merged V2 relationship foundation:

- `AOF_PAIR_HISTORY_V2`
- `AOF_PAIR_ENCOUNTER_V1`
- `AOF_RELATIONSHIP_ENGINE_V2`
- Rivalry / Hostility / Bond
- directional hidden progress
- stage 3+ reciprocity invariant
- event-driven Rivalry/Hostility dormancy
- Bond persistence
- deterministic Relationship Chronicle presentation
- production rule set intentionally unconfigured

`functions/src/engines/reputationEngine.ts` is a separate sibling system. Player Reputation is Gallantry / Cruelty / Chivalry. Reputation balances must never feed Relationship balances and vice versa.

### Diplomacy foundation

PR #63 merged:

- `AOF_DIPLOMACY_TIMELINE_V1`
- `AOF_DIPLOMACY_ACTION_MODE_MAP_V1`
- `AOF_DIPLOMACY_EVIDENCE_ADAPTER_V1`

Important: current canonical runtime diplomacy events are `COMMAND_ONLY`. A recorded diplomacy command is not yet qualified as an effective stance transition.

Current CanonicalReplay also leaves normalized `initialDiplomacy` empty while retaining raw header diplomacy separately. Therefore dynamic-diplomacy meaning is not yet qualified for Relationship use.

See `docs/architecture/chronicle-diplomacy-foundation-v1.md` and `replay-tools/tests/CONTROLLED-FIXTURES.md`.

## Workstream scope

The immediate goal is to define and validate `AOF_PAIR_SOCIAL_EVIDENCE_V1` from already-qualified Battle Statistics evidence.

Do not begin by wiring Relationship points. Begin with the evidence contract.

The first implementation should answer:

- What happened between player A and player B?
- In what direction?
- When did it happen?
- Which Battle-statistics evidence proves it?
- Which evidence family/coverage qualifies the claim?
- Was it one raw observation or a deduplicated semantic episode?
- Was there a real opportunity for cooperation/non-cooperation where absence is considered?

## Candidate neutral evidence families

These are candidates, not permission to emit them automatically. Each must be audited against the current statistics implementation before being marked qualified.

### Opposition / pressure

- direct contest / direct engagement
- raid pressure directed at another player
- forward building / forward encroachment toward another player
- forward economic presence toward another player
- enemy-base contact
- repeated pressure windows / target focus where coverage and target attribution are qualified

### Cooperation

- reinforcement
- defensive assistance
- cooperative attack
- other material support only where direction, timing and recipient are qualified

### Economic / diplomatic facts

- directed tribute episodes, preserving recipient, timing and resource composition where available
- diplomacy commands as command observations only until effective-state semantics are qualified

### Third-party context

FFA and team games may need an episode involving A, B and target C when A and B pressure the same third player during an overlapping window.

This must distinguish:

- coincident pressure;
- qualified cooperation;
- effective alliance context where independently qualified.

Shared targeting alone must not become "cooperation".

## Evidence that must remain gated

### Dynamic diplomacy

Do not use `COMMAND_ONLY` diplomacy events to classify another action as allied/hostile.

A controlled unlocked-diplomacy fixture must qualify effective initial-state normalization and runtime transitions before dynamic diplomacy can drive Relationship meaning.

The existing 8-player `townbell-ffa-save68` fixture is useful for structural/order regression but is explicitly not a controlled semantics fixture.

### Relics

The current Relationship signal vocabulary contains `RELIC_THEFT`, but existing map/replay evidence does not automatically prove a successful theft merely from relic targeting/touch/contact.

Do not emit `RELIC_THEFT` until the source model proves the required outcome. Prefer a weaker neutral concept such as `RELIC_CONTEST`/`RELIC_TARGETING` only if its exact evidence is qualified and useful.

### Chat

Raw chat may be retained by replay extraction, but Pair Social Evidence V1 must not interpret chat text, sentiment, promises, threats or intent.

## Coverage must be family-specific

Do not repeat the old single global `interactionCoverage` assumption in the new evidence contract.

The design should support at least conceptually separate coverage such as:

```text
oppositionInteractionCoverage
alliedCooperationCoverage
economicTransferCoverage
diplomacyCoverage
spatialPressureCoverage
```

Use values equivalent to:

```text
QUALIFIED
NOT_APPLICABLE
UNAVAILABLE
```

The exact contract may refine these names after auditing the statistics models.

Absence-based social meaning additionally requires an explicit `interactionOpportunity` concept where relevant.

## Allied non-cooperation: current product decision

Older Social Systems V2 text/code allows qualified allied non-cooperation to strengthen Hostility even from zero. Do not treat that as final product policy.

Current AoF direction is stricter:

- allied assignment alone never creates Bond;
- mere ally assignment does not cool Hostility;
- qualified cooperation may strengthen Bond and cool Hostility;
- qualified non-cooperation requires adequate cooperation coverage **and genuine opportunity**;
- qualified allied non-cooperation must **not create Hostility from zero**;
- it may worsen already-existing Hostility when the later Relationship adapter is designed;
- shared non-cooperation never satisfies directional reciprocity.

Pair Social Evidence should report the neutral opportunity/non-cooperation fact where supportable. Whether it changes Hostility belongs to the Relationship interpretation layer.

## Established Bond antagonism

Current product direction requires stronger damage against an established Bond to depend on the Bond state that existed **before the Battle**, not a threshold crossed earlier inside the same Battle.

Pair Social Evidence should not implement this modifier. It must preserve chronology/provenance so the later Relationship adapter can evaluate the correct pre-Battle snapshot.

## Semantic episodes, not micro-event farming

The evidence layer must separate raw observations from semantic episodes.

Example: three raid candidates, two engagement windows and several enemy-base contacts may describe one sustained pressure episode rather than six independent Hostility contributions.

Required properties for episode design:

- deterministic grouping;
- source evidence ids retained;
- explicit start/end replay moments where available;
- direction retained;
- no hidden scoring;
- stable rebuild behavior;
- conservative deduplication across overlapping statistics families;
- no easy farming by issuing repeated low-value commands.

Do not choose arbitrary production thresholds merely to finish the implementation. Where a threshold is required for an existing qualified statistic, reuse that statistic's versioned semantics rather than inventing a social-only duplicate.

## FFA requirements

FFA is a first-class design target because it contains the highest potential relationship drama, but uncertainty must remain explicit.

Pair Social Evidence V1 should be able to retain useful neutral facts from FFA even before dynamic diplomacy is fully qualified, for example directed pressure, tribute, engagement and third-party convergence where those facts are independently supported.

It must not call those facts alliance, betrayal, friendship, treachery or cooperation solely from unqualified diplomacy commands.

When effective diplomacy becomes qualified later, social episodes must query stance at the full replay moment:

```text
{ atMs, operationOrdinal }
```

Milliseconds alone are insufficient.

## Relationship Chronicle boundary

This workstream supplies facts for the automatic **player Relationship Chronicle**.

It does not build the final Chronicle Story Engine phrase library yet.

The future writer should be able to consume semantic episodes plus prior pair history and relationship transitions. Therefore Pair Social Evidence must preserve sufficient chronology and source provenance for later factual callbacks.

The manually authored Event Chronicle is explicitly outside this automatic pipeline and must not create Relationship evidence.

## First implementation sequence

A stronger implementation model should proceed in this order:

1. Audit the current Battle Statistics outputs and evidence/provenance for every candidate social family. Do not assume the old signal vocabulary is fully qualified.
2. Write the `AOF_PAIR_SOCIAL_EVIDENCE_V1` contract before production integration.
3. Define family-specific coverage and opportunity semantics.
4. Define deterministic semantic episode grouping/deduplication.
5. Implement adapters only for evidence families that pass the audit.
6. Add adversarial unit tests for directionality, overlapping evidence, missing coverage, opportunity, duplicate/micro-event farming and third-party context.
7. Test fixed-team, asymmetric-team, 1v1 and FFA inputs. FFA dynamic diplomacy remains gated where effective stance is unknown.
8. Only after the evidence layer is accepted, design the adapter into Pair Encounter/Relationship pulses.

## Explicit non-goals for the first PR

Do not include merely to make the feature look complete:

- Relationship point values, caps or stage thresholds;
- production activation of Rivalry / Hostility / Bond progression;
- Chronicle Story Engine prose or a large phrase library;
- Event Chronicle automation;
- War Room unlocking;
- Reputation scoring changes;
- Firestore/UI integration unless required solely to test the evidence contract;
- guesses that convert unavailable coverage into zero;
- effective diplomacy derived from command-only evidence.

## Required review questions before integration

Before Pair Social Evidence is allowed to feed Relationships, reviewers should be able to answer yes to all of these:

1. Can every emitted episode be traced to versioned Battle Statistics or canonical evidence?
2. Can unknown/missing evidence ever become "nothing happened" by accident?
3. Are direction and target ownership preserved?
4. Are overlapping statistics prevented from multiplying one human-scale deed into several relationship contributions?
5. Is allied non-cooperation impossible without qualified opportunity evidence?
6. Is dynamic diplomacy kept unavailable unless effective stance is independently qualified?
7. Can FFA third-party convergence remain neutral when cooperation is not proven?
8. Does the layer remain useful while Relationship scoring stays unconfigured?
9. Can rebuilding the same evidence reproduce the same episodes exactly?
10. Does the contract give the future automatic Relationship Chronicle enough factual chronology without embedding prose or motive?

If any answer is no, do not compensate in the Relationship or Chronicle layer. Fix the evidence contract first.
