# Team Spec Log — Epic 14: Pipeline Orchestration

## Lane Determination

**Date:** 2026-03-23

**Lane:** Codex (codex-cli, gpt-5.4 default). Smoke test passed — `VERIFICATION_OK` returned.

Skills loaded:
- `codex-subagent` — available, verified
- `ls-team-spec-c` — loaded (orchestration)
- `ls-epic` — to be loaded by drafter

## Verification Gate Discovery

Inherited from v2 pipeline (confirmed from `app/package.json`):

- **Phase acceptance gate:** `cd app && npm run verify` (format:check, lint, typecheck, typecheck:client, test)
- **Build gate:** `cd app && npm run build` (tsc + esbuild)
- **Final handoff gate:** `cd app && npm run verify && npm run build`

Note: Epic 14 is a spec-only phase — no code changes during spec pipeline. Code verification gates apply at implementation. Phase acceptance is document quality + Codex verification.

## Orientation

**What's being built:** Epic 14 — Pipeline Orchestration. The final epic in v2, this turns the Spec Steward from an advisor into an executor. Background task management for long-running CLI operations, pipeline dispatch (invoking Liminal Spec operations as background tasks), results integration with approval flow, and autonomous mode where the Steward sequences through the full spec pipeline without intermediate approvals.

**Artifacts available:**
- v2 PRD: `docs/spec-build/v2/prd.md`
- v2 Tech Architecture: `docs/spec-build/v2/technical-architecture.md`
- v2 Epic 10 (Chat Plumbing): full spec set — epic, tech-design (index + server + client), test-plan, stories
- v2 Epic 12 (Document Awareness): epic.md, tech-design (index + server + client), test-plan (accepted, stories in progress)

**Upstream in flight:** Epics 12 (stories being published) and 13 (spec pipeline in progress) are being worked on concurrently. Epic 14's spec will reference the PRD's Feature 13 description for package/spec awareness capabilities since no Epic 13 spec exists yet. This is a known risk — Epic 14 ACs may need revision when Epic 13 lands.

**Core specs (orchestrator-determined, human unavailable):** v2 Epic 10 (Chat Plumbing) and v2 Epic 12 (Document Awareness). Rationale: Epic 10 established the provider abstraction, WebSocket streaming, and feature flag infrastructure that Epic 14 dispatches through. Epic 12 established the context injection and document editing patterns that Epic 14 extends to pipeline-level operations.

**Direct predecessors:** Epic 13 (package/spec awareness — in flight) is the direct predecessor. Epic 14 assumes the Steward already understands packages, spec phases, and can perform package operations. Since Epic 13's spec doesn't exist yet, the drafter must work from PRD Feature 13's description.

**Pipeline entry:** Phase 1 (Epic). No prior artifacts exist for Epic 14.

**Business epic:** Not requested (human instruction).

**Human review mode:** Human instructed to proceed without waiting for human epic review. Orchestrator will run through all phases autonomously with Codex verification. Human will review the complete artifact set post-pipeline.

**Key context from PRD Feature 14:**
- Background task management: dispatch long-running CLI operations, status tracking, cancellation
- Pipeline dispatch: invoke LS operations (epic, tech design, publish epic, implementation) via CLI provider
- Results integration: output files appear in package, manifest updated, user notified
- Approval flow: user reviews artifacts and communicates via chat — proceed or iterate
- Autonomous mode: user opts in, Steward sequences through phases without intermediate approval
- Progress visibility: active background tasks visible in chat with status + elapsed time
- Out of scope: custom agent harness, multi-agent verification managed by Steward, pipeline state persistence beyond conversation history, formal approval gate UI

---

## Phase 1: Epic — Epic 14 (Pipeline Orchestration)

### Drafter Launch

**Teammate:** `epic-writer` (Opus, general-purpose, bypassPermissions)

**Reading journey (8 docs, sequential with reflection):**
1. `docs/spec-build/v2/prd.md` — full PRD, product vision, Feature 13+14 scope boundaries
2. `docs/spec-build/v2/technical-architecture.md` — technical world, stack decisions, provider abstraction
3. `docs/spec-build/v2/epics/10--chat-plumbing/epic.md` — chat infrastructure, provider interface, lifecycle management
4. `docs/spec-build/v2/epics/10--chat-plumbing/tech-design.md` — concrete interfaces, module boundaries
5. `docs/spec-build/v2/epics/10--chat-plumbing/test-plan.md` — testing patterns for chat infrastructure
6. `docs/spec-build/v2/epics/12--document-awareness-and-editing/epic.md` — context injection, editing, persistence
7. `docs/spec-build/v2/epics/12--document-awareness-and-editing/tech-design.md` — concrete context/edit interfaces
8. `docs/spec-build/v2/epics/12--document-awareness-and-editing/test-plan.md` — testing patterns for intelligence layer

**Customizations from template:**
- Added explicit guidance about Epic 13 being in-flight — drafter must work from PRD Feature 13 description and document assumptions about what Epic 13 delivers
- Identified the four key capabilities to structure around
- Called out the provider abstraction as the execution mechanism, not a new provider
- Flagged the background task / chat conversation interaction as a key design concern

**Skill activation:** `ls-epic` loaded after reading journey completes.

### Drafter Report

Writer completed reading journey and went straight to drafting — no questions surfaced. This is acceptable given the PRD Feature 14 description is specific and the writer had 8 documents of context.

**Draft:** `docs/spec-build/v2/epics/14--pipeline-orchestration/epic.md` (880 lines)
**Structure:** 5 flows, 24 ACs, 73 TCs, 7 Epic 13 dependency assumptions, 6 general assumptions, 11 tech design questions, 5-story breakdown
**Self-review fixes:** Model-dependent TCs tightened (TC-2.3a/b/d, TC-1.3b, TC-3.3a, TC-2.4a/b recast to assert observable behavior rather than Steward wording). AC count corrected (22→24).
**Open items:** Epic 13 boundary uncertainty (package operations), PRD refinement in autonomous mode (handled as optional step, not formal phase), some TCs remain partially model-dependent.

No question filter needed — no questions were raised.

### External Verification — Round 1

**Verifier:** Codex (gpt-5.4, codex exec)

**Reading journey (7 docs + skill):**
1. PRD — product scope and Feature 13/14 boundaries
2. Tech architecture — technical world
3. Epic 10 epic.md — provider infrastructure
4. Epic 10 tech-design.md — concrete interfaces
5. Epic 12 epic.md — context injection, editing
6. Epic 12 tech-design.md — concrete context/edit interfaces
7. ls-epic skill — criteria for what a good epic looks like
8. Draft epic — the artifact under review

**Review focus areas specified:**
- Epic 13 dependency assumptions realism/completeness
- Background task model coherence with Epic 10's provider abstraction
- Data contract completeness and consistency with existing WS patterns
- Autonomous mode phase sequencing
- Approval flow edge cases
- TC testability without model output dependency

Output: `docs/spec-build/v2/epics/14--pipeline-orchestration/verification/codex/epic-review-r1.md`

**Codex R1 Verdict:** Not ready for tech design.

**Findings summary:**
- 4 Critical: (1) Epic 13 contract drift — draft written against imagined Epic 13 APIs, but Epic 13 spec has since landed with different primitives; (2) Multi-file output contract gap — `outputPath` singular can't represent tech-design/publish multi-file output; (3) No reconnect/restart contract for long-running tasks; (4) Autonomous mode has no run-level state contract, sequencing rules internally inconsistent
- 6 Major: Background worker as assumption not requirement; approval binding ambiguity; model-dependent TCs; phase naming drift from Epic 13 vocabulary; manifest integration underspecified; task-status contract incomplete
- 2 Minor: Stale dependency section; output-path multi-file rule

**Key discovery:** Epic 13's spec (`docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md`) landed during Epic 14's drafting. This changes the landscape materially — the dependency assumptions table was written speculatively from the PRD, but now concrete contracts exist. The drafter must read Epic 13's actual spec and realign.

**Codex used alternative skill path:** The requested `ls-epic.md` at `~/.claude/skills/liminal-spec/skills/ls-epic.md` wasn't accessible in Codex's environment. It used `~/.codex/skills/ls-epic/SKILL.md` instead. This is acceptable — the criteria content is equivalent.

### Fix Round — Addressing R1 Findings

Routed all findings to epic writer with instruction to:
1. Read Epic 13's actual spec first, reflect on real APIs and contracts
2. Read Codex review
3. Verify each claim, fix valid issues, push back on invalid ones
4. Self-review after fixes

Waiting for epic writer to complete fixes.

### External Verification — Round 2

**Codex R2 Verdict:** Improved substantially, not yet ready for tech design.

**R1 fix verification:** 4 FIXED (M1 background worker, M6 task-status, m1 stale deps, — wait, actually: M1, M6, m1 are confirmed fixed). 7 PARTIALLY FIXED (all 4 Criticals + M2, M3, M4, M5). 1 NOT FIXED (m2 output-path rule — accepted as tech design question).

**New findings:** 3 Major (chat:package-changed correlation missing for background tasks, message sequencing undefined for completion, autonomous run/snapshot state disagreement), 1 Minor (AC numbering regression).

**Pattern observation:** The remaining issues are contract consistency seams introduced during the extensive R1 rewrite. This is the expected failure mode — each fix introduces potential inconsistencies with other contracts. The fixes are targeted, not structural.

**Orchestrator decisions:**
- R1 m2 (output-path rule): accepted as tech design question, not an epic gap. The epic requires reporting output location; the location-choice algorithm is implementation detail.
- C3 restart contradiction: recommended resolution is "post-restart snapshot is empty + soften NFR claim." In-memory tasks are lost on restart; conversation history is the recovery mechanism.
- C4 autonomous snapshot: recommended "present when active (started/running), absent when terminal. Terminal states via live events only."

### Fix Round 2 — Addressing R2 Findings

Routed 12 targeted fixes to epic writer. These are mostly find-and-replace consistency repairs, not structural rework. The largest single fix is defining message sequencing for completion (file-created → package-changed → task-status).

### External Verification — Round 3

**Codex R3 Verdict:** FAIL — 15 of 16 findings FIXED, 1 remaining.

**Remaining issue:** Approval edge case referenced untyped "active task info" in ProviderContext. Single targeted fix needed.

**Fix:** Writer rewrote edge case to use `getRunningTasks()` from existing typed script context instead of adding untyped ProviderContext field. Cleaner — no new types needed.

### External Verification — Round 4

**Codex R4 Verdict:** PASS. Epic 14 cleared for tech design.

All R1-R3 findings resolved. No new findings. The epic is contract-complete and internally consistent.

### Phase 1 Summary

Epic 14: Pipeline Orchestration accepted after 4 Codex verification rounds.

- **Draft → R1:** 880 lines, 24 ACs, 73 TCs. Codex found 4 Critical (Epic 13 contract drift, multi-file output, no reconnect contract, autonomous state machine), 6 Major, 2 Minor.
- **R1 fixes → R2:** All 12 findings addressed. Epic grew to 26 ACs, 85 TCs. Codex found 7 partially fixed + 3 new Major from contract consistency seams.
- **R2 fixes → R3:** 12 targeted repairs. 15 of 16 FIXED, 1 remaining (untyped ProviderContext field).
- **R3 fix → R4:** Single fix (getRunningTasks() instead of untyped field). PASS.
- **Final epic:** 26 ACs, 87 TCs, 5 stories estimated.
- **Key mid-phase event:** Epic 13 spec landed during drafting, requiring full contract realignment.
- **Human review:** Deferred per human instruction ("going to bed, don't wait").

Epic writer teammate shut down. Phase 1 complete.

---

## Phase 2: Tech Design — Epic 14 (Pipeline Orchestration)

### Dependency Research Gate

**Teammate:** `dep-researcher` (Opus, general-purpose, bypassPermissions)

Reading: PRD, tech arch, Epic 14 epic, package.json. Research focus: process management for concurrent background CLI processes, task/job management, UUID generation, timer/scheduling. Key question: does Epic 14 need new dependencies or can the existing stack handle it?

**Result:** No new dependencies needed. All Epic 14 capabilities map to Node.js built-ins (child_process.spawn, AbortController, crypto.randomUUID, Map, setInterval) and existing deps (Fastify, @fastify/websocket, Zod). Rejected execa, p-queue, p-limit, uuid, nanoid — all over-engineering for the scope.

Analysis saved to `docs/spec-build/v2/epics/14--pipeline-orchestration/dep-research.md`. Accepted by orchestrator (human unavailable). Dep-researcher teammate shut down.

### Tech Design Writer Launch

**Teammate:** `td-writer` (Opus, general-purpose, bypassPermissions)

**Reading journey (13 docs, sequential with reflection):**
1. PRD — technical world and stack decisions
2. Tech architecture — architectural patterns and constraints
3. Epic 10 epic — provider interface, WebSocket, feature flags
4. Epic 10 tech-design index — Config B pattern, decisions
5. Epic 10 tech-design-server — ProviderManager, CLI spawning, per-invocation model
6. Epic 10 tech-design-client — chat panel, WebSocket client, DOM rendering
7. Epic 10 test-plan — testing patterns, mock strategy
8. Epic 12 epic — context injection, editing, persistence
9. Epic 12 tech-design — context injection at code level
10. Epic 12 test-plan — intelligence layer testing
11. Epic 13 epic — package/spec awareness contracts consumed by Epic 14
12. Epic 14 dep-research — no new deps, built-in API recommendations
13. Epic 14 epic — requirements, 26 ACs, 87 TCs, data contracts

**Output structure:** Config B (4 docs): index + server + client + test-plan

**Skill activation:** `ls-tech-design` loaded after reading journey.

### Drafter Report

Writer completed 13-doc reading journey. No questions surfaced — went straight to drafting. Produced 4 documents (Config B): index (decisions, Q answers), server (TaskManager, PipelineDispatcher, AutonomousSequencer, ResultsIntegrator), client (task display, approval interaction), test plan (112 tests, TC→test mapping). All cross-document consistency checks passed in self-review.

### External Verification — TD Round 1

**Codex R1 Verdict:** Not ready. 4 Critical architecture issues.

**Findings:**
- 4 Critical: (1) Cancel/shutdown lifecycle broken — process reference nulled before SIGKILL timer, active count decremented before exit; (2) Autonomous sequencer stalls on success — completed events routed through WS route, not TaskManager event bus; (3) Worker bypasses Epic 13 file-access contract — uses fs.readFile instead of script context; (4) outputDir scanning model broken — can't distinguish task output from pre-existing files, implementation at project root is unworkable
- 4 Major: Global task state not workspace-scoped; specStatus lifecycle incomplete; dispatch error transport not designed; duplicate detection uses outputDir not feature identity
- 2 Minor: Client invents POST /api/file/open instead of Epic 12's openFile; test fixtures don't satisfy schemas

**Pattern observation:** The criticals are real design flaws, not contract polish. The cancel lifecycle has a use-after-null bug. The event model has a split-brain between TaskManager and WS route. The file-access model bypasses the upstream contract surface. These require structural fixes, not find-and-replace.

### Fix Round — Addressing TD R1 Findings

Routed all 10 findings + 2 "noticed but not reported" items to TD writer with specific fix guidance.

### TD Verification Rounds Summary

The tech design went through 7 Codex verification rounds. This is more than the epic phase (4 rounds) because the 4-document Config B format creates cross-document consistency surfaces that generate cascading propagation issues with each structural fix.

- **R1:** 4 Critical (cancel lifecycle, event bus split-brain, Epic 13 file-access bypass, outputDir scanning), 4 Major, 2 Minor
- **R2:** R1 structural fixes landed but ripple effects not fully propagated. 1 new Critical (staging/output handoff broken), 3 new Major
- **R3:** Staging fixed, 1 new Critical (CLI stdout never captured), 4 new Major (autonomous deferred start, folder-mode writes, staging path ambiguity, workspace-switch snapshot)
- **R4:** Stdout capture fixed, 3 new Major (live events not workspace-filtered, epic/design contract mismatch, stdout trailing buffer)
- **R5:** 1 remaining blocker (autonomous-run events leak across workspaces)
- **R6:** Fix correct but propagation incomplete (fixtures, test, index)
- **R7:** PASS. All findings resolved. 115 tests, full cross-doc consistency.

**Key pattern:** Each round's structural fixes introduced new cross-document inconsistencies. The dominant failure mode in 4-doc tech designs is propagation drift, not architectural error. The architecture was fundamentally sound from R1; rounds 2-7 were about propagating fixes cleanly across all 4 documents.

**Design additions documented:** `target` and `workspaceIdentity` fields added to `TaskDispatchConfig` and `TaskInfo` as design-level refinements (not epic deviations). These implement AC-5.4 and AC-1.6c.

### Phase 2 Summary

Tech design for Epic 14 accepted after 7 Codex verification rounds.

- **Output:** 4 documents (Config B): index + server + client + test plan
- **Final test count:** 115 tests (87 TCs from epic + 28 non-TC design-level tests)
- **Key design decisions:** One CLI process per task via spawn+AbortController, staging directory per task (cwd-based output), explicit output manifest (no directory scanning), single TaskManager event bus, workspace-scoped state throughout, immediate vs deferred started events for autonomous vs script dispatches
- **No new dependencies needed** (confirmed by dependency research gate)
- **Human review:** Deferred per human instruction

TD writer teammate shut down. Phase 2 complete.

---

## Phase 3: Publish Epic — Epic 14 (Pipeline Orchestration)

### Publisher Launch

**Teammate:** `publisher` (Opus, general-purpose, bypassPermissions)

**Reading journey (5 docs, sequential with reflection):**
1. Epic 14 epic.md — source of truth for ACs/TCs/flows/story breakdown
2. Epic 14 tech-design.md — architecture decisions, chunk breakdown
3. Epic 14 tech-design-server.md — module-to-story mapping
4. Epic 14 tech-design-client.md — client work per story
5. Epic 14 test-plan.md — TC-to-test mapping, chunk alignment

**Output:** 5 story files + coverage.md in `stories/` directory. No business epic.

**Skill activation:** `ls-publish-epic` loaded after reading journey.

### Publisher Report

Publisher completed reading journey and published 5 stories + coverage artifact. No questions surfaced. Self-review confirmed TC fidelity (exact wording match), 87/87 TCs covered, 26/26 ACs mapped.

### External Verification — Publish Round 1

**Codex R1 Verdict:** FAIL — stories clean, coverage.md has traceability errors.

Stories themselves: perfect TC fidelity, all 87 TCs present, no wording drift. Issues were all in coverage.md:
- Major: TC-2.4c ownership conflict (story body says Story 3, coverage said Story 4)
- Minor: Wrong TC cited for prerequisite-failure in integration trace (TC-2.3c is success, not failure)
- Minor: Wrong TC cited for partial-output/manifest exclusion

### Fix Round

3 coverage.md edits: TC-2.4c → Story 3 consistently, prerequisite trace → TC-2.3a/b/d, manifest trace → TC-5.2b. No story file changes.

### External Verification — Publish Round 2

**Codex R2 Verdict:** PASS. All traceability errors fixed. Stories and coverage cleared.

### Phase 3 Summary

Published stories for Epic 14 accepted after 2 Codex verification rounds.

- **Output:** 5 stories + coverage.md
- **Stories:** Foundation → Background Tasks → Pipeline Dispatch → Results/Approval → Autonomous Mode
- **Coverage:** 87 TCs across 26 ACs, each assigned to exactly one story
- **TC fidelity:** Perfect — exact Given/When/Then wording match to epic source
- **Human review:** Deferred per human instruction

Publisher teammate shut down. Phase 3 complete.

---

## Pipeline Complete

All three phases of the Liminal Spec pipeline for Epic 14: Pipeline Orchestration are complete.

**Complete artifact set:**

| Artifact | Location | Verification |
|----------|----------|-------------|
| Epic | `epic.md` | 4 Codex rounds (R1-R4) |
| Tech Design Index | `tech-design.md` | 7 Codex rounds (R1-R7) |
| Tech Design Server | `tech-design-server.md` | (same 7 rounds) |
| Tech Design Client | `tech-design-client.md` | (same 7 rounds) |
| Test Plan | `test-plan.md` | (same 7 rounds) |
| Dependency Research | `dep-research.md` | Accepted by orchestrator |
| Story 1: Foundation | `stories/story-1-foundation.md` | 2 Codex rounds (R1-R2) |
| Story 2: Background Tasks | `stories/story-2-background-task-management.md` | (same 2 rounds) |
| Story 3: Pipeline Dispatch | `stories/story-3-pipeline-phase-dispatch.md` | (same 2 rounds) |
| Story 4: Results/Approval | `stories/story-4-results-integration-and-approval.md` | (same 2 rounds) |
| Story 5: Autonomous Mode | `stories/story-5-autonomous-pipeline-execution.md` | (same 2 rounds) |
| Coverage | `stories/coverage.md` | (same 2 rounds) |
| Orchestration Log | `team-spec-log.md` | This file |

**Total Codex verification rounds:** 13 (4 epic + 7 tech design + 2 publish)

**Key observations across the pipeline:**
- Epic phase was complicated by Epic 13 landing mid-draft, requiring full contract realignment
- Tech design phase was the heaviest — 7 rounds driven by cross-document consistency in the 4-doc Config B format. Each structural fix cascaded propagation issues across documents. The architecture was sound from R1; rounds 2-7 were propagation convergence.
- Publish phase was clean — stories mapped directly from the well-verified epic and tech design.
- No new dependencies needed for Epic 14 — all capabilities built on Node.js built-ins and existing project deps.
- Human review deferred for all phases per human instruction. The complete artifact set is ready for review.

From here: implementation via `ls-team-impl-c`, `ls-subagent-impl-cc`, or direct handoff.
