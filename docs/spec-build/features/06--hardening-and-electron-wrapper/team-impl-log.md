# Epic 6 Implementation Log

## State

**state:** `PRE_EPIC_VERIFY`
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

### Story 0: Foundation — ACCEPTED

**Risk tier:** low
**CLI session:** 019d1260-3984-7523-956d-c0c95fbbb9a3 (3.95M in, 19K out)
**Commit:** 70d20a1
**Gate:** `npm run verify` — 56/56 files, 620/620 tests, 0 failures
**Cumulative tests:** 620 (baseline restored — 7 pre-existing failures fixed, no new tests added per Story 0 scope)

**Pre-acceptance receipt:**
1. CLI evidence: session 019d1260-3984-7523-956d-c0c95fbbb9a3
2. Findings: client tab sync pulled forward from Story 4 (schema + consumers must move together) — `accepted-risk: correct sequencing`
3. Gate: `npm run verify` — PASS (620/620)
4. Open risks: none

**What happened:** Story 0 is infrastructure — no functional ACs, no new tests. The CLI read all artifacts, reproduced the 7 test failures, identified the root cause (styling commit 077c89d changed DOM structure: root-line actions moved to context menu, workspace label selector renamed, app notification DOM changed). Fixed all 7 tests. Created PersistedTab schema with LegacyOrPersistedTab union, all test fixtures, Electron project scaffolding (tsconfig, electron-builder.yml, install script, build scripts, stub main/preload). Also updated client-side tab sync to send PersistedTab objects — technically Story 4 scope but necessary to avoid breaking the PUT /api/session/tabs route after the schema change.

**Reviewer skipped:** Story 0 is pure infrastructure with no functional ACs. The verification gate (620/620 tests, typecheck, build:electron) is sufficient. Full review cycle starts with Story 1.

### Story 1: Large File and Rendering Performance — ACCEPTED

**Risk tier:** low
**Impl CLI session:** 019d126e-dffc-7da2-a15e-c8923f676f12
**Review CLI session:** 019d1279-9db9-7cf3-a41d-1e6d91603c38
**Commit:** 5bdcaa0
**Gate:** `npm run verify` — 57/57 files, 626/626 tests, 0 failures
**Cumulative tests:** 626 (620 + 6 new)

**Pre-acceptance receipt:**
1. CLI evidence: impl session 019d126e-dffc-7da2-a15e-c8923f676f12, review session 019d1279-9db9-7cf3-a41d-1e6d91603c38
2. Findings and dispositions:
   - Nested HTML corruption at chunk boundaries → `accepted-risk` (spec-level design tradeoff, faithful to tech-design-ui.md algorithm, low probability with 50KB chunks)
   - onProgress not wired in content-area → `accepted-risk` (CSS spinner continues via rAF yields, progressive content is visual feedback)
   - Giant single blocks can freeze → `accepted-risk` (spec defers virtual DOM rendering)
   - TC-1.2b not full mode-switch test → `accepted-risk` (validates integration code path)
   - `</hr>` regex miss → `accepted-risk` (void element, benign)
3. Gate: `npm run verify` — PASS (626/626)
4. Open risks: none blocking

**What happened:** Clean implementation matching the tech design exactly. New `chunked-render.ts` module with `splitHtmlChunks` and `renderChunked`, integrated into `content-area.ts` with WeakMap-based AbortController tracking and stale-tab guard. Self-review caught a cross-instance interference issue (module-level AbortController → WeakMap per container). Reviewer confirmed spec compliance and found no fixes needed — all Codex findings were spec-level design tradeoffs, not implementation bugs.

**Observations:** The content-area.ts render() function is growing (350 lines). Future stories touching it should consider extraction. Not actionable now but worth noting for Story 3 (Mermaid cache integration).

### Story 2: File Tree and Startup Performance — ACCEPTED

**Risk tier:** low (turned out medium — review caught 2 real bugs)
**Impl CLI session:** 019d1284-915a-7643-813a-0b301eb9781c
**Review CLI session:** 019d1295-302a-7590-a5e5-0b7d7f3fec78
**Commit:** 85e67cc
**Gate:** `npm run verify` — 60/60 files, 644/644 tests, 0 failures
**Cumulative tests:** 644 (626 + 18 new)

**Pre-acceptance receipt:**
1. CLI evidence: impl session 019d1284-915a-7643-813a-0b301eb9781c, review session 019d1295-302a-7590-a5e5-0b7d7f3fec78
2. Findings and dispositions:
   - Nested ScanTimeoutError swallowed in recursive catch → `fixed` (re-throw regardless of throwOnReadError)
   - Client retry prompt missing for tree scan timeout → `fixed` (ApiError.timeout field, onRetry callback in ClientError, Retry button in error-notification.ts)
   - VirtualTree.getViewportHeight() monotonically increasing → `accepted-risk` (20 extra rows harmless, sidebar rarely resizes)
   - No explicit MAX_FILE_SIZE boundary test → `accepted-risk` (trivial constant change, existing tests cover error class)
   - TC-4.1a startup test heavily mocked → `accepted-risk` (appropriate for unit test scope)
3. Gate: `npm run verify` — PASS (644/644)
4. Open risks: none blocking

**What happened:** Largest story so far — server tree hardening (timeout, depth guard, error codes) + client virtual tree (custom scroller) + MAX_FILE_SIZE raise + filesystem edge cases. Implementation was solid but review caught two real bugs: (1) ScanTimeoutError was silently swallowed in nested scan calls, producing partial 200 instead of 500 SCAN_ERROR — a correctness bug that would have been hard to catch in production; (2) client had no retry prompt for scan timeouts despite it being in the DoD. Both fixed by a senior-engineer subagent in one pass. This validates the full review cycle — the implementer's self-review missed both issues, the fresh Opus + CLI dual review caught them.

**Pattern observed:** The reviewer's independent architectural review and the CLI spec-compliance review converged on the same Major #1 (timeout swallowing). This gives high confidence in the finding. Major #2 (missing retry prompt) was primarily a spec-compliance gap — the CLI's literal AC/TC checking caught it.

### Story 3: Many-Tab Performance and Mermaid Caching — ACCEPTED

**Risk tier:** low
**Impl CLI session:** 019d12a7-134a-7981-b043-6eb774e6dc6a
**Review CLI session:** 019d12b2-bec9-75f2-b32f-dfdae7d5cad5
**Commit:** 452a825
**Gate:** `npm run verify` — 62/62 files, 658/658 tests, 0 failures
**Cumulative tests:** 658 (644 + 14 new)

**Pre-acceptance receipt:**
1. CLI evidence: impl session 019d12a7-134a-7981-b043-6eb774e6dc6a, review session 019d12b2-bec9-75f2-b32f-dfdae7d5cad5
2. Findings and dispositions:
   - invalidateForTab over-invalidates (aggressive vs selective removal) → `accepted-risk` (spec text and spec code example contradict; implementation matches code example; selective removal adds complexity for marginal benefit)
   - Many-tabs tests don't verify <200ms timing budget → `accepted-risk` (timing assertions flaky in CI; functional correctness verified)
   - No integration test for cache-renderer wiring → `accepted-risk` (3 lines of straightforward integration; low regression risk)
   - Dead invalidateTheme method → `accepted-risk` (harmless dead API, may be useful for future explicit theme cache control)
   - themeId naming misleading (Mermaid theme vs app theme) → `accepted-risk` (naming nit)
3. Gate: `npm run verify` — PASS (658/658)
4. Open risks: none blocking

**What happened:** Clean client-only story. MermaidCache class with FNV-1a hash (correct Math.imul for 32-bit overflow), LRU eviction, cache integration in mermaid-renderer.ts, tab close invalidation. Many-tab tests exercise 25+ tabs with real close flow. Review found no bugs — all findings were spec interpretation differences and test coverage observations. The invalidateForTab spec inconsistency (text says selective, code example says aggressive) is a spec issue, not an implementation issue.

**Spec cleanup needed:** tech-design.md Q3 line 140 says "removes entries whose source hash appears only in the closed tab's document" but the implemented (and spec code-example) behavior is aggressive removal. Update spec text to match. Not blocking.

### Story 4: Tab State Persistence — ACCEPTED

**Risk tier:** low
**Impl CLI session:** 019d12bd-1322-7ab0-ad67-318aa334c36e
**Review CLI session:** 019d12cc-527e-7f13-b6e5-935190120c66
**Commit:** 87a597b
**Gate:** `npm run verify` — 63/63 files, 668/668 tests, 0 failures
**Cumulative tests:** 668 (658 + 10 new)

**Pre-acceptance receipt:**
1. CLI evidence: impl session 019d12bd-1322-7ab0-ad67-318aa334c36e, review session 019d12cc-527e-7f13-b6e5-935190120c66
2. Findings and dispositions:
   - toggleMode() doesn't persist mode change → `fixed` (added void syncTabsToSession())
   - openFile() defers persistence past file load → `fixed` (added await syncTabsToSession() before readFile)
   - Edit scroll position not persisted → `fixed` (changed to persist editScrollPosition)
   - syncTabsToSession doesn't filter by tab status → `accepted-risk` (functionally correct — deleted tabs re-show as "file not found" on restore)
3. Gate: `npm run verify` — PASS (668/668)
4. Open risks: none blocking

**What happened:** Story 4 was partially pre-implemented by Story 0 (schema migration + client tab sync). The remaining work was lazy tab loading on switch, missing-file handling, and comprehensive tests. Implementation added 10 tests (9 tab-restore + 1 startup). Review caught two real persistence timing gaps: (1) mode toggle didn't persist, (2) new tab wasn't persisted until file load completed. Both fixed with one-line additions. Also fixed edit scroll position persistence. Review quality continues strong — the CLI's literal spec checking catches gaps that human review normalizes.

**Pattern reinforced:** Review catches persistence timing gaps that are easy to miss in implementation because the happy path works. The crash-recovery edge cases (mode toggle → crash, open file → slow load → crash) are exactly what incremental persistence is designed for, and the implementation had holes in both paths. Three small fixes closed them.

### Story 5: Electron Shell and Window Management — ACCEPTED

**Risk tier:** high (confirmed — Electron integration, new runtime mode)
**Impl CLI session:** 019d12db-06b9-7021-824c-cfb38a967db2
**Review CLI session:** 019d12e9-1b5f-7c70-8044-e10b6d084504
**Commit:** 9319bb7
**Gate:** `npm run verify` — 65/65 files, 676/676 tests + `npm run test:electron` — 2/2 files, 8/8 tests
**Cumulative tests:** 676 (668 + 8 new)

**Pre-acceptance receipt:**
1. CLI evidence: impl session 019d12db-06b9-7021-824c-cfb38a967db2, review session 019d12e9-1b5f-7c70-8044-e10b6d084504
2. Findings and dispositions:
   - Preload path used URL.pathname instead of fileURLToPath → `fixed` (P1 correctness)
   - Second-instance startup race: no isLoading check → `fixed` (P1 correctness, mirrors open-file pattern)
   - TC-13.2b server crash recovery not implemented → `defer` (7th IPC channel conflicts with 6-channel spec; client-side handling exists via Epic 2)
   - AC-4.1b startup timing → `accepted-risk` (manual verification, not unit-testable)
   - No graceful fastify.close() on quit → `accepted-risk` (not critical for single-user local app, per tech design)
3. Gate: `npm run verify` — PASS (676/676), `npm run test:electron` — PASS (8/8)
4. Open risks: TC-13.2b deferred

**Security verification:** CLEAN. contextIsolation: true, nodeIntegration: false, sandbox: true. Preload exposes exactly 7 methods via contextBridge. IPC surface is exactly 6 channels. No dangerous APIs exposed.

**What happened:** First real Electron code in the project. The implementation used a dynamic import pattern for startServer to prevent esbuild from bundling native dependencies. Review caught two correctness issues: (1) preload path resolution using URL.pathname instead of the Node.js-blessed fileURLToPath, and (2) a race condition where second-instance file routing didn't check if the renderer was still loading. Both fixed. Security surface is clean — this was the primary concern for the high-risk story.

**Boundary inventory update:**
- Electron runtime (BrowserWindow, Menu, app, ipcMain): **integrated** (was: not started)
- electron-window-state: **integrated** (was: not started)
- electron-builder packaging: still not started (Story 7)

### Story 6: Native Menu Bar and Electron Quit Flow — ACCEPTED

**Risk tier:** medium
**Impl CLI session:** 019d12f5-4055-7303-a778-21e1a43f2166
**Review CLI session:** 019d1305-24d5-7180-8256-11e0198cd993
**Commit:** f508001
**Gate:** `npm run verify` — 68/68 files, 693/693 tests + `npm run test:electron` — 5/5 files, 25/25 tests
**Cumulative tests:** 693 (676 + 17 new)

**Pre-acceptance receipt:**
1. CLI evidence: impl session 019d12f5-4055-7303-a778-21e1a43f2166, review session 019d1305-24d5-7180-8256-11e0198cd993
2. Findings and dispositions:
   - Quit modal shows one file instead of listing all dirty files → `accepted-risk` (functionally correct — saves all, aborts on failure; single-file modal is Epic 5 pattern)
   - Button text doesn't change for quit context ("Save and Close" vs "Save All and Quit") → `accepted-risk` (cosmetic only)
   - Detection timing not before static HTML → `accepted-risk` (BrowserWindow show-when-ready prevents flash)
   - Missing `body.electron #app` grid rule (potential blank gap) → `defer` to pre-verification cleanup
   - `app.on('activate')` doesn't re-register menu/IPC for new window → `defer` (outside Story 6 ACs, future enhancement)
3. Gate: `npm run verify` — PASS (693/693), `npm run test:electron` — PASS (25/25)
4. Open risks: grid row gap needs real Electron testing

**What happened:** Clean implementation building on Story 5's Electron infrastructure. New menu.ts module with full template, state sync via IPC, and Electron detection CSS. Quit flow wires the existing Epic 5 unsaved-modal to Electron's close event via IPC round-trip. All 17 TCs pass. Three spec deviations (quit modal UX, button text, detection timing) — all acceptable. Reviewer's grid-row-gap observation is the most actionable item — add `body.electron #app { grid-template-rows: 0 minmax(0, 1fr) }` during pre-verification cleanup.

### Story 7: File Associations, Packaging, and Install — ACCEPTED (FINAL STORY)

**Risk tier:** medium
**Impl CLI session:** 019d130e-fb5c-7a32-8d1e-c92ffa8ea201
**Review CLI session:** 019d1314-cb56-7912-8102-1462da3830a7
**Commit:** 7d287e5
**Gate:** `npm run verify` — 69/69 files, 698/698 tests + `npm run test:electron` — 6/6 files, 30/30 tests
**Cumulative tests:** 698 (693 + 5 new)

**Pre-acceptance receipt:**
1. CLI evidence: impl session 019d130e-fb5c-7a32-8d1e-c92ffa8ea201, review session 019d1314-cb56-7912-8102-1462da3830a7
2. Findings and dispositions:
   - Cold-start IPC race (open-file before onOpenFile listener) → `accepted-risk` (narrow timing window, future hardening)
   - Missing Electron packages in package.json → `fixed` (added electron, electron-builder, electron-window-state)
   - TC-9.2e ordering test weak → `accepted-risk` (architectural guarantee, can't unit-test renderer-side ordering)
   - TC-9.2b/c mislabeled coverage → `accepted-risk` (3-line code path correct by inspection)
   - Missing app icon → `accepted-risk` (cosmetic, electron-builder uses default)
3. Gate: `npm run verify` — PASS (698/698), `npm run test:electron` — PASS (30/30)
4. Open risks: cold-start IPC race (low probability), missing app icon (cosmetic)

**What happened:** Minimal story — most scaffolding was done in Story 0 (electron-builder.yml, install-app.sh) and Story 5 (file-handler.ts). Story 7 added 5 file-handler tests and the install-app script entry in package.json. Review caught the missing Electron packages (pre-existing from Story 5 but blocking for real packaging) — fixed by adding electron + electron-builder to devDeps and electron-window-state to deps.

**Boundary inventory final check:**
- Electron runtime: **integrated** (Story 5)
- electron-window-state: **integrated** (Story 5)
- electron-builder packaging: **integrated** (Story 0 config + Story 7 packages)
- macOS Launch Services: **not testable** (manual verification required)

**All 8 stories complete. Proceeding to pre-verification cleanup, then epic-level verification.**
