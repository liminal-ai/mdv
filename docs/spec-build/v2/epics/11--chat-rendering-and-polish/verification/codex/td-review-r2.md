# Technical Design Review — Epic 11 (Round 2)

## Verdict

Not ready for downstream story publishing yet.

I verified that the drafter materially addressed all 8 Round 1 findings:

- Final-render sequencing is now explicitly flush-first, then `completeResponse(...)`.
- Renderer parity now includes `langAlias` and the hook-order fix matching `render.service.ts`.
- Shiki cold-start is now a two-phase base+shiki initialization model with logging on render failure.
- Link handling moved from attribute post-processing to a delegated click-interceptor pattern.
- `menu-bar.ts` now has explicit ownership in the module architecture.
- Mermaid cache-hit/theme-rerender paths now reuse the safety/sizing steps.
- The Mermaid cache path reference is corrected.
- The previously weak TC mappings called out in Round 1 were strengthened.

Counts are still clean: 27 ACs, 82 TCs, all 82 TC IDs present in `test-plan.md`, and the chunk/file totals still reconcile to 92 tests.

The remaining issues are smaller in number than Round 1, but one is still a real design gap.

## Findings

### Major

- The updated link section still does not specify any mechanism that makes relative markdown links render as text, even though the epic’s Link Behavior table says relative paths must be “Rendered as text (no navigation)” (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/epic.md:634-641`). The new design only defines behavior for `http/https`, `mailto:`, and `#anchor` clicks (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:1176-1178`). With the proposed client pipeline still using normal markdown rendering (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:273-282`), a relative link like `[spec](docs/epic.md)` will still render as `<a href="docs/epic.md">...`, and the design gives no renderer hook, post-process rewrite, or click interception rule that would turn it into plain text or neutralize navigation. This is now the main blocker for sign-off because it leaves a stated behavioral contract unimplemented and untested.

### Minor

- The Mermaid description is internally inconsistent after the fixes. Q3/Q4 still say the chat render cycle produces and processes `.mermaid-placeholder` elements (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:192-216`), but the later configuration table says client chat explicitly omits server-style Mermaid placeholder injection (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:284-290`), and Flow 3 plus the interface code correctly operate on `pre > code.language-mermaid` instead (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:632-639`, `docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:1011-1022`). The implementation direction is understandable, but the document still describes two different Mermaid detection paths.

- A few bookkeeping statements were not updated after the Round 1 fixes. The module architecture section still says “Epic 11 adds 3 new modules and modifies 3 existing modules” (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:399`), but the same section now lists 3 new modules plus 5 modified ones (`chat-panel.ts`, `chat-state.ts`, `chat.css`, `menu-bar.ts`, `mermaid-renderer.ts`) (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:401-438`). The self-review repeats the old “3 new modules, 3 modified” claim (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:1423`). This is minor drift, but it should be cleaned up before publication.

## Sign-off

Sign-off withheld pending one more revision.

If the design adds an explicit relative-link handling mechanism that matches the epic contract, and cleans up the two Mermaid/module-count drifts above, I would be comfortable signing off on the document.
