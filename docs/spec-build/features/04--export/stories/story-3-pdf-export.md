# Story 3: PDF Export

### Summary
<!-- Jira: Summary field -->

PDF export with readable typography, margins, intelligent page breaks, embedded images, Mermaid diagrams, syntax-highlighted code blocks, links, blockquotes, and horizontal rules.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user has reviewed a rendered document in the viewer and needs to share it with someone who does not work in markdown — a stakeholder, a compliance reviewer, a client. They need the output in a format the recipient can open without tooling.
- **Mental Model:** "I click Export, pick a format, and get a good file. I don't want to configure anything."
- **Key Constraint:** Export runs locally — no cloud conversion services. Good defaults matter more than configurability. The exported output should closely match what the user sees in the viewer.

**Objective:** A user can export a document to PDF and receive output with readable typography, good defaults (margins, page size), intelligent page breaks, embedded images, rendered Mermaid diagrams, syntax-highlighted code blocks, clickable external links, blockquotes, and horizontal rules.

**Scope — In:**
- PDF generation engine integration
- Default page layout (A4 or US Letter), margins, typography
- Page break intelligence (headings with paragraphs, table rows, code blocks, images)
- Mermaid diagrams rendered as images/SVGs in PDF
- Failed Mermaid fallback in PDF (raw source with error banner)
- Syntax-highlighted code blocks in PDF
- Embedded local images with scaling
- Missing image placeholders in PDF
- Clickable external links in PDF
- Relative markdown links rendered as text (not clickable) in PDF
- Blockquotes and horizontal rules in PDF

**Scope — Out:**
- Export configuration UI (page size, margins, headers/footers, font choices)
- Theme/color scheme decisions (Story 6 — AC-6.2)
- Content fidelity cross-format validation (Story 6)

**Dependencies:** Story 2

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-3.1:** PDF has readable typography and margins

- **TC-3.1a: Default margins**
  - Given: A document is exported to PDF
  - When: User opens the PDF
  - Then: The PDF has visible margins on all sides — content does not extend to the page edge and has clear breathing room. The specific margin size is a tech design decision.
- **TC-3.1b: Body text typography**
  - Given: A document with paragraphs, headings, and lists is exported to PDF
  - When: User reads the PDF
  - Then: Body text is legible at normal viewing zoom (not smaller than ~10pt equivalent). Headings are visually distinct by level (larger and/or bolder than body text). Line spacing prevents lines from touching.
- **TC-3.1c: Default page size**
  - Given: A document is exported to PDF with no configuration
  - When: User checks the PDF page size
  - Then: The page size is A4 or US Letter (the specific default is a tech design decision; either is acceptable)

**AC-3.2:** PDF page breaks do not split content in disruptive ways

- **TC-3.2a: Heading stays with first paragraph**
  - Given: A document has a heading followed by a paragraph near the bottom of a page
  - When: Exported to PDF
  - Then: The heading and at least the first few lines of its following paragraph appear on the same page — the heading is not orphaned at the bottom of a page
- **TC-3.2b: Table rows not split mid-row**
  - Given: A document has a table that spans a page break
  - When: Exported to PDF
  - Then: Page breaks occur between rows, not in the middle of a row. Table headers repeat on the new page if supported by the rendering engine.
- **TC-3.2c: Code blocks**
  - Given: A document has a code block near a page boundary
  - When: Exported to PDF
  - Then: Short code blocks (under ~15 lines) are kept together on one page where possible. Long code blocks may break across pages.
- **TC-3.2d: Images not split**
  - Given: A document has an image near a page boundary
  - When: Exported to PDF
  - Then: The image is kept on one page; it is not split across pages

**AC-3.3:** PDF includes rendered Mermaid diagrams

- **TC-3.3a: Mermaid diagram in PDF**
  - Given: A document contains a valid Mermaid diagram
  - When: Exported to PDF
  - Then: The diagram appears in the PDF as a rendered image or embedded SVG, not as raw Mermaid source text
- **TC-3.3b: Failed Mermaid in PDF**
  - Given: A document contains a Mermaid block that failed to render in the viewer
  - When: Exported to PDF
  - Then: The PDF shows the same fallback as the viewer — raw source in a code block with an error banner. A warning is included in the export result.

**AC-3.4:** PDF includes syntax-highlighted code blocks

- **TC-3.4a: Highlighted code in PDF**
  - Given: A document contains code blocks with language tags
  - When: Exported to PDF
  - Then: Code blocks appear with syntax highlighting (colored keywords, strings, comments) matching the viewer's rendering

**AC-3.5:** PDF includes embedded local images

- **TC-3.5a: Local image in PDF**
  - Given: A document references a local image that exists on disk
  - When: Exported to PDF
  - Then: The image appears inline in the PDF. Images wider than the page content area scale down to fit (maintaining aspect ratio). Images smaller than the page width render at natural size.
- **TC-3.5b: Missing image placeholder in PDF**
  - Given: A document references a local image that does not exist
  - When: Exported to PDF
  - Then: A placeholder appears in the PDF (matching the viewer's placeholder). A warning is included in the export result.

**AC-3.6:** PDF includes links, blockquotes, and horizontal rules

- **TC-3.6a: Clickable links in PDF**
  - Given: A document contains external hyperlinks (http/https)
  - When: Exported to PDF
  - Then: Links are clickable in the PDF and open in the system browser
- **TC-3.6b: Blockquotes in PDF**
  - Given: A document contains blockquotes
  - When: Exported to PDF
  - Then: Blockquotes are visually distinct (indented, left border, or different background) consistent with the viewer's rendering
- **TC-3.6c: Horizontal rules in PDF**
  - Given: A document contains horizontal rules
  - When: Exported to PDF
  - Then: Horizontal rules appear as visible dividers between content sections
- **TC-3.6d: Relative markdown links in PDF**
  - Given: A document contains relative links to other .md files
  - When: Exported to PDF
  - Then: Relative markdown links are rendered as text (not clickable) since the linked files are not part of the export. The link text is visible.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

This story integrates the PDF generation engine (Puppeteer, Playwright, or equivalent — confirmed during tech design) with the export pipeline established in Story 2.

The server re-renders from source on disk (A5): reads the markdown file, runs it through the rendering pipeline (markdown-it, Mermaid, syntax highlighting), and converts the rendered HTML to PDF with print-optimized CSS.

Page break CSS rules (e.g., `break-inside: avoid`, `break-after: avoid` on headings) control content splitting behavior.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] PDF generation engine integrated and producing output
- [ ] PDF has readable typography, margins, and sensible page size
- [ ] Page breaks avoid splitting headings from paragraphs, table rows, short code blocks, and images
- [ ] Mermaid diagrams render as images/SVGs in PDF; failed Mermaid shows fallback
- [ ] Code blocks have syntax highlighting in PDF
- [ ] Local images embedded with proper scaling; missing images show placeholders
- [ ] External links clickable; relative .md links rendered as text
- [ ] Blockquotes and horizontal rules visually rendered
- [ ] All 16 TCs pass
- [ ] No regressions in existing Epic 1–3 functionality
