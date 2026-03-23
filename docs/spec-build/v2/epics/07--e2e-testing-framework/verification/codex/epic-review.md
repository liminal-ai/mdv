# Epic 7 — E2E Testing Framework: Adversarial Review

**Reviewer:** Codex (gpt-5.4, adversarial diversity pass)
**Session ID:** `019d18a9-a178-7993-82c2-627f28850e01`
**Date:** 2026-03-22
**Token usage:** 1,136,284 input (1,023,744 cached) / 18,588 output

---

## Methodology

Adversarial review targeting issues other reviewers might miss: false-positive tests, race conditions, spec deviations, weak assertions, test isolation failures, flakiness risks, and security concerns. Every finding is cross-referenced against the epic spec, tech design, and actual implementation code.

---

## P0 — Critical

### 1. Stale-`dist` false-green path

**Files:** `server-manager.ts:2`, `package.json:18`, `epic.md:20`

The suite runs the built server from `dist/`, but `npm run test:e2e` does not build first. E2E tests can go green against stale build artifacts even when current source is broken — including the `app.ts` save/re-render path the epic is specifically supposed to protect.

**Impact:** The entire suite can report a false green. This is the single highest-risk finding.

**Fix:** Make `test:e2e` include a build prerequisite, or run the server from source in the test harness so the suite always exercises current code.

---

## P1 — High

### 2. Import-time state file dependency (ENOENT on `--list`)

**Files:** `state.ts:25`, `interaction.spec.ts:14`, `navigation.spec.ts:10`

Every spec reads the shared state file at module import time. `npx playwright test --list` fails with `ENOENT` before any tests are discovered because global setup hasn't written the file yet. This is brittle import-order coupling.

**Fix:** Load E2E state lazily in a fixture or `beforeAll`, or pass it through Playwright fixtures/env instead of top-level imports.

### 3. Session state leakage between tests

**Files:** `helpers.ts:11`, `app.ts:1660`, `app.ts:1309`, `rendering.spec.ts:8`

The suite does not isolate server-side session state between tests. `setWorkspaceAndNavigate()` resets root but not `openTabs`. The client restores tabs from session on boot, so later tests can start with documents already open. `openFile()` can appear to work even if tree-click/open-file behavior is broken.

**Fix:** Clear `openTabs`/`activeTab` in a shared `beforeEach`, or use a fresh session dir/server per test. Strengthen `openFile()` to assert a state change caused by the click.

### 4. `restart()` port race condition

**Files:** `server-manager.ts:66`, `index.ts:35`, `tech-design.md:124`

`ServerManager.restart()` does not wait for the port to be released. `startServer()` silently falls back to a random port on `EADDRINUSE`. On a slow machine, restart can come back on a different port while the test still reloads the old URL — exactly the race the tech design said to avoid.

**Fix:** Poll until the old port is free, restart on the same port, and fail hard if reclaiming it fails.

### 5. TC-7.1b false positive (theme options)

**Files:** `persistence.spec.ts:64`, `persistence.spec.ts:145`, `menu-bar.ts:59`

`themeOptions()` selects all View menu items, but the View menu also contains `Toggle Sidebar`. The test can pass with only one actual theme configured, meaning it does not verify the spec requirement it claims to cover.

**Fix:** Target only theme entries (e.g., items whose label starts with `Theme:` or a dedicated data attribute) and assert two distinct theme IDs.

### 6. Shared state file security and cross-run collision

**Files:** `state.ts:19`, `global-teardown.ts:27`

The shared state file lives at one predictable tmp path for every run. Fallback teardown blindly `rm -rf`s whatever directories the JSON names. Stale/corrupted state can make one run delete another run's fixtures. An attacker with same-user access could steer teardown deletes.

**Fix:** Generate a unique per-run state path via env, validate that teardown only deletes directories created under expected temp prefixes.

---

## P2 — Medium

### 7. TC-6.1b stricter than spec (export visibility)

**Files:** `interaction.spec.ts:245`, `epic.md:369`

The spec allows export actions to be disabled or hidden when no document is active; the test only accepts "not visible." A compliant UI refactor to disabled controls would fail the suite.

**Fix:** Assert hidden-or-disabled, not just hidden.

### 8. HTML export test too weak

**Files:** `interaction.spec.ts:225`, `api.ts:221`, `export.ts:94`

The test proves a file exists and contains `<html`, but doesn't verify the HTML menu item sent `format: 'html'`, used the active document, or exported expected content. A wrong format mapping or wrong source file could still pass.

**Fix:** Capture/assert the `/api/export` request payload and verify the exported file contains known text from `simple.md`.

### 9. Empty-state test insufficiently specific

**Files:** `navigation.spec.ts:53`, `epic.md:181`

The empty-state test only checks one title string. The spec says launch state should show the app name and action prompts. Those prompts could disappear and the test would still pass.

**Fix:** Assert the specific launch-state affordances described in the epic.

### 10. Mermaid rendering test too broad

**Files:** `rendering.spec.ts:65`, `epic.md:254`

The valid Mermaid test only checks that some SVG appears in `.markdown-body`. It doesn't prove the Mermaid block rendered correctly or replaced the code block it was supposed to replace.

**Fix:** Assert a Mermaid-specific container/node/text from the expected diagram, or assert the source block is replaced by a rendered Mermaid artifact.

### 11. Hardcoded `Meta+s` platform assumption

**Files:** `interaction.spec.ts:165`, `interaction.spec.ts:202`, `app.ts:1977`

Save tests hardcode `Meta+s`, baking in a macOS platform assumption.

**Fix:** Use platform-specific modifier selection in the test helper, or trigger save via UI/API when the test is not specifically about shortcut wiring.

---

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| P0 | 1 | False-green from stale build artifacts |
| P1 | 5 | State isolation, race conditions, false-positive assertions, security |
| P2 | 5 | Weak assertions, spec deviations, platform assumptions |

**Top 3 highest-risk issues:**
1. Stale-`dist` false-green path (P0) — entire suite can lie
2. Session state leakage (P1) — tests pass on leaked state, not actual behavior
3. Import-time state file (P1) — `--list` and any pre-setup invocation fails
