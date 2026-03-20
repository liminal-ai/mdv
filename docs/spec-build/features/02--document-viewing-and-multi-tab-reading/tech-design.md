# Technical Design: Epic 2 — Document Viewing and Multi-Tab Reading

## Purpose

This document is the index and decision record for Epic 2's technical design. It establishes the rendering architecture, records all dependency and design decisions (grounded in March 2026 web research), answers the epic's 12 tech design questions, and maps modules to their companion design documents.

The detailed design is split across three companion documents:

| Document | Scope |
|----------|-------|
| [tech-design-api.md](tech-design-api.md) | Server: file read endpoint, rendering pipeline (markdown-it), image proxy, file picker, WebSocket file watching, external file opening, session extensions |
| [tech-design-ui.md](tech-design-ui.md) | Client: tab management, document display, content toolbar, link click handling, WebSocket client, file path display, keyboard shortcuts |
| [test-plan.md](test-plan.md) | TC→test mapping, mock strategy, test fixtures, verification scripts, chunk breakdown with test counts |

**Prerequisite:** Epic 1 complete (server, shell, sidebar, workspaces, file tree, themes, session persistence). Epic 2 spec (`epic.md`) is complete with 38 ACs and ~101 TCs.

---

## Spec Validation

Before designing, the epic was validated as the downstream consumer. All ACs map to implementation work. The following issues were identified and resolved:

| Issue | Spec Location | Resolution | Status |
|-------|---------------|------------|--------|
| Key Constraint says "viewing renders client-side" | User Profile, A7 | Server-side rendering is simpler (one rendering path for viewing + future export). Local server makes latency negligible. Spec deviation accepted. | Resolved — deviated |
| FileReadResponse lacks rendered HTML fields | Data Contracts | Added `html` and `warnings` fields to response since server renders. Raw `content` retained for forward-compatibility (Epic 5 editing). | Resolved — deviated |
| A5 says "tab state does not persist across restarts" | Assumptions | Browser refresh loses all tabs in a web app — unacceptable for daily use. Persist `openTabs` and `activeTab` to session. A5 amended. | Resolved — deviated |
| File watch transport unspecified (SSE suggested) | API Surface, Q3 | WebSocket via @fastify/websocket. Forward-compatible with Epic 5 editing and potential future chat interface. SSE plugin is CJS-only — disqualified. | Resolved — deviated |
| Large file handling unspecified | Q8 | Under 1MB: no warning. 1–5MB: warning with confirmation. Over 5MB: hard cap with error. Pure text size only — images served separately. | Resolved — new |
| External file opening security scope unspecified | Q9 | Any local file — no root restriction. User owns the machine. `open` command doesn't execute files. | Resolved — new |
| Image serving mechanism unspecified | Q2 | Proxy endpoint `GET /api/image?path=...`. Works for any local path, not restricted to root. | Resolved — new |
| Rendering library unconfirmed | A2 | markdown-it 14.1.1 confirmed via web research. ESM, isomorphic, safe by default, best plugin ecosystem. | Resolved — confirmed |

**Verdict:** Spec is implementation-ready with the deviations documented above. No blocking issues remain.

---

## Context

Epic 1 delivered the foundation: a Fastify server serving a browser UI with workspace browsing, file tree navigation, themes, and session persistence. The content area is empty — a shell waiting for content. Epic 2 fills it. After this epic ships, the user can click a markdown file in the tree and see it rendered, open multiple documents in tabs, follow links between related files, and watch files auto-reload when changed externally. Combined with Epic 1, this completes Milestone 1: a markdown viewer worth using daily.

The central architectural decision for this epic is where markdown rendering happens. The epic's Key Constraint states "rendering happens client-side for the viewing path" with a note about server-side portability for future export. After evaluating both approaches, we deviate: rendering happens server-side only. The reasoning is straightforward — Epic 4 (export) requires server-side rendering regardless (you can't generate PDFs from a browser tab reliably), so the rendering pipeline must exist on the server no matter what. Running it in two environments (browser for viewing, server for export) doubles the maintenance surface for zero practical benefit. On a localhost connection, the latency difference between sending raw markdown vs. rendered HTML is negligible. One rendering path, one place to configure markdown-it, one place to debug.

This decision cascades into a cleaner image handling story. Since the server renders markdown, it resolves image paths during rendering, rewrites `src` attributes to point at a proxy endpoint (`/api/image?path=...`), and detects missing/remote/unsupported images — all before the HTML reaches the browser. The client displays what the server sends without post-processing.

For file watching, the server uses Node 24's native `fs.watch()` (kqueue-based on macOS, confirmed stable for individual file watching) and pushes change notifications over a WebSocket connection. WebSocket was chosen over SSE because: (1) the watch subscription protocol is inherently bidirectional (client sends watch/unwatch, server sends change events), (2) Epic 5 editing will need bidirectional communication, (3) a potential future chat interface (wrapping Claude Code or Codex CLI) would also require WebSocket. Building SSE now to replace it later is waste.

### Stack Additions for Epic 2

All packages were verified via web research (March 2026). Research outputs archived in `.research/outputs/`.

| Package | Version | Purpose | Research Confirmed |
|---------|---------|---------|-------------------|
| markdown-it | 14.1.1 | Markdown → HTML rendering | Yes — native dual ESM/CJS, isomorphic |
| @types/markdown-it | (latest) | TypeScript types for markdown-it | Yes — types not bundled in markdown-it |
| markdown-it-anchor | 9.2.0 | Heading anchor ID generation | Yes — ESM, bundled types |
| github-slugger | 2.0.0 | GFM-compatible heading slug algorithm | Yes — pure ESM, bundled types |
| markdown-it-task-lists | 2.1.1 | Task list checkbox rendering | Yes — CJS but interops via bundler |
| isomorphic-dompurify | 3.5.1 | HTML sanitization (runs in Node) | Yes — ESM, same API as browser DOMPurify |
| @fastify/websocket | 11.2.0 | WebSocket route support for Fastify 5 | Yes — Fastify 5.x compatible, works in ESM |
| @types/ws | (latest) | TypeScript types for ws | Yes — required by @fastify/websocket |

**Packages NOT added (considered and rejected):**

| Package | Why Rejected |
|---------|-------------|
| chokidar | Node 24 native `fs.watch()` is sufficient for individual file watching. Chokidar v5 dropped fsevents and just wraps Node fs anyway. |
| @fastify/sse | CJS-only — incompatible with our ESM project |
| DOMPurify (browser) | Rendering is server-side; isomorphic-dompurify covers Node |
| marked / micromark / remark | markdown-it has the best combination of plugin ecosystem, safe defaults, and ESM support |
| sanitize-html | CJS-only, inferior to DOMPurify for this use case |

---

## Tech Design Question Answers

The epic raised 12 questions for the tech lead. All are answered here; detailed implementation follows in the companion documents.

### Q1: Rendering core portability

**Answer:** Server-side only. No isomorphic module needed.

markdown-it 14.1.1 runs on the server. The rendering pipeline lives in `server/services/render.service.ts`. It produces sanitized HTML with rewritten image URLs and a warnings array. The client receives finished HTML and displays it.

Epic 4 (export) uses the exact same rendering pipeline — it already runs server-side. No portability concern exists because there's only one environment.

**Detailed design:** See API companion doc, Render Service section.

### Q2: Image serving strategy

**Answer:** Proxy endpoint `GET /api/image?path={absolute_path}`.

During rendering, the server resolves relative image paths against the document's directory, validates the file exists, and rewrites the `src` to `/api/image?path={encoded_absolute_path}`. The browser fetches images on demand through this proxy. Missing images, remote images, and unsupported formats are replaced with placeholder HTML during rendering (never reach the proxy).

The proxy validates that the path is absolute, the file exists, and serves it with the correct Content-Type based on extension. No root restriction — images can be anywhere on the local filesystem (the user owns the machine, and AC-1.4 allows documents outside the root).

**Detailed design:** See API companion doc, Image Service section.

### Q3: File watch transport

**Answer:** WebSocket via `@fastify/websocket` v11.2.0.

One WebSocket connection opened on app bootstrap. Multiplexed JSON messages with a `type` discriminator:

```typescript
// Client → Server
type ClientMessage =
  | { type: 'watch'; path: string }
  | { type: 'unwatch'; path: string };

// Server → Client
type ServerMessage =
  | { type: 'file-change'; path: string; event: 'modified' | 'deleted' | 'created' }
  | { type: 'error'; message: string };
```

Client sends `watch` when a tab opens, `unwatch` when a tab closes. Server manages `fs.watch()` instances per path and pushes change events. Forward-compatible with Epic 5 editing and potential future chat integration.

**Detailed design:** See API companion doc, Watch Service section.

### Q4: Tab state storage

**Answer:** Persist `openTabs` (ordered path list) and `activeTab` (path or null) to server session. No scroll position persistence.

SessionState is extended with:

```typescript
interface SessionState {
  // ... all Epic 1 fields ...
  defaultOpenMode: "render" | "edit";
  openTabs: string[];           // ordered list of absolute paths
  activeTab: string | null;     // path of the active tab
}
```

On app bootstrap, the client reads `openTabs` from the session, re-opens each file (fetching fresh rendered HTML), and activates `activeTab`. Scroll positions reset to top — acceptable because many reload scenarios already reset scroll, and persisting scroll positions adds complexity with diminishing returns.

Tab mutations (open, close, reorder) update the session via existing session mutation pattern: client calls endpoint, server persists atomically, returns updated SessionState.

**Detailed design:** See API companion doc, Session Extensions section.

### Q5: markdown-it plugins

**Answer:** Three plugins, minimal set:

| Plugin | Purpose | Version | Notes |
|--------|---------|---------|-------|
| markdown-it-anchor | Heading anchor IDs for in-document navigation (AC-2.7b) | 9.2.0 | ESM, bundled types |
| github-slugger | GFM-compatible slug algorithm for heading IDs | 2.0.0 | Used by markdown-it-anchor's `slugify` option |
| markdown-it-task-lists | Task list checkboxes (AC-2.8) | 2.1.1 | CJS, interops fine. ~50 lines if we need to vendor later |

markdown-it is configured with `html: true` to support raw inline HTML (AC-2.9). Output is sanitized by isomorphic-dompurify (default allowlist preserves `<details>`, `<summary>`, `<kbd>`, `<sup>`, `<sub>`, `<br>` — no custom config needed. `<script>`, `<iframe>`, `<style>`, and event handlers are stripped).

No footnote plugin — not required by any AC. Can be added later without structural changes.

**Detailed design:** See API companion doc, Render Service section.

### Q6: File picker for Open File

**Answer:** Same osascript pattern as Epic 1's folder picker, with a file type filter.

```bash
osascript -e 'POSIX path of (choose file of type {"md", "markdown"} with prompt "Open Markdown File")'
```

Confirmed via research: bare extensions (no leading period) work in macOS `choose file`. Same cancel behavior (exit code 1), same `POSIX path of` wrapper, same `POST /api/file/pick` endpoint pattern.

**Detailed design:** See API companion doc, File Picker section.

### Q7: Relative link resolution

**Answer:** Client-side resolution, server-side validation on open.

The client knows the active document's absolute path from `FileReadResponse.path`. When the user clicks a relative markdown link, the client resolves the href against `dirname(activePath)` to produce an absolute path, then calls the file open flow (same as tree click). The server validates the path exists when it reads the file.

No server-side link pre-resolution needed. No extra response payload. The client already has all the information it needs.

**Detailed design:** See UI companion doc, Link Handler section.

### Q8: Large file handling

**Answer:** Three tiers based on raw markdown text size (images are served separately):

| Size | Behavior |
|------|----------|
| Under 1MB | No warning, render normally |
| 1MB–5MB | Warning with confirmation: "This file is X MB. Load anyway?" |
| Over 5MB | Hard cap: "The viewer doesn't currently support files larger than 5MB" |

The size check happens server-side. For the 1–5MB range, the server returns size metadata and the client shows a confirmation before requesting the full rendered content. For files over 5MB, the server returns a 413 error without reading the file content.

For context: 1MB of markdown is roughly 200,000 lines. A chunky spec might be 500KB. The 5MB hard cap protects against accidental `.md`-named database dumps.

**Detailed design:** See API companion doc, File Service section.

### Q9: External file opening

**Answer:** Server endpoint `POST /api/open-external` that runs `open <path>` on macOS. Any local file — no root restriction.

The endpoint validates the path is absolute and the file exists, then spawns `open <path>`. The `open` command launches the system's default handler for the file type (Preview for images, default editor for text, etc.). It does not execute files.

No security restriction to root — the user owns the machine and the app already allows opening documents outside the root (AC-1.4). The links come from markdown the user chose to open.

**Detailed design:** See API companion doc, External Opening section.

### Q10: Theme compatibility with rendered markdown

**Answer:** Semantic HTML + CSS custom properties. No theme-aware class names.

The server produces clean semantic HTML (standard `<h1>`, `<p>`, `<table>`, `<code>`, `<blockquote>` elements). The client wraps rendered content in a `<div class="markdown-body">` container. A new `markdown-body.css` file styles all rendered elements using `var(--color-*)` variables from `themes.css`.

Theme switching works automatically — when `data-theme` changes, CSS custom properties update, and all markdown body styles reflect the new theme instantly. Adding a fifth theme requires zero changes to the rendering pipeline or markdown body CSS.

**Detailed design:** See UI companion doc, Markdown Body Styles section.

### Q11: Heading anchor ID convention

**Answer:** github-slugger 2.0.0, which is the reference GFM implementation.

Algorithm: lowercase → strip special characters (comprehensive Unicode regex) → replace spaces with hyphens → deduplicate with `-1`, `-2` suffixes. Integrated via markdown-it-anchor's `slugify` option:

```typescript
import GithubSlugger from 'github-slugger';
const slugger = new GithubSlugger();

md.use(markdownItAnchor, {
  slugify: (s) => slugger.slug(s),
});
```

The slugger is reset per document render to ensure ID uniqueness is scoped per document, not across documents.

**Detailed design:** See API companion doc, Render Service section.

### Q12: Raw HTML sanitization

**Answer:** isomorphic-dompurify 3.5.1 running server-side after markdown-it renders.

markdown-it is configured with `html: true` to support AC-2.9 (raw inline HTML). The rendered output is passed through DOMPurify before being sent to the client. DOMPurify's default configuration:

- **Preserves:** `<details>`, `<summary>`, `<br>`, `<kbd>`, `<sup>`, `<sub>`, `<mark>`, `<abbr>`, `<ins>`, `<del>`, `<table>` and related, `<img>`, all standard block/inline elements
- **Strips:** `<script>`, `<iframe>`, `<style>`, `<object>`, `<embed>`, `<form>`, all event handlers (`onclick`, `onerror`, etc.), `javascript:` URLs

No custom allowlist config needed — the defaults match our requirements exactly.

**Detailed design:** See API companion doc, Render Service section.

---

## High Altitude: System View

### System Context

Epic 2 extends the two-process system from Epic 1 with new capabilities. The server gains a rendering pipeline (markdown-it + sanitization), image serving, file watching, and WebSocket support. The browser gains tab management, document display, and a content toolbar.

```
┌──────────────────────────────────────────────────────────────┐
│                        User's Machine                         │
│                                                               │
│  ┌───────────────┐   HTTP (localhost)    ┌────────────────┐  │
│  │  Browser Tab   │ ◄─────────────────► │  Fastify        │  │
│  │  (Frontend)    │   fetch() / JSON    │  Server         │  │
│  │                │                     │                 │  │
│  │  - Tab strip   │   WebSocket         │  - Routes       │  │
│  │  - Content     │ ◄════════════════► │  - Services     │  │
│  │  - Toolbar     │   file-change msgs  │  - Render       │  │
│  │  - Sidebar     │                     │  - Watch        │  │
│  └───────────────┘   Static assets      └───────┬────────┘  │
│                    ◄──────────────────           │            │
│                      HTML/CSS/JS                 │            │
│                                                  │            │
│                                          ┌───────▼────────┐  │
│                                          │  Filesystem     │  │
│                                          │  - .md files    │  │
│                                          │  - Images       │  │
│                                          │  - Session      │  │
│                                          └────────────────┘  │
│                                                               │
│  ┌───────────────┐                     ┌────────────────┐    │
│  │  markdown-it   │ ◄─── in-process ── │  Render        │    │
│  │  + DOMPurify   │                    │  Service        │    │
│  │  (rendering)   │ ── HTML+warnings → │                 │    │
│  └───────────────┘                     └────────────────┘    │
│                                                               │
│  ┌───────────────┐                     ┌────────────────┐    │
│  │  fs.watch()    │ ◄─── per-file ──── │  Watch         │    │
│  │  (kqueue)      │                    │  Service        │    │
│  │                │ ── change events → │                 │    │
│  └───────────────┘                     └────────────────┘    │
│                                                               │
│  ┌───────────────┐                     ┌────────────────┐    │
│  │  osascript     │ ◄─── spawn ─────── │  Server         │    │
│  │  (File Picker) │ ── path/null ────→ │  (file/pick)    │    │
│  └───────────────┘                     └────────────────┘    │
│                                                               │
│  ┌───────────────┐                     ┌────────────────┐    │
│  │  open (macOS)  │ ◄─── spawn ─────── │  Server         │    │
│  │  (sys handler) │                    │  (open-external)│    │
│  └───────────────┘                     └────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

The server has five external boundaries (three from Epic 1, two new):

1. **Filesystem** — reads .md files, reads/writes session, reads images. Mock boundary for tests.
2. **osascript** — folder picker (Epic 1) and now file picker. Mock boundary for tests.
3. **pbcopy** — clipboard fallback (Epic 1). Mock boundary for tests.
4. **fs.watch** — per-file filesystem watchers. Mock boundary for tests. *(New)*
5. **open** — macOS system handler for external files. Mock boundary for tests. *(New)*

The browser has two external boundaries (one from Epic 1, one new):

1. **Server API** — HTTP fetch calls to localhost. Mock boundary for client tests.
2. **WebSocket** — persistent connection for file change events. Mock boundary for client tests. *(New)*

In-process rendering (markdown-it + DOMPurify) is NOT a mock boundary — it runs as part of the render service and is exercised through route handler tests.

### Data Flow Overview

The core data flow for opening a document:

```
Tree Click → Client API → GET /api/file → File Service (read + size check)
                                              → Render Service (markdown-it → sanitize → rewrite images)
                                              → FileReadResponse { html, warnings, metadata }
                                         ← Response → Client State (add tab, store HTML)
                                                    → DOM Update (tab strip, content area, toolbar)
                                                    → WebSocket: { type: 'watch', path }
```

The flow for file change auto-reload:

```
fs.watch detects change → Watch Service → WebSocket: { type: 'file-change', path, event: 'modified' }
                                       → Client receives notification
                                       → Client re-fetches: GET /api/file?path=...
                                       → Content area updates with fresh HTML
```

Session mutations follow Epic 1's pattern: server endpoint mutates session, persists atomically, returns full `SessionState`. The client replaces its session state with the response.

### External Contracts (New Endpoints)

These extend Epic 1's API surface:

| Method | Path | Request | Response | Epic ACs |
|--------|------|---------|----------|----------|
| GET | /api/file | `?path={abs_path}` | `FileReadResponse` | AC-1.1–1.7, AC-2.1–2.11, AC-3.1–3.3, AC-9.1–9.3 |
| POST | /api/file/pick | — | `{ path } \| null` | AC-1.5 |
| GET | /api/image | `?path={abs_path}` | Binary image data | AC-3.1 |
| WS | /ws | — | Multiplexed JSON messages | AC-7.1–7.4 |
| POST | /api/open-external | `{ path }` | `{ ok: true }` | AC-5.3 |
| PUT | /api/session/default-mode | `{ mode }` | `SessionState` | AC-6.3 |
| PUT | /api/session/tabs | `{ openTabs, activeTab }` | `SessionState` | (tab persistence) |

Error responses extend Epic 1's codes:

| Status | Code | When |
|--------|------|------|
| 400 | INVALID_PATH | Path not absolute or invalid characters |
| 403 | PERMISSION_DENIED | Filesystem permission denied |
| 404 | FILE_NOT_FOUND | File doesn't exist |
| 413 | FILE_TOO_LARGE | File exceeds 5MB limit |
| 415 | NOT_MARKDOWN | File doesn't have .md/.markdown extension |
| 500 | READ_ERROR | Unexpected error reading file |
| 500 | RENDER_ERROR | Unexpected error during rendering |

**Runtime Prerequisites (additions to Epic 1):**

| Prerequisite | Where Needed | How to Verify |
|---|---|---|
| markdown-it 14.1.1 | Server (rendering) | `npm ls markdown-it` |
| isomorphic-dompurify 3.5.1 | Server (sanitization) | `npm ls isomorphic-dompurify` |
| @fastify/websocket 11.2.0 | Server (WebSocket routes) | `npm ls @fastify/websocket` |

---

## Medium Altitude: Module Architecture

### New and Modified Modules

Epic 2 adds 12 new modules and modifies 10 existing modules from Epic 1:

```
app/src/
├── shared/
│   └── types.ts                         # MODIFIED: add FileReadResponse, RenderWarning, etc.
│
├── server/
│   ├── app.ts                           # MODIFIED: register WebSocket plugin + new routes
│   ├── routes/
│   │   ├── session.ts                   # MODIFIED: add default-mode and tabs endpoints
│   │   ├── file.ts                      # NEW: GET /api/file, POST /api/file/pick
│   │   ├── image.ts                     # NEW: GET /api/image
│   │   ├── open-external.ts            # NEW: POST /api/open-external
│   │   └── ws.ts                        # NEW: WebSocket connection handler
│   ├── services/
│   │   ├── session.service.ts           # MODIFIED: add defaultOpenMode, openTabs, activeTab
│   │   ├── file.service.ts              # NEW: read file, validate extension, size check
│   │   ├── render.service.ts            # NEW: markdown-it pipeline, sanitization, image rewriting
│   │   ├── image.service.ts             # NEW: validate image path, resolve content-type
│   │   └── watch.service.ts             # NEW: fs.watch management, debounce, rename handling
│   └── schemas/
│       └── index.ts                     # MODIFIED: add file, image, watch, session extension schemas
│
└── client/
    ├── app.ts                           # MODIFIED: open WebSocket, restore tabs from session
    ├── api.ts                           # MODIFIED: add file read, image, file pick methods
    ├── state.ts                         # MODIFIED: add tab state, active document, warnings
    ├── router.ts                        # MODIFIED: wire new components, tab-aware rendering
    ├── components/
    │   ├── menu-bar.ts                  # MODIFIED: file path in status area, Open File now functional
    │   ├── tab-strip.ts                 # MODIFIED: from empty state to active tab management
    │   ├── content-area.ts              # MODIFIED: from empty state to rendered HTML display
    │   ├── content-toolbar.ts           # NEW: mode toggle, export dropdown, status/warnings
    │   ├── tab-context-menu.ts          # NEW: right-click context menu for tabs
    │   └── warning-panel.ts             # NEW: warning details popover
    ├── utils/
    │   ├── keyboard.ts                  # MODIFIED: add Cmd+O, Cmd+W, Cmd+Shift+], Cmd+Shift+[
    │   ├── ws.ts                        # NEW: WebSocket connection manager
    │   └── link-handler.ts              # NEW: click handler for links in rendered content
    └── styles/
        ├── tab-strip.css                # MODIFIED: active tabs, close buttons, overflow scroll
        ├── content-area.css             # MODIFIED: rendered content display container
        ├── content-toolbar.css          # NEW: toolbar layout and controls
        └── markdown-body.css            # NEW: rendered markdown styling (headings, tables, code, etc.)
```

### Module Responsibility Matrix

| Module | Layer | Responsibility | Dependencies | ACs Covered |
|--------|-------|----------------|--------------|-------------|
| `server/routes/file.ts` | Server | File read + file picker endpoints | file.service, render.service | AC-1.1–1.7, AC-9.1–9.3 |
| `server/routes/image.ts` | Server | Image proxy endpoint | image.service | AC-3.1 |
| `server/routes/ws.ts` | Server | WebSocket connection, message routing | watch.service | AC-7.1–7.4 |
| `server/routes/open-external.ts` | Server | External file opening endpoint | child_process | AC-5.3 |
| `server/services/file.service.ts` | Server | Read file, validate extension, size check | fs (mock boundary) | AC-1.4, AC-1.5, AC-9.1, AC-9.2 |
| `server/services/render.service.ts` | Server | markdown-it pipeline, sanitization, image URL rewriting, warning collection | markdown-it, DOMPurify (in-process) | AC-2.1–2.11, AC-3.1–3.3 |
| `server/services/image.service.ts` | Server | Validate image path, resolve MIME type | fs (mock boundary) | AC-3.1 |
| `server/services/watch.service.ts` | Server | Per-file fs.watch management, debounce, rename handling | fs.watch (mock boundary) | AC-7.1–7.4 |
| `server/schemas/index.ts` | Server | Zod schemas for new endpoints | zod | (supports all new routes) |
| `client/components/tab-strip.ts` | Client | Active tab strip: open, switch, close, overflow, context menu | state, api | AC-4.1–4.5 |
| `client/components/content-area.ts` | Client | Display rendered HTML from server, loading indicator | state | AC-1.1, AC-1.2, AC-2.1–2.11 |
| `client/components/content-toolbar.ts` | Client | Mode toggle, default mode picker, export dropdown, warnings | state, api | AC-6.1–6.5 |
| `client/components/tab-context-menu.ts` | Client | Tab right-click: Close, Close Others, Close Right, Copy Path | state, api, clipboard | AC-4.3d–g |
| `client/components/warning-panel.ts` | Client | Warning details popover on click | state | AC-6.5b |
| `client/utils/ws.ts` | Client | WebSocket connection lifecycle, message dispatch | — | AC-7.1–7.4 |
| `client/utils/link-handler.ts` | Client | Click handler for links in rendered markdown content | state, api | AC-2.7, AC-5.1–5.3 |
| `client/components/menu-bar.ts` | Client | File path in status area, Open File activated | state, api | AC-8.1, AC-1.5 |
| `client/utils/keyboard.ts` | Client | New shortcuts: Cmd+O, Cmd+W, tab navigation | — | AC-1.5, AC-4.3b, AC-4.5 |

---

## Dependency Map

### Server Dependencies (additions to Epic 1)

```
server/app.ts
    ├── @fastify/websocket (NEW — WebSocket plugin)
    ├── server/routes/file.ts
    │   ├── server/services/file.service.ts
    │   │   └── node:fs/promises (MOCK BOUNDARY)
    │   └── server/services/render.service.ts
    │       ├── markdown-it (in-process — NOT mocked)
    │       ├── markdown-it-anchor (in-process)
    │       ├── github-slugger (in-process)
    │       ├── markdown-it-task-lists (in-process)
    │       └── isomorphic-dompurify (in-process)
    ├── server/routes/image.ts
    │   └── server/services/image.service.ts
    │       └── node:fs/promises (MOCK BOUNDARY)
    ├── server/routes/ws.ts
    │   └── server/services/watch.service.ts
    │       └── node:fs (fs.watch — MOCK BOUNDARY)
    └── server/routes/open-external.ts
        └── node:child_process (MOCK BOUNDARY)
```

### Client Dependencies (additions to Epic 1)

```
client/app.ts
    ├── client/utils/ws.ts (NEW — WebSocket manager, MOCK BOUNDARY for tests)
    ├── client/api.ts (MOCK BOUNDARY — extended with new methods)
    ├── client/components/tab-strip.ts (MODIFIED)
    ├── client/components/content-area.ts (MODIFIED)
    ├── client/components/content-toolbar.ts (NEW)
    ├── client/components/tab-context-menu.ts (NEW)
    ├── client/components/warning-panel.ts (NEW)
    └── client/utils/link-handler.ts (NEW)
```

---

## Work Breakdown Overview

The epic breaks into 6 chunks (Chunk 0 + 5 feature chunks). Each chunk goes through Skeleton → TDD Red → TDD Green phases. Detailed chunk specs, TC mappings, and test counts are in the [Test Plan](test-plan.md).

| Chunk | Name | ACs | Estimated Tests | Dependencies |
|-------|------|-----|-----------------|--------------|
| 0 | Infrastructure | — | 0 (types, fixtures, CSS, deps) | None |
| 1 | Server — File Read + Render + Image Proxy | AC-1.4, AC-1.5, AC-2.1–2.11, AC-3.1–3.3, AC-9.1–9.3 | ~45 | Chunk 0 |
| 2 | Client — Tab Management + Document Display | AC-1.1–1.3, AC-1.6–1.7, AC-4.1–4.5 | ~35 | Chunk 1 |
| 3 | Content Toolbar + File Path Display | AC-6.1–6.5, AC-8.1 | ~15 | Chunk 2 |
| 4 | Relative Link Navigation + External Opening | AC-2.7 (link behavior), AC-5.1–5.3 | ~10 | Chunk 2 |
| 5 | File Watching | AC-7.1–7.4 | ~15 | Chunk 2 |

```
Chunk 0 ──► Chunk 1 ──► Chunk 2 ──► Chunk 3
                              ├──► Chunk 4
                              └──► Chunk 5
```

Chunks 3, 4, and 5 can run in parallel after Chunk 2 completes.

**Total estimated test count:** ~120 tests across all files. Precise counts in the test plan.

---

## Deferred Items

| Item | Related AC | Reason Deferred | Future Work |
|------|-----------|-----------------|-------------|
| Code syntax highlighting | AC-2.5 | Epic 3 — monospace rendering is sufficient for M1 | markdown-it-shiki or similar plugin |
| Mermaid diagram rendering | AC-2.11 | Epic 3 — placeholder shown for now | Mermaid.js integration |
| Export functionality | AC-6.4 | Epic 4 — dropdown present but disabled | Server-side rendering pipeline already in place |
| Edit mode | AC-6.2 | Epic 5 — toggle present but non-functional | WebSocket already supports bidirectional |
| Tab drag-to-reorder | — | Not required by any AC | Epic 6 if needed |
| Tab session restore with scroll positions | — | Persisting scroll positions adds complexity with diminishing returns | Revisit if user demand exists |
| Remote image loading | AC-3.3 | Security decision — local images only | Could add opt-in per-document setting |
| Lazy tree loading for file watch | AC-7.4 | 20 watchers is trivial for macOS kqueue | Revisit if watch count grows significantly |

---

## Open Questions

| # | Question | Owner | Blocks | Resolution |
|---|----------|-------|--------|------------|
| Q1 | Should the file read endpoint return raw markdown `content` alongside `html`, or only `html` for now? Including both adds ~50% to response size but enables future search-in-document and Epic 5 editing without endpoint changes. | Tech Lead | Chunk 1 | Recommend: include both. Localhost latency is negligible and it avoids an endpoint change for Epic 5. |

---

## Related Documentation

- Epic: `epic.md`
- PRD: `../../01--preliminary/prd.md`
- API Design: `tech-design-api.md`
- UI Design: `tech-design-ui.md`
- Test Plan: `test-plan.md`
- Epic 1 Tech Design: `../01--app-shell-and-workspace-browsing/tech-design.md`
- Stack Research: `../../.research/outputs/`
