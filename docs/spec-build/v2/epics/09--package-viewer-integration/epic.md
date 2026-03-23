# Epic 9: Package Viewer Integration

This epic defines the complete requirements for integrating the markdown package
format into the viewer. It serves as the source of truth for the Tech Lead's
design work.

---

## User Profile

**Primary User:** The developer of MD Viewer, who is also the primary product user
**Context:** Working with structured markdown collections — specs, documentation, agent outputs — and needing to open, create, navigate, edit, and share them as packages
**Mental Model:** "I open a .mpk file and the sidebar shows the manifest navigation instead of a file tree. I can create packages from folders, edit the manifest to change navigation, and export to share."
**Key Constraint:** Must consume Epic 8's library (manifest parser, tar read/write) without re-implementing any of it. The viewer runs as a Fastify server with a vanilla JS client — no component frameworks.

---

## Feature Overview

After this epic, the user can open `.mpk` or `.mpkz` package files in the viewer
and browse them with manifest-driven sidebar navigation. They can create new
packages from existing folders, edit the manifest to reorganize navigation, and
export packages for sharing. The full round-trip works: create a package, browse
it, edit the manifest, export it. When a package has no manifest, the viewer
falls back to filesystem-scan mode. The sidebar indicates which mode is active
(package or filesystem), and a stale indicator shows when extracted content has
been modified but not re-exported.

---

## Scope

### In Scope

Package viewer integration — opening, navigating, creating, editing, and
exporting markdown packages within the viewer UI:

- Opening packages: File menu, drag-and-drop onto the app, CLI argument. The server extracts the package to a temp directory and returns the parsed manifest.
- Package-mode sidebar: manifest-driven navigation tree replaces the filesystem tree. Display names from link text, hierarchy from nesting, group labels from non-linked items. Package metadata (title, version, author) shown in the sidebar header.
- Mode switching: opening a regular folder switches to filesystem mode; opening a package switches to package mode. Visual indicator of active mode.
- Package creation: File → New Package scaffolds a manifest in the current root directory from discovered markdown files, switches to package mode. This is a directory-mode package — files stay on disk, no extraction.
- Export to package: collapse the current root (directory-mode package or regular folder) to a `.mpk` or `.mpkz` file. Format selection (uncompressed/compressed) in the export flow.
- Manifest editing: the manifest is editable in the viewer's existing edit mode. Saving the manifest updates the sidebar navigation tree.
- Editing in extracted packages: edits modify files in the temp directory. A stale indicator shows when extracted content has been modified since the package was opened. Re-exporting persists changes.
- No-manifest fallback: if a package has no manifest, the sidebar shows a filesystem-scan of the extracted contents with a "no manifest" indicator.

### Out of Scope

- Chat/Steward integration with packages (Epic 13)
- Spec-specific package conventions (Epic 13)
- Remote package URLs (not planned)
- Multiple manifests per package (future)
- Streaming tar reads — extract-to-temp is sufficient (per Technical Architecture)
- Package format specification, manifest parser, tar library, CLI tool (all Epic 8)

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | Epic 8's library is complete and provides manifest parsing, tar read/write, and package creation | Unvalidated | Tech Lead | Epic 9 depends on these; does not re-implement |
| A2 | Extracted package temp directories at a few MB each are acceptable disk usage | Validated | Tech Lead | From TA5 in Technical Architecture |
| A3 | The existing file-reading, rendering, and tree-building code works on the extracted temp directory without modification | Unvalidated | Tech Lead | The package service sets the temp dir as the effective root |
| A4 | Drag-and-drop can deliver the file path of a dropped .mpk/.mpkz to the client | Unvalidated | Tech Lead | Browser drag-and-drop APIs vary; server-side path resolution may be needed |
| A5 | The manifest file name convention is settled by Epic 8 tech design | Unvalidated | Tech Lead | Candidates: `_nav.md`, `_index.md`, `manifest.md` |

---

## Flows & Requirements

### 1. Opening a Package

The user opens a `.mpk` or `.mpkz` package file via File menu, drag-and-drop, or
CLI argument. The server extracts the package to a temp directory, detects the
manifest, parses it, and returns the navigation structure. The client switches
the sidebar to package-mode navigation. If the file is invalid or not a package,
an error is shown and the current workspace is unchanged. If the package has no
manifest (or an unreadable one), the client falls back to filesystem mode (see
Flow 8).

1. User opens a package file (File → Open Package, drag-and-drop onto the app, or CLI argument)
2. Client sends the package file path to the server
3. Server extracts the package to a temp directory using Epic 8's tar library
4. Server detects and parses the manifest using Epic 8's manifest parser
5. Server returns the parsed manifest (metadata + navigation tree) and package info
6. Client switches the sidebar to package-mode navigation
7. User clicks a navigation entry
8. Server reads the file from the extracted temp directory and returns its content
9. Client renders the document through the existing rendering pipeline

#### Acceptance Criteria

**AC-1.1:** Opening a `.mpk` or `.mpkz` file via the File menu extracts the package and switches the sidebar to package-mode navigation

- **TC-1.1a: Open .mpk via File menu**
  - Given: The app is running with a filesystem workspace open
  - When: The user selects File → Open Package and picks a `.mpk` file containing a manifest with three navigation entries
  - Then: The sidebar switches to package-mode navigation showing the three entries from the manifest
- **TC-1.1b: Open .mpkz via File menu**
  - Given: The app is running
  - When: The user selects File → Open Package and picks a `.mpkz` (compressed) file
  - Then: The package is decompressed, extracted, and the sidebar shows manifest-driven navigation
- **TC-1.1c: Invalid package file**
  - Given: The app is running
  - When: The user attempts to open a file that is not a valid `.mpk` or `.mpkz` (e.g., a corrupted tar or a random binary file)
  - Then: An error message is displayed identifying the file as invalid; the current workspace is unchanged

**AC-1.2:** Dropping a `.mpk` or `.mpkz` file onto the app opens it as a package

- **TC-1.2a: Drag-and-drop opens package**
  - Given: The app is running
  - When: The user drops a `.mpk` file onto the app window
  - Then: The package is opened and the sidebar switches to package-mode navigation
- **TC-1.2b: Dropping a non-package file does not change mode**
  - Given: The app is running with a filesystem workspace open
  - When: The user drops a `.txt` file onto the app
  - Then: The drop is ignored or handled by existing drop behavior; the sidebar remains in its current mode

**AC-1.3:** A package file path passed as a CLI argument opens the package on app startup

- **TC-1.3a: CLI argument opens package**
  - Given: The app is started with a `.mpk` file path as a CLI argument
  - When: The app finishes loading
  - Then: The sidebar shows package-mode navigation from the manifest in that package
- **TC-1.3b: CLI argument with non-existent file**
  - Given: The app is started with a non-existent file path as a CLI argument
  - When: The app finishes loading
  - Then: An error message is shown and no workspace is open (default empty state)
- **TC-1.3c: CLI argument with non-package file**
  - Given: The app is started with a non-package file (e.g., `.txt`) as a CLI argument
  - When: The app finishes loading
  - Then: The file is handled by existing folder/file open behavior, not treated as a package

**AC-1.4:** Clicking a navigation entry in package mode opens the corresponding document in the content area

- **TC-1.4a: Navigation entry opens document**
  - Given: A package is open with manifest navigation showing entries including "Getting Started" linked to `getting-started.md`
  - When: The user clicks "Getting Started"
  - Then: The content area renders the markdown content of `getting-started.md` from the extracted package
- **TC-1.4b: Nested navigation entry opens document**
  - Given: A package is open with a manifest containing a group "Authentication" with a child entry "OAuth2 Flow" linked to `auth/oauth2.md`
  - When: The user clicks "OAuth2 Flow"
  - Then: The content area renders `auth/oauth2.md`
- **TC-1.4c: A tab is created for the opened document**
  - Given: No documents are open
  - When: The user clicks a navigation entry
  - Then: A tab appears in the tab strip with the entry's display name
- **TC-1.4d: Navigation entry references a missing file**
  - Given: A manifest references `missing.md` that does not exist in the package
  - When: The user clicks the entry
  - Then: An error message is shown in the content area indicating the file was not found
- **TC-1.4e: Rendering parity with filesystem mode**
  - Given: A package contains a document with a Mermaid diagram and a fenced code block
  - When: The user opens it via package navigation
  - Then: The Mermaid diagram renders as an SVG and the code block has syntax highlighting (same rendering as files opened from the filesystem)

**AC-1.5:** Group labels in the navigation tree are non-clickable headings that organize child entries

- **TC-1.5a: Group label is displayed but not clickable**
  - Given: A package is open with a manifest containing a group label "Endpoints" with child entries
  - When: The user views the sidebar
  - Then: "Endpoints" appears as a heading, its child entries are indented beneath it, and clicking "Endpoints" does not open a document
- **TC-1.5b: Group labels can be collapsed and expanded**
  - Given: A group label "Endpoints" has three child entries visible
  - When: The user collapses the group
  - Then: The child entries are hidden; expanding the group shows them again

### 2. Package-Mode Sidebar and Metadata

The sidebar in package mode displays the manifest-driven navigation tree and
package metadata. The navigation tree reflects the manifest's structure:
display names, hierarchy, and group labels. Package metadata from the manifest
frontmatter (title, version, author) is shown in the sidebar header area.

1. Package is opened and sidebar switches to package mode
2. Sidebar header shows package metadata (title, version, author)
3. Navigation tree shows manifest entries with proper hierarchy
4. A visual indicator shows that the sidebar is in package mode

#### Acceptance Criteria

**AC-2.1:** The sidebar displays package metadata from the manifest frontmatter

- **TC-2.1a: Full metadata displayed**
  - Given: A package is open whose manifest frontmatter contains title, version, and author
  - When: The sidebar is in package mode
  - Then: The sidebar header area shows the title, version, and author
- **TC-2.1b: Partial metadata displayed**
  - Given: A package is open whose manifest frontmatter contains only a title (no version or author)
  - When: The sidebar is in package mode
  - Then: The sidebar header shows the title; version and author are omitted (no empty placeholders)
- **TC-2.1c: No metadata**
  - Given: A package is open whose manifest has no YAML frontmatter
  - When: The sidebar is in package mode
  - Then: The sidebar header shows a default label (the package filename) instead of metadata fields

**AC-2.2:** The sidebar shows a visual indicator distinguishing package mode from filesystem mode

- **TC-2.2a: Package mode indicator present**
  - Given: A package is open
  - When: The sidebar is in package mode
  - Then: A visual indicator (label, icon, or styling) is present that identifies the mode as package mode
- **TC-2.2b: Filesystem mode indicator present**
  - Given: A regular folder is open (no package)
  - When: The sidebar is in filesystem mode
  - Then: The mode indicator reflects filesystem mode, visually distinct from package mode

**AC-2.3:** The navigation tree preserves the manifest's hierarchy with correct display names

- **TC-2.3a: Flat list**
  - Given: A package with a manifest containing a flat list of five linked entries
  - When: The sidebar displays the navigation tree
  - Then: Five entries appear at the top level, each showing its display name from the manifest link text
- **TC-2.3b: Nested hierarchy**
  - Given: A package with a manifest containing top-level entries and groups with nested children
  - When: The sidebar displays the navigation tree
  - Then: The tree structure matches the manifest nesting — groups at the top level, linked entries indented under their parent groups
- **TC-2.3c: Three levels of nesting**
  - Given: A manifest with three levels of nesting (top → group → sub-group → entry)
  - When: The sidebar displays the navigation tree
  - Then: All three levels are rendered with progressive indentation

### 3. Mode Switching

The viewer supports two sidebar modes: filesystem mode (file tree from disk) and
package mode (manifest-driven navigation). Opening a regular folder switches to
filesystem mode. Opening a package switches to package mode. Only one mode is
active at a time.

1. User has a package open (package mode active)
2. User opens a regular folder via File → Open Folder
3. Sidebar switches to filesystem mode with the file tree
4. User opens a package again
5. Sidebar switches back to package mode

#### Acceptance Criteria

**AC-3.1:** Opening a regular folder while in package mode switches the sidebar to filesystem mode

- **TC-3.1a: Switch from package to filesystem mode**
  - Given: A package is open and the sidebar is in package mode
  - When: The user opens a regular folder via File → Open Folder
  - Then: The sidebar switches to filesystem mode showing the folder's file tree, and the package mode indicator is replaced by the filesystem mode indicator
- **TC-3.1b: Previously opened package tabs are closed**
  - Given: A package is open with documents open in tabs
  - When: The user switches to a regular folder
  - Then: Tabs from the package are closed (the documents are in a temp directory that is no longer the active root)

**AC-3.2:** Opening a package while in filesystem mode switches the sidebar to package mode

- **TC-3.2a: Switch from filesystem to package mode**
  - Given: A regular folder is open and the sidebar is in filesystem mode
  - When: The user opens a `.mpk` file
  - Then: The sidebar switches to package mode showing the manifest navigation

**AC-3.3:** Opening a different package while one is already open replaces the current package

- **TC-3.3a: Replace current package**
  - Given: Package A is open with its navigation displayed
  - When: The user opens Package B
  - Then: The sidebar shows Package B's navigation; Package A's temp directory is removed

### 4. Package Creation

The user creates a new package from the current root directory. File → New
Package scaffolds a manifest file containing entries for the directory's
markdown files, and switches the sidebar to package mode. This is a
directory-mode package — files remain on disk, no extraction needed. If a
manifest already exists, a confirmation prompt asks before overwriting. New
Package is disabled for extracted packages that already have a manifest, but
available for extracted packages in filesystem fallback mode (missing or unreadable manifest).

1. User has a regular folder open in filesystem mode
2. User selects File → New Package
3. Server scans the directory for markdown files
4. Server creates a manifest file at the directory root with entries for each discovered markdown file
5. Server returns the parsed manifest
6. Client switches the sidebar to package mode
7. User can edit the manifest to customize navigation

#### Acceptance Criteria

**AC-4.1:** File → New Package creates a manifest file in the current root directory

- **TC-4.1a: Manifest scaffolded with discovered files**
  - Given: A folder is open containing `readme.md`, `guide.md`, and `docs/api.md`
  - When: The user selects File → New Package
  - Then: A manifest file is created at the directory root containing navigation entries for all three markdown files, sorted alphabetically by file path (`docs/api.md`, `guide.md`, `readme.md`)
- **TC-4.1b: Manifest frontmatter includes directory name as title**
  - Given: A folder named "my-project" is open
  - When: The user creates a new package
  - Then: The scaffolded manifest's frontmatter has `title: my-project`
- **TC-4.1c: Sidebar switches to package mode**
  - Given: The sidebar is in filesystem mode
  - When: The user creates a new package
  - Then: The sidebar switches to package mode showing the scaffolded navigation tree
- **TC-4.1d: Dotfiles excluded from scaffolding**
  - Given: A folder contains `readme.md`, `.hidden.md`, and `guide.md`
  - When: The user selects File → New Package
  - Then: The scaffolded manifest contains entries for `guide.md` and `readme.md` only; `.hidden.md` is excluded

**AC-4.2:** Creating a package when a manifest already exists shows a confirmation prompt

- **TC-4.2a: Existing manifest — user confirms overwrite**
  - Given: A folder is open that already contains a manifest file
  - When: The user selects File → New Package and confirms the overwrite prompt
  - Then: The existing manifest is replaced with a newly scaffolded manifest
- **TC-4.2b: Existing manifest — user cancels**
  - Given: A folder is open that already contains a manifest file
  - When: The user selects File → New Package and cancels the overwrite prompt
  - Then: The existing manifest is unchanged; the sidebar remains in its current mode

**AC-4.3:** Creating a package in an empty directory (no markdown files) produces a manifest with no navigation entries

- **TC-4.3a: Empty directory**
  - Given: A folder is open that contains no markdown files
  - When: The user selects File → New Package
  - Then: A manifest is created with frontmatter only (title from directory name) and an empty navigation body; the sidebar switches to package mode showing no entries

**AC-4.4:** New Package is not available when a package **with a parseable manifest** (extracted from .mpk/.mpkz) is the active root

- **TC-4.4a: Menu item disabled for extracted packages with parseable manifest**
  - Given: A `.mpk` file with a parseable manifest is open (extracted to a temp directory)
  - When: The user views the File menu
  - Then: The "New Package" option is disabled or not visible

### 5. Export to Package

The user exports the current root to a `.mpk` or `.mpkz` file. This works for
both directory-mode packages (folders with a manifest) and regular folders
(manifest is auto-scaffolded). The user picks the output path and format.
For extracted packages, re-exporting captures the current state of modified
files. The user can cancel the export at the save dialog without side effects.

1. User has a folder or directory-mode package open
2. User selects File → Export Package (or equivalent menu item)
3. App presents a save dialog for the output file with format selection
4. User picks a location and format (.mpk or .mpkz)
5. Server creates the package file using Epic 8's library
6. Success confirmation is shown

#### Acceptance Criteria

**AC-5.1:** Exporting the current root produces a valid `.mpk` or `.mpkz` file

- **TC-5.1a: Export to .mpk**
  - Given: A directory-mode package is open (folder with a manifest)
  - When: The user exports as `.mpk`
  - Then: A `.mpk` file is created at the chosen path; opening it in another viewer instance shows the same navigation structure
- **TC-5.1b: Export to .mpkz**
  - Given: A directory-mode package is open
  - When: The user exports as `.mpkz`
  - Then: A `.mpkz` (compressed) file is created at the chosen path
- **TC-5.1c: Export includes all files referenced by the manifest and supporting assets**
  - Given: A manifest references `docs/api.md` which contains an image reference to `images/diagram.png`
  - When: The user exports the package
  - Then: The exported package contains the manifest, `docs/api.md`, `images/diagram.png`, and all other files in the directory tree

**AC-5.2:** Exporting a folder without a manifest auto-scaffolds a manifest before export (same discovery and sort rules as AC-4.1 — alphabetical by path, dotfiles excluded)

- **TC-5.2a: Auto-scaffold on export**
  - Given: A regular folder is open (no manifest file)
  - When: The user exports as `.mpk`
  - Then: A manifest is scaffolded (not written to disk in the source folder), included in the exported package, and the package is valid
- **TC-5.2b: Source directory is not modified**
  - Given: A regular folder is open (no manifest)
  - When: The user exports as `.mpk`
  - Then: No manifest file is created in the source directory; the scaffolded manifest exists only in the package

**AC-5.3:** Exporting an extracted package re-packages the current state of the extracted files

- **TC-5.3a: Re-export after editing**
  - Given: A `.mpk` file was opened, a document was edited in the extracted temp directory
  - When: The user exports the package
  - Then: The exported package contains the edited version of the document
- **TC-5.3b: Stale indicator clears after re-export to original path**
  - Given: The stale indicator is showing (extracted content modified)
  - When: The user re-exports the package to the original file path
  - Then: The stale indicator clears
- **TC-5.3c: Stale indicator remains after export to different path**
  - Given: The stale indicator is showing (extracted content modified)
  - When: The user exports the package to a **different** file path than the original
  - Then: The stale indicator remains (the original package file is still out of date)

**AC-5.4:** The user can cancel the export at the save dialog

- **TC-5.4a: Cancel export**
  - Given: The export save dialog is open
  - When: The user cancels the dialog
  - Then: No package file is created; the app returns to the previous state

### 6. Manifest Editing

The manifest file is a markdown file that the user can edit using the viewer's
existing edit mode. Saving changes to the manifest updates the package-mode
sidebar navigation tree. If the saved manifest has malformed YAML, a parse error
is shown and the sidebar retains its previous state. If the manifest is valid
but has no navigation entries, a warning is shown and the sidebar updates to an
empty state.

1. User opens the manifest in the content area (via a dedicated action or by clicking a manifest entry)
2. User toggles edit mode
3. User modifies the manifest content (adds, removes, or reorders navigation entries)
4. User saves the manifest
5. The sidebar navigation tree updates to reflect the changes

#### Acceptance Criteria

**AC-6.1:** The user can open the manifest file in the content area

- **TC-6.1a: Open manifest via sidebar action**
  - Given: A package is open in package mode
  - When: The user activates the "Edit Manifest" action (e.g., a button or context menu in the sidebar header)
  - Then: The manifest file opens in the content area as a rendered markdown document
- **TC-6.1b: Manifest opens in a tab**
  - Given: Other documents are open in tabs
  - When: The user opens the manifest
  - Then: A tab appears for the manifest file

**AC-6.2:** Editing and saving the manifest updates the sidebar navigation tree

- **TC-6.2a: Add a navigation entry**
  - Given: The manifest is open in edit mode with three navigation entries
  - When: The user adds a fourth linked entry `[New Page](new-page.md)` and saves
  - Then: The sidebar navigation tree shows four entries including "New Page"
- **TC-6.2b: Remove a navigation entry**
  - Given: The manifest has four navigation entries
  - When: The user removes one entry from the manifest and saves
  - Then: The sidebar shows three entries; the removed entry is gone
- **TC-6.2c: Reorder navigation entries**
  - Given: The manifest has entries A, B, C in order
  - When: The user reorders them to C, A, B in the manifest and saves
  - Then: The sidebar shows the entries in the new order: C, A, B
- **TC-6.2d: Add a group label**
  - Given: The manifest has flat entries
  - When: The user adds a non-linked item "Reference" above two entries, indents them under it, and saves
  - Then: The sidebar shows "Reference" as a group label with the two entries nested beneath it

**AC-6.3:** Saving a manifest with unparseable content (malformed YAML) shows a parse error and retains the previous sidebar state

- **TC-6.3a: Malformed YAML frontmatter**
  - Given: The manifest is open in edit mode
  - When: The user introduces malformed YAML in the frontmatter and saves
  - Then: The file is saved, an error is shown indicating a parse error, and the sidebar retains its previous state until the manifest is fixed

**AC-6.4:** Saving a manifest with valid but empty navigation shows a warning and updates the sidebar to an empty state

- **TC-6.4a: Manifest with no navigation entries**
  - Given: The manifest is open in edit mode
  - When: The user deletes all list items (leaving only frontmatter) and saves
  - Then: The file is saved, a warning is shown indicating the manifest has no navigation entries, and the sidebar updates to show an empty state

### 7. Editing in Extracted Packages and Stale Indicator

When a `.mpk`/`.mpkz` package is opened, it is extracted to a temp directory.
The user can edit files in the extracted package using the viewer's edit mode.
A stale indicator shows when the extracted content has diverged from the
original package file.

1. User opens a `.mpk` file — it is extracted to a temp directory
2. User opens a document from the package navigation
3. User edits the document and saves
4. The edit modifies the file in the temp directory
5. A stale indicator appears on the package
6. User re-exports to persist changes back to a package file

#### Acceptance Criteria

**AC-7.1:** Edits to files in an extracted package modify the temp directory copy

- **TC-7.1a: Edit and save in extracted package**
  - Given: A `.mpk` package is open and a document is displayed
  - When: The user toggles edit mode, modifies the content, and saves
  - Then: The file in the temp directory contains the updated content
- **TC-7.1b: Rendered view reflects the edit**
  - Given: The user has saved an edit to a document in the extracted package
  - When: The user switches back to view mode
  - Then: The rendered content reflects the saved changes

**AC-7.2:** A stale indicator appears when any file in the extracted package has been modified

- **TC-7.2a: Stale indicator appears after first edit**
  - Given: A `.mpk` package was just opened (no edits)
  - When: The user edits and saves any document in the package
  - Then: A stale indicator is visible (e.g., in the sidebar header or package metadata area)
- **TC-7.2b: Stale indicator remains after multiple edits**
  - Given: The stale indicator is already showing
  - When: The user edits and saves a different document
  - Then: The stale indicator remains visible
- **TC-7.2c: Stale indicator is not present for directory-mode packages**
  - Given: A directory-mode package is open (folder with manifest, not extracted from .mpk)
  - When: The user edits and saves a document
  - Then: No stale indicator appears (directory-mode packages are edited in place)

### 8. No-Manifest Fallback

When a package has no manifest file, or when the manifest is unreadable, the
viewer falls back to displaying the package contents as a filesystem tree (the
same view used for regular folders). An indicator shows that the package is in
fallback mode.

1. User opens a `.mpk` file that contains no manifest
2. Server extracts the package but finds no manifest at the root
3. Server returns a fallback response indicating no manifest was found
4. Client displays the extracted contents as a filesystem tree
5. A fallback indicator is shown in the sidebar

#### Acceptance Criteria

**AC-8.1:** A package with no manifest displays its contents as a filesystem tree

- **TC-8.1a: Filesystem fallback**
  - Given: A `.mpk` file contains markdown files but no manifest file
  - When: The user opens the package
  - Then: The sidebar shows the extracted files as a filesystem tree (same as opening a regular folder)
- **TC-8.1b: Files are navigable**
  - Given: A no-manifest package is open in filesystem fallback mode
  - When: The user clicks a markdown file in the tree
  - Then: The file opens in the content area and renders normally
- **TC-8.1c: Unreadable manifest triggers filesystem fallback**
  - Given: A `.mpk` file contains a manifest with malformed YAML
  - When: The user opens the package
  - Then: The sidebar shows the extracted files as a filesystem tree (same as a missing manifest)

**AC-8.2:** A fallback indicator is visible when a package has a missing or unreadable manifest

- **TC-8.2a: Indicator present**
  - Given: A package is open in filesystem fallback mode
  - When: The user views the sidebar
  - Then: An indicator (label or icon) conveys that the package has no manifest and is showing a filesystem view
- **TC-8.2b: Indicator not shown for regular folders**
  - Given: A regular folder is open (not a package)
  - When: The user views the sidebar
  - Then: The "no manifest" indicator is not present
- **TC-8.2c: Unreadable manifest shows distinct indicator**
  - Given: A package has a manifest that could not be parsed (malformed YAML)
  - When: The user views the sidebar
  - Then: The fallback indicator says the manifest could not be parsed (distinct from the "no manifest" indicator)

**AC-8.3:** The user can create a manifest for a package in filesystem fallback mode (missing or unreadable manifest) to switch to package mode

- **TC-8.3a: Scaffold manifest in extracted package with no manifest**
  - Given: A package with no manifest file is open in filesystem fallback mode
  - When: The user selects File → New Package
  - Then: A manifest is scaffolded in the extracted temp directory, the sidebar switches to package mode, and the stale indicator appears (the package now differs from its source)
- **TC-8.3b: Scaffold manifest in extracted package with unreadable manifest**
  - Given: An extracted package has an unreadable manifest and is in fallback mode
  - When: The user selects File → New Package
  - Then: The overwrite confirmation prompt appears (since the manifest file exists), and confirming it scaffolds a new manifest, the sidebar switches to package mode, and the stale indicator appears

### 9. Temp Directory Cleanup

Extracted packages live in temp directories. These must be cleaned up to avoid
disk accumulation.

#### Acceptance Criteria

**AC-9.1:** When the user closes a package (by switching to another workspace or opening a different package), the previous package's temp directory is removed

- **TC-9.1a: Temp directory removed on package switch**
  - Given: Package A is open (extracted to a temp directory)
  - When: The user opens a regular folder or Package B
  - Then: Package A's temp directory is removed or marked for removal

**AC-9.2:** On app startup, stale temp directories from previous sessions are cleaned up

- **TC-9.2a: Startup cleanup**
  - Given: The app was previously closed while a package was open (leaving a temp directory)
  - When: The app starts
  - Then: Stale temp directories from previous sessions are removed

---

## Data Contracts

### REST Endpoints

#### POST /api/package/open

Open a `.mpk` or `.mpkz` file. Extracts to a temp directory and returns the
parsed manifest.

**Request:**

```typescript
interface PackageOpenRequest {
  filePath: string;          // absolute path to the .mpk or .mpkz file
}
```

**Success Response (200):**

```typescript
interface PackageOpenResponse {
  metadata: ManifestMetadata;       // from Epic 8's types
  navigation: NavigationNode[];     // from Epic 8's types
  packageInfo: {
    sourcePath: string;             // the original .mpk/.mpkz path
    extractedRoot: string;          // the temp directory path (effective root)
    format: 'mpk' | 'mpkz';
    manifestStatus: 'present' | 'missing' | 'unreadable';
    manifestError?: string;         // parse error message when status is 'unreadable'
  };
  // When manifestStatus is 'missing': metadata is {} and navigation is []
  // When manifestStatus is 'unreadable': metadata is {}, navigation is [], and manifestError contains the parse error
  // Both 'missing' and 'unreadable' trigger filesystem fallback on the client
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_FILE_PATH | File path is missing or not absolute |
| 400 | INVALID_ARCHIVE | File is not a valid tar / gzip-tar archive |
| 404 | FILE_NOT_FOUND | The specified .mpk/.mpkz file does not exist |
| 500 | EXTRACTION_ERROR | Extraction to temp directory failed |

#### GET /api/package/manifest

Return the current package's parsed manifest. Used for sidebar re-sync after
manifest edits.

**Query Parameters:** None (uses the currently active package context)

**Success Response (200):**

```typescript
interface PackageManifestResponse {
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
  raw: string;                      // raw manifest content — used by the manifest editing flow to populate the editor without a separate file fetch
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 404 | NO_ACTIVE_PACKAGE | No package is currently open |
| 404 | MANIFEST_NOT_FOUND | Active package has no manifest (fallback mode) |
| 422 | MANIFEST_PARSE_ERROR | Manifest exists but could not be parsed |

#### GET /api/package/file

Read a file from the active extracted package by its path within the package.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| path | string | Yes | File path relative to the package root |

**Success Response (200):**

```typescript
interface PackageFileResponse {
  content: string;
  filePath: string;                 // the resolved file path
  mimeType: string;
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | MISSING_PATH | The `path` query parameter is missing |
| 404 | NO_ACTIVE_PACKAGE | No package is currently open |
| 404 | FILE_NOT_FOUND | The specified file does not exist in the package |

#### POST /api/package/create

Create a new package by scaffolding a manifest in a directory. Does not produce
a .mpk file — it creates a directory-mode package.

**Request:**

```typescript
interface PackageCreateRequest {
  rootDir: string;                  // the directory to scaffold a manifest in
  overwrite?: boolean;              // if true, overwrite existing manifest
}
```

**Success Response (200):**

```typescript
interface PackageCreateResponse {
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
  manifestPath: string;             // path to the created manifest file
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_DIR_PATH | Directory path is missing or not absolute |
| 404 | DIR_NOT_FOUND | The specified directory does not exist |
| 409 | MANIFEST_EXISTS | A manifest already exists and `overwrite` is not true |

#### POST /api/package/export

Export the current root or package to a `.mpk` or `.mpkz` file.

**Request:**

```typescript
interface PackageExportRequest {
  outputPath: string;               // absolute path for the output file
  compress?: boolean;               // false → .mpk (default), true → .mpkz
  sourceDir?: string;               // optional; defaults to active package/root
}
```

**Success Response (200):**

```typescript
interface PackageExportResponse {
  outputPath: string;
  format: 'mpk' | 'mpkz';
  fileCount: number;                // number of files in the package
  sizeBytes: number;                // total package file size
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_OUTPUT_PATH | Output path is missing or not absolute |
| 400 | NO_SOURCE | No active root or package to export |
| 500 | EXPORT_ERROR | Package creation failed |

### Shared Types (from Epic 8)

Epic 9 reuses `ManifestMetadata`, `NavigationNode`, and `ParsedManifest` from
Epic 8's data contracts. These are not redefined here.

---

## Dependencies

Technical dependencies:
- Epic 8 (package format foundation) complete — manifest parser, tar read/write, package creation
- Epics 1–6 (v1 viewer surface) complete — rendering, file tree, edit mode, tabs, export, session
- Epic 7 (E2E test infrastructure) available for E2E tests

Process dependencies:
- Epic 8's manifest file name convention must be settled before Epic 9 implementation begins

---

## Non-Functional Requirements

### Performance
- Opening a package (extraction + manifest parse) completes within 3 seconds for packages up to 10 MB
- Manifest re-parse after editing completes within 500ms for manifests up to 500 entries
- Sidebar navigation tree renders within 1 second after receiving the parsed manifest

### Disk Usage
- Temp directories are cleaned up when no longer needed (package close, app quit, startup stale cleanup)
- At most one extracted package temp directory exists at a time

### Reliability
- If extraction or manifest parsing fails, the app remains usable — the error is shown and the previous workspace state is preserved
- Temp directory cleanup failures are logged but do not crash the app

---

## Tech Design Questions

Questions for the Tech Lead to address during design:

1. **Temp directory lifecycle:** When exactly are temp directories cleaned up — on package close, on app quit, on startup (stale cleanup), on crash recovery? What mechanism identifies stale temp directories?
2. **Manifest update propagation:** When the user edits the manifest in edit mode and saves, how does the sidebar re-sync? Does the client re-fetch `GET /api/package/manifest` on save, or does the server push an update via WebSocket?
3. **Package metadata display location:** Where does the metadata (title, version, author) appear — in the sidebar header, in a collapsible panel, or in a tooltip? What is the layout when metadata fields are missing?
4. **Drag-and-drop integration:** How does dropping a `.mpk` file interact with the existing drag-and-drop behavior (if any)? Does the client detect the file extension and route to the package open flow?
5. **Sidebar coexistence:** Does the package-mode sidebar replace the filesystem sidebar component entirely, or is it a separate view that swaps in? How is the swap managed in vanilla JS?
6. **Active package state:** Where is the active package state stored on the server — in memory, in the session file? What fields constitute the package state (source path, extracted root, format, manifestStatus, stale)?
7. **Stale detection mechanism:** How is "stale" tracked — by comparing file modification times against the extraction time, or by setting a flag on any write operation to the temp directory?
8. **File watching in extracted packages:** Does the existing WebSocket file-watch mechanism work on the temp directory, or does it need configuration to watch the extracted root?
9. **Export save dialog:** How does format selection (.mpk vs .mpkz) work in the save dialog — file extension filter, a separate dropdown, or inferred from the chosen filename extension?
10. **Existing endpoint compatibility:** Do existing endpoints (`/api/file`, `/api/tree`, `/api/image`) need modification to work with the extracted temp directory as root, or does setting the session root to the temp dir handle it transparently?
11. **Package open from CLI:** How is a CLI argument distinguished from a folder path — by file extension (.mpk/.mpkz), or by probing the file type?

---

## Recommended Story Breakdown

### Story 0: Foundation (Infrastructure)

**Delivers:** Package-related REST route scaffolds (stubs returning 501), shared
types for package request/response contracts, package service skeleton, temp
directory management utility, and any session state extensions needed for
tracking the active package. E2E test fixtures for package operations (sample
.mpk and .mpkz files with known manifest content).

**Prerequisite:** Epic 8 complete

**Infrastructure prepared for:** AC-9.1, AC-9.2 (testable ACs owned by Story 7)

**Estimated test count:** 4–6 tests

### Story 1: Open Package and Package-Mode Sidebar

**Delivers:** The user can open a `.mpk` or `.mpkz` file via the File menu and
see manifest-driven navigation in the sidebar. Clicking navigation entries opens
documents. Group labels display as non-clickable headings. Package metadata
appears in the sidebar header. Mode indicator shows package mode.

**Prerequisite:** Story 0

**ACs covered:**
- AC-1.1 (open package via File menu)
- AC-1.4 (navigation entry opens document)
- AC-1.5 (group labels)
- AC-2.1 (package metadata display)
- AC-2.2 (mode indicator)
- AC-2.3 (navigation tree hierarchy)

**Estimated test count:** 12–16 tests

### Story 2: Mode Switching and Additional Open Methods

**Delivers:** Switching between package mode and filesystem mode. Opening
packages via drag-and-drop and CLI argument. Replacing one open package with
another.

**Prerequisite:** Story 1

**ACs covered:**
- AC-1.2 (drag-and-drop open)
- AC-1.3 (CLI argument open)
- AC-3.1 (switch from package to filesystem mode)
- AC-3.2 (switch from filesystem to package mode)
- AC-3.3 (replace current package)

**Estimated test count:** 8–10 tests

### Story 3: Package Creation

**Delivers:** File → New Package scaffolds a manifest and switches to package
mode. Handles existing manifest (confirm overwrite), empty directories, and
disabled state for extracted packages with parseable manifest.

**Prerequisite:** Story 1

**ACs covered:**
- AC-4.1 (scaffold manifest and switch to package mode)
- AC-4.2 (existing manifest confirmation)
- AC-4.3 (empty directory)
- AC-4.4 (disabled for extracted packages)

**Estimated test count:** 6–8 tests

### Story 4: Export to Package

**Delivers:** Export the current root or package to `.mpk` or `.mpkz`. Format
selection, auto-scaffold for folders without manifest, re-export of extracted
packages, cancel flow.

**Prerequisite:** Story 1

**ACs covered:**
- AC-5.1 (export to .mpk/.mpkz)
- AC-5.2 (auto-scaffold on export)
- AC-5.3 (re-export extracted package, stale indicator clears)
- AC-5.4 (cancel export)

**Estimated test count:** 7–9 tests

### Story 5: Manifest Editing and Sidebar Re-Sync

**Delivers:** Open the manifest in the editor, edit it, save, and see the
sidebar navigation tree update. Error handling for invalid manifest content.

**Prerequisite:** Story 1

**ACs covered:**
- AC-6.1 (open manifest in content area)
- AC-6.2 (edit manifest updates sidebar)
- AC-6.3 (unparseable manifest retains sidebar)
- AC-6.4 (empty navigation warning and sidebar update)

**Estimated test count:** 8–10 tests

### Story 6: Editing in Extracted Packages and Stale Indicator

**Delivers:** Edit files in extracted packages, stale indicator when content
has been modified, clearing stale on re-export.

**Prerequisite:** Story 1, Story 4 (for re-export stale clearing)

**ACs covered:**
- AC-7.1 (edits modify temp directory)
- AC-7.2 (stale indicator)

**Estimated test count:** 5–7 tests

### Story 7: No-Manifest Fallback and Cleanup

**Delivers:** Filesystem fallback for packages without manifests, "no manifest"
indicator, ability to scaffold a manifest in fallback mode. Temp directory
cleanup on package close and app startup.

**Prerequisite:** Story 1, Story 3 (for manifest scaffolding in fallback mode)

**ACs covered:**
- AC-8.1 (filesystem fallback)
- AC-8.2 (no manifest indicator)
- AC-8.3 (scaffold manifest in fallback mode)
- AC-9.1 (temp cleanup on package switch)
- AC-9.2 (startup stale cleanup)

**Estimated test count:** 6–8 tests

---

## Validation Checklist

- [x] User Profile has all four fields + Feature Overview
- [x] Flows cover all paths (happy, alternate, cancel/error)
- [x] Every AC is testable (no vague terms)
- [x] Every AC has at least one TC
- [x] TCs cover happy path, edge cases, and errors
- [x] Data contracts are fully typed (REST endpoints, request/response types, error codes)
- [x] Scope boundaries are explicit (in/out/assumptions)
- [x] Dependencies documented
- [x] Story breakdown covers all ACs (30 ACs mapped across Stories 0–7)
- [x] Stories sequence logically (foundation first, open/navigate before create/export/edit)
- [x] Self-review complete
