# Epic 7: E2E Testing Framework — Implementation Log

## State

**state:** `STORY_ACTIVE`
**active_story:** Story 0 — E2E Infrastructure Foundation
**phase:** reviewing
**cli:** codex-subagent (codex-cli v0.116.0, gpt-5.4)
**cli_verified:** 2026-03-23, simple prompt test passed

## Story Sequence

| Story | Title | Risk | Depends On | Status |
|-------|-------|------|------------|--------|
| Story 0 | E2E Infrastructure Foundation | High | — | Not started |
| Story 1 | Workspace Browsing and File Opening | Medium | Story 0 | Not started |
| Story 2 | Rendering and Mermaid | Medium | Story 1 | Not started |
| Story 3 | Tabs, Editing, and Export | Medium | Story 1 | Not started |
| Story 4 | Theme, Session Persistence, and File Watching | Medium | Story 1 | Not started |

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

(Story entries will be added as implementation proceeds)
