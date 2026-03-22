# Epic 6: Hardening and Electron Wrapper — GPT-5.4 Epic-Level Review

**Reviewer:** OpenAI Codex CLI (GPT-5.4)
**Session ID:** `019d133f-6439-72b1-9fff-c4ec99f9500f`
**Date:** 2026-03-21
**Working Directory:** `/Users/leemoore/code/md-viewer/app`

---

## Scope

Full-codebase review of Epic 6 implementation against:
- Epic spec (`epic.md`)
- Tech designs (`tech-design.md`, `tech-design-api.md`, `tech-design-ui.md`)
- Test plan (`test-plan.md`)

### Source Files Reviewed

**Server:** `server/schemas/index.ts`, `server/services/session.service.ts`, `server/services/tree.service.ts`, `server/services/file.service.ts`, `server/routes/tree.ts`, `server/routes/session.ts`, `server/utils/errors.ts`

**Client:** `client/app.ts`, `client/api.ts`, `client/state.ts`, `client/components/chunked-render.ts`, `client/components/mermaid-cache.ts`, `client/components/virtual-tree.ts`, `client/components/content-area.ts`, `client/components/file-tree.ts`, `client/components/error-notification.ts`, `client/utils/mermaid-renderer.ts`, `client/utils/electron-bridge.ts`

**Electron:** `electron/main.ts`, `electron/window.ts`, `electron/menu.ts`, `electron/ipc.ts`, `electron/file-handler.ts`, `electron/preload.ts`

### Test Files Reviewed (27 files, 246 tests)

**Server tests:** `session.service.test.ts`, `tree.service.test.ts`, `session.test.ts`, `tree-hardening.test.ts`, `tree.test.ts`, `file.test.ts`, `file-save.test.ts`

**Client tests:** `state.test.ts`, `app.test.ts`, `api-export.test.ts`, `chunked-render.test.ts`, `mermaid-cache.test.ts`, `virtual-tree.test.ts`, `content-area.test.ts`, `file-tree.test.ts`, `error-notification.test.ts`, `sidebar-tree.test.ts`, `tab-restore.test.ts`, `many-tabs.test.ts`, `startup.test.ts`, `mode-switching.test.ts`, `mermaid-renderer.test.ts`

**Electron tests:** `main.test.ts`, `window.test.ts`, `menu.test.ts`, `ipc.test.ts`, `file-handler.test.ts`, `detection.test.ts`

---

## Critical (Blocks Release)

### C-1: Cold-launch file-open race condition

- **Category:** Integration
- **Location:** `src/electron/file-handler.ts:3`, `src/electron/main.ts:36`, `src/client/app.ts:2064`, `src/client/app.ts:2115`
- **Description:** Queued `open-file` requests are flushed on `did-finish-load`, but the renderer does not subscribe to `onOpenFile` until after async bootstrap and tab restore complete.
- **Expected:** AC-9.2a/9.2e and AC-7.2b require Finder/dock/second-instance opens to reliably open the requested file once the app is ready.
- **Actual:** Cold-launch and boot-time file-open events can be emitted before any renderer listener exists, so the file can be silently dropped.
- **Recommendation:** Add a renderer-ready handshake and drain queued file-open events only after the renderer explicitly subscribes; cover it with a startup integration test.

---

## Major (Should Fix Before Release)

### M-1: Electron quit shows single-tab modal instead of multi-file quit dialog

- **Category:** AC/TC Coverage
- **Location:** `src/client/app.ts:2085`
- **Description:** Electron quit reuses the single-tab unsaved modal and only passes `firstDirty`.
- **Expected:** AC-10.1a/b requires a custom dirty-tabs modal listing all dirty filenames with `Save All and Quit`, `Discard All and Quit`, and `Cancel`.
- **Actual:** The user is shown only one dirty tab even though the chosen action is then applied to every dirty tab.
- **Recommendation:** Add dedicated quit-modal state/UI for multi-file quit and test the listed filenames/button labels.

### M-2: Large-file confirm gate contradicts spec

- **Category:** AC/TC Coverage
- **Location:** `src/client/app.ts:1313`, `tests/client/app.test.ts:444`
- **Description:** Files between 1MB and 5MB trigger a blocking `window.confirm`.
- **Expected:** AC-13.1a says large files should open with loading/progressive rendering and "no warning is required."
- **Actual:** Opening a large file can be cancelled before rendering starts.
- **Recommendation:** Remove the confirm gate and use non-blocking progress/large-file UI if needed.

### M-3: Missing loading indicator for slow mode switches

- **Category:** AC/TC Coverage | Test Quality
- **Location:** `src/client/components/content-area.ts:598`, `tests/client/components/chunked-render.test.ts:160`
- **Description:** Large render-mode switches use chunked insertion, but there is no 500ms-delayed loading indicator/state for slow mode switches.
- **Expected:** TC-1.2b requires a loading indicator when a large-file mode switch takes more than 500ms.
- **Actual:** The DOM is chunk-filled with no explicit render-in-progress UI, and tests only assert that `renderChunked()` was called.
- **Recommendation:** Add render-in-progress state plus delayed spinner/skeleton and test that behavior.

### M-4: Native menu does not reflect active mode

- **Category:** Interface | AC/TC Coverage
- **Location:** `src/electron/menu.ts:3`, `src/electron/menu.ts:133`, `src/client/app.ts:2176`
- **Description:** `activeMode` and `defaultMode` are sent to main but ignored when building the native menu.
- **Expected:** AC-8.2 and the tech design require native menu state to reflect current app state, including mode indication.
- **Actual:** Only save/export enabled states and theme checkmarks are synchronized.
- **Recommendation:** Make Render/Edit menu items stateful and add tests for mode synchronization.

### M-5: Missing mid-session server crash recovery in Electron

- **Category:** AC/TC Coverage | Architecture
- **Location:** `src/electron/main.ts:72`, `src/electron/preload.ts:1`, `tests/electron/main.test.ts:156`
- **Description:** Startup failure is handled, but mid-session server crash recovery is absent.
- **Expected:** AC-13.2b requires "Server disconnected — Restart" recovery in Electron.
- **Actual:** There is no server-health detection, restart IPC, or renderer restart affordance, and no test for it.
- **Recommendation:** Add server-error/restart channels, main-process restart logic, renderer UI, and an integration test.

### M-6: Partial tree results not implemented for timeout

- **Category:** AC/TC Coverage | Test Quality
- **Location:** `src/server/routes/tree.ts:38`, `tests/server/routes/tree-hardening.test.ts:354`
- **Description:** Timeout handling only returns a retryable error.
- **Expected:** Epic TC-13.1b calls for a partial tree plus an incomplete-scan indicator.
- **Actual:** Implementation follows the documented retry-only deviation; no partial-tree behavior exists or is tested.
- **Recommendation:** Either implement partial/incomplete tree results or formally amend the epic/test plan to match shipped behavior.

---

## Minor (Fix When Convenient)

### m-1: Client file-read timeout misaligned

- **Category:** AC/TC Coverage | Code Quality
- **Location:** `src/client/api.ts:99`
- **Description:** Client-side file-read abort is 15 seconds, not the 10-second budget used elsewhere in the epic.
- **Expected:** TC-5.3b calls for visible timeout behavior within 10 seconds.
- **Actual:** A stalled request can wait 15 seconds before surfacing.
- **Recommendation:** Align the client timeout to 10 seconds.

### m-2: Preload/bridge surface lacks direct tests

- **Category:** Test Quality | Code Quality
- **Location:** `src/electron/ipc.ts:3`, `src/electron/preload.ts:1`, `src/client/utils/electron-bridge.ts:1`
- **Description:** The preload/bridge surface is only indirectly covered.
- **Expected:** Epic 6's Electron bridge contract should have direct tests.
- **Actual:** There is no dedicated `preload` or `electron-bridge` test, so listener registration and bridge exposure are inferred rather than verified.
- **Recommendation:** Add focused preload/bridge tests and listener-lifecycle coverage.

---

## Observations (Informational)

- All 27 test files / 246 tests passed when run locally.
- Packaging and file-association TCs remain config/manual evidence only via `electron-builder.yml` and `scripts/install-app.sh`.
- Server-side hardening (schemas, session management, tree service, error handling) is solid and well-tested.
- Client-side state management, virtual tree, and mermaid caching are well-implemented with good test coverage.
- Electron shell structure (main, window, menu, IPC, file-handler) follows the tech design architecture correctly for the most part.

---

## Summary

| Metric | Result |
|---|---|
| ACs fully met | 26 / 32 (81%) |
| ACs with material gaps | 6 / 32 (19%) |
| Test files reviewed | 27 |
| Tests passing | 246 / 246 |
| Critical findings | 1 |
| Major findings | 6 |
| Minor findings | 2 |
| **Overall assessment** | **Not release-ready** |

The implementation covers the majority of Epic 6 requirements with solid server hardening and well-structured Electron integration. However, the critical file-open race condition and 6 major gaps (quit dialog, large-file gate, mode-switch indicator, menu state sync, server crash recovery, partial tree) need resolution before release.
