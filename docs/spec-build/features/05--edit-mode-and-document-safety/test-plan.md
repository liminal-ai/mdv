# Test Plan: Epic 5 — Edit Mode and Document Safety

**Parent:** [tech-design.md](tech-design.md)
**Companion:** [tech-design-api.md](tech-design-api.md) · [tech-design-ui.md](tech-design-ui.md)

This document maps every TC from the epic to a test, defines the mock strategy, lists test fixtures, specifies verification scripts, and breaks work into chunks with test counts.

---

## Mock Strategy

### Server Tests

Same pattern as Epics 1–4: test at the route handler level using Fastify's `inject()`. Mock at the filesystem boundary. The render pipeline (markdown-it + Shiki + DOMPurify) runs for real when testing `POST /api/render`.

| Layer | Mock? | Why |
|-------|-------|-----|
| Route handlers (`server/routes/*`) | **Test here** | Entry point |
| Services (`server/services/*`) | Don't mock | Exercised through routes |
| Render pipeline (markdown-it + Shiki + DOMPurify) | **Don't mock** | In-process — exercised through /api/render |
| `node:fs/promises` | **Mock** | External boundary — filesystem |
| `node:child_process` | **Mock** | External boundary — osascript (save dialog) |
| Zod schemas | Don't mock | Part of validation pipeline |

### Client Tests

JSDOM + mocked API client. CodeMirror is partially mocked — the `Editor` wrapper class is mocked at the import boundary (CodeMirror requires a real browser DOM for rendering). Modal behavior is tested via DOM assertions.

| Layer | Mock? | Why |
|-------|-------|-----|
| Components (`client/components/*`) | **Test here** | Entry point |
| State store (`client/state.ts`) | Don't mock | Exercised through components |
| API client (`client/api.ts`) | **Mock** | External boundary — server |
| WebSocket client (`client/utils/ws.ts`) | **Mock** | External boundary — WebSocket |
| Editor wrapper (`client/components/editor.ts`) | **Mock** | CodeMirror needs real browser DOM |
| `navigator.clipboard` | Mock | Browser API, not in JSDOM |
| DOM / JSDOM | Don't mock | That's what we're testing |

**Exception — Editor wrapper mock:** The `Editor` class wraps CodeMirror, which cannot run in JSDOM (needs real browser text measurement, selection APIs). Tests mock the `Editor` class with a simple object that tracks `getContent()`, `setContent()`, `getSelection()`, `insertAtCursor()`, and `replaceSelection()` calls. This is analogous to how Epic 3 mocks the `mermaid` module — external dependency that needs a real browser.

```typescript
vi.mock('../../src/client/components/editor.js', () => ({
  Editor: vi.fn().mockImplementation(() => ({
    setContent: vi.fn(),
    getContent: vi.fn(() => ''),
    getSelection: vi.fn(() => ''),
    insertAtCursor: vi.fn(),
    replaceSelection: vi.fn(),
    getScrollTop: vi.fn(() => 0),
    setScrollTop: vi.fn(),
    scrollToPercentage: vi.fn(),
    getScrollPercentage: vi.fn(() => 0),
    focus: vi.fn(),
    destroy: vi.fn(),
  })),
}));
```

---

## Test Fixtures

### `tests/fixtures/edit-samples.ts`

```typescript
import type { TabState } from '../../src/client/state.js';
import type { FileSaveResponse } from '../../src/shared/types.js';

// Clean tab (no edits)
export const cleanTab: TabState = {
  id: 'tab-1',
  path: '/Users/leemoore/code/docs/readme.md',
  canonicalPath: '/Users/leemoore/code/docs/readme.md',
  filename: 'readme.md',
  html: '<h1>README</h1>',
  content: '# README',
  warnings: [],
  scrollPosition: 0,
  loading: false,
  modifiedAt: '2026-03-20T10:00:00Z',
  size: 10,
  status: 'ok',
  mode: 'render',
  editContent: null,
  editScrollPosition: 0,
  cursorPosition: null,
  dirty: false,
  editedSinceLastSave: false,
};

// Dirty tab (has unsaved edits)
export const dirtyTab: TabState = {
  ...cleanTab,
  id: 'tab-2',
  path: '/Users/leemoore/code/docs/spec.md',
  filename: 'spec.md',
  content: '# Spec\n\nOriginal content.',
  editContent: '# Spec\n\nModified content.',
  mode: 'edit',
  dirty: true,
  editedSinceLastSave: true,
  cursorPosition: { line: 3, column: 18 },
};

// Tab in render mode with unsaved edits (switched from edit)
export const dirtyRenderTab: TabState = {
  ...dirtyTab,
  mode: 'render',
};

// Save response
export const saveResponse: FileSaveResponse = {
  path: '/Users/leemoore/code/docs/spec.md',
  modifiedAt: '2026-03-20T10:05:00Z',
  size: 35,
};

// Multiple tabs for multi-tab close tests
export const threeTabs: TabState[] = [
  { ...cleanTab, id: 'tab-a', path: '/a.md', filename: 'a.md' },
  { ...dirtyTab, id: 'tab-b', path: '/b.md', filename: 'b.md' },
  { ...cleanTab, id: 'tab-c', path: '/c.md', filename: 'c.md' },
];

// Two dirty tabs for quit tests
export const twoDirtyTabs: TabState[] = [
  { ...dirtyTab, id: 'tab-x', path: '/x.md', filename: 'x.md' },
  { ...dirtyTab, id: 'tab-y', path: '/y.md', filename: 'y.md' },
];
```

### `tests/fixtures/markdown-for-edit.ts`

```typescript
// Simple markdown for basic editing tests
export const simpleMarkdown = '# Title\n\nParagraph with **bold** and *italic*.\n';

// Markdown with all highlighted constructs
export const highlightedMarkdown = `# Heading

**bold** *italic* ~~strike~~ \`code\`

- list item
- another item

> blockquote

\`\`\`javascript
const x = 42;
\`\`\`

[link](https://example.com)

| Col1 | Col2 |
|------|------|
| a    | b    |
`;

// Large markdown for performance tests
export const largeMarkdown = Array.from({ length: 10_000 }, (_, i) =>
  `Line ${i + 1}: Some content here.\n`
).join('');

// Empty markdown
export const emptyMarkdown = '';
```

---

## TC → Test Mapping

### Server Tests

#### `tests/server/routes/file-save.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-3.1a | Save writes content to disk | Mock fs.stat + writeFile + rename | PUT /api/file returns { path, modifiedAt, size } |
| TC-3.1c | Save when not dirty (clean file) | Mock file exists, same content | PUT still succeeds (server doesn't check dirty — that's client-side) |
| TC-3.1e | Stale write detected (mtime mismatch) | Mock fs.stat → different mtime than expectedModifiedAt | Returns 409 CONFLICT |
| TC-3.3a | Permission denied on save | Mock fs.writeFile → EACCES | Returns 403 PERMISSION_DENIED |
| TC-3.3b | Disk full on save | Mock fs.writeFile → ENOSPC | Returns 507 INSUFFICIENT_STORAGE |
| TC-3.3c | Parent directory deleted | Mock fs.stat(dir) → ENOENT | Returns 404 PATH_NOT_FOUND |
| — | **Non-TC: Non-absolute path rejected** | PUT with relative path | Returns 400 INVALID_PATH |
| — | **Non-TC: Non-markdown extension rejected** | PUT with .txt extension | Returns 415 NOT_MARKDOWN |
| — | **Non-TC: Atomic write uses temp + rename** | Spy on fs.writeFile + fs.rename | Writes to temp file, then renames |
| — | **Non-TC: Save As to new path (no expectedModifiedAt)** | PUT without expectedModifiedAt | No mtime check, write succeeds |
| — | **Non-TC: Content preserved in file after save** | Mock fs → read after write | Content matches what was sent |
| — | **Non-TC: expectedModifiedAt null for new file** | File doesn't exist, expectedModifiedAt null | Write succeeds (new file, no mtime check) |

**Test count: 12** (6 TC-mapped + 6 non-TC)

#### `tests/server/routes/render.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.1e | Render from provided content (not disk) | POST /api/render with content | Returns { html, warnings } |
| — | **Non-TC: Relative images resolved against documentPath** | Content with `![](./img.png)`, mock img exists | HTML has /api/image proxy URL |
| — | **Non-TC: Missing image warnings in render response** | Content with missing image reference | warnings array has missing-image entry |
| — | **Non-TC: Mermaid placeholders in rendered content** | Content with mermaid block | HTML has .mermaid-placeholder |

**Test count: 4** (1 TC-mapped + 3 non-TC)

#### `tests/server/routes/save-dialog.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-3.2a | Save As dialog opens with defaults | Mock exec → stdout path | osascript called with default name + dir |
| TC-3.2c | Cancel save dialog returns null | Mock exec → exit code 1 | POST returns null |
| — | **Non-TC: Custom prompt passed to osascript** | POST with prompt: "Export" | osascript command includes prompt text |
| — | **Non-TC: osascript error returns 500** | Mock exec → error | Returns 500 |

**Test count: 4** (2 TC-mapped + 2 non-TC)

### Client Tests

#### `tests/client/components/mode-switching.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.1a | Switch to Edit mode | Render with tab in render mode, click Edit | Editor container visible, rendered content hidden |
| TC-1.1b | Switch to Render mode | Render with tab in edit mode, click Render | Rendered content visible, editor hidden |
| TC-1.1c | Cmd+Shift+M toggles mode | Simulate keydown | Mode toggles in state |
| TC-1.1d | Dirty state preserved across mode switch | Set dirty in edit, switch to render, switch back | editContent preserved, dirty indicator visible |
| TC-1.1e | Render mode shows unsaved edits | Set dirty tab, switch to render | api.render called with editContent |
| TC-1.1f | Mode per tab | Tab A in edit, Tab B in render, switch tabs | Each tab shows correct mode |
| TC-1.2a | Edit mode toolbar: cursor position shown | Tab in edit mode | Cursor position text visible |
| TC-1.2b | Render mode toolbar: warnings shown | Tab in render mode with warnings | Warning count visible |
| TC-7.1a | Default mode Edit enabled | Click "Opens in" dropdown | Edit option is enabled, not disabled |
| TC-7.1b | New tab opens in Edit when default is Edit | Set defaultOpenMode to 'edit', open file | Tab created with mode: 'edit' |
| TC-7.1c | Default mode persists | Set mode to edit, check session | api.setDefaultMode called with 'edit' |
| TC-7.1d | Direct open in Edit (no Render flash) | Default 'edit', open file | Tab starts in edit mode immediately |
| TC-7.2a | Existing tabs unaffected by default change | 3 tabs in render, change default to edit | All 3 remain in render mode |

**Test count: 13** (13 TC-mapped)

#### `tests/client/components/editor.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-2.1a | Editor displays with markdown highlighting | Mock editor, render in edit mode | Editor.setContent called, editor container visible |
| TC-2.1b | Line numbers visible | — | Editor created (CodeMirror includes line numbers by default; manual verify) |
| TC-2.1c | Cursor position display | Mock editor cursor at line 42, col 15 | Status shows "Ln 42, Col 15" |
| TC-2.1d | Cursor position updates on move | Fire cursor change callback | Status text updates |
| TC-2.2a | Typing activates dirty state | Fire content change callback | dirty = true, editedSinceLastSave = true |
| TC-2.2e | Undo back to clean state | Set dirty, change content back to saved | dirty = false |
| TC-2.3a | Light theme applied to editor | Set light theme | Editor created (theme via CSS vars; manual verify) |
| TC-2.3b | Dark theme applied to editor | Set dark theme | Editor created (theme via CSS vars; manual verify) |
| TC-2.3c | Theme switch doesn't lose state | Switch theme with content in editor | Editor content unchanged, cursor position unchanged |
| TC-2.4a | Edit scroll preserved across tab switch | Set edit scroll, switch tabs, switch back | editor.setScrollTop called with saved value |
| TC-2.4b | Mode switch scroll mapping | Render at 50% scroll, switch to edit | editor.scrollToPercentage called with ~0.5 |

**Test count: 11** (11 TC-mapped)

#### `tests/client/components/save.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-3.1a | Save clears dirty state | Dirty tab, trigger save | api.saveFile called, dirty = false |
| TC-3.1b | Save from File menu | Dirty tab, click File > Save | api.saveFile called |
| TC-3.1c | Save when not dirty is no-op | Clean tab, trigger Cmd+S | api.saveFile NOT called |
| TC-3.1d | Save doesn't trigger self-conflict | Save tab, then receive file-change for same path | No conflict modal shown |
| TC-3.1e | Stale write shows conflict modal | api.saveFile → 409 CONFLICT | Conflict modal appears |
| TC-3.1f | Save from Render mode with dirty edits | Dirty tab in render mode, Cmd+S | api.saveFile called with editContent |
| TC-3.2a | Save As opens dialog | Trigger Cmd+Shift+S | api.saveDialog called |
| TC-3.2b | Save As to new path updates tab | Dialog returns new path, save succeeds | Tab path updated, dirty cleared |
| TC-3.2c | Save As cancel preserves state | Dialog returns null | Tab unchanged, dirty preserved |
| TC-3.2d | Save As overwrite handled by OS dialog | — | **Manual verify only** — the OS save dialog natively handles overwrite confirmation. Not automatable. See checklist item 11. |
| TC-3.2e | Save As to already-open clean tab | Tab B saves as Tab A's path (A is clean) | Tab A closed, Tab B updated |
| TC-3.2f | Save As to already-open dirty tab | Tab B saves as Tab A's path (A is dirty) | Unsaved modal for Tab A first |
| TC-4.1a | Tab dot appears on dirty | Set dirty = true | .tab__dirty-dot element visible |
| TC-4.1b | Tab dot clears on save | Save dirty tab | .tab__dirty-dot removed |
| TC-4.1c | Tab dot appears on first edit | Clean tab, trigger content change | .tab__dirty-dot appears |
| TC-4.2a | Toolbar dirty indicator in edit mode | Dirty tab in edit mode | "Modified" text visible |
| TC-4.2b | Toolbar dirty indicator in render mode | Dirty tab in render mode | "Modified" text still visible |
| TC-4.3a | Independent dirty tracking per tab | Tab A dirty, Tab B clean, switch | Tab A has dot, Tab B doesn't |

**Test count: 17** (17 TC-mapped)

#### `tests/client/components/unsaved-modal.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-5.1a | Close dirty tab shows modal | Dirty tab, click close | Modal appears with Save/Discard/Cancel |
| TC-5.1b | Save and Close | Click "Save and Close" | api.saveFile called, then tab closed |
| TC-5.1c | Discard Changes | Click "Discard Changes" | Tab closed without save |
| TC-5.1d | Cancel keeps tab open | Click Cancel or Escape | Modal closes, tab remains |
| TC-5.1e | Close clean tab — no modal | Clean tab, click close | Tab closes immediately |
| TC-5.1f | Close dirty tab via Cmd+W | Dirty tab, Cmd+W | Modal appears |
| TC-5.2a | Close Others with dirty tabs | 3 tabs (A dirty, B clean, C dirty), close others from B | Modal for A, then modal for C |
| TC-5.2b | Close Right with dirty tabs | 3 tabs (A, B dirty, C), close right from A | Modal for B |
| TC-5.3e | Quit with dirty tabs (browser) | Dirty tabs exist | beforeunload handler registered |
| TC-5.3f | Quit with no dirty tabs | All clean | beforeunload handler not registered |
| — | **Non-TC: Cancel during Close Others stops remaining** | Cancel on first modal | Remaining tabs not closed |
| — | **Non-TC: Save failure during Close keeps tab open** | api.saveFile rejects | Tab remains open, error shown |

**Test count: 12** (10 TC-mapped + 2 non-TC)

#### `tests/client/components/conflict-modal.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-6.1a | Conflict modal appears on external change with dirty tab | Dirty tab, receive file-change | Modal with Keep/Reload/Save Copy |
| TC-6.1b | Keep My Changes dismisses modal | Click "Keep My Changes" | Modal closes, edits preserved, dirty remains |
| TC-6.1c | Reload from Disk replaces content | Click "Reload from Disk" | api.readFile called, editor content replaced, dirty cleared |
| TC-6.1d | Save Copy then reload | Click "Save Copy", select path, save | api.saveDialog + api.saveFile called, then readFile for original |
| TC-6.1e | Save Copy cancel returns to modal | Click "Save Copy", cancel dialog | Modal still visible |
| TC-6.1f | Save Copy failure returns to modal | Click "Save Copy", save fails | Error shown, modal still visible |
| TC-6.1g | Conflict while in Render mode | Dirty tab in render mode, external change | Modal still appears |
| TC-6.2a | Clean tab auto-reloads (no modal) | Clean tab, receive file-change | api.readFile called, no modal |
| TC-6.3a | File deleted while editing | Dirty tab, receive file-deleted event | Notification shown, edits preserved |
| — | **Non-TC: savePending suppresses self-change** | Set savePending, receive file-change | No modal, no reload |

**Test count: 10** (9 TC-mapped + 1 non-TC)

#### `tests/client/components/insert-tools.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-9.1a | Insert link at cursor | No selection, trigger insert link | editor.insertAtCursor called with `[text](url)` |
| TC-9.1b | Insert link with selection | Text selected, trigger insert link | editor.replaceSelection called with `[selected](url)` |
| TC-9.2a | Insert table | Trigger insert table with 3 cols, 2 rows | editor.insertAtCursor called with table markdown |
| TC-9.2b | Inserted table structure | Insert 3x2 table | Inserted text has header row, separator, 2 body rows |

**Test count: 4** (4 TC-mapped)

#### `tests/client/components/cross-epic.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-8.1a | Export with dirty tab shows warning | Dirty tab, click Export | Warning modal with Save and Export/Export Anyway/Cancel |
| TC-8.1b | Save and Export | Click "Save and Export" | api.saveFile called, then export proceeds |
| TC-8.1c | Export Anyway | Click "Export Anyway" | Export proceeds, edits preserved in editor |
| TC-8.2a | File menu has Save with shortcut | Open File menu | Save item visible with "Cmd+S" |
| TC-8.2b | Save As always enabled | Open File menu, clean tab | Save As is enabled |
| TC-10.1a | Save failure preserves editor content | api.saveFile rejects | Editor content unchanged, dirty preserved |
| TC-10.2a | Large file in editor | Set tab with 10000-line content | Editor created (performance is manual verify) |
| TC-10.2b | Binary content in editor | Set tab with binary content | Error/fallback shown (same as Epic 2 render) |

**Test count: 8** (8 TC-mapped)

#### `tests/client/utils/keyboard-epic5.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-3.1a | Cmd+S triggers save | Dirty tab, fire Cmd+S keydown | Save action called |
| TC-3.2a | Cmd+Shift+S opens Save As | Fire Cmd+Shift+S keydown | Save As dialog called |
| TC-1.1c | Cmd+Shift+M toggles mode | Fire keydown | Mode toggles |
| TC-9.1a | Cmd+K triggers insert link (edit mode) | Tab in edit mode, fire keydown | Insert link action called |
| — | **Non-TC: Cmd+K in render mode is no-op** | Tab in render mode, fire keydown | No action |
| — | **Non-TC: Cmd+S with no tabs is no-op** | No tabs, fire keydown | No error |

**Test count: 6** (4 TC-mapped + 2 non-TC)

---

## Test Count Summary

| Test File | TC-Mapped | Non-TC | Total |
|-----------|-----------|--------|-------|
| server/routes/file-save.test.ts | 6 | 6 | 12 |
| server/routes/render.test.ts | 1 | 3 | 4 |
| server/routes/save-dialog.test.ts | 2 | 2 | 4 |
| client/components/mode-switching.test.ts | 13 | 0 | 13 |
| client/components/editor.test.ts | 11 | 0 | 11 |
| client/components/save.test.ts | 17 | 0 | 17 |
| client/components/unsaved-modal.test.ts | 10 | 2 | 12 |
| client/components/conflict-modal.test.ts | 9 | 1 | 10 |
| client/components/insert-tools.test.ts | 4 | 0 | 4 |
| client/components/cross-epic.test.ts | 8 | 0 | 8 |
| client/utils/keyboard-epic5.test.ts | 4 | 2 | 6 |
| **Total** | **85** | **16** | **101** |

Note: The 85 TC-mapped tests cover ~76 unique TCs. The difference is because some TCs are tested at both the server and client layers (e.g., TC-3.1a has both a server save test and a client save flow test; TC-1.1c appears in both mode-switching.test.ts and keyboard-epic5.test.ts). This is consistent with the approach in Epics 1–4 where cross-layer TCs have tests in both layers.

### TC Coverage Verification

| Flow | TCs in Epic | TCs Mapped | Notes |
|------|-------------|------------|-------|
| 1. Mode Switching | 8 | 8 | mode-switching.test.ts + default mode tests |
| 2. Edit Mode Editor | 11 | 11 | editor.test.ts. TC-2.2b–d (selection, copy/paste, undo/redo) covered by CodeMirror natively; manual verify |
| 3. Save and Save As | 12 | 12 | file-save.test.ts (server) + save.test.ts (client) |
| 4. Dirty State | 6 | 6 | save.test.ts |
| 5. Unsaved Changes | 10 | 10 | unsaved-modal.test.ts |
| 6. Conflict Resolution | 9 | 9 | conflict-modal.test.ts |
| 7. Default Mode | 4 | 4 | mode-switching.test.ts |
| 8. Cross-Epic | 5 | 5 | cross-epic.test.ts |
| 9. Insert Tools | 4 | 4 | insert-tools.test.ts |
| 10. Error Handling | 3 | 3 | cross-epic.test.ts |
| **Total** | **~76** | **~72 automated + 4 deferred** | See coverage notes below |

**TC coverage notes:**
- **72 TCs covered by automated tests** in this plan.
- **TC-2.2b–d** (selection, copy/paste, cut): Native CodeMirror behaviors, verified via manual testing (checklist items 5–7). Not automatable with mocked editor.
- **TC-3.2d** (Save As overwrite): OS dialog behavior, verified via manual testing (checklist item 11).
- **TC-5.3a–d** (Electron quit modal with file listing): **Deferred to Epic 6.** These are Epic 5 TCs that require Electron's `close` event interception and custom IPC modal — not implementable in the browser-first v1 architecture. The browser quit path (TC-5.3e–f) IS covered. This is a documented scope reduction, not an oversight — the epic's Amendment 2 acknowledges the platform split.

**Note on TC-2.2b–d:** Standard editing operations (selection, copy, paste, cut) are native CodeMirror behaviors. They cannot be meaningfully tested with a mocked editor. These are verified via manual testing (checklist items 5–7). TC-2.2a (typing) and TC-2.2e (undo back to clean) are tested because they involve our dirty state logic.

**Note on TC-5.3a–d:** The Electron-specific quit modal (listing dirty files) is deferred to Epic 6. The browser `beforeunload` path (TC-5.3e–f) is tested in this plan.

---

## Verification Scripts

Epic 5 uses the same script structure as Epics 1–4. No changes to script definitions.

```json
{
  "scripts": {
    "red-verify": "npm run format:check && npm run lint && npm run typecheck && npm run typecheck:client",
    "verify": "npm run red-verify && npm run test",
    "green-verify": "npm run verify && npm run guard:no-test-changes",
    "verify-all": "npm run verify"
  }
}
```

---

## Work Breakdown: Chunks

### Chunk 0: Infrastructure

**Scope:** New dependencies, types, schemas, fixtures, CSS files.

**Deliverables:**

| Deliverable | Path | Contents |
|-------------|------|----------|
| New dependencies | `app/package.json` | codemirror, @codemirror/lang-markdown, @codemirror/language, @codemirror/commands, @codemirror/search, @codemirror/state, @codemirror/view |
| Extended schemas | `app/src/server/schemas/index.ts` | FileSaveRequest, FileSaveResponse, RenderFromContent, SaveDialog, ConflictError |
| Extended types | `app/src/shared/types.ts` | New type re-exports |
| Test fixtures | `app/tests/fixtures/edit-samples.ts` | TabState with edit fields, save responses |
| Test fixtures | `app/tests/fixtures/markdown-for-edit.ts` | Markdown content for editing tests |
| CSS | `app/src/client/styles/editor.css` | CodeMirror container styles |
| CSS | `app/src/client/styles/modal.css` | Conflict and unsaved modal styles |
| CSS | `app/src/client/styles/content-toolbar.css` | Dirty indicator, cursor position |
| HTML | `app/src/client/index.html` | Add editor.css and modal.css link tags |
| Error classes | `app/src/server/utils/errors.ts` | ConflictError, PathNotFoundError |

**Exit criteria:** `npm run red-verify` passes. No tests yet.

---

### Chunk 1: Server — Save + Render-from-Content

**Scope:** PUT /api/file (save with atomic write + mtime check), POST /api/render (render from content), POST /api/save-dialog (consolidated).
**ACs:** AC-3.1, AC-3.3
**TCs:** TC-3.1a, TC-3.1c, TC-3.1e, TC-3.3a–c, TC-1.1e (render endpoint)

**Relevant tech design sections:** API §File Service Extensions, API §Render Service Extensions, API §Route Handlers, API §Save Dialog, API §Error Classes.

**Non-TC decided tests:** Non-absolute path rejected, non-markdown extension rejected, atomic write verified, Save As without mtime, content preserved, relative images in render, missing image warnings in render, mermaid placeholders in render, custom prompt for save dialog, osascript error handling, null expectedModifiedAt for new file.

#### Skeleton

| File | Stub |
|------|------|
| `src/server/routes/render.ts` | POST /api/render stub |
| `src/server/routes/save-dialog.ts` | POST /api/save-dialog stub |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/server/routes/file-save.test.ts | 12 | TC-3.1a, TC-3.1c, TC-3.1e, TC-3.3a–c + 6 non-TC |
| tests/server/routes/render.test.ts | 4 | TC-1.1e + 3 non-TC |
| tests/server/routes/save-dialog.test.ts | 4 | TC-3.2a, TC-3.2c + 2 non-TC |

**Red exit:** `npm run red-verify` passes. 20 new tests ERROR. Previous 430 tests (Epics 1–4) PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `file.service.ts` | Extension: writeFile with validation chain + mtime check + atomic write |
| `routes/render.ts` | POST /api/render — thin route calling existing renderService.render() |
| `routes/file.ts` | Add PUT handler with error classification |
| `routes/render.ts` | POST /api/render — lightweight, no disk I/O |
| `routes/save-dialog.ts` | Consolidated save dialog (shared osascript function) |

**Green exit:** `npm run green-verify` passes. All 450 tests PASS.

**Running total: 450 tests**

---

### Chunk 2: Client — Mode Switching + Editor

**Scope:** CodeMirror wrapper, mode toggle activation, default mode picker, content area mode switching, cursor position display, editor scroll management.
**ACs:** AC-1.1, AC-1.2, AC-2.1–2.4, AC-7.1–7.2
**TCs:** TC-1.1a–f, TC-1.2a–b, TC-2.1a–d, TC-2.2a, TC-2.2e, TC-2.3a–c, TC-2.4a–b, TC-7.1a–d, TC-7.2a

**Relevant tech design sections:** UI §CodeMirror Integration, UI §Mode Switching, UI §Content Toolbar Updates, UI §Keyboard Shortcuts (Cmd+Shift+M).

**Non-TC decided tests:** None.

#### Skeleton

| File | Stub |
|------|------|
| `src/client/components/editor.ts` | Editor class with NotImplementedError methods |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/components/mode-switching.test.ts | 13 | TC-1.1a–f, TC-1.2a–b, TC-7.1a–d, TC-7.2a |
| tests/client/components/editor.test.ts | 11 | TC-2.1a–d, TC-2.2a, TC-2.2e, TC-2.3a–c, TC-2.4a–b |

**Red exit:** `npm run red-verify` passes. 24 new tests ERROR. Previous 450 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `editor.ts` | Full: CodeMirror 6 init, theme via CSS vars, change/cursor listeners, suppress, scroll management |
| `content-area.ts` | Extension: mode switching between rendered HTML and editor, render-from-content for dirty tabs |
| `content-toolbar.ts` | Extension: mode toggle activation, cursor position display, default mode picker enabled |
| `keyboard.ts` | Add Cmd+Shift+M handler |
| `state.ts` | Add edit fields to TabState |
| `app.ts` | Wire editor, set initial mode from defaultOpenMode |
| `api.ts` | Add render() method |

**Green exit:** `npm run green-verify` passes. All 474 tests PASS.

**Running total: 474 tests**

---

### Chunk 3: Save, Save As, Dirty State

**Scope:** Save + Save As flows, dirty state tracking (tab dot, toolbar indicator), self-change suppression, File menu additions.
**ACs:** AC-3.1–3.2, AC-4.1–4.3, AC-8.2
**TCs:** TC-3.1a–f, TC-3.2a–f, TC-4.1a–c, TC-4.2a–b, TC-4.3a, TC-8.2a–b

**Relevant tech design sections:** UI §Dirty State Tracking, UI §Self-Change Suppression, UI §Tab Strip Updates, UI §Content Toolbar Updates (dirty indicator), UI §File Menu Updates.

**Non-TC decided tests:** None.

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/components/save.test.ts | 17 | TC-3.1a–f, TC-3.2a–c,e,f, TC-4.1a–c, TC-4.2a–b, TC-4.3a |
| tests/client/utils/keyboard-epic5.test.ts | 6 | TC-3.1a (Cmd+S), TC-3.2a (Cmd+Shift+S), TC-1.1c, TC-9.1a + 2 non-TC |

**Red exit:** `npm run red-verify` passes. 23 new tests ERROR. Previous 474 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `save.test.ts` consumers: content-toolbar, tab-strip, ws.ts, keyboard | |
| `ws.ts` | Extension: savePending map for self-change suppression |
| `tab-strip.ts` | Extension: dirty dot indicator |
| `content-toolbar.ts` | Extension: dirty indicator label |
| `menu-bar.ts` | Extension: Save and Save As items in File menu |
| `keyboard.ts` | Add Cmd+S, Cmd+Shift+S handlers |
| `api.ts` | Add saveFile(), saveDialog() methods |

**Green exit:** `npm run green-verify` passes. All 497 tests PASS.

**Running total: 497 tests**

---

### Chunk 4: Unsaved Changes Protection

**Scope:** Close-dirty-tab modal, multi-tab close with dirty, quit protection via beforeunload.
**ACs:** AC-5.1–5.3
**TCs:** TC-5.1a–f, TC-5.2a–b, TC-5.3e–f

**Relevant tech design sections:** UI §Unsaved Changes Modal, UI §Quit Protection.

**Non-TC decided tests:** Cancel during Close Others stops remaining, save failure during close keeps tab open.

Can run in parallel with Chunks 5 and 6.

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/components/unsaved-modal.test.ts | 12 | TC-5.1a–f, TC-5.2a–b, TC-5.3e–f + 2 non-TC |

**Red exit:** `npm run red-verify` passes. 12 new tests ERROR. Previous 497 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `unsaved-modal.ts` | Full: modal with Save/Discard/Cancel, sequential multi-tab close |
| `app.ts` | Extension: beforeunload handler registration/removal |
| `tab-strip.ts` | Modify closeTab to check dirty, show modal |

**Green exit:** `npm run green-verify` passes. All 509 tests PASS.

**Running total: 509 tests**

---

### Chunk 5: External Change Conflict Resolution

**Scope:** Conflict modal, Keep/Reload/Save Copy, file deletion while editing, savePending suppression.
**ACs:** AC-6.1–6.3
**TCs:** TC-6.1a–g, TC-6.2a, TC-6.3a

**Relevant tech design sections:** UI §Conflict Modal.

**Non-TC decided tests:** savePending suppresses self-change.

Can run in parallel with Chunks 4 and 6.

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/components/conflict-modal.test.ts | 10 | TC-6.1a–g, TC-6.2a, TC-6.3a + 1 non-TC |

**Red exit:** `npm run red-verify` passes. 10 new tests ERROR.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `conflict-modal.ts` | Full: Keep/Reload/Save Copy with cancel and failure edge cases |
| `ws.ts` | Modify file-change handler: if dirty → conflict modal, if clean → auto-reload |

**Green exit:** `npm run green-verify` passes. All 519 tests PASS.

**Running total: 519 tests**

---

### Chunk 6: Insert Tools, File Menu, Cross-Epic

**Scope:** Link and table insert tools, export-with-dirty warning, error handling edge cases.
**ACs:** AC-8.1, AC-9.1–9.2, AC-10.1–10.2
**TCs:** TC-8.1a–c, TC-9.1a–b, TC-9.2a–b, TC-10.1a, TC-10.2a–b

**Relevant tech design sections:** UI §Insert Tools, UI §Export-with-Dirty Warning, UI §File Menu Updates.

**Non-TC decided tests:** None.

Can run in parallel with Chunks 4 and 5.

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/components/insert-tools.test.ts | 4 | TC-9.1a–b, TC-9.2a–b |
| tests/client/components/cross-epic.test.ts | 8 | TC-8.1a–c, TC-8.2a–b, TC-10.1a, TC-10.2a–b |

**Red exit:** `npm run red-verify` passes. 12 new tests ERROR.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `insert-tools.ts` | Full: Cmd+K link insert, table insert dialog |
| `content-toolbar.ts` | Extension: export-with-dirty warning modal |
| `menu-bar.ts` | Verify Save/Save As items (may already work from Chunk 3) |

**Green exit:** `npm run green-verify` passes. All 531 tests PASS.

**Final total: 531 tests** (430 Epics 1–4 + 101 Epic 5)

---

## Chunk Dependencies

```
Chunk 0 (Infrastructure)
    │
    ▼
Chunk 1 (Server — Save + Render)
    │
    ▼
Chunk 2 (Client — Mode Switching + Editor)
    │
    ▼
Chunk 3 (Save, Save As, Dirty State)
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
Chunk 4 (Unsaved)   Chunk 5 (Conflict)  Chunk 6 (Insert + Cross-Epic)
```

Chunks 4, 5, and 6 can run in parallel after Chunk 3 completes.

---

## Manual Verification Checklist

After all chunks are Green:

1. [ ] Open a document, click Edit button — raw markdown appears with syntax highlighting
2. [ ] Headings, bold, italic, code, links visually distinct in editor
3. [ ] Line numbers visible in editor gutter
4. [ ] Cursor position (Ln/Col) shown in toolbar, updates on move
5. [ ] Type text — dirty dot appears on tab, "Modified" label in toolbar
6. [ ] Cmd+Z undoes edits; undo all the way back — dirty clears
7. [ ] Select text, copy (Cmd+C), paste (Cmd+V) — works normally
8. [ ] Switch to Render — shows rendered version of unsaved edits (not saved version)
9. [ ] Switch back to Edit — edits preserved, cursor approximately where you left off
10. [ ] Cmd+S — file saved, dirty clears, no conflict modal from self-change
11. [ ] Cmd+Shift+S — Save As dialog, save to new path, tab updates
12. [ ] Close dirty tab — modal: Save and Close / Discard / Cancel all work
13. [ ] Close Others with dirty tabs — prompts for each dirty tab
14. [ ] Close browser tab with dirty edits — browser shows "Changes may not be saved"
15. [ ] Modify open file externally while editing — conflict modal appears
16. [ ] Conflict: Keep My Changes — edits preserved
17. [ ] Conflict: Reload from Disk — editor shows new disk content, dirty clears
18. [ ] Conflict: Save Copy — dialog opens, copy saved, original reloaded
19. [ ] "Opens in" picker: select Edit — new tabs open in Edit mode
20. [ ] Export with dirty edits — warning modal: Save and Export / Export Anyway / Cancel
21. [ ] Cmd+K — insert link dialog (with selection → prefilled text)
22. [ ] Insert table tool — markdown table skeleton inserted
23. [ ] File menu has Save (Cmd+S) and Save As (Cmd+Shift+S)
24. [ ] Switch themes in Edit mode — editor colors update, no content loss
25. [ ] Open a 10K-line file in Edit mode — typing remains responsive
