# Epic 14 Tech Design Review — Round 6

## Findings

### Major 1. Verification artifacts are still out of sync with the new `chat:autonomous-run` contract

- The server tech design now makes `workspaceIdentity` a required field on `ChatAutonomousRunMessage` in `tech-design-server.md:100-110`.
- Every autonomous run emission site now carries that field in `tech-design-server.md:1247-1254`, `tech-design-server.md:1272-1277`, `tech-design-server.md:1314-1320`, `tech-design-server.md:1329-1335`, and `tech-design-server.md:1342-1347`, and the relay now correctly filters on `event.workspaceIdentity === currentSocketWorkspace` in `tech-design-server.md:1587-1590`.
- But the verification fixtures in `test-plan.md:199-223` still construct `ChatAutonomousRunMessage` payloads without `workspaceIdentity`, so the verification plan's canonical test data no longer matches the documented schema.
- The WebSocket/autonomous test matrices also still do not add an explicit case proving that a socket focused on workspace B suppresses live `chat:autonomous-run` events from workspace A. The `ws-chat` table at `test-plan.md:351-360` only covers snapshots, and the autonomous tables at `test-plan.md:488-507` only cover normal lifecycle/cancel/failure paths.

This means the runtime design fix is present, but the verification package still does not fully encode or prove the regression that blocked Round 5.

### Minor 2. The top-level message catalog still omits the new `workspaceIdentity` field

- `tech-design.md:367-369` still lists the `chat:autonomous-run` key fields without `workspaceIdentity`, even though the server schema now requires it.

This is editorial drift, not a runtime design bug, but it should be corrected so the design package has one consistent wire contract.

## R5 Blocker Verification

### 1. Cross-workspace `chat:autonomous-run` leak
**Status: FIXED in the server tech design**

- `ChatAutonomousRunMessageSchema` now includes `workspaceIdentity` in `tech-design-server.md:100-110`.
- `AutonomousSequencer` persists workspace ownership on the run and includes `workspaceIdentity` in every emitted autonomous event in `tech-design-server.md:1194-1199` and `tech-design-server.md:1247-1347`.
- The WebSocket relay no longer consults `getActiveRunSnapshot()` to infer ownership; it now filters directly on `event.workspaceIdentity` in `tech-design-server.md:1587-1590`.

That closes the actual leak called out in Round 5. A socket on workspace B will no longer relay autonomous run events emitted for workspace A.

## Quick Regression Scan

I did not find a new runtime regression in `tech-design-server.md` from the R5 fix itself. The remaining issues are consistency and verification follow-through:

- verification fixtures/tests have not fully absorbed the new required field and regression case
- the top-level message summary still reflects the old payload shape

## Verdict

**FAIL — not ready for story publishing yet.**

The Round 5 blocker is fixed in the server design, but the design package is still internally inconsistent around that fix. Re-review after the verification artifacts and top-level contract summary are updated to match the new `workspaceIdentity` requirement and to explicitly cover cross-workspace autonomous-event suppression.
