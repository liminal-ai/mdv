# E2E Testing Landscape Research — March 2026

Research conducted: 2026-03-22
Purpose: Inform framework selection for md-viewer E2E testing (affects 8 downstream epics)

---

## Summary

Playwright is the clear winner in the E2E testing landscape as of early 2026. It has achieved dominant market share (~45% adoption among testing teams per TestGuild 2025 survey), surpassed 33 million weekly npm downloads (per tech-insider.org benchmarks article), and is the default recommendation across virtually every comparison published in the last 12 months. For a Node.js/Fastify/vanilla JS project that already has Puppeteer as a dependency, Playwright is the natural choice — it was built by the same team that created Puppeteer, supports all the same Chrome DevTools Protocol patterns, and adds cross-browser support, a built-in test runner, first-class WebSocket mocking/interception, and native API testing capabilities.

Cypress remains a viable alternative with strong developer experience, but its architectural constraints (single-tab, limited WebSocket support, no multi-origin without `cy.origin()`) make it a worse fit for this project's needs. Every other tool evaluated is either not designed for E2E testing (agent-browser), too experimental for production use (Shortest, Magnitude), or has a smaller ecosystem without compelling advantages for this stack (WebdriverIO, Testplane).

The AI-powered testing category (Shortest, Stagehand, Magnitude) is interesting but not production-ready for deterministic test suites. These tools currently sit at 85-95% reliability vs 99%+ for traditional Playwright selectors, and they add cost (LLM API calls per test run) and latency. They are worth monitoring but not suitable as a primary testing framework in 2026.

---

## Detailed Tool Evaluations

### 1. Playwright

**What it is:** Microsoft's open-source browser automation and testing framework, created by the same team that originally built Puppeteer. Supports Chromium, Firefox, and WebKit via a single API.

**Current version:** 1.58.2 (released March 2026). Active monthly release cadence. Latest version line (1.58.x) added Timeline in HTML report Speedboard, CLI+SKILLs mode for AI coding agents, UI Mode improvements (JSON formatting, search in code editors, system theme).

**Previous notable versions:**
- 1.57: Switched from Chromium to Chrome for Testing builds; removed deprecated `page.accessibility`; added Service Worker console/network interception
- 1.56: Introduced Playwright Agents (healer, generator, planner) for AI-assisted test generation and maintenance; added `--test-list` for manual test selection

**Strengths for this project:**
- **WebSocket testing is first-class.** `page.routeWebSocket()` and the `WebSocketRoute` API (stable since v1.48) allow full mocking and interception of WebSocket connections. You can mock entire WebSocket conversations without a real server, or intercept/modify messages between the real client and server. This directly supports testing the project's WebSocket file-watching features.
- **Built-in API testing.** `APIRequestContext` supports sending HTTP requests directly from Node.js without loading a browser page. Can test Fastify API routes natively within the same test framework and reporter.
- **Parallel execution by default.** Tests run in parallel across workers out of the box. No paid plan required (unlike Cypress Cloud for parallelization).
- **Coexists cleanly with Vitest.** The standard pattern in 2026 is Vitest for unit/integration + Playwright for E2E. They use separate config files, separate test directories, and separate `npm run` scripts. Kent C. Dodds (EpicWeb.dev) and the PkgPulse testing stack guide both confirm this is the recommended 2026 stack.
- **Headless CI support.** Excellent out of the box. GitHub Actions, CircleCI, and other CI systems have first-class Playwright support. Docker images available.
- **Trace Viewer and HTML reports.** The Trace Viewer captures screenshots, DOM snapshots, network logs, and console output for every action — invaluable for debugging CI failures.
- **Already shares lineage with Puppeteer.** Built by ex-Puppeteer engineers. Uses Chrome DevTools Protocol under the hood. Familiar patterns for anyone who has used Puppeteer. Migration path is well-documented.
- **TypeScript-first.** Full TypeScript support, auto-generated types, good IDE integration.

**Weaknesses for this project:**
- Learning curve is steeper than Cypress for simple test cases.
- Downloads a browser binary (~200-400MB) during install, which adds to CI cache size.
- Async API requires `await` on every interaction (unlike Cypress's chainable synchronous-feeling API).
- No built-in component testing that works with vanilla JS (component testing targets React/Vue/Svelte — not relevant for this project anyway).

**WebSocket testing support:** Excellent. `page.routeWebSocket(url, handler)` provides full mock and intercept capabilities. The `WebSocketRoute` class offers `send()`, `onMessage()`, `connectToServer()`, `close()`, `onClose()`, and `url()` methods. This is a stable API (since v1.48), not experimental.

**Community/ecosystem:** 78,600+ GitHub stars, 412,000+ repositories use it, 33M+ weekly npm downloads. Microsoft-backed with active monthly releases. State of JS 2024 survey top-ranked. Extensive documentation at playwright.dev.

**Notable:**
- Playwright 1.56 introduced "Playwright Agents" — AI-powered agent definitions that can generate tests from app exploration, heal broken tests, and create test plans. Available via `npx playwright init-agents`. These work with Claude Code, VS Code, and other AI coding tools. This is a significant differentiator for long-term maintenance.
- The Vitest browser mode (stable in Vitest 4.0) uses Playwright under the hood as its browser provider, further cementing Playwright as the ecosystem standard.

---

### 2. Cypress

**What it is:** A JavaScript-based E2E testing framework focused on developer experience, with an interactive test runner and time-travel debugging. Tests execute inside the browser.

**Current version:** 15.12.1 (pending release March 2026). Active development, latest is 15.12.0 (released 2026-03-13). The jump from Cypress 13 to 14 (Jan 2025) to 15 happened within a year.

**Key version changes:**
- Cypress 14 (Jan 2025): Dropped older Node.js versions, upgraded Electron/Chromium, expanded component testing support
- Cypress 15 (late 2025): Stability and performance improvements, modern tooling compatibility

**Strengths for this project:**
- Excellent developer experience. The interactive test runner with time-travel debugging (screenshots at each step) is genuinely best-in-class for debugging test failures locally.
- Lower initial learning curve for simple browser interaction tests.
- Good documentation.
- Component testing integration (though less relevant for vanilla JS).
- `cy.intercept()` for HTTP request interception is well-designed.

**Weaknesses for this project:**
- **WebSocket testing is a significant weakness.** `cy.intercept()` only handles HTTP request-response patterns. It does not support WebSocket connections. Testing WebSockets in Cypress requires workarounds: injecting mock WebSocket servers, using `cy.window()` to access the WebSocket object, or using third-party libraries. Multiple sources confirm this is a pain point with no first-class solution. One article (Atanas Atanasov, June 2025) documents that Cypress even strips custom protocols from WebSocket constructor calls.
- **Single-tab architecture.** Tests run inside the browser in a single tab. No multi-tab, no multi-window testing without significant workarounds.
- **Parallel execution requires Cypress Cloud (paid).** Free tier is limited. Paid plans start at $67-75/month.
- **No built-in API testing.** While you can use `cy.request()` for HTTP calls, it's more limited than Playwright's `APIRequestContext`.
- **Browser support gaps.** Only Chromium and Firefox. Safari/WebKit support is limited or absent.
- **Cross-origin limitations.** Multi-origin flows require `cy.origin()` (improved in v14/15 but still more friction than Playwright).

**WebSocket testing support:** Poor. No native WebSocket interception or mocking. Must use workarounds (window access, mock servers, third-party packages).

**Community/ecosystem:** ~50K GitHub stars, ~5-6M weekly npm downloads. Still widely used but momentum has clearly shifted to Playwright. The "Cypress vs Playwright" discussion in every 2026 article consistently gives Playwright the edge.

**Notable:** Cypress Cloud offers paid features (UI Coverage, Accessibility testing, parallel CI) that are free in Playwright. This cost factor matters at scale.

---

### 3. Puppeteer

**What it is:** Google's official Node.js library for controlling Chrome/Firefox via the DevTools Protocol. A browser automation library, not a testing framework.

**Current version:** 24.40.0 (released 2026-03-19). Actively maintained with frequent point releases. 93.9K GitHub stars, 7.3M weekly npm downloads.

**Strengths for this project:**
- Already in the project for PDF export.
- Lightweight and fast for Chrome-specific automation tasks.
- Direct DevTools Protocol access gives maximum control.
- Supports WebDriver BiDi protocol as of recent versions.

**Weaknesses for this project:**
- **Not a test framework.** No built-in test runner, no assertions, no reporters, no parallel execution. You would need to pair it with Vitest or another test runner and build all the testing infrastructure yourself.
- Chrome/Firefox only (no WebKit/Safari).
- No auto-waiting, no test retries, no trace viewing — all features Playwright provides out of the box.
- Every 2026 comparison article explicitly states: "Puppeteer is a browser automation tool, not a test framework — use it for scraping, PDF generation, and automation tasks, not for application testing" (PkgPulse).

**WebSocket testing support:** You can interact with WebSockets via `page.evaluate()` but there's no dedicated API for WebSocket mocking or interception.

**Community/ecosystem:** Large community due to Google backing and long history. But the consensus is clear: "If you're starting fresh, use Playwright" (PkgPulse, BugBug, BrowserStack, multiple others).

**Notable:** Playwright was literally built by the team that created Puppeteer after they moved from Google to Microsoft. Playwright is "Puppeteer v2" in spirit. The project can keep Puppeteer for PDF export and add Playwright for testing — they do not conflict.

---

### 4. WebdriverIO

**What it is:** A JavaScript/TypeScript test automation framework built on the WebDriver protocol, with support for web and mobile testing.

**Current version:** v9.x (released August 2024). Active development.

**Strengths for this project:**
- WebDriver BiDi protocol support (v9+), giving modern browser automation capabilities.
- Component testing via Browser Runner (uses Vite under the hood).
- Supports mobile testing via Appium integration.
- Mature and flexible — can use Mocha, Jasmine, or Cucumber.

**Weaknesses for this project:**
- **Significantly more complex setup** than Playwright for web-only testing.
- Smaller community for web E2E testing (its strength is mobile + cross-platform).
- More verbose API compared to Playwright.
- WebSocket testing support is not a highlighted feature.
- Primary use case has shifted toward mobile testing with Appium. For web-only E2E testing, it offers no advantages over Playwright and adds complexity.

**WebSocket testing support:** Limited. Can use WebDriver BiDi protocol for some network interception, but no dedicated WebSocket mocking API comparable to Playwright's.

**Community/ecosystem:** 822 GitHub stars for Testplane (which uses WDIO under the hood). WDIO itself has a moderate community, but it's primarily recommended for mobile/cross-platform scenarios, not pure web E2E.

**Notable:** Reddit thread (April 2025) asking "Is WebdriverIO still good in 2025?" — top responses say it's fine for mobile (Appium) but for web testing, use Playwright. This mirrors the broader consensus.

---

### 5. Vercel Agent Browser

**What it is:** A headless browser automation CLI written in Rust, designed specifically for AI agents to control Chrome. Created by Vercel Labs.

**Current version:** v0.21.4 (released 2026-03-20). Very active development — 60 releases since January 2026, 24.2K GitHub stars, 90 contributors.

**Is it suitable for E2E testing?** No. Agent-browser is designed for a fundamentally different use case.

**Why it is NOT suitable:**
- **No test assertions.** It provides observation and interaction commands (click, type, snapshot) but has no assertion library, no test runner, no reporters.
- **Designed for AI agents, not test suites.** The core interaction model is a CLI that AI coding agents (Claude, GPT, etc.) call to browse the web. The `snapshot` command returns an accessibility tree optimized for LLM consumption, not DOM state for test assertions.
- **No test organization.** No concept of test suites, test cases, setup/teardown, parallel execution, or test isolation.
- **Reference-based element targeting** (e.g., `@e1`, `@e2`) is designed for AI agents to navigate pages, not for stable, repeatable test selectors.
- **Would require building an entire test framework around it.** You would need to add a test runner, assertion library, reporter, and all the infrastructure that Playwright provides out of the box.

**What it IS good for:** AI agents that need to browse the web, fill forms, extract data, take screenshots. It's optimized for token efficiency (much smaller context window footprint than Playwright MCP). For example, it's used by AI coding agents to test deployed apps interactively.

**WebSocket testing support:** None.

**Community/ecosystem:** Fast-growing (24K stars in ~2 months) but entirely focused on AI agent use cases. Not a testing tool.

---

### 6. AI-Powered Testing Tools

#### 6a. Shortest (by Antiwork/Gumroad)

**What it is:** An AI-powered E2E testing framework that lets you write tests in natural language (plain English) and executes them using Anthropic Claude + Playwright.

**Current status:** Open source, 5.5K GitHub stars, 329 forks. No stable version number (pre-1.0). Active development.

**How it works:** You write test cases like `"Login to the app using email and password"` and the AI interprets and executes browser actions. Built on Playwright for actual browser control.

**Why it is NOT suitable for this project:**
- **Requires Anthropic Claude API key** — every test run costs money (API calls per test).
- **Non-deterministic.** AI interpretation means the same test can execute differently each time.
- **Requires React >= 19.0.0 and Next.js >= 14.0.0** — doesn't fit a Fastify + vanilla JS stack.
- **Pre-1.0 stability.** Not production-ready for a test suite that gates 8 epics of work.
- **85-95% reliability** (per PkgPulse comparison of AI automation tools) vs 99%+ for Playwright selectors.

**WebSocket testing support:** Not documented.

#### 6b. Stagehand (by Browserbase)

**What it is:** An open-source browser automation SDK that extends Playwright with LLM-powered natural language commands. Positioned as "the AI browser automation framework."

**Current status:** Active development, described as the leading AI-native browser automation framework. Available as an npm package.

**How it works:** Wraps Playwright with methods like `page.act("click the login button")`, `page.extract({ instruction: "...", schema: {...} })`, and `page.observe()`. The LLM interprets the page and finds elements without CSS selectors.

**Why it is NOT suitable as a primary E2E framework:**
- **Adds LLM latency and cost** to every test interaction.
- **85-95% reliability** vs 99%+ for deterministic Playwright selectors.
- **Better suited for prototyping and internal tooling** than production test suites (per PkgPulse).
- **Not a test framework** — it's a browser automation SDK. You'd still need a test runner, assertions, etc.

**Interesting aspect:** Could be used selectively for specific hard-to-automate interactions, while using standard Playwright for the majority of tests. But this adds complexity.

**WebSocket testing support:** Inherits Playwright's capabilities since it wraps Playwright.

#### 6c. Magnitude

**What it is:** An open-source, AI-native test framework that uses visual LLM agents (Moondream VLM) instead of DOM selectors to run tests.

**Current status:** v0.3.13 (Feb 2026). 4K GitHub stars. Active development.

**How it works:** Uses two agents — a planner and an executor. The planner builds a general test plan from natural language, the executor runs it using pure vision (screenshot analysis, no colored bounding boxes). Plans can be saved and re-run cheaply.

**Why it is NOT suitable:**
- **Experimental/early-stage.** Under active development, not battle-tested.
- **Vision-based approach** means tests can break on visual changes that don't affect functionality.
- **Adds AI infrastructure cost and complexity.**
- **94% on WebVoyager benchmark** — impressive for an AI agent but not sufficient for deterministic CI test gating.

**WebSocket testing support:** Not documented.

#### 6d. Browser Use

**What it is:** A Python-first agentic browser control library. 78K+ GitHub stars.

**Not suitable for this project:** Python-first, not JavaScript/Node.js. Designed for autonomous AI agents, not structured test suites.

---

### 7. Other Notable Tools

#### 7a. Testplane (ex-Hermione)

**What it is:** A battle-hardened E2E testing framework from Yandex, based on Mocha and WebdriverIO. Rebranded from Hermione due to trademark issues.

**Current version:** v8.41.2 (March 2026). 822 GitHub stars.

**Assessment:** Mature and capable, with strong parallel execution and plugin system. However, small community outside of Yandex/Russian ecosystem, limited English documentation momentum, and no advantages over Playwright for this project's needs.

#### 7b. Maestro

**What it is:** A mobile and web testing framework using YAML-based test definitions. Backed by a company offering cloud services.

**Assessment:** Primarily focused on mobile testing (React Native, native iOS/Android). Web support exists but is secondary. Cloud pricing ($125/browser/month) makes it a poor fit for an open-source project. Not competitive with Playwright for web-only E2E testing.

#### 7c. PinchTab

**What it is:** A 12MB Go binary that exposes Chrome control via a REST API. 6.4K+ GitHub stars. Designed for AI agents.

**Assessment:** Browser automation tool for AI agents, not a testing framework. No test runner, no assertions, no reporters. Similar category to agent-browser.

#### 7d. Lightpanda

**What it is:** A headless browser written in Zig from scratch (not a Chromium fork). Claims 11x faster than Chrome, 9x less memory. CDP-compatible.

**Assessment:** Interesting for performance-sensitive automation/scraping. CDP compatibility means Puppeteer/Playwright scripts work. However, it's a browser engine, not a testing framework. Would be used as a target browser, not as a test framework replacement. Still in early stages.

---

## Comparison Table

| Dimension | Playwright | Cypress | Puppeteer | WebdriverIO | Agent Browser | Shortest | Stagehand |
|---|---|---|---|---|---|---|---|
| **Primary purpose** | E2E testing + automation | E2E + component testing | Browser automation | Web + mobile testing | AI agent browser control | AI natural-lang testing | AI browser automation |
| **Current version** | 1.58.2 | 15.12.0 | 24.40.0 | v9.x | v0.21.4 | pre-1.0 | Active dev |
| **WebSocket support** | Excellent (native mock/intercept) | Poor (no native support) | Basic (via evaluate) | Limited | None | Unknown | Inherits Playwright |
| **API testing** | Built-in (APIRequestContext) | cy.request() (limited) | Not built-in | Not built-in | None | None | None |
| **Speed** | Fast (parallel by default) | Moderate (serial by default) | Fast | Moderate | Fast | Slow (LLM calls) | Slow (LLM calls) |
| **CI headless support** | Excellent | Good | Good | Good | N/A | Untested at scale | N/A |
| **Learning curve** | Moderate | Low-moderate | Low (automation only) | High | N/A | Low (natural language) | Low |
| **npm weekly downloads** | ~7M (@playwright/test) | ~5-6M | ~7.3M | ~1-2M | N/A | Minimal | Minimal |
| **GitHub stars** | 78.6K | 50K | 93.9K | ~9K | 24.2K | 5.5K | Growing |
| **Browser support** | Chromium, Firefox, WebKit | Chromium, Firefox | Chromium, Firefox | All (via WebDriver) | Chrome only | Chrome (via Playwright) | Chrome (via Playwright) |
| **Built-in test runner** | Yes | Yes | No | Yes | No | Partial | No |
| **Vitest coexistence** | Clean separation | Clean separation | N/A (no runner) | Clean separation | N/A | Unclear | N/A |
| **AI features** | Playwright Agents (1.56+) | None | None | None | Core design | Core design | Core design |
| **Cost** | Free | Free + paid Cloud ($67+/mo) | Free | Free | Free | Free + API costs | Free + API costs |
| **Suitability for this project** | Excellent | Moderate | Poor (not a test framework) | Poor (overkill, web-only) | Not suitable | Not suitable | Not suitable |

---

## Recommendation

**Use Playwright** as the E2E testing framework for md-viewer.

### Reasoning

1. **WebSocket testing is a hard requirement** — Playwright is the only major framework with native, stable WebSocket mocking and interception (`page.routeWebSocket()`, stable since v1.48). Cypress has no native WebSocket support, which would create friction in every epic that involves file-watching or live-reload testing.

2. **API route testing is needed** — Playwright's `APIRequestContext` lets you test Fastify API routes directly within the same framework, without adding another HTTP testing library.

3. **Puppeteer is already in the project** — Playwright was built by the same team and uses the same Chrome DevTools Protocol patterns. The mental model carries over. They can coexist: Puppeteer for PDF export, Playwright for testing.

4. **Vitest coexistence is the standard pattern** — The established 2026 testing stack is Vitest (unit/integration) + Playwright (E2E). Multiple authoritative sources confirm this (Kent C. Dodds, PkgPulse, TestGuild). Separate config, separate commands, separate concerns.

5. **Parallel execution is free** — Playwright runs tests in parallel by default with no paid tier. Cypress requires Cloud for parallel CI.

6. **Cross-browser coverage** — Playwright supports Chromium, Firefox, and WebKit. While this project may primarily target Chrome, having WebKit coverage (Safari rendering engine) costs nothing extra.

7. **AI-assisted maintenance** — Playwright 1.56+ introduced Playwright Agents that work with Claude Code and VS Code. The `healer` agent can automatically repair failing tests when selectors change. This is a genuine long-term maintenance advantage.

8. **Ecosystem momentum** — Every comparison article from late 2025 through March 2026 recommends Playwright for new projects. The 45.1% adoption rate (TestGuild 2025), 33M+ weekly downloads, and 78.6K GitHub stars indicate a tool that will be well-supported for years.

9. **Scale** — 30-40 tests initially, growing over time. Playwright's parallel execution, sharding, and project configuration handle scaling well without paid services.

### Practical setup for this project

```
project/
  tests/
    unit/          # Vitest
    integration/   # Vitest
    e2e/           # Playwright
  vitest.config.ts
  playwright.config.ts
```

- `npm run test:unit` → vitest (unit + integration)
- `npm run test:e2e` → playwright test
- Puppeteer remains for PDF export (separate concern, not a test dependency)

---

## Tools NOT Suitable (Summary)

| Tool | Why Not |
|---|---|
| **Agent Browser (Vercel)** | Not a test framework. CLI for AI agents to browse the web. No assertions, no test runner, no test organization. Would require building an entire test framework around it. |
| **Shortest** | Requires React + Next.js. Pre-1.0 stability. Non-deterministic (AI-powered). Costs money per run (Claude API). 85-95% reliability is insufficient for CI gating. |
| **Stagehand** | Not a test framework — a browser automation SDK. Adds LLM cost/latency. 85-95% reliability. Better for prototyping than production test suites. |
| **Magnitude** | Experimental (v0.3.x). Vision-based approach is novel but not battle-tested. 94% benchmark accuracy is insufficient for deterministic CI. |
| **Browser Use** | Python-first. Designed for autonomous AI agents, not structured JS test suites. |
| **PinchTab** | Browser automation tool for AI agents. No test runner or assertions. |
| **Puppeteer (as test framework)** | Not a test framework. No runner, no assertions, no reporters. Keep it for PDF export, don't use it for testing. |
| **WebdriverIO** | Viable but adds complexity without advantages for web-only testing. Primary strength is mobile/Appium. No WebSocket mocking API. |
| **Testplane** | Mature but small community outside Yandex ecosystem. No advantages over Playwright. |
| **Maestro** | Primarily mobile-focused. Paid cloud pricing. Not competitive for web E2E. |

---

## Sources

- [PkgPulse: Playwright vs Cypress 2026](https://www.pkgpulse.com/blog/playwright-vs-cypress-2026) — Detailed technical comparison with download stats. Published March 2026.
- [PkgPulse: Playwright vs Cypress vs Puppeteer E2E Testing 2026](https://www.pkgpulse.com/blog/playwright-vs-cypress-vs-puppeteer-e2e-testing-2026) — Three-way comparison explicitly stating Puppeteer is not a test framework. Published March 2026.
- [PkgPulse: Vitest vs Jest vs Playwright Complete Stack Guide 2026](https://www.pkgpulse.com/blog/vitest-jest-playwright-complete-testing-stack-2026) — Confirms Vitest + Playwright as the standard 2026 stack. Published March 2026.
- [Tech Insider: Playwright vs Cypress vs Selenium 2026 — 11 Benchmarks](https://tech-insider.org/playwright-vs-cypress-vs-selenium-2026/) — Benchmark data, 33M weekly npm downloads stat. Published March 2026.
- [DevTools Research: Playwright vs Cypress vs Selenium 2026](https://devtoolswatch.com/en/playwright-vs-cypress-vs-selenium-2026) — Playwright 1.57+ details, 45.1% adoption rate, 78.6K stars, 412K repos. Published Feb 2026.
- [BugBug.io: Cypress vs Playwright 2026](https://bugbug.io/blog/test-automation-tools/cypress-vs-playwright/) — Architecture comparison, performance benchmarks. Published March 2026.
- [Decipher: What's New with Playwright in 2026](https://getdecipher.com/blog/whats-new-with-playwright-in-2026) — 1.58.x release details. Published March 2026.
- [New Releases: Playwright v1.58.0](https://newreleases.io/project/github/microsoft/playwright/release/v1.58.0) — CLI+SKILLs, Timeline features. Published Jan 2026.
- [New Releases: Playwright v1.56.0](https://newreleases.io/project/github/microsoft/playwright/release/v1.56.0) — Playwright Agents introduction. Published Oct 2025.
- [Playwright Official: WebSocketRoute API](https://playwright.dev/docs/api/class-websocketroute) — Stable API documentation for WebSocket mocking/interception (since v1.48).
- [Playwright Official: API Testing](https://playwright.dev/docs/next/api-testing) — APIRequestContext documentation.
- [Cypress Changelog](https://docs.cypress.io/app/references/changelog) — v15.12.0 release details. Current as of March 2026.
- [Cypress 14 Announcement](https://www.cypress.io/blog/cypress-14-is-here-see-whats-new) — Published Jan 2025.
- [Puppeteer npm](https://www.npmjs.com/package/puppeteer) — v24.40.0, 7.3M weekly downloads. Current as of March 2026.
- [Puppeteer Changelog](https://pptr.dev/CHANGELOG) — Release history through March 2026.
- [GitHub: vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) — 24.2K stars, v0.21.4, purpose and architecture details.
- [Medium: Forget CSS Selectors — Testing with agent-browser](https://medium.com/@ronan2025song/forget-playwright-selectors-how-agent-browser-is-rewriting-the-rules-of-automation-28d793a5c82e) — SDET perspective on agent-browser. Published Jan 2026.
- [GitHub: antiwork/shortest](https://github.com/antiwork/shortest) — 5.5K stars, AI-powered natural language testing.
- [LogRocket: AI-powered E2E Testing with Shortest](https://blog.logrocket.com/simplifying-e2e-testing-open-source-ai-testing-tools/) — Shortest evaluation. Published May 2025.
- [NxCode: Stagehand vs Browser Use vs Playwright](https://www.nxcode.io/resources/news/stagehand-vs-browser-use-vs-playwright-ai-browser-automation-2026) — AI browser automation comparison, 85-95% reliability stat. Published Feb 2026.
- [PkgPulse: Stagehand vs Playwright AI vs Browser Use](https://www.pkgpulse.com/blog/stagehand-vs-playwright-ai-vs-browser-use-ai-web-automation-2026) — AI automation reliability gap analysis. Published March 2026.
- [Stagehand.dev](https://stagehand.dev/) — Official Stagehand site, feature comparison table.
- [HN: Magnitude Show HN](https://news.ycombinator.com/item?id=43796003) — Magnitude founding team description, pure vision approach.
- [GitHub: magnitudedev/browser-agent](https://github.com/magnitudedev/browser-agent) — 4K stars, v0.3.13.
- [TestGuild: 12 AI Test Automation Tools 2026](https://testguild.com/7-innovative-ai-test-automation-tools-future-third-wave/) — AI testing landscape overview. Published March 2026.
- [QA Wolf: 12 Best AI Testing Tools 2026](https://www.qawolf.com/blog/the-12-best-ai-testing-tools-in-2026) — Categorization of AI testing approaches. Published Feb 2026.
- [WebdriverIO v9 Release](https://webdriver.io/blog/2024/08/15/webdriverio-v9-release) — WebDriver BiDi protocol support. Published Aug 2024.
- [Reddit: Is WebdriverIO still good in 2025?](https://www.reddit.com/r/QualityAssurance/comments/1jtrcxa/is_webdriverio_still_good_in_2025/) — Community consensus for web vs mobile.
- [Testplane.io](https://testplane.io/docs/v8) — Testplane overview and capabilities.
- [Kent C. Dodds: Vitest Browser Mode vs Playwright](https://www.epicweb.dev/vitest-browser-mode-vs-playwright) — Authoritative comparison of testing tools. Published Nov 2025.
- [Atanas Atanasov: Testing WebSockets with Cypress](https://atanas.info/blog/testing-websockets-with-cypress) — Documents Cypress WebSocket limitations. Published Jun 2025.
- [LinkedIn: WebSocket Testing in Cypress](https://www.linkedin.com/pulse/beyond-cyintercept-real-time-websockets-testing-daniil-shapovalov-ep0if) — cy.intercept limitations for WebSocket. Published Jan 2025.
- [Emelia: PinchTab](https://emelia.io/hub/pinchtab-browser-ia) — PinchTab description. Published March 2026.
- [Lightpanda Blog](https://themenonlab.blog/blog/lightpanda-headless-browser-ai-agents) — Lightpanda architecture, benchmarks. Published March 2026.

---

## Confidence Assessment

**Overall confidence: High**

- The recommendation of Playwright is supported by every comparison article published in 2025-2026 that I found. No source recommended against Playwright for new web-only projects.
- WebSocket testing support comparison is well-documented across multiple sources.
- Version numbers and feature details verified against official changelogs and release notes.
- Adoption/download statistics corroborated across multiple independent sources (npm, GitHub, TestGuild survey, DevTools Research).

**Areas of lower confidence:**
- Exact npm download numbers vary across sources (some report @playwright/test, others report the playwright package — the 33M number from tech-insider.org may aggregate both). The relative ordering (Playwright > Cypress in momentum) is consistent.
- AI testing tool maturity assessments are based on current state; this space is evolving rapidly. The 85-95% reliability figure for AI-powered automation comes from PkgPulse's analysis (March 2026) and may improve.

**No further research needed.** The data strongly supports Playwright as the right choice for this project. The nearest competitor (Cypress) has a disqualifying weakness (WebSocket support) given this project's requirements.
