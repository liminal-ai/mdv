# Mermaid.js Bundling Research

Research date: 2026-03-20

---

## Summary

Mermaid's npm package is 71MB unpacked, but this is misleading. The actual browser-facing production files are dramatically smaller. The key production file is `mermaid.min.js` (IIFE, 2.83MB uncompressed) for script-tag usage, or `mermaid.esm.min.mjs` (26KB loader + lazy-loaded chunks) for ESM usage. The ESM build uses built-in lazy loading where each diagram type is a separate chunk loaded on demand. Every major documentation framework (Docusaurus, VitePress, MkDocs Material) loads mermaid separately from the main bundle -- none of them bundle mermaid into their own JS. They all use either CDN loading or dynamic imports.

---

## 1. Actual Browser-Facing Bundle Sizes (mermaid v11.13.0)

Source: UNPKG file browser for `mermaid@11.13.0/dist/`

### dist/ root files

| File | Size | Purpose |
|------|------|---------|
| `mermaid.min.js` | **2.83 MB** | IIFE bundle -- everything in one file, for `<script>` tags |
| `mermaid.js` | 6.48 MB | Unminified IIFE (dev) |
| `mermaid.esm.min.mjs` | **26 KB** | ESM entry point -- just the loader/dispatcher |
| `mermaid.esm.mjs` | 55 KB | ESM entry point unminified |
| `mermaid.core.mjs` | 43.7 KB | Unbundled ESM for use with your own bundler |

### Key insight: IIFE vs ESM

- **`mermaid.min.js` (2.83MB)**: Self-contained IIFE. Everything in one file. This is what `<script src="...">` loads. Gzipped this comes down to roughly 660-760KB over the wire (multiple sources cite ~660KB gzipped, one Astro blog cites 760KB from CDN).
- **`mermaid.esm.min.mjs` (26KB)**: ESM entry point. Only contains diagram detection regexes and dynamic `import()` loaders for each diagram type. Actual diagram code is in `dist/chunks/mermaid.esm.min/`.

### ESM Chunk Sizes (dist/chunks/mermaid.esm.min/)

The ESM build splits mermaid into ~75 JS chunk files (plus source maps). Key chunks:

| Chunk | Size | Content |
|-------|------|---------|
| `chunk-GAX3EE6F.mjs` | 486 KB | Shared core (likely d3 + rendering) |
| `chunk-7RZVMHOQ.mjs` | 469 KB | Shared core |
| `katex-GD7MH7QM.mjs` | 277 KB | KaTeX math rendering |
| `architectureDiagram-EJXTDGMB.mjs` | 153 KB | Architecture diagrams |
| `chunk-3UWU4A3N.mjs` | 130 KB | Shared |
| `chunk-MGPAVIPZ.mjs` | 120 KB | Shared |
| `sequenceDiagram-PYXOKC54.mjs` | 111 KB | Sequence diagrams |
| `chunk-BDKIFH7H.mjs` | 90 KB | Shared |
| `cose-bilkent-PNC4W37J.mjs` | 84 KB | Layout engine |
| `blockDiagram-HG7WUIX4.mjs` | 71 KB | Block diagrams |
| `c4Diagram-BBK6TRR6.mjs` | 70 KB | C4 diagrams |
| `flowDiagram-IIOBCMXN.mjs` | 61 KB | Flowcharts |
| `chunk-YLHEXJF3.mjs` | 53 KB | Shared |
| `ganttDiagram-CBGYKTO2.mjs` | 50 KB | Gantt charts |
| `chunk-TFLKLN34.mjs` | 46 KB | Shared |
| `vennDiagram-R4MEU4WM.mjs` | 42 KB | Venn diagrams |
| `chunk-NN2NZ22Q.mjs` | 42 KB | Shared |
| `xychartDiagram-TMDUDL2A.mjs` | 39 KB | XY charts |
| `quadrantDiagram-DYU4IJOS.mjs` | 34 KB | Quadrant charts |
| `requirementDiagram-N2XL27SN.mjs` | 31 KB | Requirement diagrams |
| `chunk-3YCYZ6SJ.mjs` | 29 KB | Shared |
| `chunk-IWDTEBJL.mjs` | 28 KB | Shared |
| `erDiagram-L2NYR2MQ.mjs` | 26 KB | ER diagrams |
| `chunk-H3VCZNTA.mjs` | 25 KB | Shared |
| `gitGraphDiagram-FCDOK2W6.mjs` | 24 KB | Git graphs |
| `sankeyDiagram-HWP7ZNIN.mjs` | 23 KB | Sankey diagrams |
| `journeyDiagram-FZRSWBTQ.mjs` | 23 KB | Journey diagrams |
| `timeline-definition-GC5UGDFR.mjs` | 24 KB | Timeline diagrams |
| `mindmap-definition-QTQOGDLH.mjs` | 22 KB | Mindmaps |
| `kanban-definition-ETIEC4YN.mjs` | 21 KB | Kanban boards |
| `ishikawaDiagram-LCPTV24A.mjs` | 18 KB | Ishikawa/fishbone |
| `chunk-JIN56HTB.mjs` | 14 KB | Shared |
| `stateDiagram-UFOXNHOX.mjs` | 11 KB | State diagrams |
| `pieDiagram-O4VNXU6G.mjs` | 4 KB | Pie charts |
| Various detector stubs | 240-260 B each | Tiny loader stubs |

**Total chunks directory (mermaid.esm.min)**: ~14.2 MB including source maps. JS-only is roughly 2.4 MB total across all chunks (but only needed chunks are loaded).

### Practical load for a simple flowchart via ESM

When using the ESM build and rendering a flowchart, the browser loads:
- 26 KB entry point
- Core shared chunks (~486KB + ~469KB + other shared deps)
- `flowDiagram-IIOBCMXN.mjs` (61 KB)
- Additional shared utilities as needed

**Estimated first-diagram load: ~1-1.5MB** (not all chunks are needed for one diagram type). Subsequent different diagram types load incrementally.

---

## 2. How Documentation Frameworks Handle Mermaid

### Docusaurus (`@docusaurus/theme-mermaid`)

- **Strategy**: Bundled as npm dependency, loaded via **dynamic import**
- **Key code**: `const mermaid = (await import('mermaid')).default;`
- **Lazy loading**: Yes. Mermaid is only loaded when a page contains a mermaid diagram. Uses memoized promise so it loads once.
- **Comment from source**: "We load Mermaid with a dynamic import to code split / lazy load the library. It is only called inside a useEffect, so loading can be deferred."
- **Webpack handles the code splitting** -- mermaid becomes a separate chunk in the Docusaurus build output.
- Weekly downloads of `@docusaurus/theme-mermaid`: part of the 3M+ Docusaurus ecosystem.

### VitePress (`vitepress-plugin-mermaid`)

- **Strategy**: npm dependency (`mermaid` as a devDependency), loaded via **Vite bundling**
- **How**: Plugin uses `withMermaid()` wrapper around vitepress config. Mermaid is imported in a Vue component (`Mermaid.vue`) that uses the `mermaid` module.
- **Vite handles code splitting**: Since VitePress uses Vite, mermaid gets split into its own chunk automatically.
- **Configuration**: Uses Vite's virtual module system for mermaid config.
- Weekly downloads: ~57K

### MkDocs Material (squidfunk/mkdocs-material)

- **Strategy**: **CDN loading at runtime** -- does NOT bundle mermaid
- **How**: Loads `mermaid.min.js` from unpkg CDN (currently defaulting to v11.x). The theme detects `.mermaid` blocks on the page and conditionally loads the library.
- **Lazy loading**: Yes. "mermaid.min.js is fetched dynamically and only if needed" (squidfunk, issue #2170). The JS is only loaded when a page contains mermaid diagrams.
- **Configurable URL**: Users can override via `extra_javascript` in mkdocs.yml to point to a different version or self-hosted file.
- **Version pinning**: Hardcoded to a major version (currently v11), loaded from `https://unpkg.com/mermaid@11/dist/mermaid.min.js`.

### Astro/Starlight

- **Two approaches exist**:
  1. **`rehype-mermaid` plugin**: Server-side rendering using Playwright. Mermaid diagrams are converted to SVG at build time -- **zero client-side JS**. Requires `playwright` as a build dependency.
  2. **Client-side approach**: Dynamic script injection. Detect mermaid code blocks in the DOM, then load mermaid from CDN only when needed. Example pattern:
     ```js
     const mermaid = await import("https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js");
     ```
- **Starlight** (Astro's doc framework) does not have built-in mermaid support; it's an open feature request (Discussion #1259).

### MkDocs-Mermaid2 Plugin

- **Strategy**: CDN loading with configurable URL
- **Supports both**: IIFE (`mermaid.min.js`) and ESM (`mermaid.esm.min.mjs`) depending on file extension
- **Auto-detects**: `.js` extension -> `<script>` tag; `.mjs` extension -> `<script type="module"> import mermaid from "URL"`

---

## 3. Mermaid's Built-in Lazy Loading

The mermaid library itself (v10+) has **built-in diagram lazy loading** in the ESM build.

From the ESM entry point (`mermaid.esm.min.mjs`), each diagram type is registered with:
- A **detector** function (regex test, ~1 line)
- A **loader** function (dynamic import of the diagram chunk)

Example from the source:
```js
// Flowchart detector + lazy loader
var Wt = "flowchart";
var je = (t, r) => /^\s*graph/.test(t);  // detector
var Ie = async () => {
  let { diagram: t } = await import("./chunks/mermaid.esm.min/flowDiagram-IIOBCMXN.mjs");
  return { id: Wt, diagram: t };
};  // loader
```

**This means**: When you use the ESM build, only the diagram types actually present in your content are downloaded. If a page only has a flowchart, only the flowchart chunk (+ shared deps) is loaded.

**Official statement** (from `@mermaid-js/tiny` package docs): "The original mermaid library supports lazy loading, so it will be faster on the initial load, and only load the required diagrams."

### @mermaid-js/tiny

- Official "tiny" build that pre-bundles everything into one file (no lazy loading)
- Removes: Mindmap, Architecture diagram, KaTeX rendering, lazy loading
- Designed for CDN use: `<script src="https://cdn.jsdelivr.net/npm/@mermaid-js/tiny@11/dist/mermaid.tiny.js">`
- PR #4734 claimed **69.7% size reduction** vs full build
- Weekly downloads: ~155 (very low adoption)
- **Official recommendation**: "It's always recommended to use the full mermaid library unless you have a very specific reason to reduce the bundle size" (because full mermaid has lazy loading built in)

---

## 4. ESBuild and Mermaid

### Mermaid itself uses ESBuild for its build

Since v11, mermaid uses **ESBuild as its primary bundler** (PR #4729, merged into the `next` branch).

Key facts from the mermaid team:
- Switched from Vite to ESBuild for production builds
- Build time dropped from 31.84s (Vite) to 5.5s (ESBuild)
- The `dist/mermaid.min.js` is an **IIFE** bundle (not UMD -- breaking change from v10 to v11)
- ESBuild handles the chunk splitting for the ESM build

### Known issues when bundling mermaid with ESBuild in your own project

1. **Config splitting bug** (Issue #4345): When Vite/Rollup bundled mermaid, `currentConfig` could get split across multiple files, causing different parts of mermaid to see different configs. This was a key motivation for switching to ESBuild.

2. **ESM-only since v11**: Mermaid requires ESM. If your ESBuild config uses CommonJS output, you will have issues. Mermaid's dependency d3 also requires ESM.

3. **IIFE `mermaid.min.js` works with `<script>` tags**: The v11 IIFE build exposes `window.mermaid` directly (no `.default` needed after a fix in the build process).

4. **Using `mermaid.core.mjs` for bundler integration**: The `mermaid.core.mjs` (43.7KB) is the intended entry point for apps that use their own bundler. It does NOT bundle `node_modules/` -- your bundler (ESBuild/Webpack/Vite) resolves those. The `package.json` `exports` field points to this.

### Recommended ESBuild configuration for bundling mermaid

Based on mermaid's own build and community patterns:

- Use ESM output format (`format: 'esm'`)
- Enable code splitting (`splitting: true`) -- required for mermaid's lazy loading to work
- Set `bundle: true` and let ESBuild resolve mermaid's dependencies
- If code splitting is not desired, the IIFE build (`mermaid.min.js`) can be loaded separately via `<script>` tag

**Important caveat**: If you bundle mermaid into a single file (no code splitting), you lose the lazy loading benefit and get the full ~2.8MB.

---

## 5. Practical Loading Patterns for Local Apps

### Pattern A: CDN script tag (simplest, what MkDocs Material does)
```html
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>mermaid.initialize({ startOnLoad: true });</script>
```
- Size: ~2.83MB uncompressed, ~660KB gzipped over the wire
- Pro: Zero build complexity
- Con: No lazy loading of diagram types; all-or-nothing

### Pattern B: CDN ESM import (lazy loading of diagram types)
```html
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true });
</script>
```
- Size: 26KB initial, then chunks loaded on demand
- Pro: Built-in lazy loading -- only used diagram types are fetched
- Con: Multiple HTTP requests for chunks

### Pattern C: Dynamic import in your app code (what Docusaurus does)
```js
// Only load when needed
async function renderMermaid(code) {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false });
  const { svg } = await mermaid.render('diagram', code);
  return svg;
}
```
- With bundler code splitting enabled, mermaid becomes a separate chunk
- Pro: App loads fast, mermaid deferred until needed
- Con: Requires bundler with code splitting support

### Pattern D: Conditional script injection (what many blogs/apps do)
```js
function loadMermaidIfNeeded() {
  if (!document.querySelector('.mermaid')) return;
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
  script.onload = () => mermaid.initialize({ startOnLoad: true });
  document.head.appendChild(script);
}
```
- Pro: Zero cost on pages without diagrams
- Con: Still loads full 2.83MB IIFE when triggered

### Pattern E: Self-hosted IIFE (for offline/local apps)
```js
// Serve mermaid.min.js as a static asset from your own server
// Load via script tag or conditional injection
```
- Used by MkDocs-Mermaid2 plugin for offline deployments
- Copy `mermaid.min.js` into your static assets directory

---

## 6. Size Summary Table

| Approach | Initial Download | Gzipped | Notes |
|----------|-----------------|---------|-------|
| `mermaid.min.js` (IIFE, all-in-one) | 2.83 MB | ~660 KB | Everything in one file |
| `mermaid.esm.min.mjs` (ESM entry) | 26 KB | ~8 KB | Just the loader; chunks on demand |
| ESM + flowchart render | ~1-1.5 MB | ~350-500 KB | Entry + core chunks + flowchart |
| `@mermaid-js/tiny` | ~850 KB (est.) | ~250 KB (est.) | Fewer diagrams, no lazy loading |
| `mermaid.core.mjs` (for bundlers) | 43.7 KB | ~12 KB | Unbundled; your bundler resolves deps |

---

## Sources

- [UNPKG mermaid@11.12.2 dist file listing](https://app.unpkg.com/mermaid@11.12.2/files/dist) -- actual file sizes
- [UNPKG mermaid@11.13.0 chunks listing](https://app.unpkg.com/mermaid@11.13.0/files/dist/chunks/mermaid.esm.min) -- chunk file sizes
- [jsDelivr CDN mermaid dist](https://cdn.jsdelivr.net/npm/mermaid@11.13.0/dist/) -- CDN file listing
- [PR #4729: Use ESBuild (replaces UMD with IIFE)](https://github.com/mermaid-js/mermaid/pull/4729) -- mermaid's switch to ESBuild
- [PR #4734: Add mermaid.tiny.min.js (69.7% size reduction)](https://github.com/mermaid-js/mermaid/pull/4734) -- @mermaid-js/tiny
- [@mermaid-js/tiny npm page](https://www.npmjs.com/package/@mermaid-js/tiny) -- tiny build docs and lazy loading note
- [Issue #4120: Splitting mermaid packages](https://github.com/mermaid-js/mermaid/issues/4120) -- discussion of lazy loading architecture; sidharthv96 confirms diagrams are lazy loaded
- [Discussion #3720: Dynamic loading of diagrams](https://github.com/orgs/mermaid-js/discussions/3720) -- mermaid team on lazy loading
- [Docusaurus theme-mermaid docs](https://docusaurus.io/docs/markdown-features/diagrams) -- dynamic import pattern
- [Docusaurus loadMermaid.ts source](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-theme-mermaid/src/client/loadMermaid.ts) -- `await import('mermaid')`
- [vitepress-plugin-mermaid npm](https://www.npmjs.com/package/vitepress-plugin-mermaid) -- VitePress integration
- [MkDocs Material issue #2170: Native Mermaid.js integration](https://github.com/squidfunk/mkdocs-material/issues/2170) -- squidfunk on conditional CDN loading
- [MkDocs-Mermaid2 library docs](https://mkdocs-mermaid2.readthedocs.io/en/latest/library/) -- configurable CDN/local loading
- [Rick Strahl: Lazy Loading the Mermaid Diagram Library](https://weblog.west-wind.com/posts/2025/May/10/Lazy-Loading-the-Mermaid-Diagram-Library) -- practical lazy loading patterns, cites 660KB gzipped
- [mfyz.com: Smart client-side Mermaid on Astro](https://mfyz.com/smart-client-side-rendered-mermaid-charts-on-astro-blogs/) -- CDN dynamic import pattern, cites 760KB minified from CDN
- [PR #3437: Esbuild backwards-compatible mermaid.core.mjs](https://github.com/mermaid-js/mermaid/pull/3437) -- dist file purposes documented
- [Issue #4345: currentConfig incorrectly bundled](https://github.com/mermaid-js/mermaid/issues/4345) -- bundler splitting bug

---

## Confidence Assessment

- **File sizes**: HIGH confidence -- directly verified from UNPKG and jsDelivr file browsers
- **Framework integration patterns**: HIGH confidence -- verified from official docs and source code
- **Lazy loading architecture**: HIGH confidence -- verified from ESM source code on UNPKG showing dynamic imports per diagram type, confirmed by mermaid team member (sidharthv96) in issues
- **Gzipped sizes**: MEDIUM confidence -- cited from multiple third-party sources (~660-760KB), not independently measured
- **ESBuild integration specifics**: MEDIUM confidence -- based on mermaid's own PRs and issue discussions; limited direct documentation on recommended third-party ESBuild config for bundling mermaid
- **@mermaid-js/tiny sizes**: LOW confidence -- estimated from the "69.7% reduction" claim; the package has very low adoption (155 downloads/week) and was only merged in May 2025
