# Epic 12: Document Awareness and Editing

This epic defines the complete requirements for making the Spec Steward
contextually aware of the active document and able to edit it through the chat
interface. It serves as the source of truth for the Tech Lead's design work.

---

## User Profile

**Primary User:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward
**Context:** Reading and working on markdown documents in the viewer while using the chat panel to ask questions about the content, request edits, and iterate on specs. The developer switches between documents and expects the Steward to track what's currently open.
**Mental Model:** "I'm reading a document, I ask the Steward about it, the Steward knows what I'm looking at and can change it for me. When I come back tomorrow, the conversation is still there."
**Key Constraint:** Vanilla JS frontend, no component framework. The CLI is a child process (stdin/stdout) with per-invocation spawning via `--print` mode and `--resume` for multi-turn context. Context injection is server-side — the client sends the document path, the server reads the content and constructs the prompt. Feature-flagged behind `FEATURE_SPEC_STEWARD`.

---

## Feature Overview

After this epic, the Steward knows what document the developer is looking at.
"Summarize this" responds about the active document. "Fix the table in section
3" edits the document and the viewer shows the updated content without a manual
refresh. Switching tabs updates the Steward's context — the next message is about
the new document, and the conversation can reference previously discussed
documents. The chat panel shows a context indicator so the developer always knows
what the Steward sees.

Conversations persist across app restarts. Reopening the app restores the
previous conversation for the active workspace. The CLI session ID is preserved
for multi-turn continuity. Conversations are keyed by a canonical workspace
identity — absolute folder path for regular workspaces, or the package source
path for opened packages — so conversations survive package re-extraction.

Links to local files in chat responses navigate within the viewer — clicking a
path opens the file in a tab.

---

## Scope

### In Scope

Single-document awareness, editing, and conversation persistence — the
intelligence layer on top of Epic 11's polished chat rendering:

- Document context injection: the server includes the active document's path and content in the prompt sent to the CLI provider
- Context indicator: the chat panel shows which document the Steward currently sees, updating on tab change
- Token budget management: large documents are truncated to fit within context limits, with the Steward informed of truncation
- Active-document editing through chat: the developer requests edits to the currently active document in natural language, the document is modified on disk, and the viewer refreshes
- Dirty-tab safety: Steward edits interact correctly with the existing external-change conflict model — clean tabs auto-refresh, dirty tabs trigger the conflict modal
- Edit notification: a `chat:file-created` message type notifies the client of document changes made by the Steward
- Canonical workspace identity: conversations are keyed by a stable identity — absolute folder path for regular workspaces, or the original package source path for opened packages — per the Technical Architecture's persistence design
- Conversation persistence: chat history stored as JSON files in the session storage directory, keyed by canonical workspace identity, with incremental writes for crash recovery
- CLI session ID persistence: the `--resume` session ID is stored alongside conversation history for multi-turn continuity across restarts
- Conversation load on connect: the server delivers persisted conversation to the client when the chat WebSocket connection is established or the workspace changes
- Local file navigation: relative and absolute file paths in chat responses that reference files within the current root are clickable links that open the file in a tab
- Script context extensions: new curated methods for the script execution sandbox — reading and editing the active document, opening files in the viewer

### Out of Scope

- Package-level awareness (Epic 13) — multi-file context, manifest operations, spec conventions, understanding package structure
- Creating new files or editing non-active files through chat (Epic 13) — the tech arch's `addPackageFile(path, content)` is a package operation
- Multi-file context within a single message (Epic 13) — "compare the PRD scope with the epic"
- Pipeline orchestration (Epic 14) — background tasks, autonomous pipeline execution
- Custom agent harnesses (future — uses CLI provider from Epic 10)
- Conversation search, filtering, or export (future)
- Conversation size pruning (future — conversations may grow; size management is a later concern)
- Inline diff display in the viewer showing what the Steward changed (future — the viewer shows the updated content, not a diff)
- Real-time context push on tab switch (context updates are attached to the next `chat:send`, not pushed independently)
- Unsaved editor content in context (the Steward sees the on-disk version of the document, not unsaved edits in Edit mode)

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Epic 10 (chat plumbing) and Epic 11 (chat rendering and polish) are complete | Unvalidated | Dev team | Epic 12 extends the provider context, script execution, and WebSocket schemas |
| A2 | The Claude CLI's `--resume` flag with a stored session ID provides multi-turn conversation continuity across restarts | Unvalidated | Tech Lead | The CLI manages its own conversation history; the server stores and passes the session ID |
| A3 | Including the full content of typical spec documents (under 5,000 lines / ~100KB) in the CLI prompt does not exceed the CLI's context limits | Unvalidated | Tech Lead | Large documents may require truncation; the token budget mechanism handles this |
| A4 | The session service (from Epic 9) tracks the package source path when a package is open, making canonical workspace identity resolution possible without new infrastructure | Unvalidated | Tech Lead | Epic 9 extracts packages to temp dirs and stores the source path in session state |
| A5 | Conversation JSON files at typical sizes (hundreds of messages) do not cause performance issues on read/write | Validated | — | JSON files for conversation history are consistent with the existing session persistence pattern |
| A6 | The existing external-change conflict model from Epic 5 (AC-6.1, AC-6.2) applies to Steward-originated edits — the file watcher treats them as external modifications | Unvalidated | Tech Lead | Steward edits write to disk; the watcher detects the change and applies the dirty/clean rules |

---

## Flows & Requirements

### 1. Document Context Awareness

The Steward receives the active document's path and content as context when the
developer sends a message. The chat panel displays a context indicator showing
which document the Steward sees. When the developer switches tabs, the context
indicator updates and the next message is sent with the new document's context.

1. Developer has a document open in the viewer
2. Developer sends a message in the chat
3. Client attaches the active document's path to the `chat:send` message context
4. Server reads the document content from disk
5. Server constructs the prompt with document path, content, and system instructions
6. Server passes the prompt to the CLI provider
7. CLI responds with awareness of the document content
8. Developer switches to a different tab
9. Context indicator updates to show the new document
10. Developer sends another message — the new document's content is attached

#### Acceptance Criteria

**AC-1.1:** The active document's content is included in the context sent to the CLI provider when a message is sent

- **TC-1.1a: Document context attached to message**
  - Given: A markdown document is open in the active tab
  - When: The developer sends a message
  - Then: The `chat:send` message includes the active document's path in its context field, and the server reads the document's content and includes it in the prompt to the CLI
- **TC-1.1b: Context contains correct document content**
  - Given: A markdown document with known content is open in the active tab
  - When: The developer sends a message
  - Then: The context passed to the CLI provider includes the file's on-disk content (verifiable by inspecting the provider's received context, not by asserting model response quality)
- **TC-1.1c: No document open**
  - Given: No tabs are open (empty content area)
  - When: The developer sends a message
  - Then: The message is sent without document context; the `context.activeDocumentPath` is `null`
- **TC-1.1d: Document in Edit mode**
  - Given: The active document is in Edit mode with unsaved changes
  - When: The developer sends a message
  - Then: The context includes the on-disk version of the document (last saved), not the unsaved editor content

**AC-1.2:** The chat panel displays a context indicator showing the active document

- **TC-1.2a: Indicator shows active document**
  - Given: A document is open in the active tab
  - When: The developer views the chat panel
  - Then: A context indicator is visible in the chat panel showing the filename (or relative path) of the active document. Exact placement within the panel is a tech design decision.
- **TC-1.2b: Indicator hidden when no document is open**
  - Given: No tabs are open
  - When: The developer views the chat panel
  - Then: The context indicator is hidden
- **TC-1.2c: Indicator updates on tab switch**
  - Given: Two documents are open in tabs
  - When: The developer switches from tab A to tab B
  - Then: The context indicator updates to show tab B's document
- **TC-1.2d: Indicator truncates long paths**
  - Given: The active document has a long path relative to the root
  - When: The developer views the context indicator
  - Then: The path is truncated with ellipsis; the full relative path is available in a tooltip

**AC-1.3:** The correct CLI session is resumed so the CLI has access to prior conversation turns

- **TC-1.3a: Session ID passed on subsequent messages**
  - Given: The developer has sent a message and received a response (establishing a CLI session)
  - When: The developer sends a follow-up message
  - Then: The CLI is invoked with `--resume` and the stored session ID, providing it access to prior conversation turns
- **TC-1.3b: Tab switch does not clear conversation**
  - Given: The developer has a multi-turn conversation about document A
  - When: The developer switches to document B
  - Then: The conversation history remains visible in the chat panel; the context indicator updates to show document B; prior messages about document A are still visible; the same CLI session is resumed

**AC-1.4:** Large documents are truncated to fit within the token budget

- **TC-1.4a: Document within budget included fully**
  - Given: The active document is 500 lines (well within the token budget)
  - When: The developer sends a message
  - Then: The full document content is included in the context
- **TC-1.4b: Large document truncated with notification**
  - Given: The active document exceeds the token budget (e.g., 15,000 lines)
  - When: The developer sends a message
  - Then: The document content is truncated, and the context sent to the CLI includes a note that the document was truncated (e.g., "Document truncated: showing first N lines of M total")
- **TC-1.4c: Context indicator shows truncation status**
  - Given: The active document was truncated due to token budget
  - When: The developer views the context indicator
  - Then: The indicator shows a visual cue that the document was truncated (e.g., "file.md (truncated)")

**AC-1.5:** Local file paths in chat responses navigate within the viewer

- **TC-1.5a: Relative path opens file in tab**
  - Given: An agent response contains a relative file path (e.g., `docs/spec.md`) that references a file within the current root
  - When: The developer clicks the path
  - Then: The file opens in a tab in the viewer (or activates the existing tab if already open)
- **TC-1.5b: Absolute path within root opens file**
  - Given: An agent response contains an absolute path that is within the current root
  - When: The developer clicks the path
  - Then: The file opens in a tab
- **TC-1.5c: Path outside root or nonexistent is not clickable**
  - Given: An agent response contains a file path that is outside the current root or does not exist on disk
  - When: The developer views the response
  - Then: The path renders as plain text, not a clickable link
- **TC-1.5d: External links still open in system browser**
  - Given: An agent response contains both local file paths and http/https URLs
  - When: The developer clicks an http URL
  - Then: The URL opens in the system browser (consistent with Epic 11 behavior); local file links open in the viewer

### 2. Document Editing Through Chat

The developer requests edits to the active document through natural language in
the chat. The Steward produces the edit, the server applies it to the file on
disk, and the viewer refreshes to show the updated content. Steward-originated
edits are treated as external file modifications for conflict-resolution
purposes — clean tabs auto-refresh, dirty tabs trigger the existing conflict
modal from Epic 5.

1. Developer is viewing a document with a formatting issue
2. Developer types "fix the table in section 3" in the chat
3. Steward reads the document content (already in context)
4. Steward produces an edit
5. Server applies the edit to the file on disk
6. Server sends a `chat:file-created` notification to the client
7. If the tab is clean: the viewer reloads the document automatically
8. If the tab is dirty: the existing conflict modal appears (Keep My Changes / Reload from Disk / Save Copy)
9. Chat shows confirmation that the edit was applied

#### Acceptance Criteria

**AC-2.1:** The developer can request edits to the active document through chat

- **TC-2.1a: Edit request modifies document on disk**
  - Given: A document is open in the active tab
  - When: The developer sends an edit request (e.g., "add a summary section at the top")
  - Then: The document file on disk is modified (verifiable by reading the file, independent of model response quality)
- **TC-2.1b: No document open — no edit applied**
  - Given: No tabs are open
  - When: The developer sends an edit request
  - Then: No file on disk is modified; the context sent to the CLI contains no active document (the CLI receives no document content to edit)

**AC-2.2:** Clean tabs auto-refresh after the Steward edits a document

- **TC-2.2a: Clean tab reloads automatically**
  - Given: The active tab has no unsaved edits (clean) and the Steward edits the document
  - When: The edit is applied to disk and `chat:file-created` is received
  - Then: The document in the viewer refreshes to show the updated content without the developer needing to manually refresh
- **TC-2.2b: Viewer shows rendered content, not raw diff**
  - Given: The Steward has edited the active document
  - When: The viewer refreshes
  - Then: The full rendered document is displayed (not a diff or patch view)

**AC-2.3:** Dirty tabs trigger the existing conflict modal when the Steward edits a document

- **TC-2.3a: Dirty tab shows conflict modal**
  - Given: The active tab has unsaved edits (dirty) and the Steward edits the same document
  - When: The edit is applied to disk and the file watcher detects the change
  - Then: The existing external-change conflict modal appears (Keep My Changes, Reload from Disk, Save Copy) — consistent with Epic 5 AC-6.1
- **TC-2.3b: Keep My Changes preserves local edits**
  - Given: The conflict modal is showing after a Steward edit
  - When: The developer clicks Keep My Changes
  - Then: The developer's unsaved edits are preserved; the Steward's changes are on disk but not loaded into the editor
- **TC-2.3c: Reload from Disk loads Steward's changes**
  - Given: The conflict modal is showing after a Steward edit
  - When: The developer clicks Reload from Disk
  - Then: The editor loads the Steward's version from disk; the developer's local edits are discarded
- **TC-2.3d: Save Copy preserves both versions**
  - Given: The conflict modal is showing after a Steward edit
  - When: The developer clicks Save Copy
  - Then: A Save As dialog opens. The developer saves their local edits to a different path. After saving, the editor reloads the Steward's version from disk. Both versions are preserved — consistent with Epic 5 TC-6.1d.

**AC-2.4:** An edit confirmation appears in the chat conversation

- **TC-2.4a: Successful edit emits file-created notification**
  - Given: The Steward has edited the active document
  - When: The edit is applied successfully
  - Then: A `chat:file-created` message is sent to the client with the edited file's path and the correlation message ID
- **TC-2.4b: Completed agent message exists after edit**
  - Given: The developer sent an edit request and the edit was applied
  - When: The Steward's response completes (`chat:done` received)
  - Then: A completed agent message (non-empty, `streaming: false`) is present in the conversation after the user's edit request
- **TC-2.4c: Edit failure reported in chat**
  - Given: The Steward attempts to edit a document but the write fails (e.g., permission denied)
  - When: The edit fails
  - Then: An error message appears in the chat indicating the edit could not be applied

**AC-2.5:** Multiple edits within a single Steward response apply sequentially

- **TC-2.5a: Sequential edits in one response**
  - Given: The developer sends "fix the heading and reformat the table"
  - When: The Steward applies two separate edits within a single response
  - Then: Both edits are applied to the document; the viewer refreshes after all edits in the response are complete

### 3. Conversation Persistence

Conversation history is stored as JSON files in the session storage directory,
keyed by the canonical workspace identity — the absolute folder path for regular
workspaces, or the original package source path for opened packages. The
conversation restores when the developer reopens the app with the same workspace.
The CLI session ID is persisted alongside the conversation so that `--resume`
maintains multi-turn context across restarts. Persistence is incremental — the
conversation file is written on every user message send and every response
completion (`chat:done`), so conversations survive crashes.

When the developer switches workspaces, the conversation swaps: the current
workspace's conversation is saved, the new workspace's conversation is loaded,
and the CLI session ID switches to match. If a response is streaming when the
workspace switches, it is cancelled first.

1. Developer has a multi-turn conversation with the Steward
2. Each message exchange is written to the conversation file incrementally
3. Developer quits the app
4. Developer relaunches the app with the same workspace
5. The server sends the persisted conversation to the client over WebSocket
6. The conversation appears in the chat panel
7. Developer sends a new message — the CLI resumes from the stored session ID
8. The Steward maintains context from the prior conversation

#### Acceptance Criteria

**AC-3.1:** Conversation history persists across app restarts for the same workspace

- **TC-3.1a: Conversation restored on relaunch**
  - Given: The developer had a 5-message conversation (3 user, 2 agent responses)
  - When: The app is quit and relaunched with the same workspace root
  - Then: The same 5 messages appear in the chat panel with their rendered content
- **TC-3.1b: Different workspace has separate conversation**
  - Given: The developer has conversations in workspace A and workspace B
  - When: The developer switches from workspace A to workspace B
  - Then: Workspace B's conversation loads; workspace A's conversation is preserved on disk
- **TC-3.1c: Switching workspaces swaps conversations**
  - Given: The developer is viewing workspace A's conversation
  - When: The developer switches the root to workspace B
  - Then: The chat panel replaces the conversation with workspace B's messages (or shows empty if workspace B has no conversation)
- **TC-3.1d: Conversation loads on WebSocket connect**
  - Given: A conversation file exists for the current workspace
  - When: The chat WebSocket connection opens (on app start or reconnect)
  - Then: The server sends a `chat:conversation-load` message with the persisted messages and workspace identity; the client replaces any local conversation state with the loaded messages

**AC-3.2:** Conversations are keyed by canonical workspace identity

- **TC-3.2a: Folder workspace uses absolute path**
  - Given: The workspace root is a regular folder at `/Users/dev/project`
  - When: The conversation is persisted
  - Then: The conversation file is keyed by the absolute folder path
- **TC-3.2b: Package workspace uses source path**
  - Given: A package `~/specs/project.mpk` is opened (extracted to a temp directory)
  - When: The conversation is persisted
  - Then: The conversation file is keyed by the package source path (`~/specs/project.mpk`), not the temp extraction path
- **TC-3.2c: Reopening same package restores conversation**
  - Given: A conversation exists for package `~/specs/project.mpk`
  - When: The package is closed and reopened (extracting to a new temp directory)
  - Then: The previous conversation is restored because the key is the stable source path

**AC-3.3:** The CLI session ID persists and swaps with workspace

- **TC-3.3a: Session ID passed on restart**
  - Given: A conversation with a stored CLI session ID exists for the current workspace
  - When: The developer sends a message after an app restart
  - Then: The CLI is invoked with `--resume` and the stored session ID
- **TC-3.3b: Workspace switch loads matching session ID**
  - Given: Workspace A has session ID "sess-A" and workspace B has session ID "sess-B"
  - When: The developer switches from workspace A to workspace B
  - Then: The next `chat:send` uses workspace B's session ID for `--resume`
- **TC-3.3c: Clear conversation clears session ID**
  - Given: The developer clears the conversation
  - When: The developer sends a new message
  - Then: The CLI starts a fresh session (no `--resume`); the new message is not influenced by the cleared conversation
- **TC-3.3d: Workspace switch during streaming cancels first**
  - Given: A response is actively streaming
  - When: The developer switches workspaces
  - Then: The streaming response is cancelled before the conversation swap occurs

**AC-3.4:** Conversation persistence is incremental for crash recovery

- **TC-3.4a: Messages survive app crash**
  - Given: The developer has sent 3 messages and received 3 responses
  - When: The app crashes (or the browser tab is forcefully closed)
  - Then: On relaunch, all 6 messages are restored (because each message was persisted as it was sent/received)
- **TC-3.4b: Partial response on crash**
  - Given: A response was streaming when the app crashed
  - When: The app relaunches
  - Then: Messages up to the last fully received response are restored; the partial streaming response is discarded

**AC-3.5:** Clear conversation clears all persisted state

- **TC-3.5a: Clear removes persisted messages**
  - Given: The developer has a persisted conversation
  - When: The developer triggers "clear conversation"
  - Then: The conversation file for the current workspace is cleared (messages removed, session ID discarded); the chat panel shows empty state
- **TC-3.5b: New messages after clear persist normally**
  - Given: The developer cleared the conversation and sends a new message
  - When: The message exchange completes
  - Then: The new conversation is persisted with a new session ID

**AC-3.6:** Corrupted or missing conversation files are handled gracefully

- **TC-3.6a: Missing conversation file**
  - Given: No conversation file exists for the current workspace
  - When: The app loads
  - Then: The chat panel shows empty state; no error
- **TC-3.6b: Corrupted conversation file**
  - Given: The conversation file exists but contains malformed JSON
  - When: The app loads
  - Then: The chat panel shows empty state; the corrupted file is reset; no crash
- **TC-3.6c: Conversation file references deleted session**
  - Given: The conversation file contains a CLI session ID that no longer exists in the CLI's session storage
  - When: The developer sends a message with `--resume`
  - Then: The CLI starts a fresh session; the developer sees the conversation history in the chat but the CLI does not have prior context. The stored session ID is updated with the new one.

### 4. Error Handling and Edge Cases

Errors in context injection, editing, and persistence produce visible feedback
without crashing the app or corrupting state.

#### Acceptance Criteria

**AC-4.1:** Document unavailable during context injection produces visible feedback

- **TC-4.1a: Active document deleted externally**
  - Given: The active tab's document was deleted on disk since it was opened
  - When: The developer sends a message
  - Then: The message is sent without document context; the context indicator shows that the document is unavailable
- **TC-4.1b: Document read fails**
  - Given: The active document exists but is unreadable (permission denied)
  - When: The developer sends a message
  - Then: The message is sent without document context; a warning appears in the context indicator

**AC-4.2:** All Epic 12 functionality is absent when the feature flag is disabled

- **TC-4.2a: No context indicator**
  - Given: `FEATURE_SPEC_STEWARD` is disabled
  - When: The app loads
  - Then: No context indicator, conversation persistence, or local file link navigation is active
- **TC-4.2b: No conversation files created**
  - Given: `FEATURE_SPEC_STEWARD` is disabled
  - When: The app runs
  - Then: No conversation JSON files are created in the session storage directory

---

## Data Contracts

### Extended ProviderContext

The `ProviderContext` interface, intentionally left empty in Epic 10, is extended
with document awareness fields:

```typescript
interface ProviderContext {
  activeDocument?: {
    path: string;            // Absolute path to the active document
    relativePath: string;    // Path relative to the workspace root
    content: string;         // Document content (may be truncated)
    truncated: boolean;      // True if content was truncated due to token budget
    totalLines?: number;     // Total line count (present when truncated)
  };
}
```

### Extended ChatSendMessage

The existing `ChatSendMessage` schema's optional `context` field is updated to
match the extended `ProviderContext`:

```typescript
interface ChatSendMessage {
  type: 'chat:send';
  messageId: string;
  text: string;
  context?: {
    activeDocumentPath: string | null;  // Absolute path or null if no document open
  };
}
```

The client sends only the path. The server reads the content, applies the token
budget, and constructs the full `ProviderContext` for the CLI provider. Document
content does not transit the WebSocket.

### New Server → Client Messages

```typescript
interface ChatFileCreatedMessage {
  type: 'chat:file-created';
  path: string;             // Absolute path of the modified file
  messageId: string;        // Correlation ID of the message that triggered the edit
}

interface ChatConversationLoadMessage {
  type: 'chat:conversation-load';
  workspaceIdentity: string;  // Canonical workspace identity this conversation belongs to
  messages: PersistedMessage[];
  cliSessionId: string | null;
}
```

Both added to the `ChatServerMessage` discriminated union.

`chat:file-created` aligns with the upstream contract name from the Technical
Architecture and Epic 10. It triggers an immediate document reload in the
viewer, bypassing the file-watch polling interval. The file watcher's
dirty/clean logic applies — clean tabs auto-refresh, dirty tabs show the
conflict modal.

`chat:conversation-load` delivers the persisted conversation to the client when
the WebSocket connection is established or the workspace changes. The
`workspaceIdentity` field allows the client to verify the loaded conversation
matches the current workspace. Semantics are **replace**: the client discards
any local conversation state and renders the loaded messages. The server sends
this message once on initial connection and once per workspace change, always
before any new `chat:token` messages for the new workspace.

### New Chat Error Codes

| Code | Description |
|------|-------------|
| `CONTEXT_READ_FAILED` | Server could not read the active document for context injection |
| `EDIT_FAILED` | Edit could not be written to disk |

Added to the existing `ChatErrorCode` enum.

### Extended Script Execution Context

The `ScriptContext` from Epic 10 is extended with document operations:

```typescript
interface ScriptContext {
  showNotification(message: string): void;
  // Epic 12 additions:
  getActiveDocumentContent(): Promise<string>;
  applyEditToActiveDocument(content: string): Promise<void>;
  openDocument(path: string): Promise<void>;
}
```

- `getActiveDocumentContent()` reads the currently active document from disk.
- `applyEditToActiveDocument(content)` replaces the currently active document's
  content and triggers a `chat:file-created` notification. Takes the full
  replacement content as a string. Scoped to the active document only —
  consistent with the Technical Architecture's recommendation for coarse-grained
  product actions over broad filesystem methods. Structured patch semantics are
  a potential future enhancement (see Tech Design Q9).
- `openDocument(path)` opens a file in the viewer (opens a new tab or activates
  an existing one). Path must be within the workspace root.

### Conversation Persistence Format

```typescript
interface PersistedConversation {
  version: 1;
  workspaceIdentity: string;      // Canonical identity (folder path or package source path)
  cliSessionId: string | null;    // Claude CLI session ID for --resume
  messages: PersistedMessage[];
  updatedAt: string;              // ISO 8601 UTC
}

interface PersistedMessage {
  id: string;                     // Message ID (matches WebSocket messageId)
  role: 'user' | 'agent' | 'error';
  text: string;                   // Raw markdown text
  timestamp: string;              // ISO 8601 UTC
  activeDocumentPath?: string;    // Document that was active when message was sent
}
```

Conversation files are stored at `<session-dir>/conversations/<encoded-identity>.json`.
The encoding of the workspace identity in the filename prevents path separator
issues. The exact encoding is a tech design decision.

**Persistence timing:** The conversation file is written on every message send
(user message added) and message complete (`chat:done` received, agent message
finalized). This incremental approach ensures crash recovery (consistent with
Epic 6's tab persistence pattern).

**Rendered HTML is NOT persisted.** On restore, completed agent messages are
re-rendered through the markdown-it pipeline. This avoids stale HTML from
theme changes or rendering pipeline updates between sessions.

### Canonical Workspace Identity

The workspace identity used for conversation keying:

| Workspace Type | Identity | Source |
|---------------|----------|--------|
| Regular folder | Absolute folder path (e.g., `/Users/dev/project`) | `sessionService.lastRoot` |
| Opened package | Package source path (e.g., `/Users/dev/specs.mpk`) | Session state from Epic 9 |

Resolution logic is a tech design decision. The session service already tracks
whether a package is open and its source path.

### Extended ChatMessage (Client State)

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'error';
  text: string;
  streaming: boolean;
  cancelled?: boolean;
  renderedHtml?: string;
  activeDocumentPath?: string;    // Epic 12: document context at time of message
}
```

### Keyboard Shortcut Map (Unchanged)

No new keyboard shortcuts are added by Epic 12. All existing shortcuts from
Epics 10 and 11 (Enter to send, Escape to cancel, panel toggle) remain.

---

## Dependencies

Technical dependencies:
- Epic 10 (chat plumbing) complete: feature flags, CLI provider, WebSocket chat, script execution
- Epic 11 (chat rendering and polish) complete: streaming markdown rendering, keyboard shortcuts, panel toggle
- Epic 5 (edit mode and document safety) complete: external-change conflict modal (AC-6.1, AC-6.2)
- Epic 9 (package viewer integration) complete: package source path tracking in session state
- Existing file-watch infrastructure (`/ws` route) for edit detection
- Existing session storage infrastructure for conversation file persistence
- Node.js `fs` (built-in) for conversation file I/O and document content reading

Process dependencies:
- None

---

## Non-Functional Requirements

### Context Injection Performance
- Reading the active document and constructing the prompt adds less than 500ms to message dispatch for documents under 5,000 lines
- Token budget evaluation (determining if truncation is needed) is synchronous and adds negligible latency

### Conversation Persistence
- Conversation file writes use atomic writes (write to temp, rename) consistent with the existing session persistence pattern
- Conversation file reads on startup add less than 200ms to chat panel initialization for conversations under 500 messages

### Edit Responsiveness
- The `chat:file-created` notification reaches the client within 100ms of the edit being written to disk
- The viewer refresh triggered by `chat:file-created` uses the same document reload mechanism as the file-watch infrastructure

### Feature Isolation
- All Epic 12 additions remain gated behind `FEATURE_SPEC_STEWARD`
- No conversation files are created when the flag is disabled
- No document content is read for context injection when the flag is disabled

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. **Token budget calculation:** What is the token budget for document content? How is it calculated — a fixed character/line limit, or a token-count estimate? Should the budget account for the CLI's own system prompt and conversation history overhead?
2. **Truncation strategy:** When a document exceeds the token budget, should truncation be from the end (first N lines), a representative sample (first + last), or section-based?
3. **Context construction:** How does the server construct the full prompt for the CLI? Is the document content prepended as a context block, or passed as a separate argument? What system prompt instructions does the Steward receive about its capabilities?
4. **Conversation file encoding:** How is the workspace identity encoded in the conversation filename? Base64? SHA-256 hash? URL encoding? The encoding must be filesystem-safe and deterministic.
5. **Canonical identity resolution:** How does the server resolve the canonical workspace identity? Does it check the session service for an active package, or is there a dedicated resolver? What happens during the transition between package-open and folder-browse modes?
6. **Edit mechanism:** How should the Steward produce edits — via the script execution lane, the CLI's built-in tools, or either? If script execution is preferred, how is the system prompt configured? If both are accepted, how does the server detect CLI-tool edits and send `chat:file-created`?
7. **Local file link detection:** How does the rendering pipeline detect local file paths in agent responses? Does it look for markdown links with relative paths, or also bare file paths? How are paths validated against the root?
8. **Conversation restoration rendering:** When restoring a conversation on startup, should all agent messages be re-rendered through the markdown pipeline immediately, or lazily? What's the performance characteristic for a 200-message conversation?
9. **Structured edit support:** The contract specifies full content replacement via `applyEditToActiveDocument(content: string)`. Should the tech design also support structured patches (line-range replacements, insertions) for efficiency, or is full replacement sufficient for the expected use cases?
10. **Workspace switch during streaming:** What is the exact cancellation sequence when the developer switches workspaces while a response is streaming? Does the cancel complete before the swap, or is it fire-and-forget?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

**Delivers:** Extended `ProviderContext` type with document fields,
`ChatFileCreatedMessage` and `ChatConversationLoadMessage` schemas,
`PersistedConversation` and `PersistedMessage` types, extended `ScriptContext`
interface with `applyEditToActiveDocument` and `getActiveDocumentContent`,
canonical workspace identity type, new error codes (`CONTEXT_READ_FAILED`,
`EDIT_FAILED`), conversation file path utilities, test fixtures (sample
conversation files, large documents for token budget testing).

**Prerequisite:** Epics 10 and 11 complete

**ACs covered:**
- Infrastructure supporting all ACs (type definitions, schemas)

**Estimated test count:** 8-10 tests

### Story 1: Context Injection and Indicator

**Delivers:** The Steward receives the active document's content with each
message. The chat panel shows a context indicator with the active document
name. The context indicator updates on tab switch. Token budget management
truncates large documents.

**Prerequisite:** Story 0

**ACs covered:**
- AC-1.1 (document context in messages)
- AC-1.2 (context indicator UI)
- AC-1.4 (token budget and truncation)

**Estimated test count:** 14-18 tests

### Story 2: Document Editing and Dirty-Tab Safety

**Delivers:** The developer requests edits through chat, the document is
modified on disk, and the viewer refreshes. Clean tabs auto-refresh; dirty
tabs trigger the existing conflict modal. Script context method
`applyEditToActiveDocument` is implemented. Edit confirmation and error
reporting in chat.

**Prerequisite:** Story 1

**ACs covered:**
- AC-2.1 (edit requests via chat)
- AC-2.2 (clean tab auto-refresh)
- AC-2.3 (dirty tab conflict modal)
- AC-2.4 (edit confirmation in chat)
- AC-2.5 (multiple edits)

**Estimated test count:** 16-20 tests

### Story 3: Conversation Persistence

**Delivers:** Conversation history persists per canonical workspace identity.
CLI session ID persists for `--resume` continuity. Incremental writes for
crash recovery. Workspace switching swaps conversations and session IDs.
Clear conversation clears persisted state. Corrupted file handling. Package
source path keying.

**Prerequisite:** Story 0 (independent of Stories 1 and 2)

**ACs covered:**
- AC-3.1 (conversation persists across restarts)
- AC-3.2 (canonical workspace identity keying)
- AC-3.3 (session ID persistence and workspace swap)
- AC-3.4 (incremental persistence / crash recovery)
- AC-3.5 (clear conversation clears state)
- AC-3.6 (corrupted file handling)

**Estimated test count:** 20-24 tests

### Story 4: Local File Links and Error Handling

**Delivers:** Local file paths in chat responses are clickable links that open
files in the viewer. CLI session continuity enables access to prior conversation
turns. Error handling for context injection failures. Feature isolation
verification.

**Prerequisite:** Stories 1 and 3

**ACs covered:**
- AC-1.3 (CLI session continuity for cross-document reference)
- AC-1.5 (local file navigation)
- AC-4.1 (context injection errors)
- AC-4.2 (feature isolation)

**Estimated test count:** 12-16 tests

---

## Amendments

### Amendment 1: Codex R1 verification findings incorporated (Round 1)

**Source:** External review (Codex), `verification/codex/epic-review-r1.md`

**Changes:**
- [C1] Pulled canonical workspace identity (folder path OR package source path) into Epic 12 scope. Added AC-3.2 with package-mode TCs. Updated `PersistedConversation` and `ChatConversationLoadMessage` to use `workspaceIdentity`. Added Canonical Workspace Identity table to Data Contracts. Removed "Package-source-path conversation keying (Epic 13)" from Out of Scope. Updated A4 for package source path tracking.
- [C2] Removed file creation and non-active-file editing from scope. Renamed `applyEdit(path, content)` to `applyEditToActiveDocument(edit)`. Removed TC-2.4b (edit to non-active file). Added "Creating new files" to Out of Scope. Aligned script context with tech arch's recommendation for coarse-grained product actions.
- [C3] Added AC-2.3 (dirty-tab conflict modal interaction) with TCs for Keep/Reload behavior. Updated AC-2.2 to explicitly cover clean-tab-only auto-refresh. Added A6 for external-change conflict model applicability. Added Epic 5 to Dependencies.
- [M1] Added `workspaceIdentity` field to `ChatConversationLoadMessage`. Specified replace semantics and delivery ordering rules. Updated TC-3.1d to verify workspace identity and replace behavior.
- [M2] Added TC-3.3b (workspace switch loads matching session ID) and TC-3.3d (streaming cancelled on switch). Updated AC-3.3 prose to cover workspace swap of session IDs.
- [M3] Recast model-dependent TCs around deterministic guarantees: TC-1.1b tests that correct content is in context (not model response quality), TC-1.3a tests session ID is passed (not model recall), removed TC-3.2a's model-quality assertion.
- [M4] Renamed `chat:file-modified` to `chat:file-created` to align with upstream contract in Technical Architecture and Epic 10. Removed `created` boolean flag (upstream name covers both create and modify semantics).
- [M5] Removed conversation pruning from NFRs. Added to Out of Scope as a future concern.
- [M6] Removed implementation preferences from Assumptions (A4 script-execution-as-primary). Removed system prompt instruction details. Kept data contracts (TypeScript interfaces) as contracts, not implementation. Converted edit mechanism preference to Tech Design Question 6. Kept `DocumentEdit` shape as tech design decision (Q9).
- [m1] Relaxed TC-1.2a placement language to "visible in the chat panel" with placement deferred to tech design. Removed Q9 (placement question now addressed by relaxed wording).
- [m2] Picked single behaviors: TC-1.2b indicator is hidden (not ambiguous); TC-2.5a (was TC-2.4a) refreshes once after all edits complete.

### Amendment 2: Codex R2 re-review findings incorporated (Round 2)

**Source:** External review (Codex), `verification/codex/epic-review-r2.md`

**Changes:**
- [M1] Added TC-2.3d (Save Copy branch for Steward-edit triggered conflict modal), referencing Epic 5 TC-6.1d for consistent behavior.
- [M2] Aligned Flow 3 prose with Data Contracts: persistence writes on user message send and response completion (`chat:done`), not on every token. Consistent single model throughout.
- [M3] Resolved undefined `DocumentEdit` type: changed `applyEditToActiveDocument(edit: DocumentEdit)` to `applyEditToActiveDocument(content: string)` — full replacement with a string. Removed undefined type from the contract. Updated Tech Design Q9 to ask about structured patches as an enhancement, not a contract shape.
- [M4] Recast TC-2.1b as deterministic: "no file on disk is modified; context contains no active document" instead of asserting model wording. Recast TC-2.4a as deterministic: "`chat:file-created` message sent with path and correlation ID" instead of asserting Steward describes the change.
- [m1] Aligned Story 4 description with rewritten AC-1.3: "CLI session continuity enables access to prior conversation turns" instead of "cross-document reference works via --resume."

### Amendment 3: Codex R3 finding incorporated (Round 3)

**Source:** External review (Codex), `verification/codex/epic-review-r3.md`

**Changes:**
- [M1] Split TC-2.4a into two TCs: TC-2.4a checks `chat:file-created` transport (deterministic), TC-2.4b checks that a completed agent message exists in the conversation after the edit request (chat-state check). Renumbered TC-2.4b (edit failure) to TC-2.4c. This restores coverage for AC-2.4's promise that "confirmation appears in the chat conversation" while keeping both TCs verifiable without asserting model wording.

---

## Validation Checklist

- [x] User Profile has all four fields + Feature Overview
- [x] Flows cover all paths (happy, alternate, cancel/error)
- [x] Every AC is testable (no vague terms)
- [x] Every AC has at least one TC
- [x] TCs cover happy path, edge cases, and errors
- [x] Data contracts are fully typed
- [x] Scope boundaries are explicit (in/out/assumptions)
- [x] Dependencies documented (including Epic 5 for conflict model, Epic 9 for package identity)
- [x] Story breakdown covers all ACs
- [x] Stories sequence logically (foundation → context → editing → persistence → links + errors)
- [x] NFRs surfaced (context injection performance, persistence reliability, edit responsiveness)
- [x] Tech design questions identified for downstream resolution (10 questions)
- [x] Extension points from Epics 10-11 identified (ProviderContext, ScriptContext, ChatServerMessage)
- [x] Conversation persistence follows established patterns (atomic writes, incremental, corruption recovery)
- [x] Canonical workspace identity covers both folders and packages (tech arch alignment)
- [x] Dirty-tab safety integrates with Epic 5 conflict model
- [x] Message naming aligns with upstream contracts (`chat:file-created`)
- [x] Model-dependent TCs recast as deterministic guarantees
- [x] Script context methods follow tech arch coarse-grained product action recommendation
- [x] Self-review complete
- [x] Verification round 1 complete (Codex)
- [x] All Critical, Major, and Minor findings from round 1 addressed
- [x] Verification round 2 complete (Codex)
- [x] All Major and Minor findings from round 2 addressed
- [x] Verification round 3 complete (Codex)
- [x] All Major findings from round 3 addressed
