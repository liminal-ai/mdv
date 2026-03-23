# Epic 7: E2E Testing Framework — Epic-Level Review

**Reviewer:** Opus (epic review agent)
**Date:** 2026-03-22
**Scope:** Full epic review — final quality gate before ship
**Artifacts reviewed:** Epic, tech design, all 10 implementation files, package.json, app.ts bug fix, team impl log

---

## Executive Summary

The Epic 7 implementation is **complete and ship-ready**. All 27 ACs and 50 TCs are covered across 34 Playwright tests in 4 spec files. The infrastructure (ServerManager, fixtures, helpers, state) faithfully implements the tech design's interfaces. The architecture is sound — serial execution with shared server, fresh browser contexts per test, programmatic server restart for persistence tests. No critical or major issues found. A real app bug was discovered and fixed during implementation (save not refreshing rendered HTML), validating the epic's purpose.

**Verdict: PASS — ready to ship.**

---

## AC/TC Coverage Matrix

### Complete Coverage: 27/27 ACs, 50/50 TCs

| AC | TC(s) | Test Location | Status |
|----|-------|---------------|--------|
| AC-1.1 | TC-1.1a | navigation.spec.ts (smoke test proves server reachable) | Covered |
| AC-1.1 | TC-1.1b | global-teardown.ts (server stop + port release) | Covered (infrastructure) |
| AC-1.1 | TC-1.1c | global-setup.ts (temp sessionDir creation) | Covered (infrastructure) |
| AC-1.1 | TC-1.1d | global-setup.ts:23-81 (verifyPortConflictHandling) | Covered (infrastructure) |
| AC-1.2 | TC-1.2a | Playwright built-in (fresh BrowserContext per test) | Covered (framework) |
| AC-1.2 | TC-1.2b | Playwright built-in (context closed after test) | Covered (framework) |
| AC-1.3 | TC-1.3a | navigation.spec.ts TC-2.2a (tree shows fixture files) | Covered (implicit) |
| AC-1.3 | TC-1.3b | global-teardown.ts (cleanupFixtures) | Covered (infrastructure) |
| AC-1.3 | TC-1.3c | fixtures.ts (hardcoded content strings, no random/time data) | Covered (by design) |
| AC-1.4 | TC-1.4a | package.json `test:e2e`: `npx playwright test` | Covered (script) |
| AC-1.4 | TC-1.4b | package.json `test`: `vitest run` (unchanged) | Covered (script) |
| AC-1.4 | TC-1.4c | package.json `verify-all`: `npm run verify && npm run test:e2e` | Covered (deliberate deviation: `verify-all` not `verify`) |
| AC-1.5 | TC-1.5a | playwright.config.ts reporter: `[['html', { open: 'never' }], ['list']]` | Covered (config) |
| AC-2.1 | TC-2.1a | navigation.spec.ts line 17 | Covered |
| AC-2.1 | TC-2.1b | navigation.spec.ts line 25 | Covered |
| AC-2.2 | TC-2.2a | navigation.spec.ts line 61 | Covered |
| AC-2.2 | TC-2.2b | navigation.spec.ts line 73 | Covered |
| AC-2.2 | TC-2.2c | navigation.spec.ts line 80 | Covered |
| AC-2.3 | TC-2.3a | navigation.spec.ts line 87 | Covered |
| AC-2.3 | TC-2.3b | navigation.spec.ts line 95 | Covered |
| AC-3.1 | TC-3.1a | rendering.spec.ts line 7 | Covered |
| AC-3.2 | TC-3.2a | rendering.spec.ts line 18 | Covered |
| AC-3.3 | TC-3.3a | rendering.spec.ts line 32 | Covered |
| AC-3.4 | TC-3.4a | rendering.spec.ts line 48 | Covered |
| AC-3.5 | TC-3.5a | rendering.spec.ts line 61 | Covered |
| AC-3.5 | TC-3.5b | rendering.spec.ts line 70 | Covered |
| AC-3.6 | TC-3.6a | rendering.spec.ts line 82 | Covered |
| AC-4.1 | TC-4.1a | interaction.spec.ts line 61 | Covered |
| AC-4.1 | TC-4.1b | interaction.spec.ts line 73 | Covered |
| AC-4.2 | TC-4.2a | interaction.spec.ts line 89 | Covered |
| AC-4.3 | TC-4.3a | interaction.spec.ts line 101 | Covered |
| AC-4.3 | TC-4.3b | interaction.spec.ts line 117 | Covered |
| AC-5.1 | TC-5.1a | interaction.spec.ts line 128 | Covered |
| AC-5.1 | TC-5.1b | interaction.spec.ts line 139 | Covered |
| AC-5.2 | TC-5.2a | interaction.spec.ts line 153 | Covered |
| AC-5.2 | TC-5.2b | interaction.spec.ts line 174 | Covered |
| AC-5.2 | TC-5.2c | interaction.spec.ts line 190 | Covered |
| AC-6.1 | TC-6.1a | interaction.spec.ts line 218 | Covered |
| AC-6.1 | TC-6.1b | interaction.spec.ts line 245 | Covered |
| AC-7.1 | TC-7.1a | persistence.spec.ts line 132 | Covered |
| AC-7.1 | TC-7.1b | persistence.spec.ts line 141 | Covered |
| AC-7.2 | TC-7.2a | persistence.spec.ts line 152 | Covered |
| AC-8.1 | TC-8.1a | persistence.spec.ts line 178 | Covered |
| AC-8.2 | TC-8.2a | persistence.spec.ts line 218 | Covered |
| AC-9.1 | TC-9.1a | persistence.spec.ts line 247 | Covered |
| AC-9.1 | TC-9.1b | persistence.spec.ts line 265 | Covered |
| AC-10.1 | TC-10.1a | helpers.ts:setWorkspaceAndNavigate — used in all spec files | Covered (usage) |
| AC-10.1 | TC-10.1b | helpers.ts:openFile — used in rendering/interaction specs | Covered (usage) |
| AC-10.1 | TC-10.1c | helpers.ts:waitForMermaid — used in rendering.spec.ts | Covered (usage) |
| AC-10.2 | TC-10.2a | tests/e2e/*.spec.ts pattern: navigation, rendering, interaction, persistence | Covered (convention) |

### Test Count by File

| Spec File | Tests | Chunk | TCs |
|-----------|-------|-------|-----|
| navigation.spec.ts | 8 | 0+1 | smoke + TC-2.1a,b + TC-2.2a,b,c + TC-2.3a,b |
| rendering.spec.ts | 7 | 2 | TC-3.1a through TC-3.6a |
| interaction.spec.ts | 12 | 3 | TC-4.1a,b + TC-4.2a + TC-4.3a,b + TC-5.1a,b + TC-5.2a,b,c + TC-6.1a,b |
| persistence.spec.ts | 7 | 4 | TC-7.1a,b + TC-7.2a + TC-8.1a + TC-8.2a + TC-9.1a,b |
| **Total** | **34** | | All 50 TCs (some implicit via infrastructure/framework) |

This matches the tech design's target of 34 tests exactly.

---

## Interface Compliance Against Tech Design

### state.ts
- `E2EState` interface: **Exact match** with tech design
- `writeE2EState`, `readE2EState`, `removeE2EState`: **Match**
- Minor: `STATE_PATH` is exported (design had it as `const`) — no functional impact, actually useful

### server-manager.ts
- `ServerManagerState`, `ServerStartOptions` interfaces: **Exact match**
- `ServerManager` class with `start()`, `stop()`, `restart()`, `getState()`: **Match**
- Implementation detail: imports from `../../../dist/server/index.js` — requires build before E2E, acknowledged in design's runtime prerequisites

### fixtures.ts
- `FixtureWorkspace` interface: **Exact match**
- `createFixtureWorkspace()`, `cleanupFixtures()`: **Match**
- Fixture content: kitchen-sink.md has all required content types (h1/h2/h3, code block, table, links, Mermaid, image), invalid-mermaid.md has broken syntax, simple.md for edits, subdir/nested.md, non-markdown files (.txt, .json), test-image.png (1x1 PNG)

### helpers.ts
- `setWorkspaceAndNavigate()`: **Match**
- `openFile()`: **Match**
- `waitForMermaid()`: **Match** (10s default timeout)
- `enterEditMode()`: **Match**
- `enterRenderMode()`: **Match**
- `expandDirectory()`: **Match**
- `getRenderedContent()`: **Match**

### playwright.config.ts
- All settings match design: `testDir`, `fullyParallel: false`, `workers: 1`, `retries: 0`, reporters, globalSetup/Teardown paths, `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `actionTimeout: 10_000`, chromium project

### global-setup.ts / global-teardown.ts
- Setup flow matches design: create fixtures → start server → set workspace root → write state
- Teardown: dual-path cleanup (runtime object or persisted state fallback)
- Extra: `verifyPortConflictHandling()` for TC-1.1d — not in the design's interface but covers the TC

### package.json scripts
- `test:e2e`: `npx playwright test` — **Match**
- `test:e2e:debug`: `npx playwright test --headed --timeout=0` — **Match**
- `verify-all`: `npm run verify && npm run test:e2e` — **Match** (deliberate deviation from TC-1.4c's "verify" wording)

---

## Architecture Alignment

### Server Lifecycle
- Single global server started in globalSetup, stopped in globalTeardown — **Aligned**
- Persistence tests create dedicated ServerManager instances rather than restarting the global one — **Design deviation, but an improvement** (more isolated, doesn't disrupt the global server for other tests)

### Browser Context Isolation
- Playwright's built-in fresh `BrowserContext` per test — **Aligned**
- No manual context management needed

### State Communication
- JSON state file in tmpdir (`STATE_PATH`) — **Aligned** with Playwright's recommended pattern for globalSetup → test file communication

### Fixture Management
- Temp directories with deterministic content, cleaned up in teardown — **Aligned**
- All fixture content hardcoded (no random/time-dependent data) — **TC-1.3c compliant**

### Serial Execution
- `fullyParallel: false`, `workers: 1` — **Aligned**
- `test.describe.configure({ mode: 'serial' })` in persistence.spec.ts for ordered tests — appropriate

### Mock Strategy
- Only mock: save-dialog endpoint for export tests (`page.route('**/api/save-dialog', ...)`) — **Aligned** with "mock at native OS boundary only" principle
- Session API interception for empty-state test (`page.route` on `/api/session`) — legitimate, tests client rendering behavior

---

## Findings by Severity

### Critical Issues
None.

### Major Issues
None.

### Minor Issues

**M1: Duplicate `resetOpenTabs` helper across spec files**
- Location: interaction.spec.ts:22-35 and persistence.spec.ts:26-39
- The exact same function is defined independently in both files. This contradicts AC-10.1's spirit of shared helpers abstracting common interactions. Should be extracted to helpers.ts.
- Impact: Maintenance burden — if the tabs API changes, both copies must be updated.

**M2: `expandDirectory` helper hardcodes exactly 1 child row**
- Location: helpers.ts:84 (`await expect(visibleRows).toHaveCount(rowCountBefore + 1)`)
- Assumes every expanded directory adds exactly 1 visible row. Works for current fixture (subdir has 1 file) but limits reuse in future epics where directories may have multiple children.
- Impact: Future epic tests using `expandDirectory` with multi-child directories would fail. Already noted as accepted-risk in Story 0 and Story 1 reviews.

**M3: Smoke test named differently from traceability table**
- Location: navigation.spec.ts:12
- The test is named `'smoke: app loads and #app renders'` but the tech design's traceability table maps TC-1.1a to `'TC-1.1a: server is reachable before tests run'`. The smoke test functionally covers TC-1.1a (server must be reachable for the page to load), but the naming diverges from the design.
- Impact: Traceability — a reader matching TC names to test names won't find TC-1.1a.

**M4: Persistence tests share sessionDir with running global server**
- Location: persistence.spec.ts lines 156, 182, 220 — `sessionDir: state.sessionDir`
- The persistence tests create their own ServerManager instances but use the same session directory as the global server (which is still running). Two Fastify servers share one session directory during test execution.
- Impact: Currently safe due to serial execution and the global server not processing requests during persistence tests. But a fragility — any future background processing on the global server could create session file conflicts. Already noted as accepted-risk in Story 4 review.

**M5: `resetDefaultMode` only in interaction.spec.ts — not shared**
- Location: interaction.spec.ts:37-48
- Similar to M1 — this is a test setup helper that could be useful for future epics adding edit-mode tests. Currently only needed by interaction.spec.ts, but extracting to helpers.ts would follow the AC-10.1 convention.
- Impact: Low — future epics may duplicate this pattern.

### Informational

**I1: App bug fix discovered and addressed (save → re-render)**
- Location: app/src/client/app.ts (Story 3 commit 58ed7db)
- E2E testing discovered that saving in edit mode didn't refresh the tab's rendered HTML. Fixed by adding `api.render()` call after `api.saveFile()` and passing the result to `buildSavedTab()`. This is exactly the kind of regression that E2E tests are meant to catch — validates the epic's purpose.

**I2: TC-1.4c deliberate deviation documented**
- The epic says `npm run verify` should include E2E tests. The tech design made a deliberate deviation: E2E tests are in `verify-all`, not `verify`. Reasoning is sound — during Epic 7 implementation, `verify` validates the test infrastructure code, while `verify-all` is the comprehensive gate that includes the E2E tests themselves.

**I3: Console error monitoring deferred**
- The tech design deferred console error monitoring (epic Q11). Tests don't capture `console.error`. This is documented in the design's Deferred Items section.

**I4: PDF export E2E test deferred**
- Only HTML export is tested (TC-6.1a). PDF export was deliberately deferred due to Puppeteer runtime coexistence risk. Documented in tech design's Deferred Items.

---

## Test Quality Assessment

### Anti-Flakiness Patterns
- **Explicit waits, not timeouts**: All tests use Playwright's auto-waiting locators (`waitFor`, `toBeVisible`, `toContainText`) rather than `setTimeout` or sleep. Good.
- **Deterministic fixtures**: All content is hardcoded — no random or time-dependent data. Good.
- **State isolation**: Each test navigates fresh (via `setWorkspaceAndNavigate`), interaction tests reset tabs and default mode before each test. Good.
- **File cleanup**: Edit tests use `try/finally` to restore original file content. Good.
- **Export cleanup**: Export test checks for and clears the export file before testing. Good.

### Assertion Quality
- **Deep DOM assertions**: Rendering tests verify structural hierarchy (table thead/tbody/tr/th/td, code block spans with Shiki attributes, image naturalWidth/naturalHeight). Strong.
- **Behavioral assertions**: Tab tests verify both visual state (active class) and content changes. Edit tests verify dirty indicator, file on disk, and re-rendered content. Strong.
- **Negative assertions**: Non-markdown filtering checks `toHaveCount(0)`, export unavailability checks `toHaveCount(0)`, invalid Mermaid checks SVG count is 0. Good.

### Potential Flakiness Risks
- **File watching tests (TC-9.1a/b)**: Write to disk and wait for WebSocket-driven UI update. Default 10s timeout for TC-9.1a, explicit 5s for TC-9.1b. Chokidar + FSEvents timing could be variable. Acceptable risk — 5s is generous for local filesystem events.
- **Mermaid rendering (TC-3.5a)**: Async SVG rendering with 10s timeout. Mermaid initialization can be slow on first load. Acceptable risk — 10s is generous.

### Security Review
- No secrets or credentials in test code
- All file paths from controlled fixture setup — no path traversal risk
- `page.route` mocking returns controlled paths — no risk
- State file in tmpdir with deterministic name — no sensitive data exposure
- No eval, no dynamic code execution, no user-controlled inputs

### Stubs and Incomplete Implementations
- **None found.** No `test.skip`, `test.todo`, `test.fixme`, `TODO`, `FIXME`, or `STUB` markers anywhere in the test code or utilities.

---

## Cumulative Metrics

| Metric | Value |
|--------|-------|
| ACs covered | 27/27 (100%) |
| TCs covered | 50/50 (100%) |
| Explicit tests | 34 |
| Spec files | 4 (navigation, rendering, interaction, persistence) |
| Utility modules | 4 (state, server-manager, fixtures, helpers) |
| Infrastructure files | 3 (global-setup, global-teardown, playwright.config) |
| Helper functions | 7 (setWorkspaceAndNavigate, openFile, waitForMermaid, enterEditMode, enterRenderMode, expandDirectory, getRenderedContent) |
| Fixture files | 7 (kitchen-sink.md, invalid-mermaid.md, simple.md, nested.md, test-image.png, notes.txt, data.json) |
| App bug fixes | 1 (save → re-render in app.ts) |
| Critical issues | 0 |
| Major issues | 0 |
| Minor issues | 5 |
| Vitest baseline | 710 tests (unchanged) |
| Total test count | 744 (710 Vitest + 34 E2E) |

---

## Conclusion

Epic 7 delivers exactly what it promised: a complete Playwright E2E testing framework covering the v1 critical paths, with reusable infrastructure for future epics. The implementation is faithful to the spec and tech design. The 34 tests cover all 27 ACs and 50 TCs with strong assertions and proper anti-flakiness patterns. The 5 minor issues are all code quality improvements that don't affect correctness or reliability.

The real validation: E2E testing caught a genuine app bug (save not refreshing rendered HTML) during Story 3 implementation. The framework works.

**Ship it.**
