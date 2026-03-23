# Playwright Setup Research for md-viewer

**Date**: 2026-03-22
**Scope**: 8 specific questions about Playwright v1.58.x for a Fastify + vanilla JS project

---

## Summary

Playwright v1.58.2 is the current latest stable release. For end-to-end testing, `@playwright/test` is the only package to install -- it bundles the test runner, assertions, and `playwright-core` internally. The official system requirements page lists Node.js 20, 22, and 24 as supported; Node 25.x is not listed but the package.json engines field is `>=18`, so it will likely work. Playwright handles TypeScript natively with zero config. No known conflicts with Puppeteer or Vitest when used with separate configs and scripts.

---

## 1. Latest Stable Version

**Answer: v1.58.2** (released 2026-02-06)

- v1.58.0 released 2026-01-23
- v1.58.1 released 2026-01-30
- v1.58.2 released 2026-02-06 (latest as of 2026-03-22)
- v1.59.0 is in alpha (1.59.0-alpha-2026-03-17)

Browser versions bundled with 1.58.x:
- Chromium 145.0.7632.6
- Mozilla Firefox 146.0.1
- WebKit 26.0

Also tested against Google Chrome 144 and Microsoft Edge 144.

Notable v1.58 change: Starting from v1.57, Playwright switched from Chromium to "Chrome for Testing" builds. Headed mode uses `chrome`; headless mode uses `chrome-headless-shell`.

**Sources**: [GitHub Releases](https://github.com/microsoft/playwright/releases), [playwright.dev release notes](https://playwright.dev/docs/release-notes), [npm @playwright/test](https://www.npmjs.com/package/@playwright/test)

---

## 2. Package to Install

**Answer: `@playwright/test` is the only package needed for E2E testing. No peer dependencies.**

### `@playwright/test` vs `playwright`

| Package | Purpose | Use When |
|---------|---------|----------|
| `@playwright/test` | Full test runner + assertions + browser automation | E2E testing (our case) |
| `playwright` | Library-only browser automation, no test runner | Custom scripts, scraping, integrating with other test frameworks |
| `playwright-core` | Core engine, no browser downloads | Building tools on top of Playwright |

Key facts:
- `@playwright/test` has exactly **1 dependency**: `playwright` (which itself depends on `playwright-core`)
- No peer dependencies are declared
- Install command: `npm i -D @playwright/test`
- Then: `npx playwright install` (or `npx playwright install chromium` for Chromium only)

**Important**: Do NOT install both `@playwright/test` and `playwright` as separate top-level dependencies. They share a `playwright` CLI script name and can conflict. `@playwright/test` already includes everything from the `playwright` package.

**Sources**: [npm @playwright/test](https://www.npmjs.com/package/@playwright/test), [Playwright Library docs](https://playwright.dev/docs/library), [GitHub issue #23624](https://github.com/microsoft/playwright/issues/23624)

---

## 3. Node.js Compatibility

**Answer: Officially supports Node 20, 22, and 24. Node 25.x is not explicitly listed but should work.**

### Official System Requirements (from playwright.dev)

> Node.js: Latest 20.x, 22.x, or 24.x versions

### The engines field nuance

The actual `package.json` engines field is `"node": ">=18"`. A GitHub issue (#38901) asked about updating this to `>=20`. Maintainer Yury Semikhatsky responded that they would wait until Node 26 to change the field, because many users still run Node 18 and they "don't want to break them for no reason." This means:

- **npm will not reject installation on Node 25.8.0** -- the engines field allows it
- Node 25 is the current release line and is newer than the tested 24.x
- Playwright's CI likely does not test against Node 25 (odd-numbered releases are current/non-LTS)
- **Practical risk: Low**. Node 25 is backward-compatible with 24. No reports of Playwright failures on Node 25.

### Recommendation

Node 25.8.0 will almost certainly work fine. If you encounter edge cases, you can fall back to Node 24.x (latest LTS candidate). But this is unlikely to be an issue.

**Sources**: [playwright.dev/docs/intro](https://playwright.dev/docs/intro) (System Requirements section), [GitHub issue #38901](https://github.com/microsoft/playwright/issues/38901)

---

## 4. Configuration for a Fastify App

**Answer: Full minimal config below, tailored for a Fastify server.**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Where to find test files
  testDir: './e2e',

  // Run tests in parallel
  fullyParallel: true,

  // Fail CI if test.only is left in
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit workers on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for page.goto('/')
    baseURL: 'http://localhost:3000',

    // Collect trace on first retry (great for debugging CI failures)
    trace: 'on-first-retry',

    // Screenshots on failure
    screenshot: 'only-on-failure',
  },

  // Browser projects -- Chromium only for now
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to add more browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Start Fastify server before tests
  webServer: {
    command: 'node src/server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
    // New in v1.57: wait for specific stdout before considering server ready
    // wait: { stdout: /listening on port/ },
  },

  // Output directory for test artifacts (traces, screenshots, videos)
  outputDir: 'test-results',

  // Global timeout per test (default is 30s)
  timeout: 30_000,

  // Expect timeout (default is 5s)
  expect: {
    timeout: 5_000,
  },
});
```

### Key configuration notes

**baseURL**: Set in `use.baseURL`. All `page.goto('/')` calls resolve against this. No need to repeat the full URL in every test.

**webServer**: Launches your Fastify server before tests run. Key options:
- `command`: The shell command to start the server
- `url`: Playwright polls this URL until it returns a 2xx/3xx/4xx status
- `reuseExistingServer`: Set to `true` locally so you can run the server manually during development; `false` on CI
- `timeout`: How long to wait for server startup (default 60s, 10s is fine for Fastify)
- `wait` (new in v1.57): Match stdout with regex instead of polling the URL -- useful if your server logs "Listening on port 3000"

**Headless mode**: Headless is the default. No configuration needed. To run headed during development: `npx playwright test --headed`.

**Multiple servers**: `webServer` accepts an array if you need to start both frontend and backend.

**Sources**: [playwright.dev/docs/test-configuration](https://playwright.dev/docs/test-configuration), [playwright.dev/docs/test-webserver](https://playwright.dev/docs/test-webserver), [v1.57 release notes (webServer.wait)](https://playwright.dev/docs/release-notes)

---

## 5. Coexistence with Puppeteer

**Answer: They can coexist in the same project. They use completely separate browser binaries. One known hazard to avoid.**

### How they stay separate

- **Playwright** stores browsers in `~/.cache/ms-playwright/` (or a configurable location via `PLAYWRIGHT_BROWSERS_PATH`)
- **Puppeteer** stores browsers in `~/.cache/puppeteer/` (or configurable via `PUPPETEER_CACHE_DIR`)
- They download different browser builds -- Playwright uses "Chrome for Testing" (since v1.57), Puppeteer uses its own Chromium/Chrome builds
- No shared state, no shared binaries, no version coupling

### Known hazard: CLI script name collision

GitHub issue #23624 documents that if you install both `@playwright/test` AND `playwright` as separate top-level dependencies alongside `puppeteer`, the `playwright` CLI script name can collide in `node_modules/.bin/`. This is only a problem if you install the `playwright` library package directly. Since we're only installing `@playwright/test`, this is not an issue.

### Disk space

Having both installed means two sets of browser binaries on disk. Chromium alone is ~280MB for Playwright + ~170-280MB for Puppeteer. Not a functional problem, just disk usage.

### Recommendation

No conflicts expected. Keep `@playwright/test` for E2E tests and `puppeteer` for whatever it's currently used for. They operate independently.

**Sources**: [PkgPulse comparison](https://www.pkgpulse.com/blog/playwright-vs-puppeteer-2026), [GitHub issue #23624](https://github.com/microsoft/playwright/issues/23624), [BrowserStack comparison](https://www.browserstack.com/guide/playwright-vs-puppeteer)

---

## 6. Coexistence with Vitest

**Answer: No known issues. Standard pattern is separate configs and separate npm scripts. This is a well-trodden path.**

### How they stay separate

- **Vitest** uses `vitest.config.ts` (or `vite.config.ts`) and runs via `npx vitest` / `npm run test`
- **Playwright** uses `playwright.config.ts` and runs via `npx playwright test` / `npm run test:e2e`
- They have no shared dependencies that conflict
- They don't interfere with each other's test discovery

### Vitest Browser Mode (separate concern)

Vitest has a "Browser Mode" feature that can use Playwright as a provider (via `@vitest/browser-playwright`). This is for running Vitest component tests in a real browser -- a different use case from Playwright E2E tests. You do NOT need this for standard E2E testing. Mentioning it only because it shows the two tools are designed to work alongside each other.

### Typical package.json scripts pattern

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

### Recommendation

No conflicts. The separate-config, separate-script pattern is exactly right.

**Sources**: [Vitest docs on Playwright browser mode](https://main.vitest.dev/guide/browser/playwright), [Dev.to tutorial on Vitest+Playwright coexistence](https://dev.to/juan_deto/configure-vitest-msw-and-playwright-in-a-react-project-with-vite-and-ts-part-3-32pe), [The Candid Startup blog](https://www.thecandidstartup.org/2025/01/06/component-test-playwright-vitest.html)

---

## 7. Browser Binary Installation

**Answer: `npx playwright install` downloads all three browsers. You can install only Chromium. Total size for all three is ~650MB; Chromium alone is ~280MB.**

### Commands

| Command | What it does |
|---------|-------------|
| `npx playwright install` | Downloads Chromium, Firefox, and WebKit |
| `npx playwright install chromium` | Downloads only Chromium (~281MB) |
| `npx playwright install firefox` | Downloads only Firefox (~187MB) |
| `npx playwright install webkit` | Downloads only WebKit (~180MB) |
| `npx playwright install --with-deps` | Downloads browsers + OS-level dependencies |
| `npx playwright install --with-deps chromium` | Chromium + OS dependencies only |

### Size estimates (from official docs)

- Chromium: ~281MB
- Firefox: ~187MB
- WebKit: ~180MB
- **Total for all three: ~648MB**

### Storage location

Default: `~/.cache/ms-playwright/` (shared across projects using the same Playwright version)

Override with: `PLAYWRIGHT_BROWSERS_PATH=/custom/path npx playwright install`

### Cleanup

- `npx playwright uninstall` -- removes browsers for current Playwright version
- `npx playwright uninstall --all` -- removes all cached browsers across all versions
- `npx playwright install --list` -- shows what's installed

### Recommendation for md-viewer

Install Chromium only during development: `npx playwright install chromium`. Add Firefox and WebKit later if cross-browser testing is needed. This saves ~370MB of disk space.

**Sources**: [playwright.dev/docs/browsers](https://playwright.dev/docs/browsers)

---

## 8. TypeScript Support

**Answer: Playwright handles TypeScript natively. It works with TypeScript 5.9. It does not need its own tsconfig but recommends one for path mapping.**

### How it works

Playwright reads `.ts` test files directly, transforms them to JavaScript internally, and runs them. There is no compilation step you need to manage. From the docs:

> "You just write tests in TypeScript, and Playwright will read them, transform to JavaScript and run."

### TypeScript version compatibility

Playwright does NOT type-check your code -- it only strips types and transforms. This means it is agnostic to the TypeScript version you have installed. TypeScript 5.9 will work fine. Even if there are non-critical TS compilation errors, Playwright will still run the tests.

The docs recommend running `tsc --noEmit` separately (e.g., in CI) if you want type checking.

### tsconfig support

Playwright picks up the closest `tsconfig.json` automatically but only uses these options:
- `allowJs`
- `baseUrl`
- `paths`
- `references`

All other tsconfig options (like `strict`, `target`, `module`) are ignored by Playwright's internal transformer. They still affect your IDE and `tsc` type checking, which is fine.

### Recommended setup

A separate `tsconfig.json` in the tests directory:

```
src/
  source.ts
e2e/
  tsconfig.json       # test-specific tsconfig (optional, for path mapping)
  example.spec.ts
tsconfig.json          # project-wide tsconfig
playwright.config.ts
```

### Does `playwright.config.ts` need special TS handling?

No. Playwright reads it directly as TypeScript.

**Sources**: [playwright.dev/docs/test-typescript](https://playwright.dev/docs/test-typescript)

---

## Confidence Assessment

| Question | Confidence | Notes |
|----------|-----------|-------|
| 1. Latest version | **High** | Confirmed from GitHub releases, npm, and playwright.dev |
| 2. Package to install | **High** | Confirmed from npm dependency tree and official docs |
| 3. Node.js compatibility | **Medium-High** | Node 20/22/24 officially supported. Node 25 not listed but engines field allows it. No failure reports found. |
| 4. Fastify config | **High** | Based on official configuration docs; webServer pattern is well-documented |
| 5. Puppeteer coexistence | **High** | Separate binary storage, separate packages, no shared state |
| 6. Vitest coexistence | **High** | Standard pattern, well-documented, no conflicts reported |
| 7. Browser binaries | **High** | Sizes and commands from official docs |
| 8. TypeScript support | **High** | Official docs confirm native TS handling; version-agnostic by design |

### One area of uncertainty

**Node 25.8.0**: The official system requirements list Node 20, 22, and 24 only. Node 25 is a current/odd-numbered release, not yet LTS. The `engines` field in package.json (`>=18`) will not block installation. In practice, Playwright will almost certainly work on Node 25 since it is backward-compatible with Node 24. But if you hit an obscure runtime issue, this is the one place to look first.
