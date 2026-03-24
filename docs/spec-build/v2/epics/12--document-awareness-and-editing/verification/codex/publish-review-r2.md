# Publish Review R2 — Epic 12 Stories

Result: Changes requested. All R1 findings are fixed, but one new regression remains.

## Verified Fixes

- AC-4.2 ownership is now correct. Story 3 contains only AC-3.1 through AC-3.6, and Story 4 is the sole owner of AC-4.2.
- Story 4 now uses the exact epic wording for AC-4.2, and both TC-4.2a and TC-4.2b match the epic exactly.
- The coverage gate now assigns all 18 ACs and all 51 TCs exactly once. Story 3 is correctly shown with 18 TCs, Story 4 with 10 TCs, and Story 0 is correctly described as infrastructure with no direct ACs.
- I re-checked TC fidelity in the updated stories and found no Given/When/Then wording drift.

## Major

1. **Story-level Definition of Done test totals no longer match the source test plan.**
   - `stories/story-3-conversation-persistence.md:258` says `npm test` passes with `25 tests (18 conversation service + 7 ws-chat route)`.
   - `test-plan.md:387` still defines Chunk 3 as `26 tests (18 conversation service + 8 ws-chat route)`.
   - `stories/story-4-local-file-links-and-error-handling.md:197` says `npm test` passes with `15 tests (8 file link processor + 5 provider manager + 2 feature isolation)`.
   - `test-plan.md:405` still defines Chunk 4 as `14 tests (8 file link processor + 5 provider manager + 1 client feature isolation)`.
   - The AC/TC ownership fix is good, but the published stories now diverge from the source test-plan mapping. Until those counts are reconciled, the story artifacts are still not fully accurate against the source set.

## Verdict

Not approved. Align the Story 3 and Story 4 Definition of Done test-count lines with the authoritative test plan, or update the source test-plan/tech-design artifacts so all source and published documents agree.
