# Team Spec Log — MD Viewer v2

## Lane Determination

**Date:** 2026-03-22

Skills found:
- `codex-subagent` — available (Codex CLI v0.104.0+, gpt-5.4 default)
- `copilot-subagent` — available (not selected, Codex preferred)
- `ls-epic` — loaded
- `ls-prd` — loaded (used during PRD authoring in this session)
- `ls-team-spec-c` — loaded (orchestration skill)

**Lane selected:** Codex lane via codex-subagent.

Model selection:
- `gpt-5.4` (codex default) for normal drafting verification and routine single-review passes
- `gpt-5.2` only if running parallel multi-verifier diversity passes

## Verification Gate Discovery

**Source:** `app/package.json` scripts section. No project-level CLAUDE.md or AGENTS.md.

**Phase acceptance gate:**
- `cd app && npm run verify` — runs format:check, lint, typecheck, typecheck:client, test

**Build gate:**
- `cd app && npm run build` — runs tsc + esbuild

**Final handoff gate:**
- `cd app && npm run verify && npm run build`

Note: Epic 7 (E2E Testing Framework) is a spec-only phase — no code changes. Phase acceptance gates are document quality checks + Codex verification. Code verification gates apply starting at implementation.

## Orientation

**Artifacts available:**
- v2 PRD: `docs/spec-build/v2/prd.md` — reviewed, Codex-verified, all findings addressed
- v2 Tech Architecture: `docs/spec-build/v2/technical-architecture.md` — reviewed, Codex-verified, all findings addressed
- v1 PRD + all 6 v1 epics: `docs/spec-build/v1/` — complete, implemented, shipped

**Pipeline entry point:** Phase 1 (Epic) — PRD and tech arch are accepted. Starting with Epic 7: E2E Testing Framework.

**Context:** Epic 7 establishes the E2E testing framework on the existing v1 surface before any new v2 features are built. Every subsequent epic (8–14) adds E2E tests as part of its stories. The framework needs to cover browser automation, API testing, and WebSocket testing patterns — all building blocks needed by later epics.

---

## Phase 1: Epic — Epic 7 (E2E Testing Framework)

### Drafting — Round 1

Drafter spawned as Opus teammate. Read PRD, tech arch, existing test structure, and v1 Epic 1 for quality reference. Produced 10 flows, 22 ACs, 44 TCs, 5 stories. Self-review found no issues — the drafter flagged three open concerns: export E2E complexity with Puppeteer coexistence (A5), workspace root selection mechanism (Tech Design Q2), and filesystem watcher timing (A2). All appropriately deferred.

### Verification — Round 1

Dual verification: Opus teammate + Codex subagent (gpt-5.4, high reasoning).

**Opus assessment:** READY with Major/Minor fixes. Found 5 Major and 6 Minor issues. Strongest catches: missing test failure reporting AC (M4), Flow 10 ACs not testable in standard methodology (M2), missing server startup failure path (M3). Also surfaced 6 additional observations in the "what else" sweep — server restart mid-test as a Tech Design Question, image rendering gap, and console error monitoring were the most valuable.

**Codex assessment:** NOT READY. Found 4 Critical issues. However, one Critical was incorrect — Codex claimed WebSocket file watching was scope drift from the PRD, but the PRD explicitly lists "E2E test patterns for WebSocket connections (file watching)" in Feature 7's in-scope bullets. Dismissed. A second Critical (workspace selection ambiguity) was overgraded — the mechanism is properly deferred to Tech Design Question #2. Downgraded to Minor. The remaining two Criticals (export outcome verification and image rendering gap) overlapped with Opus findings and were legitimate.

**Synthesis decisions:**
- Codex C1 (WebSocket scope drift): **Dismissed** — incorrect reading of PRD
- Codex C2 (workspace ambiguity): **Downgraded to Minor** — TC wording fix, mechanism properly deferred
- Export tightening: **Fix** (consensus between both reviewers)
- Image rendering gap: **Fix** (consensus)
- Flow 10 testability: **Fix** (consensus)
- Server startup failure: **Fix** (Opus only, good catch)
- Test failure reporting: **Fix** (Opus only, significant gap)
- 9 Minor fixes routed

14 total fixes dispatched to drafter. 4 new Tech Design Questions added (server restart mid-test, serial vs parallel, debug script, console error monitoring).

**Process deviation — Codex dispatch ownership.** The orchestrator launched and managed the Codex subagent directly instead of having the Opus verifier fire it. This violated the skill's prescribed pattern where the verifier owns its own Codex dispatch and returns a consolidated report. The consequence: the orchestrator burned context reading raw Codex output and performing synthesis that should have been the verifier's job. The result quality was fine, but the context cost was unnecessary and doesn't scale across multiple verification rounds.

**Root cause:** The procedure describes Codex dispatch in paragraph prose within the verification pattern section. When composing the verifier prompt ad-hoc, the orchestrator optimized for speed and handled Codex dispatch itself rather than delegating.

**Recommended skill changes (for future ls-team-spec-c update):**
1. Add a 4th hard invariant to the Control Contract: "The orchestrator never directly manages Codex subagents. Verification agents own their own Codex dispatch and return consolidated reports."
2. Add an explicit verifier prompt template to the skill that includes Codex dispatch instructions built in, so the orchestrator copies the template rather than composing from memory. Composing from memory loses steps; copying a template preserves them.

Corrected for Round 2 — the re-verification verifier was spawned with Codex dispatch instructions included in its prompt.

### Revision — Round 1

Drafter applied all 14 fixes. AC count increased from 22 to 27 (added AC-1.5, AC-3.6, recounted). All 27 ACs mapped across Stories 0-4. Four new Tech Design Questions (8-11) added. Validation checklist re-verified.

### Verification — Round 2

Fresh verifier spawned with Codex dispatch instructions built into its prompt. Verifier fired Codex (gpt-5.4, session `019d17b6-b94c-7862-9882-bdb1b713113a`) and returned a consolidated report — correct process this time.

**Fix verification:** 13 of 14 fixes LANDED clean. Fix 14 (NFR softening) was PARTIAL — the suite-level NFR was softened but the per-file NFR and assumption A6 still used hard-requirement language.

**New issues from Round 2:** 5 Minor items total. 3 accepted as fixes (M1: per-file NFR language, M4: export narrative mismatch, M5: A6 assumption language). 2 accepted-risk (M2: theme TC vagueness is correct functional level, M3: TC-4.3a fallback clause is documenting general behavior).

**Codex called NOT READY; verifier overrode.** Codex graded conservatively (as expected — calibration note from the skill). The verifier correctly assessed that the remaining items were trivial text fixes, not structural issues. Orchestrator agrees.

3 trivial text fixes applied by orchestrator directly (single-word changes, no structural impact):
1. Per-file NFR: "complete in" → "target completion in"
2. A6 assumption: "stays under" → "targets under"
3. Export flow narrative: "initiates and completes without error" → "completes and produces an exported file"

**Round 2 assessment: READY for Tech Design.** 27 ACs, all mapped to stories, all with proper G/W/T test conditions. No Critical or Major issues remaining.

---

## Process Failure: Unresearched Technology Choices in PRD and Tech Architecture

**Severity:** High — this is a systemic process gap, not a one-off mistake.

**What happened:** The v2 Tech Architecture document lists Playwright as the E2E testing framework with no research into alternatives. The orchestrator wrote it into the core stack table based on training data consensus, not current market research. The same pattern applies to other core stack choices in the tech arch — they were asserted based on model knowledge, not validated against current options.

**Why it matters:** Core stack choices are load-bearing. Playwright becomes infrastructure that every epic from 7 through 14 builds on. If a better option exists (or if Playwright has been superseded), the cost of discovering that late is enormous — it means reworking test infrastructure across the entire v2 surface. The same risk applies to every major technology choice in the PRD and tech arch: framework, data layer, styling, build tools, etc.

**The specific failure:** Neither the PRD nor the tech arch went through a research phase for major technology decisions. The orchestrator treated stack choices as settled knowledge rather than as hypotheses requiring validation. No web research was conducted. No alternatives were evaluated. No trade-off analysis was performed. The confidence was based entirely on the model's training data, which has a cutoff date and cannot reflect the current state of the ecosystem.

**Root cause — ls-prd skill gap:** The ls-prd skill describes the Core Stack table as "decisions that constrain everything downstream" and says each choice needs a rationale. But it does not mandate a research step before those decisions are made. The rationale column gets filled with plausible-sounding justifications derived from training data rather than from actual research into current alternatives. The skill should require that any core stack choice that introduces a new dependency or selects between competing alternatives goes through a research gate before being written into the tech arch.

**Recommended ls-prd skill update:**

Add a section between "Architecture Summary" and "Feature Sections" (or as a subsection of the Tech Architecture Document template) called "Technology Research Gates":

1. **Identify research-required decisions.** During PRD/tech arch drafting, flag any core stack choice where: (a) a new dependency is being introduced, (b) there are known competing alternatives, or (c) the ecosystem has moved significantly since the model's training data. These are research-required decisions.

2. **Conduct current-state research.** For each flagged decision, perform web research to identify: the current leading options, recent entrants that may not be in training data, comparative trade-offs for the specific project context, and any relevant shifts in community consensus or adoption.

3. **Document the evaluation.** For each researched decision, produce a brief evaluation: options considered, trade-offs for this project, recommendation with rationale. This evaluation is captured in the tech arch or as a supporting research artifact.

4. **Do not write the core stack table from training data alone.** The model's knowledge of "what's popular" is frozen at its training cutoff. Stack decisions that will be load-bearing for months of downstream work deserve 15 minutes of web research, not a confident guess.

**Immediate action for this pipeline:** Before proceeding to human review of Epic 7, research the current E2E testing landscape. If Playwright is still the right choice, document why with evidence. If something better exists, update the tech arch and epic before they go downstream.

**Broader pattern to watch for:** This same failure mode applies beyond E2E testing. Any time the orchestrator or drafter writes a technology name into a spec without research, it's the same problem. The ls-prd skill update should make this a structural guard, not something that depends on the orchestrator remembering to research.

### Human Review

User reviewed the epic. Accepted with one exception: the Playwright choice was unresearched (see process failure above). Research was conducted and Playwright was validated. User signed off on both the epic content and the framework choice. Added "Notes for Tech Design" section to the epic documenting the research validation.

**Epic 7 Phase 1 ACCEPTED.**

---

**E2E research outcome:** Research conducted (`.research/outputs/e2e-testing-landscape-2026.md`). Playwright confirmed as the right choice with evidence — WebSocket testing support is the key differentiator (native `page.routeWebSocket()` vs no native support in Cypress). Vitest + Playwright is the documented standard 2026 stack. Agent Browser from Vercel is not a testing tool but has a different valuable use case (see below).

---

## Process Enhancement: Gorilla Testing with Agent Browser (for ls-team-impl)

**What:** Add an automated gorilla testing stage to the implementation orchestration process (ls-team-impl / ls-team-impl-c). At epic closeout, after all stories pass and the deterministic E2E suite is green, launch an Agent Browser-driven AI agent to exploratorily test the app. The agent navigates the app with context about what changed, pokes around, tries edge cases, and reports anything broken or unexpected. If issues are found, the orchestrator triages and dispatches fixes before closing the epic.

**Where this lives:**

1. **Per-project gorilla testing file** — NOT in CLAUDE.md (too broad). A dedicated file (e.g., `gorilla-testing.md` or similar) that provides instructions, focus areas, and scenarios for the gorilla agent. The orchestrator reads this file when it's time to run gorilla testing. This file can be project-specific.

2. **Tech design responsibility** — Each epic's tech design should determine what gorilla testing scenarios are relevant for that epic's changes. The tech design says "gorilla testing should at least cover these scenarios" and the implementation orchestrator uses that guidance when launching the gorilla agent.

3. **ls-team-impl skill update** — Add a gorilla testing phase to the implementation orchestration, after verification passes and before epic closeout. The orchestrator checks for the gorilla testing file, loads it, and dispatches an Agent Browser agent with the relevant context and scenarios.

**Tooling:** Vercel Agent Browser (CLI, Rust-based, accessibility-tree snapshots, token-efficient). The agent uses Agent Browser to navigate and observe; it reports findings in plain text back to the orchestrator. Not a replacement for deterministic Playwright tests — a complement that catches the category of bugs scripted tests miss.

**Action items:**
- Update ls-team-impl / ls-team-impl-c skills to include gorilla testing stage
- Create prompts/instructions for the gorilla testing agent
- Define the per-project gorilla testing file convention
- Potentially create an ls-gorilla skill or integrate into existing verification flow

---

## Phase 2: Tech Design — Epic 7 (E2E Testing Framework)

### Drafting

Tech designer spawned with two-phase approach: Phase A (validate epic + research dependencies) then Phase B (full tech design). Phase A reported back with clean epic validation, all 11 Tech Design Questions answered from codebase analysis, and dependency research confirming `@playwright/test@^1.58.0` as sole dependency with no conflicts. User reviewed and approved dependency choices.

Phase B produced 1,302-line tech design with all three altitudes, spiral pattern, complete TC → test mapping (34 tests across 4 spec files), and 5 chunks aligned with Stories 0-4.

### Verification

Dual verification: Opus verifier with Codex dispatch (correct process). Codex came in late with supplementary findings.

**Round 1 (Opus):** READY with 2 Major and 4 Minor items. All documentation/spec-alignment fixes, no design changes.

**Codex supplement:** Added 2 Major and 3 Minor items. Key catches:
- M3: Request body field name `path` vs `root` — would have caused 400 errors if engineer copy-pasted from design. Genuine bug.
- M4: TC-1.1d cannot be deferred without epic amendment — valid process point. Restored as real test.
- m5: TC-2.1b empty state precondition conflict — globalSetup vs no-workspace test ordering.

**Total fixes:** 4 Major, 6 Minor. All applied by tech designer across two batches. No re-verification needed — all fixes were documentation/precision changes, no architectural redesign.

**Phase 2 ACCEPTED.** Tech design ready for Phase 3 (Publish Epic).

### Phase 3: Publish Epic

Tech designer produced both artifacts: story file (805 lines, 5 stories, 50 TCs mapped) and business epic (237 lines, 0 code blocks, grouped ACs with story references). Coverage gate confirmed: 27 ACs, 50 TCs, all mapped to exactly one story, no orphans. Integration path trace: 3 critical paths, no gaps.

### Phase 4: Final Verification

Cross-artifact coherence check by fresh Opus verifier with Codex dispatch. Three Major issues found and fixed directly by the verifier:

1. AC-2.1 chunk/story boundary mismatch between tech design and story file — fixed (moved AC-2.1 to Chunk 0)
2. TC-1.1d behavior conflict between epic's single-outcome wording and tech design's dual-outcome — fixed (aligned story to reflect both possibilities)
3. TC-1.4c verify vs verify-all — already documented as deliberate deviation, confirmed adequate

One Minor fix: `getRenderedContent` helper missing from Story 0 scope — added.

**PASS.** All 4 artifacts are internally consistent and mutually coherent. Coverage complete. Business epic accurately compresses the detailed epic.

---

## Epic 7 Pipeline Complete

**Artifacts delivered:**
- `docs/spec-build/v2/epics/07--e2e-testing-framework/epic.md` — detailed epic (27 ACs, 50 TCs)
- `docs/spec-build/v2/epics/07--e2e-testing-framework/tech-design.md` — tech design (1,306 lines)
- `docs/spec-build/v2/epics/07--e2e-testing-framework/stories.md` — story file (5 stories, 805 lines)
- `docs/spec-build/v2/epics/07--e2e-testing-framework/business-epic.md` — business epic (237 lines)

**Pipeline stats:**
- 4 phases, 2 verification rounds on epic, 1 on tech design, 1 final coherence
- 3 teammates spawned across pipeline (drafter, 2 verifiers + tech designer)
- Codex subagent used in 3 verification passes
- 2 process failures identified and logged (Codex dispatch ownership, unresearched technology choices)
- 1 technology research conducted (E2E testing landscape, 30+ sources)
- Ready for implementation via ls-team-impl
