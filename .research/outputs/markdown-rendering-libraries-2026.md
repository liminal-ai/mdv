# Markdown-to-HTML Rendering Libraries: Current State (March 2026)

Research conducted 2026-03-19 for md-viewer tech design decision.

---

## Summary

**markdown-it** remains the best choice for your use case: a pluggable, isomorphic markdown renderer with a large plugin ecosystem. It is at v14.1.1 (published Feb 2026), has dual ESM/CJS support, runs in both browser and Node.js, and has 17.6M weekly downloads. Its "safe by default" mode (HTML disabled) plus external DOMPurify sanitization is the standard approach. The main trade-off is that it ships its own TypeScript types via DefinitelyTyped rather than bundled, and it is not tree-shakeable.

For sanitization, **DOMPurify v3.3.3** is the clear winner for browser-side use. For isomorphic (browser + Node) sanitization, use **isomorphic-dompurify v3.5.1**, which wraps DOMPurify with jsdom on the server side. sanitize-html is CJS-only and heavier -- skip it.

For heading anchor IDs, use **github-slugger v2.0.0** (pure ESM, TypeScript types included) combined with **markdown-it-anchor v9.2.0** which already integrates with it.

---

## 1. markdown-it -- Current State

| Property | Value |
|---|---|
| **Latest version** | 14.1.1 (published 2026-02-11) |
| **Maintained?** | Yes -- 21K GitHub stars, active maintenance, Snyk shows no unpatched vulns on v14 |
| **ESM support** | Yes -- dual ESM/CJS via `exports` field. `import markdownit from 'markdown-it'` works natively |
| **CJS support** | Yes -- `require('markdown-it')` works via `dist/index.cjs.js` |
| **Bundle size** | ~103 KB minified, ~44 KB gzipped (not tree-shakeable, `hasSideEffects: true`) |
| **Isomorphic?** | Yes -- works in browser (via CDN/bundler/UMD) and Node.js |
| **TypeScript** | Types via `@types/markdown-it` on DefinitelyTyped (not bundled). PR merged April 2024 to update types for ESM. |
| **Weekly downloads** | ~17.6M (note: inflated by VS Code transitive dependency) |
| **License** | MIT |
| **Dependencies** | 6 runtime deps: `argparse`, `entities`, `linkify-it`, `mdurl`, `punycode.js`, `uc.micro` |

### Package.json module fields (v14.1.1):
```json
{
  "main": "dist/index.cjs.js",
  "module": "index.mjs",
  "exports": {
    ".": {
      "import": "./index.mjs",
      "require": "./dist/index.cjs.js"
    }
  }
}
```

### Built-in security model:
- **Default mode**: HTML tags in markdown source are escaped (not passed through). This is safe without a sanitizer.
- **`html: true` mode**: Raw HTML in markdown is passed through to output. Requires external sanitization.
- Always blocks `javascript:`, `vbscript:`, `file:` links and most `data:` URIs regardless of mode.
- Recommendation from maintainers: use default mode (HTML disabled) + plugins for extended markup, OR enable HTML + run output through DOMPurify.

---

## 2. Alternatives Comparison

### marked v17.0.4

| Property | Value |
|---|---|
| **Latest version** | 17.0.4 (published 2026-03-04) |
| **ESM support** | ESM-first (`"type": "module"`), also ships UMD for browser |
| **TypeScript** | Bundled `.d.ts` types, built with TS 5.9.3 |
| **Bundle size** | ~444 KB unpacked (but much of that is types/source maps) |
| **Isomorphic?** | Yes |
| **Downloads** | ~28.2M/week |
| **Security** | NOT safe by default -- does not sanitize HTML. Must pair with DOMPurify. |
| **Extensibility** | Renderer customization, `use()` extension API |
| **Spec compliance** | GFM-flavored by default, less strict CommonMark compliance |

**Verdict**: Fast, well-typed, actively maintained. But no built-in safe mode -- you must always sanitize. Plugin ecosystem is smaller than markdown-it's. Tom MacWright's "Don't use marked" article (2024) criticized its security defaults and spec compliance.

### micromark v4.0.2

| Property | Value |
|---|---|
| **Latest version** | 4.0.2 (published 2025-02-27) |
| **ESM support** | ESM-only |
| **TypeScript** | Types via `micromark-util-types` package, written in JS with JSDoc types |
| **Bundle size** | ~14 KB (smallest CommonMark parser) |
| **Isomorphic?** | Yes |
| **Downloads** | ~23.8M/week |
| **Extensibility** | Extension-based (GFM, MDX, directives, math, frontmatter all available) |
| **Maintainer** | Titus Wormer (wooorm) -- same maintainer as unified/remark |

**Verdict**: Lowest-level option. 100% CommonMark compliant, smallest bundle, safe by default. But it is a *parser*, not a full rendering pipeline -- you write more code to get the same result. Best when you need AST access or are building tooling on top of unified. Not a drop-in "render markdown to HTML" solution.

### unified/remark ecosystem

| Property | Value |
|---|---|
| **remark** | v15.0.1 (last published ~3 years ago) |
| **remark-parse** | v11.0.0 (last published ~3 years ago) |
| **unified** | v11.0.5 (last published ~2 years ago) |
| **Downloads** | unified ~21.7M/week, remark ~8M/week |
| **ESM support** | ESM-only (no CJS) |
| **TypeScript** | Types included |

**Verdict**: The powerhouse for content pipelines (MDX, Astro, Docusaurus, Gatsby). AST-based, 300+ plugins. But the core packages haven't seen new releases in 2-3 years (stable, not abandoned). Overkill for "render markdown string to HTML string" -- that simple task requires chaining `unified() + remark-parse + remark-rehype + rehype-stringify`. Best for complex transformation pipelines.

### Recommendation matrix:

| Need | Best choice |
|---|---|
| Simple MD-to-HTML with plugins | **markdown-it** |
| Fastest raw conversion | **marked** |
| Smallest bundle, spec purity | **micromark** |
| AST transforms, MDX, pipelines | **unified/remark** |
| Best TypeScript DX | **marked** (bundled types) |
| Best plugin ecosystem | **markdown-it** (5.7K dependents) |
| **Your use case (isomorphic viewer, GFM, task lists, anchors)** | **markdown-it** |

---

## 3. markdown-it Plugins for Your Needs

### Task Lists: markdown-it-task-lists v2.1.1

| Property | Value |
|---|---|
| **Version** | 2.1.1 |
| **Downloads** | ~1.0M/week |
| **ESM support** | NO -- CJS-only (`main: "index.js"`, no `type: "module"`, no exports field) |
| **TypeScript** | No bundled types |
| **Maintained?** | Last published 2018. Not actively maintained. |
| **What it does** | Converts `- [ ]` / `- [x]` to HTML checkboxes |

**Alternatives for task lists:**

1. **@hedgedoc/markdown-it-task-lists v2.0.1** -- DEPRECATED (npm notice says "no longer supported"). However, it did ship ESM (`index.esm.js`), CJS, and UMD builds plus TypeScript declarations. The code still works.

2. **markdown-it-task-lists-ts** -- TypeScript-first rewrite. Zero dependencies. Customizable CSS classes. But very new (Jan 2025), low adoption (1 star on GitHub).

3. **@markdown-it-enhancer/plugin-task-lists v1.0.0** -- Another fork, Oct 2025, zero weekly downloads. Skip.

**Practical recommendation**: The original `markdown-it-task-lists` still works fine functionally. It is CJS-only but will work with Node's CJS interop (`import` will work via the interop layer in bundlers and Node). If you want a cleaner ESM/TS solution, consider vendoring the ~50 lines of logic or using `markdown-it-task-lists-ts`.

### Heading Anchors: markdown-it-anchor v9.2.0

| Property | Value |
|---|---|
| **Version** | 9.2.0 (published 2024-09-07) |
| **Downloads** | ~2.6M/week |
| **ESM support** | Yes -- ships both CJS (`dist/markdownItAnchor.js`) and ESM (`dist/markdownItAnchor.mjs`) via `main` + `module` fields |
| **TypeScript** | Yes -- bundled types at `types/index.d.ts` |
| **Maintained?** | Yes -- v9.0.0 added markdown-it 14 support (May 2024) |
| **Default slugify** | Uses its own simple slugify by default. Supports custom `slugify` function -- plug in `github-slugger` for GFM-compatible IDs |
| **Permalink support** | Built-in permalink rendering (multiple styles: header link, link after, link inside, ARIA hidden) |

**This is solid.** Well-maintained, good ESM + TS support, highly configurable.

---

## 4. HTML Sanitization Options

### DOMPurify v3.3.3

| Property | Value |
|---|---|
| **Version** | 3.3.3 (published 2026-03-11) |
| **Downloads** | ~26.2M/week |
| **ESM support** | Yes -- `dist/purify.es.mjs` with TypeScript declarations (`purify.es.d.mts`) |
| **CJS support** | Yes -- `dist/purify.cjs.js` |
| **Browser** | Yes (UMD at `dist/purify.js`, minified at `dist/purify.min.js`) |
| **Node.js** | Requires a DOM implementation. Use `jsdom` or `linkedom`. |
| **Isomorphic wrapper** | **isomorphic-dompurify v3.5.1** (2.1M downloads/week) handles this -- uses jsdom on server, native DOM in browser |
| **License** | MPL-2.0 OR Apache-2.0 |
| **Security track record** | Gold standard. CVE-2025-26791 (mXSS in versions < 3.2.4) was patched. Stay on v3.3.x. |
| **Bundle size** | ~14 KB minified+gzipped |

**Preserving safe HTML tags** (`<details>`, `<summary>`, `<kbd>`, `<sup>`, `<sub>`, `<br>`):

DOMPurify allows these by default! Its default allowlist already includes most semantic HTML tags. You only need `ADD_TAGS` for truly custom/unusual elements. The default config preserves:
- All standard block/inline HTML elements
- `<details>`, `<summary>` -- allowed by default
- `<kbd>`, `<sup>`, `<sub>`, `<br>` -- allowed by default

If you want to be explicit or restrictive, use:
```js
DOMPurify.sanitize(html, {
  ADD_TAGS: ['details', 'summary'],  // only needed if using ALLOWED_TAGS override
  ADD_ATTR: ['open'],                // for <details open>
});
```

The recommended pattern for markdown-it + DOMPurify:
```js
import markdownit from 'markdown-it';
import DOMPurify from 'dompurify';

const md = markdownit({ html: true });  // enable HTML passthrough
const rawHtml = md.render(markdownSource);
const safeHtml = DOMPurify.sanitize(rawHtml);
```

Or, if you don't need raw HTML in markdown source, just use markdown-it's default mode (HTML disabled) and skip sanitization entirely -- the output is safe by construction.

### sanitize-html v2.17.2

| Property | Value |
|---|---|
| **Version** | 2.17.2 (published 2026-02-18) |
| **Downloads** | ~4.8M/week |
| **ESM support** | NO -- CJS-only (`main: "index.js"`, no exports field, no type field) |
| **TypeScript** | Via `@types/sanitize-html` v2.16.1 (DefinitelyTyped, updated March 2026) |
| **Node.js** | Yes (primary target -- uses htmlparser2, no DOM needed) |
| **Browser** | Works but heavier than DOMPurify |

**Verdict**: Best for server-only Node.js sanitization where you don't have a DOM. But for your isomorphic use case, DOMPurify (or isomorphic-dompurify) is better: it's faster, more battle-tested for XSS, has native ESM, and works in both environments.

### markdown-it built-in sanitization

markdown-it does NOT have a built-in sanitizer. It has two modes:
1. **`html: false` (default)**: HTML tags in source are escaped to `&lt;` etc. Output is safe.
2. **`html: true`**: HTML passes through verbatim. You MUST sanitize externally.

The safe-by-default approach (option 1) is sufficient if you don't need raw HTML passthrough in your markdown documents. For a viewer that needs to render `<details>`, `<kbd>`, etc. embedded in markdown, you need `html: true` + DOMPurify.

### Recommended approach for md-viewer:

**Option A (simpler)**: Use `markdown-it` with `html: false` (default). Tags like `<details>` in the markdown source won't render as HTML -- they'll be escaped. This is safe but limits what users can put in their markdown.

**Option B (full fidelity)**: Use `markdown-it` with `html: true` + DOMPurify sanitization. This lets users write `<details><summary>Click</summary>...</details>` in their markdown and have it render correctly, while stripping `<script>`, event handlers, etc.

For a markdown *viewer* that aims for GitHub-like rendering, **Option B is correct** -- GitHub renders inline HTML in markdown (with sanitization).

---

## 5. GFM Heading Anchor ID Algorithm

The GFM spec (v0.29-gfm, 2019-04-06) does **not** formally specify heading anchor ID generation. This is done by GitHub's rendering pipeline separately from cmark-gfm. The algorithm has been reverse-engineered by the community, primarily in the **github-slugger** package.

### github-slugger v2.0.0

| Property | Value |
|---|---|
| **Version** | 2.0.0 (published 2022-10-27) |
| **ESM support** | Yes -- `"type": "module"` (pure ESM) |
| **TypeScript** | Yes -- bundled `index.d.ts` |
| **Downloads** | ~7.0M/week |
| **Maintainers** | Includes wooorm (Titus Wormer, unified ecosystem maintainer) |

### The algorithm (as implemented by github-slugger):

1. **Lowercase**: Convert the heading text content to lowercase (unless `maintainCase` is true)
2. **Strip special characters**: Remove characters matching a comprehensive Unicode regex that covers:
   - ASCII control characters (`\0-\x1F`)
   - ASCII punctuation (except hyphens and underscores, which are preserved)
   - Unicode diacritical marks, currency symbols, mathematical operators, formatting characters
   - Emoji and specialized glyphs (via surrogate pair ranges)
   - Essentially: keep `[a-z0-9]`, hyphens `-`, underscores `_`, spaces, and Unicode letters/numbers
3. **Replace spaces with hyphens**: All whitespace becomes `-`
4. **Deduplicate**: If a slug has already been generated in the same document:
   - Append `-1` for the first duplicate
   - Append `-2` for the second, etc.
   - Also tracks `slug-N` variants to avoid collisions with headings that naturally end in `-N`

### Examples:

```
"Hello World"          -> "hello-world"
"Hello World" (2nd)    -> "hello-world-1"
"foo & bar"            -> "foo--bar"       (& stripped, double hyphen preserved)
"Foo Bar"              -> "foo-bar"
"--hierarchical"       -> "--hierarchical" (leading hyphens preserved)
"with `code` here"     -> "with-code-here" (backticks stripped by markdown parser before slugify)
```

### Integration with markdown-it-anchor:

```js
import markdownit from 'markdown-it';
import anchor from 'markdown-it-anchor';
import GithubSlugger from 'github-slugger';

const slugger = new GithubSlugger();

const md = markdownit().use(anchor, {
  slugify: (s) => slugger.slug(s),
});

// Reset slugger between documents:
slugger.reset();
```

This gives you GitHub-compatible heading anchors.

---

## Package Summary Table

| Package | Version | ESM | CJS | Types | Isomorphic | Downloads/week |
|---|---|---|---|---|---|---|
| markdown-it | 14.1.1 | Yes | Yes | @types/ | Yes | 17.6M |
| marked | 17.0.4 | Yes (primary) | UMD | Bundled | Yes | 28.2M |
| micromark | 4.0.2 | Yes (only) | No | JSDoc | Yes | 23.8M |
| unified | 11.0.5 | Yes (only) | No | Bundled | Yes | 21.7M |
| markdown-it-anchor | 9.2.0 | Yes | Yes | Bundled | Yes | 2.6M |
| markdown-it-task-lists | 2.1.1 | No | Yes | No | Yes | 1.0M |
| github-slugger | 2.0.0 | Yes (only) | No | Bundled | Yes | 7.0M |
| DOMPurify | 3.3.3 | Yes | Yes | Bundled | Browser-only* | 26.2M |
| isomorphic-dompurify | 3.5.1 | Yes | Yes | Bundled | Yes | 2.1M |
| sanitize-html | 2.17.2 | No | Yes | @types/ | Node-primary | 4.8M |

*DOMPurify needs jsdom/linkedom on Node; isomorphic-dompurify wraps this.

---

## Recommended Stack for md-viewer

```
markdown-it@14.1.1          -- core renderer (ESM, isomorphic, safe defaults)
markdown-it-anchor@9.2.0    -- heading IDs + optional permalinks (ESM, typed)
github-slugger@2.0.0        -- GFM-compatible slug generation (ESM, typed)
markdown-it-task-lists@2.1.1 -- checkbox rendering (CJS, works via interop)
dompurify@3.3.3             -- HTML sanitization (browser-side, ESM)
```

For the browser-first Fastify architecture:
- All rendering happens client-side -> DOMPurify works natively (no jsdom needed)
- markdown-it + plugins load via ESM `import`
- Task lists plugin is CJS but will interop fine with bundlers (Vite, esbuild, etc.) or even via dynamic `import()`
- If you later add server-side rendering, add `isomorphic-dompurify` as a drop-in replacement

---

## Sources

- [markdown-it on npm](https://www.npmjs.com/package/markdown-it) -- v14.1.1, Feb 2026
- [markdown-it API docs](https://markdown-it.github.io/markdown-it/) -- official, current
- [markdown-it security docs](https://github.com/markdown-it/markdown-it/blob/master/docs/security.md) -- official
- [markdown-it ESM issue #862](https://github.com/markdown-it/markdown-it/issues/862) -- closed, ESM shipped in v14
- [marked on npm](https://www.npmjs.com/package/marked) -- v17.0.4, March 2026
- [micromark on npm](https://npmjs.com/package/micromark) -- v4.0.2, Feb 2025
- [markdown-it-anchor on npm](https://www.npmjs.com/package/markdown-it-anchor) -- v9.2.0, Sep 2024
- [markdown-it-anchor changelog](https://github.com/valeriangalliat/markdown-it-anchor/blob/master/CHANGELOG.md)
- [markdown-it-task-lists on npm](https://www.npmjs.com/package/markdown-it-task-lists) -- v2.1.1, 2018
- [github-slugger on npm](https://www.npmjs.com/package/github-slugger) -- v2.0.0, Oct 2022
- [github/cmark-gfm #361 (slug generation discussion)](https://github.com/github/cmark-gfm/issues/361) -- wooorm confirms github-slugger is the reference
- [DOMPurify on npm](https://www.npmjs.com/package/dompurify) -- v3.3.3, March 2026
- [isomorphic-dompurify on npm](https://www.npmjs.com/package/isomorphic-dompurify) -- v3.5.1
- [sanitize-html on npm](https://www.npmjs.com/package/sanitize-html) -- v2.17.2, Feb 2026
- [PkgPulse: marked vs remark vs markdown-it (2026)](https://www.pkgpulse.com/blog/marked-vs-remark-vs-markdown-it-parsers-2026)
- [PkgPulse: sanitize-html vs DOMPurify vs xss (2026)](https://www.pkgpulse.com/blog/sanitize-html-vs-dompurify-vs-xss-xss-prevention-javascript-2026)
- [Tom MacWright: "Don't use marked" (2024)](https://macwright.com/2024/01/28/dont-use-marked)
- [GFM Spec v0.29-gfm](https://github.github.io/gfm/)
- [Bundlephobia: markdown-it](https://bundlephobia.com/package/markdown-it) -- 103KB min, 44KB gzip

## Confidence Assessment

- **Overall confidence**: High. Version numbers, ESM support, and download counts are verified against npm registry data from February-March 2026.
- **Areas of uncertainty**: Exact markdown-it tree-shaken size when only using core features (bundlephobia reports non-tree-shakeable full bundle). The `markdown-it-task-lists` maintenance situation is unfortunate but the code is stable/simple.
- **Potential concern**: The isomorphic-dompurify + jsdom combination has known issues with circular dependency warnings in Node.js (see DOMPurify issue #1198, Feb 2026). For browser-only use, this is irrelevant.
- **No further research needed** for the stated decision. The choices are clear.
