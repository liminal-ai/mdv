# Epic 9: Package Viewer Integration — Stories

This file contains all stories for Epic 9, derived from the detailed epic and tech design. Each story is a self-contained implementation unit with full AC/TC detail and relevant technical design content.

**Source documents:**
- Epic: `epic.md`
- Tech Design: `tech-design.md`, `tech-design-server.md`, `tech-design-client.md`
- Test Plan: `test-plan.md`

---

<!-- ====================================================================== -->
<!-- STORY 0                                                                 -->
<!-- ====================================================================== -->

# Story 0: Foundation (Infrastructure)

### Summary
<!-- Jira: Summary field -->

Scaffold package-related REST route stubs, Zod schemas, error classes, PackageService and TempDirManager skeletons, session state extension, client state extension, and E2E test fixtures for package operations.

### Description
<!-- Jira: Description field -->

**User Profile**

**Primary User:** The developer of MD Viewer, who is also the primary product user
**Context:** Working with structured markdown collections — specs, documentation, agent outputs — and needing to open, create, navigate, edit, and share them as packages
**Mental Model:** "I open a .mpk file and the sidebar shows the manifest navigation instead of a file tree. I can create packages from folders, edit the manifest to change navigation, and export to share."
**Key Constraint:** Must consume Epic 8's library (manifest parser, tar read/write) without re-implementing any of it. The viewer runs as a Fastify server with a vanilla JS client — no component frameworks.

**Objective**

Establish the shared infrastructure so that all subsequent stories can implement features against stable schemas, error types, service skeletons, and test fixtures. After this story, all four `/api/package/*` routes exist (returning 501), schemas validate correctly, and fixture `.mpk`/`.mpkz` files are available for tests.

**Scope**

In scope:
- Zod schemas for all package request/response types (`PackageOpenRequestSchema`, `PackageOpenResponseSchema`, `PackageManifestResponseSchema`, `PackageCreateRequestSchema`, `PackageCreateResponseSchema`, `PackageExportRequestSchema`, `PackageExportResponseSchema`, `ActivePackageSchema`)
- Package-specific error codes and error classes (`PackageNotFoundError`, `InvalidArchiveError`, `ExtractionError`, `NoActivePackageError`, `ManifestExistsError`, `ManifestNotFoundError`, `ManifestParseError`)
- `PackageService` skeleton with `NotImplementedError` stubs for `open`, `getManifest`, `create`, `export`, `restore`
- `TempDirManager` skeleton with `NotImplementedError` stubs
- Package route stubs (`POST /api/package/open`, `GET /api/package/manifest`, `POST /api/package/create`, `POST /api/package/export`) returning 501
- Session state extension: `activePackage` field added to `SessionStateSchema`
- Client state extension: `packageState` field added to `ClientState`
- Test fixtures: sample `.mpk`, `.mpkz`, and specialized packages (nested, no-manifest, bad-manifest, partial-meta, no-meta, missing-file, mermaid, corrupt)

Out of scope:
- Implementing any package operations (Stories 1–7)
- Client UI components (Stories 1–7)

**Dependencies**
- Epic 8 complete (manifest parser, tar read/write, package creation library)
- Epics 1–6 (v1 viewer surface) complete

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

Story 0 has no directly testable ACs from the epic — it establishes infrastructure used by all subsequent stories. The schemas, error classes, service skeletons, and test fixtures prepared here support all 30 ACs.

Infrastructure prepared for AC-9.1 and AC-9.2 (testable in Story 7).

**Non-TC decided tests (4):** Schema validation tests verifying `PackageOpenRequestSchema`, `PackageOpenResponseSchema`, `PackageCreateRequestSchema`, and `PackageExportRequestSchema` correctly parse valid data and reject invalid data.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Zod schemas** (`app/src/server/schemas/package.ts`):

```typescript
export const PackageOpenRequestSchema = z.object({
  filePath: AbsolutePathSchema,
});

export const ManifestMetadataSchema = z.object({
  title: z.string().optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
});

export const NavigationNodeSchema: z.ZodType = z.lazy(() =>
  z.object({
    displayName: z.string(),
    filePath: z.string().optional(),
    children: z.array(NavigationNodeSchema),
    isGroup: z.boolean(),
  }),
);

export const PackageInfoSchema = z.object({
  sourcePath: AbsolutePathSchema,
  extractedRoot: AbsolutePathSchema,
  format: z.enum(['mpk', 'mpkz']),
  manifestStatus: z.enum(['present', 'missing', 'unreadable']),
  manifestError: z.string().optional(),
});

export const PackageOpenResponseSchema = z.object({
  metadata: ManifestMetadataSchema,
  navigation: z.array(NavigationNodeSchema),
  packageInfo: PackageInfoSchema,
});

export const PackageManifestResponseSchema = z.object({
  metadata: ManifestMetadataSchema,
  navigation: z.array(NavigationNodeSchema),
  raw: z.string(),
});

export const PackageCreateRequestSchema = z.object({
  rootDir: AbsolutePathSchema,
  overwrite: z.boolean().optional(),
});

export const PackageCreateResponseSchema = z.object({
  metadata: ManifestMetadataSchema,
  navigation: z.array(NavigationNodeSchema),
  manifestPath: AbsolutePathSchema,
});

export const PackageExportRequestSchema = z.object({
  outputPath: AbsolutePathSchema,
  compress: z.boolean().optional(),
  sourceDir: AbsolutePathSchema.optional(),
});

export const PackageExportResponseSchema = z.object({
  outputPath: AbsolutePathSchema,
  format: z.enum(['mpk', 'mpkz']),
  fileCount: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
});

export const ActivePackageSchema = z
  .object({
    sourcePath: AbsolutePathSchema,
    extractedRoot: AbsolutePathSchema,
    format: z.enum(['mpk', 'mpkz']),
    mode: z.enum(['extracted', 'directory']),
    stale: z.boolean(),
    manifestStatus: z.enum(['present', 'missing', 'unreadable']),
  })
  .nullable()
  .default(null);

export const PackageErrorCode = {
  INVALID_FILE_PATH: 'INVALID_FILE_PATH',
  INVALID_ARCHIVE: 'INVALID_ARCHIVE',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  EXTRACTION_ERROR: 'EXTRACTION_ERROR',
  NO_ACTIVE_PACKAGE: 'NO_ACTIVE_PACKAGE',
  MANIFEST_NOT_FOUND: 'MANIFEST_NOT_FOUND',
  MANIFEST_PARSE_ERROR: 'MANIFEST_PARSE_ERROR',
  INVALID_DIR_PATH: 'INVALID_DIR_PATH',
  DIR_NOT_FOUND: 'DIR_NOT_FOUND',
  MANIFEST_EXISTS: 'MANIFEST_EXISTS',
  INVALID_OUTPUT_PATH: 'INVALID_OUTPUT_PATH',
  NO_SOURCE: 'NO_SOURCE',
  EXPORT_ERROR: 'EXPORT_ERROR',
} as const;
```

**Client state extension** (`app/src/client/state.ts`):

```typescript
export interface PackageNavigationNode {
  displayName: string;
  filePath?: string;
  children: PackageNavigationNode[];
  isGroup: boolean;
}

export interface PackageMetadata {
  title?: string;
  version?: string;
  author?: string;
}

export interface PackageState {
  active: boolean;
  sidebarMode: 'filesystem' | 'package' | 'fallback';
  sourcePath: string | null;
  effectiveRoot: string | null;
  format: 'mpk' | 'mpkz' | null;
  mode: 'extracted' | 'directory' | null;
  navigation: PackageNavigationNode[];
  metadata: PackageMetadata;
  stale: boolean;
  manifestStatus: 'present' | 'missing' | 'unreadable' | null;
  manifestError: string | null;
  manifestPath: string | null;
  collapsedGroups: Set<string>;
}
```

**Files to create/modify:**
- `app/src/server/schemas/package.ts` (new)
- `app/src/server/services/package.service.ts` (new — stubs)
- `app/src/server/services/temp-dir.service.ts` (new — stubs)
- `app/src/server/routes/package.ts` (new — 501 stubs)
- `app/src/server/utils/errors.ts` (modified — new error classes)
- `app/src/server/schemas/index.ts` (modified — session state extension)
- `app/src/server/app.ts` (modified — register package routes)
- `app/src/shared/types.ts` (modified — re-export package types)
- `app/src/client/state.ts` (modified — add packageState)
- `app/tests/fixtures/packages/` (new — fixture files)
- `app/tests/server/package/schemas.test.ts` (new)

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All Zod schemas defined and exported from `schemas/package.ts`
- [ ] All error classes added to `errors.ts`
- [ ] `PackageService` skeleton with `NotImplementedError` stubs
- [ ] `TempDirManager` skeleton with `NotImplementedError` stubs
- [ ] Four route stubs returning 501 registered in Fastify
- [ ] `activePackage` field added to `SessionStateSchema` (nullable, default null)
- [ ] `packageState` field added to `ClientState`
- [ ] Test fixtures created (sample.mpk, sample.mpkz, nested.mpk, no-manifest.mpk, bad-manifest.mpk, partial-meta.mpk, no-meta.mpk, missing-file.mpk, mermaid.mpk, corrupt.bin)
- [ ] 4 schema validation tests pass
- [ ] `npm run red-verify` passes

---

<!-- ====================================================================== -->
<!-- STORY 1                                                                 -->
<!-- ====================================================================== -->

# Story 1: Open Package and Package-Mode Sidebar

### Summary
<!-- Jira: Summary field -->

Open a `.mpk` or `.mpkz` file via the File menu, extract it, display manifest-driven navigation in the sidebar with group labels and metadata, and open documents by clicking navigation entries.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Deliver the core package flow: the user opens a package file, the server extracts it and parses the manifest, the client switches the sidebar to package-mode navigation showing the manifest's structure. Clicking navigation entries opens documents. Group labels display as non-clickable headings. Package metadata appears in the sidebar header. A mode indicator shows the sidebar is in package mode.

**Scope**

In scope:
- `PackageService.open()` implementation (extraction, manifest parse, state tracking)
- `TempDirManager.create()` implementation
- `POST /api/package/open` route implementation
- Package-mode sidebar component (manifest navigation tree)
- Package header component (metadata + mode indicator)
- Sidebar mode switching infrastructure (render package-sidebar or file-tree based on mode)
- File menu "Open Package" item
- File reading from extracted packages via existing `/api/file` endpoint

Out of scope:
- Drag-and-drop and CLI argument (Story 2)
- Mode switching between package and filesystem (Story 2)
- Package creation, export, manifest editing (Stories 3–5)
- Stale indicator (Story 6)

**Dependencies:** Story 0 (schemas, service skeletons, fixtures)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**PackageService.open()** — the central server method for this story:

```typescript
async open(filePath: string): Promise<PackageOpenResponse> {
  // 1. Verify file exists (throw PackageNotFoundError)
  // 2. TempDirManager.create() — new temp dir, cleanup previous
  // 3. Epic 8: extractPackage(filePath, tempDir)
  // 4. Detect manifest (tempDir + MANIFEST_FILENAME)
  // 5. If found: Epic 8: parseManifest(content) → metadata + navigation
  // 6. If not found: manifestStatus 'missing', empty metadata/navigation
  // 7. If parse error: manifestStatus 'unreadable', manifestError message
  // 8. Store active state, persist to session
  // 9. Return PackageOpenResponse
}
```

**Package sidebar component** (`app/src/client/components/package-sidebar.ts`):
- Renders `NavigationNode[]` as a nested list
- Group labels (`isGroup: true`): `.pkg-nav__group` class, collapse/expand toggle, non-clickable
- Linked entries (`filePath` present): `.pkg-nav__link` class, click dispatches `onOpenFile(effectiveRoot + '/' + node.filePath)`
- Tab creation uses `NavigationNode.displayName` as tab label

**Package header component** (`app/src/client/components/package-header.ts`):
- Mode indicator: "Package" label (AC-2.2)
- Metadata: title, version, author from `packageState.metadata` (AC-2.1)
- Fallback: package filename when no metadata (TC-2.1c)

**DOM selectors:**

| Selector | Element |
|----------|---------|
| `.pkg-header` | Package header container |
| `.pkg-header__title` | Package title |
| `.pkg-header__version` | Package version |
| `.pkg-header__author` | Package author |
| `.pkg-header__mode` | Mode indicator |
| `.pkg-nav` | Navigation tree container |
| `.pkg-nav__group` | Group label entry |
| `.pkg-nav__link` | Linked entry (clickable) |
| `.pkg-nav__link[data-path]` | Relative file path attribute |
| `.pkg-nav__children` | Children container |
| `.sidebar__mode-indicator` | Sidebar-level mode indicator |

**Files to create/modify:**
- `app/src/server/services/package.service.ts` (implement open)
- `app/src/server/services/temp-dir.service.ts` (implement create)
- `app/src/server/routes/package.ts` (implement POST /api/package/open)
- `app/src/client/components/package-sidebar.ts` (new)
- `app/src/client/components/package-header.ts` (new)
- `app/src/client/components/sidebar.ts` (modified — mode switching)
- `app/src/client/components/menu-bar.ts` (modified — Open Package item)
- `app/src/client/app.ts` (modified — package open action, sidebar mode wiring)
- `app/tests/server/package/package-service.test.ts` (new)
- `app/tests/client/package/package-sidebar.test.ts` (new)

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All 18 TCs pass (TC-1.1a–c, TC-1.4a–e, TC-1.5a–b, TC-2.1a–c, TC-2.2a–b, TC-2.3a–c)
- [ ] Opening a .mpk file via File menu switches the sidebar to package-mode navigation
- [ ] Clicking a navigation entry renders the document with full rendering parity
- [ ] Group labels are non-clickable headings with collapse/expand
- [ ] Package metadata displays in sidebar header (full, partial, and fallback)
- [ ] Mode indicator distinguishes package mode from filesystem mode
- [ ] Navigation tree preserves manifest hierarchy up to three levels
- [ ] Invalid package files show error without changing workspace
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- STORY 2                                                                 -->
<!-- ====================================================================== -->

# Story 2: Mode Switching and Additional Open Methods

### Summary
<!-- Jira: Summary field -->

Switch between package mode and filesystem mode, open packages via drag-and-drop and CLI argument, and replace one open package with another.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Enable seamless transitions between package and filesystem modes. Opening a regular folder while in package mode switches to filesystem mode (closing package tabs). Opening a package while in filesystem mode switches to package mode. Opening a different package replaces the current one and cleans up the previous temp directory. Drag-and-drop and CLI argument provide additional ways to open packages.

**Scope**

In scope:
- Mode switching: package → filesystem, filesystem → package, package → different package
- Tab cleanup on mode switch (tabs from previous temp directory closed)
- Drag-and-drop `.mpk`/`.mpkz` files onto the app (Electron path; browser best-effort)
- CLI argument detection by file extension (`.mpk`/`.mpkz`)
- Temp directory cleanup on package switch (via TempDirManager)

Out of scope:
- Package creation, export, manifest editing (Stories 3–5)
- Stale indicator (Story 6)
- No-manifest fallback (Story 7)

**Dependencies:** Story 1 (package open and sidebar established)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**CLI argument detection** (`app/src/server/index.ts`):

```typescript
const cliArg = process.argv[2];
if (cliArg) {
  const ext = path.extname(cliArg).toLowerCase();
  if (ext === '.mpk' || ext === '.mpkz') {
    await packageService.open(path.resolve(cliArg));
  } else {
    await sessionService.setRoot(path.resolve(cliArg));
  }
}
```

**Drag-and-drop** (`app/src/client/app.ts`):
- Electron: `file.path` available on drop events — check extension, route to `apiClient.openPackage()`
- Browser-only: deferred (file path not reliably available)

**Tab cleanup on mode switch:**

```typescript
function closePreviousTabs(store: StateStore): void {
  const prevRoot = store.get().packageState.effectiveRoot;
  if (!prevRoot) return;
  const remainingTabs = state.tabs.filter(tab => !tab.path.startsWith(prevRoot));
  store.update({ tabs: remainingTabs, activeTabId: remainingTabs[0]?.id ?? null });
}
```

**Files to create/modify:**
- `app/src/server/index.ts` (modified — CLI argument detection)
- `app/src/server/services/temp-dir.service.ts` (implement cleanup on switch)
- `app/src/client/components/sidebar.ts` (mode switch logic)
- `app/src/client/app.ts` (modified — drag-and-drop handler, mode switch actions)
- `app/tests/server/package/mode-switching.test.ts` (new)
- `app/tests/client/package/mode-switching.test.ts` (new)

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All 9 TCs pass (TC-1.2a–b, TC-1.3a–c, TC-3.1a–b, TC-3.2a, TC-3.3a)
- [ ] Mode switching works bidirectionally (package ↔ filesystem)
- [ ] CLI argument with `.mpk`/`.mpkz` extension opens as package
- [ ] Drag-and-drop opens package (Electron path)
- [ ] Replacing a package cleans up previous temp directory
- [ ] Package tabs close when switching to filesystem mode
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- STORY 3                                                                 -->
<!-- ====================================================================== -->

# Story 3: Package Creation

### Summary
<!-- Jira: Summary field -->

File → New Package scaffolds a manifest from discovered markdown files, switches to package mode, handles existing manifest overwrite confirmation, empty directories, and disabled state for extracted packages.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Enable the user to create a new package from an existing folder. The server scans the directory for markdown files, scaffolds a manifest with navigation entries sorted alphabetically (excluding dotfiles), and the client switches the sidebar to package mode. If a manifest already exists, a confirmation prompt asks before overwriting. New Package is disabled for extracted packages that already have a parseable manifest.

**Scope**

In scope:
- `PackageService.create()` implementation
- `POST /api/package/create` route implementation
- File menu "New Package" item with disabled state logic
- Overwrite confirmation dialog (409 → confirm → retry with `overwrite: true`)
- Empty directory handling (manifest with frontmatter only, empty navigation)

Out of scope:
- Export to package (Story 4)
- Manifest editing (Story 5)
- Scaffolding manifest in fallback mode (Story 7 — depends on this story)

**Dependencies:** Story 1 (package-mode sidebar established)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**PackageService.create():**

```typescript
async create(rootDir: string, overwrite?: boolean): Promise<PackageCreateResponse> {
  // 1. Verify rootDir exists (throw if not)
  // 2. Check for existing manifest file
  // 3. If exists and !overwrite → throw ManifestExistsError (client shows confirm)
  // 4. Epic 8: scaffoldManifest(rootDir, { overwrite })
  // 5. Update state (mode: 'directory', sourcePath: rootDir)
  // 6. Persist to session
  // 7. Return PackageCreateResponse
}
```

**Overwrite flow** (client):
1. Client calls `POST /api/package/create { rootDir }` without `overwrite`
2. Server returns 409 `MANIFEST_EXISTS` if manifest present
3. Client shows confirmation dialog
4. On confirm: retry with `{ rootDir, overwrite: true }`
5. On cancel: no action (TC-4.2b)

**Menu disabled state:**
```typescript
const isExtractedWithManifest =
  pkgState.active && pkgState.mode === 'extracted' && pkgState.manifestStatus === 'present';
// New Package disabled when isExtractedWithManifest is true (AC-4.4)
```

**Files to create/modify:**
- `app/src/server/services/package.service.ts` (implement create)
- `app/src/server/routes/package.ts` (implement POST /api/package/create)
- `app/src/client/components/menu-bar.ts` (New Package item, disabled state)
- `app/src/client/app.ts` (create package action, overwrite confirmation)
- `app/tests/server/package/package-create.test.ts` (new)
- `app/tests/client/package/package-create.test.ts` (new)

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All 8 TCs pass (TC-4.1a–d, TC-4.2a–b, TC-4.3a, TC-4.4a)
- [ ] File → New Package scaffolds manifest with discovered files sorted alphabetically
- [ ] Dotfiles excluded from scaffolding
- [ ] Overwrite confirmation works (confirm replaces, cancel preserves)
- [ ] Empty directory produces manifest with no navigation entries
- [ ] New Package disabled for extracted packages with parseable manifest
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- STORY 4                                                                 -->
<!-- ====================================================================== -->

# Story 4: Export to Package

### Summary
<!-- Jira: Summary field -->

Export the current root or package to a `.mpk` or `.mpkz` file with format selection, auto-scaffold for folders without manifest, re-export of extracted packages with stale indicator clearing, and cancel flow.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Enable exporting the current workspace or package to a distributable `.mpk` or `.mpkz` file. Format selection is inferred from the output filename extension. Folders without a manifest get an auto-scaffolded manifest included in the export (without modifying the source directory). Re-exporting an extracted package captures the current state of modified files. Exporting to the original source path clears the stale indicator; exporting to a different path does not.

**Scope**

In scope:
- `PackageService.export()` implementation
- `POST /api/package/export` route implementation
- File menu / Export menu "Export Package" item
- Save dialog with format inferred from extension (`.mpk` or `.mpkz`)
- Auto-scaffold manifest for folders without one (manifest not written to source dir)
- Re-export of extracted packages with stale indicator clearing/retention logic
- Cancel flow (no export on cancel)

Out of scope:
- Creating the stale indicator UI (Story 6 — this story handles the clearing logic)
- Manifest editing (Story 5)

**Dependencies:** Story 1 (package open). Story 6 (stale indicator) for TC-5.3b and TC-5.3c — these two tests validate stale clearing after the stale indicator is implemented.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**PackageService.export():**

```typescript
async export(outputPath: string, compress?: boolean, sourceDir?: string): Promise<PackageExportResponse> {
  // 1. Determine source dir (sourceDir param or active package root)
  // 2. If no manifest in source dir → auto-scaffold in memory (AC-5.2)
  // 3. Epic 8: createPackage(sourceDir, outputPath, { compress })
  // 4. If outputPath === state.sourcePath → clearStale() (TC-5.3b)
  // 5. Return PackageExportResponse
}
```

**Export save dialog** (client):
- Default filename from package title or source filename with `.mpk` extension
- Format inferred from extension: `.mpkz` → `compress: true`
- Cancel returns null → no export (TC-5.4a)

**Stale clearing logic:**
- Re-export to original `sourcePath` → `packageState.stale = false` (TC-5.3b)
- Export to different path → stale remains (TC-5.3c)
- Server-side: `PackageService.clearStale()` persists to session

**Files to create/modify:**
- `app/src/server/services/package.service.ts` (implement export)
- `app/src/server/routes/package.ts` (implement POST /api/package/export)
- `app/src/client/components/menu-bar.ts` (Export Package item)
- `app/src/client/app.ts` (export action, save dialog, stale clearing)
- `app/tests/server/package/package-export.test.ts` (new)
- `app/tests/client/package/package-export.test.ts` (new)

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All 9 TCs pass (TC-5.1a–c, TC-5.2a–b, TC-5.3a–c, TC-5.4a)
- [ ] Export to .mpk and .mpkz produces valid packages
- [ ] Auto-scaffold on export works without modifying source directory
- [ ] Re-export captures edited content from extracted packages
- [ ] Stale clears on re-export to original path, remains on different path
- [ ] Cancel at save dialog produces no side effects
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- STORY 5                                                                 -->
<!-- ====================================================================== -->

# Story 5: Manifest Editing and Sidebar Re-Sync

### Summary
<!-- Jira: Summary field -->

Open the manifest in the editor, edit navigation entries, save, and see the sidebar navigation tree update. Error handling for malformed YAML and empty navigation.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Enable editing the manifest file using the viewer's existing edit mode. Saving changes to the manifest triggers a re-parse on the server and a sidebar re-render on the client. If the manifest has malformed YAML, the sidebar retains its previous state and an error is shown. If the manifest has valid syntax but no navigation entries, a warning is shown and the sidebar updates to an empty state.

**Scope**

In scope:
- `PackageService.getManifest()` implementation
- `GET /api/package/manifest` route implementation
- "Edit Manifest" action button in the package header
- Manifest re-sync: client detects manifest save → re-fetches `GET /api/package/manifest` → sidebar re-renders
- Error handling: 422 on malformed YAML (sidebar retains previous state)
- Warning on empty navigation

Out of scope:
- Stale indicator on manifest save (Story 6)
- No-manifest fallback (Story 7)

**Dependencies:** Story 1 (package-mode sidebar established)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Manifest re-sync strategy** — client-initiated re-fetch on manifest save:

1. After every file save, check if saved path matches `packageState.manifestPath`
2. If yes → `GET /api/package/manifest`
3. On 200: update `packageState.navigation` and `packageState.metadata` → sidebar re-renders
4. On 422 (`MANIFEST_PARSE_ERROR`): show error, retain previous sidebar state (AC-6.3)
5. If `navigation.length === 0`: show warning (AC-6.4)

```typescript
async function onFileSaved(savedPath: string): Promise<void> {
  const pkgState = store.get().packageState;
  if (pkgState.active && pkgState.manifestPath && savedPath === pkgState.manifestPath) {
    try {
      const manifest = await apiClient.getPackageManifest();
      store.update({
        packageState: {
          ...pkgState,
          navigation: manifest.navigation,
          metadata: manifest.metadata,
        },
      }, ['packageState']);
      if (manifest.navigation.length === 0) {
        showWarning('Manifest has no navigation entries');
      }
    } catch (err) {
      if (isApiError(err) && err.code === 'MANIFEST_PARSE_ERROR') {
        showError('Manifest has syntax errors — sidebar unchanged');
      }
    }
  }
}
```

**PackageService.getManifest():**

```typescript
async getManifest(): Promise<PackageManifestResponse> {
  // 1. Throw NoActivePackageError if no package open
  // 2. Read manifest from extractedRoot + MANIFEST_FILENAME
  // 3. Throw ManifestNotFoundError if missing
  // 4. Epic 8: parseManifest(content)
  // 5. If parse fails → throw ManifestParseError (route returns 422)
  // 6. Update in-memory state (navigation, metadata)
  // 7. Return { metadata, navigation, raw }
}
```

**Files to create/modify:**
- `app/src/server/services/package.service.ts` (implement getManifest)
- `app/src/server/routes/package.ts` (implement GET /api/package/manifest)
- `app/src/client/components/package-sidebar.ts` (re-render on manifest change)
- `app/src/client/components/package-header.ts` (edit manifest action button)
- `app/src/client/app.ts` (manifest save → re-sync trigger)
- `app/tests/server/package/package-manifest.test.ts` (new)
- `app/tests/client/package/manifest-editing.test.ts` (new)

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All 8 TCs pass (TC-6.1a–b, TC-6.2a–d, TC-6.3a, TC-6.4a)
- [ ] Edit Manifest button opens manifest in content area with tab
- [ ] Adding, removing, reordering entries, and adding groups update the sidebar after save
- [ ] Malformed YAML shows error, sidebar retains previous state
- [ ] Empty navigation shows warning, sidebar updates to empty state
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- STORY 6                                                                 -->
<!-- ====================================================================== -->

# Story 6: Editing in Extracted Packages and Stale Indicator

### Summary
<!-- Jira: Summary field -->

Edit files in extracted packages (temp directory), display a stale indicator when content has been modified, and distinguish extracted packages from directory-mode packages.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

When a user edits files in an extracted package, the edits modify files in the temp directory. A stale indicator appears in the sidebar header to show that the extracted content has diverged from the original package file. The stale indicator does not appear for directory-mode packages (which are edited in place). The stale flag is persisted in the session so it survives restarts.

**Scope**

In scope:
- Edits to extracted package files modify the temp directory copy
- Rendered view reflects saved edits
- Stale indicator UI in the package header
- Stale flag set after first edit, remains after multiple edits
- Stale flag not shown for directory-mode packages
- Server-side stale tracking via Fastify `onResponse` hook on `PUT /api/file`
- Stale flag persisted in session state

Out of scope:
- Stale clearing on re-export (Story 4 — the clearing logic is tested there)

**Dependencies:** Story 1 (package open and sidebar established). Story 4 (for re-export stale clearing tests TC-5.3b/c).

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Server-side stale tracking** — flag-on-write via Fastify `onResponse` hook:

```typescript
// In buildApp() — after PackageService is created:
app.addHook('onResponse', async (request, reply) => {
  if (
    request.method === 'PUT' &&
    request.url === '/api/file' &&
    reply.statusCode === 200
  ) {
    const state = packageService.getState();
    if (state && state.mode === 'extracted' && !state.stale) {
      const savedPath = (request.body as { path?: string })?.path;
      if (savedPath && savedPath.startsWith(state.extractedRoot)) {
        packageService.markStale();
      }
    }
  }
});
```

**Client-side stale detection** — immediate UI responsiveness:

```typescript
// In onFileSaved():
if (
  pkgState.active && pkgState.mode === 'extracted' &&
  pkgState.effectiveRoot && savedPath.startsWith(pkgState.effectiveRoot) &&
  !pkgState.stale
) {
  store.update({ packageState: { ...pkgState, stale: true } }, ['packageState']);
}
```

**Stale indicator UI** (`.pkg-header__stale`):
- Visible when `packageState.stale === true` and `packageState.mode === 'extracted'`
- Not shown for directory-mode packages (TC-7.2c)
- Persisted in session via `activePackage.stale`

**Files to create/modify:**
- `app/src/server/services/package.service.ts` (stale tracking — markStale, clearStale)
- `app/src/server/app.ts` (onResponse hook for stale detection)
- `app/src/client/components/package-header.ts` (stale indicator display)
- `app/src/client/app.ts` (stale detection on file save in package mode)
- `app/tests/server/package/stale-tracking.test.ts` (new)
- `app/tests/client/package/stale-indicator.test.ts` (new)

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All 5 TCs pass (TC-7.1a–b, TC-7.2a–c)
- [ ] Edits to extracted package files modify temp directory, rendered view reflects changes
- [ ] Stale indicator appears after first edit, remains after multiple edits
- [ ] Stale indicator not shown for directory-mode packages
- [ ] Stale flag persists in session state across restarts
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- STORY 7                                                                 -->
<!-- ====================================================================== -->

# Story 7: No-Manifest Fallback and Cleanup

### Summary
<!-- Jira: Summary field -->

Filesystem fallback for packages without manifests, fallback indicators (missing vs unreadable), manifest scaffolding in fallback mode, and temp directory cleanup on package switch and app startup.

### Description
<!-- Jira: Description field -->

**User Profile:** Same as Story 0.

**Objective**

Handle the case where a package has no manifest or an unreadable manifest by falling back to a filesystem tree view of the extracted contents. Distinct indicators show whether the manifest is missing or unparseable. The user can scaffold a new manifest in fallback mode to switch to package mode. Temp directories are cleaned up when no longer needed — on package switch (or folder open) and on app startup (stale directories from previous sessions).

**Scope**

In scope:
- Filesystem fallback for packages with missing or unreadable manifests
- Fallback indicator: "no manifest" vs "manifest could not be parsed" (distinct messages)
- Fallback indicator not shown for regular folders
- Scaffold manifest in extracted package (missing or unreadable manifest) via File → New Package
- Stale indicator appears after scaffolding in fallback mode (package now differs from source)
- Temp directory removal on package switch (or folder open)
- Startup cleanup of stale `mdv-pkg-*` temp directories

Out of scope:
- Full TempDirManager lifecycle beyond switch cleanup and startup cleanup is handled in earlier stories

**Dependencies:** Story 1 (package open), Story 3 (package creation for manifest scaffolding logic), Story 6 (stale indicator — TC-8.3a/b expect stale indicator to appear after scaffolding)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

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

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**TempDirManager implementation:**

```typescript
const TEMP_PREFIX = 'mdv-pkg-';

export class TempDirManager {
  private activeTempDir: string | null = null;

  async create(): Promise<string> {
    await this.cleanup();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    this.activeTempDir = tempDir;
    return tempDir;
  }

  async cleanup(): Promise<void> {
    if (this.activeTempDir) {
      const dir = this.activeTempDir;
      this.activeTempDir = null;
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`Failed to cleanup temp directory ${dir}:`, err);
      }
    }
  }

  async cleanupStale(): Promise<void> {
    const tmpBase = os.tmpdir();
    const entries = await fs.readdir(tmpBase);
    const staleDirs = entries.filter(
      name => name.startsWith(TEMP_PREFIX) &&
              path.join(tmpBase, name) !== this.activeTempDir,
    );
    await Promise.all(
      staleDirs.map(name =>
        fs.rm(path.join(tmpBase, name), { recursive: true, force: true })
          .catch(err => console.warn(`Failed to cleanup stale temp dir ${name}:`, err)),
      ),
    );
  }
}
```

**Fallback sidebar** (`mountFallbackSidebar`):
- Mode indicator: "Package (fallback)"
- Fallback indicator: "No manifest — showing filesystem view" (missing) or "Manifest could not be parsed — showing filesystem view" (unreadable)
- File tree populated via `GET /api/tree?root=<extractedRoot>`

**Scaffold in fallback mode** (client):
- Targets `packageState.effectiveRoot` (the extracted temp dir)
- Missing manifest: calls `POST /api/package/create` directly
- Unreadable manifest: shows overwrite confirmation first (TC-8.3b)
- After scaffolding: switches sidebar to package mode, sets `stale: true`

**DOM selectors:**

| Selector | Element |
|----------|---------|
| `.sidebar__fallback-indicator` | "No manifest" or "parse error" indicator |
| `.sidebar__mode-indicator--fallback` | Fallback mode indicator |

**Files to create/modify:**
- `app/src/server/services/temp-dir.service.ts` (implement cleanup, cleanupStale)
- `app/src/server/services/package.service.ts` (fallback handling on open)
- `app/src/client/components/sidebar.ts` (fallback mode rendering)
- `app/src/client/components/package-header.ts` (fallback indicators)
- `app/src/client/app.ts` (scaffold in fallback mode action)
- `app/tests/server/package/temp-cleanup.test.ts` (new)
- `app/tests/server/package/fallback.test.ts` (new)
- `app/tests/client/package/fallback.test.ts` (new)

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All 10 TCs pass (TC-8.1a–c, TC-8.2a–c, TC-8.3a–b, TC-9.1a, TC-9.2a)
- [ ] No-manifest packages show filesystem fallback with correct indicator
- [ ] Unreadable manifest shows distinct indicator from missing manifest
- [ ] Fallback indicator not shown for regular folders
- [ ] Scaffold manifest in fallback mode switches to package mode with stale indicator
- [ ] Overwrite confirmation shown for unreadable manifest scaffold
- [ ] Temp directory removed on package switch
- [ ] Startup cleanup removes stale `mdv-pkg-*` directories
- [ ] `npm run verify` passes

---

<!-- ====================================================================== -->
<!-- INTEGRATION PATH TRACE                                                  -->
<!-- ====================================================================== -->

# Integration Path Trace

## Path 1: Open Package and Browse

The primary user path: open a .mpk file, see manifest navigation, browse documents.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Open package | User selects File → Open Package, picks .mpk file | Story 1 | TC-1.1a |
| Extract and parse | Server extracts to temp dir, parses manifest | Story 1 | TC-1.1a |
| Sidebar switches | Sidebar changes to package-mode navigation | Story 1 | TC-2.2a, TC-2.3a |
| Metadata displayed | Package title, version, author shown in header | Story 1 | TC-2.1a |
| Mode indicator | "Package" mode indicator visible | Story 1 | TC-2.2a |
| Click entry | User clicks navigation entry | Story 1 | TC-1.4a |
| Document renders | Content area shows rendered markdown | Story 1 | TC-1.4a, TC-1.4e |
| Tab created | Tab appears with display name | Story 1 | TC-1.4c |
| Group collapse | User collapses/expands group labels | Story 1 | TC-1.5b |

## Path 2: Create Package, Edit Manifest, Export

Round-trip: create a package from a folder, customize the manifest, export.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Folder open | Regular folder open in filesystem mode | Story 1 | TC-2.2b |
| New Package | File → New Package scaffolds manifest | Story 3 | TC-4.1a |
| Sidebar switches | Sidebar changes to package mode | Story 3 | TC-4.1c |
| Open manifest | User clicks Edit Manifest | Story 5 | TC-6.1a |
| Edit manifest | User adds/removes/reorders entries | Story 5 | TC-6.2a, TC-6.2b, TC-6.2c |
| Save manifest | Manifest saved, sidebar re-syncs | Story 5 | TC-6.2a |
| Export | User exports to .mpk | Story 4 | TC-5.1a |
| Verify | Exported package openable with correct navigation | Story 4 | TC-5.1a |

## Path 3: Edit in Extracted Package and Re-Export

Open a package, edit content, see stale indicator, re-export.

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Open package | User opens .mpk file | Story 1 | TC-1.1a |
| Open document | User clicks navigation entry | Story 1 | TC-1.4a |
| Edit document | User edits and saves in extracted package | Story 6 | TC-7.1a |
| View reflects edit | Rendered view shows saved changes | Story 6 | TC-7.1b |
| Stale appears | Stale indicator visible | Story 6 | TC-7.2a |
| Re-export | User exports to original path | Story 4 | TC-5.3a |
| Stale clears | Stale indicator clears | Story 4 | TC-5.3b |

No gaps identified. Every segment has an owning story and at least one TC.

---

<!-- ====================================================================== -->
<!-- COVERAGE GATE                                                           -->
<!-- ====================================================================== -->

# Coverage Gate

Every AC and TC from the detailed epic, mapped to exactly one story.

| AC | TC | Story |
|----|-----|-------|
| AC-1.1 | TC-1.1a, TC-1.1b, TC-1.1c | Story 1 |
| AC-1.2 | TC-1.2a, TC-1.2b | Story 2 |
| AC-1.3 | TC-1.3a, TC-1.3b, TC-1.3c | Story 2 |
| AC-1.4 | TC-1.4a, TC-1.4b, TC-1.4c, TC-1.4d, TC-1.4e | Story 1 |
| AC-1.5 | TC-1.5a, TC-1.5b | Story 1 |
| AC-2.1 | TC-2.1a, TC-2.1b, TC-2.1c | Story 1 |
| AC-2.2 | TC-2.2a, TC-2.2b | Story 1 |
| AC-2.3 | TC-2.3a, TC-2.3b, TC-2.3c | Story 1 |
| AC-3.1 | TC-3.1a, TC-3.1b | Story 2 |
| AC-3.2 | TC-3.2a | Story 2 |
| AC-3.3 | TC-3.3a | Story 2 |
| AC-4.1 | TC-4.1a, TC-4.1b, TC-4.1c, TC-4.1d | Story 3 |
| AC-4.2 | TC-4.2a, TC-4.2b | Story 3 |
| AC-4.3 | TC-4.3a | Story 3 |
| AC-4.4 | TC-4.4a | Story 3 |
| AC-5.1 | TC-5.1a, TC-5.1b, TC-5.1c | Story 4 |
| AC-5.2 | TC-5.2a, TC-5.2b | Story 4 |
| AC-5.3 | TC-5.3a, TC-5.3b, TC-5.3c | Story 4 |
| AC-5.4 | TC-5.4a | Story 4 |
| AC-6.1 | TC-6.1a, TC-6.1b | Story 5 |
| AC-6.2 | TC-6.2a, TC-6.2b, TC-6.2c, TC-6.2d | Story 5 |
| AC-6.3 | TC-6.3a | Story 5 |
| AC-6.4 | TC-6.4a | Story 5 |
| AC-7.1 | TC-7.1a, TC-7.1b | Story 6 |
| AC-7.2 | TC-7.2a, TC-7.2b, TC-7.2c | Story 6 |
| AC-8.1 | TC-8.1a, TC-8.1b, TC-8.1c | Story 7 |
| AC-8.2 | TC-8.2a, TC-8.2b, TC-8.2c | Story 7 |
| AC-8.3 | TC-8.3a, TC-8.3b | Story 7 |
| AC-9.1 | TC-9.1a | Story 7 |
| AC-9.2 | TC-9.2a | Story 7 |

**30 ACs, 67 TCs — all mapped. No orphans.**
