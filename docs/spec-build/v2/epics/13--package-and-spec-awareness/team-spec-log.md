# Team Spec Log — Epic 13: Package and Spec Awareness

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

Note: Epic 13 is a spec-only phase — no code changes during spec pipeline. Code verification gates apply at implementation. Phase acceptance is document quality + Codex verification.

## Orientation

**What's being built:** Epic 13 — Package and Spec Awareness. Expands the Steward from single-document awareness (Epic 12) to full project-level intelligence. Package-aware chat (manifest structure, cross-file queries), package operations through chat (Steward principle), spec package conventions (metadata for pipeline phases), Liminal Spec phase awareness (conversational guidance on what's next), and folder-mode chat (package operations on non-packages).

**Predecessor state — Epic 12:**
- Epic: complete, Codex-verified (4 rounds, 22 findings all resolved), human-accepted. 18 ACs, 51 TCs.
- Tech design: 4-doc Config B output produced (index + server + client + test-plan). Codex R1 review completed with 1C/5M/2m. Fixes and subsequent rounds not recorded in the log. Status: mid-verification.
- Stories: not yet published.

**Impact on Epic 13 pipeline:** The Epic 13 epic can be written against Epic 12's accepted epic — the scope boundaries, contracts, and what was deferred to Epic 13 are all defined there. Epic 12's tech design details are not required for Epic 13's epic phase. If Epic 13 proceeds to tech design, it would benefit from Epic 12's finalized tech design but could work from the current draft + epic.

**Artifacts available:**
- v2 PRD: `docs/spec-build/v2/prd.md`
- v2 Tech Architecture: `docs/spec-build/v2/technical-architecture.md`
- v1 Epic 01 (App Shell & Workspace Browsing): full spec set
- v1 Epic 06 (Hardening & Electron Wrapper): full spec set
- v2 Epic 08 (Package Format Foundation): full spec set — epic, tech-design, test-plan, stories
- v2 Epic 09 (Package Viewer Integration): full spec set — epic, tech-design (index + server + client), test-plan, stories
- v2 Epic 10 (Chat Plumbing): full spec set — epic, tech-design (index + server + client), test-plan, stories
- v2 Epic 11 (Chat Rendering & Polish): full spec set — epic, tech-design, test-plan, stories
- v2 Epic 12 (Document Awareness & Editing): epic (accepted), tech-design (4 docs, mid-verification)

**Pipeline entry:** Phase 1 (Epic). No prior artifacts exist for Epic 13.

**Human decisions:**
- Business epic: not requested.
- Human review: autonomous mode — human said "don't wait on me for the human epic review, just continue on." All phases will proceed without blocking on human review. Human can review artifacts asynchronously.

**Core specs (orchestrator-selected, informed by prior epic patterns):**

v1 Epics 1 and 6 have been core in every v2 epic. For Epic 13, the reading journey adds three direct predecessors that are essential to the scope:
- v2 Epic 9 (Package Viewer Integration) — defines the package model, manifest, sidebar navigation that Epic 13 makes chat-aware
- v2 Epic 10 (Chat Plumbing) — defines the chat infrastructure Epic 13 extends with package intelligence
- v2 Epic 12 (Document Awareness) — direct predecessor, defines what was explicitly deferred to Epic 13 (package-path conversation keying, multi-file context, spec conventions)

v2 Epic 11 (Chat Rendering) included as it defines the streaming rendering surface the Steward uses, and has been core in prior runs.

---

## Phase 1: Epic — Epic 13 (Package and Spec Awareness)

### Drafter Launch

**Teammate:** `epic-writer` (Opus, general-purpose, bypassPermissions)

**Reading journey (8 docs, sequential with reflection):**
1. v2 PRD → product vision, Feature 13 scope, M4 milestone
2. v2 Tech Architecture → system shape, package awareness, context injection
3. v1 Epic 1 → foundational architecture, workspace model, session persistence
4. v1 Epic 6 → hardening patterns, reliability
5. v2 Epic 9 → package viewer integration, manifest model, sidebar navigation, package operations
6. v2 Epic 10 → chat plumbing, provider abstraction, WebSocket protocol
7. v2 Epic 11 → streaming rendering, UI surface, panel behavior
8. v2 Epic 12 → direct predecessor, context injection, conversation persistence, what was deferred to Epic 13

**Skill loaded last:** `ls-epic`

**Outcome:** Writer completed the full 8-doc reading journey and went directly to drafting — no questions surfaced (none survived self-filter). Draft produced at `docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md`.

**Self-review findings (1 item, fixed):**
1. Removed `file-added` from `ChatPackageChangedMessage` change types — unused; `addFile()` emits `chat:file-created` (Epic 12), package-level changes use `chat:package-changed`

**Draft stats:** 8 flows, 25 ACs, 72 TCs, 7 stories (Story 0–6), 988 lines.

**Open items (tech design deferrals, not epic defects):**
1. Phase detection heuristics (artifact pattern matching) deferred to tech design — convention-level definition, not implementation-level
2. `ChatSendMessage` schema unchanged — server derives workspace/package context from session state. Deliberate simplification, no client protocol change required
3. No `getWorkspaceFiles()` for folder mode — relies on user-provided paths or CLI tools. Avoids scope creep but limits discoverability
4. `navigateToPath(path)` not included — `openDocument(path)` from Epic 12 covers tab opening. Sidebar-only navigation deferred

**Spec deviations:**
- `updateManifestEntries(entries)` → `updateManifest(content: string)` — full content replacement, consistent with Epic 12's `applyEditToActiveDocument(content)` pattern
- `addPackageFile(path, content)` → `addFile(path, content)` — works in both folder and package mode
- `createPackageFromCurrentRoot(options)` → `createPackage(options)` — always operates on current root
