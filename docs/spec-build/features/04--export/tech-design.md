# Technical Design: Epic 4 — Export

## Purpose

This document is the index and decision record for Epic 4's technical design. It establishes the export pipeline architecture, records all dependency and design decisions (grounded in March 2026 web research), answers the epic's 10 tech design questions, and maps modules to their companion design documents.

The detailed design is split across three companion documents:

| Document | Scope |
|----------|-------|
| [tech-design-api.md](tech-design-api.md) | Server: export pipeline orchestrator, Mermaid SSR via Puppeteer, PDF/DOCX/HTML generation services, asset resolution, save dialog, render service extensions (single-theme mode, layout hints), session extensions |
| [tech-design-ui.md](tech-design-ui.md) | Client: export dropdown activation, progress indicator, success/warning/error notifications, keyboard shortcut, API client extensions |
| [test-plan.md](test-plan.md) | TC→test mapping, mock strategy, test fixtures, verification scripts, chunk breakdown with test counts |

**Prerequisite:** Epics 1–3 complete (server runtime, rendering pipeline, Mermaid diagrams, syntax highlighting, warning infrastructure, session persistence). Epic 4 spec (`epic.md`) is complete with 28 ACs and ~83 TCs.

---

## Spec Validation

Before designing, the epic was validated as the downstream consumer. All ACs map to implementation work. The following issues were identified and resolved:

| Issue | Spec Location | Resolution | Status |
|-------|---------------|------------|--------|
| Export needs server-side Mermaid rendering but Mermaid requires DOM | A5, Q4 | Puppeteer page context provides browser DOM server-side. Same approach as @mermaid-js/mermaid-cli. | Resolved |
| Shiki CSS variables won't survive HTML-to-DOCX conversion | AC-4.3 | Render service gains single-theme export mode (inline colors, no CSS variables). All export formats use single-theme rendering. | Resolved |
| Export-preview endpoint complexity | Q3 | Eliminated. Inline all assets (base64 images, CSS, Mermaid SVGs) and use `page.setContent()`. Validated by POC approach. | Resolved |
| SVG diagrams can't embed in DOCX natively | AC-4.4b | Use `@resvg/resvg-js` to convert SVGs to PNG. Validated by POC. | Resolved |
| `choose file name` save dialog needs confirmation | AC-1.2 | Research confirms osascript `choose file name` with `default name` + `default location`. Cancel exits with code 1. | Resolved |
| Blocking HTTP request for 30s export | A7, AC-2.1b | Acceptable for localhost. Server timeout set to 120s. Client shows progress indicator during request. | Resolved |
| ExportRequest needs active theme for HTML export | Data Contracts | Epic's ExportRequest has `{ path, format, savePath }`. Design adds `theme: ThemeIdSchema` — server needs the active theme to apply to HTML export (AC-6.2c). PDF/DOCX ignore it. | Resolved — deviated |
| 409 EXPORT_IN_PROGRESS not in epic's error table | Data Contracts, Error Responses | Epic lists 400, 403, 404, 500, 507. Design adds 409 for concurrent export prevention (TC-7.1c). | Resolved — deviated |
| ExportResponse.status tightened to `'success'` only | Data Contracts | Epic defines `status: 'success' \| 'error'`. Design tightens: HTTP 200 always means success; failures use HTTP error codes with `ErrorResponse` shape. This eliminates ambiguity between transport errors and in-band results. The `'error'` variant is removed from the v1 response type. | Resolved — deviated |

**Verdict:** Spec is implementation-ready. No blocking issues remain. The first-pass POC validates the core approach — same DOCX library, same Chromium-based PDF engine, same Mermaid SSR pattern.

---

## Context

Epics 1–3 built a viewer worth using daily — workspace browsing, rendered markdown with syntax highlighting and Mermaid diagrams, multi-tab management, and file watching. But a viewer that can't produce shareable output is only half the tool. When the user needs to share a spec with a stakeholder who doesn't use markdown, they need export. Epic 4 fills this gap: two clicks to produce a PDF, DOCX, or HTML file that closely matches what the viewer shows.

The central architectural challenge is that the viewing pipeline is split across server and client. Epic 2 renders markdown server-side (markdown-it + Shiki), but Epic 3's Mermaid diagrams render client-side (Mermaid.js needs browser DOM). Export must produce output server-side — the user clicks Export, the server generates the file. This means the server needs the full rendering pipeline, including Mermaid. The solution is Puppeteer: a headless Chrome instance that provides browser DOM on the server. This is exactly how `@mermaid-js/mermaid-cli` works — the canonical approach for server-side Mermaid rendering.

The first-pass POC (Electron prototype) validates the core approach. It uses the same DOCX library (`@turbodocx/html-to-docx`), the same Chromium-based PDF engine (Electron's `printToPDF` ≈ Puppeteer's `page.pdf()`), and the same pattern of rendering Mermaid in an isolated browser context. The POC also contributes three specific patterns adopted in this design: `@resvg/resvg-js` for SVG→PNG conversion, layout hint CSS classes for PDF page break intelligence, and base64 image inlining for self-contained export HTML.

A key design decision cascades through the entire pipeline: **all export formats use single-theme Shiki rendering**. The viewing pipeline uses dual-theme CSS variables (both light and dark token colors embedded, switched by CSS). Export doesn't need theme switching — it produces a static file. Rendering with `defaultColor` set to a specific theme produces inline `color` styles instead of CSS variables. This eliminates CSS variable resolution problems for DOCX and simplifies the export HTML. PDF and DOCX always use light. HTML uses whichever variant matches the user's active theme.

### Stack Additions for Epic 4

All packages verified via web research (March 2026). Research outputs archived in `.research/outputs/`.

| Package | Version | Purpose | Research Confirmed |
|---------|---------|---------|-------------------|
| puppeteer | 24.40.0 | PDF generation via `page.pdf()` + Mermaid SSR via page context | Yes — dual ESM/CJS, 170MB Chrome download on macOS, tagged PDFs by default |
| @turbodocx/html-to-docx | 1.20.1 | HTML → DOCX conversion | Yes — actively maintained fork, 25.6K weekly downloads. Validated by POC. |
| @resvg/resvg-js | latest | SVG → PNG conversion for DOCX embedding | Yes — Rust-based, high quality, no browser needed. Adopted from POC. |

**Packages NOT added (considered and rejected):**

| Package | Why Rejected |
|---------|-------------|
| playwright | Larger download (~281MB vs 170MB), no `puppeteer-core` equivalent, tagged PDFs default false |
| docx (dolanmiu, 9.6.1) | Programmatic DOCX construction — excellent quality but requires building an AST-to-DOCX mapper. High effort for v1. Upgrade path if @turbodocx quality is insufficient. |
| html-to-docx (privateOmega) | Effectively abandoned — last meaningful update 2023. @turbodocx fork is the maintained successor. |
| @mermaid-js/mermaid-cli | Spawns a new browser per invocation. We control Puppeteer directly for better performance (shared browser, batch rendering). |
| Pandoc | External binary dependency. Users would need to install it separately. |

---

## Tech Design Question Answers

The epic raised 10 questions for the tech lead. All are answered here; detailed implementation follows in the companion documents.

### Q1: PDF engine

**Answer:** Puppeteer 24.40.0.

`page.pdf()` supports format (Letter/A4), margins, `printBackground`, `waitForFonts`, tagged PDFs (default true since v22), and experimental document outline. The same Chromium rendering engine as the POC's `printToPDF`. Smaller macOS download (~170MB) than Playwright (~281MB). Shares the browser instance with Mermaid SSR — one Puppeteer launch serves both purposes.

**Detailed design:** See API companion doc, PDF Service section.

### Q2: DOCX engine

**Answer:** `@turbodocx/html-to-docx` 1.20.1.

Feed it rendered HTML with inline styles → get DOCX. Same library the POC uses — validated in production use. Actively maintained fork with 25.6K weekly downloads. Mermaid SVGs are converted to PNG via `@resvg/resvg-js` before conversion (DOCX doesn't support SVG natively). If DOCX quality needs improvement later, the programmatic `docx` library (9.6.1) is the upgrade path.

**Detailed design:** See API companion doc, DOCX Service section.

### Q3: Server-side rendering pipeline

**Answer:** Existing render pipeline + single-theme mode + Puppeteer for Mermaid SSR. No export-preview endpoint.

The server already renders markdown via markdown-it + Shiki. For export, the render service gains a `themeMode` parameter: `'dual'` for viewing (existing), `'light'` or `'dark'` for export (new). Single-theme mode produces inline `color` styles instead of CSS variables, eliminating resolution issues for DOCX.

Mermaid diagrams are rendered server-side via Puppeteer. All images are resolved to base64 data URIs. The final export HTML is self-contained — CSS, images, and Mermaid SVGs all inlined. Puppeteer loads this HTML via `page.setContent()` for PDF generation. No export-preview endpoint needed.

This approach was validated by the POC, which uses the same base64-inlining pattern.

**Detailed design:** See API companion doc, Export Service and Render Service Extensions sections.

### Q4: Mermaid in server-side rendering

**Answer:** Puppeteer page context. Same approach as `@mermaid-js/mermaid-cli`.

Launch a Puppeteer page, inject Mermaid.js, call `mermaid.initialize()` + `mermaid.render()` for each diagram, extract SVG output. The browser instance is shared with PDF generation. Mermaid is configured with `securityLevel: 'strict'` and theme mapped from the export theme (light → `'default'`, dark → `'dark'`).

Failed Mermaid blocks produce the same error fallback HTML as the viewer (raw source + error banner), plus an `ExportWarning`.

**Detailed design:** See API companion doc, Mermaid SSR Service section.

### Q5: HTML export format

**Answer:** Single file with base64-encoded assets.

All CSS inlined in `<style>` tags. All images as base64 `data:` URIs. Mermaid SVGs already inline in the DOM. No external dependencies. The `data-theme` attribute is set to the user's active theme (for HTML) or `light-default` (for PDF/DOCX).

The POC exports as a folder (HTML + assets/). Our single-file approach trades larger file size for simpler sharing (one file, not a folder). The folder approach can be added as a future option.

**Detailed design:** See API companion doc, HTML Export Service section.

### Q6: Export styling implementation

**Answer:** Single-theme Shiki rendering. Theme applied via CSS in the self-contained HTML.

- **PDF/DOCX:** Render with Shiki `defaultColor: 'light'`. All code tokens have inline `color` styles in light colors. CSS uses `light-default` theme variables. No CSS variable resolution needed.
- **HTML:** Render with Shiki `defaultColor` matching the active theme variant ('light' or 'dark'). CSS uses the active theme's variables. `data-theme` attribute set accordingly.

The render service holds two MarkdownIt instances: `viewingMd` (dual-theme, for the viewer) and `exportMd` (single-theme, created per-export with the target theme). This separation is clean — the viewing pipeline is unchanged.

**Detailed design:** See API companion doc, Render Service Extensions section.

### Q7: Page size default

**Answer:** US Letter.

macOS-first app (Epic 1 A2), primary user likely US-based. `page.pdf({ format: 'letter' })`. A4 can be added as a configuration option in a future epic.

### Q8: Temp file strategy

**Answer:** In-memory buffers + atomic write to target path.

The export pipeline operates on strings and buffers — no intermediate temp files. PDF output is a `Buffer` from `page.pdf()`. DOCX output is a `Buffer` from `@turbodocx`. HTML output is a `string`. The final output is written atomically: write to `${savePath}.tmp`, then rename to `savePath`. If export fails, the temp file is cleaned up in a `finally` block. No persistent temp files.

### Q9: DOCX syntax highlighting

**Answer:** Inline `color` styles via single-theme Shiki rendering.

Since export uses single-theme Shiki mode, code tokens have inline `color: #hexvalue` styles. `@turbodocx/html-to-docx` preserves inline color styles on `<span>` elements → code blocks get colored text in DOCX. If @turbodocx strips inline styles, code blocks fall back to monospace-only — acceptable for v1. The POC uses this same approach successfully.

### Q10: HTML export single-file vs. folder

**Answer:** Single file (decided in Q5). The save dialog presents a single filename (e.g., `architecture.html`), not a folder path. The file is self-contained.

---

## High Altitude: System View

### System Context

Epic 4 extends the server with export capabilities. The client gains export UI (activating disabled controls from Epics 1–2). Puppeteer is a new server-side dependency — a headless browser that provides DOM for Mermaid SSR and PDF generation.

```
┌──────────────────────────────────────────────────────────────┐
│                        User's Machine                         │
│                                                               │
│  ┌───────────────┐   HTTP (localhost)    ┌────────────────┐  │
│  │  Browser Tab   │ ◄─────────────────► │  Fastify        │  │
│  │  (Frontend)    │   POST /api/export  │  Server         │  │
│  │                │   (blocks until     │                 │  │
│  │  NEW:          │    complete)        │  NEW:           │  │
│  │  - Export UI   │                     │  - Export svc   │  │
│  │  - Progress    │                     │  - PDF svc      │  │
│  │  - Results     │                     │  - DOCX svc     │  │
│  └───────────────┘                     │  - HTML svc     │  │
│                                         │  - Mermaid SSR  │  │
│                                         └───────┬────────┘  │
│                                                  │            │
│                                          ┌───────▼────────┐  │
│                                          │  Filesystem     │  │
│                                          │  - Read .md     │  │
│                                          │  - Read images  │  │
│                                          │  - Write output │  │
│                                          └────────────────┘  │
│                                                               │
│  ┌───────────────┐                     ┌────────────────┐    │
│  │  Puppeteer     │ ◄─── managed ──── │  Export         │    │
│  │  (Chrome)      │                    │  Service        │    │
│  │                │                    │                 │    │
│  │  1. Mermaid    │ ── SVG output ──► │  → inline in    │    │
│  │     rendering  │                    │    export HTML  │    │
│  │                │                    │                 │    │
│  │  2. PDF gen    │ ── PDF buffer ──► │  → write to     │    │
│  │     page.pdf() │                    │    savePath     │    │
│  └───────────────┘                     └────────────────┘    │
│                                                               │
│  ┌───────────────┐                     ┌────────────────┐    │
│  │  @resvg/       │ ◄─── in-process── │  DOCX Service   │    │
│  │  resvg-js      │                    │                 │    │
│  │  SVG → PNG     │ ── PNG buffer ──► │  → embed in     │    │
│  └───────────────┘                     │    DOCX         │    │
│                                         └────────────────┘    │
│                                                               │
│  ┌───────────────┐                     ┌────────────────┐    │
│  │  osascript     │ ◄─── spawn ─────── │  Server         │    │
│  │  (Save Dialog) │ ── path/null ───► │  (save-dialog)  │    │
│  └───────────────┘                     └────────────────┘    │
│                                                               │
│  ┌───────────────┐                     ┌────────────────┐    │
│  │  open -R       │ ◄─── spawn ─────── │  Server         │    │
│  │  (Reveal in    │                    │  (reveal)       │    │
│  │   Finder)      │                    │                 │    │
│  └───────────────┘                     └────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

The server has three new external boundaries:

1. **Puppeteer (Chrome)** — headless browser for Mermaid SSR + PDF generation. Mock boundary for tests.
2. **@resvg/resvg-js** — SVG → PNG conversion for DOCX. In-process. Mocked in pipeline orchestration tests, exercised for real in format quality tests (see test plan for the two-category mock strategy).
3. **osascript (save dialog)** — native macOS NSSavePanel. Mock boundary for tests.

Plus existing boundaries: filesystem (read .md, read images, write output), osascript (folder/file picker from Epics 1–2), `open` command (reveal in Finder, external file opening).

### Data Flow: Export Pipeline

All three formats share the same source read, markdown render, Mermaid SSR, warning collection, and asset resolution pipeline. They diverge at the output generation step: PDF and HTML use the assembled export HTML directly; DOCX uses a DOCX-optimized wrapper over the same rendered content.

```
User clicks Export → selects format → save dialog → confirms path
    ↓
POST /api/export { path, format, savePath }
    ↓
Export Service orchestrates:
    ── Shared pipeline (all formats) ──────────────────────────────
    1. Read .md from disk (file.service — existing)
    2. Render markdown (render.service — single-theme export mode + layout hints)
       → HTML with mermaid placeholders + highlighted code (inline colors)
    3. Render Mermaid SSR (mermaid-ssr.service — Puppeteer)
       → Extract SVGs → replace placeholders in HTML
    4. Resolve images (asset.service)
       → Read from disk → base64 data URIs
       → Missing → placeholder HTML + ExportWarning
    ── Format-specific output ─────────────────────────────────────
    5. Assemble self-contained HTML (inline CSS + theme + content)
    6. Generate output:
       ├─ PDF:  load assembled HTML in Puppeteer → page.pdf() → Buffer
       ├─ HTML: assembled HTML is the output (already self-contained)
       └─ DOCX: rendered content + DOCX-optimized wrapper → @turbodocx → Buffer
       │         (Mermaid SVGs → PNG via resvg-js; separate wrapper for
       │          best @turbodocx compatibility — see DOCX Quality Targets)
    7. Write output atomically to savePath
    8. Cleanup Puppeteer
    ↓
ExportResponse { status: 'success', outputPath, warnings }
```

### DOCX Quality Targets and Non-Goals

DOCX is inherently a different rendering medium from PDF/HTML. The conversion from HTML to Word's document model is lossy — @turbodocx translates structure and basic styling, not full CSS layout. The quality bar is: **would you be comfortable sending the DOCX output to a stakeholder as-is?**

**Quality targets (must meet):**
- Heading structure is correct and appears in Word's navigation pane
- Body text is readable with preserved bold/italic/inline code
- Lists and tables survive in correct, usable form
- Images are embedded (not linked externally)
- Mermaid diagrams appear as embedded PNG images
- Code blocks are visually distinct (monospace, background), with syntax highlighting colors where @turbodocx preserves inline styles
- Degraded content (missing images, failed Mermaid) is visible and labeled
- The document feels professional and shareable

**Non-goals (not expected in v1):**
- Near-pixel parity with the viewer
- Full CSS layout fidelity
- PDF-like page break behavior
- Exact preservation of all rich styling (e.g., blockquote left-border colors)

**Forcing function:** If POC/implementation output looks mediocre against the quality targets, escalate immediately rather than shipping and seeing. The upgrade path is the programmatic `docx` library (9.6.1) for higher-fidelity structural output — documented in Deferred Items.

### External Contracts

New endpoints extending the existing API surface:

| Method | Path | Request | Response | Epic ACs |
|--------|------|---------|----------|----------|
| POST | /api/export | `ExportRequest` | `ExportResponse` | AC-1.1–7.2 (all export) |
| POST | /api/export/save-dialog | `{ defaultPath, defaultFilename }` | `{ path } \| null` | AC-1.2, AC-1.3 |
| POST | /api/export/reveal | `{ path }` | `{ ok: true }` | AC-2.2b |
| PUT | /api/session/last-export-dir | `{ path }` | `SessionState` | AC-1.4 |

Error responses extend Epic 1–3 codes:

| Status | Code | When |
|--------|------|------|
| 400 | INVALID_PATH | Source or save path not absolute |
| 400 | INVALID_FORMAT | Format not one of: pdf, docx, html |
| 403 | PERMISSION_DENIED | Cannot write to save path |
| 404 | FILE_NOT_FOUND | Source markdown file doesn't exist |
| 409 | EXPORT_IN_PROGRESS | Another export is already running |
| 500 | EXPORT_ERROR | Export engine failed |
| 507 | INSUFFICIENT_STORAGE | Target disk has insufficient space |

**Runtime Prerequisites (additions):**

| Prerequisite | Where Needed | How to Verify |
|---|---|---|
| puppeteer 24.40.0 (downloads Chrome ~170MB on first `npm install`) | Server (export) | `npm ls puppeteer` |
| @turbodocx/html-to-docx 1.20.1 | Server (DOCX export) | `npm ls @turbodocx/html-to-docx` |
| @resvg/resvg-js | Server (SVG→PNG for DOCX) | `npm ls @resvg/resvg-js` |

---

## Medium Altitude: Module Architecture

### New and Modified Modules

Epic 4 adds 10 new modules and modifies 7 existing modules:

```
app/src/
├── server/
│   ├── app.ts                           # MODIFIED: register export routes
│   ├── routes/
│   │   ├── session.ts                   # MODIFIED: add last-export-dir endpoint
│   │   ├── export.ts                    # NEW: POST /api/export, save-dialog, reveal
│   │   └── ...
│   ├── services/
│   │   ├── session.service.ts           # MODIFIED: add lastExportDir
│   │   ├── render.service.ts            # MODIFIED: add single-theme export mode, layout hints
│   │   ├── export.service.ts            # NEW: orchestrates the full export pipeline
│   │   ├── mermaid-ssr.service.ts       # NEW: Puppeteer-based server-side Mermaid rendering
│   │   ├── pdf.service.ts              # NEW: Puppeteer page.pdf() wrapper
│   │   ├── docx.service.ts             # NEW: HTML → DOCX via @turbodocx + resvg-js SVG→PNG
│   │   ├── html-export.service.ts      # NEW: self-contained HTML assembly
│   │   └── asset.service.ts            # NEW: image resolution, base64 encoding, missing detection
│   └── schemas/
│       └── index.ts                     # MODIFIED: add ExportRequest, ExportResponse, ExportWarning schemas
│
└── client/
    ├── state.ts                         # MODIFIED: add exportState
    ├── api.ts                           # MODIFIED: add export methods
    ├── components/
    │   ├── content-toolbar.ts           # MODIFIED: activate Export dropdown
    │   ├── menu-bar.ts                  # MODIFIED: activate Export menu
    │   ├── export-progress.ts          # NEW: in-progress indicator
    │   └── export-result.ts            # NEW: success/warning/error notification
    ├── utils/
    │   └── keyboard.ts                  # MODIFIED: add Cmd+Shift+E
    └── styles/
        ├── content-toolbar.css          # MODIFIED: export progress/result styling
        └── export.css                   # NEW: export notification styles
```

### Module Responsibility Matrix

| Module | Layer | Responsibility | Dependencies | ACs Covered |
|--------|-------|----------------|--------------|-------------|
| `server/routes/export.ts` | Server | Export endpoints: trigger, save-dialog, reveal | export.service, session.service | AC-1.1–1.5, AC-2.1–2.4, AC-7.1 |
| `server/services/export.service.ts` | Server | Orchestrate: read → render → Mermaid SSR → resolve assets → generate output | render.service, mermaid-ssr, pdf/docx/html services, asset.service, file.service | AC-1.1, AC-2.1–2.4, AC-6.1–6.4, AC-7.1–7.2 |
| `server/services/mermaid-ssr.service.ts` | Server | Render Mermaid diagrams server-side via Puppeteer | puppeteer (mock boundary) | AC-3.3, AC-4.4b, AC-5.2b |
| `server/services/pdf.service.ts` | Server | Generate PDF via Puppeteer `page.pdf()` | puppeteer (mock boundary) | AC-3.1–3.6 |
| `server/services/docx.service.ts` | Server | Generate DOCX via @turbodocx + SVG→PNG via resvg-js | @turbodocx, @resvg/resvg-js (in-process) | AC-4.1–4.6 |
| `server/services/html-export.service.ts` | Server | Assemble self-contained HTML with inlined assets | — | AC-5.1–5.4 |
| `server/services/asset.service.ts` | Server | Resolve images to base64, detect missing/remote/unsupported | fs (mock boundary) | AC-3.5, AC-4.4, AC-5.1c, AC-6.1 |
| `server/services/render.service.ts` | Server | Extended: single-theme export mode, layout hint post-processing | shiki, markdown-it (in-process) | AC-3.4, AC-4.3, AC-5.2c, AC-6.2 |
| `client/components/content-toolbar.ts` | Client | Activate Export dropdown from disabled state | state, api | AC-1.1a, AC-1.1c–f |
| `client/components/menu-bar.ts` | Client | Activate Export menu from disabled state | state, api | AC-1.1b |
| `client/components/export-progress.ts` | Client | In-progress indicator during export | state | AC-2.1 |
| `client/components/export-result.ts` | Client | Success/warning/error notification with Reveal in Finder | state, api | AC-2.2–2.4 |
| `client/utils/keyboard.ts` | Client | Cmd+Shift+E shortcut | — | AC-1.5 |

---

## Dependency Map

### Server Dependencies (additions)

```
server/routes/export.ts
    └── server/services/export.service.ts
        ├── server/services/file.service.ts (EXISTING — read .md)
        ├── server/services/render.service.ts (MODIFIED — export mode)
        │   ├── shiki (in-process, export highlighter instance)
        │   └── markdown-it (in-process)
        ├── server/services/mermaid-ssr.service.ts
        │   └── puppeteer (MOCK BOUNDARY)
        ├── server/services/asset.service.ts
        │   └── node:fs/promises (MOCK BOUNDARY)
        ├── server/services/pdf.service.ts
        │   └── puppeteer (MOCK BOUNDARY — shared browser)
        ├── server/services/docx.service.ts
        │   ├── @turbodocx/html-to-docx (in-process)
        │   └── @resvg/resvg-js (in-process)
        └── server/services/html-export.service.ts
            └── (pure string assembly — no external deps)
```

### Client Dependencies (additions)

```
client/components/content-toolbar.ts (MODIFIED)
    ├── client/api.ts (MOCK BOUNDARY — export methods added)
    └── client/state.ts (exportState added)

client/components/export-progress.ts (NEW)
    └── client/state.ts

client/components/export-result.ts (NEW)
    ├── client/state.ts
    └── client/api.ts (reveal endpoint)
```

---

## Work Breakdown Overview

The epic breaks into 6 chunks (Chunk 0 + 5 feature chunks). Each chunk goes through Skeleton → TDD Red → TDD Green phases. Detailed chunk specs, TC mappings, and test counts are in the [Test Plan](test-plan.md).

| Chunk | Name | ACs | Estimated Tests | Dependencies |
|-------|------|-----|-----------------|--------------|
| 0 | Infrastructure | — | 0 (types, fixtures, CSS, deps) | None |
| 1 | Export Trigger + Save Dialog | AC-1.1–1.5 | 21 | Chunk 0 |
| 2 | Export Pipeline + Progress/Results | AC-2.1–2.4, AC-7.1 | 31 | Chunk 1 |
| 3 | PDF Export | AC-3.1–3.6 | 16 | Chunk 2 |
| 4 | DOCX Export | AC-4.1–4.6 | 14 | Chunk 2 |
| 5 | HTML Export + Content Fidelity + Edge Cases | AC-5.1–5.4, AC-6.1–6.4, AC-7.2 | 25 | Chunk 2 |

```
Chunk 0 ──► Chunk 1 ──► Chunk 2 ──► Chunk 3
                              ├──► Chunk 4
                              └──► Chunk 5
```

Chunks 3, 4, and 5 can run in parallel after Chunk 2 completes.

**Total estimated test count:** ~107 tests across all files (see [Test Plan](test-plan.md) for detailed mapping). Combined with Epics 1–3 (323 tests), the project reaches ~430 tests.

---

## Deferred Items

| Item | Related AC | Reason Deferred | Future Work |
|------|-----------|-----------------|-------------|
| Export configuration UI (page size, margins) | AC-3.1 | Out of scope per epic | Settings panel with page size, margin, font options |
| A4 page size option | AC-3.1c | US Letter sufficient for v1 | Add page size dropdown or locale detection |
| Batch export (multiple documents) | — | Out of scope per epic | "Export All Open Tabs" action |
| Manual page break hints (`<!-- pagebreak -->`) | — | Out of scope per epic | Preprocessor sentinel + CSS class (POC has this) |
| Programmatic DOCX construction (docx library) | AC-4.1 | @turbodocx is sufficient for v1 | AST-to-DOCX mapper for higher quality output |
| HTML export as folder with assets | AC-5.1 | Single file is simpler for v1 | Add folder option in export format dropdown |
| Export progress percentage | AC-2.1 | Spinner is sufficient per epic | Track pipeline steps as percentage |
| Puppeteer browser pooling | — | Per-export launch is sufficient for v1 | Warm browser cache with 60s TTL |

---

## Open Questions

| # | Question | Owner | Blocks | Resolution |
|---|----------|-------|--------|------------|
| — | No open questions | — | — | All 10 tech design questions answered |

---

## Related Documentation

- Epic: `epic.md`
- API Design: `tech-design-api.md`
- UI Design: `tech-design-ui.md`
- Test Plan: `test-plan.md`
- Epic 2 API Design (render service): `../02--document-viewing-and-multi-tab-reading/tech-design-api.md`
- Epic 3 Tech Design (Shiki/Mermaid): `../03--mermaid-and-rich-content/tech-design.md`
- POC Implementation: `../../../first-pass-poc/`
- Stack Research: `../../.research/outputs/export-feature-package-research.md`
