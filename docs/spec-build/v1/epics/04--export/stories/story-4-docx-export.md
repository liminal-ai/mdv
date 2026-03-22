# Story 4: DOCX Export

### Summary
<!-- Jira: Summary field -->

DOCX export with structured headings, body text formatting, tables, code blocks, embedded images, Mermaid diagrams, links, blockquotes, and horizontal rules.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user has reviewed a rendered document in the viewer and needs to share it with someone who does not work in markdown — a stakeholder, a compliance reviewer, a client. They need the output in a format the recipient can open without tooling.
- **Mental Model:** "I click Export, pick a format, and get a good file. I don't want to configure anything."
- **Key Constraint:** Export runs locally — no cloud conversion services. Good defaults matter more than configurability. The exported output should closely match what the user sees in the viewer.

**Objective:** A user can export a document to DOCX and receive output with structured Word headings (enabling the navigation pane), preserved inline formatting, tables, code blocks in monospace, embedded images, Mermaid diagrams as images, clickable external links, blockquotes, and horizontal rules.

**Scope — In:**
- DOCX generation engine integration
- Heading levels h1–h6 mapped to Word heading styles
- Body text with inline formatting (bold, italic, inline code)
- Ordered and unordered lists with nesting
- Tables with header rows and inline cell formatting
- Code blocks in monospace font with syntax highlighting where supported
- Embedded local images and Mermaid diagrams as images
- Missing image placeholders in DOCX
- Clickable external links; relative markdown links as text
- Blockquotes and horizontal rules

**Scope — Out:**
- Export configuration UI
- Theme/color scheme decisions (Story 6 — AC-6.2)
- Content fidelity cross-format validation (Story 6)

**Dependencies:** Story 2

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-4.1:** DOCX has structured headings and readable body text

- **TC-4.1a: Heading levels**
  - Given: A document has headings from h1 to h4
  - When: Exported to DOCX
  - Then: Each heading maps to the corresponding Word heading style (Heading 1 through Heading 4), enabling the DOCX navigation pane
- **TC-4.1b: Body text**
  - Given: A document has paragraphs with inline formatting (bold, italic, inline code)
  - When: Exported to DOCX
  - Then: Inline formatting is preserved in the DOCX output
- **TC-4.1c: Lists**
  - Given: A document has ordered and unordered lists, including nested lists
  - When: Exported to DOCX
  - Then: Lists render with proper numbering/bullets and indentation levels

**AC-4.2:** DOCX includes tables

- **TC-4.2a: Basic table**
  - Given: A document has a markdown table with headers and body rows
  - When: Exported to DOCX
  - Then: The table appears in the DOCX with header row visually distinct from body rows
- **TC-4.2b: Table with inline content**
  - Given: A table has cells with inline formatting and code spans
  - When: Exported to DOCX
  - Then: Cell content formatting is preserved

**AC-4.3:** DOCX includes code blocks

- **TC-4.3a: Code block in DOCX**
  - Given: A document has fenced code blocks
  - When: Exported to DOCX
  - Then: Code blocks appear in a monospace font with a visually distinct background. Syntax highlighting colors are included where the DOCX format supports it.

**AC-4.4:** DOCX includes embedded images and Mermaid diagrams

- **TC-4.4a: Local image in DOCX**
  - Given: A document references a local image
  - When: Exported to DOCX
  - Then: The image is embedded in the DOCX file (not linked externally)
- **TC-4.4b: Mermaid diagram in DOCX**
  - Given: A document contains a rendered Mermaid diagram
  - When: Exported to DOCX
  - Then: The diagram appears as an embedded image in the DOCX
- **TC-4.4c: Missing image in DOCX**
  - Given: A document references a missing image
  - When: Exported to DOCX
  - Then: A placeholder appears. A warning is included in the export result.

**AC-4.5:** DOCX includes links, blockquotes, and horizontal rules

- **TC-4.5a: Clickable external links in DOCX**
  - Given: A document contains external hyperlinks (http/https)
  - When: Exported to DOCX
  - Then: Links are clickable Word hyperlinks
- **TC-4.5b: Relative markdown links in DOCX**
  - Given: A document contains relative links to other .md files
  - When: Exported to DOCX
  - Then: Relative markdown links render as visible text (not clickable). The link text is preserved.
- **TC-4.5c: Blockquotes in DOCX**
  - Given: A document contains blockquotes
  - When: Exported to DOCX
  - Then: Blockquotes are visually distinct (indented or styled differently from body text)
- **TC-4.5d: Horizontal rules in DOCX**
  - Given: A document contains horizontal rules
  - When: Exported to DOCX
  - Then: Horizontal rules appear as visible dividers

**AC-4.6:** DOCX heading levels h5 and h6 are handled

- **TC-4.6a: Deep heading levels**
  - Given: A document has headings h1 through h6
  - When: Exported to DOCX
  - Then: h1–h4 map to Word Heading 1–4. h5 and h6 map to Heading 5 and 6 if available, or render as styled body text visually distinct from normal paragraphs.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

This story integrates the DOCX generation engine (docx library, Pandoc, or HTML-to-DOCX converter — confirmed during tech design) with the export pipeline established in Story 2.

The server re-renders from source on disk (A5): reads the markdown file, runs it through the rendering pipeline, and converts to DOCX format with structured heading styles.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] DOCX generation engine integrated and producing output
- [ ] Headings h1–h4 map to Word heading styles; h5–h6 handled gracefully
- [ ] Body text preserves inline formatting (bold, italic, inline code)
- [ ] Lists render with proper numbering/bullets and nesting
- [ ] Tables render with visually distinct header rows and preserved cell formatting
- [ ] Code blocks in monospace with syntax highlighting where supported
- [ ] Local images and Mermaid diagrams embedded; missing images show placeholders
- [ ] External links clickable; relative .md links rendered as text
- [ ] Blockquotes and horizontal rules visually rendered
- [ ] All 14 TCs pass
- [ ] No regressions in existing Epic 1–3 functionality
