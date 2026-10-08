# Event details layout V1

Event details now use three tabs inside a wider campaign dialog. The Event identity uses warm blackened stone, aged bronze borders and restrained burgundy accents. Parchment is reserved for the campaign briefing, with the Lombardia artwork as the hero backdrop. The three tabs occupy equal thirds of the full dialog width.

- **Briefing:** Event date/format/attendance, the warm-up/main/roundoff sequence, personal participation actions, a campaign briefing trigger in the hero and the confirmed muster. The briefing opens as a separate, focus-contained native dialog using the same parchment surface as the player Chronicle; Escape closes only the briefing and restores its trigger. On smaller screens, participation appears first in a single column.
- **Battles:** every approved warm-up pairing, then every approved main Battle and its roster. The viewer's own Battles are marked without assigning another player's Battle as a fallback. Explicit scoring-act designation takes precedence over format. Proposed plans do not appear as playable Battles.
- **Roundoff:** a waiting outline until release metadata and the matching roundoff revision are present; thereafter an Event points component table and factual happenings linked to Battle details.

Battle links remain available before Event release. “Played” describes the Battle status only; it does not claim that its recording has been uploaded, processed or qualified. Uploading recordings and inspecting processed statistics continue through the existing Battle details surface. RSVP, withdrawal, check-in, civilization draft entry and administrator formation use the existing repository/service actions.

## Integration boundary

This implements the Event layout, warm-up play window and main check-in timing. It does not implement the Event publication coordinator from [Event results publication V1](../architecture/event-results-publication-v1.md). The live backend does not yet emit the new roundoff contract. Live Events will retain the waiting view until that producer is implemented. Other standings, profiles, statistics and social reads still need the backend publication gates described in that architecture document.

The optional `EventDetail` read contract is:

- `event.resultsRelease`: state (`COLLECTING`, `PREPARING`, `BLOCKED`, `READY`, `RELEASED`), positive integer revision when released, optional publication time.
- `roundoff`: the same revision, per-player warm-up/main/placement/Emperor point components derived from the authoritative published ledger, and factual happenings with source Match IDs.

The UI never equates Event `COMPLETED` with results `RELEASED`. Missing or mismatched roundoff revisions stay closed. The old eager Event statistics request has been removed from this dialog; no cumulative Event highlights are fetched before publication. Server-side access control remains a separate required implementation.

## Design review

Run `VITE_AOF_REPOSITORY_MODE=preview npm --prefix web run dev -- --host localhost`, invoke the illustrative Emperor's Favor `K7M4Q9`, enter the Season and open Lombardia through Events. The Event preview selector provides current data, four warm-up pairings, a ready main 4v4, awaiting release and a released roundoff. Current preview data includes an open main-event check-in window: raise your banner, then check in to verify attendance and muster updates. Synthetic phases disable participation mutations and never populate live data or standings. Their Battle links resolve to matching illustrative repository details.

Validation: frontend/backend builds, all 53 frontend tests, all 167 backend tests and callable boundary checks passed. Coverage includes pairings, own/observer navigation, keyboard tabs, revision locking, preview Battle navigation, RSVP/withdrawal, campaign popup/focus recovery, exact check-in boundaries, failed check-in, saved attendance/muster refresh, warm-up scheduling, early submission guards, legacy schedule derivation and late recording/result acceptance. Automated visual review could not be completed in this environment: browser downloads returned invalid archives, the cloud browser could not reach localhost, and its URL policy rejected file previews. Desktop and mobile visual inspection remains a review task; responsive breakpoints are implemented at 800px and 540px.

## Warm-up play and main-event attendance

`adminCreateEvent` accepts an optional `warmupOpensAt` ISO timestamp, constrained to five to seven days before `startsAt`; the default is seven days. Approved pairings can be created earlier. New warm-up Matches pin `playOpensAt` and `playClosesAt`, with the play target at the main Event start. Existing designated warm-ups derive missing dates from their Event without rewriting results or scoring slots. A main Event date is required before warm-ups are formed.

Players arrange the 1v1 themselves within this window; they do not need main-event attendance check-in to play it. Battle details remain readable, but play orders, recording upload and result submission await opening. The server guards early uploads and result claims as well as the UI. The closing date is a play target, not a processing deadline: recordings and results can still be submitted later. The external AoE2 lobby's actual play time is not controlled by the website, and this does not claim verified recording chronology.

Main check-in is separate: creation defaults to the thirty minutes before the main Event, closing at its fixed start. Organizers may configure explicit opening/closing timestamps, with closing after opening and no later than kickoff. Reads and writes share the same effective window. The previous creation default (opening at kickoff with no closing date) is interpreted as the thirty-minute window, avoiding a zero-duration check-in. Other explicit opening dates are preserved, with a missing close bounded by the main start.

Only authenticated, confirmed RSVP-YES participants can self check-in. The server rejects early, closed, unconfigured and ineligible attempts, ignores client-supplied identity and retains the original timestamp on repeated successful requests. The Event UI refreshes at schedule boundaries and when the tab is focused or becomes visible; it saves through the repository and refreshes Event details after success. A failed request does not display attendance as confirmed.

Pair formation remains an organizer action; these changes schedule when approved pairings become playable and do not invent or automatically approve a roster. The Event publication coordinator remains outside this change.
