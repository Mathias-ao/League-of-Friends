# Event details layout V1

Event details now use three tabs inside a wider campaign dialog. Existing limestone, bronze and dark stone styling is retained, with the Lombardia artwork as the briefing backdrop.

- **Briefing:** Event date/format/attendance, the warm-up/main/roundoff sequence, personal participation actions, campaign lore and the confirmed muster. On smaller screens, participation appears first in a single column.
- **Battles:** every approved warm-up pairing, then every approved main Battle and its roster. The viewer's own Battles are marked without assigning another player's Battle as a fallback. Explicit scoring-act designation takes precedence over format. Proposed plans do not appear as playable Battles.
- **Roundoff:** a waiting outline until release metadata and the matching roundoff revision are present; thereafter an Event points component table and factual happenings linked to Battle details.

Battle links remain available before Event release. “Played” describes the Battle status only; it does not claim that its recording has been uploaded, processed or qualified. Uploading recordings and inspecting processed statistics continue through the existing Battle details surface. RSVP, withdrawal, check-in, civilization draft entry and administrator formation use the existing repository/service actions.

## Integration boundary

This is a frontend layout implementation, not the Event publication coordinator from [Event results publication V1](../architecture/event-results-publication-v1.md). The live backend does not yet emit the new roundoff contract. Live Events will retain the waiting view until that producer is implemented. Other standings, profiles, statistics and social reads still need the backend publication gates described in that architecture document.

The optional `EventDetail` read contract is:

- `event.resultsRelease`: state (`COLLECTING`, `PREPARING`, `BLOCKED`, `READY`, `RELEASED`), positive integer revision when released, optional publication time.
- `roundoff`: the same revision, per-player warm-up/main/placement/Emperor point components derived from the authoritative published ledger, and factual happenings with source Match IDs.

The UI never equates Event `COMPLETED` with results `RELEASED`. Missing or mismatched roundoff revisions stay closed. The old eager Event statistics request has been removed from this dialog; no cumulative Event highlights are fetched before publication. Server-side access control remains a separate required implementation.

## Design review

Run `VITE_AOF_REPOSITORY_MODE=preview npm --prefix web run dev -- --host localhost`, invoke the illustrative Emperor's Favor `K7M4Q9`, enter the Season and open Lombardia through Events. The Event preview selector provides current data, four warm-up pairings, a ready main 4v4, awaiting release and a released roundoff. Synthetic phases disable participation mutations and never populate live data or standings. Their Battle links resolve to matching illustrative repository details.

Validation: production build and all 49 frontend tests passed, including pairings, own/observer navigation, keyboard tabs, revision locking, preview Battle navigation and RSVP/withdrawal. Automated visual review could not be completed in this environment: browser downloads returned invalid archives, the cloud browser could not reach localhost, and its URL policy rejected file previews. Desktop and mobile visual inspection remains a review task; responsive breakpoints are implemented at 800px and 540px.
