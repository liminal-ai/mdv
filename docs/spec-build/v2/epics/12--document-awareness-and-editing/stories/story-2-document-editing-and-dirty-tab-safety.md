# Story 2: Document Editing and Dirty-Tab Safety

---

### Summary
<!-- Jira: Summary field -->

The developer requests edits to the active document through chat, the Steward modifies the file on disk, and the viewer refreshes — clean tabs auto-refresh, dirty tabs trigger the existing conflict modal.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Reading and working on markdown documents in the viewer while using the chat panel to ask questions about the content, request edits, and iterate on specs.

**Objective:** The developer types "fix the table in section 3" and the Steward edits the document on disk via the script execution lane. The viewer refreshes to show the updated content. If the tab has unsaved edits, the existing conflict modal from Epic 5 appears. A `chat:file-created` notification provides fast-path viewer refresh, bypassing the file watcher's polling interval. Edit confirmation and error reporting appear in the chat.

**Scope:**

In scope:
- Extended script executor with async execution support (`vm.runInNewContext` + async IIFE wrapper + `Promise.race` timeout)
- `applyEditToActiveDocument(content: string)` — atomic write (temp + rename), triggers `chat:file-created`
- `getActiveDocumentContent()` — reads active document from disk
- `openDocument(path: string)` — opens file in viewer, path traversal safety
- Per-message script context construction with captured `activeDocumentPath`
- `chat:file-created` notification from script context `onFileCreated` callback
- Client file-created handler: triggers immediate document reload via extracted `handleExternalFileChange()` function
- Dirty-tab integration: clean tabs auto-refresh, dirty tabs show Epic 5 conflict modal (Keep My Changes / Reload from Disk / Save Copy)
- Edit failure error reporting in chat (`EDIT_FAILED` error code)
- Multiple edits within a single Steward response apply sequentially

Out of scope:
- Structured patch edits (deferred — full content replacement only)
- Creating new files or editing non-active files (Epic 13)
- Inline diff display (future)

**Dependencies:**
- Story 1 complete (context injection — the edit flow requires document content in the CLI prompt)
- Story 0 complete (schemas, types)
- Epic 5 complete (external-change conflict modal)
- Epic 10 complete (script execution lane, stream parser)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-2.1:** The developer can request edits to the active document through chat

- **TC-2.1a: Edit request modifies document on disk**
  - Given: A document is open in the active tab
  - When: The developer sends an edit request (e.g., "add a summary section at the top")
  - Then: The document file on disk is modified (verifiable by reading the file, independent of model response quality)

- **TC-2.1b: No document open — no edit applied**
  - Given: No tabs are open
  - When: The developer sends an edit request
  - Then: No file on disk is modified; the context sent to the CLI contains no active document (the CLI receives no document content to edit)

**AC-2.2:** Clean tabs auto-refresh after the Steward edits a document

- **TC-2.2a: Clean tab reloads automatically**
  - Given: The active tab has no unsaved edits (clean) and the Steward edits the document
  - When: The edit is applied to disk and `chat:file-created` is received
  - Then: The document in the viewer refreshes to show the updated content without the developer needing to manually refresh

- **TC-2.2b: Viewer shows rendered content, not raw diff**
  - Given: The Steward has edited the active document
  - When: The viewer refreshes
  - Then: The full rendered document is displayed (not a diff or patch view)

**AC-2.3:** Dirty tabs trigger the existing conflict modal when the Steward edits a document

- **TC-2.3a: Dirty tab shows conflict modal**
  - Given: The active tab has unsaved edits (dirty) and the Steward edits the same document
  - When: The edit is applied to disk and the file watcher detects the change
  - Then: The existing external-change conflict modal appears (Keep My Changes, Reload from Disk, Save Copy) — consistent with Epic 5 AC-6.1

- **TC-2.3b: Keep My Changes preserves local edits**
  - Given: The conflict modal is showing after a Steward edit
  - When: The developer clicks Keep My Changes
  - Then: The developer's unsaved edits are preserved; the Steward's changes are on disk but not loaded into the editor

- **TC-2.3c: Reload from Disk loads Steward's changes**
  - Given: The conflict modal is showing after a Steward edit
  - When: The developer clicks Reload from Disk
  - Then: The editor loads the Steward's version from disk; the developer's local edits are discarded

- **TC-2.3d: Save Copy preserves both versions**
  - Given: The conflict modal is showing after a Steward edit
  - When: The developer clicks Save Copy
  - Then: A Save As dialog opens. The developer saves their local edits to a different path. After saving, the editor reloads the Steward's version from disk. Both versions are preserved — consistent with Epic 5 TC-6.1d.

**AC-2.4:** An edit confirmation appears in the chat conversation

- **TC-2.4a: Successful edit emits file-created notification**
  - Given: The Steward has edited the active document
  - When: The edit is applied successfully
  - Then: A `chat:file-created` message is sent to the client with the edited file's path and the correlation message ID

- **TC-2.4b: Completed agent message exists after edit**
  - Given: The developer sent an edit request and the edit was applied
  - When: The Steward's response completes (`chat:done` received)
  - Then: A completed agent message (non-empty, `streaming: false`) is present in the conversation after the user's edit request

- **TC-2.4c: Edit failure reported in chat**
  - Given: The Steward attempts to edit a document but the write fails (e.g., permission denied)
  - When: The edit fails
  - Then: An error message appears in the chat indicating the edit could not be applied

**AC-2.5:** Multiple edits within a single Steward response apply sequentially

- **TC-2.5a: Sequential edits in one response**
  - Given: The developer sends "fix the heading and reformat the table"
  - When: The Steward applies two separate edits within a single response
  - Then: Both edits are applied to the document; the viewer refreshes after all edits in the response are complete

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### Extended Script Context

Per-message context construction — the active document path is captured from the `chat:send` context, not stored globally:

```typescript
function buildScriptContext(
  activeDocumentPath: string | null,
  workspaceRoot: string | null,
  onFileCreated: (path: string) => void,
  onOpenDocument: (path: string) => void,
  onNotification: (message: string) => void,
): ScriptContext;
```

Methods:
- `getActiveDocumentContent()` — `readFile(activeDocumentPath, 'utf-8')`, throws if no active document
- `applyEditToActiveDocument(content: string)` — atomic write (temp file + rename), calls `onFileCreated(path)`, throws if no active document
- `openDocument(path: string)` — resolves relative to workspace root, path traversal check (`resolved.startsWith(workspaceRoot)`), calls `onOpenDocument(resolved)`

#### Async Script Execution

```typescript
async executeAsync(
  script: string,
  context: ScriptContext,
  timeoutMs: number,
): Promise<ScriptResult>;
```

Wraps script in async IIFE: `(async () => { ${script} })()`. Uses `vm.runInNewContext` with synchronous timeout, then `Promise.race` with async timeout for the returned Promise.

#### File-Created Notification Flow

1. `applyEditToActiveDocument` calls `onFileCreated(path)` callback
2. Callback sends `chat:file-created` message over WebSocket
3. Client handler calls extracted `handleExternalFileChange(path)` function
4. `handleExternalFileChange` reuses the same dirty/clean/conflict logic as the file watcher: find tab by path, skip if save pending, show conflict modal if dirty, refresh if clean

#### Integration Point

The inline file-change handler in `app.ts` (lines ~1927-1946) must be extracted into a reusable `handleExternalFileChange(path)` function that both the file-watcher WS handler and the chat file-created handler can call.

*See the tech design document for full architecture, implementation targets, and test mapping.*

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Script executor supports async execution with timeout
- [ ] `applyEditToActiveDocument` writes atomically and emits `chat:file-created`
- [ ] `getActiveDocumentContent` reads active document from disk
- [ ] `openDocument` validates path within workspace root
- [ ] Client handles `chat:file-created` with immediate document reload
- [ ] Clean tabs auto-refresh; dirty tabs trigger conflict modal
- [ ] `handleExternalFileChange` extracted from `app.ts` for reuse
- [ ] Edit failure reports `EDIT_FAILED` error in chat
- [ ] `npm run build && npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes — 17 tests (8 script executor + 9 chat panel)
