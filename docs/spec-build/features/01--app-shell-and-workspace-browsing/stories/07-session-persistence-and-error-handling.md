# Story 6: Session Persistence and Error Handling

## Summary
<!-- Jira: Summary field -->
Full session state survives app restart. Filesystem errors produce clear feedback without crashes.

## Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user who expects tool state to survive restarts and filesystem errors to produce clear feedback.

**Objective:** Deliver reliable session persistence (workspaces, root, recent files restored on launch) and graceful error handling for filesystem edge cases (permission denied, missing directories, symlink loops, special files, corrupted session data).

**Scope:**
- In: Session restore on launch (workspaces, root, recent files), corrupted session recovery, root path validation on restore, recent files UI with missing-file handling, permission denied errors, missing root errors, symlink loops, special files, atomic session writes
- Out: File opening behavior (Epic 2 — recent files list is rendered but populated by Epic 2)

**Dependencies:** Stories 2, 3, 5 (need workspace, root, tree, and theme state to exist before testing persistence)

**Cross-story persistence coverage:** Theme persistence (AC-8.4) is owned and verified by Story 5 (TC-7.3a). Sidebar collapse state persistence (AC-8.5) is owned and verified by Story 2 (TC-3.1c). This story depends on those stories having implemented persistence for those concerns — it does not re-test them.

## Acceptance Criteria
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

## Technical Design
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

## Definition of Done
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
