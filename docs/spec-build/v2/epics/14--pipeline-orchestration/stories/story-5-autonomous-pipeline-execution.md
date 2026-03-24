# Story 5: Autonomous Pipeline Execution

---

### Summary
<!-- Jira: Summary field -->

The developer opts into autonomous mode. The Steward sequences through pipeline phases (epic, tech-design, stories) without intermediate approval. Progress is visible throughout via both task-level and run-level events. The developer can cancel at any time. Failure stops the sequence. Completed phase output is preserved regardless of subsequent cancellation or failure.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Working in a spec package with existing artifacts, ready to execute pipeline operations through the Steward rather than manually invoking Liminal Spec skills in separate terminal sessions.

**Objective:** Deliver the autonomous pipeline mode — maximum throughput for spec pipeline execution. After this story, the developer can say "run the full spec pipeline for Feature 3" and the Steward sequences through all applicable phases automatically. The developer reviews the final output rather than each intermediate artifact. Phases with existing artifacts are skipped. Each phase's output feeds the next. The developer can cancel the run at any time, and failures halt the sequence cleanly.

**Scope:**

In scope:
- **Server:** AutonomousSequencer class — run lifecycle (`start()`, `cancelRun()`, `getActiveRunSnapshot()`), phase progression with skip logic based on `spec.detectedArtifacts`, `cancelled` flag checked between phases, `waitForTaskCompletion()` via TaskManager event bus subscription
- **Server:** `chat:autonomous-run` events — `started` (with `runId`, planned `phases`, `skippedPhases`), `running`, `completed` (with `completedPhases`), `failed` (with `failedPhase`, `error`, `completedPhases`), `cancelled` (with `completedPhases`)
- **Server:** `chat:autonomous-cancel` handling in WS route
- **Server:** Autonomous dispatches use `immediate: true` — started events emit immediately (no foreground agent response to wait for)
- **Server:** `sequenceInfo` populated on each task dispatch within a run (`current`, `total`, `phaseName`)
- **Server:** Run-vs-task cancellation — `chat:autonomous-cancel` cancels the run (stops current task, prevents subsequent); `chat:task-cancel` on a task within a run stops the run (treated as failure per TC-4.4e)
- **Server:** `chat:task-snapshot` includes `autonomousRun` when active (started/running only; terminal states not replayed on reconnect)
- **Server:** Autonomous run events workspace-filtered via `workspaceIdentity` on the event
- **Client:** `autonomous-display.ts` — phase list with checkmarks (completed), dot (current), circle (pending), X (failed); skipped phases note; cancel button; error display
- **Client:** `ChatStateStore.updateAutonomousRun()` method
- **Client:** `ChatWsClient.cancelAutonomousRun()` send method
- **Client:** `chat-panel.ts` mounts and wires autonomous display
- **Client:** CSS for autonomous run display

Out of scope:
- Implementation phase in the autonomous sequence (developer kicks it off explicitly)
- Custom phase ordering
- Concurrent autonomous runs (rejected if one is active)

**Dependencies:**
- Story 4 complete (ResultsIntegrator for output integration between phases)
- Story 3 complete (PipelineDispatcher for phase dispatch)
- Story 2 complete (TaskManager for task lifecycle)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-4.1:** The developer can opt into autonomous mode, which produces a run-level lifecycle event

- **TC-4.1a: Autonomous request sends run-started event**
  - Given: A workspace with a PRD containing the target feature
  - When: The developer requests autonomous pipeline execution
  - Then: The server sends a `chat:autonomous-run` message with `status: 'started'`, a unique `runId`, and the planned `phases` list

- **TC-4.1b: Skipped phases reported**
  - Given: A workspace with a PRD and an existing epic
  - When: The developer requests autonomous pipeline execution
  - Then: The `chat:autonomous-run` `started` event lists the epic phase in `skippedPhases` and begins with `tech-design`

**AC-4.2:** In autonomous mode, phases execute sequentially without intermediate approval

- **TC-4.2a: Automatic phase progression**
  - Given: Autonomous mode is active and a phase has completed
  - When: The output is integrated
  - Then: The next phase in the sequence dispatches automatically without waiting for developer input; the new task's `autonomousRunId` matches the run's `runId`

- **TC-4.2b: Output of each phase feeds the next**
  - Given: Autonomous mode is active
  - When: The Steward dispatches the next phase in the sequence
  - Then: The input context includes the output from the preceding phase

- **TC-4.2c: Correct phase ordering**
  - Given: Autonomous mode is active with the standard sequence and no existing artifacts
  - When: The phases execute
  - Then: The sequence follows the order: `epic` → `tech-design` → `stories`

**AC-4.3:** Autonomous mode progress is visible in the chat via both task-level and run-level events

- **TC-4.3a: Per-task events carry sequence info**
  - Given: Autonomous mode is active
  - When: A new phase begins
  - Then: The `chat:task-status` `started` message includes `sequenceInfo` with `current`, `total`, and `phaseName`; and `autonomousRunId` matching the run's `runId`

- **TC-4.3b: Per-task completion reported**
  - Given: Autonomous mode is active
  - When: A phase completes
  - Then: A `chat:task-status` `completed` message is sent with `outputPaths` and `primaryOutputPath`

- **TC-4.3c: Run completion event sent**
  - Given: Autonomous mode is active and the final phase completes
  - When: All phases in the sequence are done
  - Then: The server sends a `chat:autonomous-run` message with `status: 'completed'` and `completedPhases` listing all finished phases

**AC-4.4:** The developer can cancel an autonomous run via `chat:autonomous-cancel`

- **TC-4.4a: Run cancel stops current task**
  - Given: Autonomous mode is active and a phase is running
  - When: The client sends `chat:autonomous-cancel` with the `runId`
  - Then: The currently running task is terminated; a `chat:task-status` `cancelled` message is sent for the task

- **TC-4.4b: Run cancel prevents subsequent phases**
  - Given: Autonomous mode is active with two phases remaining
  - When: The developer cancels the run
  - Then: The second remaining phase does not start

- **TC-4.4c: Completed phases preserved**
  - Given: Autonomous mode has completed two phases and is running a third
  - When: The developer cancels the run
  - Then: Output from the first two completed phases remains on disk and in the manifest

- **TC-4.4d: Run cancellation event sent with completed phases**
  - Given: An autonomous run has completed two phases and is running a third
  - When: The developer cancels the run
  - Then: The `chat:autonomous-run` message has `status: 'cancelled'`, `completedPhases` containing the two finished phases, and no `failedPhase` field

- **TC-4.4e: Single-task cancel within run stops the run**
  - Given: Autonomous mode is active and a phase is running
  - When: The developer cancels just the current task via `chat:task-cancel` (not the run)
  - Then: The task is cancelled; the run treats this as a failure and stops — subsequent phases do not start; `chat:autonomous-run` is sent with `status: 'failed'`

**AC-4.5:** Autonomous mode stops on task failure

- **TC-4.5a: Failure halts sequence**
  - Given: Autonomous mode is active and a phase fails
  - When: The task's CLI process exits with an error
  - Then: Subsequent phases do not start

- **TC-4.5b: Failure reported with run-level event**
  - Given: A phase in autonomous mode has failed
  - When: The failure is detected
  - Then: The server sends `chat:autonomous-run` with `status: 'failed'`, `failedPhase` identifying which phase failed, `error` with the description, and `completedPhases` listing prior successes

- **TC-4.5c: Prior output preserved**
  - Given: Autonomous mode completed two phases and the third failed
  - When: The developer views the workspace
  - Then: Output from the first two completed phases remains on disk

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### AutonomousSequencer

Manages multi-phase autonomous runs. Subscribes to TaskManager's event bus for phase completion detection.

```typescript
class AutonomousSequencer {
  constructor(dispatcher: PipelineDispatcher, taskManager: TaskManager);
  start(existingArtifacts: string[], baseConfig, resolveInputPaths, resolveOutputDir): Promise<string>;
  cancelRun(runId: string): void;
  getActiveRunSnapshot(workspaceIdentity: string): AutonomousRunSnapshot | null;
  onRunEvent(handler: RunEventHandler): () => void;
}

interface AutonomousRun {
  runId: string;
  workspaceIdentity: string;
  phases: PipelinePhase[];
  skippedPhases: PipelinePhase[];
  currentPhaseIndex: number;
  completedPhases: string[];
  failedPhase: string | null;
  cancelled: boolean;
  currentTaskId: string | null;
  status: 'started' | 'running' | 'completed' | 'failed' | 'cancelled';
}
```

**Sequencing logic:** `executeSequence()` is a `for...of` loop over `run.phases`:
1. Check `run.cancelled` flag — if set, emit `cancelled` event and return
2. Dispatch phase via `PipelineDispatcher.dispatch()` with `immediate: true` and `sequenceInfo`
3. `waitForTaskCompletion(taskId)` — subscribes to TaskManager event bus, resolves on terminal status
4. If `completed`: add to `completedPhases`, continue loop
5. If `failed` or `cancelled`: emit `failed` event with `failedPhase`, return

**Skip logic:** On `start()`, filters `AUTONOMOUS_SEQUENCE` against `existingArtifacts`:
```typescript
for (const phase of AUTONOMOUS_SEQUENCE) {
  if (existingArtifacts.includes(phase)) skippedPhases.push(phase);
  else phases.push(phase);
}
```

**Cancellation:**
- `chat:autonomous-cancel` → `cancelRun(runId)`: sets `cancelled = true`, cancels current task via TaskManager
- `chat:task-cancel` on a run task: task cancelled normally, sequencer detects non-completed status, emits `failed` run event (TC-4.4e)

**Snapshot:** `getActiveRunSnapshot(workspaceIdentity)` returns snapshot only for active runs (started/running). Terminal states delivered via live events, not replayed on reconnect.

#### Chat Autonomous Run Message

```typescript
interface ChatAutonomousRunMessage {
  type: 'chat:autonomous-run';
  runId: string;
  workspaceIdentity: string;
  status: 'started' | 'running' | 'completed' | 'failed' | 'cancelled';
  phases: string[];
  skippedPhases?: string[];
  currentPhaseIndex?: number;
  completedPhases?: string[];
  failedPhase?: string;
  error?: string;
}

interface ChatAutonomousCancelMessage {
  type: 'chat:autonomous-cancel';
  runId: string;
}
```

#### WebSocket Route

```typescript
// Handle autonomous cancel
case 'chat:autonomous-cancel':
  autonomousSequencer.cancelRun(msg.runId);
  break;

// Relay autonomous run events (workspace-filtered)
autonomousSequencer.onRunEvent((event) => {
  if (event.workspaceIdentity !== currentSocketWorkspace) return;
  sendMessage(socket, event);
});

// Snapshot includes autonomous run when active
const snapshot: ChatTaskSnapshotMessage = {
  type: 'chat:task-snapshot',
  tasks: taskManager.getAllTasks(identity),
  ...(autonomousSequencer.getActiveRunSnapshot(identity)
    ? { autonomousRun: autonomousSequencer.getActiveRunSnapshot(identity)! }
    : {}),
};
```

#### Autonomous Display (Client)

`mountAutonomousDisplay()` renders `.chat-autonomous-area` above `.chat-task-area`. Phase list with progress indicators: checkmark (completed), dot (current), circle (pending), X (failed). Cancel button for active runs. Skipped phases note. Error display on failure.

*See the tech design documents (`tech-design.md`, `tech-design-server.md`, `tech-design-client.md`) for full architecture, implementation targets, and test mapping.*

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] AutonomousSequencer with start, sequential execution, skip logic, cancel, failure handling
- [ ] `chat:autonomous-run` events emitted for all run lifecycle transitions
- [ ] `chat:autonomous-cancel` handled in WS route
- [ ] `sequenceInfo` populated on autonomous task dispatches
- [ ] Run-vs-task cancellation distinction (TC-4.4e)
- [ ] Autonomous run included in task snapshots when active
- [ ] Autonomous display renders phase list with progress, cancel, skipped, errors
- [ ] CSS for autonomous run display added to `chat.css`
- [ ] `npm run verify` passes (format, lint, typecheck, tests)
- [ ] 23 tests pass: 14 autonomous-sequencer, 5 autonomous-failure, 4 autonomous-display
