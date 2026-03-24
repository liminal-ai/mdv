# Story 4: File Creation and Non-Active File Editing

---

### Summary
<!-- Jira: Summary field -->

The Steward can create new files and edit non-active files in the workspace through chat, with intermediate directory creation, path traversal prevention, permission checks, and backward compatibility with Epic 12's active document editing.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Working within spec packages containing PRDs, epics, tech designs, and stories. The Steward already knows what document is open (Epic 12) but cannot see the broader package structure, read other files, create new files, or understand where the user is in the spec lifecycle.

**Objective:** The Steward can create new files in the workspace and edit files other than the currently active document. These capabilities were deferred from Epic 12, which limited editing to the active document via `applyEditToActiveDocument`. Created and edited files trigger `chat:file-created` notifications consistent with Epic 12. Files open in tabs follow the same dirty/clean rules — clean tabs auto-refresh, dirty tabs trigger the conflict modal. After this story, "create a new file at docs/auth.md" and "update the PRD" (when the PRD is not the active tab) both work through chat.

**Scope:**

In scope:
- `addFile(path, content)` script method — create new file, create intermediate directories, error if file exists, path traversal prevention, permission check, `chat:file-created` notification
- `editFile(path, content)` script method — replace content of existing file, error if not found, path traversal prevention, permission check, `chat:file-created` notification
- Both methods call `markStaleIfExtracted()` after write (stale indicator for extracted packages, per AC-3.6)
- Backward compatibility: `applyEditToActiveDocument(content)` from Epic 12 unchanged

Out of scope:
- Structured patch edits (full content replacement only — same rationale as Epic 12)
- Package operation methods (Story 3)
- Manifest-specific updates (Story 3 — `updateManifest`)

**Dependencies:**
- Story 2 complete (path validation utilities, workspace root resolution)
- Epic 12 complete (`applyEditToActiveDocument`, `chat:file-created` client handling)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-4.1:** The Steward can create a new file in the workspace through chat

- **TC-4.1a: Create a new markdown file**
  - Given: A workspace is open
  - When: The Steward calls `addFile('docs/new-epic.md', '# New Epic\n\nContent here.')`
  - Then: The file is created at the workspace root + relative path; `chat:file-created` is sent with the file's absolute path

- **TC-4.1b: Create a file in a nested directory**
  - Given: A workspace is open and `docs/specs/` does not exist
  - When: The Steward calls `addFile('docs/specs/auth.md', content)`
  - Then: The intermediate directories are created; the file is written

- **TC-4.1c: File already exists**
  - Given: A workspace contains `docs/existing.md`
  - When: The Steward calls `addFile('docs/existing.md', newContent)`
  - Then: The method returns an error indicating the file already exists; the existing file is not overwritten. The Steward should use `editFile` for existing files.

- **TC-4.1d: Path traversal blocked**
  - Given: A workspace is open
  - When: The Steward calls `addFile('../../outside.md', content)`
  - Then: The method returns an error; no file is created outside the workspace root

- **TC-4.1e: Permission denied on target directory**
  - Given: A workspace is open and the target directory is not writable
  - When: The Steward calls `addFile('readonly-dir/new.md', content)`
  - Then: The method returns an error indicating permission denied; no file is created

**AC-4.2:** The Steward can edit a non-active file in the workspace through chat

- **TC-4.2a: Edit a non-active file**
  - Given: Document A is active in a tab and document B exists in the workspace but is not open
  - When: The Steward calls `editFile('path/to/B.md', newContent)`
  - Then: Document B is written to disk; `chat:file-created` is sent for B's path; document A remains active and unchanged

- **TC-4.2b: Edit a file open in a non-active tab (clean)**
  - Given: Document B is open in a tab but not the active tab, with no unsaved edits
  - When: The Steward calls `editFile` on B
  - Then: B is written to disk; `chat:file-created` is sent; B's tab auto-refreshes (consistent with Epic 12's clean-tab behavior)

- **TC-4.2c: Edit a file open in a non-active tab (dirty)**
  - Given: Document B is open in a tab with unsaved edits
  - When: The Steward calls `editFile` on B
  - Then: B is written to disk; the file watcher detects the change; B's tab shows the conflict modal (consistent with Epic 12's dirty-tab behavior via Epic 5)

- **TC-4.2d: File not found**
  - Given: A workspace is open
  - When: The Steward calls `editFile('nonexistent.md', content)`
  - Then: The method returns an error indicating the file was not found

- **TC-4.2e: Path traversal blocked**
  - Given: A workspace is open
  - When: The Steward calls `editFile('../../outside.md', content)`
  - Then: The method returns an error; no file outside the workspace root is modified

- **TC-4.2f: Permission denied on file**
  - Given: A workspace contains a read-only file `docs/locked.md`
  - When: The Steward calls `editFile('docs/locked.md', content)`
  - Then: The method returns an error indicating permission denied; the file is unchanged

**AC-4.3:** The active document can still be edited via `applyEditToActiveDocument` from Epic 12

- **TC-4.3a: Epic 12 editing unchanged**
  - Given: A document is active in a tab
  - When: The Steward calls `applyEditToActiveDocument(content)` (Epic 12 method)
  - Then: The active document is edited as before; behavior is identical to Epic 12

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### addFile Implementation

In `buildExtendedScriptContext()` within `app/src/server/services/script-executor.ts`:

```typescript
addFile: async (path: string, content: string): Promise<void> => {
  const resolved = resolveAndValidate(path, workspaceRoot);

  // Check file does NOT exist (stat → if ENOENT, good; else error)
  try {
    await stat(resolved);
    throw new Error(`File already exists: ${path}. Use editFile() for existing files.`);
  } catch (err) {
    if (err.message.includes('already exists')) throw err;
    // ENOENT expected
  }

  // Create intermediate directories
  await mkdir(dirname(resolved), { recursive: true });

  // Atomic write
  await atomicWrite(resolved, content);
  markStaleIfExtracted(sessionService, packageService);
  onFileCreated(resolved);
}
```

#### editFile Implementation

```typescript
editFile: async (path: string, content: string): Promise<void> => {
  const resolved = resolveAndValidate(path, workspaceRoot);

  // Check file exists
  try { await stat(resolved); } catch {
    throw new Error(`File not found: ${path}. Use addFile() for new files.`);
  }

  // Check writable
  try { await access(resolved, constants.W_OK); } catch {
    throw new Error(`Permission denied: ${path}`);
  }

  // Atomic write
  await atomicWrite(resolved, content);
  markStaleIfExtracted(sessionService, packageService);
  onFileCreated(resolved);
}
```

#### Shared Utilities

Both methods use:
- `resolveAndValidate(path, root)` — path traversal prevention (from Story 2)
- `atomicWrite(filePath, content)` — temp file + rename (introduced in this story, reused by Story 3)
- `markStaleIfExtracted(sessionService, packageService)` — stale indicator for extracted packages (introduced in this story, reused by Story 3)
- `onFileCreated(path)` callback — sends `chat:file-created` via WebSocket

#### chat:file-created Client Handling

Unchanged from Epic 12. The existing handler covers:
1. File open in active tab → auto-refresh (clean) or conflict modal (dirty)
2. File open in non-active tab → same rules
3. File not open → no immediate UI effect

See the tech design documents for full architecture, implementation targets, and test mapping.

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `addFile` creates files with intermediate directories and sends `chat:file-created`
- [ ] `addFile` returns error for existing files, path traversal, and permission denied
- [ ] `editFile` replaces file content and sends `chat:file-created`
- [ ] `editFile` returns error for nonexistent files, path traversal, and permission denied
- [ ] Both methods call `markStaleIfExtracted()` after writes
- [ ] `applyEditToActiveDocument` behavior identical to Epic 12
- [ ] Atomic write pattern used for all file writes
- [ ] All 12 TC-mapped tests + 4 non-TC tests pass (16 total)
- [ ] `npm run verify` passes
