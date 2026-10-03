# Controlled diplomacy qualification protocol V1

Purpose: qualify a narrowly supported recording build/save/data/mod tuple. This is a test plan, not a qualified fixture or a league Battle.

## Capture requirements

Keep two human POV recordings and a synchronized observation log/video. Record the Game GUID, recording SHA-256, DE build/game/save/log versions, dataset/mod identifiers, explicit team-lock settings, player-slot identities and the timing reference. Pin the parser, normalizer and action-map versions. A missing tuple field stays unknown rather than broadening compatibility.

For each step, log the issuing player, target, order shown in the diplomacy UI, observed directed state on both screens, approximate observation time, and the evidence locator. Keep commanded state separate from engine-observed state and from the other player's direction.

## Two small experiments

1. **Unlocked FFA, three players.** Start with observed directed enemy stances. A requests Ally toward B while B remains Enemy toward A. B then requests Ally; A requests Neutral and later Enemy. Include a repeated same-stance request, and a request that the UI prevents or the game rejects if feasible. C remains a control for unrelated directions. Save both POVs.
2. **Initial allied teams with diplomacy unlocked, three players.** Verify initial A→B and B→A Ally, and both directions involving C Enemy. Retain the raw team groups and both raw header diplomacy domains. Record unilateral reversal and B's later response. Add a locked-team control if runtime constraints differ.

Do not infer accepted commands, symmetry or effective states from raw lobby group 1. Qualify each raw initial-value/domain mapping only against observed initial directed state. Values not witnessed remain unsupported. If no neutral initial state can be demonstrated, its header mapping remains unknown even when runtime neutral commands decode.

## Acceptance record

For every claimed initial mapping or transition, retain:
- the supported source tuple and source hashes;
- the exact canonical event reference, timestamp and operation ordinal when present;
- the independent engine/UI witness and its timing uncertainty;
- the expected directed before/after knowledge, with unrelated edges preserved;
- negative controls, repeated/no-op behavior, rejected/locked commands, and two-POV agreement;
- reviewed canonical/derived goldens and the claims explicitly **not** qualified.

A later screen showing Ally does not prove the state changed at the issuing command's ordinal. Unless the engine-effect moment is independently established, leave the command→witness interval UNKNOWN and establish only what the witness proves. A confirmation following UNKNOWN does not prove a rupture from the last known historical state.

Acceptance requires existing statistics/neutral deeds to remain unchanged unless a separately versioned source correction is deliberately reviewed. No replay-only winners, king responsibility, relic possession, relationship points or reputation points are qualified by this protocol.
