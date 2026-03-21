# Story 6: Native Menu Bar and Electron Quit Flow

### Summary
<!-- Jira: Summary field -->

Native macOS menu bar mirrors web app menus with dynamic state sync. HTML menu bar hidden in Electron. Custom quit modal for dirty tabs.

### Description
<!-- Jira: Description field -->

**Primary User:** Desktop user who expects native macOS menu behavior — keyboard shortcuts via native menus, proper Cmd+Q quit flow with unsaved changes protection.
**Context:** The web app has a custom HTML menu bar with File, Export, and View menus. In Electron, native menus replace this. Menu state (enabled/disabled items, theme checkmarks) syncs from renderer to main process via IPC.

**Objective:** Full native menu bar matching the web app's functionality. HTML menu bar hidden without flash. Electron-specific quit modal listing dirty files by name.

**Scope:**

In scope:
- Native menu bar: File (Open File, Open Folder, Save, Save As, Close Tab), Export (PDF, DOCX, HTML), View (Toggle Sidebar, Theme submenu, Render/Edit toggle), App menu (About, Hide, Quit)
- Menu state sync: Export disabled when no document open, Save disabled/enabled based on dirty state, theme checkmarks, mode indicator
- HTML menu bar hiding via `?electron=1` query parameter + `body.electron` CSS class
- Electron quit flow: `close` event prevention → IPC → renderer checks dirty tabs → modal → confirm/cancel
- Quit modal: Save All and Quit, Discard All and Quit, Cancel

Out of scope:
- Browser quit flow (already implemented via `beforeunload` in Epic 5)
- New menu items beyond what the web app has

**Dependencies:** Story 5 complete (Electron shell with IPC infrastructure).

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-8.1:** Native menu bar provides File, Export, and View menus matching the web app

- **TC-8.1a: File menu contents**
  - Given: The Electron app is running
  - When: User clicks the File menu in the native menu bar
  - Then: Options include: Open File (Cmd+O), Open Folder (Cmd+Shift+O), Save (Cmd+S), Save As (Cmd+Shift+S), Close Tab (Cmd+W). Keyboard shortcuts are shown. Items match the web app's File menu.

- **TC-8.1b: Export menu contents**
  - Given: A document is open
  - When: User clicks the Export menu
  - Then: Options include: PDF, DOCX, HTML, with keyboard shortcuts. Disabled when no document is open (consistent with the web app's Export behavior).

- **TC-8.1c: View menu contents**
  - Given: The Electron app is running
  - When: User clicks the View menu
  - Then: Options include: Toggle Sidebar (Cmd+\), theme submenu, and Render/Edit mode toggle. Matches the web app's View menu.

- **TC-8.1d: Standard macOS app menu**
  - Given: The Electron app is running
  - When: User clicks the app name menu (MD Viewer)
  - Then: Standard macOS items appear: About MD Viewer, Hide, Hide Others, Show All, Quit (Cmd+Q)

- **TC-8.1e: Menu item triggers web app action**
  - Given: User selects File > Open Folder from the native menu
  - When: The menu action fires
  - Then: The same folder picker dialog opens as when using the web app's File menu. The result is the same.

**AC-8.2:** Native menu items reflect current app state

- **TC-8.2a: Export disabled when no document open**
  - Given: No document tabs are open
  - When: User views the Export menu
  - Then: Export options are disabled (consistent with web app behavior)

- **TC-8.2b: Save enabled/disabled based on dirty state**
  - Given: The active tab has no unsaved changes
  - When: User views the File menu
  - Then: Save is disabled. Save As is enabled.

- **TC-8.2c: Save enabled when dirty**
  - Given: The active tab has unsaved changes
  - When: User views the File menu
  - Then: Save is enabled.

- **TC-8.2d: Theme checkmark reflects active theme**
  - Given: The user has selected a dark theme
  - When: User views the View > Theme submenu
  - Then: The active dark theme has a checkmark. Other themes do not.

**AC-8.3:** Web app's HTML menu bar is hidden in Electron

- **TC-8.3a: No duplicate menu bar**
  - Given: The app is running in Electron
  - When: User views the app window
  - Then: The web app's custom HTML menu bar is hidden. Only the native macOS menu bar is visible. All functionality remains accessible via the native menu.

- **TC-8.3b: Web app menu bar remains in browser**
  - Given: The same app is accessed via a browser (not Electron)
  - When: User views the app
  - Then: The web app's HTML menu bar is visible and functional (no regression)

**AC-10.1:** Quitting Electron with dirty tabs shows the custom modal

- **TC-10.1a: Quit via Cmd+Q with dirty tabs**
  - Given: 2 of 5 tabs have unsaved edits
  - When: User presses Cmd+Q
  - Then: A custom modal appears listing the 2 dirty files by name. Options: Save All and Quit, Discard All and Quit, Cancel.

- **TC-10.1b: Quit via window close button with dirty tabs**
  - Given: Tabs have unsaved edits
  - When: User clicks the window close button (red traffic light)
  - Then: The same custom modal appears

- **TC-10.1c: Save All and Quit**
  - Given: The quit modal is open with 2 dirty files
  - When: User clicks Save All and Quit
  - Then: Both files are saved. If both saves succeed, the app quits. If a save fails, the quit is aborted and the error is shown.

- **TC-10.1d: Discard All and Quit**
  - Given: The quit modal is open
  - When: User clicks Discard All and Quit
  - Then: The app quits without saving. Edits are lost.

- **TC-10.1e: Cancel quit**
  - Given: The quit modal is open
  - When: User clicks Cancel
  - Then: The modal closes. The app remains open with all tabs and edits intact.

- **TC-10.1f: Quit with no dirty tabs**
  - Given: All tabs are clean
  - When: User presses Cmd+Q or clicks the close button
  - Then: The app quits immediately with no prompt.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**New module:** `electron/menu.ts` — builds native menu from template, rebuilds on state update (50ms debounced via renderer).

**Menu state sync IPC:**

```typescript
// renderer → main
interface MenuState {
  hasDocument: boolean;
  hasDirtyTab: boolean;
  activeTabDirty: boolean;
  activeTheme: string;
  activeMode: 'render' | 'edit';
  defaultMode: 'render' | 'edit';
}
```

**Quit flow IPC:** `app:quit-request` → renderer checks dirty tabs → `app:quit-confirmed` or `app:quit-cancelled`. Main process uses `event.preventDefault()` on `close` to hold the window open during the round-trip.

**Electron detection:** BrowserWindow loads `?electron=1`. Client checks `location.search` synchronously, adds `body.electron` class. CSS hides `#menu-bar`.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `npm run verify` passes
- [ ] Native menu bar has File, Export, View, and App menus with correct items
- [ ] Menu items trigger correct web app actions via IPC
- [ ] Export disabled when no document open, Save reflects dirty state
- [ ] Theme checkmark updates on theme change
- [ ] HTML menu bar hidden in Electron, visible in browser
- [ ] Quit with dirty tabs shows custom modal listing dirty files
- [ ] Save All and Quit saves files then quits
- [ ] Discard All and Quit quits without saving
- [ ] Cancel keeps app open
- [ ] Clean quit exits immediately
