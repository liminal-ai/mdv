# Epic 5 Review: Edit Mode and Document Safety

**Reviewer:** Claude Opus 4.6
**Date:** 2026-03-21
**Scope:** Full epic-level review — spec, tech design, source code, and tests

---

## Executive Summary

Epic 5 is **production-ready**. The implementation faithfully delivers all 28 acceptance criteria across 10 feature flows. The codebase is clean, well-structured, and passes all quality gates (615/615 tests pass, zero lint errors, zero type errors). The architecture decisions are sound and consistent with the browser-first Fastify approach established in Epics 1-4.

No critical issues were found. A small number of minor issues and observations are documented below.

---

## Quality Gate Results

| Gate | Status | Detail |
|------|--------|--------|
| Tests | PASS | 615/615 pass (116 Epic 5 + 499 Epics 1-4) |
| TypeScript | PASS | Zero errors |
| ESLint | PASS | Zero warnings |
| Format | PASS | Clean |

---

## AC/TC Coverage Audit

### AC Coverage Summary

All 28 acceptance criteria are implemented. All ~76 test conditions are covered by automated tests or documented as manual-verify or deferred.

| AC | Description | Implemented | Tested | Notes |
|----|-------------|-------------|--------|-------|
| AC-1.1 | Mode toggle | Yes | Yes (13 tests) | mode-switching.test.ts |
| AC-1.2 | Content toolbar per mode | Yes | Yes | Cursor position + warnings |
| AC-2.1 | Editor with syntax highlighting | Yes | Yes (9 tests) | editor.test.ts |
| AC-2.2 | Standard text editing | Yes | Partial | TC-2.2b-d are native CodeMirror — manual verify |
| AC-2.3 | Theme adaptation | Yes | Yes | CSS custom properties, verified in editor.test.ts |
| AC-2.4 | Scroll position per tab | Yes | Yes | Percentage-based cross-mode mapping |
| AC-3.1 | Save to disk | Yes | Yes (13 server + 20 client) | Atomic write, mtime check |
| AC-3.2 | Save As | Yes | Yes | Consolidated save dialog |
| AC-3.3 | Save errors | Yes | Yes | 403, 404, 409, 415, 507 all covered |
| AC-4.1 | Tab dirty dot | Yes | Yes | tab-strip dirty dot rendering |
| AC-4.2 | Toolbar dirty indicator | Yes | Yes | "Modified" label |
| AC-4.3 | Per-tab dirty tracking | Yes | Yes | Independent per tab |
| AC-5.1 | Close dirty tab modal | Yes | Yes (13 tests) | Save/Discard/Cancel |
| AC-5.2 | Close multiple dirty tabs | Yes | Yes | Sequential modal per dirty tab |
| AC-5.3 | Quit protection | Yes | Yes | beforeunload (browser), Electron deferred |
| AC-6.1 | Conflict modal | Yes | Yes (16 tests) | Keep/Reload/Save Copy |
| AC-6.2 | Auto-reload clean tabs | Yes | Yes | Unchanged from Epic 2 |
| AC-6.3 | File deletion while editing | Yes | Yes | Notification + edits preserved |
| AC-7.1 | Default mode picker | Yes | Yes | Edit option enabled, persists |
| AC-7.2 | Existing tabs unaffected | Yes | Yes | Only new tabs use default |
| AC-8.1 | Export with dirty warning | Yes | Yes (8 tests) | Save and Export / Export Anyway / Cancel |
| AC-8.2 | File menu Save/Save As | Yes | Yes | Correct enabled/disabled state |
| AC-9.1 | Insert link | Yes | Yes (4 tests) | Cmd+K, selection-aware |
| AC-9.2 | Insert table | Yes | Yes | Rows/cols dialog, valid structure |
| AC-10.1 | Save errors preserve edits | Yes | Yes | Editor content unchanged on failure |
| AC-10.2 | Editor edge cases | Yes | Yes | Large file + binary content |

### TC Coverage Notes

- **TC-2.2b-d** (selection, copy/paste, cut): Native CodeMirror behaviors. Correctly scoped as manual-verify only. Not automatable with mocked editor. **Acceptable.**
- **TC-3.2d** (Save As overwrite): OS dialog behavior. Manual-verify only. **Acceptable.**
- **TC-5.3a-d** (Electron quit modal): Properly deferred to Epic 6. Browser `beforeunload` (TC-5.3e-f) is implemented and tested. **Acceptable.**

### Test Count Reconciliation

The test plan estimated 101 tests. The actual count is **116 tests** across Epic 5 files. The surplus comes from:
- Additional edge case tests beyond the spec (non-TC tests)
- More thorough conflict modal testing (16 vs planned 10)
- Additional keyboard shortcut tests (11 vs planned 6)
- Additional save flow tests (20 vs planned 17)

This is a healthy surplus — more coverage than planned, no missing coverage.

---

## Architecture Alignment

### Tech Design Compliance

The implementation closely follows the tech design with one intentional deviation documented in the UI companion:

**Dirty state diffing:** The tech design specified a hybrid approach (instant dirty flag + 300ms debounced string comparison). The implementation uses **per-keystroke string comparison** instead, as documented in `tech-design-ui.md` line 429: "the shipped code intentionally deviates here. We use per-keystroke string comparison to keep `dirty` and `editedSinceLastSave` always truthful immediately." The debounced truth check still exists as a fallback (`scheduleDirtyTruthCheck` in content-area.ts), but the primary path does immediate comparison. This is a **reasonable deviation** — the simplicity and truthfulness outweigh the negligible performance cost for files under 5MB.

### Module Architecture

All 7 new modules match the tech design specification:
- `server/routes/render.ts` — POST /api/render
- `server/routes/save-dialog.ts` — POST /api/save-dialog (consolidated)
- `server/utils/save-dialog.ts` — Shared osascript function
- `client/components/editor.ts` — CodeMirror wrapper
- `client/components/conflict-modal.ts` — Keep/Reload/Save Copy
- `client/components/unsaved-modal.ts` — Save/Discard/Cancel
- `client/components/insert-tools.ts` — Link and table insert

All 12 modified modules align with the tech design modification list.

### Data Flow

Both new data flows work correctly:
1. **Save flow:** Client → savePending → PUT /api/file → atomic write → response → clear dirty → WebSocket suppression
2. **Render-from-unsaved flow:** Client → POST /api/render → server renders in-memory → HTML + warnings → Mermaid post-processing → display

### External Boundaries

| Boundary | Status | Notes |
|----------|--------|-------|
| Filesystem write (fs.writeFile + fs.rename) | Properly mocked in tests | Atomic write pattern correct |
| osascript (save dialog) | Properly mocked in tests | JSON.stringify escaping + execFile (no shell) |
| CodeMirror (in-process) | Properly mocked at class boundary | Editor class mock is clean |
| WebSocket (file-change events) | Properly mocked | savePending suppression tested |

---

## Findings

### Critical Issues

**None.**

### Major Issues

**None.**

### Minor Issues

#### M-1: Conflict modal Escape key dismissal maps to "Keep My Changes"

**Location:** `client/components/conflict-modal.ts:92`
**Observation:** When the user presses Escape on the conflict modal, it calls `actions.onKeep()`, which is equivalent to "Keep My Changes." This is a reasonable default (non-destructive — preserves local edits), but it differs from the unsaved modal where Escape maps to `actions.onCancel()` which preserves the modal state. The epic does not specify Escape behavior for the conflict modal, so this is implementation-level discretion, not a spec violation.
**Risk:** Low. Non-destructive behavior. User can always re-trigger the conflict by saving.
**Recommendation:** Document this behavior if not already documented. No code change needed.

#### M-2: `renderGeneration` field is optional (`number | undefined`) in TabState

**Location:** `client/state.ts:30`
**Observation:** `renderGeneration` is typed as `renderGeneration?: number` (optional). In `content-area.ts` it's accessed with fallback: `(tab.renderGeneration ?? 0)` and `(tab.renderGeneration ?? -1) + 1`. While this works correctly, making it a required field with a default of `0` (already done in `createLoadingTab` and `buildLoadedTab`) would eliminate the need for nullish coalescing throughout the code.
**Risk:** None — functionally correct as-is.
**Recommendation:** Consider making `renderGeneration` required with `default: 0` for cleaner code. Not blocking.

#### M-3: Insert tools guard against JSDOM environment

**Location:** `client/components/content-area.ts:603-608`
**Observation:** The `handleInsertLink` function has an explicit JSDOM check: `navigator.userAgent.toLowerCase().includes('jsdom')`. This is a test environment workaround — `window.prompt` exists in JSDOM but doesn't work interactively. While functional, embedding test environment detection in production code is a minor code smell.
**Risk:** None — the guard prevents errors in test environments.
**Recommendation:** Consider moving this check to the test setup (e.g., stubbing `window.prompt` to return `null` in tests) rather than adding a JSDOM check in production code. Not blocking.

#### M-4: `EditorOptions.shouldSuppressUpdates` in tech design not in implementation

**Location:** Tech design UI §CodeMirror Integration vs `client/components/editor.ts`
**Observation:** The tech design specifies `shouldSuppressUpdates: () => boolean` as a callback in `EditorOptions`. The implementation uses only the internal `suppressUpdates` flag (set/cleared in `setContent`). This is actually simpler and achieves the same goal. The external callback is unnecessary since the only suppression needed is during `setContent`.
**Risk:** None — simplification is correct.
**Recommendation:** None needed. The implementation is cleaner than the design.

### Observations (No Action Required)

#### O-1: Test count exceeds plan estimate by 15%

116 actual vs 101 planned. This is a positive indicator — additional edge case coverage was added during implementation. The test plan was a conservative estimate.

#### O-2: CodeMirror packages are production dependencies

The tech design notes CodeMirror 6 is ~150KB minified. The packages are correctly listed as dependencies (not devDependencies) since they're bundled into the client. This is consistent with the POC approach.

#### O-3: Export save dialog successfully consolidated

Epic 4's `/api/export/save-dialog` was consolidated into the generic `/api/save-dialog` endpoint. The `api.exportSaveDialog()` method now calls the consolidated endpoint with `prompt: 'Export document'`. Clean consolidation with no backward compatibility issues.

#### O-4: Self-change suppression timing

The `savePending` flag is cleared after 500ms via `SAVE_PENDING_CLEAR_DELAY_MS`. This provides a 200ms margin over the watcher's 300ms debounce. In practice, this is robust — the watcher event arrives well within this window. If the save fails but the watcher already suppressed a change, the next external modification will be detected normally.

#### O-5: Stale render guard uses `renderGeneration` counter

The content area uses a `renderGeneration` counter (incremented on mode switch) to prevent stale async render results from overwriting fresh ones. This is stronger than checking `activeTabId` alone — it handles rapid mode toggles on the same tab. Well-designed.

---

## Security Assessment

### File Write Path

The file write path has proper validation:
1. **Path must be absolute** — Zod schema + service validation
2. **Markdown extension required** — `.md` or `.markdown` only
3. **Parent directory must exist** — `fs.stat` check
4. **Optimistic concurrency** — `expectedModifiedAt` prevents silent overwrites
5. **Atomic write** — temp file + rename pattern

No path traversal risk: the path is validated as absolute and the extension is restricted.

### osascript / Save Dialog

- Uses `execFile` (not `exec`) — no shell interpolation risk
- Parameters are escaped via `JSON.stringify` — AppleScript string injection mitigated
- 60-second timeout prevents hanging dialogs

### Client-Side

- No `eval()` or `innerHTML` injection from user-edited content (content goes to CodeMirror, not `innerHTML`)
- Render-from-content flow sends raw markdown to server for rendering through DOMPurify — XSS mitigated
- `beforeunload` handler properly prevents/allows events

**Overall security posture: Good.** No vulnerabilities identified.

---

## Interface Compliance

### API Contracts

| Endpoint | Spec | Implemented | Match |
|----------|------|-------------|-------|
| PUT /api/file | FileSaveRequest → FileSaveResponse | Yes | Yes |
| POST /api/render | { content, documentPath } → { html, warnings } | Yes | Yes |
| POST /api/save-dialog | { defaultPath, defaultFilename, prompt? } → { path } \| null | Yes | Yes |

All error codes match the spec: 400 INVALID_PATH, 403 PERMISSION_DENIED, 404 PATH_NOT_FOUND, 409 CONFLICT, 415 NOT_MARKDOWN, 500 WRITE_ERROR, 507 INSUFFICIENT_STORAGE.

### Client State

TabState extension matches the epic data contract:
- `mode: 'render' | 'edit'` — present
- `editContent: string | null` — present
- `cursorPosition: { line, column } | null` — present
- `dirty: boolean` — present
- `editedSinceLastSave: boolean` — present (implementation addition for fast-path dirty)
- `editScrollPosition: number` — present (implementation addition)
- `renderGeneration?: number` — present (implementation addition for stale-render guard)

The implementation additions (`editedSinceLastSave`, `editScrollPosition`, `renderGeneration`) are all justified by the tech design.

### Schema Validation

All schemas properly defined in `server/schemas/index.ts` with Zod:
- `FileSaveRequestSchema` — includes `expectedModifiedAt: z.string().datetime().nullable().optional()`
- `FileSaveResponseSchema` — path, modifiedAt, size
- `RenderFromContentRequestSchema` — content, documentPath
- `RenderFromContentResponseSchema` — html, warnings
- `SaveDialogRequestSchema` — defaultPath, defaultFilename, prompt?
- `SetDefaultModeRequestSchema` — updated to `z.enum(['render', 'edit'])`

---

## Test Quality Assessment

### Server Tests (22 tests)

| File | Tests | Quality |
|------|-------|---------|
| file-save.test.ts | 13 | Excellent — full error path coverage, atomic write verification |
| render.test.ts | 5 | Good — renders from content, image resolution, warnings |
| save-dialog.test.ts | 4 | Good — dialog, cancel, custom prompt, error |

Mock strategy is consistent with Epics 1-4: `vi.mock('node:fs/promises')` for filesystem, `vi.mock('node:child_process')` for osascript.

### Client Tests (94 tests)

| File | Tests | Quality |
|------|-------|---------|
| mode-switching.test.ts | 13 | Excellent — full app rendering with mock editor |
| editor.test.ts | 9 | Good — cursor, dirty, theme, scroll |
| save.test.ts | 20 | Excellent — comprehensive save flows |
| unsaved-modal.test.ts | 13 | Excellent — all modal paths + multi-tab close |
| conflict-modal.test.ts | 16 | Excellent — all three choices + edge cases |
| insert-tools.test.ts | 4 | Good — link and table insertion |
| cross-epic.test.ts | 8 | Good — export warning, file menu, edge cases |
| keyboard-epic5.test.ts | 11 | Good — all shortcuts + no-op cases |

Mock strategy is well-organized: Editor class mocked at import boundary, API client mocked per test, WebSocket events simulated.

### Test Strengths

- Zero skipped tests
- Proper `beforeEach`/`afterEach` lifecycle management
- Test isolation via `store` cleanup
- TC IDs referenced in test descriptions for traceability
- Non-TC tests documented with explanations

### Test Gaps (Minor)

None significant. The only TCs not covered by automated tests are native CodeMirror behaviors (selection, copy/paste, cut) and OS dialog behavior (Save As overwrite), both correctly documented as manual-verify in the test plan.

---

## Deferred Items Verification

All deferred items from the tech design are properly documented and non-blocking:

| Item | Deferred To | Blocking? |
|------|-------------|-----------|
| Custom quit modal with file listing | Epic 6 (Electron) | No |
| Auto-save | Future | No |
| Find and replace in editor | Future (CodeMirror search already bundled) | No |
| Split pane preview | Future | No |
| File > New | Future | No |
| Custom inline insert dialogs | Future (prompt() is sufficient for v1) | No |

---

## Conclusion

Epic 5 is a thorough, well-executed implementation that delivers all specified functionality with good code quality, comprehensive testing, and proper security practices. The architecture aligns with the tech design, deviations are documented and justified, and all quality gates pass cleanly.

**Recommendation: Ship.**
