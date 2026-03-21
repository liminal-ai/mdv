# Epic 4: Export — GPT-5.4 Epic Verification Review

**Model:** GPT-5.4  
**Date:** 2026-03-21  
**Workspace reviewed:** `/Users/leemoore/.cursor/worktrees/md-viewer/pnu/app`  
**Verification run:** attempted `npm run verify`, but this worktree could not run the suite because `prettier` was not installed (`sh: prettier: command not found`)

---

## Overall Assessment

Epic 4 is **substantially implemented** end-to-end. The repository contains a real export pipeline, activated UI, save dialog flow, persisted last-used export directory, Mermaid SSR, PDF/DOCX/HTML generators, atomic writes, warning propagation, and result UI. The implementation is coherent enough that a user can plausibly export documents in all three formats today.

However, Epic 4 is **not fully coherent as both designed and verified**, and I would **not close it as fully done without follow-up**. The largest issue is not that export is absent; it is that the project claims a stronger level of spec fidelity and verification than the implementation and tests actually demonstrate. Several explicit Epic 4 requirements are either softened in code, missing entirely, or only weakly tested.

My judgment:

- **Functionally:** close to done
- **Contractually/spec-wise:** partially done
- **Verification-wise:** not strong enough to support a clean close
- **Epic 5 readiness:** only after a short hardening pass, not as-is

---

## Critical

None found.

---

## Major

### M-1: Verification evidence is materially weaker than the Epic 4 test plan and implementation log claim

The codebase does not support the current “Epic 4 complete / 28 ACs verified / 107 tests exactly as planned” confidence level.

What is actually true:

- `app/tests/server/routes/export-pdf.test.ts` calls real export, but many “PDF” assertions inspect **HTML export output**, not PDF output.
- `app/tests/server/routes/export-docx.test.ts` mostly proves “a DOCX-like zip buffer was produced,” not that heading styles, navigation-pane structure, hyperlink semantics, table fidelity, or code formatting match the story/spec.
- `app/tests/server/routes/export-fidelity.test.ts` contains several tests that only assert `status === 'success'` for theme/fidelity cases rather than validating the required behavior.

Examples:

- `TC-3.2a`, `TC-3.2b`, `TC-3.2c`, `TC-3.2d`, `TC-3.3a`, `TC-3.3b`, `TC-3.4a`, `TC-3.6a`, `TC-3.6b`, `TC-3.6c`, and `TC-3.6d` in `export-pdf.test.ts` are mostly HTML-structure checks, not PDF-behavior checks.
- `TC-4.1a` through `TC-4.6a` in `export-docx.test.ts` generally stop at “valid DOCX buffer”.
- `TC-6.2a`, `TC-6.2b`, `TC-6.2d`, and `TC-7.2a` in `export-fidelity.test.ts` do not verify the actual behavior their names promise.

Impact:

- The implementation may be good enough in practice, but the repository **does not prove** that Epic 4 quality/fidelity requirements are met.
- The implementation log overstates closure confidence.

Disposition:

- This is the main blocker to a clean Epic 4 close.

### M-2: PDF and DOCX relative markdown link behavior does not match the epic/spec

The epic is explicit:

- PDF relative `.md` links should render as visible text, **not clickable**
- DOCX relative `.md` links should render as visible text, **not clickable**
- HTML should preserve them as-is

The implementation does not contain any PDF- or DOCX-specific relative-link rewrite or flattening logic.

Evidence:

- `app/src/server/services/export.service.ts` never rewrites links by format.
- `app/src/server/services/render.service.ts` preserves standard markdown anchors.
- `app/src/server/services/docx.service.ts` wraps content HTML but does not rewrite relative links.
- `app/tests/server/routes/export-pdf.test.ts` explicitly treats `href="./other.md"` as acceptable for the “PDF” case, which is the **HTML behavior**, not the PDF spec behavior.

Impact:

- This is direct behavioral drift from the epic, story 3, and story 4 requirements.
- PDF and DOCX outputs may preserve relative hyperlinks when the design says they should not.

Disposition:

- Must fix or explicitly amend the spec/design/docs to match shipped behavior.

### M-3: Export failure UX is softer and less informative than the epic/story contract

Epic 4 requires clear error messages, including meaningful detail like permission/path context and engine-failure description.

The shipped server route intentionally returns generic messages:

- permission denied: `"You do not have permission to export here."`
- file missing: `"The requested file no longer exists."`
- disk full: `"There is not enough free space to complete this export."`
- engine failure: `"The export could not be completed."`

Evidence:

- `app/src/server/routes/export.ts`
- client displays whatever message comes back in `app/src/client/app.ts`

What is missing versus spec/story:

- selected path is not surfaced on write failures
- engine failure descriptions are suppressed
- `Reveal in Finder` is fire-and-forget, so route-level `500` behavior is effectively absent

Impact:

- The UX is cleaner and safer, but it does **not** satisfy the story/epic’s more explicit diagnostic expectations.
- Failures are less actionable than designed.

Disposition:

- Must either restore richer messages or update the docs/tests to reflect the intentional softening.

### M-4: `<details>/<summary>` degradation handling is only partially implemented

Story 6 and the tech design require:

- PDF/DOCX: `<details>` expanded
- summary text visually emphasized
- `format-degradation` warning emitted

What the implementation does:

- only adds `open` to `<details>` for non-HTML export
- emits a `format-degradation` warning
- does **not** add any explicit summary emphasis styling or structure transformation

Evidence:

- `app/src/server/services/export.service.ts` `expandDetailsElements()`
- no matching PDF/DOCX summary styling exists in `app/src/client/styles/markdown-body.css` or `app/src/server/services/docx.service.ts`

Impact:

- The semantic downgrade exists, but the presentation contract is incomplete.
- This is especially weak for DOCX, where no dedicated `<summary>` styling is added.

Disposition:

- Must fix if Story 6 remains the source of truth.

### M-5: Warning-detail UX does not match the specified contract

Epic 4 expects the degraded export notification to show warning details with **type and description**.

The UI only renders `warning.message`.

Evidence:

- `app/src/client/components/export-result.ts`

Result:

- Warning count exists
- expand/collapse exists
- warning details do **not** surface the explicit type/source/line-oriented structure the epic describes

Impact:

- This is smaller than the core export pipeline gaps, but it is still contract drift.

Disposition:

- Should be fixed before close unless the story/docs are amended.

### M-6: Story/spec/doc drift is real and unresolved, especially around the API contract

The repository follows the tech design, not the original epic/story contract, in several places:

- `ExportRequest` requires `theme`
- `ExportResponse` is success-only
- failures use HTTP error responses instead of in-band `{ status: "error" }`
- `409 EXPORT_IN_PROGRESS` exists

Evidence:

- docs: `epic.md`, `story-0-foundation.md`, `story-2-export-progress-success-and-error-handling.md`
- implementation: `app/src/server/schemas/index.ts`, `app/src/server/routes/export.ts`

This drift is not inherently wrong; the design explicitly chose it. But the story set was not consistently updated afterward, so “Epic 4 matches epic/design/stories/tests” is false as written.

Impact:

- Review, handoff, and closeout are harder because there is no single stable contract.

Disposition:

- Must reconcile before a clean close.

---

## Minor

### m-1: PDF generation still launches a second Puppeteer browser instead of sharing the Mermaid SSR browser

The design chose a shared browser for Mermaid SSR and PDF generation, but the implementation launches once in `mermaid-ssr.service.ts` and again in `pdf.service.ts`.

Evidence:

- `app/src/server/services/mermaid-ssr.service.ts`
- `app/src/server/services/pdf.service.ts`

Impact:

- Performance/NFR risk, especially for large exports
- not a correctness bug by itself

### m-2: Client export requests do not implement the designed 120s timeout

The tech design explicitly calls for a longer export timeout on the client. The current `ApiClient` adds a timeout for file reads, but not export.

Evidence:

- `app/src/client/api.ts`

Impact:

- If the server stalls, the progress spinner can remain indefinitely
- drift from design, though arguably safer than aborting a long export too early

### m-3: Content toolbar hidden in empty state diverges from the epic’s literal disabled-control wording

The menu bar remains visible and disabled correctly, but the content toolbar is hidden when there are no tabs.

Evidence:

- `app/src/client/app.ts` sets `contentToolbarVisible: tabs.length > 0`

Impact:

- likely inherited product behavior, but still a literal AC/story drift

### m-4: Warning `source` values are not truncated to the documented 200-character limit

The design and epic discuss truncation, but the implementation returns warnings as-is.

Evidence:

- `app/src/server/services/export.service.ts`

Impact:

- mostly contract hygiene, not user-critical unless warnings get very large

### m-5: Keyboard-navigation tests only partially cover the dropdown behavior promised by the story

Arrow-key behavior is tested. Enter-to-select and Escape-to-close are not meaningfully covered in Story 1’s client tests.

Evidence:

- `app/tests/client/components/export-dropdown.test.ts`

Impact:

- small verification gap rather than obvious product bug

---

## What Is Definitely Done

These items are clearly implemented in code and are reasonably supported by tests or straightforward source inspection:

- Export routes exist: `/api/export`, `/api/export/save-dialog`, `/api/export/reveal`, `/api/session/last-export-dir`
- Export UI is activated in both toolbar and menu bar
- Keyboard shortcut `Cmd+Shift+E` is wired
- Save dialog default filename/dir flow is implemented
- Last-used export directory is persisted in session state
- Export state is tracked client-side with progress/result UI
- Concurrent export prevention exists in both UI and server service
- Atomic write pattern exists (`.tmp` then rename, unlink in `finally`)
- HTML export is self-contained: inline CSS plus base64-resolved local images
- Mermaid SSR exists server-side via Puppeteer
- PDF generation exists via Puppeteer
- DOCX generation exists via `@turbodocx/html-to-docx` and SVG→PNG conversion via `@resvg/resvg-js`
- Missing images, blocked remote images, and Mermaid failures produce warnings and degraded output instead of hard failure
- PDF/DOCX force light export theme at the service-contract level; HTML uses requested theme
- `exec()` shell injection risk was addressed by using `execFile()`

---

## What Is Partially Done

These areas exist, but either the behavior is softened versus spec or the verification is too weak to claim clean closure:

- PDF fidelity: implemented, but only partially proven
- DOCX fidelity: implemented, but weakly proven
- Story 6 cross-format fidelity: partially implemented, weakly proven
- Error UX: implemented, but less informative than specified
- Warning UX: implemented, but less structured than specified
- `<details>/<summary>` degradation: partially implemented
- `<kbd>` / inline HTML best-effort behavior: plausible in HTML/PDF, weak for DOCX, weakly verified overall
- Theme invariance across PDF/DOCX viewer themes: implemented by contract, lightly tested

---

## What Is Missing

- Explicit PDF/DOCX rewrite of relative markdown links into non-clickable visible text
- Full error-detail behavior described by the epic/story (path/detail-rich failure messages)
- Real reveal-route error handling consistent with the documented `500` possibility
- Explicit summary emphasis for `<details>/<summary>` in PDF/DOCX
- Warning-detail rendering that includes type plus description
- Strong verification of DOCX structural requirements (headings, nav pane, hyperlinks, lists, tables, code formatting)
- Strong verification of PDF behavior that is actually PDF-specific rather than HTML-prep-specific
- A reconciled single contract across epic, stories, design, implementation, and tests

---

## Match Against Epic, Design, Stories, and Test Plan

### Matches

- The implementation follows the **tech design architecture** well:
  - render from disk
  - single-theme export render path
  - Mermaid SSR on server
  - asset resolution to base64
  - per-format emitters
  - atomic writes
- Story 1 and Story 2 user flow is broadly present end-to-end.
- HTML export is the strongest/cleanest format implementation relative to the spec.
- The session extension with `lastExportDir` is coherent across schemas, server, client state, and tests.

### Divergences

- Epic/story docs still describe the older response contract, while code uses the tightened design contract.
- PDF/DOCX relative link behavior diverges from the epic/stories.
- Error messaging diverges from the epic/stories.
- Story 6’s `<details>/<summary>` presentation requirement is only partially implemented.
- The implementation log and test plan imply stronger validation than the tests actually provide.
- The design wanted a shared Puppeteer browser; implementation defers that optimization.
- The design called for a client export timeout; implementation omits it.

---

## Export Fidelity Assessment

### PDF

**Assessment:** implemented, but only partially verified

What looks good:

- real PDF generation path exists
- print CSS includes page-size/margin/layout-hint rules
- Mermaid SSR feeds PDF pipeline
- images are embedded via base64-resolved HTML
- light-theme export contract is enforced in code

Weak spots:

- most “PDF quality” tests inspect exported HTML, not PDF behavior
- relative markdown link downgrade is missing
- error/failure messaging is softer than spec
- shared-browser performance optimization is absent
- manual quality expectations from the plan are not backed by recorded verification evidence here

Conclusion:

- PDF is probably usable, but not verified strongly enough to declare story-level quality closure.

### DOCX

**Assessment:** implemented, but the weakest proven format

What looks good:

- real DOCX generation exists
- SVG→PNG conversion path exists
- missing-image and Mermaid degradation flows are wired
- light-theme contract is enforced

Weak spots:

- tests largely stop at “valid zip buffer”
- no strong evidence that heading styles map correctly into Word navigation
- no strong evidence that relative links are flattened as required
- no strong evidence for list/table/code fidelity beyond generation success
- `<summary>` emphasis and `<kbd>` handling are weak

Conclusion:

- DOCX is present and likely serviceable, but it is not sufficiently verified for a confident close.

### HTML

**Assessment:** strongest format, closest to spec/design

What matches well:

- self-contained single-file output
- CSS is embedded
- local images are converted to data URIs
- active theme is preserved
- Mermaid SVGs inline
- syntax highlighting present
- anchors and relative links preserved appropriately for HTML
- degraded content placeholders/fallbacks are present

Weak spots:

- some Story 6 raw-HTML fidelity cases rely on browser default behavior more than explicit contract handling
- “self-contained” is tested structurally, not in a real moved-file/browser scenario in this repository

Conclusion:

- HTML export is good enough and is the most closure-ready part of Epic 4.

### Warnings / Degradation / Error Handling

**Warnings and degraded success:** broadly implemented and coherent

- missing images
- blocked remote images
- Mermaid failures
- format-degradation for `<details>`

But:

- warning-detail UX is thinner than specified
- warning truncation contract is incomplete
- failure UX is less descriptive than specified
- reveal operation is best-effort, not full error-handled UX

---

## Test and Verification Assessment

### What the repository really proves

- export routes are wired
- save dialog and last-export-dir persistence exist
- client progress/result UI exists
- concurrent prevention exists
- exporters produce output buffers/strings
- degraded flows do not simply crash

### What it does not really prove

- PDF visual fidelity
- DOCX structural fidelity
- link behavior by format
- Story 6 parity expectations across all formats
- Word navigation-pane compatibility
- viewer-theme independence of PDF/DOCX beyond contract-level forcing
- manual-checklist items cited by the plan

### Verification discipline status

Not sufficient for a clean close.

The repo contains a respectable automated suite, but the suite’s **descriptions** are stronger than many of its **assertions**.

---

## Close Readiness

### Is Epic 4 complete enough to close?

**Not yet, if “close” means spec-complete, design-aligned, and honestly verified.**

If the standard were only “the feature exists and mostly works,” the answer would be much closer to yes. But the requested bar here is coherence, completeness, and accuracy against Epic 4’s own artifact set. On that bar, Epic 4 is still short.

### Is it ready to move to Epic 5?

**Not cleanly.**

I would do a short stabilization pass first so Epic 5 does not inherit unresolved export-contract drift and inflated verification confidence.

---

## Must Fix Before Epic 4 Close

- Reconcile the API contract across `epic.md`, stories, tech design, implementation, and tests. Decide whether the design contract is final, then update the stale story/spec language to match.
- Fix or intentionally amend the PDF/DOCX relative markdown link behavior.
- Strengthen verification for PDF/DOCX/Story 6 so the tests prove the claims being made, or reduce the claims in docs/logs.
- Improve export failure UX so it matches the intended contract, or update the docs to reflect the intentional generic-message policy.
- Complete or explicitly narrow the `<details>/<summary>` degradation behavior for PDF/DOCX.

## Should Fix Soon

- Render warning details with richer structure (`type`, maybe `source`, optionally `line`) instead of message-only.
- Add a real client-side export timeout or document that exports are intentionally unbounded client-side.
- Add stronger reveal-route error handling if the route is going to keep a documented error surface.
- Add explicit DOCX coverage for heading/link/table/code semantics if DOCX is considered production-ready.
- Add truncation of warning `source` fields if the contract is kept.

## Safe to Defer to Epic 5

- Shared Puppeteer browser optimization
- More sophisticated export configuration UI
- Better manual-verification harnesses or golden-output tooling
- Broader DOCX quality uplift beyond the current HTML-to-DOCX approach, if current output is manually acceptable

---

## Final Judgment

Epic 4 is **real**, **substantial**, and **close**, but it is **not yet closeable with high confidence**.

The strongest truthful summary is:

- **Definitely done:** the export feature exists end-to-end and works across PDF, DOCX, and HTML
- **Partially done:** fidelity, warning UX, error UX, and some Story 6 behaviors
- **Missing:** a few explicit spec behaviors plus the level of proof currently claimed

Recommendation:

- Do a targeted hardening/verification pass before closing Epic 4.
- Do **not** treat the current implementation log as sufficient evidence for closure.
- After that pass, Epic 5 handoff will be much cleaner and less risky.
