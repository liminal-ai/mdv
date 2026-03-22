# Test Plan: Epic 3 — Mermaid and Rich Content

**Parent:** [tech-design.md](tech-design.md)
**Companion:** [tech-design-api.md](tech-design-api.md) · [tech-design-ui.md](tech-design-ui.md)

This document maps every TC from the epic to a test, defines the mock strategy, lists test fixtures, specifies verification scripts, and breaks work into chunks with test counts.

---

## Mock Strategy

### Server Tests

Same pattern as Epics 1-2: test at the route handler level using Fastify's `inject()`. The rendering pipeline (markdown-it + Shiki + DOMPurify) runs for real — NOT mocked. This is critical: Shiki's integration as a markdown-it plugin is exactly what we're testing. Mocking it would hide the integration we care about.

| Layer | Mock? | Why |
|-------|-------|-----|
| Route handlers (`server/routes/file.ts`) | **Test here** | Entry point — tests full request/response cycle |
| Render service (markdown-it + Shiki + DOMPurify) | **Don't mock** | In-process pipeline — this IS what we're testing |
| `node:fs/promises` | **Mock** | External boundary — filesystem |
| Zod schemas | Don't mock | Part of the validation pipeline |

**Exception — TC-3.5a/b (Shiki failure fallback):** These two tests are the only cases where the render pipeline is partially mocked. To test the try-catch fallback around the Shiki fence renderer, we replace the Shiki-installed `md.renderer.rules.fence` with a mock that throws. This verifies the belt-and-suspenders wrapper falls back to the default renderer. The exception is scoped: only the fence renderer rule is replaced, not the entire pipeline.

Server test setup uses the existing `withRenderedFile()` helper from Epic 2:

```typescript
import { buildApp } from '../../src/server/app.js';
import { vi } from 'vitest';

// Mock filesystem
vi.mock('node:fs/promises');
vi.mock('node:fs');

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildApp({ sessionDir: '/tmp/test-session' });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// withRenderedFile() helper: mocks fs, injects GET /api/file, parses HTML with JSDOM
// Already exists from Epic 2 — Epic 3 tests use the same helper,
// assertions change from <pre><code> to Shiki token spans
```

Note: `RenderService.create()` is now async (Shiki initialization), but `buildApp()` already awaits plugin registration, so the test setup is unchanged — the async creation happens inside `buildApp()`.

### Client Tests

JSDOM + mocked Mermaid API. Mermaid.js cannot run in JSDOM (needs real browser SVG rendering), so the `mermaid` module is mocked at the import boundary. The mock returns controlled SVG strings or throws controlled errors.

| Layer | Mock? | Why |
|-------|-------|-----|
| `mermaid-renderer.ts` | **Test here** | Entry point for client-side Mermaid rendering |
| `mermaid` (npm package) | **Mock** | External boundary — cannot render in JSDOM, needs real browser DOM |
| DOM / JSDOM | Don't mock | That's what we're testing (placeholder replacement, SVG insertion) |
| `client/state.ts` | Don't mock | Exercised through the renderer for warning state updates |

```typescript
// Mock setup for mermaid-renderer tests
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}));

import mermaid from 'mermaid';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: render succeeds with a simple SVG
  vi.mocked(mermaid.render).mockResolvedValue({
    svg: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>',
  });
});

afterEach(() => {
  // Clean up DOM between tests
  document.body.innerHTML = '';
  delete document.documentElement.dataset.theme;
});
```

**What mocking Mermaid means for certain TCs:**

- **TC-1.6a/b (click directives stripped, no hover interactivity):** Since Mermaid is mocked, we cannot verify that `securityLevel: 'strict'` actually strips click handlers from the SVG output. These tests verify our side of the contract: that we pass `securityLevel: 'strict'` to `mermaid.initialize()` and that our rendering code does not add interactive elements. The actual sanitization by Mermaid.js is verified via manual testing (checklist item 14). The test assertions check `mermaid.initialize` was called with `{ securityLevel: 'strict' }`.

- **TC-2.3b (rendering timeout):** The mock returns a promise that never resolves. To avoid actually waiting 5 seconds, the test uses `vi.useFakeTimers()` to advance time past the 5-second threshold:

```typescript
test('TC-2.3b: rendering timeout triggers fallback', async () => {
  vi.useFakeTimers();
  vi.mocked(mermaid.render).mockReturnValue(new Promise(() => {})); // never resolves

  const container = createMarkdownBodyWithPlaceholders([flowchartMermaid]);
  const renderPromise = renderMermaidBlocks(container);

  await vi.advanceTimersByTimeAsync(5_001);
  const result = await renderPromise;

  expect(container.querySelector('.mermaid-error')).not.toBeNull();
  expect(result.warnings[0].message).toContain('timed out');
  vi.useRealTimers();
});
```

For theme switch tests, the test manipulates `document.documentElement.dataset.theme` directly and verifies that the mermaid renderer re-calls `mermaid.initialize` with the correct theme and `mermaid.render` for each diagram.

---

## Test Fixtures

### `tests/fixtures/mermaid-samples.ts`

```typescript
// Valid diagrams — one per guaranteed baseline type (AC-1.1)
export const flowchartMermaid = `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Do something]
  B -->|No| D[Do something else]
  C --> E[End]
  D --> E`;

export const sequenceMermaid = `sequenceDiagram
  participant Alice
  participant Bob
  Alice->>Bob: Hello Bob
  Bob-->>Alice: Hi Alice
  Alice->>Bob: How are you?
  Bob-->>Alice: Good thanks`;

export const classMermaid = `classDiagram
  class Animal {
    +String name
    +int age
    +makeSound() void
  }
  class Dog {
    +fetch() void
  }
  Animal <|-- Dog`;

export const stateMermaid = `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing : submit
  Processing --> Done : complete
  Processing --> Error : fail
  Error --> Idle : retry
  Done --> [*]`;

export const ganttMermaid = `gantt
  title Project Timeline
  dateFormat YYYY-MM-DD
  section Phase 1
  Design    :a1, 2026-01-01, 30d
  Develop   :a2, after a1, 60d
  section Phase 2
  Testing   :b1, after a2, 20d`;

export const erMermaid = `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE-ITEM : contains
  CUSTOMER {
    string name
    string email
  }
  ORDER {
    int id
    date created
  }`;

export const pieMermaid = `pie title Browser Market Share
  "Chrome" : 65
  "Firefox" : 12
  "Safari" : 10
  "Edge" : 8
  "Other" : 5`;

export const mindmapMermaid = `mindmap
  root((Project))
    Design
      UI
      UX
    Engineering
      Frontend
      Backend
    Testing
      Unit
      Integration`;

// Error cases
export const invalidSyntaxMermaid = `graph TD
  A --> B -->`;  // dangling arrow

export const emptyMermaid = '';
export const whitespaceOnlyMermaid = '   \n  \n  ';

export const unknownTypeMermaid = `unknownDiagramType
  node1 --> node2`;

export const clickDirectiveMermaid = `graph TD
  A[Click me] --> B[Target]
  click A "https://example.com"
  click B callback`;

// Complex / stress test
export const complexFlowchartMermaid = Array.from({ length: 50 }, (_, i) =>
  `  N${i} --> N${i + 1}`
).join('\n').replace(/^/, 'graph TD\n');

// Multiple diagrams in one markdown document
export const multiDiagramMarkdown = `
# Architecture

\`\`\`mermaid
${flowchartMermaid}
\`\`\`

Some text between diagrams.

\`\`\`mermaid
${sequenceMermaid}
\`\`\`

## Data Model

\`\`\`mermaid
${erMermaid}
\`\`\`
`;

// Mixed content: mermaid + code + images + headings
export const mixedContentMarkdown = `
# Overview

\`\`\`mermaid
${flowchartMermaid}
\`\`\`

## Code Example

\`\`\`typescript
const x: number = 42;
\`\`\`

![diagram](./images/arch.png)

\`\`\`mermaid
${invalidSyntaxMermaid}
\`\`\`

## Summary

Regular paragraph text.
`;
```

### `tests/fixtures/markdown-samples.ts` (additions)

```typescript
// Code blocks for each of the 17 guaranteed baseline languages (AC-3.2a)
export const highlightingSamples: Record<string, string> = {
  javascript: '```javascript\nconst x = 42;\nconsole.log(x);\n```',
  typescript: '```typescript\nconst x: number = 42;\ninterface Foo { bar: string; }\n```',
  python: '```python\ndef hello(name: str) -> str:\n    return f"Hello {name}"\n```',
  go: '```go\nfunc main() {\n    fmt.Println("Hello")\n}\n```',
  rust: '```rust\nfn main() {\n    println!("Hello");\n}\n```',
  java: '```java\npublic class Main {\n    public static void main(String[] args) {}\n}\n```',
  c: '```c\n#include <stdio.h>\nint main() { return 0; }\n```',
  cpp: '```cpp\n#include <iostream>\nint main() { std::cout << "Hi"; }\n```',
  sql: '```sql\nSELECT id, name FROM users WHERE active = true;\n```',
  yaml: '```yaml\nname: test\nversion: 1.0\nitems:\n  - one\n  - two\n```',
  json: '```json\n{ "name": "test", "version": 1 }\n```',
  bash: '```bash\n#!/bin/bash\necho "Hello $USER"\nfor f in *.md; do echo "$f"; done\n```',
  html: '```html\n<div class="container"><p>Hello</p></div>\n```',
  css: '```css\n.container { display: flex; color: var(--primary); }\n```',
  markdown: '```markdown\n# Heading\n\n**bold** and *italic*\n```',
  toml: '```toml\n[package]\nname = "my-app"\nversion = "0.1.0"\n```',
  dockerfile: '```dockerfile\nFROM node:24-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install\n```',
};

// Alias samples (AC-3.2b)
export const aliasSamples: Record<string, string> = {
  js: '```js\nconst x = 1;\n```',
  ts: '```ts\nconst x: number = 1;\n```',
  py: '```py\nx = 1\n```',
  sh: '```sh\necho "hello"\n```',
  yml: '```yml\nkey: value\n```',
};

// Fallback cases (AC-3.3)
export const noLanguageCodeBlock = '```\nplain text without language tag\n```';
export const unknownLanguageCodeBlock = '```brainfuck\n++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.\n```';
export const indentedCodeBlock = '    indented code block\n    no language tag possible';

// Large code block (TC-3.1d)
export const largeCodeBlock = '```typescript\n' +
  Array.from({ length: 3000 }, (_, i) => `const line${i} = ${i};`).join('\n') +
  '\n```';

// Tables with complex content (AC-4.1–4.3)
export const tableWithFormattingMarkdown = `
| Feature | Status | Notes |
|---------|--------|-------|
| **Bold** | *italic* | ~~struck~~ |
| \`code\` | [link](https://example.com) | normal |
`;

export const wideTableMarkdown = `
| ${Array.from({ length: 15 }, (_, i) => `Col${i + 1}`).join(' | ')} |
| ${Array.from({ length: 15 }, () => '---').join(' | ')} |
| ${Array.from({ length: 15 }, (_, i) => `data-${i + 1}`).join(' | ')} |
`;

export const tableWithListAttemptMarkdown = `
| Feature | Items |
|---------|-------|
| Lists | - item 1 - item 2 |
`;

export const htmlTableWithBlockContent = `
<table>
<tr><th>Feature</th><th>Details</th></tr>
<tr>
<td>Items</td>
<td>
<ul>
<li>First item</li>
<li>Second item</li>
</ul>
</td>
</tr>
</table>
`;

export const tableWithEscapedPipes = `
| Expression | Result |
|------------|--------|
| a \\| b | union |
| \`x \\| y\` | code with pipe |
`;
```

### Test Utilities

#### `tests/utils/mermaid-dom.ts`

Creates DOM containers with mermaid placeholders matching the server's output format, for client-side renderer tests.

```typescript
export function createPlaceholderHtml(source: string): string {
  const escaped = source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<div class="mermaid-placeholder">` +
    `<div class="mermaid-placeholder__label">Mermaid diagram (rendering available in a future update)</div>` +
    `<pre><code class="language-mermaid">${escaped}</code></pre>` +
    `</div>`;
}

export function createMarkdownBodyWithPlaceholders(sources: string[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'markdown-body';
  container.innerHTML = sources.map(createPlaceholderHtml).join('\n<p>Paragraph between diagrams.</p>\n');
  document.body.appendChild(container);
  return container;
}

export function setTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
}

export function cleanupDom(): void {
  document.body.innerHTML = '';
  delete document.documentElement.dataset.theme;
}
```

---

## TC → Test Mapping

### Server Tests

#### `tests/server/routes/file.render.test.ts` (modifications)

New tests added to the existing render test file. Uses the `withRenderedFile()` helper from Epic 2.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-3.1a | JavaScript code block has syntax highlighting | Mock fs → JS code block | HTML contains Shiki token spans with `--shiki-light`/`--shiki-dark` vars |
| TC-3.1b | Multiple languages highlighted correctly | Mock fs → TS + Python + YAML blocks | Each block has language-appropriate tokens |
| TC-3.1c | Highlighting preserves text content | Mock fs → code block with specific text | Text content unchanged, only styling added |
| TC-3.1d | Large code block (3000+ lines) highlights | Mock fs → `largeCodeBlock` fixture | Renders within timeout, has token spans |
| TC-3.2a | All 17 baseline languages highlight | Mock fs → each entry in `highlightingSamples` | Each produces `<pre class="shiki">` output (not plain `<pre><code>`) |
| TC-3.2b | Language aliases resolve correctly | Mock fs → each entry in `aliasSamples` | Each highlights as the full language |
| TC-3.3a | No language tag → plain monospace | Mock fs → `noLanguageCodeBlock` | Output is `<pre><code>` without `.shiki` class |
| TC-3.3b | Unrecognized language → plain monospace | Mock fs → `unknownLanguageCodeBlock` | Output is `<pre><code>` without `.shiki` class, no error |
| TC-3.3c | Indented code blocks → plain monospace | Mock fs → `indentedCodeBlock` | Output is `<pre><code>` without `.shiki` class |
| TC-3.4a | Light theme colors present in output | Default render of JS block | Token spans contain `--shiki-light` CSS variables |
| TC-3.4b | Dark theme colors present in output | Default render of JS block | Token spans contain `--shiki-dark` CSS variables |
| TC-3.5a | Highlighting engine error → fallback to monospace | Replace `md.renderer.rules.fence` with throwing mock | Code block renders as plain `<pre><code>`, no warning in response |
| TC-3.5b | Grammar fails to load → fallback to monospace | Replace `md.renderer.rules.fence` with throwing mock | Code block renders as plain `<pre><code>`, no warning in response |
| — | **Non-TC: Mermaid blocks are NOT highlighted by Shiki** | Mock fs → mermaid code block | Mermaid blocks have `.mermaid-placeholder` wrapper, not `.shiki` class |
| TC-5.2b | Code block language changed on re-render | Mock fs → JS block, then mock fs → Python block | First render has JS tokens, second has Python tokens |
| — | **Non-TC: Shiki `defaultColor: false` produces CSS variable output** | Default render of JS block | No inline `color:` property on spans, only `--shiki-*` CSS variables in `style` |
| — | **Non-TC: Mermaid source is HTML-escaped in placeholder** | Mock fs → mermaid with `<div>` in source | `<code>` content has `&lt;div&gt;` not raw `<div>` |
| — | **Non-TC: Code block with empty content** | Mock fs → empty fenced block ` ```\n``` ` | Renders without error |

**Test count: 18** (14 TC-mapped + 4 non-TC)

#### `tests/server/routes/file.render-tables.test.ts` (new)

Rich table content tests, exercised through the render pipeline via `withRenderedFile()`.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-4.1a | Inline formatting in table cells | Mock fs → `tableWithFormattingMarkdown` | `<td>` cells contain `<strong>`, `<em>`, `<code>` |
| TC-4.1b | Links in table cells | Mock fs → table with `[link](url)` in cell | `<td>` cells contain `<a href="...">` |
| TC-4.1c | Code spans in table cells | Mock fs → table with backtick code in cell | `<td>` cells contain `<code>` elements |
| TC-4.2a | Mixed content widths render | Mock fs → table with short + long cells | Table renders with all columns; no zero-width columns |
| TC-4.2b | Many columns with complex content | Mock fs → `wideTableMarkdown` (15 cols) | All 15 `<th>` and `<td>` elements present |
| TC-4.3a | List syntax in table cell | Mock fs → `tableWithListAttemptMarkdown` | Cell content is literal text (no `<ul>` or `<li>`); table structure intact |
| TC-4.3b | HTML table with block content | Mock fs → `htmlTableWithBlockContent` | `<table>` contains `<ul><li>` inside `<td>` (HTML pass-through) |
| TC-4.3c | Pipe characters in cell content | Mock fs → `tableWithEscapedPipes` | Pipe renders as cell content, not as column separator; correct column count |
| — | **Non-TC: Table with highlighted code spans** | Mock fs → table with `` `code` `` in cell | `<code>` in cell renders (inline code is not Shiki-highlighted — expected) |
| — | **Non-TC: Wide table with highlighted code** | Mock fs → wide table + code cells | Table has `overflow-x: auto` in HTML structure; code renders within cells |

**Test count: 10** (8 TC-mapped + 2 non-TC)

### Client Tests

#### `tests/client/utils/mermaid-renderer.test.ts` (new)

All mermaid rendering tests. Mermaid API is mocked. DOM assertions verify placeholder replacement, error fallbacks, and warning collection.

Note on test count: TC-1.1c through TC-1.1h (6 diagram types) are implemented as a single parameterized `it.each` test. The TC coverage is 6 TCs, the test function count is 1. The counts below list test functions (what you'd see in the test runner), not TC count.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.1a | Flowchart diagram renders as SVG | Create placeholder with `flowchartMermaid`, mock render → SVG | `.mermaid-placeholder` removed, `.mermaid-diagram` with `<svg>` present |
| TC-1.1b | Sequence diagram renders as SVG | Create placeholder with `sequenceMermaid`, mock render → SVG | `.mermaid-diagram` with `<svg>` present |
| TC-1.1c–h | Class, state, gantt, ER, pie, mindmap render (parameterized) | `it.each` over 6 diagram types, mock render → SVG for each | Each produces `.mermaid-diagram` with `<svg>` |
| TC-1.2a | Wide diagram scales to fit | Mock render → SVG with wide viewBox | SVG element has `max-width: 100%` and `height: auto`; no fixed `width` attribute |
| TC-1.2b | Small diagram at natural size | Mock render → SVG with small viewBox | No `min-width` or `width: 100%` applied (not upscaled) |
| TC-1.2c | Tall diagram not truncated | Mock render → SVG with tall viewBox | Container has no `overflow: hidden` or `max-height` |
| TC-1.3a | Light theme → Mermaid default theme | `setTheme('light-default')`, render | `mermaid.initialize` called with `{ theme: 'default' }` |
| TC-1.3b | Dark theme → Mermaid dark theme | `setTheme('dark-default')`, render | `mermaid.initialize` called with `{ theme: 'dark' }` |
| TC-1.3c | Theme switch re-renders diagrams | Render with light, then `setTheme('dark-default')`, trigger re-render | `mermaid.initialize` called twice (once per theme); `mermaid.render` called again |
| TC-1.4a | Multiple diagrams in one document | Create 5 placeholders, render | All 5 `.mermaid-placeholder` replaced with `.mermaid-diagram` |
| TC-1.4b | Mixed content unaffected by rendering | Create placeholders interspersed with `<p>` and `<h2>` | `<p>` and `<h2>` elements still present and unchanged after render |
| TC-1.5a | Placeholder replaced by rendered diagram | Create placeholder with valid source | `.mermaid-placeholder` no longer in DOM; `.mermaid-diagram` present in its place |
| TC-1.6a | securityLevel: 'strict' passed to Mermaid | Create placeholder with `clickDirectiveMermaid`, render | `mermaid.initialize` called with `{ securityLevel: 'strict' }` |
| TC-1.6b | No interactive elements in container | Render successful diagram | `.mermaid-diagram` has no `onclick`, `onmouseover`, or anchor elements |
| TC-2.1a | Syntax error shows error fallback | Mock render → throw Error('Parse error') | `.mermaid-error` present with `__banner` and `__source` |
| TC-2.1b | Error banner has indicator, description, and selectable source | Mock render → throw Error('Unexpected token') | Banner text contains error message; `<pre><code>` contains raw source; `user-select` not `none` |
| TC-2.1c | Partial success: 2 valid + 1 invalid | 3 placeholders, mock render: succeed, throw, succeed | 2 `.mermaid-diagram` + 1 `.mermaid-error`; order preserved |
| TC-2.1d | Empty mermaid block shows error | Create placeholder with `emptyMermaid` | `.mermaid-error` present; banner mentions "empty" |
| TC-2.2a | Warning count includes mermaid errors | 1 failed render + provide tab with 2 existing image warnings | `result.warnings` has 1 entry; merged total = 3 |
| TC-2.2b | Warning detail has type and message | Mock render → throw | Warning entry: `type === 'mermaid-error'`, `message` contains error text |
| TC-2.2c | No warnings for successful diagrams | All renders succeed | `result.warnings` is empty array |
| TC-2.3a | Document renders despite mermaid failure | 1 failed block + surrounding `<h1>`, `<p>` content | `<h1>` and `<p>` still present; failed block shows error fallback |
| TC-2.3b | Rendering timeout triggers fallback | Mock render → never-resolving promise; `vi.useFakeTimers()` | After advancing 5001ms: `.mermaid-error` present; warning message contains "timed out" |
| TC-3.4c | Theme switch updates Shiki highlighting (CSS verification) | Insert `.shiki` span with `--shiki-light` and `--shiki-dark` vars; change theme | Verify CSS rules would activate correct variable set (check computed style or class matching) |
| TC-5.1a | Multiple failure types in one document | Failed mermaid placeholder + `<div class="image-placeholder">` + plain `<pre><code>` | Mermaid shows error fallback; image placeholder unchanged; code block unchanged |
| TC-5.1b | Mermaid error in re-rendered content | First render succeeds (SVG), second render with broken source | `.mermaid-diagram` from first render replaced by `.mermaid-error` |
| TC-5.2a | New diagram in re-rendered content | First render: no placeholders; second render: one placeholder | After second render, `.mermaid-diagram` present |
| — | **Non-TC: Mermaid.initialize called with correct theme per render** | Render with `light-default`, then `dark-default` | Each call to render passes correct theme to `mermaid.initialize` |
| — | **Non-TC: Render errors don't leak to other diagrams** | 5 placeholders, 3rd throws | Positions 1,2,4,5 are `.mermaid-diagram`; position 3 is `.mermaid-error` |
| — | **Non-TC: Source truncated at 200 chars in warning** | Create placeholder with 500-char mermaid source, fail render | `warning.source.length <= 203` (200 + `'...'`) |
| — | **Non-TC: Re-render clears old mermaid warnings** | First render fails (1 warning), second render succeeds (0 warnings) | Second `result.warnings` is empty |
| — | **Non-TC: data-mermaid-source attribute preserved on success container** | Render successful diagram | `.mermaid-diagram` has `dataset.mermaidSource` matching input |

**Test functions: 32.** Breakdown: 27 individual `it()` blocks + 5 non-TC `it()` blocks. The TC-1.1c–h row is a single `it.each()` that runs 6 iterations (one per diagram type) — counted as 1 test function, covering 6 TCs.

**TC coverage from this file: 32 TCs** (19 from Flow 1 + 9 from Flow 2 + TC-3.4c + TC-5.1a + TC-5.1b + TC-5.2a). Some TCs also have server-side coverage (TC-1.5a in file.render.test.ts).

---

## Test Count Summary

| Test File | Test Functions | TC Coverage | Non-TC | Notes |
|-----------|---------------|-------------|--------|-------|
| server/routes/file.render.test.ts (additions) | 18 | 14 TCs | 4 | Includes TC-5.2b. Mermaid-not-highlighted is non-TC (Shiki exclusion concern, not TC-1.5a). |
| server/routes/file.render-tables.test.ts (new) | 10 | 8 TCs | 2 | |
| client/utils/mermaid-renderer.test.ts (new) | 32 | 32 TCs | 5 | TC-1.1c–h = 1 `it.each` (6 TCs, 1 function). Includes TC-5.1a/b, TC-5.2a. |
| **Total** | **60** | **54 unique TCs** | **11** | TC-4.2c manual-only. TC-1.5a tested in client file only (server-side mermaid exclusion test is non-TC). |

Note: "Test Functions" is what the test runner reports. "TC Coverage" is the number of distinct TCs from the epic verified by tests in that file.

### TC Coverage Verification

Cross-referenced against every TC in the epic:

| Flow | TCs in Epic | TCs Mapped to Automated Test | Notes |
|------|-------------|------------------------------|-------|
| 1. Mermaid Rendering | 19 | 19 | TC-1.1a–h, TC-1.2a–c, TC-1.3a–c, TC-1.4a–b, TC-1.5a, TC-1.6a–b. All in client tests. **TC-1.6a/b are config-verification only** (assert `securityLevel: 'strict'` is passed to `mermaid.initialize`); actual SVG output sanitization is verified manually (checklist item 14). Server tests verify the complementary concern (mermaid blocks not highlighted by Shiki) as a non-TC test. |
| 2. Mermaid Error Handling | 9 | 9 | TC-2.1a–d, TC-2.2a–c, TC-2.3a–b. TC-2.3b uses fake timers. |
| 3. Code Syntax Highlighting | 14 | 14 | TC-3.1a–d, TC-3.2a–b, TC-3.3a–c, TC-3.4a–c, TC-3.5a–b. TC-3.4c in client test. TC-3.5a/b use fence renderer mock (see exception in mock strategy). |
| 4. Rich Table Content | 9 | 8 | TC-4.1a–c, TC-4.2a–b, TC-4.3a–c. **TC-4.2c (narrow viewport)** is CSS/layout — not automatable in JSDOM. Covered by manual verification checklist item 10. |
| 5. Error Handling + File Watching | 4 | 4 | TC-5.1a–b, TC-5.2a–b. TC-5.2b in server tests, rest in client tests. |
| **Total** | **55** | **54** | TC-4.2c manual-only. TC-1.6a/b automated but config-verification-only (manual checklist verifies actual behavior). |

---

## Verification Scripts

Epic 3 uses the same script structure as Epics 1 and 2. No changes to script definitions — the commands run against the growing test suite:

```json
{
  "scripts": {
    "red-verify": "npm run format:check && npm run lint && npm run typecheck && npm run typecheck:client",
    "verify": "npm run red-verify && npm run test",
    "green-verify": "npm run verify && npm run guard:no-test-changes",
    "verify-all": "npm run verify"
  }
}
```

---

## Work Breakdown: Chunks

### Chunk 0: Infrastructure

**Scope:** New dependencies, schema extension, test fixtures, CSS files, esbuild config.

**Deliverables:**

| Deliverable | Path | Contents |
|-------------|------|----------|
| New dependencies | `app/package.json` | shiki, @shikijs/markdown-it, markdown-it-async, mermaid |
| esbuild config | `app/esbuild.config.ts` | Enable `splitting: true` and `format: 'esm'` for dynamic import / code splitting |
| Schema extension | `app/src/server/schemas/index.ts` | `'mermaid-error'` added to `RenderWarningTypeSchema` |
| Test fixtures | `app/tests/fixtures/mermaid-samples.ts` | Valid/invalid Mermaid source for each diagram type |
| Test fixtures | `app/tests/fixtures/markdown-samples.ts` | Extended with language-tagged code blocks, table fixtures |
| Test utilities | `app/tests/utils/mermaid-dom.ts` | Placeholder HTML helpers, theme setter, DOM cleanup |
| CSS | `app/src/client/styles/mermaid.css` | Mermaid SVG sizing, error fallback styling |
| CSS | `app/src/client/styles/markdown-body.css` | Shiki dual-theme CSS rules added |
| HTML | `app/src/client/index.html` | Add `mermaid.css` link tag |

**Exit criteria:** `npm run red-verify` passes. No tests yet.

**Relevant tech design sections:** Index §Stack Additions, API §Shiki Integration (CSS output), UI §Mermaid Error Fallback CSS.

---

### Chunk 1: Server — Shiki Syntax Highlighting

**Scope:** Integrate Shiki into render pipeline, handle language fallbacks, exclude mermaid from highlighting.
**ACs:** AC-3.1–3.5
**TCs:** TC-3.1a–d, TC-3.2a–b, TC-3.3a–c, TC-3.4a–b, TC-3.5a–b, TC-5.2b

**Relevant tech design sections:** Index §Q2 (Shiki choice), Index §Q6 (theme mapping), API §Shiki Integration, API §Render Pipeline Modification, Index §Module Interaction diagram.

**Non-TC decided tests:** `defaultColor: false` produces CSS variable output, mermaid source HTML-escaped, empty code block renders.

#### Skeleton

| File | Stub |
|------|------|
| (No new files — Shiki integrates into existing `render.service.ts`) | Shiki plugin registration stub that falls through to default renderer |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/server/routes/file.render.test.ts (additions) | 18 | TC-3.1a–d, TC-3.2a–b, TC-3.3a–c, TC-3.4a–b, TC-3.5a–b, TC-5.2b + 4 non-TC |

**Red exit:** `npm run red-verify` passes. 18 new tests ERROR (NotImplementedError or assertion failures). Previous 263 tests (Epic 1+2) PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `render.service.ts` | Refactor to async `RenderService.create()` factory. Add `@shikijs/markdown-it` plugin with `themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false`. Exclude `mermaid` language via transformer preprocess. Belt-and-suspenders try-catch on fence renderer for failure fallback. |

**Green exit:** `npm run green-verify` passes. All 281 tests PASS (263 + 18). No test files modified.

**Running total: 281 tests**

---

### Chunk 2: Client — Mermaid Rendering

**Scope:** Mermaid.js dynamic import, placeholder detection and rendering, error handling, warning collection, theme adaptation, timeout.
**ACs:** AC-1.1–1.6, AC-2.1–2.3, AC-5.1–5.2 (partial)
**TCs:** TC-1.1a–h, TC-1.2a–c, TC-1.3a–c, TC-1.4a–b, TC-1.5a, TC-1.6a–b, TC-2.1a–d, TC-2.2a–c, TC-2.3a–b, TC-3.4c, TC-5.1a–b, TC-5.2a

**Relevant tech design sections:** Index §Q1 (client-side rendering), Index §Q3 (theme mapping), Index §Q4 (timeout), Index §Q5 (security), Index §Q8 (re-render on theme switch), UI §Mermaid Renderer, UI §Theme Adaptation, UI §Mermaid Error Fallback.

**Non-TC decided tests:** Mermaid.initialize called with correct theme per render, render errors don't leak, source truncated at 200 chars, re-render clears old warnings, data-mermaid-source preserved.

#### Skeleton

| File | Stub |
|------|------|
| `src/client/utils/mermaid-renderer.ts` | `renderMermaidBlocks()` and `reRenderMermaidDiagrams()` that throw `NotImplementedError` |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/client/utils/mermaid-renderer.test.ts | 32 | TC-1.1a–h, TC-1.2a–c, TC-1.3a–c, TC-1.4a–b, TC-1.5a, TC-1.6a–b, TC-2.1a–d, TC-2.2a–c, TC-2.3a–b, TC-3.4c, TC-5.1a–b, TC-5.2a + 5 non-TC |

**Red exit:** `npm run red-verify` passes. 32 new tests ERROR. Previous 281 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `mermaid-renderer.ts` | Full: dynamic `import('mermaid')`, find placeholders, render each sequentially with 5s timeout, error fallback HTML, warning collection with 200-char truncation, store source as `data-mermaid-source`. Theme adaptation via `getMermaidTheme()` and `reRenderMermaidDiagrams()`. |
| `content-area.ts` | After `innerHTML = html`, call `await renderMermaidBlocks(markdownBody)`. Merge returned warnings into tab state. |
| `app.ts` | Set up MutationObserver on `data-theme` attribute → call `reRenderMermaidDiagrams()` for active tab |

**Green exit:** `npm run green-verify` passes. All 313 tests PASS. No test files modified.

**Running total: 313 tests**

---

### Chunk 3: Rich Table Stress Tests

**Scope:** Validate table rendering with complex content, highlighted code in cells, and graceful degradation.
**ACs:** AC-4.1–4.3
**TCs:** TC-4.1a–c, TC-4.2a–b, TC-4.3a–c

**Relevant tech design sections:** API §Table Rendering Notes (markdown-it baseline), Index §Spec Validation (AC-4.1 validates Epic 2 baseline).

**Non-TC decided tests:** Table with highlighted code spans, wide table with highlighted code.

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/server/routes/file.render-tables.test.ts | 10 | TC-4.1a–c, TC-4.2a–b, TC-4.3a–c + 2 non-TC |

**Red exit:** `npm run red-verify` passes. 10 new tests ERROR. Previous 313 tests PASS.

#### TDD Green

No new implementation modules. These tests validate existing behavior from Epic 2's markdown-it rendering plus the Shiki highlighting from Chunk 1. If any tests fail, fixes go into `render.service.ts` or `markdown-body.css`.

**Green exit:** `npm run green-verify` passes. All 323 tests PASS. No test files modified.

**Final total: 323 tests** (263 Epic 1+2 + 60 Epic 3)

---

## Chunk Dependencies

```
Chunk 0 (Infrastructure)
    │
    ├──────────────────┐
    ▼                  ▼
Chunk 1 (Shiki)    Chunk 2 (Mermaid)
    │
    ▼
Chunk 3 (Tables)
```

Chunks 1 and 2 can run in parallel after Chunk 0 — they modify different layers (server vs. client). Chunk 3 depends on Chunk 1 (needs Shiki to be integrated for code-in-table tests).

Note: Integration TCs (TC-5.1a/b, TC-5.2a/b) are distributed into Chunks 1 and 2 rather than being a separate chunk. TC-5.2b is in Chunk 1 (server re-render), TC-5.1a/b and TC-5.2a are in Chunk 2 (client re-render). This eliminates the need for a separate integration chunk — the integration scenarios are tested within the chunks that implement the relevant code paths.

---

## Manual Verification Checklist

After all chunks are Green:

1. [ ] Open a document with Mermaid diagrams — flowchart, sequence, class, state render as SVGs
2. [ ] Invalid Mermaid block shows error banner + raw source (selectable, copyable)
3. [ ] Warning count includes Mermaid errors; clicking shows detail panel
4. [ ] Open a document with code blocks — JavaScript, TypeScript, Python, Go highlighted with colors
5. [ ] Code block without language tag renders as plain monospace (no highlighting)
6. [ ] Code block with unknown language renders as plain monospace (no error)
7. [ ] Switch from light to dark theme — code highlighting changes instantly (no flash, no delay)
8. [ ] Switch from light to dark theme — Mermaid diagrams re-render with dark colors
9. [ ] Open a document with 5+ Mermaid diagrams — all render, UI doesn't freeze
10. [ ] Table with bold, italic, links in cells renders correctly; wide table with 15 columns scrolls horizontally (TC-4.2c)
11. [ ] HTML table with `<ul>` inside cells renders correctly
12. [ ] Modify an open file to add a Mermaid block — auto-reload renders the new diagram
13. [ ] Modify an open file to break a Mermaid block — auto-reload shows error fallback
14. [ ] Verify Mermaid `click` directives have no effect — nodes are not clickable (TC-1.6a, TC-1.6b)
15. [ ] All 4 themes: code highlighting and Mermaid diagrams look correct in each
