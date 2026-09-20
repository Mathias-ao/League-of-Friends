# Age of Friends — Civilization Catalogue V1

Status: implemented presentation/reference foundation  
Catalogue version: `AOF_CIVILIZATION_CATALOGUE_V1`

## Purpose

The Civilization Catalogue is the shared descriptive reference for civilization presentation in Age of Friends. It exists so drafting, completed Battle Orders and later statistics can refer to the same stable civilization identity without embedding bonus text or strategic assumptions inside React components or replay-analysis rules.

The catalogue is **descriptive reference data**. It is not a scoring model.

## Source and traceability

The current V1 snapshot is derived from the English civilization help strings exposed by the Siege Engineers `aoe2techtree` data set at pinned commit:

`b9d494df6921d4080df69b22f9dbb7a4d1dcd9f0` — 21 June 2026.

That project generates its AoE2 data from an installed Age of Empires II: Definitive Edition installation, including the game's civilization metadata, civilization technology-tree JSON files, language resources and game data file.

AoF stores the pinned upstream commit, import date and original help-string ID for every civilization entry. A future refresh must create a new catalogue snapshot/version when materially changed game data would alter historical interpretation.

## V1 fields

Each civilization entry contains:

- stable AoF civilization ID used by draft configuration;
- display name;
- in-game civilization type label, for example `Cavalry civilization`;
- a compact draft identity derived directly from that type, for example `Cavalry focus`;
- civilization bonuses;
- team bonus;
- unique units with a future icon-asset slot;
- unique technologies;
- descriptive type tags derived from the in-game type label;
- a future civilization icon-asset slot;
- source help-string ID.

The V1 catalogue contains all 53 base-era civilizations present in the pinned source snapshot.

## Draft presentation

Draft cards always show the compact civilization identity. Detailed civilization bonuses, team bonus and unique units are available as hover/focus detail so the core selection board remains readable.

No detailed bonus text is authoritative competition state. The authoritative competition choice remains the stable civilization ID written by the draft engine onto the Game.

Completed team drafts render **Battle Orders** from the approved Match/Game topology and locked civilization assignments. For team games, each team also sees the team bonuses contributed by its selected civilizations.

## Statistics boundary

The intended future data flow is:

**drafted civilization → locked Game civilization → replay evidence → Battle Civilization Expression → Battle Statistics → Event Statistics → Player/Season aggregation**

The catalogue may be used as a descriptive input to a future civilization strategic profile, but it must not itself contain performance judgments or hidden weights.

In particular:

- `Cavalry focus` does not mean cavalry is mandatory;
- off-profile army investment is not automatically bad play;
- replay evidence must first describe what the player actually did;
- a future versioned Civilization Expression model may interpret conventional, hybrid or adaptive play only from explicit replay/statistical evidence;
- historical analysis must retain the catalogue/profile version used.

This preserves the project truth model: reference description, replay measurement, inference and player identity remain separate layers.

## Refresh policy

When AoE2:DE patches alter civilization types, bonuses, team bonuses or unique-unit metadata:

1. refresh from a qualified game-derived source;
2. diff against the pinned catalogue;
3. review material changes;
4. increment/version the AoF catalogue when required;
5. never silently rewrite historical analytical outputs that depend on an older profile.
