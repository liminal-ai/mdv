# Epic 1 — Epic-Level Verification Review

**Reviewer:** Claude Sonnet 4.6 (Sonnet reviewer agent)
**Date:** 2026-03-19
**Scope:** Full implementation review against Epic 1 spec, all three tech design documents, and every source + test file under `app/src/` and `app/tests/`.

---

## Executive Summary

The implementation is **substantially complete**. All 43 ACs have corresponding tests, all 11 API endpoints are implemented, and the server-side architecture is faithful to the tech design. Most TC coverage is real and behaviorally meaningful.

**Three issues require resolution before this epic can be considered done.** One is a literal spec contract violation (wrong error code), one is a missing error format contract enforcement, and one is a spec-stated UX requirement (visible error on startup failure) that is silently swallowed in code. Everything else is minor or a noted acceptable divergence.

---

## 1. AC-by-AC Verification

### AC-1: App Launch and Initial State

| TC | Status | Evidence |
|----|--------|---------|
| TC-1.1a First launch, no session | ✓ | `session.test.ts:78` — calls GET /api/session with empty temp dir, verifies default session + 4 themes returned |
| TC-1.1b Server binds to localhost only | ✓ | `session.test.ts:99` — verifies `listen({ host: '127.0.0.1' })` called |
| TC-1.1c Port conflict fallback | ✓ | `session.test.ts:114` — mocked EADDRINUSE, verifies retry on port 0 |
| TC-1.2a Session with workspaces and root | ✓ | `session.test.ts:132` — writes session file, reloads, verifies workspaces and root |
| TC-1.2b Workspaces, no root | ✓ | `session.test.ts:162` — `lastRoot: null` case |
| TC-1.2c Corrupted session resets | ✓ | `session.test.ts:184` — corrupted JSON → default session, file rewritten |
| TC-1.2d Theme restored, no flash | ✓ | `session.test.ts:200` (server returns correct theme); `app.test.ts:123` (integration: `data-theme` set on `documentElement`); HTML blocking script reads localStorage |
| TC-1.3a Empty state content | ✓ | `content-area.test.ts:13` — app name, disabled Open File, enabled Open Folder, Recent files section |
| TC-1.3b No recent files on first launch | ✓ | `content-area.test.ts:38` — "No recent files" text |
| TC-1.3c Recent files with history | ✓ (deferred to M1) | Spec notes this is testable only after Epic 2 ships file opening |
| TC-1.4a Empty tab strip | ✓ | `app.test.ts:111` — "No documents open" in rendered body |

### AC-2: Menu Bar

| TC | Status | Evidence |
|----|--------|---------|
| TC-2.1a File menu contents | ✓ | `menu-bar.test.ts:28` |
| TC-2.1b Export menu disabled | ✓ | `menu-bar.test.ts:39` |
| TC-2.1c View menu contents | ✓ | `menu-bar.test.ts:49` |
| TC-2.1d Menu closes on outside click | ✓ | `menu-bar.test.ts:59` |
| TC-2.1e Only one menu open | ✓ | `menu-bar.test.ts:68` |
| TC-2.2a Icons have tooltips | ✓ | `menu-bar.test.ts:78` — title attributes verified |
| TC-2.2b Open Folder icon triggers browse | ✓ | `menu-bar.test.ts:90` |
| TC-2.2c Open File icon is disabled | ✓ | `menu-bar.test.ts:98` |
| TC-2.3a Cmd+O NOT registered | ✓ | `keyboard.test.ts:19` — negative test: checks no `{key:'o', meta:true, shift:false}` shortcut registered |
| TC-2.3b Shortcut works from any focus | ✓ | `keyboard.test.ts:35` — dispatches from focused input, verifies action fires |
| TC-2.4a Dropdown keyboard nav | ✓ | `menu-bar.test.ts:115` — ArrowDown opens first item, Enter activates, Escape closes |
| TC-2.4b File tree keyboard nav | ✓ | `file-tree.test.ts:207` — ArrowDown focuses first row, Enter dispatches action |
| TC-2.4c Context menu keyboard nav | ✓ | `context-menu.test.ts:171` — ArrowDown/Up cycle items |
| TC-2.5a Toggle sidebar closed | ✓ | `menu-bar.test.ts:138` |
| TC-2.5b Toggle sidebar open | ✓ | `menu-bar.test.ts:147` |

### AC-3: Sidebar — Workspaces Section

| TC | Status | Evidence |
|----|--------|---------|
| TC-3.1a Collapse section | ✓ | `workspaces.test.ts:44` — section-content hidden, triangle CSS class updated |
| TC-3.1b Expand section | ✓ | `workspaces.test.ts:57` |
| TC-3.1c Collapse persists across sessions | ✓ | `session.test.ts:479` — PUT then reload, verifies `workspacesCollapsed: true` |
| TC-3.2a Label shows directory name | ✓ | `workspaces.test.ts:69` |
| TC-3.2b Full path tooltip | ✓ | `workspaces.test.ts:75` — `title` attribute checked |
| TC-3.2c Long path truncation | ⚠️ VACUOUS | `workspaces.test.ts:82` — only checks class name exists, not truncation (see MINOR-2) |
| TC-3.3a Switch root via workspace click | ✓ | `session.test.ts:220` (server); `workspaces.test.ts` (client fires onSwitchRoot) |
| TC-3.3b Active workspace highlighted | ✓ | `workspaces.test.ts:98` — `workspace-entry--active` class present |
| TC-3.3c Switch to deleted path shows error | ✓ | `session.test.ts:239` (404 response); `error-notification.test.ts:39` (UI shows error) |
| TC-3.4a Remove workspace | ✓ | `session.test.ts:261`; `workspaces.test.ts:108` |
| TC-3.4b x button visible on hover | ⚠️ VACUOUS | `workspaces.test.ts:117` — only checks class name (see MINOR-3) |
| TC-3.4c Remove active workspace, root unchanged | ✓ | `session.test.ts:291` |

### AC-4: Sidebar — Root Line

| TC | Status | Evidence |
|----|--------|---------|
| TC-4.1a Path shown truncated with tooltip | ✓ | `root-line.test.ts:36` — shows `~/code/project-atlas`, tooltip is full path |
| TC-4.1b No root selected | ✓ | `root-line.test.ts:45` — "No folder selected" placeholder (spec says "No root selected or similar" — acceptable) |
| TC-4.2a Select folder | ✓ | `root-line.test.ts:54`; `browse.test.ts:6` |
| TC-4.2b Cancel picker | ✓ | `browse.test.ts:20` |
| TC-4.2c Browse always visible | ✓ | `root-line.test.ts:62` |
| TC-4.3a Pin new workspace | ✓ | `root-line.test.ts:71`; `session.test.ts:318` |
| TC-4.3b Pin when already saved | ✓ | `session.test.ts:344` — no-op verified |
| TC-4.4a Copy root path | ✓ | `root-line.test.ts:79`; `clipboard.test.ts:21` |
| TC-4.5a Refresh after external changes | ✓ | `root-line.test.ts:87`; `app.test.ts:184` |
| TC-4.5b Refresh preserves expand state | ✓ | `root-line.test.ts:95` — `expandedDirsByRoot` unchanged after refresh click |
| TC-4.6a Hover reveals pin/copy/refresh | ⚠️ VACUOUS | `root-line.test.ts:104` — only checks class names (see MINOR-4) |
| TC-4.6b Browse always visible | ✓ | `root-line.test.ts:114` |

### AC-5: File Tree

| TC | Status | Evidence |
|----|--------|---------|
| TC-5.1a Markdown-only files shown | ✓ | `tree.test.ts:33` — real files created, .sh/.png not returned |
| TC-5.1b Empty directory hidden | ✓ | `tree.test.ts:50` |
| TC-5.1c Nested dir with markdown shown | ✓ | `tree.test.ts:62` |
| TC-5.1d Mixed directory shows only .md | ✓ | `tree.test.ts:76` |
| TC-5.1e Case-insensitive extension matching | ✓ | `tree.test.ts:95` — NOTES.MD, changelog.Markdown, readme.md all returned |
| TC-5.1f Hidden files excluded | ✓ | `tree.test.ts:110` |
| TC-5.1g MDX excluded | ✓ | `tree.test.ts:122` |
| TC-5.1h Symlink path uses symlink path, not resolved | ✓ | `tree.test.ts:134` — verifies `linkNode.path` inside root, doesn't contain 'outside' |
| TC-5.2a Expand directory on click | ✓ | `file-tree.test.ts:38` |
| TC-5.2b Collapse directory on click | ✓ | `file-tree.test.ts:48` |
| TC-5.2c Expand state preserved within session | ✓ | `file-tree.test.ts:63` — expandedDirsByRoot keyed by root, switching roots preserves each root's state |
| TC-5.3a Expand All | ✓ | `file-tree.test.ts:94` |
| TC-5.3b Expand All reaches leaf dirs | ✓ | `file-tree.test.ts:105` |
| TC-5.3c Collapse All | ✓ | `file-tree.test.ts:142` |
| TC-5.3d Expand All on 200-dir tree | ✓ | `file-tree.test.ts:153` — < 500ms |
| TC-5.4a Sort: dirs first, alpha case-insensitive | ✓ | `tree.test.ts:156` — verifies exact order `['api', 'Docs', 'changelog.md', 'README.md']` |
| TC-5.5a mdCount badge | ✓ | `tree.test.ts:171`; `file-tree.test.ts:165` |
| TC-5.6a Tree scrolls independently | ⚠️ VACUOUS | `file-tree.test.ts:177` — test sets `overflow-y: auto` itself in HTML and then asserts it (see MINOR-5) |
| TC-5.7a Expand state resets on restart | ✓ | `file-tree.test.ts:195` — fresh `expandedDirsByRoot: {}` means all collapsed |

### AC-6: Context Menus

| TC | Status | Evidence |
|----|--------|---------|
| TC-6.1a File context menu shows Copy Path | ✓ | `context-menu.test.ts:75` — exactly 1 item |
| TC-6.1b Copy Path copies full path | ✓ | `context-menu.test.ts:87` — onCopyPath called with correct path |
| TC-6.2a Directory shows 3 items | ✓ | `context-menu.test.ts:97` — Copy Path, Make Root, Save as Workspace |
| TC-6.2b Make Root changes root | ✓ | `context-menu.test.ts:111` |
| TC-6.2c Save as Workspace | ✓ | `context-menu.test.ts:122` |
| TC-6.3a Close on action | ✓ | `context-menu.test.ts:133` |
| TC-6.3b Close on outside click | ✓ | `context-menu.test.ts:146` |
| TC-6.3c Close on Escape | ✓ | `context-menu.test.ts:159` |

### AC-7: Theme System

| TC | Status | Evidence |
|----|--------|---------|
| TC-7.1a Four themes listed | ✓ | `menu-bar.test.ts:156` |
| TC-7.1b Current theme has checkmark | ✓ | `menu-bar.test.ts:173` — active theme shows "✓", others don't |
| TC-7.2a Theme applies to all chrome | ✓ | `menu-bar.test.ts:185`; `app.test.ts:123` — `document.documentElement.dataset.theme` set |
| TC-7.2b No flash of default theme | ✓ | HTML blocking script + localStorage; `app.test.ts:123` verifies correct theme on load |
| TC-7.3a Theme persists | ✓ | `session.test.ts:389` — PUT theme, close app, reload, verify theme in session |
| TC-7.4a Adding theme requires no code change | ✓ | `menu-bar.test.ts:213` — injects 5th theme into availableThemes, verifies menu shows 5 buttons |

### AC-8: Session Persistence

| TC | Status | Evidence |
|----|--------|---------|
| TC-8.1a Workspaces in insertion order | ✓ | `session.test.ts:409` — adds A, B, C in sequence, reloads, verifies order |
| TC-8.2a Root restored | ✓ | `session.test.ts:436` |
| TC-8.2b Deleted root healed on load | ✓ | `session.test.ts:458` — `lastRoot: null` after reload, file rewritten |
| TC-8.3a Recent files restored | ✓ | `session.test.ts:499` |
| TC-8.3b Stale recent file removed | ✓ | `session.test.ts:521`; `session.service.test.ts:31` |
| TC-8.4a Theme persistence | ✓ | Covered by TC-7.3a |
| TC-8.5a Sidebar persistence | ✓ | Covered by TC-3.1c |

### AC-9: Folder Selection

| TC | Status | Evidence |
|----|--------|---------|
| TC-9.1a Sidebar browse icon | ✓ | `root-line.test.ts:54` |
| TC-9.1b File menu Open Folder | ✓ | `menu-bar.test.ts:106` |
| TC-9.1c Empty state Open Folder button | ✓ | `content-area.test.ts:26` |
| TC-9.1d Keyboard shortcut | ✓ | `keyboard.test.ts:52` — Cmd+Shift+O fires registered action |
| TC-9.2a 500-file directory < 2s | ✓ | `tree.test.ts:188` — 50 dirs × 10 files = 500 files, HTTP round-trip < 2000ms |
| TC-9.2b 2000-file directory no freeze | ⚠️ WEAK | `tree.service.test.ts:61` — 200 dirs × 10 files, < 10000ms. **Bound is 5× the NFR target.** (see MAJOR-3) |

### AC-10: Error Handling

| TC | Status | Evidence |
|----|--------|---------|
| TC-10.1a Permission denied on root | ✓ | `tree.test.ts:213` — `chmod 000`, verifies 403 with PERMISSION_DENIED; `error-notification.test.ts:12`; `app.test.ts:203` |
| TC-10.2a Root disappears mid-session | ✓ | `tree.test.ts:232` (server returns 404); `app.test.ts:217` (integration: error shown, tree cleared) |
| TC-10.3a Symlink loop | ✓ | `tree.test.ts:247` — creates loop (root → loopDir → symlink back to root), verifies 200 and tree renders |
| TC-10.3b Special files | ✓ | `tree.test.ts:263` — broken symlink creates ENOENT on stat(), skipped, readme.md still returned |

---

## 2. API Endpoint Verification

All 11 endpoints are implemented. The table below maps each against the epic's data contracts:

| Method | Path | Epic Success Response | Implementation | Status |
|--------|------|-----------------------|---------------|--------|
| GET | /api/session | `SessionState` ¹ | `AppBootstrapResponse` | ⚠️ Intentional upgrade |
| PUT | /api/session/root | `SessionState` | `SessionState` | ✓ |
| POST | /api/session/workspaces | `SessionState` | `SessionState` | ✓ |
| DELETE | /api/session/workspaces | `SessionState` | `SessionState` | ✓ |
| PUT | /api/session/theme | `SessionState` | `SessionState` | ✓ |
| PUT | /api/session/sidebar | `SessionState` | `SessionState` | ✓ |
| POST | /api/session/recent-files | `SessionState` | `SessionState` | ✓ |
| DELETE | /api/session/recent-files | `SessionState` | `SessionState` | ✓ |
| GET | /api/tree | `FileTreeResponse` | `FileTreeResponse` | ✓ |
| POST | /api/browse | `{ path } \| null` | `{ path } \| null` | ✓ |
| POST | /api/clipboard | `{ ok: true }` | `{ ok: true }` | ✓ |

¹ The epic's own API surface table lists `SessionState` for `GET /api/session`. The tech design intentionally upgraded this to `AppBootstrapResponse` (session + availableThemes). The implementation follows the tech design. The epic's table is the stale reference. The implementation is correct.

### Error code coverage

| Spec code | Implementation | Status |
|-----------|---------------|--------|
| INVALID_PATH | `INVALID_PATH` in ErrorCode enum — but NOT used for path validation in tree route | ⚠️ See CRITICAL-1 |
| PERMISSION_DENIED | `PERMISSION_DENIED` | ✓ |
| PATH_NOT_FOUND | `PATH_NOT_FOUND` | ✓ |
| SCAN_ERROR | `SCAN_ERROR` | ✓ |

Extra codes added by implementation (not in spec): `INVALID_ROOT`, `INVALID_THEME`. These are additive extensions; `INVALID_THEME` is well-motivated. `INVALID_ROOT` replaces `INVALID_PATH` for tree route path validation (CRITICAL-1).

---

## 3. Critical Issues

### CRITICAL-1: Error Code `INVALID_ROOT` Violates Spec Contract

**Location:** `app/src/server/routes/tree.ts:29`

The epic's error contract table specifies `INVALID_PATH` as the 400 error code for non-absolute paths. The implementation uses `INVALID_ROOT`:

```typescript
// tree.ts:29
return reply.code(400).send(toApiError(ErrorCode.INVALID_ROOT, 'Root path must be absolute.'));
```

The `ErrorCode` object in `errors.ts` contains both `INVALID_PATH` and `INVALID_ROOT`. The tree route picks `INVALID_ROOT` rather than the spec-mandated `INVALID_PATH`. The test at `tree.test.ts:298` asserts `INVALID_ROOT`, so the test passes — but it's testing the wrong value against a different spec.

**Why it matters:** Any client code (current or future) that maps error codes to localized messages or UI states against the spec's `INVALID_PATH` will silently miss this error. The tech design also documents `INVALID_PATH` as the expected code.

**Fix:** In `tree.ts:29`, replace `ErrorCode.INVALID_ROOT` with `ErrorCode.INVALID_PATH`. Update the test assertion and remove `INVALID_ROOT` from the enum (or retain it only if it's used elsewhere).

---

### CRITICAL-2: `PUT /api/session/root` Validation Error Returns Wrong Format

**Location:** `app/src/server/routes/session.ts:42-82`

When a non-absolute path is sent to `PUT /api/session/root`, Fastify's Zod validator intercepts it before the handler runs and returns a 400 in Fastify's own validation error format — NOT the `{ error: { code, message } }` format that the epic data contracts specify.

**Evidence:**
- The `PUT /api/session/root` response schema declares `403` and `404` but NOT `400`:
  ```typescript
  response: {
    200: SessionStateSchema,
    403: ErrorResponseSchema,
    404: ErrorResponseSchema,
    // 400 is absent
  }
  ```
- The test at `session.test.ts:573` only asserts `expect(response.statusCode).toBe(400)` — no body format check.

**What the client receives for a bad path:** Fastify's default schema validation error (something like `{ error: 'Bad Request', message: 'body/root Invalid' }` or similar), not `{ error: { code: 'INVALID_PATH', message: '...' } }`.

**Why it matters:** Client error handling in `api.ts` reads `errorPayload?.error?.code` to populate `ApiError.code`. The Fastify default format does not have `.error.code`. The `ApiError` will be constructed with code `'UNKNOWN_ERROR'`, which is wrong.

**Fix:** Add an explicit validation error handler for the session root route (or use a Fastify `setErrorHandler` that normalizes validation errors), OR switch to manual validation in the handler (like the tree route does) and add `400: ErrorResponseSchema` to the declared schema.

---

### CRITICAL-3: Bootstrap Tree Load Errors Are Silently Swallowed (AC-10.1 Partial Failure)

**Location:** `app/src/client/app.ts:304-313`

On app startup, if the persisted root's tree scan fails with PERMISSION_DENIED, the error is caught and discarded:

```typescript
if (bootstrap.session.lastRoot) {
  setTreeLoading(true);
  try {
    const treeResponse = await api.getTree(bootstrap.session.lastRoot);
    applyTree(treeResponse.tree);
  } catch {
    setTreeLoading(false);
    // Silently fail — root may no longer exist; user can refresh or browse
  }
}
```

**AC-10.1 requires:** "Permission denied on root folder produces visible error."

The session healer clears `lastRoot` when it's ENOENT (file not found), so TC-8.2b is handled before this code runs. But EACCES (permission denied) survives healing — the root remains in the session and this catch block silently swallows the error. The user sees "No markdown files found" with no explanation.

**The same error IS shown when triggered by the user's refresh action** (`refreshTree()` in app.ts correctly calls `setError(error)`). The bug is specific to the bootstrap path.

**Evidence:** `app.test.ts:203` tests `TC-10.1a` via the refresh path, not bootstrap. The bootstrap path has no test that verifies the error notification appears.

**Fix:** Call `setError(error)` in the catch block of the bootstrap tree load. The "Silently fail" comment was reasonable for ENOENT (already healed), but is wrong for EACCES.

---

## 4. Major Issues

### MAJOR-1: `router.ts` Absent — Architectural Deviation from Tech Design

The tech design specifies `client/router.ts` ("Maps state changes to DOM updates; observes state changes, calls component renders"). This module does not exist in `app/src/client/`.

Each component instead subscribes directly to the store via `store.subscribe(render)`. This is simpler and functionally equivalent — it's arguably a better design. The deviation is benign in isolation but creates confusion when the tech design is used as a blueprint for Epic 2 contributions: developers will look for `router.ts` and find nothing.

**Recommendation:** Either add a note to the tech design that `router.ts` was eliminated in favor of direct component subscriptions, or create a thin `router.ts` that simply re-exports or documents the pattern.

---

### MAJOR-2: Permission-Denied Subdirectory Test Is a Non-Test

**Location:** `app/tests/server/services/tree.service.test.ts:44-59`

The test labeled "Permission denied on subdirectory skips it" creates an accessible directory with files and verifies the scan completes successfully. The comment in the test acknowledges it does not actually test permission denial:

> "testing permission denial would require chmod which may not be reliable in all CI environments"

This is the ONLY test covering the service's subdirectory error-swallowing behavior (the `catch { return [] }` in `scanDir`). The tree route test at `tree.test.ts:213` DOES test root-level permission denial with a real `chmod 000`. The same approach could work for subdirectories.

**Impact:** If the `scanDir` error swallowing logic were removed, the app would crash on any directory with restricted permissions. There is no test to catch this regression.

**Recommendation:** Replace the placeholder with a real `chmod 000` test on a subdirectory, matching the approach used for root permission denial in `tree.test.ts:213`.

---

### MAJOR-3: TC-9.2b Performance Bound Is 5× Looser Than the NFR

**Location:** `app/tests/server/services/tree.service.test.ts:80-83`

```typescript
expect(elapsed).toBeLessThan(10000); // 10 seconds
```

The NFR specifies 2 seconds for 500 files. TC-9.2b is for 2000 files (which the spec notes may take longer, but "without freezing the UI"). The tree.test.ts HTTP-level test (TC-9.2a) correctly enforces < 2000ms for 500 files.

The service-level test for 2000 files allows 10 seconds — 5× what a reasonable regression threshold should be. On any modern dev machine this completes in ~200ms, so the 10-second bound would only catch catastrophic regressions, not gradual performance degradation.

**Recommendation:** Tighten the bound to 5000ms (still generous vs the observed ~200ms, but catches real regressions rather than only catastrophic failures).

---

## 5. Minor Issues

### MINOR-1: `GET /api/session` Response Type in Epic API Table Is Stale

**Location:** Epic.md API surface table (last section)

The table says: `GET /api/session → SessionState`. The tech design (correctly) and implementation return `AppBootstrapResponse`. The epic's table was not updated when the tech design resolved this. The implementation is correct; the epic table should be updated for traceability.

### MINOR-2: TC-3.2c Long Path Truncation Test Is Vacuous

**Location:** `app/tests/client/components/workspaces.test.ts:82-96`

```typescript
expect(document.querySelector('.workspace-entry__label')?.className).toContain('workspace-entry__label');
```

This asserts the element has its expected class name — it will always pass. Ellipsis truncation is CSS behavior (`text-overflow: ellipsis; overflow: hidden`) that JSDOM does not compute. The test provides no behavioral coverage of AC-3.2c.

**Recommendation:** Either remove the test and document this as CSS-only behavior, or add a CSS comment in `sidebar.css` noting that this is covered by visual regression rather than unit tests.

### MINOR-3: TC-3.4b x Button Visibility Test Is Vacuous

Same pattern as MINOR-2: the test checks the class name exists, not that the button is hidden by default. CSS handles this with `opacity: 0` on default and `opacity: 1` on `.workspace-entry:hover .workspace-entry__remove`. JSDOM doesn't compute hover states.

### MINOR-4: TC-4.6a Hover Reveal Test Is Vacuous

Same pattern as MINOR-2 and MINOR-3: `root-line.test.ts:104` only checks class name presence for pin/copy/refresh buttons.

### MINOR-5: TC-5.6a File Tree Scrolling Test Is Vacuous

**Location:** `app/tests/client/components/file-tree.test.ts:177-193`

The test sets `overflow-y: auto` on the container element *in the test HTML* and then asserts that style is present. The component's JS does not set this style — it's purely a CSS concern. The test validates a style attribute that the test itself put there, not anything the component does.

### MINOR-6: Tree Route Uses `z.string()` Instead of `AbsolutePathSchema` for Querystring

**Location:** `app/src/server/routes/tree.ts:13`

```typescript
querystring: z.object({ root: z.string() }),
```

The tech design says to use `AbsolutePathSchema` (`z.string().refine(p => p.startsWith('/'), ...)`). The route uses `z.string()` and performs manual validation in the handler. Functionally equivalent, but it duplicates the absolute-path constraint logic and bypasses the shared schema. Minor maintainability concern.

### MINOR-7: Duplicate Escape Key Handling

**Location:** `app/src/client/app.ts:294-300` and `app/src/client/components/menu-bar.ts:125-128, 164-168`

The global `KeyboardManager` registers an Escape handler that clears `activeMenuId`. The menu-bar component's keydown listener also handles Escape to close menus. Both run without stopPropagation, so pressing Escape fires both handlers. The result is idempotent (closing already-closed menus), but the global handler calls `preventDefault()` on all Escape events once the keyboard manager is attached — including in contexts where Escape might have a native browser function.

Additionally, the global Escape handler and the context menu's Escape handler are both on `document`. Again idempotent, but the duplication is unintentional and could cause issues if more Escape-handled components are added.

### MINOR-8: `ClientState.tree` Type Diverges from Tech Design

**Tech design UI doc** (line ~100): `tree: TreeNode[] | null` (null = not loaded)

**Implementation:** `tree: TreeNode[]` initialized as `[]` (empty array used for both "not loaded" and "loaded but empty").

The `treeLoading` flag compensates — `file-tree.ts:191` shows "Loading…" when `treeLoading` is true and tree is empty. Once loading completes with an empty tree, it shows "No markdown files found". This is functionally acceptable. The `null` sentinel was dropped in favor of the empty-array + loading-flag pattern.

---

## 6. Architecture Assessment

### Module Structure vs Spec

| Specified Module | Present in Code | Status |
|-----------------|-----------------|--------|
| `server/index.ts` | ✓ | Matches spec |
| `server/app.ts` | ✓ | Matches spec |
| `server/plugins/static.ts` | ✓ | Matches spec |
| `server/routes/session.ts` | ✓ | Matches spec |
| `server/routes/tree.ts` | ✓ | Matches spec |
| `server/routes/browse.ts` | ✓ | Matches spec |
| `server/routes/clipboard.ts` | ✓ | Matches spec |
| `server/services/session.service.ts` | ✓ | Matches spec |
| `server/services/tree.service.ts` | ✓ | Matches spec |
| `server/services/browse.service.ts` | ✓ | Matches spec |
| `server/services/theme-registry.ts` | ✓ | Matches spec |
| `server/schemas/index.ts` | ✓ | Matches spec |
| `shared/types.ts` | ✓ | Matches spec |
| `client/app.ts` | ✓ | Matches spec |
| `client/api.ts` | ✓ | Matches spec |
| `client/state.ts` | ✓ | Matches spec |
| `client/router.ts` | ✗ ABSENT | See MAJOR-1 |
| `client/components/menu-bar.ts` | ✓ | Matches spec |
| `client/components/sidebar.ts` | ✓ | Matches spec |
| `client/components/workspaces.ts` | ✓ | Matches spec |
| `client/components/root-line.ts` | ✓ | Matches spec |
| `client/components/file-tree.ts` | ✓ | Matches spec |
| `client/components/tab-strip.ts` | ✓ | Matches spec |
| `client/components/content-area.ts` | ✓ | Matches spec |
| `client/components/context-menu.ts` | ✓ | Matches spec |
| `client/components/error-notification.ts` | ✓ | Matches spec |
| `client/utils/keyboard.ts` | ✓ | Matches spec |
| `client/utils/clipboard.ts` | ✓ | Matches spec |
| `client/utils/dom.ts` | ✓ | Matches spec |
| `server/utils/errors.ts` | ✓ (bonus) | Not specified but correct addition |

### Key Design Properties Verified

- **Atomic session writes:** `session.service.ts:200-208` — writes to `.tmp` file, renames atomically. ✓
- **Session cache:** `cache` field prevents repeated disk reads. ✓
- **Root healing:** ENOENT clears `lastRoot` and rewrites session. ✓ EACCES also clears (treats as effectively inaccessible). ✓
- **Symlink loop detection:** `visited` Set tracks real paths via `realpath()`. ✓
- **Theme flash prevention:** HTML blocking `<script>` reads `localStorage` before CSS loads. ✓
- **Optimistic theme application:** `applyTheme()` called before `api.setTheme()` completes. Rolled back on error. ✓ (`app.ts:144-151`)
- **Zod not bundled to client:** `shared/types.ts` uses `export type` only. ✓
- **Dependency injection for tests:** `buildApp()` accepts `sessionDir`, `sessionService`, `browseService`. ✓

---

## 7. Test Quality Assessment

### Strengths

1. **Server tests use real filesystem.** Session and tree tests create temp directories, write real files, and verify actual filesystem behavior. This catches real bugs that mocked filesystem tests would miss.

2. **Session persistence tests are end-to-end.** Tests create an app, mutate state via HTTP, close the app, recreate it, and verify persistence. This is the gold standard for persistence testing.

3. **Tree filter tests are thorough.** All 8 sub-cases of TC-5.1 have dedicated tests with real files. The extension matching, symlink handling, and hidden file exclusion are all tested at the HTTP level.

4. **TC labels on test names.** Nearly every TC has a corresponding `it('TC-X.Xa: ...')`. This makes verification tracing straightforward.

5. **Negative tests for error conditions.** `chmod 000` for permission denial, broken symlinks for special file handling — real error injection rather than mocked errors.

6. **Integration tests in `app.test.ts`.** Module-level mocking of `api.ts` produces meaningful integration coverage of the full client bootstrap flow.

### Weaknesses

1. **Three CSS-dependent tests pass vacuously.** TC-5.6a, TC-3.2c, and TC-4.6a test CSS behavior (scrolling, text truncation, hover visibility) using JSDOM, which doesn't compute layout or hover states. All three tests pass by checking class name presence, not actual behavior.

2. **Permission-denied subdirectory test is a placeholder.** `tree.service.test.ts:44` explicitly acknowledges it doesn't test what the test name says it tests.

3. **TC-9.2b performance bound is too loose.** The 10-second bound for 2000-file scan could mask significant regressions.

4. **TC-3.3c integration not tested end-to-end.** The test in `error-notification.test.ts:39` directly injects the error into the store. There is no test that simulates clicking a workspace entry pointing to a deleted path and verifying the full flow (click → API call → 404 response → error notification). The server-side test (`session.test.ts:239`) verifies the 404 is returned, but there's no integration test connecting workspace click to error display.

---

## 8. Summary of Findings by Severity

| ID | Severity | Issue | Fix Required |
|----|----------|-------|:------------:|
| C-1 | **Critical** | `INVALID_ROOT` code in tree route, spec says `INVALID_PATH` | Yes |
| C-2 | **Critical** | `PUT /api/session/root` body validation error returns wrong format (no `{ error: { code } }`) | Yes |
| C-3 | **Critical** | Bootstrap tree load errors silently swallowed — AC-10.1 not satisfied on startup path | Yes |
| M-1 | **Major** | `router.ts` absent from codebase — tech design deviation | Document or create stub |
| M-2 | **Major** | Subdirectory permission-denied test is a non-test | Replace with real chmod test |
| M-3 | **Major** | TC-9.2b allows 10s, NFR target is 2s — regression tolerance too wide | Tighten bound |
| m-1 | Minor | `GET /api/session` epic table lists `SessionState`, implementation returns `AppBootstrapResponse` | Update epic table |
| m-2 | Minor | TC-3.2c vacuous test (CSS text truncation not testable in JSDOM) | Document or remove |
| m-3 | Minor | TC-3.4b vacuous test (hover visibility CSS not testable in JSDOM) | Document or remove |
| m-4 | Minor | TC-4.6a vacuous test (hover visibility CSS not testable in JSDOM) | Document or remove |
| m-5 | Minor | TC-5.6a vacuous test (overflow-y set by test, not component) | Document or remove |
| m-6 | Minor | Tree route uses `z.string()` instead of `AbsolutePathSchema` for querystring | Low priority |
| m-7 | Minor | Duplicate Escape key handling (global manager + menu-bar + context menu) | Low priority |
| m-8 | Minor | `ClientState.tree` type is `[]` not `null` when not loaded (tech design says `null`) | Low priority |
| m-9 | Minor | TC-3.3c end-to-end flow not tested (workspace click → 404 → error notification) | Consider adding |

---

## 9. Verdict

**Critical issues must be resolved before sign-off.** C-1 (wrong error code) is a contract violation. C-2 (wrong error format) is a contract violation with silent API breakage. C-3 (silent bootstrap error) is a user-visible spec failure on a real production path (permission-denied root at startup).

**Major issues should be resolved in this sprint.** M-2 (placeholder test for a real safety behavior) and M-3 (too-loose performance bound) undermine test coverage quality. M-1 (missing router.ts) should at minimum be documented.

**Minor issues can be addressed opportunistically** — most are documentation or style concerns with no functional impact.

The implementation is otherwise well-constructed: the architecture is clean, the session persistence is correctly atomic, the tree scanning handles all specified edge cases, and the test suite is substantially real (real filesystem, real HTTP, real DOM events). With the three critical issues fixed, this epic is ready for close.
