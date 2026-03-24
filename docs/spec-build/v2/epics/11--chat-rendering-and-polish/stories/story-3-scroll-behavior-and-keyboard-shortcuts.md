# Story 3: Scroll Behavior and Keyboard Shortcuts

### Summary
<!-- Jira: Summary field -->

Refined auto-scroll that handles markdown content height changes, respects user scroll position, and resumes on scroll-to-bottom. Enter-to-send, Shift+Enter for newline, Escape-to-cancel, and Cmd+J global panel toggle shortcut. Shortcut discoverability via tooltips on send and cancel buttons.

### Description
<!-- Jira: Description field -->

**User Profile:**
Primary User: The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward.
Context: Using the chat panel daily for conversational agent interaction. The plain text streaming from Epic 10 works but feels raw — responses are walls of unformatted text. The developer wants formatted output: headings, code blocks with syntax highlighting, lists, tables, and inline formatting, all rendered progressively as the stream arrives.
Mental Model: "I send a message, the response streams in as formatted markdown — just like reading a rendered document, except it builds up in real time"
Key Constraint: Vanilla JS frontend — no component framework. The document viewer's markdown-it + shiki pipeline is server-side (Epic 2 deviated to server rendering). Epic 11 must set up a new client-side instance of the same pipeline for chat, producing output with visual parity to the document viewer.

**Objective:**
Refine the auto-scroll behavior from Epic 10 for markdown rendering (where content height changes are less predictable — code block upgrades and Mermaid renders change height). Add keyboard shortcuts for the three core chat actions: sending messages, cancelling responses, and toggling panel visibility. Make shortcuts discoverable via button tooltips.

**Scope:**

In scope:
- Refined auto-scroll: calls `scrollToBottom()` at end of each render cycle (after innerHTML replacement and Mermaid processing), not on every state change
- Scroll-up detection with 20px threshold (refined from Epic 10)
- Auto-scroll re-engagement when developer scrolls back to bottom
- No scroll jump on `chat:done`
- `chat-shortcuts.ts`: Enter-to-send (textarea-scoped), Escape-to-cancel (panel-scoped), Cmd+J toggle (global via KeyboardManager)
- Tooltip text on send button ("Send (Enter)") and cancel button ("Cancel (Esc)")
- Shortcut cleanup function for lifecycle management

Out of scope:
- Panel open/close transition CSS (Story 4)
- Panel toggle controls and persistence (Story 4)
- UI polish (Story 4)

**Dependencies:** Story 1 complete. (Story 2 can be developed in parallel.)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

*Note: TC-5.4c (panel toggle tooltip shows shortcut) is covered in Story 4, which delivers the panel toggle control.*

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Scroll behavior refinement:**

Epic 10 called `scrollToBottom()` on every state change. Epic 11 calls it at the end of each render cycle (after innerHTML replacement and Mermaid processing) — the correct timing because the DOM height has stabilized.

```typescript
const SCROLL_THRESHOLD = 20;
let userScrolledUp = false;

messagesEl.addEventListener('scroll', () => {
  const { scrollTop, scrollHeight, clientHeight } = messagesEl;
  userScrolledUp = scrollHeight - scrollTop - clientHeight > SCROLL_THRESHOLD;
});

function scrollToBottom(): void {
  if (!userScrolledUp) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}
```

Height changes from code block upgrades and Mermaid renders are handled by the post-render `scrollToBottom()` call — it reads `scrollHeight` after the DOM update.

**Keyboard shortcuts (chat-shortcuts.ts):**

Three scoping levels:
1. **Enter-to-send** — `keydown` on the chat input `<textarea>` (not global). `Enter` without Shift: `preventDefault()`, trigger send. `Shift+Enter`: do nothing (default inserts newline). Empty input: do nothing. Disabled input: do nothing.
2. **Escape-to-cancel** — `keydown` on the chat panel container (`#chat-panel`). Fires when any element within the panel has focus. When streaming: trigger cancel. When idle: no action.
3. **Cmd+J toggle** — global via `KeyboardManager.register()`. Works regardless of focus. Registered on chat panel mount, unregistered on destroy. Not registered when feature flag is disabled (`mountChatPanel()` never called).

```typescript
export function registerChatShortcuts(
  inputEl: HTMLTextAreaElement,
  panelEl: HTMLElement,
  keyboardManager: KeyboardManager,
  handlers: ChatShortcutHandlers,
): () => void {
  // Returns cleanup function that removes all listeners
}
```

**Tooltip attributes (this story):**
- Send button: `title="Send (Enter)"`
- Cancel button: `title="Cancel (Esc)"`

*Toggle button and close button tooltips are set in Story 4, which delivers those controls.*

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `npm run verify` passes
- [ ] Auto-scroll follows streaming content including height changes from code block upgrades
- [ ] Scrolling up disengages auto-scroll; scrolling back to bottom re-engages
- [ ] No scroll jump on `chat:done`
- [ ] Enter sends message from focused input; Shift+Enter inserts newline
- [ ] Enter on empty input or while streaming does nothing
- [ ] Escape cancels streaming response; does nothing when idle
- [ ] Cmd+J toggles chat panel visibility globally
- [ ] Cmd+J not registered when feature flag is disabled
- [ ] Send and cancel buttons have tooltip text with shortcut hints
- [ ] Cleanup function removes all keyboard event listeners

**Estimated test count:** 19 tests (17 TC-mapped + 2 non-TC)
