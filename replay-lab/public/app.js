const state = {
  file: null,
  runs: [],
  run: null,
  tab: "overview",
};

const tabs = [
  ["overview", "Overview"],
  ["players", "Players"],
  ["opening", "Opening"],
  ["economy", "Economy"],
  ["military", "Military"],
  ["battle", "Battle"],
  ["map-presence", "Map Presence"],
  ["execution", "Execution"],
  ["timeline", "Timeline"],
  ["raw", "Raw Evidence"],
  ["diagnostics", "Diagnostics"],
  ["comparison", "Comparison"],
];

const ECONOMY_TOWNBELL_MAP = {
  "villagersTrained.count": { id: "villagers_trained" },
  "villagersBy20Minutes.count": { id: "villagers_at_20min" },
  "tcIdleTimeDarkAge.valueMs": { id: "tc_idle_dark_age", unit: "duration" },
  "townCenters.count": { id: "town_center_count" },
  "firstExtraTownCenterTime.atMs": { id: "second_town_center", unit: "duration" },
  "thirdTownCenterTime.atMs": { id: "third_town_center", unit: "duration" },
  "longestTcIdleGap.valueMs": { id: "longest_idle_gap", unit: "duration" },
  "tcIdleGapsOver30s.count": { id: "idle_gaps_over_30s" },
  "economicTechsResearched.count": { id: "eco_techs_researched" },
  "ecoUpgradesByCastle.count": { id: "eco_upgrades_by_castle" },
  "horseCollar.inferredCompleteAtMs": { id: "horse_collar_time", unit: "duration" },
  "farmsPlaced.count": { id: "farms_built" },
  "firstFarm.atMs": { id: "first_farm", unit: "duration" },
  "farmsBeforeHorseCollar.count": { id: "farms_before_horse_collar" },
  "farmsBeforeCastle.count": { id: "farms_before_castle" },
  "firstBoarLure.atMs": { id: "first_boar_lure", unit: "duration" },
  "boarsTaken.count": { id: "boars_taken" },
  "deerTaken.count": { id: "deer_taken" },
  "market.transactions.count": { id: "market_transactions" },
  "market.volumeTraded.amount": { id: "market_volume" },
  "market.firstUse.atMs": { id: "market_first_use", unit: "duration" },
  "market.sales.count": { id: "market_sells" },
  "market.purchases.count": { id: "market_buys" },
};

const boundaries = {
  overview: "Mixed presentation — inspect section labels before treating values as facts.",
  players: "Mixed canonical identity and projected statistics.",
  opening: "Reconstructed / inferred. Build-order labels are models, not raw replay fields.",
  economy: "Estimated / reconstructed. When a TownBell report is attached, rows compare AoF against TownBell control values; blank TownBell cells mean no direct mapping.",
  military: "Observed command requests. Queue requests are not proof that units trained.",
  battle: "Inferred combat episodes. Raids do not prove kills or damage.",
  "map-presence": "Reconstructed / inferred spatial proxies.",
  execution: "Observed decoded commands and selection evidence.",
  timeline: "Observed parser facts in replay order.",
  raw: "Observed retained event evidence. Raw bytes can be shown explicitly.",
  diagnostics: "Coverage, compatibility and parser diagnostics.",
  comparison: "Diff between statistics projections over the same canonical evidence.",
};

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));
const pretty = (value) => JSON.stringify(value, null, 2);
const fmtTime = (ms) => {
  if (!Number.isFinite(Number(ms))) return "—";
  const total = Math.round(Number(ms) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

function showProgress(message, error = false) {
  const node = $("progress");
  node.textContent = message;
  node.classList.remove("hidden");
  node.classList.toggle("error", error);
}
function hideProgress() { $("progress").classList.add("hidden"); }

async function api(url, options) {
  const response = await fetch(url, options);
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
  return value;
}

async function refreshRuns(selectId = null) {
  state.runs = await api("/api/runs");
  renderRunList();
  if (selectId) await loadRun(selectId);
}

function renderRunList() {
  $("runList").innerHTML = state.runs.length ? state.runs.map((run) => `
    <button class="run-card ${state.run?.metadata?.id === run.id ? "active" : ""}" data-run="${esc(run.id)}">
      <strong>${esc(run.fileName)}</strong>
      <span>r${esc(run.statisticsRevision)} · ${esc(run.status)}</span>
      <small>${esc(new Date(run.createdAt).toLocaleString())}</small>
    </button>
  `).join("") : '<div class="muted small">No local runs yet.</div>';

  document.querySelectorAll("[data-run]").forEach((button) => {
    button.addEventListener("click", () => loadRun(button.dataset.run));
  });
}

async function loadRun(id) {
  state.run = await api(`/api/runs/${encodeURIComponent(id)}`);
  $("emptyState").classList.add("hidden");
  $("runView").classList.remove("hidden");
  renderRunList();
  renderShell();
  await renderTab();
}

function renderShell() {
  const run = state.run;
  $("runTitle").textContent = run.metadata.fileName;
  $("runKicker").textContent = `STATISTICS REVISION ${run.metadata.statisticsRevision}`;
  const compat = run.canonical?.source?.compatibility?.status ?? "unknown";
  const canonicalState = run.canonicalRun?.state ?? run.metadata?.canonicalState ?? "unknown";
  $("runMeta").textContent =
    `save ${run.replay?.saveVersion ?? "?"} · build ${run.replay?.build ?? "?"} · ${run.players.length} players · compatibility ${compat} · canonical ${canonicalState}`;
  $("auditButton").disabled = canonicalState === "verified_local";
  $("townBellButton").textContent = run.townBellControl ? "Replace TownBell report" : "Attach TownBell report";
  $("tabs").innerHTML = tabs.map(([id, label]) =>
    `<button class="${state.tab === id ? "active" : ""}" data-tab="${id}">${label}</button>`
  ).join("");
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.tab = button.dataset.tab;
      renderShell();
      await renderTab();
    });
  });
}

function card(label, value, note = "") {
  return `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${note ? `<small>${esc(note)}</small>` : ""}</div>`;
}

function jsonBlock(value) {
  return `<pre>${esc(pretty(value))}</pre>`;
}

const TECHNICAL_ROW_KEYS = new Set([
  "layer", "scope", "modelVersion", "formulaVersion", "methodVersion",
  "referenceVersion", "catalogVersion", "catalogSourceVersion",
  "sourceEventId", "sourceEventIds", "canonicalSourceEventId",
  "evidence", "dependsOnEventIds",
]);

function humanizeKey(value) {
  return String(value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeRowObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return formatReviewValue(value);
  if (value.message) return value.code ? `${value.code} — ${value.message}` : String(value.message);
  if (value.entity) {
    const name = value.entity.name || `Raw ID ${value.entity.rawId ?? "?"}`;
    const count = value.commandCount ?? value.count ?? value.value;
    return count === undefined ? name : `${name} · ${formatReviewValue(count)}`;
  }
  const preferred = ["label", "name", "status", "type", "atMs", "count", "value", "percent", "rawId"];
  const parts = [];
  for (const key of preferred) {
    if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") {
      parts.push(`${humanizeKey(key)}: ${formatReviewValue(value[key], key)}`);
    }
  }
  if (parts.length) return parts.join(" · ");
  const primitiveParts = Object.entries(value)
    .filter(([key, child]) => !TECHNICAL_ROW_KEYS.has(key) && (child === null || typeof child !== "object"))
    .slice(0, 4)
    .map(([key, child]) => `${humanizeKey(key)}: ${formatReviewValue(child, key)}`);
  return primitiveParts.length ? primitiveParts.join(" · ") : "Structured item";
}

function formatReviewValue(value, key = "") {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (/(^|\.)(atMs|timestampMs|durationMs|firstAtMs|lastAtMs|observedUntilMs|clickAtMs|ageUpAtMs)$/i.test(key)) {
      return fmtTime(value);
    }
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  }
  if (Array.isArray(value)) {
    if (!value.length) return "None";
    if (value.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item))) {
      const shown = value.slice(0, 8).map((item) => formatReviewValue(item)).join(", ");
      return value.length > 8 ? `${shown} … (+${value.length - 8})` : shown;
    }
    return `${value.length} items`;
  }
  return String(value);
}

function fmtSeconds(seconds) {
  if (!Number.isFinite(Number(seconds))) return "—";
  const value = Number(seconds);
  const minutes = Math.floor(value / 60);
  const remainder = value - minutes * 60;
  const text = Number.isInteger(remainder)
    ? String(remainder).padStart(2, "0")
    : remainder.toFixed(1).padStart(4, "0");
  return `${minutes}:${text}`;
}

function flattenControlLeaves(value, prefix = "", path = "", context = {}, rows = []) {
  if (value === null || value === undefined || typeof value !== "object") {
    rows.push({
      metric: prefix || "Value",
      path,
      rawValue: value,
      displayValue: formatReviewValue(value, path),
      layer: context.layer || "",
      note: context.scope || "",
    });
    return rows;
  }

  if (Array.isArray(value)) {
    rows.push({
      metric: prefix || "Items",
      path,
      rawValue: value,
      displayValue: formatReviewValue(value, path),
      layer: context.layer || "",
      note: context.scope || "",
    });
    return rows;
  }

  const nextContext = {
    layer: value.layer || context.layer || "",
    scope: value.scope || context.scope || "",
  };
  for (const [key, child] of Object.entries(value)) {
    if (TECHNICAL_ROW_KEYS.has(key)) continue;
    const label = prefix ? `${prefix} › ${humanizeKey(key)}` : humanizeKey(key);
    const childPath = path ? `${path}.${key}` : key;
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      flattenControlLeaves(child, label, childPath, nextContext, rows);
    } else {
      rows.push({
        metric: label,
        path: childPath,
        rawValue: child,
        displayValue: formatReviewValue(child, key),
        layer: nextContext.layer,
        note: nextContext.scope,
      });
    }
  }
  return rows;
}

function formatTownBellValue(metric, mapping) {
  if (!metric) return "—";
  if (metric.value === null || metric.value === undefined) {
    return metric.naReason ? `— (${metric.naReason})` : "—";
  }
  if (mapping?.unit === "duration") return fmtSeconds(metric.value);
  return formatReviewValue(metric.value);
}

function formatAofControlValue(row, mapping) {
  if (!row) return "—";
  if (mapping?.unit === "duration") {
    return Number.isFinite(Number(row.rawValue)) ? fmtSeconds(Number(row.rawValue) / 1000) : "—";
  }
  return row.displayValue;
}

function economyControlMatrix(run) {
  const participants = run.statistics?.participants ?? [];
  const playerOrder = participants.map((player) => ({
    playerId: Number(player.playerId),
    name: player.displayName || `P${player.playerId}`,
    economy: player.economy || {},
  }));
  if (!playerOrder.length) return '<div class="empty-inline">No player economy statistics.</div>';

  const byPlayerRows = new Map();
  const rowDefinitions = new Map();
  for (const player of playerOrder) {
    const rows = flattenControlLeaves(player.economy);
    byPlayerRows.set(player.playerId, new Map(rows.map((row) => [row.path, row])));
    for (const row of rows) {
      if (!rowDefinitions.has(row.path)) rowDefinitions.set(row.path, row);
    }
  }

  const controlPlayers = new Map(
    (run.townBellControl?.players || []).map((player) => [Number(player.number), player])
  );
  const mismatch = (run.townBellControl?.playerMatches || []).filter((match) => match.nameMatches === false);
  const controlNote = run.townBellControl
    ? `TownBell control: ${esc(run.townBellControl.fileName || "attached report")} · ${run.townBellControl.playerCount || 0} players`
    : "No TownBell report attached. Use “Attach TownBell report” above to populate the control columns.";
  const mismatchNote = mismatch.length
    ? `<div class="warning">Player-number control mapping has ${mismatch.length} name mismatch(es): ${mismatch.map((item) => `P${esc(item.replaySlot)} AoF “${esc(item.aofName)}” vs TownBell “${esc(item.townBellName)}”`).join("; ")}.</div>`
    : "";

  const headers = playerOrder.map((player) => {
    const control = controlPlayers.get(player.playerId);
    const controlName = control?.name && control.name !== player.name ? ` · ${esc(control.name)}` : "";
    return `<th>${esc(player.name)} · AoF</th><th>${esc(player.name)}${controlName} · TownBell</th>`;
  }).join("");

  const body = [...rowDefinitions.entries()].map(([path, definition]) => {
    const mapping = ECONOMY_TOWNBELL_MAP[path];
    const cells = playerOrder.map((player) => {
      const aofRow = byPlayerRows.get(player.playerId)?.get(path);
      const townBellMetric = mapping
        ? controlPlayers.get(player.playerId)?.metrics?.[mapping.id]
        : null;
      const mappedTitle = mapping ? `TownBell: ${mapping.id}` : "No direct TownBell mapping";
      return `
        <td class="review-value">${esc(formatAofControlValue(aofRow, mapping))}</td>
        <td class="control-value ${mapping ? "mapped" : "unmapped"}" title="${esc(mappedTitle)}">${esc(formatTownBellValue(townBellMetric, mapping))}</td>
      `;
    }).join("");
    return `
      <tr>
        <td class="review-key" title="${esc(path)}">${esc(definition.metric)}</td>
        ${cells}
      </tr>
    `;
  }).join("");

  return `
    <div class="timeline-note">${controlNote}</div>
    ${mismatchNote}
    <div class="review-table-wrap control-matrix-wrap">
      <table class="review-table control-matrix">
        <thead><tr><th>Metric</th>${headers}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function flattenReviewRows(value, prefix = "", context = {}, rows = []) {
  if (value === null || value === undefined || typeof value !== "object") {
    rows.push({
      metric: prefix || "Value",
      value: formatReviewValue(value, prefix),
      layer: context.layer || "",
      note: context.scope || "",
    });
    return rows;
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      rows.push({
        metric: prefix || "Items",
        value: "None",
        layer: context.layer || "",
        note: context.scope || "",
      });
      return rows;
    }
    value.forEach((item, index) => {
      rows.push({
        metric: `${prefix || "Item"} #${index + 1}`,
        value: summarizeRowObject(item),
        layer: context.layer || "",
        note: context.scope || "",
      });
    });
    return rows;
  }

  const nextContext = {
    layer: value.layer || context.layer || "",
    scope: value.scope || context.scope || "",
  };
  const entries = Object.entries(value).filter(([key]) => !TECHNICAL_ROW_KEYS.has(key));

  if (!entries.length) {
    rows.push({
      metric: prefix || "Value",
      value: "—",
      layer: nextContext.layer,
      note: nextContext.scope,
    });
    return rows;
  }

  for (const [key, child] of entries) {
    const label = prefix ? `${prefix} › ${humanizeKey(key)}` : humanizeKey(key);
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      flattenReviewRows(child, label, nextContext, rows);
    } else {
      rows.push({
        metric: label,
        value: formatReviewValue(child, key),
        layer: nextContext.layer,
        note: nextContext.scope,
      });
    }
  }
  return rows;
}

function reviewTable(rows, { showLayer = true, showNote = true } = {}) {
  if (!rows?.length) return '<div class="empty-inline">No items.</div>';
  const layerColumn = showLayer ? "<th>Layer</th>" : "";
  const noteColumn = showNote ? "<th>Notes</th>" : "";
  return `
    <div class="review-table-wrap">
      <table class="review-table">
        <thead><tr><th>Item</th><th>Value</th>${layerColumn}${noteColumn}</tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td class="review-key">${esc(row.metric)}</td>
              <td class="review-value">${esc(row.value)}</td>
              ${showLayer ? `<td class="review-layer">${esc(row.layer || "—")}</td>` : ""}
              ${showNote ? `<td class="review-note" title="${esc(row.note || "")}">${esc(row.note || "—")}</td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function playerReviewSection(title, values) {
  return `<h3>${esc(title)}</h3>` + values.map((row) => `
    <details open class="player-review">
      <summary><strong>P${row.playerId} · ${esc(row.name)}</strong></summary>
      ${reviewTable(flattenReviewRows(row.value))}
    </details>
  `).join("");
}

function militaryReviewRows(evidence, players) {
  const names = Object.fromEntries((players || []).map((p) => [String(p.replaySlot), p.name]));
  const rows = [];
  const inventories = [
    ["Queue requests", evidence?.queueRequestsByPlayerAndUnit],
    ["Research requests", evidence?.researchRequestsByPlayerAndTechnology],
    ["Building placements", evidence?.buildingPlacementsByPlayerAndBuilding],
  ];
  for (const [type, byPlayer] of inventories) {
    for (const [playerId, items] of Object.entries(byPlayer || {})) {
      for (const item of items || []) {
        rows.push({
          player: `P${playerId} · ${names[playerId] || "Unknown"}`,
          type,
          item: item?.entity?.name || `Raw ID ${item?.entity?.rawId ?? "?"}`,
          value: item?.commandCount ?? "—",
          rawId: item?.entity?.rawId ?? "—",
        });
      }
    }
  }
  for (const [playerId, units] of Object.entries(evidence?.positiveEncodedQueueAmountsByPlayerAndRawUnit || {})) {
    for (const [rawId, amount] of Object.entries(units || {})) {
      rows.push({
        player: `P${playerId} · ${names[playerId] || "Unknown"}`,
        type: "Positive encoded queue amount",
        item: `Raw unit ${rawId}`,
        value: amount,
        rawId,
      });
    }
  }
  return rows;
}

function militaryTable(rows) {
  if (!rows.length) return '<div class="empty-inline">No military command items.</div>';
  return `
    <div class="review-table-wrap">
      <table class="review-table military-table">
        <thead><tr><th>Player</th><th>Type</th><th>Item</th><th>Value</th><th>Raw ID</th></tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${esc(row.player)}</td>
              <td>${esc(row.type)}</td>
              <td class="review-key">${esc(row.item)}</td>
              <td class="review-value">${esc(row.value)}</td>
              <td class="mono">${esc(row.rawId)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function comparisonTable(changes) {
  if (!changes?.length) return '<div class="empty-inline">No statistic changes.</div>';
  return `
    <div class="review-table-wrap">
      <table class="review-table comparison-table">
        <thead><tr><th>Item</th><th>Before</th><th>After</th><th>Change</th></tr></thead>
        <tbody>
          ${changes.map((change) => `
            <tr>
              <td class="review-key">${esc(change.path)}</td>
              <td>${esc(formatReviewValue(change.before))}</td>
              <td>${esc(formatReviewValue(change.after))}</td>
              <td>${esc(change.change || "changed")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function participant(section) {
  return state.run?.statistics?.participants?.map((player) => ({
    playerId: player.playerId,
    name: player.displayName,
    value: player[section],
  })) ?? [];
}

function playerSection(title, values) {
  return playerReviewSection(title, values);
}

async function renderTimeline(includeRaw = false) {
  const id = state.run.metadata.id;
  const data = await api(`/api/runs/${encodeURIComponent(id)}/timeline?limit=${includeRaw ? 60 : 300}&includeRaw=${includeRaw ? 1 : 0}`);
  return `
    <div class="timeline-note">Showing ${data.rows.length} events${data.truncated ? " (limited)" : ""}.</div>
    ${data.rows.map((event) => `
      <details class="event">
        <summary>
          <span class="mono">${fmtTime(event.timestampMs)}</span>
          <strong>${esc(event.sourceActionName || event.sourceOperation)}</strong>
          <span>P${esc(event.actorPlayerId ?? "—")}</span>
          <span>${esc(event.eventType)}</span>
        </summary>
        ${jsonBlock(event)}
      </details>
    `).join("")}
  `;
}

async function renderTab() {
  $("boundary").textContent = boundaries[state.tab] || "";
  const run = state.run;
  const stats = run.statistics;
  let html = "";

  if (state.tab === "overview") {
    const timing = run.metadata?.timings ?? {};
    const recalc = run.metadata?.lastRecalculation ?? null;
    const analysisSummary = run.metadata?.analysisDataset?.summary ?? {};
    html = `
      <div class="metrics">
        ${card("Duration", fmtTime(run.canonical?.match?.durationMs))}
        ${card("Players", run.players.length)}
        ${card("Decoded action coverage", `${stats?.scope?.decodeCoveragePercent ?? "?"}%`, "recognized actions, not semantic completeness")}
        ${card("Unknown actions", run.diagnostics.unknownActionCount)}
        ${card("Unresolved catalogue IDs", run.diagnostics.unresolvedEntities.length)}
        ${card("Statistics revision", run.metadata.statisticsRevision)}
      </div>
      <h3>Pipeline timing</h3>
      <div class="metrics">
        ${card("Upload copy", timing.uploadMs != null ? `${Math.round(timing.uploadMs)} ms` : "—")}
        ${card("Parse + canonical write", timing.replayParseCanonicalWriteMs != null ? `${Math.round(timing.replayParseCanonicalWriteMs)} ms` : "—")}
        ${card("Canonical seal", timing.canonicalSealMs != null ? `${Math.round(timing.canonicalSealMs)} ms` : "—", timing.canonicalSealMode === "fast" ? "fast structural seal" : "full conformance")}
        ${card("Analysis dataset", timing.analysisDatasetMs != null ? `${Math.round(timing.analysisDatasetMs)} ms` : "—")}
        ${card("Statistics projection", timing.statisticsProjectionMs != null ? `${Math.round(timing.statisticsProjectionMs)} ms` : "—")}
        ${card("First-run total", timing.totalMs != null ? `${Math.round(timing.totalMs)} ms` : "—")}
      </div>
      <div class="timeline-note">Canonical state: ${esc(run.canonicalRun?.state ?? run.metadata?.canonicalState ?? "unknown")}. Fast seal is sufficient for Replay Lab development; verified_local requires the explicit full conformance audit.</div>
      ${run.metadata?.lastFullAudit ? `<div class="timeline-note">Last full audit: ${Math.round(run.metadata.lastFullAudit.durationMs)} ms · state ${esc(run.metadata.lastFullAudit.state)}</div>` : ""}
      ${recalc ? `<div class="timeline-note">Last recalculation: ${Math.round(recalc.totalMs)} ms · replay reparsed: ${recalc.replayReparsed ? "yes" : "no"} · canonical revalidated: ${recalc.canonicalRevalidated ? "yes" : "no"}</div>` : ""}
      <h3>Compact analysis cache</h3>
      <div class="metrics">
        ${card("Action events", analysisSummary.actionEventCount ?? "—")}
        ${card("Initial objects", analysisSummary.initialObjectCount ?? "—")}
        ${card("Camera events", analysisSummary.cameraEventCount ?? "—")}
        ${card("Raw operation bytes copied", analysisSummary.rawOperationBytesCopied === false ? "No" : analysisSummary.rawOperationBytesCopied ?? "—")}
      </div>
      <h3>Participants</h3>
      <div class="player-grid">${run.players.map((p) => `
        <div class="player-card"><strong>P${esc(p.replaySlot)} · ${esc(p.name)}</strong><span>civ ${esc(p.civilizationId ?? "?")} · team ${esc(p.teamId ?? "?")}</span></div>
      `).join("")}</div>
      <h3>Canonical result state</h3>
      ${reviewTable(flattenReviewRows({
        completionStatus: run.canonical?.match?.completionStatus,
        winnerPlayerIds: run.canonical?.match?.winnerPlayerIds,
        winnerTeamIds: run.canonical?.match?.winnerTeamIds,
      }), { showLayer: false, showNote: false })}
    `;
  } else if (state.tab === "players") {
    html = playerSection("Player statistics", stats?.participants ?? []);
  } else if (state.tab === "opening") {
    html = playerSection("Opening", participant("opening").map((row, i) => ({
      ...row,
      value: { buildOrder: stats.participants[i].buildOrder, opening: row.value },
    })));
  } else if (state.tab === "economy") {
    html = `<h3>Economy review matrix</h3>${economyControlMatrix(run)}`;
  } else if (state.tab === "military") {
    html = `<h3>Military command evidence</h3>${militaryTable(militaryReviewRows(stats?.commandEvidence, run.players))}`;
  } else if (state.tab === "battle") {
    html = playerSection("Combat / raid inference", participant("combat"));
  } else if (state.tab === "map-presence") {
    html = playerSection("Map Presence", participant("mapPresence"));
  } else if (state.tab === "execution") {
    html = playerSection("Execution evidence", stats?.participants?.map((p) => ({
      playerId: p.playerId,
      name: p.displayName,
      value: { observedCommands: p.observedCommands, selectionEvidence: p.selectionEvidence },
    })) ?? []);
  } else if (state.tab === "timeline") {
    html = await renderTimeline(false);
  } else if (state.tab === "raw") {
    html = '<div class="warning">Raw byte payloads can be large. This view intentionally limits the event count.</div>' + await renderTimeline(true);
  } else if (state.tab === "diagnostics") {
    html = `
      <div class="metrics">
        ${card("Unknown actions", run.diagnostics.unknownActionCount)}
        ${card("Unresolved catalogue IDs", run.diagnostics.unresolvedEntities.length)}
        ${card("Compatibility", run.diagnostics.compatibility?.status ?? "unknown")}
      </div>
      <h3>Unknown action codes</h3>
      ${reviewTable(flattenReviewRows(run.diagnostics.unknownActions), { showLayer: false, showNote: false })}
      <h3>Unresolved object catalogue IDs</h3>
      ${reviewTable(flattenReviewRows(run.diagnostics.unresolvedEntities), { showLayer: false, showNote: false })}
      <h3>Warnings</h3>
      ${reviewTable(flattenReviewRows(run.diagnostics.warnings), { showLayer: false, showNote: false })}
      <h3>Coverage report</h3>
      ${reviewTable(flattenReviewRows(run.diagnostics.coverage), { showLayer: false, showNote: false })}
    `;
  } else if (state.tab === "comparison") {
    html = run.comparison
      ? `<div class="metrics">${card("Changes", run.comparison.changeCount)}${card("Before", `r${run.comparison.beforeRevision}`)}${card("After", `r${run.comparison.afterRevision}`)}</div>${comparisonTable(run.comparison.changes)}`
      : '<div class="empty-inline">Recalculate statistics once to create a same-evidence comparison.</div>';
  }

  $("content").innerHTML = html || '<div class="empty-inline">No data.</div>';
}

$("fileInput").addEventListener("change", (event) => {
  state.file = event.target.files?.[0] ?? null;
  $("selectedFile").textContent = state.file?.name ?? "No replay selected";
  $("extractButton").disabled = !state.file;
});

for (const name of ["dragenter", "dragover"]) {
  $("dropZone").addEventListener(name, (event) => {
    event.preventDefault();
    $("dropZone").classList.add("drag");
  });
}
for (const name of ["dragleave", "drop"]) {
  $("dropZone").addEventListener(name, (event) => {
    event.preventDefault();
    $("dropZone").classList.remove("drag");
  });
}
$("dropZone").addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  state.file = file;
  $("selectedFile").textContent = file.name;
  $("extractButton").disabled = false;
});

$("extractButton").addEventListener("click", async () => {
  if (!state.file) return;
  $("extractButton").disabled = true;
  showProgress("Extracting canonical evidence, applying fast seal, and projecting statistics…");
  try {
    const run = await api("/api/runs", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-aof-filename": encodeURIComponent(state.file.name),
      },
      body: state.file,
    });
    state.file = null;
    $("fileInput").value = "";
    $("selectedFile").textContent = "No replay selected";
    await refreshRuns(run.metadata.id);
    const total = run.metadata?.timings?.totalMs;
    showProgress(total != null ? `Run ready in ${Math.round(total)} ms. Stage timings are on Overview.` : "Run ready.");
    setTimeout(hideProgress, 1800);
  } catch (error) {
    showProgress(error.message, true);
  } finally {
    $("extractButton").disabled = !state.file;
  }
});

$("townBellButton").addEventListener("click", () => {
  if (!state.run) return;
  $("townBellInput").click();
});

$("townBellInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file || !state.run) return;
  $("townBellButton").disabled = true;
  showProgress("Attaching TownBell report as a local comparison control…");
  try {
    state.run = await api(`/api/runs/${encodeURIComponent(state.run.metadata.id)}/townbell`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-aof-filename": encodeURIComponent(file.name),
      },
      body: file,
    });
    await refreshRuns();
    renderShell();
    await renderTab();
    const mismatches = state.run.metadata?.townBellControl?.nameMismatchCount || 0;
    showProgress(`TownBell control attached for ${state.run.townBellControl?.playerCount || 0} players${mismatches ? ` · ${mismatches} player-name mismatch(es)` : ""}.`);
    setTimeout(hideProgress, 1800);
  } catch (error) {
    showProgress(error.message, true);
  } finally {
    $("townBellInput").value = "";
    $("townBellButton").disabled = false;
  }
});

$("auditButton").addEventListener("click", async () => {
  if (!state.run) return;
  $("auditButton").disabled = true;
  showProgress("Running exhaustive canonical conformance audit…");
  try {
    state.run = await api(`/api/runs/${encodeURIComponent(state.run.metadata.id)}/audit`, { method: "POST" });
    await refreshRuns();
    renderShell();
    await renderTab();
    const ms = state.run.metadata?.lastFullAudit?.durationMs;
    showProgress(`Full conformance audit passed${ms != null ? ` in ${Math.round(ms)} ms` : ""}. Canonical state is verified_local.`);
    setTimeout(hideProgress, 1800);
  } catch (error) {
    showProgress(error.message, true);
  } finally {
    $("auditButton").disabled = state.run?.canonicalRun?.state === "verified_local";
  }
});
$("recalcButton").addEventListener("click", async () => {
  if (!state.run) return;
  $("recalcButton").disabled = true;
  showProgress("Recalculating statistics from the compact analysis cache — replay parsing is not rerun.");
  try {
    state.run = await api(`/api/runs/${encodeURIComponent(state.run.metadata.id)}/recalculate`, { method: "POST" });
    await refreshRuns();
    renderShell();
    await renderTab();
    const ms = state.run.metadata?.lastRecalculation?.totalMs;
    showProgress(`Statistics revision ${state.run.metadata.statisticsRevision} ready${ms != null ? ` in ${Math.round(ms)} ms` : ""} — replay not reparsed.`);
    setTimeout(hideProgress, 1800);
  } catch (error) {
    showProgress(error.message, true);
  } finally {
    $("recalcButton").disabled = false;
  }
});

(async () => {
  try {
    const health = await api("/api/health");
    $("health").textContent = health.ok ? "local lab ready" : "unavailable";
    $("health").classList.add("ok");
    await refreshRuns();
  } catch (error) {
    $("health").textContent = "lab error";
    showProgress(error.message, true);
  }
})();
