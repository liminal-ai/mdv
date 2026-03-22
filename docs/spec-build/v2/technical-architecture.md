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
- `GET /api/package/file?path=...` — read a file from the extracted package
- `POST /api/package/create` — create a new package (scaffold manifest)
- `POST /api/package/export` — export current root/package to .mpk/.mpkz

Existing endpoints (`GET /api/file`, `GET /api/tree`, `GET /api/image`,
etc.) should work transparently on extracted package contents — the package
service sets up the temp directory as the effective root.

### Boundary: Client ↔ Server (Chat Streaming)

New WebSocket route `/ws/chat` (separate from the existing `/ws` file-watch
route):

**Client → Server messages:**
- `chat:send` — user message with optional context (current document path,
  package info)
- `chat:cancel` — cancel the current streaming response
- `chat:clear` — clear conversation state

**Server → Client messages:**
- `chat:token` — streaming token(s) from the provider
- `chat:done` — response complete
- `chat:error` — provider error
- `chat:status` — background task status update
- `chat:file-created` — a file was created/modified by the agent (triggers
  UI refresh)

Message schemas extend the existing Zod-based pattern.

### Boundary: Server ↔ CLI Provider

The provider interface wraps a CLI process:

```
Provider Interface:
  - start(config): Promise<void>     // spawn the CLI process
  - send(message, context): void     // write to stdin
  - onToken(callback): void          // streaming output handler
  - onDone(callback): void           // completion handler
  - onError(callback): void          // error handler
  - cancel(): void                   // send interrupt / kill
  - stop(): void                     // graceful shutdown
```

The Provider Manager on the server side:
1. Receives a `chat:send` WebSocket message
2. Attaches context (current document content, package manifest, etc.)
3. Passes it to the active provider
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
4. Server scans for manifest file at the root (`_nav.md` or chosen convention)
5. Server parses manifest: extracts YAML frontmatter (metadata) and markdown
   body (navigation tree from nested links)
6. Server returns parsed manifest (metadata + navigation tree structure)
7. Client switches sidebar to package-mode navigation
8. User clicks a nav entry → `GET /api/package/file?path=components/auth.md`
9. Server reads from extracted temp directory, returns content
10. Client renders normally via existing markdown pipeline

### Flow: Chat with Steward

1. User types a message in the chat panel
2. Client sends `chat:send` over `/ws/chat` with message text and context
   (current doc path, package manifest if applicable)
3. Server's Provider Manager receives the message
4. Provider Manager constructs the full prompt: user message + document
   content + package context + any system instructions
5. Provider Manager writes to the CLI process's stdin
6. CLI process streams response tokens to stdout
7. Provider Manager relays tokens as `chat:token` WebSocket messages
8. Client buffers tokens, debounces markdown re-rendering of the response
9. When the CLI signals completion, server sends `chat:done`
10. If the CLI created/modified files, server sends `chat:file-created`
    so the client can refresh affected views

### Flow: Steward Edits a Document

1. User says "fix the formatting in section 3" in chat
2. Steward (via CLI provider) reads the current document content (passed
   as context or fetched via tool use)
3. Steward produces the edit — either a full replacement or a diff
4. Server applies the edit to the file on disk
5. Server sends `chat:file-created` (or `file-modified`) over WebSocket
6. Client detects the file change (existing file-watch infrastructure
   or explicit WS message) and reloads the document in the viewer
7. The edit appears in the viewer as a chunked update, not character-by-
   character

### Flow: Background Pipeline Operation

1. User says "draft the epic for Feature 2"
2. Steward acknowledges and dispatches via CLI provider as a background
   task
3. Server tracks the background task (task ID, status, start time)
4. The CLI runs — potentially for minutes, invoking Liminal Spec skills
5. Server periodically sends `chat:status` messages with progress
6. When complete, CLI output includes the path to the created artifact
7. Server sends `chat:status` (completed) + `chat:file-created`
8. Client shows completion notification in chat
9. User clicks to open the artifact in the viewer

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

**Process model bias:** One shared foreground process for interactive chat.
Background pipeline tasks (Epic 14) should spawn isolated worker processes
rather than occupying the interactive lane — a 30-minute pipeline run
must not block the user from chatting. Epic 10 focuses on the interactive
process only; Epic 14 introduces worker process orchestration consistent
with this bias. The exact worker lifecycle model is a tech design decision.

### Script Execution Pattern (Exploratory)

**Status:** This is exploratory infrastructure, feature-flagged, intended
for the primary user only. Any distribution beyond the primary user requires
a full security review, proper sandboxing, and likely rework of the harness
itself.

**Problem:** The Claude CLI does not support adding custom tools without
MCP, and MCP introduces significant overhead (separate I/O process, auth
complexity, additional API surface). The Steward needs to perform app
operations (read/write files, manipulate packages, trigger UI actions) but
there is no lightweight mechanism to extend the CLI's tool capabilities.

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

**Method surface principle:** The script lane exposes coarse-grained
product capabilities, not low-level backend primitives. Methods should
represent product actions and workflow-oriented operations, not raw
service access or broad filesystem methods. This keeps the surface safe,
stable, observable, and portable across providers.

Recommended capability facade:
- `openDocument(path)` — open a file in the viewer
- `applyEditToActiveDocument(edit)` — modify the currently active document
- `createPackageFromCurrentRoot(options)` — scaffold a package
- `addPackageFile(path, content)` — create a file within the package
- `updateManifestEntries(entries)` — modify the package manifest
- `showNotification(message)` — display a notification to the user
- `navigateToPath(path)` — navigate the sidebar to a location
- `getActiveDocumentContent()` — read the currently open document
- `getPackageManifest()` — read the current package's navigation tree

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

**Choice:** To be finalized during Epic 8 tech design. Candidates: `_nav.md`,
`_index.md`, or `manifest.md`. Single canonical name, not multiple with
priority fallback.

**Rationale:** A single canonical name is simpler to document, implement,
and explain. The underscore prefix (`_nav.md`) signals "this is metadata,
not content" and sorts to the top of directory listings.

**Consequence:** Deferred to tech design. The PRD establishes that it's a
single markdown file at the package root with YAML frontmatter for metadata
and a nested link list for navigation.

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

## Open Questions for Tech Design

- **Manifest file name:** `_nav.md` vs `_index.md` vs `manifest.md`. Single
  canonical choice needed.
- **CLI output parsing:** What is the exact format of the Claude CLI's
  streaming output? Does it emit structured JSON, plain text, or a mix?
  The provider wrapper's complexity depends on this.
- **Chat context injection:** How does the server construct the full prompt
  for the CLI? Does it prepend document content as a system message, pass
  it as a file reference, or use the CLI's built-in context mechanisms?
- **Background worker lifecycle:** The architecture biases toward isolated
  worker processes for pipeline tasks (see CLI Provider section). Tech
  design for Epic 14 needs to specify: how workers are spawned, monitored,
  and cleaned up; how many can run concurrently; how cancellation works.
- **Package temp directory lifecycle:** When exactly are temp directories
  cleaned up? On package close, on app quit, on startup (stale cleanup)?
  What if the app crashes?
- **Manifest update propagation:** When the user edits the manifest in edit
  mode, how quickly does the package-mode sidebar update? On save? On
  debounced change? On explicit refresh?
- **Chat rendering optimization:** What's the right debounce interval for
  re-rendering streamed markdown? Needs experimentation to balance
  smoothness against rendering cost.
- **Package library module boundary:** The PRD promises a reusable library
  and CLI that are independently usable without the viewer. Should this be
  a separate workspace package, a separate directory with its own
  entrypoint, or something else? The current `shared/types.ts` re-exports
  server schemas directly — the package library needs cleaner separation
  to be genuinely reusable. Epic 8 tech design must resolve this.

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
  framework choice, package format strategy (tar + extract-to-temp), provider
  architecture (CLI process wrapper over WebSocket), streaming rendering
  strategy (debounced markdown-it), feature flag mechanism, WebSocket route
  separation
- **Epic specs settle:** manifest file naming, exact API contracts, exact
  WS message schemas, package metadata schema, CLI output parsing strategy,
  temp directory lifecycle details, E2E test patterns and conventions
- **Tech design still decides:** module decomposition for package and chat
  services, provider interface exact shape, streaming buffer implementation,
  chat panel DOM structure, manifest parser implementation, CLI prompt
  construction strategy
