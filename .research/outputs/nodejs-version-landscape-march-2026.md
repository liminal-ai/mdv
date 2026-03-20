# Node.js Version Landscape -- March 2026

## Summary

As of March 2026, Node.js has two active LTS lines: **v24 (Krypton)** is the Active LTS and **v22 (Jod)** is in Maintenance LTS. The "Current" (latest) release line is **v25**. Node.js 20 hits end-of-life on April 30, 2026. A major policy change was announced on March 10, 2026: starting with v27, Node.js moves to one major release per year (every April), and every release becomes LTS. The old odd/even distinction is being retired.

For new projects starting in March 2026, **Node.js 24 is the recommended choice**. It is the Active LTS with support through April 2028, ships npm v11, has stable native TypeScript type-stripping, and stabilizes several APIs that were experimental in v22 (including `fs.glob`).

---

## 1. Current LTS Version

**Node.js 24 (Krypton) -- Active LTS**

- First released: May 6, 2025
- Entered LTS: October 2025
- Latest patch: v24.14.0 (February 24, 2026)
- Active LTS ends: ~October 2026
- Maintenance LTS ends: April 2028

**Node.js 22 (Jod) -- Maintenance LTS**

- First released: April 24, 2024
- Entered LTS: October 2024
- Latest patch: v22.22.1 (March 5, 2026)
- Active LTS ended: ~April 2026
- Maintenance LTS ends: April 2027

**Node.js 20 (Iron) -- Maintenance LTS (EOL imminent)**

- Latest patch: v20.20.1 (March 5, 2026)
- End of Life: **April 30, 2026** -- no more security patches after this date

## 2. Current "Latest" Version

**Node.js 25 -- Current**

- First released: October 15, 2025
- Latest patch: v25.8.1 (March 11, 2026)
- Status: Current (not LTS; odd-numbered under old scheme)
- Will become unsupported when v26 releases (~April 2026)
- Not recommended for production use

## 3. ESM Support Status in Latest LTS (v24)

ESM support in Node.js 24 is mature and production-ready:

- **`require(esm)` is stable and unflagged.** The `--experimental-require-module` flag is no longer needed. You can load ES modules from CommonJS using `require()` directly, as long as the ESM module contains no top-level `await`. This was the single biggest CJS/ESM interop pain point and it is now resolved.
- **Native ESM has been fully supported** since Node.js 12+, but the interop story is now complete in v24.
- **`"type": "module"` in package.json** works as expected. `.mjs` and `.cjs` extensions work for disambiguation.
- In Node.js 22, `require(esm)` was available but required `--experimental-require-module`. In v24, it is stable.

**Node.js 22 ESM status:** `require(esm)` support was introduced experimentally via `--experimental-require-module`. Later v22 patches (22.x line) progressed this toward being unflagged, but it reached full stable status in v24.

## 4. Is Recursive `fs.watch` Stable?

**Yes, but with platform caveats.**

- Recursive `fs.watch` is a stable feature (no longer experimental).
- It was added to Linux/AIX/IBMi in Node.js 19 (late 2022) and was already available on macOS and Windows via native OS APIs before that.
- **Platform behavior varies:**
  - **macOS:** Uses `FSEvents` natively. Recursive watching works reliably.
  - **Windows:** Uses `ReadDirectoryChangesW` natively. Recursive watching works reliably.
  - **Linux:** Uses a userland implementation built on top of `inotify` (which does not natively support recursive watching). This implementation has had various bugs over time (race conditions with rapid file changes, issues with `.close()` in older versions, symlink edge cases). Most of these have been fixed in v22+ but Linux recursive watching is inherently less reliable than macOS/Windows.
- **Practical recommendation:** For development tooling (file watchers, dev servers), recursive `fs.watch` is usable on all platforms. For production file-watching scenarios on Linux, consider supplementing with a library like `chokidar` or `@parcel/watcher` that handles edge cases more gracefully.

## 5. Is `fs.glob` Available?

**Yes.**

- **Introduced:** Node.js v22.0.0 (April 2024) as experimental.
- **Stabilized in v22.17.0** (within the v22 LTS line). Available in all three forms: `fs.glob()`, `fs.globSync()`, and `fs.promises.glob()`.
- **Stable in v24** from the start (since v24 includes all v22 stabilizations).

Available APIs:
```js
import { glob } from 'node:fs/promises';
for await (const entry of glob('**/*.js')) {
  console.log(entry);
}
```

Options include `cwd`, `exclude` (function or glob pattern list), and `withFileTypes` (returns Dirent objects).

**Known limitations (as of March 2026):**
- Pattern documentation is sparse (GitHub issue #58981 is open about this).
- Globstar (`**`) does not match dot/hidden files by default (no `dot` option yet; GitHub issue #56321).
- No `onlyFiles` filter -- directories are included in results. Use the `exclude` option with a function to filter: `exclude(entry) { return entry.isDirectory(); }`.
- Does not support all features of userland `fast-glob`/`globby` (e.g., brace expansion behavior differs, no negation patterns).

For simple use cases (finding files by extension, walking directories), native `fs.glob` is ready to use. For complex glob patterns, userland libraries like `glob` or `fast-glob` remain more capable.

## 6. Recommended Minimum Node Version for New Projects (March 2026)

**Node.js 24 (Active LTS)**

Rationale:
- Active LTS with support through April 2028 (longest active support window available).
- `require(esm)` is stable and unflagged -- eliminates the CJS/ESM interop headache.
- `fs.glob` is stable.
- Native TypeScript type-stripping is stable (run `.ts` files without a build step for simple cases).
- npm v11 ships by default (65% faster installs than v10).
- V8 13.4 with Float16Array, RegExp.escape(), improved GC.
- Node.js 22 enters maintenance-only mode in April 2026. Starting on v22 today means you will need to plan a migration within a year.

**If you must support Node.js 22:** It remains a valid choice for existing projects. It is maintained through April 2027. But for greenfield work, there is no reason to start on v22 when v24 LTS is available and offers a longer support window plus meaningful improvements.

**Avoid Node.js 20** for new projects. It reaches end-of-life on April 30, 2026.

---

## Release Schedule Change (Announced March 10, 2026)

Starting with Node.js 27 (expected April 2027), the project moves to **one major release per year**:
- Every major release will become LTS (no more odd-numbered "throwaway" releases).
- Major releases ship in April; LTS designation in October.
- Version numbers will loosely align with the year (v27 in 2027, v28 in 2028, etc.).
- LTS support window remains ~30 months.
- The v26 release in April 2026 is the last under the old schedule.

This change simplifies planning: every release matters, and library authors should integrate alpha builds into CI early.

---

## Quick Reference Table

| Version | Status | Latest Patch | Support Ends | Recommendation |
|---------|--------|-------------|--------------|----------------|
| v25     | Current | 25.8.1 | ~Apr 2026 (unsupported when v26 ships) | Do not use in production |
| v24     | **Active LTS** | 24.14.0 | Apr 2028 | **Use for new projects** |
| v22     | Maintenance LTS | 22.22.1 | Apr 2027 | Fine for existing projects |
| v20     | Maintenance LTS | 20.20.1 | **Apr 30, 2026** | Migrate away immediately |

---

## Sources

- [nodejs.org/en/about/previous-releases](https://nodejs.org/en/about/previous-releases) -- Official release table. Highly authoritative.
- [endoflife.date/nodejs](https://endoflife.date/nodejs) -- Community-maintained EOL tracker. Updated March 12, 2026. Reliable.
- [nodejs.org blog: Evolving the Release Schedule](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule) -- Official announcement, March 10, 2026.
- [nodejs.org blog: Node.js 22 release announcement](https://nodejs.org/en/blog/announcements/v22-release-announce) -- Official. Covers fs.glob, require(esm), watch mode.
- [pkgpulse.com: Node.js 22 vs 24](https://www.pkgpulse.com/blog/nodejs-22-vs-nodejs-24-2026) -- Blog comparison, March 2026. Well-researched.
- [GitHub nodejs/node #58981](https://github.com/nodejs/node/issues/58981) -- fs.glob documentation gap issue. Confirms stable as of v24.
- [GitHub nodejs/node #51912](https://github.com/nodejs/node/pull/51912) -- Original PR exposing fs.glob. Merged March 2024.
- [nodesource.com: 15 Node.js Features Replacing npm Packages](http://nodesource.com/blog/nodejs-features-replacing-npm-packages/) -- Confirms fs.glob stable in v22.17.0.
- [bybowu.com: Node.js Release Schedule Just Changed](https://bybowu.com/news/nodejs-release-schedule-just-changed-what-now) -- Practical upgrade guide, March 2026.
- [Chinese Node.js API docs for v22](https://nodejs.cn/api/v22/fs/fs_glob_pattern_options_callback.html) -- Shows version history for fs.glob stabilization at v22.17.0.

## Confidence Assessment

- **Overall confidence: High.** Multiple authoritative sources agree on version numbers, dates, and feature status.
- **fs.glob stability: High confidence.** Confirmed stable in v22.17.0 and v24 by official docs, GitHub issues, and multiple blog sources.
- **fs.watch recursive stability: Medium-High confidence.** The API itself is stable (Stability 2), but Linux-specific edge cases remain a practical concern. The official docs flag platform caveats. No source indicates it is still "experimental."
- **Recommendation for v24: High confidence.** Every source recommends v24 for new projects in 2026.
