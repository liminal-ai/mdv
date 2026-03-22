# Epic Verification Fix List

All 11 items approved. Working directory: /Users/leemoore/code/md-viewer/app

## Should-fix

### 1. Remove large-file confirm gate
**File:** `src/client/app.ts`
**Fix:** Remove the `window.confirm()` dialog that blocks files between 1-5MB. AC-13.1a says large files should open "as any other document" with no warning required. Find the confirm gate and remove it entirely — let chunked rendering handle large files.

### 2. Quit modal: show all dirty files + correct button text
**Files:** `src/client/app.ts`, `src/client/components/unsaved-modal.ts`
**Fix:** When Electron quit is triggered with multiple dirty tabs:
- The modal should list ALL dirty filenames, not just the first one
- Button text should be "Save All and Quit", "Discard All and Quit", "Cancel" (not "Save and Close", "Discard Changes")
- The `showUnsavedModal` function or the quit handler needs to accept a list of dirty files and render them
- The `context: 'quit'` field should drive the button text

### 3. Cold-launch file-open race: renderer-ready handshake
**Files:** `src/electron/file-handler.ts`, `src/electron/preload.ts`, `src/client/app.ts`
**Fix:** The current flow sends `app:open-file` IPC on `did-finish-load`, but the renderer's `onOpenFile` listener registers after async bootstrap. Add a renderer-ready signal:
- After bootstrap completes and `onOpenFile` is registered, the renderer sends a `app:renderer-ready` IPC to main
- `file-handler.ts` waits for this signal before flushing the pending file path
- Preload needs `sendRendererReady()` method, bridge needs to call it
- This is a 7th preload method (8 total now) — acceptable since it's a correctness fix

### 4. ipcMain listener duplication guard on activate
**File:** `src/electron/main.ts`
**Fix:** `wireMainWindow()` registers global `ipcMain.on()` listeners. If called again on `activate` (dock click after window close), listeners duplicate. Fix by either:
- Removing old listeners before re-registering (ipcMain.removeAllListeners for the specific channels)
- Or checking if listeners are already registered before adding
- The menu.ts and ipc.ts registration functions should be idempotent

### 5. Mermaid cache: selective invalidation
**Files:** `src/client/components/mermaid-cache.ts`, `src/client/app.ts`
**Fix:** `invalidateForTab()` currently removes ALL entries matching the closing tab's sources. It should only remove entries whose source is NOT shared by any other open tab. Implementation:
- Accept a second parameter: all Mermaid sources from remaining open tabs
- Build a set of "still needed" source hashes
- Only delete entries whose source hash is NOT in the "still needed" set
- Update the call site in app.ts tab-close to pass remaining tabs' sources

## Trivial

### 6. Client timeout 15s → 10s
**File:** `src/client/api.ts`
**Fix:** Change the file-read abort timeout from 15000 to 10000 to match the epic's 10-second expectation (AC-5.3b).

### 7. Native menu mode indicator
**File:** `src/electron/menu.ts`
**Fix:** The Render/Edit toggle menu item should reflect the current mode. Add `checked: true` or a checkmark to the active mode item. The `activeMode` field is already in MenuState — use it.

### 8. VirtualTree viewport shrink fix
**File:** `src/client/components/virtual-tree.ts`
**Fix:** `getViewportHeight()` uses `Math.max(clientHeight, this.viewportHeight, rowHeight)` which never shrinks. Remove `this.viewportHeight` from the max — just use `Math.max(clientHeight, rowHeight)`. The stored value should track the container, not monotonically increase.

### 9. stat/realpath timeout protection
**File:** `src/server/services/tree.service.ts`
**Fix:** The tree scan timeout (AbortController) only wraps `readdir`. The `stat()` and `realpath()` calls during loop detection and symlink resolution are unprotected. Wrap them with the same abort signal check — call `signal.throwIfAborted()` before each `stat`/`realpath`, or use `AbortSignal.timeout()` on individual calls. Match the pattern already used for readdir.

### 10. 500ms mode-switch loading indicator
**File:** `src/client/components/content-area.ts`
**Fix:** When chunked rendering starts for a mode switch on a large file, add a CSS class (e.g., `rendering-in-progress`) to the content area after a 500ms delay. Remove it when rendering completes. This shows a visual indicator only for slow mode switches, per TC-1.2b. A simple `setTimeout` + class toggle is sufficient.

### 11. Update epic TC-13.1b wording
**File:** `/Users/leemoore/code/md-viewer/docs/spec-build/features/06--hardening-and-electron-wrapper/epic.md`
**Fix:** TC-13.1b currently says "A partial tree is shown (what was scanned so far) with an indicator that the scan was incomplete. The user can retry." Update to match the implemented retry-only behavior: "A timeout error is shown with an option to retry the scan. The app does not crash or hang." This is a documented design deviation — the tech design explains why partial results aren't feasible with AbortController.
