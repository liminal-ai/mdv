# Epic 11: Chat Rendering and Polish

This epic defines the complete requirements for upgrading the chat panel from
plain text streaming to streaming markdown rendering, with partial construct
handling, debounce tuning, scroll behavior refinement, UI polish, and keyboard
shortcuts. It serves as the source of truth for the Tech Lead's design work.

---

## User Profile

**Primary User:** The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward
**Context:** Using the chat panel daily for conversational agent interaction. The plain text streaming from Epic 10 works but feels raw — responses are walls of unformatted text. The developer wants formatted output: headings, code blocks with syntax highlighting, lists, tables, and inline formatting, all rendered progressively as the stream arrives.
**Mental Model:** "I send a message, the response streams in as formatted markdown — just like reading a rendered document, except it builds up in real time"
**Key Constraint:** Vanilla JS frontend — no component framework. The document viewer's markdown-it + shiki pipeline is server-side (Epic 2 deviated to server rendering). Epic 11 must set up a new client-side instance of the same pipeline for chat, producing output with visual parity to the document viewer. The rendering must be smooth enough for the M3 pause point — this is the designated iteration point where human judgment tunes the streaming feel.

---

## Feature Overview

After this epic, chat responses render as formatted markdown instead of plain
text. Code blocks appear with syntax highlighting. Headings, lists, tables, and
inline formatting render progressively as tokens arrive. Incomplete constructs
degrade gracefully — half-received code fences show as plain text until the
closing fence arrives, then upgrade to highlighted code. Mermaid blocks render
as diagrams when the code block is complete (closing fence received), not when
the entire response finishes.

The streaming experience is smooth. A debounced re-render pipeline processes
accumulated tokens through a client-side markdown-it + shiki pipeline at a
throttled interval, balancing responsiveness against rendering cost. Auto-scroll
follows the output but respects the user's scroll position.

The chat panel gains keyboard shortcuts (Enter to send, Escape to cancel, a
shortcut to toggle panel visibility), visual polish (typography, spacing,
transitions), and feels like a natural part of the app rather than a bolted-on
widget.

This epic is the M3 milestone — after it ships, the developer spends time
manually tuning the real-time feel before Epic 12 adds intelligence.

---

## Scope

### In Scope

Streaming markdown rendering and chat polish — the visual quality layer on top
of Epic 10's working plumbing:

- Streaming markdown rendering: buffer incoming tokens, re-render the accumulated response through markdown-it + shiki at a debounced interval
- Partial markdown construct handling: incomplete code fences, emphasis, links, and Mermaid blocks degrade gracefully during streaming
- Debounce tuning: configurable re-render interval with a default tuned for smooth streaming, adjustable without code changes at M3
- Scroll behavior refinement: auto-scroll during streaming with scroll-up detection and resume-on-scroll-to-bottom
- Incremental DOM updates: only the currently streaming message is re-rendered, not the full conversation
- Chat panel UI polish: message layout, typography, spacing, resize handle feel, panel open/close transition
- Keyboard shortcuts: Enter to send (Shift+Enter for newline), Escape to cancel response, keyboard shortcut to toggle chat panel visibility
- Theme integration: rendered markdown in chat uses the same theme variables as document rendering
- HTML sanitization of rendered agent responses (consistent with document rendering)
- Panel toggle with open/close controls and persistence

Note: HTML sanitization, panel toggle controls, and panel persistence are derived
scope items not explicitly listed in PRD Feature 11 but consistent with its
"polishes the chat experience" intent and required for a coherent user experience.
Sanitization is a safety requirement inherited from the document rendering
pipeline.

### Out of Scope

- Document awareness or context injection (Epic 12)
- Document editing through chat (Epic 12)
- Conversation persistence across app restarts (Epic 12)
- Package awareness (Epic 13)
- Pipeline orchestration (Epic 14)
- Links in chat responses that navigate to local files within the viewer (Epic 12 — requires document awareness)
- Copy-to-clipboard for code blocks in chat (future polish)
- Message-level actions (retry, edit) (future polish)
- Chat search or conversation filtering (future)
- Image rendering in agent responses (markdown-it will produce `<img>` tags for image references in agent output, but agent responses rarely contain images and there is no image proxy for chat content; deferred)
- Rendering user messages as markdown (user messages display as-is)

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Epic 10 is complete: feature flag, chat panel, WebSocket streaming, CLI provider, plain text rendering all work | Unvalidated | Dev team | Epic 11 sets up a new client-side rendering pipeline; server and provider are unchanged |
| A2 | A new client-side markdown-it + shiki pipeline instance is fast enough for re-rendering at 100-200ms intervals during streaming | Unvalidated | Tech Lead | Typical chat responses are short compared to full documents; validates assumption TA4 from the Technical Architecture. The server-side pipeline in render.service.ts is the reference for configuration parity. |
| A3 | The existing CSS custom properties from the theme system provide sufficient styling hooks for rendered markdown in the chat context | Validated | — | Epic 2 established the pattern; the same rendered HTML structure applies |
| A4 | Mermaid rendering in chat responses is infrequent enough that the async render cost is acceptable | Unvalidated | — | Most chat responses are text, code, and lists; Mermaid is rare |
| A5 | The Enter-to-send / Shift+Enter-for-newline convention is the right default for the primary user | Unvalidated | Product | This is a tuning decision at M3; the shortcut behavior should be easy to swap |

---

## Flows & Requirements

### 1. Streaming Markdown Rendering

Tokens arrive from the WebSocket as `chat:token` messages. Instead of appending
them as plain text (Epic 10), the client buffers them into an accumulated
response string and re-renders the full accumulated text through the markdown-it
+ shiki pipeline at a debounced interval. Only the currently streaming agent
message is re-rendered — completed messages retain their rendered HTML.

1. Developer sends a message
2. First `chat:token` arrives — accumulated text begins building
3. Debounce timer fires — accumulated text is rendered through markdown-it + shiki
4. Rendered HTML replaces the streaming message's content in the DOM
5. More tokens arrive — accumulated text grows
6. Debounce timer fires again — re-render with updated accumulated text
7. `chat:done` arrives — final render pass, message marked as complete
8. Completed message retains its rendered HTML for the lifetime of the conversation

#### Acceptance Criteria

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

**AC-1.3:** Rendered markdown in chat is themed consistently with document rendering

- **TC-1.3a: Chat markdown uses current theme**
  - Given: The app is using a dark theme
  - When: An agent response with markdown renders in the chat
  - Then: Headings, code blocks, tables, links, and blockquotes use the dark theme's colors and styles, consistent with how documents render in the content area
- **TC-1.3b: Theme switch updates chat content**
  - Given: The chat contains rendered agent responses
  - When: The developer switches the app theme
  - Then: Text content, code block backgrounds, and table styling update via CSS custom properties. Mermaid diagrams re-render with the new theme's colors (Mermaid SVGs embed colors and cannot be updated via CSS variables alone).

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

### 2. Partial Markdown Construct Handling

During streaming, the accumulated text may contain incomplete markdown constructs
— a code fence with an opening ` ``` ` but no closing fence, unclosed emphasis,
or a partial Mermaid diagram. These must degrade gracefully rather than producing
broken HTML or visual glitches.

1. Tokens arrive that start a code fence (` ```typescript `)
2. More tokens arrive with code content — but no closing fence yet
3. Debounce fires — the incomplete fence is detected and handled
4. Eventually the closing fence arrives
5. Next debounce fires — the code block renders with syntax highlighting

#### Acceptance Criteria

**AC-2.1:** Incomplete code fences render as plain text until the closing fence arrives

- **TC-2.1a: Open code fence without closing**
  - Given: The accumulated text contains ` ```typescript ` followed by code lines but no closing ` ``` `
  - When: A render cycle fires
  - Then: The content after the opening fence renders as plain monospace text, not as broken HTML with unterminated elements
- **TC-2.1b: Closing fence arrives**
  - Given: The accumulated text previously had an incomplete code fence
  - When: The closing ` ``` ` arrives and the next render cycle fires
  - Then: The code block renders with full syntax highlighting — the transition from plain text to highlighted code block is visually clean
- **TC-2.1c: Multiple code blocks in one response**
  - Given: An agent response contains three code blocks
  - When: The response streams in
  - Then: The first two code blocks render with highlighting as their closing fences arrive; the third renders as plain text while incomplete, then upgrades when its closing fence arrives

**AC-2.2:** Incomplete inline formatting degrades to plain text

- **TC-2.2a: Unclosed bold markers**
  - Given: The accumulated text contains `**bold text` without a closing `**`
  - When: A render cycle fires
  - Then: The asterisks and text render as literal characters (e.g., `**bold text` appears as-is), not as a broken `<strong>` element
- **TC-2.2b: Unclosed italic or strikethrough markers**
  - Given: The accumulated text contains `*italic text` without a closing `*`, or `~~strike` without closing `~~`
  - When: A render cycle fires
  - Then: The markers and text render as literal characters, not as broken `<em>` or `<del>` elements
- **TC-2.2c: Incomplete link**
  - Given: The accumulated text contains `[link text](` without a closing `)`
  - When: A render cycle fires
  - Then: The partial link renders as literal characters, not as a broken clickable element

**AC-2.3:** Mermaid code blocks render as diagrams when the code block is complete, not when the response finishes

- **TC-2.3a: Incomplete Mermaid block shows as code**
  - Given: The accumulated text contains ` ```mermaid ` followed by partial diagram source but no closing fence
  - When: A render cycle fires
  - Then: The partial Mermaid block renders as a code block (monospace text), not as a broken or partially rendered diagram
- **TC-2.3b: Complete Mermaid block renders as diagram mid-stream**
  - Given: An agent response contains a complete Mermaid code block (opening fence, valid diagram source, closing fence) followed by more streaming text
  - When: The closing fence has arrived and a render cycle fires
  - Then: The Mermaid block renders as a diagram even though the response is still streaming. The developer does not need to wait for `chat:done`.
- **TC-2.3c: Mermaid render failure**
  - Given: A complete Mermaid code block contains invalid diagram syntax
  - When: A render cycle fires
  - Then: The block falls back to displaying the raw Mermaid source as a code block, with an error indicator

**AC-2.4:** The transition from partial to complete constructs does not cause jarring reflows

- **TC-2.4a: Code block upgrade is visually clean**
  - Given: An incomplete code fence is currently rendered as plain text
  - When: The closing fence arrives and the next render cycle fires
  - Then: The content area does not visually jump — the scroll position is preserved and the layout adjusts without flashing
- **TC-2.4b: No flash of raw markdown**
  - Given: Tokens are streaming and render cycles are firing
  - When: The developer watches the streaming output
  - Then: At no point do raw markdown characters (asterisks, backticks, brackets) flash visibly before being replaced by rendered output. The content is either rendered markdown or gracefully degraded plain text.

### 3. Scroll Behavior

Auto-scroll follows the streaming output so the developer sees the latest
content. If the developer scrolls up to read earlier content, auto-scroll stops.
When the developer scrolls back to the bottom, auto-scroll resumes.

Epic 10 established the basic auto-scroll mechanism (`userScrolledUp` flag with
a threshold). This epic refines it for markdown rendering, where content height
changes are less predictable (a code block upgrading from plain text to
highlighted code changes height, a Mermaid diagram rendering changes height).

1. Response begins streaming — auto-scroll is active
2. Tokens arrive, render cycles fire, content grows — view scrolls to bottom
3. Developer scrolls up to read an earlier code block
4. Auto-scroll stops — new content streams below but the view stays put
5. Developer scrolls back to the bottom
6. Auto-scroll resumes — view tracks the latest content again

#### Acceptance Criteria

**AC-3.1:** Auto-scroll keeps the latest content visible during streaming

- **TC-3.1a: Scroll follows streaming content**
  - Given: A response is streaming and the developer has not scrolled up
  - When: New content is rendered (debounce cycle fires)
  - Then: The chat messages area scrolls to show the latest rendered content
- **TC-3.1b: Auto-scroll works during height changes**
  - Given: A response is streaming and an incomplete code fence upgrades to a highlighted code block (height change)
  - When: The render cycle completes
  - Then: The view remains scrolled to the bottom, not stuck at the pre-height-change position

**AC-3.2:** Auto-scroll stops when the developer scrolls up

- **TC-3.2a: Manual scroll-up disengages auto-scroll**
  - Given: A response is streaming and auto-scroll is active
  - When: The developer scrolls up in the chat messages area
  - Then: Auto-scroll stops — new content continues to stream below but the view stays at the developer's scroll position
- **TC-3.2b: Content continues streaming while scrolled up**
  - Given: The developer has scrolled up during streaming
  - When: More tokens arrive and render cycles fire
  - Then: The content below the developer's viewport grows; the developer's view position is not disturbed

**AC-3.3:** Auto-scroll resumes when the developer scrolls back to the bottom

- **TC-3.3a: Scroll-to-bottom re-engages auto-scroll**
  - Given: Auto-scroll was disengaged (developer scrolled up)
  - When: The developer scrolls back to the bottom of the chat messages area (within the scroll threshold)
  - Then: Auto-scroll resumes and the view tracks new content as it arrives

**AC-3.4:** Scroll position does not jump when a response completes

- **TC-3.4a: No scroll jump after response completes**
  - Given: A response just completed (chat:done received, final render pass executed)
  - When: The developer is reading the completed response
  - Then: The scroll position does not jump or reset

### 4. Chat Panel UI Polish

The chat panel should feel like a natural part of the app — consistent
typography, spacing, and visual treatment. This flow covers visual refinement
of the elements established in Epic 10.

#### Acceptance Criteria

**AC-4.1:** Agent messages display rendered markdown with typography consistent with the document viewer

- **TC-4.1a: Font and spacing match document rendering**
  - Given: The chat panel displays rendered agent messages
  - When: The developer views the messages
  - Then: Font family, base font size, and line height in agent messages match the document viewer's content area within the same theme
- **TC-4.1b: Message spacing is consistent**
  - Given: The conversation contains multiple user and agent messages
  - When: The developer views the conversation
  - Then: Messages have uniform vertical spacing between them; user and agent messages use different alignment or background color
- **TC-4.1c: Code block styling in chat**
  - Given: A rendered agent message contains code blocks
  - When: The developer views the code block
  - Then: The code block has a distinct background, padding, and border-radius consistent with the document viewer's code block styling

**AC-4.2:** The chat panel has a smooth open/close transition

- **TC-4.2a: Panel open transition**
  - Given: The chat panel is closed (not visible)
  - When: The developer opens the chat panel (via keyboard shortcut or UI control)
  - Then: The panel width animates from 0 to the target width over a CSS transition (not an instant show/hide)
- **TC-4.2b: Panel close transition**
  - Given: The chat panel is open
  - When: The developer closes the chat panel
  - Then: The panel width animates to 0 over a CSS transition
- **TC-4.2c: Workspace area adjusts during transition**
  - Given: The chat panel is transitioning open or closed
  - When: The transition is in progress
  - Then: The workspace area width adjusts proportionally during the transition (driven by the same CSS transition)

**AC-4.3:** The resize handle provides clear visual feedback

- **TC-4.3a: Hover state on resize handle**
  - Given: The developer hovers over the chat panel resize handle
  - When: The cursor enters the resize area
  - Then: The handle changes to the accent color and the cursor changes to `col-resize`
- **TC-4.3b: Active drag state**
  - Given: The developer is dragging the resize handle
  - When: Dragging is in progress
  - Then: The handle remains in the accent color and the panel resizes in real time following the cursor

**AC-4.4:** The chat input area supports multi-line entry

- **TC-4.4a: Input area grows with content**
  - Given: The developer types multiple lines in the chat input
  - When: The text exceeds one line
  - Then: The input area expands vertically to show the content, up to a maximum height
- **TC-4.4b: Input area scrolls at maximum height**
  - Given: The developer types text exceeding the input area's maximum height
  - When: The content overflows
  - Then: The input area scrolls internally; it does not grow beyond the maximum or push the conversation out of view

**AC-4.5:** The chat panel has toggle controls for visibility

- **TC-4.5a: Close control in header**
  - Given: The chat panel is open
  - When: The developer views the chat panel header
  - Then: A close/collapse control is visible; clicking it closes the panel with the same transition as the keyboard toggle
- **TC-4.5b: Reopen control when panel is closed**
  - Given: The chat panel is closed and the feature flag is enabled
  - When: The developer views the workspace area
  - Then: A toggle control is visible at the right edge or in the menu bar to reopen the chat panel
- **TC-4.5c: Panel visibility persists across page loads**
  - Given: The developer has closed the chat panel
  - When: The app is reloaded
  - Then: The chat panel remains closed; reopening restores the previous width

### 5. Keyboard Shortcuts

The chat panel responds to keyboard shortcuts for common actions: sending
messages, cancelling responses, and toggling panel visibility. Epic 10 deferred
all keyboard shortcuts (including Enter-to-send) to this epic.

#### Acceptance Criteria

**AC-5.1:** Enter sends the message; Shift+Enter inserts a newline

- **TC-5.1a: Enter sends**
  - Given: The chat input has focus and contains text
  - When: The developer presses Enter
  - Then: The message is sent (same behavior as clicking the send button) and the input is cleared
- **TC-5.1b: Shift+Enter inserts newline**
  - Given: The chat input has focus
  - When: The developer presses Shift+Enter
  - Then: A newline is inserted in the input text; the message is not sent
- **TC-5.1c: Enter on empty input does nothing**
  - Given: The chat input has focus but is empty (or whitespace only)
  - When: The developer presses Enter
  - Then: No message is sent; no empty message appears in the conversation
- **TC-5.1d: Enter while streaming does not send**
  - Given: A response is currently streaming (input is disabled)
  - When: The developer presses Enter
  - Then: No action occurs

**AC-5.2:** Escape cancels the in-progress response

- **TC-5.2a: Escape cancels streaming**
  - Given: A response is currently streaming
  - When: The developer presses Escape while the chat panel has focus
  - Then: The response is cancelled (same behavior as clicking the cancel button)
- **TC-5.2b: Escape when idle does nothing harmful**
  - Given: No response is streaming
  - When: The developer presses Escape
  - Then: No cancellation action occurs (Escape behavior when idle is a tuning decision at M3)

**AC-5.3:** A keyboard shortcut toggles chat panel visibility

- **TC-5.3a: Toggle shortcut closes panel**
  - Given: The chat panel is open
  - When: The developer presses the chat toggle keyboard shortcut
  - Then: The chat panel closes
- **TC-5.3b: Toggle shortcut opens panel**
  - Given: The chat panel is closed
  - When: The developer presses the chat toggle keyboard shortcut
  - Then: The chat panel opens
- **TC-5.3c: Toggle shortcut works regardless of focus**
  - Given: Focus is in the sidebar, content area, or elsewhere
  - When: The developer presses the chat toggle keyboard shortcut
  - Then: The shortcut works (it is a global shortcut, not scoped to the chat panel)
- **TC-5.3d: Toggle shortcut does not register when feature flag is disabled**
  - Given: The `FEATURE_SPEC_STEWARD` flag is disabled
  - When: The developer presses the chat toggle keyboard shortcut
  - Then: No action occurs — the shortcut handler is not registered

**AC-5.4:** Keyboard shortcuts are discoverable via tooltips

- **TC-5.4a: Send button tooltip shows shortcut**
  - Given: The developer hovers over the send button
  - When: The tooltip appears
  - Then: The Enter shortcut is displayed alongside the action name
- **TC-5.4b: Cancel button tooltip shows Escape**
  - Given: A response is streaming and the developer hovers over the cancel button
  - When: The tooltip appears
  - Then: The Escape shortcut is displayed
- **TC-5.4c: Panel toggle tooltip shows shortcut**
  - Given: The developer hovers over the panel toggle control
  - When: The tooltip appears
  - Then: The panel toggle shortcut is displayed

### 6. Error Handling and Edge Cases

Rendering errors should not crash the chat or break the conversation. Malformed
markdown in agent responses must degrade gracefully. The rendering pipeline must
handle all content the provider might produce.

#### Acceptance Criteria

**AC-6.1:** Malformed markdown in agent responses renders gracefully

- **TC-6.1a: Deeply nested constructs**
  - Given: An agent response contains lists nested 10+ levels deep
  - When: The response renders
  - Then: The content renders without breaking the layout; nesting is visually distinguishable
- **TC-6.1b: Extremely long lines in code blocks**
  - Given: An agent response contains a code block with a line exceeding 500 characters
  - When: The response renders
  - Then: The code block scrolls horizontally; it does not overflow the message or chat panel
- **TC-6.1c: Mixed or broken HTML in response**
  - Given: An agent response contains raw HTML tags
  - When: The response renders
  - Then: Safe HTML renders normally; script tags are stripped (consistent with AC-1.6)

**AC-6.2:** Rendering errors do not crash the chat panel

- **TC-6.2a: Render failure falls back to plain text**
  - Given: The markdown-it rendering pipeline throws an error on a particular response
  - When: The render cycle encounters the error
  - Then: The message falls back to displaying as plain text; the error is logged but not shown to the developer; the chat panel remains functional
- **TC-6.2b: Shiki failure falls back to unstyled code**
  - Given: Shiki fails to highlight a code block (unknown language, internal error)
  - When: The render cycle encounters the failure
  - Then: The code block renders in monospace without highlighting; other content renders normally
- **TC-6.2c: Code blocks render without highlighting while shiki is loading**
  - Given: The chat panel has just mounted and shiki's WASM bundles have not yet loaded
  - When: An agent response containing code blocks is rendered during the loading window
  - Then: Code blocks render in monospace without syntax highlighting; when shiki finishes loading, subsequent render cycles apply highlighting
- **TC-6.2d: Subsequent render cycles retry after transient failure**
  - Given: A render cycle fell back to plain text due to an error
  - When: More tokens arrive and a new render cycle fires
  - Then: The pipeline retries rendering the full accumulated text (the error may have been caused by a transient partial state)

**AC-6.3:** Empty or very short responses render without issues

- **TC-6.3a: Single-word response**
  - Given: The agent responds with a single word
  - When: The response completes rendering
  - Then: The word renders in a properly styled message bubble; no layout collapse
- **TC-6.3b: Response with only a code block**
  - Given: The agent responds with only a fenced code block and no surrounding text
  - When: The response completes rendering
  - Then: The code block renders correctly within the message bubble

**AC-6.4:** Epic 11's new surface area is absent when the feature flag is disabled

- **TC-6.4a: No chat rendering pipeline initialized**
  - Given: The `FEATURE_SPEC_STEWARD` flag is disabled
  - When: The app loads
  - Then: No markdown rendering pipeline for chat is created — no debounce timer, no markdown-it instance configured for chat
- **TC-6.4b: No chat keyboard shortcut handlers registered**
  - Given: The `FEATURE_SPEC_STEWARD` flag is disabled
  - When: The developer presses Enter in any text input, or presses the chat panel toggle shortcut
  - Then: No chat-related shortcut handlers fire; default browser behavior is preserved
- **TC-6.4c: No chat-specific CSS active**
  - Given: The `FEATURE_SPEC_STEWARD` flag is disabled
  - When: The app loads
  - Then: No `chat-enabled` class is applied to the layout grid; no chat-related CSS custom properties are set

---

## Data Contracts

### Existing Contracts (Unchanged)

This epic does not modify any server-side contracts. All WebSocket message
schemas (`ChatTokenMessage`, `ChatDoneMessage`, etc.) and the provider interface
from Epic 10 remain unchanged. The `chat:token` message's `text` field contains
raw text tokens that the client now renders as markdown instead of appending as
plain text.

### Client-Side State Extensions

```typescript
// Extended from Epic 10's ChatMessage
interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'error';
  text: string;                    // Raw accumulated text (markdown source)
  streaming: boolean;
  cancelled?: boolean;
  renderedHtml?: string;           // Cached rendered HTML for completed messages
}
```

**`ChatMessage.id` mapping:** The `id` field holds the same value as the
`messageId` in Epic 10's WebSocket protocol (`ChatSendMessage.messageId`,
`ChatTokenMessage.messageId`, `ChatDoneMessage.messageId`). It is set when the
user sends a message (from the client-generated UUID) and used to correlate
tokens and completion signals with the correct conversation entry.

The `renderedHtml` field caches the markdown-it output for completed agent
messages. While streaming, the raw `text` is re-rendered on each debounce
cycle. Once `streaming` becomes `false`, the rendered HTML is cached and the
raw text is not re-rendered unless a theme change occurs. Theme changes update
most content via CSS custom properties, but Mermaid diagrams require
re-rendering because Mermaid SVGs embed colors directly.

### Streaming Behavior Contract

The rendering pipeline's observable behavior during streaming:

| State | Behavior |
|-------|----------|
| Token arrives | Appended to accumulated `text`. No immediate render. |
| Debounce timer fires | Full `text` rendered through markdown-it + shiki. Rendered HTML replaces streaming message DOM content. |
| `chat:done` arrives | Immediate final render (bypasses debounce). `streaming` set to `false`. `renderedHtml` cached. |
| Theme change (non-streaming) | Most content updates via CSS custom properties. Mermaid diagrams in completed messages re-render with new theme. |
| Render error | Message falls back to plain text display. Next render cycle retries. |

### Link Behavior in Agent Responses

| Protocol | Behavior | TC Reference |
|----------|----------|-------------|
| `http://`, `https://` | Opens in system browser (`target="_blank"`, `rel="noopener noreferrer"`) | TC-1.1g |
| `#anchor` | Scrolls within the containing chat message | TC-1.1h |
| `mailto:` | Opens system mail client | TC-1.1i |
| Relative paths | Rendered as text (no navigation — requires Epic 12 document awareness) | Out of Scope |

### Keyboard Shortcut Map

| Action | Shortcut | Context |
|--------|----------|---------|
| Send message | Enter | Chat input focused |
| Newline in input | Shift+Enter | Chat input focused |
| Cancel response | Escape | Chat panel focused |
| Toggle chat panel | Tech design decision (must not conflict with existing shortcuts) | Global |

---

## Dependencies

Technical dependencies:
- Epic 10 complete: feature flags, CLI provider, WebSocket chat, basic chat panel with plain text streaming, conversation management, script execution
- markdown-it (existing) for markdown-to-HTML conversion
- shiki (existing) for code block syntax highlighting
- Mermaid (existing) for diagram rendering
- Existing CSS custom properties from the theme system

Process dependencies:
- None

---

## Non-Functional Requirements

### Streaming Performance
- First rendered markdown appears within one debounce interval of the first `chat:token` arrival
- Re-rendering through markdown-it + shiki at the debounce interval does not cause frame drops for responses under 5000 tokens
- The debounce interval is a named constant or configuration value, adjustable without modifying rendering logic

### Rendering Quality
- Rendered markdown in chat is visually consistent with rendered markdown in the document content area — same heading styles, code block appearance, table formatting, and link styling
- Syntax highlighting in chat code blocks uses the same shiki theme as document rendering
- Mermaid diagrams render with the same quality as in documents

### Feature Isolation
- All changes remain gated behind the `FEATURE_SPEC_STEWARD` flag
- When the flag is disabled, no rendering pipeline code, keyboard shortcut handlers, or chat-specific CSS class application occurs

### Graceful Degradation
- If markdown-it or shiki throws during rendering, the message falls back to plain text display
- Rendering failures are logged but never shown to the developer as errors in the conversation
- The chat panel remains functional after any rendering error

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. **Debounce strategy**: Should the debounce use a fixed interval timer (render every N ms while tokens are arriving) or a trailing-edge debounce (render N ms after the last token)? A fixed interval provides more predictable output; trailing-edge is simpler but may delay rendering during fast token bursts. What is the right default interval?
2. **Partial code fence detection**: How should the renderer detect incomplete code fences? Options include: pre-processing the accumulated text to count fence markers before passing to markdown-it, using a state machine that tracks open/close fence state, or wrapping markdown-it with a post-processor that detects unterminated `<code>` blocks.
3. **Mermaid rendering in chat**: Should Mermaid blocks in chat responses use the same async rendering infrastructure as document Mermaid (including the Epic 6 SVG cache), or a simpler approach? Chat responses are shorter and Mermaid blocks are rare — the full caching infrastructure may not be needed. How should Mermaid re-rendering on theme switch work? Note: if Mermaid renders mid-stream (per AC-2.3), the resulting SVG may be destroyed by the next innerHTML replacement in a subsequent render cycle. The design must either preserve rendered Mermaid SVGs across render cycles, defer Mermaid rendering to `chat:done`, or accept re-rendering cost.
4. **DOM update strategy for streaming messages**: Should the streaming message's content be updated via `innerHTML` replacement, or should a more surgical DOM update approach be used? `innerHTML` is simpler but causes layout recalculation; surgical updates could preserve scroll position and reduce reflow.
5. **Chat panel toggle mechanism**: What UI element triggers the panel toggle? The sidebar has a toggle in the View menu — the chat panel should follow a consistent pattern. What is the keyboard shortcut (must not conflict with existing shortcuts like Cmd+B)?
6. **HTML sanitization**: Should the chat rendering pipeline use the same sanitization approach as document rendering? Agent responses are generally trusted content (from the user's own CLI), but consistency with document rendering is simpler.
7. **Client-side pipeline configuration**: The server-side pipeline in `render.service.ts` configures markdown-it with specific plugins (task lists, anchors, sanitization) and shiki with dual-theme CSS variable mode. How much of this configuration should the client-side chat pipeline replicate vs. simplify? Chat responses have different characteristics than documents (shorter, no images, no TOC navigation).
8. **Client-side shiki theme configuration**: The server-side pipeline uses shiki's dual-theme CSS variable mode (`defaultColor: false`, light + dark themes) so theme switching works via CSS without re-rendering. Should the client-side chat pipeline use the same dual-theme CSS variable approach? If so, do the existing CSS rules in `markdown-body.css` cover the chat context, or does the chat need its own shiki theme styles?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

**Delivers:** Render configuration types, debounce utility, CSS for rendered
markdown within chat messages, HTML sanitization setup. Extension of
`ChatMessage` with `renderedHtml` field. Test fixtures for streaming markdown
scenarios.

**Prerequisite:** Epic 10 complete

**ACs covered:**
- Infrastructure supporting AC-1.3 (CSS for themed markdown in chat)
- Infrastructure supporting AC-1.4 (debounce configuration)
- AC-1.6 (HTML sanitization)

**Estimated test count:** 8-10 tests

### Story 1: Streaming Markdown Rendering

**Delivers:** Agent responses render as formatted markdown. The debounced
re-render pipeline processes accumulated tokens through markdown-it + shiki.
Incremental DOM updates — only the streaming message is re-rendered. Final
render on `chat:done`.

**Prerequisite:** Story 0

**ACs covered:**
- AC-1.1 (markdown rendering — headings, lists, tables, code, links, blockquotes, inline formatting)
- AC-1.2 (code blocks with syntax highlighting)
- AC-1.3 TC-1.3a (theme integration — CSS variable–based styling; Mermaid theme re-rendering deferred to Story 2)
- AC-1.4 (debounced rendering)
- AC-1.5 (incremental DOM updates)

**Estimated test count:** 22-26 tests

### Story 2: Partial Construct Handling and Mermaid

**Delivers:** Incomplete code fences, inline formatting, and Mermaid blocks
degrade gracefully during streaming. Complete Mermaid blocks render as diagrams
mid-stream. Mermaid diagrams re-render on theme switch. Smooth transitions when
constructs complete.

**Prerequisite:** Story 1

**ACs covered:**
- AC-2.1 (incomplete code fences)
- AC-2.2 (incomplete inline formatting)
- AC-2.3 (Mermaid rendering when complete)
- AC-2.4 (smooth transitions)
- AC-1.3 TC-1.3b (Mermaid theme re-rendering — requires Mermaid support from this story)

**Estimated test count:** 14-17 tests

### Story 3: Scroll Behavior and Keyboard Shortcuts

**Delivers:** Refined auto-scroll that handles markdown content height changes,
respects user scroll position, and resumes on scroll-to-bottom. Enter-to-send,
Escape-to-cancel, global panel toggle shortcut. Shortcut discoverability via
tooltips.

**Prerequisite:** Story 1

**ACs covered:**
- AC-3.1 (auto-scroll during streaming)
- AC-3.2 (scroll-up disengages auto-scroll)
- AC-3.3 (scroll-to-bottom re-engages)
- AC-3.4 (no scroll jump after completion)
- AC-5.1 (Enter to send, Shift+Enter for newline)
- AC-5.2 (Escape to cancel)
- AC-5.3 (toggle shortcut)
- AC-5.4 (shortcut discoverability)

**Estimated test count:** 16-20 tests

### Story 4: UI Polish, Panel Toggle, and Error Handling

**Delivers:** Visual refinement of message layout, panel open/close transition,
resize handle feedback, multi-line input behavior, panel visibility toggle with
persistence, close/reopen controls. Render error fallback. Feature isolation
verification.

**Prerequisite:** Stories 1 and 3

**ACs covered:**
- AC-4.1 (typography and spacing)
- AC-4.2 (open/close transition)
- AC-4.3 (resize handle feedback)
- AC-4.4 (multi-line input)
- AC-4.5 (panel toggle controls and persistence)
- AC-6.1 (malformed markdown)
- AC-6.2 (rendering errors)
- AC-6.3 (empty or short responses)
- AC-6.4 (feature isolation)

**Estimated test count:** 16-20 tests

---

## Amendments

### Amendment 1: Reviewer findings incorporated (Round 1)

**Source:** External review (Codex/gpt-5.4), `verification/codex/epic-review-r1.md`

**Changes:**
- Fixed Key Constraint and assumptions regarding rendering pipeline location (see Amendment 3 for further correction: the document viewer pipeline is server-side, not client-side).
- Fixed AC-2.3 and TC-2.3b: Mermaid renders when the code block is complete (closing fence received), not when the full response finishes. Added TC-2.3b explicitly testing mid-stream diagram rendering.
- Fixed TC-1.3b: Theme switch now acknowledges that Mermaid SVGs embed colors and require re-rendering, not just CSS variable updates.
- Added TC-1.4e (originally TC-1.4d, renumbered after Round 2 insertion): Debounce interval configurability is now a testable requirement, not just an NFR.
- Fixed TC-1.1a: h1-h6 coverage (was h1-h4), consistent with Epic 2.
- Fixed TC-2.2a: Single expected outcome (literal characters), not multiple alternatives.
- Added TC-1.1h (anchor links) and TC-1.1i (mailto links) for link behavior beyond http/https.
- Added TC-5.3d: Feature flag isolation for the new global keyboard shortcut.
- Added AC-6.4: Explicit feature isolation coverage for Epic 11's new surface area.
- Tightened subjective polish TCs (AC-4.1, AC-4.2, AC-4.3) with concrete pass/fail conditions.
- Cleaned data contracts: removed implementation-level callback APIs, added behavioral streaming contract table.
- Resolved keyboard shortcut inconsistency: Enter-to-send is the specified default (not "tech design decision"), with the panel toggle shortcut deferred to tech design.
- Removed code block copy button from scope (was scope drift — not in PRD Feature 11).
- Removed DOMPurify library reference from dependencies (implementation choice belongs in tech design).
- Cleaned story breakdown: Story 0 no longer claims AC coverage that requires streaming integration.

### Amendment 2: Consolidated review findings (Round 2)

**Source:** Consolidated Opus + Codex verification

**Changes applied:**
- M2: Split TC-6.4a into three separate TCs (6.4a rendering pipeline, 6.4b keyboard shortcuts, 6.4c CSS) for independent testability
- M3: Added `ChatMessage.id` ↔ `messageId` mapping note in Data Contracts
- M4: Added TC-1.4d for cancelled response final render (`chat:done` with `cancelled: true`)
- M5: Tightened TC-1.1a — replaced "appropriate sizing" with "sizing and weight consistent with the same heading levels in the document viewer"
- M6: Added image rendering in agent responses to Out of Scope
- m1: Added TC-2.2b for unclosed italic/strikethrough markers; renumbered TC-2.2b→2.2c for incomplete links
- m2: Added Link Behavior table in Data Contracts (protocol → behavior → TC reference)
- m3: Added TC-6.2c for shiki cold-start graceful degradation (code blocks without highlighting during WASM loading)
- m4: Added Tech Design Q8: theme change interaction with shiki inline styles
- m8: Added scope annotations note for derived items (sanitization, panel toggle, persistence)

**Pushed back on:**
- M1: The fix claimed a Mermaid timing deviation from upstream artifacts. Verified against PRD ("Mermaid code blocks render only when complete") and Technical Architecture ("only render once the full code block is received") — the current epic (AC-2.3, TC-2.3b per-block timing) is aligned with both upstream artifacts. No deviation exists. Amendment 1 already resolved the original chat:done timing. Added a note to Tech Design Q3 about SVG churn during innerHTML replacement as the legitimate downstream concern.

**Counts after Round 2:** 27 ACs, 82 TCs (was 27 ACs, 74 TCs before Round 2)

### Amendment 3: Re-verification findings (Round 2 follow-up)

**Source:** Orchestrator re-verification — 1 Major, 2 Minor

**Changes:**
- [Ma1-R2] Fixed Key Constraint, A1, A2, Feature Overview, and Amendment 1 to accurately state that the document viewer's markdown-it + shiki pipeline is **server-side** (Epic 2 deviated to server rendering). Epic 11 sets up a **new client-side instance** of the pipeline for chat, not reusing an existing client-side one. This makes A2 (performance at 100-200ms intervals) a genuine question — the client-side pipeline doesn't exist yet and must be validated. Updated 4 locations.
- [Mi1-R2] Replaced Tech Design Q7: the relative path question was already answered by the Link Behavior table (rendered as text, no navigation). Replaced with a new question about client-side pipeline configuration scope — how much of the server-side render.service.ts configuration should the chat pipeline replicate vs. simplify.
- [Mi2-R2] Reframed Tech Design Q8: the original premise (shiki generates inline styles) was wrong. The server-side pipeline uses shiki's dual-theme CSS variable mode (`defaultColor: false`). Reframed Q8 to ask whether the client-side pipeline should use the same approach and whether existing `markdown-body.css` rules cover the chat context.

---

## Validation Checklist

- [x] User Profile has all four fields + Feature Overview
- [x] Flows cover all paths (happy, alternate, cancel/error)
- [x] Every AC is testable (no vague terms)
- [x] Every AC has at least one TC
- [x] TCs cover happy path, edge cases, and errors
- [x] Data contracts are fully typed
- [x] Scope boundaries are explicit (in/out/assumptions)
- [x] Dependencies documented
- [x] Story breakdown covers all ACs
- [x] Stories sequence logically (foundation → rendering → partial handling → scroll + shortcuts → polish + errors)
- [x] NFRs surfaced (streaming performance, rendering quality, graceful degradation)
- [x] Tech design questions identified for downstream resolution (8 questions)
- [x] Reviewer findings (Rounds 1, 2, and follow-up) incorporated
- [x] Self-review complete
