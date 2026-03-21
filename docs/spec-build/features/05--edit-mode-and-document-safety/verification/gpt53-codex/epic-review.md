# Epic 5 Review — GPT-5.4 Codex Diversity Review

> **Model:** GPT-5.4 (gpt-5.4 via Codex CLI; o3 was unavailable with current account)
> **Session ID:** `019d1156-5ed5-7a12-9f64-1f9812457d70`
> **Tokens:** ~7.1M in / ~28K out (6.9M cached)
> **Date:** 2026-03-21

## Executive Summary
Epic 5 is structurally close to the intended design: the main APIs are present, the CodeMirror integration is in place, atomic save/conflict primitives exist, and most happy-path UI flows are wired. The biggest problems are in document-safety edge cases: one watcher path can silently preserve stale editor content after an external change, one Save As replacement flow stops at a modal with no continuation, and deleted-during-edit no longer retains the editor experience the spec requires.

## Findings by Severity

### Critical
1. Clean external reloads can leave a stale editor buffer in memory and on screen, which can silently overwrite newer disk content on the next edit/save. `refreshWatchedFile()` rebuilds the tab from disk but preserves `existing.editContent` and `dirty` via `buildLoadedTab()`, and edit mode later prefers `editContent ?? content`, so a clean tab with a cached editor buffer never actually reloads its editor content. This breaks AC-6.2 for clean edit-mode tabs and creates a real stale-write/data-loss path.
[app.ts](app/src/client/app.ts#L148)
[app.ts](app/src/client/app.ts#L1012)
[content-area.ts](app/src/client/components/content-area.ts#L471)
[conflict-modal.test.ts](app/tests/client/components/conflict-modal.test.ts#L616)

### Major
1. `Save As` to a path already open in a dirty tab does not proceed after the user resolves the modal. The code sets `unsavedModal.context = 'save-as-replace'` and immediately returns, but that context is never consumed anywhere; `settleUnsavedChoice()` only resolves a pending promise when `showUnsavedModal()` was used, which is not the case here. The result is a dead-end modal instead of the AC-3.2f flow.
[app.ts](app/src/client/app.ts#L516)
[app.ts](app/src/client/app.ts#L1214)
[state.ts](app/src/client/state.ts#L78)
[save.test.ts](app/tests/client/components/save.test.ts#L523)

2. File deletion while editing does not retain the editor as required by TC-6.3a. On a `deleted` watcher event the app marks the tab deleted, and `content-area` replaces the document/editor with a deleted banner plus last rendered HTML, explicitly destroying the edit surface when not in edit mode handling. The local edits remain in state, but the user no longer "retains the editor" or sees a targeted recovery workflow.
[app.ts](app/src/client/app.ts#L996)
[app.ts](app/src/client/app.ts#L1738)
[content-area.ts](app/src/client/components/content-area.ts#L388)
[conflict-modal.test.ts](app/tests/client/components/conflict-modal.test.ts#L651)

3. The table insert feature is not actually available in production. `insertTable()` exists, but there is no keyboard shortcut, toolbar control, or other UI wiring that ever calls it; only link insertion is registered. This leaves AC-9.2 unimplemented despite unit tests for the helper.
[insert-tools.ts](app/src/client/components/insert-tools.ts#L29)
[app.ts](app/src/client/app.ts#L1826)
[content-toolbar.ts](app/src/client/components/content-toolbar.ts#L264)
[insert-tools.test.ts](app/tests/client/components/insert-tools.test.ts#L50)

### Minor
1. Save As is not restricted to `.md`/`.markdown` at dialog time. The save dialog is a generic `choose file name` wrapper with no extension enforcement, and the server rejects non-markdown only after submission. That is a spec deviation from the "Save As restricts" requirement, though it fails safely.
[save-dialog.ts](app/src/server/utils/save-dialog.ts#L10)
[file.service.ts](app/src/server/services/file.service.ts#L89)

2. Path validation is weaker than the security language in the epic. `AbsolutePathSchema` only checks for a leading `/`, and `PUT /api/file` is not constrained to opened files or paths returned from the save dialog. That is not an immediate exploit in the localhost threat model, but it is looser than "only current path or chosen Save As path."
[schemas/index.ts](app/src/server/schemas/index.ts#L4)
[file.service.ts](app/src/server/services/file.service.ts#L85)

3. The automated suite overstates coverage for several risky flows. The Save As replacement test stops at "modal opened," the clean auto-reload test checks `content` but not edit-buffer/editor sync, and the delete-while-editing test checks state only, not that the editor remains usable.
[save.test.ts](app/tests/client/components/save.test.ts#L523)
[conflict-modal.test.ts](app/tests/client/components/conflict-modal.test.ts#L616)
[conflict-modal.test.ts](app/tests/client/components/conflict-modal.test.ts#L651)

## Coverage Analysis

### AC Coverage Matrix

| Story | AC | Status | Notes |
|---|---|---|---|
| 1 | AC-1.1 Mode switching | Implemented | Render/edit toggle, shortcut, per-tab mode, unsaved render path present. |
| 1 | AC-1.2 Toolbar reflects mode | Implemented | Cursor/warnings swap correctly. |
| 2 | AC-2.1 Editor surface | Implemented | CodeMirror wrapper, cursor display, line-number support via `basicSetup`. |
| 2 | AC-2.2 Standard editing ops | Implemented | Native CodeMirror behavior; automated coverage is partial for selection/copy/paste/cut/redo. |
| 2 | AC-2.3 Theme adaptation | Implemented | CSS-var driven. |
| 2 | AC-2.4 Scroll management | Implemented | Percentage mapping and per-tab edit scroll present. |
| 3 | AC-3.1 Save | Implemented | Atomic write, conflict guard, render-mode save, self-change suppression. |
| 3 | AC-3.2 Save As | Partial | Dirty-tab replacement path (TC-3.2f) is not completed. |
| 3 | AC-3.3 Save failures | Implemented | Server/client preserve edits and surface errors. |
| 4 | AC-4.1 Tab dirty indicator | Implemented | Dot indicator wired. |
| 4 | AC-4.2 Toolbar dirty indicator | Implemented | Visible in both modes. |
| 4 | AC-4.3 Per-tab dirty tracking | Implemented | Per-tab state is independent. |
| 5 | AC-5.1 Close dirty tab prompt | Implemented | Save/discard/cancel flows present. |
| 5 | AC-5.2 Multi-tab close prompts | Implemented | Sequential modal flow present. |
| 5 | AC-5.3 Quit protection | Partial by design | Browser `beforeunload` implemented; Electron-specific custom modal deferred in design. |
| 6 | AC-6.1 Conflict modal | Implemented | Keep/reload/save-copy flows exist. |
| 6 | AC-6.2 Clean external auto-reload | Partial | Broken for clean tabs that still have cached `editContent` from edit mode. |
| 6 | AC-6.3 Deletion while editing | Partial | State preserves edits, but the editor is replaced by a deleted banner. |
| 7 | AC-7.1 Default mode picker | Implemented | Edit enabled and persisted. |
| 7 | AC-7.2 Existing tabs unaffected | Implemented | Existing tabs keep current mode. |
| 8 | AC-8.1 Export with unsaved edits | Implemented | Warning modal and save/export choices wired. |
| 8 | AC-8.2 File menu Save/Save As | Implemented | Menu state aligns with spec. |
| 9 | AC-9.1 Insert link | Implemented | Cmd+K path exists. |
| 9 | AC-9.2 Insert table | Missing | Helper exists, but no production trigger. |
| 10 | AC-10.1 Save errors preserve edits | Implemented | Verified in client flow. |
| 10 | AC-10.2 Editor errors don't crash app | Partial | Binary fallback exists; large-file responsiveness is mostly manual/perf-claim based. |

### TC Coverage Matrix

| Flow | TCs | Test file(s) | Status | Notes |
|---|---|---|---|---|
| 1 | TC-1.1a, b, c, d, e, f; TC-1.2a, b | `mode-switching.test.ts`, `keyboard-epic5.test.ts` | Covered | Good automated coverage. |
| 2 | TC-2.1a, b, c, d; TC-2.2a, e; TC-2.3a, b, c; TC-2.4a, b | `editor.test.ts` | Covered | Mostly state/UI coverage through mocked editor. |
| 2 | TC-2.2b, c, d | none automated | Partial | Explicitly left to manual verification. |
| 3 | TC-3.1a, b, c, d, e, f | `file-save.test.ts`, `save.test.ts`, `keyboard-epic5.test.ts` | Covered | Server/client split is good. |
| 3 | TC-3.2a, b, c | `save-dialog.test.ts`, `save.test.ts`, `keyboard-epic5.test.ts` | Covered | |
| 3 | TC-3.2d | none automated | Partial | Manual-only OS overwrite prompt. |
| 3 | TC-3.2e | `save.test.ts` | Covered | |
| 3 | TC-3.2f | `save.test.ts` | Partial | Test only checks modal state, not the required continuation. |
| 3 | TC-3.3a, b, c | `file-save.test.ts`, client save flows | Covered | |
| 4 | TC-4.1a, b, c; TC-4.2a, b; TC-4.3a | `save.test.ts` | Covered | |
| 5 | TC-5.1a, b, c, d, e, f; TC-5.2a, b; TC-5.3e, f | `unsaved-modal.test.ts` | Covered | |
| 5 | TC-5.3a, b, c, d | none | Deferred | Deferred by design to Epic 6 / Electron. |
| 6 | TC-6.1a, b, c, d, e, f, g | `conflict-modal.test.ts` | Covered | |
| 6 | TC-6.2a | `conflict-modal.test.ts` | Partial | Only asserts `tab.content`, not edit-buffer/editor sync for clean edit-mode tabs. |
| 6 | TC-6.3a | `conflict-modal.test.ts` | Partial | Only asserts state preservation, not retained editor/UI workflow. |
| 7 | TC-7.1a, b, c, d; TC-7.2a | `mode-switching.test.ts`, `session-epic2.test.ts` | Covered | |
| 8 | TC-8.1a, b, c; TC-8.2a, b | `cross-epic.test.ts` | Covered | |
| 9 | TC-9.1a, b | `insert-tools.test.ts`, `keyboard-epic5.test.ts` | Covered | |
| 9 | TC-9.2a, b | `insert-tools.test.ts` | Partial | Helper is tested, but no user-accessible production path exists. |
| 10 | TC-10.1a | `cross-epic.test.ts` | Covered | |
| 10 | TC-10.2a | `cross-epic.test.ts` | Partial | Presence test only; performance remains manual. |
| 10 | TC-10.2b | `cross-epic.test.ts` | Covered | |

## Interface Compliance
API compliance is mostly good. The implementation exposes `PUT /api/file`, `POST /api/render`, and the consolidated `POST /api/save-dialog`, matching the tech design rather than the original pre-design epic text. Request/response shapes line up with the schemas in [schemas/index.ts](app/src/server/schemas/index.ts).

UI compliance is weaker. The Render/Edit toggle, cursor display, dirty indicators, conflict modal, unsaved modal, and export-dirty warning all exist and behave close to spec. The notable UI contract misses are that table insertion has no visible trigger at all, and the deleted-while-editing case swaps the editor out for a deleted banner instead of retaining the edit surface.

## Architecture Assessment
The high-level architecture matches the design: server owns file IO and rendering, client owns tab/edit state, and watcher events feed client conflict/reload behavior. The main architecture break is in reuse of `buildLoadedTab()` for watcher-driven reloads: that helper is appropriate for initial hydration, but not for "replace with fresh disk state," because it preserves cached `editContent` and dirty flags in paths that should converge to disk truth.

The event flow `watcher -> wsClient -> refreshWatchedFile/conflictModal` is otherwise clean, but the `save-as-replace` branch is incomplete: state can enter a special modal context that has no downstream action handler. That is a concrete orchestration hole, not just a missing test.

## Security Assessment
The good parts:
- Save dialogs and file pickers use `execFile`, not shell interpolation.
- AppleScript arguments are JSON-stringified before being embedded.
- File saves use temp-file-plus-rename with temp cleanup on failure.
- Server rejects non-markdown write targets.

Residual concerns:
- Path validation is "absolute path only," not "safe/approved path only."
- `PUT /api/file` will accept any absolute markdown path the process can write, not just an already-open file or a path returned from the save dialog.
- Save As extension restriction is not enforced in the dialog itself.

I did not find an obvious `osascript` injection vector in Epic 5.

## Test Quality Assessment
The suite is broad, but it is strongest on happy-path state transitions and weaker on the riskier "user still sees the right thing" cases. The heaviest gaps are:
- Save As replacement with another dirty tab: modal presence tested, continuation untested and broken.
- Clean auto-reload during/after edit mode: no assertion that the editor buffer actually updates.
- Delete while editing: no assertion that the editor remains available.
- Table insert: only helper-level unit tests, no integration path because there is no production trigger.

## Stubs and Incomplete Work
I did not find TODO/FIXME/HACK markers in Epic 5 source, but there are two concrete incomplete paths:
- `save-as-replace` is a dead-end modal context with no continuation logic.
- `insertTable()` is orphaned helper logic with no production entry point.

The Electron-specific quit modal remains deferred, but that matches the documented design split rather than looking like an accidental stub.
