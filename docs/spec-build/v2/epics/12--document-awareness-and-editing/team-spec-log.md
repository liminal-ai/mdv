# Team Spec Log — Epic 12: Document Awareness and Editing

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

Note: Epic 12 is a spec-only phase — no code changes during spec pipeline. Code verification gates apply at implementation. Phase acceptance is document quality + Codex verification.

## Orientation

**What's being built:** Epic 12 — Document Awareness and Editing. Makes the Spec Steward contextually aware of the active document and able to edit it. Adds context injection, document editing through chat, conversation persistence, and tab context switching. This is where the chat goes from "generic AI sidebar" to "assistant that knows what you're working on."

**Artifacts available:**
- v2 PRD: `docs/spec-build/v2/prd.md`
- v2 Tech Architecture: `docs/spec-build/v2/technical-architecture.md`
- v1 Epic 01 (App Shell & Workspace Browsing): full spec set
- v1 Epic 06 (Hardening & Electron Wrapper): full spec set
- v2 Epic 10 (Chat Plumbing): full spec set — epic, tech-design (index + server + client), test-plan, stories
- v2 Epic 11 (Chat Rendering & Polish): epic.md (accepted, tech design in progress)

**Core specs (human-designated):** v1 Epics 1, 6; v2 Epic 11. These established foundational architecture, hardening/reliability patterns, and the streaming markdown rendering pipeline that Epic 12 extends with intelligence.

**Direct predecessors:** Epic 10 (chat plumbing infrastructure) and Epic 11 (chat rendering, the surface Epic 12 adds intelligence to).

**Pipeline entry:** Phase 1 (Epic). No prior artifacts exist for Epic 12.

**Business epic:** Not requested.

**Key context from PRD Feature 12:**
- Document awareness: active document path + content as context, updates on tab switch
- Document editing through chat: chunked updates, viewer auto-refresh
- Context injection model: server constructs prompt with document content, token budget management
- Conversation persistence: per-folder/per-package, survives restarts
- Tab context switching: cross-document reference ("that other document we looked at")
- Scoped to single-document awareness — package-level is Epic 13

---

## Phase 1: Epic — Epic 12 (Document Awareness and Editing)

### Drafter Launch

**Teammate:** `epic-writer` (Opus, general-purpose, bypassPermissions)

**Reading journey (9 docs, sequential with reflection):**
1. v2 PRD → product vision, Feature 12 scope, M4 milestone
2. v2 Tech Architecture → system shape, context injection, provider interface
3. v1 Epic 1 → foundational architecture, workspace model, session persistence
4. v1 Epic 6 → hardening patterns, reliability, error recovery
5. v2 Epic 10 epic → chat infrastructure, provider abstraction, WebSocket protocol
6. v2 Epic 10 tech-design index → module breakdown, server/client split
7. v2 Epic 10 tech-design-server → provider lifecycle, WebSocket server, message relay
8. v2 Epic 10 tech-design-client → client components, chat panel structure, state management
9. v2 Epic 11 epic → streaming markdown rendering, UI polish, what was deferred to Epic 12

**Skill loaded last:** `ls-epic`

**Dispatch note:** Dropped v1 Epic 2 from reading journey (was core in Epic 11 for rendering pipeline context). Epic 12 doesn't extend the rendering pipeline — it extends the chat intelligence. Replaced with v1 Epic 6 (hardening, persistence patterns) and deeper Epic 10 tech design coverage (server + client companions), which are more relevant to context injection and conversation persistence.

**Outcome:** Writer completed the full 9-doc reading journey and went directly to drafting — no questions surfaced (none survived the writer's own filter). Draft produced at `docs/spec-build/v2/epics/12--document-awareness-and-editing/epic.md`.

**Self-review findings (4 items, all fixed during drafting):**
1. Missing `chat:conversation-load` WebSocket message type and TC-3.1d for server-to-client conversation delivery on connect
2. Missing `created: boolean` flag on `chat:file-modified` to distinguish new files from edits
3. File creation through chat added to In Scope (since `applyEdit(path, content)` supports it naturally)
4. Conversation Load API section added to Data Contracts explaining the WebSocket-delivered load pattern

**Open items (tech design deferrals, not epic defects):**
1. TC-1.3a (cross-document reference) is inherently LLM-dependent — tests verify the mechanism (`--resume`) not the LLM's answer quality
2. Token budget specifics deferred to tech design (Q1, Q2)
3. Local file link detection strategy deferred to tech design (Q7)
4. Edit mechanism preference (script blocks vs CLI built-in tools) deferred to tech design (Q6)

**Spec deviations:**
- No real-time context push on tab switch — context attaches to next `chat:send` instead. Simpler and sufficient; documented in Out of Scope.
- Unsaved editor content excluded — Steward sees on-disk version only. Documented in Out of Scope.
- Package-path conversation keying deferred to Epic 13.

**Draft stats:** 4 flows, 16 ACs, ~48 TCs, 10 tech design questions, 5 stories (including Story 0), 695 lines.

### External Verification — Round 1

**Model:** Codex (gpt-5.4, high reasoning)
**Session ID:** `019d1d5d-f3cb-7010-a92f-8ea04948b83b`
**Reading journey:** Same 9 artifacts + ls-epic skill, then the draft. Objective: "find what's wrong."
**Output:** `verification/codex/epic-review-r1.md`

**Findings:** 3 Critical, 6 Major, 2 Minor.

The three criticals were all genuine:
1. **C1** — Package-identity conversation keying pushed to Epic 13 but tech arch explicitly places canonical identity (folder path OR package source path) here. Verified against tech arch; the reviewer was right.
2. **C2** — Scope drift into arbitrary file creation and non-active-file writes. PRD Feature 12 is single-document editing; tech arch recommends `applyEditToActiveDocument(edit)`, not broad filesystem methods. Valid.
3. **C3** — Dirty-editor safety gap. Auto-refresh after Steward edits could clobber unsaved changes. v1 Epic 5 established conflict modal pattern for external changes on dirty tabs. Valid — clear omission.

All 6 majors accepted and fixed: conversation-load contract gaps (M1), workspace session isolation (M2), model-dependent ACs recast to deterministic (M3), message name aligned to upstream `chat:file-created` (M4), pruning removed from NFRs (M5), implementation-prescriptive content reduced (M6 — partial, interfaces kept as contracts per methodology).

Both minors fixed: context indicator placement relaxed (m1), ambiguous behavior alternatives resolved to single choices (m2).

**Writer disposition:** All 11 accepted and fixed. No rejections. M6 was partial — script context interfaces retained as contracts (consistent with Epic 10's approach), but edit mechanism preference and system prompt details moved to tech design.

**Post-fix stats:** 18 ACs (up from 16), 49 TCs (up from ~48). New dependency on Epic 9 (package source path tracking). New dependency on Epic 5 (dirty-tab conflict model).

**Concerns from fixes:** C1 adds dependency on Epic 9's session state for canonical identity resolution. C3 increases Story 2 test count (16-20). M6 partial acceptance may draw further scrutiny — but the interfaces are consistent with Epic 10's precedent.

### External Verification — Round 2

**Session ID:** `019d1d5d-f3cb-7010-a92f-8ea04948b83b` (resumed)
**Output:** `verification/codex/epic-review-r2.md`

**Findings:** 4 Major, 1 Minor (all from R1 fix regressions or incomplete cleanup).

- **M1** — AC-2.3 dirty-tab flow missing Save Copy branch TC. Fixed: added TC-2.3d.
- **M2** — Persistence timing inconsistency between flow prose ("every send and receive") and data contracts ("send + chat:done"). Fixed: aligned to send + chat:done throughout.
- **M3** — `DocumentEdit` type referenced but never defined. Fixed: simplified to `applyEditToActiveDocument(content: string)`, no undefined types.
- **M4** — TC-2.1b and TC-2.4a still model-dependent. Fixed: recast as deterministic system checks.
- **m1** — Story 4 description used old phrasing. Fixed: aligned to AC-1.3 session continuity language.

All 5 accepted and fixed. No rejections. Post-fix: 18 ACs, 50 TCs.

### External Verification — Round 3

**Session ID:** `019d1d5d-f3cb-7010-a92f-8ea04948b83b` (resumed)
**Output:** `verification/codex/epic-review-r3.md`

**Findings:** 1 Major.

- **M1** — TC-2.4a over-corrected in R2. The deterministic rewrite only checked for `chat:file-created` transport event, but AC-2.4 still promises a user-visible confirmation in the chat conversation. The TC no longer tested the AC's actual promise.

Fixed: Split TC-2.4a into TC-2.4a (transport check) and TC-2.4b (chat-state check — completed agent message exists). Old TC-2.4b renumbered to TC-2.4c.

### External Verification — Round 4

**Session ID:** `019d1d5d-f3cb-7010-a92f-8ea04948b83b` (resumed)
**Output:** `verification/codex/epic-review-r4.md`

**Findings:** None.

**Verdict:** Codex signed off — **Approved for Tech Design.**

**Verification summary:** 4 rounds. R1 found 3C/6M/2m (all fixed). R2 found 4M/1m from fix regressions (all fixed). R3 found 1M from over-correction (fixed). R4 clean — approved. Total findings across all rounds: 22 (all resolved). Final epic: 18 ACs, 51 TCs.

**Verification artifacts:**
- `verification/codex/epic-review-r1.md` — initial review (11 findings)
- `verification/codex/epic-review-r2.md` — re-review (5 findings)
- `verification/codex/epic-review-r3.md` — re-review (1 finding)
- `verification/codex/epic-review-r4.md` — final sign-off (approved)

### Human Review

**Status:** Epic presented to human for every-line review.

**Human verdict:** Accepted. No changes requested.

**Phase 1 complete.** 4 verification rounds, 22 total findings (all resolved). Key observations: C1 (package-identity keying) was the most consequential catch — pulling canonical workspace identity into Epic 12 where the tech arch places it, rather than deferring to Epic 13. C3 (dirty-editor safety) was a genuine safety gap that would have violated v1's document-safety contract. The R2→R3→R4 tail was caused by progressive over-correction of model-dependent TCs — each fix removed too much, then had to be rebalanced.

---

## Phase 2: Tech Design — Epic 12 (Document Awareness and Editing)

### Dependency Research

**Teammate:** `dep-researcher` (Opus, general-purpose, bypassPermissions)

**Outcome:** Zero new npm dependencies. All Epic 12 capabilities map to Node.js built-ins or existing project dependencies. Consistent with the epic's own Dependencies section.

Key tech design inputs from research:
- Token budget: character heuristic (`Math.ceil(text.length / 4)`) — no offline Claude tokenizer exists for JS. `@anthropic-ai/tokenizer` abandoned (v0.0.4, 2023). GPT tokenizers offer no accuracy advantage over heuristic for Claude content.
- Conversation filenames: SHA-256 prefix (16 hex chars, built-in `crypto`), filesystem-safe and deterministic.
- Atomic writes: same temp+rename pattern already in codebase.
- File link detection: post-process markdown-it output with `path.resolve()` + containment check.
- All Epic 10/11 extension points (ProviderContext, ScriptContext, ChatServerMessage, ChatErrorCode) designed for additive extension.

Rejected packages: `@anthropic-ai/tokenizer` (abandoned), `js-tiktoken`/`gpt-tokenizer` (wrong vocabulary), `@anthropic-ai/sdk` countTokens (async HTTP, violates NFR), `better-sqlite3`/`level` (overengineered), `jsonfile` (unnecessary).

**Human verdict:** Accepted (zero new deps, proceed).

### Tech Design Writer Launch

**Teammate:** `td-writer` (Opus, general-purpose, bypassPermissions)

**Reading journey (14 artifacts across 8 steps, sequential with reflection):**
1. v2 PRD → core stack, product direction
2. v2 Tech Architecture → system shape, context injection, canonical identity, provider interface
3. v1 Epic 1 (epic + tech-design) → foundational architecture, workspace model, session persistence
4. v1 Epic 6 (epic + tech-design) → hardening, reliability, atomic writes
5. v2 Epic 10 (epic + tech-design index + server + client + test-plan) → full chat infrastructure
6. v2 Epic 11 (epic) → streaming rendering pipeline, UI surface
7. Dependency research findings (inline) → zero new deps, token heuristic, SHA-256 encoding
8. Accepted Epic 12 → requirements, constraints, 10 tech design questions

**Skill loaded last:** `ls-tech-design`

**Outcome:** Writer completed the full reading journey and went directly to drafting — no questions surfaced. 4-doc Config B output produced:
- `tech-design.md` — index with spec validation, Q&A, module architecture, work breakdown
- `tech-design-server.md` — context injection, conversation persistence, script extensions, schemas
- `tech-design-client.md` — context indicator, conversation restoration, local file links
- `test-plan.md` — mock strategy, fixtures, TC→test mapping, 77 tests across 5 chunks

**Self-review findings (2 items, fixed):**
1. AC-2.3 missing from Module Responsibility Matrix — added to `chat-panel.ts` row
2. Test count double-counting across chunks — reconciled all counts, added missing conflict modal tests

**Key architecture decisions:**
- Token budget: 100K chars (~25K tokens), character heuristic, end truncation
- Context construction: `--system-prompt` for instructions, `<active-document>` XML block in user message
- Conversation encoding: SHA-256 prefix (16 hex chars) of canonical workspace identity
- Edit mechanism: script execution lane primary, full content replacement
- Conversation restoration: eager re-rendering on load
- Workspace switch: cancel-and-wait (synchronous, 6s timeout)
- Zero new npm dependencies

**Spec deviations:** All clarifications, no changes to epic contracts. Key: `packageSourcePath` assumed from Epic 9; script context async via IIFE wrapper; file watcher coexists with `chat:file-created` for dirty-tab conflict detection.

**Initial stats:** 4 documents, 11 modules, 77 tests, 5 chunks, all 18 ACs mapped.

### External Verification — Round 1

**Model:** Codex (gpt-5.4, high reasoning)
**Session ID:** `019d1daf-d639-77c3-a929-9d440437e20c`
**Output:** `verification/codex/td-review-r1.md`

**Findings:** 1 Critical, 5 Major, 2 Minor.

The critical was genuine: conversation-swap protocol incomplete for empty workspaces — no signal to clear stale messages when switching to a workspace with no saved conversation.

All 5 majors were valid: (M1) clear-conversation had no end-to-end design in ws-chat route, (M2) truncation indicator used client heuristic instead of server truth, (M3) session continuity seam inconsistent with Epic 10's ProviderManager ownership model, (M4) client companion used nonexistent store/integration APIs that don't match the real codebase, (M5) CONTEXT_READ_FAILED error path dropped session continuity.

Both minors were valid: (m1) TC count said ~57 but epic has 51, (m2) two quantitative claims contradicted themselves.

**Writer disposition:** All 8 accepted and fixed. Key architectural changes:
- New `chat:context` server→client message replaces client-side truncation heuristic (M2)
- `ProviderManager.setSessionId()` injection point instead of passing sessionId through send() (M3)
- `chat:conversation-load` with empty messages array sent for all workspace scenarios including empty/clear (C1, M1)
- All client store APIs corrected to match actual `StateStore` API (M4)
- Error path preserves session continuity and persistence (M5)

**Post-fix stats:** 4 documents, 81 tests (up from 77), 51 TCs mapped, all counts reconciled.

### External Verification — Round 2

**Session ID:** `019d1daf-d639-77c3-a929-9d440437e20c` (resumed)
**Output:** `verification/codex/td-review-r2.md`

**Findings:** 3 Major, 2 Minor (cross-document propagation drift from R1 fixes).

- **M1** — Client store APIs still wrong (changed.has vs includes, state.lastRoot vs state.session.lastRoot, nonexistent handleFileChange). Fixed: all corrected to match real codebase.
- **M2** — Session-ID flow still contradicted in client sequence diagram (old 4-arg send) and server parser section (invented onSessionId events). Fixed: both aligned to setSessionId()/getSessionId() model.
- **M3** — TC-4.2b still mapped to client test instead of server. Fixed: moved to ws-chat.test.ts.
- **m1** — chat:context missing from module bookkeeping rows. Fixed: added to schemas and client rows.
- **m2** — Restoration timing still contradicts in index. Fixed: separated init (<50ms) from rendering (200-500ms).

All 5 accepted and fixed.

### External Verification — Round 3

**Session ID:** `019d1daf-d639-77c3-a929-9d440437e20c` (resumed)
**Output:** `verification/codex/td-review-r3.md`

**Findings:** 1 Major (stale onSessionId references in 3 locations).

- Client sequence diagram, test plan TC-3.6c, and index Module Responsibility Matrix still referenced removed onSessionId pattern. Fixed: all updated to getSessionId() model. Grep-verified clean.

### External Verification — Round 4

**Session ID:** `019d1daf-d639-77c3-a929-9d440437e20c` (resumed)
**Output:** `verification/codex/td-review-r4.md`

**Findings:** None.

**Verdict:** Codex signed off — **Approved for Story Publishing.**

**Verification summary:** 4 rounds. R1 found 1C/5M/2m (all fixed). R2 found 3M/2m from propagation drift (all fixed). R3 found 1M stale reference (fixed). R4 clean — approved. Total findings across all rounds: 14 (all resolved). Final design: 4 documents, 81 tests, 51 TCs mapped.

**Verification artifacts:**
- `verification/codex/td-review-r1.md` — initial review (8 findings)
- `verification/codex/td-review-r2.md` — re-review (5 findings)
- `verification/codex/td-review-r3.md` — re-review (1 finding)
- `verification/codex/td-review-r4.md` — final sign-off (approved)

### Human Review

**Status:** Tech design presented to human. Accepted based on verification results.

**Phase 2 complete.** 4 verification rounds, 14 total findings (all resolved). The dominant failure mode was cross-document propagation drift — every round after R1 was catching stale references from fixes. The session-ID ownership redesign (setSessionId/getSessionId vs onSessionId) took 3 rounds to fully propagate across all 4 documents.

---

## Phase 3: Publish Epic — Epic 12 (Document Awareness and Editing)

### Publisher Launch
