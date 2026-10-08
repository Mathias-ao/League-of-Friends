# Season leaderboard points V1

Agreed with the product owner on 2026-10-07. Policy version: AOF_SEASON_POINTS_V1.

Publication direction updated on 2026-10-08: calculate each designated Match privately, then release warm-up and main point/progression consequences together after the Event roundoff is ready. Individual Battle statistics may be shown in Battle details before this release; that does not publish leaderboard points. [Event results publication V1](../architecture/event-results-publication-v1.md) defines the proposed integration contract. The award amounts and caps below remain unchanged. The Event publication gate is not yet implemented; current main still exposes accepted Match consequences individually.

## Awards

| Scoring opportunity | Participation | Victory | Additional awards |
|---|---:|---:|---|
| Main team / individual Match | 4 | 6 per official winner | 2 per eligible winner against the Emperor |
| Warm-up 1v1 Match | 1 | 2 | None |
| Diplomatic FFA | 4 | 6 divided by number of official winners | Emperor bounty where eligible; no placements |
| Nondiplomatic FFA | 4 | 6 for first | Second: 2 with >=3 starters; third: 1 with >=5 starters |

Winner and placement bonuses are alternatives. A diplomatic winning group shares exactly six victory points; participation is never divided. Temporary alliances, diplomacy commands, attacks, contributions and survival do not establish who shares a victory. Single-winner diplomatic FFA pays the full six.

The Emperor is pinned at main Match-plan approval using the league's displayed Emperor identity. A main winner qualifies when that Emperor is an official opponent and nonwinner. Each winning teammate or coalition member receives 2. No bounty in warm-ups, no bounty for merely surviving longer than the Emperor, and no bounty when the Emperor is a co-winner.

Streaks, achievements, Wonder wins and king snipes add no season leaderboard points. They retain their separate recognition/statistics systems. Gold and War Room rules are unchanged.

## Opportunity caps and snapshots

One designated WARMUP and one designated MAIN Match per player per Event. Approval reserves server-owned Event scoringSlots transactionally, before play. A second Match cannot claim the same player's act slot, even from another plan or concurrent approval. Extra play belongs outside season scoring.

A Match, not each Game or each uploaded POV, earns awards. BO1 is the existing result-acceptance path; future series must publish one aggregate Match result. Remakes, no-contests and cancelled Matches do not have an eligible completed Match result. Attendance check-in alone gives no points. Early legitimate elimination does not forfeit participation.

Official roster/result authority remains the existing league result workflow. Keep no-shows out of the actual Match roster. This change does not infer attendance or winners from unqualified replay facts.

New adminCreateEvent calls pin the V1 profile automatically. The previous arbitrary numeric scoringSnapshot input is retained as a compatibility input but does not override the agreed new-event rules. Existing Events and Matches retain their historical profile; deployment does not silently migrate them.

adminApproveMatchPlan pins MAIN and the Emperor. adminCreateEventWarmups accepts an Event, explicit nonrepeating 1v1 pairs and a nondraft GameConfiguration. Players must be ACTIVE and ENTERED in the Event's Season. Main-evening check-in is not required for week-before warm-ups. Warm-up diplomacy is disabled in the game snapshot. The existing callable accepts pairings; this change does not add a new warm-up scheduling form.

Slots remain reserved when a Match is cancelled. Administrative replacement/transfer of a cancelled designated Match is not implemented; do not approve another scoring Match as a workaround. Historical Events need a deliberate migration before they can use V1 warm-up creation.

## Official coalition results

submitGameResult and correction resolution accept winnerPlayerIds for FFA. One ID normalizes to PLAYER_WIN; two or more normalize to COALITION_WIN only when the pinned Game configuration enables diplomacy. Winners must be a unique nonempty proper subset of the roster. All-player victories are rejected. Team formats accept only winnerTeam.

A member of a winning coalition cannot confirm another winning member's claim. A nonwinner can independently confirm it; disputed official outcomes retain the existing administrator resolution route. Placement order is not a result-submission field.

Existing competition statistics and official-outcome read models consume all accepted winners. Shared FFA victories are unrated: the existing rating model supports one FFA winner and has no approved coalition rating policy. Solo diplomatic FFA keeps the existing rating calculation. The rating processor rebuilds eligible history for corrections in either direction; changing a rated solo result into a coalition removes its obsolete rating history and resets players who have no other rated Matches. Team and solo FFA rating formulas are unchanged.

## Verified nondiplomatic FFA placements

The event announces ELIMINATION_ORDER or OBJECTIVE_RANK before play. Objective games that permit Wonder/relic/custom wins require an explicit policy when creating an FFA Event; resignation order must not silently stand in for objective performance.

The scoring consumer reads qualifiedFFAPlacements exclusively from the active server-owned replaySources artifact. It checks source readiness, active pointer, Match/Game identity, replay hash, one-to-one mapped roster, official result revision, first-place agreement, complete ranks and announced policy. Caller-supplied ranks are never accepted.

The contract is AOF_FFA_PLACEMENTS_V1 with qualification VERIFIED, policy, sourceStatisticsId, replaySha256, resultRevision and ranks [{playerId,rank}]. Competition ranking supports verified ties (1,2,2,4). Tied players share the rewards for occupied positions: a tie occupying second and third in a five-player game gives 1.5 each, not duplicated podium bonuses.

**The current extractor does not emit verified finishing order. No placement qualifier or manual-statistics bypass is enabled by this branch.** Consequently, current real nondiplomatic FFA results award participation/victory/bounty and expose PLACEMENTS_PENDING. A qualified replay placement producer and the objective mode's ranking semantics remain prerequisites for automatically awarding the agreed placement points. Tests inject explicitly synthetic qualified evidence to verify the consumer; they are not real-recording qualification.

## Corrections, source changes and standings

The league ledger retains separate MATCH_COMPLETION, MATCH_WIN, FFA_PLACEMENT and EMPEROR_DEFEATED components. Reprocessing writes only the difference from the net prior component amount. Result corrections reconcile all four and existing Gold. A transactionally incremented scoring pass permits evidence reversals and restoration without ledger-key collisions. Repeated processing of an unchanged source/result does not award again.

Active Game source changes, source qualification updates/deletion and eligible Game/result-state changes reconcile placement awards. An unavailable or incompatible source reverses previous placement awards and returns them to pending; it does not delete statistical evidence. Source consumers never mutate canonical statistics or reputation/relationship calculations.

Public leaderboard and profile points exclude disputed or not-yet-reconciled awards while preserving the audit ledger. Ranking uses total points, main-event wins, warm-up wins, then shared competition rank. Alphabetical order only makes tied display deterministic; power rating does not break season ties. Equal finalists require an announced playoff if a single champion is needed.

Points remain full precision in storage. Presentation rounds to two decimals for larger coalitions. There are no catch-up points; late joiners earn normal points. True draws/timeouts remain unsupported by the existing winner-only result model and must not be fabricated as wins.

## Validation

Backend contract and callable integration tests cover solo/shared wins, Emperor eligibility, podium thresholds, source/result/roster mismatches, verified ties, pending placement states, snapshot compatibility, warm-up caps, correction reconciliation, source reversals/restoration, duplicate processing, official coalition compatibility and tied rankings. Web tests cover fractional point presentation.

No deployment or migration of live standings is part of publishing this feature branch.

## Operator payloads

Create an Event with the existing adminCreateEvent payload. V1 scoring is pinned automatically. Set gameConfig.diplomacyEnabled explicitly for FFA, and supply placementPolicy as ELIMINATION_ORDER or OBJECTIVE_RANK for nondiplomatic FFA. The latter requires a separately qualified objective ranking method.

After publishing the Event, create warm-ups through adminCreateEventWarmups:

~~~json
{
  "requestId": "unique-warmup-request-id",
  "eventId": "EVENT_ID",
  "pairs": [["PLAYER_A", "PLAYER_B"], ["PLAYER_C", "PLAYER_D"]],
  "gameConfig": {
    "maps": {"pool": ["Arabia"], "selectionMode": "ADMIN"},
    "civilizations": {"mode": "UNRESTRICTED", "allowed": [], "banned": [], "customRuleCode": null},
    "victory": {"conquest": true, "wonder": false, "relic": false, "customRuleCode": null},
    "diplomacyEnabled": false,
    "additionalSettings": {}
  }
}
~~~

Joint official FFA result submissions use the existing submitGameResult callable with matchId, gameId and winnerPlayerIds. The existing independent confirmation/dispute workflow applies. There is no placement-entry form or arbitrary award endpoint.

## Consolidated branch behavior

The branch consolidation retains one engine/profile, `AOF_SEASON_POINTS_V1`. The duplicate `AOF_SEASON_SCORING_V1` implementation is superseded before deployment; it is not a second supported scoring profile. Its starter correction and team-series finalization operations are integrated into this engine. New Seasons now store the V1 defaults; historical snapshots remain unchanged.

V1 ledger entries store `amountUnits`, and standings store `leaguePointUnits`, at 840 units per point. This exactly represents every possible coalition and verified placement tie in an eight-player lobby. Corrections reconcile integer component balances. `leaguePoints` and ledger `amount` remain compatibility projections; legacy balances retain their existing values. Standings ranking and disputed-award masking use units when available. Nonterminating fractions display an approximation sign.

`adminConfirmMatchStarters({requestId,matchId,starterPlayerIds,reason})` can remove no-shows before play, submissions or civilization picks. It updates unplayed Game rosters and untouched drafts, retains the planned roster for audit and keeps every original scoring reservation. The accepted roster determines podium thresholds and Emperor participation.

`adminFinalizeMatchSeries({requestId,matchId,expectedResultRevision,reason})` derives one team Match result from independently accepted Games under a configured majority-win series rule. Expected revision is zero initially. Remake/no-contest Games do not earn awards; missing/disputed Games before the decisive result prevent finalization. Repeating finalization is idempotent. After a Game correction, resolve its dispute and finalize the series again; the public standings mask its prior award while unresolved. Automatic series scheduling and FFA series rules remain separate work.

Placements still require active, source-bound server evidence. The duplicate branch's free-form admin placement-entry callable is intentionally superseded by that qualification contract. Solo diplomatic FFA retains its existing rating calculation; shared victories remain unrated and corrections rebuild ratings in either direction.
