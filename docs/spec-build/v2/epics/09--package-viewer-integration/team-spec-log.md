# Epic 9: Package Viewer Integration — Spec Orchestration Log

---

## Lane Determination

**Date:** 2026-03-22

**Skills discovered:**
- `codex-subagent` — found at `/Users/leemoore/.claude/skills/codex-subagent/`
- `copilot-subagent` — found at `/Users/leemoore/.claude/skills/copilot-subagent/`
- `gpt53-codex-prompting` — not checked (not required)

**Lane selected:** Codex lane via `codex-subagent`. Using `gpt-5.3-codex` for normal verification, `gpt-5.2` reserved for parallel multi-verifier diversity passes if needed.

**Phase skills loaded:** `ls-epic` (Phase 1 drafting and verification), `ls-research` (orientation reference). Additional phase skills (`ls-tech-design`, `ls-publish-epic`) will be loaded as the pipeline progresses.

---

## Verification Gates

**Phase acceptance gate:** Document quality checks — verification pattern (author self-review + dual verification with Codex evidence). No code-level gates for spec artifacts.

**Final handoff gate:** Cross-artifact coherence check across all spec artifacts (detailed epic, business epic, stories, tech design). Coverage gate: every AC/TC assigned to exactly one story.

**Project build/verify commands (for reference, not spec gates):**
- `npm run verify` — format:check + lint + typecheck + test
- `npm run verify-all` — verify + test:e2e
- `npm run build` — tsc + esbuild

These are implementation gates, not spec gates. Spec artifacts are validated through the verification pattern.

---

## Orientation

**Pipeline entry point:** Phase 1 (Epic drafting). No Epic 9 artifacts exist yet.

**Upstream artifacts available:**
- PRD (`docs/spec-build/v2/prd.md`) — Feature 9: Package Viewer Integration section provides scope, user need, in-scope/out-of-scope, and rolled-up ACs
- Technical Architecture (`docs/spec-build/v2/technical-architecture.md`) — Package extraction strategy, REST endpoints, system shape, manifest convention, open questions
- Epic 7 complete artifacts (`docs/spec-build/v2/epics/07--e2e-testing-framework/`) — convention reference for structure and style

**Parallel work awareness:**
- Epic 7 is in active implementation (stories being coded)
- Epic 8 (Package Format Foundation) spec pipeline is running concurrently — orientation complete, Phase 1 (Epic drafting) in progress. Epic 8 defines the package format library and CLI that Epic 9's viewer integration consumes.

**What is being built:** Viewer integration for the markdown package format. The viewer learns to open `.mpk`/`.mpkz` files, display manifest-driven navigation in the sidebar, create new packages from folders, export packages, edit manifests, and handle the full round-trip of package creation → browsing → editing → export.

**Who is it for:** Technical users who work with structured markdown collections and want to browse, create, and share packages directly in the viewer rather than using CLI tools only.

**Key constraints:**
- Depends on Epic 8's library (tar read/write, manifest parser, format spec) — Epic 9 does NOT re-implement these
- Package extraction goes to a temp directory; existing file-reading APIs work on extracted contents
- Manifest file name convention will be settled by Epic 8's tech design — Epic 9 references it as a dependency
- Must handle both package mode (manifest-driven nav) and filesystem mode (existing behavior) with clear mode switching
- Vanilla JS frontend — no framework introduction for package-mode sidebar
- Editing in extracted packages modifies temp files; re-export persists changes back to package file
- Fallback to filesystem-scan mode when manifest is missing
- Out of scope: Chat/Steward integration (Epic 13), spec-specific conventions (Epic 13), remote URLs, multiple manifests

**Key open questions for Epic 9 tech design (not spec blockers):**
- Temp directory lifecycle management (cleanup on close, quit, startup)
- Manifest update propagation timing (on save? debounced? explicit refresh?)
- Package metadata display location and format in the UI
- How drag-and-drop package opening interacts with current workspace state

**Readiness assessment:** Strong orientation. The PRD Feature 9 section, Technical Architecture, and the Epic 8 context provide clear, specific scope. The dependency on Epic 8's library is well-defined at the interface level. Ready to enter Phase 1 (Epic drafting).

---

## Human Override: Autonomous Completion

**Date:** 2026-03-22 (late evening)

The human instructed the orchestrator to complete the full spec pipeline autonomously without stopping for human review at phase boundaries. Reason: human going to sleep, wants the complete artifact set ready on return.

This overrides the default human review gates at:
- Phase 1 (epic human review) — skipped
- Phase 2 (tech design human review) — skipped
- Phase 3 (publish epic human review) — skipped
- Phase 4 (final verification human review) — skipped

All verification patterns still run (dual verification with Codex). The human will review the complete artifact set post-hoc.

---

## Phase 1: Epic — Verification Log

### Round 1 (Opus independent review, Codex partial)

**Findings:** 2 Critical, 8 Major, 7 Minor across both reviewers.

Key issues:
- C1: AC-4.4/AC-8.3 contradiction (New Package disabled for all extracted packages vs needed for no-manifest fallback)
- C2: AC-6.3/TC-6.3a/AC-4.3 empty-manifest contradiction (is empty-navigation valid or invalid?)
- M1: AC-1.3 missing error TCs for CLI argument
- M2: AC-6.3 needed split into AC-6.3 (unparseable) + AC-6.4 (empty nav)
- M3: Stale indicator semantics for export to different path
- M4: Story 0/7 AC duplication
- M5: hasManifest boolean insufficient — needed manifestStatus enum
- M6: Rendering parity (Mermaid/syntax highlighting) not traced
- M7: Manifest naming deferred to Epic 8 (accepted-risk — process note only)
- M8: Flow narratives happy-path only

**Dispositions:**
- All Critical and Major issues: fixed
- M7: accepted-risk (Epic 8 is the right place to settle manifest naming)
- m3 (sourceDir ambiguity): accepted-risk
- m5 (non-markdown-only package): accepted-risk
- m7 (export overwrite): accepted-risk (OS save dialog handles natively)
- All other minors: fixed

All fixes applied by drafter, confirmed with line references.

### Round 2 (Opus re-read + Codex targeted re-verification)

**Findings:** 1 Major, 4 Minor. All round 1 fixes verified as correctly applied.

- R2-M1: The M5 fix (manifestStatus enum adding 'unreadable') created a new edge case: what happens when New Package is used on an extracted package with an unreadable manifest? AC-4.4 said "with a manifest" (ambiguous whether unreadable counts), AC-8.3 said "no-manifest package" (too narrow). Both Codex and Opus flagged independently.
- R2-m1: AC-8.2 heading said "no manifest" but now covers unreadable too — needed broadening
- R2-m2: TC-4.1d ordering cosmetic
- R2-m3: Story 3 description stale after AC-4.4 revision
- R2-m4: AC-9.1 still had soft "eligible for cleanup" wording

**Dispositions:** All fixed. AC-4.4 now says "parseable manifest," AC-8.3 covers "missing or unreadable," TC-8.3b added for overwrite confirmation on unreadable manifest.

### Phase 1 Acceptance

**Epic accepted.** Verification converged across 2 rounds: round 1 (2 Critical, 8 Major) → round 2 (1 Major, 4 Minor) → all resolved. No remaining Critical or Major findings. Human review skipped per autonomous completion override.

**Codex evidence:** Round 1 Codex output at `/tmp/codex-epic9-verify.jsonl`, Round 2 at `/tmp/codex-epic9-verify-r2.jsonl`. Codex confirmed the AC-4.4/AC-8.3 contradiction (C1) and the manifestStatus gap (R2-M1) independently.

**Pre-acceptance receipt:**
1. Codex evidence: `/tmp/codex-epic9-verify.jsonl` (R1), `/tmp/codex-epic9-verify-r2.jsonl` (R2)
2. Top findings and dispositions: C1 (fixed), C2 (fixed), M1-M8 (6 fixed, 2 accepted-risk), R2-M1 (fixed)
3. Phase gate: document quality verification pattern — 2 rounds, dual verification (Opus + Codex)
4. Open risks: M7 (manifest file name deferred to Epic 8 — accepted-risk, not a spec blocker)

**Final stats:** 30 ACs, 67 TCs, 5 REST endpoint contracts, 8 stories, 11 tech design questions. Epic is ready for Tech Design.

---

## Phase 2: Tech Design — Verification Log

### Drafting

Config B (4 docs): index + server companion + client companion + test plan. Drafter read the epic, explored the codebase (routes, services, state, sidebar, schemas), validated the spec, answered all 11 Tech Design Questions, and produced the full design.

Key design decisions:
- Eliminated GET /api/package/file — existing /api/file works transparently on extracted temp dirs via absolute paths (validates A3)
- Manifest re-sync via client-initiated re-fetch (not WebSocket push)
- Stale detection via flag-on-write (not mtime comparison)
- Drag-and-drop deferred for browser-only mode (File API path limitation); works in Electron
- Session state extended with activePackage for restart recovery
- Sidebar mode switch via DOM mount/unmount (vanilla JS pattern)

### Verification (Round 1 — Opus + Codex)

**Findings:** 0 Critical, 5 Major, 7 Minor.

Key issues:
- M1: Test count arithmetic errors (58→67 TCs, non-TC count mismatches)
- M2: Route error handling collapsed distinct error paths
- M3: Server stale tracking integration point missing (post-save hook)
- M4: Filesystem mode indicator not rendered (AC-2.2b)
- M5: Fallback mode not restorable on startup (manifestStatus not persisted)

**Dispositions:**
- All Major: fixed
- m1 (NotImplementedError), m3 (fallback prose/code align), m4 (displayName lookup), m5 (endpoint name): fixed
- m2 (Epic 8 dryRun dependency): accepted-risk (documented in Open Questions)
- m6 (Epic 8 hard gates): accepted-risk (documented)
- m7 (collapse state/E2E): accepted-risk (acceptable deferral)

All fixes applied. No round 2 needed — fixes were mechanical/additive, verifier pre-assessed READY conditioned on fixes.

### Phase 2 Acceptance

**Tech design accepted.** Verification converged in 1 round with no Critical findings. Human review skipped per autonomous completion override.

**Pre-acceptance receipt:**
1. Codex evidence: `/tmp/codex-td9-verify.jsonl`
2. Top findings: M1-M5 (all fixed), m1-m7 (4 fixed, 3 accepted-risk)
3. Phase gate: document quality verification pattern — 1 round, dual verification (Opus + Codex)
4. Open risks: Epic 8 dependency (manifest filename convention, dryRun scaffold option)

**Final stats:** 4 documents, 80 tests (68 TC-mapped + 12 non-TC), 8 chunks, all 67 TCs mapped, all 11 TDQs answered.

---

## Phase 3: Publish Epic — Verification Log

### Drafting

Two artifacts produced: `stories.md` (8 stories with Jira markers, 30 ACs, 67 TCs, integration path trace, coverage gate) and `business-epic.md` (PO-facing view with grouped ACs, prose data contracts, no TCs, no TypeScript).

### Verification (Round 1 — Opus + Codex)

**Findings:** 0 Critical, 0 Major, 0 Minor. All 7 Codex mechanical checks PASS. Independent review PASS on all criteria.

Cleanest verification pass in the pipeline — the ls-publish-epic skill's structured approach (coverage gate + integration path trace) catches issues mechanically. The drafter's self-review was accurate.

### Phase 3 Acceptance

**Published artifacts accepted.** Human review skipped per autonomous completion override.

**Pre-acceptance receipt:**
1. Codex evidence: `/tmp/codex-pub9-verify.jsonl` — 7/7 mechanical checks PASS
2. Top findings: none
3. Phase gate: dual verification (Opus + Codex), mechanical coverage checks
4. Open risks: none

---

## Phase 4: Final Verification — Coherence Check

### Cross-Artifact Coherence (Opus + Codex)

All 7 artifacts read and cross-checked. 6 coherence checks run:

| Check | Result |
|---|---|
| Coverage completeness (AC/TC → stories → test plan) | PASS |
| Cross-story seam integrity | PASS (after fix) |
| Business epic fidelity | PASS |
| Type/contract consistency | PASS |
| Terminology consistency | PASS |
| TDQ answer alignment | PASS (after fix) |

Two minor fixes applied directly by verifier:
1. Story 7 missing Story 6 as explicit dependency (stale indicator needed for TC-8.3a/b) — added
2. Tech design index referenced wrong HTTP verb for file save endpoint — corrected to PUT /api/file

Codex flagged 5 items: 2 genuine (fixed), 3 false positives (documented deviation, intentional cross-boundary naming, client-derived field).

### Phase 4 Acceptance

**Final coherence check PASSED.** All artifacts are coherent and complete. Human review skipped per autonomous completion override.

**Pre-acceptance receipt:**
1. Codex evidence: `/tmp/codex-final9-verify.jsonl`
2. Top findings: 2 minor fixes applied (Story 7 dependency, endpoint verb)
3. Phase gate: cross-artifact coherence check — 6/6 checks PASS
4. Open risks: Epic 8 dependency (manifest filename convention, library API surface)

---

## Pipeline Completion

**Date:** 2026-03-23

**Total phases run:** 4 (Epic → Tech Design → Publish Epic → Final Verification)

**Total verification rounds:** 6 (Phase 1: 2 rounds, Phase 2: 1 round, Phase 3: 1 round, Phase 4: 1 round)

**Artifact set:**
| Artifact | File | Status |
|---|---|---|
| Detailed Epic | `epic.md` | Accepted — 30 ACs, 67 TCs, 9 flows |
| Tech Design Index | `tech-design.md` | Accepted — decisions, context, module architecture, work breakdown |
| Tech Design (Server) | `tech-design-server.md` | Accepted — PackageService, routes, temp management |
| Tech Design (Client) | `tech-design-client.md` | Accepted — sidebar modes, menu, stale indicator |
| Test Plan | `test-plan.md` | Accepted — 80 tests, all 67 TCs mapped |
| Story File | `stories.md` | Accepted — 8 stories, coverage gate clean |
| Business Epic | `business-epic.md` | Accepted — PO-facing, prose contracts, grouped ACs |
| Orchestration Log | `team-spec-log.md` | This file |

**Significant process decisions:**
- Human override: autonomous completion (no human review at phase boundaries)
- Config B for tech design (4 docs) — justified by dual-domain scope
- GET /api/package/file eliminated in tech design — existing /api/file works transparently
- Drag-and-drop deferred for browser-only mode (Electron works via preload bridge)
- Epic 8 manifest filename convention accepted as dependency (not settled in Epic 9)

**Recommendations for future runs:**
- The test count reconciliation trap (M1 in Phase 2) suggests building a mechanical count check into the drafter's self-review workflow
- Phase 3 (Publish Epic) was the cleanest phase — the ls-publish-epic skill's mechanical coverage gate catches issues before verification
- Codex verification is most valuable at Phase 1 (epic) — it found the manifestStatus gap and route error handling issues that Opus missed initially
