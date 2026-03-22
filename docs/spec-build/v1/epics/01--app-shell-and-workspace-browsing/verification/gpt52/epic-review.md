# Epic 1 Verification — gpt-5.3-codex Review

*Note: gpt-5.2 run was replaced by a gpt-5.3-codex run performed directly by the human. The gpt-5.2 process was running 55+ minutes; this completed in ~9 minutes.*

---

## Critical
None found.

## Major

### M1 — AC-10.2 partially implemented and tested

Epic requires: error shown, tree cleared, and root line indicates the path is invalid.

Current refresh handling clears `lastRoot` to `null` instead of keeping an invalid-root state (`app.ts:187`), and root-line rendering has only "has root" vs "no root" branches (`root-line.ts:31`).

Tech design explicitly expected an invalid-root visual state (`.root-line__path--invalid`) (`tech-design-ui.md:458`).

Tests labeled for TC-10.2a assert only visible error text, not root-line invalid state semantics (`app.test.ts:217`, `error-notification.test.ts:26`).

### M2 — Invalid-path error contract inconsistent across endpoints

Epic contract specifies `400 INVALID_PATH` (`epic.md:781`).

- `/api/tree` returns `INVALID_ROOT` instead (`tree.ts:29`).
- `/api/session/root` relies on framework validation for bad absolute paths (no explicit 400 mapped response shape), so payload is Fastify validation format, not `{ error: { code, message } }` (`session.ts:45`, `session.ts:55`).

## Minor

### 1. Epic API table vs implementation envelope
Epic API table says `GET /api/session` returns `SessionState`, but implementation returns bootstrap envelope `{ session, availableThemes }`. This is aligned with tech design, but is a literal epic-contract deviation.

### 2. No router.ts orchestration layer
Architectural drift from UI design: no `router.ts`; component subscriptions wired directly from `bootstrapApp` (`app.ts:232`) vs documented design shape.

### 3. Structural test assertions
Several AC assertions are mostly structural/cosmetic (class presence) rather than behavior-level verification. Examples: truncation/hover assertions without layout behavior validation (`workspaces.test.ts:81`, `root-line.test.ts:104`), and scroll test sets inline overflow on the test host itself (`file-tree.test.ts:178`).

## Requested Checks Summary

| Check | Status |
|-------|--------|
| AC coverage | All ACs implemented and tested; AC-10.2 not fully met |
| 11 endpoints | All present |
| Zod vs TS | Core types schema-derived and consistent; error-code contract is the gap |
| Error handling | Corrupted session, permission denied, missing dirs, symlink loops — implemented and tested; deleted-root UX has gap |
| Session round-trip | Implemented and passing |
| Theme flow | End-to-end implemented and tested |
| 4 folder entry points | All call same browse/root-switch flow |
| ACs not fully implemented | AC-10.2 |
| Architectural deviations | Invalid-root behavior, missing router layer |
| Test quality | Broad and mostly real (156 passing), with noted weak spots |

**Test run: 156/156 passing.**
