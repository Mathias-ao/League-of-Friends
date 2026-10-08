# Battle details layout V1

Direction: Mathias, 8 October 2026. The Battle window uses the same 1080px width as Events, with a distinct smoked-iron and dark-crimson identity. Gold is reserved for orders, winners and the shared accomplishment engravings. This refines presentation and recording interactions; it does not change competition scoring, replay models or Event availability rules.

## The compact field

The primary screen contains the Battle status, an explicit Game picker for series, compact Match point components, Battle Orders, opposing side panels, recording status, qualified accomplishments and an Open Battle Ledger action. Players are grouped by the selected Game's actual teams. Two sides occupy equal columns; multiple teams and FFA remain explicit. AI opponents are shown as AI, never invented player identities. Narrow screens stack the sides.

Battle Orders remain prominent before play and become an archival action after completion. Completed Games no longer claim that their battlefield is awaiting play. Active drafting, completed-draft records, administrator recovery, recording/result review controls, AI verification and late-warmup review retain their existing workflows.

The upload action sits immediately beneath Battle Orders. Choosing a recording submits it through the existing upload API; dropping a single nonempty .aoe2record or .mgz onto the battlefield does the same. Wrong file types, multiple/empty files, early play windows, cancelled Battles, unauthorized viewers and duplicate in-flight attempts are guarded. Processing and errors appear beside the action; successful processing refreshes the detail. The recording-driven flow from main #77 is preserved: participants/Emperor can replace unresolved recordings, and only the Emperor can replace a disputed official recording. Accepted undisputed results remain protected. Preview uploads continue to be unavailable through the preview repository.

Processed measurements add each player's opening classification and main military unit to their side panel. The unit is labelled **most queued**; it is not the surviving army or a count of units trained. The opening is a classification, not an invented build-order sequence. Missing measurements stay unavailable. Provisional/disputed statistics remain identifiable and cannot produce ranked accomplishments. Raw recording/social-review output is absent from the primary screen and Battle Ledger window; metric evidence remains accessible by selecting measured values.

## Accomplishments for one Game

`selectBattleShowcase` reuses the Event catalogue's numeric thresholds, ranking, tiers, emblems, applicability, family collapse and source qualification for exactly one accepted Game. It displays up to four qualified cards in one horizontal row. Small screens scroll the row horizontally rather than stacking it into a long list. Selecting a card opens its evidence in an overlay.

A parent Match series need not be finished for an independently accepted Game to qualify. Player and team bindings, format, Event identity, current source revision, measurement models, completeness and dispute safeguards remain required. Unknown values do not become zero. Team-only claims remain inapplicable to 1v1/FFA without actual allies. Age thresholds remain disabled without a pinned standard-start setting. The same V1 metric thresholds are retained rather than introducing unapproved Battle-specific estimates.

Campaign-wide unbeaten claims and historical records/personal bests are excluded. Emperor recognition is excluded because this Battle read does not carry the authoritative pre-warmup office pin required to establish it. Ordinary Games produce fewer cards or no strip. This selector grants no achievements, points or social progression; Event curation retains main #77’s best-warmup accounting. Battle distinctions describe the individual Game even when its warm-up is not the player’s counted Event warm-up.

## Separate windows

Dispute result opens a native modal on top of the Battle. Successful submission closes it and refreshes the detail; failed submission keeps the form and reason available with an error. Escape/backdrop/close dismiss it and restore the trigger's focus. Existing participant, outcome, AI and dispute eligibility remain in force.

Battle Ledger opens a separate 1080px native modal for the selected Game. It contains eight curated measurements in each of five categories, single-Game metric evidence and the Battle timeline. The main screen no longer stacks these sections or uses a second set of Battle/Statistics/Timeline tabs. Unprocessed Games show their own empty state and never borrow another Game's measurements. Opening a different Game closes the statistics overlay; current source/result revisions refresh its data.

## Validation and review

Frontend and backend builds, existing suites and new regressions cover opposing rosters, processed-player readings, overlay focus recovery and Escape, category switching/timeline presence, dispute failure/retry, series Game isolation, picker/drop upload routing, invalid-file rejection and qualified single-Game accomplishment selection. The Event selector's existing ranking/source tests remain in place. The crimson refinement passes both builds and all 68 frontend + 223 backend tests (291 total). Regression coverage verifies eight rows per tab, single-Game Season values, allied-metric adaptation, unknown/nonfinite/zero handling, evidence focus and provisional results. Full desktop/mobile browser rendering has not been verified in this environment.

Preview: `VITE_AOF_REPOSITORY_MODE=preview npm --prefix web run dev`. Enter with the illustrative Favor `K7M4Q9` and open sample 1v1 or team Battles. Also review live READY/drafting, recorded/pending, disputed, AI and multi-Game cases before merging. Validate desktop 1080px and mobile 390px, horizontal accomplishment/table scrolling, nested dialogs and focus return.


## Crimson refinement and Battle Ledger selection

The primary heading is **Field of Battle**. **Open Battle Ledger** opens **Battle Ledger · Game N**. The dark wine-red palette covers the frame, opposing sides and overlays; gold retains command/winner/emblem emphasis. Operational upload and dispute labels stay explicit.

The Ledger reuses the Season catalogue's measurement definitions and formatting, reading the selected Game directly rather than aggregating it. Statistics run down the rows and players across the columns, matching Season comparisons. Each tab has eight rows:

| Tab | Selected measurements |
| --- | --- |
| Opening | Feudal, Castle, Imperial, Build Order Execution, Villager Queue Estimate @10, Dark Age TC Idle, First Military Unit Queued, Loom Timing |
| Economy | Villagers Queued, Villager Queue Estimate @20, Town Centers, 2nd TC Timing, Resources Committed, Farms Placed, Horse Collar Timing, Eco : Military @20 |
| Military | Military Units Queued, Military Unit Commitment, Detected Battles, Detected Battle Time, Detected Raids Initiated, Detected Raids Received, Castle Placements, Military Tech Requests |
| Map Presence | Command Map Coverage, Opponent-Side Command Presence, Opponent-Base Command Contact, Forward Buildings, Expansion Zones, Gold Influence, Known Relics Targeted, Wall Tiles |
| Execution | Raw APM, First Command, Longest Inactivity, Raid Response, Garrisons During Raids, Economy Actions in Battles, Town Bell, Back to Work |

Team Battles replace Castle Placements and Military Tech Requests with Defensive Assists and Cooperative Attacks. Individual allied rows require an actual same-team ally. Unknown/nonfinite values display “—”; recorded zero remains zero. Categorical measurements display this Game's result without a Season frequency. Current result/dispute state marks the Ledger provisional even while an older statistics projection is refreshing. Metric evidence retains the Game/revision/hash/model and available episode timestamps. No measurement is promoted into a player grade, record, point award or combat telemetry claim.
