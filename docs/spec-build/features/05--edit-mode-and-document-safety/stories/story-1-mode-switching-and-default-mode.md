# Story 1: Mode Switching and Default Mode

### Summary
<!-- Jira: Summary field -->

Mode toggle between Render and Edit, keyboard shortcut, per-tab mode, toolbar state per mode, and "Opens in" default mode picker with Edit enabled.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user is reviewing a rendered document and spots something to fix — a typo, a broken link, a section that needs updating. They want to make the edit in place without switching to a separate tool. They may be working alongside AI agents that are also modifying files on disk.
- **Mental Model:** "I see something wrong, I switch to edit mode, I fix it, I save. If something goes wrong — accidental close, external change — the app protects me."
- **Key Constraint:** Editing is secondary to viewing. The editor is for quick corrections and light authoring, not a full IDE replacement. Document safety (no lost work) is non-negotiable.

**Objective:** The user can switch any open document between Render and Edit modes using the toolbar toggle or keyboard shortcut. The "Opens in" dropdown supports Edit as the default mode. Mode is per-tab and preserved across tab switches. Dirty state is preserved across mode switches.

**Scope — In:**
- Edit button in content toolbar switches to Edit mode (activating Epic 2's disabled Edit button)
- Render button switches back to Render mode
- Keyboard shortcut Cmd+Shift+M toggles mode (activating Epic 2's disabled shortcut)
- Dirty state and edits preserved across mode switches
- Render mode shows current editor content (including unsaved edits)
- Mode is per-tab — each tab preserves its own mode
- Content toolbar state updates per mode (cursor position in Edit, warnings in Render)
- "Opens in" dropdown: Edit option becomes selectable (activating Epic 2's disabled option)
- Default mode persists across sessions
- New tabs open directly in Edit mode when default is Edit (no Render flash)
- Existing open tabs unaffected when default mode changes

**Scope — Out:**
- Editor component implementation (Story 2)
- Save behavior (Story 3)
- Dirty state indicators (Story 3)

**Dependencies:** Story 0, Epics 1–4 complete

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

This story activates the `mode` field on `TabState`:

```typescript
interface TabState {
  // ... all Epic 2 fields ...
  mode: "render" | "edit";
  editContent: string | null;
  cursorPosition: {
    line: number;
    column: number;
  } | null;
  dirty: boolean;
}
```

Session state — no new fields. `defaultOpenMode` already exists in `SessionState` as `"render" | "edit"` (defined in Epic 2). This story enables the `"edit"` value to be selected.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Edit button in content toolbar switches to Edit mode
- [ ] Render button switches back to Render mode
- [ ] Cmd+Shift+M toggles mode
- [ ] Mode is per-tab — switching tabs preserves each tab's mode
- [ ] Dirty state and edits preserved across mode switches
- [ ] Render mode shows unsaved editor content (not on-disk version)
- [ ] Content toolbar state updates per mode (cursor position vs. warnings)
- [ ] "Opens in" dropdown: Edit option is selectable
- [ ] Default mode persists across sessions via session state
- [ ] New tabs open directly in default mode (no Render flash when default is Edit)
- [ ] Existing tabs unaffected when default mode changes
- [ ] All 13 TCs pass
- [ ] No regressions in existing Epics 1–4 functionality
