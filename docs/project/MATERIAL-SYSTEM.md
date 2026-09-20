# Age of Friends material system

This file records the intended visual role of the shared material assets.

## Materials

- **Pale marble / limestone** — navigation, major controls, important league records, standings and other institutional surfaces.
- **Dark wood / leather archive** — the normal league environment behind content. Texture stays subordinate to data and uses warm, low light rather than decorative scenery.
- **Parchment** — authored or in-world content: campaign maps, letters, narrative documents, messages, event briefings and Battle Orders.
- **Obsidian** — reserved for the War Room. When the War Room unlocks, it may become a whole-site temporary theme while the user is inside that navigation state.

## Assets

- `/materials/wood/archive-wood-dark.webp` — normal archive environment texture.
- `/materials/parchment/parchment-clean.webp` — official letters, readable notices and calmer narrative documents.
- `/materials/parchment/parchment-briefing.webp` — campaign briefings and Battle Orders.
- `/materials/parchment/parchment-weathered.webp` — dramatic correspondence, lore fragments and more weathered campaign material.

## Frontend classes

Reusable parchment classes live in `web/src/materials.css`:

- `.parchment-surface.parchment-surface--clean`
- `.parchment-surface.parchment-surface--briefing`
- `.parchment-surface.parchment-surface--weathered`

Battle Orders use the briefing variant. Major interactive league cards should not use parchment merely as decoration; use limestone or the normal archive material instead.
