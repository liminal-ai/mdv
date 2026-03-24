# Epic 14 Review — Round 1

Verdict: not ready for tech design. The draft has multiple contract-level gaps that would force the Tech Lead to invent core orchestration behavior.

Method note: the requested skill file at `/Users/leemoore/.claude/skills/liminal-spec/skills/ls-epic.md` was not present in this environment, so I used the installed `ls-epic` skill at `/Users/leemoore/.codex/skills/ls-epic/SKILL.md` as the review rubric.

## Critical

1. Epic 14 is written against an imaginary Epic 13 contract instead of the actual one.
Location: Epic 14 `Epic 13 Dependency Assumptions` (lines 73-96) and `Extended Script Execution Context` (lines 638-689); Epic 13 `Scope` (lines 35-47) and `Data Contracts` (lines 653-733).
Problem: Epic 14 says "no Epic 13 spec exists yet" and then assumes APIs such as `addPackageFile()` and `updateManifestEntries()`. The real Epic 13 contract already exists and defines different primitives: `addFile()`, `editFile()`, `updateManifest(content)`, `chat:package-changed`, and explicit `workspace/package/spec` provider context fields. Epic 14 also promises sidebar refresh after manifest updates in AC-3.2, but it never reuses Epic 13's `chat:package-changed` contract, which is the existing mechanism for that UI sync.
Why it matters: this is direct upstream contract drift. A Tech Lead cannot tell whether Epic 14 is supposed to consume Epic 13 as written or silently rewrite it. Results integration, manifest updates, and package UI refresh will otherwise be designed against the wrong interface.

2. The result/output contract cannot represent the phases the epic itself claims to support.
Location: Epic 14 phase table (lines 228-235), AC-2.4 (lines 308-321), AC-3.1 (lines 344-353), `ChatTaskStatusMessage` (lines 600-615), `TaskDispatchConfig` and `TaskInfo` (lines 663-679); Epic 12 `ChatFileCreatedMessage` (lines 463-468).
Problem: the epic models task output as one `outputPath`, but its own phase table says tech design produces `tech-design.md (+ companion documents)`, and publish produces story output rather than a single file. AC-3.1b further says `chat:file-created` is sent for each output file. Epic 12's `chat:file-created` requires a `messageId`, but Epic 14 never says how background tasks populate that correlation field, and `chat:task-status` has no corresponding request/message identity either.
Why it matters: the client cannot deterministically show completion, open the "result", refresh affected files, or reconcile multi-file outputs with the status stream. This is a blocking data-contract gap, not a polish issue.

3. The long-running task model has no reconnect or restart contract even though the feature depends on one.
Location: Epic 14 AC-1.2/AC-1.4 (lines 148-203), out-of-scope task persistence note (lines 65-66), `ChatTaskStatusMessage` (lines 600-625), reliability NFR (lines 733-735); Epic 12 `chat:conversation-load` contract (lines 470-490); `ls-epic` streaming guidance (lines 278-287).
Problem: tasks are expected to run for minutes, stay visible in the chat, survive client attention shifts, and even be "reported as failed on the next session" after server restart. But Epic 14 defines only live push updates (`chat:task-status`). There is no task snapshot/load message, no replay semantics, no workspace scoping, no upsert-vs-append rule, no ordering rule, and no completion/reconciliation rule for reconnect. Epic 12 solved this problem for conversation history with `chat:conversation-load`; Epic 14 adds nothing equivalent for tasks.
Why it matters: normal page reloads, WebSocket reconnects, and restarts would make "what's running?", status visibility, and cancellation unreliable or impossible. This directly fails the `ls-epic` requirement to specify correlation, sequencing, update semantics, and completion markers for real-time contracts.

4. Autonomous mode has no run-level state contract, and its sequencing rules are internally inconsistent.
Location: Epic 14 scope/out-of-scope (lines 55, 70-71), autonomous flow and ACs (lines 420-517), `ChatTaskStatusMessage.sequenceInfo` (lines 610-614), tech design questions 7 and 11 (lines 755-759); PRD Feature 14 rolled-up ACs (lines 826-829) and future state-model note (lines 886-889).
Problem: the draft talks about "an autonomous run" but only defines per-task status messages. There is no autonomous-run ID, no autonomous-run start/completion/cancellation event, and no client message for cancelling a run as distinct from cancelling one task. At the same time, the prose says the standard sequence is `epic -> tech-design -> publish`, may optionally prepend PRD refinement, and AC-4.1a dispatches the "first applicable phase" without defining skip logic when some artifacts already exist.
Why it matters: the implementation would have to invent the actual autonomy state machine, cancellation propagation, and resume/skip behavior. That is core product behavior, not tech-design fill-in.

## Major

1. The background worker model is still an assumption, not a requirement.
Location: Epic 14 assumptions A2/A6 (lines 102-107) and tech design questions 1, 3, and 10 (lines 749-758); Epic 10 tech design on provider model (lines 48-49 and 122-132).
Problem: Epic 14 promises concurrent background tasks plus unblocked foreground chat, but leaves the actual execution model unresolved: Epic 10 architecture biases toward one foreground process, Epic 10 tech design uses per-invocation `claude -p --resume`, and Epic 14 just assumes concurrent background processes will work beside that. Session ownership, cwd isolation, and foreground/background contention are left as open questions.
Why it matters: the orchestration feature is fundamentally about how work is executed. Leaving the process model as an assumption forces downstream design to negotiate scope, not just implementation.

2. Approval and re-dispatch are ambiguous once more than one candidate artifact exists.
Location: Epic 14 AC-3.4 through AC-3.6 (lines 381-416), concurrent tasks AC-1.5 (lines 205-218), duplicate-task rule AC-5.4 (lines 568-581).
Problem: the spec never binds approval or change requests to a specific completed task, artifact version, or active document. With concurrent work, reruns, or multiple features in flight, "looks good, proceed" and "section 3 needs more detail" are ambiguous. There is also no edge-case coverage for approving while a follow-on task is already running, or while an autonomous run is active.
Why it matters: the Steward can easily proceed from or revise the wrong artifact. Conversational approval is acceptable, but intent resolution still needs to be specified.

3. Several TCs depend on model wording instead of deterministic behavior.
Location: TC-2.3a, TC-2.3b, TC-2.3d (lines 291-306), TC-4.1b (lines 454-457), TC-4.3c (lines 484-487), TC-4.4d (lines 503-506).
Problem: these tests assert that the Steward "addresses" a prerequisite problem or "reports" sequence/cancellation details, but they do not anchor the expected behavior to a specific message field, task-state change, or emitted event.
Why it matters: these TCs cannot be verified reliably without inspecting prose quality. Epic 12 already corrected this class of issue by recasting similar cases as transport/state assertions.

4. Phase naming drifts from Epic 13's spec metadata vocabulary.
Location: Epic 14 dependency assumption D5 (line 86), phase IDs (lines 691-700); Epic 13 spec metadata (lines 365-367).
Problem: Epic 14 uses `publish` as the phase ID and mixes "publish epic", "publish", "story generation", and "publish stories". Epic 13's declared metadata vocabulary uses `specPhase: stories`.
Why it matters: phase detection, metadata updates, autonomous sequencing, and duplicate-task checks all depend on a stable phase vocabulary. Right now the artifacts disagree.

5. Manifest integration is under-specified beyond the happy path.
Location: Epic 14 AC-3.2 (lines 355-368) and AC-5.2b (lines 552-555); Epic 13 spec metadata and phase-awareness model (lines 365-367 and 414-426).
Problem: the spec says successful outputs are added to the manifest and failed partial outputs are not, but it never defines how multiple files are grouped, how reruns that overwrite an existing file affect the manifest, or whether `specPhase` / `specStatus` should advance when a phase succeeds or remain unchanged until approval.
Why it matters: package navigation and phase guidance can drift away from reality, which will feed bad inputs back into Epic 14's own prerequisite validation and autonomous sequencing.

6. The task-status contract is incomplete even on its own terms.
Location: Epic 14 AC-1.2 (lines 148-165), `TaskInfo` and `getRunningTasks()` prose (lines 671-689); `ls-epic` streaming guidance (lines 280-285).
Problem: `getRunningTasks()` is named as if it returns only active tasks, but its prose says it includes "recently completed" tasks. No retention window, sort order, or replace/append rule is specified. `TaskInfo.status` also omits `started`, even though `chat:task-status` uses it.
Why it matters: the chat UI and the conversational "what's running?" behavior will drift unless the contract says what the canonical task list actually contains.

## Minor

1. The dependency section is visibly stale.
Location: Epic 14 lines 75-78.
Problem: it still says no Epic 13 spec exists.
Why it matters: low direct product risk, but it signals that the dependency audit was not refreshed against the actual artifact set.

2. The output-path contract leaks technical detail while still missing the functional rule.
Location: Epic 14 `TaskDispatchConfig` (lines 663-668) and AC-2.4c (lines 318-321).
Problem: the epic hardcodes low-level fields like `inputPaths` and `outputPath`, but it still does not define the user-facing rule for how output locations are chosen when a phase produces a directory or multiple files.
Why it matters: this is mostly a spec-quality issue, but it increases the amount of redesign required in tech design.

## What I Noticed But Did Not Report

I noticed a few smaller issues that I did not elevate beyond the findings above: the wording oscillates between "publish epic" and "story publishing" in several places; the validation checklist claims the real-time contracts are fully typed even though they are not; and the story breakdown inherits the same unresolved task/autonomy assumptions instead of decomposing them. I left those out because they are symptoms of the larger contract and state-model gaps already listed above.
