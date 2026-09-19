import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCivilizationDraftPick,
  availableCivilizationsForPlayer,
  CivilizationDraftValidationError,
  createCivilizationDraft,
} from "../lib/engines/civilizationDraftEngine.js";

const pool = [
  "Italians",
  "Franks",
  "Byzantines",
  "Spanish",
  "Teutons",
  "Britons",
  "Burgundians",
  "Bohemians",
  "Saracens",
  "Sicilians",
  "Berbers",
  "Portuguese",
];

function participant(playerId, team, slot) {
  return { playerId, team, slot };
}

function configuration(overrides = {}) {
  return {
    mode: "DRAFT",
    allowed: pool,
    banned: [],
    customRuleCode: null,
    draft: {
      ruleVersion: "AOF_CIV_DRAFT_V1",
      turnOrder: "TEAM_INTERLEAVED",
      reusePolicy: "RESET_EACH_GAME",
      uniqueWithinGame: true,
      ...overrides,
    },
  };
}

function completeDraft(state) {
  let next = state;
  while (next.status === "ACTIVE") {
    const turn = next.turns[next.currentTurnIndex];
    const legal = availableCivilizationsForPlayer(next, turn.playerId, turn.team);
    next = applyCivilizationDraftPick(next, turn.playerId, legal[0]);
  }
  return next;
}

test("4v4 draft gives every player one unique civilization", () => {
  const participants = [
    participant("a1", 1, 1), participant("a2", 1, 2),
    participant("a3", 1, 3), participant("a4", 1, 4),
    participant("b1", 2, 5), participant("b2", 2, 6),
    participant("b3", 2, 7), participant("b4", 2, 8),
  ];
  const draft = completeDraft(createCivilizationDraft({
    matchId: "M1",
    gameId: "G1",
    gameNumber: 1,
    participants,
    civilizationConfiguration: configuration(),
  }));

  assert.equal(draft.status, "COMPLETED");
  assert.equal(draft.selections.length, 8);
  assert.equal(new Set(draft.selections.map(selection => selection.playerId)).size, 8);
  assert.equal(new Set(draft.selections.map(selection => selection.civilization)).size, 8);
});

test("FFA uses every participant directly and does not require captains", () => {
  const participants = Array.from(
    { length: 6 },
    (_, index) => participant(`ffa-${index + 1}`, null, index + 1),
  );
  const draft = createCivilizationDraft({
    matchId: "FFA-M1",
    gameId: "G1",
    gameNumber: 1,
    participants,
    civilizationConfiguration: configuration({ turnOrder: "TEAM_SNAKE" }),
  });

  assert.equal(draft.turns.length, 6);
  assert.deepEqual(
    new Set(draft.turns.map(turn => turn.playerId)),
    new Set(participants.map(player => player.playerId)),
  );
  assert.ok(draft.turns.every(turn => turn.team === null));
});

test("three-team snake draft includes every team and every player", () => {
  const participants = [
    participant("a1", 1, 1), participant("a2", 1, 2),
    participant("b1", 2, 3), participant("b2", 2, 4),
    participant("c1", 3, 5), participant("c2", 3, 6),
  ];
  const draft = createCivilizationDraft({
    matchId: "THREE-TEAM",
    gameId: "G1",
    gameNumber: 1,
    participants,
    civilizationConfiguration: configuration({ turnOrder: "TEAM_SNAKE" }),
  });

  assert.equal(draft.turns.length, 6);
  assert.deepEqual(new Set(draft.turns.map(turn => turn.team)), new Set([1, 2, 3]));
  assert.deepEqual(
    new Set(draft.turns.map(turn => turn.playerId)),
    new Set(participants.map(player => player.playerId)),
  );
});

test("a player cannot pick out of turn or claim a used unique civilization", () => {
  const participants = [
    participant("a", 1, 1),
    participant("b", 2, 2),
    participant("c", 1, 3),
    participant("d", 2, 4),
  ];
  const initial = createCivilizationDraft({
    matchId: "M2",
    gameId: "G1",
    gameNumber: 1,
    participants,
    civilizationConfiguration: configuration({ turnOrder: "SLOT" }),
  });

  assert.throws(
    () => applyCivilizationDraftPick(initial, "b", "Italians"),
    CivilizationDraftValidationError,
  );

  const afterFirst = applyCivilizationDraftPick(initial, "a", "Italians");
  assert.throws(
    () => applyCivilizationDraftPick(afterFirst, "b", "Italians"),
    CivilizationDraftValidationError,
  );
});

test("MATCH_UNIQUE removes every earlier civilization from a later Game", () => {
  const participants = [
    participant("a", 1, 1),
    participant("b", 2, 2),
  ];
  const draft = createCivilizationDraft({
    matchId: "BO3",
    gameId: "G2",
    gameNumber: 2,
    participants,
    civilizationConfiguration: configuration({ reusePolicy: "MATCH_UNIQUE" }),
    priorSelections: [
      { gameNumber: 1, playerId: "a", team: 1, civilization: "Italians" },
      { gameNumber: 1, playerId: "b", team: 2, civilization: "Franks" },
    ],
  });

  assert.equal(draft.pool.includes("Italians"), false);
  assert.equal(draft.pool.includes("Franks"), false);
});

test("PLAYER_UNIQUE blocks only that player's earlier civilization", () => {
  const participants = [
    participant("a", 1, 1),
    participant("b", 2, 2),
  ];
  const draft = createCivilizationDraft({
    matchId: "BO3-P",
    gameId: "G2",
    gameNumber: 2,
    participants,
    civilizationConfiguration: configuration({ reusePolicy: "PLAYER_UNIQUE_IN_MATCH" }),
    priorSelections: [
      { gameNumber: 1, playerId: "a", team: 1, civilization: "Italians" },
    ],
  });

  assert.equal(availableCivilizationsForPlayer(draft, "a", 1).includes("Italians"), false);
  assert.equal(availableCivilizationsForPlayer(draft, "b", 2).includes("Italians"), true);
});

test("TEAM_UNIQUE blocks a civilization for teammates but not opponents", () => {
  const participants = [
    participant("a1", 1, 1),
    participant("a2", 1, 2),
    participant("b1", 2, 3),
    participant("b2", 2, 4),
  ];
  const draft = createCivilizationDraft({
    matchId: "BO3-T",
    gameId: "G2",
    gameNumber: 2,
    participants,
    civilizationConfiguration: configuration({ reusePolicy: "TEAM_UNIQUE_IN_MATCH" }),
    priorSelections: [
      { gameNumber: 1, playerId: "a1", team: 1, civilization: "Italians" },
    ],
  });

  assert.equal(availableCivilizationsForPlayer(draft, "a2", 1).includes("Italians"), false);
  assert.equal(availableCivilizationsForPlayer(draft, "b1", 2).includes("Italians"), true);
});

test("draft creation rejects a pool that cannot finish uniquely", () => {
  const participants = [
    participant("a", 1, 1),
    participant("b", 2, 2),
    participant("c", 3, 3),
  ];
  assert.throws(
    () => createCivilizationDraft({
      matchId: "IMPOSSIBLE",
      gameId: "G1",
      gameNumber: 1,
      participants,
      civilizationConfiguration: {
        ...configuration(),
        allowed: ["Italians", "Franks"],
      },
    }),
    /requires 3 unique civilizations but only 2 are available/,
  );
});

test("Game-specific pools must be subsets of the Event pool", () => {
  assert.throws(
    () => createCivilizationDraft({
      matchId: "BAD-POOL",
      gameId: "G2",
      gameNumber: 2,
      participants: [participant("a", 1, 1), participant("b", 2, 2)],
      civilizationConfiguration: configuration({
        gamePools: { "2": ["Italians", "NotARealEventCivilization"] },
      }),
    }),
    /not in the Event's allowed civilization pool/,
  );
});
