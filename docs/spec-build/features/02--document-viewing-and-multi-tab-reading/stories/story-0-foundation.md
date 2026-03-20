# Story 0: Foundation (Infrastructure)

### Summary
<!-- Jira: Summary field -->

Types, interfaces, test fixtures, and endpoint stubs for all Epic 2 stories.

### Description
<!-- Jira: Description field -->

**User Profile:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts. Browsing and reading markdown files across local workspaces.

**Objective:** Establish shared plumbing so Stories 1–7 can build on stable types, consistent test data, and stubbed endpoints.

**Scope — In:**
- `FileReadRequest`, `FileReadResponse`, `RenderWarning`, `FileChangeEvent`, `TabState` type definitions
- `FilePickerResponse` type
- `SessionState` extension with `defaultOpenMode` field
- Error response types for new error codes (INVALID_PATH, PERMISSION_DENIED, FILE_NOT_FOUND, NOT_MARKDOWN, READ_ERROR)
- Test fixtures: sample markdown files covering each rendering construct (headings, lists, task lists, tables, code blocks, images, links, blockquotes, horizontal rules, raw HTML)
- Test fixtures: edge case files (missing images, remote image references, malformed markdown, very long lines, binary `.md` file, empty 0-byte file, file with script tags)
- Server endpoint stubs for `/api/file`, `/api/file/pick`, `/api/file/watch`, `/api/session/default-mode`, `/api/session/recent-files`

**Scope — Out:**
- Any functional behavior — stubs return 501 Not Implemented
- Rendering logic
- UI components

**Dependencies:** Epic 1 complete (server runtime, session persistence, existing types)

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

All data contracts defined in the epic belong here:

```typescript
interface FileReadRequest {
  path: string;       // absolute path to the markdown file
}

interface FileReadResponse {
  path: string;           // the requested path
  canonicalPath: string;  // resolved absolute path (for duplicate detection only)
  filename: string;       // basename (e.g., "architecture.md")
  content: string;        // raw markdown text
  modifiedAt: string;     // ISO 8601 UTC
  size: number;           // file size in bytes
}

interface FilePickerResponse {
  path: string;       // absolute path to selected file
} | null              // null if user cancelled

interface RenderWarning {
  type: "missing-image" | "remote-image-blocked" | "unsupported-format";
  source: string;
  line?: number;
  message: string;
}

interface FileChangeEvent {
  path: string;
  event: "modified" | "deleted" | "created";
}

interface TabState {
  id: string;
  path: string;
  filename: string;
  scrollPosition: number;
  content: string;
  renderedAt: string;
  warnings: RenderWarning[];
}

// SessionState extension (adds to Epic 1's SessionState)
interface SessionState {
  // ... all Epic 1 fields ...
  defaultOpenMode: "render" | "edit";  // only "render" accepted in Epic 2
}
```

Error responses:

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_PATH | Path is not absolute or contains invalid characters |
| 403 | PERMISSION_DENIED | Filesystem permission denied |
| 404 | FILE_NOT_FOUND | File does not exist |
| 415 | NOT_MARKDOWN | File does not have a recognized markdown extension |
| 500 | READ_ERROR | Unexpected error reading the file |

API surface (stubs only):

| Method | Path | Notes |
|--------|------|-------|
| GET | /api/file | Read markdown file content and metadata |
| POST | /api/file/pick | Open server-side file picker |
| GET | /api/file/watch | SSE stream for file changes |
| PUT | /api/session/default-mode | Set default open mode |
| POST | /api/session/recent-files | Add/update recent file entry |
| DELETE | /api/session/recent-files | Remove recent file entry |

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All type definitions compile with no errors
- [ ] All test fixture files exist and are loadable
- [ ] All endpoint stubs are registered and return 501
- [ ] SessionState extension is backward-compatible with Epic 1 data
- [ ] No existing Epic 1 tests broken
