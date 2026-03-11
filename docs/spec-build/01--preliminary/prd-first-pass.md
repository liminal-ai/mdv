# Product Requirements Draft (First Pass)

## Status

This document is a **rough first pass**. It is intended to shape product direction and likely epic sequencing, not to act as a final authoritative PRD.

It should be refined:

- after scripted mockups are created and reviewed
- after the UX is dialed in
- immediately before formal epic creation

## Product Intent

The proposed product is a **local-first markdown workspace** for people who work with markdown documents regularly and want a fast, practical way to:

- browse local markdown files
- open and review documents quickly
- make light edits
- render Mermaid diagrams correctly
- export documents into shareable formats

The initial target is not “full writing suite” polish. The target is a **reliable, fast, good-enough markdown workstation** that reduces friction between writing, reviewing, and sharing markdown content.

## User Profile

### Primary User

A technically capable individual contributor, tech lead, architect, or developer-adjacent knowledge worker who:

- works with markdown files frequently
- keeps markdown documents in local folders or repo workspaces
- wants to open documents directly from the filesystem
- values speed and practicality over full publishing-tool sophistication
- often needs to review or lightly edit content before sharing it

### Likely Behaviors

This user is likely to:

- navigate nested folders of markdown files
- keep several documents open in parallel
- switch between “read/review” and “light edit” modes
- inspect Mermaid diagrams and code blocks in rendered form
- export documents to PDF, DOCX, or HTML for non-markdown consumers
- work in environments where installing or signing a native app may be inconvenient

### Secondary User

A collaborator, teammate, or open source user who:

- wants a local markdown viewing tool without deep setup
- may not care about native app packaging
- wants something easy to run from Node locally

## Core Use Cases And Flows

### 1. Browse Local Markdown Workspace

The user launches the app, points it at a local folder, and browses markdown files from a sidebar tree.

High-level acceptance criteria:

- the user can select a root folder
- the app shows markdown-relevant files and directories in a readable tree
- the user can expand and collapse nested folders
- the app supports pinned roots or quick-return folders
- the app handles large-enough real workspaces without feeling fragile

### 2. Open And Review Markdown Documents Quickly

The user opens one or more markdown files and reads them in rendered form.

High-level acceptance criteria:

- the user can open a document from the file tree, dialog, or direct path-based workflow
- the app supports multiple open tabs/documents
- the rendered view handles headings, lists, code, tables, images, and Mermaid diagrams in a readable way
- the app clearly communicates warnings such as missing local assets or blocked remote assets
- opening the same file twice should not create confusing duplicate state

### 3. Light Editing With Immediate Feedback

The user makes small content edits and sees updated preview output quickly.

High-level acceptance criteria:

- the user can switch between reading and editing without confusion
- edits update dirty state clearly
- preview updates happen quickly enough for practical use
- the app protects the user from losing unsaved changes
- if the file changes externally, the app offers a clear resolution path

### 4. Mermaid And Rich Markdown Rendering

The user expects diagrams and structured markdown to render predictably enough for actual work.

High-level acceptance criteria:

- Mermaid diagrams render locally and do not require remote services
- diagram failures degrade safely and visibly
- syntax highlighting is readable and stable
- tables and images render well enough for review workflows
- render behavior is deterministic enough that preview and export feel related rather than disconnected

### 5. Export To Shareable Formats

The user exports markdown to formats that are useful for non-markdown consumers.

High-level acceptance criteria:

- the user can export to PDF, DOCX, and HTML
- exports include Mermaid diagrams and local assets when possible
- page-breaking and layout heuristics are good enough to avoid obviously poor output
- warnings are surfaced when export quality is degraded by missing or unsupported content
- export should feel like a core workflow, not a bolted-on developer-only feature

### 6. Local-First Practical Operation

The user can run the app locally in constrained environments and still get value from it.

High-level acceptance criteria:

- the app runs locally without requiring a cloud service
- the app works as a local browser-served experience first
- the app architecture leaves room for an Electron wrapper later without splitting the product
- local folder/file workflows remain first-class

## High-Level Scope Recommendation

The product should likely be shaped into epic-sized scopes that follow user value and architecture risk in the same sequence.

### Recommended Epic 1: Local App Shell And Workspace Browsing

Intent:

- establish the local runtime
- define root folder selection
- define tree navigation and pinned workspace behavior

Likely outcome:

- user can launch app, choose a root, browse markdown files, and open documents

### Recommended Epic 2: Document Viewing And Multi-Tab Reading

Intent:

- make the app useful as a review tool before editing/export complexity is added

Likely outcome:

- user can open, switch, and review multiple markdown files with stable rendered output

### Recommended Epic 3: Edit Mode, Dirty State, And External Change Handling

Intent:

- add safe light editing workflows

Likely outcome:

- user can make edits, understand save state, and recover cleanly from external file changes

### Recommended Epic 4: Mermaid And Rich Content Reliability

Intent:

- harden the render pipeline around diagrams, images, code, and structured content

Likely outcome:

- rendering quality becomes dependable enough for regular use on real documents

### Recommended Epic 5: Export Workflows

Intent:

- deliver the shareable output story as a first-class capability

Likely outcome:

- user can export to PDF, DOCX, and HTML with clear warnings and decent output fidelity

### Recommended Epic 6: Local-First Hardening And Delivery Flexibility

Intent:

- make the system robust for browser-first use and future Electron wrapping

Likely outcome:

- app is easier to run in constrained environments and easier to package later

## Recommended Epic Sequencing

The recommended order is:

1. Local app shell and workspace browsing
2. Document viewing and multi-tab reading
3. Edit mode and document state safety
4. Mermaid and rich content reliability
5. Export workflows
6. Hardening and optional Electron wrapper support

This order is recommended because:

- it gets useful review value early
- it builds confidence in the core workspace model before export complexity
- it reduces the chance of polishing workflows that sit on unstable foundations

## Product Principles

- **Local-first**: the app should feel at home on local files and folders
- **Fast enough to trust**: it should open and render quickly enough to be used habitually
- **Good enough output beats perfect theory**: export quality should be practical and reliable even if not typeset-grade
- **Safe by default**: edits and file conflicts should not surprise the user
- **Simple surface, strong workflow**: the product should remain approachable even when the underlying logic is non-trivial

## Out Of Scope For This First Product Framing

- cloud sync or collaboration
- multi-user hosting
- heavy publishing/layout-authoring features
- document commenting/review systems
- advanced knowledge-base features
- enterprise distribution/signing workflows

## Relationship To Mocking Work

The next step after this PRD draft should be creation of scripted mockups that explore:

- app shell hierarchy
- browsing density and tree ergonomics
- tab behavior
- edit/render layout
- warnings and export feedback
- edge-state screens and modals

Those mockups should feed back into this document before formal epic creation.
