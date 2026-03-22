# Story 0: Foundation (Infrastructure)

### Summary
<!-- Jira: Summary field -->

Types, test fixtures, endpoint stubs, and session state extension for all Epic 4 stories.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user has reviewed a rendered document in the viewer and needs to share it with someone who does not work in markdown — a stakeholder, a compliance reviewer, a client. They need the output in a format the recipient can open without tooling.
- **Mental Model:** "I click Export, pick a format, and get a good file. I don't want to configure anything."
- **Key Constraint:** Export runs locally — no cloud conversion services. Good defaults matter more than configurability. The exported output should closely match what the user sees in the viewer.

**Objective:** Establish shared plumbing so Stories 1–6 can build on stable types, consistent test data, and stubbed endpoints.

**Scope — In:**
- `ExportRequest`, `ExportResponse`, `ExportWarning` type definitions
- `SessionState` extension with `lastExportDir` field
- New error codes: `INVALID_FORMAT`, `EXPORT_ERROR`, `INSUFFICIENT_STORAGE`
- Server endpoint stubs for `/api/export`, `/api/export/save-dialog`, `/api/export/reveal`, `/api/session/last-export-dir`
- Test fixtures: sample documents with varied content (plain text, images, Mermaid diagrams, code blocks, tables, degraded content)

**Scope — Out:**
- Any functional behavior — stubs return 501 Not Implemented
- Export engine integration
- UI components

**Dependencies:** Epics 1–3 complete (server runtime, rendering pipeline, session persistence, existing types)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

Story 0 has no user-facing acceptance criteria. It delivers types, test fixtures, endpoint stubs, and session state extensions consumed by Stories 1–6. Verification is via the Definition of Done checklist below.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

All data contracts defined in the epic belong here:

```typescript
interface ExportRequest {
  path: string;            // absolute path to the source markdown file
  format: "pdf" | "docx" | "html";
  savePath: string;        // absolute path for the output file (from save dialog)
  theme: string;           // active viewer theme (used for HTML export)
}

interface ExportResponse {
  status: "success";
  outputPath: string;      // absolute path of the exported file
  warnings: ExportWarning[];
}

interface ExportWarning {
  type:
    | "missing-image"           // image file not found on disk
    | "remote-image-blocked"    // http/https image not loaded
    | "mermaid-error"           // Mermaid diagram failed to render
    | "unsupported-format"      // image format not renderable
    | "format-degradation";     // content simplified for target format
  source: string;          // image path, URL, Mermaid source, or element description (truncated to 200 chars)
  line?: number;           // line number in source markdown, if available
  message: string;         // human-readable description of what was degraded
}

// SessionState extension (adds to Epics 1–3 SessionState)
interface SessionState {
  // ... all Epic 1–3 fields ...
  lastExportDir: string | null;  // last-used export directory, or null if never exported
}
```

Error responses:

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_PATH | Source or save path is not absolute or is invalid |
| 400 | INVALID_FORMAT | Format is not one of: pdf, docx, html |
| 403 | PERMISSION_DENIED | Cannot write to the specified save path |
| 404 | FILE_NOT_FOUND | Source markdown file does not exist |
| 409 | EXPORT_IN_PROGRESS | Another export is already running |
| 500 | EXPORT_ERROR | Export engine failed (rendering, conversion, or write error) |
| 507 | INSUFFICIENT_STORAGE | Target disk has insufficient space |

API surface (stubs only):

| Method | Path | Notes |
|--------|------|-------|
| POST | /api/export | Trigger export; blocks until complete |
| POST | /api/export/save-dialog | Open server-side save dialog |
| POST | /api/export/reveal | Reveal file in system file manager |
| PUT | /api/session/last-export-dir | Update last-used export directory |

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All type definitions compile with no errors
- [ ] All test fixture files exist and are loadable
- [ ] All endpoint stubs are registered and return 501
- [ ] `SessionState` extension with `lastExportDir` is backward-compatible with Epic 1–3 data
- [ ] New error codes (`INVALID_FORMAT`, `EXPORT_ERROR`, `INSUFFICIENT_STORAGE`) are defined
- [ ] No existing Epic 1–3 tests broken
