# Technical Design: Package Viewer Integration

## Purpose

This document translates the Epic 9 requirements into implementable architecture for integrating the markdown package format into the viewer. It serves three audiences:

| Audience | Value |
|----------|-------|
| Reviewers | Validate design before code is written |
| Developers | Clear blueprint for implementation |
| Story Tech Sections | Source of implementation targets, interfaces, and test mappings |

**Prerequisite:** Epic 9 is complete with 30 ACs, 67 TCs, 5 REST endpoints, and 8 stories.

**Output Configuration:** Config B (4 docs) — this is a multi-domain project with both a Fastify backend (package service, routes, temp directory management) and a vanilla JS frontend (package-mode sidebar, mode switching, manifest editing UI). The index carries decisions, context, system view, and work breakdown. Companion docs carry implementation depth. The test plan carries TC→test mapping.

| Document | Contents |
|----------|----------|
| `tech-design.md` (this file) | Decisions, context, system view, module architecture overview, work breakdown |
| `tech-design-server.md` | Server-side implementation: package service, routes, temp management, session state |
| `tech-design-client.md` | Client-side implementation: package-mode sidebar, mode switching, menu integration, stale indicator |
| `test-plan.md` | TC→test mapping, mock strategy, fixtures, chunk breakdown with test counts |

---

## Spec Validation

The Epic 9 spec was validated before design. All 30 ACs map to implementation work, data contracts are complete with 5 REST endpoints, and the story breakdown covers all ACs.

**Validation Checklist:**
- [x] Every AC maps to clear implementation work
- [x] Data contracts complete (5 REST endpoints, all typed with Zod-compatible shapes)
- [x] Edge cases have TCs (invalid files, malformed manifests, empty directories, cancel flows)
- [x] No technical constraints the BA missed
- [x] Flows make sense from implementation perspective

**Issues Found:**

| Issue | Spec Location | Resolution | Status |
|-------|---------------|------------|--------|
| Existing `/api/file` and `/api/tree` take absolute paths — for extracted packages, the client must supply the temp dir path (from `extractedRoot` in the open response) as the absolute path root | AC-1.4, A3 | Confirmed: existing endpoints work transparently when the client sends absolute paths under the extracted root. No endpoint modifications needed. The `GET /api/tree?root=<extractedRoot>` call populates the fallback tree; `GET /api/file?path=<extractedRoot>/path/to/file.md` reads extracted files. This validates assumption A3. | Resolved — clarified |
| Drag-and-drop (A4): browser drag-and-drop of local files does not reliably expose the full filesystem path in all contexts. Electron's `webContents` drop handler provides `file.path`, but the browser-only path uses `File.name` without directory. | AC-1.2, A4 | In browser mode, drag-and-drop of `.mpk`/`.mpkz` files delivers a `File` object. The client uploads the file content to a new upload variant of `POST /api/package/open` that accepts a multipart body, OR the Electron bridge provides the full path. For v1 browser-only, we support the File menu and CLI argument paths; drag-and-drop works in Electron via the preload bridge. In browser mode, drag-and-drop is best-effort — the file's full path may not be available. Design deviation: drag-and-drop in browser-only mode may require uploading file content rather than sending a path. | Resolved — deviated |
| CLI argument detection (Q11): the app currently treats CLI arguments as folder paths. Needs extension to detect `.mpk`/`.mpkz` file extensions. | AC-1.3 | The server's `startServer()` function already receives a path argument. Add extension check: if the argument ends with `.mpk` or `.mpkz`, route to package open instead of `setRoot`. | Resolved — clarified |
| `GET /api/package/file` vs existing `GET /api/file`: the epic defines a separate package file endpoint, but the existing `/api/file` already reads any absolute path. | Data Contracts | Design choice: use the existing `GET /api/file` endpoint (which takes an absolute path) for reading files from extracted packages. The client constructs the absolute path by joining `extractedRoot` + relative path. `GET /api/package/file` is removed in favor of reusing `/api/file`. This reduces API surface and validates A3 (existing endpoints work on temp dirs). For directory-mode packages, files are already on disk at their original paths. | Resolved — deviated |
| `PUT /api/file` and file watching: edits to extracted package files use the existing save endpoint (absolute path into temp dir). The existing `/ws` file watcher should detect changes if watching that path. | AC-7.1, Q8 | Confirmed: the `WatchService` uses chokidar on individual file paths. When a package file is opened (tab created), the client sends a `watch` message with the absolute temp dir path. File watching works transparently. | Resolved — clarified |

### Tech Design Questions — Answer Locations

The epic raised 11 questions for the Tech Lead. Each is answered in the design section where the decision naturally arises:

| # | Question | Answer Location |
|---|----------|----------------|
| Q1 | Temp directory lifecycle | Server Companion §Package Service — Temp Directory Manager |
| Q2 | Manifest update propagation | Server Companion §Flow 6: Manifest Editing; Client Companion §Manifest Re-Sync |
| Q3 | Package metadata display location | Client Companion §Package Sidebar Header |
| Q4 | Drag-and-drop integration | Client Companion §Flow: Drag-and-Drop; Spec Validation (A4 deviation) |
| Q5 | Sidebar coexistence | Client Companion §Sidebar Mode Architecture |
| Q6 | Active package state storage | Server Companion §Package Service State; §Session State Extension |
| Q7 | Stale detection mechanism | Server Companion §Stale Tracking |
| Q8 | File watching in extracted packages | Spec Validation (existing WatchService works transparently on temp dir paths) |
| Q9 | Export save dialog format selection | Client Companion §Export Flow — Save Dialog |
| Q10 | Existing endpoint compatibility | Spec Validation (A3 — existing endpoints work via absolute paths) |
| Q11 | Package open from CLI | Server Companion §CLI Argument Detection |

---

## Context

MD Viewer grew through 6 epics to deliver workspace browsing, file tree navigation, markdown rendering (including Mermaid and syntax highlighting), tab management, editing with optimistic concurrency, multi-format export, theme switching, and session persistence. Epic 7 added the Playwright E2E testing framework with ~34 tests covering the v1 surface. The app is a single Fastify process serving a vanilla HTML/CSS/JS frontend — no component frameworks, no build-time bundling for the frontend beyond esbuild.

Epic 8 (Package Format Foundation) creates the package library: a manifest parser that converts a markdown file with YAML frontmatter and nested link lists into structured navigation data (`ManifestMetadata`, `NavigationNode`, `ParsedManifest`), plus tar read/write utilities for `.mpk` (uncompressed tar) and `.mpkz` (gzip-compressed tar) files, and a package creation function that assembles directories into packages. Epic 8 produces a standalone library — it has no knowledge of the viewer, the Fastify server, or the client. Epic 9 is the integration layer: it teaches the viewer to consume Epic 8's library.

The integration touches both server and client. The server gains a new package service that wraps Epic 8's library with temp directory management, active package state tracking, and stale detection. Four new REST endpoints expose package operations (`open`, `manifest`, `create`, `export`). The client gains a package-mode sidebar that replaces the filesystem tree with manifest-driven navigation, mode switching logic, menu bar extensions (Open Package, New Package, Export Package), and a stale indicator for extracted packages. The existing rendering, editing, file-watching, and tab management infrastructure works unchanged on files from extracted packages — the key insight is that once a package is extracted to a temp directory, the viewer's existing file operations work transparently on the extracted content via absolute paths.

This dual-domain scope — server package service + client sidebar mode — drives the Config B output structure. The server companion details the package service architecture, route implementations, and temp directory lifecycle. The client companion details the sidebar mode switch, menu integration, and UI indicators. The test plan maps all 67 TCs to specific test files and approaches.

The design is constrained by the Technical Architecture document's decisions: extract-to-temp strategy (no streaming reads from tar), single Fastify process, vanilla JS frontend, and the existing session persistence pattern at `~/Library/Application Support/md-viewer/session.json`. The manifest file name convention (`_nav.md`, `_index.md`, or `manifest.md`) is settled by Epic 8's tech design — this design assumes a single canonical name is available as a constant from Epic 8's library.

---

## System View

### System Context

The package viewer integration adds a new content abstraction layer between the user and the filesystem. In filesystem mode (the existing behavior), the sidebar shows a direct scan of the directory tree. In package mode, the sidebar shows a manifest-driven navigation tree over content that may live in a temp directory (extracted packages) or on disk (directory-mode packages). The server mediates this: it extracts packages, parses manifests, tracks the active package state, and manages temp directory lifecycle. The client switches its sidebar rendering based on the server's response.

```
┌───────────────────────────────────────────────────────────────┐
│ Browser / Electron                                            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Vanilla JS Frontend                                      │ │
│  │  Menu Bar ─── File: Open Package, New Package,           │ │
│  │  │            Export Package (new items)                  │ │
│  │  │                                                       │ │
│  │  Sidebar ─── [filesystem mode] File Tree (existing)      │ │
│  │  │           [package mode]    Manifest Nav (new)        │ │
│  │  │           Mode indicator + stale indicator            │ │
│  │  │                                                       │ │
│  │  Tabs ─── Tab Strip + Content Area + Editor (unchanged)  │ │
│  └────────────────────────┬─────────────────────────────────┘ │
│                           │ HTTP + WS                         │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────┐
│ Fastify Server            │                                   │
│  ┌────────────────────────┴──────────────────────────────────┐│
│  │ REST API                                                  ││
│  │  Existing: /api/session, /api/tree, /api/file/*,          ││
│  │           /api/export, /api/render, /ws                   ││
│  │  New:     /api/package/open, /api/package/manifest,       ││
│  │           /api/package/create, /api/package/export        ││
│  ├───────────────────────────────────────────────────────────┤│
│  │ Services                                                  ││
│  │  Existing: SessionService, FileService, TreeService,      ││
│  │            WatchService, RenderService, ExportService     ││
│  │  New:     PackageService (wraps Epic 8 library)           ││
│  │           TempDirManager (lifecycle for extracted pkgs)   ││
│  ├───────────────────────────────────────────────────────────┤│
│  │ Epic 8 Library (external dependency)                      ││
│  │  ManifestParser, TarReader, TarWriter, PackageCreator     ││
│  └────────────────────────┬──────────────────────────────────┘│
│                           │                                   │
│           ┌───────────────┼───────────────┐                   │
│           │               │               │                   │
│     Local Filesystem    Temp Dir     Epic 8 Library           │
│     (folders, files)    (extracted   (tar, manifest)          │
│     (dir-mode pkgs)      packages)                            │
└───────────────────────────────────────────────────────────────┘
```

### Data Flow: Package Open

The central flow — opening a `.mpk`/`.mpkz` file — illustrates how all components interact:

1. User triggers open (File menu, CLI argument, or drag-and-drop)
2. Client sends `POST /api/package/open { filePath }` to server
3. Server's PackageService calls Epic 8's `extractPackage()` to unpack tar to a temp directory
4. Server calls Epic 8's `parseManifest()` on the manifest file (if found) in the extracted root
5. Server stores active package state (source path, extracted root, format, manifest status)
6. Server returns `PackageOpenResponse` with metadata, navigation tree, and package info
7. Client receives response, stores package state, switches sidebar to package mode
8. Subsequent file reads use existing `/api/file?path=<extractedRoot>/relative/path.md`
9. File tree (for fallback mode) uses existing `/api/tree?root=<extractedRoot>`

The key architectural insight is that **existing endpoints work transparently on extracted content**. The temp directory is just another directory on disk. The package service's job is to create that directory, track its lifecycle, and parse the manifest — not to mediate every file operation.

### External Contracts (Epic 8 Library)

Epic 9 depends on these interfaces from Epic 8's library:

| Interface | Purpose | Used By |
|-----------|---------|---------|
| `extractPackage(filePath, targetDir)` | Unpack .mpk/.mpkz to directory | PackageService.open() |
| `parseManifest(content)` | Parse manifest markdown → ParsedManifest | PackageService.open(), manifest re-sync |
| `createPackage(sourceDir, outputPath, options)` | Create .mpk/.mpkz from directory | PackageService.export() |
| `scaffoldManifest(rootDir, options)` | Generate manifest from discovered files | PackageService.create() |
| `MANIFEST_FILENAME` | Canonical manifest file name constant | PackageService (manifest detection) |
| `ManifestMetadata` | Title, version, author, description, status | Response types, client display |
| `NavigationNode` | Display name, file path, children, isGroup | Sidebar navigation tree |
| `ParsedManifest` | Metadata + navigation + raw content | Package open response |

### REST API Surface

Four new endpoints under `/api/package/`:

| Endpoint | Method | Purpose | ACs |
|----------|--------|---------|-----|
| `/api/package/open` | POST | Extract package, parse manifest, return nav tree | AC-1.1, AC-1.2, AC-1.3, AC-8.1 |
| `/api/package/manifest` | GET | Re-fetch current package's parsed manifest | AC-6.2, AC-6.3, AC-6.4 |
| `/api/package/create` | POST | Scaffold manifest in directory | AC-4.1, AC-4.2, AC-4.3, AC-8.3 |
| `/api/package/export` | POST | Export root/package to .mpk/.mpkz | AC-5.1, AC-5.2, AC-5.3 |

The fifth endpoint from the epic (`GET /api/package/file`) is eliminated — existing `/api/file` handles file reads via absolute paths (see Spec Validation).

### Session State Extension

The existing `SessionState` in `schemas/index.ts` needs extension to persist package state across restarts. When the user closes the app with a package open, reopening should restore that package. The extension adds an optional `activePackage` field:

```typescript
// Addition to SessionStateSchema
activePackage: z.object({
  sourcePath: AbsolutePathSchema,     // original .mpk/.mpkz path
  extractedRoot: AbsolutePathSchema,  // temp directory
  format: z.enum(['mpk', 'mpkz']),
  mode: z.enum(['extracted', 'directory']),
  stale: z.boolean(),
  manifestStatus: z.enum(['present', 'missing', 'unreadable']),
}).nullable().default(null),
```

When `activePackage` is non-null, the client opens in package mode on bootstrap. When `mode` is `'directory'`, the `sourcePath` is the directory root (no temp dir), and `extractedRoot` equals `sourcePath`. The `stale` flag persists across restarts for extracted packages. The `manifestStatus` field persists so the client can restore the correct sidebar mode on startup (package mode vs fallback mode) without waiting for a manifest re-parse. The server's `PackageService.restore()` re-parses the manifest anyway and may update `manifestStatus` if the manifest changed since the last session.

### Runtime Prerequisites

| Prerequisite | Where Needed | How to Verify |
|---|---|---|
| Epic 8 library (manifest parser, tar utilities) | Server | Import resolves; types available |
| Node.js v25.x (or >=18) | Local + CI | `node --version` |
| `npm run build` (client + server built) | Before E2E | `ls app/dist/client/index.html` |
| Playwright Chromium browser | E2E tests | `npx playwright install chromium` |

---

## Module Architecture Overview

### New Server Modules

```
app/src/server/
├── services/
│   ├── package.service.ts          # NEW: Package operations (open, create, export, manifest)
│   └── temp-dir.service.ts         # NEW: Temp directory lifecycle management
├── routes/
│   └── package.ts                  # NEW: /api/package/* route handlers
├── schemas/
│   └── package.ts                  # NEW: Zod schemas for package request/response types
└── utils/
    └── errors.ts                   # MODIFIED: Add package-specific error codes
```

### New Client Modules

```
app/src/client/
├── components/
│   ├── package-sidebar.ts          # NEW: Package-mode sidebar (manifest nav tree)
│   ├── package-header.ts           # NEW: Package metadata display + stale indicator
│   ├── menu-bar.ts                 # MODIFIED: Add Open Package, New Package, Export Package
│   └── sidebar.ts                  # MODIFIED: Mode switching (delegate to file-tree or package-sidebar)
├── state.ts                        # MODIFIED: Add package state fields to ClientState
└── app.ts                          # MODIFIED: Package bootstrap, menu actions, mode switching
```

### Module Responsibility Matrix

| Module | Status | Responsibility | Dependencies | ACs Covered |
|--------|--------|----------------|--------------|-------------|
| `package.service.ts` | NEW | Package open, create, export, manifest re-parse; active package state; stale tracking | Epic 8 library, TempDirManager, fs | AC-1.1–1.5, AC-4.1–4.4, AC-5.1–5.4, AC-6.2–6.4, AC-7.1–7.2, AC-8.1–8.3, AC-9.1–9.2 |
| `temp-dir.service.ts` | NEW | Create temp dirs, track active temp dir, cleanup on switch/close, startup stale cleanup | fs, os | AC-9.1, AC-9.2 |
| `package.ts` (routes) | NEW | HTTP handlers for /api/package/* endpoints; request validation; error responses | PackageService, Zod schemas | AC-1.1, AC-4.1–4.2, AC-5.1–5.3, AC-6.2–6.4 |
| `package.ts` (schemas) | NEW | Zod schemas for package request/response types; error codes | Zod, Epic 8 types | (supports all package ACs) |
| `errors.ts` | MODIFIED | Add package-specific error codes and error classes | — | (supports all package error paths) |
| `package-sidebar.ts` | NEW | Render manifest navigation tree; handle group collapse/expand; entry click → file open | StateStore, DOM | AC-1.4, AC-1.5, AC-2.1, AC-2.2, AC-2.3 |
| `package-header.ts` | NEW | Render package metadata (title, version, author); mode indicator; stale indicator | StateStore, DOM | AC-2.1, AC-2.2, AC-7.2 |
| `sidebar.ts` | MODIFIED | Mode switching: render file-tree or package-sidebar based on active mode | StateStore, file-tree, package-sidebar | AC-3.1, AC-3.2, AC-3.3 |
| `menu-bar.ts` | MODIFIED | Add File menu items: Open Package, New Package, Export Package | StateStore, MenuBarActions | AC-1.1, AC-4.1, AC-5.1 |
| `state.ts` | MODIFIED | Add `packageState` to ClientState | — | (supports all package ACs) |
| `app.ts` | MODIFIED | Package bootstrap, action wiring, CLI argument handling | ApiClient, StateStore, all components | AC-1.3, AC-3.1–3.3 |
| `session.service.ts` | MODIFIED | Persist/restore `activePackage` field | fs | AC-9.1, AC-9.2 (session extension) |
| `schemas/index.ts` | MODIFIED | Add `activePackage` to SessionStateSchema | Zod | (supports session persistence) |

### Component Interaction

```
                    ┌─────────────────┐
                    │     app.ts      │
                    │  (orchestrator) │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────┴────┐      ┌──────┴──────┐     ┌──────┴──────┐
    │ menu-bar│      │   sidebar   │     │  tab-strip  │
    │(modified)│      │ (modified) │     │ (unchanged) │
    └────┬────┘      └──────┬──────┘     └─────────────┘
         │                   │
         │           ┌───────┴───────┐
         │           │               │
         │    ┌──────┴──────┐ ┌──────┴───────┐
         │    │  file-tree  │ │package-sidebar│
         │    │ (existing)  │ │   (new)       │
         │    └─────────────┘ └──────┬────────┘
         │                           │
         │                    ┌──────┴──────┐
         │                    │package-header│
         │                    │   (new)      │
         │                    └─────────────┘
         │
    ┌────┴──────────────────────────────────┐
    │           ApiClient                    │
    │  POST /api/package/open               │
    │  GET  /api/package/manifest            │
    │  POST /api/package/create              │
    │  POST /api/package/export              │
    └────────────────┬──────────────────────┘
                     │ HTTP
    ┌────────────────┴──────────────────────┐
    │           Fastify Server               │
    │  package routes → PackageService       │
    │                   → TempDirManager     │
    │                   → Epic 8 Library     │
    └────────────────────────────────────────┘
```

---

## Verification Scripts

The existing verification scripts from Epic 7 apply unchanged. No new verification tiers are needed — package viewer integration is standard application code that goes through the established TDD pipeline.

| Script | Command | Purpose |
|--------|---------|---------|
| `red-verify` | `npm run format:check && npm run lint && npm run typecheck && npm run typecheck:client` | TDD Red exit — stubs compile, tests expected to fail |
| `verify` | `npm run red-verify && npm run test` | Standard development gate |
| `green-verify` | `npm run verify && npm run guard:no-test-changes` | TDD Green exit — tests pass, test files not modified |
| `verify-all` | `npm run verify && npm run test:e2e` | Full gate including E2E |

Package-specific Vitest tests go in `tests/server/package/` and `tests/client/package/`. E2E tests go in `tests/e2e/package.spec.ts`. All are picked up by existing config globs.

---

## Work Breakdown: Chunks and Phases

### Summary

| Chunk | Scope | ACs | Test Count | Running Total |
|-------|-------|-----|------------|---------------|
| 0 | Infrastructure | (setup) | 4 | 4 |
| 1 | Open Package + Package Sidebar | AC-1.1, 1.4, 1.5, 2.1–2.3 | 20 | 24 |
| 2 | Mode Switching + Additional Open Methods | AC-1.2, 1.3, 3.1–3.3 | 10 | 34 |
| 3 | Package Creation | AC-4.1–4.4 | 9 | 43 |
| 4 | Export to Package | AC-5.1–5.4 | 10 | 53 |
| 5 | Manifest Editing | AC-6.1–6.4 | 10 | 63 |
| 6 | Extracted Package Editing + Stale | AC-7.1–7.2 | 6 | 69 |
| 7 | No-Manifest Fallback + Cleanup | AC-8.1–8.3, 9.1–9.2 | 11 | 80 |
| **Total** | | **30 ACs** | **80 tests** | |

### Chunk 0: Infrastructure (Foundation)

**Scope:** Package-related Zod schemas, error codes, `NotImplementedError` class (does not exist in the codebase yet — add to `errors.ts`), PackageService skeleton with `NotImplementedError` stubs, TempDirManager skeleton, package route stubs returning 501, session state extension for `activePackage`, client state extension for `packageState`, E2E test fixtures (sample .mpk and .mpkz files with known manifest content).

**ACs:** None directly testable — infrastructure only. Prepares for AC-9.1, AC-9.2.

**Relevant Tech Design Sections:** System View (Session State Extension, REST API Surface), Module Architecture (all modules listed), Server Companion (Schemas, Error Codes, PackageService skeleton), Client Companion (Client State Extension), Test Plan (Fixtures)

**Non-TC Decided Tests:** Schema validation tests for new Zod schemas (PackageOpenRequestSchema, PackageOpenResponseSchema, etc.) — 4 tests verifying schema parse/reject behavior.

**Files:**
- `app/src/server/schemas/package.ts` (new)
- `app/src/server/services/package.service.ts` (new — stubs)
- `app/src/server/services/temp-dir.service.ts` (new — stubs)
- `app/src/server/routes/package.ts` (new — 501 stubs)
- `app/src/server/utils/errors.ts` (modified — new error codes)
- `app/src/server/schemas/index.ts` (modified — session state extension)
- `app/src/server/app.ts` (modified — register package routes)
- `app/src/shared/types.ts` (modified — re-export package types)
- `app/src/client/state.ts` (modified — add packageState)
- `app/tests/fixtures/packages/` (new — sample .mpk, .mpkz, manifest files)
- `app/tests/server/package/schemas.test.ts` (new)

**Exit Criteria:** `npm run red-verify` passes. Route stubs return 501. Schemas validate/reject correctly.

**Test Count:** 4 tests (schema validation)

### Chunk 1: Open Package + Package-Mode Sidebar

**Scope:** The core flow: open a `.mpk`/`.mpkz` via File menu, extract, parse manifest, switch sidebar to package mode with manifest navigation. Click navigation entries to open documents. Group labels. Package metadata display. Mode indicator.

**ACs:** AC-1.1, AC-1.4, AC-1.5, AC-2.1, AC-2.2, AC-2.3

**TCs:** TC-1.1a–c, TC-1.4a–e, TC-1.5a–b, TC-2.1a–c, TC-2.2a–b, TC-2.3a–c

**Relevant Tech Design Sections:** System View (Data Flow: Package Open), Server Companion (PackageService.open, TempDirManager.create, Route: POST /api/package/open, Flow 1: Open Package), Client Companion (Sidebar Mode Architecture, Package Sidebar Component, Package Header, Flow 1: Open Package Client)

**Non-TC Decided Tests:** Integration test for PackageService.open() with a real .mpk fixture file — verifies the full extraction + manifest parse pipeline. 1 test.

**Files:**
- `app/src/server/services/package.service.ts` (implement open)
- `app/src/server/services/temp-dir.service.ts` (implement create)
- `app/src/server/routes/package.ts` (implement POST /api/package/open)
- `app/src/client/components/package-sidebar.ts` (new)
- `app/src/client/components/package-header.ts` (new)
- `app/src/client/components/sidebar.ts` (modified — mode switching)
- `app/src/client/components/menu-bar.ts` (modified — Open Package item)
- `app/src/client/state.ts` (already extended in Chunk 0)
- `app/src/client/app.ts` (modified — package open action, sidebar mode wiring)
- `app/tests/server/package/package-service.test.ts` (new)
- `app/tests/client/package/package-sidebar.test.ts` (new)

**Prerequisite:** Chunk 0

**Exit Criteria:** User can open a .mpk file via File menu and see manifest navigation. Clicking entries opens documents. Group labels work. Metadata displays. `verify` passes.

**Test Count:** 20 tests (18 TC-mapped + 2 non-TC: 1 integration round-trip, 1 sidebar render performance)
**Running Total:** 24 tests

### Chunk 2: Mode Switching + Additional Open Methods

**Scope:** Switching between package and filesystem modes. Opening packages via drag-and-drop and CLI argument. Replacing one package with another.

**ACs:** AC-1.2, AC-1.3, AC-3.1, AC-3.2, AC-3.3

**TCs:** TC-1.2a–b, TC-1.3a–c, TC-3.1a–b, TC-3.2a, TC-3.3a, TC-9.1a (temp dir cleanup on switch — also tested in Chunk 7's TempDirManager context)

**Relevant Tech Design Sections:** Server Companion (CLI Argument Detection, TempDirManager cleanup on switch), Client Companion (Mode Switching Flow, Drag-and-Drop Flow)

**Non-TC Decided Tests:** None.

**Files:**
- `app/src/server/index.ts` (modified — CLI argument detection)
- `app/src/server/services/temp-dir.service.ts` (implement cleanup on switch)
- `app/src/client/components/sidebar.ts` (mode switch logic)
- `app/src/client/app.ts` (modified — drag-and-drop handler, mode switch actions)
- `app/tests/server/package/mode-switching.test.ts` (new)
- `app/tests/client/package/mode-switching.test.ts` (new)

**Prerequisite:** Chunk 1

**Exit Criteria:** Mode switching works bidirectionally. CLI argument opens package. Drag-and-drop works (Electron path or best-effort browser). Replacing packages cleans up temp dir. `verify` passes.

**Test Count:** 10 tests
**Running Total:** 34 tests

### Chunk 3: Package Creation

**Scope:** File → New Package scaffolds a manifest, switches to package mode. Handles existing manifest (overwrite confirmation), empty directories, disabled for extracted packages with parseable manifest.

**ACs:** AC-4.1, AC-4.2, AC-4.3, AC-4.4

**TCs:** TC-4.1a–d, TC-4.2a–b, TC-4.3a, TC-4.4a

**Relevant Tech Design Sections:** Server Companion (PackageService.create, Route: POST /api/package/create, Flow 4: Package Creation), Client Companion (New Package Menu Item, Overwrite Confirmation)

**Non-TC Decided Tests:** Server test for scaffoldManifest with nested directories (verifies recursive discovery). 1 test.

**Files:**
- `app/src/server/services/package.service.ts` (implement create)
- `app/src/server/routes/package.ts` (implement POST /api/package/create)
- `app/src/client/components/menu-bar.ts` (New Package item, disabled state)
- `app/src/client/app.ts` (create package action, overwrite confirmation)
- `app/tests/server/package/package-create.test.ts` (new)
- `app/tests/client/package/package-create.test.ts` (new)

**Prerequisite:** Chunk 1

**Exit Criteria:** File → New Package works. Overwrite confirmation works. Empty dir produces empty manifest. Disabled for extracted packages. `verify` passes.

**Test Count:** 9 tests (8 TC-mapped + 1 non-TC)
**Running Total:** 43 tests

### Chunk 4: Export to Package

**Scope:** Export current root/package to .mpk/.mpkz. Format selection, auto-scaffold for folders without manifest, re-export of extracted packages with stale indicator clearing, cancel flow.

**ACs:** AC-5.1, AC-5.2, AC-5.3, AC-5.4

**TCs:** TC-5.1a–c, TC-5.2a–b, TC-5.3a–c, TC-5.4a

**Relevant Tech Design Sections:** Server Companion (PackageService.export, Route: POST /api/package/export, Flow 5: Export), Client Companion (Export Package Menu, Save Dialog Format Selection, Stale Indicator Clearing)

**Non-TC Decided Tests:** Server test verifying exported .mpk can be re-opened (round-trip integrity). 1 test.

**Files:**
- `app/src/server/services/package.service.ts` (implement export)
- `app/src/server/routes/package.ts` (implement POST /api/package/export)
- `app/src/client/components/menu-bar.ts` (Export Package item)
- `app/src/client/app.ts` (export action, save dialog, stale clearing)
- `app/tests/server/package/package-export.test.ts` (new)
- `app/tests/client/package/package-export.test.ts` (new)

**Prerequisite:** Chunk 1 (package open), Chunk 6 (stale indicator — for TC-5.3b/c)

**Note:** TC-5.3b and TC-5.3c depend on the stale indicator from Chunk 6. These two tests can be deferred to after Chunk 6, or Chunk 4 and 6 can be implemented in sequence with the stale-related export tests added at the end of Chunk 6.

**Exit Criteria:** Export to .mpk/.mpkz works. Auto-scaffold works. Re-export captures modifications. Cancel works. `verify` passes.

**Test Count:** 10 tests (9 TC-mapped + 1 non-TC round-trip)
**Running Total:** 53 tests

### Chunk 5: Manifest Editing + Sidebar Re-Sync

**Scope:** Open manifest in editor, edit, save, sidebar re-syncs. Error handling for malformed manifest. Empty navigation warning.

**ACs:** AC-6.1, AC-6.2, AC-6.3, AC-6.4

**TCs:** TC-6.1a–b, TC-6.2a–d, TC-6.3a, TC-6.4a

**Relevant Tech Design Sections:** Server Companion (Route: GET /api/package/manifest, Manifest Re-Parse, Flow 6: Manifest Editing), Client Companion (Manifest Re-Sync Strategy, Edit Manifest Action)

**Non-TC Decided Tests:** Server test for manifest re-parse with deeply nested hierarchy (3+ levels). Client test for sidebar re-render performance with 100+ entries. 2 tests.

**Files:**
- `app/src/server/services/package.service.ts` (implement getManifest)
- `app/src/server/routes/package.ts` (implement GET /api/package/manifest)
- `app/src/client/components/package-sidebar.ts` (re-render on manifest change)
- `app/src/client/components/package-header.ts` (edit manifest action button)
- `app/src/client/app.ts` (manifest save → re-sync trigger)
- `app/tests/server/package/package-manifest.test.ts` (new)
- `app/tests/client/package/manifest-editing.test.ts` (new)

**Prerequisite:** Chunk 1

**Exit Criteria:** Manifest editing → sidebar re-sync works. Malformed YAML shows error, sidebar retains previous state. Empty manifest shows warning. `verify` passes.

**Test Count:** 10 tests (8 TC-mapped + 2 non-TC)
**Running Total:** 63 tests

### Chunk 6: Extracted Package Editing + Stale Indicator

**Scope:** Edit files in extracted packages (temp dir). Stale indicator appears when content modified. Not shown for directory-mode packages.

**ACs:** AC-7.1, AC-7.2

**TCs:** TC-7.1a–b, TC-7.2a–c

**Relevant Tech Design Sections:** Server Companion (Stale Tracking, PackageService.markStale), Client Companion (Stale Indicator Component, Stale State in ClientState)

**Non-TC Decided Tests:** Server test verifying stale flag persists in session state across restarts. 1 test.

**Files:**
- `app/src/server/services/package.service.ts` (stale tracking)
- `app/src/client/components/package-header.ts` (stale indicator display)
- `app/src/client/app.ts` (stale detection on file save in package mode)
- `app/tests/server/package/stale-tracking.test.ts` (new)
- `app/tests/client/package/stale-indicator.test.ts` (new)

**Prerequisite:** Chunk 1

**Exit Criteria:** Edits in extracted packages modify temp dir. Stale indicator appears. Not shown for directory-mode. `verify` passes.

**Test Count:** 6 tests (5 TC-mapped + 1 non-TC session persistence)
**Running Total:** 69 tests

### Chunk 7: No-Manifest Fallback + Temp Cleanup

**Scope:** Filesystem fallback for packages without manifests. "No manifest" and "unreadable manifest" indicators. Scaffold manifest in fallback mode. Temp directory cleanup on package switch and app startup.

**ACs:** AC-8.1, AC-8.2, AC-8.3, AC-9.1, AC-9.2

**TCs:** TC-8.1a–c, TC-8.2a–c, TC-8.3a–b, TC-9.1a, TC-9.2a

**Relevant Tech Design Sections:** Server Companion (TempDirManager cleanup, Startup Cleanup, Flow 8: No-Manifest Fallback), Client Companion (Fallback Mode Sidebar, Fallback Indicators, Scaffold in Fallback)

**Non-TC Decided Tests:** Server test for startup cleanup with multiple stale temp dirs. 1 test.

**Files:**
- `app/src/server/services/temp-dir.service.ts` (implement cleanup, startup cleanup)
- `app/src/server/services/package.service.ts` (fallback handling on open)
- `app/src/client/components/sidebar.ts` (fallback mode rendering)
- `app/src/client/components/package-header.ts` (fallback indicators)
- `app/src/client/app.ts` (scaffold in fallback mode action)
- `app/tests/server/package/temp-cleanup.test.ts` (new)
- `app/tests/server/package/fallback.test.ts` (new)
- `app/tests/client/package/fallback.test.ts` (new)

**Prerequisite:** Chunk 1, Chunk 3 (for manifest scaffolding in fallback mode)

**Exit Criteria:** No-manifest packages show filesystem fallback. Indicators display correctly. Scaffold manifest in fallback mode works. Temp dirs cleaned up on switch and startup. `verify` passes.

**Test Count:** 11 tests (10 TC-mapped + 1 non-TC)
**Running Total:** 80 tests

### Chunk Dependencies

```
Chunk 0 (Infrastructure)
    │
    └── Chunk 1 (Open Package + Sidebar)
            │
            ├── Chunk 2 (Mode Switching)
            │
            ├── Chunk 3 (Package Creation)
            │       │
            │       └── Chunk 7 (Fallback + Cleanup) [also needs Chunk 1]
            │
            ├── Chunk 5 (Manifest Editing)
            │
            ├── Chunk 6 (Stale Indicator)
            │       │
            │       └── Chunk 4 (Export) [stale-clearing tests need Chunk 6]
            │
            └── Chunk 4 (Export) [core export works from Chunk 1]
```

Recommended sequence: 0 → 1 → 2 → 3 → 5 → 6 → 4 → 7. This follows the epic's story ordering and resolves the Chunk 4/6 stale dependency naturally.

---

## Self-Review Checklist

### Completeness

- [x] Every TC from epic mapped to a test file (see test-plan.md)
- [x] All interfaces fully defined (see companion docs)
- [x] Module boundaries clear — no ambiguity about what lives where
- [x] Chunk breakdown includes test count estimates and relevant tech design section references
- [x] Non-TC decided tests identified and assigned to chunks (12 total)
- [x] Skeleton stubs are copy-paste ready (see companion docs)

### Richness (The Spiral Test)

- [x] Context section is 4 paragraphs establishing rich background
- [x] External contracts from System View appear again in companion docs
- [x] Module descriptions include AC coverage references
- [x] Interface definitions include TC coverage references (companion docs)
- [x] Flows reference Context (why) and Interfaces (how) (companion docs)
- [x] Someone could enter at any section and navigate to related content

### Writing Quality

- [x] More prose than tables in explanatory sections
- [x] Lists and tables have paragraph context above them
- [x] Diagrams introduced with prose context
- [x] Sequence diagrams include AC annotations (companion docs)
- [x] No methodology labels in output headings

### Agent Readiness

- [x] File paths are exact and complete
- [x] Stub signatures are copy-paste ready (companion docs)
- [x] Test names describe user-visible outcomes (test plan)
- [x] Each section standalone-readable

### Architecture Gate

- [x] Epic 8 library dependency documented (no version pinning needed — it's internal)
- [x] Verification scripts defined (inherited from Epic 7, no changes needed)
- [x] Test segmentation: Vitest for server/client service mocks, Playwright for E2E
- [x] Error contract defined (error codes, response shapes — see server companion)
- [x] Runtime prerequisites documented

---

## Open Questions

| # | Question | Owner | Blocks | Resolution |
|---|----------|-------|--------|------------|
| Q1 | What is the manifest file name convention from Epic 8? | Epic 8 Tech Lead | Chunk 1 | Pending — design assumes `MANIFEST_FILENAME` constant from Epic 8 library |
| Q2 | Does Epic 8's `extractPackage()` handle both .mpk and .mpkz transparently? | Epic 8 Tech Lead | Chunk 1 | Expected yes — design assumes format detection by file extension |

---

## Deferred Items

| Item | Related AC | Reason Deferred | Future Work |
|------|-----------|-----------------|-------------|
| Drag-and-drop file upload in browser-only mode | AC-1.2 | Browser drag-and-drop of local files doesn't reliably expose full paths. Electron bridge provides paths. | Add multipart upload to `POST /api/package/open` for browser-only drag-and-drop |
| Package search/filter in sidebar | AC-2.3 | Not in scope — sidebar search is a future enhancement | Consider for v3 |
| Multiple packages open simultaneously | AC-3.3 | Epic scopes to one active package at a time | Future enhancement |
| Temp dir size monitoring | AC-9.1 | Not in scope — cleanup on switch is sufficient for current package sizes | Add if package sizes grow |

---

## Related Documentation

- Epic: `epic.md`
- Server Companion: `tech-design-server.md`
- Client Companion: `tech-design-client.md`
- Test Plan: `test-plan.md`
- Technical Architecture: `../../technical-architecture.md`
- Epic 8 (Package Format Foundation): `../08--package-format-foundation/epic.md`
