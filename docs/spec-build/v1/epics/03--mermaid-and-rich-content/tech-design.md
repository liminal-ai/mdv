# Technical Design: Epic 3 — Mermaid and Rich Content

## Purpose

This document is the index and decision record for Epic 3's technical design. It establishes the rendering architecture for Mermaid diagrams and syntax highlighting, records all dependency and design decisions (grounded in March 2026 web research), answers the epic's 8 tech design questions, and maps modules to their companion design documents.

The detailed design is split across three companion documents:

| Document | Scope |
|----------|-------|
| [tech-design-api.md](tech-design-api.md) | Server: Shiki integration into render pipeline, RenderWarning extension, mermaid placeholder evolution |
| [tech-design-ui.md](tech-design-ui.md) | Client: Mermaid.js rendering, theme adaptation, error handling, content post-processing pipeline |
| [test-plan.md](test-plan.md) | TC→test mapping, mock strategy, test fixtures, verification scripts, chunk breakdown with test counts |

**Prerequisite:** Epic 2 complete (markdown rendering pipeline, warning infrastructure, file watching, content toolbar with warning count). Epic 3 spec (`epic.md`) is complete with 19 ACs and 55 TCs.

---

## Spec Validation

Before designing, the epic was validated as the downstream consumer. All ACs map to implementation work. The following issues were identified and resolved:

| Issue | Spec Location | Resolution | Status |
|-------|---------------|------------|--------|
| A6 says rendering extends "client-side pipeline" but Epic 2 deviated to server-side rendering | A6, Key Constraint | Hybrid: syntax highlighting integrates server-side (Shiki as markdown-it plugin), Mermaid renders client-side (needs browser DOM). A6 is directionally correct for Mermaid. | Resolved — clarified |
| Mermaid rendering location not decided | Q1 | Client-side for viewing (browser DOM required). Epic 4 export handles server-side separately. | Resolved |
| FileReadResponse "no changes" claim | Data Contracts | Correct for the response shape. Server-side Shiki replaces monospace code blocks with highlighted HTML — the `html` field changes in content but not in type. Mermaid warnings added client-side to `TabState.warnings`, not to server response. | Resolved — confirmed |
| "No new endpoints" claim | API Surface | Confirmed correct. Shiki integrates into existing render pipeline. Mermaid is purely client-side. | Resolved — confirmed |
| RenderWarning `source` truncation at 200 chars | Data Contracts | Good practice — Mermaid source can be very long. Implemented in the client-side warning collection. | Resolved — confirmed |
| Table AC-4.1 describes inline formatting that already works in Epic 2 | AC-4.1 | Correct — AC-4.1 validates Epic 2 baseline behavior. AC-4.2 and AC-4.3 are the new stress cases. Tests for AC-4.1 confirm existing behavior isn't regressed. | Resolved — confirmed |

**Verdict:** Spec is implementation-ready. No blocking issues remain. The key architectural insight is that Epic 3 is a hybrid: syntax highlighting extends the server-side pipeline, Mermaid extends the client-side post-processing pipeline.

---

## Context

Epic 2 filled the content area — users can open markdown files, see them rendered, manage tabs, and watch files for changes. But the rendering is baseline: code blocks are monospace without syntax awareness, and Mermaid blocks show a "coming soon" placeholder. Real-world technical documents are full of architecture diagrams (Mermaid), multi-language code samples, and data-heavy tables. Without syntax highlighting and diagram rendering, the viewer falls short of daily-use quality for its target audience.

Epic 3 addresses this gap. After it ships, Mermaid code blocks render as inline SVG diagrams, code blocks have language-aware syntax highlighting, and tables with complex content handle real-world stress cases gracefully. Combined with Epics 1 and 2, this completes Milestone 2: a viewer that handles real-world technical content.

The central architectural challenge is that this epic straddles the server-client boundary established in Epic 2. Epic 2 deviated from the original spec to render all markdown server-side via markdown-it, producing finished HTML that the client displays via `innerHTML`. Epic 3 must extend this pipeline in two directions:

**Syntax highlighting goes server-side.** Shiki 4.0.2 integrates directly as a markdown-it plugin (`@shikijs/markdown-it`), replacing the default fenced code block renderer. This is the clean path — highlighting happens during the existing `md.render()` step, producing HTML with CSS-variable-based token coloring. No client-side post-processing needed. Theme adaptation uses Shiki's dual-theme CSS variable mode: both light and dark token colors are embedded in the HTML, and a CSS rule switches between them based on the `data-theme` attribute. This means theme switching updates code highlighting instantly via CSS — no re-rendering.

**Mermaid goes client-side.** Mermaid.js 11.13.0 requires a browser DOM to render SVGs — it manipulates DOM nodes, measures text, and produces SVG via browser rendering APIs. Running it server-side would require jsdom or Puppeteer, adding complexity and fragility. Instead, the client post-processes the server-rendered HTML: after injecting `innerHTML`, a new `mermaid-renderer.ts` utility finds `.mermaid-placeholder` elements, extracts the raw source from the `<code>` block inside, feeds it to Mermaid.js, and replaces the placeholder with the rendered SVG (or an error fallback). This is the natural continuation of Epic 2's placeholder approach — the placeholder was always designed to be replaced.

This hybrid architecture means the rendering pipeline is now:

```
Server: markdown-it + Shiki → image post-processing → DOMPurify → HTML (with highlighted code + mermaid placeholders)
                                                                       ↓
Client: inject HTML → find mermaid placeholders → render via Mermaid.js → replace with SVG or error fallback
                                                                       ↓
                                                                   Theme switch → re-render mermaid only (code uses CSS)
```

**Mermaid bundling uses dynamic import with esbuild code splitting.** Mermaid.js is a large library (~2.83 MB minified all-in-one), but since v10 its ESM entry point is only 26 KB — diagram-specific code loads on demand via built-in `import()` calls. This is the standard pattern used by Docusaurus, VitePress, and other documentation tools. To leverage it, Epic 1's esbuild config changes from `splitting: false` to `splitting: true` with `format: 'esm'`. The client's `mermaid-renderer.ts` uses `const mermaid = (await import('mermaid')).default` — a dynamic import that triggers code splitting. The initial page load is unaffected; Mermaid chunks load only when a document with mermaid blocks is opened. This is a Chunk 0 infrastructure change.

The theme adaptation story is asymmetric by design. Shiki's dual-theme CSS variables mean code highlighting adapts to theme changes for free via CSS — no JavaScript, no re-rendering. Mermaid's SVGs embed their own styles (fill colors, stroke colors, text colors), so theme changes require re-rendering each diagram with updated Mermaid theme configuration. For typical documents (1-5 diagrams), this re-render completes in <500ms. For documents with 10+ diagrams, the user may see a brief visual update — acceptable per the NFR.

### Stack Additions for Epic 3

All packages verified via web research (March 2026). Research outputs archived in `.research/outputs/`.

| Package | Version | Purpose | Research Confirmed |
|---------|---------|---------|-------------------|
| shiki | 4.0.2 | Syntax highlighting (TextMate grammars, VS Code quality) | Yes — pure ESM, 70+ themes, dual-theme CSS vars |
| @shikijs/markdown-it | 4.0.2 | Shiki integration as markdown-it plugin | Yes — replaces default code fence renderer, async plugin factory |
| markdown-it-async | ^2.2.0 | Peer dependency of @shikijs/markdown-it | Yes — required for async markdown-it plugin support |
| mermaid | 11.13.0 | Mermaid diagram rendering (SVG output) | Yes — pure ESM, 5 built-in themes, securityLevel config, SSR issue #3650 still open (confirms client-side rendering decision). ESM entry is 26 KB with built-in lazy loading — diagram-specific code loads on demand via dynamic import. |

**Packages NOT added (considered and rejected):**

| Package | Why Rejected |
|---------|-------------|
| Prism / prismjs | CSS class-based theming requires separate theme stylesheets per app theme. Shiki's CSS variable mode handles multi-theme with zero stylesheet switching. Also, Prism is less accurate for TypeScript/Rust/Go grammars. |
| highlight.js | Similar theming limitation to Prism (separate CSS files per theme). Auto-detection is nice but not needed — language tags exist on code blocks. |
| @mermaid-js/mermaid-cli | Server-side Mermaid via Puppeteer. Heavyweight (Chromium dependency), fragile, and unnecessary for a browser-based viewer. |
| jsdom (for server Mermaid) | Mermaid's SVG rendering uses browser APIs that jsdom doesn't fully implement (SVG measurement, text rendering). Unreliable. |

---

## Tech Design Question Answers

The epic raised 8 questions for the tech lead. All are answered here; detailed implementation follows in the companion documents.

### Q1: Mermaid rendering location

**Answer:** Client-side for viewing. Server-side for export is an Epic 4 decision.

Mermaid.js requires a browser DOM to render SVGs. It manipulates DOM nodes, measures text dimensions, and produces SVG via browser rendering APIs. Running it server-side reliably would require Puppeteer (headless Chromium) — a heavyweight dependency for a local tool.

For viewing, client-side rendering is natural. The server already sends mermaid placeholders (Epic 2). The client finds these placeholders after injecting the server's HTML and replaces them with rendered SVGs. This is exactly the flow Epic 2's placeholder design anticipated.

For Epic 4 export, the export pipeline will need its own Mermaid rendering strategy — likely Puppeteer or a pre-rendered SVG cache. That's a separate tech design decision that doesn't affect viewing. The client-side SVG output from viewing cannot be directly captured for export (it exists in the browser DOM, not in a server-accessible artifact). Epic 4 will address this.

**Detailed design:** See UI companion doc, Mermaid Renderer section.

### Q2: Syntax highlighting library

**Answer:** Shiki 4.0.2, integrated as a markdown-it plugin via `@shikijs/markdown-it`.

Shiki was chosen over Prism and Highlight.js for three reasons:

1. **Theme adaptation without re-rendering.** Shiki's dual-theme CSS variable mode embeds both light and dark token colors in the HTML output. A CSS rule switches between them based on `data-theme`. Theme switching is instant via CSS — no JavaScript, no DOM manipulation, no re-rendering. Prism and Highlight.js require loading separate CSS theme files or re-highlighting on theme change.

2. **Accuracy.** Shiki uses TextMate grammars — the same tokenization engine as VS Code. TypeScript, Rust, Go, and other complex languages highlight accurately. Prism's grammars are hand-written regex and less precise for edge cases.

3. **Server-side integration.** Shiki runs natively in Node.js and has a first-party markdown-it plugin (`@shikijs/markdown-it`). It replaces the default fenced code block renderer, producing highlighted HTML during the existing `md.render()` step. No separate post-processing pass needed.

The tradeoff is bundle size — Shiki's grammars and themes add to the server-side dependency footprint. But since this runs on the server (not in the browser bundle), the size impact is on `node_modules`, not on page load. The client receives pre-highlighted HTML — no JavaScript highlighting library shipped to the browser.

**Detailed design:** See API companion doc, Shiki Integration section.

### Q3: Mermaid theme mapping

**Answer:** Map app themes to Mermaid's built-in `theme` config. Light variants → `'default'`, dark variants → `'dark'`.

Mermaid has 5 built-in themes: `default`, `neutral`, `dark`, `forest`, `base`. The app has 4 themes: `light-default`, `light-warm`, `dark-default`, `dark-cool`.

| App Theme | Mermaid Theme | Rationale |
|-----------|---------------|-----------|
| `light-default` | `default` | Standard light palette |
| `light-warm` | `default` | Warm tint is subtle; Mermaid's default works |
| `dark-default` | `dark` | Standard dark palette |
| `dark-cool` | `dark` | Cool tint is subtle; Mermaid's dark works |

Using Mermaid's built-in themes rather than `base` + `themeVariables` is simpler and more maintainable. Custom themeVariables would require mapping every CSS custom property to Mermaid's color model — complex, fragile, and low-value for v1. If fine-grained theme matching is needed later, the `base` theme + `themeVariables` path exists as an upgrade.

Theme detection is straightforward: read `document.documentElement.dataset.theme`, check if it starts with `'dark'`, and pass `'dark'` or `'default'` to Mermaid's config.

**Detailed design:** See UI companion doc, Theme Adaptation section.

### Q4: Mermaid rendering timeout

**Answer:** `Promise.race()` with a 5-second timeout per diagram. No Web Worker. The timeout is a safety net for stuck promises, not a guarantee against UI blocking.

Each Mermaid render call is wrapped in a `Promise.race` against a timeout. If `mermaid.render()` returns a promise that never resolves (e.g., an internal deadlock), the timeout rejects after 5 seconds and the error fallback replaces the placeholder.

**Known limitation:** `Promise.race()` only fires the timeout callback when the event loop gets a turn. If `mermaid.render()` does expensive synchronous DOM layout (measuring text, computing positions) that monopolizes the main thread, the timeout cannot interrupt it — it fires only after the synchronous work completes. This means: the timeout catches genuinely stuck promises, but cannot prevent a single complex diagram from blocking the UI during its synchronous rendering phase. A Web Worker would solve this, but Mermaid requires DOM access, which Workers don't provide.

The practical impact is bounded. Mermaid's render is primarily async (it yields during D3 layout passes). Fully synchronous blocking is rare and limited to pathological diagrams (hundreds of nodes in a single graph). For the "documents with 10+ diagrams" NFR, responsiveness is achieved by the sequential rendering loop yielding between diagrams (`await` in the `for` loop), not by the per-diagram timeout. The timeout is a safety net for the stuck-promise case.

The 5-second timeout matches the NFR ("Mermaid diagrams render within 5 seconds per diagram for typical complexity"). It is not configurable — a fixed engineering constant.

**Detailed design:** See UI companion doc, Mermaid Renderer section.

### Q5: Mermaid security sandboxing

**Answer:** `securityLevel: 'strict'` in Mermaid configuration. This is the maximum security setting.

Mermaid's `securityLevel: 'strict'`:
- Strips all `click` event bindings from diagram definitions (AC-1.6a)
- Prevents JavaScript execution from diagram content
- Disables interactive features (tooltips, clickable nodes)
- Produces static SVG output only

No additional sanitization (DOMPurify) is needed for the SVG output because:
1. Mermaid's strict mode already strips dangerous content
2. The SVG is inserted into `.markdown-body` which has restrictive CSS scope
3. SVG doesn't have the same XSS surface as HTML (no script execution in inline SVG without event handlers, which strict mode strips)

**Detailed design:** See UI companion doc, Mermaid Renderer section.

### Q6: Syntax highlighting theme mapping

**Answer:** Shiki dual-theme with `github-light` (light mode) and `github-dark` (dark mode). CSS switches between them. One pair serves all 4 app themes.

Shiki's dual-theme mode embeds both color sets in the output:

```typescript
themes: {
  light: 'github-light',
  dark: 'github-dark',
},
defaultColor: false,  // All colors as CSS variables — no inline colors
```

With `defaultColor: false`, output looks like:

```html
<span style="--shiki-light:#D73A49;--shiki-dark:#F97583">const</span>
```

A CSS rule in `markdown-body.css` activates the appropriate color set:

```css
/* Light themes: use --shiki-light values */
:root .shiki span,
[data-theme^="light"] .shiki span {
  color: var(--shiki-light);
  background-color: var(--shiki-light-bg);
}

/* Dark themes: use --shiki-dark values */
[data-theme^="dark"] .shiki span {
  color: var(--shiki-dark);
  background-color: var(--shiki-dark-bg);
}
```

Using one light + one dark theme (rather than a distinct scheme per app theme) is pragmatic — the difference between `github-light` and a hypothetical `warm-light` scheme would be imperceptible against the app's themed backgrounds. The CSS variable approach means adding a per-theme scheme later requires no server-side changes — just additional CSS rules.

**Detailed design:** See API companion doc, Shiki Integration section.

### Q7: Large Mermaid diagrams

**Answer:** No special handling beyond the 5-second rendering timeout. If it renders in time, show it. If not, show the error fallback.

For very complex diagrams (100+ nodes), Mermaid may take several seconds but typically completes. The SVG output respects `max-width: 100%` and `height: auto` CSS constraints — wide diagrams scale down, tall diagrams extend the scroll area (TC-1.2c).

A pre-render size/complexity check was considered but rejected — estimating diagram complexity from source text is unreliable, and the timeout provides a safety net for stuck promises (though not for synchronous blocking — see Q4). The NFR target ("documents with 10+ Mermaid diagrams render without freezing the UI") is met by the sequential rendering loop yielding to the event loop between diagrams, not by per-diagram timeout protection.

**Detailed design:** See UI companion doc, Mermaid Renderer section.

### Q8: Code highlighting and Mermaid in re-render on theme switch

**Answer:** Syntax highlighting uses CSS (no re-render). Mermaid re-renders on theme switch.

This asymmetry is by design:

- **Shiki**: Dual-theme CSS variables are embedded in the HTML. Theme switching changes which CSS variables are active — instant, via CSS only. No JavaScript, no re-rendering, no network calls. This is why Shiki was chosen over Prism/Highlight.js.

- **Mermaid**: SVGs embed their own inline styles (fill, stroke, text colors). There's no CSS variable hook into Mermaid's SVG internals. On theme switch, the client must re-render each diagram with the new Mermaid theme config. This is the `mermaidThemeFromAppTheme()` mapping from Q3.

The client listens for theme changes via a MutationObserver on `document.documentElement`'s `data-theme` attribute. When the attribute changes:
1. Code blocks: nothing happens (CSS handles it)
2. Mermaid diagrams: all rendered diagrams are re-rendered with the new theme

For typical documents (1-5 diagrams), re-rendering completes in <500ms and is imperceptible. For documents with 10+ diagrams, the user may see a brief visual update as diagrams re-render sequentially. The NFR accepts this: "the UI must not freeze."

**Detailed design:** See UI companion doc, Theme Adaptation section.

---

## High Altitude: System View

### System Context

Epic 3 does not change the system boundary established by Epics 1 and 2. The server still serves HTML via `/api/file`, the client still displays it. What changes is *within* each process:

```
┌──────────────────────────────────────────────────────────────┐
│                        User's Machine                         │
│                                                               │
│  ┌───────────────┐   HTTP (localhost)    ┌────────────────┐  │
│  │  Browser Tab   │ ◄─────────────────► │  Fastify        │  │
│  │  (Frontend)    │   GET /api/file     │  Server         │  │
│  │                │                     │                 │  │
│  │  NEW:          │   HTML with         │  MODIFIED:      │  │
│  │  - Mermaid.js  │   highlighted code  │  - Shiki in     │  │
│  │    rendering   │   + mermaid         │    render       │  │
│  │  - Theme       │   placeholders      │    pipeline     │  │
│  │    observer    │                     │                 │  │
│  └───────────────┘                     └────────────────┘  │
│                                                               │
│  ┌───────────────┐                     ┌────────────────┐    │
│  │  Mermaid.js    │ ◄─── in-process ── │  Browser       │    │
│  │  11.13.0       │                    │  (client-side)  │    │
│  │  SVG rendering │ ── SVG output ───► │                 │    │
│  └───────────────┘                     └────────────────┘    │
│                                                               │
│  ┌───────────────┐                     ┌────────────────┐    │
│  │  Shiki 4.0.2   │ ◄─── in-process ── │  Fastify       │    │
│  │  + markdown-it │                    │  (render.       │    │
│  │  plugin        │ ── highlighted ──► │  service.ts)    │    │
│  └───────────────┘    HTML tokens      └────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

The server has no new external boundaries. Shiki runs in-process as part of the markdown-it rendering step — it's a library, not a service.

The client has one new in-process dependency: Mermaid.js. It's not a mock boundary — it runs in the browser, manipulates the DOM directly, and produces SVG output. Client tests mock the Mermaid API (similar to how Epic 2 tests mock the WebSocket API) to avoid the complexity of rendering real SVGs in JSDOM.

### Data Flow: Opening a Document with Rich Content

The flow is the same as Epic 2's file-open flow, with two new processing steps:

```
Tree Click → Client API → GET /api/file
                              → File Service (read + size check)
                              → Render Service:
                                  1. markdown-it + Shiki plugin (highlighted code)
                                  2. Mermaid placeholder wrapping (unchanged from Epic 2)
                                  3. Image post-processing (unchanged)
                                  4. DOMPurify sanitize (unchanged)
                              → FileReadResponse { html (with highlighted code + placeholders), warnings }
                         ← Response → Client State (add tab, store HTML)
                                    → DOM: inject innerHTML
                                    → NEW: mermaid-renderer.ts post-processes:
                                        Find .mermaid-placeholder → render each → replace with SVG or error
                                        Collect mermaid warnings → merge into TabState.warnings
                                    → Tab strip, toolbar, warning count update
```

### Data Flow: Theme Switch with Rich Content

```
User selects theme → api.setTheme() → server persists → client updates state
                   → document.documentElement.dataset.theme = newTheme
                   → CSS: code highlighting switches instantly (Shiki CSS vars)
                   → JS: MutationObserver fires → reRenderMermaidDiagrams()
                        → Only .mermaid-diagram containers re-rendered (successful diagrams)
                        → .mermaid-error containers left as-is (failed diagrams stay failed until file reload)
                        → If a re-render fails, old SVG is left in place (readable, wrong theme colors)
                        → Warning state is not updated on theme switch (no new warnings possible from theme change)
```

### External Contracts

**No new API endpoints.** Epic 3 uses the existing `GET /api/file` endpoint. The `FileReadResponse` type is unchanged — the `html` field now contains Shiki-highlighted code blocks instead of plain `<pre><code>` blocks, but the field type is still `string`.

**RenderWarning type extended.** The `type` enum gains `'mermaid-error'`:

```typescript
type: "missing-image" | "remote-image-blocked" | "unsupported-format" | "mermaid-error"
```

This is a backward-compatible extension. Existing warning panel code already renders warnings by type — the new type gets its own icon and label.

**No new error codes.** Mermaid and syntax highlighting errors are surfaced through the existing `RenderWarning` mechanism, not through HTTP error responses.

---

## Medium Altitude: Module Architecture

### New and Modified Modules

Epic 3 adds 4 new modules and modifies 6 existing modules:

```
app/src/
├── server/
│   ├── services/
│   │   └── render.service.ts           # MODIFIED: add Shiki plugin, adapt mermaid placeholder
│   └── schemas/
│       └── index.ts                    # MODIFIED: extend RenderWarningTypeSchema
│
└── client/
    ├── app.ts                          # MODIFIED: call mermaid renderer after content injection
    ├── state.ts                        # MODIFIED: (types only) RenderWarning type extended
    ├── components/
    │   └── content-area.ts             # MODIFIED: call post-processing after innerHTML
    ├── utils/
    │   └── mermaid-renderer.ts         # NEW: find placeholders, render Mermaid, error handling
    └── styles/
        ├── markdown-body.css           # MODIFIED: add Shiki code block styles, mermaid container styles
        └── mermaid.css                 # NEW: mermaid-specific styling (sizing, error fallback)

app/tests/
├── fixtures/
│   ├── mermaid-samples.ts             # NEW: valid/invalid Mermaid source for each diagram type
│   └── markdown-samples.ts            # MODIFIED: add samples with language tags for highlighting tests
├── server/
│   └── routes/
│       └── file.render.test.ts        # MODIFIED: add Shiki highlighting tests
└── client/
    └── utils/
        └── mermaid-renderer.test.ts   # NEW: Mermaid rendering tests (mocked Mermaid API)
```

### Module Responsibility Matrix

| Module | Layer | Responsibility | Dependencies | ACs Covered |
|--------|-------|----------------|--------------|-------------|
| `server/services/render.service.ts` | Server | Shiki plugin in markdown-it pipeline; mermaid placeholder formatting | markdown-it, @shikijs/markdown-it, shiki (in-process) | AC-3.1–3.5, AC-1.5 (placeholder carries source) |
| `server/schemas/index.ts` | Server | `RenderWarningTypeSchema` extended with `'mermaid-error'` | zod | AC-2.2 (warning type) |
| `client/utils/mermaid-renderer.ts` | Client | Find placeholders, render Mermaid diagrams, error handling, theme adaptation, timeout | mermaid (in-process, mock boundary for tests) | AC-1.1–1.6, AC-2.1–2.3 |
| `client/components/content-area.ts` | Client | Call mermaid renderer after HTML injection | mermaid-renderer | AC-1.1 (display), AC-2.1 (error display) |
| `client/app.ts` | Client | Theme observer setup for mermaid re-rendering | mermaid-renderer | AC-1.3c (theme switch) |
| `client/styles/markdown-body.css` | Client | Shiki dual-theme CSS rules, code block styling | — | AC-3.4 (theme adaptation) |
| `client/styles/mermaid.css` | Client | Mermaid SVG sizing, error fallback styling | — | AC-1.2 (sizing), AC-2.1 (error display) |

### Module Interaction: Content Rendering

```
Server Side (render.service.ts):
┌─────────────────────────────────────────────────┐
│  markdown-it.render(content)                     │
│    ├── @shikijs/markdown-it plugin               │
│    │   └── Replaces <pre><code class="lang-X">   │
│    │       with Shiki-highlighted HTML           │
│    ├── markdown-it-anchor (unchanged)            │
│    └── markdown-it-task-lists (unchanged)        │
│  ↓                                               │
│  processMermaidBlocks(html) — wraps remaining     │
│  mermaid code blocks in .mermaid-placeholder     │
│  (Shiki does NOT highlight mermaid blocks —      │
│   they're excluded from highlighting)            │
│  ↓                                               │
│  processImages(html) — unchanged                 │
│  ↓                                               │
│  DOMPurify.sanitize(html) — unchanged            │
└─────────────────────────────────────────────────┘
                    ↓ HTML
Client Side:
┌─────────────────────────────────────────────────┐
│  content-area.ts: markdownBody.innerHTML = html  │
│  ↓                                               │
│  mermaid-renderer.ts:                            │
│    1. Find all .mermaid-placeholder elements     │
│    2. For each: extract source from <code>       │
│    3. Call mermaid.render(id, source)             │
│    4. On success: replace placeholder with SVG   │
│    5. On error: replace with error fallback HTML │
│    6. Collect warnings → merge into tab state    │
│  ↓                                               │
│  link-handler.ts: attach click handlers          │
│  (unchanged from Epic 2)                         │
└─────────────────────────────────────────────────┘
```

A critical ordering note: Shiki's markdown-it plugin processes code blocks *during* the `md.render()` call. It intercepts fenced code blocks and replaces the default renderer. However, Mermaid code blocks must NOT be highlighted — they need to pass through to the placeholder logic. The Shiki plugin is configured to skip the `mermaid` language, leaving those blocks for `processMermaidBlocks()` to handle.

---

## Work Breakdown Overview

The epic breaks into 4 chunks (Chunk 0 + 3 feature chunks). Each chunk goes through Skeleton → TDD Red → TDD Green phases. Integration TCs (AC-5.1, AC-5.2) are distributed into Chunks 1 and 2 rather than forming a separate chunk.

| Chunk | Name | ACs | Tests | Dependencies |
|-------|------|-----|-------|--------------|
| 0 | Infrastructure | — | 0 (types, fixtures, CSS, deps, esbuild config) | None |
| 1 | Server — Shiki Syntax Highlighting | AC-3.1–3.5 | 18 | Chunk 0 |
| 2 | Client — Mermaid Rendering | AC-1.1–1.6, AC-2.1–2.3, AC-5.1–5.2 | 32 | Chunk 0 |
| 3 | Rich Table Stress Tests | AC-4.1–4.3 | 10 | Chunk 1 (needs highlighted code in tables) |

```
Chunk 0 ──► Chunk 1 ──► Chunk 3
        └──► Chunk 2
```

Chunks 1 (Shiki) and 2 (Mermaid) can run in parallel after Chunk 0 — they modify different layers (server vs. client). Chunk 3 depends on Chunk 1.

**Total test count:** 60 tests across 3 test files. 54 of 55 TCs mapped to automated tests; TC-4.2c (narrow viewport) is manual-verification-only. Combined with Epics 1-2 (263 tests), the project reaches 323 tests.

Full test plan — mock strategy, fixtures, TC mapping, chunk details, and running totals — is in the [Test Plan](test-plan.md).

---

## Deferred Items

| Item | Related AC | Reason Deferred | Future Work |
|------|-----------|-----------------|-------------|
| Server-side Mermaid rendering for export | AC-1.1 | Epic 4 tech design decision | Puppeteer or pre-rendered SVG cache |
| Line numbers in code blocks | — | Out of scope per epic | CSS counter-based approach, no server changes |
| Code block copy-to-clipboard button | — | Out of scope per epic | Client-side button injected into `<pre>` elements |
| Per-app-theme Shiki color schemes | AC-3.4 | One light + one dark is sufficient for v1 | Add `themes: { 'light-warm': '...', 'dark-cool': '...' }` to Shiki config |
| Mermaid diagram accessibility (ARIA) | — | Out of scope per epic | `aria-label` on SVG with diagram type + description |
| Mermaid themeVariables customization | AC-1.3 | Built-in themes sufficient for v1 | Use `base` theme + `themeVariables` for fine-grained control |

---

## Open Questions

| # | Question | Owner | Blocks | Resolution |
|---|----------|-------|--------|------------|
| — | No open questions | — | — | All 8 tech design questions answered |

---

## Related Documentation

- Epic: `epic.md`
- API Design: `tech-design-api.md`
- UI Design: `tech-design-ui.md`
- Test Plan: `test-plan.md`
- Epic 2 Tech Design: `../02--document-viewing-and-multi-tab-reading/tech-design.md`
- Epic 2 API Design: `../02--document-viewing-and-multi-tab-reading/tech-design-api.md`
- Stack Research: `../../.research/outputs/`
