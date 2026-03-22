# Story 6: Markdown Insert Tools, File Menu, and Cross-Epic

### Summary
<!-- Jira: Summary field -->

Link and table insert tools, File menu Save/Save As items, export-with-unsaved-edits warning, and editor error handling for large and binary files.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user is reviewing a rendered document and spots something to fix — a typo, a broken link, a section that needs updating. They want to make the edit in place without switching to a separate tool. They may be working alongside AI agents that are also modifying files on disk.
- **Mental Model:** "I see something wrong, I switch to edit mode, I fix it, I save. If something goes wrong — accidental close, external change — the app protects me."
- **Key Constraint:** Editing is secondary to viewing. The editor is for quick corrections and light authoring, not a full IDE replacement. Document safety (no lost work) is non-negotiable.

**Objective:** Lightweight markdown insert tools (link, table) help the user insert constructs that are tedious to type manually. The File menu gains Save and Save As items with shortcuts shown. Exporting with unsaved edits warns the user that the export uses the on-disk version. Editor error handling ensures large and binary files do not crash the app.

**Scope — In:**
- Insert link: keyboard shortcut or toolbar action, dialog for link text and URL, `[text](url)` inserted at cursor
- Insert link with selection: selected text becomes link text, prompt for URL only
- Insert table: keyboard shortcut or toolbar action, dialog for row/column count, markdown table skeleton inserted
- File menu: Save (Cmd+S) and Save As (Cmd+Shift+S) items visible with shortcuts shown
- File menu Save enabled when dirty, disabled when clean
- File menu Save As always enabled
- Export with unsaved edits warning: "This file has unsaved changes. The export will use the saved version on disk, not your current edits." Options: Export Anyway, Save and Export, Cancel
- Save and Export: saves first, then exports with newly saved content
- Export Anyway: exports on-disk version, unsaved edits remain
- Save errors preserve editor content and dirty state
- Very large file (10,000+ lines) in editor: renders without UI freeze
- Binary content in .md file: same error/fallback as Render mode (Epic 2 AC-9.2c)

**Scope — Out:**
- Full formatting toolbar (out of scope per PRD)
- Find and replace (future — out of scope for v1)

**Dependencies:** Story 3

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Insert tools use the editor component's API to insert text at the cursor position. The link insert dialog collects text and URL; the table insert dialog collects row and column counts. Both are lightweight UI components (small modal or inline prompt).

File menu additions are standard menu items with keyboard shortcut labels. Save's enabled state is bound to the active tab's `dirty` field.

The export warning intercepts Epic 4's export flow when the active tab is dirty. Save and Export chains Story 3's save mechanism with Epic 4's export.

No new data contracts. No new server endpoints.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Insert link action inserts `[text](url)` at cursor; with selection, selected text becomes link text
- [ ] Insert table action inserts valid markdown table skeleton with specified dimensions
- [ ] File menu shows Save (Cmd+S) and Save As (Cmd+Shift+S) with correct enabled states
- [ ] Export with unsaved edits shows warning with Export Anyway, Save and Export, Cancel
- [ ] Save and Export saves first, then exports newly saved content
- [ ] Save errors preserve editor content and dirty state
- [ ] 10,000+ line file renders in editor without UI freeze
- [ ] Binary .md file shows error/fallback consistent with Render mode
- [ ] All 12 TCs pass
- [ ] No regressions in existing Epics 1–4 functionality
