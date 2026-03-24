# Publish Review R1 — Epic 12 Stories

Result: Changes requested. Stories are not ready for implementation.

## Critical

1. **AC-4.2 is assigned to two stories instead of exactly one.**
   - The epic defines a single AC-4.2, `All Epic 12 functionality is absent when the feature flag is disabled`, with two TCs: TC-4.2a and TC-4.2b.
   - `stories/story-3-conversation-persistence.md:154` rewrites this as `AC-4.2 (partial)` and carries only TC-4.2b.
   - `stories/story-4-local-file-links-and-error-handling.md:91` keeps AC-4.2 and carries only TC-4.2a, with an explicit note that TC-4.2b lives in Story 3.
   - `stories/coverage.md:60-61` records AC-4.2 in both Story 3 and Story 4, and `stories/coverage.md:147` explicitly blesses that split.
   - This breaks the stated verification rule for this review: every AC and TC must be assigned to exactly one story. It also breaks the publish skill rule that stories should carry full ACs with their TCs, not partial AC fragments.

## Major

1. **Story 3 does not preserve the source AC wording for AC-4.2.**
   - Epic source wording: `All Epic 12 functionality is absent when the feature flag is disabled`.
   - Story 3 wording at `stories/story-3-conversation-persistence.md:154`: `Feature isolation — no conversation files when flag disabled`.
   - TC wording is preserved, but the AC itself is reworded and narrowed, so the story is no longer an exact representation of the epic source.

2. **The coverage artifact contains false verification statements.**
   - `stories/coverage.md:146` says `Each story has at least one AC`, but the same file reports `Story 0 | (infrastructure — supports all ACs) | 0 direct` at `stories/coverage.md:79`.
   - `stories/coverage.md:147` marks the AC-4.2 split as acceptable even though this review requires exact one-story AC ownership.
   - Because of those two statements, the artifact's verification section cannot currently be trusted as accurate.

## Minor

1. **Exact TC fidelity passed.**
   - I compared every published TC's title and exact Given/When/Then wording against `epic.md`.
   - I found no paraphrasing, trimming, or wording drift in the published TCs themselves.

2. **TC coverage counts are otherwise correct.**
   - The coverage gate lists 51 unique TCs with no duplicate TC assignments.
   - Story references used in the published artifacts are valid.

## Verdict

Not approved. Fix AC-4.2 ownership so the full AC lives in exactly one story, update the affected story text to match the epic exactly, and correct the coverage artifact's verification claims.
