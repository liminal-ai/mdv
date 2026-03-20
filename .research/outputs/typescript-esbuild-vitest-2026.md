# TypeScript + esbuild + Vitest: Current State (March 2026)

Research conducted: 2026-03-19

---

## Summary

As of March 2026, the JavaScript tooling ecosystem is in a significant transition period. TypeScript 5.9.3 is the current stable release, with TypeScript 6.0 at the RC stage (expected stable ~March 17, 2026). esbuild is at v0.27.4 and remains stable with no major ESM-related breaking changes. Vitest is at v4.1.0-beta (v4.0.x stable), having dropped Vite 5 support and migrated its internals. All three tools work well together in ESM TypeScript projects, but the TypeScript 6.0 transition introduces meaningful configuration changes that need attention.

---

## 1. TypeScript: Current Versions and ESM/NodeNext Support

### Latest Stable: 5.9.3
- Published ~6 months ago on npm
- Downloads: 53M+ weekly on the `latest` tag
- This is the safe production choice right now

### TypeScript 6.0: RC (6.0.1-rc as of March 2026)
- **Stable release targeted for ~March 17, 2026** (may already be out)
- This is the LAST JavaScript-based TypeScript compiler. TypeScript 7.0 will be rewritten in Go ("Project Corsa")
- 6.0 is a bridge/alignment release preparing the ecosystem for 7.0

### Key TypeScript 6.0 Changes

**New defaults (breaking for existing projects):**
- `strict` defaults to `true` (was `false`)
- `module` defaults to `"esnext"` (was `"commonjs"`)
- `target` defaults to `"es2025"` (was `"es2015"`)
- `types` defaults to `[]` (was auto-include everything) -- **you must add `"types": ["node"]` explicitly**
- `rootDir` defaults to the tsconfig directory

**Deprecations and removals:**
- `moduleResolution: "node"` (node10) is **deprecated** -- migrate to `"nodenext"` or `"bundler"`
- `target: "es5"` deprecated
- `--baseUrl` deprecated as a module lookup root
- Module formats `amd`, `umd`, `systemjs`, `none` removed
- `--outFile` removed (use external bundlers)
- `esModuleInterop: false` no longer permitted
- Import `asserts` keyword deprecated (use `with`)
- Legacy `module` namespace syntax is now an error (use `namespace`)

**New features:**
- `es2025` target support with `RegExp.escape()` and Temporal APIs
- Map/WeakMap upsert methods (`getOrInsert`, `getOrInsertComputed`)
- Subpath imports with `#/` prefix (works with `nodenext` and `bundler` resolution)
- `--stableTypeOrdering` flag to preview TS 7.0 type ordering behavior
- `bundler` resolution can now combine with `--module commonjs`

### ESM + NodeNext Status

ESM with `"module": "nodenext"` and `"moduleResolution": "nodenext"` is now the **recommended path** for Node.js backend projects. TypeScript 6.0 makes this the default direction by:
- Deprecating the old `"node"` (node10) module resolution
- Defaulting `module` to `"esnext"`
- Requiring explicit file extensions in imports (enforced by NodeNext)

**The `"bundler"` moduleResolution** remains the right choice when your code goes through a bundler (esbuild, Vite, webpack) before reaching Node.js. It's more lenient (no mandatory `.js` extensions in imports) while still supporting modern module features.

### Practical Guidance

For a project using esbuild as the build tool:
- Use `"moduleResolution": "bundler"` and `"module": "esnext"` (or `"nodenext"` if you want strict Node.js compat)
- If staying on TS 5.9.3, your existing config works fine
- If upgrading to TS 6.0, add `"types": ["node"]` to tsconfig and review deprecation warnings
- Use `"ignoreDeprecations": "6.0"` temporarily if you need to suppress warnings during migration

---

## 2. esbuild: Current Version and Status

### Latest Version: 0.27.4 (released March 12, 2026)

esbuild remains a stable, fast bundler with incremental improvements. There have been no dramatic ESM-related breaking changes recently.

### Breaking Changes in the 0.25-0.27 Range

**v0.27.0 (the main breaking change release):**
- **Binary loader modernization**: Uses `Uint8Array.fromBase64` when available. May require specifying `--target=node22` or similar if your Node doesn't support this
- **OS requirements raised**: Go compiler updated from v1.23 to v1.25, requiring Linux kernel 3.2+ and macOS 12+
- **`using` in switch statements**: `using` keyword now forbidden inside `switch` case clauses without block statements (must wrap in `{ }`)

**v0.25.0:**
- Source map behavior changes (inline vs external behave slightly differently)

### Recent Improvements (v0.25-0.27)
- `#/` subpath import prefix support (matching Node.js spec relaxation)
- CSS `@scope` rule parsing and improved CSS modules support
- `-webkit-mask` vendor prefix auto-addition
- URL fragment preservation in data URLs
- Symbol constructor tree-shaking
- IIFE inlining improvements
- CSS media query parsing

### ESM + TypeScript Handling

esbuild handles ESM TypeScript well and has for a long time:
- Native `.ts` and `.tsx` support
- `format: "esm"` works reliably
- Handles `import.meta` and top-level `await`
- Strips type annotations without type-checking (as expected)
- Does NOT do type-checking (you still need `tsc --noEmit` for that)
- Handles `export type` and `import type` syntax correctly
- Tree-shaking works well with ESM

**Important esbuild limitation**: esbuild does NOT support TypeScript's `emitDecoratorMetadata`, some edge cases with `const enum` across files, or TypeScript-specific path resolution from tsconfig `paths` without a plugin. For `paths`, use `esbuild-plugin-tsc` or `tsconfig-paths` plugin.

---

## 3. Vitest: Current Version and Status

### Latest Stable: 4.0.x (v4.0.0 released October 22, 2025)
### Latest Beta: 4.1.0-beta (March 12, 2026)

Vitest 4.0 was a significant major release with substantial breaking changes.

### Key Breaking Changes in Vitest 4.0

**Infrastructure:**
- **Requires Vite 6+** (dropped Vite 5 support)
- Migrated from `vite-node` to Vite's `module-runner` internally
- Pool system completely rewritten (removed `tinypool` dependency)

**API/Config removals:**
- `'basic'` reporter removed
- `UserConfig` type removed (use `ViteUserConfig`)
- Node types removed from main entry -- import from `vitest/node` instead
- `workspace` config option removed (use `projects`)
- `getSourceMap` removed
- `ErrorWithDiff` replaced with `TestError`
- `minWorkers` option removed
- Snapshot obsolescence now fails tests on CI (was warning)

**ESM-specific changes:**
- `vi.spyOn()` on module namespace objects is **breaking** in ESM -- "Cannot spy on export. Module namespace is not configurable in ESM" error. This is a known pain point with open issues. Use `vi.mock()` instead
- CSS imports from ESM packages can fail ("Unknown file extension .css") -- open issue as of Jan 2026

**New features in 4.0:**
- Stable Browser Mode
- Visual regression testing (`toMatchScreenshot`)
- Schema validation matchers
- Playwright tracing support
- `toBeNullable` and `toBeInViewport` matchers
- `expect.assert` with type narrowing

### Vitest 4.1 (Beta)
- Chai-style assertions
- `doMock` returns disposable
- Enhanced Playwright trace support
- Various stability fixes
- **Note**: Vitest 4.1-beta has a known issue with Vite 8 beta around esbuild/oxc config conflicts

### ESM + TypeScript in Vitest

Vitest has **native ESM and TypeScript support** through Vite's transform pipeline:
- TypeScript is transformed via esbuild (or oxc in newer Vite versions) under the hood
- ESM imports work natively -- no transform to CJS
- `import.meta` is supported
- Watch mode is fast because it uses Vite's HMR graph

---

## 4. How These Three Tools Work Together (2026)

### Recommended Architecture

```
TypeScript (tsc)  --> Type checking only (tsc --noEmit)
esbuild           --> Production builds (bundling, minification)
Vitest            --> Testing (uses Vite/esbuild for transforms internally)
```

### Typical Configuration

**package.json:**
```json
{
  "type": "module",
  "scripts": {
    "build": "esbuild src/index.ts --bundle --format=esm --outdir=dist --platform=node",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

**tsconfig.json (with TS 5.9.3):**
```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

**tsconfig.json (if upgrading to TS 6.0):**
```json
{
  "compilerOptions": {
    "target": "es2025",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```
Note: TS 6.0 defaults to `strict: true`, `module: "esnext"`, `target: "es2025"` anyway, so you can omit those. But explicit is better.

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

### Why They Complement Each Other

- **TypeScript** provides type safety but its compiler (`tsc`) is slow for builds. Use it only for type-checking
- **esbuild** is extremely fast for transpilation and bundling but does zero type-checking
- **Vitest** uses Vite (which uses esbuild internally for TypeScript transforms) so your test transforms match your dev transforms. No dual-config problem like Jest + babel-jest

---

## 5. Known Issues and Gotchas

### TypeScript 6.0 Migration Gotchas
1. **`types` defaults to `[]`** -- If you forget to add `"types": ["node"]`, you'll get "Cannot find name 'process'" and similar errors everywhere
2. **`rootDir` default change** -- May affect where output files land if you relied on inferred rootDir
3. **`moduleResolution: "node"` deprecated** -- Projects still using this will get warnings; switch to `"bundler"` or `"nodenext"`
4. **`esModuleInterop: false` no longer allowed** -- If any dependency or config had this off, it will error
5. **`--outFile` removed** -- If you used TypeScript's built-in concatenation, you need esbuild or another bundler

### esbuild Gotchas
1. **No type checking** -- Always run `tsc --noEmit` in CI. esbuild will happily bundle code with type errors
2. **`const enum` limitation** -- esbuild treats `const enum` as regular `enum`. Cross-file const enum inlining doesn't work. Use regular `enum` or string literal unions instead
3. **tsconfig `paths`** -- esbuild doesn't read tsconfig `paths` natively. Use a plugin or avoid path aliases in favor of Node.js subpath imports (`#/`)
4. **`emitDecoratorMetadata`** -- Not supported by esbuild. If you need this (e.g., some NestJS setups), use SWC instead
5. **esbuild 0.27.0 `using` keyword** -- If you have `using` declarations in switch cases without braces, they'll fail

### Vitest Gotchas
1. **`vi.spyOn()` on ESM modules is broken** -- Module namespaces are frozen in ESM. You cannot `spyOn` named exports directly. Use `vi.mock()` with factory functions instead
2. **CSS imports from ESM packages** -- Vitest can fail on third-party packages that import `.css` files in their ESM entry points. Workaround: mock CSS imports in test setup
3. **Requires Vite 6+** -- If you're on Vite 5, you cannot use Vitest 4.x
4. **Node types moved** -- Import types from `vitest/node` not from `vitest` directly
5. **Snapshot obsolescence fails on CI** -- Obsolete snapshots that were previously just warnings will now fail your CI. Run `vitest --update` locally to clean up
6. **Vite 8 beta + Vitest 4.1 beta** -- Known conflict around esbuild vs oxc transformer config. Stick with Vite 7.x stable + Vitest 4.0.x stable for production

### ESM-Specific Cross-Cutting Issues
1. **File extensions in imports** -- If using `moduleResolution: "nodenext"`, you must use `.js` extensions in imports even for `.ts` files. If using `"bundler"`, you can omit extensions
2. **`require()` doesn't work in ESM** -- If a dependency uses `require()`, it may break at runtime. Use `createRequire` from `node:module` as a workaround
3. **`__dirname` / `__filename` don't exist in ESM** -- Use `import.meta.url` with `fileURLToPath` instead
4. **JSON imports** -- Need `{ type: "json" }` import attribute in Node.js ESM. esbuild handles this in bundled output, but if running unbundled TS with a loader, be aware

---

## Version Summary Table

| Tool        | Latest Stable | Latest Pre-release    | Notes                                      |
|-------------|---------------|-----------------------|--------------------------------------------|
| TypeScript  | 5.9.3         | 6.0.1-rc              | 6.0 stable expected ~March 17, 2026        |
| esbuild     | 0.27.4        | --                    | Stable, incremental improvements           |
| Vitest      | 4.0.x         | 4.1.0-beta            | Major rewrite from v3, requires Vite 6+    |
| Vite        | 7.x (stable)  | 8.0.0-beta            | Vitest 4.0 works with Vite 6+/7.x         |

---

## Recommendations for New Projects (March 2026)

1. **Use TypeScript 5.9.3** for stability. TS 6.0 RC is very close to release and mostly safe, but 5.9.3 is proven. Configure your tsconfig as if you're on 6.0 (use `"bundler"` or `"nodenext"`, set `strict: true`, set `types: ["node"]`) so migration is trivial later
2. **Use esbuild 0.27.4** -- it's stable and well-suited for ESM TypeScript bundling
3. **Use Vitest 4.0.x stable** (not 4.1 beta) with Vite 7.x
4. **Set `"type": "module"` in package.json** to go ESM-first
5. **Use `"moduleResolution": "bundler"`** if your code goes through esbuild/Vite before hitting Node.js. Use `"nodenext"` only if you need strict Node.js ESM compat (e.g., publishing a package meant to run without bundling)
6. **Run `tsc --noEmit` in CI** alongside esbuild builds. They serve different purposes

---

## Sources

- [TypeScript 6.0 RC Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0-rc/) - Official Microsoft blog, March 6, 2026. Highly authoritative
- [TypeScript 6.0 Beta Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0-beta/) - Official, Feb 11, 2026
- [TypeScript npm versions page](https://www.npmjs.com/package/typescript?activeTab=versions) - Shows 5.9.3 as `latest`, 6.0.1-rc as `rc`
- [esbuild CHANGELOG.md](https://github.com/evanw/esbuild/blob/main/CHANGELOG.md) - Official changelog, covers 0.25-0.27 changes
- [esbuild v0.27.4 release](https://newreleases.io/project/github/evanw/esbuild/release/v0.27.4) - March 12, 2026
- [Vitest 4.0.0 release notes](https://github.com/vitest-dev/vitest/releases/tag/v4.0.0) - Official, October 22, 2025
- [Vitest 4.0 InfoQ coverage](https://www.infoq.com/news/2025/12/vitest-4-browser-mode/) - December 2025
- [Vitest 4.1.0 release notes](https://releasebot.io/updates/vitest) - March 12, 2026
- [Vitest ESM spyOn issue #9467](https://github.com/vitest-dev/vitest/issues/9467) - Open, January 2026
- [Vitest CSS import issue #9460](https://github.com/vitest-dev/vitest/issues/9460) - Open, January 2026
- [Vitest esbuild/oxc conflict #9800](https://github.com/vitest-dev/vitest/issues/9800) - Closed, March 2026
- [TypeScript 6.0 migration guide (BSWEN)](https://docs.bswen.com/blog/2026-02-21-typescript-60-migration-guide) - Community guide, Feb 2026
- [TypeScript 6.0 tsconfig defaults (BSWEN)](https://docs.bswen.com/blog/2026-02-21-typescript-60-tsconfig-defaults) - Community guide, Feb 2026
- [State of TypeScript 2026](https://devnewsletter.com/p/state-of-typescript-2026/) - Jan 2026 ecosystem overview

## Confidence Assessment

- **Overall confidence: High** -- Primary sources are official blogs, changelogs, npm registry, and GitHub issues
- **TypeScript versions**: Very high confidence (official npm tags, official blog posts)
- **esbuild versions**: Very high confidence (official GitHub changelog)
- **Vitest versions**: High confidence (official GitHub releases, confirmed by multiple sources)
- **Compatibility advice**: Medium-high confidence -- based on official docs and community reports. Specific edge cases may vary by project
- **Area of uncertainty**: Whether TS 6.0 stable has actually shipped as of March 19 (it was targeted for March 17). The RC is 6.0.1-rc which suggests possible point release adjustments
