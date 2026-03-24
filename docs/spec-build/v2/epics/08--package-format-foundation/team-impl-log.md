# Team Implementation Log — Epics 8 & 9

**State:** `STORY_ACTIVE`
**Active Story:** E8-S4 (Package Inspection & Reading)
**Phase:** reviewing
**CLI:** codex-subagent (Codex CLI, gpt-5.4)
**Team:** epic-8-9-impl
**Started:** 2026-03-23
**Baseline test count:** 711 tests / 70 files

---

## Verification Gates

### Story Acceptance Gate

```bash
cd /Users/leemoore/code/md-viewer/app && npm run verify
```

This runs: `npm run build && npm run red-verify && npm run test`
- `build` = `tsc -p tsconfig.json && node esbuild.config.ts`
- `red-verify` = `format:check && lint && typecheck && typecheck:client`
- `test` = `vitest run`

### Epic Acceptance Gate

```bash
cd /Users/leemoore/code/md-viewer/app && npm run verify-all
```

This runs: `npm run verify && npm run test:e2e`

---

## CLI Verification

Codex CLI verified operational on 2026-03-23. Simple echo command succeeded. Using gpt-5.4 model (config default).

---

## Boundary Inventory

| Boundary | Status | Story | Notes |
|----------|--------|-------|-------|
| tar-stream (npm) | installed | E8-S0 | Package tar read/write dependency |
| commander (npm) | installed | E8-S0 | CLI framework |
| zlib (Node built-in) | not started | E8-S2 | Compression for .mpkz |
| markdown-it (existing) | integrated | E8-S1 | Already in project, used by manifest parser |
| Shiki (existing) | integrated | E8-S6 | Already in project, used by render library |
| Fastify server (existing) | integrated | E9-S0 | Server routes for package operations |
| Epic 8 library (src/pkg/) | not started | E9-S0 | Epic 9 consumes Epic 8 library |

---

## Story Sequence

### Epic 8: Package Format Foundation (7 stories)

| Story | Title | Dependencies | Risk | Expected Tests |
|-------|-------|-------------|------|----------------|
| E8-S0 | Foundation | None | Low | ~4 structural |
| E8-S1 | Manifest Parsing | S0 | Medium | ~20 |
| E8-S2 | Package Creation | S1 | Medium | ~14 |
| E8-S3 | Package Extraction | S2 | Medium | ~12 |
| E8-S4 | Package Inspection & Reading | S2 | Medium | ~19 |
| E8-S5 | CLI Interface (mdvpkg) | S4 | Medium | ~10 |
| E8-S6 | Rendering Library Exposure | S0 | Medium | ~8 |

Note: S6 depends only on S0, not S1-S5. Could theoretically run parallel with S1-S5 but implementing sequentially for simplicity.

### Epic 9: Package Viewer Integration (8 stories)

| Story | Title | Dependencies | Risk | Expected Tests |
|-------|-------|-------------|------|----------------|
| E9-S0 | Foundation | Epic 8 complete | Low | ~4 schema |
| E9-S1 | Open Package & Sidebar | S0 | High | TBD |
| E9-S2 | Mode Switching & Open Methods | S1 | Medium | TBD |
| E9-S3 | Package Creation | S2 | Medium | TBD |
| E9-S4 | Export to Package | S3 | Medium | TBD |
| E9-S5 | Manifest Editing & Sidebar Re-Sync | S4 | High | TBD |
| E9-S6 | Editing in Extracted Packages & Stale | S5 | Medium | TBD |
| E9-S7 | No-Manifest Fallback & Cleanup | S6 | Medium | TBD |

---

## Artifacts

**Epic 8:**
- Epic: `docs/spec-build/v2/epics/08--package-format-foundation/epic.md`
- Tech Design: `docs/spec-build/v2/epics/08--package-format-foundation/tech-design.md`
- Stories: `docs/spec-build/v2/epics/08--package-format-foundation/stories.md`
- Test Plan: `docs/spec-build/v2/epics/08--package-format-foundation/test-plan.md`
- No implementation prompts found.

**Epic 9:**
- Epic: `docs/spec-build/v2/epics/09--package-viewer-integration/epic.md`
- Tech Design (index): `docs/spec-build/v2/epics/09--package-viewer-integration/tech-design.md`
- Tech Design (server): `docs/spec-build/v2/epics/09--package-viewer-integration/tech-design-server.md`
- Tech Design (client): `docs/spec-build/v2/epics/09--package-viewer-integration/tech-design-client.md`
- Stories: `docs/spec-build/v2/epics/09--package-viewer-integration/stories.md`

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

  1. docs/spec-build/v2/epics/08--package-format-foundation/tech-design.md — Read. Reflect: what are the key
     architectural decisions, vocabulary, and cross-cutting patterns?
  2. docs/spec-build/v2/epics/08--package-format-foundation/epic.md — Read. Reflect: how does this story fit
     in the broader feature? What are the upstream/downstream dependencies?
  3. docs/spec-build/v2/epics/08--package-format-foundation/test-plan.md — Read. Reflect: what testing patterns
     and coverage expectations apply?
  4. [STORY — provided per-dispatch] — Read. Reflect: what are the ACs, TCs, and any spec deviations or
     gotchas to flag?

  Write your cumulative reflections to /tmp/reflection-story-N.md before touching code.

Step 3 — Write a CLI prompt and launch:
  Write a lean, execution-oriented prompt with artifact paths. Include:
  - The story's ACs and TCs
  - Key interfaces and function signatures from the tech design
  - File paths to create/modify
  - The working directory: /Users/leemoore/code/md-viewer/app
  - Instruction to run `npm run verify` after implementation
  Use gpt-5.4. Launch async via: cd /Users/leemoore/code/md-viewer/app && codex exec --json "prompt" > /tmp/codex-impl-story-N.jsonl 2>/dev/null
  Wait for completion.

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

Step 2 — Read artifacts sequentially, reflecting after each one:
  Read each file one at a time. After each file, stop and reflect on what you learned
  before reading the next. Include the story as the final read. Write cumulative
  reflections to /tmp/reflection-review-story-N.md before starting the review.

  1. docs/spec-build/v2/epics/08--package-format-foundation/tech-design.md — Read + reflect
  2. docs/spec-build/v2/epics/08--package-format-foundation/epic.md — Read + reflect
  3. docs/spec-build/v2/epics/08--package-format-foundation/test-plan.md — Read + reflect
  4. [STORY — provided per-dispatch] — Read + reflect

Step 3 — Dual review (parallel):
  A. Launch CLI for spec-compliance review:
     cd /Users/leemoore/code/md-viewer/app && codex exec --json "prompt" > /tmp/codex-review-story-N.jsonl 2>/dev/null
     Give it artifact paths and instruct: thorough code review against spec, organize by severity, check AC/TC coverage.
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

---

## Story Checkpoints

### E8-S0: Foundation — ACCEPTED

**Pre-acceptance receipt:**
- CLI evidence: Implementation `019d1cdc-2c45-7383-be47-12f5c795df50`, Review `019d1ce3-c19c-7f23-a44d-dba194f5a8df`
- Findings: None at any severity. All 11 DoD items pass.
- Gate: `npm run verify` — 71 files, 715 tests, all green
- Open risks: None

**Cumulative test count:** 715 (baseline 711 + 4 structural)

**Notes:** Clean first-pass implementation. First teammate attempt failed (Codex session incomplete), re-spawned with identical prompt — second attempt succeeded cleanly.

### E8-S3: Package Extraction — ACCEPTED

**Pre-acceptance receipt:**
- CLI evidence: Implementation `019d1d50-cd00-7092-9cd1-60521e3f5153`, Review `019d1d58-5293-70d2-a2f6-058be3fad5bd`
- Findings: P1 symlink bypass (fixed — realpath verification added). P1 missing error wrapping (fixed — READ_ERROR for input failures). P2 TC-7.3a limited coverage (accepted-risk — mechanism proven, each error code tested by its own TC).
- Gate: `npm run verify` — 74 files, 763 tests, all green
- Open risks: None

**Cumulative test count:** 763 (749 + 12 TC + 2 security hardening)

**Notes:** This is the first story where the review cycle found and fixed real security issues. The dual-review pattern (Opus + Codex) caught the symlink bypass that the implementer missed. This validates the review process for security-sensitive code.

### E8-S2: Package Creation — ACCEPTED

**Pre-acceptance receipt:**
- CLI evidence: Implementation `019d1d3e-317b-7e81-99e5-697df6c7a95e`, Review `019d1d47-be6a-7e30-85b1-ba335317a44a`
- Findings: P2 scaffold ordering not sequence-tested (accepted-risk). P2 no instanceof check (accepted-risk). P3 unused error codes (not S2 concern). P3 no isDirectory check (no TC).
- Gate: `npm run verify` — 73 files, 749 tests
- Open risks: None

**Cumulative test count:** 749

**Boundary update:** tar-stream and zlib now integrated.

### E8-S1: Manifest Parsing — ACCEPTED

**Pre-acceptance receipt:**
- CLI evidence: Implementation `019d1d2e-a5e5-7971-852e-6c6d617766c9`, Review `019d1d34-ad07-7663-98d9-b4268c340aa5`
- Findings: One minor fix (TC-1.6e assertion strengthened for regression guard). Minor accepted: @ts-expect-error on js-yaml import, test style preferences.
- Gate: `npm run verify` — 72 files, 735 tests, all green
- Open risks: None

**Cumulative test count:** 735 (baseline 711 + 4 S0 + 20 S1)

**Notes:** Clean first-pass implementation. Codex got it right without self-review iteration. Fixtures are generous (16 manifest constants) which front-loads value for Story 1. The scaffoldManifest omission from public API is intentional per tech design — it's internal to createPackage().

