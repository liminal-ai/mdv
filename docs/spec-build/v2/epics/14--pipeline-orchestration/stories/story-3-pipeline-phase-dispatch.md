# Story 3: Pipeline Phase Dispatch

---

### Summary
<!-- Jira: Summary field -->

The Steward dispatches specific Liminal Spec pipeline phases (epic, tech-design, stories, implementation) as background tasks with correct input artifact resolution, prerequisite validation, dispatch detail reporting, and duplicate task rejection.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Working in a spec package with existing artifacts, ready to execute pipeline operations through the Steward rather than manually invoking Liminal Spec skills in separate terminal sessions.

**Objective:** Build the pipeline dispatch layer on top of Story 2's task infrastructure. After this story, the developer can request specific pipeline phases ("draft the epic for Feature 2") and the Steward validates prerequisites, resolves input artifacts, reports what it will use and where it will write, and dispatches the operation. Duplicate requests for the same phase and feature are rejected.

**Scope:**

In scope:
- **Server:** PipelineDispatcher class — phase configuration, input artifact resolution via Epic 13's `getFileContent()`, prerequisite validation (missing input → `PREREQUISITE_MISSING` error), CLI invocation construction (system prompt + user message with `<pipeline-task>` and `<input-artifact>` blocks)
- **Server:** Extended ScriptExecutor — `dispatchTask()` delegates to PipelineDispatcher, `getRunningTasks()` delegates to TaskManager, `cancelTask()` delegates to TaskManager
- **Server:** `ScriptResult.errorCode` for propagating dispatch errors to `chat:error` (e.g., `PREREQUISITE_MISSING`)
- **Server:** Pre-start ordering — deferred started events flushed after foreground `chat:done` (AC-2.4)
- **Server:** Duplicate task detection by `phase + target + workspaceIdentity`
- **Client:** Dispatch reporting visible in chat (agent response before started event)

Out of scope:
- Output file handling, manifest updates (Story 4)
- Approval flow, re-dispatch (Story 4)
- Autonomous sequencing (Story 5)

**Dependencies:**
- Story 2 complete (TaskManager, WS route extensions, task display)
- Epic 13 complete (`getFileContent()` service method)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-2.1:** The Steward dispatches supported pipeline phases as background tasks when requested

- **TC-2.1a: Epic drafting dispatch**
  - Given: A workspace with a PRD file
  - When: The developer requests epic drafting for a feature
  - Then: A background task is dispatched and a `chat:task-status` message with `started` status is sent

- **TC-2.1b: Tech design dispatch**
  - Given: A workspace with a completed epic
  - When: The developer requests tech design
  - Then: A background task is dispatched for the tech design phase

- **TC-2.1c: Stories phase dispatch**
  - Given: A workspace with a completed epic and tech design
  - When: The developer requests story generation
  - Then: A background task is dispatched for the `stories` phase

- **TC-2.1d: Implementation dispatch**
  - Given: A workspace with published stories
  - When: The developer requests implementation
  - Then: A background task is dispatched for the implementation phase

- **TC-2.1e: Foreground remains available after dispatch**
  - Given: A pipeline task has been dispatched
  - When: The developer sends a follow-up message
  - Then: The foreground chat session responds normally — the dispatch did not block the interactive session

**AC-2.2:** Each pipeline phase receives the appropriate input artifacts as context

- **TC-2.2a: Epic drafting receives PRD content**
  - Given: The developer requests epic drafting for a feature
  - When: The task is dispatched
  - Then: The task's CLI invocation includes the PRD content (or the relevant feature section) as input context

- **TC-2.2b: Tech design receives epic content**
  - Given: The developer requests tech design
  - When: The task is dispatched
  - Then: The task's CLI invocation includes the epic content as input context

- **TC-2.2c: Stories phase receives epic and tech design**
  - Given: The developer requests story generation
  - When: The task is dispatched
  - Then: The task's CLI invocation includes both the epic and tech design as input context

- **TC-2.2d: Implementation receives stories and tech design**
  - Given: The developer requests implementation
  - When: The task is dispatched
  - Then: The task's CLI invocation includes the published stories and tech design as input context

**AC-2.3:** Phase prerequisites are validated before dispatch — missing inputs produce an explanatory message

- **TC-2.3a: Tech design without epic**
  - Given: A workspace with a PRD but no epic
  - When: The developer requests tech design
  - Then: No background task is dispatched; a `chat:error` message is sent with code `PREREQUISITE_MISSING` identifying the missing artifact (epic)

- **TC-2.3b: Stories without tech design**
  - Given: A workspace with a PRD and epic but no tech design
  - When: The developer requests story generation
  - Then: No background task is dispatched; a `chat:error` message is sent with code `PREREQUISITE_MISSING` identifying the missing artifact (tech design)

- **TC-2.3c: All prerequisites met**
  - Given: A workspace with all required input artifacts for the requested phase
  - When: The developer requests the phase
  - Then: Prerequisites pass and the task is dispatched

- **TC-2.3d: Implementation without stories**
  - Given: A workspace with spec artifacts but no published stories
  - When: The developer requests implementation
  - Then: No background task is dispatched; a `chat:error` message is sent with code `PREREQUISITE_MISSING`

**AC-2.4:** The Steward reports dispatch details before starting the task

- **TC-2.4a: Input artifacts reported**
  - Given: Prerequisites are met for the requested phase
  - When: The Steward dispatches the task
  - Then: The `chat:task-status` `started` message is preceded by a completed agent response (non-empty, `streaming: false`) that references the input artifacts being used

- **TC-2.4b: Output location reported**
  - Given: Prerequisites are met for the requested phase
  - When: The Steward dispatches the task
  - Then: The `chat:task-status` `started` message includes the planned `outputDir`, and the preceding agent response references the output location

- **TC-2.4c: Reported output directory matches actual output**
  - Given: The Steward reported an output directory before dispatch
  - When: The task completes
  - Then: All output files in `outputPaths` are within the reported directory

**AC-5.4:** Duplicate task dispatch for the same phase and feature is rejected

- **TC-5.4a: Duplicate rejected**
  - Given: A background task is running for epic drafting of Feature A
  - When: The developer requests another epic drafting task for Feature A
  - Then: The duplicate is rejected with a `chat:error` message with code `TASK_ALREADY_RUNNING` identifying the existing task

- **TC-5.4b: Different phase allowed**
  - Given: A background task is running for epic drafting of Feature A
  - When: The developer requests tech design for Feature B
  - Then: The new task is dispatched (different phase/feature combination)

- **TC-5.4c: Same phase, different feature allowed**
  - Given: A background task is running for epic drafting of Feature A
  - When: The developer requests epic drafting for Feature B
  - Then: The new task is dispatched (different feature)

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### PipelineDispatcher

Resolves input artifacts via Epic 13's `getFileContent()`, validates prerequisites, constructs CLI invocations.

```typescript
class PipelineDispatcher {
  constructor(taskManager: TaskManager, fileReader: FileReader, workspaceRoot: string);
  dispatch(config: TaskDispatchConfig): Promise<string>;
  buildCliArgs(config, inputs): string[];
}

interface FileReader {
  getFileContent(path: string): Promise<FileReadResult>;
}
```

**CLI invocation pattern:**
```bash
claude -p --output-format stream-json --verbose --bare --max-turns 50 \
  --system-prompt "<phase instructions>" "<pipeline-task>...</pipeline-task>"
```

**User message structure:**
```xml
<pipeline-task phase="tech-design" target="feature-2">
<input-artifact type="epic" path="epics/feature-2/epic.md">
[Full epic content]
</input-artifact>

Execute the Technical Design phase. Write all output files to the current directory.
</pipeline-task>
```

**System prompt:** Phase-specific instructions directing the CLI to work autonomously, write to cwd (staging dir), and emit a JSON output manifest listing created files.

**Prerequisite validation:** `readInputArtifacts()` calls `getFileContent()` for each required input. If any throws, dispatch throws with `code: 'PREREQUISITE_MISSING'`.

**Duplicate detection:** TaskManager checks `phase + target + workspaceIdentity` among active tasks before spawning.

#### Script Context Extensions

```typescript
// Added to createScriptContext():
dispatchTask: async (config: TaskDispatchConfig): Promise<string> => {
  const taskId = await pipelineDispatcher.dispatch(config);
  pendingTaskIds.add(taskId);  // Track for deferred start flush
  return taskId;
},
getRunningTasks: async (): Promise<TaskInfo[]> => {
  return taskManager.getAllTasks(currentWorkspaceIdentity);
},
cancelTask: async (taskId: string): Promise<void> => {
  taskManager.cancel(taskId);
},
```

#### Error Code Propagation

```typescript
// ScriptResult extended:
interface ScriptResult {
  success: boolean;
  value?: unknown;
  error?: string;
  errorCode?: string;  // Specific code from the method
}

// ProviderManager.executeScript() uses errorCode for chat:error emission
```

*See the tech design documents (`tech-design.md`, `tech-design-server.md`) for full architecture, implementation targets, and test mapping.*

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] PipelineDispatcher reads inputs via `getFileContent()`, validates prerequisites
- [ ] CLI args constructed with phase-specific system prompt and `<pipeline-task>` user message
- [ ] ScriptExecutor extended with `dispatchTask()`, `getRunningTasks()`, `cancelTask()`
- [ ] `ScriptResult.errorCode` propagates dispatch errors to `chat:error`
- [ ] Deferred started events flushed after foreground `chat:done` for pre-start ordering
- [ ] Duplicate detection by `phase + target + workspaceIdentity`
- [ ] `npm run verify` passes (format, lint, typecheck, tests)
- [ ] 20 tests pass: 14 pipeline-dispatcher, 4 script-executor-tasks, 2 chat-panel-dispatch
