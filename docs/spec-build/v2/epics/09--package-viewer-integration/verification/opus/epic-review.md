# Epic 9: Package Viewer Integration — Full Epic Review

**Reviewer:** Opus (epic-level verification pass)
**Date:** 2026-03-24
**Scope:** All 30 ACs, 67 TCs, full implementation + test suite

---

## Executive Summary

Epic 9 is **ship-ready**. All 30 ACs are implemented, all 67 TCs are covered by tests, all 900 tests pass (including 88 package-specific tests across 17 test files), no `NotImplementedError` stubs remain, and the architecture closely follows the tech design. The implementation is clean, well-integrated with Epic 8's library, and the client-server boundary is handled correctly.

Three minor issues and two observations are documented below. None are blockers.

---

## Test Execution

```
Test Files:  95 passed (95)
Tests:       900 passed (900)
Duration:    28.54s
```

All tests pass. No skipped or failing tests.

---

## AC Coverage Matrix

All 30 ACs verified as implemented and tested:

| AC | Description | Server | Client | Tests | Status |
|----|-------------|--------|--------|-------|--------|
| AC-1.1 | Open .mpk/.mpkz via File menu | `PackageService.open()`, `POST /api/package/open` | `openPackage()`, menu-bar | TC-1.1a–c | ✅ |
| AC-1.2 | Drag-and-drop opens package | — | `handleDocumentDrop` in app.ts | TC-1.2a–b | ✅ |
| AC-1.3 | CLI argument opens package | `buildApp()` cliArg extension check | Bootstrap restore | TC-1.3a–c | ✅ |
| AC-1.4 | Navigation entry opens document | Existing `/api/file` (transparent) | `package-sidebar.ts` click handler | TC-1.4a–e | ✅ |
| AC-1.5 | Group labels non-clickable | — | `renderNode` isGroup branch | TC-1.5a–b | ✅ |
| AC-2.1 | Package metadata display | Manifest metadata in open response | `package-header.ts` | TC-2.1a–c | ✅ |
| AC-2.2 | Mode indicator | — | `package-header.ts` ("Package"), `sidebar.ts` ("Folder") | TC-2.2a–b | ✅ |
| AC-2.3 | Navigation tree hierarchy | `parseManifest` preserves nesting | `renderNode` recursive | TC-2.3a–c | ✅ |
| AC-3.1 | Package → filesystem switch | `session.ts` calls `packageService.close()` | `switchRoot` resets packageState | TC-3.1a–b | ✅ |
| AC-3.2 | Filesystem → package switch | Open flow replaces state | State update triggers sidebar re-render | TC-3.2a | ✅ |
| AC-3.3 | Replace current package | `TempDirManager.create()` + cleanup | `closePreviousTabs()` | TC-3.3a | ✅ |
| AC-4.1 | New Package scaffolds manifest | `PackageService.create()` | `handlePackageCreated()` | TC-4.1a–d | ✅ |
| AC-4.2 | Existing manifest confirmation | 409 `MANIFEST_EXISTS` response | `window.confirm` + retry with overwrite | TC-4.2a–b | ✅ |
| AC-4.3 | Empty directory | `scaffoldManifest` returns empty | Sidebar shows empty state | TC-4.3a | ✅ |
| AC-4.4 | Disabled for extracted packages | — | `menu-bar.ts` `isExtractedWithManifest` check | TC-4.4a | ✅ |
| AC-5.1 | Export to .mpk/.mpkz | `PackageService.export()` | `handleExportPackage()` | TC-5.1a–c | ✅ |
| AC-5.2 | Auto-scaffold on export | Epic 8 `createPackage` auto-scaffolds | Source dir cleaned up after | TC-5.2a–b | ✅ |
| AC-5.3 | Re-export clears stale | `clearStale()` on sourcePath match | Client mirrors stale clear | TC-5.3a–c | ✅ |
| AC-5.4 | Cancel export | — | `saveDialog` null check | TC-5.4a | ✅ |
| AC-6.1 | Open manifest in editor | — | `onEditManifest` opens manifestPath | TC-6.1a–b | ✅ |
| AC-6.2 | Edit manifest updates sidebar | `getManifest()` re-parses | Manifest re-sync on save detection | TC-6.2a–d | ✅ |
| AC-6.3 | Malformed YAML retains sidebar | `ManifestParseError` → 422 | Catch 422, don't update navigation | TC-6.3a | ✅ |
| AC-6.4 | Empty navigation warning | Empty array returned | `setClientError` warning | TC-6.4a | ✅ |
| AC-7.1 | Edits modify temp dir | Existing `/api/file` save | Existing save flow | TC-7.1a–b | ✅ |
| AC-7.2 | Stale indicator | `markStale()` via onResponse hook | `package-header.ts` conditional render | TC-7.2a–c | ✅ |
| AC-8.1 | No-manifest fallback | `manifestStatus: 'missing'` in open response | `sidebarMode: 'fallback'` | TC-8.1a–c | ✅ |
| AC-8.2 | Fallback indicator | — | `sidebar.ts` fallback mode rendering | TC-8.2a–c | ✅ |
| AC-8.3 | Scaffold manifest in fallback | `create()` targets extractedRoot | `handleNewPackage` fallback branch | TC-8.3a–b | ✅ |
| AC-9.1 | Temp cleanup on switch | `TempDirManager.create()` / `cleanup()` | — | TC-9.1a | ✅ |
| AC-9.2 | Startup stale cleanup | `TempDirManager.cleanupStale()` | — | TC-9.2a | ✅ |

---

## Interface Compliance

### REST Endpoints

| Endpoint | Spec | Implementation | Match |
|----------|------|----------------|-------|
| `POST /api/package/open` | Epic data contract | `routes/package.ts` line 59 | ✅ |
| `GET /api/package/manifest` | Epic data contract | `routes/package.ts` line 93 | ✅ |
| `POST /api/package/create` | Epic data contract | `routes/package.ts` line 136 | ✅ |
| `POST /api/package/export` | Epic data contract | `routes/package.ts` line 184 | ✅ |
| `GET /api/package/file` | Eliminated per tech design | Not implemented (correct) | ✅ |
| `POST /api/package/pick` | Not in spec (addition) | `routes/package.ts` line 227 | See Minor #1 |

### Schemas

All Zod schemas in `schemas/package.ts` match the epic's TypeScript interfaces exactly. The `DeferredAbsolutePathSchema` using `z.lazy()` is a necessary adaptation for circular schema resolution — clean implementation.

### Error Codes

All 13 error codes from the epic are defined in `PackageErrorCode` and correctly mapped to HTTP status codes in the route handlers.

---

## Architecture Alignment

| Design Decision | Tech Design | Implementation | Match |
|-----------------|-------------|----------------|-------|
| Extract-to-temp strategy | Yes | `TempDirManager` + `PackageService.open()` | ✅ |
| Reuse existing `/api/file` for extracted content | Yes | Client constructs absolute paths | ✅ |
| Client-initiated manifest re-fetch | Yes | Save flow detects manifest path, calls `GET /api/package/manifest` | ✅ |
| Flag-on-write stale detection | Yes | `onResponse` hook on `PUT /api/file` | ✅ |
| Session state extension | Yes | `ActivePackageSchema` in session | ✅ |
| Sidebar mode switching via state | Yes | `packageState.sidebarMode` drives `renderMode()` | ✅ |
| Package service wraps Epic 8 | Yes | All 5 Epic 8 functions imported and used | ✅ |

**Positive deviation:** `TempDirManager.create()` does NOT cleanup the previous temp dir (unlike the tech design). Instead, `PackageService.open()` creates the new temp dir first, then cleans up the old one only on successful extraction. This is **better** than the design — it preserves the previous package if extraction fails, providing a safer rollback path.

---

## Findings

### Minor Issues

**Minor #1: Unspecified `/api/package/pick` endpoint**

`routes/package.ts` includes a `POST /api/package/pick` endpoint (lines 227–253) that uses `osascript` to open a macOS file picker for `.mpk`/`.mpkz` files. This endpoint is not in the epic or tech design. It's a sensible platform-specific addition that enables the File → Open Package menu action, but it:
- Is macOS-only (uses `osascript`)
- Has no test coverage
- Has no error code spec

**Impact:** Low. Works correctly for the target platform. Should be documented.

**Minor #2: Export auto-scaffold temporarily modifies source directory**

For AC-5.2 (export folder without manifest), Epic 8's `createPackage()` internally writes a scaffolded manifest to the source directory, then `PackageService.export()` removes it after packaging (lines 276–278). This creates a brief window where the source directory contains a manifest file, technically violating the spirit of TC-5.2b ("no manifest file is created in the source directory"). If `createPackage()` fails after writing the manifest, the cleanup `fs.unlink()` won't execute, leaving the manifest on disk.

**Impact:** Low. The window is brief (milliseconds). A failure during `createPackage` after manifest write is unlikely. The cleanup handles the success path correctly.

**Minor #3: Performance tests may be flaky in CI**

Two client tests measure rendering performance (100+ entries in <100ms). Timing-based tests can fail on slow CI runners or under load.

**Impact:** Low. Thresholds are generous. Not observed as failing.

### Observations (Informational)

**Observation 1: Test count exceeds plan**

The test plan specified 80 tests. The implementation has ~88 package-specific tests across 17 files (9 server, 7 client, 1 route). The additional tests come from:
- `package-open.test.ts` (route-level test not in original plan) — 4 tests
- CLI argument tests duplicated in both server and client mode-switching files
- Additional non-TC tests added during implementation

This is directionally positive — more coverage than planned.

**Observation 2: `handlePackageOpen` always sets `manifestPath` regardless of manifest status**

In `app.ts` line 838, `manifestPath` is set to `${packageInfo.extractedRoot}/${MANIFEST_FILENAME}` even when `manifestStatus` is `'missing'`. This is harmless because the manifest re-sync check (line 1247) also requires `pkgState.manifestPath && tabToSave.path === pkgState.manifestPath`, and a non-existent file can never be the saved file. But it's a minor imprecision — the tech design client companion only sets `manifestPath` when `manifestStatus === 'present'`.

---

## Boundary Inventory

### Epic 8 Library Functions

| Function | Used By | Status |
|----------|---------|--------|
| `extractPackage()` | `PackageService.open()` | ✅ Real implementation |
| `parseManifest()` | `PackageService.open()`, `getManifest()` | ✅ Real implementation |
| `createPackage()` | `PackageService.export()` | ✅ Real implementation |
| `scaffoldManifest()` | `PackageService.create()` | ✅ Real implementation |
| `MANIFEST_FILENAME` | Service + client imports | ✅ Exported constant (`_nav.md`) |

No stubs, no `NotImplementedError` throws remaining anywhere in `app/src/`.

### Integration Points Verified

- **Session persistence:** `activePackage` field added to `SessionStateSchema`, correctly nullable with default null
- **File watching:** Existing `WatchService` works on extracted temp dirs (transparent via absolute paths)
- **Tab management:** Tabs reference absolute paths under `extractedRoot`; `closePreviousTabs()` correctly filters by prefix
- **Package close on root switch:** `session.ts` line 99 calls `packageService?.close()` before `setRoot()`
- **Client package state reset:** `switchRoot()` in app.ts line 749 calls `getDefaultPackageState()`

---

## Test Quality Assessment

### Strengths
- Clear TC-to-test traceability — every test name includes the TC ID
- Mock boundary is correct — Epic 8 library mocked at module boundary, internal logic exercised
- Both service-level and route-level tests for server endpoints
- Client tests verify DOM output (not just state), using real DOM assertions
- Good edge case coverage: empty dirs, malformed manifests, missing files, cancel flows

### No False-Positive Risks Identified
- Tests assert specific values, not just truthiness
- Mock return values match realistic Epic 8 output shapes
- State assertions check specific field values after operations

---

## Verdict

**SHIP IT.** All 30 ACs implemented. All 67 TCs covered. All 900 tests pass. Architecture matches design with one positive deviation. Three minor issues documented — none are blockers. The implementation is clean, well-tested, and correctly integrates with Epic 8's library.
