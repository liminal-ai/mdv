# Coverage and Traceability

## Integration Path Trace

### Path 1: Open Document → Switch to Edit → Type Edits → Save → Switch to Render → See Changes

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Open file | User clicks a file in the sidebar tree | Epic 2 Story 1 | Epic 2 TC-1.1a |
| File loads in default mode | Tab opens in Render or Edit per default mode setting | Story 1 | TC-7.1b, TC-7.1d |
| Switch to Edit mode | User clicks Edit button or presses Cmd+Shift+M | Story 1 | TC-1.1a, TC-1.1c |
| Toolbar updates | Edit button active, cursor position shown, warnings hidden | Story 1 | TC-1.2a |
| Editor displays content | Raw markdown with syntax highlighting, line numbers | Story 2 | TC-2.1a, TC-2.1b |
| Cursor position shown | Ln/Col displayed in toolbar status area | Story 2 | TC-2.1c |
| User types edits | Text appears at cursor, dirty indicator activates | Story 2 | TC-2.2a |
| Dirty dot on tab | Tab shows dot indicator | Story 3 | TC-4.1a, TC-4.1c |
| Dirty indicator in toolbar | "Modified" label or dot visible | Story 3 | TC-4.2a |
| User presses Cmd+S | Content written to disk, dirty clears | Story 3 | TC-3.1a |
| Self-change not conflict | File watcher ignores self-originated write | Story 3 | TC-3.1d |
| Switch to Render mode | User clicks Render button | Story 1 | TC-1.1b |
| Rendered view shows edits | Current content rendered (including saved changes) | Story 1 | TC-1.1e |
| Toolbar updates | Render button active, warnings shown, cursor hidden | Story 1 | TC-1.2b |

### Path 2: Edit Document → External Change → Conflict Modal → Resolve

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| User is editing | Document open in Edit mode with unsaved changes | Story 2 | TC-2.2a |
| Dirty state active | Tab dot and toolbar indicator visible | Story 3 | TC-4.1a, TC-4.2a |
| External process modifies file | File changed on disk by agent or another tool | Story 5 | TC-6.1a |
| Conflict modal appears | "[filename] has been modified externally." with 3 options | Story 5 | TC-6.1a |
| Option A: Keep My Changes | Modal closes, local edits retained, watcher continues | Story 5 | TC-6.1b |
| Option B: Reload from Disk | Editor content replaced, dirty clears | Story 5 | TC-6.1c |
| Option C: Save Copy | Save As dialog opens, local edits saved to new path, original reloads | Story 5 | TC-6.1d |
| Save Copy cancel | Returns to conflict modal, edits preserved | Story 5 | TC-6.1e |
| Save Copy failure | Error shown, returns to conflict modal | Story 5 | TC-6.1f |

### Path 3: Edit Document → Close Tab → Unsaved Changes Prompt → Save and Close

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| User has unsaved edits | Document dirty in Edit mode | Story 3 | TC-4.1a |
| User clicks tab close button | Or presses Cmd+W | Story 4 | TC-5.1a, TC-5.1f |
| Unsaved changes modal | "You have unsaved changes in [filename]." with 3 options | Story 4 | TC-5.1a |
| Option A: Save and Close | File saved, then tab closed; if save fails, tab stays open | Story 4 | TC-5.1b |
| Option B: Discard Changes | Tab closed without saving, edits lost | Story 4 | TC-5.1c |
| Option C: Cancel | Modal closes, tab remains with edits | Story 4 | TC-5.1d |

---

## Coverage Gate

Every AC and TC from the epic mapped to exactly one story.

| AC | TC | Story |
|----|-----|-------|
| AC-1.1 | TC-1.1a | Story 1 |
| AC-1.1 | TC-1.1b | Story 1 |
| AC-1.1 | TC-1.1c | Story 1 |
| AC-1.1 | TC-1.1d | Story 1 |
| AC-1.1 | TC-1.1e | Story 1 |
| AC-1.1 | TC-1.1f | Story 1 |
| AC-1.2 | TC-1.2a | Story 1 |
| AC-1.2 | TC-1.2b | Story 1 |
| AC-2.1 | TC-2.1a | Story 2 |
| AC-2.1 | TC-2.1b | Story 2 |
| AC-2.1 | TC-2.1c | Story 2 |
| AC-2.1 | TC-2.1d | Story 2 |
| AC-2.2 | TC-2.2a | Story 2 |
| AC-2.2 | TC-2.2b | Story 2 |
| AC-2.2 | TC-2.2c | Story 2 |
| AC-2.2 | TC-2.2d | Story 2 |
| AC-2.2 | TC-2.2e | Story 2 |
| AC-2.3 | TC-2.3a | Story 2 |
| AC-2.3 | TC-2.3b | Story 2 |
| AC-2.3 | TC-2.3c | Story 2 |
| AC-2.4 | TC-2.4a | Story 2 |
| AC-2.4 | TC-2.4b | Story 2 |
| AC-3.1 | TC-3.1a | Story 3 |
| AC-3.1 | TC-3.1b | Story 3 |
| AC-3.1 | TC-3.1c | Story 3 |
| AC-3.1 | TC-3.1d | Story 3 |
| AC-3.1 | TC-3.1e | Story 3 |
| AC-3.1 | TC-3.1f | Story 3 |
| AC-3.2 | TC-3.2a | Story 3 |
| AC-3.2 | TC-3.2b | Story 3 |
| AC-3.2 | TC-3.2c | Story 3 |
| AC-3.2 | TC-3.2d | Story 3 |
| AC-3.2 | TC-3.2e | Story 3 |
| AC-3.2 | TC-3.2f | Story 3 |
| AC-3.3 | TC-3.3a | Story 3 |
| AC-3.3 | TC-3.3b | Story 3 |
| AC-3.3 | TC-3.3c | Story 3 |
| AC-4.1 | TC-4.1a | Story 3 |
| AC-4.1 | TC-4.1b | Story 3 |
| AC-4.1 | TC-4.1c | Story 3 |
| AC-4.2 | TC-4.2a | Story 3 |
| AC-4.2 | TC-4.2b | Story 3 |
| AC-4.3 | TC-4.3a | Story 3 |
| AC-5.1 | TC-5.1a | Story 4 |
| AC-5.1 | TC-5.1b | Story 4 |
| AC-5.1 | TC-5.1c | Story 4 |
| AC-5.1 | TC-5.1d | Story 4 |
| AC-5.1 | TC-5.1e | Story 4 |
| AC-5.1 | TC-5.1f | Story 4 |
| AC-5.2 | TC-5.2a | Story 4 |
| AC-5.2 | TC-5.2b | Story 4 |
| AC-5.3 | TC-5.3a | Story 4 |
| AC-5.3 | TC-5.3b | Story 4 |
| AC-5.3 | TC-5.3c | Story 4 |
| AC-5.3 | TC-5.3d | Story 4 |
| AC-5.3 | TC-5.3e | Story 4 |
| AC-5.3 | TC-5.3f | Story 4 |
| AC-6.1 | TC-6.1a | Story 5 |
| AC-6.1 | TC-6.1b | Story 5 |
| AC-6.1 | TC-6.1c | Story 5 |
| AC-6.1 | TC-6.1d | Story 5 |
| AC-6.1 | TC-6.1e | Story 5 |
| AC-6.1 | TC-6.1f | Story 5 |
| AC-6.1 | TC-6.1g | Story 5 |
| AC-6.2 | TC-6.2a | Story 5 |
| AC-6.3 | TC-6.3a | Story 5 |
| AC-7.1 | TC-7.1a | Story 1 |
| AC-7.1 | TC-7.1b | Story 1 |
| AC-7.1 | TC-7.1c | Story 1 |
| AC-7.1 | TC-7.1d | Story 1 |
| AC-7.2 | TC-7.2a | Story 1 |
| AC-8.1 | TC-8.1a | Story 6 |
| AC-8.1 | TC-8.1b | Story 6 |
| AC-8.1 | TC-8.1c | Story 6 |
| AC-8.2 | TC-8.2a | Story 6 |
| AC-8.2 | TC-8.2b | Story 6 |
| AC-9.1 | TC-9.1a | Story 6 |
| AC-9.1 | TC-9.1b | Story 6 |
| AC-9.2 | TC-9.2a | Story 6 |
| AC-9.2 | TC-9.2b | Story 6 |
| AC-10.1 | TC-10.1a | Story 6 |
| AC-10.2 | TC-10.2a | Story 6 |
| AC-10.2 | TC-10.2b | Story 6 |

**Coverage summary:**
- 26 ACs — all mapped
- 83 TCs from epic — all mapped to exactly one story
- 0 unmapped epic TCs
- 0 duplicate TC assignments

**Per-story TC counts:**

| Story | TCs | ACs |
|-------|-----|-----|
| Story 0 | 0 (infrastructure) | 0 |
| Story 1 | 13 | AC-1.1, AC-1.2, AC-7.1, AC-7.2 |
| Story 2 | 14 | AC-2.1, AC-2.2, AC-2.3, AC-2.4 |
| Story 3 | 21 | AC-3.1, AC-3.2, AC-3.3, AC-4.1, AC-4.2, AC-4.3 |
| Story 4 | 14 | AC-5.1, AC-5.2, AC-5.3 |
| Story 5 | 9 | AC-6.1, AC-6.2, AC-6.3 |
| Story 6 | 12 | AC-8.1, AC-8.2, AC-9.1, AC-9.2, AC-10.1, AC-10.2 |

---

## Cross-Cutting Concerns

The epic defines non-functional requirements (performance, reliability, security) that apply across multiple stories and must be verified as part of each story's implementation.

### Performance

| Requirement | Primary Stories | Verification |
|---|---|---|
| Editor opens and displays content within 1 second for files up to 500KB | Story 2 | Story 2 DoD |
| Typing latency is imperceptible (under 16ms per keystroke) for files up to 10,000 lines | Story 2, Story 6 | TC-10.2a |
| Mode switching (Render ↔ Edit) completes within 500ms | Story 1 | Story 1 DoD |
| Save completes within 1 second for files up to 1MB | Story 3 | Story 3 DoD |

### Reliability

| Requirement | Primary Stories | Verification |
|---|---|---|
| Save uses atomic writes (temp file + rename) to prevent corruption on crash or power loss | Story 3 | Story 3 DoD |
| Unsaved edits are never silently discarded — every destructive action prompts first | Story 4 | TC-5.1a, TC-5.1f, TC-5.3a, TC-5.3e |
| Self-originated file changes (from save) do not trigger conflict modals | Story 3 | TC-3.1d |

### Security

| Requirement | Primary Stories | Verification |
|---|---|---|
| Save writes only to the path the user owns (current path or Save As selection) | Story 3 | Server-side path validation in PUT /api/file |
| Editor content is not written to disk until the user explicitly saves — no auto-save | Story 3 | By design; no auto-save mechanism exists |
| No persistent temp files containing user content are left behind | Story 3 | Atomic write cleanup on completion or failure |
| No remote resources are fetched during editing | Story 2 | By design; editor is local-only |

---

## Validation

- [x] Every AC from the epic appears in exactly one story file
- [x] Every TC from the epic appears in exactly one story (83 TCs, 0 orphans)
- [x] Integration path trace covers all three critical paths
- [x] Coverage gate table complete with no orphans or duplicates
- [x] Each story has Jira section markers
- [x] No composite story labels in integration trace (each segment references a single story)
- [x] NFRs, security requirements mapped to stories as cross-cutting concerns
- [x] Story dependency chains are complete (Story 1 → Story 2 → Story 3 → Story 4/5/6)
- [x] Data contracts copied verbatim from epic in story files
- [x] User Profile includes all four fields in every story
