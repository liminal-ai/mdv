# Epic 12 — Story Coverage Artifact

Proves every AC and TC from the epic is assigned to exactly one story, with no gaps.

---

## Coverage Gate

| AC | TC | Story | Notes |
|----|-----|-------|-------|
| AC-1.1 | TC-1.1a | Story 1 | Document context attached to message |
| AC-1.1 | TC-1.1b | Story 1 | Context contains correct document content |
| AC-1.1 | TC-1.1c | Story 1 | No document open |
| AC-1.1 | TC-1.1d | Story 1 | Document in Edit mode — on-disk content |
| AC-1.2 | TC-1.2a | Story 1 | Indicator shows active document |
| AC-1.2 | TC-1.2b | Story 1 | Indicator hidden when no document |
| AC-1.2 | TC-1.2c | Story 1 | Indicator updates on tab switch |
| AC-1.2 | TC-1.2d | Story 1 | Long path truncated with tooltip |
| AC-1.3 | TC-1.3a | Story 4 | Session ID passed on subsequent messages |
| AC-1.3 | TC-1.3b | Story 4 | Tab switch does not clear conversation |
| AC-1.4 | TC-1.4a | Story 1 | Document within budget included fully |
| AC-1.4 | TC-1.4b | Story 1 | Large document truncated with notification |
| AC-1.4 | TC-1.4c | Story 1 | Context indicator shows truncation status |
| AC-1.5 | TC-1.5a | Story 4 | Relative path opens file in tab |
| AC-1.5 | TC-1.5b | Story 4 | Absolute path within root opens file |
| AC-1.5 | TC-1.5c | Story 4 | Path outside root or nonexistent not clickable |
| AC-1.5 | TC-1.5d | Story 4 | External links still open in system browser |
| AC-2.1 | TC-2.1a | Story 2 | Edit request modifies document on disk |
| AC-2.1 | TC-2.1b | Story 2 | No document open — no edit applied |
| AC-2.2 | TC-2.2a | Story 2 | Clean tab reloads automatically |
| AC-2.2 | TC-2.2b | Story 2 | Viewer shows rendered content, not raw diff |
| AC-2.3 | TC-2.3a | Story 2 | Dirty tab shows conflict modal |
| AC-2.3 | TC-2.3b | Story 2 | Keep My Changes preserves local edits |
| AC-2.3 | TC-2.3c | Story 2 | Reload from Disk loads Steward's changes |
| AC-2.3 | TC-2.3d | Story 2 | Save Copy preserves both versions |
| AC-2.4 | TC-2.4a | Story 2 | Successful edit emits file-created notification |
| AC-2.4 | TC-2.4b | Story 2 | Completed agent message exists after edit |
| AC-2.4 | TC-2.4c | Story 2 | Edit failure reported in chat |
| AC-2.5 | TC-2.5a | Story 2 | Sequential edits in one response |
| AC-3.1 | TC-3.1a | Story 3 | Conversation restored on relaunch |
| AC-3.1 | TC-3.1b | Story 3 | Different workspace has separate conversation |
| AC-3.1 | TC-3.1c | Story 3 | Switching workspaces swaps conversations |
| AC-3.1 | TC-3.1d | Story 3 | Conversation loads on WebSocket connect |
| AC-3.2 | TC-3.2a | Story 3 | Folder workspace uses absolute path |
| AC-3.2 | TC-3.2b | Story 3 | Package workspace uses source path |
| AC-3.2 | TC-3.2c | Story 3 | Reopening same package restores conversation |
| AC-3.3 | TC-3.3a | Story 3 | Session ID passed on restart |
| AC-3.3 | TC-3.3b | Story 3 | Workspace switch loads matching session ID |
| AC-3.3 | TC-3.3c | Story 3 | Clear conversation clears session ID |
| AC-3.3 | TC-3.3d | Story 3 | Workspace switch during streaming cancels first |
| AC-3.4 | TC-3.4a | Story 3 | Messages survive app crash |
| AC-3.4 | TC-3.4b | Story 3 | Partial response on crash |
| AC-3.5 | TC-3.5a | Story 3 | Clear removes persisted messages |
| AC-3.5 | TC-3.5b | Story 3 | New messages after clear persist normally |
| AC-3.6 | TC-3.6a | Story 3 | Missing conversation file |
| AC-3.6 | TC-3.6b | Story 3 | Corrupted conversation file |
| AC-3.6 | TC-3.6c | Story 3 | Conversation file references deleted session |
| AC-4.1 | TC-4.1a | Story 4 | Active document deleted externally |
| AC-4.1 | TC-4.1b | Story 4 | Document read fails |
| AC-4.2 | TC-4.2a | Story 4 | No context indicator when flag disabled |
| AC-4.2 | TC-4.2b | Story 4 | No conversation files created when flag disabled |

---

## Summary

| Metric | Count |
|--------|-------|
| Total ACs | 18 |
| Total TCs | 51 |
| Stories | 5 (Story 0–4) |
| Unmapped TCs | 0 |
| Duplicate TC assignments | 0 |

### Per-Story AC Coverage

| Story | ACs Covered | TC Count |
|-------|-------------|----------|
| Story 0 | (infrastructure — no direct ACs) | 0 |
| Story 1 | AC-1.1, AC-1.2, AC-1.4 | 11 |
| Story 2 | AC-2.1, AC-2.2, AC-2.3, AC-2.4, AC-2.5 | 12 |
| Story 3 | AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-3.5, AC-3.6 | 18 |
| Story 4 | AC-1.3, AC-1.5, AC-4.1, AC-4.2 | 10 |
| **Total** | **18 ACs (across Stories 1–4)** | **51 TCs** |

---

## Integration Path Trace

### Path 1: Developer asks about active document (Context Awareness)

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Tab open | Developer has a document open in the active tab | Story 1 | TC-1.2a |
| Send message | Developer types a question and sends | Story 1 | TC-1.1a |
| Client attaches context | `chat:send` includes `activeDocumentPath` | Story 1 | TC-1.1a |
| Server reads document | Context injection reads from disk, applies budget | Story 1 | TC-1.1b, TC-1.4a |
| Server sends to CLI | Prompt includes document block + system prompt | Story 1 | TC-1.1b |
| CLI resumes session | `--resume` with stored session ID | Story 4 | TC-1.3a |
| Response streams | Tokens arrive, rendered in chat | (Epic 10/11) | — |
| Response completes | Agent message finalized, session ID persisted | Story 3 | TC-3.4a |

### Path 2: Developer requests a document edit (Edit Flow)

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Send edit request | "Fix the table in section 3" | Story 1 | TC-1.1a |
| Context injected | Document content in CLI prompt | Story 1 | TC-1.1b |
| CLI emits script block | `<steward-script>` with edit code | Story 2 | TC-2.1a |
| Script executes | `applyEditToActiveDocument` writes to disk | Story 2 | TC-2.1a |
| File-created notification | `chat:file-created` sent to client | Story 2 | TC-2.4a |
| Viewer refreshes | Clean tab reloads automatically | Story 2 | TC-2.2a |
| Dirty tab conflict | If dirty, conflict modal shown | Story 2 | TC-2.3a |
| Response completes | Agent message with edit explanation | Story 2 | TC-2.4b |

### Path 3: Conversation persists across restart (Persistence)

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Messages exchanged | User sends, agent responds, persisted incrementally | Story 3 | TC-3.4a |
| App quits | Developer closes the app | — | — |
| App relaunches | Same workspace | Story 3 | TC-3.1a |
| WebSocket connects | Chat connection opens | Story 3 | TC-3.1d |
| Conversation loaded | `chat:conversation-load` with persisted messages | Story 3 | TC-3.1d |
| Messages rendered | Agent messages re-rendered through markdown pipeline | Story 3 | TC-3.1a |
| Developer sends message | CLI resumes with stored session ID | Story 3/4 | TC-3.3a |

### Path 4: Local file link navigation

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Agent mentions file | Response contains `docs/spec.md` | Story 4 | TC-1.5a |
| Post-processor runs | File link processor scans rendered HTML | Story 4 | TC-1.5a |
| Path validated | Resolved against root, checked in file tree | Story 4 | TC-1.5a |
| Developer clicks | Click handler opens file in tab | Story 4 | TC-1.5a |

---

## Verification

- [x] Every AC from the epic appears in the coverage gate (18/18)
- [x] Every TC from the epic appears exactly once in the coverage gate (51/51)
- [x] No unmapped TCs
- [x] No duplicate TC assignments
- [x] Integration path traces cover all 4 critical flows with no gaps
- [x] Every AC assigned to exactly one story (Stories 1–4 own all 18 ACs; Story 0 is infrastructure with no direct ACs)
