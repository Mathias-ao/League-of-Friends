import test from "node:test";
import assert from "node:assert/strict";
import { safeFileName, semanticDiff, unresolvedEntities, sectionBoundary } from "../lib.mjs";

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
