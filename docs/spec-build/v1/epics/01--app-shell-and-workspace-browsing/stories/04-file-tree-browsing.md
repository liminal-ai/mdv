# Story 3: File Tree Browsing

## Summary
<!-- Jira: Summary field -->
Filtered markdown file tree with expand/collapse, expand all/collapse all, count badges, sorting, and folder selection entry points.

## Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user browsing directories full of markdown files. "I point this at a folder, I see my markdown files."

**Objective:** Deliver the file tree — the user sees markdown files filtered from the directory, browses with expand/collapse, uses expand all/collapse all, and sees file counts. All folder selection entry points (sidebar browse, File menu, empty state button, keyboard shortcut) produce the same result.

**Scope:**
- In: File tree rendering with markdown-only filtering (`.md`, `.markdown`, case-insensitive), hidden file exclusion, `.mdx` exclusion, symlink following, directory expand/collapse, expand all/collapse all, sort order (dirs first, alphabetical case-insensitive), markdown count badges, independent scrolling, expand state within session (not across restarts), all folder selection entry points, loading performance, file tree keyboard navigation (TC-2.4b — framework from Story 1 applied to tree nodes here)
- Out: Right-click context menus on tree nodes (Story 4), file opening on click (Epic 2)

**Dependencies:** Story 2 (root must be settable)

## Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-5.1:** File tree shows only markdown files and directories that contain markdown descendants. Markdown files are defined as files with `.md` or `.markdown` extensions, case-insensitive. Hidden files (dot-prefixed) are excluded. Symlinked markdown files are included (symlinks are followed). `.mdx` files are not markdown for this purpose.

- **TC-5.1a: Markdown files displayed**
  - Given: Root contains files: README.md, notes.md, script.sh, image.png
  - When: File tree renders
  - Then: Only README.md and notes.md appear
- **TC-5.1e: Case-insensitive extension matching**
  - Given: Root contains files: NOTES.MD, changelog.Markdown, readme.md
  - When: File tree renders
  - Then: All three files appear
- **TC-5.1f: Hidden files excluded**
  - Given: Root contains .hidden.md and visible.md
  - When: File tree renders
  - Then: Only visible.md appears
- **TC-5.1g: MDX files excluded**
  - Given: Root contains component.mdx and readme.md
  - When: File tree renders
  - Then: Only readme.md appears
- **TC-5.1h: Symlinked markdown files included with symlink path**
  - Given: Root contains a symlink `docs/link.md` pointing to a .md file outside the root
  - When: File tree renders
  - Then: The symlinked file appears in the tree. `TreeNode.path` is the symlink's path inside the root (not the resolved target), preserving root confinement. Copy Path copies the symlink path. The file-tree API never exposes paths outside the root.
- **TC-5.1b: Empty directory hidden**
  - Given: Root contains a directory with no .md files at any depth
  - When: File tree renders
  - Then: That directory is not shown
- **TC-5.1c: Nested directory with markdown shown**
  - Given: Root contains dir-a/dir-b/doc.md
  - When: File tree renders
  - Then: dir-a and dir-b are shown because they have markdown descendants
- **TC-5.1d: Mixed directory**
  - Given: A directory contains 3 .md files and 10 .ts files
  - When: File tree renders
  - Then: Only the 3 .md files appear; the .ts files are not shown

**AC-5.2:** Directories expand and collapse on click

- **TC-5.2a: Expand a directory**
  - Given: A collapsed directory node
  - When: User clicks the disclosure triangle
  - Then: Directory expands to show its children
- **TC-5.2b: Collapse a directory**
  - Given: An expanded directory node
  - When: User clicks the disclosure triangle
  - Then: Directory collapses, children are hidden
- **TC-5.2c: Expand state is preserved within session**
  - Given: User has expanded dir-a and dir-a/dir-b
  - When: User switches to a different workspace and back
  - Then: dir-a and dir-a/dir-b are still expanded

**AC-5.3:** Expand All expands every directory that has markdown descendants; Collapse All collapses all

- **TC-5.3a: Expand All behavior**
  - Given: File tree has nested directories, some with markdown, some without
  - When: User clicks Expand All
  - Then: Every directory with at least one markdown descendant is expanded. Directories with no markdown descendants are not expanded.
- **TC-5.3b: Expand All stops at leaf directories**
  - Given: A path root/a/b/c/ where c/ contains only doc.md
  - When: User clicks Expand All
  - Then: root, a, b, and c are all expanded; doc.md is visible
- **TC-5.3c: Collapse All**
  - Given: Several directories are expanded
  - When: User clicks Collapse All
  - Then: All directories collapse to show only top-level items
- **TC-5.3d: Expand All on a large tree**
  - Given: Root contains 200+ directories with markdown files
  - When: User clicks Expand All
  - Then: Tree fully expands without freezing the UI

**AC-5.4:** File tree is sorted: directories first, then files, both alphabetical case-insensitive

- **TC-5.4a: Sort order**
  - Given: A directory contains subdirectories "Docs", "api", and files "README.md", "changelog.md"
  - When: File tree renders
  - Then: Order is: api, Docs, changelog.md, README.md (directories first alphabetically, then files alphabetically, case-insensitive)

**AC-5.5:** File tree shows markdown file count per directory

- **TC-5.5a: Count displayed**
  - Given: A directory contains 14 markdown files (including nested)
  - When: User views that directory node
  - Then: A count badge shows "14" next to the directory name

**AC-5.6:** File tree scrolls independently of the rest of the sidebar

- **TC-5.6a: Overflow scrolling**
  - Given: File tree has more entries than fit in the sidebar
  - When: User scrolls within the file tree area
  - Then: File tree scrolls; Workspaces section and root line remain fixed

**AC-5.7:** File tree expand/collapse state does not persist across app restarts

- **TC-5.7a: Tree resets to collapsed on restart**
  - Given: User has expanded several directories
  - When: App restarts
  - Then: All directories start collapsed (tree contents may have changed on disk; persisting stale expand state would be misleading)

**AC-9.1:** All folder selection entry points produce the same result

- **TC-9.1a: Sidebar browse icon**
  - Given: User clicks the browse icon on the root line
  - When: User selects a folder
  - Then: Root updates, file tree refreshes
- **TC-9.1b: File menu Open Folder**
  - Given: User clicks File → Open Folder
  - When: User selects a folder
  - Then: Root updates, file tree refreshes
- **TC-9.1c: Empty state Open Folder button**
  - Given: No root is set, user clicks "Open Folder" in the content area
  - When: User selects a folder
  - Then: Root updates, file tree refreshes
- **TC-9.1d: Keyboard shortcut**
  - Given: User presses the Open Folder keyboard shortcut
  - When: User selects a folder
  - Then: Root updates, file tree refreshes

**AC-9.2:** Selecting a folder with many files loads the tree within responsive limits

- **TC-9.2a: Medium-sized directory**
  - Given: User selects a root with ~500 markdown files
  - When: Root is set
  - Then: File tree populates within 2 seconds
- **TC-9.2b: Large directory**
  - Given: User selects a root with ~2000 markdown files
  - When: Root is set
  - Then: File tree populates without freezing the UI; a loading indicator may appear briefly

## Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Relevant data contracts:

```typescript
interface FileTreeRequest {
  root: string;       // absolute path to scan
}

interface FileTreeResponse {
  root: string;
  tree: TreeNode[];
}

interface TreeNode {
  name: string;           // filename or directory name
  path: string;           // absolute path
  type: "file" | "directory";
  children?: TreeNode[];  // only for directories
  mdCount?: number;       // markdown descendant count, only for directories
}
```

API endpoint:

| Method | Path | Request | Success Response | Error |
|--------|------|---------|-----------------|-------|
| GET | /api/tree | `?root={path}` | `FileTreeResponse` | 400, 403, 404, 500 |

Markdown file definition: `.md` or `.markdown` extension, case-insensitive. Hidden files (dot-prefixed) excluded. `.mdx` excluded. Symlinks followed, but `TreeNode.path` uses the symlink path (not resolved target) to preserve root confinement.

*See the tech design document for full architecture, implementation targets, and test mapping.*

## Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] File tree renders markdown-only files with correct filtering
- [ ] Case-insensitive extensions, hidden file exclusion, mdx exclusion all work
- [ ] Symlinks followed with symlink path preserved
- [ ] Empty directories hidden, nested directories with markdown shown
- [ ] Expand/collapse directories works
- [ ] Expand state preserved within session, not across restarts
- [ ] Expand All / Collapse All functional
- [ ] Sort order: directories first, alphabetical case-insensitive
- [ ] Count badges on directories
- [ ] File tree scrolls independently
- [ ] All folder selection entry points produce same result
- [ ] File tree keyboard navigation works (TC-2.4b: arrow keys, Enter, expand/collapse — framework from Story 1 applied here)
- [ ] Tree loads within performance limits
- [ ] All tests pass
