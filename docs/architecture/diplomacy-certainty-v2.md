# Diplomacy certainty and recording review V2

The temporal foundation now uses **AOF_DIPLOMACY_TIMELINE_V2** and **AOF_DIPLOMACY_EVIDENCE_ADAPTER_V2**. The action-mode map remains V1: raw command modes 0/1/3 describe commanded Ally/Neutral/Enemy, not accepted effects. V1 documentation is historical.

## Corrected certainty boundary

A `COMMAND_ONLY` order cannot establish its requested stance. It also cannot prove that the previous stance continues unchanged. At that full replay moment, V2 invalidates effective knowledge for the issuing direction to UNKNOWN. The opposite direction and unrelated pairs retain their independent evidence.

An unknown command mode or apparent repeat also invalidates certainty. A qualified later observation can establish a stance again. Establishing state after an unknown interval is **not proof of an alliance formation, rupture or betrayal**: V2 separates effectiveStateEstablished from effectiveStateChanged. No command-only row sets either flag. Knowledge boundaries include invalidation and establishment; ordinal-only intervals are retained.

Invalid initial stance enums, unsafe/fractional chronology and duplicate roster IDs fail closed. Pair coverage is qualified only if both directed stances are known. Unknown is never Neutral.

## Recording adapter

**AOF_RECORDING_DIPLOMACY_REVIEW_V1** is an advisory, pure read model from retained match facts:
- normalized initial canonical edges only;
- raw vectors counted for disclosure, never mapped into effective state;
- directed command rows validated against their actor/target key and source reference;
- identical duplicate command rows deduplicated; conflicting reference payloads rejected;
- all imported commands remain COMMAND_ONLY;
- deterministic rebuild from retained facts, no recording needed.

The active-statistics query adds this review separately. No statistics artifact, detector, metric, deed, revision pointer or official result is rewritten. Legacy/malformed review inputs return unavailable review without blocking existing statistics. The expandable Battle record shows this qualification boundary. Fixed locked-team statistics remain a separate evidence source; their existing applicability is unchanged.

The real-corpus workflow exercises the same TypeScript adapter against all 14 retained recordings. It checks source references, immutability, duplicate/order independence and absence of effective-state promotion. Its output is a regression report, not a controlled semantic qualification. Paired POVs remain one Game.

## Remaining gate

The exporter still writes normalized initial diplomacy as an empty list. Raw headers and 86 diplomacy commands in the ordinary TownBell FFA recording do not replace a controlled experiment.

See [the qualification protocol](../replay-foundation/diplomacy-qualification-protocol-v1.md). Until supported build/save/data/mod tuples have reviewed initial-state and effective-transition witnesses, no runtime command is promoted and dynamic relationship scoring stays inactive. A delayed UI observation cannot retroactively prove the exact command-time effect. Record the uncertainty window; do not fill it with an assumed alliance.

No Rivalry/Hostility/Bond points, Gallantry/Cruelty/Chivalry points, Treachery, absence, cooperation intent or engine combat outcomes are inferred by this change.
