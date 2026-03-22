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
