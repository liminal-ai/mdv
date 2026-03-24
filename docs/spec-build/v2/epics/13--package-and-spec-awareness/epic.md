# Epic 13: Package and Spec Awareness

This epic defines the complete requirements for expanding the Spec Steward from
single-document awareness to full package-level intelligence and spec-driven
guidance. It serves as the source of truth for the Tech Lead's design work.

---

## User Profile

**Primary User:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward
**Context:** Working within spec packages containing PRDs, epics, tech designs, and stories. The Steward already knows what document is open (Epic 12) but cannot see the broader package structure, read other files, create new files, or understand where the user is in the spec lifecycle.
**Mental Model:** "I'm working in a spec package. The Steward should understand the whole project — not just the document I'm looking at. I should be able to ask about any file, create new files, manage the package, and get guidance on what to do next — all through chat."
**Key Constraint:** Vanilla JS frontend, no component framework. The CLI is a child process (stdin/stdout) with per-invocation spawning. Context injection and package operations flow through the server-side provider context and script execution lane established in Epics 10 and 12. Feature-flagged behind `FEATURE_SPEC_STEWARD`. No autonomous pipeline execution — that is Epic 14.

---

## Feature Overview

After this epic, the Steward understands the full package structure when a
package is open. It knows the manifest navigation tree, can read any file in the
workspace, and can answer questions that span multiple documents. Package
operations that previously required the UI — creating packages, adding files,
modifying the manifest, exporting — are available through chat. The Steward
recognizes spec packages and knows the Liminal Spec pipeline phases, offering
conversational guidance about what to do next. File operations and package
creation/export also work on regular folders. Spec awareness and phase guidance
require a package with manifest metadata — after creating a package from a
folder, spec features become available.

---

## Scope

### In Scope

Package-level awareness, package operations through chat, spec conventions, and
pipeline phase guidance — expanding the Steward from single-document intelligence
to project-level intelligence:

- Package context awareness: when a package is open, the Steward receives the manifest structure and metadata as context. The context indicator reflects package awareness.
- Multi-file reading: the Steward can read any file in the workspace by relative path, enabling cross-document queries ("compare the PRD scope with the epic")
- Package operations through chat: create package, export package, modify manifest — the Steward principle applied to package-content operations from Epic 9
- File creation and non-active file editing through chat: create new files in the workspace, edit files other than the active document — capabilities deferred from Epic 12
- Spec package conventions: optional metadata fields in the manifest frontmatter (`type`, `specPhase`, `specStatus`) that identify spec packages and their pipeline state
- Liminal Spec phase awareness: the Steward detects the current pipeline phase from package artifacts and suggests the next step. Conversational guidance, not enforcement.
- Folder-mode chat: package operations through chat work on regular folders (non-packages). "Create a package from this folder" and "export this folder" work from chat in folder mode.
- Extended script execution context: new curated methods for file operations, package operations, and manifest manipulation
- Extended context indicator: shows workspace type (package or folder) alongside the active document

### Out of Scope

- Autonomous pipeline execution (Epic 14) — dispatching long-running CLI operations in the background
- Background task management (Epic 14) — task tracking, "what's running?", concurrent tasks
- Approval flow (Epic 14) — "looks good, proceed to tech design"
- Pipeline state model beyond basic phase detection — formal phase transitions, state persistence, status badges
- Formal approval gate UI (Epic 14)
- Modifications to Liminal Spec skills themselves (separate project)
- Custom agent harnesses (future — uses CLI provider from Epic 10)
- Package versioning or diffing
- Workspace switching through chat — opening `.mpk` files, switching from package to folder mode, replacing the current package. These are workspace-management operations that introduce mid-response root switching; Epic 13 covers operations on the current workspace. Workspace management through chat can be added alongside Epic 14's autonomy patterns.
- Multi-package operations (operations on packages not currently open)
- Search across package files (future)

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Epics 10, 11, and 12 are complete: feature flags, chat plumbing, streaming markdown rendering, document awareness, conversation persistence, script execution | Unvalidated | Dev team | Epic 13 extends the provider context, script execution, and WebSocket schemas |
| A2 | Epic 9 (package viewer integration) is complete: package-mode sidebar, manifest parsing, package creation, export | Unvalidated | Dev team | Epic 13 makes package-content operations chat-accessible. Workspace switching (opening .mpk files, changing roots) is out of scope. |
| A3 | The manifest structure (from Epic 8's parser) is compact enough to include in the provider context without exceeding token limits for typical spec packages (under 100 navigation entries) | Unvalidated | Tech Lead | The manifest is metadata + a navigation tree, not file contents |
| A4 | The script execution lane (from Epic 10) supports the additional methods defined in this epic without performance degradation | Unvalidated | Tech Lead | Each method is a short-lived operation against server services |
| A5 | The curated script methods are the sole file-access mechanism for the Steward. The CLI's built-in Read/Write tools are not configured for workspace access — all file operations flow through the script execution lane for safety and observability. | Unvalidated | Tech Lead | Consistent with the technical architecture's method surface principle |
| A6 | Spec phase detection from artifact naming patterns is reliable enough for conversational guidance. False positives are acceptable — the Steward suggests, the user decides. | Validated | Product | Guidance is conversational, not enforced |

---

## Flows & Requirements

### 1. Package Context Awareness

When a package is open, the server includes the package manifest structure and
metadata in the provider context alongside the active document context from
Epic 12. The Steward knows what the package contains, what its metadata says,
and can reference files by their navigation path. The context indicator in the
chat panel extends to show the workspace type and package identity.

1. Developer has a package open (sidebar in package mode)
2. Developer sends a message in the chat
3. Client sends the active document path (per Epic 12)
4. Server reads the package manifest and metadata from the package service
5. Server constructs the provider context with active document + package structure
6. CLI receives the message with full package awareness
7. Steward responds with awareness of the package structure

#### Acceptance Criteria

**AC-1.1:** The package manifest structure and metadata are included in the provider context when a package is open

- **TC-1.1a: Package context included**
  - Given: A package is open with a manifest containing five navigation entries and metadata (title, version)
  - When: The developer sends a message
  - Then: The provider context includes the package metadata and navigation tree (verifiable by inspecting the provider's received context)
- **TC-1.1b: No package context when folder is open**
  - Given: A regular folder is open (not a package)
  - When: The developer sends a message
  - Then: The provider context does not include package-specific fields; workspace type is `folder`
- **TC-1.1c: Package context updates on workspace switch**
  - Given: Package A is open and the developer has been chatting about it
  - When: The developer opens Package B
  - Then: The next message's provider context includes Package B's manifest and metadata, not Package A's
- **TC-1.1d: Manifest-less package provides minimal context**
  - Given: A package is open in filesystem fallback mode (no manifest or unreadable manifest)
  - When: The developer sends a message
  - Then: The provider context includes `manifestStatus: 'missing'` or `'unreadable'`; no navigation tree

**AC-1.2:** The context indicator shows workspace type and package identity alongside the active document

- **TC-1.2a: Package mode indicator**
  - Given: A package with title "My Spec" is open and a document `docs/epic.md` is active
  - When: The developer views the chat panel
  - Then: The context indicator shows the package name and the active document (e.g., "My Spec > docs/epic.md"). Exact layout is a tech design decision.
- **TC-1.2b: Folder mode indicator**
  - Given: A regular folder is open and a document is active
  - When: The developer views the chat panel
  - Then: The context indicator shows the active document as in Epic 12; no package indicator
- **TC-1.2c: Package mode with no document open**
  - Given: A package is open but no document tabs are active
  - When: The developer views the chat panel
  - Then: The context indicator shows the package name without a document path
- **TC-1.2d: Package mode with truncated document**
  - Given: A package is open and the active document was truncated due to token budget
  - When: The developer views the context indicator
  - Then: Both the package identity and the truncation indicator are visible

**AC-1.3:** The Steward can answer questions about the package structure without reading individual files

- **TC-1.3a: "What's in this package?"**
  - Given: A package is open with a manifest containing navigation entries
  - When: The developer asks "what's in this package?"
  - Then: The provider context includes the navigation tree, enabling the Steward to list the package contents (verifiable by confirming the navigation tree is in the context, not by asserting model response quality)
- **TC-1.3b: Package metadata available**
  - Given: A package is open whose manifest has title, version, and author metadata
  - When: The developer asks about the package
  - Then: The provider context includes the metadata fields

### 2. Multi-File Reading and Cross-Document Queries

The Steward can read any file in the workspace by relative path, not just the
active document. This enables cross-document queries — the developer asks a
question that requires information from multiple files, and the Steward reads
the relevant files and synthesizes an answer.

Multi-file reading uses the script execution lane. The Steward emits script
blocks calling `getFileContent(path)` to read files on demand. The manifest
navigation tree (always in context) tells the Steward what files exist and
their paths.

1. Developer asks a question that spans multiple files
2. Steward receives the question + manifest (knows file locations)
3. Steward emits script block(s) calling `getFileContent` for relevant files
4. Server executes the scripts, reads files from the workspace, returns content
5. CLI receives the file contents
6. Steward synthesizes the information and responds

#### Acceptance Criteria

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

### 3. Package Operations Through Chat

The Steward can perform package-content operations that previously required the
UI: package creation, manifest modification, package export, and sidebar
navigation. These are the Epic 9 operations that act on package content within
the current workspace. Workspace-switching operations (opening a different .mpk
file, switching to a different folder root) are out of scope — see Out of Scope.

When a package operation changes the workspace state (e.g., creating a package
switches the sidebar mode), the server notifies the client via a
`chat:package-changed` message so the UI updates.

1. Developer requests a package operation through chat (e.g., "export this package")
2. Steward emits a script block calling the appropriate method
3. Server executes the operation via the package service
4. Server sends `chat:package-changed` to notify the client
5. Client updates the sidebar and UI to reflect the change
6. Steward confirms the operation in the chat response

#### Acceptance Criteria

**AC-3.1:** The Steward can modify the package manifest through chat

- **TC-3.1a: Add a navigation entry**
  - Given: A package is open with three navigation entries
  - When: The developer says "add docs/api.md to the navigation" and the Steward calls `updateManifest` with updated content
  - Then: The manifest file is updated on disk; the server sends `chat:package-changed` with `change: 'manifest-updated'`; the sidebar navigation reflects the change
- **TC-3.1b: Remove a navigation entry**
  - Given: A package is open with four navigation entries
  - When: The Steward removes an entry by calling `updateManifest` with updated content
  - Then: The manifest is updated; the sidebar shows three entries
- **TC-3.1c: Reorder navigation entries**
  - Given: A package has entries A, B, C
  - When: The Steward reorders them to C, A, B via `updateManifest`
  - Then: The sidebar shows entries in the new order
- **TC-3.1d: Invalid manifest content**
  - Given: A package is open
  - When: A script block calls `updateManifest` with content containing malformed YAML
  - Then: The method returns an error; the existing manifest is unchanged; the sidebar retains its previous state

**AC-3.2:** The Steward can export the current workspace as a package through chat

- **TC-3.2a: Export as .mpk**
  - Given: A package or folder is open
  - When: The developer says "export this as a package" and the Steward calls `exportPackage` with an output path and `compress: false`
  - Then: A `.mpk` file is created at the specified path; the server sends `chat:package-changed` with `change: 'exported'`
- **TC-3.2b: Export as .mpkz**
  - Given: A workspace is open
  - When: The Steward calls `exportPackage` with `compress: true`
  - Then: A `.mpkz` (compressed) file is created
- **TC-3.2c: Export path not writable**
  - Given: A workspace is open
  - When: The Steward calls `exportPackage` with a path that is not writable
  - Then: The method returns an error; no package file is created
- **TC-3.2d: Re-export to original path clears stale indicator**
  - Given: An extracted package is stale (files modified since extraction) and its source path is `/path/to/project.mpk`
  - When: The Steward calls `exportPackage({ outputPath: '/path/to/project.mpk' })`
  - Then: The package is re-exported; the stale indicator clears (consistent with Epic 9 AC-5.3b)
- **TC-3.2e: Export to different path preserves stale indicator**
  - Given: An extracted package is stale and its source path is `/path/to/project.mpk`
  - When: The Steward calls `exportPackage({ outputPath: '/path/to/elsewhere.mpk' })`
  - Then: The package is exported to the new path; the stale indicator remains (the original source is still out of date, consistent with Epic 9 AC-5.3c)

**AC-3.3:** The Steward can navigate to a file in the viewer through chat

- **TC-3.3a: Open a file by manifest path**
  - Given: A package is open
  - When: The Steward calls `openDocument` with the absolute path of a file in the package
  - Then: The file opens in a tab (or the existing tab is activated) consistent with Epic 12's `openDocument` behavior
- **TC-3.3b: File not in workspace**
  - Given: A workspace is open
  - When: The Steward calls `openDocument` with a path outside the workspace root
  - Then: The method returns an error; no tab is opened

**AC-3.4:** The client updates the sidebar and UI after Steward-initiated package operations

- **TC-3.4a: Manifest update refreshes sidebar**
  - Given: The sidebar is showing package-mode navigation
  - When: The client receives `chat:package-changed` with `change: 'manifest-updated'`
  - Then: The client re-fetches the manifest and updates the sidebar navigation tree
- **TC-3.4b: Package creation switches sidebar mode**
  - Given: The sidebar is in filesystem mode
  - When: The client receives `chat:package-changed` with `change: 'created'`
  - Then: The client switches the sidebar to package mode and fetches the new manifest
- **TC-3.4c: Export shows confirmation**
  - Given: The developer requested a package export through chat
  - When: The client receives `chat:package-changed` with `change: 'exported'`
  - Then: The export success is visible in the chat (via the Steward's response text)

**AC-3.5:** After `createPackage()` on a folder, the workspace transitions to a directory-mode package with full package context available

- **TC-3.5a: Workspace type becomes package after createPackage**
  - Given: A folder is open (`workspace.type === 'folder'`)
  - When: The Steward calls `createPackage()` and the manifest is scaffolded
  - Then: Subsequent messages have `workspace.type === 'package'` with `package.mode === 'directory'`; `package.navigation` and `package.metadata` are populated from the scaffolded manifest; `getPackageManifest()` and `updateManifest()` are legal
- **TC-3.5b: Canonical identity is preserved across folder-to-package transition**
  - Given: A folder at `/Users/dev/project` is open with an existing conversation
  - When: The Steward calls `createPackage()`
  - Then: The canonical workspace identity remains `/Users/dev/project`; the conversation is not swapped or lost; the CLI session ID is unchanged
- **TC-3.5c: Context indicator updates to show package mode**
  - Given: A folder was open and `createPackage()` has been called
  - When: The developer views the chat panel
  - Then: The context indicator reflects package mode with the package title from the scaffolded manifest

**AC-3.6:** Steward-initiated file modifications in extracted packages update the stale indicator

- **TC-3.6a: addFile in extracted package triggers stale**
  - Given: A `.mpk` package was opened (extracted to temp directory) and the stale indicator is not showing
  - When: The Steward calls `addFile` to create a file in the extracted package
  - Then: The stale indicator appears (consistent with Epic 9 AC-7.2)
- **TC-3.6b: editFile in extracted package triggers stale**
  - Given: A `.mpk` package was opened and is not stale
  - When: The Steward calls `editFile` on a file in the extracted package
  - Then: The stale indicator appears
- **TC-3.6c: updateManifest in extracted package triggers stale**
  - Given: A `.mpk` package was opened and is not stale
  - When: The Steward calls `updateManifest` to modify the manifest
  - Then: The stale indicator appears (the manifest is a file in the extracted package)
- **TC-3.6d: Directory-mode packages have no stale indicator**
  - Given: A directory-mode package is open (folder with manifest, not extracted from .mpk)
  - When: The Steward calls `addFile`, `editFile`, or `updateManifest`
  - Then: No stale indicator appears (consistent with Epic 9 AC-7.2c)

### 4. File Creation and Non-Active File Editing

The Steward can create new files in the workspace and edit files other than the
currently active document. These capabilities were deferred from Epic 12, which
limited editing to the active document via `applyEditToActiveDocument`.

Created and edited files trigger `chat:file-created` notifications consistent
with Epic 12. Files open in tabs follow the same dirty/clean rules — clean tabs
auto-refresh, dirty tabs trigger the conflict modal.

1. Developer requests a new file or an edit to a non-active file through chat
2. Steward emits a script block calling `addFile` or `editFile`
3. Server writes the file to disk within the workspace root
4. Server sends `chat:file-created` with the file's path
5. If the file is open in a tab: same dirty/clean handling as Epic 12
6. If the file is new: it appears in the sidebar (filesystem mode) or can be added to the manifest

#### Acceptance Criteria

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

### 5. Spec Package Conventions

The manifest frontmatter supports optional metadata fields that identify a
package as a spec package and declare its pipeline state. These fields are a
convention — they are not enforced by the manifest parser but are recognized by
the Steward when present. The Steward can read these fields from the context and
set them via manifest updates.

Spec metadata fields:

- `type: spec` — identifies this as a spec package (vs. general documentation)
- `specPhase` — declared pipeline phase (`prd`, `epic`, `tech-design`, `stories`, `implementation`, `complete`)
- `specStatus` — status within the current phase (`draft`, `in-review`, `approved`)

These fields supplement the Steward's automatic phase detection (Flow 6). When
both declared metadata and detected artifacts are available, the declared
metadata takes precedence.

#### Acceptance Criteria

**AC-5.1:** The Steward receives spec metadata from the manifest frontmatter as part of the provider context

- **TC-5.1a: Spec metadata present**
  - Given: A package manifest has frontmatter with `type: spec`, `specPhase: epic`, `specStatus: draft`
  - When: The developer sends a message
  - Then: The provider context includes the spec metadata fields
- **TC-5.1b: No spec metadata**
  - Given: A package manifest has no spec-specific metadata fields
  - When: The developer sends a message
  - Then: The provider context omits spec-specific fields; the Steward treats it as a general package
- **TC-5.1c: Partial spec metadata**
  - Given: A manifest has `type: spec` but no `specPhase` or `specStatus`
  - When: The developer sends a message
  - Then: The context includes `type: spec`; the Steward can still use artifact detection for phase (Flow 6)

**AC-5.2:** The Steward can set spec metadata through manifest updates

- **TC-5.2a: Set spec phase**
  - Given: A spec package is open with `specPhase: prd`
  - When: The developer says "update the phase to epic" and the Steward calls `updateManifest` with updated frontmatter
  - Then: The manifest frontmatter now contains `specPhase: epic`; the context on the next message reflects the update
- **TC-5.2b: Initialize spec metadata on a general package**
  - Given: A package is open with no spec metadata
  - When: The developer says "this is a spec package" and the Steward adds `type: spec` via `updateManifest`
  - Then: The manifest frontmatter now contains `type: spec`

**AC-5.3:** The `spec` field in the provider context is populated when a spec package is detected, providing the data needed for spec-aware behavior

- **TC-5.3a: Spec package populates spec context**
  - Given: A package manifest has `type: spec`
  - When: The server constructs the provider context
  - Then: The `spec` field is present with `detectedArtifacts` and (if applicable) `declaredPhase`, `declaredStatus`, and `detectedPhase` — all the data the Steward needs for spec-aware behavior
- **TC-5.3b: Non-spec package has no spec context**
  - Given: A package manifest does not have `type: spec`
  - When: The server constructs the provider context
  - Then: The `spec` field is absent; the Steward has no spec-specific data

### 6. Liminal Spec Phase Awareness

The Steward detects the current pipeline phase by examining what artifacts exist
in the package and (if present) the declared spec metadata. It can suggest the
next step in the Liminal Spec pipeline. This guidance is conversational — the
developer can follow it, skip phases, or work in any order. The Steward suggests;
it does not enforce.

Phase detection uses two sources:

1. **Declared metadata** (from Flow 5): `specPhase` field in the manifest frontmatter. Takes precedence when present.
2. **Artifact detection**: the server scans navigation entries for known artifact patterns (files with names or content indicating PRDs, epics, tech designs, stories).

The detected phase and artifact list are included in the provider context so the
Steward can reference them.

1. Developer opens a spec package
2. Server analyzes the manifest navigation for known artifact patterns
3. Server includes the detected phase and artifact list in the provider context
4. Developer asks "what should I do next?" or the Steward proactively suggests
5. Steward references the detected phase and suggests the next pipeline step

#### Acceptance Criteria

**AC-6.1:** The server detects the current pipeline phase from package artifacts and includes it in the provider context

- **TC-6.1a: PRD only — PRD phase detected**
  - Given: A spec package contains a file matching PRD patterns (e.g., `prd.md`) but no epic, tech design, or story files
  - When: The developer sends a message
  - Then: The provider context includes a detected phase of `prd` and an artifact list containing `prd`
- **TC-6.1b: PRD + epic — epic phase detected**
  - Given: A spec package contains files matching PRD and epic patterns
  - When: The developer sends a message
  - Then: The detected phase is `epic`; the artifact list contains `prd` and `epic`
- **TC-6.1c: Full artifact set — stories phase detected**
  - Given: A spec package contains PRD, epic, tech design, and story files
  - When: The developer sends a message
  - Then: The detected phase is `stories` (the highest artifact-detectable phase); the artifact list contains all four types. The `implementation` phase is not artifact-detectable — it requires the declared `specPhase: implementation` metadata.
- **TC-6.1d: No recognizable artifacts**
  - Given: A spec package contains files that don't match any known artifact patterns
  - When: The developer sends a message
  - Then: No phase is detected; the artifact list is empty; the Steward has no phase-specific guidance
- **TC-6.1e: Declared metadata overrides detection**
  - Given: A manifest has `specPhase: tech-design` but only contains a PRD file
  - When: The developer sends a message
  - Then: The context uses the declared phase (`tech-design`), not the detected phase

**AC-6.2:** The Steward can suggest the next pipeline step based on the detected phase

- **TC-6.2a: Context supports next-step suggestion**
  - Given: A spec package is at the `prd` phase (PRD exists, no epic)
  - When: The developer asks "what should I do next?"
  - Then: The provider context includes sufficient phase information for the Steward to suggest drafting the epic (verifiable by confirming phase and artifact data are in the context)
- **TC-6.2b: Context at epic phase**
  - Given: A spec package has PRD and epic artifacts
  - When: The developer asks about next steps
  - Then: The context includes phase `epic` and both artifacts, enabling tech design guidance
- **TC-6.2c: Non-spec package — no phase guidance**
  - Given: A general package (no `type: spec`) is open
  - When: The developer asks "what should I do next?"
  - Then: The provider context contains no spec phase information; the Steward cannot offer pipeline guidance

**AC-6.3:** Phase guidance is conversational — the developer can follow, skip, or work in any order

- **TC-6.3a: Phase information is descriptive, not prescriptive**
  - Given: A spec package is at the `prd` phase
  - When: The developer sends a message about implementation (skipping epic and tech design)
  - Then: The Steward has phase information in context but is not programmatically prevented from discussing implementation — the context informs, it does not constrain
- **TC-6.3b: Phase detection does not block operations**
  - Given: A spec package is at the `prd` phase
  - When: The Steward is asked to create a story file (ahead of the detected phase)
  - Then: The `addFile` method succeeds; phase detection does not gate file operations

### 7. Folder-Mode Chat

Package operations through chat work when the current workspace is a regular
folder, not a package. The developer can create a package from a folder, export
a folder, and perform file operations — all through chat, regardless of the
current sidebar mode. Package creation from a folder switches the sidebar to
package mode, consistent with Epic 9's File → New Package behavior.

1. Developer has a regular folder open (sidebar in filesystem mode)
2. Developer says "create a package from this folder" in chat
3. Steward calls `createPackage()`
4. Server scaffolds a manifest (same as POST /api/package/create)
5. Server sends `chat:package-changed` with `change: 'created'`
6. Client switches sidebar to package mode

#### Acceptance Criteria

**AC-7.1:** The Steward can create a package from the current folder through chat

- **TC-7.1a: Create package in folder mode**
  - Given: A regular folder is open (no manifest)
  - When: The Steward calls `createPackage()`
  - Then: A manifest is scaffolded in the directory (same scaffolding rules as Epic 9 AC-4.1 — alphabetical sort, dotfiles excluded); `chat:package-changed` with `change: 'created'` is sent; the sidebar switches to package mode
- **TC-7.1b: Create package when manifest exists — no overwrite by default**
  - Given: A folder is open that already contains a manifest
  - When: The Steward calls `createPackage()` without `overwrite: true`
  - Then: The method returns an error indicating a manifest already exists
- **TC-7.1c: Create package with overwrite**
  - Given: A folder is open with an existing manifest
  - When: The Steward calls `createPackage({ overwrite: true })`
  - Then: The existing manifest is replaced with a newly scaffolded manifest; sidebar updates
- **TC-7.1d: Create package in extracted package with missing manifest (fallback repair)**
  - Given: A `.mpk` package was opened but had no manifest, so the sidebar is in filesystem fallback mode
  - When: The Steward calls `createPackage()`
  - Then: A manifest is scaffolded in the extracted temp directory; the sidebar switches from fallback to package mode; the stale indicator appears (the package now differs from its source). Consistent with Epic 9 AC-8.3a.
- **TC-7.1e: Create package in extracted package with unreadable manifest (fallback repair)**
  - Given: A `.mpk` package was opened but the manifest could not be parsed, so the sidebar is in filesystem fallback mode
  - When: The Steward calls `createPackage({ overwrite: true })`
  - Then: The unreadable manifest is replaced with a newly scaffolded manifest; the sidebar switches to package mode; the stale indicator appears. Consistent with Epic 9 AC-8.3b.

**AC-7.2:** The Steward can export a folder as a package through chat

- **TC-7.2a: Export folder as .mpk**
  - Given: A regular folder is open (no manifest)
  - When: The Steward calls `exportPackage({ outputPath: '/path/to/output.mpk' })`
  - Then: A manifest is auto-scaffolded (in memory, not written to the source folder — consistent with Epic 9 AC-5.2), and the folder is exported as a `.mpk` file
- **TC-7.2b: Export folder with existing manifest**
  - Given: A directory-mode package is open (folder with manifest)
  - When: The Steward calls `exportPackage({ outputPath: '/path/to/output.mpk' })`
  - Then: The existing manifest is used; the folder is exported as a `.mpk` file

**AC-7.3:** File operations work in folder mode

- **TC-7.3a: Create file in folder mode**
  - Given: A regular folder is open
  - When: The Steward calls `addFile('docs/new.md', content)`
  - Then: The file is created in the folder; `chat:file-created` is sent
- **TC-7.3b: Read file in folder mode**
  - Given: A regular folder is open containing `readme.md`
  - When: The Steward calls `getFileContent('readme.md')`
  - Then: The file content is returned
- **TC-7.3c: Edit file in folder mode**
  - Given: A regular folder is open containing `docs/spec.md`
  - When: The Steward calls `editFile('docs/spec.md', newContent)`
  - Then: The file is written; `chat:file-created` is sent

### 8. Error Handling and Feature Isolation

Errors in package operations, file reading, spec detection, and context
injection produce visible feedback in the chat without crashing the app or
corrupting workspace state. All Epic 13 functionality remains gated behind
`FEATURE_SPEC_STEWARD`.

#### Acceptance Criteria

**AC-8.1:** Script method errors produce descriptive error results returned to the CLI

- **TC-8.1a: File operation error**
  - Given: A script block calls `getFileContent` for a nonexistent file
  - When: The method fails
  - Then: An error result is returned to the CLI process's stdin with a descriptive message; the server continues operating
- **TC-8.1b: Package operation error**
  - Given: A script block calls `exportPackage` with an invalid output path
  - When: The export fails
  - Then: An error result is returned to the CLI; no partial file is left on disk
- **TC-8.1c: Manifest update error**
  - Given: A script block calls `updateManifest` with malformed content
  - When: The manifest parse fails
  - Then: An error result is returned; the existing manifest is unchanged; the sidebar retains its previous state

**AC-8.2:** Package context injection errors are handled gracefully

- **TC-8.2a: Package service unavailable**
  - Given: The package service fails to read the manifest (e.g., temp directory was cleaned up externally)
  - When: The developer sends a message
  - Then: The message is sent without package context; a warning appears in the context indicator
- **TC-8.2b: Manifest parse error during context injection**
  - Given: The manifest file exists but is malformed
  - When: The developer sends a message
  - Then: The context includes `manifestStatus: 'unreadable'`; the Steward operates without manifest structure

**AC-8.3:** All Epic 13 functionality is absent when the feature flag is disabled

- **TC-8.3a: No package context injection**
  - Given: `FEATURE_SPEC_STEWARD` is disabled
  - When: A package is open and the app runs
  - Then: No package context is constructed for the provider; no spec phase detection runs
- **TC-8.3b: No extended context indicator**
  - Given: `FEATURE_SPEC_STEWARD` is disabled
  - When: The app loads
  - Then: No package-aware context indicator is present (no chat panel at all, per Epic 10)

---

## Data Contracts

### Extended ProviderContext

The `ProviderContext` from Epic 12 is extended with workspace and package fields:

```typescript
interface ProviderContext {
  // Epic 12 (unchanged):
  activeDocument?: {
    path: string;
    relativePath: string;
    content: string;
    truncated: boolean;
    totalLines?: number;
  };

  // Epic 13:
  workspace: {
    type: 'folder' | 'package';
    rootPath: string;               // Effective root (may be temp dir for packages)
    canonicalIdentity: string;      // Canonical workspace identity (from Epic 12)
  };
  package?: {                        // Present when workspace.type === 'package'
    mode: 'directory' | 'extracted'; // Directory-mode = folder with manifest; extracted = from .mpk/.mpkz
    sourcePath?: string;            // Original .mpk/.mpkz path (only for extracted mode)
    format?: 'mpk' | 'mpkz';       // Source format (only for extracted mode)
    metadata: ManifestMetadata;     // From Epic 8 types
    navigation: NavigationNode[];   // Full nav tree from manifest
    manifestStatus: 'present' | 'missing' | 'unreadable';
    fileCount: number;              // Total files in the workspace
  };
  spec?: {                           // Present when package has type: spec
    declaredPhase?: string;         // From manifest specPhase field
    declaredStatus?: string;        // From manifest specStatus field
    detectedPhase?: string;         // From artifact detection
    detectedArtifacts: string[];    // List of detected artifact types
  };
}
```

The `workspace` field is always present (it replaces the implicit "server knows
the root" pattern). The `package` field is present when the sidebar is in
package mode — both for extracted packages (opened from `.mpk`/`.mpkz`) and
directory-mode packages (folders with a scaffolded manifest, including after
`createPackage()`). The `package.mode` discriminator distinguishes the two:
`'directory'` packages have no `sourcePath`; `'extracted'` packages include the
original `.mpk`/`.mpkz` source path. The `spec` field is present only when the
package has `type: spec` in its manifest frontmatter.

**Canonical identity for directory-mode packages:** When `createPackage()` is
called on a folder, the canonical workspace identity remains the folder's
absolute path. The conversation and CLI session ID are preserved — no
conversation swap occurs. This is consistent with Epic 12's identity model:
directory-mode packages are still keyed by their folder path.

### ChatSendMessage (Unchanged)

The `ChatSendMessage` schema from Epic 12 is not modified. The client continues
to send `activeDocumentPath`. The server derives workspace and package context
from session state — no client-side change needed.

```typescript
interface ChatSendMessage {
  type: 'chat:send';
  messageId: string;
  text: string;
  context?: {
    activeDocumentPath: string | null;
  };
}
```

### New Server → Client Messages

```typescript
interface ChatPackageChangedMessage {
  type: 'chat:package-changed';
  messageId: string;              // Correlation ID of the message that triggered the operation
  change: 'created' | 'exported' | 'manifest-updated';
  details?: {
    manifestPath?: string;        // For created / manifest-updated
    exportPath?: string;          // For exported
  };
}
```

Added to the `ChatServerMessage` discriminated union.

**Client handling by change type:**

| Change | Client Behavior |
|--------|----------------|
| `created` | Switch sidebar to package mode; re-fetch `GET /api/package/manifest` |
| `exported` | No sidebar change; success is reflected in the Steward's response text |
| `manifest-updated` | Re-fetch `GET /api/package/manifest`; update sidebar navigation tree |

The `chat:file-created` message from Epic 12 continues to be used for file
edits (active and non-active). `chat:package-changed` is used for
workspace-level state changes that require sidebar or mode updates.

**Message sequencing:** `chat:package-changed` and `chat:file-created` are sent
during script execution, before the response completes (`chat:done`). Within a
single Steward response, these messages may interleave — e.g., an `addFile`
triggers `chat:file-created`, followed by an `updateManifest` that triggers
`chat:package-changed`. The client processes each message as it arrives. All
package/file change messages for a response are guaranteed to arrive before
`chat:done` for that response.

### New Chat Error Codes

| Code | Description |
|------|-------------|
| `FILE_NOT_FOUND` | Requested file does not exist in the workspace |
| `FILE_ALREADY_EXISTS` | Cannot create file — a file already exists at the path |
| `PATH_TRAVERSAL` | Path resolves outside the workspace root |
| `MANIFEST_NOT_FOUND` | Package operation requires a manifest but none exists |
| `MANIFEST_PARSE_ERROR` | Updated manifest content could not be parsed |
| `PERMISSION_DENIED` | File or directory is not readable/writable |
| `NOT_TEXT_FILE` | File is binary, not readable as text |
| `READ_BUDGET_EXCEEDED` | Per-response file read budget exhausted |
| `PACKAGE_EXPORT_FAILED` | Package export operation failed |
| `PACKAGE_CREATE_FAILED` | Package creation (manifest scaffold) failed |

Added to the existing `ChatErrorCode` enum.

### Extended Script Execution Context

The `ScriptContext` from Epic 12 is extended with file operations, package
operations, and manifest manipulation:

```typescript
interface ScriptContext {
  // Epic 10:
  showNotification(message: string): void;

  // Epic 12 (unchanged):
  getActiveDocumentContent(): Promise<string>;
  applyEditToActiveDocument(content: string): Promise<void>;
  openDocument(path: string): Promise<void>;

  // Epic 13 — file operations (workspace-relative paths):
  getFileContent(path: string): Promise<FileReadResult>;
  addFile(path: string, content: string): Promise<void>;
  editFile(path: string, content: string): Promise<void>;

  // Epic 13 — package operations:
  getPackageManifest(): Promise<PackageManifestInfo>;
  updateManifest(content: string): Promise<void>;
  createPackage(options?: CreatePackageOptions): Promise<void>;
  exportPackage(options: ExportPackageOptions): Promise<void>;
}
```

**Method specifications:**

| Method | Workspace Modes | Description |
|--------|----------------|-------------|
| `getFileContent(path)` | folder, package | Read any file in the workspace by relative path. Returns `FileReadResult` with content, truncation flag, and total lines. Large files are truncated (same budget approach as Epic 12's document truncation). Rejects paths outside the root and binary files. |
| `addFile(path, content)` | folder, package | Create a new file. Creates intermediate directories. Returns error if file already exists. Triggers `chat:file-created`. |
| `editFile(path, content)` | folder, package | Replace content of an existing file. Returns error if file not found. Triggers `chat:file-created`. |
| `getPackageManifest()` | package only | Read the current manifest. Returns content, parsed metadata, and navigation tree. Returns error in folder mode. |
| `updateManifest(content)` | package only | Replace manifest content. Server re-parses; returns error if parse fails (existing manifest unchanged). Triggers `chat:package-changed`. Returns error in folder mode. |
| `createPackage(options?)` | folder, package | Scaffold a manifest from discovered files. Same rules as Epic 9 AC-4.1. Returns error if manifest exists and `overwrite` is not true. Triggers `chat:package-changed`. |
| `exportPackage(options)` | folder, package | Export workspace to .mpk/.mpkz. Auto-scaffolds manifest in memory if none exists (folder mode, per Epic 9 AC-5.2). Triggers `chat:package-changed`. |

**Parameter and return types:**

```typescript
interface PackageManifestInfo {
  content: string;                // Raw manifest markdown
  metadata: ManifestMetadata;     // Parsed YAML frontmatter (from Epic 8)
  navigation: NavigationNode[];   // Parsed navigation tree (from Epic 8)
}

interface CreatePackageOptions {
  overwrite?: boolean;            // Overwrite existing manifest (default: false)
}

interface ExportPackageOptions {
  outputPath: string;             // Absolute path for the output file
  compress?: boolean;             // false → .mpk (default), true → .mpkz
}

interface FileReadResult {
  content: string;                // File content (may be truncated)
  truncated: boolean;             // True if content was truncated due to size budget
  totalLines?: number;            // Total line count (present when truncated)
}
```

### Spec Metadata Convention

Optional YAML frontmatter fields in the manifest that the Steward recognizes:

```yaml
---
title: My Spec Package
version: "1.0"
type: spec
specPhase: epic
specStatus: draft
---
```

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `type` | string | `spec` | Identifies this as a spec package |
| `specPhase` | string | `prd`, `epic`, `tech-design`, `stories`, `implementation`, `complete` | Declared pipeline phase |
| `specStatus` | string | `draft`, `in-review`, `approved` | Status within the current phase |

These fields are optional. They are not validated by the manifest parser (from
Epic 8) — they pass through as part of the metadata. The Steward reads them from
the provider context and can set them via `updateManifest`.

### Artifact Detection Patterns

The server uses navigation entry names and paths to detect artifact types. The
exact patterns are a tech design decision. The following are representative:

| Artifact Type | Example Patterns |
|--------------|-----------------|
| `prd` | `prd.md`, `product-requirements.md`, entries containing "PRD" |
| `epic` | `epic.md`, `epic-*.md`, `feature-spec.md` |
| `tech-design` | `tech-design.md`, `technical-design.md`, `technical-architecture.md` |
| `stories` | `stories/` directory, `story-*.md`, files in a `stories` group. This is the highest artifact-detectable phase. |
| `implementation` | Not detected from files. Only set when `specPhase: implementation` is declared in manifest metadata. Artifact detection alone yields `stories` as the highest phase. |

The exact pattern matching strategy is a tech design decision. The spec requires
that artifact detection produces a list of detected types and an inferred phase.

---

## Dependencies

Technical dependencies:
- Epic 10 (chat plumbing) complete: feature flags, CLI provider, WebSocket chat, script execution
- Epic 11 (chat rendering and polish) complete: streaming markdown rendering, keyboard shortcuts
- Epic 12 (document awareness and editing) complete: context injection, document editing, conversation persistence, script context, `chat:file-created`
- Epic 9 (package viewer integration) complete: package-mode sidebar, manifest parsing, package creation, export, mode switching
- Epic 8 (package format foundation) complete: manifest parser types (`ManifestMetadata`, `NavigationNode`), tar library
- Existing package service and session service for workspace state

Process dependencies:
- None

---

## Non-Functional Requirements

### Context Injection Performance
- Adding package manifest and metadata to the provider context adds less than 200ms to message dispatch for packages with up to 100 navigation entries
- Spec phase detection (artifact pattern scanning) adds less than 100ms to context construction

### Script Method Performance
- `getFileContent` returns within 500ms for files under 5,000 lines
- `addFile` and `editFile` return within 500ms
- `updateManifest` (including re-parse and sidebar notification) returns within 500ms for manifests with up to 500 entries
- `createPackage` (manifest scaffolding) returns within 2 seconds for directories with up to 500 markdown files
- `exportPackage` returns within 5 seconds for packages under 10MB

### Path Safety
- All file operations (`getFileContent`, `addFile`, `editFile`) reject paths that resolve outside the workspace root
- Path traversal prevention is enforced server-side, not client-side

### Feature Isolation
- All Epic 13 additions remain gated behind `FEATURE_SPEC_STEWARD`
- No package context injection, spec detection, or extended script methods are active when the flag is disabled
- No new server endpoints are registered when the flag is disabled

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. **Per-response read budget size:** AC-2.2 specifies a per-response read budget that caps cumulative `getFileContent` content. What is the budget size — a character/line limit, a token estimate, or a fixed file count? Should it account for the active document content already in context?
2. **Artifact detection strategy:** What patterns reliably identify PRDs, epics, tech designs, and stories in navigation entries? Should detection use filename matching, frontmatter scanning, or both? How do false positives affect the user experience?
3. **Context construction:** How does the server assemble the system prompt for package-aware messages? Is the manifest included as a structured block, a rendered summary, or raw markdown? What instructions tell the Steward about available script methods?
4. **Manifest update atomicity:** When `updateManifest` writes the manifest, should it use atomic writes (write-to-temp, rename) consistent with the existing session persistence pattern? What happens if the re-parse succeeds but the sidebar notification fails?
5. **Package creation working directory:** Does `createPackage` call the same package service used by `POST /api/package/create`, or does it bypass the REST layer? Should script methods call service methods directly or go through the REST API?
6. **File creation in extracted packages:** AC-3.6 specifies that stale indicator updates when files are created/edited in extracted packages. How does the implementation detect "extracted package" context to trigger the stale flag? Does it use the `package.mode` field or the session service's package state?
7. **Export path validation:** Should `exportPackage` validate that the output path is writable before starting the export? Should it require an absolute path, or also accept paths relative to the workspace root?
8. **Context indicator layout:** What is the visual layout of the extended context indicator showing package name + document? How does it interact with the truncation indicator from Epic 12?
9. **Spec phase detection caching:** Should artifact detection run on every message, or be cached and invalidated when files are created/edited? What's the cost of running it per-message for a 50-file package?
10. **CLI working directory isolation:** Per A5, the curated script methods are the sole file-access mechanism. Should the CLI's working directory be set to a non-workspace location (e.g., `/tmp`) to prevent accidental file access via built-in tools? Or is the working directory irrelevant since the CLI's Read/Write tools are not configured for workspace access?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

**Delivers:** Extended `ProviderContext` type with workspace, package, and spec
fields. `ChatPackageChangedMessage` schema (Zod). New error codes. Extended
`ScriptContext` interface with all new method signatures. `PackageManifestInfo`,
`CreatePackageOptions`, `ExportPackageOptions` types. Spec metadata type
definitions. Test fixtures (sample packages with known manifests and spec
metadata, packages with various artifact combinations for phase detection).

**Prerequisite:** Epics 10, 11, 12, and 9 complete

**ACs covered:**
- Infrastructure supporting all ACs (type definitions, schemas, fixtures)

**Estimated test count:** 8–10 tests

### Story 1: Package Context and Indicator

**Delivers:** Package manifest and metadata are included in the provider context
when a package is open. The context indicator shows workspace type and package
identity. Workspace type (folder/package) always present in context.

**Prerequisite:** Story 0

**ACs covered:**
- AC-1.1 (package context in provider)
- AC-1.2 (extended context indicator)
- AC-1.3 (package structure questions)

**Estimated test count:** 12–16 tests

### Story 2: Multi-File Reading

**Delivers:** `getFileContent(path)` script method. Cross-document file reading
in both package and folder modes. Path traversal prevention.

**Prerequisite:** Story 1

**ACs covered:**
- AC-2.1 (read any file by relative path)
- AC-2.2 (cross-document queries — multiple file reads)
- AC-2.3 (large file truncation)
- AC-2.4 (file reading in both modes)

**Estimated test count:** 12–16 tests

### Story 3: Package Operations Through Chat

**Delivers:** `updateManifest(content)`, `exportPackage(options)`, `createPackage(options)` script methods. `chat:package-changed` message handling on client. Sidebar re-sync after Steward-initiated operations. Navigation via `openDocument`.

**Prerequisite:** Stories 1 and 2

**ACs covered:**
- AC-3.1 (manifest modification through chat)
- AC-3.2 (export through chat)
- AC-3.3 (navigation through chat)
- AC-3.4 (client UI updates)
- AC-3.5 (directory-mode package transition and identity preservation)
- AC-3.6 (stale indicator in extracted packages)

**Estimated test count:** 20–26 tests

### Story 4: File Creation and Non-Active Editing

**Delivers:** `addFile(path, content)` and `editFile(path, content)` script
methods. File creation with intermediate directory creation. Non-active file
editing with dirty/clean tab handling. Path traversal prevention. Backward
compatibility with Epic 12's `applyEditToActiveDocument`.

**Prerequisite:** Story 2

**ACs covered:**
- AC-4.1 (create files through chat)
- AC-4.2 (edit non-active files through chat)
- AC-4.3 (Epic 12 editing unchanged)

**Estimated test count:** 14–18 tests

### Story 5: Spec Conventions and Phase Awareness

**Delivers:** Spec metadata recognition in manifest frontmatter. Artifact
detection from navigation entries. Phase detection logic. Spec-specific
context included in provider context. Phase information accessible for
Steward guidance.

**Prerequisite:** Story 1

**ACs covered:**
- AC-5.1 (spec metadata in context)
- AC-5.2 (set spec metadata through manifest updates)
- AC-5.3 (spec context data in ProviderContext)
- AC-6.1 (phase detection from artifacts)
- AC-6.2 (next-step context)
- AC-6.3 (phase guidance is conversational)

**Estimated test count:** 16–20 tests

### Story 6: Folder-Mode Chat and Error Handling

**Delivers:** Package operations (create, export) work on regular folders
through chat. File operations confirmed in folder mode. Error handling for all
script methods. Context injection error handling. Feature isolation verification.

**Prerequisite:** Stories 3 and 4

**ACs covered:**
- AC-7.1 (create package from folder through chat)
- AC-7.2 (export folder through chat)
- AC-7.3 (file operations in folder mode)
- AC-8.1 (script method errors)
- AC-8.2 (context injection errors)
- AC-8.3 (feature isolation)

**Estimated test count:** 14–18 tests

---

## Amendments

### Amendment 1: Codex R1 verification findings incorporated (Round 1)

**Source:** External review (Codex), `verification/codex/epic-review-r1.md`

**Changes:**
- [C1] Corrected Steward-principle overclaim. Replaced "all Epic 9 UI operations" with "package-content operations from Epic 9." Added workspace-switching operations (opening .mpk files, changing root, mode switching) to Out of Scope with rationale about mid-response root switching complexity. Updated validation checklist.
- [C2] Added `package.mode: 'directory' | 'extracted'` discriminator to ProviderContext. Added AC-3.5 (directory-mode package transition after `createPackage()`) with TCs for workspace type, canonical identity preservation, and context indicator. Added prose about canonical identity stability for directory-mode packages. Made `sourcePath` and `format` optional on the `package` type (only present for extracted).
- [M3] Added AC-2.3 (file read truncation for `getFileContent`) with TCs for within-budget, truncated, and binary-file cases. Added `FileReadResult` return type with `truncated` flag and `totalLines`. Updated method spec table. Added `NOT_TEXT_FILE` error code.
- [M4] Fixed AC-6.1c: changed detected phase from `implementation` to `stories` (the highest artifact-detectable phase). Added explicit note that `implementation` requires declared metadata. Updated artifact detection table to be consistent.
- [M5] Recast AC-5.3 to focus on the `spec` data field in ProviderContext (testable contract) rather than "instructions" (implementation concern). System prompt construction remains a tech design question (Q3).
- [M6] Fixed Feature Overview: distinguished file operations and package creation/export (work on folders) from spec awareness and phase guidance (require package with manifest metadata).
- [M7] Added message sequencing note: `chat:package-changed` and `chat:file-created` arrive before `chat:done`; ordering within a response is guaranteed. Removed stale indicator from tech design Q6 (now AC-3.6).
- [M8] REJECTED: `getFileContent`, `addFile`, and `editFile` are workspace-scoped with server-side path-traversal prevention — they are not broad filesystem primitives. They operate only within the workspace root, reject paths that escape it, and are mediated through the script execution sandbox. The tech arch warns against "readFile/writeFile on arbitrary paths" — these methods are not arbitrary-path operations. However, accepted the secondary concern: removed A5 (CLI Read fallback assumption) and replaced with A5 declaring the script methods as the sole file-access mechanism. Updated tech design Q10 accordingly.
- [M9] Addressed by C2 fix: AC-3.5b explicitly specifies that canonical identity is preserved across folder-to-package transition. Conversation and session ID are unchanged.
- [m10] Added TC-4.1e (permission denied on target directory for `addFile`) and TC-4.2f (permission denied on file for `editFile`). Added `PERMISSION_DENIED` error code.
- [m11] Added AC-3.6 (stale indicator in extracted packages) with TCs for addFile, editFile, and directory-mode-no-stale cases. Consistent with Epic 9 AC-7.2.
- [m12] Fixed validation checklist AC count from 27 to 28 (25 original + 3 new ACs: AC-2.3, AC-3.5, AC-3.6).

### Amendment 2: Codex R2 verification findings incorporated (Round 2)

**Source:** External review (Codex), `verification/codex/epic-review-r2.md`

**Changes:**
- [M1] Added per-response read budget to AC-2.2: TC-2.2c (budget exceeded returns error), TC-2.2d (budget resets per response). Added `READ_BUDGET_EXCEEDED` error code. Converted Tech Design Q1 from "whether to have a budget" to "what size the budget should be."
- [M2] Added TC-7.1d (fallback repair for extracted package with missing manifest) and TC-7.1e (fallback repair for extracted package with unreadable manifest), both consistent with Epic 9 AC-8.3.
- [M3] Added TC-3.6c (`updateManifest` in extracted package triggers stale). Added TC-3.2d (re-export to original path clears stale) and TC-3.2e (export to different path preserves stale), consistent with Epic 9 AC-5.3b/c. Updated TC-3.6d to include `updateManifest` in directory-mode no-stale list.
- [m4] Renamed TC-2.3a/TC-2.3b under AC-2.4 to TC-2.4a/TC-2.4b.
- [m5] Updated A2 to remove "mode switching" — consistent with Out of Scope fix from C1.
- [m6] Updated Story 5 to reference AC-5.3 as "spec context data in ProviderContext" instead of "spec-awareness instructions." Fixed amendment 1 count reference from "27 to 29" to "27 to 28."

---

## Validation Checklist

- [ ] User Profile has all four fields + Feature Overview
- [ ] Flows cover all paths (happy, alternate, cancel/error)
- [ ] Every AC is testable (no vague terms)
- [ ] Every AC has at least one TC
- [ ] TCs cover happy path, edge cases, and errors
- [ ] Data contracts are fully typed (extended ProviderContext, new message types, script methods, spec metadata)
- [ ] Scope boundaries are explicit (in/out/assumptions)
- [ ] Dependencies documented (Epics 8, 9, 10, 11, 12)
- [ ] Story breakdown covers all ACs (28 ACs, 90 TCs mapped across Stories 0–6)
- [ ] Stories sequence logically (foundation → context → reading → operations → files → spec → folder + errors)
- [ ] NFRs surfaced (context injection performance, script method performance, path safety, feature isolation)
- [ ] Tech design questions identified (10 questions)
- [ ] Extension points from Epics 10 and 12 identified (ProviderContext, ScriptContext, ChatServerMessage)
- [ ] Steward principle coverage explicit — package-content operations from Epic 9 have chat equivalents; workspace-switching operations (opening .mpk, changing root) explicitly deferred to Out of Scope
- [ ] Scope boundary with Epic 14 clear — no autonomous execution, no background tasks, no approval flow
- [ ] Script context methods are workspace-scoped with path-traversal prevention, consistent with tech arch method surface principle
- [ ] Spec metadata convention defined as optional, non-enforced
- [ ] Phase detection is informational, not prescriptive
- [ ] Directory-mode package model explicit (C2 fix: package.mode discriminator, identity preservation)
- [ ] File read truncation contract defined (M3 fix: consistent with Epic 12 pattern)
- [ ] Phase detection consistent between ACs and artifact table (M4 fix: implementation not artifact-detectable)
- [ ] Message sequencing defined (M7 fix: chat:package-changed before chat:done)
- [ ] Stale indicator behavior specified as ACs (m11 fix: AC-3.6)
- [ ] Self-review complete
- [ ] Verification round 1 complete (Codex)
- [ ] All Critical, Major, and Minor findings from round 1 addressed
- [ ] Verification round 2 complete (Codex)
- [ ] All Major and Minor findings from round 2 addressed
