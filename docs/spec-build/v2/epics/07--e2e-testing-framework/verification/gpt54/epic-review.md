# Epic 7 — E2E Testing Framework: GPT-5.4 Epic Review

**Reviewer:** GPT-5.4 via Codex CLI
**Session ID:** `019d18a9-999e-79a2-9d77-867124fedfac`
**Date:** 2026-03-22
**Tokens:** 1,746,510 in / 17,635 out (1,628,544 cached)
**Test Suite:** All 34 Playwright tests passed locally in 19.6s

---

## Executive Summary

The functional browser coverage for Stories 2–6 is strong — all 34 Playwright tests pass and the AC/TC coverage for user-facing behavior is solid. The weak point is Story 1 / framework fidelity: the suite can test stale builds, the restart architecture diverges from the design, and several infrastructure TCs are only implicitly covered. The save re-render fix in `app.ts` appears present. No `TODO`/`FIXME`/stub markers were found.

| Metric | Full | Partial | Missing/Incorrect | Full % |
|---|---:|---:|---:|---:|
| Acceptance Criteria (27) | 21 | 6 | 0 | 77.8% |
| Test Conditions (50) | 40 | 8 | 2 | 80.0% |

---

## Findings by Severity

### Critical

#### 1. E2E suite runs against `dist/`, not current source — no pre-build step

**Files:** `server-manager.ts:2`, `package.json:18`, `package.json:30`

**Description:** The suite runs against `dist`, not the current source tree, and neither `test:e2e` nor `verify-all` rebuild first.

**Expected:** `npm run test:e2e` should validate the current implementation as the epic promises.

**Actual:** The harness imports `../../../dist/server/index.js`; if `src/` changed without `npm run build`, E2E can pass against stale artifacts.

**Suggested fix:** Make `test:e2e` and `verify-all` build first, or run the server from source in the test harness.

---

### Major

#### 2. Persistence tests don't restart the suite server — dual SessionService instances

**Files:** `persistence.spec.ts:152`, `persistence.spec.ts:178`, `persistence.spec.ts:218`, `server-manager.ts:27`, `session.service.ts:41`

**Description:** Persistence tests do not restart the suite server; they start a second Fastify instance against the same `sessionDir` while the original global server stays alive.

**Expected:** Per tech design, the shared server instance should be stopped and restarted on the same port/session dir.

**Actual:** Two independent `SessionService` caches can exist concurrently, so the tests are not exercising the real suite lifecycle and can mask restart bugs.

**Suggested fix:** Expose the global server manager to the persistence tests and restart that instance, or isolate these tests into their own suite/server/session directory.

#### 3. TC-1.1d port conflict test has incorrect semantics

**Files:** `global-setup.ts:23`, `global-setup.ts:59`, `index.ts:35`

**Description:** `TC-1.1d` is implemented with different semantics than the epic.

**Expected:** On port conflict, setup should fail clearly with a conflict message.

**Actual:** `startServer()` falls back to port `0`, and `verifyPortConflictHandling()` treats either fallback or `EADDRINUSE` as acceptable, so the suite neither proves nor enforces the required failure mode.

**Suggested fix:** Either align the epic/design, or add a real conflict-path test that asserts a deterministic failure message.

#### 4. TC-1.4c unmet — `verify` does not include E2E

**Files:** `package.json:29`, `package.json:30`

**Description:** `TC-1.4c` is unmet against the epic.

**Expected:** `npm run verify` should run both Vitest and Playwright.

**Actual:** Only `verify-all` includes E2E. This matches the tech design's deliberate deviation, but not the epic as written.

**Suggested fix:** Either update the epic to accept `verify-all`, or move E2E into `verify`.

#### 5. Story 1 infrastructure TCs are implicit, not executable

**Files:** `playwright.config.ts:3`, `global-teardown.ts:16`, `global-setup.ts:83`

**Description:** Story 1 infrastructure coverage is only partial; several TCs are implemented by convention/code, not executable assertions.

**Expected:** AC-1.1/1.2/1.3/1.5 should have runnable proof for teardown cleanup, fresh contexts, and actionable failure diagnostics.

**Actual:** `TC-1.1b`, `TC-1.2a`, `TC-1.2b`, `TC-1.3b`, and `TC-1.5a` are effectively implicit; the suite passed locally, but these behaviors are not directly asserted.

**Suggested fix:** Add a small infrastructure spec that checks clean context state, teardown cleanup, and failure-report attachments.

#### 6. Save shortcut is Mac-only — not platform-aware

**Files:** `interaction.spec.ts:165`, `interaction.spec.ts:202`, `interaction.spec.ts:51`

**Description:** Save tests are Mac-only.

**Expected:** Keyboard shortcuts should be platform-aware for local and CI runs.

**Actual:** Save uses hard-coded `Meta+s`; only cursor movement was made platform-aware.

**Suggested fix:** Mirror the helper approach and use `Meta+S` on macOS, `Control+S` elsewhere.

---

### Minor

#### 7. `expandDirectory()` helper is brittle

**File:** `helpers.ts:77`

**Description:** `expandDirectory()` is brittle as a reusable convention helper.

**Expected:** AC-10.1 helpers should be future-proof for later epics.

**Actual:** It assumes expansion increases visible row count by exactly 1, which is fixture-specific and fragile with deeper trees or virtualization changes.

**Suggested fix:** Wait for a specific child row or for `aria-expanded="true"` plus any descendant path match.

#### 8. Browser console monitoring is missing

**Files:** `playwright.config.ts:8`, `helpers.ts:11`

**Description:** Browser console monitoring from the tech design is missing.

**Expected:** Console errors should be collected and attached on failure for AC-1.5 diagnostics.

**Actual:** There is no `page.on('console', ...)` fixture/helper anywhere in the E2E stack.

**Suggested fix:** Add a custom Playwright fixture that records console warnings/errors and attaches them on failure.

---

## AC/TC Coverage Map

### Story 1 — E2E Infrastructure Foundation

| AC | TCs | Coverage | Implementation |
|---|---|---|---|
| AC-1.1 | TC-1.1a | Full | `navigation.spec.ts:12` (smoke test) |
| | TC-1.1b | Partial | Implicit — teardown runs but not asserted |
| | TC-1.1c | Full | `global-setup.ts:90` |
| | TC-1.1d | Incorrect | `global-setup.ts:23` — falls back instead of failing |
| AC-1.2 | TC-1.2a | Partial | Relies on Playwright defaults, no explicit test |
| | TC-1.2b | Partial | Relies on Playwright defaults, no explicit test |
| AC-1.3 | TC-1.3a | Full | `fixtures.ts:93` |
| | TC-1.3b | Partial | Implicit cleanup, not asserted |
| | TC-1.3c | Full | `global-teardown.ts:21` |
| AC-1.4 | TC-1.4a | Full | `package.json` scripts |
| | TC-1.4b | Full | `package.json` scripts |
| | TC-1.4c | Missing | `verify` does not include E2E (tech design deviation) |
| AC-1.5 | TC-1.5a | Partial | No console monitoring fixture |

### Story 2 — Workspace Browsing and File Opening

| AC | TCs | Coverage | Implementation |
|---|---|---|---|
| AC-2.1–2.3 | All | Full | `navigation.spec.ts:17` |

### Story 3 — Rendering and Mermaid

| AC | TCs | Coverage | Implementation |
|---|---|---|---|
| AC-3.1–3.6 | All | Full | `rendering.spec.ts:7` |

### Story 4 — Tabs, Editing, and Export

| AC | TCs | Coverage | Implementation |
|---|---|---|---|
| AC-4.1–4.3 | All | Full | `interaction.spec.ts:61` |
| AC-5.1–5.2 | All | Full | `interaction.spec.ts` |
| AC-6.1 | All | Full | `interaction.spec.ts` |

### Story 5 — Theme, Session Persistence, and File Watching

| AC | TCs | Coverage | Implementation |
|---|---|---|---|
| AC-7.1 | All | Full | `persistence.spec.ts:132` |
| AC-7.2 | TC subset | Partial | Restart model deviates from design |
| AC-8.1 | TC subset | Partial | Restart model deviates from design |
| AC-8.2 | TC subset | Partial | Restart model deviates from design |
| AC-9.1 | All | Full | `persistence.spec.ts:247` |
| AC-10.1 | All | Full | `helpers.ts:11` (with brittleness caveat) |
| AC-10.2 | All | Full | File layout in `tests/e2e/` |

---

## Additional Checks

### Save Re-render Fix
Checked `app.ts:947` and `app.ts:524` — the save re-render fix appears present and functional.

### Stubs / TODOs
No `TODO`, `FIXME`, or stub markers found in any of the reviewed files.

### Security
No security issues identified in the test infrastructure. Port handling, process management, and file system access patterns are appropriate for a test harness.

---

## Overall Assessment

**Verdict: Conditional Pass**

The implementation delivers solid browser-level E2E coverage for the functional stories (2–5). All 34 tests pass and the test quality for user-facing scenarios is high. The primary gaps are in Story 1 infrastructure fidelity:

1. **Critical:** The stale-build risk is a real correctness concern for CI/development workflows
2. **Major:** The persistence restart architecture divergence means session persistence tests don't exercise the real lifecycle
3. **Major:** Several infrastructure TCs rely on implicit behavior rather than executable assertions

These gaps affect confidence in the framework's robustness guarantees but do not undermine the functional test coverage itself. Addressing the critical finding (pre-build step) and the persistence restart model would bring coverage to ~90%+ on both AC and TC metrics.
