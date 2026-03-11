# Preliminary Spec Build

This folder contains the first-pass planning artifacts for the next shape of the markdown viewer project. These documents are intentionally early and directional. They are meant to support product framing, mock creation, and downstream spec generation.

## Documents In This Folder

### [technical-architecture-overview.md](/Users/leemoore/code/md-viewer/docs/spec-build/01--preliminary/technical-architecture-overview.md)

High-level recommended architecture for the next version of the application.

Current recommendation:

- local-first application
- single deployable unit
- Fastify runtime
- vanilla HTML/CSS/JS frontend
- shared `core` domain/render/export logic
- optional Electron shell later as a thin wrapper rather than the center of the product

This document is intended to frame the stack, runtime model, top-level components, and provisional boundaries between client, server, shared core, and export adapters.

### [prd-first-pass.md](/Users/leemoore/code/md-viewer/docs/spec-build/01--preliminary/prd-first-pass.md)

First-pass product framing focused on:

- user profile
- use cases and flows
- high-level acceptance criteria
- recommended epic-shaped scope areas
- likely sequencing of those epic areas

This is not a final PRD. It is meant to be refined after scripted mockups are created and reviewed.

### [scripted-mockup-inventory.md](/Users/leemoore/code/md-viewer/docs/spec-build/01--preliminary/scripted-mockup-inventory.md)

Inventory of the recommended mockup surfaces to create before detailed epic generation and technical design.

It identifies the key application states that should be visually explored, including:

- empty/launch state
- main reading workspace
- edit mode
- multi-tab usage
- folder-tree-heavy state
- warning/degraded states
- export flow
- conflict/unsaved-change modals
- narrow window state

## Historical Context Worth Preserving

These notes are useful context for future planning sessions and should be treated as working assumptions unless later product work changes them.

### 1. The Existing App Is A Real Seed, Not Throwaway Noise

The current codebase started as a fast AI-generated spike, but it has enough real value to treat as a product seed:

- markdown rendering works
- Mermaid rendering works
- export logic is already meaningful
- the app has enough structure to refactor rather than discard blindly

### 2. The Core Product Value Is Practical, Local-First Workflow

The strongest current product story is not “beautiful markdown app.”

It is:

- browse local markdown content quickly
- review documents in rendered form
- make light edits safely
- render Mermaid locally
- export to useful shareable formats

That should remain the center of product planning.

### 3. Browser-First Local App Is The Recommended Long-Term Shape

The current thinking is that the best next product architecture is:

- browser-first local application
- local Node/Fastify runtime
- API-backed filesystem and export flows
- optional Electron shell later

The main reason is to keep the app easy to run in constrained work environments while preserving a path to a desktop wrapper.

### 4. Fastify + Vanilla JS Is A Preferred Option, Not A Fallback

The current recommendation is to treat `Fastify + vanilla JS` as the default candidate architecture for the next major shape of the product.

Reasons:

- single deployable unit
- lower overhead than a React-first stack
- good fit for a local productivity tool
- fewer dependencies and less framework weight
- enough flexibility for this product space

### 5. Electron Should Become A Thin Shell If Retained

If the project continues to support Electron, the recommended role is:

- package the same app
- provide native desktop affordances later
- avoid becoming the place where the “real app” lives

The browser/local-server architecture should be the primary product shape.

### 6. Shared Core Remains Important

The existing render/export/document logic in `src/core` is worth preserving as the long-lived reusable layer.

Future planning should continue to separate:

- shared markdown/render/export domain logic
- local server concerns
- frontend presentation concerns
- optional shell concerns

### 7. The Biggest UX Design Work Is In Shell And Workflow Clarity

The current app’s main UI issues appear to be:

- crowded top-level chrome
- unclear visual hierarchy
- inconsistent density and grouping
- awkward shell coherence across toolbar, tabs, tree, and content area

The design effort should focus on workflow clarity and hierarchy before ornamental polish.

## Recommended Use Of These Docs

Suggested order:

1. use the architecture overview to anchor technical direction
2. use the PRD draft to align on user profile, workflows, and scope sequencing
3. use the mockup inventory to generate scripted mock pages
4. refine PRD and architecture based on the mock review
5. generate epics, technical design, and work breakdown from the refined set

## Current Recommendation Snapshot

If someone opens only this file, the current working recommendation is:

- keep the existing app available for local use
- plan the next generation as a browser-first local application
- prefer Fastify + vanilla JS
- retain shared render/export core logic
- use Electron later only as an optional wrapper if needed
