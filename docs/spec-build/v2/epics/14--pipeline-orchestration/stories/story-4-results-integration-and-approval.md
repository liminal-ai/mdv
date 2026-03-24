# Story 4: Results Integration and Approval

---

### Summary
<!-- Jira: Summary field -->

When a pipeline task completes, output files appear in the workspace, the package manifest is updated (in package mode), and the Steward notifies the developer. The developer reviews output and communicates feedback through the chat. The Steward dispatches the next phase on approval or re-dispatches with feedback on change request.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Working in a spec package with existing artifacts, ready to execute pipeline operations through the Steward rather than manually invoking Liminal Spec skills in separate terminal sessions.

**Objective:** Close the pipeline feedback loop. After this story, completed task output integrates into the workspace with manifest updates, the developer can review output in the viewer, approve to proceed to the next phase, or request changes that trigger a re-dispatch. Output links are clickable, feedback binds to the correct task via `lastCompletedTask` in ProviderContext, and `specPhase`/`specStatus` metadata advances correctly through the approval lifecycle.

**Scope:**

In scope:
- **Server:** ResultsIntegrator class — parse output manifest from CLI `resultText`, read files from staging directory, write to workspace via Epic 13's `addFile()`/`editFile()`, emit `chat:file-created` per file (with `messageId = taskId`), update manifest in package mode (navigation entries, `specPhase` advancement, `specStatus: 'draft'`), emit `chat:package-changed` (with `messageId = taskId`)
- **Server:** Manifest integration edge cases — multi-file output grouped (TC-3.7a), rerun overwrites without duplicating entries (TC-3.7b), phase metadata advances on success (TC-3.7c), no advancement on failure/cancellation (TC-3.7d), `specStatus` advances to `approved` on explicit approval (TC-3.7e), re-dispatch resets `specStatus` to `draft` (TC-3.7f)
- **Server:** ApprovalHandler class — `approvePhase()` sets `specStatus: 'approved'`, `resetForRedispatch()` sets `specStatus: 'draft'`
- **Server:** ProviderManager extended with `lastCompletedTask` tracking (workspace-scoped Map), `setLastCompletedTask()`, `getLastCompletedTask()`
- **Server:** Context injection extended — `lastCompletedTask` included in ProviderContext when present
- **Server:** Script context extended with `approveCurrentPhase()` and `resetPhaseForRedispatch()`
- **Server:** Completion message ordering: `chat:file-created` → `chat:package-changed` → `chat:task-status completed`
- **Server:** WS route — ResultsIntegrator runs before relaying `completed` event, enriches event with `outputPaths`/`primaryOutputPath`
- **Client:** Task display completed state — output link clicking opens file in viewer via Epic 12's `openFile()`

Out of scope:
- Autonomous sequencing (Story 5)
- Formal approval gate UI (fast follow)

**Dependencies:**
- Story 3 complete (PipelineDispatcher, script context extensions)
- Epic 12 complete (context injection, `openFile()` client API, `chat:file-created`)
- Epic 13 complete (`addFile()`, `editFile()`, `getPackageManifest()`, `updateManifest()`, `chat:package-changed`)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-3.1:** Completed task output files appear in the workspace

- **TC-3.1a: Output files exist after task completion**
  - Given: A pipeline task completes successfully
  - When: The `chat:task-status` with `completed` status is sent
  - Then: All files listed in `outputPaths` exist on disk; `primaryOutputPath` points to the main artifact

- **TC-3.1b: File-created notification sent per output file**
  - Given: A `tech-design` task completes producing three files
  - When: The task completes
  - Then: A `chat:file-created` message is sent for each output file, with `messageId` set to the `taskId`; the viewer refreshes any open files

- **TC-3.1c: Single-file phase output**
  - Given: An `epic` task completes producing one file
  - When: The task completes
  - Then: `outputPaths` contains one entry; `primaryOutputPath` equals that entry

**AC-3.2:** When a package is open, the manifest is updated to include new output files

- **TC-3.2a: Manifest updated in package mode**
  - Given: A spec package is open and a pipeline task completes with a new output file
  - When: Results are integrated
  - Then: The package manifest includes a navigation entry for the new file

- **TC-3.2b: Sidebar reflects manifest update**
  - Given: The manifest has been updated with a new file entry
  - When: The developer views the sidebar
  - Then: The new file appears in the package navigation tree

- **TC-3.2c: No manifest update in folder mode**
  - Given: The developer is working in a regular folder (not a package)
  - When: A pipeline task completes with an output file
  - Then: The file is written to disk but no manifest update occurs (folder mode has no manifest)

**AC-3.7:** Manifest integration handles multi-file outputs, reruns, and phase metadata correctly

- **TC-3.7a: Multi-file output grouped in manifest**
  - Given: A `tech-design` task completes producing `tech-design.md`, `tech-design-server.md`, and `test-plan.md`
  - When: The manifest is updated
  - Then: All output files are added as navigation entries (grouped under a section if applicable); a single `chat:package-changed` with `change: 'manifest-updated'` is sent after all entries are added

- **TC-3.7b: Rerun overwrites existing output without duplicating manifest entries**
  - Given: A previous run already produced `epic.md` which is in the manifest
  - When: A re-dispatch of the `epic` phase completes and overwrites `epic.md`
  - Then: The manifest retains its existing navigation entry for `epic.md` (no duplicate entry); `chat:file-created` is sent for the overwritten file

- **TC-3.7c: Phase metadata advances on successful completion (package mode)**
  - Given: A spec package with `specPhase: prd` and the `epic` phase task completes
  - When: Results are integrated
  - Then: The manifest's `specPhase` is updated to `epic` and `specStatus` is set to `draft` via `updateManifest`

- **TC-3.7d: Phase metadata not advanced on failure or cancellation**
  - Given: A spec package with `specPhase: epic` and the `tech-design` task fails
  - When: The failure is handled
  - Then: The manifest's `specPhase` remains `epic`; `specStatus` is unchanged

- **TC-3.7e: specStatus advances to approved on explicit approval**
  - Given: A spec package with `specPhase: epic` and `specStatus: draft`
  - When: The developer approves the epic output through chat and the Steward proceeds to the next phase
  - Then: The manifest's `specStatus` is updated to `approved` via `updateManifest` before the next phase dispatches

- **TC-3.7f: Re-dispatch resets specStatus to draft**
  - Given: A spec package with `specPhase: epic` and `specStatus: approved`
  - When: The developer requests re-dispatch of the epic phase with feedback
  - Then: The manifest's `specStatus` is reset to `draft` via `updateManifest`

**AC-3.3:** The Steward notifies the developer on task completion and offers to open the result

- **TC-3.3a: Completion notification in chat**
  - Given: A pipeline task completes
  - When: The `chat:task-status` with `completed` status arrives
  - Then: The `chat:task-status` `completed` message contains `outputPaths` and `primaryOutputPath`; the chat panel displays the completion with the primary output location (via the task status indicator from AC-1.2)

- **TC-3.3b: Output path is navigable**
  - Given: The completion notification contains an output file path
  - When: The developer views the notification
  - Then: The file path is a clickable link that opens the file in the viewer (using Epic 12's local file navigation)

**AC-3.4:** The developer can send feedback after reviewing a completed task's output, with intent bound to a specific task

- **TC-3.4a: Follow-up message with output as context**
  - Given: A pipeline task has completed and the developer has opened the primary output file
  - When: The developer sends a follow-up message in the chat
  - Then: The message is sent with the output file as the active document context (Epic 12's context injection); the provider context also includes the most recently completed task's `taskId` and `phase` so the Steward can bind the feedback to the correct task

- **TC-3.4b: Feedback does not interfere with running tasks**
  - Given: The developer is reviewing output from one completed task while another task is running
  - When: The developer sends feedback about the completed task's output
  - Then: The feedback is processed normally; the running task is unaffected

- **TC-3.4c: Ambiguous feedback with multiple completed tasks**
  - Given: Two tasks have recently completed (epic for Feature A and tech-design for Feature B)
  - When: The developer sends "looks good, proceed" without specifying which task
  - Then: The Steward binds the feedback to the task whose primary output matches the currently active document (context injection provides the binding); if no output is open, the Steward asks for clarification

**AC-3.5:** On approval, the Steward can dispatch the next pipeline phase

- **TC-3.5a: Follow-on phase uses preceding output as input**
  - Given: The developer has reviewed the output from epic drafting and requested the next phase
  - When: The Steward dispatches the tech design phase
  - Then: The tech design task receives the just-completed epic as input

- **TC-3.5b: Follow-on dispatch produces a new task**
  - Given: The Steward dispatches a follow-on phase
  - When: The task starts
  - Then: The new task has its own task ID and independent lifecycle; it appears as a separate task in status tracking

**AC-3.6:** On change request, the Steward can re-dispatch the phase with the developer's feedback incorporated

- **TC-3.6a: Re-dispatch includes feedback context**
  - Given: The developer has reviewed output and requested changes
  - When: The Steward re-dispatches the same phase
  - Then: The task context includes the developer's feedback alongside the original input artifacts

- **TC-3.6b: Re-dispatch produces a new task**
  - Given: The Steward re-dispatches a phase with feedback
  - When: The task starts
  - Then: The new task has its own task ID; the previous task's completed status is unchanged

- **TC-3.6c: Re-dispatch output replaces previous output**
  - Given: A re-dispatched task completes
  - When: The output file is written
  - Then: The output file overwrites the previous version at the same path

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### ResultsIntegrator

Handles successful task completion: parsing output manifest, integrating files, updating package manifest, dispatching notifications.

```typescript
class ResultsIntegrator {
  constructor(workspaceRoot: string, fileService: WorkspaceFileService, isPackageMode: () => boolean);
  integrate(taskId: string, task: ManagedTask, cliResultText: string): Promise<{ outputPaths: string[]; primaryOutputPath: string }>;
  onFileCreated(handler: FileCreatedHandler): () => void;
  onPackageChanged(handler: PackageChangedHandler): () => void;
}

interface WorkspaceFileService {
  addFile(path: string, content: string): Promise<void>;
  editFile(path: string, content: string): Promise<void>;
  getPackageManifest(): Promise<PackageManifestInfo>;
  updateManifest(content: string): Promise<void>;
}
```

**Output manifest parsing:** Extracts JSON code block from CLI `resultText`:
```json
{"outputFiles": ["epic.md"], "primaryFile": "epic.md"}
```
If no manifest found (error, crash), `outputPaths` is empty. Failure mode is under-reporting, not over-reporting.

**File integration flow:**
1. Parse manifest from `resultText`
2. For each file: read from staging dir, write to workspace via `addFile()` (or `editFile()` if exists)
3. Emit `chat:file-created` per file with `messageId = taskId`
4. If package mode: add navigation entries (skip existing for TC-3.7b), advance `specPhase`, set `specStatus: 'draft'`
5. Emit `chat:package-changed` with `messageId = taskId`

**Completion message ordering:** `chat:file-created` → `chat:package-changed` → `chat:task-status completed`

#### ApprovalHandler

```typescript
class ApprovalHandler {
  constructor(fileService: WorkspaceFileService, isPackageMode: () => boolean);
  approvePhase(): Promise<void>;       // specStatus → 'approved' (AC-3.7e)
  resetForRedispatch(): Promise<void>; // specStatus → 'draft' (AC-3.7f)
}
```

Both manipulate `specStatus` in manifest frontmatter via `getPackageManifest()` + `updateManifest()`.

#### ProviderContext Extension

```typescript
interface ProviderContext {
  // Existing fields (Epics 12, 13)...
  lastCompletedTask?: {
    taskId: string;
    phase: string;
    primaryOutputPath: string;
  };
}
```

Workspace-scoped `Map<string, lastCompletedTask>` in ProviderManager. Set on task completion (from TaskManager event). Persists across `chat:clear`. Context injection includes it when present.

#### Script Context Additions

```typescript
approveCurrentPhase: async (): Promise<void> => {
  await approvalHandler.approvePhase();
},
resetPhaseForRedispatch: async (): Promise<void> => {
  await approvalHandler.resetForRedispatch();
},
```

*See the tech design documents (`tech-design.md`, `tech-design-server.md`, `tech-design-client.md`) for full architecture, implementation targets, and test mapping.*

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] ResultsIntegrator parses output manifest, writes files via Epic 13 services
- [ ] `chat:file-created` and `chat:package-changed` emitted with `messageId = taskId`
- [ ] Manifest updates: navigation entries, `specPhase` advancement, `specStatus` lifecycle
- [ ] ApprovalHandler with `approvePhase()` and `resetForRedispatch()`
- [ ] ProviderManager tracks `lastCompletedTask` per workspace
- [ ] Context injection includes `lastCompletedTask` in ProviderContext
- [ ] Completion message ordering enforced
- [ ] Task display output link opens file in viewer
- [ ] `npm run verify` passes (format, lint, typecheck, tests)
- [ ] 26 tests pass: 13 results-integrator, 6 approval-binding, 4 follow-on-dispatch, 3 task-display-completion
