# Story 2: Edit Mode Editor

### Summary
<!-- Jira: Summary field -->

Monospace text editor with markdown syntax highlighting, line numbers, cursor position display, standard editing operations, theme adaptation, and scroll position management.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user is reviewing a rendered document and spots something to fix — a typo, a broken link, a section that needs updating. They want to make the edit in place without switching to a separate tool. They may be working alongside AI agents that are also modifying files on disk.
- **Mental Model:** "I see something wrong, I switch to edit mode, I fix it, I save. If something goes wrong — accidental close, external change — the app protects me."
- **Key Constraint:** Editing is secondary to viewing. The editor is for quick corrections and light authoring, not a full IDE replacement. Document safety (no lost work) is non-negotiable.

**Objective:** The user sees a monospace editor with markdown syntax highlighting, line numbers, and cursor position display. Standard editing (type, select, copy/paste/cut, undo/redo) works. The editor adapts to light/dark themes. Scroll position is managed per tab and approximately mapped between modes.

**Scope — In:**
- Editor component integration (CodeMirror 6, Monaco, or equivalent)
- Markdown syntax highlighting: headings, bold, italic, strikethrough, inline code, code blocks, links, lists, tables, blockquotes
- Line numbers in the editor gutter
- Cursor position display (line:column) in content toolbar status area
- Standard text editing: typing, selection, copy/paste/cut, undo/redo
- Undo back to clean state clears dirty indicator
- Light and dark theme adaptation
- Theme switch updates editor without losing position or edits
- Edit mode scroll position preserved per tab
- Best-effort scroll position mapping between Render and Edit modes

**Scope — Out:**
- Save behavior (Story 3)
- Dirty state indicators on tab and toolbar (Story 3 — the editor activates dirty state via content changes, but the visual indicators are Story 3)
- Markdown insert tools (Story 6)

**Dependencies:** Story 1

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

This story implements the editor component integration. The editor component (CodeMirror 6, Monaco, or equivalent — confirmed during tech design) provides:
- Markdown language mode with syntax highlighting
- Line numbers gutter
- Cursor position reporting
- Standard editing keybindings
- Theme API for light/dark adaptation
- Scroll position API

The `cursorPosition` field on `TabState` is populated by the editor:

```typescript
cursorPosition: {
  line: number;               // 1-based
  column: number;             // 1-based
} | null;
```

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Editor component renders markdown with syntax highlighting
- [ ] Line numbers displayed in editor gutter
- [ ] Cursor position (line:column) shown in content toolbar status area and updates on cursor move
- [ ] Typing, selection, copy/paste/cut, undo/redo all work
- [ ] Undo back to clean state clears dirty indicator
- [ ] Editor adapts to light and dark themes
- [ ] Theme switch updates editor colors without losing position or edits
- [ ] Edit mode scroll position preserved per tab across tab switches
- [ ] Mode switch maps scroll position (best-effort)
- [ ] All 14 TCs pass
- [ ] No regressions in existing Epics 1–4 functionality
