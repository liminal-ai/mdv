# Electron Ecosystem Package Versions -- March 2026

Research conducted: 2026-03-21

---

## 1. Electron

**Latest stable: `41.0.3`** (released 2026-03-17)

| Property | Value |
|---|---|
| Chromium | 146.0.7680.80 |
| Node.js (bundled) | 24.14.0 |
| V8 | 14.6 |
| EOL | 2026-08-25 |

The Electron team recommends 41.0.2+ (the 41.0.0 initial release had high-priority bugs patched in follow-ups).

Pin as: `"electron": "41.0.3"`

### Other supported stable branches

| Branch | Latest | Chromium | Bundled Node | EOL |
|---|---|---|---|---|
| 41.x | 41.0.3 | 146.0.7680.80 | 24.14.0 | 2026-08-25 |
| 40.x | 40.8.3 | 144.0.7559.236 | 24.14.0 | 2026-06-30 |
| 39.x | 39.8.3 | 142.0.7444.265 | 22.22.1 | 2026-05-05 |

### Prerelease

- Electron 42 alpha: 42.0.0-alpha.2 (Chromium 148, Node 24.14.0, stable ~May 5, 2026)

Sources:
- https://releases.electronjs.org/
- https://electronjs.org/blog/electron-41-0

---

## 2. electron-builder

**Latest stable (npm `latest` tag): `26.8.1`** (published ~2026-02-16)
**Latest on npm `next` tag: `26.8.2`** (published ~2026-03-04)

Pin as: `"electron-builder": "26.8.1"` (or `"26.8.2"` if you want the next-tag version)

### Ad-hoc signing on ARM64 macOS

**Yes, v26+ supports ad-hoc signing for ARM64 macOS builds.** This was introduced in PR #9007 (merged 2025-04-10, shipped in v26.0.13). The behavior:

- **ARM64/Universal builds**: Ad-hoc signature is applied automatically by default when no signing identity is configured. This prevents the "app is damaged" error on Apple Silicon Macs.
- **Intel-only builds**: Default is to not sign at all (unchanged behavior).
- **Explicit config**: Set `mac.identity: "-"` to force ad-hoc signing regardless of arch.

**Known issue (now closed)**: v26.0.13 introduced a regression where ad-hoc-signed apps lost Camera/Microphone access (issue #9529, closed 2026-02-19). The issue was closed without a code fix in electron-builder itself -- the macOS TCC restrictions were considered correct behavior. Workarounds:
  - Set `mac.identity: null` to skip signing entirely (but then users get "app is damaged" on ARM Macs)
  - Use an `afterSign` hook to deep-re-sign with proper entitlements

**For md-viewer (a markdown viewer with no camera/mic needs): the default ad-hoc signing in 26.8.1 is fine.** The regression only affects apps needing camera/microphone TCC permissions.

Sources:
- https://www.npmjs.com/package/electron-builder
- https://github.com/electron-userland/electron-builder/issues/9529
- https://github.com/electron-userland/electron-builder/pull/9007
- https://www.electron.build/code-signing-mac.html

---

## 3. @electron/rebuild

**Latest: `4.0.3`** (published 2026-01-27)

Pin as: `"@electron/rebuild": "4.0.3"`

Requirements:
- Node >= 22.12.0
- ESM-only (breaking change in v4.0.0)

**You likely do not need this package.** @electron/rebuild is only required when your app uses native Node.js addons (C/C++ modules compiled with node-gyp). Looking at md-viewer's dependencies:
- `@resvg/resvg-js` -- this IS a native module (Rust/NASM compiled to native). If you bring this into the Electron build, you will need @electron/rebuild.
- `puppeteer` -- uses a downloaded Chromium binary, not a native addon. Likely won't be bundled in Electron anyway.
- Everything else (Fastify, markdown-it, CodeMirror, etc.) is pure JS.

**Verdict**: You will need @electron/rebuild if `@resvg/resvg-js` is part of the Electron main process. If PDF/image export runs server-side only (not in the Electron shell), you can skip it.

Sources:
- https://www.npmjs.com/package/@electron/rebuild
- https://github.com/electron/rebuild/releases

---

## 4. Compatibility Analysis: Node 24, Fastify, TypeScript, esbuild

### Does Electron 41 work with Node 24?

**Electron 41 bundles Node 24.14.0.** It does NOT use your system Node.js. The bundled Node is compiled into the Electron binary itself.

Key point: **Your system Node 24 (used for development, npm install, build scripts) and Electron's bundled Node 24.14.0 are separate runtimes.** There is no conflict -- they never run simultaneously in the same process.

### Fastify in Electron's main process

**This works, but with important architectural nuances:**

1. **Fastify 5.8.x runs fine on Node 24.14.0** (Electron 41's bundled Node). Fastify is pure JavaScript with no native dependencies. It will execute in Electron's main process without issues.

2. **The real question is whether to listen on a port.** There are two patterns:
   - **Fastify on localhost:PORT**: Simplest. Fastify listens on a TCP port, BrowserWindow loads `http://localhost:PORT`. Works perfectly. The only downside: port allocation and security (other local apps can reach it).
   - **Custom protocol (no port)**: Use `protocol.handle()` to route Electron's custom scheme to Fastify. The `electron-server` package by Yagiz Nizipli (Fastify team member) does exactly this. However, that package is from 2022 and likely needs updating for Electron 41.

3. **No Node version conflict**: Electron's main process runs on its bundled Node 24.14.0. Your build toolchain (esbuild, tsc) runs on your system Node 24. They are completely separate. esbuild bundles your code into a JS file, and Electron's Node executes that bundle.

### TypeScript 5.9.3 / esbuild 0.27.4

- **TypeScript 5.9.3**: Used only at build time (your system Node). No runtime impact on Electron. Fully compatible.
- **esbuild 0.27.4**: Used only at build time. Produces the JS bundle that Electron loads. No compatibility concern.
- **Note on @types/node**: There was a type conflict issue (electron/electron#49213) with `@types/node` v22/24 and Electron's type definitions. This was fixed in Electron 39+. With Electron 41 and `@types/node@^22.0.0` (as in your package.json), you should be fine. You may want to also install `@types/electron` or just use the types bundled with the `electron` package.

Sources:
- https://electronjs.org/blog/electron-41-0
- https://github.com/electron/electron/issues/49213
- https://github.com/anonrig/electron-server

---

## 5. Window State Persistence

### Recommended: `electron-window-state` v5.0.3

**Latest: `5.0.3`** (last published 2018, but still the most widely used and stable option)

Pin as: `"electron-window-state": "5.0.3"`

This is the de facto standard. 679 GitHub stars, 67 forks, 102 npm dependents. It uses `jsonfile` internally to persist to `app.getPath('userData')/window-state.json`. Simple API:

```js
const windowStateKeeper = require('electron-window-state');

let mainWindowState = windowStateKeeper({
  defaultWidth: 1000,
  defaultHeight: 800
});

let win = new BrowserWindow({
  x: mainWindowState.x,
  y: mainWindowState.y,
  width: mainWindowState.width,
  height: mainWindowState.height
});

mainWindowState.manage(win);
```

**Caveat**: This is CommonJS only. In an ESM Electron main process, you'll need `import { createRequire } from 'module'` or a dynamic import shim.

### Alternative: `electron-store` v11.0.2

If you want general key-value persistence (not just window state), `electron-store` is the standard choice:

**Latest: `11.0.2`** (published 2025-10-05)

Pin as: `"electron-store": "11.0.2"`

Requirements:
- Electron >= 30
- ESM only (no CommonJS export)
- Built on `conf` by Sindre Sorhus

**Known issue**: Some users report `Store is not a constructor` errors when bundled with certain build tools (issue #298). The workaround is `new Store.default()` but this shows TypeScript errors. This may matter if esbuild bundles it as CJS interop.

### Alternative: `electron-conf` v1.3.0

A cleaner fork of `conf` designed specifically for Electron:

**Latest: `1.3.0`** (published 2025-03-16)

Pin as: `"electron-conf": "1.3.0"`

- Supports both CJS and ESM
- Works in main and renderer processes
- Lighter than electron-store (fewer dependencies)
- No watch/encryption features

### Alternative: Roll your own (~20 lines)

For just window state, you can write it yourself with `fs.writeFileSync` + `app.getPath('userData')`. Many Electron apps do this to avoid the dependency. Save bounds on `close`, restore on `ready`.

### Recommendation for md-viewer

**Use `electron-window-state@5.0.3`** for window state specifically. It does one thing well, is battle-tested, and has no meaningful maintenance concerns (the API surface is stable and tiny). If you need broader persistence later, add `electron-conf@1.3.0` (better ESM story than electron-store).

Sources:
- https://www.npmjs.com/package/electron-window-state
- https://github.com/mawie81/electron-window-state
- https://www.npmjs.com/package/electron-store
- https://github.com/sindresorhus/electron-store/issues/298
- https://github.com/alex8088/electron-conf

---

## Summary: Pinned Versions for package.json

```json
{
  "devDependencies": {
    "electron": "41.0.3",
    "electron-builder": "26.8.1",
    "@electron/rebuild": "4.0.3"
  },
  "dependencies": {
    "electron-window-state": "5.0.3"
  }
}
```

Notes:
- `electron` is a devDependency (it provides the runtime binary, not a library your code imports at runtime in the traditional npm sense).
- `electron-builder` is a devDependency (build tooling only).
- `@electron/rebuild` is a devDependency, only needed if bundling native modules like `@resvg/resvg-js`.
- `electron-window-state` is a runtime dependency (loaded by the Electron main process).

---

## Confidence Assessment

- **Electron 41.0.3 version/deps**: HIGH -- confirmed from official releases.electronjs.org
- **electron-builder 26.8.1**: HIGH -- confirmed from npm registry. Note: 26.8.2 exists on `next` tag.
- **Ad-hoc signing support**: HIGH -- confirmed from docs and issue tracker. No camera/mic concern for this app.
- **@electron/rebuild 4.0.3**: HIGH -- confirmed from npm and GitHub releases.
- **Node 24 / Fastify compatibility**: HIGH -- Electron 41 bundles Node 24.14.0, Fastify is pure JS.
- **electron-window-state 5.0.3**: MEDIUM -- the package is old (2018) but stable and widely used. ESM interop needs testing.
- **electron-store ESM issues**: MEDIUM -- confirmed open issue, may affect bundled builds.
