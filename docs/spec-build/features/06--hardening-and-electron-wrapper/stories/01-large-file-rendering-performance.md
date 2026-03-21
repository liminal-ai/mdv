# Story 1: Large File and Rendering Performance

### Summary
<!-- Jira: Summary field -->

Documents over 10,000 lines render, scroll, and edit without freezing the UI. Mode switching on large files is responsive.

### Description
<!-- Jira: Description field -->

**Primary User:** Technical agentic user who works with large AI-generated markdown documents.
**Context:** AI agents produce documents with thousands of lines. The current rendering path blocks the main thread for large HTML strings. CodeMirror 6 already virtualizes editing — the rendered view needs equivalent treatment.

**Objective:** Large documents render via chunked DOM insertion, scroll without hanging, and switch modes within 3 seconds.

**Scope:**

In scope:
- Chunked DOM insertion for rendered HTML (split HTML string, parse/insert in batches via requestAnimationFrame)
- Abort on tab switch during rendering
- Fallback to direct innerHTML for small documents (<200 elements)
- Large file edit mode performance (CodeMirror 6 already handles this — verify, don't re-implement)
- Mode switch performance for large files

Out of scope:
- Virtual scrolling for rendered content (deferred — chunked insertion is sufficient for 10K lines)
- Server-side changes — `MAX_FILE_SIZE` raise from 5MB to 20MB is owned by Story 2

**Dependencies:** Story 0 complete.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1:** Documents over 10,000 lines render without freezing the UI

- **TC-1.1a: Large file render**
  - Given: A markdown file with 10,000 lines containing headings, paragraphs, code blocks, tables, and images
  - When: User opens the file
  - Then: The document renders and is visible within 5 seconds. The UI does not freeze during rendering — the loading indicator is animated throughout.

- **TC-1.1b: Large file scrolling**
  - Given: A 10,000-line document is rendered
  - When: User scrolls through the document
  - Then: Scrolling does not freeze the UI — the page responds to scroll input continuously without multi-second hangs

- **TC-1.1c: Large file with Mermaid**
  - Given: A 10,000-line document contains 5 Mermaid diagrams
  - When: User opens the file
  - Then: The document renders progressively — text content appears first, Mermaid diagrams render asynchronously without blocking the display of surrounding content

**AC-1.2:** Documents over 10,000 lines edit without typing lag

- **TC-1.2a: Large file edit mode**
  - Given: A 10,000-line document is open in Edit mode
  - When: User types
  - Then: Keystrokes appear without perceptible lag (under 50ms)

- **TC-1.2b: Large file mode switch**
  - Given: A 10,000-line document is open
  - When: User switches between Render and Edit modes
  - Then: Mode switch completes within 3 seconds. A loading indicator appears if the switch takes more than 500ms.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**New module:** `client/components/chunked-render.ts`

Splits HTML string at block-level element boundaries, parses each chunk separately (avoiding full-document synchronous parse), and inserts via `requestAnimationFrame()`. Abort via `AbortSignal` on tab switch.

**Modified module:** `client/components/content-area.ts`

Uses `renderChunked()` instead of direct `innerHTML` for documents with `size > 500KB` in the `FileReadResponse`.

**File size limit:** `FileService.MAX_FILE_SIZE` raised from 5MB to 20MB — this change is owned by Story 2. Story 1 depends on it being in place for large file testing.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `npm run verify` passes
- [ ] Chunked rendering activates for documents over 500KB
- [ ] 10K-line document renders without main-thread freeze
- [ ] Loading indicator remains animated during chunked insertion
- [ ] Tab switch during rendering aborts cleanly
- [ ] CodeMirror edit mode responsive at 10K lines (verify existing behavior)
- [ ] Mode switch completes within 3 seconds for 10K-line files
