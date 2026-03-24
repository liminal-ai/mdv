# Story 6: Folder-Mode Chat and Error Handling

---

### Summary
<!-- Jira: Summary field -->

Package operations work on regular folders through chat, file operations are confirmed in folder mode, all script method errors produce descriptive results, context injection handles degraded package state, and all Epic 13 functionality remains gated behind `FEATURE_SPEC_STEWARD`.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Working within spec packages containing PRDs, epics, tech designs, and stories. The Steward already knows what document is open (Epic 12) but cannot see the broader package structure, read other files, create new files, or understand where the user is in the spec lifecycle.

**Objective:** Package operations through chat work when the current workspace is a regular folder, not a package. The developer can create a package from a folder, export a folder, and perform file operations — all through chat, regardless of the current sidebar mode. Errors in all script methods produce descriptive error results returned to the CLI without crashing the server or corrupting workspace state. Context injection handles degraded package state gracefully. All functionality remains gated behind `FEATURE_SPEC_STEWARD`. After this story, "create a package from this folder" works in folder mode, error messages are informative, and the feature flag provides complete isolation.

**Scope:**

In scope:
- `createPackage()` in folder mode: scaffold manifest via `PackageService.create()`, send `chat:package-changed` with `created`, sidebar switches to package mode
- `createPackage()` in extracted package with missing/unreadable manifest (fallback repair): scaffold manifest directly via `scaffoldManifest()`, update session `manifestStatus`, trigger stale
- `createPackage()` with existing manifest: error without `overwrite: true`; overwrite replaces manifest
- `exportPackage()` in folder mode: auto-scaffold manifest in memory (not written to source folder, per Epic 9 AC-5.2)
- `exportPackage()` with existing manifest: use existing manifest
- File operations (`addFile`, `getFileContent`, `editFile`) confirmed in folder mode
- Error handling: all script method errors return descriptive error results to CLI
- Context injection error handling: package service failure → message sent without package context; malformed manifest → `manifestStatus: 'unreadable'`
- Feature isolation: `FEATURE_SPEC_STEWARD` disabled → no package context, no spec detection, no extended indicator

Out of scope:
- Workspace switching (Epic 14)
- Formal error recovery UI
- Error code persistence or aggregation

**Dependencies:**
- Stories 3 and 4 complete (package operations, file operations)
- Story 5 complete (spec awareness — needed for feature flag isolation verification)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-7.1:** The Steward can create a package from the current folder through chat

- **TC-7.1a: Create package in folder mode**
  - Given: A regular folder is open (no manifest)
  - When: The Steward calls `createPackage()`
  - Then: A manifest is scaffolded in the directory (same scaffolding rules as Epic 9 AC-4.1 — alphabetical sort, dotfiles excluded); `chat:package-changed` with `change: 'created'` is sent; the sidebar switches to package mode

- **TC-7.1b: Create package when manifest exists — no overwrite by default**
  - Given: A folder is open that already contains a manifest
  - When: The Steward calls `createPackage()` without `overwrite: true`
  - Then: The method returns an error indicating a manifest already exists

- **TC-7.1c: Create package with overwrite**
  - Given: A folder is open with an existing manifest
  - When: The Steward calls `createPackage({ overwrite: true })`
  - Then: The existing manifest is replaced with a newly scaffolded manifest; sidebar updates

- **TC-7.1d: Create package in extracted package with missing manifest (fallback repair)**
  - Given: A `.mpk` package was opened but had no manifest, so the sidebar is in filesystem fallback mode
  - When: The Steward calls `createPackage()`
  - Then: A manifest is scaffolded in the extracted temp directory; the sidebar switches from fallback to package mode; the stale indicator appears (the package now differs from its source). Consistent with Epic 9 AC-8.3a.

- **TC-7.1e: Create package in extracted package with unreadable manifest (fallback repair)**
  - Given: A `.mpk` package was opened but the manifest could not be parsed, so the sidebar is in filesystem fallback mode
  - When: The Steward calls `createPackage({ overwrite: true })`
  - Then: The unreadable manifest is replaced with a newly scaffolded manifest; the sidebar switches to package mode; the stale indicator appears. Consistent with Epic 9 AC-8.3b.

**AC-7.2:** The Steward can export a folder as a package through chat

- **TC-7.2a: Export folder as .mpk**
  - Given: A regular folder is open (no manifest)
  - When: The Steward calls `exportPackage({ outputPath: '/path/to/output.mpk' })`
  - Then: A manifest is auto-scaffolded (in memory, not written to the source folder — consistent with Epic 9 AC-5.2), and the folder is exported as a `.mpk` file

- **TC-7.2b: Export folder with existing manifest**
  - Given: A directory-mode package is open (folder with manifest)
  - When: The Steward calls `exportPackage({ outputPath: '/path/to/output.mpk' })`
  - Then: The existing manifest is used; the folder is exported as a `.mpk` file

**AC-7.3:** File operations work in folder mode

- **TC-7.3a: Create file in folder mode**
  - Given: A regular folder is open
  - When: The Steward calls `addFile('docs/new.md', content)`
  - Then: The file is created in the folder; `chat:file-created` is sent

- **TC-7.3b: Read file in folder mode**
  - Given: A regular folder is open containing `readme.md`
  - When: The Steward calls `getFileContent('readme.md')`
  - Then: The file content is returned

- **TC-7.3c: Edit file in folder mode**
  - Given: A regular folder is open containing `docs/spec.md`
  - When: The Steward calls `editFile('docs/spec.md', newContent)`
  - Then: The file is written; `chat:file-created` is sent

**AC-8.1:** Script method errors produce descriptive error results returned to the CLI

- **TC-8.1a: File operation error**
  - Given: A script block calls `getFileContent` for a nonexistent file
  - When: The method fails
  - Then: An error result is returned to the CLI process's stdin with a descriptive message; the server continues operating

- **TC-8.1b: Package operation error**
  - Given: A script block calls `exportPackage` with an invalid output path
  - When: The export fails
  - Then: An error result is returned to the CLI; no partial file is left on disk

- **TC-8.1c: Manifest update error**
  - Given: A script block calls `updateManifest` with malformed content
  - When: The manifest parse fails
  - Then: An error result is returned; the existing manifest is unchanged; the sidebar retains its previous state

**AC-8.2:** Package context injection errors are handled gracefully

- **TC-8.2a: Package service unavailable**
  - Given: The package service fails to read the manifest (e.g., temp directory was cleaned up externally)
  - When: The developer sends a message
  - Then: The message is sent without package context; a warning appears in the context indicator

- **TC-8.2b: Manifest parse error during context injection**
  - Given: The manifest file exists but is malformed
  - When: The developer sends a message
  - Then: The context includes `manifestStatus: 'unreadable'`; the Steward operates without manifest structure

**AC-8.3:** All Epic 13 functionality is absent when the feature flag is disabled

- **TC-8.3a: No package context injection**
  - Given: `FEATURE_SPEC_STEWARD` is disabled
  - When: A package is open and the app runs
  - Then: No package context is constructed for the provider; no spec phase detection runs

- **TC-8.3b: No extended context indicator**
  - Given: `FEATURE_SPEC_STEWARD` is disabled
  - When: The app loads
  - Then: No package-aware context indicator is present (no chat panel at all, per Epic 10)

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### Folder-Mode createPackage

Two code paths in `createPackage()`:

1. **Folder mode or directory-mode package:** Delegates to `PackageService.create(workspaceRoot, overwrite?)`. This sets `activePackage` in session state with `mode: 'directory'`. Triggers `chat:package-changed` with `created`.

2. **Extracted package fallback repair (TC-7.1d, TC-7.1e):** Scaffolds manifest directly via Epic 8's `scaffoldManifest()` in the extracted temp directory. Does NOT call `PackageService.create()` (which would switch to directory mode). Instead, updates `manifestStatus` to `'present'` in session state directly and persists. Calls `markStaleIfExtracted()`.

#### Folder-Mode exportPackage

Delegates to `PackageService.export(outputPath, compress, sourceDir)`. For folders without a manifest, `PackageService.export()` auto-scaffolds a manifest in memory (not written to the source folder) — consistent with Epic 9 AC-5.2.

#### Error Handling Architecture

All script method errors follow the pattern from Epic 10:
1. Error caught by script executor's `vm.runInNewContext` error handler
2. Returned as `ScriptResult { success: false, error: descriptiveMessage }`
3. Relayed to CLI stdin as JSON
4. Server continues operating — no crash, no state corruption

| Error Condition | Error Code | Server State |
|---|---|---|
| File not found | `FILE_NOT_FOUND` | Unchanged |
| File already exists | `FILE_ALREADY_EXISTS` | Unchanged |
| Path traversal | `PATH_TRAVERSAL` | Unchanged |
| No manifest | `MANIFEST_NOT_FOUND` | Unchanged |
| Manifest parse failure | `MANIFEST_PARSE_ERROR` | Unchanged — existing manifest preserved |
| Permission denied | `PERMISSION_DENIED` | Unchanged |
| Binary file | `NOT_TEXT_FILE` | Unchanged |
| Read budget exceeded | `READ_BUDGET_EXCEEDED` | Unchanged — budget state preserved |
| Export failure | `PACKAGE_EXPORT_FAILED` | Unchanged — no partial file |
| Create failure | `PACKAGE_CREATE_FAILED` | Unchanged |

#### Context Injection Error Handling (AC-8.2)

In `buildInjectedContext()`:

```typescript
// If buildPackageContext() throws (package service unavailable):
// - Message is dispatched without <workspace-context> block
// - chat:context includes workspace: { type: 'package', warning: 'Package context unavailable' }
// - Steward operates with reduced awareness

// If manifest is malformed:
// - manifestStatus: 'unreadable' in package context
// - No navigation tree in context
// - Steward informed via workspace-context block attributes
```

#### Feature Flag Isolation (AC-8.3)

All Epic 13 client changes are within the `steward/` directory, conditionally mounted when `FEATURE_SPEC_STEWARD` is enabled (Epic 10). When disabled:
- No context indicator renders (no chat panel)
- No `chat:package-changed` handler registered (no WebSocket connection)
- Server does not construct package context for provider

No additional isolation code needed — existing Epic 10 architecture provides complete isolation.

See the tech design documents for full architecture, implementation targets, and test mapping.

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `createPackage()` works in folder mode — scaffolds manifest, sends `chat:package-changed`
- [ ] `createPackage()` handles extracted package fallback repair (missing/unreadable manifest)
- [ ] `createPackage()` with existing manifest returns error; `overwrite: true` replaces
- [ ] `exportPackage()` in folder mode auto-scaffolds manifest in memory
- [ ] `addFile`, `getFileContent`, `editFile` all work in folder mode
- [ ] All script method errors return descriptive error results to CLI
- [ ] Package context failure → message sent without package context, warning in indicator
- [ ] Malformed manifest → `manifestStatus: 'unreadable'` in context
- [ ] `FEATURE_SPEC_STEWARD` disabled → no package context, no indicator, no spec detection
- [ ] All 17 TC-mapped tests + 5 non-TC tests pass (22 total)
- [ ] `npm run verify-all` passes (all tests including E2E)
