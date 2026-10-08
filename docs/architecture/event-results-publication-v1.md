# Event results publication V1

Product direction: Mathias, 8 October 2026. Status: design contract; not implemented or deployed. The release mechanism below is the proposed engineering contract for that direction.

## Event is the unit of release

Each player has one designated 1v1 warm-up and one designated main Match per Event. Eight players normally produce four warm-up Games followed by the main event; a BO1 4v4 main produces five Games total. A main event with several Matches or a series has a different explicit Game manifest. Another replay perspective is evidence for the same Game, not another Game or scoring opportunity.

Every Game is processed as soon as its recording arrives. Qualified evidence feeds results, statistics, reputation and directed relationship interpretation. Each accepted Match earns its own configured competition rewards once. Processing and publication are separate: all new Event-derived player-facing results remain private until the Event roundoff is prepared and the complete Event package is released.

This supersedes any earlier plan to publish warm-up points, statistics or social progression during the week before the main event. Warm-ups still take place in that week, but their consequences are revealed with the Event. Prior published Events remain visible throughout.

## Private work and public state

| Private processing | Public website before release |
| --- | --- |
| Retained canonical evidence, qualified result revisions and detailed statistics | Event announcement, signup, check-in, approved rosters and drafts |
| Match point breakdowns, statistical contributions and rating changes | Previously released standings, profiles, statistics and rating views |
| Reputation/relationship contributions and staged chronological projections | Previously released reputation, relationships, Chronicles and achievements |
| Event roundoff, award candidates and publication readiness | The player's upload receipt and pending/received/processing status |

An uploader can see whether their file was received or requires action without seeing derived winners, point awards, statistical highlights or social decisions through the website. Scheduling information and civilization drafting must continue working while results are withheld. Administrator exception tools can inspect private processing with explicit authorization. Direct player Firestore reads, callable responses, activity feeds, totals, records and client caches must respect the same boundary.

Operational match planning must state which rating snapshot it uses. Proposed V1 default: use the last published rating snapshot for the Event's main plan so unpublished warm-up outcomes do not silently influence player-facing competition setup. This is a planning choice to confirm when implementing, not an alteration to the rating formula. Existing scoring rules still pin the Emperor at main-plan approval.

## Proposed release lifecycle

Result release status is separate from the existing Event announcement/play status. Existing `adminPublishEvent` announces an Event and opens its operational flow; it does not publish results.

| Result release state | Meaning |
| --- | --- |
| COLLECTING | Recordings and Game/Match results are arriving; normal private processing continues |
| PREPARING | Main play has ended and the declared manifest is closed; contributions are being reconciled |
| BLOCKED | A specific required source, result, rule configuration or processing revision needs resolution |
| READY | All required contributions and the roundoff form a coherent, immutable candidate release |
| RELEASED | The website's published revision includes the complete Event package |

Normal processing prepares and publishes automatically when the conditions below hold. Administrators resolve exceptions; no routine manual statistics entry or invented result is added. A date/time passing, the last main replay arriving, or one processor finishing does not alone establish readiness.

## Readiness manifest

Freeze the approved warm-up/main Match and Game manifest when main play is closed. Every participant must have the intended opportunity in each act, or a recorded exception such as withdrawal/no-show/cancellation. A normal eight-player 4v4 Event expects the four distinct warm-up Games and the main Game. Main attendance changes and configured series must be represented explicitly; neither a cancelled Game nor a remake is fabricated as a played scoring Game.

The coordinator must prove all of the following for the exact candidate revision:

1. Main play has ended, no further required Games are scheduled, and the manifest is complete.
2. Every required played Game has retained hash-verified evidence with an unambiguous approved-roster mapping and its active source recorded.
3. Every required Game and aggregate Match has an accepted, undisputed current result. Source-derived qualification remains necessary for the replay-only player flow; current manual result callables do not prove it exists.
4. All applicable processors have completed against those same source/result revisions: competition points, configured ratings/Gold, statistics and records, reputation, relationships, achievements, identity and Chronicles where included in the V1 catalogue.
5. Required rule/model configurations are pinned. An unconfigured or deliberately shadow-only core system cannot report official release readiness. `NOT_APPLICABLE` is valid only for an explicit format/rule reason, such as allied assistance in a 1v1; it is distinct from missing evidence or processing failure.
6. All required point components are reconciled. If the Event requires nondiplomatic podium points, `PLACEMENTS_PENDING` blocks final release until qualified finishing-order evidence is available. Missing objective ranking evidence is not replaced with resignation order.
7. The roundoff and every player-facing projection were generated from the same complete candidate package. Before commit, recheck its input fingerprint and the prior published revision; a changed source/result/manifest invalidates the candidate.

Missing recordings, disputed results, failed jobs and unsupported required evidence remain visible as actionable administrator blockers. Explicitly documented cancellations/no-contests are resolved exceptions with no invented points or stats. Quiet omission of a required Game or core system is not a successful complete release.

## One coherent publication

Workers write private, revisioned Event contributions; they do not expose intermediate changes through live public balances or profiles. Prepare a new immutable published league/Season snapshot incorporating the Event and previously published Events, with all affected views and the roundoff already materialized and checked. Large preparation can use batches/jobs; it must not depend on one huge Firestore transaction.

A small final transaction compares the expected prior published revision and input fingerprint, then advances the shared published-revision pointer. All public readers resolve through that revision. A refresh spanning multiple callables carries one revision token so it cannot combine an old leaderboard with new profiles or Chronicles. A failed preparation leaves the existing public snapshot intact; retrying release cannot add the Event twice.

Event results become visible across leaderboard, statistics, player profiles, reputation, relationships, Chronicles, achievements, records and activity from the same release. Rating, Gold, identity and War Room effects need the same boundary wherever they are player-facing. Public readers must not consult a private mutable balance as a shortcut. The Event roundoff is the principal entry point to the released package; players need not open it individually to unlock other views.

## Event roundoff

The roundoff is a factual, versioned Event record, not another scoring engine or an invented overall best-player judgement. It contains:

- The Event outcome: approved main results, warm-up outcomes and resolved exceptions.
- A player points table separating warm-up, main participation/victory, verified placements and Emperor bounty, plus the total earned, published Season total and rank movement. Rank movement respects shared ranks and the Emperor's separate office.
- Up to four curated, qualified Event distinctions using the implemented statistics selector, with source Battle/Game links; fewer when evidence does not support four. Include both acts and keep their format/context labels.
- Supported reputation gains and meaningful relationship turning points, showing before/after state and evidence without inventing motives or equating temporary alliances with shared victory.
- Earned/revised achievements and portrait/identity changes where configured, and the corresponding Chronicle entries.

Example without Emperor bounty or placements: warm-up win + main win = 3 + 10 = 13 points; warm-up loss + main win = 1 + 10 = 11; warm-up win + main loss = 3 + 4 = 7; losses in both acts = 1 + 4 = 5. Event totals are derived from the same component ledger as standings, not recalculated independently by the roundoff UI.

Both acts are distinct real encounters. A point award is per designated Match, statistical/social evidence is per unique Game, and Event curation summarizes them without inventing additional contributions. Reputation and pair relationships interpret the same evidence independently; neither numerically feeds the other or League Points. Cross-Game social/identity/achievement progression replays in deterministic played order (warm-ups before main, stable tie ordering), never upload arrival order.

## Corrections and repeat processing

Before publication, source/result changes invalidate and rebuild private candidates. Retries and duplicate perspectives cannot award twice. The input fingerprint binds active source hashes, Game/Match result revisions, roster/manifest and rule/model versions.

After publication, disputes/corrections create a replacement publication revision. A dispute withdraws affected contributions coherently across the public systems while preserving the audit record and unaffected contributions; it is labelled as under review. Once resolved, rebuild every dependent projection and any later chronological progression, replace the roundoff and publish the corrected revision through the same gate. An obsolete point award must not survive in a Chronicle, relationship milestone, achievement, record or activity item.

Cancellation after some warm-ups were played is a product exception requiring an explicit policy before applying the Event gate to that case; do not silently discard played encounters or publish a partial Event as if complete. Non-Event War Room/exhibition Matches keep a separately defined release policy and must not be held forever by a nonexistent Event.

## Implementation work and acceptance

Current main processes individual accepted Matches into mutable standings, ratings, player statistics, achievements, pair history, records and activity. Statistics triggers rebuild current aggregates; public callables read these directly. Replay uploads still leave official outcome qualification unresolved, verified FFA placement production is absent, and social scoring is shadow-only. Therefore this contract is not achieved by a frontend hidden flag or by waiting to start the existing jobs.

Implementation sequence:

1. Introduce the Event manifest, pinned processing dependencies and revisioned contribution interfaces alongside result/placement qualification and the remaining core rule configurations.
2. Route existing engines into private Event contributions and build deterministic candidate projections; retain Match-level scoring caps and Game identity.
3. Add readiness coordination, factual roundoff preparation, the immutable published snapshot and atomic publication pointer.
4. Move every public callable/direct read and website cache onto the publication boundary; add upload-status and Event awaiting-results/roundoff surfaces.
5. Route disputes, source replacements, late revisions and subsequent Event rebuilds through the same publication model. Adopt for new Events explicitly; preserve historical released data rather than silently staging it.

Required integration acceptance: eight players/four warm-ups/main; several main Matches; series; warm-ups uploaded out of order; last main Game arriving before a warm-up; retries and second perspectives; unavailable sources/mapping ambiguity; source switch/result correction during preparation; required placements pending; no-shows/cancellations; unavailable core configuration; worker failure/retry; no intermediate output through any public read; exact point totals; common-revision read consistency; release retry/race; corrected published Event with downstream rebuild; isolation from unrelated non-Event Matches.

Full V1 final acceptance starts only when the agreed core systems are functional and the Event release path passes these integration checks. This contract does not narrow acceptance to a leaderboard-only or Event-I-only build.
