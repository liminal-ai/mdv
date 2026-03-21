# CodeMirror 6 Research for md-viewer Edit Mode

**Date**: 2026-03-20
**Purpose**: Inform tech design for adding a markdown editing mode to md-viewer
**Context**: Vanilla TypeScript, ESM, esbuild bundler, Fastify backend, browser-first

---

## 1. Package Versions (as of March 2026)

| Package | Latest Version | Released |
|---------|---------------|----------|
| `codemirror` (meta-package) | 6.0.2 | 2025-06-19 |
| `@codemirror/view` | 6.40.0 | 2026-03-12 |
| `@codemirror/state` | 6.6.0 | 2026-03-12 |
| `@codemirror/language` | 6.12.2 | 2026-02-25 |
| `@codemirror/commands` | 6.10.3 | 2026-03-12 |
| `@codemirror/lang-markdown` | 6.5.0 | 2025-10-23 |
| `@codemirror/theme-one-dark` | 6.1.3 | 2025-06-19 |
| `@codemirror/autocomplete` | 6.20.1 | 2026-03-02 |
| `@codemirror/search` | 6.6.0 | 2026-01-13 |
| `@codemirror/lint` | 6.9.5 | 2026-03-02 |

**Note on versioning**: The `codemirror` meta-package is intentionally stable at 6.0.2. It is a thin convenience wrapper that re-exports `basicSetup`, `minimalSetup`, and `EditorView`. The real versioning churn happens in the `@codemirror/*` sub-packages. The meta-package uses `^6.0.0` range constraints for all its dependencies, so installing it pulls in the latest compatible versions automatically.

### Packages needed for a markdown editor

For the md-viewer edit mode, the recommended install set is:

```
codemirror                     # meta-package (pulls in view, state, commands, language, autocomplete, search, lint)
@codemirror/lang-markdown      # markdown language support + Lezer parser
@codemirror/theme-one-dark     # dark theme (optional, for theme switching)
```

The `codemirror` meta-package transitively brings in `@codemirror/view`, `@codemirror/state`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/autocomplete`, `@codemirror/search`, and `@codemirror/lint`. You do NOT need to install those separately -- they are transitive dependencies. However, you DO need to import from them directly in your code (they are peer-like in terms of usage).

Optional extras worth considering:
- `@codemirror/lang-javascript`, `@codemirror/lang-html`, `@codemirror/lang-css`, `@codemirror/lang-json` -- for syntax-highlighted fenced code blocks within markdown

---

## 2. ESM Compatibility

**Verdict: Fully ESM-compatible. No issues for this project.**

CodeMirror 6 ships dual CJS/ESM. Each package has:
- `"module"` field pointing to ESM (`dist/index.js`)
- `"main"` field pointing to CJS (`dist/index.cjs`)
- `"exports"` map with both `import` and `require` conditions
- TypeScript declarations via `"types"` field

The project already uses `"type": "module"` in package.json, esbuild with `format: 'esm'` and `platform: 'browser'`. This is a perfect match. CodeMirror uses only standard ESM `import`/`export` with no dynamic requires or Node-specific APIs.

The one caveat for CDN/bundlerless usage is that CodeMirror's sub-packages depend on each other, and deduplication matters (multiple copies of `@codemirror/state` will break `instanceof` checks). This is a non-issue when using a bundler like esbuild, which deduplicates automatically.

---

## 3. Theming

### How it works

CodeMirror 6 theming has two layers:

1. **Editor theme** (`EditorView.theme()`): Controls the editor chrome -- background colors, cursor color, selection color, gutter styles, etc. Uses a CSS-in-JS system powered by the `style-mod` library. Each theme gets a unique generated CSS class to scope its rules.

2. **Highlight style** (`HighlightStyle.define()`): Controls syntax highlighting colors. Maps `@lezer/highlight` tags (like `tags.keyword`, `tags.heading`, `tags.emphasis`) to CSS properties.

### Creating a theme

```typescript
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Editor chrome theme
const myEditorTheme = EditorView.theme({
  '&': {
    color: '#e0e0e0',
    backgroundColor: '#1e1e1e',
  },
  '.cm-content': {
    caretColor: '#528bff',
    fontFamily: 'monospace',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: '#3e4451',
  },
  '.cm-gutters': {
    backgroundColor: '#1e1e1e',
    color: '#636d83',
    borderRight: 'none',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#2c313a',
  },
  '.cm-activeLine': {
    backgroundColor: '#2c313a40',
  },
}, { dark: true });

// Syntax highlighting style
const myHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, fontWeight: 'bold', color: '#e06c75' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.link, color: '#61afef', textDecoration: 'underline' },
  { tag: tags.monospace, color: '#98c379' },
  { tag: tags.comment, color: '#5c6370', fontStyle: 'italic' },
]);
```

### CSS Custom Properties

CodeMirror 6 does **NOT** natively use CSS custom properties (`var(--my-color)`) for its theming system. Themes are defined as JavaScript objects that generate scoped CSS classes. However:

- You **can** reference CSS custom properties in your theme definitions: `{ '&': { backgroundColor: 'var(--editor-bg)' } }`. The style-mod library just generates CSS strings, so `var()` references work fine.
- A community project (cm-markdown-editor by zipang) demonstrates this pattern extensively, defining `:root` CSS variables and using them in the editor theme.
- This is a viable approach if you want the editor theme to respond to the same CSS variables as the rest of the md-viewer UI.

### Runtime theme switching

Yes, fully supported via **Compartments**. This is the official pattern:

```typescript
import { Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

const themeCompartment = new Compartment();

// Initial setup with light theme (no theme extension = light default)
const view = new EditorView({
  extensions: [
    themeCompartment.of([]),  // start with default light
    // ... other extensions
  ],
  parent: document.getElementById('editor')!,
});

// Switch to dark theme at runtime
function setDarkTheme() {
  view.dispatch({
    effects: themeCompartment.reconfigure(oneDark),
  });
}

// Switch back to light theme
function setLightTheme() {
  view.dispatch({
    effects: themeCompartment.reconfigure([]),
  });
}
```

The Compartment pattern also works for any other dynamic config (language, tab size, read-only mode, etc.).

### The `@codemirror/theme-one-dark` package

Exports three things:
- `oneDark: Extension` -- combined editor theme + highlight style (use this for convenience)
- `oneDarkTheme: Extension` -- just the editor chrome styles
- `oneDarkHighlightStyle: HighlightStyle` -- just the syntax highlight colors
- `color` object -- the raw color values used (chalky, coral, cyan, ivory, stone, malibu, sage, whiskey, violet, etc.)

### Base themes

For extensions that need to provide default styles that adapt to light/dark:

```typescript
const myBaseTheme = EditorView.baseTheme({
  '&dark .cm-myWidget': { background: 'dimgrey' },
  '&light .cm-myWidget': { background: 'ghostwhite' },
});
```

When a theme is created with `{ dark: true }`, the `&dark` base theme rules activate; otherwise, `&light` rules activate.

---

## 4. Markdown Syntax Highlighting

### What gets highlighted

The `@codemirror/lang-markdown` package uses the `@lezer/markdown` parser, which produces a full syntax tree for the document. The Lezer markdown parser recognizes all CommonMark elements:

**Block elements:**
- `ATXHeading1` through `ATXHeading6`, `SetextHeading1`, `SetextHeading2`
- `Paragraph`
- `Blockquote` (with `QuoteMark`)
- `BulletList`, `OrderedList`, `ListItem` (with `ListMark`)
- `CodeBlock`, `FencedCode` (with `CodeMark`, `CodeText`, `CodeInfo`)
- `HorizontalRule`
- `HTMLBlock`
- `LinkReference`

**Inline elements:**
- `Emphasis` (italic -- `*text*` or `_text_`)
- `StrongEmphasis` (bold -- `**text**` or `__text__`)
- `InlineCode` (backtick code)
- `Link` (with `URL`, `LinkLabel`, `LinkTitle`, `LinkMark`)
- `Image` (with same sub-nodes as Link)
- `Autolink`
- `HTMLTag`
- `HardBreak`
- `Escape`, `Entity`

**Highlight tags mapped (via `@lezer/highlight`):**
- Headings map to `tags.heading` (and level-specific `tags.heading1` through `tags.heading6`)
- Bold maps to `tags.strong`
- Italic maps to `tags.emphasis`
- Inline code maps to `tags.monospace`
- Links map to `tags.link` and `tags.url`
- Blockquote markers map to `tags.quote`
- List markers map to `tags.list`
- Code fence info strings map to `tags.labelName`

The `defaultHighlightStyle` from `@codemirror/language` and the `oneDarkHighlightStyle` both provide reasonable defaults for all these tags out of the box.

### Fenced code block language support

The `markdown()` function accepts a config object with options for code block highlighting:

```typescript
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

const md = markdown({
  // Auto-detect language from ` ```js ` / ` ```python ` etc.
  codeLanguages: languages,

  // Or a custom resolver function:
  // codeLanguages: (info) => { ... return LanguageDescription or null }

  // Default language for untagged code blocks:
  // defaultCodeLanguage: javascript(),
});
```

The `@codemirror/language-data` package provides `languages`, an array of `LanguageDescription` objects for ~30 languages. Each loads its parser lazily (dynamic import). This is optional -- without it, code blocks just render as plain monospace text.

### GFM (GitHub Flavored Markdown)

The Lezer markdown parser supports GFM extensions (tables, strikethrough, task lists, autolinks) through its extension mechanism. The `@codemirror/lang-markdown` package includes GFM table support. For strikethrough and task lists, you may need additional Lezer markdown extensions.

---

## 5. Bundle Size

### Official numbers from codemirror.net (as of the bundling example page)

| Setup | Raw (unminified) | Minified | Minified + gzipped |
|-------|------------------|----------|-------------------|
| `basicSetup` + one language | ~1 MB | ~400 KB | ~135 KB |
| `minimalSetup` (bare minimum) | ~700 KB | ~250 KB | ~75 KB |

These numbers include the full source with comments in the raw column. After minification (which esbuild does well), the practical transfer sizes are very reasonable.

### What this means for md-viewer

A markdown editor with `basicSetup` + `markdown()` + `oneDark` theme would land at roughly:
- **~400 KB minified** (uncompressed JS)
- **~135 KB gzipped** (over the wire)

Using `minimalSetup` instead of `basicSetup` and only adding the extensions you need would reduce this to approximately:
- **~250-300 KB minified**
- **~80-100 KB gzipped**

If you add `@codemirror/language-data` for fenced code block highlighting of many languages, that adds significant size but loads lazily. Without it, the base markdown editor stays compact.

### esbuild minification

The current esbuild config does NOT enable minification:

```typescript
// current: app/esbuild.config.ts
await build({
  entryPoints: ['src/client/app.ts'],
  outfile: 'dist/client/app.js',
  platform: 'browser',
  format: 'esm',
  bundle: true,
});
```

Adding `minify: true` would be important once CodeMirror is included, to get the ~60% size reduction. Also consider `target` for dead-code elimination:

```typescript
await build({
  entryPoints: ['src/client/app.ts'],
  outfile: 'dist/client/app.js',
  platform: 'browser',
  format: 'esm',
  bundle: true,
  minify: true,
  target: 'es2020',  // or whatever your browser target is
});
```

### Tree shaking

esbuild performs tree shaking automatically when `bundle: true` and `format: 'esm'` are set. CodeMirror is designed to be tree-shakeable -- unused extensions and language modes are eliminated from the bundle. Using `minimalSetup` and manually adding only needed extensions gives the most control over bundle size.

---

## 6. Undo/Redo

**Yes, fully supported out of the box.**

### With `basicSetup` / `minimalSetup`

Both `basicSetup` and `minimalSetup` (from the `codemirror` meta-package) include the `history()` extension and the corresponding keybindings. Undo (Ctrl/Cmd-Z) and Redo (Ctrl/Cmd-Y or Ctrl/Cmd-Shift-Z) work immediately with no additional configuration.

### Manual setup

If building extensions manually:

```typescript
import { history, historyKeymap } from '@codemirror/commands';
import { keymap } from '@codemirror/view';

const extensions = [
  history(),                         // enables undo/redo state tracking
  keymap.of(historyKeymap),          // Ctrl-Z, Ctrl-Y, Ctrl-Shift-Z bindings
  // ... other extensions
];
```

### History API

- `history(config?)` -- configurable with `minDepth` (minimum undo events to store, default 100) and `newGroupDelay` (ms before a new undo group starts, default 500ms)
- `undo(view)`, `redo(view)` -- programmatic commands
- `undoDepth(state)`, `redoDepth(state)` -- query how many undo/redo steps are available
- History integrates with the transaction system -- multiple changes can be grouped into a single undo step

---

## 7. esbuild Integration

### Current project setup compatibility

The existing `app/esbuild.config.ts` configuration is already well-suited for CodeMirror:

```typescript
await build({
  entryPoints: ['src/client/app.ts'],
  outfile: 'dist/client/app.js',
  platform: 'browser',
  format: 'esm',
  bundle: true,
});
```

CodeMirror 6 works perfectly with esbuild. Key points:

1. **No special plugins needed**: Unlike Rollup (which needs `@rollup/plugin-node-resolve`), esbuild resolves `node_modules` natively. Just `npm install` the packages and import them.

2. **ESM format works**: CodeMirror publishes proper ESM with `exports` maps. esbuild with `format: 'esm'` handles this correctly.

3. **No CSS files to import**: CodeMirror 6 injects all its styles via JavaScript (using the `style-mod` library). There are no CSS files to configure in the bundler. This is a significant simplification over CodeMirror 5.

4. **Tree shaking works**: esbuild eliminates unused exports when bundling. Using individual imports rather than barrel imports gives best results.

### Recommended esbuild config additions for production

```typescript
await build({
  entryPoints: ['src/client/app.ts'],
  outfile: 'dist/client/app.js',
  platform: 'browser',
  format: 'esm',
  bundle: true,
  minify: true,               // critical for CM6 bundle size
  target: 'es2020',           // safe for modern browsers
  sourcemap: true,            // for debugging
  metafile: true,             // optional: for bundle size analysis
});
```

### Code splitting consideration

If the editor is loaded on-demand (e.g., only when entering edit mode), esbuild supports code splitting with `splitting: true` and `outdir` instead of `outfile`. This would keep the initial page load fast and lazy-load the CodeMirror bundle only when needed:

```typescript
await build({
  entryPoints: ['src/client/app.ts'],
  outdir: 'dist/client',      // outdir instead of outfile
  platform: 'browser',
  format: 'esm',
  bundle: true,
  splitting: true,             // enables dynamic import() code splitting
  minify: true,
  target: 'es2020',
});
```

Then in application code:
```typescript
async function enterEditMode() {
  const { createEditor } = await import('./editor/setup.js');
  createEditor(container, content);
}
```

---

## 8. Minimal Working Example (Vanilla TypeScript)

For reference, here is what a minimal markdown editor setup would look like for this project:

```typescript
import { basicSetup, EditorView } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { Compartment } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';

const themeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

export function createMarkdownEditor(
  parent: HTMLElement,
  doc: string,
  options: { dark?: boolean; readOnly?: boolean } = {},
): EditorView {
  return new EditorView({
    doc,
    parent,
    extensions: [
      basicSetup,
      markdown(),
      themeCompartment.of(options.dark ? oneDark : []),
      readOnlyCompartment.of(EditorView.editable.of(!options.readOnly)),
      EditorView.lineWrapping,
    ],
  });
}

export function setTheme(view: EditorView, dark: boolean): void {
  view.dispatch({
    effects: themeCompartment.reconfigure(dark ? oneDark : []),
  });
}

export function getContent(view: EditorView): string {
  return view.state.doc.toString();
}
```

---

## 9. Key Risks and Considerations

### Things that work well for this project
- Pure ESM, works with esbuild out of the box
- No CSS file management -- all styles injected via JS
- Compartments make runtime theme switching clean
- Undo/redo built in
- Markdown highlighting covers all standard elements
- Active maintenance (latest releases from March 12, 2026)
- MIT licensed
- 4.4M weekly downloads for @codemirror/view -- very mature

### Things to watch for
- **Bundle size**: With basicSetup + markdown, expect ~400KB minified (135KB gzipped). Enable `minify: true` in esbuild config.
- **No CSS custom properties natively**: Theming is CSS-in-JS. You CAN reference `var(--...)` in theme definitions, but it requires manual wiring if you want the editor to follow the app's CSS variable system.
- **Fenced code block highlighting is optional**: Without `@codemirror/language-data`, code blocks show as plain monospace. Adding it gives syntax highlighting inside fenced blocks but adds to bundle size (loads lazily though).
- **`codemirror` meta-package includes autocomplete, search, and lint**: If you want minimal size, you can skip the meta-package and import only what you need from `@codemirror/view`, `@codemirror/state`, `@codemirror/commands`, and `@codemirror/language`. But tree shaking handles most of this.
- **Markdown preview/WYSIWYG is not built in**: CodeMirror gives you a syntax-highlighted source editor. The existing markdown-it rendering pipeline would still be used for preview. There is a community plugin (`codemirror-rich-markdoc`) that does inline rich rendering, but it is immature (100 GitHub stars).

---

## Sources

| Source | Type | Credibility |
|--------|------|------------|
| [codemirror.net/docs/changelog](https://codemirror.net/docs/changelog/) | Official changelog | Authoritative -- primary source for version numbers |
| [npmjs.com/package/codemirror](https://www.npmjs.com/package/codemirror) | npm registry | Authoritative -- version 6.0.2 confirmed |
| [npmjs.com/package/@codemirror/state](https://www.npmjs.com/package/@codemirror/state) | npm registry | Authoritative -- version 6.6.0, released Mar 12, 2026 |
| [npmjs.com/package/@codemirror/view](https://npmjs.com/package/@codemirror/view) | npm registry | Authoritative -- version 6.40.0, released Mar 12, 2026 |
| [npmjs.com/package/@codemirror/language](https://www.npmjs.com/package/@codemirror/language) | npm registry | Authoritative -- version 6.12.2 |
| [npmjs.com/package/@codemirror/lang-markdown](https://www.npmjs.com/package/@codemirror/lang-markdown) | npm registry | Authoritative -- version 6.5.0, 1.1M weekly downloads |
| [npmjs.com/package/@codemirror/theme-one-dark](https://www.npmjs.com/package/@codemirror/theme-one-dark) | npm registry | Authoritative -- version 6.1.3, 2.1M weekly downloads |
| [npmjs.com/package/@codemirror/commands](https://www.npmjs.com/package/@codemirror/commands) | npm registry | Authoritative -- version 6.10.3 |
| [codemirror.net/examples/bundle](https://codemirror.net/examples/bundle/) | Official example | Authoritative -- bundle size numbers from maintainer |
| [codemirror.net/examples/config](https://codemirror.net/examples/config/) | Official example | Authoritative -- Compartment pattern for runtime config |
| [codemirror.net/docs/guide](https://codemirror.net/docs/guide/) | Official guide | Authoritative -- theming and extension architecture |
| [codemirror.net/docs/migration](https://codemirror.net/docs/migration/) | Official migration guide | Authoritative -- history/undo and architecture patterns |
| [github.com/codemirror/lang-markdown](https://github.com/codemirror/lang-markdown) | Official repo | Authoritative -- API reference, last push Mar 16, 2026 |
| [github.com/lezer-parser/markdown](https://github.com/lezer-parser/markdown) | Official Lezer repo | Authoritative -- parser node types |
| [discuss.codemirror.net - ESM thread](https://discuss.codemirror.net/t/esm-compatible-codemirror-build-directly-importable-in-browser/5933) | Forum (Marijn participated) | High -- confirms ESM design decisions |
| [discuss.codemirror.net - bundle size thread](https://discuss.codemirror.net/t/minimal-setup-because-by-default-v6-is-50kb-compared-to-v5/4514) | Forum | Medium -- community bundle size experience |
| [davidmyers.dev - CM6 TypeScript tutorial](https://davidmyers.dev/blog/how-to-build-a-code-editor-with-codemirror-6-and-typescript/introduction) | Blog | Medium -- practical setup walkthrough |
| [github.com/zipang/cm-markdown-editor](https://github.com/zipang/cm-markdown-editor) | Community project | Medium -- demonstrates CSS variable theming pattern |

---

## Confidence Assessment

- **Overall confidence: High** -- CodeMirror 6 is well-documented, actively maintained, and widely used. All version numbers come from npm/changelog primary sources dated within the last 2 weeks.
- **ESM compatibility: High confidence** -- confirmed by package exports, official examples, and the project's existing esbuild config which is already compatible.
- **Bundle size: Medium-High confidence** -- official numbers are from the bundling example page; actual numbers depend on which extensions are included and how aggressive tree shaking is. The 135KB gzipped figure for basicSetup + one language is well-established.
- **Theming with CSS variables: Medium confidence** -- this approach works in practice (community projects confirm it) but is not officially documented or recommended. It is a "works because style-mod generates CSS strings" pattern rather than a designed feature.
- **No areas of conflicting information found.**
