# Story 0: Foundation (Infrastructure)

### Summary
<!-- Jira: Summary field -->

Render configuration types, debounce utility, CSS for rendered markdown in chat messages, HTML sanitization setup, ChatMessage type extension, partial fence pre-processor, and test fixtures for streaming markdown scenarios.

### Description
<!-- Jira: Description field -->

**User Profile:**
Primary User: The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward.
Context: Using the chat panel daily for conversational agent interaction. The plain text streaming from Epic 10 works but feels raw — responses are walls of unformatted text. The developer wants formatted output: headings, code blocks with syntax highlighting, lists, tables, and inline formatting, all rendered progressively as the stream arrives.
Mental Model: "I send a message, the response streams in as formatted markdown — just like reading a rendered document, except it builds up in real time"
Key Constraint: Vanilla JS frontend — no component framework. The document viewer's markdown-it + shiki pipeline is server-side (Epic 2 deviated to server rendering). Epic 11 must set up a new client-side instance of the same pipeline for chat, producing output with visual parity to the document viewer.

**Objective:**
Establish the shared infrastructure that all subsequent stories depend on: the `ChatMessage.renderedHtml` type extension, debounce/throttle utility, partial fence pre-processor, HTML sanitization via DOMPurify, CSS for rendered markdown within chat messages, and test fixtures for streaming markdown scenarios. No functional rendering integration — that is Story 1.

**Scope:**

In scope:
- `ChatMessage` type extension with `renderedHtml?: string` field in `chat-state.ts`
- `createRenderThrottle()` utility, `DEBOUNCE_INTERVAL_MS` constant, `preprocessPartialFences()`, `escapeHtml()` in `chat-renderer.ts`
- Module skeletons for `chat-mermaid.ts` and `chat-shortcuts.ts`
- CSS additions in `chat.css`: `.markdown-body` scoping inside agent messages, table/code horizontal overflow, panel transition classes, toggle button styles, multi-line input growth, close button
- DOMPurify sanitization integration tests
- Test fixtures for streaming markdown scenarios in `app/tests/fixtures/chat-rendering.ts`

Out of scope:
- Rendering pipeline initialization (Story 1)
- Streaming integration (Story 1)
- Any feature implementation (Stories 1–4)

**Dependencies:** Epic 10 complete.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.6:** Agent response content is sanitized to prevent script execution

- **TC-1.6a: Script tags are stripped**
  - Given: An agent response contains `<script>` tags
  - When: The response is rendered
  - Then: Script tags are removed and do not execute
- **TC-1.6b: Event handler attributes are removed**
  - Given: An agent response contains HTML elements with `onclick` or other event handler attributes
  - When: The response is rendered
  - Then: Event handler attributes are stripped
- **TC-1.6c: Safe HTML elements are preserved**
  - Given: An agent response contains `<details>`, `<summary>`, `<kbd>`, `<br>` tags
  - When: The response is rendered
  - Then: These elements render as expected (consistent with document rendering sanitization)

*Infrastructure supporting AC-1.3 (CSS for themed markdown in chat) and AC-1.4 (debounce configuration) is delivered here. The functional ACs themselves are covered in Stories 1 and 2.*

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**ChatMessage type extension (chat-state.ts):**

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'error';
  text: string;                    // Raw accumulated text (markdown source)
  streaming: boolean;
  cancelled?: boolean;
  renderedHtml?: string;           // Cached rendered HTML for completed agent messages
}
```

**Render throttle utility (chat-renderer.ts):**

The throttle uses a leading+trailing edge strategy with a fixed 150ms interval (`DEBOUNCE_INTERVAL_MS`). Leading edge fires immediately on the first token. During steady streaming, renders execute at most every 150ms. After tokens stop, trailing edge fires one final render. `chat:done` bypasses the throttle via `flush()`.

```typescript
export const DEBOUNCE_INTERVAL_MS = 150;

function createRenderThrottle(renderFn: () => void, intervalMs: number) {
  // schedule(): leading+trailing edge throttle
  // flush(): immediate render, cancel pending timer
  // cancel(): cancel pending timer without rendering
}
```

**Partial fence pre-processor (chat-renderer.ts):**

`preprocessPartialFences(text)` scans for fence markers (lines starting with 3+ backticks), counts parity. If odd (unclosed fence): strips the language tag from the last opening fence and appends a sentinel closing fence. This causes markdown-it to render partial code as plain monospace `<pre><code>` rather than eating all subsequent content.

**DOMPurify sanitization (chat-renderer.ts):**

Uses `isomorphic-dompurify` (already installed), which delegates to browser-native DOMPurify in the esbuild browser bundle. Default configuration — no custom allowlist needed.

```typescript
import DOMPurify from 'isomorphic-dompurify';
function sanitize(html: string): string {
  return DOMPurify.sanitize(html);
}
```

**CSS additions (chat.css):**

- `.chat-message.agent .markdown-body` — reset padding/background for chat bubble context
- `.chat-message.agent .markdown-body table` — `display: block; overflow-x: auto; max-width: 100%`
- `.chat-message.agent .markdown-body pre` — `overflow-x: auto; max-width: 100%`
- `#main.chat-enabled` — `transition: grid-template-columns 0.2s ease-out`
- `#main.chat-enabled.chat-hidden` — collapsed grid column for chat panel
- `.chat-toggle-btn` — positioned fixed at right edge, hidden by default
- `.chat-input` — `field-sizing: content` with min/max height
- `.chat-close-btn` — transparent background, hover color change

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `npm run typecheck` passes with all new types and module skeletons
- [ ] `ChatMessage` type includes `renderedHtml?: string` field
- [ ] `createRenderThrottle` utility implemented and tested
- [ ] `preprocessPartialFences` implemented and tested (edge cases: nested fences, no fences, empty text)
- [ ] DOMPurify sanitization tests pass (script stripping, event handler removal, safe element preservation)
- [ ] CSS for `.markdown-body` scoping, overflow, transitions loads without errors
- [ ] Test fixtures created in `app/tests/fixtures/chat-rendering.ts`
- [ ] Module skeletons for `chat-mermaid.ts` and `chat-shortcuts.ts` compile

**Estimated test count:** 10 tests (3 TC-mapped + 7 non-TC infrastructure)
