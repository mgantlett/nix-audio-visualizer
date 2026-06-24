# Implement Unified Multi-Repository Swarm Cockpit (Task 331)

Provide exactly one Swarm Cockpit dashboard running on port 8088 by default, with the ability to dynamically detect and swap the workspace context to any neighboring repository.

## Open Questions

> [!IMPORTANT]
> 1. **Neighbor Discovery Pathing:** Our proposed scanner searches:
>    - Sibling checkouts in the parent folder of the active repo (e.g., `~/Projects/*`).
>    - Folders inside the path specified by `ADO_NEIGHBORS_DIR` in `~/.global.ado.config.env` (if defined).
>    Are there other workspace directory patterns we should scan?
> 2. **Dropdown Label Format:** We propose displaying the repository directory's basename in the select dropdown and showing the absolute path as a tooltip. Does that align with your preference?

## Proposed Changes

### Telemetry Server & Route Handlers

#### [MODIFY] [server.ts](file:///home/markg/Projects/ado-core/src/control-plane-backend/server.ts)
- Change `const repoRoot` to a mutable `let repoRoot`.
- Implement `GET /api/context/list` to return:
  - Discovered neighboring repositories containing a `.agent` folder.
  - The current active `repoRoot` path.
- Implement `POST /api/context` which:
  - Takes `{ repoRoot: string }` in the body.
  - Verifies the directory path exists and contains a `.agent` folder.
  - Updates the active backend `repoRoot` variable.
  - Restarts the telemetry background polling and worker status loops pointing to the new root.

### Dashboard Launcher & Router Scripts

#### [MODIFY] [dashboard.sh](file:///home/markg/Projects/ado-core/plugins-available/core/dashboard.sh)
- Reconfigure the default `SELECTED_PORT` to always be `8088`.
- If a server on `8088` is already active:
  - Verify if its `repoRoot` matches the current workspace root.
  - If they do not match, send a `POST /api/context` request to reuse the active server and switch its context to the current workspace root.
  - Skip starting a new backend process if successfully reused/swapped.
- Add `stop`/`--stop` argument parsing to kill any active `control-plane-backend/dist/server.js` processes.

#### [MODIFY] [swarm_router.sh](file:///home/markg/Projects/ado-core/plugins-available/swarm/swarm_router.sh)
- Forward trailing arguments of `swarm ui` down to `core_dashboard --web "$@"`.

### Go TUI Dashboard

#### [MODIFY] [update_events.go](file:///home/markg/Projects/ado-core/src/dashboard/update_events.go)
- Separate key bindings for `w` and `W`:
  - `w` will launch the Swarm Control Plane Web UI.
  - `W` will stop/kill the active Web UI telemetry server by calling `bin/agent swarm ui stop`.

### Frontend User Interface

#### [MODIFY] [index.html](file:///home/markg/Projects/ado-core/src/control-plane-ui/index.html)
- Add a `<select id="workspace-context-switcher">` dropdown element to the header bar for swapping between discovered workspaces.

#### [MODIFY] [app.ts](file:///home/markg/Projects/ado-core/src/control-plane-ui/ts/app.ts)
- Implement `initWorkspaceContextSwitcher()` to:
  - Retrieve the discovered repositories and active context from `/api/context/list`.
  - Populate the select dropdown.
  - Bind a change listener to send a `POST /api/context` payload when a different context is selected.
  - On success, trigger `refreshData()` to reload the dashboard state.
- Wire up `initWorkspaceContextSwitcher()` inside the window load listener.

## Verification Plan

### Automated Tests
- Build UI, server, and Go TUI:
  ```bash
  nix-shell --run "npm run server:build && npm run dashboard:build"
  ```
- Run control plane backend BATS suite to ensure existing APIs behave correctly:
  ```bash
  nix-shell --run "./test/bats/bin/bats test/control_plane_backend.bats"
  ```
- Run the full Definition of Done check:
  ```bash
  nix-shell --run "bin/agent verify dod"
  ```

### Manual Verification
- Run `bin/agent dashboard --web` in `ado-core` to spin up the server on port 8088.
- Run `bin/agent dashboard --web` in a neighboring repository, verifying it successfully switches the active backend context without spawning a second telemetry process.
- Open the dashboard in the browser, verifying the switcher dropdown displays all neighboring repos and successfully swaps contexts on demand.
