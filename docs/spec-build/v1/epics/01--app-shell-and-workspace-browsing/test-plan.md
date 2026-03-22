# Test Plan: Epic 1 — App Shell and Workspace Browsing

**Parent:** [epic-1-tech-design.md](epic-1-tech-design.md)
**Companion:** [epic-1-tech-design-api.md](epic-1-tech-design-api.md) · [epic-1-tech-design-ui.md](epic-1-tech-design-ui.md)

This document maps every TC from the epic to a test, defines the mock strategy, lists test fixtures, specifies verification scripts, and breaks work into chunks with test counts.

---

## Mock Strategy

### Server Tests

Test at the route handler level using Fastify's `inject()`. Mock at the filesystem boundary.

| Layer | Mock? | Why |
|-------|-------|-----|
| Route handlers (`server/routes/*`) | **Test here** | Entry point — tests the full request/response cycle |
| Services (`server/services/*`) | Don't mock | Exercised through route handlers |
| `node:fs/promises` | **Mock** | External boundary — filesystem |
| `node:child_process` | **Mock** | External boundary — osascript, pbcopy |
| Zod schemas | Don't mock | Part of the validation pipeline being tested |

Test app setup:

```typescript
import { buildApp } from '../../src/server/app.js';
import { vi } from 'vitest';

// Mock filesystem
vi.mock('node:fs/promises');
vi.mock('node:fs');

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildApp({ sessionDir: '/tmp/test-session' });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});
```

### Client Tests

Test components using JSDOM. Mock at the API client boundary.

| Layer | Mock? | Why |
|-------|-------|-----|
| Components (`client/components/*`) | **Test here** | Entry point — tests DOM rendering and interaction |
| State store (`client/state.ts`) | Don't mock | Exercised through components |
| API client (`client/api.ts`) | **Mock** | External boundary — server calls |
| DOM / JSDOM | Don't mock | That's what we're testing |
| `navigator.clipboard` | Mock | Browser API, not available in JSDOM |

Test setup:

```typescript
import { vi } from 'vitest';

// Mock API client
vi.mock('../../src/client/api.js', () => ({
  api: {
    bootstrap: vi.fn(),
    setRoot: vi.fn(),
    addWorkspace: vi.fn(),
    removeWorkspace: vi.fn(),
    setTheme: vi.fn(),
    updateSidebar: vi.fn(),
    touchRecentFile: vi.fn(),
    removeRecentFile: vi.fn(),
    getTree: vi.fn(),
    browse: vi.fn(),
    copyToClipboard: vi.fn(),
  },
}));
```

---

## Test Fixtures: `tests/fixtures/`

### `session.ts`

```typescript
import type { SessionState } from '../../src/shared/types.js';

export const emptySession: SessionState = {
  workspaces: [],
  lastRoot: null,
  recentFiles: [],
  theme: 'light-default',
  sidebarState: { workspacesCollapsed: false },
};

export const populatedSession: SessionState = {
  workspaces: [
    { path: '/Users/leemoore', label: 'leemoore', addedAt: '2026-03-01T00:00:00Z' },
    { path: '/Users/leemoore/code/liminal', label: 'liminal', addedAt: '2026-03-02T00:00:00Z' },
    { path: '/Users/leemoore/code', label: 'code', addedAt: '2026-03-03T00:00:00Z' },
  ],
  lastRoot: '/Users/leemoore/code',
  recentFiles: [
    { path: '/Users/leemoore/code/README.md', openedAt: '2026-03-19T00:00:00Z' },
  ],
  theme: 'dark-default',
  sidebarState: { workspacesCollapsed: false },
};

export const corruptedSessionJson = '{ "workspaces": [, invalid }';

export const sessionWithDeletedRoot: SessionState = {
  ...populatedSession,
  lastRoot: '/nonexistent/path',
};
```

### `tree.ts`

```typescript
import type { TreeNode } from '../../src/shared/types.js';

export const simpleTree: TreeNode[] = [
  {
    name: 'docs',
    path: '/root/docs',
    type: 'directory',
    mdCount: 3,
    children: [
      { name: 'getting-started.md', path: '/root/docs/getting-started.md', type: 'file' },
      { name: 'api-reference.md', path: '/root/docs/api-reference.md', type: 'file' },
      {
        name: 'guides',
        path: '/root/docs/guides',
        type: 'directory',
        mdCount: 1,
        children: [
          { name: 'setup.md', path: '/root/docs/guides/setup.md', type: 'file' },
        ],
      },
    ],
  },
  { name: 'README.md', path: '/root/README.md', type: 'file' },
];

export const emptyTree: TreeNode[] = [];

export const largeTree: TreeNode[] = generateLargeTree(200); // 200 directories with .md files

function generateLargeTree(dirCount: number): TreeNode[] {
  return Array.from({ length: dirCount }, (_, i) => ({
    name: `dir-${i}`,
    path: `/root/dir-${i}`,
    type: 'directory' as const,
    mdCount: 2,
    children: [
      { name: `doc-${i}-a.md`, path: `/root/dir-${i}/doc-${i}-a.md`, type: 'file' as const },
      { name: `doc-${i}-b.md`, path: `/root/dir-${i}/doc-${i}-b.md`, type: 'file' as const },
    ],
  }));
}
```

### `fs.ts`

```typescript
// Mock filesystem structures for tree service tests

export const simpleFsStructure = {
  '/root': {
    type: 'directory',
    entries: [
      { name: 'README.md', type: 'file', isSymlink: false },
      { name: 'docs', type: 'directory', isSymlink: false },
      { name: 'script.sh', type: 'file', isSymlink: false },  // non-markdown, filtered out
      { name: 'image.png', type: 'file', isSymlink: false },   // non-markdown, filtered out
    ],
  },
  '/root/docs': {
    type: 'directory',
    entries: [
      { name: 'guide.md', type: 'file', isSymlink: false },
      { name: '.hidden.md', type: 'file', isSymlink: false },  // hidden, filtered out
      { name: 'component.mdx', type: 'file', isSymlink: false }, // .mdx, filtered out
    ],
  },
};

export const symlinkFsStructure = {
  '/root': {
    type: 'directory',
    entries: [
      { name: 'link.md', type: 'file', isSymlink: true, target: '/outside/real.md' },
    ],
  },
};

export const loopFsStructure = {
  '/root': {
    type: 'directory',
    entries: [
      { name: 'self-link', type: 'directory', isSymlink: true, target: '/root' },
    ],
  },
};
```

---

## TC → Test Mapping

### Server Tests

#### `tests/server/routes/session.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.1a | First launch with no prior session | Mock fs.readFile → ENOENT (no session) | Server starts, GET /api/session returns AppBootstrapResponse with default session and availableThemes |
| TC-1.1b | Server binds to localhost only | Build and listen | Address is 127.0.0.1 |
| TC-1.1c | Port conflict fallback | Mock port 3000 occupied | Server binds to alternative port, address is correct |
| TC-1.2a | Session with saved workspaces and root restored | Mock fs.readFile → populatedSession | GET /api/session returns AppBootstrapResponse with session containing 3 workspaces + root |
| TC-1.2b | Session with workspaces but no root | Mock fs.readFile → session with null root | GET /api/session returns AppBootstrapResponse with session.lastRoot: null |
| TC-1.2c | Corrupted session file → clean reset | Mock fs.readFile → corruptedSessionJson | GET /api/session returns AppBootstrapResponse with default session |
| TC-1.2d | Theme restored from session | Mock fs.readFile → session with dark theme | GET /api/session returns AppBootstrapResponse with session.theme: 'dark-default' |
| TC-3.3a | Switch root via PUT | Mock fs.stat → success | PUT /api/session/root returns updated session |
| TC-3.3c | Switch to deleted workspace path | Mock fs.stat → ENOENT | PUT /api/session/root returns 404 |
| TC-3.4a | Remove workspace | Mock fs.readFile → populatedSession | DELETE /api/session/workspaces removes entry |
| TC-3.4c | Remove active workspace doesn't clear root | Session root matches workspace | After remove, root unchanged |
| TC-4.3a | Pin new workspace | Mock fs.readFile → session | POST /api/session/workspaces adds entry |
| TC-4.3b | Pin already-saved workspace is no-op | Workspace already in list | POST returns same list length |
| TC-7.2a | Set theme | — | PUT /api/session/theme returns updated theme |
| TC-7.3a | Theme persists | Set theme, then load | GET /api/session returns AppBootstrapResponse with previously set theme |
| TC-8.1a | Workspaces restored in insertion order | Save A, B, C | GET /api/session returns session.workspaces in order A, B, C |
| TC-8.2a | Root restored | Session has root set | GET /api/session returns session.lastRoot with stored path |
| TC-8.2b | Persisted root no longer exists — healed on load | Session has root, fs.stat → ENOENT | GET /api/session returns session.lastRoot: null (stale root cleared), session file rewritten |
| TC-3.1c | Sidebar collapse state persists | Update sidebar, then load | GET /api/session returns session.sidebarState with updated collapse state |
| TC-8.3a | Recent files restored | Mock session with recentFiles populated | GET /api/session returns session.recentFiles array (Note: testable at M1 — Epic 1 owns structure, Epic 2 populates) |
| — | **Non-TC: Invalid theme ID rejected** | — | PUT /api/session/theme with bad ID returns 400 |
| — | **Non-TC: Non-absolute path rejected** | — | PUT /api/session/root with relative path returns 400 |
| — | **Non-TC: Session write atomicity** | Spy on fs.writeFile + fs.rename | Writes to temp file, then renames |

| — | **Non-TC: Touch recent file adds entry** | — | POST /api/session/recent-files adds file to list |
| — | **Non-TC: Touch existing recent file updates openedAt** | File already in list | POST updates timestamp, doesn't duplicate |
| — | **Non-TC: Remove recent file** | File in list | DELETE /api/session/recent-files removes it |
| — | **Non-TC: Bootstrap includes availableThemes** | — | GET /api/session returns availableThemes array with 4 entries |

**Test count: 28** (21 TC-mapped + 7 non-TC)

#### `tests/server/routes/tree.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-5.1a | Only markdown files displayed | Mock fs with simpleFsStructure | Response contains only .md files |
| TC-5.1b | Empty directory hidden | Mock fs with dir containing no .md | Dir not in response tree |
| TC-5.1c | Nested dir with markdown shown | Mock fs with /a/b/doc.md | Both a and b in tree |
| TC-5.1d | Mixed directory shows only .md | Mock fs with .md + .ts files | Only .md files in response |
| TC-5.1e | Case-insensitive extension matching | Mock fs with .MD, .Markdown, .md | All three in response |
| TC-5.1f | Hidden files excluded | Mock fs with .hidden.md | Not in response |
| TC-5.1g | MDX files excluded | Mock fs with .mdx | Not in response |
| TC-5.1h | Symlinked markdown files included with symlink path | Mock fs with symlink | File appears with symlink path, not target |
| TC-5.4a | Sort order: dirs first, alphabetical, case-insensitive | Mock fs with mixed | Response sorted correctly |
| TC-5.5a | mdCount computed per directory | Mock fs with nested dirs | Each dir has correct mdCount |
| TC-9.2a | Medium directory scans in time | Mock fs with 500 files | Responds within 2s |
| TC-10.1a | Permission denied on root | Mock fs.readdir → EACCES | Returns 403 PERMISSION_DENIED |
| TC-10.2a | Root directory deleted during browse | Mock fs.readdir → ENOENT | Returns 404 PATH_NOT_FOUND |
| TC-10.3a | Symlink loop detected and skipped | Mock fs with loop | Loop dir skipped, rest of tree ok |
| TC-10.3b | Special files ignored | Mock fs with socket entry | Ignored, no crash |
| — | **Non-TC: Non-absolute root rejected** | — | GET /api/tree?root=relative returns 400 |
| — | **Non-TC: Empty root returns empty tree** | Mock fs with no .md files | Returns { root, tree: [] } |

**Test count: 17** (15 TC-mapped + 2 non-TC)

#### `tests/server/routes/browse.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-4.2a | Folder picker returns selected path | Mock exec → stdout: path | POST /api/browse returns { path } |
| TC-4.2b | Folder picker cancelled | Mock exec → exit code 1 | POST /api/browse returns null |
| — | **Non-TC: osascript error handled** | Mock exec → error | Returns 500 |
| — | **Non-TC: Trailing slash normalized** | Mock exec → path with trailing / | Path returned without trailing slash |

**Test count: 4** (2 TC-mapped + 2 non-TC)

#### `tests/server/routes/clipboard.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-4.4a | Copy path to clipboard | Mock exec (pbcopy) → success | POST /api/clipboard returns { ok: true } |
| — | **Non-TC: Empty text rejected** | — | POST with empty string returns 400 |
| — | **Non-TC: pbcopy failure returns 500** | Mock exec → error | Returns 500 |

**Test count: 3** (1 TC-mapped + 2 non-TC)

#### `tests/server/services/session.test.ts`

These tests exercise the session service directly (not through routes) for edge cases that are more naturally tested at the service level.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| — | **Non-TC: First launch creates directory** | No dir exists | mkdir called with { recursive: true } |
| — | **Non-TC: Recent files capped at 20** | Session with 20 files, add 21st | Oldest dropped |
| — | **Non-TC: Default session returned on empty dir** | No session.json | Returns DEFAULT_SESSION |
| TC-8.3b | Recent file no longer exists | File deleted | Entry either marked or removed |

**Test count: 4** (1 TC-mapped + 3 non-TC)

#### `tests/server/services/tree.test.ts`

Direct service tests for algorithmic edge cases not easily tested through routes.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| — | **Non-TC: Deeply nested tree (10 levels)** | Mock deep dir structure | Scans correctly without stack overflow |
| — | **Non-TC: Permission denied on subdirectory skips it** | Mock EACCES on nested dir | Parent dir still in tree, subtree skipped |
| TC-9.2b | Large directory (2000 files) doesn't freeze | Mock large structure | Completes without timeout |

**Test count: 3** (1 TC-mapped + 2 non-TC)

### Client Tests

#### `tests/client/components/menu-bar.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-2.1a | File menu contains Open File, Open Folder with shortcuts | Render menu bar | Menu items present with shortcut text |
| TC-2.1b | Export menu items disabled when no document open | Render with no document | Export items have aria-disabled |
| TC-2.1c | View menu contains Toggle Sidebar, Theme submenu | Render menu bar | Menu items present |
| TC-2.1d | Menu closes on outside click | Open menu, click outside | Menu dropdown hidden |
| TC-2.1e | Only one menu open at a time | Open File, click View | File closes, View opens |
| TC-2.2a | Quick-action icons have tooltips | Render menu bar | Icons have title attributes with shortcut text |
| TC-2.2b | Open Folder icon click triggers browse | Click Open Folder icon | api.browse called |
| TC-2.2c | Open File icon is disabled | Click Open File icon | No action; icon has disabled styling and aria-disabled |
| TC-9.1b | File menu Open Folder triggers browse | Click File → Open Folder | api.browse called |
| TC-2.4a | Dropdown menus keyboard navigable | Open menu, press arrow keys | Focus moves between items |
| TC-2.5a | Toggle sidebar closed | Sidebar visible, trigger toggle | Sidebar hidden |
| TC-2.5b | Toggle sidebar open | Sidebar hidden, trigger toggle | Sidebar visible |

**Test count: 11** (11 TC-mapped)

#### `tests/client/components/workspaces.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-3.1a | Collapse workspaces section | Render expanded, click header | Content hidden, triangle rotated |
| TC-3.1b | Expand workspaces section | Render collapsed, click header | Content visible |
| TC-3.2a | Workspace label shows directory name | Render with workspace for /Users/leemoore/code/project-atlas | Label shows "project-atlas" |
| TC-3.2b | Full path tooltip on hover | Render workspace | title attribute has full path |
| TC-3.2c | Long name truncates | Render with long name | CSS overflow: hidden, text-overflow: ellipsis |
| TC-3.3b | Active workspace highlighted | Root matches workspace | Entry has active class |
| TC-3.4a | Remove workspace | Click ✕ | api.removeWorkspace called, entry removed |
| TC-3.4b | ✕ button visible on hover | Render workspace | ✕ visible only when hovered |

**Test count: 8** (8 TC-mapped)

#### `tests/client/components/root-line.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-4.1a | Path displayed truncated with tooltip | Render with root | Shows shortened path, title has full path |
| TC-4.1b | No root selected state | Render with null root | Shows placeholder text |
| TC-4.2a | Browse action triggers folder picker | Click 📁 | api.browse called |
| TC-4.2c | Browse icon always visible | Render without hover | Browse icon visible |
| TC-4.3a | Pin adds workspace | Click 📌 | api.addWorkspace called with current root |
| TC-4.4a | Copy icon copies root path | Click ⎘ | clipboardUtil.copyToClipboard called with full root path |
| TC-4.5a | Refresh reloads tree | Click ↻ | api.getTree called with current root |
| TC-4.5b | Refresh preserves expand state | Set expandedDirsByRoot for current root, refresh | Current root's expanded set unchanged |
| TC-4.6a | Hover reveals pin/copy/refresh | Simulate hover | Action buttons become visible |
| TC-4.6b | Browse always visible without hover | Render | Browse button visible |

**Test count: 10** (10 TC-mapped)

#### `tests/client/components/file-tree.test.ts`

Note: `expandedSet` below refers to the current root's set within `expandedDirsByRoot` (i.e., `expandedDirsByRoot.get(currentRoot)`).

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-5.2a | Expand directory on click | Render tree, click dir | Children visible, dir in expandedSet |
| TC-5.2b | Collapse directory on click | Expand dir, click again | Children hidden, dir removed from expandedSet |
| TC-5.2c | Expand state preserved across workspace switch | Expand dir in root A, switch to root B, switch back to A | Dir still expanded (each root has its own set in expandedDirsByRoot) |
| TC-5.3a | Expand All expands markdown-containing dirs | Render tree, click Expand All | All dirs in expandedSet |
| TC-5.3b | Expand All reaches leaf directories | Deep nested tree | All levels expanded |
| TC-5.3c | Collapse All collapses everything | Expand dirs, Collapse All | expandedSet empty |
| TC-5.3d | Expand All on large tree doesn't freeze | Render largeTree, Expand All | Completes within 100ms |
| TC-5.5a | mdCount badge shown on directories | Render tree with mdCount | Badge shows count |
| TC-5.6a | File tree scrolls independently | Render tree taller than sidebar | tree section has overflow-y: auto |
| TC-5.7a | Expand state resets on restart | Expand dirs, simulate restart | expandedDirsByRoot empty |
| TC-2.4b | Tree keyboard navigation | Focus tree, press arrow keys | Focus moves correctly |

**Test count: 11** (11 TC-mapped)

#### `tests/client/components/context-menu.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-6.1a | File right-click shows Copy Path | Right-click file node | Context menu with "Copy Path" |
| TC-6.1b | Copy Path copies full path | Click Copy Path | clipboard.writeText called with path |
| TC-6.2a | Directory right-click shows 3 items | Right-click dir node | Menu has Copy Path, Make Root, Save as Workspace |
| TC-6.2b | Make Root changes root | Click Make Root | api.setRoot called with dir path |
| TC-6.2c | Save as Workspace adds workspace | Click Save as Workspace | api.addWorkspace called with dir path |
| TC-6.3a | Menu closes on action click | Click action | Context menu removed from DOM |
| TC-6.3b | Menu closes on outside click | Click outside | Context menu removed |
| TC-6.3c | Menu closes on Escape | Press Escape | Context menu removed |
| TC-2.4c | Context menu keyboard navigable | Open menu, press arrow keys | Focus moves between items |

**Test count: 9** (9 TC-mapped)

#### `tests/client/components/content-area.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.3a | Empty state shows app name, buttons, recent files | Render with empty session | All elements present, Open File disabled, Open Folder enabled |
| TC-9.1c | Empty state Open Folder triggers browse | Click empty state "Open Folder" | api.browse called |
| TC-1.3b | No recent files on first launch | Render with empty recentFiles | Shows "No recent files" |
| TC-1.3c | Recent files listed with names and paths | Render with recentFiles | Entries show filename and truncated path |
| TC-1.4a | Tab strip shows "No documents open" | Render with no tabs | Placeholder text visible |

**Test count: 5** (5 TC-mapped)

#### `tests/client/components/error-notification.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-10.1a | Permission denied shows visible error | Set error state with PERMISSION_DENIED | Error notification visible with message |
| TC-10.2a | Deleted root on refresh shows error, clears tree, and marks root line invalid | Mock api.getTree → 404 PATH_NOT_FOUND, simulate refresh click | Error notification visible; tree clears to empty; root line path has `.root-line__path--invalid` class; pin and refresh actions hidden; browse still visible |
| TC-3.3c | Deleted workspace click shows error | Mock api.setRoot → 404 ApiError | Error notification appears, workspace entry remains |
| — | **Non-TC: Error dismissed on click** | Set error, click dismiss | Error notification hidden, state.error is null |
| — | **Non-TC: New error replaces old** | Set error A, then set error B | Only error B visible |

**Test count: 5** (3 TC-mapped + 2 non-TC)

#### `tests/client/state.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| — | **Non-TC: State update notifies listeners** | Subscribe, update | Listener called with new state and changed keys |
| — | **Non-TC: Unsubscribe stops notifications** | Subscribe, unsubscribe, update | Listener not called |
| — | **Non-TC: Session replacement is atomic** | Update session | Full session replaced, not merged |

**Test count: 3** (0 TC-mapped + 3 non-TC)

#### `tests/client/utils/keyboard.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-2.3a | Cmd+O is NOT registered in Epic 1 | Fire Cmd+O keydown | No shortcut handler fires; browser default not prevented |
| TC-2.3b | Shortcut works regardless of focus | Focus on sidebar, fire shortcut | Action called |
| TC-9.1d | Cmd+Shift+O triggers folder browse | Register shortcut, fire keydown | Browse action called |
| — | **Non-TC: Unrecognized shortcut is ignored** | Fire random keydown | No action called |
| — | **Non-TC: preventDefault called on match** | Fire matching keydown | e.preventDefault called |

**Test count: 5** (3 TC-mapped + 2 non-TC)

---

## Test Count Summary

| Test File | TC-Mapped | Non-TC | Total |
|-----------|-----------|--------|-------|
| server/routes/session.test.ts | 21 | 7 | 28 |
| server/routes/tree.test.ts | 15 | 2 | 17 |
| server/routes/browse.test.ts | 2 | 2 | 4 |
| server/routes/clipboard.test.ts | 1 | 2 | 3 |
| server/services/session.test.ts | 1 | 3 | 4 |
| server/services/tree.test.ts | 1 | 2 | 3 |
| client/components/menu-bar.test.ts | 12 + 5 (Chunk 6) | 0 | 17 |
| client/components/workspaces.test.ts | 8 | 0 | 8 |
| client/components/root-line.test.ts | 10 | 0 | 10 |
| client/components/file-tree.test.ts | 11 | 0 | 11 |
| client/components/context-menu.test.ts | 9 | 0 | 9 |
| client/components/content-area.test.ts | 5 | 0 | 5 |
| client/components/error-notification.test.ts | 3 | 2 | 5 |
| client/state.test.ts | 0 | 3 | 3 |
| client/utils/keyboard.test.ts | 3 | 2 | 5 |
| **Total** | **107** | **25** | **132** |

Note: Some TCs are tested at both the server and client layer (e.g., TC-4.2a has a server test in browse.test.ts and a client test in root-line.test.ts). The summary counts total tests across all files. The chunk running totals (which end at 129) count new tests added per chunk and avoid double-counting cross-layer tests that were already counted when their server-side chunk shipped. Both views are correct; the file-level total (132) is the actual number of test functions that will exist.

### TC Coverage Verification

Cross-referenced against all TCs in the epic:

| Flow | TCs in Epic | TCs Mapped | Notes |
|------|-------------|------------|-------|
| 1. App Launch | 11 | 11 | TC-1.1a covered by server startup test + client bootstrap |
| 2. Menu Bar | 14 | 14 | All mapped to menu-bar.test.ts and keyboard.test.ts |
| 3. Workspaces | 12 | 12 | Split between session.test.ts (server) and workspaces.test.ts (client) |
| 4. Root Line | 12 | 12 | Split between browse.test.ts (server) and root-line.test.ts (client) |
| 5. File Tree | 19 | 19 | Split between tree.test.ts (server) and file-tree.test.ts (client) |
| 6. Context Menus | 8 | 8 | All in context-menu.test.ts |
| 7. Themes | 6 | 6 | Split between session.test.ts (persistence) and menu-bar.test.ts (UI) |
| 8. Session Persistence | 7 (5 unique + 2 cross-refs) | 5 | Cross-refs (TC-8.4a→TC-7.3a, TC-8.5a→TC-3.1c) covered by their target TCs |
| 9. Folder Selection | 6 | 6 | Split between browse.test.ts (server) and keyboard.test.ts + root-line.test.ts (client) |
| 10. Error Handling | 4 | 4 | All in tree.test.ts |
| **Total** | **~99** | **~91 unique** | All TCs covered. ~8 are cross-references to other TCs. |

---

## Verification Scripts

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "typecheck:client": "tsc --noEmit -p tsconfig.client.json",
    "lint": "eslint src/ tests/",
    "format:check": "prettier --check src/ tests/",
    "format:fix": "prettier --write src/ tests/",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:server": "vitest run tests/server/",
    "test:client": "vitest run tests/client/",
    "build": "tsc -p tsconfig.json && node esbuild.config.ts",
    "red-verify": "npm run format:check && npm run lint && npm run typecheck && npm run typecheck:client",
    "verify": "npm run red-verify && npm run test",
    "green-verify": "npm run verify && npm run guard:no-test-changes",
    "verify-all": "npm run verify",
    "guard:no-test-changes": "git diff --name-only HEAD | grep -q 'tests/' && echo 'ERROR: Test files were modified during Green phase' && exit 1 || true"
  }
}
```

| Script | Purpose | When Used |
|--------|---------|-----------|
| `red-verify` | Quality gate: format + lint + typecheck (no tests) | After TDD Red (tests exist but fail) |
| `verify` | Standard gate: format + lint + typecheck + all tests | During Green, general development |
| `green-verify` | Green exit gate: verify + ensure no test files changed | After TDD Green (tests pass, implementation done) |
| `verify-all` | Deep gate (same as verify for now — no integration/e2e yet) | Pre-merge |

---

## Work Breakdown: Chunks

### Chunk 0: Infrastructure

**Scope:** Project setup, dependencies, build config, shared types, test framework, fixtures.

**Deliverables:**

| Deliverable | Path | Contents |
|-------------|------|----------|
| Package setup | `app/package.json` | Dependencies, scripts, `"type": "module"` |
| Server tsconfig | `app/tsconfig.json` | `module: "nodenext"`, `strict: true` |
| Client tsconfig | `app/tsconfig.client.json` | Same but with DOM lib |
| esbuild config | `app/esbuild.config.ts` | Client bundle: entry, output, platform |
| Vitest config | `app/vitest.config.ts` | Test setup, JSDOM environment for client |
| Shared types | `app/src/shared/types.ts` | Re-exports from schemas (types only) |
| Zod schemas | `app/src/server/schemas/index.ts` | All schemas from tech design |
| Error utility | `app/src/server/utils/errors.ts` | isPermissionError, isNotFoundError, toApiError |
| Test fixtures | `app/tests/fixtures/*.ts` | session, tree, fs fixtures |
| Test utilities | `app/tests/utils/*.ts` | Server test helpers, DOM test helpers |
| HTML shell | `app/src/client/index.html` | Static HTML from UI tech design |
| CSS files | `app/src/client/styles/*.css` | All 7 CSS files (themes, base, components) |
| ESLint config | `app/.eslintrc.cjs` or `app/eslint.config.js` | TypeScript + ESM rules |
| Prettier config | `app/.prettierrc` | Formatting rules |

**Exit criteria:** `npm run red-verify` passes (typecheck, lint, format). No tests yet.

**Relevant tech design sections:** Index §Stack, API §Schemas, UI §HTML Shell, UI §Theme System (CSS files).

---

### Chunk 1: Server Foundation + Session API

**Scope:** Fastify app factory, session service, session routes, server startup.
**ACs:** AC-1.1, AC-1.2, AC-8.1–8.5
**TCs:** TC-1.1a, TC-1.1b, TC-1.1c, TC-1.2a–d, TC-3.1c, TC-3.3a, TC-3.3c, TC-3.4a, TC-3.4c, TC-4.3a, TC-4.3b, TC-7.2a, TC-7.3a, TC-8.1a, TC-8.2a, TC-8.2b

**Relevant tech design sections:** API §Server Bootstrap, API §App Factory, API §Session Service, API §Session Routes, API §Static File Serving, API §Flow: App Launch.

**Non-TC decided tests:** Invalid theme ID rejected, non-absolute path rejected, session write atomicity, first launch creates directory, recent files capped at 20, default session on empty dir.

#### Skeleton

| File | Stub |
|------|------|
| `src/server/index.ts` | Entry point that calls buildApp + listen |
| `src/server/app.ts` | `export async function buildApp() { throw new NotImplementedError('buildApp') }` |
| `src/server/plugins/static.ts` | Plugin registration stub |
| `src/server/routes/session.ts` | Route registration with NotImplementedError handlers |
| `src/server/services/session.service.ts` | SessionService class with NotImplementedError methods |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/server/routes/session.test.ts | 28 | TC-1.1a–c, TC-1.2a–d, TC-3.1c, TC-3.3a, TC-3.3c, TC-3.4a, TC-3.4c, TC-4.3a, TC-4.3b, TC-7.2a, TC-7.3a, TC-8.1a, TC-8.2a, TC-8.2b, TC-8.3a + 7 non-TC (incl. recent-files endpoints, bootstrap response) |
| tests/server/services/session.test.ts | 4 | TC-8.3b + 3 non-TC |

**Red exit:** `npm run red-verify` passes. 32 tests ERROR (NotImplementedError). Existing tests (none yet) PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `session.service.ts` | Full implementation: load, setRoot, addWorkspace, removeWorkspace, setTheme, updateSidebar. Atomic writes. In-memory cache. |
| `routes/session.ts` | All 8 session endpoints (GET bootstrap, PUT root, POST/DELETE workspaces, PUT theme, PUT sidebar, POST/DELETE recent-files). Zod validation via type provider. Error classification. |
| `app.ts` | Fastify factory with Zod compilers, static plugin, session routes. |
| `plugins/static.ts` | @fastify/static registration. |
| `index.ts` | Listen with port fallback, browser open. |

**Green exit:** `npm run green-verify` passes. All 32 tests PASS. No test files modified.

**Running total: 32 tests**

---

### Chunk 2: App Shell Chrome

**Scope:** Client bootstrap, state store, menu bar, tab strip (empty), content area (empty), keyboard shortcuts, sidebar toggle.
**ACs:** AC-1.3, AC-1.4, AC-2.1–2.5
**TCs:** TC-1.3a–c, TC-1.4a, TC-2.1a–e, TC-2.2a–c, TC-2.3a–b, TC-2.4a, TC-2.5a–b

**Relevant tech design sections:** UI §Client Bootstrap, UI §Client State, UI §Router, UI §API Client, UI §Menu Bar, UI §Content Area, UI §Tab Strip, UI §Keyboard Shortcuts, UI §Flow: Sidebar Toggle.

**Non-TC decided tests:** State update notifies listeners, unsubscribe stops notifications, session replacement is atomic, unrecognized shortcut ignored, preventDefault on match.

#### Skeleton

| File | Stub |
|------|------|
| `src/client/app.ts` | Bootstrap stub |
| `src/client/api.ts` | API client with typed methods |
| `src/client/state.ts` | StateStore class |
| `src/client/router.ts` | Router setup stub |
| `src/client/components/menu-bar.ts` | MenuBar class with render stub |
| `src/client/components/sidebar.ts` | Sidebar class with render stub |
| `src/client/components/tab-strip.ts` | TabStrip class with render stub |
| `src/client/components/content-area.ts` | ContentArea class with render stub |
| `src/client/utils/keyboard.ts` | KeyboardManager class |
| `src/client/utils/clipboard.ts` | copyToClipboard function stub |
| `src/client/utils/dom.ts` | DOM helper stubs |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/components/menu-bar.test.ts | 12 | TC-2.1a–e, TC-2.2a–c, TC-2.4a, TC-2.5a–b, TC-9.1b |
| tests/client/components/content-area.test.ts | 5 | TC-1.3a–c, TC-1.4a, TC-9.1c |
| tests/client/components/error-notification.test.ts | 5 | TC-10.1a, TC-10.2a, TC-3.3c + 2 non-TC |
| tests/client/state.test.ts | 3 | 3 non-TC |
| tests/client/utils/keyboard.test.ts | 5 | TC-2.3a–b, TC-9.1d + 2 non-TC |

**Red exit:** `npm run red-verify` passes. 30 new tests ERROR. Previous 32 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `state.ts` | Full StateStore with pub/sub |
| `api.ts` | Full typed fetch wrapper |
| `app.ts` | Bootstrap: fetch session, init state, render, setup keyboard |
| `router.ts` | State→component wiring |
| `menu-bar.ts` | Full menu bar with dropdowns, icons, keyboard nav |
| `content-area.ts` | Empty state with buttons and recent files |
| `tab-strip.ts` | Empty state placeholder |
| `sidebar.ts` | Container with toggle |
| `keyboard.ts` | Full shortcut registry |
| `clipboard.ts` | Full with fallback |

**Green exit:** `npm run green-verify` passes. All 62 tests PASS.

**Running total: 62 tests**

---

### Chunk 3: Sidebar — Workspaces + Root Line

**Scope:** Workspaces section, root line, browse + pin + copy + refresh, folder selection flow.
**ACs:** AC-3.1–3.4, AC-4.1–4.6, AC-9.1a–c
**TCs:** TC-3.1a–b, TC-3.2a–c, TC-3.3b, TC-3.4a–b, TC-4.1a–b, TC-4.2a, TC-4.2c, TC-4.3a, TC-4.5a–b, TC-4.6a–b, TC-9.1a–c

**Relevant tech design sections:** UI §Workspaces Section, UI §Root Line, API §Browse Service, API §Flow: Set Root, API §Flow: Workspace CRUD.

**Non-TC decided tests:** None beyond what's already in server tests.

#### Skeleton

| File | Stub |
|------|------|
| `src/client/components/workspaces.ts` | Workspaces class with render stub |
| `src/client/components/root-line.ts` | RootLine class with render stub |
| `src/server/routes/browse.ts` | Route registration stub |
| `src/server/services/browse.service.ts` | openFolderPicker stub |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/components/workspaces.test.ts | 8 | TC-3.1a–b, TC-3.2a–c, TC-3.3b, TC-3.4a–b |
| tests/client/components/root-line.test.ts | 10 | TC-4.1a–b, TC-4.2a, TC-4.2c, TC-4.3a, TC-4.4a, TC-4.5a–b, TC-4.6a–b |
| tests/server/routes/browse.test.ts | 4 | TC-4.2a, TC-4.2b + 2 non-TC |

**Red exit:** `npm run red-verify` passes. 22 new tests ERROR. Previous 62 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `workspaces.ts` | Full: collapse, labels, tooltips, switch, remove, active highlight |
| `root-line.ts` | Full: path display, browse, pin, copy, refresh, hover visibility |
| `browse.service.ts` | osascript invocation |
| `routes/browse.ts` | POST /api/browse endpoint |

**Green exit:** `npm run green-verify` passes. All 84 tests PASS.

**Running total: 84 tests**

---

### Chunk 4: File Tree + Folder Selection

**Scope:** File tree component, tree scan endpoint, expand/collapse, expand all, sort, mdCount, error handling.
**ACs:** AC-5.1–5.7, AC-9.2, AC-10.1–10.3
**TCs:** TC-5.1a–h, TC-5.2a–c, TC-5.3a–d, TC-5.4a, TC-5.5a, TC-5.6a, TC-5.7a, TC-9.2a–b, TC-10.1a, TC-10.2a, TC-10.3a–b, TC-2.4b

**Relevant tech design sections:** API §Tree Service, API §Tree Route, UI §File Tree.

**Non-TC decided tests:** Non-absolute root rejected, empty root returns empty tree, deeply nested tree, permission denied on subdirectory.

#### Skeleton

| File | Stub |
|------|------|
| `src/client/components/file-tree.ts` | FileTree class with render stub |
| `src/server/routes/tree.ts` | Route registration stub |
| `src/server/services/tree.service.ts` | TreeService class with scan stub |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/components/file-tree.test.ts | 11 | TC-5.2a–c, TC-5.3a–d, TC-5.5a, TC-5.6a, TC-5.7a, TC-2.4b |
| tests/server/routes/tree.test.ts | 17 | TC-5.1a–h, TC-5.4a, TC-5.5a, TC-9.2a, TC-10.1a, TC-10.2a, TC-10.3a–b + 2 non-TC |
| tests/server/services/tree.test.ts | 3 | TC-9.2b + 2 non-TC |

**Red exit:** `npm run red-verify` passes. 31 new tests ERROR. Previous 84 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `tree.service.ts` | Full: recursive scan, markdown filter, sort, mdCount, symlink handling, error resilience |
| `routes/tree.ts` | GET /api/tree endpoint with error classification |
| `file-tree.ts` | Full: recursive render, expand/collapse, expand all, keyboard nav, mdCount badge |

**Green exit:** `npm run green-verify` passes. All 115 tests PASS.

**Running total: 115 tests**

---

### Chunk 5: Context Menus

**Scope:** Right-click context menus on file tree nodes.
**ACs:** AC-6.1–6.3
**TCs:** TC-6.1a–b, TC-6.2a–c, TC-6.3a–c, TC-2.4c

**Relevant tech design sections:** UI §Context Menu.

**Non-TC decided tests:** None.

#### Skeleton

| File | Stub |
|------|------|
| `src/client/components/context-menu.ts` | ContextMenu class with render stub |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/components/context-menu.test.ts | 9 | TC-6.1a–b, TC-6.2a–c, TC-6.3a–c, TC-2.4c |

**Red exit:** `npm run red-verify` passes. 9 new tests ERROR. Previous 115 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `context-menu.ts` | Full: show/hide, file vs directory items, actions, close behavior, keyboard nav |

**Green exit:** `npm run green-verify` passes. All 124 tests PASS.

**Running total: 124 tests**

---

### Chunk 6: Theme System

**Scope:** Theme switching from View menu, theme persistence, extensibility.
**ACs:** AC-7.1–7.4
**TCs:** TC-7.1a–b, TC-7.2a–b, TC-7.4a

Note: TC-7.3a (theme persistence) is already covered in Chunk 1's session tests.

**Relevant tech design sections:** UI §Theme System, API §Session Routes (PUT /api/session/theme), Index §Q6.

**Non-TC decided tests:** None.

Can run in parallel with Chunk 5 (both depend on Chunk 2, independent of each other).

#### Skeleton

No new files — theme CSS is in Chunk 0, theme menu is in the menu bar (Chunk 2). This chunk adds the theme submenu interaction and the data-theme switching logic.

#### TDD Red

Theme TCs are distributed across existing test files:
- TC-7.1a, TC-7.1b in menu-bar.test.ts (already exists from Chunk 2, add theme-specific tests)
- TC-7.2a, TC-7.2b tested by verifying `document.documentElement.dataset.theme` changes
- TC-7.4a tested by adding a theme definition and verifying it appears

**Additional tests in menu-bar.test.ts: 5 tests**
- TC-7.1a: Theme submenu lists 4 themes
- TC-7.1b: Current theme has checkmark
- TC-7.2a: Selecting theme changes data-theme attribute
- TC-7.2b: No flash (theme applies synchronously)
- TC-7.4a: Adding theme definition makes it appear in menu

**Red exit:** `npm run red-verify` passes. 5 new tests ERROR (added to existing file).

Note: Since these tests are added to an existing test file (menu-bar.test.ts), this is one of the cases where the green-verify `guard:no-test-changes` check would need to be scoped to only guard tests written in earlier chunks. In practice, the Tech Lead should create these tests in their own describe block within the file during Red, then not touch them during Green.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| menu-bar.ts (theme submenu) | Add theme switching to View → Theme submenu |
| app.ts (theme init) | Ensure data-theme is set from session on load |

**Green exit:** `npm run green-verify` passes (with scoped guard). All 129 tests PASS.

**Running total: 129 tests**

---

## Chunk Dependencies

```
Chunk 0 (Infrastructure)
    │
    ▼
Chunk 1 (Server + Session)
    │
    ▼
Chunk 2 (App Shell Chrome)
    │
    ├──────────────────┐
    ▼                  ▼
Chunk 3 (Workspaces)  Chunk 6 (Themes)
    │
    ▼
Chunk 4 (File Tree)
    │
    ▼
Chunk 5 (Context Menus)
```

---

## Manual Verification Checklist

After all chunks are Green, verify manually:

1. [ ] `npm start` — server starts, browser opens
2. [ ] Click "Open Folder" in empty state — macOS folder picker opens
3. [ ] Select a directory with markdown files — tree populates
4. [ ] Expand/collapse directories — smooth, no lag
5. [ ] Click Expand All — all directories with markdown expand
6. [ ] Right-click a file → Copy Path — verify clipboard content
7. [ ] Right-click a directory → Make Root — tree changes
8. [ ] Right-click a directory → Save as Workspace — appears in sidebar
9. [ ] Click a saved workspace — root switches, tree updates
10. [ ] Remove a workspace with ✕ — disappears
11. [ ] Switch theme via View → Theme — instant, no flash
12. [ ] Quit and relaunch — workspaces, root, theme all restored
13. [ ] Cmd+Shift+O — folder picker opens
14. [ ] Cmd+B — sidebar toggles
15. [ ] Collapse Workspaces section — stays collapsed after restart
16. [ ] Navigate to a directory you don't have read permission on — error message shown
