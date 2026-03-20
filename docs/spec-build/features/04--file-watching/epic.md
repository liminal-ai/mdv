# Epic 4: File Watching and Auto-Reload

This epic defines the complete requirements for detecting file changes on disk
and auto-reloading open documents. It serves as the source of truth for the
Tech Lead's design work.

---

## User Profile

**Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
**Context:** Working alongside agents that generate or modify markdown files. The viewer has documents open while an agent rewrites them. The user expects the viewer to reflect the latest content without manual intervention.
**Mental Model:** "Agents update my files, the viewer shows the latest version. I don't have to click refresh."
**Key Constraint:** No editing in this epic — the on-disk version is always authoritative. No conflict resolution needed. File watching uses server-side filesystem events, not polling.

---

## Feature Overview

This feature adds live file watching to open documents. When a file changes on
disk (common when agents regenerate markdown), the tab auto-reloads to show
current content. File deletion is detected and clearly indicated. The scroll
position is preserved across reloads when possible. Watching is efficient enough
to handle 20+ open files without degrading the UI.

Combined with Epics 1-3, this completes the full read-only viewing experience.

---

## Scope

### In Scope

File watching and auto-reload for open documents:

- Server-side filesystem watch on each open file
- Push notifications to client when files change (SSE or WebSocket — tech design decides)
- Auto-reload: re-fetch and re-render when a watched file changes
- Debounced reload for rapid successive changes
- Scroll position preservation on auto-reload
- File deletion detection with clear UI indicator
- File restoration detection after deletion
- Watch lifecycle: establish on file open, release on tab close
- Performance: 20+ simultaneous watches without UI degradation

### Out of Scope

- Directory watching / tree auto-refresh (manual refresh in Epic 1 is sufficient)
- Conflict resolution (no editing — on-disk is authoritative)
- Polling-based watching
- Watching files that aren't open in a tab

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Epics 2 and 3 are complete: file reading, rendering, and multi-tab are in place | Unvalidated | Dev team | |
| A2 | File watching uses server-side filesystem events, not polling | Unvalidated | Tech Lead | Confirm mechanism in tech design |
| A3 | Push transport (SSE or WebSocket) is decided in tech design | Unvalidated | Tech Lead | SSE is sufficient for one-directional events; WebSocket may be needed for later editing epic |

---

## Flows & Requirements

### 1. Watch Lifecycle

When a document is opened, the server establishes a filesystem watch. When the
tab is closed, the watch is released. The client subscribes to change events
via a push channel.

#### Acceptance Criteria

**AC-1.1:** Open files are watched for changes on the server side

- **TC-1.1a: Watch established on file open**
  - Given: User opens a markdown file
  - When: File is loaded and displayed
  - Then: The server establishes a filesystem watch on that file
- **TC-1.1b: Watch released on tab close**
  - Given: A file is open and being watched
  - When: User closes the tab
  - Then: The filesystem watch is released

---

### 2. Auto-Reload

When a watched file changes on disk, the tab re-fetches and re-renders
automatically. Rapid changes are debounced so the UI doesn't thrash.

#### Acceptance Criteria

**AC-2.1:** When a watched file changes on disk, the tab auto-reloads

- **TC-2.1a: External file change**
  - Given: A file is open in a tab
  - When: The file is modified on disk by an external process
  - Then: The tab re-fetches the file content and re-renders; the update is visible
- **TC-2.1b: Debounced reload**
  - Given: A file is being rapidly modified (e.g., agent writing incrementally)
  - When: Multiple filesystem events fire in quick succession
  - Then: The reload is debounced; the tab updates once after changes settle (not on every event)
- **TC-2.1c: Scroll position on reload**
  - Given: User is scrolled partway through a document
  - When: File changes on disk and tab auto-reloads
  - Then: The scroll position is preserved. If the document length changed significantly, the view remains at approximately the same percentage through the document.

---

### 3. File Deletion and Restoration

If a watched file is deleted, the tab shows a clear indicator. If the file
reappears, the tab offers to reload.

#### Acceptance Criteria

**AC-3.1:** File deletion while tab is open shows a clear indicator

- **TC-3.1a: File deleted**
  - Given: A file is open in a tab
  - When: The file is deleted on disk
  - Then: The tab shows a clear "file not found" indicator; the content remains visible as last-known state
- **TC-3.1b: File restored after deletion**
  - Given: A tab is showing "file not found" state
  - When: The file is recreated at the same path
  - Then: The tab detects the new file and offers to reload

---

### 4. Performance

File watching must not degrade the user experience even with many open files.

#### Acceptance Criteria

**AC-4.1:** File watching does not interfere with app performance

- **TC-4.1a: Many watched files**
  - Given: 20 tabs are open, each watching a different file
  - When: User interacts with the app
  - Then: UI remains responsive; filesystem watches do not cause noticeable CPU or memory overhead

---

## Data Contracts

### File Watch Event

```typescript
interface FileChangeEvent {
  path: string;           // absolute path of the changed file
  event: "modified" | "deleted" | "created";
}
```

### API Surface (new endpoint for this epic)

| Method | Path | Request | Success Response | Error | Notes |
|--------|------|---------|-----------------|-------|-------|
| GET | /api/file/watch | `?path={absolute_path}` | SSE stream of `FileChangeEvent` | 400, 404 | Server-Sent Events stream for file changes; one stream per watched file, or multiplexed |

The file watch endpoint uses Server-Sent Events (SSE) or WebSocket — the tech
lead determines the transport. The contract is: the client receives push
notifications when watched files change, without polling.

---

## Dependencies

Technical dependencies:
- Epics 2 and 3 complete: file reading, rendering, multi-tab management
- Server-side file watching capability (confirmed in tech design)
- Push notification support in Fastify (SSE or WebSocket, confirmed in tech design)

Process dependencies:
- Epic 3 implementation complete before Epic 4 begins (needs multi-tab for watch lifecycle to make sense)

---

## Non-Functional Requirements

### Performance
- File watching adds no perceptible UI latency
- 20 simultaneous watches do not degrade app responsiveness
- Debounce window prevents UI thrashing during rapid file changes

### Reliability
- File watching recovers from transient filesystem errors without user intervention
- Watch is re-established if the underlying filesystem event mechanism hiccups

---

## Tech Design Questions

1. **Watch transport:** SSE vs WebSocket. SSE is simpler for one-directional push. WebSocket allows bidirectional, which may be needed for the editing epic. Build for now or build for later?
2. **Watch granularity:** One SSE stream per file, or one multiplexed stream for all watches? Multiplexed is more efficient but needs message routing.
3. **Debounce strategy:** Fixed window (e.g., 200ms)? Trailing edge? What interval balances responsiveness with stability?
4. **Scroll preservation strategy:** Pixel offset vs percentage position on reload when document length changes.
5. **Node fs.watch vs chokidar:** Native `fs.watch` per-file is simple and stable in Node 24. Chokidar adds cross-platform robustness and built-in debouncing. For per-file watching (not directory scanning), is native sufficient?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

- `FileChangeEvent` type definition (may already exist from Epic 2's contracts)
- SSE or WebSocket infrastructure setup
- Test fixtures: file modification/deletion/creation scenarios

### Story 1: Watch Lifecycle and Auto-Reload
**Delivers:** Open files are watched; changes trigger auto-reload with debounce; scroll position preserved.
**Prerequisite:** Story 0, Epic 3 complete
**ACs covered:**
- AC-1.1 (watch establish/release)
- AC-2.1 (auto-reload, debounce, scroll preservation)
- AC-4.1 (performance)

**Estimated test count:** 8-10 tests

### Story 2: Deletion and Restoration
**Delivers:** Deleted files show clear indicator; restored files offer to reload.
**Prerequisite:** Story 1
**ACs covered:**
- AC-3.1 (deletion indicator, restoration detection)

**Estimated test count:** 4-5 tests

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
- [x] Stories sequence logically
- [x] Dependencies on Epics 1-3 are explicit
- [x] No overlap with Epic 2 (rendering) or Epic 3 (tabs)
- [x] Self-review complete
