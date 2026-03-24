# Technical Design: Package and Spec Awareness (Epic 13)

## Purpose

This document translates the Epic 13 requirements into implementable architecture for expanding the Spec Steward from single-document awareness to full package-level intelligence and spec-driven guidance. It serves three audiences:

| Audience | Value |
|----------|-------|
| Reviewers | Validate architecture decisions before code is written |
| Developers | Clear blueprint for implementation |
| Story Tech Sections | Source of implementation targets, interfaces, and test mappings |

**Output structure:** Config B (4 docs) — server + client domain split, consistent with Epics 9, 10, and 12 tech design structures.

| Document | Content |
|----------|---------|
| `tech-design.md` (this file) | Index: decisions, context, system view, module architecture overview, work breakdown |
| `tech-design-server.md` | Server implementation depth: package context injection, script context methods, phase detection, schema extensions |
| `tech-design-client.md` | Client implementation depth: extended context indicator, `chat:package-changed` handling, sidebar re-sync |
| `test-plan.md` | TC→test mapping, mock strategy, fixtures, chunk breakdown with test counts |

**Prerequisite:** Epic 13 spec (`epic.md`) is complete with 28 ACs and 90 TCs, verified through 2 rounds. Epics 9 (package viewer), 10 (chat plumbing), 11 (chat rendering), and 12 (document awareness) tech designs define the extension points this design builds on.

---

## Spec Validation

Before designing, the epic was validated as the downstream consumer. All ACs map to implementation work. The following issues were identified and resolved during validation:

| Issue | Spec Location | Resolution | Status |
|-------|---------------|------------|--------|
| `ManifestMetadata` type from Epic 8 includes `type` and `status` but not `specPhase` or `specStatus` | AC-5.1, Data Contracts | The Epic 8 manifest parser returns all YAML frontmatter fields in the `ManifestMetadata` object. Standard fields (`title`, `version`, `author`, `description`, `type`, `status`) are typed; additional fields are accessible via the raw content. Design extracts spec-specific fields by re-parsing the frontmatter with `js-yaml` (promoted from transitive to direct dependency). The `ManifestMetadata.type` field covers the `type: spec` convention directly. | Resolved — clarified |
| `ProviderContext` is a design-time concept, not a runtime schema | Data Contracts | The epic defines `ProviderContext` as the interface for what the CLI receives. This is not a Zod schema — it's the structure of the injected context. The actual runtime representation is the constructed user message (XML blocks) and system prompt (CLI flags). The `ChatSendMessage.context` schema is NOT modified — the client continues to send only `activeDocumentPath`. The server derives workspace and package context from session state. | Resolved — clarified |
| Per-response read budget not specified in `ChatSendMessage` | AC-2.2, Q1 | The budget is server-side state, not a client concern. A per-message counter tracks cumulative `getFileContent` characters and resets on each new `chat:send`. No schema change needed. | Resolved — clarified |
| `createPackage()` in folder mode needs to update session state to reflect package mode | AC-3.5, AC-7.1 | For folder mode: delegates to `PackageService.create(rootDir, overwrite?)` which sets `mode: 'directory'` in session state. For extracted fallback repair (TC-7.1d/e): scaffolds manifest directly via Epic 8's `scaffoldManifest()` and updates `manifestStatus` in session without calling `create()` (which would wrongly switch to directory mode). Both paths trigger `chat:package-changed`. | Resolved — clarified |
| `openDocument` needs a distinct message type from `chat:file-created` | AC-3.3, Epic 12 client contract | Epic 12's `chat:file-created` handler only reloads already-open tabs (`if (!isOpen) return`). `openDocument` needs to open/activate a tab for files not currently open. Design adds `chat:open-document` as a new message type with corresponding client handler that calls `openFileInTab()`. | Resolved — deviated |
| Script executor is a private field of ProviderManager | C2 from verification, Epic 10 design | Epic 10 places `scriptExecutor` as a private `ProviderManager` field. The route cannot call `scriptExecutor.setContext()` directly. Design adds `providerManager.setScriptContext(ctx)` — a new public method that accepts per-message context and passes it to the internal executor. `provider-manager.ts` is now marked MODIFIED. | Resolved — deviated |
| PackageService API alignment with Epic 9 | C1 from verification | Epic 9's `PackageService` defines: `create(rootDir, overwrite?)`, `export(outputPath, compress?, sourceDir?)`, `getManifest()`, `markStale()`, `clearStale()`, `getState()`. No `getManifestFilename()`, `reloadManifest()`, or `activateDirectoryPackage()`. Design corrected to use: Epic 8's `MANIFEST_FILENAME` constant for manifest path, `getManifest()` (re-reads per contract) instead of `reloadManifest()`, and direct session updates instead of `activateDirectoryPackage()`. `manifest.raw` used (not `rawContent`). | Resolved — corrected |
| `exportPackage` in folder mode with no manifest should auto-scaffold in memory | AC-7.2a, TC-7.2a | Consistent with Epic 9 AC-5.2: when exporting a folder without a manifest, the export scaffolds a manifest in memory (not written to the source folder) and includes it in the package. The `exportPackage` script method delegates to `PackageService.export()` which already handles this. | Resolved — confirmed |
| `chat:package-changed` not yet in `ChatServerMessageSchema` | Data Contracts | Added to the Zod discriminated union alongside existing message types. This is the same additive pattern used in Epic 12 for `chat:file-created` and `chat:conversation-load`. | Resolved — clarified |
| Stale indicator interaction with script methods | AC-3.6, Q6 | Script methods that write files (`addFile`, `editFile`, `updateManifest`) check the active package mode after each write. If `activePackage.mode === 'extracted'`, the method calls `PackageService.markStale()`. This delegates to the existing stale tracking from Epic 9. | Resolved — clarified |
| Active document path resolution in extracted packages | AC-2.4b | When a package is extracted, the effective workspace root is the `extractedRoot` from `activePackage`. All relative paths in script methods resolve against this root. The `resolveWorkspacePath()` utility handles both folder mode (resolve against `lastRoot`) and package mode (resolve against `extractedRoot`). | Resolved — clarified |
| `getFileContent` binary detection | AC-2.3, TC-2.3c | Binary files are detected by attempting UTF-8 read and checking for null bytes in the first 8KB. If null bytes are found, the method returns a `NOT_TEXT_FILE` error. This is a simple heuristic consistent with how git detects binary files. | Resolved — clarified |

**Verdict:** Spec is implementation-ready. No blocking issues remain. All 10 tech design questions are answered below. The extension points from Epics 10, 12, and 9 are designed for exactly this type of additive extension.

---

## Context

Epic 13 is where the Spec Steward becomes project-aware. Epics 10 through 12 built the chat infrastructure progressively — plumbing, rendering, and single-document awareness. The Steward can see the active document, edit it, and persist conversations across restarts. But it has no knowledge of the broader workspace: the package structure, the manifest navigation tree, the other files in the project, or where the user is in a spec lifecycle. Epic 13 bridges the package system (Epics 8-9) with the chat system (Epics 10-12), making the Steward package-native and spec-aware.

The core technical challenge is extending the provider context and script execution surface without complicating the existing architecture. Epic 12 established clean extension points: `ProviderContext` (an interface-level concept that maps to CLI prompt construction), `ScriptContext` (the curated method surface for `vm.runInNewContext`), and `ChatServerMessage` (the Zod discriminated union for server→client WebSocket messages). Epic 13 fills these slots with package-level capabilities. The `buildInjectedContext()` function gains a `<workspace-context>` XML block alongside the existing `<active-document>` block. The `buildScriptContext()` function gains seven new methods. The `ChatServerMessageSchema` gains `chat:package-changed`.

The design is constrained by the Steward principle: anything you can do in the viewer, you can do through the chat. Epic 9 delivers four package-content operations through the UI — open package (workspace-level, out of scope for Epic 13), create package (scaffold manifest), export package, and modify manifest. Epic 13 makes three of these available through chat, plus file operations that Epic 12 scoped to active-document-only. The fourth — opening a different package — is a workspace-switching operation that introduces mid-response root switching complexity; it's explicitly deferred.

The spec awareness layer is deliberately lightweight. Phase detection uses filename regex patterns against manifest navigation entries — not frontmatter scanning, not content analysis, not a state machine. The detected phase and artifact list are injected into the provider context as informational data. The Steward uses this data to offer conversational guidance ("you have a PRD and an epic — ready for tech design?"), but the phase data doesn't gate any operations. The user can skip phases, work out of order, or ignore guidance entirely. This matches the Liminal Spec methodology's philosophy: the process is a guide, not a cage.

The implementation builds on well-established patterns. The `PackageService` from Epic 9 provides manifest parsing, package creation, and export. The `ConversationService` from Epic 12 provides workspace identity resolution. The `ScriptExecutor` from Epic 10 provides sandboxed execution with async support (added in Epic 12). The `ContextInjectionService` from Epic 12 provides prompt construction with token budget management. Epic 13 composes these existing services with new coordination logic — it introduces no new architectural patterns, only new capabilities within established patterns.

One dependency change: `js-yaml` (already a transitive dependency) is promoted to a direct dependency for spec metadata extraction from manifest frontmatter. `@types/js-yaml` is added as a devDependency. No other new packages — all remaining functionality uses Node.js built-ins and existing project dependencies.

---

## Tech Design Question Answers

The epic posed 10 questions. All are answered here; detailed implementation follows in the companion documents.

### Q1: Per-response read budget size

**Answer:** 300,000 characters (~75,000 tokens at 4 chars/token), applied to cumulative `getFileContent` reads within a single CLI response turn.

The budget is separate from the active document injection (which has its own 100,000 character budget from Epic 12). The 300K limit allows reading 3-5 typical spec documents per response while leaving room in the CLI's ~200K token context window for conversation history, system prompt, and response generation.

Implementation: A `ReadBudgetTracker` class with a `consume(chars: number): boolean` method. Created fresh for each `chat:send` message. Passed into the script context builder so `getFileContent` can check the budget before reading. When exceeded, `getFileContent` returns a `READ_BUDGET_EXCEEDED` error result to the CLI — the Steward can still complete its response using files already read.

The budget is a named constant (`READ_BUDGET_CHARS = 300_000`) in the server configuration, adjustable without code changes.

**Detailed design:** See server companion doc, Script Context Extensions section.

### Q2: Artifact detection strategy

**Answer:** Filename-only regex matching against navigation entry paths. No frontmatter scanning, no content analysis.

Detection scans the `filePath` property of every `NavigationNode` in the manifest navigation tree. For folder-mode workspaces without a manifest, detection is skipped (no manifest = no navigation entries to scan). The patterns are intentionally broad — false positives are acceptable because the guidance is conversational, not prescriptive.

| Artifact Type | Patterns |
|--------------|---------|
| `prd` | `/prd\.md$/i`, `/product.?requirements/i` |
| `epic` | `/epic\.md$/i`, `/epic[-_]/i`, `/feature.?spec/i` |
| `tech-design` | `/tech.?design/i`, `/technical.?(design\|architecture)/i` |
| `stories` | `/stories?\//i`, `/story[-_]/i` |

The detected phase is the highest artifact type in pipeline order: `prd` → `epic` → `tech-design` → `stories`. The `implementation` phase is not artifact-detectable — it requires the declared `specPhase: implementation` metadata.

Performance: Scanning 100 navigation entries against 8 regex patterns completes in sub-millisecond time. No caching needed — detection runs inline during context construction for each message.

**Detailed design:** See server companion doc, Phase Detection section.

### Q3: Context construction

**Answer:** Extend `buildInjectedContext()` with a `<workspace-context>` XML block in the user message, and extend `buildSystemPrompt()` with package-aware instructions and new script method documentation.

The user message sent to the CLI is structured as:

```
<workspace-context type="package" title="My Spec" mode="directory">
## Metadata
title: My Spec
version: 1.0
type: spec
specPhase: epic
specStatus: draft

## Navigation
- [Product Requirements](prd.md)
- [Epic](epic.md)
  - [Tech Design](tech-design.md)
- Authentication
  - [OAuth2 Flow](auth/oauth2.md)

## Spec Phase
Detected artifacts: prd, epic
Detected phase: epic
Declared phase: epic
Declared status: draft
</workspace-context>

<active-document path="epic.md" truncated="false" total-lines="150">
[document content]
</active-document>

[user's message text]
```

When the workspace is a folder (no package), the `<workspace-context>` block has `type="folder"` with no navigation or spec sections. When the package has no manifest, `manifestStatus="missing"` is included with no navigation.

The system prompt is extended with package-aware instructions, new script method documentation, and spec phase guidance conventions. The system prompt is a static string (versioned with the code) that changes only when Steward capabilities change.

**Detailed design:** See server companion doc, Context Injection Extension section.

### Q4: Manifest update atomicity

**Answer:** Yes — atomic writes via temp file + rename, consistent with the existing session persistence pattern.

The `updateManifest(content)` method:
1. Parses the new content through Epic 8's `parseManifest()` to validate structure
2. If parse fails → return error, existing manifest unchanged
3. If parse succeeds → atomic write (temp file + rename) to the manifest path
4. After write → send `chat:package-changed` with `change: 'manifest-updated'`
5. Update in-memory manifest state in `PackageService`

If the write succeeds but the WebSocket notification fails (connection dropped between write and send), the manifest is still updated on disk. The client will see the update on the next manifest re-fetch (e.g., when sending the next message or on reconnect). The notification is a fast-path optimization, not a correctness requirement.

**Detailed design:** See server companion doc, Script Context Extensions section.

### Q5: Package creation working directory

**Answer:** Script methods call service methods directly, not through the REST API.

The script context is constructed in `ws-chat.ts` which has access to all server services (`PackageService`, `SessionService`, `ConversationService`). The `createPackage()` script method calls `PackageService.create()` directly — the same service method that the `POST /api/package/create` route handler calls. Going through HTTP would add unnecessary overhead (serialize → HTTP → deserialize → service → serialize → HTTP → deserialize) for what is an in-process call.

This pattern is consistent with Epic 12's `applyEditToActiveDocument()` which writes directly to the filesystem rather than calling a REST endpoint.

**Detailed design:** See server companion doc, Script Context Extensions section.

### Q6: File creation in extracted packages

**Answer:** Check `activePackage.mode` from session state after every file write. If `mode === 'extracted'`, call `PackageService.markStale()`.

The session state's `activePackage` field (from Epic 9) contains the package mode discriminator. The script context methods receive the session service reference when constructed. After a successful file write (`addFile`, `editFile`, `updateManifest`), the method checks:

```typescript
const pkg = sessionService.getSession().activePackage;
if (pkg && pkg.mode === 'extracted') {
  packageService.markStale();
}
```

`PackageService.markStale()` already exists from Epic 9 — it sets the `stale` flag in the session's `activePackage` field and persists it. The client detects the stale state via the existing stale indicator mechanism (Epic 9 AC-7.2).

For directory-mode packages, `mode === 'directory'` and stale is not applicable — files are edited in place on disk, there's no source package to be out of date with. TC-3.6d confirms this.

**Detailed design:** See server companion doc, Script Context Extensions section.

### Q7: Export path validation

**Answer:** Require absolute paths. Validate parent directory existence and write permissions before starting the export.

The `exportPackage(options)` method:
1. Validates `outputPath` is an absolute path (starts with `/`)
2. Validates the parent directory exists (`stat()` on dirname)
3. Validates the parent directory is writable (access check)
4. If validation fails → return descriptive error
5. If validation passes → delegate to `PackageService.export()`

Relative paths are rejected because the script execution context has no meaningful "current directory" — the workspace root is not always the right base for export output. Requiring absolute paths eliminates ambiguity. The CLI can construct absolute paths from the workspace root if needed (the root is in the `<workspace-context>` block).

**Detailed design:** See server companion doc, Script Context Extensions section.

### Q8: Context indicator layout

**Answer:** CSS flex row: `[Package icon + title] > [document path] [truncation badge]`

The context indicator extends the Epic 12 design:

| Workspace Mode | Indicator Display |
|---------------|------------------|
| Folder + document | `docs/epic.md` (Epic 12 behavior, unchanged) |
| Folder + document + truncated | `docs/epic.md` `[truncated]` (Epic 12 behavior) |
| Package + document | `📦 My Spec > docs/epic.md` |
| Package + document + truncated | `📦 My Spec > docs/epic.md` `[truncated]` |
| Package + no document | `📦 My Spec` |
| Folder + no document | (empty, per Epic 12) |

The package icon is a CSS-drawn box (not an emoji in the DOM — emojis render inconsistently across platforms). The `>` separator is a CSS-styled chevron. The truncation badge is the existing `[truncated]` indicator from Epic 12.

The indicator is a flex container. Package title is clamped to a max-width with ellipsis overflow. Document path fills remaining space. This prevents long package titles from pushing the document path off-screen.

**Detailed design:** See client companion doc, Extended Context Indicator section.

### Q9: Spec phase detection caching

**Answer:** No caching. Compute on every message.

Phase detection scans navigation entries (array of `NavigationNode` objects) against regex patterns. For 100 entries × 8 patterns = 800 regex tests, this completes in sub-millisecond time. The cost is negligible compared to the CLI invocation (~1-2 seconds) and context injection file reads (~10-50ms).

Caching would require invalidation on file create/edit/manifest update — adding complexity for zero measurable benefit. The simplicity of compute-on-every-message outweighs any theoretical performance gain.

**Detailed design:** See server companion doc, Phase Detection section.

### Q10: CLI working directory isolation

**Answer:** Keep the CLI working directory as the app's root directory (inherited from Epic 10). Do not change to the workspace root or `/tmp`.

The CLI manages its own session storage relative to its working directory. Changing cwd would affect `--resume` behavior and potentially break session persistence. The system prompt instructs the CLI to use script methods for all workspace operations — this is the established pattern from Epic 12 and is effective (the CLI follows system prompt instructions).

The defense-in-depth is not the working directory; it's the curated script context. The CLI's built-in file tools (Read, Write) operate relative to cwd, but the system prompt explicitly instructs the CLI to use `<steward-script>` blocks for all workspace operations. If the CLI ignores the instruction and uses built-in tools, the file watcher detects the changes (same fallback as Epic 12 Q6).

Setting cwd to `/tmp` would be counterproductive — the CLI might fail to initialize properly if its session directory doesn't exist. Setting cwd to the workspace root would give built-in tools direct workspace access, which is the opposite of the isolation intent.

**Detailed design:** N/A — no changes from Epic 10/12 provider configuration.

---

## System View

### System Context Diagram

Epic 13 extends the Epic 12 system with three new data flows: package manifest structure flows from the package service into the CLI prompt, workspace-scoped file operations flow through the script execution lane, and package state changes flow from the server to the client.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Browser                                                              │
│  ┌──────────────────────────────────────┬─────────────────────────┐  │
│  │ Existing Frontend                    │ Chat Panel              │  │
│  │  Sidebar │ Workspace │ Tabs          │ + Extended context      │  │
│  │          │           │               │   indicator (pkg + doc) │  │
│  │  Package-mode nav ◄── re-fetch on    │ + chat:package-changed  │  │
│  │  (Epic 9)             package-changed│   handler               │  │
│  └────────────┬─────────────────────────┴────────┬────────────────┘  │
│               │ HTTP + WS (file watch)           │ WS (chat)         │
└───────────────┼──────────────────────────────────┼───────────────────┘
                │                                  │
┌───────────────┼──────────────────────────────────┼───────────────────┐
│ Fastify Server│                                  │                   │
│  ┌────────────┴──────────────────────────────────┴────────────────┐  │
│  │ Existing REST + WS │ GET /api/features │ WS /ws/chat           │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ Existing Services                                              │  │
│  │  + PackageContextService (NEW: manifest → context, phase det.) │  │
│  │  + PhaseDetector (NEW: artifact patterns → phase)              │  │
│  │  + Extended ContextInjection (workspace-context block)         │  │
│  │  + Extended ScriptExecutor (7 new curated methods)             │  │
│  │  + Extended ws-chat route (package-changed, stale, budget)     │  │
│  │  PackageService (Epic 9, consumed)                             │  │
│  │  ConversationService (Epic 12, consumed)                       │  │
│  │  SessionService (Epic 1, consumed)                             │  │
│  └──────────────────────┬─────────┬───────────────────────────────┘  │
│                         │         │                                  │
│           ┌─────────────┼─────────┼────────────┐                     │
│           │             │         │            │                     │
│     Local Filesystem    │    Session Dir    CLI Process               │
│     (workspace docs)    │    (conversations, (claude -p)             │
│     (manifests)         │     session.json)                          │
│                         │                                            │
│                    Epic 8 Library                                     │
│                    (manifest parser,                                  │
│                     tar, scaffold)                                    │
└──────────────────────────────────────────────────────────────────────┘
```

The key architectural insight is that Epic 13 introduces no new communication channels. Everything flows through the existing WebSocket chat route (`/ws/chat`) and REST API (`/api/package/*`). The new capabilities are:
1. **Richer context injection** — the user message gains a `<workspace-context>` block alongside the existing `<active-document>` block
2. **More script methods** — the VM sandbox gains 7 new curated methods that delegate to existing services
3. **Two new WebSocket message types** — `chat:package-changed` notifies of workspace state changes; `chat:open-document` opens a file in a viewer tab (distinct from `chat:file-created` which only reloads already-open tabs)

### External Contracts

**Client → Server (WebSocket `/ws/chat`) — Unchanged:**

The `ChatSendMessage` schema is NOT modified. The client continues to send only `activeDocumentPath` in the context field. The server derives all workspace and package context from session state — no client-side change needed for context injection.

| Message Type | Change | Key Fields |
|-------------|--------|------------|
| `chat:send` | UNCHANGED | `messageId`, `text`, `context.activeDocumentPath` |
| `chat:cancel` | UNCHANGED | `messageId` |
| `chat:clear` | UNCHANGED | — |

**Server → Client (WebSocket `/ws/chat`) — New Messages:**

| Message Type | Purpose | Key Fields |
|-------------|---------|------------|
| `chat:package-changed` | Workspace state change from Steward operation | `messageId`, `change`, `details?` |
| `chat:open-document` | Open/activate a file in a viewer tab (unlike `chat:file-created` which only reloads open tabs) | `path`, `messageId` |

**Server → Client (WebSocket `/ws/chat`) — Existing (Unchanged):**

| Message Type | Purpose |
|-------------|---------|
| `chat:token` | Streaming text (unchanged) |
| `chat:done` | Response complete (unchanged) |
| `chat:error` | Error with code (extended with new codes) |
| `chat:status` | Provider lifecycle (unchanged) |
| `chat:file-created` | File edited/created by Steward (reused for addFile/editFile) |
| `chat:conversation-load` | Conversation restore (unchanged) |
| `chat:context` | Context acknowledgment (extended with workspace info) |

**Message Sequencing:**

Within a single Steward response, the message ordering is:

```
chat:send (client → server)
  │
  ├── chat:context (server → client, immediate)
  ├── chat:token* (server → client, streaming)
  ├── chat:file-created* (server → client, during script execution)
  ├── chat:package-changed* (server → client, during script execution)
  └── chat:done (server → client, after CLI process exits)
```

All `chat:file-created` and `chat:package-changed` messages for a response are guaranteed to arrive before `chat:done` for that response. This is because script execution happens during the CLI's streaming phase — the CLI emits `<steward-script>` blocks as part of its response, the server executes them and sends notifications, and the CLI's `result` event (which triggers `chat:done`) arrives only after all script blocks are processed.

**New Error Codes:**

| Code | Description | Related AC |
|------|-------------|-----------|
| `FILE_NOT_FOUND` | File does not exist in workspace | AC-2.1, AC-4.2 |
| `FILE_ALREADY_EXISTS` | Cannot create — file exists at path | AC-4.1 |
| `PATH_TRAVERSAL` | Path resolves outside workspace root | AC-2.1, AC-4.1, AC-4.2 |
| `MANIFEST_NOT_FOUND` | Package operation requires manifest but none exists | AC-3.1 |
| `MANIFEST_PARSE_ERROR` | Updated manifest content is invalid | AC-3.1 |
| `PERMISSION_DENIED` | File/directory not readable/writable | AC-4.1, AC-4.2 |
| `NOT_TEXT_FILE` | File is binary, not readable as text | AC-2.3 |
| `READ_BUDGET_EXCEEDED` | Per-response file read budget exhausted | AC-2.2 |
| `PACKAGE_EXPORT_FAILED` | Export operation failed | AC-3.2 |
| `PACKAGE_CREATE_FAILED` | Manifest scaffold failed | AC-7.1 |

Added to the existing `ChatErrorCodeSchema` enum.

**Extended `chat:context` Message:**

The `chat:context` server message (from Epic 12) is extended to include workspace type and an optional warning for degraded package context (AC-8.2):

```typescript
interface ChatContextMessage {
  type: 'chat:context';
  messageId: string;
  activeDocument: { relativePath: string; truncated: boolean; totalLines?: number } | null;
  workspace: {                  // NEW — Epic 13
    type: 'folder' | 'package';
    rootPath: string;           // Effective workspace root (needed by CLI for path construction)
    packageTitle?: string;      // Present when type === 'package'
    warning?: string;           // AC-8.2: degraded context (e.g., "package context unavailable")
  };
}
```

This gives the client the server's truth about workspace state for the context indicator, consistent with Epic 12's pattern where `chat:context` provides the server's truth about truncation.

**Runtime Prerequisites:**

| Prerequisite | Where Needed | How to Verify |
|---|---|---|
| Node.js (inherited) | Local + CI | `node --version` |
| Claude CLI (`claude`) | Local only | `which claude` |
| Epics 9, 10, 11, 12 complete | — | Package viewer + chat panel functional with document awareness |
| `js-yaml` (promoted to direct) | Server | `require('js-yaml')` resolves |

---

## Module Architecture Overview

### Server-Side Modules

```
app/src/server/
├── routes/
│   └── ws-chat.ts                        # MODIFIED — package context, extended script
│                                         #   context, chat:package-changed, stale tracking,
│                                         #   read budget management
├── services/
│   ├── package-context.ts                # NEW — build package portion of provider context
│   ├── phase-detector.ts                 # NEW — artifact detection, phase inference
│   ├── context-injection.ts              # MODIFIED — <workspace-context> block, extended
│   │                                     #   system prompt with package instructions
│   ├── script-executor.ts               # MODIFIED — 7 new curated methods via
│   │                                     #   buildExtendedScriptContext()
│   ├── provider-manager.ts              # MODIFIED — setScriptContext(ctx) to accept
│   │                                     #   per-message context from ws-chat route
│   ├── stream-parser.ts                 # UNCHANGED
│   ├── conversation.ts                  # UNCHANGED
│   ├── package.service.ts               # UNCHANGED (consumed, not modified)
│   ├── session.service.ts               # UNCHANGED (consumed, not modified)
│   └── features.ts                      # UNCHANGED
├── schemas/
│   └── index.ts                          # MODIFIED — ChatPackageChangedMessage,
│                                         #   extended ChatContextMessage, new error codes
└── app.ts                                # UNCHANGED
```

### Client-Side Modules

```
app/src/client/
├── steward/
│   ├── context-indicator.ts              # MODIFIED — package mode display, workspace type
│   ├── chat-ws-client.ts                # MODIFIED — handle chat:package-changed,
│   │                                     #   extended chat:context
│   ├── chat-panel.ts                    # MODIFIED — wire package-changed to sidebar
│   │                                     #   re-sync, pass workspace info to indicator
│   ├── chat-state.ts                    # MODIFIED — workspace type tracking
│   ├── chat-resizer.ts                  # UNCHANGED
│   └── features.ts                       # UNCHANGED
└── styles/
    └── chat.css                          # MODIFIED — package indicator styles
```

### Module Responsibility Matrix

| Module | Status | Responsibility | Dependencies | ACs Covered |
|--------|--------|----------------|--------------|-------------|
| **New server modules** | | | | |
| `package-context.ts` | NEW | Build package context: manifest, metadata, navigation tree, file count. Extract spec metadata. Run phase detection. Returns structured `PackageContext`. | `PackageService`, `SessionService`, `PhaseDetector`, `js-yaml` | AC-1.1, AC-1.3, AC-5.1, AC-5.3 |
| `phase-detector.ts` | NEW | Artifact detection from `NavigationNode[]`. Infer pipeline phase from detected artifacts. | — (pure function, no deps) | AC-6.1 |
| **Modified server modules** | | | | |
| `context-injection.ts` | MODIFIED | Extended `buildInjectedContext()`: adds `<workspace-context>` XML block. Extended `buildSystemPrompt()`: package-aware instructions, new script methods. | `package-context.ts`, `fs`, `path` | AC-1.1, AC-1.3, AC-5.1, AC-6.2 |
| `script-executor.ts` | MODIFIED | 7 new curated methods via `buildExtendedScriptContext()`. Per-message context construction. | `fs`, `path`, `PackageService`, `SessionService` | AC-2.1–AC-2.4, AC-3.1–AC-3.6, AC-4.1–AC-4.3, AC-7.1–AC-7.3 |
| `provider-manager.ts` | MODIFIED | `setScriptContext(ctx)` — accept per-message script context from ws-chat route. Replaces the hardcoded `createScriptContext()` call in `executeScript()` with the externally-provided context. | `script-executor` | AC-2.1–AC-4.3 (script method dispatch) |
| `ws-chat.ts` | MODIFIED | Build per-message script context, call `providerManager.setScriptContext()` before `send()`. Read budget tracker per message. `chat:package-changed` and `chat:open-document` sending. Stale flag management. Extended `chat:context` with workspace info. | `package-context.ts`, `script-executor.ts`, `PackageService`, `SessionService` | AC-3.3, AC-3.4, AC-3.6, AC-8.1, AC-8.2 |
| `schemas/index.ts` | MODIFIED | `ChatPackageChangedMessageSchema`, `ChatOpenDocumentMessageSchema`, extended `ChatContextMessageSchema`, new error codes | `zod` | (supports all ACs) |
| **Modified client modules** | | | | |
| `context-indicator.ts` | MODIFIED | Show workspace type + package title alongside active document. Handle extended `chat:context` payload. | `chat-state` | AC-1.2 |
| `chat-ws-client.ts` | MODIFIED | Dispatch `chat:package-changed`, `chat:open-document` events. Handle extended `chat:context` with `rootPath`/`warning`. | — | AC-3.3, AC-3.4 |
| `chat-panel.ts` | MODIFIED | Wire `chat:package-changed` to sidebar re-sync. Wire `chat:open-document` to `openFileInTab()`. Call `GET /api/package/manifest` on manifest-updated. Trigger sidebar mode switch on created. Immediate context indicator update on created. Pass workspace info to indicator. | `chat-ws-client`, sidebar API, `context-indicator` | AC-3.3, AC-3.4, AC-3.5 |
| `chat-state.ts` | MODIFIED | Track workspace type (`folder` \| `package`) from `chat:context`. Store package title. | — | AC-1.2 |
| `chat.css` | MODIFIED | Package indicator styles: icon, title, chevron separator | — | AC-1.2 |

### Component Interaction Diagram

```
                    ┌─────────────────┐
                    │     ws-chat.ts  │
                    │   (orchestrator)│
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────────┐
         │                   │                       │
    ┌────┴────────┐   ┌──────┴──────┐         ┌─────┴──────────┐
    │  context-   │   │  script-    │         │  package-      │
    │  injection  │   │  executor   │         │  context       │
    │  (extended) │   │  (extended) │         │  (NEW)         │
    └────┬────────┘   └──────┬──────┘         └─────┬──────────┘
         │                   │                       │
         │            ┌──────┼──────┐         ┌──────┴──────┐
         │            │      │      │         │             │
         │      ┌─────┴──┐ ┌┴────┐ │    ┌────┴───┐   ┌────┴───┐
         │      │Package │ │File │ │    │Phase   │   │js-yaml │
         │      │Service │ │ ops │ │    │Detector│   │(spec   │
         │      │(Ep.9)  │ │(fs) │ │    │(NEW)   │   │ meta)  │
         │      └────────┘ └─────┘ │    └────────┘   └────────┘
         │                         │
    ┌────┴────┐              ┌─────┴──────┐
    │ CLI     │              │ Session    │
    │ Process │              │ Service    │
    └─────────┘              └────────────┘
```

---

## Dependency Map

### npm Dependencies

| Dependency | Action | Version | Purpose |
|-----------|--------|---------|---------|
| `js-yaml` | Promote transitive → direct | ^4.1.0 | Extract spec metadata (`specPhase`, `specStatus`) from manifest YAML frontmatter |
| `@types/js-yaml` | Add as devDependency | ^4.0.9 | TypeScript type definitions for js-yaml |

All other dependencies are Node.js built-ins or existing project dependencies:

| Dependency | Source | Used By |
|-----------|--------|---------|
| `node:fs/promises` | Built-in | `script-executor.ts` (file ops), `package-context.ts` (manifest read) |
| `node:path` | Built-in | `script-executor.ts` (path resolution, traversal prevention) |
| `node:vm` | Built-in (existing) | `script-executor.ts` (script execution, unchanged) |
| `zod` | Existing | `schemas/index.ts` (new message schemas) |
| `@fastify/websocket` | Existing | `ws-chat.ts` (unchanged) |

**Packages considered and rejected:**

| Package | Why Rejected |
|---------|-------------|
| `gray-matter` | Full-featured frontmatter parser — overkill. js-yaml directly parses the YAML portion after splitting on `---` delimiters. The manifest parser (Epic 8) already handles the full parse; js-yaml is only needed for extracting spec-specific fields from metadata. |
| `tiktoken` / `gpt-tokenizer` | Token counting libraries. The character heuristic (`length / 4`) is sufficient per Epic 12's validated approach. Adding a tokenizer would introduce a WASM dependency for negligible accuracy improvement. |
| `is-binary-path` | npm package for binary file detection. A simple null-byte check on the first 8KB is sufficient and avoids an external dependency. |

---

## Verification Scripts

Epic 13 uses the existing verification infrastructure. No changes needed:

| Script | Command | Purpose |
|--------|---------|---------|
| `red-verify` | `npm run format:check && npm run lint && npm run typecheck && npm run typecheck:client` | TDD Red exit gate |
| `verify` | `npm run red-verify && npm run test` | Standard development gate |
| `green-verify` | `npm run verify && npm run guard:no-test-changes` | TDD Green exit gate |
| `verify-all` | `npm run verify && npm run test:e2e` | Full gate including E2E |

New test files go in `tests/server/steward/` and `tests/client/steward/`. E2E tests in `tests/e2e/steward-package.spec.ts`. All are picked up by existing config globs.

---

## Work Breakdown: Chunks and Phases

### Summary

| Chunk | Scope | ACs | Test Count | Running Total |
|-------|-------|-----|------------|---------------|
| 0 | Infrastructure: types, schemas, fixtures, phase detector | — | 11 | 11 |
| 1 | Package Context + Context Indicator | AC-1.1, AC-1.2, AC-1.3 | 16 | 27 |
| 2 | Multi-File Reading | AC-2.1, AC-2.2, AC-2.3, AC-2.4 | 18 | 45 |
| 3 | File Creation and Non-Active Editing | AC-4.1, AC-4.2, AC-4.3 | 16 | 61 |
| 4 | Package Operations Through Chat | AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5, AC-3.6 | 26 | 87 |
| 5 | Spec Conventions + Phase Awareness | AC-5.1, AC-5.2, AC-5.3, AC-6.1, AC-6.2, AC-6.3 | 20 | 107 |
| 6 | Folder-Mode Chat + Error Handling | AC-7.1, AC-7.2, AC-7.3, AC-8.1, AC-8.2, AC-8.3 | 22 | 129 |
| **Total** | | **28 ACs, 90 TCs** | **129 tests** | |

### Chunk Dependencies

```
Chunk 0 (Infrastructure)
    ↓
Chunk 1 (Package Context)
    ↓
    ├──→ Chunk 2 (Multi-File Reading)
    │        ↓
    │    Chunk 3 (File Create/Edit)
    │        ↓
    │    Chunk 4 (Package Operations) ←─── requires Chunk 3
    │
    └──→ Chunk 5 (Spec + Phase)
              ↓
         Chunk 6 (Folder-Mode + Errors) ←── requires Chunks 4 and 5
```

Chunks 2-3-4 (file operations) and Chunk 5 (spec awareness) can proceed in parallel after Chunk 1. Chunk 6 depends on both branches because folder-mode chat tests package operations and error handling tests span all script methods.

### Chunk 0: Infrastructure

**Scope:** Extended `ProviderContext` type with workspace, package, and spec fields. `ChatPackageChangedMessageSchema` (Zod). New error codes. `PackageManifestInfo`, `CreatePackageOptions`, `ExportPackageOptions`, `FileReadResult` types. `SpecMetadata` type. `PhaseDetector` pure function. Extended `ChatContextMessageSchema`. Test fixtures (sample packages with known manifests and spec metadata, packages with various artifact combinations for phase detection).

**ACs:** None directly — infrastructure supporting all ACs.

**Relevant Tech Design Sections:** §System View (External Contracts, Error Codes), §Module Architecture (all new types), Server Companion §Phase Detection, Server Companion §Schema Extensions, Test Plan §Fixtures

**Non-TC Decided Tests:** Schema validation tests for new Zod schemas (5 tests: ChatPackageChanged valid/invalid, ChatContextMessage with workspace+rootPath, error codes, ChatOpenDocument). Phase detector unit tests for each artifact pattern (6 tests).

**Test Count:** 11 tests (0 TC-mapped + 11 non-TC)

### Chunk 1: Package Context + Context Indicator

**Scope:** `PackageContextService` builds package context from session state and manifest. Extended `buildInjectedContext()` adds `<workspace-context>` block. Extended `buildSystemPrompt()` with package-aware instructions. Extended `chat:context` message with workspace info. Client context indicator shows workspace type and package title.

**ACs:** AC-1.1, AC-1.2, AC-1.3

**TCs:** TC-1.1a–d, TC-1.2a–d, TC-1.3a–b

**Relevant Tech Design Sections:** §System View (Message Sequencing), §Q3 (Context Construction), §Q8 (Context Indicator Layout), Server Companion §PackageContextService, Server Companion §Context Injection Extension, Client Companion §Extended Context Indicator

**Non-TC Decided Tests:** Package context service with malformed manifest (1 test). Context injection with package + no active document (1 test). Context indicator DOM structure test (1 test). System prompt includes all 7 new method descriptions (1 test).

**Prerequisite:** Chunk 0

**Test Count:** 10 TC-mapped + 6 non-TC = 16 tests
**Running Total:** 26 tests

### Chunk 2: Multi-File Reading

**Scope:** `getFileContent(path)` script method. Path traversal prevention. Per-response read budget tracker. File truncation (reuses Epic 12 pattern). Binary file detection. Works in both package and folder modes.

**ACs:** AC-2.1, AC-2.2, AC-2.3, AC-2.4

**TCs:** TC-2.1a–d, TC-2.2a–d, TC-2.3a–c, TC-2.4a–b

**Relevant Tech Design Sections:** §Q1 (Read Budget), §Q2 (Artifact Detection — for file path patterns), Server Companion §Script Context Extensions — getFileContent, Server Companion §Read Budget Tracker

**Non-TC Decided Tests:** Read budget tracker unit test (reset between messages, 1 test). Path with symlink that escapes root (1 test). Empty file returns empty string (1 test). File with mixed encoding (1 test).

**Prerequisite:** Chunk 1

**Test Count:** 13 TC-mapped + 5 non-TC = 18 tests
**Running Total:** 44 tests

### Chunk 3: File Creation and Non-Active Editing

**Scope:** `addFile(path, content)` and `editFile(path, content)` script methods. Intermediate directory creation. Path traversal prevention. `chat:file-created` notifications. Dirty/clean tab interaction (existing mechanism). Backward compatibility with `applyEditToActiveDocument`.

**ACs:** AC-4.1, AC-4.2, AC-4.3

**TCs:** TC-4.1a–e, TC-4.2a–f, TC-4.3a

**Relevant Tech Design Sections:** Server Companion §Script Context Extensions — addFile, editFile. §Q6 (Stale Detection).

**Non-TC Decided Tests:** addFile with empty content (1 test). editFile on manifest file triggers both file-created and package-changed (1 test). Concurrent write safety — atomic write pattern (1 test).

**Prerequisite:** Chunk 2

**Test Count:** 12 TC-mapped + 4 non-TC = 16 tests
**Running Total:** 60 tests

### Chunk 4: Package Operations Through Chat

**Scope:** `getPackageManifest()`, `updateManifest(content)`, `createPackage(options?)`, `exportPackage(options)` script methods. `chat:package-changed` message sending and client handling. Sidebar re-sync on manifest-updated and created. Stale indicator updates for extracted packages. Directory-mode package transition after `createPackage()`. Identity preservation.

**ACs:** AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5, AC-3.6

**TCs:** TC-3.1a–d, TC-3.2a–e, TC-3.3a–b, TC-3.4a–c, TC-3.5a–c, TC-3.6a–d

**Relevant Tech Design Sections:** §Q4 (Manifest Atomicity), §Q5 (Package Creation), §Q6 (Stale Detection), §Q7 (Export Path), Server Companion §Script Context Extensions — package methods, Client Companion §Package-Changed Handling

**Non-TC Decided Tests:** Client re-fetches manifest after package-changed (1 test). Export to existing file overwrites (1 test). createPackage in folder updates session state (1 test). Concurrent manifest updates (1 test).

**Prerequisite:** Chunk 3

**Test Count:** 21 TC-mapped + 5 non-TC = 26 tests
**Running Total:** 86 tests

### Chunk 5: Spec Conventions + Phase Awareness

**Scope:** Spec metadata extraction from manifest frontmatter via js-yaml. Phase detection from navigation entries using PhaseDetector. `spec` field in provider context. Declared vs detected phase. Phase guidance is informational — no operation gating.

**ACs:** AC-5.1, AC-5.2, AC-5.3, AC-6.1, AC-6.2, AC-6.3

**TCs:** TC-5.1a–c, TC-5.2a–b, TC-5.3a–b, TC-6.1a–e, TC-6.2a–c, TC-6.3a–b

**Relevant Tech Design Sections:** §Q2 (Artifact Detection), §Q9 (Phase Caching), Server Companion §Phase Detection, Server Companion §Spec Metadata Extraction, Server Companion §Context Injection Extension (spec-aware system prompt)

**Non-TC Decided Tests:** Phase detector with duplicate artifact types (1 test). Spec metadata extraction with malformed YAML (1 test). js-yaml integration test (1 test). (Note: empty-navigation phase detector test is in Chunk 0.)

**Prerequisite:** Chunk 1

**Test Count:** 17 TC-mapped + 3 non-TC = 20 tests
**Running Total:** 106 tests

### Chunk 6: Folder-Mode Chat + Error Handling

**Scope:** Package operations in folder mode (createPackage, exportPackage). File operations confirmed in folder mode. Error handling for all script methods — descriptive errors returned to CLI. Context injection error handling for package failures. Feature isolation verification.

**ACs:** AC-7.1, AC-7.2, AC-7.3, AC-8.1, AC-8.2, AC-8.3

**TCs:** TC-7.1a–e, TC-7.2a–b, TC-7.3a–c, TC-8.1a–c, TC-8.2a–b, TC-8.3a–b

**Relevant Tech Design Sections:** Server Companion §Script Context Extensions (folder-mode behavior for each method), Server Companion §Error Handling, Client Companion §Package-Changed Handling (folder-to-package transition)

**Non-TC Decided Tests:** All script methods return descriptive errors (integration test, 1 test). Export folder with mixed file types (1 test). ReadBudgetTracker created fresh per chat:send (1 test). Context degradation does not prevent message dispatch (1 test). Error codes match ChatErrorCodeSchema values (1 test).

**Prerequisite:** Chunks 4 and 5

**Test Count:** 17 TC-mapped + 5 non-TC = 22 tests
**Running Total:** 128 tests

---

## Deferred Items

| Item | Related AC | Reason Deferred | Future Work |
|------|-----------|-----------------|-------------|
| Workspace switching through chat (open .mpk, change root) | Out of Scope | Mid-response root switching introduces complexity; Epic 14 autonomy patterns are the right context | Epic 14 or post-v2 |
| Pipeline state persistence beyond conversation history | Out of Scope | Basic phase detection is sufficient for v2 conversational guidance | Post-v2 — formal state model |
| Content-based artifact detection (scan file content, not just filenames) | AC-6.1 | Filename patterns are sufficient and fast; content scanning adds latency and complexity | Post-v2 if filename patterns prove unreliable |
| Multi-package operations | Out of Scope | Operations on the current workspace only | Post-v2 |
| `isolated-vm` upgrade for script execution | AC-7.2 (Epic 10) | `vm.runInNewContext` acceptable for single-user threat model | Before distribution |
| Search across package files | Out of Scope | Not in v2 scope | Future feature |
| Structured patch edits for non-active files | AC-4.2 | Full content replacement is sufficient; same rationale as Epic 12 Q9 | Post-v2 |

---

## Open Questions

| # | Question | Owner | Blocks | Resolution |
|---|----------|-------|--------|------------|
| — | No open questions remain | — | — | All 10 tech design questions resolved |

---

## Related Documentation

- **Epic:** [epic.md](epic.md)
- **Server design:** [tech-design-server.md](tech-design-server.md)
- **Client design:** [tech-design-client.md](tech-design-client.md)
- **Test plan:** [test-plan.md](test-plan.md)
- **Epic 12 tech design:** [../12--document-awareness-and-editing/tech-design.md](../12--document-awareness-and-editing/tech-design.md)
- **Epic 10 tech design:** [../10--chat-plumbing/tech-design.md](../10--chat-plumbing/tech-design.md)
- **Epic 9 tech design:** [../09--package-viewer-integration/tech-design.md](../09--package-viewer-integration/tech-design.md)
- **v2 Technical Architecture:** [../../technical-architecture.md](../../technical-architecture.md)
- **PRD:** [../../prd.md](../../prd.md)
