# Story 6: Content Fidelity and Edge Cases

### Summary
<!-- Jira: Summary field -->

Cross-format content fidelity validation, export theme rules, raw HTML element handling, no-hidden-content guarantee, and edge case handling for large, degraded, empty, and mid-export-modified documents.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user has reviewed a rendered document in the viewer and needs to share it with someone who does not work in markdown — a stakeholder, a compliance reviewer, a client. They need the output in a format the recipient can open without tooling.
- **Mental Model:** "I click Export, pick a format, and get a good file. I don't want to configure anything."
- **Key Constraint:** Export runs locally — no cloud conversion services. Good defaults matter more than configurability. The exported output should closely match what the user sees in the viewer.

**Objective:** Export output consistently reflects the viewer's rendered state across all three formats. PDF and DOCX use a light color scheme (sharing/printing formats). HTML preserves the active viewer theme (portable viewer format). Raw HTML elements export with best-effort equivalents. Edge cases — very large documents, fully degraded documents, empty documents, and files modified during export — are handled gracefully.

**Scope — In:**
- Viewer/export consistency for degraded content (missing images, blocked remote images, failed Mermaid)
- Task list checkbox export
- PDF/DOCX light color scheme enforcement
- HTML theme preservation (active viewer theme)
- Raw HTML element export (`<details>/<summary>`, `<kbd>`, `<sup>`, `<sub>`, `<br>`)
- `format-degradation` warning for content simplified in PDF/DOCX
- No-hidden-content guarantee
- Edge cases: very large document, fully degraded document, empty document, source file changes during export

**Scope — Out:**
- Format-specific rendering engines (already delivered in Stories 3–5)
- Export trigger and save dialog (Story 1)
- Progress/success/error handling (Story 2)

**Dependencies:** Stories 3, 4, 5

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-6.1:** Export reflects the viewer's rendered state, including degraded content

- **TC-6.1a: Consistent degraded content**
  - Given: A document has 2 missing images and 1 failed Mermaid block in the viewer
  - When: Exported to any format
  - Then: The export contains the same 2 image placeholders and 1 Mermaid fallback that the viewer shows
- **TC-6.1b: Blocked remote images in export**
  - Given: A document has blocked remote image references in the viewer
  - When: Exported to any format
  - Then: The export shows the same "remote image blocked" placeholder as the viewer
- **TC-6.1c: Task list checkboxes**
  - Given: A document has task list items (checked and unchecked)
  - When: Exported to any format
  - Then: Checkbox states are visually represented in the export (checked/unchecked indicators)

**AC-6.2:** PDF and DOCX exports use a light color scheme; HTML export preserves the active viewer theme

- **TC-6.2a: PDF uses light scheme regardless of viewer theme**
  - Given: The user is viewing a document with a dark theme active
  - When: The document is exported to PDF
  - Then: The PDF uses a light color scheme (dark text on a white background). Code blocks, table borders, and blockquote styling use light-appropriate colors.
- **TC-6.2b: DOCX uses light scheme regardless of viewer theme**
  - Given: The user is viewing a document with a dark theme active
  - When: The document is exported to DOCX
  - Then: The DOCX uses standard Word styling with dark text on a white background.
- **TC-6.2c: HTML export preserves active viewer theme**
  - Given: The user is viewing a document with a dark theme active
  - When: The document is exported to HTML
  - Then: The HTML export uses the same dark theme, including code block colors, background, and text colors.
- **TC-6.2d: PDF/DOCX consistent across viewer themes**
  - Given: A user exports the same document to PDF while using different viewer themes
  - When: Both PDFs are compared
  - Then: Both PDFs look the same — PDF/DOCX styling is independent of the viewer's active theme

**AC-6.3:** Raw HTML elements export with best-effort equivalents in PDF and DOCX

- **TC-6.3a: `<details>/<summary>` in PDF and DOCX**
  - Given: A document contains `<details>` with `<summary>` elements
  - When: Exported to PDF or DOCX
  - Then: The content is rendered expanded (all content visible). The summary text appears as bold or emphasized text. The collapsible behavior is not preserved. A `format-degradation` warning is included.
- **TC-6.3b: `<kbd>` in PDF and DOCX**
  - Given: A document contains `<kbd>` elements
  - When: Exported to PDF or DOCX
  - Then: The text renders in a monospace font or with a visual border/background, similar to inline code
- **TC-6.3c: `<details>/<summary>` in HTML**
  - Given: A document contains `<details>` elements
  - When: Exported to HTML
  - Then: The `<details>` elements are preserved as-is with native browser collapse/expand behavior
- **TC-6.3d: Other inline HTML elements**
  - Given: A document contains `<sup>`, `<sub>`, `<br>`, or other inline HTML
  - When: Exported to any format
  - Then: Elements render as their visual equivalent (superscript, subscript, line break). If no equivalent exists in the target format, the text content is preserved.

**AC-6.4:** Export does not introduce content that is not visible in the viewer

- **TC-6.4a: No hidden content surfaced**
  - Given: A document renders normally in the viewer
  - When: Exported to any format
  - Then: The export contains only content that was visible in the viewer. No raw markdown, metadata, or internal state leaks into the output.

**AC-7.2:** Export of problematic documents degrades gracefully

- **TC-7.2a: Very large document**
  - Given: A document is 10,000+ lines with many images and Mermaid diagrams
  - When: Exported to PDF
  - Then: Export completes (may take longer); the output is usable. If the export takes more than 30 seconds, the progress indicator remains visible throughout.
- **TC-7.2b: Document with only degraded content**
  - Given: A document where every image is missing and every Mermaid block has failed
  - When: Exported to any format
  - Then: Export succeeds with warnings. The output contains placeholders and fallbacks for all content.
- **TC-7.2c: Empty document**
  - Given: A zero-byte .md file is open (per Epic 2 AC-2.10)
  - When: Exported to any format
  - Then: Export succeeds; the output is a valid but empty PDF/DOCX/HTML. No error, no crash.
- **TC-7.2d: Source file changes during export**
  - Given: A file is open and an export is in progress
  - When: The source file is modified on disk by an external process during export
  - Then: The export uses the content as read at export start. The file watcher may trigger a viewer reload after export completes, but the export output is not affected.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

This story is a cross-cutting validation layer over the format-specific engines delivered in Stories 3–5.

Theme handling:
- PDF and DOCX: the server applies a dedicated light/export stylesheet (or the light-default theme) regardless of the client's active theme. The specific implementation (export stylesheet, light theme override) is a tech design decision.
- HTML: the server captures the active theme's CSS and embeds it in the exported HTML.

Raw HTML element handling:
- `<details>/<summary>`: expanded in PDF/DOCX (content always visible, summary bold), preserved as-is in HTML. PDF/DOCX exports include a `format-degradation` warning.
- `<kbd>`: rendered as inline code equivalent in all formats.
- `<sup>`, `<sub>`, `<br>`: rendered as visual equivalents where supported; text content preserved if no equivalent exists.

Edge case handling:
- Very large documents: the progress indicator remains visible; no timeout cuts off the export.
- Fully degraded documents: all placeholders and fallbacks are included; export succeeds with warnings.
- Empty documents: valid empty output files are produced.
- File changes during export: the export uses the content snapshot taken at export start (A5).

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Degraded content (missing images, blocked remote images, failed Mermaid) consistent between viewer and all export formats
- [ ] Task list checkboxes visually represented in all formats
- [ ] PDF and DOCX use light color scheme regardless of viewer theme
- [ ] HTML export preserves active viewer theme
- [ ] PDF/DOCX output identical regardless of which viewer theme was active
- [ ] `<details>/<summary>` expanded in PDF/DOCX with `format-degradation` warning; preserved in HTML
- [ ] `<kbd>`, `<sup>`, `<sub>`, `<br>` rendered appropriately in all formats
- [ ] No hidden content, metadata, or internal state leaks into exports
- [ ] Very large documents export successfully with visible progress
- [ ] Fully degraded documents export with warnings
- [ ] Empty documents produce valid empty output
- [ ] Source file changes during export do not affect output
- [ ] All 16 TCs pass
- [ ] No regressions in existing Epic 1–3 functionality
