import assert from "node:assert/strict";
import test from "node:test";

import { toLifetimeGameInput } from "../three-battle-validation-lib.mjs";


test("selection evidence stays Battle-level and is not promoted to longitudinal input", () => {
  const boundBattle = {
    battleId: "B1",
    gameId: "G1",
    orderAtMs: 1,
    projection: { scope: { observedUntilMs: 1_000_000 } },
    participants: [{
      playerId: "player-1",
      statistics: {
        opening: {},
        economy: {},
        military: {},
        mapPresence: {},
        observedCommands: {
          count: 100,
          ratePerObservedMinute: 30,
          firstAtMs: 416,
          firstFiveObservedMinutesCount: 80,
          activeSecondCount: 200,
        },
        selectionEvidence: {
          averageSelectedObjectCount: 2.5,
          medianSelectedObjectCount: 2,
          maximumSelectedObjectCount: 20,
        },
      },
    }],
  };

  const input = toLifetimeGameInput(boundBattle, {
    status: "RESOLVED",
    playerId: "player-1",
  });
  const execution = input.players[0].execution;

  assert.equal(execution.firstCommandAtMs, 416);
  assert.equal("averageSelectionSize" in execution, false);
  assert.equal("medianSelectionSize" in execution, false);
  assert.equal("maximumSelectionSize" in execution, false);
});
