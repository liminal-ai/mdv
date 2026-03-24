# Test Plan: Document Awareness and Editing (Epic 12)

Companion to `tech-design.md`. This document provides complete TC→test mapping, mock strategy, fixtures, and chunk breakdown with test counts.

---

## Mock Strategy

### Mock Boundaries

Tests mock at external boundaries only. Internal modules are exercised through their entry points.

| Boundary | Mock? | Why |
|----------|-------|-----|
| `fs/promises` (readFile, writeFile, rename, mkdir, unlink) | Yes | Filesystem — control document content and persistence |
| `child_process.spawn` | Yes (inherited from Epic 10) | External CLI process |
| `vm.runInNewContext` | No (but controllable) | Internal — test real VM, control script input |
| WebSocket connections (client) | Yes | Network boundary |
| `localStorage` | Yes (jsdom provides) | Browser API |
| `fetch` (client) | Yes | Network boundary |
| `crypto.randomUUID` | No | Standard API |
| `crypto.createHash` | No | Deterministic, part of what we're testing |
| Internal modules (ConversationService, ContextInjection, etc.) | No | These are what we're testing |

### Server Test Pattern

Server tests use Fastify's `inject()` for HTTP and direct WebSocket connections. Context injection and conversation service tests mock `fs/promises` for filesystem operations.

```typescript
// Server test setup pattern — context injection
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
}));
```

### Client Test Pattern

Client tests use jsdom. The chat panel creates DOM dynamically (no chat elements in initial HTML). Tests call `mountChatPanel()` or individual component mount functions and assert on resulting DOM.

```typescript
// Client test setup pattern
import { JSDOM } from 'jsdom';

let dom: JSDOM;
beforeEach(() => {
  dom = new JSDOM(`<div id="main"><div id="workspace"></div></div>`, {
    url: 'http://localhost:3000',
  });
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
});
```

---

## Test Fixtures

```typescript
// app/tests/fixtures/conversation.ts

import type {
  PersistedConversation,
  PersistedMessage,
} from '../../src/server/schemas/index.js';

// --- Persisted Conversations ---

export function createPersistedConversation(
  overrides?: Partial<PersistedConversation>,
): PersistedConversation {
  return {
    version: 1,
    workspaceIdentity: '/Users/dev/project',
    cliSessionId: 'sess-test-001',
    messages: [
      createUserMessage(),
      createAgentMessage(),
    ],
    updatedAt: '2026-03-23T12:00:00.000Z',
    ...overrides,
  };
}

export function createUserMessage(
  overrides?: Partial<PersistedMessage>,
): PersistedMessage {
  return {
    id: 'msg-user-001',
    role: 'user',
    text: 'Summarize this document',
    timestamp: '2026-03-23T12:00:00.000Z',
    activeDocumentPath: '/Users/dev/project/docs/spec.md',
    ...overrides,
  };
}

export function createAgentMessage(
  overrides?: Partial<PersistedMessage>,
): PersistedMessage {
  return {
    id: 'msg-agent-001',
    role: 'agent',
    text: 'This document describes the project requirements...',
    timestamp: '2026-03-23T12:00:01.000Z',
    ...overrides,
  };
}

export function createErrorMessage(
  overrides?: Partial<PersistedMessage>,
): PersistedMessage {
  return {
    id: 'msg-error-001',
    role: 'error',
    text: 'Provider crashed unexpectedly',
    timestamp: '2026-03-23T12:00:02.000Z',
    ...overrides,
  };
}

// --- Document Content ---

export const SMALL_DOCUMENT = `# Test Document

## Section 1

This is a test document for context injection testing.

## Section 2

| Column A | Column B |
|----------|----------|
| Value 1  | Value 2  |
`;

export const LARGE_DOCUMENT = 'x'.repeat(150_000); // Exceeds token budget

export const DOCUMENT_WITH_TABLE_ERROR = `# Document

## Section 3

| Broken | Table
| Missing | Closing |
`;

// --- Workspace Identities ---

export const FOLDER_IDENTITY = '/Users/dev/project';
export const PACKAGE_IDENTITY = '/Users/dev/specs/project.mpk';
export const FOLDER_IDENTITY_HASH = 'a3f8b2c1d4e5f6a7'; // SHA-256 prefix (first 16 hex chars)
```

---

## TC → Test Mapping

### Context Injection Tests

#### `tests/server/services/context-injection.test.ts` — 10 tests

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.1a | Document context attached — file read and included | Mock `readFile` returns content | `buildInjectedContext` result contains document block |
| TC-1.1b | Context contains correct document content | Mock `readFile` returns known content | User message contains the exact file content in `<active-document>` block |
| TC-1.1c | No document open — no context | Call with `activeDocumentPath: null` | User message is just the user text, no document block |
| TC-1.1d | Document in Edit mode — on-disk content used | Mock `readFile` returns on-disk content | Context contains on-disk content (tested via mock, not editor state) |
| TC-1.4a | Document within budget included fully | Mock `readFile` returns 500-line doc | Content not truncated, `truncated: false` |
| TC-1.4b | Large document truncated with notification | Mock `readFile` returns 150K chars | Content truncated, truncation notice appended, `truncated: true` |
| TC-1.4c | Context indicator shows truncation | (Client-side — see context-indicator tests) | — |
| TC-4.1a | Active document deleted externally | Mock `readFile` throws ENOENT | Throws `ContextReadError` |
| TC-4.1b | Document read fails (permission denied) | Mock `readFile` throws EACCES | Throws `ContextReadError` |
| Non-TC | System prompt contains Steward instructions | Call `buildSystemPrompt()` | Contains script method instructions, edit conventions |

#### `tests/client/steward/context-indicator.test.ts` — 6 tests

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.2a | Indicator shows active document | Mount indicator, call `update("docs/spec.md", false)` | Path text visible, container shown |
| TC-1.2b | Indicator hidden when no document | Mount indicator, call `update(null, false)` | Container hidden |
| TC-1.2c | Indicator updates on tab switch | Mount indicator, call `update` with different paths | Path text changes |
| TC-1.2d | Long path truncated with tooltip | Mount indicator, call `update` with long path | CSS text-overflow ellipsis applied, `title` attribute has full path |
| TC-1.4c | Truncation status shown | Mount indicator, call `update("spec.md", true)` | "(truncated)" element visible |
| Non-TC | Truncation status hidden when not truncated | Mount indicator, call `update("spec.md", false)` | "(truncated)" element hidden |

### Document Editing Tests

#### `tests/server/services/script-executor.test.ts` — 8 tests (Epic 12 additions)

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-2.1a | Edit request modifies document on disk | Execute script calling `applyEditToActiveDocument` | `writeFile` and `rename` called with correct args |
| TC-2.1b | No document open — no edit | Script context built with `null` path, script calls `applyEditToActiveDocument` | Error thrown, no filesystem writes |
| TC-2.4a | Successful edit emits file-created notification | Execute edit script | `onFileCreated` callback called with path |
| TC-2.4c | Edit failure reported | Mock `writeFile` throws | Script result is `{ success: false, error: ... }` |
| TC-2.5a | Sequential edits in one response | Script calls `applyEditToActiveDocument` twice | Both writes complete, two `onFileCreated` calls |
| Non-TC | getActiveDocumentContent reads from disk | Execute script calling `getActiveDocumentContent` | `readFile` called with active document path |
| Non-TC | openDocument resolves relative path and validates | Execute script calling `openDocument("docs/spec.md")` | `onOpenDocument` called with absolute resolved path |
| Non-TC | openDocument rejects path traversal | Execute script calling `openDocument("../../etc/passwd")` | Error thrown, `onOpenDocument` not called |

#### `tests/client/steward/chat-panel.test.ts` — 9 tests (Epic 12 additions)

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-2.2a | Clean tab reloads on file-created | Dispatch `chat:file-created` for open clean tab | Document reload triggered |
| TC-2.2b | Viewer shows rendered content after edit | Dispatch `chat:file-created`, verify reload | Content area shows updated rendered document |
| TC-2.3a | Dirty tab shows conflict modal on file-created | Dispatch `chat:file-created` for dirty tab | Conflict modal appears (Keep/Reload/Save Copy) |
| TC-2.3b | Keep My Changes preserves local edits | Dispatch `chat:file-created` for dirty tab, click Keep | Editor content unchanged, file on disk has Steward's version |
| TC-2.3c | Reload from Disk loads Steward's changes | Dispatch `chat:file-created` for dirty tab, click Reload | Editor loads Steward's version from disk |
| TC-2.3d | Save Copy preserves both versions | Dispatch `chat:file-created` for dirty tab, click Save Copy | Save dialog opens; after save, editor loads Steward's version |
| TC-2.4b | Completed agent message exists after edit | Simulate edit flow (send + done) | Agent message in conversation with `streaming: false` |
| Non-TC | file-created for non-open file does nothing | Dispatch `chat:file-created` for file not in tabs | No reload triggered |
| Non-TC | Multiple file-created in one response | Dispatch two `chat:file-created` events | Both reloads triggered |

### Conversation Persistence Tests

#### `tests/server/services/conversation.test.ts` — 18 tests

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-3.1a | Conversation restored on relaunch | Write fixture conversation, call `load()` | Returns messages matching fixture |
| TC-3.1b | Different workspace has separate conversation | Create two conversations with different identities | Each identity loads its own messages |
| TC-3.1c | Switching workspaces swaps conversations | Load identity A, then load identity B | Identity B's messages returned |
| TC-3.1d | Conversation loads on WebSocket connect | (Integration — see ws-chat route tests) | — |
| TC-3.2a | Folder workspace uses absolute path | Call `resolveIdentity` with folder session | Returns `lastRoot` absolute path |
| TC-3.2b | Package workspace uses source path | Call `resolveIdentity` with package session | Returns `packageSourcePath` |
| TC-3.2c | Reopening same package restores conversation | Save conversation for package path, load with same path | Conversation restored |
| TC-3.3a | Session ID passed on restart | Save conversation with session ID, load and check | `getSessionId()` returns stored ID |
| TC-3.3b | Workspace switch loads matching session ID | Save two conversations with different session IDs | Each workspace returns its own session ID |
| TC-3.3c | Clear conversation clears session ID | Save conversation, call `clear()`, check session ID | `getSessionId()` returns null |
| TC-3.3d | Workspace switch during streaming cancels first | (Integration — see ws-chat route tests) | — |
| TC-3.4a | Messages survive app crash (incremental persistence) | Add 3 user + 3 agent messages incrementally | All 6 messages in persisted file after each write |
| TC-3.4b | Partial response on crash — only complete messages restored | Persist 2 complete exchanges, simulate crash mid-stream | 4 messages restored (partial response discarded) |
| TC-3.5a | Clear removes persisted messages | Save conversation, call `clear()` | File deleted, load returns null |
| TC-3.5b | New messages after clear persist normally | Clear, add message | New conversation persisted |
| TC-3.6a | Missing conversation file returns null | Call `load()` for nonexistent identity | Returns null, no error |
| TC-3.6b | Corrupted conversation file handled gracefully | Write malformed JSON to conversation file | Returns null, corrupted file deleted |
| TC-3.6c | Stale session ID: conversation service updates stored ID | Store stale session ID, call updateSessionId with new ID | New session ID persisted, old one replaced |

#### `tests/server/routes/ws-chat.test.ts` — 8 tests (Epic 12 additions)

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-3.1d | Conversation loads on WebSocket connect | Connect with existing conversation file | Server sends `chat:conversation-load` with persisted messages |
| TC-3.3d | Workspace switch during streaming cancels | Start streaming, trigger workspace change | Cancel sent, then conversation swap |
| TC-3.5a | Clear sends empty conversation-load | Send `chat:clear` with persisted conversation | Server sends `chat:conversation-load` with empty messages array; file deleted |
| TC-3.3c | Clear via ws-chat resets session ID | Send `chat:clear` | Provider clear() called; conversation service clear() called |
| Non-TC | Empty workspace sends conversation-load with empty array | Connect with no saved conversation for current workspace | Server sends `chat:conversation-load` with empty messages array (not omitted) |
| Non-TC | Conversation load sent before accepting messages | Connect and inspect message ordering | `chat:conversation-load` sent before any `chat:token` |
| Non-TC | chat:context sent after chat:send with document | Send `chat:send` with activeDocumentPath | Server sends `chat:context` with truncation status before first `chat:token` |

### Local File Links Tests

#### `tests/client/steward/file-link-processor.test.ts` — 8 tests

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.5a | Relative path opens file in tab | Render HTML with `<a href="docs/spec.md">`, process links | Click handler calls `openFile` with resolved absolute path |
| TC-1.5b | Absolute path within root opens file | Render HTML with absolute path link | Click handler calls `openFile` |
| TC-1.5c | Path outside root is not clickable | Render HTML with `<a href="../../etc/passwd">` | No click handler added, no `local-file-link` class |
| TC-1.5c | Nonexistent path is not clickable | Render HTML with path not in file tree | No click handler added |
| TC-1.5d | External links still open in system browser | Render HTML with `<a href="https://example.com">` | Link preserved with `target="_blank"` |
| Non-TC | Bare file paths in text detected | Render text with "see docs/spec.md for details" | Path wrapped in clickable span |
| Non-TC | Paths inside code blocks are not activated | Render `<code>docs/spec.md</code>` | No click handler added |
| Non-TC | Multiple local links in one message | Render HTML with 3 local file links | All 3 have click handlers |

### Session Continuity Tests

#### `tests/server/services/provider-manager.test.ts` — 5 tests (Epic 12 additions)

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.3a | Session ID passed on subsequent messages | Send first message, capture session ID from result event, send second message | Second CLI invocation includes `--resume <session-id>` |
| TC-1.3b | Tab switch does not clear session | Send message, simulate tab switch, send another message | Same session ID used, conversation intact |
| TC-3.6c | Stale --resume: CLI returns new session ID | Call `setSessionId` with stale ID, send message, mock CLI returning new `session_id` in result event | `getSessionId()` returns the new ID after `onDone` fires |
| Non-TC | System prompt passed via --system-prompt flag | Send message with system prompt | CLI args include `--system-prompt` |
| Non-TC | cancelAndWait resolves on process exit | Start streaming, call cancelAndWait | Promise resolves after SIGINT + exit |

### Error Handling and Feature Isolation Tests

#### `tests/server/services/context-injection.test.ts` — (counted above)

TC-4.1a and TC-4.1b are included in the context injection test file above.

#### `tests/client/steward/chat-panel.test.ts` — 1 test (Epic 12 addition for errors)

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-4.2a | No context indicator when flag disabled | Mount app with flag disabled | No `.chat-context-indicator` in DOM |

#### `tests/server/routes/ws-chat.test.ts` — (TC-4.2b, counted in ws-chat totals)

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-4.2b | No conversation files created when flag disabled | Start server with flag disabled, send messages | No conversation directory created, no files written |

---

## Chunk Breakdown

### Chunk 0: Infrastructure

**Scope:** Extended types, new Zod schemas, conversation file utilities, test fixtures.
**ACs:** None directly — infrastructure supporting all ACs.
**Relevant Tech Design Sections:** §Schema Extensions (server doc), §Test Fixtures (this doc)

**Deliverables:**

| Deliverable | Path |
|-------------|------|
| Extended ProviderContext schema | `app/src/server/schemas/index.ts` (modification) |
| ChatFileCreatedMessage schema | `app/src/server/schemas/index.ts` (addition) |
| ChatConversationLoadMessage schema | `app/src/server/schemas/index.ts` (addition) |
| PersistedConversation schema | `app/src/server/schemas/index.ts` (addition) |
| New error codes | `app/src/server/schemas/index.ts` (modification) |
| Conversation file path utility | `app/src/server/services/conversation.ts` (hash function) |
| Test fixtures | `app/tests/fixtures/conversation.ts` |

**Non-TC Decided Tests:** Schema validation tests for new message types (4 tests), hash determinism test (1 test), fixture sanity tests (3 tests)

**Test Count:** 8 tests
**Running Total:** 8 tests

**Exit Criteria:** `npm run build && npm run typecheck` passes.

---

### Chunk 1: Context Injection and Indicator

**Scope:** Context injection service (read doc, token budget, prompt construction), context indicator UI, extended `chat:send` context field.
**ACs:** AC-1.1, AC-1.2, AC-1.4
**TCs:** TC-1.1a through TC-1.1d, TC-1.2a through TC-1.2d, TC-1.4a through TC-1.4c
**Relevant Tech Design Sections:** §Context Injection Service (server doc), §Token Budget (server doc), §Context Indicator (client doc), §Chat State Extensions — getSendContext (client doc)
**Non-TC Decided Tests:** System prompt content test (1 test), truncation at line boundary test (1 test)

**Files:**
- `app/src/server/services/context-injection.ts` (NEW)
- `app/src/server/routes/ws-chat.ts` (MODIFIED — context in send handler)
- `app/src/server/services/provider-manager.ts` (MODIFIED — extended `send()` signature)
- `app/src/client/steward/context-indicator.ts` (NEW)
- `app/src/client/steward/chat-panel.ts` (MODIFIED — mount indicator, tab subscription)
- `app/src/client/steward/chat-state.ts` (MODIFIED — activeDocumentPath, getSendContext)
- `app/src/client/styles/chat.css` (MODIFIED — indicator styles)

**Test Count:** 16 tests (10 server context injection + 6 client indicator)
**Running Total:** 24 tests

---

### Chunk 2: Document Editing and Dirty-Tab Safety

**Scope:** Extended script executor with async support, `applyEditToActiveDocument`, `getActiveDocumentContent`, `openDocument`. File-created notification. Dirty-tab conflict integration.
**ACs:** AC-2.1, AC-2.2, AC-2.3, AC-2.4, AC-2.5
**TCs:** TC-2.1a, TC-2.1b, TC-2.2a, TC-2.2b, TC-2.3a, TC-2.3b, TC-2.3c, TC-2.3d, TC-2.4a, TC-2.4b, TC-2.4c, TC-2.5a
**Relevant Tech Design Sections:** §Script Context Extensions (server doc), §Edit Flow — Complete (client doc), §WebSocket Client Extensions — file-created (client doc)
**Non-TC Decided Tests:** getActiveDocumentContent reads from disk (1), openDocument validates path traversal (1), openDocument resolves relative path (1), file-created for non-open file no-op (1)

**Files:**
- `app/src/server/services/script-executor.ts` (MODIFIED — async support, new methods)
- `app/src/client/steward/chat-panel.ts` (MODIFIED — file-created handler, reload)
- `app/src/client/steward/chat-ws-client.ts` (MODIFIED — file-created event)

**Test Count:** 17 tests (8 server script executor + 9 client chat panel)
**Running Total:** 41 tests

---

### Chunk 3: Conversation Persistence

**Scope:** Conversation service (persist, load, swap, clear, incremental writes, corruption recovery). Canonical workspace identity resolution. CLI session ID persistence. WebSocket conversation load on connect. Workspace switch with cancel.
**ACs:** AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5, AC-3.6
**TCs:** TC-3.1a through TC-3.1d, TC-3.2a through TC-3.2c, TC-3.3a through TC-3.3d, TC-3.4a, TC-3.4b, TC-3.5a, TC-3.5b, TC-3.6a through TC-3.6c, TC-4.2b
**Relevant Tech Design Sections:** §Conversation Persistence Service (server doc), §Workspace Switch Flow (server doc), §Provider Manager — Session ID Flow (server doc), §Conversation Restoration (client doc), §Chat State — replaceConversation (client doc)
**Non-TC Decided Tests:** Conversation load sent before accepting messages (1), no conversation-load for empty workspace (1)

**Files:**
- `app/src/server/services/conversation.ts` (NEW)
- `app/src/server/routes/ws-chat.ts` (MODIFIED — load on connect, done persistence, workspace swap)
- `app/src/server/services/provider-manager.ts` (MODIFIED — cancelAndWait, sessionId event)
- `app/src/client/steward/chat-panel.ts` (MODIFIED — conversation-load handler)
- `app/src/client/steward/chat-ws-client.ts` (MODIFIED — conversation-load event)
- `app/src/client/steward/chat-state.ts` (MODIFIED — replaceConversation)

**Test Count:** 26 tests (18 conversation service + 8 ws-chat route)
**Running Total:** 67 tests

---

### Chunk 4: Local File Links, Session Continuity, and Error Handling

**Scope:** File link detection and navigation. CLI session continuity with `--resume`. Error handling for context injection failures. Feature isolation verification.
**ACs:** AC-1.3, AC-1.5, AC-4.1, AC-4.2
**TCs:** TC-1.3a, TC-1.3b, TC-1.5a through TC-1.5d, TC-4.1a, TC-4.1b, TC-4.2a
**Relevant Tech Design Sections:** §Local File Link Detection (client doc), §Provider Manager Extensions — session ID (server doc), §Context Injection — error handling (server doc)
**Non-TC Decided Tests:** Bare file paths in text detected (1), paths inside code blocks not activated (1), multiple local links in one message (1), system prompt passed via flag (1), cancelAndWait resolves on exit (1)

**Files:**
- `app/src/client/steward/file-link-processor.ts` (NEW)
- `app/src/client/styles/chat.css` (MODIFIED — local-file-link styles)
- `app/src/server/services/provider-manager.ts` (verified — session ID flow)

**Test Count:** 14 tests (8 file link processor + 5 provider manager + 1 client feature isolation)
**Running Total:** 81 tests

---

## Test Count Summary

| Chunk | Server Tests | Client Tests | Total |
|-------|-------------|-------------|-------|
| 0: Infrastructure | 5 | 3 | 8 |
| 1: Context Injection | 10 | 6 | 16 |
| 2: Editing | 8 | 9 | 17 |
| 3: Persistence | 26 | 0 | 26 |
| 4: Links + Errors | 5 | 9 | 14 |
| **Total** | **54** | **27** | **81** |

### Cross-Reference Check

- **TC-to-test mapping:** All 51 TCs from the epic are mapped to tests above. Some TCs are covered by integration tests in the ws-chat route (TC-3.1d, TC-3.3d, TC-3.5a, TC-3.3c, TC-4.2b) rather than unit tests. TC-3.6c is split across conversation service (persistence update) and provider-manager (CLI behavior). Non-TC decided tests are included in per-file counts (not double-counted).
- **Per-file totals:** context-injection.test.ts (10) + context-indicator.test.ts (6) + script-executor.test.ts (8) + chat-panel.test.ts (9+1=10) + conversation.test.ts (18) + ws-chat.test.ts (8) + file-link-processor.test.ts (8) + provider-manager.test.ts (5) = 73 test-file tests + 8 Chunk 0 infrastructure tests = 81 total.
- **Chunk totals sum:** 8 + 16 + 17 + 26 + 14 = 81. ✓

---

## Manual Verification Checklist

After TDD Green, verify manually in the running app:

1. [ ] Enable `FEATURE_SPEC_STEWARD` flag
2. [ ] Open a markdown document, verify context indicator shows filename
3. [ ] Switch tabs, verify context indicator updates
4. [ ] Send "summarize this document" — verify response references document content
5. [ ] Send "add a heading at the top" — verify document edits and viewer refreshes
6. [ ] With dirty tab, trigger an edit — verify conflict modal appears
7. [ ] Quit and relaunch app — verify conversation is restored
8. [ ] Switch workspace roots — verify conversation swaps
9. [ ] Open a package, verify conversation is keyed by package path
10. [ ] Check that a response with relative file paths has clickable links
11. [ ] Click a local file link — verify it opens in a tab
12. [ ] Open a very large document, verify truncation indicator shows
13. [ ] Disable flag, reload — verify no chat panel, no conversation files
