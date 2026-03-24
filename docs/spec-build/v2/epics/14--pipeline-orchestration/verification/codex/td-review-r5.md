# Epic 14 Tech Design Review — Round 5

## Verdict

**FAIL — not ready for story publishing yet.**

Most Round 4 issues are now resolved, but one genuine blocker remains in the autonomous run WebSocket relay path.

## R4 Finding Verification

### 1. CLI stdout captured and passed to results integration
**Status: FIXED**

- `TaskManager` still accumulates `resultText` from `stream-json` output in `tech-design-server.md:369-398`.
- The WebSocket completion path still passes `task.resultText` into `resultsIntegrator.integrate()` in `tech-design-server.md:1530-1536`.

### 2. `readFile` in staging is valid
**Status: FIXED**

- The server doc keeps workspace reads on the file-service side and uses direct `readFile()` only for staged temp-dir output in `tech-design-server.md:884-886` and `tech-design-server.md:945-952`.
- The mock strategy matches that contract in `test-plan.md:9-13` and `test-plan.md:31-39`.

### 3. Autonomous started events use `immediate: true`
**Status: FIXED**

- `TaskDispatchConfig` and `ManagedTask` still model `immediate` in `tech-design-server.md:191-205`.
- Autonomous dispatch sets `immediate: true` in `tech-design-server.md:1280-1286`.
- `TaskManager` emits started immediately for `immediate` tasks in `tech-design-server.md:363-367`.

### 4. `WorkspaceFileService` always provided; manifest ops guarded by `isPackageMode()`
**Status: FIXED**

- `ResultsIntegrator` requires `WorkspaceFileService` and documents folder-mode writes plus package-mode manifest gating in `tech-design-server.md:916-920` and `tech-design-server.md:982-1011`.

### 5. Staging path contract normalized
**Status: FIXED**

- The index doc now uses “current directory” wording in the canonical examples in `tech-design.md:136-145` and `tech-design.md:200-207`.
- The server prompt/user-message builders match that same contract in `tech-design-server.md:812-823` and `tech-design-server.md:838-852`.
- Results integration still joins `outputDir` with manifest-relative file paths in `tech-design-server.md:945-976`.

### 6. `workspace:change` sends a fresh task snapshot
**Status: FIXED**

- The WebSocket route updates `currentSocketWorkspace` and sends a new snapshot on `workspace:change` in `tech-design-server.md:1622-1629`.

### 7. Index drift fixed; test count 113
**Status: FIXED**

- The document index now references the actual module set, not `BackgroundWorker`, in `tech-design.md:15-20`.
- Chunk 1 now says snapshot is sent on connect and workspace switch in `tech-design.md:623-629`.
- Flow 3 / Chunk 3 totals reconcile at 26 tests, and the suite total is now 114 throughout `tech-design.md:586-593` and `test-plan.md:545-561`.

### 8. Live task/run/file events are workspace-filtered
**Status: NOT FIXED**

- Task events and file/package events are now filtered by `currentSocketWorkspace` in `tech-design-server.md:1521-1573`.
- But autonomous run events still leak across workspaces. The route does:
  - `const run = autonomousSequencer.getActiveRunSnapshot(currentSocketWorkspace)` in `tech-design-server.md:1577-1579`
  - then relays the event whenever `!run` in `tech-design-server.md:1580-1585`
- `getActiveRunSnapshot()` returns `null` whenever the active run belongs to another workspace in `tech-design-server.md:1360-1368`.
- `ChatAutonomousRunMessage` itself carries no `workspaceIdentity` to recover that association in `tech-design-server.md:100-109`.

This means a socket connected to workspace B will still receive `chat:autonomous-run` events for a run in workspace A, because `getActiveRunSnapshot(currentSocketWorkspace)` is `null` and the `else if (!run)` branch sends the event anyway. The problem is not limited to terminal events; it affects any autonomous event emitted while the socket is focused on a different workspace.

### 9. `target` / `workspaceIdentity` contract mismatch reconciled
**Status: FIXED**

- The epic snippet still shows the narrower base contract in `epic.md:886-904`.
- The design now explicitly documents `target` and `workspaceIdentity` as design-level additions, not epic deviations, in the spec validation table at `tech-design.md:47-51`.

That resolves the prior ambiguity called out in Round 4.

### 10. Stdout parser flushes trailing buffer on process exit/end
**Status: FIXED**

- The trailing-buffer flush is now documented on `stdout` end in `tech-design-server.md:410-423`.
- The fixture and test plan now cover the no-trailing-newline case in `test-plan.md:250-257` and `test-plan.md:347-349`.

## Genuine Blocker

### Major 1. Autonomous run WebSocket events are still not safely workspace-scoped

- `ChatAutonomousRunMessage` has no workspace key to filter on after emission in `tech-design-server.md:100-109`.
- `getActiveRunSnapshot(workspaceIdentity)` intentionally returns `null` for runs from other workspaces in `tech-design-server.md:1360-1368`.
- The WebSocket relay treats `!run` as a reason to send the event in `tech-design-server.md:1577-1585`, which is exactly the cross-workspace case.
- The test plan covers snapshot replacement on workspace switch, but it does not add a WebSocket test for suppressing live autonomous events from another workspace in `test-plan.md:351-362` and `test-plan.md:481-507`.

Until the relay can prove the event belongs to `currentSocketWorkspace` before sending it, the workspace-scoping contract remains broken for `chat:autonomous-run`.

## Quick Regression Scan

No additional blockers found beyond the autonomous run relay issue. The staging-path wording, index drift cleanup, design-addition reconciliation, trailing stdout flush, and 114-test reconciliation all look consistent across the reviewed docs.

## Publish Recommendation

**Do not publish stories from this design yet.**

Re-review after the autonomous run relay is made genuinely workspace-scoped, for example by carrying `workspaceIdentity` through run events or by otherwise preserving workspace ownership through relay time.
