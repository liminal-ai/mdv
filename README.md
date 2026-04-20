# mdv

`mdv` is a local-first markdown workspace application.

It runs in two modes:

- **Desktop-first:** an Electron app with native desktop shell behavior
- **Web fallback:** a locally hosted browser app served by the same Fastify backend

The core idea is simple: the UI, the server, and the files are assumed to live on the same machine. This is not a remote multi-user web app. It is a local markdown tool that happens to have both a desktop shell and a browser surface.

## Current Status

The app is currently in a strong working state for:

- reading and rendering markdown
- editing and saving markdown files
- tabbed document workflows
- local workspace browsing
- Mermaid/code/table/image rendering
- document export
- markdown package creation/open/export
- Electron desktop packaging on macOS

The codebase has recently gone through a few meaningful cleanup phases:

- developer workflow and verification hardening
- frontend orchestration refactor
- shared contract / schema boundary cleanup
- GitHub Actions CI setup

This means the app is not just feature-capable; it is also in a much better state for ongoing maintenance and future work.

## What mdv Can Do

### Markdown Workspace Experience

- Open a folder and browse markdown files in a tree
- Open multiple files in tabs
- Switch between render and edit modes
- Save in place or Save As
- Track dirty state and surface save conflicts
- Persist tabs, theme, and workspace state across reload/restart

### Rendering

- Markdown rendering via `markdown-it`
- Syntax highlighting via `shiki`
- Mermaid diagram rendering
- Relative image support
- Relative markdown link navigation
- Large-file rendering safeguards

### Export

- Export an open markdown document as:
  - `HTML`
  - `PDF`
  - `DOCX`
- Track export progress and result state in the UI
- Surface export warnings and degraded-output cases

### Markdown Packages

`mdv` includes a package format for sharing structured markdown workspaces:

- `.mpk`
- `.mpkz`

Current package capabilities include:

- open a package into the viewer
- create a package manifest from a workspace
- export a workspace or extracted package back into `.mpk` / `.mpkz`
- inspect and manipulate packages through the CLI

### Desktop Shell

In Electron mode the app supports:

- native file/folder/package/save dialogs
- desktop menu integration
- file association packaging for markdown documents on macOS
- open-file routing into the running app
- desktop packaging validation via CI and local tooling

## Architecture

At a high level the app is split into four runtime areas:

- **Client**
  - vanilla TypeScript/HTML/CSS frontend
  - tabbed markdown reading/editing experience
  - local shell orchestration
- **Server**
  - Fastify API + static hosting
  - filesystem access
  - rendering/export/package services
- **Electron**
  - desktop shell around the same local server
  - preload bridge, menus, window lifecycle, native dialogs
- **Package library**
  - standalone `.mpk` / `.mpkz` creation, extraction, reading, inspection

The client is now organized around a small set of top-level capability modules:

- `app-shell`
- `workspace`
- `documents`
- `packages`
- `exports`
- `integrations`

That structure is meant to keep the app human-readable while still giving future automation and agentic workflows clean seams to operate on.

## Repository Layout

```text
src/
  client/      Frontend app, state, modules, components, styles
  electron/    Electron main/preload/menu/window integration
  pkg/         Package format library and CLI
  server/      Fastify app, routes, services
  shared/      Shared cross-runtime contracts

tests/
  client/      Frontend and client integration tests
  e2e/         Playwright browser end-to-end tests
  electron/    Electron entrypoint/integration-style tests
  pkg/         Package library and CLI tests
  server/      Server route/service tests
```

## Runtime Model

`mdv` is intentionally **local-first**.

That means:

- the backend server is expected to run on the same machine as the UI
- file paths are local absolute paths
- file watching is local
- export destinations are local
- the browser mode is a local companion runtime, not a hosted SaaS-style client

This is an important design constraint and explains many choices in the repo.

## Quick Start

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

### Run Web Mode

```bash
npm start
```

By default this starts the Fastify app on a local port and serves the browser UI.

## Desktop / Electron

### Local Electron Build

```bash
npm run build:electron
```

### Local Electron Dev Loop

```bash
npm run dev:electron
```

### Package for macOS

```bash
npm run package:mac
```

### Package for Windows

Build a Windows installer for the current machine architecture:

```bash
npm run package:win
```

Build an explicit Windows installer target:

```bash
npm run package:win:x64
npm run package:win:arm64
```

Build an unpacked Windows app directory for smoke testing:

```bash
npm run package:win:dir
```

Build both Windows installer architectures:

```bash
npm run package:win:all
```

### Install into `~/Applications`

```bash
npm run install-app
```

## Development

### Web Dev Loop

```bash
npm run dev
```

Equivalent:

```bash
npm run dev:web
```

### Quality Gates

Fast lane:

```bash
npm run verify
```

Heavy lane:

```bash
npm run verify-all
```

`verify` covers:

- build
- Electron bundle sanity
- lint
- server/client/Electron typecheck
- full Vitest suite

`verify-all` adds:

- Playwright E2E
- host-platform desktop packaging
- packaged archive smoke validation

### Focused Commands

```bash
npm run test
npm run test:client
npm run test:server
npm run test:electron
npm run test:e2e
npm run typecheck
npm run typecheck:client
npm run typecheck:electron
```

## CLI

The repo ships a package CLI as `mdvpkg`.

Examples:

```bash
npx mdvpkg create ./docs -o docs.mpk
npx mdvpkg info docs.mpk
npx mdvpkg ls docs.mpk
npx mdvpkg extract docs.mpk -o ./out
npx mdvpkg manifest docs.mpk
```

## Testing Strategy

The project uses layered validation:

- **Vitest**
  - server routes/services
  - client integration-style tests
  - Electron entrypoint tests
  - package library / CLI tests
- **Playwright**
  - browser end-to-end coverage for shared user behavior
- **Exploratory QA**
  - broader real-use probing outside deterministic scripts

Exploratory QA guidance lives in:

- [exploratory-qa-approach.md](./docs/exploratory-qa-approach.md)

Transient exploratory artifacts are meant to live outside the repo by default. Useful helpers:

```bash
npm run qa:prepare
npm run qa:clean -- --days 7
```

## CI

GitHub Actions CI now mirrors the local lanes with three checks:

- `verify`
- `e2e`
- `package-mac`

This keeps local and CI expectations aligned instead of inventing a separate CI-only workflow.

## What Is Still Opinionated / In Progress

This is a serious working app, but it is still actively evolving.

A few important notes for anyone learning from or building on it:

- **Desktop-first, not cloud-first**
  - the product posture is local-first and desktop-primary
- **Web mode is intentional**
  - but it is a local fallback/runtime surface, not a remote hosted app model
- **macOS is the strongest desktop target today**
  - Windows packaging now exists, but macOS is still the most battle-tested desktop path
- **Exports and packages are active growth areas**
  - those parts of the system are implemented and useful today, but they are also the most likely places to evolve next

## If You Are Studying the Repo

If your goal is to learn from the codebase, the best places to start are:

1. [src/client/app.ts](./src/client/app.ts)
   - the current composition root
2. [src/server/app.ts](./src/server/app.ts)
   - the Fastify composition root
3. [src/shared/contracts](./src/shared/contracts)
   - the shared API contract source of truth
4. [src/client/documents](./src/client/documents)
   - the core document workflow
5. [src/client/packages](./src/client/packages)
   - the package-mode feature area
6. [src/client/exports](./src/client/exports)
   - the export workflow state and logic

If you want the highest-signal understanding quickly:

- read the top-level modules
- run `npm run verify`
- run the app in both `web` and `electron` modes
- inspect the Playwright and client test suites alongside the code

## License / Ownership

This repository is currently maintained as an active project workspace rather than a packaged public product. Treat the code and workflow choices as practical engineering decisions for a living app, not as a frozen framework.
