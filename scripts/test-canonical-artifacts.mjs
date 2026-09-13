import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { readCanonicalStore } from "./lib/canonical-artifacts.mjs";
import { analyzeCanonicalReplay } from "../functions/src/engines/matchAnalysis.ts";

test("canonical consumer reads and verifies later chunks before filtering", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "aof-chunks-"));
  try {
    const chunks = [];
    for (let i = 0; i < 2; i++) {
      const data = gzipSync(JSON.stringify({ operationOrdinal: i, keep: i === 1 }) + "\n");
      const uri = `chunk-${i}.jsonl.gz`;
      await writeFile(path.join(directory, uri), data);
      chunks.push({ uri, sha256: createHash("sha256").update(data).digest("hex"),
        byteLength: data.length, encoding: "jsonl_gzip", recordCount: 1, firstOrdinal: i, lastOrdinal: i });
    }
    const store = { recordCount: 2, chunks };
    assert.deepEqual(await readCanonicalStore(directory, store, value => value.keep), [{ operationOrdinal: 1, keep: true }]);
    await writeFile(path.join(directory, chunks[1].uri), "corruption");
    await assert.rejects(readCanonicalStore(directory, store), /artifact/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("existing match analyzer consumes the canonical golden with honest queue quantities", async () => {
  const snapshot = JSON.parse(await readFile(new URL("../replay-tools/tests/goldens/controlled-canonical.json", import.meta.url)));
  const manifest = { schemaVersion: snapshot.schemaVersion, match: snapshot.match,
    participants: snapshot.participants, teams: [], initialState: { map: { width: 2, height: 3 } } };
  const result = analyzeCanonicalReplay({ manifest, facts: snapshot.facts, initialObjects: snapshot.initialObjects });
  const player = result.players.find(p => p.playerId === 1);
  assert.equal(player.fundamentals.queueCommands, 4);
  assert.equal(player.fundamentals.queuedAmountPositive, 5);
  assert.equal(player.fundamentals.researchCommands, 1);
  assert.equal(result.pairInteractions.find(p => p.fromPlayerId === 1 && p.toPlayerId === 2).diplomacyChanges.length, 2);
});
