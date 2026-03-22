# Story 2: File Tree and Startup Performance

### Summary
<!-- Jira: Summary field -->

File trees with 1,000+ files load and interact smoothly via virtual scrolling. Filesystem edge cases (permissions, symlinks, timeouts, deep nesting) are handled gracefully. App startup is within target.

### Description
<!-- Jira: Description field -->

**Primary User:** Technical agentic user working with large project directories containing hundreds or thousands of markdown files.
**Context:** The current file tree renders every node as a DOM element. At 1,000+ nodes, the DOM becomes the performance bottleneck — not the tree scan. The existing tree scan already has symlink loop detection via `realpath()` visited set; this story adds timeout and depth guard.

**Objective:** Virtual scrolling for the file tree (only visible rows in the DOM), tree scan timeout, and graceful handling of filesystem edge cases.

**Scope:**

In scope:
- Virtual scrolling for file tree (custom implementation — only visible rows rendered)
- Tree scan timeout (AbortController, 10s default)
- Depth guard (100 levels max)
- Permission error handling (unreadable files appear in tree, unreadable dirs skipped)
- Broken symlink handling (excluded silently)
- Network filesystem timeout handling (retry prompt)
- `MAX_FILE_SIZE` raised from 5MB to 20MB in `file.service.ts`
- Browser app startup within 3 seconds

Out of scope:
- Lazy tree loading (virtual scrolling addresses the DOM bottleneck)
- Electron startup (Story 5)

**Dependencies:** Story 0 complete.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-2.1:** File trees with 1,000+ markdown files load without freezing the UI

- **TC-2.1a: Large tree initial load**
  - Given: A root directory contains 1,500 markdown files across 200 directories, some nested 10+ levels deep
  - When: User sets this as the root
  - Then: The file tree populates within 5 seconds. A loading indicator appears during the scan. The UI remains responsive during loading.

- **TC-2.1b: Expand All on large tree**
  - Given: A tree with 1,000+ markdown files
  - When: User clicks Expand All
  - Then: The tree fully expands without freezing the UI. The expansion may be progressive rather than all-at-once.

- **TC-2.1c: Scroll performance in expanded tree**
  - Given: A large tree is fully expanded, showing 1,000+ visible nodes
  - When: User scrolls through the tree
  - Then: Scrolling does not freeze the UI — the tree responds to scroll input continuously without multi-second hangs

**AC-2.2:** File tree markdown count calculation does not block the UI

- **TC-2.2a: Count badges on large tree**
  - Given: A root with 200 directories, each requiring recursive markdown count
  - When: Tree loads
  - Then: Count badges appear. If counts take time, directories appear first and counts fill in asynchronously.

**AC-4.1:** App is ready to use within 3 seconds of launch (browser portion)

- **TC-4.1a: Browser app startup**
  - Given: User runs the start command
  - When: The server starts and the browser page loads
  - Then: The app shell is visible and interactive within 3 seconds. Session state (workspaces, root, theme) is restored.

**AC-5.1:** Permission-denied paths are handled gracefully

- **TC-5.1a: Unreadable file in tree**
  - Given: A root directory contains a `.md` file the user cannot read
  - When: File tree scans the directory
  - Then: The file appears in the tree (it has a `.md` extension). When clicked, an error is shown (consistent with Epic 2 AC-9.1a). The tree scan is not interrupted.

- **TC-5.1b: Unreadable subdirectory**
  - Given: A root directory contains a subdirectory the user cannot read
  - When: File tree scans the directory
  - Then: The subdirectory is skipped silently (its markdown count is 0). Other directories scan normally. No error toast for directory-level permission issues during tree scan — these are expected in shared filesystems.

**AC-5.2:** Symlink edge cases are handled without crashing

- **TC-5.2a: Symlink loop**
  - Given: A directory contains a symlink that creates a loop (e.g., `a/b/c → a`)
  - When: File tree scans the directory
  - Then: The loop is detected and the symlink is skipped. The rest of the tree renders normally. No hang, no crash, no infinite recursion.

- **TC-5.2b: Broken symlink**
  - Given: A directory contains a symlink pointing to a nonexistent target
  - When: File tree scans the directory
  - Then: The broken symlink is excluded from the tree. No error — broken symlinks are common.

- **TC-5.2c: Symlink to file outside root**
  - Given: A symlink inside the root points to a `.md` file outside the root
  - When: File tree scans the directory
  - Then: The symlinked file appears in the tree with the symlink's path (inside the root), consistent with Epic 1 TC-5.1h. The tree never exposes paths outside the root.

**AC-5.3:** Network-mounted and slow filesystems do not hang the app

- **TC-5.3a: Slow tree scan**
  - Given: The root is on a network-mounted filesystem with high latency
  - When: User sets the root
  - Then: A loading indicator appears. The scan completes (possibly slowly) without freezing the UI. If the scan takes more than 10 seconds, a timeout message is shown with an option to retry.

- **TC-5.3b: Slow file read**
  - Given: A file is on a network-mounted filesystem
  - When: User opens the file
  - Then: The loading indicator appears. If the read takes more than 10 seconds, a timeout error is shown. The app remains responsive during the wait.

- **TC-5.3c: Filesystem disconnects mid-operation**
  - Given: A network filesystem disconnects while a file is being read or a tree is being scanned
  - When: The operation fails
  - Then: An error is shown. The app does not crash or hang. The user can switch to a different root or retry.

**AC-5.4:** Extremely deep directory nesting is handled

- **TC-5.4a: Deep nesting**
  - Given: A directory structure is nested 50+ levels deep with markdown files at the bottom
  - When: File tree scans the directory
  - Then: The tree renders correctly. Performance may degrade at extreme depths but the app does not crash or exceed call stack limits.

**AC-13.1:** Performance-related errors produce visible feedback

- **TC-13.1a: File too large to render**
  - Given: A markdown file is exceptionally large (e.g., 50,000+ lines or 10MB+)
  - When: User opens the file
  - Then: The file opens with a loading indicator. Rendering completes (possibly slowly). The app does not crash or freeze permanently. No warning is required — the file renders as any other document.

- **TC-13.1b: Tree scan timeout**
  - Given: A root directory is extremely large or on a very slow filesystem
  - When: The tree scan exceeds a reasonable timeout
  - Then: A partial tree is shown (what was scanned so far) with an indicator that the scan was incomplete. The user can retry.
  - Note: Tech design deviates — the server's scan-and-abort approach does not produce partial results. Implementation uses a retry prompt (500 SCAN_ERROR with `timeout: true`) instead of a partial tree. See tech-design.md spec validation table.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**New module:** `client/components/virtual-tree.ts` — virtual scroller rendering only visible tree rows. Fixed row height (28px), overscan of 20 rows. Replaces DOM rendering in `file-tree.ts`.

**Modified modules:**
- `server/services/tree.service.ts` — add AbortController timeout (10s), depth guard (100 levels). Symlink loop detection and broken symlink handling already exist.
- `server/services/file.service.ts` — raise `MAX_FILE_SIZE` from 5MB to 20MB.
- `client/components/file-tree.ts` — integrate virtual-tree, replace full DOM rendering.

**Tree scan timeout uses existing error code:**

```typescript
// 500 SCAN_ERROR with timeout flag — no new HTTP status codes
{ error: { code: 'SCAN_ERROR', message: '...', timeout: true } }
```

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `npm run verify` passes
- [ ] Virtual tree renders only visible rows (~70 DOM elements for 1,500 node tree)
- [ ] Expand All is instantaneous regardless of tree size
- [ ] Tree scan timeout fires after 10s with retry prompt
- [ ] Symlink loops, broken symlinks, and permission errors handled gracefully
- [ ] Deep nesting (50+ levels) does not crash
- [ ] `MAX_FILE_SIZE` raised to 20MB
- [ ] Browser app startup within 3 seconds
