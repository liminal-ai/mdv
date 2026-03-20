# Epic 1: App Shell and Workspace Browsing — Stories

---

## Story 0: Foundation (Infrastructure)

### Summary
<!-- Jira: Summary field -->
Project scaffolding, shared types, Fastify server setup, and test framework configuration.

### Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts. Launching a local tool to browse directories full of markdown files. Must run locally from Node without app signing, admin access, or cloud dependencies.

**Objective:** Establish the project foundation so all subsequent stories build on a common base — TypeScript config, shared type definitions, Fastify server with static serving, and test infrastructure.

**Scope:**
- In: TypeScript project config, shared type definitions (SessionState, Workspace, RecentFile, ThemeId, TreeNode, FileTreeRequest, FileTreeResponse, error codes), shared error primitives (error code enum/constants, structured error response shape), Fastify server scaffold, static file serving, test framework setup, shared test fixtures (mock session state factory, mock tree node factory, temp directory helpers)
- Out: Any UI rendering, business logic, or user-facing behavior

**Dependencies:** None — this is the first story.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

No user-facing ACs. Foundation stories establish shared plumbing. Acceptance is confirmed by:
- TypeScript compiles cleanly
- Shared types are importable from both server and client code
- Fastify starts and serves a static HTML page on localhost
- Test framework runs and at least one smoke test passes

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

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

interface RecentFile {
  path: string;       // absolute path
  openedAt: string;   // ISO 8601 UTC, last opened time
}

// Recent files list is capped at 20 entries, oldest dropped on overflow.
// Epic 1 owns the data structure and persistence; Epic 2 populates it when files are opened.

type ThemeId = string; // e.g., "light-default", "light-warm", "dark-default", "dark-cool"

interface FileTreeRequest {
  root: string;       // absolute path to scan
}

interface FileTreeResponse {
  root: string;
  tree: TreeNode[];
}

interface TreeNode {
  name: string;           // filename or directory name
  path: string;           // absolute path
  type: "file" | "directory";
  children?: TreeNode[];  // only for directories
  mdCount?: number;       // markdown descendant count, only for directories
}
```

Error response codes:

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_PATH | Path is not absolute or contains invalid characters |
| 403 | PERMISSION_DENIED | Filesystem permission denied on the requested path |
| 404 | PATH_NOT_FOUND | The requested directory does not exist |
| 500 | SCAN_ERROR | Unexpected error during directory scan |

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] TypeScript compiles with no errors
- [ ] All shared types are exported and importable
- [ ] Shared error primitives (error codes, structured response shape) exported
- [ ] Shared test fixtures (session factory, tree node factory, temp dir helpers) available
- [ ] Fastify starts and serves static files on localhost
- [ ] Test framework configured and smoke test passes
- [ ] Linting passes

---

## Story 1: App Shell Chrome

### Summary
<!-- Jira: Summary field -->
App shell with menu bar, dropdowns, empty tab strip, empty content area with launch state, and keyboard shortcut framework.

### Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts. Launching a local tool to browse directories full of markdown files. Must run locally from Node without app signing, admin access, or cloud dependencies. Keyboard shortcuts are baseline.

**Objective:** Deliver the visible app chrome — the user launches the app and sees a complete shell with menu bar, dropdowns, empty states, and keyboard navigation. This is the first thing the user sees.

**Scope:**
- In: Server startup with browser launch, app shell layout (menu bar, sidebar container, tab strip, content area), File/Export/View dropdown menus with keyboard nav, quick-action toolbar icons with tooltips, empty content area with launch state prompts, empty tab strip placeholder, sidebar toggle, global keyboard shortcuts
- Out: Sidebar workspace/root/tree content (Story 2-3), context menus (Story 4), theme rendering (Story 5), session restore (Story 6)

**Dependencies:** Story 0 (types and server scaffold)

### Acceptance Criteria
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

### Technical Design
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

### Definition of Done
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

---

## Story 2: Sidebar — Workspaces and Root Line

### Summary
<!-- Jira: Summary field -->
Sidebar workspace management (save, switch, remove) and root line with browse, pin, copy, and refresh actions.

### Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user who works with markdown as a primary medium. "I point this at a folder, I see my markdown files, I save folders I come back to often."

**Objective:** Deliver workspace management — the user saves root paths as workspaces, switches between them, and uses root line actions (browse, pin, copy, refresh). This is the sidebar navigation layer.

**Scope:**
- In: Workspaces section (collapsible list, add/switch/remove), root line (path display, browse, pin, copy, refresh), action visibility on hover, workspace-to-root switching, API endpoints for workspace and session mutations
- Out: File tree rendering (Story 3), context menus (Story 4), session persistence across restarts (Story 6 — this story creates the data; Story 6 ensures it survives restarts)

**Dependencies:** Story 1 (app shell layout with sidebar container)

### Acceptance Criteria
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

### Technical Design
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

### Definition of Done
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

---

## Story 3: File Tree Browsing

### Summary
<!-- Jira: Summary field -->
Filtered markdown file tree with expand/collapse, expand all/collapse all, count badges, sorting, and folder selection entry points.

### Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user browsing directories full of markdown files. "I point this at a folder, I see my markdown files."

**Objective:** Deliver the file tree — the user sees markdown files filtered from the directory, browses with expand/collapse, uses expand all/collapse all, and sees file counts. All folder selection entry points (sidebar browse, File menu, empty state button, keyboard shortcut) produce the same result.

**Scope:**
- In: File tree rendering with markdown-only filtering (`.md`, `.markdown`, case-insensitive), hidden file exclusion, `.mdx` exclusion, symlink following, directory expand/collapse, expand all/collapse all, sort order (dirs first, alphabetical case-insensitive), markdown count badges, independent scrolling, expand state within session (not across restarts), all folder selection entry points, loading performance, file tree keyboard navigation (TC-2.4b — framework from Story 1 applied to tree nodes here)
- Out: Right-click context menus on tree nodes (Story 4), file opening on click (Epic 2)

**Dependencies:** Story 2 (root must be settable)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-5.1:** File tree shows only markdown files and directories that contain markdown descendants. Markdown files are defined as files with `.md` or `.markdown` extensions, case-insensitive. Hidden files (dot-prefixed) are excluded. Symlinked markdown files are included (symlinks are followed). `.mdx` files are not markdown for this purpose.

- **TC-5.1a: Markdown files displayed**
  - Given: Root contains files: README.md, notes.md, script.sh, image.png
  - When: File tree renders
  - Then: Only README.md and notes.md appear
- **TC-5.1e: Case-insensitive extension matching**
  - Given: Root contains files: NOTES.MD, changelog.Markdown, readme.md
  - When: File tree renders
  - Then: All three files appear
- **TC-5.1f: Hidden files excluded**
  - Given: Root contains .hidden.md and visible.md
  - When: File tree renders
  - Then: Only visible.md appears
- **TC-5.1g: MDX files excluded**
  - Given: Root contains component.mdx and readme.md
  - When: File tree renders
  - Then: Only readme.md appears
- **TC-5.1h: Symlinked markdown files included with symlink path**
  - Given: Root contains a symlink `docs/link.md` pointing to a .md file outside the root
  - When: File tree renders
  - Then: The symlinked file appears in the tree. `TreeNode.path` is the symlink's path inside the root (not the resolved target), preserving root confinement. Copy Path copies the symlink path. The file-tree API never exposes paths outside the root.
- **TC-5.1b: Empty directory hidden**
  - Given: Root contains a directory with no .md files at any depth
  - When: File tree renders
  - Then: That directory is not shown
- **TC-5.1c: Nested directory with markdown shown**
  - Given: Root contains dir-a/dir-b/doc.md
  - When: File tree renders
  - Then: dir-a and dir-b are shown because they have markdown descendants
- **TC-5.1d: Mixed directory**
  - Given: A directory contains 3 .md files and 10 .ts files
  - When: File tree renders
  - Then: Only the 3 .md files appear; the .ts files are not shown

**AC-5.2:** Directories expand and collapse on click

- **TC-5.2a: Expand a directory**
  - Given: A collapsed directory node
  - When: User clicks the disclosure triangle
  - Then: Directory expands to show its children
- **TC-5.2b: Collapse a directory**
  - Given: An expanded directory node
  - When: User clicks the disclosure triangle
  - Then: Directory collapses, children are hidden
- **TC-5.2c: Expand state is preserved within session**
  - Given: User has expanded dir-a and dir-a/dir-b
  - When: User switches to a different workspace and back
  - Then: dir-a and dir-a/dir-b are still expanded

**AC-5.3:** Expand All expands every directory that has markdown descendants; Collapse All collapses all

- **TC-5.3a: Expand All behavior**
  - Given: File tree has nested directories, some with markdown, some without
  - When: User clicks Expand All
  - Then: Every directory with at least one markdown descendant is expanded. Directories with no markdown descendants are not expanded.
- **TC-5.3b: Expand All stops at leaf directories**
  - Given: A path root/a/b/c/ where c/ contains only doc.md
  - When: User clicks Expand All
  - Then: root, a, b, and c are all expanded; doc.md is visible
- **TC-5.3c: Collapse All**
  - Given: Several directories are expanded
  - When: User clicks Collapse All
  - Then: All directories collapse to show only top-level items
- **TC-5.3d: Expand All on a large tree**
  - Given: Root contains 200+ directories with markdown files
  - When: User clicks Expand All
  - Then: Tree fully expands without freezing the UI

**AC-5.4:** File tree is sorted: directories first, then files, both alphabetical case-insensitive

- **TC-5.4a: Sort order**
  - Given: A directory contains subdirectories "Docs", "api", and files "README.md", "changelog.md"
  - When: File tree renders
  - Then: Order is: api, Docs, changelog.md, README.md (directories first alphabetically, then files alphabetically, case-insensitive)

**AC-5.5:** File tree shows markdown file count per directory

- **TC-5.5a: Count displayed**
  - Given: A directory contains 14 markdown files (including nested)
  - When: User views that directory node
  - Then: A count badge shows "14" next to the directory name

**AC-5.6:** File tree scrolls independently of the rest of the sidebar

- **TC-5.6a: Overflow scrolling**
  - Given: File tree has more entries than fit in the sidebar
  - When: User scrolls within the file tree area
  - Then: File tree scrolls; Workspaces section and root line remain fixed

**AC-5.7:** File tree expand/collapse state does not persist across app restarts

- **TC-5.7a: Tree resets to collapsed on restart**
  - Given: User has expanded several directories
  - When: App restarts
  - Then: All directories start collapsed (tree contents may have changed on disk; persisting stale expand state would be misleading)

**AC-9.1:** All folder selection entry points produce the same result

- **TC-9.1a: Sidebar browse icon**
  - Given: User clicks the browse icon on the root line
  - When: User selects a folder
  - Then: Root updates, file tree refreshes
- **TC-9.1b: File menu Open Folder**
  - Given: User clicks File → Open Folder
  - When: User selects a folder
  - Then: Root updates, file tree refreshes
- **TC-9.1c: Empty state Open Folder button**
  - Given: No root is set, user clicks "Open Folder" in the content area
  - When: User selects a folder
  - Then: Root updates, file tree refreshes
- **TC-9.1d: Keyboard shortcut**
  - Given: User presses the Open Folder keyboard shortcut
  - When: User selects a folder
  - Then: Root updates, file tree refreshes

**AC-9.2:** Selecting a folder with many files loads the tree within responsive limits

- **TC-9.2a: Medium-sized directory**
  - Given: User selects a root with ~500 markdown files
  - When: Root is set
  - Then: File tree populates within 2 seconds
- **TC-9.2b: Large directory**
  - Given: User selects a root with ~2000 markdown files
  - When: Root is set
  - Then: File tree populates without freezing the UI; a loading indicator may appear briefly

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Relevant data contracts:

```typescript
interface FileTreeRequest {
  root: string;       // absolute path to scan
}

interface FileTreeResponse {
  root: string;
  tree: TreeNode[];
}

interface TreeNode {
  name: string;           // filename or directory name
  path: string;           // absolute path
  type: "file" | "directory";
  children?: TreeNode[];  // only for directories
  mdCount?: number;       // markdown descendant count, only for directories
}
```

API endpoint:

| Method | Path | Request | Success Response | Error |
|--------|------|---------|-----------------|-------|
| GET | /api/tree | `?root={path}` | `FileTreeResponse` | 400, 403, 404, 500 |

Markdown file definition: `.md` or `.markdown` extension, case-insensitive. Hidden files (dot-prefixed) excluded. `.mdx` excluded. Symlinks followed, but `TreeNode.path` uses the symlink path (not resolved target) to preserve root confinement.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] File tree renders markdown-only files with correct filtering
- [ ] Case-insensitive extensions, hidden file exclusion, mdx exclusion all work
- [ ] Symlinks followed with symlink path preserved
- [ ] Empty directories hidden, nested directories with markdown shown
- [ ] Expand/collapse directories works
- [ ] Expand state preserved within session, not across restarts
- [ ] Expand All / Collapse All functional
- [ ] Sort order: directories first, alphabetical case-insensitive
- [ ] Count badges on directories
- [ ] File tree scrolls independently
- [ ] All folder selection entry points produce same result
- [ ] File tree keyboard navigation works (TC-2.4b: arrow keys, Enter, expand/collapse — framework from Story 1 applied here)
- [ ] Tree loads within performance limits
- [ ] All tests pass

---

## Story 4: Context Menus

### Summary
<!-- Jira: Summary field -->
Right-click context menus on file tree nodes with Copy Path, Make Root, and Save as Workspace actions.

### Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user browsing directories full of markdown files. Expects right-click context menus for quick actions on files and directories.

**Objective:** Deliver context menus on file tree nodes — files get Copy Path, directories get Copy Path, Make Root, and Save as Workspace.

**Scope:**
- In: Right-click context menu on files (Copy Path), right-click context menu on directories (Copy Path, Make Root, Save as Workspace), menu close behavior (action, outside click, Escape), keyboard navigation of context menus
- Out: File opening (Epic 2)

**Dependencies:** Story 3 (file tree must be rendered)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-6.1:** Right-clicking a file shows a context menu with Copy Path

- **TC-6.1a: File context menu**
  - Given: User views the file tree
  - When: User right-clicks on a markdown file
  - Then: A context menu appears with "Copy Path"
- **TC-6.1b: Copy Path copies the full file path**
  - Given: Context menu is showing for /Users/leemoore/code/project-atlas/docs/readme.md
  - When: User clicks "Copy Path"
  - Then: The full absolute path is copied to the clipboard and the context menu closes

**AC-6.2:** Right-clicking a directory shows a context menu with Copy Path, Make Root, and Save as Workspace

- **TC-6.2a: Directory context menu**
  - Given: User views the file tree
  - When: User right-clicks on a directory
  - Then: A context menu appears with "Copy Path", "Make Root", and "Save as Workspace"
- **TC-6.2b: Make Root changes the current root**
  - Given: Root is /Users/leemoore/code
  - When: User right-clicks /Users/leemoore/code/project-atlas and selects "Make Root"
  - Then: Root changes to /Users/leemoore/code/project-atlas, root line updates, file tree refreshes
- **TC-6.2c: Save as Workspace adds to workspace list**
  - Given: /Users/leemoore/code/project-atlas is not in the workspace list
  - When: User right-clicks the directory and selects "Save as Workspace"
  - Then: The path is added to the Workspaces section

**AC-6.3:** Context menu closes when an action is selected or user clicks elsewhere

- **TC-6.3a: Close on action**
  - Given: Context menu is open
  - When: User clicks an action
  - Then: Action fires, context menu closes
- **TC-6.3b: Close on outside click**
  - Given: Context menu is open
  - When: User clicks anywhere outside the menu
  - Then: Context menu closes, no action fires
- **TC-6.3c: Close on Escape**
  - Given: Context menu is open
  - When: User presses Escape
  - Then: Context menu closes

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Context menus use the `TreeNode` contract from Story 3:

```typescript
interface TreeNode {
  name: string;
  path: string;           // absolute path — used for Copy Path and Make Root
  type: "file" | "directory";
  children?: TreeNode[];
  mdCount?: number;
}
```

Actions map to existing API endpoints:

| Action | API Endpoint | Notes |
|--------|-------------|-------|
| Copy Path | POST /api/clipboard | `{ text: node.path }` |
| Make Root | PUT /api/session/root | `{ root: node.path }` |
| Save as Workspace | POST /api/session/workspaces | `{ path: node.path }` |

No new API endpoints required.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Right-click file shows context menu with Copy Path
- [ ] Right-click directory shows context menu with Copy Path, Make Root, Save as Workspace
- [ ] All actions fire correctly
- [ ] Context menu closes on action, outside click, or Escape
- [ ] Context menu supports keyboard navigation (TC-2.4c from Story 1)
- [ ] All tests pass

---

## Story 5: Theme System

### Summary
<!-- Jira: Summary field -->
Four built-in themes (2 light, 2 dark) selectable from View menu, applied immediately, persisted across sessions.

### Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user who customizes appearance. Working across repos and project workspaces, possibly in different lighting conditions.

**Objective:** Deliver the theme system — 4 built-in themes, selectable from the View menu theme submenu, applied instantly to the entire UI, persisted across sessions. The architecture supports adding themes without code changes.

**Scope:**
- In: 4 themes (2 light, 2 dark), View menu theme submenu with current indicator, immediate full-app application, persistence via session API, extensible architecture (new themes = new definitions only)
- Out: Custom user themes (future), theme preview on hover (not required)

**Dependencies:** Story 1 (View menu structure)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-7.1:** Four built-in themes are available: 2 light and 2 dark

- **TC-7.1a: Theme list**
  - Given: User opens View menu → Theme submenu
  - When: Submenu opens
  - Then: 4 themes are listed, clearly labeled as light or dark variants
- **TC-7.1b: Current theme is indicated**
  - Given: User views the theme submenu
  - When: Submenu is open
  - Then: The currently active theme has a checkmark or similar indicator

**AC-7.2:** Selecting a theme applies it immediately to the entire app

- **TC-7.2a: Theme applies to all chrome**
  - Given: User is using a light theme
  - When: User selects a dark theme
  - Then: Menu bar, sidebar, tab strip, content area, and all chrome update to the dark theme without page reload
- **TC-7.2b: No flash of default theme**
  - Given: User selects a new theme
  - When: Theme changes
  - Then: Transition is immediate with no flash of the previous theme

**AC-7.3:** Selected theme persists across sessions

- **TC-7.3a: Theme restored on launch**
  - Given: User selected a dark theme and quit the app
  - When: App launches again
  - Then: The dark theme is applied from the start

**AC-7.4:** Adding a fifth theme does not require changes to rendering logic or component code — only a new theme definition

- **TC-7.4a: Theme extensibility**
  - Given: The 4 built-in themes exist
  - When: A new theme is added
  - Then: The new theme appears in the View menu and applies correctly without modifying any code outside of theme definitions

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Relevant data contracts:

```typescript
type ThemeId = string; // e.g., "light-default", "light-warm", "dark-default", "dark-cool"
```

API endpoint:

| Method | Path | Request | Success Response | Notes |
|--------|------|---------|-----------------|-------|
| PUT | /api/session/theme | `{ theme: ThemeId }` | `SessionState` | Set theme; returns updated session |

Theme persistence also covers AC-8.4 (session persistence of theme selection). TC-7.3a and TC-8.4a are the same test condition.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] 4 themes render (2 light, 2 dark)
- [ ] Theme submenu in View menu with current indicator
- [ ] Theme applies instantly to all chrome, no flash
- [ ] Theme persists across sessions
- [ ] Adding a new theme requires only a definition file/entry, no code changes
- [ ] All tests pass

---

## Story 6: Session Persistence and Error Handling

### Summary
<!-- Jira: Summary field -->
Full session state survives app restart. Filesystem errors produce clear feedback without crashes.

### Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user who expects tool state to survive restarts and filesystem errors to produce clear feedback.

**Objective:** Deliver reliable session persistence (workspaces, root, recent files restored on launch) and graceful error handling for filesystem edge cases (permission denied, missing directories, symlink loops, special files, corrupted session data).

**Scope:**
- In: Session restore on launch (workspaces, root, recent files), corrupted session recovery, root path validation on restore, recent files UI with missing-file handling, permission denied errors, missing root errors, symlink loops, special files, atomic session writes
- Out: File opening behavior (Epic 2 — recent files list is rendered but populated by Epic 2)

**Dependencies:** Stories 2, 3, 5 (need workspace, root, tree, and theme state to exist before testing persistence)

**Cross-story persistence coverage:** Theme persistence (AC-8.4) is owned and verified by Story 5 (TC-7.3a). Sidebar collapse state persistence (AC-8.5) is owned and verified by Story 2 (TC-3.1c). This story depends on those stories having implemented persistence for those concerns — it does not re-test them.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.2:** App restores previous session on launch

- **TC-1.2a: Session with saved workspaces and root**
  - Given: User previously saved 3 workspaces and had a root set
  - When: App launches
  - Then: All 3 workspaces appear in the Workspaces section, the last root is set, and the file tree shows that root's contents
- **TC-1.2b: Session with saved workspaces but no root**
  - Given: User previously saved workspaces but had no root selected when they quit
  - When: App launches
  - Then: Workspaces appear, root line shows "No root selected" with browse action, file tree is empty
- **TC-1.2c: Session data is corrupted or missing**
  - Given: Session file exists but is malformed
  - When: App launches
  - Then: App starts in clean empty state without crashing, session file is reset
- **TC-1.2d: Theme restored from session**
  - Given: User previously selected a dark theme
  - When: App launches
  - Then: The dark theme is applied immediately, not flashing default theme first
  - Known deviation: On the port-conflict path (TC-1.1c), if the app binds to a different port than previous sessions, localStorage (which is origin-specific) will be empty and the user may see a brief flash of default theme before the bootstrap API response restores the correct theme. This affects only the rare port-conflict case. Accepted as product tradeoff.

**AC-8.1:** Saved workspaces persist across sessions

- **TC-8.1a: Workspaces restored in insertion order**
  - Given: User saved 3 workspaces in order A, B, C
  - When: App restarts
  - Then: All 3 workspaces appear in the Workspaces section in order A, B, C (insertion order preserved)

**AC-8.2:** Last active root persists across sessions

- **TC-8.2a: Root restored**
  - Given: User had root set to /Users/leemoore/code/project-atlas
  - When: App restarts
  - Then: Root is set to the same path, file tree shows its contents
- **TC-8.2b: Persisted root no longer exists**
  - Given: User's last root path was deleted externally
  - When: App restarts
  - Then: App starts with no root set, shows empty state, no crash

**AC-8.3:** Recent files list persists across sessions

Note: Epic 1 owns the persistence structure and empty-state UI. Epic 2 populates the list when files are opened. These TCs are testable at M1, not Epic 1 in isolation.

- **TC-8.3a: Recent files restored**
  - Given: User opened 5 files during previous sessions (via Epic 2)
  - When: App restarts and shows empty content area
  - Then: Recent files list shows those 5 files
- **TC-8.3b: Recent file no longer exists**
  - Given: A file in the recent files list was deleted externally
  - When: User views the recent files list
  - Then: The entry either shows with an indicator that it's missing, or is quietly removed

**AC-10.1:** Permission denied on root folder produces visible error

- **TC-10.1a: Unreadable directory**
  - Given: User selects a directory they don't have read permission on
  - When: App tries to list files
  - Then: An error message is shown indicating the directory can't be read

**AC-10.2:** Root directory disappearing mid-session produces visible feedback

- **TC-10.2a: Directory deleted while browsing**
  - Given: Root is set to a valid directory
  - When: The directory is deleted externally and user clicks refresh
  - Then: An error is shown, file tree clears, root line indicates the path is no longer valid

**AC-10.3:** Filesystem errors do not crash the app

- **TC-10.3a: Symlink loop**
  - Given: Root directory contains a symlink loop
  - When: File tree scans the directory
  - Then: The loop is detected and skipped; rest of tree renders normally
- **TC-10.3b: Special files**
  - Given: Root directory contains device files, sockets, or other non-regular files
  - When: File tree scans the directory
  - Then: Special files are ignored; no crash

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Full session state contract:

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
  path: string;
  label: string;
  addedAt: string;    // ISO 8601 UTC
}

interface RecentFile {
  path: string;
  openedAt: string;   // ISO 8601 UTC
}

type ThemeId = string;
```

API endpoints for session and recent files:

| Method | Path | Request | Success Response | Notes |
|--------|------|---------|-----------------|-------|
| GET | /api/session | — | `SessionState` | Full session load on startup |
| POST | /api/session/recent-files | `{ path: string }` | `SessionState` | Add/update recent file (Epic 2 calls this) |
| DELETE | /api/session/recent-files | `{ path: string }` | `SessionState` | Remove stale recent file entry |

Error response codes:

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_PATH | Path is not absolute or contains invalid characters |
| 403 | PERMISSION_DENIED | Filesystem permission denied |
| 404 | PATH_NOT_FOUND | Directory does not exist |
| 500 | SCAN_ERROR | Unexpected error during directory scan |

Session persistence uses atomic writes to prevent corruption on crash. Malformed session data results in clean reset, not crash.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Session restore on launch: workspaces, root, recent files (theme and sidebar state persistence owned by Stories 5 and 2)
- [ ] Corrupted session file resets cleanly without crash
- [ ] Persisted root that no longer exists starts in empty state
- [ ] Recent files list renders (populated by Epic 2)
- [ ] Missing recent files handled gracefully
- [ ] Permission denied error shown for unreadable directories
- [ ] Missing root directory shown with clear feedback
- [ ] Symlink loops detected and skipped
- [ ] Special files ignored without crash
- [ ] Atomic session writes
- [ ] All tests pass

---

## Integration Path Trace

### Path 1: First Launch → Set Root via Empty State → Browse Files

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Run start command | Server starts, browser opens | Story 1 | TC-1.1a |
| Server binds localhost | Security: localhost only | Story 1 | TC-1.1b |
| App shell renders | Menu bar, sidebar, tab strip, content area | Story 1 | TC-1.1a |
| Empty state displayed | Launch state with Open Folder button | Story 1 | TC-1.3a |
| User clicks Open Folder in empty state | Folder picker appears, user selects folder | Story 3 | TC-9.1c |
| Root updates, file tree refreshes | Markdown files shown in tree | Story 3 | TC-5.1a |
| User expands directory | Children shown | Story 3 | TC-5.2a |
| User sees count badges | Markdown count per directory | Story 3 | TC-5.5a |

### Path 2: Save Workspace → Quit → Relaunch → Switch Workspace

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| User pins current root | Workspace added | Story 2 | TC-4.3a |
| Workspace appears in list | Label and tooltip | Story 2 | TC-3.2a, TC-3.2b |
| User quits app | Session saved | Story 6 | TC-8.1a |
| User relaunches | Session restored | Story 6 | TC-1.2a |
| Workspaces restored | All entries in order | Story 6 | TC-8.1a |
| Root restored | File tree shows | Story 6 | TC-8.2a |
| User clicks different workspace | Root switches | Story 2 | TC-3.3a |
| File tree refreshes | New root's files | Story 3 | TC-5.1a |

### Path 3: Theme Selection → Persistence → Restore

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| User opens View → Theme | Theme submenu | Story 5 | TC-7.1a |
| User selects dark theme | Theme applies instantly | Story 5 | TC-7.2a |
| All chrome updates | No flash | Story 5 | TC-7.2b |
| User quits and relaunches | Theme restored | Story 6 | TC-1.2d |
| Dark theme applied on start | No flash of default | Story 6 | TC-1.2d |

---

## Coverage Gate

| AC | TC | Story |
|----|-----|-------|
| AC-1.1 | TC-1.1a, TC-1.1b, TC-1.1c | Story 1 |
| AC-1.2 | TC-1.2a, TC-1.2b, TC-1.2c, TC-1.2d | Story 6 |
| AC-1.3 | TC-1.3a, TC-1.3b, TC-1.3c | Story 1 |
| AC-1.4 | TC-1.4a | Story 1 |
| AC-2.1 | TC-2.1a, TC-2.1b, TC-2.1c, TC-2.1d, TC-2.1e | Story 1 |
| AC-2.2 | TC-2.2a, TC-2.2b, TC-2.2c | Story 1 |
| AC-2.3 | TC-2.3a, TC-2.3b | Story 1 |
| AC-2.4 | TC-2.4a, TC-2.4b, TC-2.4c | Story 1 |
| AC-2.5 | TC-2.5a, TC-2.5b | Story 1 |
| AC-3.1 | TC-3.1a, TC-3.1b, TC-3.1c | Story 2 |
| AC-3.2 | TC-3.2a, TC-3.2b, TC-3.2c | Story 2 |
| AC-3.3 | TC-3.3a, TC-3.3b, TC-3.3c | Story 2 |
| AC-3.4 | TC-3.4a, TC-3.4b, TC-3.4c | Story 2 |
| AC-4.1 | TC-4.1a, TC-4.1b | Story 2 |
| AC-4.2 | TC-4.2a, TC-4.2b, TC-4.2c | Story 2 |
| AC-4.3 | TC-4.3a, TC-4.3b | Story 2 |
| AC-4.4 | TC-4.4a | Story 2 |
| AC-4.5 | TC-4.5a, TC-4.5b | Story 2 |
| AC-4.6 | TC-4.6a, TC-4.6b | Story 2 |
| AC-5.1 | TC-5.1a, TC-5.1b, TC-5.1c, TC-5.1d, TC-5.1e, TC-5.1f, TC-5.1g, TC-5.1h | Story 3 |
| AC-5.2 | TC-5.2a, TC-5.2b, TC-5.2c | Story 3 |
| AC-5.3 | TC-5.3a, TC-5.3b, TC-5.3c, TC-5.3d | Story 3 |
| AC-5.4 | TC-5.4a | Story 3 |
| AC-5.5 | TC-5.5a | Story 3 |
| AC-5.6 | TC-5.6a | Story 3 |
| AC-5.7 | TC-5.7a | Story 3 |
| AC-6.1 | TC-6.1a, TC-6.1b | Story 4 |
| AC-6.2 | TC-6.2a, TC-6.2b, TC-6.2c | Story 4 |
| AC-6.3 | TC-6.3a, TC-6.3b, TC-6.3c | Story 4 |
| AC-7.1 | TC-7.1a, TC-7.1b | Story 5 |
| AC-7.2 | TC-7.2a, TC-7.2b | Story 5 |
| AC-7.3 | TC-7.3a | Story 5 |
| AC-7.4 | TC-7.4a | Story 5 |
| AC-8.1 | TC-8.1a | Story 6 |
| AC-8.2 | TC-8.2a, TC-8.2b | Story 6 |
| AC-8.3 | TC-8.3a, TC-8.3b | Story 6 |
| AC-8.4 | TC-7.3a | Story 5 (sole owner) |
| AC-8.5 | TC-3.1c | Story 2 (sole owner) |
| AC-9.1 | TC-9.1a, TC-9.1b, TC-9.1c, TC-9.1d | Story 3 |
| AC-9.2 | TC-9.2a, TC-9.2b | Story 3 |
| AC-10.1 | TC-10.1a | Story 6 |
| AC-10.2 | TC-10.2a | Story 6 |
| AC-10.3 | TC-10.3a, TC-10.3b | Story 6 |

All ACs mapped. All TCs mapped exactly once. AC-8.4 and AC-8.5 are single-owner — Story 5 owns theme persistence (TC-7.3a), Story 2 owns sidebar state persistence (TC-3.1c). Story 6 depends on these but does not re-test them. No orphans.

---

## Validation

- [x] Every AC from the detailed epic appears in the story file
- [x] Every TC from the detailed epic appears in exactly one story
- [x] Integration path trace complete with no gaps
- [x] Coverage gate table complete with no orphans
- [x] Each story has Jira section markers
- [x] Cross-story TC dependencies noted (TC-2.4b → Story 3, TC-2.4c → Story 4, TC-1.3c → Epic 2)
