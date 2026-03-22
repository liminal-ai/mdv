# Story 0: Foundation (Infrastructure)

### Summary
<!-- Jira: Summary field -->

Types, test fixtures, and rendering pipeline preparation for all Epic 3 stories.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** Reviewing documents that contain architecture diagrams (Mermaid), code samples across multiple languages, and data-heavy tables with nested content. These are real-world files, not pristine samples — some Mermaid will have syntax errors, some code blocks will lack language tags, some tables will have complex cell content.
- **Mental Model:** "I open a doc, the diagrams render, the code is highlighted, the tables look right. If something can't render, I see what went wrong."
- **Key Constraint:** All rendering is local — no remote services. Mermaid diagrams and syntax highlighting must adapt to the active theme (light/dark).

**Objective:** Establish shared types, test fixtures, and rendering pipeline integration points so Stories 1–4 can build on stable infrastructure.

**Scope — In:**
- `RenderWarning` type extension with `"mermaid-error"` variant
- `MermaidBlockResult` type definition (success and error cases)
- Test fixtures: sample Mermaid blocks (valid flowchart, sequence, class, state, gantt, ER, pie, mindmap; invalid syntax; empty block; extremely complex diagram)
- Test fixtures: code blocks with various languages (JavaScript, TypeScript, Python, Go, Rust, SQL, YAML, JSON, Bash, HTML, CSS, Markdown, TOML, Dockerfile; unknown language; no language tag; aliases like `js`, `ts`, `py`, `sh`, `yml`)
- Test fixtures: tables with complex content (inline formatting, links, code spans, mixed content widths, many columns, pipe characters in content, list syntax in cells, HTML tables with block content)
- Rendering pipeline integration point for Mermaid and syntax highlighting libraries

**Scope — Out:**
- Mermaid rendering logic (Story 1)
- Mermaid error handling and warning integration (Story 2)
- Syntax highlighting logic (Story 3)
- Table rendering behavior (Story 4 — table rendering uses Epic 2's markdown-it baseline; fixtures here support verification)
- Any user-facing behavior

**Dependencies:** Epic 2 complete (markdown rendering pipeline, warning infrastructure, file watching, content toolbar with warning count)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

Story 0 has no user-facing acceptance criteria. It delivers types, test fixtures, and pipeline integration points consumed by Stories 1–4. Verification is via the Definition of Done checklist below.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Extended `RenderWarning` type:

```typescript
interface RenderWarning {
  type: "missing-image" | "remote-image-blocked" | "unsupported-format" | "mermaid-error";
  source: string;         // the Mermaid source text or image path. For Mermaid errors, truncated to the first 200 characters if the source exceeds 200 characters, with "..." appended.
  line?: number;          // line number in the source markdown, if available
  message: string;        // human-readable description (e.g., "Syntax error: unexpected token")
}
```

`MermaidBlockResult` type:

```typescript
interface MermaidBlockResult {
  status: "success" | "error";
  svg?: string;              // rendered SVG markup on success
  source: string;            // raw Mermaid source text (always preserved)
  error?: string;            // error message on failure
  diagramType?: string;      // detected type: "flowchart", "sequence", etc.
}
```

No new API endpoints. Epic 3 uses the existing `/api/file` endpoint from Epic 2. Mermaid and syntax highlighting extend the client-side rendering pipeline, not the API surface.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `RenderWarning` type extended with `"mermaid-error"` and compiles with no errors
- [ ] `MermaidBlockResult` type defined and compiles with no errors
- [ ] Extended `RenderWarning` is backward-compatible with Epic 2's existing warning types
- [ ] All Mermaid test fixture files exist and are loadable (valid: flowchart, sequence, class, state, gantt, ER, pie, mindmap; invalid: syntax error, empty, complex)
- [ ] All code block test fixture files exist (core languages, aliases, unknown, no tag)
- [ ] All table test fixture files exist (inline formatting, links, code spans, mixed widths, many columns, pipe chars, list syntax, HTML tables)
- [ ] Rendering pipeline integration point is stubbed for Mermaid and highlighting libraries
- [ ] No regressions in existing Epic 2 functionality
