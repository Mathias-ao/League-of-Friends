# Season leaderboard scoring V1

Status: implemented on `feat/season-leaderboard-scoring-v1`; not deployed or merged by this task. Engine/profile ID: `AOF_SEASON_SCORING_V1`.

The ladder rewards attending valid Battles and succeeding in the Season's announced challenges. Statistical deeds, reputation, relationship progression, War Room Points and Gold are separate accounting systems.

## Locked rules

| Act / format | Participation per actual starter | Result bonus |
| --- | ---: | --- |
| Main event, team or individual | 4 | 6 per official winner |
| Main event, diplomatic FFA | 4 | 6 divided by the number of official joint winners |
| Main event, nondiplomatic FFA | 4 | First: 6; second: 2 with ≥3 starters; third: 1 with ≥5 starters |
| Designated warm-up | 1 | 2 per official winner |

Placement bonuses are exclusive: first does not also receive second/third bonuses. Diplomatic FFA has no placement bonuses. Temporary alliances neither reduce a solo winner's points nor award winner points to helpers. A winning coalition must leave at least one nonwinner.

Eligible main-event winners receive **+2 each** when the locked Emperor was an actual opposing participant and was not a winner. The bounty is not divided with the FFA victory pool. There is no bounty for warm-ups, surviving longer than the Emperor, personally targeting the Emperor, or winning alongside the Emperor.

Streaks, achievements, Wonder victories and king snipes add **zero** Season points. Late entrants earn normal points without catch-up awards.

Ties use points, then main-event wins, then warm-up wins. Otherwise players share a rank (1, 1, 3). Player ID orders equally ranked rows for stable presentation; it does not break ties. Power Rating does not break a tie. The existing Emperor office stays outside the player ladder. A single champion, if required, needs an announced playoff rather than an invented hidden tiebreak.

## Announcement, designation and snapshots

- Newly created Seasons store the fixed V1 scoring defaults; newly created Events store the fixed V1 snapshot. Old event/Match snapshots and prior ledger entries are not rewritten.
- Main Match-plan approval locks each Match's act, diplomacy setting, placement rule and current Emperor ID. Subsequent Emperor changes do not change its bounty.
- `events/{eventId}/scoringSlots/{act}_{encodedPlayerId}` reserves one scoring Match per player and act. Approval reads claims before writes; overlapping plans conflict transactionally. Rewards verify the same claims before writing any awards. Processing order cannot choose the better of several Matches.
- A correction, retry, remake, replay viewpoint or extra Battle cannot reset that reservation. Keep remakes under the designated Match. A cancelled opportunity is not silently moved to a new Match; administrative replacement of a reserved opportunity is outside this version.
- Nondiplomatic main FFA must announce `VERIFIED_ELIMINATION` or `VERIFIED_OBJECTIVE`. Wonder, relic and custom-objective games require the objective rule and a written ranking method. Elimination order cannot silently substitute for objective performance.
- Versioned rules use the engine's fixed values. Supplied legacy scoring settings on **new Event creation** do not replace the agreed policy. Existing stored legacy snapshots continue using their original completion/win values.

## Evidence and results

A valid accepted Match result is the authority for participation and wins; merely checking in is insufficient. Legitimate early elimination counts. Cancelled Matches, remakes and no-contest Games cannot award Match rewards by themselves.

Before play, the actual roster must exclude no-shows. `adminConfirmMatchStarters` records a subset of the planned roster, updates unplayed Games, rebuilds untouched civilization drafts, preserves scoring reservations and retains the planned roster for audit. It is rejected after play/result submission or civilization picks. The accepted roster determines FFA starter thresholds and Emperor participation; attendance is not inferred from survival time.

FFA results retain `PLAYER_WIN` for a solo winner and add `COALITION_WIN` with explicit `coalitionPlayerIds` for joint winners. `normalizeOutcome` permits a coalition only for explicitly diplomatic FFA, validates all identities, canonicalizes winner order and disallows duplicate winners and everyone winning. Player submissions need independent confirmation; a submitting coalition winner cannot get confirmation from another winner in that coalition. Admin result resolution and correction use the same normalization.

Diplomatic V1 FFA opts out of Power Rating before play. The current rating engine assumes a single competitive winner; no fictitious losing allies are fed into it. These Matches still contribute accepted wins/losses to competition statistics, Season points and ordinary historical records.

## Placement qualification

The current replay foundation does not establish a complete, qualified finishing order. No extractor is upgraded or claimed to do so by this change. Resignation timestamps are never used to manufacture placements.

Base participation, victory and bounty can publish while placement bonuses are **PENDING**. `adminVerifyFfaPlacements` is an authenticated administrative verification route, not a player statistics form. It requires:

- The expected current result revision and a completed, undisputed, single-Game nondiplomatic FFA.
- A complete order containing every accepted starter exactly once.
- First place agreeing with the accepted winner.
- The locked ranking rule and a substantive evidence reference/description (e.g. reviewed recording and objective standings).

The server supplies the verifier identity; clients cannot grant themselves verification. This remains an operator verification step, not automatic replay qualification. If an order cannot be established under the announced method, it remains pending. Objective measurements must be independently verified; free-form evidence does not itself reconstruct them.

Verification archives the prior result, increments the Game and Match revision, supersedes unfinished old work and queues the ordinary correction pipeline. Revising the order moves/reverses bonuses. A winner correction clears the old placement qualification; placements must be verified against the corrected result. Read views expose qualification and revision, and the Battle panel hides stale scoring summaries during corrections.

## Ledger and exact arithmetic

Reward components are `MATCH_COMPLETION`, `MATCH_WIN`, `FFA_PLACEMENT` and `EMPEROR_BOUNTY`. Corrections reconcile desired amounts against the net prior ledger for that Match/player/component rather than adding new full awards. Current-revision jobs and ledger IDs protect retries and duplicate perspectives. An open dispute blocks further processing.

V1 uses **840 integer units per point**. This is divisible by every winner count possible in an eight-player lobby. Ledger deltas and Season balances therefore preserve an exact six-point diplomatic victory pool, including seven joint winners. `leaguePoints` is a compatibility projection; ranking uses units. The UI rounds nonterminating fractions to two decimals with an approximation sign. Historical ledgers are retained; legacy reward computation stays on legacy snapshot semantics.

Per-Match applied counters reconcile main wins, warm-up wins and attendance alongside points. Placement verification never adds another participation count or win. A result correction can reverse a win even when the total point delta happens to be zero.

## Callable operations

| Operation | Required inputs / behavior |
| --- | --- |
| `adminCreateEvent` | Existing Event inputs; optional scoring input retained for compatibility. Nondiplomatic FFA additionally requires `placementRule`, and objective ranking requires `placementDescription`. |
| `adminApproveMatchPlan` | Existing plan approval; creates scoring reservations and locks V1 Match context. |
| `adminScheduleScoringWarmup` | `requestId`, `eventId`, `format`, `participants`; two-sided roster, active Season members. Creates the Game and any required civilization draft and reserves WARMUP slots. |
| `adminConfirmMatchStarters` | `requestId`, `matchId`, `starterPlayerIds`, `reason`; before play, submit/pick. Keeps absent players' reservations. |
| `submitGameResult` | Existing solo/team inputs; diplomatic FFA may instead provide `coalitionPlayerIds`. |
| `adminResolveCanonicalResultDispute` | Existing correction inputs; supports `coalitionPlayerIds`. |
| `adminVerifyFfaPlacements` | `requestId`, `matchId`, `expectedResultRevision`, `finishingOrder`, `evidence`. |
| `adminFinalizeMatchSeries` | `requestId`, `matchId`, `expectedResultRevision` (0 initially), `reason`; derives a team series result from independently accepted Games. |

V1 Event approval and warm-up creation still schedule a single Game. For an already configured team series, finalization verifies a majority win threshold, ignores REMAKE/NO_CONTEST Games, rejects missing/disputed Games before the clinch and awards the **Match once**. Repeat finalization is idempotent. Game corrections require resolving the Game dispute and finalizing the series again; an unresolved series cannot acquire a new final result. Full automatic series scheduling and finalization are not added here. Shared-winning FFA series need their own announced series rules and are rejected by the finalizer.

Shared-winner result submission requires the explicit V1 diplomatic Match lock; legacy FFA results retain their existing solo-winner contract. Historical Matches are not automatically migrated. Adoption for an existing unplayed Event requires a deliberate reviewed configuration update; no scored historical Match is reinterpreted. Deployment and the user's full player-flow acceptance remain separate steps.

## Validation

Automated coverage includes all winner counts from one through seven, starter thresholds, solo and joint victory accounting, Emperor eligibility/frozen identity, malformed/duplicate results and placements, objective-rule gates, zero deed bonuses, legacy snapshots, tied ranks, Match retries, placement corrections, winner corrections, event caps, separate warm-up reservations, actual starter changes, coalition confirmation, series finalization and stale-summary presentation. Tests use both pure engines and callable-level transactions enforcing reads before writes and unique ledger entries.
