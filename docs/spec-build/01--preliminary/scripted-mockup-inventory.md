# Scripted Mockup Inventory

## Purpose

This document lists the recommended mockup surfaces to create before formal epic breakdown and detailed technical design. The goal is to make sure the product shape, state transitions, and awkward edge cases are visually explored before requirements harden.

## Mockup Principles

- focus on workflow clarity over visual polish
- cover normal states and awkward states
- prefer realistic content density
- make space, hierarchy, and interaction choices visible

## UX Observations From Current Prototype

These observations are based on hands-on use of the Electron prototype and should directly inform mockup design decisions.

### Top Bar / Toolbar

- Current buttons (Open Markdown, Open Folder, Reload, Save, Save As, Export PDF, Export DOCX, Export HTML Folder) are too large and wordy. They dominate the top of the window.
- Replace with compact icon buttons with tooltips, or consolidate into a small menu bar with dropdown menus (File, Export, View style).
- The full file path bar below the toolbar wastes an entire horizontal row for rarely-glanced info. Consider: tooltip on tab, subtle breadcrumb, hover reveal, or status bar placement.

### Sidebar: Saved Roots / "PINNED" Section

- The concept is very useful — quick-access bookmarks to filesystem roots the user works in regularly.
- "PINNED" is not the best label. These are saved root paths / workspace roots. Consider: "Workspaces", "Saved Roots", "Bases", or similar.
- "Unpin Root" button is probably unnecessary since each entry already has an x button for removal.
- Discoverability of how to pin/save a root is not obvious. Current flow: when viewing an unpinned root, a "Pin" option appears. Not terrible but could be more intuitive. Right-clicking a directory in the tree and seeing "Save as Workspace" / "Set as Root" would help.
- The x buttons on each entry for removal are clear and fine.
- Section should be collapsible with a disclosure triangle in the header row.

### Sidebar: ROOT Section

- The concept is very useful — shows where you currently are in the filesystem, critical when the tree only shows markdown files.
- Current presentation (ROOT label + Refresh button + full path) takes too much vertical space and feels clunky.
- Could be a single compact row: small label + truncated path + refresh icon.
- **Important**: be careful not to lose the "where am I" and "reload" affordances when refining this. The information is high value even if the chrome is heavy.
- Section should be collapsible with a disclosure triangle in the header row.

### Sidebar: File Tree

- Works well. Markdown-only filtering is a real strength.
- Right-click context menu needed:
  - On files: "Copy Path"
  - On directories: "Copy Path", "Make Root" / "Make Base Path"
- The FILES section header could also be collapsible.

### Render / Edit Mode Toggle

- The Render/Edit tab toggle works as a concept.
- Rendered view looks clean — tables render well, headings are clear.
- Edit view shows raw markdown in monospace. Functional.

### General Sidebar Notes

- The sidebar bones are right: saved roots + current root + filtered tree.
- The chrome around each section is too heavy — too many labels, buttons, and separators competing for space.
- Refinement should compress the chrome while preserving the information and affordances.

## Recommended Mockup Pages

### 1. App Launch / Empty Workspace

Show:

- first-load screen
- root folder selection prompt
- empty state messaging
- primary actions

Why:

- defines first impression and startup affordance

### 2. Main Workspace / Standard Reading View

Show:

- compact toolbar (icon buttons with tooltips, or small menu bar with dropdowns)
- folder tree with collapsible saved-roots and current-root sections
- tab strip
- rendered document pane
- warnings/status area
- right-click context menus on tree items (copy path on files and directories, make root on directories)

Why:

- defines the core product shape
- must demonstrate compressed sidebar chrome vs current prototype

### 3. Main Workspace / Edit Mode

Show:

- tab strip
- editor pane
- mode toggle
- save/dirty indicators
- preview status

Why:

- defines the basic authoring workflow and its clarity

### 4. Multi-Tab Heavy Usage State

Show:

- many open tabs
- truncation behavior
- active tab emphasis
- tab overflow behavior if any

Why:

- this is a likely real-world usage mode and a common source of UI awkwardness

### 5. Folder Tree Heavy Workspace

Show:

- nested folders
- expanded/collapsed states
- saved roots section (collapsible, with x-to-remove on each entry)
- current root section (collapsible, compact: label + truncated path + refresh icon)
- active root indication
- very long file/folder names
- right-click context menu on a directory showing "Copy Path" and "Make Root" / "Make Base Path"
- right-click context menu on a file showing "Copy Path"

Why:

- the directory browser is a core part of the local-first story
- context menus are a key usability addition identified from prototype use

### 6. Warnings / Degraded Render State

Show:

- missing image warning
- blocked remote asset warning
- Mermaid failure fallback
- document with mixed good and degraded content

Why:

- these states are essential to trust and usability

### 7. Export Action Flow

Show:

- export actions available from workspace
- in-progress or feedback state
- success state
- warning-rich export result state

Why:

- export is one of the main reasons this app exists

### 8. External File Change Conflict Modal

Show:

- document changed on disk while local edits exist
- choice structure
- safe default emphasis

Why:

- this is a high-trust workflow and should be designed intentionally

### 9. Unsaved Changes Confirmation Flow

Show:

- closing a dirty tab
- quitting with multiple dirty tabs
- reload with unsaved changes

Why:

- these confirmation patterns need consistency

### 10. Narrow Window / Compact Layout

Show:

- smaller browser window
- sidebar pressure
- toolbar wrapping or compression
- tab strip density

Why:

- helps avoid designing only for roomy desktop states

## Recommended Mockup Variants

For the main workspace mocks, create at least these content variants:

- short simple markdown file
- long technical markdown file
- Mermaid-heavy file
- image-heavy file
- warning-heavy file

## Notes For Scripted HTML Mockups

The initial HTML mockups should:

- be static or lightly scripted
- use realistic markdown-derived content
- cover at least the 10 states listed above
- emphasize spacing, grouping, visual hierarchy, and interaction clarity

They do not need:

- real backend integration
- real saving/export logic
- production-ready interactions

## Recommended Use Of Mock Outputs

Once created, the mockups should be used to:

- refine the PRD
- validate epic boundaries
- expose missing edge states
- support higher-fidelity mock generation and detailed spec writing
