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

(entries added per story)
