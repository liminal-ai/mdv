# Epic 9: Package Viewer Integration — Implementation Log

**State:** `COMPLETE`
**CLI:** codex-subagent (gpt-5.4)
**Started:** 2026-03-24

---

## Verification Gates

### Story Acceptance Gate
```bash
cd /Users/leemoore/code/md-viewer/app && npm run verify
```
Components: `npm run build && npm run format:check && npm run lint && npm run typecheck && npm run typecheck:client && npm run test`

### Epic Acceptance Gate
```bash
cd /Users/leemoore/code/md-viewer/app && npm run verify-all
```
Components: `npm run verify && npm run test:e2e`

---

## Boundary Inventory

| Boundary | Status | Story |
|----------|--------|-------|
| Epic 8 library (extractPackage, parseManifest, createPackage, MANIFEST_FILENAME) | integrated — exists at `app/src/pkg/` | all |
| Epic 8 scaffoldManifest | exists at `app/src/pkg/manifest/scaffold.ts` but NOT exported from `app/src/pkg/index.ts` — **must be added in Story 0** | 3, 4, 7 |
| Existing /api/file, /api/tree, /api/image endpoints | integrated | 1+ |
| Session persistence (session.service.ts, schemas/index.ts) | integrated | 0+ |
| File watching (WatchService via chokidar) | integrated | 6 |
| Fastify route registration pattern | integrated | 0+ |
| Client StateStore pattern | integrated | 0+ |

---

## Story Sequence

Recommended order from tech design: **0 → 1 → 2 → 3 → 5 → 6 → 4 → 7**

| Story | Scope | ACs | Est. Tests | Running Total |
|-------|-------|-----|------------|---------------|
| 0 | Infrastructure (schemas, stubs, fixtures, scaffoldManifest export) | (setup) | 4 | 4 |
| 1 | Open Package + Package-Mode Sidebar | AC-1.1, 1.4, 1.5, 2.1–2.3 | 20 | 24 |
| 2 | Mode Switching + Additional Open Methods | AC-1.2, 1.3, 3.1–3.3 | 10 | 34 |
| 3 | Package Creation | AC-4.1–4.4 | 9 | 43 |
| 5 | Manifest Editing + Sidebar Re-Sync | AC-6.1–6.4 | 10 | 53 |
| 6 | Extracted Package Editing + Stale Indicator | AC-7.1–7.2 | 6 | 59 |
| 4 | Export to Package | AC-5.1–5.4 | 10 | 69 |
| 7 | No-Manifest Fallback + Cleanup | AC-8.1–8.3, 9.1–9.2 | 11 | 80 |

**Scope addition for Story 0:** Export `scaffoldManifest` from `app/src/pkg/index.ts`. This is a gap — the function exists but isn't publicly exported. Stories 3, 4, and 7 need it.

---

## Artifacts

| Artifact | Path |
|----------|------|
| Epic | `docs/spec-build/v2/epics/09--package-viewer-integration/epic.md` |
| Tech Design (index) | `docs/spec-build/v2/epics/09--package-viewer-integration/tech-design.md` |
| Tech Design (server) | `docs/spec-build/v2/epics/09--package-viewer-integration/tech-design-server.md` |
| Tech Design (client) | `docs/spec-build/v2/epics/09--package-viewer-integration/tech-design-client.md` |
| Test Plan | `docs/spec-build/v2/epics/09--package-viewer-integration/test-plan.md` |
| Stories | `docs/spec-build/v2/epics/09--package-viewer-integration/stories.md` |
| Epic 8 Library | `app/src/pkg/` (index.ts exports) |

---

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

  1. tech-design.md — Read. Reflect: what are the key architectural decisions, vocabulary, and cross-cutting patterns?
  2. [primary tech design companion for this story] — Read. Reflect: what interfaces, data contracts, and design constraints are relevant?
  3. epic.md — Read. Reflect: how does this story fit in the broader feature? What are the upstream/downstream dependencies?
  4. test-plan.md — Read. Reflect: what testing patterns and coverage expectations apply?
  5. stories.md [specific line range for this story] — Read. Reflect: what are the ACs, TCs, and any spec deviations or gotchas to flag?

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
  - Test counts and verification results (run the story gate yourself: cd /Users/leemoore/code/md-viewer/app && npm run verify)
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

  1. tech-design.md
  2. [primary tech design companion for this story]
  3. epic.md
  4. test-plan.md
  5. stories.md [specific line range for this story]

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
  - Final story gate result (run: cd /Users/leemoore/code/md-viewer/app && npm run verify)
  - "What else did you notice but did not report?"
```

---

## Story Checkpoints

### Story 0: Foundation — ACCEPTED

**CLI evidence:** Codex session `019d1f78-e89b-7272-9a18-0f52b87e135f`
**Gate result:** 816 tests passing (812 baseline + 4 new schema tests), 79 test files. `npm run verify` passed (confirmed by independent investigation agent after initial transient failures).
**Findings:** None — clean implementation matching tech design exactly.
**Flaky test investigation:** 2 transient test failures (cli.test.ts TC-6.4c, export-fidelity.test.ts TC-6.2a) were investigated by a separate agent. Could not reproduce across 4 full-suite runs + targeted stress testing. Root cause: likely resource pressure during concurrent agent activity. Also fixed misleading jsdom navigation noise in link-handler.test.ts.
**Commit:** `3810494` — feat: Story 0 — Package viewer integration foundation
**Cumulative tests:** 816
**Open items:** None

### Story 1: Open Package + Package-Mode Sidebar — ACCEPTED

**CLI evidence:** Implementation `019d1fe2-e00c-7e30-8564-7bc4aa8b9510`, Review `019d1ff6-df76-7203-b1d4-08e4edb3dceb`
**Gate result:** 836 tests passing (816 + 20 new), 81 test files. `npm run test` 836/836.
**Findings:** Review found 2 major + 6 minor issues. 5 fixed (M1: content-area error for missing files, M2: tightened tab label assertion which exposed a real disambiguateDisplayNames bug, m2: group label click toggle, m5: import manifest filename from shared, m6: persistState private). 3 deferred (m1: window.prompt picker — functional; m3: pre-rendered HTML in test — acceptable; m4: route inject tests — add later).
**Commit:** `c935eb3` — feat: Story 1 — Open package and package-mode sidebar
**Cumulative tests:** 836
**Deferred items:** window.prompt() picker (m1), route inject() tests (m4)
**Pattern noted:** disambiguateDisplayNames was overwriting package display names — a cross-cutting function that didn't account for the new package context. Watch for similar interactions in subsequent stories where existing utility functions meet package-mode behavior.

### Story 2: Mode Switching + Additional Open Methods — ACCEPTED

**CLI evidence:** Implementation `019d2011-9c9d-72b3-ab81-96eb0930f824`, Review `019d201e-2188-7120-b96f-3eff71f0f44d`
**Gate result:** 850 tests passing (836 + 10 new + 4 from review fixes), 83 test files.
**Findings:** Review found 2 P1 (CLI routing gaps, missing CLI tests), 1 P2 (unsafe cleanup order), 1 P2 (missing route test), 1 P3 (shallow assertion). All fixed. P2-3 (getManifest cached data) deferred to Story 5.
**Bonus work:** getManifest() implemented ahead of schedule (needed for CLI arg restore bootstrap).
**Commit:** `eb45811` — feat: Story 2 — Mode switching and additional open methods
**Cumulative tests:** 850
**Deferred items:** getManifest() returns cached parsed data (P2-3) → Story 5 must re-parse from disk
**Pattern noted:** TempDirManager.create() originally auto-cleaned previous dir before new extraction — unsafe. Fixed to cleanup-after-success pattern. Future stories modifying temp dir lifecycle should preserve this ordering.

### Story 3: Package Creation — ACCEPTED

**CLI evidence:** Implementation `019d2035-7fc1-7581-ad53-47562c83ef58`, Review `019d204a-1d64-7240-a977-8318685b213c`
**Gate result:** 859 tests passing (850 + 9 new), 85 test files.
**Findings:** Clean review — no fixes needed. Minor notes: menu separator placement differs from spec layout (better UX grouping), window.confirm instead of custom modal (functional), format:'mpk' hardcoded for directory mode (schema concession).
**Commit:** `37864fc` — feat: Story 3 — Package creation
**Cumulative tests:** 859
**Tracked for Story 5:** GET /api/package/manifest returns 400 instead of spec's 422 for ManifestParseError — reviewer caught this pre-existing deviation.

### Story 5: Manifest Editing + Sidebar Re-Sync — ACCEPTED

**CLI evidence:** Implementation `019d2051-e4cd-7db2-8042-b5be446ffa79`, Review `019d2079-1d9b-7281-9e9b-d27f59cdfca3`
**Gate result:** 869 tests passing (859 + 10 new), 87 test files.
**Findings:** Review found no blocking issues. P2 items all deferred or accepted-risk: empty nav uses error style not warning (cosmetic), silent swallow of non-422 errors (edge case, spec-consistent), client integration test gap (accepted — server + rendering tests cover it), route catch-all error code (trivial). Critical check passed: getManifest() confirmed re-parsing from disk, 422 status code confirmed.
**Commit:** `da14018` — feat: Story 5 — Manifest editing and sidebar re-sync
**Cumulative tests:** 869
**Deferred items:** Empty nav warning visual (P2-1), route catch-all error code (P3-4)

### Story 6: Extracted Package Editing + Stale Indicator — ACCEPTED

**CLI evidence:** Implementation `019d2084-283f-7310-84b7-366a1a049a1b`
**Gate result:** 875 tests passing (869 + 6 new), 89 test files. 1 transient timeout in app.test.ts (pre-existing flaky, confirmed by investigation agent — passes in isolation and on retry).
**Findings:** Clean implementation, no review fixes needed. Low-risk story.
**Commit:** `f21bab3` — feat: Story 6 — Editing in extracted packages and stale indicator
**Cumulative tests:** 875

### Story 4: Export to Package — ACCEPTED

**CLI evidence:** Implementation `019d20a5-dc7a-7ca0-bd56-b9f218c6e574`
**Gate result:** 885 tests passing (875 + 10 new), 91 test files.
**Findings:** Clean implementation. TC-5.2b handled by cleaning up auto-scaffolded manifest after export (Epic 8's createPackage writes manifest to disk, service removes it post-export). Stale clearing correctly gated to original sourcePath match.
**Commit:** `8e4db9f` — feat: Story 4 — Export to package
**Cumulative tests:** 885

### Story 7: No-Manifest Fallback + Cleanup — ACCEPTED

**CLI evidence:** Implementation `019d20b6-d833-7313-a679-b05c900cd15e`
**Gate result:** 896 tests passing (885 + 11 new), 94 test files.
**Findings:** Clean implementation. `runStartupTasks` guard added to prevent startup hooks from breaking 20+ existing tests that mock fs — pragmatic deviation, production behavior unchanged.
**Commit:** `a97f470` — feat: Story 7 — No-manifest fallback and cleanup
**Cumulative tests:** 896
**No remaining stubs:** All PackageService methods implemented. Zero NotImplementedError references in package service.

---
