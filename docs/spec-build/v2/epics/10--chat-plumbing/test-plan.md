# Test Plan: Chat Plumbing (Epic 10)

Companion to `tech-design.md`. This document provides complete TC→test mapping, mock strategy, fixtures, and chunk breakdown with test counts.

---

## Mock Strategy

### Mock Boundaries

Tests mock at external boundaries only. Internal modules are exercised through their entry points.

| Boundary | Mock? | Why |
|----------|-------|-----|
| `child_process.spawn` | Yes | External process — control CLI behavior |
| Filesystem (`fs.readFileSync`) | Yes | Config file reading in feature flags |
| `vm.runInNewContext` | No (but controllable) | Internal module — test the real VM, control input |
| WebSocket connections (client) | Yes | Network boundary — use mock WebSocket |
| `localStorage` | Yes (jsdom provides) | Browser API — jsdom provides it |
| `fetch` (client features endpoint) | Yes | Network boundary |
| `crypto.randomUUID` | No | Standard API, deterministic enough for tests |
| Internal modules (StreamParser, ScriptExecutor, ChatStateStore) | No | These are what we're testing |

### Server Test Pattern

Server tests use Fastify's `inject()` for HTTP and direct WebSocket connections via the app instance. The provider manager tests mock `child_process.spawn` to control CLI behavior.

```typescript
// Server test setup pattern
import { buildApp } from '../../../src/server/app.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

let app: FastifyInstance;
beforeEach(async () => {
  app = await buildApp();
  await app.ready();
});
afterEach(async () => {
  await app.close();
});
```

### Client Test Pattern

Client tests use jsdom to load DOM and test component behavior. The WebSocket is mocked at the constructor level.

```typescript
// Client test setup pattern
// Note: No chat elements in the initial DOM — mountChatPanel() creates them dynamically
import { JSDOM } from 'jsdom';

let dom: JSDOM;
beforeEach(() => {
  dom = new JSDOM(`<div id="main">
    <div id="workspace"></div>
  </div>`, { url: 'http://localhost:3000' });

  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
});

// After calling mountChatPanel(), the DOM will contain:
// #chat-resizer, #chat-panel, .chat-messages, .chat-input, etc.
// Tests for AC-1.3 verify that before mount, no chat elements exist.
```

---

## Test Fixtures

```typescript
// app/tests/fixtures/chat.ts

import type {
  ChatSendMessage,
  ChatCancelMessage,
  ChatClearMessage,
  ChatTokenMessage,
  ChatDoneMessage,
  ChatErrorMessage,
  ChatStatusMessage,
} from '../../src/server/schemas/index.js';

// --- Client → Server Messages ---

export function createSendMessage(overrides?: Partial<ChatSendMessage>): ChatSendMessage {
  return {
    type: 'chat:send',
    messageId: 'test-msg-001',
    text: 'Hello, Claude!',
    ...overrides,
  };
}

export function createCancelMessage(messageId = 'test-msg-001'): ChatCancelMessage {
  return { type: 'chat:cancel', messageId };
}

export function createClearMessage(): ChatClearMessage {
  return { type: 'chat:clear' };
}

// --- Server → Client Messages ---

export function createTokenMessage(
  messageId = 'test-msg-001',
  text = 'Hello',
): ChatTokenMessage {
  return { type: 'chat:token', messageId, text };
}

export function createDoneMessage(
  messageId = 'test-msg-001',
  cancelled?: boolean,
): ChatDoneMessage {
  return {
    type: 'chat:done',
    messageId,
    ...(cancelled ? { cancelled: true } : {}),
  };
}

export function createErrorMessage(
  code = 'PROVIDER_CRASHED',
  message = 'CLI process crashed',
  messageId?: string,
): ChatErrorMessage {
  return {
    type: 'chat:error',
    ...(messageId ? { messageId } : {}),
    code: code as ChatErrorMessage['code'],
    message,
  };
}

export function createStatusMessage(
  status: ChatStatusMessage['status'] = 'provider:ready',
  message?: string,
): ChatStatusMessage {
  return {
    type: 'chat:status',
    status,
    ...(message ? { message } : {}),
  };
}

// --- CLI Output Events (for provider manager tests) ---

/**
 * Create a stream_event with text_delta — the format used for token-level streaming.
 * Use this for tests that verify token streaming behavior (TC-4.1a, TC-4.2a, TC-4.3a).
 */
export function createCliStreamEvent(text: string): string {
  return JSON.stringify({
    type: 'stream_event',
    event: { type: 'content_block_delta', delta: { type: 'text_delta', text } },
  });
}

/**
 * Create an assistant event — the complete message format emitted after streaming.
 * Use this for tests that verify the parser correctly IGNORES assistant events
 * (they are redundant — tokens already arrived via stream_event).
 */
export function createCliTextEvent(content: string): string {
  return JSON.stringify({ type: 'assistant', content: [{ type: 'text', text: content }] });
}

export function createCliResultEvent(
  result: string,
  sessionId = 'test-session-001',
): string {
  return JSON.stringify({
    type: 'result',
    subtype: 'success',
    result,
    session_id: sessionId,
    cost_usd: 0.01,
  });
}

export function createCliErrorEvent(error: string): string {
  return JSON.stringify({ type: 'result', subtype: 'error', error });
}

// --- Feature Flag Config ---

export function createFeaturesConfig(specSteward = true): string {
  return JSON.stringify({ features: { specSteward } });
}

// --- Mock Child Process ---

import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';

export class MockChildProcess extends EventEmitter {
  readonly stdin = new Writable({
    write(_chunk, _encoding, callback) { callback(); },
  });
  readonly stdout = new Readable({ read() {} });
  readonly stderr = new Readable({ read() {} });
  readonly pid = 12345;
  killed = false;

  kill(signal?: string): boolean {
    this.killed = true;
    this.emit('exit', signal === 'SIGINT' ? 0 : 1, signal ?? null);
    return true;
  }

  /** Simulate stdout data from the CLI */
  emitStdout(data: string): void {
    this.stdout.push(data + '\n');
  }

  /** Simulate process exit */
  emitExit(code: number, signal: string | null = null): void {
    this.emit('exit', code, signal);
  }

  /** Simulate spawn error */
  emitError(err: Error): void {
    this.emit('error', err);
  }
}
```

---

## TC → Test Mapping

### Chunk 0: Infrastructure

#### `tests/server/routes/features.test.ts` (4 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-1.1a | Returns specSteward: true when flag enabled | Set env `FEATURE_SPEC_STEWARD=true`, build app | GET /api/features → 200, body.specSteward === true |
| TC-1.1b | Returns specSteward: false when flag disabled | No env var set, build app | GET /api/features → 200, body.specSteward === false |
| TC-1.1c | Config file overrides env var | Set env to false, write config.json with true | GET /api/features → 200, body.specSteward === true |
| — | Config file missing falls back to env var | Set env to true, no config file | GET /api/features → 200, body.specSteward === true |

#### `tests/server/services/features.test.ts` + `tests/client/steward/features.test.ts` (4 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-1.4a | Server-side flag check returns true | Init flags with env=true | isFeatureEnabled('specSteward') === true |
| TC-1.4b | Client-side isFeatureEnabled returns true | Mock fetch to return { specSteward: true } | await isFeatureEnabled('specSteward') === true |
| — | Malformed config file falls back to env | Write invalid JSON to config path | Server isFeatureEnabled returns env var value |
| — | Server isFeatureEnabled throws before init | Don't call initFeatureFlags | Throws Error |

#### `tests/server/routes/features-conditional.test.ts` (4 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-1.2a | No /ws/chat route when disabled | Build app with flag=false | WebSocket to /ws/chat rejected or 404 |
| TC-1.2b | No provider process when disabled | Build app with flag=false, wait | No spawn calls |
| TC-1.3a | No chat panel element exists in DOM when disabled | Build app with flag=false, load page | document.getElementById('chat-panel') === null |
| TC-1.3b | Client does not open /ws/chat when flag false | Build app with flag=false | No WebSocket connection initiated |

**Chunk 0 Total: 12 tests**

---

### Chunk 1: Chat Panel Shell and Layout

#### `tests/client/steward/chat-panel-layout.test.ts` (5 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-2.1a | Panel visible when feature enabled | Mount chat panel | chat-panel and chat-resizer are not hidden, main has chat-enabled class |
| TC-2.1b | Panel does not overlap workspace | Mount chat panel, measure layout | workspace and chat-panel have non-overlapping positions |
| TC-2.4a | Text input works | Mount panel, type in textarea | textarea.value contains typed text |
| TC-2.4b | Send button dispatches (UI only, no WS) | Mount panel, type text, click send | User message appears in .chat-messages, input cleared |
| TC-2.4c | Empty input does not send | Mount panel, leave input empty, click send | No new elements in .chat-messages |

#### `tests/client/steward/chat-resizer.test.ts` (4 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-2.2a | Drag resize changes width | Mount resizer, simulate mousedown→mousemove | --chat-width CSS variable changes |
| TC-2.2b | Width clamped to min/max | Drag beyond min and max boundaries | Width stays within 200-600px range |
| TC-2.2c | Width persists across mounts | Set width via drag, unmount, remount | --chat-width matches stored value |
| — | Default width on first load | No localStorage value, mount | --chat-width is 320px (default) |

**Chunk 1 Total: 9 tests**

---

### Chunk 2: WebSocket Chat Connection

#### `tests/server/routes/ws-chat.test.ts` (8 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-3.1a | Connection established | Build app with flag=true, connect to /ws/chat | Connection opens successfully |
| TC-3.1b | No connection when flag disabled | Build app with flag=false, attempt /ws/chat | Connection rejected or route not found |
| TC-3.2a | Localhost origin accepted | Connect with origin: http://localhost:3000 | Connection accepted |
| TC-3.2b | 127.0.0.1 origin accepted | Connect with origin: http://127.0.0.1:3000 | Connection accepted |
| TC-3.2c | Non-localhost origin rejected | Connect with origin: http://evil.com | Receives error, connection closed with 1008 |
| TC-3.3a | Valid chat:send accepted | Send valid ChatSendMessage JSON | No error message returned |
| TC-3.3b | Invalid schema rejected | Send { type: 'chat:unknown' } | Receives chat:error with INVALID_MESSAGE |
| TC-3.3c | Malformed JSON rejected | Send "not json" | Receives chat:error with INVALID_MESSAGE |

#### `tests/client/steward/chat-ws-client.test.ts` (5 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-3.4a | Reconnects after server close | Connect, simulate close | New connection attempt after delay |
| TC-3.4b | Reconnects after network interruption | Connect, simulate error+close | New connection attempt after delay |
| TC-3.5a | Disconnected indicator visible | Connect, then close | 'close' event dispatched, connected === false |
| TC-3.5b | Send returns false when disconnected | Close connection, call send() | send() returns false |
| TC-3.5c | Connected state restored on reconnect | Close, reconnect | 'open' event dispatched, connected === true |

**Chunk 2 subtotal: 13 tests**

**Non-TC test:** Rapid reconnection attempts don't stack (1 test in chat-ws-client.test.ts)

**Chunk 2 Total: 13 tests** (12 TC + 1 non-TC)

---

### Chunk 3: Provider and Message Streaming

#### `tests/server/services/provider-manager.test.ts` (18 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-5.1a | No process at startup | Create ProviderManager, don't call send() | spawn not called |
| TC-5.1b | Process spawns on first send | Call send(messageId, text) | spawn called with 'claude' and expected args |
| TC-4.1a | Response streaming begins | Send message, emit CLI text events | onToken callback receives text |
| TC-4.1b | Response completes with done | Send message, emit CLI result event | onDone callback called with messageId |
| TC-4.3a | Token messages carry correlation ID | Send with messageId "abc", emit text | onToken called with messageId "abc" |
| TC-4.3b | Done message carries correlation ID | Send with messageId "abc", emit result | onDone called with messageId "abc" |
| TC-4.6a | Busy rejection | Call send() while already streaming | onError called with PROVIDER_BUSY |
| TC-4.6b | Rejection doesn't interrupt active stream | Send during active stream, continue first stream | First stream's tokens continue arriving |
| TC-5.5a | CLI not found error | spawn emits ENOENT error | onError with PROVIDER_NOT_FOUND, onStatus with provider:not-found |
| TC-5.5b | Error is non-fatal | CLI not found, then send another message | Second send attempts spawn again |
| TC-5.6a | Startup timeout | spawn succeeds but no stdout | After timeout: onError with PROVIDER_TIMEOUT, process killed |
| TC-5.7a | Starting status on spawn | Call send() | onStatus with provider:starting |
| TC-5.7b | Ready status after first output | Emit first CLI text event | onStatus with provider:ready |
| TC-5.7c | Crashed status on unexpected exit | Process exits with code 1 during streaming | onStatus with provider:crashed |
| TC-5.7d | Not-found status when CLI absent | spawn ENOENT | onStatus with provider:not-found |
| TC-5.8a | Authentication failure detected | Process exits with auth error on stderr | onError with PROVIDER_AUTH_FAILED |
| TC-5.8b | Auth error is non-fatal | Auth error, then send another message | Second send attempts spawn again |
| — | Stream parser handles empty lines | Emit stdout with blank lines between JSON | Empty lines skipped, valid events parsed |

#### `tests/client/steward/chat-panel-streaming.test.ts` (10 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-2.3a | User message appears in conversation | State: addUserMessage, render | .chat-message.user element with correct text |
| TC-2.3b | Agent response appears in conversation | State: appendToken + completeResponse, render | .chat-message.agent element with response text |
| TC-2.3c | Multiple exchanges in chronological order | Add user msg, agent response, user msg, agent response | Messages in DOM in correct order |
| TC-4.2a | Tokens append in real time | appendToken multiple times, render after each | Agent message text grows with each token |
| TC-4.2b | Final response contains all tokens | appendToken("Hello"), appendToken(" world"), complete | Agent message text === "Hello world" |
| TC-4.4a | Loading indicator visible after send | addUserMessage, render | .chat-typing-indicator exists in DOM |
| TC-4.4b | Loading indicator gone after first token | addUserMessage, appendToken, render | .chat-typing-indicator not in DOM |
| TC-4.5a | Input disabled during streaming | Set activeMessageId, render | textarea.disabled === true, send button disabled |
| TC-4.5b | Input re-enabled after done | completeResponse, render | textarea.disabled === false, send button enabled |
| TC-5.2c | Crash error shown in conversation | addError with crash message, render | .chat-message.error with crash text |

#### `tests/client/steward/chat-panel-autoscroll.test.ts` (2 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-2.5a | Auto-scroll during streaming | Scroll to bottom, append token | scrollTop is at bottom |
| TC-2.5b | No auto-scroll when user scrolled up | Scroll up manually, append token | scrollTop remains at user position |

**Chunk 3 subtotal:** 18 + 10 + 2 = 30 tests

**Chunk 3 Total: 30 tests** (29 TC + 1 non-TC)

---

### Chunk 4: Provider Resilience and Conversation Management

#### `tests/server/services/provider-resilience.test.ts` (7 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-5.2a | Crash detected and reported | Process exits with code 1 during streaming | onError with PROVIDER_CRASHED, onStatus with provider:crashed |
| TC-5.2b | Recovery on next message | After crash, call send() again | New spawn call, tokens flow |
| TC-5.3a | Cancel stops token streaming | Call cancel() during streaming | SIGINT sent, onDone with cancelled: true |
| TC-5.3b | Cancel doesn't crash provider | Cancel, then send new message | New process spawns successfully |
| TC-5.4a | Graceful shutdown terminates process | Call shutdown() with running process | Process killed, no orphaned processes |
| TC-5.4b | Shutdown with no active process | Call shutdown() with no process | No errors thrown |
| — | Double cancel doesn't crash | Call cancel() twice | No errors, second call is no-op |

#### `tests/client/steward/chat-panel-management.test.ts` (6 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-6.1a | Clear removes all messages | Add messages, trigger clear | .chat-messages is empty |
| TC-6.1b | Clear resets provider context | Clear, send new message | chat:clear sent over WS |
| TC-6.1c | Clear sends chat:clear message | Trigger clear | WS send called with { type: 'chat:clear' } |
| TC-6.2a | Cancel button visible during streaming | Set activeMessageId (streaming state) | cancel button not hidden |
| TC-6.2b | Cancel button hidden when idle | No active streaming | cancel button hidden |
| TC-6.3a | Clear during streaming cancels first | Start streaming, trigger clear | chat:cancel sent before chat:clear |

**Non-TC test:** TC-5.2c (client shows crash notification) is tested in the chat-panel-streaming tests via the error message rendering path.

**Chunk 4 Total: 13 tests** (12 TC + 1 non-TC)

---

### Chunk 5: Script Execution (Exploratory)

#### `tests/server/services/stream-parser.test.ts` (7 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-7.1a | Normal text passes through | Parse text-only CLI event | Returns TextEvent with content |
| TC-7.1b | Script block intercepted | Parse event with `<steward-script>` content | Returns ScriptEvent, not TextEvent |
| TC-7.1c | Mixed content handled correctly | Parse "text + script + text" content | Returns TextEvent, ScriptEvent, TextEvent in order |
| TC-7.1d | Partial script block across chunks | Parse open tag in one call, close tag in next | ScriptEvent returned on second call with accumulated content |
| TC-7.1e | Malformed script block degrades | Parse open tag, then result event (no close) | Buffered content flushed as text |
| — | Nested XML tags don't confuse parser | Script content contains `<inner>` tags | Full content including inner tags returned as script |
| — | Script context methods are enumerable | Create script context | All curated methods present as properties |

#### `tests/server/services/script-executor.test.ts` (5 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-7.2a | Script executes with curated methods | Execute `showNotification("hello")` | Result: success: true, value contains "hello" |
| TC-7.2b | Script cannot access Node.js globals | Execute `require('fs')` | Result: success: false, error: ReferenceError |
| TC-7.2c | Script timeout on infinite loop | Execute `while(true){}` | Result: success: false, error contains "timed out" |
| TC-7.3a | Successful result format | Execute valid script | Result has { success: true, value: ... } |
| TC-7.3b | Error result format | Execute throwing script | Result has { success: false, error: ... } |

#### `tests/server/services/script-relay.test.ts` (2 tests)

| TC | Test Description | Setup | Assert |
|----|-----------------|-------|--------|
| TC-7.4a | Script error is contained | Script throws, check server state | Server continues operating, error result sent |
| TC-7.4b | VM timeout is contained | Script times out, check server state | Server continues operating, timeout error result sent |

**Chunk 5 Total: 14 tests** (12 TC + 2 non-TC)

---

## Test Count Reconciliation

### Per-File Totals

| Test File | Tests |
|-----------|-------|
| `tests/server/routes/features.test.ts` | 4 |
| `tests/server/services/features.test.ts` + `tests/client/steward/features.test.ts` | 4 |
| `tests/server/routes/features-conditional.test.ts` | 4 |
| `tests/client/steward/chat-panel-layout.test.ts` | 5 |
| `tests/client/steward/chat-resizer.test.ts` | 4 |
| `tests/server/routes/ws-chat.test.ts` | 8 |
| `tests/client/steward/chat-ws-client.test.ts` | 5 |
| `tests/server/services/provider-manager.test.ts` | 18 |
| `tests/client/steward/chat-panel-streaming.test.ts` | 10 |
| `tests/client/steward/chat-panel-autoscroll.test.ts` | 2 |
| `tests/server/services/provider-resilience.test.ts` | 7 |
| `tests/client/steward/chat-panel-management.test.ts` | 6 |
| `tests/server/services/stream-parser.test.ts` | 7 |
| `tests/server/services/script-executor.test.ts` | 5 |
| `tests/server/services/script-relay.test.ts` | 2 |
| **Total** | **91** |

### Per-Chunk Totals

| Chunk | TC Tests | Non-TC Tests | Chunk Total | Running Total |
|-------|----------|-------------|-------------|---------------|
| 0 | 10 | 2 | 12 | 12 |
| 1 | 8 | 1 | 9 | 21 |
| 2 | 12 | 1 | 13 | 34 |
| 3 | 29 | 1 | 30 | 64 |
| 4 | 12 | 1 | 13 | 77 |
| 5 | 12 | 2 | 14 | 91 |
| **Total** | **83** | **8** | **91** | |

### Cross-Check

- Per-file sum: 4+4+4+5+4+8+5+18+10+2+7+6+7+5+2 = **91** ✓
- Per-chunk sum: 12+9+13+30+13+14 = **91** ✓

---

## TC Traceability Summary

All 83 TCs from the epic are mapped. The following table shows coverage by flow:

| Flow | ACs | TCs | Tests | Coverage |
|------|-----|-----|-------|----------|
| 1. Feature Flags | AC-1.1–AC-1.4 | TC-1.1a–TC-1.4b (9) | 12 | Complete + 2 non-TC |
| 2. Chat Panel Layout | AC-2.1–AC-2.5 | TC-2.1a–TC-2.5b (13) | 14 across Chunks 1+3 | Complete |
| 3. WebSocket Connection | AC-3.1–AC-3.5 | TC-3.1a–TC-3.5c (13) | 13 | Complete + 1 non-TC |
| 4. Message Streaming | AC-4.1–AC-4.6 | TC-4.1a–TC-4.6b (12) | 12 | Complete |
| 5. Provider Lifecycle | AC-5.1–AC-5.8 | TC-5.1a–TC-5.8b (18) | 18 | Complete |
| 6. Conversation Mgmt | AC-6.1–AC-6.3 | TC-6.1a–TC-6.3a (6) | 6 | Complete |
| 7. Script Execution | AC-7.1–AC-7.4 | TC-7.1a–TC-7.4b (12) | 14 | Complete + 2 non-TC |

---

## Manual Verification Checklist

After TDD Green, verify the full flow manually:

### With Feature Flag Enabled

1. [ ] Set `FEATURE_SPEC_STEWARD=true` in environment
2. [ ] Start dev server: `npm run dev`
3. [ ] Open `http://localhost:3000` — chat panel visible on right side
4. [ ] Resize chat panel by dragging left edge — verify min/max clamping
5. [ ] Reload page — verify panel width persists
6. [ ] Type a message and click Send — verify message appears in conversation
7. [ ] Verify streaming response arrives token by token
8. [ ] Verify auto-scroll keeps latest content visible during streaming
9. [ ] Scroll up during streaming — verify auto-scroll stops
10. [ ] Click Cancel during streaming — verify response stops, partial text preserved
11. [ ] Click Clear — verify conversation is emptied
12. [ ] Disconnect network briefly — verify disconnected indicator appears
13. [ ] Reconnect — verify indicator clears and messaging resumes

### With Feature Flag Disabled

14. [ ] Unset `FEATURE_SPEC_STEWARD` env var
15. [ ] Start dev server: `npm run dev`
16. [ ] Open `http://localhost:3000` — no chat panel, no resizer visible
17. [ ] Check browser dev tools Network tab — no `/ws/chat` connection
18. [ ] Verify `GET /api/features` returns `{ specSteward: false }`

### Error Scenarios

19. [ ] Rename `claude` CLI temporarily — verify "CLI not found" error on send
20. [ ] Let CLI crash (if reproducible) — verify crash message and recovery
21. [ ] Send message while response is streaming — verify busy rejection

---

## Gorilla Testing Scenarios

### New capabilities to test:

- **Chat panel layout and resizing** — drag the chat resizer to various widths (minimum, maximum, rapid back-and-forth). Verify the workspace content area reflows correctly, no content is clipped or overlaps, and the resize handle doesn't jump or stick. Reload the page and verify the width persists.
- **Message streaming experience** — send a message and observe the token-by-token response. Verify tokens append smoothly without flicker, the typing indicator appears and disappears at the right times, no tokens are duplicated or dropped, and each token attaches to the correct message (not a previous one). After cancel or clear, verify no late tokens from a prior response leak into the conversation or the next response.
- **Auto-scroll behavior** — let a long response stream in while scrolled to the bottom — verify auto-scroll keeps up. Scroll up manually mid-stream — verify auto-scroll stops and the user's scroll position is respected. Scroll back to bottom — verify auto-scroll resumes.
- **Cancel during streaming** — click Cancel at various points during a response (early, mid-stream, near the end). Verify partial text is preserved, the input re-enables, the cancel button hides, and the next message works normally.
- **Clear conversation** — send several messages to build up a conversation, then clear. Verify all messages are removed, the input is ready, and the next message starts a fresh session (no context bleed from the previous conversation).
- **Clear during streaming** — trigger clear while a response is actively streaming. Verify the stream stops (cancel before clear), the conversation empties, and a new message works correctly afterward.
- **Disconnection indicator** — simulate network interruption (disconnect Wi-Fi or kill the server briefly). Verify the disconnected indicator appears. Reconnect — verify the indicator clears and messaging resumes without requiring a page reload.
- **Feature flag gating** — with the flag disabled, verify zero trace of the chat panel: no DOM elements, no WebSocket connections, no CSS layout changes, stored chat width doesn't affect layout, and all existing workspace features work identically to pre-Epic-10 behavior. Toggle the flag and restart — verify the panel appears correctly with persisted width.
- **Provider lifecycle errors** — rename/remove the `claude` CLI and send a message: verify clear "CLI not found" error, input re-enables, and other app features keep working. Restore the CLI — verify recovery on next send without page reload. If the CLI is unauthenticated, verify a clear auth error appears. After a provider crash mid-response, verify the UI shows a crash indicator, preserves partial text, re-enables input, and cleanly recovers on the next send.
- **Script block execution** — trigger a response containing `<steward-script>` blocks mixed with plain text. Verify script text never leaks into the conversation transcript, visible side effects (e.g., notifications) happen exactly once, partial script blocks across streaming chunks are handled correctly, and malformed/unclosed script tags degrade gracefully to text without crashing.

### Adjacent features to recheck:

- **Workspace layout integrity** — the CSS grid changes from 3 columns (sidebar | resizer | workspace) to 5 columns (sidebar | sidebar-resizer | workspace | chat-resizer | chat-panel). Verify the existing sidebar, sidebar resizer, and workspace all work exactly as before: sidebar expand/collapse, sidebar resize, file tree navigation, tab content area width.
- **Dual resizer interaction** — drag the sidebar resizer and the chat resizer in succession and simultaneously. Verify they don't interfere with each other, the workspace between them has a reasonable minimum width, and neither resizer can push past the other.
- **Theme switching with chat panel** — switch themes while the chat panel is visible and while a response is streaming. Verify the chat panel, messages, input area, typing indicator, and cancel/clear buttons all adopt the new theme correctly. No unstyled elements, no contrast issues.
- **Tab management and keyboard shortcuts** — verify Cmd+W (close tab), Ctrl+Tab (next tab), and Cmd+E (toggle edit) still work correctly with the chat panel present. The chat input textarea should not swallow keyboard shortcuts meant for the main workspace.
- **Session persistence** — reload the page with the chat panel visible. Verify the panel reappears at the correct width, the existing workspace state (tabs, sidebar, theme) restores correctly, and the chat conversation is empty (no persistence in Epic 10).
- **File tree and sidebar** — navigate the file tree, open files, use Expand All/Collapse All while the chat panel is open. Verify no layout or interaction interference.
- **Console errors and loading states** — throughout all chat interactions (send, stream, cancel, clear, reconnect, provider errors), check the browser console for unexpected errors or warnings. Verify no loading spinners get stuck anywhere in the app — not just in the chat panel but also in the workspace, tabs, and sidebar.

### Edge cases for agent exploration:

- **Rapid send/cancel cycles** — type a message, send it, immediately cancel, send another, cancel again. Repeat rapidly. Look for state corruption: stuck loading indicators, disabled inputs that don't re-enable, orphaned CLI processes.
- **Concurrent interaction with streaming** — while a chat response is streaming, interact aggressively with the rest of the app: open files from the tree, switch tabs, resize the sidebar, switch themes, toggle edit mode. The streaming should continue uninterrupted and the app should remain responsive.
- **Very long messages and responses** — send an extremely long input message. Trigger a response that generates many paragraphs of output. Verify the chat panel handles the content gracefully: scrollbar appears, auto-scroll works, no performance degradation.
- **Multiple rapid resize during stream** — rapidly drag the chat resizer back and forth while tokens are streaming in. Look for layout thrashing, text reflow glitches, or the stream freezing.
- **WebSocket reconnection during streaming** — if the WebSocket drops mid-stream (kill the server and restart quickly), verify the client reconnects and the partial response is preserved. The user should be able to send a new message after reconnection.
- **PROVIDER_BUSY race conditions** — click the send button very rapidly multiple times in a row. Verify the second and subsequent sends are rejected with PROVIDER_BUSY (or the button is properly disabled), not queued or duplicated.
- **Chat resizer at extremes** — drag the chat panel to its minimum width, then try to interact with the input and messages. Verify the input is still usable and messages are still readable (or at least don't break the layout). Do the same at maximum width — verify the workspace doesn't collapse to zero.
- **Cancel/clear then immediate send** — cancel a streaming response or clear the conversation, then immediately type and send a new message. Verify no late tokens from the cancelled/cleared response appear in the new conversation, the new response streams cleanly, and the provider state machine transitions correctly.
- **Provider crash mid-response** — if reproducible (e.g., kill the CLI process via its PID), verify the UI transitions to crash state, shows a clear error message, preserves whatever partial text arrived, re-enables the input, and recovers cleanly when the next message is sent.
