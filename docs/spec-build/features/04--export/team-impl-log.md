# Epic 4 Implementation Log

## State

**state:** `COMPLETE`
**cli:** codex-subagent
**cli-model:** gpt-5.4
**team:** epic-3-impl (reused from Epic 3)

## Baseline

- **Tests:** 33 files, 389 passing
- **HEAD:** 8404f22
- **Expected after Epic 4:** ~496 tests (389 + 107)

## Verification Gates

- **Story acceptance gate:** `cd /Users/leemoore/code/md-viewer/app && npm run verify`
- **Epic acceptance gate:** `cd /Users/leemoore/code/md-viewer/app && npm run verify-all`

## Story Sequence

Chunk dependencies determine execution order:

```
Story 0 (Foundation / Chunk 0)
    │
    ▼
Story 1 (Export Trigger + Save Dialog / Chunk 1)
    │
    ▼
Story 2 (Export Pipeline + Progress/Results / Chunk 2)
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
Story 3 (PDF/Chunk3) Story 4 (DOCX/Chunk4) Story 5 (HTML/Chunk5)
                                           │
                                           ▼
                                     Story 6 (Fidelity/Chunk5 cont.)
```

**Execution order:** 0 → 1 → 2 → 3 → 4 → 5 → 6

Stories 3, 4, 5 are independent (different format engines) but executed sequentially. Story 6 tests cross-format fidelity and depends on all formats being implemented.

## Boundary Inventory

| Boundary | Status | Story |
|----------|--------|-------|
| Puppeteer (Chrome, server-side) | not started | 0 (dep), 2 (Mermaid SSR), 3 (PDF gen) |
| @turbodocx/html-to-docx (npm) | not started | 0 (dep), 4 (DOCX gen) |
| @resvg/resvg-js (npm, SVG→PNG) | not started | 0 (dep), 4 (DOCX images) |
| osascript (save dialog) | existing (Epic 1) | 1 (export save dialog) |
| open -R (Finder reveal) | not started | 2 (reveal) |
| Filesystem (write output) | existing | 2+ (write exports) |

## Artifacts

- **Epic:** `docs/spec-build/features/04--export/epic.md`
- **Tech design (index):** `docs/spec-build/features/04--export/tech-design.md`
- **Tech design (API):** `docs/spec-build/features/04--export/tech-design-api.md`
- **Tech design (UI):** `docs/spec-build/features/04--export/tech-design-ui.md`
- **Test plan:** `docs/spec-build/features/04--export/test-plan.md`
- **Stories:** stories/story-0 through story-6
- **Coverage:** stories/coverage-and-traceability.md
- **Implementation prompts:** none

## Handoff Template: Implementer

```
You are implementing a story for Epic 4: Export.

**CRITICAL: You are a supervisory layer over a Codex subagent. You do NOT implement directly.**

Step 1 — Load skill:
  Use the Skill tool: Skill(codex-subagent)
  If this fails, report the exact error. Do not skip it. Do not implement yourself.

Step 2 — Read artifacts sequentially with reflection after EACH read:

  Read EACH file one at a time. After EVERY SINGLE read, STOP and reflect:
  - What did I just learn?
  - How does it connect to what I read before?
  - What architectural decisions or patterns matter for this story?
  Write each reflection to /tmp/reflection-story-N.md (append after each read).

  Order:
  1. /Users/leemoore/code/md-viewer/docs/spec-build/features/04--export/tech-design.md — REFLECT.
  2. /Users/leemoore/code/md-viewer/docs/spec-build/features/04--export/tech-design-api.md — REFLECT.
  3. /Users/leemoore/code/md-viewer/docs/spec-build/features/04--export/tech-design-ui.md — REFLECT.
  4. /Users/leemoore/code/md-viewer/docs/spec-build/features/04--export/epic.md — REFLECT.
  5. /Users/leemoore/code/md-viewer/docs/spec-build/features/04--export/test-plan.md — REFLECT.

Step 3 — Synthesis checkpoint:
  STOP. Before reading the story, write a final synthesis to /tmp/reflection-story-N.md.

Step 4 — Read the story:
  [STORY PATH]

Step 5 — Write a Codex prompt and launch:
  Working directory: /Users/leemoore/code/md-viewer/app
  Launch: cd /Users/leemoore/code/md-viewer/app && codex exec --json "prompt" > /tmp/codex-story-N-impl.jsonl 2>/dev/null
  Use run_in_background on the Bash tool. Wait for completion.

Step 6 — Self-review loop:
  Read Codex output: codex-result last /tmp/codex-story-N-impl.jsonl
  Get session ID: codex-result session-id /tmp/codex-story-N-impl.jsonl
  Resume for self-review. Iterate until clean.

Step 7 — Report to orchestrator (SEND THIS MESSAGE):
  Use SendMessage to report to the team lead:
  - What was built (files created/modified)
  - Test counts and verification results (run: cd /Users/leemoore/code/md-viewer/app && npm run verify)
  - Codex session ID(s)
  - What was found and fixed across self-review rounds
  - What remains open with reasoning
  - Any concerns or spec deviations
```

## Handoff Template: Reviewer

```
You are reviewing a story implementation for Epic 4: Export.

**CRITICAL: You MUST use a Codex subagent for spec-compliance review. This is not optional.**

Step 1 — Load skill: Skill(codex-subagent)

Step 2 — Read artifacts sequentially with reflection after EACH read (same paths as implementer).

Step 3 — Synthesis checkpoint.

Step 4 — Read the story.

Step 5 — Dual review (parallel):
  A. Launch Codex for spec-compliance review. Use run_in_background.
  B. Your own architectural review independently.

Step 6 — Consolidate. Fix if needed.

Step 7 — Report to orchestrator (SEND THIS MESSAGE):
  - Codex review session ID(s)
  - Your own review findings
  - Codex findings
  - What was fixed
  - What remains open with dispositions
  - Final: cd /Users/leemoore/code/md-viewer/app && npm run verify result
  - "What else did you notice but did not report?"
```

## Story Cycles

### Story 0: Foundation — ACCEPTED

**Risk tier:** low
**Reviewer:** skipped (infrastructure, no behavior)
**Codex evidence:** `019d0e91-e38f-7541-aa3b-92b2941d0a20`
**Gate:** 389 tests passing, red-verify clean
**Commit:** `b40ef24`
**Cumulative tests:** 389 (unchanged)
**Next:** Story 1 (Export Trigger + Save Dialog). Expected ~21 new tests → ~410 total.

### Story 1: Export Trigger and Save Dialog — ACCEPTED

**Risk tier:** medium
**Codex evidence:** impl `019d0e9e-b5b3-7bd1-9a46-2ddae964a53e`, review `019d0eaa-8b7d-75e0-ba84-c7b45bcf4713`
**Findings:** TC-1.1e Enter/Escape test gap → `accepted-risk`, content toolbar hidden in empty state → `accepted-risk` (Epic 2 design), exportBaseName .md only → `accepted-risk` (app constraint)
**Gate:** 410 tests passing, verify clean
**Commit:** `9a75262`
**Cumulative tests:** 410 (389 + 21)
**Next:** Story 2 (Export Pipeline + Progress/Results). Expected ~31 new tests → ~441 total.

### Story 2: Export Pipeline + Progress/Results — ACCEPTED

**Risk tier:** high (core pipeline, 7 new services, Puppeteer integration, UI components)
**Codex evidence:** impl `019d0eb5-25e5-76d3-b7f0-df2b504d1c83`, review `019d0ec4-6888-73e1-a981-4b352d7d95d7`
**Findings:**
- Missing title attribute for path hover → `fixed` (TC-2.2a requirement)
- Missing print CSS keep-together rules for 3 classes → `fixed`
- Generic error messages → `accepted-risk` (client knows context, avoids leaking internals)
- Warning detail shows message not type+message → `accepted-risk` (message IS the description)
- Progress indicator placement → `accepted-risk` (satisfies AC, just different layout than tech design sketch)
- Reveal fire-and-forget → `accepted-risk` (best-effort system command)
- Mermaid SSR own browser vs shared → `accepted-risk` (Story 3 can optimize)
**Gate:** 441 tests passing, verify clean
**Commit:** `c67a250`
**Cumulative tests:** 441 (410 + 31)
**Boundary update:** Puppeteer integrated (Mermaid SSR), osascript reveal integrated. PDF/DOCX/HTML services are stubs.
**Next:** Story 3 (PDF Export). Expected ~16 new tests → ~457 total.

### Story 3: PDF Export — ACCEPTED

**Risk tier:** medium
**Codex evidence:** impl `019d0ed0-fe84-7c71-8fb6-a70134d219a7`, review `019d0edd-0c94-78a1-9709-c0bfb0453cf2`
**Findings:** Missing table print CSS → `fixed`, shared browser optimization → `defer`
**Gate:** 457 tests, verify clean
**Commit:** `84e4221`
**Cumulative tests:** 457

### Story 4: DOCX Export — ACCEPTED

**Risk tier:** medium
**Codex evidence:** impl `019d0ee7-c883-7de0-8ca1-d5177e22b8f1`, review `019d0eef-1697-7d80-b826-ca847367658d`
**Findings:** Warning source 'inline-svg' vs SVG snippet → `accepted-risk`, no SVG→PNG failure test → `accepted-risk`, DOCX structural quality → `manual verification`
**Gate:** 471 tests, verify clean
**Commit:** `8fd72d0`
**Cumulative tests:** 471
**Boundary update:** @turbodocx and @resvg/resvg-js integrated (were: stubs).
**Next:** Story 5 (HTML Export). Expected ~11 new tests → ~482 total.

### Story 5: HTML Export — ACCEPTED

**Risk tier:** low (test-only)
**Codex evidence:** impl `019d0ef9-6fe1-72c1-9656-dcb99a878ab1`, review `019d0efe-74b3-71a0-9d14-a2e628f2633e`
**Findings:** Raw HTML self-containment edge case → `accepted-risk`, missing print CSS → `defer`
**Gate:** 482 tests, verify clean
**Commit:** `92752d9`
**Cumulative tests:** 482

### Story 6: Content Fidelity and Edge Cases — ACCEPTED (FINAL STORY)

**Risk tier:** medium
**Codex evidence:** impl `019d0f08-6071-77c0-a871-050012edcd5e`, review `019d0f10-2480-7fc1-8752-efe9cf10ee33`
**Findings:** summary bold transformation → `accepted-risk` (cosmetic), kbd DOCX styling → `accepted-risk` (best-effort per AC)
**Gate:** 496 tests, verify clean
**Commit:** `49861b3`
**Cumulative tests:** 496

---

## All Stories Accepted

| Story | Commit | Tests Added | Cumulative |
|-------|--------|-------------|------------|
| 0 Foundation | b40ef24 | 0 | 389 |
| 1 Export Trigger | 9a75262 | 21 | 410 |
| 2 Export Pipeline | c67a250 | 31 | 441 |
| 3 PDF Export | 84e4221 | 16 | 457 |
| 4 DOCX Export | 8fd72d0 | 14 | 471 |
| 5 HTML Export | 92752d9 | 11 | 482 |
| 6 Content Fidelity | 49861b3 | 14 | 496 |

**Total Epic 4 tests added:** 107 (matches test plan exactly)

Proceeding to Pre-Verification Cleanup, then Epic-Level Verification.

## Pre-Verification Cleanup

No actionable cleanup items — all deferred/accepted-risk items are genuinely low priority or cosmetic.

## Epic-Level Verification — PASS

- Codex session: `019d0f18-1868-7be3-b503-0e9781593677`
- 28/28 ACs verified
- Contract consistency: PASS (minor: loose client API types, warning source not truncated)
- Integration gaps: none
- Security: shell injection found and FIXED (`exec` → `execFile`), remote non-image media gap noted
- Architecture compliance: PASS (separate Puppeteer browsers deferred as optimization)

## Security Fix

- Commit: `ffba5e0` — `fix: replace exec() with execFile() in export routes`
- Fixed shell injection in save-dialog and reveal-in-Finder exec() calls

## Final State

- **Total commits:** 9 (7 stories + 1 security fix + baseline)
- **Total tests:** 496 (322 baseline + 67 Epic 3 + 107 Epic 4)
- **Epic 4: COMPLETE**

## Orchestration Experience

### Process Observations

**Epic 4 was significantly larger than Epic 3** — 7 stories vs 5, 107 tests vs 67, and the pipeline story (Story 2) was the single largest story across both epics. The orchestration process held steady throughout. No story required rollback. The skill reload between stories prevented the drift that the skill warns about for sequences of 5+ stories.

**Story 2 (Export Pipeline) was the critical path.** It created 7 new services, wired the full export pipeline, and built both client-side UI components. The Codex implementation needed more time (~15 min) but produced clean output. The reviewer found 2 legitimate fixes (title attribute for path hover, print CSS keep-together rules) — both were small but real spec gaps that the self-review missed. This validates the reviewer as a genuine second pass, not rubber-stamping.

**Format-specific stories (3-5) followed a clean pattern.** Each replaced a stub service with a real implementation + format quality tests. Story 3 (PDF) was the most complex (real Puppeteer), Story 4 (DOCX) required SVG→PNG conversion research, and Story 5 (HTML) was the simplest (no code changes needed — the Story 2 implementation was already complete). This pattern — stub in pipeline story, fill in format stories — worked well for parallelizable work that was executed sequentially.

**The two-category test strategy from the test plan was effective.** Category 1 tests (mocked externals, fast) covered pipeline orchestration in Story 2. Category 2 tests (real Puppeteer/@turbodocx, slow) covered format quality in Stories 3-5. This separation meant Story 2's 18 tests ran in <1s while Story 3's 16 tests took ~10s each. Test duration grew from 5s to 44s across the epic — all from real Puppeteer/DOCX tests. Acceptable but worth monitoring for CI.

**The shell injection finding in epic verification was the highest-value catch of the entire run.** Story-level reviews didn't flag the `exec()` calls because they were "working correctly" — the vulnerability was structural, not behavioral. The epic-level Codex review caught it because it was explicitly checking security across all export routes. This is exactly the kind of integration-level finding that per-story reviews miss.

### Patterns Across Stories

**Teammates needed nudges less frequently in Epic 4 than Epic 3.** Only 2 nudges in 7 stories (Stories 1 and 4) vs 3 nudges in 5 stories for Epic 3. The larger handoff prompts may have made the reporting instruction more salient, or the Codex sessions may have been more consistently sized.

**Test counts matched the test plan exactly (107).** Unlike Epic 3 which overshot by 7 tests, Epic 4 hit the planned number. The test plan was more granular (14 test files mapped individually) which left less room for ad-hoc additions.

**The pre-verification cleanup had no actionable items.** All 12 deferred/accepted-risk items across 7 stories were genuinely low priority — cosmetic (kbd DOCX styling, summary bold), edge-case (raw HTML self-containment), or optimization (shared Puppeteer browser). This is a sign that the story-level reviews were thorough enough to fix real issues in-flight.

**Infrastructure Story 0 was again reviewed with gate-only verification.** Same rationale as Epic 3: no behavior, no tests, verifiable by checklist. Consistent policy across both epics.

### What Worked Well

The boundary inventory was useful for tracking stub→integrated transitions. By the end of Story 4 (DOCX), all boundaries were integrated: Puppeteer (Mermaid SSR + PDF), @turbodocx, @resvg/resvg-js, osascript (save dialog + reveal). No stubs remaining at epic verification — the exact scenario the boundary inventory is designed to prevent.

The handoff templates in the log were re-read before every dispatch. The Epic 4 templates were simpler than Epic 3's (the per-file reflection was baked into the skill's updated template by then) but still served their purpose as the single source of truth.

### What Could Improve

The epic-level verification used a single Codex review teammate instead of the proper 4-verifier protocol (which was missing from the skill's appended reference section). This was caught by the user post-run. The improvised single-review still found the shell injection, but the 4-verifier cross-review protocol would provide stronger coverage and reduce single-reviewer blind spots. Both epics need retroactive proper verification.

The log accumulated duplicate story entries at the bottom (Story 3 and Story 5 appeared twice) due to an edit ordering issue during rapid story transitions. Cosmetic but indicates the log update process should be more careful during fast-paced runs.
