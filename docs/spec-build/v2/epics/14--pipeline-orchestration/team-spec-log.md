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

Waiting for Codex verification to complete.
