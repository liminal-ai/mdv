# Test Plan: Epic 6 — Hardening and Electron Wrapper

## Mock Strategy

### Server Tests

Server tests use Fastify's `inject()` for route testing. Mock boundaries:

| Boundary | Mock? | Why |
|----------|-------|-----|
| Filesystem (`fs/promises`) | Yes | Control file existence, permissions, symlinks, timing |
| `child_process` (osascript) | Yes | No real dialogs in tests |
| SessionService internals | No | Exercise real service logic through routes |
| Tree scan recursion | No | Exercise real scan with mocked filesystem |

### Client Tests

Client tests use JSDOM for component testing. Mock boundaries:

| Boundary | Mock? | Why |
|----------|-------|-----|
| API client (`api.ts`) | Yes | Control server responses |
| WebSocket | Yes | Control file change events |
| `window.electron` (IPC bridge) | Yes | Simulate Electron environment |
| CodeMirror | Yes | Needs real browser DOM for rendering |
| Mermaid.js | Yes | Needs real SVG rendering |
| Store / state | No | Exercise real state management |
| DOM manipulation | No | Exercise real rendering via JSDOM |

### Electron Tests

Electron main process tests mock Electron APIs:

| Boundary | Mock? | Why |
|----------|-------|-----|
| `electron` module (BrowserWindow, Menu, app, ipcMain) | Yes | No real Electron runtime in test |
| `startServer()` | Yes | Don't start real Fastify in Electron tests |
| `electron-window-state` | Yes | Don't read/write real window state files |
| Filesystem | Yes | Control file existence for open-file handler |

---

## Test Fixtures

### `tests/fixtures/large-files.ts`

```typescript
export function generateLargeMarkdown(lines: number): string {
  // Generates a realistic markdown document with headings, paragraphs,
  // code blocks, tables, and Mermaid blocks distributed throughout
}

export const LARGE_FILE_10K = generateLargeMarkdown(10_000);
export const LARGE_FILE_WITH_MERMAID = generateLargeMarkdown(10_000); // includes 5 mermaid blocks
```

### `tests/fixtures/large-trees.ts`

```typescript
export function generateTreeNodes(fileCount: number, maxDepth: number): TreeNode[] {
  // Generates a realistic tree structure with the given number of markdown files
  // spread across directories up to maxDepth levels deep
}

export const TREE_1500_FILES = generateTreeNodes(1500, 10);
export const TREE_WITH_SYMLINK_LOOP: TreeNode[] = [ /* ... */ ];
export const TREE_WITH_BROKEN_SYMLINKS: TreeNode[] = [ /* ... */ ];
export const TREE_WITH_PERMISSION_ERRORS: TreeNode[] = [ /* ... */ ];
```

### `tests/fixtures/electron-mocks.ts`

```typescript
export function createMockBrowserWindow(): MockBrowserWindow { /* ... */ }
export function createMockIpcMain(): MockIpcMain { /* ... */ }
export function createMockApp(): MockApp { /* ... */ }
export function createMockMenu(): MockMenu { /* ... */ }
```

### `tests/fixtures/persisted-tabs.ts`

```typescript
export const PERSISTED_TABS_CLEAN: PersistedTab[] = [
  { path: '/docs/readme.md', mode: 'render' },
  { path: '/docs/spec.md', mode: 'edit' },
  { path: '/docs/design.md', mode: 'render', scrollPosition: 450 },
];

export const PERSISTED_TABS_WITH_MISSING: PersistedTab[] = [
  { path: '/docs/readme.md', mode: 'render' },
  { path: '/docs/deleted.md', mode: 'render' },  // this file doesn't exist
  { path: '/docs/spec.md', mode: 'edit' },
];

export const LEGACY_OPEN_TABS: string[] = [
  '/docs/readme.md',
  '/docs/spec.md',
];
```

---

## TC → Test Mapping

### Server Tests

#### `tests/server/schemas/persisted-tab.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-11.1a | TC-11.1a: PersistedTab schema accepts object shape | Parse `{ path, mode }` | Validates successfully |
| TC-11.1a | TC-11.1a: Legacy string shape transforms to PersistedTab | Parse plain string path | Transforms to `{ path, mode: 'render' }` |
| TC-11.1c | TC-11.1c: PersistedTab preserves mode field | Parse `{ path, mode: 'edit' }` | Mode is 'edit' in output |
| — | Schema rejects invalid mode | Parse `{ path, mode: 'invalid' }` | Validation fails |

#### `tests/server/routes/session-tabs.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-11.1a | TC-11.1a: PUT /api/session/tabs accepts PersistedTab array | Inject PUT with PersistedTab[] | 200, session.openTabs has objects |
| TC-11.3a | TC-11.3a: tabs persist through crash recovery | Write tabs, reload session | Tabs present in loaded session |
| TC-11.2a | TC-11.2a: persisted tabs load from disk after discard-quit | Write 5 tabs, simulate restart | All 5 tabs in session, no dirty state |

#### `tests/server/services/session-load.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-11.1d | TC-11.1d: session load preserves tabs for missing files | Session has tab for nonexistent path | All tabs returned — no healing/removal |
| — | Session load preserves activeTab even if file missing | Active tab path deleted | activeTab unchanged in session response |

#### `tests/server/routes/tree-hardening.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-2.1a | TC-2.1a: tree scan completes for 1500 files | Mock fs with 1500 .md files | Returns full tree within test timeout |
| TC-5.2a | TC-5.2a: symlink loop detected and skipped | Mock fs with a → b → a loop | Tree returned without infinite recursion |
| TC-5.2b | TC-5.2b: broken symlink excluded | Mock fs with broken symlink | Symlink not in tree, no error |
| TC-5.2c | TC-5.2c: symlink outside root uses symlink path | Mock fs with symlink to external file | Tree entry uses symlink path |
| TC-5.1a | TC-5.1a: unreadable .md file appears in tree | Mock EACCES on stat for one file | File in tree (click produces 403) |
| TC-5.1b | TC-5.1b: unreadable directory skipped silently | Mock EACCES on readdir | Directory skipped, no error response |
| TC-5.3a | TC-5.3a: tree scan timeout returns 500 SCAN_ERROR with timeout flag | Mock fs with 100ms delay per readdir | 500 with `timeout: true` in error body |
| TC-5.3b | TC-5.3b: slow file read shows timeout error | Mock fs.readFile with 15s delay | File read request times out, error shown |
| TC-5.3c | TC-5.3c: filesystem disconnect produces error | Mock fs that throws ENETUNREACH | Error response, no hang |
| TC-5.4a | TC-5.4a: deep nesting (50+ levels) handled | Mock fs 60 levels deep | Tree returned, no stack overflow |
| TC-13.1b | TC-13.1b: tree timeout shows retry prompt | Mock slow fs exceeding 10s | 500 SCAN_ERROR with `timeout: true`, client shows retry |

### Client Tests

#### `tests/client/components/chunked-render.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-1.1a | TC-1.1a: large HTML renders without blocking | Call renderChunked with 10K-element HTML | onComplete fires, DOM has all elements |
| TC-1.1a | TC-1.1a: loading indicator animates during render | Mock rAF, check between batches | Loading indicator visible during insertion |
| TC-1.1b | TC-1.1b: scroll works during chunked render | Insert partial batch, dispatch scroll | Scroll event fires, no error |
| TC-1.2b | TC-1.2b: mode switch uses chunked render for large files | Trigger mode switch with large HTML | renderChunked called, not innerHTML |
| — | Abort cancels remaining batches | Call renderChunked, abort mid-way | Insertion stops, no error |
| — | Small documents use direct innerHTML | Call with 100-element HTML | innerHTML set directly, not chunked |

#### `tests/client/components/mermaid-cache.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-6.1a | TC-6.1a: cache hit on tab switch | Set cache entry, get with same key | Returns cached SVG |
| TC-6.1b | TC-6.1b: cache hit on mode switch | Set entry, get after mode round-trip | Returns cached SVG |
| TC-6.1c | TC-6.1c: cache miss after source change | Set entry, get with different source hash | Returns null |
| TC-6.2a | TC-6.2a: theme change misses cache | Set entry for light theme, get for dark | Returns null (different themeId) |
| TC-6.2b | TC-6.2b: switch back hits cache | Set light entry, set dark entry, get light | Returns light SVG |
| TC-6.3a | TC-6.3a: LRU eviction at max entries | Fill cache to 200, add one more | Oldest entry evicted |
| TC-6.3b | TC-6.3b: invalidateForTab removes entries | Set entries, call invalidateForTab | Entries removed |
| — | FNV-1a hash produces consistent keys | Hash same string twice | Same result |
| — | Different strings produce different hashes | Hash 'flowchart LR' vs 'sequenceDiagram' | Different results |

#### `tests/client/components/virtual-tree.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-2.1a | TC-2.1a: virtual tree renders only visible rows | Set 1500 nodes, viewport fits 30 | DOM has ~70 elements (30 + overscan) |
| TC-2.1b | TC-2.1b: expand all with virtual tree | Set 1500 nodes, expand all | Spacer height updates, only visible rows render |
| TC-2.1c | TC-2.1c: scroll updates visible rows | Set nodes, scroll to middle | DOM elements change to middle-range nodes |
| TC-2.2a | TC-2.2a: count badges render per row | Set nodes with mdCount | Visible rows show count badges |
| — | Resize updates visible row count | Resize container | More/fewer rows rendered |
| — | Keyboard navigation scrolls to focused row | Arrow key past viewport | Container scrolls, focused row visible |

#### `tests/client/components/tab-restore.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-11.1a | TC-11.1a: tabs restored from PersistedTab array | Bootstrap with 5 persisted tabs | 5 tabs in store, correct active tab |
| TC-11.1b | TC-11.1b: active tab loads eagerly, others lazy | Bootstrap with 10 tabs | Active tab has content loaded, others have loading=true |
| TC-11.1c | TC-11.1c: per-tab mode restored | Bootstrap with tabs in mixed modes | Tab modes match persisted values |
| TC-11.1d | TC-11.1d: missing file tab shows error state | Bootstrap with tab for deleted file | Tab has status='deleted' after load attempt |
| TC-11.2a | TC-11.2a: all tabs restored after discard-quit | Bootstrap with 5 tabs (none dirty) | All 5 tabs present, no dirty indicators |
| TC-11.3b | TC-11.3b: tabs restored after browser tab close | Bootstrap with persisted tabs | Tabs present (persisted on every open/close) |
| — | Legacy string tabs normalized to PersistedTab | Bootstrap with string[] openTabs | Tabs have default mode |

#### `tests/client/components/many-tabs.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-3.1a | TC-3.1a: tab switch with 25 tabs | Create 25 tabs in store, switch | Switch completes, active tab content shown |
| TC-3.1b | TC-3.1b: open 21st tab | Create 20 tabs, open another | 21 tabs in store, new tab active |
| TC-3.1c | TC-3.1c: tab strip with 30 tabs | Create 30 tabs, render tab strip | Tab count shows "30 tabs", strip scrollable |
| TC-3.2a | TC-3.2a: memory released on tab close | Create 25 tabs, close 20 | Store has 5 tabs, closed tab state garbage-collected |
| TC-3.2b | TC-3.2b: file watchers released on tab close | Create 25 tabs (mock ws), close 20 | 20 unwatch messages sent |

#### `tests/client/components/startup.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-4.1a | TC-4.1a: browser app ready within startup budget | Bootstrap app, measure time | App interactive (assertions pass without timeout) |
| TC-4.1c | TC-4.1c: startup with 10 restored tabs | Bootstrap with 10 persisted tabs | Tab strip shows 10 tabs, active tab loaded |

### Electron Tests

#### `tests/electron/main.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-7.1a | TC-7.1a: Fastify starts in-process | Mock startServer, call main | startServer called with openUrl noop |
| TC-7.1b | TC-7.1b: dynamic port on conflict | Mock startServer returns port 3456 | BrowserWindow loads localhost:3456 |
| TC-7.1c | TC-7.1c: window hidden until ready | Mock BrowserWindow | show:false in options, show() called on ready-to-show |
| TC-7.2a | TC-7.2a: single-instance lock | Mock requestSingleInstanceLock → false | app.quit() called |
| TC-7.2b | TC-7.2b: second instance routes file | Mock second-instance event with .md path | open-file sent to existing window |
| TC-13.2a | TC-13.2a: server start failure shows error | Mock startServer throws | Window shows error content |

#### `tests/electron/window.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-7.3a | TC-7.3a: window state persisted | Mock windowStateKeeper | manage() called on window |
| TC-7.3b | TC-7.3b: off-screen window resets position | Mock state with off-screen coords, mock displays | Window created without saved x/y |

#### `tests/electron/menu.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-8.1a | TC-8.1a: File menu has correct items | Build menu, inspect template | Open File, Open Folder, Save, Save As, Close Tab present |
| TC-8.1b | TC-8.1b: Export menu disabled without document | Build menu with hasDocument=false | Export items disabled |
| TC-8.1c | TC-8.1c: View menu has theme submenu | Build menu, inspect | 4 themes listed |
| TC-8.1d | TC-8.1d: App menu has standard items | Build menu, inspect | About, Hide, Quit present |
| TC-8.1e | TC-8.1e: menu action sends IPC | Click menu item | webContents.send called with correct action |
| TC-8.2a | TC-8.2a: Export disabled synced from state | Send state with hasDocument=false | Menu rebuilt, Export items disabled |
| TC-8.2b | TC-8.2b: Save reflects dirty state | Send state with activeTabDirty=false | Save item disabled |
| TC-8.2c | TC-8.2c: Save enabled when dirty | Send state with activeTabDirty=true | Save item enabled |
| TC-8.2d | TC-8.2d: theme checkmark | Send state with activeTheme='dark-cool' | dark-cool checked, others unchecked |

#### `tests/electron/ipc.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-10.1a | TC-10.1a: quit via Cmd+Q sends request to renderer | Trigger close event | quit-request sent to webContents |
| TC-10.1b | TC-10.1b: quit via window close button sends request | Trigger close via traffic light | Same quit-request behavior as Cmd+Q |
| TC-10.1c | TC-10.1c: quit-confirmed closes window | Send quit-confirmed | win.close() called |
| TC-10.1d | TC-10.1d: discard-all-and-quit closes window | Send quit-confirmed after discard | win.close() called, no saves |
| TC-10.1e | TC-10.1e: quit-cancelled keeps window | Send quit-cancelled | Window still open |
| TC-10.1f | TC-10.1f: clean quit skips modal | No dirty tabs, trigger close | quit-request sent, renderer confirms immediately |

#### `tests/electron/file-handler.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-9.2a | TC-9.2a: file queued before window ready | Fire open-file before did-finish-load | Path queued, sent after load |
| TC-9.2b | TC-9.2b: file opens in running app | Fire open-file after load | open-file sent to renderer immediately |
| TC-9.2c | TC-9.2c: dock drag opens file | Fire open-file event | Same handler as 9.2b |
| TC-9.2d | TC-9.2d: already-open file activates tab | Fire open-file for open path | IPC sent, client handles dedup |
| TC-9.2e | TC-9.2e: file open during tab restore | Fire open-file, then did-finish-load | Restore runs first, then open-file |

#### `tests/electron/detection.test.ts`

| TC | Test Name | Setup | Assert |
|----|-----------|-------|--------|
| TC-8.3a | TC-8.3a: HTML menu bar hidden in Electron | Set location.search='?electron=1', bootstrap | body has 'electron' class, #menu-bar display:none |
| TC-8.3b | TC-8.3b: HTML menu bar visible in browser | Set location.search='', bootstrap | body lacks 'electron' class, #menu-bar visible |

---

## Test Count Summary

| Test File | TC Tests | Non-TC Tests | Total |
|-----------|----------|--------------|-------|
| persisted-tab.test.ts | 3 | 1 | 4 |
| session-tabs.test.ts | 3 | 0 | 3 |
| session-load.test.ts | 1 | 1 | 2 |
| tree-hardening.test.ts | 11 | 0 | 11 |
| chunked-render.test.ts | 4 | 2 | 6 |
| mermaid-cache.test.ts | 7 | 2 | 9 |
| virtual-tree.test.ts | 4 | 2 | 6 |
| tab-restore.test.ts | 6 | 1 | 7 |
| many-tabs.test.ts | 5 | 0 | 5 |
| startup.test.ts | 2 | 0 | 2 |
| main.test.ts | 6 | 0 | 6 |
| window.test.ts | 2 | 0 | 2 |
| menu.test.ts | 9 | 0 | 9 |
| ipc.test.ts | 6 | 0 | 6 |
| file-handler.test.ts | 5 | 0 | 5 |
| detection.test.ts | 2 | 0 | 2 |
| **Total** | **77** | **8** | **85** |

### TC Coverage Verification

All 80 TCs from the epic are mapped to at least one test. TCs not individually listed above are covered by composite tests (e.g., TC-4.1b Electron startup is tested via main.test.ts TC-7.1a which verifies the startup sequence including timing). TC-9.1a/b (file association registration) and TC-9.3a (stable bundle ID), TC-12.1a/b (install script), TC-12.2a–c (bundle ID, ad-hoc signature, Intel), and TC-12.3a/b (data directory) are packaging/installation TCs that are verified manually, not via automated tests — they require a real macOS environment with Finder, Launch Services, and code signing inspection.

**Manual-only TCs:**

| TC | Reason |
|----|--------|
| TC-9.1a, TC-9.1b | File association requires real macOS Launch Services |
| TC-9.3a | Bundle ID inspection requires real .app bundle |
| TC-12.1a, TC-12.1b | Install script requires real build + filesystem |
| TC-12.2a, TC-12.2b, TC-12.2c | Code signing requires real codesign + Gatekeeper |
| TC-12.3a, TC-12.3b | Data directory sharing requires real app launch in both modes |
| TC-13.2b | Server crash recovery requires real Fastify lifecycle |
| TC-1.1c | Progressive Mermaid rendering in large docs — visual verification |
| TC-1.2a | Typing latency measurement — requires real CodeMirror in real browser |

---

## Verification Scripts

Epic 6 uses the same verification pipeline established in Epics 1–5:

```json
{
  "red-verify": "npm run format:check && npm run lint && npm run typecheck",
  "verify": "npm run format:check && npm run lint && npm run typecheck && npm run test",
  "green-verify": "npm run verify && npm run guard:no-test-changes",
  "verify-all": "npm run verify && npm run test:electron",
  "build": "npm run build:server && npm run build:client",
  "build:electron": "esbuild app/src/electron/main.ts app/src/electron/preload.ts --bundle --platform=node --format=esm --outdir=app/dist/electron --external:electron --external:electron-window-state",
  "test:electron": "vitest run tests/electron/"
}
```

`test:electron` runs Electron-specific tests (main process, window, menu, IPC, file handler) separately from the main test suite. These tests mock Electron APIs and run in Node.js — they don't require a real Electron runtime.

---

## Work Breakdown: Chunks

### Chunk 0: Infrastructure

Types, test fixtures, schema migration, Electron project scaffolding.

- `PersistedTab` type and `LegacyOrPersistedTab` union schema
- `MermaidCacheEntry` type (internal)
- `WindowState` type (Electron)
- `MenuState` interface
- Test fixtures: `large-files.ts`, `large-trees.ts`, `electron-mocks.ts`, `persisted-tabs.ts`
- `tsconfig.electron.json` for Electron main process
- `electron-builder.yml` configuration
- `scripts/install-app.sh`
- `package.json` scripts: `build:electron`, `test:electron`

**Relevant Tech Design Sections:** §Schemas: Extended (API doc), §Packaging and Install (UI doc)
**Non-TC Decided Tests:** Schema validation tests (invalid mode, missing path)
**Exit Criteria:** `npm run typecheck` passes. No tests yet.

### Chunk 1: Server — Schema Migration + Tree Hardening

#### Skeleton

- `SessionService.updateTabs()` updated to accept `PersistedTab[]`
- `PUT /api/session/tabs` request schema updated
- No tab healing — all persisted tabs returned regardless of file existence
- Tree scan: `AbortController` timeout, visited-set loop detection, depth guard

#### TDD Red

| Test File | # Tests | TCs Covered |
|-----------|---------|-------------|
| persisted-tab.test.ts | 4 | TC-11.1a, TC-11.1c |
| session-tabs.test.ts | 3 | TC-11.1a, TC-11.2a, TC-11.3a |
| session-load.test.ts | 2 | TC-11.1d |
| tree-hardening.test.ts | 10 | TC-2.1a, TC-5.1a/b, TC-5.2a/b/c, TC-5.3a/c, TC-5.4a, TC-13.1b |

**Relevant Tech Design Sections:** §PersistedTab Schema Migration (API), §Tab Healing on Load (API), §Tree Scan: Timeout and Edge Case Hardening (API)
**Non-TC Decided Tests:** Schema rejects invalid mode
**Exit Criteria:** `red-verify` passes. 19 new tests ERROR. Existing tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `schemas/index.ts` | Add PersistedTabSchema, LegacyOrPersistedTab union |
| `services/session.service.ts` | Update updateTabs signature (no tab healing) |
| `routes/session.ts` | Update PUT /api/session/tabs request schema |
| Tree scan service | Add AbortController, visited set, depth guard |

**Exit Criteria:** `green-verify` passes. All 19 new tests PASS. No test files modified.

### Chunk 2: Client — Performance (Chunked Render + Virtual Tree + Mermaid Cache)

#### TDD Red

| Test File | # Tests | TCs Covered |
|-----------|---------|-------------|
| chunked-render.test.ts | 6 | TC-1.1a/b, TC-1.2b |
| mermaid-cache.test.ts | 9 | TC-6.1a/b/c, TC-6.2a/b, TC-6.3a/b |
| virtual-tree.test.ts | 6 | TC-2.1a/b/c, TC-2.2a |

**Relevant Tech Design Sections:** §Chunked DOM Insertion (UI), §Mermaid Render Cache (UI), §File Tree Virtualization (UI)
**Non-TC Decided Tests:** Abort cancels batches, small docs use direct innerHTML, FNV-1a consistency, resize handler
**Exit Criteria:** `red-verify` passes. 21 new tests ERROR. Existing + Chunk 1 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `client/components/chunked-render.ts` | requestAnimationFrame batching, abort signal |
| `client/components/mermaid-cache.ts` | LRU cache, FNV-1a, invalidateForTab |
| `client/components/virtual-tree.ts` | Virtual scroller, flat list windowing |
| `client/components/file-tree.ts` | Replace DOM rendering in mountFileTree with VirtualTree.setNodes |
| `client/components/content-area.ts` | Use renderChunked for large HTML |
| `client/components/mermaid-renderer.ts` | Check cache before mermaid.render |

**Exit Criteria:** `green-verify` passes. All 21 new tests PASS.

### Chunk 3: Client — Tab Restore + Many-Tab Performance

#### TDD Red

| Test File | # Tests | TCs Covered |
|-----------|---------|-------------|
| tab-restore.test.ts | 7 | TC-11.1a/b/c/d, TC-11.2a, TC-11.3b |
| many-tabs.test.ts | 5 | TC-3.1a/b/c, TC-3.2a/b |
| startup.test.ts | 2 | TC-4.1a, TC-4.1c |

**Relevant Tech Design Sections:** §Tab Restore on Startup (UI)
**Non-TC Decided Tests:** Legacy string tabs normalized
**Exit Criteria:** `red-verify` passes. 14 new tests ERROR.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `client/app.ts` | Update restoreTabsFromSession for PersistedTab, update syncTabsToSession |
| `client/api.ts` | Update updateTabs to send PersistedTab[] |

**Exit Criteria:** `green-verify` passes. All 14 new tests PASS.

### Chunk 4: Electron Shell + Window Management

#### Skeleton

All Electron files created:
- `electron/main.ts`
- `electron/window.ts`
- `electron/menu.ts`
- `electron/ipc.ts`
- `electron/file-handler.ts`
- `electron/preload.ts`
- `client/utils/electron-bridge.ts`

#### TDD Red

| Test File | # Tests | TCs Covered |
|-----------|---------|-------------|
| main.test.ts | 6 | TC-7.1a/b/c, TC-7.2a/b, TC-13.2a |
| window.test.ts | 2 | TC-7.3a/b |

**Relevant Tech Design Sections:** §Electron Main Process (UI), §Window Management (UI), §Preload Bridge (UI)
**Non-TC Decided Tests:** None
**Exit Criteria:** `red-verify` passes. 8 new tests ERROR.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `electron/main.ts` | App lifecycle, startServer integration, single-instance |
| `electron/window.ts` | BrowserWindow, electron-window-state, display check |
| `electron/preload.ts` | contextBridge with 7 methods |
| `client/utils/electron-bridge.ts` | Type-safe window.electron wrapper |

**Exit Criteria:** `green-verify` passes. All 8 new tests PASS.

### Chunk 5: Native Menu Bar + Quit Flow

#### TDD Red

| Test File | # Tests | TCs Covered |
|-----------|---------|-------------|
| menu.test.ts | 9 | TC-8.1a/b/c/d/e, TC-8.2a/b/c/d |
| ipc.test.ts | 6 | TC-10.1a/b/c/d/e/f |
| detection.test.ts | 2 | TC-8.3a/b |

**Relevant Tech Design Sections:** §Native Menu Bar (UI), §IPC Handler Registration (UI), §Electron Detection (UI), §Client-Side Electron Bridge (UI)
**Non-TC Decided Tests:** None
**Exit Criteria:** `red-verify` passes. 15 new tests ERROR.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `electron/menu.ts` | Menu template, state-update rebuild |
| `electron/ipc.ts` | close event prevention, quit-confirmed/cancelled |
| `client/app.ts` | Electron detection, menu bar hiding, quit modal wiring, state sync subscriber |

**Exit Criteria:** `green-verify` passes. All 15 new tests PASS.

### Chunk 6: File Associations + Packaging + Install

#### TDD Red

| Test File | # Tests | TCs Covered |
|-----------|---------|-------------|
| file-handler.test.ts | 5 | TC-9.2a/b/c/d/e |

**Relevant Tech Design Sections:** §File Association Handler (UI), §Packaging and Install (UI)
**Non-TC Decided Tests:** None
**Exit Criteria:** `red-verify` passes. 5 new tests ERROR.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `electron/file-handler.ts` | open-file event, pending path queue |
| `electron-builder.yml` | File associations, signing, bundle ID |
| `scripts/install-app.sh` | Build + package + copy |

**Exit Criteria:** `green-verify` passes. All 5 new tests PASS.

**Post-Green manual verification:**
- Build the app: `npm run build && npm run build:electron && npx electron-builder --mac --dir`
- Launch from dist: verify window appears, no white flash
- Open a .md file from Finder: verify it opens in the app
- Check bundle ID: `mdls -name kMDItemCFBundleIdentifier dist/electron/mac-arm64/MD\ Viewer.app`
- Check ad-hoc signature: `codesign -v dist/electron/mac-arm64/MD\ Viewer.app`
- Run install script: `bash scripts/install-app.sh`
- Launch from ~/Applications: verify it works

---

## Chunk Dependencies

```
Chunk 0 (Infrastructure)
    ↓
Chunk 1 (Server: schema + tree hardening)
    ↓
Chunk 2 (Client: performance)  ←── independent of Chunk 1 server changes
    ↓                               (can run in parallel if desired)
Chunk 3 (Client: tab restore + many-tab)
    ↓
Chunk 4 (Electron: shell + window)
    ↓
Chunk 5 (Electron: menus + quit)
    ↓
Chunk 6 (Electron: file associations + packaging)
```

Chunks 1 and 2 can run in parallel after Chunk 0. Chunk 3 depends on Chunk 1 (schema migration must be in place for tab restore). Chunks 4–6 are sequential (each builds on the prior Electron infrastructure).

---

## Manual Verification Checklist

After all chunks are complete:

### Performance Hardening
1. [ ] Open a 10,000-line markdown file — renders without freeze, scrolls smoothly
2. [ ] Open the same file in Edit mode — typing is responsive
3. [ ] Point app at a directory with 1,000+ markdown files — tree loads, Expand All works
4. [ ] Open 25 tabs — switching is instant, close tabs and verify memory drops
5. [ ] Open a document with 5 Mermaid diagrams — switch tabs back and forth, diagrams appear instantly from cache
6. [ ] Switch themes with Mermaid document open — diagrams re-render with new theme

### Electron
7. [ ] Launch Electron app — window appears without white flash
8. [ ] Verify native menu bar: File, Export, View menus present with correct items
9. [ ] Verify HTML menu bar is hidden
10. [ ] Open File from native menu — folder picker works
11. [ ] Edit a file, verify Save menu item enables when dirty
12. [ ] Switch theme from View menu — theme changes, checkmark updates
13. [ ] Quit with dirty tabs — custom modal appears with file list
14. [ ] Save All and Quit — files saved, app quits
15. [ ] Double-click a .md file in Finder — opens in running app
16. [ ] Quit and relaunch — tabs restored with correct modes
17. [ ] Resize window, quit, relaunch — window at same position/size
18. [ ] Launch a second instance — first instance focused, no second window
