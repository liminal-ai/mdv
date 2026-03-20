# Epic 1 — App Shell and Workspace Browsing: Opus Review

**Reviewer:** Opus 4.6 (automated)
**Date:** 2026-03-19
**Scope:** Full implementation review against epic, tech design, and test plan
**Status:** All 156 tests pass across 18 test files

---

## Executive Summary

The Epic 1 implementation is thorough and well-executed. All 11 API endpoints are implemented. All 43 ACs are addressed with test coverage. The architecture closely follows the tech design with minor structural deviations. The codebase is clean, consistent, and well-organized. Two major issues were found: the root-line invalid state (TC-10.2a) clears the path instead of showing it as invalid, and `shared/types.ts` leaks a runtime value export into the client bundle path. Several minor deviations from the tech design are noted but are functionally equivalent or improvements.

**Test counts:** 156 actual tests vs 132 planned. The surplus (24 extra) comes from integration tests in `app.test.ts`, smoke test, sidebar-tree integration tests, and additional edge case coverage. This exceeds expectations.

---

## Findings by Severity

### Critical

None.

### Major

#### M1. TC-10.2a — Root-line invalid state not implemented

**Epic says (TC-10.2a):**
> Given: Root is set to a valid directory
> When: The directory is deleted externally and user clicks refresh
> Then: An error is shown, file tree clears, root line indicates the path is no longer valid

**Tech design UI says:**
> The root line does NOT auto-clear — the user explicitly changes it. The invalid visual state on the root line itself (not just the banner) satisfies the epic's requirement. Path gets `.root-line__path--invalid` class (muted/red text, strikethrough or warning icon prefix). Pin and refresh hidden. Browse and copy remain visible.

**Actual behavior:**
In `app.ts:175-203`, when `refreshTree()` encounters a PATH_NOT_FOUND error, it sets `lastRoot: null` in client state:

```typescript
store.update({
  session: { ...session, lastRoot: null },  // ← clears instead of marking invalid
  tree: [],
  treeLoading: false,
  error: getErrorMessage(error),
}, ['session', 'tree', 'treeLoading', 'error']);
```

This causes `root-line.ts` to render the generic "No folder selected" state. The user loses the deleted path information — they can't see WHICH folder was deleted or copy its path for reference.

**Test gap:** Neither `error-notification.test.ts` nor `app.test.ts` verifies the root-line enters the specified invalid state. The tests only check that an error notification appears.

**Impact:** User loses path context when a root is deleted. The copy action (which could help reference the old path) is also lost.

**Fix:** `refreshTree()` should NOT null out `lastRoot`. Instead, add an `invalidRoot: boolean` flag to client state, and `root-line.ts` should render a `.root-line__path--invalid` state when the flag is set. The flag clears when a new valid root is set.

---

#### M2. `shared/types.ts` leaks runtime value export

**Tech design says:**
> Use `export type` to ensure Zod is NOT bundled into the client. esbuild will tree-shake type-only imports, keeping Zod server-side only.

**Actual (`shared/types.ts`):**
```typescript
export type * from '../server/schemas/index.js';    // ✅ type-only
export { ErrorCode } from '../server/utils/errors.js';  // ❌ runtime value
```

The `ErrorCode` object from `server/utils/errors.ts` is exported as a runtime value, creating a path for server code to leak into the client bundle. Currently the client's `state.ts` uses `import type { ErrorCode }` which prevents bundling, but any future `import { ErrorCode }` would pull the errors module.

**Fix:** Change to `export type { ErrorCode } from '../server/utils/errors.js'`. Since `ErrorCode` is used only as a type in the client, this is a safe change.

---

### Minor

#### m1. Missing `router.ts` module

The tech design specifies a `client/router.ts` module that subscribes to state and calls component render functions. The implementation absorbs this into `app.ts` where each `mountX()` function self-subscribes to the store. Functionally equivalent and arguably simpler (components manage their own subscriptions), but a structural deviation from the documented architecture.

#### m2. `expandedDirsByRoot` type changed from `Map<string, Set<string>>` to `Record<string, string[]>`

The tech design specifies a `Map` with `Set` values. The implementation uses a plain `Record` with arrays. This is simpler to serialize and spread in the state store, but loses `Set`'s O(1) lookup for checking expanded state. For the expected scale (<500 directories), the performance difference is negligible. The `flattenVisible` function in `file-tree.ts` does create a `Set` from the array for rendering, so lookup performance is preserved where it matters.

#### m3. `ContextMenuState` shape deviation

**Tech design:** `{ x, y, target: TreeNode, items: ContextMenuItem[] }`
**Actual:** `{ x, y, targetPath: string, targetType: 'file' | 'directory' }`

Menu items are computed at render time rather than stored in state. This is arguably cleaner (avoids stale closures in state), but the `target` field carrying the full `TreeNode` would have allowed richer menu items. No functional impact for Epic 1.

#### m4. `static.ts` uses `process.cwd()` instead of `import.meta.dirname`

**Tech design:** `path.join(import.meta.dirname, '../../dist/client')`
**Actual:** `path.join(process.cwd(), 'dist/client')`

Works when the process is started from the `app/` directory (the expected case), but would break if started from a different working directory. `import.meta.dirname` would be more robust.

#### m5. `buildApp` disables Fastify logger

**Tech design:** `Fastify({ logger: true })`
**Actual:** `Fastify({ logger: false })`

Suppresses request logging. Useful for clean test output, but means production debugging requires enabling the logger. This may be intentional for development experience but should be configurable.

#### m6. Redundant schema parsing in route handlers

Several session routes manually call `.parse(request.body)` after Zod validation is already configured via `setValidatorCompiler(validatorCompiler)`:

```typescript
// routes/session.ts
const { root } = SetRootRequestSchema.parse(request.body);  // redundant
```

The validator compiler already parses and validates the body before the handler runs. Double-parsing is harmless but adds unnecessary overhead. The manual parse could be removed, relying on `request.body` being already typed and validated.

#### m7. `updateSidebar` takes flat boolean instead of partial object

**Tech design:** `async updateSidebar(state: Partial<SidebarState>): Promise<SessionState>`
**Actual:** `async updateSidebar(workspacesCollapsed: boolean): Promise<SessionState>`

Since `SidebarState` currently has only `workspacesCollapsed`, this is equivalent. But the tech design's partial object pattern was designed for forward compatibility if more sidebar state fields are added. Low risk since the signature is easily changed.

#### m8. Test plan deviation — clipboard empty text test

**Test plan says:** "Non-TC: Empty text rejected — POST with empty string returns 400"
**Actual test:** "Non-TC: Oversized text rejected — POST with text > 100,000 chars returns 400"

The `ClipboardRequestSchema` has `z.string().max(100_000)` but no `.min(1)`, so empty strings are accepted. The test verifies the max bound instead of the min. Empty clipboard writes are probably harmless, but this deviates from the test plan.

#### m9. `BrowseService` uses `execFile` instead of `exec`

**Tech design:** `exec('osascript -e ...')`
**Actual:** `execFile('osascript', ['-e', FOLDER_PICKER_SCRIPT], ...)`

`execFile` is actually *better* than `exec` — it avoids shell interpolation, reducing injection risk. The tech design's security note says "no user input is interpolated into the command" but `execFile` enforces this structurally. This is a positive deviation.

---

## AC-by-AC Verification

### Flow 1: App Launch and Initial State

| AC | TC | Status | Evidence |
|----|-----|--------|----------|
| AC-1.1 | TC-1.1a | ✅ | `session.test.ts:78` — GET /api/session returns default; `app.test.ts:106` — shell renders |
| AC-1.1 | TC-1.1b | ✅ | `session.test.ts:99` — listen called with `host: '127.0.0.1'` |
| AC-1.1 | TC-1.1c | ✅ | `session.test.ts:114` — EADDRINUSE fallback to port 0 |
| AC-1.2 | TC-1.2a | ✅ | `session.test.ts:132` — 3 workspaces + root restored |
| AC-1.2 | TC-1.2b | ✅ | `session.test.ts:162` — null root restored; `app.test.ts:129` |
| AC-1.2 | TC-1.2c | ✅ | `session.test.ts:184` — corrupted resets to default; `app.test.ts:114` |
| AC-1.2 | TC-1.2d | ✅ | `session.test.ts:200` — dark-cool theme restored; `app.test.ts:123` — data-theme set |
| AC-1.3 | TC-1.3a | ✅ | `content-area.test.ts:13` — app name, buttons, recent files |
| AC-1.3 | TC-1.3b | ✅ | `content-area.test.ts:38` — "No recent files" |
| AC-1.3 | TC-1.3c | ✅ | `content-area.test.ts:64` — filenames and paths listed |
| AC-1.4 | TC-1.4a | ✅ | `content-area.test.ts:85` — "No documents open" |

### Flow 2: Menu Bar

| AC | TC | Status | Evidence |
|----|-----|--------|----------|
| AC-2.1 | TC-2.1a | ✅ | `menu-bar.test.ts:28` — File menu with shortcuts |
| AC-2.1 | TC-2.1b | ✅ | `menu-bar.test.ts:39` — Export items disabled |
| AC-2.1 | TC-2.1c | ✅ | `menu-bar.test.ts:49` — View menu with sidebar toggle + themes |
| AC-2.1 | TC-2.1d | ✅ | `menu-bar.test.ts:59` — outside click closes menu |
| AC-2.1 | TC-2.1e | ✅ | `menu-bar.test.ts:68` — only one menu at a time |
| AC-2.2 | TC-2.2a | ✅ | `menu-bar.test.ts:78` — tooltips with shortcuts |
| AC-2.2 | TC-2.2b | ✅ | `menu-bar.test.ts:90` — Open Folder triggers browse |
| AC-2.2 | TC-2.2c | ✅ | `menu-bar.test.ts:98` — Open File disabled |
| AC-2.3 | TC-2.3a | ✅ | `keyboard.test.ts:19` — Cmd+O not registered |
| AC-2.3 | TC-2.3b | ✅ | `keyboard.test.ts:35` — shortcut fires from sidebar focus |
| AC-2.4 | TC-2.4a | ✅ | `menu-bar.test.ts:115` — arrow keys + Enter + Escape |
| AC-2.4 | TC-2.4b | ✅ | `file-tree.test.ts:207` — arrow keys + Enter |
| AC-2.4 | TC-2.4c | ✅ | `context-menu.test.ts:171` — arrow keys + focus management |
| AC-2.5 | TC-2.5a | ✅ | `menu-bar.test.ts:138` — sidebar hidden |
| AC-2.5 | TC-2.5b | ✅ | `menu-bar.test.ts:147` — sidebar visible |

### Flow 3: Workspaces Section

| AC | TC | Status | Evidence |
|----|-----|--------|----------|
| AC-3.1 | TC-3.1a | ✅ | `workspaces.test.ts:44` — collapse hides content |
| AC-3.1 | TC-3.1b | ✅ | `workspaces.test.ts:58` — expand shows content |
| AC-3.1 | TC-3.1c | ✅ | `session.test.ts:479` — sidebar state persists across reload |
| AC-3.2 | TC-3.2a | ✅ | `workspaces.test.ts:69` — label shows "leemoore" |
| AC-3.2 | TC-3.2b | ✅ | `workspaces.test.ts:75` — title has full path |
| AC-3.2 | TC-3.2c | ✅ | `workspaces.test.ts:81` — class name present (CSS handles truncation) |
| AC-3.3 | TC-3.3a | ✅ | `session.test.ts:220` — PUT /api/session/root updates lastRoot |
| AC-3.3 | TC-3.3b | ✅ | `workspaces.test.ts:98` — active workspace has `--active` class |
| AC-3.3 | TC-3.3c | ✅ | `session.test.ts:239` — 404 returned; `error-notification.test.ts:39` — error shown |
| AC-3.4 | TC-3.4a | ✅ | `session.test.ts:261` + `workspaces.test.ts:108` |
| AC-3.4 | TC-3.4b | ✅ | `workspaces.test.ts:117` — class present (CSS handles hover) |
| AC-3.4 | TC-3.4c | ✅ | `session.test.ts:291` — root unchanged after removing active workspace |

### Flow 4: Root Line

| AC | TC | Status | Evidence |
|----|-----|--------|----------|
| AC-4.1 | TC-4.1a | ✅ | `root-line.test.ts:36` — `~/code/project-atlas` with full path tooltip |
| AC-4.1 | TC-4.1b | ✅ | `root-line.test.ts:45` — "No folder selected" + actions hidden |
| AC-4.2 | TC-4.2a | ✅ | `browse.test.ts:6` + `root-line.test.ts:54` |
| AC-4.2 | TC-4.2b | ✅ | `browse.test.ts:20` — cancel returns null |
| AC-4.2 | TC-4.2c | ✅ | `root-line.test.ts:62` — browse always visible |
| AC-4.3 | TC-4.3a | ✅ | `session.test.ts:318` + `root-line.test.ts:71` |
| AC-4.3 | TC-4.3b | ✅ | `session.test.ts:344` — no duplicate |
| AC-4.4 | TC-4.4a | ✅ | `clipboard.test.ts:21` + `root-line.test.ts:79` |
| AC-4.5 | TC-4.5a | ✅ | `root-line.test.ts:87` — onRefresh called |
| AC-4.5 | TC-4.5b | ✅ | `root-line.test.ts:95` — expand state preserved |
| AC-4.6 | TC-4.6a | ✅ | `root-line.test.ts:104` — action classes present |
| AC-4.6 | TC-4.6b | ✅ | `root-line.test.ts:114` — browse not null |

### Flow 5: File Tree

| AC | TC | Status | Evidence |
|----|-----|--------|----------|
| AC-5.1 | TC-5.1a | ✅ | `tree.test.ts:33` — only .md files |
| AC-5.1 | TC-5.1b | ✅ | `tree.test.ts:50` — empty dir hidden |
| AC-5.1 | TC-5.1c | ✅ | `tree.test.ts:62` — nested dir shown |
| AC-5.1 | TC-5.1d | ✅ | `tree.test.ts:76` — mixed dir filtered |
| AC-5.1 | TC-5.1e | ✅ | `tree.test.ts:95` — .MD, .Markdown, .md all included |
| AC-5.1 | TC-5.1f | ✅ | `tree.test.ts:110` — .hidden.md excluded |
| AC-5.1 | TC-5.1g | ✅ | `tree.test.ts:122` — .mdx excluded |
| AC-5.1 | TC-5.1h | ✅ | `tree.test.ts:134` — symlink path preserved, not resolved target |
| AC-5.2 | TC-5.2a | ✅ | `file-tree.test.ts:38` |
| AC-5.2 | TC-5.2b | ✅ | `file-tree.test.ts:48` |
| AC-5.2 | TC-5.2c | ✅ | `file-tree.test.ts:63` — per-root expand state |
| AC-5.3 | TC-5.3a | ✅ | `file-tree.test.ts:94` |
| AC-5.3 | TC-5.3b | ✅ | `file-tree.test.ts:105` — leaf dirs expanded |
| AC-5.3 | TC-5.3c | ✅ | `file-tree.test.ts:142` |
| AC-5.3 | TC-5.3d | ✅ | `file-tree.test.ts:153` — 200 dirs in <500ms |
| AC-5.4 | TC-5.4a | ✅ | `tree.test.ts:156` — `[api, Docs, changelog.md, README.md]` |
| AC-5.5 | TC-5.5a | ✅ | `tree.test.ts:171` + `file-tree.test.ts:165` |
| AC-5.6 | TC-5.6a | ✅ | `file-tree.test.ts:177` — overflow-y: auto |
| AC-5.7 | TC-5.7a | ✅ | `file-tree.test.ts:195` — fresh state has empty expandedDirsByRoot |

### Flow 6: Context Menus

| AC | TC | Status | Evidence |
|----|-----|--------|----------|
| AC-6.1 | TC-6.1a | ✅ | `context-menu.test.ts:75` — Copy Path shown |
| AC-6.1 | TC-6.1b | ✅ | `context-menu.test.ts:87` — copies full path |
| AC-6.2 | TC-6.2a | ✅ | `context-menu.test.ts:97` — 3 items for directory |
| AC-6.2 | TC-6.2b | ✅ | `context-menu.test.ts:111` — Make Root calls onMakeRoot |
| AC-6.2 | TC-6.2c | ✅ | `context-menu.test.ts:122` — Save as Workspace calls onSaveAsWorkspace |
| AC-6.3 | TC-6.3a | ✅ | `context-menu.test.ts:133` — menu removed after action |
| AC-6.3 | TC-6.3b | ✅ | `context-menu.test.ts:146` — menu removed on outside click |
| AC-6.3 | TC-6.3c | ✅ | `context-menu.test.ts:159` — menu removed on Escape |

### Flow 7: Theme System

| AC | TC | Status | Evidence |
|----|-----|--------|----------|
| AC-7.1 | TC-7.1a | ✅ | `menu-bar.test.ts:157` — 4 themes listed |
| AC-7.1 | TC-7.1b | ✅ | `menu-bar.test.ts:173` — checkmark on current |
| AC-7.2 | TC-7.2a | ✅ | `menu-bar.test.ts:185` — onSetTheme called with theme id |
| AC-7.2 | TC-7.2b | ✅ | `menu-bar.test.ts:194` — immediate update; `index.html:7-11` — blocking localStorage read |
| AC-7.3 | TC-7.3a | ✅ | `session.test.ts:389` — theme persists across reload |
| AC-7.4 | TC-7.4a | ✅ | `menu-bar.test.ts:213` — 5th theme renders without code changes |

### Flow 8: Session Persistence

| AC | TC | Status | Evidence |
|----|-----|--------|----------|
| AC-8.1 | TC-8.1a | ✅ | `session.test.ts:409` — insertion order preserved across reload |
| AC-8.2 | TC-8.2a | ✅ | `session.test.ts:436` — root restored |
| AC-8.2 | TC-8.2b | ✅ | `session.test.ts:458` — stale root healed to null, file rewritten |
| AC-8.3 | TC-8.3a | ✅ | `session.test.ts:499` + `app.test.ts:142` |
| AC-8.3 | TC-8.3b | ✅ | `session.test.ts:521` + `session.service.test.ts:31` — stale file removed |
| AC-8.4 | TC-8.4a | ✅ | Covered by TC-7.3a |
| AC-8.5 | TC-8.5a | ✅ | Covered by TC-3.1c |

### Flow 9: Folder Selection

| AC | TC | Status | Evidence |
|----|-----|--------|----------|
| AC-9.1 | TC-9.1a | ✅ | `sidebar-tree.test.ts:77` — browse icon triggers onBrowse |
| AC-9.1 | TC-9.1b | ✅ | `menu-bar.test.ts:106` — File → Open Folder triggers browse |
| AC-9.1 | TC-9.1c | ✅ | `content-area.test.ts:26` — empty state Open Folder triggers browse |
| AC-9.1 | TC-9.1d | ✅ | `keyboard.test.ts:52` — Cmd+Shift+O fires action |
| AC-9.2 | TC-9.2a | ✅ | `tree.test.ts:188` — 500 files in <2s |
| AC-9.2 | TC-9.2b | ✅ | `tree.service.test.ts:61` — 2000 files completes |

### Flow 10: Error Handling

| AC | TC | Status | Evidence |
|----|-----|--------|----------|
| AC-10.1 | TC-10.1a | ✅ | `tree.test.ts:213` (403) + `app.test.ts:203` + `error-notification.test.ts:12` |
| AC-10.2 | TC-10.2a | ⚠️ **Partial** | Error shown ✅, tree clears ✅, root-line invalid state ❌ (see M1) |
| AC-10.3 | TC-10.3a | ✅ | `tree.test.ts:247` — symlink loop skipped, rest renders |
| AC-10.3 | TC-10.3b | ✅ | `tree.test.ts:263` — broken symlink skipped |

---

## API Endpoint Verification

All 11 endpoints from the epic's data contracts table are implemented:

| # | Method | Path | Implemented | Tested | Matches Contract |
|---|--------|------|:-----------:|:------:|:----------------:|
| 1 | GET | /api/session | ✅ | ✅ | ✅ Returns `AppBootstrapResponse`¹ |
| 2 | PUT | /api/session/root | ✅ | ✅ | ✅ |
| 3 | POST | /api/session/workspaces | ✅ | ✅ | ✅ |
| 4 | DELETE | /api/session/workspaces | ✅ | ✅ | ✅ |
| 5 | PUT | /api/session/theme | ✅ | ✅ | ✅ |
| 6 | PUT | /api/session/sidebar | ✅ | ✅ | ✅ |
| 7 | POST | /api/session/recent-files | ✅ | ✅ | ✅ |
| 8 | DELETE | /api/session/recent-files | ✅ | ✅ | ✅ |
| 9 | GET | /api/tree | ✅ | ✅ | ✅ |
| 10 | POST | /api/browse | ✅ | ✅ | ✅ |
| 11 | POST | /api/clipboard | ✅ | ✅ | ✅ |

¹ The epic's API surface table says GET /api/session returns `SessionState`, but the tech design (which is authoritative for implementation) correctly specifies `AppBootstrapResponse` (session + availableThemes). The implementation follows the tech design.

**Error response codes implemented:**

| Status | Code | Implemented | Where |
|--------|------|:-----------:|-------|
| 400 | INVALID_PATH | ✅ | Zod validation rejects non-absolute paths |
| 400 | INVALID_ROOT | ✅ | `tree.ts:29` — relative root rejected |
| 400 | INVALID_THEME | ✅ | `session.ts:131` — unknown theme rejected |
| 403 | PERMISSION_DENIED | ✅ | `session.ts:63`, `tree.ts:38` |
| 404 | PATH_NOT_FOUND | ✅ | `session.ts:72`, `tree.ts:43` |
| 500 | SCAN_ERROR | ✅ | `tree.ts:48` |

---

## Architecture Alignment

### File Structure

All 37 source files from the tech design are present. One additional file exists (`server/utils/errors.ts`) that was part of the tech design but listed separately. One planned file is absent:

| File | Status | Note |
|------|--------|------|
| `client/router.ts` | Absent | Functionality absorbed into `app.ts` (see m1) |

### Module Responsibilities

All modules match their documented responsibilities. The dependency graph follows the tech design: routes → services → fs boundary (server); app → api boundary (client). No unexpected cross-layer dependencies.

### Mock Boundaries

| Boundary | Documented | Actual |
|----------|-----------|--------|
| `node:fs/promises` | Mock in tests | Real filesystem with temp dirs — **stronger** |
| `node:child_process` | Mock in tests | Mocked via injected runner ✅ |
| `client/api.ts` | Mock in client tests | Mocked via `vi.doMock` ✅ |
| `navigator.clipboard` | Mock in client tests | Not directly tested (clipboard util is thin) |

Note: Server tests use **real filesystem** with temp directories instead of mocking `fs`. This is a deliberate improvement over the test plan's mock-heavy approach — tests verify actual I/O behavior including atomic writes, directory creation, and file persistence.

---

## Cross-Cutting Concerns

### Theme Persistence End-to-End ✅

1. **Server**: Session stores `theme` in `session.json` via atomic write
2. **Client bootstrap**: `app.ts:38` applies theme from bootstrap response
3. **Optimistic update**: `app.ts:145` applies theme to DOM before API round-trip
4. **Rollback on failure**: `app.ts:149` reverts to previous theme if API fails
5. **Flash prevention**: `index.html:7-11` blocking `<script>` reads `localStorage` before first paint
6. **localStorage sync**: `app.ts:16` writes to `localStorage` on every theme change
7. **CSS**: `themes.css` defines all 4 themes via `[data-theme]` attribute selectors

### Sidebar State ✅

- **Workspace collapse**: Persisted via `PUT /api/session/sidebar` → server writes to disk
- **Sidebar visibility**: Client-only `sidebarVisible` state (Cmd+B toggle), not persisted — correct per spec
- These are correctly separate concerns: workspaces collapse is user preference (persists), sidebar toggle is session-transient

### Tree Expand State ✅

- `expandedDirsByRoot: Record<string, string[]>` — per-root expand tracking
- Preserved when switching between roots (TC-5.2c)
- Reset on app restart (TC-5.7a) — `expandedDirsByRoot` starts as `{}`
- Not sent to server — purely client state

### All 4 Folder Entry Points ✅

All converge on the same `browseForFolder()` → `api.browse()` → `switchRoot()` flow:

1. **Root line browse icon**: `sidebar.ts` → `onBrowse` → `browseForFolder`
2. **File → Open Folder**: `menu-bar.ts` → `actions.onBrowse` → `browseForFolder`
3. **Content area Open Folder**: `content-area.ts` → `actions.onBrowse` → `browseForFolder`
4. **Cmd+Shift+O**: `app.ts:278-285` → `browseForFolder`

---

## Test Quality Assessment

### Strengths

1. **Real filesystem tests**: Server tests create actual directories, write real files, create symlinks, and set permissions. This catches real I/O issues that mocked tests would miss.

2. **Session round-trip verification**: Tests verify both the API response AND the persisted file on disk (e.g., `session.test.ts:471-474` — checks both response and `readSessionFile(sessionDir)`).

3. **Atomic write verification**: `session.test.ts:589-613` verifies writeFile→rename ordering with call order assertions.

4. **Full component interaction**: Context menu tests mount the file tree + context menu together, right-click actual nodes, and verify the full interaction chain.

5. **Integration tests in `app.test.ts`**: Full bootstrap → mount → interact flows with mocked API, verifying components work together.

6. **Temp dir cleanup**: Consistent `afterEach` cleanup prevents test pollution.

### Limitations

1. **Visual behavior untestable in JSDOM**: Hover reveal (TC-4.6a), CSS truncation (TC-3.2c), and scroll behavior (TC-5.6a) can only verify classes/styles are set — actual rendering requires browser tests. This is an inherent JSDOM limitation, not a test deficiency.

2. **TC-10.3b proxy**: Special files test uses a broken symlink as a proxy for sockets/devices, since creating actual special files in tests is impractical. Reasonable compromise.

3. **Some tests verify class names rather than behavior**: e.g., `workspaces.test.ts:117` checks that `.workspace-entry__remove` class exists, but doesn't verify hover-triggered visibility (a CSS concern).

### Test Count

| Test File | Planned | Actual | Delta |
|-----------|:-------:|:------:|:-----:|
| server/routes/session.test.ts | 28 | 27 | -1 |
| server/routes/tree.test.ts | 17 | 18 | +1 |
| server/routes/browse.test.ts | 4 | 4 | 0 |
| server/routes/clipboard.test.ts | 3 | 3 | 0 |
| server/services/session.service.test.ts | 4 | 5 | +1 |
| server/services/tree.service.test.ts | 3 | 3 | 0 |
| client/components/menu-bar.test.ts | 17 | 17 | 0 |
| client/components/workspaces.test.ts | 8 | 9 | +1 |
| client/components/root-line.test.ts | 10 | 10 | 0 |
| client/components/file-tree.test.ts | 11 | 13 | +2 |
| client/components/context-menu.test.ts | 9 | 9 | 0 |
| client/components/content-area.test.ts | 5 | 6 | +1 |
| client/components/error-notification.test.ts | 5 | 5 | 0 |
| client/state.test.ts | 3 | 3 | 0 |
| client/utils/keyboard.test.ts | 5 | 5 | 0 |
| **Subtotal (planned files)** | **132** | **137** | **+5** |
| client/app.test.ts (new) | — | 12 | +12 |
| client/components/sidebar-tree.test.ts (new) | — | 5 | +5 |
| smoke.test.ts (new) | — | 1 | +1 |
| utils/tmp.ts (test utility) | — | — | — |
| **Grand total** | **132** | **156** | **+24** |

The surplus tests are valuable: `app.test.ts` provides integration coverage that unit tests can't, and `sidebar-tree.test.ts` tests the Expand All/Collapse All wiring through the sidebar container.

---

## Summary

| Category | Count |
|----------|:-----:|
| Critical issues | 0 |
| Major issues | 2 |
| Minor issues | 9 |
| ACs fully passing | 42/43 |
| ACs partially passing | 1 (AC-10.2) |
| API endpoints complete | 11/11 |
| Tests passing | 156/156 |

The implementation is production-quality for Epic 1's scope. The two major issues (M1: root-line invalid state, M2: shared/types value export) should be addressed before the milestone ships. The minor issues are style/structure deviations that don't affect functionality.
