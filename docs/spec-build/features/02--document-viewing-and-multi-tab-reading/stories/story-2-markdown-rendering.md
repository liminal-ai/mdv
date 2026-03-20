# Story 2: Markdown Rendering

### Summary
<!-- Jira: Summary field -->

Client-side markdown-to-HTML rendering covering all standard constructs, raw HTML sanitization, and graceful handling of malformed content.

### Description
<!-- Jira: Description field -->

**User Profile:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts. Working with content that includes images, tables, code blocks, and cross-references.

**Objective:** Opened documents display as rendered HTML instead of raw markdown. The renderer handles all standard markdown constructs. Content requiring later epics (Mermaid, syntax highlighting) renders in basic fallback form. Malformed markdown never crashes the renderer.

**Scope — In:**
- Markdown-to-HTML rendering: headings, paragraphs, lists (ordered, unordered, nested), task lists, tables, code blocks (monospace), blockquotes, inline formatting (bold, italic, strikethrough, inline code), horizontal rules, links, raw inline HTML
- HTML sanitization (script tag stripping)
- Mermaid code block fallback (monospace placeholder)
- Empty document handling
- Malformed markdown graceful degradation (unclosed formatting, extreme line lengths, binary .md files)
- External link click opens system browser
- Anchor link click scrolls to heading

**Scope — Out:**
- Image rendering and placeholders (Story 3)
- Syntax highlighting (Epic 3)
- Mermaid diagram rendering (Epic 3)
- Link navigation to other files (Story 6 — links render as clickable but cross-file navigation is Story 6)

**Dependencies:** Story 1 (file content is loaded and available)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

The rendering module lives client-side for the viewing path. It should be structured as an isomorphic module that can also run server-side for future export (Epic 4).

Key design decisions deferred to tech design:
- Rendering library selection (markdown-it assumed per A2)
- Plugin set for this epic (task lists required per AC-2.8)
- HTML sanitization approach for AC-2.9 (allow-list of safe tags)
- Heading anchor ID convention (A6 — GitHub-flavored convention assumed)
- Theme compatibility — rendered HTML references CSS custom properties for correct colors across all 4 themes

No new server endpoints in this story. The rendering happens entirely client-side using `FileReadResponse.content` from Story 1.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All standard markdown constructs render correctly (headings, paragraphs, lists, tables, code blocks, blockquotes, inline formatting, horizontal rules)
- [ ] Task lists render with read-only checkboxes
- [ ] Raw HTML renders with script tags stripped
- [ ] External links open in system browser
- [ ] Anchor links scroll to target heading
- [ ] Wide tables scroll horizontally without breaking layout
- [ ] Empty documents, malformed markdown, and binary .md files all handled gracefully
- [ ] Mermaid blocks show placeholder
- [ ] Rendered output respects active theme (all 4 themes)
- [ ] All 24 TCs pass
