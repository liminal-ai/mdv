# Story 4: Rich Table Content and Error Handling

### Summary
<!-- Jira: Summary field -->

Tables with complex inline content render correctly; rendering errors integrate cleanly with file watching and warning infrastructure.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** Reviewing documents that contain architecture diagrams (Mermaid), code samples across multiple languages, and data-heavy tables with nested content. These are real-world files, not pristine samples — some Mermaid will have syntax errors, some code blocks will lack language tags, some tables will have complex cell content.
- **Mental Model:** "I open a doc, the diagrams render, the code is highlighted, the tables look right. If something can't render, I see what went wrong."
- **Key Constraint:** All rendering is local — no remote services. Mermaid diagrams and syntax highlighting must adapt to the active theme (light/dark).

**Objective:** Tables with inline markdown in cells (bold, italic, code spans, links) render correctly. Tables with many columns or varying content widths maintain stable layout. Content that markdown table syntax cannot represent (nested lists, multi-line cells) degrades gracefully. Rendering errors from Mermaid, images, and code blocks do not crash the app or corrupt other content. File watching auto-reload works correctly with rich content (Mermaid diagrams, syntax-highlighted code).

**Scope — In:**
- Inline markdown in table cells: bold, italic, inline code, strikethrough, links, code spans
- Stable table layout with mixed content widths and many columns
- Horizontal scroll for wide tables at narrow viewports
- Graceful degradation for unsupported table content (list syntax in cells renders as plain text)
- HTML tables with block content render via Epic 2's HTML pass-through
- Pipe characters in cell content do not corrupt table structure
- Multiple failure types in one document: each shows its appropriate fallback
- Mermaid errors in watched files: auto-reload shows error fallback
- Diagram added to watched file: auto-reload renders the new diagram
- Code block language changed in watched file: auto-reload re-highlights with new language

**Scope — Out:**
- Mermaid rendering logic (Story 1)
- Mermaid error handling logic (Story 2)
- Syntax highlighting logic (Story 3)
- Basic table rendering (delivered in Epic 2)

**Dependencies:** Story 0, Epic 2 complete

Note: Table ACs use inline formatting, links, and code spans — all baseline rendering from Epic 2. There is no dependency on Story 1 (Mermaid) or Story 3 (syntax highlighting) for the table portion. The error handling ACs (AC-5.1, AC-5.2) exercise integration across all Epic 3 content types and are best verified after Stories 1–3 are complete, but the table ACs can be implemented independently.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-4.1:** Tables with inline markdown in cells render correctly

- **TC-4.1a: Inline formatting in cells**
  - Given: A table has cells containing bold, italic, inline code, and strikethrough
  - When: Document is rendered
  - Then: Each formatting type renders correctly within the cell
- **TC-4.1b: Links in cells**
  - Given: A table has cells containing markdown links
  - When: Document is rendered
  - Then: Links render as clickable links within the cell, following the same behavior as links in body text (Epic 2 AC-2.7)
- **TC-4.1c: Code spans in cells**
  - Given: A table has cells containing backtick-delimited code spans
  - When: Document is rendered
  - Then: Code spans render in monospace with a distinct background, consistent with inline code elsewhere in the document

**AC-4.2:** Tables with complex content maintain stable layout

- **TC-4.2a: Mixed content widths**
  - Given: A table has columns with varying content widths (short labels in one column, long text in another)
  - When: Document is rendered
  - Then: Column widths adjust to content; no column is collapsed to zero width or excessively wide
- **TC-4.2b: Many columns with complex content**
  - Given: A table has 15+ columns, some containing inline code or formatted text
  - When: Document is rendered
  - Then: The table scrolls horizontally; cell content renders correctly within each cell; no overflow or overlap between cells
- **TC-4.2c: Narrow viewport**
  - Given: A table with 8 columns is displayed in a narrow viewport (sidebar open, small window)
  - When: User views the table
  - Then: The table scrolls horizontally; it does not break the page layout or force the content area to widen

**AC-4.3:** Content that markdown table syntax cannot represent degrades gracefully

- **TC-4.3a: List syntax in a table cell**
  - Given: A table cell contains markdown list syntax (e.g., `- item 1 - item 2` on a single line)
  - When: Document is rendered
  - Then: The content renders as plain text within the cell; the table does not break. The list markers appear as literal characters.
- **TC-4.3b: HTML table with block content**
  - Given: A document contains a raw HTML `<table>` with `<ul>` lists or multi-line `<p>` tags inside cells
  - When: Document is rendered
  - Then: The HTML table renders with its block-level content intact (via Epic 2's raw HTML rendering, AC-2.9)
- **TC-4.3c: Pipe characters in cell content**
  - Given: A table cell contains literal pipe characters (escaped or in inline code)
  - When: Document is rendered
  - Then: The pipe characters display as content, not as column separators; the table structure is not corrupted

**AC-5.1:** Rendering errors do not crash the app or corrupt other content

- **TC-5.1a: Multiple failure types in one document**
  - Given: A document contains a failed Mermaid block, a missing image, and a code block with an unknown language
  - When: Document is rendered
  - Then: Mermaid shows error fallback, image shows placeholder, code block shows plain monospace. The rest of the document renders normally.
- **TC-5.1b: Mermaid error in watched file**
  - Given: A file is open with a valid Mermaid diagram
  - When: An external edit introduces a syntax error in the Mermaid block
  - Then: The tab auto-reloads (per Epic 2 file watching) and the failed block shows the error fallback; the previously rendered diagram is replaced

**AC-5.2:** File watching auto-reload works correctly with rich content

- **TC-5.2a: Diagram added to watched file**
  - Given: A file is open with no Mermaid blocks
  - When: An external edit adds a Mermaid block
  - Then: The tab auto-reloads and the new diagram renders
- **TC-5.2b: Code block language changed in watched file**
  - Given: A file is open with a JavaScript code block
  - When: An external edit changes the language tag to Python
  - Then: The tab auto-reloads and the code block re-highlights with Python syntax

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Table rendering uses Epic 2's markdown-it pipeline. markdown-it handles inline formatting in table cells (bold, italic, code spans, links) as part of its baseline. This story verifies correct behavior under stress: many columns, mixed content widths, and content the syntax cannot represent.

No new types or API endpoints. Table rendering is part of the existing client-side rendering pipeline. Error handling uses Epic 2's `RenderWarning` infrastructure.

File watching integration uses Epic 2's existing SSE-based file watching. Rich content (Mermaid diagrams, syntax-highlighted code) re-renders correctly on auto-reload because the rendering pipeline processes the updated raw markdown from scratch.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Inline formatting (bold, italic, code, strikethrough) renders correctly in table cells
- [ ] Links in table cells are clickable and follow Epic 2 link behavior
- [ ] Code spans in table cells render in monospace with distinct background
- [ ] Tables with mixed content widths have stable column layout
- [ ] Tables with 15+ columns scroll horizontally with correct cell rendering
- [ ] Narrow viewport tables scroll horizontally without breaking page layout
- [ ] List syntax in table cells renders as plain text
- [ ] HTML tables with block content render via Epic 2 HTML pass-through
- [ ] Pipe characters in cells display as content, not column separators
- [ ] Multiple failure types in one document each show appropriate fallback
- [ ] Mermaid errors in watched files show error fallback on auto-reload
- [ ] New Mermaid blocks added to watched files render on auto-reload
- [ ] Code block language changes in watched files re-highlight on auto-reload
- [ ] All 13 TCs pass
- [ ] No regressions in existing Epic 2 functionality
