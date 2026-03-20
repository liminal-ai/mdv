# Mermaid.js and Shiki Research Findings

**Date**: 2026-03-20
**Status**: Current as of March 2026

---

## 1. Mermaid.js

### Version
- **Latest stable**: `11.13.0` (released 2026-03-09)
- npm weekly downloads: ~3.7M
- License: MIT

### ESM / CJS Status
- **Pure ESM**. `package.json` declares `"type": "module"`.
- The `exports` field maps `"."` to:
  - `"import": "./dist/mermaid.core.mjs"`
  - `"default": "./dist/mermaid.core.mjs"`
  - `"types": "./dist/mermaid.d.ts"`
- There is a `"module"` field pointing to `./dist/mermaid.core.mjs`.
- **No CJS build is shipped**. The IIFE and CJS builds were dropped in favor of ESM. The dist ships `.mjs` files only.
- Import syntax: `import mermaid from 'mermaid'`

### Server-Side Rendering (Node.js without browser)
- **Mermaid itself requires a DOM/browser environment.** It uses D3 for SVG manipulation and needs DOM APIs for text measurement, layout computation, and DOMPurify sanitization. It cannot render natively in pure Node.js.
- The long-standing GitHub issue (#3650, "Server Side Support", opened Oct 2022) remains **open** as of Jan 2026, with 67 thumbs-up. No native SSR has been merged.
- **Workarounds for server-side rendering**:
  1. **`@mermaid-js/mermaid-cli`** (see below) -- uses Puppeteer (headless Chromium) under the hood.
  2. **JSDOM + svgdom** -- community approach documented in issue #6634 (Jun 2025): wire up svgdom with JSDOM for DOMPurify, set `globalThis.window`/`globalThis.document`, then call `mermaid.render()`. Functional but fragile; mermaid's internal DOM usage isn't disciplined for this pattern.
  3. **`@rendermaid/core`** (v0.6.0) -- a third-party pure-TypeScript Mermaid parser/renderer by Srdjan Strbanovic. Zero browser dependencies. Re-implements parsing and SVG generation from scratch. Supports flowcharts but does NOT cover all Mermaid diagram types. Not an official project.

### `@mermaid-js/mermaid-cli`
- **Package**: `@mermaid-js/mermaid-cli`
- **Latest version**: `11.12.0`
- **Binary**: `mmdc`
- **How it works**: Uses Puppeteer (headless Chromium) to render diagrams. Puppeteer is a **peerDependency** (user must install it separately, `^23` currently).
- **Output formats**: SVG, PNG, PDF
- **Node.js API** (not semver-stable):
  ```js
  import { run, renderMermaid } from "@mermaid-js/mermaid-cli"
  ```
  - `run(inputFile, outputFile, options)` -- file-to-file conversion
  - `renderMermaid(browser, definition, format, options)` -- direct rendering with existing Puppeteer browser instance, returns `{ title, desc, data }` where `data` is a `Uint8Array`
- **Minimum Node.js**: 18.19+
- Weekly downloads: ~235.7K

### securityLevel Options
Four values for the `securityLevel` configuration option:

| Value | Behavior |
|---|---|
| `'strict'` | **(Default)** Tags in text are encoded, click functionality is disabled. Most restrictive. |
| `'antiscript'` | HTML tags in text are allowed, scripts are blocked. Click functionality is disabled. |
| `'loose'` | HTML tags in text are allowed, scripts are allowed, click functionality is enabled. |
| `'sandbox'` | Renders diagram inside a sandboxed iframe. All interaction (click, etc.) is restricted by the iframe sandbox. |

The `secure` config array (e.g., `['secure', 'securityLevel', 'startOnLoad', 'maxTextSize']`) lists config keys that diagram directives are **not allowed to override**.

### Built-in Themes
Five built-in themes:

| Theme ID | Description |
|---|---|
| `'default'` | Standard theme, applied by default |
| `'forest'` | Green color palette |
| `'dark'` | Dark mode theme |
| `'neutral'` | Black and white, good for printing |
| `'base'` | The only theme that supports `themeVariables` customization |

### Theme Configuration
- Set via `mermaid.initialize({ theme: 'forest' })` or per-diagram via frontmatter/directives.
- **`themeVariables`** works only with `theme: 'base'`. Key variables:
  - `primaryColor`, `primaryTextColor`, `primaryBorderColor`
  - `secondaryColor`, `secondaryTextColor`, `secondaryBorderColor`
  - `tertiaryColor`, `tertiaryTextColor`, `tertiaryBorderColor`
  - `lineColor`, `background`, `fontFamily`, `fontSize`
  - `darkMode` (boolean, affects color calculation direction)
- The engine **only recognizes hex colors** (e.g., `#ff0000`), not named CSS colors.
- Colors are derived: changing `primaryColor` auto-computes `primaryBorderColor`, `primaryTextColor`, etc. through inversion, hue shifting, and lightening/darkening.

---

## 2. Shiki

### Version
- **Latest stable**: `4.0.2` (released 2026-03-09)
- npm weekly downloads: ~6.3M
- License: MIT
- Monorepo: `shikijs/shiki` on GitHub (13K+ stars)
- Major version jump: v3.x -> v4.0.0 happened Feb 2026

### ESM / CJS Status
- **Pure ESM**. `package.json` declares `"type": "module"`.
- `main` and `module` both point to `./dist/index.mjs`.
- All exports are `.mjs` / `.d.mts` files.
- **No CJS build is shipped.** Has been ESM-only since the shikiji merge (v1.0+).
- The `@shikijs/themes` sub-package description explicitly says "TextMate themes for Shiki in ESM".

### Entry Points / Bundle Variants
| Import Path | Description | Size (minified) | Size (gzip) |
|---|---|---|---|
| `shiki` (or `shiki/bundle/full`) | All themes + all languages, lazy-loaded | ~6.4 MB | ~1.2 MB |
| `shiki/bundle/web` | All themes + common web languages (HTML, CSS, JS, TS, JSON, MD, Vue, JSX, Svelte, etc.) | ~3.8 MB | ~695 KB |
| `shiki/core` | No themes, no languages, no WASM. Bring your own. | (minimal) | (minimal) |

Additional sub-paths: `shiki/langs`, `shiki/themes`, `shiki/wasm`, `shiki/engine/javascript`, `shiki/engine/oniguruma`, `shiki/textmate`.

### Engine Options
- **Oniguruma engine** (`shiki/engine/oniguruma`): Uses WASM-compiled Oniguruma regex library. Full compatibility. Default.
- **JavaScript engine** (`shiki/engine/javascript`): Pure JS regex engine via `oniguruma-to-es`. Handles ~95% of grammars (99.9% of regexes). No WASM needed. Lighter weight.

### Dual-Theme / Multi-Theme Support

**How it works**: Instead of passing a single `theme`, pass a `themes` object:

```ts
codeToHtml(code, {
  lang: 'javascript',
  themes: {
    light: 'github-light',
    dark: 'github-dark',
  }
})
```

**Output mechanism**: Generates a single HTML block. Light theme colors go into inline `style` attributes; dark theme colors go into CSS custom properties (e.g., `--shiki-dark`, `--shiki-dark-bg`).

**`defaultColor` option** controls which theme's colors are inlined vs. CSS-variable-only:
| Value | Behavior |
|---|---|
| `'light'` (or any theme key) | That theme's colors are applied directly as inline styles. Other themes use CSS variables. |
| `false` | No inline colors at all. ALL themes are CSS variables only. Requires custom CSS. |
| `'light-dark()'` | Uses the native CSS `light-dark()` function (limited browser support). |

**Multi-theme (3+)**: Supports arbitrary named themes:
```ts
themes: {
  light: 'github-light',
  dark: 'github-dark',
  dim: 'github-dimmed',
}
```
Each additional theme gets its own CSS variable prefix (e.g., `--shiki-dim`).

**`cssVariablePrefix`** option: Defaults to `--shiki-`. Can be customized.

**CSS needed for switching** (media query example):
```css
@media (prefers-color-scheme: dark) {
  .shiki, .shiki span {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg) !important;
  }
}
```

Or class-based: `html.dark .shiki, html.dark .shiki span { ... }`

### Bundled Themes (70 themes)

andromeeda, aurora-x, ayu-dark, ayu-light, ayu-mirage, catppuccin-frappe, catppuccin-latte, catppuccin-macchiato, catppuccin-mocha, dark-plus, dracula, dracula-soft, everforest-dark, everforest-light, github-dark, github-dark-default, github-dark-dimmed, github-dark-high-contrast, github-light, github-light-default, github-light-high-contrast, gruvbox-dark-hard, gruvbox-dark-medium, gruvbox-dark-soft, gruvbox-light-hard, gruvbox-light-medium, gruvbox-light-soft, horizon, horizon-bright, houston, kanagawa-dragon, kanagawa-lotus, kanagawa-wave, laserwave, light-plus, material-theme, material-theme-darker, material-theme-lighter, material-theme-ocean, material-theme-palenight, min-dark, min-light, monokai, night-owl, night-owl-light, nord, one-dark-pro, one-light, plastic, poimandres, red, rose-pine, rose-pine-dawn, rose-pine-moon, slack-dark, slack-ochin, snazzy-light, solarized-dark, solarized-light, synthwave-84, tokyo-night, vesper, vitesse-black, vitesse-dark, vitesse-light

Plus the special `'none'` pseudo-theme (bypasses highlighting).

Themes are re-distributed via `tm-themes` and covered by their upstream licenses (all permissive: MIT, Apache-2.0, etc.).

---

## 3. @shikijs/markdown-it

### Existence and Version
- **Yes, it exists.** Package: `@shikijs/markdown-it`
- **Latest version**: `4.0.2` (released 2026-03-09, tracks the shiki monorepo version)
- Weekly downloads: ~69.6K
- 136 versions total, first published Jan 2024
- Lives in the shiki monorepo at `packages/markdown-it`

### Dependencies
- `shiki`: `4.0.2`
- `markdown-it`: `^14.1.1`
- **Peer dependency**: `markdown-it-async` `^2.2.0`

### Integration API

**Basic usage** (async -- the plugin factory is async):
```ts
import Shiki from '@shikijs/markdown-it'
import MarkdownIt from 'markdown-it'

const md = MarkdownIt()

md.use(await Shiki({
  themes: {
    light: 'vitesse-light',
    dark: 'vitesse-dark',
  }
}))
```

**With transformers**:
```ts
import Shiki from '@shikijs/markdown-it'
import { transformerNotationDiff } from '@shikijs/transformers'
import MarkdownIt from 'markdown-it'

const md = MarkdownIt()

md.use(await Shiki({
  themes: {
    light: 'vitesse-light',
    dark: 'vitesse-dark',
  },
  transformers: [
    transformerNotationDiff(),
  ],
}))
```

**Fine-grained bundle** (via `@shikijs/markdown-it/core`):
```ts
import { fromHighlighter } from '@shikijs/markdown-it/core'
import MarkdownIt from 'markdown-it'
import { createHighlighterCore } from 'shiki/core'

const highlighter = await createHighlighterCore({ /* ... */ })
const md = MarkdownIt()
md.use(fromHighlighter(highlighter, { /* theme options */ }))
```

### Note on `markdown-it-shiki`
The old `markdown-it-shiki` package (by antfu) is **archived and deprecated**. It points users to `@shikijs/markdown-it`.

---

## 4. Node.js 24 ESM Compatibility

### Mermaid (`mermaid@11.13.0`)
- Ships as pure ESM with `"type": "module"`.
- `import mermaid from 'mermaid'` works in `"type": "module"` projects.
- **Caveat**: Mermaid requires DOM APIs at runtime. It will import fine in Node.js but will fail at render time without a DOM shim (JSDOM, svgdom, or similar). For server-side rendering, use `@mermaid-js/mermaid-cli` with Puppeteer.
- `@mermaid-js/mermaid-cli` requires Node.js >= 18.19. Node.js 24 is supported.

### Shiki (`shiki@4.0.2`)
- Ships as pure ESM with `"type": "module"`.
- `import { codeToHtml } from 'shiki'` works in `"type": "module"` projects.
- Shiki is **designed to work in Node.js** without any browser APIs. It uses WASM (Oniguruma engine) or pure JS regex (JavaScript engine) for grammar parsing. No DOM required.
- Fully compatible with Node.js 24 ESM.

### @shikijs/markdown-it (`@shikijs/markdown-it@4.0.2`)
- Pure ESM (ships `.mjs` files only).
- Works in Node.js ESM projects. The async plugin factory (`await Shiki({...})`) is designed for server-side usage.
- Peer-depends on `markdown-it-async@^2.2.0` for async rendering support.

---

## Sources

- https://www.npmjs.com/package/mermaid (v11.13.0, published 2026-03-09)
- https://github.com/mermaid-js/mermaid/releases (release notes)
- https://registry.npmjs.org/mermaid/11.13.0 (package.json inspection)
- https://mermaid.js.org/config/theming.html (theme docs)
- https://github.com/mermaid-js/mermaid/issues/3650 (SSR issue, still open)
- https://github.com/mermaid-js/mermaid/issues/6634 (svgdom SSR approach)
- https://www.npmjs.com/package/@mermaid-js/mermaid-cli (v11.12.0)
- https://www.npmjs.com/package/shiki (v4.0.2, published 2026-03-09)
- https://registry.npmjs.org/shiki/4.0.2 (package.json inspection)
- https://shiki.style/guide/dual-themes (dual/multi theme docs)
- https://shiki.style/guide/bundles (bundle size docs)
- https://shiki.style/themes (theme list)
- https://www.npmjs.com/package/@shikijs/themes (v4.0.2, theme file listing)
- https://www.npmjs.com/package/@shikijs/markdown-it (v4.0.2)
- https://shiki.style/packages/markdown-it (integration docs)
- https://github.com/antfu/markdown-it-shiki (deprecated, archived)
