# Epic 10: Chat Plumbing — Stories

---

## Story 0: Foundation (Infrastructure)

### Summary
<!-- Jira: Summary field -->

Feature flag infrastructure, chat WebSocket message schemas, provider interface types, and project configuration for the Spec Steward plumbing layer.

### Description
<!-- Jira: Description field -->

**User Profile:**
Primary User: The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward.
Context: Working on spec-driven development within the viewer and wanting a chat interface that connects to the Claude CLI for conversational agent interaction, without leaving the tool.
Mental Model: "I enable a flag, a chat panel appears, I type a message, and the Claude CLI streams a response back to me in real time."
Key Constraint: Must be completely invisible when disabled — zero UI, zero WebSocket connections, zero provider processes. Vanilla JS frontend, no component framework. The CLI is a child process (stdin/stdout), not an SDK.

**Objective:**
Establish the shared infrastructure that all subsequent stories depend on: the `FEATURE_SPEC_STEWARD` feature flag (env var + config file + REST endpoint + shared module), chat WebSocket message Zod schemas, provider interface types, and error codes. When the flag is disabled, no Steward-related code executes on server or client.

**Scope:**

In scope:
- `shared/features.ts` — type definitions only (`FeaturesResponse`, `FeatureFlag`)
- `server/services/features.ts` — server-side flag logic (env var + config file via `node:fs`)
- `client/steward/features.ts` — client-side flag fetching (`fetch /api/features`)
- `routes/features.ts` — `GET /api/features` endpoint
- Chat message Zod schemas in `schemas/index.ts` (`ChatClientMessageSchema`, `ChatServerMessageSchema`, error codes)
- Provider interface types (`ChatProvider`, `ProviderConfig`, `ProviderContext`, `ProviderError`)
- Conditional route registration in `app.ts` — chat routes only when flag is enabled

Out of scope:
- Chat panel UI (Story 1)
- WebSocket route implementation (Story 2)
- Provider implementation (Story 3)

**Dependencies:** None — this is the foundation story.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1:** The server exposes a `GET /api/features` endpoint that returns the state of feature flags

- **TC-1.1a: Endpoint returns flag state when enabled**
  - Given: `FEATURE_SPEC_STEWARD` is set to `true`
  - When: Client sends `GET /api/features`
  - Then: Response is `200` with body containing `specSteward: true`
- **TC-1.1b: Endpoint returns flag state when disabled**
  - Given: `FEATURE_SPEC_STEWARD` is not set or set to `false`
  - When: Client sends `GET /api/features`
  - Then: Response is `200` with body containing `specSteward: false`
- **TC-1.1c: Config file overrides environment variable**
  - Given: `FEATURE_SPEC_STEWARD` env var is `false` and the config file sets it to `true`
  - When: Server starts and client sends `GET /api/features`
  - Then: Response contains `specSteward: true` (config file always takes precedence over env var)

**AC-1.2:** When the feature flag is disabled, no Steward-related code executes on the server

- **TC-1.2a: No chat WebSocket route registered**
  - Given: Feature flag is disabled
  - When: A client attempts to connect to `/ws/chat`
  - Then: The connection is rejected or the route does not exist
- **TC-1.2b: No provider process spawned**
  - Given: Feature flag is disabled
  - When: The server is running
  - Then: No CLI child processes are spawned for the chat provider

**AC-1.3:** When the feature flag is disabled, no Steward-related UI elements appear in the client

- **TC-1.3a: No chat panel in DOM**
  - Given: Feature flag is disabled
  - When: The app loads in the browser
  - Then: No chat panel element, chat resizer, or chat toggle exists in the DOM
- **TC-1.3b: No chat WebSocket connection**
  - Given: Feature flag is disabled
  - When: The app loads and runs
  - Then: No WebSocket connection to `/ws/chat` is opened

**AC-1.4:** The `shared/features.ts` module provides a synchronous API for checking flag state on both server and client

- **TC-1.4a: Server-side flag check**
  - Given: Feature flag is enabled
  - When: Server code calls the feature check function
  - Then: The function returns `true`
- **TC-1.4b: Client-side flag check after bootstrap**
  - Given: The client has fetched `GET /api/features` and the flag is enabled
  - When: Client code calls the feature check function
  - Then: The function returns `true`

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Feature Flag Types (shared/features.ts):**

```typescript
export interface FeaturesResponse {
  specSteward: boolean;
}

export type FeatureFlag = keyof FeaturesResponse;
```

**Server-Side Feature Flag Service (server/services/features.ts):**

```typescript
interface FeaturesConfig {
  features?: {
    specSteward?: boolean;
  };
}

export function initFeatureFlags(sessionDir: string): void;
export function isFeatureEnabled(feature: FeatureFlag): boolean;
export function getFeatureFlags(): FeaturesResponse;
```

Merge order: config file (`<sessionDir>/config.json`) > env var (`FEATURE_SPEC_STEWARD`) > default (`false`).

**Client-Side Feature Flag Fetching (client/steward/features.ts):**

```typescript
export async function isFeatureEnabled(feature: FeatureFlag): Promise<boolean>;
```

Fetches from `GET /api/features` on first call, caches the result. Falls back to all-disabled on fetch failure.

**Chat WebSocket Message Schemas (schemas/index.ts):**

```typescript
// Client → Server
interface ChatSendMessage {
  type: 'chat:send';
  messageId: string;       // Client-generated UUID
  text: string;            // User's message text
  context?: ProviderContext;
}

interface ChatCancelMessage {
  type: 'chat:cancel';
  messageId: string;
}

interface ChatClearMessage {
  type: 'chat:clear';
}

type ChatClientMessage = ChatSendMessage | ChatCancelMessage | ChatClearMessage;

// Server → Client
interface ChatTokenMessage {
  type: 'chat:token';
  messageId: string;
  text: string;
}

interface ChatDoneMessage {
  type: 'chat:done';
  messageId: string;
  cancelled?: boolean;
}

interface ChatErrorMessage {
  type: 'chat:error';
  messageId?: string;
  code: string;
  message: string;
}

interface ChatStatusMessage {
  type: 'chat:status';
  status: 'provider:ready' | 'provider:starting' | 'provider:crashed' | 'provider:not-found';
  message?: string;
}

type ChatServerMessage = ChatTokenMessage | ChatDoneMessage | ChatErrorMessage | ChatStatusMessage;
```

**Chat Error Codes:**

| Code | Description |
|------|-------------|
| `INVALID_MESSAGE` | Client message did not match any schema |
| `PROVIDER_NOT_FOUND` | CLI executable not found on PATH |
| `PROVIDER_CRASHED` | CLI process exited unexpectedly |
| `PROVIDER_TIMEOUT` | CLI process did not start within timeout |
| `PROVIDER_BUSY` | A message is already being processed |
| `PROVIDER_AUTH_FAILED` | CLI not authenticated |
| `SCRIPT_ERROR` | Script block execution failed |
| `SCRIPT_TIMEOUT` | Script block execution timed out |
| `CANCELLED` | Response was cancelled by the user |

**Provider Interface Types:**

```typescript
interface ProviderConfig {
  command: string;
  args?: string[];
  startupTimeoutMs: number;
  scriptTimeoutMs: number;
}

interface ChatProvider {
  start(config: ProviderConfig): Promise<void>;
  send(message: string, context?: ProviderContext): void;
  onToken(callback: (text: string) => void): void;
  onDone(callback: () => void): void;
  onError(callback: (error: ProviderError) => void): void;
  cancel(): void;
  stop(): Promise<void>;
  readonly isRunning: boolean;
}

interface ProviderContext {
  // Intentionally minimal for Epic 10 — expanded in Epics 12-13
}

interface ProviderError {
  code: string;
  message: string;
  fatal: boolean;
}
```

**Conditional Route Registration (app.ts):**

The features endpoint is always registered. The `/ws/chat` route and provider manager are only registered when `isFeatureEnabled('specSteward')` returns `true`. When disabled, a connection attempt to `/ws/chat` returns 404.

See the tech design document for full architecture, implementation targets, and test mapping.

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `shared/features.ts` exports `FeaturesResponse` and `FeatureFlag` types (no Node.js imports)
- [ ] `server/services/features.ts` reads env var and config file with correct merge order
- [ ] `client/steward/features.ts` fetches and caches feature flags from REST endpoint
- [ ] `GET /api/features` endpoint returns correct flag state
- [ ] Chat message Zod schemas defined with `z.discriminatedUnion` on `type` field
- [ ] Provider interface types defined
- [ ] Chat error codes defined as Zod enum
- [ ] Conditional route registration in `app.ts` — chat routes only when flag enabled
- [ ] Config file missing/malformed handled gracefully (fall through to env var)
- [ ] All tests pass: `npm run verify`
- [ ] TCs 1.1a–1.1c, 1.2a–1.2b, 1.3a–1.3b, 1.4a–1.4b covered

---

## Story 1: Chat Panel Shell and Layout

### Summary
<!-- Jira: Summary field -->

Resizable right-hand chat panel with conversation display area and input area — visual shell only, no WebSocket connection.

### Description
<!-- Jira: Description field -->

**User Profile:** (same as Story 0)

**Objective:**
Deliver the chat panel UI shell — a resizable panel on the right side of the viewer that appears when the feature flag is enabled. The panel contains a conversation display area and an input area with a send button. The panel is resizable by dragging its left edge, with width persisted to localStorage. No WebSocket connection — the panel is a visual shell. Send is UI-only (not wired to server).

**Scope:**

In scope:
- Dynamic DOM creation via `mountChatPanel()` — no chat elements in `index.html`
- CSS grid extension from 3-column to 5-column (`sidebar | sidebar-resizer | workspace | chat-resizer | chat-panel`)
- Chat panel layout: header, conversation display, input area with textarea and send button
- Drag-resize via chat resizer handle (mirrors sidebar-resizer pattern)
- Width persistence to localStorage with min/max clamping
- `chat.css` styles using existing CSS custom properties

Out of scope:
- WebSocket connection (Story 2)
- Sending messages to server (Story 3)
- Conversation display with message distinction (Story 3 — requires streamed data)

**Dependencies:** Story 0 (feature flag infrastructure)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-2.1:** The chat panel renders as a right-hand panel adjacent to the workspace area when the feature flag is enabled

- **TC-2.1a: Panel is visible in layout**
  - Given: Feature flag is enabled
  - When: The app loads
  - Then: A chat panel is visible to the right of the workspace area, containing a conversation display area and an input area
- **TC-2.1b: Panel does not overlap existing layout**
  - Given: Feature flag is enabled and the chat panel is visible
  - When: The developer views the app
  - Then: The sidebar, workspace (tabs + content area), and chat panel are all visible without overlap; the workspace area is narrower to accommodate the chat panel

**AC-2.2:** The chat panel is resizable by dragging its left edge

- **TC-2.2a: Drag resize works**
  - Given: The chat panel is visible
  - When: The developer drags the panel's left-edge resize handle to the left
  - Then: The chat panel width increases and the workspace area width decreases proportionally
- **TC-2.2b: Resize respects minimum and maximum width**
  - Given: The developer is dragging the resize handle
  - When: The developer drags beyond the minimum or maximum panel width
  - Then: The panel width is clamped and does not go below the minimum or above the maximum
- **TC-2.2c: Resize width persists across page loads**
  - Given: The developer has resized the chat panel to a custom width
  - When: The app is reloaded
  - Then: The chat panel opens at the previously set width

**AC-2.4:** The input area allows the developer to type a message and send it

- **TC-2.4a: Text input works**
  - Given: The chat panel is visible
  - When: The developer clicks the input area and types text
  - Then: The typed text appears in the input area
- **TC-2.4b: Send action dispatches the message**
  - Given: The developer has typed text in the input area
  - When: The developer clicks the send button
  - Then: The message is sent (appears in conversation as a user message) and the input area is cleared

  *Note: In Story 1, "sent" means the message appears in the local conversation display. The WebSocket send is wired in Story 3.*

- **TC-2.4c: Empty input does not send**
  - Given: The input area is empty (or contains only whitespace)
  - When: The developer clicks the send button
  - Then: No message is sent; the conversation display does not change

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Chat Panel Controller Interface:**

```typescript
export interface ChatPanelController {
  connectWs(wsClient: ChatWsClient): void;
  destroy(): void;
}

export function mountChatPanel(): ChatPanelController;
```

`mountChatPanel()` creates all DOM elements dynamically via `document.createElement()` and appends them to `#main`. Returns a controller with `connectWs()` (wired in Story 3) and `destroy()` for cleanup.

**DOM Structure (created dynamically):**

```
#chat-resizer  [role="separator", aria-label="Resize chat panel", tabindex=0]
#chat-panel    <aside>
  .chat-header
    .chat-title           "Spec Steward"
    .chat-header-actions
      .chat-clear-btn     <button> "Clear"
  .chat-status            [hidden]
  .chat-messages
  .chat-input-area
    .chat-input           <textarea placeholder="Send a message..." rows=3>
    .chat-send-btn        <button> "Send"
    .chat-cancel-btn      <button> "Cancel" [hidden]
```

**CSS Grid Extension:**

```css
#main.chat-enabled {
  grid-template-columns:
    var(--sidebar-width, 15rem)  /* sidebar */
    0px                          /* sidebar-resizer */
    minmax(0, 1fr)               /* workspace */
    0px                          /* chat-resizer */
    var(--chat-width, 20rem);    /* chat-panel */
}
```

Activated by adding `chat-enabled` class to `#main`.

**Chat Resizer (steward/chat-resizer.ts):**

```typescript
export function mountChatResizer(
  resizer: HTMLElement,
  main: HTMLElement,
): () => void;
```

Constants: `MIN_WIDTH = 200`, `MAX_WIDTH = 600`, `DEFAULT_WIDTH = 320`, localStorage key `mdv-chat-width`. Delta inverted from sidebar-resizer (dragging left increases width).

See the tech design document for full architecture, implementation targets, and test mapping.

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `mountChatPanel()` creates all DOM elements dynamically — no chat elements in `index.html`
- [ ] CSS grid extends to 5 columns when `chat-enabled` class is added to `#main`
- [ ] Chat resizer supports drag-resize with min/max clamping
- [ ] Chat panel width persists to localStorage across page loads
- [ ] Input area accepts text and prevents empty sends
- [ ] Chat panel hidden when feature flag is disabled (no DOM elements created)
- [ ] All tests pass: `npm run verify`
- [ ] TCs 2.1a–2.1b, 2.2a–2.2c, 2.4a–2.4c covered

---

## Story 2: WebSocket Chat Connection

### Summary
<!-- Jira: Summary field -->

`/ws/chat` WebSocket route on the server and `ChatWsClient` on the client with origin checking, Zod message validation, auto-reconnection, and disconnected indicator.

### Description
<!-- Jira: Description field -->

**User Profile:** (same as Story 0)

**Objective:**
Establish the WebSocket transport layer between client and server for chat communication. The server registers a `/ws/chat` route with origin checking and Zod message validation. The client connects via `ChatWsClient` with automatic reconnection on connection drops. While disconnected, the client shows a visual indicator and blocks message sending. No provider yet — messages are received and validated but not forwarded to any CLI process.

**Scope:**

In scope:
- `/ws/chat` WebSocket route in `routes/ws-chat.ts`
- Origin checking (localhost and 127.0.0.1 on any port)
- Zod validation of incoming client messages against `ChatClientMessageSchema`
- `ChatWsClient` class in `client/steward/chat-ws-client.ts`
- Auto-reconnection with exponential backoff (2-5 second range)
- Disconnected indicator in chat panel
- Send blocking while disconnected

Out of scope:
- Provider manager (Story 3)
- Message forwarding to CLI process (Story 3)
- Conversation display with streamed messages (Story 3)

**Dependencies:** Story 0 (schemas, feature flags)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-3.1:** The client establishes a WebSocket connection to `/ws/chat` when the feature flag is enabled

- **TC-3.1a: Connection established on mount**
  - Given: Feature flag is enabled and the app loads
  - When: The chat panel mounts
  - Then: A WebSocket connection to `/ws/chat` is open
- **TC-3.1b: Connection not established when flag is disabled**
  - Given: Feature flag is disabled
  - When: The app loads
  - Then: No WebSocket connection to `/ws/chat` exists

**AC-3.2:** The `/ws/chat` WebSocket route accepts connections from localhost origins only (including `localhost` and `127.0.0.1` on any port)

- **TC-3.2a: Localhost origin accepted**
  - Given: A WebSocket connection request from `http://localhost:3000`
  - When: The server receives the connection
  - Then: The connection is accepted
- **TC-3.2b: 127.0.0.1 origin accepted**
  - Given: A WebSocket connection request from `http://127.0.0.1:3000`
  - When: The server receives the connection
  - Then: The connection is accepted
- **TC-3.2c: Non-localhost origin rejected**
  - Given: A WebSocket connection request from a non-localhost origin
  - When: The server receives the connection
  - Then: The connection is rejected with a close code indicating the origin is not allowed

**AC-3.3:** All WebSocket messages conform to typed Zod schemas and invalid messages are rejected

- **TC-3.3a: Valid client message accepted**
  - Given: A WebSocket connection is open
  - When: The client sends a message conforming to the `ChatClientMessage` schema
  - Then: The server processes the message
- **TC-3.3b: Invalid client message rejected**
  - Given: A WebSocket connection is open
  - When: The client sends a message that does not match any `ChatClientMessage` schema
  - Then: The server sends a `chat:error` message indicating an invalid message format
- **TC-3.3c: Malformed JSON rejected**
  - Given: A WebSocket connection is open
  - When: The client sends non-JSON data
  - Then: The server sends a `chat:error` message

**AC-3.4:** The client reconnects automatically after a connection drop

- **TC-3.4a: Reconnection after server-side close**
  - Given: The WebSocket connection is open
  - When: The server closes the connection unexpectedly
  - Then: The client reconnects within 2-5 seconds
- **TC-3.4b: Reconnection after network interruption**
  - Given: The WebSocket connection is open
  - When: The connection drops
  - Then: The client reconnects within 2-5 seconds when the connection is available again

**AC-3.5:** While the WebSocket connection is down, the client shows a disconnected indicator and blocks message sending

- **TC-3.5a: Disconnected indicator visible**
  - Given: The WebSocket connection has dropped
  - When: The developer views the chat panel
  - Then: A visual indicator shows the connection is down (e.g., status text or icon)
- **TC-3.5b: Send blocked while disconnected**
  - Given: The WebSocket connection is down
  - When: The developer attempts to send a message
  - Then: The message is not sent; the developer sees feedback that the connection is unavailable
- **TC-3.5c: Indicator clears on reconnection**
  - Given: The disconnected indicator is showing
  - When: The WebSocket reconnects
  - Then: The indicator disappears and message sending is re-enabled

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**WebSocket Chat Route (routes/ws-chat.ts):**

```typescript
function isAllowedOrigin(origin: string | undefined): boolean;
function sendMessage(socket: WebSocket, message: ChatServerMessage): void;
export async function chatWsRoutes(app: FastifyInstance): Promise<void>;
```

Origin check accepts `http://localhost:*` and `http://127.0.0.1:*`. Missing origin is allowed (for non-browser clients). The route parses incoming messages with `ChatClientMessageSchema.safeParse()` and rejects with `INVALID_MESSAGE` on failure.

**ChatWsClient (client/steward/chat-ws-client.ts):**

```typescript
type ChatWsEventMap = {
  open: { type: 'open' };
  close: { type: 'close' };
  'chat:token': ChatServerMessageByType<'chat:token'>;
  'chat:done': ChatServerMessageByType<'chat:done'>;
  'chat:error': ChatServerMessageByType<'chat:error'>;
  'chat:status': ChatServerMessageByType<'chat:status'>;
};

export class ChatWsClient {
  get connected(): boolean;
  connect(): void;
  send(message: ChatClientMessage): boolean;
  on<T extends ChatWsEventType>(type: T, handler: ChatWsHandler<T>): () => void;
  disconnect(): void;
}
```

Reconnect strategy: exponential backoff starting at 2s, maxing at 5s, with jitter via `Math.pow(1.5, attempts)`. `send()` returns `false` if connection is not open (AC-3.5b). Incoming server messages validated through `ChatServerMessageSchema.safeParse()`.

See the tech design document for full architecture, implementation targets, and test mapping.

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `/ws/chat` route registered conditionally when feature flag is enabled
- [ ] Origin checking accepts localhost/127.0.0.1, rejects others
- [ ] Incoming messages validated against `ChatClientMessageSchema`; invalid messages return `chat:error`
- [ ] `ChatWsClient` connects on mount, reconnects automatically with exponential backoff
- [ ] Disconnected indicator visible when connection is down
- [ ] Message sending blocked while disconnected with user feedback
- [ ] Indicator clears on reconnection
- [ ] All tests pass: `npm run verify`
- [ ] TCs 3.1a–3.1b, 3.2a–3.2c, 3.3a–3.3c, 3.4a–3.4b, 3.5a–3.5c covered

---

## Story 3: Provider and Message Streaming

### Summary
<!-- Jira: Summary field -->

Claude CLI provider implementation and end-to-end message streaming — send a message, stream tokens from the CLI, display the response progressively in the chat panel.

### Description
<!-- Jira: Description field -->

**User Profile:** (same as Story 0)

**Objective:**
Wire the full send-stream-display loop. The developer types a message, it flows through the WebSocket to the provider manager, the CLI is spawned (lazy init), the CLI streams a response, tokens are relayed back as `chat:token` messages, and the conversation display shows the response progressively. This story also delivers conversation display with user/agent message distinction, auto-scroll during streaming, loading indicator, input disabling during streaming, server-side busy rejection, and provider status messages for lifecycle transitions.

**Scope:**

In scope:
- `ProviderManager` in `server/services/provider-manager.ts` — CLI spawn, stdin/stdout piping, event-based streaming API
- `StreamParser` in `server/services/stream-parser.ts` — parse CLI streaming JSON output (text tokens and result events only; script interception is Story 5)
- WebSocket route message forwarding to provider manager
- Conversation display with user/agent message visual distinction
- Auto-scroll during streaming (stops when user scrolls up)
- Loading indicator (typing indicator) while waiting for first token
- Input/send button disabled during streaming
- Server-side busy rejection (`PROVIDER_BUSY`) for concurrent sends
- Lazy initialization — CLI process spawned on first message, not at startup
- Provider error handling: CLI not found (`PROVIDER_NOT_FOUND`), startup timeout (`PROVIDER_TIMEOUT`), auth failure (`PROVIDER_AUTH_FAILED`)
- Provider status messages (`provider:starting`, `provider:ready`, `provider:crashed`, `provider:not-found`)
- `ChatStateStore` for client-side state management

Out of scope:
- Crash recovery and restart (Story 4)
- Cancel (Story 4)
- Graceful shutdown (Story 4)
- Clear conversation (Story 4)
- Script block interception (Story 5)

**Dependencies:** Stories 1 (chat panel shell) and 2 (WebSocket connection)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-2.3:** The chat panel displays a conversation as a list of messages with visual distinction between user messages and agent responses

- **TC-2.3a: User message appears in conversation**
  - Given: The chat panel is visible and the developer has sent a message
  - When: The message is sent
  - Then: The user's message appears in the conversation display area, visually distinct from agent responses (different alignment, background, or label)
- **TC-2.3b: Agent response appears in conversation**
  - Given: The developer has sent a message
  - When: The agent's response completes
  - Then: The agent's response appears as a separate message block, visually distinct from the user's message
- **TC-2.3c: Multiple exchanges display in chronological order**
  - Given: The developer has sent multiple messages and received responses
  - When: The developer views the conversation
  - Then: Messages appear in the order they were sent, alternating between user and agent messages

**AC-2.5:** The conversation display auto-scrolls to show the latest content during streaming

- **TC-2.5a: Auto-scroll during response**
  - Given: An agent response is streaming and the conversation display is scrolled to the bottom
  - When: New text tokens arrive
  - Then: The conversation display scrolls to keep the latest text visible
- **TC-2.5b: No auto-scroll when user has scrolled up**
  - Given: An agent response is streaming
  - When: The developer manually scrolls up in the conversation display
  - Then: Auto-scroll stops; the view stays at the developer's scroll position

**AC-4.1:** Sending a `chat:send` message initiates a streamed response from the provider

- **TC-4.1a: Response streaming begins**
  - Given: The WebSocket connection is open and the provider is ready
  - When: The client sends a `chat:send` message with text content
  - Then: The server begins relaying `chat:token` messages containing response text
- **TC-4.1b: Response completes with `chat:done`**
  - Given: The provider is streaming a response
  - When: The provider finishes generating the response
  - Then: The server sends a `chat:done` message with the same message ID as the corresponding `chat:send`

**AC-4.2:** Streamed tokens appear progressively in the conversation display as plain text

- **TC-4.2a: Tokens append in real time**
  - Given: The developer has sent a message and the response is streaming
  - When: `chat:token` messages arrive from the server
  - Then: The text content is appended to the agent's response in the conversation display progressively
- **TC-4.2b: Final response contains all tokens**
  - Given: Streaming is complete (`chat:done` received)
  - When: The developer views the agent's response
  - Then: The displayed response text is the concatenation of all token payloads received for that message ID

**AC-4.3:** Each request-response pair is correlated by a message ID

- **TC-4.3a: Token messages carry the correlation ID**
  - Given: The client sent a `chat:send` with `messageId: "abc123"`
  - When: The server relays tokens
  - Then: Each `chat:token` message contains `messageId: "abc123"`
- **TC-4.3b: Done message carries the correlation ID**
  - Given: The client sent a `chat:send` with `messageId: "abc123"`
  - When: The provider finishes
  - Then: The `chat:done` message contains `messageId: "abc123"`

**AC-4.4:** The client shows a loading indicator while waiting for the first token

- **TC-4.4a: Indicator appears after send**
  - Given: The developer has sent a message
  - When: No `chat:token` has been received yet
  - Then: A loading indicator (e.g., typing indicator or spinner) is visible in the conversation display
- **TC-4.4b: Indicator disappears on first token**
  - Given: A loading indicator is visible
  - When: The first `chat:token` arrives
  - Then: The loading indicator is replaced by the agent's response text

**AC-4.5:** The input area is disabled while a response is streaming to prevent concurrent messages

- **TC-4.5a: Input disabled during streaming**
  - Given: The developer has sent a message and the response is streaming
  - When: The developer views the input area
  - Then: The input area and send button are disabled
- **TC-4.5b: Input re-enabled after response completes**
  - Given: The response has completed (`chat:done` received)
  - When: The developer views the input area
  - Then: The input area and send button are enabled

**AC-4.6:** If the server receives a `chat:send` while a response is already streaming, it rejects the message

- **TC-4.6a: Busy rejection**
  - Given: A response is currently streaming
  - When: The server receives a second `chat:send` message
  - Then: The server responds with `chat:error` with code `PROVIDER_BUSY` and does not forward the message to the provider
- **TC-4.6b: Rejection does not interrupt active stream**
  - Given: A response is streaming and a second `chat:send` is rejected
  - When: The active stream continues
  - Then: Tokens continue arriving for the original message; the rejection does not affect the in-progress response

**AC-5.1:** The provider spawns the CLI process on first use (lazy initialization), not at server startup

- **TC-5.1a: No process at startup**
  - Given: The feature flag is enabled and the server starts
  - When: No message has been sent
  - Then: No CLI child process is running
- **TC-5.1b: Process spawns on first message**
  - Given: No CLI process is running
  - When: The developer sends the first `chat:send` message
  - Then: A CLI child process is spawned before the message is forwarded

**AC-5.5:** The provider reports a clear error if the Claude CLI is not installed or not found on PATH

- **TC-5.5a: CLI not found error**
  - Given: The `claude` command is not available on PATH
  - When: The provider attempts to spawn the CLI process
  - Then: The server sends a `chat:error` message with a description indicating the CLI was not found
- **TC-5.5b: Error is non-fatal to the server**
  - Given: The CLI is not found
  - When: The `chat:error` is sent
  - Then: The server continues running; other features (file browsing, editing) are unaffected

**AC-5.6:** The provider handles CLI startup timeout

- **TC-5.6a: Startup timeout reported**
  - Given: The CLI process is spawned
  - When: The CLI does not become ready within the configured timeout period
  - Then: The server sends a `chat:error` message indicating a startup timeout and kills the hung process

**AC-5.7:** The provider sends status messages during lifecycle state transitions

- **TC-5.7a: Starting status on spawn**
  - Given: The developer sends the first message
  - When: The provider begins spawning the CLI process
  - Then: The server sends a `chat:status` message with `status: 'provider:starting'`
- **TC-5.7b: Ready status after spawn completes**
  - Given: The CLI process is being spawned
  - When: The CLI process is ready to accept input
  - Then: The server sends a `chat:status` message with `status: 'provider:ready'`
- **TC-5.7c: Crashed status on unexpected exit**
  - Given: The CLI process is running
  - When: The CLI process exits unexpectedly
  - Then: The server sends a `chat:status` message with `status: 'provider:crashed'` (in addition to `chat:error` for any in-flight message)
- **TC-5.7d: Not-found status when CLI is absent**
  - Given: The `claude` command is not available on PATH
  - When: The provider attempts to spawn the CLI process
  - Then: The server sends a `chat:status` message with `status: 'provider:not-found'` (in addition to `chat:error` for the triggering message)

**AC-5.8:** The provider reports a clear error if the Claude CLI is installed but not authenticated

- **TC-5.8a: Authentication failure detected**
  - Given: The Claude CLI is installed but the user is not authenticated (no valid session/token)
  - When: The provider spawns the CLI and it exits with an authentication error
  - Then: The server sends a `chat:error` message with a description indicating the CLI needs authentication
- **TC-5.8b: Authentication error is non-fatal to the server**
  - Given: The CLI exits with an authentication error
  - When: The error is reported
  - Then: The server continues running; other features are unaffected

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Provider Manager (server/services/provider-manager.ts):**

```typescript
export class ProviderManager {
  send(messageId: string, text: string): void;
  cancel(messageId: string): void;
  clear(): void;
  shutdown(): Promise<void>;

  onToken(handler: (messageId: string, text: string) => void): () => void;
  onDone(handler: (messageId: string, cancelled?: boolean) => void): () => void;
  onError(handler: (messageId: string | undefined, code: string, message: string) => void): () => void;
  onStatus(handler: (status: string, message?: string) => void): () => void;
}
```

State machine: `idle → starting → streaming → idle`. Per-invocation model — each `chat:send` spawns a new `claude -p --output-format stream-json` process. Multi-turn context via `--resume <sessionId>`. CLI args: `-p`, `--output-format stream-json`, `--include-partial-messages`, `--verbose`, `--bare`, `--max-turns 25`.

**Stream Parser (server/services/stream-parser.ts):**

```typescript
export type ParsedEvent = TextEvent | ScriptEvent | ResultEvent | ErrorEvent;

export class StreamParser {
  parse(event: Record<string, unknown>): ParsedEvent[];
  reset(): void;
}
```

Parses CLI streaming JSON events. Text deltas extracted from `stream_event` with `content_block_delta` / `text_delta`. Result events carry `session_id` for `--resume`. Script interception (Story 5) is handled by `processTextContent()` but only text passthrough is needed for this story.

**Chat State Store (client/steward/chat-state.ts):**

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'error';
  text: string;
  streaming: boolean;
  cancelled?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  activeMessageId: string | null;
  waitingForResponse: boolean;
  connected: boolean;
  providerStatus: string | null;
}

export class ChatStateStore {
  get(): ChatState;
  subscribe(listener: (state: ChatState) => void): () => void;
  addUserMessage(messageId: string, text: string): void;
  appendToken(messageId: string, text: string): void;
  completeResponse(messageId: string, cancelled?: boolean): void;
  addError(messageId: string | undefined, message: string): void;
  clearMessages(): void;
  setConnected(connected: boolean): void;
  setProviderStatus(status: string | null): void;
}
```

**Auto-Scroll:** Scroll position threshold (20px from bottom). When user scrolls up beyond threshold, `userScrolledUp = true` and auto-scroll stops. Re-enabled when user scrolls back to bottom.

See the tech design document for full architecture, implementation targets, and test mapping.

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `ProviderManager` spawns CLI process on first `chat:send` (lazy init)
- [ ] CLI streaming JSON output parsed — text deltas relayed as `chat:token`
- [ ] `chat:done` sent on CLI result event with correlation `messageId`
- [ ] `PROVIDER_BUSY` rejection for concurrent sends
- [ ] CLI not found → `PROVIDER_NOT_FOUND` error (non-fatal)
- [ ] CLI auth failure → `PROVIDER_AUTH_FAILED` error (non-fatal)
- [ ] Startup timeout → `PROVIDER_TIMEOUT` error (process killed)
- [ ] Status messages sent for all lifecycle transitions
- [ ] Conversation display shows user and agent messages with visual distinction
- [ ] Auto-scroll works during streaming, stops when user scrolls up
- [ ] Loading indicator visible after send, replaced by first token
- [ ] Input disabled during streaming, re-enabled on `chat:done`
- [ ] Session ID stored from result event for `--resume` on subsequent messages
- [ ] All tests pass: `npm run verify`
- [ ] TCs 2.3a–2.3c, 2.5a–2.5b, 4.1a–4.1b, 4.2a–4.2b, 4.3a–4.3b, 4.4a–4.4b, 4.5a–4.5b, 4.6a–4.6b, 5.1a–5.1b, 5.5a–5.5b, 5.6a, 5.7a–5.7d, 5.8a–5.8b covered

---

## Story 4: Provider Resilience and Conversation Management

### Summary
<!-- Jira: Summary field -->

Crash recovery, response cancellation, graceful shutdown, and conversation management (clear, cancel from UI).

### Description
<!-- Jira: Description field -->

**User Profile:** (same as Story 0)

**Objective:**
Make the provider resilient and give the developer conversation management controls. The developer can cancel a streaming response mid-stream, clear the conversation to start fresh, and recover transparently from CLI process crashes. On app shutdown, the provider terminates all CLI processes. The cancel button appears during streaming and hides when idle. Clearing during streaming cancels first, then clears.

**Scope:**

In scope:
- Crash detection and recovery — CLI crash sends `chat:error`, next message spawns a new process
- Cancellation — SIGINT to CLI process, `chat:done` with `cancelled: true`, fallback to SIGTERM/SIGKILL
- Graceful shutdown — `app.addHook('onClose')` kills CLI process within 5 seconds
- Clear conversation — empties conversation display, sends `chat:clear` to server, discards `sessionId`
- Cancel button visible during streaming, hidden when idle
- Clear during streaming cancels the active response first

Out of scope:
- Conversation persistence across app restarts (Epic 12)
- Script execution (Story 5)

**Dependencies:** Story 3 (provider and streaming must work)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-5.2:** If the CLI process crashes, the provider reports the error and recovers on the next message

- **TC-5.2a: Crash detected and reported**
  - Given: The CLI process is running and processing a response
  - When: The CLI process exits unexpectedly (non-zero exit code or signal)
  - Then: The server sends a `chat:error` message to the client describing the crash
- **TC-5.2b: Recovery on next message**
  - Given: The CLI process has crashed and the error was reported
  - When: The developer sends the next `chat:send` message
  - Then: A new CLI process is spawned and the message is processed
- **TC-5.2c: Client shows crash notification**
  - Given: The CLI process has crashed
  - When: The `chat:error` message arrives at the client
  - Then: The conversation display shows an error message indicating the provider crashed

**AC-5.3:** The developer can cancel an in-progress response

- **TC-5.3a: Cancel stops token streaming**
  - Given: A response is streaming
  - When: The developer triggers cancel (cancel button or `chat:cancel` message)
  - Then: Token streaming stops, the server sends `chat:done` with a `cancelled: true` flag, and the partial response remains visible in the conversation
- **TC-5.3b: Cancel does not crash the provider**
  - Given: A response is streaming
  - When: The developer cancels
  - Then: The CLI process remains alive and can accept the next message (no restart required)

  *Note: With the per-invocation model, cancel sends SIGINT which kills the current process. "Doesn't crash the provider" means the ProviderManager returns to idle state and can spawn a new process on the next message.*

**AC-5.4:** The provider shuts down the CLI process when the app exits

- **TC-5.4a: Graceful shutdown**
  - Given: The CLI process is running
  - When: The server begins shutdown (SIGINT or SIGTERM)
  - Then: The CLI process is terminated and no orphaned processes remain
- **TC-5.4b: Shutdown with no active process**
  - Given: The CLI process is not running (never spawned or already exited)
  - When: The server shuts down
  - Then: Shutdown completes without errors

**AC-6.1:** The developer can clear the conversation

- **TC-6.1a: Clear removes all messages**
  - Given: The conversation display shows multiple user and agent messages
  - When: The developer triggers "clear conversation"
  - Then: The conversation display is empty; all previous messages are removed
- **TC-6.1b: Clear resets provider context**
  - Given: The developer has had a multi-turn conversation
  - When: The developer clears the conversation and sends a new message
  - Then: The provider treats the new message as the start of a fresh conversation (no prior context)

  *Implementation note: `chat:clear` discards the stored `sessionId` in `ProviderManager`, so the next `chat:send` spawns without `--resume`.*

- **TC-6.1c: Clear sends `chat:clear` message**
  - Given: The WebSocket connection is open
  - When: The developer triggers "clear conversation"
  - Then: A `chat:clear` message is sent over the WebSocket

**AC-6.2:** The developer can cancel an in-progress response from the UI

- **TC-6.2a: Cancel button visible during streaming**
  - Given: A response is streaming
  - When: The developer views the chat panel
  - Then: A cancel button or action is visible
- **TC-6.2b: Cancel button hidden when idle**
  - Given: No response is streaming
  - When: The developer views the chat panel
  - Then: No cancel button is visible

**AC-6.3:** Clearing the conversation while a response is streaming cancels the response first

- **TC-6.3a: Clear during streaming**
  - Given: A response is actively streaming
  - When: The developer triggers "clear conversation"
  - Then: The streaming response is cancelled, then the conversation is cleared

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Cancellation (ProviderManager.cancel):**

```typescript
cancel(messageId: string): void {
  // 1. Send SIGINT to CLI process
  // 2. Fallback: SIGTERM after 2 seconds if not exited
  // 3. Last resort: SIGKILL after 2 more seconds
  // 4. Emit done(messageId, cancelled: true)
}
```

SIGINT is the primary mechanism — the Claude CLI handles it gracefully, stopping generation. The fallback addresses known issues with SIGINT in `stream-json` mode during active tool execution.

**Clear (ProviderManager.clear):**

```typescript
clear(): void {
  // If streaming, cancel first (AC-6.3)
  // Discard sessionId — next send starts fresh without --resume
}
```

**Shutdown (ProviderManager.shutdown):**

```typescript
async shutdown(): Promise<void> {
  // SIGTERM to running process
  // Wait up to 5 seconds for exit
  // SIGKILL if still alive
}
```

Registered via `app.addHook('onClose', async () => providerManager.shutdown())`.

**Client-Side Cancel/Clear:**

Cancel button visibility controlled by `state.activeMessageId !== null`. Clear handler: if streaming, sends `chat:cancel` first, then `chat:clear`, then calls `chatState.clearMessages()`.

See the tech design document for full architecture, implementation targets, and test mapping.

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] CLI process crash detected → `chat:error` with `PROVIDER_CRASHED` + `chat:status` with `provider:crashed`
- [ ] Next message after crash spawns a new CLI process (transparent recovery)
- [ ] Cancel sends SIGINT → `chat:done` with `cancelled: true`, partial response preserved
- [ ] Cancel fallback: SIGTERM after 2s, SIGKILL after 4s
- [ ] Graceful shutdown kills CLI process within 5 seconds, no orphaned processes
- [ ] Clear empties conversation, sends `chat:clear`, discards `sessionId`
- [ ] Cancel button visible during streaming, hidden when idle
- [ ] Clear during streaming cancels first, then clears
- [ ] All tests pass: `npm run verify`
- [ ] TCs 5.2a–5.2c, 5.3a–5.3b, 5.4a–5.4b, 6.1a–6.1c, 6.2a–6.2b, 6.3a covered

---

## Story 5: Script Execution (Exploratory)

### Summary
<!-- Jira: Summary field -->

Stream parser script block interception, sandboxed VM execution with curated methods, and result relay to CLI stdin.

### Description
<!-- Jira: Description field -->

**User Profile:** (same as Story 0)

**Objective:**
Establish the exploratory script execution pipeline. The stream parser intercepts `<steward-script>` blocks from the CLI output, executes them in a `vm.runInNewContext()` sandbox with a curated set of methods, and relays the result back to the CLI's stdin. Normal text passes through unaffected. Script block text is NOT sent to the client. This story is explicitly experimental — it establishes the pattern for future Steward capabilities. Script execution is non-blocking for the core chat plumbing delivery (Stories 0-4).

**Scope:**

In scope:
- Stream parser script block detection: `<steward-script>` opening tag, `</steward-script>` closing tag
- Mixed content handling: text-script-text sequences within a single event
- Partial script block across multiple stdout chunks (buffering)
- Malformed script block handling (no closing tag before response ends)
- `ScriptExecutor` with `vm.runInNewContext()` — curated method surface only
- VM sandbox: no `require`, `process`, `fs`, `child_process`, `global`
- Execution timeout to prevent infinite loops
- Result relay to CLI stdin as JSON
- Error containment — script errors produce error results, not server crashes

Out of scope:
- Expanded method surface beyond `showNotification()` (Epics 12-14)
- `isolated-vm` upgrade (future, before distribution)
- Wiring script results to actual UI notifications (future — `showNotification` is a placeholder in Epic 10)

**Dependencies:** Story 3 (provider and stream parser must exist)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-7.1:** The stream parser distinguishes normal text from XML-fenced script blocks in the CLI output

- **TC-7.1a: Normal text passes through**
  - Given: The CLI is streaming a response
  - When: The output contains plain text (no XML script fences)
  - Then: All text is relayed to the client as `chat:token` messages
- **TC-7.1b: Script block intercepted**
  - Given: The CLI is streaming a response
  - When: The output contains an XML-fenced script block
  - Then: The script block content is intercepted and NOT sent to the client as a `chat:token`
- **TC-7.1c: Mixed content handled correctly**
  - Given: The CLI is streaming a response
  - When: The output contains normal text followed by a script block followed by more normal text
  - Then: The normal text portions are relayed to the client, the script block is intercepted, and the subsequent normal text continues relaying
- **TC-7.1d: Partial script block across stdout chunks**
  - Given: The CLI is streaming a response
  - When: A script block's opening tag arrives in one stdout chunk and the closing tag arrives in a subsequent chunk
  - Then: The parser buffers the partial block and processes it correctly when the closing tag arrives; no partial script content is leaked to the client
- **TC-7.1e: Malformed script block degrades gracefully**
  - Given: The CLI is streaming a response
  - When: The output contains a script opening tag but no closing tag before the response ends
  - Then: The buffered content is discarded or relayed as text; the server does not hang waiting for a closing tag

**AC-7.2:** Intercepted script blocks are executed in a sandboxed VM with a curated method surface

- **TC-7.2a: Script executes with curated methods**
  - Given: A script block calls a curated method (e.g., `showNotification("hello")`)
  - When: The script is executed in the VM
  - Then: The curated method is invoked and produces the expected side effect
- **TC-7.2b: Script cannot access Node.js globals**
  - Given: A script block attempts to access `require`, `process`, `fs`, or `global`
  - When: The script is executed in the VM
  - Then: The access fails (variables are undefined or throw a ReferenceError)
- **TC-7.2c: Script execution has a timeout**
  - Given: A script block contains an infinite loop
  - When: The script is executed in the VM
  - Then: Execution is terminated after the configured timeout and an error result is returned

**AC-7.3:** Script execution results are relayed back to the CLI process

- **TC-7.3a: Successful result sent to stdin**
  - Given: A script block executes successfully and returns a result
  - When: Execution completes
  - Then: The result is written to the CLI process's stdin in a format the CLI can process
- **TC-7.3b: Error result sent to stdin**
  - Given: A script block throws an error during execution
  - When: Execution fails
  - Then: An error description is written to the CLI process's stdin so the CLI can respond appropriately

**AC-7.4:** Script execution errors do not crash the server or the CLI process

- **TC-7.4a: Script error is contained**
  - Given: A script block throws an unhandled exception
  - When: The error is caught
  - Then: The server continues operating, the CLI process continues operating, and an error result is sent back
- **TC-7.4b: VM timeout is contained**
  - Given: A script block times out
  - When: The timeout fires
  - Then: The server sends an error result to the CLI and continues processing subsequent output

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Stream Parser Script Interception (server/services/stream-parser.ts):**

```typescript
const SCRIPT_OPEN_TAG = '<steward-script>';
const SCRIPT_CLOSE_TAG = '</steward-script>';

export interface TextEvent { type: 'text'; text: string; }
export interface ScriptEvent { type: 'script'; content: string; }
export interface ResultEvent { type: 'result'; sessionId?: string; text?: string; }
export interface ErrorEvent { type: 'error'; message: string; }
export type ParsedEvent = TextEvent | ScriptEvent | ResultEvent | ErrorEvent;
```

The `processTextContent()` method uses a `scriptBuffer` to accumulate partial script blocks across multiple `parse()` calls. When a `result` event arrives while `scriptBuffer` is non-null, the buffered content is flushed as text (malformed block handling).

**Script Executor (server/services/script-executor.ts):**

```typescript
export interface ScriptResult {
  success: boolean;
  value?: unknown;
  error?: string;
}

export class ScriptExecutor {
  constructor(timeoutMs?: number);  // Default: 5000ms
  execute(content: string): Promise<ScriptResult>;
}
```

VM context contains only curated methods — `showNotification()` for Epic 10 (returns confirmation string, actual UI wiring in future epics). No `require`, `process`, `fs`, `child_process`, or `global`. The `timeout` option on `vm.runInNewContext` prevents infinite loops.

**Script Result Relay Format:**

```json
{"type":"steward-script-result","success":true,"value":"notification: hello"}
{"type":"steward-script-result","success":false,"error":"ReferenceError: fs is not defined"}
```

Written to the CLI process's stdin. The process is still alive during script execution (mid-generation, waiting for tool results via `--max-turns`). If the process has already exited (race condition), the stdin write is silently dropped.

**Script Context (curated methods):**

```typescript
interface ScriptContext {
  showNotification(message: string): void;
  // Additional curated methods added as Epics 12-14 deliver capabilities
}
```

See the tech design document for full architecture, implementation targets, and test mapping.

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Stream parser detects `<steward-script>` blocks and intercepts them
- [ ] Normal text passes through to client, script block text does NOT
- [ ] Mixed content (text-script-text) handled correctly
- [ ] Partial script blocks across chunks buffered and processed
- [ ] Malformed blocks (no closing tag) degraded gracefully
- [ ] Script executor runs in `vm.runInNewContext` with curated methods only
- [ ] `require`, `process`, `fs`, `global` are undefined in VM context
- [ ] Script timeout prevents infinite loops
- [ ] Successful results relayed to CLI stdin as JSON
- [ ] Error results relayed to CLI stdin as JSON
- [ ] Script errors do not crash server or CLI process
- [ ] All tests pass: `npm run verify`
- [ ] TCs 7.1a–7.1e, 7.2a–7.2c, 7.3a–7.3b, 7.4a–7.4b covered

---

## Integration Path Trace

### Path 1: Developer Sends a Message and Receives a Streamed Response

The primary end-to-end path: enable feature → mount panel → connect WebSocket → type message → send → spawn CLI → stream tokens → display response.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Feature flag enabled | Server reads flag, exposes via REST, client fetches | Story 0 | TC-1.1a, TC-1.4a, TC-1.4b |
| Chat panel mounted | Panel DOM created, layout extended | Story 1 | TC-2.1a |
| WebSocket connected | Client connects to `/ws/chat` | Story 2 | TC-3.1a |
| Developer types message | Text entered in input area | Story 1 | TC-2.4a |
| Send button clicked | Message dispatched via WebSocket | Story 3 | TC-2.4b (wired), TC-4.1a |
| CLI spawned (first message) | Lazy init — provider spawns CLI process | Story 3 | TC-5.1b, TC-5.7a |
| CLI ready | First stdout event, status update | Story 3 | TC-5.7b |
| Tokens streamed | CLI output parsed, relayed as `chat:token` | Story 3 | TC-4.2a, TC-4.3a |
| Tokens displayed | Conversation display appends text progressively | Story 3 | TC-4.2a |
| Auto-scroll | Display scrolls to show latest content | Story 3 | TC-2.5a |
| Response complete | `chat:done` sent, input re-enabled | Story 3 | TC-4.1b, TC-4.5b |

### Path 2: Developer Cancels a Streaming Response and Clears Conversation

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Response streaming | Active stream in progress | Story 3 | TC-4.2a |
| Cancel button visible | UI shows cancel action | Story 4 | TC-6.2a |
| Cancel triggered | Developer clicks cancel | Story 4 | TC-5.3a |
| SIGINT sent | CLI process receives interrupt | Story 4 | TC-5.3a |
| Partial response preserved | `chat:done` with `cancelled: true` | Story 4 | TC-5.3a |
| Clear triggered | Developer clicks clear | Story 4 | TC-6.1a |
| Conversation emptied | All messages removed from display | Story 4 | TC-6.1a |
| Session reset | `sessionId` discarded, next message starts fresh | Story 4 | TC-6.1b |

### Path 3: Script Block Intercepted and Executed

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| CLI emits mixed output | Text + script block in response | Story 5 | TC-7.1c |
| Text relayed to client | Normal text sent as `chat:token` | Story 5 | TC-7.1a |
| Script block intercepted | `<steward-script>` block caught by parser | Story 5 | TC-7.1b |
| Script executed in VM | `vm.runInNewContext` with curated methods | Story 5 | TC-7.2a |
| Result relayed to CLI | JSON result written to stdin | Story 5 | TC-7.3a |
| Script error contained | Error result returned, server continues | Story 5 | TC-7.4a |

---

## Coverage Gate

Every AC and TC from the detailed epic mapped to exactly one story.

| AC | TC | Story |
|----|-----|-------|
| AC-1.1 | TC-1.1a, TC-1.1b, TC-1.1c | Story 0 |
| AC-1.2 | TC-1.2a, TC-1.2b | Story 0 |
| AC-1.3 | TC-1.3a, TC-1.3b | Story 0 |
| AC-1.4 | TC-1.4a, TC-1.4b | Story 0 |
| AC-2.1 | TC-2.1a, TC-2.1b | Story 1 |
| AC-2.2 | TC-2.2a, TC-2.2b, TC-2.2c | Story 1 |
| AC-2.3 | TC-2.3a, TC-2.3b, TC-2.3c | Story 3 |
| AC-2.4 | TC-2.4a, TC-2.4b, TC-2.4c | Story 1 |
| AC-2.5 | TC-2.5a, TC-2.5b | Story 3 |
| AC-3.1 | TC-3.1a, TC-3.1b | Story 2 |
| AC-3.2 | TC-3.2a, TC-3.2b, TC-3.2c | Story 2 |
| AC-3.3 | TC-3.3a, TC-3.3b, TC-3.3c | Story 2 |
| AC-3.4 | TC-3.4a, TC-3.4b | Story 2 |
| AC-3.5 | TC-3.5a, TC-3.5b, TC-3.5c | Story 2 |
| AC-4.1 | TC-4.1a, TC-4.1b | Story 3 |
| AC-4.2 | TC-4.2a, TC-4.2b | Story 3 |
| AC-4.3 | TC-4.3a, TC-4.3b | Story 3 |
| AC-4.4 | TC-4.4a, TC-4.4b | Story 3 |
| AC-4.5 | TC-4.5a, TC-4.5b | Story 3 |
| AC-4.6 | TC-4.6a, TC-4.6b | Story 3 |
| AC-5.1 | TC-5.1a, TC-5.1b | Story 3 |
| AC-5.2 | TC-5.2a, TC-5.2b, TC-5.2c | Story 4 |
| AC-5.3 | TC-5.3a, TC-5.3b | Story 4 |
| AC-5.4 | TC-5.4a, TC-5.4b | Story 4 |
| AC-5.5 | TC-5.5a, TC-5.5b | Story 3 |
| AC-5.6 | TC-5.6a | Story 3 |
| AC-5.7 | TC-5.7a, TC-5.7b, TC-5.7c, TC-5.7d | Story 3 |
| AC-5.8 | TC-5.8a, TC-5.8b | Story 3 |
| AC-6.1 | TC-6.1a, TC-6.1b, TC-6.1c | Story 4 |
| AC-6.2 | TC-6.2a, TC-6.2b | Story 4 |
| AC-6.3 | TC-6.3a | Story 4 |
| AC-7.1 | TC-7.1a, TC-7.1b, TC-7.1c, TC-7.1d, TC-7.1e | Story 5 |
| AC-7.2 | TC-7.2a, TC-7.2b, TC-7.2c | Story 5 |
| AC-7.3 | TC-7.3a, TC-7.3b | Story 5 |
| AC-7.4 | TC-7.4a, TC-7.4b | Story 5 |

**Total: 35 ACs, 83 TCs — all mapped to exactly one story. No orphans.**
