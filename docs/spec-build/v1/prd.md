# MD Viewer — Product Requirements Document

## Status

This PRD defines the product direction, feature scope, and epic sequencing for MD Viewer. Feature sections are shaped like lightweight epics — user context, scope, and rolled-up acceptance criteria — but stop short of line-level ACs and test conditions. Those belong in the full epic specs that follow.

This document should be treated as the upstream input for epic authoring. It will be refined as epics are written and implementation feedback surfaces.

---

## Product Vision

MD Viewer is a local-first markdown workspace for technical users who work with markdown as a primary medium — writing specs, driving agentic workflows, documenting systems, and communicating between humans and AI agents.

The application runs as a local Node process serving a browser UI. It browses local directories, renders markdown with Mermaid support, provides light editing, and exports to shareable formats. An optional Electron shell can wrap the same application for users who want native desktop behavior.

MD Viewer is part of a broader ecosystem of tools:

- **Liminal DocGen** generates structured markdown documentation for codebases. MD Viewer is a natural consumer of that output — browse, review, and export generated documentation without a build step or hosted platform.
- **Markdown Package Format** is a planned convention for structured markdown collections with a manifest-driven navigation tree. DocGen could produce packages; MD Viewer could open them directly. The format is documented separately in `future-markdown-package-format.md`.
- **Liminal Spec** is a spec-driven development methodology and skill pack. A future direction for MD Viewer includes an agentic interface (right-hand sidebar) for assisting with spec writing, orchestrating spec pipelines, and driving implementation from within the viewer.

These integrations are future directions, not v1 scope. They inform architectural decisions but do not gate the initial feature set.

---

## User Profile

**Primary User:** A technical, agentic user who uses markdown as a primary working medium. This person uses AI agents to analyze, plan, and build — and markdown is the communication layer between them and those agents. They generate and consume a high volume of markdown files: specs, designs, agent outputs, system documentation, knowledge artifacts. They work across repos, local directories, and project workspaces where markdown accumulates.

**Context:** The user wants to view rendered markdown outside the IDE without fighting for screen space. They need to export markdown into formats that work in human systems — PDF for stakeholders, DOCX for compliance, HTML for sharing. They may work in corporate environments where installing native apps is friction, making a local web app significantly more practical.

**Mental Model:** "I have directories full of markdown. I want to point this tool at them, browse, read rendered output, and export when I need to share with non-markdown people."

**Key Constraint:** Must run locally from Node without app signing, admin access, or cloud dependencies. Keyboard shortcuts are baseline expectations, not nice-to-haves.

**Secondary User:** Anyone who wants quick, clean markdown viewing and export without installing something heavy.

---

## Problem Statement

Technical users increasingly work through markdown. It is the primary medium for specifying work, driving agentic workflows, documenting systems, and communicating between humans and AI agents. This generates a lot of markdown files.

Current viewing options are poor:

- **Terminal**: no good inline rendering.
- **IDE previews**: they exist but compete for space with the editor, file tree, terminal, and everything else.
- **No default external viewer**: there's no lightweight local tool that renders markdown well, handles Mermaid, and can be launched from anywhere.
- **Export gap**: when markdown needs to reach non-technical humans, it needs to become PDF, DOCX, or HTML. Most tools don't treat this as first-class.

---

## Product Principles

- **Local-first**: lives on local files and folders, not in a cloud
- **Fast enough to trust**: opens and renders quickly enough to reach for habitually
- **Pragmatic output quality**: exports are practical and reliable, not typeset-grade
- **Safe by default**: edits, closes, and file conflicts don't surprise the user
- **Simple surface, strong workflow**: approachable even when the underlying logic is non-trivial
- **Keyboard-native**: the primary user expects keyboard shortcuts as baseline
- **Good defaults over configuration**: especially for export — one click, good output

---

## Non-Functional Requirements

These apply across all features unless a specific feature overrides them.

**Responsiveness:** The app should feel immediate for small to medium files (under ~2,000 lines). File tree population, document rendering, tab switching, and mode toggling should all feel instant at that scale. Larger files (2,000–10,000+ lines) may have brief visible latency but should not freeze the UI. Specific thresholds will be refined in individual epics.

**Startup:** The app should be ready to use within a few seconds of launch. The server starts, the browser loads, and the last workspace is restored.

**Memory:** The app should not grow unboundedly with usage. Tab state, render caches, and file tree data should be managed. Having 20+ tabs open should not cause memory pressure that degrades the experience.

**Reliability:** The app should not lose user data. Saves should be atomic where possible. Filesystem errors (permissions, missing files, disconnected drives) should produce visible feedback, not silent failure.

---

## Architecture Summary

- Single deployable unit: one local Node process (Fastify) serves both API and static frontend
- Server owns filesystem access, directory browsing, file watching, and export orchestration
- Browser frontend (vanilla HTML/CSS/JS) talks to local API
- Shared TypeScript core for markdown rendering, Mermaid handling, and export logic
- Electron is an optional thin wrapper later, pointing at the same local app
- Directory browser is API-backed so browser and Electron share one implementation

Stack: Fastify, vanilla HTML/CSS/JS, TypeScript for core and server, optional Electron shell.

Detailed architecture is documented separately in `technical-architecture-overview.md`.

---

## Milestones

| Milestone | After | What Exists | Feedback Point |
|-----------|-------|-------------|----------------|
| **M1: Viewer** | Epics 1+2 | Browse folders, read rendered markdown, multi-tab | Yes — first usable app |
| **M2: Trustworthy Viewer** | Epic 3 | + Mermaid, syntax highlighting, images, tables | Yes — handles real content |
| **M3: Full Workspace** | Epic 4 | + export to PDF, DOCX, HTML | Yes — complete v1 value |
| **M4: Editor** | Epic 5 | + light editing with safety | Optional pause |
| **M5: Polished** | Epic 6 | + hardening, optional Electron | Release candidate |

Epics 1 and 2 should be planned tightly together since Epic 1 alone is not usable. Stop after M1, M2, and M3 for hands-on feedback before continuing.

---

## Feature 1: App Shell and Workspace Browsing

### Context

This is the foundation. It establishes the local runtime, the app shell, sidebar navigation, and workspace management. Everything else sits on this.

### User Need

The user launches the app and points it at a local directory. They see a filtered tree of markdown files, can save frequently-used roots as workspaces, and can switch between them. They know where they are in the filesystem at all times.

### In Scope

- Fastify local server with static frontend serving
- App shell: menu bar with File/Export/View dropdowns, quick-action toolbar icons. The menu bar is the top-level chrome and is fully owned by this epic.
- Tab strip: present in empty state ("No documents open"). Tab strip chrome is owned by this epic; tab behavior (open, switch, close) is Epic 2.
- Content area: empty state only (app name, Open File / Open Folder prompts, recent files). The content toolbar (mode toggle, export dropdown, status) does not appear until a document is open and is owned by Epic 2.
- Sidebar with three sections:
  - **Workspaces**: collapsible list of saved root paths with labels, full-path tooltips, x-to-remove. Clicking a workspace switches the root.
  - **Root line**: single non-collapsible row showing current root path with browse (folder picker), pin-as-workspace, copy-path, and refresh actions.
  - **File tree**: non-collapsible, markdown-only filtered directory listing with expand/collapse, expand-all (expands only to last markdown file on each branch).
- Right-click context menus: Copy Path on files and directories, Make Root and Save as Workspace on directories.
- Keyboard shortcuts for common operations (open folder, toggle sidebar). Note: The Open File quick-action icon is present but disabled in Feature 1 (matching the Export disabled pattern). The Cmd+O shortcut is not registered until Feature 2 — registering a shortcut with no handler would eat the browser's native behavior. Both activate in Feature 2.
- Theme support: 2 light themes and 2 dark themes. Theme selection persists across sessions. Architecture supports adding more themes later without structural changes.
- Session persistence: saved workspaces, last root, recent files list, and selected theme survive app restart

### Out of Scope

- Document rendering (Epic 2)
- Mermaid (Epic 3)
- Export (Epic 4)
- Editing (Epic 5)
- File watching (Epic 2)
- Markdown package format detection

### Rolled-Up Acceptance Criteria

The user can launch the app with one command and see the app shell. They can choose a root folder via the sidebar browse action or the File menu, and the file tree populates with markdown files and directories. They can expand and collapse directories. Expand All expands every directory that has markdown descendants and stops at directories that don't.

The user can save the current root as a workspace. Saved workspaces appear in the collapsible Workspaces section, persist across sessions, and show the full path on hover. The user can remove a workspace with the x button and switch roots by clicking a different workspace.

The root line always shows the current root path, truncated with full path on hover. The browse icon opens a folder picker. The pin icon saves the root as a workspace. Copy and refresh are available.

Right-clicking a file shows Copy Path. Right-clicking a directory shows Copy Path, Make Root, and Save as Workspace.

The empty content area shows the app name, Open File and Open Folder actions, and a recent files list. The tab strip shows "No documents open."

The user can switch between 4 themes (2 light, 2 dark) from the View menu. The selected theme applies to the entire app — shell, sidebar, content area, and rendered markdown. Theme selection persists across sessions.

### Mockup References

- `03-empty-workspace.html` — launch state, empty root, workspace list
- `01-main-workspace-reading.html` — sidebar structure (ignore content area for this epic)
- `05-folder-tree-heavy.html` — deep tree, expand all, context menus

---

## Feature 2: Document Viewing and Multi-Tab Reading

### Context

This makes the app usable. After this epic, a user can browse and read rendered markdown with multiple tabs open. The app is worth using daily.

### User Need

The user clicks a file in the tree and sees clean rendered markdown. They open several documents, switch between them, and close tabs. They can also open files via the File menu or keyboard shortcut.

### In Scope

- Opening markdown files from the tree, File menu, or keyboard shortcut
- Rendering markdown to HTML: headings, paragraphs, lists, tables, code blocks (monospace, no language-aware highlighting yet — that's Epic 3), blockquotes, images (local), horizontal rules, links
- Tab behavior: open, switch, close, close-others. Tab strip chrome exists from Epic 1; this epic adds the active tab indication, close buttons, and horizontal scroll on overflow.
- Content toolbar (appears when a document is open): Render/Edit mode toggle, "Opens in" default mode picker, Export dropdown, and status area. This entire bar is owned by this epic. Edit mode and Export are visually present but non-functional until their respective epics.
- Warning indicators for missing images (placeholder with path shown)
- File path shown in status area of menu bar (truncated, full path on hover)
- Opening the same file twice reuses the existing tab
- Relative markdown links: clicking a link to a local `.md` file opens it in a new tab. Configurable (new tab vs same tab) as a future refinement.
- Keyboard shortcuts: close tab, next/previous tab, reading/edit mode toggle
- File watching: detect when an open file changes on disk and auto-reload. No conflict resolution needed since editing is not yet available — the file simply refreshes.

### Out of Scope

- Mermaid diagram rendering (Epic 3)
- Code syntax highlighting (Epic 3) — Epic 2 renders code blocks as monospace only
- Export functionality (Epic 4)
- Editing and save (Epic 5)
- External change conflict resolution (Epic 5 — requires editing to create a conflict)

### Rolled-Up Acceptance Criteria

The user clicks a file in the tree and the content area shows the rendered markdown in a new tab. The tab strip shows the filename. Clicking another file opens a new tab. Clicking an already-open file switches to its tab.

Rendered output handles headings, paragraphs, lists (ordered/unordered), tables, inline code, code blocks (monospace, no language-aware highlighting), blockquotes, local images, links, and horizontal rules. Missing images show a visible placeholder with the expected path.

The user can switch between tabs by clicking or keyboard shortcut. Close buttons appear on hover and on the active tab. The tab strip scrolls horizontally when there are more tabs than fit.

The content toolbar shows Render/Edit toggle, "Opens in" default mode picker, Export dropdown, and status. Render mode is functional. Edit and Export are visually present but disabled until their epics ship.

The menu bar status area shows the current file path, truncated, with full path on hover.

### Mockup References

- `01-main-workspace-reading.html` — core reading view, content toolbar, rendered output
- `04-multi-tab-heavy.html` — tab overflow, many tabs
- `06-narrow-window.html` — compressed tabs and content at narrow widths

---

## Feature 3: Mermaid and Rich Content

### Context

This makes the viewer trustworthy on real-world content. Without Mermaid, the tool is not useful for reviewing agent-generated documentation, architecture docs, or specs — which is the primary use case.

### User Need

The user opens a document containing Mermaid diagrams, code blocks with various languages, complex tables, and embedded images. Everything renders correctly and predictably. Failures are visible, not silent.

### In Scope

Note: Epic 2 already delivers basic rendering of all standard markdown constructs (tables, images, links, warnings). This epic adds the rich content layer on top.

- Mermaid diagram rendering (local, no remote services)
- Mermaid failure handling: show the raw source in a code block with an error banner, not a blank space
- Syntax highlighting for code blocks (language-aware, replacing Epic 2's monospace rendering)
- Enhanced table handling: complex nested content, very wide tables with many columns
- Rendered output consistency: what you see in the preview should closely match what exports produce (Epic 4)

### Out of Scope

- Mermaid editing or live diagram authoring
- Custom Mermaid themes or configuration
- LaTeX / math rendering
- Remote image fetching or caching
- Basic table rendering, image handling, warning infrastructure (already delivered in Epic 2)

### Rolled-Up Acceptance Criteria

Mermaid code blocks render as SVG diagrams inline in the document. Supported diagram types include at minimum: flowchart, sequence, class, state, and gantt. If a diagram fails to parse or render, the raw Mermaid source is shown in a code block with an error message banner above it indicating what went wrong. Mermaid failures are added to the warning count (warning infrastructure established in Epic 2).

Code blocks with language tags render with syntax highlighting. Common languages (JavaScript, TypeScript, Python, Go, Rust, SQL, YAML, JSON, Bash, HTML, CSS) are supported.

Tables with complex content (nested lists, code, multi-line cells) render correctly. Very wide tables with many columns scroll horizontally without layout breakage.

### Mockup References

- `01-main-workspace-reading.html` — Mermaid diagram, code blocks, tables in rendered view
- `08-warnings-degraded.html` — missing images, blocked remote images, failed Mermaid with error display

---

## Feature 4: Export

### Context

Export is a core value proposition, not an afterthought. The user reviews markdown and then needs to share it with non-markdown people. The experience should be: click Export, pick a format, get a good file. No wizard, no configuration panel.

### User Need

The user is looking at a rendered document and needs to send it to someone who doesn't use markdown. They click Export, choose PDF or DOCX or HTML, and get a file with good defaults.

### In Scope

- Export to PDF with good default page layout, margins, and page breaks
- Export to DOCX with reasonable formatting
- Export to HTML as a self-contained file or folder with assets
- Mermaid diagrams included in all export formats as rendered images/SVGs
- Local images embedded in exports
- Export trigger from the content toolbar dropdown (one click to format, one click to export)
- Export trigger from the Export menu in the menu bar
- Export feedback: in-progress indicator, success with file path, warnings for degraded output
- Default export location: save dialog with a sensible default path (same directory as source file, or last-used export directory)
- Good defaults: the user should not need to configure anything for a reasonable export

### Out of Scope

- Export configuration UI (page size, margins, headers/footers, etc.)
- Batch export (multiple documents at once)
- Template customization
- Print stylesheet editing
- Manual page break controls (may add document-level hints like `<!-- pagebreak -->` later as a refinement, not as part of this epic)

### Rolled-Up Acceptance Criteria

The user clicks "Export ▾" in the content toolbar, selects a format, and the app produces the file. A brief in-progress indicator shows during export. On success, the app shows the output file path with an option to reveal it in Finder/file manager. On failure or degraded output, warnings list what couldn't be included and why.

PDF output has reasonable margins, page breaks that don't split headings from their first paragraph or cut tables mid-row, and readable typography. Mermaid diagrams appear as rendered images. Code blocks have syntax highlighting. Local images are embedded.

DOCX output has structured headings, readable body text, tables, code blocks, and embedded images. Mermaid diagrams are included as images.

HTML output is self-contained — either a single file with embedded assets or a folder with assets alongside. It can be opened in a browser and looks close to the in-app rendered view.

Export uses the same rendered output the user sees in the viewer. If a Mermaid diagram failed to render in the viewer, the export includes the same fallback (raw source), not a blank space.

### Mockup References

- `07-export-flow.html` — export dropdown, in-progress, success, warning states

---

## Feature 5: Edit Mode and Document Safety

### Context

Editing is useful but secondary to viewing. The user occasionally spots something to fix — a typo, a broken link, a section update. They switch to edit mode, make the change, and save. The app must protect them from losing work.

### User Need

The user sees something wrong in a document and wants to fix it without switching to another tool. They need clear mode switching, visible dirty state, safe save behavior, and protection against both accidental close and external file changes.

### In Scope

- Edit mode: monospace text editor with markdown syntax highlighting
- Mode switching via Render/Edit toggle with keyboard shortcut
- "Opens in" default mode picker becomes functional for Edit (already present from Epic 2, now both options work)
- Dirty state tracking: visual indicator on tab (dot) and in content toolbar when document has unsaved changes
- Save and Save As via keyboard shortcut and File menu
- External change conflict resolution: when a file changes on disk while the user has local edits, a modal offers Keep My Changes, Reload from Disk, Save Copy. (File watching infrastructure is established in Epic 2; this epic adds the conflict layer on top.)
- Unsaved changes protection: prompt on close tab, prompt on quit with list of dirty tabs
- Line/column position display in content toolbar status area during edit mode
- Markdown source editing with good syntax highlighting (headings, bold, italic, code, links, lists, tables)
- Tools for inserting markdown constructs that are tedious to type manually (tables, links) — keyboard shortcuts or toolbar actions, not a heavy formatting toolbar

### Out of Scope

- Rich text / WYSIWYG editing
- Split pane (side-by-side edit and preview)
- Collaborative editing
- Version history / undo beyond standard editor undo
- Spell check
- AI-assisted editing (future agentic interface direction)

### Rolled-Up Acceptance Criteria

The user switches to Edit mode and sees the raw markdown with syntax highlighting. They can type, edit, and use standard text editing shortcuts. The tab shows a dirty indicator when content differs from the saved file.

Save writes the current content to disk. Save As prompts for a new path. Both clear the dirty indicator. If the user tries to close a dirty tab, a modal prompts Save and Close, Discard Changes, or Cancel. If the user tries to quit with dirty tabs, a modal lists the dirty tabs and prompts Save All and Quit, Discard All and Quit, or Cancel.

If the file changes on disk while the user has local edits, a conflict modal appears offering Keep My Changes, Reload from Disk, or Save Copy. If the file changes on disk and the user has no local edits, the tab refreshes silently.

The "Opens in" dropdown lets the user switch the default mode for new tabs between Render and Edit. This persists across sessions.

### Mockup References

- `02-main-workspace-editing.html` — edit mode, syntax highlighting, dirty indicators
- `09-conflict-modal.html` — external file change conflict
- `10-unsaved-changes.html` — close tab and quit confirmations

---

## Feature 6: Hardening and Electron Wrapper

### Context

This is polish and packaging, not new capability. The app works after Epic 5. This epic makes it robust under real-world conditions and optionally wraps it for desktop use.

### User Need

The user has been using the app daily. They hit edge cases: large files, deep directory trees, many tabs, slow filesystems. They want it to handle these gracefully. Some users also want to double-click a .md file and have it open in this app — that requires the Electron wrapper.

### In Scope

- Performance hardening: large files, deep trees, many open tabs
- Startup time optimization
- Graceful handling of filesystem edge cases (permissions, symlinks, missing files, network drives)
- Mermaid render caching (bounded, not unbounded)
- Electron wrapper: thin shell that loads the local web app
- Electron file associations: register as .md handler on macOS
- Electron packaging: stable bundle ID, local install to ~/Applications
- One-command local install script

### Out of Scope

- Code signing and notarization (documented as future if needed)
- App Store distribution
- Auto-update mechanism
- Windows or Linux Electron packaging (macOS first)

### Rolled-Up Acceptance Criteria

The app handles documents over 10,000 lines without noticeable lag in rendering or scrolling. Directory trees with 1,000+ markdown files load and expand without freezing. Having 20+ tabs open does not degrade switching or rendering performance.

The Electron wrapper launches the same app that runs in the browser. Opening a .md file from Finder opens it in the Electron app (after one-time file association setup). Rebuilding and replacing the app at the same path does not require re-associating file types.

The local install script builds the app and places it at a stable user-writable location.

### Mockup References

- `06-narrow-window.html` — compact layout behavior relevant to Electron window sizing

---

## UX Design Constraints

These constraints were established during mockup development and apply across all features.

**Toolbar**: Compact menu bar with File/Export/View dropdowns plus small quick-action icon buttons. Not wide text buttons.

**File path display**: In status area of menu bar, not a dedicated row. Truncated, full path on hover.

**Content toolbar layout**: `[Render] [Edit] Opens in: Render ▾ ··· [Export ▾] status`

**Sidebar chrome**: Light. Workspaces section is collapsible. Root line is a single non-collapsible row. Files section is non-collapsible. Minimize labels, buttons, and separators.

**Root line**: `[📁 browse] path [📌 pin] [⎘ copy] [↻ refresh]`

**Workspace entries**: Full path as tooltip on hover. x-to-remove on hover.

**Context menus**: Copy Path on files and directories. Make Root and Save as Workspace on directories.

**Expand All**: Expands to the last markdown file on each branch. Directories with no markdown descendants are not expanded.

**Default mode picker**: Small receded "Opens in: Render ▾" dropdown next to mode buttons. Visually quiet, discoverable when the user needs it.

**Export**: Single "Export ▾" dropdown in content toolbar, not three separate buttons.

**Modals**: Clean, not cluttered. Primary action obvious. Destructive actions visually cautious (secondary styling, not alarming red).

**Themes**: 2 light and 2 dark themes at launch. Selectable from View menu, persists across sessions. Theme system designed to support adding more themes later.

**Mockup inventory**: 10 HTML mockups in `mockups/` covering all major states and interactions. These are the visual contract for the UI.

---

## Future Directions

These are not scoped for v1 but inform architecture and design decisions.

### Markdown Package Format

A convention for structured markdown collections with a manifest file (itself markdown) that defines the navigation tree. The viewer detects the manifest and switches from filesystem-scan to manifest-driven navigation. The same directory can be tar'd into a single self-contained file for transfer. Includes an LLM-accessible preamble and CLI tooling for agent navigation. Documented in `future-markdown-package-format.md`.

### Liminal DocGen Integration

Liminal DocGen is an AI-powered CLI that generates structured markdown documentation for codebases — module-level wiki pages with architecture diagrams, entity tables, cross-references, and Mermaid visualizations. Its output is exactly the kind of content MD Viewer is built to consume. A natural integration point: DocGen produces a documentation package (potentially using the markdown package format), and MD Viewer opens it directly for browsing, review, and export.

### Agentic Interface

A right-hand sidebar providing an AI assistant interface within the viewer. Potential capabilities:

- Quick assistance with editing specs or documentation
- Orchestrating the Liminal Spec pipeline (research → epic → tech design → stories → implementation) from within the viewer
- Answering questions about the currently open document or workspace
- Generating or refining markdown content in context

This connects MD Viewer to the Liminal Spec methodology as a workspace for spec-driven development, not just a passive document viewer.

### Full Liminal Spec Integration

MD Viewer could become the primary workspace for the entire Liminal Spec pipeline — authoring requirements, writing epics, reviewing tech designs, and orchestrating agent-driven implementation. The viewer's browsing, rendering, editing, and export capabilities align directly with each phase of the spec pipeline.

---

## Out of Scope (v1)

- Cloud sync or collaboration
- Multi-user hosting
- Heavy publishing or layout-authoring features
- Document commenting or review systems
- Enterprise distribution, signing, or MDM workflows
- Real-time collaborative editing
- AI/agentic features (future direction)
- Markdown package format support (future direction)
- Search (within document or across files)

---

## Relationship to Downstream Specs

This PRD is the upstream input for detailed epic specs written using the Liminal Spec methodology. Each feature section above maps to one epic. The epic specs will expand each feature into:

- Full acceptance criteria with test conditions
- Data contracts (API shapes)
- Non-functional requirements
- Story breakdown with sequencing

The PRD defines *what* and *why*. The epics define *exactly what* with traceability. The tech designs define *how*.
