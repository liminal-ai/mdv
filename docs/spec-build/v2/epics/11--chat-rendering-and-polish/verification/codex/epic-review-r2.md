# Epic 11 Review — Round 2

Overall judgment: the requested Round 2 fixes mostly landed, and the amendment count claim is correct, but the epic still has 1 Major and 2 Minor issues. The biggest remaining problem is architectural: the spec still describes the established rendering pipeline as client-side, even though the downstream Epic 3 tech design explicitly records that Epic 2 deviated to server-side markdown rendering with client-side Mermaid post-processing.

## Findings

### Major

1. **The Key Constraint still misstates the established rendering pipeline as client-side.**
   - Epic 11 now says the app must reuse the "existing client-side markdown-it + shiki rendering pipeline" (`epic.md:15`) and repeats that framing in assumptions (`epic.md:86-88`).
   - Epic 2's original epic did specify client-side viewing (`v1 Epic 2 epic.md:14,74`), but Epic 3's downstream tech design explicitly documents that Epic 2 *deviated* to server-side markdown rendering: "Epic 2 deviated from the original spec to render all markdown server-side via markdown-it" (`docs/spec-build/v1/epics/03--mermaid-and-rich-content/tech-design.md:25,42-46`).
   - Why this matters: this is not just historical wording drift. It changes downstream design assumptions for chat, including whether Shiki cold-start is a browser concern (`epic.md:548-551`) and whether the epic is truly reusing the established document-rendering path versus introducing a new client-side chat-only renderer.

### Minor

1. **Relative-path handling is both decided and still open.**
   - The new Link Behavior table says relative paths are "Rendered as text" and out of scope for navigation (`epic.md:636-641`).
   - Tech Design Question 7 still asks whether those same links should be inert text, styled-but-unclickable links, or stripped entirely (`epic.md:701`).
   - One of these needs to yield: either the behavior is already specified in the epic, or it remains a tech-design decision.

2. **Tech Design Question 8 is present, but its premise conflicts with the established Shiki theme model.**
   - Q8 says Shiki generates inline styles that CSS custom properties cannot override (`epic.md:702`).
   - The existing Shiki design docs describe dual-theme CSS-variable output where theme changes update syntax colors via CSS, without re-rendering (`docs/spec-build/v1/epics/03--mermaid-and-rich-content/tech-design.md:44,102-110`; `docs/spec-build/v1/epics/03--mermaid-and-rich-content/tech-design-ui.md:279,425-437`).
   - The fix landed in the document, but not cleanly: if Epic 11 is reusing the established viewer setup, Q8 is framed around the wrong technical premise.

## Fix Landing Verification

All 10 requested edits are present in the draft. Eight landed cleanly; two are present but affected by the architecture/theme inconsistencies above.

| Requested fix | Result | Evidence |
|---|---|---|
| TC-6.4a / 6.4b / 6.4c split under AC-6.4 | Landed cleanly | `epic.md:568-581` |
| `ChatMessage.id` ↔ `messageId` mapping note | Landed cleanly | `epic.md:609-613` |
| TC-1.4d cancelled-response final render | Landed cleanly | `epic.md:206-209` |
| TC-1.1a tightened to document-viewer consistency | Landed cleanly | `epic.md:117-120` |
| Images added to Out of Scope | Landed cleanly | `epic.md:79` |
| TC-2.2b italic / strikethrough partial handling | Landed cleanly | `epic.md:277-280` |
| Link Behavior table in Data Contracts | Landed, but follow-up inconsistency remains with Q7 | `epic.md:634-641`, `epic.md:701` |
| TC-6.2c Shiki cold-start graceful degradation | Present, but depends on the unresolved rendering-location assumption | `epic.md:548-551` |
| Tech Design Q8 on theme change and Shiki inline styles | Present, but not correctly framed against the established Shiki setup | `epic.md:702` |
| Scope annotations note for derived items | Landed cleanly | `epic.md:62-66` |

## Count Verification

- AC count: **27**
- TC count: **82**
- Amendment 2's claim of **27 ACs / 82 TCs** is correct (`epic.md:847`).

## Renumbering And Cross-Reference Verification

- AC numbering is complete and unique: `AC-1.1` through `AC-6.4`.
- TC numbering is sequential within every AC, with no gaps and no duplicates.
- The Link Behavior table's TC references all exist: `TC-1.1g`, `TC-1.1h`, `TC-1.1i`.
- Story-breakdown TC references all exist: `TC-1.3a`, `TC-1.3b`.
- Amendment TC references all resolve to existing TCs, including renumbered references such as `TC-1.4e` and `TC-2.2c`.

## Story Breakdown Coverage

Every AC appears in at least one story coverage list. There are no uncovered ACs.

Notes:
- `AC-1.3` is now split coherently across stories at the TC level: Story 1 owns `TC-1.3a`, Story 2 owns `TC-1.3b`.
- Story 0 still carries supporting infrastructure references for `AC-1.3`, `AC-1.4`, and `AC-1.6`, which is acceptable.

## Bottom Line

The Round 2 amendment set materially improved the epic, and the requested fix list is almost entirely in place. The counts, numbering, and story coverage all check out. The remaining blocker is the rendering-location claim: Epic 11 still treats the established markdown-it + Shiki pipeline as client-side reuse, which conflicts with the documented Epic 2/Epic 3 architecture history and bleeds into newer Shiki-related additions. After that is corrected, the two smaller Q7/Q8 inconsistencies should also be cleaned up.
