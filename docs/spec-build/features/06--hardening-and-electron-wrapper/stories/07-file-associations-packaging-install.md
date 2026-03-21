# Story 7: File Associations, Packaging, and Install

### Summary
<!-- Jira: Summary field -->

App registers as `.md` handler on macOS. Opening files from Finder routes to the app. Packaged with stable bundle ID, ad-hoc signing, and one-command install script.

### Description
<!-- Jira: Description field -->

**Primary User:** Desktop user who wants to double-click `.md` files in Finder and have them open in MD Viewer.
**Context:** electron-builder's `fileAssociations` config generates `CFBundleDocumentTypes` in Info.plist. macOS Launch Services discovers the registration on first launch. Ad-hoc signing (automatic for ARM64 in electron-builder v26+) prevents the "app is damaged" error on Apple Silicon.

**Objective:** File associations work from Finder and dock. Packaging produces a stable, installable .app bundle. One-command install to `~/Applications`.

**Scope:**

In scope:
- File association registration for `.md` and `.markdown` via electron-builder config
- `open-file` event handling: routes to renderer whether app is starting or running
- Cold-launch file open: pending path queued and flushed after `did-finish-load`
- Tab restore + open-file startup ordering (persisted tabs restore first, then pending file opens)
- Stable bundle ID (`com.leemoore.mdviewer`)
- Ad-hoc code signing (automatic for ARM64, per Amendment 1)
- Intel Mac compatibility
- User data in `~/Library/Application Support/md-viewer/` (shared with browser mode)
- One-command install script (`scripts/install-app.sh`)
- Reinstall preserves user data

Out of scope:
- Developer ID signing and notarization
- Auto-update
- Windows/Linux packaging
- CLI launch symlink

**Dependencies:** Story 4 complete (tab persistence — needed for TC-9.2e cold-start restore + open-file ordering), Story 5 complete (Electron shell).

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-9.1:** App registers as a `.md` / `.markdown` file handler

- **TC-9.1a: File association registered**
  - Given: The Electron app has been installed and launched at least once
  - When: User right-clicks a `.md` file in Finder and selects "Open With"
  - Then: MD Viewer appears in the list of available applications

- **TC-9.1b: Default handler**
  - Given: User sets MD Viewer as the default handler for `.md` files (via Finder "Open With > Always Open With")
  - When: User double-clicks a `.md` file
  - Then: The file opens in MD Viewer

**AC-9.2:** Opening a file from Finder opens it in the app

- **TC-9.2a: App not running — file opens on launch**
  - Given: The app is not running
  - When: User double-clicks a `.md` file in Finder
  - Then: The app launches and the file is open in a tab when the app is ready

- **TC-9.2b: App already running — file opens in existing window**
  - Given: The app is running with other documents open
  - When: User double-clicks a `.md` file in Finder
  - Then: The existing window is focused and the file opens in a new tab

- **TC-9.2c: Drag file onto dock icon**
  - Given: The app is running
  - When: User drags a `.md` file onto the dock icon
  - Then: The file opens in a new tab in the existing window

- **TC-9.2d: File already open**
  - Given: The file is already open in a tab
  - When: User double-clicks the same file in Finder
  - Then: The existing tab is activated (consistent with Epic 2 AC-1.3)

- **TC-9.2e: File open during startup with tab restore**
  - Given: User double-clicks a `.md` file while the app is not running, and the app has 5 persisted tabs from a previous session
  - When: The app launches
  - Then: The 5 persisted tabs are restored AND the double-clicked file opens in a new tab (or its existing tab is activated if it was among the persisted tabs). The double-clicked file becomes the active tab.

**AC-9.3:** Rebuilding the app preserves file associations

- **TC-9.3a: Stable bundle ID**
  - Given: The app was installed and file associations were set
  - When: The app is rebuilt and reinstalled at the same path with the same bundle ID
  - Then: File associations continue to work without reconfiguration

**AC-12.1:** One-command install script builds and installs the app

- **TC-12.1a: Install script**
  - Given: User has Node.js installed and the repository cloned
  - When: User runs the install command (e.g., `npm run install-app`)
  - Then: The app is built, packaged, and placed at `~/Applications/MD Viewer.app` (or a stable user-writable path). No `sudo` required.

- **TC-12.1b: Reinstall preserves user data**
  - Given: The app is installed and user has workspaces, theme, and session state saved
  - When: User reinstalls (runs the install command again)
  - Then: User data (session state, workspaces, themes, persisted tabs) is preserved. Only the app binary is replaced.

**AC-12.2:** App has a stable bundle ID and ad-hoc code signature

- **TC-12.2a: Bundle ID**
  - Given: The app is packaged
  - When: The bundle metadata is inspected
  - Then: The bundle ID is stable across builds (e.g., `com.leemoore.mdviewer`). Reinstalling does not change the bundle ID.

- **TC-12.2b: Ad-hoc signature**
  - Given: The app is packaged on an Apple Silicon Mac
  - When: The signature is inspected (`codesign -v`)
  - Then: The app has an ad-hoc signature. It does not show "app is damaged" on launch. The user sees the "unverified developer" Gatekeeper prompt once.

- **TC-12.2c: Intel Mac compatibility**
  - Given: The app is packaged
  - When: Run on an Intel Mac
  - Then: The app launches and functions correctly. Ad-hoc signing is not required on Intel but does not cause issues.

**AC-12.3:** User data is stored in a stable, user-writable location

- **TC-12.3a: Data directory**
  - Given: The app is running (browser or Electron)
  - When: Session data, workspaces, and persisted tab state are written
  - Then: Data is stored in a consistent location (e.g., `~/.mdviewer/` or `~/Library/Application Support/MD Viewer/`) that survives app reinstallation

- **TC-12.3b: Browser and Electron share data**
  - Given: The user has used the browser-based app and then switches to Electron
  - When: The app launches in the other mode
  - Then: Session state (workspaces, theme, recent files) is shared — both modes read from the same data directory

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**electron-builder.yml file associations:**

```yaml
fileAssociations:
  - ext: md
    name: Markdown Document
    role: Viewer
    rank: Default
  - ext: markdown
    name: Markdown Document
    role: Viewer
    rank: Default
```

**open-file handler:** Registered in `main.ts` before `app.whenReady()`. Queues path if window not ready. `file-handler.ts` flushes pending path after `did-finish-load`.

**Install script:** `scripts/install-app.sh` — builds server + client + Electron, packages with electron-builder, copies `.app` to `~/Applications/`. Detects ARM64 vs Intel.

**User data:** Session stored at `~/Library/Application Support/md-viewer/session.json` by `SessionService` (same path for browser and Electron). Window state stored separately in Electron's `userData` directory.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `npm run verify` passes
- [ ] File association registered — MD Viewer appears in "Open With" for `.md` files
- [ ] Double-click `.md` in Finder opens in app (cold and warm start)
- [ ] Dock drag opens file
- [ ] Tab restore + open-file ordering correct on cold start
- [ ] Bundle ID stable across rebuilds
- [ ] Ad-hoc signature present on ARM64 build
- [ ] Install script places app in ~/Applications
- [ ] Reinstall preserves session data
- [ ] Browser and Electron share session data
