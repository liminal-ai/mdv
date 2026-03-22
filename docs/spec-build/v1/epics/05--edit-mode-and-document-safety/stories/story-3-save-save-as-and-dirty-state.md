# Story 3: Save, Save As, and Dirty State

### Summary
<!-- Jira: Summary field -->

Save to disk, Save As to new path, dirty state tracking with tab and toolbar indicators, self-change detection, stale-write guard, and save error handling.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user is reviewing a rendered document and spots something to fix — a typo, a broken link, a section that needs updating. They want to make the edit in place without switching to a separate tool. They may be working alongside AI agents that are also modifying files on disk.
- **Mental Model:** "I see something wrong, I switch to edit mode, I fix it, I save. If something goes wrong — accidental close, external change — the app protects me."
- **Key Constraint:** Editing is secondary to viewing. The editor is for quick corrections and light authoring, not a full IDE replacement. Document safety (no lost work) is non-negotiable.

**Objective:** The user can save the current editor content to disk with Cmd+S. Save As (Cmd+Shift+S) prompts for a new path. Dirty state is tracked and visually indicated on the tab (dot indicator) and in the content toolbar. Self-originated file changes do not trigger conflicts. Stale writes are detected via the `expectedModifiedAt` concurrency token. Save errors preserve the user's edits.

**Scope — In:**
- Save (Cmd+S): writes content to the file's path via `PUT /api/file`
- Save from File menu
- Save when not dirty (no-op)
- Save from Render mode with dirty edits
- Self-change detection: file watcher ignores self-originated changes after save
- Stale-write guard: `expectedModifiedAt` comparison on save, 409 CONFLICT triggers conflict modal (see Story 5, AC-6.1)
- Save As (Cmd+Shift+S): opens save dialog via `POST /api/file/save-dialog`, writes to new path
- Save As cancel (no-op)
- Save As overwrite (OS confirmation)
- Save As to a path already open in another tab (clean tab: close it; dirty tab: prompt)
- Tab dirty dot indicator
- Content toolbar dirty indicator (Edit and Render modes)
- Per-tab independent dirty tracking
- Save error handling: permission denied, disk full, path no longer valid

**Scope — Out:**
- Unsaved changes protection on close/quit (Story 4)
- Conflict modal UI and resolution flow (Story 5 — this story detects stale writes and triggers the conflict modal, but the modal itself is Story 5)
- File menu Save/Save As items (Story 6)

**Dependencies:** Story 2

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-3.1:** Save writes content to disk and clears dirty state

- **TC-3.1a: Basic save**
  - Given: A document has unsaved edits
  - When: User presses Cmd+S
  - Then: The current editor content is written to the file's path on disk. The dirty indicator clears. The tab's modifiedAt timestamp updates.
- **TC-3.1b: Save from File menu**
  - Given: A document has unsaved edits
  - When: User selects File > Save
  - Then: Same behavior as Cmd+S
- **TC-3.1c: Save when not dirty**
  - Given: A document has no unsaved changes
  - When: User presses Cmd+S
  - Then: No write occurs; no error. The operation is a no-op.
- **TC-3.1e: Stale write detected at save time**
  - Given: A file was loaded with modifiedAt "2026-03-20T10:00:00Z". An external process modified the file (new mtime "2026-03-20T10:05:00Z") but the conflict modal has not yet appeared (race condition).
  - When: User presses Cmd+S
  - Then: The server detects the mtime mismatch and returns 409 CONFLICT. The client shows the conflict modal (see Story 5, AC-6.1). The user's edits are not lost and the file is not overwritten.
- **TC-3.1f: Save from Render mode with dirty edits**
  - Given: A document has unsaved edits but the user is currently in Render mode
  - When: User presses Cmd+S
  - Then: The file is saved with the current editor content. The dirty indicator clears. The user remains in Render mode. The rendered view and warnings do not change (the content was already rendered from the unsaved edits per Story 1, AC-1.1).
- **TC-3.1d: Save does not trigger self-conflict**
  - Given: User saves a file
  - When: The file watcher detects the change on disk
  - Then: The watcher recognizes the change was self-originated and does not trigger a conflict modal or reload. The tab state remains unchanged.

**AC-3.2:** Save As prompts for a new path and updates the tab

- **TC-3.2a: Save As dialog**
  - Given: A document is in Edit mode
  - When: User presses Cmd+Shift+S (or File > Save As)
  - Then: A save dialog opens with the current filename and directory as defaults
- **TC-3.2b: Save As to new path**
  - Given: User selects a new path in the Save As dialog
  - When: User confirms
  - Then: The content is written to the new path. The tab updates to point to the new file (path, filename, title). The dirty indicator clears. The file watcher switches to watching the new path.
- **TC-3.2c: Save As cancel**
  - Given: The Save As dialog is open
  - When: User cancels
  - Then: No file is written; the tab remains unchanged; dirty state is preserved
- **TC-3.2d: Save As overwrite**
  - Given: User selects a path that already exists in the Save As dialog
  - When: User confirms
  - Then: The OS save dialog prompts for overwrite confirmation. If confirmed, the file is replaced.
- **TC-3.2e: Save As to a path already open in another tab**
  - Given: Tab A is open for `spec.md` (clean). Tab B is editing `notes.md`.
  - When: User Save-As's Tab B to `spec.md` (overwriting)
  - Then: Tab A is closed (it was clean, so no prompt). Tab B updates to point to `spec.md`. This maintains Epic 2's one-tab-per-file invariant.
- **TC-3.2f: Save As to a path open in a dirty tab**
  - Given: Tab A is open for `spec.md` with unsaved edits. Tab B is editing `notes.md`.
  - When: User Save-As's Tab B to `spec.md`
  - Then: The unsaved-changes modal appears for Tab A (Save and Close, Discard Changes, Cancel). If the user saves or discards Tab A, Tab A is closed and Tab B's Save As proceeds. If the user cancels, the Save As is aborted.

**AC-3.3:** Save failures produce clear errors

- **TC-3.3a: Permission denied on save**
  - Given: The file or directory has become read-only since the file was opened
  - When: User presses Cmd+S
  - Then: An error message indicates the file could not be saved due to permissions. The dirty state is preserved. The user's edits are not lost.
- **TC-3.3b: Disk full on save**
  - Given: The target disk has insufficient space
  - When: User presses Cmd+S
  - Then: An error message indicates insufficient disk space. The dirty state is preserved.
- **TC-3.3c: File path no longer valid**
  - Given: The parent directory was deleted since the file was opened
  - When: User presses Cmd+S
  - Then: An error message indicates the path is no longer valid. The user can use Save As to choose a new location.

**AC-4.1:** Dirty indicator appears on the tab when content has unsaved changes

- **TC-4.1a: Tab dot indicator**
  - Given: A document has unsaved edits
  - When: User views the tab strip
  - Then: The tab shows a dot indicator (e.g., a filled circle before or after the filename) distinguishing it from clean tabs
- **TC-4.1b: Dot clears on save**
  - Given: A tab shows the dirty dot
  - When: User saves the file
  - Then: The dot disappears
- **TC-4.1c: Dot appears on first edit**
  - Given: A clean document is in Edit mode
  - When: User types a single character
  - Then: The dirty dot appears immediately

**AC-4.2:** Content toolbar shows dirty indicator during edit mode

- **TC-4.2a: Toolbar dirty indicator**
  - Given: A document has unsaved edits and is in Edit mode
  - When: User views the content toolbar
  - Then: A dirty indicator is visible (e.g., "Modified" label or dot) near the mode toggle or status area
- **TC-4.2b: Toolbar indicator in Render mode**
  - Given: A document has unsaved edits and is switched to Render mode
  - When: User views the content toolbar
  - Then: The dirty indicator remains visible — the document is still unsaved regardless of which mode is active

**AC-4.3:** Dirty state is tracked per tab independently

- **TC-4.3a: Independent dirty tracking**
  - Given: Tab A has unsaved edits, Tab B is clean
  - When: User switches between tabs
  - Then: Tab A shows the dirty dot; Tab B does not. Each tab's dirty state is independent.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

File Save API (implemented in this story):

```typescript
interface FileSaveRequest {
  path: string;              // absolute path to write to
  content: string;           // markdown content to write
  expectedModifiedAt?: string | null; // ISO 8601 UTC — the modifiedAt timestamp the client last loaded.
                              // Server compares against current file mtime before writing.
                              // If they don't match, the file changed since the client loaded it
                              // and the server returns 409 CONFLICT instead of writing.
                              // For Save As to a new path (file doesn't exist yet), this field
                              // is omitted or null.
}

interface FileSaveResponse {
  path: string;           // the path that was written
  modifiedAt: string;     // ISO 8601 UTC, new modification time after write
  size: number;           // new file size in bytes
}
```

Endpoints implemented in this story:

| Method | Path | Request | Success Response | Error |
|--------|------|---------|-----------------|-------|
| PUT | /api/file | `FileSaveRequest` | `FileSaveResponse` | 400, 403, 404, 409, 500, 507 |
| POST | /api/file/save-dialog | `{ defaultPath: string, defaultFilename: string }` | `{ path: string } \| null` | 500 |

The save endpoint (`PUT /api/file`) validates that:
- The path is absolute
- The path has a recognized markdown extension (`.md` or `.markdown`)
- The parent directory exists

Save uses atomic writes (temp file + rename) to prevent corruption.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `PUT /api/file` writes content atomically and returns `FileSaveResponse`
- [ ] `PUT /api/file` validates path (absolute, markdown extension, parent exists)
- [ ] `PUT /api/file` compares `expectedModifiedAt` and returns 409 on mismatch
- [ ] `POST /api/file/save-dialog` opens save dialog and returns selected path or null
- [ ] Cmd+S saves; no-op when clean
- [ ] Save from Render mode with dirty edits works
- [ ] Self-originated file changes do not trigger conflict modal
- [ ] Save As prompts for path, writes, updates tab, clears dirty
- [ ] Save As to an already-open path enforces one-tab-per-file invariant
- [ ] Tab dirty dot indicator appears on first edit, clears on save
- [ ] Toolbar dirty indicator visible in both Edit and Render modes
- [ ] Dirty state tracked independently per tab
- [ ] Save errors show clear messages and preserve edits
- [ ] All 21 TCs pass
- [ ] No regressions in existing Epics 1–4 functionality
