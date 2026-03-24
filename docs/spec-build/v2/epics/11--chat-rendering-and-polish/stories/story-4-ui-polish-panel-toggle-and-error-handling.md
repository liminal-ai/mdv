# Story 4: UI Polish, Panel Toggle, and Error Handling

### Summary
<!-- Jira: Summary field -->

Visual refinement of message layout, panel open/close CSS transition, resize handle feedback, multi-line input behavior, panel toggle controls with persistence, close/reopen buttons, View menu integration. Render error fallback. Malformed markdown resilience. Feature isolation verification.

### Description
<!-- Jira: Description field -->

**User Profile:**
Primary User: The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward.
Context: Using the chat panel daily for conversational agent interaction. The plain text streaming from Epic 10 works but feels raw — responses are walls of unformatted text. The developer wants formatted output: headings, code blocks with syntax highlighting, lists, tables, and inline formatting, all rendered progressively as the stream arrives.
Mental Model: "I send a message, the response streams in as formatted markdown — just like reading a rendered document, except it builds up in real time"
Key Constraint: Vanilla JS frontend — no component framework. The document viewer's markdown-it + shiki pipeline is server-side (Epic 2 deviated to server rendering). Epic 11 must set up a new client-side instance of the same pipeline for chat, producing output with visual parity to the document viewer. The rendering must be smooth enough for the M3 pause point — this is the designated iteration point where human judgment tunes the streaming feel.

**Objective:**
Polish the chat panel to feel like a natural part of the app. Typography and spacing match the document viewer. The panel opens and closes with a CSS transition. The resize handle gives clear visual feedback. The input area grows with content. Toggle controls let the developer close and reopen the panel, with state persisted across page loads. The View menu gains a "Toggle Chat Panel" item. Rendering errors fall back gracefully to plain text. Malformed markdown does not break the layout. When the feature flag is disabled, Epic 11's entire surface area is absent.

**Scope:**

In scope:
- Typography/spacing consistency: `.markdown-body` class on agent messages, font family, base font size, line height matching document viewer
- Message spacing: uniform vertical gaps, user/agent visual differentiation
- Code block styling: distinct background, padding, border-radius consistent with document viewer
- Panel open/close CSS transition: `chat-hidden` class on `#main`, grid-template-columns transition at 0.2s ease-out
- Panel overflow handling during transition: `overflow: hidden; visibility: hidden` via `transitionend` listener
- Resize handle hover state: accent color, `col-resize` cursor
- Multi-line input: `field-sizing: content` with min-height 2.5rem, max-height 8rem, `overflow-y: auto`
- Close button (×) in chat header with tooltip
- Toggle button at right edge when panel is closed with tooltip
- Panel visibility persistence: `localStorage` key `mdv-chat-visible`
- Width restoration on reopen from `localStorage` key `mdv-chat-width`
- View menu "Toggle Chat Panel ⌘J" item (modifying `menu-bar.ts`)
- Render error fallback: plain text display, error logged, panel remains functional
- Shiki error fallback: unstyled monospace code blocks
- Shiki cold-start: code blocks render as monospace `<pre><code>` while WASM loads
- Render retry on subsequent cycles
- Malformed markdown resilience: deeply nested lists, long code lines, mixed HTML
- Empty/short response handling
- Feature flag isolation: no rendering pipeline, no shortcuts, no CSS classes when flag disabled

Out of scope:
- Copy-to-clipboard for code blocks (future polish)
- Message-level actions — retry, edit (future polish)

**Dependencies:** Stories 1 and 3 complete.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

**AC-5.4 (TC-5.4c only):** Keyboard shortcuts are discoverable via tooltips

- **TC-5.4c: Panel toggle tooltip shows shortcut**
  - Given: The developer hovers over the panel toggle control
  - When: The tooltip appears
  - Then: The panel toggle shortcut is displayed

*Note: TC-5.4a (send button tooltip) and TC-5.4b (cancel button tooltip) are covered in Story 3, which delivers the Enter-to-send and Escape-to-cancel shortcuts.*

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Panel toggle mechanism:**

State: `panelVisible` boolean, stored in `localStorage` key `mdv-chat-visible` (values: `'true'` or `'false'`). Default `'true'` when no stored value exists.

CSS transition: `#main.chat-enabled` gets `transition: grid-template-columns 0.2s ease-out`. Adding `chat-hidden` class transitions the chat panel column to `0px`; removing it transitions back to the stored width.

```css
#main.chat-enabled.chat-hidden {
  grid-template-columns:
    var(--sidebar-width, 15rem)
    0px
    minmax(0, 1fr)
    0px
    0px;  /* chat-panel collapsed */
}
```

Panel overflow during transition: `overflow: hidden; pointer-events: none` on `#chat-panel` and `#chat-resizer` when `chat-hidden` is active. `visibility: hidden` set via `transitionend` listener.

**Close button:** `×` in chat header (`.chat-close-btn`), next to Clear button. Triggers same close transition as Cmd+J.

**Toggle button:** `.chat-toggle-btn` — `position: fixed; right: 0; top: 50%; transform: translateY(-50%)`. Visible when panel is closed, hidden when open.

**View menu integration:** `menu-bar.ts` modified to add "Toggle Chat Panel ⌘J" item to View menu when feature flag is enabled. Calls toggle function exposed by `chat-panel.ts`.

**Persistence flow:**

On mount: read `mdv-chat-visible` from localStorage. If `'false'`, apply `chat-hidden` immediately (no transition on initial load). On toggle: update localStorage. On reopen: read `mdv-chat-width` for width restoration.

**Render error fallback chain:**

1. Full pipeline (md + shiki): syntax-highlighted code blocks
2. Base pipeline (md, no shiki): monospace `<pre><code>` blocks (shiki cold-start or shiki error)
3. Complete failure: `escapeHtml(text)` — escaped plain text

`renderChatMarkdown()` catches all errors, logs via `console.error()`, returns escaped plain text. The chat panel remains functional. Subsequent render cycles retry the full pipeline (transient errors from partial state may resolve).

**Feature flag isolation:**

When `FEATURE_SPEC_STEWARD` is disabled:
- `mountChatPanel()` is never called → no markdown-it instance, no debounce timer (TC-6.4a)
- `registerChatShortcuts()` is never called → no Enter/Escape/Cmd+J handlers (TC-6.4b)
- No `chat-enabled` class on `#main` → no chat CSS active (TC-6.4c)

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `npm run verify-all` passes (including E2E + build)
- [ ] Agent message typography (font, size, line height) matches document viewer
- [ ] Message spacing uniform; user/agent visually differentiated
- [ ] Code block styling consistent with document viewer
- [ ] Panel opens/closes with CSS transition; workspace adjusts proportionally
- [ ] Resize handle shows accent color and col-resize cursor on hover
- [ ] Input area grows with content up to max height, then scrolls internally
- [ ] Close button in header closes panel; toggle button at edge reopens
- [ ] Panel visibility persists in localStorage across page loads
- [ ] Width restored on reopen
- [ ] View menu shows "Toggle Chat Panel ⌘J" when flag enabled
- [ ] Render errors fall back to plain text; error logged; panel functional
- [ ] Shiki failure falls back to unstyled monospace
- [ ] Shiki cold-start shows monospace code blocks
- [ ] Render cycles retry after transient failure
- [ ] Deeply nested lists, long code lines, mixed HTML render without layout breakage
- [ ] Single-word and code-block-only responses render properly
- [ ] Feature flag disabled: no pipeline, no shortcuts, no CSS classes

**Estimated test count:** 19 tests (17 TC-mapped + 2 non-TC)
