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


function findTownBellMetricPlayers(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (!Array.isArray(node.players) && node.players && typeof node.players === "object") {
    const values = Object.values(node.players);
    if (values.length && values.every((value) => value && typeof value === "object" && value.metrics && typeof value.metrics === "object")) {
      return node.players;
    }
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      const found = findTownBellMetricPlayers(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function findTownBellIdentityPlayers(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (Array.isArray(node.players) && node.players.every((value) => value && typeof value === "object")) {
    if (node.players.some((value) => value.number != null || value.name != null)) return node.players;
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      const found = findTownBellIdentityPlayers(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function normalizeTownBellControl(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new Error("TownBell control must be a JSON object");
  }
  const metricPlayers = findTownBellMetricPlayers(report);
  if (!metricPlayers) throw new Error("TownBell report does not contain player metric blocks");
  const identities = findTownBellIdentityPlayers(report) || [];
  const byNumber = new Map(
    identities
      .filter((player) => player?.number != null)
      .map((player) => [String(player.number), player])
  );

  const players = Object.entries(metricPlayers)
    .map(([key, row]) => {
      const number = Number(key);
      const identity = byNumber.get(String(key)) || {};
      const metrics = {};
      for (const [metricId, metric] of Object.entries(row?.metrics || {})) {
        metrics[metricId] = {
          value: metric?.value ?? null,
          naReason: metric?.na_reason ?? null,
        };
      }
      return {
        number: Number.isFinite(number) ? number : key,
        name: identity.name ?? null,
        civilization: identity.civilization ?? null,
        civilizationId: identity.civilization_id ?? null,
        metrics,
      };
    })
    .sort((a, b) => Number(a.number) - Number(b.number));

  return {
    source: "townbell_report",
    schemaVersion: report.schema_version ?? null,
    durationMs: report.meta?.duration_ms ?? null,
    gameBuild: report.meta?.game_build ?? null,
    saveVersion: report.meta?.save_version ?? null,
    playerCount: players.length,
    players,
  };
}
