# Epic 2 Code Review: Document Viewing and Multi-Tab Reading

**Reviewer:** Claude Opus 4.6
**Date:** 2026-03-20
**Scope:** Full epic-level review of all spec artifacts, source code, CSS, and tests

---

## Executive Summary

Epic 2 is a well-executed implementation that delivers markdown rendering, multi-tab document management, file watching, content toolbar, and link navigation. All 307 tests pass (including Epic 1 tests). The architecture aligns closely with the tech design, and spec deviations (server-side rendering, tab persistence, WebSocket transport) are properly documented and correctly implemented. Security posture is strong for a local-only tool. A small number of issues were identified, none critical.

**Verdict:** Ship-ready with minor issues noted below.

---

## Critical Issues

None found.

---

## Major Issues

### M1. `WARN_FILE_SIZE` constant defined but never used — 1-5MB confirmation UX missing

**Location:** `app/src/server/services/file.service.ts:11`

The tech design (Q8) specifies three tiers: <1MB (no warning), 1-5MB (warning with confirmation), >5MB (hard cap). The `WARN_FILE_SIZE = 1 * 1024 * 1024` constant is defined in `file.service.ts` but never referenced. The server returns the `size` field in `FileReadResponse`, but neither the server nor the client implements the confirmation dialog for 1-5MB files. Files in the 1-5MB range are silently loaded without warning.

**Impact:** Users could accidentally load large files (e.g., a 4MB markdown dump) without the designed guard. This is the only AC-adjacent gap — it maps to Q8 in the tech design, though no specific AC/TC covers the confirmation flow (only the hard cap at 5MB has tests).

**Recommendation:** Either implement the confirmation UX or remove the unused constant and update the tech design to note this was deferred. Since no AC explicitly requires the confirmation dialog, deferral is reasonable.

### M2. `exec()` used for file picker vs. `execFile()` for open-external — inconsistent shell injection posture

**Location:** `app/src/server/routes/file.ts:28` vs `app/src/server/routes/open-external.ts:1`

The file picker uses `exec()` (spawns a shell), while `open-external.ts` correctly uses `execFile()` (no shell). The file picker command is hardcoded, so this is not exploitable, but `exec()` is a weaker security primitive. The tech design specified `exec` for file picker and `open` command for external opening.

Notably, the open-external route's use of `execFile` is an *improvement* over the tech design — the test at `open-external.test.ts:116-133` ("Shell metacharacters are passed as a literal argument") explicitly validates this security property.

**Impact:** Low — the file picker command is a hardcoded osascript string with no user input interpolation. Still, using `exec` where `execFile` would suffice violates least-privilege principle.

**Recommendation:** Refactor file picker to use `execFile('osascript', ['-e', '...'])` for consistency.

---

## Minor Issues

### m1. Session route uses `INVALID_PATH` error code for mode validation

**Location:** `app/src/server/routes/session.ts:196`

When mode validation fails (e.g., sending `mode: 'edit'`), the route returns `ErrorCode.INVALID_PATH` with message "Invalid mode value". The error code is semantically wrong — it's not a path issue. The session-epic2 test validates this behavior at line 77.

**Recommendation:** Add an `INVALID_MODE` or `INVALID_VALUE` error code, or use a generic `VALIDATION_ERROR`.

### m2. `RENDER_ERROR` code referenced in tech design but missing from implementation

**Location:** `app/src/server/utils/errors.ts` (absent) vs tech design External Contracts table

The tech design specifies HTTP 500 / code `RENDER_ERROR` as a distinct error for rendering failures. The implementation catches all unhandled errors in the file route's catch-all and maps them to `READ_ERROR`. Render-specific errors cannot be distinguished from read errors by the client.

**Recommendation:** Either add `RENDER_ERROR` to the ErrorCode enum and catch rendering exceptions separately, or update the tech design to reflect the simplification. Since rendering is an in-process operation that rarely fails independently, the simplification is pragmatic.

### m3. SVG images served without Content Security Policy headers

**Location:** `app/src/server/routes/image.ts:49`

SVG files served by the image proxy can contain embedded JavaScript. While browsers don't execute scripts in `<img>` contexts (which is how the rendered markdown displays them), direct navigation to `/api/image?path=/path/to/malicious.svg` could execute embedded JS.

**Mitigation already present:** The proxy only serves files with recognized image extensions and adds `Cache-Control: private`. The local-only nature of the tool further reduces risk.

**Recommendation:** Consider adding `Content-Security-Policy: sandbox` or `Content-Disposition: inline` headers for SVG responses for defense-in-depth.

### m4. Content area deleted state creates empty article element before innerHTML is set

**Location:** `app/src/client/components/content-area.ts:142-202`

The deleted state branch (lines 142-157) creates a `.markdown-body--muted` article element without content, then the post-render block (lines 186-202) fills it with `innerHTML`. This works because `status !== 'error'` passes for `status === 'deleted'`, but the logic is fragile — if someone adds a new status value, the implicit fall-through could cause bugs. The test at `content-area.test.ts:91` does validate the full flow.

**Recommendation:** Make the HTML injection explicit in the deleted branch, or add a comment explaining the dependency on the post-render block.

### m5. Tab-strip test count is 23, not 20 as specified in test plan

**Location:** `app/tests/client/components/tab-strip.test.ts`

The test plan specifies 20 TC-mapped tests for this file. The actual file contains ~23 tests (some named with TC prefixes, some without). The additional tests cover edge cases not in the original TC mapping (e.g., spinner for loading tabs, close-right disabled state, tab count hidden when not overflowing). This is a net positive — more coverage than planned.

### m6. `file.test.ts` contains 14 tests, test plan specifies 16

**Location:** `app/tests/server/routes/file.test.ts`

The test plan maps 16 tests to this file (11 TC-mapped + 5 non-TC). The actual file has 14 tests. Two test plan entries — `TC-1.6a` (recent file tracked on open) and `TC-9.3b` (file read timeout) — are not present in this file. TC-1.6a is covered by the app-level integration test via `touchRecentFile`. TC-9.3b (configurable timeout) was not implemented — there's no read timeout mechanism in the file service.

**Recommendation:** Either add the timeout mechanism or document it as deferred. The timeout TC (9.3b) is a valid gap for network-mounted filesystems.

### m7. JSDOM navigation warning in test output

**Location:** Test console output during `link-handler.test.ts`

A JSDOM warning `"Error: Not implemented: navigation (except hash changes)"` appears during test runs. This is benign — it comes from JSDOM's lack of navigation support when `window.open` fires. The test correctly mocks `window.open`, so the test passes, but the warning pollutes output.

**Recommendation:** Suppress the JSDOM navigation error in test setup or verify it's already being silenced.

---

## AC/TC Coverage Analysis

### Coverage Status: Complete (with minor gaps noted)

| Flow | ACs | TCs in Epic | TCs Tested | Status |
|------|-----|------------|------------|--------|
| 1. Opening a Document | AC-1.1 to AC-1.7 | 17 | 17 | Complete |
| 2. Markdown Rendering | AC-2.1 to AC-2.11 | 21 | 21 | Complete |
| 3. Image Handling | AC-3.1 to AC-3.3 | 9 | 9 | Complete |
| 4. Tab Behavior | AC-4.1 to AC-4.5 | 17 | 17 | Complete |
| 5. Relative Link Navigation | AC-5.1 to AC-5.3 | 6 | 6 | Complete |
| 6. Content Toolbar | AC-6.1 to AC-6.5 | 12 | 12 | Complete |
| 7. File Watching | AC-7.1 to AC-7.4 | 8 | 8 | Complete |
| 8. File Path Display | AC-8.1 | 4 | 4 | Complete |
| 9. Error Handling | AC-9.1 to AC-9.3 | 7 | 6 | TC-9.3b missing (see m6) |
| **Total** | | **101** | **100** | **99%** |

The one missing TC (9.3b - file read timeout) is a gap in the error handling flow. All other TCs are covered by tests with correct assertions.

---

## Interface Compliance

### Schemas (tech-design-api.md vs app/src/server/schemas/index.ts)

| Schema | Design | Implementation | Status |
|--------|--------|----------------|--------|
| FileReadRequestSchema | `z.object({ path: AbsolutePathSchema })` | Matches | OK |
| FileReadResponseSchema | 8 fields including html, warnings | Matches exactly | OK |
| RenderWarningSchema | type, source, line?, message | Matches | OK |
| FilePickerResponseSchema | `{ path } | null` | Matches | OK |
| ImageRequestSchema | `{ path: AbsolutePathSchema }` | Matches | OK |
| OpenExternalRequestSchema | `{ path: AbsolutePathSchema }` | Matches | OK |
| ClientWsMessageSchema | discriminated union (watch/unwatch) | Matches | OK |
| ServerWsMessageSchema | discriminated union (file-change/error) | Matches | OK |
| SetDefaultModeRequestSchema | `{ mode: z.enum(['render']) }` | Matches | OK |
| UpdateTabsRequestSchema | `{ openTabs, activeTab }` | Matches | OK |
| SessionStateSchema extensions | defaultOpenMode, openTabs, activeTab | Matches | OK |

### API Endpoints (tech-design.md External Contracts vs routes)

| Endpoint | Design | Implementation | Status |
|----------|--------|----------------|--------|
| GET /api/file | `?path={abs_path}` → FileReadResponse | Matches | OK |
| POST /api/file/pick | — → `{ path } | null` | Matches | OK |
| GET /api/image | `?path={abs_path}` → binary | Matches | OK |
| WS /ws | Multiplexed JSON messages | Matches | OK |
| POST /api/open-external | `{ path }` → `{ ok: true }` | Matches | OK |
| PUT /api/session/default-mode | `{ mode }` → SessionState | Matches | OK |
| PUT /api/session/tabs | `{ openTabs, activeTab }` → SessionState | Matches | OK |

### Error Codes

| Status | Code | Implementation | Status |
|--------|------|----------------|--------|
| 400 | INVALID_PATH | Used for path, mode, and tab validation | OK (mode usage is m1) |
| 403 | PERMISSION_DENIED | All routes handle EACCES | OK |
| 404 | FILE_NOT_FOUND | All routes handle ENOENT | OK |
| 413 | FILE_TOO_LARGE | File route checks >5MB | OK |
| 415 | NOT_MARKDOWN | File route checks extension | OK |
| 500 | READ_ERROR | Generic catch-all in file, image, open-external | OK |
| 500 | RENDER_ERROR | Missing — caught by READ_ERROR | See m2 |
| — | UNSUPPORTED_FORMAT | Image route — added beyond design | OK (additive) |

---

## Architecture Alignment

### Server Layer

- **Render pipeline order:** markdown-it → mermaid placeholders → image post-processing → DOMPurify sanitization. Matches tech design exactly.
- **markdown-it configuration:** `html: true, linkify: true, typographer: false` — matches design.
- **Slugger reset per render:** Implemented and tested (`file.render.test.ts` "resets heading slugs between documents"). Matches design.
- **Image regex:** Enhanced beyond design — supports both single and double quotes and whitespace around `=`. This is a robustness improvement.
- **WatchService debounce/rename:** 300ms debounce, 50ms rename settle. Matches design. Properly re-establishes watchers after atomic saves.
- **Session persistence:** Atomic write (temp file + rename) via SessionService. Tab mutations batched per user action. Matches design.

### Client Layer

- **State shape:** `ClientState` interface matches tech design UI doc exactly. `TabState` has all specified fields.
- **Tab deduplication:** Uses `canonicalPath` from server response. Checked at both initial open and post-response (in case canonicalPath differs from clicked path). Matches design.
- **Display name disambiguation:** Pure function that walks path segments until unique. Matches design algorithm.
- **Scroll position:** Saved before switch, restored after switch via `requestAnimationFrame`. Auto-reload uses ratio-based scroll snapshot for proportional restoration. Exceeds design (design specified simple offset; implementation adds ratio-based restoration for content length changes).
- **WebSocket client:** Typed event map, auto-reconnect with 2s delay, `shouldReconnect` flag prevents zombie reconnects. Clean implementation.
- **Link handler:** `classifyLink` correctly classifies external, anchor, markdown, and local-file links. Path resolution handles relative paths, `..` traversal, and URI decoding. Unsupported schemes (mailto:, etc.) fall through to browser default handling.

### CSS Layer

- **Theme compatibility:** All styles use `var(--color-*)` custom properties. No hardcoded colors. Theme switching works automatically via `data-theme` attribute. Matches design.
- **Markdown body:** Proper styling for all rendered elements (headings, tables, code, blockquotes, images, task lists, mermaid placeholders, image placeholders). `max-width: 100%` on images, `display: block; overflow-x: auto` on tables. Matches design.
- **Tab strip:** Scroll container with hidden scrollbar, overflow gradients, tab count indicator. Loading spinner animation. Close button visibility via CSS (hover for inactive, always for active). All match design.

---

## Security Analysis

### Path Traversal

- **File read:** AbsolutePathSchema validates `startsWith('/')`. FileService validates `path.isAbsolute()`. No root restriction (by design — AC-1.4).
- **Image proxy:** Same AbsolutePathSchema validation. Extension check limits to known image MIME types. No arbitrary file read.
- **Open external:** AbsolutePathSchema + stat check before exec. Uses `execFile` (no shell). Tested with shell metacharacters (`open-external.test.ts:116-133`).

### XSS / Injection

- **DOMPurify sanitization:** Applied server-side after rendering. Default config strips `<script>`, `<iframe>`, `<style>`, event handlers, `javascript:` URLs. Verified by `TC-2.9b` test.
- **Image placeholder escaping:** `escapeHtml()` function in render.service.ts properly escapes `&`, `<`, `>`, `"`, `'` in image source paths before inserting into placeholder HTML. Prevents injection via crafted filenames.
- **innerHTML usage:** `content-area.ts:189` sets innerHTML from server-sanitized HTML. Safe given server-side DOMPurify.
- **Link handler:** External links open via `window.open` with `noopener`. Anchor links use `getElementById` (no injection vector). Relative paths are resolved client-side against known document path.

### Command Injection

- **File picker:** Uses `exec` with hardcoded command (no user input). Not exploitable but suboptimal (see M2).
- **Open external:** Uses `execFile` with path as array argument. Shell metacharacters in filenames are safe. Tested explicitly.

### WebSocket

- **Input validation:** Server validates all incoming messages against `ClientWsMessageSchema` (Zod discriminated union). Invalid messages return an error response.
- **Connection cleanup:** `unwatchAll` called on socket close. Debounce timers cleaned up in `destroyWatcher`. No resource leaks.

**Overall security posture:** Strong for a local-only tool. No exploitable vulnerabilities identified.

---

## Cross-Story Integration

### File Open Flow (Stories 1, 2, 3, 4, 5, 7)

Tree click → `app.ts:openFile()` → dedup check via `canonicalPath` → loading tab creation → `api.readFile()` → `GET /api/file` → `FileService.readFile()` → `RenderService.render()` → response with html/warnings → tab hydration → `mountContentArea` displays HTML → `attachLinkHandler` wires click handlers → `wsClient.send({ type: 'watch' })` → `syncTabsToSession()` → `touchRecentFile()`.

**Verified:** Each step connects correctly. Loading state, error handling, and dedup all work. Session persistence occurs at end of flow.

### Tab Close Flow (Stories 4, 7)

Close click → `app.ts:closeTab()` → save scroll → `unwatchPath()` → filter tabs → disambiguate names → activate adjacent tab → restore scroll → `syncTabsToSession()`.

**Verified:** Watcher cleanup, tab selection, session sync all connected.

### File Watch Flow (Stories 5, 7)

`fs.watch` callback → `WatchService.handleChange()` → debounce → `notifySubscribers()` → WebSocket message → `WsClient` dispatches `file-change` → `app.ts` handler → `refreshWatchedFile()` → re-fetch → update tab state → restore scroll snapshot.

For deletion: `handleRename()` → stat fails → `notifySubscribers(deleted)` → client `markTabDeleted()` → deleted UI state → `scheduleDeletedFileRetry()` → periodic re-watch attempts.

**Verified:** Full lifecycle works including delete/recreate and reconnect flows.

### Link Navigation Flow (Stories 5, 6)

Click in `.markdown-body` → `link-handler.ts:attach()` captures click → `classifyLink()` → markdown links call `openFile()` (same as tree click) → external links call `window.open` → non-markdown local files call `api.openExternal` → anchor links call `scrollIntoView`.

**Verified:** All link types handled. Error propagation via `showError` works.

---

## Resource Management

| Resource | Acquisition | Release | Verified |
|----------|-------------|---------|----------|
| fs.watch instances | `WatchService.createWatcher()` | `destroyWatcher()` on unwatch/unwatchAll/rename | Yes — tested |
| Debounce timers | `handleChange()` setTimeout | `destroyWatcher()` clears timer | Yes — tested |
| WebSocket connection | `WsClient.connect()` | `disconnect()` sets shouldReconnect=false, clears timer, closes socket | Yes |
| Reconnect timer | `socket.onclose` setTimeout | Cleared in `connect()` and `disconnect()` | Yes |
| Deleted file retry timers | `scheduleDeletedFileRetry()` setInterval | `clearDeletedFileRetry()` on close/refresh/max attempts | Yes |
| State subscriptions | `store.subscribe()` | All `mount*` functions return cleanup functions | Yes |
| Event listeners | `addEventListener` in mount functions | Removed in cleanup return functions | Yes |
| Fastify app instances in tests | `buildApp()` | `app.close()` in afterEach or try/finally | Yes — all test files |

**No resource leaks identified.**

---

## Test Quality Assessment

### Strengths

1. **Mock boundaries are correct:** Tests mock at filesystem and child_process boundaries only. The rendering pipeline (markdown-it, DOMPurify) runs for real in tests. This is the right approach — it catches real rendering bugs.

2. **Test helper quality:** `withRenderedFile()` helper in render/image tests is clean — handles setup, JSDOM parsing, and cleanup. Client `createStore()` helper provides sensible defaults.

3. **Edge case coverage beyond TCs:** Tests cover single-quoted img src attributes, whitespace around `=`, query strings in image paths, shell metacharacters, binary-like content, and JSDOM navigation warnings. These go beyond the TC requirements.

4. **Integration-level client tests:** `keyboard-epic2.test.ts` and `ws.test.ts` use full `bootstrapApp()` with mocked API — verifying end-to-end flows, not just component rendering.

5. **Security-specific tests:** `open-external.test.ts:116-133` explicitly tests that shell metacharacters are passed as literal arguments. Script tag stripping has its own dedicated test.

### Weaknesses

1. **TC-9.3b (file read timeout) not implemented or tested.** The test plan maps this to `file.test.ts` but no timeout mechanism exists.

2. **Some test names don't use TC IDs:** Several tab-strip tests use descriptive names without TC mapping (e.g., "calls close when the close control is clicked" should be "TC-4.3b"). This makes TC traceability slightly harder but doesn't affect coverage.

3. **Content area deleted state test relies on fixture having HTML content.** The `deletedTab` fixture includes `html: '<h1>README</h1>'` (inherited from `singleTab`). The test `content-area.test.ts:91` expects this HTML to appear in `.markdown-body--muted`. If someone changes the fixture, the test could silently pass with empty content.

4. **No test for the `activeTab not in openTabs` validation path in session service.** The session-epic2 test at line 139-157 covers this at the HTTP level, but the underlying `SessionService.updateTabs()` logic could be tested directly for better isolation.

---

## Summary of Findings

| Severity | Count | Key Items |
|----------|-------|-----------|
| Critical | 0 | — |
| Major | 2 | M1: 1-5MB warning UX missing; M2: exec vs execFile inconsistency |
| Minor | 7 | m1-m7: error code semantics, missing RENDER_ERROR, SVG CSP, deleted state fragility, test count discrepancies, missing TC-9.3b, JSDOM warning |

### Recommended Actions Before Ship

1. **Remove unused `WARN_FILE_SIZE` constant** and document the 1-5MB confirmation as deferred (or implement it). [M1]
2. **Refactor file picker to use `execFile`** for consistency with open-external. [M2]

### Recommended Actions Post-Ship

3. Add `RENDER_ERROR` error code or document the simplification. [m2]
4. Fix `INVALID_PATH` error code usage for mode validation. [m1]
5. Add file read timeout mechanism. [m6/TC-9.3b]
6. Consider `Content-Security-Policy: sandbox` for SVG responses. [m3]
