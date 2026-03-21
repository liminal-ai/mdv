# Epic 4: Export — Verification Report (Opus)

**Reviewer:** Claude 4.6 Opus  
**Date:** 2026-03-21  
**Scope:** End-to-end review of Epic 4 coherence, completeness, and accuracy  
**Method:** Sequential reading of all spec/design/story docs with reflection, followed by codebase implementation review against the documented contracts  

---

## Overall Assessment

**Epic 4 is coherent end-to-end as designed and implemented.** The epic spec, tech design, stories, test plan, implementation, and tests form a well-traced chain from requirements to working code. 496 tests pass (389 baseline + 107 Epic 4), matching the test plan exactly. All 28 ACs and 86 TCs from the epic are covered. The export pipeline produces PDF, DOCX, and HTML output from a server-side re-render of the source markdown file, consistent with the A5 architectural decision.

The implementation is production-quality with one genuine bug (CSS spinner animation), a handful of minor drifts between design docs and implementation, and a set of intentionally deferred optimizations that are well-documented. The security fix (exec to execFile) was caught during epic-level verification and is applied.

**Readiness judgment: Epic 4 is ready to close after fixing the spinner animation bug. The remaining items are safe to defer.**

---

## Where Implementation Matches Spec

### Schemas and API Contracts

| Contract Element | Epic Spec | Tech Design | Implementation | Match |
|---|---|---|---|---|
| `ExportRequest` fields | path, format, savePath | + theme | path, format, savePath, theme | Tech design |
| `ExportResponse.status` | `'success' \| 'error'` | `z.literal('success')` | `z.literal('success')` | Tech design (deviation documented) |
| `ExportWarning` types | 5 types incl. format-degradation | 5 types | 5 types | Yes |
| Error codes | 400, 403, 404, 500, 507 | + 409 EXPORT_IN_PROGRESS | + 409, 413, 415 | Tech design |
| `SessionState.lastExportDir` | `string \| null` | `AbsolutePathSchema.nullable()` | `AbsolutePathSchema.nullable().default(null)` | Yes |
| Save dialog request/response | defaultPath, defaultFilename | same | same | Yes |
| Reveal request | path | same | same | Yes |

### Server Pipeline

The export service orchestrates the pipeline exactly as designed:

1. Read source from disk (A5) via `fileService.readFile`
2. Determine export theme (HTML=active, PDF/DOCX=light-default)
3. Render markdown via `renderService.renderForExport` (single-theme Shiki + layout hints)
4. Mermaid SSR via `mermaidSsrService.renderAll` (Puppeteer + offline mermaid.min.js)
5. Asset resolution via `assetService.resolveImages` (/api/image URLs to base64)
6. Details expansion for PDF/DOCX (not HTML) with `format-degradation` warnings
7. HTML assembly via `htmlExportService.assemble` (CSS inlining, theme attribute)
8. Format-specific generation (PDF: page.pdf, DOCX: @turbodocx + resvg, HTML: pass-through)
9. Atomic write (temp file + rename) with cleanup in `finally` block

### Render Service Extensions

- Single-theme export mode: `createRenderer(slugger, { themeId })` uses Shiki `theme` (singular) for inline color styles
- Layout hints: `addLayoutHints()` adds `data-mdv-layout` attributes (not CSS classes) to headings, code blocks, images
- `setHtmlAttribute` helper avoids duplicate attribute injection (Shiki `class` conflict)

### PDF Service

- Puppeteer `page.pdf()` with format `'letter'`, 1in margins, `printBackground: true`, `waitForFonts: true`, `tagged: true`, 60s timeout
- Print media emulation via `page.emulateMediaType('print')`

### DOCX Service

- SVG to PNG via `@resvg/resvg-js` with `fitTo: { mode: 'width', value: 1400 }`
- DOCX-specific HTML wrapper (separate from export template) with Calibri font family, appropriate heading sizes
- @turbodocx/html-to-docx with 1440 TWIPS (1 inch) margins
- Handles Blob/Buffer/Uint8Array return types from @turbodocx

### HTML Export Service

- Self-contained: CSS from viewer stylesheets inlined via `<style>` tags
- `data-theme` attribute set to themeId
- Print CSS uses `[data-mdv-layout="..."]` attribute selectors (correct)
- Additional print rules: table header repeat, row integrity, image/mermaid/placeholder keep-together

### Asset Service

- Resolves `/api/image?path=...` URLs to base64 data URIs
- Parallel resolution via `Promise.all`
- Missing images produce placeholder HTML + `missing-image` warning
- Non-ENOENT errors re-thrown (not swallowed)
- Proper MIME type mapping for 8 image formats

### Route Error Handling

- Error classification chain: ExportInProgressError to 409, InvalidPathError to 400, NotMarkdownError to 415, FileTooLargeError to 413, PermissionError to 403, NotFoundError to 404, InsufficientStorageError to 507, default to 500
- Uses `execFile` (not `exec`) for save-dialog and reveal (security fix applied)
- 120s server timeout on export route
- Validation error classification (INVALID_PATH vs INVALID_FORMAT) via `classifyValidationError`

### Client Components

- `canExport` checks `activeTab?.status === 'ok' && !exportState.inProgress`
- Export dropdown with PDF/DOCX/HTML options, keyboard navigation (arrow keys, Enter, Escape)
- `TOGGLE_EXPORT_DROPDOWN_EVENT` for Cmd+Shift+E integration
- Export progress: format-specific labels ("Exporting PDF/DOCX/HTML...")
- Export result: success/degraded/error variants with correct CSS classes
- Reveal in Finder button with fire-and-forget `api.reveal()`
- Expandable warnings via `<details>/<summary>` pattern
- Auto-dismiss for clean success (10s), persist for degraded/error
- ExportState/ExportResult interfaces match tech design

### Test Coverage

| Test File | Planned | Actual | Match |
|---|---|---|---|
| export.test.ts | 18 | 18 | Yes |
| export-save-dialog.test.ts | 8 | 8 | Yes |
| export-pdf.test.ts | 16 | 16 | Yes |
| export-docx.test.ts | 14 | 14 | Yes |
| export-html.test.ts | 11 | 11 | Yes |
| export-fidelity.test.ts | 14 | 14 | Yes |
| export-session.test.ts | 3 | 3 | Yes |
| export-reveal.test.ts | 2 | 2 | Yes |
| export-dropdown.test.ts | 8 | 8 | Yes |
| export-progress.test.ts | 11 | 11 | Yes |
| keyboard-epic4.test.ts | 2 | 2 | Yes |
| **Total** | **107** | **107** | **Yes** |

All 496 tests pass. Test duration: ~24s total (72s of test time across parallel workers).

---

## Where Implementation Diverges

### Intentional, Documented Deviations

These were documented in the tech design's Spec Validation table or the implementation log and are correctly handled:

1. **`ExportResponse.status` tightened** — Epic defined `'success' | 'error'`; tech design tightened to `z.literal('success')`. Errors use HTTP status codes. Implementation matches tech design. Documented in tech-design.md Spec Validation.

2. **409 EXPORT_IN_PROGRESS added** — Not in epic's error table; added by tech design for TC-7.1c. Implementation includes it. Documented in tech-design.md Spec Validation.

3. **`theme` added to ExportRequest** — Epic's data contract didn't include theme; tech design added it for AC-6.2c (HTML preserves active theme). Implementation includes it. Documented in tech-design.md Spec Validation.

### Implementation Deviations (Accepted Risk)

These diverge from the tech design but were accepted during story review:

4. **Separate Puppeteer browsers instead of shared** — Tech design specified a shared browser instance passed to both MermaidSsr and PdfService. Implementation has each service launching its own browser. This costs ~2-3s extra per PDF export. Documented as "accepted-risk" in Story 2 review and "deferred" optimization in the impl log. **Impact: performance only, not correctness.**

5. **Warning source not truncated to 200 chars** — Epic and tech design both specify truncating `ExportWarning.source` to 200 characters. Implementation does not truncate. Documented as "minor" in epic verification. **Impact: slightly larger response payloads for documents with large Mermaid source blocks.**

6. **DOCX SVG to PNG failure warning source uses `'inline-svg'` instead of SVG snippet** — Tech design shows `source: svgContent.slice(0, 200)`. Implementation uses `source: 'inline-svg'`. Documented as "accepted-risk" in Story 4 review. **Impact: less diagnostic information in warnings, but the failure is rare.**

### Doc-Level Drift

These are inconsistencies between documents that don't affect implementation:

7. **Story 0 data contracts lag behind tech design** — Story 0's `ExportResponse` still shows the epic's original `status: 'success' | 'error'` contract, and `ExportRequest` doesn't include `theme`. The story defers to "See the tech design document," so implementers wouldn't be misled, but the in-story contract is stale.

8. **Story 2 error table missing 409** — Story 2's error table lists 400, 403, 404, 500, 507 but not 409 EXPORT_IN_PROGRESS, which is in the tech design and the implementation.

9. **Tech design API doc has print CSS inconsistency** — The `HtmlExportService.assemble()` section shows `.mdv-keep-with-next` class selectors, but the render service section correctly shows `[data-mdv-layout="keep-with-next"]` attribute selectors. The implementation uses the correct attribute selectors. Doc-level inconsistency only.

10. **Test plan references `export-progress.test.ts` for TC-2.2 tests** — The test plan maps TC-2.2a-c (success notification) to `export-progress.test.ts`, but these are really export *result* tests. The implementation file is correctly named `export-progress.test.ts` and tests both progress and result components. Naming is slightly misleading but not incorrect — the file tests the full export feedback lifecycle.

---

## Gaps

### Bug: CSS Spinner Animation

**Severity: Must fix before close**

`app/src/client/styles/export.css` line 16 references `animation: spin 0.6s linear infinite` but there is no `@keyframes spin` defined anywhere in the client styles. The existing spinner animations use `@keyframes tab-spin` and `@keyframes content-spin`. The export progress spinner will render as a static circle, not an animated spinner.

**Fix:** Either add `@keyframes spin` to `export.css`, or change the animation name to reference one of the existing keyframe definitions (e.g., `content-spin`).

### Missing: Client-Side Export Timeout

**Severity: Low (safe to defer)**

The tech design UI document specifies a 120s timeout on the client's export API call. The server route has a 120s timeout configured. However, the client `api.ts` does not set a timeout or `AbortController` on the export fetch request. If the server hangs beyond 120s, the client's fetch would hang indefinitely.

The server-side timeout provides protection, so this is defense-in-depth rather than a critical gap. The server will terminate the request at 120s and the client will receive an error.

### Missing: `<summary>` Bold Transformation for PDF/DOCX

**Severity: Cosmetic (accepted risk)**

TC-6.3a specifies that when `<details>/<summary>` is expanded for PDF/DOCX, "the summary text appears as bold or emphasized text." The implementation expands `<details>` by adding the `open` attribute but does not transform `<summary>` to bold/emphasized text. This was documented as "accepted-risk (cosmetic)" in Story 6 review. The content is visible (expanded), just not visually differentiated.

### Missing: `<kbd>` DOCX Styling

**Severity: Cosmetic (accepted risk)**

TC-6.3b specifies `<kbd>` renders "in a monospace font or with a visual border/background, similar to inline code" in DOCX. The @turbodocx library's handling of `<kbd>` elements is best-effort. Documented as "accepted-risk (best-effort per AC)" in Story 6 review.

---

## Export Fidelity Assessment

### PDF

PDF export is the highest-fidelity format. The pipeline feeds self-contained HTML (with inlined CSS, base64 images, rendered Mermaid SVGs, and layout hints) to Puppeteer's `page.pdf()`. Because Chrome renders the HTML identically to a browser, PDF output closely matches the viewer.

- **Typography and margins:** US Letter, 1-inch margins, print media CSS
- **Page breaks:** Layout hints (`data-mdv-layout`) control keep-with-next, keep-together, allow-split. Table row integrity enforced. These are CSS hints — Chrome's print engine makes final decisions.
- **Mermaid:** Server-side rendered via Puppeteer into inline SVGs in the HTML, then rendered in PDF
- **Syntax highlighting:** Single-theme Shiki with inline color styles
- **Images:** Base64 data URIs, max-width scaling
- **Degraded content:** Missing images show placeholders, failed Mermaid shows error fallback
- **Theme:** Always light-default regardless of viewer theme

**Assessment:** PDF is the strongest export format. The Puppeteer-based approach ensures high fidelity.

### DOCX

DOCX export is inherently lossier. The @turbodocx library converts HTML to Word's document model, which doesn't support full CSS layout. The DOCX-specific HTML wrapper provides clean styling optimized for @turbodocx conversion.

- **Headings:** HTML h1-h6 mapped to Word heading styles (as supported by @turbodocx)
- **Body text:** Bold, italic, inline code preserved
- **Tables:** Header rows with borders
- **Code blocks:** Monospace with background; syntax highlighting colors via inline Shiki styles (dependent on @turbodocx preserving inline color spans)
- **Images:** Base64 data URIs embedded; Mermaid SVGs converted to PNG via @resvg/resvg-js
- **Degraded content:** Placeholders and error fallbacks visible
- **Theme:** Always light (DOCX wrapper uses explicit light colors)

**Assessment:** DOCX meets the "would you send this to a stakeholder?" bar. The implementation correctly uses a separate HTML wrapper for DOCX (not the full export template), which is critical for @turbodocx compatibility. Structural DOCX quality (heading styles in Word's nav pane, exact table formatting, code block coloring fidelity) is a manual verification item that cannot be fully automated.

### HTML

HTML export is a pass-through — the self-contained HTML assembled by the export pipeline IS the output. All CSS from the viewer's stylesheets is inlined, images are base64, Mermaid diagrams are inline SVGs.

- **Self-contained:** No external dependencies, single file
- **Visual parity:** Uses viewer's CSS with `data-theme` attribute for theme selection
- **Theme:** Preserves the active viewer theme (dark or light)
- **Links:** External clickable, relative preserved, anchors functional
- **Degraded content:** Same placeholders and fallbacks as the viewer

**Assessment:** HTML is the simplest and most faithful export format. Opening the exported HTML in a browser produces output visually close to the in-app viewer.

### Warning and Error Behavior

- Warnings are collected from all pipeline stages (render, Mermaid SSR, asset resolution, details expansion) and aggregated in the response
- `format-degradation` warnings produced for `<details>` expansion in PDF/DOCX
- Export succeeds with warnings (degraded output) — never fails due to missing content
- Hard failures (permission denied, disk full, engine crash) produce HTTP error codes, not in-band errors
- Concurrent export prevention via `ExportInProgressError` to 409
- Atomic writes prevent partial files on failure
- Temp file cleanup in `finally` block

---

## Risks and Weak Spots

### Performance

- **Two Puppeteer browser launches per PDF export** — One for Mermaid SSR, one for PDF generation. The tech design specified a shared browser to save ~2-3s. For typical documents (under 30s budget), this is acceptable but wasteful. For large documents with many Mermaid diagrams, this could push against the 30s NFR. The deferred optimization (shared browser) should be prioritized if users report slow exports.

- **No Puppeteer browser pool** — Each export launches a fresh Chrome instance. The deferred item mentions a warm browser cache with 60s TTL. This only matters if users export frequently in quick succession.

- **Test suite duration** — Export tests with real Puppeteer take ~10s each. Total test duration grew from 5s to 24s. Not a problem now but worth monitoring.

### Robustness

- **Mermaid SSR error handling** — If Puppeteer fails to launch (e.g., Chrome not installed), the error propagates as a generic 500 EXPORT_ERROR. There's no specific error message distinguishing "Chrome not found" from other failures. Users who `npm install` correctly will have Chrome, but this could be confusing during initial setup.

- **@turbodocx output variation** — The DOCX library's output quality depends on how it interprets the HTML. Changes to @turbodocx versions could affect DOCX styling. The implementation pins `^1.20.1` (caret range), so minor/patch updates could change behavior. Consider pinning exact version if DOCX quality is critical.

- **Large document edge case** — TC-7.2a tests with `largeMarkdown` (500 sections, roughly 1000 lines, not the epic's 10,000+ lines). The test passes but doesn't truly exercise the 10,000+ line scenario. The real-world test is manual.

### Security

- **Shell injection fixed** — The `exec()` to `execFile()` fix prevents shell injection in save-dialog and reveal routes. This was the highest-value finding of the entire implementation run.

- **DOMPurify sanitization** — Export HTML goes through DOMPurify, matching the viewing pipeline. However, the self-contained HTML export includes all rendered content — if a malicious markdown file contains XSS payloads that survive DOMPurify, they would be present in the exported HTML. This is the same risk as the viewing pipeline.

---

## Completion Assessment

### Definitely Done

- All 7 stories accepted with gate verification
- All 28 ACs verified at epic level
- All 86 TCs mapped and tested
- 107 tests passing, matching test plan exactly
- All 4 API endpoints implemented (export, save-dialog, reveal, last-export-dir)
- All 7 server services implemented (export, render extension, mermaid-ssr, pdf, docx, html-export, asset)
- All 4 client components implemented (content-toolbar activation, export-progress, export-result, keyboard shortcut)
- Error handling chain complete (400, 403, 404, 409, 413, 415, 500, 507)
- Security fix applied (execFile)
- Export works end-to-end for PDF, DOCX, and HTML
- Theme handling: PDF/DOCX always light, HTML preserves active theme
- Degraded content handling: warnings collected, file still produced
- Atomic writes with cleanup on failure
- Concurrent export prevention
- Last-used export directory persistence

### Partially Done

- **Export progress spinner** — Component exists and renders, but animation doesn't work due to missing `@keyframes spin` (CSS bug)
- **Warning source truncation** — Epic specifies 200-char limit; not implemented
- **`<summary>` bold in PDF/DOCX** — `<details>` expanded but `<summary>` not styled as bold

### Missing

- Nothing is architecturally missing. All modules, routes, services, components, and tests exist and function.

---

## Disposition Categories

### Must Fix Before Epic 4 Close

1. **CSS spinner `@keyframes spin` missing** — The export progress spinner doesn't animate. Fix: add `@keyframes spin` to `export.css` or reference an existing keyframe name. This is a user-visible bug in a core export UX element (AC-2.1a).

### Should Fix Soon

2. **Warning source 200-char truncation** — The epic and tech design both specify truncating `ExportWarning.source` to 200 characters. The implementation doesn't truncate. Fix: add `.slice(0, 200)` in the export service's warning mapping. Low effort, prevents oversized response payloads for documents with large Mermaid source blocks.

3. **Story 0 and Story 2 doc contracts** — Update Story 0's `ExportResponse` and `ExportRequest` to match the tech design's final contracts, and add 409 to Story 2's error table. Keeps docs honest for future readers.

### Safe to Defer to Epic 5

4. **Shared Puppeteer browser** — One browser per export instead of shared across Mermaid SSR + PDF. Performance optimization, ~2-3s savings per PDF export. Well-documented deferred item.

5. **Client-side export timeout** — The server has a 120s timeout; the client does not. Add an `AbortController` with 120s timeout as defense-in-depth. Low priority since the server timeout provides protection.

6. **`<summary>` bold styling** — Transform `<summary>` text to `<strong>` in expanded `<details>` for PDF/DOCX. Cosmetic improvement to TC-6.3a.

7. **`<kbd>` DOCX styling** — Dependent on @turbodocx's handling. Would require DOCX XML post-processing to guarantee.

8. **DOCX SVG failure warning source** — Change `'inline-svg'` to the first 200 chars of the SVG content for better diagnostics.

9. **Large document test realism** — Consider adding a fixture that's genuinely 10,000+ lines for TC-7.2a. Current fixture is ~1000 lines.

10. **Pin @turbodocx exact version** — Change `^1.20.1` to `1.20.1` if DOCX output stability is critical.

---

## Readiness Judgment: Epic 4 to Epic 5

**Epic 4 is ready to close** after fixing the spinner animation bug (item 1). This is a one-line CSS fix.

All architectural decisions are sound. The export pipeline is well-structured with clear separation of concerns. The single-theme Shiki rendering decision cascades correctly through all formats. The test coverage is comprehensive and exactly matches the plan. The security fix is applied. The deferred items are genuine optimizations, not missing functionality.

Epic 5 can proceed without any dependency on the deferred items. The export infrastructure is stable, well-tested, and production-ready.

---

## Appendix: Verification Evidence

### Test Run

```
Test Files  44 passed (44)
     Tests  496 passed (496)
  Start at  07:20:17
  Duration  23.72s
```

### Epic 4 Test File Counts (verified against test plan)

| File | Count |
|---|---|
| export.test.ts | 18 |
| export-save-dialog.test.ts | 8 |
| export-pdf.test.ts | 16 |
| export-docx.test.ts | 14 |
| export-html.test.ts | 11 |
| export-fidelity.test.ts | 14 |
| export-session.test.ts | 3 |
| export-reveal.test.ts | 2 |
| export-dropdown.test.ts | 8 |
| export-progress.test.ts | 11 |
| keyboard-epic4.test.ts | 2 |
| **Total** | **107** |

### Implementation Commits (from impl log)

| Story | Commit | Tests Added |
|---|---|---|
| 0 Foundation | b40ef24 | 0 |
| 1 Export Trigger | 9a75262 | 21 |
| 2 Export Pipeline | c67a250 | 31 |
| 3 PDF Export | 84e4221 | 16 |
| 4 DOCX Export | 8fd72d0 | 14 |
| 5 HTML Export | 92752d9 | 11 |
| 6 Content Fidelity | 49861b3 | 14 |
| Security Fix | ffba5e0 | 0 |

### Key Files Reviewed

**Server:**
- `app/src/server/schemas/index.ts` — Export schemas and types
- `app/src/server/services/export.service.ts` — Pipeline orchestrator
- `app/src/server/services/render.service.ts` — renderForExport, addLayoutHints
- `app/src/server/services/mermaid-ssr.service.ts` — Puppeteer-based Mermaid SSR
- `app/src/server/services/pdf.service.ts` — Puppeteer page.pdf()
- `app/src/server/services/docx.service.ts` — @turbodocx + resvg
- `app/src/server/services/html-export.service.ts` — Self-contained HTML assembly
- `app/src/server/services/asset.service.ts` — Image resolution
- `app/src/server/routes/export.ts` — All 4 export endpoints

**Client:**
- `app/src/client/components/content-toolbar.ts` — Export dropdown activation
- `app/src/client/components/export-progress.ts` — Progress indicator
- `app/src/client/components/export-result.ts` — Result notification
- `app/src/client/state.ts` — ExportState, ExportResult
- `app/src/client/api.ts` — Export API methods
- `app/src/client/styles/export.css` — Export CSS (contains spinner bug)
- `app/src/client/app.ts` — Cmd+Shift+E registration
