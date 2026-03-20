# Epic 1: App Shell and Workspace Browsing — Business Epic

---

## User Profile
<!-- Jira: Epic Description — User Profile section -->

**Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
**Context:** Launching a local tool to browse directories full of markdown files. Working across repos and project workspaces. May be in a corporate environment where native app installation is restricted.
**Mental Model:** "I point this at a folder, I see my markdown files, I save folders I come back to often."
**Key Constraint:** Must run locally from Node without app signing, admin access, or cloud dependencies. Keyboard shortcuts are baseline.

---

## Feature Overview
<!-- Jira: Epic Description — Feature Overview section -->

This feature delivers the app shell, local server runtime, sidebar with workspace management and file tree browsing, theme switching, and session persistence. After this epic, the user can launch the app, point it at directories, browse markdown files in a filtered tree, save and switch between workspaces, and customize appearance. The content area shows an empty state — document rendering ships in Epic 2.

---

## Scope
<!-- Jira: Epic Description — Scope section -->

### In Scope

The foundation layer of MD Viewer — everything needed to launch, navigate, and manage workspaces before any documents are opened:

- Local server serving static frontend
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
| A3 | The browser UI uses a modern evergreen browser | Unvalidated | Tech Lead | No IE/legacy support needed |
| A4 | File tree filtering to markdown-only is sufficient | Validated | Product | Confirmed during mockup review |
| A5 | Local filesystem access via server endpoints is acceptable security model | Unvalidated | Tech Lead | No remote access; binds to localhost only |
| A6 | Folder picker and path operations return absolute server-side paths. Browser-only file APIs do not provide absolute paths, so folder selection involves a server-side component. The specific mechanism is a tech design decision. | Unvalidated | Tech Lead | Multiple ACs depend on absolute paths |

---

## Flows & Requirements (Grouped ACs)
<!-- Jira: Acceptance Criteria field -->

### 1. App Launch and Initial State

AC-1.1 through AC-1.4 cover the first-launch experience. The app starts with a single command, opens in the browser, and renders the shell with empty states. The server binds to localhost only and handles port conflicts. The empty content area shows the app name, actionable buttons (Open Folder functional, Open File disabled until Epic 2), and a recent files list. The empty tab strip shows placeholder text. If a previous session exists, it is restored (AC-1.2 is covered in Session Persistence below).

*(See Story 1 for detailed ACs and test conditions.)*

### 2. Menu Bar

AC-2.1 through AC-2.5 cover the menu bar. File, Export, and View dropdown menus are present with keyboard shortcuts. Export options are visible but disabled when no document is open. Quick-action toolbar icons have tooltips; Open File is present but disabled (Epic 2 activates it). The Cmd+O shortcut is not registered in this epic to avoid eating the browser's native behavior. All interactive elements (menus, tree, context menus) support keyboard navigation. The sidebar toggles via shortcut and View menu.

*(See Story 1 for detailed ACs and test conditions.)*

### 3. Sidebar — Workspaces

AC-3.1 through AC-3.4 cover workspace management. The Workspaces section is a collapsible list of saved root paths. Each entry shows the directory name as a label, full path on hover, and an x button to remove (visible on hover). Clicking a workspace switches the current root. The active workspace is visually indicated. Switching to a workspace whose directory was deleted shows an error without changing the root. Removing the active workspace removes the list entry but keeps the current root set. Collapse state persists across sessions.

*(See Story 2 for detailed ACs and test conditions.)*

### 4. Sidebar — Root Line

AC-4.1 through AC-4.6 cover the root line. It displays the current root path (truncated, with full path on hover) or "No root selected." Actions: browse (always visible, opens folder picker), pin (saves as workspace, no duplicates), copy (copies absolute path to clipboard), and refresh (reloads file tree, preserves expand state). Pin, copy, and refresh appear on hover.

*(See Story 2 for detailed ACs and test conditions.)*

### 5. File Tree

AC-5.1 through AC-5.7 cover the file tree. The tree shows only markdown files (`.md`, `.markdown`, case-insensitive) and directories that contain markdown descendants. Hidden files are excluded. `.mdx` files are excluded. Symlinks are followed but display their symlink path. Directories expand and collapse; Expand All and Collapse All are available. Sort order: directories first, then files, both alphabetical case-insensitive. Each directory shows a markdown file count badge. The tree scrolls independently of the sidebar header. Expand/collapse state is preserved within a session but not across restarts. AC-9.1 through AC-9.2 cover folder selection — all entry points (sidebar browse, File menu, empty state button, keyboard shortcut) produce the same result, and the tree loads within responsive limits for directories up to 2000 markdown files.

*(See Story 3 for detailed ACs and test conditions.)*

### 6. Context Menus

AC-6.1 through AC-6.3 cover right-click context menus. Files get Copy Path. Directories get Copy Path, Make Root, and Save as Workspace. Context menus close on action, outside click, or Escape.

*(See Story 4 for detailed ACs and test conditions.)*

### 7. Theme System

AC-7.1 through AC-7.4 cover themes. Four built-in themes (2 light, 2 dark) are selectable from the View menu theme submenu. The current theme is indicated. Selecting a theme applies it immediately to the entire UI without flash or page reload. The selected theme persists across sessions. The architecture supports adding themes without code changes outside of theme definitions.

*(See Story 5 for detailed ACs and test conditions.)*

### 8. Session Persistence

AC-8.1 through AC-8.5 cover persistence. Saved workspaces persist in insertion order. Last active root persists (with graceful handling if the path no longer exists). Recent files list persists (the list structure is owned by this epic; Epic 2 populates it when files are opened). Theme selection persists (covered by AC-7.3). Sidebar collapse state persists (covered by AC-3.1). AC-1.2 covers session restore on launch including corrupted-data recovery. Session persistence uses atomic writes to prevent corruption.

*(See Story 6 for detailed ACs and test conditions.)*

### 9. Error Handling

AC-10.1 through AC-10.3 cover filesystem errors. Permission denied on a root folder produces a visible error. A root directory that disappears mid-session produces clear feedback on refresh. Symlink loops are detected and skipped. Special files (device files, sockets) are ignored. None of these crash the app.

*(See Story 6 for detailed ACs and test conditions.)*

---

## Data Contracts
<!-- Jira: Epic Description — Data Contracts section -->

The app persists a session state object containing: saved workspaces (each with an absolute path, directory-name label, and timestamp), the last active root path, a recent files list (capped at 20 entries, each with absolute path and last-opened timestamp), the selected theme identifier, and sidebar collapse state.

The file tree API accepts a root directory path and returns a tree of nodes. Each node has a name, absolute path, and type (file or directory). Directory nodes include children and a count of markdown descendants.

All API endpoints are local only (localhost). Request and response bodies are JSON. Session-mutating endpoints return the full updated session state so the frontend can reconcile without a separate load.

---

## Non-Functional Requirements
<!-- Jira: Epic Description — NFRs section -->

### Performance
- File tree populates within 2 seconds for directories with up to 500 markdown files
- Server starts and serves the first page within 3 seconds
- Theme switching is instantaneous
- Sidebar interactions are immediate

### Security
- Server binds to localhost only; no network-accessible endpoints
- File tree API only serves paths under the requested root (no path traversal)
- No remote network calls during normal operation

### Reliability
- Session persistence uses atomic writes to prevent corruption on crash
- Malformed session data results in clean reset, not crash

---

## Tech Design Questions
<!-- Jira: Epic Description — Tech Design Questions section -->

1. What is the session persistence format and location?
2. How does the folder picker work in a browser context? Must return absolute server-side paths. A server-side component is required.
3. How should the file tree scan handle very large directories?
4. What is the startup command?
5. How should clipboard operations work cross-browser?
6. What CSS architecture for themes?
7. Should the file tree scan be a single API call or on-demand per expand?

---

## Technical Considerations
<!-- Jira: Epic Description — Technical Considerations section -->

- The app is browser-first (Fastify + vanilla JS). An Electron prototype exists in `first-pass-poc/` but the production architecture serves a static frontend from a local Fastify server.
- Folder selection requires a server-side component because browser file APIs do not provide absolute paths. Multiple ACs depend on absolute paths (copy-path, tooltips, data contracts, workspace persistence).
- The file tree API never exposes paths outside the requested root. Symlinked files use their symlink path (inside the root), not the resolved target.
- The Cmd+O shortcut is deliberately not registered in this epic to avoid calling `preventDefault()` on a shortcut with no handler.

---

## Story Breakdown
<!-- Jira: Epic Description — Story Breakdown section -->

### Story 0: Foundation (Infrastructure)
Project scaffolding, shared types, server setup, and test framework. No user-facing ACs.
*(See story file Story 0 for full details.)*

### Story 1: App Shell Chrome
App shell with menu bar, dropdowns, empty tab strip, empty content area with launch state, and keyboard shortcut framework. Covers AC-1.1, AC-1.3, AC-1.4, AC-2.1 through AC-2.5.
*(See story file Story 1 for full details and test conditions.)*

### Story 2: Sidebar — Workspaces and Root Line
Workspace management (save, switch, remove) and root line actions (browse, pin, copy, refresh). Covers AC-3.1 through AC-3.4, AC-4.1 through AC-4.6, AC-8.5.
*(See story file Story 2 for full details and test conditions.)*

### Story 3: File Tree Browsing
Filtered markdown file tree with expand/collapse, expand all/collapse all, count badges, sorting, and all folder selection entry points. Covers AC-5.1 through AC-5.7, AC-9.1, AC-9.2.
*(See story file Story 3 for full details and test conditions.)*

### Story 4: Context Menus
Right-click context menus on file tree nodes. Covers AC-6.1 through AC-6.3.
*(See story file Story 4 for full details and test conditions.)*

### Story 5: Theme System
Four built-in themes with instant application and persistence. Covers AC-7.1 through AC-7.4, AC-8.4.
*(See story file Story 5 for full details and test conditions.)*

### Story 6: Session Persistence and Error Handling
Full session restore on launch and graceful filesystem error handling. Covers AC-1.2, AC-8.1 through AC-8.3, AC-10.1 through AC-10.3.
*(See story file Story 6 for full details and test conditions.)*

---

## Validation Checklist
<!-- Jira: Epic Description — Validation section -->

- [x] User Profile present with all fields
- [x] Feature Overview describes what ships
- [x] Scope boundaries explicit (in/out/assumptions)
- [x] All flows covered with grouped AC references
- [x] Story breakdown covers all ACs with correct ranges
- [x] Data contracts describe system boundary (no internal types)
- [x] No TypeScript or code blocks in this document
- [x] NFRs present
- [x] Tech design questions present
- [x] Every grouped AC references the correct story
- [x] Jira section markers present
