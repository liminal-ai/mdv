# Team Implementation Log — Epic 1: App Shell and Workspace Browsing

## Lane Determination

**Date:** 2026-03-19

Skills checked:
- `codex-subagent`: **Found** — provides access to Codex CLI with gpt-5.4 default model
- `copilot-subagent`: Found but not selected (codex-subagent preferred)
- `gpt53-codex-prompting`: Not found in available skills list
- `claude-code-subagent`: Found but not selected
- `cursor-subagent`: Found but not selected

**Selected lane:** Codex lane via `codex-subagent`

**Model defaults:** gpt-5.4 (from ~/.codex/config.toml), reasoning effort high, sandbox danger-full-access, web search live.

## Verification Gate Discovery

**Project state:** The `app/` directory is a placeholder with only a README. Story 0 will scaffold the entire project including package.json, tsconfig, and test framework. Verification gates will be confirmed after Story 0 establishes the toolchain.

**Planned story acceptance gate:**
- `npm run typecheck` — TypeScript compilation
- `npm run lint` — Linting
- `npm test` — Vitest test suite

**Planned epic acceptance gate:**
- All story gate commands
- Full test suite with no regressions

**Locked gates (confirmed after Story 0):**
- Story acceptance: `npm run typecheck && npm run lint && npm test`
- Also available: `npm run typecheck:client`, `npm run format:check`, `npm run build`
- Epic acceptance: All story gates + full test suite regression check

## Artifacts

- **Epic:** `epic.md`
- **Tech design (index):** `tech-design.md`
- **Tech design (API):** `tech-design-api.md`
- **Tech design (UI):** `tech-design-ui.md`
- **Test plan:** `test-plan.md`
- **Stories:** `stories/01-foundation.md` through `stories/08-integration-and-coverage.md`

## Story Sequence

| Story | File | Risk Tier | Dependencies |
|-------|------|-----------|--------------|
| 0 - Foundation | 01-foundation.md | low | None |
| 1 - App Shell Chrome | 02-app-shell-chrome.md | medium | Story 0 |
| 2 - Sidebar & Root Line | 03-sidebar-workspaces-and-root-line.md | medium | Story 1 |
| 3 - File Tree | 04-file-tree-browsing.md | high | Story 2 |
| 4 - Context Menus | 05-context-menus.md | low | Story 3 |
| 5 - Theme System | 06-theme-system.md | low | Story 1 |
| 6 - Session & Errors | 07-session-persistence-and-error-handling.md | medium | Stories 2, 3, 5 |

---

## Story Cycles

### Story 0: Foundation — Completed

**Commit:** `4b50ea9` — `feat: Story 0 — Foundation infrastructure`
**Test count after Story 0:** 1 (smoke test)

**Implementation:** Codex built 29 files (config, shared types, server scaffold, client HTML shell, CSS, test framework, fixtures). Self-review caught and fixed 3 issues: static plugin path resolution, esbuild missing asset copy, and shared types missing ErrorCode re-export.

**Review findings (6 fixed):** CSS variable naming deviation from tech design (`--bg-primary` → `--color-bg-primary`), Zod client bundling risk (ErrorCode moved to Zod-free module), missing FileTreeRequest schema, missing JSDOM vitest config, missing green-verify/guard scripts, missing temp dir helpers.

**Open items (accepted):** `process.cwd()` vs `import.meta.dirname` in static plugin (accepted-risk, revisited in Story 1); smoke test doesn't verify static serving (defer to Story 1).

**Codex evidence:** Impl `019d0791-0d11-7473-8acd-c816d96f2759`, Review `019d0799-cd36-7883-a896-2d44d746c454`

**Process note:** CSS naming deviation shows Codex doesn't always follow tech design variable naming conventions. Worth flagging in Story 1+ handoffs to avoid repeating.

### Story 1: App Shell Chrome — Completed

**Commit:** `aef335e` — `feat: Story 1 — App Shell Chrome`
**Test count after Story 1:** 65 (was 1, added 64)

**Implementation:** Codex delivered server (session service, browse service, 2 route plugins) and client (menu bar, content area, tab strip, sidebar, keyboard shortcuts, state store, API client). 11 new source files, 10 test files.

**Review findings (4 fixed):** healLastRoot only handled ENOENT not EACCES (fixed), PUT root missing 403 for permission errors (fixed), browse auto-pinned as workspace incorrectly (fixed — per tech design, browse sets root but does NOT auto-pin), Open File tooltip didn't indicate unavailability (fixed).

**Deferred items:** sidebarVisible/workspacesCollapsed conflation (needs separation in Story 2), api.getTree uses POST instead of GET (Story 3 will fix), missing "recent files capped at 20" test, TC-2.4a test only covers subset of arrow keys, tree state type should be nullable (Story 3).

**Codex evidence:** Impl `019d07a7-1597-77f3-8c75-0bd3515c0cae`, Review `019d07ba-132f-7290-b7fd-e008f05e7e91`

**Patterns to flag in Story 2 handoff:** (1) sidebarVisible must be separated from workspacesCollapsed — they are independent concepts. (2) CSS convention is `--color-*` — Codex followed it this time after being told. (3) Browse-then-pin is two separate actions, not auto-combined.

### Story 2: Sidebar — Workspaces and Root Line — Completed

**Commit:** `1266c11` — `feat: Story 2 — Sidebar workspaces and root line`
**Test count after Story 2:** 91 (was 65, added 26)

**Implementation:** Codex built workspaces component (collapse/expand, labels/tooltips, active highlight, remove on hover), root line (path display, browse/pin/copy/refresh), clipboard route. Fixed the sidebarVisible/workspacesCollapsed conflation from Story 1.

**Review findings:** Missing clipboard.test.ts (3 tests added by orchestrator), switchRoot client/server desync on tree failure (fixed by orchestrator — applySession now called before early return), api.getTree uses POST instead of GET (deferred to Story 3).

**Orchestrator fixes:** Two direct fixes applied — switchRoot desync in app.ts and clipboard.test.ts creation. Both were well-scoped single-file changes.

**Codex evidence:** Impl `019d07c6-a995-7b03-91b8-d0232b02a9ef`, Review `019d07ce-2c05-7212-b601-78740614b2d3`

**Patterns for Story 3 handoff:** (1) api.getTree must be fixed from POST to GET when the server route is implemented. (2) Tree expand state is client-side in `expandedDirsByRoot` map. (3) TC-2.4b keyboard nav framework is ready in Story 1, needs to be applied to tree nodes.

### Story 3: File Tree Browsing — Completed

**Commit:** `5e7d937` — `feat: Story 3 — File tree browsing`
**Test count after Story 3:** 130 (was 91, added 39)

**Implementation:** Built tree service (recursive scan, all filtering rules, symlink handling with loop detection, mdCount), GET /api/tree route, file tree component with expand/collapse and keyboard nav. Fixed api.getTree from POST to GET. Implementer went direct (no Codex).

**Review:** Clean — all 17 critical review points verified, zero blocking issues. Minor intentional simplifications (plain object vs Map for expand state, non-nullable tree type).

### Story 5: Theme System — Completed

**Commits:** `46d6d1b` (tests), `f353445` (optimistic theme fix)
**Test count after Story 5:** 144 (was 139, added 5)

**Implementation:** No source changes needed — infrastructure from Stories 0-1 was complete. Added 5 theme-specific tests.

**Review (Codex `019d07ea-fb9f-7e33-8a89-a1841f7584db`):** HIGH finding — theme selection waited for API round-trip before updating DOM, violating "immediate" requirement. Fixed by orchestrator: optimistic DOM update, persist async, rollback on failure. MEDIUM findings (inline submenu vs flyout, localStorage flash edge case) accepted as MVP tradeoffs.

---

### Story 4: Context Menus — Completed

**Commit:** `58f2e7c` — `feat: Story 4 — Context menus`
**Test count after Story 4:** 139 (was 130, added 9)

**Implementation:** Context menu component with file/directory-specific items, close behaviors, keyboard nav. Wired to existing APIs.

**Review:** Codex review confirmed (`019d07e3-7f3d-7133-b02c-592392d96e10`). 4 minor findings all accepted-risk: stale DOM transition edge case, outside click doesn't suppress tree click, TC-2.4c missing Enter assertion, test cleanup leaks.

---

### Story 3 Retroactive Codex Verification

**Codex session:** `019d07e5-72fa-7392-9528-4934c17bf24d`
**Commit:** `46d6d1b` — retroactive fixes

Codex found three real bugs the Opus-only review missed: (1) 400 validation returned 500 instead of structured error for relative paths, (2) root-level EACCES was swallowed as 200 empty tree instead of 403, (3) keyboard nav ArrowDown skipped first row. All three fixed. AC-9.2 performance safeguards noted as tech debt — no depth limit or file-count cap on tree traversal.

This validates the process requirement. Three actual bugs survived an "all 17 points verified" Opus-only review. Multi-model verification is not ceremony — it catches real issues.

---

### Story 6: Session Persistence and Error Handling — Completed

**Commit:** `f0ebadf` — `feat: Story 6 — Session persistence and error handling`
**Test count after Story 6:** 156 (was 144, added 12)

**Implementation:** Session restore with root/recent-file healing, corrupted session recovery, error handling. Codex session `019d07f2-6302-7a62-a02f-c1d5652d5eaf`.

**Review (Sonnet + Codex experiment, session `019d07f9-caa2-77e0-984a-a5a8e9da5374`):** Two Major findings — tree not auto-loaded on bootstrap when root exists (fixed by orchestrator), root line not cleared when directory disappears mid-session (fixed by orchestrator). Both behavioral gaps that Opus reviewers missed in earlier stories. Sonnet's literal spec-checking was more rigorous.

**Sonnet experiment verdict:** Sonnet + Codex found 2 behavioral bugs that multiple Opus + Codex passes did not catch. Sonnet is more literal about checking exact behavior against spec wording. Recommended as the default reviewer model for future stories.

---

**Process failure (Story 3 original review):** Reviewer claimed Codex CLI "not available in environment" and skipped the Codex review pass. Orchestrator accepted this without challenge — violation of the control contract invariant ("no story acceptance without Codex evidence"). Codex was working fine in other teammates on the same machine at the same time. The reviewer likely failed to load the skill correctly or hit a transient error and didn't retry. Manual review was thorough (all 17 points verified), so the acceptance stands, but the process gap is real. **Going forward: if a teammate reports Codex unavailable, require exact error output and retry. Do not accept "not available" at face value.**

---
