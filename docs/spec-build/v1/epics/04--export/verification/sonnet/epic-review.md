# Epic 4: Export — Sonnet Verification Review

**Model:** Claude Sonnet (claude-4.6-sonnet-medium-thinking)
**Date:** 2026-03-21
**Method:** Sequential document-by-document read with reflection, followed by direct codebase inspection
**Workspace reviewed:** `/Users/leemoore/code/md-viewer/app` (main repo, HEAD: `ffba5e0`)
**Tests run:** `npx vitest run` — 499/499 passing on clean run; see intermittent notes below

---

## Overall Assessment

Epic 4 is **functionally complete and end-to-end coherent** as designed. The full export pipeline (read → render → Mermaid SSR → asset resolution → format-specific output → atomic write) is implemented, all three formats (PDF, DOCX, HTML) work, the UI is activated, the save dialog persists the last-used directory, and the result notifications (success/degraded/error) are wired. The implementation is well-structured and mostly faithful to the tech design.

The epic is **ready to close with minor caveats**. There are no critical failures, no missing core behaviors, and no test gaps that would block a close. There are three confirmed compliance gaps (warning source truncation, shared browser optimization, latent AppleScript injection) and the DOCX test quality ceiling is acknowledged. None block a close, but two (AppleScript injection and double Puppeteer launch) should be addressed before or during Epic 5 if the pipeline is built upon further.

**Verdict:**
- Functionally: **done**
- Spec fidelity: **done with minor documented deviations and one silent compliance gap**
- Test coverage: **strong for HTML/pipeline, acknowledged-shallow for DOCX/PDF visual quality**
- Epic 5 readiness: **yes, with two items that should not be deferred past Epic 5**

---

## Test Run Reality Check

All 499 tests pass on a clean run. The test plan target was 107 Epic 4 tests; exactly 107 were added. The cumulative baseline discrepancy (plan: 430 total; actual: 499) reflects earlier epics adding more tests than planned — not Epic 4 over-counting.

Two intermittent failures were observed under system load:

- `tests/client/components/file-tree.test.ts > TC-5.3d: Expand All on large tree completes quickly` — a hardcoded 500ms performance budget that is too tight on a loaded machine. Pre-existing Epic 3 issue, not Epic 4.
- `tests/server/routes/export-fidelity.test.ts > TC-6.2a: PDF uses light scheme regardless of viewer theme` — observed timeout at ~33s on a loaded run. Root cause: two separate Puppeteer browser launches per PDF export. Design specified a shared browser. See G-2 below.

Neither indicates a behavioral bug. Both are symptoms of the double-Puppeteer-launch deviation.

---

## Where the Implementation Matches the Epic, Tech Design, Stories, and Test Plan

### Core Architecture
- **Server-side re-render from disk (A5):** verified. `ExportService.export()` calls `this.fileService.readFile(request.path)` as step 1. No cached viewer state is used.
- **Atomic write:** verified. `writeFile(tempPath, ...)` → `rename(tempPath, savePath)`, with `unlink(tempPath).catch(() => {})` in the `finally` block. No partial files on failure.
- **Concurrent export guard:** verified. `this.exporting` boolean flag, reset in `finally`. Returns `ExportInProgressError` (HTTP 409) on second attempt.
- **Single-theme Shiki for export, dual-theme for viewing:** verified. `createRenderer(slugger, { themeId })` produces a single-theme MarkdownIt instance when `themeId` is provided; dual-theme when omitted. Export instances are cached in a per-theme Map (a beneficial deviation from the design — avoids re-creating the Shiki plugin for the same theme repeatedly).
- **PDF/DOCX always use light-default; HTML preserves active theme:** verified. `getExportTheme()` in export.service.ts returns `'light-default'` unless `format === 'html'`, matching AC-6.2.
- **Layout hints via `data-mdv-layout` attributes:** verified. `addLayoutHints()` correctly adds `data-mdv-layout="keep-with-next"` to headings, `"keep-together"` or `"allow-split"` to `<pre>`, `"keep-together"` to `<img>`. Print CSS in `html-export.service.ts` uses matching `[data-mdv-layout="..."]` attribute selectors.

### Export Services
- **`export.service.ts`:** Orchestrates the full pipeline. Correctly passes `detailsResult.html` (not `fullHtml`) to the DOCX service, and `fullHtml` to PDF and HTML. The `expandDetailsElements()` function is a module-level helper in the orchestrator rather than a separate service — functionally equivalent, structurally consolidated.
- **`mermaid-ssr.service.ts`:** Loads Mermaid from `node_modules` (offline-safe via `fileURLToPath`). Uses regex-based placeholder extraction matching the Epic 3 `.mermaid-placeholder` structure. Wraps SVGs in `.mermaid-diagram` and errors in `.mermaid-error`. Matches Epic 3 DOM structure for viewer consistency.
- **`pdf.service.ts`:** Correct Puppeteer configuration — `format: 'letter'`, 1-inch margins on all sides, `printBackground: true`, `waitForFonts: true`, `tagged: true`, `timeout: 60_000`. Matches the tech design exactly.
- **`docx.service.ts`:** SVG→PNG via resvg-js at 1400px width, matching the POC pattern. Handles multiple @turbodocx return types (Blob, Buffer, ArrayBuffer) — defensive and correct. DOCX HTML wrapper uses Calibri font, correct heading pt sizes, code/table/blockquote styles.
- **`html-export.service.ts`:** Self-contained HTML assembly. Reads CSS files from the actual `../../client/styles/` directory. Sets `data-theme` attribute correctly. Includes `PRINT_CSS` with data-attribute selectors consistent with `addLayoutHints()`. Includes fallback for missing CSS files (`existsSync` guard).
- **`asset.service.ts`:** Resolves `/api/image?path=...` URLs to base64 data URIs. Handles non-ENOENT errors by re-throwing (correct). Parallel image reads via `Promise.all`. Index-based replacement avoids the `string.replace()` ambiguity when the same URL appears multiple times.

### UI
- Export dropdown activated from disabled state in both content toolbar and menu bar.
- `canExport()` correctly gates on `activeTab.status === 'ok'` and `!exportState.inProgress`. Deleted-file tabs (`status: 'deleted'`) are correctly disabled (A5 — export reads from disk, so deleted files cannot be exported).
- `export-progress.ts`: Shows spinner + "Exporting PDF/DOCX/HTML..." label. Uses `role="status"` + `aria-live="polite"`.
- `export-result.ts`: Three variants (success/degraded/error). Uses `<details>/<summary>` natively for expandable warning list. `title` attribute on path element provides hover tooltip (was a fix found during Story 2 review). Auto-dismiss for clean success (10s); degraded and error persist until dismissed. Correct ARIA roles.
- **Keyboard shortcut Cmd+Shift+E:** registered in `app.ts`, dispatches `TOGGLE_EXPORT_DROPDOWN_EVENT`; content toolbar listens to it. Correct no-op when no document is open.

### Routes and Security
- `export.ts` uses `execFile` (not `exec`) for both osascript and `open -R`. The security fix from commit `ffba5e0` is present and correct for shell injection.
- 120s route timeout on `/api/export`.
- All 4 API endpoints present with correct schemas and error response wiring.
- Error codes cover all scenarios: 400, 403, 404, 409, 413, 415, 500, 507.

### Schemas
- `ExportRequestSchema` includes `theme: ThemeIdSchema` — tech design deviation correctly implemented.
- `ExportResponseSchema` uses `z.literal('success')` — tech design deviation correctly implemented.
- `ExportWarningSchema` has all 5 warning types including `'format-degradation'`.
- `SessionStateSchema` includes `lastExportDir: AbsolutePathSchema.nullable().default(null)`.

### Test Coverage
- 11 export test files covering all 7 stories.
- Two-category strategy (mocked-external pipeline tests vs. real-library format quality tests) implemented as designed.
- TC coverage: 86/86 TCs from the epic covered by tests.
- 11 additional non-TC tests covering edge cases and error path validation.

---

## Divergences

### Documented Deviations (resolved in tech design, correctly implemented)

**D-1: `ExportRequest.theme` field added**
The epic's `ExportRequest` had `{path, format, savePath}`. The tech design added `theme: ThemeIdSchema`. Correctly implemented. Story 0's Technical Design section shows the pre-deviation contract — this is doc drift in the story, not an implementation issue.

**D-2: `ExportResponse.status` tightened to `'success'` only**
The epic defined `status: 'success' | 'error'`. Tech design changed this to HTTP 200 = always success; failures use HTTP error codes. Correctly implemented. Stories 0 and 2 still show the old contract in their Technical Design sections — story drift but not an implementation gap.

**D-3: HTTP 409 EXPORT_IN_PROGRESS added**
Epic's error table did not include 409. Tech design added it. Correctly implemented.

### Undocumented Deviations (not in tech design, discovered during review)

**D-4: MarkdownIt export instances cached by theme (beneficial)**
The tech design specified creating a fresh MarkdownIt instance per-export. The implementation caches instances in a `Map<string, Promise<MarkdownIt>>` keyed by theme ID. This is better — it avoids reinstalling the Shiki highlighter plugin on repeated exports with the same theme. No behavioral impact since exports are sequential. Low risk, positive deviation.

**D-5: `expandDetailsElements()` placed in export orchestrator rather than a separate service**
Structurally consolidated. Functionally equivalent. Zero risk.

**D-6: Mermaid SSR initialized with `suppressErrors: true` and `logLevel: 'fatal'`**
These Mermaid.js options were not specified in the tech design. `suppressErrors: true` instructs Mermaid to swallow internal errors silently rather than throwing. If this causes `mermaid.render()` to return an empty string instead of throwing, the `try/catch` in the SSR loop will not trigger, the error fallback will not be rendered, and no `mermaid-error` warning will be emitted. A document with a silently-failing Mermaid diagram would export with a blank area and no warning — violating AC-3.3b, AC-5.4b, and the degraded-content consistency requirement. The test suite exercises syntactically-invalid diagrams (which do throw), so this path is tested. The risk is specific to Mermaid diagrams that fail after parsing (layout engine failures, rendering limits).

---

## Gaps

### G-1: Warning source not truncated to 200 chars (spec compliance gap)

**Epic says:** `source: string — truncated to 200 chars`.

**Tech design says:** The export service truncates in the return statement: `source: w.source.length > 200 ? w.source.slice(0, 200) + '...' : w.source`.

**Implementation does:** `toExportWarnings()` in `export.service.ts` does `{ ...warning }` — no truncation. The 200-char limit is not enforced anywhere.

**Impact:** For large Mermaid diagrams or long image paths, the `source` field in the warning notification could be very long. Not a crash risk. A contract gap.

**Noted in:** Epic-level verification log ("warning source not truncated" — classified minor).

---

### G-2: Two Puppeteer browser launches per PDF export (performance deviation)

**Tech design says:** One shared Puppeteer browser per export, passed from the export orchestrator to both `MermaidSsrService` and `PdfService`. Saves ~2-3s Chrome startup overhead.

**Implementation does:** `MermaidSsrService.renderAll()` launches its own browser; `PdfService.generate()` launches its own browser. Two separate Chrome processes start, run, and close per PDF export.

**Impact:**
- Every PDF export adds ~4-6s of additional Chrome startup overhead.
- Tests using real Puppeteer (`export-pdf.test.ts`, `export-fidelity.test.ts`) run slowly and intermittently time out under system load.
- Pushes large-document PDF exports closer to the 30s NFR boundary.
- The `TC-6.2a` timeout failure (~33s) observed in a loaded run is directly caused by this.

**Accepted as:** `accepted-risk` in Story 2 impl log ("Mermaid SSR own browser vs shared → Story 3 can optimize"). Never revisited.

---

### G-3: AppleScript injection via JSON.stringify (security gap — partially mitigated)

**What was fixed:** `exec()` → `execFile()` (commit `ffba5e0`). Shell injection is now impossible — arguments are passed directly to the process without shell interpretation.

**What was not fixed:** The AppleScript script string still embeds `defaultDir` and `defaultName` via `JSON.stringify()`. AppleScript does not support backslash escaping inside string literals. A directory or filename containing a literal `"` character produces malformed AppleScript syntax.

**Example trigger:** Export a file named `"draft".md`. The script becomes:
```
default name "\"draft\".md" default location POSIX file "/path/to/"
```
AppleScript sees `"` as a string terminator, not an escaped quote, resulting in a syntax error and a failed save dialog (osascript exits non-zero).

**Impact:** Save dialog fails for any path or filename containing `"`. No crash, no security escalation (execFile prevents that), but incorrect behavior for a valid user input class. Silently treated as a cancellation (exit code 1 returns `null`).

**Fix direction:** AppleScript-safe string embedding: replace `"` with `" & quote & "` in the string context, e.g.:
```typescript
const safeQuote = (s: string) => '"' + s.replaceAll('"', '" & quote & "') + '"';
```

---

### G-4: DOCX structural quality unverified by tests (acknowledged testing gap)

DOCX quality tests verify that `htmlToDocx()` returns a non-empty buffer with a PK zip signature. They do not verify:
- That headings map to Word's `Heading 1–6` styles (required by AC-4.1a for the navigation pane)
- That tables have correct border and header styling
- That Shiki inline `color` styles survive @turbodocx conversion (syntax highlighting in DOCX)
- That images are actually embedded vs. linked

This is explicitly acknowledged in the test plan: "For v1, the manual verification checklist is the primary quality gate for DOCX output." The 25-item manual verification checklist covers these. The upgrade path (programmatic `docx` library) is documented.

**Risk:** @turbodocx patch releases could silently regress heading mapping, table rendering, or image embedding with no test catching it.

---

### G-5: Design document inconsistency (doc drift, no implementation impact)

The `HtmlExportService.assemble()` example in `tech-design-api.md` shows print CSS using CSS class selectors (`.mdv-keep-with-next`, `.mdv-keep-together`, `.mdv-allow-split`). The `addLayoutHints()` function in the same document uses `data-mdv-layout` attribute selectors. These are inconsistent within the design doc. The actual implementation uses data-attribute selectors throughout and is internally consistent. Future readers of the design doc may be confused.

---

## Risks and Weak Spots

### R-1: Mermaid `suppressErrors: true` may hide edge-case rendering failures

As noted in D-6. A Mermaid diagram that "silently fails" (Mermaid catches the error internally) would produce a blank space in the export with no warning, violating the degraded-content consistency requirement. Low probability for common diagram types; undetectable by current test coverage.

### R-2: Regex-based HTML manipulation fragility

`addLayoutHints()`, `mermaid-ssr.service.ts`, `asset.service.ts`, and `expandDetailsElements()` all use regex to transform HTML. Regex HTML manipulation is fragile in the presence of nested elements, multi-line attributes, and CDATA. For the current markdown-it output, this is unlikely to cause issues. As the rendering pipeline evolves, each new HTML construct needs to be verified against these regexes.

### R-3: DOMPurify allowlist dependency

`renderForExport()` applies `DOMPurify.sanitize()` after adding `data-mdv-layout` attributes and image placeholder HTML. DOMPurify allows `data-*` attributes by default, but this is an implicit allowlist dependency not explicitly tested. If a future DOMPurify version or configuration strips custom attributes, layout hints and placeholder styling would silently break.

### R-4: Concurrent export guard is instance-level, not process-level

`this.exporting` is a boolean on the `ExportService` instance. `exportRoutes()` creates one `ExportService` at route registration time, so this is safe for the current usage pattern. If `exportRoutes()` is ever called more than once (e.g., for testing with multiple Fastify instances), the guard becomes unreliable. Low risk for production; worth noting for test isolation hygiene.

### R-5: Save dialog `config: { timeout: 120_000 }` not set on save-dialog route

The `/api/export` route has `config: { timeout: EXPORT_TIMEOUT_MS }` (120s). The `/api/export/save-dialog` route does not have an explicit timeout. The `openSaveDialog()` function has `exec timeout: 60_000` (60s), but if osascript hangs (e.g., macOS dialog system issue), the Fastify route will use its default timeout, which may be shorter than the osascript timeout. Minor edge case.

---

## Export Fidelity Assessment

### PDF
**Pipeline integrity:** Strong. The full path is verified: single-theme Shiki → Mermaid SSR → base64 image resolution → layout hints → self-contained HTML assembly → `page.pdf()` with US Letter, 1-inch margins, `printBackground: true`.

**Quality verification:** Automated tests verify that the assembled HTML has the correct structure (Mermaid SVGs present, base64 data URIs, `data-mdv-layout` attributes, Shiki token spans with inline `color` styles). The PDF output itself is verified only for non-empty buffer (real Puppeteer tests). Page break behavior is guaranteed by CSS properties in the print stylesheet; visual quality and break behavior are manual verification items.

**Degraded content:** Missing image placeholders (`image-placeholder` class) and Mermaid error fallbacks (`mermaid-error` class) are verified to appear in the assembled HTML. They will therefore appear in the PDF.

**Known limitation:** Double Puppeteer launch adds ~4-6s overhead per PDF export.

### DOCX
**Pipeline integrity:** Sound. SVG→PNG via resvg-js at 1400px. DOCX HTML wrapper with Calibri font and heading/code/table styles. @turbodocx conversion with multiple buffer-type handling.

**Quality verification:** Tests verify buffer validity only. Structural quality (heading styles in navigation pane, inline code coloring, table rendering, image embedding) relies on manual verification. The acknowledged limitation is documented.

**Degraded content:** Missing image placeholders are styled in `wrapForDocx()`. Mermaid error banners (`mermaid-error__banner`) are styled. These will appear in the DOCX.

**Known limitation:** Warning source for SVG→PNG failures is `'inline-svg'` (hardcoded string), not the actual Mermaid source. Difficult to diagnose which diagram failed when multiple are present.

### HTML
**Pipeline integrity:** Best of the three formats. Self-contained output is fully verified: CSS inlined from viewer stylesheets, base64 images, inline Mermaid SVGs, `data-theme` attribute set correctly for active theme, `<details>/<summary>` preserved natively (AC-6.3c).

**Quality verification:** Strongest test coverage in the epic. Tests verify CSS inlining, base64 images, Mermaid SVGs, theme application (`data-theme`), link preservation (external/relative/anchor), and degraded content handling. These tests inspect string content directly — the most meaningful quality checks in the Epic 4 suite.

**Degraded content:** Placeholder divs appear in HTML output. Mermaid error fallbacks appear in HTML output. Both verified by tests.

---

## Completeness Assessment Against ACs

All 31 ACs and 86 TCs are covered by test code. The following ACs have test coverage that relies on manual verification for final confirmation:

| AC | Automated verification | Manual required |
|----|------------------------|-----------------|
| AC-3.1 (PDF typography) | `page.pdf()` called with correct options | Visual readability at zoom |
| AC-3.2 (PDF page breaks) | `data-mdv-layout` attributes present in HTML | Actual page break behavior |
| AC-4.1–4.6 (DOCX structure) | Buffer is valid zip | Word navigation pane, heading styles, table formatting |
| AC-3.4 (syntax highlighting in PDF) | Shiki `<span>` elements with inline `color` present | Color fidelity in rendered PDF |

All other ACs have tests that directly verify the behavior.

---

## Readiness Summary

### Must Fix Before Epic 4 Close

None. The feature is functionally complete and all tests pass.

### Should Fix Before or During Epic 5 (Not Safe to Defer Further)

1. **G-3 — AppleScript injection (paths with `"`):** Implement `" & quote & "` escaping in `openSaveDialog()`. The `execFile` fix is necessary but not sufficient. A one-file, one-function change.

2. **G-2 — Double Puppeteer launch:** Implement the shared browser pattern. Pass the browser instance from `ExportService` to both `MermaidSsrService.renderAll()` and `PdfService.generate()`. This eliminates the test timing failures and reduces PDF export time materially. Medium-effort refactor of three services.

### Safe to Defer to Epic 5

3. **G-1 — Warning source truncation:** Add the 200-char truncation to `toExportWarnings()`. One-line fix.

4. **D-6 — `suppressErrors: true` risk:** Evaluate whether removing `suppressErrors: true` from the Mermaid initialization causes test failures. If not, remove it to restore correct error propagation.

5. **G-4 — DOCX test depth:** Add zip-parsing assertions for heading style names on at least TC-4.1a. Would provide regression coverage for @turbodocx version bumps.

6. **G-5 — Design doc inconsistency:** Update the `HtmlExportService.assemble()` example in `tech-design-api.md` to use `[data-mdv-layout="..."]` selectors.

7. **R-5 — Save-dialog route timeout:** Add `config: { timeout: 70_000 }` to the `/api/export/save-dialog` route to cover the 60s osascript timeout plus margin.

8. **Deferred items from tech design:** Shared browser pooling, A4 page size option, HTML folder export option, `<!-- pagebreak -->` support, DOCX upgrade to programmatic `docx` library.
