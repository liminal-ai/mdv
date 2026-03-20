# Electron ESM Support & Fastify Wrapping -- March 2026

## Summary

Electron 41 (released March 10, 2026) is the latest stable version. It bundles Node.js v24.14.0, which has full stable ESM support including `require(esm)` interop. The main process supports native ESM via the Node.js loader -- your `"type": "module"` in package.json will work. There are real gotchas to know about (mostly around async timing and preload scripts), but none that would block your planned architecture of building browser-first Fastify now and wrapping in Electron later. Wrapping a local Fastify server in Electron is a well-established pattern with multiple viable approaches.

**Bottom line: Your ESM-first Fastify approach today will not create friction when you wrap in Electron later.**

---

## 1. Latest Stable Electron Version

**Electron 41.0.2** (recommended patch), released March 2026.

| Component | Version |
|-----------|---------|
| Electron  | 41.0.2  |
| Chromium  | 146.0.7680.65 |
| Node.js   | v24.14.0 |
| V8        | 14.6 |

Previous recent: Electron 40 (Jan 2026) bundled Node v24.11.1.

---

## 2. Does Electron Support ESM Natively in the Main Process?

**Yes.** Since Electron 28 (late 2023), the main process uses the Node.js ESM loader natively. Two ways to activate it:

- File ends with `.mjs` extension
- Nearest parent `package.json` has `"type": "module"`

This is standard Node.js ESM behavior. With Electron 41 bundling Node 24.14.0, you get full stable ESM support including the stable `require(esm)` interop that landed in Node 25.4 and was backported -- meaning CJS code can `require()` ESM modules without issues.

Electron 41 also adds support for `--experimental-transform-types`, enabling native TypeScript transform capabilities at runtime (backported to v39 and v40).

---

## 3. Gotchas with ESM + Electron

### 3a. Async Timing Before `app.ready`

This is the big one. From the official docs:

> "You must use `await` generously before the app's `ready` event."

ESM modules load asynchronously. If your main process entry is ESM, top-level `await` and dynamic `import()` calls may resolve after the `ready` event fires. This matters for any initialization code that needs to run before the app is ready. Static imports are fine; dynamic imports may race.

**Mitigation:** Use static imports for everything needed before `ready`. Use `await app.whenReady()` rather than the `ready` event listener.

### 3b. Preload Scripts Have Special Rules

- **File extension is mandatory**: ESM preload scripts MUST use `.mjs` extension. Setting `"type": "module"` in package.json is NOT enough for preloads -- it is ignored.
- **Sandboxed preloads cannot use ESM**: They must use `require()`. This is a hard limitation.
- **Timing issue**: Unsandboxed ESM preload scripts run after page load on pages with no content (empty response body).
- **Context isolation matters**: Dynamic `import()` of Node.js modules in preloads requires `contextIsolation: true`. Without it, Chromium's import function takes precedence.

### 3c. Electron Forge ESM Support is Incomplete

Electron Forge (the standard build/packaging tool) has partial ESM support:
- `forge.config.mjs` works for ESM configs
- Full ESM support for `forge.config` is milestoned for Forge 8.0.0 (still open as of Oct 2025)
- TypeScript config loading had breakage with Node >= 23.6; fixed via `jiti` loader in April 2025
- ESM Forge module loading (plugins, makers, publishers) was merged in Sept 2024

**Practical impact for you:** Minimal. Your Fastify app code is ESM. The Electron wrapper's forge config can be CJS or `.mjs` without affecting your app code.

### 3d. Packaged App ESM Bug (Fixed)

There was a bug in Electron 35 where ESM module loading in packaged (ASAR) apps could crash with "unsupported url scheme." This was fixed in PR #46810 (merged June 2025) and has been stable since Electron 36+.

### 3e. Transpiler Migration Caution

If you use a transpiler (Babel, TypeScript with `module: commonjs`), be aware that transpiled ESM-to-CJS `require()` calls are synchronous, while native ESM `import` is asynchronous. Migration from transpiled to native ESM can introduce timing differences.

---

## 4. Can an Electron App Wrap a Local Fastify Server Cleanly?

**Yes, absolutely.** There are three viable approaches, ordered by simplicity:

### Approach A: Fastify on localhost (Simplest -- Recommended for your case)

Start Fastify in the Electron main process, binding to `127.0.0.1` on a dynamic port. Point `BrowserWindow.loadURL()` at `http://localhost:{port}/`.

```js
// main.js (ESM)
import { app, BrowserWindow } from 'electron';
import { buildServer } from './server.js'; // your Fastify app

let mainWindow;

app.whenReady().then(async () => {
  const server = await buildServer();
  const address = await server.listen({ port: 0, host: '127.0.0.1' });

  mainWindow = new BrowserWindow({ width: 1280, height: 720 });
  mainWindow.loadURL(address);
});
```

**Pros:**
- Your Fastify code runs completely unmodified
- Zero coupling between Fastify and Electron APIs
- You can develop/test the Fastify app without Electron at all
- Port 0 = OS picks a free port automatically

**Cons:**
- Technically opens a local network port (bound to 127.0.0.1 only)
- Another local process *could* connect to it (minimal security concern for a desktop app)

### Approach B: Custom Protocol via `electron-server`

The `electron-server` npm package (by @anonrig, Fastify core team member) lets Fastify handle requests via a custom Electron protocol scheme without opening a port.

```js
import { registerProtocol } from 'electron-server';
registerProtocol({ scheme: 'app', server: fastifyInstance });
// Then: win.loadURL('app://route');
```

**Pros:** No port exposed at all.
**Cons:** Package last updated July 2022 (28 stars, likely unmaintained). Uses CJS. Would need vetting/forking for production use.

### Approach C: Fork Fastify into a Child Process

Use `child_process.fork()` or `utilityProcess` (Electron's built-in) to run Fastify in a separate process. Communicate over IPC or localhost.

**Pros:** Isolates Fastify from the main process event loop.
**Cons:** More complex. Watch out for `child_process.fork()` bugs in packaged apps (issue #47647, the argv[1] recursion problem).

### Recommendation for md-viewer

**Approach A is the right call.** Your architecture is browser-first Fastify, and you want Electron to be a thin wrapper. Running Fastify on `127.0.0.1:0` in the main process means:

1. Your entire Fastify codebase stays untouched
2. Development and testing happen without Electron
3. The Electron wrapper is ~20 lines of code
4. No port conflicts (port 0)
5. `127.0.0.1` binding means no external network exposure

---

## 5. What Node.js Version Does Electron 41 Bundle?

**Node.js v24.14.0**

This is significant:
- Node 24 is the current LTS line
- `require(esm)` is fully stable (landed stable in Node 22.12+, enhanced in 24.x)
- Native TypeScript type stripping available (experimental in 23.6+, improved in 24.x)
- Full ESM support including top-level await, import.meta, import assertions

Electron 40 (Jan 2026) bundled Node v24.11.1. Electron 39 and earlier used Node v22.x.

---

## Impact Assessment for md-viewer

| Decision | Risk Level | Notes |
|----------|-----------|-------|
| Using `"type": "module"` in package.json | **No risk** | Electron main process respects this since v28 |
| Using ESM `import/export` throughout | **No risk** | Node 24.14 has full stable ESM |
| Using Fastify with ESM | **No risk** | Fastify has been ESM-native since v4 |
| Wrapping Fastify in Electron later | **Low risk** | Well-established pattern, ~20 lines of glue code |
| Preload scripts (if needed) | **Low risk** | Just use `.mjs` extension and `contextIsolation: true` |
| Electron Forge for packaging | **Low risk** | ESM app code works fine; forge config can be CJS or `.mjs` |

**Your plan to build browser-first ESM Fastify now and wrap in Electron 6 epics from now is sound. No architectural changes will be needed.**

---

## Sources

- [Electron 41.0 Release Blog](https://electronjs.org/blog/electron-41-0) -- Official, published March 10 2026
- [Electron ESM Documentation](https://electronjs.org/docs/latest/tutorial/esm) -- Official tutorial, authoritative
- [Electron 40.0 Release Blog](https://electronjs.org/blog/electron-40-0) -- Official, confirms Node 24.11.1
- [electron-server (Fastify in Electron)](https://github.com/anonrig/electron-server) -- Reference implementation by Fastify core team member, 28 stars, last updated 2022
- [Express in Electron gist](https://gist.github.com/maximilian-lindsey/a446a7ee87838a62099d) -- Community pattern, 22 forks, validates localhost approach
- [Electron Forge ESM issue #3684](https://github.com/electron/forge/issues/3684) -- Open, milestoned for 8.0.0
- [Electron Forge TS config fix PR #3907](https://github.com/electron/forge/pull/3907) -- Merged April 2025, fixes Node 23.6+ TS config loading
- [Electron ESM packaged app fix PR #46810](https://github.com/electron/electron/pull/46810) -- Merged June 2025, fixes ASAR ESM loading
- [Electron ESM preload dynamic import PR #48375](https://github.com/electron/electron/pull/48375) -- Merged Oct 2025, adds dynamic ESM import in preloads

## Confidence Assessment

- **Overall confidence: High** -- Based on official documentation and release notes dated within the last 3 months
- **Areas of certainty:** ESM main process support, Node version, Fastify wrapping pattern
- **Minor uncertainty:** Electron Forge's full ESM story for configs is still evolving, but this doesn't affect app code
- **No further research needed** for the decision at hand
