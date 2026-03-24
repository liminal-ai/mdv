# Epic 11 Review R1

Reviewed, in order:
- `docs/spec-build/v2/prd.md` (Feature 11)
- `docs/spec-build/v2/technical-architecture.md` (`Streaming Markdown Rendering Strategy`)
- `docs/spec-build/v2/epics/10--chat-plumbing/epic.md`
- `docs/spec-build/v2/epics/11--chat-rendering-and-polish/epic.md`

## Critical

No critical blockers found. A Tech Lead could start design, but the major items below should be resolved first to avoid rework.

## Major

1. Mermaid render timing conflicts with the upstream docs.
Evidence: `prd.md:577-580, 607-609` says Mermaid blocks render when complete; `technical-architecture.md:422-426` says diagrams render once the full code block is received; Epic 11 instead waits for full response completion via `chat:done` (`epic.md:99-100, 154-159, 205-208, 303-306`).
Impact: The renderer lifecycle is ambiguous. The Tech Lead cannot tell whether a completed Mermaid block should upgrade immediately on the next render cycle or only after the entire assistant response finishes.
Recommendation: Pick one behavior and align Flow 1, AC-1.3, AC-1.6, and AC-2.3 to that choice.

2. The PRD's debounce configurability/tuning requirement is not traceably covered by ACs, TCs, or stories.
Evidence: Feature 11 explicitly scopes configurable debounce tuning (`prd.md:581-583`) and requires balancing responsiveness vs rendering cost (`prd.md:611-613`). Epic 11 mentions `debounceMs` in an internal config (`epic.md:583-590`) and in NFR/tech questions (`epic.md:631-639, 659-660`), but there is no acceptance criterion or story coverage for configurability or tuning behavior (`epic.md:692-760`).
Impact: A key PRD requirement can be missed without failing epic acceptance.
Recommendation: Add ACs/TCs for configurable debounce, default tuning behavior, and the ability to adjust the interval without code edits if that is the intended product requirement.

3. Feature-flag isolation for the new Epic 11 client code is stated but not acceptance-tested.
Evidence: The PRD keeps Feature 11 behind the same flag as Epic 10 (`prd.md:561`). Architecture and Epic 10 make conditional initialization a first-class requirement (`technical-architecture.md:430-432`, `10--chat-plumbing/epic.md:81-92, 111-131`). Epic 11 adds rendering pipeline code, CSS, and keyboard handlers, and even states they must not initialize when disabled (`epic.md:14, 641-643`), but no AC/TC verifies that.
Impact: The most likely regression is "flag off but listeners/CSS/renderer still initialize." That is especially risky for global shortcuts.
Recommendation: Add explicit ACs/TCs covering zero Epic 11 rendering/shortcut initialization when `FEATURE_SPEC_STEWARD` is off.

4. Keyboard shortcut behavior remains unresolved, so several ACs are not fully testable.
Evidence: The PRD allows "Enter/Cmd+Enter" for send and requires toggle/cancel shortcuts (`prd.md:590-591`). Epic 11's shortcut ACs refer only to "the send shortcut" and "the panel toggle shortcut" (`epic.md:373-435`), while the data contract still labels both exact bindings as "Tech design decision" (`epic.md:600-611`) and keeps them open in tech questions (`epic.md:665-667`).
Impact: Tooltips, UX copy, and automated tests cannot assert the actual behavior from this epic alone.
Recommendation: Either lock the exact shortcuts in the epic or explicitly mark shortcut selection as a product decision that must be resolved before implementation starts.

5. Several "polish" ACs/TCs are too subjective to satisfy the epic's own testability bar.
Evidence: Examples include "appropriate sizing and visual hierarchy" (`epic.md:106-109`), "same CSS treatment" (`epic.md:171-174`), "without a visible jump" (`epic.md:331-334`), "comfortable reading" / "immediately clear" (`epic.md:445-458`), and "smooth" / "no lag or stuttering" (`epic.md:462-480`). The validation checklist claims every AC is testable (`epic.md:768-772`).
Impact: QA and Tech Design will have to invent their own pass/fail thresholds, which invites inconsistent implementation and review churn.
Recommendation: Replace subjective wording with observable assertions such as class usage, computed-style expectations, animation duration ranges, scroll delta tolerances, or frame-time thresholds.

6. The epic expands scope beyond PRD Feature 11 without tightening the boundaries.
Evidence: PRD Feature 11 scopes streaming markdown, partial handling, debounce, scroll refinement, UI polish, and shortcuts (`prd.md:571-591`). Epic 11 adds HTML sanitization, code-block copy, text selection/copy, panel visibility persistence, and external-link behavior as first-class in-scope items and ACs (`epic.md:49-52, 130-137, 184-197, 225-238, 497-543`).
Impact: These may be reasonable polish tasks, but they materially increase design and test surface beyond the upstream feature definition.
Recommendation: Either call these derived polish requirements out explicitly in the Feature Overview/Scope rationale, or move the nonessential items out to keep Epic 11 tightly aligned to the PRD.

7. The client-side `ChatMessage` contract is ambiguous about message identity and correlation.
Evidence: Epic 10 makes `messageId` the request/response correlation key over WebSocket (`10--chat-plumbing/epic.md:348-357`). Epic 11 introduces a client-side `ChatMessage` with `id` but does not say whether that `id` is the same as the transport `messageId`, whether user and agent messages share an exchange ID, or how the currently streaming message is located for re-render (`epic.md:556-575`).
Impact: This is a real design ambiguity for state management, render targeting, cancellation, and done/error reconciliation.
Recommendation: Clarify whether the state model is keyed by exchange ID, message ID, or separate local message IDs, and document the mapping.

## Minor

1. Partial inline construct coverage is narrower than the PRD language.
Evidence: The PRD calls out incomplete emphasis, links, and other inline constructs (`prd.md:577-580`). Epic 11 only gives explicit TCs for bold and partial links (`epic.md:282-295`).
Impact: The requirement is broadly stated, but the examples do not cover italic, strikethrough, inline code spans, or nested partial constructs.
Recommendation: Add a few representative TCs so the promise matches the test suite intent.

2. Link/sanitization behavior is still under-specified.
Evidence: TC-1.1g only defines `http/https` behavior (`epic.md:130-133`), while a later tech-design question leaves `mailto`, anchors, and relative paths unresolved (`epic.md:669-670`). AC-1.5 defines sanitization outcomes but not allowed URL protocols/attributes (`epic.md:184-197`).
Impact: Different implementers could make different choices for safe/unsafe links.
Recommendation: Add a small contract for allowed link protocols and required `rel`/target behavior.

## Coverage Summary

- Coherence: Mostly aligned with PRD/Epic 10, but Mermaid timing and added scope need correction.
- Completeness: Core markdown/scroll/shortcut flows are well covered, but debounce configurability and Epic-11-specific flag isolation are not traceably accepted.
- Testability: Structure is good and most TCs use Given/When/Then correctly, but several polish assertions are still subjective.
- Scope alignment: In/Out boundaries are mostly clean, though Epic 11 now contains several extra polish features not present in the PRD.
- Contract clarity: WebSocket reuse is clear; client-side state and shortcut contracts need tightening.
- Story breakdown: Story sequencing is logical and AC mapping is mostly complete, but the missing PRD traceability items above are also absent from story coverage.

Overall: strong draft, but not yet fully aligned enough to treat as the single source of truth for tech design without a revision pass.
