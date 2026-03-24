# MD Viewer v2 — Technical Architecture

## Status

This document defines the technical architecture for MD Viewer v2. It
establishes the system shape, stack extensions, and foundational decisions
that all downstream epics and tech designs inherit. It builds on the v1
architecture (documented in `01--preliminary/technical-architecture-overview.md`)
and should be read alongside it.

---

## Architecture Thesis

MD Viewer v2 extends the existing local-first client-server application with
two new capabilities: a markdown package format and an experimental agent
chat interface. The core architectural stance remains unchanged — a single
Fastify process serves both the API and static frontend, the server owns the
filesystem, the client owns the interaction. The package format adds a new
content abstraction (manifest-driven navigation over tar archives) that sits
alongside the existing filesystem-scan mode. The Spec Steward adds a WebSocket
streaming channel and a CLI provider abstraction — the server spawns and
manages CLI processes, the client renders streamed output. Both capabilities
are additive to the existing architecture, not replacements.

---

## Core Stack

v1 stack remains. Additions and changes for v2:

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| Runtime | Node.js | (inherited) | No change |
| Web framework | Fastify | (inherited) | No change — WebSocket support via existing @fastify/websocket |
| Frontend | Vanilla HTML/CSS/JS | (inherited) | No change — chat panel uses same approach |
| Markdown rendering | markdown-it + shiki + mermaid | (inherited) | Reused for chat streaming rendering |
| Package format | tar-stream | latest | Streaming tar read/write for .mpk files |
| Compression | Node zlib (built-in) | — | gzip/gunzip for .mpkz, no external dependency |
| CLI provider | Node child_process | built-in | Spawn and pipe Claude CLI (or other CLIs) |
| WebSocket | @fastify/websocket | (inherited) | Extended with new routes for chat streaming |
| Schema validation | Zod | (inherited) | Extended with new message types for chat protocol |
| E2E testing | Playwright | latest | Browser-based E2E (new dependency; PDF export uses Puppeteer separately) |
| Feature flags | Custom (env var + config) | — | ~20-30 lines, no external dependency |

### What's NOT Changing

- No frontend framework introduction (no React, Vue, Svelte)
- No new build step for the frontend
- No new database or persistence layer
- No new server process — everything runs in the existing Fastify instance
- No changes to the existing rendering pipeline, export system, or editor

---

## System Shape

### Existing (v1) — Unchanged

```
┌─────────────────────────────────────────────────┐
│ Browser / Electron                              │
│  ┌───────────────────────────────────────────┐  │
│  │ Vanilla JS Frontend                       │  │
│  │  Shell │ Sidebar │ Tabs │ Editor │ Preview│  │
│  └───────────────────────┬───────────────────┘  │
│                          │ HTTP + WS (file watch)│
└──────────────────────────┼──────────────────────┘
                           │
┌──────────────────────────┼──────────────────────┐
│ Fastify Server           │                      │
│  ┌───────────────────────┴───────────────────┐  │
│  │ REST API + WebSocket (file watching)      │  │
│  ├───────────────────────────────────────────┤  │
│  │ Services: filesystem, session, watch,     │  │
│  │           render, export                  │  │
│  ├───────────────────────────────────────────┤  │
│  │ Shared Core: markdown-it, mermaid,        │  │
│  │              shiki, export adapters│  │
│  └───────────────────────────────────────────┘  │
│                          │                      │
│                    Local Filesystem             │
└─────────────────────────────────────────────────┘
```

### v2 Additions

```
┌─────────────────────────────────────────────────────────┐
│ Browser / Electron                                      │
│  ┌─────────────────────────────────────┬─────────────┐  │
│  │ Existing Frontend                   │ Chat Panel  │  │
│  │  Shell │ Sidebar │ Tabs │ Content   │ (feature-   │  │
│  │        │         │      │           │  flagged)   │  │
│  │  Package-mode nav (new)             │             │  │
│  └──────────────────┬──────────────────┴──────┬──────┘  │
│                     │ HTTP + WS (file watch)  │ WS      │
│                     │                         │ (chat)  │
└─────────────────────┼─────────────────────────┼─────────┘
                      │                         │
┌─────────────────────┼─────────────────────────┼─────────┐
│ Fastify Server      │                         │         │
│  ┌──────────────────┴─────────────────────────┴──────┐  │
│  │ REST API + WS (file watch) + WS (chat streaming)  │  │
│  ├───────────────────────────────────────────────────┤  │
│  │ Existing Services                                 │  │
│  │  + Package Service (read/write/create packages)   │  │
│  │  + Manifest Parser (markdown manifest → nav tree) │  │
│  │  + Provider Manager (CLI lifecycle, streaming)    │  │
│  ├───────────────────────────────────────────────────┤  │
│  │ Shared Core (unchanged)                           │  │
│  │  + Package Format (tar read/write, manifest spec) │  │
│  └──────────────────────────┬────────────────────────┘  │
│                             │                           │
│              ┌──────────────┼──────────────┐            │
│              │              │              │            │
│        Local Filesystem   Temp Dir     CLI Process     │
│        (folders, files)   (extracted   (claude, etc.)  │
│                           packages)                     │
└─────────────────────────────────────────────────────────┘
```

### Ownership

- **Server** owns: filesystem access, package extraction, manifest parsing,
  CLI process lifecycle, streaming relay, session/feature state
- **Client** owns: layout, interaction, chat rendering, package-mode sidebar
  display, streaming chunk buffering and re-rendering
- **Shared Core** owns: package format spec (tar structure, manifest schema),
  markdown rendering (reused by chat panel)
- **CLI Provider** is: an external process managed by the server, communicating
  via stdin/stdout. The server translates between the CLI's output and the
  WebSocket protocol.

---

## Boundaries and Flows

### Boundary: Client ↔ Server (Package Operations)

New REST endpoints for package operations:

- `POST /api/package/open` — open a .mpk/.mpkz file, extract, return manifest
- `GET /api/package/manifest` — get the current package's parsed manifest
- `POST /api/package/create` — create a new package (scaffold manifest)
- `POST /api/package/export` — export current root/package to .mpk/.mpkz

Existing endpoints (`GET /api/file`, `GET /api/tree`, `GET /api/image`,
etc.) work transparently on extracted package contents — the package
service sets the temp directory as the effective root, so no separate
package-file-read endpoint is needed.

### Boundary: Client ↔ Server (Chat Streaming)

New WebSocket route `/ws/chat` (separate from the existing `/ws` file-watch
route):

**Client → Server messages:**
- `chat:send` — user message with optional context (current document path)
- `chat:cancel` — cancel the current streaming response
- `chat:clear` — clear conversation state
- `chat:task-cancel` — cancel a background task by ID (Epic 14)
- `chat:autonomous-cancel` — cancel an autonomous pipeline run (Epic 14)

**Server → Client messages — provider lifecycle:**
- `chat:token` — streaming token(s) from the provider
- `chat:done` — response complete
- `chat:error` — provider error (per-message or connection-wide)
- `chat:status` — provider lifecycle state (starting, ready, crashed,
  not-found)

**Server → Client messages — document and package operations:**
- `chat:file-created` — a file was created/modified by the Steward
  (triggers viewer refresh)
- `chat:package-changed` — workspace-level state change (manifest updated,
  package created, package exported — triggers sidebar refresh)
- `chat:conversation-load` — persisted conversation delivered on connect
  or workspace switch (Epic 12)

**Server → Client messages — background task lifecycle (Epic 14):**
- `chat:task-status` — background task lifecycle (started, running,
  completed, failed, cancelled) with elapsed time and output paths
- `chat:task-snapshot` — full task state delivered on connect/reconnect
- `chat:autonomous-run` — autonomous run lifecycle (started, running,
  completed, failed, cancelled) with phase sequence and progress

Message schemas extend the existing Zod-based pattern. `chat:status`
(provider lifecycle) and `chat:task-status` (background task lifecycle)
are distinct message families with different semantics.

### Boundary: Server ↔ CLI Provider

The provider operates in two modes:

**Foreground (conversational):** Per-invocation spawning with resume
semantics. Each `chat:send` triggers a CLI invocation. Session IDs
maintain multi-turn conversation context across invocations via
`--resume`. The foreground session is always available for interactive
chat, even when background tasks are running.

**Background (pipeline workers):** Isolated CLI processes spawned for
long-running pipeline operations (Epic 14). Each background task gets its
own CLI process with independent lifecycle. Background workers do not share
session state with the foreground or with each other.

```
Provider Interface:
  - start(config): Promise<void>     // initialize provider configuration
  - send(message, context): void     // dispatch a message to the CLI
  - onToken(callback): void          // streaming output handler
  - onDone(callback): void           // completion handler
  - onError(callback): void          // error handler
  - cancel(): void                   // cancel the current invocation
  - stop(): Promise<void>            // graceful shutdown
  - readonly isRunning: boolean      // whether a response is in progress
```

The Provider Manager on the server side:
1. Receives a `chat:send` WebSocket message
2. Attaches context (current document content, package manifest, workspace
   and spec metadata — progressively enriched by Epics 12–13)
3. Dispatches to the CLI provider
4. Parses the streaming output — see "Script Execution Pattern" in
   Cross-Cutting Decisions for how the stream is parsed for text tokens
   vs XML-fenced script blocks
5. Relays text tokens to the client as `chat:token` messages
6. Intercepts script blocks for server-side execution, returns results
   to the CLI process
7. Sends `chat:done` or `chat:error` when the provider completes

### Flow: Open a Package

1. User opens a `.mpk` file (File menu, drag-and-drop, or CLI arg)
2. Client sends `POST /api/package/open` with the file path
3. Server reads the tar (streaming via tar-stream), extracts to a temp
   directory
4. Server scans for `_nav.md` at the root (the canonical manifest filename)
5. Server parses manifest: extracts YAML frontmatter (metadata) and markdown
   body (navigation tree from nested links)
6. Server returns parsed manifest (metadata + navigation tree structure)
7. Client switches sidebar to package-mode navigation
8. User clicks a nav entry → `GET /api/file?path=<extracted-root>/components/auth.md`
9. Server reads from the extracted temp directory via the existing file endpoint
10. Client renders normally via existing markdown pipeline

### Flow: Chat with Steward

1. User types a message in the chat panel
2. Client sends `chat:send` over `/ws/chat` with message text and context
   (current doc path)
3. Server's Provider Manager receives the message
4. Provider Manager constructs the full prompt: user message + document
   content + workspace/package/spec context + system instructions
5. Provider Manager spawns a CLI invocation (with `--resume` and stored
   session ID for multi-turn continuity)
6. CLI process streams response tokens to stdout
7. Provider Manager parses the stream: text tokens are relayed as
   `chat:token` messages, XML-fenced script blocks are intercepted and
   executed server-side
8. Client buffers tokens, debounces markdown re-rendering of the response
9. When the CLI signals completion, server sends `chat:done`
10. If the Steward created/modified files (via script execution), server
    sends `chat:file-created` and/or `chat:package-changed`
    so the client can refresh affected views

### Flow: Steward Edits a Document

1. User says "fix the formatting in section 3" in chat
2. Steward receives the active document content in the provider context
3. Steward emits a script block calling `applyEditToActiveDocument(content)`
4. Server executes the script: writes the content to disk
5. Server sends `chat:file-created` over WebSocket
6. Client receives the notification and triggers document reload — clean
   tabs auto-refresh, dirty tabs show the existing conflict modal (Epic 5)
7. The edit appears in the viewer without manual refresh

### Flow: Background Pipeline Operation

1. User says "draft the epic for Feature 2"
2. Steward validates prerequisites (PRD exists with Feature 2 section),
   reports what it will use and where output will go
3. Steward emits a script block calling `dispatchTask(config)` to spawn
   an isolated background worker CLI process
4. Server creates a temp staging directory for the task and spawns the
   CLI with that staging dir as its working directory
5. Server sends `chat:task-status` with `started` — the foreground chat
   session is immediately available for other work
6. The background CLI runs independently — potentially for minutes,
   invoking Liminal Spec skills — writing output to the staging directory,
   not directly to the workspace
7. Server sends periodic `chat:task-status` messages with `running` status
   and elapsed time
8. When complete, the server's ResultsIntegrator moves files from the
   staging directory into the workspace via the curated service layer
   (`addFile`/`editFile`). It sends `chat:file-created` per output file,
   updates the package manifest via `updateManifest` (sends
   `chat:package-changed`), and advances spec phase metadata. The staging
   directory is cleaned up.
9. Server sends `chat:task-status` with `completed`, `outputPaths`, and
   `primaryOutputPath` — this is the terminal message for the task
10. User clicks the primary output path (a navigable link in the chat) to
    open the artifact in the viewer for review

---

## Cross-Cutting Decisions

### Package Extraction Strategy

**Choice:** Extract packages to a temp directory on open, treat the temp
directory as the effective root.

**Rationale:** Simplest implementation. The existing file-reading, rendering,
and tree-building code works on directories. No need to teach every service
about tar streams. Stream-reading directly from tar is an optimization for
later if package sizes warrant it.

**Consequence:** Temp directory cleanup must be managed — on package close,
app quit, and potentially on startup (clean stale temp dirs). Disk space is
temporarily doubled while a package is open. Acceptable for the package sizes
we're targeting (specs + images, typically a few MB).

### WebSocket Route Separation

**Choice:** Separate WebSocket routes for file watching (`/ws`) and chat
streaming (`/ws/chat`).

**Rationale:** Different message schemas, different lifecycles, different
concerns. The file-watch WS is tied to open documents and their paths. The
chat WS is tied to conversation state and provider lifecycle. Mixing them
would complicate both.

**Consequence:** The client maintains two WebSocket connections when the
Steward is enabled. Acceptable — both are to localhost with minimal overhead.

### CLI Provider as Process Wrapper

**Choice:** Wrap the Claude CLI as a child process, communicating via
stdin/stdout. Not the Claude Agent SDK.

**Rationale:** The Claude CLI with OAuth login provides the cleanest
terms-of-service posture for credential usage. The Agent SDK has
contradictory guidance on OAuth token usage. The CLI is the established,
supported interface. The process wrapper pattern also naturally supports
other CLIs (Codex, Copilot) and future custom harnesses.

**Consequence:** Provider communication is text-based (stdin/stdout), not
programmatic API calls. Parsing the CLI's output format is required — the
stream must be parsed for both text tokens and structured tool calls. The
CLI must support streaming output (it does). Process lifecycle management
(spawn, monitor, kill) adds some complexity. The server must handle the CLI
process dying unexpectedly.

**Implementation note:** The user has existing examples of CLI provider
wrapping, including process pool patterns for refreshing sessions. The
tech design should reference these existing examples.

**Process model:** Per-invocation foreground calls with resume semantics for
interactive chat. Background pipeline tasks (Epic 14) spawn isolated worker
processes with independent lifecycles — a 30-minute pipeline run must not
block the user from chatting. The foreground and background processes do not
share session state. Epic 10 establishes the foreground model; Epic 14
introduces the background worker model.

### Script Execution Pattern

**Status:** This is the Steward's primary mechanism for performing app
operations. It is feature-flagged and intended for the primary user only.
Any distribution beyond the primary user requires a full security review,
proper sandboxing (`isolated-vm` at minimum), and likely rework of the
harness. Despite the experimental security posture, the script execution
lane is foundational — downstream document editing (Epic 12), package
operations (Epic 13), and pipeline orchestration (Epic 14) are all built
on this mechanism.

**Problem:** The Claude CLI does not support adding custom tools without
MCP, and MCP introduces significant overhead (separate I/O process, auth
complexity, additional API surface). The Steward needs to perform app
operations (read/write files, manipulate packages, dispatch tasks, trigger
UI actions) but there is no lightweight mechanism to extend the CLI's tool
capabilities.

**Pattern:** The CLI's output stream is parsed for three types of content:

1. **Normal text** — passed through to the client for chat rendering.
2. **Built-in tool calls** — handled by the CLI's own tool harness (Read,
   Write, Bash, etc.) as normal.
3. **XML-fenced script blocks** — intercepted by the WebSocket server
   before reaching the user. These contain TypeScript that is executed
   server-side against a curated set of methods.

Claude is instructed (via system prompt / conversation context) to emit
script blocks using a specific XML tag when it wants to perform app
operations. The WebSocket server's stream parser detects these blocks,
executes the TypeScript, and returns results back to the CLI process's
stdin as if it were a user response. The CLI's tool harness never sees
these blocks.

**Execution environment:** `vm.runInNewContext()` with a curated context
object containing only the methods the script is allowed to call. No
`require`, no `process`, no `fs`, no globals — only the explicitly provided
methods. A timeout prevents infinite loops.

**Method surface principle:** The script lane exposes coarse-grained,
workspace-scoped product capabilities, not low-level backend primitives.
Methods represent product actions and workflow-oriented operations, not raw
service access. All file operations are scoped to the workspace root with
server-side path-traversal prevention. This keeps the surface safe, stable,
observable, and portable across providers.

The method surface is progressively extended across Epics 10–14:

**Core (Epic 10):**
- `showNotification(message)` — display a notification to the user

**Document operations (Epic 12):**
- `getActiveDocumentContent()` — read the currently open document
- `applyEditToActiveDocument(content)` — replace the active document content
- `openDocument(path)` — open a file in the viewer

**Workspace file operations (Epic 13):**
- `getFileContent(path)` — read any file in the workspace by relative path
- `addFile(path, content)` — create a new file in the workspace
- `editFile(path, content)` — replace content of an existing file

**Package operations (Epic 13):**
- `getPackageManifest()` — read the current manifest structure
- `updateManifest(content)` — replace manifest content (re-parses on save)
- `createPackage(options?)` — scaffold a manifest from discovered files
- `exportPackage(options)` — export workspace to .mpk/.mpkz

**Task orchestration (Epic 14):**
- `dispatchTask(config)` — dispatch a background pipeline task
- `getRunningTasks()` — list active and recently completed tasks
- `cancelTask(taskId)` — cancel a running background task

Avoid: raw service instances, broad filesystem methods (readFile/writeFile
on arbitrary paths), or a large chatty toolbox that makes Claude
orchestrate every tiny step itself. The composability of TypeScript
handles the orchestration — the methods should be the meaningful
operations, not the building blocks.

**Why TypeScript in a VM, not structured tool calls:** Claude can compose
multiple operations in a single script block rather than making sequential
one-at-a-time tool calls. This is more expressive and reduces round-trips.
Code is a natural output modality for these models. This also makes the
pattern provider-agnostic — any CLI that can follow system prompt
instructions can emit script blocks, regardless of whether it supports
custom tool protocols.

**Security posture:**

- `vm.runInNewContext` is not a true security sandbox. It creates a
  separate global scope within the same V8 isolate, which has known escape
  vectors.
- The threat model for v2 is: prevent Claude from accidentally doing
  something destructive, not defend against a determined attacker. The
  curated context (no access to `fs`, `child_process`, `require`, etc.)
  is sufficient for this.
- **Escalation path:** `isolated-vm` (npm) creates actual separate V8
  isolates with process-level isolation — significantly harder to escape,
  still in-process, low-millisecond startup. This is the recommended next
  step if the pattern proves valuable and needs hardening.
- **Distribution gate:** Before this feature is distributed to anyone
  beyond the primary user, the execution environment must be upgraded to
  proper sandboxing (`isolated-vm` at minimum), the harness reworked for
  security review, and the curated method surface audited.

**Consequence:** This pattern is a first step toward a broader exploration
of replacing rigid tool-call protocols with composable script execution.
It creates a testbed for evaluating whether scripted tool use is more
reliable and flexible than structured tool calls — particularly relevant
for providers (like Gemini) that write good code but struggle with tool
protocols. The pattern is intentionally kept simple and experimental in v2.

### Streaming Markdown Rendering Strategy

**Choice:** Buffer streaming tokens, debounce markdown re-rendering. The
chat panel re-renders the full current response through markdown-it at a
throttled interval (e.g., every 100-200ms or every N tokens), not on every
token.

**Rationale:** Character-by-character rendering through a full markdown
pipeline would be janky and expensive. Rendering the full accumulated text
at a throttled rate produces smooth output. The existing markdown-it + Mermaid
pipeline is fast enough for this — the response text is typically short
compared to full documents.

**Consequence:** There's a slight visual delay between token arrival and
rendered output (the debounce interval). This is acceptable and matches
how most chat interfaces work. Mermaid diagrams in streamed responses will
only render once the full code block is received — partial Mermaid blocks
show as raw code until complete.

### Feature Flag Architecture

**Choice:** Environment variable (`FEATURE_SPEC_STEWARD`) with optional
config file override. Server exposes `GET /api/features`. Client checks
features at startup and conditionally initializes.

**Rationale:** Simplest possible mechanism. No external dependency. Works
in both Node and Electron. Fits the "experiment safely" principle — the
flag is a developer-facing toggle, not a user-facing setting.

**Consequence:** Requires app restart to toggle (env var). The config file
approach could support hot-reload later but not required for v2. When
disabled, the chat sidebar code is still in the bundle but never executes —
acceptable for a local app where bundle size is not a deployment concern.

### Manifest File Convention

**Choice:** `_nav.md` — a single canonical manifest filename at the
package root.

**Rationale:** The underscore prefix signals "this is metadata, not
content" and sorts to the top of directory listings. A single canonical
name is simpler to document, implement, and explain than a fallback chain.

**Consequence:** All package tools, the viewer, and the CLI use `_nav.md`
as the manifest filename. The manifest is a markdown file with optional
YAML frontmatter for metadata and a body of nested lists with links
defining the navigation tree. Documents within a package are addressable
by file path or by navigation display name (resolved through the manifest).

### Conversation Persistence

**Choice:** Store conversation history as JSON files in the app's session
storage directory, keyed by a stable canonical identity (absolute folder
path or package source path). Never store conversation state in extracted
temp directories — those are disposable and subject to cleanup.

**Rationale:** Simple file-based persistence, consistent with the app's
existing session storage pattern. No database needed. Per-package/folder
scoping means conversations are contextual. Using the canonical source
path (not the temp extraction path) as the key ensures conversations
survive re-extraction and temp dir cleanup.

**Consequence:** Conversation files could grow large for long sessions. May
need size management or rotation in a future iteration. Not a concern for
v2 scope.

---

## Constraints That Shape Epics

- **Vanilla JS frontend:** The chat panel must be built without a component
  framework. Streaming rendering, state management, and DOM updates are all
  manual. This constrains the complexity of the chat UI but keeps it
  consistent with the rest of the app.

- **CLI process model:** The provider is an external process, not an in-process
  SDK. This means communication is text-based, process lifecycle must be
  managed, and the provider's capabilities are limited to what the CLI
  exposes. It also means the provider can be swapped without recompilation.

- **Local-only, no cloud:** Packages, conversations, and all state live on
  the local filesystem. No sync, no remote storage, no multi-device.

- **Feature flag gating:** Epics 10–14 must be cleanly gatable. No Steward
  code should execute when the flag is off. This affects how the code is
  organized — the Steward's server routes, services, and client code should
  be isolated modules that are conditionally loaded, not interleaved with
  core viewer code.

- **Tar format limitations:** Tar is sequential-access, not random-access.
  Extracting a single file requires scanning from the beginning. The
  extract-to-temp strategy avoids this issue but means packages are fully
  unpacked on open. This is fine for the expected package sizes.

---

## Settled Questions

These were originally open questions that have been resolved through
downstream tech designs and implementation:

- **Manifest file name:** `_nav.md` — settled during Epic 8 implementation.
- **Package library module boundary:** The package library lives at
  `app/src/pkg/` with its own entrypoint (`app/src/pkg/index.ts`),
  independently importable without viewer or server dependencies.
- **Provider process model:** Per-invocation foreground calls with
  `--resume` for multi-turn continuity. Isolated worker processes for
  background pipeline tasks. Settled across Epics 10, 12, and 14 designs.

## Remaining Open Questions for Tech Design

- **CLI output parsing:** What is the exact format of the Claude CLI's
  streaming output? Does it emit structured JSON, plain text, or a mix?
  The provider wrapper's complexity depends on this.
- **Chat context injection:** How does the server construct the full prompt
  for the CLI? Does it prepend document content as a system message, pass
  it as a file reference, or use the CLI's built-in context mechanisms?
- **Background worker lifecycle:** How are workers spawned, monitored, and
  cleaned up? What is the concurrency limit? How does cancellation work?
  Epic 14 tech design resolves this.
- **Package temp directory lifecycle:** When exactly are temp directories
  cleaned up? On package close, on app quit, on startup (stale cleanup)?
  What if the app crashes?
- **Chat rendering optimization:** What's the right debounce interval for
  re-rendering streamed markdown? Needs experimentation to balance
  smoothness against rendering cost. This is the M3 manual tuning point.

---

## Assumptions

| ID | Assumption | Status | Notes |
|----|------------|--------|-------|
| TA1 | tar-stream handles the package sizes we care about without performance issues | Unvalidated | Typical packages: dozens of files, a few MB |
| TA2 | The Claude CLI supports streaming output in a parseable format | Unvalidated | Need to verify exact output format |
| TA3 | The existing @fastify/websocket setup supports multiple WS routes without issues | Unvalidated | Currently only one route (/ws) |
| TA4 | markdown-it rendering at 100-200ms debounce intervals is fast enough for smooth chat streaming | Unvalidated | Needs experimentation |
| TA5 | Extracted package temp directories at a few MB each don't cause disk pressure | Validated | Reasonable for local dev machine |
| TA6 | The Claude CLI can be spawned as a child process and communicated with via stdin/stdout for conversational interaction | Unvalidated | The CLI is primarily interactive; need to verify headless/pipe mode |

---

## E2E Testing Architecture

### Choice

Playwright for browser-based E2E testing, established before any v2 features
are added (Epic 7).

### Rationale

Playwright handles browser automation well and has Electron testing support
for future use. Note: the current app uses Puppeteer for PDF export;
Playwright is introduced as a new dependency specifically for E2E testing.
Both can coexist — they serve different purposes. Establishing E2E patterns on the stable v1 surface means every subsequent
epic inherits a reliable test infrastructure.

### Test Architecture Shape

- Tests launch the Fastify server programmatically
- Playwright drives a browser against localhost
- Test fixtures provide sample markdown files, directories, and (later)
  packages
- Each epic adds E2E tests for its new functionality using shared utilities
- Tests run alongside existing unit/integration tests in CI

### Consequence

E2E tests add runtime to the test suite (browser launch overhead). Keep the
E2E suite focused on critical paths, not exhaustive coverage. Use unit and
integration tests for edge cases; use E2E for round-trip user flow
verification.

---

## Relationship to Downstream

- **This document settles:** system shape (additive to v1), E2E testing
  framework choice, package format strategy (tar + extract-to-temp),
  manifest file convention (`_nav.md`), provider architecture (per-invocation
  foreground + isolated background workers over WebSocket), script execution
  as the Steward's app-action mechanism, streaming rendering strategy
  (debounced markdown-it), feature flag mechanism, WebSocket route
  separation, message taxonomy (provider lifecycle, task lifecycle, and
  autonomous-run lifecycle as distinct families)
- **Epic specs settle:** exact API contracts, exact WS message schemas,
  package metadata schema, script method surface per epic, CLI output
  parsing strategy, temp directory lifecycle details, E2E test patterns and
  conventions, spec metadata conventions, autonomous pipeline sequence
- **Tech design still decides:** module decomposition for package and chat
  services, streaming buffer implementation, chat panel DOM structure,
  manifest parser implementation, CLI prompt construction strategy,
  background worker concurrency limits and spawn mechanics
