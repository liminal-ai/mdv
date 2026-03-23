# Epic 9: Package Viewer Integration — Business Epic

<!-- Jira: Epic -->

---

## User Profile
<!-- Jira: Epic Description — User Profile section -->

**Primary User:** The developer of MD Viewer, who is also the primary product user
**Context:** Working with structured markdown collections — specs, documentation, agent outputs — and needing to open, create, navigate, edit, and share them as packages
**Mental Model:** "I open a .mpk file and the sidebar shows the manifest navigation instead of a file tree. I can create packages from folders, edit the manifest to change navigation, and export to share."
**Key Constraint:** Must consume the package format library (manifest parser, tar read/write) without re-implementing any of it. The viewer runs as a server with a vanilla JS client — no component frameworks.

---

## Feature Overview
<!-- Jira: Epic Description — Feature Overview section -->

After this epic, the user can open `.mpk` or `.mpkz` package files in the viewer and browse them with manifest-driven sidebar navigation. They can create new packages from existing folders, edit the manifest to reorganize navigation, and export packages for sharing. The full round-trip works: create a package, browse it, edit the manifest, export it. When a package has no manifest, the viewer falls back to filesystem-scan mode. The sidebar indicates which mode is active (package or filesystem), and a stale indicator shows when extracted content has been modified but not re-exported.

---

## Scope
<!-- Jira: Epic Description — Scope section -->

### In Scope

Package viewer integration — opening, navigating, creating, editing, and exporting markdown packages within the viewer UI:

- Opening packages: File menu, drag-and-drop onto the app, CLI argument. The server extracts the package to a temp directory and returns the parsed manifest.
- Package-mode sidebar: manifest-driven navigation tree replaces the filesystem tree. Display names from link text, hierarchy from nesting, group labels from non-linked items. Package metadata (title, version, author) shown in the sidebar header.
- Mode switching: opening a regular folder switches to filesystem mode; opening a package switches to package mode. Visual indicator of active mode.
- Package creation: File → New Package scaffolds a manifest in the current root directory from discovered markdown files, switches to package mode.
- Export to package: collapse the current root to a `.mpk` or `.mpkz` file. Format selection (uncompressed/compressed) in the export flow.
- Manifest editing: the manifest is editable in the viewer's existing edit mode. Saving the manifest updates the sidebar navigation tree.
- Editing in extracted packages: edits modify files in the temp directory. A stale indicator shows when extracted content has been modified since the package was opened. Re-exporting persists changes.
- No-manifest fallback: if a package has no manifest, the sidebar shows a filesystem-scan of the extracted contents with a "no manifest" indicator.

### Out of Scope

- Chat/Steward integration with packages (Epic 13)
- Spec-specific package conventions (Epic 13)
- Remote package URLs (not planned)
- Multiple manifests per package (future)
- Package format specification, manifest parser, tar library, CLI tool (all Epic 8)

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | The package format library is complete and provides manifest parsing, tar read/write, and package creation | Unvalidated | Tech Lead | Epic 9 depends on these; does not re-implement |
| A2 | Extracted package temp directories at a few MB each are acceptable disk usage | Validated | Tech Lead | From Technical Architecture |
| A3 | The existing file-reading, rendering, and tree-building code works on the extracted temp directory without modification | Unvalidated | Tech Lead | The package service sets the temp dir as the effective root |
| A4 | Drag-and-drop can deliver the file path of a dropped package to the client | Unvalidated | Tech Lead | Browser drag-and-drop APIs vary; server-side path resolution may be needed |
| A5 | The manifest file name convention is settled by the package format library | Unvalidated | Tech Lead | Candidates: `_nav.md`, `_index.md`, `manifest.md` |

---

## Flows & Requirements
<!-- Jira: Epic Description — Requirements section -->

### 1. Opening a Package (AC-1.1 through AC-1.5)

The user opens a package file via the File menu, drag-and-drop, or CLI argument. The server extracts the package to a temp directory, parses the manifest, and returns the navigation structure. The client switches the sidebar to package-mode navigation. Invalid files produce an error without changing the current workspace. Clicking a navigation entry opens the corresponding document in the content area — rendering is identical to files opened from the filesystem. Group labels appear as non-clickable headings that organize child entries and can be collapsed/expanded.

*(See Story 1 for AC-1.1, AC-1.4, AC-1.5 and Story 2 for AC-1.2, AC-1.3 — detailed ACs and test conditions.)*

### 2. Package-Mode Sidebar and Metadata (AC-2.1 through AC-2.3)

The sidebar in package mode displays package metadata (title, version, author) from the manifest frontmatter in the header area. Missing metadata fields are omitted without placeholders; if no metadata is present, the package filename serves as the default label. A visual indicator distinguishes package mode from filesystem mode. The navigation tree preserves the manifest's hierarchy — display names from link text, nesting from indentation, up to three levels deep.

*(See Story 1 for detailed ACs and test conditions.)*

### 3. Mode Switching (AC-3.1 through AC-3.3)

The viewer supports two sidebar modes: filesystem mode (file tree from disk) and package mode (manifest-driven navigation). Opening a regular folder switches to filesystem mode. Opening a package switches to package mode. Only one mode is active at a time. When switching from package mode to filesystem mode, tabs from the previous package are closed. Opening a different package replaces the current one — the previous package's temp directory is removed.

*(See Story 2 for detailed ACs and test conditions.)*

### 4. Package Creation (AC-4.1 through AC-4.4)

File → New Package creates a manifest file in the current root directory by scanning for markdown files (sorted alphabetically, dotfiles excluded). The directory name becomes the manifest title. The sidebar switches to package mode. If a manifest already exists, a confirmation prompt asks before overwriting. Creating a package in an empty directory produces a manifest with no navigation entries. New Package is not available when an extracted package with a parseable manifest is the active root.

*(See Story 3 for detailed ACs and test conditions.)*

### 5. Export to Package (AC-5.1 through AC-5.4)

The user exports the current root or package to a `.mpk` or `.mpkz` file. The format is selected via the output filename extension. Exporting a folder without a manifest auto-scaffolds one for inclusion in the package without modifying the source directory. Re-exporting an extracted package captures the current state of modified files. Exporting to the original source path clears the stale indicator; exporting to a different path does not. The user can cancel the export at the save dialog without side effects.

*(See Story 4 for detailed ACs and test conditions.)*

### 6. Manifest Editing (AC-6.1 through AC-6.4)

The manifest file is editable using the viewer's existing edit mode. An "Edit Manifest" action in the sidebar header opens the manifest in the content area. Saving changes to the manifest re-parses it on the server and updates the sidebar navigation tree. Adding, removing, and reordering entries, and adding group labels are all reflected after save. Saving a manifest with malformed YAML shows an error and retains the previous sidebar state. Saving a manifest with valid but empty navigation shows a warning and updates the sidebar to an empty state.

*(See Story 5 for detailed ACs and test conditions.)*

### 7. Editing in Extracted Packages and Stale Indicator (AC-7.1 through AC-7.2)

When a package is extracted from a `.mpk`/`.mpkz` file, edits modify files in the temp directory. The rendered view reflects saved changes. A stale indicator appears when any file in the extracted package has been modified — it appears after the first edit and remains after subsequent edits. The stale indicator is not shown for directory-mode packages (which are edited in place).

*(See Story 6 for detailed ACs and test conditions.)*

### 8. No-Manifest Fallback (AC-8.1 through AC-8.3)

When a package has no manifest file or an unreadable manifest, the viewer falls back to displaying the extracted contents as a filesystem tree. A fallback indicator conveys that the package has no manifest. If the manifest exists but could not be parsed, the indicator message is distinct ("manifest could not be parsed" vs "no manifest"). The indicator is not shown for regular folders. The user can scaffold a manifest in fallback mode via File → New Package, switching the sidebar to package mode (with the stale indicator appearing since the package now differs from its source).

*(See Story 7 for detailed ACs and test conditions.)*

### 9. Temp Directory Cleanup (AC-9.1 through AC-9.2)

Extracted packages live in temp directories. When the user closes a package (by switching to another workspace or opening a different package), the previous package's temp directory is removed. On app startup, stale temp directories from previous sessions are cleaned up.

*(See Story 7 for detailed ACs and test conditions.)*

---

## Data Contracts
<!-- Jira: Epic Description — Data Contracts section -->

The package viewer integration adds four REST endpoints:

- **Open Package:** Accepts a package file path. Returns package metadata (title, version, author), a navigation tree (display names, hierarchy, group labels), and package info (source path, extracted root, format, manifest status). Error responses cover invalid file path, invalid archive, file not found, and extraction failure.

- **Get Manifest:** Returns the current package's parsed manifest — metadata, navigation tree, and raw manifest content. Used for sidebar re-sync after manifest edits. Returns error if no package is open, manifest not found, or manifest could not be parsed.

- **Create Package:** Accepts a directory path and an optional overwrite flag. Returns the scaffolded manifest's metadata, navigation tree, and manifest file path. Returns error if a manifest already exists and overwrite was not requested.

- **Export Package:** Accepts an output file path, optional compression flag, and optional source directory. Returns the output path, format, file count, and package size. Returns error if the output path is invalid, no source is available, or the export fails.

Existing file reading, tree scanning, and file saving endpoints work unchanged on extracted package content — the extracted temp directory is treated as a normal directory.

---

## Non-Functional Requirements
<!-- Jira: Epic Description — NFR section -->

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
<!-- Jira: Epic Description — Tech Design Questions section -->

Questions for the Tech Lead to address during design:

1. When exactly are temp directories cleaned up — on package close, on app quit, on startup (stale cleanup), on crash recovery? What mechanism identifies stale temp directories?
2. When the user edits the manifest and saves, how does the sidebar re-sync? Does the client re-fetch the parsed manifest on save, or does the server push an update?
3. Where does the metadata (title, version, author) appear — in the sidebar header, in a collapsible panel, or in a tooltip?
4. How does dropping a package file interact with the existing drag-and-drop behavior?
5. Does the package-mode sidebar replace the filesystem sidebar component entirely, or is it a separate view that swaps in?
6. Where is the active package state stored on the server — in memory, in the session file? What fields constitute the package state?
7. How is "stale" tracked — by comparing file modification times or by setting a flag on any write operation?
8. Does the existing file-watch mechanism work on the temp directory?
9. How does format selection (.mpk vs .mpkz) work in the save dialog?
10. Do existing endpoints need modification to work with the extracted temp directory as root?
11. How is a CLI argument distinguished from a folder path — by file extension or by probing the file type?

---

## Dependencies
<!-- Jira: Epic Description — Dependencies section -->

Technical dependencies:
- Package format library complete (manifest parser, tar read/write, package creation)
- v1 viewer surface (Epics 1–6) complete (rendering, file tree, edit mode, tabs, export, session)
- E2E test infrastructure (Epic 7) available for E2E tests

Process dependencies:
- Manifest file name convention must be settled before implementation begins

---

## Story Breakdown
<!-- Jira: Epic Description — Story Breakdown section -->

### Story 0: Foundation (Infrastructure)
Package-related REST route scaffolds (stubs returning 501), shared types, error classes, service skeletons, session state extension, client state extension, and E2E test fixtures. Prepares infrastructure for all subsequent stories.
*(See story file Story 0 for full details and test conditions.)*

### Story 1: Open Package and Package-Mode Sidebar
Open a .mpk or .mpkz file via the File menu, extract it, display manifest-driven navigation with group labels and metadata, and open documents by clicking navigation entries. Covers AC-1.1, AC-1.4, AC-1.5, AC-2.1 through AC-2.3.
*(See story file Story 1 for full details and test conditions.)*

### Story 2: Mode Switching and Additional Open Methods
Switch between package mode and filesystem mode. Open packages via drag-and-drop and CLI argument. Replace one open package with another. Covers AC-1.2, AC-1.3, AC-3.1 through AC-3.3.
*(See story file Story 2 for full details and test conditions.)*

### Story 3: Package Creation
File → New Package scaffolds a manifest from discovered markdown files. Handles existing manifest confirmation, empty directories, and disabled state for extracted packages. Covers AC-4.1 through AC-4.4.
*(See story file Story 3 for full details and test conditions.)*

### Story 4: Export to Package
Export the current root to a .mpk or .mpkz file. Format selection, auto-scaffold for folders without manifest, re-export of extracted packages with stale indicator clearing, cancel flow. Covers AC-5.1 through AC-5.4.
*(See story file Story 4 for full details and test conditions.)*

### Story 5: Manifest Editing and Sidebar Re-Sync
Open the manifest in the editor, edit navigation entries, save, and see the sidebar update. Error handling for malformed YAML and empty navigation. Covers AC-6.1 through AC-6.4.
*(See story file Story 5 for full details and test conditions.)*

### Story 6: Editing in Extracted Packages and Stale Indicator
Edit files in extracted packages. Stale indicator appears when content has been modified. Not shown for directory-mode packages. Covers AC-7.1 through AC-7.2.
*(See story file Story 6 for full details and test conditions.)*

### Story 7: No-Manifest Fallback and Cleanup
Filesystem fallback for packages without manifests, fallback indicators, manifest scaffolding in fallback mode, and temp directory cleanup. Covers AC-8.1 through AC-9.2.
*(See story file Story 7 for full details and test conditions.)*

---

## Validation Checklist
<!-- Jira: Epic Description — Validation section -->

- [x] User Profile has all four fields + Feature Overview
- [x] Flows cover all paths (happy, alternate, cancel/error)
- [x] Every AC is testable (no vague terms)
- [x] Scope boundaries are explicit (in/out/assumptions)
- [x] Dependencies documented
- [x] Story breakdown covers all 30 ACs
- [x] Stories sequence logically (infrastructure first, open/navigate before create/export/edit)
- [x] Self-review complete
