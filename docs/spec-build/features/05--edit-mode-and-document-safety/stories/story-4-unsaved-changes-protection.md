# Story 4: Unsaved Changes Protection

### Summary
<!-- Jira: Summary field -->

Unsaved changes prompts on tab close, multi-tab close operations, and quit — with platform-specific behavior for browser vs. Electron.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user is reviewing a rendered document and spots something to fix — a typo, a broken link, a section that needs updating. They want to make the edit in place without switching to a separate tool. They may be working alongside AI agents that are also modifying files on disk.
- **Mental Model:** "I see something wrong, I switch to edit mode, I fix it, I save. If something goes wrong — accidental close, external change — the app protects me."
- **Key Constraint:** Editing is secondary to viewing. The editor is for quick corrections and light authoring, not a full IDE replacement. Document safety (no lost work) is non-negotiable.

**Objective:** The app protects the user from accidentally losing unsaved edits. Closing a dirty tab prompts with Save and Close, Discard Changes, Cancel. Closing multiple tabs prompts for each dirty tab sequentially. Quitting with dirty tabs shows a platform-appropriate prompt (custom modal in Electron, browser `beforeunload` in the browser).

**Scope — In:**
- Close dirty tab via close button: modal with Save and Close, Discard Changes, Cancel
- Close dirty tab via Cmd+W: same modal
- Close clean tab: immediate close (same as Epic 2)
- Save and Close: saves then closes; if save fails, tab stays open
- Discard Changes: closes without saving
- Cancel: modal closes, tab remains with edits
- Close Others with dirty tabs: prompt for each dirty tab sequentially
- Close Tabs to the Right with dirty tabs: prompt for dirty tabs; cancel stops remaining closes
- Quit with dirty tabs — Electron: custom modal listing dirty files (Save All and Quit, Discard All and Quit, Cancel)
- Quit with dirty tabs — Browser: native `beforeunload` prompt
- Quit with no dirty tabs: immediate quit, no prompt

**Scope — Out:**
- External change conflict resolution (Story 5)
- The save mechanism itself (Story 3 — this story calls save, but the save endpoint is implemented in Story 3)

**Dependencies:** Story 3

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

The quit protection behavior differs between browser and Electron contexts due to browser API limitations. Both prevent silent data loss.

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

This story builds on Story 3's save mechanism and dirty state tracking. No new data contracts are introduced.

The unsaved changes modal is a new UI component with three buttons: Save and Close, Discard Changes, Cancel. It receives the filename and a save callback.

The quit modal (Electron only) lists dirty filenames and provides Save All and Quit, Discard All and Quit, Cancel. In the browser context, the app registers a `beforeunload` event handler when any tab is dirty and removes it when all tabs are clean.

Multi-tab close operations (Close Others, Close Tabs to the Right) iterate through target tabs and prompt for each dirty tab sequentially. If the user cancels at any point, remaining tabs are not closed.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Closing a dirty tab via close button or Cmd+W shows the unsaved changes modal
- [ ] Save and Close saves then closes; save failure keeps tab open
- [ ] Discard Changes closes without saving
- [ ] Cancel dismisses modal, tab stays open with edits
- [ ] Closing a clean tab is immediate with no prompt
- [ ] Close Others and Close Tabs to the Right prompt for each dirty tab sequentially
- [ ] Cancel during multi-tab close stops remaining closes
- [ ] Electron quit with dirty tabs shows custom modal listing dirty files
- [ ] Save All and Quit saves all dirty files then quits; failure aborts quit
- [ ] Browser quit with dirty tabs triggers native `beforeunload` prompt
- [ ] Quit with no dirty tabs exits immediately
- [ ] All 14 TCs pass
- [ ] No regressions in existing Epics 1–4 functionality
