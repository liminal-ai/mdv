# MD Viewer v2 — Product Requirements Document

## Status

This PRD defines the product direction, feature scope, and epic sequencing for
MD Viewer v2. It builds on the completed v1 (Epics 1–6) which delivered the
full local-first markdown workspace: browsing, viewing, rich content, export,
editing, and an Electron wrapper.

v2 introduces three new product concerns:

1. **End-to-End Testing** — establishes the E2E testing framework on the
   stable v1 surface before adding new capabilities.
2. **Markdown Package Format** — a general-purpose open convention for bundling
   structured markdown collections into navigable, shareable packages.
3. **Spec Steward** — a feature-flagged experimental chat interface that
   orchestrates spec-driven development workflows from within the viewer.

Feature sections are shaped like lightweight epics — user context, scope, and
rolled-up acceptance criteria — but stop short of line-level ACs and test
conditions. Those belong in the full epic specs that follow.

---

## Product Vision

MD Viewer is a local-first markdown workspace for technical users who work with
markdown as a primary medium — writing specs, driving agentic workflows,
documenting systems, and communicating between humans and AI agents.

v1 established the core: browse folders, render markdown with Mermaid and syntax
highlighting, edit, and export. v2 extends the product in two directions:

**Structured markdown packages.** Markdown files accumulate — specs, docs,
agent outputs, knowledge artifacts. Today they're loose files in directories.
The markdown package format (`.mpk`) gives them structure: a manifest defines
the navigation tree, and the entire collection collapses into a single
shareable file. The viewer opens packages directly — no build step, no hosting,
no manual extraction step.

**Spec-driven development from within the viewer.** The Spec Steward is an
experimental agent interface that knows the Liminal Spec methodology. It can
interview you to shape a PRD, orchestrate epic drafting and verification, guide
you through approval, and kick off implementation — all while you read and
review the artifacts in the viewer. It wraps the Claude CLI (or future
harnesses) behind a streaming WebSocket interface. Think of it as a steward
for the full spec-to-code lifecycle.

These two capabilities reinforce each other: the package format is the project
container that the Steward writes into. But the package format stands alone as
a general-purpose feature — useful to anyone working with structured markdown,
independent of the Steward.

### Ecosystem Context

MD Viewer sits within a broader ecosystem of tools:

- **Liminal Spec** is a spec-driven development methodology with a skill pack
  for Claude Code. The Steward wraps this methodology in an accessible
  interface.
- **Liminal DocGen** generates structured markdown documentation for codebases.
  Its output is a natural candidate for the package format.
- The **Claude CLI** is the initial provider for the Steward's agent
  capabilities, wrapped behind a pluggable WebSocket interface.

---

## User Profile

**Primary User:** A technical, agentic user who uses markdown as a primary
working medium. This person uses AI agents to analyze, plan, and build —
and markdown is the communication layer between them and those agents. They
generate and consume a high volume of markdown files: specs, designs, agent
outputs, system documentation, knowledge artifacts.

**Context:** The user has been using MD Viewer v1 daily. They want to organize
their markdown into structured, shareable collections. They want to drive
spec creation and implementation workflows from a single surface rather than
juggling multiple terminal sessions and manually sequencing skill invocations.

**Mental Model:** "I have a project's worth of specs. I want them organized,
navigable, and shareable. And I want to be able to build more specs — and
build from them — without leaving this tool."

**Key Constraint:** Must remain local-first. No cloud dependencies. The
package format should be an open convention, not proprietary. The Steward
is experimental — it must be invisible to general users unless explicitly
enabled.

**Future User:** AI power users who understand product and apps but may not
have a deep coding background. The package format and Steward should grow
toward accessibility for this audience, even though v2 targets the primary
technical user.

---

## Problem Statement

v1 solved the viewing problem: browse, render, edit, and export markdown
locally. But two gaps remain:

**Markdown files lack structure beyond the filesystem.** A project's specs
live in a directory tree, but the tree doesn't express navigation intent,
reading order, or artifact relationships. Sharing a project's docs means
zipping a folder and hoping the recipient understands the structure. There's
no lightweight convention for "here's a structured collection of markdown
with a defined navigation tree" that doesn't require a build step or hosted
platform.

**Spec-driven workflows are hard to orchestrate.** The Liminal Spec
methodology produces high-quality specs through a rigorous pipeline (PRD →
epic → tech design → stories → implementation). But operating the pipeline
requires expertise: knowing which skills to invoke, in what order, with what
inputs, and how to manage verification loops. The knowledge is encoded in
skill files that an experienced user runs manually. There's no guided
interface.

---

## Product Principles

Inherited from v1 (still apply):
- **Local-first**: lives on local files and folders, not in a cloud
- **Fast enough to trust**: opens and renders quickly enough to reach for
  habitually
- **Safe by default**: edits, closes, and file conflicts don't surprise the
  user
- **Keyboard-native**: primary user expects keyboard shortcuts as baseline
- **Good defaults over configuration**: one click, good output

New for v2:
- **Open convention over proprietary format**: the package format should be
  adoptable by any tool, not locked to MD Viewer
- **Steward principle**: anything you can do in the viewer, you can do
  through the chat. The Steward has full visibility and control over the
  app surface.
- **Experiment safely**: the Steward is feature-flagged. General users never
  see it unless they enable it. The core product stays clean.
- **Provider-agnostic**: the Steward's agent capabilities sit behind an
  abstraction. Claude CLI today, custom harness tomorrow, other providers
  later.

---

## Non-Functional Requirements

v1 NFRs (responsiveness, startup, memory, reliability) continue to apply.
Additional for v2:

**Streaming performance:** Chat responses should begin rendering within 1–2
seconds of dispatch. Streaming should feel smooth — no long pauses followed
by large chunks. Markdown rendering of streamed content should not cause
visible jank.

**Package operations:** Opening a package (`.mpk` or `.mpkz`) should feel as
fast as opening a folder. Packages under 50MB should open in under 3 seconds.
Creating a package from a folder should complete in seconds for typical spec
collections (dozens of files, a few MB).

**Feature isolation:** When the Steward is disabled (default), there should be
zero impact on app startup time, memory usage, or UI layout. No conditional
rendering costs, no provider initialization, no WebSocket connections for the
chat channel.

**Test coverage:** E2E tests cover the critical user paths of the v1 surface
before new features are added. Each subsequent epic extends E2E coverage for
its new functionality.

---

## Architecture Summary

v1 architecture remains: single Fastify process serving API and static
frontend, vanilla HTML/CSS/JS, optional Electron wrapper. v2 extends it:

- **Package support** adds server-side tar reading/writing and a manifest
  parser. The viewer's sidebar gains a package-mode navigation tree driven
  by the manifest instead of filesystem scanning.
- **Spec Steward** adds a WebSocket streaming server that wraps CLI
  providers. The frontend gains a chat sidebar panel. The WebSocket server
  is a separate route on the existing Fastify instance — not a separate
  process.
- **Feature flags** are checked at startup via env var / config file. A
  `shared/features.ts` module exposes enabled features. The server exposes
  `GET /api/features` so the frontend knows what to render.

Stack additions: `tar-stream` for tar operations, Playwright for E2E testing,
no new frontend frameworks or build steps.

Detailed architecture is documented separately in
`technical-architecture.md`.

---

## Scope

### In Scope

- E2E testing framework on the v1 surface
- Markdown package format: `.mpk` (uncompressed tar) and `.mpkz` (compressed)
- Manifest convention for package navigation
- Package format library (reading and writing) and CLI tooling
- Package-mode navigation in the viewer sidebar
- Package creation and export from the viewer
- Spec Steward: feature-flagged chat sidebar
- WebSocket streaming server with pluggable CLI provider
- Claude CLI as initial provider
- Streaming markdown rendering in chat with polish iteration
- Document and package awareness in the Steward
- Liminal Spec pipeline orchestration through the Steward
- Feature flag infrastructure (env var + config file)

### Out of Scope

- Updates to the Liminal Spec plugin/skills themselves (noted for later)
- Tight pipeline state model for the Steward (fast follow)
- Search within documents or across files
- Cloud sync, collaboration, or multi-user features
- Non-macOS Electron packaging
- Code signing, notarization, or distribution
- Custom agent harness (future — provider interface supports it)
- LLM preamble / agent-optimized package summaries (future refinement)

### Assumptions

| ID | Assumption | Status | Notes |
|----|------------|--------|-------|
| A1 | v1 (Epics 1–6) is complete and stable | Validated | v2 builds on the existing app |
| A2 | Tar format (via tar-stream) handles the package sizes we care about (specs, docs, modest image assets) without performance issues | Unvalidated | Typical packages are dozens of files, a few MB |
| A3 | The Claude CLI supports sufficient streaming output for a responsive chat experience | Unvalidated | CLI streaming capabilities need verification |
| A4 | Wrapping the Claude CLI (not the Agent SDK) provides clean OAuth token usage without terms-of-service concerns | Unvalidated | Legal/ToS assessment |
| A5 | Vanilla JS is sufficient for streaming chat rendering without a framework | Unvalidated | Believed true based on the scope of rendering needed |
| A6 | The existing WebSocket infrastructure (Fastify + @fastify/websocket) can support the chat streaming channel alongside file watching without conflicts | Unvalidated | May need separate WS routes |

---

## Milestones

| Milestone | After | What Exists | Feedback Point |
|-----------|-------|-------------|----------------|
| **M0: Test Foundation** | Epic 7 | E2E testing framework covering v1 critical paths | Yes — are the tests reliable? Do they catch real issues? |
| **M1: Packages** | Epics 8+9 | Open, browse, create, and share markdown packages | Yes — is the format useful? Is package navigation smooth? |
| **M2: Chat Working** | Epic 10 | Basic chat sidebar with plain text streaming | Yes — does the plumbing work? Is the provider reliable? |
| **M3: Chat Polished** | Epic 11 | Streaming markdown rendering, polished feel | Yes — pause point for manual UX iteration |
| **M4: Steward Smart** | Epics 12+13 | Context-aware Steward with document editing and package awareness | Yes — is the contextual intelligence useful? |
| **M5: Steward Autonomous** | Epic 14 | Full pipeline orchestration from the chat | Yes — is the guided workflow valuable? What's missing? |

M3 is the designated pause point for hands-on UX iteration. The streaming
rendering and chat feel need human tuning that models can't fully handle.
Expect to spend time between M3 and M4 dialing in the real-time experience.

---

## Feature 7: End-to-End Testing Framework

### Context

v1 shipped with unit and integration tests but no end-to-end testing. Before
adding new capabilities (packages, chat, streaming), the app needs E2E test
coverage on the existing stable surface. This establishes the framework,
patterns, and baseline coverage that every subsequent epic extends.

### User Need

The developer (primary user is also the developer in this case) needs
confidence that new features don't break existing functionality. The app has
grown through 6 epics with significant surface area — workspace management,
file tree, tabs, rendering, editing, export, Electron. Manual regression
testing is not sustainable as more capability is added.

### In Scope

- E2E testing framework setup (Playwright — well-suited for both browser
  and Electron testing. Note: the current app uses Puppeteer for PDF export;
  Playwright is a new dependency for E2E only.)
- Test infrastructure: app startup/teardown for tests, test fixtures
  (sample markdown files, sample directories), test utilities
- Critical path coverage for v1 functionality:
  - App launch and workspace selection
  - File tree navigation and document opening
  - Markdown rendering (basic content, Mermaid, syntax highlighting)
  - Tab management (open, switch, close)
  - Edit mode (switch, edit, save, dirty state)
  - Export (at least one format)
  - Theme switching
  - Session persistence (workspace and theme survive restart)
- CI integration: tests run as part of the existing test pipeline
- Patterns and conventions established for subsequent epics to follow

### Out of Scope

- Electron-specific E2E testing (browser-based E2E first; Electron E2E is
  a potential future addition)
- Visual regression testing (screenshot comparison)
- Performance benchmarking in E2E tests
- 100% path coverage — this epic covers critical paths, not exhaustive
  coverage

### Rolled-Up Acceptance Criteria

The E2E test suite launches the app, navigates through the core user flows,
and verifies that the critical paths work end-to-end. Tests cover the full
round-trip: open a folder, browse the tree, open a document, verify it
renders, switch tabs, edit and save, export, switch themes.

The test infrastructure is clean and reusable — fixtures, utilities, and
patterns that make it easy for subsequent epics to add E2E tests for their
new features. Tests run reliably in CI alongside the existing test suite.

A new epic's story can add E2E test coverage by following the established
patterns without needing to set up infrastructure.

---

## Feature 8: Package Format Foundation

### Context

This establishes the package format as a library and CLI tool — the format
specification, tar reading and writing, manifest parsing, and command-line
tooling. It delivers a complete, testable package format that can create,
inspect, and extract packages without any viewer integration.

The viewer integration comes in Epic 9. This epic is the format itself —
independently testable, usable from the command line and as a library.

### User Need

The user wants a simple, open convention for bundling structured markdown
collections. They want to take a folder of markdown files, define a
navigation structure with a manifest, and collapse it into a single
shareable file. They want CLI tools for creating, inspecting, and extracting
packages in scripts and automation.

### In Scope

- Package format specification: `.mpk` as tar, `.mpkz` as compressed tar.
  Internal structure: a manifest file at the root, markdown files, and
  supporting assets (images, etc.) preserving directory hierarchy.
- Manifest file convention: a markdown file at the package root that defines
  the navigation tree using standard markdown links and nested lists.
  Optional YAML frontmatter for metadata (title, version, author,
  description, type, status).
- Manifest parser: parse the manifest markdown into a structured navigation
  tree (hierarchy, display names, file paths, group labels).
- Tar reading: open `.mpk` files, stream entries, extract to directory.
- Tar writing: collapse a directory into `.mpk`. Compress to `.mpkz`.
- CLI tooling (`mdvpkg` or similar):
  - `create` — create a package from a directory (auto-scaffolds manifest
    if none exists)
  - `extract` — unpack a package to a directory
  - `info` — display package metadata and navigation tree
  - `ls` — list all documents with paths
  - `read` — extract a specific document by nav path or file path
  - `manifest` — extract manifest only
- Library API: all CLI operations backed by a library usable
  programmatically. The core rendering pipeline (markdown-to-HTML with
  Mermaid and syntax highlighting) is also accessible as a library for
  external use.

### Out of Scope

- Viewer integration — opening packages in the viewer UI (Epic 9)
- Package-mode sidebar navigation (Epic 9)
- Manifest editing within the viewer (Epic 9)
- Batch operations across multiple packages
- Package versioning or diffing
- Publishing packages to a registry
- LLM preamble / agent-optimized summaries (future)

### Rolled-Up Acceptance Criteria

The CLI tool can create a package from a directory: it detects or scaffolds a
manifest, bundles all markdown files and supporting assets into a `.mpk` tar
file, and optionally compresses to `.mpkz`. The manifest scaffold
pre-populates with the directory's markdown files as navigation entries.

The CLI can extract a package back to a directory, preserving the original
structure. It can inspect a package without extracting — showing metadata,
the navigation tree, and file listings. It can read a single document from
a package by navigation path or file path.

The manifest parser correctly handles nested lists (hierarchy), linked items
(navigable entries with display names), non-linked items (group labels), and
YAML frontmatter (metadata). It produces a structured navigation tree that
downstream consumers (the viewer, agents, other tools) can use directly.

All operations are available as a library API for programmatic use. The
library is independently testable without the viewer.

---

## Feature 9: Package Viewer Integration

### Context

The package format exists as a library and CLI (Epic 8). This epic teaches
the viewer to open, navigate, create, and export packages. When done, the
package format is a round-trip capability within the viewer: create a
package, browse it with manifest-driven navigation, edit it, export it.

### User Need

The user wants to open a `.mpk` or `.mpkz` file in the viewer and see
manifest-driven navigation instead of a raw file tree. They want to create
new packages from existing folders, edit the manifest to reorganize content,
and export packages for sharing.

### In Scope

- Opening packages in the viewer: File menu, drag-and-drop, CLI argument.
  The viewer extracts the package (using Epic 8's library) and detects the
  manifest.
- Package-mode sidebar navigation: when a package is open, the sidebar shows
  the manifest-driven navigation tree. Display names from link text,
  hierarchy from nested lists, non-linked items as group labels.
- Switching between package mode and filesystem mode when opening different
  roots. Clear visual indication of which mode is active.
- Package creation in the viewer: File → New Package scaffolds a manifest in
  the current root directory and switches to package mode. This is a
  directory-mode package — files are edited in place on disk, no extraction
  needed. The scaffolded manifest pre-populates with the directory's
  markdown files.
- Export to package: collapse the current root (directory-mode package or
  regular folder) into a `.mpk` or `.mpkz` file via the Export menu. This
  is how directory-mode packages become shareable single files.
- Manifest editing: the manifest is a markdown file editable in edit mode.
  Changes to the manifest update the package-mode navigation tree.
- Package metadata display: title, version, author from the manifest's
  frontmatter shown in the sidebar or a package info area.
- Editing in opened packages: when a `.mpk` / `.mpkz` is opened (extracted
  to temp), edits modify the extracted files. To persist changes back to the
  package file, the user re-exports. The viewer indicates when extracted
  content has been modified and the package file is stale.
- Fallback: if a package has no manifest, fall back to filesystem-scan mode
  on the extracted contents with a subtle indicator.

### Out of Scope

- Chat/Steward integration with packages (Epic 13)
- Spec-specific package conventions (Epic 13)
- Remote package URLs (not planned)
- Multiple manifests per package (future)

### Rolled-Up Acceptance Criteria

The user opens a `.mpk` or `.mpkz` file and the viewer extracts it, detects
the manifest, and switches the sidebar to package-mode navigation. The tree
reflects the manifest structure. Clicking a navigation entry opens the
document in the content area with full rendering (Mermaid, syntax
highlighting, images, tables).

The user creates a new package from the current folder. A manifest is
scaffolded, the sidebar switches to package mode, and the user can edit the
manifest to reorganize navigation. Changes to the manifest are reflected in
the sidebar.

The user exports a package to `.mpk` or `.mpkz`. The exported file can be
opened in another viewer instance with the same navigation structure.

When the user opens a regular folder while a package is open, the sidebar
switches back to filesystem-scan mode.

---

## Feature 10: Chat Plumbing

### Context

This is the infrastructure layer for the Spec Steward. It establishes the
feature flag, the CLI provider abstraction, the WebSocket streaming server,
and a basic chat panel that streams plain text responses. The focus is
entirely on plumbing — getting the pipes connected and reliable.

No markdown rendering in chat, no document awareness, no intelligence. Just
a working chat that can send messages to a CLI and stream responses back as
plain text. Getting the provider lifecycle management right (spawning,
crashing, restarting, cancelling) is the hard technical problem in this epic.

This feature is gated behind a feature flag and invisible by default.

### User Need

The user wants a basic chat interface within the viewer that connects to
the Claude CLI. They want to send a message and see a streamed response.
The connection should be reliable — if the CLI process crashes, it recovers
gracefully. If the user cancels mid-response, it stops cleanly.

### In Scope

- Feature flag infrastructure: env var (`FEATURE_SPEC_STEWARD`) and config
  file support. `GET /api/features` endpoint. `shared/features.ts` module.
  When disabled, no UI elements render, no WebSocket connections initialize,
  no provider processes spawn.
- CLI provider abstraction: a provider interface that defines how to spawn,
  send messages to, receive streaming output from, cancel, and shut down a
  CLI process. Designed so different CLIs or a custom harness can implement
  the same interface.
- Claude CLI as initial provider: implements the provider interface by
  spawning the `claude` CLI, piping input via stdin, parsing streaming
  output from stdout, and managing the process lifecycle. Handles process
  crashes, unexpected exits, timeouts, and cancellation.
- WebSocket streaming server: new `/ws/chat` route (separate from the
  existing `/ws` file-watch route). Typed message schemas extending the
  existing Zod-based pattern. Relays between the CLI provider and the
  client — receives user messages, passes them to the provider, streams
  response tokens back.
- Basic chat sidebar panel: resizable right-hand panel with conversation
  display, input area, and send action. User and agent messages are
  visually distinct. Responses stream in as plain text. Scroll behavior
  keeps the latest content visible during streaming.
- Basic conversation management: clear conversation, new conversation,
  cancel in-progress response.

### Out of Scope

- Streaming markdown rendering in chat (Epic 11)
- Syntax highlighting or Mermaid in chat responses (Epic 11)
- Chat UI polish and UX refinement (Epic 11)
- Document awareness (Epic 12)
- Package awareness (Epic 13)
- Conversation persistence across restarts (Epic 12)

### Rolled-Up Acceptance Criteria

When the feature flag is enabled, a chat sidebar appears on the right side of
the viewer. When the flag is disabled, no trace of the chat exists in the UI
or runtime behavior — no DOM elements, no WebSocket connections, no provider
processes.

The user types a message and the agent's response streams in as plain text.
Tokens appear progressively as they arrive from the CLI. The user can cancel
a response mid-stream.

The CLI provider manages its process lifecycle cleanly. If the CLI process
crashes, the provider restarts it and the user sees a brief error message
before being able to continue. If the user closes the app, the provider
shuts down its CLI process gracefully.

The provider abstraction cleanly separates the chat protocol from the
specific CLI. Swapping the Claude CLI for another provider requires
implementing the provider interface, not modifying the chat panel or
WebSocket server.

---

## Feature 11: Chat Rendering and Polish

### Context

The chat works (Epic 10) — plain text streaming is functional, the provider
is reliable, the WebSocket plumbing is solid. This epic adds streaming
markdown rendering and polishes the chat experience until it feels good.

This is the designated iteration point. After this epic ships, the user
spends time manually tuning the real-time feel — debounce intervals, scroll
behavior, partial construct handling, layout details. Models can build the
rendering pipeline, but the nuance of how streaming chat feels requires
human judgment.

This feature is gated behind the same feature flag as Epic 10.

### User Need

The user wants chat responses to render as formatted markdown, not plain
text. Headings, code blocks with syntax highlighting, lists, tables, and
inline formatting should appear progressively as the stream arrives. The
experience should feel smooth — no jarring reformats, no flashes of raw
markdown, no visual glitches when a code block is half-received.

### In Scope

- Streaming markdown rendering: incoming tokens are buffered and the
  accumulated response is re-rendered through the existing markdown-it
  pipeline at a debounced interval. The rendering reuses the same
  markdown-it + shiki setup used for document rendering.
- Partial markdown handling: incomplete code fences show as plain text
  until the closing fence arrives, then render as highlighted code on the
  next cycle. Incomplete emphasis, links, and other inline constructs
  degrade gracefully. Mermaid code blocks render only when complete.
- Debounce tuning: the re-render interval is configurable and tuned for
  a smooth streaming feel. The default should feel responsive without
  causing jank from too-frequent DOM updates.
- Scroll behavior refinement: auto-scroll during streaming, stop
  auto-scrolling if the user scrolls up, resume if they scroll back to
  the bottom.
- Chat panel UI polish: visual refinement of message layout, spacing,
  typography, resize handle feel, panel open/close animation. The chat
  should feel like a natural part of the app, not a bolted-on widget.
- Keyboard shortcuts: send message (Enter/Cmd+Enter), cancel response,
  toggle chat panel visibility.

### Out of Scope

- Document awareness (Epic 12)
- Document editing through chat (Epic 12)
- Package awareness (Epic 13)
- Conversation persistence (Epic 12)

### Rolled-Up Acceptance Criteria

Chat responses render as formatted markdown as they stream in. Code blocks
appear with syntax highlighting. Headings, lists, tables, and inline
formatting render progressively. The transition from partial to complete
markdown constructs is smooth — no flashing, no jarring reflows.

Incomplete code fences show as plain text and upgrade to highlighted code
blocks when the closing fence arrives. Mermaid blocks show as code until
complete, then render as diagrams.

The streaming experience feels smooth. There are no long pauses followed by
large visual jumps. The debounce interval balances responsiveness against
rendering cost.

Auto-scroll follows the streaming output. The user can scroll up to read
earlier content without being jerked back to the bottom. Scrolling back to
the bottom resumes auto-scroll.

The chat panel feels integrated with the app — consistent typography,
spacing, and chrome. The resize handle works smoothly. The panel can be
toggled with a keyboard shortcut.

---

## Feature 12: Document Awareness and Editing

### Context

The chat renders well (Epic 11). This epic makes the Steward contextually
aware of the active document and able to edit it. This is where the chat
goes from "generic AI sidebar" to "assistant that knows what you're working
on" — but still scoped to single-document awareness, not package-level.

This feature is gated behind the same feature flag.

### User Need

The user is reading a document and wants to ask the Steward about it —
"summarize this," "what's the scope boundary in this spec?" They want to
request edits — "fix the table in section 3," "add a summary at the top."
They want the conversation to persist so they can pick up where they left
off.

### In Scope

- Document awareness: the Steward receives the currently active document's
  path and content as context. "What's this document about?" and "summarize
  this" work on whatever is open. Context updates when the user switches
  tabs or opens a new document.
- Document editing through chat: the user says "fix the formatting" and the
  Steward edits the active document. Edits arrive as chunked updates (not
  character-by-character) and the viewer refreshes to show changes. Works on
  any open document — regular files or files within a package.
- Context injection model: the server constructs the prompt for the CLI
  provider by attaching the active document's content. Token budget
  management — large documents may need truncation or summarization
  strategies to fit within context limits.
- Conversation persistence: chat history persists per folder or per package
  across app restarts. Reopening a workspace restores the conversation.
- Tab context switching: when the user switches tabs, the Steward's context
  updates. The conversation can reference previously discussed documents
  naturally ("that other document we looked at").

### Out of Scope

- Package-level awareness and operations (Epic 13)
- Multi-file context across a package (Epic 13)
- Spec-specific conventions and phase awareness (Epic 13)
- Pipeline orchestration (Epic 14)

### Rolled-Up Acceptance Criteria

The Steward knows what document is currently open. "Summarize this" responds
about the active document. Switching tabs updates the context, and the
Steward can reference the new document.

The user can request edits through the chat. "Fix the table in section 3"
or "add a heading before the first paragraph" results in the document being
edited and the viewer showing the updated content. The edit flow feels
natural — the user sees the change arrive without needing to manually
refresh.

Conversation history persists across app restarts. Reopening the app
restores the previous conversation for the active workspace or package.

---

## Feature 13: Package and Spec Awareness

### Context

The Steward can see and edit single documents (Epic 12). This epic expands
awareness to the full package level — understanding manifest structure,
reading multiple files, performing package operations through chat, and
knowing about the Liminal Spec pipeline phases.

This is where the Steward becomes package-native and spec-aware. It can
navigate the full project structure and guide the user through the spec
lifecycle.

This feature is gated behind the same feature flag.

### User Need

The user is working in a spec package and wants the Steward to understand
the whole project — not just the document they're looking at. They want to
ask "what does the PRD say about export scope?" when they're reading the
epic. They want to create new files in the package through chat. They want
the Steward to know what phase of the spec lifecycle they're in and suggest
what comes next.

### In Scope

- Package awareness: when a package is open, the Steward knows the manifest
  structure and can reference any file by its navigation path. "What's in
  this package?" lists the navigation tree. Multi-file context — "compare
  the PRD scope with the epic" reads both files and answers.
- Package operations through chat: creating new packages, adding files to
  packages, modifying the manifest — all available through conversation.
  Steward principle: anything you can do in the viewer, you can do through
  the chat.
- Spec package conventions: metadata fields in the manifest frontmatter
  that indicate a package is a spec package (type, pipeline phase, status).
  The Steward understands these and can set them.
- Liminal Spec phase awareness: the Steward knows the phases (PRD → epic →
  tech design → publish epic → implementation) and can suggest what's next
  based on what artifacts exist in the package. Conversational guidance,
  not a rigid workflow — the user can follow it or ignore it.
- Folder-mode chat: package operations through chat also work on regular
  folders (non-packages). "Create a package from this folder" works from
  the chat when browsing a regular directory.

### Out of Scope

- Autonomous pipeline execution (Epic 14)
- Background task management (Epic 14)
- Approval flow (Epic 14)
- Pipeline state model beyond basic phase tracking
- Formal approval gate UI

### Rolled-Up Acceptance Criteria

When a package is open, the Steward understands its structure. It can list
contents, read any file, compare files, and answer questions that span
multiple documents. "What's the gap between the PRD's Feature 3 and the
epic?" reads both and gives a specific answer.

The user can create new files in the package through chat. "Add an epic file
for the auth feature" creates the file and updates the manifest. The sidebar
navigation reflects the change.

The Steward recognizes spec packages and understands pipeline phases. If a
spec package has a PRD but no epic, the Steward suggests "Ready to start
drafting the epic?" This guidance is conversational — the user can follow it,
skip phases, or work in any order.

Package operations work from regular folders too. "Turn this folder into a
package" creates a manifest and switches to package mode.

---

## Feature 14: Pipeline Orchestration

### Context

The Steward is package-aware and spec-aware (Epic 13). This epic adds the
ability to actually run the Liminal Spec pipeline — dispatching long-running
spec creation tasks, managing background operations, and surfacing results
for review.

This is where the Steward becomes a genuine orchestrator: it can do the work,
not just advise on it. The user can micromanage every step or let the Steward
run autonomously.

This feature is gated behind the same feature flag.

### User Need

The user wants to say "draft the epic for Feature 2" and have the Steward
dispatch the work, run it in the background, and notify them when it's ready
for review. They want to check status, approve or request changes, and
optionally let the Steward run through multiple pipeline phases autonomously.

### In Scope

- Background task management: the Steward can dispatch long-running CLI
  operations that run while the user continues working. Task tracking
  includes status, elapsed time, and the ability to cancel. The user can
  ask "what's running?" at any time.
- Pipeline dispatch: the Steward invokes Liminal Spec operations (epic
  drafting, tech design, publish epic, implementation) via the CLI provider
  as background tasks. It constructs the appropriate context and skill
  invocations for each phase.
- Results integration: when a task completes, the output file appears in
  the package. The Steward notifies the user and offers to open the result
  for review. The manifest is updated if new files were created.
- Approval flow: the user reviews artifacts in the viewer and communicates
  through the chat — "looks good, proceed to tech design" or "section 3
  needs work." The Steward routes feedback and proceeds or iterates.
- Autonomous mode: the user opts in to "run the full pipeline for this
  feature." The Steward sequences through phases, running each and moving
  to the next without stopping for intermediate approval. The user reviews
  the final output.
- Progress visibility: active background tasks are visible in the chat
  with status and elapsed time.

### Out of Scope

- Custom agent harness (future — uses CLI provider from Epic 10)
- Multi-agent verification loops managed by the Steward directly (the CLI
  provider handles this internally via the skills)
- Pipeline state persistence beyond conversation history (fast follow)
- Formal approval gate UI with status badges (fast follow)
- Modifications to Liminal Spec skills themselves

### Rolled-Up Acceptance Criteria

The user tells the Steward to draft an epic. The Steward dispatches the
operation as a background task. The user sees a status indicator in the chat
and can continue working — browsing, editing, or chatting about other topics.

When the task completes, the Steward notifies the user and the output file
is in the package. The user opens it, reviews it in the viewer, and tells
the Steward to proceed or make changes.

The user can opt into autonomous mode: "Run the full spec pipeline for this
feature." The Steward sequences through PRD refinement, epic drafting, tech
design, and story publishing. The user reviews the final output rather than
approving each step.

The user can ask "what's running?" and see active tasks. They can cancel a
running task through the chat.

---

## Cross-Cutting Decisions

### Package Format Is an Open Convention

The `.mpk` / `.mpkz` format and manifest convention are designed to be
adopted by any tool. The format specification should be documented
independently of the viewer. Other viewers, editors, or agents should be
able to read and write packages without depending on MD Viewer code (though
the library API makes it easier).

### Steward Principle

Anything you can do in the viewer, you can do through the chat. The Steward
has full visibility and control over the app surface — opening files, creating
packages, editing documents, navigating the tree. This is a core design
principle, not a nice-to-have. It means the Steward needs access to the same
API surface the frontend uses.

### Provider Abstraction

The Steward's agent capabilities sit behind a WebSocket server that abstracts
the specific CLI or harness being used. Today it's the Claude CLI. The
interface is designed so that a custom-built harness focused on exactly the
Liminal Spec workflow could replace it without changes to the chat panel or
WebSocket protocol. Other CLIs (Codex, Copilot) could also be plugged in.

### Vanilla JS Throughout

No framework introduction for the chat panel. The streaming rendering uses
the existing markdown-it pipeline with a debounced re-render strategy for
incoming chunks. This is a deliberate choice: simpler mental model, fewer
build steps, and better compatibility with AI-assisted development on the
codebase.

### Feature Flags

The Spec Steward (Epics 10–14) is gated behind an env var / config file
flag. The mechanism is simple: `FEATURE_SPEC_STEWARD=true` or a config file
entry. No external feature flag service. When disabled, the Steward's UI,
WebSocket routes, and provider initialization are completely absent — not
hidden, absent.

---

## Future Directions

These are not v2 scope but inform architecture and design decisions.

### Pipeline State Model

The Steward tracks pipeline phase loosely in v2 (based on what artifacts exist
in the package). A future iteration adds a formal state model: defined phases,
transition gates, approval records, and status visualization in the UI. This
is the "tighten up state management" fast follow.

### Custom Agent Harness

The provider abstraction supports swapping in a purpose-built harness that
handles exactly the Liminal Spec workflow without needing Claude Code's full
generality. The skills encode the methodology; a focused harness just needs
to spawn agents with the right context, manage phases, stream output, and
handle verification. Smaller surface, potentially faster and more reliable.

### LLM Preamble

Packages could include a front-loaded summary section — an LLM-oriented
preamble that lets agents understand the package structure by reading just
the first portion of the file. Similar to `llms.txt`. Useful for agent
consumption of packages without scanning everything.

### Liminal DocGen Integration

DocGen produces structured markdown documentation for codebases. A natural
integration: DocGen outputs a package, MD Viewer opens it. The package
format makes this seamless.

### Spec Package Distribution

Spec packages could be shared, versioned, or published. A registry or
exchange mechanism for spec packages. Far future.

### Document Outline / Table of Contents

A collapsible outline panel or heading dropdown extracted from the current
document. Long documents with many headings need a way to jump between
sections. Headings already have proper IDs for anchor linking — the UI
to navigate them is missing. Standard feature for any markdown viewer.
Identified during gorilla testing.

### Liminal Spec Skill Updates

The Liminal Spec skills themselves may need updates to better support
package-based workflows — writing output directly into package structures,
updating manifests, tracking phase state in package metadata. These updates
are tracked separately from this PRD.

---

## Out of Scope (Product-Level)

These are not planned for any release, not just deferred from v2:

- Cloud sync or collaboration
- Multi-user hosting
- Real-time collaborative editing
- App Store or enterprise distribution
- Windows or Linux Electron packaging (macOS only for now)

---

## Recommended Epic Sequencing

```
Epic 7:  E2E Testing Framework
    │
    └──→ Epic 8:  Package Format Foundation (library + CLI)
              │
              └──→ Epic 9:  Package Viewer Integration
                        │
                        └──→ Epic 10: Chat Plumbing
                                  │
                                  └──→ Epic 11: Chat Rendering & Polish
                                            │
                                            ◆ M3: Manual UX iteration pause
                                            │
                                            └──→ Epic 12: Document Awareness & Editing
                                                      │
                                                      └──→ Epic 13: Package & Spec Awareness
                                                                │
                                                                └──→ Epic 14: Pipeline Orchestration
```

**Rationale:**

- **Epic 7 (E2E) comes first.** Establishes test infrastructure on the stable
  v1 surface. Every subsequent epic adds E2E coverage for its new features
  using the patterns established here.
- **Epic 8 (Package Foundation) is the format itself** — library, CLI,
  manifest parser, tar read/write. No viewer dependencies. Independently
  testable. Must exist before the viewer can integrate packages.
- **Epic 9 (Package Viewer) integrates packages into the UI.** Depends on
  Epic 8's library for all the heavy lifting. Delivers the full round-trip:
  create, browse, edit, export packages in the viewer.
- **Epic 10 (Chat Plumbing) is pure infrastructure.** Feature flag, provider
  abstraction, WebSocket streaming, basic chat panel with plain text
  streaming. The hard problem is provider lifecycle management — spawning,
  crash recovery, cancellation.
- **Epic 11 (Chat Rendering) makes it look good.** Streaming markdown
  rendering, partial construct handling, UI polish. After this epic,
  **pause for manual UX iteration** — the streaming feel needs human tuning.
- **Epic 12 (Document Awareness) adds single-document intelligence.** Context
  injection, editing through chat, conversation persistence. The chat knows
  what you're looking at and can act on it.
- **Epic 13 (Package Awareness) expands to project-level intelligence.**
  Multi-file context, package operations through chat, spec conventions,
  pipeline phase guidance. Depends on both chat infrastructure and package
  viewer integration.
- **Epic 14 (Pipeline Orchestration) adds autonomy.** Background tasks,
  pipeline dispatch, approval flow, autonomous mode. The Steward can do
  work, not just advise. Depends on everything before it.

Each epic is independently shippable and testable. No chicken-and-egg
dependencies. The sequence is strictly linear — each epic builds on the one
before it.

---

## Relationship to Downstream Specs

This PRD is the upstream input for detailed epic specs written using the
Liminal Spec methodology. Each feature section maps to one epic. The epic
specs will expand each feature into:

- Full acceptance criteria with test conditions
- Data contracts (API shapes)
- Non-functional requirements
- Story breakdown with sequencing

The PRD defines *what* and *why*. The epics define *exactly what* with
traceability. The tech designs define *how*.

The companion Technical Architecture document establishes the system shape,
stack decisions, and cross-cutting technical decisions that all downstream
epics inherit.

---

## Validation Checklist

- [x] User Profile grounds every feature
- [x] Problem Statement justifies the product
- [x] Each feature has Context, User Need, Scope, and Rolled-Up ACs
- [x] Rolled-Up ACs are specific enough to scope, general enough for epic
      expansion
- [x] No line-level ACs, TCs, or data contracts
- [x] Out-of-scope items point to where they're handled if planned
- [x] Milestones define feedback-gated phases
- [x] NFRs surfaced
- [x] Architecture summary establishes technical world
- [x] Cross-cutting decisions documented
- [x] Epic sequencing has rationale
