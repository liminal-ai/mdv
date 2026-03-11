# Technical Architecture Overview

## Status

This document is a **preliminary architecture draft**. It describes the **recommended shape** of the application based on current goals, not a locked final design. The intent is to give product, design, and engineering a shared high-level frame before detailed technical design, work breakdown, and implementation planning.

## Purpose

The proposed application shape is a **local-first markdown workspace** that can run in a browser from a single local Node process, with an optional Electron wrapper later for desktop-native usage.

The main architectural goal is:

- keep the app easy to run locally without signing/distribution friction
- preserve a clean path to an Electron shell later
- centralize filesystem and export logic in one server-side runtime
- keep the frontend lightweight and focused on document workflows

## Recommended Application Shape

The recommended shape is a **single deployable unit**:

- one local Node process
- one Fastify application
- static-served HTML/CSS/JS frontend
- local HTTP API for document, folder, render, and export operations

At a high level:

- the **server** owns filesystem access, export orchestration, and application state that depends on local disk
- the **web client** owns layout, interaction, document presentation, and editor/preview workflows
- the **shared core** owns markdown/domain/render/export transformations that should remain reusable across runtime targets

This should be treated as the default target shape unless later product or platform needs justify a different split.

## Recommended Stack

### Runtime

- Node.js
- Fastify for local server and API routing

### Frontend

- HTML
- CSS
- vanilla JavaScript

### Shared Domain / Rendering

- TypeScript
- shared `core` modules for markdown parsing, normalization, export preparation, and document model logic

### Core Dependencies

- `markdown-it` for markdown parsing
- `highlight.js` for code highlighting
- `mermaid` for diagram rendering
- `cheerio` for HTML normalization/transforms
- `@turbodocx/html-to-docx` for DOCX generation
- `@resvg/resvg-js` for SVG-to-PNG conversion where needed

### Likely Additional Server Dependencies

- Playwright or Puppeteer later if PDF generation should move away from Electron-specific rendering
- `chokidar` or equivalent later if file watching needs a more portable watcher layer than direct `fs.watch`

## High-Level Components

### 1. Shared Core

Purpose:

- define the document model
- parse markdown
- normalize content into preview/export-friendly structures
- prepare render/export artifacts

Likely responsibilities:

- markdown parse + preprocess
- Mermaid placeholder handling
- block normalization
- asset resolution metadata
- export HTML generation
- warning generation

This layer should remain as framework-agnostic as possible.

### 2. Local Server

Purpose:

- expose filesystem-backed operations through a local API
- coordinate document read/write/export flows
- act as the single trusted boundary for local path access

Likely responsibilities:

- root folder selection / folder tree listing
- document open/read/save
- export orchestration
- file watching / change notifications
- settings persistence
- path validation and request normalization

### 3. Web Client

Purpose:

- provide the application shell and document workspace
- render the tree, tabs, editor, preview, warnings, and status UI
- call the local API for all filesystem-backed actions

Likely responsibilities:

- toolbar interactions
- tab strip
- directory browser
- edit/render mode switching
- modal prompts
- preview updates
- export actions

The client should be intentionally thin: it should not own local disk logic.

### 4. Optional Electron Shell

Purpose:

- package the same application experience as a desktop app
- provide native opening/file association later if desired

Recommended shape:

- keep Electron as a wrapper over the same local web application
- avoid rebuilding separate frontend logic just for Electron
- keep Electron-specific code limited to shell concerns

## Recommended Runtime Flow

### App Startup

1. Start local Fastify server
2. Serve frontend assets
3. Frontend initializes shell state
4. Frontend requests current workspace state from API

### Open Document Flow

1. User selects a document from the folder tree or opens via explicit command
2. Client requests document contents from API
3. Server reads markdown from disk
4. Shared core produces normalized preview/export model
5. Client renders editor + preview state

### Save Flow

1. Client submits updated markdown to API
2. Server writes file
3. Server refreshes render model as needed
4. Client updates dirty state and preview state

### Export Flow

1. Client requests PDF/DOCX/HTML export
2. Server resolves the latest markdown/render context
3. Shared core prepares export HTML/assets
4. Export adapter produces output files
5. Server returns result path, warnings, and status

## Proposed High-Level Module Layout

This is a recommended logical layout, not a final folder contract:

```text
src/
  core/
    render/
    export/
    types/
    contracts/

  server/
    api/
    services/
    filesystem/
    watching/
    settings/
    startup/

  web/
    shell/
    workspace/
    tree/
    tabs/
    editor/
    preview/
    modals/
    lib/

  electron/   (optional later)
    shell/
    startup/
```

## Recommended Component Boundaries

### Boundary: Client -> Server

Use simple local HTTP contracts.

Guidance:

- request/response shapes should be explicit and typed
- the client should pass file paths only as opaque values returned by the server or chosen through allowed flows
- the server should own path normalization and validation

Example high-level contracts:

- `GET /api/workspace/state`
- `GET /api/tree?root=...`
- `GET /api/document?path=...`
- `POST /api/document/save`
- `POST /api/document/render`
- `POST /api/export/pdf`
- `POST /api/export/docx`
- `POST /api/export/html`

### Boundary: Server -> Core

The server should call shared pure-ish application logic through stable service interfaces.

Example shape:

- `renderMarkdown(request)`
- `normalizeDocument(parsedDocument)`
- `prepareExport(renderResult)`

### Boundary: Export Adapters

Export generation should sit behind adapter-style boundaries so runtime-specific implementations can be swapped later.

Example shape:

- `pdfExporter.export(renderContext, destination)`
- `docxExporter.export(renderContext, destination)`
- `htmlExporter.export(renderContext, destination)`

This keeps the shared document model independent from transport/runtime details.

## Core Contract Shapes

These are intentionally high-level and provisional.

### Workspace State

Should likely include:

- active root folder
- pinned folders
- open documents/tabs
- active document id/path
- sidebar state

### Document Session

Should likely include:

- file path
- saved markdown
- current markdown
- dirty flag
- render preview model
- warnings
- external-change status

### Render Result

Should likely include:

- preview HTML or preview block model
- export HTML
- normalized document blocks
- diagrams/assets
- warnings

### Export Result

Should likely include:

- success flag
- output path
- warnings
- failure reason when applicable

## Architectural Principles

- **Local-first**: the application should work well as a local tool with no remote dependency.
- **Single responsibility by layer**: filesystem and export concerns stay server-side; UI concerns stay client-side.
- **Shared core**: parsing/render/export domain logic should remain reusable across delivery targets.
- **Thin shell**: Electron, if used later, should wrap the app rather than redefine it.
- **Progressive hardening**: keep early structure simple, but leave clean seams for future diagnostics, watcher upgrades, and export improvements.

## Known Open Questions

These should remain open until deeper tech design:

- whether PDF export should use Playwright/Puppeteer, a browser-print pipeline, or another adapter
- whether file watching is part of v1 browser usage or deferred
- whether workspace/session state should be entirely server-owned, client-owned, or shared by responsibility
- whether the document preview should use HTML-string rendering, block-level DOM patching, or a simpler full-refresh strategy
- how much editor sophistication is actually needed in v1

## Recommendation Summary

The recommended direction is:

- Fastify as the local application runtime
- vanilla HTML/CSS/JS as the frontend
- shared `core` as the long-lived domain layer
- optional Electron shell later, wrapping the same app

This shape appears to best support:

- local developer usage
- work-machine usage without app-signing dependency
- open source accessibility
- future dual-target desktop/web delivery without maintaining two separate products
