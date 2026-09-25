# Age of Friends — Engagement Statistics V3

Status: review implementation  
Models: `AOF_RAID_DETECTION_V3`, `AOF_SKIRMISH_DETECTION_V1`, `AOF_UNIT_CLASS_FAMILIES_V1`, `AOF_ENGAGEMENT_STATISTICS_V3`

## Skirmish compatibility rule

**Skirmish is a rename and relocation of the former `AOF_FIGHT_DETECTION_V1` count.**

V3 locks this as an explicit compatibility contract:

`AOF_FIGHT_DETECTION_V1_RENAME_ONLY`

The episode-forming seed rules, 20-second linkage, 20-tile linkage, support envelope,
participant inclusion and timestamps are unchanged. Therefore a replay that produced
14 Fight episodes under Fight V1 must produce 14 Skirmishes from the same canonical
input.

Later-created target ownership and relationship enrichment may be attached after a
Skirmish exists, but they are forbidden from creating, splitting, merging or extending
Skirmish episodes.

The authoritative player-facing location is:

`participant.military.engagements.skirmishes`

Execution may reuse the same windows for context metrics but does not own a second count.

## AoE2 unit-class families

Engagement V3 uses replay-observed AoE2 `classId` evidence when available.

| AoF family | AoE2 class IDs |
| --- | --- |
| Infantry | 6 |
| Cavalry | 12, 47 |
| Archers | 0, 44 |
| Cavalry Archers | 36, 23 |
| Monks | 18, 43 |
| Villagers / trade / kings | 4, 19, 59 |
| Ships | 21, 20, 22, 2, 53 |
| Siege | 13, 51, 54, 55, 35 |
| Buildings | 3, 27, 39, 49, 52, 60 |

The class grouping is versioned independently as `AOF_UNIT_CLASS_FAMILIES_V1`.

Initial replay objects provide the strongest current instance-to-class anchor. Later
spawned objects remain unknown unless a future canonical source resolves their type/class.
AoF never assigns a class from queue composition, nearby production or strategic guesswork.

For each qualifying engagement selection footprint, AoF retains:

- distinct observed selected instances;
- typed class instances;
- military-class instances;
- known non-military instances;
- ambiguous ship-class instances;
- unknown instances;
- per-family counts;
- typed coverage percentage.

These are command-selection observations, **not live army counts**.

Ships need raw-type context where available: known warships count as military; Fishing
Ships, Trade Cogs and Transport Ships are non-military; unresolved ship purpose remains
ambiguous.

## Battle promotion

Skirmish stays broad. Battle is a stricter derived classification and can never outnumber
Skirmishes.

A Skirmish becomes a Battle when actual command contributors exist on opposing sides.
AoE2 class evidence strengthens this rule:

- a contributor whose complete observed selection footprint is directly classified as
  civilian/building-only cannot by itself establish military Battle participation;
- observed Infantry, Cavalry, Archer, Cavalry Archer, Monk or Siege classes are positive
  military evidence;
- unresolved later-spawned type does **not** disqualify participation.

This improves precision without recreating the old undercount caused by requiring both
sides to issue a narrow set of attack commands.

## Great Battle

Great Battle is reserved for unmistakably huge multiplayer engagements.

V3 requires all of:

- at least **4 contributing players**;
- at least **60 seconds** of Battle evidence;
- at least **80 combat-eligible distinct selected instances** after excluding directly
  known civilian/building selections;
- at least **10 strong Skirmish commands**.

There is no 1v1 override. A 1v1 can therefore never be a Great Battle, regardless of how
many objects were selected.

The thresholds deliberately favor undercounting. Great Battle is intended for exceptional
multi-player clashes, not simply large ordinary 1v1 Battles.

## Reinforcement and defensive support

Unit-class evidence also strengthens Ally Reinforcement. A fully typed
civilian/building-only selection cannot qualify as military reinforcement. Unknown type
remains eligible rather than causing false negatives.

Defensive Assistance and Cooperative Attack inherit the class-strengthened Battle
participants.

The existing territory rules remain unchanged:

- Reinforcement and Defensive Assistance only inside the supported player's TC-anchored
  base;
- neutral/enemy territory never becomes defensive support;
- Cooperative Attack is offensive shared-opponent participation and does not imply
  communication or planning.

## Multiplayer relationship evidence

Pairwise opponent evidence remains attached after Skirmish detection and cannot alter the
Skirmish count.

Later-created controller-at-time evidence may strengthen **who interacted with whom**
inside an already-detected Skirmish. It does not create an extra Skirmish.

This keeps two separate truths:

1. **encounter count** — stable legacy Fight V1 episode semantics;
2. **relationship attribution** — progressively richer evidence about which players
   actually interacted inside each encounter.

## Replay-truth boundary

Unit-class evidence does not prove that every selected object reached the fight, attacked,
survived or dealt damage. It is only an observed class footprint for objects appearing in
qualifying commands.

Exact live armies, casualties, damage and battle outcomes remain outside the replay-only
V3 contract.
