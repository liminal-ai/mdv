# Scripted Mockup Inventory

## Purpose

This document lists the recommended mockup surfaces to create before formal epic breakdown and detailed technical design. The goal is to make sure the product shape, state transitions, and awkward edge cases are visually explored before requirements harden.

## Mockup Principles

- focus on workflow clarity over visual polish
- cover normal states and awkward states
- prefer realistic content density
- make space, hierarchy, and interaction choices visible

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

- toolbar
- folder tree
- tab strip
- rendered document pane
- warnings/status area

Why:

- defines the core product shape

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
- pinned roots
- active root indication
- very long file/folder names

Why:

- the directory browser is a core part of the local-first story

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
