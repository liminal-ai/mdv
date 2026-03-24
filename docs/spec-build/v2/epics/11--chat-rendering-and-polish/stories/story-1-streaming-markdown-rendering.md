# Story 1: Streaming Markdown Rendering

### Summary
<!-- Jira: Summary field -->

Agent responses render as formatted markdown with syntax highlighting through a debounced client-side pipeline. Only the streaming message is re-rendered. Final render fires on `chat:done`.

### Description
<!-- Jira: Description field -->

**User Profile:**
Primary User: The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward.
Context: Using the chat panel daily for conversational agent interaction. The plain text streaming from Epic 10 works but feels raw — responses are walls of unformatted text. The developer wants formatted output: headings, code blocks with syntax highlighting, lists, tables, and inline formatting, all rendered progressively as the stream arrives.
Mental Model: "I send a message, the response streams in as formatted markdown — just like reading a rendered document, except it builds up in real time"
Key Constraint: Vanilla JS frontend — no component framework. The document viewer's markdown-it + shiki pipeline is server-side (Epic 2 deviated to server rendering). Epic 11 must set up a new client-side instance of the same pipeline for chat, producing output with visual parity to the document viewer.

**Objective:**
Integrate the client-side markdown-it + shiki rendering pipeline into the chat panel. Agent responses render as formatted markdown instead of plain text. The debounced re-render pipeline processes accumulated tokens at a throttled interval. Only the currently streaming message is re-rendered — completed messages retain their cached HTML. The final render fires immediately on `chat:done`.

**Scope:**

In scope:
- `initChatRendererBase()` — synchronous markdown-it pipeline initialization (code blocks render as monospace during shiki loading)
- `initChatRendererShiki()` — async shiki WASM loading with dual-theme CSS variable mode
- `renderChatMarkdown(text)` — pre-process partial fences, render through markdown-it + shiki, sanitize via DOMPurify
- Debounced render cycle integration in `chat-panel.ts` — throttle schedules renders, flush on `chat:done`
- Incremental DOM updates — only the streaming message's `.markdown-body` innerHTML is replaced
- `completeResponse()` signature updated to accept and cache `renderedHtml`
- Link click handling: delegated listener for http/https (window.open), mailto (default behavior), #anchor (scroll within message), relative paths (neutralized)
- Agent message DOM structure with `.markdown-body` wrapper
- All standard markdown rendering: headings h1-h6, bold, italic, strikethrough, inline code, ordered/unordered lists with nesting, tables with headers and alignment, blockquotes, horizontal rules, task lists, external links, anchor links, mailto links

Out of scope:
- Partial construct handling beyond the pre-processor (Story 2)
- Mermaid rendering (Story 2)
- Mermaid theme re-rendering — TC-1.3b (Story 2)
- Scroll behavior refinement (Story 3)
- Keyboard shortcuts (Story 3)
- UI polish and panel toggle (Story 4)

**Dependencies:** Story 0 complete.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1:** Agent responses render as formatted markdown instead of plain text

- **TC-1.1a: Headings render with correct hierarchy**
  - Given: An agent response contains markdown headings (h1 through h6)
  - When: The response completes rendering
  - Then: Each heading renders at the correct visual level, with sizing and weight consistent with the same heading levels in the document viewer
- **TC-1.1b: Inline formatting renders correctly**
  - Given: An agent response contains bold, italic, strikethrough, and inline code
  - When: The response completes rendering
  - Then: Each formatting type renders with the correct visual treatment
- **TC-1.1c: Lists render with proper nesting**
  - Given: An agent response contains ordered and unordered lists, including nested items
  - When: The response completes rendering
  - Then: Lists display with correct markers (bullets, numbers) and visual indentation per nesting level
- **TC-1.1d: Tables render with headers and alignment**
  - Given: An agent response contains a markdown table
  - When: The response completes rendering
  - Then: The table renders with a visually distinct header row and correct column alignment
- **TC-1.1e: Wide tables in chat scroll horizontally**
  - Given: An agent response contains a table wider than the chat panel
  - When: The response completes rendering
  - Then: The table scrolls horizontally within the message; it does not overflow or break the chat panel layout
- **TC-1.1f: Blockquotes render with visual distinction**
  - Given: An agent response contains blockquotes
  - When: The response completes rendering
  - Then: Blockquotes are visually distinct (left border, indentation, or different background)
- **TC-1.1g: External links render and are clickable**
  - Given: An agent response contains http/https links
  - When: The response completes rendering
  - Then: Links are visually identifiable and clicking one opens it in the system browser
- **TC-1.1h: Anchor links scroll within the message**
  - Given: An agent response contains an anchor link (e.g., `[see above](#heading-text)`) and a heading with that anchor
  - When: The developer clicks the anchor link
  - Then: The chat messages area scrolls to the referenced heading within that message
- **TC-1.1i: Mailto links open the system mail client**
  - Given: An agent response contains a `mailto:` link
  - When: The developer clicks the link
  - Then: The system's default mail client is invoked
- **TC-1.1j: Horizontal rules render**
  - Given: An agent response contains horizontal rules
  - When: The response completes rendering
  - Then: A visible divider appears
- **TC-1.1k: Task lists render with checkboxes**
  - Given: An agent response contains task list items (`- [ ]` and `- [x]`)
  - When: The response completes rendering
  - Then: Items display with visible checkbox indicators (read-only)

**AC-1.2:** Code blocks render with syntax highlighting

- **TC-1.2a: Fenced code block with language hint**
  - Given: An agent response contains a fenced code block with a language specifier (e.g., ` ```typescript `)
  - When: The response completes rendering
  - Then: The code block renders with syntax highlighting for the specified language, using the same shiki theme as document rendering
- **TC-1.2b: Fenced code block without language hint**
  - Given: An agent response contains a fenced code block with no language specifier
  - When: The response completes rendering
  - Then: The code block renders in monospace with a distinct background, without syntax highlighting
- **TC-1.2c: Inline code renders distinctly**
  - Given: An agent response contains inline code spans
  - When: The response completes rendering
  - Then: Inline code renders with a distinct monospace font and background
- **TC-1.2d: Long lines in code blocks scroll horizontally**
  - Given: An agent response contains a code block with lines exceeding the message width
  - When: The response completes rendering
  - Then: The code block scrolls horizontally; it does not overflow the message or chat panel

**AC-1.3 (TC-1.3a only):** Rendered markdown in chat is themed consistently with document rendering

- **TC-1.3a: Chat markdown uses current theme**
  - Given: The app is using a dark theme
  - When: An agent response with markdown renders in the chat
  - Then: Headings, code blocks, tables, links, and blockquotes use the dark theme's colors and styles, consistent with how documents render in the content area

*Note: TC-1.3b (theme switch updates Mermaid diagrams) is covered in Story 2, which delivers Mermaid support.*

**AC-1.4:** Rendering is performed at a debounced interval, not on every token

- **TC-1.4a: Tokens between render cycles are batched**
  - Given: Multiple `chat:token` messages arrive within the debounce interval
  - When: The debounce timer fires
  - Then: A single render pass processes all accumulated tokens; there is no render pass per token
- **TC-1.4b: Render occurs promptly after tokens arrive**
  - Given: A `chat:token` message arrives and no render is pending
  - When: The debounce interval elapses
  - Then: A render pass occurs within one debounce interval of the token arrival
- **TC-1.4c: Final render on response completion**
  - Given: A `chat:done` message arrives
  - When: There are unrendered tokens in the buffer
  - Then: A final render pass processes all remaining tokens immediately, regardless of the debounce timer
- **TC-1.4d: Final render on cancelled response**
  - Given: A response is streaming and the developer cancels it
  - When: `chat:done` with `cancelled: true` is received
  - Then: A final render pass executes on the partial accumulated text, ensuring the partial response is fully rendered as markdown (not left in a mid-debounce state)
- **TC-1.4e: Debounce interval is configurable**
  - Given: The developer (or a future M3 tuning session) wants to adjust the render interval
  - When: The debounce interval value is changed
  - Then: The streaming renderer uses the new interval without other code changes. The interval is a named constant or configuration value, not embedded in rendering logic.

**AC-1.5:** Only the currently streaming message is re-rendered, not the full conversation

- **TC-1.5a: Completed messages are not re-rendered**
  - Given: The conversation contains 5 completed agent messages and 1 streaming message
  - When: A debounce render cycle fires
  - Then: Only the streaming message's DOM content is updated; the 5 completed messages are untouched
- **TC-1.5b: Performance with long conversations**
  - Given: A conversation with 50+ messages
  - When: A new response is streaming
  - Then: Rendering performance is not degraded by the number of prior messages — the render cost is proportional to the current response length, not the conversation length

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Two-phase pipeline initialization:**

1. `initChatRendererBase()` — synchronous. Creates markdown-it instance with `{ html: true, linkify: true }`, adds `markdown-it-task-lists` and `markdown-it-anchor` with `github-slugger`. Code blocks render as monospace `<pre><code>` (no shiki). Called immediately on chat panel mount.

2. `initChatRendererShiki()` — async (~200ms). Loads shiki WASM, creates highlighter with dual-theme CSS variable mode (`defaultColor: false`, themes `github-light` + `github-dark`), 17 baseline languages, language aliases (`js→javascript`, `ts→typescript`, `py→python`, `sh→bash`, `yml→yaml`). Installs `fromHighlighter` plugin. Wraps `md.options.highlight` for Mermaid exclusion (returns `''` for `mermaid` language). Wraps `md.renderer.rules.fence` with shiki error fallback — captures pre-shiki hooks BEFORE plugin installation, restores on error.

**`chat:done` sequencing (critical ordering):**

The panel intercepts `chat:done` BEFORE updating state. This ordering is essential because the render function targets the "streaming" message — if state flips `streaming: false` first, the final render loses its target.

1. `chat:done` arrives from `ChatWsClient`
2. `chat-panel.ts` intercepts directly
3. Call `throttle.flush()` — immediate final render
4. Capture rendered HTML
5. THEN call `chatState.completeResponse(messageId, renderedHtml, cancelled?)` — sets `streaming: false`, caches HTML

**Link click handling:**

Delegated click listener on `.chat-messages` matching the existing `link-handler.ts` pattern:
- `http://`/`https://` → `preventDefault()`, `window.open(url, '_blank', 'noopener')`
- `mailto:` → NOT intercepted (default behavior opens mail client)
- `#anchor` → `preventDefault()`, scroll within containing message element
- Relative paths/all other → `preventDefault()`, no navigation (neutralized for safety; Epic 12 may add document-aware navigation)

**Agent message DOM structure:**

```html
<div class="chat-message agent">
  <div class="markdown-body">
    <!-- rendered HTML with .shiki spans -->
  </div>
</div>
```

The `.markdown-body` class scopes all existing markdown rendering styles (headings, tables, code blocks, blockquotes, lists) to the rendered content, providing visual parity with document rendering.

**Shiki theme configuration:**

Uses dual-theme CSS variable mode (`defaultColor: false`). Token spans get `--shiki-light` and `--shiki-dark` CSS properties. Existing `markdown-body.css` rules activate the correct variable set based on `data-theme` attribute — no new CSS needed.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `npm run verify` passes
- [ ] `npm run build` passes (new client-side imports resolve in esbuild bundle)
- [ ] Agent responses render as formatted markdown (headings, lists, tables, code blocks, links, blockquotes, inline formatting)
- [ ] Code blocks with language hints render with syntax highlighting via shiki
- [ ] Code blocks without language hints render as monospace without highlighting
- [ ] Rendering is throttled — no render per token, batched at debounce interval
- [ ] Final render fires immediately on `chat:done` (including cancelled responses)
- [ ] Only the streaming message is re-rendered; completed messages retain cached HTML
- [ ] Link clicks dispatch correctly: external → system browser, mailto → default, anchor → scroll, relative → neutralized
- [ ] Rendered markdown uses current theme via CSS custom properties
- [ ] `DEBOUNCE_INTERVAL_MS` is a named constant (150ms default)

**Estimated test count:** 28 tests (23 TC-mapped + 5 non-TC)
