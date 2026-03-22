# Story 7: File Watching and Auto-Reload

### Summary
<!-- Jira: Summary field -->

Server-side file watching with auto-reload on external changes, debounced updates, scroll preservation, deletion handling, and performance at scale.

### Description
<!-- Jira: Description field -->

**User Profile:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts. Working with content that changes on disk (agent workflows that regenerate markdown).

**Objective:** Open documents are watched for filesystem changes. When a file changes externally, the tab auto-reloads. Rapid changes are debounced. Scroll position is preserved. Deleted files show a clear indicator with last-known content. File watching does not degrade UI performance.

**Scope — In:**
- Server-side filesystem watch established on file open
- Watch released on tab close
- Auto-reload when watched file is modified externally
- Debounced reload for rapid changes
- Scroll position preservation on reload
- File deletion indicator with last-known content preserved
- File restoration detection after deletion
- Performance with 20+ concurrent watches
- GET /api/file/watch endpoint (SSE stream)

**Scope — Out:**
- Conflict resolution (no editing in this epic — on-disk version is always authoritative)
- Polling-based watching (server uses filesystem events per A3)

**Dependencies:** Story 1 (file open flow, file content API), Story 2 (rendering pipeline — TC-7.2a requires re-rendering on reload)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-7.1:** Open files are watched for changes on the server side

- **TC-7.1a: Watch established on file open**
  - Given: User opens a markdown file
  - When: File is loaded and displayed
  - Then: The server establishes a filesystem watch on that file
- **TC-7.1b: Watch released on tab close**
  - Given: A file is open and being watched
  - When: User closes the tab
  - Then: The filesystem watch is released

**AC-7.2:** When a watched file changes on disk, the tab auto-reloads

- **TC-7.2a: External file change**
  - Given: A file is open in a tab
  - When: The file is modified on disk by an external process
  - Then: The tab re-fetches the file content and re-renders; the update is visible
- **TC-7.2b: Debounced reload**
  - Given: A file is being rapidly modified (e.g., agent writing incrementally)
  - When: Multiple filesystem events fire in quick succession
  - Then: The reload is debounced; the tab updates once after changes settle (not on every event)
- **TC-7.2c: Scroll position on reload**
  - Given: User is scrolled partway through a document
  - When: File changes on disk and tab auto-reloads
  - Then: The scroll position is preserved. If the document length changed, the view remains at approximately the same percentage through the document.

**AC-7.3:** File deletion while tab is open shows a clear indicator

- **TC-7.3a: File deleted**
  - Given: A file is open in a tab
  - When: The file is deleted on disk
  - Then: The tab shows a clear "file not found" indicator; the content remains visible as last-known state
- **TC-7.3b: File restored after deletion**
  - Given: A tab is showing "file not found" state
  - When: The file is recreated at the same path
  - Then: The tab detects the new file and offers to reload

**AC-7.4:** File watching does not interfere with app performance

- **TC-7.4a: Many watched files**
  - Given: 20 tabs are open, each watching a different file
  - When: User interacts with the app
  - Then: UI remains responsive; filesystem watches do not cause noticeable CPU or memory overhead

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

```typescript
interface FileChangeEvent {
  path: string;           // absolute path of the changed file
  event: "modified" | "deleted" | "created";
}
```

Endpoint implemented in this story:

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| GET | /api/file/watch | `?path={absolute_path}` | SSE stream of `FileChangeEvent` | One stream per file, or multiplexed |

Transport (SSE vs WebSocket) is determined in tech design (see epic Tech Design Question 3). SSE is simpler and sufficient for one-directional events. WebSocket allows bidirectional communication for later epics (editing).

The server uses filesystem events (not polling) per assumption A3. Debounce logic lives server-side or client-side — tech design decides.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Server establishes filesystem watch when file is opened
- [ ] Watch is released when tab is closed
- [ ] External file modification triggers visible auto-reload
- [ ] Rapid changes are debounced (single reload after changes settle)
- [ ] Scroll position preserved on auto-reload
- [ ] File deletion shows "file not found" with last-known content
- [ ] File restoration after deletion is detected
- [ ] 20 concurrent watches do not degrade UI performance
- [ ] GET /api/file/watch SSE endpoint functional
- [ ] All 8 TCs pass
