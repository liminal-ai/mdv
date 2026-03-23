# Gorilla Testing Approach

## 1. Purpose

Gorilla testing catches issues that scripted E2E tests miss — interaction sequences nobody thought to test, visual/UX problems, state that accumulates across navigation, things that "feel wrong." It complements the deterministic Playwright suite.

## 2. Tooling

- **agent-browser** (Vercel) — Rust CLI for headless browser automation designed for AI agents
- **dogfood skill** — first-party exploratory testing skill (`npx skills add vercel-labs/agent-browser --skill dogfood`)
- Token-efficient (~93% reduction vs Playwright MCP) — enables 5-6x more exploration per context budget
- Accessibility tree snapshots with element references for navigation

## 3. When to Run

- **Per-epic (required):** Scoped pass after all stories are accepted, before epic-level verification. Tester receives the epic's feature overview and tests both new and adjacent features.
- **Per-milestone (required):** Full-surface unscoped pass after multiple epics land. Cover all permanent scenarios plus any epic-specific scenarios from recent epics.
- **Per-story:** Not required. Story-level review and E2E tests are sufficient.

## 4. Integration with Tech Design

During the tech design phase, the tech designer adds a "Gorilla Testing Scenarios" subsection to the test plan. This specifies:

- UI-oriented capabilities that should be exploratory tested
- Known fragile interaction patterns
- Cross-feature interactions that scripted tests don't cover
- Edge cases that benefit from agent judgment (e.g., "rapidly switch between themes while a document is loading")

The tech designer reads this document and decides what gorilla scenarios are appropriate for the epic being designed.

## 5. Permanent Scenarios

Things to always check on every gorilla pass, regardless of what changed. These accumulate over time as bugs are found and fixed.

### Session & State

- Session persistence: tabs, workspace, theme survive page reload and server restart
- Tab restore on startup: all tabs load without stuck spinners
- Dirty state tracking: dirty indicator appears on edit, clears on save, clears on full undo

### Navigation & Tree

- File tree updates when files are created/deleted on disk
- Deep nesting displays with readable indentation and guide lines
- Expand All / Collapse All work on large directories
- Workspace switching preserves state correctly

### Rendering

- Wide tables scroll horizontally without breaking layout
- Mermaid diagrams render as SVG (not error state)
- Code blocks have syntax highlighting (Shiki, not unstyled)
- Images load from relative paths
- Relative markdown links open in new tabs

### Interaction

- Theme switching works (View menu → theme items respond to clicks)
- Keyboard shortcuts: Cmd+W (close tab), Ctrl+Tab (next tab), Cmd+E (toggle edit)
- Edit mode: enter, edit, dirty indicator, save, exit, content updates in render view
- Export: HTML export produces a file
- Tab management: open, switch, close, last-tab-close shows empty state

### Error States & Console

- Invalid Mermaid syntax shows error message, not blank/broken SVG
- Missing images show alt text or placeholder, not broken image icon
- Browser console has no unexpected errors or warnings during normal use
- Export when no file is open: disabled or shows appropriate message

### Visual & UX

- Content area uses full width (1050px default)
- Empty state shows app name and action prompts
- Pinned workspace remove buttons only appear on hover
- No stuck loading spinners anywhere

## 6. Epic-Specific Scenarios

Added by the tech design for each epic. Template:

```
### Epic N: [Name]
**New capabilities to test:**
- [capability 1 — what to try, what could go wrong]
- [capability 2]

**Adjacent features to recheck:**
- [feature that might be affected by this epic's changes]

**Edge cases for agent exploration:**
- [scenario that benefits from open-ended poking]
```

## 7. Running a Gorilla Test Pass

1. Build and start the app server: `cd app && npm run build && npm start` (default: `http://localhost:3000`)
2. Launch agent-browser dogfood, scoped to the epic under test (per-epic) or full surface (per-milestone)
3. The tester reads this document + the epic's gorilla scenarios from the tech design
4. Tester reports batches of ~5 issues at a time
5. Orchestrator triages: obvious fixes dispatched immediately, judgment calls held for human
6. All findings logged in an inventory

## 8. Issue Reporting Format

This format is for gorilla testing reports managed by the orchestrator. When using the dogfood skill directly, follow its own report template instead.

```
### Issue N
**Category:** BUG | UI | UX | STYLE | MISSING_FEATURE
**Severity:** P0 (broken) | P1 (significant) | P2 (minor) | P3 (cosmetic)
**Description:** what's wrong
**Expected:** what should happen
**Repro:** steps to reproduce
```

## 9. Known Fragile Areas

Areas that have broken before and should get extra attention:

- **Theme menu click handling** — DOM destruction race condition between mousedown and click events (fixed: selective store subscription + mousedown stopPropagation)
- **Tab restore on startup** — only active tab was loading, others spun forever (fixed: concurrent load of remaining tabs)
- **Table overflow** — wide tables without scroll wrapper (fixed: CSS overflow-x: auto)
