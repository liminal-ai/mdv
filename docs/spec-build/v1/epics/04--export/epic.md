# Epic 4: Export

This epic defines the complete requirements for exporting markdown documents to
PDF, DOCX, and HTML formats. It serves as the source of truth for the Tech
Lead's design work.

---

## User Profile

**Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
**Context:** The user has reviewed a rendered document in the viewer and needs to share it with someone who does not work in markdown — a stakeholder, a compliance reviewer, a client. They need the output in a format the recipient can open without tooling.
**Mental Model:** "I click Export, pick a format, and get a good file. I don't want to configure anything."
**Key Constraint:** Export runs locally — no cloud conversion services. Good defaults matter more than configurability. The exported output should closely match what the user sees in the viewer.

---

## Feature Overview

After this feature ships, the user can export any open document to PDF, DOCX,
or HTML with two clicks — one to open the Export dropdown, one to select the
format. A save dialog appears with a sensible default path. The export runs with
a visible progress indicator and produces a file with good defaults: readable
typography, proper page breaks, embedded images, and rendered Mermaid diagrams.
Degraded content (missing images, failed Mermaid) appears in exports the same
way it appears in the viewer.

Combined with Epics 1–3, this completes Milestone 3: a full workspace with
export capability.

---

## Scope

### In Scope

Export functionality that activates the disabled Export UI from Epics 2 and 3:

- Export to PDF: default page layout (A4/Letter), margins, page break intelligence, readable typography, embedded images, Mermaid diagrams as rendered SVGs/images, syntax-highlighted code blocks
- Export to DOCX: structured headings, body text, tables, code blocks (monospace with highlighting where supported), embedded images, Mermaid diagrams as images
- Export to HTML: self-contained output (single file with inline assets or folder with assets alongside), visually close to the in-app rendered view
- Export triggers: content toolbar "Export ▾" dropdown (activated from Epic 2's disabled state) and Export menu in the menu bar (activated from Epic 1's disabled state)
- Save dialog: server-side save dialog with sensible default path (source file's directory, or last-used export directory)
- Export feedback: in-progress indicator during export, success state with output file path and option to reveal in Finder, failure/degraded state with warning list
- Content fidelity: exported output closely matches what the user sees in the viewer, including degraded states (missing image placeholders, failed Mermaid fallbacks)
- Last-used export directory persisted across sessions

### Out of Scope

- Export configuration UI (page size, margins, headers/footers, font choices)
- Batch export (multiple documents at once)
- Template customization or user-provided stylesheets
- Print stylesheet editing
- Manual page break hints (`<!-- pagebreak -->` — future refinement)
- Export progress percentage (a spinner or indeterminate indicator is sufficient)
- Password-protected or encrypted exports
- Remote/cloud export services

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Epics 1–3 are complete: server runtime, rendering pipeline, Mermaid diagrams, syntax highlighting, warning infrastructure | Unvalidated | Dev team | Export builds on the full rendering stack |
| A2 | PDF generation uses a headless browser or equivalent rendering engine to convert HTML to PDF | Unvalidated | Tech Lead | Puppeteer, Playwright, or equivalent — confirm during tech design |
| A3 | DOCX generation uses a library that can convert structured HTML or markdown to DOCX format | Unvalidated | Tech Lead | docx, Pandoc, or equivalent — confirm during tech design |
| A4 | HTML export packages the rendered HTML with assets inlined or co-located — no external dependencies | Unvalidated | Tech Lead | CSS, images, fonts must all be included |
| A5 | Export reads the current source file from disk and re-renders it server-side. The server owns the full pipeline: read file → render markdown (with Mermaid, highlighting) → convert to target format → write output. The client does not send rendered HTML — the server re-renders from source. This means export reflects the current file on disk, not a cached viewer state. | Validated | Architecture | Resolves the export-source contract: source-of-truth is disk, not viewer cache |
| A6 | The save dialog uses the same server-side dialog mechanism established in Epic 1 (e.g., osascript on macOS) | Unvalidated | Tech Lead | NSSavePanel with default path pre-populated |
| A7 | Export of a typical document (under 50 pages, under 20 images, under 10 Mermaid diagrams) completes within 30 seconds | Unvalidated | Tech Lead | Longer documents may take longer; a progress indicator is always shown |
| A8 | Per Epic 3's rendering consistency NFR, exported output closely matches the viewer but does not need to be pixel-identical. Visually equivalent output from a server-side rendering path is acceptable. | Validated | Architecture | Inherits Epic 3 NFR |

---

## Flows & Requirements

### 1. Export Trigger and Save Location

The user triggers an export from the content toolbar dropdown or the Export menu
in the menu bar. A save dialog appears with a sensible default filename and
directory. The user confirms or changes the save location, then export begins.

1. User clicks "Export ▾" in the content toolbar (or Export menu in the menu bar)
2. Dropdown shows format options: PDF, DOCX, HTML
3. User clicks a format
4. A save dialog opens with a default filename (source filename with the target extension) and default directory (source file's directory, or last-used export directory if set)
5. User confirms or modifies the save path
6. Export begins

#### Acceptance Criteria

**AC-1.1:** Export dropdown shows PDF, DOCX, and HTML options when a document is open

- **TC-1.1a: Content toolbar Export dropdown**
  - Given: A document is open in the active tab
  - When: User clicks the "Export ▾" button in the content toolbar
  - Then: A dropdown shows three options: PDF, DOCX, HTML. All three are enabled.
- **TC-1.1b: Menu bar Export menu**
  - Given: A document is open in the active tab
  - When: User clicks the Export menu in the menu bar
  - Then: The same three format options appear: PDF, DOCX, HTML. All three are enabled.
- **TC-1.1c: No document open**
  - Given: No document tabs are open (empty state)
  - When: User views the Export dropdown or Export menu
  - Then: Export options are visible but disabled (same disabled pattern as Epics 1–2)
- **TC-1.1d: Deleted-file tab**
  - Given: A tab is showing the "file not found" state (file deleted on disk per Epic 2 AC-7.3)
  - When: User views the Export dropdown
  - Then: Export options are disabled for that tab. Export reads from disk (A5), so a deleted file cannot be exported even though last-known content is visible in the viewer.
  - Note: This is a product decision. Epic 2 preserves last-known content for viewing, but export operates on the current source file. The alternative (exporting cached content) would produce output that may not match any file on disk, which is confusing for the recipient.
- **TC-1.1e: Export dropdown keyboard navigation**
  - Given: The Export dropdown is open
  - When: User presses arrow keys
  - Then: Focus moves between format options; Enter selects the focused option; Escape closes the dropdown (consistent with Epic 1 AC-2.4)
- **TC-1.1f: File opened outside root**
  - Given: A file outside the current root is open in a tab (opened via File > Open per Epic 2 AC-1.4)
  - When: User clicks Export
  - Then: Export options are enabled; export operates on the open document regardless of root

**AC-1.2:** Selecting a format opens a save dialog with sensible defaults

- **TC-1.2a: Default filename**
  - Given: The active document is `architecture.md`
  - When: User selects PDF from the Export dropdown
  - Then: The save dialog opens with default filename `architecture.pdf`
- **TC-1.2b: Default directory — source file location**
  - Given: The active document is at `/Users/leemoore/code/project/docs/spec.md` and no prior export has been done
  - When: User selects a format
  - Then: The save dialog opens in `/Users/leemoore/code/project/docs/`
- **TC-1.2c: Default directory — last-used export location**
  - Given: The user previously exported a file to `/Users/leemoore/Desktop/exports/`
  - When: User exports a different document
  - Then: The save dialog opens in `/Users/leemoore/Desktop/exports/` (last-used directory takes precedence)
- **TC-1.2d: DOCX filename**
  - Given: The active document is `readme.md`
  - When: User selects DOCX
  - Then: The save dialog opens with default filename `readme.docx`
- **TC-1.2e: HTML filename**
  - Given: The active document is `notes.md`
  - When: User selects HTML
  - Then: The save dialog opens with default filename `notes.html`

- **TC-1.2f: Overwrite existing file**
  - Given: The save dialog is open and the user selects a filename that already exists
  - When: User confirms
  - Then: The OS save dialog prompts for overwrite confirmation. If confirmed, the existing file is replaced. If declined, the user returns to the save dialog.

**AC-1.3:** Cancelling the save dialog aborts the export

- **TC-1.3a: Cancel save dialog**
  - Given: The save dialog is open
  - When: User cancels the dialog
  - Then: No export occurs, no file is created, the app returns to its previous state

**AC-1.4:** Last-used export directory persists across sessions

- **TC-1.4a: Directory persisted**
  - Given: User exported to `/Users/leemoore/Desktop/exports/`
  - When: App is restarted and user exports again
  - Then: The save dialog defaults to `/Users/leemoore/Desktop/exports/`

**AC-1.5:** A keyboard shortcut opens the Export dropdown

- **TC-1.5a: Export keyboard shortcut**
  - Given: A document is open
  - When: User presses the export keyboard shortcut
  - Then: The Export dropdown opens (same as clicking the "Export ▾" button)
  - Note: The specific key combination is a tech design decision. Suggested: Cmd+Shift+E.

### 2. Export Progress and Completion

After the user confirms the save location, the export runs with a visible
progress indicator. On completion, the user sees either a success state with the
output file path or a failure/degraded state with warnings.

1. User confirms the save location
2. Export begins; a progress indicator appears in the content toolbar
3. Export completes
4. Success: output file path is shown with an option to reveal in Finder
5. Failure or degraded: warnings list what couldn't be included

#### Acceptance Criteria

**AC-2.1:** An in-progress indicator is visible during export

- **TC-2.1a: Progress indicator appears**
  - Given: User confirmed the save location
  - When: Export is in progress
  - Then: A progress indicator (spinner or progress bar) is visible in the content toolbar or as an overlay. The Export button is disabled to prevent concurrent exports.
- **TC-2.1b: UI remains responsive during export**
  - Given: Export is in progress
  - When: User interacts with the app (switches tabs, scrolls, toggles sidebar)
  - Then: The UI remains responsive; export runs in the background on the server

**AC-2.2:** On success, the app shows the output file path with a reveal option

- **TC-2.2a: Success notification**
  - Given: Export completes without errors or warnings
  - When: Success state is displayed
  - Then: A notification shows the output file path (truncated if long, with full path on hover) and a "Reveal in Finder" button (or equivalent for the platform)
- **TC-2.2b: Reveal in Finder**
  - Given: Success notification is displayed
  - When: User clicks "Reveal in Finder"
  - Then: The system file manager opens with the exported file selected
- **TC-2.2c: Success notification dismissal**
  - Given: Success notification is displayed
  - When: User dismisses the notification (close button or timeout)
  - Then: The notification disappears; the app returns to normal state

**AC-2.3:** On degraded output, the app shows warnings alongside the success path

- **TC-2.3a: Degraded export with missing images**
  - Given: The document has 2 missing images
  - When: Export completes
  - Then: The success notification includes a warning count (e.g., "Exported with 2 warnings") and a way to view the warning details
- **TC-2.3b: Warning detail list**
  - Given: Degraded export notification is displayed
  - When: User expands or clicks the warning count
  - Then: A list shows each warning with type and description (e.g., "Missing image: ./images/diagram.png — placeholder included in export")
- **TC-2.3c: Degraded export still produces a file**
  - Given: A document has degraded content (missing images, failed Mermaid)
  - When: Export completes
  - Then: The output file is created with placeholders in place of the missing content. The export does not fail — it succeeds with warnings.

**AC-2.4:** On export failure, the app shows a clear error

- **TC-2.4a: Write permission denied**
  - Given: User selected a save path they don't have write permission to
  - When: Export attempts to write the file
  - Then: An error message indicates the file could not be written, with the path shown
- **TC-2.4b: Export engine failure**
  - Given: The PDF/DOCX/HTML generation engine encounters an internal error
  - When: Export fails
  - Then: An error message indicates the export failed, with a description of what went wrong. No partial file is left behind.
- **TC-2.4c: Disk full**
  - Given: The target disk has insufficient space
  - When: Export attempts to write
  - Then: An error message indicates insufficient disk space. No partial file is left behind.

### 3. PDF Export Quality

PDF output has readable typography, proper margins, and intelligent page breaks.
Content from the rendered view — headings, paragraphs, lists, tables, code
blocks, images, and Mermaid diagrams — appears in the PDF with good defaults.

#### Acceptance Criteria

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

### 4. DOCX Export Quality

DOCX output has structured headings, readable body text, tables, code blocks,
and embedded images. Mermaid diagrams are included as images.

#### Acceptance Criteria

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

### 5. HTML Export Quality

HTML export produces self-contained output that can be opened in a browser and
looks close to the in-app rendered view. All assets are included — no external
dependencies.

#### Acceptance Criteria

**AC-5.1:** HTML export is self-contained

- **TC-5.1a: Single-file HTML**
  - Given: A document is exported to HTML
  - When: User opens the HTML file in a browser
  - Then: The document renders correctly with all styling, images, and diagrams visible. No external resources are loaded.
- **TC-5.1b: CSS included**
  - Given: A document is exported to HTML
  - When: User views the HTML source
  - Then: All CSS styles are inlined or embedded in a `<style>` tag — no external stylesheet links
- **TC-5.1c: Images included**
  - Given: A document references local images
  - When: Exported to HTML
  - Then: Images are embedded as base64 data URIs or co-located as files alongside the HTML. The HTML displays correctly when moved to a different directory.

**AC-5.2:** HTML export looks close to the in-app rendered view

- **TC-5.2a: Visual parity**
  - Given: A document is open in the viewer with a specific theme
  - When: Exported to HTML and opened in the same browser
  - Then: Typography, heading sizes, code block styling, table formatting, Mermaid diagrams, and theme colors are visually similar to the in-app view (the active theme is preserved per AC-6.2c). Minor differences in spacing or font rendering are acceptable.
- **TC-5.2b: Mermaid diagrams in HTML**
  - Given: A document has rendered Mermaid diagrams
  - When: Exported to HTML
  - Then: Diagrams appear as inline SVGs or embedded images
- **TC-5.2c: Syntax highlighting in HTML**
  - Given: A document has code blocks with syntax highlighting
  - When: Exported to HTML
  - Then: Code blocks have syntax highlighting in the exported HTML

**AC-5.3:** HTML export preserves links

- **TC-5.3a: External links in HTML**
  - Given: A document contains external hyperlinks
  - When: Exported to HTML
  - Then: Links are clickable and open in the browser
- **TC-5.3b: Relative markdown links in HTML**
  - Given: A document contains relative links to other .md files (e.g., `[Design](./design.md)`)
  - When: Exported to HTML
  - Then: Relative links remain as-is in the HTML (pointing to the relative path). They may or may not resolve depending on whether adjacent files have also been exported. No rewriting is performed.
- **TC-5.3c: Anchor links in HTML**
  - Given: A document contains internal anchor links (e.g., `[Section](#heading)`)
  - When: Exported to HTML
  - Then: Anchor links scroll to the target heading within the exported HTML

**AC-5.4:** HTML export handles degraded content

- **TC-5.4a: Missing images in HTML**
  - Given: A document has missing images
  - When: Exported to HTML
  - Then: Placeholders appear in the HTML (matching the viewer's placeholders)
- **TC-5.4b: Failed Mermaid in HTML**
  - Given: A document has a failed Mermaid block
  - When: Exported to HTML
  - Then: The raw source with error banner appears in the HTML (matching the viewer's fallback)

### 6. Export Content Fidelity

Export output closely matches what the user sees in the viewer. Degraded content
appears in exports the same way it appears in the viewer — placeholders for
missing images, raw source for failed Mermaid. The user should not be surprised
by differences between the viewer and the export.

#### Acceptance Criteria

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

PDF and DOCX are sharing/printing formats — dark backgrounds are unusable on paper. HTML is a portable viewer — the user's theme choice is intentional and worth preserving.

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

The viewer renders raw HTML elements (Epic 2 AC-2.9). PDF and DOCX do not have
native equivalents for all HTML elements. HTML export preserves them as-is.

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

### 7. Error Handling

Export failures produce clear feedback. No partial files are left behind. The
app remains functional after a failed export.

#### Acceptance Criteria

**AC-7.1:** Export errors do not crash the app or leave partial files

- **TC-7.1a: App recovers from export failure**
  - Given: An export fails for any reason (engine error, permission denied, disk full)
  - When: The error is displayed
  - Then: The app is fully functional — the user can retry the export, switch tabs, or continue using the app normally
- **TC-7.1b: No partial files**
  - Given: An export fails mid-write
  - When: The error is handled
  - Then: No partial or corrupted file remains at the save path
- **TC-7.1c: Concurrent export prevention**
  - Given: An export is in progress
  - When: User attempts to start another export
  - Then: The second export is blocked; the Export button remains disabled until the current export completes or fails

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

---

## Data Contracts

### Export Request

```typescript
interface ExportRequest {
  path: string;            // absolute path to the source markdown file
  format: "pdf" | "docx" | "html";
  savePath: string;        // absolute path for the output file (from save dialog)
}
```

### Export Response

```typescript
interface ExportResponse {
  status: "success" | "error";
  outputPath?: string;     // absolute path of the exported file on success
  warnings: ExportWarning[];
  error?: string;          // error message on failure
}

interface ExportWarning {
  type:
    | "missing-image"           // image file not found on disk
    | "remote-image-blocked"    // http/https image not loaded
    | "mermaid-error"           // Mermaid diagram failed to render
    | "unsupported-format"      // image format not renderable
    | "format-degradation";     // content was simplified or flattened for the target format
                                // (e.g., syntax highlighting dropped in DOCX, <details> expanded in PDF)
  source: string;          // the image path, URL, Mermaid source, or element description (truncated to 200 chars)
  line?: number;           // line number in the source markdown, if available (matches RenderWarning)
  message: string;         // human-readable description of what was degraded
}
```

Note: `ExportWarning` shares most warning types with `RenderWarning` from
Epics 2–3, plus the export-only `format-degradation` type. The types may share
a base definition or be distinct — this is a tech design decision.

### Session State Extension

Epic 1's `SessionState` is extended:

```typescript
interface SessionState {
  // ... all Epic 1–3 fields ...
  lastExportDir: string | null;  // last-used export directory, or null if never exported
}
```

### API Surface

New endpoints for this epic. All endpoints are local only (localhost).

| Method | Path | Request | Success Response | Error | Notes |
|--------|------|---------|-----------------|-------|-------|
| POST | /api/export | `ExportRequest` | `ExportResponse` | 400, 403, 404, 500 | Trigger export; blocks until complete |
| POST | /api/export/save-dialog | `{ defaultPath: string, defaultFilename: string }` | `{ path: string } \| null` | 500 | Open server-side save dialog; returns selected path or null if cancelled |
| POST | /api/export/reveal | `{ path: string }` | `{ ok: true }` | 500 | Reveal file in system file manager |
| PUT | /api/session/last-export-dir | `{ path: string }` | `SessionState` | 400 | Update last-used export directory |

Note: The `/api/export` endpoint blocks until the export completes. For typical
documents this is under 30 seconds (see A7). The client shows a progress
indicator during the request. If exports need to support longer durations, the
tech design may introduce an async pattern with polling — but the data contract
above remains the final response shape.

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_PATH | Source or save path is not absolute or is invalid |
| 400 | INVALID_FORMAT | Format is not one of: pdf, docx, html |
| 403 | PERMISSION_DENIED | Cannot write to the specified save path |
| 404 | FILE_NOT_FOUND | Source markdown file does not exist |
| 500 | EXPORT_ERROR | Export engine failed (rendering, conversion, or write error) |
| 507 | INSUFFICIENT_STORAGE | Target disk has insufficient space |

---

## Dependencies

Technical dependencies:
- Epics 1–3 complete: server runtime, rendering pipeline, Mermaid diagrams, syntax highlighting, warning infrastructure, session persistence
- PDF generation engine (confirmed in tech design)
- DOCX generation library (confirmed in tech design)
- Server-side rendering capability for export (the viewing pipeline renders client-side per Epic 2; export requires server-side rendering to produce output files)

Process dependencies:
- Epic 3 tech design and implementation complete before Epic 4 implementation begins

---

## Non-Functional Requirements

### Performance
- Export of a typical document (under 50 pages, under 20 images, under 10 Mermaid diagrams) completes within 30 seconds
- Export does not freeze the UI — the server handles export processing; the client remains responsive
- PDF generation of a 5-page document with no images completes within 10 seconds

### Reliability
- Failed exports do not leave partial files at the save path
- Export can be retried immediately after failure without app restart
- Concurrent exports are prevented at the UI level

### Security
- Export writes only to the path the user selected in the save dialog
- No temporary files are left in system temp directories after export completes (success or failure)
- Export does not fetch remote resources — remote image placeholders appear as-is

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. **PDF engine:** Puppeteer, Playwright, wkhtmltopdf, or another approach? Trade-offs include quality, startup time, bundle size, and whether a headless browser is acceptable as a dependency.
2. **DOCX engine:** docx library (builds from scratch), Pandoc (external binary), or HTML-to-DOCX conversion? Trade-offs include formatting fidelity, dependency weight, and table/image support.
3. **Server-side rendering pipeline:** A5 establishes that export re-renders from source on the server. The server needs the full rendering pipeline (markdown-it, Mermaid, syntax highlighting) running server-side. How should this be structured? Shared library code with Epic 3's client-side pipeline? Separate server-side rendering module? How is rendering parity between viewer and export validated?
4. **Mermaid in server-side rendering:** Mermaid.js requires a DOM. For server-side export rendering, should the server use jsdom, Puppeteer's page context, or a pre-rendered SVG cache? How does this interact with Epic 3's client-side Mermaid rendering for viewing?
5. **HTML export format:** Single file with base64-encoded assets, or a folder with the HTML file plus an assets directory? Single file is simpler to share but larger; folder is more efficient but requires zipping for transfer.
6. **Export styling implementation:** AC-6.2 decides that PDF and DOCX use a light color scheme while HTML preserves the active theme. How should the light scheme for PDF/DOCX be implemented — a dedicated export stylesheet, the light-default theme applied server-side, or a separate export-specific theme? How does the HTML export capture the active theme's CSS?
7. **Page size default:** A4 or US Letter? Should the app detect the user's locale and choose accordingly?
8. **Temp file strategy:** Where do intermediate files live during export? How are they cleaned up on failure?
9. **DOCX syntax highlighting:** Word has limited native syntax highlighting support. Should code blocks in DOCX have colored text (via run-level formatting), or just monospace on a gray background?
10. **HTML export single-file vs. folder:** AC-5.1 requires self-contained output. Should the default be a single file with base64-encoded assets (simpler to share, larger file size), a folder with HTML + assets directory, or should the user choose? The save dialog and default filename currently assume a single file.

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

Types, test fixtures, and server infrastructure needed by all Epic 4 stories.

- `ExportRequest`, `ExportResponse`, `ExportWarning` type definitions
- `SessionState` extension with `lastExportDir`
- New error codes: `INVALID_FORMAT`, `EXPORT_ERROR`, `INSUFFICIENT_STORAGE`
- Server endpoint stubs for `/api/export`, `/api/export/save-dialog`, `/api/export/reveal`, `/api/session/last-export-dir`
- Test fixtures: sample documents with varied content (plain text, images, Mermaid diagrams, code blocks, tables, degraded content)

### Story 1: Export Trigger and Save Dialog

**Delivers:** User can click Export, select a format, see a save dialog with sensible defaults, and confirm or cancel.
**Prerequisite:** Story 0, Epics 1–3 complete
**ACs covered:**
- AC-1.1 (export dropdown and menu activation, keyboard nav, deleted-file/outside-root handling)
- AC-1.2 (save dialog with defaults, overwrite behavior)
- AC-1.3 (cancel behavior)
- AC-1.4 (last-used directory persistence)
- AC-1.5 (keyboard shortcut)

**Estimated test count:** 14 tests

### Story 2: Export Progress, Success, and Error Handling

**Delivers:** Export runs with a visible progress indicator; success shows file path with reveal; failures show clear errors.
**Prerequisite:** Story 1
**ACs covered:**
- AC-2.1 (progress indicator)
- AC-2.2 (success notification with reveal)
- AC-2.3 (degraded output warnings)
- AC-2.4 (export failure errors)
- AC-7.1 (no crash, no partial files, concurrent prevention)

**Estimated test count:** 14 tests

### Story 3: PDF Export

**Delivers:** User can export a document to PDF with readable typography, smart page breaks, embedded images, Mermaid diagrams, and syntax highlighting.
**Prerequisite:** Story 2
**ACs covered:**
- AC-3.1 (typography and margins)
- AC-3.2 (page break intelligence)
- AC-3.3 (Mermaid in PDF)
- AC-3.4 (syntax highlighting in PDF)
- AC-3.5 (embedded images in PDF)
- AC-3.6 (links, blockquotes, horizontal rules in PDF)

**Estimated test count:** 16 tests

### Story 4: DOCX Export

**Delivers:** User can export a document to DOCX with structured headings, tables, code blocks, and embedded images/diagrams.
**Prerequisite:** Story 2
**ACs covered:**
- AC-4.1 (headings and body text)
- AC-4.2 (tables)
- AC-4.3 (code blocks)
- AC-4.4 (images and Mermaid)
- AC-4.5 (links, blockquotes, horizontal rules in DOCX)
- AC-4.6 (h5/h6 heading levels)

**Estimated test count:** 14 tests

### Story 5: HTML Export

**Delivers:** User can export a document to self-contained HTML that looks close to the in-app view.
**Prerequisite:** Story 2
**ACs covered:**
- AC-5.1 (self-contained output)
- AC-5.2 (visual parity with theme preservation)
- AC-5.3 (link behavior in HTML)
- AC-5.4 (degraded content handling)

**Estimated test count:** 11 tests

### Story 6: Content Fidelity and Edge Cases

**Delivers:** Export output consistently reflects the viewer's rendered state across all formats; edge cases handled gracefully.
**Prerequisite:** Stories 3, 4, 5
**ACs covered:**
- AC-6.1 (viewer/export consistency)
- AC-6.2 (export theme rules — PDF/DOCX light, HTML preserves theme)
- AC-6.3 (raw HTML element export behavior)
- AC-6.4 (no hidden content)
- AC-7.2 (large documents, fully degraded documents, empty documents, file changes during export)

**Estimated test count:** 14 tests

---

## Amendments

### Amendment 1: Export consistency language vs. PRD (2026-03-20)

**Changed:** AC-6.1, A8, rendering consistency throughout
**Reason:** The PRD says "Export uses the same rendered output the user sees in the viewer." Epic 3's rendering consistency NFR clarified that exported output "closely matches" the viewer and does not need to be pixel-identical — visually equivalent output from a server-side rendering path is acceptable. This epic inherits that clarification. The behavioral commitment remains: degraded content (missing images, failed Mermaid) appears in exports the same way it appears in the viewer. The relaxation is on rendering-path identity, not on user-visible behavior.

### Amendment 2: Export theme split by format (2026-03-20)

**Changed:** AC-6.2 (new), Tech Design Question 6 refined
**Reason:** The PRD says "good defaults" and "closely match what the user sees." These conflict when the user has a dark theme — dark PDFs are unusable for printing, but dark HTML exports accurately represent the viewer. Resolution: PDF and DOCX always use a light color scheme (sharing/printing formats). HTML export preserves the active viewer theme (portable viewer format). Tech Design Question 6 is retained but scoped to implementation (which light scheme for PDF/DOCX), not the format-level decision.

### Amendment 3: Export-source contract resolved (2026-03-20)

**Changed:** A5 (clarified), Tech Design Question 3 (aligned)
**Reason:** The spec needed to resolve whether export operates on the current source file from disk (server re-renders) or on the client's cached rendered state. Decision: export reads from disk and re-renders server-side. This means: deleted-file tabs can't be exported (file doesn't exist on disk), export always reflects the current file content, and the server owns the full rendering pipeline. The alternative (exporting cached viewer state) was rejected because it could produce output that doesn't match any file on disk.

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
- [x] Stories sequence logically (trigger → progress → per-format → cross-cutting)
- [x] All dependencies on Epics 1–3 are explicit
- [x] Export-source contract resolved: disk re-render, not cached state (A5, Amendment 3)
- [x] Export consistency aligned with PRD, clarification tracked as Amendment 1
- [x] Export theme split by format: PDF/DOCX light, HTML preserves theme (Amendment 2)
- [x] Degraded content handling specified for all three formats
- [x] Export-specific warning type (`format-degradation`) added to ExportWarning
- [x] Raw HTML element export behavior specified (AC-6.3)
- [x] Links (external + relative) specified per format: PDF, DOCX, and HTML
- [x] Keyboard shortcut and keyboard accessibility included
- [x] Edge cases: deleted-file tab, empty document, outside-root file, overwrite, file-change-during-export
- [x] Self-review complete
- [x] Verification round 1 complete (Codex)
- [x] Critical and major issues from verification round 1 addressed
- [ ] Validation rounds complete (pending final sign-off)
