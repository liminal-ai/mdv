# Technical Design: Epic 1 — App Shell and Workspace Browsing

## Purpose

This document is the index and decision record for Epic 1's technical design. It establishes the system context, records architecture decisions, answers the epic's tech design questions, and maps modules to their companion design documents.

The detailed design is split across three companion documents:

| Document | Scope |
|----------|-------|
| [epic-1-tech-design-api.md](epic-1-tech-design-api.md) | Server: Fastify routes, services, Zod schemas, session persistence, tree scanning, folder picker |
| [epic-1-tech-design-ui.md](epic-1-tech-design-ui.md) | Client: DOM architecture, components, state, CSS/themes, keyboard shortcuts, sidebar, menus |
| [epic-1-test-plan.md](epic-1-test-plan.md) | TC→test mapping, mock strategy, test fixtures, verification scripts, test counts |

**Prerequisite:** Epic 1 spec (`epic-1-app-shell-and-workspace-browsing.md`) is complete with 43 ACs and ~99 TCs.

---

## Spec Validation

Before designing, the epic was validated as the downstream consumer. All ACs map to implementation work. Data contracts are complete and realistic. The following issues were identified and resolved during validation rounds:

| Issue | Spec Location | Resolution | Status |
|-------|---------------|------------|--------|
| Folder picker mechanism unspecified | A6, AC-4.2 | Constrained to server-side mechanism returning absolute paths | Resolved |
| API surface incomplete | Data Contracts | Added 11 endpoints covering all operations | Resolved |
| Recent files / Open File Epic 1 vs 2 ownership | AC-1.3, AC-8.3 | Added M1 co-delivery notes; Epic 1 owns structure, Epic 2 populates | Resolved |
| Keyboard navigation underspecified | AC-2.4 | Added keyboard nav TCs for menus, tree, context menus | Resolved |
| Markdown filter definition loose | AC-5.1 | Added: .md/.markdown, case-insensitive, no hidden, no .mdx, follow symlinks | Resolved |
| Symlink path contract ambiguous | AC-5.1h | Symlink path inside root, never resolved target | Resolved |

**Verdict:** Spec is implementation-ready. No blocking issues remain.

---

## Context

MD Viewer is a local markdown workspace for technical users who work with markdown as a primary medium — driving agent workflows, writing specs, documenting systems. Epic 1 delivers the app's foundation: a local Fastify server serving a browser UI with workspace browsing, file tree navigation, themes, and session persistence. No document rendering yet — that ships in Epic 2, and the two co-deliver as Milestone 1.

The architecture decision to use Fastify + vanilla TypeScript instead of Electron directly was driven by two factors. First, the primary user works in corporate environments where native app installation is friction — a local web app avoids code signing, admin access, and app store distribution entirely. Second, the same Fastify server can be wrapped in Electron later (Epic 6) with ~20 lines of glue code, so nothing is lost by starting browser-first.

The stack was researched and locked during planning:

| Layer | Choice | Version | Rationale |
|-------|--------|---------|-----------|
| Runtime | Node.js | 24 LTS | Active LTS through April 2028; stable ESM, recursive fs.watch, fs.glob |
| Server | Fastify | 5.8.2 | Latest stable; ESM-compatible; JSON Schema validation built in |
| Static serving | @fastify/static | 9.0.0 | Serves frontend assets |
| Validation | Zod + fastify-type-provider-zod | 4.3.6 / 6.1.0 | Runtime validation + TypeScript inference on route handlers |
| Language | TypeScript | 5.9.3 | Server + client; strict mode |
| Module system | ESM | `"type": "module"` | Fastify v5 is ESM-first; ecosystem direction |
| tsconfig | `module: "nodenext"` | — | Required for Zod 4 subpath exports and Fastify type provider |
| Client | Vanilla TypeScript + DOM | — | No framework; complexity doesn't warrant React |
| CSS | Vanilla CSS + custom properties | — | No preprocessor; theme switching via data attribute |
| Bundler | esbuild | 0.27.4 | Bundles client TS to single JS file |
| Testing | Vitest + Vite | 4.0.x / 7.x | Fast; ESM-native; Fastify inject() compatible |
| Package manager | npm | Ships with Node | Universal; agent-compatible |
| Session storage | ~/Library/Application Support/md-viewer/ | JSON files | macOS convention; matches future Electron path |

This stack was validated against current package versions (March 2026) via web research. Key findings: Fastify 5.8.2 is published as CJS but works seamlessly as an ESM consumer; `fastify-type-provider-zod` 6.1.0 requires `moduleResolution: "nodenext"` which we already planned; Zod 4.3.6 has native `z.toJSONSchema()` making `zod-to-json-schema` unnecessary; Electron 41.x bundles Node 24 with full ESM support.

The most consequential architectural constraint is the folder picker. Browsers cannot provide absolute filesystem paths — `webkitdirectory` and the File API return relative paths and file objects. Since the epic requires absolute paths for copy-path, workspace persistence, and all data contracts, folder selection must involve a server-side component. On macOS, `osascript` with `choose folder` opens the native Cocoa folder picker and returns an absolute POSIX path. This is the simplest mechanism that meets the constraint.

---

## Tech Design Question Answers

The epic raised 7 questions for the tech lead. All are answered here; detailed implementation follows in the companion documents.

### Q1: Session persistence format and location

**Answer:** JSON file at `~/Library/Application Support/md-viewer/session.json`.

The directory is created on first launch if it doesn't exist. The session file conforms to the `SessionState` interface from the epic's data contracts. Writes are atomic: write to a temp file in the same directory, then rename over the target. This prevents corruption if the process crashes mid-write.

macOS's `~/Library/Application Support/` is the standard app data location. When Electron wraps the app in Epic 6, `app.getPath('userData')` returns this exact path, so there's zero migration. Cross-platform support (if needed later) would add a platform switch using `os.platform()` — Linux would use `~/.config/md-viewer/`, Windows would use `%APPDATA%/md-viewer/`.

**Detailed design:** See API companion doc, Session Service section.

### Q2: Folder picker mechanism

**Answer:** Server-side `osascript` invocation on macOS via the `/api/browse` endpoint.

When the client calls `POST /api/browse`, the server spawns:

```
osascript -e 'POSIX path of (choose folder with prompt "Select Root Folder")'
```

This opens the native macOS folder picker dialog. The user selects a directory (or cancels). The server returns `{ path: "/absolute/path" }` or `null` if cancelled. The dialog is modal to the system, not to the browser — the user sees a native macOS folder picker.

Fallback for non-macOS: The `/api/browse` endpoint can be extended with a `zenity --file-selection --directory` fallback on Linux, or a custom server-rendered directory browser. This is out of scope for Epic 1 (macOS-first per A2) but the endpoint abstraction accommodates it.

**Detailed design:** See API companion doc, Browse Service section.

### Q3: Large directory handling

**Answer:** Full tree scan upfront, single API call.

The `GET /api/tree?root={path}` endpoint walks the directory recursively, filters to markdown files and their ancestor directories, computes `mdCount` per directory, sorts (directories first, alphabetical, case-insensitive), and returns the complete tree. For directories with up to 500 markdown files, this completes within 2 seconds (the NFR target). For very large trees (2000+ files), the scan may take longer but the response is still a single payload.

Lazy loading (fetch children on expand) was considered and deferred. The upfront approach is simpler, requires no client-side loading states per directory, and avoids the complexity of partial tree state. If performance becomes an issue at scale, lazy loading can be added behind the same API contract — the client already handles `children` arrays on `TreeNode`, so the change would be adding an endpoint to fetch children for a specific path, not restructuring the data model.

**Detailed design:** See API companion doc, Tree Service section.

### Q4: Startup command

**Answer:** `npm start` in the repo for production. `npm run dev` for development with auto-restart.

The `start` script runs `node dist/server/index.js`. The server picks an available port (default 3000, fallback to next available if occupied), prints the URL, and opens the default browser via `open` on macOS. The `dev` script uses a file watcher (Node's `--watch` flag) to restart the server on source changes, and esbuild in watch mode for client rebuilds.

Global install (`npx md-viewer`) is a future refinement — Epic 1 runs from the repo.

**Detailed design:** See API companion doc, Server Bootstrap section.

### Q5: Clipboard operations

**Answer:** Client-side `navigator.clipboard.writeText()` as primary, server-side `POST /api/clipboard` as fallback.

Modern browsers support the Clipboard API on secure contexts. `localhost` is treated as a secure context, so `navigator.clipboard.writeText()` works in Chrome, Safari, and Firefox when served from `http://localhost`. The client tries this first. If it fails (permission denied, unsupported context), the client falls back to `POST /api/clipboard` which uses `pbcopy` on macOS via `child_process.exec()`.

The fallback exists because some browser configurations or future Electron preload sandboxing might restrict clipboard access. The cost is one additional endpoint that may never be called.

**Detailed design:** See API companion doc, Clipboard endpoint section.

### Q6: CSS architecture for themes

**Answer:** CSS custom properties on `:root`, switched by a `data-theme` attribute on `<html>`. All theme definitions in a single file.

A single `themes.css` file defines CSS custom properties for each theme, scoped by attribute selector:

```css
:root, [data-theme="light-default"] {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8f8f8;
  --color-text-primary: #1a1a1a;
  /* ... ~30-40 variables covering all surfaces */
}

[data-theme="dark-default"] {
  --color-bg-primary: #1e1e1e;
  --color-bg-secondary: #252526;
  --color-text-primary: #cccccc;
  /* ... same variable names, different values */
}
```

All component CSS uses `var(--color-bg-primary)` etc. Theme switching sets `document.documentElement.dataset.theme = themeId` — instant, no file loading, no flash.

Adding a fifth theme means adding another `[data-theme="new-theme"]` block to `themes.css`. No component code changes. This satisfies AC-7.4 (extensibility).

Theme is applied before first paint by reading the stored theme from the session and setting the `data-theme` attribute in a blocking `<script>` in `<head>`. This prevents the flash-of-default-theme described in TC-1.2d and TC-7.2b.

**Detailed design:** See UI companion doc, Theme System section.

### Q7: Tree scan — full vs lazy

**Answer:** Full scan. See Q3 above.

---

## High Altitude: System View

### System Context

MD Viewer Epic 1 is a two-process system: a Node.js server and a browser client. The server owns all filesystem access. The browser owns all rendering and user interaction. They communicate over localhost HTTP.

```
┌─────────────────────────────────────────────────────────┐
│                     User's Machine                       │
│                                                          │
│  ┌──────────────┐    HTTP (localhost)   ┌─────────────┐ │
│  │  Browser Tab  │ ◄──────────────────► │  Fastify     │ │
│  │  (Frontend)   │    fetch() / JSON    │  Server      │ │
│  │               │                      │              │ │
│  │  - Menu bar   │    Static assets     │  - Routes    │ │
│  │  - Sidebar    │ ◄────────────────── │  - Services  │ │
│  │  - Tabs       │    HTML/CSS/JS       │  - Schemas   │ │
│  │  - Content    │                      │              │ │
│  └──────────────┘                      └──────┬───────┘ │
│                                                │         │
│                                         ┌──────▼───────┐ │
│                                         │  Filesystem   │ │
│                                         │  - Workspaces │ │
│                                         │  - .md files  │ │
│                                         │  - Session    │ │
│                                         └──────────────┘ │
│                                                          │
│  ┌──────────────┐                      ┌──────────────┐ │
│  │  osascript    │ ◄────── spawn ───── │  Server      │ │
│  │  (Folder      │                      │  (browse     │ │
│  │   Picker)     │ ──── path/null ───► │   endpoint)  │ │
│  └──────────────┘                      └──────────────┘ │
│                                                          │
│  ┌──────────────┐                      ┌──────────────┐ │
│  │  pbcopy       │ ◄────── pipe ────── │  Server      │ │
│  │  (Clipboard)  │                      │  (clipboard  │ │
│  │               │                      │   endpoint)  │ │
│  └──────────────┘                      └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

The server has three external boundaries:

1. **Filesystem** — reads directory trees, reads/writes session state. Mock boundary for tests.
2. **osascript** — spawns native macOS folder picker. Mock boundary for tests.
3. **pbcopy** — pipes text to system clipboard. Mock boundary for tests (fallback path only).

The browser has one external boundary:

1. **Server API** — all data comes from `fetch()` calls to localhost. Mock boundary for client tests.

### Data Flow Overview

Every user action that touches the filesystem follows the same pattern:

```
User Action → Client State Update → API Call → Server Service → Filesystem → Response → Client State → DOM Update
```

Session mutations (add workspace, change root, switch theme) follow a specific pattern: the server endpoint mutates the session, persists it atomically, and returns the full updated `SessionState`. The client replaces its entire session state with the response. This avoids client/server drift — the server is always the source of truth for persisted state.

### External Contracts

The epic defines 11 API endpoints. These are the contracts the server must honor:

| Method | Path | Request | Response | Epic ACs |
|--------|------|---------|----------|----------|
| GET | /api/session | — | `AppBootstrapResponse` (session + availableThemes) | AC-1.2, AC-7.1, AC-8.1–8.5 |
| PUT | /api/session/root | `{ root }` | `SessionState` | AC-3.3, AC-4.2, AC-6.2b |
| POST | /api/session/workspaces | `{ path }` | `SessionState` | AC-4.3, AC-6.2c |
| DELETE | /api/session/workspaces | `{ path }` | `SessionState` | AC-3.4 |
| PUT | /api/session/theme | `{ theme }` | `SessionState` | AC-7.2, AC-7.3 |
| PUT | /api/session/sidebar | `{ workspacesCollapsed }` | `SessionState` | AC-3.1c, AC-8.5 |
| POST | /api/session/recent-files | `{ path }` | `SessionState` | AC-8.3 (Epic 2 calls) |
| DELETE | /api/session/recent-files | `{ path }` | `SessionState` | AC-8.3 |
| GET | /api/tree | `?root={path}` | `FileTreeResponse` | AC-5.1–5.7 |
| POST | /api/browse | — | `{ path } \| null` | AC-4.2, AC-9.1 |
| POST | /api/clipboard | `{ text }` | `{ ok: true }` | AC-4.4, AC-6.1b |

Note: `GET /api/session` returns `AppBootstrapResponse`, not raw `SessionState`. This separates the bootstrap payload (session + available themes) from mutation responses (session only). The client stores `availableThemes` once from bootstrap and does not overwrite it from mutation responses.

Error responses use machine-readable codes:

| Status | Code | When |
|--------|------|------|
| 400 | INVALID_PATH | Path not absolute or invalid characters |
| 403 | PERMISSION_DENIED | Filesystem permission denied |
| 404 | PATH_NOT_FOUND | Directory doesn't exist |
| 500 | SCAN_ERROR | Unexpected scan failure |

**Runtime Prerequisites:**

| Prerequisite | Where Needed | How to Verify |
|---|---|---|
| Node.js 24+ | Server | `node --version` |
| npm 11+ | Build | `npm --version` |
| macOS (for folder picker, clipboard fallback) | Server | `os.platform() === 'darwin'` |
| Modern browser (Chrome/Safari/Firefox) | Client | Feature detection for `navigator.clipboard` |

---

## Medium Altitude: Module Architecture

The codebase divides into server and client, with shared types:

```
app/
├── package.json
├── tsconfig.json                    # Server TS config
├── tsconfig.client.json             # Client TS config (esbuild handles bundling)
├── esbuild.config.ts                # Client bundle config
│
├── src/
│   ├── shared/
│   │   └── types.ts                 # SessionState, TreeNode, ThemeId, API types
│   │
│   ├── server/
│   │   ├── index.ts                 # Entry point: build server, listen, open browser
│   │   ├── app.ts                   # Fastify app factory (buildApp)
│   │   ├── plugins/
│   │   │   └── static.ts            # @fastify/static registration
│   │   ├── routes/
│   │   │   ├── session.ts           # GET/PUT/POST/DELETE /api/session/*
│   │   │   ├── tree.ts              # GET /api/tree
│   │   │   ├── browse.ts            # POST /api/browse
│   │   │   └── clipboard.ts         # POST /api/clipboard
│   │   ├── services/
│   │   │   ├── session.service.ts   # Read/write/mutate session JSON
│   │   │   ├── tree.service.ts      # Recursive directory scan + filter
│   │   │   ├── browse.service.ts    # osascript folder picker invocation
│   │   │   └── theme-registry.ts    # Static theme metadata (co-located source of truth)
│   │   └── schemas/
│   │       └── index.ts             # Zod schemas for all endpoints
│   │
│   └── client/
│       ├── index.html               # Static HTML shell
│       ├── app.ts                   # Entry point: bootstrap, initial API calls
│       ├── api.ts                   # API client (typed fetch wrapper)
│       ├── state.ts                 # Client state: session, tree, UI state
│       ├── router.ts                # Maps state changes to DOM updates
│       ├── components/
│       │   ├── menu-bar.ts          # Menu bar: dropdowns, quick-action icons
│       │   ├── sidebar.ts           # Sidebar container: orchestrates sections
│       │   ├── workspaces.ts        # Workspaces section: list, collapse, click, remove
│       │   ├── root-line.ts         # Root line: path, browse, pin, copy, refresh
│       │   ├── file-tree.ts         # File tree: recursive render, expand/collapse
│       │   ├── tab-strip.ts         # Tab strip: empty state only (Epic 2 adds behavior)
│       │   ├── content-area.ts      # Content area: empty state, launch prompts
│       │   ├── context-menu.ts      # Right-click context menus
│       │   └── error-notification.ts # Error banner/toast for visible feedback
│       ├── utils/
│       │   ├── keyboard.ts          # Global keyboard shortcut registry
│       │   ├── clipboard.ts         # Clipboard write with fallback
│       │   └── dom.ts               # DOM helper utilities
│       └── styles/
│           ├── themes.css           # All 4 theme definitions (CSS custom properties)
│           ├── base.css             # Reset, typography, layout primitives
│           ├── menu-bar.css         # Menu bar styles
│           ├── sidebar.css          # Sidebar, workspaces, root line, file tree
│           ├── tab-strip.css        # Tab strip styles
│           ├── content-area.css     # Content area styles
│           └── context-menu.css     # Context menu styles
│
├── tests/
│   ├── fixtures/
│   │   ├── session.ts               # Mock SessionState objects
│   │   ├── tree.ts                  # Mock TreeNode structures
│   │   └── fs.ts                    # Mock filesystem structures for tree tests
│   ├── utils/
│   │   ├── server.ts                # Fastify test app builder with inject()
│   │   └── dom.ts                   # JSDOM test helpers
│   ├── server/
│   │   ├── routes/
│   │   │   ├── session.test.ts      # Session endpoint tests
│   │   │   ├── tree.test.ts         # Tree endpoint tests
│   │   │   ├── browse.test.ts       # Browse endpoint tests
│   │   │   └── clipboard.test.ts    # Clipboard endpoint tests
│   │   └── services/
│   │       ├── session.test.ts      # Session service tests (fs mocked)
│   │       └── tree.test.ts         # Tree service tests (fs mocked)
│   └── client/
│       ├── components/
│       │   ├── menu-bar.test.ts     # Menu bar behavior
│       │   ├── workspaces.test.ts   # Workspace section behavior
│       │   ├── root-line.test.ts    # Root line behavior
│       │   ├── file-tree.test.ts    # File tree behavior
│       │   ├── context-menu.test.ts # Context menu behavior
│       │   └── content-area.test.ts # Empty state behavior
│       ├── state.test.ts            # Client state management
│       └── utils/
│           └── keyboard.test.ts     # Keyboard shortcut handling
│
└── dist/                            # Build output (gitignored)
    ├── server/                      # Compiled server JS
    └── client/                      # Bundled client JS + static assets
```

### Module Responsibility Matrix

| Module | Layer | Responsibility | Dependencies | ACs Covered |
|--------|-------|----------------|--------------|-------------|
| `server/index.ts` | Server | Entry point: build, listen, open browser | app.ts | AC-1.1 |
| `server/app.ts` | Server | Fastify factory: register plugins, routes, compilers | routes/*, plugins/*, schemas | AC-1.1 |
| `server/routes/session.ts` | Server | Session CRUD endpoints | session.service | AC-1.2, AC-3.3, AC-3.4, AC-4.3, AC-7.2, AC-8.1–8.5 |
| `server/routes/tree.ts` | Server | File tree scan endpoint | tree.service | AC-5.1–5.7, AC-9.2 |
| `server/routes/browse.ts` | Server | Folder picker endpoint | browse.service | AC-4.2, AC-9.1 |
| `server/routes/clipboard.ts` | Server | Clipboard fallback endpoint | child_process | AC-4.4, AC-6.1b |
| `server/services/session.service.ts` | Server | Session persistence: read, write, mutate | fs (mock boundary) | AC-1.2, AC-8.1–8.5, AC-10.3 |
| `server/services/tree.service.ts` | Server | Directory walk, markdown filter, sort, mdCount | fs (mock boundary) | AC-5.1, AC-5.4, AC-5.5, AC-10.1–10.3 |
| `server/services/browse.service.ts` | Server | osascript invocation for folder picker | child_process (mock boundary) | AC-4.2, AC-9.1 |
| `server/schemas/index.ts` | Server | Zod schemas for request/response validation | zod | (supports all routes) |
| `shared/types.ts` | Shared | TypeScript interfaces and type aliases | — | (supports all modules) |
| `client/app.ts` | Client | Bootstrap: fetch session, render shell | api, state, router | AC-1.1, AC-1.2 |
| `client/api.ts` | Client | Typed fetch wrapper for all endpoints | shared/types | (supports all client modules) |
| `client/state.ts` | Client | Client state: session, tree, UI state | — | (supports all client modules) |
| `client/router.ts` | Client | State→DOM: observes state changes, calls component renders | components/* | (supports all client modules) |
| `client/components/menu-bar.ts` | Client | Menu bar: dropdowns, icons, shortcuts display | state, api | AC-2.1–2.5 |
| `client/components/sidebar.ts` | Client | Sidebar container: layout, collapse toggle | workspaces, root-line, file-tree | AC-2.5 |
| `client/components/workspaces.ts` | Client | Workspaces section: list, collapse, switch, remove | state, api | AC-3.1–3.4 |
| `client/components/root-line.ts` | Client | Root line: display, browse, pin, copy, refresh | state, api, clipboard | AC-4.1–4.6 |
| `client/components/file-tree.ts` | Client | File tree: recursive render, expand/collapse, expand all | state | AC-5.1–5.7 |
| `client/components/tab-strip.ts` | Client | Tab strip: empty state placeholder | state | AC-1.4 |
| `client/components/content-area.ts` | Client | Content area: empty state, recent files, action buttons | state, api | AC-1.3 |
| `client/components/context-menu.ts` | Client | Context menus: show, actions, close | state, api, clipboard | AC-6.1–6.3 |
| `client/components/error-notification.ts` | Client | Error banner: display, dismiss | state | AC-10.1, AC-10.2 |
| `client/utils/keyboard.ts` | Client | Global shortcut registry and dispatch | — | AC-2.3, AC-2.4 |
| `client/utils/clipboard.ts` | Client | Clipboard write with API fallback | api | AC-4.4, AC-6.1b |

---

## Dependency Map

### Server Dependencies

```
server/index.ts
    └── server/app.ts
        ├── @fastify/static (plugin)
        ├── fastify-type-provider-zod (validation/serialization)
        ├── server/schemas/index.ts (Zod schemas)
        ├── server/services/theme-registry.ts (static theme data)
        ├── server/routes/session.ts
        │   ├── server/services/session.service.ts
        │   │   └── node:fs/promises (MOCK BOUNDARY)
        │   └── server/services/theme-registry.ts
        ├── server/routes/tree.ts
        │   └── server/services/tree.service.ts
        │       └── node:fs/promises + node:fs (MOCK BOUNDARY)
        ├── server/routes/browse.ts
        │   └── server/services/browse.service.ts
        │       └── node:child_process (MOCK BOUNDARY)
        └── server/routes/clipboard.ts
            └── node:child_process (MOCK BOUNDARY)
```

### Client Dependencies

```
client/app.ts
    ├── client/api.ts (MOCK BOUNDARY for tests)
    ├── client/state.ts
    ├── client/router.ts
    │   ├── client/components/menu-bar.ts
    │   ├── client/components/sidebar.ts
    │   │   ├── client/components/workspaces.ts
    │   │   ├── client/components/root-line.ts
    │   │   └── client/components/file-tree.ts
    │   ├── client/components/tab-strip.ts
    │   ├── client/components/content-area.ts
    │   └── client/components/context-menu.ts
    └── client/utils/keyboard.ts
```

---

## Work Breakdown Overview

The epic breaks into 7 chunks (Story 0 + 6 feature chunks). Each chunk goes through Skeleton → TDD Red → TDD Green phases. Detailed chunk specs, TC mappings, and test counts are in the [Test Plan](epic-1-test-plan.md).

| Chunk | Name | ACs | Estimated Tests | Dependencies |
|-------|------|-----|-----------------|--------------|
| 0 | Infrastructure | — | 0 (types, fixtures, config) | None |
| 1 | Server Foundation + Session API | AC-1.1, AC-1.2, AC-8.1–8.5 | 32 | Chunk 0 |
| 2 | App Shell Chrome + Error UI | AC-1.3, AC-1.4, AC-2.1–2.5, AC-10.1–10.2 | 30 | Chunk 1 |
| 3 | Sidebar — Workspaces + Root Line | AC-3.1–3.4, AC-4.1–4.6, AC-9.1 | 22 | Chunk 2 |
| 4 | File Tree + Folder Selection | AC-5.1–5.7, AC-9.2, AC-10.3 | 31 | Chunk 3 |
| 5 | Context Menus | AC-6.1–6.3 | 9 | Chunk 4 |
| 6 | Theme System | AC-7.1–7.4 | 5 | Chunk 2 |

```
Chunk 0 ──► Chunk 1 ──► Chunk 2 ──► Chunk 3 ──► Chunk 4 ──► Chunk 5
                                 └──► Chunk 6
```

Chunks 5 (context menus) and 6 (themes) can run in parallel after their dependencies are met.

**Total estimated test count:** 132 test functions across all files (107 TC-mapped + 25 non-TC). Some TCs have both server and client tests, so chunks add to 129 (avoiding cross-layer double-counting).

---

## Deferred Items

| Item | Related AC | Reason Deferred | Future Work |
|------|-----------|-----------------|-------------|
| Lazy tree loading | AC-5.1 | Full scan meets NFR for ≤500 files; lazy adds complexity | Revisit if performance issues at >2000 files |
| Cross-platform folder picker | AC-4.2 | macOS-first per A2 | Linux: zenity; Windows: PowerShell dialog |
| Cross-platform session path | Q1 | macOS-first per A2 | Use `env-paths` or platform switch |
| Global install (`npx md-viewer`) | Q4 | Runs from repo for Epic 1 | Package and publish to npm |
| Recent files population | AC-1.3, AC-8.3 | Epic 2 owns file opening | Structure ready; Epic 2 populates |

---

## Open Questions

| # | Question | Owner | Blocks | Resolution |
|---|----------|-------|--------|------------|
| Q1 | Do we need a loading indicator for tree scan, or is <2s fast enough to skip it? | Product | Chunk 4 | Recommend: show spinner only if scan exceeds 500ms (debounced) |

---

## Related Documentation

- Epic: `epic-1-app-shell-and-workspace-browsing.md`
- PRD: `../01--preliminary/prd.md`
- API Design: `epic-1-tech-design-api.md`
- UI Design: `epic-1-tech-design-ui.md`
- Test Plan: `epic-1-test-plan.md`
- Stack Research: `../../.research/outputs/`
