# Epic 9 — Package Viewer Integration: Verification Review

**Reviewer:** GPT-5.4 (Codex CLI)
**Session:** `019d2148-e9f3-7203-8377-76aac10b48fe`
**Date:** 2026-03-24
**Tokens:** 4.6M input (96% cached), 28.7K output
**Recommendation:** FAIL

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total ACs | 30 |
| Fully Met | 22 |
| Partial | 6 |
| Failing | 2 |
| AC coverage | 73% fully met, 87% at least partial |
| Package tests passing | 88 (51 server, 37 client) |
| Stubs/TODOs found | 0 |
| Critical findings | 2 |
| Major findings | 5 |
| Minor findings | 3 |

### Top 3 Risks

1. No-manifest/unreadable packages do not reliably show their extracted filesystem tree on open or restore
2. CLI startup flows are broken in edge cases and can crash startup or ignore the requested file
3. Package API contracts are not robust at the validation boundary — emit unexpected 500s for malformed requests

---

## Critical (blocks release)

### C1: Fallback open/restore broken for no-manifest and unreadable-manifest packages

`handlePackageOpen()` switches to fallback mode but never fetches or applies the extracted tree, so the sidebar can show stale/empty data instead of the package contents.

- **Files:** `src/client/app.ts` ~L820, ~L846
- **Bootstrap path:** Restores `activePackage` without repointing the tree to `activePackage.extractedRoot` — restored fallback sessions are also wrong (~L2491, ~L2526)
- **Impact:** Fails AC-8.1 end-to-end
- **Fix:** After entering fallback mode, call `getTree()` with the extracted root and populate the sidebar tree. Bootstrap restore must do the same for persisted fallback sessions.

### C2: CLI package startup is not spec-compliant and can hard-fail startup

For `.mpk`/`.mpkz` args, `buildApp()` calls `packageService.open()` with no recovery path — a missing package path throws and aborts startup instead of leaving the app in an empty state with an error.

- **Files:** `src/server/app.ts` ~L64, ~L71, ~L88
- **Issues:**
  - Missing package path → unhandled throw → startup crash
  - Non-package file args are ignored rather than handed to existing file-open behavior
  - `restore()` runs after CLI handling, so persisted session state can overwrite the CLI-selected package
- **Impact:** Breaks AC-1.3
- **Fix:** Wrap CLI package open in try/catch with graceful degradation. Handle non-package file args. Run `restore()` before CLI arg handling (or skip restore when CLI arg is present).

---

## Major (should fix before release)

### M1: Package route validation is wrong at the API boundary

`POST /api/package/open`, `POST /api/package/create`, and `POST /api/package/export` do not use `attachValidation` or custom validation handling, unlike the session/file routes. Invalid relative paths currently return `500 FST_ERR_FAILED_ERROR_SERIALIZATION`, not the documented `400 INVALID_FILE_PATH` / `INVALID_DIR_PATH` / `INVALID_OUTPUT_PATH`.

- **Files:** `src/server/routes/package.ts` ~L59, ~L136 (compare `src/server/routes/session.ts` ~L52)
- **Fix:** Add `attachValidation: true` and validation error handling consistent with the session/file route pattern.

### M2: Export auto-scaffold cleanup is not safe on failure

`PackageService.export()` relies on the Epic 8 library to write `_nav.md` into the source dir when one is missing, then deletes it only after a successful export. If `createPackage()` fails after scaffolding, the source folder is mutated.

- **Files:** `src/server/services/package.service.ts` ~L261, `src/pkg/tar/create.ts` ~L148
- **Impact:** Violates AC-5.2b (source directory should not be modified on export failure)
- **Fix:** Write the auto-scaffolded manifest to a temp location and include it in the archive from there, or roll back on failure.

### M3: Test suite overstates TC coverage

Several tests are mislabeled or only cover a lower-level surrogate for the test condition they claim:

| Test | Labeled | Actually tests |
|------|---------|---------------|
| `package-manifest.test.ts` ~L135 | TC-6.1a | `GET /api/package/manifest`, not the UI "Edit Manifest" action |
| `stale-indicator.test.ts` ~L50 | TC-7.1b | Stale badge only, not rendered-content refresh after edit |
| `mode-switching.test.ts` ~L212 (client) | TC-1.3 | Different cases, not a missing `.mpk` CLI path |
| `mode-switching.test.ts` ~L194 (server) | TC-1.3b | Non-existent path, but not the full startup crash scenario |
| `package-service.test.ts` ~L217 | TC-1.4d | Does not test clicking a missing manifest entry or content-area error path |

- **Impact:** Traceability is weaker than it appears; some ACs appear covered but are not truly validated
- **Fix:** Add or relabel tests to match actual TC scope.

### M4: Undocumented `/api/package/pick` endpoint

The implementation includes a route-only `/api/package/pick` AppleScript picker endpoint that is not in the tech design and bypasses the route -> service -> filesystem layering.

- **File:** `src/server/routes/package.ts` ~L227
- **Fix:** Either document in tech design (if intentional) or route through the service layer.

### M5: Partial AC implementations with incomplete test coverage

Several ACs are marked Partial due to implementation gaps or missing test coverage:

- **AC-1.2** (drag-and-drop): Implementation exists but test coverage is incomplete
- **AC-1.4** (navigation click → content): Missing content-area error path test for invalid entries
- **AC-4.2** (create with existing manifest): Partial test coverage on the server side
- **AC-5.2** (export safety): Auto-scaffold failure path not tested
- **AC-6.1** (edit manifest UI action): Test covers API endpoint not UI trigger
- **AC-6.3** (manifest re-parse after save): Partial test coverage
- **AC-6.4** (manifest error display): Partial test coverage
- **AC-7.1** (stale on edit): Only badge tested, not content refresh
- **AC-7.2** (stale clear on re-export): Partial server-side coverage

---

## Minor (nice to fix)

### m1: TempDirManager.create() doesn't clean previous temp dir

The design specified that `TempDirManager.create()` itself would clean the previous active temp dir, but the actual responsibility is split into `PackageService.open()`.

- **File:** `src/server/services/temp-dir.service.ts` ~L10
- **Impact:** Works correctly but deviates from documented responsibility boundary

### m2: manifestPath set in fallback mode

`handlePackageOpen()` sets `manifestPath` even in fallback mode, while the client design expected `null` there.

- **File:** `src/client/app.ts` ~L838
- **Impact:** Could cause UI to show "Edit Manifest" action when it shouldn't be available in fallback

### m3: Hardcoded macOS osascript usage

The package picker route uses hardcoded macOS `osascript` for the file dialog.

- **File:** `src/server/routes/package.ts` ~L29
- **Impact:** Platform portability concern (minor given the project's macOS-first target)

---

## AC Coverage Matrix

| AC | Primary Implementation | Primary Tests | Verdict |
|----|----------------------|---------------|---------|
| AC-1.1 | package.service.ts, client/app.ts | package-service.test.ts, package-open.test.ts | **Met** |
| AC-1.2 | client/app.ts | mode-switching.test.ts (client) | **Partial** |
| AC-1.3 | server/app.ts | mode-switching.test.ts (server+client) | **Fail** |
| AC-1.4 | package-sidebar.ts, client/app.ts, content-area.ts | package-sidebar.test.ts, package-service.test.ts | **Partial** |
| AC-1.5 | package-sidebar.ts | package-sidebar.test.ts | **Met** |
| AC-2.1 | package-header.ts | package-sidebar.test.ts | **Met** |
| AC-2.2 | package-header.ts, sidebar.ts | package-sidebar.test.ts | **Met** |
| AC-2.3 | package-sidebar.ts | package-sidebar.test.ts | **Met** |
| AC-3.1 | session.ts, client/app.ts | mode-switching.test.ts (server+client) | **Met** |
| AC-3.2 | client/app.ts | mode-switching.test.ts (client) | **Met** |
| AC-3.3 | package.service.ts, temp-dir.service.ts | mode-switching.test.ts (server), temp-cleanup.test.ts | **Met** |
| AC-4.1 | package.service.ts, client/app.ts | package-create.test.ts (server+client) | **Met** |
| AC-4.2 | package.service.ts, client/app.ts | package-create.test.ts (server) | **Partial** |
| AC-4.3 | package.service.ts | package-create.test.ts (server) | **Met** |
| AC-4.4 | menu-bar.ts | package-create.test.ts (client) | **Met** |
| AC-5.1 | package.service.ts, client/app.ts | package-export.test.ts (server) | **Met** |
| AC-5.2 | package.service.ts | package-export.test.ts (server) | **Partial** |
| AC-5.3 | package.service.ts, client/app.ts | package-export.test.ts (server+client) | **Met** |
| AC-5.4 | client/app.ts | package-export.test.ts (client) | **Met** |
| AC-6.1 | package-header.ts, client/app.ts | manifest-editing.test.ts, package-manifest.test.ts | **Partial** |
| AC-6.2 | client/app.ts, package.service.ts | manifest-editing.test.ts, package-manifest.test.ts | **Met** |
| AC-6.3 | package.service.ts, package.ts, client/app.ts | package-manifest.test.ts | **Partial** |
| AC-6.4 | package.service.ts, client/app.ts | package-manifest.test.ts | **Partial** |
| AC-7.1 | file.ts, client/app.ts | stale-tracking.test.ts, stale-indicator.test.ts | **Partial** |
| AC-7.2 | package.service.ts, package-header.ts, client/app.ts | stale-tracking.test.ts, stale-indicator.test.ts | **Partial** |
| AC-8.1 | package.service.ts, sidebar.ts, client/app.ts | fallback.test.ts (server+client) | **Fail** |
| AC-8.2 | sidebar.ts | fallback.test.ts (client) | **Met** |
| AC-8.3 | package.service.ts, client/app.ts | fallback.test.ts (server+client) | **Met** |
| AC-9.1 | temp-dir.service.ts, package.service.ts | temp-cleanup.test.ts, mode-switching.test.ts (server) | **Met** |
| AC-9.2 | temp-dir.service.ts, server/app.ts | temp-cleanup.test.ts | **Met** |

---

## Boundary Inventory

- **Stubs/TODOs:** None found
- **Commented-out code:** None found
- **Hardcoded values:** macOS `osascript` in package picker route (platform-specific)
- **Temporary workarounds:** None found

---

## Methodology

The reviewer:
1. Read all spec files (epic, tech-design, tech-design-server, tech-design-client, test-plan, stories)
2. Read all 14 implementation source files
3. Read all test files in `tests/server/package/`, `tests/client/package/`, and `tests/server/routes/package-open.test.ts`
4. Ran `npx vitest run tests/server/package tests/server/routes/package-open.test.ts` and `npx vitest run tests/client/package` to verify test status
5. Cross-referenced every AC against implementation code and test coverage
6. Verified API contracts against tech-design schemas
7. Checked architecture alignment against tech-design layering
8. Inspected integration points between stories
