# Exploratory QA Approach

## 1. Purpose

Exploratory QA catches issues that scripted E2E tests miss: unexpected interaction sequences, visual/UX regressions, state accumulation across navigation, and workflows that feel wrong in real use. It complements deterministic Playwright coverage.

## 2. Terminology

- Preferred term in this repo: **Exploratory QA**
- Avoid overloaded slang terms for this process; keep language explicit and workflow-oriented.

## 3. Tooling

- **agent-browser** (Vercel): Rust CLI for browser automation suitable for AI-driven exploratory passes
- **Exploratory QA skill workflow**
- Token-efficient accessibility-tree snapshots with element references for navigation

## 4. When to Run

- **Per-epic (required):** scoped pass after stories are accepted, before epic closeout
- **Per-milestone (required):** full-surface unscoped pass after multiple epics land
- **Per-story:** optional; usually deterministic tests + review are sufficient

## 5. Integration with Tech Design

During tech design, add an **Exploratory QA Scenarios** subsection to the test plan that specifies:

- UI-oriented capabilities to probe
- Fragile interaction patterns
- Cross-feature interactions scripted tests do not cover
- Agent-judgment edge cases (for example rapid switching while loading)

## 6. Permanent Scenarios

Things to verify on every exploratory pass, regardless of what changed:

### Session & State

- Session persistence for tabs, workspace, theme across reload/restart
- Tab restore without stuck spinners
- Dirty state appears on edit and clears on save/full undo

### Navigation & Tree

- File tree updates after create/delete on disk
- Deep nesting remains readable
- Expand All / Collapse All work on large directories
- Workspace switching preserves expected state

### Rendering

- Wide tables scroll horizontally without layout breakage
- Mermaid diagrams render correctly
- Code blocks have syntax highlighting
- Relative images and links resolve correctly

### Interaction

- Theme switching is functional
- Keyboard shortcuts: `Cmd+W`, `Ctrl+Tab`, `Cmd+E`
- Edit mode workflow: enter, modify, dirty indicator, save, exit, rendered content refresh
- Export workflow works when a document is open
- Last-tab close returns to empty state

### Error States & Console

- Invalid Mermaid surfaces a readable error
- Missing images degrade gracefully
- No unexpected console errors during normal usage
- Export with no file open is disabled or clearly messaged

### Visual & UX

- Content area width and spacing are stable
- Empty state is clear and actionable
- No stuck loading states

## 7. Running an Exploratory QA Pass

1. Start app server (`npm run build && npm start` or project standard dev command)
2. Run exploratory QA with agent-browser, scoped to current epic or full-surface
3. Tester reads this document + epic scenario additions
4. Tester reports reproducible findings with evidence
5. Orchestrator triages and dispatches fixes
6. Findings are logged and tracked to closure

## 8. Artifact Hygiene (Required)

Exploratory QA artifacts are transient by default.

- Default output root: `${TMPDIR:-/tmp}/mdv-exploratory-qa/<run-id>/`
- Keep artifacts in-repo only when explicitly requested for permanent documentation
- Use `npm run qa:clean -- --days 7` to prune stale artifacts

## 9. Issue Reporting Format

```
### Issue N
**Category:** BUG | UI | UX | STYLE | MISSING_FEATURE
**Severity:** P0 (broken) | P1 (significant) | P2 (minor) | P3 (cosmetic)
**Description:** what's wrong
**Expected:** what should happen
**Repro:** steps to reproduce
```

## 10. Known Fragile Areas

- Theme menu click handling race conditions
- Tab restore consistency on startup
- Table overflow handling in rendered markdown
