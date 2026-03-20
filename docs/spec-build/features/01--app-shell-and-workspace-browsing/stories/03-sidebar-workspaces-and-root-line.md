# Story 2: Sidebar — Workspaces and Root Line

## Summary
<!-- Jira: Summary field -->
Sidebar workspace management (save, switch, remove) and root line with browse, pin, copy, and refresh actions.

## Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user who works with markdown as a primary medium. "I point this at a folder, I see my markdown files, I save folders I come back to often."

**Objective:** Deliver workspace management — the user saves root paths as workspaces, switches between them, and uses root line actions (browse, pin, copy, refresh). This is the sidebar navigation layer.

**Scope:**
- In: Workspaces section (collapsible list, add/switch/remove), root line (path display, browse, pin, copy, refresh), action visibility on hover, workspace-to-root switching, API endpoints for workspace and session mutations
- Out: File tree rendering (Story 3), context menus (Story 4), session persistence across restarts (Story 6 — this story creates the data; Story 6 ensures it survives restarts)

**Dependencies:** Story 1 (app shell layout with sidebar container)

## Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-3.1:** Workspaces section is collapsible via disclosure triangle

- **TC-3.1a: Collapse the section**
  - Given: Workspaces section is expanded with 3 entries
  - When: User clicks the disclosure triangle or section header
  - Then: Section collapses, entries are hidden, triangle points right
- **TC-3.1b: Expand the section**
  - Given: Workspaces section is collapsed
  - When: User clicks the disclosure triangle or section header
  - Then: Section expands, entries are visible, triangle points down
- **TC-3.1c: Collapse state persists across sessions**
  - Given: User collapses the Workspaces section
  - When: App is restarted
  - Then: Workspaces section is still collapsed
  - Note: Story 2 is the sole owner of this TC. This story delivers the UI, the sidebar state API call, and verifies the persistence round-trip.

**AC-3.2:** Each workspace entry shows a label with full path on hover

- **TC-3.2a: Label display**
  - Given: A workspace is saved for /Users/leemoore/code/project-atlas
  - When: User views the entry
  - Then: Label shows "project-atlas" (directory name)
- **TC-3.2b: Full path tooltip**
  - Given: A workspace entry is visible
  - When: User hovers over the entry
  - Then: Tooltip shows the full absolute path
- **TC-3.2c: Long path truncation**
  - Given: A workspace has a long directory name
  - When: Entry renders in the sidebar
  - Then: Label truncates with ellipsis, full path remains in tooltip

**AC-3.3:** Clicking a workspace switches the current root

- **TC-3.3a: Switch root**
  - Given: Root is set to /Users/leemoore/code/project-atlas
  - When: User clicks the workspace entry for /Users/leemoore/code/liminal
  - Then: Root line updates to show liminal path, file tree refreshes with liminal's contents
- **TC-3.3b: Active workspace is visually indicated**
  - Given: Root matches a saved workspace
  - When: User views the Workspaces section
  - Then: The matching workspace has a distinct visual style (highlighted/bold)
- **TC-3.3c: Switch to a workspace whose directory was deleted**
  - Given: A workspace path no longer exists on disk
  - When: User clicks that workspace entry
  - Then: An error is shown, the root does not change, the workspace entry remains (user can remove it manually)

**AC-3.4:** Workspace entries can be removed with the x button

- **TC-3.4a: Remove workspace**
  - Given: 3 workspaces are saved
  - When: User clicks the x button on the second workspace
  - Then: The second workspace is removed, 2 remain, removal persists across sessions
- **TC-3.4b: x button visibility**
  - Given: A workspace entry is visible
  - When: User hovers over the entry
  - Then: The x button appears (hidden by default to reduce visual noise)
- **TC-3.4c: Remove the active workspace**
  - Given: The current root matches a saved workspace
  - When: User removes that workspace
  - Then: The workspace is removed from the list, but the root does not change (it remains set)

**AC-4.1:** Root line displays the current root path, truncated, with full path on hover

- **TC-4.1a: Path display**
  - Given: Root is set to /Users/leemoore/code/project-atlas
  - When: User views the root line
  - Then: Path shows truncated (e.g., "~/code/project-atlas"), tooltip shows full absolute path
- **TC-4.1b: No root selected**
  - Given: No root is set
  - When: User views the root line
  - Then: Root line shows "No root selected" or similar placeholder

**AC-4.2:** Browse action opens a folder picker and sets the root

- **TC-4.2a: Select a folder**
  - Given: User clicks the browse icon on the root line
  - When: Folder picker dialog opens and user selects a directory
  - Then: Root updates to the selected directory, file tree refreshes
- **TC-4.2b: Cancel folder picker**
  - Given: User clicks the browse icon
  - When: Folder picker opens and user cancels
  - Then: Root does not change, no error
- **TC-4.2c: Browse is always visible**
  - Given: Root line is visible
  - When: User views the root line
  - Then: The browse icon is always visible (not hidden on hover like other actions)

**AC-4.3:** Pin action saves the current root as a workspace

- **TC-4.3a: Pin a new workspace**
  - Given: Root is set to a path that is not in the Workspaces list
  - When: User clicks the pin icon
  - Then: The path is added to the Workspaces section and persisted
- **TC-4.3b: Pin when already saved**
  - Given: Root matches an existing workspace
  - When: User clicks the pin icon
  - Then: No duplicate is created; either the action is a no-op or the icon indicates it's already saved

**AC-4.4:** Copy action copies the root path to the clipboard

- **TC-4.4a: Copy path**
  - Given: Root is set
  - When: User clicks the copy icon
  - Then: The full absolute path is copied to the system clipboard

**AC-4.5:** Refresh action reloads the file tree from disk

- **TC-4.5a: Refresh after external changes**
  - Given: A new markdown file was added to the root directory externally
  - When: User clicks the refresh icon
  - Then: File tree updates to include the new file
- **TC-4.5b: Refresh preserves expand/collapse state**
  - Given: User has expanded several directories in the tree
  - When: User clicks refresh
  - Then: Previously expanded directories remain expanded after refresh

**AC-4.6:** Root line actions (pin, copy, refresh) appear on hover, browse is always visible

- **TC-4.6a: Hover reveals actions**
  - Given: User views the root line without hovering
  - When: User hovers over the root line
  - Then: Pin, copy, and refresh icons become visible
- **TC-4.6b: Browse always visible**
  - Given: User views the root line without hovering
  - When: User views the root line
  - Then: Browse icon is visible at all times

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

interface Workspace {
  path: string;       // absolute path
  label: string;      // directory name, or user-customized label (future)
  addedAt: string;    // ISO 8601 UTC
}
```

API endpoints used by this story:

| Method | Path | Request | Success Response | Notes |
|--------|------|---------|-----------------|-------|
| GET | /api/session | — | `SessionState` | Load workspaces and root on init |
| PUT | /api/session/root | `{ root: string }` | `SessionState` | Set current root |
| POST | /api/session/workspaces | `{ path: string }` | `SessionState` | Add a workspace |
| DELETE | /api/session/workspaces | `{ path: string }` | `SessionState` | Remove a workspace |
| PUT | /api/session/sidebar | `{ workspacesCollapsed: boolean }` | `SessionState` | Update sidebar collapse state |
| POST | /api/browse | — | `{ path: string } \| null` | Open folder picker |
| POST | /api/clipboard | `{ text: string }` | `{ ok: true }` | Copy to clipboard (server-side) |

Session-mutating endpoints return the full updated `SessionState` so the client can reconcile without a separate GET.

*See the tech design document for full architecture, implementation targets, and test mapping.*

## Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Workspaces section renders, collapses/expands, persists collapse state
- [ ] Workspace entries show labels, tooltips, truncation
- [ ] Clicking workspace switches root
- [ ] Active workspace visually indicated
- [ ] Deleted workspace path shows error on click
- [ ] Remove workspace via x button, hover to reveal
- [ ] Root line displays truncated path with tooltip
- [ ] Browse, pin, copy, refresh actions work
- [ ] Action visibility: browse always visible, others on hover
- [ ] All API endpoints functional
- [ ] All tests pass
