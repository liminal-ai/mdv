# Epic 14 Tech Design Review — Round 3

I re-read the Epic 14 design set against:

- `docs/spec-build/v2/epics/14--pipeline-orchestration/epic.md`
- `docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/tech-design.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/tech-design-server.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/tech-design-client.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/test-plan.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/verification/codex/td-review-r2.md`

## Verdict

**FAIL — not ready for story publishing yet.**

Most of the R2 items are now genuinely fixed, but there is still one blocking integration gap and several new major consistency/flow issues. The biggest blocker is that the server design never captures the CLI's final stdout/result text, yet results integration still depends on parsing that text for the output manifest.

## R2 Finding Verification

### 1. R2 C1 residual: cancel/shutdown lifecycle
**Status: FIXED**

- `cancel()` no longer decrements `activeTaskCount`; the decrement happens only in the exit/error handlers, guarded by `activeCountDecremented` in `tech-design-server.md:368-377`, `tech-design-server.md:421-424`, and `tech-design-server.md:475-478`.
- The process reference is preserved for SIGKILL fallback in `tech-design-server.md:483-492`.
- `shutdown()` still awaits process exit with fallback in `tech-design-server.md:568-599`.

### 2. R2 C3 residual: file-access contract / stale `fs.readFile` refs
**Status: NOT FIXED**

- The index claims "All stale fs.readFile references removed" in `tech-design.md:57`.
- But the server design still imports and uses `readFile` in the ResultsIntegrator at `tech-design-server.md:841` and `tech-design-server.md:893`.
- The test plan still mocks `fs/promises.readFile` for this path at `test-plan.md:16` and `test-plan.md:35-41`.

This is improved relative to R2 because the CLI no longer writes directly to the workspace, but the specific R2 fix claim is not true as written.

### 3. R2 C4 residual: manifest parsing instead of directory scanning
**Status: FIXED**

- The server design uses manifest parsing in `tech-design-server.md:882-956`.
- The test plan now validates manifest parsing, not `readdir`, at `test-plan.md:421-432`.

### 4. R2 M5 residual: workspace-scoped task/run state
**Status: FIXED**

- Duplicate detection is workspace-scoped in `tech-design-server.md:291-303`.
- `AutonomousRun` now carries `workspaceIdentity` in `tech-design-server.md:1136-1139`.
- `getActiveRunSnapshot(workspaceIdentity)` filters correctly in `tech-design-server.md:1303-1313`.
- `lastCompletedTask` is keyed by workspace in `tech-design-server.md:1393-1417`.

### 5. R2 M7 residual: dispatch error transport and deferred start
**Status: FIXED**

- `dispatchTask()` now adds dispatched task IDs to `pendingTaskIds` in `tech-design-server.md:1347-1350`.
- `onDone` flushes deferred starts after foreground `chat:done` in `tech-design-server.md:1508-1517`.
- `ScriptResult.errorCode` propagation is documented in `tech-design-server.md:1335-1382`.

This fixes the original foreground-dispatch gap from R2. A separate autonomous-flow issue remains; see New Findings.

### 6. R2 M10 residual: fixtures satisfy schema
**Status: FIXED**

- `createTaskInfo()` now includes both `target` and `workspaceIdentity` in `test-plan.md:180-194`.

### 7. R2 New Critical: staging/output integration model
**Status: FIXED**

- The staging dir is created before spawn in `tech-design-server.md:307-308`.
- The CLI is spawned with `cwd: stagingDir` in `tech-design-server.md:325-329`.
- The system prompt now tells the CLI to write to its current directory in `tech-design-server.md:754-765`.
- Results integration reads from staging and writes via `addFile`/`editFile` in `tech-design-server.md:887-903`.

### 8. R2 New Major: autonomous snapshot state leaks across workspaces
**Status: FIXED**

- `getActiveRunSnapshot(workspaceIdentity)` now enforces workspace filtering in `tech-design-server.md:1303-1313`.
- The snapshot uses that filtered accessor in `tech-design-server.md:1537-1546`.

### 9. R2 New Major: `sequenceInfo` declared but not emitted
**Status: FIXED**

- Autonomous dispatch now attaches `sequenceInfo` in `tech-design-server.md:1226-1237`.
- Task event emissions use shared `eventFields()` that includes `sequenceInfo` in `tech-design-server.md:313-321` and `tech-design-server.md:339-405`.
- The client stores it in `tech-design-client.md:97-119`.

### 10. R2 New Major: test plan drift
**Status: FIXED**

- Completion enrichment is now described correctly in `test-plan.md:321` and `tech-design-server.md:1479-1485`.
- Manifest parsing coverage is updated in `test-plan.md:421-432`.
- Second-cancel behavior now expects `TASK_NOT_FOUND` in `test-plan.md:336`, aligned with `tech-design-server.md:468-472`.

### 11. R2 New Minor: client task upserts dropped `target`
**Status: FIXED**

- `updateTask()` now copies `status.target` for new tasks in `tech-design-client.md:107-121`.

## New Findings

## Critical

### 1. The design still never captures the CLI result text needed for manifest parsing, so successful task output cannot actually be integrated as designed.

- The CLI is invoked with `--output-format stream-json` and told to emit a final JSON manifest in `tech-design-server.md:737-744` and `tech-design-server.md:754-765`.
- Results integration requires `cliResultText` and parses that manifest in `tech-design-server.md:877-883` and `tech-design-server.md:935-956`.
- But the WebSocket route still calls `resultsIntegrator.integrate(taskId, task, '' /* CLI result text parsed from stdout */)` in `tech-design-server.md:1466-1472`.
- I do not see any TaskManager design for reading, buffering, or storing the background CLI's stdout/stderr payload before the completion event.

As written, `parseOutputManifest()` will always receive `''`, return no output files, and fail AC-3.1/AC-3.2/AC-3.7 despite the staging changes.

## Major

### 1. Autonomous task `started` events are still not delivered, because deferred-start flushing only covers script-dispatched tasks.

- TaskManager defers every `started` event in `tech-design-server.md:339-447`.
- The only path that populates `pendingTaskIds` is script-context `dispatchTask()` in `tech-design-server.md:1347-1350`.
- AutonomousSequencer dispatches directly through `dispatcher.dispatch(...)` in `tech-design-server.md:1226-1237`, bypassing `pendingTaskIds`.
- The only documented flush happens in `providerManager.onDone(...)` for `pendingTaskIds` in `tech-design-server.md:1508-1517`.

That means autonomous phase tasks have no documented path to emit `chat:task-status started`, which blocks TC-4.3a in `epic.md:563-566` and conflicts with the test plan at `test-plan.md:477`.

### 2. Folder-mode output integration is internally inconsistent and can skip the required write-to-workspace path.

- Epic 14 requires that in folder mode the output file is still written to disk, only without a manifest update in `epic.md:413-416`.
- But ResultsIntegrator is constructed with `fileService: WorkspaceFileService | null` and comments that it is "null in folder mode without package" in `tech-design-server.md:858-862`.
- The actual write path is guarded by `if (this.fileService)` in `tech-design-server.md:895-903`.

If `fileService` is truly `null` in folder mode as the server doc says, AC-3.1 and TC-3.2c are not met for regular folders.

### 3. The staging-relative output contract is still ambiguous and can double-prefix paths.

- The system prompt says output files and manifest paths are relative to the CLI working directory in `tech-design-server.md:758-765`.
- But the user message still says "Write output files to the output directory" in `tech-design-server.md:793`.
- The explicit manifest example still shows `{"outputFiles": ["epics/feature-2/epic.md"], ...}` in `tech-design-server.md:811-813`.
- ResultsIntegrator then prefixes `task.config.outputDir` again when computing workspace paths in `tech-design-server.md:888-920`.

Those statements describe two different contracts: "paths relative to staging cwd" vs "paths already rooted under outputDir". Story authors could implement either one, and only one matches the integrator logic.

### 4. AC-1.6c's workspace-switch snapshot behavior is not actually designed on the server side.

- The epic requires `chat:task-snapshot` on both connect and workspace switch in `epic.md:241-254`.
- The client doc also says snapshot replacement is called on WebSocket connect and workspace switch in `tech-design-client.md:67-76`.
- But the server route only documents snapshot emission on connect in `tech-design-server.md:1537-1546`.
- The index also summarizes this as "send task-snapshot on connect" in `tech-design.md:415` and `tech-design.md:613`.

The workspace-filtering mechanics are fixed, but the trigger required for TC-1.6c is still missing from the server design.

## Minor

### 1. The index/test-summary section is still internally inconsistent with the server doc and test plan.

- `tech-design.md:52` says "No blocking issues" even though the design still contains the blocking manifest-capture gap above.
- `tech-design.md:637` lists a non-TC test "lastCompletedTask clears on conversation clear", but the server doc explicitly says the opposite in `tech-design-server.md:1420-1424`.
- I do not see that test represented in `test-plan.md`.

This is documentation drift rather than a core architecture problem, but it makes the design set harder to trust.

## Cross-Document Consistency

What is consistent now:

- Cancellation/accounting is aligned across index, server, and test plan.
- Workspace scoping for task snapshots and `lastCompletedTask` is materially improved.
- Manifest parsing replaced directory scanning in both server design and test plan.
- Client task upserts now align with the `target`-required shape.

What is still inconsistent:

- The index says all stale `fs.readFile` refs are gone, but the server/test plan still rely on `readFile`.
- The server and client both speak about workspace-switch snapshots, but only the client/epic actually describe that trigger.
- The staging-relative output contract conflicts with the outputDir-rooted manifest example.
- The index's non-TC test summary contradicts the provider-manager behavior for `chat:clear`.

## Publish Recommendation

**Do not publish stories from this design yet.**

I would re-review after:

1. The TaskManager/route design explicitly captures and passes the CLI's final result text to ResultsIntegrator.
2. Deferred `started` events are wired for autonomous dispatches, not just script-dispatched tasks.
3. Folder-mode output integration is clarified so files are always written to the workspace even when no package manifest exists.
4. The output-manifest path contract is normalized across system prompt, user message, example manifest, and integrator path-join logic.
5. The workspace-switch snapshot trigger and the remaining summary/test-plan drift are reconciled.
