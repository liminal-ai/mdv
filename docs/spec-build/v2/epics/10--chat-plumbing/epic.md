# Epic 10: Chat Plumbing

This epic defines the complete requirements for the Spec Steward's infrastructure
layer — feature flags, CLI provider abstraction, WebSocket streaming, a basic
chat panel, and exploratory script execution. It serves as the source of truth
for the Tech Lead's design work.

---

## User Profile

**Primary User:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward
**Context:** Working on spec-driven development within the viewer and wanting a chat interface that connects to the Claude CLI for conversational agent interaction, without leaving the tool
**Mental Model:** "I enable a flag, a chat panel appears, I type a message, and the Claude CLI streams a response back to me in real time"
**Key Constraint:** Must be completely invisible when disabled — zero UI, zero WebSocket connections, zero provider processes. Vanilla JS frontend, no component framework. The CLI is a child process (stdin/stdout), not an SDK.

---

## Feature Overview

After this epic, the developer can enable the `FEATURE_SPEC_STEWARD` flag and
get a chat sidebar panel on the right side of the viewer. They type a message,
the server spawns a Claude CLI process and pipes the message to it, and the
response streams back as plain text through a WebSocket connection. The developer
can cancel a response mid-stream, clear the conversation, or start a new one.
If the CLI process crashes, the system recovers and tells the developer what
happened. When the flag is off, no trace of this feature exists in the UI or
runtime.

The epic also establishes exploratory infrastructure for script execution — the
server intercepts XML-fenced script blocks from the CLI output stream and
executes them in a sandboxed VM against a curated set of app operations. This
is experimental plumbing for future Steward capabilities.

---

## Scope

### In Scope

Infrastructure layer that connects a chat panel to a CLI provider through a
streaming WebSocket:

- Feature flag infrastructure: `FEATURE_SPEC_STEWARD` env var + config file, `GET /api/features` endpoint, `shared/features.ts` module, conditional initialization on both server and client
- CLI provider abstraction: provider interface for spawning, messaging, streaming, cancelling, and shutting down a CLI process
- Claude CLI as initial provider: implements the provider interface by spawning the `claude` CLI, piping stdin/stdout, parsing streaming output, managing process lifecycle
- WebSocket streaming server: `/ws/chat` route (separate from existing `/ws`), typed Zod message schemas, relay between provider and client
- Basic chat sidebar panel: resizable right-hand panel, conversation display with user/agent message distinction, input area with send, plain text streaming, auto-scroll
- Basic conversation management: clear conversation, start new conversation, cancel in-progress response
- Exploratory script execution: XML-fenced block interception from CLI output, `vm.runInNewContext()` execution against curated method surface, result relay back to CLI

### Out of Scope

- Streaming markdown rendering in chat (Epic 11)
- Syntax highlighting or Mermaid in chat responses (Epic 11)
- Chat UI polish, keyboard shortcuts (including Enter-to-send), animation (Epic 11)
- Document awareness or context injection (Epic 12)
- Conversation persistence across app restarts (Epic 12)
- Package awareness (Epic 13)
- Background pipeline workers or concurrent task management (Epic 14)
- Custom agent harnesses beyond Claude CLI (future — provider interface supports it)
- Distribution beyond the primary user (requires security review of script execution)

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | The Claude CLI can be spawned as a child process and communicated with via stdin/stdout for conversational interaction | Unvalidated | Tech Lead | CLI is primarily interactive; need to verify headless/pipe mode |
| A2 | The Claude CLI supports streaming output in a parseable format (line-delimited text or structured JSON) | Unvalidated | Tech Lead | Parsing strategy depends on actual output format |
| A3 | The existing @fastify/websocket setup supports multiple WS routes (`/ws` and `/ws/chat`) without conflicts | Unvalidated | Tech Lead | Currently only one route (`/ws`) |
| A4 | Vanilla JS is sufficient for a basic streaming chat panel (plain text, no markdown rendering) | Validated | — | Minimal DOM updates for text append |
| A5 | The `vm.runInNewContext()` approach provides sufficient isolation for the exploratory threat model (prevent accidental damage, not defend against determined attack) | Unvalidated | Tech Lead | Known escape vectors exist; acceptable for single-user local app |
| A6 | The Claude CLI is installed and available on the developer's PATH | Unvalidated | — | The provider should detect absence and report a clear error |

---

## Flows & Requirements

### 1. Feature Flag Infrastructure

The feature flag controls whether any Spec Steward code initializes. A
`shared/features.ts` module reads the flag from environment variables and an
optional config file. The server exposes the flag state via a REST endpoint.
The client checks the endpoint at startup and conditionally mounts the chat
panel and WebSocket connection.

1. App starts
2. Server reads `FEATURE_SPEC_STEWARD` from environment / config file
3. Server registers `GET /api/features` endpoint
4. Client fetches `GET /api/features` during bootstrap
5. If disabled: client skips chat panel mount, no `/ws/chat` connection, done
6. If enabled: client mounts chat panel and connects to `/ws/chat`

#### Acceptance Criteria

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

### 2. Chat Panel Layout and Interaction

The chat panel is a resizable panel on the right side of the viewer. It appears
when the feature flag is enabled. It contains a conversation display area and
an input area. The panel can be resized by dragging its left edge. The panel
width persists across page loads.

1. Feature flag is enabled and app loads
2. Chat panel appears on the right side of the layout
3. Developer resizes the panel by dragging the left edge
4. Panel width is stored in localStorage
5. On next load, the panel restores its previous width

#### Acceptance Criteria

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

**AC-2.4:** The input area allows the developer to type a message and send it

- **TC-2.4a: Text input works**
  - Given: The chat panel is visible
  - When: The developer clicks the input area and types text
  - Then: The typed text appears in the input area
- **TC-2.4b: Send action dispatches the message**
  - Given: The developer has typed text in the input area
  - When: The developer clicks the send button
  - Then: The message is sent (appears in conversation as a user message) and the input area is cleared
- **TC-2.4c: Empty input does not send**
  - Given: The input area is empty (or contains only whitespace)
  - When: The developer clicks the send button
  - Then: No message is sent; the conversation display does not change

**AC-2.5:** The conversation display auto-scrolls to show the latest content during streaming

- **TC-2.5a: Auto-scroll during response**
  - Given: An agent response is streaming and the conversation display is scrolled to the bottom
  - When: New text tokens arrive
  - Then: The conversation display scrolls to keep the latest text visible
- **TC-2.5b: No auto-scroll when user has scrolled up**
  - Given: An agent response is streaming
  - When: The developer manually scrolls up in the conversation display
  - Then: Auto-scroll stops; the view stays at the developer's scroll position

### 3. WebSocket Chat Connection

A separate WebSocket connection on `/ws/chat` handles all chat communication.
The connection is established when the feature flag is enabled and the client
mounts. Messages are typed with Zod schemas. The connection reconnects
automatically if dropped.

1. Client connects to `/ws/chat`
2. Server accepts the connection (origin check)
3. Client sends messages, server relays to provider
4. Server streams responses back
5. If connection drops, client reconnects automatically

#### Acceptance Criteria

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

### 4. Chat Message Streaming

The developer sends a message and receives a streamed response. The client sends
a `chat:send` message, the server forwards it to the provider, and the provider's
streaming output is relayed back as a sequence of `chat:token` messages followed
by a `chat:done` message. Each exchange is correlated by a message ID.

1. Developer types a message and sends it
2. Client sends `chat:send` with message text and a generated message ID
3. Server receives the message and forwards it to the active provider
4. Provider streams response tokens
5. Server relays each token batch as `chat:token` with the correlation message ID
6. Provider signals completion
7. Server sends `chat:done` with the correlation message ID
8. Client marks the response as complete

#### Acceptance Criteria

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

### 5. Provider Lifecycle Management

The provider manager starts the CLI process when the first message is sent
(lazy initialization), monitors its health, handles crashes by restarting, and
shuts down gracefully when the app exits. Cancellation sends an interrupt signal
to the CLI process.

1. Developer sends the first message
2. Provider manager spawns the Claude CLI process
3. CLI process begins and is ready for input
4. (Normal operation — messages flow through)
5. CLI process crashes unexpectedly
6. Provider manager detects the crash
7. Provider manager reports the error to the client
8. On the next message, provider manager restarts the CLI process
9. App shuts down — provider manager kills the CLI process

#### Acceptance Criteria

**AC-5.1:** The provider spawns the CLI process on first use (lazy initialization), not at server startup

- **TC-5.1a: No process at startup**
  - Given: The feature flag is enabled and the server starts
  - When: No message has been sent
  - Then: No CLI child process is running
- **TC-5.1b: Process spawns on first message**
  - Given: No CLI process is running
  - When: The developer sends the first `chat:send` message
  - Then: A CLI child process is spawned before the message is forwarded

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

**AC-5.4:** The provider shuts down the CLI process when the app exits

- **TC-5.4a: Graceful shutdown**
  - Given: The CLI process is running
  - When: The server begins shutdown (SIGINT or SIGTERM)
  - Then: The CLI process is terminated and no orphaned processes remain
- **TC-5.4b: Shutdown with no active process**
  - Given: The CLI process is not running (never spawned or already exited)
  - When: The server shuts down
  - Then: Shutdown completes without errors

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

### 6. Conversation Management

The developer can clear the current conversation, cancel an in-progress response,
and start fresh. "Clear conversation" and "new conversation" are the same action
— clearing the display and resetting the provider's conversation context. There
is no separate "new conversation" action.

1. Developer has an ongoing conversation
2. Developer triggers "clear conversation"
3. Conversation display is emptied
4. Provider's conversation context is reset
5. Developer sends a new message — treated as a fresh conversation

#### Acceptance Criteria

**AC-6.1:** The developer can clear the conversation

- **TC-6.1a: Clear removes all messages**
  - Given: The conversation display shows multiple user and agent messages
  - When: The developer triggers "clear conversation"
  - Then: The conversation display is empty; all previous messages are removed
- **TC-6.1b: Clear resets provider context**
  - Given: The developer has had a multi-turn conversation
  - When: The developer clears the conversation and sends a new message
  - Then: The provider treats the new message as the start of a fresh conversation (no prior context)
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

### 7. Script Execution (Exploratory)

The server's stream parser intercepts XML-fenced script blocks from the CLI
output before they reach the client. The script content is executed in a
`vm.runInNewContext()` sandbox with a curated set of app operation methods. The
execution result is relayed back to the CLI process's stdin. Normal text and
built-in CLI tool calls pass through unaffected.

1. CLI emits mixed output: normal text, built-in tool calls, XML-fenced script blocks
2. Server's stream parser identifies each content type
3. Normal text → relayed to client as `chat:token`
4. Built-in tool calls → handled by CLI's own harness (transparent to the server)
5. XML-fenced script block → intercepted by server
6. Server executes the script in `vm.runInNewContext()` with curated methods
7. Execution result sent back to CLI process stdin
8. Script block text is NOT sent to the client as chat output

#### Acceptance Criteria

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

---

## Data Contracts

### Feature Flags

**`GET /api/features` Response:**

```typescript
interface FeaturesResponse {
  specSteward: boolean;
}
```

### Chat WebSocket Message Schemas

**Client → Server:**

```typescript
interface ChatSendMessage {
  type: 'chat:send';
  messageId: string;       // Client-generated UUID
  text: string;            // User's message text
  context?: ProviderContext; // Optional — expanded in Epics 12-13
}

interface ChatCancelMessage {
  type: 'chat:cancel';
  messageId: string;       // ID of the message to cancel
}

interface ChatClearMessage {
  type: 'chat:clear';
}

type ChatClientMessage = ChatSendMessage | ChatCancelMessage | ChatClearMessage;
```

**Server → Client:**

```typescript
interface ChatTokenMessage {
  type: 'chat:token';
  messageId: string;       // Correlation ID matching the chat:send
  text: string;            // Token batch text
}

interface ChatDoneMessage {
  type: 'chat:done';
  messageId: string;       // Correlation ID matching the chat:send
  cancelled?: boolean;     // true if response was cancelled
}

interface ChatErrorMessage {
  type: 'chat:error';
  messageId?: string;      // Present if error relates to a specific message
  code: string;            // Machine-readable error code
  message: string;         // Human-readable error description
}

interface ChatStatusMessage {
  type: 'chat:status';
  status: 'provider:ready' | 'provider:starting' | 'provider:crashed' | 'provider:not-found';
  message?: string;        // Optional human-readable detail
}

type ChatServerMessage =
  | ChatTokenMessage
  | ChatDoneMessage
  | ChatErrorMessage
  | ChatStatusMessage;
```

**`chat:error` vs `chat:status` distinction:** `chat:error` is per-message — it carries a `messageId` when the error relates to a specific `chat:send` (e.g., provider crash during a response). `chat:status` is connection-wide provider state — it reports lifecycle transitions (starting, ready, crashed, not-found) independent of any specific message. Both may be sent for the same event (e.g., a crash sends `chat:status` with `provider:crashed` AND `chat:error` with `PROVIDER_CRASHED` for any in-flight message).

**Future message types:** Additional server message types (`chat:file-created`) are defined by Epics 12-14 and are not included in this epic's contract.

### Chat Error Codes

| Code | Description |
|------|-------------|
| `INVALID_MESSAGE` | Client message did not match any schema |
| `PROVIDER_NOT_FOUND` | CLI executable not found on PATH |
| `PROVIDER_CRASHED` | CLI process exited unexpectedly |
| `PROVIDER_TIMEOUT` | CLI process did not start within timeout |
| `PROVIDER_BUSY` | A message is already being processed |
| `SCRIPT_ERROR` | Script block execution failed |
| `SCRIPT_TIMEOUT` | Script block execution timed out |
| `CANCELLED` | Response was cancelled by the user |

### Provider Interface

```typescript
interface ProviderConfig {
  command: string;         // CLI command (e.g., "claude")
  args?: string[];         // CLI arguments
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
  fatal: boolean;          // true if the process needs restart
}
```

### Script Execution Context

```typescript
interface ScriptContext {
  showNotification(message: string): void;
  // Additional curated methods added as Epics 12-14 deliver capabilities
}

interface ScriptResult {
  success: boolean;
  value?: unknown;         // Return value on success
  error?: string;          // Error message on failure
}
```

---

## Dependencies

Technical dependencies:
- v1 (Epics 1-6) complete and stable
- Epic 7 (E2E framework) complete — test patterns available for new E2E tests
- Node.js `child_process` (built-in) for CLI spawning
- Node.js `vm` (built-in) for script execution
- @fastify/websocket (existing) for the new `/ws/chat` route
- Zod (existing) for message schema validation
- Claude CLI installed on developer's machine

Process dependencies:
- None

---

## Non-Functional Requirements

### Feature Isolation
- When the feature flag is disabled: zero additional DOM elements, zero WebSocket connections, zero child processes, zero added startup latency
- Steward code modules are isolated from core viewer code — conditional loading, not interleaved

### Streaming Performance
- First `chat:token` arrives at the client within 2 seconds of the provider receiving the message (excluding CLI startup time on first use)
- Token relay latency from provider stdout to client WebSocket is under 50ms per batch

### Provider Reliability
- CLI process crash does not crash the server
- CLI process crash does not leave orphaned child processes
- Graceful server shutdown terminates all CLI child processes within 5 seconds
- Provider restart (after crash) is transparent — the developer sends a new message and it works

### Script Execution Safety
- Script execution timeout prevents infinite loops from hanging the server
- Script VM has no access to `require`, `process`, `fs`, `child_process`, or `global`
- Script execution errors are contained — they produce error results, not server crashes

### Connection Stability
- Chat WebSocket reconnects automatically after connection drops (within 2-5 seconds)
- Messages sent during reconnection are queued or the developer is notified that the connection is down

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. What is the exact format of the Claude CLI's streaming output when invoked as a child process? Is it line-delimited text, structured JSON, or a mix? What flags control the output format?
2. How should the CLI process be spawned — what arguments, working directory, and environment variables are needed for headless/pipe mode? Does the CLI support a `--pipe` or `--no-interactive` flag?
3. What is the exact XML tag convention for script blocks? How are they delimited in the CLI output stream, and how does the stream parser handle partial blocks (block split across multiple stdout chunks)?
4. How should conversation context be managed in the CLI process? Does the CLI maintain its own conversation history, or does the server need to replay prior messages on each turn?
5. What is the cancel mechanism for the CLI process? SIGINT? A control character on stdin? Does the CLI support a graceful cancellation protocol?
6. How should the chat panel DOM structure work — a single scrollable container with message elements, or a virtual-scroll approach? What are the DOM element limits for conversation length?
7. Should the chat WebSocket client be a separate class (like the existing `WsClient`) or extend the existing one? What's the module boundary?
8. How should the config file for feature flags work — JSON, YAML, or `.env`? Where does it live? What's the merge order with env vars?
9. How does the provider know when the CLI is "ready" after spawning? Is there a ready signal, or is it ready when the process is running and stdin is open?
10. What is the exact content format for relaying script results back to the CLI's stdin? Plain text? JSON? XML-wrapped to match the request format?
11. ~~How should the server handle a second `chat:send` while the first is still streaming?~~ **Resolved:** AC-4.6 specifies rejection with `PROVIDER_BUSY`.

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

**Delivers:** Feature flag module (`shared/features.ts`), `GET /api/features`
endpoint, chat WebSocket message schemas (Zod), provider interface type
definitions, project configuration for new modules. The feature flag controls
conditional initialization — when disabled, no Steward code runs.

**Prerequisite:** None

**ACs covered:**
- AC-1.1 (feature flag endpoint)
- AC-1.2 (no server-side execution when disabled)
- AC-1.3 (no client-side UI when disabled)
- AC-1.4 (shared features module)

**Estimated test count:** 8-10 tests

### Story 1: Chat Panel Shell and Layout

**Delivers:** The basic chat panel UI — resizable right-hand panel with
conversation display area and input area. Panel mounts conditionally based on
the feature flag. Resize and persistence work. No WebSocket connection yet —
the panel is a visual shell.

**Prerequisite:** Story 0

**ACs covered:**
- AC-2.1 (chat panel in layout)
- AC-2.2 (resize behavior)
- AC-2.4 (input area — UI only, send is wired in Story 3)

**Estimated test count:** 6-8 tests

### Story 2: WebSocket Chat Connection

**Delivers:** The `/ws/chat` WebSocket route on the server and the chat WebSocket
client on the frontend. Connection lifecycle (connect, reconnect, origin check),
message validation against Zod schemas. No provider yet — messages are received
but not forwarded.

**Prerequisite:** Story 0

**ACs covered:**
- AC-3.1 (WebSocket connection established)
- AC-3.2 (origin checking)
- AC-3.3 (message schema validation)
- AC-3.4 (reconnection)
- AC-3.5 (disconnected indicator and send blocking)

**Estimated test count:** 10-12 tests

### Story 3: Provider and Message Streaming

**Delivers:** The Claude CLI provider implementation and end-to-end message
streaming. The developer sends a message, it flows through the WebSocket to the
provider, the CLI streams a response, tokens are relayed back to the chat panel.
The full send-stream-display loop works.

**Prerequisite:** Stories 1 and 2

**ACs covered:**
- AC-2.3 (conversation display with user/agent distinction)
- AC-2.5 (auto-scroll during streaming)
- AC-4.1 (send initiates streamed response)
- AC-4.2 (tokens appear progressively)
- AC-4.3 (correlation by message ID)
- AC-4.4 (loading indicator)
- AC-4.5 (input disabled during streaming)
- AC-4.6 (server-side busy rejection)
- AC-5.1 (lazy initialization)
- AC-5.5 (CLI not found error)
- AC-5.6 (startup timeout)
- AC-5.7 (provider status messages)
- AC-5.8 (CLI authentication failure)

**Estimated test count:** 20-25 tests

### Story 4: Provider Resilience and Conversation Management

**Delivers:** Crash recovery, cancellation, graceful shutdown, and conversation
management (clear, cancel from UI). The developer can cancel mid-stream, clear
the conversation, and recover from provider crashes.

**Prerequisite:** Story 3

**ACs covered:**
- AC-5.2 (crash detection and recovery)
- AC-5.3 (cancellation)
- AC-5.4 (graceful shutdown)
- AC-6.1 (clear conversation)
- AC-6.2 (cancel button visibility)
- AC-6.3 (clear during streaming)

**Estimated test count:** 12-15 tests

### Story 5: Script Execution (Exploratory)

**Delivers:** Stream parser script block interception, VM execution with curated
methods, result relay to CLI stdin. The exploratory script execution pipeline
works end-to-end. This story is explicitly experimental — it establishes the
pattern for future expansion. Script execution is included per the Technical
Architecture document's scope for Epic 10 but is non-blocking for the core
chat plumbing delivery (Stories 0-4).

**Prerequisite:** Story 3

**ACs covered:**
- AC-7.1 (stream parser distinguishes text from script blocks)
- AC-7.2 (sandboxed VM execution)
- AC-7.3 (result relay to CLI)
- AC-7.4 (error containment)

**Estimated test count:** 10-12 tests

---

## Validation Checklist

- [x] User Profile has all four fields + Feature Overview
- [x] Flows cover all paths (happy, alternate, cancel/error)
- [x] Every AC is testable (no vague terms)
- [x] Every AC has at least one TC
- [x] TCs cover happy path, edge cases, and errors
- [x] Data contracts are fully typed (message schemas, provider interface, feature API, script context)
- [x] Scope boundaries are explicit (in/out/assumptions)
- [x] Dependencies documented
- [x] Story breakdown covers all ACs (35 ACs mapped across Stories 0-5)
- [x] Stories sequence logically (infrastructure → shell → connection → streaming → resilience → experimental)
- [x] Self-review complete
