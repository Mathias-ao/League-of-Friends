# Age of Friends — Chronicle Diplomacy Foundation V1

Status: isolated semantic foundation. This document does not activate Chronicle Story Engine prose, Relationship scoring, replay-upload persistence, or player-facing behavior.

## Purpose

AoF needs a trustworthy temporal diplomacy model before FFA and unlocked-diplomacy Battles can contribute to Relationship or Chronicle interpretation.

The central rules are:

> Diplomacy is directed and temporal, not a Battle-wide team label.

> A recorded diplomacy command is not automatically proof that the effective diplomacy state changed.

Both rules are required for AoF's evidence boundary.

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

## Current production-evidence state

The CanonicalReplay schema contains an `initialDiplomacy` field, but the current exporter does not populate it. `replay-tools/parse_replay.py` retains per-player header diplomacy as `initialDiplomacyRaw` and currently writes:

```text
initialDiplomacy: []
```

The extraction coverage also deliberately treats runtime diplomacy as directed command evidence rather than qualified effective state. The existing controlled-fixture plan in `replay-tools/tests/CONTROLLED-FIXTURES.md` explicitly requires an unlocked-team experiment in which one player changes stance unilaterally, the other later responds, and the first reverses. It requires command order/raw modes to be checked separately from effective diplomacy/UI behavior.

Therefore this foundation must remain inactive for effective FFA relationship interpretation until that evidence gap is closed.

## Source boundary

### Initial state

`InitialDiplomacyEdge` represents a **qualified effective initial state**. Raw header vectors do not enter the timeline directly.

The canonical adapter consumes only normalized canonical `initialDiplomacy` edges. If canonical initial diplomacy is absent or partial, the corresponding directed stance remains `UNKNOWN`.

V1 does not silently fall back to `initialDiplomacyRaw`.

The pinned `mgz-fast` parser does retain a per-player integer diplomacy vector. Upstream parser structure identifies this as the player's `my_diplomacy` vector and distinguishes it from a separate `their_diplomacy` byte vector. This is useful reverse-engineering evidence, but AoF does not promote those raw values into canonical effective state without fixture qualification.

### Runtime commands

Canonical `command.diplomacy_change` events retain:

- actor;
- target;
- game-clock timestamp;
- operation ordinal;
- raw diplomacy mode;
- raw command id;
- canonical source version.

The action payload mapping is separately versioned:

- raw mode `0` → commanded Ally;
- raw mode `1` → commanded Neutral;
- raw mode `3` → commanded Enemy;
- every other value → commanded Unknown.

This maps the **command payload**, not its successful effect.

Every runtime diplomacy event carries one of two effect qualifications:

- `COMMAND_ONLY` — the command was observed, but no effective state transition may be inferred;
- `EFFECTIVE_STATE_QUALIFIED` — an independently qualified adapter is allowed to apply the commanded stance to effective state.

The current canonical adapter always emits `COMMAND_ONLY`.

A command with an unknown raw mode can never be promoted to `EFFECTIVE_STATE_QUALIFIED`; the timeline fails closed instead of inventing the result.

## Directed pair states

For players A and B, AoF preserves A→B and B→A independently.

Once both effective directed stances are qualified, the pair classification is:

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
42:00.000 ordinal 500  A issues a qualified effective change to Ally toward B
42:00.000 ordinal 501  A issues another social/combat-relevant action
```

The second event sees A→B as Ally.

An event at the same timestamp with ordinal 499 does not.

Every future social-evidence adapter must therefore query diplomacy with the event's full replay moment `{ atMs, operationOrdinal }`.

If a diplomacy event lacks actor, target, timestamp, or operation ordinal, the canonical adapter fails rather than inventing chronology.

If two diplomacy changes for the same directed edge occupy the same replay moment, V1 treats that chronology as ambiguous and fails closed.

## Temporal segments

The timeline retains pair segments bounded by full replay moments. A segment may have `elapsedMs === 0` while still spanning distinct operation ordinals at the same game-clock timestamp.

Such a segment is not discarded: another replay action can occur between those two ordinals and must observe the correct effective stance.

`COMMAND_ONLY` events do not create effective-state segment boundaries.

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

Effective pair coverage is:

- `QUALIFIED` only when both directed effective stances are known for that segment;
- `UNAVAILABLE` if either direction is unknown.

A decoded command does not improve effective-state coverage by itself.

Missing evidence is never Neutral, Enemy, Ally, or absence of interaction.

## Existing FFA corpus evidence

The committed `townbell-ffa-save68` fixture is structurally valuable:

- 8 players;
- 86 recorded diplomacy commands;
- many directed stance-command sequences;
- exact operation ordinals retained.

But its corpus classification is `real_game_regression_not_controlled`. It can validate decoding shape, ordering, actor/target domains and stability; it cannot by itself prove effective stance semantics.

The controlled fixture described in `replay-tools/tests/CONTROLLED-FIXTURES.md` remains the qualification gate for promoting command evidence to effective-state evidence.

## Relationship and Chronicle consequences

This foundation intentionally makes no Relationship or Chronicle decision.

Later layers may use exact effective diplomacy-at-event-time only where qualified. Until then, separately qualified combat, tribute or spatial evidence can still be retained as facts without assigning unsupported ally/enemy meaning.

This separation prevents:

- coincident third-party pressure from automatically becoming cooperation;
- an attack after a diplomacy command from being classified under an unproven stance;
- one-sided alliance from being called friendship;
- one-sided hostility from being called mutual war;
- command intent from being presented as successful state change;
- unknown coverage from creating social meaning.

## Validation gate before the next layer

Before `AOF_PAIR_SOCIAL_EVIDENCE_V1` uses dynamic diplomacy as effective relationship context, all of the following should hold:

1. TypeScript build passes on current `main`.
2. Existing Functions and Player Website tests remain green.
3. Dedicated tests cover mutual, asymmetric, conflicted, neutral, and unknown states.
4. Dedicated tests prove same-millisecond ordinal ordering.
5. Dedicated tests prove `COMMAND_ONLY` cannot mutate effective state.
6. Missing canonical initial diplomacy remains unavailable.
7. Unsupported runtime modes remain command observations and cannot be promoted to qualified effects.
8. The current real FFA regression remains structurally stable.
9. A controlled unlocked-diplomacy fixture qualifies initial-state normalization and effective runtime transitions for the supported build/save/data tuple.
10. No upload, persistence, Relationship, Chronicle Writer, or UI integration is introduced merely to make this layer appear live.

Only after this gate should AoF let dynamic diplomacy drive Pair Social Evidence or Chronicle relationship meaning.
