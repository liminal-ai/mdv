# Epic 5: Edit Mode and Document Safety — GPT-5.4 Full Epic Review

**Reviewer:** GPT-5.4 (Codex CLI)
**Session ID:** `019d1156-5ed5-7a12-9f64-1f9812457d70`
**Date:** 2026-03-21
**Test Suite:** 14/14 files, 140/140 tests passed

---

Reviewed the Epic 5 specs, implementation, and tests, and ran the targeted Epic 5 suite: `14/14` files and `140/140` tests passed. Also checked adjacent Epic-5-relevant route coverage in render.test and ws.test.

## A. AC/TC Coverage Matrix

- **Story 0**: No AC/TC rows in the story. Infrastructure is largely present: tab edit fields, save schemas, error codes, fixtures, routes, and `defaultOpenMode: "edit"` validation are implemented. The "501 stub" expectation was superseded by later story implementation.
- **Story 1**: `AC-1.1` ✅ (`TC-1.1a` ✅, `TC-1.1b` ✅, `TC-1.1c` ✅, `TC-1.1d` ✅, `TC-1.1e` ✅, `TC-1.1f` ✅). `AC-1.2` ✅ (`TC-1.2a` ✅, `TC-1.2b` ✅). `AC-7.1` ⚠️ (`TC-7.1a` ✅, `TC-7.1b` ✅, `TC-7.1c` ⚠️ implemented but only lightly tested via mocked session update, not a true restart, `TC-7.1d` ✅). `AC-7.2` ✅ (`TC-7.2a` ✅).
- **Story 2**: `AC-2.1` ⚠️ (`TC-2.1a` ⚠️ real CodeMirror integration exists but client tests mock the editor, `TC-2.1b` ⚠️ same issue, `TC-2.1c` ✅, `TC-2.1d` ✅). `AC-2.2` ⚠️ (`TC-2.2a` ✅, `TC-2.2b` ⚠️, `TC-2.2c` ⚠️, `TC-2.2d` ⚠️, `TC-2.2e` ✅). `AC-2.3` ⚠️ (`TC-2.3a` ⚠️, `TC-2.3b` ⚠️, `TC-2.3c` ⚠️). `AC-2.4` ✅ (`TC-2.4a` ✅, `TC-2.4b` ✅).
- **Story 3**: `AC-3.1` ⚠️ (`TC-3.1a` ✅, `TC-3.1b` ✅, `TC-3.1c` ✅, `TC-3.1d` ⚠️ works for the happy path but uses a coarse 500ms suppression window, `TC-3.1e` ✅, `TC-3.1f` ✅). `AC-3.2` ⚠️ (`TC-3.2a` ✅, `TC-3.2b` ✅, `TC-3.2c` ✅, `TC-3.2d` ⚠️ OS-handled/manual, `TC-3.2e` ✅, `TC-3.2f` ❌ broken). `AC-3.3` ✅ (`TC-3.3a` ✅, `TC-3.3b` ✅, `TC-3.3c` ✅). `AC-4.1` ✅ (`TC-4.1a` ✅, `TC-4.1b` ✅, `TC-4.1c` ✅). `AC-4.2` ✅ (`TC-4.2a` ✅, `TC-4.2b` ✅). `AC-4.3` ✅ (`TC-4.3a` ✅).
- **Story 4**: `AC-5.1` ✅ (`TC-5.1a` ✅, `TC-5.1b` ✅, `TC-5.1c` ✅, `TC-5.1d` ✅, `TC-5.1e` ✅, `TC-5.1f` ✅). `AC-5.2` ✅ (`TC-5.2a` ✅, `TC-5.2b` ✅). `AC-5.3` ⚠️ (`TC-5.3a` ❌, `TC-5.3b` ❌, `TC-5.3c` ❌, `TC-5.3d` ❌, `TC-5.3e` ✅, `TC-5.3f` ✅). The Electron quit path is deferred, not implemented.
- **Story 5**: `AC-6.1` ✅ (`TC-6.1a` ✅, `TC-6.1b` ✅, `TC-6.1c` ✅, `TC-6.1d` ✅, `TC-6.1e` ✅, `TC-6.1f` ✅, `TC-6.1g` ✅). `AC-6.2` ✅ (`TC-6.2a` ✅). `AC-6.3` ❌ (`TC-6.3a` ❌: state is retained, but the UI drops out of the editor and shows stale rendered content instead of retaining visible edits).
- **Story 6**: `AC-8.1` ✅ (`TC-8.1a` ✅, `TC-8.1b` ✅, `TC-8.1c` ✅). `AC-8.2` ✅ (`TC-8.2a` ✅, `TC-8.2b` ✅). `AC-9.1` ✅ (`TC-9.1a` ✅, `TC-9.1b` ✅). `AC-9.2` ❌ (`TC-9.2a` ❌, `TC-9.2b` ❌: helper exists, user-facing trigger does not). `AC-10.1` ✅ (`TC-10.1a` ✅). `AC-10.2` ⚠️ (`TC-10.2a` ⚠️ smoke-tested only, not performance-verified; `TC-10.2b` ❌ actual open flow does not implement binary gating and the test is synthetic).

## B. Architecture & Interface Compliance

- The implementation mostly matches the tech design: real CodeMirror wrapper, `PUT /api/file`, `POST /api/render`, consolidated `POST /api/save-dialog`, per-tab mode/dirty/edit state, `beforeunload`, conflict modal, and `savePending` suppression are all present.
- API compliance with tech-design-api.md is mostly good. The key design deviation, consolidating Save As and export dialogs into `/api/save-dialog`, is implemented and justified.
- UI compliance with tech-design-ui.md is partial. The designed patterns are present, but three important flows diverge: dirty-tab Save As replacement does not continue, deleted dirty tabs do not stay in the editor, and table insertion is never wired into the UI.
- The browser-only quit protection matches the design's documented deferral, but it does not satisfy the original story-level Electron TCs.

## C. Security Review

- **File write path validation is weak.** The server only checks "absolute path", markdown extension, and parent-directory existence, so any accessible absolute `.md` path can be written via `PUT /api/file`; there is no server-side binding to the current tab or a save-dialog-issued path.
- **`osascript` dialog construction is reasonably safe.** `save-dialog.ts` uses `JSON.stringify(...)`, which prevents straightforward AppleScript command injection through prompt/name/path strings.
- **Path traversal/workspace escape is not prevented.** Absolute paths containing `..` segments or symlink escapes are accepted as long as they resolve and have a markdown extension.
- **Input validation is partial.** `schemas/index.ts` only checks `startsWith('/')`; invalid-character cases are not classified cleanly as `400 INVALID_PATH`.
- **WebSocket validation is asymmetric.** The server validates inbound frames and restricts origin, but the client trusts any parsed incoming payload whose `type` field matches.

## D. External Dependencies & Stubs

- CodeMirror is properly integrated in production in `editor.ts`; it is mocked in client tests.
- File system operations are real in production and mocked at the boundary in server tests, which is appropriate.
- Native save-dialog integration is real via `osascript` in `save-dialog.ts`, not stubbed in production.
- The Electron quit modal is still effectively a deferred stub. The only implemented quit protection is browser `beforeunload`.

## E. Test Quality Assessment

- **Strong points:** server route tests exercise Fastify handlers directly; `/api/render` runs the real render pipeline; the Epic 5 target suite passes cleanly.
- **Weak points:** most client tests mock the editor and API, so they validate state transitions and wiring, not real CodeMirror/browser behavior.
- **Major gaps:** `save.test` never tests the post-modal continuation for `TC-3.2f`; `cross-epic.test` fakes the binary-file failure state instead of exercising the real open path; table insertion is only unit-tested as a pure helper; Electron quit TCs are absent.
- **Reliability:** isolation is generally good, but the heavy mock strategy means several "green" tests are weaker than their TC labels suggest.

## F. Findings by Severity

### Critical

No critical findings identified.

### Major

1. **Save As into a path that is already open in a dirty tab is non-functional.**
   - Files: `app/src/client/app.ts` (L1237, L516, L1686), `app/src/client/state.ts` (L75)
   - Impact: `TC-3.2f` is not implemented; the modal appears, but its buttons only dismiss because no continuation/pending-save state exists.
   - Fix: Route this through `showUnsavedModal()` or introduce explicit pending Save As state with target path and a continuation callback.

2. **Dirty tabs whose file is deleted on disk do not retain a visible editable buffer.**
   - Files: `app/src/client/components/content-area.ts` (L388, L464), `app/src/client/app.ts` (L620)
   - Impact: `TC-6.3a` is violated; the user's edits remain in state, but the UI switches to a stale rendered fallback instead of keeping the editor visible.
   - Fix: Keep the editor mounted for dirty deleted tabs and show a deletion banner above it.

3. **The table insert tool is not reachable from the product UI.**
   - Files: `app/src/client/components/insert-tools.ts` (L29), `app/src/client/components/content-area.ts` (L597), `app/src/client/app.ts` (L1826)
   - Impact: `AC-9.2` is missing even though unit tests exist for the helper.
   - Fix: Add a command/shortcut or toolbar action, wire an event handler like link insertion, and add an integration test that drives the actual UI.

4. **The save API trusts arbitrary absolute client-supplied paths.**
   - Files: `app/src/server/schemas/index.ts` (L4), `app/src/server/services/file.service.ts` (L78), `app/src/server/routes/file.ts` (L156)
   - Impact: Users or other local clients can write any accessible `.md` path outside the open workspace or save-dialog flow; this is weaker than the spec's "current path or Save As selection" safety model.
   - Fix: Normalize/canonicalize paths and enforce either workspace containment or a server-issued save token from the dialog/current tab.

5. **Binary-file fallback in edit mode is not actually implemented, and the corresponding test does not exercise the real path.**
   - Files: `app/src/client/app.ts` (L1115), `app/src/client/components/content-area.ts` (L471), `app/tests/client/components/cross-epic.test.ts` (L453)
   - Impact: `TC-10.2b` is effectively claimed without a real implementation path preventing editor initialization for binary-like content.
   - Fix: Detect invalid/binary text before editor mount and replace the synthetic test with a real open-flow case.

### Minor

1. **Client WebSocket messages are only type-checked by `message.type`, not schema-validated.**
   - File: `app/src/client/utils/ws.ts` (L66)
   - Impact: Malformed server payloads could reach app logic.
   - Fix: Parse incoming messages with `ServerWsMessageSchema`.

2. **Self-change suppression is a coarse time window, not a precise self-event match.**
   - Files: `app/src/client/app.ts` (L447, L1747)
   - Impact: A genuine external change arriving during the 500ms suppression window is silently ignored until some later event/save.
   - Fix: Suppress only the first matching watcher event using a nonce or saved `modifiedAt`.

3. **Traceability in some tests is stale.**
   - Files: `app/tests/client/components/content-toolbar.test.ts` (L51), `app/tests/server/routes/export-save-dialog.test.ts` (L31)
   - Impact: Still use older TC numbering, which makes Epic 5 coverage auditing noisier.
   - Fix: Rename test cases to current story/TC IDs.

## G. Summary

| Metric | Value |
|--------|-------|
| Overall quality score | **6/10** |
| Tests passing | 140/140 (14 files) |
| Critical findings | 0 |
| Major findings | 5 |
| Minor findings | 3 |

**Top 3 Risks:**
1. Broken dirty-tab Save As replacement flow (`TC-3.2f`)
2. Deleted-file editing UI hides the user's live buffer (`TC-6.3a`)
3. Save-path enforcement is too permissive (security)

**Top 3 Strengths:**
1. Atomic save + optimistic concurrency are solid
2. Render-from-unsaved-content and per-tab edit/render mode are well structured
3. The Epic 5 target suite is broad and currently green

**Recommended actions before release:**
1. Fix `TC-3.2f` end-to-end (Save As into dirty-tab path)
2. Keep dirty deleted tabs in the editor (`TC-6.3a`)
3. Wire the table insert tool to UI (`AC-9.2`)
4. Tighten save-path validation (security)
5. Replace the synthetic binary/edit test with a real open-flow test (`TC-10.2b`)
