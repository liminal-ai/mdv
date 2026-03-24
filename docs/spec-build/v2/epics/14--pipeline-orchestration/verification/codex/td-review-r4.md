# Epic 14 Tech Design Review — Round 4

## Verdict

**FAIL — not ready for story publishing yet.**

Most R3 fixes landed, but the full document set still has a couple of unresolved contract/drift issues, and I found two additional design blockers in the live event/completion path.

## R3 Finding Verification

### 1. CLI stdout captured and passed to results integration
**Status: FIXED**

- `ManagedTask` now carries `resultText`, stdout is parsed from `stream-json`, and accumulated text is passed into `ResultsIntegrator.integrate()` in `tech-design-server.md:208-225`, `tech-design-server.md:369-398`, and `tech-design-server.md:1511-1513`.

### 2. `readFile` in staging is valid
**Status: FIXED**

- The only direct `readFile` is for staged temp-dir output, not workspace reads, in `tech-design-server.md:883-945`.
- The mock strategy now states the same in `test-plan.md:15-17` and `test-plan.md:35-41`.

### 3. Autonomous started events use `immediate: true`
**Status: FIXED**

- `TaskDispatchConfig` and `ManagedTask` now model `immediate`, and autonomous dispatch sets `immediate: true`, so started events emit immediately instead of waiting for foreground `chat:done`, in `tech-design-server.md:191-225`, `tech-design-server.md:342-367`, and `tech-design-server.md:1266-1278`.

### 4. `WorkspaceFileService` always provided; manifest ops guarded by `isPackageMode()`
**Status: FIXED**

- `ResultsIntegrator` now requires `WorkspaceFileService`, always writes files through it, and gates manifest updates with `isPackageMode()` in `tech-design-server.md:886-903` and `tech-design-server.md:937-969`.

### 5. Staging path contract normalized
**Status: NOT FIXED**

- The server design is correct: the prompt says “current directory” and the integrator joins `outputDir + manifest-relative path` in `tech-design-server.md:796-807`, `tech-design-server.md:835`, and `tech-design-server.md:930-960`.
- But `tech-design.md` still shows stale `outputDir`-rooted `<pipeline-task ... outputDir="...">` examples and “Write the output to the specified output directory” wording in `tech-design.md:133-145` and `tech-design.md:198-206`.

### 6. `workspace:change` sends a fresh task snapshot
**Status: FIXED**

- The WebSocket route now documents a `workspace:change` handler that sends `chat:task-snapshot` for the new workspace in `tech-design-server.md:1585-1603`.

### 7. Index drift fixed; test count 113
**Status: NOT FIXED**

- The headline totals do reconcile to 113 in `tech-design.md:585-592` and `test-plan.md:514-549`.
- But drift remains:
  - `tech-design.md` still references `BackgroundWorker` in the document index at `tech-design.md:18`.
  - Chunk 1 still says snapshot is sent “on connect” only at `tech-design.md:622`.
  - `test-plan.md` still says Flow 3 has “25 in Chunk 3” with “+ 3 non-TC” at `test-plan.md:561`, while Chunk 3’s actual total is 26 with 4 non-TC at `test-plan.md:463`.

## New Findings

## Major

### 1. Live task/run/file events are still not workspace-scoped, so switching workspaces can leak updates from the old workspace.

- Snapshot generation is workspace-filtered in `tech-design-server.md:1594-1600`.
- But live task events are relayed to the socket with no workspace check in `tech-design-server.md:1505-1537`.
- `chat:file-created`, `chat:package-changed`, and autonomous run events are also relayed with no workspace filter in `tech-design-server.md:1540-1550`.

This reopens the workspace-scoping problem for the live stream even though snapshot scoping was fixed.

### 2. The epic’s canonical task contract snippets are still out of sync with the design/test docs.

- `epic.md` still defines `TaskDispatchConfig` without `target` or `workspaceIdentity`, and `TaskInfo` without `target` or `workspaceIdentity`, in `epic.md:886-904`.
- The server schema and server types require those fields in `tech-design-server.md:49-80` and `tech-design-server.md:191-225`.
- The fixtures/test plan also require them in `test-plan.md:88-114` and `test-plan.md:180-194`.

This is a real cross-document schema mismatch, not just wording drift.

### 3. The stdout parser never flushes the trailing buffer on process exit, so the final `result` line can still be dropped.

- The parser keeps an incomplete final line in `stdoutBuffer` in `tech-design-server.md:373-377`.
- The exit path emits completion/failure without ever consuming the remaining buffer in `tech-design-server.md:411-450`.
- The test fixture always appends a newline in `test-plan.md:246`, so the test plan would not catch this edge case.

If the CLI’s last JSON event is not newline-terminated, `resultText` can still be incomplete and manifest parsing can fail silently.

## Publish Recommendation

**Do not publish stories from this design yet.**

I would re-review after:

1. Live WebSocket relays are filtered by the socket’s current workspace identity.
2. The epic/task contract snippets are reconciled with the server schema (`target`, `workspaceIdentity`).
3. The TaskManager stdout parser flushes any remaining buffered line on exit/end.
4. The remaining index/path-contract drift is cleaned up across `tech-design.md` and `test-plan.md`.
