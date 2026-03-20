# Epic 1: App Shell and Workspace Browsing

This epic defines the complete requirements for the MD Viewer app shell, sidebar
navigation, and workspace management. It serves as the source of truth for the
Tech Lead's design work.

---

## User Profile

**Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
**Context:** Launching a local tool to browse directories full of markdown files. Working across repos and project workspaces. May be in a corporate environment where native app installation is restricted.
**Mental Model:** "I point this at a folder, I see my markdown files, I save folders I come back to often."
**Key Constraint:** Must run locally from Node without app signing, admin access, or cloud dependencies. Keyboard shortcuts are baseline.

---

## Feature Overview

This feature delivers the app shell, local server runtime, sidebar with workspace
management and file tree browsing, theme switching, and session persistence. After
this epic, the user can launch the app, point it at directories, browse markdown
files in a filtered tree, save and switch between workspaces, and customize
appearance. The content area shows an empty state — document rendering ships in
Epic 2.

---

## Scope

### In Scope

The foundation layer of MD Viewer — everything needed to launch, navigate, and
manage workspaces before any documents are opened:

- Local Fastify server serving static frontend
- App shell with menu bar, sidebar, tab strip (empty state), and content area (empty state)
- Sidebar workspace management and file tree browsing
- Right-click context menus on files and directories
- Theme system with 4 built-in themes
- Session persistence across restarts
- Keyboard shortcuts for shell-level operations

### Out of Scope

- Document rendering, markdown parsing, or content display (Epic 2)
- Content toolbar — mode toggle, export dropdown, status area (Epic 2)
- Tab behavior — open, switch, close (Epic 2)
- Mermaid diagram rendering (Epic 3)
- Export to any format (Epic 4)
- Editing, saving, or dirty state tracking (Epic 5)
- File watching or external change detection (Epic 2)
- Markdown package format detection (future)
- Search (future)

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | User has Node.js installed (v18+) | Unvalidated | Tech Lead | Document minimum version in README |
| A2 | App runs on macOS primarily; cross-platform is not a v1 requirement | Validated | Product | Linux/Windows may work but aren't tested |
| A3 | The browser UI uses a modern evergreen browser (Chrome, Safari, Firefox) | Unvalidated | Tech Lead | No IE/legacy support needed |
| A4 | File tree filtering to markdown-only is sufficient; users don't need to see non-markdown files | Validated | Product | Confirmed during mockup review |
| A5 | Local filesystem access via Fastify endpoints is acceptable security model for a locally-run tool | Unvalidated | Tech Lead | No remote access; binds to localhost only |
| A6 | Folder picker and all path operations return absolute server-side paths. Browser-only file APIs (webkitdirectory, File API) do not provide absolute paths, so folder selection must involve a server-side component. The specific mechanism (server-spawned native dialog, server-side directory listing endpoint, etc.) is a tech design decision. | Unvalidated | Tech Lead | Multiple ACs depend on absolute paths: copy-path, tooltips, data contracts, workspace persistence |

---

## Flows & Requirements

### 1. App Launch and Initial State

The user starts the app for the first time (or with no saved session). The server
starts, the browser opens, and the app shell renders with an empty workspace
state.

1. User runs the start command
2. Fastify server starts and binds to a local port
3. Browser opens (or user navigates) to the local URL
4. App shell renders: menu bar, empty sidebar, empty tab strip, empty content area
5. If a previous session exists, saved workspaces and last root are restored

#### Acceptance Criteria

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
  - Note: This TC is testable at M1 (after Epic 2 ships file opening). Epic 1 delivers the UI and persistence structure; Epic 2 populates it. Since Epics 1+2 co-ship as M1, this is not a gap in practice.

**AC-1.4:** Empty tab strip shows placeholder text

- **TC-1.4a: No documents open**
  - Given: App is in empty state
  - When: User views the tab strip
  - Then: Tab strip shows "No documents open" text

### 2. Menu Bar

The menu bar sits at the top of the app. It contains dropdown menus (File, Export,
View), quick-action toolbar icons, and a status area on the right.

1. User sees the menu bar on every screen state
2. User clicks a menu heading to see dropdown options
3. User clicks a quick-action icon for common operations
4. Status area shows contextual information (file path when a document is open — Epic 2)

#### Acceptance Criteria

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
  - Note: Amendment — Open File moved to Epic 2. The icon is present but disabled (matching the Export disabled pattern). The Cmd+O shortcut is NOT registered in Epic 1 — registering it would call preventDefault() and eat the browser's native Cmd+O with no replacement. Epic 2 registers both the shortcut and activates the icon.

**AC-2.3:** Keyboard shortcuts trigger menu actions without opening the menu

- **TC-2.3a: Cmd+O is NOT registered in Epic 1**
  - Given: App is focused
  - When: User presses Cmd+O
  - Then: No shortcut handler fires; the browser's native behavior is not prevented. Epic 2 registers this shortcut.
  - Note: Amendment — see TC-2.2c note. Not registering avoids calling preventDefault() on a shortcut that has no handler.
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
- **TC-2.4c: Context menu supports keyboard navigation**
  - Given: Context menu is open
  - When: User presses arrow keys
  - Then: Focus moves between menu items; Enter activates; Escape closes

**AC-2.5:** Sidebar can be toggled via keyboard shortcut and View menu

- **TC-2.5a: Toggle sidebar closed**
  - Given: Sidebar is visible
  - When: User presses the toggle sidebar shortcut (or selects View → Toggle Sidebar)
  - Then: Sidebar collapses, content area expands to fill the space
- **TC-2.5b: Toggle sidebar open**
  - Given: Sidebar is collapsed
  - When: User presses the toggle sidebar shortcut
  - Then: Sidebar reappears at its previous width

### 3. Sidebar — Workspaces Section

The Workspaces section is a collapsible list of saved root paths. Each entry shows
a label (directory name), the full path on hover, and an x button to remove.
Clicking a workspace switches the current root to that path.

1. User views the Workspaces section in the sidebar
2. User clicks a workspace entry to switch roots
3. User removes a workspace with the x button
4. User collapses or expands the section

#### Acceptance Criteria

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

### 4. Sidebar — Root Line

The root line is a single non-collapsible row showing the current root directory.
It provides a browse action (folder picker), pin-as-workspace, copy-path, and
refresh actions.

1. User views the root line
2. User clicks browse to select a new root folder
3. User pins the current root as a workspace
4. User copies the root path
5. User refreshes the file tree

#### Acceptance Criteria

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
  - Given: User clicks the browse icon (📁) on the root line
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
  - When: User clicks the pin icon (📌)
  - Then: The path is added to the Workspaces section and persisted
- **TC-4.3b: Pin when already saved**
  - Given: Root matches an existing workspace
  - When: User clicks the pin icon
  - Then: No duplicate is created; either the action is a no-op or the icon indicates it's already saved

**AC-4.4:** Copy action copies the root path to the clipboard

- **TC-4.4a: Copy path**
  - Given: Root is set
  - When: User clicks the copy icon (⎘)
  - Then: The full absolute path is copied to the system clipboard

**AC-4.5:** Refresh action reloads the file tree from disk

- **TC-4.5a: Refresh after external changes**
  - Given: A new markdown file was added to the root directory externally
  - When: User clicks the refresh icon (↻)
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

### 5. Sidebar — File Tree

The file tree shows markdown files and directories under the current root. Only
directories that contain markdown files (at any depth) are shown. The tree supports
expand/collapse, expand all, collapse all, and right-click context menus.

1. User views the file tree populated from the current root
2. User expands and collapses directories
3. User uses Expand All / Collapse All
4. User right-clicks files and directories for context actions
5. User clicks a file (file opening is Epic 2 — this epic delivers the click target)

#### Acceptance Criteria

**AC-5.1:** File tree shows only markdown files and directories that contain markdown descendants. Markdown files are defined as files with `.md` or `.markdown` extensions, case-insensitive. Hidden files (dot-prefixed, e.g., `.hidden.md`) are excluded. Symlinked markdown files are included (symlinks are followed). `.mdx` files are not markdown for this purpose.

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

### 6. Right-Click Context Menus

Context menus provide quick actions on files and directories in the file tree.
Files get Copy Path. Directories get Copy Path, Make Root, and Save as Workspace.

1. User right-clicks a file in the tree
2. User right-clicks a directory in the tree
3. User selects an action from the context menu

#### Acceptance Criteria

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

### 7. Theme System

The app ships with 4 themes: 2 light and 2 dark. The user selects a theme from the
View menu. The theme applies to the entire UI. The selected theme persists across
sessions. The theme system is designed so additional themes can be added later
without structural changes.

1. User opens the View menu
2. User selects a theme from the theme submenu
3. Theme applies immediately to the entire app

#### Acceptance Criteria

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

### 8. Session Persistence

The app persists user state across restarts: saved workspaces, last root, recent
files list, selected theme, and sidebar collapse state.

1. User uses the app normally (saves workspaces, sets root, opens files, selects theme)
2. User quits the app
3. User relaunches — previous state is restored

#### Acceptance Criteria

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

**AC-8.4:** Theme selection persists across sessions

- **TC-8.4a:** Covered by TC-7.3a

**AC-8.5:** Sidebar collapse state persists across sessions

- **TC-8.5a:** Covered by TC-3.1c

### 9. Folder Selection

The user can select a root folder via multiple entry points: the sidebar browse
action, the File menu "Open Folder" item, the empty state "Open Folder" button,
or keyboard shortcut. All entry points produce the same result.

1. User triggers folder selection via any entry point
2. Folder picker dialog appears
3. User selects a directory
4. Root updates, file tree refreshes

#### Acceptance Criteria

**AC-9.1:** All folder selection entry points produce the same result

- **TC-9.1a: Sidebar browse icon**
  - Given: User clicks the 📁 icon on the root line
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

### 10. Error Handling

Filesystem operations can fail. The user should see clear feedback, not silent
failures or crashes.

#### Acceptance Criteria

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

---

## Data Contracts

### Session State

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
```

### File Tree API

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

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_PATH | Path is not absolute or contains invalid characters |
| 403 | PERMISSION_DENIED | Filesystem permission denied on the requested path |
| 404 | PATH_NOT_FOUND | The requested directory does not exist |
| 500 | SCAN_ERROR | Unexpected error during directory scan |

### API Surface

All endpoints are local only (localhost). Request/response bodies are JSON.

| Method | Path | Request | Success Response | Error | Notes |
|--------|------|---------|-----------------|-------|-------|
| GET | /api/session | — | `SessionState` | 500 | Load session on startup |
| PUT | /api/session/root | `{ root: string }` | `SessionState` | 400, 403, 404 | Set current root; returns updated session |
| POST | /api/session/workspaces | `{ path: string }` | `SessionState` | 400, 404 | Add a workspace |
| DELETE | /api/session/workspaces | `{ path: string }` | `SessionState` | 400 | Remove a workspace |
| PUT | /api/session/theme | `{ theme: ThemeId }` | `SessionState` | 400 | Set theme |
| PUT | /api/session/sidebar | `{ workspacesCollapsed: boolean }` | `SessionState` | — | Update sidebar state |
| GET | /api/tree | `?root={path}` | `FileTreeResponse` | 400, 403, 404, 500 | Scan directory tree |
| POST | /api/browse | — | `{ path: string } \| null` | 500 | Open server-side folder picker; returns selected absolute path or null if cancelled |
| POST | /api/clipboard | `{ text: string }` | `{ ok: true }` | 500 | Copy text to system clipboard (server-side, for environments where browser clipboard API is unavailable) |
| POST | /api/session/recent-files | `{ path: string }` | `SessionState` | 400 | Add or update a recent file entry. Epic 1 defines the endpoint; Epic 2 calls it when files are opened. |
| DELETE | /api/session/recent-files | `{ path: string }` | `SessionState` | 400 | Remove a recent file entry. Called when a stale entry is clicked and the file no longer exists. |

Session-mutating endpoints return the full updated `SessionState` so the client can reconcile without a separate GET. The tech lead may consolidate or restructure these endpoints; the contract that matters is: each operation above has an explicit server endpoint, not client-side-only logic.

---

## Non-Functional Requirements

### Performance
- File tree populates within 2 seconds for directories with up to 500 markdown files
- Server starts and serves the first page within 3 seconds
- Theme switching is instantaneous (no perceptible delay)
- Sidebar interactions (expand, collapse, scroll) are immediate

### Security
- Server binds to localhost only; no network-accessible endpoints
- File tree API only serves paths under the requested root (no path traversal)
- No remote network calls during normal operation

### Reliability
- Session persistence uses atomic writes to prevent corruption on crash
- Malformed session data results in clean reset, not crash

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. What is the session persistence format and location? (JSON file in a config directory? Which directory — ~/.mdviewer, XDG config, or alongside the app?)
2. How does the folder picker work in a browser context? Must return absolute server-side paths (see A6). Browser-only file APIs (webkitdirectory) don't provide absolute paths, so a server-side component is required. Options include: server-spawned native dialog (e.g., Zenity/osascript), a `/api/browse` endpoint that opens a chooser, or a custom in-app directory browser. Which approach best fits the UX and architecture?
3. How should the file tree scan handle very large directories? (Lazy loading children on expand? Full scan upfront? Hybrid?)
4. What is the startup command? (`npx mdv`? `npm start` in the repo? A global install?)
5. How should clipboard operations work cross-browser? (navigator.clipboard API with fallback?)
6. What CSS architecture for themes? (CSS custom properties on `:root` switched by a data attribute? Separate stylesheets? CSS-in-JS?)
7. Should the file tree scan be a single API call returning the full tree, or should children be fetched on demand per expand?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

Types, project scaffolding, Fastify server setup, static file serving, build
configuration. TypeScript project config, shared type definitions (SessionState,
TreeNode, ThemeId), test framework setup.

### Story 1: App Shell Chrome

**Delivers:** User sees the app shell — menu bar with dropdowns, empty tab strip, empty content area with launch state, keyboard shortcut framework.
**Prerequisite:** Story 0
**ACs covered:**
- AC-1.1 (app launches and opens in browser)
- AC-1.3 (empty content area with prompts)
- AC-1.4 (empty tab strip placeholder)
- AC-2.1 (menu bar with dropdowns)
- AC-2.2 (quick-action icons with tooltips)
- AC-2.3 (keyboard shortcuts)
- AC-2.4 (keyboard navigability of interactive elements)
- AC-2.5 (sidebar toggle)

**Estimated test count:** 16-19

### Story 2: Sidebar — Workspaces and Root Line

**Delivers:** User can save, switch, and remove workspaces. Root line shows current path with browse, pin, copy, refresh actions.
**Prerequisite:** Story 1
**ACs covered:**
- AC-3.1 (collapsible Workspaces section)
- AC-3.2 (workspace labels and tooltips)
- AC-3.3 (switch root via workspace click)
- AC-3.4 (remove workspace)
- AC-4.1 (root line path display)
- AC-4.2 (browse action)
- AC-4.3 (pin action)
- AC-4.4 (copy action)
- AC-4.5 (refresh action)
- AC-4.6 (action visibility)

**Estimated test count:** 18-22

### Story 3: File Tree Browsing

**Delivers:** User browses markdown files in a filtered directory tree with expand/collapse, expand all, and file count badges.
**Prerequisite:** Story 2 (needs root to be set)
**ACs covered:**
- AC-5.1 (markdown-only filtering)
- AC-5.2 (expand/collapse directories)
- AC-5.3 (expand all / collapse all)
- AC-5.4 (sort order)
- AC-5.5 (markdown count per directory)
- AC-5.6 (file tree scrolling)
- AC-5.7 (expand state does not persist across restarts)
- AC-9.1 (folder selection entry points)
- AC-9.2 (loading performance)

**Estimated test count:** 16-20

### Story 4: Context Menus

**Delivers:** User right-clicks files and directories for Copy Path, Make Root, Save as Workspace.
**Prerequisite:** Story 3 (needs file tree rendered)
**ACs covered:**
- AC-6.1 (file context menu with Copy Path)
- AC-6.2 (directory context menu with all 3 actions)
- AC-6.3 (context menu close behavior)

**Estimated test count:** 8-10

### Story 5: Theme System

**Delivers:** User switches between 4 themes (2 light, 2 dark) from the View menu. Theme applies instantly and persists.
**Prerequisite:** Story 1 (needs View menu)
**ACs covered:**
- AC-7.1 (four themes available)
- AC-7.2 (immediate application)
- AC-7.3 (persistence)
- AC-7.4 (extensible architecture)

**Estimated test count:** 6-8

### Story 6: Session Persistence and Error Handling

**Delivers:** All user state survives app restart. Filesystem errors produce clear feedback.
**Prerequisite:** Stories 2, 3, 5 (needs state to persist)
**ACs covered:**
- AC-1.2 (session restore on launch)
- AC-8.1 (workspace persistence)
- AC-8.2 (root persistence)
- AC-8.3 (recent files persistence)
- AC-8.4 (theme persistence)
- AC-8.5 (sidebar state persistence)
- AC-10.1 (permission errors)
- AC-10.2 (missing root)
- AC-10.3 (filesystem edge cases)

**Estimated test count:** 14-18

---

## Amendments

### Amendment 1: Open File moved to Epic 2 (2026-03-19)

**Changed:** TC-2.2b, TC-2.2c, TC-2.3a
**Reason:** The epic's Out of Scope excludes "Document rendering, markdown parsing, or content display (Epic 2)" and the PRD lists "Opening markdown files from the tree, File menu, or keyboard shortcut" in Feature 2's In Scope. The Open File quick-action icon is present but disabled (matching the Export disabled pattern). The Cmd+O shortcut is NOT registered — registering it would call preventDefault() and eat the browser's native Cmd+O with no replacement. Epic 2 registers the shortcut and activates the icon.

---

## Validation Checklist

- [x] User Profile has all four fields + Feature Overview
- [x] Flows cover all paths (happy, alternate, cancel/error)
- [x] Every AC is testable (no vague terms)
- [x] Every AC has at least one TC
- [x] TCs cover happy path, edge cases, and errors
- [x] Data contracts are fully typed
- [x] Scope boundaries are explicit (in/out/assumptions)
- [x] Story breakdown covers all ACs
- [x] Stories sequence logically (shell → sidebar → tree → menus → themes → persistence)
- [x] All validator issues addressed (self-review round 1 + external review round 1)
- [ ] Validation rounds complete (pending final sign-off)
- [x] Self-review complete
