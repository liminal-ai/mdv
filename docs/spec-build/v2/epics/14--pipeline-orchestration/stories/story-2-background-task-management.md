# Story 2: Background Task Management

---

### Summary
<!-- Jira: Summary field -->

The developer can dispatch background tasks, see their status in the chat, cancel them, and continue chatting while they run. The server manages background CLI processes with lifecycle tracking, periodic progress reporting, concurrent task support, task snapshots on reconnect, and clean termination. Feature-flagged behind `FEATURE_SPEC_STEWARD`.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Working in a spec package with existing artifacts, ready to execute pipeline operations through the Steward rather than manually invoking Liminal Spec skills in separate terminal sessions. "I tell the Steward what to build, it runs the pipeline in the background while I keep working, I review the output and tell it to continue or fix things."

**Objective:** Deliver the background task lifecycle foundation. After this story, background tasks can be dispatched, tracked, cancelled, and reported on — the core plumbing that Stories 3–5 build specific pipeline logic on top of. The developer sees task status indicators in the chat panel, can send messages while tasks run, and gets status restored on reconnect.

**Scope:**

In scope:
- **Server:** TaskManager class (spawn CLI processes, monitor exit/error, heartbeat progress every 15s, cancel with AbortController + SIGKILL fallback, concurrent task limit of 3, in-memory state tracking, workspace-scoped `getAllTasks()`/`getLastCompleted()`, graceful shutdown, deferred started events, stdout buffering for result text)
- **Server:** WebSocket route extensions — handle `chat:task-cancel`, subscribe to TaskManager event bus and relay task events (workspace-filtered), send `chat:task-snapshot` on connect (after `chat:conversation-load`) and workspace switch, flush deferred started events after `chat:done`
- **Server:** Feature flag gating — no task infrastructure initialized when `FEATURE_SPEC_STEWARD` is disabled
- **Client:** `ChatStateStore` extended with `tasks[]` and `autonomousRun` state, `replaceTaskSnapshot()`, `updateTask()`, `removeTask()` methods
- **Client:** `ChatWsClient` extended with `chat:task-status`, `chat:task-snapshot`, `chat:autonomous-run` event dispatch and `cancelTask()` send method
- **Client:** `task-display.ts` — task status indicators above message list showing phase, status, elapsed time, output link (completed), error (failed), cancel button (active)
- **Client:** `chat-panel.ts` — mount task display, wire WebSocket events to state store
- **Client:** CSS for task indicators
- Fastify `onClose` hook for TaskManager shutdown

Out of scope:
- Pipeline phase dispatch logic (Story 3)
- Results integration, manifest updates, approval flow (Story 4)
- Autonomous sequencing (Story 5)
- Autonomous display component (Story 5)

**Dependencies:**
- Story 1 complete (schemas, types, fixtures)
- Epics 10 (chat plumbing), 12 (document awareness), 13 (package awareness) complete

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1:** The developer can continue chatting while a background task runs

- **TC-1.1a: Chat exchange during running task**
  - Given: A background task is running
  - When: The developer sends a chat message
  - Then: The Steward responds normally — the message flows through the foreground provider independently of the background task

- **TC-1.1b: Task status updates do not interrupt active streaming**
  - Given: A background task is running AND the Steward is streaming a foreground response
  - When: A `chat:task-status` message arrives
  - Then: The status message is delivered to the client without interrupting the active token stream (messages are independent WebSocket frames)

- **TC-1.1c: Multiple chat exchanges during long task**
  - Given: A background task has been running for several minutes
  - When: The developer sends multiple messages and receives responses
  - Then: All exchanges complete normally; the background task continues running

**AC-1.2:** Active background tasks are visible in the chat panel with status and elapsed time

- **TC-1.2a: Running task shows status**
  - Given: A background task is running
  - When: The developer views the chat panel
  - Then: A task status indicator is visible showing the task description, phase, and current status

- **TC-1.2b: Elapsed time updates**
  - Given: A background task has been running for more than one minute
  - When: The developer views the task status indicator
  - Then: The elapsed time is visible and reflects approximate real time (updated via periodic `chat:task-status` messages)

- **TC-1.2c: Completed task shows final status**
  - Given: A background task has completed
  - When: The developer views the chat panel
  - Then: The task status indicator shows "completed" with the output location

- **TC-1.2d: No indicators when no tasks exist**
  - Given: No background tasks are running or recently completed
  - When: The developer views the chat panel
  - Then: No task status indicators are visible

**AC-1.3:** The developer can cancel a running background task

- **TC-1.3a: Cancel via WebSocket message**
  - Given: A background task is running with a known task ID
  - When: The client sends a `chat:task-cancel` message with the task ID
  - Then: The background task is terminated and a `chat:task-status` message with `cancelled` status is sent

- **TC-1.3b: Cancel via script execution lane**
  - Given: A background task is running
  - When: The `cancelTask(taskId)` script context method is called with the task's ID
  - Then: The background task is terminated and a `chat:task-status` message with `cancelled` status is sent

- **TC-1.3c: Partial output preserved on cancel**
  - Given: A background task has produced partial output before cancellation
  - When: The task is cancelled
  - Then: Any files written to disk before cancellation remain (not deleted)

- **TC-1.3d: Cancel non-existent task**
  - Given: No background task with the specified ID exists
  - When: A `chat:task-cancel` message is sent with that ID
  - Then: A `chat:error` message is returned with code `TASK_NOT_FOUND`

**AC-1.4:** Task lifecycle events are communicated via dedicated WebSocket messages

- **TC-1.4a: Started event**
  - Given: A background task is dispatched
  - When: The task begins execution
  - Then: The server sends a `chat:task-status` message with `status: 'started'`, the task ID, phase, and description

- **TC-1.4b: Progress events**
  - Given: A background task is running
  - When: Periodic progress intervals elapse
  - Then: The server sends `chat:task-status` messages with `status: 'running'` and updated `elapsedMs`

- **TC-1.4c: Completed event**
  - Given: A background task finishes successfully
  - When: The task's CLI process exits with success
  - Then: The server sends a `chat:task-status` message with `status: 'completed'`, `outputPaths` listing all output files, and `primaryOutputPath` indicating the main artifact

- **TC-1.4d: Failed event**
  - Given: A background task fails
  - When: The task's CLI process exits with an error
  - Then: The server sends a `chat:task-status` message with `status: 'failed'` and `error` describing the failure

**AC-1.5:** Multiple background tasks can run concurrently up to a configured limit

- **TC-1.5a: Two tasks for different phases run simultaneously**
  - Given: One background task is running (e.g., epic drafting for Feature A)
  - When: The developer dispatches another task (e.g., tech design for Feature B)
  - Then: Both tasks run concurrently; each has independent status tracking

- **TC-1.5b: Concurrency limit enforced**
  - Given: The maximum number of concurrent background tasks is running
  - When: The developer requests an additional task
  - Then: The dispatch is rejected with a `chat:error` message with code `TASK_LIMIT_REACHED` explaining that the concurrency limit has been reached

- **TC-1.5c: Independent lifecycle**
  - Given: Two background tasks are running concurrently
  - When: One task completes
  - Then: The other task continues running unaffected; the completed task's status is reported independently

**AC-1.6:** Task state is delivered to the client on WebSocket connect and workspace switch via `chat:task-snapshot`

- **TC-1.6a: Snapshot on initial connect**
  - Given: Two background tasks are running (one active, one recently completed)
  - When: The client establishes a WebSocket connection
  - Then: The server sends a `chat:task-snapshot` message containing both tasks with their current status, after the `chat:conversation-load` message

- **TC-1.6b: Snapshot on reconnect**
  - Given: A background task was running when the WebSocket dropped
  - When: The client reconnects
  - Then: The server sends a `chat:task-snapshot` reflecting the current state of all tasks (the running task may have completed during the disconnect)

- **TC-1.6c: Snapshot on workspace switch**
  - Given: Tasks are running in workspace A
  - When: The developer switches to workspace B
  - Then: The client receives a `chat:task-snapshot` for workspace B (which may have no tasks)

- **TC-1.6d: Snapshot after server restart**
  - Given: Tasks were running when the server restarted
  - When: The client connects to the restarted server
  - Then: The `chat:task-snapshot` contains no tasks (task state is not persisted across restarts, consistent with the "no pipeline state persistence" scope boundary)

- **TC-1.6e: Snapshot semantics are replace**
  - Given: The client has local task state from a previous snapshot
  - When: A new `chat:task-snapshot` arrives
  - Then: The client replaces all local task state with the snapshot contents

**AC-5.1:** Task failure produces a notification in the chat with the error description

- **TC-5.1a: Failed task sends error notification**
  - Given: A background task is running
  - When: The task's CLI process exits with an error
  - Then: A `chat:task-status` message with `status: 'failed'` is sent, containing a human-readable error description

- **TC-5.1b: Failure does not crash server**
  - Given: A background task fails
  - When: The error is reported
  - Then: The server continues running; the foreground chat session is unaffected

- **TC-5.1c: Failure does not affect other running tasks**
  - Given: Two background tasks are running concurrently
  - When: One task fails
  - Then: The other task continues running; only the failed task's status changes

**AC-5.2:** Partial output from a failed task is preserved on disk

- **TC-5.2a: Partial files remain**
  - Given: A background task wrote partial output before failing
  - When: The task fails
  - Then: The partial output file remains on disk (not deleted)

- **TC-5.2b: Partial output not added to manifest**
  - Given: A package is open and a task fails with partial output
  - When: The failure is handled
  - Then: The partial output is not added to the package manifest (only successful completion triggers manifest update)

**AC-5.3:** All Epic 14 functionality is absent when the feature flag is disabled

- **TC-5.3a: No task infrastructure initialized**
  - Given: `FEATURE_SPEC_STEWARD` is disabled
  - When: The server starts
  - Then: No background task management infrastructure is initialized; no task-related resources are allocated

- **TC-5.3b: Task messages not processed**
  - Given: `FEATURE_SPEC_STEWARD` is disabled
  - When: A WebSocket client sends a `chat:task-cancel` message
  - Then: The message is rejected (the `/ws/chat` route does not exist when the flag is disabled)

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### TaskManager

Core background task lifecycle manager. Spawns CLI processes, tracks state in `Map<string, ManagedTask>`, emits all lifecycle events through a single event bus.

Key implementation details:
- **Concurrency:** `MAX_CONCURRENT_TASKS = 3`. Checked before dispatch.
- **Heartbeat:** 15-second `setInterval` emitting `running` status with `elapsedMs`. Cleared on any terminal state.
- **Cancellation:** `AbortController.abort()` sends SIGTERM via `spawn()` `signal` option. SIGKILL fallback at 10 seconds. `activeCountDecremented` flag ensures count decrements only in the `exit` handler.
- **Deferred started events:** `dispatch()` stores the started event; `flushDeferredStarted(taskId)` emits it (called by WS route after foreground `chat:done`). Autonomous dispatches use `immediate: true` to emit immediately.
- **Staging directory:** Each task gets `mkdtemp(join(tmpdir(), 'mdv-task-'))` as CLI `cwd`.
- **Stdout buffering:** Stream-JSON lines parsed for `text_delta` content and `result` events to build `resultText`.
- **Shutdown:** `shutdown()` aborts all active tasks, awaits each process exit with 5-second SIGKILL fallback.

```typescript
class TaskManager {
  dispatch(config: TaskDispatchConfig, cliArgs: string[]): Promise<string>;
  flushDeferredStarted(taskId: string): void;
  cancel(taskId: string): void;  // throws TASK_NOT_FOUND
  getAllTasks(workspaceIdentity: string): TaskInfo[];
  getTask(taskId: string): ManagedTask | undefined;
  getLastCompleted(workspaceIdentity: string): ManagedTask | undefined;
  onEvent(handler: TaskEventHandler): () => void;
  shutdown(): Promise<void>;
}
```

#### WebSocket Route Extensions

```typescript
// Subscribe to TaskManager event bus — single subscription for ALL events
// Workspace-filtered relay to client
const unsubTaskEvent = taskManager.onEvent(async (taskId, status) => {
  const task = taskManager.getTask(taskId);
  if (task && task.config.workspaceIdentity !== currentSocketWorkspace) return;
  // completed events enriched by ResultsIntegrator (Story 4)
  // started/running/failed/cancelled relayed directly
  sendMessage(socket, status);
});

// Handle chat:task-cancel
case 'chat:task-cancel':
  try { taskManager.cancel(msg.taskId); }
  catch (err) { sendMessage(socket, { type: 'chat:error', code: err.code, message: err.message }); }
  break;

// Snapshot on connect (after conversation-load) and workspace switch
sendTaskSnapshot(socket, wsIdentity);
```

#### Client Task State

```typescript
interface ChatState {
  // Existing fields...
  tasks: ClientTaskInfo[];
  autonomousRun: ClientAutonomousRun | null;
}

// Methods:
replaceTaskSnapshot(tasks, autonomousRun): void;  // AC-1.6e replace semantics
updateTask(status): void;                          // upsert by taskId
removeTask(taskId): void;
```

#### Task Display

`mountTaskDisplay()` renders `.chat-task-area` above `.chat-messages`. Each task is a `.chat-task-indicator` with phase, status badge, elapsed time, description. Completed tasks show output link. Active tasks show cancel button.

*See the tech design documents (`tech-design.md`, `tech-design-server.md`, `tech-design-client.md`) for full architecture, implementation targets, and test mapping.*

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] TaskManager class implemented with spawn, heartbeat, cancel, shutdown
- [ ] WebSocket route handles `chat:task-cancel` and relays task events
- [ ] `chat:task-snapshot` sent on connect and workspace switch
- [ ] Feature flag gating — no task infrastructure when disabled
- [ ] Client task state management with snapshot replace semantics
- [ ] Task display renders status indicators with elapsed time, cancel, output link
- [ ] CSS for task indicators added to `chat.css`
- [ ] `npm run verify` passes (format, lint, typecheck, tests)
- [ ] 36 tests pass: 20 task-manager, 8 ws-chat-tasks, 4 chat-state-tasks, 4 task-display
