# Season content

This directory contains player-facing thematic content for each league season.

Each season has its own JSON file so names, story copy, signup language, artwork references, and event relationships can be edited without changing shared UI or backend competition logic.

## Structure

- `index.json` lists available season content files.
- `S001-fiefdom-of-bad-neighbors.json` contains Season I presentation and narrative content.

## Important separation

These files are presentation configuration only. Firestore remains authoritative for league membership, season participation, event participation, event state, match assignments, results, standings, and statistics.

The intended participation hierarchy is:

1. Join the league — permanent membership and player identity.
2. Enter a season — explicit participation in that season.
3. Join or decline an event — separate RSVP for each event in the season.

The frontend should render thematic copy from these files while deriving actual eligibility and state from authoritative backend data.
