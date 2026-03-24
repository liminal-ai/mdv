# Epic 14 Review — Round 3

Verdict: **FAIL** — **not yet ready for tech design**.

The draft closes almost all Round 2 residuals and is much closer to ready. One
major contract gap remains in the approval-binding fix: the new edge-case prose
depends on "active task info" in `ProviderContext`, but that data is still not
typed anywhere. Because the follow-on approval path now relies on untyped
provider data, the epic is not yet fully implementation-safe for tech design.

Reviewed artifacts:
- `docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/epic.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/verification/codex/epic-review-r2.md`

## R2 Finding Verification

### Round 1 Findings Re-verified in Round 2

1. **R1 Critical 1 — Epic 14 was written against an imaginary Epic 13 contract**
   - Status: **FIXED**
   - Why:
     - `getFileContent(path)` now matches Epic 13's `Promise<FileReadResult>` contract instead of `Promise<string>` (`14/epic.md` lines 869-875; `13/epic.md` lines 817-833, 859-863).
     - Background-task `chat:package-changed` correlation is now defined with `messageId = taskId`, matching the same rule already used for `chat:file-created` (`14/epic.md` lines 731-744; `13/epic.md` lines 751-759).

2. **R1 Critical 2 — The result/output contract could not represent the phases the epic claimed to support**
   - Status: **FIXED**
   - Why:
     - The stale singular `outputPath` references called out in R2 are gone.
     - Completion and reporting now consistently use `outputPaths`, `primaryOutputPath`, and `outputDir` (`14/epic.md` lines 217-220, 358-365, 447-454, 692-709, 885-903).

3. **R1 Critical 3 — The long-running task model had no reconnect or restart contract**
   - Status: **FIXED**
   - Why:
     - Restart semantics are now consistent: post-restart snapshots are empty, task state is lost, and the reliability note no longer claims tasks are replayed as failed on the next session (`14/epic.md` lines 255-258, 801-806, 962-964).

4. **R1 Critical 4 — Autonomous mode had no run-level state contract and inconsistent sequencing rules**
   - Status: **FIXED**
   - Why:
     - `ChatAutonomousRunMessage.status` now includes `running`, and `currentPhaseIndex` is documented against `started`/`running` only (`14/epic.md` lines 749-759).
     - `ChatTaskSnapshotMessage.autonomousRun` is now explicitly present only while a run is active, with a non-terminal status union (`14/epic.md` lines 783-793).

5. **R1 Major 1 — The background worker model was still an assumption, not a requirement**
   - Status: **FIXED**
   - Why:
     - A2 still clearly frames isolated background processes as a functional requirement, not an implementation preference (`14/epic.md` lines 123-128).

6. **R1 Major 2 — Approval and re-dispatch were ambiguous once more than one candidate artifact existed**
   - Status: **NOT FIXED**
   - Why:
     - The draft correctly adds `lastCompletedTask` to `ProviderContext` (`14/epic.md` lines 820-843).
     - But the new edge-case prose says the provider context includes "`lastCompletedTask` and the active task info" when approval arrives during an already-running follow-on (`14/epic.md` lines 845-849).
     - No corresponding `ProviderContext` field is typed for that active task information, and Epic 13's upstream `ProviderContext` has no such field either (`13/epic.md` lines 682-713).
   - Why it still matters:
     - The approval-binding behavior now depends on untyped provider data again. Tech design would still need to invent the transport shape for this path.

7. **R1 Major 3 — Several TCs depended on model wording instead of deterministic behavior**
   - Status: **FIXED**
   - Why:
     - TC-2.3a/b/d now assert deterministic `chat:error` behavior with `PREREQUISITE_MISSING` and no task dispatch, rather than checking response quality (`14/epic.md` lines 333-350, 810-817).

8. **R1 Major 4 — Phase naming drifted from Epic 13's `specPhase` vocabulary**
   - Status: **FIXED**
   - Why:
     - The stale `publish` phase references called out in R2 are removed from the previously flagged locations; the phase contract now consistently uses `stories` in the ACs, identifiers, and story breakdown (`14/epic.md` lines 301-304, 324-331, 918-929, 1036-1053, 1076-1092).

9. **R1 Major 5 — Manifest integration was under-specified beyond the happy path**
   - Status: **FIXED**
   - Why:
     - The `specStatus` lifecycle now covers success (`draft`), explicit approval (`approved`), and re-dispatch reset (`draft`) (`14/epic.md` lines 418-443).

10. **R1 Major 6 — The task-status contract was incomplete even on its own terms**
    - Status: **FIXED**
    - Why:
      - The status union still includes `started`, and retention/ordering rules remain specified for active and recent tasks (`14/epic.md` lines 692-709, 801-806, 893-903, 910-916).

11. **R1 Minor 1 — The dependency section was visibly stale**
    - Status: **FIXED**
    - Why:
      - The dependency section still points to Epic 13's actual contracts rather than stale placeholder language (`14/epic.md` lines 933-943).

12. **R1 Minor 2 — The output-path contract still missed the functional rule**
    - Status: **FIXED**
    - Why:
      - This is now appropriately framed as a tech design question rather than an unacknowledged product-contract hole (`14/epic.md` lines 976-985).
      - At the epic level, the required behavior is that dispatch reports the output location it chose; the path-selection mechanism itself can be resolved in tech design (`14/epic.md` lines 352-365).

### New Findings Introduced in Round 2

13. **New Major 1 — Background-task manifest updates still did not fully interlock with Epic 13's `chat:package-changed` contract**
    - Status: **FIXED**
    - Why:
      - Epic 14 now explicitly defines the `chat:package-changed` correlation rule for background tasks (`14/epic.md` lines 731-744).

14. **New Major 2 — Result-integration message sequencing was undefined across `chat:file-created`, `chat:package-changed`, and `chat:task-status`**
    - Status: **FIXED**
    - Why:
      - Completion ordering is now explicit: `chat:file-created` → `chat:package-changed` → `chat:task-status completed`, with `completed` defined as terminal for that task (`14/epic.md` lines 736-744).

15. **New Major 3 — The autonomous-run live contract and snapshot contract disagreed about what states were representable**
    - Status: **FIXED**
    - Why:
      - The live and snapshot contracts now agree on active vs terminal run states (`14/epic.md` lines 749-759, 783-793).

16. **New Minor 1 — AC numbering regressed during the rewrite**
    - Status: **FIXED**
    - Why:
      - The former sibling `AC-3.2b` is now renumbered cleanly as `AC-3.7`, with matching `TC-3.7a` through `TC-3.7f` (`14/epic.md` lines 418-443).

## New Findings

### Major

1. **The Round 2 approval-edge-case fix reintroduces an untyped `ProviderContext` dependency.**
   - Location:
     - `docs/spec-build/v2/epics/14--pipeline-orchestration/epic.md` lines 845-849
     - `docs/spec-build/v2/epics/14--pipeline-orchestration/epic.md` lines 825-836
     - `docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md` lines 682-713
   - Problem:
     - The spec now says that, during approval while a follow-on task is already running, the provider context includes "the active task info."
     - But the only typed Epic 14 extension is `lastCompletedTask`; there is still no typed field for active task identity/status.
   - Why it matters:
     - The edge-case behavior cannot be implemented from the contract as written. Tech design would have to invent a new provider-context field or another source of active-task state.
   - Suggested fix:
     - Either add a typed `activeTask`/`activeTasks` field to `ProviderContext`, or rewrite the edge-case behavior so it relies only on already-typed contracts.

## Pass / Fail

**Fail** for this round. The epic is close, but it is **not ready for tech design yet** because one approval-binding path still depends on untyped provider data.

Once that `ProviderContext` seam is closed, I do not see any remaining Round 2 blockers.
