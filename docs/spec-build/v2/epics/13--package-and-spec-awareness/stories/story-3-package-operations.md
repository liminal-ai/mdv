# Story 3: Package Operations Through Chat

---

### Summary
<!-- Jira: Summary field -->

The Steward can modify the manifest, export packages, navigate to files, and create packages through chat, with the client updating the sidebar and stale indicator in response to `chat:package-changed` messages.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Working within spec packages containing PRDs, epics, tech designs, and stories. The Steward already knows what document is open (Epic 12) but cannot see the broader package structure, read other files, create new files, or understand where the user is in the spec lifecycle.

**Objective:** Package-content operations that previously required the UI — manifest modification, package export, file navigation, package creation — are available through chat. When the Steward performs a package operation, the server sends `chat:package-changed` to notify the client, and the client updates the sidebar navigation, mode, or stale indicator accordingly. After this story, "add docs/api.md to the navigation" works through chat, and the sidebar updates immediately.

**Scope:**

In scope:
- `getPackageManifest()` script method — read current manifest content, metadata, navigation
- `updateManifest(content)` script method — replace manifest, validate via `parseManifest()`, atomic write, send `chat:package-changed` with `manifest-updated`
- `createPackage(options?)` script method — scaffold manifest via `PackageService.create()`, send `chat:package-changed` with `created`
- `exportPackage(options)` script method — export to `.mpk`/`.mpkz` via `PackageService.export()`, validate absolute path and writable parent, send `chat:package-changed` with `exported`
- `openDocument(path)` script method update — sends `chat:open-document` (new message type, distinct from `chat:file-created`)
- Client `chat:package-changed` handler: `manifest-updated` → re-fetch manifest and update sidebar; `created` → switch sidebar to package mode; `exported` → refresh stale indicator
- Client `chat:open-document` handler: calls existing `openFileInTab(path)`
- Stale indicator updates: `addFile`/`editFile`/`updateManifest` in extracted packages call `PackageService.markStale()`; re-export to original source path calls `PackageService.clearStale()`
- Directory-mode package transition: after `createPackage()` on folder, workspace type becomes `package` with `mode: 'directory'`; canonical identity preserved

Out of scope:
- Workspace switching (opening different .mpk, changing root) — Epic 14 or post-v2
- File creation/editing methods (Story 4 — though stale indicator logic for those methods is specified here as AC-3.6)

**Dependencies:**
- Stories 1 and 2 complete (package context, file reading, path validation)
- Story 4 complete (file operations — required for stale indicator TCs on addFile/editFile)
- Epic 9 complete (PackageService: `create()`, `export()`, `markStale()`, `clearStale()`, `getManifest()`)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-3.1:** The Steward can modify the package manifest through chat

- **TC-3.1a: Add a navigation entry**
  - Given: A package is open with three navigation entries
  - When: The developer says "add docs/api.md to the navigation" and the Steward calls `updateManifest` with updated content
  - Then: The manifest file is updated on disk; the server sends `chat:package-changed` with `change: 'manifest-updated'`; the sidebar navigation reflects the change

- **TC-3.1b: Remove a navigation entry**
  - Given: A package is open with four navigation entries
  - When: The Steward removes an entry by calling `updateManifest` with updated content
  - Then: The manifest is updated; the sidebar shows three entries

- **TC-3.1c: Reorder navigation entries**
  - Given: A package has entries A, B, C
  - When: The Steward reorders them to C, A, B via `updateManifest`
  - Then: The sidebar shows entries in the new order

- **TC-3.1d: Invalid manifest content**
  - Given: A package is open
  - When: A script block calls `updateManifest` with content containing malformed YAML
  - Then: The method returns an error; the existing manifest is unchanged; the sidebar retains its previous state

**AC-3.2:** The Steward can export the current workspace as a package through chat

- **TC-3.2a: Export as .mpk**
  - Given: A package or folder is open
  - When: The developer says "export this as a package" and the Steward calls `exportPackage` with an output path and `compress: false`
  - Then: A `.mpk` file is created at the specified path; the server sends `chat:package-changed` with `change: 'exported'`

- **TC-3.2b: Export as .mpkz**
  - Given: A workspace is open
  - When: The Steward calls `exportPackage` with `compress: true`
  - Then: A `.mpkz` (compressed) file is created

- **TC-3.2c: Export path not writable**
  - Given: A workspace is open
  - When: The Steward calls `exportPackage` with a path that is not writable
  - Then: The method returns an error; no package file is created

- **TC-3.2d: Re-export to original path clears stale indicator**
  - Given: An extracted package is stale (files modified since extraction) and its source path is `/path/to/project.mpk`
  - When: The Steward calls `exportPackage({ outputPath: '/path/to/project.mpk' })`
  - Then: The package is re-exported; the stale indicator clears (consistent with Epic 9 AC-5.3b)

- **TC-3.2e: Export to different path preserves stale indicator**
  - Given: An extracted package is stale and its source path is `/path/to/project.mpk`
  - When: The Steward calls `exportPackage({ outputPath: '/path/to/elsewhere.mpk' })`
  - Then: The package is exported to the new path; the stale indicator remains (the original source is still out of date, consistent with Epic 9 AC-5.3c)

**AC-3.3:** The Steward can navigate to a file in the viewer through chat

- **TC-3.3a: Open a file by manifest path**
  - Given: A package is open
  - When: The Steward calls `openDocument` with the absolute path of a file in the package
  - Then: The file opens in a tab (or the existing tab is activated) consistent with Epic 12's `openDocument` behavior

- **TC-3.3b: File not in workspace**
  - Given: A workspace is open
  - When: The Steward calls `openDocument` with a path outside the workspace root
  - Then: The method returns an error; no tab is opened

**AC-3.4:** The client updates the sidebar and UI after Steward-initiated package operations

- **TC-3.4a: Manifest update refreshes sidebar**
  - Given: The sidebar is showing package-mode navigation
  - When: The client receives `chat:package-changed` with `change: 'manifest-updated'`
  - Then: The client re-fetches the manifest and updates the sidebar navigation tree

- **TC-3.4b: Package creation switches sidebar mode**
  - Given: The sidebar is in filesystem mode
  - When: The client receives `chat:package-changed` with `change: 'created'`
  - Then: The client switches the sidebar to package mode and fetches the new manifest

- **TC-3.4c: Export shows confirmation**
  - Given: The developer requested a package export through chat
  - When: The client receives `chat:package-changed` with `change: 'exported'`
  - Then: The export success is visible in the chat (via the Steward's response text)

**AC-3.5:** After `createPackage()` on a folder, the workspace transitions to a directory-mode package with full package context available

- **TC-3.5a: Workspace type becomes package after createPackage**
  - Given: A folder is open (`workspace.type === 'folder'`)
  - When: The Steward calls `createPackage()` and the manifest is scaffolded
  - Then: Subsequent messages have `workspace.type === 'package'` with `package.mode === 'directory'`; `package.navigation` and `package.metadata` are populated from the scaffolded manifest; `getPackageManifest()` and `updateManifest()` are legal

- **TC-3.5b: Canonical identity is preserved across folder-to-package transition**
  - Given: A folder at `/Users/dev/project` is open with an existing conversation
  - When: The Steward calls `createPackage()`
  - Then: The canonical workspace identity remains `/Users/dev/project`; the conversation is not swapped or lost; the CLI session ID is unchanged

- **TC-3.5c: Context indicator updates to show package mode**
  - Given: A folder was open and `createPackage()` has been called
  - When: The developer views the chat panel
  - Then: The context indicator reflects package mode with the package title from the scaffolded manifest

**AC-3.6:** Steward-initiated file modifications in extracted packages update the stale indicator

- **TC-3.6a: addFile in extracted package triggers stale**
  - Given: A `.mpk` package was opened (extracted to temp directory) and the stale indicator is not showing
  - When: The Steward calls `addFile` to create a file in the extracted package
  - Then: The stale indicator appears (consistent with Epic 9 AC-7.2)

- **TC-3.6b: editFile in extracted package triggers stale**
  - Given: A `.mpk` package was opened and is not stale
  - When: The Steward calls `editFile` on a file in the extracted package
  - Then: The stale indicator appears

- **TC-3.6c: updateManifest in extracted package triggers stale**
  - Given: A `.mpk` package was opened and is not stale
  - When: The Steward calls `updateManifest` to modify the manifest
  - Then: The stale indicator appears (the manifest is a file in the extracted package)

- **TC-3.6d: Directory-mode packages have no stale indicator**
  - Given: A directory-mode package is open (folder with manifest, not extracted from .mpk)
  - When: The Steward calls `addFile`, `editFile`, or `updateManifest`
  - Then: No stale indicator appears (consistent with Epic 9 AC-7.2c)

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### Script Method Signatures

All in `buildExtendedScriptContext()` within `app/src/server/services/script-executor.ts`:

```typescript
getPackageManifest: async (): Promise<PackageManifestInfo>
// Reads from PackageService.getManifest(). Error if no package or manifest not present.

updateManifest: async (content: string): Promise<void>
// 1. Parse via parseManifest() — error if invalid
// 2. Atomic write (temp + rename) to manifest path
// 3. Force re-read via packageService.getManifest()
// 4. markStaleIfExtracted()
// 5. onPackageChanged('manifest-updated', { manifestPath })

createPackage: async (options?: CreatePackageOptions): Promise<void>
// Folder/directory mode: PackageService.create(workspaceRoot, overwrite?)
// Extracted fallback: scaffoldManifest() directly, update session manifestStatus
// Both: markStaleIfExtracted(), onPackageChanged('created', { manifestPath })

exportPackage: async (options: ExportPackageOptions): Promise<void>
// Validate absolute path, validate parent writable
// PackageService.export(outputPath, compress, sourceDir)
// If re-export to original sourcePath → PackageService.clearStale()
// onPackageChanged('exported', { exportPath })

openDocument: async (path: string): Promise<void>
// resolveAndValidate(path, workspaceRoot)
// onOpenDocument(resolved) — sends chat:open-document
```

#### Manifest Update Atomicity

Atomic writes via temp file + rename, consistent with session persistence pattern:

```typescript
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, content, 'utf-8');
  await rename(tempPath, filePath);
}
```

#### Stale Indicator Logic

```typescript
function markStaleIfExtracted(
  sessionService: SessionService,
  packageService: PackageService,
): void {
  const pkg = getActivePackage(sessionService);
  if (pkg && pkg.mode === 'extracted') {
    packageService.markStale();
  }
}
```

#### Export Path Validation

Requires absolute paths (starts with `/`). Validates parent directory existence and write permissions before starting export. Relative paths rejected — workspace root is not the right base for export output.

#### Client chat:package-changed Handling

In `app/src/client/steward/chat-panel.ts`:

| Change | Client Behavior |
|---|---|
| `created` | `switchToPackageMode()` — fetch manifest, activate package sidebar |
| `exported` | `refreshStaleIndicator()` — re-read session state for stale flag |
| `manifest-updated` | `refreshSidebarNavigation()` — fetch manifest, update sidebar tree |

Client calls into Epic 9's sidebar API: `updatePackageSidebar(manifest)` and `activatePackageMode(manifest)`.

#### Client chat:open-document Handling

Dispatches to `openFileInTab(path)` (existing function from Epic 2).

See the tech design documents for full architecture, implementation targets, and test mapping.

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `updateManifest` validates content, writes atomically, sends `chat:package-changed`
- [ ] `exportPackage` validates absolute path and writability, delegates to `PackageService.export()`
- [ ] `createPackage` delegates to `PackageService.create()` for folder mode, scaffolds directly for extracted fallback
- [ ] `openDocument` sends `chat:open-document` (not `chat:file-created`)
- [ ] Client handles `manifest-updated` by re-fetching manifest and updating sidebar
- [ ] Client handles `created` by switching sidebar to package mode
- [ ] Client handles `exported` by refreshing stale indicator
- [ ] Re-export to original source path clears stale; different path preserves stale
- [ ] Stale indicator triggered for file writes in extracted packages, not in directory-mode packages
- [ ] Folder→package transition preserves canonical identity and conversation
- [ ] All 21 TC-mapped tests + 5 non-TC tests pass (26 total)
- [ ] `npm run verify` passes
