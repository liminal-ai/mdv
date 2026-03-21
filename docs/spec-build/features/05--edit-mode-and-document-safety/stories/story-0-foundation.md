# Story 0: Foundation (Infrastructure)

### Summary
<!-- Jira: Summary field -->

Types, interfaces, error codes, endpoint stubs, and test fixtures for all Epic 5 stories.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user is reviewing a rendered document and spots something to fix — a typo, a broken link, a section that needs updating. They want to make the edit in place without switching to a separate tool. They may be working alongside AI agents that are also modifying files on disk.
- **Mental Model:** "I see something wrong, I switch to edit mode, I fix it, I save. If something goes wrong — accidental close, external change — the app protects me."
- **Key Constraint:** Editing is secondary to viewing. The editor is for quick corrections and light authoring, not a full IDE replacement. Document safety (no lost work) is non-negotiable.

**Objective:** Establish shared plumbing so Stories 1–6 can build on stable types, consistent test data, and stubbed endpoints.

**Scope — In:**
- `TabState` extension with `mode`, `editContent`, `cursorPosition`, `dirty` fields
- `FileSaveRequest`, `FileSaveResponse` type definitions
- New error codes: `WRITE_ERROR`, `CONFLICT`, `NOT_MARKDOWN`, `INSUFFICIENT_STORAGE`
- Server endpoint stubs for `PUT /api/file`, `POST /api/file/save-dialog`
- Test fixtures: sample documents for editing (short, long, binary, read-only)
- `defaultOpenMode: "edit"` validation enabled in session endpoint

**Scope — Out:**
- Any functional behavior — stubs return 501 Not Implemented
- Editor component integration
- UI components
- Save logic

**Dependencies:** Epics 1–4 complete (server runtime, rendering pipeline, file watching, content toolbar, export, session persistence)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

Story 0 has no user-facing acceptance criteria. It delivers types, test fixtures, and endpoint stubs consumed by Stories 1–6. Verification is via the Definition of Done checklist below.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

TabState extension (adds to Epic 2's TabState):

```typescript
interface TabState {
  // ... all Epic 2 fields ...
  mode: "render" | "edit";
  editContent: string | null;   // current editor buffer; null when mode is "render" and no edits have been made
  cursorPosition: {
    line: number;               // 1-based
    column: number;             // 1-based
  } | null;
  dirty: boolean;               // true when editContent differs from content (last-loaded version)
}
```

File Save API:

```typescript
interface FileSaveRequest {
  path: string;              // absolute path to write to
  content: string;           // markdown content to write
  expectedModifiedAt?: string | null; // ISO 8601 UTC — the modifiedAt timestamp the client last loaded.
                              // Server compares against current file mtime before writing.
                              // If they don't match, the file changed since the client loaded it
                              // and the server returns 409 CONFLICT instead of writing.
                              // For Save As to a new path (file doesn't exist yet), this field
                              // is omitted or null.
}

interface FileSaveResponse {
  path: string;           // the path that was written
  modifiedAt: string;     // ISO 8601 UTC, new modification time after write
  size: number;           // new file size in bytes
}
```

File Save As (uses save dialog):

```typescript
// Uses the same server-side save dialog pattern as Epic 4's export save dialog
// Request: { defaultPath: string, defaultFilename: string }
// Response: { path: string } | null (null if cancelled)
```

Error responses:

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_PATH | Path is not absolute or contains invalid characters |
| 403 | PERMISSION_DENIED | Cannot write to the specified path |
| 404 | PATH_NOT_FOUND | The parent directory does not exist |
| 500 | WRITE_ERROR | Unexpected error during file write |
| 409 | CONFLICT | File on disk has a different modifiedAt than expectedModifiedAt — external change detected |
| 415 | NOT_MARKDOWN | Save path does not have a recognized markdown extension |
| 507 | INSUFFICIENT_STORAGE | Target disk has insufficient space |

API surface (stubs only):

| Method | Path | Request | Notes |
|--------|------|---------|-------|
| PUT | /api/file | `FileSaveRequest` | Write content to a file path; atomic write (temp + rename) |
| POST | /api/file/save-dialog | `{ defaultPath: string, defaultFilename: string }` | Open server-side save dialog for Save As; returns selected path or null |

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All type definitions compile with no errors
- [ ] `TabState` extension is backward-compatible with Epic 2 tab state
- [ ] `FileSaveRequest` and `FileSaveResponse` types are defined and exported
- [ ] All new error codes are defined (WRITE_ERROR, CONFLICT, NOT_MARKDOWN, INSUFFICIENT_STORAGE, PATH_NOT_FOUND)
- [ ] All test fixture files exist and are loadable (short, long, binary, read-only documents)
- [ ] All endpoint stubs are registered and return 501
- [ ] `defaultOpenMode: "edit"` is accepted by session validation (no longer rejected)
- [ ] No existing Epics 1–4 tests broken
- [ ] No regressions in existing Epics 1–4 functionality
