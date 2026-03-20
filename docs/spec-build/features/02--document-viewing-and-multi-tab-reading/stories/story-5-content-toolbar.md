# Story 5: Content Toolbar and Status

### Summary
<!-- Jira: Summary field -->

Content toolbar with mode toggle, default mode picker, export dropdown (disabled), and file path display in menu bar status area.

### Description
<!-- Jira: Description field -->

**User Profile:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts. Browsing and reading markdown files across local workspaces.

**Objective:** The content toolbar appears when a document is open, showing the Render/Edit mode toggle (Edit non-functional), "Opens in" default mode picker (Edit disabled), Export dropdown (disabled), and status area. The menu bar status area shows the active document's file path.

**Scope — In:**
- Content toolbar visibility (appears with document open, hides in empty state)
- Render/Edit mode toggle (Render active, Edit dimmed with "coming soon" tooltip)
- Mode toggle keyboard shortcut (shows "coming soon" tooltip, same as clicking Edit)
- "Opens in" default mode picker (Render selectable, Edit disabled with "coming soon")
- Default mode persistence via PUT /api/session/default-mode
- Export dropdown (present, all options disabled with "coming soon")
- File path display in menu bar status area (truncated, full path on hover)
- Path updates on tab switch, clears in empty state
- Content toolbar appearance on first document open (TC-1.1b from AC-1.1)
- Menu bar status path display (TC-1.1c from AC-1.1)

**Scope — Out:**
- Edit mode functionality (Epic 5)
- Export functionality (Epic 4)
- Warning count in status area (Story 3 — AC-6.5)

**Dependencies:** Story 2 (rendered content to display alongside toolbar), Story 4 (tab switching and close-last-tab flows required by TC-8.1c and TC-8.1d)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1 (partial):** Content toolbar and menu bar status appear when a document opens

- **TC-1.1b: File open updates content toolbar**
  - Given: No documents are open (empty state)
  - When: User opens the first document
  - Then: Content toolbar appears with Render/Edit toggle, "Opens in" picker, Export dropdown, and status area
- **TC-1.1c: File open updates menu bar status**
  - Given: A document is opened
  - When: Tab is active
  - Then: Menu bar status area shows the file's absolute path, truncated, with full path on hover

**AC-6.1:** Content toolbar appears when a document is open and hides when no documents are open

- **TC-6.1a: Toolbar visibility with document**
  - Given: At least one document tab is open
  - When: User views the content area
  - Then: Content toolbar is visible between the tab strip and the rendered content
- **TC-6.1b: Toolbar hidden in empty state**
  - Given: No document tabs are open
  - When: User views the content area
  - Then: Content toolbar is not visible; empty state is shown

**AC-6.2:** Render/Edit mode toggle shows Render as active, Edit as present but non-functional

- **TC-6.2a: Render mode active**
  - Given: A document is open
  - When: User views the content toolbar
  - Then: Render button is visually active; Edit button is present but visually dimmed or marked as unavailable
- **TC-6.2b: Edit button indicates future availability**
  - Given: A document is open
  - When: User clicks the Edit button
  - Then: A tooltip appears indicating that edit mode is coming soon. No mode change occurs.
- **TC-6.2c: Mode toggle keyboard shortcut**
  - Given: A document is open in Render mode
  - When: User presses the mode toggle keyboard shortcut
  - Then: The "coming soon" tooltip appears (same behavior as clicking Edit). No mode change occurs. In Epic 5, this shortcut switches between Render and Edit.

**AC-6.3:** "Opens in" default mode picker is present with Edit disabled until Epic 5

- **TC-6.3a: Default mode picker display**
  - Given: A document is open
  - When: User views the content toolbar
  - Then: "Opens in: Render ▾" dropdown is visible to the right of the mode toggle
- **TC-6.3b: Edit option disabled**
  - Given: User clicks the "Opens in" dropdown
  - When: Dropdown opens
  - Then: Render is selectable and active. Edit is listed but visually disabled with a "coming soon" indicator. User cannot select Edit as the default.
- **TC-6.3c: Default mode persistence**
  - Given: Default mode is set to Render
  - When: App is restarted
  - Then: The default mode persists (stored in session state). Epic 5 enables Edit selection.

**AC-6.4:** Export dropdown is present but non-functional

- **TC-6.4a: Export dropdown display**
  - Given: A document is open
  - When: User views the content toolbar
  - Then: "Export" button is visible on the right side of the toolbar
- **TC-6.4b: Export dropdown disabled state**
  - Given: User clicks the Export dropdown
  - When: Dropdown opens
  - Then: Export options (PDF, DOCX, HTML) are listed but visually disabled with a note indicating they are coming soon

**AC-8.1:** Active document's file path is displayed in the menu bar

- **TC-8.1a: Path display**
  - Given: A document tab is active
  - When: User views the menu bar
  - Then: The file's absolute path is shown in the status area, truncated from the left if it exceeds available space
- **TC-8.1b: Full path on hover**
  - Given: A file path is truncated in the menu bar
  - When: User hovers over the truncated path
  - Then: A tooltip shows the complete absolute path
- **TC-8.1c: Path updates on tab switch**
  - Given: Multiple tabs are open
  - When: User switches tabs
  - Then: The displayed path updates to reflect the newly active document
- **TC-8.1d: Path cleared in empty state**
  - Given: All tabs are closed
  - When: App returns to empty state
  - Then: The path display area is empty or hidden

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

```typescript
// SessionState extension (defaultOpenMode field)
interface SessionState {
  // ... all Epic 1 fields ...
  defaultOpenMode: "render" | "edit";
  // In Epic 2, only "render" is accepted. Epic 5 enables "edit".
}
```

Endpoint implemented in this story:

| Method | Path | Request | Success Response |
|--------|------|---------|-----------------|
| PUT | /api/session/default-mode | `{ mode: "render" }` | `SessionState` |

Only "render" is accepted in Epic 2. The endpoint validates and rejects "edit" until Epic 5.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Content toolbar appears on first document open, hides when all tabs closed
- [ ] Render/Edit toggle shows Render active, Edit dimmed with tooltip
- [ ] "Opens in" picker shows Render selectable, Edit disabled
- [ ] Default mode persists across app restart via session state
- [ ] Export dropdown present with all options disabled
- [ ] File path shows in menu bar, truncated with hover tooltip
- [ ] Path updates on tab switch, clears in empty state
- [ ] PUT /api/session/default-mode works and rejects "edit"
- [ ] Mode toggle keyboard shortcut shows "coming soon" tooltip
- [ ] All 16 TCs pass
