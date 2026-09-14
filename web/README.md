# Age of Friends — player website

React + TypeScript client for the existing Firebase league, recovered from the interrupted website build. Read [RECOVERY.md](RECOVERY.md) for provenance and missing artifacts.

## Run

Use Node.js 22.

```sh
npm install --prefix web
npm run dev --prefix web
npm run build --prefix web
npm test --prefix web
npm ci --prefix functions
npm run build --prefix functions
node scripts/test-player-site-boundaries.mjs
```

The original frontend lockfile could not be recovered. Direct versions are pinned. The new CI workflow retains its generated lockfile and production build as an artifact; review and commit that lockfile when the coding environment is restored, then use npm ci.

## Preview and live modes

Without Firebase web configuration the site uses an explicitly labelled, memory-only preview. Sample names, standings and historical battles are illustrative. Signing in selects the example player; season entry, RSVP and a sample result dispute are local to the visit. The sample leaderboard is fixed illustrative content, not a simulated scoring pipeline. Reload resets the preview.

Copy .env.example to .env.local and supply the Firebase web app's API key, auth domain, project ID and app ID for live mode. Partial configuration fails visibly. No service-account credential belongs in a Vite variable. Add the deployed origin to Firebase Authentication's authorized domains, enable Google sign-in and deploy the accompanying functions and rules together. Browser authentication persists between visits.

VITE_USE_EMULATORS=true uses local Auth 9099 and Functions 5001. Do not ship emulator configuration. The repository's firebase.json serves web/dist with an SPA fallback; hash navigation supports refresh and back/forward.

The generated Lombardy artwork could not be recovered. The news hero renders without a missing-image placeholder. VITE_HERO_IMAGE_URL can point to restored artwork in public/assets when available.

## Object-oriented architecture

- Player encapsulates persistent player presentation.
- LeagueEvent owns countdowns, RSVP availability and check-in windows.
- LeagueService coordinates participation rules through LeagueRepository.
- PreviewLeagueRepository and FirebaseLeagueRepository implement the same interface.
- RelationshipPolicy preserves the three tracks and rejects legacy or unqualified unlock evidence.
- React views compose the player interface; they never write Firestore directly.

## Player structure

Centered identity/account header; pausable news hero; Season, Events, Battles, Players, War Room and Statistics navigation. Season contains the next event/two acts, full-width standings with attached personal progression, and connected season schedule. Rules use a dialog. Battles and players support search. Approved Match/Game details display real rosters, civilization assignments, qualified results and participant disputes. One player profile is open at a time.

The War Room shows the three separate tracks and remains locked until a validated relationship model is available. Statistics has Economy, Military, Map Presence and Execution categories with scope selection and explicit unavailable values. Global Standing remains hidden.

## Backend changes

getMyMembership resolves only the signed-in account, including pending membership. getPlayerSiteDirectory provides the active-season roster, events, approved matches and viewer enrollment using allowlisted public DTOs. enterSeason is authenticated, transactional and idempotent.

Enrollment lives at seasons/{seasonId}/participants/{playerId}, with status ENTERED. New affirmative event signups require explicit season enrollment. Existing confirmed signups retain their status; withdrawals do not require creating an enrollment. The existing signup deadline still applies. Mid-season entry is allowed; expired/completed seasons reject entry.

Public profile achievements are limited to explicitly selected showcasedAwardIds (at most three). The full active collection is returned only for the profile owner. Showcase editing remains pending the final catalogue.

Firestore read policy is tightened: active players may directly read their own player subtree; administrators retain read access except authLinks; all authoritative writes remain server-only. The website reads shared data through callables. Any existing non-admin direct Firestore consumers must migrate before these rules are deployed. Validate rules in the emulator before production rollout.

## Still pending

Authenticated replay upload/extraction/durable evidence persistence and safe replay deletion; civilization draft execution and finalized civilization pools; final statistics/rating/relationship models; actual War Room challenge progression; earned portraits and achievements/awards/trophies; production Firebase configuration and deployment.

No manual post-match statistics forms, fake upload success, guessed production counts or old-score War Room unlocks are implemented.

## Validation

The Player website CI workflow builds frontend and backend, runs eight client domain/render tests, and exercises in-memory callable boundaries for authentication, identity spoofing, season enrollment, repeat entry, RSVP and withdrawal. Check the exact commit's GitHub Actions result. No local validation was possible during recovery; the interrupted original build's earlier passes do not validate this reconstructed revision. Browser, Firestore Rules emulator and live Firebase end-to-end verification remain pending.
