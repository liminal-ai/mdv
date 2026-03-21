# Story 5: Electron Shell and Window Management

### Summary
<!-- Jira: Summary field -->

Electron wrapper runs Fastify in-process, displays the web app in a BrowserWindow, with single-instance lock, window state persistence, and no-flash startup.

### Description
<!-- Jira: Description field -->

**Primary User:** Desktop user who wants MD Viewer as a native macOS application with a dock icon and proper window management.
**Context:** The Fastify server's `startServer()` function accepts injectable options. The Electron main process calls it with `openUrl: noop` and `preferredPort: 0`, then opens a BrowserWindow at the returned localhost URL.

**Objective:** A working Electron shell that starts the server, displays the web app identically to the browser version, manages window lifecycle, and handles startup errors.

**Scope:**

In scope:
- Electron main process: app lifecycle, `startServer()` integration, single-instance lock
- BrowserWindow: show-when-ready (no white flash), security settings (contextIsolation, sandbox, no nodeIntegration)
- Window state persistence via `electron-window-state` (position, size, maximized)
- Disconnected display guard (reset to primary display if saved position is off-screen)
- Server startup failure: show error page
- Server crash mid-session: show "Server disconnected — Restart" button
- Preload script: contextBridge with 7 methods

Out of scope:
- Native menus (Story 6)
- Quit flow (Story 6)
- File associations (Story 7)
- Packaging and install (Story 7)

**Dependencies:** Story 4 complete (tab persistence should be in place before Electron wraps the app).

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-7.1:** Electron runs Fastify in-process and displays the web app

- **TC-7.1a: In-process server startup**
  - Given: User launches the Electron app
  - When: The app starts
  - Then: Fastify starts in the Electron main process. A BrowserWindow loads `http://localhost:{port}`. The web app renders identically to the browser-based version.

- **TC-7.1b: Server port selection**
  - Given: The default port is in use
  - When: Electron starts the server
  - Then: The server binds to the next available port (consistent with Epic 1 AC-1.1 TC-1.1c). The BrowserWindow loads the correct URL.

- **TC-7.1c: No white flash on startup**
  - Given: The Electron app is launching
  - When: The BrowserWindow is created
  - Then: The window is not shown until initial content is ready. The user does not see a white or blank window.

**AC-7.2:** Single-instance lock prevents multiple app instances

- **TC-7.2a: Second launch with no file argument**
  - Given: The app is already running
  - When: User launches the app again
  - Then: The existing window is focused. No second instance is created.

- **TC-7.2b: Second launch with a file argument**
  - Given: The app is already running
  - When: User opens a `.md` file that triggers a second launch
  - Then: The existing window is focused and the file opens in a new tab in the running instance.

**AC-7.3:** Window remembers size and position across restarts

- **TC-7.3a: Window state persisted**
  - Given: User resizes and moves the Electron window
  - When: App is quit and relaunched
  - Then: The window opens at the same size and position

- **TC-7.3b: Window on disconnected display**
  - Given: User used the app on an external monitor that is now disconnected
  - When: App launches
  - Then: The window opens on the primary display at a reasonable size rather than off-screen

**AC-4.1:** App is ready to use within target (Electron portion)

- **TC-4.1b: Electron app startup**
  - Given: User double-clicks the Electron app in ~/Applications
  - When: The app launches
  - Then: A window appears within 2 seconds (may show loading state). The app is fully interactive within 4 seconds. No white flash.

**AC-13.2:** Electron-specific errors are handled gracefully

- **TC-13.2a: Server fails to start in Electron**
  - Given: The Electron app is launching but Fastify fails to start
  - When: The startup error occurs
  - Then: The window shows an error message explaining that the server could not start, rather than a blank window or crash.

- **TC-13.2b: Server crashes mid-session**
  - Given: The Fastify server crashes during normal use in Electron
  - When: API requests fail
  - Then: The web app shows server connection errors (consistent with Epic 2 AC-9.3). The Electron wrapper shows a "Server disconnected — Restart" button. Clicking it restarts the Fastify server and reloads the page.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**New modules:**
- `electron/main.ts` — app lifecycle, startServer integration, single-instance lock, open-file listener (registered before `app.whenReady()`)
- `electron/window.ts` — BrowserWindow creation with electron-window-state, display guard
- `electron/preload.ts` — contextBridge with 7 methods
- `electron/ipc.ts` — IPC handler registration (quit flow wiring)
- `electron/file-handler.ts` — did-finish-load flush for pending file path
- `client/utils/electron-bridge.ts` — type-safe client-side IPC wrapper

**IPC channels (tech design deviations from epic noted):**

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `menu:action` | main → renderer | Native menu item selected |
| `menu:state-update` | renderer → main | Update menu enabled/checked state *(added by tech design for AC-8.2 — not in epic IPC table)* |
| `app:open-file` | main → renderer | OS requested file open |
| `app:quit-request` | main → renderer | User initiated quit |
| `app:quit-confirmed` | renderer → main | Safe to quit |
| `app:quit-cancelled` | renderer → main | User cancelled quit |

Note: The epic lists `app:is-electron` IPC channel. The tech design replaced this with a URL query parameter (`?electron=1`) for synchronous detection without IPC round-trip. See tech-design.md spec validation table.

**Window state:** `electron-window-state@5.0.3` (CJS — loaded via `createRequire`). Stores to Electron's `userData` directory, separate from Fastify session data.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `npm run verify` passes
- [ ] `npm run build:electron` produces `main.js` and `preload.js`
- [ ] Electron app starts Fastify in-process and displays the web app
- [ ] Dynamic port selection works when default port is in use
- [ ] Window appears without white flash
- [ ] Single-instance lock prevents duplicate windows
- [ ] Window state (position, size) persists across restarts
- [ ] Off-screen window resets to primary display
- [ ] Server startup failure shows error page
- [ ] Server crash shows restart button
