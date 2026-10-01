# Player-facing Statistics & Identity V1

Status: design-test branch; engine population follows UI approval.

## Statistical surfaces

Use one vocabulary everywhere: **Opening · Economy · Military · Map Presence · Execution**.

- **Battle:** up to three meaningful Battle Readout facts, then a selective detailed five-category record.
- **Event:** 4–6 curated distinctions plus five-category aggregates across its Battles.
- **Season / Statistics nav:** five-category Season aggregates plus the approved record book with Battle provenance.
- **Player / Players nav:** personality sliders and reputation beside the persistent player profile.

The website must show selected useful statistics, not every retained metric. Diagnostics and model inputs remain underneath.

## Personality

Reveal slider positions after **3 eligible Battles**.

| Slider | Question |
|---|---|
| **Boomer ↔ Aggressor** | Early economic development or military pressure? |
| **Cautious ↔ Bold** | Secure home territory or establish toward the enemy with little defence? |
| **Guerrilla ↔ Frontline Fighter** | Raids/disruption or direct sustained engagements? |
| **Specialist ↔ Improviser** | Narrow plan/composition or broader toolkit? |
| **Compact ↔ Expansive** | Concentrated infrastructure or geographically spread economy? |

The player-facing contract accepts 0–100 positions. Normalization/rule weights remain a separately versioned interpretation rule set fed by Battle Statistics.

## Reputation

Three independent Essence Elements appear beside personality, ordered **Gallantry · Cruelty · Chivalry** in the player profile:

- **Gallantry** — Sunlight Gold — Renown & Daring Feats.
- **Cruelty** — Crimson Red — Cruelty & Deceit. This is the player-facing rename of the earlier Treachery concept.
- **Chivalry** — Sapphire Blue — Fealty & Kinship.

Reputation is represented by evolving authored insignia rather than fill meters. **Cruelty** currently has six artwork states in `web/public/Player-portraits/`: `Cruelty-0.png` through `Cruelty-5.png`. The filename number is the visual level. **Level 0** is the initial state for a player with no Cruelty / effectively no established Battle history. Final point thresholds for levels 1–5 remain intentionally unconfigured; preview-only level mapping must not be treated as an approved scoring rule.

Initial player title: **Novitiate** while identity is still being forged. Later titles remain a separate identity/title system from the three reputation essences.

Later archetypes currently represented in preview data include Champion, Vigilante, Justiciar, Tyrant, Diplomat, Custodian and Monarch. Reputation is player-level and must not become a pair relationship score.

## Hidden paired relationships

Relationships remain undisclosed until the reveal threshold and reciprocity requirements are met.

| Track | I | II | III — reveal | IV | Secret legendary |
|---|---|---|---|---|---|
| Rivalry | Friction | Contest | **Rivalry** | Nemesis | — |
| Hostility | Grudge | Bad Blood | **Enmity** | Blood Feud | **Internecine Strife** |
| Friendship | Familiarity | Respect | **Alliance** | Blood Brothers | — |

Stage III requires meaningful contribution from both players. Reputation may later provide only a small matching multiplier: Gallantry → Rivalry, Cruelty → Hostility, Chivalry → Friendship. It must never create relationship progress without pair-directed evidence.

**Internecine Strife** is not shown as an empty future tier. It is revealed only if achieved and should require exceptional reciprocal hostile history, not points alone.

## Data boundary

The UI consumes presentation-ready statistics/identity data. Preview mode may use explicitly labelled illustrative values. Firebase/live mode must show unavailable/developing states until engine-backed values exist; it must never fabricate match facts.
