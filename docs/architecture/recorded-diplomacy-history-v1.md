# Recorded diplomacy history V1

**AOF_DECLARED_DIPLOMACY_HISTORY_V1** reconstructs declarations from retained diplomacy orders. It qualifies observed command chronology, not effective engine state. Recording review advances to V2 to attach this independent history beside the existing uncertainty timeline.

## Source and episode semantics

- Every direction begins UNKNOWN. Effective normalized header edges do not seed a command declaration; these are different evidence layers.
- Canonical orders are deduplicated/validated by the existing recording adapter and sorted by timestamp plus operation ordinal.
- A first recognized order establishes that player's declaration toward its target. A later different recognized stance is a recorded declaration reversal.
- Repeating the same recognized stance supports the existing directed declaration episode; it creates no turning point or additional deed.
- Unsupported modes interrupt declaration knowledge. A later recognized stance establishes a new declaration without claiming a reversal across the unknown interval.
- Directed episodes cover only the observed recording interval. Their source references include orders throughout the episode, explicitly not evidence all available at its start.
- Pair intervals preserve both directions. Reciprocal Ally/Enemy/Neutral declarations are named as declarations. Asymmetry and incomplete declarations remain distinct. Equal-millisecond ordinal-only intervals are retained.
- Pair-interval source references identify declarations known at the interval start; later repeats are not retroactively used as start evidence.
- IDs are scoped to model version and retained source revision. Input order, duplicate rows and retries do not manufacture new history.

Turning-point rows retain one source command, the previous/current declarations, pair context and source references. An Ally withdrawal can identify whether both players had previously declared Ally. It does not prove an effective alliance rupture, unsuspecting victim, attack, king loss or Treachery. These rows have newSocialDeed=false and do not score Rivalry, Hostility, Bond or Reputation.

## Existing FFA fixture

The existing `replay-fixtures/FFA.aoe2record` is sufficient to regress the observed history:
- eight players, unlocked teams;
- 143 orders: 85 Ally and 58 Enemy;
- all 56 directed edges observed;
- 87 subsequent recognized stance reversals;
- zero repeated same-stance requests.

The ordinary fixture is not rejected merely because it lacks a controlled video. Tests use its retained canonical command projection directly. Additional capture is needed only for specific unqualified claims (effective/rejected/Neutral semantics, independent king responsibility), not for already-observed declaration chronology.

## Review and compatibility

The expandable Battle record exposes the history separately from effective alliance review. Live queries derive it from retained match facts; preview examples retain audited snapshots. No statistics detector, measurement, neutral deed, artifact or active revision pointer is rewritten. No raw initial-header mapping or engine-state promotion is introduced.

The real-corpus audit applies the adapter to all 14 recordings and validates source references, repeated/reordered rebuilds and scoring boundaries, with exact FFA counts. Software tests additionally cover repeats, uncertainty gaps, asymmetry, revision IDs and same-millisecond ordering. Synthetic tests qualify model behavior only; they do not broaden the game-engine claims of the real fixture.
