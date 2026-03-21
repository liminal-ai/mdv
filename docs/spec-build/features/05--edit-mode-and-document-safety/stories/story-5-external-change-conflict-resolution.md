# Story 5: External Change Conflict Resolution

### Summary
<!-- Jira: Summary field -->

Conflict modal when external file changes occur during editing, with Keep My Changes, Reload from Disk, and Save Copy options. File deletion while editing handled. Clean-tab auto-reload unchanged.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user is reviewing a rendered document and spots something to fix — a typo, a broken link, a section that needs updating. They want to make the edit in place without switching to a separate tool. They may be working alongside AI agents that are also modifying files on disk.
- **Mental Model:** "I see something wrong, I switch to edit mode, I fix it, I save. If something goes wrong — accidental close, external change — the app protects me."
- **Key Constraint:** Editing is secondary to viewing. The editor is for quick corrections and light authoring, not a full IDE replacement. Document safety (no lost work) is non-negotiable.

**Objective:** When a file changes on disk while the user has unsaved edits, a conflict modal appears with three options: Keep My Changes, Reload from Disk, Save Copy. Without edits, external changes auto-reload silently (Epic 2 behavior unchanged). File deletion while editing retains edits and allows Save As.

**Scope — In:**
- Conflict modal: appears when file is modified externally while tab is dirty
- Keep My Changes: dismiss modal, retain local edits, continue watching
- Reload from Disk: replace editor content with on-disk version, clear dirty
- Save Copy: open Save As dialog, save local edits to new path, reload original from disk
- Save Copy cancel: return to conflict modal, edits preserved
- Save Copy failure: show error, return to conflict modal, no content lost
- Conflict while in Render mode: modal still appears (edits exist regardless of view mode)
- No-conflict auto-reload for clean tabs (Epic 2 behavior unchanged)
- File deletion while editing: notification, retain edits, Save/Save As available

**Scope — Out:**
- Stale-write detection at save time (Story 3, AC-3.1 — detects mtime mismatch and triggers the conflict modal from this story)
- Self-change detection (Story 3, AC-3.1)

**Dependencies:** Story 3 (needs dirty state tracking and save mechanism)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-6.1:** External file change with unsaved edits triggers a conflict modal

- **TC-6.1a: Conflict modal appears**
  - Given: A file is open in Edit mode with unsaved changes
  - When: The file is modified on disk by an external process
  - Then: A conflict modal appears with the message: "[filename] has been modified externally." Options: Keep My Changes, Reload from Disk, Save Copy.
- **TC-6.1b: Keep My Changes**
  - Given: The conflict modal is open
  - When: User clicks Keep My Changes
  - Then: The modal closes. The editor retains the user's local edits. The file watcher continues to watch the file. The dirty state remains. The on-disk version is not loaded.
- **TC-6.1c: Reload from Disk**
  - Given: The conflict modal is open
  - When: User clicks Reload from Disk
  - Then: The modal closes. The editor content is replaced with the current on-disk version. The dirty indicator clears. The user's local edits are lost.
- **TC-6.1d: Save Copy**
  - Given: The conflict modal is open
  - When: User clicks Save Copy
  - Then: A Save As dialog opens. The user saves their local edits to a different path. After saving, the editor reloads the original file from disk. The user now has both versions: their edits at the copy path, and the external changes at the original path.
- **TC-6.1e: Save Copy — user cancels the dialog**
  - Given: The conflict modal is open and user clicks Save Copy
  - When: The Save As dialog opens and user cancels it
  - Then: The user returns to the conflict modal. No file is written. The user's edits are preserved. They can choose a different option.
- **TC-6.1f: Save Copy — save fails**
  - Given: The conflict modal is open and user clicks Save Copy
  - When: The user selects a path but the write fails (permission denied, disk full)
  - Then: An error is shown. The user returns to the conflict modal. No content is lost. They can retry Save Copy or choose a different option.
- **TC-6.1g: Conflict while in Render mode**
  - Given: A document has unsaved edits but the user is currently in Render mode
  - When: The file is modified on disk
  - Then: The conflict modal still appears (the user has unsaved edits regardless of which mode they're viewing)

**AC-6.2:** External file change without edits auto-reloads silently

- **TC-6.2a: No-conflict reload**
  - Given: A file is open with no unsaved changes (clean)
  - When: The file is modified on disk
  - Then: The tab auto-reloads with the new content (Epic 2 behavior unchanged). No modal appears.

**AC-6.3:** External file deletion with unsaved edits

- **TC-6.3a: File deleted while editing**
  - Given: A file is open in Edit mode with unsaved changes
  - When: The file is deleted on disk
  - Then: A notification indicates the file was deleted. The editor retains the user's edits. The user can use Save As to save to a new location, or Save to recreate the file at the original path.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

This story builds on Epic 2's `FileChangeEvent` and file watching infrastructure. The conflict behavior is client-side logic: if the tab is dirty when a `modified` event arrives, show the conflict modal instead of auto-reloading.

```typescript
interface FileChangeEvent {
  path: string;
  event: "modified" | "deleted" | "created";
}
```

The conflict modal is a new UI component with three buttons: Keep My Changes, Reload from Disk, Save Copy. Save Copy reuses the `POST /api/file/save-dialog` endpoint from Story 3.

No new server-side endpoints. The client-side logic intercepts file change events and routes to the appropriate behavior based on dirty state.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] External file modification while tab is dirty shows conflict modal
- [ ] Keep My Changes retains local edits and dismisses modal
- [ ] Reload from Disk replaces editor content with on-disk version, clears dirty
- [ ] Save Copy opens Save As, saves local edits to new path, then reloads original
- [ ] Save Copy cancel returns to conflict modal with edits preserved
- [ ] Save Copy failure shows error and returns to conflict modal
- [ ] Conflict modal appears even when in Render mode with dirty edits
- [ ] Clean-tab external change auto-reloads silently (Epic 2 behavior unchanged)
- [ ] File deletion while editing retains edits with Save/Save As available
- [ ] All 9 TCs pass
- [ ] No regressions in existing Epics 1–4 functionality
