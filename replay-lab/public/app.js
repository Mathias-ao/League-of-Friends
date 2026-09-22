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

const boundaries = {
  overview: "Mixed presentation — inspect section labels before treating values as facts.",
  players: "Mixed canonical identity and projected statistics.",
  opening: "Reconstructed / inferred. Build-order labels are models, not raw replay fields.",
  economy: "Estimated / reconstructed. Resource commitment is not actual resource spend.",
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
  $("runMeta").textContent =
    `save ${run.replay?.saveVersion ?? "?"} · build ${run.replay?.build ?? "?"} · ${run.players.length} players · compatibility ${compat}`;
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

function participant(section) {
  return state.run?.statistics?.participants?.map((player) => ({
    playerId: player.playerId,
    name: player.displayName,
    value: player[section],
  })) ?? [];
}

function playerSection(title, values) {
  return `<h3>${esc(title)}</h3>` + values.map((row) => `
    <details open>
      <summary><strong>P${row.playerId} · ${esc(row.name)}</strong></summary>
      ${jsonBlock(row.value)}
    </details>
  `).join("");
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
    html = `
      <div class="metrics">
        ${card("Duration", fmtTime(run.canonical?.match?.durationMs))}
        ${card("Players", run.players.length)}
        ${card("Decoded action coverage", `${stats?.scope?.decodeCoveragePercent ?? "?"}%`, "recognized actions, not semantic completeness")}
        ${card("Unknown actions", run.diagnostics.unknownActionCount)}
        ${card("Unresolved catalogue IDs", run.diagnostics.unresolvedEntities.length)}
        ${card("Statistics revision", run.metadata.statisticsRevision)}
      </div>
      <h3>Participants</h3>
      <div class="player-grid">${run.players.map((p) => `
        <div class="player-card"><strong>P${esc(p.replaySlot)} · ${esc(p.name)}</strong><span>civ ${esc(p.civilizationId ?? "?")} · team ${esc(p.teamId ?? "?")}</span></div>
      `).join("")}</div>
      <h3>Canonical result state</h3>
      ${jsonBlock({
        completionStatus: run.canonical?.match?.completionStatus,
        winnerPlayerIds: run.canonical?.match?.winnerPlayerIds,
        winnerTeamIds: run.canonical?.match?.winnerTeamIds,
      })}
    `;
  } else if (state.tab === "players") {
    html = playerSection("Player statistics", stats?.participants ?? []);
  } else if (state.tab === "opening") {
    html = playerSection("Opening", participant("opening").map((row, i) => ({
      ...row,
      value: { buildOrder: stats.participants[i].buildOrder, opening: row.value },
    })));
  } else if (state.tab === "economy") {
    html = playerSection("Economy", participant("economy"));
  } else if (state.tab === "military") {
    html = `<h3>Military command evidence</h3>${jsonBlock({
      queueRequestsByPlayerAndUnit: stats?.commandEvidence?.queueRequestsByPlayerAndUnit,
      positiveEncodedQueueAmountsByPlayerAndRawUnit: stats?.commandEvidence?.positiveEncodedQueueAmountsByPlayerAndRawUnit,
      researchRequestsByPlayerAndTechnology: stats?.commandEvidence?.researchRequestsByPlayerAndTechnology,
      buildingPlacementsByPlayerAndBuilding: stats?.commandEvidence?.buildingPlacementsByPlayerAndBuilding,
    })}`;
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
      <h3>Unknown action codes</h3>${jsonBlock(run.diagnostics.unknownActions)}
      <h3>Unresolved object catalogue IDs</h3>${jsonBlock(run.diagnostics.unresolvedEntities)}
      <h3>Warnings</h3>${jsonBlock(run.diagnostics.warnings)}
      <h3>Coverage report</h3>${jsonBlock(run.diagnostics.coverage)}
    `;
  } else if (state.tab === "comparison") {
    html = run.comparison
      ? `<div class="metrics">${card("Changes", run.comparison.changeCount)}${card("Before", `r${run.comparison.beforeRevision}`)}${card("After", `r${run.comparison.afterRevision}`)}</div>${jsonBlock(run.comparison.changes)}`
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
  showProgress("Extracting canonical evidence and projecting statistics…");
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
    showProgress("Run ready.");
    setTimeout(hideProgress, 1800);
  } catch (error) {
    showProgress(error.message, true);
  } finally {
    $("extractButton").disabled = !state.file;
  }
});

$("recalcButton").addEventListener("click", async () => {
  if (!state.run) return;
  $("recalcButton").disabled = true;
  showProgress("Recalculating statistics from canonical evidence — replay parsing is not rerun.");
  try {
    state.run = await api(`/api/runs/${encodeURIComponent(state.run.metadata.id)}/recalculate`, { method: "POST" });
    await refreshRuns();
    renderShell();
    await renderTab();
    showProgress(`Statistics revision ${state.run.metadata.statisticsRevision} ready.`);
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
