# Story 0: Foundation (Infrastructure)

## Summary
<!-- Jira: Summary field -->
Project scaffolding, shared types, Fastify server setup, and test framework configuration.

## Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts. Launching a local tool to browse directories full of markdown files. Must run locally from Node without app signing, admin access, or cloud dependencies.

**Objective:** Establish the project foundation so all subsequent stories build on a common base — TypeScript config, shared type definitions, Fastify server with static serving, and test infrastructure.

**Scope:**
- In: TypeScript project config, shared type definitions (SessionState, Workspace, RecentFile, ThemeId, TreeNode, FileTreeRequest, FileTreeResponse, error codes), shared error primitives (error code enum/constants, structured error response shape), Fastify server scaffold, static file serving, test framework setup, shared test fixtures (mock session state factory, mock tree node factory, temp directory helpers)
- Out: Any UI rendering, business logic, or user-facing behavior

**Dependencies:** None — this is the first story.

## Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

No user-facing ACs. Foundation stories establish shared plumbing. Acceptance is confirmed by:
- TypeScript compiles cleanly
- Shared types are importable from both server and client code
- Fastify starts and serves a static HTML page on localhost
- Test framework runs and at least one smoke test passes

## Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

```typescript
interface SessionState {
  workspaces: Workspace[];
  lastRoot: string | null;
  recentFiles: RecentFile[];
  theme: ThemeId;
  sidebarState: {
    workspacesCollapsed: boolean;
  };
}

interface Workspace {
  path: string;       // absolute path
  label: string;      // directory name, or user-customized label (future)
  addedAt: string;    // ISO 8601 UTC
}

interface RecentFile {
  path: string;       // absolute path
  openedAt: string;   // ISO 8601 UTC, last opened time
}

// Recent files list is capped at 20 entries, oldest dropped on overflow.
// Epic 1 owns the data structure and persistence; Epic 2 populates it when files are opened.

type ThemeId = string; // e.g., "light-default", "light-warm", "dark-default", "dark-cool"

interface FileTreeRequest {
  root: string;       // absolute path to scan
}

interface FileTreeResponse {
  root: string;
  tree: TreeNode[];
}

interface TreeNode {
  name: string;           // filename or directory name
  path: string;           // absolute path
  type: "file" | "directory";
  children?: TreeNode[];  // only for directories
  mdCount?: number;       // markdown descendant count, only for directories
}
```

Error response codes:

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_PATH | Path is not absolute or contains invalid characters |
| 403 | PERMISSION_DENIED | Filesystem permission denied on the requested path |
| 404 | PATH_NOT_FOUND | The requested directory does not exist |
| 500 | SCAN_ERROR | Unexpected error during directory scan |

*See the tech design document for full architecture, implementation targets, and test mapping.*

## Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] TypeScript compiles with no errors
- [ ] All shared types are exported and importable
- [ ] Shared error primitives (error codes, structured response shape) exported
- [ ] Shared test fixtures (session factory, tree node factory, temp dir helpers) available
- [ ] Fastify starts and serves static files on localhost
- [ ] Test framework configured and smoke test passes
- [ ] Linting passes
