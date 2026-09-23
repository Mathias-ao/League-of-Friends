import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTownBellControl, safeFileName, semanticDiff, unresolvedEntities, sectionBoundary } from "../lib.mjs";

test("safeFileName strips paths and unsafe characters", () => {
  assert.equal(safeFileName("../bad/<name>.aoe2record"), "_name_.aoe2record");
});

test("semanticDiff reports precise nested paths", () => {
  const changes = semanticDiff({ a: { b: 1 }, c: 2 }, { a: { b: 3 }, d: 4 });
  assert.deepEqual(changes.map((item) => item.path), ["/a/b", "/c", "/d"]);
});

test("unresolvedEntities finds unresolved command catalogue IDs", () => {
  const value = unresolvedEntities({
    commandEvidence: {
      queueRequestsByPlayerAndUnit: {
        "1": [{ entity: { rawId: 9999, resolutionStatus: "unresolved" }, commandCount: 2 }],
      },
      researchRequestsByPlayerAndTechnology: {
        "1": [{ entity: { rawId: 101, resolutionStatus: "reference_catalog_unqualified_for_replay_patch" }, commandCount: 1 }],
      },
    },
  });
  assert.deepEqual(value, [{ kind: "unit", rawId: 9999, commandCount: 2 }]);
});

test("truth boundaries are explicit", () => {
  assert.equal(sectionBoundary("military"), "observed requests");
  assert.equal(sectionBoundary("battle"), "inferred");
  assert.equal(sectionBoundary("raw"), "observed raw evidence");
});


test("normalizeTownBellControl extracts identities and metric values", () => {
  const report = {
    schema_version: 2,
    meta: {
      duration_ms: 123456,
      game_build: 185872,
      save_version: 69,
      players: [
        { number: 1, name: "Mr Greed", civilization: "Spanish", civilization_id: 14 },
        { number: 2, name: "T90", civilization: "Britons", civilization_id: 2 },
      ],
    },
    players: {
      "1": { metrics: { villagers_trained: { value: 17 }, tc_idle_dark_age: { value: 12.5 } } },
      "2": { metrics: { villagers_trained: { value: 18 }, tc_idle_dark_age: { value: null, na_reason: "unobservable" } } },
    },
  };
  const control = normalizeTownBellControl(report);
  assert.equal(control.schemaVersion, 2);
  assert.equal(control.players[0].name, "Mr Greed");
  assert.equal(control.players[0].metrics.villagers_trained.value, 17);
  assert.equal(control.players[1].metrics.tc_idle_dark_age.naReason, "unobservable");
});
