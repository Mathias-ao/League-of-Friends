# Age of Friends — Engagement Statistics V1

Status: review implementation  
Models: `AOF_RAID_DETECTION_V2`, `AOF_FIGHT_DETECTION_V1`, `AOF_ENGAGEMENT_STATISTICS_V1`

## Purpose

Engagement Statistics V1 belongs to the **Military** statistics category and is projected at `participant.military.engagements`. It is not a separate Combat tab/category.

Engagement Statistics V1 turns conservative replay-command evidence into a small set of player-facing interaction statistics:

- **Raid**
- **Battle**
- **Great Battle**
- **Ally Reinforcement**
- **Defensive Assistance**
- **Cooperative Attack**

The model prioritizes **correct players, time, place and interaction direction** over exact army composition. It does not claim kills, damage, live army size, exact unit positions, battle outcome or coordination intent.

## Shared evidence contract

All outputs are inferred from timestamped canonical ACTION evidence, command coordinates/targets, selected instance IDs where present, initial object ownership/type where known, building-placement evidence and team/diplomacy context available to the current analysis layer.

Replay-relative timestamps describe **first and last qualifying command evidence**, not exact weapon-contact time.

The current implementation uses lobby-team identity for ally/opponent grouping. Dynamic diplomacy remains a qualification area for diplomacy-enabled FFA.

## Spatial primitives

### Economic zones

Economic zones exist only around local economy-camp anchors:

- Town Center: 14 tiles
- Mill / Folwark: 10 tiles
- Lumber Camp: 10 tiles
- Mining Camp: 10 tiles

Initial qualifying buildings are active from time zero. Later placements become active from the placement timestamp. A placement is evidence for the inferred zone; it does not prove completed construction.

Farms, Markets, Docks, houses and generic economy-role buildings do **not** create land raid zones.

### Base zones

A base zone is deliberately separate from an economic zone.

V1 uses a conservative **22-tile Town-Center-anchored base zone**. Initial TCs are active from time zero; later TC placements become eligible from placement time.

Remote camps, Castles, military buildings and forward structures do not create defensive bases. This intentionally undercounts some support rather than crediting neutral/enemy-territory activity as defense.

### Engagement zones

`AOF_FIGHT_DETECTION_V1` supplies spatial-temporal hostile command windows. Engagement Statistics V1 re-evaluates actual command contributors inside those windows before promoting them to player-facing Battles.

## Statistics

### Raid

A Raid is hostile pressure against another player's economy.

Strong evidence is either:

1. hostile command evidence inside the victim's active economic zone; or
2. a direct ORDER targeting a known enemy **Villager, Fishing Ship, Trade Cart or Trade Cog**, including outside a land economic zone.

Plain movement/patrol in an economy zone is supporting evidence only and cannot create a Raid without strong hostile evidence.

Each Raid retains attacker, victim, first/last evidence time, evidence command IDs, economic-zone evidence and economic-target types where known.

### Battle

A Battle is a reciprocal hostile command episode.

A Fight V1 candidate becomes a Battle only when **at least two hostile sides have actual qualifying command contributors** inside the same time/space window. A player inferred only because one of their objects was targeted does not count as a Battle participant unless they also contribute qualifying command evidence.

Battle output retains:

- start/end evidence time
- center
- participant players
- player sides
- each player's first contribution time
- distinct selected-object footprint
- strong command count
- overlapping Raid IDs where applicable
- source evidence IDs

### Great Battle

Great Battle is a conservative promotion of Battle, never a required classification.

V1 requires all of:

- at least 45 seconds of qualifying Battle evidence
- at least 40 distinct selected object IDs
- at least 6 strong combat commands
- and either at least 4 contributing players or at least 60 distinct selected object IDs

If the evidence is uncertain, the event remains **Battle**.

### Ally Reinforcement

Ally Reinforcement is meaningful allied military-control evidence inside another ally's **TC-anchored base**, outside an active defensive Battle.

V1 uses a high-precision rule:

- PATROL, attack-move or attack-ground evidence
- inside an ally base
- at least two qualifying commands, or at least three distinct selected object IDs
- clustered within 60 seconds

Neutral or enemy territory never counts as Ally Reinforcement.

This is reinforcement evidence, not proof of exact unit arrival or army size.

### Defensive Assistance

Defensive Assistance occurs when an allied player contributes to an active Battle inside the defended ally's TC-anchored base while hostile contributors are present.

It records helper → defended player, enemies, Battle ID and the helper's first contribution time.

Neutral-ground and enemy-territory Battles do not earn Defensive Assistance.

### Cooperative Attack

Cooperative Attack occurs when two or more allied command contributors participate offensively on the same side of a Battle against another player/side.

If the Battle is inside that side's own/allied base, the event is treated as defense instead and does not count as Cooperative Attack.

Neutral/contested or enemy-base Battles can count. The label means overlapping allied offensive participation; it does **not** prove strategic coordination or communication.

## Known V1 limits

- Later-created object instance IDs are not always typed/owned, so direct economic-target and targeted-ORDER evidence can undercount.
- Base ownership is TC-anchored rather than a full territory simulation.
- Building placements do not prove completed buildings.
- Command points are not continuous unit positions.
- Great Battle deliberately favors precision over recall.
- Static lobby-team grouping is not sufficient for every dynamic-diplomacy FFA; those cases remain qualified until relation-at-time is wired into this layer.
