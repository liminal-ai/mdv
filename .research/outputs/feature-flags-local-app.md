# Feature Flags for Local/Desktop Apps (Fastify + Vanilla JS + Electron)

## Summary

For a local-first app where you need to gate an experimental feature (chat/agent sidebar) for developer/power-user activation, the community consensus strongly favors the simplest approach that matches your complexity. For your use case -- a single boolean toggle, no user targeting, no remote management -- the right answer is almost certainly a plain config file or environment variable, not a library. Libraries like OpenFeature/flagd exist if you want to grow into something more structured later, but they are overkill for a single dev-facing toggle.

## Recommended Approaches (Ranked by Simplicity)

### Option 1: Environment Variable (Recommended Starting Point)

The simplest possible approach. Zero dependencies, works identically in Fastify (Node) and Electron contexts.

**Implementation:**
```js
// shared/features.js
const features = {
  chatSidebar: process.env.ENABLE_CHAT_SIDEBAR === 'true',
};
export default features;
```

**Activation:**
```bash
# CLI
ENABLE_CHAT_SIDEBAR=true npm start

# .env file (with dotenv or Fastify's built-in env support)
ENABLE_CHAT_SIDEBAR=true

# Electron: set in main process before loading renderer
```

**Pros:**
- Zero code, zero dependencies
- Universal pattern every developer knows
- Works in both Fastify and Electron contexts
- Can be set per-launch or persisted in .env
- No restart needed if you use dotenv with reloading (though for your case, restart is fine)

**Cons:**
- Requires restart to change (fine for dev toggles)
- String-only values (fine for booleans)
- No runtime toggle without restart

**Best for:** Exactly your use case -- developer-facing experimental feature gate.

---

### Option 2: JSON Config File

A `features.json` or a `features` key in an existing config file. Slightly more structured than env vars, and can be hot-reloaded if desired.

**Implementation:**
```json
// config/features.json
{
  "chatSidebar": false
}
```

```js
// shared/features.js
import { readFileSync } from 'fs';
import { join } from 'path';

let features;
function loadFeatures() {
  try {
    features = JSON.parse(
      readFileSync(join(__dirname, '../config/features.json'), 'utf-8')
    );
  } catch {
    features = { chatSidebar: false };
  }
}
loadFeatures();

export default features;
export { loadFeatures }; // call to reload without restart
```

**Pros:**
- Human-editable file, easy to document
- Can hold multiple flags with structured data
- Can be hot-reloaded (watch the file, re-read on change)
- Works in both Fastify and Electron contexts
- Git-friendly: can .gitignore a local override or ship defaults

**Cons:**
- Slightly more code than env var
- Need to decide on file location (project root vs userData for Electron)
- Parse errors need handling

**Best for:** When you anticipate growing beyond one flag, or want a user-editable config.

---

### Option 3: CLI Flag / Command-Line Argument

Pass flags directly when launching the app.

**Implementation:**
```js
// Parse from process.argv
const chatSidebar = process.argv.includes('--enable-chat-sidebar');

// Or use Fastify's built-in CLI support / minimist for parsing
```

**Activation:**
```bash
node server.js --enable-chat-sidebar
# Or in Electron:
electron . --enable-chat-sidebar
```

**Pros:**
- No file to manage
- Self-documenting (--help can list flags)
- Electron natively supports command-line switches

**Cons:**
- Only works at launch time
- Harder for non-CLI users to discover
- Need arg parsing for anything beyond simple boolean presence

**Best for:** Developer-only toggles where you control how the app is launched.

---

### Option 4: Combined Approach (Recommended for Your Stack)

Given you have Fastify + Electron, a layered approach works well:

```js
// shared/features.js
import { existsSync, readFileSync } from 'fs';

// Priority: env var > config file > default
function resolveFeature(name, defaultValue = false) {
  // 1. Environment variable (FEATURE_CHAT_SIDEBAR)
  const envKey = `FEATURE_${name.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
  if (process.env[envKey] !== undefined) {
    return process.env[envKey] === 'true';
  }

  // 2. Config file
  try {
    const configPath = './config/features.json';
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (config[name] !== undefined) return Boolean(config[name]);
    }
  } catch { /* use default */ }

  // 3. Default
  return defaultValue;
}

export const features = {
  chatSidebar: resolveFeature('chatSidebar', false),
};
```

This gives you env var for quick CLI toggling, config file for persistent settings, and safe defaults. Under 30 lines, no dependencies.

---

## Libraries (If You Want One)

### Lightweight / Local-Only

| Library | Weekly Downloads | Approach | Notes |
|---------|-----------------|----------|-------|
| **electron-store** | 571K/week | JSON file in userData | Sindre Sorhus. Gold standard for Electron persistent config. Not feature-flag-specific but trivially used as one. |
| **conf** | (used by electron-store) | JSON file | The underlying library. Works in plain Node too, not Electron-specific. |
| **flipit** | ~27 stars | JSON config file | Dead-simple feature flipper. Watches config file for changes. Unmaintained since 2016. |
| **fleg** | ~3 stars | Multi-source (cookies, query string, code) | Tiny (<1KB), works in browser + Node. Unmaintained since 2020. |

### Standards-Based (OpenFeature)

**OpenFeature** is a CNCF project that provides a vendor-neutral feature flag API. It's the emerging standard, but it's designed for larger systems.

- **@openfeature/server-sdk** + **@openfeature/flagd-provider** with `FLAGD_RESOLVER=in-process` and `FLAGD_OFFLINE_FLAG_SOURCE_PATH=flags.json` gives you a fully local, file-based feature flag system with no running daemon.
- The flag definition format is structured JSON:
  ```json
  {
    "$schema": "https://flagd.dev/schema/v0/flags.json",
    "flags": {
      "chat-sidebar": {
        "state": "ENABLED",
        "variants": { "on": true, "off": false },
        "defaultVariant": "off"
      }
    }
  }
  ```
- **Verdict:** Overkill for a single toggle in a local app. The SDK pulls in gRPC dependencies. Consider only if you plan to have 10+ flags and want a standardized evaluation API.

---

## Community Consensus

Based on the research:

1. **For local/desktop apps, the overwhelming consensus is: don't use a cloud service.** LaunchDarkly has an Electron SDK, but it requires their service and is irrelevant for local-first.

2. **For 1-3 developer-facing toggles, env vars or a config file is the standard approach.** This is what Electron apps (VS Code, Atom, etc.) do internally. No library needed.

3. **The "config file with env var override" pattern is the most common** in Node.js applications generally. Fastify's own config system supports this natively.

4. **OpenFeature is gaining traction as a standard** but is aimed at cloud-native deployments. Its file-based offline mode works but brings unnecessary complexity for your use case.

5. **Feature flag libraries for Node.js are a graveyard.** Most small libraries (flipit, creature-features, fleg) are unmaintained. The ecosystem clearly says: for simple cases, roll your own.

## Recommendation for md-viewer

Given the stack (Fastify + vanilla JS, optional Electron wrapper) and use case (single experimental feature, developer-facing):

**Use Option 1 (env var) or Option 4 (env var + config file fallback).** Specifically:

- Create a `shared/features.js` module that both server and client code can reference
- Check `FEATURE_CHAT_SIDEBAR` env var
- Optionally read from a `features.json` for persistent local config
- On the server side (Fastify), expose enabled features via an API endpoint (`GET /api/features`) so the vanilla JS frontend can conditionally render the sidebar
- In Electron, set the env var in the main process before spawning the renderer

Total implementation: ~20-30 lines of code, zero dependencies, completely local.

## Sources

- [CloudBees - Feature Flag Best Practices](https://www.cloudbees.com/blog/feature-flag-best-practices) - Authoritative overview of toggle storage options (env vars, config files, CLI args)
- [ConfigCat - Feature Flags vs Environment Variables](https://configcat.com/blog/feature-flags-vs-environment-variables/) - Good comparison of when to use each
- [PostHog - Feature Flags vs Configuration](https://posthog.com/product-engineers/feature-flags-vs-configuration) - Clear framework for choosing between approaches
- [OpenFeature Node.js SDK](https://docs.openfeature.dev/docs/reference/sdks/server/javascript) - CNCF standard, reference implementation
- [flagd Providers Documentation](https://flagd.dev/providers/nodejs/) - File-based offline mode documentation
- [OpenFeature flagd Issue #1504](https://github.com/open-feature/flagd/issues/1504) - Discussion on simplifying file-based usage
- [dev.to - Feature Flags with JSON File in NodeJS](https://dev.to/agardnerit/add-feature-flags-with-only-a-json-flat-file-in-nodejs-41ef) - Practical walkthrough of file-based approach
- [electron-store on npm](https://www.npmjs.com/package/electron-store) - 571K weekly downloads, standard Electron config persistence
- [UlisesGascon/poc-feature-flags-canary-releases](https://github.com/UlisesGascon/poc-feature-flags-canary-releases) - Electron-specific feature flag POC using config files

## Confidence Assessment

- **Overall confidence: High.** This is a well-understood problem space with clear consensus for local apps.
- **No conflicting information** -- all sources agree that for local/desktop apps with developer-facing toggles, simple config-based approaches are correct.
- **No further research needed** unless the requirements expand to include user-segment targeting or remote flag management, at which point OpenFeature with flagd becomes relevant.
