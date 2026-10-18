import "./style.css";
import { createHeadquarters } from "./scene";
import type { Agent, Snapshot, Task } from "./types";

const icons: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  arbitrage: '<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',
  treasury:
    '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M7 6V3h10v3m-1 9h2"/>',
  etsy: '<path d="m4 9 8-6 8 6v11H4ZM8 20v-7h8v7M4 9h16"/>',
  headquarters:
    '<rect x="5" y="7" width="14" height="13" rx="3"/><path d="M12 3v4M9 12v2m6-2v2M9 17h6M2 12h3m14 0h3"/>',
  retail:
    '<path d="M3 4h2l3 12h10l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  fiverr: '<path d="m14 3-9 11h6l-1 7L20 9h-7Z"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  focus:
    '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  terminal: '<path d="m5 7 5 5-5 5m8 0h6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
};
const icon = (name: string) =>
  `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const money = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    n,
  );
const time = (n: number) =>
  new Date(n * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
const el = (id: string) => document.getElementById(id)!;
let state: Snapshot | undefined;
let selected = "arbitrage";
let tab = "overview";
let selectedAgent = "";
let submitting = false;
let connected = false;
let failures = 0;
let renderKey = "";
let modalTask: string | null = null;
let helpOpen = false;
let reportKey = "";

el("app").innerHTML = `
  <header class="topbar">
    <a class="brand" href="/" aria-label="AI Business Tycoon home"><span class="brand-mark"><i></i><i></i><i></i></span><span>AI BUSINESS<span class="brand-sub">T Y C O O N</span></span><span class="version">α 0.1</span></a>
    <div class="top-middle"><span class="status-dot" id="connection-dot"></span><span id="connection-text">CONNECTING TO STATION</span></div>
    <div class="top-right"><span class="mode-chip">SIMULATION MODE</span><button class="icon-button" id="help" aria-label="Open controls and help">${icon("info")}</button><span class="avatar">CM</span></div>
  </header>
  <nav class="sidebar" aria-label="Station navigation">
    <div class="nav-caption">WORKSPACE <span>01</span></div>
    <button class="station-nav active" id="station-view" aria-label="View full station">${icon("grid")}<span>Command deck</span><span class="nav-tick">⌘</span></button>
    <div class="nav-caption department-caption">DEPARTMENTS <span id="dept-count">06</span></div>
    <div id="department-nav" class="department-nav"></div>
    <div class="sidebar-bottom"><div class="uplink-art"><span></span><span></span><span></span><i></i></div><div class="small-label">YOUR EMPIRE STARTS HERE</div><p>Small steps.<br>Autonomous ambitions.</p><div class="local-pill"><span class="status-dot"></span> LOCAL ENVIRONMENT</div></div>
    <button class="sidebar-footer" id="controls-button" aria-label="Open mission handbook">${icon("terminal")}<span>Mission handbook</span>${icon("arrow")}</button>
  </nav>
  <main class="main">
    <section class="page-heading"><div><div class="eyebrow">WORKSPACE / OVERVIEW</div><h1>Command deck<span>.</span></h1><p>A little space. A world of possibility.</p></div><div class="station-id"><span class="orbit-symbol">◎</span><div>ORBITAL STATION<span>HQ — 001</span></div></div></section>
    <section class="metrics" aria-label="Station metrics">
      <div class="metric"><div class="metric-label">PAPER CAPITAL <span>GBP</span></div><div class="metric-number" id="capital">£10,000<span>.00</span></div><div class="metric-foot"><span class="tiny-square green"></span><span id="capital-foot">Virtual funds · no real money</span></div></div>
      <div class="metric"><div class="metric-label">AGENT WORKFORCE ${icon("headquarters")}</div><div class="metric-number" id="agent-count">16 <span>agents</span></div><div class="metric-foot"><span class="tiny-square green"></span><span id="agent-foot">Ready for assignment</span></div></div>
      <div class="metric"><div class="metric-label">MISSION CONTROL ${icon("arbitrage")}</div><div class="metric-number" id="task-count">00 <span>active</span></div><div class="metric-foot"><span class="tiny-square muted"></span><span id="task-foot">Your next move starts here</span></div></div>
    </section>
    <section class="map-section" aria-label="Interactive spaceship headquarters">
      <div class="map-top"><div><span class="status-dot"></span><strong>HEADQUARTERS</strong><span class="map-separator">/</span><span>SECTOR 01</span></div><button id="fit" class="text-button">${icon("focus")} <span>View station</span></button></div>
      <div class="map-inner"><div id="game" role="application" tabindex="0" aria-label="Interactive headquarters. Drag to pan, scroll to zoom, or select a department from navigation."></div><div class="map-corner top-left"></div><div class="map-corner top-right"></div><div class="map-corner bottom-left"></div><div class="map-corner bottom-right"></div>
      <div id="map-loading" class="map-loading">${icon("headquarters")}<span>Establishing station uplink…</span></div>
      <div class="map-tag"><span>01</span> SIX DEPARTMENTS. ONE MISSION.</div>
      <div class="map-tools"><button class="icon-button" id="zoom-in" aria-label="Zoom in">+</button><button class="icon-button" id="zoom-out" aria-label="Zoom out">−</button><span></span><button class="icon-button" id="reset-camera" aria-label="Reset camera">${icon("focus")}</button></div>
      <div class="map-hint">DRAG TO PAN <i>·</i> SCROLL TO ZOOM</div><div id="mini-map" class="mini-map" aria-label="Station overview"></div></div>
      <div class="map-bottom"><span><i class="legend-dot idle"></i> STANDBY <i class="legend-dot busy"></i> ON ASSIGNMENT</span><span>REAL-TIME AGENT STATES <b>↗</b></span></div>
    </section>
    <section class="activity"><div class="activity-title"><span>${icon("terminal")} STATION ACTIVITY</span><span class="live-label"><span class="status-dot"></span> LIVE FEED</span></div><div id="event-feed" aria-live="polite"><div class="empty-event"><span>—</span> Station standing by. Assign your first mission.</div></div></section>
    <footer class="main-footer"><span>BUILT FOR PURPOSE. READY FOR POSSIBILITY.</span><span>ALL BUSINESS ACTIVITY IS SIMULATED</span></footer>
  </main>
  <aside class="operations" aria-label="Department operations">
    <div class="operations-heading"><span>OPERATIONS PANEL</span><span>⌁</span></div>
    <div class="department-intro"><div id="department-symbol" class="department-symbol">${icon("arbitrage")}</div><span class="small-label">DEPARTMENT <span id="department-index">01</span> / 06</span><h2 id="department-title">Arbitrage Betting</h2><p id="department-description">Exchange intelligence, commission-aware evaluation and paper execution.</p><div class="dept-status"><span class="status-dot"></span><span id="department-status">STANDING BY</span><button id="focus-dept" class="text-button">Locate ${icon("focus")}</button></div></div>
    <div class="panel-tabs" role="tablist" aria-label="Department details"><button class="active" role="tab" aria-selected="true" data-tab="overview">Overview</button><button role="tab" aria-selected="false" data-tab="agents">Agents <span id="tab-agent-count">6</span></button><button role="tab" aria-selected="false" data-tab="history">History</button></div>
    <div class="panel-scroll"><div id="panel-content" role="tabpanel"></div></div>
    <div class="execution-lock">${icon("lock")}<div>REAL-MONEY EXECUTION DISABLED<span>Paper mode. No exchange orders are sent.</span></div></div>
  </aside>
  <div class="toast" id="toast" role="status"></div>
  <dialog id="report-dialog"><div id="dialog-content"></div></dialog>
`;

const { scene } = createHeadquarters("game");
scene.onDepartment = (id) => selectDepartment(id);
scene.onAgent = (id) => {
  const agent = state?.agents.find((a) => a.id === id);
  if (!agent) return;
  selectedAgent = id;
  selectDepartment(agent.department);
  setTab("agents");
};

function toast(message: string, error = false) {
  const box = el("toast");
  box.textContent = message;
  box.className = `toast show ${error ? "error" : ""}`;
  window.setTimeout(() => box.classList.remove("show"), 5000);
}

async function api(path: string, body?: unknown) {
  const response = await fetch(`/api/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : "The request was not valid. Check the stake and try again.",
    );
  }
  return response.json();
}

function selectDepartment(id: string, focus = false) {
  selected = id;
  renderKey = "";
  scene.select(id, focus);
  if (state) render(state);
}

function setTab(value: string) {
  tab = value;
  renderKey = "";
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
    b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  });
  if (state) render(state);
}

function agentCard(a: Agent) {
  const active = a.state !== "Idle";
  return `<button class="agent-card ${selectedAgent === a.id ? "selected" : ""}" data-agent="${a.id}" title="${escape(a.activity)}">
    <span class="pixel-person" style="--agent-color:${a.color}"><i></i></span><span class="agent-info"><strong>${a.name}</strong><span>${a.role}</span></span><span class="agent-state ${active ? "active" : ""}"><i></i>${a.state}</span>
    ${selectedAgent === a.id ? `<span class="agent-detail">${escape(a.activity)}${a.task_id ? ` · #${a.task_id.slice(0, 6)}` : ""}</span>` : ""}</button>`;
}

function render(snapshot: Snapshot) {
  const d = snapshot.departments.find((r) => r.id === selected)!;
  const agents = snapshot.agents.filter((a) => a.department === selected);
  const tasks = snapshot.tasks.filter((t) => t.department === selected);
  const busy = agents.some((a) => a.task_id);
  const latest = tasks[0];
  if (!el("department-nav").children.length) {
    el("department-nav").innerHTML = snapshot.departments
      .map(
        (r) =>
          `<button class="dept-nav" aria-label="${r.name}" data-department="${r.id}" style="--dept-color:${r.color}"><span class="dept-nav-icon">${icon(r.id)}</span><span>${r.name}</span><i class="nav-status"></i></button>`,
      )
      .join("");
    el("mini-map").innerHTML =
      `<svg viewBox="0 0 1460 1060" aria-hidden="true"><path d="M730 210v660M550 210h360M550 540h360M550 870h360" fill="none" stroke="#45594e" stroke-width="55"/>${snapshot.departments.map((r) => `<rect data-mini="${r.id}" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="20" fill="#273c34" stroke="${r.color}" stroke-width="12"/>`).join("")}</svg><span>STATION OVERVIEW</span>`;
  }
  document.querySelectorAll<HTMLElement>("[data-department]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.department === selected);
    b.querySelector(".nav-status")?.classList.toggle(
      "busy",
      snapshot.agents.some(
        (a) => a.department === b.dataset.department && a.task_id,
      ),
    );
  });
  document
    .querySelectorAll<SVGElement>("[data-mini]")
    .forEach((e) =>
      e.setAttribute(
        "fill",
        e.dataset.mini === selected ? "#6b9050" : "#273c34",
      ),
    );
  const capital = snapshot.treasury.available;
  el("capital").innerHTML = money(capital).replace(
    /\.([0-9]{2})$/,
    "<span>.$1</span>",
  );
  el("capital-foot").textContent = snapshot.treasury.reserved
    ? `${money(snapshot.treasury.reserved)} reserved · paper funds`
    : "Virtual funds · no real money";
  const active = snapshot.agents.filter((a) => a.task_id).length;
  el("agent-count").innerHTML = `${snapshot.agents.length} <span>agents</span>`;
  el("agent-foot").textContent = active
    ? `${active} assigned · ${snapshot.agents.length - active} on standby`
    : "All agents on standby";
  const pending = snapshot.tasks.filter(
    (t) => !["Completed", "Error"].includes(t.status),
  ).length;
  el("task-count").innerHTML =
    `${String(pending).padStart(2, "0")} <span>active</span>`;
  el("task-foot").textContent =
    `${snapshot.tasks.filter((t) => t.status === "Completed").length} completed assignments`;
  el("department-symbol").innerHTML = icon(selected);
  el("department-symbol").style.color = d.color;
  el("department-title").textContent = d.name;
  el("department-description").textContent = d.description;
  el("department-index").textContent = String(
    snapshot.departments.indexOf(d) + 1,
  ).padStart(2, "0");
  el("department-status").textContent = busy
    ? "MISSION IN PROGRESS"
    : "STANDING BY";
  el("tab-agent-count").textContent = String(agents.length);
  const key = JSON.stringify([
    selected,
    tab,
    agents.map((a) => [a.state, a.task_id, a.activity]),
    latest?.status,
    latest?.phase,
    latest?.progress,
    tasks.length,
    snapshot.trades.length,
    selectedAgent,
    connected,
    submitting,
  ]);
  if (key !== renderKey) {
    // Preserve editable fields and focus when server snapshots refresh the panel.
    const stake = (document.getElementById("stake") as HTMLInputElement | null)
      ?.value;
    const worker = (
      document.getElementById("worker") as HTMLSelectElement | null
    )?.value;
    const focusId = document.activeElement?.id;
    renderKey = key;
    if (tab === "overview") {
      el("panel-content").innerHTML = `
        <div class="section-label">NEXT ASSIGNMENT <span>01</span></div>
        <div class="mission-card"><div class="mission-icon">${icon(selected === "arbitrage" ? "arbitrage" : "terminal")}</div><h3>${escape(d.job)}</h3><p>${selected === "arbitrage" ? "Dispatch exchange workers, check risk and review the controller’s report." : "Assign a worker to produce a local demonstration report."}</p>
          ${selected === "arbitrage" ? `<div class="source-tags"><span>BETFAIR</span><span>SMARKETS</span><span>MATCHBOOK</span></div><label class="field-label" for="stake">BACK STAKE <span>VIRTUAL GBP</span></label><div class="input-wrap"><span>£</span><input id="stake" type="number" required min="1" max="1000" step="1" value="100" aria-label="Paper back stake in GBP" /></div>` : `<label class="field-label" for="worker">ASSIGNED AGENT</label><select id="worker">${agents.map((a) => `<option value="${a.id}">${a.name} · ${a.role}</option>`).join("")}</select>`}
          <button id="assign-task" class="primary-button" ${busy || submitting || !connected ? "disabled" : ""}>${icon("play")}<span>${submitting ? "Dispatching…" : busy ? "Mission in progress" : selected === "arbitrage" ? "Launch simulated scan" : "Assign task"}</span>${icon("arrow")}</button>
          <div class="mission-note"><span class="tiny-square green"></span> ${selected === "arbitrage" ? "Synthetic odds · paper trading only" : "Local simulation · no external actions"}</div>
        </div>
        ${latest ? taskCard(latest) : `<div class="ready-note"><span>⌁</span><div><strong>Ready when you are.</strong><p>Launch a mission to put your team to work.</p></div></div>`}
        <div class="section-label crew-label">DEPARTMENT CREW <span>${String(agents.length).padStart(2, "0")}</span></div>
        <div class="crew-stack">${agents.slice(0, 3).map(agentCard).join("")}</div>
        ${agents.length > 3 ? `<button class="all-agents" data-show-agents>View all ${agents.length} agents ${icon("arrow")}</button>` : ""}
        ${selected === "treasury" ? `<div class="ledger-mini"><span>Real revenue<strong>${money(snapshot.treasury.real_revenue)}</strong></span><span>Real expenses<strong>${money(snapshot.treasury.real_expenses)}</strong></span><span>Reserved paper funds<strong>${money(snapshot.treasury.reserved)}</strong></span><span>Estimated paper edge<strong>${money(snapshot.treasury.estimated_profit)}</strong></span><p>Orders remain unsettled. Estimated edge is not income.</p></div>` : ""}
      `;
    } else if (tab === "agents") {
      el("panel-content").innerHTML =
        `<div class="section-label">ACTIVE ROSTER <span>${agents.length} UNITS</span></div><p class="panel-note">Select an agent to inspect its current assignment. Movement follows tasks, never a patrol loop.</p><div class="crew-stack">${agents.map(agentCard).join("")}</div><div class="state-key"><span class="small-label">AGENT LIFECYCLE</span><p>Idle → Assigned → Moving → Working / Waiting → Reviewing → Completed → Returning → Idle</p></div>`;
    } else {
      el("panel-content").innerHTML =
        `<div class="section-label">TASK HISTORY <span>${tasks.length} RECORDS</span></div>${tasks.length ? tasks.map(taskCard).join("") : `<div class="empty-history">${icon("terminal")}<h3>A clean slate.</h3><p>Completed and failed assignments will appear here. History is saved locally in SQLite.</p></div>`}`;
    }
    if (stake && document.getElementById("stake"))
      (el("stake") as HTMLInputElement).value = stake;
    if (worker && document.querySelector(`#worker option[value="${worker}"]`))
      (el("worker") as HTMLSelectElement).value = worker;
    if (focusId && document.getElementById(focusId))
      el(focusId).focus({ preventScroll: true });
  }
  const events = snapshot.events.slice(0, 3);
  el("event-feed").innerHTML = events.length
    ? events
        .map(
          (e, i) =>
            `<div class="event-row ${i === 0 ? "new" : ""}"><time>${time(e.created)}</time><span class="event-marker">${i === 0 ? "›" : "·"}</span><span>${escape(e.message)}</span><b>${snapshot.departments.find((d) => d.id === e.department)?.code || "SYS"}</b></div>`,
        )
        .join("")
    : `<div class="empty-event"><span>—</span> Station standing by. Assign your first mission.</div>`;
  if (modalTask && !helpOpen) renderReport(modalTask);
}

function taskCard(t: Task) {
  return `<div class="task-card"><div class="task-meta"><span>#${t.id.slice(0, 6)} · ${time(t.created)}</span><span class="task-state ${t.status.toLowerCase()}">${t.status}</span></div><h4>${escape(t.title)}</h4><p>${escape(t.error || t.phase)}</p><div class="progress-track"><span style="width:${t.progress}%"></span></div>${t.result || t.error ? `<button class="report-link" data-report="${t.id}">Inspect ${t.error ? "error" : "report"} ${icon("arrow")}</button>` : ""}</div>`;
}

function renderReport(id: string) {
  const t = state?.tasks.find((t) => t.id === id);
  if (!t || !state) return;
  const recorded = state.trades.some((r) => r.task_id === t.id);
  const nextKey = JSON.stringify([t, recorded, connected]);
  if (nextKey === reportKey) return;
  reportKey = nextKey;
  el("dialog-content").innerHTML =
    `<div class="dialog-header"><div><span class="eyebrow">MISSION REPORT / #${t.id.slice(0, 6)}</span><h2>${escape(t.title)}</h2></div><button class="icon-button" data-close aria-label="Close report">${icon("close")}</button></div>
    <div class="simulation-banner">${icon("info")} SIMULATED OUTPUT · NO LIVE DATA · NO REAL INCOME</div>
    ${t.error ? `<p class="error-text">${escape(t.error)}</p>` : `<p class="report-summary">${escape(t.result?.summary || "")}</p>`}
    ${t.result?.kind === "scan" ? `<div class="opportunities">${t.result.opportunities!.map((o, i) => `<article class="opportunity"><div class="opportunity-top"><span class="small-label">SYNTHETIC FIXTURE ${String(i + 1).padStart(2, "0")}</span><span class="result-badge ${o.approved ? "positive" : "negative"}">${o.approved ? "RISK CHECK PASSED" : "REJECTED"}</span></div><h3>${escape(o.event)}</h3><p>${escape(o.market)}</p><div class="odds-row"><div><span>BACK · ${o.back_exchange}</span><strong>${o.back_odds.toFixed(2)}</strong><small>Stake ${money(o.back_stake)} · commission ${o.back_commission * 100}%</small></div><span>⇄</span><div><span>LAY · ${o.lay_exchange}</span><strong>${o.lay_odds.toFixed(2)}</strong><small>Stake ${money(o.lay_stake)} · commission ${o.lay_commission * 100}%</small></div></div><div class="calculation-grid"><span>Lay liability<strong>${money(o.liability)}</strong></span><span>Capital required<strong>${money(o.capital_required)}</strong></span><span>If selection wins<strong>${money(o.profit_if_win)}</strong></span><span>If selection loses<strong>${money(o.profit_if_lose)}</strong></span><span>Back / lay liquidity<strong>${money(o.back_liquidity)} / ${money(o.lay_liquidity)}</strong></span><span>Estimated paper ROI<strong class="${o.approved ? "green-text" : "error-text"}">${o.roi}%</strong></span></div>${o.reasons.length ? `<p class="rejection">${escape(o.reasons.join("; "))}</p>` : ""}${i === 0 && o.approved ? `<button class="primary-button" id="paper-order" data-task="${t.id}" ${recorded || !connected ? "disabled" : ""}>${icon("lock")} ${recorded ? "Paper order recorded" : "Record paper order"} ${icon("arrow")}</button><p class="paper-note">Reserves virtual capital only. Orders are not sent to exchanges and remain unsettled.</p>` : ""}</article>`).join("")}</div>` : ""}
    ${t.result?.lines ? `<ul class="report-lines">${t.result.lines.map((line) => `<li>${escape(line)}</li>`).join("")}</ul>` : ""}
    <div class="report-timeline"><span class="small-label">TASK AUDIT TRAIL</span>${t.history.map((h) => `<div><time>${time(h.at)}</time><strong>${h.state}</strong><span>${escape(h.label)}</span></div>`).join("")}</div>`;
}

async function assignTask() {
  if (submitting || !connected) return;
  const stakeInput = document.getElementById(
    "stake",
  ) as HTMLInputElement | null;
  if (stakeInput && !stakeInput.reportValidity()) return;
  const worker = (document.getElementById("worker") as HTMLSelectElement | null)
    ?.value;
  submitting = true;
  renderKey = "";
  if (state) render(state);
  try {
    await api("tasks", {
      department: selected,
      agent_id: worker || null,
      stake: stakeInput ? Number(stakeInput.value) : 100,
    });
    toast("Assignment dispatched. Your crew is on it.");
    await refresh();
  } catch (error) {
    toast((error as Error).message, true);
  } finally {
    submitting = false;
    renderKey = "";
    if (state) render(state);
  }
}

function openHelp() {
  helpOpen = true;
  modalTask = null;
  el("dialog-content").innerHTML =
    `<div class="dialog-header"><div><span class="eyebrow">MISSION HANDBOOK / 01</span><h2>Welcome aboard, Commander.</h2></div><button class="icon-button" data-close aria-label="Close help">${icon("close")}</button></div><p class="report-summary">This is a functioning local prototype. The station is interactive; business data and marketplace activity are simulated.</p><div class="help-grid"><div><h3>Explore the station</h3><p>Drag the map or use WASD / arrow keys to pan. Scroll, pinch, or use + / − to zoom. Choose View station to return to the full layout.</p></div><div><h3>Meet your crew</h3><p>Click a room, choose a department in the sidebar, or click an employee. Locate smoothly focuses the camera on a department.</p></div><div><h3>Assign useful movement</h3><p>Launch a simulated scan or assign a department task. Agents walk to a workstation, process the job, deliver a report, then return to standby.</p></div><div><h3>Review before acting</h3><p>Open a completed report from Overview or History. Arbitrage reports include commission, liability, liquidity and both outcome profits. Paper orders reserve virtual funds only.</p></div></div><div class="simulation-banner">${icon("lock")} No live integrations, real betting, autonomous purchases or earned income.</div><p class="paper-note">Run locally with Python + Node.js. Task history and paper orders persist in .runtime/tycoon.sqlite3. See the project README for Windows launch instructions.</p>`;
  (el("report-dialog") as HTMLDialogElement).showModal();
}

async function refresh() {
  try {
    const next: Snapshot = await api("state");
    state = next;
    failures = 0;
    connected = true;
    el("connection-text").textContent = "STATION SYSTEMS ONLINE";
    el("connection-dot").classList.remove("offline");
    el("map-loading").classList.add("hidden");
    scene.sync(next);
    render(next);
  } catch {
    failures++;
    connected = false;
    el("connection-text").textContent = "BACKEND OFFLINE · RETRYING";
    el("connection-dot").classList.add("offline");
    if (!state)
      el("map-loading").innerHTML =
        `${icon("terminal")}<span>Waiting for the Python backend…<small>Start: python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000</small></span>`;
    if (state) {
      renderKey = "";
      render(state);
    }
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target as Element;
  const nav = target.closest<HTMLElement>("[data-department]");
  if (nav) selectDepartment(nav.dataset.department!, true);
  const mini = target.closest<SVGElement>("[data-mini]");
  if (mini) selectDepartment(mini.dataset.mini!, true);
  const tabButton = target.closest<HTMLElement>("[data-tab]");
  if (tabButton) setTab(tabButton.dataset.tab!);
  const agent = target.closest<HTMLElement>("[data-agent]");
  if (agent) {
    selectedAgent =
      selectedAgent === agent.dataset.agent ? "" : agent.dataset.agent!;
    renderKey = "";
    if (state) render(state);
  }
  if (target.closest("[data-show-agents]")) setTab("agents");
  const report = target.closest<HTMLElement>("[data-report]");
  if (report) {
    helpOpen = false;
    modalTask = report.dataset.report!;
    renderReport(modalTask);
    (el("report-dialog") as HTMLDialogElement).showModal();
  }
  if (target.closest("[data-close]"))
    (el("report-dialog") as HTMLDialogElement).close();
  if (target.closest("#assign-task")) await assignTask();
  const paper = target.closest<HTMLButtonElement>("#paper-order");
  if (paper) {
    paper.disabled = true;
    try {
      await api("paper-trades", { task_id: paper.dataset.task });
      toast("Paper order recorded. Virtual capital reserved.");
      await refresh();
    } catch (error) {
      toast((error as Error).message, true);
      paper.disabled = false;
    }
  }
});

for (const id of ["fit", "station-view", "reset-camera"])
  el(id).addEventListener("click", () => scene.resetView());
el("zoom-in").addEventListener("click", () => scene.zoom(0.15));
el("zoom-out").addEventListener("click", () => scene.zoom(-0.15));
el("focus-dept").addEventListener("click", () => scene.select(selected, true));
for (const id of ["help", "controls-button"])
  el(id).addEventListener("click", openHelp);
el("report-dialog").addEventListener("close", () => {
  modalTask = null;
  helpOpen = false;
  reportKey = "";
});
el("report-dialog").addEventListener("click", (event) => {
  if (event.target === el("report-dialog")) {
    const box = el("report-dialog").getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      (el("report-dialog") as HTMLDialogElement).close();
  }
});

// Sequential polling avoids overlapping requests and retries automatically after a lost connection.
async function poll() {
  await refresh();
  window.setTimeout(poll, connected ? 450 : Math.min(4000, 500 * failures));
}
poll();
