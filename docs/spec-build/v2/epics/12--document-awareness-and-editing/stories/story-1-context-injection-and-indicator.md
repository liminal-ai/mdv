# Story 1: Context Injection and Indicator

---

### Summary
<!-- Jira: Summary field -->

The Steward receives the active document's content with each message, the chat panel shows a context indicator, and large documents are truncated to fit within the token budget.

---

### Description
<!-- Jira: Description field -->

**User Profile:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward. Reading and working on markdown documents in the viewer while using the chat panel to ask questions about the content, request edits, and iterate on specs. The developer switches between documents and expects the Steward to track what's currently open.

**Objective:** When the developer sends a message, the server reads the active document from disk, applies a token budget, and includes the content in the prompt sent to the CLI. The chat panel displays a context indicator showing which document the Steward sees, updating on tab switch and showing truncation status when applicable. After this story, "summarize this" responds about the active document.

**Scope:**

In scope:
- Context injection service: read document from disk, apply token budget, construct CLI prompt with `<active-document>` XML block and system prompt via `--system-prompt`
- Token budget management: 100K character limit (~25K tokens), end truncation at line boundary, truncation notice in context
- `chat:context` message: server sends truncation truth to client after processing `chat:send`
- Context indicator UI: shows active document filename, updates on tab switch, shows truncation status, hidden when no document open, long paths truncated with tooltip
- Extended `chat:send` handler: reads context field, calls context injection service, passes result to provider manager
- Extended provider manager `send()`: accepts optional `systemPrompt` parameter for `--system-prompt` flag
- Chat state extensions: `activeDocumentPath` tracking, `getSendContext()` for including context in `chat:send`
- Client `sendMessage()` includes context field with `activeDocumentPath`

Out of scope:
- Document editing (Story 2)
- Conversation persistence (Story 3)
- Local file links (Story 4)
- CLI session ID persistence (Story 3) — session ID flows through provider manager's existing internal capture but is not persisted to disk in this story

**Dependencies:**
- Story 0 complete (schemas, types)
- Epics 10 and 11 complete

---

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1:** The active document's content is included in the context sent to the CLI provider when a message is sent

- **TC-1.1a: Document context attached to message**
  - Given: A markdown document is open in the active tab
  - When: The developer sends a message
  - Then: The `chat:send` message includes the active document's path in its context field, and the server reads the document's content and includes it in the prompt to the CLI

- **TC-1.1b: Context contains correct document content**
  - Given: A markdown document with known content is open in the active tab
  - When: The developer sends a message
  - Then: The context passed to the CLI provider includes the file's on-disk content (verifiable by inspecting the provider's received context, not by asserting model response quality)

- **TC-1.1c: No document open**
  - Given: No tabs are open (empty content area)
  - When: The developer sends a message
  - Then: The message is sent without document context; the `context.activeDocumentPath` is `null`

- **TC-1.1d: Document in Edit mode**
  - Given: The active document is in Edit mode with unsaved changes
  - When: The developer sends a message
  - Then: The context includes the on-disk version of the document (last saved), not the unsaved editor content

**AC-1.2:** The chat panel displays a context indicator showing the active document

- **TC-1.2a: Indicator shows active document**
  - Given: A document is open in the active tab
  - When: The developer views the chat panel
  - Then: A context indicator is visible in the chat panel showing the filename (or relative path) of the active document. Exact placement within the panel is a tech design decision.

- **TC-1.2b: Indicator hidden when no document is open**
  - Given: No tabs are open
  - When: The developer views the chat panel
  - Then: The context indicator is hidden

- **TC-1.2c: Indicator updates on tab switch**
  - Given: Two documents are open in tabs
  - When: The developer switches from tab A to tab B
  - Then: The context indicator updates to show tab B's document

- **TC-1.2d: Indicator truncates long paths**
  - Given: The active document has a long path relative to the root
  - When: The developer views the context indicator
  - Then: The path is truncated with ellipsis; the full relative path is available in a tooltip

**AC-1.4:** Large documents are truncated to fit within the token budget

- **TC-1.4a: Document within budget included fully**
  - Given: The active document is 500 lines (well within the token budget)
  - When: The developer sends a message
  - Then: The full document content is included in the context

- **TC-1.4b: Large document truncated with notification**
  - Given: The active document exceeds the token budget (e.g., 15,000 lines)
  - When: The developer sends a message
  - Then: The document content is truncated, and the context sent to the CLI includes a note that the document was truncated (e.g., "Document truncated: showing first N lines of M total")

- **TC-1.4c: Context indicator shows truncation status**
  - Given: The active document was truncated due to token budget
  - When: The developer views the context indicator
  - Then: The indicator shows a visual cue that the document was truncated (e.g., "file.md (truncated)")

---

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

#### Context Injection Service

New file: `app/src/server/services/context-injection.ts`

```typescript
export interface InjectedContext {
  systemPrompt: string;
  userMessage: string;
  truncated: boolean;
  totalLines?: number;
  relativePath?: string;
}

export async function buildInjectedContext(
  userText: string,
  activeDocumentPath: string | null,
  workspaceRoot: string | null,
): Promise<InjectedContext>;

export class ContextReadError extends Error {
  constructor(public readonly path: string);
}
```

- `TOKEN_BUDGET_CHARS = 100_000` (~25K tokens at 4 chars/token)
- End truncation at line boundary via `content.lastIndexOf('\n', budget)`
- Truncation notice: `[Document truncated: showing first N of M total lines]`
- Document content wrapped in `<active-document path="..." truncated="..." total-lines="...">` XML block
- System prompt via `buildSystemPrompt()` — static string with Steward capability instructions

#### Extended Provider Manager

```typescript
// Modified send() signature
send(messageId: string, text: string, systemPrompt?: string): void;
```

When `systemPrompt` is provided, adds `--system-prompt` flag to CLI args.

#### Context Indicator

New file: `app/src/client/steward/context-indicator.ts`

```typescript
export function mountContextIndicator(
  chatPanel: HTMLElement,
  insertBefore: HTMLElement,
): ContextIndicatorController;

interface ContextIndicatorController {
  update(relativePath: string | null, truncated: boolean): void;
  destroy(): void;
}
```

DOM structure: `.chat-context-indicator` containing icon, path (CSS ellipsis truncation with `title` tooltip), and "(truncated)" label. Placed between `.chat-header` and `.chat-status`.

Two update sources:
1. Tab switch (immediate) — shows filename, truncation unknown
2. `chat:context` message (server truth) — confirms truncation status

#### Extended Chat State

```typescript
// Extensions to ChatStateStore
setActiveDocumentPath(path: string | null): void;
getActiveDocumentPath(): string | null;
getSendContext(): { activeDocumentPath: string | null };
```

#### WebSocket Route Extension

The `chat:send` handler reads `context.activeDocumentPath`, calls `buildInjectedContext()`, sends `chat:context` to client with truncation status, then passes the injected prompt to the provider manager.

*See the tech design document for full architecture, implementation targets, and test mapping.*

---

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Context injection service implemented with token budget and truncation
- [ ] Context indicator component renders in chat panel
- [ ] Indicator updates on tab switch and from `chat:context` messages
- [ ] `chat:send` handler injects document context into CLI prompt
- [ ] Provider manager accepts `systemPrompt` parameter
- [ ] Client sends `activeDocumentPath` in `chat:send` context
- [ ] `npm run build && npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes — 16 tests (10 context injection + 6 context indicator)
