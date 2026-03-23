# Epic 10: Chat Plumbing — Business Epic

---

## User Profile
<!-- Jira: Epic Description — User Profile section -->

**Primary User:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward
**Context:** Working on spec-driven development within the viewer and wanting a chat interface that connects to the Claude CLI for conversational agent interaction, without leaving the tool
**Mental Model:** "I enable a flag, a chat panel appears, I type a message, and the Claude CLI streams a response back to me in real time"
**Key Constraint:** Must be completely invisible when disabled — zero UI, zero WebSocket connections, zero provider processes. Vanilla JS frontend, no component framework. The CLI is a child process (stdin/stdout), not an SDK.

---

## Feature Overview
<!-- Jira: Epic Description — Feature Overview section -->

After this epic, the developer can enable the `FEATURE_SPEC_STEWARD` flag and get a chat sidebar panel on the right side of the viewer. They type a message, the server spawns a Claude CLI process and pipes the message to it, and the response streams back as plain text through a WebSocket connection. The developer can cancel a response mid-stream, clear the conversation, or start a new one. If the CLI process crashes, the system recovers and tells the developer what happened. When the flag is off, no trace of this feature exists in the UI or runtime.

The epic also establishes exploratory infrastructure for script execution — the server intercepts XML-fenced script blocks from the CLI output stream and executes them in a sandboxed VM against a curated set of app operations. This is experimental plumbing for future Steward capabilities.

---

## Scope
<!-- Jira: Epic Description — Scope section -->

### In Scope

Infrastructure layer that connects a chat panel to a CLI provider through a streaming WebSocket:

- Feature flag infrastructure: environment variable and optional config file, REST endpoint for client-side checking, shared module, conditional initialization on both server and client
- CLI provider abstraction: interface for spawning, messaging, streaming, cancelling, and shutting down a CLI process
- Claude CLI as initial provider: spawns the CLI as a child process, pipes stdin/stdout, parses streaming output, manages process lifecycle
- WebSocket streaming server: separate chat WebSocket route, typed message schemas, relay between provider and client
- Basic chat sidebar panel: resizable right-hand panel, conversation display with user/agent message distinction, input area with send, plain text streaming, auto-scroll
- Basic conversation management: clear conversation, start new conversation, cancel in-progress response
- Exploratory script execution: XML-fenced block interception from CLI output, sandboxed VM execution against curated method surface, result relay back to CLI

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
| A3 | The existing WebSocket setup supports multiple WS routes without conflicts | Unvalidated | Tech Lead | Currently only one route |
| A4 | Vanilla JS is sufficient for a basic streaming chat panel (plain text, no markdown rendering) | Validated | — | Minimal DOM updates for text append |
| A5 | The sandboxed VM approach provides sufficient isolation for the exploratory threat model (prevent accidental damage, not defend against determined attack) | Unvalidated | Tech Lead | Known escape vectors exist; acceptable for single-user local app |
| A6 | The Claude CLI is installed and available on the developer's PATH | Unvalidated | — | The provider should detect absence and report a clear error |

---

## Flows & Requirements
<!-- Jira: Epic Description — Requirements section -->

### Feature Flag Infrastructure

The feature flag controls whether any Spec Steward code initializes. The flag is read from environment variables and an optional config file. The server exposes the flag state via a REST endpoint. The client checks the endpoint at startup and conditionally mounts the chat panel. When disabled, no Steward code executes — no WebSocket routes, no child processes, no DOM elements.

AC-1.1 through AC-1.4 define: the REST endpoint returns flag state, config file overrides environment variable, no server-side or client-side execution when disabled, and both server and client can check flag state synchronously.

*(See Story 0 for detailed ACs and test conditions.)*

### Chat Panel Layout and Interaction

The chat panel is a resizable panel on the right side of the viewer. It contains a conversation display area and an input area. The panel appears when the feature flag is enabled. The developer can resize the panel by dragging its left edge, and the width persists across page loads.

AC-2.1 and AC-2.2 define panel layout and resize behavior. AC-2.4 defines the input area. AC-2.3 and AC-2.5 define conversation display (user/agent message distinction) and auto-scroll during streaming.

*(See Story 1 for panel shell ACs and test conditions. See Story 3 for conversation display and auto-scroll ACs.)*

### WebSocket Chat Connection

A separate WebSocket connection handles all chat communication. The connection is established when the feature flag is enabled. Messages are validated against typed schemas. The connection reconnects automatically if dropped, and the client shows a disconnected indicator while the connection is down.

AC-3.1 through AC-3.5 define: connection establishment, origin checking (localhost only), message schema validation, automatic reconnection, and disconnected indicator with send blocking.

*(See Story 2 for detailed ACs and test conditions.)*

### Chat Message Streaming

The developer sends a message and receives a streamed response. The response arrives as a sequence of token messages followed by a completion message. Each exchange is correlated by a message ID. The client shows a loading indicator while waiting for the first token, and the input area is disabled during streaming.

AC-4.1 through AC-4.6 define: streaming initiation, progressive token display, message ID correlation, loading indicator, input disabling during streaming, and server-side rejection of concurrent sends.

*(See Story 3 for detailed ACs and test conditions.)*

### Provider Lifecycle Management

The provider manages the CLI process lifecycle. The process is spawned lazily on first message (not at startup). If the CLI crashes, the system reports the error and recovers on the next message. The developer can cancel a streaming response. The provider shuts down gracefully when the app exits. Status messages report lifecycle transitions (starting, ready, crashed, not-found).

AC-5.1 through AC-5.8 define: lazy initialization, crash recovery, cancellation, graceful shutdown, CLI-not-found error, startup timeout, status messages, and authentication failure detection.

*(See Story 3 for initialization, error handling, and status ACs. See Story 4 for crash recovery, cancellation, and shutdown ACs.)*

### Conversation Management

The developer can clear the conversation and cancel an in-progress response from the UI. Clear removes all messages and resets the provider's conversation context so the next message starts fresh. A cancel button appears during streaming and hides when idle. Clearing during streaming cancels the response first.

AC-6.1 through AC-6.3 define: clear conversation behavior, cancel button visibility, and clear-during-streaming sequencing.

*(See Story 4 for detailed ACs and test conditions.)*

### Script Execution (Exploratory)

The server intercepts XML-fenced script blocks from the CLI output before they reach the client. The script content is executed in a sandboxed VM with a curated set of app operation methods. The result is relayed back to the CLI. Normal text passes through unaffected. Script execution errors are contained — they produce error results, not server crashes. This is experimental infrastructure for future Steward capabilities.

AC-7.1 through AC-7.4 define: stream parser text-vs-script discrimination, sandboxed VM execution with curated methods, result relay to CLI, and error containment.

*(See Story 5 for detailed ACs and test conditions.)*

---

## Data Contracts
<!-- Jira: Epic Description — Data Contracts section -->

### Feature Flags

The server exposes a REST endpoint (`GET /api/features`) that returns a JSON object indicating which feature flags are enabled. The response includes a boolean for the Spec Steward feature. The flag is determined by environment variable with optional config file override (config file takes precedence).

### Chat Messages

All chat communication uses typed WebSocket messages. The client sends three message types: send (with message text and a unique ID), cancel (referencing a message ID), and clear. The server sends four message types: token (streaming text chunks correlated to a message ID), done (completion signal, optionally indicating cancellation), error (with machine-readable error code and human-readable description), and status (provider lifecycle state).

Error codes cover: invalid message format, CLI not found, CLI crashed, CLI timeout, concurrent message rejection, CLI authentication failure, script execution failure, script timeout, and user-initiated cancellation.

### Provider Interface

The provider is an abstraction over the CLI process. It exposes operations for sending a message, streaming tokens, handling errors, cancelling, and shutting down. The interface is designed for the Claude CLI as the initial implementation but supports future alternative providers.

### Script Results

Script execution results include a success/failure indicator, an optional return value on success, and an optional error message on failure. Results are relayed to the CLI process so it can respond appropriately to script outcomes.

---

## Non-Functional Requirements
<!-- Jira: Epic Description — NFR section -->

### Feature Isolation
- When the feature flag is disabled: zero additional DOM elements, zero WebSocket connections, zero child processes, zero added startup latency
- Steward code modules are isolated from core viewer code — conditional loading, not interleaved

### Streaming Performance
- First token arrives at the client within 2 seconds of the provider receiving the message (excluding CLI startup time on first use)
- Token relay latency from provider stdout to client WebSocket is under 50ms per batch

### Provider Reliability
- CLI process crash does not crash the server
- CLI process crash does not leave orphaned child processes
- Graceful server shutdown terminates all CLI child processes within 5 seconds
- Provider restart after crash is transparent — the developer sends a new message and it works

### Script Execution Safety
- Script execution timeout prevents infinite loops from hanging the server
- Script VM has no access to system-level APIs or Node.js built-ins
- Script execution errors are contained — they produce error results, not server crashes

### Connection Stability
- Chat WebSocket reconnects automatically after connection drops (within 2-5 seconds)
- Messages sent during reconnection are queued or the developer is notified that the connection is down

---

## Tech Design Questions
<!-- Jira: Epic Description — Tech Design Questions section -->

Questions for the Tech Lead to address during design:

1. What is the exact format of the Claude CLI's streaming output when invoked as a child process? Is it line-delimited text, structured JSON, or a mix? What flags control the output format?
2. How should the CLI process be spawned — what arguments, working directory, and environment variables are needed for headless/pipe mode? Does the CLI support a non-interactive flag?
3. What is the exact XML tag convention for script blocks? How are they delimited in the CLI output stream, and how does the stream parser handle partial blocks (block split across multiple stdout chunks)?
4. How should conversation context be managed in the CLI process? Does the CLI maintain its own conversation history, or does the server need to replay prior messages on each turn?
5. What is the cancel mechanism for the CLI process? Signal-based? A control character on stdin? Does the CLI support a graceful cancellation protocol?
6. How should the chat panel DOM structure work — a single scrollable container with message elements, or a virtual-scroll approach? What are the DOM element limits for conversation length?
7. Should the chat WebSocket client be a separate class or extend the existing one? What's the module boundary?
8. How should the config file for feature flags work — JSON, YAML, or `.env`? Where does it live? What's the merge order with environment variables?
9. How does the provider know when the CLI is "ready" after spawning? Is there a ready signal, or is it ready when the process is running and stdin is open?
10. What is the exact content format for relaying script results back to the CLI's stdin? Plain text? JSON? XML-wrapped to match the request format?
11. ~~How should the server handle a second send while the first is still streaming?~~ **Resolved:** Server-side rejection with a busy error.

---

## Technical Considerations
<!-- Jira: Epic Description — Technical Considerations section -->

- The CLI is invoked as a child process with stdin/stdout piping — not an in-process SDK. Process lifecycle (spawn, crash, restart, shutdown) is managed explicitly.
- The feature flag architecture uses a three-module split (shared types, server-side reader, client-side fetcher) to prevent Node.js imports from contaminating the client bundle.
- The WebSocket architecture adds a separate chat route alongside the existing file-watch route. Different schemas, lifecycle, and validation — separate implementations.
- The chat panel extends the existing CSS grid layout from three columns to five. DOM elements are created dynamically — nothing in the HTML template.
- Each user message spawns a new CLI process invocation. Multi-turn context is maintained by passing a session ID between invocations. Clearing the conversation discards the session ID.
- Script execution uses the built-in VM module for isolation. This is sufficient for the single-user threat model but not for distribution — an upgrade path exists for proper V8 isolation.

---

## Story Breakdown
<!-- Jira: Epic Description — Story Breakdown section -->

### Story 0: Foundation (Infrastructure)
Feature flag module, REST endpoint, chat message schemas, provider interface types, and conditional route registration. Covers AC-1.1 through AC-1.4.
*(See story file Story 0 for full details and test conditions.)*

### Story 1: Chat Panel Shell and Layout
Resizable right-hand chat panel with conversation display area and input area — visual shell only, no WebSocket. Covers AC-2.1, AC-2.2, AC-2.4.
*(See story file Story 1 for full details and test conditions.)*

### Story 2: WebSocket Chat Connection
WebSocket route on server, client connection class, origin checking, message validation, auto-reconnection, disconnected indicator. Covers AC-3.1 through AC-3.5.
*(See story file Story 2 for full details and test conditions.)*

### Story 3: Provider and Message Streaming
CLI provider implementation and end-to-end message streaming — the full send-stream-display loop. Covers AC-2.3, AC-2.5, AC-4.1 through AC-4.6, AC-5.1, AC-5.5 through AC-5.8.
*(See story file Story 3 for full details and test conditions.)*

### Story 4: Provider Resilience and Conversation Management
Crash recovery, cancellation, graceful shutdown, clear conversation, cancel UI. Covers AC-5.2 through AC-5.4, AC-6.1 through AC-6.3.
*(See story file Story 4 for full details and test conditions.)*

### Story 5: Script Execution (Exploratory)
Stream parser script block interception, sandboxed VM execution, result relay. Experimental plumbing for future capabilities. Covers AC-7.1 through AC-7.4.
*(See story file Story 5 for full details and test conditions.)*

---

## Validation Checklist
<!-- Jira: Epic Description — Validation section -->

- [x] User Profile has all four fields + Feature Overview
- [x] All flows covered: feature flags, panel layout, WebSocket connection, streaming, provider lifecycle, conversation management, script execution
- [x] All 35 ACs mapped to stories
- [x] Scope boundaries explicit (in/out/assumptions)
- [x] Non-functional requirements documented
- [x] Tech design questions identified for Tech Lead
- [x] Story breakdown covers all ACs with correct ranges
- [x] Stories sequence logically: infrastructure → shell → connection → streaming → resilience → experimental
- [x] Data contracts described in prose (no TypeScript)
- [x] No code blocks in this document
