# Epic 3: Mermaid and Rich Content — GPT-5.3-Codex Verification Review

**Codex Session ID:** `019d0fd2-2644-7f03-bd31-4a9032912576`
**Model:** gpt-5.3-codex
**Date:** 2026-03-21
**Reviewer:** Codex CLI (automated epic-level verification)

---

## Critical

No critical defects found.

---

## Major

### M1. AC-2.3b timeout behavior is not guaranteed for synchronous Mermaid stalls

**Category:** Architecture Compliance, AC Coverage

Timeout is `Promise.race` around `mermaid.render` in `src/client/utils/mermaid-renderer.ts:60` and `:67`. This cannot preempt synchronous main-thread blocking.

- **Spec reference:** AC-2.3b expects timeout fallback for overly complex diagrams (`epic.md:240`). Design docs acknowledge this limitation (`tech-design.md:141`).

### M2. Mermaid SVG is inserted via `innerHTML` without post-render sanitization

**Category:** Security

Raw SVG injection in `src/client/utils/mermaid-renderer.ts:84` and `:177`; only protection is `securityLevel: 'strict'` at `:52`.

- **Spec reference:** Security requirements in `epic.md:508`.
- **Test gap amplifying risk:** Mermaid is mocked in `tests/client/utils/mermaid-renderer.test.ts:30`, so real SVG sanitization/static behavior is not verified.

### M3. Watched-file integration ACs are not tested through the real `ws -> refresh -> render` path

**Category:** Integration Gaps, Test Quality

Implementation path exists in `src/client/app.ts:695` and `:1135`. But tests use isolated rerender/service calls instead: `tests/client/utils/mermaid-renderer.test.ts:449`, `:464`, `tests/server/routes/file.render.test.ts:677`.

- **Spec reference:** AC-5.1b and AC-5.2a/b in `epic.md:412` and `epic.md:418`.

---

## Minor

### m1. `RenderWarning.line` is never populated for Mermaid warnings

**Category:** Contract Consistency, AC-2.2b partial

Warning creation omits `line` in `src/client/utils/mermaid-renderer.ts:112`; warning panel only shows message for mermaid warnings in `src/client/components/warning-panel.ts:31`.

- **Spec reference:** AC-2.2b asks for line when available (`epic.md:225`), and contract includes optional line (`epic.md:439`).

### m2. "Raw source" is trimmed before fallback/warning creation

**Category:** AC-2.1 contract fidelity

Source is `.trim()`ed in `src/client/utils/mermaid-renderer.ts:133`, then shown in fallback at `:105`.

- **Spec reference:** "raw source fully visible/selectable" in `epic.md:204` and `epic.md:208`.

---

## Informational

### I1. Placeholder copy is stale ("rendering available in a future update")

`src/server/services/render.service.ts:149`, mirrored in test utility `tests/utils/mermaid-dom.ts:5`.

- **Spec reference:** Epic 3 expects actual rendering for valid blocks (`epic.md:165`).

### I2. TC-3.4c CSS test can drift from production CSS

Test injects ad-hoc stylesheet in `tests/client/utils/mermaid-renderer.test.ts:393` instead of asserting shipped rules in `src/client/styles/markdown-body.css:166`.

- **Spec reference:** AC-3.4c in `epic.md:312`.

---

## AC Coverage Summary (AC-1.1 through AC-5.2)

| AC | Status | Notes |
|----|--------|-------|
| AC-1.1 | Covered | |
| AC-1.2 | Covered | |
| AC-1.3 | Covered | |
| AC-1.4 | Covered | |
| AC-1.5 | Covered | |
| AC-1.6 | Partial | Config-level assertions only; real Mermaid output behavior not automated |
| AC-2.1 | Partial | Fallback works; raw-source trimming noted (m2) |
| AC-2.2 | Partial | Warning type/message yes; structured `line` not populated (m1) |
| AC-2.3 | Partial | Non-blocking yes; timeout limitation for sync stalls (M1) |
| AC-3.1 | Covered | |
| AC-3.2 | Covered | |
| AC-3.3 | Covered | |
| AC-3.4 | Covered | With test-fidelity caveat for TC-3.4c (I2) |
| AC-3.5 | Covered | |
| AC-4.1 | Covered | |
| AC-4.2 | Covered | TC-4.2a/b covered; TC-4.2c remains manual (as planned) |
| AC-4.3 | Covered | |
| AC-5.1 | Partial | Implementation present; watched-file integration not E2E-tested (M3) |
| AC-5.2 | Partial | Implementation present; watched-file integration not E2E-tested (M3) |

**Test execution:** `npm test -- tests/server/routes/file.render.test.ts tests/server/routes/file.render-tables.test.ts tests/client/utils/mermaid-renderer.test.ts` — all passed (3 files, 100 tests).
