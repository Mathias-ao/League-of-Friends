# Phase 2 — Firestore Data Architecture

This document translates the frozen Phase 1 domain model into a Firestore-oriented backend design.

## Goals

The data model must support Season 1 efficiently while preserving the long-term pillars of the league:

- statistics
- achievements
- rivalries / War Room
- Gold economy

The model intentionally avoids reproducing the old Google Sheets layout one table = one collection.

## Core design rules

1. Top-level collections represent durable aggregate roots or query-heavy global ledgers.
2. Bounded data that belongs to one aggregate is embedded where that keeps reads coherent.
3. Unbounded child history uses subcollections.
4. Client writes are limited to narrow self-service actions. Authoritative competition/economy mutations go through backend commands.
5. Ledger entries are append-oriented and idempotent.
6. Derived projections may be rebuilt from authoritative facts.
7. Historical event/match configuration is snapshotted.
8. Raw game facts are separate from derived and inferred data.

---

## Collection map

```text
/leagueState/{singleton}

/players/{playerId}
/players/{playerId}/externalAliases/{aliasId}
/players/{playerId}/notifications/{notificationId}
/players/{playerId}/achievements/{achievementId}
/players/{playerId}/titles/{titleAwardId}
/players/{playerId}/ratingHistory/{entryId}

/seasons/{seasonId}
/seasons/{seasonId}/participants/{playerId}
/seasons/{seasonId}/standings/{playerId}
/seasons/{seasonId}/warRoomStandings/{playerId}

/events/{eventId}
/events/{eventId}/participants/{playerId}
/events/{eventId}/matchPlans/{planId}
/events/{eventId}/matches/{matchId}
/events/{eventId}/matches/{matchId}/games/{gameId}
/events/{eventId}/matches/{matchId}/games/{gameId}/rawStats/{documentId}

/challenges/{challengeId}
/rivalries/{rivalryId}
/rivalries/{rivalryId}/history/{entryId}

/leaguePointLedger/{entryId}
/warRoomPointLedger/{entryId}
/goldLedger/{entryId}

/achievementDefinitions/{achievementDefinitionId}
/titleDefinitions/{titleDefinitionId}
/scoringProfiles/{scoringProfileId}

/activity/{activityId}
/stories/{storyId}
/adminAudit/{auditId}
/processingJobs/{jobId}
/idempotencyKeys/{keyId}
```

The exact names remain implementation details, but these aggregate boundaries are the baseline.

---

## `leagueState/singleton`

Purpose: global state that must have one current value.

Suggested fields:

```ts
{
  activeSeasonId: string | null,
  featuredEventId: string | null,
  currentEmperorPlayerId: string | null,
  warRoom: {
    seasonId: string | null,
    status: "CLOSED" | "OPEN",
    openedAt: Timestamp | null,
    triggerRef: EntityRef | null
  },
  updatedAt: Timestamp
}
```

Invariants:

- at most one active season
- at most one current Emperor
- War Room state is scoped to the active season

---

## `players/{playerId}`

Purpose: permanent league identity for one real person.

Suggested fields:

```ts
{
  authUid: string,
  steamName: string,
  steamNameNormalized: string,
  discordName: string | null,
  avatarUrl: string | null,
  membershipStatus: "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED",
  role: "PLAYER" | "ADMIN",
  joinedAt: Timestamp,
  updatedAt: Timestamp,

  // fast projections, not authoritative histories
  currentPowerRating: number | null,
  provisionalRating: boolean,
  goldBalance: number
}
```

Private authentication/email details should not be duplicated here unless required. Firebase Auth remains the source of truth for sign-in identity.

### External aliases

`players/{playerId}/externalAliases/{aliasId}` stores internal replay-matching aliases when Steam names change.

```ts
{
  type: "STEAM_NAME",
  value: string,
  normalizedValue: string,
  active: boolean,
  firstSeenAt: Timestamp,
  lastSeenAt: Timestamp | null
}
```

This is technical matching history, not a user-facing old-name feature.

---

## `seasons/{seasonId}`

```ts
{
  name: string,
  status: "DRAFT" | "UPCOMING" | "ACTIVE" | "COMPLETED" | "ARCHIVED",
  startsAt: Timestamp,
  endsAt: Timestamp,

  scoringDefaults: ScoringSnapshot,
  championshipConfig: ChampionshipConfig,

  finalSnapshot?: {
    completedAt: Timestamp,
    regularSeasonLeaderPlayerId: string | null,
    championPlayerId: string | null
  },

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

`seasons/{seasonId}/participants/{playerId}` tracks season participation without redefining Player identity.

`seasons/{seasonId}/standings/{playerId}` is a derived, fast-read projection.

---

## `events/{eventId}`

Purpose: scheduled league gathering and frozen competition design.

Suggested fields:

```ts
{
  seasonId: string | null,
  title: string,
  description: string,
  artworkUrl: string | null,

  status: "DRAFT" | "PUBLISHED" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED",
  featured: boolean,

  startsAt: Timestamp,
  endsAt: Timestamp | null,
  signupDeadlineAt: Timestamp,
  checkInOpensAt: Timestamp,
  checkInClosesAt: Timestamp | null,

  minParticipants: number | null,
  maxParticipants: number | null,
  waitingListEnabled: boolean,
  signupRosterVisibility: "VISIBLE" | "HIDDEN",

  competitionStyle: "ONE_V_ONE" | "TWO_V_TWO" | "BIG_TEAM" | "FFA",

  planningConfig: MatchPlanningConfig,
  gameConfig: GameConfiguration,
  scoringSnapshot: ScoringSnapshot,
  goldRewardSnapshot: GoldRewardConfig,
  specialMechanics: SpecialMechanicConfig[],

  createdBy: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  completedAt: Timestamp | null
}
```

The stored configuration is a snapshot. Changing a preset later cannot change an existing Event.

---

## `events/{eventId}/participants/{playerId}`

Purpose: RSVP, queue state and attendance for one Player/Event relationship.

```ts
{
  playerId: string,
  rsvp: "YES" | "NO" | "UNANSWERED",
  signupState: "CONFIRMED" | "WAITING_LIST" | "NONE",
  respondedAt: Timestamp | null,

  attendance: "NOT_CHECKED" | "CHECKED_IN" | "NO_SHOW" | "LATE_ADDED",
  checkedInAt: Timestamp | null,

  addedByAdmin: boolean,
  updatedAt: Timestamp
}
```

Match planning consumes eligible checked-in participants rather than RSVP alone.

---

## Match plans

`events/{eventId}/matchPlans/{planId}` represents a proposal before official Match documents are created.

```ts
{
  status: "PROPOSED" | "APPROVED" | "REJECTED",
  plannerVersion: string,
  generatedAt: Timestamp,
  generatedBy: string,
  configSnapshot: MatchPlanningConfig,

  matches: ProposedMatch[],
  summary: {
    participantCount: number,
    scheduledPlayerCount: number,
    sittingOutPlayerIds: string[]
  }
}
```

Plans are intentionally bounded and may embed proposed matches/teams in one document. Official Matches are only written after approval.

---

## Matches

Primary path for Event Matches:

`events/{eventId}/matches/{matchId}`

Challenges outside ordinary Events need a canonical Match location too. To avoid two incompatible Match stores, Phase 2 will implement a global canonical `/matches/{matchId}` collection and Event documents will reference their Match IDs. This is the preferred final shape:

```text
/matches/{matchId}
/matches/{matchId}/games/{gameId}
```

Event queries use `eventId` plus an index.

This prevents War Room, finals, off-season and exhibition Matches from needing artificial Event wrappers.

Suggested Match fields:

```ts
{
  eventId: string | null,
  seasonId: string | null,
  challengeId: string | null,
  rivalryId: string | null,

  context: CompetitionContext,
  status: "PROPOSED" | "READY" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "DISPUTED",
  format: "ONE_V_ONE" | "TWO_V_TWO" | "THREE_V_THREE" | "FOUR_V_FOUR" | "FFA",

  participants: MatchParticipant[],
  seriesRule: {
    maxGames: number,
    gamesRequiredToWin: number
  },
  specialConditions: SpecialMatchCondition[],

  winner: MatchWinner | null,
  completedGameCount: number,

  resultVersion: number,
  processingState: "NOT_READY" | "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED",

  createdAt: Timestamp,
  updatedAt: Timestamp,
  completedAt: Timestamp | null
}
```

`participants` is bounded to at most eight AoE2 players and is therefore embedded for coherent reads.

---

## Games

`matches/{matchId}/games/{gameId}`

One Game = one actual AoE2 match/replay.

```ts
{
  sequence: number,
  status: "READY" | "COMPLETED" | "REMAKE" | "NO_CONTEST" | "DISPUTED",

  players: GamePlayer[],
  map: string | null,
  gameMode: string | null,
  victorySettings: VictorySettings | null,
  diplomacyEnabled: boolean | null,
  durationSeconds: number | null,

  winner: GameWinner | null,
  placements: GamePlacement[],

  replay: {
    status: "NONE" | "AVAILABLE" | "PARSED" | "FAILED",
    externalReference: string | null,
    parserName: string | null,
    parserVersion: string | null,
    parsedAt: Timestamp | null,
    sourceHash: string | null
  },

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Exact raw-stat fields are intentionally deferred until the `.aoe2record` capability spike.

---

## Raw game statistics

Avoid placing a potentially large parser payload directly into the Game document.

Use:

`matches/{matchId}/games/{gameId}/rawStats/{documentId}`

A parser run can preserve:

```ts
{
  parserName: string,
  parserVersion: string,
  sourceHash: string,
  schemaVersion: string,
  extractedAt: Timestamp,
  payload: Record<string, unknown>
}
```

For queryable core facts, normalize selected reliable fields into the Game document or dedicated derived-stat projections. Raw payload is provenance, not the primary query interface.

---

## League Point ledger

`leaguePointLedger/{entryId}`

```ts
{
  seasonId: string,
  playerId: string,
  eventId: string | null,
  matchId: string | null,
  gameId: string | null,

  amount: number,
  reasonCode: string,
  description: string,

  sourceId: string,
  sourceVersion: number,
  idempotencyKey: string,

  reversalOfEntryId: string | null,
  createdAt: Timestamp
}
```

Corrections use reversal/correction entries rather than silent ledger mutation.

---

## War Room Point ledger

`warRoomPointLedger/{entryId}` follows the same accounting pattern, but includes rivalry/challenge references and never feeds the seasonal league standings projection.

---

## Gold ledger

`goldLedger/{entryId}`

```ts
{
  playerId: string,
  amount: number,
  transactionType:
    | "EVENT_REWARD"
    | "MATCH_REWARD"
    | "ACHIEVEMENT_REWARD"
    | "ADMIN_ADJUSTMENT"
    | "CHALLENGE_STAKE"
    | "BET_STAKE"
    | "BET_PAYOUT"
    | "REFUND",

  eventId: string | null,
  matchId: string | null,
  achievementId: string | null,
  challengeId: string | null,

  idempotencyKey: string,
  createdAt: Timestamp
}
```

Season 1 implements earning and admin correction. Future transaction types are architectural extension points, not Season 1 features.

`players/{playerId}.goldBalance` is a transactionally maintained projection for fast UI reads.

---

## Power rating history

`players/{playerId}/ratingHistory/{entryId}`

```ts
{
  previousRating: number | null,
  newRating: number,
  delta: number | null,
  algorithm: string,
  algorithmVersion: string,
  matchId: string | null,
  reason: "INITIAL_SEED" | "MATCH_RESULT" | "CORRECTION",
  createdAt: Timestamp
}
```

Current rating is projected onto the Player document.

---

## Rivalries

`rivalries/{rivalryId}`

```ts
{
  playerIds: [string, string],
  status: "EMERGING" | "ACTIVE" | "ESCALATING" | "DORMANT" | "RESOLVED",
  strength: number,
  inferenceVersion: string,
  currentSeasonActivatedAt: Timestamp | null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

`rivalries/{rivalryId}/history/{entryId}` stores explainable signals/escalations/resolutions without bloating the current Rivalry document.

---

## Challenges

`challenges/{challengeId}`

```ts
{
  challengerPlayerId: string,
  targetPlayerId: string,
  rivalryId: string | null,

  type: string,
  status: "AVAILABLE" | "ISSUED" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "COMPLETED",
  unlockSource: EntityRef,
  rulesSnapshot: ChallengeRules,
  stakesSnapshot: ChallengeStakes,

  resultingMatchId: string | null,
  expiresAt: Timestamp | null,
  cooldownKey: string | null,

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

Accepted Challenges create a canonical `/matches/{matchId}` document through backend command logic.

---

## Achievement definitions and awards

`achievementDefinitions/{definitionId}` contains configurable rule metadata.

The exact rule-engine DSL is deferred. Definitions are versioned.

Player awards live under:

`players/{playerId}/achievements/{awardId}`

```ts
{
  definitionId: string,
  definitionVersion: number,
  scope: "SEASONAL" | "LIFETIME",
  seasonId: string | null,
  triggerRef: EntityRef,
  earnedAt: Timestamp,
  displayOnNametag: boolean
}
```

Invalidated awards may be removed from player-facing data after a correction; admin audit still records the correction.

---

## Activity, stories and notifications

### Activity

`activity/{activityId}` is structured system output.

### Stories

`stories/{storyId}` is curated/published content. Automatic processing may create draft candidates but does not publish without admin action in Version 1.

### Notifications

Player-specific notifications are stored under the Player for efficient queries:

`players/{playerId}/notifications/{notificationId}`

Important unresolved actions remain active until resolved.

---

## Admin audit

`adminAudit/{auditId}`

```ts
{
  actorUid: string,
  actorPlayerId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  reason: string | null,
  before: unknown | null,
  after: unknown | null,
  createdAt: Timestamp
}
```

Large before/after snapshots should be kept bounded. Detailed specialized correction records can be used when necessary.

---

## Idempotency

`idempotencyKeys/{keyId}` reserves a client-generated or server-derived operation key.

Critical commands such as:

- create event
- approve match plan
- finalize result
- correct result
- process scoring
- award Gold
- accept challenge

must be safe to retry.

The command transaction checks/creates the idempotency document and writes authoritative changes atomically where possible.

---

## Processing model

A finalized result is authoritative before secondary enrichment.

Primary transaction/process:

1. validate Match/Game state
2. accept authoritative result
3. mark processing pending

Then backend processing performs idempotent stages:

1. League/War Room ledger changes
2. Gold rewards
3. rating update
4. derived-stat updates
5. achievement evaluation
6. rivalry evaluation
7. records/activity/notifications

Failure in achievement/rivalry/story processing must not erase or reject an otherwise valid result.

`processingJobs/{jobId}` records stage status and retry metadata for admin visibility.

---

## Security boundary

### Client-readable

Authenticated league members may read most league-facing documents including:

- players (public profile fields only)
- seasons/standings
- events/participants
- matches/games/statistics
- rivalries/challenges/War Room data
- achievements/titles
- published stories/activity suitable for members

### Client-writable

Direct writes should be extremely narrow. Version 1 should prefer callable functions even for RSVP/check-in so business rules remain centralized.

### Server-only writes

Clients must never directly write:

- Match results
- standings
- power ratings
- point ledgers
- Gold ledgers/balances
- achievements
- rivalry state
- Emperor state
- admin audit
- processing jobs

Firebase Admin SDK in Cloud Functions bypasses Security Rules and enforces these through server command authorization/validation.

---

## Required indexes — initial

Expected composite query shapes include:

- events by seasonId + startsAt
- events by status + startsAt
- matches by eventId + status
- matches by seasonId + completedAt
- challenges by targetPlayerId + status
- challenges by challengerPlayerId + status
- rivalries using array membership on playerIds + status
- activity by createdAt
- stories by publication status + publishedAt
- ledger entries by playerId + createdAt
- ledger entries by seasonId + playerId

Only indexes required by real UI/backend query paths should be added.

---

## Phase 2 implementation order

1. Repository/Firebase skeleton
2. Shared TypeScript domain types
3. Firestore converters/repositories
4. Authentication/authorization helpers
5. Player + Season commands
6. Event + RSVP/check-in commands
7. Match planner and plan approval
8. Match/Game result flow
9. accounting ledgers (League, War Room, Gold)
10. rating and statistics projections
11. achievement/rivalry processing interfaces
12. `.aoe2record` capability spike before raw-stat schema freeze

This document should be updated when implementation proves a boundary wrong; changes to frozen Phase 1 principles require an explicit architectural decision rather than an incidental code patch.
