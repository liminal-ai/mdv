# Story 4: Context Menus

## Summary
<!-- Jira: Summary field -->
Right-click context menus on file tree nodes with Copy Path, Make Root, and Save as Workspace actions.

## Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user browsing directories full of markdown files. Expects right-click context menus for quick actions on files and directories.

**Objective:** Deliver context menus on file tree nodes — files get Copy Path, directories get Copy Path, Make Root, and Save as Workspace.

**Scope:**
- In: Right-click context menu on files (Copy Path), right-click context menu on directories (Copy Path, Make Root, Save as Workspace), menu close behavior (action, outside click, Escape), keyboard navigation of context menus
- Out: File opening (Epic 2)

**Dependencies:** Story 3 (file tree must be rendered)

## Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-6.1:** Right-clicking a file shows a context menu with Copy Path

- **TC-6.1a: File context menu**
  - Given: User views the file tree
  - When: User right-clicks on a markdown file
  - Then: A context menu appears with "Copy Path"
- **TC-6.1b: Copy Path copies the full file path**
  - Given: Context menu is showing for /Users/leemoore/code/project-atlas/docs/readme.md
  - When: User clicks "Copy Path"
  - Then: The full absolute path is copied to the clipboard and the context menu closes

**AC-6.2:** Right-clicking a directory shows a context menu with Copy Path, Make Root, and Save as Workspace

- **TC-6.2a: Directory context menu**
  - Given: User views the file tree
  - When: User right-clicks on a directory
  - Then: A context menu appears with "Copy Path", "Make Root", and "Save as Workspace"
- **TC-6.2b: Make Root changes the current root**
  - Given: Root is /Users/leemoore/code
  - When: User right-clicks /Users/leemoore/code/project-atlas and selects "Make Root"
  - Then: Root changes to /Users/leemoore/code/project-atlas, root line updates, file tree refreshes
- **TC-6.2c: Save as Workspace adds to workspace list**
  - Given: /Users/leemoore/code/project-atlas is not in the workspace list
  - When: User right-clicks the directory and selects "Save as Workspace"
  - Then: The path is added to the Workspaces section

**AC-6.3:** Context menu closes when an action is selected or user clicks elsewhere

- **TC-6.3a: Close on action**
  - Given: Context menu is open
  - When: User clicks an action
  - Then: Action fires, context menu closes
- **TC-6.3b: Close on outside click**
  - Given: Context menu is open
  - When: User clicks anywhere outside the menu
  - Then: Context menu closes, no action fires
- **TC-6.3c: Close on Escape**
  - Given: Context menu is open
  - When: User presses Escape
  - Then: Context menu closes

## Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Context menus use the `TreeNode` contract from Story 3:

```typescript
interface TreeNode {
  name: string;
  path: string;           // absolute path — used for Copy Path and Make Root
  type: "file" | "directory";
  children?: TreeNode[];
  mdCount?: number;
}
```

Actions map to existing API endpoints:

| Action | API Endpoint | Notes |
|--------|-------------|-------|
| Copy Path | POST /api/clipboard | `{ text: node.path }` |
| Make Root | PUT /api/session/root | `{ root: node.path }` |
| Save as Workspace | POST /api/session/workspaces | `{ path: node.path }` |

No new API endpoints required.

*See the tech design document for full architecture, implementation targets, and test mapping.*

## Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Right-click file shows context menu with Copy Path
- [ ] Right-click directory shows context menu with Copy Path, Make Root, Save as Workspace
- [ ] All actions fire correctly
- [ ] Context menu closes on action, outside click, or Escape
- [ ] Context menu supports keyboard navigation (TC-2.4c from Story 1)
- [ ] All tests pass
