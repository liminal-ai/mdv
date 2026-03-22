# Story 1: File Read API and Basic Document Opening

### Summary
<!-- Jira: Summary field -->

File read API, document opening from tree/menu/keyboard/recent files, loading state, duplicate tab detection, and file operation error handling.

### Description
<!-- Jira: Description field -->

**User Profile:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts. Browsing and reading markdown files across local workspaces.

**Objective:** A user can click a file in the tree, select File > Open, use a keyboard shortcut, or click a recent file — and see the file's content loaded into a new tab. Duplicate opens reuse the existing tab. Loading indicators show during fetch. Errors are surfaced clearly.

**Scope — In:**
- GET /api/file endpoint (full implementation)
- POST /api/file/pick endpoint (full implementation)
- POST and DELETE /api/session/recent-files endpoints (full implementation)
- Client-side file open flow from tree click, File menu, keyboard shortcut, recent file click
- Loading indicator during fetch
- Duplicate tab detection using canonical path
- Recent files tracking (add, update timestamp, 20-entry cap, remove missing)
- Error handling for file read failures and server errors

**Scope — Out:**
- Markdown rendering (content displays as raw text until Story 2)
- Content toolbar appearance (Story 5 — TC-1.1b)
- Menu bar file path display (Story 5 — TC-1.1c)
- Tab management beyond basic open (Story 4)

**Dependencies:** Story 0, Epic 1 complete

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1:** Clicking a file in the sidebar tree opens it in a new tab with rendered content

- **TC-1.1a: Basic file open from tree**
  - Given: App is running with a root set and file tree visible
  - When: User clicks a `.md` file in the tree
  - Then: A new tab appears with the filename, content area shows rendered markdown

*Note: In this story, content displays as raw text (rendering is Story 2). This TC exercises the content-loading and tab-creation portion; rendered output is verified in Story 2. TC-1.1b (toolbar appearance) and TC-1.1c (menu bar status) are exercised in Story 5.*

**AC-1.2:** A loading indicator is shown while the file is being fetched

- **TC-1.2a: Loading state**
  - Given: User clicks a file to open
  - When: The file read request is in flight
  - Then: The new tab shows a loading indicator (spinner or text) until content renders
- **TC-1.2b: Loading indicator clears on render**
  - Given: File content has been fetched and rendered
  - When: Rendering completes
  - Then: The loading indicator is replaced by the rendered content

*Note: In this story, "renders" means content is loaded and displayed (raw text). Full markdown rendering is Story 2.*

**AC-1.3:** Opening the same file twice reuses the existing tab

- **TC-1.3a: Duplicate file open**
  - Given: A file is already open in a tab
  - When: User clicks the same file in the tree
  - Then: The existing tab is activated; no new tab is created
- **TC-1.3b: Duplicate detection uses resolved path**
  - Given: The same file could be reached via different relative paths or symlinks
  - When: User opens a file that resolves to the same underlying file as an open tab
  - Then: The existing tab is activated. Duplicate detection uses the server-resolved canonical path internally, but the tab continues to display the path the user originally opened it from.

**AC-1.4:** Files outside the current root can be opened and viewed normally

- **TC-1.4a: Open file outside root via File > Open**
  - Given: Root is set to /Users/leemoore/code/project-a
  - When: User opens a file at /Users/leemoore/code/project-b/notes.md via File > Open
  - Then: The file opens in a new tab with rendered content. The root does not change. The sidebar tree still shows project-a's files.
- **TC-1.4b: Relative link traverses outside root**
  - Given: A document inside the root links to `../../other-repo/docs/spec.md`
  - When: User clicks the link
  - Then: The linked file opens in a new tab. The root does not change.

*Note: TC-1.4b exercises the open-file path; the link click itself is Story 6.*

**AC-1.5:** Files can be opened via File menu and keyboard shortcut

- **TC-1.5a: File > Open triggers a file picker**
  - Given: App is running
  - When: User selects File > Open or presses the keyboard shortcut
  - Then: A file picker dialog opens, filtered to markdown files (`.md`, `.markdown`)
- **TC-1.5b: Selecting a file from the picker opens it**
  - Given: File picker is open
  - When: User selects a markdown file
  - Then: File opens in a new tab with rendered content
- **TC-1.5c: Cancelling the picker does nothing**
  - Given: File picker is open
  - When: User cancels
  - Then: No tab is opened, app state is unchanged

**AC-1.6:** Opening a file adds it to the recent files list

- **TC-1.6a: Recent file tracking**
  - Given: User opens a file
  - When: File rendering completes
  - Then: The file's path and timestamp are added to the recent files list
- **TC-1.6b: Duplicate recent file updates timestamp**
  - Given: A file is already in the recent files list
  - When: User opens the same file again
  - Then: The existing entry's timestamp is updated; no duplicate entry is created
- **TC-1.6c: Recent files cap**
  - Given: Recent files list has 20 entries
  - When: User opens a 21st unique file
  - Then: The oldest entry is dropped; list stays at 20

**AC-1.7:** Clicking a recent file in the empty state opens it

- **TC-1.7a: Recent file click**
  - Given: App is in empty state with recent files displayed
  - When: User clicks a recent file entry
  - Then: The file opens in a new tab with rendered content
- **TC-1.7b: Missing recent file**
  - Given: A recent file entry points to a file that no longer exists
  - When: User clicks it
  - Then: An error message is shown; the entry is removed from the recent files list

**AC-9.1:** File read failure produces a visible error

- **TC-9.1a: Permission denied**
  - Given: User clicks a file in the tree that they don't have read permission on
  - When: Client requests the file content
  - Then: An error is shown in the content area or as a toast; no empty tab lingers
- **TC-9.1b: File disappeared between tree load and click**
  - Given: A file was visible in the tree
  - When: User clicks it but the file has been deleted since the tree was last scanned
  - Then: An error is shown; the tree refreshes to remove the stale entry

**AC-9.3:** Server errors during file operations produce user-visible feedback

- **TC-9.3a: Server unreachable**
  - Given: The server process crashes or becomes unresponsive
  - When: Client attempts to open a file
  - Then: A clear error indicates the server connection was lost
- **TC-9.3b: File read timeout**
  - Given: A file read takes unusually long (e.g., network-mounted filesystem)
  - When: A reasonable timeout elapses
  - Then: The request fails with a visible timeout error rather than hanging indefinitely

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

```typescript
interface FileReadRequest {
  path: string;       // absolute path to the markdown file
}

interface FileReadResponse {
  path: string;           // the requested path
  canonicalPath: string;  // resolved absolute path (duplicate detection only)
  filename: string;       // basename (e.g., "architecture.md")
  content: string;        // raw markdown text
  modifiedAt: string;     // ISO 8601 UTC
  size: number;           // file size in bytes
}

interface FilePickerResponse {
  path: string;
} | null

// Error responses: 400/INVALID_PATH, 403/PERMISSION_DENIED,
// 404/FILE_NOT_FOUND, 415/NOT_MARKDOWN, 500/READ_ERROR
```

Endpoints implemented in this story:

| Method | Path | Request | Success Response |
|--------|------|---------|-----------------|
| GET | /api/file | `?path={absolute_path}` | `FileReadResponse` |
| POST | /api/file/pick | — | `FilePickerResponse` |
| POST | /api/session/recent-files | `{ path: string }` | `SessionState` |
| DELETE | /api/session/recent-files | `{ path: string }` | `SessionState` |

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] GET /api/file returns correct FileReadResponse for valid paths
- [ ] GET /api/file returns appropriate error codes for invalid/missing/non-markdown paths
- [ ] POST /api/file/pick opens a file picker filtered to markdown
- [ ] Recent files POST/DELETE endpoints work with 20-entry cap and deduplication
- [ ] Tree click, File > Open, keyboard shortcut, and recent file click all open files
- [ ] Loading indicator shows during fetch and clears on load
- [ ] Duplicate tab detection works using canonical path
- [ ] Files outside root open without changing the root
- [ ] All error scenarios produce visible user feedback
- [ ] All 19 TCs pass
