# Event content

This folder contains player-facing thematic content for league events.

The goal is to keep event storytelling modular and editable without coupling it to backend competition logic.

## Structure

- One JSON file per event.
- File names use the event ID followed by a readable slug, for example `E001-lombardia.json`.
- Backend data remains authoritative for player counts, participants, teams, civilizations, schedules, match results, scoring, and statistics.
- Event content files only define presentation: titles, story text, state copy, labels, button text, and optional asset references.

## Event states

Each event may define copy for these common presentation states:

- `announcement` — event announced and signup available
- `registration` — players are joining
- `teamReveal` — teams/alliances have been generated
- `draft` — civilization draft or other pre-match selection
- `matchReady` — match is fully prepared
- `complete` — final result is known

A frontend should choose the appropriate state from authoritative backend status rather than storing a second event status in these files.

## Editable placeholders

Strings may contain simple placeholders that the frontend replaces at render time. Current placeholders include:

- `{count}`
- `{capacity}`
- `{number}`
- `{playerName}`
- `{civilizationName}`

Keep placeholder names stable once the frontend starts consuming them.

## Assets

Each file contains an `assets` section. Asset values may stay `null` until artwork is added.

Recommended future convention:

```text
public/events/E001/
  hero.webp
  background.webp
  emblem.webp
```

Then the event JSON can reference those paths without modifying UI components.

## Adding an event

1. Copy an existing event JSON file.
2. Change `eventId`, `slug`, display text, story text, and state copy.
3. Leave competition rules out of the file unless they are purely descriptive UI text.
4. Add artwork paths only when assets exist.
5. Add the event to `events/index.json`.

The webapp should use a shared event renderer so adding a themed event does not require a new page or bespoke component.
