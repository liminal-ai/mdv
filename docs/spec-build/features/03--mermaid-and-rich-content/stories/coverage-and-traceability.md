# Coverage and Traceability

## Integration Path Trace

### Path 1: Open Document with Mermaid Diagrams — See Rendered Diagrams

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Open document | User opens a document containing Mermaid code blocks | Epic 2 Story 1 | Epic 2 TC-1.1a |
| Mermaid blocks identified | Rendering pipeline identifies fenced code blocks with language `mermaid` | Story 1 | TC-1.1a |
| Diagrams rendered as SVG | Each valid Mermaid block is parsed and rendered as an inline SVG diagram | Story 1 | TC-1.1a–TC-1.1h |
| Diagrams sized to fit | Wide diagrams scale down; small diagrams render at natural size | Story 1 | TC-1.2a, TC-1.2b |
| Theme applied to diagrams | Diagrams use colors matching the active light/dark theme | Story 1 | TC-1.3a, TC-1.3b |
| Epic 2 placeholders replaced | Mermaid placeholder text from Epic 2 no longer appears | Story 1 | TC-1.5a |
| Click directives stripped | Diagrams are static; no clickable links or hover effects | Story 1 | TC-1.6a, TC-1.6b |
| Invalid block shows fallback | Failed Mermaid block shows raw source with error banner | Story 2 | TC-2.1a |
| Warning count updated | Mermaid failure added to warning count in content toolbar | Story 2 | TC-2.2a |
| Theme switch updates diagrams | Switching themes re-renders diagrams with new colors | Story 1 | TC-1.3c |

### Path 2: Open Document with Code Blocks — See Syntax Highlighting

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Open document | User opens a document containing code blocks with language tags | Epic 2 Story 1 | Epic 2 TC-1.1a |
| Language tags detected | Rendering pipeline identifies fenced code blocks with language tags | Story 3 | TC-3.1a |
| Syntax highlighting applied | Code tokens are colored according to language rules | Story 3 | TC-3.1a, TC-3.2a |
| Aliases resolved | Common aliases (js, ts, py, sh, yml) map to correct languages | Story 3 | TC-3.2b |
| Theme applied to highlighting | Highlighting colors match the active light/dark theme | Story 3 | TC-3.4a, TC-3.4b |
| Unknown language falls back | Unrecognized language tags render as plain monospace | Story 3 | TC-3.3b |
| No language tag falls back | Bare fenced code blocks render as plain monospace | Story 3 | TC-3.3a |
| Highlighting failure silent | Engine errors fall back to monospace without warnings | Story 3 | TC-3.5a |
| Theme switch updates highlighting | Switching themes updates code highlighting colors | Story 3 | TC-3.4c |

### Path 3: Open Document with Mixed Content Including Errors — See Appropriate Fallbacks

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Open document | User opens a document with Mermaid, code blocks, tables, images | Epic 2 Story 1 | Epic 2 TC-1.1a |
| Valid Mermaid renders | Valid Mermaid blocks render as diagrams | Story 1 | TC-1.4b |
| Invalid Mermaid shows fallback | Failed Mermaid block shows error banner with raw source | Story 2 | TC-2.1c |
| Code blocks highlighted | Code blocks with language tags get syntax highlighting | Story 3 | TC-3.1b |
| Unknown code falls back | Code block with unknown language renders as monospace | Story 3 | TC-3.3b |
| Tables render inline content | Table cells with bold, links, code spans render correctly | Story 4 | TC-4.1a |
| Wide tables scroll | Tables with many columns scroll horizontally | Story 4 | TC-4.2b |
| Missing image shows placeholder | Missing image shows Epic 2 placeholder | Epic 2 | Epic 2 warning infra |
| Warning count aggregates | Warning count shows Mermaid errors + image warnings | Story 2 | TC-2.2a |
| No crash from mixed errors | Multiple failure types coexist without crashing | Story 4 | TC-5.1a |
| File watching re-renders | External edits trigger auto-reload with updated rich content | Story 4 | TC-5.2a, TC-5.2b |

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
| AC-1.1 | TC-1.1g | Story 1 |
| AC-1.1 | TC-1.1h | Story 1 |
| AC-1.2 | TC-1.2a | Story 1 |
| AC-1.2 | TC-1.2b | Story 1 |
| AC-1.2 | TC-1.2c | Story 1 |
| AC-1.3 | TC-1.3a | Story 1 |
| AC-1.3 | TC-1.3b | Story 1 |
| AC-1.3 | TC-1.3c | Story 1 |
| AC-1.4 | TC-1.4a | Story 1 |
| AC-1.4 | TC-1.4b | Story 1 |
| AC-1.5 | TC-1.5a | Story 1 |
| AC-1.6 | TC-1.6a | Story 1 |
| AC-1.6 | TC-1.6b | Story 1 |
| AC-2.1 | TC-2.1a | Story 2 |
| AC-2.1 | TC-2.1b | Story 2 |
| AC-2.1 | TC-2.1c | Story 2 |
| AC-2.1 | TC-2.1d | Story 2 |
| AC-2.2 | TC-2.2a | Story 2 |
| AC-2.2 | TC-2.2b | Story 2 |
| AC-2.2 | TC-2.2c | Story 2 |
| AC-2.3 | TC-2.3a | Story 2 |
| AC-2.3 | TC-2.3b | Story 2 |
| AC-3.1 | TC-3.1a | Story 3 |
| AC-3.1 | TC-3.1b | Story 3 |
| AC-3.1 | TC-3.1c | Story 3 |
| AC-3.1 | TC-3.1d | Story 3 |
| AC-3.2 | TC-3.2a | Story 3 |
| AC-3.2 | TC-3.2b | Story 3 |
| AC-3.3 | TC-3.3a | Story 3 |
| AC-3.3 | TC-3.3b | Story 3 |
| AC-3.3 | TC-3.3c | Story 3 |
| AC-3.4 | TC-3.4a | Story 3 |
| AC-3.4 | TC-3.4b | Story 3 |
| AC-3.4 | TC-3.4c | Story 3 |
| AC-3.5 | TC-3.5a | Story 3 |
| AC-3.5 | TC-3.5b | Story 3 |
| AC-4.1 | TC-4.1a | Story 4 |
| AC-4.1 | TC-4.1b | Story 4 |
| AC-4.1 | TC-4.1c | Story 4 |
| AC-4.2 | TC-4.2a | Story 4 |
| AC-4.2 | TC-4.2b | Story 4 |
| AC-4.2 | TC-4.2c | Story 4 |
| AC-4.3 | TC-4.3a | Story 4 |
| AC-4.3 | TC-4.3b | Story 4 |
| AC-4.3 | TC-4.3c | Story 4 |
| AC-5.1 | TC-5.1a | Story 4 |
| AC-5.1 | TC-5.1b | Story 4 |
| AC-5.2 | TC-5.2a | Story 4 |
| AC-5.2 | TC-5.2b | Story 4 |

**Coverage summary:**
- 19 ACs — all mapped
- 55 TCs from epic — all mapped to exactly one story
- 0 unmapped epic TCs
- 0 dropped TCs

---

## Cross-Cutting Concerns

The epic defines non-functional requirements (performance, rendering consistency, security) that apply across multiple stories and must be verified as part of each story's implementation.

### Performance

| Requirement | Primary Stories | Verification |
|---|---|---|
| Mermaid diagrams render within 5 seconds per diagram for typical complexity (under 50 nodes/edges) | Story 1 | Story 1 integration test |
| Syntax highlighting adds no perceptible delay to document rendering for files under 500KB | Story 3 | Story 3 integration test |
| Documents with 10+ Mermaid diagrams render without freezing the UI | Story 1 | TC-1.4a (5 diagrams verified; 10+ is NFR verification) |
| Large code blocks (3,000+ lines) render with highlighting without freezing | Story 3 | TC-3.1d |
| Theme switching updates diagrams and code highlighting without perceptible delay for typical documents | Story 1, Story 3 | TC-1.3c, TC-3.4c |

### Rendering Consistency

| Requirement | Primary Stories | Verification |
|---|---|---|
| Mermaid output is SVG (not canvas) for export compatibility in Epic 4 | Story 1 | Story 1 DoD |
| Syntax highlighting output is structured HTML with CSS-based coloring for export compatibility | Story 3 | Story 3 DoD |
| Exported output should closely match viewer output (Epic 4 handoff) | Story 1, Story 3 | Architecture constraint carried to Epic 4 |

### Security

| Requirement | Primary Stories | Verification |
|---|---|---|
| Mermaid rendering is sandboxed — no arbitrary JavaScript execution from diagram definitions | Story 1 | Story 1 DoD |
| Syntax highlighting does not execute code block contents | Story 3 | Story 3 DoD |
| No remote resources fetched during Mermaid rendering or syntax highlighting | Story 1, Story 3 | Architecture constraint verified during implementation |

---

## Validation

- [x] Every AC from the epic appears in exactly one story file
- [x] Every TC from the epic appears in exactly one story
- [x] Given/When/Then preserved exactly from the epic
- [x] Integration path traces complete with no gaps
- [x] Coverage gate table complete — 19 ACs, 55 TCs, 0 orphans
- [x] Each story has Jira section markers (Summary, Description, Acceptance Criteria, Technical Design, Definition of Done)
- [x] NFRs (performance, rendering consistency, security) mapped to stories as cross-cutting concerns
- [x] Story dependency chains documented (Story 1 depends on Story 0; Story 2 depends on Story 1; Stories 3 and 4 depend on Story 0)
- [x] Data contracts included in relevant story Technical Design sections
- [x] Epic 4 handoff points documented in rendering consistency cross-cutting concerns
