# Statistics experience V1 — feature branch test run

Implemented on `feature/statistics-experience-v1`. This is a testable feature branch, not a production deployment.

## Run the preview

Use Node.js 22. From the repository root:

```sh
git fetch origin
git switch feature/statistics-experience-v1
npm ci --prefix web
npm run dev --prefix web
```

Open the Vite URL. With no Firebase web configuration, the site explicitly uses local illustrative data. Select sign-in, enter any Steam name and the displayed preview Favor `K7M4Q9`, then enter the season if prompted. Nothing in this mode writes to Firebase. Reload resets it.

1. Open **Statistics** in the navbar. Explore all five categories. Click a heading to sort and a number to open its evidence and source Games. Use **Total / Per Game**, format, and comparison-group controls.
2. In **Economy**, compare absolute resource bars. In **Military**, compare equal-Game-weight composition bars. Select a legend item to isolate its contribution.
3. Open a record's **Source Battle**, or open `preview-battle-8` from **Battles**. The scorecard opens first; expand **Full statistics**, supporting measurements, and **Battle timeline**. Select a raid/assist value to inspect directed counterparts and timestamped episodes.
4. Open the completed **Lombardia · illustrative campaign** Event. It contains eight Games and up to four qualified highlights with source links.
5. Try disputing a completed preview Battle in which your example player participated. Its measurements remain inspectable, but its Season totals and records disappear when refreshed.

The fixture leaderboard is still separate illustrative content. Wins and losses remain in the Season leaderboard.

## Selected statistics

| Category | Primary comparison | Supporting Battle detail |
|---|---|---|
| Opening | Opening classification; Feudal, Castle, Imperial timings | Villagers at Feudal click; first military request; Loom; early walls |
| Economy | Food, wood, gold, stone, total resources committed | Commitment by age; villager requests; Dark Age TC idle; additional TC placements/timings; technology requests |
| Military | Raids out/in; skirmishes and time; assists given/received; cooperative attacks; military commitment | First raid; military requests and unit breakdown; blacksmith/university requests; directed episode evidence |
| Map Presence | Scout command coverage at 5:00; expansion zones; forward placements; forward economy; walls | Enemy-base command contact |
| Execution | Raw APM; skirmish APM; raid-response latency; responses detected and opportunities | Individual source Games and raid episodes |

These are the existing worker's measurements, not new interpretations of kills, income, trained units, exact expenditure, explored terrain, or skill. Approximate timings retain `≈`; unavailable/inapplicable evidence is `—`.

## Recognition and aggregation rules

- Volume metrics sum in Total mode and average **available Games** in Per Game mode; every cell retains a sample count. Timing/APM/coverage statistics use medians. Map placement counts use means. Response latency pools detected responses; response/opportunity counts remain totals.
- Composition normalizes each Game before averaging, so a long Game cannot dominate the Season's army profile. Resource bars use an absolute scale, preserving magnitude.
- Stars recognize selected metric extremes; equal leaders share stars. An all-equal/zero comparison, incomplete coverage, or mixed/unknown models receives none. Season timings and Per Game stars require five samples per player in one comparison group; Battle comparisons require one.
- The complete V1 record catalogue contains age timings; each resource and total commitment; first raid, raid count, assists and cooperative attacks; scout coverage, expansions, forward/forward-economy placements; raw/skirmish APM. A record is a single-Game measurement with player, date, civilization, model and Battle/Game provenance. Non-reaching players do not erase another player's qualified timing. Ties retain all holders, using each holder's first attainment as the source.
- Comparisons retain approved Game settings, not just format. A multi-map or unknown pool is isolated per Game until the played-map field is available here; this avoids cross-map timing records based on assumptions. Corrected rosters, contexts and active sources are reread.
- Lead-change notices compare totals before and after the latest eligible Game. Personal-best notices render only for the signed-in player and need three prior compatible samples. These notices confer no rewards or currency.
- Deterministic highlights: Great Battles, assistance to at least two distinct teammates, established lead changes, then selected exceptional records. Fallback thresholds are 4 raids, 3 assists, 3 forward placements, 30,000 commitment, or Castle within 20:00, plus at least a 25% margin above the scope median (10% earlier for Castle). Routine/all-equal results produce no filler. Cap: three per Battle, four per Event. These are versioned V1 editorial choices, not an MVP score or replay detector change.

## Live integration

The frontend adds the authenticated `getStatisticsExperience` callable. Upload stores a compact `AOF_STATISTICS_EXPERIENCE_V1` projection alongside the verified replay source. Existing READY artifacts are lazily hydrated from stored, hash-verified statistics JSON; no replay re-upload or raw replay retention is needed.

Only the active source revision participates. Officially completed, canonical-result Games contribute; pending/disputed/cancelled/void/proposed results do not. Duplicate Game revisions and replay hashes are deduplicated. Match contexts control Season and lifetime inclusion. Raw evidence remains visible for a pending/disputed Battle without awarding recognition.

Three retry-safe Firestore triggers respond to Game, Match and replay-source changes. They reread authoritative data and replace Season and hidden lifetime totals in one transaction, including zeroing withdrawn/deleted contributions:

- `seasons/{seasonId}/statisticsExperience/{playerId}`
- `players/{playerId}/statistics/experienceLifetime`

This rebuild strategy intentionally targets a small private league. Before scaling to large histories, replace full-league transactional scans and callable payloads with paginated/incremental projections. Sources cap evidence at 600 episodes per Game and request detail at 100 rows per player; aggregate measurements retain their full counts. Older unhydrated sources do not contribute until their scope is loaded.

To test real replays, configure a separate Firebase test project using `web/.env.example`, and deploy the branch's Functions with the existing rules and replay worker configuration. A frontend-only deployment cannot provide the new live callable. This branch does not deploy, merge, change result authority, or modify trophy/scoring rules.

## Verification

```sh
npm ci --prefix functions
npm run build --prefix functions
npm test --prefix functions
npm run build --prefix web
npm test --prefix web
node scripts/test-player-site-boundaries.mjs
```

Coverage includes null/tie/model/sample semantics, duplicate/corrected sources, disputes, opt-outs and deletions, authenticated callable boundaries, scope-consistent preview data, server rendering, and DOM interactions (category switching, totals, evidence, source navigation, timeline and async loading). A controlled fixture from the real replay projector was also checked against the presentation mapping.

Local verification used Node 24; branch CI uses the project's Node 22. Browser launch was blocked by the execution environment's socket sandbox, so visual desktop/mobile acceptance and a deployed Firebase replay-upload test remain manual checks.

Later: interactive map/relationship matrix, record succession, richer Event highlight selection and hero-news integration, retained played-map comparison metadata, lifetime UI, and separately configured playstyle/reputation rules.
