# Story 3: Conversation Persistence

---

### Summary
<!-- Jira: Summary field -->

Conversation history persists per canonical workspace identity with CLI session ID continuity, incremental writes for crash recovery, workspace swap, clear, and corruption handling.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. The developer switches between documents and expects the Steward to track what's currently open. Mental model: "When I come back tomorrow, the conversation is still there."

**Objective:** Conversations persist across app restarts, keyed by canonical workspace identity — absolute folder path for regular workspaces, or the original package source path for opened packages. The CLI session ID is stored alongside the conversation so `--resume` maintains multi-turn context across restarts. Persistence is incremental (written on every message send and response completion) for crash recovery. Workspace switches swap the conversation and session ID. Clearing the conversation removes all persisted state.

**Scope:**

In scope:
- Conversation persistence service: load, save, swap, clear conversations as JSON files
- Canonical workspace identity resolution: `packageSourcePath` (Epic 9) → `lastRoot` fallback
- Conversation file storage: `<session-dir>/conversations/<sha256-prefix>.json`
- Atomic writes (temp file + rename) consistent with existing session persistence pattern
- Incremental persistence: write on every user message send and agent response completion (`chat:done`)
- CLI session ID persistence and swap: stored in conversation file, injected into provider manager on send
- Provider manager extensions: `setSessionId()`, `getSessionId()`, `cancelAndWait()` for workspace switch
- `chat:conversation-load` delivery on WebSocket connect and workspace change (replace semantics)
- Conversation load on connect: server always sends `chat:conversation-load` (even with empty messages array)
- Workspace switch during streaming: cancel completes before swap (synchronous with 6s timeout)
- Client `replaceConversation()` on chat state for atomic conversation swap
- Client conversation restoration: eager re-rendering all agent messages through markdown-it + shiki pipeline
- Clear conversation: removes file, sends `chat:conversation-load` with empty messages, resets session ID
- Corrupted/missing file handling: graceful degradation to empty state
Out of scope:
- Conversation search, filtering, or export (future)
- Conversation size pruning (future)

**Dependencies:**
- Story 0 complete (schemas, types, fixtures)
- Independent of Stories 1 and 2 for the service layer — but route integration reads from context injection (Story 1) for the `onDone` persistence path
- Epic 9 complete (package source path tracking in session state)

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### Conversation Service

New file: `app/src/server/services/conversation.ts`

```typescript
export class ConversationService {
  constructor(sessionDir: string);

  resolveIdentity(session: SessionState): string | null;
  async load(identity: string): Promise<PersistedConversation | null>;
  async addUserMessage(identity: string, message: PersistedMessage): Promise<void>;
  async addAgentMessage(identity: string, message: PersistedMessage): Promise<void>;
  async updateSessionId(identity: string, sessionId: string): Promise<void>;
  getSessionId(identity: string): string | null;
  async clear(identity: string): Promise<void>;
}
```

- File path: `<session-dir>/conversations/<sha256-prefix-16-hex>.json`
- Atomic writes: temp file + rename (consistent with `session.service.ts`)
- Identity resolution: `packageSourcePath` → `lastRoot` fallback
- In-memory caching of current conversation for fast reads
- Identity verification inside the file guards against hash collisions
- Version field enables future format migration

#### Persisted Conversation Format

```typescript
interface PersistedConversation {
  version: 1;
  workspaceIdentity: string;
  cliSessionId: string | null;
  messages: PersistedMessage[];
  updatedAt: string;   // ISO 8601 UTC
}

interface PersistedMessage {
  id: string;
  role: 'user' | 'agent' | 'error';
  text: string;
  timestamp: string;   // ISO 8601 UTC
  activeDocumentPath?: string;
}
```

#### Provider Manager Extensions

```typescript
// New methods
setSessionId(sessionId: string | null): void;
getSessionId(): string | null;
async cancelAndWait(): Promise<void>;  // 6s total timeout: 2s SIGINT + 2s SIGTERM + 2s SIGKILL
```

Session ID flow:
1. Route reads persisted session ID from `conversationService.getSessionId(identity)`
2. Route calls `providerManager.setSessionId(persistedId)`
3. `send()` uses `this.sessionId` for `--resume`
4. CLI `result` event updates `this.sessionId` internally (existing Epic 10 behavior)
5. On `onDone`, route reads `providerManager.getSessionId()` and persists via `conversationService.updateSessionId()`

#### WebSocket Route Extensions

- **Connection setup:** Load conversation on connect, send `chat:conversation-load` (always, even for empty)
- **Done handler:** Persist agent message text (accumulated), update session ID from provider manager
- **Clear handler:** Call `conversationService.clear()`, then send `chat:conversation-load` with empty messages
- **Workspace switch:** `cancelAndWait()` → save current → resolve new identity → load new → update session ID → send `chat:conversation-load`

Server accumulates token text in a per-message buffer (`accumulatedText[messageId]`) for persistence on `chat:done`.

#### Client Extensions

```typescript
// ChatStateStore extension
replaceConversation(
  messages: PersistedMessage[],
  workspaceIdentity: string,
): void;
```

Conversation restoration: eager re-render all agent messages through markdown-it + shiki pipeline on `chat:conversation-load`. Scroll to bottom after loading.

*See the tech design document for full architecture, implementation targets, and test mapping.*

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Conversation service implemented with load, save, swap, clear
- [ ] Canonical workspace identity resolution (folder path / package source path)
- [ ] Incremental persistence on every user send and agent done
- [ ] CLI session ID persists and swaps with workspace
- [ ] `cancelAndWait()` completes before workspace swap
- [ ] `chat:conversation-load` sent on connect and workspace change
- [ ] Client replaces conversation atomically on load
- [ ] Agent messages re-rendered through markdown pipeline on restore
- [ ] Clear removes file and sends empty conversation-load
- [ ] Corrupted/missing files handled gracefully
- [ ] `npm run build && npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes — 26 tests (18 conversation service + 8 ws-chat route), per test plan Chunk 3. Note: the ws-chat route tests include TC-4.2b (no conversation files when flag disabled) because the test lives in `ws-chat.test.ts`; the AC is owned by Story 4.
