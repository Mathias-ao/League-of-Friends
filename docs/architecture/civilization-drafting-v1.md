# Age of Friends — Civilization Drafting V1

Status: implemented foundation  
Rule version: `AOF_CIV_DRAFT_V1`

## Purpose

Civilization drafting is an authoritative Age of Friends competition system. It is not an external tournament-site integration.

The draft starts from the approved Match roster and Game configuration, allows the actual Match participants to choose civilizations, prevents illegal or duplicate choices on the server, records an immutable action trail, and writes the completed assignments directly onto the Game roster for later replay verification.

The system is deliberately based on **Match → Game**, not on a hard-coded 4v4 shape.

## Player flow

For a normal drafted Game:

**Event signup → event-day check-in → approved Match/teams → civilization draft → Game played in AoE2 → replay verification**

When an approved Match uses `civilizations.mode = "DRAFT"`, the first Game draft is created with the Match.

Every participant can see the same live draft board. Participant clients subscribe read-only to the draft document; after the server commits a pick, the other players' Battle views refresh automatically.

Every participant can see:

- the complete civilization pool;
- the authoritative turn order;
- completed picks;
- whose turn is active;
- the Match/Game reuse rule.

Only the player whose turn is active can commit a pick.

When the final pick is committed, the draft becomes `COMPLETED` and every selected civilization is copied to the corresponding `games/{gameId}.players[]` entry with `civilizationSelection = "CHOSEN"`.

## Storage

Draft state is stored under the Match:

`matches/{matchId}/civilizationDrafts/{gameId}`

Each committed choice also creates an immutable action record:

`matches/{matchId}/civilizationDrafts/{gameId}/actions/R{revision}-T{turn}`

The draft document is the current state. Action documents and admin audit entries provide the event-day audit trail.

## Configuration

`CivilizationConfiguration` supports `mode: "DRAFT"` with:

```ts
{
  mode: "DRAFT",
  allowed: ["Italians", "Franks", "Byzantines", "Spanish"],
  banned: [],
  customRuleCode: null,
  draft: {
    ruleVersion: "AOF_CIV_DRAFT_V1",
    turnOrder: "RANDOM",
    reusePolicy: "RESET_EACH_GAME",
    uniqueWithinGame: true,
    gamePools: {}
  }
}
```

### Turn order

- `RANDOM` — all participants receive a deterministic randomized order.
- `SLOT` — approved Match slot order.
- `TEAM_INTERLEAVED` — one player from each approved team in sequence, repeating until every player has a turn. Team order is deterministically randomized so Team 1 is not permanently privileged.
- `TEAM_SNAKE` — like team interleaving, but the team order reverses each round.

FFA participants have no team. Team-based turn modes therefore fall back to individual randomized order for FFA.

The order is generated from the approved Match/Game identity and snapshotted. Clients never generate the order.

### Reuse policy across Games in one Match

Every Game can still require unique civilizations internally with `uniqueWithinGame: true`.

`reusePolicy` decides what happens when a Match contains later Games:

- `RESET_EACH_GAME` — all Event-approved civilizations return for the next Game.
- `PLAYER_UNIQUE_IN_MATCH` — a player cannot personally use the same civilization twice in the Match; another player may.
- `TEAM_UNIQUE_IN_MATCH` — once any player on a team uses a civilization, that team cannot use it again later in the Match.
- `MATCH_UNIQUE` — once a civilization appears anywhere in the Match, nobody may use it again in a later Game.

Before a later Game draft opens, all earlier Games must be completed. Completed prior drafts are used to derive the carry-over restrictions.

### Per-Game civilization pools

`gamePools` optionally narrows the Event's allowed civilization list for a particular Game:

```ts
gamePools: {
  "1": ["Italians", "Franks", "Byzantines", "Spanish"],
  "2": ["Saracens", "Berbers", "Portuguese", "Turks"]
}
```

Every Game-specific entry must remain a subset of the Event's authoritative `allowed` list.

This supports map-specific or phase-specific civilization pools without changing the draft engine.

## Supported Match shapes

The V1 engine operates on `MatchParticipant[]`, so the same implementation supports:

- 1v1;
- 2v2, 3v3 and 4v4;
- asymmetric teams;
- three or more teams when represented by distinct team numbers;
- FFA;
- multiple separate Matches inside one Event;
- multiple Games inside one Match once the series/game lifecycle creates those Games.

Attendance changes are therefore handled by the approved Match Plan. The draft never assumes the advertised Event roster size.

## Concurrency and authority

The browser never directly mutates draft state. Firestore rules permit read-only live subscription to a draft document only when the authenticated player's ID is present in that draft's snapshotted `participantIds`. Draft actions and all competition writes remain server-only.

`makeCivilizationDraftPick` uses a Firestore transaction and validates:

- the authenticated player is a Match participant;
- the Game is still eligible for drafting;
- the draft is active;
- it is that player's turn;
- the civilization belongs to the snapshotted pool;
- it remains available under Game uniqueness;
- it remains legal under Match carry-over rules.

Two players cannot successfully claim the same unique civilization through a race condition.

## Feasibility validation

Before a draft opens, the engine verifies that every participant has at least one legal civilization.

When civilizations must be unique within the Game, it also runs a matching check across players and their legal pools. This prevents a draft from starting when player/team carry-over restrictions would make it impossible to finish even though the raw pool count appears large enough.

## Event-day recovery

Administrators can reset a non-completed Game draft with `adminResetCivilizationDraft`.

A reset:

- requires an explicit reason;
- increments the draft revision;
- preserves the existing turn order by default or can reroll it;
- clears Game civilization assignments;
- leaves earlier revision action records intact;
- writes an administrator audit entry.

Completed Games cannot have their drafts reset through this command.

## Replay verification

The completed draft assignment is intended to become the expected civilization for replay qualification:

`draft selection → Game.players[].civilization → replay observed civilization`

A future replay qualification step should compare the observed replay civilization to the locked Game assignment. A mismatch must be surfaced as a qualification/correction case; replay ingestion must not silently replace the drafted assignment.

## Series boundary

The draft subsystem is Game-aware and Match-aware now. The current Match Plan approval flow still creates only `G1` with a best-of-1 `SeriesRule`.

That existing competition-orchestration limitation is intentionally not bypassed inside the draft feature. When BO3/series orchestration creates `G2` and `G3`, `ensureCivilizationDraft` can open those drafts and apply the configured carry-over policy without a new drafting model.

Series result finalization must be implemented in the result lifecycle before AoF starts creating BO3 Match Games in production.

## Verification

The backend CI builds the Functions project and runs draft-engine tests covering:

- 4v4 unique selection;
- FFA without captains;
- three-team snake ordering;
- out-of-turn and duplicate-pick rejection;
- Match-wide, player-wide and team-wide carry-over policies;
- impossible unique pools;
- invalid per-Game pool overrides.
