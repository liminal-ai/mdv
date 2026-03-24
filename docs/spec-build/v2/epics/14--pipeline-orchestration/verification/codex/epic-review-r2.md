# Epic 14 Review — Round 2

Verdict: improved substantially, but not yet ready for tech design. The draft now closes most of the big Round 1 gaps, but several contract seams are still inconsistent after the rewrite, especially around Epic 13 interop, output/status fields, reconnect semantics, and the autonomous run state model.

Reviewed artifacts:
- `docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/epic.md`
- `docs/spec-build/v2/epics/14--pipeline-orchestration/verification/codex/epic-review-r1.md`

## Round 1 Fix Verification

### Critical

1. R1 Critical 1 — Epic 14 was written against an imaginary Epic 13 contract
Status: PARTIALLY FIXED

What is fixed:
- The stale "no Epic 13 spec exists yet" dependency framing is gone.
- Epic 14 now has an explicit "Epic 13 Contracts Consumed" section and mostly uses Epic 13's actual primitives: `addFile`, `editFile`, `updateManifest`, `getPackageManifest`, `chat:file-created`, and `chat:package-changed` (`epic.md` lines 73-117).

Remaining gaps:
- Epic 14 still redefines one consumed Epic 13 method incorrectly: it types `getFileContent(path)` as `Promise<string>` (`epic.md` line 809), but Epic 13 defines `getFileContent(path)` as `Promise<FileReadResult>` with `content`, `truncated`, and `totalLines` (`13--.../epic.md` lines 788-805 and 830-834).
- Epic 14 now reuses `chat:package-changed`, but it does not define how background-task-driven manifest updates populate Epic 13's required `messageId` field (`13--.../epic.md` lines 723-731). It solved this only for `chat:file-created` (`14--.../epic.md` lines 708-720).

2. R1 Critical 2 — The result/output contract could not represent the phases the epic claimed to support
Status: PARTIALLY FIXED

What is fixed:
- `outputPaths[]`, `primaryOutputPath`, and `outputDir` are now present in the data model (`epic.md` lines 684-700 and 824-842).
- Multi-file output behavior is covered in ACs and the `chat:file-created` correlation rule is now specified (`epic.md` lines 388-401 and 708-720).

Remaining gaps:
- Several ACs still assert a singular `outputPath` field that no longer exists in the typed contract:
  - TC-1.4c (`epic.md` line 220)
  - TC-2.4b (`epic.md` line 361)
  - TC-3.3a (`epic.md` line 442)
- Those stale references are not just prose drift; they leave the completion/dispatch transport contract internally inconsistent.

3. R1 Critical 3 — The long-running task model had no reconnect or restart contract
Status: PARTIALLY FIXED

What is fixed:
- `ChatTaskSnapshotMessage` now exists (`epic.md` lines 756-783).
- Initial connect, reconnect, workspace switch, restart, replace semantics, retention, and ordering are all explicitly addressed in AC-1.6 and the data-contract notes (`epic.md` lines 241-262 and 772-783).

Remaining gap:
- Restart behavior is now contradictory. AC-1.6d and the retention note say a post-restart snapshot contains no tasks (`epic.md` lines 255-258 and 777-780), but the Reliability NFR says a task running during restart is "reported as failed on the next session" (`epic.md` line 902). Both cannot be true without an additional replay/persistence rule.

4. R1 Critical 4 — Autonomous mode had no run-level state contract and inconsistent sequencing rules
Status: PARTIALLY FIXED

What is fixed:
- The revision adds `runId`, `chat:autonomous-run`, `chat:autonomous-cancel`, skip logic, run-vs-task cancellation, and run-level failure/completion assertions (`epic.md` lines 504-508, 527-600, and 722-754).

Remaining gaps:
- The run-state contract is still internally inconsistent:
  - `ChatAutonomousRunMessage.status` is `'started' | 'completed' | 'failed' | 'cancelled'` (`epic.md` line 728), but `currentPhaseIndex` is documented as present for `started, running` (`epic.md` line 731).
  - `ChatTaskSnapshotMessage.autonomousRun` is described as "Present if an autonomous run is active" (`epic.md` line 762), but its `status` union includes terminal states (`completed`, `failed`, `cancelled`) (`epic.md` lines 764-768).
- That means the autonomous state machine exists now, but it is still not fully coherent as a transport contract.

### Major

1. R1 Major 1 — The background worker model was still an assumption, not a requirement
Status: FIXED

Why:
- A2 now makes isolated background processes a functional requirement rather than a casual assumption (`epic.md` lines 123-128). The tech design still needs to choose mechanics, but the product-level requirement is now explicit.

2. R1 Major 2 — Approval and re-dispatch were ambiguous once more than one candidate artifact existed
Status: PARTIALLY FIXED

What is fixed:
- The draft now binds ambiguous approval primarily through the active document and secondarily through the most recently completed task (`epic.md` lines 448-461).

Remaining gaps:
- The review-binding rule depends on provider-context data that is never added to the typed contracts. AC-3.4a says the provider context includes the most recently completed task's `taskId` and `phase` (`epic.md` line 453), but there is no corresponding ProviderContext extension in Epic 14's data contracts.
- The draft still does not say what happens if approval/change-request arrives while a follow-on task for that same artifact is already running, or while an autonomous run already owns that sequence.

3. R1 Major 3 — Several TCs depended on model wording instead of deterministic behavior
Status: PARTIALLY FIXED

What is fixed:
- The autonomous-mode TCs cited in R1 were successfully recast as transport/state assertions (`epic.md` lines 563-600).

Remaining gaps:
- TC-2.3a and TC-2.3b still depend on unverifiable prose quality:
  - "the Steward's response addresses the missing prerequisite" (`epic.md` lines 338 and 342)
- Those should be rewritten as deterministic chat/error/dispatch assertions, consistent with the rest of the revision.

4. R1 Major 4 — Phase naming drifted from Epic 13's `specPhase` vocabulary
Status: PARTIALLY FIXED

What is fixed:
- The primary phase vocabulary is now documented as `prd -> epic -> tech-design -> stories -> implementation -> complete` (`epic.md` lines 107-113 and 859-868).

Remaining gaps:
- Stale `publish` wording still survives in several places:
  - Assumption A5 (`epic.md` line 127)
  - TC-2.1c still says "publish phase" (`epic.md` lines 301-304)
  - TC-2.2c still says "Publish epic" (`epic.md` lines 324-327)
  - Story breakdown still says "publish" in Stories 2 and 4 (`epic.md` lines 977-981 and 1017-1019)
- The identifiers are mostly aligned now, but the draft is not yet vocabulary-clean.

5. R1 Major 5 — Manifest integration was under-specified beyond the happy path
Status: PARTIALLY FIXED

What is fixed:
- The revision adds multi-file grouping, rerun overwrite behavior, and success/failure metadata advancement rules (`epic.md` lines 418-435).

Remaining gap:
- The manifest metadata contract still stops short of the approval loop it now describes. On success, AC-3.2f sets `specStatus: draft` (`epic.md` lines 428-431), but nothing advances `specStatus` to `in-review` or `approved` after the review/approval flow in AC-3.4/3.5, and nothing defines what re-dispatch does to `specStatus`.

6. R1 Major 6 — The task-status contract was incomplete even on its own terms
Status: FIXED

Why:
- `TaskInfo.status` now includes `started`, and `getRunningTasks()` now explicitly defines retention and ordering for active plus recently finished tasks (`epic.md` lines 777-783 and 832-855).

### Minor

1. R1 Minor 1 — The dependency section was visibly stale
Status: FIXED

Why:
- The stale dependency language is gone and the dependency section now references Epic 13's actual contracts (`epic.md` lines 872-879).

2. R1 Minor 2 — The output-path contract still missed the functional rule
Status: NOT FIXED

Why:
- `TaskDispatchConfig.outputPath` was correctly replaced with `outputDir`, but the draft still leaves the actual output-location rule unresolved as a Tech Design Question (`epic.md` lines 824-830 and 921-922).
- AC-2.4 requires the system to report where it will write, but the epic still does not define how that location is chosen for each phase.

## New Findings

### Major

1. Background-task manifest updates still do not fully interlock with Epic 13's `chat:package-changed` contract.
Location:
- Epic 13 `ChatPackageChangedMessage`: `13--package-and-spec-awareness/epic.md` lines 723-731
- Epic 14 results integration and manifest update flow: `14--pipeline-orchestration/epic.md` lines 403-435
- Epic 14 file-created correlation rule: `14--pipeline-orchestration/epic.md` lines 708-720

Problem:
- Epic 14 correctly added a background-task correlation rule for `chat:file-created` by setting `messageId = taskId`, but it did not add an equivalent rule for `chat:package-changed`.
- In package mode, result integration explicitly depends on `chat:package-changed` after `updateManifest`, yet the reused Epic 13 message still requires a `messageId`.

Why it matters:
- Package-mode completion cannot be fully implemented against the typed contract as written. The server either has to invent a new correlation rule for `chat:package-changed` or emit a contract-invalid message.

2. Result-integration message sequencing is still undefined across `chat:file-created`, `chat:package-changed`, and `chat:task-status`.
Location:
- Epic 14 AC-3.1 through AC-3.3: `epic.md` lines 388-447
- Epic 14 task status contract: `epic.md` lines 684-720
- Epic 13 sequencing note for normal scripted responses: `13--package-and-spec-awareness/epic.md` lines 748-754

Problem:
- The revised draft now depends on three separate message streams during background completion:
  - one `chat:file-created` per output file
  - one `chat:package-changed` after manifest update
  - one `chat:task-status` with `completed`
- But it never specifies their ordering for background tasks.

Why it matters:
- Without a sequencing rule, the client can legitimately receive "task completed" before the files have refreshed or before the package navigation updates. That makes completion rendering, clickable output links, and sidebar consistency race-prone.

3. The autonomous-run live contract and snapshot contract disagree about what states are representable.
Location:
- `ChatAutonomousRunMessage`: `epic.md` lines 724-735
- `ChatTaskSnapshotMessage.autonomousRun`: `epic.md` lines 759-768
- Autonomous ACs: `epic.md` lines 527-600

Problem:
- The live event contract has no `running` state, but comments and ACs imply ongoing run progress.
- The snapshot contract says `autonomousRun` is present only when a run is active, but its own status union includes terminal states.
- No retention/replay rule explains whether a reconnect after run completion/failure/cancellation should surface a terminal run state or omit it entirely.

Why it matters:
- The client cannot implement a stable autonomous-run state machine from these contracts alone. Reconnect behavior and progress rendering would require design-time invention.

### Minor

1. AC numbering regressed during the rewrite.
Location:
- `epic.md` lines 403-435

Problem:
- The draft has `AC-3.2` followed by `AC-3.2b` as a sibling acceptance criterion heading.

Why it matters:
- Low product risk, but it makes traceability and downstream story/test mapping noisier than it needs to be.
