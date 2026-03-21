# Story 1: Export Trigger and Save Dialog

### Summary
<!-- Jira: Summary field -->

Export dropdown activation, format selection, save dialog with sensible defaults, cancel behavior, last-used directory persistence, and keyboard shortcut.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user has reviewed a rendered document in the viewer and needs to share it with someone who does not work in markdown — a stakeholder, a compliance reviewer, a client. They need the output in a format the recipient can open without tooling.
- **Mental Model:** "I click Export, pick a format, and get a good file. I don't want to configure anything."
- **Key Constraint:** Export runs locally — no cloud conversion services. Good defaults matter more than configurability. The exported output should closely match what the user sees in the viewer.

**Objective:** A user can click Export, select a format (PDF, DOCX, HTML), see a save dialog with a sensible default filename and directory, and confirm or cancel. Last-used export directory persists across sessions.

**Scope — In:**
- Content toolbar "Export" dropdown activation (from Epic 2's disabled state)
- Menu bar Export menu activation (from Epic 1's disabled state)
- Format selection: PDF, DOCX, HTML
- Server-side save dialog via `/api/export/save-dialog`
- Default filename (source filename with target extension)
- Default directory (source file's directory, or last-used export directory)
- Cancel behavior (no export, no file created)
- Last-used export directory persistence via `/api/session/last-export-dir`
- Keyboard shortcut to open Export dropdown
- Keyboard navigation within Export dropdown
- Disabled state for no-document and deleted-file tabs

**Scope — Out:**
- Export execution (Story 2)
- Format-specific rendering (Stories 3–5)
- Progress indicator and completion states (Story 2)

**Dependencies:** Story 0, Epics 1–3 complete

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1:** Export dropdown shows PDF, DOCX, and HTML options when a document is open

- **TC-1.1a: Content toolbar Export dropdown**
  - Given: A document is open in the active tab
  - When: User clicks the "Export" button in the content toolbar
  - Then: A dropdown shows three options: PDF, DOCX, HTML. All three are enabled.
- **TC-1.1b: Menu bar Export menu**
  - Given: A document is open in the active tab
  - When: User clicks the Export menu in the menu bar
  - Then: The same three format options appear: PDF, DOCX, HTML. All three are enabled.
- **TC-1.1c: No document open**
  - Given: No document tabs are open (empty state)
  - When: User views the Export dropdown or Export menu
  - Then: Export options are visible but disabled (same disabled pattern as Epics 1–2)
- **TC-1.1d: Deleted-file tab**
  - Given: A tab is showing the "file not found" state (file deleted on disk per Epic 2 AC-7.3)
  - When: User views the Export dropdown
  - Then: Export options are disabled for that tab. Export reads from disk (A5), so a deleted file cannot be exported even though last-known content is visible in the viewer.
  - Note: This is a product decision. Epic 2 preserves last-known content for viewing, but export operates on the current source file. The alternative (exporting cached content) would produce output that may not match any file on disk.
- **TC-1.1e: Export dropdown keyboard navigation**
  - Given: The Export dropdown is open
  - When: User presses arrow keys
  - Then: Focus moves between format options; Enter selects the focused option; Escape closes the dropdown (consistent with Epic 1 AC-2.4)
- **TC-1.1f: File opened outside root**
  - Given: A file outside the current root is open in a tab (opened via File > Open per Epic 2 AC-1.4)
  - When: User clicks Export
  - Then: Export options are enabled; export operates on the open document regardless of root

**AC-1.2:** Selecting a format opens a save dialog with sensible defaults

- **TC-1.2a: Default filename**
  - Given: The active document is `architecture.md`
  - When: User selects PDF from the Export dropdown
  - Then: The save dialog opens with default filename `architecture.pdf`
- **TC-1.2b: Default directory — source file location**
  - Given: The active document is at `/Users/leemoore/code/project/docs/spec.md` and no prior export has been done
  - When: User selects a format
  - Then: The save dialog opens in `/Users/leemoore/code/project/docs/`
- **TC-1.2c: Default directory — last-used export location**
  - Given: The user previously exported a file to `/Users/leemoore/Desktop/exports/`
  - When: User exports a different document
  - Then: The save dialog opens in `/Users/leemoore/Desktop/exports/` (last-used directory takes precedence)
- **TC-1.2d: DOCX filename**
  - Given: The active document is `readme.md`
  - When: User selects DOCX
  - Then: The save dialog opens with default filename `readme.docx`
- **TC-1.2e: HTML filename**
  - Given: The active document is `notes.md`
  - When: User selects HTML
  - Then: The save dialog opens with default filename `notes.html`
- **TC-1.2f: Overwrite existing file**
  - Given: The save dialog is open and the user selects a filename that already exists
  - When: User confirms
  - Then: The OS save dialog prompts for overwrite confirmation. If confirmed, the existing file is replaced. If declined, the user returns to the save dialog.

**AC-1.3:** Cancelling the save dialog aborts the export

- **TC-1.3a: Cancel save dialog**
  - Given: The save dialog is open
  - When: User cancels the dialog
  - Then: No export occurs, no file is created, the app returns to its previous state

**AC-1.4:** Last-used export directory persists across sessions

- **TC-1.4a: Directory persisted**
  - Given: User exported to `/Users/leemoore/Desktop/exports/`
  - When: App is restarted and user exports again
  - Then: The save dialog defaults to `/Users/leemoore/Desktop/exports/`

**AC-1.5:** A keyboard shortcut opens the Export dropdown

- **TC-1.5a: Export keyboard shortcut**
  - Given: A document is open
  - When: User presses the export keyboard shortcut
  - Then: The Export dropdown opens (same as clicking the "Export" button)
  - Note: The specific key combination is a tech design decision. Suggested: Cmd+Shift+E.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Endpoints implemented in this story:

| Method | Path | Request | Success Response |
|--------|------|---------|-----------------|
| POST | /api/export/save-dialog | `{ defaultPath: string, defaultFilename: string }` | `{ path: string } \| null` |
| PUT | /api/session/last-export-dir | `{ path: string }` | `SessionState` |

The save dialog endpoint opens a server-side save dialog (e.g., osascript NSSavePanel on macOS) and returns the selected path or null if cancelled.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Export dropdown activates in content toolbar and menu bar when a document is open
- [ ] Export dropdown shows PDF, DOCX, HTML options
- [ ] Export disabled for empty state and deleted-file tabs
- [ ] Save dialog opens with correct default filename and directory
- [ ] Last-used export directory persists via PUT /api/session/last-export-dir
- [ ] Cancel closes save dialog with no side effects
- [ ] Keyboard shortcut opens Export dropdown
- [ ] Arrow key navigation works within dropdown
- [ ] All 15 TCs pass
- [ ] No regressions in existing Epic 1–3 functionality
