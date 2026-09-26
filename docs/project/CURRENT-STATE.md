# Age of Friends — Current State

Last reviewed: 26 September 2026

Purpose: Record the current product and engineering state. Read [`CORE-IDENTITY.md`](CORE-IDENTITY.md) first for the lasting product vision and [`CURRENT-STATS.md`](CURRENT-STATS.md) for the concise player-facing statistics baseline.

## Current focus

The active workstream is the player-facing statistics stack and its integration into the website. Battle measurement is now close to AoF v1 freeze; remaining statistics work is validation, final player-facing selection, and persistence/UI wiring rather than a redesign of the replay-truth architecture.

The replay pipeline produces replay-derived statistics across **Opening, Economy, Military, Map Presence and Execution**. Technical code/docs still use Match/Game terminology, while the player-facing statistics hierarchy is now **Battle → Event → Player → Season**. Lifetime aggregation remains underneath but is intentionally hidden from the Season I UI. Player currencies, Playstyle Sliders and pair Relationships remain separate rule-driven interpretation systems.

The **Player profile structure is now considered settled for AoF v1; remaining work is visual polish, data wiring and rule configuration rather than another structural redesign.** The accepted profile hierarchy is:

- engraved stone identity header with portrait, player name, reputation-title slot, Won/Lost/Win Rate;
- **Novitiate / “Identity still being forged”** as the initial title state until a later reputation title is supported;
- a horizontal **Deeds** strip directly below the header;
- a 50/50 desktop row for **Patterns of Play** and **Reputation**;
- Patterns of Play hidden behind an eligibility state until **3 eligible Battles** exist, after which the five evidence-based sliders may be shown;
- Reputation presented as three distinct evolving insignia families — **Gallantry, Chivalry and Treachery** — rather than fill meters; visual rank/frame evolution may reflect point progression, but exact thresholds remain unapproved;
- **Shared History** below Reputation as compact viewer-relative Allies / Enemies counts;
- a horizontal side-scrolling **Battle Record** rail containing Battles only.

| Statistics section | State |
|---|---|
| Battle Statistics | Replay/statistics foundation implemented; Battle presentation pending |
| Event Statistics | Product scope and 4–6 highlight direction defined; aggregation/presentation pending |
| Season Statistics | Product scope and complete record-book direction defined; aggregation/presentation pending |
| Lifetime Stats | Aggregation foundation implemented; intentionally hidden from Season I UI |
| Player currencies | Gallantry/Treachery/Chivalry boundary defined; earning rules intentionally unconfigured |
| Pair relationships | Pair History foundation implemented; current engine uses superseded Enemy/Friend semantics and needs migration to Rivalry/Hostility/Bond |
| Individual Player Stats + Playstyle Sliders | Configurable engine implemented; profile presentation structure anchored; slider rules/normalization intentionally unconfigured |

[`CURRENT-STATS.md`](CURRENT-STATS.md) is the concise source of truth for statistics status. [`../design/statistics-experience.md`](../design/statistics-experience.md) defines the Battle/Event/Player/Season presentation contract. [`../architecture/longitudinal-systems-v1.md`](../architecture/longitudinal-systems-v1.md) defines the separation between measurement and product judgment.

## Statistics architecture

The intended flow is:

**`.aoe2record` → canonical replay evidence → Game/Battle measurements → Event/Player/Season aggregation → configured interpretation systems**

- One replay produces Game-level evidence; player-facing Battle Statistics preserve Game provenance when a Battle contains multiple Games.
- Event Statistics aggregate an Event’s Battles and curate 4–6 post-Event distinctions.
- Player Statistics aggregate Season evidence and eventually feed evidence-based playstyle sliders.
- Season Statistics describe the league as a whole and expose the complete approved record catalogue.
- Lifetime Statistics continue underneath but remain hidden in Season I.
- Pair History aggregates neutral player-to-player history and directional interaction evidence.
- Playstyle Sliders only produce scores from an explicit versioned rule set supplied by the product owner.
- Gallantry / Treachery / Chivalry are future player-level point currencies with separate earning rules.
- Rivalry / Hostility / Bond are future pair relationship tracks derived separately from the player currencies.
- Higher layers should consume versioned Match Statistics and neutral league context; they should not independently reinterpret raw replay files.

## Match and competition structure

The required hierarchy remains:

**League → Season → Event → Match → Game**

- A Match is one planned competitive encounter and may contain one or more Games.
- One `.aoe2record` represents one Game.
- Players authenticate with Google, join the league once through a one-time Emperor's Favor, enter each season separately and sign up for each event separately.
- RSVP and check-in determine the available players.
- The approved Match/Game plan is authoritative for roster, teams, format and civilization rules.
- Attendance changes may produce fewer Games, asymmetric teams or FFA.
- Civilization drafting belongs in the web application.
- `AOF_CIV_DRAFT_V1` provides authoritative per-Game player drafting with configurable turn order, per-Game pools, within-Game uniqueness, Match carry-over policies, immutable pick actions and admin reset/audit support.
- Drafting operates from the approved Match roster and supports FFA, asymmetric teams and arbitrary team numbers without assuming a fixed advertised roster.
- `AOF_CIVILIZATION_CATALOGUE_V1` provides versioned, game-derived presentation facts for all 53 civilizations in the pinned source snapshot: type label, compact identity, civilization bonuses, team bonus, unique units/technologies and future icon slots.
- The civilization draft experience is implemented on `main`: Answer the Call → Check In → Muster Forming → Enter Civilization Draft → Battle Orders → Play, with team-organized drafting, civilization reference detail, completed Battle Orders and admin-only reset/reroll recovery.
- A future Battle Civilization Expression model will combine the locked civilization choice with replay-derived evidence and feed Battle/Event statistics; strategic weights and performance judgments are intentionally not part of the catalogue.
- Players upload replays; post-match statistics are derived automatically rather than entered manually.

Backend foundations exist for membership, seasons, events, RSVP/check-in, flexible match planning, Game creation and native civilization drafting. The player-facing React/TypeScript client lives in `web/`. Production configuration, replay upload and the complete end-to-end statistics presentation flow remain incomplete.

### League admission — Emperor's Favor

New league identities use **Emperor's Favor** as the private admission gate after Google authentication. A Favor is a six-character, one-use code from an unambiguous 32-character alphabet. Raw codes are not stored; Firestore keeps an HMAC-SHA256 fingerprint, redemption is atomic with player/auth-link creation, and repeated failed attempts are rate-limited. Successful redemption creates an ACTIVE league membership; season entry remains a separate step.

Administrators can generate and immediately print named Favor batches from the website. The initial flow defaults to **Founding Fifteen / 15 Favors**, while later batches may contain 1–50 Favors. Full implementation details live in [`../design/emperors-favor.md`](../design/emperors-favor.md).

## Replay and Match Statistics foundation

The current replay/statistics foundation includes:

- Python replay decoding through the pinned `mgz-fast` adapter.
- Versioned CanonicalReplay extraction with source hashing, participant identity, initial state and chronological operation evidence.
- Deterministic canonical stores, validation, retained raw evidence and coverage warnings.
- Replay-free statistics projection from canonical evidence.
- Player-facing Opening statistics and Build Order classification.
- Resource Commitment estimates by resource and age.
- Raid Detection V3 with unchanged local TC/Mill/Lumber/Mining economic zones plus time-aware selected-object control evidence for later-created targeted objects.
- Skirmish Detection V1 as a strict rename/relocation of Fight Detection V1 episode semantics; count/timing are regression-locked while multiplayer relationship evidence is attached afterward.
- Unit Class Families V1 uses replay-observed AoE2 class IDs to distinguish Infantry, Cavalry, Archers, Cavalry Archers, Monks, Siege, Ships, civilian/trade/king classes and Buildings when instance class evidence exists.
- Engagement Statistics V3 uses class evidence to suppress clearly civilian/building-only Battle/Reinforcement participation, keeps unresolved spawned objects unknown, and makes Great Battle a 4+ player / large-footprint multiplayer event only.
- Map Presence V6, including command/scout coverage, normalized Home/Mid/Forward geometry, building placement range, walls, towers, camp distance, enemy-base contact, expansions, time-aware deposit-weighted gold influence and relic holding/theft inference.
- Forward Eco V2 classification using the same Map Presence V6 Enemy Progress >=65% forward geometry.
- Execution V1 with raw APM/action gaps, explicit control-command counts, raid response/garrison context, shared Skirmish windows for APM/elevation/disengage context, and no duplicate player-facing encounter count.
- Versioned tests, golden projections and architecture documents for the active models.
- Development-only **AoF Replay Lab** for local recording extraction, replay-free statistics recalculation, evidence inspection, diagnostics and same-evidence projection comparison; it bypasses Firebase and production league state.
- Replay Lab inserts a compact `AOF_REPLAY_ANALYSIS_V1` cache between CanonicalReplay and statistics. Its default development import uses explicit `sealed_local_fast` structural publication checks instead of exhaustive event conformance; a separate Full Conformance Audit upgrades a run to `verified_local`. Routine statistics recalculation consumes the compact cache without reparsing the recording or revalidating canonical facts.

The statistics system preserves the distinction between observed evidence, reconstructed evidence and inferred analysis. Commands, queue requests and building placements must not be silently presented as confirmed completed game-state outcomes.

## Longitudinal systems foundation

### Lifetime Statistics

`functions/src/engines/lifetimeStatistics.ts` implements `AOF_LIFETIME_STATISTICS_V1`. It aggregates current match-level Opening, Economy, Military, Map Presence and Execution inputs into player lifetime totals, averages, rates/counts and min/max records with match/game provenance.

This is descriptive aggregation only. It does not assign playstyle meaning or points. The engine exists, but it is not yet wired to durable current Match Statistics storage.

### Player Identity / Playstyle Sliders

`functions/src/engines/playstyleEngine.ts` implements `AOF_PLAYSTYLE_ENGINE_V1`.

The engine accepts normalized 0-100 longitudinal metrics plus an explicit versioned rule set defining slider labels, components, directions, weights and sample requirements. With no rule set it returns `UNCONFIGURED` and no slider scores.

No default slider catalogue, weights, thresholds or normalization population are authoritative yet.

### AoF v1 Player Portraits

The AoF v1 portrait direction is approved at the product level even though its evidence thresholds and family mapping rules are not yet configured.

- Use existing **AoE2: Definitive Edition unit portrait/icon frames** as the v1 portrait asset language rather than waiting for bespoke player artwork.
- Every player begins as a **Villager**.
- Portraits evolve from sustained replay evidence toward the player’s dominant military family.
- A cavalry/knight-heavy player is the reference progression example: **Villager → cavalry-family imagery → Knight → Cavalier → Paladin** as the identity becomes increasingly established.
- Recent Games establish current preference; lifetime evidence stabilizes the identity so one unusual Game or short run does not cause rapid portrait switching.
- Minimum samples, confidence requirements, upgrade/change resistance and the exact mapping from unit-family evidence to portrait tiers still require explicit product-owner rules.
- Portrait progression is separate from reputation titles. **Novitiate / “Identity still being forged”** is the initial title presentation; later reputation titles may occupy that slot without changing the portrait progression model.
- Clothing, weapons, headgear and bespoke cosmetic evolution remain independent future layers and are not required for AoF v1.

### Pair History and Relationships

`functions/src/engines/relationshipEngine.ts` implements:

- `AOF_PAIR_HISTORY_V1` — neutral pair history including encounters, allied/opponent history, results and directional replay-derived signals.
- `AOF_RELATIONSHIP_ENGINE_V1` — currently implements the older Rivalry / Enemy / Friend track model and must be migrated/versioned for the newer player-currency plus Rivalry / Hostility / Bond product model.

The existing `RIVALRIES` processing step now rebuilds and persists neutral Pair History in the `relationships` collection. Today that persisted history uses encounter/team/result evidence because the current Functions backend does not yet receive the replay-derived directional Match Statistics required for raids/forward pressure. Those signals are explicit future inputs rather than guessed data.

With no explicit relationship rule set, the current older `RIVALRY / ENEMY / FRIEND` tracks remain `UNCONFIGURED`. Product direction now separates player currencies (Gallantry / Treachery / Chivalry) from pair tracks (Rivalry / Hostility / Bond), so a migrated or successor engine is required before final exposure. The legacy automatic rivalry threshold no longer drives this processing step, and it no longer opens the War Room. The older `RIVALRY_ENGINE_V1` code is retained only for compatibility.

## Current limitations

- Queue requests, research requests and placements do not by themselves prove completion, survival, damage or kills.
- Resource Commitment is an estimate from pinned base costs and does not simulate civilization discounts, cancellations/refunds, resource availability, market exchange or tribute.
- Raid, Skirmish and Engagement detection are command-episode inference and do not prove success, damage, kills, surviving army, exact army size or continuous positions. Great Battle deliberately favors precision over recall.
- V2 support/defense uses conservative TC-anchored base zones. This can undercount legitimate help at non-TC settlements, but prevents neutral/enemy-territory activity from being credited as defensive reinforcement.
- Multiplayer opponent relationships are retained pairwise rather than inferred from co-participation. Fixed-team ally interactions are available; 1v1 and locked-diplomacy FFA return N/A. Diplomacy-enabled FFA is marked pending rather than false-zero until raw diplomacy modes 0/3 are controlled-test-qualified into stance intervals.
- Map Presence represents command/building geometry, not fog-of-war exploration or permanent territorial ownership.
- Entity labels are based on the pinned reference catalog and are not yet fully qualified for every replay patch/mod.
- Restored-game clocks, complete effective diplomacy state and some initial-object semantics remain qualification areas.
- Canonical export is not yet the mandatory normal upload path.
- Authenticated replay upload, durable remote canonical persistence and complete backend ingestion remain unfinished.
- Civilization drafting is series-aware, but approved Match Plans still create only `G1` with a best-of-1 SeriesRule. BO3 Game creation and series result finalization remain a separate competition-orchestration gap.
- Lifetime Statistics persistence and Playstyle presentation are not yet wired end to end.
- Pair History currently persists match/team/result history but not replay-derived directional interaction signals.
- Playstyle normalization and slider definitions/weights remain undecided. Gallantry/Treachery/Chivalry earning rules and Rivalry/Hostility/Bond derivation/stages are also intentionally undecided.
- The **v1 portrait visual direction is approved**, but the exact military-family progression map, thresholds, confidence rules and persistence/reversion behavior are not yet configured. Do not infer those values from the example Knight → Cavalier → Paladin path.

## Systems pending broader statistics work

| System | Current state | Main dependency |
|---|---|---|
| Leaderboards and ladder | Foundations exist; final player-facing boards are incomplete. | Lifetime/rating definitions and presentation. |
| Matchmaking | Match planning exists; statistics-informed matchmaking is incomplete. | Rating and persistent player statistics. |
| Relationships | Neutral Pair History processing implemented; current engine semantics predate the latest product split. | Define Gallantry/Treachery/Chivalry earning rules separately from Rivalry/Hostility/Bond derivation/stages and migrate the engine. |
| War Room | Challenge/query foundations exist; legacy automatic opening is no longer part of relationship processing. | Explicit future product decision after relationship rules are approved. |
| Achievements | Processing scaffolding exists; final catalogue and triggers are not frozen. | Stable match/lifetime statistics and product rules. |
| Awards and trophies | Direction exists; earning rules remain pending. | Stable match, event, season and lifetime statistics. |
| Player portraits / playstyle | Profile structure and AoF v1 unit-portrait direction are approved; slider engine foundation exists; portrait rules and slider interpretation remain unconfigured. | Define portrait family mappings/thresholds/sample stability rules plus player slider inputs/weights/normalization. |

## Other implementation state

| Area | Current state | Main gap |
|---|---|---|
| Firebase backend | Node.js/TypeScript functions, Firestore rules/indexes, Google authentication mapping, Emperor's Favor admission and emulator support exist. | Production deployment and complete replay/statistics orchestration. |
| Results | Submission, administrator resolution, disputes, corrections and revision foundations exist. | Replay-derived automatic result qualification and downstream invalidation. |
| Processing | Repeat-safe jobs exist for several downstream systems; Pair History now uses the existing `RIVALRIES` step. | Wire current Match Statistics and Lifetime aggregation into versioned rebuild/storage jobs. |
| Player website | React/TypeScript client exists and consumes authenticated league/event/match/profile data; drafted Battles support progressive event-day entry and the player-profile structure is implemented on `feat/statistics-identity-experience` with only polish/data-rule wiring remaining. | Persist and present real Match/Lifetime/identity outputs, finalize portrait asset integration, and configure the still-open rule systems. |

## Immediate priorities

1. Validate the current Match Statistics models against additional real replays and supported match shapes.
2. Wire current Match Statistics into durable backend persistence and the player-facing website.
3. Wire `AOF_LIFETIME_STATISTICS_V1` to persisted Match Statistics and durable rebuild/storage.
4. Feed replay-derived directional Match Statistics into `AOF_PAIR_HISTORY_V1` once backend Match Statistics persistence exists.
5. Build the Battle/Event/Player/Season presentation around the shared five-category vocabulary, including up to 3 curated Battle feats, 4–6 Event distinctions and the complete Season record book.
6. Polish the now-anchored Player profile and integrate the AoF v1 **Villager → dominant military-family unit portrait** progression using existing AoE2DE unit portrait/icon frames; do not invent the mapping thresholds before they are approved.
7. Define the normalized metric inputs and rule set for Player Identity / Playstyle Sliders.
8. Define Gallantry / Treachery / Chivalry earning rules separately from Rivalry / Hostility / Bond relationship derivation, stages and War Room visibility.
9. Only after those rules are approved, expose slider scores and relationship progression to the player website and downstream systems.

## Task guidance

- Treat [`CORE-IDENTITY.md`](CORE-IDENTITY.md) as the authority for product vision.
- Treat [`CURRENT-STATS.md`](CURRENT-STATS.md) as the concise authority for statistics status.
- Treat [`../architecture/longitudinal-systems-v1.md`](../architecture/longitudinal-systems-v1.md) as the authority for the measurement-versus-judgment boundary.
- Inspect latest `main` before describing behavior as implemented.
- Keep observed facts, deterministic reconstruction, inferred analysis and league interpretation separate.
- Keep model/rule versions attached to inferred, reconstructed and interpreted outputs.
- Do not introduce default slider weights, relationship points, reputation-insignia thresholds or portrait progression thresholds without explicit product-owner approval.
- Update this file when a major implementation state or priority changes.

## Specialist sources

- [`CURRENT-STATS.md`](CURRENT-STATS.md)
- [`../design/statistics-experience.md`](../design/statistics-experience.md)
- [`../architecture/longitudinal-systems-v1.md`](../architecture/longitudinal-systems-v1.md)
- [`../architecture/opening-statistics-v1.md`](../architecture/opening-statistics-v1.md)
- [`../architecture/engagement-statistics-v3.md`](../architecture/engagement-statistics-v3.md)
- [`../architecture/canonical-statistics-v1.md`](../architecture/canonical-statistics-v1.md)
- [`../architecture/replay-statistics-v1.md`](../architecture/replay-statistics-v1.md)
- [`../architecture/replay-extraction-contract-v1.md`](../architecture/replay-extraction-contract-v1.md)
- [`../architecture/civilization-drafting-v1.md`](../architecture/civilization-drafting-v1.md)
- [`../architecture/civilization-catalogue-v1.md`](../architecture/civilization-catalogue-v1.md)
- [`../design/emperors-favor.md`](../design/emperors-favor.md)

- Map Presence V6: buffered Scout Coverage @5:00 with attribution diagnostics; Eco Camps include Mill/Folwark + Lumber/Mining Camps; Expansion Zones cluster remote qualifying economy/territorial placements and preserve Home/Mid-map/Forward sectors; pairwise enemy-base-contact evidence remains available for relationship analysis.

- Map Presence V6 repairs Scout Coverage @5:00 attribution for the qualified save-68 MOVE/ORDER selected-ID shift defect while preserving original parser facts. The committed paired-duel regression now reproduces the reviewed 45/36 scout-command control counts; implicit empty selections remain excluded. The V6 coverage corridor is 3.25 tiles, producing 15.38% / 9.83% on that replay versus the reviewed 15.3% / 10.4% control.

- Analysis Dataset V3 adds compact terrain elevation to the disposable analysis cache so fight-context statistics can be recalculated from sealed CanonicalReplay without reparsing the original recording.
- Execution V1 is now reviewable in Replay Lab with paired AoF/TownBell columns. Direct command metrics are high-confidence observations; raid response, fights, elevation and disengagement remain explicitly inferred.
