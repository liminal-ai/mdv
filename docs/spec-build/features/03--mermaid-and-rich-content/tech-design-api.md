# Technical Design: Epic 3 — API (Server)

**Parent:** [tech-design.md](tech-design.md)
**Companion:** [tech-design-ui.md](tech-design-ui.md)

This document covers the server-side changes for Epic 3: Shiki syntax highlighting integration into the markdown-it rendering pipeline, RenderWarning schema extension, and mermaid placeholder evolution. The server-side changes are focused and surgical — Shiki replaces the default code fence renderer, and the mermaid placeholder carries through unchanged for client-side rendering.

---

## Shiki Integration: `server/services/render.service.ts`

### Plugin Architecture

Shiki integrates as a markdown-it plugin via `@shikijs/markdown-it`. This plugin replaces markdown-it's default fenced code block renderer. When markdown-it encounters a fenced code block with a language tag, Shiki tokenizes the content using TextMate grammars and produces HTML with CSS-variable-based coloring.

The key design decision is how Shiki handles the `mermaid` language. Mermaid code blocks must NOT be highlighted — they need to pass through to the `processMermaidBlocks()` post-processing step that wraps them in `.mermaid-placeholder` containers. The Shiki plugin is configured to skip `mermaid` by excluding it from its language list.

### Shiki Initialization

Shiki's highlighter is created once during server startup and reused across renders. The highlighter pre-loads grammars and themes, so creation is expensive (~200ms) but subsequent renders are fast.

```typescript
import { createHighlighter } from 'shiki';
import markdownItShiki from '@shikijs/markdown-it';

// Created once during app startup (async — Shiki loads WASM + grammars)
const highlighter = await createHighlighter({
  themes: ['github-light', 'github-dark'],
  langs: [
    'javascript', 'typescript', 'python', 'go', 'rust', 'java',
    'c', 'cpp', 'sql', 'yaml', 'json', 'bash', 'html', 'css',
    'markdown', 'toml', 'dockerfile',
  ],
});

// Note: @shikijs/markdown-it requires markdown-it-async@^2.2.0 as a peer dependency.
// The plugin factory is async: md.use(await markdownItShiki({ ... }))
// This means the createRenderer() function must be async (called once during app setup).
```

The language list is the guaranteed baseline from the epic (17 languages). Shiki bundles 200+ grammars but we pre-load only the 17 contracted languages. Additional languages can be loaded on-demand via `highlighter.loadLanguage()` if needed — but for v1, unrecognized languages fall back to plain monospace.

**Language aliases (TC-3.2b):** Shiki automatically registers common aliases when a language is loaded. Loading `'javascript'` also registers `'js'` and `'jsx'`; loading `'typescript'` also registers `'ts'` and `'tsx'`; loading `'python'` registers `'py'`; loading `'bash'` registers `'sh'` and `'shell'`; loading `'yaml'` registers `'yml'`. This is standard Shiki behavior documented in their grammar registry — each TextMate grammar file declares its own aliases. The epic's baseline aliases (`js`, `ts`, `py`, `sh`, `yml`) are all covered by loading the full language names above. No additional configuration is needed.

### markdown-it Plugin Registration

```typescript
// createRenderer is now async because the Shiki plugin factory is async
async function createRenderer(slugger: GithubSlugger): Promise<MarkdownIt> {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
  });

  // Shiki plugin — replaces default fenced code block renderer
  // The plugin factory is async (loads WASM grammar engine)
  md.use(await markdownItShiki({
    highlighter,
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    defaultColor: false,  // All colors as CSS variables — no inline color styles
    fallbackLanguage: undefined,  // Unknown languages → no highlighting (plain text)
  }));

  md.use(markdownItTaskLists, { enabled: false, label: true });
  md.use(markdownItAnchor, { slugify: (s: string) => slugger.slug(s) });

  return md;
}
```

**Plugin order matters.** Shiki must be registered before markdown-it-anchor — Shiki replaces the code fence renderer, and anchor processes headings. They operate on different elements and don't conflict, but the convention is to register content-transforming plugins before structural plugins.

**Async initialization impact.** `createRenderer()` becoming async cascades to `RenderService` — the constructor can no longer call it directly. The service must expose a static async factory method:

```typescript
export class RenderService {
  private constructor(private md: MarkdownIt, private slugger: GithubSlugger) {}

  static async create(): Promise<RenderService> {
    const slugger = new GithubSlugger();
    const md = await createRenderer(slugger);
    return new RenderService(md, slugger);
  }

  render(content: string, documentPath: string): RenderResult { /* unchanged */ }
}
```

The `buildApp()` factory in `server/app.ts` already uses `await` for plugin registration, so awaiting `RenderService.create()` during app setup is natural. The render method itself remains synchronous — only initialization is async.

### Mermaid Exclusion

The **primary mechanism** for mermaid exclusion is an explicit skip in the Shiki transformer. This is authoritative — it ensures mermaid blocks are never processed by Shiki regardless of how the library's fallback behavior evolves:

As background context: Shiki currently falls through to the default renderer for unrecognized languages, so mermaid would also be excluded implicitly (since `mermaid` is not in our language list). But relying on implicit fallback behavior is fragile — a future Shiki version might apply default theming to unknown languages. The explicit transformer skip removes this dependency:

```typescript
md.use(markdownItShiki, {
  highlighter,
  themes: { light: 'github-light', dark: 'github-dark' },
  defaultColor: false,
  // Explicitly skip mermaid — it's handled by processMermaidBlocks()
  transformers: [{
    preprocess(code, options) {
      if (options.lang === 'mermaid') return undefined; // Skip — fall through to default renderer
      return code;
    },
  }],
});
```

### Shiki Output Format

With `defaultColor: false`, Shiki produces HTML like:

```html
<pre class="shiki" style="background-color:var(--shiki-light-bg);--shiki-dark-bg:#24292e" tabindex="0">
  <code>
    <span class="line">
      <span style="--shiki-light:#D73A49;--shiki-dark:#F97583">const</span>
      <span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> x</span>
      <span style="--shiki-light:#D73A49;--shiki-dark:#F97583">:</span>
      <span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> number</span>
      <span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> =</span>
      <span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> 42</span>
      <span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">;</span>
    </span>
  </code>
</pre>
```

Each token gets both `--shiki-light` and `--shiki-dark` CSS variables. The CSS in `markdown-body.css` activates the appropriate set based on the `data-theme` attribute. No inline `color:` property is set (that's what `defaultColor: false` does).

The `<pre class="shiki">` wrapper class distinguishes highlighted code blocks from non-highlighted ones (no language tag, unknown language, indented code). This is useful for CSS styling — `.shiki` blocks get different treatment than plain `<pre><code>` blocks.

### Highlighting Failure Handling (AC-3.5)

Shiki can fail on specific inputs — malformed source that crashes the tokenizer, or a grammar that fails to load at runtime. The plugin handles this gracefully:

```typescript
transformers: [{
  preprocess(code, options) {
    if (options.lang === 'mermaid') return undefined;
    return code;
  },
  postprocess(html, options) {
    // If we get here, highlighting succeeded
    return html;
  },
}],
```

If Shiki throws during rendering, the markdown-it plugin catches the error and falls back to the default code fence renderer — producing a plain `<pre><code>` block. No warning is surfaced. Per the epic: "Syntax highlighting failures fall back to monospace without warnings" (AC-3.5). The content is still readable, just not highlighted.

To ensure this fallback works, the Shiki plugin registration wraps the highlighting call in a try-catch at the plugin level. If the try-catch isn't built into `@shikijs/markdown-it`, we wrap it ourselves:

```typescript
// Defensive wrapper around Shiki's markdown-it plugin
const originalFence = md.renderer.rules.fence;
md.use(markdownItShiki, { /* config */ });
const shikiFence = md.renderer.rules.fence;

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  try {
    return shikiFence!(tokens, idx, options, env, self);
  } catch {
    // Shiki failed — fall back to default renderer
    return originalFence
      ? originalFence(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  }
};
```

This is belt-and-suspenders: the `@shikijs/markdown-it` plugin likely handles errors internally, but we ensure the fallback regardless.

**AC Coverage:** AC-3.5a (engine error → fallback), AC-3.5b (grammar load failure → fallback).

---

## Render Pipeline Modification

The render pipeline from Epic 2 changes in one step — Shiki is added as a markdown-it plugin. The pipeline sequence remains the same:

### Epic 2 Pipeline (before)

```
1. markdown-it.render(content)        ← Produces plain <pre><code> for code blocks
2. processMermaidBlocks(html)         ← Wraps mermaid blocks in placeholder
3. processImages(html, documentDir)   ← Rewrites image URLs, adds warnings
4. DOMPurify.sanitize(html)           ← Strips dangerous content
→ { html, warnings }
```

### Epic 3 Pipeline (after)

```
1. markdown-it.render(content)        ← Shiki plugin produces highlighted <pre class="shiki"><code>
                                         Mermaid blocks pass through (not highlighted)
2. processMermaidBlocks(html)         ← Wraps mermaid blocks in placeholder (unchanged)
3. processImages(html, documentDir)   ← Rewrites image URLs, adds warnings (unchanged)
4. DOMPurify.sanitize(html)           ← Strips dangerous content (unchanged)
→ { html, warnings }
```

The only change is inside step 1 — Shiki's plugin replaces the default code fence renderer. Steps 2-4 are unchanged. The `RenderService.render()` method signature and return type are unchanged. The `FileReadResponse` type is unchanged.

### DOMPurify Compatibility

Shiki's output uses inline `style` attributes with CSS custom properties (`--shiki-light:#D73A49`). DOMPurify by default allows `style` attributes on all elements, so Shiki's output survives sanitization without configuration changes.

The `<pre class="shiki" tabindex="0">` attribute also survives — DOMPurify allows `class` and `tabindex` by default.

No DOMPurify configuration changes needed.

---

## Schema Extension

### RenderWarningTypeSchema

The `RenderWarningTypeSchema` in `server/schemas/index.ts` gains `'mermaid-error'`:

```typescript
export const RenderWarningTypeSchema = z.enum([
  'missing-image',
  'remote-image-blocked',
  'unsupported-format',
  'mermaid-error',          // NEW: Epic 3
]);
```

This is the only schema change. The `RenderWarningSchema` shape is unchanged — `type`, `source`, `line`, `message` fields all apply to mermaid errors:

- `type`: `'mermaid-error'`
- `source`: The raw mermaid source text (truncated to 200 chars if longer)
- `line`: Line number in the source markdown where the code fence starts (if available from markdown-it token position)
- `message`: The error message from Mermaid.js (e.g., "Parse error on line 3: ...")

Note: Mermaid warnings are collected **client-side** (by the mermaid renderer), not server-side. The server doesn't attempt to render Mermaid — it produces placeholders. The schema extension is needed so the type system recognizes `'mermaid-error'` as a valid warning type when the client adds it to `TabState.warnings`.

---

## Table Rendering Notes

Epic 3's table ACs (AC-4.1 through AC-4.3) are primarily about validating and stress-testing the rendering that Epic 2's markdown-it baseline already provides. No changes to the rendering pipeline are needed for tables — the tests verify existing behavior and identify any CSS gaps.

### What markdown-it Already Handles

markdown-it's table parser (built-in, no plugin needed) handles:
- Standard GFM pipe tables with headers
- Column alignment (`:---`, `:---:`, `---:`)
- Inline formatting within cells (bold, italic, code, links, strikethrough)
- Escaped pipe characters within cells (`\|`)

### What Requires CSS Attention

- **Wide tables** (AC-4.2b, TC-4.2c): Already handled by Epic 2's `table { display: block; overflow-x: auto; }` CSS. Verify with 15+ columns.
- **Mixed content widths** (TC-4.2a): Browser table layout handles this. No CSS changes expected.
- **Highlighted code spans in table cells**: Shiki highlights inline code spans (backtick code) only if markdown-it produces them as separate tokens. In practice, inline code in table cells produces `<code>` elements which Shiki's markdown-it plugin may not process (Shiki's plugin targets fenced code blocks, not inline code spans). Inline code spans remain unhighlighted (monospace with background) — this is correct behavior.

### What Can't Work (by design)

- **Block content in pipe tables** (AC-4.3a): markdown-it's table parser is line-based. `- item 1 - item 2` in a cell renders as literal text. This is a parser limitation, not a bug. The epic's Amendment 1 documents this.
- **HTML tables with block content** (AC-4.3b): These render via Epic 2's `html: true` configuration + DOMPurify. Already works — just verify.

---

## Self-Review Checklist (API)

- [x] Shiki integration is a markdown-it plugin — minimal code change to render.service.ts
- [x] Mermaid exclusion is explicit (skip in transformer) not implicit (unlisted language)
- [x] Shiki output format documented with `defaultColor: false` CSS variable mode
- [x] DOMPurify compatibility verified — Shiki's style attributes survive sanitization
- [x] Highlighting failure fallback is belt-and-suspenders (wrapped try-catch)
- [x] RenderWarningTypeSchema extended with 'mermaid-error'
- [x] Mermaid warnings are client-side, not server-side — schema extension is for type compatibility
- [x] Pipeline modification is surgical — only step 1 changes, steps 2-4 unchanged
- [x] Table rendering notes clarify what's existing behavior vs. what needs CSS verification
- [x] No new endpoints, no new routes, no new services
