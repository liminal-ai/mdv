# Story 2: Partial Construct Handling and Mermaid

### Summary
<!-- Jira: Summary field -->

Incomplete code fences, inline formatting, and Mermaid blocks degrade gracefully during streaming. Complete Mermaid blocks render as diagrams mid-stream. Mermaid diagrams re-render on theme switch. Transitions from partial to complete constructs are visually clean.

### Description
<!-- Jira: Description field -->

**User Profile:**
Primary User: The developer of MD Viewer, who is also the primary product user and the sole consumer of the Spec Steward.
Context: Using the chat panel daily for conversational agent interaction. The plain text streaming from Epic 10 works but feels raw — responses are walls of unformatted text. The developer wants formatted output: headings, code blocks with syntax highlighting, lists, tables, and inline formatting, all rendered progressively as the stream arrives.
Mental Model: "I send a message, the response streams in as formatted markdown — just like reading a rendered document, except it builds up in real time"
Key Constraint: Vanilla JS frontend — no component framework. The document viewer's markdown-it + shiki pipeline is server-side (Epic 2 deviated to server rendering). Epic 11 must set up a new client-side instance of the same pipeline for chat, producing output with visual parity to the document viewer.

**Objective:**
Handle the streaming edge cases that arise when markdown constructs are partially received. Incomplete code fences show as plain monospace text until the closing fence arrives, then upgrade to highlighted code. Unclosed inline formatting renders as literal characters. Mermaid code blocks render as diagrams when the closing fence arrives (mid-stream, not on `chat:done`). Mermaid diagrams re-render when the theme changes. The transition from partial to complete constructs does not cause jarring reflows.

**Scope:**

In scope:
- Incomplete code fence handling via `preprocessPartialFences()` (from Story 0 infrastructure, exercised here in streaming context)
- Incomplete inline formatting verification (markdown-it handles natively)
- Mermaid rendering in chat via `chat-mermaid.ts`: post-render detection of `pre > code.language-mermaid`, per-conversation SVG cache (`Map<string, string>` keyed by `sourceHash:themeId`), rendering via `renderWithTimeout()` from `mermaid-renderer.ts`
- Mermaid SVG cache-hit path using `replacePlaceholderWithSvg()` for consistent safety
- Mermaid theme re-rendering via MutationObserver on `data-theme` attribute
- Mermaid render failure fallback (show source as code block with error indicator)
- Cache clear on `chat:clear`
- Smooth transition verification (no scroll jump, no flash of raw markdown)
- TC-1.3b (theme switch updates Mermaid diagrams in chat)

Out of scope:
- Epic 6's LRU `MermaidCache` class (not reused — chat has its own simpler Map cache)
- Scroll behavior refinement (Story 3)
- Keyboard shortcuts (Story 3)
- UI polish and panel toggle (Story 4)

**Dependencies:** Story 1 complete.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

**AC-1.3 (TC-1.3b only):** Theme switch updates chat content

- **TC-1.3b: Theme switch updates chat content**
  - Given: The chat contains rendered agent responses
  - When: The developer switches the app theme
  - Then: Text content, code block backgrounds, and table styling update via CSS custom properties. Mermaid diagrams re-render with the new theme's colors (Mermaid SVGs embed colors and cannot be updated via CSS variables alone).

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Partial fence pre-processing (exercised from Story 0):**

`preprocessPartialFences()` scans for fence markers (lines starting with 3+ backticks). If the count is odd (unclosed fence): strips the language tag from the last opening fence and appends a sentinel closing fence. markdown-it renders the partial code as plain monospace `<pre><code>` — no shiki highlighting. When the real closing fence arrives, fence count is even, text passes through unmodified, and shiki highlights the complete block.

markdown-it handles incomplete inline formatting natively — unclosed `**`, `*`, `~~`, and `[link text](` render as literal characters. No pre-processing needed.

**Mermaid pipeline (chat-mermaid.ts):**

Mermaid processing happens after the main render cycle sets innerHTML. The shiki highlight hook returns `''` for `mermaid` language, so markdown-it's default fence renderer produces `<pre><code class="language-mermaid">source</code></pre>`.

Post-render: `processChatMermaid(messageEl)` scans for `pre > code.language-mermaid` elements. For each: extract source text, compute `fnv1a(source) + ':' + themeId` as cache key. If cached: re-inject via `replacePlaceholderWithSvg()` (consistent safety — `stripInlineEventHandlers()` + `applySvgSizing()`). If not cached: call `renderWithTimeout(source, id, theme)` from `mermaid-renderer.ts`, cache SVG, replace element.

Incomplete Mermaid fences: the pre-processor strips the language tag and injects a closing fence, so the block renders as plain monospace code — no `language-mermaid` class, no Mermaid rendering attempted.

**Mermaid theme re-rendering:**

MutationObserver on `document.documentElement` `data-theme` attribute. When theme changes: clear SVG cache, find all `.mermaid-diagram` elements within `.chat-messages`, read `data-mermaid-source`, re-render with new theme via `renderWithTimeout()`, apply `stripInlineEventHandlers()` + `applySvgSizing()`.

**SVG churn mitigation:**

Each render cycle replaces innerHTML, destroying previously rendered Mermaid SVGs. The SVG cache (`Map<string, string>` keyed by `sourceHash:themeId`) handles this — after innerHTML replacement, the post-render step checks for code blocks, finds cached SVGs, and re-injects them directly without calling `mermaid.run()`.

**Modified module: `utils/mermaid-renderer.ts`:**

Export `stripInlineEventHandlers()` and `applySvgSizing()` for reuse by `chat-mermaid.ts`. No behavior changes to existing functions.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `npm run verify` passes
- [ ] `npm run build` passes
- [ ] Incomplete code fences render as plain monospace; upgrade to highlighted on closing fence
- [ ] Unclosed inline formatting (bold, italic, strikethrough, links) renders as literal characters
- [ ] Complete Mermaid blocks render as diagrams mid-stream (not on `chat:done`)
- [ ] Incomplete Mermaid fences render as plain code blocks
- [ ] Mermaid render failures fall back to source as code block with error indicator
- [ ] SVG cache prevents re-rendering on subsequent render cycles
- [ ] Theme switch re-renders Mermaid diagrams with new theme colors
- [ ] Cache cleared on `chat:clear`
- [ ] No scroll jump or raw markdown flash during streaming transitions
- [ ] `mermaid-renderer.ts` exports `stripInlineEventHandlers` and `applySvgSizing`

**Estimated test count:** 16 tests (12 TC-mapped + 4 non-TC)
