# Epic 7 Verification Fix List

## Must-Fix

1. **Stale-dist false-green:** Add `npm run build &&` before `npx playwright test` in the `test:e2e` script in package.json. Also update `verify-all` to include build. The suite runs against `dist/` so it must build first.

2. **Import-time state file ENOENT:** Spec files read the shared state file at import time, which crashes `npx playwright test --list`. Refactor to lazy-load state in a `beforeAll` or Playwright fixture, not at module top level. Affected files: all 4 spec files that import from state.ts.

3. **TC-7.1b theme selector false positive:** `themeOptions()` in persistence.spec.ts selects all View menu items, but the View menu also contains non-theme items like "Toggle Sidebar". Filter to actual theme entries only (e.g., items that match theme labels, or use a data attribute). Assert at least 2 distinct theme options.

## Should-Fix

4. **Session state leakage:** `setWorkspaceAndNavigate()` resets root but not `openTabs`. Add `openTabs` reset to shared test setup to prevent state leaking between tests. Check if `afterEach` hooks in interaction.spec.ts and persistence.spec.ts already handle this — if so, ensure it's consistent across all spec files.

5. **Port race condition in restart():** `ServerManager.restart()` doesn't wait for port release before restarting. Add a brief poll or delay to ensure the port is free before calling `startServer()` again. Or confirm that `preferredPort: 0` is used in restart scenarios (which sidesteps the issue).

6. **Hardcoded `Meta+s`:** Save tests in interaction.spec.ts hardcode `Meta+s`. Make platform-aware using the same pattern as the existing `moveCursorToDocumentEnd` helper (check `process.platform`). Or trigger save via API/UI button when the test isn't specifically about keyboard shortcuts.

7. **State file collision:** The shared state file uses a single predictable path in tmpdir. Generate a unique per-run path (e.g., include process.pid or a random suffix) to prevent cross-run collision. Update teardown to only delete paths it created.

8. **Extract duplicate helpers:** `resetOpenTabs` is duplicated in interaction.spec.ts and persistence.spec.ts. `resetDefaultMode` is only in interaction.spec.ts but useful elsewhere. Extract both to helpers.ts as shared utilities.

9. **`expandDirectory` brittle +1 count:** The helper assumes expanding a directory adds exactly 1 visible row. Change to wait for row count to be greater than the pre-expansion count (not exactly +1), so it works with multi-child directories in future epics.

10. **Persistence tests dual-server architecture:** Persistence tests create their own ServerManager instead of restarting the global one. The tech design specified restarting the shared server. Refactor to either (a) expose the global ServerManager and restart it, or (b) stop the global server, start a fresh one, run persistence tests, then restore the global server. This ensures persistence tests exercise the real restart lifecycle.

## Trivial

12. **Console error monitoring:** Add a `page.on('console')` fixture/helper that captures console.error output during tests and attaches it to test failure reports. ~10-15 lines in helpers.ts or as a Playwright fixture.

13. **TC-6.1b hidden-or-disabled:** The export unavailable test (interaction.spec.ts) only checks `not visible`. The spec allows the export action to be disabled OR hidden. Change assertion to accept either hidden or disabled state.

14. **HTML export content verification:** The export test checks the file exists and contains `<html` but doesn't verify the exported content includes text from the source document. Add an assertion that the exported HTML contains known text from simple.md.

15. **Empty-state test assertion:** TC-2.1b (navigation.spec.ts) only checks the title string. The spec says the launch state should show action prompts. Add assertion for the action prompt text visible in the empty state.

16. **Mermaid test specificity:** TC-3.5a (rendering.spec.ts) only checks that some SVG appears. Add an assertion for Mermaid-specific content (e.g., a node label from the fixture diagram) to verify the correct diagram rendered.

17. **Smoke test rename:** The smoke test in navigation.spec.ts is named `'smoke: app loads and #app renders'` but should reference TC-1.1a for traceability: `'TC-1.1a: server is reachable and app shell renders'`.

18. **Extract `resetDefaultMode`:** Move `resetDefaultMode` from interaction.spec.ts to shared helpers.ts alongside the other extracted helpers (bundle with item 8).
