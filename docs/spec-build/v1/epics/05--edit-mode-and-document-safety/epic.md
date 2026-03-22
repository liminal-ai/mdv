# Epic 5: Edit Mode and Document Safety

This epic defines the complete requirements for edit mode, save behavior, dirty
state tracking, unsaved changes protection, and external change conflict
resolution. It serves as the source of truth for the Tech Lead's design work.

---

## User Profile

**Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
**Context:** The user is reviewing a rendered document and spots something to fix — a typo, a broken link, a section that needs updating. They want to make the edit in place without switching to a separate tool. They may be working alongside AI agents that are also modifying files on disk.
**Mental Model:** "I see something wrong, I switch to edit mode, I fix it, I save. If something goes wrong — accidental close, external change — the app protects me."
**Key Constraint:** Editing is secondary to viewing. The editor is for quick corrections and light authoring, not a full IDE replacement. Document safety (no lost work) is non-negotiable.

---

## Feature Overview

After this feature ships, the user can switch any open document to Edit mode and
see the raw markdown with syntax highlighting. They can type, edit, and save.
The app tracks unsaved changes with visible dirty indicators and protects
against accidental data loss — prompting on close and quit when edits are
unsaved. When an external process modifies a file the user is editing, a
conflict modal offers clear choices: keep local edits, reload from disk, or
save a copy.

Combined with Epics 1–4, this completes Milestone 4: a viewer with light
editing capability.

---

## Scope

### In Scope

Edit mode and document safety, activating the disabled Edit UI from Epic 2:

- Edit mode: monospace text editor with markdown syntax highlighting in the content area
- Mode switching: Render/Edit toggle in the content toolbar (activating Epic 2's disabled Edit button) and keyboard shortcut (activating Epic 2's disabled Cmd+Shift+M)
- "Opens in" default mode picker: Edit option becomes selectable (activating Epic 2's disabled option)
- Dirty state tracking: dot indicator on tab, dirty indicator in content toolbar, dirty state derived from content differing from last saved version
- Save (Cmd+S): writes current editor content to the file's path on disk, clears dirty state
- Save As (Cmd+Shift+S or File > Save As): prompts for a new path, writes content, updates the tab to point to the new file
- Unsaved changes protection on tab close: modal with Save and Close, Discard Changes, Cancel
- Unsaved changes protection on quit: modal listing dirty tabs with Save All and Quit, Discard All and Quit, Cancel
- External change conflict resolution: when a watched file changes on disk while the user has unsaved edits, a conflict modal offers Keep My Changes, Reload from Disk, Save Copy
- Line/column cursor position display in the content toolbar status area during edit mode
- Markdown syntax highlighting in the editor: headings, bold, italic, strikethrough, inline code, code blocks, links, lists, tables, blockquotes
- Markdown insert tools: keyboard shortcuts or toolbar actions for inserting tables and links (lightweight, not a formatting toolbar)
- Standard text editing: select, copy, paste, cut, undo, redo
- File menu additions: Save, Save As items with keyboard shortcuts shown

### Out of Scope

- Rich text / WYSIWYG editing
- Split pane (side-by-side edit and preview)
- Collaborative editing
- Version history / undo beyond standard editor undo
- Spell check
- AI-assisted editing (future agentic interface direction)
- Find and replace within the editor (future — search is out of scope for v1 per PRD)
- Auto-save (future refinement)
- Markdown preview while typing (live preview would be split pane, which is out of scope)
- Creating new blank documents (File > New) — the user creates files externally and opens them in the viewer
- Saving to non-markdown file extensions — Save As restricts to `.md` and `.markdown` extensions

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Epics 1–4 are complete: server runtime, rendering pipeline, Mermaid, syntax highlighting, export, file watching, session persistence | Unvalidated | Dev team | Epic 5 builds on the full stack |
| A2 | A text editor component handles the editing surface — cursor management, selection, undo/redo, keyboard input | Unvalidated | Tech Lead | CodeMirror, Monaco, or equivalent — confirm during tech design |
| A3 | The editor component supports markdown syntax highlighting out of the box or via a language mode | Unvalidated | Tech Lead | Most code editor libraries support markdown |
| A4 | File watching (Epic 2) continues to work during edit mode. The difference is: without edits, changes auto-reload silently; with unsaved edits, changes trigger the conflict modal. | Validated | Architecture | Inherits Epic 2's file watching infrastructure |
| A5 | Save is a synchronous write to disk. The server receives content and path, writes atomically (temp + rename), and returns success or error. | Unvalidated | Tech Lead | Atomic write pattern established in Epic 1's session persistence |
| A6 | Tab state is client-side only and does not persist across restarts (established in Epic 2 A5). Unsaved edits are lost on restart — the quit protection modal is the safety net. | Validated | Architecture | Tab session restore is a future Epic 6 consideration |
| A7 | Export (Epic 4) reads from disk (Epic 4 A5). If the user has unsaved edits and exports, the export uses the saved-on-disk version, not the unsaved edits. The user should be warned if exporting with unsaved changes. | Unvalidated | Product | Cross-epic interaction; see AC-8.1 |
| A8 | Cmd+S and Cmd+Shift+S override browser native shortcuts (save page, etc.). This is consistent with Epic 2's approach of intercepting Cmd+O, Cmd+W, etc. The app calls `preventDefault()` on these shortcuts. | Validated | Architecture | Established pattern from Epics 1–2 |

---

## Flows & Requirements

### 1. Mode Switching

The user switches between Render and Edit modes using the mode toggle in the
content toolbar or a keyboard shortcut. Switching to Edit shows the raw
markdown in an editor. Switching to Render re-renders the content. Dirty state
is preserved across mode switches.

1. User views a rendered document (Render mode)
2. User clicks the Edit button or presses the mode toggle shortcut
3. Content area switches to the editor showing raw markdown with syntax highlighting
4. User edits, then clicks Render or presses the shortcut again
5. Content area re-renders the markdown (including any edits)

#### Acceptance Criteria

**AC-1.1:** The mode toggle switches between Render and Edit modes

- **TC-1.1a: Switch to Edit mode**
  - Given: A document is open in Render mode
  - When: User clicks the Edit button in the content toolbar
  - Then: The content area switches to the editor showing raw markdown with syntax highlighting. The Edit button is visually active; the Render button is inactive.
- **TC-1.1b: Switch to Render mode**
  - Given: A document is open in Edit mode
  - When: User clicks the Render button
  - Then: The content area re-renders the markdown and displays the rendered output. The Render button is visually active.
- **TC-1.1c: Keyboard shortcut toggles mode**
  - Given: A document is open in either mode
  - When: User presses Cmd+Shift+M
  - Then: The mode toggles (Render → Edit or Edit → Render). This activates the shortcut that was "coming soon" in Epic 2 (AC-6.2c).
- **TC-1.1d: Dirty state preserved across mode switch**
  - Given: A document is in Edit mode with unsaved changes (dirty)
  - When: User switches to Render mode and back to Edit mode
  - Then: The edits are preserved; the dirty indicator remains; the editor shows the modified content
- **TC-1.1e: Render mode reflects unsaved edits**
  - Given: A document has unsaved edits in Edit mode
  - When: User switches to Render mode
  - Then: The rendered view shows the current editor content (including unsaved changes), not the saved-on-disk version. Warnings (missing images, failed Mermaid, etc.) are recomputed from the unsaved content — the user sees accurate warnings for what they've written, not stale warnings from the last save.
- **TC-1.1f: Mode per tab**
  - Given: Tab A is in Edit mode, Tab B is in Render mode
  - When: User switches between tabs
  - Then: Each tab preserves its own mode. Switching to Tab B shows Render; switching back to Tab A shows Edit.

**AC-1.2:** The content toolbar updates to reflect the active mode

- **TC-1.2a: Edit mode toolbar state**
  - Given: A document is in Edit mode
  - When: User views the content toolbar
  - Then: The Edit button is active, cursor position (line:column) is shown in the status area, and the warning count from Render mode is hidden (warnings are a rendering concept)
- **TC-1.2b: Render mode toolbar state**
  - Given: A document is in Render mode
  - When: User views the content toolbar
  - Then: The Render button is active, cursor position is hidden, and the warning count is shown (if warnings exist)

### 2. Edit Mode Editor

The editor is a monospace text editor with markdown syntax highlighting. It
supports standard text editing operations: typing, selection, copy/paste/cut,
undo/redo. The editor shows line numbers and displays cursor position in the
status area.

#### Acceptance Criteria

**AC-2.1:** Editor displays raw markdown with syntax highlighting

- **TC-2.1a: Markdown syntax highlighting**
  - Given: A document is opened in Edit mode
  - When: User views the editor
  - Then: Markdown constructs are visually distinguished: headings (distinct color or weight), bold/italic (styled), inline code (monospace background), code blocks (distinct background), links (colored), list markers (colored), blockquote markers (colored)
- **TC-2.1b: Line numbers**
  - Given: A document is open in Edit mode
  - When: User views the editor
  - Then: Line numbers are displayed in a gutter on the left side of the editor
- **TC-2.1c: Cursor position display**
  - Given: The cursor is at line 42, column 15
  - When: User views the content toolbar status area
  - Then: The status area shows "Ln 42, Col 15" (or equivalent format)
- **TC-2.1d: Cursor position updates**
  - Given: A document is in Edit mode
  - When: User moves the cursor (click, arrow keys, keyboard shortcuts)
  - Then: The cursor position display updates immediately

**AC-2.2:** Standard text editing operations work

- **TC-2.2a: Typing and deletion**
  - Given: A document is in Edit mode
  - When: User types text
  - Then: Text appears at the cursor position; the dirty indicator activates
- **TC-2.2b: Selection**
  - Given: A document is in Edit mode
  - When: User selects text (click-drag, Shift+arrows, Cmd+A)
  - Then: Selected text is visually highlighted
- **TC-2.2c: Copy, paste, cut**
  - Given: Text is selected in the editor
  - When: User presses Cmd+C, then positions cursor and presses Cmd+V
  - Then: The selected text is copied and pasted at the new position
- **TC-2.2d: Undo and redo**
  - Given: User has made edits
  - When: User presses Cmd+Z
  - Then: The last edit is undone. Cmd+Shift+Z redoes. Multiple undo steps are supported.
- **TC-2.2e: Undo back to clean state**
  - Given: User made 3 edits since last save
  - When: User presses Cmd+Z three times
  - Then: The content matches the last saved version; the dirty indicator clears

**AC-2.3:** Editor adapts to the active theme

- **TC-2.3a: Light theme editor**
  - Given: A light theme is active
  - When: A document is opened in Edit mode
  - Then: The editor uses dark text on a light background with syntax highlighting colors appropriate for a light scheme
- **TC-2.3b: Dark theme editor**
  - Given: A dark theme is active
  - When: A document is opened in Edit mode
  - Then: The editor uses light text on a dark background with syntax highlighting colors appropriate for a dark scheme
- **TC-2.3c: Theme switch updates editor**
  - Given: A document is open in Edit mode
  - When: User switches themes
  - Then: The editor's colors update to match the new theme without losing cursor position or edits

**AC-2.4:** Editor scroll position is managed per tab

- **TC-2.4a: Edit mode scroll preservation**
  - Given: User scrolls to line 200 in Edit mode, switches to another tab, then switches back
  - When: The original tab is reactivated in Edit mode
  - Then: The editor scroll position is at line 200
- **TC-2.4b: Mode switch scroll mapping**
  - Given: User is viewing a rendered document scrolled partway through
  - When: User switches to Edit mode
  - Then: The editor scrolls to approximately the same position in the source. Exact mapping is best-effort — the editor should be near the same content, not necessarily pixel-perfect.

### 3. Save and Save As

Save writes the current editor content to the file's path on disk using an
atomic write (temp file + rename). Save As prompts for a new path. Both clear
the dirty indicator on success.

1. User is in Edit mode with unsaved changes
2. User presses Cmd+S (or File > Save)
3. Content is written to disk
4. Dirty indicator clears
5. File watcher detects the write but does not trigger a conflict (the app ignores self-originated changes)

#### Acceptance Criteria

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
  - Then: The server detects the mtime mismatch and returns 409 CONFLICT. The client shows the conflict modal (AC-6.1). The user's edits are not lost and the file is not overwritten.
- **TC-3.1f: Save from Render mode with dirty edits**
  - Given: A document has unsaved edits but the user is currently in Render mode
  - When: User presses Cmd+S
  - Then: The file is saved with the current editor content. The dirty indicator clears. The user remains in Render mode. The rendered view and warnings do not change (the content was already rendered from the unsaved edits per TC-1.1e).
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

### 4. Dirty State Tracking

The app tracks whether the current editor content differs from the last saved
version. Dirty state is visible on the tab and in the content toolbar.

#### Acceptance Criteria

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

### 5. Unsaved Changes Protection

The app protects the user from accidentally losing unsaved edits by prompting
before destructive actions.

#### Acceptance Criteria

**AC-5.1:** Closing a dirty tab prompts with Save and Close, Discard Changes, Cancel

- **TC-5.1a: Close dirty tab via close button**
  - Given: A tab has unsaved edits
  - When: User clicks the tab's close button
  - Then: A modal appears with: "You have unsaved changes in [filename]." Options: Save and Close, Discard Changes, Cancel.
- **TC-5.1b: Save and Close**
  - Given: The unsaved changes modal is open
  - When: User clicks Save and Close
  - Then: The file is saved to disk, then the tab is closed. If save fails, the tab remains open and the error is shown.
- **TC-5.1c: Discard Changes**
  - Given: The unsaved changes modal is open
  - When: User clicks Discard Changes
  - Then: The tab is closed without saving. The edits are lost.
- **TC-5.1d: Cancel**
  - Given: The unsaved changes modal is open
  - When: User clicks Cancel (or presses Escape)
  - Then: The modal closes. The tab remains open with its edits intact.
- **TC-5.1e: Close clean tab**
  - Given: A tab has no unsaved changes
  - When: User clicks the close button
  - Then: The tab closes immediately with no prompt (same as Epic 2)
- **TC-5.1f: Close dirty tab via keyboard shortcut**
  - Given: A tab has unsaved edits
  - When: User presses Cmd+W
  - Then: The unsaved changes modal appears (same as clicking the close button)

**AC-5.2:** Closing multiple tabs prompts for each dirty tab

- **TC-5.2a: Close Others with dirty tabs**
  - Given: Tabs A (dirty), B (clean), C (dirty) are open. User right-clicks Tab B.
  - When: User selects "Close Others"
  - Then: The modal appears for Tab A. If user saves/discards, the modal appears for Tab C. Tab B remains open. If the user cancels at any point, the remaining tabs are not closed.
- **TC-5.2b: Close Tabs to the Right with dirty tabs**
  - Given: Tabs A, B (dirty), C (clean) are open. User right-clicks Tab A.
  - When: User selects "Close Tabs to the Right"
  - Then: The modal appears for Tab B (dirty). Tab C closes without prompt (clean). If the user cancels for Tab B, Tab B and Tab C both remain open.

**AC-5.3:** Quitting with dirty tabs prompts the user to save

The quit protection behavior differs between browser and Electron contexts due
to browser API limitations. Both prevent silent data loss.

- **TC-5.3a: Quit with dirty tabs — Electron**
  - Given: 2 of 5 open tabs have unsaved edits, running in Electron
  - When: The user closes the window
  - Then: A custom modal appears listing the 2 dirty files by name. Options: Save All and Quit, Discard All and Quit, Cancel.
- **TC-5.3b: Save All and Quit — Electron**
  - Given: The quit modal is open with 2 dirty files listed
  - When: User clicks Save All and Quit
  - Then: Both files are saved to disk, then the app quits. If any save fails, the quit is aborted and the error is shown.
- **TC-5.3c: Discard All and Quit — Electron**
  - Given: The quit modal is open
  - When: User clicks Discard All and Quit
  - Then: The app quits without saving any files. All unsaved edits are lost.
- **TC-5.3d: Cancel quit — Electron**
  - Given: The quit modal is open
  - When: User clicks Cancel
  - Then: The modal closes. The app remains open with all tabs and edits intact.
- **TC-5.3e: Quit with dirty tabs — Browser**
  - Given: Tabs have unsaved edits, running in a browser tab
  - When: The user closes the browser tab or navigates away
  - Then: The browser's native `beforeunload` prompt appears (e.g., "Changes you made may not be saved."). The app cannot show a custom modal or list specific files in this context. If the user confirms leave, edits are lost.
  - Known deviation: The browser `beforeunload` API does not allow custom modal content. The file-listing quit modal is Electron-only. This is a platform limitation, not a product gap.
- **TC-5.3f: Quit with no dirty tabs**
  - Given: All open tabs are clean (no unsaved changes)
  - When: User initiates quit
  - Then: The app quits immediately with no prompt (no `beforeunload` registered when no tabs are dirty).

### 6. External Change Conflict Resolution

When a file changes on disk while the user has unsaved edits, a conflict modal
appears. This builds on Epic 2's file watching infrastructure. Without edits,
external changes still auto-reload silently (Epic 2 behavior unchanged).

1. User is editing a file (dirty state)
2. An external process modifies the file on disk
3. The file watcher detects the change
4. A conflict modal appears over the content area
5. User chooses: Keep My Changes, Reload from Disk, or Save Copy

#### Acceptance Criteria

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

### 7. Default Mode Picker

The "Opens in" dropdown in the content toolbar becomes fully functional. Both
Render and Edit are selectable. The default mode determines which mode new
tabs open in.

#### Acceptance Criteria

**AC-7.1:** The "Opens in" dropdown allows selecting Edit as the default mode

- **TC-7.1a: Edit option enabled**
  - Given: User clicks the "Opens in" dropdown
  - When: Dropdown opens
  - Then: Both Render and Edit are selectable. The Edit option is no longer disabled or marked "coming soon" (activating from Epic 2 AC-6.3b).
- **TC-7.1b: Set default to Edit**
  - Given: User selects Edit from the "Opens in" dropdown
  - When: User opens a new file
  - Then: The new tab opens in Edit mode showing the raw markdown editor
- **TC-7.1c: Default mode persists across sessions**
  - Given: User sets default mode to Edit
  - When: App is restarted
  - Then: The default mode is still Edit. New tabs open in Edit mode.

- **TC-7.1d: Direct open in Edit mode**
  - Given: Default mode is set to Edit
  - When: User clicks a file in the sidebar tree
  - Then: The file loads (loading indicator), then opens directly in Edit mode — it does not briefly show Render mode first

**AC-7.2:** Existing open tabs are not affected by changing the default mode

- **TC-7.2a: Existing tabs unchanged**
  - Given: 3 tabs are open in Render mode
  - When: User changes the default mode to Edit
  - Then: The 3 open tabs remain in Render mode. Only new tabs open in Edit mode.

### 8. Cross-Epic Interactions

Edit mode introduces interactions with Epic 4 (export) and Epic 2 (tab
management) that need explicit behavior.

#### Acceptance Criteria

**AC-8.1:** Exporting with unsaved edits warns the user

- **TC-8.1a: Export warning for dirty tab**
  - Given: The active tab has unsaved edits
  - When: User initiates an export
  - Then: A warning appears: "This file has unsaved changes. The export will use the saved version on disk, not your current edits." Options: Export Anyway, Save and Export, Cancel.
- **TC-8.1b: Save and Export**
  - Given: The export warning is shown
  - When: User clicks Save and Export
  - Then: The file is saved to disk first, then the export proceeds with the newly saved content.
- **TC-8.1c: Export Anyway**
  - Given: The export warning is shown
  - When: User clicks Export Anyway
  - Then: The export proceeds using the on-disk version. The user's unsaved edits remain in the editor.

**AC-8.2:** File menu includes Save and Save As items

- **TC-8.2a: File menu Save**
  - Given: User opens the File menu
  - When: A document is open
  - Then: Save (with Cmd+S shortcut shown) and Save As (with Cmd+Shift+S shortcut shown) items are visible. Save is enabled when the document is dirty; disabled when clean.
- **TC-8.2b: Save As always enabled**
  - Given: User opens the File menu
  - When: A document is open (dirty or clean)
  - Then: Save As is always enabled — the user can save a clean document to a new location

### 9. Markdown Insert Tools

Lightweight tools for inserting markdown constructs that are tedious to type
manually. These are keyboard shortcuts or small toolbar actions, not a heavy
formatting toolbar.

#### Acceptance Criteria

**AC-9.1:** A link insert tool is available

- **TC-9.1a: Insert link via shortcut or toolbar**
  - Given: A document is in Edit mode
  - When: User triggers the insert link action (keyboard shortcut or toolbar button)
  - Then: A small dialog or inline prompt appears for link text and URL. On confirm, a markdown link `[text](url)` is inserted at the cursor position.
- **TC-9.1b: Insert link with selection**
  - Given: Text is selected in the editor
  - When: User triggers insert link
  - Then: The selected text becomes the link text. The dialog prompts only for the URL.

**AC-9.2:** A table insert tool is available

- **TC-9.2a: Insert table via shortcut or toolbar**
  - Given: A document is in Edit mode
  - When: User triggers the insert table action
  - Then: A small dialog or inline prompt appears for row and column count. On confirm, a markdown table skeleton is inserted at the cursor position with header row, separator row, and the specified number of body rows.
- **TC-9.2b: Inserted table structure**
  - Given: User inserts a 3-column, 2-row table
  - When: Table is inserted
  - Then: The inserted text is a valid markdown table with 3 columns, a header row with placeholder text, a separator row, and 2 body rows with placeholder text.

### 10. Error Handling

Edit and save operations can fail. Errors are surfaced clearly. The user's
edits are never silently lost.

#### Acceptance Criteria

**AC-10.1:** Save errors do not lose user edits

- **TC-10.1a: Editor content preserved on save failure**
  - Given: A save operation fails (permission denied, disk full, path invalid)
  - When: The error is displayed
  - Then: The editor content is unchanged. The dirty state is preserved. The user can retry save, use Save As, or continue editing.

**AC-10.2:** Editor errors do not crash the app

- **TC-10.2a: Very large file in editor**
  - Given: A document is 10,000+ lines
  - When: Opened in Edit mode
  - Then: The editor renders without freezing the UI. Typing and scrolling remain responsive.
- **TC-10.2b: Binary content in editor**
  - Given: A .md file contains binary content
  - When: Opened in Edit mode
  - Then: The same error/fallback is shown as in Render mode (Epic 2 AC-9.2c). The editor does not attempt to display binary content. The user can close the tab.

---

## Data Contracts

### TabState Extension

Epic 2's `TabState` is extended for edit mode:

```typescript
interface TabState {
  // ... all Epic 2 fields ...
  mode: "render" | "edit";
  editContent: string | null;   // current editor buffer; null when mode is "render" and no edits have been made
  cursorPosition: {
    line: number;               // 1-based
    column: number;             // 1-based
  } | null;
  dirty: boolean;               // true when editContent differs from content (last-loaded version)
}
```

Note: `dirty` can be derived from `editContent !== content`, but tracking it
explicitly avoids recomputing on every keystroke for large files. The derivation
is the source of truth; the field is a cache.

### File Save API

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

### File Save As (uses save dialog)

```typescript
// Uses the same server-side save dialog pattern as Epic 4's export save dialog
// Request: { defaultPath: string, defaultFilename: string }
// Response: { path: string } | null (null if cancelled)
```

### Conflict Event

Epic 2's `FileChangeEvent` is reused. The conflict behavior is client-side
logic: if the tab is dirty when a `modified` event arrives, show the conflict
modal instead of auto-reloading.

### Session State

No new fields. `defaultOpenMode` already exists in `SessionState` as
`"render" | "edit"` (defined in Epic 2). Epic 5 enables the `"edit"` value
to be selected.

### API Surface

New endpoints for this epic:

| Method | Path | Request | Success Response | Error | Notes |
|--------|------|---------|-----------------|-------|-------|
| PUT | /api/file | `FileSaveRequest` | `FileSaveResponse` | 400, 403, 404, 500, 507 | Write content to a file path; atomic write (temp + rename) |
| POST | /api/file/save-dialog | `{ defaultPath: string, defaultFilename: string }` | `{ path: string } \| null` | 500 | Open server-side save dialog for Save As; returns selected path or null |

The save endpoint (`PUT /api/file`) validates that:
- The path is absolute
- The path has a recognized markdown extension (`.md` or `.markdown`)
- The parent directory exists

The file save dialog endpoint may share implementation with Epic 4's
`/api/export/save-dialog`. The tech design may consolidate these into a
single generic save dialog endpoint.

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_PATH | Path is not absolute or contains invalid characters |
| 403 | PERMISSION_DENIED | Cannot write to the specified path |
| 404 | PATH_NOT_FOUND | The parent directory does not exist |
| 500 | WRITE_ERROR | Unexpected error during file write |
| 409 | CONFLICT | File on disk has a different modifiedAt than expectedModifiedAt — external change detected. Client should show the conflict modal. |
| 415 | NOT_MARKDOWN | Save path does not have a recognized markdown extension |
| 507 | INSUFFICIENT_STORAGE | Target disk has insufficient space |

---

## Dependencies

Technical dependencies:
- Epics 1–4 complete: server runtime, rendering pipeline, file watching, content toolbar with mode toggle, Export, session persistence with defaultOpenMode
- Text editor component (confirmed in tech design)

Process dependencies:
- Epic 4 tech design and implementation complete before Epic 5 implementation begins

---

## Non-Functional Requirements

### Performance
- Editor opens and displays content within 1 second for files up to 500KB
- Typing latency is imperceptible (under 16ms per keystroke) for files up to 10,000 lines
- Mode switching (Render ↔ Edit) completes within 500ms
- Save completes within 1 second for files up to 1MB

### Reliability
- Save uses atomic writes (temp file + rename) to prevent corruption on crash or power loss
- Unsaved edits are never silently discarded — every destructive action (close, quit, reload) prompts first
- Self-originated file changes (from save) do not trigger conflict modals

### Security
- Save writes only to the path the user owns (the file's current path, or a path chosen via Save As dialog)
- Editor content is not written to disk until the user explicitly saves — no auto-save. Transient temp files are created during atomic writes (temp + rename) but are removed immediately on completion or failure; no persistent temp files containing user content are left behind.
- No remote resources are fetched during editing

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. **Editor component:** CodeMirror 6, Monaco, or another approach? Trade-offs include bundle size, markdown language support, theme integration, mobile readiness, and extension API for insert tools.
2. **Self-change detection:** When the user saves, the file watcher will detect the change. How does the client distinguish self-originated changes from external changes? Options: timestamp comparison, a "save in progress" flag, or server-side event suppression.
3. **Scroll position mapping between modes:** When switching from Render to Edit (or vice versa), how is the approximate scroll position mapped between rendered HTML and source line numbers? Options: heading anchors, line-number estimation, or no mapping (always scroll to top).
4. **Save dialog consolidation:** Epic 4 defines `/api/export/save-dialog` and this epic defines `/api/file/save-dialog`. Should these be a single generic `/api/save-dialog` endpoint?
5. **Dirty state diffing:** Should dirty state compare the full string content, or use a hash for large files? At what file size does string comparison become too slow for per-keystroke checking?
6. **Quit interception in Electron:** AC-5.3 splits browser (generic `beforeunload`) from Electron (custom modal). How should Electron intercept the window close event to show the custom modal? `window.onbeforeunload` in the renderer, or Electron's `will-quit`/`close` events in the main process?
7. **Insert tool UX:** Should insert tools (link, table) be toolbar buttons above the editor, keyboard shortcuts only, or a command palette (Cmd+Shift+P style)? The PRD says "not a heavy formatting toolbar."
8. **Concurrent save serialization:** The `expectedModifiedAt` token prevents stale writes. Should the server additionally serialize concurrent writes to the same path (e.g., queue them), or is the optimistic concurrency check sufficient?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

Types, test fixtures, and infrastructure needed by all Epic 5 stories.

- `TabState` extension with `mode`, `editContent`, `cursorPosition`, `dirty`
- `FileSaveRequest`, `FileSaveResponse` type definitions
- New error codes: `WRITE_ERROR`
- Server endpoint stubs for `PUT /api/file`, `POST /api/file/save-dialog`
- Test fixtures: sample documents for editing (short, long, binary, read-only)
- `defaultOpenMode: "edit"` validation enabled in session endpoint

### Story 1: Mode Switching and Default Mode

**Delivers:** User can switch between Render and Edit modes. The "Opens in" picker supports Edit. Mode is per-tab.
**Prerequisite:** Story 0, Epics 1–4 complete
**ACs covered:**
- AC-1.1 (mode toggle, keyboard shortcut, dirty preservation, per-tab mode)
- AC-1.2 (toolbar state per mode)
- AC-7.1 (default mode picker, Edit enabled, persistence)
- AC-7.2 (existing tabs unaffected)

**Estimated test count:** 14 tests

### Story 2: Edit Mode Editor

**Delivers:** User sees a monospace editor with markdown syntax highlighting, line numbers, cursor position, standard editing, and theme adaptation.
**Prerequisite:** Story 1
**ACs covered:**
- AC-2.1 (syntax highlighting, line numbers, cursor position)
- AC-2.2 (text editing operations)
- AC-2.3 (theme adaptation)
- AC-2.4 (scroll position management)

**Estimated test count:** 14 tests

### Story 3: Save, Save As, and Dirty State

**Delivers:** User can save and save-as. Dirty state is tracked with visible indicators on tab and toolbar.
**Prerequisite:** Story 2
**ACs covered:**
- AC-3.1 (save to disk, self-change detection)
- AC-3.2 (save as with dialog)
- AC-3.3 (save error handling)
- AC-4.1 (tab dirty indicator)
- AC-4.2 (toolbar dirty indicator)
- AC-4.3 (per-tab dirty tracking)

**Estimated test count:** 18 tests

### Story 4: Unsaved Changes Protection

**Delivers:** Closing dirty tabs and quitting with dirty tabs prompts the user. Multi-tab close operations handle dirty tabs sequentially.
**Prerequisite:** Story 3
**ACs covered:**
- AC-5.1 (close dirty tab modal)
- AC-5.2 (close multiple tabs with dirty tabs)
- AC-5.3 (quit with dirty tabs modal)

**Estimated test count:** 12 tests

### Story 5: External Change Conflict Resolution

**Delivers:** External file changes while editing trigger a conflict modal with Keep, Reload, Save Copy options. File deletion while editing is handled.
**Prerequisite:** Story 3 (needs dirty state tracking)
**ACs covered:**
- AC-6.1 (conflict modal with Keep, Reload, Save Copy)
- AC-6.2 (no-conflict auto-reload for clean tabs unchanged)
- AC-6.3 (file deletion while editing)

**Estimated test count:** 8 tests

### Story 6: Markdown Insert Tools, File Menu, and Cross-Epic

**Delivers:** Insert link and insert table tools. File menu Save/Save As items. Export-with-dirty-edits warning.
**Prerequisite:** Story 3
**ACs covered:**
- AC-8.1 (export with unsaved edits warning)
- AC-8.2 (File menu Save and Save As)
- AC-9.1 (insert link tool)
- AC-9.2 (insert table tool)
- AC-10.1 (save errors preserve edits)
- AC-10.2 (editor edge cases)

**Estimated test count:** 10 tests

---

## Amendments

### Amendment 1: Save concurrency token added (2026-03-20)

**Changed:** FileSaveRequest (added `expectedModifiedAt`), Error Responses (added 409 CONFLICT), TC-3.1e
**Reason:** Codex verification identified that a safety-focused epic requires a stale-write guard. Without a version check, save could silently overwrite external changes in a race condition where the conflict modal hasn't appeared yet. The `expectedModifiedAt` field enables compare-and-swap semantics: the server rejects writes when the file has changed since the client last loaded it.

### Amendment 2: Quit flow split by platform (2026-03-20)

**Changed:** AC-5.3 TCs split into Electron-specific (custom modal) and browser-specific (`beforeunload`)
**Reason:** The browser `beforeunload` API does not allow custom modal content. The file-listing quit modal is only achievable in Electron. The browser fallback is the generic "Changes you made may not be saved" prompt. Both prevent silent data loss; the Electron version provides more detail.

### Amendment 3: Temp file security wording corrected (2026-03-20)

**Changed:** Security NFR
**Reason:** The original wording ("no temp files containing user content") contradicted the atomic write requirement (temp + rename). Changed to "no persistent temp files left behind" — transient temp files during write are expected and necessary for atomicity.

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
- [x] Stories sequence logically (mode → editor → save → protection → conflicts → tools)
- [x] All dependencies on Epics 1–4 are explicit
- [x] Epic 2 mode toggle and "Opens in" activation documented
- [x] Epic 2 file watching conflict layer documented
- [x] Epic 4 export interaction documented (AC-8.1)
- [x] Self-change detection specified (TC-3.1d)
- [x] Stale-write guard via expectedModifiedAt (TC-3.1e, 409 CONFLICT)
- [x] Save from Render mode with dirty edits specified (TC-3.1f)
- [x] Save As to already-open path maintains one-tab-per-file invariant (TC-3.2e/f)
- [x] Save path validation (markdown extension) specified
- [x] New file creation explicitly out of scope
- [x] Direct open in Edit mode specified (TC-7.1d)
- [x] Cmd+S browser override documented (A8)
- [x] Quit flow split: browser (beforeunload) vs. Electron (custom modal) — Amendment 2
- [x] Temp file security wording corrected — Amendment 3
- [x] Save Copy cancel/failure edge cases specified (TC-6.1e/f)
- [x] Render-mode warnings recomputed from unsaved content (TC-1.1e)
- [x] Binary file behavior aligned with Epic 2 (TC-10.2b)
- [x] Self-review complete
- [x] Verification round 1 complete (Codex)
- [x] Critical and major issues from verification round 1 addressed
- [ ] Validation rounds complete (pending final sign-off)
