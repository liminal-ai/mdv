# Epic 3: Multi-Tab and Navigation

This epic defines the complete requirements for multi-tab document management,
relative markdown link navigation, and tab-related keyboard shortcuts. It serves
as the source of truth for the Tech Lead's design work.

---

## User Profile

**Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
**Context:** Working across several related documents simultaneously — specs, design docs, READMEs, cross-referenced notes. Following links between documents. Keeping context open in tabs while exploring related files.
**Mental Model:** "I open several docs, I switch between them, I follow links. Tabs work like a browser."
**Key Constraint:** Tab state does not persist across app restarts for this epic. May add session tab restore later.

---

## Feature Overview

This feature adds multi-tab document management and inter-document navigation.
After it ships, users can open multiple documents in tabs, switch between them,
close tabs individually or in bulk, and follow relative markdown links that open
in new tabs. Tab overflow scrolls horizontally. Keyboard shortcuts navigate
between tabs.

Combined with Epics 1 and 2, this delivers a daily-driver markdown workspace
with full browsing workflow.

---

## Scope

### In Scope

Multi-tab management and inter-document navigation. Epic 2's file-opening
flows (tree click, File menu, keyboard shortcut, recent file click) already
work for single-document viewing. This epic extends them to create tabs
instead of replacing the current document. The open triggers don't change —
the downstream behavior does.

- Tab lifecycle: extends Epic 2's open flows to create tabs instead of replacing; adds switch, close
- Tab strip: labels, close buttons, insertion position, overflow scroll, count indicator
- Duplicate tab detection: same file reuses existing tab (canonical path matching)
- Tab context menu: Close, Close Others, Close Tabs to the Right, Copy Path
- Scroll position preservation per tab (switch away and back)
- Relative markdown link upgrade: Epic 2's "replace current document" behavior upgrades to "open in a new tab"
- Broken relative link error handling (extends Epic 2's basic error with tab-aware behavior)
- Non-markdown relative links open via system handler (new server endpoint: `/api/file/open-external`)
- Keyboard shortcuts: close tab, next/previous tab
- Disambiguated tab labels when filenames collide
- Content toolbar and menu bar status update on tab switch

### Out of Scope

- File watching and auto-reload (Epic 4)
- Tab persistence across restarts
- Tab drag-to-reorder
- Tab pinning
- Split view / side-by-side tabs
- Search across open tabs

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Epic 2 is complete: file opening, rendering, content toolbar, image handling are in place | Unvalidated | Dev team | Epic 3 builds on Epic 2's single-document viewing |
| A2 | Tab state lives entirely in client memory; no server-side tab tracking | Validated | Product | Tab persistence deferred |
| A3 | Duplicate detection uses server-provided `canonicalPath` from `FileReadResponse` | Validated | Architecture | Established in Epic 2's data contract |

---

## Flows & Requirements

### 1. Tab Management

Users open multiple documents. Each opens in a new tab. Switching tabs swaps
the content area. Closing tabs removes them. The tab strip handles overflow.

#### Acceptance Criteria

**AC-1.1:** New tabs appear at the end of the tab strip with the document filename

- **TC-1.1a: Tab label**
  - Given: User opens a document
  - When: The tab appears
  - Then: The tab label shows the filename (e.g., `architecture.md`), not the full path
- **TC-1.1b: Tab insertion position**
  - Given: 5 tabs are already open
  - When: User opens a 6th document
  - Then: The new tab appears at the right end of the tab strip and becomes the active tab
- **TC-1.1c: Duplicate filenames**
  - Given: Two documents with the same filename exist in different directories
  - When: Both are opened
  - Then: Tabs show enough path context to distinguish them (e.g., `docs/architecture.md` vs `specs/architecture.md`)

**AC-1.2:** Opening the same file twice reuses the existing tab

- **TC-1.2a: Duplicate file open**
  - Given: A file is already open in a tab
  - When: User clicks the same file in the tree
  - Then: The existing tab is activated; no new tab is created
- **TC-1.2b: Duplicate detection uses resolved path**
  - Given: The same file could be reached via different relative paths or symlinks
  - When: User opens a file that resolves to the same underlying file as an open tab
  - Then: The existing tab is activated. Duplicate detection uses the server-resolved canonical path internally, but the tab continues to display the path the user originally opened it from.

**AC-1.3:** Clicking a tab switches the content area to that document

- **TC-1.3a: Tab switch**
  - Given: Multiple tabs are open
  - When: User clicks an inactive tab
  - Then: Content area shows that tab's rendered document; menu bar status updates to that file's path; content toolbar warnings update to that document's warnings
- **TC-1.3b: Scroll position preserved**
  - Given: User scrolls partway through a document, switches tabs, then switches back
  - When: The original tab is reactivated
  - Then: The scroll position is restored to where it was

**AC-1.4:** Tabs can be closed via close button and keyboard shortcut

- **TC-1.4a: Close button visibility**
  - Given: Multiple tabs are open
  - When: User hovers over an inactive tab
  - Then: A close button (x) appears; the active tab always shows its close button
- **TC-1.4b: Close tab**
  - Given: A tab is open
  - When: User clicks the close button or uses the keyboard shortcut
  - Then: The tab is removed; the next adjacent tab becomes active
- **TC-1.4c: Close last tab**
  - Given: Only one tab is open
  - When: User closes it
  - Then: The app returns to the empty state (Epic 1's empty content area); content toolbar hides
- **TC-1.4d: Tab right-click context menu**
  - Given: Multiple tabs are open
  - When: User right-clicks a tab
  - Then: Context menu shows: Close, Close Others, Close Tabs to the Right, Copy Path
- **TC-1.4e: Close Others**
  - Given: Multiple tabs are open
  - When: User selects "Close Others" from tab context menu
  - Then: All tabs except the right-clicked tab are closed; the right-clicked tab becomes active
- **TC-1.4f: Close Tabs to the Right**
  - Given: 5 tabs are open, user right-clicks tab 3
  - When: User selects "Close Tabs to the Right"
  - Then: Tabs 4 and 5 are closed; tabs 1, 2, and 3 remain; tab 3 becomes active
- **TC-1.4g: Copy Path from tab**
  - Given: A tab is open
  - When: User selects "Copy Path" from tab context menu
  - Then: The file's absolute path is copied to the clipboard

**AC-1.5:** Tab strip scrolls horizontally when tabs exceed available width

- **TC-1.5a: Tab overflow**
  - Given: More tabs are open than fit in the tab strip width
  - When: User looks at the tab strip
  - Then: The strip is horizontally scrollable; visual indicators (gradient shadows or scroll arrows) hint at off-screen tabs
- **TC-1.5b: Active tab always visible**
  - Given: Many tabs are open and the active tab is off-screen
  - When: User switches to a tab (via keyboard shortcut or other means)
  - Then: The tab strip scrolls to bring the active tab into view
- **TC-1.5c: Tab count indicator**
  - Given: Tabs are overflowing the strip
  - When: User views the tab area
  - Then: A small count indicator shows total open tabs (e.g., "12 tabs")

**AC-1.6:** Keyboard shortcuts navigate between tabs

- **TC-1.6a: Next tab**
  - Given: Multiple tabs are open
  - When: User presses the next-tab shortcut
  - Then: The next tab to the right becomes active; wraps to the first tab if at the end
- **TC-1.6b: Previous tab**
  - Given: Multiple tabs are open
  - When: User presses the previous-tab shortcut
  - Then: The previous tab to the left becomes active; wraps to the last tab if at the beginning

---

### 2. Relative Markdown Link Navigation

Documents frequently link to other markdown files — related specs, sub-pages,
cross-references. Clicking a relative markdown link opens the target in a new
tab, enabling natural navigation through documentation structures.

#### Acceptance Criteria

**AC-2.1:** Clicking a relative link to a local `.md` file opens it in a new tab

- **TC-2.1a: Relative link navigation**
  - Given: A rendered document contains a link like `[Design](./design.md)` or `[API](../api/endpoints.md)`
  - When: User clicks the link
  - Then: The linked file opens in a new tab with rendered content
- **TC-2.1b: Link with anchor**
  - Given: A rendered document contains a link like `[Section](./other.md#section-name)`
  - When: User clicks the link
  - Then: The linked file opens in a new tab and scrolls to the target heading
- **TC-2.1c: Relative link traverses outside root**
  - Given: A document inside the root links to `../../other-repo/docs/spec.md`
  - When: User clicks the link
  - Then: The linked file opens in a new tab. The root does not change. The sidebar tree is unaffected.
- **TC-2.1d: Already-open linked file**
  - Given: The linked file is already open in a tab
  - When: User clicks the link
  - Then: The existing tab is activated (same reuse behavior as tree clicks)

**AC-2.2:** Broken relative links show an error, not a silent failure

- **TC-2.2a: Link to nonexistent file**
  - Given: A rendered document contains a link to a `.md` file that doesn't exist
  - When: User clicks the link
  - Then: An inline error message or toast indicates the file was not found
- **TC-2.2b: Link rendering**
  - Given: A document contains relative markdown links
  - When: Document is rendered
  - Then: Links to existing files are visually active; links are not pre-validated (validation happens on click)

**AC-2.3:** Non-markdown relative links open in the system browser

- **TC-2.3a: Relative link to non-markdown file**
  - Given: A rendered document contains a link like `[Diagram](./diagram.svg)` or `[Report](./report.pdf)`
  - When: User clicks the link
  - Then: The file is opened using the system's default handler (not inside the viewer)

---

### 3. Content Updates on Tab Switch

When the user switches tabs, the content toolbar and menu bar status area
update to reflect the newly active document.

#### Acceptance Criteria

**AC-3.1:** Content toolbar updates on tab switch

- **TC-3.1a: Warning count changes**
  - Given: Tab A has 2 warnings, Tab B has 0 warnings
  - When: User switches from Tab A to Tab B
  - Then: Warning count clears from the status area
- **TC-3.1b: Mode state per tab (future-proofing)**
  - Given: Multiple tabs are open, all in Render mode
  - When: User switches tabs
  - Then: Render mode remains active. (When Edit mode ships, mode may be per-tab.)

**AC-3.2:** Menu bar path updates on tab switch

- **TC-3.2a: Path changes**
  - Given: Tab A shows file-a.md, Tab B shows file-b.md
  - When: User switches from Tab A to Tab B
  - Then: Menu bar status area updates to show file-b.md's path
- **TC-3.2b: Path clears on last tab close**
  - Given: One tab is open
  - When: User closes it
  - Then: Menu bar path area clears

---

## Data Contracts

### Tab State (client-side)

```typescript
interface TabState {
  id: string;             // unique tab identifier
  path: string;           // absolute path to the file (as opened — for display)
  canonicalPath: string;  // resolved path (for duplicate detection)
  filename: string;       // display name (basename, or disambiguated if needed)
  scrollPosition: number; // vertical scroll offset
  content: string;        // last-fetched raw markdown
  renderedHtml: string;   // cached rendered HTML
  renderedAt: string;     // ISO 8601 UTC, when content was last rendered
  warnings: RenderWarning[];  // from Epic 2
}
```

### Tab Manager State (client-side)

```typescript
interface TabManagerState {
  tabs: TabState[];
  activeTabId: string | null;
}
```

Tab state is client-side only and uses existing endpoints from Epics 1 and 2
(file read, clipboard, session). One new server endpoint is required for
opening non-markdown files with the system's default handler.

### API Surface (new endpoint for this epic)

| Method | Path | Request | Success Response | Error | Notes |
|--------|------|---------|-----------------|-------|-------|
| POST | /api/file/open-external | `{ path: string }` | `{ ok: true }` | 400, 404, 500 | Open a local file with the system's default handler (e.g., `open` on macOS). Used for non-markdown relative links (AC-2.3). Path must be absolute. |

---

## Dependencies

Technical dependencies:
- Epic 2 complete: file read API, markdown rendering, content toolbar, image handling
- Epic 1's clipboard API for Copy Path from tab context menu

Process dependencies:
- Epic 2 implementation complete before Epic 3 begins

---

## Non-Functional Requirements

### Performance
- Tab switching is instant (content is cached client-side after first load)
- Scroll position preservation on tab switch is immediate (no re-render delay)
- 20 open tabs do not degrade UI responsiveness

### Reliability
- Closing all tabs returns cleanly to empty state
- Tab context menu operations (Close Others, Close Right) handle edge cases without errors

---

## Tech Design Questions

1. **Tab state architecture:** How does the tab manager integrate with Epic 2's single-document state? What replaces vs extends?
2. **Scroll position storage:** Store as pixel offset, or as percentage? Pixel is simpler but can be wrong if the window resizes between switches.
3. **Relative link resolution:** Client-side resolution using the document's own path, or server endpoint that resolves paths? Client-side is simpler since the client has the document path.
4. **External file opening (AC-2.3):** Non-markdown relative links need the server to invoke the system's default handler. Endpoint shape? Security constraints?
5. **Tab label disambiguation:** Algorithm for showing path context when filenames collide. Show parent directory? Show shortest unique suffix?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

- `TabState`, `TabManagerState` type definitions
- Test fixtures: multiple markdown files for multi-tab scenarios
- Tab manager stub with `NotImplementedError`

### Story 1: Tab Lifecycle
**Delivers:** User can open multiple documents in tabs, switch between them, close tabs.
**Prerequisite:** Story 0, Epic 2 complete
**ACs covered:**
- AC-1.1 (tab creation, labels, insertion)
- AC-1.2 (duplicate detection)
- AC-1.3 (tab switching with scroll preservation)
- AC-1.4 (close, close others, close right, copy path, last tab close)

**Estimated test count:** 14-16 tests

### Story 2: Tab Strip UX
**Delivers:** Tab overflow scrolling, count indicator, keyboard navigation.
**Prerequisite:** Story 1
**ACs covered:**
- AC-1.5 (overflow scroll, active tab visibility, count)
- AC-1.6 (keyboard next/previous)
- AC-3.1 (content toolbar updates on switch)
- AC-3.2 (menu bar path updates on switch)

**Estimated test count:** 8-10 tests

### Story 3: Relative Link Navigation
**Delivers:** Clicking relative markdown links opens in new tab; broken links show errors; non-markdown links open externally.
**Prerequisite:** Story 1
**ACs covered:**
- AC-2.1 (relative link opens in tab)
- AC-2.2 (broken link error)
- AC-2.3 (non-markdown links open externally)

**Estimated test count:** 7-9 tests

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
- [x] Stories sequence logically
- [x] Dependencies on Epics 1 and 2 are explicit
- [x] No overlap with Epic 2 (single-doc) or Epic 4 (file watching)
- [x] Self-review complete
