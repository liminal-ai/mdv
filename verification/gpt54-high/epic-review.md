# Epic 2 — Full Implementation Review

**Reviewer:** Codex (GPT-5.4 high reasoning)
**Session:** `019d09d5-55e8-7280-bc5c-6ef32a6df541`
**Scope:** All source in `src/server/`, `src/client/`, `src/shared/`, all tests in `tests/`
**Checked against:** Epic, Tech Design, Tech Design API, Tech Design UI, Test Plan

---

## Critical

- **Raw HTML images with unquoted `src` bypass image policy.** The renderer only rewrites `<img>` tags that match a quoted-`src` regex, so valid HTML like `<img src=https://example.com/x.png>` survives sanitization unchanged, produces no warning, and loads remotely; `<img src=./local.png>` also skips the proxy and placeholder logic. Breaks AC-3.1/3.3 and creates a real security hole in the "remote images are blocked" guarantee. Reproduced against the built `RenderService`: it returned the remote `<img>` unchanged with `[]` warnings. Tests only cover quoted raw-HTML image variants, so this regression slips through.
  - `render.service.ts` L10, L64
  - `file.render.test.ts` L419

- **Localhost-privileged endpoints and WebSocket have no Origin/CSRF protection.** Any website the user visits can attempt `POST /api/browse`, `POST /api/file/pick`, or connect to `WS /ws`; the first two can trigger native dialogs, and the WebSocket can be abused for local file existence/change probing because the server accepts any absolute path watch request and does not validate `Origin`. For a local desktop-style app, this is a serious browser-to-localhost trust bug.
  - `browse.ts` L15
  - `file.ts` L117
  - `ws.ts` L9

## Major

- **1-5 MB "load anyway?" flow (tech design Q8) not implemented.** The client stores `size`, but never branches on it before rendering, so medium-large files open immediately with no confirmation.
  - `app.ts` L117, L793, L890

- **TC-1.7b missing: stale recent-file entry never removed.** Clicking a missing recent file shows an error, but the stale entry is never cleaned up. `ApiClient.removeRecentFile()` exists but is unused.
  - `content-area.ts` L38
  - `app.ts` L838
  - `api.ts` L128

- **TC-9.1b half-implemented: stale tree node not refreshed on 404.** If a file disappears between tree load and click, the user gets an error, but the tree is not refreshed to remove the stale node. Tree clicks go straight into `openFile()`, and the error path never calls `refreshTree()`.
  - `sidebar.ts` L119
  - `app.ts` L838, L556

- **TC-9.3b unimplemented: no read timeout on either side.** The server file read path has no timeout wrapper, and the client request layer has no `AbortController`/deadline logic, so slow reads can hang indefinitely instead of surfacing a timeout error.
  - `file.service.ts` L23
  - `api.ts` L135

## Minor

- **Tab restore is noisier than designed.** Missing restored tabs are not "silently skipped"; each failure raises a user-visible error during bootstrap before the persisted session is healed.
  - `app.ts` L911

- **Active file path status hidden below 860px.** Conflicts with AC-8.1 and the narrow-window requirement in the epic/design.
  - `menu-bar.css` L141

- **Test coverage gaps on spec-critical paths.** Tests miss: unquoted raw-HTML image `src` handling, large-file confirmation UX, stale recent-file cleanup, stale-tree refresh on 404, and read timeouts. Existing tests mainly stop at server `size` propagation or callback wiring rather than the required UX flows.
  - `file.render.test.ts` L419
  - `file.test.ts` L298
  - `content-area.test.ts` L105

## Design-Approved Deviations (Not Findings)

Server-side rendering, WebSocket watching, and persisted tabs all align with the tech design. No separate classic script-tag XSS or root-escape path traversal found in `/api/file` beyond the explicitly accepted "any absolute path" design.

## Verification

`npm test`, `npm run typecheck`, and `npm run typecheck:client` all pass. Test suite: **307/307** (one jsdom navigation warning, non-blocking).
