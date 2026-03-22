# Coverage Artifact: Epic 6 — Hardening and Electron Wrapper

## Coverage Gate

Every AC and TC from the detailed epic assigned to exactly one story.

| AC | TC | Story |
|----|-----|-------|
| AC-1.1 | TC-1.1a, TC-1.1b, TC-1.1c | Story 1 |
| AC-1.2 | TC-1.2a, TC-1.2b | Story 1 |
| AC-2.1 | TC-2.1a, TC-2.1b, TC-2.1c | Story 2 |
| AC-2.2 | TC-2.2a | Story 2 |
| AC-3.1 | TC-3.1a, TC-3.1b, TC-3.1c | Story 3 |
| AC-3.2 | TC-3.2a, TC-3.2b | Story 3 |
| AC-4.1 | TC-4.1a | Story 2 |
| AC-4.1 | TC-4.1b | Story 5 |
| AC-4.1 | TC-4.1c | Story 4 |
| AC-5.1 | TC-5.1a, TC-5.1b | Story 2 |
| AC-5.2 | TC-5.2a, TC-5.2b, TC-5.2c | Story 2 |
| AC-5.3 | TC-5.3a, TC-5.3b, TC-5.3c | Story 2 |
| AC-5.4 | TC-5.4a | Story 2 |
| AC-6.1 | TC-6.1a, TC-6.1b, TC-6.1c | Story 3 |
| AC-6.2 | TC-6.2a, TC-6.2b | Story 3 |
| AC-6.3 | TC-6.3a, TC-6.3b | Story 3 |
| AC-7.1 | TC-7.1a, TC-7.1b, TC-7.1c | Story 5 |
| AC-7.2 | TC-7.2a, TC-7.2b | Story 5 |
| AC-7.3 | TC-7.3a, TC-7.3b | Story 5 |
| AC-8.1 | TC-8.1a, TC-8.1b, TC-8.1c, TC-8.1d, TC-8.1e | Story 6 |
| AC-8.2 | TC-8.2a, TC-8.2b, TC-8.2c, TC-8.2d | Story 6 |
| AC-8.3 | TC-8.3a, TC-8.3b | Story 6 |
| AC-9.1 | TC-9.1a, TC-9.1b | Story 7 |
| AC-9.2 | TC-9.2a, TC-9.2b, TC-9.2c, TC-9.2d, TC-9.2e | Story 7 |
| AC-9.3 | TC-9.3a | Story 7 |
| AC-10.1 | TC-10.1a, TC-10.1b, TC-10.1c, TC-10.1d, TC-10.1e, TC-10.1f | Story 6 |
| AC-11.1 | TC-11.1a, TC-11.1b, TC-11.1c, TC-11.1d | Story 4 |
| AC-11.2 | TC-11.2a, TC-11.2b | Story 4 |
| AC-11.3 | TC-11.3a, TC-11.3b | Story 4 |
| AC-12.1 | TC-12.1a, TC-12.1b | Story 7 |
| AC-12.2 | TC-12.2a, TC-12.2b, TC-12.2c | Story 7 |
| AC-12.3 | TC-12.3a, TC-12.3b | Story 7 |
| AC-13.1 | TC-13.1a, TC-13.1b | Story 2 |
| AC-13.2 | TC-13.2a, TC-13.2b | Story 5 |

**Totals:** 32 unique AC IDs (AC-4.1 split across Stories 2, 4, and 5 by TC), 84 TCs, all assigned. No orphans.

---

## Integration Path Trace

### Path 1: Daily desktop use — launch, browse, view, edit, quit

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Launch Electron app | App starts, server boots, window appears | Story 5 | TC-7.1a, TC-4.1b |
| Tabs restored from previous session | Persisted tabs appear, active tab loads | Story 4 | TC-11.1a, TC-11.1b, TC-4.1c |
| Browse large directory | Set root with 1,000+ files, tree loads | Story 2 | TC-2.1a |
| Expand All in large tree | All directories expand, virtual scroll active | Story 2 | TC-2.1b, TC-2.1c |
| Open large document | 10K-line doc renders via chunked insertion | Story 1 | TC-1.1a, TC-1.1b |
| Switch tabs (20+ open) | Instant switch, Mermaid from cache | Story 3 | TC-3.1a, TC-6.1a |
| Edit document | CodeMirror responsive at scale | Story 1 | TC-1.2a |
| Save via native menu | Cmd+S from native File menu | Story 6 | TC-8.1e, TC-8.2c |
| Quit with dirty tabs | Custom modal, Save All and Quit | Story 6 | TC-10.1a, TC-10.1c |
| Tabs persisted for next launch | Tab list saved on every open/close | Story 4 | TC-11.3a |

### Path 2: Finder integration — double-click .md file

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Double-click .md (cold start) — Electron shell starts | App lifecycle, server boot, window creation | Story 5 | TC-7.1a, TC-7.2b |
| Double-click .md (cold start) — tabs restore | Persisted tabs restored before file open | Story 4 | TC-11.1a, TC-4.1c |
| Double-click .md (cold start) — file opens | Queued file opens after restore | Story 7 | TC-9.2a, TC-9.2e |
| Double-click .md (warm start) — single instance routes | Existing window focused via single-instance lock | Story 5 | TC-7.2b |
| Double-click .md (warm start) — file opens | File opens in new tab | Story 7 | TC-9.2b |
| File already open | Existing tab activated | Story 7 | TC-9.2d |
| Drag file onto dock icon | File opens in existing window | Story 7 | TC-9.2c |

### Path 3: Edge cases — filesystem problems

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Root on network filesystem | Tree scan with timeout handling | Story 2 | TC-5.3a |
| Root with symlink loops | Loop detected and skipped | Story 2 | TC-5.2a |
| Root with permission-denied dirs | Dirs skipped silently | Story 2 | TC-5.1b |
| File disappears between sessions | Tab shows "file not found" on restore | Story 4 | TC-11.1d |
| Server crashes in Electron | Restart button shown | Story 5 | TC-13.2b |

**No integration gaps found.** All critical path segments have owning stories and relevant TCs. Cross-story dependencies are explicit: Finder cold-start path traverses Stories 5 → 4 → 7 in sequence.
