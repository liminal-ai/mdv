# Epic 2 Code Review: Document Viewing and Multi-Tab Reading

**Reviewer:** Claude Sonnet 4.6
**Date:** 2026-03-20
**Scope:** All spec artifacts, all server/client source files, all test files
**Verdict:** Ship-ready with minor qualifications. No critical defects. Two major gaps worth addressing.

---

## Summary

Epic 2 is a high-quality implementation. The architecture follows the tech design closely, the render pipeline is well-structured, the WebSocket lifecycle is correct, and the tab management logic is thorough. The test suite is particularly strong — render tests use real JSDOM HTML parsing rather than string matching, and the WS tests correctly simulate the watcher lifecycle including atomic saves and debounce windows.

The findings below reflect a careful reading of every spec claim against every code path. Nothing here is a fire — the two Major findings are feature gaps against documented design decisions, not bugs in existing behavior.

---

## Critical — None

No blocking defects found.

---

## Major

### M1 — 1–5MB file size confirmation dialog not implemented

**Location:** `app/src/client/app.ts`, `openFile()` function
**Spec reference:** tech-design.md Q8, tech-design-api.md "File Routes" section

The design decision in Q8 specifies three tiers:
- Under 1MB: render normally
- 1–5MB: show client-side confirmation dialog before displaying
- Over 5MB: server returns 413 (correctly implemented)

The server correctly returns `size` in every `FileReadResponse`. The `largeFileResponse` test fixture includes a 2MB size. However, `openFile()` in `app.ts` never checks `response.size` and never shows a confirmation dialog — all files up to 5MB render immediately.

No test covers this flow. No AC directly names the 1MB warning (it's a design Q&A resolution, not an epic AC), so no TC is missing from coverage. The gap is between the documented design decision and the implementation.

**Impact:** Users who accidentally click a large generated file (e.g., a 3MB agent output) may experience visible lag as the HTML renders. No data loss or functional breakage.

**Suggested fix:** In `openFile()`, after receiving `response`, check `response.size >= 1024 * 1024`. If true and user is prompted and cancels, remove the loading tab. A simple `window.confirm()` is sufficient for this epic.

---

### M2 — Wrong error code on session endpoint validation failures

**Location:** `app/src/server/routes/session.ts`, lines 198 and 218
**Spec reference:** tech-design.md, Error Codes table (400: `INVALID_PATH`)

Both `PUT /api/session/default-mode` and `PUT /api/session/tabs` return `ErrorCode.INVALID_PATH` when Zod validation fails:

```typescript
// line 198
return reply.code(400).send(toApiError(ErrorCode.INVALID_PATH, 'Invalid mode value'));

// line 218
return reply.code(400).send(toApiError(ErrorCode.INVALID_PATH, 'Invalid tab data'));
```

Neither of these failures involves an invalid path — `INVALID_PATH` is semantically wrong for a malformed mode enum or malformed tabs array. The test in `session-epic2.test.ts` does verify the 400 status and the `INVALID_PATH` code, but that test is verifying the current wrong behavior.

**Impact:** API callers (and future Epic 5 client code) inspecting error codes get a misleading signal. A mode validation failure looks identical to a path validation failure.

**Suggested fix:** Add `INVALID_REQUEST` or `INVALID_MODE` to `ErrorCode`, or use `INVALID_PATH` only for actual path fields. At minimum, the test should be updated when the code is fixed.

---

## Minor

### m1 — Redundant filesystem check in image route

**Location:** `app/src/server/routes/image.ts`, lines 46–47

```typescript
const { contentType } = await imageService.validate(imagePath);  // calls fs.stat()
await access(imagePath, constants.R_OK);                          // calls fs.access() redundantly
const stream = createReadStream(imagePath);
```

`imageService.validate()` already calls `fs.stat()` to confirm the file exists and is a regular file. The subsequent `access()` is a second round-trip to the same filesystem node for a check that's already been confirmed. On a local filesystem this is microseconds, but it's unnecessary complexity.

**Suggested fix:** Remove the `access()` call and the `constants` / `access` imports. Permission errors from `createReadStream` are already caught by the existing error handler.

---

### m2 — `content-area.ts` re-renders on every state change

**Location:** `app/src/client/components/content-area.ts`, line 206

```typescript
return store.subscribe(render);
```

The content area subscribes to all state changes without a `changed` key filter. Every unrelated mutation (tree loading, sidebar collapse, workspace addition, context menu open) triggers a full re-render including `container.replaceChildren()`, `markdownBody.innerHTML = activeTab.html`, and `attachLinkHandler()`. For large documents, this causes redundant HTML parsing and DOM updates on operations with no visual effect on the content area.

Compare to `tab-strip.ts` and `content-toolbar.ts` which both guard on relevant changed keys.

**Suggested fix:**
```typescript
const unsubscribe = store.subscribe((state, changed) => {
  if (changed.includes('tabs') || changed.includes('activeTabId') || changed.includes('session')) {
    render();
  }
});
return unsubscribe;
```

---

### m3 — Debounce value (300ms) diverges from spec (100ms)

**Location:** `app/src/server/services/watch.service.ts`, line 6

```typescript
export const WATCH_DEBOUNCE_MS = 300;
```

The tech design specifies 100ms. The implementation uses 300ms. The constant is exported and the tests use it correctly (`vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS)`), so the tests are self-consistent and not broken. But the documented behavior is 100ms.

300ms is defensible — it's more conservative for agents doing incremental writes. However, it diverges from spec without an ADR note.

**Suggested fix:** Either update the spec note or add a code comment explaining why 300ms was chosen over 100ms.

---

### m4 — `RENDER_ERROR` code documented but not implemented

**Location:** `app/src/server/utils/errors.ts`, `app/src/server/routes/file.ts`

The tech-design.md error codes table documents a `500 RENDER_ERROR` for "Unexpected error during rendering." The `errors.ts` file does not include this code. If `renderService.render()` somehow throws (extremely unlikely — markdown-it handles all input gracefully), the error falls through to the generic handler:

```typescript
return reply.code(500).send(toApiError(ErrorCode.READ_ERROR, 'Failed to read the requested file.'));
```

A render failure would appear as `READ_ERROR` with an unhelpful message about file reading.

**Suggested fix:** Add `RENDER_ERROR` to `ErrorCode`, catch render errors specifically between the `fileService.readFile()` and `return` blocks, and use a clearer message.

---

### m5 — `markdownItAnchor` missing explicit `permalink: false`

**Location:** `app/src/server/services/render.service.ts`, lines 43–45

```typescript
md.use(markdownItAnchor, {
  slugify: (value: string) => slugger.slug(value),
});
```

The tech design specifies `permalink: false` ("No permalink icons — just IDs on headings"). In `markdown-it-anchor` v9.x permalinks are opt-in (default: no permalink icons), so the behavior is correct. However, the intent is not self-documenting in the code. A future maintainer upgrading the plugin or reading the config won't know that `permalink` was a deliberate choice.

**Suggested fix:** Add `permalink: false` as an explicit config option with a comment.

---

### m6 — Tab session restore is sequential, not parallel

**Location:** `app/src/client/app.ts`, `restoreTabsFromSession()` function, lines 890–914

```typescript
for (const loadingTab of loadingTabs) {
  try {
    const response = await api.readFile(loadingTab.path);
    // ...
  } catch (error) { ... }
}
```

When restoring 5+ tabs from session on app boot, each file is fetched sequentially. Ten tabs means ten sequential HTTP round-trips. On a local server this is fast, but it's a suboptimal pattern when `Promise.all` with error handling per item is available and straightforward.

Additionally, the UI shows all tabs in loading state simultaneously but only updates them all at once after the loop completes — incremental DOM updates would feel faster.

**Suggested fix:** Replace the sequential loop with `Promise.allSettled`:
```typescript
const results = await Promise.allSettled(loadingTabs.map(tab => api.readFile(tab.path)));
```
Then iterate `results` to build `restoredTabs`.

---

### m7 — Loading indicator not directly tested (AC-1.2)

**Spec reference:** AC-1.2, TC-1.2a, TC-1.2b

TC-1.2a and TC-1.2b require testing that a loading indicator appears during the in-flight fetch and disappears when content renders. No test file explicitly intercepts a pending promise to verify the loading DOM state. The `tab-states.ts` fixture provides a tab with `loading: true`, and the content-area and tab-strip tests do render it, but no test verifies the transition: "before response resolves → spinner visible; after resolve → spinner gone."

**Suggested fix:** In `content-area.test.ts`, add a test that creates a deferred promise, calls `openFile`, checks for `.content-area__loading` in the DOM, then resolves the promise and checks the loading element is gone.

---

### m8 — Client-side deleted file retry polling untested

**Spec reference:** AC-7.3b, TC-7.3b

TC-7.3b is covered at the `WatchService` level (watch.test.ts correctly verifies the `created` notification). However, the client-side `scheduleDeletedFileRetry()` interval loop in `app.ts` (lines 383–406) is not tested. This loop fires every 2 seconds, up to 5 times, re-sending `watch` messages. The WS test `TC-7.3b` covers the server-side `created` notification, and `TC-7.2a` covers client content refresh, but the specific retry polling behavior — intervals firing, max attempts being respected, cancellation when tab is closed — has no test coverage.

---

### m9 — `link-handler.ts` early return for unsupported schemes lacks intent comment

**Location:** `app/src/client/utils/link-handler.ts`, lines 150–153

```typescript
if (hasUnsupportedScheme(href)) {
  return;  // no preventDefault — falls through to browser default
}
event.preventDefault();
```

This correctly lets `mailto:`, `tel:`, and similar links fall through to default browser handling. But without a comment, the early return looks like a safety gap. The design intent (DOMPurify strips `javascript:` server-side, all other non-http schemes are handled by the browser) is not visible.

**Suggested fix:** Add a comment: `// Let non-http(s) schemes (mailto:, tel:, etc.) fall through to the browser's default handler.`

---

## AC / TC Coverage Assessment

### Coverage: Confirmed Present

| Area | Status |
|------|--------|
| AC-1.1 (open from tree) | Covered — file.test.ts TC-1.1a |
| AC-1.3 (dedup via canonicalPath) | Covered — file.test.ts TC-1.3b + app.ts logic |
| AC-1.4 (outside root) | Covered — file.test.ts TC-1.4a |
| AC-1.5 (file picker) | Covered — file.test.ts TC-1.5a/b/c |
| AC-2.1–2.11 (all render ACs) | Covered — file.render.test.ts, all TCs present |
| AC-3.1–3.3 (images) | Covered — file.render.test.ts + file-images.test.ts |
| AC-4.1–4.5 (tab management) | Covered — tab-strip.test.ts + app.test.ts |
| AC-5.1–5.3 (link navigation) | Covered — link-handler.test.ts |
| AC-6.1–6.5 (toolbar) | Covered — content-toolbar.test.ts |
| AC-7.1–7.4 (file watching) | Covered — ws.test.ts + ws client test |
| AC-8.1 (path display) | Covered — menu-bar-epic2.test.ts |
| AC-9.1–9.3 (error handling) | Covered — file.test.ts + ws client test |

### Coverage: Gaps

| Area | Gap |
|------|-----|
| AC-1.2 (loading indicator transition) | No in-flight test (m7) |
| TC-7.3b (deletion retry polling — client) | Only server-side covered (m8) |
| 1–5MB warning confirmation | No test exists; feature not implemented (M1) |

---

## Interface Compliance

### Schema vs. Implementation

All schemas in `schemas/index.ts` match the tech-design-api.md specification exactly:
- `FileReadResponseSchema` includes `html`, `warnings`, `canonicalPath` — correct
- `SessionStateSchema` adds `defaultOpenMode`, `openTabs`, `activeTab` with `.default()` values — correct
- `SetDefaultModeRequestSchema` restricts to `z.enum(['render'])` — correct
- `ClientWsMessageSchema` / `ServerWsMessageSchema` discriminated unions — correct
- `AbsolutePathSchema` uses `startsWith('/')` — technically weaker than `path.isAbsolute()` but the service layer re-checks

### Module Responsibility Alignment

All modules listed in the tech design module responsibility matrix exist with the expected responsibilities. No responsibility slippage observed.

---

## Architecture Alignment

The implementation follows the server-side rendering decision faithfully. The render pipeline (markdown-it → Mermaid placeholder → image post-processing → DOMPurify) matches the tech design exactly.

One positive deviation: `render.service.ts` uses a more robust regex for image src extraction:
```typescript
const IMG_TAG_RE = /<img\s+([^>]*?)src\s*=\s*(["'])(.*?)\2([^>]*?)>/gi;
```
This handles single-quoted src attributes and whitespace around `=`, going beyond the spec's simpler regex. Tests for these edge cases exist in `file.render.test.ts`. Good proactive work.

---

## Security Assessment

### Render Pipeline

- DOMPurify is applied after markdown-it render — correct order
- `html: true` (raw inline HTML) + DOMPurify = correct defense-in-depth
- `escapeHtml()` is applied to image placeholder source strings — XSS in placeholder text is prevented
- `javascript:` URIs are stripped by DOMPurify before HTML reaches the client; `link-handler.ts` also guards against unusual schemes

### Path Handling

- `AbsolutePathSchema` only checks `startsWith('/')` — path traversal like `/../../etc/passwd` passes schema validation, but this is the intended "no root restriction" design decision (Q9)
- `open-external.ts` uses `execFile('open', [filePath])` (array form) — correct, prevents shell injection. The earlier `exec`-based design in the spec was replaced with `execFile` in implementation — this is a security improvement
- Image proxy exposes any absolute path with a supported image extension — intentional by design

### WebSocket

- Input from WebSocket is parsed through `ClientWsMessageSchema.parse()` — Zod throws on malformed input, caught and returned as error message
- No authentication/authorization on WebSocket — consistent with the app's localhost-only model

---

## Resource Management

### File Watchers

`WatchService.destroyWatcher()` correctly closes the FSWatcher and clears debounce timers. The `unwatchAll()` path is triggered on WebSocket close. No watcher leaks observed.

One edge case: in `createWatcher()`, if `watch()` itself throws synchronously (e.g., file disappears between `ensureWatcher`'s stat check and watcher creation), the error is caught and notified as an error message. The subscribers map still has the entry. However, `ensureWatcher()` checks `!this.subscribers.has(filePath)` at line 70 before creating, and `unwatch()` will clean up normally. No memory leak.

### WebSocket Reconnect

`WsClient.disconnect()` sets `shouldReconnect = false` before closing — prevents runaway reconnect loops. The `reconnectTimer` is cleared on both `connect()` and `disconnect()`. No timer leaks.

### Tab Cleanup

Closing a tab calls `unwatchPath()` before removing from state. The `closeOtherTabs` and `closeTabsToRight` functions both iterate the to-be-closed tabs and call `unwatchPath()` for each. The `deletedFileRewatchTimers` Map is correctly cleared by `clearDeletedFileRetry()` on both unwatch and successful restore.

---

## Cross-Story Integration

### Story 1 (File Open) → Story 2 (Tab Management)

Tab state lifecycle in `openFile()` correctly: creates loading tab → fetches → detects canonical duplicates post-fetch → hydrates tab. The post-fetch duplicate detection handles the symlink case that pre-fetch detection can't catch.

### Story 2 (Tabs) → Story 5 (File Watching)

`watchPath()` is called after tab hydration, `unwatchPath()` on close — lifecycle is correctly tied to tab existence.

### Story 7 (File Watch) → Story 2 (Tab Refresh)

`refreshWatchedFile()` correctly captures scroll snapshot before re-fetch and restores it after. The `captureScrollSnapshot()` / `restoreScrollSnapshot()` pair uses percentage-based scroll position (ratio), which handles the "document length changed" case in TC-7.2c.

### Session Persistence → Tab Restore

`restoreTabsFromSession()` reads `bootstrap.session.openTabs` (snapshot at boot), handles errors per-tab, deduplicates by canonical path, and syncs if needed. The `needsSync = true` path correctly handles cases where stale tabs were pruned.

### Epic 1 State Extensions

`SessionStateSchema` adds `defaultOpenMode`, `openTabs`, `activeTab` with Zod `.default()` values — existing session files without these fields will parse correctly. Forward-compatible.

---

## Test Quality

### Strengths

- **Render tests use real JSDOM**: `file.render.test.ts` parses rendered HTML into a live document and queries the DOM. This is significantly more robust than string matching and correctly catches AC-2.4b column alignment via `getAttribute('style')`.
- **WS tests export timing constants**: `WATCH_DEBOUNCE_MS` and `WATCH_RENAME_SETTLE_MS` are exported and used in tests — no magic numbers, no brittleness from hardcoded waits.
- **Atomic save test**: The `Non-TC: Atomic save re-establishes the watcher` test correctly uses fake timers to verify the rename → settle → re-watch → debounce → notify sequence.
- **Image edge cases tested**: Single-quoted src, whitespace around `=`, query strings in image paths — all explicitly tested.
- **Session integration tests use real temp files**: `session-epic2.test.ts` writes and reads from a real temp directory, verifying persistence through full app restart.

### Weaknesses

- Loading indicator in-flight transition not tested (m7)
- Client-side deleted file retry interval not tested (m8)
- The `content-area.test.ts` re-render on unrelated state changes not tested — this means the performance bug (m2) could regress without detection

---

## Implementation Notes of Merit

Several implementation choices improve on the spec:

1. **`execFile` over `exec` for external opening**: Spec showed `exec(`open ${JSON.stringify(filePath)}`)` — implementation uses `execFile('open', [filePath])` which is safer (no shell interpolation).

2. **`WsClient.on()` returns an unsubscribe function**: The design showed a simple `on(type, handler)` — implementation returns `() => void` for cleanup, consistent with the rest of the codebase.

3. **`shouldReconnect` flag on `WsClient`**: Prevents reconnect loops when `disconnect()` is called explicitly.

4. **`stripQueryAndHash()` in render service**: Handles image paths like `./diagram.png?v=1#section` gracefully. The spec didn't mention this edge case; the implementation handles it proactively with a dedicated test.

5. **`captureScrollSnapshot()` uses scroll ratio**: For auto-reload (TC-7.2c), uses `scrollTop / scrollableHeight` (percentage) rather than absolute pixel offset, handling variable document heights correctly.
