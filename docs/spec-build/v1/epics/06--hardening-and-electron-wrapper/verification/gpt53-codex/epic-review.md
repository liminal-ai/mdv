# Epic 6 Verification Review — GPT-5.3 Codex

> **Reviewer:** GPT-5.3 (gpt-5.4 model, medium reasoning effort)
> **Codex CLI Session ID:** `019d133f-6439-72b1-9fff-c4ec99f9500f`
> **Date:** 2026-03-21
> **Scope:** Full epic-level review of Epic 6: Hardening and Electron Wrapper

---

## Executive Summary

Epic 6 is only partially complete. The implementation does cover several core hardening pieces well, especially `PersistedTab` session migration, lazy tab restore, file-tree virtualization, chunked large-document rendering, and the basic Electron shell/menu/file-open path.

The largest gaps are in the exact edge-case behaviors the epic was written to harden: slow/disconnected filesystem timeouts are not fully enforced, the Electron quit flow does not use the required multi-file dirty-tabs modal, Electron mid-session server crash recovery is missing, and a few important ACs/TCs are either implemented differently than specified or not actually verified by the automated pipeline.

## Critical Findings

- **AC-5.3 / TC-5.3a-b-c are not fully implemented because timeout protection only covers part of the filesystem path.** Tree scans time out only around `readdir()`, but still perform uncancelled `realpath()` and `stat()` calls during root validation, loop detection, and symlink resolution in `tree.service.ts:58`, `tree.service.ts:97`, and `tree.service.ts:186`. File reads have the same issue: only `readFile()` gets a 10s abort signal, while `stat()` and `realpath()` still run without timeout in `file.service.ts:43` and `file.service.ts:52`. On slow or disconnected mounts, those calls can hang past the epic's visible-error budget.

- **The Epic 6 automation does not prove the Electron implementation is green, and one Epic 6 Electron test is currently failing.** The repo's `verify-all` script omits Electron tests in `package.json:23` and `package.json:27`, even though the test plan says `verify-all` should include `test:electron`. I ran the Epic 6 slices: the browser/server subset passed, but the Electron suite currently fails `TC-7.1a` in `main.test.ts:106`. That means the advertised Epic 6 verification path is not actually closing the loop on the Electron half of the epic.

## Major Findings

- **AC-10.1 is not implemented as specified: Electron quit uses the wrong modal.** The quit path in `app.ts:2085` calls `showUnsavedModal(firstDirty, 'quit')`, which only handles one filename. The modal itself in `unsaved-modal.ts:35` renders `You have unsaved changes in ${modal.filename}.` with buttons `Save and Close`, `Discard Changes`, and `Cancel`. The epic requires the Electron-specific dirty-tabs modal listing all dirty files with `Save All and Quit`, `Discard All and Quit`, and `Cancel` for TC-10.1a-b-c-d-e.

- **AC-13.2b is missing entirely: there is no Electron mid-session server crash recovery path.** The main process only handles startup failure by loading a static error page in `main.ts:72` and `window.ts:41`. On the renderer side, the only "disconnect" UX is the live-reload WebSocket message in `app.ts:1889`. There is no `Server disconnected — Restart` button, no restart IPC, and no code path that relaunches Fastify after startup.

- **AC-13.1a is only partially met because large-file behavior still diverges from the epic.** The client shows a blocking confirmation for files between 1MB and 5MB in `app.ts:57` and `app.ts:1313`, even though the epic says large files should open "as any other document" with no warning required. On top of that, the server still hard-rejects files above 20MB in `file.service.ts:15` and `file.service.ts:48`. The implementation matches the tech-design deviation, but it does not fully satisfy the epic AC as written.

- **TC-13.1b is not implemented: timeout yields retry-only, not a partial tree with incomplete indicator.** The server returns a `SCAN_ERROR` timeout response in `tree.ts:42`; the app converts that into a retry callback in `app.ts:452`; and the UI renders only a retry action in `error-notification.ts:23`. That is a documented design deviation, but it is still a gap against the epic test condition.

- **AC-6.1 / AC-6.3 are weakened by incorrect cache invalidation semantics.** `invalidateForTab()` deletes every cache entry whose source hash appears in the closing tab in `mermaid-cache.ts:45`, and tab close always calls it in `app.ts:917`. If another open tab still uses the same Mermaid source, the shared cache entry is still purged. That contradicts the design's "only remove entries associated exclusively with the closed tab" intent and can cause avoidable re-renders on later tab switches.

- **Electron listener lifecycle is not safe across window recreation.** `app.on('activate')` can create a new window in `main.ts:91`, and every new `wireMainWindow()` call re-registers global `ipcMain.on()` listeners through `menu.ts:149` and `ipc.ts:14` without removing old handlers. That creates duplicate-menu-update and duplicate-quit-handler risk after window recreation.

- **The performance tests do not really verify the performance ACs they are mapped to.** `startup.test.ts` measures time around a mocked bootstrap in JSDOM in `startup.test.ts:40`, and `many-tabs.test.ts` mostly asserts state transitions and DOM text in `many-tabs.test.ts:153`. Those are useful smoke tests, but they do not validate the stated real-world budgets for TC-1.2a, TC-3.1a, TC-3.2a, or TC-4.1a-b-c.

- **The timeout tests miss the most important unprotected branches.** `tree-hardening.test.ts` verifies a hung `readdir()` path in `tree-hardening.test.ts:237`, and slow file read via aborted `readFile()` in `tree-hardening.test.ts:255`, but there are no tests for slow `stat()` or `realpath()` on trees or files, which is exactly where the implementation remains vulnerable.

## Minor Findings

- **`VirtualTree` does not correctly handle viewport shrink.** `getViewportHeight()` in `virtual-tree.ts:171` uses `Math.max(clientHeight, this.viewportHeight, rowHeight)`, so once the viewport grows, later shrink events will not reduce the cached height. The existing resize test in `virtual-tree.test.ts:188` only covers growth.

- **The native menu state contract is broader than the menu implementation.** The renderer sends `hasDirtyTab`, `activeMode`, and `defaultMode` in `app.ts:2176`, and the preload bridge exposes those fields in `preload.ts:32`, but `menu.ts` never uses them meaningfully beyond storing them in `menu.ts:12`. That is harmless today but is interface drift from the tech design.

- **Client timeout behavior is inconsistent with the epic's 10-second expectation.** `ApiClient.readFile()` uses a 15-second client-side abort in `api.ts:99`, while the server-side contract and spec target 10 seconds. That mismatch can delay visible feedback.

- **There is a small layering violation in the client cache module.** `mermaid-cache.ts` imports its entry type from a server schema module in `mermaid-cache.ts:1`. It is type-only and not a runtime bug, but it is contrary to the intended separation between client and server modules.

## AC/TC Coverage Matrix

| Epic Area | AC / TC | Status | Evidence |
|---|---|---|---|
| Large files | AC-1.1, TC-1.1a-b | Partial | Chunked render exists in `content-area.ts:598` and `chunked-render.ts:41`; tests exist in `chunked-render.test.ts:86`. |
| Large files | TC-1.1c | Partial | Mermaid rendering remains async via `mermaid-renderer.ts:139`, but there is no Epic 6-specific large-doc progressive Mermaid integration test. |
| Large files | AC-1.2, TC-1.2a | Weak | Code relies on CodeMirror/editor reuse in `content-area.ts:527`, but there is no meaningful typing-latency verification beyond synthetic unit tests. |
| Large files | TC-1.2b | Covered | Mode-switch chunked rendering is tested in `chunked-render.test.ts:160`. |
| Deep trees | AC-2.1, TC-2.1a-b-c | Partial | Virtualization exists in `file-tree.ts:192` and `virtual-tree.ts:138`; tree-hardening route coverage exists in `tree-hardening.test.ts:71`. |
| Deep trees | AC-2.2, TC-2.2a | Partial | Directory counts are still delivered all-at-once from the server in `tree.service.ts:26`; there is no async badge fill behavior. |
| Many tabs | AC-3.1 | Partial | Lazy restore and switching exist in `app.ts:886`, with structural tests in `many-tabs.test.ts:153`. Actual latency budget is not verified. |
| Many tabs | AC-3.2 | Partial | Unwatch-on-close exists in `app.ts:917`, tested in `many-tabs.test.ts:256`. Real memory reclamation is not measured. |
| Startup | AC-4.1, TC-4.1a-c | Partial | Restore path is implemented in `app.ts:1646`, with synthetic tests in `startup.test.ts:40`. TC-4.1b is only indirectly covered. |
| Filesystem hardening | AC-5.1, AC-5.2, AC-5.4 | Mostly Covered | Route/service behavior exists in `tree.service.ts` and is covered by `tree-hardening.test.ts:108`, `tree-hardening.test.ts:179`, and `tree-hardening.test.ts:326`. |
| Filesystem hardening | AC-5.3 | **Gap** | Timeout handling misses slow `stat`/`realpath` branches; tests do not cover them. |
| Mermaid cache | AC-6.1-6.3 | Partial | Cache exists in `mermaid-cache.ts:14` and renderer integration in `mermaid-renderer.ts:162`, with unit tests in `mermaid-cache.test.ts:9`. Shared-source invalidation behavior is wrong. |
| Electron shell | AC-7.1-7.3 | Partial | Core shell exists in `main.ts` and `window.ts`; unit tests exist, but one current Electron test is failing and listener lifecycle is fragile. |
| Native menu | AC-8.1-8.3 | Mostly Covered | Menu creation and detection are present in `menu.ts:42`, `preload.ts:3`, and `app.ts:362`, with tests in `menu.test.ts:68` and `detection.test.ts:11`. |
| File associations | AC-9.1-9.3 | Partial | Packaging config exists in `electron-builder.yml:13`, file-open flow in `main.ts:36` and `file-handler.ts:3`, but registration persistence remains manual-only. |
| Quit flow | AC-10.1 | **Gap** | Wrong modal and wrong labels/actions. |
| Tab persistence | AC-11.1-11.3 | Mostly Covered | Schema and route changes in `schemas/index.ts:38` and `session.ts:204`; restore path in `app.ts:1646`; tests in `tab-restore.test.ts:179`. |
| Packaging/install | AC-12.1-12.3 | Partial | Builder config and install script exist but are not part of automated verification. |
| Error handling | AC-13.1 | Partial | Timeout+retry exists; partial-tree requirement does not. |
| Error handling | AC-13.2 | **Partial** | Startup failure is handled; mid-session restart is not. |

## Architecture Compliance

The server-side implementation is generally compliant with the intended layering. `session.ts` delegates to `SessionService` in `session.ts:27`, and `tree.ts` delegates to `scanTree()` in `tree.ts:38`. The main architecture weakness is on the client, where `app.ts` now owns tab restore, lazy loading, scroll persistence, watcher registration, menu sync, quit interception, export coordination, and error policy in one place. That still works, but it is not a clean separation of concerns and it makes Epic 6 regressions more likely.

Electron stays reasonably thin in principle: file operations still go over HTTP, and the preload surface is small in `preload.ts:3`. The main architecture non-compliance is listener lifecycle. Global `ipcMain` handlers are registered from per-window setup code in `main.ts:15`, `menu.ts:149`, and `ipc.ts:14`, which is not robust for recreated windows.

## Test Quality Assessment

The test suite is broad, but the Epic 6 quality signal is uneven. The hardening/client restore slices are reasonably good unit coverage, and the specific Epic 6 browser/server tests all passed. The Electron side is weaker: it is excluded from `verify-all`, and the targeted Electron run currently fails one test.

Coverage also tends to be structural rather than behavioral. The performance tests validate that code paths exist, not that the app actually meets the epic budgets on realistic inputs. The timeout tests do not exercise the unprotected `stat`/`realpath` branches. Packaging and file association TCs remain manual-only. The quit-flow tests cover IPC mechanics in `ipc.test.ts:37`, but there is no test proving the required multi-file dirty-tabs modal exists because it currently does not.

## Security Assessment

The Electron shell is configured with the right baseline controls: `contextIsolation`, `nodeIntegration: false`, and `sandbox: true` are set in `window.ts:29`. The wrapper only loads localhost or a local error data URL in `window.ts:39`.

The main residual security concern is Mermaid SVG insertion. Rendered SVG is assigned directly with `innerHTML` in `mermaid-renderer.ts:101` and `mermaid-renderer.ts:216`, with only inline-event stripping as a second pass. That is probably acceptable given Mermaid `securityLevel: 'strict'` in `mermaid-renderer.ts:62`, but it is still a lighter sanitization stance than the rest of the renderer and should be treated as a residual risk.

## Integration & Boundary Assessment

Client/server integration for persisted tabs is solid overall. The schema migration in `schemas/index.ts:38`, server persistence in `session.service.ts:108`, client API call in `api.ts:170`, and client restore path in `app.ts:1646` line up well.

The weaker integration boundaries are all Electron-specific. The menu and quit IPC plumbing exists, but the quit flow is routed into the wrong UI boundary. File-open cold launch is handled correctly through pending-path flush in `file-handler.ts:8`, but server restart and recreated-window listener cleanup are missing. Packaging/install is present as configuration and script, not as a fully verified integration path.

No explicit `TODO` placeholders were found in the Epic 6 code, but AC-13.2b behaves like an unimplemented boundary stub: the epic requires restart behavior and the codebase has no restart boundary at all.

## Recommendations

1. **Fix timeout hardening first.** Add timeout-aware handling for slow `stat()` and `realpath()` in both tree scans and file reads, then add tests that explicitly simulate those branches.
2. **Implement the actual Electron dirty-tabs quit modal.** It should list all dirty filenames and expose `Save All and Quit`, `Discard All and Quit`, and `Cancel`, replacing the current single-file unsaved modal path.
3. **Implement AC-13.2b explicitly.** Add a main-process restart path for Fastify, a renderer-visible `Server disconnected — Restart` affordance, and end-to-end tests for restart/reload.
4. **Reconcile large-file behavior with the epic contract.** Remove the 1MB–5MB confirmation, then decide whether the 20MB cap is acceptable product behavior or needs to be raised/removed.
5. **Fix Mermaid cache lifecycle.** Use reference counting or equivalent shared-source tracking so closing one tab does not purge entries still needed by another tab.
6. **Make Electron lifecycle registration idempotent.** Do not attach global `ipcMain` handlers from per-window creation without cleanup.
7. **Repair the verification pipeline.** Update `verify-all` to include `test:electron`, fix the currently failing Electron test, and keep Epic 6 green as a single pipeline.
8. **Strengthen real-behavior tests.** Add targeted tests for listener duplication, timeout on `stat`/`realpath`, the multi-file quit modal, and at least one packaging/install smoke check.
