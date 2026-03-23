# Epic 7: E2E Testing Framework — Implementation Log

## State

**state:** `PRE_EPIC_VERIFY`
**all_stories_accepted:** Stories 0-4 complete
**cli:** codex-subagent (codex-cli v0.116.0, gpt-5.4)
**cli_verified:** 2026-03-23, simple prompt test passed

## Story Sequence

| Story | Title | Risk | Depends On | Status |
|-------|-------|------|------------|--------|
| Story 0 | E2E Infrastructure Foundation | High | — | **Accepted** (9752f9b) |
| Story 1 | Workspace Browsing and File Opening | Medium | Story 0 | **Accepted** (8a29075) |
| Story 2 | Rendering and Mermaid | Medium | Story 1 | **Accepted** (28b8f5c) |
| Story 3 | Tabs, Editing, and Export | Medium | Story 1 | **Accepted** (58ed7db) |
| Story 4 | Theme, Session Persistence, and File Watching | Medium | Story 1 | **Accepted** (1b5c6ad) |

## Verification Gates

**Story acceptance gate:**
```bash
cd /Users/leemoore/code/md-viewer/app && npm run verify
```
Components: `format:check` + `lint` + `typecheck` + `typecheck:client` + `test` (Vitest)

**Epic acceptance gate:**
```bash
cd /Users/leemoore/code/md-viewer/app && npm run verify && npm run build && npm run test:e2e
```
Note: `test:e2e` does not exist yet — Story 0 creates it. Epic gate only applies after Story 0.

## Artifacts

- **Stories:** `docs/spec-build/v2/epics/07--e2e-testing-framework/stories.md`
- **Epic:** `docs/spec-build/v2/epics/07--e2e-testing-framework/epic.md`
- **Tech Design:** `docs/spec-build/v2/epics/07--e2e-testing-framework/tech-design.md`
- **Business Epic:** `docs/spec-build/v2/epics/07--e2e-testing-framework/business-epic.md`
- **PRD:** `docs/spec-build/v2/prd.md`
- **Tech Architecture:** `docs/spec-build/v2/technical-architecture.md`
- **Implementation prompts:** None found

## Boundary Inventory

No external service dependencies. This epic only exercises the existing v1 API surface with Playwright. All boundaries are internal.

| Boundary | Status | Story |
|----------|--------|-------|
| v1 Fastify API | existing/stable | All |
| Playwright (new dep) | not installed | 0 |

## Cumulative Test Count

- **Baseline (v1):** ~70 Vitest tests
- **After Story 0:** TBD (~70 Vitest + smoke E2E)
- **After Story 1:** TBD
- **After Story 2:** TBD
- **After Story 3:** TBD
- **After Story 4:** TBD

## Handoff Templates

### Implementer Template

```
You are implementing a story. You are a supervisory layer over a CLI subagent. You do NOT implement directly.

Step 1 — Load skill:
  Use the Skill tool: Skill(codex-subagent)
  If this fails, report the exact error. Do not skip it. Do not implement yourself.

Step 2 — Read artifacts sequentially, reflecting after each one:
  Read each file one at a time. After reading each file, stop and reflect on what you
  learned before reading the next. Write your reflections as you go — these become
  compressed context that persists with strong attention weight throughout your work.

  1. Tech Design: docs/spec-build/v2/epics/07--e2e-testing-framework/tech-design.md
     Reflect: what are the key architectural decisions, interfaces, and cross-cutting patterns?
  2. Epic: docs/spec-build/v2/epics/07--e2e-testing-framework/epic.md
     Reflect: how does this story fit in the broader feature? Upstream/downstream dependencies?
  3. Story (specific story section from stories.md)
     Reflect: what are the ACs, TCs, and any spec deviations or gotchas to flag?

  Write your cumulative reflections to /tmp/reflection-story-N.md before touching code.

Step 3 — Write a CLI prompt and launch:
  Write a lean, execution-oriented prompt with artifact paths.
  Give the CLI the same sequential reading and per-file reflection instructions.
  Use gpt-5.4. Launch async. Wait for completion.
  Working directory: /Users/leemoore/code/md-viewer

Step 4 — Self-review loop:
  Tell the CLI to do a thorough critical self-review. Fix non-controversial issues.
  If substantive changes, iterate. Continue until clean or nits only.
  Then independently verify remaining open issues yourself.

Step 5 — Report to orchestrator (SEND THIS MESSAGE):
  - What was built (files created/modified)
  - Test counts and verification results (run the story gate yourself)
  - CLI session ID(s)
  - What was found and fixed across self-review rounds
  - What remains open with reasoning
  - Any concerns or spec deviations
```

### Reviewer Template

```
You are reviewing a story implementation. You MUST use a CLI subagent for spec-compliance review. This is not optional.

Step 1 — Load skill:
  Use the Skill tool: Skill(codex-subagent)
  If this fails, report the exact error. Do not skip it. Do not review without CLI.

Step 2 — Read artifacts sequentially, reflecting after each one (same as implementer):
  Read each file one at a time. After each file, stop and reflect on what you learned
  before reading the next. Include the story as the final read. Write cumulative
  reflections to /tmp/reflection-review-story-N.md before starting the review.

  1. Tech Design: docs/spec-build/v2/epics/07--e2e-testing-framework/tech-design.md
  2. Epic: docs/spec-build/v2/epics/07--e2e-testing-framework/epic.md
  3. Story (specific story section from stories.md)

Step 3 — Dual review (parallel):
  A. Launch CLI for spec-compliance review. Give it artifact paths and instruct:
     thorough code review against spec, organize by severity, check AC/TC coverage.
     Working directory: /Users/leemoore/code/md-viewer
     Use gpt-5.4. Launch async.
  B. While CLI reviews, do your own architectural review independently.

Step 4 — Consolidate:
  Read CLI review output. Merge both sets of findings.
  Verify claims against actual code.
  Compile consolidated fix list.
  Launch CLI to implement fixes. Have it self-review after fixing.

Step 5 — Report to orchestrator (SEND THIS MESSAGE):
  - CLI review session ID(s)
  - Your own review findings
  - CLI findings
  - What was fixed
  - What remains open with dispositions
  - Final story gate result (run: cd /Users/leemoore/code/md-viewer/app && npm run verify)
  - "What else did you notice but did not report?"
```

---

## Story Logs

### Story 0: E2E Infrastructure Foundation

**Status:** Accepted and committed (9752f9b)
**Commit:** `feat: Story 0 — E2E infrastructure foundation`

**Pre-acceptance receipt:**
- CLI evidence: Codex session `019d1832-1de2-79f3-94da-7a7fc6ad9d7f` (implementation, stalled — completed by teammate directly), Codex session `019d1847-1d1f-7011-bba4-19acad6ba38a` (review + fixes)
- Story gate: `npm run verify` PASS (710/710 Vitest), `npm run test:e2e` PASS (3/3)
- Top findings: 3 issues (Critical: malformed fixture markdown, Major: weak assertions using toBeAttached, Major: expandDirectory missing child wait). All fixed.
- Dispositions: All `fixed`. Two `accepted-risk` items (expandDirectory count check, STATE_PATH export).
- Open risks: Pre-existing intermittent Vitest flakiness on PDF export / syntax highlighting tests (not related to our changes).

**Process note:** The Codex CLI stalled during implementation, so the implementer teammate completed the work directly. This is a control contract deviation — the implementer should be a supervisory layer. For Story 0 (infrastructure/config), this is lower risk. The reviewer successfully used Codex for dual verification, which is the more critical external model check. For Story 1+, the implementer must use Codex end-to-end.

**Cumulative test count:** 710 Vitest + 3 E2E = 713 total
**After Story 0:** baseline + infrastructure. Expected after Story 1: +5 tests (TC-2.2a-c, TC-2.3a-b mapped to navigation.spec.ts)

### Story 1: Workspace Browsing and File Opening

**Status:** Accepted and committed (8a29075)
**Commit:** `feat: Story 1 — Workspace browsing and file opening E2E tests`

**Pre-acceptance receipt:**
- CLI evidence: Codex session `019d1855-2c4c-7272-ab07-c4431a3e9a13` (implementation), Codex session `019d185a-d47b-78b1-8652-5b594e4e6319` (review)
- Story gate: `npm run verify` PASS (710/710 Vitest), `npm run test:e2e` PASS (8/8)
- Top findings: 2 P3 observations (TC-2.2b scope, expandDirectory +1 count). Both `accepted-risk` — deterministic fixtures make these non-issues.
- Open risks: None.

**Process note:** Codex CLI used end-to-end for both implementation and review — control contract fully satisfied. Clean story, no deviations.

**Cumulative test count:** 710 Vitest + 8 E2E = 718 total
**After Story 1:** Expected after Story 2: +7 tests (TC-3.1a through TC-3.6a mapped to rendering.spec.ts)

### Story 2: Rendering and Mermaid

**Status:** Accepted and committed (28b8f5c)
**Commit:** `feat: Story 2 — Rendering and Mermaid E2E tests`

**Pre-acceptance receipt:**
- CLI evidence: Codex session `019d1861-eaca-7fd1-bc85-653fbbc9932d` (implementation), Codex session `019d186a-6c89-7a12-accd-1a0c9d431509` (review)
- Story gate: `npm run verify` PASS (710/710 Vitest — intermittent flakiness on first run, clean on re-run, pre-existing), `npm run test:e2e` PASS (15/15)
- Top findings: 2 P2 items (Shiki style assertion gap, relative link not tested). Both fixed by senior-engineer subagent.
- Open risks: Pre-existing Vitest flakiness (same as Story 0 — not related to our changes).

**Cumulative test count:** 710 Vitest + 15 E2E = 725 total
**After Story 2:** Expected after Story 3: +12 tests (TC-4.1a-b, TC-4.2a, TC-4.3a-b, TC-5.1a-b, TC-5.2a-c, TC-6.1a-b mapped to interaction.spec.ts)

### Story 3: Tabs, Editing, and Export

**Status:** Accepted and committed (58ed7db)
**Commit:** `feat: Story 3 — Tabs, editing, and export E2E tests`

**Pre-acceptance receipt:**
- CLI evidence: Codex session `019d1877-9dcc-7c02-afad-636d39b1f26d` (implementation), Codex session `019d1886-bcdb-7102-ab23-75d124945737` (review)
- Story gate: `npm run verify` PASS (710/710 Vitest), `npm run test:e2e` PASS (27/27)
- Top findings: 1 P2 fixed (TC-4.3a missing content assertion), 1 P2 accepted-risk (.dirty-indicator vs .tab__dirty-dot — story spec chose tab dot). Reviewer fix introduced text mismatch ("Invalid Mermaid" vs "Broken Mermaid") caught by orchestrator gate — fixed by senior-engineer subagent.
- Open risks: None.

**Notable:** E2E testing discovered a real app bug — saving in edit mode didn't refresh the tab's rendered HTML. Fixed in app/src/client/app.ts. This validates the epic's purpose.

**Cumulative test count:** 710 Vitest + 27 E2E = 737 total
**After Story 3:** Expected after Story 4: +7 tests (TC-7.1a-b, TC-7.2a, TC-8.1a, TC-8.2a, TC-9.1a-b mapped to persistence.spec.ts). Story 4 is the LAST story — after acceptance, proceed to PRE_EPIC_VERIFY.

### Story 4: Theme, Session Persistence, and File Watching

**Status:** Accepted and committed (1b5c6ad)
**Commit:** `feat: Story 4 — Theme, session persistence, and file watching E2E tests`

**Pre-acceptance receipt:**
- CLI evidence: Codex session `019d1895-48ed-75c3-ad61-97dbcdc0df78` (implementation), Codex session `019d18a1-c858-74d2-9e7e-70d417a05b7c` (review)
- Story gate: `npm run verify` PASS (710/710 Vitest — 1 intermittent failure on first run, clean on re-run, pre-existing), `npm run test:e2e` PASS (34/34)
- Top findings: 3 P3 observations (spec text mismatch, port reuse assumption, dual server overlap). All `accepted-risk`.
- Open risks: None.

**Cumulative test count:** 710 Vitest + 34 E2E = 744 total

## Pre-Verification Cleanup

All stories accepted. Compiling deferred and accepted-risk items across all stories for review.
