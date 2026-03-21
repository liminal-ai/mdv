# Story 2: Mermaid Error Handling

### Summary
<!-- Jira: Summary field -->

Invalid Mermaid blocks show raw source with an error banner; failures integrate with the warning count and panel.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** Reviewing documents that contain architecture diagrams (Mermaid), code samples across multiple languages, and data-heavy tables with nested content. These are real-world files, not pristine samples — some Mermaid will have syntax errors, some code blocks will lack language tags, some tables will have complex cell content.
- **Mental Model:** "I open a doc, the diagrams render, the code is highlighted, the tables look right. If something can't render, I see what went wrong."
- **Key Constraint:** All rendering is local — no remote services. Mermaid diagrams and syntax highlighting must adapt to the active theme (light/dark).

**Objective:** When a Mermaid code block fails to render (syntax error, empty content, timeout), the raw source is displayed in a monospace code block with an error banner. The failure is added to Epic 2's warning count in the content toolbar. Valid Mermaid blocks and all other document content are unaffected by individual block failures.

**Scope — In:**
- Error fallback display: raw Mermaid source in a monospace code block with error banner
- Error banner content: visual error indicator, brief failure description, raw source is selectable
- Partial success: valid blocks render as diagrams, invalid blocks show error fallback
- Empty Mermaid blocks show error fallback with "diagram definition is empty" message
- Warning count integration: Mermaid failures increment the warning count
- Warning panel detail: Mermaid errors listed with type, description, and line number if available
- No warnings for successful diagrams
- Non-blocking rendering: Mermaid failures do not block the rest of the document
- Rendering timeout: complex diagrams that exceed the timeout show error fallback with timeout message

**Scope — Out:**
- Mermaid rendering of valid diagrams (Story 1)
- Syntax highlighting (Story 3)
- Custom error messages or user-configurable timeout values
- Mermaid editing or debugging tools

**Dependencies:** Story 1

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Mermaid errors produce `RenderWarning` entries with type `"mermaid-error"`:

```typescript
interface RenderWarning {
  type: "missing-image" | "remote-image-blocked" | "unsupported-format" | "mermaid-error";
  source: string;         // the Mermaid source text, truncated to 200 characters with "..." appended if longer
  line?: number;          // line number in the source markdown, if available
  message: string;        // human-readable description (e.g., "Syntax error: unexpected token")
}
```

Error `MermaidBlockResult`:

```typescript
interface MermaidBlockResult {
  status: "success" | "error";
  svg?: string;              // rendered SVG markup on success
  source: string;            // raw Mermaid source text (always preserved)
  error?: string;            // error message on failure
  diagramType?: string;      // detected type: "flowchart", "sequence", etc.
}
```

Story 2 exercises the error path (`status: "error"`). The full interface is included here for contract completeness — see Story 1 for the success path.

Warning integration uses Epic 2's existing warning infrastructure — the warning count in the content toolbar and the warning panel. No new API endpoints or error codes; Mermaid errors are surfaced through `RenderWarning` in the rendering output.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Syntax errors in Mermaid blocks show raw source with error banner
- [ ] Error banner includes visual indicator, failure description, and selectable raw source
- [ ] Partial success: valid blocks render, invalid blocks show fallback
- [ ] Empty Mermaid blocks show "diagram definition is empty" message
- [ ] Mermaid failures increment the warning count
- [ ] Warning panel lists Mermaid errors with type, description, and line number
- [ ] Successful diagrams produce no warnings
- [ ] Mermaid failures do not block the rest of the document
- [ ] Rendering timeout produces error fallback with timeout message
- [ ] All 9 TCs pass
- [ ] No regressions in existing Epic 2 functionality
