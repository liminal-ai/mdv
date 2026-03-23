# Package Version Research: commander & tar-stream

**Date**: 2026-03-22
**Purpose**: Pin versions for tech design document

---

## 1. commander

| Field | Value |
|---|---|
| **Latest stable version** | **14.0.3** |
| **Published** | 2026-01-31 |
| **License** | MIT |
| **Node.js requirement** | >= 20 |
| **Module system** | CommonJS (with ESM wrapper) |
| **Dependencies** | 0 |
| **Weekly downloads** | ~121K dependents |
| **Repository** | https://github.com/tj/commander.js |

### Recommended pin

```
"commander": "^14.0.3"
```

### TypeScript support

Commander ships **built-in type declarations** (`typings/index.d.ts`). No `@types/commander` needed. Coverage is comprehensive: `Command`, `Option`, `Argument`, `Help`, all configuration interfaces.

For stronger inferred types on action handlers and `.opts()`, there is an optional companion package `@commander-js/extra-typings` (v14.0.0, ~2M weekly downloads). It is import-time only -- runtime is still supplied by `commander`.

### Breaking changes in v14 (May 2024)

- Requires Node.js v20+
- Excess command-arguments cause an error by default
- Added option/command grouping in help output
- Unescaped negative numbers supported as arguments

### Upcoming: v15 (May 2026)

A prerelease `15.0.0-0` was published 2026-02-21. **Do not use for production yet.** Key changes:
- ESM-only (no more CommonJS implementation)
- Requires Node.js v22.12.0+
- Removes deprecated `commander/esm.mjs` export
- Breaking change to `--no-*` option default behavior

v15 is planned for May 2026. After release, v14 enters maintenance with security updates until May 2027.

### Actively maintained?

Yes. Actively maintained by @shadowspawn (collaborator). Regular patch releases, clear release policy, 12-month maintenance window for older majors.

---

## 2. tar-stream

| Field | Value |
|---|---|
| **Latest stable version** | **3.1.8** |
| **Published** | ~2026-03-20 (described as "2 days ago" on 2026-03-22) |
| **License** | MIT |
| **Module system** | CommonJS (with `import` support via bundlers) |
| **Dependencies** | 4: `b4a`, `bare-fs`, `streamx`, `fast-fifo` |
| **Weekly downloads** | ~52.7M |
| **Dependents** | 987 |
| **Repository** | https://github.com/mafintosh/tar-stream |
| **Author** | Mathias Buus (mafintosh) |

### Recommended pin

```
"tar-stream": "^3.1.8"
```

### TypeScript support

tar-stream does **not** ship built-in types. Use DefinitelyTyped:

```
"@types/tar-stream": "^3.1.4"
```

Published June 2025. Covers the v3.1 API surface. Install as a devDependency.

### Pack and extract support

Yes, tar-stream exposes **both** operations:

- **`tar.pack()`** -- creates a writable stream that generates tar data. Add entries via `pack.entry(header, [callback])`. Call `pack.finalize()` when done.
- **`tar.extract()`** -- creates a writable stream that parses tar data. Emits `entry` events with `(header, stream, next)`.

Both are pure streaming -- no filesystem access required. For filesystem bindings, the companion package `tar-fs` wraps tar-stream.

USTAR format with pax extended header support. Compatible with gnutar, bsdtar, etc.

**Note**: tar-stream does not handle gzip. For `.tar.gz` files, pipe through `gunzip-maybe` or `zlib.createGunzip()` first.

### Breaking changes in v3 (historical)

v3 was a major rewrite from v2:
- Switched internal stream implementation from Node.js core streams to `streamx`
- Dropped older Node.js version support
- API surface remained largely the same (pack/extract pattern preserved)

No breaking changes within the 3.x line. The 3.1.x releases have been incremental patches.

### Actively maintained?

Yes. Regular patch releases through March 2026. 52.7M weekly downloads indicates wide ecosystem adoption. Maintained by mafintosh (Mathias Buus) and maxogden.

---

## Summary for tech design pinning

| Package | Pin version | Types |
|---|---|---|
| `commander` | `^14.0.3` | Built-in (ships `.d.ts`) |
| `tar-stream` | `^3.1.8` | `@types/tar-stream@^3.1.4` (devDep) |

Both packages are MIT-licensed, actively maintained, and safe choices for production use in March 2026.

---

## Sources

- [commander on npm](https://www.npmjs.com/package/commander) -- npm registry, authoritative
- [commander GitHub releases](https://github.com/tj/commander.js/releases) -- official release notes
- [commander v15 prerelease announcement](https://github.com/tj/commander.js/issues/2487) -- maintainer issue, Feb 2026
- [commander built-in typings](https://github.com/tj/commander.js/blob/master/typings/index.d.ts) -- source repo
- [@commander-js/extra-typings on npm](https://www.npmjs.com/package/@commander-js/extra-typings) -- companion types package
- [tar-stream on npm](https://www.npmjs.com/package/tar-stream) -- npm registry, authoritative
- [@types/tar-stream on npm](https://www.npmjs.com/package/@types/tar-stream) -- DefinitelyTyped
- [Aikido Intel: tar-stream](https://intel.aikido.dev/packages/npm/tar-stream) -- security/health scoring
- [PkgPulse: nanotar vs tar-stream vs node-tar](https://www.pkgpulse.com/blog/nanotar-vs-tar-stream-vs-node-tar-tar-file-handling-nodejs-2026) -- comparison article, March 2026

## Confidence

**High**. Version numbers confirmed across multiple independent sources (npm registry, GitHub, third-party trackers). TypeScript support status verified from source repos and DefinitelyTyped.
