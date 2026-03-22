# Story 4: Tab Management

### Summary
<!-- Jira: Summary field -->

Full multi-tab behavior — open, switch, close, context menu (close others, close right, copy path), overflow scroll, and keyboard navigation.

### Description
<!-- Jira: Description field -->

**User Profile:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts. Opening several documents at once, switching between them, following links between related documents.

**Objective:** The tab strip transitions from Epic 1's empty state to full tab management. Users can open multiple documents, switch between tabs with scroll position preserved, close tabs individually or in bulk, and navigate tabs via keyboard shortcuts.

**Scope — In:**
- Tab creation at end of strip with filename label
- Disambiguated labels for duplicate filenames across directories
- Tab switching with content area update and menu bar path update
- Scroll position preservation across tab switches
- Tab close via button and keyboard shortcut
- Close last tab returns to empty state
- Tab right-click context menu: Close, Close Others, Close Tabs to the Right, Copy Path
- Horizontal tab strip scrolling when tabs overflow
- Active tab auto-scroll into view
- Tab count indicator during overflow
- Next/previous tab keyboard shortcuts with wrapping

**Scope — Out:**
- Tab drag-to-reorder
- Tab session persistence across restarts (Epic 6)
- Tab limits

**Dependencies:** Story 1 (file open flow creates tabs)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-4.1:** New tabs appear at the end of the tab strip with the document filename

- **TC-4.1a: Tab label**
  - Given: User opens a document
  - When: The tab appears
  - Then: The tab label shows the filename (e.g., `architecture.md`), not the full path
- **TC-4.1b: Tab insertion position**
  - Given: 5 tabs are already open
  - When: User opens a 6th document
  - Then: The new tab appears at the right end of the tab strip and becomes the active tab
- **TC-4.1c: Duplicate filenames**
  - Given: Two documents with the same filename exist in different directories
  - When: Both are opened
  - Then: Tabs show enough path context to distinguish them (e.g., `docs/architecture.md` vs `specs/architecture.md`)

**AC-4.2:** Clicking a tab switches the content area to that document

- **TC-4.2a: Tab switch**
  - Given: Multiple tabs are open
  - When: User clicks an inactive tab
  - Then: Content area shows that tab's rendered document; menu bar status updates to that file's path
- **TC-4.2b: Scroll position preserved**
  - Given: User scrolls partway through a document, switches tabs, then switches back
  - When: The original tab is reactivated
  - Then: The scroll position is restored to where it was

**AC-4.3:** Tabs can be closed via close button and keyboard shortcut

- **TC-4.3a: Close button visibility**
  - Given: Multiple tabs are open
  - When: User hovers over an inactive tab
  - Then: A close button (x) appears; the active tab always shows its close button
- **TC-4.3b: Close tab**
  - Given: A tab is open
  - When: User clicks the close button or uses the keyboard shortcut
  - Then: The tab is removed; the next adjacent tab becomes active
- **TC-4.3c: Close last tab**
  - Given: Only one tab is open
  - When: User closes it
  - Then: The app returns to the empty state (Epic 1's empty content area); content toolbar hides
- **TC-4.3d: Tab right-click context menu**
  - Given: Multiple tabs are open
  - When: User right-clicks a tab
  - Then: Context menu shows: Close, Close Others, Close Tabs to the Right, Copy Path
- **TC-4.3e: Close Others**
  - Given: Multiple tabs are open
  - When: User selects "Close Others" from tab context menu
  - Then: All tabs except the right-clicked tab are closed; the right-clicked tab becomes active
- **TC-4.3f: Close Tabs to the Right**
  - Given: 5 tabs are open, user right-clicks tab 3
  - When: User selects "Close Tabs to the Right"
  - Then: Tabs 4 and 5 are closed; tabs 1, 2, and 3 remain; tab 3 becomes active
- **TC-4.3g: Copy Path from tab**
  - Given: A tab is open
  - When: User selects "Copy Path" from tab context menu
  - Then: The file's absolute path is copied to the clipboard

**AC-4.4:** Tab strip scrolls horizontally when tabs exceed available width

- **TC-4.4a: Tab overflow**
  - Given: More tabs are open than fit in the tab strip width
  - When: User looks at the tab strip
  - Then: The strip is horizontally scrollable; visual indicators (gradient shadows or scroll arrows) hint at off-screen tabs
- **TC-4.4b: Active tab always visible**
  - Given: Many tabs are open and the active tab is off-screen
  - When: User switches to a tab (via keyboard shortcut or other means)
  - Then: The tab strip scrolls to bring the active tab into view
- **TC-4.4c: Tab count indicator**
  - Given: Tabs are overflowing the strip
  - When: User views the tab area
  - Then: A small count indicator shows total open tabs (e.g., "12 tabs")

**AC-4.5:** Keyboard shortcuts navigate between tabs

- **TC-4.5a: Next tab**
  - Given: Multiple tabs are open
  - When: User presses the next-tab shortcut
  - Then: The next tab to the right becomes active; wraps to the first tab if at the end
- **TC-4.5b: Previous tab**
  - Given: Multiple tabs are open
  - When: User presses the previous-tab shortcut
  - Then: The previous tab to the left becomes active; wraps to the last tab if at the beginning

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

```typescript
interface TabState {
  id: string;             // unique tab identifier
  path: string;           // absolute path to the file
  filename: string;       // display name (basename, or disambiguated if needed)
  scrollPosition: number; // vertical scroll offset
  content: string;        // last-fetched raw markdown
  renderedAt: string;     // ISO 8601 UTC, when content was last rendered
  warnings: RenderWarning[];
}
```

Tab state lives in client memory. Tab persistence across restarts is out of scope (deferred to Epic 6).

Design question from epic: Should tab state be partially persisted so a page refresh doesn't lose all tabs? Tech design decides.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Tabs appear at end of strip with correct filename label
- [ ] Duplicate filenames show disambiguated path context
- [ ] Tab switching updates content area and menu bar path
- [ ] Scroll position preserved across tab switches
- [ ] Close button, keyboard shortcut, context menu all work
- [ ] Close last tab returns to empty state
- [ ] Close Others and Close Tabs to the Right work correctly
- [ ] Copy Path copies absolute path to clipboard
- [ ] Overflow tabs scroll horizontally with visual indicators
- [ ] Active tab scrolls into view
- [ ] Tab count indicator shows during overflow
- [ ] Next/previous keyboard shortcuts work with wrapping
- [ ] All 17 TCs pass
