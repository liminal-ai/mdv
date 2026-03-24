# Epic 12 Review R1

## Critical

### [C] Package identity and package-mode support are pushed out of Epic 12 even though upstream artifacts place them here

- **Reference:** Scope `Out of Scope` ("Package-source-path conversation keying (Epic 13)"), Scope `In Scope` conversation persistence keyed by workspace root path, Flow 3, `PersistedConversation.rootPath`
- **Issue:** The draft treats package-source-path keying as an Epic 13 concern and consistently models persistence around a workspace root path only. That conflicts with the v2 PRD Feature 12, which says document editing works on "regular files or files within a package" and that conversation history persists "per folder or per package." It also conflicts with `technical-architecture.md`, which explicitly chooses a stable canonical identity of absolute folder path **or package source path**, and says conversation state must never be keyed to extracted temp directories.
- **Why it matters:** This would send tech design toward the wrong persistence identity and leave package-backed documents underspecified in the first "document awareness" epic. A package reopened through a new extraction path would lose or mis-associate its conversation, which is a functional break, not a nice-to-have.
- **Suggested fix:** Pull package-source-path identity into Epic 12. Update scope, ACs/TCs, and persistence contracts to cover both folder workspaces and opened packages. Replace `rootPath`-only language with a canonical workspace identity contract that can represent either an absolute folder path or a package source path, and add explicit package-mode TCs for context injection, editing, and conversation restore.

### [C] The draft expands Epic 12 from active-document editing into arbitrary file creation and broad path-based writes

- **Reference:** Scope `In Scope` ("File creation through chat"), AC-2.4b, `ScriptContext.applyEdit(path, content)`, `openDocument(path)`
- **Issue:** Epic 12 in the PRD is scoped to single-document awareness and editing. The draft adds creating new files in the workspace root and editing files other than the active document. It also defines a raw path-based edit primitive (`applyEdit(path, content)`) instead of an active-document-scoped operation. That is both scope drift and a mismatch with `technical-architecture.md`, which recommends coarse product actions such as `applyEditToActiveDocument(edit)` and explicitly warns against broad filesystem-like methods.
- **Why it matters:** This pushes implementation toward a much larger mutation surface than the milestone calls for. It also blurs the intended boundary with Epic 13, where package/folder operations and multi-file behavior are supposed to begin.
- **Suggested fix:** Remove file creation and arbitrary non-active-file mutation from Epic 12. Constrain the functional scope and the script/tool surface to editing the currently active document only. If non-active-file creation/editing is required, move it to Epic 13 and keep Epic 12's script contract coarse-grained and active-document-scoped.

### [C] Auto-refresh after Steward edits conflicts with the existing dirty-file safety model and leaves a data-loss hole

- **Reference:** AC-2.2a, AC-2.2b, AC-2.4a, `Out of Scope` ("Unsaved editor content in context"), cross-check with v1 Epic 5 Story 5 AC-6.1/AC-6.2
- **Issue:** The draft says the viewer refreshes automatically after the Steward edits a document, but it never specifies what happens if the target tab has unsaved local edits. v1 already established the rule that external file changes auto-reload only when the tab is clean, and must show a conflict modal when the tab is dirty. The draft acknowledges unsaved content is out of scope for context injection, but it says nothing about unsaved content during edit application.
- **Why it matters:** Without an explicit rule, tech design could implement "always refresh" and silently discard in-memory edits, directly violating the app's existing document-safety contract.
- **Suggested fix:** Add explicit ACs/TCs for dirty-state interaction: clean tabs auto-refresh; dirty tabs reuse the existing external-change conflict flow; background dirty tabs are protected the same way; Steward-originated edits are treated as external modifications for conflict purposes unless the spec intentionally chooses a different rule.

## Major

### [M] The conversation-load WebSocket contract is incomplete for reconnect and workspace-switch scenarios

- **Reference:** AC-3.1d, `ChatConversationLoadMessage`, `Conversation Load API`
- **Issue:** `chat:conversation-load` has no identity field, no replace-vs-append semantics, and no sequencing rules relative to reconnects, workspace switches, or already-rendered local state. The `ls-epic` guidance explicitly calls out message sequencing, correlation, and upsert-vs-append semantics for real-time contracts; this draft leaves those undefined.
- **Why it matters:** On reconnect, the client cannot know whether to replace the current conversation, merge it, or ignore the payload. That invites duplicate histories, cross-workspace bleed, or lost local state depending on how the client is implemented.
- **Suggested fix:** Extend the contract with the canonical workspace/package identity, explicit `mode: 'replace'`, and delivery rules such as "sent on initial load and workspace-identity change before any new live messages." Add TCs for reconnect and workspace switch to verify replacement behavior.

### [M] Workspace switching covers message history but not provider-session isolation

- **Reference:** AC-3.1b, AC-3.1c, AC-3.2, `PersistedConversation.cliSessionId`
- **Issue:** The draft specifies that switching workspaces swaps the visible conversation, but it does not specify what happens to the active Claude `sessionId` when the root/workspace changes. Since Epic 10's provider manager is built around a stored session ID used with `--resume`, this omission is material.
- **Why it matters:** The UI could show workspace B's conversation while the next `chat:send` still resumes workspace A's Claude session. That would leak context across workspaces and undermine the whole "conversation is scoped per workspace/package" model.
- **Suggested fix:** Add explicit ACs/TCs that workspace/package switch loads the matching persisted `cliSessionId` (or `null`), and that switching back restores the previous workspace's session. Also specify behavior if a switch happens while a response is in progress.

### [M] Several core ACs depend on model quality instead of deterministic system behavior

- **Reference:** TC-1.1b, AC-1.3 / TC-1.3a, AC-3.2 / TC-3.2a
- **Issue:** Assertions such as "the response summarizes the active document," "the Steward can reference content from document A," and "the CLI has access to the prior conversation context" are written as semantic outcomes from the model, not as product behaviors the system can deterministically prove.
- **Why it matters:** These are weak acceptance targets for tech design and downstream tests. A compliant implementation could fail because of prompt/model variance, while a broken implementation could occasionally pass by accident.
- **Suggested fix:** Recast these ACs around deterministic guarantees: the correct document context is attached, the correct session is resumed, prior turns are preserved, and controlled fixture prompts or provider-call assertions verify that the right context was supplied. Keep semantic examples as illustrative notes, not primary pass/fail criteria.

### [M] The new file-change message name diverges from the upstream Epic 10 / architecture contract

- **Reference:** Scope `In Scope` ("Edit notification: a `chat:file-modified` message type"), `ChatFileModifiedMessage`, cross-check with `technical-architecture.md` and Epic 10 Data Contracts
- **Issue:** Upstream v2 artifacts already use `chat:file-created` as the future message name for "created/modified by the agent" notifications. This draft introduces a different message type name, `chat:file-modified`, while also using a `created` flag.
- **Why it matters:** That is a straight coherence problem across artifacts. It forces downstream design to decide which contract is real, and it increases the chance that server/client/message-schema work diverges from Epic 10's extension point.
- **Suggested fix:** Align the message naming with the upstream contract. Either keep `chat:file-created` with a `created` boolean, or amend the upstream docs and rename the family consistently everywhere before this epic proceeds.

### [M] The spec introduces conversation pruning in NFRs without any functional rules or test coverage

- **Reference:** Non-Functional Requirements `Conversation Persistence` ("maximum message count ... triggers oldest-message pruning")
- **Issue:** Pruning is a user-visible behavior that changes restore semantics, but it appears only as an NFR note. There is no scope item, AC, TC, or data-contract rule for what gets pruned, when, or how that interacts with `cliSessionId` continuity.
- **Why it matters:** Tech design would have to invent product behavior that the spec has not approved. It also creates hidden tension with the promise that conversations persist and restore across restarts.
- **Suggested fix:** Either remove pruning from Epic 12 and leave it for a later iteration, or promote it into the functional spec with explicit pruning rules, user-visible consequences, and TCs.

### [M] The epic is more technical than the methodology calls for, and the technical detail is not neutral

- **Reference:** User Profile `Key Constraint`, Assumption A4, `Extended Script Execution Context`, `Conversation Load API`
- **Issue:** The draft doesn't just define contracts; it prescribes a preferred implementation strategy: script execution as the primary edit lane, specific VM method names, WebSocket-based restore instead of other possible shapes, and prompt-level instructions about tool preference. The `ls-epic` skill explicitly says implementation choices belong in tech design unless they are external contracts or hard constraints.
- **Why it matters:** This narrows the tech-design space prematurely and mixes "what the system must do" with "how we think we might do it." It is especially risky where the chosen detail is itself debatable, such as script-vs-tool edit routing.
- **Suggested fix:** Keep only the externally observable contracts and constraints in the epic. Move edit-lane preference, VM method shape, and prompt-construction strategy into tech design questions or the downstream tech design itself.

## Minor

### [m] The spec both fixes and defers context-indicator placement

- **Reference:** TC-1.2a, Tech Design Question 9
- **Issue:** TC-1.2a says the context indicator appears "below the chat header," but Tech Design Question 9 reopens the placement decision by asking whether it belongs inside the header, below it, or integrated with the input area.
- **Why it matters:** It is a small but real inconsistency. The epic should either specify the placement or leave it for tech design, not both.
- **Suggested fix:** Choose one. If placement is product-significant, keep it in the AC and remove the question. If it is implementation/UI composition detail, relax the AC wording and leave the question.

### [m] A few ACs/TCs allow multiple different UX outcomes instead of specifying one

- **Reference:** TC-1.2b ("shows 'No document selected' or is hidden"), TC-2.4a ("refreshes after each edit (or once after all edits)")
- **Issue:** These tests currently allow materially different behaviors.
- **Why it matters:** Even small "A or B" specs create downstream ambiguity and make UX regressions hard to call.
- **Suggested fix:** Pick a single expected behavior for each case, or explicitly document the decision as deferred to tech design if it is not important at epic level.

## What Else I Noticed But Chose Not To Report

- The local-file-link feature is plausibly placed here because Epic 11 explicitly deferred in-viewer navigation for chat links to Epic 12; I did not report it as scope drift even though it adds meaningful client behavior.
- The draft generally does a good job extending Epic 10/11 terminology instead of inventing a totally separate chat model; the main problem is where it diverges from those contracts, not that it ignores them wholesale.
- The review above does not treat the missing `~/.claude/skills/liminal-spec/ls-epic/SKILL.md` path as a finding against the epic itself. I used the available `ls-epic` copy in `/Users/leemoore/.codex/skills/ls-epic/SKILL.md` as the methodology reference.
