# Epic 14: Pipeline Orchestration

This epic defines the complete requirements for the Spec Steward's pipeline
orchestration layer — background task management, Liminal Spec pipeline dispatch,
results integration, conversational approval, and autonomous multi-phase
execution. It serves as the source of truth for the Tech Lead's design work.

---

## User Profile

**Primary User:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward
**Context:** Working in a spec package with existing artifacts (a PRD, possibly partial epics or designs), ready to execute pipeline operations through the Steward rather than manually invoking Liminal Spec skills in separate terminal sessions
**Mental Model:** "I tell the Steward what to build, it runs the pipeline in the background while I keep working, I review the output and tell it to continue or fix things"
**Key Constraint:** Background tasks must not block interactive chat — the developer chats, edits, and browses while pipeline operations run. Vanilla JS frontend, no component framework. The CLI provider from Epic 10 is the execution mechanism. Feature-flagged behind `FEATURE_SPEC_STEWARD`. The Steward orchestrates through existing Liminal Spec skills — it does not modify the skills themselves.

---

## Feature Overview

After this epic, the developer can tell the Steward to execute Liminal Spec
pipeline operations — drafting epics, creating tech designs, publishing stories,
running implementation — and the Steward dispatches these as background tasks.
The developer continues chatting, editing, and browsing while the work runs.
When a task completes, the Steward notifies the developer and the output appears
in the workspace. The developer reviews the output in the viewer, communicates
approval or change requests through the chat, and the Steward proceeds or
iterates. For maximum throughput, the developer can opt into autonomous mode:
"run the full spec pipeline for this feature" sequences through all spec phases
without intermediate approval.

---

## Scope

### In Scope

Background task management and Liminal Spec pipeline dispatch through the
existing chat and provider infrastructure:

- Background task dispatching and lifecycle management (start, track, cancel)
- Task status visibility in the chat panel with status and elapsed time
- Task status querying through conversation ("what's running?")
- Task cancellation through conversation and dedicated WebSocket message
- Concurrent interactive chat while background tasks run
- Pipeline phase dispatch for supported Liminal Spec phases: epic drafting, tech design, publish epic, implementation
- Input artifact resolution for each pipeline phase (PRD for epic, epic for tech design, etc.)
- Phase prerequisite validation before dispatch
- Output file integration into the workspace or package on task completion
- Manifest update when pipeline output creates new files in a package
- Task completion notification with output location
- Conversational approval flow — the developer reviews output and communicates through chat
- Follow-on phase dispatch on approval (the Steward proceeds to the next phase)
- Re-dispatch with feedback on change request (the Steward incorporates the developer's notes)
- Autonomous mode — sequential multi-phase execution without intermediate approval
- Autonomous mode progress reporting and cancellation
- Extended WebSocket protocol with task lifecycle message types
- Extended script execution context with task management methods
- Multiple concurrent background tasks (up to a configured limit)

### Out of Scope

- Custom agent harness (future — uses CLI provider from Epic 10)
- Multi-agent verification loops managed by the Steward directly (the CLI provider handles verification internally via the Liminal Spec skills)
- Pipeline state persistence beyond conversation history (fast follow — task state is in-memory; conversation history captures what happened)
- Formal approval gate UI with status badges (fast follow — approval is conversational, not a dedicated widget)
- Modifications to Liminal Spec skills themselves (tracked separately)
- Task queueing or priority scheduling (tasks dispatch immediately or are rejected if at the concurrency limit)
- Task result diffing or comparison across runs
- Pipeline phase customization or reordering (the Steward follows the standard LS phase sequence)
- PRD creation from scratch as a background task (PRD authoring is conversational; only PRD refinement is part of autonomous mode)

### Epic 13 Dependency Assumptions

Epic 14 assumes Epic 13 (Package and Spec Awareness) delivered the following
capabilities. These are derived from the PRD's Feature 13 description; no Epic
13 spec exists yet. Where the boundary between Epic 13 and Epic 14 is uncertain,
the assumption is documented.

| ID | Assumed Capability from Epic 13 | Boundary Notes |
|----|--------------------------------|----------------|
| D1 | Package awareness — the Steward knows the manifest structure and can reference any file by navigation path | Foundation for pipeline input resolution |
| D2 | Multi-file context — the Steward can read multiple files from the package in a single interaction | Required for pipeline phases that need multiple inputs (e.g., publish epic needs epic + tech design) |
| D3 | Package operations through chat — creating files, modifying manifests, adding entries | Used by results integration when pipeline output creates new files |
| D4 | Spec package conventions — manifest metadata fields (type, pipeline phase, status) that identify a package as a spec package | Used to determine what pipeline phase the project is in |
| D5 | Liminal Spec phase awareness — the Steward knows the phases (PRD → epic → tech design → publish → implementation) and can determine the current phase from existing artifacts | Foundation for prerequisite validation and autonomous mode sequencing |
| D6 | Phase guidance — the Steward suggests what comes next based on existing artifacts | Epic 14 extends guidance with execution — the Steward can do the work, not just suggest it |
| D7 | Folder-mode operations — package-like operations work on regular folders too | Pipeline operations work in both package and folder modes |

**Boundary uncertainty:** The line between "the Steward suggests the next phase"
(Epic 13) and "the Steward dispatches the next phase" (Epic 14) is the clearest
boundary. Epic 13 delivers awareness and guidance; Epic 14 delivers execution
and orchestration. Where uncertainty exists: Epic 13's package operations
(creating files, updating manifests) are the mechanism that Epic 14's results
integration uses. If Epic 13's implementation doesn't include these operations,
Epic 14 must deliver them — but the PRD assigns them to Feature 13.

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Epic 13 (Package and Spec Awareness) is complete — see Epic 13 Dependency Assumptions table above | Unvalidated | Dev team | Epic 14 extends these capabilities with execution and orchestration |
| A2 | The per-invocation CLI provider model supports spawning multiple concurrent processes for background tasks alongside the foreground interactive session | Unvalidated | Tech Lead | Epic 10's model spawns one process per user message; background tasks need parallel processes |
| A3 | Liminal Spec skill invocations can be expressed as CLI provider commands with appropriate arguments and context | Unvalidated | Tech Lead | The specific invocation patterns for each LS phase need validation during tech design |
| A4 | Background CLI processes can write output files to the workspace without interfering with each other or the foreground session | Unvalidated | Tech Lead | Concurrent file writes need path management |
| A5 | Pipeline operations (epic drafting, tech design, publish, implementation) typically complete within 5–30 minutes | Unvalidated | — | Based on observed Liminal Spec skill execution times; affects progress reporting frequency |
| A6 | The Claude CLI's session management supports independent sessions for background tasks that are separate from the foreground conversation session | Unvalidated | Tech Lead | Background tasks may need their own session IDs or run without --resume |

---

## Flows & Requirements

### 1. Background Task Management

The developer requests a pipeline operation through the chat. The Steward
dispatches it as a background task — a separate CLI process that runs
independently of the foreground chat session. The developer continues chatting,
editing, and browsing while the task runs. Task lifecycle events (started,
progress, completed, failed, cancelled) arrive as dedicated WebSocket messages
and appear in the chat. The developer can ask about running tasks at any time
and can cancel tasks through the chat or a dedicated message.

1. Developer requests a pipeline operation ("draft the epic for Feature 2")
2. Steward dispatches a background task
3. Server sends `chat:task-status` with `started` status
4. Developer continues chatting — the foreground session is unblocked
5. Server sends periodic `chat:task-status` with `running` status and elapsed time
6. Task completes — server sends `chat:task-status` with `completed` status
7. Developer asks "what's running?" — Steward reports active task status

#### Acceptance Criteria

**AC-1.1:** The developer can continue chatting while a background task runs

- **TC-1.1a: Chat exchange during running task**
  - Given: A background task is running
  - When: The developer sends a chat message
  - Then: The Steward responds normally — the message flows through the foreground provider independently of the background task
- **TC-1.1b: Task status updates do not interrupt active streaming**
  - Given: A background task is running AND the Steward is streaming a foreground response
  - When: A `chat:task-status` message arrives
  - Then: The status message is delivered to the client without interrupting the active token stream (messages are independent WebSocket frames)
- **TC-1.1c: Multiple chat exchanges during long task**
  - Given: A background task has been running for several minutes
  - When: The developer sends multiple messages and receives responses
  - Then: All exchanges complete normally; the background task continues running

**AC-1.2:** Active background tasks are visible in the chat panel with status and elapsed time

- **TC-1.2a: Running task shows status**
  - Given: A background task is running
  - When: The developer views the chat panel
  - Then: A task status indicator is visible showing the task description, phase, and current status
- **TC-1.2b: Elapsed time updates**
  - Given: A background task has been running for more than one minute
  - When: The developer views the task status indicator
  - Then: The elapsed time is visible and reflects approximate real time (updated via periodic `chat:task-status` messages)
- **TC-1.2c: Completed task shows final status**
  - Given: A background task has completed
  - When: The developer views the chat panel
  - Then: The task status indicator shows "completed" with the output location
- **TC-1.2d: No indicators when no tasks exist**
  - Given: No background tasks are running or recently completed
  - When: The developer views the chat panel
  - Then: No task status indicators are visible

**AC-1.3:** The developer can cancel a running background task

- **TC-1.3a: Cancel via WebSocket message**
  - Given: A background task is running with a known task ID
  - When: The client sends a `chat:task-cancel` message with the task ID
  - Then: The background task is terminated and a `chat:task-status` message with `cancelled` status is sent
- **TC-1.3b: Cancel via script execution lane**
  - Given: A background task is running
  - When: The `cancelTask(taskId)` script context method is called with the task's ID
  - Then: The background task is terminated and a `chat:task-status` message with `cancelled` status is sent
- **TC-1.3c: Partial output preserved on cancel**
  - Given: A background task has produced partial output before cancellation
  - When: The task is cancelled
  - Then: Any files written to disk before cancellation remain (not deleted)
- **TC-1.3d: Cancel non-existent task**
  - Given: No background task with the specified ID exists
  - When: A `chat:task-cancel` message is sent with that ID
  - Then: A `chat:error` message is returned with code `TASK_NOT_FOUND`

**AC-1.4:** Task lifecycle events are communicated via dedicated WebSocket messages

- **TC-1.4a: Started event**
  - Given: A background task is dispatched
  - When: The task begins execution
  - Then: The server sends a `chat:task-status` message with `status: 'started'`, the task ID, phase, and description
- **TC-1.4b: Progress events**
  - Given: A background task is running
  - When: Periodic progress intervals elapse
  - Then: The server sends `chat:task-status` messages with `status: 'running'` and updated `elapsedMs`
- **TC-1.4c: Completed event**
  - Given: A background task finishes successfully
  - When: The task's CLI process exits with success
  - Then: The server sends a `chat:task-status` message with `status: 'completed'` and `outputPath` indicating the output file location
- **TC-1.4d: Failed event**
  - Given: A background task fails
  - When: The task's CLI process exits with an error
  - Then: The server sends a `chat:task-status` message with `status: 'failed'` and `error` describing the failure

**AC-1.5:** Multiple background tasks can run concurrently up to a configured limit

- **TC-1.5a: Two tasks for different phases run simultaneously**
  - Given: One background task is running (e.g., epic drafting for Feature A)
  - When: The developer dispatches another task (e.g., tech design for Feature B)
  - Then: Both tasks run concurrently; each has independent status tracking
- **TC-1.5b: Concurrency limit enforced**
  - Given: The maximum number of concurrent background tasks is running
  - When: The developer requests an additional task
  - Then: The dispatch is rejected with a `chat:error` message with code `TASK_LIMIT_REACHED` explaining that the concurrency limit has been reached
- **TC-1.5c: Independent lifecycle**
  - Given: Two background tasks are running concurrently
  - When: One task completes
  - Then: The other task continues running unaffected; the completed task's status is reported independently

### 2. Pipeline Phase Dispatch

The developer requests a specific Liminal Spec pipeline phase through the chat.
The Steward identifies the requested phase, resolves the input artifacts from
the workspace or package (using Epic 13's awareness), validates that
prerequisites are met, reports what it will use and where it will write, and
dispatches the operation as a background task.

Supported pipeline phases:

| Phase | Input Artifacts | Output |
|-------|----------------|--------|
| Epic drafting | PRD (or PRD section for a specific feature) | `epic.md` |
| Tech design | Epic | `tech-design.md` (+ companion documents) |
| Publish epic | Epic + tech design | Stories document |
| Implementation | Published stories (+ tech design for reference) | Code changes |

1. Developer says "draft the epic for Feature 2"
2. Steward identifies the phase (epic drafting) and the target (Feature 2)
3. Steward resolves input artifacts — locates the PRD and the Feature 2 section
4. Steward validates prerequisites — PRD exists and contains Feature 2
5. Steward reports: "I'll draft the epic using the PRD's Feature 2 section. Output will be at `epics/feature-2/epic.md`."
6. Steward dispatches the background task
7. `chat:task-status` with `started` is sent

#### Acceptance Criteria

**AC-2.1:** The Steward dispatches supported pipeline phases as background tasks when requested

- **TC-2.1a: Epic drafting dispatch**
  - Given: A workspace with a PRD file
  - When: The developer requests epic drafting for a feature
  - Then: A background task is dispatched and a `chat:task-status` message with `started` status is sent
- **TC-2.1b: Tech design dispatch**
  - Given: A workspace with a completed epic
  - When: The developer requests tech design
  - Then: A background task is dispatched for the tech design phase
- **TC-2.1c: Publish epic dispatch**
  - Given: A workspace with a completed epic and tech design
  - When: The developer requests publish epic / story generation
  - Then: A background task is dispatched for the publish phase
- **TC-2.1d: Implementation dispatch**
  - Given: A workspace with published stories
  - When: The developer requests implementation
  - Then: A background task is dispatched for the implementation phase
- **TC-2.1e: Foreground remains available after dispatch**
  - Given: A pipeline task has been dispatched
  - When: The developer sends a follow-up message
  - Then: The foreground chat session responds normally — the dispatch did not block the interactive session

**AC-2.2:** Each pipeline phase receives the appropriate input artifacts as context

- **TC-2.2a: Epic drafting receives PRD content**
  - Given: The developer requests epic drafting for a feature
  - When: The task is dispatched
  - Then: The task's CLI invocation includes the PRD content (or the relevant feature section) as input context
- **TC-2.2b: Tech design receives epic content**
  - Given: The developer requests tech design
  - When: The task is dispatched
  - Then: The task's CLI invocation includes the epic content as input context
- **TC-2.2c: Publish epic receives epic and tech design**
  - Given: The developer requests publish epic
  - When: The task is dispatched
  - Then: The task's CLI invocation includes both the epic and tech design as input context
- **TC-2.2d: Implementation receives stories and tech design**
  - Given: The developer requests implementation
  - When: The task is dispatched
  - Then: The task's CLI invocation includes the published stories and tech design as input context

**AC-2.3:** Phase prerequisites are validated before dispatch — missing inputs produce an explanatory message

- **TC-2.3a: Tech design without epic**
  - Given: A workspace with a PRD but no epic
  - When: The developer requests tech design
  - Then: No background task is dispatched; no `chat:task-status` with `started` is sent; the Steward's response addresses the missing prerequisite
- **TC-2.3b: Publish without tech design**
  - Given: A workspace with a PRD and epic but no tech design
  - When: The developer requests publish epic
  - Then: No background task is dispatched; no `chat:task-status` with `started` is sent; the Steward's response addresses the missing prerequisite
- **TC-2.3c: All prerequisites met**
  - Given: A workspace with all required input artifacts for the requested phase
  - When: The developer requests the phase
  - Then: Prerequisites pass and the task is dispatched
- **TC-2.3d: Implementation without stories**
  - Given: A workspace with spec artifacts but no published stories
  - When: The developer requests implementation
  - Then: No background task is dispatched; no `chat:task-status` with `started` is sent

**AC-2.4:** The Steward reports dispatch details before starting the task

- **TC-2.4a: Input artifacts reported**
  - Given: Prerequisites are met for the requested phase
  - When: The Steward dispatches the task
  - Then: The `chat:task-status` `started` message is preceded by a completed agent response (non-empty, `streaming: false`) that references the input artifacts being used
- **TC-2.4b: Output location reported**
  - Given: Prerequisites are met for the requested phase
  - When: The Steward dispatches the task
  - Then: The `chat:task-status` `started` message includes the planned `outputPath`, and the preceding agent response references the output location
- **TC-2.4c: Reported output matches actual output**
  - Given: The Steward reported an output location before dispatch
  - When: The task completes
  - Then: The output file exists at the reported location (or within the reported directory)

### 3. Results Integration and Approval

When a background task completes, the output file appears in the workspace or
package. If a package is open, the manifest is updated to include the new file.
The Steward notifies the developer and offers to open the result for review. The
developer reviews the output in the viewer and communicates through the chat —
approving, requesting changes, or asking questions. On approval, the Steward can
proceed to the next pipeline phase. On change request, the Steward can
re-dispatch the phase incorporating the developer's feedback.

1. Background task completes
2. Output file is written to the workspace
3. If package mode: manifest is updated to include the new file
4. Server sends `chat:file-created` for the output file
5. Steward notifies the developer: "Epic draft complete. Output at `epics/feature-2/epic.md`. Want me to open it?"
6. Developer opens and reviews in the viewer
7. Developer says "looks good, proceed to tech design" → Steward dispatches next phase
8. OR developer says "section 3 needs more detail" → Steward re-dispatches with feedback

#### Acceptance Criteria

**AC-3.1:** Completed task output files appear in the workspace

- **TC-3.1a: Output file exists after task completion**
  - Given: A pipeline task completes successfully
  - When: The `chat:task-status` with `completed` status is sent
  - Then: The output file exists on disk at the path reported in the task status
- **TC-3.1b: File-created notification sent**
  - Given: A pipeline task has written an output file
  - When: The task completes
  - Then: A `chat:file-created` message is sent for each output file, triggering viewer refresh if the file is open

**AC-3.2:** When a package is open, the manifest is updated to include new output files

- **TC-3.2a: Manifest updated in package mode**
  - Given: A spec package is open and a pipeline task completes with a new output file
  - When: Results are integrated
  - Then: The package manifest includes a navigation entry for the new file
- **TC-3.2b: Sidebar reflects manifest update**
  - Given: The manifest has been updated with a new file entry
  - When: The developer views the sidebar
  - Then: The new file appears in the package navigation tree
- **TC-3.2c: No manifest update in folder mode**
  - Given: The developer is working in a regular folder (not a package)
  - When: A pipeline task completes with an output file
  - Then: The file is written to disk but no manifest update occurs (folder mode has no manifest)

**AC-3.3:** The Steward notifies the developer on task completion and offers to open the result

- **TC-3.3a: Completion notification in chat**
  - Given: A pipeline task completes
  - When: The `chat:task-status` with `completed` status arrives
  - Then: The task status message contains the `outputPath` field; the chat panel displays the completion with the output location (via the task status indicator from AC-1.2)
- **TC-3.3b: Output path is navigable**
  - Given: The completion notification contains an output file path
  - When: The developer views the notification
  - Then: The file path is a clickable link that opens the file in the viewer (using Epic 12's local file navigation)

**AC-3.4:** The developer can send feedback after reviewing a completed task's output

- **TC-3.4a: Follow-up message with output as context**
  - Given: A pipeline task has completed and the developer has opened the output file
  - When: The developer sends a follow-up message in the chat
  - Then: The message is sent with the output file as the active document context (Epic 12's context injection)
- **TC-3.4b: Feedback does not interfere with running tasks**
  - Given: The developer is reviewing output from one completed task while another task is running
  - When: The developer sends feedback about the completed task's output
  - Then: The feedback is processed normally; the running task is unaffected

**AC-3.5:** On approval, the Steward can dispatch the next pipeline phase

- **TC-3.5a: Follow-on phase uses preceding output as input**
  - Given: The developer has reviewed the output from epic drafting and requested the next phase
  - When: The Steward dispatches the tech design phase
  - Then: The tech design task receives the just-completed epic as input
- **TC-3.5b: Follow-on dispatch produces a new task**
  - Given: The Steward dispatches a follow-on phase
  - When: The task starts
  - Then: The new task has its own task ID and independent lifecycle; it appears as a separate task in status tracking

**AC-3.6:** On change request, the Steward can re-dispatch the phase with the developer's feedback incorporated

- **TC-3.6a: Re-dispatch includes feedback context**
  - Given: The developer has reviewed output and requested changes
  - When: The Steward re-dispatches the same phase
  - Then: The task context includes the developer's feedback alongside the original input artifacts
- **TC-3.6b: Re-dispatch produces a new task**
  - Given: The Steward re-dispatches a phase with feedback
  - When: The task starts
  - Then: The new task has its own task ID; the previous task's completed status is unchanged
- **TC-3.6c: Re-dispatch output replaces previous output**
  - Given: A re-dispatched task completes
  - When: The output file is written
  - Then: The output file overwrites the previous version at the same path

### 4. Autonomous Pipeline Execution

The developer opts into autonomous mode for a feature or project. The Steward
sequences through pipeline phases automatically: epic drafting → tech design →
publish epic. Each phase completes, the output integrates, and the next phase
starts without waiting for developer approval. The developer reviews the final
output rather than each intermediate artifact. Progress is visible throughout —
each phase start and completion is reported. The developer can cancel at any
time, which stops the current phase and prevents subsequent phases from
starting.

The standard autonomous sequence is: epic drafting → tech design → publish epic.
Implementation is not included in the default autonomous sequence — the developer
kicks it off explicitly after reviewing the spec pipeline output. The Steward
may include a PRD refinement step at the beginning of the sequence if it
identifies issues with the existing PRD.

1. Developer says "run the full spec pipeline for Feature 3"
2. Steward identifies the autonomous sequence based on existing artifacts
3. Steward reports the planned sequence ("I'll draft the epic, then tech design, then publish stories")
4. Phase 1 (epic drafting) dispatches as a background task
5. Phase 1 completes — output integrates, `chat:task-status` reports completion
6. Phase 2 (tech design) dispatches automatically
7. Phase 2 completes — output integrates, `chat:task-status` reports completion
8. Phase 3 (publish epic) dispatches automatically
9. Phase 3 completes — Steward notifies developer that the full sequence is done
10. Developer reviews the final output

#### Acceptance Criteria

**AC-4.1:** The developer can opt into autonomous mode through the chat

- **TC-4.1a: Autonomous request initiates sequence**
  - Given: A workspace with a PRD containing the target feature
  - When: The developer requests autonomous pipeline execution (e.g., "run the full spec pipeline for Feature 3")
  - Then: The Steward begins the autonomous sequence, dispatching the first applicable phase
- **TC-4.1b: Steward reports planned sequence**
  - Given: The developer has requested autonomous mode
  - When: The Steward is about to begin the sequence
  - Then: The Steward reports in the chat which phases will be executed and in what order

**AC-4.2:** In autonomous mode, phases execute sequentially without intermediate approval

- **TC-4.2a: Automatic phase progression**
  - Given: Autonomous mode is active and a phase has completed
  - When: The output is integrated
  - Then: The next phase in the sequence dispatches automatically without waiting for developer input
- **TC-4.2b: Output of each phase feeds the next**
  - Given: Autonomous mode is active
  - When: The Steward dispatches the next phase in the sequence
  - Then: The input context includes the output from the preceding phase
- **TC-4.2c: Correct phase ordering**
  - Given: Autonomous mode is active with the standard sequence
  - When: The phases execute
  - Then: The sequence follows the order: epic drafting → tech design → publish epic

**AC-4.3:** Autonomous mode progress is visible in the chat

- **TC-4.3a: Phase start reported**
  - Given: Autonomous mode is active
  - When: A new phase begins
  - Then: A `chat:task-status` message with `started` status is sent, including which phase of the total sequence this is (e.g., "Phase 2 of 3: Tech Design")
- **TC-4.3b: Phase completion reported**
  - Given: Autonomous mode is active
  - When: A phase completes
  - Then: A `chat:task-status` message with `completed` status is sent, including the output path
- **TC-4.3c: Sequence completion reported**
  - Given: Autonomous mode is active and the final phase completes
  - When: All phases in the sequence are done
  - Then: The Steward reports that the full sequence is complete and indicates the output artifacts

**AC-4.4:** The developer can cancel an autonomous run at any time

- **TC-4.4a: Cancel stops current phase**
  - Given: Autonomous mode is active and a phase is running
  - When: The developer cancels the autonomous run
  - Then: The currently running phase is terminated
- **TC-4.4b: Cancel prevents subsequent phases**
  - Given: Autonomous mode is active with two phases remaining
  - When: The developer cancels during the first remaining phase
  - Then: The second remaining phase does not start
- **TC-4.4c: Completed phases preserved**
  - Given: Autonomous mode has completed two phases and is running a third
  - When: The developer cancels
  - Then: Output from the first two completed phases remains on disk and in the manifest
- **TC-4.4d: Cancellation reported**
  - Given: The developer cancels an autonomous run
  - When: The cancellation takes effect
  - Then: The chat reports which phases completed and which was cancelled

**AC-4.5:** Autonomous mode stops on task failure

- **TC-4.5a: Failure halts sequence**
  - Given: Autonomous mode is active and a phase fails
  - When: The task's CLI process exits with an error
  - Then: Subsequent phases do not start
- **TC-4.5b: Failure reported with context**
  - Given: A phase in autonomous mode has failed
  - When: The failure notification is sent
  - Then: The `chat:task-status` message includes which phase failed, the error description, and which phases completed before the failure
- **TC-4.5c: Prior output preserved**
  - Given: Autonomous mode completed two phases and the third failed
  - When: The developer views the workspace
  - Then: Output from the first two completed phases remains on disk

### 5. Error Handling and Edge Cases

Errors in task management, dispatch, and execution produce visible feedback
without crashing the server, corrupting the workspace, or affecting other
running tasks.

#### Acceptance Criteria

**AC-5.1:** Task failure produces a notification in the chat with the error description

- **TC-5.1a: Failed task sends error notification**
  - Given: A background task is running
  - When: The task's CLI process exits with an error
  - Then: A `chat:task-status` message with `status: 'failed'` is sent, containing a human-readable error description
- **TC-5.1b: Failure does not crash server**
  - Given: A background task fails
  - When: The error is reported
  - Then: The server continues running; the foreground chat session is unaffected
- **TC-5.1c: Failure does not affect other running tasks**
  - Given: Two background tasks are running concurrently
  - When: One task fails
  - Then: The other task continues running; only the failed task's status changes

**AC-5.2:** Partial output from a failed task is preserved on disk

- **TC-5.2a: Partial files remain**
  - Given: A background task wrote partial output before failing
  - When: The task fails
  - Then: The partial output file remains on disk (not deleted)
- **TC-5.2b: Partial output not added to manifest**
  - Given: A package is open and a task fails with partial output
  - When: The failure is handled
  - Then: The partial output is not added to the package manifest (only successful completion triggers manifest update)

**AC-5.3:** All Epic 14 functionality is absent when the feature flag is disabled

- **TC-5.3a: No task infrastructure initialized**
  - Given: `FEATURE_SPEC_STEWARD` is disabled
  - When: The server starts
  - Then: No background task management infrastructure is initialized; no task-related resources are allocated
- **TC-5.3b: Task messages not processed**
  - Given: `FEATURE_SPEC_STEWARD` is disabled
  - When: A WebSocket client sends a `chat:task-cancel` message
  - Then: The message is rejected (the `/ws/chat` route does not exist when the flag is disabled)

**AC-5.4:** Duplicate task dispatch for the same phase and feature is rejected

- **TC-5.4a: Duplicate rejected**
  - Given: A background task is running for epic drafting of Feature A
  - When: The developer requests another epic drafting task for Feature A
  - Then: The duplicate is rejected with a `chat:error` message with code `TASK_ALREADY_RUNNING` identifying the existing task
- **TC-5.4b: Different phase allowed**
  - Given: A background task is running for epic drafting of Feature A
  - When: The developer requests tech design for Feature B
  - Then: The new task is dispatched (different phase/feature combination)
- **TC-5.4c: Same phase, different feature allowed**
  - Given: A background task is running for epic drafting of Feature A
  - When: The developer requests epic drafting for Feature B
  - Then: The new task is dispatched (different feature)

---

## Data Contracts

### New Client → Server Messages

```typescript
interface ChatTaskCancelMessage {
  type: 'chat:task-cancel';
  taskId: string;           // ID of the background task to cancel
}
```

Added to the `ChatClientMessage` discriminated union.

### New Server → Client Messages

```typescript
interface ChatTaskStatusMessage {
  type: 'chat:task-status';
  taskId: string;                  // Unique task identifier
  status: 'started' | 'running' | 'completed' | 'failed' | 'cancelled';
  phase: string;                   // Pipeline phase (e.g., 'epic', 'tech-design', 'publish', 'implementation')
  description: string;             // Human-readable task description
  elapsedMs?: number;              // Milliseconds since task started (present for running, completed, failed, cancelled)
  outputPath?: string;             // Path to output file (present on completed)
  error?: string;                  // Error description (present on failed)
  sequenceInfo?: {                 // Present when part of an autonomous run
    current: number;               // Current phase index (1-based)
    total: number;                 // Total phases in the sequence
    phaseName: string;             // Human-readable phase name
  };
}
```

Added to the `ChatServerMessage` discriminated union. `chat:task-status` is
distinct from `chat:status` — the latter reports provider lifecycle state
(starting, ready, crashed); `chat:task-status` reports background task
lifecycle.

The `chat:file-created` message (from Epic 12) is also sent when a completed
task creates output files, triggering the viewer refresh mechanism already
established.

### New Chat Error Codes

| Code | Description |
|------|-------------|
| `TASK_NOT_FOUND` | Task ID does not match any active or recent task |
| `TASK_LIMIT_REACHED` | Maximum concurrent background tasks already running |
| `TASK_ALREADY_RUNNING` | A task for this phase and feature is already in progress |
| `TASK_DISPATCH_FAILED` | Background task could not be started (CLI spawn failure) |

Added to the existing `ChatErrorCode` enum.

### Extended Script Execution Context

The `ScriptContext` from Epics 10, 12, and 13 is extended with task management
methods:

```typescript
interface ScriptContext {
  // Epic 10
  showNotification(message: string): void;
  // Epic 12
  getActiveDocumentContent(): Promise<string>;
  applyEditToActiveDocument(content: string): Promise<void>;
  openDocument(path: string): Promise<void>;
  // Epic 13 (assumed — from PRD Feature 13 scope)
  getPackageManifest(): Promise<object>;
  addPackageFile(path: string, content: string): Promise<void>;
  updateManifestEntries(entries: object[]): Promise<void>;
  // Epic 14 additions:
  dispatchTask(config: TaskDispatchConfig): Promise<string>;  // Returns task ID
  getRunningTasks(): Promise<TaskInfo[]>;
  cancelTask(taskId: string): Promise<void>;
}
```

```typescript
interface TaskDispatchConfig {
  phase: string;             // Pipeline phase identifier
  description: string;       // Human-readable task description
  inputPaths: string[];      // Paths to input artifact files
  outputPath: string;        // Where to write the output
  instructions?: string;     // Additional instructions (user feedback, custom guidance)
}

interface TaskInfo {
  taskId: string;
  phase: string;
  description: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;         // ISO 8601 UTC
  elapsedMs: number;
  outputPath?: string;       // Present on completed
}
```

- `dispatchTask(config)` dispatches a new background task and returns the task
  ID. The task runs as an isolated CLI process. The method validates inputs
  (paths must exist, output path must be within the workspace) and rejects
  if the concurrency limit is reached or a duplicate task exists.
- `getRunningTasks()` returns information about all active and recently completed
  tasks. The Steward uses this to answer "what's running?" queries.
- `cancelTask(taskId)` cancels a running task by ID. Returns a resolved promise
  on success; throws if the task is not found or already completed.

### Pipeline Phase Identifiers

| Phase ID | Description | Required Inputs |
|----------|-------------|-----------------|
| `epic` | Epic drafting (ls-epic) | PRD or feature section |
| `tech-design` | Technical design (ls-tech-design) | Epic |
| `publish` | Publish epic / story generation (ls-publish-epic) | Epic + tech design |
| `implementation` | Implementation (ls-team-impl) | Published stories + tech design |

The autonomous mode standard sequence is: `epic` → `tech-design` → `publish`.

---

## Dependencies

Technical dependencies:
- Epic 10 (chat plumbing) complete: feature flags, CLI provider abstraction, WebSocket streaming, script execution — the infrastructure this epic dispatches through
- Epic 11 (chat rendering and polish) complete: streaming markdown rendering — pipeline notifications render in the chat
- Epic 12 (document awareness and editing) complete: context injection, `chat:file-created` message, conversation persistence, local file navigation — used for output review and feedback
- Epic 13 (package and spec awareness) complete: package awareness, multi-file context, package operations, spec phase awareness, phase guidance — see Epic 13 Dependency Assumptions table
- Node.js `child_process` (built-in) for background task CLI process spawning
- Zod (existing) for new message schema validation
- Claude CLI installed on developer's machine

Process dependencies:
- None

---

## Non-Functional Requirements

### Task Isolation
- Background task CLI processes are isolated from each other and from the foreground interactive session
- A background task failure does not crash the server, affect other tasks, or interrupt the foreground session
- Background task processes are terminated on server shutdown (no orphaned processes)

### Performance
- Task dispatch (from request to `chat:task-status` started message) completes within 5 seconds
- Task status progress messages arrive at the client at least every 30 seconds while a task is running
- The foreground chat session adds no measurable latency due to background task management overhead
- Task cancellation takes effect within 10 seconds (the CLI process is terminated)

### Reliability
- If the server restarts while a background task is running, the task's CLI process is terminated (not orphaned); the task is reported as failed on the next session
- Concurrent background tasks do not interfere with each other's output files (path isolation)
- The concurrency limit prevents resource exhaustion from too many simultaneous CLI processes

### Feature Isolation
- All Epic 14 additions remain gated behind `FEATURE_SPEC_STEWARD`
- No background task infrastructure is initialized when the flag is disabled
- No new message types are processed when the flag is disabled

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. **Background worker process model:** How are background tasks executed? One CLI process per task? How are workers spawned, monitored, and cleaned up? What is the exact concurrency limit, and how is it determined (fixed constant, configurable, resource-based)?
2. **Task-to-CLI mapping:** How does the Steward construct CLI invocations for each pipeline phase? What flags, arguments, system prompts, and context are needed? Is each phase a separate `claude -p` invocation with specific skill instructions, or a different mechanism?
3. **Session management for background tasks:** Do background tasks use the foreground conversation's CLI session (`--resume`), get their own independent sessions, or run without session context? How does this affect the CLI's conversation history?
4. **Task state tracking:** Where is task state stored — in memory only, or persisted? How does the server reconstruct task state after a restart? The PRD says pipeline state persistence beyond conversation history is out of scope — does this mean tasks are purely in-memory?
5. **Output path conventions:** How are output file paths determined for each pipeline phase? By convention (e.g., `epics/<feature>/epic.md`), by the Steward's judgment, or by user specification? What happens if the output path already exists (overwrite, rename, error)?
6. **Context construction for pipeline phases:** How does the server build the prompt for each pipeline phase's CLI invocation? Does it embed the full input artifact content, pass file paths for the CLI to read, or use a combination?
7. **Autonomous mode sequencing:** How does the autonomous sequencer determine the next phase? Based on a predefined sequence, existing artifacts (Epic 13's awareness), or the Steward's judgment? How does it handle phases that may not be applicable?
8. **Manifest update mechanism:** When a background task creates output files, how is the package manifest updated? Through the script execution lane after task completion, a dedicated server-side mechanism, or delegated to the Steward's intelligence?
9. **Progress reporting mechanism:** How does the server determine progress for a long-running CLI process? Periodic elapsed-time polling, parsing CLI output for milestones, or a fixed heartbeat interval?
10. **Concurrent chat and background tasks:** When a background task is running, does the foreground chat session use a separate CLI process? How is contention between the foreground session and background tasks avoided at the process and file system level?
11. **Cancellation propagation to autonomous mode:** When the developer cancels during an autonomous run, how does the cancellation propagate — is there a separate "autonomous run" state that is cancelled, or is it just cancelling the current task with a flag to prevent the next one?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

**Delivers:** `ChatTaskStatusMessage` and `ChatTaskCancelMessage` Zod schemas,
`TaskDispatchConfig` and `TaskInfo` type definitions, new chat error codes
(`TASK_NOT_FOUND`, `TASK_LIMIT_REACHED`, `TASK_ALREADY_RUNNING`,
`TASK_DISPATCH_FAILED`), pipeline phase identifier constants, extended
`ScriptContext` interface with `dispatchTask`, `getRunningTasks`, `cancelTask`,
test fixtures (mock task status messages, sample task configs, mock CLI output
for pipeline phases).

**Prerequisite:** Epics 10, 11, 12, and 13 complete

**ACs covered:**
- Infrastructure supporting all ACs (type definitions, schemas, fixtures)

**Estimated test count:** 8–10 tests

### Story 1: Background Task Infrastructure

**Delivers:** The developer can dispatch background tasks, see their status in
the chat, cancel them, and continue chatting while they run. The server manages
background CLI processes with lifecycle tracking, periodic progress reporting,
and clean termination. Multiple concurrent tasks are supported up to the
configured limit.

**Prerequisite:** Story 0

**ACs covered:**
- AC-1.1 (concurrent chat during tasks)
- AC-1.2 (task status visibility)
- AC-1.3 (task cancellation)
- AC-1.4 (task lifecycle messages)
- AC-1.5 (concurrent task limit)
- AC-5.1 (failure notification)
- AC-5.2 (partial output preservation)
- AC-5.3 (feature flag gating)

**Estimated test count:** 25–30 tests

### Story 2: Pipeline Phase Dispatch

**Delivers:** The Steward dispatches specific Liminal Spec pipeline phases
(epic, tech design, publish, implementation) as background tasks with correct
input artifact resolution, prerequisite validation, and dispatch reporting.
Each phase receives the appropriate context. Duplicate dispatch for the same
phase and feature is rejected.

**Prerequisite:** Story 1

**ACs covered:**
- AC-2.1 (pipeline phase dispatch)
- AC-2.2 (input artifact context)
- AC-2.3 (prerequisite validation)
- AC-2.4 (dispatch detail reporting)
- AC-5.4 (duplicate task rejection)

**Estimated test count:** 18–22 tests

### Story 3: Results Integration and Approval

**Delivers:** When a pipeline task completes, the output file appears in the
workspace, the package manifest is updated (in package mode), and the Steward
notifies the developer. The developer reviews output and communicates feedback
through the chat. The Steward can dispatch the next phase on approval or
re-dispatch with feedback on change request.

**Prerequisite:** Story 2

**ACs covered:**
- AC-3.1 (output file integration)
- AC-3.2 (manifest update)
- AC-3.3 (completion notification)
- AC-3.4 (feedback through conversation)
- AC-3.5 (follow-on phase dispatch)
- AC-3.6 (re-dispatch with feedback)

**Estimated test count:** 18–22 tests

### Story 4: Autonomous Pipeline Execution

**Delivers:** The developer opts into autonomous mode. The Steward sequences
through pipeline phases (epic → tech design → publish) without intermediate
approval. Progress is visible throughout. The developer can cancel at any time.
Failure stops the sequence. Completed phase output is preserved regardless of
subsequent cancellation or failure.

**Prerequisite:** Story 3

**ACs covered:**
- AC-4.1 (autonomous mode opt-in)
- AC-4.2 (sequential phase execution)
- AC-4.3 (progress visibility)
- AC-4.4 (cancellation)
- AC-4.5 (failure stops sequence)

**Estimated test count:** 16–20 tests

---

## Validation Checklist

- [x] User Profile has all four fields + Feature Overview
- [x] Flows cover all paths (happy, alternate, cancel/error)
- [x] Every AC is testable (no vague terms)
- [x] Every AC has at least one TC
- [x] TCs cover happy path, edge cases, and errors
- [x] Data contracts are fully typed (message schemas, script context, error codes, phase identifiers)
- [x] Scope boundaries are explicit (in/out/assumptions)
- [x] Epic 13 dependency assumptions documented explicitly
- [x] Dependencies documented
- [x] Story breakdown covers all ACs (24 ACs mapped across Stories 0–4)
- [x] Stories sequence logically (infrastructure → task management → dispatch → integration → autonomous)
- [x] NFRs surfaced (task isolation, performance, reliability, feature isolation)
- [x] Tech design questions identified for downstream resolution (11 questions)
- [x] Extension points from Epics 10, 12, 13 identified (ChatServerMessage, ChatClientMessage, ScriptContext, ChatErrorCode)
- [x] Self-review complete
