# Coverage and Traceability

## Integration Path Trace

### Path 1: Open File → View Rendered Content → Switch Tabs

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Click file in tree | User selects a .md file from the sidebar | Story 1 | TC-1.1a |
| File content fetched | Server reads file, returns FileReadResponse | Story 1 | TC-1.2a |
| Loading indicator shown | Spinner/text while request in flight | Story 1 | TC-1.2a |
| Markdown rendered to HTML | Raw content converted to rendered output | Story 2 | TC-2.1a–TC-2.11a |
| Content area displays | Rendered HTML shown in content area | Story 2 | TC-2.1a |
| Tab appears in strip | New tab with filename label | Story 4 | TC-4.1a |
| Content toolbar appears | Toolbar visible with mode toggle, export, status | Story 5 | TC-1.1b |
| Menu bar shows path | File path in status area | Story 5 | TC-1.1c |
| Recent files updated | File added to recent files list | Story 1 | TC-1.6a |
| Switch to another tab | Click different tab | Story 4 | TC-4.2a |
| Scroll position preserved | Return to original tab, position restored | Story 4 | TC-4.2b |

### Path 2: Follow Relative Link → View Linked Document

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Click relative .md link | User clicks a link like `[Design](./design.md)` | Story 6 | TC-5.1a |
| Target file resolved | Path resolved relative to document directory | Story 6 | TC-5.1a |
| File content fetched | Server reads target file | Story 1 | TC-1.2a |
| New tab opens with content | Target rendered and displayed in new tab | Story 6 | TC-5.1a |
| Duplicate check | If already open, reuse existing tab | Story 6 | TC-5.1c |
| Broken link error | If target doesn't exist, show error | Story 6 | TC-5.2a |

### Path 3: External File Change → Auto-Reload

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| File opened and watched | Server establishes filesystem watch | Story 7 | TC-7.1a |
| External process modifies file | File changed on disk | Story 7 | TC-7.2a |
| Change event received | Server pushes FileChangeEvent via SSE | Story 7 | TC-7.2a |
| Debounce applied | Rapid changes coalesced | Story 7 | TC-7.2b |
| Content re-fetched | Client requests updated file content | Story 7 | TC-7.2a |
| Re-rendered and displayed | Updated markdown rendered to HTML | Story 7 (rendering via Story 2) | TC-7.2a |
| Scroll position preserved | View stays at same position | Story 7 | TC-7.2c |
| Tab closed → watch released | Watch cleaned up on close | Story 7 | TC-7.1b |

---

## Coverage Gate

Every AC and TC from the detailed epic mapped to exactly one story.

| AC | TC | Story |
|----|-----|-------|
| AC-1.1 | TC-1.1a | Story 1 |
| AC-1.1 | TC-1.1b | Story 5 |
| AC-1.1 | TC-1.1c | Story 5 |
| AC-1.2 | TC-1.2a | Story 1 |
| AC-1.2 | TC-1.2b | Story 1 |
| AC-1.3 | TC-1.3a | Story 1 |
| AC-1.3 | TC-1.3b | Story 1 |
| AC-1.4 | TC-1.4a | Story 1 |
| AC-1.4 | TC-1.4b | Story 1 |
| AC-1.5 | TC-1.5a | Story 1 |
| AC-1.5 | TC-1.5b | Story 1 |
| AC-1.5 | TC-1.5c | Story 1 |
| AC-1.6 | TC-1.6a | Story 1 |
| AC-1.6 | TC-1.6b | Story 1 |
| AC-1.6 | TC-1.6c | Story 1 |
| AC-1.7 | TC-1.7a | Story 1 |
| AC-1.7 | TC-1.7b | Story 1 |
| AC-2.1 | TC-2.1a | Story 2 |
| AC-2.2 | TC-2.2a | Story 2 |
| AC-2.2 | TC-2.2b | Story 2 |
| AC-2.3 | TC-2.3a | Story 2 |
| AC-2.3 | TC-2.3b | Story 2 |
| AC-2.4 | TC-2.4a | Story 2 |
| AC-2.4 | TC-2.4b | Story 2 |
| AC-2.4 | TC-2.4c | Story 2 |
| AC-2.5 | TC-2.5a | Story 2 |
| AC-2.5 | TC-2.5b | Story 2 |
| AC-2.5 | TC-2.5c | Story 2 |
| AC-2.6 | TC-2.6a | Story 2 |
| AC-2.6 | TC-2.6b | Story 2 |
| AC-2.7 | TC-2.7a | Story 2 |
| AC-2.7 | TC-2.7b | Story 2 |
| AC-2.7 | TC-2.7c | Story 2 |
| AC-2.8 | TC-2.8a | Story 2 |
| AC-2.9 | TC-2.9a | Story 2 |
| AC-2.9 | TC-2.9b | Story 2 |
| AC-2.10 | TC-2.10a | Story 2 |
| AC-2.11 | TC-2.11a | Story 2 |
| AC-3.1 | TC-3.1a | Story 3 |
| AC-3.1 | TC-3.1b | Story 3 |
| AC-3.1 | TC-3.1c | Story 3 |
| AC-3.1 | TC-3.1d | Story 3 |
| AC-3.2 | TC-3.2a | Story 3 |
| AC-3.2 | TC-3.2b | Story 3 |
| AC-3.2 | TC-3.2c | Story 3 |
| AC-3.3 | TC-3.3a | Story 3 |
| AC-3.3 | TC-3.3b | Story 3 |
| AC-4.1 | TC-4.1a | Story 4 |
| AC-4.1 | TC-4.1b | Story 4 |
| AC-4.1 | TC-4.1c | Story 4 |
| AC-4.2 | TC-4.2a | Story 4 |
| AC-4.2 | TC-4.2b | Story 4 |
| AC-4.3 | TC-4.3a | Story 4 |
| AC-4.3 | TC-4.3b | Story 4 |
| AC-4.3 | TC-4.3c | Story 4 |
| AC-4.3 | TC-4.3d | Story 4 |
| AC-4.3 | TC-4.3e | Story 4 |
| AC-4.3 | TC-4.3f | Story 4 |
| AC-4.3 | TC-4.3g | Story 4 |
| AC-4.4 | TC-4.4a | Story 4 |
| AC-4.4 | TC-4.4b | Story 4 |
| AC-4.4 | TC-4.4c | Story 4 |
| AC-4.5 | TC-4.5a | Story 4 |
| AC-4.5 | TC-4.5b | Story 4 |
| AC-5.1 | TC-5.1a | Story 6 |
| AC-5.1 | TC-5.1b | Story 6 |
| AC-5.1 | TC-5.1c | Story 6 |
| AC-5.2 | TC-5.2a | Story 6 |
| AC-5.2 | TC-5.2b | Story 6 |
| AC-5.3 | TC-5.3a | Story 6 |
| AC-6.1 | TC-6.1a | Story 5 |
| AC-6.1 | TC-6.1b | Story 5 |
| AC-6.2 | TC-6.2a | Story 5 |
| AC-6.2 | TC-6.2b | Story 5 |
| AC-6.2 | TC-6.2c | Story 5 |
| AC-6.3 | TC-6.3a | Story 5 |
| AC-6.3 | TC-6.3b | Story 5 |
| AC-6.3 | TC-6.3c | Story 5 |
| AC-6.4 | TC-6.4a | Story 5 |
| AC-6.4 | TC-6.4b | Story 5 |
| AC-6.5 | TC-6.5a | Story 3 |
| AC-6.5 | TC-6.5b | Story 3 |
| AC-6.5 | TC-6.5c | Story 3 |
| AC-7.1 | TC-7.1a | Story 7 |
| AC-7.1 | TC-7.1b | Story 7 |
| AC-7.2 | TC-7.2a | Story 7 |
| AC-7.2 | TC-7.2b | Story 7 |
| AC-7.2 | TC-7.2c | Story 7 |
| AC-7.3 | TC-7.3a | Story 7 |
| AC-7.3 | TC-7.3b | Story 7 |
| AC-7.4 | TC-7.4a | Story 7 |
| AC-8.1 | TC-8.1a | Story 5 |
| AC-8.1 | TC-8.1b | Story 5 |
| AC-8.1 | TC-8.1c | Story 5 |
| AC-8.1 | TC-8.1d | Story 5 |
| AC-9.1 | TC-9.1a | Story 1 |
| AC-9.1 | TC-9.1b | Story 1 |
| AC-9.2 | TC-9.2a | Story 2 |
| AC-9.2 | TC-9.2b | Story 2 |
| AC-9.2 | TC-9.2c | Story 2 |
| AC-9.3 | TC-9.3a | Story 1 |
| AC-9.3 | TC-9.3b | Story 1 |

**Coverage summary:**
- 42 ACs — all mapped
- 102 TCs from epic — all mapped to exactly one story
- 0 story-derived TCs
- 102 total TCs
- 0 unmapped epic TCs
- 0 AC/TC integration gaps (see Cross-Cutting Concerns below for NFR coverage)

---

## Cross-Cutting Concerns

The epic defines non-functional requirements (performance, reliability, security) and a responsive/narrow-window constraint that are not individually testable as standalone ACs. These apply across multiple stories and must be verified as part of each story's implementation.

### Performance

| Requirement | Primary Stories | Verification |
|---|---|---|
| File loads and renders within 1 second for files up to 500KB | Story 1, Story 2 | Measured during Story 2 integration |
| Tab switching is instant (content cached client-side) | Story 4 | Story 4 DoD |
| File watching adds no perceptible UI latency | Story 7 | TC-7.4a |
| Scroll position preservation on tab switch is immediate | Story 4 | TC-4.2b |
| Rendering a document with 50 images (some missing) completes within 2 seconds | Story 3 | Story 3 integration test |

### Reliability

| Requirement | Primary Stories | Verification |
|---|---|---|
| Malformed markdown never crashes the renderer | Story 2 | TC-9.2a, TC-9.2b, TC-9.2c |
| File watching recovers from transient filesystem errors | Story 7 | Story 7 DoD |
| Lost server connection detected and surfaced within 5 seconds | Story 1 | TC-9.3a |

### Security

| Requirement | Primary Stories | Verification |
|---|---|---|
| File read API only serves recognized markdown extensions | Story 1 | Server validates; error code 415/NOT_MARKDOWN |
| Image serving restricted to local filesystem paths | Story 3 | No remote fetch; tech design determines serving mechanism |
| File paths validated and canonicalized server-side to prevent path traversal | Story 1 | Server-side validation in GET /api/file |

### Responsive / Narrow Window

The epic dependency note (line 832) states: "Tab behavior, content rendering, and content toolbar must work at narrow window widths as shown in mockup `06-narrow-window.html`." Epic 1 establishes compressed tabs, reduced content padding, and sidebar collapse. Epic 2 stories must not break those behaviors.

| Constraint | Primary Stories | Verification |
|---|---|---|
| Tabs compress at narrow widths | Story 4 | Visual verification against mockup |
| Content area renders at reduced padding | Story 2, Story 3 | Visual verification against mockup |
| Content toolbar adapts to narrow width | Story 5 | Visual verification against mockup |

---

## Validation

- [x] Every AC from the detailed epic appears in the story file
- [x] Every TC from the detailed epic appears in exactly one story
- [x] Integration path trace complete with no gaps
- [x] Coverage gate table complete with no orphans
- [x] Each story has Jira section markers
- [x] No TypeScript or code blocks in coverage/traceability (they live in stories)
- [x] Mode toggle keyboard shortcut backfilled into the epic via TC-6.2c and mapped to Story 5
- [x] NFRs, security requirements, and responsive constraints mapped to stories as cross-cutting concerns
- [x] Story dependency chains are complete (Story 5 depends on Story 4; Story 3 depends on Story 5; Story 7 depends on Story 2)
