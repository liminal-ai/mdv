# Coverage Artifact: Epic 11 — Chat Rendering and Polish

## Coverage Gate

Every AC and TC from the detailed epic assigned to exactly one story.

| AC | TC | Story |
|----|-----|-------|
| AC-1.1 | TC-1.1a, TC-1.1b, TC-1.1c, TC-1.1d, TC-1.1e, TC-1.1f, TC-1.1g, TC-1.1h, TC-1.1i, TC-1.1j, TC-1.1k | Story 1 |
| AC-1.2 | TC-1.2a, TC-1.2b, TC-1.2c, TC-1.2d | Story 1 |
| AC-1.3 | TC-1.3a | Story 1 |
| AC-1.3 | TC-1.3b | Story 2 |
| AC-1.4 | TC-1.4a, TC-1.4b, TC-1.4c, TC-1.4d, TC-1.4e | Story 1 |
| AC-1.5 | TC-1.5a, TC-1.5b | Story 1 |
| AC-1.6 | TC-1.6a, TC-1.6b, TC-1.6c | Story 0 |
| AC-2.1 | TC-2.1a, TC-2.1b, TC-2.1c | Story 2 |
| AC-2.2 | TC-2.2a, TC-2.2b, TC-2.2c | Story 2 |
| AC-2.3 | TC-2.3a, TC-2.3b, TC-2.3c | Story 2 |
| AC-2.4 | TC-2.4a, TC-2.4b | Story 2 |
| AC-3.1 | TC-3.1a, TC-3.1b | Story 3 |
| AC-3.2 | TC-3.2a, TC-3.2b | Story 3 |
| AC-3.3 | TC-3.3a | Story 3 |
| AC-3.4 | TC-3.4a | Story 3 |
| AC-4.1 | TC-4.1a, TC-4.1b, TC-4.1c | Story 4 |
| AC-4.2 | TC-4.2a, TC-4.2b, TC-4.2c | Story 4 |
| AC-4.3 | TC-4.3a, TC-4.3b | Story 4 |
| AC-4.4 | TC-4.4a, TC-4.4b | Story 4 |
| AC-4.5 | TC-4.5a, TC-4.5b, TC-4.5c | Story 4 |
| AC-5.1 | TC-5.1a, TC-5.1b, TC-5.1c, TC-5.1d | Story 3 |
| AC-5.2 | TC-5.2a, TC-5.2b | Story 3 |
| AC-5.3 | TC-5.3a, TC-5.3b, TC-5.3c, TC-5.3d | Story 3 |
| AC-5.4 | TC-5.4a, TC-5.4b | Story 3 |
| AC-5.4 | TC-5.4c | Story 4 |
| AC-6.1 | TC-6.1a, TC-6.1b, TC-6.1c | Story 4 |
| AC-6.2 | TC-6.2a, TC-6.2b, TC-6.2c, TC-6.2d | Story 4 |
| AC-6.3 | TC-6.3a, TC-6.3b | Story 4 |
| AC-6.4 | TC-6.4a, TC-6.4b, TC-6.4c | Story 4 |

**Totals:** 27 unique ACs (AC-1.3 split across Stories 1 and 2 by TC; AC-5.4 split across Stories 3 and 4 by TC), 82 TCs, all assigned. No orphans.

---

## TC Enumeration Cross-Check

Total TCs by AC:
- AC-1.1: 11 TCs (a–k) → Story 1
- AC-1.2: 4 TCs (a–d) → Story 1
- AC-1.3: 2 TCs (a–b) → Story 1 (a), Story 2 (b)
- AC-1.4: 5 TCs (a–e) → Story 1
- AC-1.5: 2 TCs (a–b) → Story 1
- AC-1.6: 3 TCs (a–c) → Story 0
- AC-2.1: 3 TCs (a–c) → Story 2
- AC-2.2: 3 TCs (a–c) → Story 2
- AC-2.3: 3 TCs (a–c) → Story 2
- AC-2.4: 2 TCs (a–b) → Story 2
- AC-3.1: 2 TCs (a–b) → Story 3
- AC-3.2: 2 TCs (a–b) → Story 3
- AC-3.3: 1 TC (a) → Story 3
- AC-3.4: 1 TC (a) → Story 3
- AC-4.1: 3 TCs (a–c) → Story 4
- AC-4.2: 3 TCs (a–c) → Story 4
- AC-4.3: 2 TCs (a–b) → Story 4
- AC-4.4: 2 TCs (a–b) → Story 4
- AC-4.5: 3 TCs (a–c) → Story 4
- AC-5.1: 4 TCs (a–d) → Story 3
- AC-5.2: 2 TCs (a–b) → Story 3
- AC-5.3: 4 TCs (a–d) → Story 3
- AC-5.4: 3 TCs (a–c) → Story 3 (a, b), Story 4 (c)
- AC-6.1: 3 TCs (a–c) → Story 4
- AC-6.2: 4 TCs (a–d) → Story 4
- AC-6.3: 2 TCs (a–b) → Story 4
- AC-6.4: 3 TCs (a–c) → Story 4

**Sum: 82 TCs. All accounted for.**

---

## Integration Path Trace

### Path 1: Stream a formatted response — send message, watch markdown render progressively, read completed result

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Developer types message and presses Enter | Enter-to-send shortcut dispatches send | Story 3 | TC-5.1a |
| First tokens arrive | Tokens buffered, debounce timer starts | Story 1 | TC-1.4a, TC-1.4b |
| Debounce fires, markdown renders | Accumulated text rendered through md+shiki pipeline | Story 1 | TC-1.1a, TC-1.1b, TC-1.1c, TC-1.1d, TC-1.1e, TC-1.1f, TC-1.1g, TC-1.1h, TC-1.1i, TC-1.1j, TC-1.1k, TC-1.2a, TC-1.2b, TC-1.2c, TC-1.2d |
| Incomplete code fence mid-stream | Partial fence shows as plain monospace | Story 2 | TC-2.1a |
| Closing fence arrives | Code block upgrades to syntax-highlighted | Story 2 | TC-2.1b |
| Mermaid block completes mid-stream | Diagram renders immediately | Story 2 | TC-2.3b |
| Auto-scroll follows content | View tracks latest rendered content | Story 3 | TC-3.1a |
| Response completes (`chat:done`) | Final render fires immediately, HTML cached | Story 1 | TC-1.4c |
| Completed message retained | Subsequent renders skip this message | Story 1 | TC-1.5a |
| Content sanitized throughout | No script execution in rendered output | Story 0 | TC-1.6a |

### Path 2: Interact during streaming — scroll up, scroll back, cancel response

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Response streaming, developer scrolls up | Auto-scroll disengages | Story 3 | TC-3.2a |
| Content continues below viewport | View stays at developer's position | Story 3 | TC-3.2b |
| Developer scrolls back to bottom | Auto-scroll re-engages | Story 3 | TC-3.3a |
| Developer presses Escape | Response cancelled, final render of partial text | Story 3, Story 1 | TC-5.2a, TC-1.4d |

### Path 3: Toggle panel visibility — close, persist, reopen

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Developer presses Cmd+J | Panel closes with CSS transition | Story 3, Story 4 | TC-5.3a, TC-4.2b |
| Workspace adjusts | Grid template transitions to fill space | Story 4 | TC-4.2c |
| Toggle button appears | Fixed button at right edge | Story 4 | TC-4.5b |
| App reloaded | Panel remains closed (localStorage) | Story 4 | TC-4.5c |
| Developer presses Cmd+J again | Panel opens with transition, width restored | Story 3, Story 4 | TC-5.3b, TC-4.2a |

### Path 4: Theme switch with chat content — verify visual consistency

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Chat has rendered responses | Markdown styled with current theme | Story 1 | TC-1.3a |
| Developer switches theme | Text/code/table colors update via CSS vars, Mermaid diagrams re-render with new theme | Story 2 | TC-1.3b |

### Path 5: Error resilience — render failure, recovery

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Render pipeline throws error | Message falls back to plain text, error logged | Story 4 | TC-6.2a |
| More tokens arrive | Next render cycle retries full pipeline | Story 4 | TC-6.2d |
| Shiki not yet loaded | Code blocks render as monospace pre/code | Story 4 | TC-6.2c |
| Feature flag disabled | No pipeline, no shortcuts, no CSS | Story 4 | TC-6.4a, TC-6.4b, TC-6.4c |

**No gaps identified.** All path segments have an owning story and relevant TCs.

---

## Story Summary

| Story | Title | ACs Covered | Estimated Tests |
|-------|-------|-------------|-----------------|
| Story 0 | Foundation (Infrastructure) | AC-1.6 + infrastructure for AC-1.3, AC-1.4 | 10 |
| Story 1 | Streaming Markdown Rendering | AC-1.1, AC-1.2, AC-1.3 (TC-1.3a), AC-1.4, AC-1.5 | 28 |
| Story 2 | Partial Construct Handling and Mermaid | AC-2.1, AC-2.2, AC-2.3, AC-2.4, AC-1.3 (TC-1.3b) | 16 |
| Story 3 | Scroll Behavior and Keyboard Shortcuts | AC-3.1–3.4, AC-5.1–5.3, AC-5.4 (TC-5.4a, TC-5.4b) | 19 |
| Story 4 | UI Polish, Panel Toggle, and Error Handling | AC-4.1–4.5, AC-5.4 (TC-5.4c), AC-6.1–6.4 | 19 |
| **Total** | | **27 ACs, 82 TCs** | **92 tests** |

### Story Dependencies

```
Story 0 (Foundation)
    ↓
Story 1 (Streaming Rendering)
    ├──→ Story 2 (Partial Constructs + Mermaid)
    └──→ Story 3 (Scroll + Shortcuts)
              ↓
         Story 4 (Polish + Toggle + Errors)
```

Stories 2 and 3 can proceed in parallel after Story 1. Story 4 depends on both Stories 1 and 3.
