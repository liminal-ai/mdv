# Publish Review R2

## Critical

No critical findings.

## Major

No major findings.

## Minor

1. Story 3 still overclaims tooltip ownership in its non-AC sections after `TC-5.4c` was moved to Story 4. `story-3-scroll-behavior-and-keyboard-shortcuts.md:28` still lists toggle and close button tooltips as in scope, `story-3-scroll-behavior-and-keyboard-shortcuts.md:182-186` still lists tooltip attributes for the panel toggle button and close button, and `story-3-scroll-behavior-and-keyboard-shortcuts.md:202` still makes toggle/close button tooltip hints part of Story 3's Definition of Done. That now conflicts with Story 3's own note that `TC-5.4c` is covered in Story 4 (`story-3-scroll-behavior-and-keyboard-shortcuts.md:137`) and with Story 4's new ownership of the panel-toggle tooltip AC/TC (`story-4-ui-polish-panel-toggle-and-error-handling.md:119-126`). The AC/TC mapping is correct; the residual issue is story narrative coherence.

## Verification

- Round 1 fixes verified:
  - `TC-5.4c` moved from Story 3 to Story 4 and cross-references were added in both stories.
  - Path 4 theme-switch mapping now points to Story 2 / `TC-1.3b`.
  - The shorthand TC range in Path 1 was expanded to literal TC IDs.
- Exact TC fidelity remains clean: all published stories preserve the epic's TC titles and exact Given/When/Then wording.
- Coverage remains complete: all 82 epic TCs appear in exactly one story and exactly once in `stories/coverage.md`.
- Counts remain correct: 27 ACs and 82 TCs.

## Verdict

Not signed off yet. The Round 1 findings are fixed, but the residual Story 3 scope/technical-design/DoD text should be updated to stop claiming toggle/close button tooltip work that now belongs to Story 4.
