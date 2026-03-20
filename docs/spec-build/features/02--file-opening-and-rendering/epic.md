# Epic 2: File Opening and Rendering

This epic defines the complete requirements for opening markdown files, rendering
them to HTML, handling images, and displaying rendered content. It serves as the
source of truth for the Tech Lead's design work.

---

## User Profile

**Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
**Context:** Browsing and reading markdown files across local workspaces. Opening a document to read it rendered. Working with content that includes images, tables, code blocks, and cross-references.
**Mental Model:** "I click a file, I see it rendered. Missing images tell me what's missing, not silently disappear."
**Key Constraint:** Markdown rendering for viewing happens client-side from server-provided raw content. The rendering core should be structured to also run server-side for future export needs, but the viewing path does not depend on server rendering. No remote services. The viewer must handle real-world markdown — not just pristine samples — gracefully.

---

## Feature Overview

This feature makes the app usable. After it ships, a user can click a markdown
file in the tree and see it rendered in the content area. Missing images show a
placeholder. Blocked remote images are indicated. The content toolbar provides
mode indicators and status information. Combined with Epic 1, this completes
a minimal functional markdown viewer.

Multi-tab management, relative link navigation, and file watching ship in
Epics 3 and 4. This epic delivers single-document viewing — one document open
at a time, replacing the previous one when a new file is clicked.

---

## Scope

### In Scope

Document viewing — everything needed to open a file, render it, and display it:

- Markdown rendering to HTML: headings, paragraphs, lists (ordered, unordered, nested), task lists (checkboxes), tables, code blocks (monospace — language-aware highlighting is a later epic), blockquotes, inline formatting (bold, italic, strikethrough, inline code), images (local), horizontal rules, links, raw inline HTML
- File read API: server reads file from disk, returns content and metadata
- File open from tree click, File menu, keyboard shortcut (Cmd+O activates), recent file click
- Single-document viewing: opening a file replaces the current document (no tabs yet)
- Image handling: local images rendered inline with sensible size constraints, placeholder fallback for missing/broken images, blocked remote images with indicator
- Content toolbar: Render/Edit mode toggle (Edit non-functional), "Opens in" default mode picker (Edit disabled), Export dropdown (disabled), status area (warning count)
- File path display in menu bar status area
- Recent files tracking: opening a file adds it to the recent files list
- HTML sanitization: safe inline HTML rendered, script tags stripped
- Keyboard shortcuts: Cmd+O (open file), mode toggle shortcut
- Error handling for file read failures, malformed markdown, server errors

### Out of Scope

- Multi-tab management — open, switch, close, tab strip behavior (Epic 3)
- Duplicate tab detection (Epic 3)
- Relative markdown link navigation as multi-tab behavior (Epic 3). In Epic 2, clicking a relative `.md` link replaces the current document (same as clicking a file in the tree). Epic 3 upgrades this to open in a new tab.
- Tab context menu (Epic 3)
- Tab overflow and keyboard tab navigation (Epic 3)
- Scroll position preservation across tab switches (Epic 3)
- File watching and auto-reload (Epic 4)
- Mermaid diagram rendering (later epic)
- Code syntax highlighting beyond monospace rendering (later epic)
- Export functionality (later epic) — dropdown is present but disabled
- Edit mode (later epic) — toggle is present but Edit is non-functional
- Tab drag-to-reorder
- Remote image fetching or caching
- Non-markdown file rendering
- Search within documents

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Epic 1 is complete: server, shell, sidebar, workspaces, file tree, themes, session persistence are all in place | Unvalidated | Dev team | Epic 2 builds directly on Epic 1's runtime and UI |
| A2 | markdown-it is the rendering library | Unvalidated | Tech Lead | The first-pass-poc uses markdown-it; confirm or replace during tech design |
| A3 | The server reads file contents and serves them to the client; the client does not access the filesystem directly | Validated | Architecture decision | Established in PRD and Epic 1 |
| A4 | Heading anchor IDs follow GitHub-flavored markdown convention (lowercase, hyphens, strip special chars) for compatibility with cross-references | Unvalidated | Tech Lead | Confirm convention during tech design |
| A5 | Rendering happens client-side for the viewing path. The rendering core should be portable to server-side for future export. | Validated | Architecture | See Key Constraint |
| A6 | Without multi-tab, opening a new file replaces the current document. The content area shows one document at a time. The tab strip shows a single tab reflecting the current document, or no tab if no document is open. | Unvalidated | Product | Epic 3 adds full multi-tab. |

---

## Flows & Requirements

### 1. Opening a Document

The user clicks a markdown file in the sidebar tree, selects a file from the
File menu, uses a keyboard shortcut, or clicks a recent file in the empty state.
The file contents are fetched from the server, rendered to HTML, and displayed
in the content area. A single tab shows the current document.

1. User triggers file open (tree click, File > Open, keyboard shortcut, recent file click)
2. Client sends file read request to server
3. Server reads file from disk, returns content and metadata
4. Client renders markdown to HTML
5. Content area displays rendered output
6. Tab strip shows a single tab with the filename (replaces previous if one was open)
7. Content toolbar appears (if first document opened this session)
8. File path appears in menu bar status area
9. File is added to recent files list

#### Acceptance Criteria

**AC-1.1:** Clicking a file in the sidebar tree opens it in the content area with rendered content

- **TC-1.1a: Basic file open from tree**
  - Given: App is running with a root set and file tree visible
  - When: User clicks a `.md` file in the tree
  - Then: Content area shows rendered markdown; a single tab shows the filename
- **TC-1.1b: File open updates content toolbar**
  - Given: No documents are open (empty state)
  - When: User opens the first document
  - Then: Content toolbar appears with Render/Edit toggle, "Opens in" picker, Export dropdown, and status area
- **TC-1.1c: File open updates menu bar status**
  - Given: A document is opened
  - When: Document is displayed
  - Then: Menu bar status area shows the file's absolute path, truncated, with full path on hover
- **TC-1.1d: Opening a new file replaces the current document**
  - Given: A document is already open
  - When: User clicks a different file in the tree
  - Then: The new document replaces the current one in the content area; the tab label updates

**AC-1.2:** A loading indicator is shown while the file is being fetched

- **TC-1.2a: Loading state**
  - Given: User clicks a file to open
  - When: The file read request is in flight
  - Then: The content area shows a loading indicator until content renders
- **TC-1.2b: Loading indicator clears on render**
  - Given: File content has been fetched and rendered
  - When: Rendering completes
  - Then: The loading indicator is replaced by the rendered content

**AC-1.3:** Files outside the current root can be opened and viewed normally

- **TC-1.3a: Open file outside root via File > Open**
  - Given: Root is set to /Users/leemoore/code/project-a
  - When: User opens a file at /Users/leemoore/code/project-b/notes.md via File > Open
  - Then: The file opens with rendered content. The root does not change. The sidebar tree still shows project-a's files.

**AC-1.4:** Files can be opened via File menu and keyboard shortcut

- **TC-1.4a: File > Open triggers a file picker**
  - Given: App is running
  - When: User selects File > Open or presses Cmd+O
  - Then: A file picker dialog opens, filtered to markdown files (`.md`, `.markdown`)
- **TC-1.4b: Selecting a file from the picker opens it**
  - Given: File picker is open
  - When: User selects a markdown file
  - Then: File opens in the content area with rendered content
- **TC-1.4c: Cancelling the picker does nothing**
  - Given: File picker is open
  - When: User cancels
  - Then: No change to the content area, app state is unchanged

**AC-1.5:** Opening a file adds it to the recent files list

- **TC-1.5a: Recent file tracking**
  - Given: User opens a file
  - When: File rendering completes
  - Then: The file's path and timestamp are added to the recent files list
- **TC-1.5b: Duplicate recent file updates timestamp**
  - Given: A file is already in the recent files list
  - When: User opens the same file again
  - Then: The existing entry's timestamp is updated; no duplicate entry is created
- **TC-1.5c: Recent files cap**
  - Given: Recent files list has 20 entries
  - When: User opens a 21st unique file
  - Then: The oldest entry is dropped; list stays at 20

**AC-1.6:** Clicking a recent file in the empty state opens it

- **TC-1.6a: Recent file click**
  - Given: App is in empty state with recent files displayed
  - When: User clicks a recent file entry
  - Then: The file opens with rendered content
- **TC-1.6b: Missing recent file**
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
  - Then: The language label may be displayed but no syntax highlighting is applied (deferred to a later epic)
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
- **TC-2.7d: Relative markdown link replaces current document**
  - Given: A rendered document contains a link like `[Design](./design.md)`
  - When: User clicks the link
  - Then: The linked file replaces the current document in the content area (same behavior as clicking a file in the tree). Epic 3 upgrades this to open in a new tab.
- **TC-2.7e: Broken relative markdown link**
  - Given: A rendered document contains a link to a `.md` file that doesn't exist
  - When: User clicks the link
  - Then: An error message is shown; the current document remains displayed
- **TC-2.7f: Non-markdown relative link**
  - Given: A rendered document contains a link like `[Diagram](./diagram.svg)`
  - When: User clicks the link
  - Then: The link is not handled by the viewer (no action in Epic 2; Epic 3 adds system handler opening via server endpoint)

**AC-2.8:** Task lists render with checkboxes

- **TC-2.8a: Task list rendering**
  - Given: A document contains `- [ ] undone` and `- [x] done` items
  - When: Document is rendered
  - Then: Items render with visible checkbox indicators (checked/unchecked). Checkboxes are read-only (not interactive until editing epic).

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
  - Then: An empty content area is shown; no error, no crash.

**AC-2.11:** Mermaid code blocks render with a placeholder until a later epic

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

### 4. Content Toolbar

The content toolbar appears when a document is open. It provides the mode
toggle, default mode picker, export dropdown, and status information. For this
epic, Render mode is functional. Edit and Export are present but non-functional.

#### Acceptance Criteria

**AC-4.1:** Content toolbar appears when a document is open and hides when no document is open

- **TC-4.1a: Toolbar visibility with document**
  - Given: A document is open
  - When: User views the content area
  - Then: Content toolbar is visible between the tab area and the rendered content
- **TC-4.1b: Toolbar hidden in empty state**
  - Given: No document is open
  - When: User views the content area
  - Then: Content toolbar is not visible; empty state is shown

**AC-4.2:** Render/Edit mode toggle shows Render as active, Edit as present but non-functional

- **TC-4.2a: Render mode active**
  - Given: A document is open
  - When: User views the content toolbar
  - Then: Render button is visually active; Edit button is present but visually dimmed or marked as unavailable
- **TC-4.2b: Edit button indicates future availability**
  - Given: A document is open
  - When: User clicks the Edit button
  - Then: A tooltip appears indicating that edit mode is coming soon. No mode change occurs.

**AC-4.3:** "Opens in" default mode picker is present with Edit disabled

- **TC-4.3a: Default mode picker display**
  - Given: A document is open
  - When: User views the content toolbar
  - Then: "Opens in: Render ▾" dropdown is visible to the right of the mode toggle
- **TC-4.3b: Edit option disabled**
  - Given: User clicks the "Opens in" dropdown
  - When: Dropdown opens
  - Then: Render is selectable and active. Edit is listed but visually disabled with a "coming soon" indicator.
- **TC-4.3c: Default mode persistence**
  - Given: Default mode is set to Render
  - When: App is restarted
  - Then: The default mode persists (stored in session state).

**AC-4.4:** Export dropdown is present but non-functional

- **TC-4.4a: Export dropdown display**
  - Given: A document is open
  - When: User views the content toolbar
  - Then: "Export ▾" button is visible on the right side of the toolbar
- **TC-4.4b: Export dropdown disabled state**
  - Given: User clicks the Export dropdown
  - When: Dropdown opens
  - Then: Export options (PDF, DOCX, HTML) are listed but visually disabled with a note indicating they are coming soon

**AC-4.5:** Status area shows warning count when warnings exist

- **TC-4.5a: Warning count display**
  - Given: A document has rendering warnings (missing images, blocked remote images)
  - When: Document is rendered
  - Then: Status area shows a warning count (e.g., "⚠ 2 warnings")
- **TC-4.5b: Warning count click**
  - Given: Warning count is displayed
  - When: User clicks the warning count
  - Then: A panel or popover lists the individual warnings with details (type, path/URL, line number if available)
- **TC-4.5c: No warnings**
  - Given: A document has no rendering warnings
  - When: Document is rendered
  - Then: No warning indicator is shown in the status area

---

### 5. File Path Display

The currently active document's file path is shown in the menu bar status area,
providing context for which file is being viewed.

#### Acceptance Criteria

**AC-5.1:** Active document's file path is displayed in the menu bar

- **TC-5.1a: Path display**
  - Given: A document is open
  - When: User views the menu bar
  - Then: The file's absolute path is shown in the status area, truncated from the left if it exceeds available space
- **TC-5.1b: Full path on hover**
  - Given: A file path is truncated in the menu bar
  - When: User hovers over the truncated path
  - Then: A tooltip shows the complete absolute path
- **TC-5.1c: Path cleared when document is closed**
  - Given: A document is open showing a path
  - When: User opens a different file (replacing the current one) or returns to empty state
  - Then: The path updates to the new file's path, or clears if no document is open

---

### 6. Error Handling

File operations can fail when opening or reading documents. Errors are surfaced
clearly — never swallowed.

#### Acceptance Criteria

**AC-6.1:** File read failure produces a visible error

- **TC-6.1a: Permission denied**
  - Given: User clicks a file in the tree that they don't have read permission on
  - When: Client requests the file content
  - Then: An error is shown in the content area or as a toast; no empty content lingers
- **TC-6.1b: File disappeared between tree load and click**
  - Given: A file was visible in the tree
  - When: User clicks it but the file has been deleted since the tree was last scanned
  - Then: An error is shown; the tree refreshes to remove the stale entry

**AC-6.2:** Malformed markdown renders gracefully, not with a crash or blank screen

- **TC-6.2a: Unclosed formatting**
  - Given: A document contains unclosed bold, italic, or code formatting
  - When: Document is rendered
  - Then: The renderer handles it gracefully — best-effort rendering, no crash
- **TC-6.2b: Extremely long lines**
  - Given: A document contains lines exceeding 10,000 characters
  - When: Document is rendered
  - Then: Lines wrap or scroll; the layout does not break
- **TC-6.2c: Binary or non-text file**
  - Given: A file with a `.md` extension contains binary content
  - When: User opens it
  - Then: An error or fallback is shown; the app does not crash

**AC-6.3:** Server errors during file operations produce user-visible feedback

- **TC-6.3a: Server unreachable**
  - Given: The server process crashes or becomes unresponsive
  - When: Client attempts to open a file
  - Then: A clear error indicates the server connection was lost
- **TC-6.3b: File read timeout**
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
  canonicalPath: string;  // resolved absolute path (for future duplicate detection — Epic 3)
  filename: string;       // basename (e.g., "architecture.md")
  content: string;        // raw markdown text
  modifiedAt: string;     // ISO 8601 UTC, filesystem modification time
  size: number;           // file size in bytes
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

### Session State Extension

Epic 1's `SessionState` is extended:

```typescript
interface SessionState {
  // ... all Epic 1 fields ...
  defaultOpenMode: "render" | "edit";  // persisted "Opens in" preference
  // In Epic 2, only "render" is accepted. A later epic enables "edit".
  // The type includes "edit" so the field doesn't need to change later.
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

- **Image serving**: Local images referenced in markdown must reach the browser. The endpoint shape (proxy, static serve, base64) is determined in tech design.
- **Theme compatibility**: Rendered HTML needs correct styling across all 4 themes via CSS custom properties.

### API Surface (new endpoints for this epic)

| Method | Path | Request | Success Response | Error | Notes |
|--------|------|---------|-----------------|-------|-------|
| GET | /api/file | `?path={absolute_path}` | `FileReadResponse` | 400, 403, 404, 415, 500 | Read a markdown file's content and metadata |
| POST | /api/file/pick | — | `FilePickerResponse` | 500 | Open server-side file picker filtered to markdown files |
| PUT | /api/session/default-mode | `{ mode: "render" }` | `SessionState` | 400 | Set the default open mode. Only "render" accepted in Epic 2. |
| POST | /api/session/recent-files | `{ path: string }` | `SessionState` | 400 | Add or update a recent file entry (already stubbed in Epic 1) |
| DELETE | /api/session/recent-files | `{ path: string }` | `SessionState` | 400 | Remove a recent file entry (already stubbed in Epic 1) |

---

## Dependencies

Technical dependencies:
- Epic 1 complete: server runtime, app shell, sidebar, file tree, session persistence, themes
- Markdown rendering library (confirmed in tech design)

Process dependencies:
- Epic 1 tech design and Story 0 (foundation) complete before Epic 2 implementation begins

---

## Non-Functional Requirements

### Performance
- File content loads and renders within 1 second for files up to 500KB
- Rendering a document with 50 images (some missing) completes within 2 seconds

### Reliability
- Malformed markdown never crashes the renderer — best-effort output always
- Lost server connection is detected and surfaced within 5 seconds

### Security
- File read API only serves files with recognized markdown extensions
- Image serving is restricted to local filesystem paths; no remote fetch
- File paths are validated and canonicalized server-side to prevent path traversal
- Script tags and dangerous HTML are stripped from rendered output

---

## Tech Design Questions

1. **Rendering core portability:** The rendering core should run client-side (viewing) and server-side (future export). How should the rendering module be structured?
2. **Image serving strategy:** Local images need to reach the browser. Options: server proxy endpoint, Fastify static scoped to document directory, base64 inlining. Trade-offs?
3. **markdown-it plugins:** Which plugins for this epic? Task lists (required). Footnotes? Define the baseline plugin set.
4. **File picker for Open File:** Epic 1 established `/api/browse` for folder picking. Reuse with a file filter, or separate approach?
5. **Heading anchor ID convention:** Confirm GFM convention (lowercase, hyphens, strip special chars, deduplicate).
6. **Raw HTML sanitization:** Allow-list of safe tags? Sanitization library? What about `<iframe>`, `<style>`, event handlers?
7. **Large file handling:** Enforce a file size limit? Truncation with warning? Full render with advisory?
8. **Theme compatibility with rendered markdown:** Semantic HTML + CSS custom properties? Theme-aware class names?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

Types, interfaces, and test fixtures for Epic 2.

- `FileReadResponse`, `FileReadRequest`, `RenderWarning` type definitions
- `SessionState` extension with `defaultOpenMode`
- Test fixtures: sample markdown files covering each rendering construct
- Test fixtures: edge cases (missing images, remote refs, malformed markdown, long lines, binary .md, empty file, script tags)
- Server endpoint stubs for `/api/file`, `/api/file/pick`, `/api/session/default-mode`
- Error response types for new error codes

### Story 1: File Read API and Document Opening
**Delivers:** User can click a file and see it loaded (rendered via Story 2). Loading indicator during fetch. File opens from tree, menu, shortcut, recent files. Recent files tracked.
**Prerequisite:** Story 0, Epic 1 complete
**ACs covered:**
- AC-1.1 (file open from tree)
- AC-1.2 (loading indicator)
- AC-1.3 (files outside root)
- AC-1.4 (File menu / keyboard open)
- AC-1.5 (recent files tracking)
- AC-1.6 (recent file click)
- AC-6.1 (file read errors)
- AC-6.3 (server error feedback)

**Estimated test count:** 14-16 tests

### Story 2: Markdown Rendering
**Delivers:** Opened documents display as rendered HTML
**Prerequisite:** Story 1
**ACs covered:**
- AC-2.1 through AC-2.11 (all rendering constructs)
- AC-6.2 (malformed markdown)

**Estimated test count:** 18-22 tests

### Story 3: Image Handling and Warnings
**Delivers:** Images render inline; missing/broken/remote images show placeholders; warning count in status area
**Prerequisite:** Story 2
**ACs covered:**
- AC-3.1 (local images)
- AC-3.2 (missing/broken images)
- AC-3.3 (blocked remote images)
- AC-4.5 (warning count in status area)

**Estimated test count:** 10-12 tests

### Story 4: Content Toolbar and File Path Display
**Delivers:** Content toolbar with mode toggle, default mode picker, export dropdown. File path in menu bar.
**Prerequisite:** Story 2
**ACs covered:**
- AC-4.1 (toolbar visibility)
- AC-4.2 (render/edit toggle)
- AC-4.3 (default mode picker)
- AC-4.4 (export dropdown disabled)
- AC-5.1 (file path display)

**Estimated test count:** 8-10 tests

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
- [x] Stories sequence logically (API → rendering → images → toolbar)
- [x] All dependencies on Epic 1 are explicit
- [x] Handoff points to future epics documented (Edit → later, Export → later, Mermaid → later)
- [x] Multi-tab explicitly out of scope with clear single-document behavior defined
- [x] Self-review complete
