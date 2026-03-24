# Epic 11 Review — Round 3

Verdict: all 3 Round 2 findings are fixed correctly. I did not find any new regressions or cross-reference inconsistencies introduced by those fixes.

## Verification

1. **`[Ma1-R2]` Story breakdown ownership for `AC-1.3`**
Status: resolved.

What I verified:
- `AC-1.3` still contains both theme-related TCs:
  - `TC-1.3a` for CSS-variable-based theme styling
  - `TC-1.3b` for Mermaid re-rendering on theme switch
- Story 1 now explicitly owns `AC-1.3 TC-1.3a`.
- Story 2 now explicitly owns `AC-1.3 TC-1.3b` and its deliverables now mention Mermaid theme re-rendering.

Why this is correct:
- The split now matches sequencing: Story 1 can deliver general themed markdown styling, while Story 2 owns the Mermaid-specific part once Mermaid support exists.

2. **`[Mi1-R2]` Tech Design Question 7**
Status: resolved.

What I verified:
- The stale anchor-link question is gone.
- Q7 is now “Relative path handling in agent responses,” which is the real remaining downstream design question after `TC-1.1h` already specified anchor-link behavior.

Why this is correct:
- The epic no longer reopens a behavior it already decided.

3. **`[Mi2-R2]` `AC-3.4` title mismatch**
Status: resolved.

What I verified:
- `AC-3.4` now reads “Scroll position does not jump when a response completes.”
- `TC-3.4a` still tests “No scroll jump after response completes.”

Why this is correct:
- The AC and TC now describe the same event and expected outcome.

## Regressions Check

I did not find any new regressions from these edits.

Specifically checked:
- AC/TC numbering and references remain coherent.
- Story coverage remains logically sequenced after the `AC-1.3` split.
- Tech Design Questions no longer conflict with the newly specified link behavior.
- The amended wording for `AC-3.4` aligns with Story 3 coverage and the existing TC.

## Sign-off

This epic is now ready for downstream tech design work.

Clear sign-off: **Approved for Tech Design.**
