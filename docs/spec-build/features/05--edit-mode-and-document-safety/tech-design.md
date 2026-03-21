# Technical Design: Epic 5 — Edit Mode and Document Safety

## Purpose

This document is the index and decision record for Epic 5's technical design. It establishes the editing architecture, records all dependency and design decisions (grounded in March 2026 web research and first-pass POC validation), answers the epic's 8 tech design questions, and maps modules to their companion design documents.

The detailed design is split across three companion documents:

| Document | Scope |
|----------|-------|
| [tech-design-api.md](tech-design-api.md) | Server: file save endpoint (atomic write + optimistic concurrency), save dialog consolidation, render endpoint for edit-mode preview, session extensions (defaultOpenMode "edit" validation) |
| [tech-design-ui.md](tech-design-ui.md) | Client: CodeMirror 6 integration, mode switching, dirty state tracking, conflict modal, unsaved changes modal, quit protection, insert tools, default mode picker activation, export-with-dirty warning |
| [test-plan.md](test-plan.md) | TC→test mapping, mock strategy, test fixtures, verification scripts, chunk breakdown with test counts |

**Prerequisite:** Epics 1–4 complete (server runtime, rendering pipeline, Mermaid diagrams, syntax highlighting, export, file watching, session persistence, content toolbar with mode toggle). Epic 5 spec (`epic.md`) is complete with 28 ACs and ~76 TCs.

---

## Spec Validation

Before designing, the epic was validated as the downstream consumer. All ACs map to implementation work. The following issues were identified and resolved:

| Issue | Spec Location | Resolution | Status |
|-------|---------------|------------|--------|
| Render-from-unsaved-content requires server round-trip | TC-1.1e | Server needs a render endpoint that accepts raw markdown instead of reading from disk. Design adds `POST /api/render` that accepts `{ content, documentPath }` and calls the existing `renderService.render()` method. No new service method needed — the existing `render(content, documentPath)` already accepts content as a parameter (the file service reads from disk, not the render service). | Resolved — deviated |
| Self-change detection mechanism unspecified | TC-3.1d, Q2 | Client sets a `savePending` flag before save. When WebSocket `file-change` arrives for the same path while flag is set, the event is suppressed. Flag clears after save response. POC uses the same pattern (`suppressEditorListener`). | Resolved |
| Save dialog consolidation with Epic 4 | Q4 | Consolidate into a single `POST /api/save-dialog` endpoint. Epic 4's `/api/export/save-dialog` and Epic 5's `/api/file/save-dialog` use identical osascript. The consolidated endpoint accepts `{ defaultPath, defaultFilename, prompt? }` and returns `{ path } | null`. | Resolved — deviated |
| Dirty state diffing on every keystroke is expensive for large files | Q5 | Hybrid approach: set `dirty = true` immediately on any edit (O(1) for instant dot). Debounced string comparison (300ms after last keystroke) checks `editContent === content` and clears `dirty` if they match. This ensures dirty clears whether the user types back to saved content or uses undo. POC's `computeDirty()` uses simple string equality — fine for files under 5MB (our limit). | Resolved |
| Quit flow platform split needs implementation detail | Q6, TC-5.3 | Browser: `window.addEventListener('beforeunload')` when any tab is dirty. Electron: handled by the future Electron wrapper (Epic 6). For v1 (browser-first), `beforeunload` is the only mechanism. The custom quit modal with file listing is deferred to Epic 6. | Resolved — clarified |
| Insert tools UX unspecified | Q7 | Keyboard shortcuts only: Cmd+K for link, custom dialog for table. No toolbar buttons. CodeMirror's extension API makes this trivial. Matches POC's minimal approach. | Resolved |
| `POST /api/render` doesn't exist in the epic's API surface | Data Contracts | Epic defines `GET /api/file?path=...` which reads from disk. TC-1.1e requires rendering unsaved content (not on disk). Design adds `POST /api/render` that accepts `{ content, documentPath }` and returns `{ html, warnings }`. The route handler calls the existing `renderService.render()` — no new service method needed. | Resolved — deviated |
| CodeMirror dynamic import like Mermaid? | Bundle size | CodeMirror 6 is ~150KB minified (core + markdown + history). Unlike Mermaid (~2.83MB), this is small enough to include in the main bundle. No code splitting needed. | Resolved |
| Epic 5 A6 says "tab state does not persist across restarts" | A6 | Epic 2's tech design deviated from Epic 2's A5 to persist `openTabs` and `activeTab` to session. The implemented behavior IS tab persistence. Epic 5 inherits this: on restart, tabs are restored from session but all edit state (`editContent`, `dirty`, `cursorPosition`) is lost — tabs reopen in their default mode with fresh content from disk. Unsaved edits are lost on restart; the quit protection (`beforeunload`) is the safety net. A6 is directionally correct for edit state (not persisted) but misleading for tab identity (persisted since Epic 2). | Resolved — clarified |

**Verdict:** Spec is implementation-ready with the deviations documented above. The first-pass POC validates the core approach — same editor library (CodeMirror 6), same dirty state tracking pattern, same conflict modal flow, same self-change suppression.

---

## Context

Epics 1–4 built a viewer with workspace browsing, rendered markdown with Mermaid diagrams and syntax highlighting, multi-tab management, file watching, and export. The content area displays server-rendered HTML — finished output that the user reads. But a viewer that can't fix a typo is friction. When the user spots a broken link or an outdated section, they shouldn't have to open a separate editor. Epic 5 adds a lightweight editor to the content area, turning the viewer into a viewer-with-editing.

The central architectural challenge is the boundary between viewing and editing. The viewing pipeline (established in Epics 2–3) flows: server reads file → markdown-it + Shiki → HTML → client displays via `innerHTML` → client post-processes Mermaid. Editing reverses part of this: the user types raw markdown in a CodeMirror editor, and when they switch to Render mode, the app must show the rendered version of their unsaved edits — not the saved-on-disk version. This requires a server round-trip to render arbitrary markdown content (not just files from disk), which is why the design adds `POST /api/render`.

The second architectural challenge is document safety. The app must track dirty state, protect against accidental data loss (close/quit prompts), and handle the conflict between local edits and external file changes. The file watching infrastructure from Epic 2 provides the change detection. Epic 5 adds the conflict resolution layer on top: when a watched file changes while the user has unsaved edits, a conflict modal offers three choices (Keep My Changes, Reload from Disk, Save Copy). When the user saves, the file watcher must not treat the self-originated change as an external modification — this requires a suppression mechanism.

The first-pass POC (Electron prototype) validates every core pattern. It uses CodeMirror 6 with `@codemirror/lang-markdown` for syntax highlighting, tracks dirty state via `currentMarkdown !== savedMarkdown`, implements the conflict modal with Keep/Reload/Save Copy options, uses a `suppressEditorListener` flag for self-change detection, and handles quit-with-dirty via per-tab modal prompts. The design adopts these patterns directly, adapted for the browser-first Fastify architecture.

The save endpoint uses optimistic concurrency via `expectedModifiedAt` — a compare-and-swap token that prevents silently overwriting external changes. When the server receives a save request, it compares the file's current mtime against the client's expected mtime. If they differ, the file changed since the client last loaded it, and the server returns 409 CONFLICT instead of writing. This catches the race condition between file-watcher notification and save action.

### Stack Additions for Epic 5

All packages verified via web research (March 2026) and validated by the first-pass POC.

| Package | Version | Purpose | Research Confirmed |
|---------|---------|---------|-------------------|
| codemirror | 6.0.2 | Meta-package: includes `basicSetup` (line numbers, history, search, keybindings) | Yes — pure ESM, ~135KB gzipped with basicSetup + markdown |
| @codemirror/lang-markdown | 6.5.0 | Markdown syntax highlighting + language support | Yes — highlights headings, bold, italic, code, links, lists, blockquotes |
| @codemirror/language | 6.12.2 | Language infrastructure (syntax highlighting base) | Yes — peer dependency |
| @codemirror/commands | 6.10.3 | Default keybindings, history (undo/redo), indent | Yes — includes `history()`, `defaultKeymap`, `historyKeymap` |
| @codemirror/search | 6.5.11 | Search keybindings (Cmd+F, etc.) | Yes — bundled search for future use |
| @codemirror/state | 6.6.0 | Editor state management | Yes — core dependency |
| @codemirror/view | 6.40.0 | Editor view, DOM rendering, event handling | Yes — core dependency |

**Packages NOT added (considered and rejected):**

| Package | Why Rejected |
|---------|-------------|
| Monaco Editor | ~3MB bundle, VS Code-level complexity. Overkill for light markdown editing. CodeMirror is 20x smaller. |
| @codemirror/theme-one-dark | Not needed — we use CodeMirror's `EditorView.theme()` with CSS custom properties from our theme system. No pre-built dark theme necessary. |
| prosemirror | Rich text / WYSIWYG — out of scope. CodeMirror is the right tool for plain text editing. |

---

## Tech Design Question Answers

The epic raised 8 questions for the tech lead. All are answered here; detailed implementation follows in the companion documents.

### Q1: Editor component

**Answer:** CodeMirror 6.

CodeMirror 6 was chosen over Monaco for four reasons:

1. **Bundle size.** CodeMirror 6 is ~150KB minified (core + markdown + history + commands). Monaco is ~3MB. For a "light editing" use case, 150KB is appropriate; 3MB is not.

2. **Markdown language support.** `@codemirror/lang-markdown` highlights headings, bold, italic, code blocks, links, lists, blockquotes — all constructs the epic requires (AC-2.1a). It's a first-party package, actively maintained.

3. **Theme integration.** CodeMirror 6's `EditorView.theme()` accepts a style object that can reference CSS custom properties. This integrates directly with our `var(--color-*)` theme system. No separate theme files per app theme — the editor inherits the active theme via CSS variables, same as all other components.

4. **POC validation.** The first-pass POC uses the exact same CodeMirror 6 packages and confirms they work for the use case: typing, undo/redo, line wrapping, markdown highlighting, and `EditorView.updateListener` for change detection.

**ESM compatibility:** CodeMirror 6 is pure ESM. All packages use `"type": "module"` and export ESM entry points. esbuild bundles them without issue — the POC already does this.

**Detailed design:** See UI companion doc, CodeMirror Integration section.

### Q2: Self-change detection

**Answer:** Client-side `savePending` flag, coordinated with the WebSocket `file-change` handler.

When the user saves:
1. Client sets `savePending[path] = true`
2. Client sends `PUT /api/file` with content
3. Server writes atomically (temp + rename)
4. File watcher (chokidar) detects the change and sends `{ type: 'file-change', path, event: 'modified' }` via WebSocket
5. Client receives the WebSocket message. Because `savePending[path]` is true, the client suppresses the event (no conflict modal, no reload)
6. Client receives the save response (200 OK with new `modifiedAt`). Clears `savePending[path]`

The flag is path-keyed (not global) so saving one file doesn't suppress change events for other files.

The POC uses an analogous pattern — `suppressEditorListener` prevents the editor's own `updateListener` from firing during programmatic content replacement. Our design extends this to the WebSocket layer.

**Edge case — save fails but watcher already suppressed:** If the save request fails (e.g., permission denied), the `savePending` flag is cleared in the error handler. The watcher may have already suppressed a genuine external change during the save attempt window (~50ms). This is acceptable — the next external change will be detected normally. The window is narrow enough that this race is unlikely, and even if it occurs, the user's edits are preserved (save failed = content still in editor).

**Detailed design:** See API companion doc, Self-Change Suppression section.

### Q3: Scroll position mapping between modes

**Answer:** Best-effort percentage-based mapping. No line-number estimation.

When switching from Render to Edit: calculate the render view's scroll percentage (`scrollTop / scrollHeight`), apply the same percentage to the editor's total height. This puts the user approximately at the same position in the document.

When switching from Edit to Render: calculate the editor's scroll percentage, apply to the rendered content's total height.

This is deliberately imprecise. Exact line mapping between rendered HTML and source markdown is complex (a single markdown heading becomes an `<h1>` with different height, code blocks gain syntax highlighting chrome, Mermaid diagrams expand from source to SVG). The percentage approach is simple, works reasonably for long documents, and matches user expectations — "I was about 60% through the document, and I'm still about 60% through."

**Detailed design:** See UI companion doc, Scroll Position Mapping section.

### Q4: Save dialog consolidation

**Answer:** Consolidate Epic 4's `/api/export/save-dialog` and Epic 5's `/api/file/save-dialog` into a single generic `POST /api/save-dialog` endpoint.

The underlying osascript command is identical: `choose file name with prompt "..." default name "..." default location POSIX file "..."`. The only difference is the prompt text and default filename. A generic endpoint accepts `{ defaultPath, defaultFilename, prompt? }` and serves both use cases.

Epic 4's `/api/export/save-dialog` is aliased or redirected to the consolidated endpoint for backward compatibility (or updated in place if no deployed consumers exist — which is true, since Epic 4 isn't shipped yet).

**Detailed design:** See API companion doc, Save Dialog section.

### Q5: Dirty state diffing

**Answer:** Hybrid: instant dirty flag + debounced string comparison.

The epic's data contract (line 617) says "derivation is the source of truth; the field is a cache." This means `dirty` must accurately reflect `editContent !== content` at all times, not just after undo. The design achieves this without per-keystroke overhead:

1. **Instant path (every keystroke):** Set `dirty = true` immediately on any `docChanged` event. This is O(1) and ensures the dot appears on the first edit with no delay.
2. **Debounced truth path (300ms after last keystroke):** After 300ms of inactivity, compare `editContent === content` (string equality). If they match, clear `dirty`. This catches all paths back to clean: undo, manual re-typing, paste-replace, etc.
3. **Save path:** On successful save, set `content = editContent` and `dirty = false`. No comparison needed — they're equal by definition.

The 300ms debounce means the dirty dot may persist for up to 300ms after the user types back to saved content. This is imperceptible. For files under 5MB (our hard limit from Epic 2), string comparison takes <5ms. No hashing needed.

The POC's `computeDirty(savedMarkdown, currentMarkdown)` uses simple string equality on every change. Our debounced version is slightly more efficient but converges to the same truth.

**Detailed design:** See UI companion doc, Dirty State Tracking section.

### Q6: Quit interception in Electron

**Answer:** Browser-only for v1. `beforeunload` event when any tab is dirty.

Epic 5 ships in the browser-first architecture (Epics 1–4 are all browser-based). The custom quit modal with per-file listing (TC-5.3a–d) is an Electron-only feature. For v1:

- **Browser:** `window.addEventListener('beforeunload', handler)` when any tab has `dirty === true`. The handler returns a non-empty string to trigger the browser's generic "Changes you made may not be saved" dialog. Remove the listener when no tabs are dirty. This satisfies TC-5.3e.
- **Electron (Epic 6):** The future Electron wrapper will intercept the `close` event, query the renderer for dirty tabs via IPC, and show a custom modal listing dirty files. This satisfies TC-5.3a–d.

The design separates the concern: the client exposes a `getDirtyTabs(): TabState[]` method that returns all dirty tabs. In the browser, this feeds the `beforeunload` decision. In Electron, this feeds the custom modal content.

**Detailed design:** See UI companion doc, Quit Protection section.

### Q7: Insert tool UX

**Answer:** Keyboard shortcuts + small dialog. No toolbar buttons.

Two insert tools:
- **Insert Link (Cmd+K):** If text is selected, it becomes the link text; prompt only for URL. If no selection, prompt for both text and URL. Inserts `[text](url)` at cursor.
- **Insert Table (no shortcut — toolbar button in the editor gutter area or via command palette):** Small dialog prompting for row and column count. Inserts a markdown table skeleton with header, separator, and body rows.

Both tools use CodeMirror's `EditorView.dispatch()` to insert text at the cursor position. The insert is a single transaction, so Cmd+Z undoes the entire insert in one step.

The POC doesn't implement insert tools — this is new for Epic 5. The approach is minimal per the epic's guidance: "not a heavy formatting toolbar."

**Detailed design:** See UI companion doc, Insert Tools section.

### Q8: Concurrent save serialization

**Answer:** The `expectedModifiedAt` optimistic concurrency check is sufficient. No server-side queue.

The server validates `expectedModifiedAt` against the file's current mtime before writing. If they don't match, the server returns 409 CONFLICT. The client shows the conflict modal. The user resolves the conflict, and the next save attempt carries the updated `expectedModifiedAt`.

Server-side queuing adds complexity (request ordering, timeout management, deadlock risk) for a scenario that doesn't occur in practice — single-user local app. The optimistic approach handles the only realistic concurrent write scenario: the user saves while an external process (agent, editor) also writes.

**Detailed design:** See API companion doc, File Save Service section.

---

## High Altitude: System View

### System Context

Epic 5 does not change the system boundary established by Epics 1–4. The server still serves rendered HTML and manages session state. The client still displays content and handles user interaction. What changes is the client gains an editor component and the server gains a file write endpoint.

```
┌──────────────────────────────────────────────────────────────┐
│                        User's Machine                         │
│                                                               │
│  ┌───────────────┐   HTTP (localhost)    ┌────────────────┐  │
│  │  Browser Tab   │ ◄─────────────────► │  Fastify        │  │
│  │  (Frontend)    │   PUT /api/file     │  Server         │  │
│  │                │   POST /api/render  │                 │  │
│  │  NEW:          │   POST /api/save-   │  NEW:           │  │
│  │  - CodeMirror  │     dialog         │  - Save svc     │  │
│  │    editor      │                     │  - Render svc   │  │
│  │  - Dirty state │   WebSocket         │    (from-       │  │
│  │  - Conflict    │ ◄════════════════► │    content)     │  │
│  │    modal       │   file-change msgs  │  - Save dialog  │  │
│  │  - Unsaved     │   (+ suppression)  │    (consolidated)│ │
│  │    protection  │                     │                 │  │
│  └───────────────┘                     └───────┬────────┘  │
│                                                  │            │
│                                          ┌───────▼────────┐  │
│                                          │  Filesystem     │  │
│                                          │  - Read .md     │  │
│                                          │  - Write .md    │  │
│                                          │    (atomic)     │  │
│                                          │  - Session      │  │
│                                          └────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

The server has one new external boundary:

1. **Filesystem write** — `PUT /api/file` writes content to disk via atomic temp + rename. Same pattern as Epic 1's session persistence. Mock boundary for tests.

Plus existing boundaries: filesystem read, osascript (folder/file picker, save dialog), Puppeteer (export), chokidar (file watching), `open` command.

The browser has no new external boundaries. CodeMirror is an in-process library (not a mock boundary). The API client and WebSocket client remain the mock boundaries for client tests.

### Data Flow Overview

Two new data flows in Epic 5:

**Save flow:**
```
Edit in CodeMirror → User presses Cmd+S
    → Client sets savePending[path] = true
    → PUT /api/file { path, content, expectedModifiedAt }
    → Server: stat() → compare mtime → write temp → rename → return { modifiedAt }
    → Client: update savedContent, clear dirty, clear savePending
    → WebSocket: file-change arrives → suppressed (savePending was true)
```

**Render-from-unsaved flow (TC-1.1e):**
```
User switches Edit → Render with unsaved edits
    → POST /api/render { content, documentPath }
    → Server: markdown-it + Shiki (dual-theme) → image post-processing → DOMPurify
    → Client: display HTML, post-process Mermaid, update warnings
```

### External Contracts (New Endpoints)

These extend the existing API surface:

| Method | Path | Request | Response | Epic ACs | Notes |
|--------|------|---------|----------|----------|-------|
| PUT | /api/file | `FileSaveRequest` | `FileSaveResponse` | AC-3.1, AC-3.2, AC-3.3 | NEW |
| POST | /api/render | `{ content, documentPath }` | `{ html, warnings }` | AC-1.1e (render unsaved content) | NEW — calls existing `renderService.render()` |
| POST | /api/save-dialog | `{ defaultPath, defaultFilename, prompt? }` | `{ path } \| null` | AC-3.2 (Save As) | CONSOLIDATED — replaces Epic 4's `/api/export/save-dialog` |

Error responses extend Epic 1–4 codes:

| Status | Code | When |
|--------|------|------|
| 400 | INVALID_PATH | Path not absolute or invalid characters |
| 403 | PERMISSION_DENIED | Cannot write to path |
| 404 | PATH_NOT_FOUND | Parent directory doesn't exist |
| 409 | CONFLICT | File on disk has different mtime than expectedModifiedAt |
| 415 | NOT_MARKDOWN | Save path doesn't have .md/.markdown extension |
| 500 | WRITE_ERROR | Unexpected error during write |
| 507 | INSUFFICIENT_STORAGE | Disk full |

**Runtime Prerequisites (additions):**

| Prerequisite | Where Needed | How to Verify |
|---|---|---|
| codemirror 6.0.1 + @codemirror/* packages | Client (editor) | `npm ls codemirror` |

---

## Medium Altitude: Module Architecture

### New and Modified Modules

Epic 5 adds 7 new source modules (+ 3 new CSS files) and modifies 12 existing modules:

```
app/src/
├── server/
│   ├── app.ts                           # MODIFIED: register new routes
│   ├── routes/
│   │   ├── file.ts                      # MODIFIED: add PUT /api/file (save)
│   │   ├── render.ts                    # NEW: POST /api/render (render from content)
│   │   └── save-dialog.ts              # NEW: POST /api/save-dialog (consolidated)
│   ├── services/
│   │   ├── file.service.ts             # MODIFIED: add writeFile with mtime check
│   │   └── render.service.ts           # (no new method — POST /api/render calls existing render())
│   └── schemas/
│       └── index.ts                     # MODIFIED: add FileSaveRequest/Response, RenderRequest schemas
│
└── client/
    ├── app.ts                           # MODIFIED: beforeunload handler, default mode Edit
    ├── state.ts                         # MODIFIED: add TabState edit fields, exportDirtyWarning
    ├── api.ts                           # MODIFIED: add save, render, saveDialog methods
    ├── components/
    │   ├── content-area.ts             # MODIFIED: switch between rendered HTML and CodeMirror editor
    │   ├── content-toolbar.ts          # MODIFIED: activate Edit toggle, cursor position, dirty indicator
    │   ├── menu-bar.ts                 # MODIFIED: add Save/Save As to File menu
    │   ├── tab-strip.ts               # MODIFIED: dirty dot indicator on tabs
    │   ├── editor.ts                   # NEW: CodeMirror wrapper — init, theme, content sync
    │   ├── conflict-modal.ts           # NEW: Keep/Reload/Save Copy modal
    │   ├── unsaved-modal.ts            # NEW: Save and Close/Discard/Cancel modal
    │   └── insert-tools.ts            # NEW: link and table insert dialogs
    ├── utils/
    │   ├── keyboard.ts                 # MODIFIED: add Cmd+S, Cmd+Shift+S, Cmd+Shift+M, Cmd+K
    │   └── ws.ts                       # MODIFIED: add savePending suppression logic
    └── styles/
        ├── editor.css                  # NEW: CodeMirror container, theme integration
        ├── content-toolbar.css         # MODIFIED: dirty indicator, cursor position display
        └── modal.css                   # NEW: conflict and unsaved changes modal styles
```

### Module Responsibility Matrix

| Module | Layer | Responsibility | Dependencies | ACs Covered |
|--------|-------|----------------|--------------|-------------|
| `server/routes/file.ts` (save) | Server | PUT /api/file: validate, mtime check, atomic write | file.service | AC-3.1, AC-3.2, AC-3.3 |
| `server/routes/render.ts` | Server | POST /api/render: render arbitrary content | render.service | AC-1.1e |
| `server/routes/save-dialog.ts` | Server | POST /api/save-dialog: consolidated save dialog | child_process (mock) | AC-3.2a |
| `server/services/file.service.ts` (write) | Server | Atomic write with mtime check, extension validation | fs (mock boundary) | AC-3.1, AC-3.3 |
| `server/routes/render.ts` (route only) | Server | POST /api/render calls existing `renderService.render()` | render.service (existing) | AC-1.1e |
| `client/components/editor.ts` | Client | CodeMirror wrapper: init, sync, theme, change events | codemirror (in-process) | AC-2.1–2.4 |
| `client/components/content-area.ts` | Client | Switch between Render HTML and CodeMirror editor | editor, state | AC-1.1, AC-1.2 |
| `client/components/content-toolbar.ts` | Client | Mode toggle activation, cursor position, dirty indicator | state, api | AC-1.2, AC-4.2, AC-7.1 |
| `client/components/tab-strip.ts` | Client | Dirty dot indicator on tabs | state | AC-4.1 |
| `client/components/conflict-modal.ts` | Client | Keep/Reload/Save Copy conflict resolution | state, api | AC-6.1 |
| `client/components/unsaved-modal.ts` | Client | Save and Close/Discard/Cancel for dirty tabs | state, api | AC-5.1, AC-5.2 |
| `client/components/insert-tools.ts` | Client | Link and table insert dialogs | editor | AC-9.1, AC-9.2 |
| `client/components/menu-bar.ts` | Client | Save/Save As in File menu | state, api | AC-8.2 |
| `client/utils/keyboard.ts` | Client | Cmd+S, Cmd+Shift+S, Cmd+Shift+M, Cmd+K | — | AC-3.1b, AC-3.2a, AC-1.1c, AC-9.1 |
| `client/utils/ws.ts` | Client | savePending flag for self-change suppression | — | AC-3.1d (TC-3.1d) |
| `client/app.ts` | Client | beforeunload handler for quit protection | state | AC-5.3 |

---

## Dependency Map

### Server Dependencies (additions to Epics 1–4)

```
server/routes/file.ts (MODIFIED — add PUT handler)
    └── server/services/file.service.ts (MODIFIED — add writeFile)
        └── node:fs/promises (MOCK BOUNDARY)

server/routes/render.ts (NEW — thin route, calls existing render.service.render())
    └── server/services/render.service.ts (EXISTING — no changes)
        ├── markdown-it + Shiki (in-process — NOT mocked)
        └── DOMPurify (in-process)

server/routes/save-dialog.ts (NEW — consolidated from Epic 4)
    └── node:child_process (MOCK BOUNDARY — osascript)
```

### Client Dependencies (additions)

```
client/components/editor.ts (NEW)
    ├── codemirror (in-process — NOT a mock boundary)
    ├── @codemirror/lang-markdown (in-process)
    ├── @codemirror/commands (in-process)
    └── @codemirror/view (in-process)

client/components/conflict-modal.ts (NEW)
    ├── client/state.ts
    └── client/api.ts (MOCK BOUNDARY)

client/components/unsaved-modal.ts (NEW)
    ├── client/state.ts
    └── client/api.ts (MOCK BOUNDARY)

client/utils/ws.ts (MODIFIED)
    └── savePending Map<string, boolean> (internal state)
```

---

## Work Breakdown Overview

The epic breaks into 7 chunks (Chunk 0 + 6 feature chunks). Each chunk goes through Skeleton → TDD Red → TDD Green phases. Detailed chunk specs, TC mappings, and test counts are in the [Test Plan](test-plan.md).

| Chunk | Name | ACs | Estimated Tests | Dependencies |
|-------|------|-----|-----------------|--------------|
| 0 | Infrastructure | — | 0 (types, fixtures, CSS, deps) | None |
| 1 | Server — Save + Render-from-Content | AC-3.1, AC-3.3 | 20 | Chunk 0 |
| 2 | Client — Mode Switching + Editor | AC-1.1, AC-1.2, AC-2.1–2.4, AC-7.1–7.2 | 22 | Chunk 1 |
| 3 | Save, Save As, Dirty State | AC-3.1–3.2, AC-4.1–4.3 | 20 | Chunk 2 |
| 4 | Unsaved Changes Protection | AC-5.1–5.3 | 14 | Chunk 3 |
| 5 | External Change Conflict Resolution | AC-6.1–6.3 | 10 | Chunk 3 |
| 6 | Insert Tools, File Menu, Cross-Epic | AC-8.1–8.2, AC-9.1–9.2, AC-10.1–10.2 | 12 | Chunk 3 |

```
Chunk 0 ──► Chunk 1 ──► Chunk 2 ──► Chunk 3 ──► Chunk 4
                                          ├──► Chunk 5
                                          └──► Chunk 6
```

Chunks 4, 5, and 6 can run in parallel after Chunk 3 completes.

**Total estimated test count:** 101 tests across 11 test files. Combined with Epics 1–4 (430 tests), the project reaches 531 tests.

---

## Deferred Items

| Item | Related AC | Reason Deferred | Future Work |
|------|-----------|-----------------|-------------|
| Custom quit modal with file listing | AC-5.3a–d | Electron-only; browser `beforeunload` is v1 | Epic 6 Electron wrapper |
| Auto-save | — | Out of scope per epic | Timer-based save with configurable interval |
| Find and replace in editor | — | Out of scope per epic (search out of scope for v1 per PRD) | CodeMirror `@codemirror/search` already bundled |
| Split pane (side-by-side edit + preview) | — | Out of scope per epic | Layout change: two panes in content area |
| Live preview while typing | — | Out of scope (would be split pane) | Debounced render on edit with diff patching |
| File > New (create blank document) | — | Out of scope per epic | Server creates file, opens in Edit mode |
| Editor font size configuration | — | No configuration UI in v1 | Settings panel in future epic |
| Custom inline insert dialogs (replacing `prompt()`) | AC-9.1, AC-9.2 | Browser `prompt()` is sufficient for v1 | Popover near cursor for link/table insert |
| Per-theme CodeMirror syntax highlighting schemes | AC-2.3 | One highlight style using CSS vars is sufficient for v1 | Map each app theme to a distinct CM highlight scheme |

---

## Open Questions

| # | Question | Owner | Blocks | Resolution |
|---|----------|-------|--------|------------|
| — | No open questions | — | — | All 8 tech design questions answered |

---

## Related Documentation

- Epic: `epic.md`
- API Design: `tech-design-api.md`
- UI Design: `tech-design-ui.md`
- Test Plan: `test-plan.md`
- Epic 2 Tech Design (file watching, content toolbar): `../02--document-viewing-and-multi-tab-reading/tech-design.md`
- Epic 4 Tech Design (export, save dialog): `../04--export/tech-design.md`
- POC Implementation: `../../../first-pass-poc/`
- Stack Research: `../../.research/outputs/`
