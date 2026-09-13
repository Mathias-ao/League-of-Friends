import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

export async function readCanonicalStore(directory, store, predicate = () => true) {
  if (!Array.isArray(store?.chunks) || store.inlineEvents?.length) {
    throw new Error("Expected a chunked canonical store");
  }
  const records = [];
  let total = 0;
  for (const ref of store.chunks) {
    if (typeof ref.uri !== "string" || path.basename(ref.uri) !== ref.uri || ref.uri.includes("\\")) {
      throw new Error("Invalid canonical artifact URI");
    }
    const file = path.join(directory, ref.uri);
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== ref.byteLength) {
      throw new Error(`Missing or invalid canonical artifact: ${ref.uri}`);
    }
    const hash = createHash("sha256");
    for await (const block of createReadStream(file)) hash.update(block);
    if (hash.digest("hex") !== ref.sha256 || ref.encoding !== "jsonl_gzip") {
      throw new Error(`Canonical artifact integrity mismatch: ${ref.uri}`);
    }
    const lines = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
    let count = 0, first = null, last = null;
    for await (const line of lines) {
      if (!line.trim()) throw new Error(`Empty canonical record: ${ref.uri}`);
      const value = JSON.parse(line);
      if (value.operationOrdinal !== total + count) throw new Error(`Canonical ordinal mismatch: ${ref.uri}`);
      first ??= value.operationOrdinal;
      last = value.operationOrdinal;
      count++;
      if (predicate(value)) records.push(value);
    }
    if (count !== ref.recordCount || first !== ref.firstOrdinal || last !== ref.lastOrdinal) {
      throw new Error(`Canonical chunk count/ordinal mismatch: ${ref.uri}`);
    }
    total += count;
  }
  if (total !== store.recordCount) throw new Error("Canonical store record count mismatch");
  return records;
}
