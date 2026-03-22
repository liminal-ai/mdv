# Technical Design: Epic 6 — Hardening and Electron Wrapper

## Purpose

This document is the index and decision record for Epic 6's technical design. It establishes the performance hardening approach and Electron wrapper architecture, records all dependency and design decisions (grounded in March 2026 web research and first-pass POC validation), answers the epic's 10 tech design questions, and maps modules to their companion design documents.

The detailed design is split across three companion documents:

| Document | Scope |
|----------|-------|
| [tech-design-api.md](tech-design-api.md) | Server: session schema migration (`openTabs` from `string[]` to `PersistedTab[]`), tree scan timeout handling, large file considerations |
| [tech-design-ui.md](tech-design-ui.md) | Client: Mermaid render cache, rendered view performance, file tree virtualization, tab restore on startup, Electron detection and HTML menu bar hiding. Electron: main process bootstrap, Fastify in-process, BrowserWindow management, native menus with state sync, IPC channels, preload bridge, quit flow, file association handling, window state persistence |
| [test-plan.md](test-plan.md) | TC→test mapping, mock strategy, test fixtures, verification scripts, chunk breakdown with test counts |

**Prerequisite:** Epics 1–5 complete (server runtime, rendering pipeline, Mermaid diagrams, syntax highlighting, export, editing with CodeMirror 6, dirty state tracking, conflict resolution, file watching, session persistence with tab tracking). Epic 6 spec (`epic.md`) is complete with 33 ACs and ~80 TCs.

---

## Spec Validation

Before designing, the epic was validated as the downstream consumer. All ACs map to implementation work. The following issues were identified and resolved:

| Issue | Spec Location | Resolution | Status |
|-------|---------------|------------|--------|
| Tab persistence infrastructure already exists | AC-11.1, A5 | The `openTabs: string[]` and `activeTab` fields in `SessionState`, the `PUT /api/session/tabs` endpoint, `syncTabsToSession()` on every tab open/close, and `restoreTabsFromSession()` on startup all exist from Epics 2–5. Epic 6 extends the shape from `string[]` to `PersistedTab[]` to include per-tab mode. No new endpoints needed. | Resolved — clarified |
| Electron runs Fastify in-process — `startServer()` already supports dependency injection | AC-7.1, A2 | `app/src/server/index.ts` exports `startServer(options)` which accepts injectable `buildApp`, `openUrl`, `host`, and `preferredPort`. The Electron main process calls `startServer({ openUrl: () => {} })` to suppress browser opening and captures the returned Fastify instance for lifecycle management. | Resolved |
| Native menu bar replaces HTML menu bar — detection mechanism needed | AC-8.3, A7 | The Electron BrowserWindow loads `http://localhost:{port}?electron=1`. The client checks `new URLSearchParams(location.search).has('electron')` on initial load and sets a CSS class `body.electron` that hides the HTML menu bar. This avoids IPC round-trips on startup and prevents flash of the HTML menu bar. | Resolved |
| `electron-window-state` is CommonJS-only | AC-7.3 | The Electron main process uses `createRequire(import.meta.url)` to load the CJS module. The rest of the main process remains ESM. This is a standard interop pattern documented by Node.js. | Resolved |
| Mermaid cache needs a key strategy | AC-6.1, Q3 | Cache keys use `sourceHash + themeId`. Source hash is a fast 32-bit FNV-1a hash of the Mermaid source text (not SHA-256 — cryptographic strength is unnecessary for cache keys). The cache is global across tabs with a max of 200 entries and LRU eviction. Per-tab cache would duplicate entries for the same diagram across tabs. | Resolved |
| File tree virtualization is a tech design question, not a spec decision | AC-2.1, Q7 | Virtual scrolling for the file tree (only render visible nodes in the DOM). At 1,000+ nodes, DOM rendering becomes the bottleneck — not the tree scan. The existing tree component renders all nodes; this needs to be replaced with a virtualized list. | Resolved |
| Ad-hoc signing vs. Developer ID signing | AC-12.2, Amendment 1 | Ad-hoc signing is a build-tool default for ARM64, not Apple Developer ID signing. electron-builder v26+ applies it automatically. No Apple Developer account needed. The "unverified developer" warning is a one-time user bypass via System Settings. | Resolved — clarified |
| Export uses Puppeteer — separate from Electron's Chromium | Epic 4 dependency | Puppeteer bundles its own Chromium for PDF generation. This is separate from Electron's Chromium. Running both in-process means two Chromium instances during export. Memory impact is ~200MB during export, acceptable since exports are infrequent. The Puppeteer Chromium path should be set to the existing download, not re-downloaded inside the Electron app bundle. | Resolved |
| Epic lists `app:is-electron` IPC channel for Electron detection | IPC Channels table | The tech design uses a URL query parameter (`?electron=1`) instead of IPC for Electron detection. This is synchronous and avoids flash of the HTML menu bar. The `app:is-electron` IPC channel is not implemented. | Resolved — deviated |
| Epic IPC table missing `menu:state-update` channel | IPC Channels table | The tech design adds `menu:state-update` (renderer → main) for native menu state synchronization. This was implied by AC-8.2 (menu state sync) but not listed in the epic's IPC table. | Resolved — deviated |

| Existing 5MB file size limit blocks large file ACs | AC-1.1, AC-13.1a | `FileService` has `MAX_FILE_SIZE = 5 * 1024 * 1024` and throws `FileTooLargeError` for files over 5MB. Epic 6 requires 10K+ line files (which may exceed 5MB) to render. Design raises the limit to 20MB and adds a client-side "large file" indicator for files over 5MB. The 20MB hard limit prevents truly pathological files from crashing the server. | Resolved — deviated |
| Tree scan already has symlink loop detection | AC-5.2 | The existing `tree.service.ts` already uses a `visited: Set<string>` with `realpath()` to detect symlink loops, and silently skips broken symlinks. The design's tree hardening adds timeout and depth guard on top of this existing behavior — it does not introduce loop detection from scratch. | Resolved — clarified |
| Epic says "no new API error codes" but tree timeout needs one | AC-5.3a, Error Responses | The epic's error response section says "No new API error codes." The tree timeout requires server feedback. Resolution: use the existing 500 SCAN_ERROR code with a `timeout: true` field in the error body rather than a new 408 status. The client detects the timeout from the error body, not the status code. | Resolved — deviated |
| Epic says partial tree on timeout; server scan-and-abort does not produce partial results | TC-13.1b | The AbortController cancels the scan entirely — there is no partial tree to return. Design deviates: timeout produces a retry prompt (500 SCAN_ERROR with `timeout: true`), not a partial tree. A retry prompt is more useful than a partial tree with inconsistent structure and missing counts. | Resolved — deviated |
| Epic says show missing-file tabs; server healing removes them | AC-11.1d | The epic requires deleted tabs to appear with a "file not found" indicator. The API doc's `healOpenTabs` was removing them server-side, contradicting this. Resolution: remove `healOpenTabs` — the server returns ALL persisted tabs regardless of file existence. The client handles missing files on load (consistent with Epic 2 AC-7.3 which already shows "file not found" state). | Resolved — deviated |

**Verdict:** Spec is implementation-ready with the deviations documented above. The existing codebase provides substantial infrastructure (tab persistence, `startServer()` injection, file watching, session service, symlink-safe tree scanning). The Electron POC validates the wrapper pattern — same architecture, adapted for the browser-first Fastify approach.

---

## Context

Epics 1–5 built a complete markdown workspace: browse directories, render documents with Mermaid diagrams and syntax-highlighted code, export to PDF/DOCX/HTML, and edit with CodeMirror 6. The app runs as a Fastify server serving a vanilla HTML/CSS/JS frontend on localhost. It works. Users have been using it daily.

Epic 6 addresses two concerns that emerge from daily use. First, real-world directories are messy. AI agents generate thousands of markdown files in deeply nested structures. Users keep 20+ tabs open. Some documents are 10,000+ lines. The app needs to handle these scales without freezing. Second, some users want the app to feel like a native desktop application — double-click a `.md` file in Finder, see a dock icon, get a proper Cmd+Q quit flow.

The performance hardening work is entirely browser-side. Large file rendering benefits from chunked DOM insertion to avoid blocking the main thread. The file tree needs virtual scrolling — at 1,000+ nodes, the DOM itself becomes the bottleneck. Mermaid diagrams benefit from caching rendered SVGs so tab switches and mode switches don't re-invoke the rendering library. These optimizations happen in the client code without changing the Fastify API surface.

The Electron wrapper is architecturally thin because the Fastify server already handles everything. File operations, session persistence, export, file watching — all go through REST endpoints. The wrapper's job is narrow: start Fastify in-process, open a BrowserWindow pointed at localhost, wire native macOS menus to the web app via lightweight IPC, handle `open-file` events from the OS, and implement the Electron-specific quit modal that Epic 5 deferred (TC-5.3a–d). The first-pass POC validates this approach, though the POC was a full Electron app that duplicated server logic in the main process — our design is deliberately thinner because the Fastify server already exists.

The `startServer()` function in `app/src/server/index.ts` was designed for this moment. It accepts injectable options: `openUrl` (set to no-op in Electron since BrowserWindow handles display), `preferredPort` (dynamic), and `buildApp` (the Fastify factory). The Electron main process calls `startServer()`, waits for the returned address, then opens a BrowserWindow at that URL. The server lifecycle is tied to the Electron app lifecycle — when the app quits, the server shuts down.

### Stack Additions for Epic 6

All packages verified via web research (March 2026).

| Package | Version | Purpose | Research Confirmed |
|---------|---------|---------|-------------------|
| electron | 41.0.3 | Desktop wrapper (Chromium 146, Node 24.14.0) | Yes — latest stable, bundles Node 24 matching project runtime |
| electron-builder | 26.8.1 | Packaging, ad-hoc signing, .app bundle | Yes — v26+ auto ad-hoc signs ARM64 builds |
| electron-window-state | 5.0.3 | Window position/size persistence | Yes — battle-tested, single-purpose. CJS-only, needs `createRequire` interop |

**devDependencies only** (build tools, not bundled at runtime):

| Package | Version | Purpose |
|---------|---------|---------|
| electron | 41.0.3 | Electron is always a devDependency — electron-builder bundles the runtime |
| electron-builder | 26.8.1 | Build/packaging tool |

Note: `electron-window-state` is a runtime dependency (listed in the stack additions table above), not a devDependency — it runs in the Electron main process at runtime.

**Packages NOT added (considered and rejected):**

| Package | Why Rejected |
|---------|-------------|
| electron-forge | electron-builder has 3x npm downloads, simpler config-driven approach, first-class `fileAssociations`, built-in ad-hoc signing. The POC used electron-forge; we switch to electron-builder for better macOS unsigned distribution support. |
| electron-store / electron-conf | Not needed — session data already lives in `~/Library/Application Support/md-viewer/session.json` via the Fastify SessionService. Electron reads the same file. No separate Electron-specific store. |
| @electron/rebuild | Not needed — no native Node addons run in the Electron main process. Puppeteer (native addon via Chromium download) runs via the Fastify server, not via Electron's Node. |
| Tauri | Requires Rust toolchain. Uses WebKit (not Chromium) on macOS, which would introduce rendering inconsistencies with the browser-based version. Electron's Node.js main process can run Fastify directly — Tauri's Rust backend cannot. |

---

## Tech Design Question Answers

The epic raised 10 questions for the tech lead. All are answered here; detailed implementation follows in the companion documents.

### Q1: Electron version and build tooling

**Answer:** Electron 41.0.3 with electron-builder 26.8.1.

Electron 41 bundles Chromium 146 and Node 24.14.0. The bundled Node 24 matches the project's system Node 24 LTS, so Fastify 5.8.2 runs identically in both environments. TypeScript 5.9.3 and esbuild 0.27.4 compile the Electron main process the same way they compile the server — same `tsconfig.json` base, separate entry point.

electron-builder was chosen over electron-forge for three reasons: simpler declarative configuration (JSON in `package.json` or `electron-builder.yml`), first-class `fileAssociations` config that generates `CFBundleDocumentTypes` in Info.plist, and automatic ad-hoc signing for ARM64 builds (v26+). The POC used electron-forge — the switch is low-risk since packaging config is declarative, not programmatic.

**Detailed design:** See UI companion doc, Electron Main Process section.

### Q2: Tab state persistence — schema migration

**Answer:** Extend `openTabs` from `string[]` to `PersistedTab[]` with backward-compatible Zod union parsing.

The existing `SessionStateSchema` has `openTabs: z.array(AbsolutePathSchema).default([])`. The migration replaces this with a union schema that accepts either a plain string (legacy) or a `PersistedTab` object (new). On load, legacy strings are normalized to `{ path: string, mode: 'render' }` — the Zod schema can't reference the session's `defaultOpenMode` at parse time, so `'render'` is the safe one-time default for the first restart after upgrade. The `activeTab` field remains a string (path) — no change needed.

```typescript
const PersistedTabSchema = z.object({
  path: AbsolutePathSchema,
  mode: OpenModeSchema,
  scrollPosition: z.number().optional(),
});

// Legacy strings normalize to 'render' — the Zod transform can't reference
// session.defaultOpenMode at parse time. This is a one-time safe default
// for the first restart after upgrade from string[] to PersistedTab[].
const LegacyOrPersistedTab = z.union([
  AbsolutePathSchema.transform((path): z.infer<typeof PersistedTabSchema> => ({
    path,
    mode: 'render',
  })),
  PersistedTabSchema,
]);

// In SessionStateSchema:
openTabs: z.array(LegacyOrPersistedTab).default([]),
```

The `syncTabsToSession()` client function already sends tab paths on every open/close. The change is: send `PersistedTab` objects instead of strings. The server's `updateTabs()` method in `SessionService` already handles the mutation and persistence — the change is in the Zod schema validation, not the service logic.

**Detailed design:** See API companion doc, Session Schema Migration section.

### Q3: Mermaid cache implementation

**Answer:** Global LRU cache, 200 entries max, keyed by `sourceHash:themeId`.

The cache stores rendered SVG strings. The key is `fnv1a(mermaidSource):themeId` — a fast 32-bit FNV-1a hash of the source text concatenated with the theme ID. FNV-1a is chosen over SHA-256 because cache keys don't need cryptographic strength — collision resistance across a 200-entry cache is more than sufficient with 32-bit hashing.

The cache is global (not per-tab) because the same Mermaid source in different documents should hit the same cache entry. Tab close removes entries whose source hash appears only in the closed tab's document. Theme switch invalidates by themeId — entries for the old theme remain in cache (they'll be reused if the user switches back) until evicted by LRU pressure.

The 200-entry limit at ~5KB average SVG size means ~1MB memory ceiling. This is negligible compared to CodeMirror instances (~2MB each) and rendered HTML content.

**Detailed design:** See UI companion doc, Mermaid Render Cache section.

### Q4: Native menu bar detection

**Answer:** URL query parameter `?electron=1` on the BrowserWindow URL.

The Electron main process loads `http://localhost:{port}?electron=1`. The client checks `new URLSearchParams(location.search).has('electron')` synchronously in the initial JavaScript execution — before any DOM rendering. This sets a `body.electron` CSS class that hides the HTML menu bar via `body.electron #menu-bar { display: none }`.

Alternatives considered:
- **IPC check:** Requires async round-trip — the HTML menu bar would flash before the response arrives.
- **`navigator.userAgent` parsing:** Fragile, depends on Electron's UA string format.
- **Custom Fastify header:** Requires the client to wait for an API response before hiding the menu bar.

The query parameter is synchronous, reliable, and trivial to implement. The Electron main process controls the URL, so there's no spoofing concern (this is a localhost-only app).

**Detailed design:** See UI companion doc, Electron Detection section.

### Q5: Native menu state synchronization

**Answer:** Renderer sends state snapshots to the main process via IPC on state change. The main process updates menu item `enabled` and `checked` properties.

The client's `store.subscribe()` already fires on every state change. A new subscriber (active only in Electron) sends a `menu:state-update` IPC message containing:

```typescript
interface MenuState {
  hasDocument: boolean;          // any tab open
  hasDirtyTab: boolean;          // any tab dirty
  activeTabDirty: boolean;       // active tab dirty
  activeTheme: string;           // for theme checkmark
  activeMode: 'render' | 'edit'; // for mode indicator
  defaultMode: 'render' | 'edit';
}
```

The main process receives this and updates menu items: Export enabled/disabled, Save enabled/disabled, theme checkmarks, mode indicator. Updates are batched — the subscriber debounces at 50ms to avoid flooding IPC during rapid state changes (e.g., typing in the editor triggers dirty state on every keystroke).

**Detailed design:** See UI companion doc, Native Menu State Sync section.

### Q6: Large file rendering strategy

**Answer:** Chunked DOM insertion for rendered HTML. CodeMirror 6 already virtualizes editing.

For the rendered view (Render mode), the server returns the full HTML string. The client currently sets `contentArea.innerHTML = html` in one operation, which blocks the main thread for large documents. The fix is chunked insertion: split the HTML at block-level element boundaries (headings, paragraphs, code blocks, tables), insert chunks in batches of ~50 elements using `requestAnimationFrame()` or `requestIdleCallback()`, and yield between batches. This keeps the main thread responsive — the loading indicator animates, scroll events fire, and the user can switch tabs during rendering.

CodeMirror 6 already uses viewport-based rendering — it only renders lines visible in the viewport plus a small overscan buffer. A 10,000-line document in Edit mode renders ~50 lines at a time. No optimization needed for the editor.

For Mermaid diagrams in large documents: diagrams render asynchronously after the HTML is inserted (this is already the pattern from Epic 3). The chunked insertion doesn't change this — Mermaid post-processing runs after the HTML chunks are in the DOM.

**Detailed design:** See UI companion doc, Large File Rendering section.

### Q7: File tree virtualization

**Answer:** Virtual scrolling for the file tree. Only render nodes visible in the viewport.

At 1,000+ nodes, the DOM is the bottleneck — not the tree scan or data transfer. The current implementation renders every `TreeNode` as a DOM element. With 1,500 nodes fully expanded, that's 1,500+ DOM elements in the sidebar, each with event listeners, ARIA attributes, and hover states.

The fix is a virtualized list: calculate the total scroll height from the node count and fixed row height (each tree row is a fixed height — directory and file nodes use the same row height). Only render nodes visible in the viewport plus a small overscan buffer (~20 rows above and below). On scroll, recalculate which nodes are visible and swap DOM elements.

This is a custom implementation, not a library. Virtual scrolling libraries (react-virtual, @tanstack/virtual) are framework-specific. Our vanilla JS architecture means a lightweight custom virtualizer. The core is ~100 lines: a scroll container with `overflow-y: auto`, a spacer div for total height, and a render function that creates DOM elements for visible rows only.

The expand/collapse state and flat-list computation (converting the tree to an ordered list of visible nodes) is already handled by the existing tree component. The virtualization layer sits below this — it receives the flat list and renders a window of it.

**Detailed design:** See UI companion doc, File Tree Virtualization section.

### Q8: Electron preload script scope

**Answer:** Minimal. The preload exposes 7 methods via `contextBridge`.

```typescript
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  onMenuAction: (callback: (action: string, args?: unknown) => void) => void,
  onOpenFile: (callback: (path: string) => void) => void,
  onQuitRequest: (callback: () => void) => void,
  confirmQuit: () => void,
  cancelQuit: () => void,
  sendMenuState: (state: MenuState) => void,
});
```

All file operations (open, save, export, tree scan, file watch) continue to use the Fastify HTTP API. The preload bridge handles only what the browser cannot: receiving native menu events, receiving OS `open-file` events, and coordinating the quit flow. This keeps the IPC surface minimal and the Electron wrapper thin.

**Detailed design:** See UI companion doc, Preload Bridge section.

### Q9: Electron app user data location

**Answer:** Same location as the browser-based app. No change.

The existing `SessionService` stores data at `~/Library/Application Support/md-viewer/session.json`. This path is determined by `path.join(homedir(), 'Library', 'Application Support', 'md-viewer')` — it does not use Electron's `app.getPath('userData')`. Since the Fastify server runs in-process in Electron, it uses the same `SessionService` with the same path. Browser and Electron share the same session data automatically.

Electron's `app.getPath('userData')` defaults to `~/Library/Application Support/MD Viewer/` (with spaces, matching the app name). We do NOT use this — it would create a separate data location from the browser-based app. The existing path is stable and shared.

Window state (position/size) is Electron-only and is stored by `electron-window-state` in Electron's `userData` directory. This is acceptable — window state has no meaning for the browser-based app.

### Q10: Install script implementation

**Answer:** `npm run install-app` script that builds the server, builds the Electron main process, packages with electron-builder, and copies to `~/Applications/`.

The script chains: `npm run build` (existing — builds Fastify server + client bundle) → `npm run build:electron` (new — compiles Electron main process via esbuild) → `npx electron-builder --mac` (packages the .app bundle) → `cp -r dist/mac-arm64/MD\ Viewer.app ~/Applications/` (or `dist/mac/` for Intel).

The install script does not create a `mdv` CLI symlink — that's a separate concern (the browser-based app already starts via `npm start`). Users who want CLI launch can alias it themselves.

**Detailed design:** See UI companion doc, Packaging and Install section.

---

## High Altitude: System View

### System Context

Epic 6 introduces a second runtime mode for the same application. In browser mode, the user runs `npm start`, Fastify binds to localhost, and the user opens a browser tab. In Electron mode, the user double-clicks the .app bundle, Electron starts Fastify in-process, and a BrowserWindow loads the same localhost URL. Both modes use the same server, same client, same session data.

```
┌─────────────────────────────────────────────────────────┐
│  Browser Mode                                           │
│                                                         │
│  Terminal ──→ npm start ──→ Fastify (localhost:3000)     │
│                                ↕                        │
│  Chrome/Safari ──→ http://localhost:3000                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Electron Mode                                          │
│                                                         │
│  ~/Applications/MD Viewer.app                           │
│  ┌─────────────────────────────────────────────┐        │
│  │  Main Process (Node 24.14.0)                │        │
│  │  ├── Fastify server (in-process)            │        │
│  │  ├── Native menu bar                        │        │
│  │  ├── Window state persistence               │        │
│  │  ├── open-file event handler                │        │
│  │  └── Single-instance lock                   │        │
│  └─────────────────────────────────────────────┘        │
│           ↕ IPC (minimal)                               │
│  ┌─────────────────────────────────────────────┐        │
│  │  Renderer Process (Chromium 146)            │        │
│  │  └── Same web app as browser mode           │        │
│  │      (http://localhost:{port}?electron=1)   │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

The only difference between modes visible to the web app: the `?electron=1` query parameter triggers HTML menu bar hiding and enables the IPC-based quit flow. All other functionality (rendering, editing, exporting, file watching) works identically because it all goes through the Fastify API.

### Data Flow Overview

**Performance hardening** touches the client rendering pipeline only:

```
Server response (HTML string)
  ↓
Chunked DOM insertion (new — yields to main thread between batches)
  ↓
Mermaid post-processing (existing — now with SVG cache layer)
  ↓
Displayed content
```

**File tree** adds a virtualization layer:

```
GET /api/tree → TreeNode[] (unchanged)
  ↓
Flatten to visible node list (existing)
  ↓
Virtual scroll renderer (new — renders viewport window only)
  ↓
DOM (only visible rows)
```

**Electron wrapper** adds the main process bootstrap:

```
app.whenReady()
  ↓
startServer({ openUrl: noop }) → Fastify listening on localhost:{port}
  ↓
createBrowserWindow() → loads http://localhost:{port}?electron=1
  ↓
Register: native menus, open-file handler, single-instance lock
  ↓
IPC bridge: menu:action, app:open-file, quit flow
```

### External Contracts

No new Fastify API endpoints. The only API change is the `openTabs` field shape in `SessionState` (from `string[]` to `PersistedTab[]`, backward compatible via Zod union).

**New contracts are Electron IPC only:**

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `menu:action` | main → renderer | `{ action: string, args?: unknown }` | Native menu item clicked |
| `menu:state-update` | renderer → main | `MenuState` | Update menu enabled/checked state |
| `app:open-file` | main → renderer | `{ path: string }` | OS requested file open |
| `app:quit-request` | main → renderer | `{}` | User initiated quit |
| `app:quit-confirmed` | renderer → main | `{}` | Safe to quit |
| `app:quit-cancelled` | renderer → main | `{}` | User cancelled quit |

### Runtime Prerequisites

| Prerequisite | Where Needed | How to Verify |
|---|---|---|
| Node.js 24 LTS | Build + browser-mode runtime | `node --version` |
| npm | Build + dependency install | `npm --version` |
| Electron 41 (bundled) | Electron mode runtime | Bundled by electron-builder |
| macOS 12+ | Electron packaging target | `sw_vers` |

---

## Medium Altitude: Module Architecture

### New Modules (Electron)

```
app/
├── src/
│   ├── electron/
│   │   ├── main.ts                    # NEW: Electron entry point, app lifecycle
│   │   ├── window.ts                  # NEW: BrowserWindow creation, state persistence
│   │   ├── menu.ts                    # NEW: Native menu bar construction, state sync
│   │   ├── ipc.ts                     # NEW: IPC handler registration
│   │   ├── file-handler.ts            # NEW: open-file event → renderer routing
│   │   └── preload.ts                 # NEW: contextBridge API (minimal)
│   ├── client/
│   │   ├── utils/
│   │   │   └── electron-bridge.ts     # NEW: Client-side IPC wrapper
│   │   ├── components/
│   │   │   └── mermaid-cache.ts       # NEW: LRU cache for rendered Mermaid SVGs
│   │   │   └── virtual-tree.ts        # NEW: Virtualized file tree renderer
│   │   │   └── chunked-render.ts      # NEW: Chunked DOM insertion for large docs
│   │   └── app.ts                     # MODIFIED: tab restore, electron detection, quit flow
│   └── server/
│       └── schemas/index.ts           # MODIFIED: PersistedTab schema, union parsing
├── electron-builder.yml               # NEW: Packaging configuration
├── tsconfig.electron.json             # NEW: TypeScript config for Electron main process
└── scripts/
    └── install-app.sh                 # NEW: One-command install script
```

### Module Responsibility Matrix

| Module | Type | Responsibility | Dependencies | ACs Covered |
|--------|------|----------------|--------------|-------------|
| **New Electron modules** | | | | |
| `electron/main.ts` | Entry | App lifecycle, server startup, single-instance lock | window, menu, ipc, file-handler, server/index | AC-7.1, AC-7.2, AC-4.1b, AC-13.2 |
| `electron/window.ts` | Window | BrowserWindow creation, show-when-ready, state persistence | electron-window-state | AC-7.1c, AC-7.3 |
| `electron/menu.ts` | Menu | Native menu template, state update handler | ipc | AC-8.1, AC-8.2 |
| `electron/ipc.ts` | IPC | Register all IPC handlers, route events | — | AC-10.1, AC-9.2 |
| `electron/file-handler.ts` | OS Integration | open-file event, second-instance routing | ipc | AC-9.1, AC-9.2 |
| `electron/preload.ts` | Bridge | contextBridge API (7 methods) | — | All Electron ACs |
| **New client modules** | | | | |
| `client/utils/electron-bridge.ts` | Bridge | Client-side IPC wrapper, quit flow, menu state sync | — | AC-8.3, AC-10.1, AC-8.2 |
| `client/components/mermaid-cache.ts` | Cache | LRU cache for Mermaid SVGs, keyed by sourceHash:themeId | — | AC-6.1, AC-6.2, AC-6.3 |
| `client/components/virtual-tree.ts` | Performance | Virtualized file tree rendering (replaces DOM tree in file-tree.ts) | — | AC-2.1, AC-2.2 |
| `client/components/chunked-render.ts` | Performance | Chunked DOM insertion for large rendered documents | — | AC-1.1 |
| **Modified existing modules** | | | | |
| `server/schemas/index.ts` | Schema | PersistedTab union schema for backward-compatible migration | — | AC-11.1 |
| `server/services/session.service.ts` | Service | `updateTabs()` accepts PersistedTab[], no tab healing for missing files | — | AC-11.1, AC-11.3 |
| `server/services/file.service.ts` | Service | Raise MAX_FILE_SIZE from 5MB to 20MB | — | AC-1.1, AC-13.1a |
| `server/services/tree.service.ts` | Service | Add AbortController timeout, depth guard (loop detection already exists) | — | AC-2.1, AC-5.1–5.4 |
| `server/routes/session.ts` | Route | Update PUT /api/session/tabs request schema for PersistedTab | — | AC-11.1 |
| `client/app.ts` | Bootstrap | Tab restore with PersistedTab, syncTabs with mode/scroll, Electron detection, quit flow wiring, menu state subscriber | api, electron-bridge, store | AC-11.1, AC-11.2, AC-11.3, AC-4.1c, AC-8.3, AC-10.1 |
| `client/components/content-area.ts` | Rendering | Use chunked-render for large documents instead of direct innerHTML | chunked-render | AC-1.1 |
| `client/components/file-tree.ts` | Tree | Replace DOM rendering with virtual-tree integration | virtual-tree | AC-2.1, AC-2.2 |
| `client/components/mermaid-renderer.ts` | Rendering | Check cache before mermaid.render(), populate cache after render | mermaid-cache | AC-6.1, AC-6.2, AC-6.3 |

### Dependency Map

**Electron main process:**

```
electron/main.ts
├── server/index.ts (startServer)
├── electron/window.ts
│   └── electron-window-state
├── electron/menu.ts
├── electron/ipc.ts
└── electron/file-handler.ts
```

**Client additions:**

```
client/app.ts (modified)
├── client/utils/electron-bridge.ts (new)
├── client/components/mermaid-cache.ts (new)
├── client/components/virtual-tree.ts (new)
└── client/components/chunked-render.ts (new)
```

---

## Work Breakdown Overview

| Chunk | Scope | ACs | Estimated Tests |
|-------|-------|-----|-----------------|
| 0 | Infrastructure: types, fixtures, schema migration, Electron project scaffolding | — | 0 |
| 1 | Server schema migration + tree hardening | AC-11.1, AC-11.2, AC-11.3, AC-2.1, AC-5.1–5.4, AC-13.1 | 20 |
| 2 | Client performance: chunked render, virtual tree, Mermaid cache | AC-1.1, AC-1.2, AC-2.1, AC-2.2, AC-6.1, AC-6.2, AC-6.3 | 21 |
| 3 | Tab restore + many-tab performance | AC-3.1, AC-3.2, AC-11.1, AC-11.2, AC-11.3, AC-4.1a/c | 14 |
| 4 | Electron shell + window management | AC-7.1, AC-7.2, AC-7.3, AC-4.1b, AC-13.2 | 8 |
| 5 | Native menu bar + quit flow + Electron detection | AC-8.1, AC-8.2, AC-8.3, AC-10.1 | 17 |
| 6 | File associations + packaging + install | AC-9.1, AC-9.2, AC-9.3, AC-12.1, AC-12.2, AC-12.3 | 5 |
| **Total** | | | **~85** |

Detailed chunk breakdown with TDD phases, skeleton requirements, and TC mappings is in the test plan companion document.

---

## Deferred Items

| Item | Related AC | Reason Deferred | Future Work |
|------|-----------|-----------------|-------------|
| Windows/Linux Electron packaging | — | PRD: macOS first | Post-v1 if demand exists |
| Developer ID signing + notarization | AC-12.2 | PRD: out of scope | Required for public distribution |
| Auto-update mechanism | — | PRD: out of scope | electron-updater integration if needed |
| Tab drag-to-reorder | — | Deferred since Epic 2 | Post-v1 enhancement |
| CLI export mode in Electron | — | Not in PRD | POC had this; defer unless requested |
| Rendered view virtualization (virtual DOM for rendered content) | AC-1.1 | Chunked insertion is sufficient for 10K lines | If 50K+ line docs become common |
| Lazy tree loading (fetch children on expand) | AC-2.1 | Virtual scrolling addresses the DOM bottleneck | If 10K+ file trees become common |

---

## Open Questions

| # | Question | Owner | Blocks | Resolution |
|---|----------|-------|--------|------------|
| Q1 | Should `electron-builder.yml` target universal binary (ARM64 + Intel) or separate builds? Universal doubles bundle size (~300MB vs ~150MB). | Product | Chunk 6 | Pending — recommend separate builds with ARM64 as primary |

---

## Related Documentation

- **Epic:** [epic.md](epic.md)
- **API design:** [tech-design-api.md](tech-design-api.md)
- **UI + Electron design:** [tech-design-ui.md](tech-design-ui.md)
- **Test plan:** [test-plan.md](test-plan.md)
- **PRD:** [../../01--preliminary/prd.md](../../01--preliminary/prd.md)
- **Previous tech designs:** Epics 1–5 companion docs in sibling directories
- **Electron POC:** [../../first-pass-poc/](../../../first-pass-poc/)
- **Research:** [../../.research/outputs/electron-desktop-wrapper-best-practices-2026.md](../../../.research/outputs/electron-desktop-wrapper-best-practices-2026.md), [../../.research/outputs/electron-package-versions-march-2026.md](../../../.research/outputs/electron-package-versions-march-2026.md)
