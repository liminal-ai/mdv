# Story 2: Multi-File Reading and Content Budget

---

### Summary
<!-- Jira: Summary field -->

The Steward can read any file in the workspace by relative path via the `getFileContent` script method, with path traversal prevention, per-response read budget, large file truncation, and binary file rejection.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Working within spec packages containing PRDs, epics, tech designs, and stories. The Steward already knows what document is open (Epic 12) but cannot see the broader package structure, read other files, create new files, or understand where the user is in the spec lifecycle.

**Objective:** The Steward can read files beyond the active document by emitting `<steward-script>` blocks calling `getFileContent(path)`. This enables cross-document queries — the developer asks a question requiring information from multiple files, and the Steward reads the relevant files and synthesizes an answer. A per-response read budget (300K characters) caps cumulative reads per response turn. Large files are truncated consistent with Epic 12's document truncation pattern. Binary files are rejected. Path traversal outside the workspace root is blocked server-side.

**Scope:**

In scope:
- `getFileContent(path)` script method in `buildExtendedScriptContext()`
- `resolveAndValidate(path, root)` utility for path traversal prevention
- `ReadBudgetTracker` class: per-message character budget (300K), `canConsume()`, `consume()`, `remaining`
- File truncation at 100K characters (same budget as active document in Epic 12)
- Binary file detection: null byte check in first 8KB
- Works in both package mode (resolve against `extractedRoot`) and folder mode (resolve against `lastRoot`)

Out of scope:
- File creation/editing (Story 4)
- Package operations (Story 3)
- Spec awareness integration (Story 5)

**Dependencies:**
- Story 1 complete (package context, provider manager `setScriptContext`)
- Epics 10, 12 complete (script execution lane, `buildScriptContext` pattern)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-2.1:** The Steward can read any file in the workspace by relative path via the `getFileContent` script method

- **TC-2.1a: Read a file by relative path**
  - Given: A package is open containing `docs/prd.md`
  - When: A script block calls `getFileContent('docs/prd.md')`
  - Then: The method returns the file's content as a string

- **TC-2.1b: Read a file by navigation display name path**
  - Given: A package manifest maps display name "Product Requirements" to `docs/prd.md`
  - When: The developer asks about "Product Requirements" and the Steward resolves the path from the manifest
  - Then: The Steward reads the correct file (verifiable by confirming the script call uses the resolved path)

- **TC-2.1c: File not found**
  - Given: A workspace is open
  - When: A script block calls `getFileContent('nonexistent.md')`
  - Then: The method returns an error indicating the file was not found

- **TC-2.1d: Path traversal blocked**
  - Given: A workspace is open with root `/Users/dev/project`
  - When: A script block calls `getFileContent('../../etc/passwd')`
  - Then: The method returns an error; the file outside the workspace root is not read

**AC-2.2:** The Steward can read multiple files within a single response to answer cross-document queries

- **TC-2.2a: Two-file comparison**
  - Given: A package contains `prd.md` and `epic.md`
  - When: The developer asks a question requiring both files
  - Then: The Steward can call `getFileContent` for both files within the same response turn (verifiable by observing two script block executions)

- **TC-2.2b: Multiple files read sequentially**
  - Given: A package contains five documents
  - When: The Steward emits script blocks to read three of them
  - Then: All three script results are returned to the CLI, and the Steward has access to all three file contents for its response

- **TC-2.2c: Per-response read budget exceeded**
  - Given: A package is open and the Steward has already read files totaling the per-response budget in the current response turn
  - When: The Steward calls `getFileContent` for an additional file
  - Then: The method returns an error indicating the per-response read budget is exhausted; no content is returned. The Steward can still complete its response using the files already read.

- **TC-2.2d: Read budget resets on new response**
  - Given: The previous response exhausted the read budget
  - When: The developer sends a new message and the Steward calls `getFileContent`
  - Then: The read succeeds — the budget applies per response turn, not per conversation

**AC-2.3:** Large files read via `getFileContent` are truncated with a notification, consistent with Epic 12's document truncation pattern

- **TC-2.3a: File within budget returned fully**
  - Given: A workspace file is under the size budget (e.g., under 5,000 lines)
  - When: A script block calls `getFileContent` for that file
  - Then: The full content is returned

- **TC-2.3b: Large file truncated with indicator**
  - Given: A workspace file exceeds the size budget
  - When: A script block calls `getFileContent` for that file
  - Then: The returned content is truncated; the result includes a `truncated: true` flag and the total line count

- **TC-2.3c: Binary or non-text file rejected**
  - Given: A workspace contains a binary file (e.g., `image.png`)
  - When: A script block calls `getFileContent` for that file
  - Then: The method returns an error indicating the file is not a text file

**AC-2.4:** File reading works in both package mode and folder mode

- **TC-2.4a: Read file in folder mode**
  - Given: A regular folder is open containing `docs/spec.md`
  - When: A script block calls `getFileContent('docs/spec.md')`
  - Then: The method returns the file's content

- **TC-2.4b: Read file in extracted package**
  - Given: A `.mpk` package is open (extracted to temp directory) containing `docs/spec.md`
  - When: A script block calls `getFileContent('docs/spec.md')`
  - Then: The method reads from the extracted temp directory and returns the file's content

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### getFileContent Implementation

In `app/src/server/services/script-executor.ts`, within `buildExtendedScriptContext()`:

```typescript
getFileContent: async (path: string): Promise<FileReadResult> => {
  const resolved = resolveAndValidate(path, workspaceRoot);
  // stat() to check exists
  // readFile() as buffer
  // Binary detection: null bytes in first 8KB
  // Check read budget via readBudget.canConsume(content.length)
  // Apply truncation if content.length > FILE_TRUNCATION_CHARS (100K)
  // readBudget.consume(content.length)
  // Return { content, truncated, totalLines? }
}
```

#### Path Traversal Prevention

```typescript
function resolveAndValidate(relativePath: string, root: string): string {
  const resolved = resolve(root, relativePath);
  if (!resolved.startsWith(root + '/') && resolved !== root) {
    throw new Error(`Path outside workspace root: ${relativePath}`);
  }
  return resolved;
}
```

#### ReadBudgetTracker

New module `app/src/server/services/read-budget.ts`:

```typescript
const READ_BUDGET_CHARS = 300_000;

export class ReadBudgetTracker {
  private consumed = 0;

  canConsume(chars: number): boolean {
    return (this.consumed + chars) <= READ_BUDGET_CHARS;
  }

  consume(chars: number): void {
    this.consumed += chars;
  }

  get remaining(): number {
    return Math.max(0, READ_BUDGET_CHARS - this.consumed);
  }
}
```

Created fresh for each `chat:send` message in `ws-chat.ts`. Passed into `buildExtendedScriptContext()`.

#### Workspace Root Resolution

```typescript
function resolveEffectiveRoot(session: SessionState): string | null {
  const pkg = session.activePackage;
  if (pkg?.extractedRoot && pkg.mode === 'extracted') {
    return pkg.extractedRoot;
  }
  return session.lastRoot;
}
```

#### File Truncation

Same pattern as Epic 12: truncate at last newline before budget, append truncation notice with line count.

```typescript
const FILE_TRUNCATION_CHARS = 100_000;
```

See the tech design documents for full architecture, implementation targets, and test mapping.

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `getFileContent` reads files by relative path in both package and folder modes
- [ ] Path traversal returns error for paths resolving outside workspace root
- [ ] `ReadBudgetTracker` enforces 300K character budget per response turn
- [ ] Budget resets on each new `chat:send` (new tracker instance)
- [ ] Large files truncated at 100K characters with `truncated: true` and `totalLines`
- [ ] Binary files (null bytes in first 8KB) return `NOT_TEXT_FILE` error
- [ ] Nonexistent files return `FILE_NOT_FOUND` error
- [ ] All 13 TC-mapped tests + 5 non-TC tests pass (18 total)
- [ ] `npm run verify` passes
