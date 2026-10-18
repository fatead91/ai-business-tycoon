# AI Business Tycoon

A playable, top-down spaceship headquarters for managing task-driven agents. Phaser renders the station; FastAPI coordinates work; SQLite retains task reports, the event log and paper orders. Everything runs on your laptop. No API keys, accounts, database servers or paid services are required.

**This prototype uses simulated business tasks and invented exchange fixtures. It does not fetch live odds, place bets, publish listings, contact clients or earn income. Real-money execution is disabled in the backend.**

## Start on Windows in VS Code

Prerequisites: **Python 3.11+** and **Node.js 22.12+ LTS** (Node includes npm). If Node was just installed, restart VS Code. An internet connection is needed for the first dependency installation.

Download from the existing private GitHub repository while signed into an account with access: choose branch **main**, then **Code → Download ZIP**. Extract the ZIP first, then open the extracted folder containing this README in VS Code. Alternatively, use **Code → HTTPS** to clone the private repository with your normal GitHub sign-in. Keep the repository private; no publication or repository visibility change is needed to run it on your laptop.

1. Open this project folder in VS Code: **File → Open Folder**.
2. Open **Terminal → New Terminal**.
3. Run:

   ```powershell
   py -3 run.py --setup
   ```

   If `py` is unavailable but Python is on PATH, use `python run.py --setup`.
   The original entry point also works: `py -3 main.py --setup` delegates to the same launcher.

4. When Uvicorn says the server has started, open `http://127.0.0.1:8000` in your browser.
5. Leave the terminal running. Stop it with **Ctrl+C**.

The launcher creates `.venv`, installs the pinned Python and npm dependencies, builds the frontend and starts the local server. It does not need PowerShell activation or an execution-policy change. You can also double-click `start.bat` for setup and launch.

On later launches, skip installation and rebuilding:

```powershell
py -3 run.py
```

If port 8000 is occupied, use `py -3 run.py --port 8001`. After frontend changes, rebuild using `npm run build` or rerun `--setup`. The same launcher works on Linux/macOS using `python3 run.py --setup`.

## Cloud startup and preview connectivity

The prepared cloud checkout already contains its dependencies and production build. Start it without reinstalling or rebuilding:

```bash
cd /workspace/ai-business-tycoon
mkdir -p .runtime
set -o pipefail
.venv/bin/python -u run.py --host 0.0.0.0 --port 8000 2>&1 | tee -a .runtime/server.log
```

This single service serves both the headquarters and `/api`; a separate Vite process is unnecessary for normal use. Keep the terminal running. In a client that provides a managed Web Preview, select **port 8000** and open the root path `/`. Availability of that preview control depends on the client; the onboarding chat itself does not provide a publishable browser preview or preview URL.

Cloud previews that connect over the machine's network interface cannot reach a server bound only to `127.0.0.1`. The explicit `--host 0.0.0.0` option makes the app reachable through those interfaces. Windows/local launches continue to bind only to loopback unless you explicitly choose another host.

If the visualization does not open, inspect `.runtime/server.log`. Check `/api/health`, `/api/state`, `/` and the JavaScript/CSS asset requests through the same origin and port. The expected catalog has six departments and 16 agents, and health must report `real_execution_enabled: false`. A successful local health check alone does not prove that a preview can reach the service. Do not delete the SQLite database or reinstall dependencies to fix a bind-address problem.

## First mission

1. Drag the station to pan, scroll or pinch to zoom, or use the on-screen + / − controls. WASD / arrows also pan while a form isn't focused. **View station** resets the camera.
2. Click a room or a department in the left navigation. **Locate** focuses the selected room. Click an employee or use **Agents** to inspect its current activity.
3. In **Arbitrage Betting**, keep the virtual back stake at £100 and choose **Launch simulated scan**.
4. Watch SCOUT and the three exchange workers move to their computers. AEGIS waits for their output, then moves to review risk. ATLAS moves last to review the report. All six return to standby when finished. A scan takes roughly 20–25 seconds.
5. Choose **Inspect report**. Both fabricated markets appear, including one rejected after commission. A £100 fixture scan produces approximately £2.52 of estimated paper edge with £215.08 required capital.
6. **Record paper order** reserves virtual capital once per scan. It does not settle an order or credit income. Treasury separates available funds, reserved funds and estimated edge from real revenue and expenses.
7. Try another department. Choose a worker and assign a task for a clearly labelled demonstration report. **History** persists after a server restart.

## Development

The supplied cloud environment is already an isolated checkout. Use it directly; no worktree is needed.

Backend terminal (from the project root):

```powershell
.venv\Scripts\python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
```

Frontend terminal:

```powershell
npm run dev
```

Vite prints its development address (normally port 5173) and proxies `/api` to FastAPI. Linux/macOS uses `.venv/bin/python` instead. The built version is served directly by FastAPI, so normal play needs only one server.

```powershell
npm run build
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m unittest discover -s tests -v
```

Optional browser regression: `.venv\Scripts\python -m playwright install chromium`, then `npm run test:ui`. The browser smoke script starts an isolated server and uses a temporary database; it does not alter your station history. Set `TYCOON_CHROMIUM` to a system Chromium executable if desired.

## Structure and extension points

| Path | Purpose |
| --- | --- |
| `frontend/src/scene.ts` | Phaser station geometry, pixel furniture, character rendering, interpolated task routes and camera controls |
| `frontend/src/main.ts` | Department controls, agent inspection, polling, reports and paper-order UI |
| `backend/catalog.py` | Departments, workstation coordinates and agent roles; add departments here |
| `backend/engine.py` | Async task state machine, worker handoffs and demonstration task adapters |
| `backend/arbitrage.py` | Pure commission-aware back/lay evaluator and explicit synthetic fixtures |
| `backend/store.py` | SQLite persistence, capital reservation and duplicate-order protection |
| `backend/app.py` | HTTP API and built frontend hosting |
| `docs/architecture.md` | State protocol, calculations and practical integration roadmap |
| `docs/reference-study.md` | Observations from the supplied video and their implementation |

Runtime data lives in `.runtime/tycoon.sqlite3` (ignored by Git). `TYCOON_DB` can point to a different local SQLite file. Back up this database while the server is stopped. Deleting it resets the virtual ledger and task history. Interrupted work becomes **Error** on the next startup, rather than being silently resumed or marked successful.

The first server launch automatically creates the SQLite database and its `tasks`, `trades` and `events` tables using `backend/store.py`. Python includes SQLite, so there is no separate database installation or manual schema command. The repository contains the database setup code, not a copy of anyone's runtime history. Installed dependencies, generated builds, local databases, secrets and temporary files are excluded from Git; `--setup` recreates the dependencies and build on your Windows machine.

## Scope and next stages

Phases 1–4 are represented by an interactive station, an authoritative backend task lifecycle, management panels and local Python execution. The business jobs are deliberately demonstrations. Agents are fixed in the catalog in this version; creating agents, custom skills and schedules are future work.

The arbitrage foundation includes fixture scanning, both-outcome profit evaluation, commission and liquidity checks, paper capital limits, review handoffs and recorded paper orders. Live exchange authentication, actual streaming prices, currency conversion, settlement rules, stale-quote protection, partial fills, unmatched-order recovery and paper settlement are not implemented. Separate adapters and substantial testing are needed before considering real execution.

The local server is unauthenticated and binds to loopback by default. Before remote operation, add authentication, HTTPS, durable job recovery, access controls and deployment supervision. Do not expose this prototype directly to the internet.

The interface adapts to narrow screens by placing department controls below the station; full-screen desktop remains the primary management experience.
