# Epic 14 Tech Design Review — Round 2

I re-read the updated Epic 14 design set against the epic, Epic 13's upstream contracts, and the Round 1 findings:

- `docs/spec-build/v2/epics/14--pipeline-orchestration/epic.md`
- `docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/tech-design.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/tech-design-server.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/tech-design-client.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/test-plan.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/verification/codex/td-review-r1.md`

Several R1 fixes landed materially: the server doc now has a single TaskManager event bus, `target` exists for duplicate detection, `workspaceIdentity` exists on task state, approval handlers were added, UUID fixtures replaced the old placeholder IDs, and the test-count math now reconciles numerically at 112 tests.

I would still mark this design set as **FAIL / not approved yet**. Some R1 items are only partially corrected, and the structural changes introduced a new blocking regression around staging/output integration.

## R1 Finding Verification

### 1. Cancel/shutdown lifecycle must guarantee termination
**Status: PARTIALLY FIXED**

What is fixed:
- `cancel()` now preserves the child-process reference for SIGKILL fallback instead of nulling it immediately in `tech-design-server.md:488-500`.
- `shutdown()` now waits on per-process exit promises with a hard-kill fallback in `tech-design-server.md:572-599`.

Remaining gap:
- `cancel()` still decrements `activeTaskCount` before the child actually exits in `tech-design-server.md:483-489`, which is the exact race R1 called out.
- The docstring says `cancel()` "waits for the process to exit" in `tech-design-server.md:462-464`, but the signature is still synchronous and returns immediately in `tech-design-server.md:470-515`.
- The index still claims active count decrements only on actual exit in `tech-design.md:84`, so the design set contradicts itself.

### 2. TaskManager must be the single source of truth for all lifecycle events
**Status: FIXED**

- `TaskManager` now emits `completed` on its own event bus in `tech-design-server.md:377-396`.
- `AutonomousSequencer.waitForTaskCompletion()` now subscribes to `taskManager.onEvent(...)` and resolves on `completed`/`failed`/`cancelled` in `tech-design-server.md:1283-1292`.
- The WebSocket route now consumes the TaskManager bus rather than inventing a separate success path in `tech-design-server.md:1460-1489`.

The original sequencer stall from R1 is addressed.

### 3. Epic 13 file-access contract must be honored
**Status: PARTIALLY FIXED**

What is fixed:
- Input artifacts are now read through an injected `FileReader.getFileContent()` interface in `tech-design-server.md:672-727`.
- Workspace writes are now modeled through injected `WorkspaceFileService` methods in `tech-design-server.md:851-855`.

Remaining gap:
- The server design still explicitly instructs the background CLI to use its built-in Write tool in `tech-design-server.md:763-774`.
- The file-access alignment section still argues that Epic 13 A5 does not apply to the background CLI in `tech-design-server.md:831-835`, which contradicts Epic 13's contract that curated methods are the sole file-access mechanism for the Steward in `13--package-and-spec-awareness/epic.md:73`.
- The index doc also still says the CLI uses built-in tools to write output and that inputs may be read "directly via `fs.readFile`" in `tech-design.md:126-130` and `tech-design.md:203`.

So the read side is corrected, but the write-side contract is still internally inconsistent across the docs.

### 4. Output detection must be explicit, not directory scanning
**Status: PARTIALLY FIXED**

What is fixed:
- `ResultsIntegrator` now parses an explicit JSON output manifest instead of scanning directories in `tech-design-server.md:888-965`.
- The index reflects explicit manifest-based reporting in `tech-design.md:169` and `tech-design.md:233-241`.

Remaining gap:
- The test plan still targets the old directory-scan model: it mocks `readdir` in `test-plan.md:16` and `test-plan.md:35-41`, expects result discovery from `mock readdir` in `test-plan.md:419`, and still carries binary-scan/empty-outputDir cases in `test-plan.md:429-430`.
- That means the server design and the test plan no longer agree on the mechanism being verified.

### 5. Task state and approval binding must be workspace-scoped
**Status: PARTIALLY FIXED**

What is fixed:
- `TaskInfo` and `TaskDispatchConfig` now include `workspaceIdentity` in `tech-design-server.md:64-79` and `tech-design-server.md:191-199`.
- `getAllTasks(workspaceIdentity)` filters snapshot/running-task state by workspace in `tech-design-server.md:523-528`.
- `lastCompletedTask` is now keyed by workspace in `tech-design-server.md:1390-1415`.

Remaining gap:
- Duplicate-task detection is still global. The dispatch scan checks only `phase + target`, with no `workspaceIdentity` filter, in `tech-design-server.md:285-293`.
- Autonomous-run snapshot state is still global. `AutonomousSequencer` stores a single `activeRun` and `getActiveRunSnapshot()` takes no workspace argument in `tech-design-server.md:1188-1193` and `tech-design-server.md:1303-1313`.
- The WebSocket snapshot includes that global autonomous run for any workspace in `tech-design-server.md:1533-1541`, which violates AC-1.6c in `epic.md:241-254` and the snapshot contract in `epic.md:783-799`.

### 6. specStatus lifecycle needs server-side approval/reset handlers
**Status: FIXED**

- `ApprovalHandler.approvePhase()` and `resetForRedispatch()` now exist in `tech-design-server.md:1070-1115`.
- They are explicitly exposed through the script context in `tech-design-server.md:1358-1365`.
- The transition table is present and aligned with AC-3.7c/e/f in `tech-design-server.md:1060-1066`.

This R1 gap now has a concrete implementation home.

### 7. Dispatch-time error transport and pre-start ordering
**Status: PARTIALLY FIXED**

What is fixed:
- `ScriptResult.errorCode` propagation is now designed in `tech-design-server.md:1333-1379`, which correctly maps dispatch failures to `chat:error`.

Remaining gap:
- The deferred-start mechanism is incomplete. The route creates `pendingTaskIds` in `tech-design-server.md:1457-1458` and flushes them after `chat:done` in `tech-design-server.md:1504-1513`, but nowhere in the design is a dispatched task ID ever pushed into that array.
- Because the WebSocket subscription explicitly refuses to relay `started` directly in `tech-design-server.md:1483-1485`, the current design never actually delivers `chat:task-status started`.
- That means AC-2.4 in `epic.md:352-365` is still not fully implemented, even though the transport-error half is fixed.

### 8. Duplicate-task identity must be phase + target, not phase + outputDir
**Status: FIXED**

- `TaskDispatchConfig.target` is now part of the server contract in `tech-design-server.md:191-199`.
- Duplicate detection uses `phase + target` in `tech-design-server.md:285-293`.
- The index reflects the same identity rule in `tech-design.md:50`.

The original "phase + outputDir" weakness is corrected.

### 9. Reuse Epic 12 `openFile()` instead of inventing `/api/file/open`
**Status: FIXED**

- The client integration now explicitly reuses `openFile(path)` in `tech-design-client.md:788-800`.
- I do not see the stale `POST /api/file/open` design from R1 anymore.

### 10. Fixtures must satisfy the schemas they claim to validate
**Status: PARTIALLY FIXED**

What is fixed:
- The old non-UUID `task-001` / `run-001` fixtures are gone. UUID-shaped values are now used in `test-plan.md:123-156` and `test-plan.md:197-218`.

Remaining gap:
- `TaskInfoSchema` requires both `target` and `workspaceIdentity` in `tech-design-server.md:66-79`, but `createTaskInfo()` still omits both in `test-plan.md:180-192`.
- The test plan still claims that fixture validates against schema in `test-plan.md:303-304`, which is not true as written.

## New Findings

## Critical

### 1. The staging/output integration model is internally broken, so successful task output cannot be wired the way the design claims.

- `TaskManager` creates the per-task `stagingDir` only inside `dispatch()` after the CLI args are already constructed in `tech-design-server.md:297-347`.
- `PipelineDispatcher.buildCliArgs()` tries to read the task back with `this.taskManager.getTask(config.target)` in `tech-design-server.md:738-744`, but `config.target` is not a task ID and the task does not exist yet anyway.
- The system prompt still tells the CLI to write with its built-in Write tool and report paths relative to its working directory in `tech-design-server.md:763-774`.
- The user message still tells it to write to `outputDir` in `tech-design-server.md:789-803`.
- But `ResultsIntegrator` later assumes the files exist under `task.stagingDir` and reads them from there in `tech-design-server.md:888-938`.

This is not just stale wording. The staging directory is the backbone of the post-R1 output model, and the current design never actually conveys that location to the CLI. As written, AC-3.1/3.2/3.7 and TC-2.4c are blocked.

## Major

### 1. Autonomous-run snapshot state is not workspace-scoped and will leak across workspace switches.

- Only one global `activeRun` exists in `tech-design-server.md:1142-1153`.
- `getActiveRunSnapshot()` has no workspace parameter in `tech-design-server.md:1303-1313`.
- The WebSocket snapshot includes that run for any `wsIdentity` in `tech-design-server.md:1533-1541`.

That conflicts with AC-1.6c in `epic.md:241-254` and the reconnect snapshot contract in `epic.md:783-799`.

### 2. Autonomous task-level `sequenceInfo` is declared everywhere except where events are actually emitted.

- `sequenceInfo` is part of `ChatTaskStatusMessageSchema` in `tech-design-server.md:38-62`.
- The client state and UI rely on it in `tech-design-client.md:16-33`, `tech-design-client.md:319-343`, and `tech-design-client.md:498-500`.
- The epic requires it for TC-4.3a in `epic.md:563-567`.
- But none of the TaskManager event emissions populate `sequenceInfo` in `tech-design-server.md:318-327`, `tech-design-server.md:354-364`, `tech-design-server.md:384-395`, `tech-design-server.md:404-414`, or `tech-design-server.md:505-514`.

So AC-4.3 task-level progress is still unimplemented on the server side.

### 3. The test plan is materially out of sync with the updated server design, so the claimed coverage is no longer trustworthy.

- `task-manager.test.ts` still expects the TaskManager's own completion event to carry `outputPaths` and `primaryOutputPath` in `test-plan.md:317-320`, but the server design says those are only added later by the WebSocket route after results integration in `tech-design-server.md:383-395` and `tech-design-server.md:1462-1481`.
- The plan still carries directory-scan assumptions via `readdir` in `test-plan.md:16`, `test-plan.md:35-41`, `test-plan.md:419`, and `test-plan.md:429-430`, despite the server design having moved to manifest parsing in `tech-design-server.md:888-965`.
- The non-TC "Concurrent cancel does not crash" case still says second cancel is a no-op in `test-plan.md:334`, but the server design now throws `TASK_NOT_FOUND` for terminal tasks in `tech-design-server.md:476-480` and `tech-design-server.md:654`.

The numeric test counts reconcile, but the cross-document test contract does not.

## Minor

### 1. Live task upserts on the client drop the required `target` field.

- `ClientTaskInfo` requires `target` in `tech-design-client.md:16-21`.
- But `updateTask()` does not copy `status.target` when inserting a new live task in `tech-design-client.md:103-121`.

Snapshots would provide `target`, but live `chat:task-status` events would create a weaker client state shape than the schema and client type advertise.

## Cross-Document Consistency Check

### Numeric counts

- The test-plan math now reconciles: per-file total = 112 and per-chunk total = 112 in `test-plan.md:507-546`.
- The epic still totals 87 TCs, and the test plan's flow summary uses that same count in `test-plan.md:555-563`.

### Remaining consistency problems

- The index doc still carries stale pre-fix file-access wording in `tech-design.md:126-130` and `tech-design.md:203`, while the server doc claims the R1 fix landed.
- The server and test plan disagree on output detection, completion-event enrichment, and second-cancel behavior.
- The server and client both declare `sequenceInfo`, but only the client/test plan treat it as real runtime data.
- The task snapshot is workspace-filtered for tasks but not for autonomous-run state.

## Verdict

**FAIL — not approved for story publishing yet.**

The original R1 set is no longer fully blocking in its original form, but the design still has:

- an unresolved cancellation/accounting gap
- an incomplete pre-start ordering design
- a partially corrected file-access/output contract
- workspace-scoping leaks for autonomous runs
- and one new critical staging/output regression

I would re-review after the staging/output handoff, autonomous workspace scoping, `sequenceInfo`, and test-plan drift are reconciled.
