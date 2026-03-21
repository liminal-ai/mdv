# Test Plan: Epic 4 — Export

**Parent:** [tech-design.md](tech-design.md)
**Companion:** [tech-design-api.md](tech-design-api.md) · [tech-design-ui.md](tech-design-ui.md)

This document maps every TC from the epic to a test, defines the mock strategy, lists test fixtures, specifies verification scripts, and breaks work into chunks with test counts.

---

## Mock Strategy

### Server Tests

Test at the route handler level using Fastify's `inject()`. The export pipeline exercises multiple services — mock at external boundaries, let internal services run for real where practical.

**Two test categories with different mock strategies:**

**Category 1: Pipeline orchestration tests** (`export.test.ts`, `export-save-dialog.test.ts`, `export-session.test.ts`, `export-reveal.test.ts`) — test the pipeline flow, error handling, and concurrent prevention. External libraries are mocked.

| Layer | Mock? | Why |
|-------|-------|-----|
| Route handlers (`server/routes/export.ts`) | **Test here** | Entry point |
| Export service (`export.service.ts`) | Don't mock | Orchestrator — exercised through routes |
| Render service (markdown-it + Shiki) | **Don't mock** | In-process pipeline |
| Puppeteer | **Mock** | External boundary — control browser behavior |
| `@turbodocx/html-to-docx` | **Mock** | External boundary — control DOCX output |
| `@resvg/resvg-js` | **Mock** | External boundary — control PNG output |
| `node:fs/promises` | **Mock** | External boundary — filesystem |
| `node:child_process` | **Mock** | External boundary — osascript, open |

**Category 2: Format quality tests** (`export-pdf.test.ts`, `export-docx.test.ts`, `export-html.test.ts`, `export-fidelity.test.ts`) — test actual output from the real libraries. These are quasi-integration tests. Only the filesystem is mocked (to control input .md content). Puppeteer, @turbodocx, and resvg run for real.

| Layer | Mock? | Why |
|-------|-------|-----|
| Puppeteer | **Don't mock** | Testing real PDF output |
| `@turbodocx/html-to-docx` | **Don't mock** | Testing real DOCX output |
| `@resvg/resvg-js` | **Don't mock** | Testing real SVG→PNG conversion |
| `node:fs/promises` | **Mock** | Control input .md content |

The trade-off: format quality tests are slower (~5-10s each) but verify real output. Pipeline tests are fast and cover the orchestration logic.

### Client Tests

Same pattern as Epics 1–3: JSDOM + mocked API client.

| Layer | Mock? | Why |
|-------|-------|-----|
| Components (`client/components/*`) | **Test here** | Entry point |
| State store (`client/state.ts`) | Don't mock | Exercised through components |
| API client (`client/api.ts`) | **Mock** | External boundary — server |
| DOM / JSDOM | Don't mock | That's what we're testing |

---

## Test Fixtures

### `tests/fixtures/export-samples.ts`

Markdown content covering export-relevant scenarios:

```typescript
// Simple document for basic export testing
export const simpleMarkdown = `# Architecture

This is a simple document with a heading, paragraph, and list.

- Item one
- Item two
- Item three

## Code Example

\`\`\`typescript
const x: number = 42;
console.log(x);
\`\`\`

## Table

| Name | Status |
|------|--------|
| Alpha | Active |
| Beta | Pending |
`;

// Document with images (for asset resolution testing)
export const imageMarkdown = `# With Images

![Local](./images/diagram.png)
![Missing](./missing.png)
![Remote](https://example.com/image.png)
`;

// Document with Mermaid diagrams
export const mermaidMarkdown = `# Architecture

\`\`\`mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Done]
  B -->|No| D[Retry]
\`\`\`

## Invalid Diagram

\`\`\`mermaid
graph TD
  A --> B -->
\`\`\`
`;

// Document with all content types (comprehensive)
export const comprehensiveMarkdown = `# Full Document

## Rich Content

**Bold**, *italic*, ~~strikethrough~~, \`inline code\`.

> Blockquote with emphasis.

---

### Code

\`\`\`javascript
function hello() { return "world"; }
\`\`\`

### Table

| Left | Center | Right |
|:-----|:------:|------:|
| a    |   b    |     c |

### Image

![Diagram](./images/arch.png)

### Mermaid

\`\`\`mermaid
sequenceDiagram
  Alice->>Bob: Hello
  Bob-->>Alice: Hi
\`\`\`

### Task List

- [x] Done
- [ ] Not done

### HTML Elements

<details>
<summary>Click to expand</summary>
Hidden content here.
</details>

<kbd>Ctrl+C</kbd> and <sup>superscript</sup>

### Links

[External](https://example.com)
[Relative](./other.md)
[Anchor](#rich-content)
`;

// Empty document
export const emptyMarkdown = '';

// Large document (for performance testing)
export const largeMarkdown = Array.from({ length: 500 }, (_, i) =>
  `## Section ${i}\n\nParagraph ${i} with some content.\n\n`
).join('');
```

### `tests/fixtures/export-responses.ts`

```typescript
import type { ExportResponse } from '../../src/shared/types.js';

// Server returns ExportResponse on HTTP 200 only (status is always 'success').
// Failures are HTTP error responses — see ErrorResponse type.
export const successResponse: ExportResponse = {
  status: 'success',
  outputPath: '/Users/leemoore/Desktop/architecture.pdf',
  warnings: [],
};

export const degradedResponse: ExportResponse = {
  status: 'success',
  outputPath: '/Users/leemoore/Desktop/architecture.pdf',
  warnings: [
    { type: 'missing-image', source: './missing.png', message: 'Image not found' },
    { type: 'mermaid-error', source: 'graph TD\n  A --> B -->', message: 'Parse error' },
  ],
};

// Error responses use HTTP status codes + ErrorResponse shape, not ExportResponse.
// Client catches ApiError from the fetch wrapper.
```

---

## TC → Test Mapping

### Server Tests

#### `tests/server/routes/export.test.ts`

Export pipeline orchestration tests. Puppeteer, @turbodocx, and resvg are mocked. Tests verify the pipeline flow, error handling, and concurrent export prevention.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.1a | Export dropdown formats available | — | POST /api/export accepts 'pdf', 'docx', 'html' |
| TC-1.1d | Deleted file cannot be exported | Mock fs.stat → ENOENT for source file | Returns 404 FILE_NOT_FOUND |
| TC-1.1f | File outside root exports normally | Mock fs → file at any absolute path | Returns 200 with ExportResponse |
| TC-1.2a | Default filename has correct extension | — | Verified in save-dialog test (client) |
| TC-1.4a | Last export dir persisted | Set lastExportDir, reload session | GET /api/session includes lastExportDir |
| TC-2.1a | Export blocks until complete | Mock slow export | Response arrives after mock delay |
| TC-2.3c | Degraded export still produces file | Mock render with warnings | status: 'success' with warnings array |
| TC-2.4a | Write permission denied | Mock fs.writeFile → EACCES | Returns 403 PERMISSION_DENIED |
| TC-2.4b | Export engine failure | Mock Puppeteer → throw | Returns 500 EXPORT_ERROR |
| TC-2.4c | Disk full | Mock fs.writeFile → ENOSPC | Returns 507 INSUFFICIENT_STORAGE |
| TC-7.1a | App recovers from export failure | Trigger failure, then retry | Second export succeeds |
| TC-7.1b | No partial files on failure | Mock failure mid-export | Temp file cleaned up |
| TC-7.1c | Concurrent export blocked | Start export, start second | Second returns 409 EXPORT_IN_PROGRESS |
| TC-7.2c | Empty document exports | Mock fs → empty .md | Returns 200, status: 'success' |
| TC-7.2d | File changed during export | Mock fs.readFile returns content at export start | Export uses initial read, not changed version |
| — | **Non-TC: Invalid format rejected** | POST with format: 'rtf' | Returns 400 INVALID_FORMAT |
| — | **Non-TC: Non-absolute source path rejected** | POST with relative path | Returns 400 INVALID_PATH |
| — | **Non-TC: Non-absolute save path rejected** | POST with relative savePath | Returns 400 INVALID_PATH |

**Test count: 18** (15 TC-mapped + 3 non-TC)

#### `tests/server/routes/export-save-dialog.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.2a | Save dialog default filename | — | osascript called with correct default name |
| TC-1.2b | Default directory is source file dir | No lastExportDir set | osascript called with source file's directory |
| TC-1.2c | Default directory is last-used dir | lastExportDir set | osascript called with lastExportDir |
| TC-1.2d | DOCX filename extension | Format: docx, source: readme.md | default name: readme.docx |
| TC-1.2e | HTML filename extension | Format: html, source: notes.md | default name: notes.html |
| TC-1.2f | Overwrite handled by OS dialog | — | osascript handles natively (not testable in mock) |
| TC-1.3a | Cancel returns null | Mock exec → exit code 1 | POST returns null |
| — | **Non-TC: osascript error handled** | Mock exec → error | Returns 500 |

**Test count: 8** (7 TC-mapped + 1 non-TC)

#### `tests/server/routes/export-pdf.test.ts`

PDF output quality tests. **These use real Puppeteer** (not mocked) against controlled HTML input. Slower (~5-10s) but verify actual PDF output.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-3.1a | PDF has margins | Render simple doc → PDF | PDF page dimensions indicate margins present |
| TC-3.1b | Body text is legible | Render doc with headings + paragraphs → PDF | PDF is non-empty, reasonable page count |
| TC-3.1c | Default page size is Letter | No config | page.pdf called with format: 'letter' |
| TC-3.2a | Heading stays with paragraph | Render doc with heading near page bottom | Layout hint CSS classes present in HTML |
| TC-3.2b | Table rows not split | Render doc with table | CSS includes break-inside: avoid on tr |
| TC-3.2c | Short code blocks kept together | Render doc with short code block | CSS class mdv-keep-together on pre |
| TC-3.2d | Images not split | Render doc with image | CSS class mdv-keep-together on img |
| TC-3.3a | Mermaid diagram in PDF | Render doc with valid mermaid → mock SSR → SVG | HTML contains inline SVG (not placeholder) |
| TC-3.3b | Failed Mermaid in PDF | Render doc with invalid mermaid → mock SSR error | HTML contains mermaid-error class + warning |
| TC-3.4a | Highlighted code in PDF | Render doc with JS code block | HTML contains Shiki token spans with inline colors |
| TC-3.5a | Local image embedded | Mock image file exists | HTML contains base64 data URI for image |
| TC-3.5b | Missing image placeholder | Mock image doesn't exist | HTML contains image-placeholder + warning |
| TC-3.6a | External links preserved | Render doc with http link | HTML contains anchor with href |
| TC-3.6b | Blockquotes styled | Render doc with blockquote | HTML contains blockquote element |
| TC-3.6c | Horizontal rules present | Render doc with hr | HTML contains hr element |
| TC-3.6d | Relative md links as text | Render doc with relative .md link | Link present but non-functional in PDF context |

**Test count: 16** (16 TC-mapped)

**What these tests actually verify vs. what they don't:**
- **Verified automatically:** That the pipeline produces a non-empty PDF buffer, that `page.pdf()` is called with correct options (margins, format, printBackground), that layout hint data attributes are present in the HTML, that Mermaid SVGs are inlined (not placeholders), that images are base64 data URIs.
- **NOT verified automatically:** Visual typography quality, actual page break behavior (whether headings truly stay with following paragraphs depends on Chrome's print rendering), color fidelity, link clickability in the PDF file. **These are manual verification items** (checklist items 3-9).

The automated tests provide confidence that the pipeline produces valid output with correct inputs. Visual quality and PDF-specific behavior are inherently manual verification concerns — the same limitation exists in the POC, which uses manual testing for export quality.

#### `tests/server/routes/export-docx.test.ts`

DOCX output quality tests. Use real @turbodocx and resvg against controlled input.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-4.1a | DOCX has heading levels | Render doc with h1-h4 | DOCX buffer is valid (non-empty, starts with PK zip signature) |
| TC-4.1b | Body text formatting preserved | Render doc with bold/italic | DOCX buffer is valid |
| TC-4.1c | Lists with nesting | Render doc with nested lists | DOCX buffer is valid |
| TC-4.2a | Table in DOCX | Render doc with table | DOCX buffer is valid |
| TC-4.2b | Table with inline content | Render table with bold/code cells | DOCX buffer is valid |
| TC-4.3a | Code block in DOCX | Render doc with code block | DOCX buffer is valid |
| TC-4.4a | Local image embedded | Mock image exists | DOCX buffer is valid, warning-free |
| TC-4.4b | Mermaid as PNG in DOCX | Render doc with mermaid → mock SSR → SVG | SVG converted to PNG via resvg, DOCX buffer valid |
| TC-4.4c | Missing image placeholder | Mock image missing | Warning in response |
| TC-4.5a | External links in DOCX | Render doc with http link | DOCX buffer is valid |
| TC-4.5b | Relative md links as text | Render doc with relative .md link | DOCX buffer is valid |
| TC-4.5c | Blockquotes in DOCX | Render doc with blockquote | DOCX buffer is valid |
| TC-4.5d | Horizontal rules in DOCX | Render doc with hr | DOCX buffer is valid |
| TC-4.6a | Deep heading levels h5-h6 | Render doc with h1-h6 | DOCX buffer is valid |

**Test count: 14** (14 TC-mapped)

**What these tests actually verify vs. what they don't:**
- **Verified automatically:** That the pipeline produces a valid DOCX buffer (non-empty, PK zip signature), that SVGs are converted to PNG via resvg-js, that format-degradation warnings are produced when SVG→PNG fails, that the correct content HTML is passed to @turbodocx.
- **NOT verified automatically:** Heading styles mapped to Word's navigation pane, table formatting fidelity, inline code coloring survival through @turbodocx, image embedding quality, link clickability in Word. **These are manual verification items** (checklist items 11-13).

Deep structural assertions (verifying heading styles, table cells, run formatting in the DOCX XML) would require parsing the Office Open XML inside the zip — possible but fragile and high-maintenance. For v1, the manual verification checklist is the primary quality gate for DOCX output. If DOCX quality issues arise, the upgrade path is the programmatic `docx` library (see Deferred Items).

#### `tests/server/routes/export-html.test.ts`

HTML export quality tests. No Puppeteer needed — HTML is string output.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-5.1a | Self-contained HTML renders | Render doc → HTML export | HTML string contains DOCTYPE, style tags, content |
| TC-5.1b | CSS inlined | — | HTML contains `<style>` tags, no external `<link>` stylesheet refs |
| TC-5.1c | Images as base64 | Mock local images | HTML contains `data:image/` URIs, no `/api/image` refs |
| TC-5.2a | Visual parity theme applied | Export with dark theme | HTML has `data-theme="dark-default"` |
| TC-5.2b | Mermaid SVGs inline | Render doc with mermaid → mock SSR | HTML contains `<svg>` elements (not placeholders) |
| TC-5.2c | Syntax highlighting present | Render doc with code block | HTML contains Shiki token spans with inline color styles |
| TC-5.3a | External links preserved | Render doc with http link | HTML contains `<a href="https://...">` |
| TC-5.3b | Relative md links preserved | Render doc with `./other.md` link | HTML contains `<a href="./other.md">` |
| TC-5.3c | Anchor links work | Render doc with `#heading` link | HTML contains `<a href="#heading">` and target has matching id |
| TC-5.4a | Missing images as placeholders | Mock image missing | HTML contains image-placeholder div |
| TC-5.4b | Failed Mermaid fallback | Mock Mermaid SSR error | HTML contains mermaid-error div |

**Test count: 11** (11 TC-mapped)

#### `tests/server/routes/export-fidelity.test.ts`

Content fidelity and cross-format consistency tests.

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-6.1a | Degraded content in export matches viewer | Render doc with 2 missing images + 1 failed mermaid | Export warnings match render warnings |
| TC-6.1b | Blocked remote images in export | Render doc with http image | Warning type 'remote-image-blocked' in export |
| TC-6.1c | Task list checkboxes exported | Render doc with task list | HTML contains input[type=checkbox] |
| TC-6.2a | PDF uses light scheme regardless of viewer theme | Export PDF with dark theme active | Render called with 'light-default' theme |
| TC-6.2b | DOCX uses light scheme | Export DOCX with dark theme active | Render called with 'light-default' theme |
| TC-6.2c | HTML preserves active theme | Export HTML with 'dark-cool' active | HTML has data-theme="dark-cool" |
| TC-6.2d | PDF consistent across viewer themes | Export PDF with light, then dark | Both call render with 'light-default' |
| TC-6.3a | details/summary expanded in PDF | Render doc with `<details>` | HTML contains expanded content + format-degradation warning |
| TC-6.3b | kbd rendered as code-like | Render doc with `<kbd>` | HTML contains kbd element |
| TC-6.3c | details preserved in HTML | Export HTML with `<details>` | HTML contains `<details>` element as-is |
| TC-6.3d | Inline HTML elements exported | Render doc with sup/sub/br | HTML contains corresponding elements |
| TC-6.4a | No hidden content in export | Render doc → export | No raw markdown or internal state in output |
| TC-7.2a | Large document exports | Render largeMarkdown (10000+ lines) | Export completes within timeout |
| TC-7.2b | Fully degraded document exports | All images missing, all mermaid failed | status: 'success' with many warnings |

**Test count: 14** (14 TC-mapped)

### Client Tests

#### `tests/client/components/export-dropdown.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.1a | Content toolbar Export shows PDF/DOCX/HTML | Render with tab open | 3 enabled dropdown items |
| TC-1.1b | Menu bar Export shows PDF/DOCX/HTML | Render with tab open | 3 enabled menu items |
| TC-1.1c | Export disabled with no document | Render with no tabs | Items have aria-disabled |
| TC-1.1d | Export disabled for deleted file | Tab with status: 'deleted' | Items have aria-disabled |
| TC-1.1e | Export dropdown keyboard navigation | Open dropdown, press arrow keys | Focus moves between items |
| TC-1.1f | File outside root can export | Tab with path outside root | Items are enabled |
| TC-1.5a | Cmd+Shift+E opens Export dropdown | Simulate keydown | Dropdown visible |
| — | **Non-TC: Export disabled during export in progress** | exportState.inProgress: true | Items have aria-disabled |

**Test count: 8** (7 TC-mapped + 1 non-TC)

#### `tests/client/components/export-progress.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-2.1a | Progress indicator visible during export | Set exportState.inProgress: true | Spinner and label visible |
| TC-2.1b | UI responsive during export | exportState.inProgress: true, simulate interaction | DOM responds to events |
| TC-2.2a | Success notification shows path | Set exportState.result: success | Path text and Reveal button visible |
| TC-2.2b | Reveal in Finder triggers API call | Click Reveal button | api.reveal called with outputPath |
| TC-2.2c | Success notification dismissable | Click dismiss button | exportState.result reset to null |
| TC-2.3a | Degraded notification shows warning count | Set result with 2 warnings | "Exported with 2 warnings" text visible |
| TC-2.3b | Warning detail expandable | Click warning count | Warning list visible with details |
| TC-2.4a | Error notification shows message | Set exportState.result: error | Error message visible |
| TC-2.4b | Error notification shows error detail | Set result with error message | Message text matches |
| — | **Non-TC: Success auto-dismisses after timeout** | Set success result, advance time | result cleared after timeout |
| — | **Non-TC: Error persists until dismissed** | Set error result, advance time | result NOT cleared |

**Test count: 11** (9 TC-mapped + 2 non-TC)

#### `tests/client/utils/keyboard-epic4.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.5a | Cmd+Shift+E opens export dropdown | Fire keydown | Export dropdown toggled |
| — | **Non-TC: Cmd+Shift+E with no tabs is no-op** | No tabs open, fire keydown | No dropdown, no error |

**Test count: 2** (1 TC-mapped + 1 non-TC)

#### `tests/server/routes/export-session.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-1.4a | Last export dir persisted | PUT lastExportDir, reload session | Session includes lastExportDir |
| — | **Non-TC: Default session has null lastExportDir** | No session file | lastExportDir: null |
| — | **Non-TC: Non-absolute path rejected** | PUT with relative path | Returns 400 |

**Test count: 3** (1 TC-mapped + 2 non-TC)

#### `tests/server/routes/export-reveal.test.ts`

| TC | Test Description | Setup | Assert |
|----|------------------|-------|--------|
| TC-2.2b | Reveal in Finder calls open -R | POST /api/export/reveal | exec called with 'open -R' + path |
| — | **Non-TC: Path with spaces handled** | Path with spaces | exec uses quoted path |

**Test count: 2** (1 TC-mapped + 1 non-TC)

---

## Test Count Summary

| Test File | TC-Mapped | Non-TC | Total |
|-----------|-----------|--------|-------|
| server/routes/export.test.ts | 15 | 3 | 18 |
| server/routes/export-save-dialog.test.ts | 7 | 1 | 8 |
| server/routes/export-pdf.test.ts | 16 | 0 | 16 |
| server/routes/export-docx.test.ts | 14 | 0 | 14 |
| server/routes/export-html.test.ts | 11 | 0 | 11 |
| server/routes/export-fidelity.test.ts | 14 | 0 | 14 |
| server/routes/export-session.test.ts | 1 | 2 | 3 |
| server/routes/export-reveal.test.ts | 1 | 1 | 2 |
| client/components/export-dropdown.test.ts | 7 | 1 | 8 |
| client/components/export-progress.test.ts | 9 | 2 | 11 |
| client/utils/keyboard-epic4.test.ts | 1 | 1 | 2 |
| **Total** | **96** | **11** | **107** |

Note: The initial estimate was ~84 tests. The detailed mapping reveals 107 tests due to more granular coverage of format-specific quality (PDF, DOCX, HTML each need substantial test suites) and the separation of export pipeline tests from format quality tests. Some TCs map to tests in multiple files (server pipeline + format quality).

### TC Coverage Verification

| Flow | TCs in Epic | TCs Mapped | Notes |
|------|-------------|------------|-------|
| 1. Export Trigger + Save | 15 | 15 | Split across export.test.ts, save-dialog.test.ts, export-dropdown.test.ts |
| 2. Progress + Completion | 11 | 11 | Split across export.test.ts, export-progress.test.ts |
| 3. PDF Quality | 16 | 16 | In export-pdf.test.ts (real Puppeteer) |
| 4. DOCX Quality | 14 | 14 | In export-docx.test.ts (real @turbodocx) |
| 5. HTML Quality | 11 | 11 | In export-html.test.ts |
| 6. Content Fidelity | 12 | 12 | In export-fidelity.test.ts (also includes TC-7.2a–b) |
| 7. Error Handling | 7 | 7 | TC-7.1a–c in export.test.ts, TC-7.2a–b in export-fidelity.test.ts, TC-7.2c–d in export.test.ts |
| **Total** | **86** | **86** | All TCs covered. Some TCs tested in multiple files (server + client). |

---

## Verification Scripts

Epic 4 uses the same script structure as Epics 1–3. No changes to script definitions.

```json
{
  "scripts": {
    "red-verify": "npm run format:check && npm run lint && npm run typecheck && npm run typecheck:client",
    "verify": "npm run red-verify && npm run test",
    "green-verify": "npm run verify && npm run guard:no-test-changes",
    "verify-all": "npm run verify"
  }
}
```

**Note on slow tests:** Format quality tests (export-pdf, export-docx) use real Puppeteer and @turbodocx, making them slower (~5-10s each). These are included in the standard `verify` suite. If CI time becomes an issue, they can be split into a separate `test:export-quality` suite and excluded from `verify` (running only in `verify-all`). For v1, keeping them in `verify` is correct — they're the primary confidence mechanism for export output.

---

## Work Breakdown: Chunks

### Chunk 0: Infrastructure

**Scope:** New dependencies, types, schemas, fixtures, CSS files.

**Deliverables:**

| Deliverable | Path | Contents |
|-------------|------|----------|
| New dependencies | `app/package.json` | puppeteer, @turbodocx/html-to-docx, @resvg/resvg-js |
| Extended schemas | `app/src/server/schemas/index.ts` | ExportRequest, ExportResponse, ExportWarning, SaveDialog, Reveal, session extension |
| Extended types | `app/src/shared/types.ts` | New type re-exports |
| Test fixtures | `app/tests/fixtures/export-samples.ts` | Markdown samples for export testing |
| Test fixtures | `app/tests/fixtures/export-responses.ts` | ExportResponse mocks |
| CSS | `app/src/client/styles/export.css` | Export progress/result notification styling |
| HTML | `app/src/client/index.html` | Add export.css link tag |
| Error classes | `app/src/server/utils/errors.ts` | ExportInProgressError, isInsufficientStorageError |

**Exit criteria:** `npm run red-verify` passes. No tests yet.

---

### Chunk 1: Export Trigger + Save Dialog

**Scope:** Export dropdown activation (content toolbar + menu bar), save dialog, last-used directory persistence, keyboard shortcut.
**ACs:** AC-1.1–1.5
**TCs:** TC-1.1a–f, TC-1.2a–f, TC-1.3a, TC-1.4a, TC-1.5a

**Relevant tech design sections:** UI §Export Dropdown Activation, UI §Keyboard Shortcut, API §Save Dialog, API §Session Extension.

**Non-TC decided tests:** Invalid format rejected, non-absolute paths rejected, default session has null lastExportDir, export disabled during progress, Cmd+Shift+E with no tabs.

#### Skeleton

| File | Stub |
|------|------|
| `src/server/routes/export.ts` | Route registration with NotImplementedError handlers |
| `src/server/services/export.service.ts` | ExportService with export() throwing NotImplementedError |
| `src/client/components/export-progress.ts` | ExportProgress class stub |
| `src/client/components/export-result.ts` | ExportResult class stub |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/server/routes/export-save-dialog.test.ts | 8 | TC-1.2a–f, TC-1.3a + 1 non-TC |
| tests/server/routes/export-session.test.ts | 3 | TC-1.4a + 2 non-TC |
| tests/client/components/export-dropdown.test.ts | 8 | TC-1.1a–f, TC-1.5a + 1 non-TC |
| tests/client/utils/keyboard-epic4.test.ts | 2 | TC-1.5a + 1 non-TC |

**Red exit:** `npm run red-verify` passes. 21 new tests ERROR. Previous 323 tests (Epics 1–3) PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `routes/export.ts` | Save dialog + reveal + session endpoints |
| `session.service.ts` | Extension: lastExportDir |
| `content-toolbar.ts` | Activate Export dropdown from disabled |
| `menu-bar.ts` | Activate Export menu from disabled |
| `keyboard.ts` | Register Cmd+Shift+E |
| `state.ts` | Add exportState to ClientState |
| `api.ts` | Add export methods |
| `router.ts` | Wire export components |

**Green exit:** `npm run green-verify` passes. All 344 tests PASS.

**Running total: 344 tests**

---

### Chunk 2: Export Pipeline + Progress/Results

**Scope:** Export service orchestrator, Mermaid SSR service, asset resolution, progress indicator, success/warning/error notifications, error handling, concurrent prevention.
**ACs:** AC-2.1–2.4, AC-7.1
**TCs:** TC-2.1a–b, TC-2.2a–c, TC-2.3a–c, TC-2.4a–c, TC-7.1a–c, TC-7.2c–d

**Relevant tech design sections:** API §Export Service, API §Mermaid SSR Service, API §Asset Service, API §Route Handlers, UI §Export Progress Indicator, UI §Export Result Notification.

**Non-TC decided tests:** Success auto-dismiss, error persists until dismissed.

#### Skeleton

| File | Stub |
|------|------|
| `src/server/services/mermaid-ssr.service.ts` | MermaidSsrService with renderAll() stub |
| `src/server/services/asset.service.ts` | AssetService with resolveImages() stub |
| `src/server/services/pdf.service.ts` | PdfService with generate() stub |
| `src/server/services/docx.service.ts` | DocxService with generate() stub |
| `src/server/services/html-export.service.ts` | HtmlExportService with assemble() stub |

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/server/routes/export.test.ts | 18 | TC-1.1a,d,f, TC-2.1a, TC-2.3c, TC-2.4a–c, TC-7.1a–c, TC-7.2c–d + 3 non-TC |
| tests/server/routes/export-reveal.test.ts | 2 | TC-2.2b + 1 non-TC |
| tests/client/components/export-progress.test.ts | 11 | TC-2.1a–b, TC-2.2a–c, TC-2.3a–b, TC-2.4a–b + 2 non-TC |

**Red exit:** `npm run red-verify` passes. 31 new tests ERROR. Previous 344 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `export.service.ts` | Full orchestrator: read → render → Mermaid SSR → assets → assemble → generate → write |
| `mermaid-ssr.service.ts` | Puppeteer page context, render each diagram, extract SVGs |
| `asset.service.ts` | Parallel image resolution, base64 encoding, missing detection |
| `html-export.service.ts` | CSS inlining, HTML assembly |
| `render.service.ts` | Extensions: single-theme export mode, layout hints |
| `export-progress.ts` | Spinner + label during export |
| `export-result.ts` | Success/degraded/error notification with Reveal |

**Green exit:** `npm run green-verify` passes. All 375 tests PASS.

**Running total: 375 tests**

---

### Chunk 3: PDF Export

**Scope:** PDF generation via Puppeteer, page break intelligence, format-specific quality.
**ACs:** AC-3.1–3.6
**TCs:** TC-3.1a–c, TC-3.2a–d, TC-3.3a–b, TC-3.4a, TC-3.5a–b, TC-3.6a–d

**Relevant tech design sections:** API §PDF Service, API §Render Service Extensions (layout hints).

**Non-TC decided tests:** None.

Can run in parallel with Chunks 4 and 5.

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/server/routes/export-pdf.test.ts | 16 | TC-3.1a–c, TC-3.2a–d, TC-3.3a–b, TC-3.4a, TC-3.5a–b, TC-3.6a–d |

**Red exit:** `npm run red-verify` passes. 16 new tests ERROR. Previous 375 tests PASS.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `pdf.service.ts` | Full: Puppeteer launch, setContent, page.pdf with margins/format/printBackground |

**Green exit:** `npm run green-verify` passes. All 391 tests PASS.

**Running total: 391 tests**

---

### Chunk 4: DOCX Export

**Scope:** DOCX generation via @turbodocx, SVG→PNG conversion via resvg-js.
**ACs:** AC-4.1–4.6
**TCs:** TC-4.1a–c, TC-4.2a–b, TC-4.3a, TC-4.4a–c, TC-4.5a–d, TC-4.6a

**Relevant tech design sections:** API §DOCX Service.

**Non-TC decided tests:** None.

Can run in parallel with Chunks 3 and 5.

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/server/routes/export-docx.test.ts | 14 | TC-4.1a–c, TC-4.2a–b, TC-4.3a, TC-4.4a–c, TC-4.5a–d, TC-4.6a |

**Red exit:** `npm run red-verify` passes. 14 new tests ERROR.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `docx.service.ts` | Full: SVG→PNG via resvg-js, HTML wrapping for @turbodocx, DOCX buffer generation |

**Green exit:** `npm run green-verify` passes. All 405 tests PASS.

**Running total: 405 tests**

---

### Chunk 5: HTML Export + Content Fidelity + Edge Cases

**Scope:** HTML export quality, cross-format content fidelity, edge cases.
**ACs:** AC-5.1–5.4, AC-6.1–6.4, AC-7.2
**TCs:** TC-5.1a–c, TC-5.2a–c, TC-5.3a–c, TC-5.4a–b, TC-6.1a–c, TC-6.2a–d, TC-6.3a–d, TC-6.4a, TC-7.2a–b

**Relevant tech design sections:** API §HTML Export Service, API §Export Service (fidelity), API §Render Service Extensions (theme rules).

**Non-TC decided tests:** None.

Can run in parallel with Chunks 3 and 4.

#### TDD Red

| Test File | # Tests | TCs |
|-----------|---------|-----|
| tests/server/routes/export-html.test.ts | 11 | TC-5.1a–c, TC-5.2a–c, TC-5.3a–c, TC-5.4a–b |
| tests/server/routes/export-fidelity.test.ts | 14 | TC-6.1a–c, TC-6.2a–d, TC-6.3a–d, TC-6.4a, TC-7.2a–b |

**Red exit:** `npm run red-verify` passes. 25 new tests ERROR.

#### TDD Green

| Module | Implementation Notes |
|--------|---------------------|
| `html-export.service.ts` | Refinements: base64 images, theme application, self-containment verification |
| `export.service.ts` | Fidelity: details/summary expansion for PDF/DOCX, format-degradation warnings |
| `render.service.ts` | Verify single-theme mode works correctly for all theme variants |

**Green exit:** `npm run green-verify` passes. All 430 tests PASS.

**Final total: 430 tests** (323 Epics 1–3 + 107 Epic 4)

---

## Chunk Dependencies

```
Chunk 0 (Infrastructure)
    │
    ▼
Chunk 1 (Export Trigger + Save Dialog)
    │
    ▼
Chunk 2 (Export Pipeline + Progress/Results)
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
Chunk 3 (PDF)      Chunk 4 (DOCX)     Chunk 5 (HTML + Fidelity)
```

Chunks 3, 4, and 5 can run in parallel after Chunk 2 completes.

---

## Manual Verification Checklist

After all chunks are Green:

1. [ ] Open a document with headings, code, tables, images, Mermaid diagrams
2. [ ] Click Export → PDF → save dialog opens with correct defaults
3. [ ] Confirm save → progress indicator appears → PDF file created
4. [ ] Open PDF: margins present, text readable, headings sized correctly
5. [ ] PDF: heading stays with first paragraph (not orphaned at page bottom)
6. [ ] PDF: Mermaid diagram rendered (not raw source)
7. [ ] PDF: code block has syntax highlighting colors
8. [ ] PDF: images embedded, missing images show placeholder
9. [ ] PDF: links are clickable
10. [ ] Click Reveal in Finder → Finder opens with file selected
11. [ ] Export → DOCX → open in Word: headings in nav pane, tables present, images embedded
12. [ ] DOCX: Mermaid diagram as embedded image
13. [ ] DOCX: code block in monospace (with colors if @turbodocx supports)
14. [ ] Export → HTML → open in browser: looks close to viewer, all content present
15. [ ] HTML: self-contained (copy to different directory, still renders)
16. [ ] HTML export preserves active theme (export with dark theme → dark HTML)
17. [ ] PDF/DOCX use light scheme even when viewer is dark
18. [ ] Cancel save dialog → no export, no file
19. [ ] Export with 2 missing images → "Exported with 2 warnings" notification
20. [ ] Export a deleted-file tab → Export button disabled
21. [ ] Start export, try second export → blocked (button disabled)
22. [ ] Export empty document → valid empty PDF/DOCX/HTML
23. [ ] Cmd+Shift+E opens Export dropdown
24. [ ] Restart app → last export directory remembered in save dialog
25. [ ] Export a file outside the current root → works normally
