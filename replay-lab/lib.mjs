import path from "node:path";

export function safeFileName(value) {
  const name = path.basename(String(value ?? "replay.aoe2record"))
    .replace(/[^a-zA-Z0-9._ -]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return name || "replay.aoe2record";
}

export function semanticDiff(before, after, pointer = "", changes = [], limit = 500) {
  if (changes.length >= limit) return changes;
  if (Object.is(before, after)) return changes;

  const beforeArray = Array.isArray(before);
  const afterArray = Array.isArray(after);
  if (beforeArray || afterArray) {
    if (!(beforeArray && afterArray) || before.length !== after.length) {
      changes.push({ path: pointer || "/", before, after });
      return changes;
    }
    for (let i = 0; i < before.length && changes.length < limit; i += 1) {
      semanticDiff(before[i], after[i], `${pointer}/${i}`, changes, limit);
    }
    return changes;
  }

  const beforeObject = before !== null && typeof before === "object";
  const afterObject = after !== null && typeof after === "object";
  if (beforeObject || afterObject) {
    if (!(beforeObject && afterObject)) {
      changes.push({ path: pointer || "/", before, after });
      return changes;
    }
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      if (changes.length >= limit) break;
      const escaped = key.replace(/~/g, "~0").replace(/\//g, "~1");
      const next = `${pointer}/${escaped}`;
      if (!(key in before)) changes.push({ path: next, change: "added", after: after[key] });
      else if (!(key in after)) changes.push({ path: next, change: "removed", before: before[key] });
      else semanticDiff(before[key], after[key], next, changes, limit);
    }
    return changes;
  }

  changes.push({ path: pointer || "/", before, after });
  return changes;
}

function inventoryEntries(value) {
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap((items) => Array.isArray(items) ? items : []);
}

export function unresolvedEntities(statistics) {
  const commandEvidence = statistics?.commandEvidence ?? {};
  const groups = [
    ["unit", commandEvidence.queueRequestsByPlayerAndUnit],
    ["technology", commandEvidence.researchRequestsByPlayerAndTechnology],
    ["building", commandEvidence.buildingPlacementsByPlayerAndBuilding],
  ];
  const unresolved = [];
  for (const [kind, group] of groups) {
    for (const item of inventoryEntries(group)) {
      if (item?.entity?.resolutionStatus === "unresolved") {
        unresolved.push({
          kind,
          rawId: item.entity.rawId,
          commandCount: item.commandCount ?? null,
        });
      }
    }
  }
  return unresolved;
}

export function sectionBoundary(section) {
  return {
    overview: "mixed",
    players: "mixed",
    opening: "reconstructed/inferred",
    economy: "estimated/reconstructed",
    military: "observed requests",
    battle: "inferred",
    "map-presence": "inferred/reconstructed",
    execution: "observed commands",
    timeline: "observed parser facts",
    raw: "observed raw evidence",
    diagnostics: "coverage/diagnostics",
    comparison: "derived diff",
  }[section] ?? "mixed";
}
