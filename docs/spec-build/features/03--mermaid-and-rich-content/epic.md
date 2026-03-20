# Epic 3: Mermaid and Rich Content

This epic defines the complete requirements for Mermaid diagram rendering, code
syntax highlighting, and rich table content. It serves as the source of truth
for the Tech Lead's design work.

---

## User Profile

**Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
**Context:** Reviewing documents that contain architecture diagrams (Mermaid), code samples across multiple languages, and data-heavy tables with nested content. These are real-world files, not pristine samples — some Mermaid will have syntax errors, some code blocks will lack language tags, some tables will have complex cell content.
**Mental Model:** "I open a doc, the diagrams render, the code is highlighted, the tables look right. If something can't render, I see what went wrong."
**Key Constraint:** All rendering is local — no remote services. Mermaid diagrams and syntax highlighting must adapt to the active theme (light/dark).

---

## Feature Overview

After this feature ships, Mermaid code blocks render as inline SVG diagrams,
code blocks have language-aware syntax highlighting, and tables with complex
content display correctly. Rendering failures are visible — failed Mermaid
blocks show the raw source with an error banner, and failures contribute to the
existing warning count.

Combined with Epics 1 and 2, this completes Milestone 2: a viewer that handles
real-world technical content — architecture diagrams, multi-language code
samples, and data-heavy tables.

---

## Scope

### In Scope

The rich content layer on top of Epic 2's baseline rendering:

- Mermaid diagram rendering: code blocks with language `mermaid` render as inline diagrams
- Mermaid failure handling: invalid diagrams show raw source in a code block with an error banner
- Mermaid diagram types — guaranteed baseline: flowchart, sequence, class, state, gantt, entity-relationship, pie, mindmap. Additional types bundled with the rendering library may work but are not part of the v1 contract.
- Mermaid theme adaptation: diagrams use light colors on light themes and dark colors on dark themes
- Code syntax highlighting: code blocks with language tags render with language-aware coloring, replacing Epic 2's monospace-only rendering
- Syntax highlighting — guaranteed baseline languages: JavaScript, TypeScript, Python, Go, Rust, Java, C, C++, SQL, YAML, JSON, Bash/Shell, HTML, CSS, Markdown, TOML, Dockerfile. Additional languages bundled with the highlighting library may work but are not part of the v1 contract.
- Code highlighting theme adaptation: highlighting colors adapt to light/dark themes
- Rich table content: standard markdown pipe tables with inline content (formatting, links, code spans) render correctly; raw HTML tables with block-level content (lists, multi-line cells) render via Epic 2's HTML pass-through
- Warning integration: Mermaid failures are added to Epic 2's warning count and warning panel

### Out of Scope

- Mermaid editing or live diagram authoring
- Custom Mermaid configuration or user-provided Mermaid themes
- LaTeX or math rendering
- Remote image fetching or caching (unchanged from Epic 2)
- Line numbers in code blocks (future enhancement)
- Code block copy-to-clipboard button (future enhancement)
- Basic table rendering, image handling, warning infrastructure (delivered in Epic 2)
- Mermaid diagram accessibility (alt text, ARIA descriptions for screen readers — future enhancement)

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Epic 2 is complete: markdown rendering, tabs, content toolbar, warning infrastructure, file watching are all in place | Unvalidated | Dev team | Epic 3 builds on Epic 2's rendering pipeline |
| A2 | A JavaScript Mermaid rendering library handles diagram generation | Unvalidated | Tech Lead | Mermaid.js is the expected library; confirm during tech design |
| A3 | A syntax highlighting library handles language tokenization and coloring | Unvalidated | Tech Lead | Shiki, Prism, or Highlight.js — confirm during tech design |
| A4 | Mermaid rendering produces SVG output (not canvas), ensuring exportability in Epic 4 | Unvalidated | Tech Lead | Canvas-based output cannot be embedded in PDF/DOCX exports |
| A5 | Syntax highlighting uses CSS classes or inline styles that can be themed, not hard-coded colors | Unvalidated | Tech Lead | Must adapt to light/dark themes |
| A6 | Epic 2 established that markdown rendering for viewing happens client-side from server-provided raw content (Epic 2 Key Constraint). Mermaid rendering and syntax highlighting are extensions to this client-side rendering pipeline. Whether the rendering location changes for export (Epic 4) is a separate tech design decision. | Validated | Architecture | Inherits Epic 2's validated architecture decision |
| A7 | The guaranteed baseline diagram types and languages listed in In Scope are the v1 contract. Additional types/languages that the bundled libraries support may work but are not tested or guaranteed. Updating libraries to add support requires no application code changes. | Unvalidated | Tech Lead | Deterministic v1 baseline; extras are non-contractual |
| A8 | Standard markdown pipe-table syntax supports only inline content per cell (single line). Block-level content in table cells (nested lists, multi-line paragraphs) requires raw HTML tables, which Epic 2's HTML pass-through already renders. This is a parser limitation, not a product scope reduction. | Validated | Architecture | See Amendment 1 for PRD alignment |

---

## Flows & Requirements

### 1. Mermaid Diagram Rendering

The user opens a document containing Mermaid code blocks. Each valid Mermaid
block renders as an inline diagram. Diagrams are sized to fit within the content
area. The diagrams adapt their color scheme to the active theme.

1. User opens a document containing one or more Mermaid code blocks
2. Each Mermaid block is parsed and rendered as a diagram
3. Rendered diagrams appear inline in the document where the code block was
4. Diagrams respect the content area width and the active theme

#### Acceptance Criteria

**AC-1.1:** Mermaid code blocks render as inline diagrams

- **TC-1.1a: Flowchart diagram**
  - Given: A document contains a fenced code block with language `mermaid` containing a flowchart definition
  - When: Document is rendered
  - Then: A flowchart diagram appears inline where the code block was
- **TC-1.1b: Sequence diagram**
  - Given: A document contains a Mermaid sequence diagram
  - When: Document is rendered
  - Then: A sequence diagram renders with actors, messages, and lifelines
- **TC-1.1c: Class diagram**
  - Given: A document contains a Mermaid class diagram
  - When: Document is rendered
  - Then: A class diagram renders with classes, relationships, and labels
- **TC-1.1d: State diagram**
  - Given: A document contains a Mermaid state diagram
  - When: Document is rendered
  - Then: A state diagram renders with states and transitions
- **TC-1.1e: Gantt chart**
  - Given: A document contains a Mermaid gantt chart
  - When: Document is rendered
  - Then: A gantt chart renders with tasks, dates, and sections
- **TC-1.1f: Entity-relationship diagram**
  - Given: A document contains a Mermaid entity-relationship diagram
  - When: Document is rendered
  - Then: An ER diagram renders with entities, attributes, and relationships
- **TC-1.1g: Pie chart**
  - Given: A document contains a Mermaid pie chart
  - When: Document is rendered
  - Then: A pie chart renders with labeled segments
- **TC-1.1h: Mindmap**
  - Given: A document contains a Mermaid mindmap
  - When: Document is rendered
  - Then: A mindmap renders with nodes and branches

**AC-1.2:** Mermaid diagrams are sized to fit within the content area

- **TC-1.2a: Wide diagram scales to fit**
  - Given: A Mermaid diagram's natural width exceeds the content area width
  - When: Document is rendered
  - Then: The diagram scales down to fit within the content area while maintaining aspect ratio
- **TC-1.2b: Small diagram renders at natural size**
  - Given: A Mermaid diagram's natural dimensions are smaller than the content area
  - When: Document is rendered
  - Then: The diagram renders at its natural size; it is not scaled up
- **TC-1.2c: Tall diagram is not truncated**
  - Given: A Mermaid diagram is taller than the viewport
  - When: Document is rendered
  - Then: The full diagram is visible; the user can scroll to see all of it

**AC-1.3:** Mermaid diagrams adapt to the active theme

- **TC-1.3a: Light theme diagram colors**
  - Given: A light theme is active
  - When: A document with Mermaid diagrams is rendered
  - Then: Diagrams use dark lines and text on a light background
- **TC-1.3b: Dark theme diagram colors**
  - Given: A dark theme is active
  - When: A document with Mermaid diagrams is rendered
  - Then: Diagrams use light lines and text on a dark background
- **TC-1.3c: Theme switch updates diagrams**
  - Given: A document with rendered Mermaid diagrams is open
  - When: User switches from a light theme to a dark theme (or vice versa)
  - Then: Diagrams update to match the new theme without requiring a page reload

**AC-1.4:** Multiple Mermaid blocks in one document all render

- **TC-1.4a: Multiple diagrams**
  - Given: A document contains 5 Mermaid code blocks of different types
  - When: Document is rendered
  - Then: All 5 diagrams render correctly in their respective positions
- **TC-1.4b: Mixed content**
  - Given: A document contains Mermaid blocks interspersed with headings, paragraphs, code blocks, and images
  - When: Document is rendered
  - Then: Mermaid diagrams render inline with the rest of the content; surrounding content is unaffected

**AC-1.5:** Mermaid blocks in Epic 2's placeholder state are replaced by rendered diagrams

- **TC-1.5a: Placeholder replacement**
  - Given: Epic 2 rendered Mermaid blocks as placeholders with "diagram rendering not yet available"
  - When: Epic 3 is deployed and a document with Mermaid blocks is opened
  - Then: The placeholders are replaced by actual rendered diagrams; no placeholder text remains for valid Mermaid blocks

**AC-1.6:** Rendered Mermaid diagrams are static — no interactive features

- **TC-1.6a: Click directives stripped**
  - Given: A Mermaid diagram definition includes `click` directives (linking nodes to URLs or callbacks)
  - When: Document is rendered
  - Then: The rendered diagram does not contain clickable links or execute any callbacks; nodes are static
- **TC-1.6b: No hover interactivity**
  - Given: A rendered Mermaid diagram is displayed
  - When: User hovers over diagram nodes
  - Then: No interactive tooltips, popups, or hover effects appear. Standard browser behavior (text selection, right-click) is not blocked.

### 2. Mermaid Error Handling

Mermaid code blocks may contain syntax errors, use unsupported features, or
reference diagram types that the rendering library cannot handle. Failed blocks
show the raw Mermaid source in a code block with an error banner above it. The
failure is added to the warning count in the content toolbar.

1. User opens a document with an invalid Mermaid code block
2. The rendering library attempts to parse and render the block
3. Parsing or rendering fails
4. The raw Mermaid source is displayed in a monospace code block
5. An error banner above the code block describes what went wrong
6. The warning count in the content toolbar increments

#### Acceptance Criteria

**AC-2.1:** Failed Mermaid blocks show raw source in a code block with an error banner

- **TC-2.1a: Syntax error**
  - Given: A document contains a Mermaid block with invalid syntax
  - When: Document is rendered
  - Then: The raw Mermaid source is shown in a monospace code block, with an error banner above it indicating a syntax error
- **TC-2.1b: Error banner content**
  - Given: A Mermaid block fails to render
  - When: The error fallback is displayed
  - Then: The error banner includes: a visual error indicator, a brief description of the failure, and the raw source is fully visible and selectable (the user can copy it to debug elsewhere)
- **TC-2.1c: Partial success**
  - Given: A document contains 3 Mermaid blocks — 2 valid, 1 invalid
  - When: Document is rendered
  - Then: The 2 valid blocks render as diagrams; the 1 invalid block shows the error fallback. Valid blocks are not affected by the failure.
- **TC-2.1d: Empty Mermaid block**
  - Given: A document contains a Mermaid code block with no content (empty or whitespace-only)
  - When: Document is rendered
  - Then: The block shows the error fallback with a message indicating the diagram definition is empty

**AC-2.2:** Mermaid failures are added to the warning count

- **TC-2.2a: Warning count increment**
  - Given: A document has 1 failed Mermaid block and 2 missing images
  - When: Document is rendered
  - Then: The warning count shows 3 (1 Mermaid error + 2 image warnings)
- **TC-2.2b: Warning panel detail**
  - Given: A Mermaid block failed to render
  - When: User clicks the warning count
  - Then: The warning panel lists the Mermaid error with type, error description, and line number if available
- **TC-2.2c: No warnings for successful diagrams**
  - Given: A document contains only valid Mermaid blocks
  - When: Document is rendered
  - Then: No Mermaid-related warnings appear in the warning count

**AC-2.3:** Mermaid rendering failures do not block document display

- **TC-2.3a: Document renders despite Mermaid failure**
  - Given: A document contains a Mermaid block that causes a rendering error
  - When: Document is rendered
  - Then: The rest of the document (headings, paragraphs, code blocks, images, tables) renders normally; only the failed Mermaid block shows the error fallback
- **TC-2.3b: Rendering timeout**
  - Given: A Mermaid block contains an extremely complex diagram that takes too long to render
  - When: A rendering timeout elapses
  - Then: The block falls back to the error display with a timeout message; the document is not blocked

### 3. Code Syntax Highlighting

Code blocks with language tags render with language-aware syntax highlighting,
replacing Epic 2's monospace-only rendering. Highlighting colors adapt to the
active theme. Code blocks without a language tag or with an unrecognized
language continue to render as plain monospace.

1. User opens a document containing code blocks with language tags
2. Each code block is tokenized and highlighted according to its language
3. Highlighted code appears in place of the plain monospace rendering

#### Acceptance Criteria

**AC-3.1:** Code blocks with language tags render with syntax highlighting

- **TC-3.1a: JavaScript highlighting**
  - Given: A document contains a fenced code block tagged as `javascript`
  - When: Document is rendered
  - Then: Keywords, strings, comments, and other syntax elements are visually distinguished by color
- **TC-3.1b: Multiple languages in one document**
  - Given: A document contains code blocks in TypeScript, Python, and YAML
  - When: Document is rendered
  - Then: Each block is highlighted according to its language's syntax rules
- **TC-3.1c: Highlighting preserves content**
  - Given: A code block contains specific text
  - When: Syntax highlighting is applied
  - Then: The text content is unchanged — highlighting adds visual styling only, no content modification
- **TC-3.1d: Large code block**
  - Given: A document contains a single code block with 3,000+ lines of code
  - When: Document is rendered
  - Then: The block renders with syntax highlighting without freezing the UI

**AC-3.2:** Common languages are supported

- **TC-3.2a: Core language set**
  - Given: Documents with code blocks tagged as: javascript, typescript, python, go, rust, java, c, cpp, sql, yaml, json, bash, html, css, markdown, toml, dockerfile
  - When: Each document is rendered
  - Then: Each code block has language-appropriate syntax highlighting
- **TC-3.2b: Language tag aliases**
  - Given: Code blocks use common aliases (e.g., `js` for JavaScript, `ts` for TypeScript, `py` for Python, `sh` for Bash, `yml` for YAML)
  - When: Document is rendered
  - Then: Aliases resolve to the correct language and highlighting is applied

**AC-3.3:** Unknown or missing language tags fall back to monospace

- **TC-3.3a: No language tag**
  - Given: A fenced code block has no language specified (bare triple backticks)
  - When: Document is rendered
  - Then: The block renders as plain monospace text with a distinct background (same as Epic 2)
- **TC-3.3b: Unrecognized language**
  - Given: A code block is tagged with an unknown language (e.g., `brainfuck` or `custom-dsl`)
  - When: Document is rendered
  - Then: The block renders as plain monospace text; no error is shown
- **TC-3.3c: Indented code blocks**
  - Given: A code block is created via 4-space indentation (no language tag possible)
  - When: Document is rendered
  - Then: The block renders as plain monospace text (same as Epic 2)

**AC-3.4:** Syntax highlighting adapts to the active theme

- **TC-3.4a: Light theme highlighting**
  - Given: A light theme is active
  - When: A document with code blocks is rendered
  - Then: Highlighting uses colors that are readable on a light background
- **TC-3.4b: Dark theme highlighting**
  - Given: A dark theme is active
  - When: A document with code blocks is rendered
  - Then: Highlighting uses colors that are readable on a dark background
- **TC-3.4c: Theme switch updates highlighting**
  - Given: A document with highlighted code blocks is open
  - When: User switches themes
  - Then: Code highlighting colors update to match the new theme without requiring a page reload

**AC-3.5:** Syntax highlighting failures fall back to monospace without warnings

- **TC-3.5a: Highlighting engine error**
  - Given: A code block is tagged with a supported language but the highlighting engine throws an error during tokenization
  - When: Document is rendered
  - Then: The code block falls back to plain monospace rendering (same as Epic 2). No warning is shown — the content is still fully readable, just unhighlighted. The rest of the document renders normally.
- **TC-3.5b: Grammar fails to load**
  - Given: A code block is tagged with a supported language but the grammar definition fails to load
  - When: Document is rendered
  - Then: The code block falls back to plain monospace rendering. No warning is shown. Other code blocks with different languages are not affected.
  - Note: Syntax highlighting failures are silent fallbacks (monospace is always readable), unlike Mermaid failures which produce a materially different output and warrant warnings.

### 4. Rich Table Content

Epic 2 delivered basic table rendering: headers, column alignment, and
horizontal scroll for wide tables. markdown-it's table parser handles inline
formatting in cells (bold, italic, code spans, links) as part of its baseline —
that behavior shipped with Epic 2.

This flow addresses the stress cases that real-world tables create: many columns
combined with complex cell content, layout stability under varying content
widths, and graceful handling of content that standard markdown table syntax
cannot represent (nested lists, multi-line cells).

1. User opens a document with tables containing complex or adversarial content
2. Cell content renders correctly where the syntax supports it
3. Table layout remains stable regardless of cell content complexity
4. Content that markdown table syntax cannot represent degrades gracefully

#### Acceptance Criteria

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

Standard markdown pipe-table syntax is single-line-per-cell and does not support
block-level content (lists, multi-line paragraphs) inside cells. Real-world
documents sometimes attempt this anyway.

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

### 5. Error Handling

Mermaid rendering failures integrate with Epic 2's existing warning
infrastructure. Syntax highlighting failures degrade silently to monospace
(AC-3.5). The app never crashes due to rendering issues in either system.

#### Acceptance Criteria

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

---

## Data Contracts

### RenderWarning Extension

Epic 2's `RenderWarning` type is extended with Mermaid error:

```typescript
interface RenderWarning {
  type: "missing-image" | "remote-image-blocked" | "unsupported-format" | "mermaid-error";
  source: string;         // the Mermaid source text or image path. For Mermaid errors, truncated to the first 200 characters if the source exceeds 200 characters, with "..." appended.
  line?: number;          // line number in the source markdown, if available
  message: string;        // human-readable description (e.g., "Syntax error: unexpected token")
}
```

### MermaidBlockResult

The output of the Mermaid rendering step for each code block, covering both
success and error cases:

```typescript
interface MermaidBlockResult {
  status: "success" | "error";
  svg?: string;              // rendered SVG markup on success
  source: string;            // raw Mermaid source text (always preserved)
  error?: string;            // error message on failure
  diagramType?: string;      // detected type: "flowchart", "sequence", etc.
}
```

### FileReadResponse

No changes to `FileReadResponse`. The response shape is unchanged — it delivers
raw markdown content. Mermaid rendering and syntax highlighting are client-side
post-processing steps that transform the raw markdown into rendered output,
consistent with Epic 2's architecture (viewing renders client-side from
server-provided raw content). The data contract between the rendering pipeline
and the display layer uses `MermaidBlockResult` above.

### API Surface

No new endpoints. Epic 3 uses the existing `/api/file` endpoint from Epic 2.
Mermaid and syntax highlighting extend the rendering pipeline, not the API
surface.

### Error Responses

No new API error codes. Mermaid and syntax highlighting errors are surfaced
through `RenderWarning` in the existing rendering output, not through HTTP
error codes.

---

## Dependencies

Technical dependencies:
- Epic 2 complete: markdown rendering pipeline, warning infrastructure, file watching, content toolbar with warning count
- Mermaid rendering library (confirmed in tech design)
- Syntax highlighting library (confirmed in tech design)

Process dependencies:
- Epic 2 tech design and implementation complete before Epic 3 implementation begins

---

## Non-Functional Requirements

### Performance
- Mermaid diagrams render within 5 seconds per diagram for typical complexity (under 50 nodes/edges)
- Syntax highlighting adds no perceptible delay to document rendering for files under 500KB
- Documents with 10+ Mermaid diagrams render without freezing the UI
- Theme switching updates diagrams and code highlighting without perceptible delay for typical documents (under 10 diagrams). Documents with many diagrams may have a brief visible update; the UI must not freeze.

### Rendering Consistency
- Mermaid output is SVG (not canvas) so diagrams can be embedded in PDF, DOCX, and HTML exports (Epic 4)
- Syntax highlighting output is structured HTML with CSS-based coloring (not inline bitmap rendering) so exports can include highlighted code
- Per the PRD, exported output should closely match what the user sees in the viewer. This does not require identical rendering artifacts — visually equivalent output from a separate export rendering path is acceptable. The specific handoff mechanism (shared artifacts vs. separate render) is an Epic 4 tech design decision.

### Security
- Mermaid rendering is sandboxed — diagram definitions cannot execute arbitrary JavaScript
- Syntax highlighting does not execute code block contents
- No remote resources are fetched during Mermaid rendering or syntax highlighting

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. **Mermaid rendering location:** Epic 2 established that viewing renders client-side from server-provided raw content. Mermaid rendering should extend this client-side pipeline for viewing. However, Epic 4 export will need server-side rendering. Should Mermaid rendering be structured to run in both environments from the start, or should client-side viewing and server-side export use separate rendering paths?
2. **Syntax highlighting library:** Shiki, Prism, or Highlight.js? Trade-offs include bundle size, language coverage, theme support, and whether highlighting runs at build time, server-side, or client-side.
3. **Mermaid theme mapping:** Mermaid.js has built-in themes (default, dark, forest, neutral). How should the app's 4 themes map to Mermaid's theme options? Should the mapping use Mermaid's `theme` config, CSS variable overrides, or post-render SVG manipulation?
4. **Mermaid rendering timeout:** What timeout value per diagram? How is it enforced (Web Worker, AbortController, separate process)? Should the timeout be configurable?
5. **Mermaid security sandboxing:** Mermaid.js has a `securityLevel` config option. What level should be used? How is XSS from diagram definitions prevented?
6. **Syntax highlighting theme mapping:** How should the app's 4 themes map to highlighting color schemes? One light and one dark scheme, or a distinct scheme per app theme?
7. **Large Mermaid diagrams:** Should very complex diagrams (100+ nodes) trigger a warning or degrade to a scrollable view? What is the practical rendering limit?
8. **Code highlighting and Mermaid in re-render on theme switch:** Should diagrams and code blocks re-render on theme switch, or should CSS handle the adaptation without re-rendering the content?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

Types, test fixtures, and rendering pipeline preparation needed by all Epic 3
stories.

- `RenderWarning` type extension with `"mermaid-error"`
- Test fixtures: sample Mermaid blocks (valid flowchart, sequence, class, state, gantt, ER, pie; invalid syntax; empty block; extremely complex diagram)
- Test fixtures: code blocks with various languages (JS, TS, Python, Go, Rust, SQL, YAML, JSON, Bash, HTML, CSS; unknown language; no language; aliases)
- Test fixtures: tables with nested content (inline formatting, links, code spans, mixed widths, many columns)
- Rendering pipeline integration point for Mermaid and highlighting libraries

### Story 1: Mermaid Diagram Rendering

**Delivers:** User opens a document with Mermaid code blocks and sees rendered diagrams inline, properly sized and themed.
**Prerequisite:** Story 0, Epic 2 complete
**ACs covered:**
- AC-1.1 (Mermaid blocks render as diagrams)
- AC-1.2 (diagram sizing)
- AC-1.3 (theme adaptation)
- AC-1.4 (multiple diagrams)
- AC-1.5 (placeholder replacement)
- AC-1.6 (diagrams are static, click directives stripped)

**Estimated test count:** 16 tests

### Story 2: Mermaid Error Handling

**Delivers:** Invalid Mermaid blocks show raw source with error banner; failures appear in warning count.
**Prerequisite:** Story 1
**ACs covered:**
- AC-2.1 (error fallback display)
- AC-2.2 (warning count integration)
- AC-2.3 (non-blocking rendering)

**Estimated test count:** 9 tests

### Story 3: Code Syntax Highlighting

**Delivers:** Code blocks with language tags render with language-aware syntax highlighting that adapts to the active theme.
**Prerequisite:** Story 0, Epic 2 complete
**ACs covered:**
- AC-3.1 (language-aware highlighting)
- AC-3.2 (supported languages)
- AC-3.3 (fallback for unknown/missing language)
- AC-3.4 (theme adaptation)
- AC-3.5 (highlighting failure fallback to monospace)

**Estimated test count:** 14 tests

### Story 4: Rich Table Content and Error Handling

**Delivers:** Tables with complex content render correctly; rendering errors integrate cleanly with file watching and warning infrastructure.
**Prerequisite:** Story 0, Epic 2 complete (table ACs use inline formatting, links, and code spans — all baseline rendering, no dependency on syntax highlighting)
**ACs covered:**
- AC-4.1 (inline markdown in table cells)
- AC-4.2 (stable layout with complex content)
- AC-4.3 (graceful degradation for unsupported table content)
- AC-5.1 (rendering errors don't crash app)
- AC-5.2 (file watching with rich content)

**Estimated test count:** 13 tests

---

## Amendments

### Amendment 1: Table scope clarification vs. PRD (2026-03-20)

**Changed:** Flow 4 (Rich Table Content), AC-4.3, In Scope bullet for tables, Assumption A8
**Reason:** The PRD (Feature 3) says "Tables with complex content (nested lists, code, multi-line cells) render correctly." Standard markdown pipe-table syntax is single-line-per-cell and does not support block-level content (lists, multi-line paragraphs) in cells — this is a parser limitation, not a product decision. The epic clarifies: pipe tables support inline content only (formatting, links, code spans); block-level content in table cells requires raw HTML `<table>` markup, which Epic 2's HTML pass-through already renders (AC-2.9). AC-4.3 specifies the graceful degradation behavior when users attempt block-level content in pipe-table cells. This is not a narrowing of the user-facing promise — users who need lists in table cells can use HTML tables, and those render correctly.

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
- [x] Stories sequence logically (rendering before errors, core before edge cases)
- [x] All dependencies on Epic 2 are explicit
- [x] Handoff points to Epic 4 (export) are documented
- [x] Rendering consistency constraints are documented for Tech Lead
- [x] PRD table scope clarification tracked as Amendment 1
- [x] Rendering-location inherits Epic 2's client-side architecture (A6 corrected)
- [x] Self-review complete
- [x] Verification round 1 complete (Codex)
- [x] Critical and major issues from verification round 1 addressed
- [ ] Validation rounds complete (pending final sign-off)
