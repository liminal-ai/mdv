# Story 1: App Shell Chrome

## Summary
<!-- Jira: Summary field -->
App shell with menu bar, dropdowns, empty tab strip, empty content area with launch state, and keyboard shortcut framework.

## Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts. Launching a local tool to browse directories full of markdown files. Must run locally from Node without app signing, admin access, or cloud dependencies. Keyboard shortcuts are baseline.

**Objective:** Deliver the visible app chrome — the user launches the app and sees a complete shell with menu bar, dropdowns, empty states, and keyboard navigation. This is the first thing the user sees.

**Scope:**
- In: Server startup with browser launch, app shell layout (menu bar, sidebar container, tab strip, content area), File/Export/View dropdown menus with keyboard nav, quick-action toolbar icons with tooltips, empty content area with launch state prompts, empty tab strip placeholder, sidebar toggle, global keyboard shortcuts
- Out: Sidebar workspace/root/tree content (Story 2-3), context menus (Story 4), theme rendering (Story 5), session restore (Story 6)

**Dependencies:** Story 0 (types and server scaffold)

## Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1:** App launches with a single command and opens in the browser

- **TC-1.1a: First launch with no prior session**
  - Given: No session data exists
  - When: User runs the start command
  - Then: Server starts, browser opens to local URL, app shell renders with empty state
- **TC-1.1b: Server binds to localhost only**
  - Given: Server is starting
  - When: Server binds to a port
  - Then: Server is only accessible from localhost, not from the network
- **TC-1.1c: Port conflict**
  - Given: The default port is already in use
  - When: User runs the start command
  - Then: Server binds to the next available port and the browser opens to the correct URL

**AC-1.3:** Empty content area shows launch state with actionable prompts

- **TC-1.3a: Empty state content**
  - Given: No documents are open
  - When: User views the content area
  - Then: App name, Open File button, Open Folder button, and recent files list are visible. Open File is visible but non-functional until Epic 2 (same pattern as disabled Export/Edit). Open Folder is functional — it triggers the folder picker (AC-9.1c).
- **TC-1.3b: Recent files list on first launch**
  - Given: No files have been opened before
  - When: User views the empty content area
  - Then: Recent files section is either hidden or shows "No recent files"
- **TC-1.3c: Recent files list with history**
  - Given: User has previously opened files
  - When: User views the empty content area
  - Then: Recent files are listed with filenames and truncated paths
  - Note: This TC is testable at M1 (after Epic 2 ships file opening). Epic 1 delivers the UI and persistence structure; Epic 2 populates it.

**AC-1.4:** Empty tab strip shows placeholder text

- **TC-1.4a: No documents open**
  - Given: App is in empty state
  - When: User views the tab strip
  - Then: Tab strip shows "No documents open" text

**AC-2.1:** Menu bar displays File, Export, and View dropdown menus

- **TC-2.1a: File menu contents**
  - Given: User clicks the File menu
  - When: Dropdown opens
  - Then: Options include Open File, Open Folder, and keyboard shortcuts shown next to each item
- **TC-2.1b: Export menu contents (disabled state)**
  - Given: No document is open
  - When: User clicks the Export menu
  - Then: Export options (PDF, DOCX, HTML) are visible but disabled/grayed
- **TC-2.1c: View menu contents**
  - Given: User clicks the View menu
  - When: Dropdown opens
  - Then: Options include Toggle Sidebar, theme submenu, and keyboard shortcuts
- **TC-2.1d: Menu closes on outside click**
  - Given: A dropdown menu is open
  - When: User clicks anywhere outside the dropdown
  - Then: The dropdown closes
- **TC-2.1e: Only one menu open at a time**
  - Given: File menu is open
  - When: User clicks View menu heading
  - Then: File menu closes, View menu opens

**AC-2.2:** Quick-action toolbar icons are present with tooltips

- **TC-2.2a: Icons present and functional**
  - Given: User views the menu bar
  - When: User hovers over a quick-action icon
  - Then: A tooltip shows the action name and keyboard shortcut
- **TC-2.2b: Icon click triggers action**
  - Given: User clicks the Open Folder quick-action icon
  - When: Click event fires
  - Then: Folder picker dialog appears
- **TC-2.2c: Open File icon is present but disabled**
  - Given: User views the menu bar
  - When: User clicks the Open File quick-action icon
  - Then: No action occurs; icon has disabled styling and tooltip indicates "Available when file opening is supported"
  - Note: Open File moved to Epic 2. The icon is present but disabled (matching the Export disabled pattern). The Cmd+O shortcut is NOT registered in Epic 1.

**AC-2.3:** Keyboard shortcuts trigger menu actions without opening the menu

- **TC-2.3a: Cmd+O is NOT registered in Epic 1**
  - Given: App is focused
  - When: User presses Cmd+O
  - Then: No shortcut handler fires; the browser's native behavior is not prevented. Epic 2 registers this shortcut.
- **TC-2.3b: Shortcut works regardless of focus location**
  - Given: Focus is in the sidebar or content area
  - When: User presses a global shortcut
  - Then: The shortcut fires correctly

**AC-2.4:** Interactive elements (menus, tree, context menus) are keyboard-navigable

- **TC-2.4a: Dropdown menus support keyboard navigation**
  - Given: A dropdown menu is open
  - When: User presses arrow keys
  - Then: Focus moves between menu items; Enter activates the focused item; Escape closes the menu
- **TC-2.4b: File tree supports keyboard navigation**
  - Given: File tree has focus
  - When: User presses arrow keys
  - Then: Up/Down moves between visible nodes; Right expands a collapsed directory; Left collapses an expanded directory; Enter activates the focused node
  - Note: File tree is not rendered until Story 3. This TC is exercisable after Story 3 ships. Story 1 delivers the keyboard navigation framework; Story 3 applies it to the tree.
- **TC-2.4c: Context menu supports keyboard navigation**
  - Given: Context menu is open
  - When: User presses arrow keys
  - Then: Focus moves between menu items; Enter activates; Escape closes
  - Note: Context menus ship in Story 4. This TC is exercisable after Story 4. Story 1 delivers the keyboard navigation framework.

**AC-2.5:** Sidebar can be toggled via keyboard shortcut and View menu

- **TC-2.5a: Toggle sidebar closed**
  - Given: Sidebar is visible
  - When: User presses the toggle sidebar shortcut (or selects View → Toggle Sidebar)
  - Then: Sidebar collapses, content area expands to fill the space
- **TC-2.5b: Toggle sidebar open**
  - Given: Sidebar is collapsed
  - When: User presses the toggle sidebar shortcut
  - Then: Sidebar reappears at its previous width

## Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Relevant data contracts:

```typescript
interface SessionState {
  workspaces: Workspace[];
  lastRoot: string | null;
  recentFiles: RecentFile[];
  theme: ThemeId;
  sidebarState: {
    workspacesCollapsed: boolean;
  };
}

interface RecentFile {
  path: string;       // absolute path
  openedAt: string;   // ISO 8601 UTC, last opened time
}
```

API endpoints used by this story:

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/session | Load session on startup (for recent files, theme bootstrap) |
| POST | /api/browse | Open folder picker (Open Folder button in empty state, Open Folder quick-action icon) |

*See the tech design document for full architecture, implementation targets, and test mapping.*

## Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] App launches with single command, browser opens
- [ ] Server binds localhost only, handles port conflicts
- [ ] Menu bar renders with File, Export, View dropdowns
- [ ] Quick-action icons render with tooltips; Open File disabled
- [ ] Empty tab strip shows placeholder
- [ ] Empty content area shows launch state with Open Folder functional, Open File disabled
- [ ] Sidebar toggles via shortcut and View menu
- [ ] Dropdown menus keyboard-navigable
- [ ] All keyboard shortcuts fire regardless of focus
- [ ] Cmd+O is not registered
- [ ] All tests pass
