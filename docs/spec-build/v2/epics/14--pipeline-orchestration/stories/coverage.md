# Coverage Artifact: Epic 14 — Pipeline Orchestration

This document proves every AC and TC from the epic is assigned to exactly one story, with no gaps.

---

## Coverage Gate

| AC | TC | Story | Notes |
|----|-----|-------|-------|
| AC-1.1 | TC-1.1a | Story 2 | Chat exchange during running task |
| AC-1.1 | TC-1.1b | Story 2 | Task status does not interrupt streaming |
| AC-1.1 | TC-1.1c | Story 2 | Multiple chat exchanges during long task |
| AC-1.2 | TC-1.2a | Story 2 | Running task shows status |
| AC-1.2 | TC-1.2b | Story 2 | Elapsed time updates |
| AC-1.2 | TC-1.2c | Story 2 | Completed task shows final status |
| AC-1.2 | TC-1.2d | Story 2 | No indicators when no tasks |
| AC-1.3 | TC-1.3a | Story 2 | Cancel via WebSocket message |
| AC-1.3 | TC-1.3b | Story 2 | Cancel via script execution lane |
| AC-1.3 | TC-1.3c | Story 2 | Partial output preserved on cancel |
| AC-1.3 | TC-1.3d | Story 2 | Cancel non-existent task |
| AC-1.4 | TC-1.4a | Story 2 | Started event |
| AC-1.4 | TC-1.4b | Story 2 | Progress events |
| AC-1.4 | TC-1.4c | Story 2 | Completed event |
| AC-1.4 | TC-1.4d | Story 2 | Failed event |
| AC-1.5 | TC-1.5a | Story 2 | Two tasks run simultaneously |
| AC-1.5 | TC-1.5b | Story 2 | Concurrency limit enforced |
| AC-1.5 | TC-1.5c | Story 2 | Independent lifecycle |
| AC-1.6 | TC-1.6a | Story 2 | Snapshot on initial connect |
| AC-1.6 | TC-1.6b | Story 2 | Snapshot on reconnect |
| AC-1.6 | TC-1.6c | Story 2 | Snapshot on workspace switch |
| AC-1.6 | TC-1.6d | Story 2 | Snapshot after server restart |
| AC-1.6 | TC-1.6e | Story 2 | Snapshot semantics are replace |
| AC-2.1 | TC-2.1a | Story 3 | Epic drafting dispatch |
| AC-2.1 | TC-2.1b | Story 3 | Tech design dispatch |
| AC-2.1 | TC-2.1c | Story 3 | Stories phase dispatch |
| AC-2.1 | TC-2.1d | Story 3 | Implementation dispatch |
| AC-2.1 | TC-2.1e | Story 3 | Foreground remains available after dispatch |
| AC-2.2 | TC-2.2a | Story 3 | Epic drafting receives PRD content |
| AC-2.2 | TC-2.2b | Story 3 | Tech design receives epic content |
| AC-2.2 | TC-2.2c | Story 3 | Stories receives epic and tech design |
| AC-2.2 | TC-2.2d | Story 3 | Implementation receives stories and tech design |
| AC-2.3 | TC-2.3a | Story 3 | Tech design without epic |
| AC-2.3 | TC-2.3b | Story 3 | Stories without tech design |
| AC-2.3 | TC-2.3c | Story 3 | All prerequisites met |
| AC-2.3 | TC-2.3d | Story 3 | Implementation without stories |
| AC-2.4 | TC-2.4a | Story 3 | Input artifacts reported |
| AC-2.4 | TC-2.4b | Story 3 | Output location reported |
| AC-2.4 | TC-2.4c | Story 3 | Reported output directory matches actual output |
| AC-3.1 | TC-3.1a | Story 4 | Output files exist after task completion |
| AC-3.1 | TC-3.1b | Story 4 | File-created notification sent per output file |
| AC-3.1 | TC-3.1c | Story 4 | Single-file phase output |
| AC-3.2 | TC-3.2a | Story 4 | Manifest updated in package mode |
| AC-3.2 | TC-3.2b | Story 4 | Sidebar reflects manifest update |
| AC-3.2 | TC-3.2c | Story 4 | No manifest update in folder mode |
| AC-3.7 | TC-3.7a | Story 4 | Multi-file output grouped in manifest |
| AC-3.7 | TC-3.7b | Story 4 | Rerun overwrites without duplicating entries |
| AC-3.7 | TC-3.7c | Story 4 | Phase metadata advances on success |
| AC-3.7 | TC-3.7d | Story 4 | Phase metadata not advanced on failure |
| AC-3.7 | TC-3.7e | Story 4 | specStatus advances to approved |
| AC-3.7 | TC-3.7f | Story 4 | Re-dispatch resets specStatus to draft |
| AC-3.3 | TC-3.3a | Story 4 | Completion notification in chat |
| AC-3.3 | TC-3.3b | Story 4 | Output path is navigable |
| AC-3.4 | TC-3.4a | Story 4 | Follow-up with output as context |
| AC-3.4 | TC-3.4b | Story 4 | Feedback does not interfere with running tasks |
| AC-3.4 | TC-3.4c | Story 4 | Ambiguous feedback with multiple completed tasks |
| AC-3.5 | TC-3.5a | Story 4 | Follow-on phase uses preceding output |
| AC-3.5 | TC-3.5b | Story 4 | Follow-on dispatch produces new task |
| AC-3.6 | TC-3.6a | Story 4 | Re-dispatch includes feedback context |
| AC-3.6 | TC-3.6b | Story 4 | Re-dispatch produces new task |
| AC-3.6 | TC-3.6c | Story 4 | Re-dispatch output replaces previous output |
| AC-4.1 | TC-4.1a | Story 5 | Autonomous request sends run-started event |
| AC-4.1 | TC-4.1b | Story 5 | Skipped phases reported |
| AC-4.2 | TC-4.2a | Story 5 | Automatic phase progression |
| AC-4.2 | TC-4.2b | Story 5 | Output of each phase feeds the next |
| AC-4.2 | TC-4.2c | Story 5 | Correct phase ordering |
| AC-4.3 | TC-4.3a | Story 5 | Per-task events carry sequence info |
| AC-4.3 | TC-4.3b | Story 5 | Per-task completion reported |
| AC-4.3 | TC-4.3c | Story 5 | Run completion event sent |
| AC-4.4 | TC-4.4a | Story 5 | Run cancel stops current task |
| AC-4.4 | TC-4.4b | Story 5 | Run cancel prevents subsequent phases |
| AC-4.4 | TC-4.4c | Story 5 | Completed phases preserved |
| AC-4.4 | TC-4.4d | Story 5 | Run cancellation event sent |
| AC-4.4 | TC-4.4e | Story 5 | Single-task cancel within run stops the run |
| AC-4.5 | TC-4.5a | Story 5 | Failure halts sequence |
| AC-4.5 | TC-4.5b | Story 5 | Failure reported with run-level event |
| AC-4.5 | TC-4.5c | Story 5 | Prior output preserved |
| AC-5.1 | TC-5.1a | Story 2 | Failed task sends error notification |
| AC-5.1 | TC-5.1b | Story 2 | Failure does not crash server |
| AC-5.1 | TC-5.1c | Story 2 | Failure does not affect other tasks |
| AC-5.2 | TC-5.2a | Story 2 | Partial files remain |
| AC-5.2 | TC-5.2b | Story 2 | Partial output not added to manifest |
| AC-5.3 | TC-5.3a | Story 2 | No task infrastructure initialized |
| AC-5.3 | TC-5.3b | Story 2 | Task messages not processed |
| AC-5.4 | TC-5.4a | Story 3 | Duplicate rejected |
| AC-5.4 | TC-5.4b | Story 3 | Different phase allowed |
| AC-5.4 | TC-5.4c | Story 3 | Same phase different feature |

---

## Coverage Summary

| Flow | ACs | TCs | Owning Story |
|------|-----|-----|-------------|
| 1. Background Task Management | AC-1.1, AC-1.2, AC-1.3, AC-1.4, AC-1.5, AC-1.6 | 23 TCs | Story 2 |
| 2. Pipeline Phase Dispatch | AC-2.1, AC-2.2, AC-2.3, AC-2.4 | 16 TCs | Story 3 |
| 3. Results Integration and Approval | AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5, AC-3.6, AC-3.7 | 22 TCs | Story 4 |
| 4. Autonomous Pipeline Execution | AC-4.1, AC-4.2, AC-4.3, AC-4.4, AC-4.5 | 16 TCs | Story 5 |
| 5. Error Handling | AC-5.1, AC-5.2, AC-5.3, AC-5.4 | 10 TCs | Story 2 (7 TCs) + Story 3 (3 TCs) |
| **Total** | **26 ACs** | **87 TCs** | |

---

## Integration Path Trace

### Path 1: Single Pipeline Phase (Happy Path)

Developer requests a pipeline phase → Steward dispatches → task runs in background → output integrates → developer reviews.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Developer sends request | Chat message processed by foreground provider | Story 2 | TC-1.1a |
| Steward resolves inputs | Input artifacts read via `getFileContent()` | Story 3 | TC-2.2a |
| Prerequisite validation | Missing inputs produce error | Story 3 | TC-2.3a, TC-2.3b, TC-2.3d |
| Dispatch reporting | Agent response with input/output details | Story 3 | TC-2.4a, TC-2.4b |
| Background task starts | CLI spawned, `started` event sent | Story 2 | TC-1.4a |
| Developer continues chatting | Foreground independent of background | Story 2 | TC-1.1a |
| Progress updates | Periodic `running` events with elapsed time | Story 2 | TC-1.4b |
| Task status visible | Task indicator in chat panel | Story 2 | TC-1.2a, TC-1.2b |
| Task completes | CLI exits, `completed` event | Story 2 | TC-1.4c |
| Output files integrated | Files from staging to workspace | Story 4 | TC-3.1a |
| File notifications | `chat:file-created` per file | Story 4 | TC-3.1b |
| Manifest updated | Navigation entries, phase metadata | Story 4 | TC-3.2a, TC-3.7c |
| Completion notification | Output link in task display | Story 4 | TC-3.3a |
| Developer opens output | Clickable link opens file | Story 4 | TC-3.3b |
| Developer approves | Feedback bound to task, next phase dispatched | Story 4 | TC-3.4a, TC-3.5a |

### Path 2: Autonomous Pipeline Run

Developer requests full pipeline → Steward sequences through phases automatically → developer reviews final output.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Developer requests autonomous | Run started with phase list | Story 5 | TC-4.1a |
| Skip existing artifacts | Skipped phases reported | Story 5 | TC-4.1b |
| Phase 1 dispatches | Task with `autonomousRunId` and `sequenceInfo` | Story 5 | TC-4.3a |
| Phase 1 runs in background | Progress via task-level events | Story 2 | TC-1.4b |
| Phase 1 completes | Output integrated | Story 4 | TC-3.1a |
| Auto-progression | Phase 2 dispatches without user input | Story 5 | TC-4.2a |
| Phase 2 receives prior output | Input includes phase 1 output | Story 5 | TC-4.2b |
| All phases complete | Run completion event sent | Story 5 | TC-4.3c |
| Developer reviews final output | Output files in workspace | Story 4 | TC-3.3a |

### Path 3: Task Cancellation and Failure

Developer cancels a task or task fails → partial output preserved → developer informed.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Developer cancels task | `chat:task-cancel` sent | Story 2 | TC-1.3a |
| Task terminated | CLI process aborted | Story 2 | TC-1.3a |
| Partial output preserved | Files on disk not deleted | Story 2 | TC-1.3c |
| Task fails | CLI exits with error | Story 2 | TC-1.4d, TC-5.1a |
| Other tasks unaffected | Independent lifecycles | Story 2 | TC-5.1c |
| No manifest update on failure | Partial output not added to manifest | Story 2 | TC-5.2b |
| Autonomous run cancel | Run stopped, completed phases preserved | Story 5 | TC-4.4a, TC-4.4c |
| Autonomous run failure | Sequence halted, failure reported | Story 5 | TC-4.5a, TC-4.5b |

---

## Validation

- [x] Every AC from the epic (26) appears in the coverage gate table
- [x] Every TC from the epic (87) appears exactly once in the coverage gate table
- [x] Integration path traces complete with no gaps (3 paths, all segments covered)
- [x] Coverage gate table complete with no orphans
- [x] Each story has Jira section markers
- [x] TC wording matches epic exactly (Given/When/Then preserved)
- [x] Each story is self-contained with clear scope, dependencies, and DoD
- [x] Story sequence is logical: Foundation → Task Management → Dispatch → Integration → Autonomous
