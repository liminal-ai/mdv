# Electron Desktop Wrapper Best Practices (March 2026)

Research for wrapping a Fastify + vanilla JS web app in an Electron shell for macOS.

---

## Summary

Electron remains the most practical choice for wrapping a local web server into a macOS desktop app, especially when the wrapper's job is simply pointing a BrowserWindow at localhost. As of March 2026, Electron 41 is the latest stable release (Chromium 146, Node 24.14). The alternative frameworks (Tauri, Neutralino) introduce complexity or language requirements (Rust) that do not pay off when the entire app already runs as a local HTTP server. The biggest practical challenges for your use case are (1) macOS distribution without a paid Apple Developer account and (2) the ~150-200MB bundle size overhead from shipping Chromium.

For packaging, electron-builder remains the dominant tool with 3x the download volume of electron-forge, and has recently merged critical fixes for ad-hoc code signing on Apple Silicon. Security configuration is straightforward for a local-server wrapper pattern: keep all defaults (contextIsolation, sandbox, nodeIntegration off), load localhost via HTTPS or accept HTTP for local-only traffic, and set a restrictive CSP. File association for `.md` files works mechanically without notarization but has significant UX friction on modern macOS.

---

## 1. Current Electron Version

**Latest stable**: Electron 41.0.3 (released March 17, 2026)

| Version | Chromium | Node.js | V8 |
|---------|----------|---------|-----|
| 41.0.3 (latest) | 146.0.7680.80 | 24.14.0 | 14.6 |
| 40.8.3 (prev major) | 144.0.7559.236 | 24.14.0 | 14.4 |
| 39.8.3 (LTS-ish) | 142.0.7444.265 | 22.22.1 | 14.2 |

**Upcoming**: Electron 42 is in alpha (42.0.0-alpha.2, Chromium 148).

**Notable in v41**: ASAR Integrity digest for tamper detection on macOS, improved Wayland support (Linux), MSIX auto-updating (Windows).

**Recommendation**: Target Electron 41.x. It ships Node 24 which aligns with the project's existing Node 24 usage.

---

## 2. Electron vs Alternatives for Local-Server Wrapper

### The Use Case
Wrapping an existing Fastify server that runs on localhost. The desktop shell just needs to:
- Start the Fastify process
- Open a BrowserWindow pointing at `http://localhost:<port>`
- Handle macOS lifecycle (dock, window management)
- Register as `.md` file handler

### Electron

**Pros for this use case:**
- `win.loadURL('http://localhost:3000')` is trivial -- this is the core pattern
- Node.js main process can spawn/manage the Fastify server directly (or even run it in-process since both are Node)
- Massive ecosystem: electron-builder, electron-updater, well-documented macOS integration
- File association support is mature via electron-builder config
- `open-file` event on macOS for handling file opens from Finder
- 1.66M weekly npm downloads, battle-tested in VS Code, Slack, Discord, Figma

**Cons:**
- Bundle size: ~150-200MB (ships entire Chromium)
- Memory: ~100-300MB idle (Chromium overhead)
- Startup: 1-2 seconds cold start

### Tauri

**Pros:**
- Tiny bundles: ~2-10MB (uses system WebView)
- Low memory: ~30-80MB idle
- Fast startup: <0.5 seconds
- Strong security model (Rust backend, allowlist permissions)
- 85K+ GitHub stars, actively developed

**Cons for this use case:**
- **Requires Rust toolchain** -- significant added complexity for a JS/TS team
- Loading an external localhost URL requires the `tauri-plugin-localhost` plugin or manual `WebviewUrl::External(url)` configuration -- not a first-class pattern
- System WebView means WebKit on macOS (not Chromium) -- potential rendering differences from your dev environment
- File association requires manual plist/Rust setup, less documented than Electron
- The project already has a Fastify server; Tauri's Rust backend is redundant weight
- Ecosystem is growing but significantly smaller than Electron's

### Neutralino

**Pros:**
- Extremely small: ~1-5MB bundles, ~20-50MB memory
- No Node.js or Rust requirement -- thin C++ wrapper

**Cons for this use case:**
- Very limited native API surface
- Small community (~7.5K stars)
- No built-in auto-update mechanism
- File association support is minimal/undocumented
- Not suitable for production desktop apps that need macOS lifecycle integration

### Native Swift/SwiftUI with WKWebView

**Pros:**
- Zero overhead beyond macOS itself (~0MB added for the WebView)
- Native macOS integration (file associations, code signing trivial in Xcode)
- Apple officially announced a native `WebView` for SwiftUI at WWDC 25
- Tiny app size (<5MB)

**Cons for this use case:**
- Requires Swift/Xcode knowledge -- different language ecosystem
- Uses WebKit (not Chromium) -- same rendering difference issue as Tauri
- No cross-platform path if you ever want Windows/Linux
- Managing child processes (Fastify server) from Swift is more manual
- No equivalent to electron-builder for packaging/distribution automation

### Recommendation

**Stick with Electron** for this project. The reasons:

1. The Fastify server is already Node.js; Electron's main process IS Node.js. You can even `require()` your Fastify app directly in the main process, avoiding child process management entirely.
2. The `loadURL('http://localhost:PORT')` pattern is a first-class, well-documented Electron use case.
3. The ecosystem for packaging, auto-updating, and file association on macOS is mature.
4. The 150MB size penalty is the real cost, but for a markdown viewer that lives on the user's machine permanently, this is acceptable.
5. You already have an Electron prototype in `first-pass-poc/`.

If bundle size ever becomes a dealbreaker, Tauri is the migration path -- but it requires adopting Rust and accepting WebKit rendering.

---

## 3. Packaging: electron-builder vs electron-forge

### Current Landscape (March 2026)

| Tool | Weekly Downloads | Stars | Maintained By |
|------|-----------------|-------|---------------|
| electron-builder | 1,155,512 | 14,453 | Community (mmaietta et al.) |
| electron-forge | 384,623 | 6,988 | Electron core team |
| electron-packager | 281,323 | 283 | Deprecated/archived |

### electron-builder

- Configuration-driven (JSON/YAML in package.json or dedicated config file)
- Supports DMG, PKG, NSIS, AppImage, Snap, and more
- Built-in auto-update via `electron-updater`
- Built-in code signing and notarization
- **Recently merged ad-hoc signing fix (PR #9007, April 2025)** -- critical for distributing without a paid Apple dev account
- Supports `fileAssociations` directly in config
- ASAR packaging enabled by default with configurable unpack patterns
- Larger community, more Stack Overflow answers, more battle-tested edge cases

### electron-forge

- Plugin-based architecture, more flexible/extensible
- Officially recommended by the Electron team
- Integrates well with webpack/vite via plugins
- Good for complex build pipelines
- Smaller community, more open issues (272 vs 104)
- File association requires manual `extendInfo` plist configuration

### Recommendation

**Use electron-builder.** For a straightforward local-server wrapper:
- Configuration-based approach is simpler (no plugin architecture to learn)
- `fileAssociations` is a first-class config option
- The ad-hoc signing fix (v26+) is critical for your unsigned distribution scenario
- `electron-updater` provides auto-update without external dependencies
- More answers available when you hit edge cases

### Minimal electron-builder config

```json
{
  "appId": "com.yourname.md-viewer",
  "productName": "MD Viewer",
  "mac": {
    "category": "public.app-category.developer-tools",
    "target": ["dmg"],
    "icon": "build/icon.icns"
  },
  "fileAssociations": [
    {
      "ext": "md",
      "name": "Markdown Document",
      "role": "Viewer",
      "mimeType": "text/markdown"
    }
  ],
  "asar": true,
  "files": [
    "dist/**/*",
    "main.js",
    "preload.js",
    "package.json"
  ],
  "publish": null
}
```

---

## 4. Security Best Practices for Local-Server Wrapper

### The Threat Model

For a local-server wrapper, your threat surface is lower than a typical Electron app because:
- You are NOT loading remote/untrusted content
- The renderer points at your own localhost server
- No user-generated HTML is rendered with Node.js access

However, you ARE rendering user-provided Markdown files, which could contain malicious content (XSS via crafted Markdown). Defense-in-depth still matters.

### Recommended BrowserWindow Configuration

```javascript
const mainWindow = new BrowserWindow({
  webPreferences: {
    // All of these are defaults since Electron 20+, but be explicit
    contextIsolation: true,      // Preload runs in separate context
    nodeIntegration: false,      // No require() in renderer
    sandbox: true,               // Chromium sandbox active
    webSecurity: true,           // Same-origin policy enforced

    // Only if you need IPC between main and renderer:
    preload: path.join(__dirname, 'preload.js'),

    // Additional hardening
    allowRunningInsecureContent: false,  // default
    experimentalFeatures: false,         // default
    enableBlinkFeatures: '',             // don't enable any
  }
});

// Load your local server
mainWindow.loadURL('http://localhost:3000');
```

### Content Security Policy

Since you're loading from localhost, set CSP on your Fastify server response headers:

```
Content-Security-Policy: default-src 'self' http://localhost:3000; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://localhost:3000; font-src 'self'; object-src 'none'; base-uri 'self'
```

Key points:
- `'self'` maps to your localhost origin
- `'unsafe-inline'` for styles is often needed for Markdown rendering (syntax highlighting, etc.)
- `ws://localhost:*` if you use WebSockets for live reload
- `object-src 'none'` blocks Flash/Java embeds
- Do NOT use `'unsafe-eval'` unless absolutely required

### IPC Security (if needed)

If the Electron shell needs to communicate with the renderer (e.g., for file-open events):

```javascript
// preload.js -- expose only what you need
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onFileOpen: (callback) => {
    ipcRenderer.on('file-open', (_event, filePath) => callback(filePath));
  },
  // Never expose raw ipcRenderer
});
```

### What You Should NOT Do

- Do not set `nodeIntegration: true`
- Do not set `contextIsolation: false`
- Do not set `sandbox: false`
- Do not set `webSecurity: false`
- Do not expose `ipcRenderer` directly via contextBridge
- Do not use `shell.openExternal()` with user-provided URLs without validation

### Electron Fuses

Consider setting fuses to disable capabilities you don't need:

```bash
npx @electron/fuses write path/to/electron \
  --run-as-node off \
  --node-cli-inspect off \
  --enable-cookie-encryption on
```

---

## 5. File Association for .md on macOS

### How It Works Mechanically

File association on macOS uses the `Info.plist` inside the `.app` bundle. electron-builder generates this from the `fileAssociations` config:

```json
{
  "fileAssociations": [{
    "ext": "md",
    "name": "Markdown Document",
    "role": "Viewer",
    "mimeType": "text/markdown",
    "icon": "markdown.icns"
  }]
}
```

This generates `CFBundleDocumentTypes` entries in `Info.plist` and registers the app with macOS Launch Services.

### Handling the open-file Event

```javascript
// main.js
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  // If app is ready, open the file
  if (mainWindow) {
    mainWindow.loadURL(`http://localhost:3000/view?file=${encodeURIComponent(filePath)}`);
  } else {
    // Store for later -- app hasn't finished launching
    pendingFilePath = filePath;
  }
});
```

Important: `open-file` fires BEFORE `ready` if the app is launched by double-clicking a file. You must buffer the path.

### Registration Without Code Signing

macOS discovers file associations by scanning `.app` bundles via Launch Services (`lsregister`). The critical question is **where the app lives**:

- **Apps in `/Applications` or `~/Applications`**: Launch Services scans these directories. File associations are registered when the app is first discovered.
- **Apps anywhere else on disk**: Also discovered, but may require a manual `lsregister` trigger.

**Without code signing/notarization**: The file association registration itself works. macOS reads the `Info.plist` regardless of signing status. When a user right-clicks a `.md` file and chooses "Open With", your app will appear in the list.

**The catch**: The first time a user tries to OPEN your app (via file association or otherwise), Gatekeeper intervenes. On macOS Sequoia (15.x):
- If the app is ad-hoc signed: User sees "unverified developer" warning, can bypass via System Settings > Privacy & Security
- If the app is unsigned on Apple Silicon: User sees "app is damaged" -- this CANNOT be bypassed via GUI, requires `xattr -rd com.apple.quarantine` in Terminal
- If quarantine attribute is removed (e.g., distributed via `curl` or user runs `xattr` command): Opens normally

**Practical reality**: File association works, but the first-launch UX is rough without at least ad-hoc signing. See section 6.

---

## 6. macOS Without Code Signing (2025-2026 Reality)

### Three Tiers of Signing

| Tier | Cost | User Experience | Auto-Update |
|------|------|-----------------|-------------|
| **Notarized** (Developer ID + Apple notarization) | $99/yr Apple Developer Program | Clean launch, no warnings | Full support |
| **Ad-hoc signed** (`codesign -s -`) | Free | "Unverified developer" warning, bypassable via System Settings | Works on macOS (no signature verification by default for `electron-updater` on mac) |
| **Unsigned** | Free | "App is damaged" on Apple Silicon, requires Terminal `xattr` command | Broken -- updates fail signature verification |

### What Changed in macOS Sequoia (15.x)

- **Pre-Sequoia**: Right-click > Open could bypass Gatekeeper for unsigned apps
- **Sequoia 15.0**: Control-click override removed; users must go to System Settings > Privacy & Security
- **Sequoia 15.1**: Unsigned apps on Apple Silicon show "app is damaged" with NO GUI bypass. Only `xattr -rd com.apple.quarantine /path/to/App.app` works.

### Ad-Hoc Signing: The Practical Middle Ground

As of electron-builder v26+ (PR #9007, merged April 2025):
- **electron-builder automatically applies ad-hoc signatures** to ARM64 and universal builds when no signing identity is available
- This eliminates the "app is damaged" error
- Users see the "unverified developer" warning instead, which has a GUI bypass path
- No Apple Developer account needed

This means: **just build with electron-builder v26+ and it works on Apple Silicon without the "damaged" error.**

### Install Location

- `~/Applications/` works fine. No admin privileges needed. Launch Services discovers apps here.
- `/Applications/` requires admin privileges to write but is otherwise equivalent.
- Any other location: app still runs but may not be discovered by Spotlight/Launch Services for file associations.

### User Bypass Flow (ad-hoc signed, not notarized)

1. User double-clicks app or associated file
2. macOS shows: "App can't be opened because Apple cannot check it for malicious software"
3. User opens System Settings > Privacy & Security
4. Sees "App was blocked from use because it is not from an identified developer"
5. Clicks "Open Anyway"
6. Subsequent launches work without warnings

This is a one-time process. Documented, annoying, but workable for developer-tool users.

### What Absolutely Requires Signing

- Mac App Store distribution (requires full signing + notarization)
- Auto-update on Windows via NSIS (`electron-updater` verifies publisher signature)
- Auto-update on macOS does NOT require signing by default (it checks the `latest-mac.yml` manifest)

---

## 7. Performance Considerations

### Baseline Numbers for a Local-Server Wrapper

| Metric | Typical Range | Notes |
|--------|--------------|-------|
| Bundle size (DMG) | 150-200MB | Chromium is the dominant factor |
| Cold start | 1-2 seconds | Chromium initialization |
| Warm start | ~0.5 seconds | After first launch |
| Memory (idle) | 100-180MB | Main + renderer + Chromium |
| Memory (active) | 150-300MB | Depends on page complexity |

### Gotchas for Local-Server Wrapper Pattern

1. **Startup sequencing**: The Fastify server must be listening BEFORE `loadURL()` is called. Options:
   - Start Fastify first, wait for `listening` event, then create BrowserWindow
   - Show a splash/loading screen, then navigate once server is ready
   - Use `win.loadURL()` with a retry mechanism

2. **Port conflicts**: Always use a random available port or implement port-finding logic. Hardcoded ports conflict with other apps.

3. **Double Node.js**: If you spawn Fastify as a child process, you're running TWO Node.js instances (Electron main + child). Instead, consider running Fastify in-process in the main Electron process -- this saves ~40-60MB.

4. **Memory leaks in long-running apps**: Desktop apps stay open for hours/days. Clean up event listeners, IPC handlers, timers. Use `requestIdleCallback()` for non-critical work.

5. **IPC serialization**: If you pass large data between main and renderer (e.g., large markdown files), the Structured Clone Algorithm serialization can block the UI thread. For files >1MB, consider streaming or passing file paths instead of content.

6. **Background throttling**: Chromium throttles background tabs/windows. If your Fastify server is in a renderer process (don't do this), it will slow down when the window is hidden.

### Optimization Tips

- **Defer module loading**: Only `require()` what you need at startup. Lazy-load everything else.
- **V8 code caching**: Electron supports `v8CacheOptions: 'bypassHeatCheck'` for faster subsequent loads.
- **Disable unused Chromium features**: Use `--disable-features` command-line switches for features you don't use (e.g., `--disable-gpu` if not needed).
- **Show window when ready**: Use `show: false` in BrowserWindow options, then `win.show()` after the page loads to avoid white flash.

```javascript
const win = new BrowserWindow({
  show: false,
  // ...
});
win.once('ready-to-show', () => {
  win.show();
});
```

---

## 8. electron-builder: ASAR and Auto-Update

### ASAR Packaging

ASAR is Electron's archive format that bundles your app source into a single file. It is enabled by default.

**Configuration:**

```json
{
  "asar": true,
  "asarUnpack": [
    "**/*.node",
    "node_modules/sharp/**/*"
  ]
}
```

Key points:
- `asar: true` (default) bundles everything into `app.asar`
- `asarUnpack`: glob patterns for files that must be extracted (native modules, etc.)
- electron-builder auto-detects native modules that need unpacking
- Compression options: `store` (fast builds), `normal` (default), `maximum` (marginal size savings)
- **New in Electron 41**: ASAR Integrity digest -- optional tamper detection for signed apps
- For your Fastify app: if you run Fastify in-process, all your server code gets bundled into the ASAR. This is fine and works transparently.

**What cannot go in ASAR:**
- Native `.node` addons (must be unpacked)
- Files that need direct filesystem path access (e.g., spawned executables)
- Files accessed by child processes that don't understand ASAR

### Auto-Update

electron-builder ships `electron-updater` which supports multiple backends:

| Provider | Requires Signing? | Notes |
|----------|------------------|-------|
| GitHub Releases | No (on macOS) | Free for public repos, rate-limited for private |
| S3/Generic Server | No (on macOS) | You host `latest-mac.yml` + DMG/ZIP |
| Spaces (DigitalOcean) | No (on macOS) | Similar to S3 |
| Windows NSIS | **Yes** | Verifies publisher signature |

**macOS auto-update WITHOUT code signing:**

On macOS, `electron-updater` checks the `latest-mac.yml` manifest and downloads the update. By default, it does NOT verify code signatures on macOS (unlike Windows where it's mandatory). This means auto-update works for ad-hoc signed apps.

Basic setup:

```javascript
// main.js
const { autoUpdater } = require('electron-updater');

app.whenReady().then(() => {
  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-available', (info) => {
  // Notify user
});

autoUpdater.on('update-downloaded', (info) => {
  // Prompt user to restart
  autoUpdater.quitAndInstall();
});
```

**Publish configuration:**

```json
{
  "publish": {
    "provider": "github",
    "owner": "your-org",
    "repo": "md-viewer"
  }
}
```

For a project without code signing, the simplest auto-update path is:
1. Host releases on GitHub Releases (free for public repos)
2. `electron-updater` checks `latest-mac.yml`
3. Downloads and installs the update DMG/ZIP
4. No signing verification needed on macOS

---

## Sources

- [Electron Releases](https://releases.electronjs.org/) - Official release page, highly authoritative
- [Electron 41.0 Blog Post](https://electronjs.org/blog/electron-41-0) - Official blog, March 2026
- [Electron Security Tutorial](https://www.electronjs.org/docs/latest/tutorial/security) - Official documentation, 20-point security checklist
- [Electron Context Isolation Docs](https://electron.atom.io/docs/latest/tutorial/context-isolation) - Official API documentation
- [PkgPulse: Tauri vs Electron vs Neutralino 2026](https://www.pkgpulse.com/blog/tauri-vs-electron-vs-neutralino-desktop-apps-javascript-2026) - Comparison article, March 2026
- [BuildPilot: Framework Comparison 2026](https://trybuildpilot.com/744-tauri-vs-electron-vs-neutralino-2026) - Comparison with metrics table, March 2026
- [npm-compare: electron-builder vs forge vs packager](https://npm-compare.com/@electron-forge/core,electron-builder,electron-packager) - Download/star statistics
- [Electron Forge: Why Electron Forge?](https://www.electronforge.io/core-concepts/why-electron-forge) - Official Forge documentation
- [electron-builder PR #9007: Ad-hoc signing fix](https://github.com/electron-userland/electron-builder/pull/9007) - Critical fix for macOS ARM distribution, merged April 2025
- [Eclectic Light: Code Signing and Future macOS](https://eclecticlight.co/2026/01/17/whats-happening-with-code-signing-and-future-macos/) - Authoritative macOS internals blog, January 2026
- [Eclectic Light: Gatekeeper and Notarization in Sequoia](https://eclecticlight.co/2024/08/10/gatekeeper-and-notarization-in-sequoia/) - Sequoia Gatekeeper changes
- [How to run unsigned apps in macOS 15.1](https://ordonez.tv/2024/11/04/how-to-run-unsigned-apps-in-macos-15-1/) - Practical workaround guide
- [Johnny Le: Building High-Performance Electron Apps](https://johnnyle.io/read/electron-performance) - Performance optimization guide, June 2025
- [Emad Ibrahim: Electron Security](https://www.emadibrahim.com/electron-guide/security) - Practical security guide with code examples
- [Tauri Localhost Plugin](https://v2.tauri.app/plugin/localhost/) - Official Tauri docs for localhost pattern
- [rchrd2/example-electron-file-association](https://github.com/rchrd2/example-electron-file-association) - Working example of macOS file association
- [electron-builder PR #8035: fileAssociations merge fix](https://github.com/electron-userland/electron-builder/pull/8035) - CFBundleDocumentTypes merge fix, Feb 2024
- [electron-builder: complete packaging guide](https://www.oflight.co.jp/en/columns/electron-packaging-deployment-guide) - Comprehensive packaging guide, March 2026
- [Bananatron: State of Electron App Security](https://muffin.ink/blog/bananatron/) - Security audit of 112 Electron apps, April 2025
- [Breach to Barrier: Electron Sandbox Blog](https://electronjs.org/blog/breach-to-barrier) - Official Electron blog on sandbox importance

---

## Confidence Assessment

- **Overall confidence**: High
- **Electron version/features**: High -- sourced from official release pages
- **Electron vs alternatives**: High -- multiple independent comparisons with consistent metrics
- **Packaging tools**: High -- npm download data and community consensus are clear
- **Security best practices**: High -- official Electron documentation plus third-party audits
- **File association**: Medium-High -- mechanically straightforward, but edge cases with `open-file` event timing are documented inconsistently
- **macOS without code signing**: High -- the electron-builder ad-hoc signing fix is confirmed merged and tested; Eclectic Light Company is the gold-standard source for macOS internals
- **Performance numbers**: Medium -- ranges are approximate and depend heavily on app complexity; cited numbers are consistent across sources
- **Auto-update without signing**: Medium -- works on macOS but less battle-tested than the signed path; Windows auto-update definitely requires signing

### Areas of Uncertainty

1. **macOS Tahoe (next major)**: Rumors suggest further code signing restrictions. The 2026 WWDC cycle may change the unsigned/ad-hoc landscape.
2. **Electron 42+ changes**: Alpha only; no breaking changes relevant to this use case identified yet.
3. **File association reliability without notarization**: Works in testing, but Apple could tighten Launch Services to prefer notarized apps in future macOS updates.
