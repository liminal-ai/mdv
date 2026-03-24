# Technical Design Review — Epic 11 (Round 3)

## Verdict

Ready for downstream story publishing.

Sign-off granted.

## Verification Summary

I re-read the updated `tech-design.md` and `test-plan.md` and verified the three Round 2 fixes are now applied correctly:

- Relative-link handling is now explicit and internally coherent. The delegated click handler now intercepts all rendered links by default, then branches to the allowed behaviors for `http/https`, `mailto:`, and `#anchor`; all other links, including relative paths, are neutralized with `preventDefault()` and no further action (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:1176-1180`). That now matches the epic’s “rendered as text, no navigation” intent for relative paths.
- Mermaid detection is now consistent through the design. Q3/Q4, Flow 3, and the interface code all describe the client path as detecting `pre > code.language-mermaid` and processing those blocks via `processChatMermaid()` (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:192-216`, `docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:632-639`, `docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:1018-1022`). The remaining `.mermaid-placeholder` mention is now correctly framed as the server-side contrast in Q7 (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:292`).
- Module-count bookkeeping is now aligned. The architecture header and self-review both say “3 new modules and 5 modified” (`docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:399`, `docs/spec-build/v2/epics/11--chat-rendering-and-polish/tech-design.md:1427`).

## Consistency Check

I did not find new regressions from the Round 3 edits.

- Count reconciliation remains clean: 27 ACs / 82 TCs in the epic, all 82 TC IDs present in the test plan, and per-chunk totals still sum to 92 tests.
- The previously fixed Round 1 and Round 2 items remain intact: flush-before-complete sequencing, shiki cold-start handling, renderer parity updates, menu-bar ownership, stronger TC mappings, and Mermaid safety reuse are all still present.
- Cross-document references that previously drifted are now consistent enough for story publishing.

## Final Assessment

The design now reads as implementation-ready and story-publishable. The remaining tradeoffs are ordinary design choices rather than unresolved contract gaps.
