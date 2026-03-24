# Epic 14 Tech Design Review — Round 1

This review focuses on epic alignment, contract fidelity, lifecycle completeness, and TC-to-test traceability across:

- `docs/spec-build/v2/epics/14--pipeline-orchestration/tech-design.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/tech-design-server.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/tech-design-client.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/test-plan.md`

I also cross-checked against the upstream contracts in:

- `docs/spec-build/v2/technical-architecture.md`
- `docs/spec-build/v2/epics/10--chat-plumbing/tech-design.md`
- `docs/spec-build/v2/epics/10--chat-plumbing/tech-design-server.md`
- `docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design.md`
- `docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/epic.md`

## Critical

### 1. Background worker cancellation and shutdown do not actually guarantee process termination, so the design does not cover the required worker lifecycle.

The cancellation path clears `task.process` immediately after `abortController.abort()`, but the SIGKILL fallback closes over `task.process`, so it will never fire once the reference is nulled. The task is also removed from the active count before the child has actually exited. On shutdown, the design only calls `abort()` and sleeps for 5 seconds; it never waits on individual exits or force-kills stubborn children. That directly contradicts the epic’s termination guarantees.

Locations:
- `tech-design-server.md:457-486`
- `tech-design-server.md:559-569`
- `tech-design.md:72-77`
- `epic.md:193-197`
- `epic.md:955-965`

Why this matters:
- AC-1.3 requires cancellation to terminate the task.
- NFRs require cancellation within 10 seconds and no orphaned processes on shutdown.
- As written, a cancelled or shutting-down task can keep running while the manager has already freed its slot.

### 2. Autonomous sequencing cannot progress past a successful phase because the sequencer waits for a `completed` event that the TaskManager never emits.

`TaskManager` emits `started`, `running`, `failed`, and `cancelled` on its event bus, but on success it only invokes `completionHandlers`; it does not emit a `chat:task-status`/`completed` event through `onEvent`. `AutonomousSequencer.waitForTaskCompletion()` listens only to `taskManager.onEvent(...)`, so it can resolve for failure/cancel, but not for success. Meanwhile the completed status is sent ad hoc from the WebSocket route instead of the manager itself.

Locations:
- `tech-design-server.md:393-400`
- `tech-design-server.md:957-970`
- `tech-design-server.md:1392-1419`
- `epic.md:548-574`

Why this matters:
- AC-4.2a, AC-4.2c, and AC-4.3c all depend on the sequencer observing successful completion.
- In the current design, a successful autonomous phase stalls the run instead of advancing.
- The event model is split between `TaskManager` and `ws-chat.ts`, which also makes multi-client delivery inconsistent.

### 3. The worker invocation model breaks the Epic 13 file-access contract that Epic 14 explicitly says it consumes.

Epic 13 makes the script context the sole file-access surface and says the CLI’s built-in Read/Write tools are not configured for workspace access. Epic 14’s consumed-contract table says it uses `getFileContent`, `addFile`, `editFile`, `updateManifest`, and `getPackageManifest`. But the server design has `PipelineDispatcher` read artifacts directly via `fs.readFile`, then instructs the background CLI to write output using its built-in tools. That is a direct cross-document deviation, not an extension.

Locations:
- `13--package-and-spec-awareness/epic.md:73`
- `13--package-and-spec-awareness/epic.md:803-839`
- `14--pipeline-orchestration/epic.md:80-105`
- `tech-design-server.md:649-673`
- `tech-design-server.md:705-711`
- `tech-design-server.md:754`

Why this matters:
- This design no longer “consumes” Epic 13’s APIs; it bypasses them.
- If Epic 13’s A5 holds, the background worker cannot write output at all using the proposed built-in-tool path.
- Even if it did work, observability and path-safety move out of the server-owned contract surface.

### 4. Output integration is based on “scan the whole outputDir”, which is not a valid contract for reruns and becomes catastrophic for `implementation`, where the design sets `outputDir` to project root.

The design answers Q5 by making `implementation` write to project root. `ResultsIntegrator` then treats every file found under `outputDir` as task output. That means an implementation task would report the entire workspace as task output. Even for non-root phases, the integrator cannot distinguish files created by this run from pre-existing files in the same directory, so reruns and mixed directories are inherently ambiguous.

Locations:
- `tech-design.md:148-159`
- `tech-design-server.md:1070-1087`
- `tech-design-server.md:1111-1123`
- `epic.md:220`
- `epic.md:420-427`

Why this matters:
- AC-1.4c and AC-3.1a require `outputPaths` to describe the task’s outputs, not every file already present.
- AC-3.7b requires sane rerun behavior without duplicating or misreporting outputs.
- For `implementation`, the current model is unworkable.

## Major

### 5. Task state and approval binding are global, not workspace-scoped, so the design cannot satisfy snapshot-on-workspace-switch or safe approval binding.

The epic requires `chat:task-snapshot` on workspace switch and explicitly says workspace B may have no tasks even if A does. But `TaskManager` stores one global `Map`, `getAllTasks()` returns everything, and the WebSocket route snapshot just sends that whole set. `lastCompletedTask` is also a single global field on `ProviderManager`, with no workspace identity attached.

Locations:
- `epic.md:241-254`
- `tech-design-server.md:254-259`
- `tech-design-server.md:508-524`
- `tech-design-server.md:1347-1356`
- `tech-design-server.md:1462-1471`

Why this matters:
- TC-1.6c is not implementable with the current data model.
- Approval feedback in workspace B can bind to a task completed in workspace A.
- Duplicate detection and `getRunningTasks()` are likewise global, not workspace-aware.

### 6. The approval/specStatus lifecycle is only partially designed: completion sets `draft`, but there is no server mechanism for “approved before next phase” or “reset to draft on re-dispatch”.

The epic requires three separate status transitions: set `draft` on successful completion, set `approved` on explicit approval before follow-on dispatch, and reset back to `draft` on re-dispatch. The server design only implements the first one in `advancePhaseMetadata()`. The latter two appear only in the chunk summary and test plan, not in any server API or flow.

Locations:
- `epic.md:428-443`
- `tech-design.md:613-618`
- `tech-design-server.md:1180-1227`
- `test-plan.md:430-434`

Why this matters:
- AC-3.7e and AC-3.7f do not currently have an implementation home.
- The review/approval flow is underspecified at the exact point where Epic 14 adds new product behavior.

### 7. Dispatch-time error transport and pre-start ordering are not actually designed, and the test plan weakens both contracts.

The epic requires prerequisite failures and duplicate dispatches to surface as `chat:error` messages, and it requires the `chat:task-status started` event to come only after a completed foreground agent response that reports the inputs/output location. The design instead routes dispatch through `dispatchTask()` in the script lane, where the method simply throws. The test plan then maps the prerequisite TCs to dispatcher throws, not to WebSocket `chat:error` behavior, and maps the “preceding agent response” TCs to loose client assertions instead of transport ordering.

Locations:
- `epic.md:338-350`
- `epic.md:352-361`
- `epic.md:661-664`
- `tech-design-server.md:1280-1284`
- `tech-design-server.md:1498-1513`
- `test-plan.md:380-383`
- `test-plan.md:399-400`

Why this matters:
- AC-2.3 and AC-5.4 are transport contracts, not just thrown exceptions inside a helper.
- AC-2.4 is explicitly about ordering between the foreground chat response and task lifecycle messages.
- The current tests would pass even if the wrong message type/order were emitted.

### 8. The duplicate-task contract is reduced from “same phase and feature” to “same phase and outputDir”, because the design never introduces a feature identity.

The epic’s duplicate rule is phase + feature. `TaskDispatchConfig` contains no feature identifier, target artifact identity, or task scope beyond `outputDir`. `TaskManager` therefore implements duplicate detection as phase + outputDir. That is not equivalent: same feature with a different outputDir can slip through, and different features that map to the same directory can false-positive.

Locations:
- `epic.md:659-672`
- `tech-design-server.md:206-213`
- `tech-design-server.md:302-314`
- `tech-design-server.md:599`

Why this matters:
- AC-5.4 becomes heuristic instead of deterministic.
- The public interface is too weak for the requirement it claims to enforce.

## Minor

### 9. The client design invents `POST /api/file/open` instead of reusing the Epic 12 `openFile(...)` integration it cites.

Epic 12’s client design wires local-file navigation through the existing `openFile(resolved)` client API. Epic 14’s client doc says it is using that same API, then immediately replaces it with a fetch to `/api/file/open`, which is not the established interface.

Locations:
- `12--document-awareness-and-editing/tech-design-client.md:335-340`
- `12--document-awareness-and-editing/tech-design-client.md:403-406`
- `tech-design-client.md:809-815`

Why this matters:
- It is a stale/inconsistent interface reference.
- It weakens confidence that the client extension was cross-checked against the existing navigation flow.

### 10. The test fixtures do not satisfy the schemas they claim to validate.

The server schemas require UUIDs for `taskId` and `runId`, but the fixture factory uses `task-001` and `run-001`. The chunk-0 plan then says those fixtures validate against schema.

Locations:
- `tech-design-server.md:18-25`
- `tech-design-server.md:49-52`
- `tech-design-server.md:66-67`
- `tech-design-server.md:95-97`
- `test-plan.md:114-120`
- `test-plan.md:173-177`
- `test-plan.md:190-196`
- `test-plan.md:296-297`

Why this matters:
- It is a direct cross-document inconsistency.
- It also makes the chunk-0 confidence signal unreliable.

## What Else I Noticed But Chose Not To Report

- The requested skill path `/Users/leemoore/.claude/skills/liminal-spec/skills/ls-tech-design.md` does not exist in this workspace; I used `/Users/leemoore/.codex/skills/ls-tech-design/SKILL.md` as the closest available reference instead.
- `TaskManager.cancel()` returns a no-op for already-terminal tasks, but the Epic 14 data contract says `cancelTask(taskId)` should throw if the task is already completed (`epic.md:916-917`, `tech-design-server.md:466-468`).
- `getActiveRunSnapshot(): AutonomousRunSnapshotSchema | null` uses the schema value as a TypeScript return type rather than an inferred type (`tech-design-server.md:996`).
- The client hides cancelled tasks from the visible task list even though cancelled is a terminal task state carried by the protocol (`tech-design-client.md:245-250`).
- `elapsedMs` in `getAllTasks()` is recomputed from `Date.now()` even for completed/failed/cancelled tasks, so snapshots would show terminal task durations continuing to grow (`tech-design-server.md:508-524`).
