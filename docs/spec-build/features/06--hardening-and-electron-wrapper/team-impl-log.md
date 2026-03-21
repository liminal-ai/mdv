# Epic 6 Implementation Log

## State

**state:** `BETWEEN_STORIES`
**cli:** codex-subagent
**cli-model:** gpt-5.4
**team:** epic-6-impl
**cli-verified:** yes (session 019d1256-9462-7090-a4d5-28aa5f5f7e7c)

## Baseline

- **Tests:** 56 files, 613 passing, 7 pre-existing failures (root-line, workspaces, app — from styling commit 077c89d)
- **HEAD:** f44b786
- **Expected after Epic 6:** ~698 tests (613 + 85)

## Verification Gates

- **Story acceptance gate:** `cd /Users/leemoore/code/md-viewer/app && npm run verify`
- **Epic acceptance gate:** `cd /Users/leemoore/code/md-viewer/app && npm run verify-all`

Note: `verify-all` currently aliases `verify`. The test plan specifies adding `test:electron` to `verify-all` — this will be done in Story 0 (Foundation).

## Pre-existing Test Failures

7 tests fail on clean HEAD (f44b786), all from styling commit 077c89d:
- `tests/client/app.test.ts`: TC-10.1a (permission denied), TC-10.2a (deleted root)
- `tests/client/components/root-line.test.ts`: TC-4.3a (pin), TC-4.4a (copy), TC-4.5a (refresh), TC-4.6a (hover)
- `tests/client/components/workspaces.test.ts`: TC-3.2a (workspace label)

These must be fixed in Story 0 before implementation begins, so verification gates pass cleanly.

## Story Sequence

Stories map to chunks with dependencies:

```
Story 0 (Foundation / Chunk 0)
    ↓
Story 1 (Large File Rendering / Chunk 2 partial — chunked render)
    ↓
Story 2 (File Tree + Startup / Chunk 1 + Chunk 2 partial — server hardening + virtual tree)
    ↓
Story 3 (Many-Tab + Mermaid Cache / Chunk 2 partial + Chunk 3 partial)
    ↓
Story 4 (Tab State Persistence / Chunk 3 partial)
    ↓
Story 5 (Electron Shell + Window / Chunk 4)
    ↓
Story 6 (Native Menu Bar + Quit Flow / Chunk 5)
    ↓
Story 7 (File Associations + Packaging / Chunk 6)
```

**Dependency chain:**
- Stories 1-4: Performance hardening (browser-side). Stories 1 and 2 can partially parallelize but are sequenced for clean commits.
- Story 4 depends on Story 0's schema migration being in place.
- Story 5 depends on Story 4 (tab persistence must exist before Electron wraps the app).
- Stories 6-7 depend on Story 5 (Electron shell must exist before menus and packaging).

**Risk assessment:**
- Stories 0-3: **low** — browser-side performance work, well-specified
- Story 4: **low** — schema migration and tab restore, infrastructure already exists
- Story 5: **high** — Electron integration, new runtime mode, first time adding Electron to this project
- Story 6: **medium** — native menus and IPC, depends on Story 5 being solid
- Story 7: **medium** — packaging, file associations, install script — depends on real macOS environment

## Boundary Inventory

| Boundary | Status | Story | Notes |
|----------|--------|-------|-------|
| Electron runtime (BrowserWindow, Menu, app, ipcMain) | not started | 5 | First Electron code in the project |
| electron-builder packaging | not started | 7 | Build tool, config only |
| electron-window-state | not started | 5 | CJS-only, needs createRequire interop |
| Fastify startServer() injection | integrated | 5 | Already exists from Epic 1 — Electron calls it with openUrl noop |
| SessionService tab persistence | integrated | 0, 4 | Infrastructure exists from Epics 2-5, schema extended in Story 0 |
| Mermaid.js render cache | not started | 3 | Client-side, no external boundary |
| CodeMirror 6 (large file editing) | integrated | 1 | Already virtualizes — verify, don't re-implement |
| macOS Launch Services (file associations) | not started | 7 | Requires real macOS environment for verification |

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

  1. tech-design.md (index + decisions) — Read. Reflect: what are the key
     architectural decisions, vocabulary, and cross-cutting patterns?
  2. tech-design-ui.md OR tech-design-api.md (companion for this story) — Read.
     Reflect: what interfaces, data contracts, and design constraints are relevant?
  3. epic.md — Read. Reflect: how does this story fit in the broader feature? What are
     the upstream/downstream dependencies?
  4. test-plan.md — Read. Reflect: what testing patterns and coverage expectations
     apply?
  5. The story file — Read. Reflect: what are the ACs, TCs, and any spec deviations
     or gotchas to flag?

  Write your cumulative reflections to /tmp/reflection-story-N.md before touching code.

Step 3 — Write a CLI prompt and launch:
  Write a lean, execution-oriented prompt with artifact paths.
  Give the CLI the same sequential reading and per-file reflection instructions.
  Working directory: /Users/leemoore/code/md-viewer/app
  Use gpt-5.4. Launch async. Wait for completion.

Step 4 — Self-review loop:
  Tell the CLI to do a thorough critical self-review. Fix non-controversial issues.
  If substantive changes, iterate. Continue until clean or nits only.
  Then independently verify remaining open issues yourself.

Step 5 — Report to orchestrator (SEND THIS MESSAGE):
  - What was built (files created/modified)
  - Test counts and verification results (run the story gate yourself:
    cd /Users/leemoore/code/md-viewer/app && npm run verify)
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

  Artifact paths (base: /Users/leemoore/code/md-viewer/docs/spec-build/features/06--hardening-and-electron-wrapper/):
  1. tech-design.md
  2. tech-design-ui.md / tech-design-api.md (as relevant for the story)
  3. epic.md
  4. test-plan.md
  5. The story file

Step 3 — Dual review (parallel):
  A. Launch CLI for spec-compliance review. Give it artifact paths and instruct:
     thorough code review against spec, organize by severity, check AC/TC coverage.
     Working directory: /Users/leemoore/code/md-viewer/app
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
  - Final story gate result (cd /Users/leemoore/code/md-viewer/app && npm run verify)
  - "What else did you notice but did not report?"
```

## Story Log

(Stories will be logged below as they are implemented.)
