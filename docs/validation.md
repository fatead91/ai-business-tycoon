# Prototype validation

Validated in the supplied Linux cloud environment with Python 3.12, Node 24 and system Chromium. Windows launch commands and a cross-platform launcher are included; native Windows execution has not been tested in this environment.

- `npm ci`: clean, lockfile-based dependency installation.
- `npm run build`: TypeScript checking and Vite production build.
- `.venv/bin/python -m unittest discover -s tests -v`: 12 passing tests. Covers commission-adjusted outcomes, liquidity/capital rejection, idle stability, purposeful worker states and positions, simultaneous departments, worker selection, validation, execution blocking, duplicate paper records and restart persistence.
- Browser smoke: uses an actual temporary FastAPI server, temporary SQLite database and built Phaser client. Checks the rendered character's coordinates change during an assigned movement and remain constant while idle, in addition to server task states.
- Browser flow: pan, zoom, room selection, scan dispatch, completed report, rejected fixture, paper order, capital reservation, reload persistence, department job, agent inspection, offline recovery and help.
- Responsive checks at 1512×982, 1024×768 and 390×844. No horizontal overflow at these sizes.
- Launcher: executed `python run.py --setup --port 8001`, verified successful build and HTTP 200 for the built frontend, health and station state.
- `npm audit`: no known vulnerabilities reported after updating Vite and the supported esbuild dependency.

Browser screenshots are written to ignored `test-results/`. Tests use temporary databases and do not add demonstration profits or orders to the user's local station.

Live exchange connectivity, real business automation, monetary execution, order settlement, agent creation and remote deployment remain outside this prototype. None is claimed as validated.

## Visualization/startup investigation

The running Uvicorn service was healthy on loopback but bound only to `127.0.0.1:8000`. Direct requests to both of the machine's network interfaces were refused. The saved startup instructions used the same loopback-only bind, so restarting from those instructions reproduced the connectivity problem.

Added an explicit `--host` launcher option and changed cloud startup to `--host 0.0.0.0 --port 8000`, preserving loopback as the local Windows default. Restarted the existing built app and retained logs in `.runtime/server.log`. No dependency installation or frontend build was needed. The SHA-256 checksums of the existing HTML, JavaScript and CSS are unchanged. The runtime database was backed up before restarting; existing task and paper-order counts were preserved.

After the restart, `/`, `/api/health` and `/api/state` returned HTTP 200 through loopback and both network interfaces. Chromium loaded the actual service through a non-loopback interface, fetched its assets and state successfully, and selected all 16 employees through the canvas across all six departments. This passed with normal WebGL selection and with WebGL disabled (Canvas rendering), with no JavaScript errors or failed requests. A direct browser connection was used to avoid routing this local interface test through a browser proxy.

The extended end-to-end regression also selects every employee, then exercises the existing scan, risk report, paper reservation, reload persistence, department worker selection, offline recovery, camera controls, help and responsive layouts. It passed, as did the 12 backend tests. Real-money execution remains disabled.

The product's Web Preview panel could not be opened from this onboarding chat: no preview control or URL tool is available here. Network and browser validation establish application reachability and rendering, not publication of a product preview. A supported client should target port 8000 and `/`; otherwise use the Windows launch instructions in the README.
