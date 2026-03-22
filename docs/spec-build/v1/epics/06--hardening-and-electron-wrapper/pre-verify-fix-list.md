# Pre-Verification Cleanup — Fix List

All 7 items approved for implementation. Working directory: /Users/leemoore/code/md-viewer/app

## 1. body.electron #app grid rule (Story 6 defer)

**File:** `src/client/styles/menu-bar.css` (or wherever the `#app` grid is defined — check `styles/base.css`)
**Fix:** Add CSS rule to collapse the menu bar row when in Electron:
```css
body.electron #app {
  grid-template-rows: 0 minmax(0, 1fr);
}
```
The `#app` grid has `grid-template-rows: 2.75rem minmax(0, 1fr)` — the 2.75rem row is the menu bar. When `#menu-bar` is hidden via `display: none`, the row persists as blank space.

## 2. Remove dead invalidateTheme method (Story 3 accepted-risk)

**File:** `src/client/components/mermaid-cache.ts`
**Fix:** Remove the `invalidateTheme(themeId: string)` method. It's never called anywhere. The spec says old-theme entries should remain for switch-back reuse — this method contradicts that policy.

## 3. Remove </hr> from chunked-render regex (Story 1 accepted-risk)

**File:** `src/client/components/chunked-render.ts`
**Fix:** In the `splitHtmlChunks` regex, remove `hr` from the block boundary pattern. `<hr>` is a void/self-closing element — `</hr>` never appears in valid HTML, so it never matches. Removing it makes the regex accurate.

## 4. syncTabsToSession filter by tab status (Story 4 accepted-risk)

**File:** `src/client/app.ts`
**Fix:** In `syncTabsToSession()`, filter the tabs before mapping to PersistedTab objects. Only persist tabs with `status === 'ok'`. Deleted/error tabs should not be re-persisted — they'll show as "file not found" on restore anyway if the file is still missing, and if the file was restored they should open fresh.

## 5. app.on('activate') re-registration (Story 6 defer)

**File:** `src/electron/main.ts`
**Fix:** Extract the post-window-creation wiring (buildMenu, registerIpcHandlers, setupFileHandler) into a reusable function. Call it from both the `app.whenReady()` block and the `app.on('activate')` handler. Currently activate only calls `createMainWindow` but doesn't wire up menus, IPC, or file handling for the new window.

## 6. Add console.error to main.ts startup catch (Story 5 observation)

**File:** `src/electron/main.ts`
**Fix:** In the catch block that handles startServer() failure (the one that shows the error page), add `console.error('Server failed to start:', error);` before loading the error page. Currently the error is swallowed — the error page says "check the console" but nothing is logged.

## 7. Add fastify.close() on quit (Story 5 accepted-risk)

**File:** `src/electron/main.ts`
**Fix:** Before the app quits (in the `before-quit` or `will-quit` event, or in the quit-confirmed handler), call `fastify.close()` on the stored Fastify instance. This ensures clean resource release (file watchers, open handles). The Fastify instance is returned from `startServer()` — store a reference at module scope.
