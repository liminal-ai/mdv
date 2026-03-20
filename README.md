# MD Viewer Repo

This repo now has two distinct roles:

- keep the current Electron prototype available and usable on this desktop
- hold the planning work and structure for the next-generation browser-first application

## Repo Layout

### [`first-pass-poc/`](/Users/leemoore/code/md-viewer/first-pass-poc)

The current working Electron prototype.

Use this folder when you want to:

- build the current desktop app
- run the current desktop app
- change or debug the current prototype
- run the existing tests for the prototype

Typical workflow:

```bash
cd first-pass-poc
npm ci
npm run dev
```

### [`docs/spec-build/01--preliminary/`](/Users/leemoore/code/md-viewer/docs/spec-build/01--preliminary)

The current first-pass planning/spec artifacts for the next product shape.

Key docs:

- [README.md](/Users/leemoore/code/md-viewer/docs/spec-build/01--preliminary/README.md)
- [technical-architecture-overview.md](/Users/leemoore/code/md-viewer/docs/spec-build/01--preliminary/technical-architecture-overview.md)
- [prd-first-pass.md](/Users/leemoore/code/md-viewer/docs/spec-build/01--preliminary/prd-first-pass.md)
- [scripted-mockup-inventory.md](/Users/leemoore/code/md-viewer/docs/spec-build/01--preliminary/scripted-mockup-inventory.md)

### [`app/`](/Users/leemoore/code/md-viewer/app)

Reserved for the next-generation browser-first implementation.

This folder is intentionally a placeholder right now.

## Current Direction

The current working direction is:

- keep `first-pass-poc/` intact as the active Electron prototype
- use the docs under `docs/spec-build/01--preliminary/` to shape the next implementation
- build the next-generation app separately from the prototype rather than mutating the prototype in place

## Prototype Commands

All prototype commands should now be run from inside [`first-pass-poc/`](/Users/leemoore/code/md-viewer/first-pass-poc).

Examples:

```bash
cd first-pass-poc
npm test
npm run build
npm run dev
```
