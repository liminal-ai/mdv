# Epic 2 Implementation Log

## Lane Determination

- **codex-subagent**: found and loaded
- **copilot-subagent**: not checked (codex available)
- **gpt53-codex-prompting**: not found at `~/.claude` — searched `**/*gpt53*`, no results
- **Lane selected**: Codex via codex-subagent
- **Models**: gpt-5.4 (default from config.toml), gpt-5.3-codex for review diversity. No gpt-5.2.

## Verification Gates

- **Story acceptance gate**: `cd app && npm run verify` (format:check → lint → typecheck → typecheck:client → test)
- **Epic acceptance gate**: `cd app && npm run verify-all` (same as verify)

## Baseline

- **Tests**: 18 files, 164 passing
- **Pre-existing**: 1 lint warning (`no-explicit-any` in app.test.ts:77) — non-blocking
- **HEAD**: eb0fff7

## Story Execution Order

0 → 1 → 2 → 4 → 5 → 3 → 6 → 7

## Handoff Template: Implementer

```
You are implementing a story for Epic 2: Document Viewing and Multi-Tab Reading.

**CRITICAL: You are a supervisory layer over a Codex subagent. You do NOT implement directly.**

Step 1 — Load skill:
  Use the Skill tool: Skill(codex-subagent)
  If this fails, report the exact error. Do not skip it. Do not implement yourself.

Step 2 — Read artifacts sequentially (this order matters):
  1. /Users/leemoore/code/md-viewer/docs/spec-build/features/02--document-viewing-and-multi-tab-reading/tech-design.md
  2. /Users/leemoore/code/md-viewer/docs/spec-build/features/02--document-viewing-and-multi-tab-reading/epic.md
  3. /Users/leemoore/code/md-viewer/docs/spec-build/features/02--document-viewing-and-multi-tab-reading/tech-design-api.md
  4. /Users/leemoore/code/md-viewer/docs/spec-build/features/02--document-viewing-and-multi-tab-reading/tech-design-ui.md
  5. /Users/leemoore/code/md-viewer/docs/spec-build/features/02--document-viewing-and-multi-tab-reading/test-plan.md

Step 3 — Reflection checkpoint:
  STOP. Before reading the story, write down a summary of:
  - Key architectural decisions from the tech design
  - Data contracts and interfaces relevant to this epic
  - Cross-cutting patterns (error handling, DI, testing approach)
  This summary is your compressed context. Write it to /tmp/reflection-story-N.md.

Step 4 — Read the story:
  [STORY PATH]

Step 5 — Write a Codex prompt and launch:
  Write a prompt for Codex that gives it the story path, epic path, and tech design paths.
  Tell it to read those artifacts and implement the story.
  Keep the prompt lean and execution-oriented. Do not over-prescribe.
  Launch: cd /Users/leemoore/code/md-viewer/app && codex exec --json "prompt" > /tmp/codex-story-N-impl.jsonl 2>/dev/null
  Use run_in_background on the Bash tool. Wait for completion.

Step 6 — Self-review loop:
  Read Codex output: codex-result last /tmp/codex-story-N-impl.jsonl
  Get session ID: codex-result session-id /tmp/codex-story-N-impl.jsonl
  Resume Codex for self-review: cd /Users/leemoore/code/md-viewer/app && codex exec resume --json <SESSION_ID> "Do a thorough critical self-review. Fix non-controversial issues. Report: what you found, what you fixed, what you didn't fix and why." > /tmp/codex-story-N-review.jsonl 2>/dev/null
  If substantive changes, iterate. Continue until clean or nits only.

Step 7 — Independent verification:
  Read the code yourself. Verify remaining open issues. Form your own assessment.

Step 8 — Report to orchestrator (SEND THIS MESSAGE):
  Use SendMessage to report to the team lead:
  - What was built (files created/modified)
  - Test counts and verification results (run npm run verify yourself)
  - Codex session ID(s)
  - What was found and fixed across self-review rounds
  - What remains open with reasoning
  - Any concerns or spec deviations
```

## Handoff Template: Reviewer

```
You are reviewing a story implementation for Epic 2: Document Viewing and Multi-Tab Reading.

**CRITICAL: You MUST use a Codex subagent for spec-compliance review. This is not optional.**

Step 1 — Load skill:
  Use the Skill tool: Skill(codex-subagent)
  If this fails, report the exact error. Do not skip it. Do not review without Codex.

Step 2 — Read artifacts sequentially (this order matters):
  1. /Users/leemoore/code/md-viewer/docs/spec-build/features/02--document-viewing-and-multi-tab-reading/tech-design.md
  2. /Users/leemoore/code/md-viewer/docs/spec-build/features/02--document-viewing-and-multi-tab-reading/epic.md
  3. /Users/leemoore/code/md-viewer/docs/spec-build/features/02--document-viewing-and-multi-tab-reading/tech-design-api.md
  4. /Users/leemoore/code/md-viewer/docs/spec-build/features/02--document-viewing-and-multi-tab-reading/tech-design-ui.md
  5. /Users/leemoore/code/md-viewer/docs/spec-build/features/02--document-viewing-and-multi-tab-reading/test-plan.md

Step 3 — Reflection checkpoint:
  STOP. Write a summary of key architectural decisions, data contracts, and cross-cutting patterns to /tmp/reflection-review-story-N.md.

Step 4 — Read the story:
  [STORY PATH]

Step 5 — Dual review (parallel):
  A. Launch Codex for spec-compliance review:
     cd /Users/leemoore/code/md-viewer/app && codex exec --json "Read the following artifacts and do a thorough code review of the implementation against them. [artifact paths]. Organize findings by severity: Critical, Major, Minor. Check AC/TC coverage, interface compliance, architecture alignment, test quality." > /tmp/codex-story-N-review-verify.jsonl 2>/dev/null
     Use run_in_background.
  B. While Codex reviews, do your own architectural review independently.

Step 6 — Consolidate:
  Read Codex review: codex-result last /tmp/codex-story-N-review-verify.jsonl
  Get session ID: codex-result session-id /tmp/codex-story-N-review-verify.jsonl
  Merge both sets of findings. Verify claims against actual code.
  Compile consolidated fix list.

Step 7 — Fix:
  If fixes needed, launch Codex to implement them:
  cd /Users/leemoore/code/md-viewer/app && codex exec --json "fix prompt with specific issues" > /tmp/codex-story-N-fixes.jsonl 2>/dev/null
  Have it self-review after fixing. Iterate until clean.

Step 8 — Report to orchestrator (SEND THIS MESSAGE):
  Use SendMessage to report to the team lead:
  - Codex review session ID(s)
  - Your own review findings
  - Codex findings
  - What was fixed
  - What remains open with dispositions
  - Final npm run verify result
  - "What else did you notice but did not report?"
```

## Story Cycles

### Story 0: Foundation — ACCEPTED

**Codex evidence:**
- Implementation: `019d08df-2019-79e1-892e-ade1f19c9fd8`
- Review: `019d08eb-fddf-7c92-8a18-9ab84831c732`
- Fixes: `019d08f0-f03d-7c32-86f5-1ac2613e6b4e`

**Findings and dispositions:**
- Tab fixture canonicalPath duplication → `fixed`
- Missing binaryMarkdown fixture → `fixed`
- deletedFileState type confusion → `fixed`
- Missing ErrorResponse type export → `fixed`
- ClientState tab extensions → `defer` (Story 4 scope)
- InvalidPathError class → `defer` (Story 1 scope, Zod covers it)
- Story text /api/file/watch vs /ws → `accepted-risk` (doc mismatch only, code follows tech design)

**Gate:** `npm run verify` — 164 tests passing, format/lint/typecheck clean
**Commit:** `3d8dad3`
**Open risks:** none

**Observations:** Both implementer and reviewer followed the Codex subagent process correctly. Sequential reading + reflection checkpoint worked — both agents produced detailed, spec-aware reports. The reviewer's note about FileChangeEventSchema lacking a `type` field (added by ServerWsMessageSchema wrapper) is worth flagging to Story 7's implementer.

**Test baseline for Story 1:** 164 tests. Story 1 specifies ~19 TCs. Expected total after Story 1: ~183.

### Story 1: File Read API — ACCEPTED

**Codex evidence:**
- Implementation: `019d08f7-627c-77d1-970b-6b5c120a7672`
- Review: `019d0901-6b11-7712-a1f1-05d201be3bca`
- Fixes: `019d0905-f726-77a3-a698-51fab7ecc0de`

**Findings and dispositions:**
- Session routes missing `attachValidation` + error envelope → `fixed`
- `activeTab` not validated against `openTabs` → `fixed`
- File picker 500 error path untested → `fixed`
- Default-mode validation test weak assertion → `fixed`
- `html: ''` and `warnings: []` placeholders → `accepted-risk` (Story 2 scope)
- Symlink to non-markdown file → `accepted-risk` (by design — user owns machine)
- Client-side TCs (loading, dedup, recent click) → `defer` (client story scope)
- `INVALID_PATH` reused for mode validation → `accepted-risk` (minor, consistent with codebase pattern)

**Gate:** `npm run verify` — 187 tests passing, format/lint/typecheck clean
**Commit:** `25a7d29`
**Open risks:** none

**Observations:** Reviewer caught a meaningful gap — session routes lacked `attachValidation` and the error envelope, meaning validation errors returned Fastify's default format instead of the app's normalized shape. This is the kind of consistency issue that Codex spec-compliance review is designed to catch. The `activeTab` consistency check was also a good find — could have led to impossible persisted state.

**Test baseline for Story 2:** 187 tests. Story 2 specifies ~24 TCs. Expected total after Story 2: ~211.

### Story 2: Markdown Rendering — ACCEPTED

**Codex evidence:**
- Implementation: `019d090c-1b0b-70c1-900e-fed1e27917ef`
- Review: `019d0917-70df-74b1-800f-b88bf379bf55`
- Fixes: `019d091c-106c-7ad0-a89f-a3ca2d2a8747`

**Findings and dispositions:**
- IMG regex whitespace bypass (security-relevant) → `fixed`
- Query/hash stripping incomplete for existsSync + proxy URL → `fixed`
- Visual TC assertions (wide tables, scrolling) → `accepted-risk` (client/E2E responsibility)
- tabindex="-1" test coupling → `accepted-risk` (pinned deps)
- Duplicate/Unicode slug edge cases → `accepted-risk` (github-slugger tested upstream)

**Gate:** `npm run verify` — 217 tests passing, format/lint/typecheck clean
**Commit:** `2766a11`
**Open risks:** none

**Observations:** Codex found a genuine security-relevant bug — the IMG regex didn't handle whitespace around `=` in raw HTML img tags, which could bypass remote image blocking. This is exactly the value of multi-model verification: the implementer's Codex self-review didn't catch it, but the reviewer's fresh Codex did. The query/hash stripping fix was also a real correctness bug. Both stories so far have had the review phase catch meaningful issues.

**Test baseline for Story 4:** 217 tests. Story 4 specifies ~17 TCs. Expected total after Story 4: ~234.

### Story 4: Tab Management — ACCEPTED

**Codex evidence:**
- Implementation: `019d0921-c3fe-7cf1-a004-62aaef105d22`
- Review: `019d0935-023b-7dc0-ad9a-0c50cd1aec08`

**Findings and dispositions:**
- Content area blanket re-render → `accepted-risk` (Epic 1 pattern)
- Dual Escape handling → `accepted-risk` (harmless)
- Symlink dedup loading flash → `accepted-risk` (by design per tech design two-phase dedup)
- Bulk action integration test gap → `defer` (future test enrichment)
- Auto-scroll too aggressive → `defer` (cosmetic)
- Session restore error surfacing → `defer` (acceptable UX trade-off)
- Story file stale scope bullet → `defer` (documentation only)

**Gate:** `npm run verify` — 247 tests passing, format/lint/typecheck clean
**Commit:** `a4fc081`
**Open risks:** none

**Observations:** First story where the reviewer found no fixes needed. All findings were Minor severity. The implementation was well-structured with good race condition handling in openFile and clean pure-function disambiguation. The self-review loop caught the significant issues (TC coverage gaps, accessibility nesting problem) before the reviewer even saw it. Pattern holding: self-review is catching the obvious stuff, reviewer is validating rather than finding new issues on cleaner stories.

**Test baseline for Story 5:** 247 tests. Story 5 specifies ~15 TCs. Expected total after Story 5: ~262.

### Story 5: Content Toolbar — ACCEPTED

**Codex evidence:**
- Implementation: `019d093e-e476-7120-b089-b72c1b3c3816`
- Review: `019d094a-6bbd-7bc2-8af9-892d28dd99da`

**Findings and dispositions:**
- Left-truncation CSS missing for file path display → `fixed` (tech design explicitly specifies rtl truncation)
- Warning panel toggle glitch (close/reopen race) → `fixed`
- Dead CSS (.content-toolbar__meta) → `fixed`
- Default mode label hardcoded to 'Render' → `accepted-risk` (only valid value in Epic 2, YAGNI)
- TC traceability nits (unlabeled tests) → `accepted-risk` (coverage present, labeling cosmetic)

**Gate:** `npm run verify` — 263 tests passing, format/lint/typecheck clean
**Commit:** `ab1962f`
**Open risks:** none

**Observations:** Both reviewers independently found the left-truncation CSS gap — a tech design requirement that the implementer missed. This is a good example of the review catching a spec-compliance issue that wouldn't show up in tests but affects real user experience. The warning panel toggle glitch was also a genuine interaction bug. Pattern continuing: review phase adds real value on every story.

**Test baseline for Story 3:** 263 tests. Story 3 specifies ~12 TCs. Expected total after Story 3: ~275.

### Story 3: Image Handling — ACCEPTED

**Codex evidence:**
- Implementation: `019d0954-aa4f-7a31-8add-ecc6eb39ba96`
- Review: `019d095c-abd5-7e70-b682-b01a9e337fbb`

**Findings and dispositions:**
- existsSync doesn't check isFile for directories with image extensions → `accepted-risk` (extreme edge case, proxy catches it)
- No stream error handler on createReadStream → `accepted-risk` (microsecond race window, Fastify handles gracefully)
- TC-3.1c/d no automated tests (CSS-only) → `accepted-risk` (JSDOM has no layout engine, CSS verified by inspection)
- Case-sensitive URL scheme detection → `accepted-risk` (nonexistent in practice)

**Gate:** `npm run verify` — 277 tests passing, format/lint/typecheck clean
**Commit:** `993b7f3`
**Open risks:** none

**Observations:** Second story in a row where the review found no fixes needed — all findings were accept-risk. The implementation quality is trending upward as stories build on well-tested foundations. Story 2's render pipeline handled the heavy lifting; Story 3 just added the proxy endpoint and wired client warnings (already built in Story 5). Clean layering.

**Test baseline for Story 6:** 277 tests. Story 6 specifies ~6 TCs. Expected total after Story 6: ~283.
