# Age of Friends — Chronicle Diplomacy Foundation V1

Status: isolated semantic foundation. This document does not activate Chronicle Story Engine prose, relationship scoring, upload persistence, or player-facing behavior.

## Purpose

AoF needs a trustworthy temporal diplomacy model before FFA and unlocked-diplomacy Battles can contribute to Relationship or Chronicle interpretation.

The central rule is:

> Diplomacy is a directed state at a replay moment, not a Battle-wide team label.

A replay moment is ordered by both game-clock milliseconds and canonical `operationOrdinal`. Two actions can share the same millisecond and still occur in a meaningful order.

## Scope of this slice

Implemented contracts:

- `AOF_DIPLOMACY_TIMELINE_V1`
- `AOF_DIPLOMACY_ACTION_MODE_MAP_V1`
- `AOF_DIPLOMACY_EVIDENCE_ADAPTER_V1`

This slice deliberately does **not** implement:

- Pair Social Evidence;
- Chronicle Events;
- sentence fragments or Chronicle Writer;
- Relationship pulses or configured scoring;
- Firestore persistence;
- replay-upload integration;
- player-facing UI changes.

Those layers must consume this foundation only after its semantics are validated.

## Source boundary

The adapter consumes canonical normalized initial diplomacy plus canonical diplomacy-change replay events.

Canonical initial stances are accepted as `ally`, `neutral`, `enemy`, or unknown. Missing or unrecognized directed initial edges remain `UNKNOWN`.

V1 does not fall back to an independently interpreted raw header matrix. If canonical initial diplomacy is absent, this layer reports unavailable coverage rather than silently switching evidence domains.

Runtime diplomacy changes preserve:

- actor;
- target;
- game-clock timestamp;
- operation ordinal;
- raw diplomacy mode;
- raw command id;
- canonical source version.

The runtime stance mapping is separately versioned. AoE2 diplomacy action modes are interpreted as:

- `0` → Ally
- `1` → Neutral
- `3` → Enemy
- every other value → Unknown

Unknown runtime values invalidate the affected directed stance from that replay moment until later qualified evidence changes it again.

## Directed pair states

For players A and B, AoF preserves A→B and B→A independently.

The pair classification is:

- `MUTUAL_ALLIANCE`: Ally / Ally
- `MUTUAL_HOSTILITY`: Enemy / Enemy
- `MUTUAL_NEUTRALITY`: Neutral / Neutral
- `ONE_SIDED_ALLIANCE`: one direction Ally and the other Neutral
- `ONE_SIDED_HOSTILITY`: one direction Enemy and the other Neutral
- `CONFLICTED`: Ally / Enemy in either direction
- `UNKNOWN`: either directed stance unavailable

One-sided and conflicted states must never be narrated later as mutual alliance or mutual hostility.

## Replay chronology invariant

`timestampMs` alone is insufficient.

For example:

```text
42:00.000 ordinal 500  A changes B to Ally
42:00.000 ordinal 501  A issues another social/combat-relevant action
```

The second event sees A→B as Ally.

An event at the same timestamp with ordinal 499 does not.

Every future social-evidence adapter must therefore query diplomacy with the event's full replay moment `{ atMs, operationOrdinal }`.

If a diplomacy event lacks actor, target, timestamp, or operation ordinal, the adapter fails rather than inventing chronology.

If two diplomacy changes for the same directed edge occupy the same replay moment, V1 treats that chronology as ambiguous and fails closed.

## Temporal segments

The timeline retains pair segments bounded by full replay moments. A segment may have `elapsedMs === 0` while still spanning distinct operation ordinals at the same game-clock timestamp.

Such a segment is not discarded: another replay action can occur between those two ordinals and must observe the correct stance.

Segments are an evidence view, not a Battle-wide label.

## Explicitly rejected Battle-wide alignment summary

The failed Chronicle branches introduced a derived Battle alignment such as `ALLIANCE`, `HOSTILITY`, or `MIXED` and then used that single value for longitudinal history counts.

That is not an adequate AoF historical primitive for FFA.

A Battle can contain all of the following in order:

1. mutual hostility;
2. a one-sided diplomatic change;
3. mutual alliance;
4. an alliance rupture;
5. renewed mutual hostility.

Collapsing that history to `MIXED` causes later Chronicle logic to forget that the pair both allied and opposed one another in the same Battle. It also encourages semantic leakage such as treating one-sided hostility as mutual hostility.

Future Chronicle history must instead retain independent historical facts such as:

- whether mutual alliance occurred;
- whether mutual hostility occurred;
- number and timing of alliance formations/endings;
- duration of qualified states where meaningful;
- ordered social beats;
- exact previous meaningful state transitions.

A presentation layer may eventually derive a compact label for UI convenience, but such a label must not become the historical authority.

## Coverage

Coverage is pair-state-local:

- `QUALIFIED` only when both directed stances are known for that segment;
- `UNAVAILABLE` if either direction is unknown.

Missing evidence is never Neutral, Enemy, Ally, or absence of interaction.

## Relationship and Chronicle consequences

This foundation intentionally makes no Relationship or Chronicle decision.

Later layers may use exact diplomacy-at-event-time to decide whether a separately qualified interaction occurred while players were allied, hostile, neutral, conflicted, or unknown.

This separation is required so that:

- coincident third-party pressure is not automatically cooperation;
- an attack after an alliance change is not classified using the Battle's opening stance;
- one-sided alliance is not called friendship;
- one-sided hostility is not called mutual war;
- unknown coverage never creates social meaning.

## Validation gate before the next layer

Before Pair Social Evidence is implemented, this foundation should satisfy all of the following:

1. TypeScript build passes on current `main`.
2. Existing Functions tests remain green.
3. Dedicated tests cover mutual, asymmetric, conflicted, neutral, and unknown states.
4. Dedicated tests prove same-millisecond ordinal ordering.
5. Missing initial diplomacy remains unavailable.
6. Unsupported runtime modes remain unknown.
7. No upload, persistence, Relationship, Chronicle Writer, or UI integration is introduced merely to make this layer appear live.
8. Real replay/corpus validation is performed before dynamic FFA relationship effects are activated.

Only after this gate should AoF add `AOF_PAIR_SOCIAL_EVIDENCE_V1` on top of the diplomacy timeline.
