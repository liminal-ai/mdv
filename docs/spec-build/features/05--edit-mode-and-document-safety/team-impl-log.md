# Epic 5 Implementation Log

## State

**state:** `BETWEEN_STORIES`
**cli:** codex-subagent
**cli-model:** gpt-5.4
**team:** epic-5-impl
**cli-verified:** yes (session 019d1049-f911-7721-907f-6552c9d9369c)

## Baseline

- **Tests:** 45 files, 510 passing
- **HEAD:** fa94239
- **Expected after Epic 5:** ~611 tests (510 + 101)

## Verification Gates

- **Story acceptance gate:** `cd /Users/leemoore/code/md-viewer/app && npm run verify`
- **Epic acceptance gate:** `cd /Users/leemoore/code/md-viewer/app && npm run verify-all`

## Story Sequence

Chunk dependencies determine execution order:

```
Story 0 (Foundation / Chunk 0)
    |
    v
Story 1 (Mode Switching + Default Mode / Chunk 2 partial)
    |
    v
Story 2 (Edit Mode Editor / Chunk 2)
    |
    v
Story 3 (Save, Save As, Dirty State / Chunks 1+3)
    |
    +-----------------+-----------------+
    v                 v                 v
Story 4 (Unsaved)  Story 5 (Conflict)  Story 6 (Insert + Cross-Epic)
```

**Execution order:** 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6

Stories 4, 5, 6 are independent after Story 3. Chunks 4/5/6 can run in parallel but we execute sequentially for orchestration simplicity.

**Note on chunk-story mapping:** The test plan defines chunks (infrastructure, server, client-mode, save, unsaved, conflict, insert) that don't map 1:1 to stories. Stories are the orchestration unit. Each story's test expectations are derived from the chunk breakdown:

| Story | Chunk(s) | Expected New Tests | Running Total |
|-------|----------|-------------------|---------------|
| 0 | Chunk 0 | 0 (types, fixtures) | 510 |
| 1 | Chunk 2 partial (mode switching) | 13 | 523 |
| 2 | Chunk 2 (editor) | 11 | 534 |
| 3 | Chunks 1+3 (server save + client save/dirty) | 43 (20 server + 23 client) | 577 |
| 4 | Chunk 4 (unsaved modal) | 12 | 589 |
| 5 | Chunk 5 (conflict modal) | 10 | 599 |
| 6 | Chunk 6 (insert + cross-epic) | 12 | 611 |

## Boundary Inventory

| Boundary | Status | Story |
|----------|--------|-------|
| Filesystem write (atomic temp+rename) | not started | 3 (PUT /api/file) |
| POST /api/render (render from content) | not started | 1 (render unsaved edits) |
| POST /api/save-dialog (consolidated) | not started | 3 (Save As) |
| osascript (save dialog — existing from E4) | existing | 3 (reused) |
| CodeMirror 6 (in-process library) | not started | 2 (editor component) |
| beforeunload (browser quit protection) | not started | 4 |
| WebSocket file-change suppression (savePending) | not started | 3 |

## Artifacts

- **Epic:** `docs/spec-build/features/05--edit-mode-and-document-safety/epic.md`
- **Tech design (index):** `docs/spec-build/features/05--edit-mode-and-document-safety/tech-design.md`
- **Tech design (API):** `docs/spec-build/features/05--edit-mode-and-document-safety/tech-design-api.md`
- **Tech design (UI):** `docs/spec-build/features/05--edit-mode-and-document-safety/tech-design-ui.md`
- **Test plan:** `docs/spec-build/features/05--edit-mode-and-document-safety/test-plan.md`
- **Stories:** `docs/spec-build/features/05--edit-mode-and-document-safety/stories/story-0-foundation.md` through `story-6-...`
- **Coverage:** `docs/spec-build/features/05--edit-mode-and-document-safety/stories/coverage-and-traceability.md`
- **Implementation prompts:** none

## Handoff Template: Implementer

```
You are implementing a story for Epic 5: Edit Mode and Document Safety.

**CRITICAL: You are a supervisory layer over a Codex subagent. You do NOT implement directly.**

Step 1 — Load skill:
  Use the Skill tool: Skill(codex-subagent)
  If this fails, report the exact error. Do not skip it. Do not implement yourself.

Step 2 — Read artifacts sequentially with reflection after EACH read:
  Read each file one at a time. After reading each file, stop and reflect on what you
  learned before reading the next. Write your reflections as you go — these become
  compressed context that persists with strong attention weight throughout your work.

  1. docs/spec-build/features/05--edit-mode-and-document-safety/tech-design.md
     Read. Reflect: what are the key architectural decisions, vocabulary, and cross-cutting patterns?
  2. [primary tech design companion for this story — API or UI]
     Read. Reflect: what interfaces, data contracts, and design constraints are relevant?
  3. docs/spec-build/features/05--edit-mode-and-document-safety/epic.md
     Read. Reflect: how does this story fit in the broader feature? What are upstream/downstream dependencies?
  4. docs/spec-build/features/05--edit-mode-and-document-safety/test-plan.md
     Read. Reflect: what testing patterns, mock strategy, and coverage expectations apply?
  5. [story file]
     Read. Reflect: what are the ACs, TCs, and any spec deviations or gotchas to flag?

  Write your cumulative reflections to /tmp/reflection-story-N.md before touching code.

Step 3 — Write a CLI prompt and launch:
  Write a lean, execution-oriented prompt with all artifact paths. Include:
  - The working directory: /Users/leemoore/code/md-viewer
  - All relevant artifact paths for the CLI to read
  - The TDD methodology: skeleton -> red (tests fail) -> green (tests pass)
  - The verification command: cd /Users/leemoore/code/md-viewer/app && npm run verify
  - Explicit instruction to NOT break existing tests (baseline: {TEST_COUNT} tests passing)
  Give the CLI the same sequential reading and per-file reflection instructions.
  Use gpt-5.4. Launch async. Wait for completion.

Step 4 — Self-review loop:
  Tell the CLI to do a thorough critical self-review of its implementation against the
  story's ACs and TCs. Fix non-controversial issues. If substantive changes, iterate.
  Continue until clean or nits only. Then independently verify remaining open issues yourself.

Step 5 — Report to orchestrator (SEND THIS MESSAGE):
  - What was built (files created/modified)
  - Test counts and verification results (run the story gate yourself:
    cd /Users/leemoore/code/md-viewer/app && npm run verify)
  - CLI session ID(s)
  - What was found and fixed across self-review rounds
  - What remains open with reasoning
  - Any concerns or spec deviations
```

## Handoff Template: Reviewer

```
You are reviewing a story implementation for Epic 5: Edit Mode and Document Safety.
You MUST use a Codex CLI subagent for spec-compliance review. This is not optional.

Step 1 — Load skill:
  Use the Skill tool: Skill(codex-subagent)
  If this fails, report the exact error. Do not skip it. Do not review without CLI.

Step 2 — Read artifacts sequentially with reflection after EACH read:
  Read each file one at a time. After each file, stop and reflect on what you learned
  before reading the next. Include the story as the final read.

  1. docs/spec-build/features/05--edit-mode-and-document-safety/tech-design.md
  2. [primary tech design companion — API or UI]
  3. docs/spec-build/features/05--edit-mode-and-document-safety/epic.md
  4. docs/spec-build/features/05--edit-mode-and-document-safety/test-plan.md
  5. [story file]

  Write cumulative reflections to /tmp/reflection-review-story-N.md before starting review.

Step 3 — Dual review (parallel):
  A. Launch Codex CLI for spec-compliance review. Give it artifact paths and instruct:
     thorough code review against spec, organize by severity, check AC/TC coverage.
     Working directory: /Users/leemoore/code/md-viewer
     Use gpt-5.4. Launch async.
  B. While CLI reviews, do your own architectural review independently.
     Focus on: interface compliance, cross-cutting pattern adherence, test quality,
     edge cases, naming consistency with existing codebase.

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
  - What remains open with dispositions (fixed / accepted-risk / defer)
  - Final story gate result (cd /Users/leemoore/code/md-viewer/app && npm run verify)
  - "What else did you notice but did not report?"
```

## Story Checkpoints

### Story 0: Foundation — ACCEPTED

**Risk tier:** low
**Commit:** 09867f9
**CLI evidence:** Implementation session 019d105f-529a-7362-87ce-38107711da36, review session 019d1068-0054-7bd1-95e9-093e61aa1fa8
**Gate:** `npm run verify` — 510/510 PASS
**Cumulative tests:** 510 (no new tests expected for Story 0)

**Findings and dispositions:**
| Finding | Severity | Disposition |
|---------|----------|-------------|
| ConflictError message simpler than spec | Minor | accepted-risk — properties carry data |
| TabState edit fields optional (spec shows required) | Minor | accepted-risk — backward compat, tighten in Story 1-2 |
| Render stub uses READ_ERROR code | Minor | accepted-risk — temporary 501 stub |
| Export save-dialog not yet consolidated | Minor | defer — by design, Story 3 |

**Open risks:** none

**Observations:** Clean infrastructure delivery. The story-vs-tech-design discrepancy on save-dialog path (`/api/file/save-dialog` in story vs `/api/save-dialog` in tech design) was correctly resolved in favor of the tech design. CodeMirror deps (7 packages) installed and in package.json. Session test updated for new defaultOpenMode validation. No surprises.

**Process correction:** Orchestrator halted after Story 0 acceptance to ask "ready?" when nothing was blocking. This wastes time. At story transitions with no issues, reload the skill and continue immediately. Only stop for genuine issues or escalations.

**Next:** Story 1 — Mode Switching and Default Mode. Expected +13 tests, target 523 total. RELOAD SKILL BEFORE STARTING.

### Story 1: Mode Switching and Default Mode — ACCEPTED

**Risk tier:** medium
**Commit:** ebdad75
**CLI evidence:** Implementation session 019d107c-4049-7be0-a4e5-d5cec7e80f87, review session 019d108f-0c36-7a62-a986-abd6149b1200
**Gate:** `npm run verify` — 523/523 PASS
**Cumulative tests:** 523 (+13 new in mode-switching.test.ts)

**Findings and dispositions:**
| Finding | Severity | Disposition |
|---------|----------|-------------|
| renderGeneration not bumped on toggleMode | Minor | accepted-risk — low practical impact, address in Story 2 |
| editScrollPosition not saved before editor destroy | Minor | defer to Story 2 (editor is skeleton) |
| TC-1.1e no DOM assertion for render result | Minor | accepted-risk — implementation verified correct |
| content-area dirty check is per-keystroke not debounced | Minor | defer to Story 3 (dirty state scope) |

**Open risks:** none blocking

**Observations:** Clean implementation. POST /api/render route is now functional (was 501 stub). Editor skeleton matches tech-design API exactly. Content-area uses a `lastRenderedDirtyContent` deduplication map not in the tech design — good optimization. The reviewer's CLI flagged 5 "Major" items; independent assessment downgraded all to minor/accepted. One was a false positive (TC-7.1d flash — code path structurally prevents it). Two items deferred to Story 2 where they naturally belong.

**Boundary inventory update:**
| Boundary | Status | Change |
|----------|--------|--------|
| POST /api/render | integrated | Was stub, now functional |

**Next:** Story 2 — Edit Mode Editor. Expected +11 tests, target 534 total. RELOAD SKILL BEFORE STARTING.
