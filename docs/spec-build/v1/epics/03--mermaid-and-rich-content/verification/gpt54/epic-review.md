# Epic 3: Mermaid and Rich Content — GPT-5.4 Epic Verification Review

**Codex Session:** `019d0fd2-1611-74a2-8d52-0f48ac9aa036`
**Model:** GPT-5.4 (high reasoning)
**Date:** 2026-03-21
**Test Run:** 100/100 passing (`file.render.test.ts`, `file.render-tables.test.ts`, `mermaid-renderer.test.ts`)

---

## Critical

None found.

---

## Major

### M-1: Stale Mermaid warnings after file-watch refresh (AC-5.1b / AC-5.2a / AC-5.2b)

Same-tab Mermaid renders can write stale warning state after auto-reload. `content-area.ts:221` only guards against tab switches, but `app.ts:695` refreshes watched files while preserving the same tab id. If an older `renderMermaidBlocks()` finishes after a watch-triggered refresh, it can overwrite the refreshed tab's Mermaid warnings with results from stale HTML.

- **Spec refs:** epic.md:412, tech-design-ui.md:243
- **Test gap:** mermaid-renderer.test.ts:449 and file.render.test.ts:677 only cover sequential re-renders, not overlapping watch refreshes.

### M-2: Theme switch during in-flight Mermaid render leaves mixed themes (AC-1.3c)

`mermaid-renderer.ts:129` snapshots the theme once for the whole placeholder batch, while `mermaid-renderer.ts:161` re-renders only already-materialized `.mermaid-diagram` nodes. Placeholders still rendering after the switch keep the old theme and are never revisited.

- **Spec refs:** epic.md:149, tech-design-ui.md:287
- **Test gap:** mermaid-renderer.test.ts:153 covers only a completed render followed by a switch.

### M-3: Mermaid source trimmed — raw source fidelity lost (AC-2.1b)

`mermaid-renderer.ts:133` applies `.trim()` before success rendering, error fallback, warning collection, and theme re-render storage. This breaks the "raw source is fully visible/selectable" expectation.

- **Spec refs:** epic.md:205, epic.md:449
- **Test gap:** mermaid-renderer.test.ts:276 only asserts exact source for already-trimmed fixtures.

---

## Minor

### m-1: Warning panel drops line information (AC-2.2b)

`warning-panel.ts:31` and `warning-panel.ts:107` render only the Mermaid message, never `line`. The `RenderWarning` contract includes a `line` field but it is not surfaced in the UI.

- **Spec refs:** epic.md:224, epic.md:433

### m-2: SVG inserted via innerHTML without app-owned sanitization

`mermaid-renderer.ts:57` sets `securityLevel: 'strict'`, then `mermaid-renderer.ts:84` injects the returned SVG directly via `innerHTML`. Security posture depends entirely on Mermaid's implementation rather than an app-owned sanitization step.

- **Spec refs:** epic.md:507
- **Test gap:** mermaid-renderer.test.ts:210 verifies config, not real SVG sanitization.

### m-3: Stale server-side placeholder text (AC-1.5)

`render.service.ts:149` still emits Epic 2 placeholder copy saying Mermaid rendering is "available in a future update." This is transient (client replaces it), but stale product text.

- **Spec ref:** epic.md:165

---

## Informational

- **Architecture compliance:** Shiki is server-side (render.service.ts:76), Mermaid is client-side (mermaid-renderer.ts:121), schema contract includes `'mermaid-error'` (index.ts:11), and esbuild enables ESM splitting (esbuild.config.ts:11). All aligned with tech design.
- **Test quality:** Solid for happy paths and basic failures. Several ACs are only partially automated by design: AC-1.6 and AC-3.4c are mock/config or CSS-verification tests (mermaid-renderer.test.ts:210, mermaid-renderer.test.ts:393); AC-4.2c remains manual-only per test-plan.md:507.

---

## AC Coverage Matrix

| AC | Status | Evidence |
|----|--------|----------|
| AC-1.1 | Covered | mermaid-renderer.test.ts:58 |
| AC-1.2 | Covered | mermaid-renderer.test.ts:93 |
| AC-1.3 | **Partial** | mermaid-renderer.test.ts:135 — in-flight theme switch gap (M-2) |
| AC-1.4 | Covered | mermaid-renderer.test.ts:166 |
| AC-1.5 | Covered | mermaid-renderer.test.ts:201 |
| AC-1.6 | Partial | mermaid-renderer.test.ts:210 — config only, not real output |
| AC-2.1 | **Partial** | mermaid-renderer.test.ts:265 — raw source trimmed (M-3) |
| AC-2.2 | **Partial** | mermaid-renderer.test.ts:331 — line info missing in UI (m-1) |
| AC-2.3 | Covered | mermaid-renderer.test.ts:355 — same-tab race is integration gap |
| AC-3.1 | Covered | file.render.test.ts:548 |
| AC-3.2 | Covered | file.render.test.ts:583 |
| AC-3.3 | Covered | file.render.test.ts:599 |
| AC-3.4 | Partial | file.render.test.ts:621, mermaid-renderer.test.ts:393 — no real browser theme path |
| AC-3.5 | Covered | file.render.test.ts:633 |
| AC-4.1 | Covered | file.render-tables.test.ts:119 |
| AC-4.2 | Partial | file.render-tables.test.ts:147 — TC-4.2c manual-only |
| AC-4.3 | Covered | file.render-tables.test.ts:171 |
| AC-5.1 | **Partial** | mermaid-renderer.test.ts:427 — watch refresh overlap not tested (M-1) |
| AC-5.2 | **Partial** | mermaid-renderer.test.ts:464, file.render.test.ts:677 — same-tab watch path not tested (M-1) |

---

## Summary

**0 Critical, 3 Major, 3 Minor findings.** All 100 tests pass. The three Major findings are concurrency/race-condition gaps around file-watch refresh (M-1), theme switching during render (M-2), and source fidelity trimming (M-3). These represent real behavioral gaps against the spec but are edge cases unlikely to surface in typical usage. The Minor findings are polish/hardening items.
