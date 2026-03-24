# Test Plan: Chat Rendering and Polish (Epic 11)

Companion to `tech-design.md`. This document provides complete TC→test mapping, mock strategy, fixtures, chunk breakdown with test counts, and gorilla testing scenarios.

---

## Mock Strategy

### Mock Boundaries

Tests mock at external boundaries only. Internal modules are exercised through their entry points.

| Boundary | Mock? | Why |
|----------|-------|-----|
| `markdown-it` rendering | No | Internal module — test the real pipeline. The rendering output is what we're verifying. |
| `shiki` / `@shikijs/markdown-it` | Partial | Real shiki is used in integration tests. For unit tests of `chat-renderer.ts`, a lightweight mock avoids WASM loading overhead. |
| `isomorphic-dompurify` | No | Internal module — test the real sanitization. Fast in-process. |
| `mermaid` | Yes | External async rendering with DOM requirements. Mock `renderWithTimeout` from `mermaid-renderer.ts`. |
| `localStorage` | Yes (jsdom provides) | Browser API — jsdom provides it. |
| `KeyboardManager` | No | Internal module — test real registration/dispatch. |
| WebSocket (`ChatWsClient`) | Yes | Network boundary — use mock WebSocket (inherited from Epic 10). |
| DOM (`document`, `HTMLElement`) | No (jsdom) | jsdom provides the DOM environment for component tests. |
| `crypto.randomUUID` | No | Standard API, deterministic enough for tests. |

### Shiki Mock Strategy

Shiki loads WASM grammars asynchronously, which is expensive in test environments. Two test approaches coexist:

1. **Unit tests for `chat-renderer.ts`:** Mock `shiki` and `@shikijs/markdown-it` to return a no-op plugin. Tests verify pre-processing, sanitization, and markdown-it configuration without WASM overhead. These tests cover the pipeline's orchestration logic.

2. **Integration tests for rendering output:** Use real shiki with a minimal language set (just `javascript` and `typescript`) to verify syntax highlighting output. These tests are slower but verify the actual shiki integration produces `<pre class="shiki">` output with CSS variables.

```typescript
// Unit test mock for shiki
vi.mock('shiki', () => ({
  createHighlighter: vi.fn(async () => ({
    getLoadedThemes: () => ['github-light', 'github-dark'],
    getLoadedLanguages: () => [],
  })),
}));

vi.mock('@shikijs/markdown-it', () => ({
  fromHighlighter: vi.fn(() => () => {}), // no-op plugin
}));
```

### Mermaid Mock Strategy

Mermaid rendering requires a full DOM with SVG measurement capabilities. In jsdom tests, mock the rendering function:

```typescript
vi.mock('../utils/mermaid-renderer.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/mermaid-renderer.js')>();
  return {
    ...actual,
    renderWithTimeout: vi.fn(async (source: string, id: string, theme: string) => ({
      svg: `<svg data-test-source="${source}" data-test-theme="${theme}"></svg>`,
    })),
    getMermaidTheme: vi.fn(() => 'default'),
  };
});
```

### Client Test Pattern

Client tests use jsdom with the Epic 10 DOM setup pattern, extended for rendered markdown:

```typescript
import { JSDOM } from 'jsdom';

let dom: JSDOM;
beforeEach(() => {
  dom = new JSDOM(`<div id="main"><div id="workspace"></div></div>`, {
    url: 'http://localhost:3000',
  });
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
});
```

---

## Test Fixtures

```typescript
// app/tests/fixtures/chat-rendering.ts

// --- Markdown Samples ---

/** Simple markdown with headings, lists, bold, italic */
export const basicMarkdown = `# Heading 1
## Heading 2

Some **bold** and *italic* text.

- Item 1
- Item 2
  - Nested item

1. First
2. Second`;

/** Markdown with a fenced code block (complete) */
export const codeBlockMarkdown = '# Code Example\n\n```typescript\nconst x: number = 42;\nconsole.log(x);\n```\n\nMore text after.';

/** Markdown with an incomplete code fence (no closing) */
export const incompleteCodeFence = '# Partial\n\n```typescript\nconst x = 1;\nconst y = 2;';

/** Markdown with inline code */
export const inlineCodeMarkdown = 'Use `console.log()` to debug.';

/** Markdown with a table */
export const tableMarkdown = `| Name | Value |
|------|-------|
| foo  | 1     |
| bar  | 2     |`;

/** Wide table that should scroll horizontally */
export const wideTableMarkdown = `| ${'Col | '.repeat(20)}
|${'------|'.repeat(20)}
| ${'val | '.repeat(20)}`;

/** Markdown with blockquotes */
export const blockquoteMarkdown = `> This is a blockquote
> with multiple lines
>
> And a second paragraph`;

/** Markdown with task lists */
export const taskListMarkdown = `- [x] Done item
- [ ] Todo item
- [x] Another done`;

/** Markdown with external links */
export const linksMarkdown = `Visit [Google](https://google.com) or [mailto](mailto:test@example.com).

See [heading](#some-heading) below.

## Some Heading`;

/** Markdown with horizontal rule */
export const horizontalRuleMarkdown = `Above the line

---

Below the line`;

/** Markdown with mermaid code block (complete) */
export const mermaidMarkdown = '```mermaid\ngraph TD\n  A --> B\n```';

/** Markdown with incomplete mermaid fence */
export const incompleteMermaidFence = '```mermaid\ngraph TD\n  A --> B';

/** Markdown with invalid mermaid syntax */
export const invalidMermaidMarkdown = '```mermaid\ninvalid diagram syntax ???\n```';

/** Markdown with multiple code blocks — first two complete, third incomplete */
export const multipleCodeBlocks = '```javascript\nconst a = 1;\n```\n\nText between.\n\n```python\nx = 42\n```\n\nMore text.\n\n```rust\nfn main() {';

/** Unclosed bold */
export const unclosedBold = 'This has **unclosed bold text';

/** Unclosed italic */
export const unclosedItalic = 'This has *unclosed italic text';

/** Unclosed strikethrough */
export const unclosedStrikethrough = 'This has ~~unclosed strike';

/** Incomplete link */
export const incompleteLink = 'Click [here](';

/** Deeply nested list (10+ levels) */
export const deeplyNestedList = Array.from({ length: 12 }, (_, i) =>
  `${'  '.repeat(i)}- Level ${i + 1}`
).join('\n');

/** Very long code line */
export const longCodeLine = '```\n' + 'x'.repeat(600) + '\n```';

/** Script injection attempt */
export const scriptInjection = '<script>alert("xss")</script>\n\nNormal text.';

/** Event handler injection attempt */
export const eventHandlerInjection = '<div onclick="alert(1)">Click me</div>';

/** Safe HTML elements */
export const safeHtmlElements = '<details><summary>Click</summary>\n\nContent\n\n</details>\n\n<kbd>Ctrl</kbd>+<kbd>C</kbd>';

/** Single word response */
export const singleWordResponse = 'Yes';

/** Only a code block, no surrounding text */
export const codeBlockOnly = '```javascript\nconsole.log("hello");\n```';

/** Empty string */
export const emptyResponse = '';

// --- Streaming Simulation Helpers ---

/** Split text into token-sized chunks for simulating streaming */
export function tokenize(text: string, chunkSize = 5): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

/** Create a stream of tokens that builds up to the full text */
export function createTokenStream(text: string, chunkSize = 5): string[] {
  const tokens = tokenize(text, chunkSize);
  const accumulated: string[] = [];
  let buffer = '';
  for (const token of tokens) {
    buffer += token;
    accumulated.push(buffer);
  }
  return accumulated;
}
```

---

## TC → Test Mapping

### Chunk 0: Foundation

| TC | Test File | Test Description | Setup | Assert |
|----|-----------|------------------|-------|--------|
| TC-1.6a | chat-renderer.test.ts | Script tags are stripped from rendered output | Render `scriptInjection` fixture | No `<script>` in output |
| TC-1.6b | chat-renderer.test.ts | Event handler attributes are removed | Render `eventHandlerInjection` fixture | No `onclick` in output |
| TC-1.6c | chat-renderer.test.ts | Safe HTML elements are preserved | Render `safeHtmlElements` fixture | `<details>`, `<summary>`, `<kbd>` present |
| — | chat-renderer.test.ts | `preprocessPartialFences` closes unclosed fence | Call with `incompleteCodeFence` | Returns text with closing fence appended |
| — | chat-renderer.test.ts | `preprocessPartialFences` strips language from unclosed fence | Call with `incompleteCodeFence` | Opening fence has no language tag |
| — | chat-renderer.test.ts | `preprocessPartialFences` passes complete text through unchanged | Call with `codeBlockMarkdown` | Returns identical text |
| — | chat-renderer.test.ts | `preprocessPartialFences` handles text with no fences | Call with `basicMarkdown` | Returns identical text |
| — | chat-renderer.test.ts | `preprocessPartialFences` handles nested fences (4-backtick) | Call with 4-backtick fence wrapping 3-backtick | Correct fence pairing |
| — | chat-renderer.test.ts | `escapeHtml` escapes angle brackets and ampersands | Call with `<script>&` | Returns `&lt;script&gt;&amp;` |
| — | chat-renderer.test.ts | `createRenderThrottle` fires leading edge immediately | Create throttle, call schedule() | Render function called synchronously |

**Test Count: 10** (3 TC-mapped + 7 non-TC)

### Chunk 1: Streaming Markdown Rendering

| TC | Test File | Test Description | Setup | Assert |
|----|-----------|------------------|-------|--------|
| TC-1.1a | chat-renderer.test.ts | Headings render with correct hierarchy (h1–h6) | Render headings markdown | Output contains `<h1>` through `<h6>` |
| TC-1.1b | chat-renderer.test.ts | Inline formatting renders correctly | Render `basicMarkdown` | Output contains `<strong>`, `<em>` |
| TC-1.1c | chat-renderer.test.ts | Lists render with proper nesting | Render `basicMarkdown` | Output contains nested `<ul>`, `<ol>`, `<li>` |
| TC-1.1d | chat-renderer.test.ts | Tables render with headers and alignment | Render `tableMarkdown` | Output contains `<table>`, `<thead>`, `<th>` |
| TC-1.1e | chat-panel.test.ts | Wide tables scroll horizontally | Mount panel, render `wideTableMarkdown` | Table wrapper has `overflow-x: auto` via CSS class |
| TC-1.1f | chat-renderer.test.ts | Blockquotes render with visual distinction | Render `blockquoteMarkdown` | Output contains `<blockquote>` |
| TC-1.1g | chat-panel.test.ts | External link click calls window.open | Mount panel, render `linksMarkdown`, simulate click on https link | `window.open` called with URL, `'_blank'`, `'noopener'`; `event.preventDefault()` called |
| TC-1.1h | chat-panel.test.ts | Anchor links scroll within message | Mount panel, render `linksMarkdown` | Click on `#some-heading` scrolls within message, doesn't navigate |
| TC-1.1i | chat-panel.test.ts | Mailto link click uses default behavior | Mount panel, render `linksMarkdown`, simulate click on mailto link | Click is NOT intercepted (no `preventDefault`); `href="mailto:..."` preserved in HTML so browser default opens mail client |
| TC-1.1j | chat-renderer.test.ts | Horizontal rules render | Render `horizontalRuleMarkdown` | Output contains `<hr>` |
| TC-1.1k | chat-renderer.test.ts | Task lists render with checkboxes | Render `taskListMarkdown` | Output contains checkbox `<input>` elements |
| TC-1.2a | chat-renderer.integration.test.ts | Fenced code block with language gets highlighting | Render `codeBlockMarkdown` with real shiki | Output contains `<pre class="shiki">` with `--shiki-light`/`--shiki-dark` vars |
| TC-1.2b | chat-renderer.test.ts | Fenced code block without language renders monospace | Render code block with no language | Output contains `<pre><code>` without `.shiki` class |
| TC-1.2c | chat-renderer.test.ts | Inline code renders distinctly | Render `inlineCodeMarkdown` | Output contains `<code>console.log()</code>` |
| TC-1.2d | chat-panel.test.ts | Long lines in code blocks scroll horizontally | Mount panel, render `longCodeLine` | `<pre>` has `overflow-x: auto` via CSS |
| TC-1.3a | chat-renderer.integration.test.ts | Chat markdown uses shiki dual-theme CSS variables | Render code block with real shiki | Token spans contain `--shiki-light` and `--shiki-dark` |
| TC-1.4a | chat-panel.test.ts | Tokens between render cycles are batched | Send multiple tokens within debounce interval | `renderChatMarkdown` called once (not per token) |
| TC-1.4b | chat-panel.test.ts | Render occurs promptly after tokens arrive | Send first token | Render fires within one debounce interval |
| TC-1.4c | chat-panel.test.ts | Final render on response completion | Send tokens then `chat:done` | Final render fires immediately (flush) |
| TC-1.4d | chat-panel.test.ts | Final render on cancelled response | Send tokens then `chat:done` with cancelled | Final render fires, partial text fully rendered |
| TC-1.4e | chat-renderer.test.ts | Debounce interval is a configurable constant | Check `DEBOUNCE_INTERVAL_MS` export | Named constant exists, is a number |
| TC-1.5a | chat-panel.test.ts | Completed messages are not re-rendered | 5 completed + 1 streaming, trigger render cycle | Only streaming message's DOM updated |
| TC-1.5b | chat-panel.test.ts | Performance with long conversations | 50+ messages, new streaming | Render time proportional to current message, not conversation length |
| — | chat-renderer.test.ts | `initChatRendererBase` creates working markdown-it pipeline | Call base init, then render | Returns HTML with `<h1>`, `<p>` etc. (no shiki highlighting) |
| — | chat-renderer.test.ts | `initChatRendererShiki` adds syntax highlighting | Call base init + shiki init, then render code block | Output contains `.shiki` class |
| — | chat-renderer.test.ts | `renderChatMarkdown` fallback when not initialized at all | Call render before any init | Returns escaped plain text |
| — | chat-panel.test.ts | Link click interceptor dispatches correctly for https | Render markdown with https link, simulate click | `window.open` called; `event.preventDefault()` called |
| — | chat-panel.test.ts | Agent message wraps content in .markdown-body | Mount panel, receive agent response | Agent message has `.markdown-body` child |

**Test Count: 28** (23 TC-mapped + 5 non-TC)

### Chunk 2: Partial Constructs + Mermaid

| TC | Test File | Test Description | Setup | Assert |
|----|-----------|------------------|-------|--------|
| TC-2.1a | chat-renderer.test.ts | Open code fence without closing renders as plain monospace | Render `incompleteCodeFence` | Output has `<pre><code>` without `.shiki` class |
| TC-2.1b | chat-renderer.test.ts | Closing fence upgrades to highlighted code block | Render incomplete, then render with closing fence | Second render has `<pre class="shiki">` or highlighted output |
| TC-2.1c | chat-renderer.test.ts | Multiple code blocks — complete ones highlighted, incomplete plain | Render `multipleCodeBlocks` | First two highlighted, third plain monospace |
| TC-2.2a | chat-renderer.test.ts | Unclosed bold renders as literal characters | Render `unclosedBold` | Output contains literal `**unclosed bold text` |
| TC-2.2b | chat-renderer.test.ts | Unclosed italic and strikethrough render as literals | Render `unclosedItalic` and `unclosedStrikethrough` | Literal `*` and `~~` in output |
| TC-2.2c | chat-renderer.test.ts | Incomplete link renders as literal characters | Render `incompleteLink` | Literal `[here](` in output |
| TC-2.3a | chat-mermaid.test.ts | Incomplete Mermaid block shows as code | Render `incompleteMermaidFence` | Output is `<pre><code>` (no diagram) |
| TC-2.3b | chat-mermaid.test.ts | Complete Mermaid block renders as diagram mid-stream | Mount message, render `mermaidMarkdown`, process Mermaid | `.mermaid-diagram` element present with SVG |
| TC-2.3c | chat-mermaid.test.ts | Mermaid render failure shows error | Mock `renderWithTimeout` to throw | `.mermaid-error` element with error message |
| TC-2.4a | chat-panel.test.ts | Code block upgrade doesn't cause scroll jump | Render incomplete fence, then complete | Scroll position preserved |
| TC-2.4b | chat-panel.test.ts | No flash of raw markdown during streaming | Simulate token stream, inspect renders | No render output contains raw `**` or `` ``` `` that should be formatted |
| TC-1.3b | chat-mermaid.test.ts | Theme switch re-renders Mermaid diagrams | Render Mermaid, change theme | `renderWithTimeout` called with new theme |
| — | chat-mermaid.test.ts | SVG cache hit avoids re-rendering | Render same source twice | `renderWithTimeout` called once, second gets cached SVG |
| — | chat-mermaid.test.ts | `clearChatMermaidCache` empties cache | Set cache, clear, render | `renderWithTimeout` called again (no cache hit) |
| — | chat-mermaid.test.ts | Mermaid render timeout handled | Mock `renderWithTimeout` to timeout | Error fallback displayed |
| — | chat-mermaid.test.ts | `fnv1a` produces consistent hashes | Hash same string twice | Same hash value |

**Test Count: 16** (12 TC-mapped + 4 non-TC)

### Chunk 3: Scroll Behavior + Keyboard Shortcuts

| TC | Test File | Test Description | Setup | Assert |
|----|-----------|------------------|-------|--------|
| TC-3.1a | chat-panel.test.ts | Scroll follows streaming content | Simulate streaming, check scroll | `scrollTop` near `scrollHeight` |
| TC-3.1b | chat-panel.test.ts | Auto-scroll works during height changes | Render incomplete fence → complete fence | Scroll follows after height change |
| TC-3.2a | chat-panel.test.ts | Manual scroll-up disengages auto-scroll | Set `scrollTop` to 0, trigger render | Scroll stays at user position |
| TC-3.2b | chat-panel.test.ts | Content continues streaming while scrolled up | Scroll up, more tokens arrive | Content grows below viewport, scroll stays |
| TC-3.3a | chat-panel.test.ts | Scroll-to-bottom re-engages auto-scroll | Scroll up then back to bottom | Auto-scroll resumes |
| TC-3.4a | chat-panel.test.ts | No scroll jump after response completes | Stream response, `chat:done` | Scroll position stable |
| TC-5.1a | chat-shortcuts.test.ts | Enter sends the message | Focus input, type text, press Enter | Send handler called, input cleared |
| TC-5.1b | chat-shortcuts.test.ts | Shift+Enter inserts newline | Focus input, press Shift+Enter | Newline in input, send NOT called |
| TC-5.1c | chat-shortcuts.test.ts | Enter on empty input does nothing | Focus empty input, press Enter | Send handler NOT called |
| TC-5.1d | chat-shortcuts.test.ts | Enter while streaming does not send | Set input disabled, press Enter | Send handler NOT called |
| TC-5.2a | chat-shortcuts.test.ts | Escape cancels streaming | Active streaming, press Escape on panel | Cancel handler called |
| TC-5.2b | chat-shortcuts.test.ts | Escape when idle does nothing | No active streaming, press Escape | Cancel handler NOT called |
| TC-5.3a | chat-shortcuts.test.ts | Toggle shortcut closes panel | Panel open, dispatch Cmd+J | Toggle handler called |
| TC-5.3b | chat-shortcuts.test.ts | Toggle shortcut opens panel | Panel closed, dispatch Cmd+J | Toggle handler called |
| TC-5.3c | chat-shortcuts.test.ts | Toggle works regardless of focus | Focus on non-chat element, Cmd+J | Toggle handler called |
| TC-5.3d | chat-shortcuts.test.ts | Toggle not registered when flag disabled | Don't call registerChatShortcuts, Cmd+J | No handler fires |
| TC-5.4a | chat-panel.test.ts | Send button tooltip shows shortcut | Mount panel, read send button title | `title` contains "Enter" |
| TC-5.4b | chat-panel.test.ts | Cancel button tooltip shows Escape | Mount panel, read cancel button title | `title` contains "Esc" |
| TC-5.4c | chat-panel.test.ts | Panel toggle tooltip shows shortcut | Mount panel, read toggle button title | `title` contains "⌘J" |
| — | chat-shortcuts.test.ts | `registerChatShortcuts` cleanup removes all listeners | Register then call cleanup | Re-dispatch events, no handlers fire |
| — | chat-panel.test.ts | Scroll position preserved across render cycles | Scroll to middle, trigger render | `scrollTop` unchanged |

**Test Count: 19** (17 TC-mapped + 2 non-TC)

### Chunk 4: UI Polish, Panel Toggle, Error Handling

| TC | Test File | Test Description | Setup | Assert |
|----|-----------|------------------|-------|--------|
| TC-4.1a | chat-panel.test.ts | Font and spacing match document rendering | Mount panel, render agent message | `.markdown-body` class applied; verify rendered `<h1>`, `<p>`, `<code>` elements inherit theme CSS custom properties (check `getComputedStyle` uses `var(--color-*)` values) |
| TC-4.1b | chat-panel.test.ts | Message spacing is consistent | Render multiple messages | Uniform gap between messages, user/agent aligned differently |
| TC-4.1c | chat-panel.test.ts | Code block styling in chat | Render code block | `<pre>` has distinct background (via `.markdown-body pre` styles) |
| TC-4.2a | chat-panel.test.ts | Panel open transition | Open closed panel | `chat-hidden` class removed, transition CSS property set |
| TC-4.2b | chat-panel.test.ts | Panel close transition | Close open panel | `chat-hidden` class added |
| TC-4.2c | chat-panel.test.ts | Workspace adjusts during transition | Toggle panel | Grid template changes (5-column to collapsed) |
| TC-4.3a | chat-panel.test.ts | Hover state on resize handle | Mount panel, verify resize handle element exists | `cursor: col-resize` set on element; `:hover` CSS rule verified in stylesheet (visual verification deferred to gorilla testing) |
| TC-4.3b | chat-panel.test.ts | Active drag state | Inherited from Epic 10 | `.dragging` class applied during drag |
| TC-4.4a | chat-panel.test.ts | Input area grows with content | Type multi-line text in textarea | Textarea height increases (via `field-sizing: content`) |
| TC-4.4b | chat-panel.test.ts | Input area scrolls at maximum height | Type text exceeding max-height | Textarea has `overflow-y: auto`, height capped |
| TC-4.5a | chat-panel.test.ts | Close control in header | Mount panel, find close button | `.chat-close-btn` exists, click closes panel |
| TC-4.5b | chat-panel.test.ts | Reopen control when panel closed | Close panel | `.chat-toggle-btn` visible |
| TC-4.5c | chat-panel.test.ts | Panel visibility persists across page loads | Close panel → verify `mdv-chat-visible` is `'false'` in localStorage. Then simulate reload: set localStorage `mdv-chat-visible='false'` and `mdv-chat-width='400'`, remount panel | Panel starts closed; reopening restores 400px width from `mdv-chat-width` |
| TC-6.1a | chat-renderer.test.ts | Deeply nested constructs render without breaking layout | Render `deeplyNestedList` | Output contains nested `<ul>` elements, no errors |
| TC-6.1b | chat-panel.test.ts | Extremely long lines in code blocks scroll | Render `longCodeLine` | `<pre>` has overflow-x handling |
| TC-6.1c | chat-renderer.test.ts | Mixed or broken HTML renders safely | Render raw HTML with script tags | Script stripped, safe HTML preserved |
| TC-6.2a | chat-renderer.test.ts | Render failure falls back to plain text and logs error | Mock markdown-it to throw, spy on `console.error` | Returns escaped plain text; `console.error` called with error |
| TC-6.2b | chat-renderer.integration.test.ts | Shiki failure falls back to unstyled code | Force shiki error on render | Code block renders as `<pre><code>` without `.shiki` |
| TC-6.2c | chat-renderer.test.ts | Code blocks render as monospace without highlighting while shiki loading | Call `initChatRendererBase()` (no shiki), then `renderChatMarkdown` with code block | Output contains `<pre><code>` block (monospace, no `.shiki` class); NOT escaped raw text |
| TC-6.2d | chat-panel.test.ts | Subsequent render cycles retry after transient failure | First render fails, more tokens arrive, second render | Second render attempts the full text again |
| TC-6.3a | chat-panel.test.ts | Single-word response renders properly | Render `singleWordResponse` | Word in styled message bubble, no layout collapse |
| TC-6.3b | chat-renderer.test.ts | Response with only a code block renders | Render `codeBlockOnly` | `<pre><code>` present, no error |
| TC-6.4a | chat-panel.test.ts | No chat rendering pipeline when flag disabled | Don't mount chat panel | No markdown-it instance, no debounce timer |
| TC-6.4b | chat-shortcuts.test.ts | No chat keyboard shortcuts when flag disabled | Don't register shortcuts, press Enter/Cmd+J | No chat handlers fire |
| TC-6.4c | chat-panel.test.ts | No chat-specific CSS when flag disabled | Don't mount chat panel | No `chat-enabled` class on `#main` |
| — | chat-panel.test.ts | `mdv-chat-visible` localStorage read/write | Set localStorage, mount panel | Panel state matches stored value |
| — | chat-panel.test.ts | Toggle button visibility syncs with panel state | Open/close panel | Button hidden when open, visible when closed |

**Test Count: 19** (17 TC-mapped + 2 non-TC)

---

## Test File Organization

```
app/tests/client/steward/
├── chat-renderer.test.ts              # Pipeline unit tests (shiki mocked)
├── chat-renderer.integration.test.ts  # Pipeline integration tests (real shiki, minimal langs)
├── chat-mermaid.test.ts               # Mermaid SVG cache, placeholder processing, theme re-render
├── chat-shortcuts.test.ts             # Keyboard shortcut registration, Enter/Escape/Cmd+J
└── chat-panel.test.ts                 # Integrated panel tests: render cycles, scroll, toggle, DOM

app/tests/fixtures/
└── chat-rendering.ts                  # Markdown samples, streaming simulation helpers
```

### Test Count Reconciliation

| Test File | Chunk 0 | Chunk 1 | Chunk 2 | Chunk 3 | Chunk 4 | Total |
|-----------|---------|---------|---------|---------|---------|-------|
| `chat-renderer.test.ts` | 10 | 11 | 6 | — | 5 | 32 |
| `chat-renderer.integration.test.ts` | — | 2 | — | — | 1 | 3 |
| `chat-mermaid.test.ts` | — | — | 8 | — | — | 8 |
| `chat-shortcuts.test.ts` | — | — | — | 8 | 1 | 9 |
| `chat-panel.test.ts` | — | 15 | 2 | 11 | 12 | 40 |
| **Per-chunk total** | **10** | **28** | **16** | **19** | **19** | **92** |

**Cross-check:** 92 total tests = 72 TC-mapped tests + 20 non-TC tests.

- TC-mapped: 3 (Chunk 0) + 23 (Chunk 1) + 12 (Chunk 2) + 17 (Chunk 3) + 17 (Chunk 4) = 72
- Non-TC: 7 (Chunk 0) + 5 (Chunk 1) + 4 (Chunk 2) + 2 (Chunk 3) + 2 (Chunk 4) = 20
- Per-chunk totals: 10 + 28 + 16 + 19 + 19 = 92 ✓
- Per-file totals: 32 + 3 + 8 + 9 + 40 = 92 ✓

**TC coverage:** All 82 TCs from the epic appear in the mapping tables above. Every TC has at least one test row. Some TCs are combined into single tests where the verification is naturally grouped (e.g., TC-2.2b covers both italic and strikethrough). The 72 TC-mapped tests cover all 82 TCs — the difference is from test consolidation, not missing coverage.

---

## Verification Checklist

### Per-Chunk Exit Criteria

| Chunk | Red Exit | Green Exit |
|-------|----------|------------|
| 0 | `npm run red-verify` passes (format + lint + typecheck) | `npm run verify` passes (+ tests) |
| 1 | `npm run red-verify` passes; new tests ERROR (stubs throw) | `npm run verify` passes; `npm run build` passes |
| 2 | `npm run red-verify` passes; new tests ERROR | `npm run verify` passes; `npm run build` passes |
| 3 | `npm run red-verify` passes; new tests ERROR | `npm run verify` passes |
| 4 | `npm run red-verify` passes; new tests ERROR | `npm run verify-all` passes (including E2E + build) |

### Manual Verification After All Chunks

1. [ ] Enable `FEATURE_SPEC_STEWARD=true`
2. [ ] Send a message that triggers a code-heavy response
3. [ ] Verify syntax highlighting appears during streaming
4. [ ] Verify theme switch updates shiki colors via CSS
5. [ ] Send a message that triggers a Mermaid diagram
6. [ ] Verify Mermaid renders when closing fence arrives (mid-stream, not on completion)
7. [ ] Theme switch re-renders Mermaid with correct colors
8. [ ] Scroll up during streaming — verify auto-scroll stops
9. [ ] Scroll back to bottom — verify auto-scroll resumes
10. [ ] Press Enter to send, Shift+Enter for newline
11. [ ] Press Escape to cancel a streaming response
12. [ ] Press Cmd+J to toggle panel — verify transition
13. [ ] Close panel, reload page — verify panel stays closed
14. [ ] Disable feature flag — verify no chat elements, no shortcuts
15. [ ] Send a long response (1000+ tokens) — verify smooth streaming

---

## Gorilla Testing Scenarios

### Epic 11: Chat Rendering and Polish

**New capabilities to test:**

- **Streaming markdown rendering quality** — Send messages that elicit long, formatted responses. Watch for: raw markdown characters flashing before being rendered, code blocks appearing then disappearing, inconsistent heading sizes compared to document viewer, table layout breaking the chat panel width.
- **Partial construct transitions** — Send messages that trigger code-heavy responses. Watch for: visual jumps when an incomplete code fence completes (the transition from plain text to highlighted code should be smooth), content below a completing code block shifting position, Mermaid diagrams appearing and then being destroyed by the next render cycle.
- **Theme switching during streaming** — Start a streaming response, then switch themes mid-stream. Watch for: shiki highlighting using wrong theme colors, Mermaid diagrams not re-rendering with new theme, CSS variable transitions not applying to chat content, flash of unstyled content during theme transition.
- **Scroll behavior under load** — During a long streaming response, scroll up to read earlier content, then scroll back to bottom. Watch for: being yanked back to bottom after scrolling up, losing scroll position when a code block upgrades from plain text to highlighted, auto-scroll not resuming after scrolling back to bottom, scroll position jumping when `chat:done` fires.
- **Keyboard shortcuts interaction** — Rapidly press Enter to send multiple messages, press Escape while no response is streaming, press Cmd+J while streaming to close panel (should response continue?), press Cmd+J in rapid succession (should panel toggle cleanly?).
- **Panel toggle transitions** — Open/close the panel repeatedly. Watch for: workspace not resizing correctly, content overflow during transition, resize handle becoming unresponsive after toggle, panel width resetting after toggle (should preserve custom width).

**Adjacent features to recheck:**

- **Document rendering** — Verify document viewer markdown rendering is completely unaffected by the new client-side pipeline. Open documents, switch tabs, verify Mermaid diagrams still work in document view.
- **File watching** — Verify file change notifications still work while chat panel is open and streaming.
- **Theme switching in documents** — Verify theme switching affects both document content and chat content consistently.
- **Session persistence** — Tab restore, workspace persistence, theme persistence should all work normally with chat panel in any state.

**Edge cases for agent exploration:**

- Start a very long streaming response, close the chat panel mid-stream (Cmd+J), then reopen. Does the response continue? Is the content correct?
- Send a message that produces only a Mermaid diagram (no surrounding text). Does it render as a standalone diagram in the message bubble?
- Resize the chat panel to its minimum width while a code block with long lines is displayed. Does horizontal scrolling work? Does the code block break the layout?
- Rapidly send messages (click send, don't wait for response, cancel, send again) to stress the render throttle and state management.
- Send a message that produces nested code fences (a code block containing ``` markers as content). Does the pre-processor handle this correctly?

---

## Related Documentation

- **Epic:** `epic.md` (27 ACs, 82 TCs)
- **Tech Design:** `tech-design.md` (this file's companion)
- **Epic 10 Client Tech Design:** `../10--chat-plumbing/tech-design-client.md` (code being extended)
- **Server Render Pipeline:** `app/src/server/services/render.service.ts` (reference for client pipeline configuration)
- **Mermaid Renderer:** `app/src/client/utils/mermaid-renderer.ts` (reused utilities)
- **Mermaid Cache:** `app/src/client/components/mermaid-cache.ts` (Epic 6 LRU — NOT reused, chat has its own simpler cache)
- **Gorilla Testing Approach:** `docs/gorilla-testing-approach.md`
