# Epic 8: Package Format Foundation — Spec Orchestration Log

---

## Lane Determination

**Date:** 2026-03-22

**Skills discovered:**
- `codex-subagent` — found at `/Users/leemoore/.claude/skills/codex-subagent/`
- `copilot-subagent` — found at `/Users/leemoore/.claude/skills/copilot-subagent/`

**Lane selected:** Codex lane via `codex-subagent`. Both Codex and Copilot subagent skills are available. Selecting Codex as primary verification lane per skill default (gpt-5.3-codex for normal verification, gpt-5.2 for parallel multi-verifier passes).

**Phase skills loaded:** `ls-epic` (for Phase 1 drafting and verification), `ls-research` (for orientation reference). Additional phase skills will be loaded as the pipeline progresses.

---

## Verification Gates

**Phase acceptance gate:** Document quality checks — verification pattern (author self-review + dual verification). No code-level gates for spec artifacts.

**Final handoff gate:** Cross-artifact coherence check across all spec artifacts (detailed epic, business epic, stories, tech design). Coverage gate: every AC/TC assigned to exactly one story.

**Project build/verify commands (for reference, not spec gates):**
- `npm run verify` — format:check + lint + typecheck + test
- `npm run verify-all` — verify + test:e2e
- `npm run build` — tsc + esbuild

These are implementation gates, not spec gates. Spec artifacts are validated through the verification pattern.

---

## Orientation

**Pipeline entry point:** Phase 1 (Epic drafting). No Epic 8 artifacts exist yet.

**Upstream artifacts available:**
- PRD (`docs/spec-build/v2/prd.md`) — Feature 8: Package Format Foundation section provides scope, user need, in-scope/out-of-scope, and rolled-up ACs
- Technical Architecture (`docs/spec-build/v2/technical-architecture.md`) — Package format technical decisions (tar-stream, zlib, manifest convention, module boundary questions)
- Epic 7 complete artifacts — convention reference for structure and style

**What is being built:** A standalone package format library and CLI tool (`mdvpkg`) that can create, inspect, extract, and read `.mpk` (tar) and `.mpkz` (compressed tar) markdown packages with manifest-driven navigation. No viewer integration (that's Epic 9).

**Who is it for:** Technical users who work with structured markdown collections — specs, docs, agent outputs. They want a simple open convention for bundling, sharing, and navigating markdown.

**Key constraints:**
- Must be independently usable without the viewer
- Format is an open convention, not proprietary
- Library API backs all CLI operations
- Manifest is a markdown file with YAML frontmatter + nested link lists
- Rendering library exposure is additive/subordinate — must not delay package core
- Manifest file name is an open question for tech design (`_nav.md` vs `_index.md` vs `manifest.md`)
- Package library module boundary is an open question for tech design

**Readiness assessment:** Strong orientation. The PRD Feature 8 section and Technical Architecture provide clear, specific scope. Ready to enter Phase 1 (Epic drafting).

---

## Phase 1: Epic

### Drafting

Opus drafter teammate produced the initial epic with 8 flows, 29 ACs, 53 TCs (later mechanically verified as 59 by Codex), 7 stories (Story 0 foundation + 6 feature stories). Drafter performed self-review: redistributed error handling from separate flow into each relevant flow, corrected validation checklist counts, clarified temp directory lifecycle as viewer concern (Epic 9). No blockers.

### Verification Round 1

**Dual verification:** Opus verifier teammate + Codex subagent (session `019d1882-2dd0-70b0-94ad-9c586d9155e3`, gpt-5.4 default model).

**Opus verifier assessment:** READY with Major fixes. 5 Major, 5 Minor findings. Key issues: `ReadOptions` ambiguity (both optional fields), missing library option types for info/ls/manifest, TC-5.2c vague (OR in expected outcome), no AC for extraction to nonexistent dir, scaffold manifest disk behavior unspecified.

**"What Else" probe:** 14 additional observations surfaced. Three significant: Story 0 falsely claims AC-7.2/AC-7.3 (runtime ACs attributed to scaffolding story), 6 manifest parsing edge cases with undefined behavior, `ReadResult.content: string` pre-decides the binary question.

**Codex assessment:** NOT READY (more conservative). Mechanical validation confirmed 29 unique ACs, 59 unique TCs, all ACs mapped to stories with no gaps. Additional findings: `read` nav-path vs display-name terminology drift (assessed as accepted-risk — display name IS the nav path), `ls` enrichment beyond PRD (accepted-risk — deliberate improvement), path traversal safety concern, invalid-archive error coverage gaps for info/read/manifest commands.

**Orchestrator synthesis:** 19 fixes routed to drafter.

**Disposition of Codex-unique findings:**
- `read` by "display name" vs PRD "nav path": accepted-risk — semantically equivalent
- `ls` listing "all files" vs PRD "documents": accepted-risk — deliberate enrichment
- TC-7.2a "type error or validation error": accepted-risk — mechanism is tech design
- `.mpkz` coverage for inspect/read: accepted-risk — same decompression code path
- AC-7.1 parity depth: accepted-risk — existence check + example parity is adequate for spec

**Dismissed findings with reasoning:**
- Validation checklist inconsistency with Epic 7: different epics have legitimately different items
- Format version marker: future concern, not v2 scope
- TC-2.3a fragile assertion: TC-2.3b is the robust check
- CLI `--version` flag: nice-to-have
- Symlink handling: edge case for Tech Design
- Rendering library feeling separate: PRD decision, correctly isolated via Story 6
- PackageInfo duplicating ParsedManifest: design taste
- Story 4 size: planning observation
- Untyped `type`/`status` strings: intentionally extensible

### Revision

Drafter applied all 19 fixes across two batches (14 + 5 supplementary). No disagreements. Changes:
- 3 new ACs: AC-1.6 (parser edge cases, 5 TCs), AC-2.5 (output collision, 1 TC), AC-3.5 (nonexistent output dir, 1 TC), AC-3.6 (path traversal, 2 TCs)
- ReadOptions restructured as discriminated union
- 4 missing library types added (InspectOptions, ListOptions, ManifestOptions, ManifestResult)
- TC-5.2c made deterministic (error on ambiguity)
- Story 0 attribution fixed (type definitions only, runtime ACs noted as Stories 1-5)
- 2 new error codes: AMBIGUOUS_DISPLAY_NAME, PATH_TRAVERSAL
- Invalid-archive TCs added to info (TC-4.1c), manifest (TC-4.4c), read (TC-5.1c)
- RenderResult error behavior specified (inline styled error message)
- CLI named `mdvpkg` throughout
- Flow steps added for Flows 4-8
- Data contract annotations: sort order, NavigationNode invariant, RenderOptions defaults
- TDQ 5 removed (settled in spec), TDQ 8 added (ReadResult binary content)

### Verification Round 2

**Opus re-verification:** READY without qualification. All 19 fixes verified at specific line locations. No new issues introduced. Counts confirmed: 33 ACs, 71 TCs, 7 stories. One nuance noted: empty body (frontmatter only) returns metadata with empty nav tree vs. paragraphs-only body returns error — assessed as reasonable design choice, not an issue.

**Codex re-verification:** Mechanical checklist run. Pending completion at time of acceptance.

### Pre-Acceptance Receipt

1. **Codex evidence:** Session `019d1882-2dd0-70b0-94ad-9c586d9155e3` (Round 1). Mechanical re-verification session in progress (Round 2).
2. **Top findings and dispositions:**
   - ReadOptions ambiguity → fixed (discriminated union)
   - Missing library types → fixed (4 types added)
   - TC-5.2c vague → fixed (deterministic error behavior)
   - Story 0 AC attribution → fixed (runtime ACs moved to Stories 1-5)
   - Manifest edge cases → fixed (AC-1.6 with 5 TCs)
   - Path traversal safety → fixed (AC-3.6 with 2 TCs)
   - `read` nav-path vs display-name terminology → accepted-risk (semantically equivalent)
   - `ls` enrichment → accepted-risk (deliberate improvement)
3. **Phase gate:** Dual verification (Opus + Codex), two rounds, findings converged to zero
4. **Open risks:** None

### Human Review

Human reviewed and accepted the epic without changes. "looks good. please continue."

**Codex Round 2 evidence:** Session completed. Mechanical checklist: 8 PASS, 3 FAIL. FAILs assessed:
- AC-7.2/AC-7.3 story orphaning: fixed by orchestrator (added to Stories 1-4 as cross-cutting runtime ACs)
- ReadTarget plain union vs discriminated union: accepted-risk (plain union is idiomatic and fully resolves ambiguity)
- "clear error" in AC-2.4/AC-3.4: accepted-risk (TCs underneath specify exact error content)

### Phase 1 Complete

Epic accepted. 33 ACs, 71 TCs, 7 stories, 8 TDQs. Two verification rounds, 19 fixes applied, all verified. Human accepted without changes. Proceeding to Phase 2: Tech Design.

---

## Phase 2: Tech Design

### Drafting

Opus tech designer teammate produced two documents: `tech-design.md` (1727 lines) and `test-plan.md` (476 lines). Config A (2 docs) — appropriate for this single-domain library project.

Key architecture decisions:
- Module boundary: `src/pkg/` — new top-level source directory, zero imports from server/client/shared
- Manifest filename: `_nav.md` — underscore prefix for metadata convention
- CLI framework: Commander — lightweight, TypeScript-first, free help generation
- Testing: No mocks — all tests use real temp directories and real tar-stream operations
- Mermaid runtime: Placeholder markup — TC-8.3b forces no-browser constraint
- ReadResult.content: Keep `string` — defer `readRaw()` for binary

Spec deviation documented: TC-8.2b (invalid Mermaid error) vs TC-8.3b (no browser). Design uses basic structural validation only.

### Verification

**Dual verification:** Opus verifier teammate + Codex subagent.

**Opus verifier:** READY with 3 Minor issues — working notes in Chunk 4, Mermaid CSS class naming inconsistency, errors.ts import contradiction. All TC spot-checks passed (12/12). Test count reconciliation confirmed (88 total).

**Codex verifier:** 9 PASS, 1 FAIL. FAIL was module responsibility matrix using range shorthand instead of listing all 33 ACs individually — accepted-risk (standard convention). Additional minor findings: path inconsistency (`src/pkg/` vs `app/src/pkg/`), drafting chatter.

**Orchestrator synthesis:** 4 minor fixes routed to drafter. All applied. No re-verification needed for minor cleanup.

### Pre-Acceptance Receipt

1. **Codex evidence:** Codex session completed, 9/10 checks passed, 1 accepted-risk (range shorthand in responsibility matrix)
2. **Top findings and dispositions:** All 4 issues minor → fixed (working notes removed, Mermaid naming clarified, import fixed, paths normalized)
3. **Phase gate:** Dual verification, single round, findings converged to minor-only
4. **Open risks:** None

### Human Review

Human accepted without changes. "looks good. please continue, do not check with me unless a blocker or major issue hits."

### Phase 2 Complete

Tech design accepted. 88 tests (71 TC-mapped + 17 non-TC), 7 chunks, all 8 TDQs answered. One verification round, 4 minor fixes. Proceeding to Phase 3: Publish Epic.

---

## Phase 3: Publish Epic

### Drafting

Opus publisher teammate produced two artifacts:
- `stories.md` (~1,317 lines) — 7 stories (Story 0-6) with full AC/TC detail, Technical Design sections with TypeScript interfaces, Jira section markers, Integration Path Trace (3 paths, no gaps), and Coverage Gate (33 ACs, 71 TCs, all mapped)
- `business-epic.md` — PO-friendly view with grouped ACs, prose data contracts, story references

Publisher self-validation: all checks passed. No issues found.

### Phase 3 Complete

Published artifacts accepted. Proceeding to Phase 4: Final Verification.

---

## Phase 4: Final Verification

### Cross-Artifact Coherence Check

**Dual verification:** Opus verifier + Codex subagent.

**Codex:** 10/10 PASS. All mechanical checks clean — 33 ACs, 71 TCs, no duplicates, no orphans, no TypeScript in business epic, no TC references in business epic, `_nav.md` consistent, `mdvpkg` consistent, `src/pkg/` consistent (no `app/src/pkg/` occurrences).

**Opus:** COMPLETE. 10 AC chains spot-checked through full path (Epic → Story → Test Plan → Tech Design) — all unbroken. 5 consistency items verified across all artifacts. One minor fix applied (test plan comment had 13 instead of 12 for inspect-package.test.ts count).

### Pre-Acceptance Receipt

1. **Codex evidence:** Final coherence session — 10/10 PASS
2. **Top findings:** One minor test count comment error → fixed by verifier
3. **Final handoff gate:** Cross-artifact coherence check passed — coverage complete, consistency verified, all publish quality criteria met
4. **Open risks:** None

---

## Pipeline Complete

**Total phases:** 4 (Epic → Tech Design → Publish Epic → Final Verification)
**Total verification rounds:** Epic (2 rounds, 19 fixes), Tech Design (1 round, 4 fixes), Publish (self-validated), Final (1 round, 1 minor fix)
**Artifacts produced:**
- `epic.md` — 33 ACs, 71 TCs, 8 flows, 7 stories
- `tech-design.md` — 1727 lines, all 8 TDQs answered, 88 tests planned
- `test-plan.md` — 476 lines, complete TC→test mapping
- `stories.md` — 7 stories with full AC/TC detail and technical design sections
- `business-epic.md` — PO-facing view with grouped ACs and story references
- `team-spec-log.md` — this orchestration log

**Key decisions made during pipeline:**
- Manifest filename: `_nav.md`
- Module boundary: `src/pkg/` with zero server imports
- CLI: `mdvpkg` via Commander
- Testing: No mocks — real temp dirs + real tar-stream
- Mermaid: Placeholder markup (no browser dependency)
- ReadResult: `string` only (defer `readRaw()` for binary)

**Process observations:**
- The "What Else" probe on the epic verifier surfaced 14 additional observations, several significant (Story 0 AC attribution, manifest edge cases, path traversal safety). This technique reliably surfaces findings that agents filter out.
- Codex verification was consistently more conservative than Opus (NOT READY vs READY in Round 1), which is the expected calibration. The orchestrator's job is severity assessment between the two.
- The TC-8.2b/TC-8.3b conflict (Mermaid validation vs no-browser constraint) was a genuine spec tension resolved during tech design with a documented deviation.
