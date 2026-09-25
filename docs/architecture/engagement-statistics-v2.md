# Age of Friends — Engagement Statistics V2

Status: review implementation  
Models: `AOF_RAID_DETECTION_V3`, `AOF_SKIRMISH_DETECTION_V1`, `AOF_ENGAGEMENT_STATISTICS_V2`

## Purpose

Engagement statistics belong to **Military** and are projected at
`participant.military.engagements`.

V2 separates broad encounter detection from stronger battle classification:

- **Skirmish** — broad local hostile command episode.
- **Battle** — a Skirmish where actual command contributors exist on opposing sides.
- **Great Battle** — conservative high-confidence Battle promotion.
- **Raid** — economy-pressure context, independent of Battle/Skirmish naming.
- **Ally Reinforcement**, **Defensive Assistance**, **Cooperative Attack** — ally interactions only when alliance semantics are applicable and qualified.

The target is a player-facing history that feels close to the real match without
pretending the replay contains engine damage, kill, live-army, pathing or exact
contact state.

## Skirmishes

`AOF_SKIRMISH_DETECTION_V1` replaces the old player-facing Fight count.

The detector keeps the established 20-second / 20-tile hostile episode linkage
and -4s/+8s support envelope. Strong seeds remain targeted hostile orders,
attack-move and attack-ground. Nearby MOVE, ORDER and PATROL activity can support
the episode.

Skirmish deliberately favors recall over Battle. A one-sided targeted hostile
episode can be a Skirmish even when the target player issues no qualifying
command.

The authoritative count is:

`participant.military.engagements.skirmishes`

Execution may reuse Skirmish windows for APM/elevation/disengage context, but
Execution does not expose a second encounter count.

## Time-aware object control evidence

V2 reconstructs a lightweight controller ledger for object instance IDs:

1. initial object ownership is the first controller observation;
2. when a player later issues a command with an instance in their selected object
   IDs, that is strong evidence that the player controls that instance at that
   timestamp;
3. the latest observation at or before a target command is used.

This is intentionally **controller-at-time**, not permanent owner, so later
selection evidence can naturally supersede earlier ownership after conversion.

The ledger improves hostile target attribution for later-created units without
requiring their exact unit type.

## Battles

Battle V1 was too restrictive because it required both hostile sides to produce
narrow "strong" attack commands inside a Fight candidate.

V2 promotes a Skirmish to Battle when **actual command contributors exist on
opposing sides**. A defender moving, kiting, repositioning or otherwise
contributing inside the same local hostile episode can therefore establish
reciprocal participation.

A target-only victim does not count as an actual command contributor and does
not by itself promote a one-sided Skirmish to Battle.

This keeps Battle stricter than Skirmish while avoiding the large false-negative
gap created by V1.

## Great Battles

Great Battle remains deliberately conservative. V2 retains the current scale
signals:

- at least 45 seconds of Battle contribution evidence;
- at least 40 distinct selected object IDs;
- at least 6 strong Skirmish commands;
- and either at least 4 contributing players or at least 60 distinct selected
  object IDs.

Uncertain large encounters stay Battle.

## Raids

`AOF_RAID_DETECTION_V3` keeps the V2 economic geometry unchanged:

- Town Center: 14 tiles;
- Mill / Folwark: 10 tiles;
- Lumber Camp: 10 tiles;
- Mining Camp: 10 tiles.

No radius was enlarged to chase TownBell counts.

V3 improves recall through controller-at-time target attribution. A later-created
enemy-controlled object targeted by ORDER inside that enemy's qualifying
economic zone can now provide strong Raid evidence even when the object was not
present in the replay header.

Known Villager, Fishing Ship, Trade Cart and Trade Cog targets remain strong Raid
evidence even outside land economic zones.

## Multiplayer relationship evidence

Every Skirmish stores:

- `participantPlayerIds`
- `contributingPlayerIds`
- `sidePlayerIds`
- `directedInteractionEdges`
- `opponentInteractionPairs`

A multiplayer engagement does **not** imply that every participant fought every
other participant.

Pair evidence is created only when either:

1. one player directly targets an object controlled by the opponent; or
2. opposing players issue commands within a tighter 12-second / 14-tile local
   overlap inside the same Skirmish.

Directed edges retain from-player, to-player, first/last evidence time, command
types, source event IDs and confidence. Opponent pairs retain whether hostile
evidence was observed in both directions.

Battles carry the same pairwise evidence forward.

Each player also receives `relationshipInteractionSummary`, grouped by actual
opponent, with Skirmish IDs, Battle IDs and mutual-interaction counts. This is
intended as neutral evidence for future Friend/Rivalry/Enemy rules; it is not a
relationship score by itself.

## Ally interaction applicability

Zero and N/A have different meanings.

- **1v1:** ally interaction metrics are `null` / N/A.
- **FFA with locked diplomacy:** ally interaction metrics are `null` / N/A.
- **Fixed team game:** ally interaction metrics are applicable and may be zero.
- **Diplomacy-enabled FFA:** the interaction family is structurally applicable,
  but current raw diplomacy modes 0/3 are not yet controlled-test-qualified into
  stance intervals. V2 therefore reports `pending_relation_semantics` and
  leaves ally counts null rather than producing false zeros or guessed alliances.

Once raw mode semantics are qualified, the same engagement/pair architecture can
evaluate alliance relationships at the event timestamp.

## Base-bound support semantics

Reinforcement and Defensive Assistance remain TC-base-bound:

- Ally Reinforcement: qualifying allied military-control evidence inside the
  supported player's TC-anchored base, outside an active defensive Battle.
- Defensive Assistance: allied participation in an active Battle inside the
  defended player's base.
- Cooperative Attack: at least two allied contributors have pairwise interaction
  evidence against the same opposing player, outside own/allied defensive-base
  semantics.

Neutral or enemy territory never becomes Reinforcement or Defensive Assistance.

## Replay-truth limits

All engagement timestamps are command-evidence windows, not exact first/last
weapon-contact times.

The model does not claim:

- damage or kills;
- battle winner;
- exact live unit counts;
- continuous positions;
- successful building completion;
- communication or strategic coordination;
- fully reconstructed diplomacy state in dynamic-diplomacy FFA.
