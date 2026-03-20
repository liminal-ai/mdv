# Epic 2: Document Viewing and Multi-Tab Reading

This epic defines the complete requirements for markdown rendering, multi-tab
document management, the content toolbar, file watching, and in-document
navigation. It serves as the source of truth for the Tech Lead's design work.

---

## User Profile

**Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
**Context:** Browsing and reading markdown files across local workspaces. Opening several documents at once, switching between them, following links between related documents. Working with content that includes images, tables, code blocks, and cross-references.
**Mental Model:** "I click a file, I see it rendered. I open several, I switch between tabs. Links go somewhere useful."
**Key Constraint:** Markdown rendering for viewing happens client-side from server-provided raw content. The rendering core should be structured to also run server-side for future export needs (Epic 4), but the viewing path does not depend on server rendering. No remote services. The viewer must handle real-world markdown — not just pristine samples — gracefully.

---

## Feature Overview

This feature makes the app usable. After it ships, a user can click a markdown
file in the tree and see it rendered in the content area. They can open multiple
documents in tabs, switch between them, and close tabs. Clicking a relative
markdown link opens the target in a new tab. Missing images show a placeholder.
Files that change on disk while open auto-reload. The content toolbar provides
mode indicators, an export dropdown (disabled until Epic 4), and status
information.

Combined with Epic 1 (app shell and workspace browsing), this completes
Milestone 1: a functional markdown viewer worth using daily.

---

## Scope

### In Scope

Document viewing, multi-tab management, the content toolbar, file watching, and
in-document navigation:

- Markdown rendering to HTML: headings, paragraphs, lists (ordered, unordered, nested), task lists (checkboxes), tables, code blocks (monospace — language-aware highlighting is Epic 3), blockquotes, inline formatting (bold, italic, strikethrough, inline code), images (local), horizontal rules, links, raw inline HTML
- Tab behavior: open from tree click / File menu / keyboard shortcut / relative link, switch, close, close others, reuse existing tab for same file
- Content toolbar: Render/Edit mode toggle, "Opens in" default mode picker, Export dropdown, status area (warnings, file info)
- Image handling: local images rendered inline with sensible size constraints, placeholder fallback for missing/broken images
- Relative markdown link navigation: clicking a link to a local `.md` file opens it in a new tab
- File watching: detect when an open file changes on disk and auto-reload the tab
- File path display in menu bar status area
- Recent files tracking: opening a file adds it to the recent files list (data structure owned by Epic 1)
- Tab strip activation: tab strip transitions from Epic 1's empty state to active tab management
- Keyboard shortcuts: close tab, next/previous tab, mode toggle

### Out of Scope

- Mermaid diagram rendering (Epic 3)
- Code syntax highlighting beyond monospace rendering (Epic 3)
- Export functionality (Epic 4) — dropdown is present but disabled
- Edit mode (Epic 5) — toggle is present but Edit is non-functional
- External change conflict resolution (Epic 5) — no conflicts possible without editing; files auto-reload
- Tab limits or tab management UI beyond scroll — revisit if needed in Epic 6
- Search within documents or across files
- Remote image fetching or caching
- Non-markdown file rendering
- Tab drag-to-reorder

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Epic 1 is complete: server, shell, sidebar, workspaces, file tree, themes, session persistence are all in place | Unvalidated | Dev team | Epic 2 builds directly on Epic 1's runtime and UI |
| A2 | markdown-it is the rendering library | Unvalidated | Tech Lead | The first-pass-poc uses markdown-it; confirm or replace during tech design |
| A3 | File watching uses server-side filesystem events, not polling | Unvalidated | Tech Lead | Confirm approach during tech design |
| A4 | The server reads file contents and serves them to the client; the client does not access the filesystem directly | Validated | Architecture decision | Established in PRD and Epic 1 |
| A5 | Tab state (which tabs are open, which is active) does not persist across app restarts for this epic | Unvalidated | Product | May add session tab restore in Epic 6 |
| A6 | Heading anchor IDs follow GitHub-flavored markdown convention (lowercase, hyphens, strip special chars) for compatibility with cross-references | Unvalidated | Tech Lead | Confirm convention during tech design |
| A7 | Rendering happens client-side for the viewing path. The rendering core should be portable to server-side for future export (Epic 4). | Validated | Architecture | See Key Constraint |

---

## Flows & Requirements

### 1. Opening a Document

The user clicks a markdown file in the sidebar tree, selects a file from the
File menu, uses a keyboard shortcut, or clicks a recent file in the empty state.
The file contents are fetched from the server, rendered to HTML, and displayed
in the content area. A new tab appears in the tab strip.

1. User triggers file open (tree click, File > Open, keyboard shortcut, recent file click)
2. Client sends file read request to server
3. Server reads file from disk, returns content and metadata
4. Client renders markdown to HTML
5. Content area displays rendered output
6. Tab strip shows new tab with filename
7. Content toolbar appears (if first document opened this session)
8. File path appears in menu bar status area
9. File is added to recent files list

#### Acceptance Criteria

**AC-1.1:** Clicking a file in the sidebar tree opens it in a new tab with rendered content

- **TC-1.1a: Basic file open from tree**
  - Given: App is running with a root set and file tree visible
  - When: User clicks a `.md` file in the tree
  - Then: A new tab appears with the filename, content area shows rendered markdown
- **TC-1.1b: File open updates content toolbar**
  - Given: No documents are open (empty state)
  - When: User opens the first document
  - Then: Content toolbar appears with Render/Edit toggle, "Opens in" picker, Export dropdown, and status area
- **TC-1.1c: File open updates menu bar status**
  - Given: A document is opened
  - When: Tab is active
  - Then: Menu bar status area shows the file's absolute path, truncated, with full path on hover

**AC-1.2:** A loading indicator is shown while the file is being fetched

- **TC-1.2a: Loading state**
  - Given: User clicks a file to open
  - When: The file read request is in flight
  - Then: The new tab shows a loading indicator (spinner or text) until content renders
- **TC-1.2b: Loading indicator clears on render**
  - Given: File content has been fetched and rendered
  - When: Rendering completes
  - Then: The loading indicator is replaced by the rendered content

**AC-1.3:** Opening the same file twice reuses the existing tab

- **TC-1.3a: Duplicate file open**
  - Given: A file is already open in a tab
  - When: User clicks the same file in the tree
  - Then: The existing tab is activated; no new tab is created
- **TC-1.3b: Duplicate detection uses resolved path**
  - Given: The same file could be reached via different relative paths or symlinks
  - When: User opens a file that resolves to the same underlying file as an open tab
  - Then: The existing tab is activated. Duplicate detection uses the server-resolved canonical path internally, but the tab continues to display the path the user originally opened it from.

**AC-1.4:** Files outside the current root can be opened and viewed normally

- **TC-1.4a: Open file outside root via File > Open**
  - Given: Root is set to /Users/leemoore/code/project-a
  - When: User opens a file at /Users/leemoore/code/project-b/notes.md via File > Open
  - Then: The file opens in a new tab with rendered content. The root does not change. The sidebar tree still shows project-a's files.
- **TC-1.4b: Relative link traverses outside root**
  - Given: A document inside the root links to `../../other-repo/docs/spec.md`
  - When: User clicks the link
  - Then: The linked file opens in a new tab. The root does not change.

**AC-1.5:** Files can be opened via File menu and keyboard shortcut

- **TC-1.5a: File > Open triggers a file picker**
  - Given: App is running
  - When: User selects File > Open or presses the keyboard shortcut
  - Then: A file picker dialog opens, filtered to markdown files (`.md`, `.markdown`)
- **TC-1.5b: Selecting a file from the picker opens it**
  - Given: File picker is open
  - When: User selects a markdown file
  - Then: File opens in a new tab with rendered content
- **TC-1.5c: Cancelling the picker does nothing**
  - Given: File picker is open
  - When: User cancels
  - Then: No tab is opened, app state is unchanged

**AC-1.6:** Opening a file adds it to the recent files list

- **TC-1.6a: Recent file tracking**
  - Given: User opens a file
  - When: File rendering completes
  - Then: The file's path and timestamp are added to the recent files list
- **TC-1.6b: Duplicate recent file updates timestamp**
  - Given: A file is already in the recent files list
  - When: User opens the same file again
  - Then: The existing entry's timestamp is updated; no duplicate entry is created
- **TC-1.6c: Recent files cap**
  - Given: Recent files list has 20 entries
  - When: User opens a 21st unique file
  - Then: The oldest entry is dropped; list stays at 20

**AC-1.7:** Clicking a recent file in the empty state opens it

- **TC-1.7a: Recent file click**
  - Given: App is in empty state with recent files displayed
  - When: User clicks a recent file entry
  - Then: The file opens in a new tab with rendered content
- **TC-1.7b: Missing recent file**
  - Given: A recent file entry points to a file that no longer exists
  - When: User clicks it
  - Then: An error message is shown; the entry is removed from the recent files list

---

### 2. Markdown Rendering

The client receives raw markdown from the server and renders it to HTML for
display. The renderer handles standard markdown constructs. Content that
requires later epics (Mermaid, syntax highlighting) is rendered in a basic
fallback form.

#### Acceptance Criteria

**AC-2.1:** Headings render with correct hierarchy (h1 through h6)

- **TC-2.1a: Heading levels**
  - Given: A document contains headings from h1 to h6
  - When: Document is rendered
  - Then: Each heading renders at the correct visual level with appropriate sizing

**AC-2.2:** Paragraphs, inline formatting, and horizontal rules render correctly

- **TC-2.2a: Inline formatting**
  - Given: A document contains bold, italic, strikethrough, and inline code
  - When: Document is rendered
  - Then: Each formatting type renders with the correct visual treatment
- **TC-2.2b: Horizontal rules**
  - Given: A document contains `---` or `***` or `___` horizontal rules
  - When: Document is rendered
  - Then: A visible horizontal divider appears

**AC-2.3:** Lists render correctly including nested lists

- **TC-2.3a: Ordered and unordered lists**
  - Given: A document contains both ordered and unordered lists
  - When: Document is rendered
  - Then: Ordered lists show sequential numbers; unordered lists show bullets
- **TC-2.3b: Nested lists**
  - Given: A document contains lists nested 3+ levels deep
  - When: Document is rendered
  - Then: Each nesting level is visually indented with appropriate list markers

**AC-2.4:** Tables render with headers and alignment

- **TC-2.4a: Basic table**
  - Given: A document contains a markdown table with headers
  - When: Document is rendered
  - Then: Table renders with a header row visually distinct from body rows
- **TC-2.4b: Column alignment**
  - Given: A table specifies left, center, and right alignment
  - When: Document is rendered
  - Then: Cell content aligns as specified
- **TC-2.4c: Wide tables**
  - Given: A table has many columns exceeding the content area width
  - When: Document is rendered
  - Then: The table scrolls horizontally; it does not overflow or break the layout

**AC-2.5:** Code blocks render in monospace without language-aware highlighting

- **TC-2.5a: Fenced code block**
  - Given: A document contains a fenced code block (triple backticks)
  - When: Document is rendered
  - Then: Content displays in a monospace font with a visually distinct background
- **TC-2.5b: Language hint preserved but not highlighted**
  - Given: A code block specifies a language (e.g., ` ```typescript `)
  - When: Document is rendered
  - Then: The language label may be displayed but no syntax highlighting is applied (deferred to Epic 3)
- **TC-2.5c: Indented code block**
  - Given: A document contains a code block via 4-space indentation
  - When: Document is rendered
  - Then: Content displays in monospace with the same treatment as fenced blocks

**AC-2.6:** Blockquotes render with visual distinction

- **TC-2.6a: Blockquote rendering**
  - Given: A document contains one or more blockquotes
  - When: Document is rendered
  - Then: Blockquotes are visually distinct (e.g., left border, indented, different background)
- **TC-2.6b: Nested blockquotes**
  - Given: A document contains blockquotes nested 2+ levels deep
  - When: Document is rendered
  - Then: Each nesting level is visually distinguishable

**AC-2.7:** Links render and are interactive

- **TC-2.7a: External links**
  - Given: A document contains links to external URLs (http/https)
  - When: User clicks the link
  - Then: The URL opens in the system's default browser
- **TC-2.7b: Anchor links**
  - Given: A document contains internal anchor links (e.g., `[Section](#section-heading)`)
  - When: User clicks the link
  - Then: The view scrolls to the target heading
- **TC-2.7c: Links are visually identifiable**
  - Given: A document contains links
  - When: Document is rendered
  - Then: Links are visually distinct from body text (color, underline on hover) and show a pointer cursor

**AC-2.8:** Task lists render with checkboxes

- **TC-2.8a: Task list rendering**
  - Given: A document contains `- [ ] undone` and `- [x] done` items
  - When: Document is rendered
  - Then: Items render with visible checkbox indicators (checked/unchecked). Checkboxes are read-only (not interactive until Epic 5 editing).

**AC-2.9:** Raw inline HTML is rendered

- **TC-2.9a: Common HTML elements**
  - Given: A document contains `<details>`, `<summary>`, `<br>`, `<kbd>`, `<sup>`, `<sub>` tags
  - When: Document is rendered
  - Then: The HTML elements render as expected
- **TC-2.9b: Script tags are stripped**
  - Given: A document contains `<script>` tags
  - When: Document is rendered
  - Then: Script tags are removed; they do not execute. Other content renders normally.

**AC-2.10:** Empty documents render without error

- **TC-2.10a: Zero-byte file**
  - Given: A `.md` file exists but has no content (0 bytes)
  - When: User opens it
  - Then: An empty content area is shown; no error, no crash. The tab exists and the file can be watched for changes.

**AC-2.11:** Mermaid code blocks render with a placeholder until Epic 3

- **TC-2.11a: Mermaid fallback**
  - Given: A document contains a fenced code block with language `mermaid`
  - When: Document is rendered
  - Then: The block renders as a monospace code block with a subtle indicator that diagram rendering is not yet available

---

### 3. Image Handling

Local images referenced in markdown render inline. Missing or broken images
show a visible placeholder. Images are constrained to sensible sizes within the
content area.

#### Acceptance Criteria

**AC-3.1:** Local images render inline with sensible size constraints

- **TC-3.1a: Relative path image**
  - Given: A document references an image via relative path (e.g., `![alt](./images/diagram.png)`)
  - When: Document is rendered
  - Then: The image is displayed inline, resolved relative to the document's directory
- **TC-3.1b: Absolute path image**
  - Given: A document references an image via absolute path
  - When: Document is rendered
  - Then: The image is displayed inline
- **TC-3.1c: Image size constraint**
  - Given: An image's natural dimensions exceed the content area width
  - When: Document is rendered
  - Then: The image scales down to fit within the content area width while maintaining aspect ratio
- **TC-3.1d: Small images**
  - Given: An image's natural dimensions are smaller than the content area
  - When: Document is rendered
  - Then: The image renders at its natural size; it is not scaled up

**AC-3.2:** Missing or broken images show a visible placeholder

- **TC-3.2a: Missing image file**
  - Given: A document references an image that does not exist on disk
  - When: Document is rendered
  - Then: A visible placeholder is shown indicating the image is missing, including the expected path
- **TC-3.2b: Unsupported image format**
  - Given: A document references a file that is not a renderable image (e.g., `.pdf`, `.psd`)
  - When: Document is rendered
  - Then: A placeholder is shown with the filename
- **TC-3.2c: Missing image warning**
  - Given: A document has one or more missing images
  - When: Document rendering completes
  - Then: The content toolbar status area shows a warning count reflecting the missing images

**AC-3.3:** Remote images are blocked with a visible indicator

- **TC-3.3a: HTTP/HTTPS image reference**
  - Given: A document references an image via `http://` or `https://` URL
  - When: Document is rendered
  - Then: A placeholder is shown indicating that remote images are not loaded, with the URL visible
- **TC-3.3b: Remote image warning**
  - Given: A document has blocked remote images
  - When: Document rendering completes
  - Then: The warning count includes the blocked remote images

---

### 4. Tab Behavior

The tab strip transitions from Epic 1's empty state to active tab management.
Users can open multiple documents, switch between tabs, close tabs, and manage
tab overflow when many documents are open.

#### Acceptance Criteria

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

---

### 5. Relative Markdown Link Navigation

Documents frequently link to other markdown files — related specs, sub-pages,
cross-references. Clicking a relative markdown link opens the target in a new
tab, enabling natural navigation through documentation structures.

#### Acceptance Criteria

**AC-5.1:** Clicking a relative link to a local `.md` file opens it in a new tab

- **TC-5.1a: Relative link navigation**
  - Given: A rendered document contains a link like `[Design](./design.md)` or `[API](../api/endpoints.md)`
  - When: User clicks the link
  - Then: The linked file opens in a new tab with rendered content
- **TC-5.1b: Link with anchor**
  - Given: A rendered document contains a link like `[Section](./other.md#section-name)`
  - When: User clicks the link
  - Then: The linked file opens in a new tab and scrolls to the target heading
- **TC-5.1c: Already-open linked file**
  - Given: The linked file is already open in a tab
  - When: User clicks the link
  - Then: The existing tab is activated (same reuse behavior as tree clicks)

**AC-5.2:** Broken relative links show an error, not a silent failure

- **TC-5.2a: Link to nonexistent file**
  - Given: A rendered document contains a link to a `.md` file that doesn't exist
  - When: User clicks the link
  - Then: An inline error message or toast indicates the file was not found
- **TC-5.2b: Link rendering**
  - Given: A document contains relative markdown links
  - When: Document is rendered
  - Then: Links to existing files are visually active; links are not pre-validated (validation happens on click)

**AC-5.3:** Non-markdown relative links open in the system browser

- **TC-5.3a: Relative link to non-markdown file**
  - Given: A rendered document contains a link like `[Diagram](./diagram.svg)` or `[Report](./report.pdf)`
  - When: User clicks the link
  - Then: The file is opened using the system's default handler (not inside the viewer)

---

### 6. Content Toolbar

The content toolbar appears when a document is open. It provides the mode
toggle, default mode picker, export dropdown, and status information. For this
epic, Render mode is functional. Edit and Export are present but non-functional.

#### Acceptance Criteria

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
  - Then: The same "coming soon" tooltip appears as when clicking Edit. No mode change occurs. In Epic 5, this shortcut switches between Render and Edit.

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
  - Then: "Export ▾" button is visible on the right side of the toolbar
- **TC-6.4b: Export dropdown disabled state**
  - Given: User clicks the Export dropdown
  - When: Dropdown opens
  - Then: Export options (PDF, DOCX, HTML) are listed but visually disabled with a note indicating they are coming soon

**AC-6.5:** Status area shows warning count when warnings exist

- **TC-6.5a: Warning count display**
  - Given: A document has rendering warnings (missing images, blocked remote images)
  - When: Document is rendered
  - Then: Status area shows a warning count (e.g., "⚠ 2 warnings")
- **TC-6.5b: Warning count click**
  - Given: Warning count is displayed
  - When: User clicks the warning count
  - Then: A panel or popover lists the individual warnings with details (type, path/URL, line number if available)
- **TC-6.5c: No warnings**
  - Given: A document has no rendering warnings
  - When: Document is rendered
  - Then: No warning indicator is shown in the status area

---

### 7. File Watching and Auto-Reload

Open documents are watched for changes on disk. When a file changes externally
(common with agent workflows that regenerate markdown), the tab auto-reloads
to show the current content. No conflict resolution is needed in this epic
because there is no editing — the on-disk version is always authoritative.

#### Acceptance Criteria

**AC-7.1:** Open files are watched for changes on the server side

- **TC-7.1a: Watch established on file open**
  - Given: User opens a markdown file
  - When: File is loaded and displayed
  - Then: The server establishes a filesystem watch on that file
- **TC-7.1b: Watch released on tab close**
  - Given: A file is open and being watched
  - When: User closes the tab
  - Then: The filesystem watch is released

**AC-7.2:** When a watched file changes on disk, the tab auto-reloads

- **TC-7.2a: External file change**
  - Given: A file is open in a tab
  - When: The file is modified on disk by an external process
  - Then: The tab re-fetches the file content and re-renders; the update is visible
- **TC-7.2b: Debounced reload**
  - Given: A file is being rapidly modified (e.g., agent writing incrementally)
  - When: Multiple filesystem events fire in quick succession
  - Then: The reload is debounced; the tab updates once after changes settle (not on every event)
- **TC-7.2c: Scroll position on reload**
  - Given: User is scrolled partway through a document
  - When: File changes on disk and tab auto-reloads
  - Then: The scroll position is preserved. If the document length changed, the view remains at approximately the same percentage through the document.

**AC-7.3:** File deletion while tab is open shows a clear indicator

- **TC-7.3a: File deleted**
  - Given: A file is open in a tab
  - When: The file is deleted on disk
  - Then: The tab shows a clear "file not found" indicator; the content remains visible as last-known state
- **TC-7.3b: File restored after deletion**
  - Given: A tab is showing "file not found" state
  - When: The file is recreated at the same path
  - Then: The tab detects the new file and offers to reload

**AC-7.4:** File watching does not interfere with app performance

- **TC-7.4a: Many watched files**
  - Given: 20 tabs are open, each watching a different file
  - When: User interacts with the app
  - Then: UI remains responsive; filesystem watches do not cause noticeable CPU or memory overhead

---

### 8. File Path Display

The currently active document's file path is shown in the menu bar status area,
providing context for which file is being viewed.

#### Acceptance Criteria

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

---

### 9. Error Handling

File operations can fail when opening, reading, or watching documents. Errors
are surfaced clearly — never swallowed.

#### Acceptance Criteria

**AC-9.1:** File read failure produces a visible error

- **TC-9.1a: Permission denied**
  - Given: User clicks a file in the tree that they don't have read permission on
  - When: Client requests the file content
  - Then: An error is shown in the content area or as a toast; no empty tab lingers
- **TC-9.1b: File disappeared between tree load and click**
  - Given: A file was visible in the tree
  - When: User clicks it but the file has been deleted since the tree was last scanned
  - Then: An error is shown; the tree refreshes to remove the stale entry

**AC-9.2:** Malformed markdown renders gracefully, not with a crash or blank screen

- **TC-9.2a: Unclosed formatting**
  - Given: A document contains unclosed bold, italic, or code formatting
  - When: Document is rendered
  - Then: The renderer handles it gracefully — best-effort rendering, no crash
- **TC-9.2b: Extremely long lines**
  - Given: A document contains lines exceeding 10,000 characters
  - When: Document is rendered
  - Then: Lines wrap or scroll; the layout does not break
- **TC-9.2c: Binary or non-text file**
  - Given: A file with a `.md` extension contains binary content
  - When: User opens it
  - Then: An error or fallback is shown; the app does not crash

**AC-9.3:** Server errors during file operations produce user-visible feedback

- **TC-9.3a: Server unreachable**
  - Given: The server process crashes or becomes unresponsive
  - When: Client attempts to open a file or reload
  - Then: A clear error indicates the server connection was lost
- **TC-9.3b: File read timeout**
  - Given: A file read takes unusually long (e.g., network-mounted filesystem)
  - When: A reasonable timeout elapses
  - Then: The request fails with a visible timeout error rather than hanging indefinitely

---

## Data Contracts

### File Content API

```typescript
interface FileReadRequest {
  path: string;       // absolute path to the markdown file
}

interface FileReadResponse {
  path: string;           // the requested path (what the user clicked / opened)
  canonicalPath: string;  // resolved absolute path (for duplicate detection only — never shown to user)
  filename: string;       // basename (e.g., "architecture.md")
  content: string;        // raw markdown text
  modifiedAt: string;     // ISO 8601 UTC, filesystem modification time
  size: number;           // file size in bytes — used for large file handling (see Tech Design Questions)
}
```

### File Open (via picker)

```typescript
// Uses the same /api/browse pattern from Epic 1, but for files instead of directories

interface FilePickerResponse {
  path: string;       // absolute path to selected file
} | null              // null if user cancelled
```

### Rendered Warning

```typescript
interface RenderWarning {
  type: "missing-image" | "remote-image-blocked" | "unsupported-format";
  source: string;         // the image path or URL from the markdown
  line?: number;          // line number in the source markdown, if available
  message: string;        // human-readable description
}
```

### File Watch Event

```typescript
interface FileChangeEvent {
  path: string;           // absolute path of the changed file
  event: "modified" | "deleted" | "created";
}
```

### Tab State (client-side)

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

### Session State Extension

Epic 1's `SessionState` is extended:

```typescript
interface SessionState {
  // ... all Epic 1 fields ...
  defaultOpenMode: "render" | "edit";  // persisted "Opens in" preference
  // In Epic 2, only "render" is accepted. Epic 5 enables "edit".
  // The type includes "edit" so the field doesn't need to change when Epic 5 ships.
}
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_PATH | Path is not absolute or contains invalid characters |
| 403 | PERMISSION_DENIED | Filesystem permission denied on the requested file |
| 404 | FILE_NOT_FOUND | The requested file does not exist |
| 415 | NOT_MARKDOWN | File does not have a recognized markdown extension |
| 500 | READ_ERROR | Unexpected error reading the file |

### Deferred to Tech Design

The following behaviors require server endpoints whose shape depends on tech design decisions:

- **Image serving**: Local images referenced in markdown must reach the browser. The endpoint shape (proxy, static serve, base64) is determined in tech design. See Tech Design Question 2.
- **External file opening**: Non-markdown relative links (AC-5.3) need the server to invoke the system's default handler. See Tech Design Question 9.

### API Surface (new endpoints for this epic)

All endpoints are local only (localhost). Request/response bodies are JSON.
These extend Epic 1's API surface.

| Method | Path | Request | Success Response | Error | Notes |
|--------|------|---------|-----------------|-------|-------|
| GET | /api/file | `?path={absolute_path}` | `FileReadResponse` | 400, 403, 404, 415, 500 | Read a markdown file's content and metadata |
| POST | /api/file/pick | — | `FilePickerResponse` | 500 | Open server-side file picker filtered to markdown files |
| GET | /api/file/watch | `?path={absolute_path}` | SSE stream of `FileChangeEvent` | 400, 404 | Server-Sent Events stream for file changes; one stream per watched file, or multiplexed |
| PUT | /api/session/default-mode | `{ mode: "render" }` | `SessionState` | 400 | Set the default open mode. Only "render" accepted in Epic 2; Epic 5 enables "edit". |
| POST | /api/session/recent-files | `{ path: string }` | `SessionState` | 400 | Add or update a recent file entry (sets openedAt to now; deduplicates; enforces 20-entry cap) |
| DELETE | /api/session/recent-files | `{ path: string }` | `SessionState` | 400 | Remove a recent file entry (used when a missing file is clicked and should be cleaned up) |

The file watch endpoint uses Server-Sent Events (SSE) or WebSocket — the tech
lead determines the transport. The contract is: the client receives push
notifications when watched files change, without polling.

---

## Dependencies

Technical dependencies:
- Epic 1 complete: server runtime, app shell, sidebar, file tree, session persistence, themes
- Markdown rendering library (confirmed in tech design)
- Server-side file watching capability (confirmed in tech design)
- Push notification support in Fastify (SSE or WebSocket, confirmed in tech design)

Note: Tab behavior, content rendering, and content toolbar must work at narrow window widths as shown in mockup `06-narrow-window.html`. Compressed tabs, reduced content padding, and sidebar collapse are established by Epic 1; this epic must not break those behaviors.

Process dependencies:
- Epic 1 tech design and Story 0 (foundation) complete before Epic 2 implementation begins

---

## Non-Functional Requirements

### Performance
- File content loads and renders within 1 second for files up to 500KB
- Tab switching is instant (content is cached client-side after first load)
- File watching adds no perceptible UI latency
- Scroll position preservation on tab switch is immediate (no re-render delay)
- Rendering a document with 50 images (some missing) completes within 2 seconds

### Reliability
- Malformed markdown never crashes the renderer — best-effort output always
- File watching recovers from transient filesystem errors without user intervention
- Lost server connection is detected and surfaced within 5 seconds

### Security
- File read API only serves files with recognized markdown extensions
- Image serving is restricted to local filesystem paths; no remote fetch
- File paths are validated and canonicalized server-side to prevent path traversal

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. **Rendering core portability:** Viewing renders client-side (decided). The rendering core should also run server-side for future export (Epic 4). How should the rendering module be structured to support both environments? Shared TypeScript package? Isomorphic module?
2. **Image serving strategy:** Local images referenced in markdown need to reach the browser. Options include a server proxy endpoint (e.g., `/api/image?path=...`), a Fastify static file plugin scoped to the current root, or base64 inlining. Each has trade-offs for performance and security.
3. **File watch transport:** SSE vs WebSocket for push notifications. SSE is simpler and sufficient for one-directional events. WebSocket allows bidirectional communication needed in later epics (editing).
4. **Tab state storage:** Should tab state live entirely in client memory, or should it be partially persisted (e.g., open tabs list) so a page refresh doesn't lose all tabs?
5. **Markdown-it plugins:** Which plugins (if any) should be included for this epic? Task lists (required — see AC-2.8) and footnotes are common. Define the baseline plugin set.
6. **File picker for Open File:** Epic 1 established `/api/browse` for folder picking. Should file picking reuse the same mechanism with a file filter, or is a separate approach needed?
7. **Relative link resolution:** When a document links to `../other/file.md`, resolution depends on the document's own path. Should the client resolve these paths, or should the server provide a resolved-links list with the file content response?
8. **Large file handling:** Should the API enforce a file size limit? `FileReadResponse.size` is available for the client to check before rendering. What happens if someone opens a 50MB markdown file? Options: hard cap with error, truncation with warning, or full render with a performance advisory.
9. **External file opening:** AC-5.3 requires non-markdown relative links to open with the system's default handler. In a browser-based app, this requires a server-side `open` invocation. What endpoint shape? What security constraints (e.g., only open files under the root, or any local file)?
10. **Theme compatibility with rendered markdown:** Rendered HTML inherits the active theme. How should the rendering output reference theme variables (CSS custom properties)? The rendered content needs correct link colors, code block backgrounds, table borders, and blockquote styling across all 4 themes. Should the renderer produce semantic HTML and let CSS handle theming, or does it need theme-aware class names?
11. **Heading anchor ID convention:** A6 assumes GitHub-flavored markdown convention for heading IDs. Confirm or specify the exact algorithm (lowercase, hyphens, strip special chars, deduplicate with suffix).
12. **Raw HTML sanitization:** AC-2.9 requires rendering common inline HTML while stripping `<script>` tags. What sanitization approach? Allow-list of safe tags? A sanitization library? What about `<iframe>`, `<style>`, event handlers (`onclick`)?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

Types, interfaces, and test fixtures needed by all Epic 2 stories.

- `FileReadResponse`, `FileReadRequest`, `RenderWarning`, `FileChangeEvent`, `TabState` type definitions
- `SessionState` extension with `defaultOpenMode`
- Test fixtures: sample markdown files covering each rendering construct (headings, lists, task lists, tables, code blocks, images, links, blockquotes, horizontal rules, raw HTML)
- Test fixtures: files with edge cases (missing images, remote image references, malformed markdown, very long lines, binary `.md` file, empty 0-byte file, file with script tags)
- Server endpoint stubs for `/api/file`, `/api/file/pick`, `/api/file/watch`, `/api/session/default-mode`
- Error response types for new error codes

### Story 1: File Read API and Basic Document Opening
**Delivers:** User can click a file in the tree and see raw content loaded (not yet rendered). Loading indicator shows during fetch. Recent files are tracked.
**Prerequisite:** Story 0, Epic 1 complete
**ACs covered:**
- AC-1.1 (file open from tree — content loading part)
- AC-1.2 (loading indicator during fetch)
- AC-1.3 (duplicate tab detection)
- AC-1.4 (files outside root open normally)
- AC-1.5 (File menu / keyboard open)
- AC-1.6 (recent files tracking)
- AC-1.7 (recent file click in empty state)
- AC-9.1 (file read errors)
- AC-9.3 (server error feedback)

**Estimated test count:** 16 tests

### Story 2: Markdown Rendering
**Delivers:** Opened documents display as rendered HTML instead of raw markdown
**Prerequisite:** Story 1
**ACs covered:**
- AC-2.1 (headings)
- AC-2.2 (paragraphs, inline formatting, horizontal rules)
- AC-2.3 (lists)
- AC-2.4 (tables)
- AC-2.5 (code blocks)
- AC-2.6 (blockquotes)
- AC-2.7 (links — rendering and external link behavior)
- AC-2.8 (task lists)
- AC-2.9 (raw inline HTML)
- AC-2.10 (empty document)
- AC-2.11 (Mermaid placeholder)
- AC-9.2 (malformed markdown)

**Estimated test count:** 22 tests

### Story 3: Image Handling
**Delivers:** Images in markdown render inline with proper sizing; missing/broken/remote images show appropriate placeholders and warnings
**Prerequisite:** Story 2
**ACs covered:**
- AC-3.1 (local image rendering with size constraints)
- AC-3.2 (missing/broken image placeholders and warnings)
- AC-3.3 (blocked remote images)
- AC-6.5 (warning count in status area)

**Estimated test count:** 10 tests

### Story 4: Tab Management
**Delivers:** Full multi-tab behavior — open, switch, close, close others, close right, copy path, overflow scroll, keyboard navigation
**Prerequisite:** Story 1
**ACs covered:**
- AC-4.1 (tab creation, insertion position, and labels)
- AC-4.2 (tab switching with scroll position preservation)
- AC-4.3 (close, close others, close right, copy path, last tab)
- AC-4.4 (overflow scroll, count indicator)
- AC-4.5 (keyboard shortcuts)

**Estimated test count:** 18 tests

### Story 5: Content Toolbar and Status
**Delivers:** Content toolbar with mode toggle, default mode picker, export dropdown, file path display, and status area
**Prerequisite:** Story 2 (needs rendered content to show)
**ACs covered:**
- AC-6.1 (toolbar visibility)
- AC-6.2 (render/edit mode toggle, including keyboard shortcut)
- AC-6.3 (default mode picker)
- AC-6.4 (export dropdown — disabled)
- AC-8.1 (file path display)
- AC-1.1 (content toolbar appears on first document open — TC-1.1b)
- AC-1.1 (menu bar status path — TC-1.1c)

**Estimated test count:** 10 tests

### Story 6: Relative Link Navigation
**Delivers:** Clicking relative markdown links opens the target file in a new tab; broken links show errors; non-markdown links open externally
**Prerequisite:** Story 2, Story 4
**ACs covered:**
- AC-5.1 (relative link opens in new tab)
- AC-5.2 (broken link error handling)
- AC-5.3 (non-markdown links open externally)

**Estimated test count:** 8 tests

### Story 7: File Watching and Auto-Reload
**Delivers:** Open files are watched for changes; tabs auto-reload when files change on disk; deleted files show clear state
**Prerequisite:** Story 1
**ACs covered:**
- AC-7.1 (watch lifecycle)
- AC-7.2 (auto-reload with debounce and scroll preservation)
- AC-7.3 (file deletion and restoration)
- AC-7.4 (performance with many watches)

**Estimated test count:** 10 tests

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
- [x] Stories sequence logically (read before write, happy before edge)
- [x] All dependencies on Epic 1 are explicit
- [x] Handoff points to future epics are documented (Edit mode → Epic 5, Export → Epic 4, Mermaid → Epic 3)
- [x] "Opens in" picker correctly constrains Edit as disabled until Epic 5
- [x] Rendering location decided (client-side for viewing) and consistent across key constraint, flow, and contracts
- [x] Path identity consistent with Epic 1 symlink contract (requested path for display, canonical for dedup)
- [x] Image serving and external file opening explicitly deferred to tech design with requirements stated
- [x] PRD Feature 3 boundary updated to reflect Epic 2's baseline rendering coverage
- [x] Self-review complete
- [x] External review (Codex) findings addressed
