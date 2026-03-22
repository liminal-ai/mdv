# Epic 1 Verification — gpt-5.4 Codex Review

*Note: gpt-5.4 process was running 55+ minutes; the human ran this directly and provided the output.*

---

## Critical
No critical defects found.

## Major

### M1 — AC-2.4b tree keyboard navigation not reachable
The tree keyboard navigation is only exercised through synthetic events on an unfocusable container. Rows are rendered with `tabindex="-1"` and the tree host never gets a tab stop, while the key handler is attached to the container. A keyboard user has no reliable way to enter the tree in the first place. See `file-tree.ts:45`, `file-tree.ts:180`, and the shallow test at `file-tree.test.ts:207`.

### M2 — AC-10.2 partially implemented
When refresh hits `PATH_NOT_FOUND`, the client clears `lastRoot` to `null` instead of putting the root line into the designed invalid state. The current root line only supports "has root" vs "no root" — the deleted path is lost instead of being shown as invalid with copy/browse still available. See `app.ts:187`, `root-line.ts:31`, and the intended behavior in `tech-design-ui.md:458`.

### M3 — Bootstrap failure renders blank page
If `GET /api/session` fails, the shell does not render a clean empty state. `bootstrapApp()` awaits `api.bootstrap()` before creating any fallback state, and the top-level catch only logs the error. Contradicts the design's "non-blocking bootstrap failure" behavior. See `app.ts:36`, `app.ts:316`, and `tech-design-ui.md:81`.

### M4 — PUT /api/session/root accepts files, not just directories
Only calls `stat()` and accepts any existing absolute path including files. The later tree scan turns a file root into `ENOTDIR`/`SCAN_ERROR` instead of rejecting it up front. See `session.ts:57` and `tree.service.ts:113`.

### M5 — POST /api/session/workspaces accepts nonexistent paths
The route blindly persists any absolute path and never verifies that it exists or is a directory. Broken workspaces can be stored and only fail later when clicked. See `session.ts:94`, `session.service.ts:70`.

## Minor

### 1. Shallow test assertions
Several tests don't exercise real behavior. `TC-5.6a` hard-codes `overflow-y: auto` on the test fixture instead of proving independent tree scrolling (`file-tree.test.ts:177`). The four folder-selection entry-point tests only prove callback wiring, not "browse → setRoot → getTree → identical final state." Theme coverage is split into pieces rather than a single select → apply → persist → restore flow.

### 2. Architectural deviations from UI design
No `client/router.ts`, `expandedDirsByRoot` is a `Record<string, string[]>` instead of `Map<string, Set<string>>`, and the context menu scrapes DOM datasets instead of consuming a `TreeNode` event payload. Functionally works but is a real departure from the tech design.

## Checks Summary

| Check | Status |
|-------|--------|
| All 11 endpoints exist | ✅ |
| Endpoint contract mismatches | PUT root accepts files, POST workspaces accepts nonexistent paths |
| Zod/TS alignment | Consistent (no schema/interface mismatch) |
| Error handling | Implemented server-side; deleted-root UI gap is the main exception |
| Session persistence | Implemented but no single end-to-end round-trip test |
| Theme persistence | Implemented but no single end-to-end flow test |
| 4 folder entry points | All call same flow; "same result" not fully proven in tests |

## Coverage Summary
- **Fully covered:** AC-1.1–1.4, AC-2.1–2.3, AC-2.5, AC-3.1–3.4, AC-4.1–4.6, AC-5.1–5.5, AC-5.7, AC-6.1–6.3, AC-7.1–7.4, AC-8.1–8.5, AC-9.2, AC-10.1, AC-10.3
- **Not fully implemented or proven:** AC-2.4b (tree keyboard entry), AC-10.2 (deleted-root UX), AC-9.1 (same-result proof)

**Test run: 156/156 passing.**
