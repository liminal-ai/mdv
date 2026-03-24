# Epic 9: Package Viewer Integration — Full Review

**Reviewer:** Codex CLI (gpt-5.4, high reasoning)
**Date:** 2026-03-24
**Working directory:** `/Users/leemoore/code/md-viewer/app`
**Token usage:** 9.3M input (9.1M cached), 30K output

---

## Critical Findings

### C-1: Path traversal via package manifest links

**Files:** `src/pkg/manifest/parser.ts:208`, `src/client/components/package-sidebar.ts:5`, `src/server/services/file.service.ts:33,78`

**Evidence:** `parseInlineNode()` preserves raw `href`; `toAbsolutePath()` concatenates `effectiveRoot` and `filePath` as a string; `FileService.readFile()`/`writeFile()` only enforce "absolute `.md` path", not containment under the active package root. A manifest entry like `[Host](../outside.md)` resolves outside `extractedRoot`.

**Recommended fix:** Resolve and normalize package-relative paths against `effectiveRoot`, reject any path escaping that root on both client and server, and make server-side file operations root-scoped rather than arbitrary absolute-path reads/writes.

---

## Major Findings

### M-1: No-manifest fallback does not load extracted file tree on open or restore

**Files:** `src/client/app.ts:820,2506`, `src/client/components/sidebar.ts:161`

**Evidence:** `handlePackageOpen()` sets `sidebarMode: 'fallback'` but never calls `api.getTree(extractedRoot)`; startup restore does the same. The fallback sidebar renders `state.tree`, so it will reuse whatever tree was already in memory instead of the extracted package contents.

**Recommended fix:** On fresh open and startup restore, fetch the extracted-root tree whenever `manifestStatus !== 'present'` and update `tree` before rendering fallback mode.

### M-2: CLI startup flow is not spec-complete

**Files:** `src/server/app.ts:64,79,88`

**Evidence:** Non-existent CLI paths only `console.warn`; non-package file paths are ignored rather than opened through existing file-open behavior; and `packageService.restore()` runs after CLI handling, so a persisted `activePackage` can overwrite the CLI-selected package.

**Recommended fix:** Give CLI args precedence over restore, surface startup errors through bootstrap/session state, and explicitly route non-package files into the existing file-open startup path.

### M-3: Package route validation contract is broken (500 instead of 400)

**Files:** `src/server/routes/package.ts:59,136,184`, `src/server/routes/session.ts:52`

**Evidence:** Unlike `session.ts`, package routes do not use `attachValidation` or handle `request.validationError`. Invalid path requests return 500 `FST_ERR_FAILED_ERROR_SERIALIZATION` responses instead of typed 400 API errors with documented `INVALID_*_PATH` codes.

**Recommended fix:** Add `attachValidation: true` and explicit 400 handlers for schema failures, or register a global validation error handler that returns `ErrorResponseSchema`-compatible payloads with documented codes.

### M-4: Export mutates source directory by writing `_nav.md`

**Files:** `src/server/services/package.service.ts:261`, `src/pkg/tar/create.ts:148`

**Evidence:** `PackageService.export()` relies on Epic 8 `createPackage()`. The library auto-scaffolds by writing `_nav.md` into `sourceDir` if missing, and the viewer unlinks it afterward. Source tree is modified during export, triggering watchers or leaving residue on failure. Violates AC-5.2b/design.

**Recommended fix:** Export from a staging directory or extend the package library with an in-memory/virtual manifest option so no manifest file is ever written into the source folder.

### M-5: Manifest status changes after save are not persisted

**Files:** `src/server/services/package.service.ts:178,190,392`

**Evidence:** `getManifest()` updates `this.state.manifestStatus`, `manifestError`, `navigation`, and `metadata`, but never calls `persistState()`. A manifest fixed from unreadable to valid, or broken from valid to unreadable, will keep stale `session.activePackage.manifestStatus` until some unrelated persistence event happens.

**Recommended fix:** Persist after both successful and failed re-parses.

### M-6: Test coverage nominally complete but materially misses required behaviors

**Files:** `tests/client/package/stale-indicator.test.ts:50`, `tests/client/package/mode-switching.test.ts:212`, `tests/server/package/package-create.test.ts:248`, `tests/client/package/fallback.test.ts:184`

**Evidence:**
- `TC-7.1b` only checks the stale badge, not rendered-view refresh after edit
- `TC-1.3b` never asserts the required startup error
- `TC-4.2b` tests server 409, not user cancel/no state change
- Fallback tests pre-seed `store.tree`, so they miss the broken tree-fetch integration entirely

**Recommended fix:** Add integration-style client tests around fallback open/restore, CLI startup errors, canceling overwrite, and post-save rendered refresh.

---

## Minor Findings

### m-1: Inconsistent `manifestPath` across entry paths in fallback mode

**Files:** `src/client/app.ts:826,2540`

**Evidence:** Direct package open always sets `manifestPath: ${extractedRoot}/_nav.md` even when manifest is missing/unreadable; restore only sets it when status is `present`.

**Recommended fix:** Make fallback state consistently use `manifestPath: null`.

### m-2: Package export has no user-visible success confirmation

**Files:** `src/client/app.ts:980,1003`

**Evidence:** Success is only logged with `console.info(...)`.

**Recommended fix:** Show a toast/panel using the existing notification/export-result UI.

### m-3: Temp-dir lifecycle ownership no longer matches the design

**Files:** `src/server/services/temp-dir.service.ts:10`, `src/server/services/package.service.ts:85,103`

**Evidence:** The design put "cleanup previous before create" in `TempDirManager.create()`, but current code creates first and cleans up the old dir in `PackageService.open()` only after successful extraction.

**Recommended fix:** Either move cleanup back into `TempDirManager.create()` or update the design/tests to reflect the new ownership and temporary dual-dir behavior.

---

## AC Coverage Matrix

| Story | AC | Impl | Test | Notes |
|-------|------|:----:|:----:|-------|
| 1 | AC-1.1 | Y | Y | File-menu open, extract, and package sidebar mode work |
| 1 | AC-1.2 | N | Y | Drag-drop is Electron-path only; browser mode has no real package-open path |
| 1 | AC-1.3 | N | Y | CLI package open exists, but restore can override it; missing/non-package paths not handled per spec |
| 1 | AC-1.4 | Y | Y | Nav entries open docs/tabs; missing-file UI coverage is weak |
| 1 | AC-1.5 | Y | Y | Group headings are non-clickable and collapsible |
| 2 | AC-2.1 | Y | Y | Metadata + filename fallback implemented |
| 2 | AC-2.2 | Y | Y | Package/folder indicators implemented |
| 2 | AC-2.3 | Y | Y | Hierarchy, nesting, and display names preserved |
| 3 | AC-3.1 | Y | Y | Folder open resets package state and closes package tabs |
| 3 | AC-3.2 | Y | Y | Opening a package switches to package mode |
| 3 | AC-3.3 | Y | Y | New package replaces old state and cleans old temp dir |
| 4 | AC-4.1 | Y | Y | Manifest scaffold + mode switch implemented |
| 4 | AC-4.2 | Y | Y | 409->confirm->retry implemented; cancel behavior weakly tested |
| 4 | AC-4.3 | Y | Y | Empty-directory scaffold handled |
| 4 | AC-4.4 | Y | Y | New Package disabled for extracted+parseable packages |
| 5 | AC-5.1 | Y | Y | `.mpk`/`.mpkz` export works |
| 5 | AC-5.2 | N | Y | Valid export works, but source dir is temporarily mutated by `_nav.md` write/delete |
| 5 | AC-5.3 | Y | Y | Re-export uses extracted root and stale clears on original path |
| 5 | AC-5.4 | Y | Y | Cancel path short-circuits export |
| 6 | AC-6.1 | Y | Y | Edit Manifest opens manifest in content area/tab |
| 6 | AC-6.2 | Y | Y | Save re-fetches manifest and updates sidebar |
| 6 | AC-6.3 | Y | Y | Parse errors surface and sidebar stays unchanged |
| 6 | AC-6.4 | Y | Y | Empty navigation warns and renders empty state |
| 7 | AC-7.1 | Y | Y | Writes hit extracted temp dir; rendered-refresh TC not faithfully tested |
| 7 | AC-7.2 | Y | Y | Client/server stale tracking implemented |
| 8 | AC-8.1 | N | Y | Fallback mode is set, but extracted tree never fetched on open/restore |
| 8 | AC-8.2 | Y | Y | Missing/unreadable indicators implemented |
| 8 | AC-8.3 | Y | Y | Fallback scaffolding switches to package mode and marks stale |
| 9 | AC-9.1 | Y | Y | Temp cleanup on switch implemented |
| 9 | AC-9.2 | Y | Y | Startup stale-dir cleanup implemented |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total ACs | 30 |
| Implemented | 26 |
| Tested | 30 |
| Total TCs (test plan) | 67 |
| TCs with test implementations | 67 |
| Materially faithful TC coverage | ~63 |
| Stubs/TODOs found | 0 |
| **Critical** | **1** |
| **Major** | **6** |
| **Minor** | **3** |

---

## Test Suite Verification

Focused verification run: `npm test -- tests/server/package tests/client/package tests/server/routes/package-open.test.ts`

**Result:** 17 files / 88 tests — all passing.

This reinforces that the main risk is spec/contract gaps and weak test fidelity rather than obvious red tests. The suite passes despite real behavioral gaps because tests pre-seed state or check proxies rather than exercising the full integration path.
