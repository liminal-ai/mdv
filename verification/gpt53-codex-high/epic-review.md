# Epic 2 — Full Implementation Review (gpt-5.3-codex)

> Codex session: `019d09d5-aab9-7f52-ac16-5a218be4ea55`
> Model: gpt-5.3-codex | Reasoning: high | Date: 2026-03-20

---

## Critical

No Critical severity defects found.

## Major

### 1. [AC-1.7b not implemented] Missing recent-file cleanup when a recent entry points to a deleted file

Epic requires removing stale recent entries; current flow only surfaces an error.

- **Spec:** [epic.md:183](../docs/spec-build/features/02--document-viewing-and-multi-tab-reading/epic.md)
- **Code:** [content-area.ts:39](../app/src/client/components/content-area.ts), [app.ts:838](../app/src/client/app.ts), [api.ts:128](../app/src/client/api.ts)

### 2. [TC-9.1b not implemented] Opening a tree item that disappeared shows an error but does not refresh/remove stale tree entries

Spec expects stale tree cleanup after FILE_NOT_FOUND.

- **Spec:** [epic.md:683](../docs/spec-build/features/02--document-viewing-and-multi-tab-reading/epic.md)
- **Code:** [app.ts:838](../app/src/client/app.ts)

### 3. [Tech-design Q8 gap] 1MB–5MB "warn and confirm" flow is not implemented client-side

Design says confirmation before display for large docs; implementation stores `size` but never branches on it.

- **Design:** [tech-design.md:186](../docs/spec-build/features/02--document-viewing-and-multi-tab-reading/tech-design.md)
- **Code:** [app.ts:129](../app/src/client/app.ts), [app.ts:793](../app/src/client/app.ts)

### 4. [TC-9.3b gap] No file-read timeout behavior exists

Reads can hang indefinitely on slow mounts; neither server read nor client fetch path enforces timeout/abort.

- **Code:** [file.service.ts:43](../app/src/server/services/file.service.ts), [api.ts:142](../app/src/client/api.ts)

### 5. [TC-7.3b behavior mismatch] Recreated deleted files auto-reload instead of "offer to reload"

Spec wording requires offering; code immediately refreshes on non-deleted file-change events.

- **Spec:** [epic.md:628](../docs/spec-build/features/02--document-viewing-and-multi-tab-reading/epic.md)
- **Code:** [app.ts:1033](../app/src/client/app.ts)

### 6. [Traceability quality issue] Coverage claims are overstated in docs

`test-plan.md` claims TC-9.1b coverage in `menu-bar-epic2.test.ts`, but that file only asserts path-status behavior.

- **Docs:** [test-plan.md:490](../docs/spec-build/features/02--document-viewing-and-multi-tab-reading/test-plan.md)
- **Tests:** [menu-bar-epic2.test.ts:33](../app/tests/client/components/menu-bar-epic2.test.ts)

## Minor

### 1. [Architecture drift] Design references modules not present in implementation

Design references `router.ts`, `tab-context-menu.ts`; behavior is embedded in `app.ts`/`tab-strip.ts`. Not blocking, but increases orchestration coupling.

- **Design:** [tech-design.md:410](../docs/spec-build/features/02--document-viewing-and-multi-tab-reading/tech-design.md)
- **Code:** [app.ts:932](../app/src/client/app.ts), [tab-strip.ts:38](../app/src/client/components/tab-strip.ts)

### 2. [Design drift] Watch debounce is 300ms, not the 100ms described in API design

- **Design:** [tech-design-api.md:544](../docs/spec-build/features/02--document-viewing-and-multi-tab-reading/tech-design-api.md)
- **Code:** [watch.service.ts:6](../app/src/server/services/watch.service.ts)

### 3. [Interface/error-code mismatch] Unexpected render failures returned as `READ_ERROR` rather than distinct `RENDER_ERROR`

- **Design:** [tech-design.md:366](../docs/spec-build/features/02--document-viewing-and-multi-tab-reading/tech-design.md)
- **Code:** [file.ts:110](../app/src/server/routes/file.ts)

### 4. [Security hardening] Unsupported link schemes fall through to browser default navigation

Defense-in-depth weakness if sanitization assumptions ever regress.

- **Code:** [link-handler.ts:26](../app/src/client/utils/link-handler.ts), [link-handler.ts:150](../app/src/client/utils/link-handler.ts)

## Validation Notes

1. Read all requested artifacts plus all files in `src/server/`, `src/client/`, `src/shared/`, and all tests in `tests/`.
2. Ran full verification: `npm run verify` passed (`format`, `lint`, `typecheck`, `typecheck:client`, `vitest` all green).
3. Current test suite is healthy, but gaps above show spec/design conformance issues that tests do not currently enforce.
