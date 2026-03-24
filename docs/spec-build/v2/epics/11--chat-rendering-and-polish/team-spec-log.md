# Team Spec Log — Epic 11: Chat Rendering and Polish

## Lane Determination

**Date:** 2026-03-23

**Lane:** Codex (codex-cli v0.116.0, gpt-5.4 default). Smoke test passed.

Skills loaded:
- `codex-subagent` — available, verified
- `ls-team-spec-c` — loaded (orchestration)
- `ls-epic` — to be loaded by drafter

## Verification Gate Discovery

Inherited from v2 pipeline (confirmed from `app/package.json`):

- **Phase acceptance gate:** `cd app && npm run verify` (format:check, lint, typecheck, typecheck:client, test)
- **Build gate:** `cd app && npm run build` (tsc + esbuild)
- **Final handoff gate:** `cd app && npm run verify && npm run build`

Note: Epic 11 is a spec-only phase — no code changes during spec pipeline. Code verification gates apply at implementation. Phase acceptance is document quality + Codex verification.

## Orientation

**What's being built:** Epic 11 — Chat Rendering and Polish. Streaming markdown rendering for the chat panel (established in Epic 10), partial construct handling, debounce tuning, scroll behavior, UI polish, keyboard shortcuts. This is the iteration point where the chat goes from functional plain text to polished markdown rendering.

**Artifacts available:**
- v2 PRD: `docs/spec-build/v2/prd.md`
- v2 Tech Architecture: `docs/spec-build/v2/technical-architecture.md`
- v1 Epics 01, 02, 06 (core specs, human-designated)
- v2 Epic 10 (Chat Plumbing): full spec set — epic, tech-design (index + server + client), test-plan, stories

**Core specs (human-designated):** v1 Epics 1, 2, 6. These established the foundational architecture, rendering pipeline, and hardening patterns.

**Direct predecessor:** Epic 10 (Chat Plumbing). The chat panel, WebSocket streaming, and plain text rendering are all established there. Epic 11 upgrades plain text to streaming markdown.

**Pipeline entry:** Phase 1 (Epic). No prior artifacts exist for Epic 11.

**Business epic:** Not requested.

**Key technical context from tech arch:**
- "Streaming Markdown Rendering Strategy" section establishes: buffer tokens, debounce re-rendering through markdown-it at ~100-200ms intervals, full accumulated text re-rendered each cycle
- Client owns chat rendering, streaming chunk buffering, and re-rendering
- Reuses existing markdown-it + shiki + mermaid pipeline from document rendering
- Mermaid blocks render only when complete code block is received
- Same feature flag as Epic 10 (`FEATURE_SPEC_STEWARD`)

---

## Phase 1: Epic — Epic 11 (Chat Rendering and Polish)

### Continuation Note

Pipeline resumed 2026-03-23. Prior session completed orientation and Codex verification but never launched the drafter. Picking up from that point with a fresh team (`steady-popping-turtle`). All orientation decisions carry forward.

### Drafter Launch

**Teammate:** `epic-writer` (Opus, general-purpose, bypassPermissions)

**Reading journey (8 docs, sequential with reflection):**
1. v2 PRD → product vision, Feature 11 scope, M3 pause point
2. v2 Tech Architecture → streaming markdown strategy, debounce pipeline
3. v1 Epic 1 → foundational architecture, UI patterns
4. v1 Epic 2 → rendering pipeline (markdown-it + shiki), content patterns
5. v1 Epic 6 → performance patterns, hardening conventions
6. v2 Epic 10 epic → chat infrastructure inherited
7. v2 Epic 10 tech-design index → module breakdown
8. v2 Epic 10 tech-design-client → client components Epic 11 extends

**Skill loaded last:** `ls-epic`

**Outcome:** Writer completed the full reading journey and went directly to drafting — no questions surfaced (none survived the writer's own filter). Draft produced at `docs/spec-build/v2/epics/11--chat-rendering-and-polish/epic.md`.

**Self-review findings (6 items, all fixed during drafting):**
1. Standardized "agent response" language in AC-1.1 TCs (user messages stay plain text)
2. Added TC-1.4c — final render flush on `chat:done` (debounce must not delay completion)
3. Added TC-2.4b — no flash of raw markdown (UX gap not covered by individual partial TCs)
4. Added TC-3.1b — auto-scroll during height changes from markdown rendering upgrades
5. Added AC-6.2 — render failure fallback (prevents shiki/markdown-it errors from crashing chat)
6. Kept AC-1.1 as single large AC (9 TCs) — intentional, all constructs use same pipeline reuse

**Open items (M3 tuning decisions, not epic defects):**
- Enter-to-send vs Cmd+Enter (A5, unvalidated assumption)
- Escape-when-idle behavior (TC-5.2b)
- Exact debounce interval (150ms default)
- Chat toggle shortcut conflict avoidance (Q7)

**Spec deviations:** None from PRD. Epic is purely client-side — no server changes needed. Enter-to-send chosen over PRD's "Cmd+Enter" as more conventional; flagged as A5.

### External Verification — Round 1

**Model:** Codex (gpt-5.4, high reasoning)
**Reading journey:** Same 8 artifacts + ls-epic skill, then the draft. Objective framing: "find what's wrong."
**Output target:** `docs/spec-build/v2/epics/11--chat-rendering-and-polish/verification/codex/epic-review-r1.md`
**Session ID:** `019d1cfb-faa1-7b00-be70-a9fb7eb50019`

**Findings:** 2 Critical, 8 Major, 4 Minor.

The two criticals were genuine errors: (1) the draft incorrectly claimed document rendering is server-side, contradicting Epic 2 and the tech architecture — this would have sent tech design down a wrong path; (2) Mermaid rendering was gated on full response completion instead of code block completion, narrowing the PRD requirement. All 14 findings routed to the writer.

**Writer disposition:** All 14 accepted and fixed. No rejections. Key corrections: architecture references corrected to client-side, Mermaid renders mid-stream when block closes, debounce configurability made testable, keyboard shortcuts made internally consistent, behavioral streaming contract replaced implementation callbacks, polish TCs given concrete pass/fail criteria, story ownership cleaned up, anchor/mailto links added, feature isolation covered functionally.

### External Verification — Round 2

**Findings:** 1 Major, 2 Minor (all introduced by R1 fixes).

The major was a story-mapping inconsistency: the Mermaid theme fix added TC-1.3b to AC-1.3, but Story 1 still claimed full AC-1.3 ownership while Mermaid is delivered in Story 2. The two minors were a stale tech design question and an AC title mismatch. All routed to writer, all fixed.

### External Verification — Round 3

**Findings:** None. All R2 fixes verified correct, no regressions.

**Verdict:** Codex signed off — **Approved for Tech Design.**

**Verification artifacts:**
- `verification/codex/epic-review-r1.md` — initial review (14 findings)
- `verification/codex/epic-review-r2.md` — re-review (3 findings)
- `verification/codex/epic-review-r3.md` — final sign-off (approved)

**Round count:** 3 rounds of external verification. The pattern was typical: R1 found real issues (especially the server-side rendering misattribution), R2 caught regression from fixes, R3 confirmed clean.

### Human Review

**Status:** Epic presented to human for every-line review.

**Human verdict:** Accepted. No changes requested. Human noted: amendments are a new practice — "we'll see how it goes."

**Phase 1 complete.** 3 verification rounds, 17 total findings (all resolved). Key observation: the server-side rendering misattribution (C1) was the most consequential catch — it would have sent tech design down a wrong path. Future reading journeys for epics that involve rendering should ensure Epic 2's rendering architecture is strongly anchored.

---

### Post-Acceptance Verification (Session 2 — 2026-03-23)

A fresh orchestration session re-ran verification on the accepted epic with a new Opus verifier + Codex dispatch. This was not planned duplication — the session initialized Phase 1 before discovering the prior session had already completed it. The verification caught real issues:

**Round 1 (Session 2):** Consolidated Opus + Codex review. Codex session `019d1d02-f2a6-70c0-8fad-ea719120d9da`. 6 Major, 8 Minor findings. 11 fixes applied, 3 accept-risk, 1 valid pushback (M1 — Mermaid timing was already correct).

**Round 2 (Session 2):** Re-verification of fixes. Codex session `019d1d12-039c-7b60-980d-305aedbab78c`. Found 1 Major, 2 Minor introduced by R1 fixes:

- **Ma1-R2 (Major):** The prior session's C1 fix went the wrong direction. It "corrected" the Key Constraint to say the rendering pipeline is "existing client-side," but Epic 2 deviated to server-side rendering. `markdown-it` and `shiki` only exist in `src/server/services/render.service.ts`. The epic now correctly says Epic 11 must SET UP a new client-side pipeline instance, not reuse an existing one. This is a material scope clarification for the tech designer.
- **Mi1-R2:** Resolved contradiction between Link Behavior table and Tech Design Q7 (relative paths).
- **Mi2-R2:** Reframed Tech Design Q8 — shiki uses dual-theme CSS variable mode, not inline styles.

All 3 fixes applied, confirmed clean by verifier. Final counts: 27 ACs, 82 TCs, 875 lines.

**Process observation:** The prior session's verification missed the pipeline location error because the C1 fix was applied in the same direction as the finding ("it says server-side, should say client-side") without verifying against the actual codebase. This session's verifier grep'd `render.service.ts` and found the truth. Lesson: factual claims about existing code should be verified against the codebase, not just against other spec documents.

---

## Phase 2: Tech Design — Epic 11 (Chat Rendering and Polish)

**Human instruction:** Tech designer must read `docs/gorilla-testing-approach.md` and incorporate gorilla testing scenarios (using agent-browser) into the test plan, to be executed at the end of the epic.

### Dependency Research

**Teammate:** `dep-researcher` (Opus, general-purpose, bypassPermissions)

**Outcome:** No new dependencies needed. Epic 11 works entirely with existing packages (markdown-it, shiki, mermaid, isomorphic-dompurify). One maintenance recommendation: bump isomorphic-dompurify ^3.5.1 → ^3.6.0 for 4 upstream DOMPurify CVEs (not Epic 11 scope, but should happen before or during). Rejected packages: lodash.debounce (trivial in vanilla JS), morphdom (only one message element replaced — no diffing value), scroll libraries (native APIs sufficient).

Key tech design inputs from research:
- Mermaid has no first-class re-theme API — workaround: persist source, strip `data-processed`, re-init, call `mermaid.run()`. Do NOT use `mermaidAPI.render()` (known bug on second render).
- Shiki uses dual-theme CSS variable mode on the server — tech design should decide if client pipeline replicates this.
- morphdom noted as contingency if innerHTML replacement causes UX issues.

**Human verdict:** Accepted (no new deps, proceed to tech design).

### Tech Design Writer Launch

**Teammate:** `td-writer` (Opus, general-purpose, bypassPermissions)

**Reading journey (14 docs, sequential with reflection):**
1. v2 PRD → product vision, Feature 11 scope
2. v2 Tech Architecture → streaming rendering strategy, constraints
3. v1 Epic 1 epic → foundational patterns
4. v1 Epic 1 tech-design → module structure conventions
5. v1 Epic 2 epic → rendering pipeline
6. v1 Epic 2 tech-design → server-side markdown-it + shiki pipeline (reference for client replication)
7. v1 Epic 6 epic → performance patterns
8. v1 Epic 6 tech-design → Mermaid caching, performance optimization
9. v2 Epic 10 epic → chat infrastructure inherited
10. v2 Epic 10 tech-design index → module breakdown
11. v2 Epic 10 tech-design-client → client architecture to extend
12. v2 Epic 10 test-plan → testing patterns
13. v2 Epic 11 epic → 27 ACs, 82 TCs, 8 tech design questions
14. Gorilla testing approach → template for gorilla scenarios

**Skill loaded last:** `ls-tech-design`

**Outcome:** Config A (2 docs: tech-design.md + test-plan.md). All 8 tech design questions answered. 92 tests mapped to 82 TCs. Gorilla testing scenarios included. No questions surfaced.

**Key design decisions:** Leading+trailing throttle at 150ms, fence count parity for partial code detection, simplified per-conversation Mermaid SVG cache (not Epic 6 LRU), innerHTML replacement on single streaming message, Cmd+J toggle, DOMPurify via existing isomorphic-dompurify, two-phase pipeline init (base sync + shiki async), dual-theme CSS variable mode matching server.

### External Verification — Round 1

**Model:** Codex (gpt-5.4, high reasoning)
**Session ID:** `019d1d41-1823-7191-ae26-4ee65a80a181`
**Output:** `verification/codex/td-review-r1.md`

**Findings:** 0 Critical, 6 Major, 2 Minor.

Key issues: (1) final-render sequencing race — `chat:done` marked complete before flush, losing the render target; (2) renderer parity drift — missing language aliases and incorrect hook ordering vs actual `render.service.ts`; (3) shiki cold-start fallback returned escaped text instead of `<pre><code>` blocks (TC-6.2c violation); (4) link behavior underspecified for Electron; (5) View menu toggle had no owning module; (6) Mermaid cache-hit/theme paths bypassed shared utility safety functions.

**Writer disposition:** All 8 fixed. Key changes: flush-first-then-complete ordering, two-phase base+shiki init, delegated click interceptor for all link types, menu-bar.ts added to architecture, Mermaid paths now use replacePlaceholderWithSvg/stripInlineEventHandlers.

### External Verification — Round 2

**Findings:** 1 Major, 2 Minor.

Major: relative markdown links rendered as clickable `<a>` with no neutralization mechanism despite epic requiring "rendered as text." Minors: Mermaid detection path inconsistency (.mermaid-placeholder vs code.language-mermaid), module count bookkeeping stale.

All 3 fixed. Relative links handled by default preventDefault() in click interceptor.

### External Verification — Round 3

**Findings:** None. All R2 fixes verified, no regressions.

**Verdict:** Codex signed off — **Approved for Story Publishing.**

**Verification artifacts:**
- `verification/codex/td-review-r1.md` — initial review (8 findings)
- `verification/codex/td-review-r2.md` — re-review (3 findings)
- `verification/codex/td-review-r3.md` — final sign-off (approved)

**Round count:** 3 rounds. Pattern similar to epic phase: R1 caught real code-verified issues (renderer parity), R2 caught incomplete link handling from R1 fix, R3 confirmed clean.

### Human Review

**Human verdict:** Accepted based on verification results. No additional review requested.

**Phase 2 complete.** 3 verification rounds, 11 total findings (all resolved). The most valuable catches were the final-render sequencing race and the renderer parity drift verified against actual source code.

---

## Phase 3: Publish Epic — Epic 11 (Chat Rendering and Polish)

### Publisher Launch

**Teammate:** `publisher` (Opus, general-purpose, bypassPermissions)

**Reading journey (3 docs, sequential with reflection):**
1. Epic 11 epic → ACs, TCs, flows, recommended story breakdown
2. Epic 11 tech-design → chunk breakdown, module responsibilities, technical guidance per story
3. Epic 11 test-plan → TC-to-test mappings, chunk boundaries

**Skill loaded last:** `ls-publish-epic`

**Outcome:** 5 story files + coverage artifact. All 82 TCs exact wording match, no paraphrasing. 27 ACs covered, 92 estimated tests. No business epic (not requested).

**Stories:**
- Story 0: Foundation (types, debounce, CSS, sanitization, fixtures) — 10 tests
- Story 1: Streaming Markdown Rendering (pipeline, debounce cycle, incremental DOM) — 28 tests
- Story 2: Partial Construct Handling + Mermaid (degradation, mid-stream diagrams, theme) — 16 tests
- Story 3: Scroll Behavior + Keyboard Shortcuts (auto-scroll, Enter/Escape/Cmd+J) — 19 tests
- Story 4: UI Polish + Panel Toggle + Error Handling (transitions, persistence, fallbacks, isolation) — 19 tests

### External Verification — Round 1

**Model:** Codex (gpt-5.4, high reasoning)
**Session ID:** `019d1d7c-9bb0-7e61-ab46-530c7ebe9d41`

**Findings:** 0 Critical, 1 Major, 2 Minor. TC fidelity and completeness passed clean (all 82 TCs exact match).

Major: TC-5.4c (panel toggle tooltip) owned by Story 3 but toggle controls are in Story 4 — sequencing gap. Minors: coverage artifact theme-switch path cited wrong TC/story; shorthand TC ranges instead of literal IDs.

All 3 fixed. TC-5.4c moved to Story 4 with cross-references.

### External Verification — Round 2

**Findings:** 0 Critical, 0 Major, 1 Minor. Story 3 scope/design/DoD text still referenced toggle tooltip after TC move.

Fixed: 4 stale references cleaned.

### External Verification — Round 3

**Findings:** None. Fix verified, no regressions.

**Verdict:** Codex signed off — **Approved.**

**Verification artifacts:**
- `verification/codex/publish-review-r1.md` — initial review (3 findings)
- `verification/codex/publish-review-r2.md` — re-review (1 finding)
- `verification/codex/publish-review-r3.md` — final sign-off

**Round count:** 3 rounds. Clean TC fidelity from R1. Issues were story coherence (TC ownership) and coverage artifact accuracy — typical for publish phase.

### Human Review

**Status:** Stories presented to human for spot-check.

**Human verdict:** Accepted (implicit — human said "continue" past tech design with no additional review gate).

**Phase 3 complete.**

---

## Final Verification

All three phases complete. Spec pipeline for Epic 11 is done.
