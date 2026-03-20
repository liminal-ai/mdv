# Team Implementation Log — Epic 2: Document Viewing and Multi-Tab Reading

## Lane Determination

**Selected lane:** Codex via `codex-subagent`

| Skill | Found | Notes |
|-------|-------|-------|
| codex-subagent | Yes | Loaded successfully. Default model `gpt-5.4`, reasoning `high`, sandbox `danger-full-access` |
| copilot-subagent | Yes | Available as fallback, not selected |
| gpt53-codex-prompting | No | Not found in `~/.claude/skills/` or any plugin. Searched `**/*codex-prompting*` — no results. Proceeding without it; prompts will follow codex-subagent skill guidance directly |

No fallbacks applied. Running in Codex lane with full multi-model verification.

---

## Verification Gates

**Source:** `app/package.json` scripts

**Story acceptance gate:**
```bash
cd /Users/leemoore/code/md-viewer/app && npm run verify
```
Runs: `format:check → lint → typecheck → typecheck:client → test`

**Epic acceptance gate:**
```bash
cd /Users/leemoore/code/md-viewer/app && npm run verify-all
```
Currently identical to `verify`. If CI config evolves during the epic, re-check.

**Pre-existing test state:**
- 18 test files, 156 tests
- 155 pass, **1 failing**: `tests/client/app.test.ts:117` — `expect(document.body.textContent).toContain('MD Viewer')` fails due to extra whitespace between characters (`M D V i e w e r`). This is a pre-existing Epic 1 issue. Flag as `accepted-risk` for Story 0 — do not let it block the gate. Investigate and fix if still failing at Story 1 start.

---

## Artifacts

| Artifact | Path |
|----------|------|
| Epic | `docs/spec-build/features/02--document-viewing-and-multi-tab-reading/epic.md` |
| Tech design (index) | `...02--document-viewing-and-multi-tab-reading/tech-design.md` |
| Tech design (API) | `...02--document-viewing-and-multi-tab-reading/tech-design-api.md` |
| Tech design (UI) | `...02--document-viewing-and-multi-tab-reading/tech-design-ui.md` |
| Test plan | `...02--document-viewing-and-multi-tab-reading/test-plan.md` |
| Stories | `...02--document-viewing-and-multi-tab-reading/stories/story-{0..7}-*.md` |
| Coverage | `...02--document-viewing-and-multi-tab-reading/stories/coverage-and-traceability.md` |

**Working directory:** `/Users/leemoore/code/md-viewer/app`

---

## Tech Design Deviations from Epic/Stories

The tech design (written after stories were sharded from the epic) introduced several architectural deviations. The stories carry the epic's pre-deviation contracts. The tech design is authoritative for implementation.

| Deviation | Epic/Story Says | Tech Design Says | Impact on Stories |
|-----------|----------------|-------------------|-------------------|
| Rendering location | Client-side (Key Constraint, A7) | **Server-side only** via markdown-it | Story 1's `FileReadResponse` lacks `html` and `warnings` fields. Tech design adds them. Implementer must use tech design's schema. |
| Watch transport | SSE (`GET /api/file/watch`) | **WebSocket** via `@fastify/websocket` at `/ws` | Story 7 references SSE endpoint. Implementation uses WebSocket per tech design. Story 0's stub list includes `/api/file/watch` which becomes a WS route. |
| Tab state persistence | A5: "does not persist across restarts" | **Persist** `openTabs` and `activeTab` to session | Adds `PUT /api/session/tabs` endpoint not listed in any story. Story 0 stubs and Story 4 implements. |
| Image proxy | Not specified | `GET /api/image?path=...` proxy endpoint | Story 3 needs this endpoint. Tech design provides full spec. |
| Large file handling | Not specified | Three tiers: <1MB normal, 1-5MB warning, >5MB hard cap (413) | Adds error class and size-check logic to Story 1's file read flow. |

**Guidance for handoffs:** Instruct implementers to read the tech design as the implementation authority. When a story's data contract or API surface conflicts with the tech design, follow the tech design. The story's ACs and TCs define *what* the user sees; the tech design defines *how* it's built.

---

## Story Sequence and Risk Assessment

Execution order respects the dependency graph:

```
Story 0 (foundation)
  └→ Story 1 (file read API)
       ├→ Story 2 (markdown rendering)
       │    ├→ Story 4 (tab management, also needs Story 1)
       │    │    └→ Story 5 (content toolbar, needs Story 2 + Story 4)
       │    │         └→ Story 3 (image handling, needs Story 2 + Story 5)
       │    ├→ Story 6 (link navigation, needs Story 2 + Story 4)
       │    └→ Story 7 (file watching, needs Story 1 + Story 2)
```

**Planned execution order:** 0 → 1 → 2 → 4 → 5 → 3 → 6 → 7

| Story | Risk | Rationale |
|-------|------|-----------|
| 0 — Foundation | Low | Types, fixtures, stubs. No logic. |
| 1 — File Read API | Medium | First real endpoint + client flow. Multiple error paths. Pre-existing test failure may interact. |
| 2 — Markdown Rendering | Medium | markdown-it pipeline + DOMPurify + image post-processing. Most TCs in the epic (24). New npm dependencies. |
| 4 — Tab Management | Medium | Complex client state (open/close/switch/reorder/overflow/context menu). 17 TCs. DOM-heavy. |
| 5 — Content Toolbar | Low | Mostly disabled UI (Edit, Export). 16 TCs but most are presence/visibility checks. |
| 3 — Image Handling | Medium | Image proxy endpoint + placeholder rendering + warning count. Cross-cuts Story 2 (rendering) and Story 5 (toolbar). |
| 6 — Link Navigation | Low | Link classifier + click handler. 6 TCs. Smallest story. |
| 7 — File Watching | High | WebSocket, fs.watch, debounce, atomic saves, deletion detection, reconnect. Real-time behavior is hard to test reliably. |

---

## Codebase Baseline

**Epic 1 delivers:**
- Fastify server with routes: browse, clipboard, session, tree
- Services: browse, session, theme-registry, tree
- Shared types in `shared/types.ts`
- Client: state store, app bootstrap, components (content-area, context-menu, error-notification, file-tree, menu-bar, root-line, sidebar, tab-strip, workspaces)
- Client utils: keyboard, dom, clipboard
- Client API client
- CSS: base, content-area, context-menu, menu-bar, sidebar, tab-strip, themes
- 37 source files, 18 test files (including fixtures + utilities), 156 tests

**New files expected per test plan:** 14 new test files, ~134 new tests. Plus new source files for services, routes, components, utils, CSS, and fixtures.

---

## Cumulative Test Tracking

| Story | Tests Added | Cumulative Total | Notes |
|-------|-------------|------------------|-------|
| Baseline (Epic 1) | — | 156 (155 passing, 1 failing) | Pre-existing failure in app.test.ts |
| Story 0 | ~0 | ~156 | Types and stubs, no test logic |
| Story 1 | ~16 (server) + ~10 (client) | ~182 | file.test.ts + tab/content/menu client tests |
| Story 2 | ~23 (server) | ~205 | file-render.test.ts |
| Story 4 | ~20 (client) | ~225 | tab-strip.test.ts |
| Story 5 | ~12 (client) | ~237 | content-toolbar.test.ts + menu-bar-epic2.test.ts |
| Story 3 | ~8 (server) + ~5 (image proxy) | ~250 | file-images.test.ts + image.test.ts |
| Story 6 | ~8 (client) | ~258 | link-handler.test.ts |
| Story 7 | ~10 (server) + ~5 (client) | ~273 | ws.test.ts (server + client) + keyboard-epic2.test.ts |

Test plan total: 134 new tests → ~290 total. Estimates above are rough; exact counts locked after each story.

---

## Handoff Protocol: Sequential Reading with Reflection Checkpoints

Teammates and Codex subagents receive spec documents in a prescribed read order, not a flat parallel dump. This mitigates the "lost in the middle" attention effect and ensures cross-cutting decisions are internalized before domain-specific specs land.

### Read Order (per teammate)

**Phase 1 — Shared context (read first, establishes vocabulary and architecture):**
1. `tech-design.md` — index doc with all spec deviations, stack decisions, Q&A answers
2. `epic.md` — full feature spec with all ACs, TCs, data contracts, flows

**Phase 2 — Domain-specific design (grouped reads):**
3. `tech-design-api.md` — server schemas, services, routes, rendering pipeline
4. `tech-design-ui.md` — client state, components, tab lifecycle, link handler, WS client
5. `test-plan.md` — TC→test mapping, fixtures, mock strategy, chunk breakdown

**Phase 3 — Reflection checkpoint:**
After reading 1–5, the agent stops and writes a summary of:
- Key architectural decisions (server-side rendering, WebSocket, tab persistence)
- Spec deviations from the epic that affect their story
- The data contracts and API surface they'll implement against
- Any open questions or risks they see

This summary is written down (to a file or as structured output) before any code is touched. The agent's own reflection becomes compressed high-quality context that persists through the implementation window.

**Phase 4 — Story (read last, with full context):**
6. The specific story being implemented — ACs, TCs, scope, dependencies, DoD

The story lands on a foundation the agent has already integrated. Cross-references to tech design decisions connect to the agent's own summary rather than requiring attention back to raw spec text thousands of tokens earlier.

### For Codex Subagents

Codex receives a single prompt. The prompt embeds the read order explicitly:

```
Read these documents in order. After each, note what you learned before moving to the next.
1. [tech-design.md] — architectural decisions, spec deviations
2. [epic.md] — feature spec, ACs, TCs
3. [tech-design-api.md] — server design
4. [tech-design-ui.md] — client design
5. [test-plan.md] — test mapping
6. [story-N.md] — your implementation target

After reading 1–5, write a brief summary of key decisions before starting implementation.
Then implement Story N.
```

The sequential instruction counteracts Codex's tendency to skim parallel inputs. The reflection step forces integration before action.

### Rationale

- Transformers attend more strongly to content at the start and end of context than the middle
- When 5+ large documents load in parallel, middle documents get weakest attention at the critical thinking step
- Sequential reading with reflection mitigates this because the agent's own reflection becomes high-quality compressed context that gets strong attention downstream
- Each new document lands on a foundation the agent has already integrated, rather than requiring post-hoc reconstruction from a flat context dump

---

## Resolved Items

1. **Pre-existing test failure** — `app.test.ts:117` failing. Check status when Epic 1 wraps. Fix if still failing before Story 0 starts.
2. **Story 0 scope** — Tech design is the implementation authority. Story 0 implements the tech design's full schema set (including `html`/`warnings` on `FileReadResponse`, `UpdateTabsRequestSchema`, WS message schemas, extended `SessionState`), not just the story doc's pre-deviation contracts.
3. **Execution order** — 0 → 1 → 2 → 4 → 5 → 3 → 6 → 7. Dictated by dependency graph, no meaningful alternative.
